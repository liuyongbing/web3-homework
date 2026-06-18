// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";

/// @title MyNFT —— 支持 ERC2981 版税的 NFT
/// @notice 每个 tokenId 可单独设置作者版税（接收人 + 版税率），供拍卖合约结算时查询。
contract MyNFT is ERC721, Ownable, ERC2981 {
    /// @dev 基点分母（10000 = 100%）
    uint256 public constant MAX_FEE_BP = 10000;

    uint256 private _nextTokenId;
    string private _baseTokenURI;

    event BaseURISet(string newUri);
    event TokenRoyaltySet(uint256 indexed tokenId, address indexed receiver, uint96 feeBp);

    error FeeTooHigh();

    constructor(string memory _name, string memory _symbol, string memory _uri)
        ERC721(_name, _symbol)
        Ownable(msg.sender)
    {
        _baseTokenURI = _uri;
    }

    /// @notice 普通铸造（无版税）
    /// @param to NFT 接收者
    /// @return tokenId 新铸造的 NFT 编号
    function mint(address to) public onlyOwner returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _mint(to, tokenId);
    }

    /// @notice 铸造并设置作者版税
    /// @param to NFT 接收者
    /// @param royaltyReceiver 版税接收人（作者，可与 to 不同）
    /// @param feeBp 版税率（基点，<= 10000）
    /// @return tokenId 新铸造的 NFT 编号
    function mintWithRoyalty(address to, address royaltyReceiver, uint96 feeBp)
        external
        onlyOwner
        returns (uint256 tokenId)
    {
        if (feeBp > MAX_FEE_BP) revert FeeTooHigh();
        tokenId = mint(to);
        _setTokenRoyalty(tokenId, royaltyReceiver, feeBp);
        emit TokenRoyaltySet(tokenId, royaltyReceiver, feeBp);
    }

    /// @notice 设置某 tokenId 的版税（仅 owner）
    /// @dev F8：校验 tokenId 已铸造（_requireOwned），拒绝为不存在/未铸造的 tokenId 设版税产生脏数据。
    function setTokenRoyalty(uint256 tokenId, address receiver, uint96 feeBp) external onlyOwner {
        _requireOwned(tokenId); // F8：tokenId 必须已存在，否则 revert ERC721NonexistentToken
        if (feeBp > MAX_FEE_BP) revert FeeTooHigh();
        _setTokenRoyalty(tokenId, receiver, feeBp);
        emit TokenRoyaltySet(tokenId, receiver, feeBp);
    }

    /// @notice 已铸造总量
    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }

    /// @dev OZ 的 tokenURI 会调用它，拼成 baseURI + tokenId
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    /// @notice 更新 baseURI（仅 owner）
    function setBaseURI(string memory _uri) external onlyOwner {
        _baseTokenURI = _uri;
        emit BaseURISet(_uri);
    }

    /// @dev 合并 ERC721 + ERC2981 的 supportsInterface（菱形继承必须显式合并）
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
