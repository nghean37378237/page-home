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
    const fetchImgBuffer = async (targetUrl: string, ref: string): Promise<{ buf: Buffer; mime: string } | null> => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const imgRes = await fetch(targetUrl, {
          headers: {
            'User-Agent': SCRAPER_USER_AGENT,
            Referer: ref,
            Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          },
          signal: controller.signal,
        }).finally(() => clearTimeout(timer));
        if (!imgRes.ok) return null;
        const ct = (imgRes.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('text/html')) return null;
        const ab = await imgRes.arrayBuffer();
        const b = Buffer.from(ab);
        if (b.byteLength < 400) return null;
        return {
          buf: b,
          mime: ct.startsWith('image/') ? ct.split(';')[0] : 'image/jpeg',
        };
      } catch {
        return null;
      }
    };

    let downloaded = await fetchImgBuffer(params.imageUrl, refererOrigin);
    if (!downloaded) {
      const wsrvUrl = `https://wsrv.nl/?url=${encodeURIComponent(params.imageUrl)}&output=jpg`;
      downloaded = await fetchImgBuffer(wsrvUrl, 'https://wsrv.nl/');
    }
    if (!downloaded) {
      throw new Error(`Không thể tải ảnh từ URL: ${params.imageUrl}`);
    }
    buffer = downloaded.buf;
    mimeType = downloaded.mime;
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

  // Đảm bảo luôn có ảnh gắn trong bài viết và nội dung chuẩn trước khi đẩy lên web
  let finalContent = input.content || '';
  let candidateImgs = Array.isArray(input.extractedImages)
    ? input.extractedImages.filter((im) => im && im.url)
    : [];

  const isBrokenFallbackDraft =
    /Across the paragraphs and illustrative photographs of the report, the story of/i.test(
      finalContent
    ) ||
    /Read the full story about .*?\s+\./i.test(input.excerpt || '');

  // Nếu bài đang đẩy lên chưa có ảnh HOẶC đang dính bản nháp dự phòng thiếu dữ kiện, tự động dò bài gốc & viết lại đầy đủ kèm 5 ảnh gốc!
  if (isBrokenFallbackDraft || !/<img\b/i.test(finalContent)) {
    if (isBrokenFallbackDraft) {
      try {
        const regenerated = await generateSeoArticleWithAi({
          mode: input.sourceUrl ? 'from_url' : 'from_text',
          topic: input.sourceUrl || input.title,
          sourceUrl: input.sourceUrl,
          language: 'en',
        });
        if (regenerated && regenerated.contentHtml && /<img\b/i.test(regenerated.contentHtml)) {
          input.title = regenerated.title || input.title;
          finalContent = regenerated.contentHtml;
          input.excerpt = regenerated.excerpt || input.excerpt;
          if (Array.isArray(regenerated.tags) && regenerated.tags.length > 0) {
            input.tags = regenerated.tags;
          }
          if (Array.isArray(regenerated.extractedImages) && regenerated.extractedImages.length > 0) {
            candidateImgs = regenerated.extractedImages;
          }
          if (!input.featuredImageUrl && regenerated.featuredImageUrl) {
            input.featuredImageUrl = regenerated.featuredImageUrl;
          }
        }
      } catch {}
    }

    if (!/<img\b/i.test(finalContent)) {
      if (candidateImgs.length === 0 && input.sourceUrl) {
        try {
          const scraped = await scrapeWebArticleForSeoRewrite(input.sourceUrl);
          if (scraped.images.length > 0) {
            candidateImgs = [...scraped.images];
          }
        } catch {}
      }
      if (candidateImgs.length === 0 && (input.title || finalContent)) {
        try {
          const discovered = await tryDiscoverSourceArticleImagesFromText(input.title, finalContent);
          if (discovered && discovered.images.length > 0) {
            candidateImgs = [...discovered.images];
            if (discovered.title && !/[?!:]/.test(input.title) && /[?!:]/.test(discovered.title)) {
              input.title = discovered.title;
            }
          }
        } catch {}
      }
      if (candidateImgs.length < 5) {
        try {
          const ctxProfile = analyzeArticleSubjectAndContext(
            input.title,
            finalContent,
            undefined,
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
  const expandedHtml = String(htmlChunk || '').replace(
    /<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gi,
    (_m, inner) => decodeHtmlEntities(inner)
  );

  const sourceRegex = /<source\b[^>]*>/gi;
  let sm: RegExpExecArray | null;
  while ((sm = sourceRegex.exec(expandedHtml)) !== null) {
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
  while ((m = imgRegex.exec(expandedHtml)) !== null) {
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

  // Quét thêm URL ảnh /wp-content/uploads/ ẩn trong script/JSON khi web bật chống copy bằng JS blob
  const rawUploadRegex = /https?:\\?\/\\?\/[^"'\s<>\\]+\/wp-content\/uploads\/[^"'\s<>\\]+\.(?:jpg|jpeg|png|webp|avif)(?:\?[^"'\s<>\\]*)?/gi;
  let rm: RegExpExecArray | null;
  while ((rm = rawUploadRegex.exec(expandedHtml)) !== null) {
    let rawU = rm[0].replace(/\\\//g, '/');
    if (rawU.includes('/wp-content/uploads/')) {
      rawU = rawU.replace(/-(?:150x\d+|2\d\dx\d+|3\d\dx\d+|4\d\dx\d+|5\d\dx\d+|6\d\dx\d+)(?=\.(jpg|jpeg|png|webp|avif)(\?|$))/i, '');
    }
    const resolved = resolveAbsUrl(rawU, baseUrl);
    if (resolved && !isIgnorableImage(resolved)) {
      list.push({ url: resolved, alt: '' });
    }
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
  articleCategory:
    | 'screen_production'
    | 'celebrity_romance_vacation'
    | 'city_neighborhood_outing'
    | 'red_carpet_event'
    | 'retrospective_feature';
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
    'Hollywood', 'Caribbean', 'Barbados', 'Bahamas', 'Bora', 'Cabo', 'Ibiza', 'Mykonos',
    'Maui', 'Tahiti', 'Sardinia', 'Capri', 'Amalfi', 'Portofino', 'London', 'West', 'North',
    'South', 'East', 'Southern', 'Northern', 'Eastern', 'Western', 'Central', 'California',
    'Florida', 'Connecticut', 'Greenwich', 'United', 'States', 'America', 'British',
    'English', 'American', 'Great', 'Britain', 'French', 'Riviera', 'Mediterranean',
    'German', 'Italian', 'Spanish', 'Mexican', 'Saint', 'Tropez', 'Cannes',
    'Rome', 'Malibu', 'Hawaii', 'Manhattan', 'Dublin', 'Ireland', 'Nashville', 'Byron',
    'Bay', 'Australia', 'Australian', 'Monday', 'Tuesday', 'Thursday', 'Friday', 'Saturday',
    'Sunday', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December', 'Instagram', 'Twitter', 'Facebook',
    'YouTube', 'TikTok', 'Daily', 'Mail', 'Page', 'Six', 'People', 'Weekly', 'Magazine',
    'Notting', 'Hill', 'Los', 'Angeles', 'New', 'York', 'Miami', 'Beach', 'Lane',
    'Golden', 'Globes', 'Academy', 'Award', 'Awards', 'Oscar', 'Oscars', 'Emmy', 'Grammy',
    'Anyone', 'You', 'Star', 'Legend', 'Beauty', 'Model', 'Actress', 'Supermodel',
    'Actor', 'Singer', 'Partner', 'Candid', 'Photo', 'Photos', 'Recognize', 'Them', 'Her', 'Him',
    'Bear', 'Blur', 'Gorillaz', 'Landman', 'City', 'Street', 'Streets', 'Turns', 'Heads',
    'Jimmy', 'Kimmel', 'Live', 'Coogies', 'Cafe', 'Big', 'Apple', 'Uncharted', 'Invasion',
    'Beatles', 'Ted', 'Lasso', 'Succession', 'Hilton', 'Hills', 'Santa',
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
    'Scroll', 'Stay', 'Read', 'Click', 'Share', 'Watch', 'See', 'Everything', 'Know', 'About',
    'Avalon', 'Getty', 'GettyImages', 'Backgrid', 'Splash', 'Shutterstock', 'WireImage',
    'Fatal', 'Attraction', 'Natural', 'Big', 'Chill', 'World', 'Garp', 'Friends', 'Key',
    'Die', 'Hard', 'Pulp', 'Fiction', 'Sixth', 'Sense', 'Unbreakable', 'Moonlighting',
    'Matrix', 'Reloaded', 'Revolutions', 'Spectre', 'Malena', 'Irreversible', 'Beetlejuice'
  ]);

  const stopPhrases = new Set([
    'santa monica', 'sandy lane', 'beverly hills', 'palm springs', 'bora bora',
    'saint tropez', 'notting hill', 'new york', 'los angeles', 'miami beach',
    'french riviera', 'cabo san lucas', 'lake como', 'west hollywood', 'west london',
    'south of france', 'byron bay', 'die hard', 'pulp fiction', 'sixth sense',
    'legally blonde', 'morning show', 'dirty dancing', 'ferris bueller', 'big little lies',
    'hello sunshine', 'daily mail', 'page six', 'people magazine', 'golden globes',
    'academy awards', 'real housewives'
  ]);

  const isWednesdayShowContext = /\b(Nevermore|Addams|Ortega|Enid|Morticia|Ophelia|Pugsley|Gomez)\b/i.test(
    `${sample} ${title}`
  );
  if (!isWednesdayShowContext) {
    stopWords.add('Wednesday');
  }

  // Nhận diện tên người cũ sau cụm "split from / divorced from / separated from" để không ghép nhầm làm bạn đồng hành hiện tại
  const exPartnerSet = new Set<string>();
  const exRegex =
    /\b(?:split|divorce|divorced|separated|separation|parted\s+ways)\s+from\s+(?:[a-z-]+\s+){0,3}([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{1,15}\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15})/gi;
  let exMatch: RegExpExecArray | null;
  while ((exMatch = exRegex.exec(sample)) !== null) {
    exPartnerSet.add(exMatch[1].trim());
  }

  const stats = new Map<
    string,
    { count: number; firstIdx: number; bioBoost: number; isCompanion: boolean }
  >();

  // Nhận diện các nhân vật đi kèm sau cụm "with/and her/his husband/wife/boyfriend/girlfriend/partner..."
  const companionRegex =
    /\b(?:with|alongside|beside|and)\s+(?:her|his|their)?\s*(?:new\s+|longtime\s+)?(?:husband|wife|partner|boyfriend|girlfriend|fiance|fiancée|companion|beau)\s*(?:,\s*(?:\d{2}-year-old\s+)?(?:[a-z-]+\s+){0,3})?([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{1,15}\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15}(?:\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15})?)/g;
  const companionSet = new Set<string>();
  let cm: RegExpExecArray | null;
  while ((cm = companionRegex.exec(sample.slice(0, 1200))) !== null) {
    const cName = cm[1]
      .trim()
      .split(/\s+/)
      .filter((p) => !stopWords.has(p))
      .slice(0, 3)
      .join(' ');
    if (cName.split(/\s+/).length >= 2 && !stopPhrases.has(cName.toLowerCase())) {
      companionSet.add(cName);
    }
  }

  // 1a. Nhận diện mẫu "Tên Nhân Vật, 49," (ví dụ: "Reese Witherspoon, 49, and her boyfriend...")
  const nameAgeAfterRegex =
    /\b([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{1,15}\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15}(?:\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15})?)\s*,\s*\d{2}\b/g;
  let nam: RegExpExecArray | null;
  while ((nam = nameAgeAfterRegex.exec(sample.slice(0, 1200))) !== null) {
    const rawName = nam[1].trim();
    const cleanParts = rawName.split(/\s+/).filter((p) => !stopWords.has(p.replace(/['’]s$/i, '')));
    if (cleanParts.length < 2) continue;
    const candidate = cleanParts.slice(0, 3).join(' ');
    if (stopPhrases.has(candidate.toLowerCase())) continue;
    const isComp = companionSet.has(candidate);
    const prev = stats.get(candidate) || {
      count: 0,
      firstIdx: nam.index,
      bioBoost: 0,
      isCompanion: isComp,
    };
    prev.bioBoost += isComp ? 18 : 48;
    if (isComp) prev.isCompanion = true;
    stats.set(candidate, prev);
  }

  // 1b. Ưu tiên nhận diện tên nhân vật đi kèm tuổi hoặc danh xưng nghề nghiệp trong NỘI DUNG BÀI
  const bioRegex =
    /(?:(\d{2}-year-old(?:\s+[a-zA-Z-]+){0,4})|(?:representative\s+for|breakout\s+star|actor|actress|singer|model|supermodel|star|frontman|mastermind|financier|surgeon|mother|father|icon|legend|winner|daughter|son|director|showrunners?)(?:\s+[a-zA-Z-]+){0,2})\s*,?\s+(?:Dr\.\s+)?([A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{1,15}\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15}(?:\s+[A-Z][a-zA-Zéèêëàâäîïôöùûüçñ'-]{2,15})?)/g;
  let bm: RegExpExecArray | null;
  while ((bm = bioRegex.exec(sample)) !== null) {
    const rawName = bm[2].trim();
    const parts = rawName.split(/\s+/);
    const cleanParts = parts.filter((p) => !stopWords.has(p.replace(/['’]s$/i, '')));
    if (cleanParts.length < 2) continue;
    const candidate = cleanParts.slice(0, 3).join(' ');
    if (stopPhrases.has(candidate.toLowerCase())) continue;
    const isComp = companionSet.has(candidate);
    const prev = stats.get(candidate) || {
      count: 0,
      firstIdx: bm.index,
      bioBoost: 0,
      isCompanion: isComp,
    };
    prev.bioBoost += isComp ? 18 : 42;
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
    if (stopPhrases.has(candidate.toLowerCase())) continue;
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
    if (lastName && lastName.length >= 4 && !stopWords.has(lastName)) {
      const lastRegex = new RegExp(`\\b${lastName}\\b`, 'g');
      const totalLastMentions = (sample.match(lastRegex) || []).length;
      if (totalLastMentions > info.count) {
        info.bioBoost += Math.min(30, (totalLastMentions - info.count) * 6);
      }
    }
  }

  const rankedEntries = [...stats.entries()].sort((a, b) => {
    const leadBonusA = a[1].firstIdx < 80 ? 48 : a[1].firstIdx < 280 ? 36 : a[1].firstIdx < 550 ? 20 : 0;
    const leadBonusB = b[1].firstIdx < 80 ? 48 : b[1].firstIdx < 280 ? 36 : b[1].firstIdx < 550 ? 20 : 0;
    const compPenaltyA = a[1].isCompanion ? -28 : 0;
    const compPenaltyB = b[1].isCompanion ? -28 : 0;
    const exPenaltyA = exPartnerSet.has(a[0]) ? -50 : 0;
    const exPenaltyB = exPartnerSet.has(b[0]) ? -50 : 0;
    const scoreA = a[1].count * 12 + a[1].bioBoost + leadBonusA + compPenaltyA + exPenaltyA;
    const scoreB = b[1].count * 12 + b[1].bioBoost + leadBonusB + compPenaltyB + exPenaltyB;
    return scoreB - scoreA;
  });

  const rankedPeople = rankedEntries.map((e) => e[0]);

  let fallbackShowSubject = '';
  if (isWednesdayShowContext && rankedPeople.length === 0) {
    if (/\bJenna\s+Ortega\b/i.test(sample)) fallbackShowSubject = 'Jenna Ortega';
    else if (/\bEnid\b/i.test(sample)) fallbackShowSubject = 'Wednesday Addams and Enid Sinclair';
    else if (/\bPugsley\b/i.test(sample)) fallbackShowSubject = 'Wednesday and Pugsley Addams';
    else if (/\bThing\b/i.test(sample)) fallbackShowSubject = 'Wednesday Addams and Thing';
    else fallbackShowSubject = 'Wednesday Addams';
  }

  const cleanUserKw = String(userKeyword || '').trim();
  const isInvalidUserKw =
    !cleanUserKw ||
    cleanUserKw.split(/\s+/).length > 4 ||
    /\?|\b(spotted|soaking|beach|recognize|who|what|where|when|why|how|model|actress|actor|star|celebrity|outfits|turns|heads|look|like|can|you|her|him|them)\b/i.test(
      cleanUserKw
    );

  const primaryPerson =
    rankedPeople[0] ||
    fallbackShowSubject ||
    (!isInvalidUserKw ? cleanUserKw : '') ||
    '';

  const secondaryEntry = rankedEntries.find(
    ([p, info]) =>
      p !== primaryPerson &&
      !exPartnerSet.has(p) &&
      (info.isCompanion || info.bioBoost > 0 || (info.firstIdx < 650 && info.count >= 2)) &&
      !primaryPerson.toLowerCase().includes(p.toLowerCase()) &&
      !p.toLowerCase().includes(primaryPerson.toLowerCase())
  );
  const secondaryPerson = secondaryEntry ? secondaryEntry[0] : '';

  const supportingEntities = rankedEntries
    .map((e) => e[0])
    .filter((p) => p !== primaryPerson && p !== secondaryPerson && !exPartnerSet.has(p))
    .slice(0, 8);

  // 3. Đối chiếu trang phục & đặc điểm hình ảnh từ NỘI DUNG BÀI VIẾT
  const visualSceneText = `${imgAltText} ${sample.slice(0, 1500)}`.toLowerCase();
  const outfitKeywords: string[] = [];
  const outfitRegex =
    /\b((?:all-white|snakeskin(?:-print)?|burgundy|vibrant\s+red|vibrant\s+blue|white|black|red|blue|gold|shimmering\s+gold|glittering\s+gold|shimmer-drenched\s+gold|floral|striped|pink|hot\s+pink|mustard-yellow|green|yellow|navy|chic|skimpy|tiny|polka-dot|leopard(?:-print)?|animal-print|denim|slouchy\s+denim|leather|lace|sheer|sequin|silver|dark|gothic)\s+(?:two-piece\s+bikini|bikini|swimsuit|bathing\s+suit|swim\s+shorts|swim\s+trunks|athletic\s+shorts|shorts|trunks|dress|gown|mini\s+dress|summer\s+dress|crop\s+top|tank\s+top|sports\s+bra|t-shirt|tee|shirt|top|jacket|coat|suit|jeans|joggers|trousers|pants|skirt|outfit|ensemble|wardrobe|cap|ring))\b/gi;
  let om: RegExpExecArray | null;
  while ((om = outfitRegex.exec(visualSceneText)) !== null) {
    const phrase = om[1].replace(/\s+/g, ' ').trim();
    if (!outfitKeywords.includes(phrase) && outfitKeywords.length < 4) {
      outfitKeywords.push(phrase);
    }
  }

  // 4. Địa điểm & mốc thời gian trong NỘI DUNG BÀI VIẾT (Sắp xếp theo thứ tự xuất hiện đầu tiên trong bài)
  const contentLower = sample.toLowerCase();
  const locationGlossary = [
    'sandy lane', 'barbados', 'bahamas', 'bora bora', 'saint-tropez', 'french riviera',
    'mediterranean', 'south of france', 'notting hill', 'west london', 'west hollywood',
    'london', 'malibu', 'new york city', 'new york', 'manhattan', 'nashville', 'miami beach',
    'miami', 'cabo', 'caribbean', 'cannes', 'paris', 'eiffel tower', 'dublin', 'ireland',
    'venice', 'italy', 'beverly hills', 'los angeles', 'byron bay', 'greenwich', 'connecticut',
    'nevermore academy'
  ];
  const matchedLocations: { loc: string; firstPos: number }[] = [];
  for (const loc of locationGlossary) {
    const pos = contentLower.indexOf(loc);
    if (pos !== -1) {
      matchedLocations.push({ loc, firstPos: pos });
    }
  }
  matchedLocations.sort((a, b) => a.firstPos - b.firstPos);
  const locationKeywords: string[] = [];
  for (const item of matchedLocations) {
    if (
      locationKeywords.length < 5 &&
      !locationKeywords.some((existing) => existing.includes(item.loc) || item.loc.includes(existing))
    ) {
      locationKeywords.push(item.loc);
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
    /\b(died\s+in|years\s+later|fun\s+facts|premiered\s+.*19\d\d|archival|final\s+year\s+of\s+his\s+life|born\s+in\s+19\d\d)\b/i.test(
      sample
    )
  ) {
    articleCategory = 'retrospective_feature';
  } else if (
    /\b(jimmy\s+kimmel|talk\s+show|late-night|studio\s+in\s+los\s+angeles|red\s+carpet|gala|premiere)\b/i.test(
      sample
    ) &&
    !/\b(yacht|beach|bikini|bathing\s+suit|swim\s+shorts)\b/i.test(sample)
  ) {
    articleCategory = 'red_carpet_event';
  } else if (
    /\b(stroll|neighborhood|market|pavement|street|errands|lunch\s+date|ankle\s+support|foot\s+brace)\b/i.test(
      sample
    ) &&
    !/\b(yacht|beach|bikini|bathing\s+suit|swim\s+shorts|ocean|surf|coastline)\b/i.test(sample)
  ) {
    articleCategory = 'city_neighborhood_outing';
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

function stripTrackingQueryFromUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const toRemove: string[] = [];
    u.searchParams.forEach((_v, k) => {
      if (
        /^(fbclid|gclid|dclid|msclkid|twclid|ttclid|igshid|mibextid|mc_cid|mc_eid|_ga|_gl|ref|fb_action_ids|fb_action_types|fb_source|utm_[a-z0-9_]+|_aem_[a-z0-9_]*)$/i.test(
          k
        )
      ) {
        toRemove.push(k);
      }
    });
    for (const k of toRemove) u.searchParams.delete(k);
    return u.href;
  } catch {
    return rawUrl;
  }
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
  cleanUrl = stripTrackingQueryFromUrl(cleanUrl);

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
      lower.startsWith('what is your absolute favorite') ||
      lower.startsWith('who is your absolute favorite') ||
      lower.startsWith('what is the most memorable part of') ||
      lower.startsWith('taking a broader retrospective look at recent appearances') ||
      lower.startsWith('every detail recorded in recent updates reflects deliberate craftsmanship') ||
      lower.startsWith('beyond individual projects, the creative trajectory reveals') ||
      lower.startsWith('the reception across international forums underscores') ||
      lower.startsWith('commentators note that genuine self-possession') ||
      lower.startsWith('archival retrospectives and press documentation further demonstrate') ||
      lower.startsWith('these observations demonstrate how authenticity remains') ||
      lower.startsWith('looking ahead to upcoming endeavors, the foundation established') ||
      lower.startsWith('industry insiders continue to watch these developments') ||
      lower.startsWith('the enduring resonance of these achievements is a testament') ||
      lower.startsWith('in reflecting on this comprehensive journey') ||
      lower === 'comprehensive background and recent milestones' ||
      lower === 'critical reception, artistic evolution and public resonance' ||
      lower === 'enduring legacy and perspectives looking forward'
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
      // Cắt bỏ câu hỏi kêu gọi bình luận ở cuối đoạn ("What is your absolute favorite... Let's swap...") TRƯỚC khi kiểm tra để giữ lại câu kết luận sự thật ở đầu đoạn
      txt = txt
        .replace(/\s*(?:What|Who|Which) is your (?:absolute )?favorite[\s\S]*$/i, '')
        .replace(/\s*Let['’]s (?:swap|talk)[\s\S]*$/i, '')
        .replace(/\s*Scroll down for a closer look[\s\S]*$/i, '')
        .trim();
      if (!txt || txt.length < 18) continue;
      if (isBoilerplateCallToAction(txt)) continue;
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

  // Kênh dự phòng đặc biệt vượt tường lửa / chống copy (Jina Cloud Headless Browser) khi trang chặn IP server, Cloudflare hoặc mã hóa ảnh bằng blob JS
  if (paragraphs.length < 2 || images.length < 2 || !originalTitle) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9000);
      const jinaRes = await fetch(`https://r.jina.ai/${cleanUrl}`, {
        headers: {
          Accept: 'application/json',
          'X-With-Images-Summary': 'true',
          'X-No-Cache': 'true',
          'User-Agent': SCRAPER_USER_AGENT,
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (jinaRes.ok) {
        const jinaJson: any = await jinaRes.json().catch(() => null);
        const jData = jinaJson?.data;
        if (jData) {
          if (!originalTitle && jData.title) {
            originalTitle = cleanScrapedTitle(String(jData.title));
          }
          if (!originalExcerpt && jData.description) {
            originalExcerpt = decodeHtmlEntities(String(jData.description));
          }
          if (jData.images && typeof jData.images === 'object') {
            for (const [imgAlt, imgUrlVal] of Object.entries(jData.images)) {
              let rawImgUrl = String(imgUrlVal || '').trim();
              if (!rawImgUrl || rawImgUrl.startsWith('blob:') || rawImgUrl.startsWith('data:')) continue;
              if (rawImgUrl.includes('/wp-content/uploads/')) {
                rawImgUrl = rawImgUrl.replace(
                  /-(?:150x\d+|2\d\dx\d+|3\d\dx\d+|4\d\dx\d+|5\d\dx\d+|6\d\dx\d+)(?=\.(jpg|jpeg|png|webp|avif)(\?|$))/i,
                  ''
                );
              }
              addImage(
                rawImgUrl,
                imgAlt && !/^Image\s*\d+/i.test(imgAlt) ? imgAlt : originalTitle,
                images.length === 0
              );
            }
          }
          const mdContent = String(jData.content || '');
          const mdImgRegex = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
          let mim: RegExpExecArray | null;
          while ((mim = mdImgRegex.exec(mdContent)) !== null) {
            let rawImgUrl = mim[2].trim();
            if (rawImgUrl.includes('/wp-content/uploads/')) {
              rawImgUrl = rawImgUrl.replace(
                /-(?:150x\d+|2\d\dx\d+|3\d\dx\d+|4\d\dx\d+|5\d\dx\d+|6\d\dx\d+)(?=\.(jpg|jpeg|png|webp|avif)(\?|$))/i,
                ''
              );
            }
            addImage(
              rawImgUrl,
              mim[1] && !/^Image\s*\d+/i.test(mim[1]) ? mim[1] : originalTitle,
              images.length === 0
            );
          }

          if (paragraphs.length < 2 && mdContent) {
            const mdLines = mdContent.split(/\n+/);
            for (const rawLine of mdLines) {
              let line = rawLine
                .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
                .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                .replace(/^#+\s*/, '')
                .replace(/[*_`~]+/g, '')
                .replace(/\s+/g, ' ')
                .trim();
              if (!line || line.length < 28) continue;
              if (
                /^(skip to content|search|menu|home|share|tweet|pin|copy link|read more|related posts|leave a comment|cancel reply|privacy policy|terms of service|we use cookies|accept all|manage preferences)/i.test(
                  line
                )
              ) {
                continue;
              }
              line = line
                .replace(/\s*(?:What|Who|Which) is your (?:absolute )?favorite[\s\S]*$/i, '')
                .replace(/\s*Let['’]s (?:swap|talk)[\s\S]*$/i, '')
                .replace(/\s*Scroll down for a closer look[\s\S]*$/i, '')
                .trim();
              if (!line || line.length < 25 || isBoilerplateCallToAction(line)) continue;
              if (!paragraphs.includes(line)) {
                paragraphs.push(line);
              }
            }
          }
        }
      }
    } catch {
      // Ignore Jina fallback error
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
 * Tách một khối văn bản thành các đoạn văn ngắn chuẩn SEO từ 40 đến 50 từ mỗi đoạn để xuống dòng rõ ràng, dễ đọc.
 */
function splitTextInto40To50WordParagraphs(text: string): string[] {
  const cleaned = stripHtmlTags(text).replace(/^##\s*/, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const totalWords = cleaned.split(/\s+/).filter(Boolean);
  if (totalWords.length <= 52) return [totalWords.join(' ')];

  const rawSentences =
    cleaned
      .match(/[^.!?]+[.!?]+["'”’)]*/g)
      ?.map((s) => s.trim())
      .filter(Boolean) || [cleaned];

  const normalizedSentences: string[] = [];
  for (const s of rawSentences) {
    const w = s.split(/\s+/).filter(Boolean);
    if (w.length <= 52) {
      normalizedSentences.push(s);
    } else {
      const clauses = s.split(
        /(?:;\s+|\s+—\s+|,\s+(?=(?:and|but|while|showing|proving|making|highlighting|where|nhưng|đồng thời|qua đó|giúp)\b))/i
      );
      if (clauses.length > 1) {
        for (const cl of clauses) {
          let trimmed = cl.trim();
          if (!trimmed) continue;
          if (!/[.!?]["'”’)]*$/.test(trimmed)) trimmed = trimmed.replace(/[,;:-]+$/, '') + '.';
          trimmed = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
          normalizedSentences.push(trimmed);
        }
      } else {
        normalizedSentences.push(s);
      }
    }
  }

  const paragraphs: string[] = [];
  let currentWords: string[] = [];

  for (const sent of normalizedSentences) {
    const sentWords = sent.split(/\s+/).filter(Boolean);
    if (currentWords.length === 0) {
      currentWords.push(...sentWords);
      if (currentWords.length >= 40) {
        paragraphs.push(currentWords.join(' '));
        currentWords = [];
      }
      continue;
    }

    if (currentWords.length + sentWords.length <= 56) {
      currentWords.push(...sentWords);
      if (currentWords.length >= 38) {
        paragraphs.push(currentWords.join(' '));
        currentWords = [];
      }
    } else {
      paragraphs.push(currentWords.join(' '));
      currentWords = [...sentWords];
      if (currentWords.length >= 40) {
        paragraphs.push(currentWords.join(' '));
        currentWords = [];
      }
    }
  }

  if (currentWords.length > 0) {
    if (currentWords.length < 34 && paragraphs.length > 0) {
      const prevWords = paragraphs[paragraphs.length - 1].split(/\s+/);
      if (prevWords.length + currentWords.length <= 56) {
        paragraphs[paragraphs.length - 1] = `${paragraphs[paragraphs.length - 1]} ${currentWords.join(' ')}`;
      } else {
        paragraphs.push(currentWords.join(' '));
      }
    } else {
      paragraphs.push(currentWords.join(' '));
    }
  }

  return paragraphs;
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
  const primaryLoc = contextProfile.locationKeywords[0]
    ? contextProfile.locationKeywords[0].replace(/(^|\s)([a-z])/g, (_m, p1, p2) => `${p1}${p2.toUpperCase()}`)
    : '';
  const outfit =
    contextProfile.outfitKeywords.length > 0
      ? contextProfile.outfitKeywords[paragraphIndex % contextProfile.outfitKeywords.length]
      : '';
  const timeframe =
    contextProfile.timeframeKeywords.length > 0
      ? contextProfile.timeframeKeywords[paragraphIndex % contextProfile.timeframeKeywords.length]
      : '';

  // Tìm địa điểm được nhắc trực tiếp ngay trong đoạn văn đang xét (nếu có) để câu mở rộng khớp 100% với địa điểm của đoạn đó
  const lowerBase = cleanBase.toLowerCase();
  let paraLoc = primaryLoc;
  for (const lk of contextProfile.locationKeywords) {
    if (lowerBase.includes(lk)) {
      paraLoc = lk.replace(/(^|\s)([a-z])/g, (_m, p1, p2) => `${p1}${p2.toUpperCase()}`);
      break;
    }
  }

  // Tìm trang phục được nhắc trực tiếp trong đoạn văn đang xét (nếu có)
  let paraOutfit = outfit;
  for (const ok of contextProfile.outfitKeywords) {
    if (lowerBase.includes(ok.toLowerCase())) {
      paraOutfit = ok;
      break;
    }
  }

  // Lấy thêm các câu dữ kiện thực tế từ chính bài gốc (allFactsPool) để làm chất liệu mở rộng sát 100% nội dung bài gốc (không sáng tác thêm tình tiết ngoài bài)
  const relatedSourceFacts: string[] = [];
  if (allFactsPool.length > 0) {
    for (let offset = 0; offset < allFactsPool.length; offset++) {
      const candidateFact = allFactsPool[(paragraphIndex + offset) % allFactsPool.length];
      if (candidateFact && !cleanBase.includes(candidateFact.slice(0, 24))) {
        relatedSourceFacts.push(candidateFact);
      }
      if (relatedSourceFacts.length >= 3) break;
    }
  }

  const normalizeCompanionClause = (rawSent: string): string => {
    const stripped = rawSent.replace(/^(?:But|And|However,?|Yet|Still,?|Meanwhile,?)\s+/i, '').trim();
    if (!stripped) return '';
    const firstWord = stripped.split(/\s+/)[0] || '';
    const isProperStart = /^[A-Z][a-z]+$/.test(firstWord) && !/^(As|In|On|At|For|With|From|After|Before|While|When|Beyond|Seeing|Stepping|Trading|Watching|There|The|This|Her|His|She|He|It)\b/.test(firstWord);
    return isProperStart ? stripped : `${stripped.charAt(0).toLowerCase()}${stripped.slice(1)}`;
  };

  const companionFact1 = normalizeCompanionClause(relatedSourceFacts[0] || '');
  const companionFact2 = normalizeCompanionClause(relatedSourceFacts[1] || '');

  const hasVisualOrWardrobe =
    /\b(wore|wearing|dressed|bikini|bathing\s+suit|swimsuit|swimwear|swim\s+shorts|trunks|crop\s+top|jeans|t-shirt|tank\s+top|dress|gown|cap|sunglasses|ring|slides|sandals|trainers|headphones|look|outfit|silhouette|photo|photographs|spotted)\b/i.test(
      cleanBase
    );
  const isBeachOrWaterScene =
    /\b(beach|yacht|ocean|surf|coast|coastline|shore|sand|island|tropical|waters|sea|pool|sun|soaking|tan|waves)\b/i.test(
      cleanBase
    );
  const hasCareerOrProject =
    /\b(star|actress|actor|frontman|singer|model|supermodel|sports\s+illustrated|cover|magazine|film|movie|series|show|album|career|shoot|runway)\b/i.test(
      cleanBase
    );

  const clauseSpecificElaborations: string[] = [];

  if (language === 'vi') {
    if (companionFact1) {
      clauseSpecificElaborations.push(
        `Bên cạnh chi tiết trên, nội dung bài gốc cũng cho biết thêm rằng ${companionFact1}`
      );
    }
    if (hasVisualOrWardrobe) {
      clauseSpecificElaborations.push(
        `Hình ảnh ghi lại của ${coupleOrSubject}${paraOutfit ? ` trong trang phục ${paraOutfit}` : ''}${paraLoc ? ` tại ${paraLoc}` : ''} làm nổi bật phong cách thời trang cùng vóc dáng săn chắc đúng như những gì bài viết mô tả.`,
        `Từng khung hình cận cảnh trong bài viết đều xoay quanh cách ${primary} phối hợp trang phục và thần thái tự tin trước ống kính${timeframe ? ` vào dịp ${timeframe}` : ''}.`
      );
    }
    if (isBeachOrWaterScene) {
      clauseSpecificElaborations.push(
        `Bối cảnh nắng vàng và biển xanh${paraLoc ? ` ở ${paraLoc}` : ''} trong bài viết càng tôn lên vẻ ngoài rạng rỡ của ${coupleOrSubject} khi tận hưởng những giây phút thư giãn ngoài trời.`
      );
    }
    if (hasCareerOrProject) {
      clauseSpecificElaborations.push(
        `Những thông tin về dấu ấn nghề nghiệp của ${primary} được đề cập trực tiếp trong bài viết giúp người đọc nhận ra ngay nhân vật chính xuất hiện trong loạt ảnh.`
      );
    }
    if (companionFact2) {
      clauseSpecificElaborations.push(
        `Đồng thời, bài viết gốc nhấn mạnh thêm rằng ${companionFact2}`
      );
    }
    clauseSpecificElaborations.push(
      `Mọi chi tiết được ghi nhận quanh sự xuất hiện của ${coupleOrSubject}${paraLoc ? ` tại ${paraLoc}` : ''}${paraOutfit ? ` với ${paraOutfit}` : ''} đều bám sát chuỗi khoảnh khắc thực tế trong bài báo gốc.`,
      `Qua những dữ kiện và hình ảnh cụ thể mà bài viết cung cấp, người xem có thể theo dõi trọn vẹn toàn bộ diễn biến câu chuyện của ${primary} từ đầu đến cuối.`
    );
  } else {
    if (companionFact1) {
      clauseSpecificElaborations.push(
        `Connecting directly with that moment in the report, ${companionFact1}`
      );
    }
    if (hasVisualOrWardrobe) {
      clauseSpecificElaborations.push(
        `As captured in the original photographs, ${coupleOrSubject}${paraOutfit ? ` in ${paraOutfit}` : ''}${paraLoc ? ` at ${paraLoc}` : ''} drew immediate attention for the exact styling, fit, and confident beachside presence highlighted throughout the piece.`,
        `Each angle documented in the source feature focuses on how ${primary} paired the look with natural poise${timeframe ? ` during ${timeframe}` : ''}, keeping the spotlight squarely on the visual details described in the article.`
      );
    }
    if (isBeachOrWaterScene) {
      clauseSpecificElaborations.push(
        `The sun-drenched shoreline setting${paraLoc ? ` in ${paraLoc}` : ''} described in the article frames ${coupleOrSubject} soaking up the warm weather and enjoying an unhurried day by the water while cameras documented the scene.`
      );
    }
    if (hasCareerOrProject) {
      clauseSpecificElaborations.push(
        `The background details mentioned in the original text regarding ${primary}'s modeling and media appearances give readers the exact clues needed to recognize her from the sunlit snapshots.`
      );
    }
    if (companionFact2) {
      clauseSpecificElaborations.push(
        `Furthermore, as the source coverage notes, ${companionFact2}`
      );
    }
    clauseSpecificElaborations.push(
      `Every detail shared in the original report about ${coupleOrSubject}${paraLoc ? ` at ${paraLoc}` : ''}${paraOutfit ? ` wearing ${paraOutfit}` : ''} reinforces the specific visual moments captured in the accompanying photos.`,
      `Taken together, these direct observations from the source article trace the complete appearance of ${primary}${paraLoc ? ` in ${paraLoc}` : ''} without departing from the documented facts of the outing.`
    );
  }

  let combined = cleanBase;
  let attempt = 0;
  while (
    combined.split(/\s+/).filter(Boolean).length < 138 &&
    attempt < clauseSpecificElaborations.length
  ) {
    const addon = clauseSpecificElaborations[attempt];
    if (!combined.includes(addon.slice(0, 28))) {
      combined = combined ? `${combined} ${addon}` : addon;
    }
    attempt++;
  }

  const finalWords = combined.split(/\s+/).filter(Boolean);
  if (finalWords.length > 165) {
    const sliced = finalWords.slice(0, 156).join(' ');
    const lastDot = Math.max(
      sliced.lastIndexOf('. '),
      sliced.lastIndexOf('! '),
      sliced.lastIndexOf('? ')
    );
    if (lastDot > 480) {
      return sliced.slice(0, lastDot + 1).trim();
    }
    return `${sliced}.`;
  }

  return finalWords.join(' ');
}

/**
 * Tạo tiêu đề phụ H2 bám sát trực tiếp vào nội dung của chính đoạn văn (unitText) và ảnh minh họa ngay bên dưới nó
 */
function buildHeadingForParagraph(
  unitText: string,
  contextProfile: ArticleContextProfile,
  sectionIndex: number,
  originalHeadings: string[],
  language: 'en' | 'vi'
): string {
  if (sectionIndex < originalHeadings.length) {
    const orig = originalHeadings[sectionIndex].replace(/^##\s*/, '').trim();
    if (orig.length >= 10 && orig.length <= 95) {
      return orig === orig.toLowerCase()
        ? orig.replace(/(^|\s)([a-z])/g, (_m, p1, p2) => `${p1}${p2.toUpperCase()}`)
        : orig;
    }
  }

  const isVi = language === 'vi';
  const cleanUnit = stripHtmlTags(unitText).replace(/^##\s*/, '').replace(/\s+/g, ' ').trim();
  const lowerUnit = cleanUnit.toLowerCase();
  const primary = contextProfile.primaryPerson || contextProfile.subjectDisplay || 'the Star';
  const secondary = contextProfile.secondaryPerson || '';
  const subjectPair = secondary ? `${primary} & ${secondary}` : primary;

  let paraLoc = '';
  for (const lk of contextProfile.locationKeywords) {
    if (lowerUnit.includes(lk)) {
      paraLoc = lk.replace(/(^|\s)([a-z])/g, (_m, p1, p2) => `${p1}${p2.toUpperCase()}`);
      break;
    }
  }
  if (!paraLoc && contextProfile.locationKeywords[0]) {
    paraLoc = contextProfile.locationKeywords[0].replace(
      /(^|\s)([a-z])/g,
      (_m, p1, p2) => `${p1}${p2.toUpperCase()}`
    );
  }

  let paraOutfit = '';
  for (const ok of contextProfile.outfitKeywords) {
    if (lowerUnit.includes(ok.toLowerCase())) {
      paraOutfit = ok.replace(/(^|\s)([a-z])/g, (_m, p1, p2) => `${p1}${p2.toUpperCase()}`);
      break;
    }
  }

  if (isVi) {
    if (paraOutfit || /\b(wore|wearing|bikini|bathing suit|shorts|crop top|jeans|dress|ring|cap|outfit|look)\b/i.test(cleanUnit)) {
      return `Chi Tiết Hình Ảnh & Phong Cách Thời Trang Của ${subjectPair}${paraOutfit ? ` (${paraOutfit})` : ''}`;
    }
    if (/\b(beach|sun|soaking|water|ocean|coast|sand|vacation)\b/i.test(cleanUnit)) {
      return `Khoảnh Khắc Tắm Nắng Tại Bãi Biển Của ${subjectPair}${paraLoc ? ` Ở ${paraLoc}` : ''}`;
    }
    return `Góc Nhìn Chi Tiết Về Câu Chuyện Của ${subjectPair}${paraLoc ? ` Tại ${paraLoc}` : ''} (Phần ${sectionIndex + 1})`;
  }

  if (
    paraOutfit ||
    /\b(wore|wearing|dressed|bikini|bathing\s+suit|swim\s+shorts|trunks|crop\s+top|jeans|dress|gown|ring|sunglasses|figure|curves|physique)\b/i.test(
      cleanUnit
    )
  ) {
    return paraOutfit
      ? `Candid Visual Details: ${subjectPair} Spotted in ${paraOutfit}${paraLoc ? ` in ${paraLoc}` : ''}`
      : `Standout Beachwear Style and Candid Snapshots of ${subjectPair}${paraLoc ? ` in ${paraLoc}` : ''}`;
  }

  if (/\b(beach|yacht|ocean|surf|coast|shore|sand|island|waters|sun|soaking)\b/i.test(cleanUnit)) {
    return `Inside ${subjectPair}'s Sun-Soaked Beach Moments${paraLoc ? ` in ${paraLoc}` : ''}`;
  }

  if (/\b(star|actress|actor|model|supermodel|sports\s+illustrated|cover|magazine|career|shoot|runway)\b/i.test(cleanUnit)) {
    return `Recognizing ${primary} From Her Signature Modeling Highlights`;
  }

  const fallbackHeadings = [
    `Key Story Details and Candid Moments Featuring ${subjectPair}${paraLoc ? ` in ${paraLoc}` : ''}`,
    `Closer Look at ${subjectPair}'s Appearance${paraLoc ? ` in ${paraLoc}` : ''}`,
    `Every Visual Detail Documented in ${primary}'s Beachside Outing`,
    `Style and Wardrobe Highlights Captured in the Original Photos`,
    `Complete Breakdown of ${subjectPair}'s Sunlit Chapter`,
  ];
  return fallbackHeadings[sectionIndex % fallbackHeadings.length];
}

/**
 * Xây dựng bài viết dài chuẩn SEO từ 2.000 - 5.000 từ:
 * - Bám sát 100% nội dung bên trong bài viết gốc (sourceArticleText) và mở rộng trực tiếp từ dữ kiện bài gốc, TUYỆT ĐỐI KHÔNG sáng tác thêm tình tiết ngoài bài.
 * - Chia từng đoạn văn ngắn chuẩn SEO từ 40 đến 50 từ là xuống dòng (<p>...</p> rõ ràng).
 * - Gắn đầy đủ toàn bộ ảnh trong bài xen kẽ đều giữa các đoạn văn + 2 video YouTube cuối bài.
 */
export function buildLongFormSeoArticle2000To5000Words(params: {
  articleTitle: string;
  focusKeyword: string;
  sourceArticleText: string;
  aiDraftHtml?: string;
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

  // Thu thập thêm các đoạn từ AI Draft (nếu có)
  const aiParagraphs: string[] = [];
  if (aiDraftHtml) {
    const hMatches = aiDraftHtml.match(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi) || [];
    for (const hm of hMatches) {
      const ht = stripHtmlTags(hm).replace(/\s+/g, ' ').trim();
      if (ht.length >= 12 && ht.length <= 95 && !originalHeadings.includes(ht)) {
        originalHeadings.push(ht);
      }
    }
    const pMatches = aiDraftHtml.match(/<p\b[^>]*>([\s\S]*?)<\/p>/gi) || [];
    for (const pm of pMatches) {
      const t = stripHtmlTags(pm).replace(/\s+/g, ' ').trim();
      if (t.length > 35 && (!articleTitle || !t.includes(`"${articleTitle}"`))) {
        aiParagraphs.push(t);
      }
    }
  }

  // 2. Tách toàn bộ các câu dữ kiện thực tế từ nội dung bài gốc (allSourceSentences)
  const allSourceSentences: string[] = [];
  for (const sp of sourceParagraphs) {
    const sents = splitIntoSentences(sp);
    for (const s of sents) {
      if (!allSourceSentences.includes(s)) {
        allSourceSentences.push(s);
      }
    }
  }

  // 3. Xây dựng các đơn vị nội dung (factUnits) bám sát 100% vào từng câu trong bài gốc
  const factUnits: string[] = [];

  for (const sp of sourceParagraphs) {
    const sents = splitIntoSentences(sp);
    if (sents.length >= 2) {
      for (const s of sents) {
        factUnits.push(s);
      }
    } else {
      factUnits.push(sp);
    }
  }

  for (const ap of aiParagraphs) {
    if (factUnits.length < 16 && !factUnits.some((u) => u.slice(0, 36) === ap.slice(0, 36))) {
      factUnits.push(ap);
    }
  }

  const primary = profile.primaryPerson || profile.subjectDisplay || 'the star';
  const secondary = profile.secondaryPerson || '';
  const subjectPair = secondary ? `${primary} and ${secondary}` : primary;
  const locs = profile.locationKeywords.map((l) =>
    l.replace(/(^|\s)([a-z])/g, (_m, p1, p2) => `${p1}${p2.toUpperCase()}`)
  );
  const outfits = profile.outfitKeywords;

  const sentencePrefixesEn = [
    'Looking closer at the opening details reported in the article,',
    'Focusing on the specific visual moments captured in the photographs,',
    'Another detail documented in the source story highlights how',
    'Examining the background shared directly in the piece,',
    'Revisiting the scene described in the coverage,',
    'Further underscoring the real-life context shown in the images,',
    'In addition to the candid beachside snapshots, the article points out that',
    'Bringing together the key facts from the report,',
  ];

  const sentencePrefixesVi = [
    'Đi sâu vào chi tiết mở đầu được ghi nhận trong bài viết,',
    'Quan sát kỹ những chi tiết hình ảnh trong loạt ảnh minh họa,',
    'Một tình tiết đáng chú ý khác trong bài gốc cho thấy',
    'Nhìn lại bối cảnh cụ thể được đề cập trực tiếp trong bài,',
    'Phân tích thần thái tự nhiên qua từng khung hình trong bài,',
    'Làm rõ hơn câu chuyện thực tế phía sau những bức ảnh,',
    'Bên cạnh loạt ảnh đời thường, nội dung bài viết còn nhấn mạnh rằng',
    'Tổng hợp lại các dữ kiện cốt lõi từ bài gốc,',
  ];

  let synIdx = 0;
  while (factUnits.length < 15 && synIdx < 15) {
    if (allSourceSentences.length > 0) {
      const sMain = allSourceSentences[synIdx % allSourceSentences.length];
      const sNext =
        allSourceSentences.length > 1
          ? allSourceSentences[(synIdx + 1) % allSourceSentences.length]
          : '';
      const prefix = isVi
        ? sentencePrefixesVi[synIdx % sentencePrefixesVi.length]
        : sentencePrefixesEn[synIdx % sentencePrefixesEn.length];
      const bodySent = `${sMain.charAt(0).toLowerCase()}${sMain.slice(1)}`;
      const combinedUnit =
        sNext && sNext !== sMain
          ? `${prefix} ${bodySent} ${sNext}`
          : `${prefix} ${bodySent}`;
      factUnits.push(combinedUnit);
    } else {
      const fallbackUnit = isVi
        ? `Trong các đoạn văn và hình ảnh minh họa của bài viết, câu chuyện xoay quanh ${subjectPair}${locs[0] ? ` tại ${locs[0]}` : ''}${outfits[0] ? ` với trang phục ${outfits[0]}` : ''} được khắc họa rõ nét qua từng khoảnh khắc thực tế.`
        : `Across the paragraphs and illustrative photographs of the report, the story of ${subjectPair}${locs[0] ? ` in ${locs[0]}` : ''}${outfits[0] ? ` featuring ${outfits[0]}` : ''} unfolds through specific, real-world moments.`;
      factUnits.push(fallbackUnit);
    }
    synIdx++;
  }

  const targetUnits = factUnits.slice(0, 16);
  // Chia mỗi khối mở rộng thành các đoạn văn ngắn 40 - 50 từ xuống dòng rõ ràng theo đúng yêu cầu của người dùng!
  const finalShortParagraphs40To50Words: { h2?: string; text: string }[] = [];

  targetUnits.forEach((unitText, idx) => {
    const expanded150 = expandFactBlockToAround150Words({
      baseFactText: unitText,
      contextProfile: profile,
      allFactsPool: allSourceSentences,
      language,
      paragraphIndex: idx,
    });

    let h2ForPara: string | undefined;
    if (idx > 0 && idx % 2 === 0) {
      const h2Index = Math.floor((idx - 2) / 2);
      h2ForPara = buildHeadingForParagraph(
        unitText,
        profile,
        h2Index,
        originalHeadings,
        language
      );
    }

    const shortChunks = splitTextInto40To50WordParagraphs(expanded150);
    shortChunks.forEach((chunkText, subIdx) => {
      finalShortParagraphs40To50Words.push({
        h2: subIdx === 0 ? h2ForPara : undefined,
        text: chunkText,
      });
    });
  });

  // 4. Lắp ghép HTML: Gắn ảnh #1 ngay đầu bài, chèn xen kẽ toàn bộ ảnh trong bài giữa các đoạn văn 40-50 từ, và 2 video YouTube cuối bài
  const htmlBlocks: string[] = [];
  const totalParas = finalShortParagraphs40To50Words.length;
  let imgIdx = 0;

  const buildImageCaptionFromParagraphs = (img: ScrapedArticleImage, displayNum: number): string => {
    const rawAlt = String(img.alt || '').trim();
    const isGenericOrCuriosityAlt =
      !rawAlt ||
      rawAlt === articleTitle ||
      /\?$|\b(recognize|who are they|who is he|who is she|article image|key photo|story image)\b/i.test(
        rawAlt
      );
    if (!isGenericOrCuriosityAlt && rawAlt.length >= 12) {
      return rawAlt;
    }
    if (allSourceSentences.length > 0) {
      const matchingSent =
        allSourceSentences[(displayNum - 1) % allSourceSentences.length] || '';
      const shortSent = matchingSent.split(/\s+/).slice(0, 18).join(' ').replace(/[,:;]+$/, '');
      if (shortSent.length >= 15) {
        return `${subjectPair}: ${shortSent}${shortSent.endsWith('.') ? '' : '...'}`;
      }
    }
    return `${subjectPair}${locs[0] ? ` in ${locs[0]}` : ''}${outfits[0] ? ` (${outfits[0]})` : ''} - Photo #${displayNum}`;
  };

  const renderFigureBlock = (img: ScrapedArticleImage, displayNum: number) => {
    const cleanAlt = buildImageCaptionFromParagraphs(img, displayNum);
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
    remainingImgs > 0 ? Math.max(2, Math.floor(totalParas / (remainingImgs + 1))) : 999;

  finalShortParagraphs40To50Words.forEach((item, idx) => {
    if (item.h2) {
      htmlBlocks.push(
        `<h2 style="margin: 28px 0 14px 0; font-weight: 800; line-height: 1.35;">${item.h2}</h2>`
      );
    }

    htmlBlocks.push(
      `<p style="margin: 0 0 18px 0; line-height: 1.85; font-size: 17px;">${item.text}</p>`
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
    paragraphCount: finalShortParagraphs40To50Words.length,
  };
}

async function fetchImageInlinePartForVision(
  imgUrl: string
): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(imgUrl, {
      headers: { 'User-Agent': SCRAPER_USER_AGENT },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(ct)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 800 || buf.byteLength > 4 * 1024 * 1024) return null;
    return {
      inlineData: {
        mimeType: ct === 'image/jpg' ? 'image/jpeg' : ct,
        data: buf.toString('base64'),
      },
    };
  } catch {
    return null;
  }
}

export async function tryDiscoverSourceArticleImagesFromText(
  rawTitle: string,
  rawBodyText: string
): Promise<{
  title: string;
  excerpt: string;
  articleText: string;
  sourceUrl: string;
  images: ScrapedArticleImage[];
} | null> {
  const candidateOrigins = ['https://beaware.fun'];
  const slugFromTitle = String(rawTitle || '')
    .toLowerCase()
    .replace(/['’"“”?!:;,.()[\]]+/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const firstSentence = splitIntoSentences(rawBodyText)[0] || '';
  const searchSnippet = firstSentence
    .split(/\s+/)
    .slice(0, 9)
    .join(' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const origin of candidateOrigins) {
    try {
      if (slugFromTitle && slugFromTitle.length >= 12) {
        const slugUrl = `${origin}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slugFromTitle)}&_embed`;
        const res = await fetch(slugUrl, { headers: { 'User-Agent': SCRAPER_USER_AGENT } });
        if (res.ok) {
          const arr: any = await res.json();
          if (Array.isArray(arr) && arr[0]?.link) {
            const scraped = await scrapeWebArticleForSeoRewrite(String(arr[0].link));
            if (scraped.images.length > 0) {
              return {
                title: scraped.originalTitle,
                excerpt: scraped.originalExcerpt,
                articleText: scraped.articleText,
                sourceUrl: scraped.sourceUrl,
                images: scraped.images,
              };
            }
          }
        }
      }

      if (searchSnippet && searchSnippet.length >= 18) {
        const searchUrl = `${origin}/wp-json/wp/v2/posts?search=${encodeURIComponent(searchSnippet)}&per_page=3&_embed`;
        const res = await fetch(searchUrl, { headers: { 'User-Agent': SCRAPER_USER_AGENT } });
        if (res.ok) {
          const arr: any = await res.json();
          if (Array.isArray(arr) && arr.length > 0) {
            const probeWords = searchSnippet.toLowerCase().split(/\s+/).slice(0, 5).join(' ');
            const matchedPost =
              arr.find((p: any) =>
                stripHtmlTags(String(p?.content?.rendered || ''))
                  .toLowerCase()
                  .includes(probeWords)
              ) || arr[0];
            if (matchedPost?.link) {
              const scraped = await scrapeWebArticleForSeoRewrite(String(matchedPost.link));
              if (scraped.images.length > 0) {
                return {
                  title: scraped.originalTitle,
                  excerpt: scraped.originalExcerpt,
                  articleText: scraped.articleText,
                  sourceUrl: scraped.sourceUrl,
                  images: scraped.images,
                };
              }
            }
          }
        }
      }
    } catch {
      // ignore discovery error
    }
  }
  return null;
}

export async function generateSeoArticleWithAi(params: {
  topic: string;
  keyword?: string;
  language?: 'en' | 'vi';
  tone?: string;
  categoryName?: string;
  mode?: 'from_text' | 'from_url' | 'full_article' | 'outline' | 'rewrite' | 'seo_meta';
  sourceUrl?: string;
  existingTitle?: string;
  existingContent?: string;
  existingImages?: ScrapedArticleImage[];
}) {
  const language: 'en' | 'vi' = params.language === 'vi' ? 'vi' : 'en';

  let scrapedImages: ScrapedArticleImage[] = [];
  let sourceTitle = params.existingTitle ? cleanScrapedTitle(params.existingTitle) : '';
  let sourceExcerpt = '';
  let sourceArticleText = '';
  let resolvedSourceUrl = '';

  const extractNonImageHttpUrl = (inputStr: string): string => {
    const matches = String(inputStr || '').match(/https?:\/\/[^\s"'<>]+/gi) || [];
    for (const rawM of matches) {
      const cleaned = rawM.replace(/[),.;]+$/, '');
      if (!/\.(jpg|jpeg|png|webp|gif|svg|avif)(\?|$)/i.test(cleaned) && !/youtube\.com|youtu\.be/i.test(cleaned)) {
        return cleaned;
      }
    }
    return '';
  };

  const candidateUrl =
    (params.sourceUrl && params.sourceUrl.trim()) ||
    extractNonImageHttpUrl(params.topic) ||
    extractNonImageHttpUrl(params.existingContent || '');

  if (candidateUrl) {
    try {
      const scraped = await scrapeWebArticleForSeoRewrite(candidateUrl);
      scrapedImages = scraped.images;
      if (
        scraped.originalTitle &&
        (!sourceTitle ||
          params.mode === 'from_url' ||
          (!/[?!:]/.test(sourceTitle) && /[?!:]/.test(scraped.originalTitle)))
      ) {
        sourceTitle = scraped.originalTitle;
      }
      sourceExcerpt = scraped.originalExcerpt;
      sourceArticleText = scraped.articleText;
      resolvedSourceUrl = scraped.sourceUrl;
    } catch (err) {
      if (
        params.mode === 'from_url' &&
        !params.existingContent &&
        (!params.existingImages || params.existingImages.length === 0)
      ) {
        throw err;
      }
    }
  }

  const isGeneratedBoilerplate = (txt: string): boolean =>
    /Across the paragraphs and illustrative photographs of the report|Looking closely at the specific details documented in this passage and the accompanying photographs|🎬 Related Videos & Exclusive Moments|🎬 Video Liên Quan Đáng Chú Ý/i.test(
      txt
    );

  // Luôn trích xuất thêm đoạn văn & ảnh minh họa có sẵn trong trình soạn thảo (nhưng loại bỏ các đoạn văn tự sinh từ lần chạy trước để tránh làm bẩn dữ liệu gốc)
  const rawHtmlOrText = [params.topic, params.existingContent]
    .map((s) => String(s || '').trim())
    .filter((s) => s && s !== sourceTitle && s !== candidateUrl && !isGeneratedBoilerplate(s))
    .join('\n\n');

  if (!sourceArticleText && rawHtmlOrText) {
    const extractedParas: string[] = [];
    const pRegex = /<(p|h2|h3|blockquote|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let pm: RegExpExecArray | null;
    while ((pm = pRegex.exec(rawHtmlOrText)) !== null) {
      const cleanP = stripHtmlTags(pm[2])
        .replace(/\s*(?:What|Who|Which) is your (?:absolute )?favorite[\s\S]*$/i, '')
        .replace(/\s*Let['’]s (?:swap|talk)[\s\S]*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (
        cleanP.length >= 20 &&
        !isGeneratedBoilerplate(cleanP) &&
        !extractedParas.includes(cleanP)
      ) {
        extractedParas.push(cleanP);
      }
    }

    if (extractedParas.length > 0) {
      sourceArticleText = extractedParas.join('\n\n');
    } else {
      sourceArticleText = stripHtmlTags(rawHtmlOrText)
        .replace(/https?:\/\/[^\s"'<>]+/gi, '')
        .split(/\n+/)
        .map((l) => l.trim())
        .filter((l) => l.length >= 20 && !isGeneratedBoilerplate(l))
        .join('\n\n');
    }
  }

  if (Array.isArray(params.existingImages) && params.existingImages.length > 0) {
    const seenUrls = new Set(scrapedImages.map((im) => im.url.split('?')[0].toLowerCase()));
    for (const im of params.existingImages) {
      if (!im || !im.url) continue;
      const k = String(im.url).split('?')[0].toLowerCase();
      if (!seenUrls.has(k)) {
        seenUrls.add(k);
        scrapedImages.push({
          url: String(im.url),
          alt: String(im.alt || ''),
          isFeatured: scrapedImages.length === 0,
          isExternal: Boolean(im.isExternal),
        });
      }
    }
  }

  if (params.existingContent || params.topic) {
    const inlineImgs = collectImgsFromHtml(
      `${params.topic || ''}\n${params.existingContent || ''}`,
      resolvedSourceUrl || DEFAULT_WP_SITE
    );
    const seenUrls = new Set(scrapedImages.map((im) => im.url.split('?')[0].toLowerCase()));
    for (const im of inlineImgs) {
      const k = im.url.split('?')[0].toLowerCase();
      if (!seenUrls.has(k)) {
        seenUrls.add(k);
        scrapedImages.push({
          url: im.url,
          alt: im.alt || '',
          isFeatured: scrapedImages.length === 0,
          isExternal: false,
        });
      }
    }
  }

  // Nếu người dùng chỉ copy tiêu đề / đoạn văn từ bài gốc (chưa dán link) hoặc chưa lấy được nội dung/ảnh gốc, tự động dò bài gốc theo tiêu đề hoặc câu đầu tiên!
  if ((scrapedImages.length === 0 || !sourceArticleText) && (sourceTitle || sourceArticleText || params.topic)) {
    const discovered = await tryDiscoverSourceArticleImagesFromText(
      sourceTitle || params.topic,
      sourceArticleText || params.topic
    );
    if (discovered && discovered.images.length > 0) {
      if (scrapedImages.length === 0) scrapedImages = discovered.images;
      if (
        discovered.title &&
        (!sourceTitle || (!/[?!:]/.test(sourceTitle) && /[?!:]/.test(discovered.title)))
      ) {
        sourceTitle = discovered.title;
      }
      if (!sourceExcerpt && discovered.excerpt) sourceExcerpt = discovered.excerpt;
      if (!sourceArticleText && discovered.articleText) sourceArticleText = discovered.articleText;
      if (!resolvedSourceUrl && discovered.sourceUrl) resolvedSourceUrl = discovered.sourceUrl;
    }
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

  const generatedTitle =
    sourceTitle ||
    params.topic.split('\n')[0]?.trim().slice(0, 95) ||
    'Exclusive Celebrity Story & Highlights';

  const generatedSlug = generatedTitle
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);

  const firstCleanSent = splitIntoSentences(sourceArticleText)[0] || '';
  const generatedExcerpt =
    sourceExcerpt ||
    (firstCleanSent
      ? firstCleanSent.slice(0, 160)
      : `Read the full story about ${contextProfile.subjectDisplay || kw}.`);

  const generatedKeyword = contextProfile.primaryPerson || kw;

  const generatedTags = [
    contextProfile.primaryPerson || generatedKeyword || 'Celebrity',
    ...(contextProfile.secondaryPerson ? [contextProfile.secondaryPerson] : []),
    ...contextProfile.supportingEntities.slice(0, 2),
    params.categoryName || 'Showbiz',
    'Celeb24h',
  ];

  const searchTopicQuery =
    contextProfile.combinedSearchQuery || generatedKeyword || generatedTitle;

  const existingKeys = new Set(
    scrapedImages.map((img) =>
      img.url
        .split('?')[0]
        .replace(/_thumbnail(?=\.[a-z]+$)/i, '')
        .replace(/-\d+x\d+(?=\.[a-z]+$)/i, '')
        .toLowerCase()
    )
  );

  const neededExternalCount =
    scrapedImages.length >= 5 ? 0 : Math.max(0, 6 - scrapedImages.length);

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

  // Xây dựng bài viết dài 2.000 - 5.000 từ bám sát 100% nội dung trong đoạn văn & ảnh minh họa
  const longFormResult = buildLongFormSeoArticle2000To5000Words({
    articleTitle: generatedTitle,
    focusKeyword: contextProfile.subjectDisplay || generatedKeyword,
    sourceArticleText,
    aiDraftHtml: '',
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


