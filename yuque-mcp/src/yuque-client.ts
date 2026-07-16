import axios from 'axios'

export class YuqueClient {
  private readonly baseUrl: string = "https://www.yuque.com/api/v2";
  /** axios 实例，预配置通用请求头 */
  private readonly http;

  constructor(params?: { token?: string }) {
    // 优先使用传入的 token，其次从环境变量 YUQUE_TOKEN 读取
    // token 可以为空：客户端获取工具列表等操作不需要鉴权
    const token = params?.token || process.env.YUQUE_TOKEN || "";
    this.http = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-Auth-Token': token } : {}),
      },
    });
  }

  /** 检查是否已配置 token，未配置则抛出友好提示 */
  private ensureToken(): void {
    // 通过检查 axios 默认 headers 是否包含 X-Auth-Token 来判断
    const hasToken = this.http.defaults.headers['X-Auth-Token'] as string;
    if (!hasToken) {
      throw new Error(
        "语雀 Token 未配置！请通过以下方式之一提供 token：\n" +
        "  1. 设置环境变量 YUQUE_TOKEN\n" +
        "  2. 在 MCP 客户端配置的 env 字段中设置 YUQUE_TOKEN\n" +
        "  3. [HTTP模式] 通过 Yuque-Token 或 Authorization header 传入"
      );
    }
  }

  /**
   * 获取当前知识库的相关信息
   */
  async getNotes(namespace: string): Promise<any> {
    this.ensureToken();
    try {
      const response = await this.http.get(`/repos/${namespace}`);
      return response.data?.data;
    } catch (error: any) {
      return `当前报错信息：${error?.message}`
    }
  }

  /**
   * 读取单篇笔记详情
   * @param repoId 知识库ID
   * @param docsId 笔记ID
   */
  async getNoteDetail(repoId: string, docsId: string): Promise<any> {
    this.ensureToken();
    try {
      const response = await this.http.get(`/repos/${repoId}/docs/${docsId}`);
      return response.data?.data;
    } catch (error: any) {
      return `当前报错信息：${error?.message}`;
    }
  }

  /**
   * 创建新的语雀笔记
   * @param repoId 知识库ID
   * @param title 笔记标题
   * @param body 笔记内容（markdown格式）
   */
  async createNote(repoId: string, title: string, body: string): Promise<any> {
    this.ensureToken();
    try {
      const response = await this.http.post(`/repos/${repoId}/docs`, {
        title,
        body,
        format: "markdown",
      });
      return response.data?.data;
    } catch (error: any) {
      return `当前报错信息：${error?.message}`;
    }
  }

  /**
   * 写入/更新语雀笔记
   */
  async writeNote(payload: { repoId: string, docsId: string, title?: string, body: string }) {
    this.ensureToken();
    const params: Record<string, unknown> = {
      format: "markdown",
    };
    if (payload?.title) {
      params.title = payload.title;
    }
    if (payload?.body) {
      params.body = payload.body;
    }
    const response = await this.http.put(
      `/repos/${payload.repoId}/docs/${payload.docsId}`,
      params,
    );
    return response.data;
  }
}
