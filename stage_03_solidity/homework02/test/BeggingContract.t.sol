// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

// forge-std 的 Test 基础合约，提供了 vm（作弊码）、断言等测试工具
import {Test} from "forge-std/Test.sol";
import {BeggingContract} from "../src/BeggingContract.sol";

contract BeggingContractTest is Test {
    BeggingContract public c;

    // 测试合约本身就是 owner，因为部署合约的 msg.sender 就是 address(this)
    address public owner = address(this);
    // 准备 4 个测试用户地址
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public user3 = address(0x3);
    address public user4 = address(0x4);

    /// @notice 每个测试函数执行前都会先运行 setUp，用于初始化测试环境
    function setUp() public {
        // 部署合约，此时 msg.sender 是测试合约地址，所以测试合约就是 owner
        c = new BeggingContract();
        // vm.deal: Foundry 作弊码，给指定地址设置 ETH 余额（凭空造钱）
        // 这样测试用户就有钱可以捐赠了
        deal(user1, 10 ether);
        deal(user2, 10 ether);
        deal(user3, 10 ether); 
        deal(user4, 10 ether);
    }

    /// @notice 测试合约需要能接收 ETH，否则 withdraw 时的 call 转账会失败
    receive() external payable {}

    // ============================================================
    //                      donate 函数测试
    // ============================================================

    /// @notice 测试正常捐赠流程
    function test_donate() public {
        // vm.prank: 让下一次调用以 user1 的身份执行（模拟 user1 发起交易）
        vm.prank(user1);
        c.donate{value: 1 ether}(); // user1 捐赠 1 ETH

        // 验证三个状态都正确更新
        assertEq(c.totalDonations(), 1 ether);   // 总捐赠额 = 1
        assertEq(c.donations(user1), 1 ether);   // user1 的捐赠记录 = 1
        assertEq(address(c).balance, 1 ether);   // 合约余额 = 1
    }

    /// @notice 测试捐赠金额为 0 时应该 revert
    function test_donate_revertZero() public {
        vm.prank(user1);
        // vm.expectRevert: 断言下一次调用会 revert，并且错误消息匹配
        vm.expectRevert(bytes("zero"));
        c.donate{value: 0}(); // 捐赠 0 ETH，应该失败
    }

    /// @notice 测试提现关闭后不能再捐赠
    function test_donate_revertWhenClosed() public {
        // 先让 user1 捐一笔
        vm.prank(user1);
        c.donate{value: 1 ether}();

        // owner（测试合约）执行提现，合约状态变为 closed
        c.withdraw();

        // closed 后，user2 再捐赠应该被拒绝
        vm.prank(user2);
        vm.expectRevert(bytes("donations closed"));
        c.donate{value: 1 ether}();
    }

    /// @notice 测试捐赠时是否正确触发 Donation 事件
    function test_donate_emitsEvent() public {
        vm.prank(user1);
        // vm.expectEmit: 断言接下来会触发指定的事件
        // 参数: (checkTopic1, checkTopic2, checkTopic3, checkData)
        // true 表示检查该字段是否匹配
        vm.expectEmit(true, false, false, true);
        // 先 emit 期望的事件，forge 会和实际触发的事件做对比
        emit BeggingContract.Donation(user1, 1 ether);
        c.donate{value: 1 ether}();
    }

    // ============================================================
    //                      withdraw 函数测试
    // ============================================================

    /// @notice 测试正常提现流程
    function test_withdraw() public {
        // user1 捐赠 2 ETH
        vm.prank(user1);
        c.donate{value: 2 ether}();

        // 记录提现前 owner 的余额
        uint256 balanceBefore = address(this).balance;
        // owner（测试合约）执行提现
        c.withdraw();

        // 验证：合约余额清零、totalDonations 清零、owner 收到 ETH
        assertEq(address(c).balance, 0);
        assertEq(c.totalDonations(), 0);
        assertEq(address(this).balance, balanceBefore + 2 ether);
    }

    /// @notice 测试非 owner 调用 withdraw 会被拒绝
    function test_withdraw_revertNotOwner() public {
        // 先捐一笔钱进去
        vm.prank(user1);
        c.donate{value: 1 ether}();

        // user1（非 owner）尝试提现，应该 revert
        // Ownable 的 onlyOwner 检查不通过会 revert，不需要匹配具体消息
        vm.prank(user1);
        vm.expectRevert();
        c.withdraw();
    }

    /// @notice 测试合约余额为 0 时不能提现
    function test_withdraw_revertNoBalance() public {
        // 没有人捐赠，直接尝试提现
        vm.expectRevert(bytes("No balance to withdraw"));
        c.withdraw();
    }

    /// @notice 测试提现后 closed 状态被设为 true
    function test_withdraw_setsClosed() public {
        vm.prank(user1);
        c.donate{value: 1 ether}();

        c.withdraw();
        // 提现后合约应该标记为关闭
        assertTrue(c.closed());
    }

    /// @notice 测试提现时触发 Closed 事件
    function test_withdraw_emitsClosed() public {
        vm.prank(user1);
        c.donate{value: 1 ether}();

        // Closed 事件没有 indexed 参数，所以 topic1-3 都不检查，只检查 data
        vm.expectEmit(false, false, false, true);
        emit BeggingContract.Closed();
        c.withdraw();
    }

    // ============================================================
    //                      getDonation 函数测试
    // ============================================================

    /// @notice 测试查询捐赠金额
    function test_getDonation() public {
        vm.prank(user1);
        c.donate{value: 3 ether}();

        // user1 捐了 3 ETH，user2 没捐过
        assertEq(c.getDonation(user1), 3 ether);
        assertEq(c.getDonation(user2), 0); // 未捐赠的地址返回 0
    }

    /// @notice 测试同一用户多次捐赠会累加
    function test_getDonation_accumulates() public {
        // vm.startPrank / vm.stopPrank: 让中间所有调用都以 user1 身份执行
        vm.startPrank(user1);
        c.donate{value: 1 ether}();
        c.donate{value: 2 ether}();
        vm.stopPrank();

        // 两次捐赠应该累加：1 + 2 = 3
        assertEq(c.getDonation(user1), 3 ether);
    }

    // ============================================================
    //                      Top3 排行榜测试
    // ============================================================

    /// @notice 测试只有一个人捐赠时，Top3 的第一位就是该用户
    function test_topDonors_single() public {
        vm.prank(user1);
        c.donate{value: 1 ether}();

        (address[3] memory addrs, uint256[3] memory amounts) = c.getTopDonors();
        assertEq(addrs[0], user1);      // 第 1 名是 user1
        assertEq(amounts[0], 1 ether);  // 金额 1 ETH
        // addrs[1] 和 addrs[2] 是 address(0)，因为只有一个人捐过
    }

    /// @notice 测试三个人捐赠后排行榜按金额从大到小排列
    function test_topDonors_threeUsers() public {
        // 按捐赠顺序：user1=1, user2=3, user3=2
        vm.prank(user1);
        c.donate{value: 1 ether}();
        vm.prank(user2);
        c.donate{value: 3 ether}();
        vm.prank(user3);
        c.donate{value: 2 ether}();

        // 排行榜应该按金额排序：user2(3) > user3(2) > user1(1)
        (address[3] memory addrs, uint256[3] memory amounts) = c.getTopDonors();
        assertEq(addrs[0], user2); // 3 ether
        assertEq(addrs[1], user3); // 2 ether
        assertEq(addrs[2], user1); // 1 ether
        assertEq(amounts[0], 3 ether);
        assertEq(amounts[1], 2 ether);
        assertEq(amounts[2], 1 ether);
    }

    /// @notice 测试新捐赠者挤掉排行榜末位
    function test_topDonors_kicksOutThird() public {
        // 先让 3 个人占满排行榜：user3(3) > user2(2) > user1(1)
        vm.prank(user1);
        c.donate{value: 1 ether}();
        vm.prank(user2);
        c.donate{value: 2 ether}();
        vm.prank(user3);
        c.donate{value: 3 ether}();

        // user4 捐赠 1.5 ETH，超过 user1 的 1 ETH，挤掉 user1
        vm.prank(user4);
        c.donate{value: 1.5 ether}();

        (address[3] memory addrs,) = c.getTopDonors();
        assertEq(addrs[0], user3); // 3 ether（不变）
        assertEq(addrs[1], user2); // 2 ether（不变）
        assertEq(addrs[2], user4); // 1.5 ether（挤掉了 user1）
    }

    /// @notice 测试已上榜的捐赠者追加捐赠后排名更新
    function test_topDonors_existingDonorUpdates() public {
        // 初始排行榜：user3(3) > user2(2) > user1(1)
        vm.prank(user1);
        c.donate{value: 1 ether}();
        vm.prank(user2);
        c.donate{value: 2 ether}();
        vm.prank(user3);
        c.donate{value: 3 ether}();

        // user1 追加捐赠 3 ETH，累计 4 ETH，从第 3 名跃升到第 1 名
        vm.prank(user1);
        c.donate{value: 3 ether}();

        (address[3] memory addrs,) = c.getTopDonors();
        assertEq(addrs[0], user1); // 4 ether（从榜尾升到第 1）
        assertEq(addrs[1], user3); // 3 ether（降为第 2）
        assertEq(addrs[2], user2); // 2 ether（降为第 3）
    }

    // ============================================================
    //                      边界情况测试
    // ============================================================

    /// @notice 测试提现时转账失败的情况
    /// 用一个拒绝接收 ETH 的合约作为 owner，模拟 call 转账失败
    function test_withdraw_revertTransferFailed() public {
        // 部署一个拒绝收款的合约作为 owner
        RevertReceiver receiver = new RevertReceiver();
        // 用 receiver 部署合约，receiver 就是 owner
        vm.prank(address(receiver));
        BeggingContract newC = new BeggingContract();

        // user1 向新合约捐赠 1 ETH
        vm.prank(user1);
        newC.donate{value: 1 ether}();

        // owner（receiver）尝试提现，但 RevertReceiver 拒绝收款，call 返回 false
        vm.prank(address(receiver));
        vm.expectRevert(bytes("withdraw failed"));
        newC.withdraw();
    }
}

/// @notice 一个拒绝接收 ETH 的合约，用于模拟转账失败
contract RevertReceiver {
    receive() external payable {
        revert("I refuse ETH");
    }
}
