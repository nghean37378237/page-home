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
  supportingEntities: string[];
  outfitKeywords: string[];
  locationKeywords: string[];
  timeframeKeywords: string[];
  eventKeywords: string[];
  eventWords: string[];
  articleCategory: 'screen_production' | 'celebrity_romance_vacation' | 'red_carpet_event' | 'retrospective_feature';
  subjectDisplay: string;
  combinedSearchQuery: string;
}

/**
 * Phân tích sâu NỘI DUNG BÊN TRONG BÀI VIẾT (không lấy tiêu đề câu view làm nội dung) + đối chiếu ảnh trong bài:
 * 1. Tên diễn viên / nhân vật chính thực sự trong bài (primaryPerson)
 * 2. Người đi cùng / bạn diễn / nhân vật thứ hai trong bài (secondaryPerson)
 * 3. Các nhân vật phụ, tác phẩm, bộ phim, tổ chức xuất hiện trong bài (supportingEntities)
 * 4. Trang phục / chi tiết hình ảnh cụ thể trong bài (outfitKeywords)
 * 5. Địa điểm & mốc thời gian cụ thể trong bài (locationKeywords, timeframeKeywords)
 * 6. Phân loại đúng chủ đề thực tế của nội dung bài viết (articleCategory)
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
  const sample = fullText.slice(0, 6000);

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
    'Considering', 'Regarding', 'Debuting', 'Watching', 'Adding', 'Dazzling', 'Posing',
    'Demonstrating', 'Discussing', 'Working', 'Seeing', 'Revealing', 'Unveiling',
    'Because', 'Although', 'Though', 'Since', 'Unless', 'Whether', 'Whenever', 'Whatever',
    'However', 'Moreover', 'Furthermore', 'Meanwhile', 'Instead', 'Otherwise', 'Therefore',
    'Thus', 'Hence', 'Yet', 'Still', 'Even', 'Only', 'Just', 'Also', 'Either', 'Neither',
    'Each', 'Every', 'Many', 'Most', 'Some', 'Several', 'Few', 'Other', 'Another', 'Such',
    'Same', 'Certain', 'Various', 'Different', 'Similar', 'Special', 'Specific', 'Additional',
    'Ultimately', 'asch', 'As', 'If', 'Or', 'And', 'But', 'Nor', 'So', 'Yet', 'Once',
    'Hollywood', 'Caribbean', 'Barbados', 'London', 'West', 'North', 'South', 'East',
    'Southern', 'Northern', 'Eastern', 'Western', 'Central', 'California', 'Florida',
    'United', 'States', 'America', 'British', 'English', 'American', 'Great', 'Britain',
    'French', 'Riviera', 'Mediterranean', 'German', 'Italian', 'Spanish', 'Mexican',
    'Saint', 'Tropez', 'Cannes', 'Paris', 'Rome', 'Malibu', 'Hawaii', 'Manhattan',
    'Dublin', 'Ireland', 'Nashville', 'Byron', 'Bay', 'Australia', 'Australian',
    'Monday', 'Tuesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December', 'Instagram', 'Twitter',
    'Facebook', 'YouTube', 'TikTok', 'Daily', 'Mail', 'Page', 'Six', 'People',
    'Notting', 'Hill', 'Los', 'Angeles', 'New', 'York', 'Miami', 'Beach', 'Sandy', 'Lane',
    'Golden', 'Globes', 'Academy', 'Award', 'Awards', 'Oscar', 'Oscars', 'Emmy', 'Grammy',
    'Anyone', 'You', 'Star', 'Legend', 'Beauty', 'Model', 'Actress', 'Supermodel',
    'Actor', 'Singer', 'Partner', 'Candid', 'Photo', 'Photos', 'Recognize', 'Them', 'Her', 'Him',
    'Bear', 'Blur', 'Gorillaz', 'Landman', 'City', 'Street', 'Streets', 'Turns', 'Heads',
    'Jimmy', 'Kimmel', 'Live', 'Coogies', 'Cafe', 'Big', 'Apple', 'Uncharted', 'Invasion',
    'Beatles', 'Ted', 'Lasso', 'Succession', 'Beverly', 'Hilton', 'Hills', 'Santa', 'Monica',
    'Stunning', 'Pregnant', 'Timeless', 'Beloved', 'Famous', 'Reality', 'Heartthrob', 'Icon',
    'Real', 'Housewives', 'Brat', 'Pack', 'Night', 'Heat', 'Glad', 'All', 'Over', 'Mark', 'Twain',
    'Morning', 'Show', 'France', 'Europe', 'European', 'Exclusive', 'Story', 'Highlights',
    'Season', 'Seasons', 'Episode', 'Episodes', 'Series', 'Chapter', 'Chapters', 'Part',
    'Netflix', 'Nevermore', 'Gothic', 'Visual', 'Style', 'Identity', 'History', 'Search',
    'Heart', 'Companion', 'Companions', 'Relationship', 'Sibling', 'Cast', 'Crew',
    'Production', 'Premiere', 'Release', 'Teaser', 'Trailer', 'Update', 'Updates',
    'Character', 'Characters', 'Mystery', 'Mysteries', 'Horror', 'Comedy', 'Drama',
    'Supernatural', 'Teen', 'World', 'Corridors', 'Classrooms', 'Costume', 'Wardrobe',
    'Appearance', 'Architecture', 'Atmosphere', 'Environment', 'Locations', 'Setting',
    'Settings', 'Islanders', 'Capital', 'Searchlight', 'University', 'College', 'Studio',
    'Studios', 'Network', 'Channel', 'Platform', 'Power', 'Couple', 'Rare', 'Beachside',
    'Escape', 'Relaxed', 'Day', 'Outing', 'Getaway', 'Vacation', 'Holiday', 'Chief',
    'Content', 'Officer', 'Executive', 'Producer', 'Producers', 'Director', 'Showrunners',
    'Writers', 'Creators', 'Eiffel', 'Tower', 'Famously', 'Contemporary', 'Archival',
    'Scroll', 'Stay', 'Read', 'Click', 'Share', 'Watch', 'See', 'Everything', 'Know', 'About'
  ]);

  // Nếu không phải bối cảnh phim Wednesday / Addams Family thì mới coi 'Wednesday' là thứ trong tuần
  const isWednesdayShowContext = /\b(Nevermore|Addams|Ortega|Enid|Morticia|Ophelia|Pugsley|Gomez)\b/i.test(
    `${sample} ${title}`
  );
  if (!isWednesdayShowContext) {
    stopWords.add('Wednesday');
  }

  const stats = new Map<
    string,
    { count: number; firstIdx: number; bioBoost: number; isCompanion: boolean }
  >();

  // Nhận diện các nhân vật đi kèm sau cụm "with her/his husband/wife/boyfriend/girlfriend/partner..."
  const companionRegex =
    /\b(?:with|alongside|beside)\s+(?:her|his|their)?\s*(?:new\s+|longtime\s+)?(?:husband|wife|partner|boyfriend|girlfriend|fiance|fiancée|companion|model|actress|actor|financier)?\s*(?:,\s*(?:\d{2}-year-old\s+)?(?:[a-z-]+\s+){0,3})?([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{1,15}\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15}(?:\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15})?)/g;
  const companionSet = new Set<string>();
  let cm: RegExpExecArray | null;
  while ((cm = companionRegex.exec(sample.slice(0, 1000))) !== null) {
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

  // 1. Ưu tiên nhận diện tên nhân vật đi kèm tuổi hoặc danh xưng nghề nghiệp/quan hệ trong NỘI DUNG BÀI
  const bioRegex =
    /(?:(\d{2}-year-old(?:\s+[a-zA-Z-]+){0,4})|(?:representative\s+for|breakout\s+star|actor|actress|singer|model|supermodel|star|frontman|mastermind|financier|surgeon|husband|wife|partner|boyfriend|girlfriend|mother|father|icon|legend|winner|daughter|son|director|showrunners?)(?:\s+[a-zA-Z-]+){0,2})\s*,?\s+(?:Dr\.\s+)?([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{1,15}\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15}(?:\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15})?)/g;
  let bm: RegExpExecArray | null;
  while ((bm = bioRegex.exec(sample)) !== null) {
    const rawName = bm[2].trim();
    const parts = rawName.split(/\s+/);
    const cleanParts = parts.filter((p) => !stopWords.has(p.replace(/['’]s$/i, '')));
    if (cleanParts.length < 2) continue;
    const candidate = cleanParts.slice(0, 3).join(' ');
    const isComp = companionSet.has(candidate);
    const prev = stats.get(candidate) || {
      count: 0,
      firstIdx: bm.index,
      bioBoost: 0,
      isCompanion: isComp,
    };
    prev.bioBoost += isComp ? 22 : 42;
    if (isComp) prev.isCompanion = true;
    stats.set(candidate, prev);
  }

  // 2. Quét toàn bộ tên riêng trong NỘI DUNG BÀI VIẾT (sample), tuyệt đối ưu tiên nội dung bài thay vì tiêu đề
  const regex =
    /\b([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{1,15}(?:\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15}){1,2})\b/g;
  let m: RegExpExecArray | null;
  const textToScan = sample || imgAltText || title || '';
  while ((m = regex.exec(textToScan)) !== null) {
    const rawName = m[1].replace(/['’]s$/i, '').trim();
    const parts = rawName.split(/\s+/);
    if (parts.some((p) => stopWords.has(p) || stopWords.has(p.replace(/['’]s$/i, '')))) continue;
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

  // Cộng thêm số lần nhắc họ/tên của nhân vật trong toàn bộ nội dung bài
  for (const [fullName, info] of stats.entries()) {
    const tokens = fullName.split(/\s+/);
    const lastName = tokens[tokens.length - 1];
    if (lastName && lastName.length >= 4) {
      const lastRegex = new RegExp(`\\b${lastName}\\b`, 'g');
      const totalLastMentions = (sample.match(lastRegex) || []).length;
      if (totalLastMentions > info.count) {
        info.bioBoost += Math.min(30, (totalLastMentions - info.count) * 6);
      }
    }
  }

  const rankedEntries = [...stats.entries()].sort((a, b) => {
    const leadBonusA = a[1].firstIdx < 280 ? 38 : a[1].firstIdx < 550 ? 22 : 0;
    const leadBonusB = b[1].firstIdx < 280 ? 38 : b[1].firstIdx < 550 ? 22 : 0;
    const compPenaltyA = a[1].isCompanion ? -20 : 0;
    const compPenaltyB = b[1].isCompanion ? -20 : 0;
    const scoreA = a[1].count * 12 + a[1].bioBoost + leadBonusA + compPenaltyA;
    const scoreB = b[1].count * 12 + b[1].bioBoost + leadBonusB + compPenaltyB;
    return scoreB - scoreA;
  });

  const rankedPeople = rankedEntries.map((e) => e[0]);

  // Nếu bài viết về series Wednesday mà không ghi tên đầy đủ 2 từ ở đầu, nhận diện chính xác nhân vật/diễn viên trong bài
  let fallbackShowSubject = '';
  if (isWednesdayShowContext && rankedPeople.length === 0) {
    if (/\bJenna\s+Ortega\b/i.test(sample)) fallbackShowSubject = 'Jenna Ortega';
    else if (/\bEnid\b/i.test(sample)) fallbackShowSubject = 'Wednesday Addams and Enid Sinclair';
    else if (/\bPugsley\b/i.test(sample)) fallbackShowSubject = 'Wednesday and Pugsley Addams';
    else if (/\bThing\b/i.test(sample)) fallbackShowSubject = 'Wednesday Addams and Thing';
    else fallbackShowSubject = 'Wednesday Addams';
  }

  const primaryPerson =
    rankedPeople[0] ||
    fallbackShowSubject ||
    (userKeyword && userKeyword.trim()) ||
    '';

  const secondaryEntry = rankedEntries.find(
    ([p, info]) =>
      p !== primaryPerson &&
      (info.firstIdx < 900 || info.count >= 2 || info.bioBoost > 0) &&
      !primaryPerson.toLowerCase().includes(p.toLowerCase()) &&
      !p.toLowerCase().includes(primaryPerson.toLowerCase())
  );
  const secondaryPerson = secondaryEntry ? secondaryEntry[0] : '';

  const supportingEntities = rankedEntries
    .map((e) => e[0])
    .filter((p) => p !== primaryPerson && p !== secondaryPerson)
    .slice(0, 8);

  // 3. Đối chiếu trang phục & đặc điểm hình ảnh từ NỘI DUNG BÀI VIẾT
  const visualSceneText = `${imgAltText} ${sample.slice(0, 1500)}`.toLowerCase();
  const outfitKeywords: string[] = [];
  const outfitRegex =
    /\b((?:all-white|snakeskin(?:-print)?|burgundy|white|black|red|blue|gold|shimmering\s+gold|glittering\s+gold|shimmer-drenched\s+gold|floral|striped|pink|green|yellow|navy|chic|skimpy|tiny|polka-dot|leopard(?:-print)?|animal-print|denim|leather|lace|sheer|sequin|silver|dark|gothic)\s+(?:bikini|swimsuit|bathing\s+suit|swim\s+shorts|swim\s+trunks|shorts|trunks|dress|gown|mini\s+dress|summer\s+dress|tank\s+top|t-shirt|tee|shirt|top|jacket|coat|suit|jeans|trousers|pants|skirt|outfit|ensemble|wardrobe))\b/gi;
  let om: RegExpExecArray | null;
  while ((om = outfitRegex.exec(visualSceneText)) !== null) {
    const phrase = om[1].replace(/\s+/g, ' ').trim();
    if (!outfitKeywords.includes(phrase) && outfitKeywords.length < 4) {
      outfitKeywords.push(phrase);
    }
  }

  // 4. Địa điểm & mốc thời gian trong NỘI DUNG BÀI VIẾT
  const contentLower = sample.toLowerCase();
  const locationGlossary = [
    'sandy lane', 'barbados', 'saint-tropez', 'french riviera', 'mediterranean',
    'south of france', 'notting hill', 'west hollywood', 'london', 'malibu',
    'new york city', 'new york', 'manhattan', 'nashville', 'miami', 'bahamas',
    'cabo', 'caribbean', 'cannes', 'paris', 'eiffel tower', 'dublin', 'ireland',
    'venice', 'italy', 'beverly hills', 'los angeles', 'byron bay', 'nevermore academy'
  ];
  const locationKeywords: string[] = [];
  for (const loc of locationGlossary) {
    if (contentLower.includes(loc) && locationKeywords.length < 5) {
      locationKeywords.push(loc);
    }
  }

  const timeframeKeywords: string[] = [];
  const timeRegex =
    /\b((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+[A-Z][a-z]+\s+\d{1,2},\s+\d{4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|Season\s+\d+|19\d\d|20\d\d)\b/g;
  let tm: RegExpExecArray | null;
  while ((tm = timeRegex.exec(sample)) !== null) {
    const tf = tm[1].trim();
    if (!timeframeKeywords.includes(tf) && timeframeKeywords.length < 5) {
      timeframeKeywords.push(tf);
    }
  }

  const eventGlossary = [
    'bikini', 'swimsuit', 'bathing suit', 'yacht', 'beach', 'boat', 'pregnant',
    'pregnancy', 'baby bump', 'stroll', 'lunch', 'brunch', 'kiss', 'kisses',
    'motorcycle', 'red carpet', 'vacation', 'getaway', 'holiday', 'filming',
    'season 3', 'cast', 'premiere', 'talk show', 'interview'
  ];
  const eventKeywords: string[] = [];
  for (const ev of eventGlossary) {
    if (
      contentLower.includes(ev) &&
      eventKeywords.length < 4 &&
      !outfitKeywords.some((o) => o.includes(ev))
    ) {
      eventKeywords.push(ev);
    }
  }

  // 5. Phân loại chính xác thể loại nội dung bên trong bài viết
  let articleCategory: ArticleContextProfile['articleCategory'] = 'celebrity_romance_vacation';
  if (
    /\b(season\s+\d|filming|showrunners?|casting|cast\b|nevermore|addams\s+family|netflix|premiere\s+date|executive\s+produce|series|episodes?)\b/i.test(
      sample
    )
  ) {
    articleCategory = 'screen_production';
  } else if (
    /\b(died\s+in|years\s+later|fun\s+facts|premiered\s+.*19\d\d|archival|final\s+year\s+of\s+his\s+life)\b/i.test(
      sample
    )
  ) {
    articleCategory = 'retrospective_feature';
  } else if (
    /\b(jimmy\s+kimmel|talk\s+show|late-night|studio\s+in\s+los\s+angeles|red\s+carpet|emmy-winning|wardrobe|stylist)\b/i.test(
      sample
    ) &&
    !/\b(yacht|beach|bikini|bathing\s+suit)\b/i.test(sample)
  ) {
    articleCategory = 'red_carpet_event';
  }

  const eventWords = [...outfitKeywords, ...locationKeywords.slice(0, 2), ...eventKeywords].slice(0, 6);

  const subjectDisplay = secondaryPerson
    ? `${primaryPerson} and ${secondaryPerson}`
    : primaryPerson || 'the cast and creators';

  const combinedSearchQuery = [
    primaryPerson || (isWednesdayShowContext ? 'Wednesday Addams Jenna Ortega' : ''),
    secondaryPerson,
    outfitKeywords[0] || '',
    locationKeywords[0] || '',
    eventKeywords[0] || '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    primaryPerson: primaryPerson || (isWednesdayShowContext ? 'Wednesday Addams' : ''),
    secondaryPerson,
    supportingEntities,
    outfitKeywords,
    locationKeywords,
    timeframeKeywords,
    eventKeywords,
    eventWords,
    articleCategory,
    subjectDisplay,
    combinedSearchQuery: combinedSearchQuery || primaryPerson || 'Celebrity News',
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
    contextProfile || analyzeArticleSubjectAndContext('', cleanQuery);

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

          const hasFullPrimary =
            Boolean(primaryPerson) && hay.includes(primaryPerson.toLowerCase());
          const hasAllPTokens = pTokens.length > 0 && pTokens.every((tk) => hay.includes(tk));
          if (!hasFullPrimary && !hasAllPTokens) continue;

          let score = hasFullPrimary ? 60 : 45;

          if (secondaryPerson && hay.includes(secondaryPerson.toLowerCase())) score += 50;
          else if (sTokens.length > 0 && sTokens.every((tk) => hay.includes(tk))) score += 35;

          for (const ot of outfitTokens) {
            if (hay.includes(ot)) score += 22;
          }
          for (const lt of locTokens) {
            if (hay.includes(lt)) score += 25;
          }
          for (const et of evTokens) {
            if (hay.includes(et)) score += 15;
          }
          if (
            /dailymail\.|justjared\.|hawtcelebs\.|celebmafia\.|pagesix\.|usmagazine\.|people\.com|thesun\.|mirror\.co\.uk|backgrid|netflix\.|tvinsider\./i.test(
              hay
            )
          ) {
            score += 30;
          }

          seen.add(normKey);
          if (obj.md5) seenMd5.add(String(obj.md5));

          scoredCandidates.push({
            url: imgUrl,
            alt: titleText || `${primaryPerson} ${eventWords.join(' ')}`.trim(),
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
  const stripped = decoded
    .replace(/\s+[|–—-]\s+[^|–—-]{2,35}\.(com|net|org|fun|vn|info|us|co\.uk)$/i, '')
    .trim();
  if (stripped && stripped === stripped.toLowerCase()) {
    return stripped.replace(/(^|\s)([a-z])/g, (_m, p1, p2) => `${p1}${p2.toUpperCase()}`);
  }
  return stripped;
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

  const isBoilerplateCallToAction = (txt: string): boolean => {
    const lower = txt.toLowerCase();
    if (
      lower.includes('in the comments below') ||
      lower.includes('in the comments section') ||
      lower.includes('let’s swap favorite') ||
      lower.includes("let's swap favorite") ||
      lower.includes('scroll down for a closer look') ||
      lower.includes('see the full casting announcement in the fun teaser video below') ||
      lower.includes('what is your absolute favorite') ||
      lower.startsWith('what is the most memorable part of')
    ) {
      return true;
    }
    return false;
  };

  const extractParagraphsFromHtml = (htmlChunk: string) => {
    const pRegex = /<(p|h2|h3|blockquote|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let m: RegExpExecArray | null;
    while ((m = pRegex.exec(htmlChunk)) !== null) {
      const tag = m[1].toLowerCase();
      let txt = stripHtmlTags(m[2]).replace(/\s+/g, ' ').trim();
      if (!txt || txt.length < 18) continue;
      if (isBoilerplateCallToAction(txt)) continue;
      // Nếu trong đoạn có câu hỏi kêu gọi bình luận ở cuối ("What is your absolute favorite... Let's swap..."), cắt bỏ phần đuôi đó
      txt = txt
        .replace(/\s*What is your absolute favorite[\s\S]*$/i, '')
        .replace(/\s*Let['’]s swap favorite[\s\S]*$/i, '')
        .replace(/\s*Scroll down for a closer look[\s\S]*$/i, '')
        .trim();
      if (txt.length < 18) continue;
      const formatted = tag === 'h2' || tag === 'h3' ? `## ${txt}` : txt;
      if (!paragraphs.includes(formatted)) {
        paragraphs.push(formatted);
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

  const pathSegs = parsedUrl.pathname.split('/').filter(Boolean);
  const numericId =
    pathSegs.length > 0 && /^\d+$/.test(pathSegs[0])
      ? Number(pathSegs[0])
      : parsedUrl.searchParams.get('p') && /^\d+$/.test(parsedUrl.searchParams.get('p')!)
      ? Number(parsedUrl.searchParams.get('p'))
      : null;

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
      // Fallback
    }
  }

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
 * Tách văn bản thành các câu hoàn chỉnh (bảo toàn viết tắt Dr., Mr., Ms., U.S., St.)
 */
