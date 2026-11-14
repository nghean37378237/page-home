import { GoogleGenAI, Type } from '@google/genai';
import {
  scrapeWebArticleForSeoRewrite,
  searchExternalRelatedImages,
  analyzeArticleSubjectAndContext,
  tryDiscoverSourceArticleImagesFromText,
  WpCategoryItem,
  WpRemotePostItem,
  WP_EMPLOYEE_AUTHOR_MAP,
} from './wpPublishService';

const DEFAULT_MOVIES_SITE = (process.env.MOVIESHD4K_SITE_URL || 'https://movieshd4k.com').replace(/\/+$/, '');
const DEFAULT_MOVIES_LOGIN_URL =
  (process.env.MOVIESHD4K_LOGIN_URL || `${DEFAULT_MOVIES_SITE}/nghean3737`).replace(/\/+$/, '');
const DEFAULT_MOVIES_USER = process.env.MOVIESHD4K_USERNAME || 'admin';
const DEFAULT_MOVIES_PASS = process.env.MOVIESHD4K_PASSWORD || 'Biencualo8282$$';

const STORY_AI_MODEL = 'gemini-4-hydrogen'; // Free-tier Gemini model

interface MoviesWpAuthSession {
  cookieHeader: string;
  restNonce: string;
  restRoot: string;
  expiresAt: number;
}

let cachedMoviesSession: MoviesWpAuthSession | null = null;

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
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugifyStory(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 85);
}

function createFreeGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function attemptWpCookieLogin(
  loginEndpoint: string,
  siteUrl: string,
  username: string,
  password: string
): Promise<string> {
  // Step 1: GET login page to collect initial cookies (e.g. wordpress_test_cookie)
  let seedCookie = 'wordpress_test_cookie=WP%20Cookie%20check';
  let formActionUrl = loginEndpoint;
  try {
    const preRes = await fetch(loginEndpoint, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36',
      },
      redirect: 'manual',
    });
    const preCookies = preRes.headers.getSetCookie ? preRes.headers.getSetCookie() : [];
    const prePairs = preCookies.map((c) => c.split(';')[0]).filter(Boolean);
    if (prePairs.length > 0) {
      seedCookie = prePairs.join('; ');
    }
    if (preRes.ok) {
      const preHtml = await preRes.text();
      const actionMatch = preHtml.match(/<form[^>]*name=["']loginform["'][^>]*action=["']([^"']+)["']/i);
      if (actionMatch && actionMatch[1]) {
        formActionUrl = actionMatch[1];
      }
    }
  } catch {
    // Use defaults
  }

  const body = new URLSearchParams({
    log: username,
    pwd: password,
    rememberme: 'forever',
    'wp-submit': 'Log In',
    redirect_to: `${siteUrl}/wp-admin/`,
    testcookie: '1',
  });

  const loginRes = await fetch(formActionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: seedCookie,
      Origin: siteUrl,
      Referer: loginEndpoint,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36',
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

  return cookieHeader;
}

export async function getMoviesHd4kSession(forceRefresh = false): Promise<MoviesWpAuthSession> {
  if (!forceRefresh && cachedMoviesSession && cachedMoviesSession.expiresAt > Date.now()) {
    return cachedMoviesSession;
  }

  const candidates = [DEFAULT_MOVIES_LOGIN_URL, `${DEFAULT_MOVIES_SITE}/wp-login.php`];
  let cookieHeader = '';
  for (const endpoint of candidates) {
    cookieHeader = await attemptWpCookieLogin(
      endpoint,
      DEFAULT_MOVIES_SITE,
      DEFAULT_MOVIES_USER,
      DEFAULT_MOVIES_PASS
    );
    if (cookieHeader.includes('wordpress_logged_in_')) {
      break;
    }
  }

  if (!cookieHeader.includes('wordpress_logged_in_')) {
    throw new Error(
      `Không thể đăng nhập vào WordPress ${DEFAULT_MOVIES_SITE} (cổng ${DEFAULT_MOVIES_LOGIN_URL}). Kiểm tra lại tài khoản hoặc bật Application Password trong Cài đặt.`
    );
  }

  const postNewRes = await fetch(`${DEFAULT_MOVIES_SITE}/wp-admin/post-new.php`, {
    headers: {
      Cookie: cookieHeader,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36',
    },
  });
  const html = await postNewRes.text();
  let restNonce = '';
  let restRoot = `${DEFAULT_MOVIES_SITE}/wp-json/`;

  const nonceMatch = html.match(/wpApiSettings\s*=\s*(\{[^;]+\})/);
  if (nonceMatch && nonceMatch[1]) {
    try {
      const parsed = JSON.parse(nonceMatch[1]);
      restNonce = parsed.nonce || '';
      restRoot = parsed.root || restRoot;
    } catch {
      const rMatch = html.match(/"nonce":"([^"]+)"/);
      if (rMatch) restNonce = rMatch[1];
    }
  } else {
    const rMatch = html.match(/"nonce":"([^"]+)"/);
    if (rMatch) restNonce = rMatch[1];
  }

  if (!restNonce) {
    throw new Error(`Đã đăng nhập ${DEFAULT_MOVIES_SITE} nhưng không lấy được X-WP-Nonce từ wp-admin.`);
  }

  cachedMoviesSession = {
    cookieHeader,
    restNonce,
    restRoot,
    expiresAt: Date.now() + 20 * 60 * 1000,
  };
  return cachedMoviesSession;
}

