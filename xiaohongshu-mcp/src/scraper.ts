import axios from "axios";

/** 抓取到的小红书笔记页面数据 */
export interface ScrapedNote {
  /** 笔记标题 */
  title: string;
  /** 笔记正文 */
  content: string;
  /** 图片URL列表 */
  images: string[];
  /** 视频URL（如果是视频笔记） */
  videoUrl?: string;
  /** 标签 */
  tags: string[];
  /** 作者昵称 */
  author: string;
  /** 作者头像 */
  authorAvatar?: string;
  /** 互动数据 */
  interactInfo: {
    liked?: number;
    collected?: number;
    commented?: number;
    shared?: number;
  };
}

/** 通用请求头，模拟浏览器访问 */
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

/**
 * 小红书页面抓取器
 * 直接从笔记页面 HTML 中提取数据，作为后端 API 的补充
 */
export class XiaohongshuScraper {
  /**
   * 从 search_result URL 中提取 noteId
   * 例如: /search_result/68dbb04f000000000300e0cf → 68dbb04f000000000300e0cf
   */
  static extractNoteId(url: string): string | null {
    const match = url.match(
      /\/(?:search_result|explore|discovery\/item|note)\/([a-f0-9]{24,})/
    );
    return match ? match[1] : null;
  }

  /**
   * 将 search_result URL 转为标准 explore URL
   */
  static toExploreUrl(url: string): string {
    const noteId = this.extractNoteId(url);
    if (noteId) {
      return `https://www.xiaohongshu.com/explore/${noteId}`;
    }
    return url;
  }

