```bash
> nft-auction@1.0.0 test:coverage
> hardhat test --coverage

No contracts to compile

Running Solidity tests

  test/GasBench.t.sol:GasBench
=== decimals() warm external call ===
gas: 4094
decimals: 8
    ✔ test_decimalsWarmCost()
=== bidWithEth V2 (decimals cached) ===
gas: 107388
    ✔ test_bidWithEth_V2()
=== bidWithEth V1 (decimals live) ===
gas: 112646
    ✔ test_bidWithEth_V1()
=== bidWithErc20 V2 (decimals cached) ===
gas: 140439
    ✔ test_bidWithErc20_V2()
=== bidWithErc20 V1 (decimals live x2) ===
gas: 146435
    ✔ test_bidWithErc20_V1()

Running node:test tests

  F7 反向分账资金守恒边界
    ✔ winner==owner: conservation holds (82ms)
    ✔ winner==seller (self-bid): conservation holds
    ✔ royalty receiver==seller: conservation holds (90ms)
    ✔ royalty receiver==owner: conservation holds
    ✔ owner withdrew fee → N1 软扣减：reclaim 仍成功，winner 退可扣额（owner fee 追不回）
    ✔ 资金守恒不变量：一组 bid/end/withdraw 后，合约 ETH 余额 == sum(pendingEth)

  MyNFT：mint / 版税 / 接口 / F8 tokenId 存在性
    ✔ mint（一参数）铸造 NFT
    ✔ mintWithRoyalty（三参数）铸造并设置版税
    ✔ mintWithRoyalty fee 超限 revert（FeeTooHigh）
    ✔ setTokenRoyalty 设置 + 超限 revert
    ✔ 非 owner 调 mint revert（OwnableUnauthorizedAccount）
    ✔ supportsInterface（ERC721 + ERC2981 合并）
    ✔ setBaseURI + tokenURI
    ✔ F8：setTokenRoyalty 对未铸造的 tokenId revert（防脏数据）
    ✔ F8：setTokenRoyalty 对已铸造 tokenId 正常（修复不破坏正常路径）
    ✔ F8：mintWithRoyalty 仍正常（绕过 setTokenRoyalty，不受 F8 影响）
    ✔ MockPriceFeed setPrice + MockERC20 decimals 覆盖（基础设施）

  NFTAuction (V1)
    pull 模式基础生命周期
      ✔ initialize 正确配置 + version 返回 v1
      ✔ createAuction 后 NFT 托管进合约（auctionId 从 1 开始）
      ✔ bidder1 用 1 ETH 出价
      ✔ bidder2 超过时：bidder1 的退款「记账」到 pendingEth（pull，不直接转账）
      ✔ bidder1 withdraw 提取退款
      ✔ 结算：卖家收款记账到 pendingEth（pull，不直接转账）
      ✔ seller withdraw 提取 2 ETH
      ✔ ERC20 出价 + 超越退款 + 结算（pull）
      ✔ 无人出价结算：卖家 claimNft 领回 NFT（pull 出站）
      ✔ pause / unpause 控制
      ✔ initialize 零地址 revert（custom error）
    F2 单币种锁定（消除跨币种套利）
      ✔ F2：Eth 锁定拍卖，bidWithEth 成功 + acceptedBidType 正确记录
      ✔ F2：Eth 锁定拍卖，bidWithErc20 被 BidTypeNotAllowed 拒绝
      ✔ F2：Erc20 锁定拍卖，bidWithErc20 成功 + acceptedBidType 正确记录
      ✔ F2：Erc20 锁定拍卖，bidWithEth 被 BidTypeNotAllowed 拒绝
      ✔ F2：混合拍卖（3 参数版本，acceptedBidType=None）两种出价皆可（向后兼容）
      ✔ F2 PoC：Erc20 锁定拍卖，攻击者无法用 ETH 出价（消除币种切换套利）
      ✔ F2：锁定拍卖的结算 / claimNft 生命周期正常（不破坏既有流程）
    毒出价 DoS 防护（pull 模式防卡死）
      ✔ 毒出价者先出价，正常账户再出更高价：不 revert（pull 模式退款只记账）
      ✔ 结算正常完成（pull 模式下毒出价者不影响卖家收款记账）
      ✔ 毒出价者的资金仍安全记账在 pendingEth，seller 正常 withdraw
      ✔ 毒出价者自己 withdraw 会 revert（EthTransferFailed），但资金仍安全记账、合约未卡死
    F1 通缩代币资金守恒 + F6 时长上限
      ✔ F1：通缩代币出价，pendingErc20 按实际到账量记账（而非声称 amount），资金守恒
      ✔ F1：通缩代币连续出价，被超过者的退款也按实到量守恒（无欠账）
      ✔ F1：通缩率拉到 100% 使实到为 0，按 ZeroBid 拒绝（防 0 实到记账）
      ✔ F6：MAX_DURATION_HOURS = 8760（1 年）
      ✔ F6：duration 上限正好通过（8760）
      ✔ F6：duration 超上限（8761）revert（DurationTooLong）
      ✔ F6：duration 极大值（会溢出）revert，不再触发算术溢出 Panic
    错误分支与边界
      ✔ createAuction duration=0 revert（DurationInvalid）
      ✔ bidWithEth 零出价 revert（ZeroBid）
      ✔ bidWithErc20 零出价 revert（ZeroBid）
      ✔ bid 出价过低 revert（BidTooLow）
      ✔ ERC20 出价过低 revert（BidTooLow，声称量检查 line 265）
      ✔ ERC20 通缩复核：声称价高于最高价但实到过低 revert（BidTooLow，receivedUsd 复核 line 281）
      ✔ 对不存在拍卖出价 revert（AuctionNotFound）
      ✔ ERC20 出价超越：被超过者退款记到 pendingErc20
      ✔ 无人出价结算：卖家 claimNft 领回 + endAuction 重复 revert
      ✔ endAuction 未到期 revert（AuctionNotOver）
      ✔ withdraw 无可提取 revert（NothingToWithdraw）
      ✔ V1 结算 ETH（pull 记账给卖家）+ withdraw
      ✔ initialize decimals 超限 revert（InvalidDecimals）
      ✔ endAuction 对不存在拍卖 revert（AuctionNotFound）
      ✔ bidWithErc20 对不存在拍卖 revert（AuctionNotFound in _assertActive）
      ✔ ERC20 withdraw 提取 pendingErc20
      ✔ PriceConverter 非法价格 revert（answer<=0 → NegativePrice）
      ✔ PriceConverter 陈旧价格 revert（updatedAt 超 1h / round 不完整）
      ✔ bid 已过期拍卖 revert（AuctionNotOver）
      ✔ bid 已结束拍卖 revert（AuctionAlreadyEnded）
      ✔ claimNft：未结算时 revert（AuctionNotEnded）
      ✔ claimNft：非赢家/卖家 revert（NotWinnerOrSeller）+ 重复领 revert（NftAlreadyClaimed）

  NFTAuctionV2
    UUPS 升级 + 平台手续费
      ✔ 升级前：V1 拍卖数据已存在（auctionId=1）
      ✔ owner 执行 UUPS 升级到 V2（upgradeToAndCall + initializeV2）
      ✔ version() 返回 'v2'
      ✔ platformFeeBp 已通过 initializeV2 设置为 300
      ✔ initializeV2 缓存了两个 feed 的 decimals（Gas 优化，==8）
      ✔ 升级后 V1 配置完整保留（ethUsdFeed / paymentToken / decimals）
      ✔ 升级后 V1 拍卖数据完整保留（bidder1 的 1 ETH 出价）
      ✔ V2 ETH 结算：pull 记账，pendingEth[owner] 收 3% 手续费、pendingEth[seller] 收剩余
      ✔ owner withdraw 提取 0.06 ETH 手续费
      ✔ seller withdraw 提取 1.94 ETH
      ✔ V2 ERC20 结算：pull 记账，pendingErc20[owner] 收手续费、pendingErc20[seller] 收剩余
      ✔ owner 可更新 platformFeeBp
      ✔ setPlatformFee 超出 10000 时 revert
      ✔ MAX_PLATFORM_FEE_BP = 2500：正好 2500 通过，2501 revert
      ✔ 非 owner 调用 setPlatformFee revert
      ✔ initializeV2 不可重复调用（reinitializer(2)）
      ✔ initializeV2 fee 超限时 revert（新代理验证）
      ✔ MAX_FEE_BP 常量 = 10000
    N2 / N3 / N4：升级抢跑 + 事件
      ✔ N2：非 owner 调 initializeV2 revert（OwnableUnauthorizedAccount，防升级抢跑）
      ✔ N3：通缩代币出价，BidPlaced 事件 amount == 实到 received（非声称量）
      ✔ N4：reclaimNft 触发 NftRefunded 事件（退款给赢家，金额对链下可观测）
    Coverage：V2 升级后 ERC20 结算 pull 记账
      ✔ 升级到 V2：ERC20 结算 pull 记账（owner 手续费 + seller 剩余）

  NFTAuctionV3 ERC2981 版税
    ✔ version 返回 v3
    ✔ ROYALTY_CAP_BP 常量 = 1000（10%）
    ✔ ETH 结算：平台费给 owner + 版税给 author + 剩余给 seller（三方 pendingEth 记账）
    ✔ 版税上限：作者设 100%（10000bp），V3 cap 到 10%（1000bp），不卡死
    ✔ ERC20 结算：平台费 + 版税 + 剩余（三方 pendingErc20 记账）
    ✔ catch 分支：NonERC2981NFT（普通 ERC721）无版税
    ✔ F3：恶意 NFT 的 royaltyInfo 死循环，V3 结算不 OOG，catch 回退不计版税
    ✔ F3：正常 ERC2981 的 royaltyInfo 在 gas cap 内正常计版税（不被误杀）
    ✔ V3 极端费率兜底：fee 25%（MAX_PLATFORM_FEE_BP）+ 版税 100%（cap 10%）不锁死，seller 收 65%
    ✔ V3 receiver=0 版税：版税 receiver 为 0 地址时不计版税，全归 seller（防资金沉淀到 0 地址）
    ✔ 升级到 V3：NonERC2981NFT（catch 分支）+ ERC20 结算
    ✔ ZeroReceiverRoyaltyNFT.supportsInterface(ERC2981) = true + royaltyInfo 返回 receiver=0

  F7 NFT 超时回收（带退款保护）
    ✔ F7：无人出价拍卖，结算超时后卖家 reclaimNft 领回 NFT
    ✔ F7（V1 ETH）：赢家逾期未领，卖家回收 NFT + 全额退款给赢家
    ✔ F7：非卖家调用 reclaimNft revert（NotSeller）
    ✔ F7：赢家已 claimNft 后，卖家 reclaimNft revert（NftAlreadyClaimed）
    ✔ F7 N1：卖家已 withdraw，软扣减使 reclaim 仍成功（NFT 回卖家），赢家退实际可扣额
    ✔ F7 N1：V3 版税作者提现版税不锁死卖家回收（软扣减，author 部分追不回）
    ✔ F7（V2）：reclaim 扣回 fee(owner) + toSeller(seller)，全额退赢家
    ✔ F7（V3）：reclaim 扣回 fee + royalty + toSeller，全额退赢家（三方快照一致）
    ✔ F7：reclaimNft 对不存在的拍卖 revert（AuctionNotFound，line 345）
    ✔ F7：reclaimNft 对未结算拍卖 revert（AuctionNotEnded，line 346）
    ✔ F7（ERC20 出价）：reclaimNft 反向退款走 _debit 的 ERC20 分支（line 480-482）


  ✔ /code/web3.com/web3-homework/stage_03_solidity/homework03/nft-auction/test/helpers.ts


119 passing (5 solidity, 114 nodejs)

Saved html report to /code/web3.com/web3-homework/stage_03_solidity/homework03/nft-auction/coverage/html
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                Coverage Report                                ║
╚═══════════════════════════════════════════════════════════════════════════════╝
╔═══════════════════════════════════════════════════════════════════════════════╗
║ File Coverage                                                                 ║
╟──────────────────────────────────────┬────────┬─────────────┬─────────────────╢
║ File Path                            │ Line % │ Statement % │ Uncovered Lines ║
╟──────────────────────────────────────┼────────┼─────────────┼─────────────────╢
║ contracts/library/PriceConverter.sol │ 100.00 │ 100.00      │ -               ║
║ contracts/MyNFT.sol                  │ 100.00 │ 100.00      │ -               ║
║ contracts/NFTAuction.sol             │ 99.32  │ 99.43       │ 469             ║
║ contracts/NFTAuctionV2.sol           │ 100.00 │ 100.00      │ -               ║
║ contracts/NFTAuctionV3.sol           │ 100.00 │ 100.00      │ -               ║
╟──────────────────────────────────────┼────────┼─────────────┼─────────────────╢
║ Total                                │ 99.54  │ 99.61       │                 ║
╚══════════════════════════════════════╧════════╧═════════════╧═════════════════╝