export async function fetchMoviesHd4kInitData(): Promise<{
  ok: boolean;
  siteUrl: string;
  loginUrl: string;
  authConnected: boolean;
  authWarning?: string;
  categories: WpCategoryItem[];
  genres: WpCategoryItem[];
  posts: (WpRemotePostItem & { postType?: 'posts' | 'np_story' })[];
  wpUsers: { id: number; name: string; slug: string }[];
  employeeOptions: typeof WP_EMPLOYEE_AUTHOR_MAP;
}> {
  const catPromise = fetch(`${DEFAULT_MOVIES_SITE}/wp-json/wp/v2/categories?per_page=50`, {
    headers: { Accept: 'application/json' },
  })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []);

  const genrePromise = fetch(`${DEFAULT_MOVIES_SITE}/wp-json/wp/v2/np_genre?per_page=50`, {
    headers: { Accept: 'application/json' },
  })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []);

  let session: MoviesWpAuthSession | null = null;
  let authWarning = '';
  try {
    session = await getMoviesHd4kSession();
  } catch (err: any) {
    authWarning = err?.message || 'Chưa kết nối được phiên đăng nhập quản trị';
  }

  const [rawCats, rawGenres] = (await Promise.all([catPromise, genrePromise])) as [any[], any[]];
  const categories: WpCategoryItem[] = Array.isArray(rawCats)
    ? rawCats
        .map((c) => ({
          id: Number(c.id),
          name: decodeHtmlEntities(String(c.name || '')),
          slug: String(c.slug || ''),
          count: Number(c.count || 0),
        }))
        .sort((a, b) => {
          const score = (c: WpCategoryItem) =>
            c.slug === 'story' ? 3 : c.slug === 'film' ? 2 : c.count > 0 ? 1 : 0;
          return score(b) - score(a) || b.count - a.count;
        })
    : [];

  const genres: WpCategoryItem[] = Array.isArray(rawGenres)
    ? rawGenres.map((g) => ({
        id: Number(g.id),
        name: decodeHtmlEntities(String(g.name || '')),
        slug: String(g.slug || ''),
        count: Number(g.count || 0),
      }))
    : [];

  let wpUsers: { id: number; name: string; slug: string }[] = [];
  let rawPosts: { item: any; postType: 'posts' | 'np_story' }[] = [];

  if (session) {
    const authHeaders = {
      Accept: 'application/json',
      Cookie: session.cookieHeader,
      'X-WP-Nonce': session.restNonce,
    };
    const [postsRes, storiesRes, usersRes] = await Promise.all([
      fetch(
        `${DEFAULT_MOVIES_SITE}/wp-json/wp/v2/posts?per_page=30&status=publish,draft,pending,future&_embed=1`,
        { headers: authHeaders }
      ).catch(() => null),
      fetch(
        `${DEFAULT_MOVIES_SITE}/wp-json/wp/v2/np_story?per_page=30&status=publish,draft,pending,future&_embed=1`,
        { headers: authHeaders }
      ).catch(() => null),
      fetch(`${DEFAULT_MOVIES_SITE}/wp-json/wp/v2/users?per_page=50`, {
        headers: authHeaders,
      }).catch(() => null),
    ]);

    if (storiesRes && storiesRes.ok) {
      const sJson = await storiesRes.json();
      if (Array.isArray(sJson)) {
        rawPosts.push(...sJson.map((item: any) => ({ item, postType: 'np_story' as const })));
      }
    }
    if (postsRes && postsRes.ok) {
      const pJson = await postsRes.json();
      if (Array.isArray(pJson)) {
        rawPosts.push(...pJson.map((item: any) => ({ item, postType: 'posts' as const })));
      }
    }
    if (usersRes && usersRes.ok) {
      const uJson = await usersRes.json();
      if (Array.isArray(uJson)) {
        wpUsers = uJson.map((u: any) => ({
          id: Number(u.id),
          name: String(u.name || u.slug || `User #${u.id}`),
          slug: String(u.slug || ''),
        }));
      }
    }
  } else {
    try {
      const [pubPostsRes, pubStoriesRes] = await Promise.all([
        fetch(`${DEFAULT_MOVIES_SITE}/wp-json/wp/v2/posts?per_page=20&_embed=1`, {
          headers: { Accept: 'application/json' },
        }).catch(() => null),
        fetch(`${DEFAULT_MOVIES_SITE}/wp-json/wp/v2/np_story?per_page=20&_embed=1`, {
          headers: { Accept: 'application/json' },
        }).catch(() => null),
      ]);
      if (pubStoriesRes && pubStoriesRes.ok) {
        const sJson = await pubStoriesRes.json();
        if (Array.isArray(sJson)) {
          rawPosts.push(...sJson.map((item: any) => ({ item, postType: 'np_story' as const })));
        }
      }
      if (pubPostsRes && pubPostsRes.ok) {
        const pubJson = await pubPostsRes.json();
        if (Array.isArray(pubJson)) {
          rawPosts.push(...pubJson.map((item: any) => ({ item, postType: 'posts' as const })));
        }
      }
    } catch {}
  }

  const catNameById = new Map<number, string>();
  categories.forEach((c) => catNameById.set(c.id, c.name));
  const genreNameById = new Map<number, string>();
  genres.forEach((g) => genreNameById.set(g.id, g.name));

  const userNameById = new Map<number, string>();
  wpUsers.forEach((u) => userNameById.set(u.id, u.name));

  const posts: (WpRemotePostItem & { postType?: 'posts' | 'np_story' })[] = rawPosts
    .map(({ item: p, postType }) => {
      const catIds: number[] =
        postType === 'np_story'
          ? Array.isArray(p.np_genre)
            ? p.np_genre.map(Number)
            : []
          : Array.isArray(p.categories)
          ? p.categories.map(Number)
          : [];
      const authorId = Number(p.author || 1);
      const embeddedAuthor = p?._embedded?.author?.[0];
      const embeddedFeatured = p?._embedded?.['wp:featuredmedia']?.[0];
      const authorDisplay =
        userNameById.get(authorId) ||
        embeddedAuthor?.name ||
        (authorId === 1 ? 'admin' : `User #${authorId}`);

      const matchedEmp = WP_EMPLOYEE_AUTHOR_MAP.find(
        (m) =>
          m.wpUsername.toLowerCase() === String(embeddedAuthor?.slug || authorDisplay).toLowerCase()
      );

      return {
        id: Number(p.id),
        postType,
        title: decodeHtmlEntities(stripHtmlTags(String(p.title?.rendered || ''))),
        content: String(p.content?.rendered || ''),
        excerpt: decodeHtmlEntities(stripHtmlTags(String(p.excerpt?.rendered || ''))),
        slug: String(p.slug || ''),
        status: (p.status || 'publish') as WpRemotePostItem['status'],
        date: String(p.date || ''),
        modified: String(p.modified || ''),
        link: String(p.link || `${DEFAULT_MOVIES_SITE}/?p=${p.id}`),
        authorId,
        authorName: authorDisplay,
        employeeCode: matchedEmp?.code || 'H0082',
        categories: catIds,
        categoryNames:
          postType === 'np_story'
            ? catIds.length > 0
              ? catIds.map((gid) => genreNameById.get(gid) || `Thể loại #${gid}`)
              : ['Truyện (/truyen/)']
            : catIds.map((cid) => catNameById.get(cid) || `Cat #${cid}`),
        featuredMediaId: Number(p.featured_media || 0),
        featuredImageUrl: String(embeddedFeatured?.source_url || ''),
      };
    })
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

  return {
    ok: true,
    siteUrl: DEFAULT_MOVIES_SITE,
    loginUrl: DEFAULT_MOVIES_LOGIN_URL,
    authConnected: Boolean(session),
    ...(authWarning ? { authWarning } : {}),
    categories,
    genres,
    posts,
    wpUsers,
    employeeOptions: WP_EMPLOYEE_AUTHOR_MAP,
  };
}