  /**
   * 抓取页面 HTML
   */
  private async fetchPage(url: string): Promise<string | null> {
    try {
      const response = await axios.get(url, {
        headers: BROWSER_HEADERS,
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: (status) => status < 500,
      });

      const html = response.data as string;
      if (!html || typeof html !== "string" || html.length < 500) {
        console.error("⚠️ 页面内容过短，可能被拦截");
        return null;
      }

      console.error(`📄 获取到页面 HTML，长度: ${html.length}`);
      return html;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ 请求页面失败: ${message}`);
      return null;
    }
  }

  /**
   * 判断是否为"页面不见了"或反爬页面
   */
  private isNotFoundPage(html: string): boolean {
    return (
      html.includes("页面不见了") ||
      html.includes("你访问的页面不见了") ||
      html.length < 1000
    );
  }

  /**
   * 从 HTML 中的 __INITIAL_STATE__ 提取笔记数据
   */
  private parseInitialState(html: string): Record<string, unknown> | null {
    const match = html.match(
      /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});?\s*<\/script>/
    );
    if (!match) {
      const altMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/);
      if (!altMatch) return null;
      try {
        return JSON.parse(altMatch[1].replace(/undefined/g, "null"));
      } catch {
        return null;
      }
    }
    try {
      const jsonStr = match[1].replace(/undefined/g, "null");
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  }

  /**
   * 从 __INITIAL_STATE__ 中提取图片列表
   */
  private extractImagesFromState(state: Record<string, unknown>): string[] {
    const images: string[] = [];
    try {
      const note = (state as any)?.note;
      if (!note) return images;

      // 笔记详情在 noteDetailMap 中
      const noteDetailMap = note?.noteDetailMap;
      if (noteDetailMap) {
        for (const nid of Object.keys(noteDetailMap)) {
          const detail = noteDetailMap[nid];
          const noteData = detail?.note;
          if (!noteData) continue;

          // 图片列表（多种可能的字段名）
          const imageList: Array<Record<string, unknown>> =
            noteData?.imageList || noteData?.image_list || [];
          for (const img of imageList) {
            const infoList = img?.infoList as Array<Record<string, unknown>> | undefined;
            const imgUrl =
              img?.url || img?.urlDefault || img?.urlPre || infoList?.[0]?.url;
            if (imgUrl && typeof imgUrl === "string") {
              images.push(imgUrl);
            }
          }
        }
      }

      // 也尝试从 firstPageNoteInfo 获取
      if (images.length === 0) {
        const firstPageInfo = note?.firstPageNoteInfo;
        if (firstPageInfo) {
          const imageList: Array<Record<string, unknown>> =
            firstPageInfo?.imageList || [];
          for (const img of imageList) {
            const infoList = img?.infoList as Array<Record<string, unknown>> | undefined;
            const imgUrl =
              img?.url || img?.urlDefault || img?.urlPre || infoList?.[0]?.url;
            if (imgUrl && typeof imgUrl === "string") {
              images.push(imgUrl);
            }
          }
        }
      }
    } catch {
      // 解析失败则忽略
    }
    return images;
  }

  /**
   * 从 HTML 中通过 meta 标签提取 og:image
   */
  private extractOgImages(html: string): string[] {
    const images: string[] = [];
    const ogImageRegex = /<meta\s+property="og:image"\s+content="([^"]+)"/gi;
    let match: RegExpExecArray | null;
    while ((match = ogImageRegex.exec(html)) !== null) {
      images.push(match[1]);
    }
    return images;
  }

  /**
   * 从 HTML 中通过 img 标签提取小红书 CDN 图片
   */
  private extractImgTags(html: string): string[] {
    const images: string[] = [];
    const seen = new Set<string>();

    // 匹配小红书图片 CDN 域名
    const patterns = [
      /https?:\/\/sns-webpic-qc\.xhscdn\.com\/[^"'\s]+/gi,
      /https?:\/\/sns-img-qc\.xhscdn\.com\/[^"'\s]+/gi,
      /https?:\/\/ci\.xiaohongshu\.com\/[^"'\s]+/gi,
      /https?:\/\/sns-avatar-qc\.xhscdn\.com\/[^"'\s]+/gi,
    ];

    for (const regex of patterns) {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(html)) !== null) {
        const url = match[0];
        if (!seen.has(url)) {
          seen.add(url);
          images.push(url);
        }
      }
    }

    return images;
  }

  /**
   * 解析笔记 HTML，提取所有结构化数据
   */
  private parseNoteHtml(
    html: string,
    noteId: string | null
  ): ScrapedNote {
    let images: string[] = [];
    let title = "";
    let content = "";
    let author = "";
    let authorAvatar: string | undefined;
    const tags: string[] = [];
    const interactInfo: ScrapedNote["interactInfo"] = {};

    // 1. 尝试解析 __INITIAL_STATE__
    const state = this.parseInitialState(html);

    if (state) {
      console.error("✅ 成功解析 __INITIAL_STATE__");

      const note = (state as any)?.note;
      if (note) {
        const noteDetailMap = note?.noteDetailMap;
        if (noteDetailMap && noteId) {
          const detail = noteDetailMap[noteId];
          const noteData = detail?.note;
          if (noteData) {
            title = noteData?.title || noteData?.displayTitle || "";
            content = noteData?.desc || "";

            // 作者信息
            const user = noteData?.user || detail?.user || {};
            author = user?.nickname || user?.nickName || "";
            authorAvatar = user?.avatar || user?.images || "";

            // 标签
            const tagList = noteData?.tagList || [];
            for (const tag of tagList) {
              if (tag?.name) tags.push(tag.name);
              if (tag?.tagName) tags.push(tag.tagName);
            }

            // 互动数据
            const interact = noteData?.interactInfo || {};
            interactInfo.liked = parseInt(interact?.likedCount || "0", 10);
            interactInfo.collected = parseInt(interact?.collectedCount || "0", 10);
            interactInfo.commented = parseInt(interact?.commentCount || "0", 10);
            interactInfo.shared = parseInt(interact?.shareCount || "0", 10);
          }
        }

        // 提取图片
        images = this.extractImagesFromState(state);
      }
    } else {
      console.error("⚠️ 未能解析 __INITIAL_STATE__，尝试其他方式提取");
    }

    // 2. 如果从 state 中没提取到图片，尝试 og:image
    if (images.length === 0) {
      images = this.extractOgImages(html);
      if (images.length > 0) {
        console.error(`📸 从 og:image 提取到 ${images.length} 张图片`);
      }
    }

    // 3. 如果还是没图片，从 img 标签中提取
    if (images.length === 0) {
      images = this.extractImgTags(html);
      if (images.length > 0) {
        console.error(`📸 从 img 标签提取到 ${images.length} 张图片`);
      }
    }

    // 4. 如果 title 为空，尝试从 <title> 标签提取
    if (!title) {
      const titleMatch = html.match(/<title>([^<]*)<\/title>/);
      if (titleMatch) {
        title = titleMatch[1].replace(/\s*-\s*小红书\s*$/, "").trim();
      }
    }

    // 5. 过滤掉头像类图片（通常不是笔记内容图）
    images = images.filter((url) => !url.includes("avatar"));

    console.error(
      `📸 解析完成: 标题="${title}", 图片=${images.length}张, 作者="${author}"`
    );

    return {
      title,
      content,
      images,
      tags,
      author,
      authorAvatar,
      interactInfo,
    };
  }

  /**
   * 抓取笔记页面的完整数据
   * 优先使用原始 URL（含 xsec_token），失败后再尝试 explore 格式
   * @param url 小红书笔记 URL（支持 search_result、explore 等格式）
   */
  async scrapeNote(url: string): Promise<ScrapedNote | null> {
    const noteId = XiaohongshuScraper.extractNoteId(url);
    const exploreUrl = XiaohongshuScraper.toExploreUrl(url);

    // 优先使用原始 URL（保留 xsec_token 等鉴权参数）
    const primaryUrl = url.includes("xsec_token") ? url : exploreUrl;
    console.error(`🔍 开始抓取笔记页面: ${primaryUrl}`);

    // 尝试抓取，如果返回"页面不见了"则回退到 explore URL
    let html = await this.fetchPage(primaryUrl);
    if (html && this.isNotFoundPage(html) && primaryUrl !== exploreUrl) {
      console.error(`⚠️ 原始 URL 返回"页面不见了"，回退尝试 explore URL: ${exploreUrl}`);
      html = await this.fetchPage(exploreUrl);
    }

    if (!html) {
      return null;
    }

    return this.parseNoteHtml(html, noteId);
  }

  /**
   * 仅抓取笔记页面的图片列表
   * @param url 小红书笔记 URL
   */
  async scrapeImages(url: string): Promise<string[]> {
    const result = await this.scrapeNote(url);
    return result?.images || [];
  }
}
