// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/NFTAuction.sol";
import "../contracts/NFTAuctionV2.sol";
import "../contracts/MyNFT.sol";
import "../contracts/mocks/MockPriceFeed.sol";
import "../contracts/mocks/MockERC20.sol";
import "../contracts/mocks/ERC1967Proxy.sol";

/// @dev Gas benchmark（仅 forge 用，hardhat 测试套件忽略 .t.sol）。
///      对比 V1（默认实时读 feed decimals）与 V2（initializeV2 缓存 decimals）出价路径的 gas，
///      为 #1 优化（缓存 feed decimals）提供硬数据。
contract GasBench is Test {
    MockPriceFeed ethFeed;
    MockPriceFeed tokenFeed;
    MockERC20 token;
    MyNFT nft;

    address seller = address(0xA11CE);
    address bidder1 = address(0xB0B1);
    address bidder2 = address(0xB0B2);

    function setUp() public {
        ethFeed = new MockPriceFeed(8, 2000_00000000); // 2000 USD, 8 dec
        tokenFeed = new MockPriceFeed(8, 1_00000000); // 1 USD, 8 dec
        token = new MockERC20("U", "U", 6);
        nft = new MyNFT("N", "N", "uri");

        nft.mint(seller); // tokenId 0
        nft.mint(seller); // tokenId 1
        token.mint(bidder1, 1_000_000e6);
        token.mint(bidder2, 1_000_000e6);
        vm.deal(bidder1, 100 ether);
        vm.deal(bidder2, 100 ether);
    }

    function _newAuction(NFTAuction a, uint256 tokenId) internal returns (uint256 id) {
        vm.startPrank(seller);
        nft.approve(address(a), tokenId);
        id = a.createAuction(address(nft), tokenId, 1); // 1 小时
        vm.stopPrank();
    }

    function _newV1() internal returns (NFTAuction) {
        NFTAuction impl = new NFTAuction();
        bytes memory data = abi.encodeCall(
            NFTAuction.initialize,
            (address(ethFeed), address(token), address(tokenFeed), uint8(6))
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), data);
        return NFTAuction(payable(address(proxy)));
    }

    function _newV2() internal returns (NFTAuctionV2) {
        NFTAuctionV2 impl = new NFTAuctionV2();
        bytes memory data = abi.encodeCall(
            NFTAuction.initialize,
            (address(ethFeed), address(token), address(tokenFeed), uint8(6))
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), data);
        NFTAuctionV2 a = NFTAuctionV2(payable(address(proxy)));
        a.initializeV2(300); // 设平台费 + 缓存 feed decimals
        return a;
    }

    /// warm external call `decimals()` 的边际成本（bid 内 feed 已被 latestRoundData 预热）
    function test_decimalsWarmCost() public view {
        ethFeed.decimals(); // 预热
        uint256 g = gasleft();
        uint8 d = ethFeed.decimals();
        console.log("=== decimals() warm external call ===");
        console.log("gas:", g - gasleft());
        console.log("decimals:", d);
    }

    function test_bidWithEth_V1() public {
        NFTAuction a = _newV1();
        uint256 id = _newAuction(a, 0);
        vm.prank(bidder1);
        uint256 g = gasleft();
        a.bidWithEth{value: 1 ether}(id);
        console.log("=== bidWithEth V1 (decimals live) ===");
        console.log("gas:", g - gasleft());
    }

    function test_bidWithEth_V2() public {
        NFTAuctionV2 a = _newV2();
        uint256 id = _newAuction(NFTAuction(payable(address(a))), 0);
        vm.prank(bidder1);
        uint256 g = gasleft();
        a.bidWithEth{value: 1 ether}(id);
        console.log("=== bidWithEth V2 (decimals cached) ===");
        console.log("gas:", g - gasleft());
    }

    function test_bidWithErc20_V1() public {
        NFTAuction a = _newV1();
        uint256 id = _newAuction(a, 0);
        vm.startPrank(bidder1);
        token.approve(address(a), 1000e6);
        uint256 g = gasleft();
        a.bidWithErc20(id, 1000e6);
        console.log("=== bidWithErc20 V1 (decimals live x2) ===");
        console.log("gas:", g - gasleft());
        vm.stopPrank();
    }

    function test_bidWithErc20_V2() public {
        NFTAuctionV2 a = _newV2();
        uint256 id = _newAuction(NFTAuction(payable(address(a))), 0);
        vm.startPrank(bidder1);
        token.approve(address(a), 1000e6);
        uint256 g = gasleft();
        a.bidWithErc20(id, 1000e6);
        console.log("=== bidWithErc20 V2 (decimals cached) ===");
        console.log("gas:", g - gasleft());
        vm.stopPrank();
    }
}
