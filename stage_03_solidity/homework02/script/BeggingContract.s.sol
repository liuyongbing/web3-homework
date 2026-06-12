// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {BeggingContract} from "../src/BeggingContract.sol";

contract BeggingContractScript is Script {
    BeggingContract public c;

    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        c = new BeggingContract();
        console.log("BeggingContract deployed at:", address(c));

        vm.stopBroadcast();
    }
}