export async function uploadMediaToMoviesHd4k(params: {
  base64Data?: string;
  imageUrl?: string;
  fileName?: string;
  altText?: string;
  customWpUrl?: string;
  customWpUser?: string;
  customWpAppPassword?: string;
}): Promise<{
  mediaId: number;
  mediaUrl: string;
  fileName: string;
}> {
  let buffer: Buffer;
  let mimeType = 'image/jpeg';
  let finalFileName =
    (params.fileName || `story-cover-${Date.now()}.jpg`).replace(/[^a-zA-Z0-9._-]/g, '-');

  if (params.base64Data) {
    const match = params.base64Data.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      buffer = Buffer.from(match[2], 'base64');
      const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
      if (!finalFileName.includes('.')) finalFileName = `${finalFileName}.${ext}`;
    } else {
      buffer = Buffer.from(params.base64Data, 'base64');
    }
  } else if (params.imageUrl) {
    let parsedOrigin = DEFAULT_MOVIES_SITE;
    try {
      parsedOrigin = new URL(params.imageUrl).origin;
    } catch {}
    const imgRes = await fetch(params.imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        Referer: `${parsedOrigin}/`,
      },
    });
    if (!imgRes.ok) {
      throw new Error(`Không thể tải ảnh từ URL (${imgRes.status}): ${params.imageUrl}`);
    }
    const ct = imgRes.headers.get('content-type') || 'image/jpeg';
    if (!ct.startsWith('image/')) {
      throw new Error(`Link ảnh không trả về file ảnh hợp lệ (${ct})`);
    }
    mimeType = ct.split(';')[0].trim();
    const arrBuf = await imgRes.arrayBuffer();
    buffer = Buffer.from(arrBuf);
    const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    if (!finalFileName.includes('.')) finalFileName = `${finalFileName}.${ext}`;
  } else {
    throw new Error('Cần cung cấp dữ liệu ảnh Base64 hoặc URL ảnh');
  }

  const useCustomBasic =
    Boolean(params.customWpUrl?.trim()) &&
    Boolean(params.customWpUser?.trim()) &&
    Boolean(params.customWpAppPassword?.trim());

  const targetSite = useCustomBasic
    ? params.customWpUrl!.trim().replace(/\/+$/, '')
    : DEFAULT_MOVIES_SITE;

  const headers: Record<string, string> = {
    'Content-Disposition': `attachment; filename="${finalFileName}"`,
    'Content-Type': mimeType,
    Accept: 'application/json',
  };

  if (useCustomBasic) {
    const token = Buffer.from(
      `${params.customWpUser!.trim()}:${params.customWpAppPassword!.trim()}`
    ).toString('base64');
    headers.Authorization = `Basic ${token}`;
  } else {
    const session = await getMoviesHd4kSession();
    headers.Cookie = session.cookieHeader;
    headers['X-WP-Nonce'] = session.restNonce;
  }

  let uploadRes = await fetch(`${targetSite}/wp-json/wp/v2/media`, {
    method: 'POST',
    headers,
    body: new Uint8Array(buffer),
  });

  if (uploadRes.status === 401 || uploadRes.status === 403) {
    if (!useCustomBasic) {
      const freshSession = await getMoviesHd4kSession(true);
      headers.Cookie = freshSession.cookieHeader;
      headers['X-WP-Nonce'] = freshSession.restNonce;
      uploadRes = await fetch(`${targetSite}/wp-json/wp/v2/media`, {
        method: 'POST',
        headers,
        body: new Uint8Array(buffer),
      });
    }
  }

  const uploadText = await uploadRes.text();
  if (!uploadRes.ok) {
    throw new Error(`Lỗi upload ảnh lên ${targetSite} (${uploadRes.status}): ${uploadText.slice(0, 220)}`);
  }

  const uploadedJson = JSON.parse(uploadText);
  const mediaId = Number(uploadedJson.id || 0);
  const mediaUrl = String(uploadedJson.source_url || '');

  if (mediaId > 0 && params.altText) {
    fetch(`${targetSite}/wp-json/wp/v2/media/${mediaId}`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ alt_text: params.altText }),
    }).catch(() => {});
  }

  return {
    mediaId,
    mediaUrl,
    fileName: finalFileName,
  };
}

