// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/// @title PriceConverter —— 用 Chainlink Price Feed 把 ETH/ERC20 换算成 USD（统一 18 位精度）
/// @notice ethToUsd 与 erc20ToUsd 用对称写法（都经 USD_PRECISION），避免维护时引入 1e10 倍偏差。
library PriceConverter {
    uint256 private constant USD_PRECISION = 1e18;
    /// @dev 价格陈旧阈值（假设 feed heartbeat <= 1h）
    uint256 private constant STALENESS_THRESHOLD = 1 hours;

    error NegativePrice();
    error StalePrice();

    /// @dev 读取某 feed 的最新价格，做完整安全校验：
    ///      round 完整性（answeredInRound >= roundId）、非负/非零、未陈旧、updatedAt 有效。
    function getPrice(address feed) internal view returns (uint256) {
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) =
            AggregatorV3Interface(feed).latestRoundData();
        if (roundId == 0 || answeredInRound < roundId) revert StalePrice();
        if (answer <= 0) revert NegativePrice();
        if (updatedAt == 0 || block.timestamp - updatedAt > STALENESS_THRESHOLD) revert StalePrice();
        return uint256(answer);
    }

    /// @dev ETH(18 dec) → USD(18 dec)
    /// @param feedDecimals feed 的小数位，由调用方传入（可缓存以省去每次 external call，见合约 _ethUsdFeedDecimals）
    function ethToUsd(uint256 ethAmount, address feed, uint8 feedDecimals) internal view returns (uint256) {
        uint256 price = getPrice(feed);
        // ethAmount(1e18) × price × 1e18 ÷ 10^(feedDec+18) = 18-dec USD（与 erc20ToUsd 对称）
        return (ethAmount * price * USD_PRECISION) / (10 ** (uint256(feedDecimals) + 18));
    }

    /// @dev ERC20(各自 dec) → USD(18 dec)
    /// @param feedDecimals feed 的小数位，由调用方传入（可缓存以省去每次 external call）
    function erc20ToUsd(uint256 erc20Amount, address feed, uint8 feedDecimals, uint8 erc20Decimals)
        internal
        view
        returns (uint256)
    {
        uint256 price = getPrice(feed);
        return (erc20Amount * price * USD_PRECISION) / (10 ** (uint256(feedDecimals) + erc20Decimals));
    }
}
