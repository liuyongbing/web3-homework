# Go 基础作业 02 - 进阶语法

本作业对应学习路径中的 **基础1-Go开发基础** - 进阶部分 (指针、Goroutine、面向对象、Channel、锁)。

## 目录结构

- `homework.go`: 答题文件，请在此文件中填写代码。
- `homework_test.go`: 测试文件，用于验证你的代码。

## 作业任务

请在 `homework.go` 文件中找到对应的 `TODO` 注释并完成以下任务：

1. **指针 (Pointer)**: 
   - 实现 `AddTen`: 指针传参修改值。
   - 实现 `DoubleSlice`: 通过指针修改切片内容。
2. **并发 (Goroutine)**: 
   - 实现 `PrintOddEven`: 双协程交替或并发打印奇偶数。
   - 实现 `TaskScheduler`: 并发任务调度。
3. **面向对象 (OOP)**: 
   - 实现 `Shape` 接口 (Rectangle 和 Circle)。
   - 实现 `Employee` 组合结构体及方法。
   - **注意**：你需要为 `Rectangle` 和 `Circle` 实现 `Area()` 和 `Perimeter()` 方法，否则测试代码可能编译失败。
4. **通道 (Channel)**: 
   - 实现 `ProducerConsumer`: 简单的无缓冲通道通信。
   - 实现 `BufferedChannel`: 缓冲通道的使用。
5. **锁机制 (Lock)**: 
   - 实现 `MutexCounter`: 使用互斥锁保证计数安全。
   - 实现 `AtomicCounter`: 使用原子操作保证计数安全。

## 运行测试

在当前目录下运行以下命令进行自测：

```bash
go test -v
```

如果所有测试通过，你将看到 `PASS`。

## 提交作业

请将完成的代码推送到代码仓库，GitHub Actions 会自动运行测试脚本进行评分验证。

