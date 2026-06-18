// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @dev 测试用：royaltyInfo 为「死循环」（view：读 storage + 累加，持续耗 gas），模拟恶意/异常 NFT
///      的 royaltyInfo 消耗海量 gas。用于验证 V3 用 {gas: ROYALTY_GAS_CAP} 限制子调用后，
///      endAuction 不会因 OOG 卡死，而是 catch 回退不计版税。
///      注：royaltyInfo 必须为 view（与 IERC2981 一致），故用 SLOAD 累加而非 SWRITE 消耗 gas。
contract GasGuzzlerRoyaltyNFT is ERC721, IERC2981 {
    uint256 private _next;

    constructor() ERC721("GasGuzzler", "GG") {}

    function mint(address to) external returns (uint256 id) {
        id = _next++;
        _mint(to, id);
    }

    /// @inheritdoc IERC2981
    function royaltyInfo(uint256, uint256) external view override returns (address, uint256) {
        // 死循环：每轮 SLOAD(_next) + ADD + JUMP 耗 gas，耗尽 {gas: ROYALTY_GAS_CAP} → revert → V3 catch。
        uint256 acc = 0;
        while (true) {
            acc += _next;
        }
        return (address(uint160(acc)), 0); // 不可达（acc 被引用，防编译器消除循环）
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, IERC165) returns (bool) {
        return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
    }
}
