import { GoogleGenAI } from '@google/genai';

const DEFAULT_WP_SITE = process.env.WP_STATS_SITE_URL || 'https://celeb24h.com';
const DEFAULT_WP_USER = process.env.WP_STATS_USERNAME || 'adgoole';
const DEFAULT_WP_PASS = process.env.WP_STATS_PASSWORD || 'Biencualo8282#';

export interface WpCategoryItem {
  id: number;
  name: string;
  slug: string;
  count: number;
}

export interface WpRemotePostItem {
  id: number;
  title: string;
  content: string;
  excerpt: string;
  slug: string;
  status: 'publish' | 'draft' | 'future' | 'pending' | 'private';
  date: string;
  modified: string;
  link: string;
  authorId: number;
  authorName: string;
  employeeCode: string;
  categories: number[];
  categoryNames: string[];
  featuredMediaId: number;
  featuredImageUrl: string;
}

export interface WpEmployeeAuthorMap {
  code: string;
  wpUserId: number;
  wpUsername: string;
  displayName: string;
  staffUsername: string;
}

export const WP_EMPLOYEE_AUTHOR_MAP: WpEmployeeAuthorMap[] = [
  { code: 'M2001', wpUserId: 2, wpUsername: 'Ly', displayName: 'Ms Ly (M2001)', staffUsername: 'MS.LY' },
  { code: 'H2000', wpUserId: 3, wpUsername: 'Huyen', displayName: 'Ms Huyen (H2000)', staffUsername: 'MS.HUYEN' },
  { code: 'H0088', wpUserId: 4, wpUsername: 'Hiep', displayName: 'Hiep MS (H0088)', staffUsername: 'MSHIEP' },
  { code: 'A0005', wpUserId: 5, wpUsername: 'Nhi', displayName: 'Ms Nhi (A0005)', staffUsername: 'MS.NHI' },
  { code: 'A0006', wpUserId: 6, wpUsername: 'adgoole', displayName: 'Mr Google (A0006)', staffUsername: 'Quản Lý (Admin)' },
  { code: 'H0082', wpUserId: 1, wpUsername: 'admin', displayName: 'Admin (H0082)', staffUsername: 'Admin' },
];

interface WpPublishAuthSession {
  cookieHeader: string;
  restNonce: string;
  restRoot: string;
  expiresAt: number;
}

let cachedPublishSession: WpPublishAuthSession | null = null;

function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8217;/g, '’')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#038;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function stripHtmlTags(html: string): string {
  if (!html) return '';
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, '')).trim();
}

export function resolveWpUserIdByEmployeeCode(code?: string): number {
  const clean = (code || '').trim().toUpperCase();
  const found = WP_EMPLOYEE_AUTHOR_MAP.find((m) => m.code === clean);
  return found ? found.wpUserId : 6; // Default Mr Google (adgoole)
}

export function resolveEmployeeByWpUserId(wpUserId?: number): WpEmployeeAuthorMap {
  const found = WP_EMPLOYEE_AUTHOR_MAP.find((m) => m.wpUserId === Number(wpUserId));
  return (
    found || {
      code: 'A0006',
      wpUserId: Number(wpUserId) || 6,
      wpUsername: 'adgoole',
      displayName: 'Mr Google (A0006)',
      staffUsername: 'Quản Lý (Admin)',
    }
  );
}