export type StoryStyleKey =
  | 'emotional_drama'
  | 'movie_story'
  | 'mystery_twist'
  | 'romance_life'
  | 'celebrity_chronicle';

export type StoryPovKey = 'third_person' | 'first_person';

export interface StoryGenerateParams {
  topic: string;
  sourceUrl?: string;
  mode?: 'from_idea' | 'from_url' | 'rewrite_draft';
  storyStyle?: StoryStyleKey;
  storyPov?: StoryPovKey;
  chapterCount?: number;
  language?: 'en' | 'vi';
  categoryName?: string;
  keyword?: string;
  existingTitle?: string;
  existingContent?: string;
  existingImages?: { url: string; alt?: string; isFeatured?: boolean; isExternal?: boolean }[];
}

const STORY_STYLE_DESCRIPTIONS: Record<StoryStyleKey, { vi: string; en: string }> = {
  emotional_drama: {
    vi: 'Truyện tâm lý cảm động, sâu sắc, giàu cảm xúc nhân văn, đẩy cao trào chạm tới trái tim người đọc',
    en: 'Deeply emotional human drama story with vivid character feelings, poignant turning points, and a moving climax',
  },
  movie_story: {
    vi: 'Kể chuyện phim điện ảnh lôi cuốn theo từng phân cảnh, giữ nhịp căng thẳng và nút thắt mở như đang xem phim',
    en: 'Cinematic movie-narrative storytelling told scene-by-scene with atmospheric tension and dramatic pacing',
  },
  mystery_twist: {
    vi: 'Truyện kịch tính, bí ẩn, cài cắm manh mối và cú bẻ lái (Plot Twist) bất ngờ ở hồi cuối',
    en: 'Suspenseful mystery narrative with layered clues, rising tension, and an unforgettable final twist',
  },
  romance_life: {
    vi: 'Truyện tình cảm, gia đình, đời thường chân thật, ấm áp nhưng nhiều thử thách và lựa chọn khó khăn',
    en: 'Heartfelt romance and family life story filled with relatable choices, quiet sacrifices, and warm resolution',
  },
  celebrity_chronicle: {
    vi: 'Truyện hậu trường ngôi sao / nhân vật nổi tiếng kể theo lối văn học điện ảnh, sống động như hồi ký',
    en: 'Intimate behind-the-scenes chronicle written like literary nonfiction with vivid dialogue and cinematic scenes',
  },
};

function interleaveStoryImages(
  chapters: { heading: string; paragraphs: string[] }[],
  images: { url: string; alt?: string }[],
  storyTitle: string
): string {
  const usableImages = images
    .map((im) => ({ url: String(im?.url || '').trim(), alt: String(im?.alt || storyTitle).trim() }))
    .filter((im) => im.url.startsWith('http'));

  const htmlParts: string[] = [];
  let imgCursor = 0;

  chapters.forEach((ch, idx) => {
    htmlParts.push(`<h2>${escapeHtml(ch.heading)}</h2>`);
    const paras = Array.isArray(ch.paragraphs) ? ch.paragraphs.filter((p) => p && p.trim()) : [];
    paras.forEach((p, pIdx) => {
      htmlParts.push(`<p>${escapeHtml(p.trim())}</p>`);
      // Insert image cleanly after the opening/middle paragraph of key chapters
      if (
        pIdx === 0 &&
        imgCursor < usableImages.length &&
        (idx === 0 || idx < chapters.length)
      ) {
        const im = usableImages[imgCursor++];
        htmlParts.push(
          `<figure class="wp-block-image size-large"><img src="${escapeHtml(im.url)}" alt="${escapeHtml(
            im.alt || storyTitle
          )}" /><figcaption>${escapeHtml(im.alt || ch.heading)}</figcaption></figure>`
        );
      }
    });
    if (idx < chapters.length - 1) {
      htmlParts.push(`<p style="text-align:center;opacity:0.6;">* * *</p>`);
    }
  });

  return htmlParts.join('\n\n');
}

