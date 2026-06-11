// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {IntegerToRoman} from "../src/IntegerToRoman.sol";

contract IntegerToRomanTest is Test {
    IntegerToRoman public roman;

    function setUp() public {
        roman = new IntegerToRoman();
    }

    // ========== 基础 1-10 ==========

    function test_toRoman_1() public view {
        assertEq(roman.toRoman(1), "I");
    }

    function test_toRoman_2() public view {
        assertEq(roman.toRoman(2), "II");
    }

    function test_toRoman_3() public view {
        assertEq(roman.toRoman(3), "III");
    }

    function test_toRoman_4() public view {
        assertEq(roman.toRoman(4), "IV");
    }

    function test_toRoman_5() public view {
        assertEq(roman.toRoman(5), "V");
    }

    function test_toRoman_6() public view {
        assertEq(roman.toRoman(6), "VI");
    }

    function test_toRoman_8() public view {
        assertEq(roman.toRoman(8), "VIII");
    }

    function test_toRoman_9() public view {
        assertEq(roman.toRoman(9), "IX");
    }

    function test_toRoman_10() public view {
        assertEq(roman.toRoman(10), "X");
    }

    // ========== 减法对 (subtractive pairs) ==========

    function test_toRoman_4_IV() public view {
        assertEq(roman.toRoman(4), "IV");
    }

    function test_toRoman_9_IX() public view {
        assertEq(roman.toRoman(9), "IX");
    }

    function test_toRoman_40_XL() public view {
        assertEq(roman.toRoman(40), "XL");
    }

    function test_toRoman_90_XC() public view {
        assertEq(roman.toRoman(90), "XC");
    }

    function test_toRoman_400_CD() public view {
        assertEq(roman.toRoman(400), "CD");
    }

    function test_toRoman_900_CM() public view {
        assertEq(roman.toRoman(900), "CM");
    }

    // ========== 基础符号 (7 种面额) ==========

    function test_toRoman_50_L() public view {
        assertEq(roman.toRoman(50), "L");
    }

    function test_toRoman_100_C() public view {
        assertEq(roman.toRoman(100), "C");
    }

    function test_toRoman_500_D() public view {
        assertEq(roman.toRoman(500), "D");
    }

    function test_toRoman_1000_M() public view {
        assertEq(roman.toRoman(1000), "M");
    }

    // ========== 重复三次边界 (每种符号最多重复 3 次) ==========

    function test_toRoman_30_XXX() public view {
        assertEq(roman.toRoman(30), "XXX");
    }

    function test_toRoman_300_CCC() public view {
        assertEq(roman.toRoman(300), "CCC");
    }

    function test_toRoman_3000_MMM() public view {
        assertEq(roman.toRoman(3000), "MMM");
    }

    // ========== 题目示例 ==========

    function test_toRoman_58() public view {
        // LVIII (L=50, V=5, III=3)
        assertEq(roman.toRoman(58), "LVIII");
    }

    function test_toRoman_1994() public view {
        // MCMXCIV (M=1000, CM=900, XC=90, IV=4)
        assertEq(roman.toRoman(1994), "MCMXCIV");
    }

    // ========== 边界值 ==========

    /// 最小值
    function test_toRoman_min_1() public view {
        assertEq(roman.toRoman(1), "I");
    }

    /// 最大值
    function test_toRoman_max_3999() public view {
        // MMMCMXCIX = 3000 + 900 + 90 + 9
        assertEq(roman.toRoman(3999), "MMMCMXCIX");
    }

    /// 超出下界
    function test_RevertWhen_Zero() public {
        vm.expectRevert("out of range");
        roman.toRoman(0);
    }

    /// 超出上界
    function test_RevertWhen_4000() public {
        vm.expectRevert("out of range");
        roman.toRoman(4000);
    }

    /// 远超上界
    function test_RevertWhen_LargeNumber() public {
        vm.expectRevert("out of range");
        roman.toRoman(99999);
    }

    // ========== 连续减法对（考验多个减法组合） ==========

    /// 444 = CD + XL + IV
    function test_toRoman_444() public view {
        assertEq(roman.toRoman(444), "CDXLIV");
    }

    /// 999 = CM + XC + IX
    function test_toRoman_999() public view {
        assertEq(roman.toRoman(999), "CMXCIX");
    }

    /// 1444 = M + CD + XL + IV
    function test_toRoman_1444() public view {
        assertEq(roman.toRoman(1444), "MCDXLIV");
    }

    /// 1999 = M + CM + XC + IX
    function test_toRoman_1999() public view {
        assertEq(roman.toRoman(1999), "MCMXCIX");
    }

    /// 2444 = MM + CD + XL + IV
    function test_toRoman_2444() public view {
        assertEq(roman.toRoman(2444), "MMCDXLIV");
    }

    /// 3444 = MMM + CD + XL + IV
    function test_toRoman_3444() public view {
        assertEq(roman.toRoman(3444), "MMMCDXLIV");
    }

    // ========== 特殊构造（跨位边界） ==========

    /// 14 = X + IV（个位减法）
    function test_toRoman_14() public view {
        assertEq(roman.toRoman(14), "XIV");
    }

    /// 19 = X + IX（个位减法）
    function test_toRoman_19() public view {
        assertEq(roman.toRoman(19), "XIX");
    }

    /// 140 = C + XL（十位减法）
    function test_toRoman_140() public view {
        assertEq(roman.toRoman(140), "CXL");
    }

    /// 190 = C + XC（十位减法）
    function test_toRoman_190() public view {
        assertEq(roman.toRoman(190), "CXC");
    }

    /// 490 = CD + XC（百位+十位连续减法）
    function test_toRoman_490() public view {
        assertEq(roman.toRoman(490), "CDXC");
    }

    /// 990 = CM + XC（百位+十位连续减法）
    function test_toRoman_990() public view {
        assertEq(roman.toRoman(990), "CMXC");
    }

    /// 399 = CCC + XC + IX
    function test_toRoman_399() public view {
        assertEq(roman.toRoman(399), "CCCXCIX");
    }

    /// 994 = CM + XC + IV
    function test_toRoman_994() public view {
        assertEq(roman.toRoman(994), "CMXCIV");
    }

    // ========== 所有用到的符号同时出现 ==========

    /// 1666 = M + D + C + L + X + V + I（7 种基础符号各出现一次）
    function test_toRoman_1666() public view {
        assertEq(roman.toRoman(1666), "MDCLXVI");
    }

    /// 1888 = M + DCCC + LXXX + VIII（最长纯加法表示）
    function test_toRoman_1888() public view {
        assertEq(roman.toRoman(1888), "MDCCCLXXXVIII");
    }

    /// 3888 = MMM + DCCC + LXXX + VIII（最大纯加法表示）
    function test_toRoman_3888() public view {
        assertEq(roman.toRoman(3888), "MMMDCCCLXXXVIII");
    }
}
