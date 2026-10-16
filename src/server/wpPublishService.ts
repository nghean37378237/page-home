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
    let refererOrigin = DEFAULT_WP_SITE;
    try {
      refererOrigin = `${new URL(params.imageUrl).origin}/`;
    } catch {}
    const imgRes = await fetch(params.imageUrl, {
      headers: {
        'User-Agent': SCRAPER_USER_AGENT,
        Referer: refererOrigin,
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });
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
  sourceUrl?: string;
  extractedImages?: { url: string; alt?: string; isFeatured?: boolean; isExternal?: boolean }[];
  // Tùy chọn đích đẩy bài khác (Custom WordPress hoặc Webhook)
  targetMode?: 'default_wp' | 'custom_wp' | 'webhook';
  customWpUrl?: string;
  customWpUser?: string;
  customWpAppPassword?: string;
  webhookUrl?: string;
  webhookSecret?: string;
}

function injectImagesIntoHtmlContent(
  rawHtml: string,
  images: { url: string; alt?: string; isExternal?: boolean }[],
  articleTitle: string
): string {
  if (!images || images.length === 0) return rawHtml;
  const figureBlocks = images.map((img) => {
    const altText = (img.alt || articleTitle).replace(/"/g, '&quot;');
    const sourceBadge = img.isExternal ? 'Editorial Visual Highlight' : 'Featured Story Moment';
    return `<figure class="wp-block-image size-large" style="margin: 26px 0; text-align: center;">
  <img src="${img.url}" alt="${altText}" referrerpolicy="no-referrer" style="width: 100%; max-width: 840px; height: auto; border-radius: 12px; margin: 0 auto; display: block;" />
  <figcaption style="font-size: 13px; color: #64748b; margin-top: 8px; font-style: italic;">${altText} (${sourceBadge})</figcaption>
</figure>`;
  });

  const pParts = rawHtml.split(/(<\/p>\s*(?:<br\s*\/?>)?)/i);
  if (pParts.length < 3) {
    return `${figureBlocks[0]}\n\n${rawHtml}\n\n${figureBlocks.slice(1).join('\n\n')}`;
  }

  const totalParas = Math.floor(pParts.length / 2);
  const step = Math.max(1, Math.floor(totalParas / (figureBlocks.length + 1)));
  let figIdx = 0;
  let paraCount = 0;
  const out: string[] = [];

  for (let i = 0; i < pParts.length; i++) {
    out.push(pParts[i]);
    if (i % 2 === 1) {
      paraCount++;
      if (figIdx < figureBlocks.length && (paraCount % step === 0 || paraCount === totalParas - 1)) {
        out.push(`\n\n${figureBlocks[figIdx++]}\n\n`);
      }
    }
  }
  while (figIdx < figureBlocks.length) {
    out.push(`\n\n${figureBlocks[figIdx++]}\n\n`);
  }
  return out.join('');
}

export async function publishArticleToTarget(input: PublishArticleInput) {
  const targetMode = input.targetMode || 'default_wp';

  // Đảm bảo luôn có ảnh gắn trong bài viết trước khi đẩy lên web
  let finalContent = input.content || '';
  let candidateImgs = Array.isArray(input.extractedImages)
    ? input.extractedImages.filter((im) => im && im.url)
    : [];

  if (!/<img\b/i.test(finalContent)) {
    if (candidateImgs.length === 0 && input.sourceUrl) {
      try {
        const scraped = await scrapeWebArticleForSeoRewrite(input.sourceUrl);
        candidateImgs = [...scraped.images];
      } catch {}
    }
    if (candidateImgs.length < 5) {
      try {
        const ctxProfile = analyzeArticleSubjectAndContext(
          input.title,
          finalContent,
          input.tags?.[0],
          candidateImgs
        );
        const excludeKeys = new Set(
          candidateImgs.map((im) =>
            im.url
              .split('?')[0]
              .replace(/_thumbnail(?=\.[a-z]+$)/i, '')
              .replace(/-\d+x\d+(?=\.[a-z]+$)/i, '')
              .toLowerCase()
          )
        );
        const needed = Math.max(0, 6 - candidateImgs.length);
        if (needed > 0) {
          const ext = await searchExternalRelatedImages(
            ctxProfile.combinedSearchQuery || input.title,
            needed,
            excludeKeys,
            ctxProfile
          );
          candidateImgs = [...candidateImgs, ...ext];
        }
      } catch {}
    }
    if (candidateImgs.length === 0 && input.featuredImageUrl) {
      candidateImgs = [{ url: input.featuredImageUrl, alt: input.title }];
    }
    if (candidateImgs.length > 0) {
      finalContent = injectImagesIntoHtmlContent(finalContent, candidateImgs, input.title);
    }
  }

  if (!input.featuredImageUrl && candidateImgs.length > 0) {
    input.featuredImageUrl = candidateImgs[0].url;
  }
  input.content = finalContent;

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
  isExternal?: boolean;
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
    !lower ||
    lower.startsWith('data:') ||
    lower.startsWith('blob:') ||
    lower.endsWith('.svg') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.ico') ||
    lower.includes('gravatar.com') ||
    lower.includes('/wp-includes/') ||
    lower.includes('/plugins/') ||
    lower.includes('/themes/') ||
    lower.includes('s.w.org/images/core/emoji') ||
    lower.includes('/emoji/') ||
    lower.includes('/smilies/') ||
    lower.includes('favicon') ||
    lower.includes('site-logo') ||
    lower.includes('header-logo') ||
    lower.includes('footer-logo') ||
    lower.includes('/logo.') ||
    lower.includes('-logo.') ||
    lower.includes('_logo.') ||
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
    if (w < 150 && h < 150) return true;
  }
  return false;
}

function pickBestSrcFromSrcset(srcset: string, baseUrl: string): string {
  const trimmed = String(srcset || '').trim();
  if (!trimmed || trimmed.startsWith('data:')) return '';
  const candidates: { url: string; width: number }[] = [];
  // Tách các phần tử trong srcset mà không làm đứt các URL chứa dấu phẩy (VD: Cloudinary c_crop,x_0,y_0...)
  const parts = trimmed.split(/,\s+(?=(?:https?:\/\/|\/\/|\/|[a-zA-Z0-9_-]+\/))/);
  for (const part of parts) {
    const tokens = part.trim().split(/\s+/);
    if (!tokens[0] || tokens[0].startsWith('data:')) continue;
    const u = resolveAbsUrl(tokens[0], baseUrl);
    if (!u || isIgnorableImage(u)) continue;
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
    const scoreA = a.width >= 600 && a.width <= 1800 ? a.width + 2000 : a.width;
    const scoreB = b.width >= 600 && b.width <= 1800 ? b.width + 2000 : b.width;
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
    if (ss && ss[1] && !ss[1].trim().startsWith('data:')) {
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
      if (w > 0 && h > 0 && w < 110 && h < 110) continue;
    }

    let chosen = '';
    const attrNames = [
      'data-orig-file',
      'data-large-file',
      'data-full-url',
      'data-hi-res-src',
      'data-original',
      'data-lazy-src',
      'data-src',
      'data-url',
      'data-img-url',
      'data-lazy',
    ];
    for (const attr of attrNames) {
      const matchAttr = tag.match(new RegExp(`\\b${attr}=["']([^"']+)["']`, 'i'));
      if (matchAttr && matchAttr[1] && !matchAttr[1].trim().startsWith('data:')) {
        const candidate = resolveAbsUrl(matchAttr[1], baseUrl);
        if (candidate && !isIgnorableImage(candidate)) {
          chosen = candidate;
          break;
        }
      }
    }

    if (!chosen) {
      const ss =
        tag.match(/\bdata-lazy-srcset=["']([^"']+)["']/i) ||
        tag.match(/\bdata-srcset=["']([^"']+)["']/i) ||
        tag.match(/\bsrcset=["']([^"']+)["']/i);
      if (ss && ss[1] && !ss[1].trim().startsWith('data:')) {
        chosen = pickBestSrcFromSrcset(ss[1], baseUrl);
      }
    }

    if (!chosen) {
      const srcAttr = tag.match(/\bsrc=["']([^"']+)["']/i);
      if (srcAttr && srcAttr[1] && !srcAttr[1].trim().startsWith('data:')) {
        chosen = resolveAbsUrl(srcAttr[1], baseUrl);
      }
    }

    if (!chosen || isIgnorableImage(chosen)) continue;
    // Tự động chuyển URL ảnh thumbnail cắt nhỏ của WordPress (-300x169.jpg, -678x381.webp...) về ảnh gốc chất lượng cao nếu nằm trong /wp-content/uploads/
    if (chosen.includes('/wp-content/uploads/')) {
      chosen = chosen.replace(/-(?:150x\d+|2\d\dx\d+|3\d\dx\d+|4\d\dx\d+|5\d\dx\d+|6\d\dx\d+)(?=\.(jpg|jpeg|png|webp|avif)(\?|$))/i, '');
    }
    const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
    const alt = altMatch ? decodeHtmlEntities(altMatch[1]) : '';
    list.push({ url: chosen, alt });
  }
  return list;
}

export interface ArticleContextProfile {
  primaryPerson: string;
  secondaryPerson: string;
  outfitKeywords: string[];
  locationKeywords: string[];
  eventKeywords: string[];
  eventWords: string[];
  subjectDisplay: string;
  combinedSearchQuery: string;
}

/**
 * Phân tích sâu nội dung bài viết + đối chiếu các ảnh đã có trong bài để lấy chính xác:
 * 1. Tên diễn viên / người nổi tiếng chính (primaryPerson)
 * 2. Người đi cùng / bạn đời / đồng nghiệp trong bối cảnh ảnh (secondaryPerson)
 * 3. Trang phục / đặc điểm nhận diện thị giác trong ảnh (outfitKeywords: snakeskin bikini, burgundy bikini, white bathing suit, shimmering gold dress...)
 * 4. Địa điểm & sự kiện cụ thể trong ảnh (locationKeywords & eventKeywords: Barbados, Saint-Tropez, Notting Hill, beach, yacht, stroll...)
 */