function buildFallbackStory(params: {
  title: string;
  sourceText: string;
  language: 'en' | 'vi';
  chapterCount: number;
  images: { url: string; alt?: string }[];
}): {
  title: string;
  slug: string;
  excerpt: string;
  tags: string[];
  chapters: { heading: string; paragraphs: string[] }[];
  html: string;
} {
  const isVi = params.language === 'vi';
  const cleanText = (params.sourceText || '').replace(/\s+/g, ' ').trim();
  const sentences = cleanText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);

  const count = Math.max(3, Math.min(6, params.chapterCount || 4));
  const chunkSize = Math.max(2, Math.ceil(sentences.length / count));
  const chapters: { heading: string; paragraphs: string[] }[] = [];

  for (let i = 0; i < count; i++) {
    const slice = sentences.slice(i * chunkSize, (i + 1) * chunkSize);
    const headingPrefix = isVi ? `Chương ${i + 1}` : `Part ${i + 1}`;
    const headingSub =
      i === 0
        ? isVi
          ? 'Khởi đầu câu chuyện'
          : 'Where Everything Began'
        : i === count - 1
        ? isVi
          ? 'Sự thật và cái kết lắng đọng'
          : 'The Quiet Truth at the End'
        : isVi
        ? `Bước ngoặt số ${i + 1}`
        : `When Everything Changed`;

    const paras: string[] = [];
    if (slice.length > 0) {
      for (let j = 0; j < slice.length; j += 2) {
        paras.push(slice.slice(j, j + 2).join(' '));
      }
    } else {
      paras.push(
        isVi
          ? `${params.title} bước vào khoảnh khắc quyết định khiến không khí trở nên lặng đi từng nhịp.`
          : `At that moment, the silence around ${params.title} felt heavier than any spoken word.`
      );
    }
    chapters.push({
      heading: `${headingPrefix}: ${headingSub}`,
      paragraphs: paras,
    });
  }

  const finalTitle = params.title || (isVi ? 'Câu chuyện đặc biệt hôm nay' : 'A Story Worth Remembering');
  const excerpt = cleanText.slice(0, 155) || finalTitle;
  const html = interleaveStoryImages(chapters, params.images, finalTitle);

  return {
    title: finalTitle,
    slug: slugifyStory(finalTitle) || `story-${Date.now()}`,
    excerpt,
    tags: isVi ? ['Truyện hay', 'Câu chuyện', 'MoviesHD4K'] : ['Story', 'Drama', 'Featured Story'],
    chapters,
    html,
  };
}

