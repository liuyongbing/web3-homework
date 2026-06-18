#!/bin/bash
# ─── 验证已部署合约到 Etherscan ───
# 用法：bash verify-contracts.sh
# 需要输入 keystore 密码

set -e

NFT="0x365538c9A4E890162d684F4a8BF7Ff13D668fecF"
IMPL_V1="0x0b7Bc33aB01738a7999759bd9433Bac230AE53e6"
PROXY="0x290e776aDe5E53DF5fC7130de4392311043dEA8b"

echo "════════════════════════════════════════"
echo " 验证合约到 Etherscan (Sepolia)"
echo "════════════════════════════════════════"

echo ""
echo "1/3 验证 MyNFT..."
npx hardhat verify --network sepolia --contract contracts/MyNFT.sol:MyNFT "$NFT" "MyNFT" "MNFT" "https://api.example.com/" || true

echo ""
echo "2/3 验证 NFTAuction V1 实现..."
npx hardhat verify --network sepolia --contract contracts/NFTAuction.sol:NFTAuction "$IMPL_V1" || true

echo ""
echo "3/3 验证 ERC1967Proxy..."
npx hardhat verify --network sepolia --contract contracts/mocks/ERC1967Proxy.sol:ERC1967Proxy "$PROXY" "$IMPL_V1" "0x" || true

echo ""
echo "✅ 验证完成！"
echo "   Proxy: https://sepolia.etherscan.io/address/$PROXY"
