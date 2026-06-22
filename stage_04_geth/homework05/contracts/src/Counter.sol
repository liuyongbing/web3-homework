// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract Counter {
    uint256 public number;

    event NumberUpdated(address indexed caller, uint256 oldValue, uint256 newValue);

    function setNumber(uint256 newNumber) public {
        uint256 old = number;
        number = newNumber;
        emit NumberUpdated(msg.sender, old, newNumber);
    }

    function increment() public {
        uint256 old = number;
        number++;
        emit NumberUpdated(msg.sender, old, number);
    }
}
