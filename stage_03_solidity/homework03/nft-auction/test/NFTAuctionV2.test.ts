// NFTAuctionV2 测试：UUPS 升级 + 平台手续费 + N2/N3/N4（升级抢跑、事件）+ V2 ERC20 结算
// 吸收自原 NFTAuctionV2 / SubagentFindings 测试 + Coverage 的 V2 子集。
import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { decodeEventLog, encodeFunctionData, parseEther } from "viem";
import type { Hash, Log, PublicClient, TestClient } from "viem";
import {
  deployV1Env,
  deployV1WithToken,
  field,
  getClients,
  getWallets,
  newNft,
  viem,
  type AuctionV1,
  type AuctionV2,
  type Erc1967Proxy,
  type MockErc20,
  type MockPriceFeed,
  type MyNft,
  type TestWallet,
} from "./helpers";

describe("NFTAuctionV2", () => {
  // ═══════════ UUPS 升级 + 平台手续费（顺序：先建 V1 状态，再升级）═══════════
  describe("UUPS 升级 + 平台手续费", () => {
    let owner!: TestWallet, seller!: TestWallet, bidder1!: TestWallet, bidder2!: TestWallet;
    let publicClient!: PublicClient, testClient!: TestClient;
    let nft!: MyNft, token!: MockErc20;
    let auctionV1!: AuctionV1, auctionV2!: AuctionV2;
    let implV1!: AuctionV1, implV2!: AuctionV2;
    let proxy!: Erc1967Proxy;
    let ethFeed!: MockPriceFeed, tokenFeed!: MockPriceFeed;

    before(async () => {
      ({ owner, seller, bidder1, bidder2 } = await getWallets());
      ({ publicClient, testClient } = await getClients());
      const env = await deployV1Env();
      auctionV1 = env.auction;
      nft = env.nft;
      token = env.token;
      proxy = env.proxy;
      implV1 = env.implV1;
      ethFeed = env.ethFeed;
      tokenFeed = env.tokenFeed;
      implV2 = await viem.deployContract("NFTAuctionV2");

      // V1 阶段：建一场拍卖 + 出价（升级后验证数据不丢）
      await nft.write.mint([seller.account.address], { account: owner.account }); // NFT #0
      await nft.write.approve([auctionV1.address, 0n], { account: seller.account });
      await auctionV1.write.createAuction([nft.address, 0n, 24n], { account: seller.account }); // auction #1
      await auctionV1.write.bidWithEth([1n], { account: bidder1.account, value: parseEther("1") });
    });

    it("升级前：V1 拍卖数据已存在（auctionId=1）", async () => {
      const a = await auctionV1.read.auctions([1n]);
      assert.equal((field(a, "highestBidder", 4) as string).toLowerCase(), bidder1.account.address.toLowerCase());
      assert.equal(field(a, "highestBidAmount", 6) as bigint, parseEther("1"));
    });

    it("owner 执行 UUPS 升级到 V2（upgradeToAndCall + initializeV2）", async () => {
      const initV2Data = encodeFunctionData({ abi: implV2.abi, functionName: "initializeV2", args: [300n] });
      await auctionV1.write.upgradeToAndCall([implV2.address, initV2Data], { account: owner.account });
      auctionV2 = await viem.getContractAt("NFTAuctionV2", proxy.address);
      const proxyContract = await viem.getContractAt("ERC1967Proxy", proxy.address);
      assert.equal((await proxyContract.read.implementation()).toLowerCase(), implV2.address.toLowerCase());
    });

    it("version() 返回 'v2'", async () => {
      assert.equal(await auctionV2.read.version(), "v2");
    });

    it("platformFeeBp 已通过 initializeV2 设置为 300", async () => {
      assert.equal(Number(await auctionV2.read.platformFeeBp()), 300);
    });

    it("initializeV2 缓存了两个 feed 的 decimals（Gas 优化，==8）", async () => {
      assert.equal(Number(await auctionV2.read.ethUsdFeedDecimals()), 8);
      assert.equal(Number(await auctionV2.read.paymentTokenUsdFeedDecimals()), 8);
    });

    it("升级后 V1 配置完整保留（ethUsdFeed / paymentToken / decimals）", async () => {
      assert.equal((await auctionV2.read.ethUsdFeed()).toLowerCase(), ethFeed.address.toLowerCase());
      assert.equal((await auctionV2.read.paymentToken()).toLowerCase(), token.address.toLowerCase());
      assert.equal(Number(await auctionV2.read.paymentTokenDecimals()), 6);
    });

    it("升级后 V1 拍卖数据完整保留（bidder1 的 1 ETH 出价）", async () => {
      const a = await auctionV2.read.auctions([1n]);
      assert.equal((field(a, "seller", 0) as string).toLowerCase(), seller.account.address.toLowerCase());
      assert.equal((field(a, "highestBidder", 4) as string).toLowerCase(), bidder1.account.address.toLowerCase());
      assert.equal(field(a, "highestBidAmount", 6) as bigint, parseEther("1"));
      assert.equal(field(a, "ended", 8), false);
    });

    it("V2 ETH 结算：pull 记账，pendingEth[owner] 收 3% 手续费、pendingEth[seller] 收剩余", async () => {
      await auctionV2.write.bidWithEth([1n], { account: bidder2.account, value: parseEther("2") });
      await testClient.increaseTime({ seconds: 24 * 3600 + 1 });
      await testClient.mine({ blocks: 1 });
      await auctionV2.write.endAuction([1n], { account: bidder2.account });
      assert.equal(await auctionV2.read.pendingEth([owner.account.address]), parseEther("0.06"));
      assert.equal(await auctionV2.read.pendingEth([seller.account.address]), parseEther("1.94"));
      assert.equal((await nft.read.ownerOf([0n])).toLowerCase(), auctionV2.address.toLowerCase());
      await auctionV2.write.claimNft([1n], { account: bidder2.account });
      assert.equal((await nft.read.ownerOf([0n])).toLowerCase(), bidder2.account.address.toLowerCase());
    });

    it("owner withdraw 提取 0.06 ETH 手续费", async () => {
      const before = await publicClient.getBalance({ address: owner.account.address });
      await auctionV2.write.withdraw({ account: owner.account });
      const after = await publicClient.getBalance({ address: owner.account.address });
      assert.ok(after - before > parseEther("0.059"));
      assert.equal(await auctionV2.read.pendingEth([owner.account.address]), 0n);
    });

    it("seller withdraw 提取 1.94 ETH", async () => {
      const before = await publicClient.getBalance({ address: seller.account.address });
      await auctionV2.write.withdraw({ account: seller.account });
      const after = await publicClient.getBalance({ address: seller.account.address });
      assert.ok(after - before > parseEther("1.93"));
      assert.equal(await auctionV2.read.pendingEth([seller.account.address]), 0n);
    });

    it("V2 ERC20 结算：pull 记账，pendingErc20[owner] 收手续费、pendingErc20[seller] 收剩余", async () => {
      await nft.write.mint([seller.account.address], { account: owner.account }); // #1
      await nft.write.approve([auctionV2.address, 1n], { account: seller.account });
      await auctionV2.write.createAuction([nft.address, 1n, 1n], { account: seller.account }); // auction #2

      await token.write.mint([bidder1.account.address, 2000_000000n]);
      await token.write.approve([auctionV2.address, 2000_000000n], { account: bidder1.account });
      await auctionV2.write.bidWithErc20([2n, 2000_000000n], { account: bidder1.account });

      await testClient.increaseTime({ seconds: 3600 });
      await testClient.mine({ blocks: 1 });
      await auctionV2.write.endAuction([2n], { account: bidder2.account });
      assert.equal(await auctionV2.read.pendingErc20([owner.account.address]), 60_000000n);
      assert.equal(await auctionV2.read.pendingErc20([seller.account.address]), 1940_000000n);
    });

    it("owner 可更新 platformFeeBp", async () => {
      await auctionV2.write.setPlatformFee([500n], { account: owner.account });
      assert.equal(Number(await auctionV2.read.platformFeeBp()), 500);
    });

    it("setPlatformFee 超出 10000 时 revert", async () => {
      await assert.rejects(
        auctionV2.write.setPlatformFee([10001n], { account: owner.account }),
        /FeeTooHigh/i,
      );
    });

    it("MAX_PLATFORM_FEE_BP = 2500：正好 2500 通过，2501 revert", async () => {
      assert.equal(await auctionV2.read.MAX_PLATFORM_FEE_BP(), 2500n);
      await auctionV2.write.setPlatformFee([2500n], { account: owner.account });
      assert.equal(Number(await auctionV2.read.platformFeeBp()), 2500);
      await assert.rejects(
        auctionV2.write.setPlatformFee([2501n], { account: owner.account }),
        /FeeTooHigh/i,
      );
    });

    it("非 owner 调用 setPlatformFee revert", async () => {
      await assert.rejects(
        auctionV2.write.setPlatformFee([100n], { account: bidder1.account }),
        /OwnableUnauthorizedAccount|ownable/i,
      );
    });

    it("initializeV2 不可重复调用（reinitializer(2)）", async () => {
      await assert.rejects(
        auctionV2.write.initializeV2([100n], { account: owner.account }),
        /InvalidInitialization|already initialized|reinitializer/i,
      );
    });

    it("initializeV2 fee 超限时 revert（新代理验证）", async () => {
      const tk = await viem.deployContract("MockERC20", ["U", "U", 6]);
      const auction = await deployV1WithToken(tk.address);
      const newImplV2 = await viem.deployContract("NFTAuctionV2");
      const badInit = encodeFunctionData({ abi: newImplV2.abi, functionName: "initializeV2", args: [10001n] });
      await assert.rejects(
        auction.write.upgradeToAndCall([newImplV2.address, badInit], { account: owner.account }),
        /FeeTooHigh/i,
      );
    });

    it("MAX_FEE_BP 常量 = 10000", async () => {
      assert.equal(await auctionV2.read.MAX_FEE_BP(), 10000n);
    });
  });

  // ═══════════ N2 / N3 / N4：升级抢跑 + 事件正确性 ═══════════
  describe("N2 / N3 / N4：升级抢跑 + 事件", () => {
    let owner!: TestWallet, seller!: TestWallet, bidder1!: TestWallet, bidder2!: TestWallet;
    let testClient!: TestClient, publicClient!: PublicClient;
    let nft!: MyNft, token!: MockErc20;
    let nftAuctionAbi!: AuctionV1["abi"];

    before(async () => {
      ({ owner, seller, bidder1, bidder2 } = await getWallets());
      ({ testClient, publicClient } = await getClients());
      token = await viem.deployContract("MockERC20", ["U", "U", 6]);
      nft = await viem.deployContract("MyNFT", ["N", "N", "https://a/"]);
      const impl0 = await viem.deployContract("NFTAuction");
      nftAuctionAbi = impl0.abi;
    });

    // 在 receipt 里找指定事件（用 NFTAuction abi 解码）
    async function findEvent(receipt: { logs: readonly Log[] }, name: string): Promise<{ eventName: string; args: unknown } | null> {
      for (const log of receipt.logs) {
        try {
          const d = decodeEventLog({ abi: nftAuctionAbi, data: log.data, topics: log.topics });
          if (d.eventName === name) return { eventName: d.eventName, args: d.args as unknown };
        } catch {
          /* 该 log 不匹配任何已知事件，跳过 */
        }
      }
      return null;
    }

    it("N2：非 owner 调 initializeV2 revert（OwnableUnauthorizedAccount，防升级抢跑）", async () => {
      const auction = await deployV1WithToken(token.address);
      const implV2 = await viem.deployContract("NFTAuctionV2");
      const initV2 = encodeFunctionData({ abi: implV2.abi, functionName: "initializeV2", args: [300n] });
      await auction.write.upgradeToAndCall([implV2.address, initV2], { account: owner.account });
      const v2 = await viem.getContractAt("NFTAuctionV2", auction.address);
      await assert.rejects(
        v2.write.initializeV2([500n], { account: bidder1.account }),
        /OwnableUnauthorizedAccount|ownable/i,
      );
    });

    it("N3：通缩代币出价，BidPlaced 事件 amount == 实到 received（非声称量）", async () => {
      const fot = await viem.deployContract("FeeOnTransferERC20", ["FOT", "FOT", 6]);
      const auction = await deployV1WithToken(fot.address);

      const tk = await newNft(nft, auction.address, owner, seller);
      await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });
      const aid = (await auction.read.nextAuctionId()) - 1n;

      await fot.write.mint([bidder1.account.address, 1000_000000n]);
      await fot.write.approve([auction.address, 1000_000000n], { account: bidder1.account });
      const tx = await auction.write.bidWithErc20([aid, 1000_000000n], { account: bidder1.account });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx as Hash });

      const ev = await findEvent(receipt, "BidPlaced");
      assert.ok(ev, "应有 BidPlaced 事件");
      // 通缩 1%：声称 1000，实到 990。事件 amount 与 bidUsd 均为实到量
      assert.equal(field(ev!.args, "amount", 2) as bigint, 990_000000n);
      assert.equal(field(ev!.args, "bidUsd", 3) as bigint, parseEther("990"));
    });

    it("N4：reclaimNft 触发 NftRefunded 事件（退款给赢家，金额对链下可观测）", async () => {
      const auction = await deployV1WithToken(token.address);
      const tk = await newNft(nft, auction.address, owner, seller);
      await auction.write.createAuction([nft.address, tk, 1n], { account: seller.account });
      const aid = (await auction.read.nextAuctionId()) - 1n;
      await auction.write.bidWithEth([aid], { account: bidder1.account, value: parseEther("1") });

      await testClient.increaseTime({ seconds: 3600 });
      await testClient.mine({ blocks: 1 });
      await auction.write.endAuction([aid], { account: bidder2.account });
      await testClient.increaseTime({ seconds: 7 * 24 * 3600 + 1 });
      await testClient.mine({ blocks: 1 });

      const tx = await auction.write.reclaimNft([aid], { account: seller.account });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx as Hash });

      const ev = await findEvent(receipt, "NftRefunded");
      assert.ok(ev, "reclaimNft 应触发 NftRefunded 事件");
      assert.equal((field(ev!.args, "winner", 1) as string).toLowerCase(), bidder1.account.address.toLowerCase());
      assert.equal(field(ev!.args, "amount", 2) as bigint, parseEther("1"));
    });
  });

  // ═══════════ Coverage：V2 ERC20 结算（独立环境）═══════════
  describe("Coverage：V2 升级后 ERC20 结算 pull 记账", () => {
    let owner!: TestWallet, seller!: TestWallet, bidder1!: TestWallet, bidder2!: TestWallet;
    let testClient!: TestClient;

    before(async () => {
      ({ owner, seller, bidder1, bidder2 } = await getWallets());
      ({ testClient } = await getClients());
    });

    it("升级到 V2：ERC20 结算 pull 记账（owner 手续费 + seller 剩余）", async () => {
      const env = await deployV1Env();
      const implV2 = await viem.deployContract("NFTAuctionV2");
      const initV2 = encodeFunctionData({ abi: implV2.abi, functionName: "initializeV2", args: [300n] });
      await env.auction.write.upgradeToAndCall([implV2.address, initV2], { account: owner.account });
      const v2 = await viem.getContractAt("NFTAuctionV2", env.proxy.address);

      await env.nft.write.mint([seller.account.address], { account: owner.account });
      const tk = (await env.nft.read.totalSupply()) - 1n;
      await env.nft.write.approve([v2.address, tk], { account: seller.account });
      await v2.write.createAuction([env.nft.address, tk, 1n], { account: seller.account });

      await env.token.write.mint([bidder1.account.address, 2000_000000n]);
      await env.token.write.approve([v2.address, 2000_000000n], { account: bidder1.account });
      await v2.write.bidWithErc20([1n, 2000_000000n], { account: bidder1.account });

      await testClient.increaseTime({ seconds: 3600 });
      await testClient.mine({ blocks: 1 });
      await v2.write.endAuction([1n], { account: bidder2.account });
      assert.equal(await v2.read.pendingErc20([owner.account.address]), 60_000000n);
      assert.equal(await v2.read.pendingErc20([seller.account.address]), 1940_000000n);
    });
  });
});
