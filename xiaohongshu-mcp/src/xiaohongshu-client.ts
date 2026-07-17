import axios from "axios";
import { XiaohongshuScraper } from "./scraper.js";

/** 小红书笔记搜索结果 */
export interface SearchNoteResult {
  /** 笔记ID */
  note_id: string;
  /** 笔记标题 */
  title: string;
  /** 笔记链接 */
  url: string;
  /** 作者昵称 */
  author: string;
  /** 点赞数 */
  likes?: number;
  /** 收藏数 */
  collects?: number;
  /** 评论数 */
  comments?: number;
  /** 封面图URL */
  cover?: string;
  /** 发布时间 */
  publish_time?: string;
  [key: string]: unknown;
}

/** 笔记详情 */
export interface NoteDetail {
  /** 笔记ID */
  note_id: string;
  /** 笔记标题 */
  title: string;
  /** 笔记正文内容 */
  content: string;
  /** 作者信息 */
  author: string;
  /** 点赞数 */
  likes?: number;
  /** 收藏数 */
  collects?: number;
  /** 评论数 */
  comments?: number;
  /** 图片URL列表 */
  images?: string[];
  /** 标签 */
  tags?: string[];
  /** 发布时间 */
  publish_time?: string;
  [key: string]: unknown;
}

export class XiaohongshuClient {
  /** 小红书 API 基础地址 */
  private readonly baseUrl: string;
  /** axios 实例 */
  private readonly http;
  /** 页面抓取器 */
  private readonly scraper: XiaohongshuScraper;

  constructor(params?: { baseUrl?: string; phoneNumber?: string }) {
    this.baseUrl = params?.baseUrl || process.env.XHS_API_BASE_URL || "http://localhost:8000";
    const phoneNumber = params?.phoneNumber || process.env.XHS_PHONE_NUMBER || "";

    this.http = axios.create({
      baseURL: this.baseUrl,
      headers: {
        "Content-Type": "application/json",
      },
      // 将 phone_number 作为默认参数，方便多账号场景
      params: phoneNumber ? { phone_number: phoneNumber } : {},
    });

    this.scraper = new XiaohongshuScraper();
  }

  /**
   * 搜索小红书笔记
   * @param keywords 搜索关键词
   * @param limit 返回数量限制（最多20条）
   * @param phoneNumber 可选的账号手机号
   */
  async searchNotes(
    keywords: string,
    limit: number = 10,
    phoneNumber?: string
  ): Promise<SearchNoteResult[]> {
    try {
      const params: Record<string, string | number> = {
        keywords,
        limit: Math.min(limit, 20),
      };
      if (phoneNumber) {
        params.phone_number = phoneNumber;
      }
      const response = await this.http.get("/search_notes", { params });
      return response.data?.data ?? response.data;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`搜索笔记失败: ${message}`);
    }
  }

  /**
   * 获取小红书笔记的详细内容（含图片）
   * 优先使用后端 API，如果无图片则自动抓取页面补充
   * @param url 小红书笔记URL
   * @param phoneNumber 可选的账号手机号
   */
  async getNoteContent(url: string, phoneNumber?: string): Promise<NoteDetail> {
    // 先尝试后端 API
    let apiResult: NoteDetail | null = null;
    try {
      const params: Record<string, string> = { url };
      if (phoneNumber) {
        params.phone_number = phoneNumber;
      }
      const response = await this.http.get("/get_note_content", { params });
      apiResult = (response.data?.data ?? response.data) as NoteDetail;
    } catch (error: unknown) {
      console.error(`⚠️ 后端 API 获取失败，将直接抓取页面: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 检查 API 结果是否有图片
    const hasImages =
      apiResult?.images && Array.isArray(apiResult.images) && apiResult.images.length > 0;

    if (apiResult && hasImages) {
      console.error(`✅ 后端 API 已返回 ${apiResult.images!.length} 张图片`);
      return apiResult;
    }

    // 后端无图片，尝试直接抓取页面
    console.error("🔄 后端无图片数据，启动页面抓取...");
    const scraped = await this.scraper.scrapeNote(url);

    if (scraped && scraped.images.length > 0) {
      console.error(`📸 页面抓取到 ${scraped.images.length} 张图片`);
      return {
        note_id: XiaohongshuScraper.extractNoteId(url) || "",
        title: apiResult?.title || scraped.title,
        content: apiResult?.content || scraped.content,
        author: apiResult?.author || scraped.author,
        likes: apiResult?.likes || scraped.interactInfo.liked,
        collects: apiResult?.collects || scraped.interactInfo.collected,
        comments: apiResult?.comments || scraped.interactInfo.commented,
        images: scraped.images,
        tags: apiResult?.tags || scraped.tags,
        publish_time: apiResult?.publish_time,
      };
    }

    // 图片抓取也失败，返回 API 结果（如果有）或空结果
    if (apiResult) {
      console.error("⚠️ 页面抓取也无图片，返回 API 文本数据");
      return apiResult;
    }

    throw new Error("获取笔记内容失败：后端 API 和页面抓取均未获取到数据");
  }

  /**
   * 分析小红书笔记内容，提取关键信息和领域标签
   * @param url 小红书笔记URL
   * @param phoneNumber 可选的账号手机号
   */
  async analyzeNote(url: string, phoneNumber?: string): Promise<Record<string, unknown>> {
    try {
      const params: Record<string, string> = { url };
      if (phoneNumber) {
        params.phone_number = phoneNumber;
      }
      const response = await this.http.get("/analyze_note", { params });
      return response.data?.data ?? response.data;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`分析笔记失败: ${message}`);
    }
  }
}
