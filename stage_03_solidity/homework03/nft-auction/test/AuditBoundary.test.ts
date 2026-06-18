// F7 _reverseDistribution 资金守恒边界（debit/credit 同地址：winner/royalty 与 seller/owner 重合）
// + pull 模式资金守恒不变量（合约 ETH 余额 == sum(pendingEth)）。
// 吸收自原 _AUDIT_BOUNDARY 测试 + Coverage 的资金守恒用例。
import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { parseEther } from "viem";
import type { Address, PublicClient, TestClient } from "viem";
import {
  advanceToEnd,
  advanceToReclaim,
  deployInfra,
  deployV1Env,
  deployV3,
  getClients,
  getWallets,
  type AuctionV3,
  type MockErc20,
  type MyNft,
  type TestWallet,
} from "./helpers";

describe("F7 反向分账资金守恒边界", () => {
  let owner!: TestWallet, seller!: TestWallet, bidder1!: TestWallet, bidder2!: TestWallet, author!: TestWallet;
  let testClient!: TestClient, publicClient!: PublicClient;
  let nft!: MyNft, token!: MockErc20;

  before(async () => {
    ({ owner, seller, bidder1, bidder2, author } = await getWallets());
    ({ publicClient, testClient } = await getClients());
    const infra = await deployInfra();
    nft = infra.nft;
    token = infra.token;
  });

  // mint 一个 NFT（可选版税）+ approve + 建拍，返回 auctionId。
  async function mkAuction(auction: AuctionV3, royaltyTo?: Address, royaltyBp?: bigint): Promise<bigint> {
    await nft.write.mint([seller.account.address], { account: owner.account });
    const tk = (await nft.read.totalSupply()) - 1n;
    if (royaltyTo !== undefined && royaltyBp !== undefined) {
      await nft.write.setTokenRoyalty([tk, royaltyTo, royaltyBp], { account: owner.account });
    }
    await nft.write.approve([auction.address, tk], { account: seller.account });
    await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });
    return (await auction.read.nextAuctionId()) - 1n;
  }

  async function settleAndAdvance(settle: () => Promise<unknown>): Promise<void> {
    await advanceToEnd(testClient);
    await settle();
    await advanceToReclaim(testClient);
  }

  it("winner==owner: conservation holds", async () => {
    const { auctionV3 } = await deployV3(300n);
    const aid = await mkAuction(auctionV3);
    await auctionV3.write.bidWithEth([aid], { account: owner.account, value: parseEther("1") });
    await settleAndAdvance(() => auctionV3.write.endAuction([aid], { account: bidder1.account }));
    await auctionV3.write.reclaimNft([aid], { account: seller.account });
    assert.equal(await auctionV3.read.pendingEth([owner.account.address]), parseEther("1"));
    assert.equal(await auctionV3.read.pendingEth([seller.account.address]), 0n);
  });

  it("winner==seller (self-bid): conservation holds", async () => {
    const { auctionV3 } = await deployV3(300n);
    const aid = await mkAuction(auctionV3);
    await auctionV3.write.bidWithEth([aid], { account: seller.account, value: parseEther("1") });
    await settleAndAdvance(() => auctionV3.write.endAuction([aid], { account: bidder1.account }));
    await auctionV3.write.reclaimNft([aid], { account: seller.account });
    assert.equal(await auctionV3.read.pendingEth([seller.account.address]), parseEther("1"));
    assert.equal(await auctionV3.read.pendingEth([owner.account.address]), 0n);
  });

  it("royalty receiver==seller: conservation holds", async () => {
    const { auctionV3 } = await deployV3(300n);
    const aid = await mkAuction(auctionV3, seller.account.address, 500n);
    await auctionV3.write.bidWithEth([aid], { account: bidder1.account, value: parseEther("1") });
    await settleAndAdvance(() => auctionV3.write.endAuction([aid], { account: bidder1.account }));
    await auctionV3.write.reclaimNft([aid], { account: seller.account });
    assert.equal(await auctionV3.read.pendingEth([seller.account.address]), 0n);
    assert.equal(await auctionV3.read.pendingEth([bidder1.account.address]), parseEther("1"));
    assert.equal(await auctionV3.read.pendingEth([owner.account.address]), 0n);
  });

  it("royalty receiver==owner: conservation holds", async () => {
    const { auctionV3 } = await deployV3(300n);
    const aid = await mkAuction(auctionV3, owner.account.address, 500n);
    await auctionV3.write.bidWithEth([aid], { account: bidder1.account, value: parseEther("1") });
    await settleAndAdvance(() => auctionV3.write.endAuction([aid], { account: bidder1.account }));
    await auctionV3.write.reclaimNft([aid], { account: seller.account });
    assert.equal(await auctionV3.read.pendingEth([owner.account.address]), 0n);
    assert.equal(await auctionV3.read.pendingEth([seller.account.address]), 0n);
    assert.equal(await auctionV3.read.pendingEth([bidder1.account.address]), parseEther("1"));
  });

  it("owner withdrew fee → N1 软扣减：reclaim 仍成功，winner 退可扣额（owner fee 追不回）", async () => {
    const { auctionV3 } = await deployV3(300n);
    const aid = await mkAuction(auctionV3);
    await auctionV3.write.bidWithEth([aid], { account: bidder1.account, value: parseEther("1") });
    await settleAndAdvance(() => auctionV3.write.endAuction([aid], { account: bidder1.account }));
    await auctionV3.write.withdraw({ account: owner.account });
    await auctionV3.write.reclaimNft([aid], { account: seller.account });
    assert.equal(await auctionV3.read.pendingEth([bidder1.account.address]), parseEther("0.97"));
    assert.equal(await auctionV3.read.pendingEth([owner.account.address]), 0n);
    assert.equal(await auctionV3.read.pendingEth([seller.account.address]), 0n);
  });

  it("资金守恒不变量：一组 bid/end/withdraw 后，合约 ETH 余额 == sum(pendingEth)", async () => {
    const env = await deployV1Env();
    const c = env.auction;
    await env.nft.write.mint([seller.account.address], { account: owner.account });
    const tk = (await env.nft.read.totalSupply()) - 1n;
    await env.nft.write.approve([c.address, tk], { account: seller.account });
    const aid1 = await c.read.nextAuctionId();
    await c.write.createAuction([env.nft.address, tk, 1n], { account: seller.account });
    await c.write.bidWithEth([aid1], { account: bidder1.account, value: parseEther("1") });
    await c.write.bidWithEth([aid1], { account: bidder2.account, value: parseEther("3") });

    await advanceToEnd(testClient);
    await c.write.endAuction([aid1], { account: bidder1.account });

    const sumPending = async (): Promise<bigint> => {
      const s = await c.read.pendingEth([seller.account.address]);
      const b1 = await c.read.pendingEth([bidder1.account.address]);
      const b2 = await c.read.pendingEth([bidder2.account.address]);
      const o = await c.read.pendingEth([owner.account.address]);
      return s + b1 + b2 + o;
    };
    assert.equal(await publicClient.getBalance({ address: c.address }), await sumPending());

    await c.write.withdraw({ account: bidder1.account });
    assert.equal(await publicClient.getBalance({ address: c.address }), await sumPending());

    await c.write.withdraw({ account: seller.account });
    assert.equal(await publicClient.getBalance({ address: c.address }), 0n);
    assert.equal(await sumPending(), 0n);

    await c.write.claimNft([aid1], { account: bidder2.account });
    assert.equal((await env.nft.read.ownerOf([tk])).toLowerCase(), bidder2.account.address.toLowerCase());
  });
});
