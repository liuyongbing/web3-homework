#!/bin/bash
set -e

echo "========================================"
echo "  任务 2：合约代码生成 (abigen)"
echo "========================================"

export ETH_RPC_URL=http://127.0.0.1:8545
go run main.go