export function analyzeArticleSubjectAndContext(
  title: string,
  text: string,
  userKeyword?: string,
  existingImages?: ScrapedArticleImage[]
): ArticleContextProfile {
  const fullText = decodeHtmlEntities(String(text || ''))
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#8217;|&#8216;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  const imgAltText = Array.isArray(existingImages)
    ? existingImages
        .map((im) => `${im.alt || ''} ${im.url.split('/').pop() || ''}`)
        .join(' ')
    : '';
  const sample = fullText.slice(0, 4500);

  const stopWords = new Set([
    'There', 'The', 'This', 'That', 'These', 'Those', 'When', 'While', 'Where',
    'What', 'Who', 'Why', 'How', 'Proving', 'Looking', 'Taking', 'Channeling',
    'Addressing', 'Stepping', 'Enjoying', 'Sharing', 'Showing', 'Making', 'Soaking',
    'Confirming', 'Embracing', 'Walking', 'Strolling', 'Wearing', 'Smiling', 'Spotted',
    'Showcasing', 'Exiting', 'Following', 'Among', 'At', 'In', 'On', 'By', 'With',
    'From', 'For', 'After', 'Before', 'During', 'Despite', 'Between', 'Beyond',
    'Within', 'Without', 'Through', 'Throughout', 'Against', 'Around', 'Behind',
    'Inside', 'Outside', 'Under', 'Until', 'Upon', 'According', 'Speaking', 'Shielding',
    'Completing', 'Expecting', 'Running', 'Visiting', 'Both', 'Holding', 'Wrapping',
    'Hollywood', 'Caribbean', 'Barbados', 'London', 'West', 'North', 'South', 'East',
    'Southern', 'Northern', 'Eastern', 'Western', 'Central', 'California', 'Florida',
    'United', 'States', 'America', 'British', 'English', 'American', 'Great', 'Britain',
    'French', 'Riviera', 'Mediterranean', 'German', 'Italian', 'Spanish', 'Mexican',
    'Saint', 'Tropez', 'Cannes', 'Paris', 'Rome', 'Malibu', 'Hawaii', 'Manhattan',
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December', 'Instagram', 'Twitter',
    'Facebook', 'YouTube', 'TikTok', 'Daily', 'Mail', 'Page', 'Six', 'People',
    'Notting', 'Hill', 'Los', 'Angeles', 'New', 'York', 'Miami', 'Beach', 'Sandy', 'Lane',
    'Golden', 'Globes', 'Academy', 'Award', 'Awards', 'Oscar', 'Oscars', 'Emmy', 'Grammy',
    'Anyone', 'But', 'You', 'Star', 'Legend', 'Beauty', 'Model', 'Actress', 'Supermodel',
    'Actor', 'Singer', 'Partner', 'Candid', 'Photo', 'Recognize', 'Them', 'Her', 'Him',
    'Bear', 'Blur', 'Gorillaz', 'Landman', 'City', 'Street', 'Streets', 'Turns', 'Heads',
    'Jimmy', 'Kimmel', 'Live', 'Coogies', 'Cafe', 'Big', 'Apple', 'Uncharted', 'Invasion',
    'Beatles', 'Ted', 'Lasso', 'Succession', 'Beverly', 'Hilton', 'Hills', 'Santa', 'Monica',
    'Stunning', 'Pregnant', 'Timeless', 'Beloved', 'Famous', 'Reality', 'Heartthrob', 'Icon',
    'Real', 'Housewives', 'Brat', 'Pack', 'Night', 'Heat', 'Glad', 'All', 'Over', 'Mark', 'Twain',
    'Morning', 'Show', 'France', 'Europe', 'European', 'Exclusive', 'Story', 'Highlights'
  ]);

  const stats = new Map<
    string,
    { count: number; firstIdx: number; bioBoost: number; isCompanion: boolean }
  >();

  // Nhận diện các nhân vật đi kèm sau cụm "with her/his husband/wife/boyfriend/girlfriend/partner..."
  const companionRegex =
    /\b(?:with|alongside|beside)\s+(?:her|his|their)?\s*(?:new\s+|longtime\s+)?(?:husband|wife|partner|boyfriend|girlfriend|fiance|fiancée|companion|model|actress|actor)?\s*,?\s*([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{1,15}\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15}(?:\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15})?)/g;
  const companionSet = new Set<string>();
  let cm: RegExpExecArray | null;
  while ((cm = companionRegex.exec(sample.slice(0, 800))) !== null) {
    const cName = cm[1]
      .trim()
      .split(/\s+/)
      .filter((p) => !stopWords.has(p))
      .slice(0, 3)
      .join(' ');
    if (cName.split(/\s+/).length >= 2) {
      companionSet.add(cName);
    }
  }

  // 1. Ưu tiên nhận diện tên nhân vật đi kèm tuổi hoặc danh xưng nghề nghiệp/quan hệ
  const bioRegex =
    /(?:(\d{2}-year-old(?:\s+[a-z-]+){0,3})|(?:representative\s+for|breakout\s+star|actor|actress|singer|model|supermodel|star|frontman|mastermind|financier|husband|wife|partner|boyfriend|girlfriend|mother|father|icon|legend|winner|daughter|son)(?:\s+[a-z-]+){0,2})\s*,?\s+([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{1,15}\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15}(?:\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15})?)/g;
  let bm: RegExpExecArray | null;
  while ((bm = bioRegex.exec(sample)) !== null) {
    const rawName = bm[2].trim();
    const parts = rawName.split(/\s+/);
    const cleanParts = parts.filter((p) => !stopWords.has(p));
    if (cleanParts.length < 2) continue;
    const candidate = cleanParts.slice(0, 3).join(' ');
    const isComp = companionSet.has(candidate);
    const prev = stats.get(candidate) || {
      count: 0,
      firstIdx: bm.index,
      bioBoost: 0,
      isCompanion: isComp,
    };
    prev.bioBoost += isComp ? 18 : 38;
    if (isComp) prev.isCompanion = true;
    stats.set(candidate, prev);
  }

  // 2. Quét toàn bộ tên riêng trong bài viết
  const regex =
    /\b([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{1,15}(?:\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15}){1,2})\b/g;
  let m: RegExpExecArray | null;
  const textToScan = sample || `${title || ''} ${imgAltText}`;
  while ((m = regex.exec(textToScan)) !== null) {
    const rawName = m[1].trim();
    const parts = rawName.split(/\s+/);
    if (parts.some((p) => stopWords.has(p))) continue;
    if (parts.length < 2) continue;
    const candidate = parts.join(' ');
    const isComp = companionSet.has(candidate);
    const prev = stats.get(candidate) || {
      count: 0,
      firstIdx: m.index,
      bioBoost: 0,
      isCompanion: isComp,
    };
    prev.count += 1;
    if (isComp) prev.isCompanion = true;
    stats.set(candidate, prev);
  }

  // Cộng thêm số lần nhắc họ/tên của nhân vật mở đầu để nhân vật 3 từ (VD: Jeremy Allen White) không bị thiệt hơn nhân vật 2 từ
  for (const [fullName, info] of stats.entries()) {
    const tokens = fullName.split(/\s+/);
    const lastName = tokens[tokens.length - 1];
    if (lastName && lastName.length >= 4) {
      const lastRegex = new RegExp(`\\b${lastName}\\b`, 'g');
      const totalLastMentions = (sample.match(lastRegex) || []).length;
      if (totalLastMentions > info.count) {
        info.bioBoost += Math.min(24, (totalLastMentions - info.count) * 6);
      }
    }
  }

  const rankedEntries = [...stats.entries()].sort((a, b) => {
    const leadBonusA = a[1].firstIdx < 260 ? 38 : a[1].firstIdx < 500 ? 22 : 0;
    const leadBonusB = b[1].firstIdx < 260 ? 38 : b[1].firstIdx < 500 ? 22 : 0;
    const compPenaltyA = a[1].isCompanion ? -25 : 0;
    const compPenaltyB = b[1].isCompanion ? -25 : 0;
    const scoreA = a[1].count * 12 + a[1].bioBoost + leadBonusA + compPenaltyA;
    const scoreB = b[1].count * 12 + b[1].bioBoost + leadBonusB + compPenaltyB;
    return scoreB - scoreA;
  });

  const rankedPeople = rankedEntries.map((e) => e[0]);

  // Luôn ưu tiên nhân vật thực tế phát hiện trong bài viết (rankedPeople[0]) để không bị từ khóa cũ ghi đè
  const primaryPerson =
    rankedPeople[0] ||
    (userKeyword && userKeyword.trim()) ||
    String(title || '').split(/[:–—|-]/)[0].trim();

  // Chỉ lấy nhân vật đi cùng (secondaryPerson) nếu xuất hiện ngay ở phần mở đầu bài viết (firstIdx < 650) mô tả bức ảnh
  const secondaryEntry = rankedEntries.find(
    ([p, info]) =>
      p !== primaryPerson &&
      info.firstIdx < 650 &&
      (info.count >= 2 || info.bioBoost > 0) &&
      !primaryPerson.toLowerCase().includes(p.toLowerCase()) &&
      !p.toLowerCase().includes(primaryPerson.toLowerCase())
  );
  const secondaryPerson = secondaryEntry ? secondaryEntry[0] : '';

  // 3. Đối chiếu trang phục & đặc điểm hình ảnh (outfitKeywords) từ tiêu đề + mô tả ảnh + đoạn đầu bài viết
  const visualSceneText = `${title || ''} ${imgAltText} ${sample.slice(0, 1100)}`.toLowerCase();
  const outfitKeywords: string[] = [];
  const outfitRegex =
    /\b((?:all-white|snakeskin(?:-print)?|burgundy|white|black|red|blue|gold|shimmering\s+gold|glittering\s+gold|floral|striped|pink|green|yellow|navy|chic|skimpy|tiny|polka-dot|leopard(?:-print)?|animal-print|denim|leather|lace|sheer|sequin|silver)\s+(?:bikini|swimsuit|bathing\s+suit|swim\s+shorts|swim\s+trunks|shorts|trunks|dress|gown|mini\s+dress|summer\s+dress|tank\s+top|t-shirt|tee|shirt|top|jacket|coat|suit|jeans|trousers|pants|skirt|outfit|ensemble))\b/gi;
  let om: RegExpExecArray | null;
  while ((om = outfitRegex.exec(visualSceneText)) !== null) {
    const phrase = om[1].replace(/\s+/g, ' ').trim();
    if (!outfitKeywords.includes(phrase) && outfitKeywords.length < 3) {
      outfitKeywords.push(phrase);
    }
  }

  // 4. Địa điểm & bối cảnh của bộ ảnh (chỉ quét trong tiêu đề + 750 ký tự đầu tiên để đúng bối cảnh bộ ảnh đang có)
  const openingScene = `${title || ''} ${imgAltText} ${sample.slice(0, 750)}`.toLowerCase();
  const locationGlossary = [
    'sandy lane', 'barbados', 'saint-tropez', 'french riviera', 'notting hill',
    'west hollywood', 'london', 'malibu', 'new york', 'manhattan', 'miami',
    'bahamas', 'cabo', 'caribbean', 'cannes', 'paris', 'venice', 'beverly hills', 'los angeles'
  ];
  const locationKeywords: string[] = [];
  for (const loc of locationGlossary) {
    if (openingScene.includes(loc) && locationKeywords.length < 2) {
      locationKeywords.push(loc);
    }
  }

  const eventGlossary = [
    'bikini', 'swimsuit', 'bathing suit', 'yacht', 'beach', 'boat', 'pregnant',
    'pregnancy', 'baby bump', 'stroll', 'lunch', 'brunch', 'kiss', 'kisses',
    'motorcycle', 'red carpet', 'vacation', 'getaway', 'holiday'
  ];
  const eventKeywords: string[] = [];
  for (const ev of eventGlossary) {
    if (
      openingScene.includes(ev) &&
      eventKeywords.length < 3 &&
      !outfitKeywords.some((o) => o.includes(ev))
    ) {
      eventKeywords.push(ev);
    }
  }

  const eventWords = [...outfitKeywords, ...locationKeywords, ...eventKeywords].slice(0, 6);

  const subjectDisplay = secondaryPerson
    ? `${primaryPerson} and ${secondaryPerson}`
    : primaryPerson;

  const combinedSearchQuery = [
    primaryPerson,
    secondaryPerson,
    outfitKeywords[0] || '',
    locationKeywords[0] || '',
    eventKeywords[0] || '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    primaryPerson,
    secondaryPerson,
    outfitKeywords,
    locationKeywords,
    eventKeywords,
    eventWords,
    subjectDisplay,
    combinedSearchQuery: combinedSearchQuery || primaryPerson || title,
  };
}

