package main

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"log"
	"math/big"
	"os"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

// 任务 1：区块链读写
// 1. 查询指定区块号的区块信息（哈希、时间戳、交易数量等）
// 2. 构造并发送一笔简单的 ETH 转账交易
//
// 使用本地 Anvil 节点 (127.0.0.1:8545) 演示

func main() {
	rpcURL := os.Getenv("ETH_RPC_URL")
	if rpcURL == "" {
		rpcURL = "http://127.0.0.1:8545"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// ========== 连接到以太坊节点 ==========
	client, err := ethclient.DialContext(ctx, rpcURL)
	if err != nil {
		log.Fatalf("连接节点失败: %v", err)
	}
	defer client.Close()

	fmt.Println("========================================")
	fmt.Println("  任务 1：区块链读写")
	fmt.Println("========================================")
	fmt.Printf("节点地址: %s\n\n", rpcURL)

	// ========== 第一部分：查询区块 ==========

	// 查询最新区块
	latestBlock, err := client.BlockByNumber(ctx, nil)
	if err != nil {
		log.Fatalf("获取最新区块失败: %v", err)
	}

	fmt.Println("--- 查询最新区块 ---")
	printBlockInfo(latestBlock)

	// 查询创世区块（区块号 0）
	genesisBlock, err := client.BlockByNumber(ctx, big.NewInt(0))
	if err != nil {
		log.Printf("获取创世区块失败: %v", err)
	} else {
		fmt.Println("--- 查询创世区块 (Block #0) ---")
		printBlockInfo(genesisBlock)
	}

	// ========== 第二部分：发送 ETH 转账交易 ==========
	fmt.Println("--- 发送 ETH 转账交易 ---")
	sendTransaction(ctx, client)
}

// printBlockInfo 打印区块信息
func printBlockInfo(block *types.Block) {
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Printf("区块号       : %d\n", block.Number().Uint64())
	fmt.Printf("区块哈希     : %s\n", block.Hash().Hex())
	fmt.Printf("父区块哈希   : %s\n", block.ParentHash().Hex())
	fmt.Printf("时间戳       : %d (%s)\n", block.Time(),
		time.Unix(int64(block.Time()), 0).Format("2006-01-02 15:04:05"))
	fmt.Printf("交易数量     : %d\n", len(block.Transactions()))
	fmt.Printf("Gas Limit    : %d\n", block.GasLimit())
	fmt.Printf("Gas Used     : %d\n", block.GasUsed())
	fmt.Printf("State Root   : %s\n", block.Root().Hex())
	fmt.Printf("Tx Root      : %s\n", block.TxHash().Hex())
	fmt.Printf("Coinbase     : %s\n", block.Coinbase().Hex())
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Println()
}

// sendTransaction 发送一笔简单的 ETH 转账交易
func sendTransaction(ctx context.Context, client *ethclient.Client) {
	// Anvil 默认账户 #0 的私钥
	privKeyHex := "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
	toAddrHex := "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" // Anvil 默认账户 #1

	// 解析私钥
	privKey, err := crypto.HexToECDSA(privKeyHex)
	if err != nil {
		log.Fatalf("解析私钥失败: %v", err)
	}

	// 从私钥推导发送方地址
	publicKey := privKey.Public()
	publicKeyECDSA, ok := publicKey.(*ecdsa.PublicKey)
	if !ok {
		log.Fatal("无法将公钥转换为 ECDSA 类型")
	}
	fromAddr := crypto.PubkeyToAddress(*publicKeyECDSA)
	toAddr := common.HexToAddress(toAddrHex)

	// 获取链 ID
	chainID, err := client.ChainID(ctx)
	if err != nil {
		log.Fatalf("获取链 ID 失败: %v", err)
	}

	// 获取 nonce
	nonce, err := client.PendingNonceAt(ctx, fromAddr)
	if err != nil {
		log.Fatalf("获取 nonce 失败: %v", err)
	}

	// 转账金额：1 ETH = 10^18 Wei
	value := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)

	// 获取建议的 Gas 价格
	gasTipCap, err := client.SuggestGasTipCap(ctx)
	if err != nil {
		log.Fatalf("获取 gas tip cap 失败: %v", err)
	}

	// 获取 base fee
	header, err := client.HeaderByNumber(ctx, nil)
	if err != nil {
		log.Fatalf("获取 header 失败: %v", err)
	}

	baseFee := header.BaseFee
	if baseFee == nil {
		gasPrice, _ := client.SuggestGasPrice(ctx)
		baseFee = gasPrice
	}

	// fee cap = base fee * 2 + tip cap
	gasFeeCap := new(big.Int).Add(
		new(big.Int).Mul(baseFee, big.NewInt(2)),
		gasTipCap,
	)

	// 普通转账 Gas Limit 固定为 21000
	gasLimit := uint64(21000)

	// 构造 EIP-1559 动态费用交易
	txData := &types.DynamicFeeTx{
		ChainID:   chainID,
		Nonce:     nonce,
		GasTipCap: gasTipCap,
		GasFeeCap: gasFeeCap,
		Gas:       gasLimit,
		To:        &toAddr,
		Value:     value,
		Data:      nil,
	}
	tx := types.NewTx(txData)

	// 签名交易
	signer := types.NewLondonSigner(chainID)
	signedTx, err := types.SignTx(tx, signer, privKey)
	if err != nil {
		log.Fatalf("签名交易失败: %v", err)
	}

	// 发送交易
	if err := client.SendTransaction(ctx, signedTx); err != nil {
		log.Fatalf("发送交易失败: %v", err)
	}

	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Printf("发送方       : %s\n", fromAddr.Hex())
	fmt.Printf("接收方       : %s\n", toAddr.Hex())
	fmt.Printf("转账金额     : 1 ETH (%s Wei)\n", value.String())
	fmt.Printf("Gas Limit    : %d\n", gasLimit)
	fmt.Printf("Nonce        : %d\n", nonce)
	fmt.Printf("交易哈希     : %s\n", signedTx.Hash().Hex())
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

	// 等待交易确认
	receipt, err := bindWaitMined(ctx, client, signedTx.Hash())
	if err != nil {
		log.Printf("等待交易确认失败: %v\n", err)
		return
	}

	fmt.Printf("交易状态     : %d (1=成功)\n", receipt.Status)
	fmt.Printf("所在区块     : %d\n", receipt.BlockNumber.Uint64())
	fmt.Printf("Gas 消耗     : %d\n", receipt.GasUsed)
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Println()
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
