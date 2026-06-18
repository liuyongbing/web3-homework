// NFTAuction (V1) 测试：pull 模式基础 + F2 单币种锁定 + 毒出价 DoS + F1 通缩守恒 + F6 时长上限 + 错误分支
// 吸收自原 NFTAuction / BidCurrencyLock / Security / SecurityAudit 测试 + Coverage 的 V1 子集。
import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { encodeFunctionData, parseEther } from "viem";
import type { Address, PublicClient, TestClient } from "viem";
import type { ContractReturnType } from "@nomicfoundation/hardhat-viem/types";
import {
  deployInfra,
  deployV1Env,
  deployV1WithToken,
  field,
  getClients,
  getWallets,
  viem,
  type AuctionV1,
  type MockErc20,
  type MockPriceFeed,
  type MyNft,
  type TestWallet,
} from "./helpers";

type RejectingBidder = ContractReturnType<"RejectingBidder">;
type FeeOnTransferErc20 = ContractReturnType<"FeeOnTransferERC20">;

// BidType enum（None/Eth/Erc20）在 ABI 中为 uint8，viem 强类型要求 number
const BID_NONE = 0;
const BID_ETH = 1;
const BID_ERC20 = 2;

describe("NFTAuction (V1)", () => {
  // ═══════════ pull 模式基础生命周期 ═══════════
  describe("pull 模式基础生命周期", () => {
    let owner!: TestWallet, seller!: TestWallet, bidder1!: TestWallet, bidder2!: TestWallet;
    let publicClient!: PublicClient, testClient!: TestClient;
    let nft!: MyNft, token!: MockErc20, auction!: AuctionV1;
    let ethFeed!: MockPriceFeed, tokenFeed!: MockPriceFeed;

    before(async () => {
      ({ owner, seller, bidder1, bidder2 } = await getWallets());
      ({ publicClient, testClient } = await getClients());
      const env = await deployV1Env();
      auction = env.auction;
      nft = env.nft;
      token = env.token;
      ethFeed = env.ethFeed;
      tokenFeed = env.tokenFeed;
      await nft.write.mint([seller.account.address], { account: owner.account }); // NFT #0
    });

    it("initialize 正确配置 + version 返回 v1", async () => {
      assert.equal((await auction.read.ethUsdFeed()).toLowerCase(), ethFeed.address.toLowerCase());
      assert.equal(Number(await auction.read.paymentTokenDecimals()), 6);
      assert.equal(await auction.read.version(), "v1");
    });

    it("createAuction 后 NFT 托管进合约（auctionId 从 1 开始）", async () => {
      await nft.write.approve([auction.address, 0n], { account: seller.account });
      await auction.write.createAuction([nft.address, 0n, 1n], { account: seller.account });
      assert.equal((await nft.read.ownerOf([0n])).toLowerCase(), auction.address.toLowerCase());
    });

    it("bidder1 用 1 ETH 出价", async () => {
      await auction.write.bidWithEth([1n], { account: bidder1.account, value: parseEther("1") });
      const a = await auction.read.auctions([1n]);
      assert.equal((field(a, "highestBidder", 4) as Address).toLowerCase(), bidder1.account.address.toLowerCase());
    });

    it("bidder2 超过时：bidder1 的退款「记账」到 pendingEth（pull，不直接转账）", async () => {
      await auction.write.bidWithEth([1n], { account: bidder2.account, value: parseEther("2") });
      assert.equal(await auction.read.pendingEth([bidder1.account.address]), parseEther("1"));
      const a = await auction.read.auctions([1n]);
      assert.equal((field(a, "highestBidder", 4) as Address).toLowerCase(), bidder2.account.address.toLowerCase());
    });

    it("bidder1 withdraw 提取退款", async () => {
      const before = await publicClient.getBalance({ address: bidder1.account.address });
      await auction.write.withdraw({ account: bidder1.account });
      const after = await publicClient.getBalance({ address: bidder1.account.address });
      assert.ok(after - before > parseEther("0.99"));
      assert.equal(await auction.read.pendingEth([bidder1.account.address]), 0n);
    });

    it("结算：卖家收款记账到 pendingEth（pull，不直接转账）", async () => {
      await testClient.increaseTime({ seconds: 3600 });
      await testClient.mine({ blocks: 1 });
      await auction.write.endAuction([1n], { account: bidder1.account });
      assert.equal(await auction.read.pendingEth([seller.account.address]), parseEther("2"));
      assert.equal((await nft.read.ownerOf([0n])).toLowerCase(), auction.address.toLowerCase());
      await auction.write.claimNft([1n], { account: bidder2.account });
      assert.equal((await nft.read.ownerOf([0n])).toLowerCase(), bidder2.account.address.toLowerCase());
    });

    it("seller withdraw 提取 2 ETH", async () => {
      const before = await publicClient.getBalance({ address: seller.account.address });
      await auction.write.withdraw({ account: seller.account });
      const after = await publicClient.getBalance({ address: seller.account.address });
      assert.ok(after - before > parseEther("1.99"));
      assert.equal(await auction.read.pendingEth([seller.account.address]), 0n);
    });

    it("ERC20 出价 + 超越退款 + 结算（pull）", async () => {
      await nft.write.mint([seller.account.address], { account: owner.account }); // #1
      await nft.write.approve([auction.address, 1n], { account: seller.account });
      await auction.write.createAuction([nft.address, 1n, 1n], { account: seller.account }); // auction #2

      await token.write.mint([bidder1.account.address, 3000_000000n]);
      await token.write.approve([auction.address, 3000_000000n], { account: bidder1.account });
      await auction.write.bidWithErc20([2n, 3000_000000n], { account: bidder1.account });

      await token.write.mint([bidder2.account.address, 5000_000000n]);
      await token.write.approve([auction.address, 5000_000000n], { account: bidder2.account });
      await auction.write.bidWithErc20([2n, 5000_000000n], { account: bidder2.account });

      assert.equal(await auction.read.pendingErc20([bidder1.account.address]), 3000_000000n);

      await testClient.increaseTime({ seconds: 3600 });
      await testClient.mine({ blocks: 1 });
      await auction.write.endAuction([2n], { account: bidder1.account });
      assert.equal(await auction.read.pendingErc20([seller.account.address]), 5000_000000n);
    });

    it("无人出价结算：卖家 claimNft 领回 NFT（pull 出站）", async () => {
      await nft.write.mint([seller.account.address], { account: owner.account }); // #2
      await nft.write.approve([auction.address, 2n], { account: seller.account });
      await auction.write.createAuction([nft.address, 2n, 1n], { account: seller.account }); // auction #3

      await testClient.increaseTime({ seconds: 3600 });
      await testClient.mine({ blocks: 1 });
      await auction.write.endAuction([3n], { account: bidder1.account });
      assert.equal((await nft.read.ownerOf([2n])).toLowerCase(), auction.address.toLowerCase());
      await auction.write.claimNft([3n], { account: seller.account });
      assert.equal((await nft.read.ownerOf([2n])).toLowerCase(), seller.account.address.toLowerCase());
    });

    it("pause / unpause 控制", async () => {
      await auction.write.pause({ account: owner.account });
      await assert.rejects(
        auction.write.createAuction([nft.address, 99n, 1n], { account: seller.account }),
        /Paused|enforced/i,
      );
      await auction.write.unpause({ account: owner.account });
    });

    it("initialize 零地址 revert（custom error）", async () => {
      const impl = await viem.deployContract("NFTAuction");
      const badInit = encodeFunctionData({
        abi: impl.abi,
        functionName: "initialize",
        args: ["0x0000000000000000000000000000000000000000", token.address, tokenFeed.address, 6],
      });
      await assert.rejects(
        viem.deployContract("ERC1967Proxy", [impl.address, badInit]),
        /ZeroAddress|invalid|revert/i,
      );
    });
  });

  // ═══════════ F2：单币种锁定（消除跨币种套利）═══════════
  describe("F2 单币种锁定（消除跨币种套利）", () => {
    let owner!: TestWallet, seller!: TestWallet, bidder1!: TestWallet, bidder2!: TestWallet;
    let testClient!: TestClient;
    let nft!: MyNft, token!: MockErc20, auction!: AuctionV1;

    before(async () => {
      ({ owner, seller, bidder1, bidder2 } = await getWallets());
      ({ testClient } = await getClients());
      const env = await deployV1Env();
      auction = env.auction;
      nft = env.nft;
      token = env.token;
    });

    async function newNft(): Promise<bigint> {
      await nft.write.mint([seller.account.address], { account: owner.account });
      const tk = (await nft.read.totalSupply()) - 1n;
      await nft.write.approve([auction.address, tk], { account: seller.account });
      return tk;
    }

    async function fundErc20(who: TestWallet, amount: bigint): Promise<void> {
      await token.write.mint([who.account.address, amount]);
      await token.write.approve([auction.address, amount], { account: who.account });
    }

    it("F2：Eth 锁定拍卖，bidWithEth 成功 + acceptedBidType 正确记录", async () => {
      const tk = await newNft();
      await auction.write.createAuction([nft.address, tk, 1n, BID_ETH], { account: seller.account });
      const aid = (await auction.read.nextAuctionId()) - 1n;
      await auction.write.bidWithEth([aid], { account: bidder1.account, value: parseEther("1") });
      const a = await auction.read.auctions([aid]);
      assert.equal(Number(field(a, "acceptedBidType", 9)), Number(BID_ETH));
      assert.equal((field(a, "highestBidder", 4) as Address).toLowerCase(), bidder1.account.address.toLowerCase());
    });

    it("F2：Eth 锁定拍卖，bidWithErc20 被 BidTypeNotAllowed 拒绝", async () => {
      const tk = await newNft();
      await auction.write.createAuction([nft.address, tk, 1n, BID_ETH], { account: seller.account });
      const aid = (await auction.read.nextAuctionId()) - 1n;
      await fundErc20(bidder1, 1000_000000n);
      await assert.rejects(
        auction.write.bidWithErc20([aid, 1000_000000n], { account: bidder1.account }),
        /BidTypeNotAllowed|bid type|not allowed/i,
      );
    });

    it("F2：Erc20 锁定拍卖，bidWithErc20 成功 + acceptedBidType 正确记录", async () => {
      const tk = await newNft();
      await auction.write.createAuction([nft.address, tk, 1n, BID_ERC20], { account: seller.account });
      const aid = (await auction.read.nextAuctionId()) - 1n;
      await fundErc20(bidder1, 1000_000000n);
      await auction.write.bidWithErc20([aid, 1000_000000n], { account: bidder1.account });
      const a = await auction.read.auctions([aid]);
      assert.equal(Number(field(a, "acceptedBidType", 9)), Number(BID_ERC20));
      assert.equal((field(a, "highestBidder", 4) as Address).toLowerCase(), bidder1.account.address.toLowerCase());
    });

    it("F2：Erc20 锁定拍卖，bidWithEth 被 BidTypeNotAllowed 拒绝", async () => {
      const tk = await newNft();
      await auction.write.createAuction([nft.address, tk, 1n, BID_ERC20], { account: seller.account });
      const aid = (await auction.read.nextAuctionId()) - 1n;
      await assert.rejects(
        auction.write.bidWithEth([aid], { account: bidder1.account, value: parseEther("1") }),
        /BidTypeNotAllowed|bid type|not allowed/i,
      );
    });

    it("F2：混合拍卖（3 参数版本，acceptedBidType=None）两种出价皆可（向后兼容）", async () => {
      const tk = await newNft();
      await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });
      const aid = (await auction.read.nextAuctionId()) - 1n;
      const a0 = await auction.read.auctions([aid]);
      assert.equal(Number(field(a0, "acceptedBidType", 9)), Number(BID_NONE));

      await auction.write.bidWithEth([aid], { account: bidder1.account, value: parseEther("1") });
      await fundErc20(bidder2, 5000_000000n);
      await auction.write.bidWithErc20([aid, 5000_000000n], { account: bidder2.account });
      assert.equal(await auction.read.pendingEth([bidder1.account.address]), parseEther("1"));
    });

    it("F2 PoC：Erc20 锁定拍卖，攻击者无法用 ETH 出价（消除币种切换套利）", async () => {
      const tk = await newNft();
      await auction.write.createAuction([nft.address, tk, 1n, BID_ERC20], { account: seller.account });
      const aid = (await auction.read.nextAuctionId()) - 1n;

      await fundErc20(bidder1, 1000_000000n);
      await auction.write.bidWithErc20([aid, 1000_000000n], { account: bidder1.account });

      await assert.rejects(
        auction.write.bidWithEth([aid], { account: bidder2.account, value: parseEther("1") }),
        /BidTypeNotAllowed|bid type|not allowed/i,
      );
    });

    it("F2：锁定拍卖的结算 / claimNft 生命周期正常（不破坏既有流程）", async () => {
      const tk = await newNft();
      await auction.write.createAuction([nft.address, tk, 1n, BID_ETH], { account: seller.account });
      const aid = (await auction.read.nextAuctionId()) - 1n;
      await auction.write.bidWithEth([aid], { account: bidder1.account, value: parseEther("2") });

      await testClient.increaseTime({ seconds: 3600 });
      await testClient.mine({ blocks: 1 });
      await auction.write.endAuction([aid], { account: bidder2.account });
      assert.equal(await auction.read.pendingEth([seller.account.address]), parseEther("2"));

      await auction.write.claimNft([aid], { account: bidder1.account });
      assert.equal((await nft.read.ownerOf([tk])).toLowerCase(), bidder1.account.address.toLowerCase());
    });
  });

  // ═══════════ 毒出价 DoS 防护（pull 模式）═══════════
  describe("毒出价 DoS 防护（pull 模式防卡死）", () => {
    let owner!: TestWallet, seller!: TestWallet, bidder1!: TestWallet, bidder2!: TestWallet;
    let publicClient!: PublicClient, testClient!: TestClient;
    let nft!: MyNft, auction!: AuctionV1;
    let rejecter!: RejectingBidder;
    let rejecterAddr!: Address;

    before(async () => {
      ({ owner, seller, bidder1, bidder2 } = await getWallets());
      ({ publicClient, testClient } = await getClients());
      const env = await deployV1Env();
      auction = env.auction;
      nft = env.nft;
    });

    it("毒出价者先出价，正常账户再出更高价：不 revert（pull 模式退款只记账）", async () => {
      await nft.write.mint([seller.account.address], { account: owner.account });
      const tk = (await nft.read.totalSupply()) - 1n;
      await nft.write.approve([auction.address, tk], { account: seller.account });
      await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });
      const aid = (await auction.read.nextAuctionId()) - 1n;

      rejecter = await viem.deployContract("RejectingBidder", [auction.address], {
        value: parseEther("1"),
      });
      rejecterAddr = rejecter.address;
      await rejecter.write.bid([aid], { account: owner.account });

      const a1 = await auction.read.auctions([aid]);
      assert.equal((field(a1, "highestBidder", 4) as Address).toLowerCase(), rejecter.address.toLowerCase());

      await auction.write.bidWithEth([aid], { account: bidder1.account, value: parseEther("2") });

      assert.equal(await auction.read.pendingEth([rejecter.address]), parseEther("1"));
      const a2 = await auction.read.auctions([aid]);
      assert.equal((field(a2, "highestBidder", 4) as Address).toLowerCase(), bidder1.account.address.toLowerCase());
      assert.equal(field(a2, "highestBidAmount", 6) as bigint, parseEther("2"));
    });

    it("结算正常完成（pull 模式下毒出价者不影响卖家收款记账）", async () => {
      await testClient.increaseTime({ seconds: 3600 });
      await testClient.mine({ blocks: 1 });
      await auction.write.endAuction([1n], { account: bidder2.account });
      assert.equal(await auction.read.pendingEth([seller.account.address]), parseEther("2"));
      await auction.write.claimNft([1n], { account: bidder1.account });
      const a = await auction.read.auctions([1n]);
      assert.equal((field(a, "nftContract", 1) as Address).toLowerCase(), nft.address.toLowerCase());
    });

    it("毒出价者的资金仍安全记账在 pendingEth，seller 正常 withdraw", async () => {
      assert.equal(await auction.read.pendingEth([rejecterAddr]), parseEther("1"));
      const before = await publicClient.getBalance({ address: seller.account.address });
      await auction.write.withdraw({ account: seller.account });
      const after = await publicClient.getBalance({ address: seller.account.address });
      assert.ok(after - before > parseEther("1.99"));
    });

    it("毒出价者自己 withdraw 会 revert（EthTransferFailed），但资金仍安全记账、合约未卡死", async () => {
      await assert.rejects(
        rejecter.write.withdraw({ account: owner.account }),
        (err: unknown) => /revert|EthTransferFailed|transfer/i.test(String(err)),
      );
      assert.equal(await auction.read.pendingEth([rejecterAddr]), parseEther("1"));
    });
  });

  // ═══════════ F1 通缩代币守恒 + F6 时长上限 ═══════════
  describe("F1 通缩代币资金守恒 + F6 时长上限", () => {
    let owner!: TestWallet, seller!: TestWallet, bidder1!: TestWallet, bidder2!: TestWallet;
    let testClient!: TestClient;
    let nft!: MyNft;

    before(async () => {
      ({ owner, seller, bidder1, bidder2 } = await getWallets());
      ({ testClient } = await getClients());
      ({ nft } = await deployInfra());
    });

    async function mintApproved(auction: AuctionV1): Promise<bigint> {
      await nft.write.mint([seller.account.address], { account: owner.account });
      const tk = (await nft.read.totalSupply()) - 1n;
      await nft.write.approve([auction.address, tk], { account: seller.account });
      return tk;
    }

    it("F1：通缩代币出价，pendingErc20 按实际到账量记账（而非声称 amount），资金守恒", async () => {
      const fot = await viem.deployContract("FeeOnTransferERC20", ["FOT", "FOT", 6]);
      assert.equal(Number(await fot.read.decimals()), 6); // 覆盖 FeeOnTransferERC20.decimals
      const auction = await deployV1WithToken(fot.address);

      const tk = await mintApproved(auction);
      await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });

      const claimed = 1000_000000n;
      const expectedReceived = 990_000000n;
      await fot.write.mint([bidder1.account.address, claimed + 1n]);
      await fot.write.approve([auction.address, claimed + 1n], { account: bidder1.account });
      await auction.write.bidWithErc20([1n, claimed], { account: bidder1.account });

      assert.equal(await fot.read.balanceOf([auction.address]), expectedReceived);

      await testClient.increaseTime({ seconds: 3600 });
      await testClient.mine({ blocks: 1 });
      await auction.write.endAuction([1n], { account: bidder2.account });

      assert.equal(await auction.read.pendingErc20([seller.account.address]), expectedReceived);
      const sumPending = await auction.read.pendingErc20([seller.account.address]);
      assert.equal(await fot.read.balanceOf([auction.address]), sumPending);

      const before = await fot.read.balanceOf([seller.account.address]);
      await auction.write.withdraw({ account: seller.account });
      const after = await fot.read.balanceOf([seller.account.address]);
      assert.ok(after > before);
      assert.equal(await auction.read.pendingErc20([seller.account.address]), 0n);
      assert.equal(await fot.read.balanceOf([auction.address]), 0n);
    });

    it("F1：通缩代币连续出价，被超过者的退款也按实到量守恒（无欠账）", async () => {
      const fot = await viem.deployContract("FeeOnTransferERC20", ["FOT2", "FOT2", 6]);
      const auction = await deployV1WithToken(fot.address);

      const tk = await mintApproved(auction);
      await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });

      await fot.write.mint([bidder1.account.address, 1100_000000n]);
      await fot.write.approve([auction.address, 1100_000000n], { account: bidder1.account });
      await auction.write.bidWithErc20([1n, 1000_000000n], { account: bidder1.account });

      await fot.write.mint([bidder2.account.address, 2100_000000n]);
      await fot.write.approve([auction.address, 2100_000000n], { account: bidder2.account });
      await auction.write.bidWithErc20([1n, 2000_000000n], { account: bidder2.account });

      assert.equal(await auction.read.pendingErc20([bidder1.account.address]), 990_000000n);

      await testClient.increaseTime({ seconds: 3600 });
      await testClient.mine({ blocks: 1 });
      await auction.write.endAuction([1n], { account: bidder2.account });
      assert.equal(await auction.read.pendingErc20([seller.account.address]), 1980_000000n);

      await auction.write.withdraw({ account: bidder1.account });
      await auction.write.withdraw({ account: seller.account });
      assert.equal(await fot.read.balanceOf([auction.address]), 0n);
    });

    it("F1：通缩率拉到 100% 使实到为 0，按 ZeroBid 拒绝（防 0 实到记账）", async () => {
      const fot = await viem.deployContract("FeeOnTransferERC20", ["FOT3", "FOT3", 6]);
      await fot.write.setFeeBp([10000n]);
      const auction = await deployV1WithToken(fot.address);
      const tk = await mintApproved(auction);
      await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });

      await fot.write.mint([bidder1.account.address, 100_000000n]);
      await fot.write.approve([auction.address, 100_000000n], { account: bidder1.account });
      await assert.rejects(
        auction.write.bidWithErc20([1n, 100_000000n], { account: bidder1.account }),
        /zero bid|ZeroBid|bid/i,
      );
      assert.equal(await fot.read.balanceOf([auction.address]), 0n);
    });

    it("F6：MAX_DURATION_HOURS = 8760（1 年）", async () => {
      const token = await viem.deployContract("MockERC20", ["U", "U", 6]);
      const auction = await deployV1WithToken(token.address);
      assert.equal(await auction.read.MAX_DURATION_HOURS(), 8760n);
    });

    it("F6：duration 上限正好通过（8760）", async () => {
      const token = await viem.deployContract("MockERC20", ["U", "U", 6]);
      const auction = await deployV1WithToken(token.address);
      const tk = await mintApproved(auction);
      const aid = await auction.read.nextAuctionId();
      await auction.write.createAuction([nft.address, tk, 8760n], { account: seller.account });
      const a = await auction.read.auctions([aid]);
      assert.ok(Number(field(a, "endTime", 3)) > 0);
    });

    it("F6：duration 超上限（8761）revert（DurationTooLong）", async () => {
      const token = await viem.deployContract("MockERC20", ["U", "U", 6]);
      const auction = await deployV1WithToken(token.address);
      const tk = await mintApproved(auction);
      await assert.rejects(
        auction.write.createAuction([nft.address, tk, 8761n], { account: seller.account }),
        /duration too long|DurationTooLong|duration/i,
      );
    });

    it("F6：duration 极大值（会溢出）revert，不再触发算术溢出 Panic", async () => {
      const token = await viem.deployContract("MockERC20", ["U", "U", 6]);
      const auction = await deployV1WithToken(token.address);
      const tk = await mintApproved(auction);
      await assert.rejects(
        auction.write.createAuction([nft.address, tk, 2n ** 256n - 1n], { account: seller.account }),
        /duration too long|DurationTooLong|revert/i,
      );
    });
  });

  // ═══════════ 错误分支与边界（每用例独立环境 + 动态序号）═══════════
  describe("错误分支与边界", () => {
    let owner!: TestWallet, seller!: TestWallet, bidder1!: TestWallet, bidder2!: TestWallet;
    let publicClient!: PublicClient, testClient!: TestClient;

    before(async () => {
      ({ owner, seller, bidder1, bidder2 } = await getWallets());
      ({ publicClient, testClient } = await getClients());
    });

    async function freshAuctionAndNft(): Promise<{ auction: AuctionV1; nft: MyNft; token: MockErc20 }> {
      const env = await deployV1Env();
      return { auction: env.auction, nft: env.nft, token: env.token };
    }

    it("createAuction duration=0 revert（DurationInvalid）", async () => {
      const { auction, nft } = await freshAuctionAndNft();
      await nft.write.mint([seller.account.address], { account: owner.account });
      const tk = (await nft.read.totalSupply()) - 1n;
      await nft.write.approve([auction.address, tk], { account: seller.account });
      await assert.rejects(
        auction.write.createAuction([nft.address, tk, 0n], { account: seller.account }),
        /duration/i,
      );
    });

    it("bidWithEth 零出价 revert（ZeroBid）", async () => {
      const { auction } = await freshAuctionAndNft();
      await assert.rejects(
        auction.write.bidWithEth([1n], { account: bidder1.account, value: 0n }),
        /zero bid|bid/i,
      );
    });

    it("bidWithErc20 零出价 revert（ZeroBid）", async () => {
      const { auction } = await freshAuctionAndNft();
      await assert.rejects(
        auction.write.bidWithErc20([1n, 0n], { account: bidder1.account }),
        /zero bid|bid/i,
      );
    });

    it("bid 出价过低 revert（BidTooLow）", async () => {
      const { auction, nft } = await freshAuctionAndNft();
      await nft.write.mint([seller.account.address], { account: owner.account });
      const tk = (await nft.read.totalSupply()) - 1n;
      await nft.write.approve([auction.address, tk], { account: seller.account });
      await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });
      await auction.write.bidWithEth([1n], { account: bidder1.account, value: parseEther("1") });
      await assert.rejects(
        auction.write.bidWithEth([1n], { account: bidder2.account, value: parseEther("0.5") }),
        /bid too low|bid/i,
      );
    });

    it("ERC20 出价过低 revert（BidTooLow，声称量检查 line 265）", async () => {
      const { auction, nft, token } = await freshAuctionAndNft();
      await nft.write.mint([seller.account.address], { account: owner.account });
      const tk = (await nft.read.totalSupply()) - 1n;
      await nft.write.approve([auction.address, tk], { account: seller.account });
      await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });
      // 先建最高出价 1 ETH = 2000 USD
      await auction.write.bidWithEth([1n], { account: bidder1.account, value: parseEther("1") });
      // ERC20 100 USDC = 100 USD < 2000 → BidTooLow（用声称 amount 算的 bidUsd 检查）
      await token.write.mint([bidder2.account.address, 100_000000n]);
      await token.write.approve([auction.address, 100_000000n], { account: bidder2.account });
      await assert.rejects(
        auction.write.bidWithErc20([1n, 100_000000n], { account: bidder2.account }),
        /bid too low|BidTooLow/i,
      );
    });

    it("ERC20 通缩复核：声称价高于最高价但实到过低 revert（BidTooLow，receivedUsd 复核 line 281）", async () => {
      const fot = await viem.deployContract("FeeOnTransferERC20", ["FOT", "FOT", 6]);
      await fot.write.setFeeBp([5000n]); // 50% 通缩
      const auction = await deployV1WithToken(fot.address);
      const nft = await viem.deployContract("MyNFT", ["N", "N", "u"]);
      await nft.write.mint([seller.account.address], { account: owner.account });
      const tk = (await nft.read.totalSupply()) - 1n;
      await nft.write.approve([auction.address, tk], { account: seller.account });
      await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });
      // 最高出价 1 ETH = 2000 USD
      await auction.write.bidWithEth([1n], { account: bidder1.account, value: parseEther("1") });
      // 声称 3000 USDC（bidUsd 3000 > 2000，通过 line 265）；50% 通缩实到 1500（receivedUsd 1500 ≤ 2000 → line 281）
      await fot.write.mint([bidder2.account.address, 3000_000000n]);
      await fot.write.approve([auction.address, 3000_000000n], { account: bidder2.account });
      await assert.rejects(
        auction.write.bidWithErc20([1n, 3000_000000n], { account: bidder2.account }),
        /bid too low|BidTooLow/i,
      );
    });

    it("对不存在拍卖出价 revert（AuctionNotFound）", async () => {
      const { auction } = await freshAuctionAndNft();
      await assert.rejects(
        auction.write.bidWithEth([999n], { account: bidder1.account, value: parseEther("1") }),
        /auction not found|revert/i,
      );
    });

    it("ERC20 出价超越：被超过者退款记到 pendingErc20", async () => {
      const { auction, nft, token } = await freshAuctionAndNft();
      await nft.write.mint([seller.account.address], { account: owner.account });
      const tk = (await nft.read.totalSupply()) - 1n;
      await nft.write.approve([auction.address, tk], { account: seller.account });
      await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });
      await auction.write.bidWithEth([1n], { account: bidder1.account, value: parseEther("1") });

      await token.write.mint([bidder2.account.address, 5000_000000n]);
      await token.write.approve([auction.address, 5000_000000n], { account: bidder2.account });
      await auction.write.bidWithErc20([1n, 5000_000000n], { account: bidder2.account });
      assert.equal(await auction.read.pendingEth([bidder1.account.address]), parseEther("1"));
    });

    it("无人出价结算：卖家 claimNft 领回 + endAuction 重复 revert", async () => {
      const { auction, nft } = await freshAuctionAndNft();
      await nft.write.mint([seller.account.address], { account: owner.account });
      const tk = (await nft.read.totalSupply()) - 1n;
      await nft.write.approve([auction.address, tk], { account: seller.account });
      await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });

      await testClient.increaseTime({ seconds: 3600 });
      await testClient.mine({ blocks: 1 });
      await auction.write.endAuction([1n], { account: bidder1.account });
      await auction.write.claimNft([1n], { account: seller.account });
      assert.equal((await nft.read.ownerOf([tk])).toLowerCase(), seller.account.address.toLowerCase());
      await assert.rejects(
        auction.write.endAuction([1n], { account: bidder1.account }),
        /already ended|ended/i,
      );
    });

    it("endAuction 未到期 revert（AuctionNotOver）", async () => {
      const { auction, nft } = await freshAuctionAndNft();
      await nft.write.mint([seller.account.address], { account: owner.account });
      const tk = (await nft.read.totalSupply()) - 1n;
      await nft.write.approve([auction.address, tk], { account: seller.account });
      await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });
      await assert.rejects(
        auction.write.endAuction([1n], { account: bidder1.account }),
        /not over|over/i,
      );
    });

    it("withdraw 无可提取 revert（NothingToWithdraw）", async () => {
      const { auction } = await freshAuctionAndNft();
      await assert.rejects(
        auction.write.withdraw({ account: seller.account }),
        /nothing to withdraw|nothing/i,
      );
    });

    it("V1 结算 ETH（pull 记账给卖家）+ withdraw", async () => {
      const { auction, nft } = await freshAuctionAndNft();
      await nft.write.mint([seller.account.address], { account: owner.account });
      const tk = (await nft.read.totalSupply()) - 1n;
      await nft.write.approve([auction.address, tk], { account: seller.account });
      await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });
      await auction.write.bidWithEth([1n], { account: bidder1.account, value: parseEther("1") });
      await testClient.increaseTime({ seconds: 3600 });
      await testClient.mine({ blocks: 1 });
      await auction.write.endAuction([1n], { account: bidder2.account });
      assert.equal(await auction.read.pendingEth([seller.account.address]), parseEther("1"));
      const before = await publicClient.getBalance({ address: seller.account.address });
      await auction.write.withdraw({ account: seller.account });
      const after = await publicClient.getBalance({ address: seller.account.address });
      assert.ok(after - before > parseEther("0.99"));
    });

    it("initialize decimals 超限 revert（InvalidDecimals）", async () => {
      const { token, ethFeed, tokenFeed } = await deployV1Env();
      const impl = await viem.deployContract("NFTAuction");
      const badInit = encodeFunctionData({
        abi: impl.abi,
        functionName: "initialize",
        args: [ethFeed.address, token.address, tokenFeed.address, 19],
      });
      await assert.rejects(
        viem.deployContract("ERC1967Proxy", [impl.address, badInit]),
        /invalid decimals|decimals|revert/i,
      );
    });

    it("endAuction 对不存在拍卖 revert（AuctionNotFound）", async () => {
      const { auction } = await freshAuctionAndNft();
      await assert.rejects(
        auction.write.endAuction([999n], { account: bidder1.account }),
        /auction not found|revert/i,
      );
    });

    it("bidWithErc20 对不存在拍卖 revert（AuctionNotFound in _assertActive）", async () => {
      const { auction, token } = await freshAuctionAndNft();
      await token.write.mint([bidder1.account.address, 100_000000n]);
      await token.write.approve([auction.address, 100_000000n], { account: bidder1.account });
      await assert.rejects(
        auction.write.bidWithErc20([999n, 100_000000n], { account: bidder1.account }),
        /auction not found|revert/i,
      );
    });

    it("ERC20 withdraw 提取 pendingErc20", async () => {
      const { auction, nft, token } = await freshAuctionAndNft();
      await nft.write.mint([seller.account.address], { account: owner.account });
      const tk = (await nft.read.totalSupply()) - 1n;
      await nft.write.approve([auction.address, tk], { account: seller.account });
      const nextId = await auction.read.nextAuctionId();
      await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });

      await token.write.mint([bidder1.account.address, 1000_000000n]);
      await token.write.approve([auction.address, 1000_000000n], { account: bidder1.account });
      await auction.write.bidWithErc20([nextId, 1000_000000n], { account: bidder1.account });

      await testClient.increaseTime({ seconds: 3600 });
      await testClient.mine({ blocks: 1 });
      await auction.write.endAuction([nextId], { account: bidder2.account });

      assert.ok(Number(await auction.read.pendingErc20([seller.account.address])) > 0);
      const balBefore = await token.read.balanceOf([seller.account.address]);
      await auction.write.withdraw({ account: seller.account });
      const balAfter = await token.read.balanceOf([seller.account.address]);
      assert.ok(balAfter > balBefore);
      assert.equal(await auction.read.pendingErc20([seller.account.address]), 0n);
    });

    it("PriceConverter 非法价格 revert（answer<=0 → NegativePrice）", async () => {
      const badFeed = await viem.deployContract("MockPriceFeed", [8, 0n]);
      const { token, tokenFeed } = await deployV1Env();
      const impl = await viem.deployContract("NFTAuction");
      const initData = encodeFunctionData({
        abi: impl.abi,
        functionName: "initialize",
        args: [badFeed.address, token.address, tokenFeed.address, 6],
      });
      const proxy = await viem.deployContract("ERC1967Proxy", [impl.address, initData]);
      const aBad = await viem.getContractAt("NFTAuction", proxy.address);

      const nft = await viem.deployContract("MyNFT", ["N", "N", "u"]);
      await nft.write.mint([seller.account.address], { account: owner.account });
      const tk = (await nft.read.totalSupply()) - 1n;
      await nft.write.approve([aBad.address, tk], { account: seller.account });
      await aBad.write.createAuction([nft.address, tk, 1n], { account: seller.account });
      await assert.rejects(
        aBad.write.bidWithEth([1n], { account: bidder1.account, value: parseEther("1") }),
        /negative price|revert/i,
      );
    });

    it("PriceConverter 陈旧价格 revert（updatedAt 超 1h / round 不完整）", async () => {
      const staleFeed = await viem.deployContract("MockPriceFeed", [8, 2000_00000000n]);
      const { token, tokenFeed } = await deployV1Env();
      const impl = await viem.deployContract("NFTAuction");
      const initData = encodeFunctionData({
        abi: impl.abi,
        functionName: "initialize",
        args: [staleFeed.address, token.address, tokenFeed.address, 6],
      });
      const proxy = await viem.deployContract("ERC1967Proxy", [impl.address, initData]);
      const aStale = await viem.getContractAt("NFTAuction", proxy.address);

      const nft = await viem.deployContract("MyNFT", ["N", "N", "u"]);
      await nft.write.mint([seller.account.address], { account: owner.account });
      const tk = (await nft.read.totalSupply()) - 1n;
      await nft.write.approve([aStale.address, tk], { account: seller.account });
      await aStale.write.createAuction([nft.address, tk, 48n], { account: seller.account });

      await staleFeed.write.setRoundMeta([1n, 1n, 1n]);
      await assert.rejects(
        aStale.write.bidWithEth([1n], { account: bidder1.account, value: parseEther("1") }),
        /stale price|revert/i,
      );

      await staleFeed.write.setRoundMeta([5n, 1n, 1n]);
      await assert.rejects(
        aStale.write.bidWithEth([1n], { account: bidder1.account, value: parseEther("1") }),
        /stale price|revert/i,
      );
    });

    it("bid 已过期拍卖 revert（AuctionNotOver）", async () => {
      const { auction, nft } = await freshAuctionAndNft();
      await nft.write.mint([seller.account.address], { account: owner.account });
      const tk = (await nft.read.totalSupply()) - 1n;
      await nft.write.approve([auction.address, tk], { account: seller.account });
      await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });
      await testClient.increaseTime({ seconds: 3600 });
      await testClient.mine({ blocks: 1 });
      await assert.rejects(
        auction.write.bidWithEth([(await auction.read.nextAuctionId()) - 1n], {
          account: bidder1.account,
          value: parseEther("1"),
        }),
        /not over|over/i,
      );
    });

    it("bid 已结束拍卖 revert（AuctionAlreadyEnded）", async () => {
      const { auction, nft } = await freshAuctionAndNft();
      await nft.write.mint([seller.account.address], { account: owner.account });
      const tk = (await nft.read.totalSupply()) - 1n;
      await nft.write.approve([auction.address, tk], { account: seller.account });
      const nextId = await auction.read.nextAuctionId();
      await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });
      await auction.write.bidWithEth([nextId], { account: bidder1.account, value: parseEther("1") });
      await testClient.increaseTime({ seconds: 3600 });
      await testClient.mine({ blocks: 1 });
      await auction.write.endAuction([nextId], { account: bidder2.account });
      await assert.rejects(
        auction.write.bidWithEth([nextId], { account: bidder2.account, value: parseEther("2") }),
        /already ended|ended/i,
      );
    });

    it("claimNft：未结算时 revert（AuctionNotEnded）", async () => {
      const { auction, nft } = await freshAuctionAndNft();
      await nft.write.mint([seller.account.address], { account: owner.account });
      const tk = (await nft.read.totalSupply()) - 1n;
      await nft.write.approve([auction.address, tk], { account: seller.account });
      const nextId = await auction.read.nextAuctionId();
      await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });
      await assert.rejects(
        auction.write.claimNft([nextId], { account: seller.account }),
        /AuctionNotEnded|not ended/i,
      );
    });

    it("claimNft：非赢家/卖家 revert（NotWinnerOrSeller）+ 重复领 revert（NftAlreadyClaimed）", async () => {
      const { auction, nft } = await freshAuctionAndNft();
      await nft.write.mint([seller.account.address], { account: owner.account });
      const tk = (await nft.read.totalSupply()) - 1n;
      await nft.write.approve([auction.address, tk], { account: seller.account });
      const nextId = await auction.read.nextAuctionId();
      await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });
      await auction.write.bidWithEth([nextId], { account: bidder1.account, value: parseEther("1") });
      await testClient.increaseTime({ seconds: 3600 });
      await testClient.mine({ blocks: 1 });
      await auction.write.endAuction([nextId], { account: bidder2.account });

      await assert.rejects(
        auction.write.claimNft([nextId], { account: bidder2.account }),
        /NotWinnerOrSeller|winner|seller/i,
      );
      await auction.write.claimNft([nextId], { account: bidder1.account });
      assert.equal((await nft.read.ownerOf([tk])).toLowerCase(), bidder1.account.address.toLowerCase());
      assert.equal(await auction.read.nftClaimed([nextId]), true);
      await assert.rejects(
        auction.write.claimNft([nextId], { account: bidder1.account }),
        /NftAlreadyClaimed|already claimed/i,
      );
    });
  });
});
