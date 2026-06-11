// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

/**
 * ### 5. :white_check_mark:  合并两个有序数组 (Merge Sorted Array)
 * - 题目描述：将两个有序数组合并为一个有序数组。
 *
 * 算法：双指针
 *   - 两个指针 i, j 分别指向 a, b 的头部
 *   - 每次取较小的放入结果，对应指针后移
 *   - 一个数组耗尽后，将另一个数组剩余部分直接追加
 *   - 时间复杂度 O(n+m)
 */
contract MergeSortedArray {
    function merge(int256[] calldata a, int256[] calldata b) external pure returns (int256[] memory) {
        uint256 lenA = a.length;
        uint256 lenB = b.length;
        int256[] memory sorted = new int256[](lenA + lenB);

        uint256 i;
        uint256 j;
        uint256 k;

        // 双指针：每次取较小值放入结果
        while (i < lenA && j < lenB) {
            if (a[i] <= b[j]) {
                sorted[k++] = a[i++];
            } else {
                sorted[k++] = b[j++];
            }
        }

        // a 有剩余
        while (i < lenA) {
            sorted[k++] = a[i++];
        }

        // b 有剩余
        while (j < lenB) {
            sorted[k++] = b[j++];
        }

        return sorted;
    }
}