/**
 * Đối chiếu ảnh đã có trong bài (trang phục, bối cảnh, nhân vật, bộ ảnh gốc) để tìm ảnh ngoài TƯƠNG TỰ & CÙNG SỰ KIỆN bổ sung khi bài thiếu ảnh (< 5 ảnh)
 */
export async function searchExternalRelatedImages(
  rawQuery: string,
  limit = 6,
  excludeKeys = new Set<string>(),
  contextProfile?: ArticleContextProfile
): Promise<ScrapedArticleImage[]> {
  const cleanQuery = String(rawQuery || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const effectiveProfile =
    contextProfile || analyzeArticleSubjectAndContext(cleanQuery, cleanQuery);

  const primaryPerson = (
    effectiveProfile.primaryPerson ||
    cleanQuery.split(/\s+/).slice(0, 3).join(' ')
  ).trim();
  const secondaryPerson = (effectiveProfile.secondaryPerson || '').trim();
  const outfitKeywords = effectiveProfile.outfitKeywords || [];
  const locationKeywords = effectiveProfile.locationKeywords || [];
  const eventKeywords = effectiveProfile.eventKeywords || [];
  const eventWords = effectiveProfile.eventWords || [];

  if (!primaryPerson && !cleanQuery) return [];

  // Xây dựng bộ truy vấn đối chiếu sát nhất với bộ ảnh gốc (Cùng nhân vật + Cùng trang phục + Cùng địa điểm/sự kiện)
  const queries = [
    [primaryPerson, secondaryPerson, outfitKeywords[0], locationKeywords[0], eventKeywords[0]]
      .filter(Boolean)
      .join(' ')
      .trim(),
    [primaryPerson, outfitKeywords[0], locationKeywords[0], eventKeywords[0], 'dailymail']
      .filter(Boolean)
      .join(' ')
      .trim(),
    [primaryPerson, secondaryPerson, locationKeywords[0], eventKeywords[0]]
      .filter(Boolean)
      .join(' ')
      .trim(),
    [primaryPerson, outfitKeywords[0], eventKeywords[0]].filter(Boolean).join(' ').trim(),
    [primaryPerson, secondaryPerson].filter(Boolean).join(' ').trim(),
  ].filter(Boolean);

  const uniqueQueries = [...new Set(queries)];
  const pTokens = primaryPerson
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  const sTokens = secondaryPerson
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  const outfitTokens = outfitKeywords
    .flatMap((w) => w.toLowerCase().split(/\s+/))
    .filter((t) => t.length >= 3);
  const locTokens = locationKeywords.map((w) => w.toLowerCase()).filter(Boolean);
  const evTokens = eventKeywords.map((w) => w.toLowerCase()).filter(Boolean);

  const scoredCandidates: (ScrapedArticleImage & { score: number; purl: string })[] = [];
  const seen = new Set<string>(excludeKeys);
  const seenMd5 = new Set<string>();

  for (const q of uniqueQueries) {
    if (scoredCandidates.length >= Math.max(limit * 3, 10)) break;
    try {
      const url = `https://www.bing.com/images/search?q=${encodeURIComponent(
        q
      )}&setmkt=en-US&setlang=en-US&cc=US&first=1`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': SCRAPER_USER_AGENT,
          'Accept-Language': 'en-US,en;q=0.9',
          Cookie: '_EDGE_S=mkt=en-us; SRCHHPGUSR=SRCHLANG=en&WLS=2',
        },
      });
      if (!res.ok) continue;
      const html = await res.text();
      const matches = html.matchAll(/m="(\{[^"]+\})"/g);
      for (const m of matches) {
        try {
          const obj = JSON.parse(decodeHtmlEntities(m[1]));
          const imgUrl = String(obj.murl || '').trim();
          if (!imgUrl || isIgnorableImage(imgUrl)) continue;
          if (!/\.(jpg|jpeg|png|webp)(\?|$)/i.test(imgUrl)) continue;
          // Loại bỏ các trang ảnh stock dính watermark bản quyền thô hoặc trang bán hàng thời trang không phải ảnh nhân vật
          if (
            /gettyimages\.|alamy\.|shutterstock\.|istockphoto\.|dreamstime\.|depositphotos\.|123rf\.|pond5\.|prettylittlething\.|shein\.|ido\.org\.tw|tiktok\.com\/api/i.test(
              imgUrl
            )
          ) {
            continue;
          }

          const normKey = imgUrl
            .split('?')[0]
            .replace(/_thumbnail(?=\.[a-z]+$)/i, '')
            .replace(/-\d+x\d+(?=\.[a-z]+$)/i, '')
            .toLowerCase();
          if (seen.has(normKey)) continue;
          if (obj.md5 && seenMd5.has(String(obj.md5))) continue;

          const titleText = decodeHtmlEntities(String(obj.t || obj.desc || ''))
            .replace(/[\uE000-\uF8FF]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          const purl = String(obj.purl || '');
          const hay = `${titleText} ${purl} ${imgUrl}`.toLowerCase();

          // BẮT BUỘC phải khớp tên diễn viên / người nổi tiếng chính trong bài
          const hasFullPrimary =
            Boolean(primaryPerson) && hay.includes(primaryPerson.toLowerCase());
          const hasAllPTokens = pTokens.length > 0 && pTokens.every((tk) => hay.includes(tk));
          if (!hasFullPrimary && !hasAllPTokens) continue;

          let score = hasFullPrimary ? 60 : 45;

          if (secondaryPerson && hay.includes(secondaryPerson.toLowerCase())) score += 50;
          else if (sTokens.length > 0 && sTokens.every((tk) => hay.includes(tk))) score += 35;

          // Cộng điểm cao nếu khớp đúng trang phục trong ảnh gốc (VD: snakeskin bikini, burgundy bikini, white bathing suit...)
          for (const ot of outfitTokens) {
            if (hay.includes(ot)) score += 22;
          }
          // Cộng điểm nếu khớp đúng địa điểm chụp ảnh (VD: Barbados, Saint-Tropez, Malibu, Notting Hill...)
          for (const lt of locTokens) {
            if (hay.includes(lt)) score += 25;
          }
          // Cộng điểm nếu khớp đúng hoạt động/sự kiện trong ảnh (VD: beach, yacht, stroll, pregnant...)
          for (const et of evTokens) {
            if (hay.includes(et)) score += 15;
          }
          // Ưu tiên nguồn báo chí giải trí / bộ ảnh paparazzi cùng sự kiện
          if (
            /dailymail\.|justjared\.|hawtcelebs\.|celebmafia\.|pagesix\.|usmagazine\.|people\.com|thesun\.|mirror\.co\.uk|backgrid/i.test(
              hay
            )
          ) {
            score += 30;
          }

          seen.add(normKey);
          if (obj.md5) seenMd5.add(String(obj.md5));

          scoredCandidates.push({
            url: imgUrl,
            alt: titleText || `${primaryPerson} - ${eventWords.join(' ')}`.trim(),
            isFeatured: false,
            isExternal: true,
            score,
            purl,
          });
        } catch {
          // ignore malformed item
        }
      }
    } catch {
      // ignore search error
    }
  }

  // Cộng điểm thưởng cho các ảnh nằm trong cùng 1 bộ ảnh / bài báo gốc (cùng purl hoặc cùng thư mục sự kiện) với ảnh điểm cao nhất
  scoredCandidates.sort((a, b) => b.score - a.score);
  const topPurl = scoredCandidates[0]?.purl;
  if (topPurl) {
    for (const item of scoredCandidates) {
      if (item.purl && item.purl === topPurl) {
        item.score += 25;
      }
    }
    scoredCandidates.sort((a, b) => b.score - a.score);
  }

  return scoredCandidates
    .slice(0, limit)
    .map(({ score: _s, purl: _p, ...rest }) => rest);
}

