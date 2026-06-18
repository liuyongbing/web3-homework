// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @dev 测试用：普通 ERC721，故意不实现 ERC2981，用于触发 NFTAuctionV3 的 catch 分支
///      （V3 调 royaltyInfo() 会 revert，进入 catch 不收版税）
contract NonERC2981NFT is ERC721 {
    uint256 private _next;

    constructor() ERC721("NoRoyalty", "NR") {}

    function mint(address to) external returns (uint256 id) {
        id = _next++;
        _mint(to, id);
    }
}
