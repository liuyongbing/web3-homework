# NFT Auction —— NFT 拍卖合约（UUPS 可升级）

一个支持 **ETH / ERC20 双币种出价**、用 **Chainlink 预言机**统一按美元比价的 NFT 英式拍卖合约。采用 **UUPS 可升级**架构（V1 基础拍卖 → V2 平台手续费 → V3 ERC2981 版税），资金全程 **pull（提取）模式**，并经过三轮独立安全审计。

- Solidity `^0.8.28` · OpenZeppelin Contracts 5.6 · Chainlink Price Feeds
- 测试 **119 passing**（5 Foundry Solidity + 114 Hardhat/viem）
- 经过三轮独立安全审计（F1–F8 + N1–N4 全部修复）

---

## 核心特性

- **英式拍卖**：出价的 USD 价值必须严格高于当前最高出价，价高者得。
- **双币种出价**：支持 ETH 与 ERC20（如稳定币）混合出价；也可在创建拍卖时**锁定单一币种**，消除跨币种套利（F2）。
- **Chainlink 预言机**：经 `library/PriceConverter.sol` 把 ETH / ERC20 出价换算成统一 18 位精度 USD 比较，并对价格做完整性 / 陈旧性校验。
- **Pull 模式资金**：出价退款与结算分账都先记账（`pendingEth` / `pendingErc20`），收款方主动 `withdraw`，彻底规避「毒出价者拒收 ETH 卡死拍卖」的 push 模式 DoS。
- **NFT pull 出站 + 超时回收**：赢家主动 `claimNft` 领取；逾期未领满 7 天，卖家可 `reclaimNft` 回收并退款保护（F7）。
- **UUPS 可升级**：V1 → V2 → V3 增量演进，新状态变量严格「追加」在末尾，不破坏已有存储布局。
- **多层防御**：`nonReentrant`、CEI 顺序、自定义错误省 gas、紧急 `pause`、版税硬上限、`royaltyInfo` 子调用 gas cap。

---

## 合约版本演进

| 版本 | 合约 | 相对上一版新增 |
| --- | --- | --- |
| V1 | `NFTAuction.sol` | 基础拍卖：创建 / 出价 / 结束 / 领取 / 回收 / 提现；Chainlink 换算；pull 模式；单币种锁定（F2）；NFT 超时回收（F7） |
| V2 | `NFTAuctionV2.sol` | 平台手续费 `platformFeeBp`（上限 25%）；缓存 feed decimals 省 gas（`initializeV2` 一次设置） |
| V3 | `NFTAuctionV3.sol` | ERC2981 作者版税（硬上限 10%）；`royaltyInfo` 子调用 gas cap 防 OOG 卡死结算（F3）；无新状态变量，升级无需 `initializeV3` |

> 结算资金分配链：V1 全部给卖家 → V2 扣平台手续费 → V3 再扣 ERC2981 版税，剩余给卖家。三项费率上限之和 35% < 100%，恒不下溢，结算永不因费率锁死。

---

## 架构与安全设计

| 主题 | 设计 | 对应审计项 |
| --- | --- | --- |
| 资金提取 | pull 模式（先记账后提现） | 防 DoS |
| 通缩 / fee-on-transfer ERC20 | 用「转账前后余额差」实到量记账 + USD 复核 | F1（高危，已修复） |
| 跨币种套利 | 创建拍卖时锁定单币种（`BidType`） | F2（已实现） |
| `royaltyInfo` OOG | 子调用加 `{gas: 50_000}`，耗尽即 catch 回退 | F3（已实现） |
| `createAuction` 重入 | 补 `nonReentrant` | F5（已加固） |
| `durationHours` 溢出 | `MAX_DURATION_HOURS = 8760`（1 年）上限 | F6（已修复） |
| NFT 永久锁定 | `reclaimNft` 超时回收 + 软扣减退款保护 | F7 / N1（已实现） |
| 版税脏数据 | `setTokenRoyalty` 校验 tokenId 已铸造 | F8（已修复） |
| 预言机 | `getPrice` 校验 round 完整性 / 非负 / 非陈旧 | — |
| 升级安全 | `_authorizeUpgrade` 仅 owner；`_disableInitializers`；`reinitializer` | — |