async function getWpRestSession(forceRefresh = false): Promise<WpPublishAuthSession> {
  if (!forceRefresh && cachedPublishSession && cachedPublishSession.expiresAt > Date.now()) {
    return cachedPublishSession;
  }

  const loginUrl = `${DEFAULT_WP_SITE}/wp-login.php`;
  const body = new URLSearchParams({
    log: DEFAULT_WP_USER,
    pwd: DEFAULT_WP_PASS,
    'wp-submit': 'Log In',
    redirect_to: `${DEFAULT_WP_SITE}/wp-admin/`,
    testcookie: '1',
  });

  const loginRes = await fetch(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: 'wordpress_test_cookie=WP%20Cookie%20check',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0 Safari/537.36',
    },
    body: body.toString(),
    redirect: 'manual',
  });

  const rawCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [];
  const cookieHeader = rawCookies
    .map((c) => c.split(';')[0])
    .filter(
      (c) =>
        c.startsWith('wordpress_logged_in_') ||
        c.startsWith('wordpress_sec_') ||
        c.startsWith('wordpress_') ||
        c.startsWith('wp-settings-')
    )
    .join('; ');

  if (!cookieHeader.includes('wordpress_logged_in_')) {
    throw new Error('Không thể đăng nhập vào hệ thống WordPress celeb24h.com');
  }

  // Lấy X-WP-Nonce từ trang post-new.php
  const postNewRes = await fetch(`${DEFAULT_WP_SITE}/wp-admin/post-new.php`, {
    headers: {
      Cookie: cookieHeader,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0 Safari/537.36',
    },
  });
  const html = await postNewRes.text();
  const nonceMatch = html.match(/wpApiSettings\s*=\s*(\{[^;]+\})/);
  let restNonce = '';
  let restRoot = `${DEFAULT_WP_SITE}/wp-json/`;

  if (nonceMatch && nonceMatch[1]) {
    try {
      const parsed = JSON.parse(nonceMatch[1]);
      restNonce = parsed.nonce || '';
      restRoot = parsed.root || restRoot;
    } catch {
      // Fallback regex
    }
  }

  if (!restNonce) {
    const fallbackNonce = html.match(/"nonce"\s*:\s*"([a-zA-Z0-9]+)"/);
    if (fallbackNonce) restNonce = fallbackNonce[1];
  }

  cachedPublishSession = {
    cookieHeader,
    restNonce,
    restRoot: restRoot.endsWith('/') ? restRoot : `${restRoot}/`,
    expiresAt: Date.now() + 20 * 60 * 1000, // 20 phút
  };

  return cachedPublishSession;
}

export async function fetchWpPublishInitData(): Promise<{
  ok: boolean;
  siteUrl: string;
  categories: WpCategoryItem[];
  posts: WpRemotePostItem[];
  authors: WpEmployeeAuthorMap[];
}> {
  const session = await getWpRestSession();
  const headers = {
    Cookie: session.cookieHeader,
    'X-WP-Nonce': session.restNonce,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0 Safari/537.36',
  };

  const [catRes, postsRes] = await Promise.all([
    fetch(`${session.restRoot}wp/v2/categories?per_page=50`, { headers }),
    fetch(
      `${session.restRoot}wp/v2/posts?_embed&per_page=25&status=publish,draft,future&context=edit`,
      { headers }
    ),
  ]);

  let categories: WpCategoryItem[] = [];
  if (catRes.ok) {
    const rawCats = await catRes.json();
    if (Array.isArray(rawCats)) {
      categories = rawCats.map((c: any) => ({
        id: Number(c.id),
        name: decodeHtmlEntities(String(c.name || '')),
        slug: String(c.slug || ''),
        count: Number(c.count || 0),
      }));
    }
  }

  const catMap = new Map<number, string>();
  categories.forEach((c) => catMap.set(c.id, c.name));

  let posts: WpRemotePostItem[] = [];
  if (postsRes.ok) {
    const rawPosts = await postsRes.json();
    if (Array.isArray(rawPosts)) {
      posts = rawPosts.map((p: any) => {
        const authorInfo = resolveEmployeeByWpUserId(p.author);
        const catIds: number[] = Array.isArray(p.categories) ? p.categories.map(Number) : [];
        const embeddedMedia = p._embedded?.['wp:featuredmedia']?.[0];
        const featuredImageUrl =
          embeddedMedia?.source_url ||
          embeddedMedia?.media_details?.sizes?.medium?.source_url ||
          '';

        return {
          id: Number(p.id),
          title: decodeHtmlEntities(
            typeof p.title === 'object' ? p.title.raw || p.title.rendered || '' : String(p.title || '')
          ),
          content:
            typeof p.content === 'object'
              ? p.content.raw || p.content.rendered || ''
              : String(p.content || ''),
          excerpt: stripHtmlTags(
            typeof p.excerpt === 'object'
              ? p.excerpt.raw || p.excerpt.rendered || ''
              : String(p.excerpt || '')
          ),
          slug: String(p.slug || ''),
          status: p.status || 'publish',
          date: String(p.date || ''),
          modified: String(p.modified || ''),
          link: String(p.link || `${DEFAULT_WP_SITE}/${p.id}`),
          authorId: Number(p.author || 6),
          authorName: authorInfo.displayName,
          employeeCode: authorInfo.code,
          categories: catIds,
          categoryNames: catIds.map((id) => catMap.get(id) || `#${id}`),
          featuredMediaId: Number(p.featured_media || 0),
          featuredImageUrl,
        };
      });
    }
  }

  return {
    ok: true,
    siteUrl: DEFAULT_WP_SITE,
    categories,
    posts,
    authors: WP_EMPLOYEE_AUTHOR_MAP,
  };
}

