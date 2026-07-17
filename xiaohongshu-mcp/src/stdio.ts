#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
 * 解析配置：优先使用命令行参数，其次环境变量
 */
function resolveConfig(): { baseUrl?: string; phoneNumber?: string } {
  const args = process.argv.slice(2);

  // 解析 --base-url <value>
  const baseUrlIndex = args.indexOf("--base-url");
  const baseUrl =
    baseUrlIndex !== -1 && baseUrlIndex + 1 < args.length
      ? args[baseUrlIndex + 1]
      : process.env.XHS_API_BASE_URL || "http://localhost:8000";

  // 解析 --phone-number <value>
  const phoneIndex = args.indexOf("--phone-number");
  const phoneNumber =
    phoneIndex !== -1 && phoneIndex + 1 < args.length
      ? args[phoneIndex + 1]
      : process.env.XHS_PHONE_NUMBER || undefined;

  return { baseUrl, phoneNumber };
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
 * @param data 笔记数据（JSON 对象）
 * @param maxImages 最多返回的图片数量
 */
async function buildContentWithImages(
  data: Record<string, unknown>,
  maxImages: number = 3
): Promise<McpContentItem[]> {
  const content: McpContentItem[] = [];

  // 1. 先添加文本内容（完整数据）
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

/** 创建并配置 MCP Server */
function createServer(client: XiaohongshuClient) {
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
              keywords: { type: "string", description: "搜索关键词" },
              limit: {
                type: "number",
                description: "返回结果数量限制，默认10条，最多20条",
                default: 10,
                minimum: 1,
                maximum: 20,
              },
              phoneNumber: { type: "string", description: "可选的小红书账号手机号" },
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
              url: { type: "string", description: "小红书笔记的完整URL链接" },
              phoneNumber: { type: "string", description: "可选的小红书账号手机号" },
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
              url: { type: "string", description: "小红书笔记的完整URL链接" },
              phoneNumber: { type: "string", description: "可选的小红书账号手机号" },
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

/** 启动 stdio 传输模式的 MCP 服务器 */
async function main() {
  const config = resolveConfig();
  console.error(`🔧 小红书 API: ${config.baseUrl}`);
  console.error(`👤 默认账号: ${config.phoneNumber || "(未设置)"}`);
  console.error(`📸 图片抓取: 已启用（v0.2.0）`);

  const client = new XiaohongshuClient(config);
  const server = createServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("服务器报错:", error);
  process.exit(1);
});
