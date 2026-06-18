// UUPS 升级脚本：把已部署的代理升级到 V2 或 V3
//
// 用法：
//   升级到 V2：
//     PROXY_ADDRESS=0x... TARGET_VERSION=v2 npx hardhat run scripts/upgrade.ts --network sepolia
//   升级到 V3（从 V2 升级，不再调 initializeV2）：
//     PROXY_ADDRESS=0x... TARGET_VERSION=v3 npx hardhat run scripts/upgrade.ts --network sepolia
//   从 V1 直接跳到 V3（一步到位）：
//     PROXY_ADDRESS=0x... TARGET_VERSION=v3 npx hardhat run scripts/upgrade.ts --network sepolia
//
//   可选覆盖平台费：PLATFORM_FEE_BP=500（默认 300，仅 V1→V2 时使用）
//   本地演示（不传 PROXY_ADDRESS 自动部署 V1）：npx hardhat run scripts/upgrade.ts
import hre from "hardhat";
import { encodeFunctionData } from "viem";

async function main() {
  const connection = await hre.network.getOrCreate();
  const viem = connection.viem;
  const [owner] = await viem.getWalletClients();

  const targetVersion = (process.env.TARGET_VERSION ?? "v2").toLowerCase(); // "v2" | "v3"
  const platformFeeBp = BigInt(process.env.PLATFORM_FEE_BP ?? "300");

  let proxyAddress = process.env.PROXY_ADDRESS as `0x${string}` | undefined;

  // ── 演示模式：没给代理地址，在本地先部署一套 V1 ──
  if (!proxyAddress) {
    console.log("⚠️  未设置 PROXY_ADDRESS，本地演示：先部署一套 V1...");
    const ethFeed = await viem.deployContract("MockPriceFeed", [8, 2000_00000000n]);
    const tokenFeed = await viem.deployContract("MockPriceFeed", [8, 1_00000000n]);
    const token = await viem.deployContract("MockERC20", ["U", "U", 6]);
    const implV1 = await viem.deployContract("NFTAuction");
    const initData = encodeFunctionData({
      abi: implV1.abi,
      functionName: "initialize",
      args: [ethFeed.address, token.address, tokenFeed.address, 6],
    });
    const proxy = await viem.deployContract("ERC1967Proxy", [implV1.address, initData]);
    proxyAddress = proxy.address;
    console.log("V1 代理已部署:", proxyAddress);
  }

  // ── 读取当前版本 ──
  const current = await viem.getContractAt("NFTAuction", proxyAddress);
  const currentVersion = await current.read.version();
  console.log(`当前版本: ${currentVersion}，目标版本: ${targetVersion.toUpperCase()}`);

  // ── 部署目标实现合约 ──
  const contractName = targetVersion === "v3" ? "NFTAuctionV3" : "NFTAuctionV2";
  const impl = await viem.deployContract(contractName as "NFTAuctionV2");
  console.log(`${targetVersion.toUpperCase()} 实现已部署:`, impl.address);

  // ── 判断是否需要调 initializeV2 ──
  //    - V1 → V2/V3：需要 upgradeToAndCall + initializeV2（reinitializer(2) 只能调一次）
  //    - V2 → V3：只需 upgradeTo（initializeV2 已调过，再调会 revert）
  const needsInitV2 = currentVersion === "v1";

  // 获取 public client 用于等待交易确认（测试网/主网 write 只返回 hash，需手动等 receipt）
  const publicClient = await viem.getPublicClient();

  if (needsInitV2) {
    // V1 → Vx：编码 initializeV2 并通过 upgradeToAndCall 执行
    const initV2Data = encodeFunctionData({
      abi: impl.abi,
      functionName: "initializeV2",
      args: [platformFeeBp],
    });
    const txHash = await current.write.upgradeToAndCall([impl.address, initV2Data], {
      account: owner.account,
    });
    console.log(`广播 upgradeToAndCall (hash: ${txHash})，等待确认…`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      throw new Error(`upgradeToAndCall 交易失败 (status: ${receipt.status})`);
    }
    console.log(`✅ upgradeToAndCall 已上链确认（实现 → ${targetVersion.toUpperCase()}，platformFeeBp=${platformFeeBp}）`);
  } else {
    // V2 → V3：仅换实现，不重新初始化（OZ v5 无 upgradeTo，用空 calldata 的 upgradeToAndCall）
    const txHash = await current.write.upgradeToAndCall([impl.address, "0x"], {
      account: owner.account,
    });
    console.log(`广播 upgradeToAndCall (hash: ${txHash})，等待确认…`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      throw new Error(`upgradeToAndCall 交易失败 (status: ${receipt.status})`);
    }
    console.log(`✅ upgradeToAndCall(空data) 已上链确认（实现 → ${targetVersion.toUpperCase()}，保留已有 platformFeeBp）`);
  }

  // ── 验证升级结果 ──
  const upgraded = await viem.getContractAt(contractName as "NFTAuctionV2", proxyAddress);
  console.log("version():", await upgraded.read.version());
  console.log("platformFeeBp():", (await upgraded.read.platformFeeBp()).toString());
  console.log("代理地址（用户继续用这个）:", proxyAddress);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
