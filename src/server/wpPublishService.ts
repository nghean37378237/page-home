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

export interface RelatedYouTubeVideo {
  videoId: string;
  title: string;
  watchUrl: string;
  embedUrl: string;
  thumbnailUrl: string;
}

export interface ScrapedArticleImage {
  url: string;
  alt: string;
  isFeatured?: boolean;
}

const SCRAPER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function resolveAbsUrl(rawUrl: string, baseUrl: string): string {
  const cleaned = String(rawUrl || '')
    .trim()
    .replace(/^['"]|['"]$/g, '');
  if (!cleaned || cleaned.startsWith('data:') || cleaned.startsWith('blob:')) return '';
  try {
    return new URL(cleaned, baseUrl).href;
  } catch {
    return '';
  }
}

function isIgnorableImage(url: string): boolean {
  const lower = url.toLowerCase();
  if (
    lower.endsWith('.svg') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.ico') ||
    lower.includes('gravatar.com') ||
    lower.includes('/plugins/') ||
    lower.includes('/themes/') ||
    lower.includes('emoji') ||
    lower.includes('smilies') ||
    lower.includes('avatar') ||
    lower.includes('favicon') ||
    lower.includes('logo') ||
    lower.includes('icon') ||
    lower.includes('pixel') ||
    lower.includes('analytics') ||
    lower.includes('doubleclick') ||
    lower.includes('facebook.com/tr') ||
    lower.includes('google-analytics') ||
    lower.includes('1x1') ||
    lower.includes('spacer') ||
    lower.includes('blank.') ||
    lower.includes('lazyload') ||
    lower.includes('placeholder')
  ) {
    return true;
  }
  const tinyMatch = lower.match(/-(\d+)x(\d+)\.(jpg|jpeg|png|webp|avif)/);
  if (tinyMatch) {
    const w = Number(tinyMatch[1]);
    const h = Number(tinyMatch[2]);
    if (w < 160 && h < 160) return true;
  }
  return false;
}

function pickBestSrcFromSrcset(srcset: string, baseUrl: string): string {
  if (!srcset) return '';
  const candidates: { url: string; width: number }[] = [];
  for (const part of srcset.split(',')) {
    const tokens = part.trim().split(/\s+/);
    if (!tokens[0]) continue;
    const u = resolveAbsUrl(tokens[0], baseUrl);
    if (!u) continue;
    let width = 0;
    if (tokens[1]?.endsWith('w')) {
      width = parseInt(tokens[1].slice(0, -1), 10) || 0;
    } else if (tokens[1]?.endsWith('x')) {
      width = (parseFloat(tokens[1].slice(0, -1)) || 1) * 600;
    }
    candidates.push({ url: u, width });
  }
  if (candidates.length === 0) return '';
  candidates.sort((a, b) => {
    const scoreA = a.width >= 600 && a.width <= 1600 ? a.width + 2000 : a.width;
    const scoreB = b.width >= 600 && b.width <= 1600 ? b.width + 2000 : b.width;
    return scoreB - scoreA;
  });
  return candidates[0].url;
}

function collectImgsFromHtml(htmlChunk: string, baseUrl: string): { url: string; alt: string }[] {
  const list: { url: string; alt: string }[] = [];

  const sourceRegex = /<source\b[^>]*>/gi;
  let sm: RegExpExecArray | null;
  while ((sm = sourceRegex.exec(htmlChunk)) !== null) {
    const tag = sm[0];
    const ss =
      tag.match(/\bdata-srcset=["']([^"']+)["']/i) ||
      tag.match(/\bdata-lazy-srcset=["']([^"']+)["']/i) ||
      tag.match(/\bsrcset=["']([^"']+)["']/i);
    if (ss && ss[1]) {
      const best = pickBestSrcFromSrcset(ss[1], baseUrl);
      if (best && !isIgnorableImage(best)) {
        list.push({ url: best, alt: '' });
      }
    }
  }

  const imgRegex = /<img\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRegex.exec(htmlChunk)) !== null) {
    const tag = m[0];
    const wMatch = tag.match(/\bwidth=["']?(\d+)/i);
    const hMatch = tag.match(/\bheight=["']?(\d+)/i);
    if (wMatch && hMatch) {
      const w = Number(wMatch[1]);
      const h = Number(hMatch[1]);
      if (w > 0 && h > 0 && w < 120 && h < 120) continue;
    }
    const ss =
      tag.match(/\bdata-lazy-srcset=["']([^"']+)["']/i) ||
      tag.match(/\bdata-srcset=["']([^"']+)["']/i) ||
      tag.match(/\bsrcset=["']([^"']+)["']/i);
    let chosen = ss && ss[1] ? pickBestSrcFromSrcset(ss[1], baseUrl) : '';
    if (!chosen) {
      const srcAttr =
        tag.match(/\bdata-lazy-src=["']([^"']+)["']/i) ||
        tag.match(/\bdata-src=["']([^"']+)["']/i) ||
        tag.match(/\bdata-original=["']([^"']+)["']/i) ||
        tag.match(/\bdata-full-url=["']([^"']+)["']/i) ||
        tag.match(/\bdata-hi-res-src=["']([^"']+)["']/i) ||
        tag.match(/\bsrc=["']([^"']+)["']/i);
      if (srcAttr && srcAttr[1]) {
        chosen = resolveAbsUrl(srcAttr[1], baseUrl);
      }
    }
    if (!chosen || isIgnorableImage(chosen)) continue;
    const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
    const alt = altMatch ? decodeHtmlEntities(altMatch[1]) : '';
    list.push({ url: chosen, alt });
  }
  return list;
}

/**
 * Tìm 2 video YouTube liên quan thực tế theo chủ đề hoặc tên nhân vật
 */
export async function searchRelatedYouTubeVideos(
  rawQuery: string,
  limit = 2
): Promise<RelatedYouTubeVideo[]> {
  const cleanQuery = String(rawQuery || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanQuery) return [];

  const runSingleSearch = async (q: string): Promise<RelatedYouTubeVideo[]> => {
    try {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': SCRAPER_USER_AGENT,
          'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
        },
      });
      if (!res.ok) return [];
      const html = await res.text();
      const found: RelatedYouTubeVideo[] = [];
      const seen = new Set<string>();

      const rendererRegex =
        /"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})"[\s\S]*?"title":\{"runs":\[\{"text":"([^"]+)"/g;
      let match: RegExpExecArray | null;
      while ((match = rendererRegex.exec(html)) !== null && found.length < limit) {
        const videoId = match[1];
        const rawTitle = match[2]
          .replace(/\\u0026/g, '&')
          .replace(/\\"/g, '"')
          .trim();
        if (videoId && !seen.has(videoId)) {
          seen.add(videoId);
          found.push({
            videoId,
            title: decodeHtmlEntities(rawTitle),
            watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
            embedUrl: `https://www.youtube.com/embed/${videoId}`,
            thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          });
        }
      }
      return found;
    } catch {
      return [];
    }
  };

  // Thử tìm kiếm chính xác theo cụm từ (tối đa 8 từ đầu để sát nhân vật & sự kiện nhất)
  const words = cleanQuery.split(' ');
  const primaryQuery = words.slice(0, 8).join(' ');
  let videos = await runSingleSearch(primaryQuery);

  // Nếu chưa đủ 2 video, mở rộng tìm theo 3-4 từ khóa đầu (tên nhân vật chính)
  if (videos.length < limit && words.length > 3) {
    const fallbackQuery = `${words.slice(0, 4).join(' ')} interview story`;
    const more = await runSingleSearch(fallbackQuery);
    for (const v of more) {
      if (!videos.some((existing) => existing.videoId === v.videoId) && videos.length < limit) {
        videos.push(v);
      }
    }
  }

  return videos.slice(0, limit);
}

/**
 * Cào toàn bộ nội dung văn bản + toàn bộ ảnh minh họa từ 1 link bài viết web bất kỳ
 */
export async function scrapeWebArticleForSeoRewrite(rawUrl: string): Promise<{
  sourceUrl: string;
  siteName: string;
  originalTitle: string;
  originalExcerpt: string;
  articleText: string;
  images: ScrapedArticleImage[];
}> {
  let cleanUrl = String(rawUrl || '').trim();
  if (!cleanUrl) {
    throw new Error('Vui lòng nhập đường dẫn (URL) bài viết web!');
  }
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = `https://${cleanUrl}`;
  }

  const parsedUrl = new URL(cleanUrl);
  const origin = parsedUrl.origin;

  let originalTitle = '';
  let originalExcerpt = '';
  const paragraphs: string[] = [];
  const images: ScrapedArticleImage[] = [];
  const seenImgKeys = new Set<string>();

  const addImage = (url: string, alt = '', isFeatured = false) => {
    const resolved = resolveAbsUrl(url, cleanUrl);
    if (!resolved || isIgnorableImage(resolved)) return;
    const key = resolved
      .split('?')[0]
      .replace(/-\d+x\d+(?=\.(jpg|jpeg|png|webp|avif)$)/i, '')
      .toLowerCase();
    if (seenImgKeys.has(key)) return;
    seenImgKeys.add(key);
    images.push({ url: resolved, alt: alt || originalTitle, isFeatured });
  };

  const extractParagraphsFromHtml = (htmlChunk: string) => {
    const pRegex = /<(p|h2|h3|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let m: RegExpExecArray | null;
    while ((m = pRegex.exec(htmlChunk)) !== null) {
      const txt = stripHtmlTags(m[2]).replace(/\s+/g, ' ').trim();
      if (txt.length >= 35 && !paragraphs.includes(txt)) {
        paragraphs.push(txt);
      }
    }
  };

  // 1. Kiểm tra nếu là WordPress có post ID dạng /{id} hoặc ?p={id}
  const pathSegs = parsedUrl.pathname.split('/').filter(Boolean);
  const numericId =
    pathSegs.length > 0 && /^\d+$/.test(pathSegs[0])
      ? Number(pathSegs[0])
      : parsedUrl.searchParams.get('p') && /^\d+$/.test(parsedUrl.searchParams.get('p')!)
      ? Number(parsedUrl.searchParams.get('p'))
      : null;

  const tryFetchWpRestPost = async (apiEndpoint: string) => {
    try {
      const wpRes = await fetch(
        apiEndpoint.includes('_embed')
          ? apiEndpoint
          : `${apiEndpoint}${apiEndpoint.includes('?') ? '&' : '?'}_embed`,
        { headers: { 'User-Agent': SCRAPER_USER_AGENT } }
      );
      if (!wpRes.ok) return;
      const postJson: any = await wpRes.json();
      if (postJson && postJson.id) {
        originalTitle = decodeHtmlEntities(postJson.title?.rendered || '');
        originalExcerpt = stripHtmlTags(postJson.excerpt?.rendered || '');
        const embeddedMedia = postJson._embedded?.['wp:featuredmedia']?.[0];
        const featUrl =
          embeddedMedia?.media_details?.sizes?.large?.source_url ||
          embeddedMedia?.source_url ||
          '';
        if (featUrl) addImage(featUrl, originalTitle, true);

        const contentHtml = String(postJson.content?.rendered || '');
        extractParagraphsFromHtml(contentHtml);
        for (const img of collectImgsFromHtml(contentHtml, cleanUrl)) {
          addImage(img.url, img.alt || originalTitle, false);
        }
      }
    } catch {
      // Fallback sang quét HTML
    }
  };

  if (numericId) {
    await tryFetchWpRestPost(`${origin}/wp-json/wp/v2/posts/${numericId}?_embed`);
  }

  // 2. Quét trực tiếp HTML trang web nếu chưa có đủ nội dung hoặc ảnh
  if (paragraphs.length === 0 || images.length === 0 || !originalTitle) {
    const pageRes = await fetch(cleanUrl, {
      headers: {
        'User-Agent': SCRAPER_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!pageRes.ok && paragraphs.length === 0) {
      throw new Error(`Không thể truy cập đường dẫn (${pageRes.status}). Vui lòng kiểm tra lại link!`);
    }

    if (pageRes.ok) {
      const html = await pageRes.text();

      if (!originalTitle) {
        const ogTitle =
          html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ||
          html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
          html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        if (ogTitle && ogTitle[1]) {
          originalTitle = stripHtmlTags(ogTitle[1]);
        }
      }

      if (!originalExcerpt) {
        const ogDesc =
          html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
          html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
        if (ogDesc && ogDesc[1]) {
          originalExcerpt = decodeHtmlEntities(ogDesc[1]);
        }
      }

      // Kiểm tra link WP REST JSON nếu bài viết dùng đường dẫn chữ (slug)
      const wpJsonLink = html.match(
        /<link[^>]+type=["']application\/json["'][^>]+href=["']([^"']+\/wp\/v2\/posts\/\d+)["']/i
      );
      if (wpJsonLink && wpJsonLink[1] && paragraphs.length === 0) {
        await tryFetchWpRestPost(resolveAbsUrl(wpJsonLink[1], cleanUrl));
      }

      // Lấy og:image
      const ogImg =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
        html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
      if (ogImg && ogImg[1]) {
        addImage(ogImg[1], originalTitle, images.length === 0);
      }

      // Lọc bỏ script/style/header/footer/nav trước khi lấy nội dung & ảnh
      const cleanBody = html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, '');

      const articleMatch =
        cleanBody.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ||
        cleanBody.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);

      const primaryZone = articleMatch && articleMatch[1] ? articleMatch[1] : cleanBody;
      extractParagraphsFromHtml(primaryZone);
      for (const img of collectImgsFromHtml(primaryZone, cleanUrl)) {
        addImage(img.url, img.alt || originalTitle, false);
      }

      if (images.length < 4 && primaryZone !== cleanBody) {
        for (const img of collectImgsFromHtml(cleanBody, cleanUrl)) {
          addImage(img.url, img.alt || originalTitle, false);
        }
      }
    }
  }

  return {
    sourceUrl: cleanUrl,
    siteName: parsedUrl.hostname.replace(/^www\./, ''),
    originalTitle: originalTitle || 'Bài viết từ Website',
    originalExcerpt,
    articleText: paragraphs.join('\n\n'),
    images: images.slice(0, 15),
  };
}

/**
 * Chèn toàn bộ ảnh minh họa xen kẽ vào giữa các đoạn bài viết và gắn 2 video YouTube liên quan ở cuối bài
 */
function enrichArticleWithImagesAndYouTube(params: {
  baseHtml: string;
  articleTitle: string;
  images: ScrapedArticleImage[];
  youtubeVideos: RelatedYouTubeVideo[];
  language: 'en' | 'vi';
}): string {
  const { baseHtml, articleTitle, images, youtubeVideos, language } = params;

  // 1. Tách bài viết thành các khối đoạn (<p>, <h2>, <h3>, <blockquote>, <ul>) để chèn xen kẽ toàn bộ ảnh minh họa
  let enrichedHtml = baseHtml.trim();

  if (images.length > 0) {
    // Loại bỏ các thẻ <img> cũ nếu có để tránh lặp rồi phân bổ toàn bộ ảnh lấy từ bài gốc
    const withoutOldFigures = enrichedHtml.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, '');
    const blockRegex = /<(h2|h3|p|blockquote|ul)\b[^>]*>[\s\S]*?<\/\1>/gi;
    const blocks = withoutOldFigures.match(blockRegex);

    if (blocks && blocks.length >= 2) {
      const resultBlocks: string[] = [];
      // Tính bước nhảy để rải đều toàn bộ ảnh minh họa trong bài
      const step = Math.max(1, Math.floor(blocks.length / (images.length + 1)));
      let imgIdx = 0;

      blocks.forEach((block, idx) => {
        resultBlocks.push(block);
        if (
          imgIdx < images.length &&
          idx > 0 &&
          (idx % step === 0 || idx === blocks.length - 2)
        ) {
          const img = images[imgIdx];
          const altText = (img.alt || articleTitle).replace(/"/g, '&quot;');
          resultBlocks.push(
            `<figure class="wp-block-image size-large" style="margin: 22px 0; text-align: center;">
  <img src="${img.url}" alt="${altText}" style="width: 100%; max-width: 820px; height: auto; border-radius: 12px; margin: 0 auto; display: block;" />
  <figcaption style="font-size: 13px; color: #64748b; margin-top: 6px; font-style: italic;">${altText}</figcaption>
</figure>`
          );
          imgIdx++;
        }
      });

      // Nếu vẫn còn ảnh chưa chèn hết thì chèn nốt trước đoạn kết bài
      while (imgIdx < images.length) {
        const img = images[imgIdx];
        const altText = (img.alt || articleTitle).replace(/"/g, '&quot;');
        resultBlocks.push(
          `<figure class="wp-block-image size-large" style="margin: 22px 0; text-align: center;">
  <img src="${img.url}" alt="${altText}" style="width: 100%; max-width: 820px; height: auto; border-radius: 12px; margin: 0 auto; display: block;" />
  <figcaption style="font-size: 13px; color: #64748b; margin-top: 6px; font-style: italic;">${altText}</figcaption>
</figure>`
        );
        imgIdx++;
      }

      enrichedHtml = resultBlocks.join('\n\n');
    } else {
      // Nếu bài ngắn hoặc không tách được block thì chèn ảnh nối tiếp
      const figuresHtml = images
        .map((img) => {
          const altText = (img.alt || articleTitle).replace(/"/g, '&quot;');
          return `<figure class="wp-block-image size-large" style="margin: 22px 0; text-align: center;">
  <img src="${img.url}" alt="${altText}" style="width: 100%; max-width: 820px; height: auto; border-radius: 12px; margin: 0 auto; display: block;" />
  <figcaption style="font-size: 13px; color: #64748b; margin-top: 6px; font-style: italic;">${altText}</figcaption>
</figure>`;
        })
        .join('\n\n');
      enrichedHtml = `${enrichedHtml}\n\n${figuresHtml}`;
    }
  }

  // 2. Cuối bài tự động gắn thêm 2 Video YouTube liên quan đến nội dung hoặc nhân vật
  if (youtubeVideos.length > 0) {
    const headingText =
      language === 'vi'
        ? '🎬 Video Liên Quan Đáng Chú Ý'
        : '🎬 Related Videos & Exclusive Moments';

    const videoBlocks = youtubeVideos
      .map((v, idx) => {
        const safeTitle = v.title.replace(/"/g, '&quot;');
        return `<div class="wp-youtube-embed-box" style="margin: 20px 0 28px 0;">
  <p><strong>Video #${idx + 1}: ${v.title}</strong></p>
  <figure class="wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio" style="margin: 12px 0;">
    <div class="wp-block-embed__wrapper" style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; background: #000;">
      <iframe src="https://www.youtube.com/embed/${v.videoId}" title="${safeTitle}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
    </div>
  </figure>
  <p style="font-size: 13px; color: #475569;">👉 <a href="${v.watchUrl}" target="_blank" rel="noopener noreferrer">${
          language === 'vi' ? 'Xem trực tiếp trên YouTube' : 'Watch on YouTube'
        }: ${v.title}</a></p>
</div>`;
      })
      .join('\n');

    enrichedHtml = `${enrichedHtml}\n\n<h2>${headingText}</h2>\n${videoBlocks}`;
  }

  return enrichedHtml;
}

export async function generateSeoArticleWithAi(params: {
  topic: string;
  keyword?: string;
  language?: 'en' | 'vi';
  tone?: string;
  categoryName?: string;
  mode?: 'from_text' | 'from_url' | 'full_article' | 'outline' | 'rewrite' | 'seo_meta';
  sourceUrl?: string;
  existingContent?: string;
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const language: 'en' | 'vi' = params.language === 'vi' ? 'vi' : 'en';
  const langLabel =
    language === 'vi' ? 'Tiếng Việt' : 'English (US Showbiz/Entertainment magazine style)';

  let scrapedImages: ScrapedArticleImage[] = [];
  let sourceTitle = '';
  let sourceExcerpt = '';
  let sourceArticleText = '';
  let resolvedSourceUrl = '';

  // Nếu là Chức năng 2 (Nhập 1 link web bất kỳ) -> Cào toàn bộ nội dung bài gốc + toàn bộ ảnh trong bài đó
  if (params.mode === 'from_url' || (params.sourceUrl && params.sourceUrl.trim())) {
    const scraped = await scrapeWebArticleForSeoRewrite(params.sourceUrl || params.topic);
    scrapedImages = scraped.images;
    sourceTitle = scraped.originalTitle;
    sourceExcerpt = scraped.originalExcerpt;
    sourceArticleText = scraped.articleText;
    resolvedSourceUrl = scraped.sourceUrl;
  }

  const effectiveTopic =
    sourceTitle || params.topic.trim() || (params.existingContent || '').slice(0, 120);
  const kw = params.keyword?.trim() || effectiveTopic.split(/[:–—|-]/)[0].trim();

  let generatedTitle = '';
  let generatedSlug = '';
  let generatedExcerpt = '';
  let generatedKeyword = kw;
  let generatedTags: string[] = [];
  let generatedHtml = '';
  let youtubeQuery = '';

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const isFromUrl = Boolean(resolvedSourceUrl);
      const prompt = isFromUrl
        ? `Bạn là biên tập viên SEO chuyên nghiệp cho chuyên trang giải trí & đời sống celeb24h.com.
Nhiệm vụ: Hãy VIẾT LẠI (Rewrite 100% mới chuẩn SEO, cuốn hút, tuyệt đối không copy nguyên xi câu chữ cũ) từ bài viết gốc dưới đây.
Ngôn ngữ đầu ra bắt buộc: ${langLabel}.
Chuyên mục: ${params.categoryName || 'Showbiz / Story / Film'}.
Tiêu đề bài gốc: ${sourceTitle}
Mô tả bài gốc: ${sourceExcerpt}
Nội dung bài gốc:
${sourceArticleText.slice(0, 6500)}

Hãy trả về JSON thuần với cấu trúc:
{
  "title": "Tiêu đề bài viết mới chuẩn SEO, hấp dẫn, kích thích click (55-75 ký tự)",
  "slug": "duong-dan-url-chuan-seo-khong-dau",
  "excerpt": "Đoạn mô tả Meta Description chuẩn SEO (140-165 ký tự)",
  "focusKeyword": "tên nhân vật chính hoặc từ khóa SEO chính",
  "youtubeSearchQuery": "tên nhân vật chính + từ khóa sự kiện ngắn gọn (3-6 từ) để tìm 2 video YouTube liên quan nhất",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "contentHtml": "Nội dung bài viết mới hoàn chỉnh định dạng HTML sạch sử dụng các thẻ <p>, <h2>, <h3>, <blockquote>, <ul>, <li>, <strong>. Độ dài tối thiểu 650-950 từ, chia thành 6-8 đoạn văn (<p>) và 3-4 tiêu đề phụ (<h2>) sâu sắc, giữ đúng toàn bộ sự kiện và tên nhân vật của bài gốc."
}`
        : `Bạn là biên tập viên SEO chuyên nghiệp cho chuyên trang giải trí & đời sống celeb24h.com.
Nhiệm vụ: Dựa vào đoạn nội dung / chủ đề dưới đây, hãy phát triển và viết thành 1 bài báo hoàn chỉnh chuẩn SEO.
Ngôn ngữ đầu ra bắt buộc: ${langLabel}.
Chuyên mục: ${params.categoryName || 'Showbiz / Story / Film'}.
Đoạn nội dung / Yêu cầu đầu vào:
${params.topic}
${params.existingContent ? `\nNội dung bổ sung:\n${params.existingContent.slice(0, 4000)}` : ''}

Hãy trả về JSON thuần với cấu trúc:
{
  "title": "Tiêu đề bài viết chuẩn SEO, cuốn hút (55-75 ký tự)",
  "slug": "duong-dan-url-chuan-seo-khong-dau",
  "excerpt": "Đoạn mô tả Meta Description chuẩn SEO (140-165 ký tự)",
  "focusKeyword": "tên nhân vật chính hoặc từ khóa SEO chính",
  "youtubeSearchQuery": "tên nhân vật chính hoặc chủ đề (3-6 từ) để tìm 2 video YouTube liên quan nhất",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "contentHtml": "Nội dung bài viết chi tiết định dạng HTML sạch sử dụng các thẻ <p>, <h2>, <h3>, <blockquote>, <ul>, <li>, <strong>. Độ dài tối thiểu 650-900 từ, chia rõ các đoạn <p> và thẻ <h2> hấp dẫn."
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      if (parsed && parsed.title && parsed.contentHtml) {
        generatedTitle = String(parsed.title);
        generatedSlug = String(parsed.slug || '');
        generatedExcerpt = String(parsed.excerpt || '');
        generatedKeyword = String(parsed.focusKeyword || kw);
        youtubeQuery = String(parsed.youtubeSearchQuery || generatedKeyword || effectiveTopic);
        generatedTags = Array.isArray(parsed.tags) ? parsed.tags.map(String) : [generatedKeyword];
        generatedHtml = String(parsed.contentHtml);
      }
    } catch (err) {
      console.warn('[wpPublishService] Gemini generation fallback:', err);
    }
  }

  // Fallback thông minh nếu không có Gemini hoặc lỗi mạng
  if (!generatedHtml) {
    const isVi = language === 'vi';
    const baseHeading = (sourceTitle || params.topic.split('\n')[0] || 'Exclusive Story').slice(
      0,
      85
    );
    generatedSlug = baseHeading
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 75);

    youtubeQuery = kw || baseHeading;
    generatedKeyword = kw.slice(0, 50);
    generatedTags = [
      generatedKeyword,
      params.categoryName || 'Showbiz',
      isVi ? 'Tin giải trí' : 'Celebrity News',
      'Celeb24h',
    ];

    if (sourceArticleText) {
      // Xây dựng bài viết chuẩn SEO từ các đoạn văn của bài gốc
      const srcParas = sourceArticleText
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter((p) => p.length > 30);

      generatedTitle = isVi
        ? `${baseHeading}: Toàn cảnh câu chuyện khiến khán giả xôn xao`
        : `${baseHeading}: Inside the Story Everyone Is Talking About`;
      generatedExcerpt =
        sourceExcerpt ||
        (srcParas[0] ? srcParas[0].slice(0, 155) : `Explore the full story around ${baseHeading}.`);

      const pBlocks: string[] = [];
      srcParas.slice(0, 12).forEach((para, idx) => {
        if (idx === 1) {
          pBlocks.push(
            `<h2>${isVi ? 'Chi tiết câu chuyện đáng chú ý' : 'The Full Story & Key Moments'}</h2>`
          );
        } else if (idx === Math.floor(srcParas.length / 2) && idx > 2) {
          pBlocks.push(
            `<h2>${
              isVi ? 'Phản ứng từ công chúng và người hâm mộ' : 'Why Fans Everywhere Are Reacting'
            }</h2>`
          );
        }
        pBlocks.push(`<p>${para}</p>`);
      });
      generatedHtml = pBlocks.join('\n\n');
    } else {
      const inputLines = params.topic
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(Boolean);
      const shortTopic = inputLines[0]?.slice(0, 75) || 'Celebrity Spotlight';

      if (isVi) {
        generatedTitle = `${shortTopic}: Những tình tiết đáng chú ý khiến khán giả xôn xao`;
        generatedExcerpt = `Khám phá chi tiết câu chuyện xoay quanh ${shortTopic} cùng những góc khuất hậu trường và phản ứng bất ngờ từ công chúng.`;
        generatedHtml = `<p><strong>${shortTopic}</strong> đang trở thành tâm điểm chú ý của đông đảo khán giả và người hâm mộ với nhiều chi tiết đầy cảm xúc.</p>
${inputLines.map((line) => `<p>${line}</p>`).join('\n')}
<h2>1. Toàn cảnh câu chuyện xoay quanh ${shortTopic}</h2>
<p>Ngay sau khi những thông tin và khoảnh khắc về <strong>${generatedKeyword}</strong> được chia sẻ, cộng đồng mạng đã nhanh chóng dành sự quan tâm đặc biệt.</p>
<blockquote><p>"Đôi khi chính những khoảnh khắc chân thực phía sau ánh hào quang lại là điều chạm đến trái tim khán giả sâu sắc nhất."</p></blockquote>
<h2>2. Những điểm nhấn đáng chú ý</h2>
<p>Không chỉ thu hút bởi câu chuyện hậu trường, <strong>${generatedKeyword}</strong> còn nhận được hàng loạt bình luận chia sẻ từ người hâm mộ.</p>`;
      } else {
        generatedTitle = `${shortTopic}: Inside the Rare Moment Everyone Is Talking About`;
        generatedExcerpt = `Take a closer look at ${shortTopic}, the heartfelt behind-the-scenes story, and why fans everywhere are sharing their reactions.`;
        generatedHtml = `<p><strong>${shortTopic}</strong> has quickly captured the attention of fans and viewers alike, sparking widespread conversation across social media.</p>
${inputLines.map((line) => `<p>${line}</p>`).join('\n')}
<h2>The Story Behind ${shortTopic}</h2>
<p>When new details surrounding <strong>${generatedKeyword}</strong> surfaced, admirers were quick to notice the genuine, unfiltered nature of the moment.</p>
<blockquote><p>"It is often the quietest, most unexpected chapters off-camera that leave the strongest impression on fans."</p></blockquote>
<h2>Why Fans Are Still Talking About It</h2>
<p>As discussions around <strong>${shortTopic}</strong> continue to grow, audiences everywhere have shared warm memories and reactions.</p>`;
      }
    }
  }

  // Tìm tự động 2 Video YouTube liên quan đến nội dung hoặc nhân vật đó
  const relatedVideos = await searchRelatedYouTubeVideos(
    youtubeQuery || generatedKeyword || generatedTitle,
    2
  );

  // Chèn toàn bộ ảnh minh họa từ bài gốc (nếu có) + gắn 2 Video YouTube vào cuối bài
  const finalContentHtml = enrichArticleWithImagesAndYouTube({
    baseHtml: generatedHtml,
    articleTitle: generatedTitle,
    images: scrapedImages,
    youtubeVideos: relatedVideos,
    language,
  });

  const primaryFeaturedImage = scrapedImages[0]?.url || '';

  return {
    ok: true,
    mode: resolvedSourceUrl ? 'from_url' : 'from_text',
    sourceUrl: resolvedSourceUrl || undefined,
    title: generatedTitle,
    slug: generatedSlug,
    excerpt: generatedExcerpt,
    focusKeyword: generatedKeyword,
    tags: generatedTags,
    contentHtml: finalContentHtml,
    featuredImageUrl: primaryFeaturedImage,
    extractedImages: scrapedImages,
    youtubeVideos: relatedVideos,
  };
}

