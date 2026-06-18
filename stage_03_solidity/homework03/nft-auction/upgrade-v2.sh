#!/bin/bash
# ─── Step 2: V1 → V2 升级 ───
# 部署 NFTAuctionV2 实现 + 调用 initializeV2 设置平台手续费
#
# 用法：
#   PROXY_ADDRESS=0x... bash upgrade-v2.sh
#   PROXY_ADDRESS=0x... PLATFORM_FEE_BP=500 bash upgrade-v2.sh

set -e

PROXY_ADDRESS="${PROXY_ADDRESS:?请设置 PROXY_ADDRESS=0x...}"
PLATFORM_FEE_BP="${PLATFORM_FEE_BP:-300}"

echo "════════════════════════════════════════"
echo " V1 → V2 升级（平台手续费 ${PLATFORM_FEE_BP}bp）"
echo "════════════════════════════════════════"
echo " 代理地址: $PROXY_ADDRESS"

PROXY_ADDRESS="$PROXY_ADDRESS" \
TARGET_VERSION=v2 \
PLATFORM_FEE_BP="$PLATFORM_FEE_BP" \
npx hardhat run scripts/upgrade.ts --network sepolia

echo ""
echo "✅ V2 升级完成！"
