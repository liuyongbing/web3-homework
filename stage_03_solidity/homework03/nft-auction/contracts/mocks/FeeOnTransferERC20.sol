// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev 测试用：fee-on-transfer（通缩）ERC20。每次普通转账扣 feeBp/10000 销毁，实到 < amount。
///      用于验证 bidWithErc20 用「余额差」记账而非 amount，否则资金不守恒（最后提款者 DoS）。
///      实现注意：在 transfer/transferFrom 层拦截通缩，而不 override _update ——
///      否则 super._update(from,to,...) 会虚分派回自身 if 分支，对实到额再扣一次费（重复扣）。
contract FeeOnTransferERC20 is ERC20 {
    uint8 private _decimals;
    uint256 public feeBp; // 通缩费率（基点），默认 100 = 1%

    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
        feeBp = 100; // 1%
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice 测试用：调整通缩费率（基点）。10000 = 100% 实到为 0
    function setFeeBp(uint256 _feeBp) external {
        require(_feeBp <= 10000, "fee>100%");
        feeBp = _feeBp;
    }

    /// @dev 通缩转账核心：实到 amount-fee 给 to，fee 销毁。super._update 必落 OZ 实现（本合约未 override _update）。
    function _send(address from, address to, uint256 amount) internal {
        uint256 fee = (amount * feeBp) / 10000;
        super._update(from, to, amount - fee); // 实到
        if (fee > 0) super._update(from, address(0), fee); // 销毁
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        _send(_msgSender(), to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, amount);
        _send(from, to, amount);
        return true;
    }
}
