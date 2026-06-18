// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IAuction {
    function bidWithEth(uint256 auctionId) external payable;
}

/// @dev 攻击者 mock：能调 bidWithEth 出价，但 receive() 故意 revert 拒收 ETH。
///      用来验证 pull 模式下，被超过的「毒出价者」不会卡死拍卖（退款只记账 pendingEth，不直接转账）。
///      若合约用 push 模式（出价时直接转账退款），此合约会卡死整个拍卖。
///      注：资金在构造时注入（避免直接转账触发 receive revert）。
contract RejectingBidder {
    IAuction public immutable auction;

    constructor(address _auction) payable {
        auction = IAuction(_auction);
    }

    /// @notice 用合约自身余额出价
    function bid(uint256 auctionId) external {
        auction.bidWithEth{value: address(this).balance}(auctionId);
    }

    /// @notice 转发 withdraw（合约拒收 ETH → 触发 NFTAuction 的 EthTransferFailed，验证 pull 提取失败不卡死合约）
    function withdraw() external {
        // NFTAuction 非 payable，但能调
        (bool ok, bytes memory data) = address(auction).call(abi.encodeWithSignature("withdraw()"));
        if (!ok) {
            // 冒泡 revert（EthTransferFailed）
            assembly {
                revert(add(data, 0x20), mload(data))
            }
        }
    }

    /// @notice 拒收一切 ETH —— pull 模式下这只会让它的 withdraw 失败，但不会卡死别人
    receive() external payable {
        revert("RejectingBidder: I reject ETH");
    }
}
