// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ERC1967Proxy
/// @dev 标准 EIP-1967 代理。implementation 地址存在固定 slot，所有调用通过 delegatecall 转发。
///      UUPS 升级由实现合约的 upgradeToAndCall 通过 delegatecall 修改本 slot 完成。
///      注：Hardhat V3 默认不为外部依赖（如 OZ）生成 artifact，所以把代理放在项目内，
///      这样能生成 artifact，测试/部署才能用 deployContract("ERC1967Proxy")。
contract ERC1967Proxy {
    // bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1)
    bytes32 private constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    constructor(address impl, bytes memory initData) {
        require(impl != address(0) && impl.code.length > 0, "ERC1967Proxy: invalid impl");
        assembly {
            sstore(_IMPLEMENTATION_SLOT, impl)
        }
        if (initData.length > 0) {
            (bool ok, bytes memory ret) = impl.delegatecall(initData);
            if (!ok) {
                // 冒泡 delegatecall 的 revert 数据，便于排查 init 失败原因
                assembly {
                    revert(add(ret, 0x20), mload(ret))
                }
            }
        }
    }

    function implementation() external view returns (address impl) {
        assembly {
            impl := sload(_IMPLEMENTATION_SLOT)
        }
    }

    fallback() external payable {
        assembly {
            let impl := sload(_IMPLEMENTATION_SLOT)
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    receive() external payable {}
}
