# Homework 05 作业完成说明

## 文件结构

```
homework05/
├── counter/                    # Foundry 合约项目（已有）
│   ├── src/Counter.sol         # Counter 合约（含 NumberUpdated 事件）
│   └── out/Counter.sol/        # 编译输出（ABI + Bytecode）
│
├── solution/                   # 作业解决方案
│   ├── task1-blockchain-rw/    # 任务 1：区块链读写
│   │   ├── main.go             # 查询区块 + 发送 ETH 转账
│   │   ├── go.mod
│   │   └── run.sh
│   │
│   └── task2-abigen/           # 任务 2：合约代码生成
│       ├── main.go             # 使用 abigen 绑定代码与合约交互
│       ├── counter/            # abigen 生成的 Go 绑定包
│       │   └── counter.go
│       ├── Counter.abi.json    # 合约 ABI
│       ├── Counter.bin         # 合约 Bytecode
│       ├── go.mod
│       └── run.sh
│
└── homework05.md               # 作业要求
```

## 任务 1：区块链读写

### 功能
1. **查询区块**：连接节点，查询最新区块和创世区块的信息（区块哈希、时间戳、交易数量、Gas 信息等）
2. **发送交易**：构造 EIP-1559 动态费用交易，发送 1 ETH 转账，等待确认并输出回执

### 运行
```bash
cd solution/task1-blockchain-rw
bash run.sh
```

### 核心代码
- 使用 `ethclient.DialContext()` 连接节点
- 使用 `client.BlockByNumber()` 查询区块
- 使用 `types.DynamicFeeTx` 构造交易，`types.SignTx()` 签名，`client.SendTransaction()` 发送

## 任务 2：合约代码生成

### 步骤 1：编写智能合约
使用 Solidity 编写 Counter 合约（含 `NumberUpdated` 事件），通过 `forge build` 编译。

### 步骤 2：使用 abigen 生成 Go 绑定
```bash
# 安装 abigen
go install github.com/ethereum/go-ethereum/cmd/abigen@v1.14.11

# 从 ABI + Bytecode 生成 Go 绑定代码
abigen --abi Counter.abi.json --bin Counter.bin --pkg counter --type Counter --out counter.go
```

### 步骤 3：使用绑定代码与合约交互
1. `instance.Number(nil)` — 读取计数器值（Call）
2. `instance.Increment(auth)` — 调用 increment（Transact）
3. `instance.SetNumber(auth, big.NewInt(100))` — 设置值（Transact）
4. `instance.FilterNumberUpdated(nil, nil)` — 查询历史事件

### 运行
```bash
cd solution/task2-abigen
bash run.sh
```

## 运行环境

| 项目 | 值 |
|------|------|
| 节点 | 本地 Anvil (127.0.0.1:8545) |
| Chain ID | 31337 |
| 合约地址 | `0x9fE46736679d2D9a65F0992F2272De9F3c7fa6e0` |
| 发送方 (账户#0) | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| 接收方 (账户#1) | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` |
