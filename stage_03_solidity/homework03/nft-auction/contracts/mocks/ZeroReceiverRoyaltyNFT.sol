// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @dev 测试用：支持 ERC2981 接口但 royaltyInfo 故意返回 receiver = address(0)。
///      用于触发 NFTAuctionV3 的「版税 receiver 为 0 地址 → 强制不计版税」分支。
///      （OZ 的 ERC2981 在 5.x 会拒绝 receiver=0，故绕开它自己实现 royaltyInfo。）
contract ZeroReceiverRoyaltyNFT is ERC721, IERC2981 {
    uint256 public nextId;

    constructor() ERC721("ZeroReceiver", "ZR") {}

    function mint(address to) external returns (uint256 id) {
        id = nextId++;
        _mint(to, id);
    }

    /// @inheritdoc IERC2981
    function royaltyInfo(uint256, uint256 salePrice) external pure override returns (address, uint256) {
        // 故意返回 receiver = address(0)，5% 版税
        return (address(0), (salePrice * 500) / 10000);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, IERC165) returns (bool) {
        return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
    }
}
