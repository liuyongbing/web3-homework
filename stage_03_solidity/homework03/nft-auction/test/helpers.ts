// 测试共享夹具与类型：消除各测试文件里重复的部署代码与 any 类型。
// 合约实例类型来自 hardhat 为每个合约生成的 ArtifactMap
// （artifacts/contracts/<C>.sol/artifacts.d.ts 经 `declare module "hardhat/types/artifacts"` 填充）。
import hre from "hardhat";
import { encodeFunctionData } from "viem";
import type { Account, Address, PublicClient, TestClient, WalletClient } from "viem";
import type { ContractReturnType } from "@nomicfoundation/hardhat-viem/types";

const connection = await hre.network.getOrCreate();
export const viem = connection.viem;

// ─── 类型别名 ───
export type TestWallet = WalletClient & { account: Account };
export type AuctionV1 = ContractReturnType<"NFTAuction">;
export type AuctionV2 = ContractReturnType<"NFTAuctionV2">;
export type AuctionV3 = ContractReturnType<"NFTAuctionV3">;
export type AnyAuction = AuctionV1 | AuctionV2 | AuctionV3;
export type MyNft = ContractReturnType<"MyNFT">;
export type MockErc20 = ContractReturnType<"MockERC20">;
export type MockPriceFeed = ContractReturnType<"MockPriceFeed">;
export type Erc1967Proxy = ContractReturnType<"ERC1967Proxy">;

export const SEVEN_DAYS = 7n * 24n * 3600n;

// ─── 工具 ───
// viem read 返回的 struct 可能是数组或对象（取决于 ABI output 形态），双形态安全访问。
// 调用点用 `as Address` / `as bigint` 收口具体类型。
export function field<T>(a: T, key: string, idx: number): unknown {
  const obj = a as Record<string, unknown>;
  const arr = a as unknown as unknown[];
  return obj[key] ?? arr[idx];
}

export async function getWallets(): Promise<{
  owner: TestWallet;
  seller: TestWallet;
  bidder1: TestWallet;
  bidder2: TestWallet;
  author: TestWallet;
}> {
  const [owner, seller, bidder1, bidder2, author] = (await viem.getWalletClients()) as TestWallet[];
  return { owner, seller, bidder1, bidder2, author };
}

export async function getClients(): Promise<{ publicClient: PublicClient; testClient: TestClient }> {
  return { publicClient: await viem.getPublicClient(), testClient: await viem.getTestClient() };
}

// ─── 夹具：基础设施 ───
export async function deployInfra(): Promise<{
  ethFeed: MockPriceFeed;
  tokenFeed: MockPriceFeed;
  token: MockErc20;
  nft: MyNft;
}> {
  const ethFeed = await viem.deployContract("MockPriceFeed", [8, 2000_00000000n]);
  const tokenFeed = await viem.deployContract("MockPriceFeed", [8, 1_00000000n]);
  const token = await viem.deployContract("MockERC20", ["U", "U", 6]);
  const nft = await viem.deployContract("MyNFT", ["MyNFT", "MNFT", "https://a/"]);
  return { ethFeed, tokenFeed, token, nft };
}

// ─── 夹具：拍卖合约 ───
// 用指定 paymentToken 地址部署一个 V1 代理（支持通缩/自定义 token，如 FeeOnTransferERC20）。
export async function deployV1WithToken(tokenAddress: Address): Promise<AuctionV1> {
  const ethFeed = await viem.deployContract("MockPriceFeed", [8, 2000_00000000n]);
  const tokenFeed = await viem.deployContract("MockPriceFeed", [8, 1_00000000n]);
  const impl = await viem.deployContract("NFTAuction");
  const initData = encodeFunctionData({
    abi: impl.abi,
    functionName: "initialize",
    args: [ethFeed.address, tokenAddress, tokenFeed.address, 6],
  });
  const proxy = await viem.deployContract("ERC1967Proxy", [impl.address, initData]);
  return viem.getContractAt("NFTAuction", proxy.address);
}

// 标准 V1 环境（infra + 实现 + 代理 + initialize）。
export async function deployV1Env(): Promise<{
  auction: AuctionV1;
  proxy: Erc1967Proxy;
  implV1: AuctionV1;
  ethFeed: MockPriceFeed;
  tokenFeed: MockPriceFeed;
  token: MockErc20;
  nft: MyNft;
}> {
  const { ethFeed, tokenFeed, token, nft } = await deployInfra();
  const implV1 = await viem.deployContract("NFTAuction");
  const initData = encodeFunctionData({
    abi: implV1.abi,
    functionName: "initialize",
    args: [ethFeed.address, token.address, tokenFeed.address, 6],
  });
  const proxy = await viem.deployContract("ERC1967Proxy", [implV1.address, initData]);
  const auction = await viem.getContractAt("NFTAuction", proxy.address);
  return { auction, proxy, implV1, ethFeed, tokenFeed, token, nft };
}

export async function upgradeToV2(auctionV1: AuctionV1, owner: TestWallet, feeBp: bigint): Promise<AuctionV2> {
  const impl = await viem.deployContract("NFTAuctionV2");
  const initV2 = encodeFunctionData({ abi: impl.abi, functionName: "initializeV2", args: [feeBp] });
  await auctionV1.write.upgradeToAndCall([impl.address, initV2], { account: owner.account });
  return viem.getContractAt("NFTAuctionV2", auctionV1.address);
}

export async function upgradeToV3(auctionV1: AuctionV1, owner: TestWallet, feeBp: bigint): Promise<AuctionV3> {
  const impl = await viem.deployContract("NFTAuctionV3");
  const initV2 = encodeFunctionData({ abi: impl.abi, functionName: "initializeV2", args: [feeBp] });
  await auctionV1.write.upgradeToAndCall([impl.address, initV2], { account: owner.account });
  return viem.getContractAt("NFTAuctionV3", auctionV1.address);
}

// 部署已升级到 V3 的代理 + infra（owner 自动从 getWallets 取）。
export async function deployV3(feeBp: bigint): Promise<{
  auctionV3: AuctionV3;
  auction: AuctionV1;
  nft: MyNft;
  token: MockErc20;
  ethFeed: MockPriceFeed;
  tokenFeed: MockPriceFeed;
}> {
  const env = await deployV1Env();
  const { owner } = await getWallets();
  const auctionV3 = await upgradeToV3(env.auction, owner, feeBp);
  return {
    auctionV3,
    auction: env.auction,
    nft: env.nft,
    token: env.token,
    ethFeed: env.ethFeed,
    tokenFeed: env.tokenFeed,
  };
}

// ─── 生命周期工具 ───
// mint 一个 NFT 给 seller 并 approve 给 auction，返回新 tokenId（动态读取，避免硬编码序号）。
export async function newNft(nft: MyNft, auction: Address, owner: TestWallet, seller: TestWallet): Promise<bigint> {
  const tk = await nft.read.totalSupply();
  await nft.write.mint([seller.account.address], { account: owner.account });
  await nft.write.approve([auction, tk], { account: seller.account });
  return tk;
}

// 推进时间到期。调用方随后自行 endAuction（避免 union 合约类型的 write 推断问题）。
export async function advanceToEnd(testClient: TestClient): Promise<void> {
  await testClient.increaseTime({ seconds: 3600 });
  await testClient.mine({ blocks: 1 });
}

// 结算后再推进到可 reclaim 时刻（满 NFT_RECLAIM_DELAY）。
export async function advanceToReclaim(testClient: TestClient): Promise<void> {
  await testClient.increaseTime({ seconds: Number(SEVEN_DAYS) + 1 });
  await testClient.mine({ blocks: 1 });
}
