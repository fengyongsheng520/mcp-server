# 掘金 MCP Server (juejin-mcp)

通过 MCP（Model Context Protocol）协议接入掘金社区，支持文章、沸点、用户、发布等操作。

## 安装

```bash
npm install @wojiaoxiaofenfen/juejin-mcp
```

## 配置

### 1. 获取 Cookie

在掘金网站 (juejin.cn) 登录后，从浏览器开发者工具中复制 Cookie 值。

### 2. 配置 MCP 客户端

#### VS Code / Claude Desktop

在 `.mcp.json` 或 MCP 客户端配置中添加：

```json
{
  "mcpServers": {
    "juejin": {
      "command": "node",
      "args": ["./juejin-mcp/build/stdio.js"],
      "env": {
        "JUEJIN_COOKIE": "你的掘金Cookie"
      }
    }
  }
}
```

#### 通过 npx 使用

```json
{
  "mcpServers": {
    "juejin": {
      "command": "npx",
      "args": ["@wojiaoxiaofenfen/juejin-mcp"],
      "env": {
        "JUEJIN_COOKIE": "你的掘金Cookie"
      }
    }
  }
}
```

## 可用工具

### 文章相关

| 工具名称 | 描述 | 认证 |
|---------|------|------|
| `juejin_get_article_list` | 获取首页综合文章列表，支持推荐/最新/热榜排序 | 不需要 |
| `juejin_get_article_rank` | 获取掘金文章热榜 | 不需要 |
| `juejin_add_article_to_collection` | 收藏文章到收藏集 | 需要 |
| `juejin_remove_article_from_collection` | 取消收藏文章 | 需要 |
| `juejin_get_collection_list` | 获取收藏集列表 | 不需要 |
| `juejin_create_collection` | 创建或更新收藏集 | 需要 |
| `juejin_delete_collection` | 删除收藏集 | 需要 |

### 沸点相关

| 工具名称 | 描述 | 认证 |
|---------|------|------|
| `juejin_get_pin_list` | 获取沸点信息列表 | 不需要 |
| `juejin_get_pin_categories` | 获取沸点圈子类别 | 不需要 |
| `juejin_get_hot_topics` | 获取热门话题列表 | 不需要 |
| `juejin_publish_pin` | 发布沸点 | 需要 |
| `juejin_like_pin` | 点赞沸点 | 需要 |
| `juejin_unlike_pin` | 取消点赞沸点 | 需要 |

### 用户相关

| 工具名称 | 描述 | 认证 |
|---------|------|------|
| `juejin_follow_user` | 关注用户 | 需要 |
| `juejin_unfollow_user` | 取消关注用户 | 需要 |
| `juejin_get_coder_calendar` | 获取今日代码日历（格言+宜忌） | 不需要 |
| `juejin_get_user_growth` | 获取成长等级和掘友分 | 需要 |

### 发布文章相关

| 工具名称 | 描述 | 认证 |
|---------|------|------|
| `juejin_query_tag_list` | 查询文章标签列表 | 不需要 |
| `juejin_create_article_draft` | 创建文章草稿（支持 Markdown） | 需要 |
| `juejin_update_article_draft` | 更新文章草稿 | 需要 |
| `juejin_delete_article_draft` | 删除文章草稿 | 需要 |
| `juejin_publish_article` | 发布文章草稿 | 需要 |

## 开发

```bash
# 安装依赖
npm install

# 编译
npm run build

# 监听模式
npm run watch

# MCP Inspector 调试
npm run inspector
```

## API 参考

本项目基于掘金 Web 端 API 封装，API 文档参考：[juejin-api](https://github.com/chenzijia12300/juejin-api)

## License

MIT
