package main

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"log"
	"math/big"
	"os"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"

	"task2-abigen/counter" // abigen 生成的绑定包
)

// 任务 2：合约代码生成
// 1. 使用 abigen 从 Counter 合约的 ABI + Bytecode 生成 Go 绑定代码
// 2. 使用生成的绑定代码与合约交互（部署、查询、修改）
//
// 前置条件：
//   - 合约已部署到本地节点 127.0.0.1:8545
//   - 合约地址：0x9fE46736679d2D9a65F0992F2272De9F3c7fa6e0
//
// abigen 生成命令：
//   abigen --abi Counter.abi.json --bin Counter.bin --pkg counter --type Counter --out counter.go

// 合约地址（已部署的 Counter 合约）
const contractAddr = "0x9fE46736679d2D9a65F0992F2272De9F3c7fa6e0"

func main() {
	rpcURL := os.Getenv("ETH_RPC_URL")
	if rpcURL == "" {
		rpcURL = "http://127.0.0.1:8545"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// ========== 连接节点 ==========
	client, err := ethclient.DialContext(ctx, rpcURL)
	if err != nil {
		log.Fatalf("连接节点失败: %v", err)
	}
	defer client.Close()

	fmt.Println("========================================")
	fmt.Println("  任务 2：使用 abigen 生成的绑定代码交互")
	fmt.Println("========================================")
	fmt.Printf("节点地址: %s\n", rpcURL)
	fmt.Printf("合约地址: %s\n\n", contractAddr)

	// ========== 准备交易签名器 ==========
	// Anvil 默认账户 #0 的私钥
	privKeyHex := "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

	privKey, err := crypto.HexToECDSA(privKeyHex)
	if err != nil {
		log.Fatalf("解析私钥失败: %v", err)
	}

	publicKey := privKey.Public()
	publicKeyECDSA, ok := publicKey.(*ecdsa.PublicKey)
	if !ok {
		log.Fatal("无法将公钥转换为 ECDSA 类型")
	}
	fromAddr := crypto.PubkeyToAddress(*publicKeyECDSA)

	chainID, err := client.ChainID(ctx)
	if err != nil {
		log.Fatalf("获取链 ID 失败: %v", err)
	}

	// 创建交易签名器（用于写操作）
	auth, err := bind.NewKeyedTransactorWithChainID(privKey, chainID)
	if err != nil {
		log.Fatalf("创建签名器失败: %v", err)
	}
	auth.From = fromAddr
	auth.GasLimit = 300000

	// ========== 使用绑定代码创建合约实例 ==========
	contractAddress := common.HexToAddress(contractAddr)
	instance, err := counter.NewCounter(contractAddress, client)
	if err != nil {
		log.Fatalf("创建合约实例失败: %v", err)
	}

	// ========== 1. 读取当前值（Call） ==========
	fmt.Println("--- 读取当前计数器值 ---")
	currentNumber, err := instance.Number(nil)
	if err != nil {
		log.Fatalf("读取 number() 失败: %v", err)
	}
	fmt.Printf("当前值: %s\n\n", currentNumber.String())

	// ========== 2. 调用 increment()（Transact） ==========
	fmt.Println("--- 调用 increment() ---")
	tx, err := instance.Increment(auth)
	if err != nil {
		log.Fatalf("increment() 交易失败: %v", err)
	}
	fmt.Printf("交易哈希: %s\n", tx.Hash().Hex())

	// 等待交易确认
	_, err = bindWaitMined(ctx, client, tx.Hash())
	if err != nil {
		log.Fatalf("等待交易确认失败: %v", err)
	}

	newNumber, err := instance.Number(nil)
	if err != nil {
		log.Fatalf("读取 number() 失败: %v", err)
	}
	fmt.Printf("increment 后的值: %s\n\n", newNumber.String())

	// ========== 3. 调用 setNumber(100)（Transact） ==========
	fmt.Println("--- 调用 setNumber(100) ---")
	tx, err = instance.SetNumber(auth, big.NewInt(100))
	if err != nil {
		log.Fatalf("setNumber() 交易失败: %v", err)
	}
	fmt.Printf("交易哈希: %s\n", tx.Hash().Hex())

	_, err = bindWaitMined(ctx, client, tx.Hash())
	if err != nil {
		log.Fatalf("等待交易确认失败: %v", err)
	}

	setNumber, err := instance.Number(nil)
	if err != nil {
		log.Fatalf("读取 number() 失败: %v", err)
	}
	fmt.Printf("setNumber(100) 后的值: %s\n\n", setNumber.String())

	// ========== 4. 监听 NumberUpdated 事件 ==========
	fmt.Println("--- 查询合约产生的 NumberUpdated 事件 ---")
	iter, err := instance.FilterNumberUpdated(nil, nil)
	if err != nil {
		log.Fatalf("查询事件失败: %v", err)
	}
	defer iter.Close()

	count := 0
	for iter.Next() {
		event := iter.Event
		fmt.Printf("  事件 #%d: caller=%s, oldValue=%s, newValue=%s\n",
			count+1, event.Caller.Hex(), event.OldValue.String(), event.NewValue.String())
		count++
	}
	fmt.Printf("共找到 %d 个事件\n", count)
	fmt.Println()

	fmt.Println("========================================")
	fmt.Println("  交互完成！")
	fmt.Println("========================================")
}

// bindWaitMined 等待交易被确认
func bindWaitMined(ctx context.Context, client *ethclient.Client, txHash common.Hash) (*types.Receipt, error) {
	for {
		receipt, err := client.TransactionReceipt(ctx, txHash)
		if err == nil {
			return receipt, nil
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(1 * time.Second):
		}
	}
}
