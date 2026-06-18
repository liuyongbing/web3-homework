// MyNFT 合约测试：mint / 版税 / 接口 / F8 tokenId 存在性校验
// 吸收自原 MyNftRoyaltyGuard.test.ts（F8）+ Coverage.test.ts 的 MyNFT 与 Mock 基础设施部分。
import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { parseEther } from "viem";
import type { Address, PublicClient } from "viem";
import {
  deployInfra,
  field,
  getClients,
  getWallets,
  type MyNft,
  type TestWallet,
} from "./helpers";

describe("MyNFT：mint / 版税 / 接口 / F8 tokenId 存在性", () => {
  let owner!: TestWallet;
  let seller!: TestWallet;
  let bidder1!: TestWallet;
  let bidder2!: TestWallet;
  let publicClient!: PublicClient;
  let nft!: MyNft;

  before(async () => {
    ({ owner, seller, bidder1, bidder2 } = await getWallets());
    ({ publicClient } = await getClients());
    ({ nft } = await deployInfra());
  });

  // 动态 mint 一个 NFT 给指定账户，返回新 tokenId（避免硬编码序号）。
  async function mintTo(to: TestWallet): Promise<bigint> {
    const tk = await nft.read.totalSupply();
    await nft.write.mint([to.account.address], { account: owner.account });
    return tk;
  }

  it("mint（一参数）铸造 NFT", async () => {
    const tk = await mintTo(seller);
    assert.equal((await nft.read.ownerOf([tk])).toLowerCase(), seller.account.address.toLowerCase());
    assert.equal(await nft.read.totalSupply(), tk + 1n);
  });

  it("mintWithRoyalty（三参数）铸造并设置版税", async () => {
    const before = await nft.read.totalSupply();
    const tx = await nft.write.mintWithRoyalty(
      [seller.account.address, bidder1.account.address, 700n],
      { account: owner.account },
    );
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    assert.equal(receipt.status, "success");
    const tk = before;
    const ri = await nft.read.royaltyInfo([tk, parseEther("1")]);
    assert.equal((field(ri, "receiver", 0) as Address).toLowerCase(), bidder1.account.address.toLowerCase());
    assert.equal(field(ri, "royaltyAmount", 1) as bigint, parseEther("0.07")); // 7%
  });

  it("mintWithRoyalty fee 超限 revert（FeeTooHigh）", async () => {
    await assert.rejects(
      nft.write.mintWithRoyalty([seller.account.address, bidder1.account.address, 10001n], {
        account: owner.account,
      }),
      /FeeTooHigh/i,
    );
  });

  it("setTokenRoyalty 设置 + 超限 revert", async () => {
    const tk = await mintTo(seller);
    await nft.write.setTokenRoyalty([tk, bidder2.account.address, 300n], { account: owner.account });
    const ri = await nft.read.royaltyInfo([tk, parseEther("1")]);
    assert.equal((field(ri, "receiver", 0) as Address).toLowerCase(), bidder2.account.address.toLowerCase());
    await assert.rejects(
      nft.write.setTokenRoyalty([tk, bidder2.account.address, 10001n], { account: owner.account }),
      /FeeTooHigh/i,
    );
  });

  it("非 owner 调 mint revert（OwnableUnauthorizedAccount）", async () => {
    await assert.rejects(
      nft.write.mint([seller.account.address], { account: bidder1.account }),
      /OwnableUnauthorizedAccount|ownable/i,
    );
  });

  it("supportsInterface（ERC721 + ERC2981 合并）", async () => {
    assert.equal(await nft.read.supportsInterface(["0x80ac58cd"]), true); // ERC721
    assert.equal(await nft.read.supportsInterface(["0x2a55205a"]), true); // ERC2981
    assert.equal(await nft.read.supportsInterface(["0x01ffc9a7"]), true); // ERC165
    assert.equal(await nft.read.supportsInterface(["0xffffffff"]), false);
  });

  it("setBaseURI + tokenURI", async () => {
    await nft.write.setBaseURI(["https://new.example.com/"], { account: owner.account });
    const tk = await mintTo(seller);
    assert.equal(await nft.read.tokenURI([tk]), `https://new.example.com/${tk}`);
  });

  // ─── F8：setTokenRoyalty tokenId 存在性校验（防为未铸造 tokenId 设脏数据）───

  it("F8：setTokenRoyalty 对未铸造的 tokenId revert（防脏数据）", async () => {
    const nonexistent = 999_999n;
    await assert.rejects(
      nft.write.setTokenRoyalty([nonexistent, seller.account.address, 500n], { account: owner.account }),
      /nonexistent|NonexistentToken|not exist|invalid token|revert/i,
    );
  });

  it("F8：setTokenRoyalty 对已铸造 tokenId 正常（修复不破坏正常路径）", async () => {
    const tk = await mintTo(seller);
    await nft.write.setTokenRoyalty([tk, seller.account.address, 500n], { account: owner.account });
    const ri = await nft.read.royaltyInfo([tk, parseEther("1")]);
    assert.equal((field(ri, "receiver", 0) as Address).toLowerCase(), seller.account.address.toLowerCase());
    assert.equal(field(ri, "royaltyAmount", 1) as bigint, parseEther("0.05")); // 5%
  });

  it("F8：mintWithRoyalty 仍正常（绕过 setTokenRoyalty，不受 F8 影响）", async () => {
    const before = await nft.read.totalSupply();
    await nft.write.mintWithRoyalty(
      [seller.account.address, seller.account.address, 700n],
      { account: owner.account },
    ); // 7% 版税
    const ri = await nft.read.royaltyInfo([before, parseEther("1")]);
    assert.equal(field(ri, "royaltyAmount", 1) as bigint, parseEther("0.07"));
  });

  it("MockPriceFeed setPrice + MockERC20 decimals 覆盖（基础设施）", async () => {
    const { ethFeed, token } = await deployInfra();
    await ethFeed.write.setPrice([3000_00000000n]);
    assert.equal(await ethFeed.read.latestAnswer(), 3000_00000000n);
    assert.equal(Number(await token.read.decimals()), 6);
    assert.equal(await ethFeed.read.description(), "Mock Price Feed");
    assert.equal(await ethFeed.read.version(), 1n);
  });
});
