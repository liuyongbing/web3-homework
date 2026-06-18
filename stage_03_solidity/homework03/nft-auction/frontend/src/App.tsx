import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import {
  AUCTION_ABI, NFT_ABI, ERC20_ABI,
  AUCTION_ADDRESS, NFT_ADDRESS, TARGET_CHAIN_ID, BID_TYPE_LABEL, decodeError,
} from './contracts'

// ─── 类型 ───
interface AuctionInfo {
  id: number
  seller: string
  nftContract: string
  tokenId: number
  endTime: number
  highestBidder: string
  highestBidUsd: bigint
  highestBidAmount: bigint
  highestBidType: number
  ended: boolean
  acceptedBidType: number
  nftClaimed: boolean
}

// ─── 工具函数 ───
function shortAddr(addr: string) {
  if (addr === ethers.ZeroAddress) return '—'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function formatEth(wei: bigint) {
  return `${parseFloat(ethers.formatEther(wei)).toFixed(4)} ETH`
}

function formatUsd18(wei: bigint) {
  return `$${parseFloat(ethers.formatEther(wei)).toFixed(2)}`
}

function timeLeft(endTime: number): string {
  const diff = endTime - Math.floor(Date.now() / 1000)
  if (diff <= 0) return '已结束'
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = diff % 60
  if (h > 24) return `${Math.floor(h / 24)}天 ${h % 24}小时`
  return `${h}时 ${m}分 ${s}秒`
}

// ─── MetaMask 类型声明 ───
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      on: (event: string, cb: (...args: unknown[]) => void) => void
      removeListener: (event: string, cb: (...args: unknown[]) => void) => void
    }
  }
}

