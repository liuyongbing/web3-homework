// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

/**
 * ### 1.  :white_check_mark: 创建一个名为Voting的合约，包含以下功能：
 * - 一个mapping来存储候选人的得票数
 * - 一个vote函数，允许用户投票给某个候选人
 * - 一个getVotes函数，返回某个候选人的得票数
 * - 一个resetVotes函数，重置所有候选人的得票数
 */
contract Voting {
    address public immutable OWNER;
    string[] candidates;
    mapping(string => uint256) public voteCount;

    constructor() {
        OWNER = msg.sender;
    }

    // 投票给某个候选人
    function vote(string calldata candidate) external {
        voteCount[candidate] += 1;
    }

    // 返回某个候选人的得票数
    function getVotes(string calldata candidate) external view returns (uint256) {
        return voteCount[candidate];
    }

    // 重置所有候选人的得票数
    function resetVotes() public onlyOwner {
        uint256 count = candidates.length;
        for (uint256 index = 0; index < count; index++) {
            voteCount[candidates[index]] = 0;
        }
    }

    // 添加候选人
    function addCandidate(string calldata candidate) public onlyOwner {
        candidates.push(candidate);
    }

    modifier onlyOwner() {
        require(msg.sender == OWNER, "Not owner");
        _;
    }
}
