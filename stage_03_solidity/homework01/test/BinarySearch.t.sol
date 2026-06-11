// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {BinarySearch} from "../src/BinarySearch.sol";

contract BinarySearchTest is Test {
    BinarySearch public bs;

    function setUp() public {
        bs = new BinarySearch();
    }

    // ===== 辅助函数：快速构造 int256 数组 =====

    function _a() internal pure returns (int256[] memory) {
        return new int256[](0);
    }

    function _a(int256 e0) internal pure returns (int256[] memory) {
        int256[] memory arr = new int256[](1);
        arr[0] = e0;
        return arr;
    }

    function _a(int256 e0, int256 e1) internal pure returns (int256[] memory) {
        int256[] memory arr = new int256[](2);
        arr[0] = e0;
        arr[1] = e1;
        return arr;
    }

    function _a(int256 e0, int256 e1, int256 e2) internal pure returns (int256[] memory) {
        int256[] memory arr = new int256[](3);
        arr[0] = e0;
        arr[1] = e1;
        arr[2] = e2;
        return arr;
    }

    function _a(int256 e0, int256 e1, int256 e2, int256 e3) internal pure returns (int256[] memory) {
        int256[] memory arr = new int256[](4);
        arr[0] = e0;
        arr[1] = e1;
        arr[2] = e2;
        arr[3] = e3;
        return arr;
    }

    function _a(int256 e0, int256 e1, int256 e2, int256 e3, int256 e4) internal pure returns (int256[] memory) {
        int256[] memory arr = new int256[](5);
        arr[0] = e0;
        arr[1] = e1;
        arr[2] = e2;
        arr[3] = e3;
        arr[4] = e4;
        return arr;
    }

    function _a(int256 e0, int256 e1, int256 e2, int256 e3, int256 e4, int256 e5, int256 e6)
        internal
        pure
        returns (int256[] memory)
    {
        int256[] memory arr = new int256[](7);
        arr[0] = e0;
        arr[1] = e1;
        arr[2] = e2;
        arr[3] = e3;
        arr[4] = e4;
        arr[5] = e5;
        arr[6] = e6;
        return arr;
    }

    // ========== 边界：空数组 ==========

    function test_search_emptyArray() public view {
        assertEq(bs.search(_a(), 1), -1);
    }

    // ========== 边界：单元素 ==========

    function test_search_singleElement_found() public view {
        assertEq(bs.search(_a(5), 5), 0);
    }

    function test_search_singleElement_notFound_greater() public view {
        assertEq(bs.search(_a(5), 10), -1);
    }

    function test_search_singleElement_notFound_less() public view {
        assertEq(bs.search(_a(5), 1), -1);
    }

    // ========== 边界：两个元素 ==========

    function test_search_twoElements_foundFirst() public view {
        assertEq(bs.search(_a(1, 3), 1), 0);
    }

    function test_search_twoElements_foundSecond() public view {
        assertEq(bs.search(_a(1, 3), 3), 1);
    }

    function test_search_twoElements_notFound_between() public view {
        assertEq(bs.search(_a(1, 3), 2), -1);
    }

    // ========== 基本查找：验证索引位置 ==========

    function test_search_foundAtStart() public view {
        assertEq(bs.search(_a(1, 3, 5, 7, 9), 1), 0);
    }

    function test_search_foundAtEnd() public view {
        assertEq(bs.search(_a(1, 3, 5, 7, 9), 9), 4);
    }

    function test_search_foundAtMid() public view {
        assertEq(bs.search(_a(1, 3, 5, 7, 9), 5), 2);
    }

    function test_search_foundAtMidOffByOne() public view {
        assertEq(bs.search(_a(1, 3, 5, 7, 9), 3), 1);
        assertEq(bs.search(_a(1, 3, 5, 7, 9), 7), 3);
    }

    function test_search_notFound_lessThanAll() public view {
        assertEq(bs.search(_a(1, 3, 5, 7, 9), 0), -1);
    }

    function test_search_notFound_greaterThanAll() public view {
        assertEq(bs.search(_a(1, 3, 5, 7, 9), 10), -1);
    }

    function test_search_notFound_betweenElements() public view {
        assertEq(bs.search(_a(1, 3, 5, 7, 9), 4), -1);
        assertEq(bs.search(_a(1, 3, 5, 7, 9), 6), -1);
        assertEq(bs.search(_a(1, 3, 5, 7, 9), 8), -1);
    }

    // ========== 负数 ==========

    function test_search_withNegatives_found() public view {
        assertEq(bs.search(_a(-10, -5, 0, 5, 10), -5), 1);
    }

    function test_search_withNegatives_notFound() public view {
        assertEq(bs.search(_a(-10, -5, 0, 5, 10), -3), -1);
    }

    function test_search_allNegatives_found() public view {
        assertEq(bs.search(_a(-100, -50, -10, -1), -50), 1);
    }

    function test_search_allNegatives_notFound() public view {
        assertEq(bs.search(_a(-100, -50, -10, -1), -25), -1);
    }

    // ========== 重复元素（返回任意一个匹配索引） ==========

    function test_search_duplicates_found() public view {
        int256 idx = bs.search(_a(1, 2, 2, 2, 3), 2);
        assertGe(idx, 1);
        assertLe(idx, 3);
    }

    function test_search_allSame_found() public view {
        int256 idx = bs.search(_a(7, 7, 7, 7), 7);
        assertGe(idx, 0);
        assertLe(idx, 3);
    }

    function test_search_allSame_notFound() public view {
        assertEq(bs.search(_a(7, 7, 7, 7), 8), -1);
    }

    // ========== 大数边界 ==========

    function test_search_int256Min() public view {
        assertEq(bs.search(_a(type(int256).min, 0, type(int256).max), type(int256).min), 0);
    }

    function test_search_int256Max() public view {
        assertEq(bs.search(_a(type(int256).min, 0, type(int256).max), type(int256).max), 2);
    }

    function test_search_int256Range_notFound() public view {
        assertEq(bs.search(_a(type(int256).min, type(int256).max), 0), -1);
    }

    // ========== 较长数组（验证二分逻辑） ==========

    function test_search_longArray_found() public view {
        int256[] memory a = new int256[](100);
        for (uint256 i = 0; i < 100; i++) {
            a[i] = int256(i + 1);
        }
        assertEq(bs.search(a, 1), 0);
        assertEq(bs.search(a, 50), 49);
        assertEq(bs.search(a, 100), 99);
    }

    function test_search_longArray_notFound() public view {
        int256[] memory a = new int256[](100);
        for (uint256 i = 0; i < 100; i++) {
            a[i] = int256(i + 1);
        }
        assertEq(bs.search(a, 0), -1);
        assertEq(bs.search(a, 101), -1);
    }

    function test_search_longArray_oddLength() public view {
        assertEq(bs.search(_a(1, 3, 5, 7, 9, 11, 13), 7), 3);
        assertEq(bs.search(_a(1, 3, 5, 7, 9, 11, 13), 1), 0);
        assertEq(bs.search(_a(1, 3, 5, 7, 9, 11, 13), 13), 6);
        assertEq(bs.search(_a(1, 3, 5, 7, 9, 11, 13), 6), -1);
    }
}
