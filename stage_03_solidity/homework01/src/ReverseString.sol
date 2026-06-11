// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract ReverseString {
    // 反转一个字符串。输入 "abcde"，输出 "edcba"
    function reverse(string calldata _str) external pure returns (string memory) {
        bytes memory b = bytes(_str);
        uint256 n = b.length;
        for (uint256 i = 0; i < n / 2; i++) {
            bytes1 tmp = b[i];
            b[i] = b[n - 1 - i];
            b[n - 1 - i] = tmp;
        }
        return string(b);
    }
}