export async function generateStoryArticleWithAi(params: StoryGenerateParams): Promise<{
  ok: boolean;
  usedGemini: boolean;
  model: string;
  warning?: string;
  title: string;
  slug: string;
  excerpt: string;
  tags: string[];
  content: string;
  wordCount: number;
  chapterCount: number;
  readingMinutes: number;
  featuredImageUrl: string;
  images: { url: string; alt: string; isFeatured?: boolean; isExternal?: boolean }[];
  sourceUrl?: string;
}> {
  const language: 'en' | 'vi' = params.language === 'vi' ? 'vi' : 'en';
  const storyStyle: StoryStyleKey = params.storyStyle || 'emotional_drama';
  const storyPov: StoryPovKey = params.storyPov || 'third_person';
  const chapterCount = Math.max(3, Math.min(6, Number(params.chapterCount) || 5));

  let sourceTitle = (params.existingTitle || '').trim();
  let sourceText = stripHtmlTags(params.existingContent || '');
  let collectedImages: { url: string; alt: string; isFeatured?: boolean; isExternal?: boolean }[] =
    Array.isArray(params.existingImages)
      ? params.existingImages.map((im, idx) => ({
          url: String(im.url || ''),
          alt: String(im.alt || sourceTitle || params.topic || 'Story scene'),
          isFeatured: Boolean(im.isFeatured || idx === 0),
          isExternal: Boolean(im.isExternal),
        }))
      : [];

  // Scrape source URL if provided
  const cleanSourceUrl = (params.sourceUrl || '').trim();
  if (cleanSourceUrl && cleanSourceUrl.startsWith('http')) {
    try {
      const scraped = await scrapeWebArticleForSeoRewrite(cleanSourceUrl);
      if (scraped.originalTitle && !sourceTitle) sourceTitle = scraped.originalTitle;
      if (scraped.articleText && scraped.articleText.length > sourceText.length) {
        sourceText = scraped.articleText;
      }
      if (scraped.images && scraped.images.length > 0 && collectedImages.length === 0) {
        collectedImages = scraped.images.slice(0, 8).map((im, idx) => ({
          url: im.url,
          alt: im.alt || sourceTitle || 'Story scene',
          isFeatured: idx === 0,
          isExternal: false,
        }));
      }
    } catch {}
  }

  // If still no images and topic/source available, try discovering related images
  if (collectedImages.length === 0) {
    try {
      const disc = await tryDiscoverSourceArticleImagesFromText(
        sourceTitle || params.topic,
        sourceText || params.topic,
        []
      );
      if (disc && disc.images.length > 0) {
        collectedImages = disc.images.slice(0, 6).map((im, idx) => ({
          url: im.url,
          alt: im.alt || sourceTitle || params.topic,
          isFeatured: idx === 0,
          isExternal: false,
        }));
      }
    } catch {}
  }

  if (collectedImages.length < 3 && (sourceTitle || params.topic)) {
    try {
      const ctx = analyzeArticleSubjectAndContext(
        sourceTitle || params.topic,
        sourceText || params.topic,
        params.topic,
        collectedImages
      );
      const exclude = new Set(collectedImages.map((i) => i.url.split('?')[0].toLowerCase()));
      const extra = await searchExternalRelatedImages(
        ctx?.combinedSearchQuery || sourceTitle || params.topic,
        Math.max(1, 5 - collectedImages.length),
        exclude,
        ctx
      );
      if (extra.length > 0) {
        collectedImages = [
          ...collectedImages,
          ...extra.map((im) => ({
            url: im.url,
            alt: im.alt || sourceTitle || params.topic,
            isFeatured: false,
            isExternal: true,
          })),
        ];
      }
    } catch {}
  }

  const ai = createFreeGeminiClient();
  const promptInputText = [
    params.topic ? `User Premise / Topic:\n${params.topic.trim()}` : '',
    sourceTitle ? `Original Reference Title:\n${sourceTitle}` : '',
    sourceText ? `Reference Facts / Story Material:\n${sourceText.slice(0, 12000)}` : '',
    params.keyword ? `Focus Keyword: ${params.keyword}` : '',
    params.categoryName ? `Category: ${params.categoryName}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const styleGuide = STORY_STYLE_DESCRIPTIONS[storyStyle][language];
  const povInstruction =
    storyPov === 'first_person'
      ? language === 'vi'
        ? 'Kể theo ngôi thứ nhất ("Tôi"), giọng văn tự sự chân thật, gần gũi.'
        : 'Tell the story in immersive first-person ("I") voice with vivid personal reflection.'
      : language === 'vi'
      ? 'Kể theo ngôi thứ ba toàn tri, miêu tả sâu tâm lý nhân vật và khung cảnh.'
      : 'Tell the story in cinematic third-person narrative with rich character perspective and dialogue.';

  const systemInstruction =
    language === 'vi'
      ? `Bạn là nhà văn kể chuyện điện ảnh chuyên viết truyện dài kỳ hấp dẫn cho website https://movieshd4k.com/.
Nhiệm vụ: Chuyển hóa ý tưởng hoặc bài viết nguồn thành MỘT CÂU CHUYỆN HOÀN CHỈNH (viết dạng truyện kể có mở đầu, cao trào, hội thoại tự nhiên và cái kết đọng lại cảm xúc), TUYỆT ĐỐI KHÔNG viết kiểu tin tức khô khan hay liệt kê SEO.
Yêu cầu:
- Phong cách: ${styleGuide}
- Góc nhìn: ${povInstruction}
- Chia đúng ${chapterCount} chương/hồi (mỗi chương đặt tiêu đề gợi tò mò kiểu "Chương 1: ...").
- Mỗi chương gồm 3 đến 5 đoạn văn ngắn gọn (mỗi đoạn khoảng 40-75 từ) dễ đọc trên điện thoại, xen kẽ câu thoại tự nhiên trong dấu ngoặc kép.
- Giữ trung thực các nhân vật/tình tiết cốt lõi nếu có tài liệu nguồn, nhưng kể lại giàu hình ảnh, cảm xúc và nhịp điệu lôi cuốn.`
      : `You are a master cinematic storyteller writing serialized narrative stories for https://movieshd4k.com/.
Mission: Transform the user's premise or reference material into an ENGAGING FULL STORY written in immersive narrative prose (opening hook, rising conflict, natural character dialogue, emotional climax, and memorable ending) — NEVER write a dry news summary or robotic SEO listicle.
Requirements:
- Style: ${styleGuide}
- Point of View: ${povInstruction}
- Structure into exactly ${chapterCount} chapters/parts (e.g., "Part 1: ..." with intriguing chapter titles).
- Each chapter must have 3 to 5 concise, binge-worthy paragraphs (40–75 words each) for effortless mobile reading, including natural spoken dialogue in quotation marks.
- Preserve key real names/facts when source material is provided while bringing scenes alive visually and emotionally.`;

  let usedGemini = false;
  let warning = '';
  let generatedTitle = sourceTitle || params.topic.slice(0, 90);
  let generatedSlug = slugifyStory(generatedTitle);
  let generatedExcerpt = '';
  let generatedTags: string[] = [];
  let chapters: { heading: string; paragraphs: string[] }[] = [];

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: STORY_AI_MODEL,
        contents: `${promptInputText}\n\nWrite the complete ${chapterCount}-chapter story in ${
          language === 'vi' ? 'Vietnamese' : 'English'
        } and return strictly valid JSON matching the schema.`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              slug: { type: Type.STRING },
              excerpt: { type: Type.STRING },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              chapters: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    heading: { type: Type.STRING },
                    paragraphs: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ['heading', 'paragraphs'],
                },
              },
            },
            required: ['title', 'slug', 'excerpt', 'tags', 'chapters'],
          },
        },
      });

      const rawJson = (response.text || '').trim();
      if (rawJson) {
        const parsed = JSON.parse(rawJson);
        if (parsed.title) generatedTitle = String(parsed.title).trim();
        if (parsed.slug) generatedSlug = slugifyStory(String(parsed.slug)) || slugifyStory(generatedTitle);
        if (parsed.excerpt) generatedExcerpt = String(parsed.excerpt).trim();
        if (Array.isArray(parsed.tags)) {
          generatedTags = parsed.tags.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 8);
        }
        if (Array.isArray(parsed.chapters) && parsed.chapters.length > 0) {
          chapters = parsed.chapters.map((ch: any, idx: number) => ({
            heading: String(ch.heading || (language === 'vi' ? `Chương ${idx + 1}` : `Part ${idx + 1}`)).trim(),
            paragraphs: Array.isArray(ch.paragraphs)
              ? ch.paragraphs.map((p: any) => String(p).trim()).filter(Boolean)
              : [],
          }));
          usedGemini = true;
        }
      }
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      warning = msg.includes('429') || msg.toLowerCase().includes('quota')
        ? 'Gemini Free Tier đang chạm giới hạn lượt gọi tạm thời — đã dùng bộ dựng khung truyện dự phòng để bạn chỉnh sửa ngay.'
        : `Không gọi được Gemini Free Tier (${msg.slice(0, 120)}) — đã tạo bản khung truyện dự phòng.`;
    }
  } else {
    warning =
      'Chưa phát hiện GEMINI_API_KEY trong môi trường máy chủ — đã tạo khung truyện cấu trúc sẵn từ nội dung đầu vào.';
  }

  let finalHtml = '';
  if (chapters.length > 0) {
    finalHtml = interleaveStoryImages(chapters, collectedImages, generatedTitle);
  } else {
    const fallback = buildFallbackStory({
      title: generatedTitle,
      sourceText: sourceText || params.topic,
      language,
      chapterCount,
      images: collectedImages,
    });
    generatedTitle = fallback.title;
    generatedSlug = fallback.slug;
    generatedExcerpt = fallback.excerpt;
    generatedTags = fallback.tags;
    chapters = fallback.chapters;
    finalHtml = fallback.html;
  }

  const plainWords = stripHtmlTags(finalHtml).split(/\s+/).filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.round(plainWords / 200));

  return {
    ok: true,
    usedGemini,
    model: STORY_AI_MODEL,
    ...(warning ? { warning } : {}),
    title: generatedTitle,
    slug: generatedSlug || slugifyStory(generatedTitle) || `story-${Date.now()}`,
    excerpt: generatedExcerpt || stripHtmlTags(finalHtml).slice(0, 155),
    tags: generatedTags,
    content: finalHtml,
    wordCount: plainWords,
    chapterCount: chapters.length,
    readingMinutes,
    featuredImageUrl: collectedImages[0]?.url || '',
    images: collectedImages,
    sourceUrl: cleanSourceUrl || undefined,
  };
}

export async function publishStoryToMoviesHd4k(params: {
  postId?: number;
  postType?: 'posts' | 'np_story';
  title: string;
  content: string;
  excerpt?: string;
  slug?: string;
  status?: 'publish' | 'draft' | 'pending';
  categories?: number[];
  genres?: number[];
  tags?: string[];
  employeeCode?: string;
  featuredMediaId?: number;
  featuredImageBase64?: string;
  featuredImageUrl?: string;
  featuredImageAlt?: string;
  targetMode?: 'default_wp' | 'custom_wp' | 'webhook';
  customWpUrl?: string;
  customWpUser?: string;
  customWpAppPassword?: string;
  webhookUrl?: string;
  webhookSecret?: string;
}): Promise<{
  ok: boolean;
  postId?: number;
  postType?: 'posts' | 'np_story';
  link?: string;
  trackingLink?: string;
  status?: string;
  message: string;
}> {
  if (!params.title?.trim()) {
    throw new Error('Tiêu đề truyện không được để trống');
  }
  if (!params.content?.trim()) {
    throw new Error('Nội dung truyện không được để trống');
  }

  // Webhook mode
  if (params.targetMode === 'webhook' && params.webhookUrl?.trim()) {
    const res = await fetch(params.webhookUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(params.webhookSecret?.trim()
          ? { 'X-Webhook-Secret': params.webhookSecret.trim() }
          : {}),
      },
      body: JSON.stringify({
        site: DEFAULT_MOVIES_SITE,
        type: 'story',
        title: params.title.trim(),
        slug: params.slug || slugifyStory(params.title),
        content: params.content,
        excerpt: params.excerpt || '',
        status: params.status || 'publish',
        categories: params.categories || [12],
        tags: params.tags || [],
        employeeCode: params.employeeCode || '',
        featuredImageUrl: params.featuredImageUrl || '',
      }),
    });
    const txt = await res.text();
    if (!res.ok) {
      throw new Error(`Webhook trả về lỗi (${res.status}): ${txt.slice(0, 200)}`);
    }
    return {
      ok: true,
      status: params.status || 'publish',
      link: params.webhookUrl.trim(),
      message: 'Đã đẩy truyện sang Webhook thành công!',
    };
  }

  const useCustomBasic =
    params.targetMode === 'custom_wp' &&
    Boolean(params.customWpUrl?.trim()) &&
    Boolean(params.customWpUser?.trim()) &&
    Boolean(params.customWpAppPassword?.trim());

  const targetSite = useCustomBasic
    ? params.customWpUrl!.trim().replace(/\/+$/, '')
    : DEFAULT_MOVIES_SITE;

  // Upload featured media if needed
  let finalFeaturedMediaId = Number(params.featuredMediaId || 0);
  if (finalFeaturedMediaId <= 0 && (params.featuredImageBase64 || params.featuredImageUrl)) {
    try {
      const uploaded = await uploadMediaToMoviesHd4k({
        base64Data: params.featuredImageBase64,
        imageUrl: params.featuredImageUrl,
        altText: params.featuredImageAlt || params.title,
        customWpUrl: useCustomBasic ? params.customWpUrl : undefined,
        customWpUser: useCustomBasic ? params.customWpUser : undefined,
        customWpAppPassword: useCustomBasic ? params.customWpAppPassword : undefined,
      });
      finalFeaturedMediaId = uploaded.mediaId;
    } catch (uploadErr) {
      console.warn('[moviesHd4kService] Featured image upload skipped:', uploadErr);
    }
  }

  const buildHeaders = async (forceRefresh = false): Promise<Record<string, string>> => {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (useCustomBasic) {
      const token = Buffer.from(
        `${params.customWpUser!.trim()}:${params.customWpAppPassword!.trim()}`
      ).toString('base64');
      h.Authorization = `Basic ${token}`;
    } else {
      const sess = await getMoviesHd4kSession(forceRefresh);
      h.Cookie = sess.cookieHeader;
      h['X-WP-Nonce'] = sess.restNonce;
    }
    return h;
  };

  let headers = await buildHeaders(false);

  // Resolve or create tag IDs if provided
  const tagIds: number[] = [];
  if (Array.isArray(params.tags) && params.tags.length > 0) {
    for (const rawTag of params.tags.slice(0, 6)) {
      const tName = rawTag.trim();
      if (!tName) continue;
      try {
        const searchRes = await fetch(
          `${targetSite}/wp-json/wp/v2/tags?search=${encodeURIComponent(tName)}&per_page=5`,
          { headers }
        );
        if (searchRes.ok) {
          const foundTags = (await searchRes.json()) as any[];
          const exact = foundTags.find(
            (ft) => String(ft.name || '').toLowerCase() === tName.toLowerCase()
          );
          if (exact?.id) {
            tagIds.push(Number(exact.id));
            continue;
          }
        }
        const createRes = await fetch(`${targetSite}/wp-json/wp/v2/tags`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: tName }),
        });
        if (createRes.ok) {
          const created = (await createRes.json()) as any;
          if (created?.id) tagIds.push(Number(created.id));
        }
      } catch {}
    }
  }

  const resolvedPostType: 'posts' | 'np_story' = params.postType === 'posts' ? 'posts' : 'np_story';
  const restCollection = resolvedPostType === 'np_story' ? 'np_story' : 'posts';

  const endpoint = params.postId
    ? `${targetSite}/wp-json/wp/v2/${restCollection}/${params.postId}`
    : `${targetSite}/wp-json/wp/v2/${restCollection}`;

  const payloadBody: Record<string, any> = {
    title: params.title.trim(),
    content: params.content,
    status: params.status || 'publish',
  };

  if (resolvedPostType === 'posts') {
    payloadBody.categories =
      Array.isArray(params.categories) && params.categories.length > 0
        ? params.categories
        : [12]; // Default Story category
    if (tagIds.length > 0) payloadBody.tags = tagIds;
  } else if (Array.isArray(params.genres) && params.genres.length > 0) {
    payloadBody.np_genre = params.genres;
  }

  if (params.excerpt?.trim()) payloadBody.excerpt = params.excerpt.trim();
  if (params.slug?.trim()) payloadBody.slug = slugifyStory(params.slug);
  if (finalFeaturedMediaId > 0) payloadBody.featured_media = finalFeaturedMediaId;

  let res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payloadBody),
  });

  if ((res.status === 401 || res.status === 403) && !useCustomBasic) {
    headers = await buildHeaders(true);
    res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payloadBody),
    });
  }

  const resText = await res.text();
  if (!res.ok) {
    throw new Error(`Không thể đăng truyện lên ${targetSite} (${res.status}): ${resText.slice(0, 260)}`);
  }

  const createdPost = JSON.parse(resText);
  const postLink = String(createdPost.link || `${targetSite}/?p=${createdPost.id}`);
  const empCode = (params.employeeCode || '').trim().toUpperCase();
  const trackingLink = empCode
    ? `${postLink}${postLink.includes('?') ? '&' : '?'}${empCode}`
    : postLink;

  return {
    ok: true,
    postId: Number(createdPost.id),
    postType: resolvedPostType,
    link: postLink,
    trackingLink,
    status: String(createdPost.status || params.status || 'publish'),
    message: params.postId
      ? `Đã cập nhật truyện #${createdPost.id} trên ${targetSite}!`
      : `Đã đăng truyện mới #${createdPost.id} lên ${targetSite} thành công!`,
  };
}
