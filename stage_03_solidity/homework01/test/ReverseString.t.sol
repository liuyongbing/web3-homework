// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {ReverseString} from "../src/ReverseString.sol";

contract ReverseStringTest is Test {
    ReverseString public reverter;

    function setUp() public {
        reverter = new ReverseString();
    }

    function test_reverse() public view {
        assertEq(reverter.reverse("abcde"), "edcba");
    }

    function test_reverseWithEmptyStr() public view {
        assertEq(reverter.reverse(""), "");
    }

    function test_reverseWithSignalStr() public view {
        assertEq(reverter.reverse("T"), "T");
    }

    function test_reverseWithSameStr() public view {
        assertEq(reverter.reverse("aaaaa"), "aaaaa");
    }

    function test_reverseWithNumberStr() public view {
        assertEq(reverter.reverse("1234567890"), "0987654321");
    }
}
