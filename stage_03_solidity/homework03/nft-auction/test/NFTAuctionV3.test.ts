// NFTAuctionV3 测试：ERC2981 版税 + F3 royaltyInfo gas cap + 极端费率/receiver=0/NonERC2981
// 吸收自原 NFTAuctionV3 / RoyaltyGasCap 测试 + Coverage 的 V3 子集。
import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { parseEther } from "viem";
import type { Address, TestClient } from "viem";
import type { ContractReturnType } from "@nomicfoundation/hardhat-viem/types";
import {
  deployV3,
  field,
  getClients,
  getWallets,
  viem,
  type AuctionV3,
  type MockErc20,
  type MyNft,
  type TestWallet,
} from "./helpers";

type NonErc2981Nft = ContractReturnType<"NonERC2981NFT">;
type ZeroReceiverRoyaltyNft = ContractReturnType<"ZeroReceiverRoyaltyNFT">;
type GasGuzzlerRoyaltyNft = ContractReturnType<"GasGuzzlerRoyaltyNFT">;

describe("NFTAuctionV3 ERC2981 版税", () => {
  let owner!: TestWallet, seller!: TestWallet, bidder1!: TestWallet, bidder2!: TestWallet, author!: TestWallet;
  let testClient!: TestClient;

  before(async () => {
    ({ owner, seller, bidder1, bidder2, author } = await getWallets());
    ({ testClient } = await getClients());
  });

  // ═══════════ ERC2981 版税 + 结算 ═══════════

  it("version 返回 v3", async () => {
    const { auctionV3 } = await deployV3(300n);
    assert.equal(await auctionV3.read.version(), "v3");
  });

  it("ROYALTY_CAP_BP 常量 = 1000（10%）", async () => {
    const { auctionV3 } = await deployV3(300n);
    assert.equal(await auctionV3.read.ROYALTY_CAP_BP(), 1000n);
  });

  it("ETH 结算：平台费给 owner + 版税给 author + 剩余给 seller（三方 pendingEth 记账）", async () => {
    const { auctionV3, nft } = await deployV3(300n);
    await nft.write.mint([seller.account.address], { account: owner.account }); // #0
    await nft.write.setTokenRoyalty([0n, author.account.address, 500n], { account: owner.account }); // 5%
    await nft.write.approve([auctionV3.address, 0n], { account: seller.account });
    await auctionV3.write.createAuction([nft.address, 0n, 1n], { account: seller.account });
    await auctionV3.write.bidWithEth([1n], { account: bidder1.account, value: parseEther("1") });

    await testClient.increaseTime({ seconds: 3600 });
    await testClient.mine({ blocks: 1 });
    await auctionV3.write.endAuction([1n], { account: bidder2.account });

    assert.equal(await auctionV3.read.pendingEth([owner.account.address]), parseEther("0.03"));
    assert.equal(await auctionV3.read.pendingEth([author.account.address]), parseEther("0.05"));
    assert.equal(await auctionV3.read.pendingEth([seller.account.address]), parseEther("0.92"));
    await auctionV3.write.claimNft([1n], { account: bidder1.account });
    assert.equal((await nft.read.ownerOf([0n])).toLowerCase(), bidder1.account.address.toLowerCase());
  });

  it("版税上限：作者设 100%（10000bp），V3 cap 到 10%（1000bp），不卡死", async () => {
    const { auctionV3, nft } = await deployV3(0n);
    await nft.write.mint([seller.account.address], { account: owner.account });
    await nft.write.setTokenRoyalty([0n, author.account.address, 10000n], { account: owner.account });
    await nft.write.approve([auctionV3.address, 0n], { account: seller.account });
    await auctionV3.write.createAuction([nft.address, 0n, 1n], { account: seller.account });
    await auctionV3.write.bidWithEth([1n], { account: bidder1.account, value: parseEther("1") });

    await testClient.increaseTime({ seconds: 3600 });
    await testClient.mine({ blocks: 1 });
    await auctionV3.write.endAuction([1n], { account: bidder2.account });

    assert.equal(await auctionV3.read.pendingEth([author.account.address]), parseEther("0.1"));
    assert.equal(await auctionV3.read.pendingEth([seller.account.address]), parseEther("0.9"));
    assert.equal(await auctionV3.read.pendingEth([owner.account.address]), 0n);
  });

  it("ERC20 结算：平台费 + 版税 + 剩余（三方 pendingErc20 记账）", async () => {
    const { auctionV3, nft, token } = await deployV3(300n);
    await nft.write.mint([seller.account.address], { account: owner.account });
    await nft.write.setTokenRoyalty([0n, author.account.address, 500n], { account: owner.account });
    await nft.write.approve([auctionV3.address, 0n], { account: seller.account });
    await auctionV3.write.createAuction([nft.address, 0n, 1n], { account: seller.account });

    await token.write.mint([bidder1.account.address, 1000_000000n]);
    await token.write.approve([auctionV3.address, 1000_000000n], { account: bidder1.account });
    await auctionV3.write.bidWithErc20([1n, 1000_000000n], { account: bidder1.account });

    await testClient.increaseTime({ seconds: 3600 });
    await testClient.mine({ blocks: 1 });
    await auctionV3.write.endAuction([1n], { account: bidder2.account });

    assert.equal(await auctionV3.read.pendingErc20([owner.account.address]), 30_000000n);
    assert.equal(await auctionV3.read.pendingErc20([author.account.address]), 50_000000n);
    assert.equal(await auctionV3.read.pendingErc20([seller.account.address]), 920_000000n);
  });

  it("catch 分支：NonERC2981NFT（普通 ERC721）无版税", async () => {
    const { auctionV3 } = await deployV3(300n);
    const noRoyaltyNft: NonErc2981Nft = await viem.deployContract("NonERC2981NFT");
    await noRoyaltyNft.write.mint([seller.account.address], { account: owner.account });
    await noRoyaltyNft.write.approve([auctionV3.address, 0n], { account: seller.account });
    await auctionV3.write.createAuction([noRoyaltyNft.address, 0n, 1n], { account: seller.account });
    await auctionV3.write.bidWithEth([1n], { account: bidder1.account, value: parseEther("1") });

    await testClient.increaseTime({ seconds: 3600 });
    await testClient.mine({ blocks: 1 });
    await auctionV3.write.endAuction([1n], { account: bidder2.account });

    assert.equal(await auctionV3.read.pendingEth([owner.account.address]), parseEther("0.03"));
    assert.equal(await auctionV3.read.pendingEth([seller.account.address]), parseEther("0.97"));
    assert.equal(await auctionV3.read.pendingEth([bidder1.account.address]), 0n);
  });

  // ═══════════ F3：royaltyInfo gas cap（防恶意 NFT OOG 卡死结算）═══════════

  it("F3：恶意 NFT 的 royaltyInfo 死循环，V3 结算不 OOG，catch 回退不计版税", async () => {
    const { auctionV3 } = await deployV3(300n);
    const gg: GasGuzzlerRoyaltyNft = await viem.deployContract("GasGuzzlerRoyaltyNFT");
    assert.equal(await gg.read.supportsInterface(["0x2a55205a"]), true); // 覆盖 GasGuzzler.supportsInterface（实现 IERC2981）
    await gg.write.mint([seller.account.address], { account: owner.account });
    await gg.write.approve([auctionV3.address, 0n], { account: seller.account });
    await auctionV3.write.createAuction([gg.address, 0n, 1n], { account: seller.account });
    const aid = (await auctionV3.read.nextAuctionId()) - 1n;
    await auctionV3.write.bidWithEth([aid], { account: bidder1.account, value: parseEther("1") });

    await testClient.increaseTime({ seconds: 3600 });
    await testClient.mine({ blocks: 1 });
    await auctionV3.write.endAuction([aid], { account: bidder2.account });

    assert.equal(await auctionV3.read.pendingEth([owner.account.address]), parseEther("0.03"));
    assert.equal(await auctionV3.read.pendingEth([seller.account.address]), parseEther("0.97"));
    assert.equal(await auctionV3.read.settledRoyalty([aid]), 0n);
  });

  it("F3：正常 ERC2981 的 royaltyInfo 在 gas cap 内正常计版税（不被误杀）", async () => {
    const { auctionV3, nft } = await deployV3(300n);
    await nft.write.mint([seller.account.address], { account: owner.account });
    await nft.write.setTokenRoyalty([0n, author.account.address, 500n], { account: owner.account });
    await nft.write.approve([auctionV3.address, 0n], { account: seller.account });
    await auctionV3.write.createAuction([nft.address, 0n, 1n], { account: seller.account });
    const aid = (await auctionV3.read.nextAuctionId()) - 1n;
    await auctionV3.write.bidWithEth([aid], { account: bidder1.account, value: parseEther("1") });

    await testClient.increaseTime({ seconds: 3600 });
    await testClient.mine({ blocks: 1 });
    await auctionV3.write.endAuction([aid], { account: bidder2.account });

    assert.equal(await auctionV3.read.pendingEth([owner.account.address]), parseEther("0.03"));
    assert.equal(await auctionV3.read.pendingEth([author.account.address]), parseEther("0.05"));
    assert.equal(await auctionV3.read.pendingEth([seller.account.address]), parseEther("0.92"));
    assert.equal(await auctionV3.read.settledRoyalty([aid]), parseEther("0.05"));
  });

  // ═══════════ Coverage V3：极端费率 / receiver=0 / NonERC2981 ERC20 ═══════════

  it("V3 极端费率兜底：fee 25%（MAX_PLATFORM_FEE_BP）+ 版税 100%（cap 10%）不锁死，seller 收 65%", async () => {
    const { auctionV3, nft } = await deployV3(2500n);
    const nextToken = await nft.read.totalSupply();
    await nft.write.mint([seller.account.address], { account: owner.account });
    await nft.write.setTokenRoyalty([nextToken, author.account.address, 10000n], { account: owner.account });
    await nft.write.approve([auctionV3.address, nextToken], { account: seller.account });
    await auctionV3.write.createAuction([nft.address, nextToken, 1n], { account: seller.account });
    await auctionV3.write.bidWithEth([1n], { account: bidder1.account, value: parseEther("1") });

    await testClient.increaseTime({ seconds: 3600 });
    await testClient.mine({ blocks: 1 });
    await auctionV3.write.endAuction([1n], { account: bidder2.account });
    assert.equal(await auctionV3.read.pendingEth([owner.account.address]), parseEther("0.25"));
    assert.equal(await auctionV3.read.pendingEth([author.account.address]), parseEther("0.1"));
    assert.equal(await auctionV3.read.pendingEth([seller.account.address]), parseEther("0.65"));
  });

  it("V3 receiver=0 版税：版税 receiver 为 0 地址时不计版税，全归 seller（防资金沉淀到 0 地址）", async () => {
    const { auctionV3 } = await deployV3(0n);
    const zrNft: ZeroReceiverRoyaltyNft = await viem.deployContract("ZeroReceiverRoyaltyNFT");
    const zrToken = await zrNft.read.nextId();
    await zrNft.write.mint([seller.account.address], { account: owner.account });
    await zrNft.write.approve([auctionV3.address, zrToken], { account: seller.account });
    await auctionV3.write.createAuction([zrNft.address, zrToken, 1n], { account: seller.account });
    await auctionV3.write.bidWithEth([1n], { account: bidder1.account, value: parseEther("1") });

    await testClient.increaseTime({ seconds: 3600 });
    await testClient.mine({ blocks: 1 });
    await auctionV3.write.endAuction([1n], { account: bidder2.account });
    assert.equal(await auctionV3.read.pendingEth([seller.account.address]), parseEther("1"));
  });

  it("升级到 V3：NonERC2981NFT（catch 分支）+ ERC20 结算", async () => {
    const { auctionV3, token } = await deployV3(300n);
    const noRoy: NonErc2981Nft = await viem.deployContract("NonERC2981NFT");
    await noRoy.write.mint([seller.account.address], { account: owner.account });
    await noRoy.write.approve([auctionV3.address, 0n], { account: seller.account });
    await auctionV3.write.createAuction([noRoy.address, 0n, 1n], { account: seller.account });

    await token.write.mint([bidder1.account.address, 1000_000000n]);
    await token.write.approve([auctionV3.address, 1000_000000n], { account: bidder1.account });
    await auctionV3.write.bidWithErc20([1n, 1000_000000n], { account: bidder1.account });

    await testClient.increaseTime({ seconds: 3600 });
    await testClient.mine({ blocks: 1 });
    await auctionV3.write.endAuction([1n], { account: bidder2.account });
    assert.equal(await auctionV3.read.pendingErc20([owner.account.address]), 30_000000n);
    assert.equal(await auctionV3.read.pendingErc20([seller.account.address]), 970_000000n);
  });

  it("ZeroReceiverRoyaltyNFT.supportsInterface(ERC2981) = true + royaltyInfo 返回 receiver=0", async () => {
    const z: ZeroReceiverRoyaltyNft = await viem.deployContract("ZeroReceiverRoyaltyNFT");
    assert.equal(await z.read.supportsInterface(["0x2a55205a"]), true); // ERC2981
    assert.equal(await z.read.supportsInterface(["0x80ac58cd"]), true); // ERC721
    const ri = await z.read.royaltyInfo([0n, parseEther("1")]);
    assert.equal((field(ri, "receiver", 0) as Address).toLowerCase(), "0x0000000000000000000000000000000000000000");
  });
});