/**
 * Tìm 2 video YouTube liên quan SÁT NỘI DUNG NHẤT với diễn viên, người đi cùng và sự kiện trong bài
 */
export async function searchRelatedYouTubeVideos(
  rawQuery: string,
  limit = 2,
  contextProfile?: ArticleContextProfile
): Promise<RelatedYouTubeVideo[]> {
  const cleanQuery = String(rawQuery || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanQuery && !contextProfile?.primaryPerson) return [];

  const primaryPerson = (contextProfile?.primaryPerson || cleanQuery.split(/\s+/).slice(0, 3).join(' ')).trim();
  const secondaryPerson = (contextProfile?.secondaryPerson || '').trim();
  const eventWords = contextProfile?.eventWords || [];

  const queries = [
    [primaryPerson, secondaryPerson, eventWords.slice(0, 2).join(' ')].filter(Boolean).join(' ').trim(),
    [primaryPerson, eventWords.slice(0, 3).join(' ')].filter(Boolean).join(' ').trim(),
    [primaryPerson, secondaryPerson].filter(Boolean).join(' ').trim(),
    cleanQuery.split(/\s+/).slice(0, 8).join(' '),
  ].filter(Boolean);

  const uniqueQueries = [...new Set(queries)];
  const pTokens = primaryPerson
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  const sTokens = secondaryPerson
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  const eTokens = eventWords.map((w) => w.toLowerCase()).filter(Boolean);

  const candidates: (RelatedYouTubeVideo & { score: number })[] = [];
  const seen = new Set<string>();

  for (const q of uniqueQueries) {
    if (candidates.length >= 12) break;
    try {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': SCRAPER_USER_AGENT,
          'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
        },
      });
      if (!res.ok) continue;
      const html = await res.text();

      const rendererRegex =
        /"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})"[\s\S]*?"title":\{"runs":\[\{"text":"([^"]+)"/g;
      let match: RegExpExecArray | null;
      while ((match = rendererRegex.exec(html)) !== null && candidates.length < 18) {
        const videoId = match[1];
        const rawTitle = decodeHtmlEntities(
          match[2].replace(/\\u0026/g, '&').replace(/\\"/g, '"').trim()
        );
        if (!videoId || seen.has(videoId)) continue;

        const lowerTitle = rawTitle.toLowerCase();
        // Bắt buộc tiêu đề video phải nhắc tới tên diễn viên / nhân vật chính
        const hasPerson =
          (primaryPerson && lowerTitle.includes(primaryPerson.toLowerCase())) ||
          pTokens.some((tk) => lowerTitle.includes(tk));
        if (!hasPerson && candidates.length >= limit) continue;

        let score = 0;
        if (primaryPerson && lowerTitle.includes(primaryPerson.toLowerCase())) score += 50;
        else if (hasPerson) score += 25;

        if (secondaryPerson && lowerTitle.includes(secondaryPerson.toLowerCase())) score += 45;
        else if (sTokens.some((tk) => lowerTitle.includes(tk))) score += 20;

        for (const ew of eTokens) {
          if (lowerTitle.includes(ew)) score += 15;
        }

        seen.add(videoId);
        candidates.push({
          videoId,
          title: rawTitle,
          watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
          embedUrl: `https://www.youtube.com/embed/${videoId}`,
          thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          score,
        });
      }
    } catch {
      // ignore single search error
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, limit).map(({ score: _s, ...rest }) => rest);
}

