/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUCTION_ADDRESS: string
  readonly VITE_NFT_ADDRESS: string
  readonly VITE_CHAIN_ID: string
  readonly VITE_RPC_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