---

## 合约清单

| 文件 | 说明 |
| --- | --- |
| `contracts/NFTAuction.sol` | V1 基础拍卖合约（UUPS、Chainlink、pull 模式） |
| `contracts/NFTAuctionV2.sol` | V2，新增平台手续费 |
| `contracts/NFTAuctionV3.sol` | V3，新增 ERC2981 版税（含硬上限 + gas cap） |
| `contracts/library/PriceConverter.sol` | Chainlink Price Feed 换算 + 安全校验 |
| `contracts/MyNFT.sol` | ERC721 + ERC2981 版税 NFT（示例标的） |
| `contracts/mocks/*.sol` | 测试辅助合约（通缩代币、恶意 NFT、代理等） |

---

## 目录结构

```
nft-auction/
├── contracts/              # 合约源码
│   ├── library/            # PriceConverter
│   └── mocks/              # 测试用 mock
├── test/                   # Hardhat(viem) + Foundry 测试
│   ├── NFTAuction.test.ts       # V1
│   ├── NFTAuctionV2.test.ts     # V2
│   ├── NFTAuctionV3.test.ts     # V3
│   ├── NftReclaim.test.ts       # F7 超时回收
│   ├── AuditBoundary.test.ts    # 审计边界探针
│   ├── MyNFT.test.ts            # NFT 合约
│   └── GasBench.t.sol           # Foundry gas 基准
├── frontend/               # React DApp 前端（详见 frontend/README.md）
├── ignition/modules/       # Hardhat Ignition 部署模块
├── scripts/upgrade.ts      # UUPS 升级脚本
├── foundry.toml            # Foundry 配置（solc 0.8.28, optimizer runs 1000）
└── hardhat.config.ts       # Hardhat 3 配置
```

---

## 开发与测试

```bash
# 安装依赖（首次）
npm install

# 编译合约
npm run compile          # = hardhat compile --force

# 跑全量测试（Hardhat + viem + Foundry Solidity）
npm test                 # = hardhat test

# 覆盖率
npm run test:coverage    # = hardhat test --coverage

# 格式化合约（forge fmt）
npm run fmt
```

> 也支持 Foundry：`forge build` / `forge test`（Foundry 测试在 `test/*.t.sol`）。

### 测试报告

最近一次全量测试（`npm run test:coverage`）的完整输出见 [`test.coverage.log.md`](./test.coverage.log.md)：

- **119 passing**（5 Foundry Solidity + 114 Hardhat/viem）
- 覆盖率 **99.54% 行 / 99.61% 语句**（`contracts/mocks/**` 为辅助合约，已按 `hardhat.config.ts` 的 `coverage.skipFiles` 排除，不计入生产代码覆盖率）

| 文件 | 行覆盖率 | 语句覆盖率 |
| --- | --- | --- |
| `contracts/library/PriceConverter.sol` | 100.00% | 100.00% |
| `contracts/MyNFT.sol` | 100.00% | 100.00% |
| `contracts/NFTAuction.sol` | 99.32% | 99.43% |
| `contracts/NFTAuctionV2.sol` | 100.00% | 100.00% |
| `contracts/NFTAuctionV3.sol` | 100.00% | 100.00% |
| **Total** | **99.54%** | **99.61%** |

---

## 部署与升级

### 已部署地址（Sepolia 测试网，chainId 11155111）

