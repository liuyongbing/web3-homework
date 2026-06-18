// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./library/PriceConverter.sol";

/// @title NFTAuction —— NFT 拍卖市场（UUPS 可升级，V1）
/// @notice 支持以 ETH 或 ERC20 出价，用 Chainlink 预言机把出价换算成美元比较。
///         资金采用 pull（提取）模式：出价退款与结算分账都先记账，收款方主动 withdraw，避免转账失败卡死拍卖。
contract NFTAuction is Initializable, OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuard, PausableUpgradeable {
    using SafeERC20 for IERC20;

    // ─── 自定义错误（比 require string 省 gas 且语义清晰；关键几个参数化便于定位）───
    error AuctionNotFound(uint256 auctionId);
    error AuctionAlreadyEnded(uint256 auctionId);
    error AuctionNotOver();
    error AuctionNotEnded();
    error ZeroBid();
    error BidTooLow(uint256 currentHighestUsd, uint256 yourBidUsd);
    error DurationInvalid();
    error ZeroAddress();
    error InvalidDecimals();
    error NothingToWithdraw();
    error EthTransferFailed();
    error NftAlreadyClaimed();
    error NotWinnerOrSeller();
    error DurationTooLong(uint256 max);
    error BidTypeNotAllowed(BidType accepted, BidType used);
    error NotSeller();
    error ReclaimTooEarly(uint256 reclaimableAt);

    /// @dev 出价货币类型
    enum BidType {
        None,
        Eth,
        Erc20
    }

    /// @dev 单个拍卖的全部信息
    struct Auction {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 endTime;
        address highestBidder;
        uint256 highestBidUsd;
        uint256 highestBidAmount;
        BidType highestBidType;
        bool ended;
        BidType acceptedBidType; // F2：拍卖接受的出价币种（None=两者皆可/Eth/Erc20）。追加末尾，不破坏现有字段 index。
    }

    // ─── 全局配置（所有拍卖共用）───
    /// @dev 拍卖最长持续时长（小时）。防 durationHours*1 hours 溢出 & 「永不结束」拍卖锁仓。
    uint256 public constant MAX_DURATION_HOURS = 8760; // 1 年

    address public ethUsdFeed;
    address public paymentToken;
    address public paymentTokenUsdFeed;
    uint8 public paymentTokenDecimals;

    uint256 public nextAuctionId; // 从 1 开始，0 表示"不存在"
    mapping(uint256 => Auction) public auctions; // auctionId => 拍卖

    // ─── pull 模式：待提取资金（按币种分账）───
    mapping(address => uint256) public pendingEth;
    mapping(address => uint256) public pendingErc20;

    // ─── pull 模式（NFT 出站）：auctionId => NFT 是否已被赢家/卖家领走 ───
    //      追加在末尾，不破坏 V2/V3 存储布局。endAuction 不再直接转 NFT，
    //      改由 claimNft 主动领取，避免赢家是拒收 NFT 的合约 → 结算 revert → 拍卖卡死。
    mapping(uint256 => bool) public nftClaimed;

    // ─── F7：NFT 超时回收 ───
    /// @dev 赢家逾期未领 NFT 的回收延迟（结算后多久卖家可 reclaim）。
    uint256 public constant NFT_RECLAIM_DELAY = 7 days;
    /// @dev 结算时刻（F7 回收计时基准；0 表示未结算）
    mapping(uint256 => uint256) public endedAt;
    /// @dev 结算分账快照（F7 反向退款用）：保证回收时扣回金额与当初记账完全一致，
    ///      不受后续 setPlatformFee / royaltyInfo 变动影响。V1 拍卖这三项恒为 0。
    mapping(uint256 => uint256) public settledFee;
    mapping(uint256 => uint256) public settledRoyalty;
    mapping(uint256 => address) public settledRoyaltyReceiver;

    // ─── 事件 ───
    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 endTime,
        BidType acceptedBidType
    );
    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 amount, // 实际出价金额（ETH 的 msg.value 或 ERC20 的 amount）
        uint256 bidUsd,
        BidType bidType
    );
    event AuctionEnded(uint256 indexed auctionId, address indexed seller, address winner, uint256 amountUsd);
    event Withdrawn(address indexed account, uint256 ethAmount, uint256 erc20Amount);
    /// @dev NFT pull 领取：recipient 为赢家（有人出价）或卖家（无人出价）
    event NftClaimed(uint256 indexed auctionId, address indexed recipient, uint256 tokenId);
    /// @dev F7：赢家逾期未领，卖家超时回收 NFT（同时反向退款给赢家）
    event NftReclaimed(uint256 indexed auctionId, address indexed seller, uint256 tokenId);
    /// @dev F7：reclaimNft 反向退款给赢家。amount 为实际可扣回额（可能 < 原出价，因收款方可能已提现）。
    event NftRefunded(uint256 indexed auctionId, address indexed winner, uint256 amount, BidType bidType);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice 初始化（代理部署时调用一次）
    function initialize(
        address _ethUsdFeed,
        address _paymentToken,
        address _paymentTokenUsdFeed,
        uint8 _paymentTokenDecimals
    ) public initializer {
        if (_ethUsdFeed == address(0) || _paymentToken == address(0) || _paymentTokenUsdFeed == address(0)) {
            revert ZeroAddress();
        }
        if (_paymentTokenDecimals > 18) revert InvalidDecimals();
        __Ownable_init(msg.sender);
        __Pausable_init();
        ethUsdFeed = _ethUsdFeed;
        paymentToken = _paymentToken;
        paymentTokenUsdFeed = _paymentTokenUsdFeed;
        paymentTokenDecimals = _paymentTokenDecimals;
        nextAuctionId = 1; // 0 留作"不存在"哨兵
    }

    /// @dev UUPS 升级权限：只有 owner 能换实现
    function _authorizeUpgrade(address) internal override onlyOwner {}

    /// @notice 紧急暂停 / 恢复（仅 owner）
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice 版本号（基类默认 v1，子类 override）
    function version() external pure virtual returns (string memory) {
        return "v1";
    }

    // ═══════════════ 拍卖生命周期 ═══════════════

    /// @notice 创建拍卖：把 NFT 托管进合约，等待竞拍
    /// @param nftContract NFT 合约地址
    /// @param tokenId 拍卖的 NFT 编号
    /// @param durationHours 拍卖持续时长（小时），>0
    /// @return auctionId 新拍卖的 id
    /// @notice 创建拍卖（混合出价，向后兼容）：接受 ETH 或 ERC20 出价。
    ///         ⚠️ 混合模式下存在 F2 跨币种套利风险，生产建议用下方单币种锁定版本。
    function createAuction(address nftContract, uint256 tokenId, uint256 durationHours)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 auctionId)
    {
        return _createAuction(nftContract, tokenId, durationHours, BidType.None);
    }

    /// @notice 创建拍卖（F2 单币种锁定）：仅接受指定币种出价，消除跨币种套利。
    /// @param _acceptedBidType 接受的出价币种：Eth / Erc20（None 等价于上方混合版本）。
    function createAuction(address nftContract, uint256 tokenId, uint256 durationHours, BidType _acceptedBidType)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 auctionId)
    {
        return _createAuction(nftContract, tokenId, durationHours, _acceptedBidType);
    }

    /// @dev createAuction 共用实现（两个重载入口转此）。
    function _createAuction(address nftContract, uint256 tokenId, uint256 durationHours, BidType _acceptedBidType)
        internal
        returns (uint256 auctionId)
    {
        if (durationHours == 0) revert DurationInvalid();
        if (durationHours > MAX_DURATION_HOURS) revert DurationTooLong(MAX_DURATION_HOURS);

        // 把 NFT 从卖家转入拍卖合约托管（前提：卖家已 approve 本合约）
        IERC721(nftContract).transferFrom(msg.sender, address(this), tokenId);

        unchecked {
            auctionId = nextAuctionId++;
        }
        uint256 endTime = block.timestamp + durationHours * 1 hours;

        auctions[auctionId] = Auction({
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            endTime: endTime,
            highestBidder: address(0),
            highestBidUsd: 0,
            highestBidAmount: 0,
            highestBidType: BidType.None,
            ended: false,
            acceptedBidType: _acceptedBidType
        });

        emit AuctionCreated(auctionId, msg.sender, nftContract, tokenId, endTime, _acceptedBidType);
    }

    /// @notice 用 ETH 出价
    function bidWithEth(uint256 auctionId) external payable whenNotPaused nonReentrant {
        if (msg.value == 0) revert ZeroBid();
        Auction storage a = auctions[auctionId];
        _assertActive(a, auctionId);
        _assertBidTypeAllowed(a, BidType.Eth);

        uint256 bidUsd = PriceConverter.ethToUsd(msg.value, ethUsdFeed, _ethUsdFeedDecimals());
        if (bidUsd <= a.highestBidUsd) revert BidTooLow(a.highestBidUsd, bidUsd);

        // 先把被超过的出价者记账退款（pull，不直接转账 → 避免拒收 ETH 卡死）
        _creditRefund(a);

        // Effects
        a.highestBidder = msg.sender;
        a.highestBidUsd = bidUsd;
        a.highestBidAmount = msg.value;
        a.highestBidType = BidType.Eth;

        emit BidPlaced(auctionId, msg.sender, msg.value, bidUsd, BidType.Eth);
    }

    /// @notice 用 ERC20 出价
    /// @param amount 出价的 ERC20 数量
    function bidWithErc20(uint256 auctionId, uint256 amount) external whenNotPaused nonReentrant {
        if (amount == 0) revert ZeroBid();
        Auction storage a = auctions[auctionId];
        _assertActive(a, auctionId);
        _assertBidTypeAllowed(a, BidType.Erc20);

        uint256 bidUsd = PriceConverter.erc20ToUsd(
            amount, paymentTokenUsdFeed, _paymentTokenUsdFeedDecimals(), paymentTokenDecimals
        );
        if (bidUsd <= a.highestBidUsd) revert BidTooLow(a.highestBidUsd, bidUsd);

        // 收 ERC20：用「转账前后余额差」作为实际到账量（兼容 fee-on-transfer / 通缩代币）。
        // 若直接用 amount 记账，通缩代币会让合约实持 < sum(pendingErc20)，最后提款者余额不足 DoS。
        uint256 balBefore = IERC20(paymentToken).balanceOf(address(this));
        IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = IERC20(paymentToken).balanceOf(address(this)) - balBefore;
        if (received == 0) revert ZeroBid();

        // 用实际到账量重算 USD 并复核：防通缩代币「声称高价、实到极少」绕过 BidTooLow 套利。
        uint256 receivedUsd = PriceConverter.erc20ToUsd(
            received, paymentTokenUsdFeed, _paymentTokenUsdFeedDecimals(), paymentTokenDecimals
        );
        if (receivedUsd <= a.highestBidUsd) revert BidTooLow(a.highestBidUsd, receivedUsd);

        // 先把被超过的出价者记账退款
        _creditRefund(a);

        // Effects：用实际到账量记账（资金守恒）
        a.highestBidder = msg.sender;
        a.highestBidUsd = receivedUsd;
        a.highestBidAmount = received;
        a.highestBidType = BidType.Erc20;

        emit BidPlaced(auctionId, msg.sender, received, receivedUsd, BidType.Erc20); // N3：amount 与 bidUsd 均发实到量（与 highestBidAmount/highestBidUsd 一致）
    }

    /// @notice 结束拍卖：资金分账记账（各方主动 withdraw）。任何人可触发。
    /// @dev NFT 不再在此直接转出（pull 化）：若赢家是拒收 NFT 的合约会导致结算 revert、
    ///      拍卖永久卡死 + 资金/NFT 双锁。NFT 由赢家（有人出价）或卖家（无人出价）主动 claimNft 领取。
    function endAuction(uint256 auctionId) external whenNotPaused nonReentrant {
        Auction storage a = auctions[auctionId];
        if (a.seller == address(0)) revert AuctionNotFound(auctionId);
        if (a.ended) revert AuctionAlreadyEnded(auctionId);
        if (block.timestamp < a.endTime) revert AuctionNotOver();

        // Effects：先标记结束，防重入重复结算
        a.ended = true;
        endedAt[auctionId] = block.timestamp; // F7：回收计时基准

        address winner = a.highestBidder;

        // 有人出价时：资金分账记账（钩子，pull 模式，不直接转账）。
        // 无人出价：无资金可分（卖家自己 claimNft 领回 NFT）。
        if (winner != address(0)) {
            _distributePayment(auctionId, a);
        }

        emit AuctionEnded(auctionId, a.seller, winner, a.highestBidUsd);
    }

    /// @notice 领取已结算拍卖的 NFT（pull 出站）。
    ///         有人出价 → 赢家领；无人出价 → 卖家领回。
    ///         NFT 转账失败只影响领取方自己（可重试），不卡死拍卖结算。
    function claimNft(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        if (!a.ended) revert AuctionNotEnded();
        if (nftClaimed[auctionId]) revert NftAlreadyClaimed();

        address recipient = a.highestBidder != address(0) ? a.highestBidder : a.seller;
        if (msg.sender != recipient) revert NotWinnerOrSeller();

        // Effects：先标记已领（CEI）
        nftClaimed[auctionId] = true;
        // Interactions
        IERC721(a.nftContract).safeTransferFrom(address(this), recipient, a.tokenId);

        emit NftClaimed(auctionId, recipient, a.tokenId);
    }

    /// @notice F7：超时回收 NFT。结算满 NFT_RECLAIM_DELAY 后，若赢家仍未 claimNft，
    ///         卖家可领回 NFT；同时把赢家出价尽可能退还（反向分账，从结算快照扣回）。
    ///         无人出价的拍卖：卖家本就能 claimNft，此函数同样兜底。
    ///         N1（软扣减）：收款方已 withdraw 的部分追不回，winner 退「实际可扣额」
    ///         （各方均未提现则全额）；回收总能完成，NFT 必回卖家，不再因某方提现而永久失效。
    function reclaimNft(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        if (a.seller == address(0)) revert AuctionNotFound(auctionId);
        if (!a.ended) revert AuctionNotEnded();
        if (nftClaimed[auctionId]) revert NftAlreadyClaimed();
        if (msg.sender != a.seller) revert NotSeller();
        uint256 reclaimableAt = endedAt[auctionId] + NFT_RECLAIM_DELAY;
        if (block.timestamp < reclaimableAt) revert ReclaimTooEarly(reclaimableAt);

        // Effects：先标记（CEI）
        nftClaimed[auctionId] = true;

        // 有赢家却逾期未领：NFT 回卖家，把结算时分出去的钱从各收款方 pending 扣回、记给赢家（退款保护）。
        // 软扣减：收款方已提现的部分追不回，winner 退实际可扣额（各方未提现则全额）。
        BidType btype = a.highestBidType;
        uint256 refunded = 0;
        if (a.highestBidder != address(0)) {
            refunded = _reverseDistribution(auctionId, a);
        }

        // Interactions
        IERC721(a.nftContract).safeTransferFrom(address(this), a.seller, a.tokenId);

        emit NftReclaimed(auctionId, a.seller, a.tokenId);
        if (refunded > 0) {
            emit NftRefunded(auctionId, a.highestBidder, refunded, btype);
        }
    }

    // ═══════════════ pull 模式提取 ═══════════════

    /// @notice 提取账户的全部待领资金（ETH + ERC20）
    function withdraw() external nonReentrant {
        uint256 eth = pendingEth[msg.sender];
        uint256 erc20 = pendingErc20[msg.sender];
        if (eth == 0 && erc20 == 0) revert NothingToWithdraw();

        // Effects：先清零（CEI）—— 条件清零，省无谓 SSTORE
        if (eth > 0) pendingEth[msg.sender] = 0;
        if (erc20 > 0) pendingErc20[msg.sender] = 0;

        // Interactions
        if (erc20 > 0) {
            IERC20(paymentToken).safeTransfer(msg.sender, erc20);
        }
        if (eth > 0) {
            (bool ok,) = payable(msg.sender).call{value: eth}("");
            if (!ok) revert EthTransferFailed();
        }

        emit Withdrawn(msg.sender, eth, erc20);
    }

    // ═══════════════ 内部 ═══════════════

    /// @dev 校验拍卖存在、未结束、未到期
    function _assertActive(Auction storage a, uint256 auctionId) internal view {
        if (a.seller == address(0)) revert AuctionNotFound(auctionId);
        if (a.ended) revert AuctionAlreadyEnded(auctionId);
        if (block.timestamp >= a.endTime) revert AuctionNotOver();
    }

    /// @dev 校验出价币种符合拍卖设定（F2 单币种锁定）。
    ///      acceptedBidType==None（混合/旧拍卖）放行两种；否则必须与 used 一致。
    function _assertBidTypeAllowed(Auction storage a, BidType used) internal view {
        if (a.acceptedBidType != BidType.None && a.acceptedBidType != used) {
            revert BidTypeNotAllowed(a.acceptedBidType, used);
        }
    }

    /// @dev 读取某 feed 的小数位（实际打一次 external call）。
    ///      供两个 feed-decimals 钩子的默认实现与子类兜底复用，避免重复代码。
    function _readFeedDecimals(address feed) internal view returns (uint8) {
        return AggregatorV3Interface(feed).decimals();
    }

    /// @dev ETH 价格 feed 的小数位。virtual：子类（V2+）可 override 返回缓存的 storage 值，
    ///      把每次出价都要打的 `decimals()` external call（warm ~900 gas）换成一次 SLOAD（~100 gas）。
    ///      V1 默认实时读，保持向后兼容（未升级的旧代理行为不变）。
    function _ethUsdFeedDecimals() internal view virtual returns (uint8) {
        return _readFeedDecimals(ethUsdFeed);
    }

    /// @dev ERC20 价格 feed 的小数位（同上，可被子类缓存）。
    function _paymentTokenUsdFeedDecimals() internal view virtual returns (uint8) {
        return _readFeedDecimals(paymentTokenUsdFeed);
    }

    /// @dev 把「被超过的出价者」的出价记账到 pending（pull 退款），不直接转账
    function _creditRefund(Auction storage a) internal {
        if (a.highestBidder == address(0)) return; // 第一笔出价，没人可退
        _credit(a.highestBidder, a.highestBidAmount, a.highestBidType);
    }

    /// @dev 记账一笔待提取资金（按币种）
    function _credit(address to, uint256 amount, BidType btype) internal {
        if (amount == 0) return;
        if (btype == BidType.Eth) {
            pendingEth[to] += amount;
        } else {
            pendingErc20[to] += amount;
        }
    }

    /// @dev 资金分配钩子。V1：全部记给卖家。子类 override 可改变分配（V2 扣手续费，V3 再扣版税）。
    ///      pull 模式：只记账，不转账 → 转账失败不会卡死结算。
    ///      子类须在此写入 settled* 快照，供 F7 _reverseDistribution 反向退款（V1 无 fee/royalty，快照恒 0）。
    function _distributePayment(
        uint256,
        /*auctionId*/
        Auction storage a
    )
        internal
        virtual
    {
        // V1：全部记给卖家，不用 auctionId。子类（V2/V3）override 时用 auctionId 写 settled* 快照。
        _credit(a.seller, a.highestBidAmount, a.highestBidType);
    }

    /// @dev F7 反向分账：把结算时分出去的钱从各收款方 pending 扣回，记给赢家（退款保护）。
    ///      N1 软扣减：_debit 返回实际扣回量（收款方已提现则 < 应扣），winner 退「实际可扣总额」。
    ///      各方均未提现时 refunded == amount（全额退款，原公平语义）。读 settled* 快照保证扣回基准一致。
    function _reverseDistribution(uint256 auctionId, Auction storage a) internal returns (uint256 refunded) {
        uint256 amount = a.highestBidAmount;
        BidType btype = a.highestBidType;
        uint256 fee = settledFee[auctionId];
        uint256 royalty = settledRoyalty[auctionId];
        uint256 toSeller = amount - fee - royalty;
        uint256 taken;
        if (fee > 0) taken += _debit(owner(), fee, btype);
        if (royalty > 0) taken += _debit(settledRoyaltyReceiver[auctionId], royalty, btype);
        taken += _debit(a.seller, toSeller, btype);
        _credit(a.highestBidder, taken, btype);
        return taken;
    }

    /// @dev 记账一笔待提取资金扣减（F7 反向退款用）。软扣减：min(amount, pending)，返回实际扣减量。
    ///      N1：收款方可能已 withdraw，软扣减避免下溢 revert，使 reclaimNft 总能完成（部分退款）。
    function _debit(address from, uint256 amount, BidType btype) internal returns (uint256 taken) {
        if (amount == 0) return 0;
        if (btype == BidType.Eth) {
            uint256 avail = pendingEth[from];
            taken = amount < avail ? amount : avail;
            pendingEth[from] = avail - taken;
        } else {
            uint256 avail = pendingErc20[from];
            taken = amount < avail ? amount : avail;
            pendingErc20[from] = avail - taken;
        }
    }

    /// @dev 接收 ETH（兜底）
    receive() external payable {}
}
