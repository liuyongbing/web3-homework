// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {RomanToInteger} from "../src/RomanToInteger.sol";

contract RomanToIntegerTest is Test {
    RomanToInteger public roman;

    function setUp() public {
        roman = new RomanToInteger();
    }

    function test_toInt_I() public view {
        assertEq(roman.toInt("I"), 1);
    }

    function test_toInt_II() public view {
        assertEq(roman.toInt("II"), 2);
    }

    function test_toInt_III() public view {
        assertEq(roman.toInt("III"), 3);
    }

    function test_toInt_IV() public view {
        assertEq(roman.toInt("IV"), 4);
    }

    function test_toInt_V() public view {
        assertEq(roman.toInt("V"), 5);
    }

    function test_toInt_VI() public view {
        assertEq(roman.toInt("VI"), 6);
    }

    function test_toInt_IX() public view {
        assertEq(roman.toInt("IX"), 9);
    }

    function test_toInt_X() public view {
        assertEq(roman.toInt("X"), 10);
    }

    function test_toInt_XI() public view {
        assertEq(roman.toInt("XI"), 11);
    }

    function test_toInt_XIV() public view {
        assertEq(roman.toInt("XIV"), 14);
    }

    function test_toInt_XV() public view {
        assertEq(roman.toInt("XV"), 15);
    }

    function test_toInt_XVI() public view {
        assertEq(roman.toInt("XVI"), 16);
    }

    function test_toInt_XIX() public view {
        assertEq(roman.toInt("XIX"), 19);
    }

    function test_toInt_XX() public view {
        assertEq(roman.toInt("XX"), 20);
    }

    function test_toInt_XXI() public view {
        assertEq(roman.toInt("XXI"), 21);
    }

    function test_toInt_L() public view {
        assertEq(roman.toInt("L"), 50);
    }

    function test_toInt_C() public view {
        assertEq(roman.toInt("C"), 100);
    }

    function test_toInt_D() public view {
        assertEq(roman.toInt("D"), 500);
    }

    function test_toInt_M() public view {
        assertEq(roman.toInt("M"), 1000);
    }

    function test_toInt_LVIII() public view {
        assertEq(roman.toInt("LVIII"), 58);
    }

    function test_toInt_MCMXCIV() public view {
        assertEq(roman.toInt("MCMXCIV"), 1994);
    }

    // --- 减法对 (subtractive pairs) ---

    function test_toInt_XL() public view {
        assertEq(roman.toInt("XL"), 40);
    }

    function test_toInt_XC() public view {
        assertEq(roman.toInt("XC"), 90);
    }

    function test_toInt_CD() public view {
        assertEq(roman.toInt("CD"), 400);
    }

    function test_toInt_CM() public view {
        assertEq(roman.toInt("CM"), 900);
    }

    // --- 边界值 ---

    function test_toInt_maxValue() public view {
        assertEq(roman.toInt("MMMCMXCIX"), 3999);
    }

    function test_toInt_allSymbols() public view {
        assertEq(roman.toInt("MDCLXVI"), 1666);
    }

    function test_toInt_MMM() public view {
        assertEq(roman.toInt("MMM"), 3000);
    }

    function test_toInt_CCC() public view {
        assertEq(roman.toInt("CCC"), 300);
    }

    function test_toInt_XXX() public view {
        assertEq(roman.toInt("XXX"), 30);
    }

    // --- 连续减法对 ---

    function test_toInt_CDXLIV() public view {
        assertEq(roman.toInt("CDXLIV"), 444);
    }

    function test_toInt_CMXCIX() public view {
        assertEq(roman.toInt("CMXCIX"), 999);
    }

    function test_toInt_MMXXIV() public view {
        assertEq(roman.toInt("MMXXIV"), 2024);
    }

    function test_toInt_CDXC() public view {
        assertEq(roman.toInt("CDXC"), 490);
    }

    // --- 非法字符 ---

    function test_RevertWhen_InvalidChar() public {
        vm.expectRevert("invalid roman character");
        roman.toInt("ABC");
    }

    function test_RevertWhen_Lowercase() public {
        vm.expectRevert("invalid roman character");
        roman.toInt("iii");
    }

    function test_RevertWhen_Digit() public {
        vm.expectRevert("invalid roman character");
        roman.toInt("X1");
    }

    function test_RevertWhen_SpecialChar() public {
        vm.expectRevert("invalid roman character");
        roman.toInt("I V");
    }
}
