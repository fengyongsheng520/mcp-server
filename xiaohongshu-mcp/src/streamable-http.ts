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
import { XiaohongshuClient } from "./xiaohongshu-client.js";
import axios from "axios";

/** MCP 内容项类型 */
interface McpContentItem {
  type: "text" | "image";
  text?: string;
  data?: string;
  mimeType?: string;
}

/**
 * 从 HTTP 请求 headers 中提取小红书 API 配置
 * 优先级：请求 Header > 环境变量
 *
 * 支持的 header：
 *   - XHS-Api-Base-Url: 小红书 API 服务地址
 *   - XHS-Phone-Number: 默认账号手机号
 */
function extractConfig(req: IncomingMessage): { baseUrl?: string; phoneNumber?: string } {
  const baseUrl =
    (req.headers["xhs-api-base-url"] as string) ||
    process.env.XHS_API_BASE_URL;

  const phoneNumber =
    (req.headers["xhs-phone-number"] as string) ||
    process.env.XHS_PHONE_NUMBER;

  return {
    baseUrl: baseUrl || undefined,
    phoneNumber: phoneNumber || undefined,
  };
}

/**
 * 下载图片并转为 base64
 */
async function downloadImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 10000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Referer: "https://www.xiaohongshu.com/",
      },
    });

    const rawContentType = response.headers["content-type"];
    const contentType: string = Array.isArray(rawContentType) ? rawContentType[0] : String(rawContentType || "image/jpeg");
    const data = Buffer.from(response.data).toString("base64");
    return { data, mimeType: contentType };
  } catch (error) {
    console.error(`⚠️ 下载图片失败: ${imageUrl} - ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * 构建包含图片的 MCP 响应内容
 */
async function buildContentWithImages(
  data: Record<string, unknown>,
  maxImages: number = 3
): Promise<McpContentItem[]> {
  const content: McpContentItem[] = [];

  // 1. 先添加文本内容（完整数据 JSON）
  content.push({
    type: "text",
    text: JSON.stringify(data, null, 2),
  });

  // 2. 下载并添加图片
  const images = data.images as string[] | undefined;
  if (images && Array.isArray(images) && images.length > 0) {
    const imagesToDownload = images.slice(0, maxImages);
    console.error(`📥 正在下载 ${imagesToDownload.length}/${images.length} 张图片...`);

    for (let i = 0; i < imagesToDownload.length; i++) {
      const imgData = await downloadImageAsBase64(imagesToDownload[i]);
      if (imgData) {
        content.push({
          type: "image",
          data: imgData.data,
          mimeType: imgData.mimeType,
        });
        console.error(`  ✅ 图片 ${i + 1}/${imagesToDownload.length} 下载成功`);
      }
    }
  }

  return content;
}

/** 创建 MCP Server 实例 */
function createMcpServer(client: XiaohongshuClient) {
  const server = new Server(
    { name: "xiaohongshu-server-mcp", version: "0.2.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "xiaohongshu_search_notes",
          description:
            "搜索小红书笔记，支持关键词搜索。返回笔记标题、链接、作者、点赞数等关键信息，可用于发现热门话题和内容趋势",
          inputSchema: {
            type: "object",
            properties: {
              keywords: {
                type: "string",
                description: "搜索关键词",
              },
              limit: {
                type: "number",
                description: "返回结果数量限制，默认10条，最多20条",
                default: 10,
                minimum: 1,
                maximum: 20,
              },
              phoneNumber: {
                type: "string",
                description: "可选的小红书账号手机号，用于多账号场景",
              },
            },
            required: ["keywords"],
          },
        },
        {
          name: "xiaohongshu_get_note_content",
          description:
            "获取小红书笔记的详细内容，包括标题、正文、作者、图片、标签、互动数据等信息。支持自动抓取笔记中的图片",
          inputSchema: {
            type: "object",
            properties: {
              url: {
                type: "string",
                description: "小红书笔记的完整URL链接",
              },
              phoneNumber: {
                type: "string",
                description: "可选的小红书账号手机号，用于多账号场景",
              },
            },
            required: ["url"],
          },
        },
        {
          name: "xiaohongshu_analyze_note",
          description:
            "分析小红书笔记内容，提取关键信息和领域标签，帮助理解和归类笔记主题",
          inputSchema: {
            type: "object",
            properties: {
              url: {
                type: "string",
                description: "小红书笔记的完整URL链接",
              },
              phoneNumber: {
                type: "string",
                description: "可选的小红书账号手机号，用于多账号场景",
              },
            },
            required: ["url"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;

    if (toolName === "xiaohongshu_search_notes") {
      const keywords = String(request.params.arguments?.keywords);
      const limit = Number(request.params.arguments?.limit) || 10;
      const phoneNumber = request.params.arguments?.phoneNumber as string | undefined;

      if (!keywords) throw new Error("keywords 字段是必需的");

      const data = await client.searchNotes(keywords, limit, phoneNumber);
      return {
        content: [
          {
            type: "text",
            text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
          },
        ],
      };
    }

    if (toolName === "xiaohongshu_get_note_content") {
      const url = String(request.params.arguments?.url);
      const phoneNumber = request.params.arguments?.phoneNumber as string | undefined;

      if (!url) throw new Error("url 字段是必需的");

      const data = await client.getNoteContent(url, phoneNumber);
      const content = await buildContentWithImages(data as Record<string, unknown>);
      return { content };
    }

    if (toolName === "xiaohongshu_analyze_note") {
      const url = String(request.params.arguments?.url);
      const phoneNumber = request.params.arguments?.phoneNumber as string | undefined;

      if (!url) throw new Error("url 字段是必需的");

      const data = await client.analyzeNote(url, phoneNumber);
      return {
        content: [
          {
            type: "text",
            text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
          },
        ],
      };
    }

    throw new Error(`找不到对应的工具: ${toolName}`);
  });

  return server;
}

/** 会话数据结构 */
interface Session {
  transport: StreamableHTTPServerTransport;
  server: Server;
  client: XiaohongshuClient;
}

// 存储活跃会话 (sessionId → Session)
const sessions = new Map<string, Session>();

const PORT = parseInt(process.env.PORT || "3100", 10);

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  // 只处理 /mcp 路径（Streamable HTTP 规范单一端点）
  if (url.pathname !== "/mcp") {
    res.writeHead(404).end("Not Found");
    return;
  }

  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  let session: Session | undefined = sessionId ? sessions.get(sessionId) : undefined;

  if (!session) {
    // 新会话：从请求 headers 提取配置
    const config = extractConfig(req);
    console.log("🔧 新会话配置:", {
      baseUrl: config.baseUrl || "(默认: http://localhost:8000)",
      phoneNumber: config.phoneNumber || "(未设置)",
    });

    const client = new XiaohongshuClient(config);
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
  console.log(`🛵 小红书 MCP Streamable HTTP 服务器已启动 v0.2.0`);
  console.log(`   端点: http://localhost:${PORT}/mcp`);
  console.log(`   小红书 API: ${process.env.XHS_API_BASE_URL || "http://localhost:8000"}`);
  console.log(`   📸 图片自动抓取: 已启用`);
  console.log(`   配置方式: XHS-Api-Base-Url Header / XHS-Phone-Number Header / 环境变量`);
  console.log(`   在 MCP Inspector 中输入此地址即可调试`);
});
