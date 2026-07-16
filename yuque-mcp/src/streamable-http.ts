#!/usr/bin/env node
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { YuqueClient } from "./yuque-client.js";

/**
 * 替换字符串中的环境变量占位符为实际值（递归解析，最多 10 层防止循环引用）
 *
 * 支持两种语法：
 *   - ${ENV_VAR}         简洁写法
 *   - ${env:ENV_VAR}     MCP 标准写法
 *
 * 示例：
 *   resolveEnvVars("Bearer ${YUQUE_TOKEN}")      → "Bearer PkT8t74..."
 *   resolveEnvVars("Bearer ${env:YUQUE_TOKEN}")   → "Bearer PkT8t74..."
 *   resolveEnvVars(process.env.YUQUE_TOKEN)       → "PkT8t74..."（纯 token 不做替换）
 */
function resolveEnvVars(raw: string, maxDepth: number = 10): string {
  if (!raw || !raw.includes("$")) return raw;

  let result = raw;
  for (let depth = 0; depth < maxDepth; depth++) {
    const prev = result;
    // 同时匹配 ${VAR} 和 ${env:VAR} 两种格式
    result = result.replace(/\$\{(?:env:)?(\w+)\}/g, (match, varName: string) => {
      const resolved = process.env[varName];
      if (resolved === undefined) {
        console.warn(`⚠️  环境变量 ${varName} 未设置，保留占位符`);
        return match; // 保留原样，不做替换
      }
      return resolved;
    });

    // 没有更多占位符需要替换，提前退出
    if (prev === result) break;
  }

  if (result !== raw) {
    // 脱敏打印：只显示 token 的前 6 位和后 4 位
    const masked = result.length > 10
      ? result.slice(0, 6) + "..." + result.slice(-4)
      : "***";
    console.log(`🔐 已解析环境变量占位符，结果: ${masked}`);
  }
  
  return result;
}

/**
 * 从 HTTP 请求 headers 中提取语雀 token，自动解析 ${ENV_VAR} 占位符
 * 优先级：Yuque-Token > Authorization Bearer > 环境变量 YUQUE_TOKEN
 *
 * 支持的 header 值格式：
 *   - 硬编码 token:  "PkT8t74..."
 *   - Bearer 前缀:   "Bearer PkT8t74..."
 *   - 环境变量引用:  "Bearer ${YUQUE_TOKEN}"（服务端自动解析）
 */
function extractToken(req: IncomingMessage): string | null {
  // 1) 自定义 header: Yuque-Token
  const customToken = req.headers["yuque-token"];
  if (typeof customToken === "string" && customToken.length > 0) {
    // 去掉可选的 "Bearer " 前缀，然后解析环境变量占位符
    const raw = customToken.startsWith("Bearer ") ? customToken.slice(7) : customToken;
    return resolveEnvVars(raw);
  }

  // 2) 标准 Authorization: Bearer <token>
  const authHeader = req.headers["authorization"];
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return resolveEnvVars(authHeader.slice(7));
  }

  // 3) 回退到服务端环境变量（单用户部署场景）
  const envToken = process.env.YUQUE_TOKEN;
  if (envToken) {
    return resolveEnvVars(envToken);
  }

  return null;
}

