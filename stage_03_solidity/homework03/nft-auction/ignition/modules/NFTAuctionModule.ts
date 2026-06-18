// Ignition 部署模块：声明式描述「部署什么 + 依赖关系」，Ignition 自动排序/续传。
// ✅ 一个模块通吃本地 / 测试网 / 主网：
//   - 本地（链上无真实 ERC20 / Chainlink 合约）：
//       USE_MOCKS=true npx hardhat ignition deploy ignition/modules/NFTAuctionModule.ts --network localhost
//     模块自动部署 MockPriceFeed×2 + MockERC20 充当预言机与出价代币。
//   - 测试网 / 主网：
//       npx hardhat ignition deploy ignition/modules/NFTAuctionModule.ts --network <sepolia|mainnet> \
//         --parameters paymentToken=0x<ERC20地址> paymentTokenUsdFeed=0x<该ERC20的USD feed>
//     （mainnet 必须额外用 --parameters ethUsdFeed=0x<主网ETH/USD feed> 覆盖默认的 Sepolia 地址）
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import type { ArgumentType } from "@nomicfoundation/ignition-core";

// Sepolia 上的真实 Chainlink ETH/USD Price Feed（仅生产模式默认值；本地 mock 模式不会用到）
const SEPOLIA_ETH_USD_FEED = "0x694AA1769357215DE4FAC081bf1f309aDC325306";
const ZERO = "0x0000000000000000000000000000000000000000";

export default buildModule("NFTAuctionModule", (m) => {
  const useMocks = process.env.USE_MOCKS === "true";

  // 预言机 + 出价代币：本地用 mock，生产用 --parameters 传入的真实地址
  let ethUsdFeed: ArgumentType;
  let paymentToken: ArgumentType;
  let paymentTokenUsdFeed: ArgumentType;
  let paymentTokenDecimals: ArgumentType;

  if (useMocks) {
    // 本地模式：ETH=2000 USD、token=1 USD（8 decimals feed）；token 6 decimals
    ethUsdFeed = m.contract("MockPriceFeed", [8, 2000_00000000n], { id: "MockEthUsdFeed" });
    paymentTokenUsdFeed = m.contract("MockPriceFeed", [8, 1_00000000n], { id: "MockTokenUsdFeed" });
    paymentToken = m.contract("MockERC20", ["U", "U", 6]);
    paymentTokenDecimals = 6;
  } else {
    // 生产模式：paymentToken / paymentTokenUsdFeed 必须传【非零】真实地址，否则 initialize revert
    ethUsdFeed = m.getParameter("ethUsdFeed", SEPOLIA_ETH_USD_FEED);
    paymentToken = m.getParameter("paymentToken", ZERO);
    paymentTokenUsdFeed = m.getParameter("paymentTokenUsdFeed", ZERO);
    paymentTokenDecimals = m.getParameter("paymentTokenDecimals", 6);
  }

  // 1. NFT 合约（拍卖标的）
  const nft = m.contract("MyNFT", ["MyNFT", "MNFT", "https://api.example.com/"]);

  // 2. NFTAuction 实现合约（UUPS 可升级逻辑）
  const impl = m.contract("NFTAuction");

  // 3. 编码 initialize，部署 ERC1967 代理（构造时 delegatecall initialize 完成一次性初始化）
  const initData = m.encodeFunctionCall(impl, "initialize", [
    ethUsdFeed,
    paymentToken,
    paymentTokenUsdFeed,
    paymentTokenDecimals,
  ]);
  const proxy = m.contract("ERC1967Proxy", [impl, initData], { id: "AuctionProxy" });

  // proxy 是用户/前端要用的「合约地址」
  return { nft, impl, proxy };
});
