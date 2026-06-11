// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

/**
 * @title Integer to Roman (整数转罗马数字)
 * @notice 题目来源: https://leetcode.cn/problems/integer-to-roman/description/
 *
 * 罗马数字包含以下七种字符: I, V, X, L, C, D 和 M。
 *
 *   字符     数值
 *   I        1
 *   V        5
 *   X        10
 *   L        50
 *   C        100
 *   D        500
 *   M        1000
 *
 * 通常情况下，罗马数字中小的数字在大的数字的右边。但也存在特例：
 *   - I 可以放在 V (5) 和 X (10) 的左边，表示 4 和 9
 *   - X 可以放在 L (50) 和 C (100) 的左边，表示 40 和 90
 *   - C 可以放在 D (500) 和 M (1000) 的左边，表示 400 和 900
 *
 * 给定一个整数 (1 ~ 3999)，将其转换为罗马数字。
 *
 * 示例 1:
 *   输入: 3
 *   输出: "III"
 *
 * 示例 2:
 *   输入: 4
 *   输出: "IV"
 *
 * 示例 3:
 *   输入: 9
 *   输出: "IX"
 *
 * 示例 4:
 *   输入: 58
 *   输出: "LVIII"  (L=50, V=5, III=3)
 *
 * 示例 5:
 *   输入: 1994
 *   输出: "MCMXCIV"  (M=1000, CM=900, XC=90, IV=4)
 */
contract IntegerToRoman {
    // 13 个「值-符号」对，从大到小排列，包含 6 种组合特例 (IV/IX/XL/XC/CD/CM)
    uint256[13] internal _values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
    string[13] internal _symbols = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"];

    /**
     * @dev 贪心算法：每次用最大的可能值去减，同时拼接对应符号
     */
    function toRoman(uint256 n) external view returns (string memory) {
        require(n >= 1 && n <= 3999, "out of range");

        // 把状态变量读入局部变量，节省 gas
        uint256[13] memory values = _values;
        string[13] memory symbols = _symbols;

        // 用 bytes 动态拼接（比 string 拼接高效）
        bytes memory result = new bytes(15); // 3999 -> "MMMCMXCIX" = 9 chars, 15 足够
        uint256 len;

        for (uint256 i = 0; i < 13; i++) {
            while (n >= values[i]) {
                n -= values[i];
                // 将符号逐字节写入 result
                bytes memory sym = bytes(symbols[i]);
                for (uint256 j = 0; j < sym.length; j++) {
                    result[len++] = sym[j];
                }
            }
        }

        // 截取实际长度
        bytes memory trimmed = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            trimmed[i] = result[i];
        }
        return string(trimmed);
    }
}