| 合约 | 角色 | 地址 | Etherscan |
| --- | --- | --- | --- |
| `AuctionProxy` | **ERC1967 代理（前端 / 用户实际交互地址）** | `0x290e776aDe5E53DF5fC7130de4392311043dEA8b` | [查看](https://sepolia.etherscan.io/address/0x290e776aDe5E53DF5fC7130de4392311043dEA8b) |
| `NFTAuction` | 实现合约（impl，经代理 delegatecall 调用） | `0x0b7Bc33aB01738a7999759bd9433Bac230AE53e6` | [查看](https://sepolia.etherscan.io/address/0x0b7Bc33aB01738a7999759bd9433Bac230AE53e6) |
| `MyNFT` | ERC721 + ERC2981 标的 NFT | `0x365538c9A4E890162d684F4a8BF7Ff13D668fecF` | [查看](https://sepolia.etherscan.io/address/0x365538c9A4E890162d684F4a8BF7Ff13D668fecF) |

> ⚠️ 用户、前端、合约交互都应使用 **`AuctionProxy` 地址**（它转发到当前 impl）；`NFTAuction` 地址是底层实现，仅供升级时引用。当前实现已升级到 **V3（ERC2981 版税）**。
> 地址来源：`ignition/deployments/chain-11155111/deployed_addresses.json`，三个地址的链上代码均已用 `cast code` 直连 Sepolia 节点核验存在。

本项目为 UUPS 代理模式，**统一用 Hardhat Ignition 一个入口**通吃本地 / 测试网 / 主网——
靠 `USE_MOCKS` 环境变量在本地自动部署 mock 预言机与代币，生产则用 `--parameters` 传真实地址，模块代码不用改。

### 本地链（自动 mock，零配置）

先起一个持久节点（另开一个终端保持运行）：

```bash
npx hardhat node
```

再部署 V1（`USE_MOCKS=true` 让模块自动部署 MockPriceFeed×2 + MockERC20）：

```bash
USE_MOCKS=true npx hardhat ignition deploy ignition/modules/NFTAuctionModule.ts --network localhost
```

升级到 V2 / V3（增量升级，proxy 地址不变）：

```bash
# V1 → V2（设置平台手续费）
PROXY_ADDRESS=0x<代理地址> bash upgrade-v2.sh

# V2 → V3（ERC2981 版税）
PROXY_ADDRESS=0x<代理地址> bash upgrade-v3.sh
```

### 测试网 / 主网（传真实地址）

```bash
# 配置凭据
npx hardhat keystore set SEPOLIA_RPC_URL
npx hardhat keystore set SEPOLIA_PRIVATE_KEY

# 部署 V1 到 Sepolia（paymentToken / paymentTokenUsdFeed 必须传真实非零地址，否则 initialize revert）
npx hardhat ignition deploy ignition/modules/NFTAuctionModule.ts --network sepolia \
  --parameters paymentToken=0x<ERC20地址> paymentTokenUsdFeed=0x<该ERC20的USD feed>

# 主网：需额外用 ethUsdFeed 覆盖默认的 Sepolia 地址
npx hardhat ignition deploy ignition/modules/NFTAuctionModule.ts --network mainnet \
  --parameters ethUsdFeed=0x<主网ETH/USD feed> paymentToken=0x... paymentTokenUsdFeed=0x...
```

### 升级已部署的代理到 V2/V3

```bash
PROXY_ADDRESS=0x<代理地址> TARGET_VERSION=v3 npx hardhat run scripts/upgrade.ts --network sepolia
```

> 部署产物中 **`ERC1967Proxy` 是用户/前端要用的地址**（不是 impl）；`initialize` 只能调一次，升级初始化走 `reinitializer(2)`。

---

## 安全审计

本项目经过三轮独立审计（主审计 + 两轮 subagent 复审）：

- 高危 1 项（F1 通缩代币资金不守恒）、中危 3 项、低危 4 项、信息级 4 项，**全部已修复或已附缓解建议**。
- 第二 / 三轮复审确认 F1–F8 修复正确、无回归，新发现 N1–N4 均已修复。
- 修复均附可复现测试，**108 → 119 passing**，回归 0 失败。

> ⚠️ 本合约为学习作业项目，未经主网级别审计，请勿直接用于生产环境承载真实资金。

---

## 技术栈

- **合约框架**：Foundry（`forge` 编译 / 测试 / 格式化）
- **集成测试**：Hardhat 3 Beta + viem + Node.js 原生测试（`node:test`）
- **合约库**：OpenZeppelin Contracts 5.6（含 upgradeable）、Chainlink Contracts
- **部署**：Hardhat Ignition
- **前端**：React 19 + TypeScript + Vite + ethers.js v6（详见 [frontend/README.md](frontend/README.md)）
