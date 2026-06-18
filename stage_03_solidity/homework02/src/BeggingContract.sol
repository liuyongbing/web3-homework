// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

// forge install OpenZeppelin/openzeppelin-contracts --no-git
import "@openzeppelin/contracts/access/Ownable.sol";

contract BeggingContract is Ownable {
    uint256 public totalDonations;
    mapping(address => uint256) public donations;
    address[3] public topDonors;
    bool public closed;

    event Donation(address indexed from, uint256 value);
    event Closed();

    constructor() Ownable(msg.sender) {}

    function donate() external payable {
        require(msg.value > 0, "zero");
        require(!closed, "donations closed");

        donations[msg.sender] += msg.value;
        totalDonations += msg.value;

        _updateTopDonors(msg.sender);
        emit Donation(msg.sender, msg.value);
    }

    function withdraw() external onlyOwner {
        require(totalDonations > 0, "No balance to withdraw");
        uint256 amount = totalDonations;
        totalDonations = 0;
        closed = true;
        (bool success,) = payable(msg.sender).call{value: amount}("");
        require(success, "withdraw failed");
        emit Closed();
    }

    function getDonation(address addr) public view returns (uint256) {
        return donations[addr];
    }

    function getTopDonors() external view returns (address[3] memory, uint256[3] memory) {
        uint256[3] memory amounts;
        for (uint256 i = 0; i < 3; i++) {
            amounts[i] = donations[topDonors[i]];
        }
        return (topDonors, amounts);
    }

    function _updateTopDonors(address donor) internal {
        uint256 donorAmount = donations[donor];

        // 检查是否已在榜内
        for (uint256 i = 0; i < 3; i++) {
            if (topDonors[i] == donor) {
                _sortTopDonors();
                return;
            }
        }

        // 不在榜内，和第 3 名比较
        if (donorAmount > donations[topDonors[2]]) {
            topDonors[2] = donor;
            _sortTopDonors();
        }
    }

    function _sortTopDonors() internal {
        // 冒泡排序，只有 3 个元素，两轮确保完全有序
        for (uint256 i = 0; i < 2; i++) {
            for (uint256 j = 0; j < 2 - i; j++) {
                if (donations[topDonors[j]] < donations[topDonors[j + 1]]) {
                    (topDonors[j], topDonors[j + 1]) = (topDonors[j + 1], topDonors[j]);
                }
            }
        }
    }
}
