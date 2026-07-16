#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { YuqueClient } from "./yuque-client.js";
// import * as fs from "fs";

/**
 * 解析 token：CLI 参数 --token 优先级高于环境变量 YUQUE_TOKEN
 * 允许返回空字符串：获取工具列表等操作不需要 token，实际调用 API 时才校验
 */
function resolveToken(): string {
  // 解析 --token <value> 命令行参数
  const args = process.argv.slice(2);
  const tokenIndex = args.indexOf("--token");
  if (tokenIndex !== -1 && tokenIndex + 1 < args.length) {
    return args[tokenIndex + 1];
  }
  // 回退到环境变量
  const envToken = process.env.YUQUE_TOKEN;
  // console.log('envToken', envToken)
  // fs.writeFileSync("./test.txt", `YUQUE_TOKEN=${envToken}`);
  if (envToken) {
    return envToken;
  }
  // 不抛错：允许无 token 启动服务器，客户端仍可获取工具列表
  console.warn("⚠️  语雀 Token 未配置，工具列表可正常获取，但调用工具时将返回鉴权错误");
  return "";
}

/** 创建并配置 MCP Server */
function createServer(client: YuqueClient) {
  const server = new Server(
    {
      name: "yuque-server-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
        prompts: {},
      },
    }
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
              namespace: {
                type: "string",
                description: "知识库路径"
              }
            },
            required: [
              "namespace"
            ]
          }
        },
        {
          name: "yuque_get_note_detail",
          description: "用来获取语雀中单篇笔记的详细内容",
          inputSchema: {
            type: "object",
            properties: {
              repoId: {
                type: "string",
                description: "知识库ID"
              },
              docsId: {
                type: "string",
                description: "笔记ID"
              }
            },
            required: ["repoId", "docsId"]
          }
        },
        {
          name: "yuque_create_note",
          description: "用来在语雀知识库中创建新的笔记",
          inputSchema: {
            type: "object",
            properties: {
              repoId: {
                type: "string",
                description: "知识库ID"
              },
              title: {
                type: "string",
                description: "笔记标题"
              },
              content: {
                type: "string",
                description: "笔记内容（markdown格式）"
              }
            },
            required: ["repoId", "title", "content"]
          }
        },
        {
          name: "yuque_write_note",
          description: "用来写入语雀笔记",
          inputSchema: {
            type: "object",
            properties: {
              repoId: {
                type: "string",
                description: "知识库ID"
              },
              docsId: {
                type: "string",
                description: "笔记ID"
              },
              content: {
                type: "string",
                description: "笔记内容"
              }
            },
            required: ["repoId", "docsId", "content"]
          }
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolsName = request.params.name;

    if (toolsName === "yuque_get_note_detail") {
      const repoId = String(request.params.arguments?.repoId);
      const docsId = String(request.params.arguments?.docsId);
      if (!repoId) throw new Error("repoId字段是必需的");
      if (!docsId) throw new Error("docsId字段是必需的");
      const data = await client.getNoteDetail(repoId, docsId);
      return {
        content: [
          {
            type: "text",
            text: typeof data === "string" ? data : JSON.stringify(data)
          }
        ]
      };
    }

    if (toolsName === "yuque_create_note") {
      const repoId = String(request.params.arguments?.repoId);
      const title = String(request.params.arguments?.title);
      const content = String(request.params.arguments?.content);
      if (!repoId) throw new Error("repoId字段是必需的");
      if (!title) throw new Error("title字段是必需的");
      if (!content) throw new Error("content字段是必需的");
      const data = await client.createNote(repoId, title, content);
      return {
        content: [
          {
            type: "text",
            text: typeof data === "string" ? data : JSON.stringify(data)
          }
        ]
      };
    }

    if (toolsName === "yuque_write_note") {
      const repoId = String(request.params.arguments?.repoId);
      const docsId = String(request.params.arguments?.docsId);
      const content = String(request.params.arguments?.content);
      if (!repoId) throw new Error("repoId字段是必需的");
      if (!docsId) throw new Error("docsId字段是必需的");
      if (!content) throw new Error("content字段是必需的");
      const data = await client.writeNote({
        repoId,
        docsId,
        body: content
      });
      return {
        content: [
          {
            type: "text",
            text: typeof data === "string" ? data : JSON.stringify(data)
          }
        ]
      };
    }

    if (toolsName === "yuque_get_notes") {
      const namespace = String(request.params.arguments?.namespace);
      if (!namespace) throw new Error("namespace字段是必需的");
      const data = await client.getNotes(namespace);
      return {
        content: [
          {
            type: "text",
            text: typeof data === "string" ? data : JSON.stringify(data)
          }
        ]
      };
    }

    throw new Error("找不到对应的工具");
  });

  return server;
}

/**
 * 启动 stdio 传输模式的 MCP 服务器
 */
async function main() {
  const token = resolveToken();
  const client = new YuqueClient({ token });
  const server = createServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("服务器报错:", error);
  process.exit(1);
});
