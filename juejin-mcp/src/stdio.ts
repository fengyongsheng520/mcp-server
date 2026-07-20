#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { JuejinClient } from "./juejin-client.js";

/**
 * 解析 cookie：CLI 参数 --cookie 优先级高于环境变量 JUEJIN_COOKIE
 * 允许返回空字符串：获取工具列表等操作不需要 cookie，实际调用 API 时才校验
 */
function resolveCookie(): string {
  const args = process.argv.slice(2);
  const cookieIndex = args.indexOf("--cookie");
  if (cookieIndex !== -1 && cookieIndex + 1 < args.length) {
    return args[cookieIndex + 1];
  }
  const envCookie = process.env.JUEJIN_COOKIE;
  if (envCookie) {
    return envCookie;
  }
  console.warn("⚠️  掘金 Cookie 未配置，工具列表可正常获取，但需要认证的工具调用时将返回鉴权错误");
  return "";
}

/** 创建并配置 MCP Server */
function createServer(client: JuejinClient) {
  const server = new Server(
    {
      name: "juejin-server-mcp",
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
        // ==================== 文章相关 ====================
        {
          name: "juejin_get_article_list",
          description: "获取掘金首页综合文章列表，支持推荐、最新、热榜等多种排序方式",
          inputSchema: {
            type: "object",
            properties: {
              sort_type: {
                type: "number",
                description: "排序类型：200=推荐, 300=最新, 3=热榜3天, 7=热榜7天, 30=热榜30天, 0=热榜全部，默认200",
                enum: [0, 3, 7, 30, 200, 300],
                default: 200
              },
              cursor: {
                type: "string",
                description: "分页游标，首次请求传 '0'"
              },
              limit: {
                type: "number",
                description: "返回数量，默认20，最大50",
                default: 20,
                maximum: 50
              }
            }
          }
        },
        {
          name: "juejin_get_article_rank",
          description: "获取掘金文章热榜，按分类查看热门文章排行",
          inputSchema: {
            type: "object",
            properties: {
              category_id: {
                type: "string",
                description: "热榜分类ID，1=综合，其他分类ID可参考掘金首页分类",
                default: "1"
              }
            },
            required: ["category_id"]
          }
        },
        {
          name: "juejin_add_article_to_collection",
          description: "收藏文章到收藏集（需要认证）",
          inputSchema: {
            type: "object",
            properties: {
              article_id: {
                type: "string",
                description: "文章ID"
              },
              select_collection_ids: {
                type: "array",
                items: { type: "string" },
                description: "要加入的收藏集ID列表"
              },
              unselect_collection_ids: {
                type: "array",
                items: { type: "string" },
                description: "要移出的收藏集ID列表（可选）"
              },
              is_collect_fast: {
                type: "boolean",
                description: "是否快捷收藏，默认false",
                default: false
              }
            },
            required: ["article_id", "select_collection_ids"]
          }
        },
        {
          name: "juejin_remove_article_from_collection",
          description: "取消收藏文章（需要认证）",
          inputSchema: {
            type: "object",
            properties: {
              article_id: {
                type: "string",
                description: "文章ID"
              }
            },
            required: ["article_id"]
          }
        },
        {
          name: "juejin_get_collection_list",
          description: "获取用户的收藏集列表",
          inputSchema: {
            type: "object",
            properties: {
              user_id: {
                type: "string",
                description: "用户ID"
              },
              cursor: {
                type: "string",
                description: "分页游标，首次请求传 '0'"
              },
              limit: {
                type: "number",
                description: "请求数量，默认20",
                default: 20
              }
            },
            required: ["user_id"]
          }
        },
        {
          name: "juejin_create_collection",
          description: "创建或更新收藏集（需要认证）。collection_id为空时创建新收藏集，不为空时更新已有收藏集",
          inputSchema: {
            type: "object",
            properties: {
              collection_name: {
                type: "string",
                description: "收藏集名称"
              },
              description: {
                type: "string",
                description: "收藏集描述"
              },
              permission: {
                type: "number",
                description: "权限：0=公开, 1=私有，默认0",
                enum: [0, 1],
                default: 0
              },
              collection_id: {
                type: "string",
                description: "收藏集ID（为空时创建新收藏集，不为空时更新已有收藏集）"
              }
            },
            required: ["collection_name"]
          }
        },
        {
          name: "juejin_delete_collection",
          description: "删除收藏集（需要认证）",
          inputSchema: {
            type: "object",
            properties: {
              collection_id: {
                type: "string",
                description: "收藏集ID"
              }
            },
            required: ["collection_id"]
          }
        },
        // ==================== 沸点相关 ====================
        {
          name: "juejin_get_pin_list",
          description: "获取掘金沸点信息列表，浏览社区沸点内容",
          inputSchema: {
            type: "object",
            properties: {
              sort_type: {
                type: "number",
                description: "排序类型：300=最新，默认300",
                default: 300
              },
              cursor: {
                type: "string",
                description: "分页游标，首次请求传 '0'"
              },
              limit: {
                type: "number",
                description: "返回数量，默认20，最大50",
                default: 20,
                maximum: 50
              }
            }
          }
        },
        {
          name: "juejin_get_pin_categories",
          description: "获取沸点圈子类别列表，包括技术、职场、生活等圈子分类信息",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        {
          name: "juejin_get_hot_topics",
          description: "获取热门话题列表，可搜索和浏览当前社区热门的讨论话题",
          inputSchema: {
            type: "object",
            properties: {
              cursor: {
                type: "string",
                description: "分页游标，首次请求传 '0'"
              },
              keyword: {
                type: "string",
                description: "模糊搜索关键词"
              },
              theme_type: {
                type: "number",
                description: "话题类型：1=文章关联话题，默认1",
                default: 1
              },
              limit: {
                type: "number",
                description: "返回数量，默认20，最大30",
                default: 20,
                maximum: 30
              }
            }
          }
        },
        {
          name: "juejin_publish_pin",
          description: "发布沸点（需要认证）",
          inputSchema: {
            type: "object",
            properties: {
              content: {
                type: "string",
                description: "沸点内容文本"
              },
              topic_id: {
                type: "string",
                description: "话题ID（可选）"
              },
              sync_to_org: {
                type: "boolean",
                description: "是否同步到组织，默认false",
                default: false
              },
              pic_list: {
                type: "array",
                items: { type: "string" },
                description: "图片URL列表（可选）"
              }
            },
            required: ["content"]
          }
        },
        {
          name: "juejin_like_pin",
          description: "点赞沸点（需要认证）",
          inputSchema: {
            type: "object",
            properties: {
              item_id: {
                type: "string",
                description: "沸点ID（msg_id）"
              }
            },
            required: ["item_id"]
          }
        },
        {
          name: "juejin_unlike_pin",
          description: "取消点赞沸点（需要认证）",
          inputSchema: {
            type: "object",
            properties: {
              item_id: {
                type: "string",
                description: "沸点ID（msg_id）"
              }
            },
            required: ["item_id"]
          }
        },
        // ==================== 用户相关 ====================
        {
          name: "juejin_follow_user",
          description: "关注用户（需要认证）",
          inputSchema: {
            type: "object",
            properties: {
              user_id: {
                type: "string",
                description: "要关注的用户ID"
              }
            },
            required: ["user_id"]
          }
        },
        {
          name: "juejin_unfollow_user",
          description: "取消关注用户（需要认证）",
          inputSchema: {
            type: "object",
            properties: {
              user_id: {
                type: "string",
                description: "要取消关注的用户ID"
              }
            },
            required: ["user_id"]
          }
        },
        {
          name: "juejin_get_coder_calendar",
          description: "获取今日代码日历，包含编程格言和日常建议",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        {
          name: "juejin_get_user_growth",
          description: "获取当前登录用户的成长等级和掘友分信息（需要认证）",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        // ==================== 发布文章相关 ====================
        {
          name: "juejin_query_tag_list",
          description: "查询掘金标签列表，支持关键词搜索。用于发布文章时选择合适的标签",
          inputSchema: {
            type: "object",
            properties: {
              key_word: {
                type: "string",
                description: "搜索关键词，模糊匹配标签名和别名"
              },
              cursor: {
                type: "string",
                description: "分页游标，首次请求传 '0'"
              },
              sort_type: {
                type: "number",
                description: "排序类型，默认1",
                default: 1
              },
              limit: {
                type: "number",
                description: "返回数量，默认10，最大30",
                default: 10,
                maximum: 30
              }
            }
          }
        },
        {
          name: "juejin_create_article_draft",
          description: "创建文章草稿（需要认证）。支持设置标题、内容（markdown格式）、标签、分类、封面图等",
          inputSchema: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "文章标题"
              },
              mark_content: {
                type: "string",
                description: "文章内容（markdown格式）"
              },
              brief_content: {
                type: "string",
                description: "文章简述/摘要"
              },
              category_id: {
                type: "string",
                description: "分类ID，默认为'0'"
              },
              tag_ids: {
                type: "array",
                items: { type: "string" },
                description: "标签ID列表"
              },
              cover_image: {
                type: "string",
                description: "封面图URL"
              },
              theme_ids: {
                type: "array",
                items: { type: "string" },
                description: "话题ID列表"
              }
            }
          }
        },
        {
          name: "juejin_update_article_draft",
          description: "更新文章草稿内容（需要认证）。更新已有的文章草稿，支持修改标题、内容、标签等",
          inputSchema: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "文章草稿ID"
              },
              title: {
                type: "string",
                description: "文章标题"
              },
              mark_content: {
                type: "string",
                description: "文章内容（markdown格式）"
              },
              brief_content: {
                type: "string",
                description: "文章简述/摘要"
              },
              category_id: {
                type: "string",
                description: "分类ID"
              },
              tag_ids: {
                type: "array",
                items: { type: "string" },
                description: "标签ID列表"
              },
              cover_image: {
                type: "string",
                description: "封面图URL"
              },
              theme_ids: {
                type: "array",
                items: { type: "string" },
                description: "话题ID列表"
              }
            },
            required: ["id"]
          }
        },
        {
          name: "juejin_delete_article_draft",
          description: "删除文章草稿（需要认证）",
          inputSchema: {
            type: "object",
            properties: {
              draft_id: {
                type: "string",
                description: "文章草稿ID"
              }
            },
            required: ["draft_id"]
          }
        },
        {
          name: "juejin_publish_article",
          description: "发布文章草稿，将草稿正式发布为掘金文章（需要认证）",
          inputSchema: {
            type: "object",
            properties: {
              draft_id: {
                type: "string",
                description: "文章草稿ID"
              },
              sync_to_org: {
                type: "boolean",
                description: "是否同步到组织，默认false",
                default: false
              },
              column_ids: {
                type: "array",
                items: { type: "string" },
                description: "专栏ID列表（可选）"
              },
              theme_ids: {
                type: "array",
                items: { type: "string" },
                description: "话题ID列表（可选）"
              },
              encrypted_word_count: {
                type: "number",
                description: "编码后字数（可选，自动计算）"
              },
              origin_word_count: {
                type: "number",
                description: "原始字数（可选，自动计算）"
              }
            },
            required: ["draft_id"]
          }
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;

    try {
      // ==================== 文章相关 ====================
      if (toolName === "juejin_get_article_list") {
        const sort_type = request.params.arguments?.sort_type !== undefined
          ? Number(request.params.arguments?.sort_type) : 200;
        const cursor = request.params.arguments?.cursor
          ? String(request.params.arguments?.cursor) : "0";
        const limit = request.params.arguments?.limit !== undefined
          ? Number(request.params.arguments?.limit) : 20;
        const data = await client.getArticleList({ sort_type, cursor, limit });
        return {
          content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }]
        };
      }

      if (toolName === "juejin_get_article_rank") {
        const category_id = String(request.params.arguments?.category_id || "1");
        const data = await client.getArticleRank({ category_id });
        return {
          content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }]
        };
      }

      if (toolName === "juejin_add_article_to_collection") {
        const article_id = String(request.params.arguments?.article_id);
        const select_collection_ids = request.params.arguments?.select_collection_ids as string[];
        const unselect_collection_ids = request.params.arguments?.unselect_collection_ids as string[] | undefined;
        const is_collect_fast = request.params.arguments?.is_collect_fast !== undefined
          ? Boolean(request.params.arguments?.is_collect_fast) : false;
        if (!article_id) throw new Error("article_id 字段是必需的");
        if (!select_collection_ids || select_collection_ids.length === 0)
          throw new Error("select_collection_ids 字段是必需的");
        const data = await client.addArticleToCollection({
          article_id, select_collection_ids, unselect_collection_ids, is_collect_fast
        });
        return {
          content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }]
        };
      }

      if (toolName === "juejin_remove_article_from_collection") {
        const article_id = String(request.params.arguments?.article_id);
        if (!article_id) throw new Error("article_id 字段是必需的");
        const data = await client.removeArticleFromCollection(article_id);
        return {
          content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }]
        };
      }

      if (toolName === "juejin_get_collection_list") {
        const user_id = String(request.params.arguments?.user_id);
        const cursor = request.params.arguments?.cursor
          ? String(request.params.arguments?.cursor) : "0";
        const limit = request.params.arguments?.limit !== undefined
          ? Number(request.params.arguments?.limit) : 20;
        if (!user_id) throw new Error("user_id 字段是必需的");
        const data = await client.getCollectionList({ user_id, cursor, limit });
        return {
          content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }]
        };
      }

      if (toolName === "juejin_create_collection") {
        const collection_name = String(request.params.arguments?.collection_name);
        const description = request.params.arguments?.description
          ? String(request.params.arguments?.description) : "";
        const permission = request.params.arguments?.permission !== undefined
          ? Number(request.params.arguments?.permission) : 0;
        const collection_id = request.params.arguments?.collection_id
          ? String(request.params.arguments?.collection_id) : "";
        if (!collection_name) throw new Error("collection_name 字段是必需的");
        const data = await client.createCollection({
          collection_name, description, permission, collection_id
        });
        return {
          content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }]
        };
      }

      if (toolName === "juejin_delete_collection") {
        const collection_id = String(request.params.arguments?.collection_id);
        if (!collection_id) throw new Error("collection_id 字段是必需的");
        const data = await client.deleteCollection(collection_id);
        return {
          content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }]
        };
      }

      // ==================== 沸点相关 ====================
      if (toolName === "juejin_get_pin_list") {
        const sort_type = request.params.arguments?.sort_type !== undefined
          ? Number(request.params.arguments?.sort_type) : 300;
        const cursor = request.params.arguments?.cursor
          ? String(request.params.arguments?.cursor) : "0";
        const limit = request.params.arguments?.limit !== undefined
          ? Number(request.params.arguments?.limit) : 20;
        const data = await client.getPinList({ sort_type, cursor, limit });
        return {
          content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }]
        };
      }

      if (toolName === "juejin_get_pin_categories") {
        const data = await client.getPinCategories();
        return {
          content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }]
        };
      }

      if (toolName === "juejin_get_hot_topics") {
        const cursor = request.params.arguments?.cursor
          ? String(request.params.arguments?.cursor) : "0";
        const keyword = request.params.arguments?.keyword
          ? String(request.params.arguments?.keyword) : "";
        const theme_type = request.params.arguments?.theme_type !== undefined
          ? Number(request.params.arguments?.theme_type) : 1;
        const limit = request.params.arguments?.limit !== undefined
          ? Number(request.params.arguments?.limit) : 20;
        const data = await client.getHotTopics({ cursor, keyword, theme_type, limit });
        return {
          content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }]
        };
      }

      if (toolName === "juejin_publish_pin") {
        const content = String(request.params.arguments?.content);
        const topic_id = request.params.arguments?.topic_id
          ? String(request.params.arguments?.topic_id) : "";
        const sync_to_org = request.params.arguments?.sync_to_org !== undefined
          ? Boolean(request.params.arguments?.sync_to_org) : false;
        const pic_list = request.params.arguments?.pic_list as string[] | undefined;
        if (!content) throw new Error("content 字段是必需的");
        const data = await client.publishPin({
          content, topic_id, sync_to_org, pic_list: pic_list ?? []
        });
        return {
          content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }]
        };
      }

      if (toolName === "juejin_like_pin") {
        const item_id = String(request.params.arguments?.item_id);
        if (!item_id) throw new Error("item_id 字段是必需的");
        const data = await client.likePin({ item_id });
        return {
          content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }]
        };
      }

      if (toolName === "juejin_unlike_pin") {
        const item_id = String(request.params.arguments?.item_id);
        if (!item_id) throw new Error("item_id 字段是必需的");
        const data = await client.unlikePin({ item_id });
        return {
          content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }]
        };
      }

      // ==================== 用户相关 ====================
      if (toolName === "juejin_follow_user") {
        const user_id = String(request.params.arguments?.user_id);
        if (!user_id) throw new Error("user_id 字段是必需的");
        const data = await client.followUser({ user_id });
        return {
          content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }]
        };
      }

      if (toolName === "juejin_unfollow_user") {
        const user_id = String(request.params.arguments?.user_id);
        if (!user_id) throw new Error("user_id 字段是必需的");
        const data = await client.unfollowUser({ user_id });
        return {
          content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }]
        };
      }

      if (toolName === "juejin_get_coder_calendar") {
        const data = await client.getCoderCalendar();
        return {
          content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }]
        };
      }

      if (toolName === "juejin_get_user_growth") {
        const data = await client.getUserGrowth();
        return {
          content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }]
        };
      }

      // ==================== 发布文章相关 ====================
      if (toolName === "juejin_query_tag_list") {
        const key_word = request.params.arguments?.key_word
          ? String(request.params.arguments?.key_word) : "";
        const cursor = request.params.arguments?.cursor
          ? String(request.params.arguments?.cursor) : "0";
        const sort_type = request.params.arguments?.sort_type !== undefined
          ? Number(request.params.arguments?.sort_type) : 1;
        const limit = request.params.arguments?.limit !== undefined
          ? Number(request.params.arguments?.limit) : 10;
        const data = await client.queryTagList({ cursor, sort_type, key_word, limit });
        return {
          content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }]
        };
      }

      if (toolName === "juejin_create_article_draft") {
        const title = request.params.arguments?.title
          ? String(request.params.arguments?.title) : "";
        const mark_content = request.params.arguments?.mark_content
          ? String(request.params.arguments?.mark_content) : "";
        const brief_content = request.params.arguments?.brief_content
          ? String(request.params.arguments?.brief_content) : "";
        const category_id = request.params.arguments?.category_id
          ? String(request.params.arguments?.category_id) : "0";
        const tag_ids = request.params.arguments?.tag_ids as string[] | undefined;
        const cover_image = request.params.arguments?.cover_image
          ? String(request.params.arguments?.cover_image) : "";
        const theme_ids = request.params.arguments?.theme_ids as string[] | undefined;
        const data = await client.createArticleDraft({
          title, mark_content, brief_content, category_id,
          tag_ids: tag_ids ?? [],
          cover_image, theme_ids: theme_ids ?? []
        });
        return {
          content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }]
        };
      }

      if (toolName === "juejin_update_article_draft") {
        const id = String(request.params.arguments?.id);
        if (!id) throw new Error("id 字段是必需的");
        const title = request.params.arguments?.title
          ? String(request.params.arguments?.title) : "";
        const mark_content = request.params.arguments?.mark_content
          ? String(request.params.arguments?.mark_content) : "";
        const brief_content = request.params.arguments?.brief_content
          ? String(request.params.arguments?.brief_content) : "";
        const category_id = request.params.arguments?.category_id
          ? String(request.params.arguments?.category_id) : "0";
        const tag_ids = request.params.arguments?.tag_ids as string[] | undefined;
        const cover_image = request.params.arguments?.cover_image
          ? String(request.params.arguments?.cover_image) : "";
        const theme_ids = request.params.arguments?.theme_ids as string[] | undefined;
        const data = await client.updateArticleDraft({
          id, title, mark_content, brief_content, category_id,
          tag_ids: tag_ids ?? [],
          cover_image, theme_ids: theme_ids ?? []
        });
        return {
          content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }]
        };
      }

      if (toolName === "juejin_delete_article_draft") {
        const draft_id = String(request.params.arguments?.draft_id);
        if (!draft_id) throw new Error("draft_id 字段是必需的");
        const data = await client.deleteArticleDraft(draft_id);
        return {
          content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }]
        };
      }

      if (toolName === "juejin_publish_article") {
        const draft_id = String(request.params.arguments?.draft_id);
        if (!draft_id) throw new Error("draft_id 字段是必需的");
        const sync_to_org = request.params.arguments?.sync_to_org !== undefined
          ? Boolean(request.params.arguments?.sync_to_org) : false;
        const column_ids = request.params.arguments?.column_ids as string[] | undefined;
        const theme_ids = request.params.arguments?.theme_ids as string[] | undefined;
        const encrypted_word_count = request.params.arguments?.encrypted_word_count !== undefined
          ? Number(request.params.arguments?.encrypted_word_count) : 0;
        const origin_word_count = request.params.arguments?.origin_word_count !== undefined
          ? Number(request.params.arguments?.origin_word_count) : 0;
        const data = await client.publishArticleDraft({
          draft_id, sync_to_org,
          column_ids: column_ids ?? [],
          theme_ids: theme_ids ?? [],
          encrypted_word_count, origin_word_count
        });
        return {
          content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }]
        };
      }

      throw new Error(`找不到对应的工具：${toolName}`);
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `工具执行出错：${error?.message}` }]
      };
    }
  });

  return server;
}

/**
 * 启动 stdio 传输模式的 MCP 服务器
 */
async function main() {
  const cookie = resolveCookie();
  const client = new JuejinClient({ cookie });
  const server = createServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("服务器启动失败:", error);
  process.exit(1);
});
