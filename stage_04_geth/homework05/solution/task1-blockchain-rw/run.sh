#!/bin/bash
set -e

echo "========================================"
echo "  任务 1：区块链读写"
echo "========================================"

export ETH_RPC_URL=http://127.0.0.1:8545
go run main.go
