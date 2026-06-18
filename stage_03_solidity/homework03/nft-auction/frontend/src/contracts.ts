// NFTAuctionV3 ABI（前端交互所需的最小函数/事件集）
export const AUCTION_ABI = [
  // ─── 读 ───
  "function nextAuctionId() view returns (uint256)",
  "function auctions(uint256) view returns (address seller, address nftContract, uint256 tokenId, uint256 endTime, address highestBidder, uint256 highestBidUsd, uint256 highestBidAmount, uint8 highestBidType, bool ended, uint8 acceptedBidType)",
  "function pendingEth(address) view returns (uint256)",
  "function pendingErc20(address) view returns (uint256)",
  "function nftClaimed(uint256) view returns (bool)",
  "function endedAt(uint256) view returns (uint256)",
  "function platformFeeBp() view returns (uint256)",
  "function paymentToken() view returns (address)",
  "function ethUsdFeed() view returns (address)",
  "function version() view returns (string)",
  "function NFT_RECLAIM_DELAY() view returns (uint256)",
  // ─── 写 ───
  "function createAuction(address nftContract, uint256 tokenId, uint256 durationHours) returns (uint256)",
  "function createAuction(address nftContract, uint256 tokenId, uint256 durationHours, uint8 acceptedBidType) returns (uint256)",
  "function bidWithEth(uint256 auctionId) payable",
  "function bidWithErc20(uint256 auctionId, uint256 amount)",
  "function endAuction(uint256 auctionId)",
  "function claimNft(uint256 auctionId)",
  "function reclaimNft(uint256 auctionId)",
  "function withdraw()",
  // ─── 事件 ───
  "event AuctionCreated(uint256 indexed auctionId, address indexed seller, address indexed nftContract, uint256 tokenId, uint256 endTime, uint8 acceptedBidType)",
  "event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount, uint256 bidUsd, uint8 bidType)",
  "event AuctionEnded(uint256 indexed auctionId, address indexed seller, address winner, uint256 amountUsd)",
  "event NftClaimed(uint256 indexed auctionId, address indexed recipient, uint256 tokenId)",
  "event NftReclaimed(uint256 indexed auctionId, address indexed seller, uint256 tokenId)",
  "event Withdrawn(address indexed account, uint256 ethAmount, uint256 erc20Amount)",
] as const

// MyNFT (ERC721 + ERC2981) ABI
export const NFT_ABI = [
  "function approve(address to, uint256 tokenId)",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function mint(address to) returns (uint256)",
  "function mintWithRoyalty(address to, address royaltyReceiver, uint96 feeBp) returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  // ─── ERC721 自定义错误（OpenZeppelin IERC6093），用于解码 revert data ───
  "error ERC721NonexistentToken(uint256 tokenId)",
  "error ERC721InvalidOwner(address owner)",
  "error ERC721IncorrectOwner(address sender, uint256 tokenId, address owner)",
  "error ERC721InvalidSender(address sender)",
  "error ERC721InvalidReceiver(address receiver)",
  "error ERC721InvalidApprover(address approver)",
  "error ERC721InvalidOperator(address operator)",
  "error ERC721InsufficientApproval(address operator, uint256 tokenId)",
  // MyNFT 自定义错误
  "error FeeTooHigh()",
] as const

// ERC20 ABI（payment token 交互）
export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  // ─── ERC20 自定义错误（OpenZeppelin IERC6093），用于解码 revert data ───
  "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)",
  "error ERC20InvalidSender(address sender)",
  "error ERC20InvalidReceiver(address receiver)",
  "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
  "error ERC20InvalidApprover(address approver)",
  "error ERC20InvalidSpender(address spender)",
] as const

// ─── 合约地址（通过 .env 配置，默认 localhost）───
export const AUCTION_ADDRESS =
  import.meta.env.VITE_AUCTION_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3"

export const NFT_ADDRESS =
  import.meta.env.VITE_NFT_ADDRESS || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"

// 链 ID（默认 31337 = hardhat local）
export const TARGET_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || "31337")

// BidType 枚举映射
export const BID_TYPE_LABEL: Record<number, string> = {
  0: "无",
  1: "ETH",
  2: "ERC20",
}

// ─── 已知自定义错误选择器（4 字节）→ 可读名称 ───
// 用于在 ethers 无法自动解码时，从 revert data 中识别出错误含义
const KNOWN_ERROR_SELECTORS: Record<string, string> = {
  // ERC721 (OpenZeppelin IERC6093)
  "0x7e273289": "ERC721NonexistentToken(uint256) — 该 Token ID 不存在（未铸造/已销毁）",
  "0x1e4ddb01": "ERC721InvalidOwner(address) — owner 地址无效",
  "0xe076ca38": "ERC721IncorrectOwner(address,uint256,address) — 调用者不是该 NFT 的 owner",
  "0x5eb555d5": "ERC721InvalidSender(address)",
  "0x9b2cb56f": "ERC721InvalidReceiver(address)",
  "0x8a48ad87": "ERC721InvalidApprover(address)",
  "0x32e0ae6d": "ERC721InvalidOperator(address)",
  "0x7f0a08ca": "ERC721InsufficientApproval(address,uint256) — 未授权操作该 NFT",
  // ERC20 (OpenZeppelin IERC6093)
  "0xe450d38c": "ERC20InsufficientBalance(address,uint256,uint256) — ERC20 余额不足",
  "0xfb8f41b2": "ERC20InvalidSender(address)",
  "0xec442f05": "ERC20InvalidReceiver(address)",
  "0xe60c6f42": "ERC20InsufficientAllowance(address,uint256,uint256) — ERC20 授权额度不足",
  "0x756688fe": "ERC20InvalidApprover(address)",
  "0x63ab4822": "ERC20InvalidSpender(address)",
  // MyNFT
  "0x7313c2a3": "FeeTooHigh() — 版税率超过上限",
}

/// 从 ethers 错误对象中提取可读的错误描述（解码自定义错误）
export function decodeError(err: unknown): string {
  const e = err as any
  const rawData = e?.data ?? e?.info?.error?.data ?? e?.reason
  if (typeof rawData === "string" && rawData.startsWith("0x")) {
    const selector = rawData.slice(0, 10).toLowerCase()
    const known = KNOWN_ERROR_SELECTORS[selector]
    if (known) return known
    // 尝试从 data 中解析参数（简单 uint256）
    if (rawData.length > 10) {
      const args = rawData.slice(10)
      // 每 64 个 hex 字符（32 字节）为一个参数
      const params: string[] = []
      for (let i = 0; i < args.length; i += 64) {
        params.push(BigInt("0x" + args.slice(i, i + 64)).toString())
      }
      return `${selector}（参数: ${params.join(", ")}）`
    }
    return selector
  }
  return (e?.shortMessage ?? e?.message ?? String(err)).replace(/^execution reverted:\s*/i, "")
}