function splitIntoSentences(text: string): string[] {
  const cleaned = stripHtmlTags(text).replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const protectedText = cleaned
    .replace(/\b(Dr|Mr|Ms|Mrs|St|Jr|Sr|vs|Prof|Inc|Ltd)\.\s+/g, '$1__DOT__ ')
    .replace(/\bU\.S\./g, 'U__DOT__S__DOT__');
  const rawParts = protectedText.split(/(?<=[.!?])\s+(?=[A-Z“"‘'])/);
  return rawParts
    .map((s) => s.replace(/__DOT__/g, '.').trim())
    .filter((s) => s.length >= 20);
}

/**
 * Mở rộng 1 ý/đoạn thực tế trong bài viết gốc thành đoạn văn chuẩn ~150 từ (140-168 từ).
 * TUYỆT ĐỐI KHÔNG dùng tiêu đề chính (articleTitle) để viết hay chèn vào đoạn văn.
 * Mọi câu mở rộng đều bám sát vào nhân vật, địa điểm, sự kiện, tác phẩm và chi tiết trong chính đoạn nội dung đó.
 */
function expandFactBlockToAround150Words(params: {
  baseFactText: string;
  contextProfile: ArticleContextProfile;
  allFactsPool: string[];
  language: 'en' | 'vi';
  paragraphIndex: number;
}): string {
  const { baseFactText, contextProfile, allFactsPool, language, paragraphIndex } = params;
  const cleanBase = stripHtmlTags(baseFactText).replace(/^##\s*/, '').replace(/\s+/g, ' ').trim();

  const primary = contextProfile.primaryPerson || contextProfile.subjectDisplay || 'the star';
  const secondary = contextProfile.secondaryPerson || '';
  const coupleOrSubject = secondary ? `${primary} and ${secondary}` : primary;
  const supList = contextProfile.supportingEntities;
  const supporting = supList.length > 0 ? supList.slice(0, 3).join(', ') : '';
  const specificSup = supList.length > 0 ? supList[paragraphIndex % supList.length] : '';
  const loc =
    contextProfile.locationKeywords.length > 0
      ? contextProfile.locationKeywords
          .slice(0, 2)
          .map((l) => l.replace(/\b\w/g, (c) => c.toUpperCase()))
          .join(' and ')
      : '';
  const outfit =
    contextProfile.outfitKeywords.length > 0
      ? contextProfile.outfitKeywords[paragraphIndex % contextProfile.outfitKeywords.length]
      : '';
  const timeframe =
    contextProfile.timeframeKeywords.length > 0
      ? contextProfile.timeframeKeywords[paragraphIndex % contextProfile.timeframeKeywords.length]
      : '';
  const category = contextProfile.articleCategory;

  // Trích xuất thực thể hoặc cụm từ nổi bật ngay trong chính đoạn văn gốc (cleanBase) để câu mở rộng neo sát 100% vào đoạn đang viết
  const localNames = (
    cleanBase.match(/\b[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15}(?:\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15})+\b/g) || []
  ).filter((n) => !/^(Considering Season|From Nevermore|Beyond Nevermore|While Wednesday|Because Thing|As Season)$/i.test(n));
  const localFocusEntity = localNames[0] || specificSup || primary;

  // Chọn câu dữ kiện bổ trợ từ bài gốc (nếu đoạn gốc ngắn < 35 từ) mà chưa nằm trong cleanBase
  const baseWordsCount = cleanBase.split(/\s+/).filter(Boolean).length;
  let combined = cleanBase;
  if (baseWordsCount < 35 && allFactsPool.length > 1) {
    const companionFact = allFactsPool[(paragraphIndex * 3 + 1) % allFactsPool.length];
    if (companionFact && !combined.includes(companionFact.slice(0, 25))) {
      combined = `${combined} ${companionFact}`;
    }
  }

  let contextualElaborations: string[] = [];

  if (language === 'vi') {
    if (category === 'screen_production') {
      contextualElaborations = [
        `Đi sâu vào chi tiết nội dung này, khán giả có thể thấy rõ tâm huyết của đội ngũ sản xuất cũng như diễn xuất ấn tượng của ${coupleOrSubject}${supporting ? ` cùng sự góp mặt của ${supporting}` : ''}. Việc đầu tư kỹ lưỡng từ bối cảnh quay${loc ? ` tại ${loc}` : ''} cho đến chiều sâu tâm lý nhân vật giúp mạch truyện trở nên cuốn hút, chặt chẽ và giàu kịch tính hơn qua từng phân cảnh.`,
        `Bên cạnh những thông tin cốt lõi vừa được hé lộ${timeframe ? ` xoay quanh cột mốc ${timeframe}` : ''}, giới phê bình đánh giá rất cao cách xây dựng thế giới nhân vật quanh ${localFocusEntity}. Sự kết hợp ăn ý giữa các gương mặt quen thuộc và những nhân tố mới mang lại làn gió tươi mới, mở ra nhiều nút thắt bất ngờ khiến người xem không ngừng mong đợi.`,
        `Nhìn từ góc độ nghệ thuật và quy mô thực hiện, từng chi tiết về tạo hình, bối cảnh${loc ? ` ở ${loc}` : ''} lẫn đường dây kịch bản đều phản ánh bước tiến lớn của dự án gắn liền với ${coupleOrSubject}. Những hé lộ thực tế từ hậu trường cho thấy toàn bộ ê-kíp đã làm việc tỉ mỉ để giữ trọn bản sắc độc đáo vốn đã làm nên sức hút vang dội của tác phẩm.`,
        `Hơn thế nữa, sự phối hợp giữa ${coupleOrSubject}${supporting ? ` và các cộng sự như ${supporting}` : ''} tiếp tục khẳng định sức hút bền bỉ của thương hiệu trong lòng khán giả toàn cầu. Mỗi tình tiết được phát triển trong nội dung bài viết đều góp phần làm sáng tỏ bức tranh toàn cảnh về hành trình tiếp theo của các nhân vật chính.`,
        `Đặc biệt, cách triển khai mạch truyện xoay quanh ${localFocusEntity} cho thấy sự cân bằng khéo léo giữa yếu tố bí ẩn đặc trưng và chiều sâu cảm xúc. Người hâm mộ theo dõi sát sao từng bước phát triển của dự án đều nhận định rằng những thay đổi này sẽ tạo nên điểm nhấn bùng nổ khi tác phẩm chính thức ra mắt.`,
        `Không dừng lại ở đó, việc mở rộng không gian câu chuyện${loc ? ` sang ${loc}` : ''} cùng những thử thách mới dành cho ${primary} giúp tác phẩm duy trì được nhịp độ lôi cuốn từ đầu đến cuối. Từng chi tiết nhỏ trong kịch bản đều được cài cắm có chủ đích, hứa hẹn mang đến trải nghiệm điện ảnh mãn nhãn.`,
      ];
    } else {
      contextualElaborations = [
        `Phân tích sâu hơn từ những chi tiết thực tế trong bài viết, có thể thấy ${coupleOrSubject} đang tận hưởng trọn vẹn từng khoảnh khắc đáng nhớ${loc ? ` tại ${loc}` : ''}${timeframe ? ` vào dịp ${timeframe}` : ''}. Từ phong thái tự nhiên${outfit ? ` trong trang phục ${outfit}` : ''} cho đến sự gắn kết ăn ý, mọi khung hình đều khắc họa rõ nét cuộc sống đời thường ấm áp và chân thực của nhân vật.`,
        `Đặt trong mạch câu chuyện xuyên suốt bài viết, mối quan hệ và nhịp sống của ${coupleOrSubject}${supporting ? ` cũng như sự gắn bó với ${supporting}` : ''} cho thấy sự cân bằng tinh tế giữa sự nghiệp bận rộn và không gian riêng tư. Những khoảnh khắc sẻ chia bình dị${loc ? ` nơi ${loc}` : ''} chính là chất keo gắn kết giúp câu chuyện nhận được sự đồng cảm lớn từ công chúng.`,
        `Không chỉ gây ấn tượng bởi vẻ ngoài rạng rỡ${outfit ? ` cùng lựa chọn ${outfit}` : ''}, hành trình của ${primary}${secondary ? ` bên cạnh ${secondary}` : ''} còn phản ánh một giai đoạn trưởng thành, viên mãn và tràn đầy năng lượng tích cực. Từng chi tiết cụ thể được ghi nhận trong bài đều làm nổi bật tính cách gần gũi, chân thành phía sau ánh hào quang.`,
        `Nhìn lại toàn bộ các dữ kiện xoay quanh ${coupleOrSubject}${timeframe ? ` từ ${timeframe}` : ''}, người hâm mộ càng thêm ngưỡng mộ cách nhân vật trân trọng những giá trị gia đình và cảm xúc thật. Sự hòa quyện giữa công việc, cuộc sống cá nhân và những chuyến đi ý nghĩa${loc ? ` tại ${loc}` : ''} đã tạo nên một dấu ấn đẹp đẽ và đầy sức sống.`,
        `Qua góc nhìn của những người theo dõi lâu năm, những hình ảnh và chi tiết gắn liền với ${localFocusEntity} minh chứng cho sức hút tự nhiên không cần phô trương. Chính sự giản dị, tinh tế trong từng cử chỉ đời thường lại tạo nên sức lan tỏa mạnh mẽ hơn bất kỳ sự kiện hào nhoáng nào.`,
        `Thêm vào đó, cách ${coupleOrSubject} gìn giữ sự riêng tư nhưng vẫn thoải mái tận hưởng niềm vui bên những người thân yêu${supporting ? ` như ${supporting}` : ''} mang đến nguồn cảm hứng tích cực. Mỗi dấu mốc được đề cập trong bài đều góp phần hoàn thiện bức chân dung sống động và chân thực.`,
      ];
    }
  } else {
    if (category === 'screen_production') {
      contextualElaborations = [
        `Expanding on these specific production details, viewers can appreciate how thoughtfully the creative team and ${coupleOrSubject}${supporting ? `, alongside ${supporting},` : ''} are shaping the next chapter of the story. From the atmospheric filming locations${loc ? ` across ${loc}` : ''} to the intricate character dynamics, every element has been crafted to deepen the central mystery while honoring the distinctive tone that audiences love.`,
        `Looking closer at the developments unfolding around ${localFocusEntity}${timeframe ? ` heading into ${timeframe}` : ''}, longtime fans and television critics alike have noted how seamlessly the new casting additions and narrative arcs build upon earlier foundations. By weaving together family lore, sharp wit, and high-stakes suspense${supporting ? ` involving figures like ${supporting}` : ''}, the series continues to expand its creative scope in compelling ways.`,
        `From a storytelling and visual design perspective, the choices surrounding ${coupleOrSubject}${loc ? ` and settings such as ${loc}` : ''} play a vital role in establishing mood and pacing before a single line of dialogue is spoken. Every wardrobe detail, architectural backdrop, and behind-the-scenes decision works in harmony to make the onscreen world feel both immersive and unmistakably distinctive.`,
        `Furthermore, the collaborative synergy between ${coupleOrSubject}${supporting ? ` and creative forces including ${supporting}` : ''} underscores why anticipation remains so high among global viewers. Each concrete update from the production reinforces a commitment to bold character evolution, ensuring that the upcoming episodes deliver both emotional resonance and unforgettable twists.`,
        `Delving deeper into the narrative implications for ${localFocusEntity}, industry observers point out that balancing established canon with fresh dramatic tension requires exceptional precision. As the storyline ventures into uncharted territory${loc ? ` around ${loc}` : ''}, the interplay between veteran performers and newcomers promises to elevate the stakes significantly.`,
        `At the same time, the visual and thematic continuity anchored by ${primary}${secondary ? ` and ${secondary}` : ''} ensures that the heart of the series remains intact even as its world grows darker and more complex. Fans analyzing each detail from the set recognize how deliberately these clues set the stage for a landmark television event.`,
        `Equally important is how the production schedule${timeframe ? ` around ${timeframe}` : ''} reflects the ambitious scale of the project. With intricate set pieces, gothic aesthetics, and tightly guarded plot turns involving ${specificSup || primary}, the creative team is leaving no stone unturned in delivering a worthy continuation.`,
        `In addition, the emphasis on character-driven mystery allows ${localFocusEntity} to explore new emotional dimensions while preserving the razor-sharp humor that defined earlier chapters. Every scene and casting choice highlighted in the coverage points toward a richer, more expansive television experience.`,
        `Considering the global reception of ${primary}'s performance, it comes as no surprise that every behind-the-scenes update${loc ? ` from ${loc}` : ''} sparks widespread analysis across entertainment circles. The careful integration of lore, atmosphere, and ensemble chemistry remains the cornerstone of the show's enduring appeal.`,
        `Moreover, by spotlighting ${specificSup || coupleOrSubject} within this evolving arc, the writers open the door to deeper secrets and long-awaited confrontations. Viewers who have followed the clues from the beginning can see how organically these new elements fit into the overarching mythology.`,
      ];
    } else if (category === 'red_carpet_event') {
      contextualElaborations = [
        `Unpacking the details of this memorable appearance, observers can clearly see how ${coupleOrSubject} brought an unmistakable blend of warmth, confidence, and grace to the occasion${loc ? ` in ${loc}` : ''}. Whether dazzling in ${outfit || 'striking couture'} or sharing genuine, supportive moments behind the scenes, every aspect of the outing reflected a deeply grounded sense of self-assurance.`,
        `Looking deeper into the personal and professional milestones surrounding ${localFocusEntity}${supporting ? `, as well as projects and loved ones like ${supporting},` : ''} reveals how intentional choices have shaped this fulfilling chapter. Balancing high-profile television and film commitments with meaningful personal priorities has allowed ${primary} to shine with authentic poise.`,
        `From a fashion and cultural standpoint, ${primary}'s hands-on approach to styling${outfit ? `—highlighted by the ${outfit}—` : ' '}resonates strongly with audiences who value body confidence and individuality. Rather than following rigid industry formulas, every public moment and candid interaction${loc ? ` in ${loc}` : ''} celebrates real strength, mutual respect, and creative empowerment.`,
        `Moreover, the natural chemistry and quiet support between ${coupleOrSubject} illustrate how meaningful companionship thrives alongside a demanding entertainment career. Each detail shared from the appearance offers fans an inspiring glimpse into a life built on patience, artistic passion, and genuine happiness.`,
        `Reflecting on the broader journey of ${localFocusEntity}${timeframe ? ` around ${timeframe}` : ''}, commentators have praised the refreshing honesty and elegance on display throughout the event. By embracing every milestone with confidence and gratitude, ${primary} continues to set a powerful example both on and off the red carpet.`,
        `Beyond the flashbulbs and formal poses${loc ? ` at ${loc}` : ''}, it is the candid warmth between ${coupleOrSubject}${specificSup ? ` and ${specificSup}` : ''} that leaves the strongest impression. Moments like these remind audiences that authentic connection and self-expression remain the most timeless style statements of all.`,
        `Furthermore, the career momentum surrounding ${primary}${supporting ? ` across projects involving ${supporting}` : ''} adds even greater significance to this public celebration. Seeing artistic accomplishment paired with personal fulfillment underscores why admirers remain so supportive of every new endeavor.`,
        `As conversations around the event continue, fashion editors and fans alike point to ${localFocusEntity}'s presence as a standout highlight of the season. Every thoughtful detail—from wardrobe craftsmanship to heartfelt remarks—reflects a star completely at ease in the spotlight.`,
      ];
    } else if (category === 'retrospective_feature') {
      contextualElaborations = [
        `Examining the historical context and specific details surrounding ${coupleOrSubject}${loc ? ` in ${loc}` : ''}${timeframe ? ` during ${timeframe}` : ''} offers readers a much richer understanding of the moment captured on camera. Rather than viewing these snapshots in isolation, looking at the real timeline, personal relationships${supporting ? `, and key figures such as ${supporting}` : ''} preserves the true meaning behind the archive.`,
        `When revisiting the documented facts around ${localFocusEntity}, cultural historians and devoted followers emphasize how important accurate context remains in entertainment journalism. Every detail—from ${outfit || 'the candid styling'} to the setting${loc ? ` of ${loc}` : ''}—serves as a tangible link to an unforgettable chapter in pop culture history.`,
        `Stepping back to appreciate the broader legacy of ${coupleOrSubject}${timeframe ? ` across ${timeframe}` : ''}, it becomes clear why audiences continue to revisit these enduring stories and photographs. The combination of creative brilliance, candid human vulnerability, and timeless charisma ensures that their impact remains deeply felt years later.`,
        `Ultimately, preserving the genuine narrative around ${primary}${supporting ? ` alongside ${supporting}` : ''} allows both longtime admirers and new generations to connect with the real history behind the images. Each verified detail adds depth, respect, and emotional clarity to a remarkable life and career.`,
        `Looking closer at how ${localFocusEntity} navigated both public adulation and private bonds${loc ? ` in ${loc}` : ''} reveals a portrait of rare authenticity. Unlike staged publicity shoots, these documented moments capture the unvarnished grace and emotional truth that defined an era.`,
        `In addition, the enduring interest in ${coupleOrSubject}${specificSup ? ` and their connection with ${specificSup}` : ''} speaks to the lasting power of genuine artistry and human connection. By separating myth from documented reality, readers gain a far more meaningful appreciation for their story.`,
        `Across the decades${timeframe ? ` since ${timeframe}` : ''}, the influence of ${primary} has only grown stronger as biographers and fans uncover the full context behind these iconic chapters. Every preserved photograph and firsthand account enriches our collective memory of a truly singular figure.`,
        `Taken in full perspective, the story of ${localFocusEntity} reminds us that behind every legendary career lies a tapestry of quiet friendships, personal resilience, and unscripted moments that deserve to be remembered with care and accuracy.`,
      ];
    } else {
      contextualElaborations = [
        `Looking closely at the specific details of this getaway${loc ? ` in ${loc}` : ''}${timeframe ? ` on ${timeframe}` : ''}, it is easy to see why ${coupleOrSubject} appeared so thoroughly relaxed and in sync. From ${outfit ? `the effortless summer styling featuring ${outfit}` : 'their effortless coastal aesthetic'} to the unhurried pace of the afternoon, every moment reflected genuine affection away from demanding schedules.`,
        `Tracing the broader arc of ${coupleOrSubject}'s relationship${timeframe ? ` since ${timeframe}` : ''}${loc ? ` across destinations like ${loc}` : ''}, insiders and longtime observers note how naturally their partnership has flourished. By prioritizing uninterrupted quality time and blending their respective worlds${supporting ? `—including ${supporting}—` : ''}, they have built a remarkably grounded and supportive dynamic.`,
        `Beyond the sun-drenched scenery${loc ? ` of ${loc}` : ''}, what stands out most about ${primary} and ${secondary || 'their inner circle'} is the seamless balance between high-level professional achievements${supporting ? ` involving ${supporting}` : ''} and quiet family routines. Every candid gesture captured during the outing speaks to a mature, joyful chapter defined by mutual respect and shared contentment.`,
        `Furthermore, seeing ${coupleOrSubject} embrace these unscripted moments${loc ? ` along the coast of ${loc}` : ''} offers fans a refreshing glimpse into life behind the spotlight. Rather than grand spectacle, it is the simple warmth of shared laughter, coastal breezes, and close family bonds that makes their story so genuinely compelling.`,
        `Focusing on the personal milestones surrounding ${localFocusEntity}, those close to the pair have consistently highlighted how refreshing it is to keep their romance low-key and authentic. Whether spending time in ${loc || 'their favorite retreats'} or navigating busy work commitments, their mutual devotion remains unmistakable.`,
        `At the same time, ${primary}'s ability to juggle major creative ventures${specificSup ? ` alongside connections to ${specificSup}` : ''} while carving out peaceful getaways with ${secondary || 'loved ones'} demonstrates an inspiring sense of balance. Every detail from the trip underscores a season of calm happiness and emotional renewal.`,
        `Observers also note how effortlessly ${coupleOrSubject} have integrated their friends and family${supporting ? `, including ${supporting},` : ''} into this new chapter. That foundation of trust and shared joy shines through in every candid photograph from the outing.`,
        `Ultimately, the enduring warmth between ${coupleOrSubject}${loc ? ` during their time in ${loc}` : ''} captures the essence of a partnership built on genuine compatibility. Away from red carpets and studio sets, these quiet, sun-lit moments tell the truest story of all.`,
      ];
    }
  }

  let attempt = 0;
  // Nhân paragraphIndex * 2 để mỗi đoạn văn kế tiếp lấy cặp câu phân tích hoàn toàn khác nhau, không bị trùng lặp giữa đoạn trên và đoạn dưới
  while (combined.split(/\s+/).filter(Boolean).length < 140 && attempt < contextualElaborations.length) {
    const addon =
      contextualElaborations[(paragraphIndex * 2 + attempt) % contextualElaborations.length];
    if (!combined.includes(addon.slice(0, 36))) {
      combined = combined ? `${combined} ${addon}` : addon;
    }
    attempt++;
  }

  const finalWords = combined.split(/\s+/).filter(Boolean);
  if (finalWords.length > 172) {
    const sliced = finalWords.slice(0, 162).join(' ');
    const lastDot = Math.max(
      sliced.lastIndexOf('. '),
      sliced.lastIndexOf('! '),
      sliced.lastIndexOf('? ')
    );
    if (lastDot > 520) {
      return sliced.slice(0, lastDot + 1).trim();
    }
    return `${sliced}.`;
  }

  return finalWords.join(' ');
}

/**
 * Xây dựng các tiêu đề phụ H2 bám sát NỘI DUNG BÊN TRONG BÀI VIẾT (Tuyệt đối không dùng tiêu đề chính articleTitle)
 */
function buildContentDrivenSubheadings(
  contextProfile: ArticleContextProfile,
  originalHeadings: string[],
  language: 'en' | 'vi'
): string[] {
  const isVi = language === 'vi';
  const primary = contextProfile.primaryPerson || contextProfile.subjectDisplay || 'Nhân vật chính';
  const secondary = contextProfile.secondaryPerson || '';
  const subjectPair = secondary ? `${primary} & ${secondary}` : primary;
  const loc1 = contextProfile.locationKeywords[0]
    ? contextProfile.locationKeywords[0].replace(/(^|\s)([a-z])/g, (_m, p1, p2) => `${p1}${p2.toUpperCase()}`)
    : '';
  const loc2 = contextProfile.locationKeywords[1]
    ? contextProfile.locationKeywords[1].replace(/(^|\s)([a-z])/g, (_m, p1, p2) => `${p1}${p2.toUpperCase()}`)
    : '';
  const sup1 = contextProfile.supportingEntities[0] || '';
  const sup2 = contextProfile.supportingEntities[1] || '';
  const tf1 = contextProfile.timeframeKeywords[0] || '';
  const outfit1 = contextProfile.outfitKeywords[0] || '';
  const cat = contextProfile.articleCategory;

  const cleanOrig = originalHeadings
    .map((h) => h.replace(/^##\s*/, '').trim())
    .filter((h) => h.length >= 10 && h.length <= 95)
    .map((h) =>
      h === h.toLowerCase()
        ? h.replace(/(^|\s)([a-z])/g, (_m, p1, p2) => `${p1}${p2.toUpperCase()}`)
        : h
    );

  const generated: string[] = [];

  if (isVi) {
    if (cat === 'screen_production') {
      generated.push(
        `Toàn cảnh quá trình sản xuất và diện mạo mới của ${subjectPair}${loc1 ? ` tại ${loc1}` : ''}`,
        `Dàn diễn viên thực lực và những nhân tố mới đáng chú ý${sup1 ? ` cùng ${sup1}` : ''}`,
        `Bối cảnh quay${loc1 ? ` ở ${loc1}` : ''} và phong cách hình ảnh đặc trưng của tác phẩm`,
        `Chia sẻ từ đội ngũ sáng tạo${sup2 ? ` và ${sup2}` : ''} về hướng đi mới của cốt truyện`,
        `Chiều sâu tâm lý nhân vật của ${primary} và những bí ẩn sắp được hé lộ`,
        `Sự kết hợp giữa kịch tính, hài hước đen và dấu ấn nghệ thuật đặc sắc`,
        `Tác động văn hóa và sức hút toàn cầu của thương hiệu đối với khán giả`,
        `Những kỳ vọng lớn dành cho ${subjectPair} trong phần phim sắp ra mắt`
      );
    } else {
      generated.push(
        `Khoảnh khắc đời thường đáng chú ý của ${subjectPair}${loc1 ? ` tại ${loc1}` : ''}${tf1 ? ` (${tf1})` : ''}`,
        `Phong cách thời trang${outfit1 ? ` với ${outfit1}` : ''} và thần thái tự nhiên của ${primary}`,
        `Hành trình gắn kết và câu chuyện tình cảm của ${subjectPair}${loc2 ? ` tại ${loc2}` : ''}`,
        `Sự nghiệp vững chắc và cách cân bằng cuộc sống cá nhân của ${subjectPair}`,
        `Sự hòa hợp ấm áp bên gia đình${sup1 ? ` cùng ${sup1}` : ''} và những người thân yêu`,
        `Góc nhìn hậu trường: Nhịp sống bình yên phía sau ánh đèn sân khấu`,
        `Phản ứng tích cực từ công chúng trước hình ảnh rạng rỡ của ${subjectPair}`,
        `Dấu ấn trưởng thành và chương mới viên mãn của ${primary}`
      );
    }
  } else {
    if (cat === 'screen_production') {
      generated.push(
        `Inside the Production Milestone Featuring ${subjectPair}${loc1 ? ` in ${loc1}` : ''}`,
        `New and Returning Cast Additions${sup1 ? `: ${sup1}` : ''}${sup2 ? ` and ${sup2}` : ''}`,
        `Atmospheric Locations${loc1 ? ` Across ${loc1}` : ''} and Signature Visual Identity`,
        `Showrunners and Creative Leadership on Expanding ${primary}'s World`,
        `Character Evolution, Family Lore, and Deepening Mysteries`,
        `Balancing Suspense, Dark Humor, and Cinematic Craftsmanship`,
        `Global Cultural Impact and Record-Breaking Viewer Reception`,
        `What Lies Ahead for ${subjectPair} in the Upcoming Chapter`
      );
    } else if (cat === 'red_carpet_event') {
      generated.push(
        `${subjectPair} Stepping Out in Style${loc1 ? ` in ${loc1}` : ''}`,
        `Radiant Glamour${outfit1 ? `: The ${outfit1}` : ''} and Empowering Fashion Choices`,
        `A Supportive Partnership and Meaningful Personal Milestones for ${subjectPair}`,
        `Inside ${primary}'s Upcoming Roles${sup1 ? ` With ${sup1}` : ''} and Creative Projects`,
        `Advocacy for Authenticity, Body Confidence, and Screen Craft`,
        `From Motherhood and Personal Growth to a Joyful New Chapter`,
        `How Audiences and Entertainment Insiders Are Celebrating ${primary}`,
        `Looking Ahead at ${primary}'s Continuing Evolution on Screen and Off`
      );
    } else if (cat === 'retrospective_feature') {
      generated.push(
        `The Real Context and Timeline Behind ${subjectPair}${loc1 ? ` in ${loc1}` : ''}`,
        `Revisiting the Documented Moments${tf1 ? ` from ${tf1}` : ''} and Candid Details`,
        `How ${primary}${secondary ? ` and ${secondary}` : ''} Shaped an Unforgettable Era`,
        `Behind the Scenes${sup1 ? ` With ${sup1}` : ''}: Craft, Character, and Cultural Impact`,
        `Separating Archival Reality from Modern Headlines`,
        `Key Milestones and Creative Achievements Throughout the Journey`,
        `Why ${primary}'s Legacy Continues to Resonate With Generations of Fans`,
        `Preserving the Authentic Story and Lasting Memories of ${subjectPair}`
      );
    } else {
      generated.push(
        `Inside ${subjectPair}'s Sun-Soaked Escape${loc1 ? ` in ${loc1}` : ''}${tf1 ? ` (${tf1})` : ''}`,
        `Effortless Summer Style${outfit1 ? ` in a ${outfit1}` : ''} and Candid Moments Together`,
        `How the Romance Between ${subjectPair} Blossomed${loc2 ? ` Across ${loc2}` : ''}`,
        `Balancing ${primary}'s Busy Career With Uninterrupted Quality Time`,
        `${secondary || primary}'s Professional World and Grounded Partnership`,
        `Family Harmony and Blending Lives${sup1 ? ` With ${sup1}` : ''}${sup2 ? ` and ${sup2}` : ''}`,
        `Why Fans Admire ${subjectPair}'s Low-Key Approach to Modern Romance`,
        `A Joyful Chapter Ahead for ${subjectPair}${loc1 ? ` Beyond ${loc1}` : ''}`
      );
    }
  }

  // Ưu tiên giữ các tiêu đề phụ gốc có trong bài viết, sau đó bổ sung các tiêu đề phụ theo sát nội dung
  const combined: string[] = [];
  for (const h of [...cleanOrig, ...generated]) {
    if (!combined.includes(h)) combined.push(h);
  }
  return combined.slice(0, 9);
}

/**
 * Xây dựng bài viết dài chuẩn SEO từ 2.000 - 5.000 từ:
 * - ĐỌC HIỂU NỘI DUNG BÊN TRONG BÀI VIẾT (sourceArticleText) và NHÂN RỘNG từng đoạn, từng câu, từng dữ kiện thực tế trong bài.
 * - TUYỆT ĐỐI KHÔNG dùng tiêu đề chính (articleTitle) để viết vào nội dung hay tiêu đề phụ H2.
 * - Mỗi đoạn văn chuẩn ~150 từ, xuống dòng rõ ràng, gắn đầy đủ toàn bộ ảnh trong bài + ảnh ngoài bổ sung + 2 video YouTube cuối bài.
 */
export function buildLongFormSeoArticle2000To5000Words(params: {
  articleTitle: string;
  focusKeyword: string;
  sourceArticleText: string;
  aiDraftHtml: string;
  images: ScrapedArticleImage[];
  youtubeVideos: RelatedYouTubeVideo[];
  language: 'en' | 'vi';
  contextProfile?: ArticleContextProfile;
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
  const profile =
    params.contextProfile ||
    analyzeArticleSubjectAndContext(articleTitle, sourceArticleText, focusKeyword, images);

  // 1. Tách nội dung bên trong bài viết gốc thành các tiêu đề phụ gốc (nếu có) và các đoạn văn thực tế
  const rawLines = String(sourceArticleText || '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const originalHeadings: string[] = [];
  const sourceParagraphs: string[] = [];

  for (const line of rawLines) {
    if (line.startsWith('## ')) {
      originalHeadings.push(line.replace(/^##\s*/, '').trim());
    } else if (
      line.length >= 12 &&
      line.length <= 85 &&
      !/[.!]$/.test(line) &&
      (line.endsWith('?') || /^[a-z0-9\s'’“-]+$/i.test(line))
    ) {
      originalHeadings.push(line);
    } else if (line.length >= 25) {
      sourceParagraphs.push(line);
    }
  }

  // Thu thập thêm các đoạn từ AI Draft (nếu AI đã viết mở rộng dựa trên nội dung bài gốc)
  const aiParagraphs: string[] = [];
  if (aiDraftHtml) {
    const pMatches = aiDraftHtml.match(/<p\b[^>]*>([\s\S]*?)<\/p>/gi) || [];
    for (const pm of pMatches) {
      const t = stripHtmlTags(pm).replace(/\s+/g, ' ').trim();
      // Loại bỏ bất kỳ đoạn nào vô tình lặp lại nguyên văn tiêu đề chính
      if (t.length > 40 && (!articleTitle || !t.includes(`"${articleTitle}"`))) {
        aiParagraphs.push(t);
      }
    }
  }

  // 2. Tách toàn bộ các câu dữ kiện thực tế từ nội dung bài gốc (sourceSentences)
  const allSourceSentences: string[] = [];
  for (const sp of sourceParagraphs) {
    const sents = splitIntoSentences(sp);
    for (const s of sents) {
      if (!allSourceSentences.includes(s)) {
        allSourceSentences.push(s);
      }
    }
  }

  // 3. Xây dựng danh sách 16 - 18 đơn vị nội dung (factBlocks) bám sát 100% vào dữ kiện bên trong bài viết
  // Cách nhân rộng ("nhân rộng nội dung trong bài"):
  // - Trước hết đi qua từng đoạn gốc trong bài. Nếu đoạn gốc có nhiều câu/ý, tách thành 2 cụm câu dữ kiện để mỗi chi tiết trong bài đều được phân tích sâu thành 1 đoạn ~150 từ.
  // - Sau đó kết hợp với các đoạn mở rộng từ AI (nếu có) và các góc nhìn tổng hợp trực tiếp từ các câu thực tế (allSourceSentences) + nhân vật/địa điểm/sự kiện trong bài.
  const factUnits: string[] = [];

  for (const sp of sourceParagraphs) {
    const sents = splitIntoSentences(sp);
    if (sents.length >= 3) {
      const mid = Math.ceil(sents.length / 2);
      factUnits.push(sents.slice(0, mid).join(' '));
      factUnits.push(sents.slice(mid).join(' '));
    } else if (sents.length === 2 && sp.split(/\s+/).length >= 45) {
      factUnits.push(sents[0]);
      factUnits.push(sents[1]);
    } else {
      factUnits.push(sp);
    }
  }

  for (const ap of aiParagraphs) {
    if (factUnits.length < 18 && !factUnits.some((u) => u.slice(0, 40) === ap.slice(0, 40))) {
      factUnits.push(ap);
    }
  }

  // Nếu tổng số cụm dữ kiện từ bài gốc < 16 (ví dụ bài gốc ngắn chỉ có 4-5 đoạn), nhân rộng trực tiếp từ từng câu dữ kiện trong bài (allSourceSentences)
  const primary = profile.primaryPerson || profile.subjectDisplay || 'the star';
  const secondary = profile.secondaryPerson || '';
  const subjectPair = secondary ? `${primary} and ${secondary}` : primary;
  const locs = profile.locationKeywords.map((l) => l.replace(/\b\w/g, (c) => c.toUpperCase()));
  const sups = profile.supportingEntities;
  const outfits = profile.outfitKeywords;
  const timeframes = profile.timeframeKeywords;

  const synthesisAngles: string[] = isVi
    ? [
        allSourceSentences[0]
          ? `Đi sâu phân tích chi tiết mở đầu trong bài viết: ${allSourceSentences[0]}`
          : `Trọng tâm của câu chuyện xoay quanh ${subjectPair}${locs[0] ? ` tại ${locs[0]}` : ''} cùng những diễn biến thực tế đang thu hút sự chú ý lớn.`,
        allSourceSentences[1]
          ? `Khía cạnh tiếp theo được làm rõ trong nội dung bài là ${allSourceSentences[1]}`
          : `Mỗi chi tiết xoay quanh ${primary}${secondary ? ` và ${secondary}` : ''}${outfits[0] ? ` với hình ảnh ${outfits[0]}` : ''} đều mang lại góc nhìn sinh động và chân thực.`,
        allSourceSentences[2]
          ? `Đáng chú ý hơn, bài viết nhấn mạnh vào cột mốc quan trọng: ${allSourceSentences[2]}`
          : `Sự kết nối giữa ${subjectPair}${sups[0] ? ` cùng các yếu tố liên quan tới ${sups[0]}` : ''} tạo nên chiều sâu đặc biệt cho toàn bộ mạch truyện.`,
        allSourceSentences[3]
          ? `Nhìn từ bối cảnh thực tế được đề cập: ${allSourceSentences[3]}`
          : `Tại ${locs.join(' và ') || 'bối cảnh chính của câu chuyện'}, ${subjectPair} đã để lại nhiều ấn tượng sâu sắc qua từng hoạt động cụ thể.`,
        allSourceSentences[4]
          ? `Một chi tiết đắt giá khác trong bài viết cũng thu hút sự quan tâm đặc biệt: ${allSourceSentences[4]}`
          : `Quá trình phát triển${timeframes[0] ? ` gắn liền với mốc thời gian ${timeframes[0]}` : ''} cho thấy bước chuyển mình rõ nét của ${primary}.`,
        allSourceSentences[5]
          ? `Tiếp nối mạch thông tin trong bài: ${allSourceSentences[5]}`
          : `Bên cạnh nhân vật trung tâm là ${primary}, sự xuất hiện của ${secondary || sups.slice(0, 2).join(', ') || 'các cộng sự'} càng làm nổi bật bức tranh toàn cảnh.`,
        allSourceSentences[6]
          ? `Khép lại chuỗi dữ kiện cốt lõi trong bài viết: ${allSourceSentences[6]}`
          : `Tổng hợp toàn bộ những thông tin thực tế xoay quanh ${subjectPair}, độc giả có thể cảm nhận trọn vẹn giá trị và sức hút của câu chuyện.`,
      ]
    : [
        allSourceSentences[0]
          ? `Taking a closer analytical look at the opening details of the report: ${allSourceSentences[0]}`
          : `At the center of the story is ${subjectPair}${locs[0] ? ` in ${locs[0]}` : ''}, whose latest chapter brings together compelling personal and professional developments.`,
        allSourceSentences[1]
          ? `Building directly on the scene described in the coverage: ${allSourceSentences[1]}`
          : `Every specific detail surrounding ${primary}${secondary ? ` and ${secondary}` : ''}${outfits[0] ? `, including the ${outfits[0]},` : ''} highlights the authentic atmosphere of the moment.`,
        allSourceSentences[2]
          ? `Another pivotal detail highlighted within the story notes how ${allSourceSentences[2].charAt(0).toLowerCase()}${allSourceSentences[2].slice(1)}`
          : `The timeline connecting ${subjectPair}${timeframes[0] ? ` around ${timeframes[0]}` : ''}${locs[1] ? ` and ${locs[1]}` : ''} reveals a thoughtful, organic progression.`,
        allSourceSentences[3]
          ? `Examining the broader background shared in the article: ${allSourceSentences[3]}`
          : `Key connections involving ${sups.slice(0, 3).join(', ') || subjectPair} add important context to how ${primary} navigates both career and personal priorities.`,
        allSourceSentences[4]
          ? `Further underscoring the depth of this chapter, the report points out: ${allSourceSentences[4]}`
          : `Across ${locs.join(' and ') || 'each setting featured in the story'}, the interplay between ${subjectPair} demonstrates genuine poise and lasting chemistry.`,
        allSourceSentences[5]
          ? `Adding another layer of insight from the documented account: ${allSourceSentences[5]}`
          : `Whether focusing on ${sups[0] || primary}'s creative milestones or quiet moments away from the cameras, the details paint a cohesive and engaging portrait.`,
        allSourceSentences[6]
          ? `Bringing together the final threads of the coverage: ${allSourceSentences[6]}`
          : `Taken together, every fact surrounding ${subjectPair}${locs[0] ? ` in ${locs[0]}` : ''} underscores why audiences remain so invested in their ongoing journey.`,
      ];

  let synIdx = 0;
  while (factUnits.length < 16 && synIdx < synthesisAngles.length * 2) {
    const candidate = synthesisAngles[synIdx % synthesisAngles.length];
    const extraSent =
      allSourceSentences.length > 0
        ? allSourceSentences[(synIdx + 2) % allSourceSentences.length]
        : '';
    const merged =
      extraSent && !candidate.includes(extraSent.slice(0, 30))
        ? `${candidate} ${extraSent}`
        : candidate;
    factUnits.push(merged);
    synIdx++;
  }

  // Giới hạn ở mức 16 - 22 đoạn (~150 từ/đoạn => 2.400 - 3.300 từ, chuẩn khung 2.000 - 5.000 từ)
  const targetUnits = factUnits.slice(0, 20);
  const subheadings = buildContentDrivenSubheadings(profile, originalHeadings, language);

  const finalParagraphs150Words: { h2?: string; text: string }[] = [];

  targetUnits.forEach((unitText, idx) => {
    const expanded150 = expandFactBlockToAround150Words({
      baseFactText: unitText,
      contextProfile: profile,
      allFactsPool: allSourceSentences,
      language,
      paragraphIndex: idx,
    });

    // Cứ mỗi 2 đoạn văn (~300 từ) đặt 1 tiêu đề phụ H2 bám sát nội dung bài (không đặt H2 ở đoạn mở đầu tiên để ảnh #1 + đoạn 1 mở bài tự nhiên như celeb24h.com)
    let h2ForPara: string | undefined;
    if (idx > 0 && idx % 2 === 0) {
      const h2Index = Math.floor((idx - 2) / 2);
      if (h2Index < subheadings.length) {
        h2ForPara = subheadings[h2Index];
      }
    }

    finalParagraphs150Words.push({
      h2: h2ForPara,
      text: expanded150,
    });
  });

  // 4. Lắp ghép HTML: Gắn ảnh #1 ngay đầu bài, chèn xen kẽ toàn bộ ảnh trong bài + ảnh bổ sung ngoài, và 2 video YouTube cuối bài
  const htmlBlocks: string[] = [];
  const totalParas = finalParagraphs150Words.length;
  let imgIdx = 0;

  const renderFigureBlock = (img: ScrapedArticleImage, displayNum: number) => {
    const cleanAlt =
      img.alt && img.alt !== articleTitle
        ? img.alt
        : `${profile.subjectDisplay || primary} - Photo #${displayNum}`;
    const altText = cleanAlt.replace(/"/g, '&quot;');
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

    htmlBlocks.push(
      `<p style="margin: 0 0 22px 0; line-height: 1.85; font-size: 17px;">${item.text}</p>\n<br />`
    );

    if (
      imgIdx < images.length &&
      ((idx + 1) % imgStep === 0 || idx >= totalParas - (images.length - imgIdx))
    ) {
      htmlBlocks.push(renderFigureBlock(images[imgIdx++], imgIdx));
    }
  });

  while (imgIdx < images.length) {
    htmlBlocks.push(renderFigureBlock(images[imgIdx++], imgIdx));
  }

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

  if (params.mode === 'from_url' || candidateUrl) {
    const scraped = await scrapeWebArticleForSeoRewrite(candidateUrl || params.topic);
    scrapedImages = scraped.images;
    sourceTitle = scraped.originalTitle;
    sourceExcerpt = scraped.originalExcerpt;
    sourceArticleText = scraped.articleText;
    resolvedSourceUrl = scraped.sourceUrl;
  }

  const contextProfile = analyzeArticleSubjectAndContext(
    sourceTitle || params.topic,
    sourceArticleText || params.existingContent || params.topic,
    params.keyword,
    scrapedImages
  );

  const effectiveTopic =
    sourceTitle || params.topic.trim() || (params.existingContent || '').slice(0, 120);
  const kw =
    contextProfile.primaryPerson ||
    params.keyword?.trim() ||
    effectiveTopic.split(/[:–—|-]/)[0].trim();

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
        ? `Bạn là biên tập viên cao cấp cho chuyên trang giải trí celeb24h.com.
Nhiệm vụ: Hãy ĐỌC KỸ NỘI DUNG BÊN TRONG BÀI VIẾT GỐC dưới đây và VIẾT NHÂN RỘNG RA (mở rộng chuyên sâu từng đoạn, từng sự kiện, nhân vật, chi tiết có trong bài).
QUY TẮC BẮT BUỘC:
- TUYỆT ĐỐI KHÔNG dùng tiêu đề chính ("${sourceTitle}") để viết hay lặp lại trong các đoạn văn, vì tiêu đề chỉ là câu dẫn, nội dung thật nằm ở bên trong bài viết!
- Phải bám sát 100% vào nhân vật thực tế (${contextProfile.subjectDisplay}), địa điểm (${contextProfile.locationKeywords.join(', ')}), cột mốc thời gian và các chi tiết cụ thể trong Nội dung bài gốc.
- Ngôn ngữ đầu ra bắt buộc: ${langLabel}.

Nội dung bên trong bài viết gốc:
${sourceArticleText.slice(0, 6800)}

Hãy trả về JSON thuần với cấu trúc:
{
  "title": "${sourceTitle.replace(/"/g, '\\"')}",
  "slug": "duong-dan-url-chuan-seo-khong-dau",
  "excerpt": "Đoạn mô tả Meta Description chuẩn SEO (140-165 ký tự) tóm tắt đúng nội dung bên trong bài về ${contextProfile.subjectDisplay}",
  "focusKeyword": "${contextProfile.primaryPerson || kw}",
  "youtubeSearchQuery": "${contextProfile.combinedSearchQuery}",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "contentHtml": "Nội dung bài viết nhân rộng chuyên sâu định dạng thẻ <p>. Hãy viết từ 14-16 đoạn <p>, mỗi đoạn khoảng 150 từ, phát triển và phân tích sâu từng đoạn, từng chi tiết, nhân vật, bối cảnh trong bài gốc. Tuyệt đối không nhắc lại tiêu đề câu view."
}`
        : `Bạn là biên tập viên cao cấp cho chuyên trang giải trí celeb24h.com.
Nhiệm vụ: Dựa vào nội dung bên dưới, hãy viết nhân rộng thành 1 bài báo dài chuẩn SEO chuyên sâu, bám sát 100% dữ kiện và nhân vật trong bài.
Ngôn ngữ đầu ra bắt buộc: ${langLabel}.
Nội dung đầu vào:
${params.topic}
${params.existingContent ? `\nNội dung bổ sung:\n${params.existingContent.slice(0, 4500)}` : ''}

Hãy trả về JSON thuần với cấu trúc:
{
  "title": "Tiêu đề bài viết chuẩn SEO, cuốn hút (55-75 ký tự)",
  "slug": "duong-dan-url-chuan-seo-khong-dau",
  "excerpt": "Đoạn mô tả Meta Description chuẩn SEO (140-165 ký tự)",
  "focusKeyword": "tên nhân vật chính hoặc từ khóa SEO chính (2-5 từ)",
  "youtubeSearchQuery": "tên nhân vật chính + sự kiện (3-6 từ) để tìm 2 video YouTube và ảnh ngoài liên quan nhất",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "contentHtml": "Nội dung bài viết chi tiết định dạng thẻ <p>. Hãy viết từ 14-16 đoạn <p>, mỗi đoạn khoảng 150 từ."
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
          setTimeout(() => reject(new Error('Gemini fast timeout')), 4200)
        ),
      ]);

      const parsed = JSON.parse(response.text || '{}');
      if (parsed) {
        generatedTitle = sourceTitle || String(parsed.title || effectiveTopic);
        generatedSlug = String(parsed.slug || '');
        generatedExcerpt = String(parsed.excerpt || sourceExcerpt || '');
        generatedKeyword = String(contextProfile.primaryPerson || parsed.focusKeyword || kw);
        youtubeQuery = String(parsed.youtubeSearchQuery || contextProfile.combinedSearchQuery || generatedKeyword);
        generatedTags = Array.isArray(parsed.tags) ? parsed.tags.map(String) : [generatedKeyword];
        aiDraftHtml = String(parsed.contentHtml || '');
      }
    } catch (err) {
      console.warn('[wpPublishService] Using content-driven long-form SEO engine:', err);
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
    const firstCleanSent = splitIntoSentences(sourceArticleText)[0] || '';
    generatedExcerpt =
      sourceExcerpt ||
      (firstCleanSent
        ? firstCleanSent.slice(0, 160)
        : `Read the full story about ${contextProfile.subjectDisplay || generatedKeyword}.`);
  }

  if (generatedTags.length === 0) {
    generatedTags = [
      contextProfile.primaryPerson || generatedKeyword || 'Celebrity',
      ...(contextProfile.secondaryPerson ? [contextProfile.secondaryPerson] : []),
      ...contextProfile.supportingEntities.slice(0, 2),
      params.categoryName || 'Showbiz',
      'Celeb24h',
    ];
  }

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

  // Xây dựng bài viết dài 2.000 - 5.000 từ bám sát nội dung bên trong bài viết (không dùng tiêu đề câu view để viết)
  const longFormResult = buildLongFormSeoArticle2000To5000Words({
    articleTitle: generatedTitle,
    focusKeyword: contextProfile.subjectDisplay || generatedKeyword,
    sourceArticleText,
    aiDraftHtml,
    images: allCombinedImages,
    youtubeVideos: relatedVideos,
    language,
    contextProfile,
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


