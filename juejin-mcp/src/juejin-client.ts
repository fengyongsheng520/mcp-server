import axios from 'axios';

/**
 * 掘金 API 客户端
 * 封装掘金社区 web 端 API，支持文章、沸点、用户、发布等操作
 * 认证方式：通过 cookie 鉴权（从环境变量 JUEJIN_COOKIE 读取）
 */
export class JuejinClient {
  private readonly baseUrl: string = "https://api.juejin.cn";
  private readonly http;

  constructor(params?: { cookie?: string }) {
    // 优先使用传入的 cookie，其次从环境变量 JUEJIN_COOKIE 读取
    const cookie = params?.cookie || process.env.JUEJIN_COOKIE || "";
    this.http = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { 'Cookie': cookie } : {}),
      },
      timeout: 30000,
    });
  }

  /** 检查是否已配置 cookie */
  private ensureAuth(): void {
    const hasCookie = this.http.defaults.headers['Cookie'] as string;
    if (!hasCookie) {
      throw new Error(
        "掘金 Cookie 未配置！请通过以下方式之一提供 cookie：\n" +
        "  1. 设置环境变量 JUEJIN_COOKIE\n" +
        "  2. 在 MCP 客户端配置的 env 字段中设置 JUEJIN_COOKIE"
      );
    }
  }

  // ==================== 文章相关接口 ====================

  /**
   * 获取首页综合文章列表
   * 无需认证
   */
  async getArticleList(params: {
    sort_type?: number;  // 200推荐, 300最新, 3热榜3天, 7热榜7天, 30热榜30天, 0热榜全部
    cursor?: string;
    limit?: number;
    id_type?: number;    // 14官方广告, 2普通文章
    client_type?: number;
  }): Promise<any> {
    try {
      const response = await this.http.post('/recommend_api/v1/article/recommend_all_feed', {
        id_type: params.id_type ?? 2,
        client_type: params.client_type ?? 2608,
        sort_type: params.sort_type ?? 200,
        cursor: params.cursor ?? "0",
        limit: params.limit ?? 20,
      });
      return response.data;
    } catch (error: any) {
      return `请求失败：${error?.message}`;
    }
  }

  /**
   * 获取掘金文章热榜
   * 无需认证
   */
  async getArticleRank(params: {
    category_id: string;  // 热榜分类，1为综合
    type?: string;        // 固定为 "hot"
  }): Promise<any> {
    try {
      const response = await this.http.get('/content_api/v1/content/article_rank', {
        params: {
          category_id: params.category_id,
          type: params.type ?? "hot",
        }
      });
      return response.data;
    } catch (error: any) {
      return `请求失败：${error?.message}`;
    }
  }

  /**
   * 收藏文章
   * 需要认证
   */
  async addArticleToCollection(params: {
    article_id: string;
    select_collection_ids: string[];
    unselect_collection_ids?: string[];
    is_collect_fast?: boolean;
  }): Promise<any> {
    this.ensureAuth();
    try {
      const response = await this.http.post('/interact_api/v2/collectionset/add_article', {
        article_id: params.article_id,
        select_collection_ids: params.select_collection_ids,
        unselect_collection_ids: params.unselect_collection_ids ?? [],
        is_collect_fast: params.is_collect_fast ?? false,
      });
      return response.data;
    } catch (error: any) {
      return `请求失败：${error?.message}`;
    }
  }

  /**
   * 取消收藏文章
   * 需要认证
   */
  async removeArticleFromCollection(article_id: string): Promise<any> {
    this.ensureAuth();
    try {
      const response = await this.http.post('/interact_api/v2/collectionset/delete_article', {
        article_id,
      });
      return response.data;
    } catch (error: any) {
      return `请求失败：${error?.message}`;
    }
  }

  /**
   * 获取收藏集列表
   * 需要认证（非必须，但查看私有收藏集时需要）
   */
  async getCollectionList(params: {
    user_id: string;
    article_id?: string;
    cursor?: string;
    limit: number;
  }): Promise<any> {
    try {
      const response = await this.http.post('/interact_api/v2/collectionset/list', {
        article_id: params.article_id ?? "",
        user_id: params.user_id,
        cursor: params.cursor ?? "0",
        limit: params.limit,
      });
      return response.data;
    } catch (error: any) {
      return `请求失败：${error?.message}`;
    }
  }

  /**
   * 创建/更新收藏集
   * 需要认证（collection_id 为空时创建，不为空时更新）
   */
  async createCollection(params: {
    collection_name: string;
    description?: string;
    permission?: number;   // 0公开, 1私有
    collection_id?: string; // 为空时创建新收藏集
  }): Promise<any> {
    this.ensureAuth();
    try {
      const response = await this.http.post('/interact_api/v2/collectionset/update', {
        collection_id: params.collection_id ?? "",
        collection_name: params.collection_name,
        description: params.description ?? "",
        permission: params.permission ?? 0,
      });
      return response.data;
    } catch (error: any) {
      return `请求失败：${error?.message}`;
    }
  }

  /**
   * 删除收藏集
   * 需要认证
   */
  async deleteCollection(collection_id: string): Promise<any> {
    this.ensureAuth();
    try {
      const response = await this.http.post('/interact_api/v2/collectionset/delete', {
        collection_id,
      });
      return response.data;
    } catch (error: any) {
      return `请求失败：${error?.message}`;
    }
  }

  // ==================== 沸点相关接口 ====================

  /**
   * 获取沸点信息列表
   * 无需认证
   */
  async getPinList(params: {
    sort_type?: number;  // 300最新
    cursor?: string;
    limit?: number;
  }): Promise<any> {
    try {
      const response = await this.http.post('/recommend_api/v1/short_msg/recommend', {
        id_type: 4,
        sort_type: params.sort_type ?? 300,
        cursor: params.cursor ?? "0",
        limit: params.limit ?? 20,
      });
      return response.data;
    } catch (error: any) {
      return `请求失败：${error?.message}`;
    }
  }

  /**
   * 获取沸点圈子类别
   * 无需认证
   */
  async getPinCategories(): Promise<any> {
    try {
      const response = await this.http.get('/tag_api/v1/query_item_categories', {
        params: { item_type: 11 }
      });
      return response.data;
    } catch (error: any) {
      return `请求失败：${error?.message}`;
    }
  }

  /**
   * 获取热门话题列表
   * 无需认证
   */
  async getHotTopics(params?: {
    cursor?: string;
    keyword?: string;
    theme_type?: number;  // 1=文章关联话题
    id_type?: number;
    limit?: number;
  }): Promise<any> {
    try {
      const response = await this.http.post('/tag_api/v1/theme/list_by_hot', {
        cursor: params?.cursor ?? "0",
        keyword: params?.keyword ?? "",
        theme_type: params?.theme_type ?? 1,
        id_type: params?.id_type ?? 4,
        limit: params?.limit ?? 20,
      });
      return response.data;
    } catch (error: any) {
      return `请求失败：${error?.message}`;
    }
  }

  /**
   * 发布沸点
   * 需要认证
   */
  async publishPin(params: {
    content: string;
    topic_id?: string;
    sync_to_org?: boolean;
    pic_list?: string[];
  }): Promise<any> {
    this.ensureAuth();
    try {
      const response = await this.http.post('/content_api/v1/short_msg/publish', {
        content: params.content,
        topic_id: params.topic_id ?? "",
        sync_to_org: params.sync_to_org ?? false,
        pic_list: params.pic_list ?? [],
      });
      return response.data;
    } catch (error: any) {
      return `请求失败：${error?.message}`;
    }
  }

  /**
   * 点赞沸点
   * 需要认证
   */
  async likePin(params: {
    item_id: string;
    item_type?: number;   // 4为沸点
    client_type?: number;
  }): Promise<any> {
    this.ensureAuth();
    try {
      const response = await this.http.post('/interact_api/v1/digg/save', {
        item_id: params.item_id,
        item_type: params.item_type ?? 4,
        client_type: params.client_type ?? 2608,
      });
      return response.data;
    } catch (error: any) {
      return `请求失败：${error?.message}`;
    }
  }

  /**
   * 取消点赞沸点
   * 需要认证
   */
  async unlikePin(params: {
    item_id: string;
    item_type?: number;   // 4为沸点
    client_type?: number;
  }): Promise<any> {
    this.ensureAuth();
    try {
      const response = await this.http.post('/interact_api/v1/digg/cancel', {
        item_id: params.item_id,
        item_type: params.item_type ?? 4,
        client_type: params.client_type ?? 2608,
      });
      return response.data;
    } catch (error: any) {
      return `请求失败：${error?.message}`;
    }
  }

  // ==================== 用户相关接口 ====================

  /**
   * 关注用户
   * 需要认证
   */
  async followUser(params: {
    user_id: string;
    type?: number;  // 固定为1
  }): Promise<any> {
    this.ensureAuth();
    try {
      const response = await this.http.post('/interact_api/v1/follow/do', {
        id: params.user_id,
        type: params.type ?? 1,
      });
      return response.data;
    } catch (error: any) {
      return `请求失败：${error?.message}`;
    }
  }

  /**
   * 取消关注用户
   * 需要认证
   */
  async unfollowUser(params: {
    user_id: string;
    type?: number;  // 固定为1
  }): Promise<any> {
    this.ensureAuth();
    try {
      const response = await this.http.post('/interact_api/v1/follow/undo', {
        id: params.user_id,
        type: params.type ?? 1,
      });
      return response.data;
    } catch (error: any) {
      return `请求失败：${error?.message}`;
    }
  }

  /**
   * 获取今日代码日历
   * 无需认证
   */
  async getCoderCalendar(): Promise<any> {
    try {
      const response = await this.http.get('/growth_api/v1/get_coder_calendar');
      return response.data;
    } catch (error: any) {
      return `请求失败：${error?.message}`;
    }
  }

  /**
   * 获取用户成长等级
   * 需要认证
   */
  async getUserGrowth(): Promise<any> {
    this.ensureAuth();
    try {
      const response = await this.http.post('/growth_api/v1/user_growth/progress', {
        growth_type: 1,
      });
      return response.data;
    } catch (error: any) {
      return `请求失败：${error?.message}`;
    }
  }

  // ==================== 发布文章相关接口 ====================

  /**
   * 查询标签列表
   * 无需认证
   */
  async queryTagList(params?: {
    cursor?: string;
    sort_type?: number;  // 默认1
    key_word?: string;
    limit?: number;
  }): Promise<any> {
    try {
      const response = await this.http.post('/tag_api/v1/query_tag_list', {
        cursor: params?.cursor ?? "0",
        sort_type: params?.sort_type ?? 1,
        key_word: params?.key_word ?? "",
        limit: params?.limit ?? 10,
      });
      return response.data;
    } catch (error: any) {
      return `请求失败：${error?.message}`;
    }
  }

  /**
   * 创建文章草稿
   * 需要认证
   */
  async createArticleDraft(params: {
    title?: string;
    brief_content?: string;
    mark_content?: string;
    category_id?: string;
    tag_ids?: string[];
    cover_image?: string;
    theme_ids?: string[];
    link_url?: string;
    edit_type?: number;
  }): Promise<any> {
    this.ensureAuth();
    try {
      const response = await this.http.post('/content_api/v1/article_draft/create', {
        category_id: params.category_id ?? "0",
        tag_ids: params.tag_ids ?? [],
        link_url: params.link_url ?? "",
        cover_image: params.cover_image ?? "",
        title: params.title ?? "",
        brief_content: params.brief_content ?? "",
        edit_type: params.edit_type ?? 10,
        html_content: "deprecated",
        mark_content: params.mark_content ?? "",
        theme_ids: params.theme_ids ?? [],
      });
      return response.data;
    } catch (error: any) {
      return `请求失败：${error?.message}`;
    }
  }

  /**
   * 更新文章草稿内容
   * 需要认证
   */
  async updateArticleDraft(params: {
    id: string;
    title?: string;
    brief_content?: string;
    mark_content?: string;
    category_id?: string;
    tag_ids?: string[];
    cover_image?: string;
    theme_ids?: string[];
    link_url?: string;
    edit_type?: number;
  }): Promise<any> {
    this.ensureAuth();
    try {
      const response = await this.http.post('/content_api/v1/article_draft/update', {
        id: params.id,
        category_id: params.category_id ?? "0",
        tag_ids: params.tag_ids ?? [],
        link_url: params.link_url ?? "",
        cover_image: params.cover_image ?? "",
        title: params.title ?? "",
        brief_content: params.brief_content ?? "",
        edit_type: params.edit_type ?? 10,
        html_content: "deprecated",
        mark_content: params.mark_content ?? "",
        theme_ids: params.theme_ids ?? [],
      });
      return response.data;
    } catch (error: any) {
      return `请求失败：${error?.message}`;
    }
  }

  /**
   * 删除文章草稿
   * 需要认证
   */
  async deleteArticleDraft(draft_id: string): Promise<any> {
    this.ensureAuth();
    try {
      const response = await this.http.post('/content_api/v1/article_draft/delete', {
        draft_id,
      });
      return response.data;
    } catch (error: any) {
      return `请求失败：${error?.message}`;
    }
  }

  /**
   * 发布文章草稿
   * 需要认证
   */
  async publishArticleDraft(params: {
    draft_id: string;
    sync_to_org?: boolean;
    column_ids?: string[];
    theme_ids?: string[];
    encrypted_word_count?: number;
    origin_word_count?: number;
  }): Promise<any> {
    this.ensureAuth();
    try {
      const response = await this.http.post('/content_api/v1/article/publish', {
        draft_id: params.draft_id,
        sync_to_org: params.sync_to_org ?? false,
        column_ids: params.column_ids ?? [],
        theme_ids: params.theme_ids ?? [],
        encrypted_word_count: params.encrypted_word_count ?? 0,
        origin_word_count: params.origin_word_count ?? 0,
      });
      return response.data;
    } catch (error: any) {
      return `请求失败：${error?.message}`;
    }
  }
}
