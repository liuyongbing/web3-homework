# NFT Auction DApp 前端

基于 **React 19 + TypeScript + Vite + ethers.js v6** 的 NFT 拍卖市场前端，与 NFTAuctionV3 合约交互。

## 功能

| 功能 | 说明 |
|---|---|
| 连接钱包 | MetaMask 自动检测，监听账户 / 链切换 |
| 拍卖列表 | 从链上加载全部拍卖，实时倒计时 |
| 创建拍卖 | Approve NFT → 设定 Token ID、时长、出价币种 |
| ETH 出价 | 直接发送 ETH 参与竞拍 |
| ERC20 出价 | 自动 approve → ERC20 出价 |
| 结束拍卖 | 拍卖过期后任何人可触发结算 |
| 领取 NFT | Pull 模式：赢家（有人出价）或卖家（无人出价）主动领取 |
| 回收 NFT | 赢家逾期 7 天未领，卖家可回收 + 退款保护 |
| 提取资金 | 一次性提取全部待领 ETH + ERC20 |
| 防重复提交 | 所有链上按钮在交易等待期间自动置灰 |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，填入合约部署地址：

```bash
cp .env.example .env
```

| 变量 | 说明 | 默认值 |
|---|---|---|
| `VITE_AUCTION_ADDRESS` | NFTAuctionV3 代理合约地址 | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| `VITE_NFT_ADDRESS` | MyNFT 合约地址 | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |
| `VITE_CHAIN_ID` | 目标链 ID（31337 = hardhat local, 11155111 = sepolia） | `31337` |
| `VITE_RPC_URL` | RPC 地址（仅提示信息） | `http://127.0.0.1:8545` |

> 默认地址对应 Hardhat Ignition 在本地链的首次部署产物。若重新部署，请从 `ignition/deployments/` 中获取最新地址。

### 3. 启动开发服务器

```bash
npm run dev
```

浏览器打开 `http://localhost:3000`。

### 4. 本地开发完整流程

```bash
# 终端 1：启动 Hardhat 本地节点
cd ..   # 回到 nft-auction 根目录
npx hardhat node

# 终端 2：部署合约（自动 mock 预言机）
USE_MOCKS=true npx hardhat ignition deploy ignition/modules/NFTAuctionModule.ts \
  --network localhost

# 终端 3：启动前端
cd frontend
npm run dev
```

## 技术栈

- **React 19** + **TypeScript 5.8**
- **Vite 6** 构建 + 开发服务器
- **ethers.js v6** 与合约交互（human-readable ABI）
- **MetaMask** 钱包集成

## 目录结构

```
frontend/
├── src/
│   ├── App.tsx           # 主组件（钱包连接、拍卖列表、创建弹窗）
│   ├── contracts.ts      # ABI 定义 + 合约地址配置
│   ├── index.css         # 暗色主题样式
│   ├── main.tsx          # React 入口
│   └── vite-env.d.ts     # Vite 环境变量类型声明
├── .env.example          # 环境变量模板
├── index.html            # HTML 入口
├── vite.config.ts        # Vite 配置
├── tsconfig.json         # TypeScript 配置
└── package.json
```

## 构建生产版本

```bash
npm run build     # TypeScript 编译 + Vite 打包
npm run preview   # 本地预览构建产物
```