export default function App() {
  const [account, setAccount] = useState<string | null>(null)
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)
  const [auctions, setAuctions] = useState<AuctionInfo[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [txPending, setTxPending] = useState(false)
  const [msg, setMsg] = useState('')
  const [pendingEth, setPendingEth] = useState<bigint>(0n)
  const [pendingErc20, setPendingErc20] = useState<bigint>(0n)
  const [showCreate, setShowCreate] = useState(false)
  const [, setTick] = useState(0)

  // 定时器：每秒刷新倒计时
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // ─── 连接钱包 ───
  const connect = useCallback(async () => {
    if (!window.ethereum) { setMsg('请安装 MetaMask'); return }
    try {
      const p = new ethers.BrowserProvider(window.ethereum)
      const signer = await p.getSigner()
      const addr = await signer.getAddress()
      setAccount(addr)
      setProvider(p)

      // 检查链 ID
      const net = await p.getNetwork()
      if (Number(net.chainId) !== TARGET_CHAIN_ID) {
        setMsg(`请切换到链 ID ${TARGET_CHAIN_ID}`)
      } else {
        setMsg('')
      }
    } catch (e) {
      setMsg(`连接失败: ${(e as Error).message}`)
    }
  }, [])

  // ─── 监听账户/链变化 ───
  useEffect(() => {
    if (!window.ethereum) return
    const onAccountsChanged = (...args: unknown[]) => {
      const accts = args[0] as string[]
      if (accts.length === 0) setAccount(null)
      else { setAccount(accts[0] ?? null); connect() }
    }
    const onChainChanged = () => window.location.reload()
    window.ethereum.on('accountsChanged', onAccountsChanged)
    window.ethereum.on('chainChanged', onChainChanged)
    return () => {
      window.ethereum?.removeListener('accountsChanged', onAccountsChanged)
      window.ethereum?.removeListener('chainChanged', onChainChanged)
    }
  }, [connect])

  // ─── 加载拍卖列表 ───
  const loadAuctions = useCallback(async () => {
    if (!provider) return
    setLoading(true)
    try {
      const auction = new ethers.Contract(AUCTION_ADDRESS, AUCTION_ABI, provider) as any
      const nextId: bigint = await auction.nextAuctionId()
      const list: AuctionInfo[] = []
      for (let i = 1; i < Number(nextId); i++) {
        const a = await auction.auctions(i)
        const claimed: boolean = await auction.nftClaimed(i)
        list.push({
          id: i,
          seller: a.seller,
          nftContract: a.nftContract,
          tokenId: Number(a.tokenId),
          endTime: Number(a.endTime),
          highestBidder: a.highestBidder,
          highestBidUsd: a.highestBidUsd,
          highestBidAmount: a.highestBidAmount,
          highestBidType: Number(a.highestBidType),
          ended: a.ended,
          acceptedBidType: Number(a.acceptedBidType),
          nftClaimed: claimed,
        })
      }
      setAuctions(list)

      // 加载 pending
      if (account) {
        const pe: bigint = await auction.pendingEth(account)
        const pc: bigint = await auction.pendingErc20(account)
        setPendingEth(pe)
        setPendingErc20(pc)
      }
    } catch (e) {
      setMsg(`加载失败: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [provider, account])

  useEffect(() => { loadAuctions() }, [loadAuctions])

  // ─── 提取 signer ───
  const getSigner = async () => {
    if (!provider) throw new Error('请先连接钱包')
    return provider.getSigner()
  }

  // ─── 铸造 NFT ───
  const doMintNFT = async () => {
    try {
      setTxPending(true); setMsg('')
      const signer = await getSigner()
      const nft = new ethers.Contract(NFT_ADDRESS, NFT_ABI, signer) as any
      setMsg('铸造 NFT 中…')
      const tx = await nft.mint(account)
      const receipt = await tx.wait()
      // 从 Transfer 事件解析新 tokenId
      const iface = new ethers.Interface(["event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"])
      let mintedId: string | null = null
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data })
          if (parsed && parsed.name === 'Transfer' && parsed.args.from === ethers.ZeroAddress) {
            mintedId = parsed.args.tokenId.toString()
          }
        } catch { /* skip non-matching logs */ }
      }
      setMsg(mintedId ? `铸造成功！Token ID = ${mintedId}` : '铸造成功！')
    } catch (e) {
      setMsg(`铸造失败: ${decodeError(e)}`)
    } finally {
      setTxPending(false)
    }
  }

  // ─── 提取资金 ───
  const doWithdraw = async () => {
    try {
      setTxPending(true); setMsg('')
      const signer = await getSigner()
      const c = new ethers.Contract(AUCTION_ADDRESS, AUCTION_ABI, signer) as any
      const tx = await c.withdraw()
      setMsg('提取中…')
      await tx.wait()
      setMsg('提取成功！')
      loadAuctions()
    } catch (e) {
      setMsg(`提取失败: ${decodeError(e)}`)
    } finally {
      setTxPending(false)
    }
  }

  const hasPending = pendingEth > 0n || pendingErc20 > 0n

  return (
    <div className="app">
      {/* ─── 顶栏 ─── */}
      <header>
        <h1>🏛️ NFT Auction</h1>
        <div className="header-right">
          {account ? (
            <span className="badge">{shortAddr(account)}</span>
          ) : (
            <button className="btn" onClick={connect}>连接钱包</button>
          )}
        </div>
      </header>

      {msg && <div className="msg">{msg}</div>}

      {/* ─── 资金面板 ─── */}
      {account && hasPending && (
        <section className="card">
          <h3>💰 待提取资金</h3>
          <div className="row">
            {pendingEth > 0n && <span>ETH: {formatEth(pendingEth)}</span>}
            {pendingErc20 > 0n && <span>ERC20: {ethers.formatUnits(pendingErc20, 6)} tokens</span>}
            <button className="btn btn-sm" disabled={txPending} onClick={doWithdraw}>
              {txPending ? '提交中…' : '提取'}
            </button>
          </div>
        </section>
      )}

      {/* ─── 操作栏 ─── */}
      <section className="toolbar">
        <button className="btn" onClick={loadAuctions} disabled={loading}>
          {loading ? '加载中…' : '刷新列表'}
        </button>
        {account && (
          <>
            <button className="btn" disabled={txPending} onClick={doMintNFT}>
              {txPending ? '提交中…' : '✦ 铸造 NFT'}
            </button>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + 创建拍卖
            </button>
          </>
        )}
      </section>

      {/* ─── 拍卖列表 ─── */}
      <section className="auction-list">
        {auctions.length === 0 && !loading && (
          <p className="empty">暂无拍卖，点击上方按钮创建</p>
        )}
        {auctions.map(a => {
          const now = Math.floor(Date.now() / 1000)
          const isActive = !a.ended && a.endTime > now
          return (
            <div
              key={a.id}
              className={`auction-card ${selectedId === a.id ? 'selected' : ''}`}
              onClick={() => setSelectedId(selectedId === a.id ? null : a.id)}
            >
              <div className="card-header">
                <span className="auction-id">#{a.id}</span>
                <span className={`status ${isActive ? 'active' : a.ended ? 'ended' : 'expired'}`}>
                  {isActive ? '🟢 进行中' : a.ended ? '🔴 已结束' : '⏰ 已过期'}
                </span>
              </div>
              <div className="card-body">
                <div>NFT TokenId: <b>{a.tokenId}</b></div>
                <div>卖家: {shortAddr(a.seller)}</div>
                <div>
                  最高出价: {a.highestBidder !== ethers.ZeroAddress
                    ? `${formatUsd18(a.highestBidUsd)} (${formatEth(a.highestBidAmount)})`
                    : '无出价'
                  }
                </div>
                <div>剩余时间: <b>{timeLeft(a.endTime)}</b></div>
                <div>接受币种: {BID_TYPE_LABEL[a.acceptedBidType] ?? 'ETH + ERC20'}</div>
              </div>
              {selectedId === a.id && (
                <AuctionDetail
                  auction={a}
                  account={account}
                  txPending={txPending}
                  setTxPending={setTxPending}
                  setMsg={setMsg}
                  getSigner={getSigner}
                  onRefresh={loadAuctions}
                />
              )}
            </div>
          )
        })}
      </section>

      {/* ─── 创建拍卖弹窗 ─── */}
      {showCreate && (
        <CreateAuction
          account={account}
          txPending={txPending}
          setTxPending={setTxPending}
          setMsg={setMsg}
          getSigner={getSigner}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadAuctions() }}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════
//  拍卖详情子组件
// ════════════════════════════════════════════════════
function AuctionDetail({ auction: a, account, txPending, setTxPending, setMsg, getSigner, onRefresh }: {
  auction: AuctionInfo
  account: string | null
  txPending: boolean
  setTxPending: (v: boolean) => void
  setMsg: (s: string) => void
  getSigner: () => Promise<ethers.Signer>
  onRefresh: () => void
}) {
  const [bidAmount, setBidAmount] = useState('')
  const now = Math.floor(Date.now() / 1000)
  const isActive = !a.ended && a.endTime > now
  const canBidEth = isActive && (a.acceptedBidType === 0 || a.acceptedBidType === 1)
  const canBidErc20 = isActive && (a.acceptedBidType === 0 || a.acceptedBidType === 2)
  const isSeller = account?.toLowerCase() === a.seller.toLowerCase()
  const isWinner = account?.toLowerCase() === a.highestBidder.toLowerCase()

  // 出价 ETH
  const doBidEth = async () => {
    try {
      setTxPending(true); setMsg('')
      const signer = await getSigner()
      const c = new ethers.Contract(AUCTION_ADDRESS, AUCTION_ABI, signer) as any
      const tx = await c.bidWithEth(a.id, { value: ethers.parseEther(bidAmount) })
      setMsg('出价中…')
      await tx.wait()
      setMsg('出价成功！')
      setBidAmount('')
      onRefresh()
    } catch (e) { setMsg(`出价失败: ${decodeError(e)}`) }
    finally { setTxPending(false) }
  }

  // 出价 ERC20
  const doBidErc20 = async () => {
    try {
      setTxPending(true); setMsg('')
      const signer = await getSigner()
      const auction = new ethers.Contract(AUCTION_ADDRESS, AUCTION_ABI, signer) as any
      const paymentAddr: string = await auction.paymentToken()
      const erc20 = new ethers.Contract(paymentAddr, ERC20_ABI, signer) as any
      const decimals: number = await erc20.decimals()
      const amount = ethers.parseUnits(bidAmount, decimals)

      // 先 approve
      const allowance: bigint = await erc20.allowance(account, AUCTION_ADDRESS)
      if (allowance < amount) {
        setMsg('授权 ERC20…')
        const approveTx = await erc20.approve(AUCTION_ADDRESS, amount)
        await approveTx.wait()
      }

      setMsg('出价中…')
      const tx = await auction.bidWithErc20(a.id, amount)
      await tx.wait()
      setMsg('出价成功！')
      setBidAmount('')
      onRefresh()
    } catch (e) { setMsg(`出价失败: ${decodeError(e)}`) }
    finally { setTxPending(false) }
  }

  // 结束拍卖
  const doEnd = async () => {
    try {
      setTxPending(true); setMsg('')
      const signer = await getSigner()
      const c = new ethers.Contract(AUCTION_ADDRESS, AUCTION_ABI, signer) as any
      const tx = await c.endAuction(a.id)
      setMsg('结算中…')
      await tx.wait()
      setMsg('拍卖已结束！')
      onRefresh()
    } catch (e) { setMsg(`结束失败: ${decodeError(e)}`) }
    finally { setTxPending(false) }
  }

  // 领取 NFT
  const doClaimNft = async () => {
    try {
      setTxPending(true); setMsg('')
      const signer = await getSigner()
      const c = new ethers.Contract(AUCTION_ADDRESS, AUCTION_ABI, signer) as any
      const tx = await c.claimNft(a.id)
      setMsg('领取中…')
      await tx.wait()
      setMsg('NFT 已领取！')
      onRefresh()
    } catch (e) { setMsg(`领取失败: ${decodeError(e)}`) }
    finally { setTxPending(false) }
  }

  // 回收 NFT
  const doReclaimNft = async () => {
    try {
      setTxPending(true); setMsg('')
      const signer = await getSigner()
      const c = new ethers.Contract(AUCTION_ADDRESS, AUCTION_ABI, signer) as any
      const tx = await c.reclaimNft(a.id)
      setMsg('回收中…')
      await tx.wait()
      setMsg('NFT 已回收！')
      onRefresh()
    } catch (e) { setMsg(`回收失败: ${decodeError(e)}`) }
    finally { setTxPending(false) }
  }

  return (
    <div className="detail" onClick={e => e.stopPropagation()}>
      <hr />
      <h4>拍卖详情</h4>
      <div className="detail-grid">
        <span>拍卖 ID</span><span>#{a.id}</span>
        <span>NFT 合约</span><span>{shortAddr(a.nftContract)}</span>
        <span>Token ID</span><span>{a.tokenId}</span>
        <span>卖家</span><span>{shortAddr(a.seller)}</span>
        <span>结束时间</span><span>{new Date(a.endTime * 1000).toLocaleString()}</span>
        <span>最高出价者</span><span>{shortAddr(a.highestBidder)}</span>
        <span>最高出价 (USD)</span><span>{formatUsd18(a.highestBidUsd)}</span>
        <span>最高出价 (原始)</span><span>{formatEth(a.highestBidAmount)}</span>
        <span>出价类型</span><span>{BID_TYPE_LABEL[a.highestBidType]}</span>
        <span>接受币种</span><span>{BID_TYPE_LABEL[a.acceptedBidType] ?? 'ETH + ERC20'}</span>
        <span>状态</span><span>{a.ended ? '已结束' : isActive ? '进行中' : '已过期'}</span>
      </div>

      {/* 出价区 */}
      {isActive && account && (
        <div className="action-group">
          <h5>出价</h5>
          <input
            type="number"
            step="0.001"
            placeholder="输入出价金额"
            value={bidAmount}
            onChange={e => setBidAmount(e.target.value)}
            disabled={txPending}
          />
          <div className="btn-row">
            {canBidEth && (
              <button className="btn" disabled={txPending || !bidAmount} onClick={doBidEth}>
                {txPending ? '提交中…' : 'ETH 出价'}
              </button>
            )}
            {canBidErc20 && (
              <button className="btn" disabled={txPending || !bidAmount} onClick={doBidErc20}>
                {txPending ? '提交中…' : 'ERC20 出价'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 操作区 */}
      <div className="action-group">
        {/* 结束拍卖：任何人可在过期后触发 */}
        {!a.ended && a.endTime <= now && account && (
          <button className="btn btn-warn" disabled={txPending} onClick={doEnd}>
            {txPending ? '提交中…' : '结束拍卖（结算）'}
          </button>
        )}

        {/* 领取 NFT：结束后赢家或卖家（无人出价） */}
        {a.ended && !a.nftClaimed && (isWinner || (isSeller && a.highestBidder === ethers.ZeroAddress)) && (
          <button className="btn btn-primary" disabled={txPending} onClick={doClaimNft}>
            {txPending ? '提交中…' : '领取 NFT'}
          </button>
        )}

        {/* 回收 NFT：卖家 + 结束 7 天后 + 未被 claim */}
        {a.ended && !a.nftClaimed && isSeller && a.highestBidder !== ethers.ZeroAddress && (
          <ReclaimButton
            auctionId={a.id}
            endedAt={a.endTime}
            txPending={txPending}
            doReclaim={doReclaimNft}
          />
        )}
      </div>
    </div>
  )
}

// ─── 回收按钮（带倒计时）───
function ReclaimButton({ auctionId: _auctionId, endedAt, txPending, doReclaim }: {
  auctionId: number
  endedAt: number
  txPending: boolean
  doReclaim: () => void
}) {
  const [reclaimableAt, setReclaimableAt] = useState<number | null>(null)
  const RECLAIM_DELAY = 7 * 24 * 3600 // 7 days

  useEffect(() => {
    // 尝试从合约读取精确 endedAt
    const fetchEndedAt = async () => {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum!)
        const c = new ethers.Contract(AUCTION_ADDRESS, AUCTION_ABI, provider) as any
        const at: bigint = await c.endedAt(_auctionId)
        setReclaimableAt(Number(at) + RECLAIM_DELAY)
      } catch {
        // 回退用 endTime
        setReclaimableAt(endedAt + RECLAIM_DELAY)
      }
    }
    fetchEndedAt()
  }, [_auctionId, endedAt])

  if (!reclaimableAt) return null
  const now = Math.floor(Date.now() / 1000)
  if (now >= reclaimableAt) {
    return (
      <button className="btn btn-warn" disabled={txPending} onClick={doReclaim}>
        {txPending ? '提交中…' : '回收 NFT（逾期未领）'}
      </button>
    )
  }
  const left = reclaimableAt - now
  const days = Math.floor(left / 86400)
  const hours = Math.floor((left % 86400) / 3600)
  return <span className="hint">回收倒计时: {days}天 {hours}小时</span>
}

// ════════════════════════════════════════════════════
//  创建拍卖弹窗
// ════════════════════════════════════════════════════
function CreateAuction({ account, txPending, setTxPending, setMsg, getSigner, onClose, onCreated }: {
  account: string | null
  txPending: boolean
  setTxPending: (v: boolean) => void
  setMsg: (s: string) => void
  getSigner: () => Promise<ethers.Signer>
  onClose: () => void
  onCreated: () => void
}) {
  const [tokenId, setTokenId] = useState('')
  const [duration, setDuration] = useState('24')
  const [bidType, setBidType] = useState('0') // 0=both, 1=ETH, 2=ERC20
  const [nftContract, setNftContract] = useState(NFT_ADDRESS)

  const doCreate = async () => {
    if (!account) return
    try {
      setTxPending(true); setMsg('')
      const signer = await getSigner()
      const nft = new ethers.Contract(nftContract, NFT_ABI, signer) as any

      // 0. 预检查：token 是否存在且属于当前用户
      setMsg('检查 NFT 所有权…')
      let owner: string
      try {
        owner = await nft.ownerOf(Number(tokenId))
      } catch {
        setMsg(`创建失败: Token ID ${tokenId} 不存在（未铸造），请先铸造 NFT`)
        return
      }
      if (owner.toLowerCase() !== account.toLowerCase()) {
        setMsg(`创建失败: Token ID ${tokenId} 不属于你（owner: ${shortAddr(owner)}）`)
        return
      }

      // 1. Approve NFT
      setMsg('授权 NFT…')
      const approveTx = await nft.approve(AUCTION_ADDRESS, Number(tokenId))
      await approveTx.wait()

      // 2. Create auction
      const auction = new ethers.Contract(AUCTION_ADDRESS, AUCTION_ABI, signer) as any
      setMsg('创建拍卖中…')
      const tx = await auction['createAuction(address,uint256,uint256,uint8)'](
        nftContract, Number(tokenId), Number(duration), Number(bidType)
      )
      await tx.wait()
      setMsg('拍卖创建成功！')
      onCreated()
    } catch (e) {
      setMsg(`创建失败: ${decodeError(e)}`)
    } finally {
      setTxPending(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>创建拍卖</h3>
        <label>
          NFT 合约地址
          <input value={nftContract} onChange={e => setNftContract(e.target.value)} disabled={txPending} />
        </label>
        <label>
          Token ID
          <input
            type="number"
            value={tokenId}
            onChange={e => setTokenId(e.target.value)}
            placeholder="0"
            disabled={txPending}
          />
        </label>
        <label>
          拍卖时长（小时）
          <input
            type="number"
            value={duration}
            onChange={e => setDuration(e.target.value)}
            placeholder="24"
            disabled={txPending}
          />
        </label>
        <label>
          接受出价币种
          <select value={bidType} onChange={e => setBidType(e.target.value)} disabled={txPending}>
            <option value="0">ETH + ERC20（混合）</option>
            <option value="1">仅 ETH</option>
            <option value="2">仅 ERC20</option>
          </select>
        </label>
        <div className="btn-row">
          <button className="btn" onClick={onClose} disabled={txPending}>取消</button>
          <button
            className="btn btn-primary"
            disabled={txPending || !tokenId || !duration}
            onClick={doCreate}
          >
            {txPending ? '提交中…' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}
