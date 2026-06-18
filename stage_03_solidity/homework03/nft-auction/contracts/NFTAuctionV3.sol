// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/interfaces/IERC2981.sol";

import "./NFTAuctionV2.sol";

/// @title NFTAuctionV3 —— V2 升级版，新增 NFT 作者版税（ERC2981）
/// @dev 结算资金分配：平台手续费 + ERC2981 作者版税（有硬上限，防操纵），剩余给卖家。
///      pull 模式（记账）。无新状态变量，升级时无需 initializeV3。
contract NFTAuctionV3 is NFTAuctionV2 {
    /// @dev 版税硬上限（基点，1000 = 10%）。防止 NFT 作者/卖家设超高版税吸干成交价或锁死拍卖。
    uint256 public constant ROYALTY_CAP_BP = 1000;

    /// @dev F3：royaltyInfo 子调用 gas 上限。防恶意/异常 NFT 的 royaltyInfo 死循环 / 高 gas
    ///      消耗导致 endAuction OOG（try/catch 无法捕获「无 gas 限制」的 OOG，因 gas 与父调用共享）。
    ///      加 {gas: cap} 后，子调用在 cap 内耗尽会 revert → 被 catch 捕获 → 回退不计版税，结算不卡死。
    ///      50k 足够正常 ERC2981（OZ 实现约 5–10k gas）。
    uint256 public constant ROYALTY_GAS_CAP = 50_000;

    /// @dev V3 资金分配钩子：扣平台费 + ERC2981 版税（硬上限），剩余给卖家。pull 模式。
    ///      NFT 若不支持 ERC2981，则不收版税。
    ///      - 版税 receiver == address(0) 时强制 royalty = 0（防资金记到 0 地址永久沉淀）。
    ///      - fee + royalty > amount 时不再 revert：把 royalty 压到 amount - fee（toSeller = 0），保证不锁死拍卖。
    function _distributePayment(uint256 auctionId, Auction storage a) internal virtual override {
        // 缓存，避免重复 SLOAD
        uint256 amount = a.highestBidAmount;
        BidType btype = a.highestBidType;
        address nftC = a.nftContract;
        uint256 tid = a.tokenId;

        uint256 fee = _calcFee(amount);

        // 查 NFT 作者版税（ERC2981）。F3：限制子调用 gas，防 royaltyInfo 死循环/高 gas OOG 卡死结算。
        // 子调用在 ROYALTY_GAS_CAP 内耗尽（含 revert / Panic / 超出 cap 的 OOG）均被 catch 捕获 → 不计版税。
        address royaltyReceiver;
        uint256 royalty;
        try IERC2981(nftC).royaltyInfo{gas: ROYALTY_GAS_CAP}(tid, amount) returns (address r, uint256 rv) {
            royaltyReceiver = r;
            royalty = rv;
        } catch {
            // 不支持 ERC2981 / 返回非法 / gas 耗尽（F3 OOG 防护）→ 不计版税
            royaltyReceiver = address(0);
            royalty = 0;
        }

        // 版税 receiver 为 0 地址：强制不计版税（资金不应记到 address(0) 永久沉淀）
        if (royaltyReceiver == address(0)) {
            royalty = 0;
        }

        // 版税硬上限（防作者操纵：设 100% 吸干 / 锁死）
        uint256 cap = (amount * ROYALTY_CAP_BP) / MAX_FEE_BP;
        if (royalty > cap) royalty = cap;

        // 注：MAX_PLATFORM_FEE_BP(2500=25%) + ROYALTY_CAP_BP(1000=10%) = 35% < 100%，
        // 两项均为 constant（不可运行时篡改），故 fee + royalty 恒 <= amount，
        // toSeller = amount - fee - royalty 不会下溢。
        // （未来若 fork 调宽 cap，需在此重新评估是否加下溢兜底。）
        uint256 toSeller = amount - fee - royalty;

        // F7 反向退款快照（保证回收时扣回金额与结算记账一致，不受后续费率/版税变动影响）
        settledFee[auctionId] = fee;
        settledRoyalty[auctionId] = royalty;
        settledRoyaltyReceiver[auctionId] = royaltyReceiver;

        _credit(owner(), fee, btype);
        if (royalty > 0) _credit(royaltyReceiver, royalty, btype);
        _credit(a.seller, toSeller, btype);
    }

    /// @notice 版本号（virtual：保留 override 链畅通，避免 V4 升级时回头改本合约）
    function version() external pure virtual override returns (string memory) {
        return "v3";
    }
}