export async function uploadMediaToWordPress(params: {
  base64Data?: string;
  imageUrl?: string;
  fileName?: string;
  altText?: string;
}): Promise<{ id: number; url: string }> {
  const session = await getWpRestSession();
  let buffer: Buffer;
  let mimeType = 'image/jpeg';
  let finalFileName = params.fileName || `celeb24h-${Date.now()}.jpg`;

  if (params.base64Data) {
    const match = params.base64Data.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
    if (match) {
      mimeType = match[1];
      buffer = Buffer.from(match[2], 'base64');
    } else {
      buffer = Buffer.from(params.base64Data, 'base64');
    }
  } else if (params.imageUrl) {
    const imgRes = await fetch(params.imageUrl);
    if (!imgRes.ok) {
      throw new Error(`Không thể tải ảnh từ URL: ${params.imageUrl}`);
    }
    const contentType = imgRes.headers.get('content-type');
    if (contentType && contentType.startsWith('image/')) {
      mimeType = contentType.split(';')[0];
    }
    const arrayBuffer = await imgRes.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } else {
    throw new Error('Không có dữ liệu ảnh để tải lên WordPress');
  }

  const ext = mimeType.includes('png')
    ? 'png'
    : mimeType.includes('webp')
    ? 'webp'
    : mimeType.includes('gif')
    ? 'gif'
    : 'jpg';
  if (!finalFileName.includes('.')) {
    finalFileName = `${finalFileName}.${ext}`;
  }

  const uploadRes = await fetch(`${session.restRoot}wp/v2/media`, {
    method: 'POST',
    headers: {
      Cookie: session.cookieHeader,
      'X-WP-Nonce': session.restNonce,
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(finalFileName)}"`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0 Safari/537.36',
    },
    body: new Uint8Array(buffer),
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Lỗi tải ảnh lên WordPress (${uploadRes.status}): ${errText.slice(0, 200)}`);
  }

  const mediaJson: any = await uploadRes.json();
  const mediaId = Number(mediaJson.id);
  const sourceUrl = String(mediaJson.source_url || '');

  if (params.altText && mediaId) {
    await fetch(`${session.restRoot}wp/v2/media/${mediaId}`, {
      method: 'POST',
      headers: {
        Cookie: session.cookieHeader,
        'X-WP-Nonce': session.restNonce,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ alt_text: params.altText }),
    }).catch(() => {});
  }

  return { id: mediaId, url: sourceUrl };
}

async function resolveOrCreateTags(
  tagNames: string[],
  session: WpPublishAuthSession
): Promise<number[]> {
  const cleanTags = Array.from(
    new Set(tagNames.map((t) => t.trim()).filter((t) => t.length > 0))
  ).slice(0, 15);
  if (cleanTags.length === 0) return [];

  const tagIds: number[] = [];
  for (const name of cleanTags) {
    try {
      const createRes = await fetch(`${session.restRoot}wp/v2/tags`, {
        method: 'POST',
        headers: {
          Cookie: session.cookieHeader,
          'X-WP-Nonce': session.restNonce,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      if (createRes.ok) {
        const created: any = await createRes.json();
        if (created?.id) tagIds.push(Number(created.id));
      } else {
        const errJson: any = await createRes.json().catch(() => null);
        if (errJson?.code === 'term_exists' && errJson?.data?.term_id) {
          tagIds.push(Number(errJson.data.term_id));
        }
      }
    } catch {
      // Ignore individual tag error
    }
  }
  return tagIds;
}

export interface PublishArticleInput {
  postId?: number;
  title: string;
  content: string;
  excerpt?: string;
  slug?: string;
  status?: 'publish' | 'draft' | 'future';
  categories?: number[];
  tags?: string[];
  employeeCode?: string;
  featuredMediaId?: number;
  featuredImageBase64?: string;
  featuredImageUrl?: string;
  featuredImageAlt?: string;
  // Tùy chọn đích đẩy bài khác (Custom WordPress hoặc Webhook)
  targetMode?: 'default_wp' | 'custom_wp' | 'webhook';
  customWpUrl?: string;
  customWpUser?: string;
  customWpAppPassword?: string;
  webhookUrl?: string;
  webhookSecret?: string;
}

export async function publishArticleToTarget(input: PublishArticleInput) {
  const targetMode = input.targetMode || 'default_wp';

  // 1. Chế độ đẩy qua Webhook API
  if (targetMode === 'webhook' && input.webhookUrl) {
    const webhookRes = await fetch(input.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(input.webhookSecret ? { Authorization: `Bearer ${input.webhookSecret}` } : {}),
      },
      body: JSON.stringify({
        title: input.title,
        content: input.content,
        excerpt: input.excerpt || '',
        slug: input.slug || '',
        status: input.status || 'publish',
        categories: input.categories || [],
        tags: input.tags || [],
        employeeCode: input.employeeCode || '',
        featuredImageUrl: input.featuredImageUrl || '',
        publishedAt: new Date().toISOString(),
      }),
    });

    if (!webhookRes.ok) {
      const errText = await webhookRes.text();
      throw new Error(`Webhook trả về lỗi (${webhookRes.status}): ${errText.slice(0, 200)}`);
    }

    const resData: any = await webhookRes.json().catch(() => ({}));
    const link = resData.url || resData.link || input.webhookUrl;
    const empCode = (input.employeeCode || '').trim().toUpperCase();
    const trackingLink = empCode
      ? `${link}${link.includes('?') ? '&' : '?'}${empCode}`
      : link;

    return {
      ok: true,
      targetMode: 'webhook',
      post: {
        id: resData.id || Date.now(),
        title: input.title,
        link,
        trackingLink,
        status: input.status || 'publish',
        slug: input.slug || '',
        date: new Date().toISOString(),
        authorId: 0,
        employeeCode: empCode,
        featuredImageUrl: input.featuredImageUrl || '',
      },
    };
  }

  // 2. Chế độ Custom WordPress (Application Password)
  if (targetMode === 'custom_wp' && input.customWpUrl && input.customWpUser && input.customWpAppPassword) {
    const baseSite = input.customWpUrl.replace(/\/+$/, '');
    const authHeader =
      'Basic ' +
      Buffer.from(`${input.customWpUser}:${input.customWpAppPassword}`).toString('base64');

    const postEndpoint = input.postId
      ? `${baseSite}/wp-json/wp/v2/posts/${input.postId}`
      : `${baseSite}/wp-json/wp/v2/posts`;

    const wpRes = await fetch(postEndpoint, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: input.title,
        content: input.content,
        excerpt: input.excerpt || '',
        ...(input.slug ? { slug: input.slug } : {}),
        status: input.status || 'publish',
        ...(input.categories && input.categories.length > 0 ? { categories: input.categories } : {}),
      }),
    });

    if (!wpRes.ok) {
      const errText = await wpRes.text();
      throw new Error(`WordPress tùy chỉnh trả về lỗi (${wpRes.status}): ${errText.slice(0, 250)}`);
    }

    const created: any = await wpRes.json();
    const link = String(created.link || `${baseSite}/?p=${created.id}`);
    const empCode = (input.employeeCode || '').trim().toUpperCase();
    const trackingLink = empCode
      ? `${link}${link.includes('?') ? '&' : '?'}${empCode}`
      : link;

    return {
      ok: true,
      targetMode: 'custom_wp',
      post: {
        id: Number(created.id),
        title: input.title,
        link,
        trackingLink,
        status: created.status || input.status || 'publish',
        slug: String(created.slug || ''),
        date: String(created.date || new Date().toISOString()),
        authorId: Number(created.author || 1),
        employeeCode: empCode,
        featuredImageUrl: input.featuredImageUrl || '',
      },
    };
  }

  // 3. Chế độ Mặc định: Đẩy trực tiếp lên https://celeb24h.com
  const session = await getWpRestSession();
  let featuredMediaId = Number(input.featuredMediaId || 0);
  let hostedFeaturedUrl = input.featuredImageUrl || '';

  if (!featuredMediaId && (input.featuredImageBase64 || input.featuredImageUrl)) {
    try {
      const uploaded = await uploadMediaToWordPress({
        base64Data: input.featuredImageBase64,
        imageUrl: input.featuredImageUrl,
        altText: input.featuredImageAlt || input.title,
      });
      featuredMediaId = uploaded.id;
      hostedFeaturedUrl = uploaded.url;
    } catch (uploadErr) {
      console.warn('[wpPublishService] Featured image upload fallback:', uploadErr);
    }
  }

  const tagIds = input.tags && input.tags.length > 0 ? await resolveOrCreateTags(input.tags, session) : [];
  const empCode = (input.employeeCode || '').trim().toUpperCase();
  const wpAuthorId = resolveWpUserIdByEmployeeCode(empCode);

  const postPayload: Record<string, any> = {
    title: input.title,
    content: input.content,
    excerpt: input.excerpt || '',
    status: input.status || 'publish',
    author: wpAuthorId,
    categories: input.categories && input.categories.length > 0 ? input.categories : [2], // Mặc định chuyên mục Showbiz (ID 2)
  };

  if (input.slug && input.slug.trim()) {
    postPayload.slug = input.slug.trim();
  }
  if (featuredMediaId > 0) {
    postPayload.featured_media = featuredMediaId;
  }
  if (tagIds.length > 0) {
    postPayload.tags = tagIds;
  }

  const endpoint = input.postId
    ? `${session.restRoot}wp/v2/posts/${input.postId}`
    : `${session.restRoot}wp/v2/posts`;

  let wpRes = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Cookie: session.cookieHeader,
      'X-WP-Nonce': session.restNonce,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0 Safari/537.36',
    },
    body: JSON.stringify(postPayload),
  });

  if (wpRes.status === 401 || wpRes.status === 403) {
    const refreshed = await getWpRestSession(true);
    wpRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Cookie: refreshed.cookieHeader,
        'X-WP-Nonce': refreshed.restNonce,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0 Safari/537.36',
      },
      body: JSON.stringify(postPayload),
    });
  }

  if (!wpRes.ok) {
    const errText = await wpRes.text();
    throw new Error(`Không thể đẩy bài lên celeb24h.com (${wpRes.status}): ${errText.slice(0, 250)}`);
  }

  const created: any = await wpRes.json();
  const cleanLink = String(created.link || `${DEFAULT_WP_SITE}/${created.id}`).replace(/\/+$/, '');
  const trackingLink = empCode
    ? `${cleanLink}${cleanLink.includes('?') ? '&' : '?'}${empCode}`
    : cleanLink;

  return {
    ok: true,
    targetMode: 'default_wp',
    post: {
      id: Number(created.id),
      title: decodeHtmlEntities(
        typeof created.title === 'object'
          ? created.title.raw || created.title.rendered || input.title
          : input.title
      ),
      link: cleanLink,
      trackingLink,
      status: created.status || input.status || 'publish',
      slug: String(created.slug || ''),
      date: String(created.date || new Date().toISOString()),
      authorId: Number(created.author || wpAuthorId),
      employeeCode: empCode || resolveEmployeeByWpUserId(wpAuthorId).code,
      featuredMediaId,
      featuredImageUrl: hostedFeaturedUrl,
    },
  };
}

export async function generateSeoArticleWithAi(params: {
  topic: string;
  keyword?: string;
  language?: 'en' | 'vi';
  tone?: string;
  categoryName?: string;
  mode?: 'full_article' | 'outline' | 'rewrite' | 'seo_meta';
  existingContent?: string;
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const langLabel = params.language === 'vi' ? 'Tiếng Việt' : 'English (US Showbiz/Entertainment style)';
  const kw = params.keyword || params.topic;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Bạn là biên tập viên SEO chuyên nghiệp cho trang tin giải trí & đời sống celeb24h.com.
Ngôn ngữ viết: ${langLabel}.
Chuyên mục: ${params.categoryName || 'Showbiz / Story / Film'}.
Chủ đề / Yêu cầu: ${params.topic}
Từ khóa SEO chính: ${kw}
${params.existingContent ? `Nội dung gốc tham khảo:\n${params.existingContent.slice(0, 3000)}\n` : ''}

Hãy trả về kết quả ở định dạng JSON thuần (không bọc markdown) với cấu trúc:
{
  "title": "Tiêu đề bài viết hấp dẫn chuẩn SEO (55-70 ký tự)",
  "slug": "duong-dan-url-chuan-seo",
  "excerpt": "Đoạn mô tả Meta Description chuẩn SEO (140-160 ký tự) kích thích lượt click",
  "focusKeyword": "từ khóa chính",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "contentHtml": "Nội dung bài viết chi tiết định dạng HTML sạch sử dụng các thẻ <p>, <h2>, <h3>, <ul>, <li>, <blockquote>, <strong>. Bài viết dài tối thiểu 500-800 từ, chia rõ các đoạn và thẻ H2/H3 hấp dẫn."
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const rawText = response.text || '';
      const parsed = JSON.parse(rawText);
      if (parsed && parsed.title && parsed.contentHtml) {
        return {
          ok: true,
          ...parsed,
        };
      }
    } catch (err) {
      console.warn('[wpPublishService] Gemini generation fallback:', err);
    }
  }

  // Fallback thông minh khi chưa cấu hình GEMINI_API_KEY hoặc ngoại tuyến
  const isVi = params.language === 'vi';
  const cleanTopic = params.topic.trim();
  const slug = cleanTopic
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 75);

  if (isVi) {
    return {
      ok: true,
      title: `${cleanTopic}: Những tình tiết đáng chú ý khiến khán giả xôn xao`,
      slug,
      excerpt: `Khám phá chi tiết câu chuyện xoay quanh ${cleanTopic} cùng những góc khuất hậu trường và phản ứng bất ngờ từ công chúng.`,
      focusKeyword: kw,
      tags: [kw, params.categoryName || 'Showbiz', 'Tin tức giải trí', 'Celeb24h'],
      contentHtml: `<p><strong>${cleanTopic}</strong> đang trở thành tâm điểm chú ý của đông đảo khán giả và người hâm mộ trong những ngày gần đây với nhiều tình tiết bất ngờ.</p>
<h2>1. Toàn cảnh câu chuyện xoay quanh ${cleanTopic}</h2>
<p>Ngay sau khi những hình ảnh và thông tin đầu tiên về <strong>${kw}</strong> được chia sẻ, cộng đồng mạng đã nhanh chóng dành sự quan tâm đặc biệt. Nhiều khán giả bày tỏ sự bất ngờ trước những khoảnh khắc đời thường hiếm hoi nhưng đầy cảm xúc này.</p>
<blockquote><p>"Đôi khi chính những khoảnh khắc giản dị phía sau ánh hào quang lại là điều chạm đến trái tim khán giả sâu sắc nhất."</p></blockquote>
<h2>2. Những điểm nhấn đáng chú ý</h2>
<ul>
  <li><strong>Sự thay đổi mới mẻ:</strong> Hình ảnh gần gũi, khác biệt hoàn toàn so với vẻ ngoài lộng lẫy thường thấy trên sân khấu.</li>
  <li><strong>Phản ứng tích cực từ công chúng:</strong> Hàng loạt bình luận chia sẻ và gửi lời chúc tốt đẹp từ người hâm mộ.</li>
  <li><strong>Dấu ấn riêng biệt:</strong> Khẳng định sức hút bền bỉ của ${kw} qua nhiều năm hoạt động nghệ thuật.</li>
</ul>
<h2>3. Lời kết</h2>
<p>Câu chuyện về <strong>${cleanTopic}</strong> một lần nữa cho thấy sức hút mạnh mẽ đối với truyền thông và công chúng. Hãy tiếp tục theo dõi những cập nhật mới nhất trên hệ thống.</p>`,
    };
  }

  return {
    ok: true,
    title: `${cleanTopic}: Inside the Rare Moment Everyone Is Talking About`,
    slug,
    excerpt: `Take a closer look at ${cleanTopic}, the heartfelt behind-the-scenes story, and why fans everywhere are sharing their reactions.`,
    focusKeyword: kw,
    tags: [kw, params.categoryName || 'Showbiz', 'Celebrity News', 'Exclusive Story'],
    contentHtml: `<p><strong>${cleanTopic}</strong> has quickly captured the attention of fans and viewers alike, sparking widespread conversation across social media.</p>
<h2>The Story Behind ${cleanTopic}</h2>
<p>When new details surrounding <strong>${kw}</strong> first surfaced, longtime admirers were quick to notice the genuine, unfiltered nature of the moment. Stepping away from the spotlight often reveals a side of public figures that audiences rarely get to witness.</p>
<blockquote><p>"It is often the quietest, most unexpected chapters off-camera that leave the strongest impression on fans."</p></blockquote>
<h2>Key Highlights Fans Noticed</h2>
<ul>
  <li><strong>A Rare Glimpse Behind the Scenes:</strong> An authentic look far removed from the usual red-carpet appearances.</li>
  <li><strong>Overwhelming Fan Support:</strong> Thousands of readers and followers shared warm messages and memories.</li>
  <li><strong>Lasting Legacy:</strong> A reminder of why ${kw} continues to resonate with audiences after all these years.</li>
</ul>
<h2>Final Thoughts</h2>
<p>As discussions around <strong>${cleanTopic}</strong> continue to grow, one thing remains clear: authentic stories and timeless moments never go out of style.</p>`,
  };
}
