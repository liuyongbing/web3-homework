#!/bin/bash
# ─── Step 3: V2 → V3 升级 ───
# 部署 NFTAuctionV3 实现（仅换实现，不调 initializeV2）
#
# 用法：
#   PROXY_ADDRESS=0x... bash upgrade-v3.sh

set -e

PROXY_ADDRESS="${PROXY_ADDRESS:?请设置 PROXY_ADDRESS=0x...}"

echo "════════════════════════════════════════"
echo " V2 → V3 升级（ERC2981 版税）"
echo "════════════════════════════════════════"
echo " 代理地址: $PROXY_ADDRESS"

PROXY_ADDRESS="$PROXY_ADDRESS" \
TARGET_VERSION=v3 \
npx hardhat run scripts/upgrade.ts --network sepolia

echo ""
echo "✅ V3 升级完成！"
echo "   最终版本: V3（平台费 + ERC2981 版税）"
echo "   代理地址: $PROXY_ADDRESS"
