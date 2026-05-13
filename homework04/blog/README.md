# 个人博客系统后端

基于 Go + Gin + GORM + MySQL 的个人博客系统后端，支持用户认证、文章管理和评论功能。

## 运行环境

- Go 1.25+
- MySQL 8.0+

## 依赖安装

```bash
cd blog
go mod tidy
```

## 配置说明

编辑 `config/config.yaml`，修改数据库连接和服务端口：

```yaml
server:
  Port: 8080

jwt:
  secret: change-me-in-production
  expire: "24h"

mysql:
  Host: 127.0.0.1
  Port: 3306
  DBName: web3_blog
  Username: root
  Password: root
```

> 启动前请先创建 MySQL 数据库：`CREATE DATABASE web3_blog CHARACTER SET utf8mb4;`

## 启动方式

```bash
# 数据库迁移（首次运行）
go run cmd/migration/main.go

# 启动服务
go run cmd/backend/main.go
```

服务默认监听 `http://localhost:8080`。

## API 接口

### 基础接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/` | 服务时间 | 否 |
| GET | `/health` | 健康检查 | 否 |
| GET | `/ping` | 连通测试 | 否 |

### 用户模块

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/v1/users` | 用户注册 | 否 |
| POST | `/api/v1/users/login` | 用户登录 | 否 |

### 文章模块

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/v1/posts` | 文章列表 | 否 |
| GET | `/api/v1/posts/:id` | 文章详情 | 否 |
| POST | `/api/v1/posts` | 创建文章 | 是 |
| PUT | `/api/v1/posts/:id` | 更新文章 | 是（仅作者） |
| DELETE | `/api/v1/posts/:id` | 删除文章 | 是（仅作者） |

### 评论模块

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/v1/comments/post/:post_id` | 文章评论列表 | 否 |
| POST | `/api/v1/comments` | 发表评论 | 是 |

## 请求示例

### 用户注册

```bash
curl -X POST http://localhost:8080/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"123456","email":"test@example.com"}'
```

### 用户登录

```bash
curl -X POST http://localhost:8080/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"123456"}'
```

返回：
```json
{"token":"eyJhbGciOiJIUzI1NiIs..."}
```

### 创建文章

```bash
curl -X POST http://localhost:8080/api/v1/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"title":"My First Post","content":"Hello World"}'
```

### 文章列表（分页）

```bash
curl "http://localhost:8080/api/v1/posts?page=1&size=10"
```

### 更新文章

```bash
curl -X PUT http://localhost:8080/api/v1/posts/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"title":"Updated Title","content":"Updated content"}'
```

### 删除文章

```bash
curl -X DELETE http://localhost:8080/api/v1/posts/1 \
  -H "Authorization: Bearer <token>"
```

### 发表评论

```bash
curl -X POST http://localhost:8080/api/v1/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"post_id":1,"content":"Great article!"}'
```

### 查看文章评论

```bash
curl "http://localhost:8080/api/v1/comments/post/1?page=1&size=10"
```

## 项目结构

```
blog/
├── cmd/
│   ├── backend/        # 服务入口
│   └── migration/      # 数据库迁移
├── config/             # 配置文件 (config.yaml)
├── handlers/           # 请求处理器
├── initialize/         # 初始化 (DB, JWT, Logger)
├── middlewares/        # 中间件 (JWT 认证)
├── models/             # GORM 模型
├── requests/           # 请求结构体
├── routes/             # 路由定义
├── scripts/            # SQL 脚本
├── go.mod
└── go.sum
```

## 技术栈

| 组件 | 技术 |
|------|------|
| Web 框架 | Gin |
| ORM | GORM |
| 数据库 | MySQL |
| 认证 | JWT (golang-jwt/jwt/v5) |
| 密码加密 | bcrypt (golang.org/x/crypto) |
| 配置管理 | Viper |
