#!/bin/bash

export https_proxy=http://192.168.32.1:7890
export http_proxy=http://192.168.32.1:7890

# 从部署钱包捐赠 0.01 ETH
~/.foundry/bin/cast send 0xfDe529ccfF8b831C7EF7076eA98AeBB55440B330 \
  "donate()" \
  --value 0.02ether \
  --rpc-url https://sepolia.drpc.org \
  --private-key 0xd0e732433e50b0ea96e400f2a295c459dd66014e8830870364cfd993b91aadbb