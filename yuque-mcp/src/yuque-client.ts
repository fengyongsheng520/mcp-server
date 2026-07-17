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
   * 获取用户的知识库列表
   * @param login 用户的语雀账号（login/namespace）
   * @param options 可选参数：type (Book/Design/Column), include_membered (是否包含参与的知识库)
   */
  async getUserRepos(login: string, options?: { type?: string; include_membered?: boolean }): Promise<any> {
    this.ensureToken();
    try {
      const params: Record<string, string> = {};
      if (options?.type) params.type = options.type;
      if (options?.include_membered !== undefined) params.include_membered = String(options.include_membered);
      const response = await this.http.get(`/users/${login}/repos`, { params });
      return response.data?.data;
    } catch (error: any) {
      return `当前报错信息：${error?.message}`;
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
   * 将标题转换为合法的 slug（URL 短链接标识）
   * 规则：只保留英文、数字和连字符，中文转拼音首字母或直接使用时间戳
   */
  private titleToSlug(title: string): string {
    // 提取英文、数字、中文（转为空），用连字符连接
    const cleaned = title
      .toLowerCase()
      .replace(/[^\w一-龥]/g, '-')  // 特殊字符替换为连字符
      .replace(/-+/g, '-')                     // 合并多个连字符
      .replace(/^-|-$/g, '');                  // 去掉首尾连字符

    // 如果清理后只有中文或为空，使用时间戳生成唯一 slug
    if (!cleaned || /^[一-龥]+$/.test(cleaned.replace(/-/g, ''))) {
      return `doc-${Date.now()}`;
    }
    return cleaned;
  }

  /**
   * 创建新的语雀笔记
   * @param repoId 知识库ID
   * @param title 笔记标题
   * @param body 笔记内容（markdown格式）
   * @param slug 文档的 URL 短链接标识（可选，不填则从标题自动生成）
   * @param isPublic 公开级别：0=私密（仅自己可见），1=公开（默认，显示在知识库列表中）
   */
  async createNote(repoId: string, title: string, body: string, slug?: string, isPublic: number = 1): Promise<any> {
    this.ensureToken();
    try {
      const docSlug = slug || this.titleToSlug(title);
      const response = await this.http.post(`/repos/${repoId}/docs`, {
        title,
        slug: docSlug,
        body,
        format: "markdown",
        public: isPublic,
      });
      return response.data?.data;
    } catch (error: any) {
      return `当前报错信息：${error?.message}`;
    }
  }

  /**
   * 更新知识库信息（包括目录结构 toc_yml）
   * @param repoId 知识库ID或命名空间路径
   * @param data 要更新的字段，例如 { toc_yml: "...", name: "新名称" }
   */
  async updateRepo(repoId: string, data: Record<string, any>): Promise<any> {
    this.ensureToken();
    try {
      const response = await this.http.put(`/repos/${repoId}`, data);
      return response.data?.data;
    } catch (error: any) {
      return `当前报错信息：${error?.message}`;
    }
  }

  /**
   * 将文档添加到知识库的目录（TOC）中
   * 解决通过 API 创建笔记后左侧列表不显示的问题
   *
   * @param repoId 知识库ID
   * @param docInfo 文档信息（id、title、slug）
   */
  async addDocToToc(repoId: string, docInfo: { id: number; title: string; slug: string }): Promise<any> {
    this.ensureToken();
    try {
      // 1. 获取当前知识库的 TOC
      const repo = await this.getNotes(repoId);
      if (typeof repo === "string") {
        return `获取知识库信息失败：${repo}`;
      }
      const tocYml = repo?.toc_yml;
      if (!tocYml) {
        return "当前知识库没有 TOC 信息，可能是不支持目录的知识库类型";
      }

      // 2. 解析并追加新文档条目
      const updatedToc = this.appendDocToTocYml(tocYml, docInfo);

      // 3. 更新知识库的 TOC
      const result = await this.updateRepo(repoId, { toc_yml: updatedToc });
      return result;
    } catch (error: any) {
      return `当前报错信息：${error?.message}`;
    }
  }

  /**
   * 在 TOC YAML 字符串末尾追加一个新的文档条目
   * 自动更新 META 中的 count 计数和双向链表的 prev_uuid/sibling_uuid
   */
  private appendDocToTocYml(tocYml: string, docInfo: { id: number; title: string; slug: string }): string {
    const entries = this.parseTocYml(tocYml);

    // 更新 META count
    const metaEntry = entries.find(e => e.type === "META");
    if (metaEntry) {
      metaEntry.count = String(Number(metaEntry.count || 0) + 1);
    }

    // 找到最后一个 DOC 条目
    const lastDocIndex = entries.reduce((lastIdx, entry, idx) =>
      entry.type === "DOC" ? idx : lastIdx, -1
    );
    const lastDoc = lastDocIndex >= 0 ? entries[lastDocIndex] : null;

    // 生成新 UUID
    const newUuid = this.generateTocUuid();

    // 构建新 DOC 条目
    const newEntry: Record<string, string> = {
      type: "DOC",
      title: docInfo.title,
      uuid: newUuid,
      url: docInfo.slug,
      prev_uuid: lastDoc?.uuid || "",
      sibling_uuid: "",
      child_uuid: "",
      parent_uuid: "",
      doc_id: String(docInfo.id),
      level: "0",
      id: String(docInfo.id),
      open_window: "1",
      visible: "1",
    };

    // 更新原来的最后一个 DOC 的 sibling_uuid，使其指向新文档
    if (lastDoc) {
      lastDoc.sibling_uuid = newUuid;
    }

    // 追加新条目
    entries.push(newEntry);

    return this.serializeTocYml(entries);
  }

  /**
   * 解析 TOC YAML 字符串为对象数组
   * 格式：
   *   - type: META
   *     key1: val1
   *   - type: DOC
   *     key1: val1
   */
  private parseTocYml(tocYml: string): Record<string, string>[] {
    const entries: Record<string, string>[] = [];
    const lines = tocYml.split("\n");
    let currentEntry: Record<string, string> | null = null;

    for (const line of lines) {
      if (line.startsWith("- type:")) {
        if (currentEntry) entries.push(currentEntry);
        currentEntry = { type: line.substring(8).trim() };
      } else if (currentEntry && /^  \w/.test(line)) {
        const match = line.match(/^  (\w+):\s*(.*)/);
        if (match) {
          currentEntry[match[1]] = match[2].trim();
        }
      }
    }
    if (currentEntry) entries.push(currentEntry);

    return entries;
  }

  /**
   * 将对象数组序列化为 TOC YAML 字符串
   * type 字段使用 "- type:" 前缀，其他字段用 2 空格缩进
   */
  private serializeTocYml(entries: Record<string, string>[]): string {
    return entries
      .map(entry => {
        const lines: string[] = [];
        for (const [key, value] of Object.entries(entry)) {
          if (key === "type") {
            lines.push(`- type: ${value}`);
          } else {
            lines.push(`  ${key}: ${value}`);
          }
        }
        return lines.join("\n");
      })
      .join("\n");
  }

  /**
   * 生成类似语雀内部格式的 UUID（16位随机字符串，含大小写字母、数字、_ 和 -）
   */
  private generateTocUuid(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
    let result = "";
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
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
