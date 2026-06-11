// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

/**
 * @title Roman to Integer (罗马数字转整数)
 * @notice 题目来源: https://leetcode.cn/problems/roman-to-integer/
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
 * 罗马数字通常从左到右按从大到小的顺序书写。但当小值出现在大值左边时，
 * 表示需要减去这个小值，例如 IV = 4, IX = 9。
 *
 * 规则：
 *   - 如果当前字符的值 >= 下一个字符的值，加上当前值
 *   - 如果当前字符的值 <  下一个字符的值，减去当前值
 *   - 最后一个字符总是加上
 *
 * 给定一个罗马数字字符串，将其转换为整数。输入范围 1 ~ 3999。
 *
 * 示例 1:
 *   输入: "III"
 *   输出: 3
 *
 * 示例 2:
 *   输入: "IV"
 *   输出: 4
 *
 * 示例 3:
 *   输入: "IX"
 *   输出: 9
 *
 * 示例 4:
 *   输入: "LVIII"
 *   输出: 58  (L=50, V=5, III=3)
 *
 * 示例 5:
 *   输入: "MCMXCIV"
 *   输出: 1994 (M=1000, CM=900, XC=90, IV=4)
 */
contract RomanToInteger {
    function toInt(string calldata _roman) external pure returns (uint256) {
        bytes memory b = bytes(_roman);
        uint256 n = b.length;
        int256 total = 0;

        for (uint256 i = 0; i < n; i++) {
            uint256 val = _charValue(b[i]);
            // 如果下一个字符更大，减去当前值；否则加上
            if (i + 1 < n && val < _charValue(b[i + 1])) {
                total -= int256(val);
            } else {
                total += int256(val);
            }
        }

        return uint256(total);
    }

    function _charValue(bytes1 c) internal pure returns (uint256) {
        if (c == "I") return 1;
        if (c == "V") return 5;
        if (c == "X") return 10;
        if (c == "L") return 50;
        if (c == "C") return 100;
        if (c == "D") return 500;
        if (c == "M") return 1000;
        revert("invalid roman character");
    }
}
