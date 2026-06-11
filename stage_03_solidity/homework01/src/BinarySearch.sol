// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

/**
 * ### 6. :white_check_mark:  二分查找 (Binary Search)
 * - 题目描述：在一个有序数组中查找目标值。
 *
 * 算法：经典二分查找
 *   - 维护 [left, right] 搜索区间
 *   - 每次取 mid = (left + right) / 2
 *   - 目标等于 a[mid] → 返回索引
 *   - 目标 < a[mid] → 搜索左半 [left, mid-1]
 *   - 目标 > a[mid] → 搜索右半 [mid+1, right]
 *   - 时间复杂度 O(log n)
 *
 * 返回值：
 *   - 找到：返回目标元素的索引 (>= 0)
 *   - 未找到：返回 -1
 */
contract BinarySearch {
    /// 未找到的哨兵值
    int256 public constant NOT_FOUND = -1;

    function search(int256[] calldata a, int256 target) external pure returns (int256) {
        if (a.length == 0) {
            return NOT_FOUND;
        }

        uint256 left;
        uint256 right = a.length - 1;

        while (left <= right) {
            uint256 mid = left + (right - left) / 2;

            if (a[mid] == target) {
                return int256(mid);
            } else if (a[mid] < target) {
                left = mid + 1;
            } else {
                if (mid == 0) break;
                right = mid - 1;
            }
        }

        return NOT_FOUND;
    }
}
