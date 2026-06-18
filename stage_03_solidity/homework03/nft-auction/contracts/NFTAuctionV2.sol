// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./NFTAuction.sol";

/// @title NFTAuctionV2 —— V1 升级版，新增平台手续费
/// @dev ⚠️ 升级铁律：新状态变量只能「追加」在 V1 所有变量之后。
///      资金分配钩子沿用 pull 模式（只记账，不转账）。
contract NFTAuctionV2 is NFTAuction {
    /// @dev 基点分母（10000 = 100%），全仓统一引用
    uint256 public constant MAX_FEE_BP = 10000;

    /// @dev 平台手续费硬上限（基点，2500 = 25%）。与 V3 版税 cap 10% 联动，
    ///      保证 fee + royalty < 100%，结算永不因费率之和下溢而锁死拍卖。
    uint256 public constant MAX_PLATFORM_FEE_BP = 2500;

    /// @dev 平台手续费率（基点）
    uint256 public platformFeeBp;

    /// @dev Gas 优化：缓存两个 Chainlink feed 的小数位（feed decimals 部署后恒定不变）。
    ///      追加在 V2 末尾（V3 无新状态变量），不破坏 V1/V2 已有存储布局。
    ///      _ethUsdFeedDecimals / _paymentTokenUsdFeedDecimals override 时用它替代每次出价的 decimals() external call。
    /// @notice ⚠️ 约束：feed 地址仅在 V1 initialize 设置且不可变（合约无换 feed 入口）。未来若新增换 feed 函数，
    ///         必须同步刷新这两个缓存，否则换 feed 后出价 USD 换算会沿用旧 decimals（跨币种套利/误判 BidTooLow）。
    uint8 public ethUsdFeedDecimals;
    uint8 public paymentTokenUsdFeedDecimals;

    event PlatformFeeUpdated(uint256 newFeeBp);

    error FeeTooHigh();

    /// @notice V2 升级初始化（reinitializer(2)，只能调一次）
    /// @param _platformFeeBp 平台手续费率（基点，<= MAX_PLATFORM_FEE_BP）
    function initializeV2(uint256 _platformFeeBp) public onlyOwner reinitializer(2) {
        if (_platformFeeBp > MAX_PLATFORM_FEE_BP) revert FeeTooHigh();
        platformFeeBp = _platformFeeBp;
        // Gas 优化：缓存 feed decimals（部署后恒定），后续每次出价省一次 decimals() external call。
        // 仅此处读一次 feed；之后 _ethUsdFeedDecimals/_paymentTokenUsdFeedDecimals 走 storage 缓存。
        ethUsdFeedDecimals = _readFeedDecimals(ethUsdFeed);
        paymentTokenUsdFeedDecimals = _readFeedDecimals(paymentTokenUsdFeed);
        emit PlatformFeeUpdated(_platformFeeBp);
    }

    /// @notice 更新平台手续费率（仅 owner）
    function setPlatformFee(uint256 _platformFeeBp) external onlyOwner {
        if (_platformFeeBp > MAX_PLATFORM_FEE_BP) revert FeeTooHigh();
        platformFeeBp = _platformFeeBp;
        emit PlatformFeeUpdated(_platformFeeBp);
    }

    /// @dev 平台手续费计算（钩子，可被子类复用/观察）。V3 直接 override 不改逻辑，
    ///      但统一从这一处算 fee，避免在子类里复制公式（DRY）。
    function _calcFee(uint256 amount) internal view virtual returns (uint256) {
        return (amount * platformFeeBp) / MAX_FEE_BP;
    }

    /// @dev override：返回缓存的 feed decimals，省去每次出价的 decimals() external call
    ///      （warm external call ~900 gas → warm SLOAD ~100 gas，每次出价省 ~800 gas）。
    ///      兜底：缓存为 0（不应发生——initializeV2 必设）时回退实时读，保证换算正确。
    function _ethUsdFeedDecimals() internal view virtual override returns (uint8) {
        uint8 d = ethUsdFeedDecimals;
        return d == 0 ? _readFeedDecimals(ethUsdFeed) : d;
    }

    function _paymentTokenUsdFeedDecimals() internal view virtual override returns (uint8) {
        uint8 d = paymentTokenUsdFeedDecimals;
        return d == 0 ? _readFeedDecimals(paymentTokenUsdFeed) : d;
    }

    /// @dev V2 资金分配钩子：扣平台手续费，剩余给卖家。pull 模式（记账）。
    function _distributePayment(uint256 auctionId, Auction storage a) internal virtual override {
        uint256 amount = a.highestBidAmount;
        uint256 fee = _calcFee(amount);
        uint256 toSeller = amount - fee;
        settledFee[auctionId] = fee; // F7 反向退款快照
        _credit(owner(), fee, a.highestBidType);
        _credit(a.seller, toSeller, a.highestBidType);
    }

    /// @notice 版本号
    function version() external pure virtual override returns (string memory) {
        return "v2";
    }
}
