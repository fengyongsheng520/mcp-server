# 语雀 MCP Server

[![npm version](https://img.shields.io/npm/v/@wojiaoxiaofenfen/yuque-mcp)](https://www.npmjs.com/package/@wojiaoxiaofenfen/yuque-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

通过 [MCP (Model Context Protocol)](https://modelcontextprotocol.io) 协议接入[语雀](https://www.yuque.com/)知识库，让 AI 助手（如 Claude Code、VS Code Copilot 等）能够直接操作语雀文档。支持笔记的**增、删、改、查**，提供 **Stdio** 和 **Streamable HTTP** 两种传输模式。

---

## 目录

- [功能特性](#功能特性)
- [快速开始](#快速开始)
  - [安装](#安装)
  - [获取语雀 Token](#获取语雀-token)
- [使用方式](#使用方式)
  - [方式一：Stdio 模式（本地进程通信）](#方式一stdio-模式本地进程通信)
  - [方式二：Streamable HTTP 模式（远程服务）](#方式二streamable-http-模式远程服务)
- [可用工具](#可用工具)
- [鉴权机制](#鉴权机制)
- [本地开发](#本地开发)
- [项目结构](#项目结构)
- [技术栈](#技术栈)
- [License](#license)

---

## 功能特性

| 功能 | 说明 |
|------|------|
| 📋 **获取知识库信息** | 通过 `namespace` 查询知识库详情，返回仓库整体信息 |
| 📄 **读取笔记** | 按 `repoId` + `docsId` 获取单篇笔记的完整 Markdown 内容 |
| ✏️ **创建笔记** | 在指定知识库中以 Markdown 格式创建新笔记 |
| 🔄 **更新笔记** | 修改已有笔记的标题和/或正文内容 |
| 🔐 **多方式鉴权** | 命令行参数、环境变量、HTTP Header 三种 Token 传递方式 |
| 🌐 **双传输模式** | Stdio（本地）和 Streamable HTTP（远程）两种 MCP 传输协议 |
| 🔁 **环境变量占位符** | HTTP Header 中支持 `${VAR}` 和 `${env:VAR}` 占位符自动解析 |

---

## 快速开始

### 安装

**方式 A — 从 npm 直接使用（推荐）：**

```bash
npx @wojiaoxiaofenfen/yuque-mcp
```

也可以使用 `npx` 配合 CLI 参数：

```bash
npx yuque-server-mcp --token <your-yuque-token>
```

**方式 B — 全局安装：**

```bash
npm install -g @wojiaoxiaofenfen/yuque-mcp
```

**方式 C — 从源码构建：**

```bash
git clone https://github.com/sheng/yuque-mcp.git
cd yuque-mcp
npm install
npm run build
```

### 获取语雀 Token

1. 登录 [语雀](https://www.yuque.com/) → 点击头像 → **个人设置**
2. 进入 [Token 管理](https://www.yuque.com/settings/tokens) 页面
3. 点击 **新建 Token**，填写用途说明后复制生成的密钥

> ⚠️ Token 仅创建时可见一次，请妥善保存。

---

## 使用方式

### 方式一：Stdio 模式（本地进程通信）

适用于本地 MCP 客户端（如 Claude Desktop、VS Code 扩展等），通过标准输入输出与服务端通信。

#### 配置示例 — 命令行参数传 Token

```json
{
  "mcpServers": {
    "yuque-mcp": {
      "command": "node",
      "args": [
        "./build/stdio.js",
        "--token",
        "your-yuque-token"
      ]
    }
  }
}
```

#### 配置示例 — 环境变量传 Token

```json
{
  "mcpServers": {
    "yuque-mcp": {
      "command": "node",
      "args": ["./build/stdio.js"],
      "env": {
        "YUQUE_TOKEN": "your-yuque-token"
      }
    }
  }
}
```

> **Token 解析优先级：** `--token` 命令行参数 > `YUQUE_TOKEN` 环境变量

---

### 方式二：Streamable HTTP 模式（远程服务）

适用于将 MCP Server 部署为独立服务，多个客户端通过网络访问。

#### 启动服务端

```bash
# 设置环境变量
export YUQUE_TOKEN="your-yuque-token"

# 默认端口 3000 启动
npm run streamable

# 指定端口
PORT=8080 npm run streamable
```

服务启动后将输出：

```
✅ MCP Streamable HTTP 服务器已启动
   端点: http://localhost:3000/mcp
   鉴权方式: Yuque-Token header / Authorization Bearer / YUQUE_TOKEN 环境变量
   在 MCP Inspector 中输入此地址即可调试
```

#### 客户端配置

```json
{
  "mcpServers": {
    "yuque": {
      "type": "streamable-http",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Yuque-Token": "Bearer ${YUQUE_TOKEN}"
      }
    }
  }
}
```

> **提示：** Header 中的 `${YUQUE_TOKEN}` 由客户端负责解析为实际的 Token 值。如果客户端不支持占位符替换，也可以直接填写明文 Token。

---

## 可用工具

服务端向 AI 客户端暴露以下 4 个 MCP Tool：

| 工具名称 | 功能描述 | 必需参数 |
|----------|----------|----------|
| `yuque_get_notes` | 获取知识库信息 | `namespace` — 知识库路径（如 `my-team/my-repo`） |
| `yuque_get_note_detail` | 获取单篇笔记详情 | `repoId` — 知识库 ID<br>`docsId` — 笔记 ID |
| `yuque_create_note` | 创建新笔记 | `repoId` — 知识库 ID<br>`title` — 笔记标题<br>`content` — Markdown 内容 |
| `yuque_write_note` | 更新已有笔记 | `repoId` — 知识库 ID<br>`docsId` — 笔记 ID<br>`content` — Markdown 内容 |

> **注意：** `repoId` 是数字 ID（如 `123456`），而非 `namespace` 路径。可通过 `yuque_get_notes` 工具先查询知识库信息获取。

---

## 鉴权机制

### Token 解析优先级

| 传输模式 | 优先级 1 | 优先级 2 | 优先级 3 |
|----------|----------|----------|----------|
| **Stdio** | `--token` 命令行参数 | `YUQUE_TOKEN` 环境变量 | — |
| **Streamable HTTP** | `Yuque-Token` 请求头 | `Authorization: Bearer` 请求头 | `YUQUE_TOKEN` 服务端环境变量 |

### 环境变量占位符（仅 HTTP 模式）

服务端会自动解析 Header 中的环境变量占位符，支持两种语法：

```
Yuque-Token: Bearer ${YUQUE_TOKEN}       # 简洁写法
Yuque-Token: Bearer ${env:YUQUE_TOKEN}   # MCP 标准写法
```

解析过程会进行脱敏日志输出，保护 Token 安全。

### 无 Token 场景

Token 不是启动的先决条件——即使未配置 Token，MCP Server 也能正常启动，客户端仍然可以获取工具列表。只有在实际调用 API 时才会触发鉴权错误。这在以下场景中有用：

- AI 客户端需要先发现可用工具，再由用户决定是否提供 Token
- 只读场景下可以延迟配置

---

## 本地开发

```bash
# 安装依赖
npm install

# 监听模式编译（修改 TypeScript 后自动编译）
npm run watch

# 使用 MCP Inspector 调试 Stdio 模式
npm run inspector

# 启动 HTTP 模式服务
npm run streamable

# 打开 Web 版 MCP Inspector（手动填写端点地址）
npm run inspector:web
```

### 调试技巧

1. **Stdio 模式**：运行 `npm run inspector` 会自动启动 Inspector 并连接到 `build/stdio.js`
2. **HTTP 模式**：先运行 `npm run streamable` 启动服务，然后运行 `npm run inspector:web` 打开 Web 界面，在 "Transport Type" 选择 "Streamable HTTP"，填入 `http://localhost:3000/mcp`

---

## 项目结构

```
yuque-mcp/
├── src/
│   ├── yuque-client.ts      # 语雀 API 客户端封装（axios）
│   ├── stdio.ts              # Stdio 传输模式入口
│   └── streamable-http.ts    # Streamable HTTP 传输模式入口
├── build/                    # TypeScript 编译产物
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

## 技术栈

| 技术 | 用途 |
|------|------|
| [TypeScript](https://www.typescriptlang.org/) | 类型安全的开发语言 |
| [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk) | MCP 协议官方 TypeScript SDK |
| [axios](https://github.com/axios/axios) | HTTP 客户端，调用语雀 Open API |
| [Node.js `http`](https://nodejs.org/api/http.html) | 原生 HTTP 模块，无需额外依赖 |
| [语雀 Open API v2](https://www.yuque.com/yuque/developer/api) | 语雀官方 REST API |

## License

[MIT](./LICENSE) © sheng
