# MCP Server 工具箱

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

基于 [MCP (Model Context Protocol)](https://modelcontextprotocol.io) 协议开发的服务器集合，让 AI 助手（Claude Code、VS Code Copilot 等）能够接入各类第三方服务。每个子项目是一个独立的 npm 包，可单独安装使用。

---

## 项目列表

| 项目 | 版本 | 说明 |
|------|------|------|
| [yuque-mcp](./yuque-mcp/) | [![npm](https://img.shields.io/npm/v/@wojiaoxiaofenfen/yuque-mcp)](https://www.npmjs.com/package/@wojiaoxiaofenfen/yuque-mcp) | 语雀知识库 MCP 服务器 — 支持笔记增删改查，Stdio / HTTP 双模式 |

---

## 快速导航

### [yuque-mcp](./yuque-mcp/) — 语雀 MCP Server

将 AI 助手接入语雀知识库，实现对文档的全流程操作：

- 📋 获取知识库信息
- 📄 读取笔记内容
- ✏️ 创建新笔记
- 🔄 更新已有笔记
- 🌐 同时支持 Stdio 和 Streamable HTTP 两种传输模式

```bash
# 一行命令即可体验
npx @wojiaoxiaofenfen/yuque-mcp
```

详见 [yuque-mcp/README.md](./yuque-mcp/README.md)

---

## 项目结构

```
mcp-server/
├── yuque-mcp/          # 语雀 MCP Server（npm 包 @wojiaoxiaofenfen/yuque-mcp）
│   ├── src/            # TypeScript 源码
│   ├── build/          # 编译产物
│   └── package.json
├── .gitignore
└── README.md           # 本文件
```

---

## 本地开发

此仓库为多项目聚合仓库，每个子项目均可独立开发构建。

### 环境要求

- **Node.js** >= 18
- **pnpm** / **npm**（包管理器）

### 公共步骤

```bash
# 克隆仓库
git clone <repo-url>
cd mcp-server

# 进入具体子项目开发
cd yuque-mcp
npm install
npm run build
```

每个子项目的详细开发说明请查看对应目录下的 README。

---

## License

[MIT](./LICENSE)


先启动 uvx --from xiaohongshu-automation xhs-server
