#!/bin/bash
# ─── Step 1: 部署 V1 到 Sepolia ───
# 部署 NFTAuction V1 代理 + MyNFT + Mock/真实预言机
#
# 前提：
#   npx hardhat keystore set SEPOLIA_RPC_URL
#   npx hardhat keystore set SEPOLIA_PRIVATE_KEY

set -e

echo "════════════════════════════════════════"
echo " 部署 V1 到 Sepolia"
echo "════════════════════════════════════════"

npx hardhat ignition deploy ignition/modules/NFTAuctionModule.ts \
  --network sepolia \
  --parameters sepolia-params.json \
  --reset

echo ""
echo "✅ V1 部署完成！"
echo "   请记录 proxy 地址（后续升级需要）"
echo "   通常在 ignition/deployments/ 目录的 deployed_addresses.json 中"