function humanizeUrlSlugToTitle(pathname: string): string {
  const segs = pathname.split('/').filter(Boolean);
  const last = segs[segs.length - 1] || '';
  const cleaned = last
    .replace(/\.(html|htm|php|aspx)$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  if (!cleaned || /^\d+$/.test(cleaned)) return '';
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

function cleanScrapedTitle(rawTitle: string): string {
  const decoded = decodeHtmlEntities(rawTitle || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return decoded.replace(/\s+[|–—-]\s+[^|–—-]{2,35}\.(com|net|org|fun|vn|info|us|co\.uk)$/i, '').trim();
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
    images.push({
      url: resolved,
      alt: alt || originalTitle || 'Article Image',
      isFeatured,
      isExternal: false,
    });
  };

  const extractParagraphsFromHtml = (htmlChunk: string) => {
    const pRegex = /<(p|h2|h3|blockquote|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let m: RegExpExecArray | null;
    while ((m = pRegex.exec(htmlChunk)) !== null) {
      const txt = stripHtmlTags(m[2]).replace(/\s+/g, ' ').trim();
      if (txt.length >= 25 && !paragraphs.includes(txt)) {
        paragraphs.push(txt);
      }
    }
  };

  let matchedWpPostId = 0;

  const parseWpPostObject = (postJson: any) => {
    if (!postJson || !postJson.id) return;
    matchedWpPostId = Number(postJson.id) || 0;
    if (postJson.title?.rendered) {
      originalTitle = cleanScrapedTitle(postJson.title.rendered);
    }
    if (postJson.excerpt?.rendered) {
      originalExcerpt = stripHtmlTags(postJson.excerpt.rendered);
    }

    // Lấy cả ảnh đại diện (featuredmedia) VÀ toàn bộ ảnh trong nội dung bài viết (content.rendered)
    const embeddedMedia = postJson._embedded?.['wp:featuredmedia']?.[0];
    const featUrl =
      embeddedMedia?.media_details?.sizes?.full?.source_url ||
      embeddedMedia?.media_details?.sizes?.large?.source_url ||
      embeddedMedia?.source_url ||
      '';
    if (featUrl) {
      addImage(featUrl, originalTitle, true);
    }

    const contentHtml = String(postJson.content?.rendered || '');
    extractParagraphsFromHtml(contentHtml);
    const contentImgs = collectImgsFromHtml(contentHtml, cleanUrl);
    for (const img of contentImgs) {
      addImage(img.url, img.alt || originalTitle, images.length === 0);
    }
  };

  // 1. Kiểm tra nếu là WordPress có post ID dạng /{id} hoặc ?p={id} HOẶC có slug bài viết
  const pathSegs = parsedUrl.pathname.split('/').filter(Boolean);
  const numericId =
    pathSegs.length > 0 && /^\d+$/.test(pathSegs[0])
      ? Number(pathSegs[0])
      : parsedUrl.searchParams.get('p') && /^\d+$/.test(parsedUrl.searchParams.get('p')!)
      ? Number(parsedUrl.searchParams.get('p'))
      : null;

  // Chọn segment slug dài và chuẩn nhất (bỏ qua các hậu tố ngắn như /vn1/, /en/, /amp/, /feed/...)
  const slugCandidates = pathSegs
    .map((s) => s.replace(/\.(html|htm|php|aspx)$/i, ''))
    .filter(
      (s) =>
        s &&
        !/^\d+$/.test(s) &&
        !/^(vn\d*|en|vi|amp|feed|page|index|category|tag|author|news|post|posts|article|articles)$/i.test(
          s
        )
    );
  const lastSlugSeg =
    slugCandidates.sort((a, b) => b.length - a.length)[0] ||
    (pathSegs.length > 0 && !/^\d+$/.test(pathSegs[pathSegs.length - 1])
      ? pathSegs[pathSegs.length - 1].replace(/\.(html|htm|php)$/i, '')
      : '');

  const tryFetchWpRestPost = async (apiEndpoint: string) => {
    try {
      const wpRes = await fetch(
        apiEndpoint.includes('_embed')
          ? apiEndpoint
          : `${apiEndpoint}${apiEndpoint.includes('?') ? '&' : '?'}_embed`,
        { headers: { 'User-Agent': SCRAPER_USER_AGENT } }
      );
      if (!wpRes.ok) return;
      const data: any = await wpRes.json();
      if (Array.isArray(data) && data.length > 0) {
        parseWpPostObject(data[0]);
      } else if (data && data.id) {
        parseWpPostObject(data);
      }
    } catch {
      // Fallback sang quét HTML
    }
  };

  if (numericId) {
    await tryFetchWpRestPost(`${origin}/wp-json/wp/v2/posts/${numericId}?_embed`);
  } else if (lastSlugSeg) {
    await tryFetchWpRestPost(
      `${origin}/wp-json/wp/v2/posts?slug=${encodeURIComponent(lastSlugSeg)}&_embed`
    );
    // Nếu người dùng dán link bị rút gọn slug, tự động tìm bài viết khớp qua WP REST search
    if (images.length === 0 && paragraphs.length === 0) {
      const searchQ = lastSlugSeg.replace(/[-_]+/g, ' ').trim();
      if (searchQ.length >= 5) {
        await tryFetchWpRestPost(
          `${origin}/wp-json/wp/v2/posts?search=${encodeURIComponent(searchQ)}&per_page=1&_embed`
        );
        if (images.length === 0 && paragraphs.length === 0) {
          const shortQ = searchQ.split(/\s+/).slice(0, 5).join(' ');
          if (shortQ && shortQ !== searchQ) {
            await tryFetchWpRestPost(
              `${origin}/wp-json/wp/v2/posts?search=${encodeURIComponent(shortQ)}&per_page=1&_embed`
            );
          }
        }
      }
    }
  }

  // Nếu là bài viết WordPress và mới lấy được ít ảnh, kiểm tra thêm kho media đính kèm trực tiếp vào post ID đó (/wp-json/wp/v2/media?parent=ID)
  if (matchedWpPostId > 0 && images.length < 4) {
    try {
      const mediaRes = await fetch(
        `${origin}/wp-json/wp/v2/media?parent=${matchedWpPostId}&per_page=20`,
        { headers: { 'User-Agent': SCRAPER_USER_AGENT } }
      );
      if (mediaRes.ok) {
        const mediaItems: any = await mediaRes.json();
        if (Array.isArray(mediaItems)) {
          for (const mItem of mediaItems) {
            const mUrl =
              mItem?.media_details?.sizes?.full?.source_url ||
              mItem?.media_details?.sizes?.large?.source_url ||
              mItem?.source_url ||
              '';
            const mAlt = decodeHtmlEntities(mItem?.alt_text || mItem?.title?.rendered || originalTitle);
            if (mUrl) addImage(mUrl, mAlt, images.length === 0);
          }
        }
      }
    } catch {
      // ignore media parent error
    }
  }

  // 2. Quét trực tiếp HTML trang web khi chưa lấy đủ đoạn văn hoặc chưa lấy được ảnh trong bài
  if (paragraphs.length === 0 || images.length < 2 || !originalTitle) {
    try {
      const pageRes = await fetch(cleanUrl, {
        headers: {
          'User-Agent': SCRAPER_USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      if (pageRes.ok) {
        const html = await pageRes.text();

        const wpJsonLink = html.match(
          /<link[^>]+type=["']application\/json["'][^>]+href=["']([^"']+\/wp\/v2\/posts\/\d+)["']/i
        );
        if (wpJsonLink && wpJsonLink[1] && images.length === 0) {
          await tryFetchWpRestPost(resolveAbsUrl(wpJsonLink[1], cleanUrl));
        }

        if (images.length < 2 || !originalTitle || paragraphs.length === 0) {
          if (!originalTitle) {
            const h1Match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
            const ogTitle =
              html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
              html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ||
              html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i) ||
              html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            if (h1Match && stripHtmlTags(h1Match[1]).length > 10) {
              originalTitle = cleanScrapedTitle(h1Match[1]);
            } else if (ogTitle && ogTitle[1]) {
              originalTitle = cleanScrapedTitle(ogTitle[1]);
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

          const ogImg =
            html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
            html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
          if (ogImg && ogImg[1]) {
            addImage(ogImg[1], originalTitle, images.length === 0);
          }

          const cleanBody = html
            .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, '')
            .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, '')
            .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, '')
            .replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, '');

          // Tìm vùng nội dung bài viết chính xác (tránh cắt cụt ở thẻ </div> con đầu tiên)
          const articleBlocks = [...cleanBody.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)].map(
            (m) => m[1]
          );
          let primaryZone = '';
          if (articleBlocks.length > 0) {
            primaryZone = articleBlocks.sort((a, b) => b.length - a.length)[0];
          } else {
            const contentStartMatch = cleanBody.match(
              /<div\b[^>]+class=["'][^"']*\b(entry-content|post-content|article-content|td-post-content|single-content|the-content|article-body)\b[^"']*["'][^>]*>/i
            );
            if (contentStartMatch && contentStartMatch.index !== undefined) {
              const afterStart = cleanBody.slice(contentStartMatch.index);
              const stopMatch = afterStart.match(
                /<(div|section|aside|footer)\b[^>]+(id|class)=["'][^"']*\b(related-posts|yarpp|jp-relatedposts|comments-area|post-navigation|site-footer|sidebar)\b[^"']*["']/i
              );
              primaryZone = stopMatch && stopMatch.index ? afterStart.slice(0, stopMatch.index) : afterStart;
            } else {
              const mainMatch = cleanBody.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
              primaryZone = mainMatch ? mainMatch[1] : cleanBody;
            }
          }

          if (paragraphs.length === 0) {
            extractParagraphsFromHtml(primaryZone);
          }
          const bodyImgs = collectImgsFromHtml(primaryZone, cleanUrl);
          for (const img of bodyImgs) {
            addImage(img.url, img.alt || originalTitle, images.length === 0);
          }
        }
      }
    } catch {
      // Nếu trang chặn kết nối trực tiếp, dùng fallback từ slug
    }
  }

  // Nếu tiêu đề vẫn trống (ví dụ link bị cắt hoặc chặn), tự động khôi phục tiêu đề từ đường dẫn URL
  if (!originalTitle) {
    originalTitle = humanizeUrlSlugToTitle(parsedUrl.pathname) || 'Exclusive Celebrity Story';
  }

  return {
    sourceUrl: cleanUrl,
    siteName: parsedUrl.hostname.replace(/^www\./, ''),
    originalTitle,
    originalExcerpt,
    articleText: paragraphs.join('\n\n'),
    images: images.slice(0, 20),
  };
}

/**
 * Chuẩn hóa 1 đoạn văn để đạt độ dài chuẩn ~140-165 từ (tầm 150 từ / 1 đoạn)
 */
function normalizeParagraphToAround150Words(
  baseText: string,
  subject: string,
  title: string,
  language: 'en' | 'vi',
  sectionIdx: number
): string {
  const clean = stripHtmlTags(baseText).replace(/\s+/g, ' ').trim();
  const words = clean ? clean.split(' ') : [];

  const enElaborations = [
    `Throughout the unfolding moments surrounding ${subject}, long-time followers and entertainment observers have pointed out how naturally these details resonate with audiences worldwide. Every candid frame and subtle interaction adds another layer of authenticity to "${title}", demonstrating why genuine human connection continues to stand out in modern celebrity culture. Readers following the story have shared hundreds of thoughtful perspectives across social platforms, praising the relaxed confidence, timeless poise, and unmistakable warmth captured throughout the occasion.`,
    `Looking closer at the broader context of ${subject}, industry insiders note that moments like this rarely happen in isolation; instead, they reflect years of personal growth, evolving priorities, and a conscious desire to balance public expectations with private fulfillment. Whether Stepping away from high-pressure production schedules or simply enjoying unscripted time with loved ones, the narrative around "${title}" highlights a refreshing shift toward mindfulness and grounded living that fans deeply admire.`,
    `From a visual and storytelling standpoint, the atmosphere surrounding ${subject} offers a vivid contrast to the carefullychoreographed appearances typically seen at major red-carpet premieres and press tours. Observers quickly noticed the effortless styling, natural lighting, and relaxed body language that made the entire outing feel both cinematic and deeply relatable. It is precisely this blend of star power and everyday simplicity that keeps "${title}" trending across entertainment circles.`,
    `Furthermore, cultural commentators emphasize that public fascination with ${subject} stems from a genuine appreciation for resilience and authenticity in the spotlight. Over the years, audiences have grown increasingly drawn to stories that celebrate real companionship, quiet confidence, and meaningful milestones rather than fleeting headlines. As discussions around "${title}" continue to gain momentum, admirers everywhere are reminded of the enduring appeal of sincerity both on and off the screen.`,
  ];

  const viElaborations = [
    `Nhìn lại toàn bộ những khoảnh khắc xoay quanh ${subject}, đông đảo khán giả và giới quan sát giải trí đều nhận thấy sự chân thực, gần gũi hiếm có trong từng khung hình. Từng cử chỉ tự nhiên và thần thái rạng rỡ trong câu chuyện "${title}" đã tạo nên sức hút mạnh mẽ trên khắp các diễn đàn mạng xã hội, chứng minh rằng chính những giá trị cảm xúc đời thường mới là điều chạm đến trái tim người hâm mộ một cách bền vững nhất.`,
    `Đặt trong bối cảnh rộng hơn về hành trình của ${subject}, nhiều chuyên gia truyền thông đánh giá rằng những khoảnh khắc thư thái này phản ánh sự trưởng thành sâu sắc trong phong cách sống cũng như cách cân bằng giữa ánh hào quang và cuộc sống riêng tư. Thay vì những xuất hiện cầu kỳ trên thảm đỏ, câu chuyện "${title}" mang lại cảm giác bình yên, tinh tế và tràn đầy năng lượng tích cực cho người xem.`,
    `Xét dưới góc độ hình ảnh và sức lan tỏa truyền thông, từng chi tiết gắn liền với ${subject} đều toát lên vẻ đẹp tự nhiên, phóng khoáng nhưng vẫn giữ được dấu ấn riêng biệt. Ngay khi loạt hình ảnh và thông tin về "${title}" được đăng tải, hàng ngàn bình luận từ cộng đồng mạng đã bày tỏ sự ngưỡng mộ trước phong thái tự tin, giản dị và nguồn cảm hứng sống tích cực mà nhân vật mang lại.`,
    `Hơn thế nữa, sức hút bền bỉ của ${subject} trong lòng công chúng còn đến từ sự trân trọng những khoảnh khắc gắn kết chân thành bên những người thân yêu. Giữa nhịp sống sôi động của làng giải trí hiện đại, "${title}" giống như một lát cắt đầy cảm xúc, giúp khán giả hiểu thêm về những góc nhìn nhân văn, sâu lắng phía sau ống kính máy quay.`,
  ];

  const pool = language === 'vi' ? viElaborations : enElaborations;
  let combined = clean;
  let attempt = 0;

  while (combined.split(/\s+/).filter(Boolean).length < 138 && attempt < 4) {
    const addon = pool[(sectionIdx + attempt) % pool.length];
    combined = combined ? `${combined} ${addon}` : addon;
    attempt++;
  }

  const finalWords = combined.split(/\s+/).filter(Boolean);
  if (finalWords.length > 172) {
    // Cắt gọn tại dấu chấm câu gần mốc 150-165 từ nhất
    const sliced = finalWords.slice(0, 162).join(' ');
    const lastDot = Math.max(sliced.lastIndexOf('. '), sliced.lastIndexOf('! '), sliced.lastIndexOf('? '));
    if (lastDot > 550) {
      return sliced.slice(0, lastDot + 1).trim();
    }
    return `${sliced}.`;
  }

  return finalWords.join(' ');
}

/**
 * Xây dựng bài viết dài chuẩn SEO từ 2.000 - 5.000 từ, chia thành các đoạn ~150 từ/đoạn, có xuống dòng rõ ràng,
 * chèn toàn bộ ảnh trong bài gốc + ảnh bổ sung ngoài + 2 video YouTube cuối bài.
 */
function buildLongFormSeoArticle2000To5000Words(params: {
  articleTitle: string;
  focusKeyword: string;
  sourceArticleText: string;
  aiDraftHtml: string;
  images: ScrapedArticleImage[];
  youtubeVideos: RelatedYouTubeVideo[];
  language: 'en' | 'vi';
}): { html: string; wordCount: number; paragraphCount: number } {
  const {
    articleTitle,
    focusKeyword,
    sourceArticleText,
    aiDraftHtml,
    images,
    youtubeVideos,
    language,
  } = params;

  const isVi = language === 'vi';
  const subject = focusKeyword || articleTitle.split(/[:–—|-]/)[0].trim() || 'the star';

  // Thu thập toàn bộ các đoạn văn từ AI Draft + Bài gốc
  const rawParagraphs: string[] = [];
  if (aiDraftHtml) {
    const pMatches = aiDraftHtml.match(/<p\b[^>]*>([\s\S]*?)<\/p>/gi) || [];
    for (const pm of pMatches) {
      const t = stripHtmlTags(pm).replace(/\s+/g, ' ').trim();
      if (t.length > 30) rawParagraphs.push(t);
    }
  }
  if (sourceArticleText) {
    for (const line of sourceArticleText.split(/\n+/)) {
      const t = line.replace(/\s+/g, ' ').trim();
      if (t.length > 35 && !rawParagraphs.includes(t)) {
        rawParagraphs.push(t);
      }
    }
  }

  // Danh sách 9 chuyên mục H2 chuyên sâu để đảm bảo bài viết đạt chuẩn 2.200 - 3.800+ từ (mỗi mục 2 đoạn x ~150 từ = ~300 từ/mục)
  const sectionBlueprints = isVi
    ? [
        {
          h2: `1. Toàn cảnh câu chuyện: ${articleTitle}`,
          seeds: [
            `Câu chuyện xoay quanh "${articleTitle}" đang nhanh chóng trở thành một trong những chủ đề tâm điểm thu hút sự quan tâm lớn từ công chúng và người hâm mộ. Ngay từ những hình ảnh và thông tin đầu tiên xuất hiện, ${subject} đã gây ấn tượng mạnh mẽ bởi thần thái tự nhiên, cuốn hút cùng những khoảnh khắc đời thường đầy cảm xúc.`,
            `Không chỉ dừng lại ở một tin tức giải trí thông thường, những chi tiết xoay quanh ${subject} còn mở ra góc nhìn gần gũi và chân thực hơn về cuộc sống phía sau ánh đèn sân khấu. Sự kết hợp giữa phong thái tự tin và không gian thư giãn đã tạo nên một bức tranh sinh động khiến khán giả không ngừng bàn luận.`,
          ],
        },
        {
          h2: `2. Những khoảnh khắc đắt giá và chi tiết ấn tượng nhất`,
          seeds: [
            `Đi sâu vào từng khoảnh khắc được ghi lại, người xem dễ dàng nhận thấy sự thoải mái và năng lượng tích cực toả ra từ ${subject}. Từng cử chỉ nhỏ, ánh nhìn cho đến nụ cười rạng rỡ đều phản ánh một tâm thế bình yên, tận hưởng trọn vẹn từng giây phút bên cạnh những người thân thiết.`,
            `Nhiều người hâm mộ tinh ý nhận ra rằng chính sự giản dị, không phô trương trong cách xuất hiện của ${subject} lại tạo nên sức hút đặc biệt. Mỗi khung hình trong bài viết đều mang màu sắc tự nhiên, chân thật như một thước phim đời thường sống động.`,
          ],
        },
        {
          h2: `3. Phong cách, thần thái và dấu ấn cá nhân của ${subject}`,
          seeds: [
            `Bên cạnh câu chuyện chính, phong cách thời trang và thần thái của ${subject} trong dịp này cũng nhận được vô số lời khen ngợi từ các tạp chí đời sống và cộng đồng mạng. Sự lựa chọn trang phục tinh tế, hài hòa với bối cảnh giúp tôn lên vẻ đẹp khỏe khoắn, thanh lịch và đầy cuốn hút.`,
            `Qua nhiều năm hoạt động, ${subject} luôn biết cách làm mới hình ảnh của mình mà vẫn giữ trọn vẹn bản sắc cá nhân. Dù xuất hiện tại các sự kiện lớn hay trong những chuyến nghỉ dưỡng riêng tư, sức hút tự nhiên ấy vẫn luôn tỏa sáng rõ nét.`,
          ],
        },
        {
          h2: `4. Bối cảnh hậu trường và câu chuyện phía sau ống kính`,
          seeds: [
            `Ít ai biết rằng đằng sau những khoảnh khắc thư giãn được chia sẻ rộng rãi là cả một hành trình làm việc nghiêm túc và bền bỉ của ${subject}. Việc dành thời gian nghỉ ngơi, tái tạo năng lượng và tận hưởng không gian riêng tư đóng vai trò vô cùng quan trọng để duy trì sự cân bằng trong cuộc sống.`,
            `Những nguồn tin thân cận cho biết ${subject} luôn ưu tiên những khoảng lặng ý nghĩa bên gia đình, bạn bè và người đồng hành sau mỗi dự án dài hơi. Chính sự trân trọng những giá trị bình dị này đã giúp nhân vật giữ vững tinh thần lạc quan.`,
          ],
        },
        {
          h2: `5. Sự đồng hành, gắn kết và cảm xúc chân thành`,
          seeds: [
            `Một trong những điểm nhấn khiến khán giả đặc biệt yêu thích ở "${articleTitle}" chính là sự gắn kết ấm áp và tự nhiên giữa các nhân vật trong câu chuyện. Không cần những lời tuyên bố ồn ào, sự quan tâm tinh tế dành cho nhau qua từng hành động nhỏ đã nói lên tất cả.`,
            `Trong mắt công chúng, những khoảnh khắc sẻ chia giản dị như vậy luôn có sức lay động mạnh mẽ hơn bất kỳ kịch bản cầu kỳ nào. Đó cũng là lý do khiến câu chuyện về ${subject} nhanh chóng nhận được sự đồng cảm sâu sắc từ người đọc ở nhiều độ tuổi.`,
          ],
        },
        {
          h2: `6. Phản ứng bùng nổ từ người hâm mộ và cộng đồng mạng`,
          seeds: [
            `Ngay sau khi loạt hình ảnh và thông tin về "${articleTitle}" được lan truyền, hàng loạt diễn đàn giải trí và mạng xã hội đã ghi nhận lượng tương tác tăng vọt. Hàng ngàn bình luận bày tỏ sự yêu mến, chúc phúc cũng như ngưỡng mộ trước cuộc sống viên mãn, tự tại của ${subject}.`,
            `Nhiều khán giả lâu năm cũng chia sẻ lại những kỷ niệm và dấu ấn đáng nhớ trong sự nghiệp của ${subject}, tạo nên một làn sóng thảo luận sôi nổi và tích cực. Sự ủng hộ nồng nhiệt từ công chúng một lần nữa khẳng định vị trí vững chắc của nhân vật trong lòng người hâm mộ.`,
          ],
        },
        {
          h2: `7. Góc nhìn truyền thông và sức lan tỏa trong văn hóa đại chúng`,
          seeds: [
            `Dưới góc nhìn của các nhà phân tích truyền thông, sức hút từ câu chuyện "${articleTitle}" cho thấy xu hướng thưởng thức thông tin của độc giả hiện đại đang ngày càng hướng tới sự chân thực. Khán giả ngày nay yêu thích những hình ảnh đời thường, gần gũi và giàu cảm xúc thực tế của người nổi tiếng.`,
            `Sự xuất hiện của ${subject} trong bối cảnh tự nhiên không chỉ mang lại cảm giác dễ chịu cho người xem mà còn truyền tải thông điệp ý nghĩa về việc yêu thương bản thân, tận hưởng hiện tại và trân trọng từng khoảnh khắc quý giá của cuộc sống.`,
          ],
        },
        {
          h2: `8. Hành trình phát triển và những cột mốc đáng nhớ của ${subject}`,
          seeds: [
            `Nhìn lại chặng đường đã qua, ${subject} đã không ngừng nỗ lực để khẳng định tài năng và bản lĩnh qua từng giai đoạn. Mỗi cột mốc trong sự nghiệp cũng như trong cuộc sống cá nhân đều để lại dấu ấn sâu đậm nhờ sự nghiêm túc, cầu thị và niềm đam mê bền bỉ.`,
            `Chính nền tảng vững chắc đó đã giúp ${subject} luôn giữ được sự tự tin và phong độ ổn định trước mọi biến động. Người hâm mộ hoàn toàn có cơ sở để kỳ vọng vào những bước tiến mới đầy hứa hẹn của nhân vật trong thời gian tới.`,
          ],
        },
        {
          h2: `9. Tổng kết: Dư âm đẹp từ câu chuyện "${articleTitle}"`,
          seeds: [
            `Khép lại toàn bộ câu chuyện xoay quanh "${articleTitle}", điều đọng lại sâu sắc nhất trong lòng độc giả chính là nguồn năng lượng tích cực, sự bình yên và vẻ đẹp chân thực của ${subject}. Mỗi bức ảnh và từng chi tiết trong bài đều góp phần khắc họa một khoảnh khắc đáng nhớ.`,
            `Trong thời gian tới, chắc chắn những thông tin và hoạt động mới tiếp theo của ${subject} sẽ tiếp tục nhận được sự dõi theo nồng nhiệt từ khán giả. Hãy cùng xem thêm các hình ảnh minh họa chi tiết và 2 video liên quan đặc sắc ngay bên dưới để có góc nhìn trọn vẹn nhất.`,
          ],
        },
      ]
    : [
        {
          h2: `1. The Full Story Behind: ${articleTitle}`,
          seeds: [
            `The unfolding story surrounding "${articleTitle}" has quickly captured the imagination of entertainment readers and devoted fans alike. From the very first candid snapshots that surfaced online, ${subject} drew widespread admiration for projecting effortless warmth, genuine relaxation, and an unmistakable sense of joy that immediately stood out across social media feeds.`,
            `Beyond the initial headlines, a closer look at ${subject} during this memorable outing reveals why audiences remain so deeply connected to authentic, unscripted celebrity moments. Rather than a staged publicity appearance, every detail of the day reflected natural ease, companionship, and a refreshing break from the demands of the spotlight.`,
          ],
        },
        {
          h2: `2. Key Highlights and Unfiltered Candid Moments`,
          seeds: [
            `Examining the standout moments from "${articleTitle}", observers immediately noticed how relaxed and present ${subject} appeared throughout the entire experience. Every shared laugh, unhurried stroll, and sunlit backdrop contributed to an atmosphere of pure contentment that fans rarely get to witness in such vivid detail.`,
            `What makes these glimpses of ${subject} especially compelling is the complete absence of pretension. In an era dominated by heavily curated digital personas, seeing genuine spontaneity and real-life happiness unfold naturally creates an immediate emotional bond with readers everywhere.`,
          ],
        },
        {
          h2: `3. Effortless Style, Poise, and Visual Presence`,
          seeds: [
            `Style watchers and entertainment editors were equally quick to praise the effortless aesthetic displayed by ${subject} in "${articleTitle}". Combining comfort with timeless elegance, the look complemented the relaxed setting while showcasing the natural confidence and radiant energy that have long defined the star's public appeal.`,
            `Over the years, ${subject} has consistently demonstrated an innate ability to turn even the simplest off-duty outing into a masterclass in understated grace. Whether appearing on international red carpets or enjoying a quiet getaway, that signature poise remains unmistakable.`,
          ],
        },
        {
          h2: `4. Behind the Scenes: Balancing Fame and Personal Peace`,
          seeds: [
            `To truly appreciate the significance of "${articleTitle}", it helps to consider the demanding pace of ${subject}'s professional journey. Between rigorous production schedules, media commitments, and creative projects, carving out dedicated time to unwind and recharge away from cameras is essential for long-term well-being.`,
            `Those familiar with ${subject}'s approach to life and career often note a deliberate emphasis on protecting meaningful personal time. Stepping back to enjoy simple pleasures alongside trusted companions offers a vital sense of grounding that fuels both personal happiness and artistic longevity.`,
          ],
        },
        {
          h2: `5. Genuine Connection and Shared Companionship`,
          seeds: [
            `At the heart of "${articleTitle}" lies a warm portrait of companionship and mutual support. Throughout the outing, the natural chemistry and relaxed body language around ${subject} spoke volumes, illustrating how meaningful relationships thrive on quiet everyday moments rather than grand public gestures.`,
            `For fans following the story, seeing ${subject} surrounded by genuine warmth and affection proved especially heartwarming. It serves as a powerful reminder that behind global recognition and industry accolades, the most cherished chapters of life are built on trust, laughter, and shared presence.`,
          ],
        },
        {
          h2: `6. How Fans and Social Media Are Reacting Worldwide`,
          seeds: [
            `Within hours of "${articleTitle}" circulating online, fan communities and entertainment platforms lit up with thousands of supportive comments and reactions. Admirers from around the globe praised ${subject} for looking radiant, happy, and completely at ease, turning the story into one of the week's most uplifting trending topics.`,
            `Long-time supporters also took the opportunity to reflect on ${subject}'s enduring impact, sharing favorite memories and celebrating the positive energy evident in every photo. The overwhelmingly warm reception underscores the deep goodwill and respect the star has cultivated with audiences over time.`,
          ],
        },
        {
          h2: `7. Cultural Context and the Appeal of Authentic Stardom`,
          seeds: [
            `Media commentators observing the response to "${articleTitle}" point out a broader shift in how modern audiences engage with celebrity culture. Today's readers gravitate strongly toward stories that highlight real humanity, emotional honesty, and relatable lifestyle moments rather than manufactured drama.`,
            `By embracing a grounded, authentic way of living, ${subject} exemplifies the kind of modern stardom that resonates across generations. Every candid image from this chapter reinforces a message of balance, self-assurance, and appreciation for life's simple joys.`,
          ],
        },
        {
          h2: `8. Career Evolution and Lasting Legacy of ${subject}`,
          seeds: [
            `Looking at the bigger picture, "${articleTitle}" arrives during a fascinating chapter in the ongoing evolution of ${subject}. Through dedication, versatility, and an unwavering commitment to craft, the star has built a remarkable body of work that continues to inspire both peers and newcomers alike.`,
            `That hard-earned professional foundation allows ${subject} to navigate the entertainment world on their own terms, choosing projects and personal priorities with clarity and confidence. Fans eagerly anticipating what comes next can see that this sense of fulfillment sets the stage for even greater chapters ahead.`,
          ],
        },
        {
          h2: `9. Final Thoughts and Exclusive Video Highlights`,
          seeds: [
            `Ultimately, the enduring takeaway from "${articleTitle}" is a celebration of authenticity, joy, and well-deserved serenity for ${subject}. Every paragraph and photograph from this story captures a refreshing snapshot of life lived genuinely and wholeheartedly in the present moment.`,
            `As conversations around ${subject} continue to unfold, be sure to explore the complete gallery of original and supplemental photographs throughout this feature, along with the two related YouTube videos embedded below for deeper context and memorable highlights.`,
          ],
        },
      ];

  // Xây dựng danh sách 18 đoạn văn (~150 từ / đoạn => ~2,700 từ tổng cộng, nằm chuẩn trong khoảng 2000 - 5000 từ)
  const finalParagraphs150Words: { h2?: string; text: string }[] = [];
  let rawCursor = 0;

  sectionBlueprints.forEach((sec, secIdx) => {
    // Mỗi H2 có 2 đến 3 đoạn văn, mỗi đoạn ~150 từ
    const numParasInSection = secIdx < 5 ? 2 : 2;
    for (let pIdx = 0; pIdx < numParasInSection; pIdx++) {
      const rawCandidate =
        rawCursor < rawParagraphs.length
          ? `${rawParagraphs[rawCursor]} ${sec.seeds[pIdx % sec.seeds.length]}`
          : sec.seeds[pIdx % sec.seeds.length];
      if (rawCursor < rawParagraphs.length) rawCursor++;

      const normalized150 = normalizeParagraphToAround150Words(
        rawCandidate,
        subject,
        articleTitle,
        language,
        secIdx * 3 + pIdx
      );

      finalParagraphs150Words.push({
        h2: pIdx === 0 ? sec.h2 : undefined,
        text: normalized150,
      });
    }
  });

  // Nếu bài gốc vẫn còn đoạn văn chưa đưa vào, chuẩn hóa từng đoạn thành ~150 từ và nối tiếp (tối đa tới ~4.500 từ)
  while (rawCursor < rawParagraphs.length && finalParagraphs150Words.length < 28) {
    const extraRaw = rawParagraphs[rawCursor++];
    const normalized150 = normalizeParagraphToAround150Words(
      extraRaw,
      subject,
      articleTitle,
      language,
      finalParagraphs150Words.length
    );
    finalParagraphs150Words.push({ text: normalized150 });
  }

  // Bây giờ lắp ghép HTML: gắn ảnh #1 ngay phần mở đầu bài viết, sau đó chèn xen kẽ TOÀN BỘ ảnh trong bài + ảnh bổ sung ngoài xuyên suốt các đoạn ~150 từ
  const htmlBlocks: string[] = [];
  const totalParas = finalParagraphs150Words.length;
  let imgIdx = 0;

  const renderFigureBlock = (img: ScrapedArticleImage, displayNum: number) => {
    const altText = (img.alt || articleTitle).replace(/"/g, '&quot;');
    const sourceBadge = img.isExternal
      ? isVi
        ? `Ảnh bổ sung #${displayNum}`
        : `Supplemental Photo #${displayNum}`
      : isVi
      ? `Ảnh trong bài #${displayNum}`
      : `Article Photo #${displayNum}`;
    return `<figure class="wp-block-image size-large article-image-block" style="margin: 24px 0; text-align: center;">
  <img src="${img.url}" alt="${altText}" referrerpolicy="no-referrer" loading="lazy" style="width: 100%; max-width: 840px; height: auto; border-radius: 12px; margin: 0 auto; display: block;" />
  <figcaption style="font-size: 13px; color: #64748b; margin-top: 8px; font-style: italic;">${altText} (${sourceBadge})</figcaption>
</figure>`;
  };

  // Gắn ngay bức ảnh đầu tiên ở đầu bài viết (như chuẩn bài mẫu trên celeb24h.com)
  if (images.length > 0) {
    htmlBlocks.push(renderFigureBlock(images[imgIdx++], imgIdx));
  }

  const remainingImgs = Math.max(0, images.length - imgIdx);
  const imgStep =
    remainingImgs > 0 ? Math.max(1, Math.floor(totalParas / (remainingImgs + 1))) : 999;

  finalParagraphs150Words.forEach((item, idx) => {
    if (item.h2) {
      htmlBlocks.push(
        `<h2 style="margin: 30px 0 14px 0; font-weight: 800; line-height: 1.35;">${item.h2}</h2>`
      );
    }

    // Mỗi đoạn ~150 từ có margin-bottom 22px và xuống dòng rõ ràng
    htmlBlocks.push(
      `<p style="margin: 0 0 22px 0; line-height: 1.85; font-size: 17px;">${item.text}</p>\n<br />`
    );

    // Chèn ảnh minh họa sau mỗi cụm đoạn
    if (
      imgIdx < images.length &&
      ((idx + 1) % imgStep === 0 || idx >= totalParas - (images.length - imgIdx))
    ) {
      htmlBlocks.push(renderFigureBlock(images[imgIdx++], imgIdx));
    }
  });

  // Nếu còn ảnh nào chưa chèn hết (cả ảnh gốc lẫn ảnh bổ sung ngoài) thì chèn hết vào bài trước video YouTube
  while (imgIdx < images.length) {
    htmlBlocks.push(renderFigureBlock(images[imgIdx++], imgIdx));
  }

  // Cuối bài tự động gắn 2 Video YouTube liên quan
  if (youtubeVideos.length > 0) {
    const headingText = isVi
      ? '🎬 Video Liên Quan Đáng Chú Ý'
      : '🎬 Related Videos & Exclusive Moments';

    htmlBlocks.push(
      `<h2 style="margin: 32px 0 16px 0; font-weight: 800;">${headingText}</h2>`
    );

    youtubeVideos.forEach((v, idx) => {
      const safeTitle = v.title.replace(/"/g, '&quot;');
      htmlBlocks.push(
        `<div class="wp-youtube-embed-box" style="margin: 20px 0 28px 0;">
  <p style="margin-bottom: 10px;"><strong>Video #${idx + 1}: ${v.title}</strong></p>
  <figure class="wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio" style="margin: 12px 0;">
    <div class="wp-block-embed__wrapper" style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; background: #000;">
      <iframe src="https://www.youtube.com/embed/${v.videoId}" title="${safeTitle}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
    </div>
  </figure>
  <p style="font-size: 13px; color: #475569;">👉 <a href="${v.watchUrl}" target="_blank" rel="noopener noreferrer">${
          isVi ? 'Xem trực tiếp trên YouTube' : 'Watch on YouTube'
        }: ${v.title}</a></p>
</div>`
      );
    });
  }

  const finalHtml = htmlBlocks.join('\n\n');
  const plainWords = stripHtmlTags(finalHtml).split(/\s+/).filter(Boolean).length;

  return {
    html: finalHtml,
    wordCount: plainWords,
    paragraphCount: finalParagraphs150Words.length,
  };
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

  const candidateUrl =
    (params.sourceUrl && params.sourceUrl.trim()) ||
    (/^https?:\/\/\S+$/i.test(String(params.topic || '').trim())
      ? String(params.topic || '').trim()
      : '');

  // Nếu là Chức năng 1 (Nhập 1 link web bất kỳ hoặc dán link vào ô nội dung) -> Cào tiêu đề gốc + nội dung + toàn bộ ảnh trong bài đó
  if (params.mode === 'from_url' || candidateUrl) {
    const scraped = await scrapeWebArticleForSeoRewrite(candidateUrl || params.topic);
    scrapedImages = scraped.images;
    sourceTitle = scraped.originalTitle;
    sourceExcerpt = scraped.originalExcerpt;
    sourceArticleText = scraped.articleText;
    resolvedSourceUrl = scraped.sourceUrl;
  }

  const effectiveTopic =
    sourceTitle || params.topic.trim() || (params.existingContent || '').slice(0, 120);
  const kw = params.keyword?.trim() || effectiveTopic.split(/[:–—|-]/)[0].trim();

  // YÊU CẦU NGƯỜI DÙNG: Nếu nhập từ link web thì LẤY LUÔN TIÊU ĐỀ CỦA BÀI LINK NHẬP VÀO
  let generatedTitle = sourceTitle || '';
  let generatedSlug = '';
  let generatedExcerpt = sourceExcerpt || '';
  let generatedKeyword = kw;
  let generatedTags: string[] = [];
  let aiDraftHtml = '';
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
        ? `Bạn là biên tập viên SEO cao cấp cho chuyên trang giải trí celeb24h.com.
Nhiệm vụ: Hãy VIẾT LẠI (Rewrite chuẩn SEO chuyên sâu, cuốn hút, mở rộng phân tích chi tiết) từ bài viết gốc dưới đây.
Ngôn ngữ đầu ra bắt buộc: ${langLabel}.
Tiêu đề bài gốc (Giữ nguyên tiêu đề này): ${sourceTitle}
Mô tả bài gốc: ${sourceExcerpt}
Nội dung bài gốc:
${sourceArticleText.slice(0, 6500)}

Hãy trả về JSON thuần với cấu trúc:
{
  "title": "${sourceTitle.replace(/"/g, '\\"')}",
  "slug": "duong-dan-url-chuan-seo-khong-dau",
  "excerpt": "Đoạn mô tả Meta Description chuẩn SEO (140-165 ký tự)",
  "focusKeyword": "tên nhân vật chính hoặc từ khóa SEO chính (2-5 từ)",
  "youtubeSearchQuery": "tên nhân vật chính + sự kiện (3-6 từ) để tìm 2 video YouTube và ảnh ngoài liên quan nhất",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "contentHtml": "Nội dung bài viết mở rộng chuyên sâu định dạng thẻ <p>. Hãy viết từ 12-16 đoạn <p>, mỗi đoạn khoảng 150 từ, phân tích chi tiết bối cảnh, khoảnh khắc, phong cách và phản ứng của khán giả xung quanh bài gốc."
}`
        : `Bạn là biên tập viên SEO cao cấp cho chuyên trang giải trí celeb24h.com.
Nhiệm vụ: Dựa vào đoạn nội dung / chủ đề dưới đây, hãy phát triển và viết thành 1 bài báo dài chuẩn SEO chuyên sâu.
Ngôn ngữ đầu ra bắt buộc: ${langLabel}.
Đoạn nội dung / Yêu cầu đầu vào:
${params.topic}
${params.existingContent ? `\nNội dung bổ sung:\n${params.existingContent.slice(0, 4000)}` : ''}

Hãy trả về JSON thuần với cấu trúc:
{
  "title": "Tiêu đề bài viết chuẩn SEO, cuốn hút (55-75 ký tự)",
  "slug": "duong-dan-url-chuan-seo-khong-dau",
  "excerpt": "Đoạn mô tả Meta Description chuẩn SEO (140-165 ký tự)",
  "focusKeyword": "tên nhân vật chính hoặc từ khóa SEO chính (2-5 từ)",
  "youtubeSearchQuery": "tên nhân vật chính hoặc chủ đề (3-6 từ) để tìm 2 video YouTube và ảnh ngoài liên quan nhất",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "contentHtml": "Nội dung bài viết chi tiết định dạng thẻ <p>. Hãy viết từ 12-16 đoạn <p>, mỗi đoạn khoảng 150 từ."
}`;

      const response: any = await Promise.race([
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Gemini fast timeout')), 3200)
        ),
      ]);

      const parsed = JSON.parse(response.text || '{}');
      if (parsed) {
        generatedTitle = sourceTitle || String(parsed.title || effectiveTopic);
        generatedSlug = String(parsed.slug || '');
        generatedExcerpt = String(parsed.excerpt || sourceExcerpt || '');
        generatedKeyword = String(parsed.focusKeyword || kw);
        youtubeQuery = String(parsed.youtubeSearchQuery || generatedKeyword || effectiveTopic);
        generatedTags = Array.isArray(parsed.tags) ? parsed.tags.map(String) : [generatedKeyword];
        aiDraftHtml = String(parsed.contentHtml || '');
      }
    } catch (err) {
      console.warn('[wpPublishService] Using fast long-form SEO engine:', err);
    }
  }

  if (!generatedTitle) {
    generatedTitle =
      sourceTitle ||
      params.topic.split('\n')[0]?.trim().slice(0, 95) ||
      'Exclusive Celebrity Story & Highlights';
  }

  if (!generatedSlug) {
    generatedSlug = generatedTitle
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 80);
  }

  if (!generatedExcerpt) {
    generatedExcerpt =
      sourceExcerpt ||
      (sourceArticleText ? sourceArticleText.slice(0, 158) : `Read the full story on ${generatedTitle}.`);
  }

  if (generatedTags.length === 0) {
    generatedTags = [
      generatedKeyword || 'Celebrity',
      params.categoryName || 'Showbiz',
      'Entertainment',
      'Celeb24h',
    ];
  }

  const contextProfile = analyzeArticleSubjectAndContext(
    generatedTitle,
    sourceArticleText || params.topic,
    params.keyword,
    scrapedImages
  );
  if (contextProfile.primaryPerson) {
    generatedKeyword = contextProfile.primaryPerson;
  }

  const searchTopicQuery =
    contextProfile.combinedSearchQuery || youtubeQuery || generatedKeyword || generatedTitle;

  // YÊU CẦU NGƯỜI DÙNG:
  // Trước tiên lấy HẾT ảnh trong bài viết ở link bài (scrapedImages) và gắn vào bài.
  // Đếm số ảnh nội dung thực (không tính ảnh ghép collage thumbnail nếu có):
  // - Nếu đã đủ >= 5 ảnh thực trong bài: giữ nguyên toàn bộ ảnh trong bài, không lấy thêm ảnh ngoài.
  // - Nếu < 5 ảnh thực trong bài: lấy thêm ảnh ngoài tương tự (cùng diễn viên + trang phục + bối cảnh) để tổng ảnh đạt 5 đến 7 ảnh.
  const existingKeys = new Set(
    scrapedImages.map((img) =>
      img.url
        .split('?')[0]
        .replace(/_thumbnail(?=\.[a-z]+$)/i, '')
        .replace(/-\d+x\d+(?=\.[a-z]+$)/i, '')
        .toLowerCase()
    )
  );

  const realContentImgCount = scrapedImages.filter(
    (img) => !/\bcollage[-_\d]/i.test(img.url)
  ).length;

  const neededExternalCount =
    realContentImgCount >= 5 ? 0 : Math.max(2, 6 - realContentImgCount);

  const [externalImages, relatedVideos] = await Promise.all([
    neededExternalCount > 0
      ? searchExternalRelatedImages(
          searchTopicQuery,
          neededExternalCount,
          existingKeys,
          contextProfile
        )
      : Promise.resolve([]),
    searchRelatedYouTubeVideos(searchTopicQuery, 2, contextProfile),
  ]);

  const allCombinedImages: ScrapedArticleImage[] = [...scrapedImages, ...externalImages];

  // Xây dựng bài viết dài 2.000 - 5.000 từ xoay quanh đúng diễn viên & nhân vật trong bài (subjectDisplay)
  const longFormResult = buildLongFormSeoArticle2000To5000Words({
    articleTitle: generatedTitle,
    focusKeyword: contextProfile.subjectDisplay || generatedKeyword,
    sourceArticleText,
    aiDraftHtml,
    images: allCombinedImages,
    youtubeVideos: relatedVideos,
    language,
  });

  const primaryFeaturedImage = allCombinedImages[0]?.url || '';

  return {
    ok: true,
    mode: resolvedSourceUrl ? 'from_url' : 'from_text',
    sourceUrl: resolvedSourceUrl || undefined,
    title: generatedTitle,
    slug: generatedSlug,
    excerpt: generatedExcerpt,
    focusKeyword: generatedKeyword,
    searchQuery: searchTopicQuery,
    tags: generatedTags,
    contentHtml: longFormResult.html,
    wordCount: longFormResult.wordCount,
    paragraphCount: longFormResult.paragraphCount,
    featuredImageUrl: primaryFeaturedImage,
    extractedImages: allCombinedImages,
    originalImageCount: scrapedImages.length,
    externalImageCount: externalImages.length,
    youtubeVideos: relatedVideos,
  };
}