/** 创建 MCP Server 实例 */
function createMcpServer(client: YuqueClient) {
  const server = new Server(
    { name: "yuque-server-mcp", version: "0.1.0" },
    { capabilities: { resources: {}, tools: {}, prompts: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "yuque_get_notes",
          description: "用来获取语雀中特定知识库的列表",
          inputSchema: {
            type: "object",
            properties: {
              namespace: { type: "string", description: "知识库路径" },
            },
            required: ["namespace"],
          },
        },
        {
          name: "yuque_get_note_detail",
          description: "用来获取语雀中单篇笔记的详细内容",
          inputSchema: {
            type: "object",
            properties: {
              repoId: { type: "string", description: "知识库ID" },
              docsId: { type: "string", description: "笔记ID" },
            },
            required: ["repoId", "docsId"],
          },
        },
        {
          name: "yuque_create_note",
          description: "用来在语雀知识库中创建新的笔记",
          inputSchema: {
            type: "object",
            properties: {
              repoId: { type: "string", description: "知识库ID" },
              title: { type: "string", description: "笔记标题" },
              content: { type: "string", description: "笔记内容（markdown格式）" },
            },
            required: ["repoId", "title", "content"],
          },
        },
        {
          name: "yuque_write_note",
          description: "用来写入语雀笔记",
          inputSchema: {
            type: "object",
            properties: {
              repoId: { type: "string", description: "知识库ID" },
              docsId: { type: "string", description: "笔记ID" },
              content: { type: "string", description: "笔记内容" },
            },
            required: ["repoId", "docsId", "content"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolsName = request.params.name;

    if (toolsName === "yuque_get_note_detail") {
      const repoId = String(request.params.arguments?.repoId);
      const docsId = String(request.params.arguments?.docsId);
      if (!repoId) throw new Error("repoId字段是必需的");
      if (!docsId) throw new Error("docsId字段是必需的");
      let data = await client.getNoteDetail(repoId, docsId);
      return {
        content: [
          {
            type: "text",
            text: typeof data == 'string' ? data : JSON.stringify(data)
          }
        ]
      }
    }

    if (toolsName === "yuque_create_note") {
      const repoId = String(request.params.arguments?.repoId);
      const title = String(request.params.arguments?.title);
      const content = String(request.params.arguments?.content);
      if (!repoId) throw new Error("repoId字段是必需的");
      if (!title) throw new Error("title字段是必需的");
      if (!content) throw new Error("content字段是必需的");
      let data = await client.createNote(repoId, title, content);
      return {
        content: [
          {
            type: "text",
            text: typeof data == 'string' ? data : JSON.stringify(data)
          }
        ]
      }
    }

    if (toolsName === "yuque_write_note") {
      const repoId = String(request.params.arguments?.repoId);
      const docsId = String(request.params.arguments?.docsId);
      const content = String(request.params.arguments?.content);
      if (!repoId) throw new Error("repoId字段是必需的");
      if (!docsId) throw new Error("docsId字段是必需的");
      if (!content) throw new Error("content字段是必需的");
      let data = await client.writeNote({ repoId, docsId, body: content });
      return {
        content: [
          {
            type: "text",
            text: typeof data == 'string' ? data : JSON.stringify(data)
          }
        ]
      }
    }

    if (toolsName === "yuque_get_notes") {
      const namespace = String(request.params.arguments?.namespace);
      if (!namespace) throw new Error("namespace字段是必需的");
      let data = await client.getNotes(namespace);
      return {
        content: [
          {
            type: "text",
            text: typeof data == 'string' ? data : JSON.stringify(data)
          }
        ]
      }
    }

    throw new Error("找不到对应的工具");
  });

  return server;
}

/** 会话数据结构：每个会话持有独立的 transport、server 和 client */
interface Session {
  transport: StreamableHTTPServerTransport;
  server: Server;
  client: YuqueClient;
}

// 存储活跃会话 (sessionId → Session)
const sessions = new Map<string, Session>();

const PORT = parseInt(process.env.PORT || "3000", 10);

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  // 只处理 /mcp 路径（Streamable HTTP 规范使用单一端点）
  if (url.pathname !== "/mcp") {
    res.writeHead(404).end("Not Found");
    return;
  }

  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  let session: Session | undefined = sessionId ? sessions.get(sessionId) : undefined;

  if (!session) {
    // 新会话：从请求 headers 提取 token（可选：获取工具列表不需要 token）
    const token = extractToken(req);
    console.log('token', token)
    // 无 token 时发出警告，但仍允许创建会话（客户端需要先获取工具列表）
    if (!token) {
      console.warn("⚠️  新会话未提供语雀 Token，工具列表可正常获取，但调用工具时将返回鉴权错误");
    }

    const client = new YuqueClient({ token: token || undefined });
    const server = createMcpServer(client);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid: string) => {
        sessions.set(sid, { transport, server, client });
      },
    });

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) sessions.delete(sid);
    };

    await server.connect(transport);
    session = { transport, server, client };
  }

  await session.transport.handleRequest(req, res);
});

httpServer.listen(PORT, () => {
  console.log(`✅ MCP Streamable HTTP 服务器已启动`);
  console.log(`   端点: http://localhost:${PORT}/mcp`);
  console.log(`   鉴权方式: Yuque-Token header / Authorization Bearer / YUQUE_TOKEN 环境变量`);
  console.log(`   在 MCP Inspector 中输入此地址即可调试`);
});
