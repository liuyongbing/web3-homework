// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {MergeSortedArray} from "../src/MergeSortedArray.sol";

contract MergeSortedArrayTest is Test {
    MergeSortedArray public m;

    function setUp() public {
        m = new MergeSortedArray();
    }

    // ========== 边界：空数组 ==========

    /// 两个空数组合并
    function test_merge_bothEmpty() public view {
        int256[] memory a = new int256[](0);
        int256[] memory b = new int256[](0);
        int256[] memory c = new int256[](0);
        assertEq(m.merge(a, b), c);
    }

    /// a 为空，b 非空
    function test_merge_aEmpty() public view {
        int256[] memory a = new int256[](0);
        int256[] memory b = new int256[](3);
        b[0] = 1;
        b[1] = 2;
        b[2] = 3;

        int256[] memory c = new int256[](3);
        c[0] = 1;
        c[1] = 2;
        c[2] = 3;

        assertEq(m.merge(a, b), c);
    }

    /// b 为空，a 非空
    function test_merge_bEmpty() public view {
        int256[] memory a = new int256[](3);
        a[0] = 1;
        a[1] = 2;
        a[2] = 3;

        int256[] memory b = new int256[](0);

        int256[] memory c = new int256[](3);
        c[0] = 1;
        c[1] = 2;
        c[2] = 3;

        assertEq(m.merge(a, b), c);
    }

    // ========== 边界：单元素 ==========

    /// 两个单元素数组
    function test_merge_bothSingleElement() public view {
        int256[] memory a = new int256[](1);
        a[0] = 1;
        int256[] memory b = new int256[](1);
        b[0] = 2;

        int256[] memory c = new int256[](2);
        c[0] = 1;
        c[1] = 2;

        assertEq(m.merge(a, b), c);
    }

    /// 单元素 + 空
    function test_merge_singleAndEmpty() public view {
        int256[] memory a = new int256[](1);
        a[0] = 5;
        int256[] memory b = new int256[](0);

        int256[] memory c = new int256[](1);
        c[0] = 5;

        assertEq(m.merge(a, b), c);
    }

    // ========== 边界：相同元素 ==========

    /// 两个单元素相同
    function test_merge_equalSingle() public view {
        int256[] memory a = new int256[](1);
        a[0] = 3;
        int256[] memory b = new int256[](1);
        b[0] = 3;

        int256[] memory c = new int256[](2);
        c[0] = 3;
        c[1] = 3;

        assertEq(m.merge(a, b), c);
    }

    /// 全部相同元素
    function test_merge_allSame() public view {
        int256[] memory a = new int256[](3);
        a[0] = 2;
        a[1] = 2;
        a[2] = 2;

        int256[] memory b = new int256[](3);
        b[0] = 2;
        b[1] = 2;
        b[2] = 2;

        int256[] memory c = new int256[](6);
        c[0] = 2;
        c[1] = 2;
        c[2] = 2;
        c[3] = 2;
        c[4] = 2;
        c[5] = 2;

        assertEq(m.merge(a, b), c);
    }

    // ========== 基本交错合并 ==========

    /// a 全部小于 b（不交错）
    function test_merge_noOverlap_aFirst() public view {
        int256[] memory a = new int256[](2);
        a[0] = 1;
        a[1] = 2;

        int256[] memory b = new int256[](2);
        b[0] = 3;
        b[1] = 4;

        int256[] memory c = new int256[](4);
        c[0] = 1;
        c[1] = 2;
        c[2] = 3;
        c[3] = 4;

        assertEq(m.merge(a, b), c);
    }

    /// b 全部小于 a（不交错）
    function test_merge_noOverlap_bFirst() public view {
        int256[] memory a = new int256[](2);
        a[0] = 3;
        a[1] = 4;

        int256[] memory b = new int256[](2);
        b[0] = 1;
        b[1] = 2;

        int256[] memory c = new int256[](4);
        c[0] = 1;
        c[1] = 2;
        c[2] = 3;
        c[3] = 4;

        assertEq(m.merge(a, b), c);
    }

    /// 完全交错
    function test_merge_interleaved() public view {
        int256[] memory a = new int256[](2);
        a[0] = 1;
        a[1] = 3;

        int256[] memory b = new int256[](2);
        b[0] = 2;
        b[1] = 4;

        int256[] memory c = new int256[](4);
        c[0] = 1;
        c[1] = 2;
        c[2] = 3;
        c[3] = 4;

        assertEq(m.merge(a, b), c);
    }

    // ========== 不等长数组 ==========

    /// a 比 b 长很多
    function test_merge_aMuchLonger() public view {
        int256[] memory a = new int256[](4);
        a[0] = 1;
        a[1] = 2;
        a[2] = 5;
        a[3] = 6;

        int256[] memory b = new int256[](1);
        b[0] = 3;

        int256[] memory c = new int256[](5);
        c[0] = 1;
        c[1] = 2;
        c[2] = 3;
        c[3] = 5;
        c[4] = 6;

        assertEq(m.merge(a, b), c);
    }

    /// b 比 a 长很多
    function test_merge_bMuchLonger() public view {
        int256[] memory a = new int256[](1);
        a[0] = 3;

        int256[] memory b = new int256[](4);
        b[0] = 1;
        b[1] = 2;
        b[2] = 5;
        b[3] = 6;

        int256[] memory c = new int256[](5);
        c[0] = 1;
        c[1] = 2;
        c[2] = 3;
        c[3] = 5;
        c[4] = 6;

        assertEq(m.merge(a, b), c);
    }

    // ========== 负数 ==========

    /// 含负数的合并
    function test_merge_withNegatives() public view {
        int256[] memory a = new int256[](3);
        a[0] = -5;
        a[1] = -1;
        a[2] = 3;

        int256[] memory b = new int256[](3);
        b[0] = -3;
        b[1] = 0;
        b[2] = 4;

        int256[] memory c = new int256[](6);
        c[0] = -5;
        c[1] = -3;
        c[2] = -1;
        c[3] = 0;
        c[4] = 3;
        c[5] = 4;

        assertEq(m.merge(a, b), c);
    }

    /// 全是负数
    function test_merge_allNegatives() public view {
        int256[] memory a = new int256[](3);
        a[0] = -10;
        a[1] = -5;
        a[2] = -1;

        int256[] memory b = new int256[](3);
        b[0] = -8;
        b[1] = -3;
        b[2] = -2;

        int256[] memory c = new int256[](6);
        c[0] = -10;
        c[1] = -8;
        c[2] = -5;
        c[3] = -3;
        c[4] = -2;
        c[5] = -1;

        assertEq(m.merge(a, b), c);
    }

    // ========== 边界：大数 ==========

    /// 含 int256 大数
    function test_merge_largeNumbers() public view {
        int256[] memory a = new int256[](2);
        a[0] = type(int256).min;
        a[1] = 0;

        int256[] memory b = new int256[](2);
        b[0] = -1;
        b[1] = type(int256).max;

        int256[] memory c = new int256[](4);
        c[0] = type(int256).min;
        c[1] = -1;
        c[2] = 0;
        c[3] = type(int256).max;

        assertEq(m.merge(a, b), c);
    }

    // ========== 题目经典用例 ==========

    /// 较长数组交错合并
    function test_merge_longerArrays() public view {
        int256[] memory a = new int256[](5);
        a[0] = 1;
        a[1] = 3;
        a[2] = 5;
        a[3] = 7;
        a[4] = 9;

        int256[] memory b = new int256[](5);
        b[0] = 2;
        b[1] = 4;
        b[2] = 6;
        b[3] = 8;
        b[4] = 10;

        int256[] memory c = new int256[](10);
        c[0] = 1;
        c[1] = 2;
        c[2] = 3;
        c[3] = 4;
        c[4] = 5;
        c[5] = 6;
        c[6] = 7;
        c[7] = 8;
        c[8] = 9;
        c[9] = 10;

        assertEq(m.merge(a, b), c);
    }
}
