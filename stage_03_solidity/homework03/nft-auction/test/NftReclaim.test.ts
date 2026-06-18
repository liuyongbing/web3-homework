// F7 NFT 超时回收（带退款保护）：
//  - 结算满 NFT_RECLAIM_DELAY(7天) 后，赢家未 claimNft，卖家可 reclaimNft 回收 NFT
//  - 有赢家时：反向分账，把结算分出去的钱全额扣回、记给赢家（退款保护，读结算快照保证一致）
//  - N1 软扣减：收款方已 withdraw 的部分追不回，reclaim 仍成功（部分退款）
import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { parseEther } from "viem";
import type { PublicClient, TestClient } from "viem";
import {
  advanceToEnd,
  advanceToReclaim,
  deployV1WithToken,
  getClients,
  getWallets,
  newNft,
  upgradeToV2,
  upgradeToV3,
  viem,
  type AuctionV2,
  type AuctionV3,
  type MockErc20,
  type MyNft,
  type TestWallet,
} from "./helpers";

describe("F7 NFT 超时回收（带退款保护）", () => {
  let owner!: TestWallet, seller!: TestWallet, bidder1!: TestWallet, bidder2!: TestWallet, author!: TestWallet;
  let testClient!: TestClient, publicClient!: PublicClient;
  let nft!: MyNft, token!: MockErc20;

  before(async () => {
    ({ owner, seller, bidder1, bidder2, author } = await getWallets());
    ({ publicClient, testClient } = await getClients());
    token = await viem.deployContract("MockERC20", ["U", "U", 6]);
    nft = await viem.deployContract("MyNFT", ["MyNFT", "MNFT", "https://a/"]);
  });

  // 结算 + 推进到可 reclaim 时刻。settle 回调由调用方提供（在其具体合约类型上调 endAuction，
  // 避免 V1|V2|V3 union 的 write 推断问题）。
  async function settleAndAdvance(settle: () => Promise<unknown>): Promise<void> {
    await advanceToEnd(testClient);
    await settle();
    await advanceToReclaim(testClient);
  }

  it("F7：无人出价拍卖，结算超时后卖家 reclaimNft 领回 NFT", async () => {
    const auction = await deployV1WithToken(token.address);
    const tk = await newNft(nft, auction.address, owner, seller);
    await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });
    const aid = (await auction.read.nextAuctionId()) - 1n;

    await advanceToEnd(testClient);
    await auction.write.endAuction([aid], { account: bidder1.account });
    // 未满 7 天：reclaim revert
    await assert.rejects(
      auction.write.reclaimNft([aid], { account: seller.account }),
      /reclaim|too early/i,
    );
    await advanceToReclaim(testClient);
    await auction.write.reclaimNft([aid], { account: seller.account });
    assert.equal((await nft.read.ownerOf([tk])).toLowerCase(), seller.account.address.toLowerCase());
  });

  it("F7（V1 ETH）：赢家逾期未领，卖家回收 NFT + 全额退款给赢家", async () => {
    const auction = await deployV1WithToken(token.address);
    const tk = await newNft(nft, auction.address, owner, seller);
    await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });
    const aid = (await auction.read.nextAuctionId()) - 1n;
    await auction.write.bidWithEth([aid], { account: bidder1.account, value: parseEther("1") });

    await settleAndAdvance(() => auction.write.endAuction([aid], { account: bidder2.account }));
    assert.equal(await auction.read.pendingEth([seller.account.address]), parseEther("1"));

    await auction.write.reclaimNft([aid], { account: seller.account });
    assert.equal((await nft.read.ownerOf([tk])).toLowerCase(), seller.account.address.toLowerCase());
    assert.equal(await auction.read.pendingEth([bidder1.account.address]), parseEther("1"));
    assert.equal(await auction.read.pendingEth([seller.account.address]), 0n);
    assert.equal(
      await publicClient.getBalance({ address: auction.address }),
      await auction.read.pendingEth([bidder1.account.address]),
    );
  });

  it("F7：非卖家调用 reclaimNft revert（NotSeller）", async () => {
    const auction = await deployV1WithToken(token.address);
    const tk = await newNft(nft, auction.address, owner, seller);
    await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });
    const aid = (await auction.read.nextAuctionId()) - 1n;
    await settleAndAdvance(() => auction.write.endAuction([aid], { account: bidder2.account }));
    await assert.rejects(
      auction.write.reclaimNft([aid], { account: bidder1.account }),
      /NotSeller|seller/i,
    );
  });

  it("F7：赢家已 claimNft 后，卖家 reclaimNft revert（NftAlreadyClaimed）", async () => {
    const auction = await deployV1WithToken(token.address);
    const tk = await newNft(nft, auction.address, owner, seller);
    await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });
    const aid = (await auction.read.nextAuctionId()) - 1n;
    await auction.write.bidWithEth([aid], { account: bidder1.account, value: parseEther("1") });
    await settleAndAdvance(() => auction.write.endAuction([aid], { account: bidder2.account }));

    await auction.write.claimNft([aid], { account: bidder1.account });
    await assert.rejects(
      auction.write.reclaimNft([aid], { account: seller.account }),
      /already claimed|NftAlreadyClaimed/i,
    );
  });

  it("F7 N1：卖家已 withdraw，软扣减使 reclaim 仍成功（NFT 回卖家），赢家退实际可扣额", async () => {
    const auction = await deployV1WithToken(token.address);
    const tk = await newNft(nft, auction.address, owner, seller);
    await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });
    const aid = (await auction.read.nextAuctionId()) - 1n;
    await auction.write.bidWithEth([aid], { account: bidder1.account, value: parseEther("1") });
    await settleAndAdvance(() => auction.write.endAuction([aid], { account: bidder2.account }));

    await auction.write.withdraw({ account: seller.account });
    assert.equal(await auction.read.pendingEth([seller.account.address]), 0n);

    await auction.write.reclaimNft([aid], { account: seller.account });
    assert.equal((await nft.read.ownerOf([tk])).toLowerCase(), seller.account.address.toLowerCase());
    assert.equal(await auction.read.pendingEth([bidder1.account.address]), 0n);
  });

  it("F7 N1：V3 版税作者提现版税不锁死卖家回收（软扣减，author 部分追不回）", async () => {
    const auctionV3: AuctionV3 = await upgradeToV3(await deployV1WithToken(token.address), owner, 300n);
    const tk = await newNft(nft, auctionV3.address, owner, seller);
    await nft.write.setTokenRoyalty([tk, author.account.address, 500n], { account: owner.account });
    await auctionV3.write.createAuction([nft.address, tk, 1n], { account: seller.account });
    const aid = (await auctionV3.read.nextAuctionId()) - 1n;
    await auctionV3.write.bidWithEth([aid], { account: bidder1.account, value: parseEther("1") });
    await settleAndAdvance(() => auctionV3.write.endAuction([aid], { account: bidder2.account }));

    await auctionV3.write.withdraw({ account: author.account });
    assert.equal(await auctionV3.read.pendingEth([author.account.address]), 0n);

    await auctionV3.write.reclaimNft([aid], { account: seller.account });
    assert.equal((await nft.read.ownerOf([tk])).toLowerCase(), seller.account.address.toLowerCase());
    assert.equal(await auctionV3.read.pendingEth([bidder1.account.address]), parseEther("0.95"));
    assert.equal(await auctionV3.read.pendingEth([owner.account.address]), 0n);
    assert.equal(await auctionV3.read.pendingEth([seller.account.address]), 0n);
  });

  it("F7（V2）：reclaim 扣回 fee(owner) + toSeller(seller)，全额退赢家", async () => {
    const auctionV2: AuctionV2 = await upgradeToV2(await deployV1WithToken(token.address), owner, 300n);
    const tk = await newNft(nft, auctionV2.address, owner, seller);
    await auctionV2.write.createAuction([nft.address, tk, 1n], { account: seller.account });
    const aid = (await auctionV2.read.nextAuctionId()) - 1n;
    await auctionV2.write.bidWithEth([aid], { account: bidder1.account, value: parseEther("1") });
    await settleAndAdvance(() => auctionV2.write.endAuction([aid], { account: bidder2.account }));

    assert.equal(await auctionV2.read.pendingEth([owner.account.address]), parseEther("0.03"));
    assert.equal(await auctionV2.read.pendingEth([seller.account.address]), parseEther("0.97"));

    await auctionV2.write.reclaimNft([aid], { account: seller.account });
    assert.equal(await auctionV2.read.pendingEth([owner.account.address]), 0n);
    assert.equal(await auctionV2.read.pendingEth([seller.account.address]), 0n);
    assert.equal(await auctionV2.read.pendingEth([bidder1.account.address]), parseEther("1"));
    assert.equal((await nft.read.ownerOf([tk])).toLowerCase(), seller.account.address.toLowerCase());
  });

  it("F7（V3）：reclaim 扣回 fee + royalty + toSeller，全额退赢家（三方快照一致）", async () => {
    const auctionV3: AuctionV3 = await upgradeToV3(await deployV1WithToken(token.address), owner, 300n);
    const tk = await newNft(nft, auctionV3.address, owner, seller);
    await nft.write.setTokenRoyalty([tk, author.account.address, 500n], { account: owner.account });
    await auctionV3.write.createAuction([nft.address, tk, 1n], { account: seller.account });
    const aid = (await auctionV3.read.nextAuctionId()) - 1n;
    await auctionV3.write.bidWithEth([aid], { account: bidder1.account, value: parseEther("1") });
    await settleAndAdvance(() => auctionV3.write.endAuction([aid], { account: bidder2.account }));

    assert.equal(await auctionV3.read.pendingEth([owner.account.address]), parseEther("0.03"));
    assert.equal(await auctionV3.read.pendingEth([author.account.address]), parseEther("0.05"));
    assert.equal(await auctionV3.read.pendingEth([seller.account.address]), parseEther("0.92"));
    assert.equal(await auctionV3.read.settledFee([aid]), parseEther("0.03"));
    assert.equal(await auctionV3.read.settledRoyalty([aid]), parseEther("0.05"));

    await auctionV3.write.reclaimNft([aid], { account: seller.account });
    assert.equal(await auctionV3.read.pendingEth([owner.account.address]), 0n);
    assert.equal(await auctionV3.read.pendingEth([author.account.address]), 0n);
    assert.equal(await auctionV3.read.pendingEth([seller.account.address]), 0n);
    assert.equal(await auctionV3.read.pendingEth([bidder1.account.address]), parseEther("1"));
    assert.equal((await nft.read.ownerOf([tk])).toLowerCase(), seller.account.address.toLowerCase());
  });

  it("F7：reclaimNft 对不存在的拍卖 revert（AuctionNotFound，line 345）", async () => {
    const auction = await deployV1WithToken(token.address);
    await assert.rejects(
      auction.write.reclaimNft([999n], { account: seller.account }),
      /auction not found|AuctionNotFound/i,
    );
  });

  it("F7：reclaimNft 对未结算拍卖 revert（AuctionNotEnded，line 346）", async () => {
    const auction = await deployV1WithToken(token.address);
    const tk = await newNft(nft, auction.address, owner, seller);
    await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });
    const aid = (await auction.read.nextAuctionId()) - 1n;
    await assert.rejects(
      auction.write.reclaimNft([aid], { account: seller.account }),
      /not ended|AuctionNotEnded/i,
    );
  });

  it("F7（ERC20 出价）：reclaimNft 反向退款走 _debit 的 ERC20 分支（line 480-482）", async () => {
    const auction = await deployV1WithToken(token.address);
    const tk = await newNft(nft, auction.address, owner, seller);
    await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });
    const aid = (await auction.read.nextAuctionId()) - 1n;
    await token.write.mint([bidder1.account.address, 1000_000000n]);
    await token.write.approve([auction.address, 1000_000000n], { account: bidder1.account });
    await auction.write.bidWithErc20([aid, 1000_000000n], { account: bidder1.account });

    await settleAndAdvance(() => auction.write.endAuction([aid], { account: bidder2.account }));
    assert.equal(await auction.read.pendingErc20([seller.account.address]), 1000_000000n);

    // reclaim：highestBidType=Erc20，_reverseDistribution→_debit 走 ERC20 分支（480-482）
    await auction.write.reclaimNft([aid], { account: seller.account });
    assert.equal(await auction.read.pendingErc20([seller.account.address]), 0n);
    assert.equal(await auction.read.pendingErc20([bidder1.account.address]), 1000_000000n);
    assert.equal((await nft.read.ownerOf([tk])).toLowerCase(), seller.account.address.toLowerCase());
  });
});
