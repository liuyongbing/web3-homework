// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @dev 测试用：模拟 Chainlink Price Feed，返回固定/可控的价格与 round 元数据。
contract MockPriceFeed {
    int256 public latestAnswer;
    uint8 public decimalsVal;
    uint80 public roundId;
    uint80 public answeredInRound;
    uint256 public updatedAt;
    bool public useFixedTimestamp;

    constructor(uint8 _decimals, int256 _initialAnswer) {
        decimalsVal = _decimals;
        latestAnswer = _initialAnswer;
        roundId = 1;
        answeredInRound = 1;
    }

    // 模拟 Chainlink 的 latestRoundData。
    // 默认 updatedAt 用当前 block.timestamp（保证 PriceConverter 的"陈旧检查"不报错）。
    function latestRoundData() external view returns (uint80, int256 answer, uint256, uint256, uint80) {
        uint256 ts = useFixedTimestamp ? updatedAt : block.timestamp;
        return (roundId, latestAnswer, ts, ts, answeredInRound);
    }

    // 测试时可改价格（模拟价格波动）—— 覆盖 setPrice 行
    function setPrice(int256 _price) external {
        latestAnswer = _price;
    }

    // 测试用：设置固定的 round 元数据（模拟陈旧 / 不完整 round）
    function setRoundMeta(uint80 _roundId, uint80 _answeredInRound, uint256 _updatedAt) external {
        roundId = _roundId;
        answeredInRound = _answeredInRound;
        updatedAt = _updatedAt;
        useFixedTimestamp = true;
    }

    function decimals() external view returns (uint8) {
        return decimalsVal;
    }

    function description() external pure returns (string memory) {
        return "Mock Price Feed";
    }

    function version() external pure returns (uint256) {
        return 1;
    }
}
