# 小红书 MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

通过 [MCP (Model Context Protocol)](https://modelcontextprotocol.io) 协议接入小红书，让 AI 助手（如 Claude Code、VS Code Copilot 等）能够直接**搜索**和**读取**小红书笔记内容。基于 Streamable HTTP 传输模式。

---

## 目录

- [功能特性](#功能特性)
- [前置条件](#前置条件)
- [快速开始](#快速开始)
- [可用工具](#可用工具)
- [配置选项](#配置选项)
- [本地开发](#本地开发)
- [项目结构](#项目结构)
- [技术栈](#技术栈)
- [License](#license)

---

## 功能特性

| 功能 | 说明 |
|------|------|
| 🔍 **搜索笔记** | 通过关键词搜索小红书笔记，返回标题、链接、作者、互动数据等 |
| 📄 **读取笔记** | 根据笔记URL获取完整内容，包括正文、图片、标签等 |
| 🧠 **分析笔记** | AI 自动分析笔记内容，提取关键信息和领域标签 |
| 🌐 **Streamable HTTP** | 基于 HTTP 传输，支持远程访问和多客户端连接 |
| 👥 **多账号支持** | 支持通过 Header 或参数指定不同的小红书账号 |

---

## 前置条件

本 MCP Server 需要依赖小红书 API 后端服务。请确保已启动 `http://localhost:8000` 上的 API 服务（默认地址）。

---

## 快速开始

### 安装

```bash
# 进入模块目录
cd xiaohongshu-mcp

# 安装依赖
npm install

# 编译 TypeScript
npm run build
```

### 启动 HTTP 服务

```bash
# 使用默认端口 3100 启动
npm run streamable

# 指定端口
PORT=8080 npm run streamable

# 指定小红书 API 地址
uvx --from xiaohongshu-automation xhs-server
XHS_API_BASE_URL=http://localhost:8000 npm run streamable
```

服务启动后将输出：

```
🛵 小红书 MCP Streamable HTTP 服务器已启动
   端点: http://localhost:3100/mcp
   小红书 API: http://localhost:8000
   配置方式: XHS-Api-Base-Url Header / XHS-Phone-Number Header / 环境变量
   在 MCP Inspector 中输入此地址即可调试
```

### 配置 MCP 客户端

在你的 MCP 客户端配置文件中添加（如 `claude.json`）：

```json
{
  "mcpServers": {
    "xiaohongshu": {
      "type": "streamable-http",
      "url": "http://localhost:3100/mcp",
      "headers": {
        "XHS-Api-Base-Url": "http://localhost:8000",
        "XHS-Phone-Number": "你的手机号"
      }
    }
  }
}
```

---

## 可用工具

| 工具名称 | 功能描述 | 必需参数 | 可选参数 |
|----------|----------|----------|----------|
| `xiaohongshu_search_notes` | 搜索小红书笔记 | `keywords` — 搜索关键词 | `limit` — 返回数量（默认10，最多20）<br>`phoneNumber` — 账号手机号 |
| `xiaohongshu_get_note_content` | 获取笔记详细内容 | `url` — 笔记链接 | `phoneNumber` — 账号手机号 |
| `xiaohongshu_analyze_note` | 分析笔记内容和标签 | `url` — 笔记链接 | `phoneNumber` — 账号手机号 |

### 使用示例

**搜索笔记：**
```
搜索"世界杯"相关的小红书笔记，返回10条
→ xiaohongshu_search_notes { keywords: "世界杯", limit: 10 }
```

**读取笔记：**
```
读取这篇笔记的完整内容
→ xiaohongshu_get_note_content { url: "https://www.xiaohongshu.com/explore/xxx" }
```

**分析笔记：**
```
分析这篇笔记的主题和关键词
→ xiaohongshu_analyze_note { url: "https://www.xiaohongshu.com/explore/xxx" }
```

---

## 配置选项

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | MCP 服务器监听端口 | `3100` |
| `XHS_API_BASE_URL` | 小红书 API 服务地址 | `http://localhost:8000` |
| `XHS_PHONE_NUMBER` | 默认的小红书账号手机号 | — |

### HTTP Headers

| Header | 说明 | 优先级 |
|--------|------|--------|
| `XHS-Api-Base-Url` | 小红书 API 服务地址 | 高于环境变量 |
| `XHS-Phone-Number` | 小红书账号手机号 | 高于环境变量 |

---

## 本地开发

```bash
# 安装依赖
npm install

# 监听模式编译（修改 TypeScript 后自动编译）
npm run watch

# 启动 HTTP 模式服务
npm run streamable

# 打开 Web 版 MCP Inspector（手动填写端点地址）
npm run inspector:web
```

### 调试技巧

1. 先启动小红书 API 后端服务（默认 `http://localhost:8000`）
2. 运行 `npm run streamable` 启动 MCP Server
3. 运行 `npm run inspector:web` 打开 Inspector，选择 "Streamable HTTP" 传输模式，填入 `http://localhost:3100/mcp`

---

## 项目结构

```
xiaohongshu-mcp/
├── src/
│   ├── xiaohongshu-client.ts   # 小红书 API 客户端封装（axios）
│   └── streamable-http.ts      # Streamable HTTP 传输模式入口
├── build/                       # TypeScript 编译产物
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
| [axios](https://github.com/axios/axios) | HTTP 客户端，调用小红书 API |
| [Node.js `http`](https://nodejs.org/api/http.html) | 原生 HTTP 模块，无需额外依赖 |

## License

[MIT](./LICENSE) © sheng
