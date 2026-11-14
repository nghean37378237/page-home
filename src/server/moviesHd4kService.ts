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
    .replace(/&#8230;/g, '…')
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

function countWords(textOrHtml: string): number {
  const plain = stripHtmlTags(textOrHtml);
  return plain ? plain.split(/\s+/).filter(Boolean).length : 0;
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
  return rawCookies
    .map((c) => c.split(';')[0])
    .filter(
      (c) =>
        c.startsWith('wordpress_logged_in_') ||
        c.startsWith('wordpress_sec_') ||
        c.startsWith('wordpress_') ||
        c.startsWith('wp-settings-')
    )
    .join('; ');
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
  chapters: (WpRemotePostItem & { postType: 'np_chapter' })[];
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
  const rawPosts: { item: any; postType: 'posts' | 'np_story' }[] = [];
  const rawChapters: any[] = [];

  if (session) {
    const authHeaders = {
      Accept: 'application/json',
      Cookie: session.cookieHeader,
      'X-WP-Nonce': session.restNonce,
    };
    const [postsRes, storiesRes, chaptersRes, usersRes] = await Promise.all([
      fetch(
        `${DEFAULT_MOVIES_SITE}/wp-json/wp/v2/posts?per_page=30&status=publish,draft,pending,future&_embed=1`,
        { headers: authHeaders }
      ).catch(() => null),
      fetch(
        `${DEFAULT_MOVIES_SITE}/wp-json/wp/v2/np_story?per_page=30&status=publish,draft,pending,future&_embed=1`,
        { headers: authHeaders }
      ).catch(() => null),
      fetch(
        `${DEFAULT_MOVIES_SITE}/wp-json/wp/v2/np_chapter?per_page=50&status=publish,draft,pending,future&_embed=1`,
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
    if (chaptersRes && chaptersRes.ok) {
      const cJson = await chaptersRes.json();
      if (Array.isArray(cJson)) {
        rawChapters.push(...cJson);
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
      const [pubPostsRes, pubStoriesRes, pubChaptersRes] = await Promise.all([
        fetch(`${DEFAULT_MOVIES_SITE}/wp-json/wp/v2/posts?per_page=20&_embed=1`, {
          headers: { Accept: 'application/json' },
        }).catch(() => null),
        fetch(`${DEFAULT_MOVIES_SITE}/wp-json/wp/v2/np_story?per_page=20&_embed=1`, {
          headers: { Accept: 'application/json' },
        }).catch(() => null),
        fetch(`${DEFAULT_MOVIES_SITE}/wp-json/wp/v2/np_chapter?per_page=50&_embed=1`, {
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
      if (pubChaptersRes && pubChaptersRes.ok) {
        const chJson = await pubChaptersRes.json();
        if (Array.isArray(chJson)) {
          rawChapters.push(...chJson);
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
        (m) => m.wpUsername.toLowerCase() === String(embeddedAuthor?.slug || authorDisplay).toLowerCase()
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

  const chapters: (WpRemotePostItem & { postType: 'np_chapter' })[] = rawChapters
    .map((p: any) => {
      const authorId = Number(p.author || 1);
      const embeddedAuthor = p?._embedded?.author?.[0];
      const embeddedFeatured = p?._embedded?.['wp:featuredmedia']?.[0];
      const authorDisplay =
        userNameById.get(authorId) ||
        embeddedAuthor?.name ||
        (authorId === 1 ? 'admin' : `User #${authorId}`);
      return {
        id: Number(p.id),
        postType: 'np_chapter' as const,
        title: decodeHtmlEntities(stripHtmlTags(String(p.title?.rendered || ''))),
        content: String(p.content?.rendered || ''),
        excerpt: decodeHtmlEntities(stripHtmlTags(String(p.excerpt?.rendered || ''))),
        slug: String(p.slug || ''),
        status: (p.status || 'publish') as WpRemotePostItem['status'],
        date: String(p.date || ''),
        modified: String(p.modified || ''),
        link: String(p.link || `${DEFAULT_MOVIES_SITE}/?post_type=np_chapter&p=${p.id}`),
        authorId,
        authorName: authorDisplay,
        employeeCode: 'H0082',
        categories: [],
        categoryNames: ['Chapters (np_chapter)'],
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
    chapters,
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

export interface StoryChapterPayload {
  chapterNumber: number;
  heading: string;
  slug: string;
  contentHtml: string;
  excerpt: string;
  wordCount: number;
  isMainContent: boolean;
}

export interface StoryGenerateParams {
  topic: string;
  sourceUrl?: string;
  mode?: 'from_idea' | 'from_url' | 'rewrite_draft';
  storyStyle?: StoryStyleKey;
  storyPov?: StoryPovKey;
  chapterCount?: number;
  batchStartChapter?: number;
  batchEndChapter?: number;
  previousStoryContext?: string;
  sharedCoverImageUrl?: string;
  existingSlug?: string;
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

function splitIntoShortReadingParagraphs(paragraphs: string[]): string[] {
  const result: string[] = [];

  for (const raw of paragraphs) {
    const preSplit = String(raw || '')
      .split(/\r?\n+/)
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    for (const block of preSplit) {
      if (countWords(block) <= 36) {
        result.push(block);
        continue;
      }

      // Split at sentence endings while keeping quotes attached properly
      const sentences = block
        .split(/(?<=[.!?…”"'])\s+(?=[A-ZÀ-Ỹ“"'\d])/u)
        .map((s) => s.trim())
        .filter(Boolean);

      if (sentences.length <= 1) {
        // Fallback clause split if a single run-on sentence exceeds 42 words
        const words = block.split(/\s+/).filter(Boolean);
        if (words.length <= 42) {
          result.push(block);
        } else {
          let cursor = 0;
          while (cursor < words.length) {
            const slice = words.slice(cursor, cursor + 30);
            result.push(slice.join(' '));
            cursor += 30;
          }
        }
        continue;
      }

      let current = '';
      for (const sent of sentences) {
        const candidate = current ? `${current} ${sent}` : sent;
        if (current && countWords(candidate) > 36) {
          result.push(current);
          current = sent;
        } else {
          current = candidate;
        }
      }
      if (current) {
        result.push(current);
      }
    }
  }

  return result;
}

function buildSingleChapterHtml(params: {
  heading: string;
  paragraphs: string[];
  sharedCoverImageUrl: string;
  storyTitle: string;
}): string {
  const parts: string[] = [];
  if (params.sharedCoverImageUrl && params.sharedCoverImageUrl.startsWith('http')) {
    parts.push(
      `<figure class="wp-block-image size-large story-shared-cover"><img src="${escapeHtml(
        params.sharedCoverImageUrl
      )}" alt="${escapeHtml(params.storyTitle)}" /></figure>`
    );
  }
  parts.push(`<h2>${escapeHtml(params.heading)}</h2>`);
  const rawParas = params.paragraphs.map((p) => String(p || '').trim()).filter(Boolean);
  const cleanParas = splitIntoShortReadingParagraphs(rawParas);
  cleanParas.forEach((p) => {
    parts.push(`<p>${escapeHtml(p)}</p>`);
  });
  return parts.join('\n\n');
}

function buildFallbackChapterParagraphs(params: {
  title: string;
  sourceText: string;
  language: 'en' | 'vi';
  chapterIndex: number;
  totalChapters: number;
  baseSlice: string[];
}): string[] {
  const isVi = params.language === 'vi';
  const chNum = params.chapterIndex + 1;
  const result: string[] = [];

  if (params.baseSlice.length > 0) {
    for (const s of params.baseSlice) {
      if (s.trim()) result.push(s.trim());
    }
  }

  // Mỗi đoạn chỉ 1–3 dòng ngắn (18–34 từ), xuống dòng liên tục để kéo dài mạch truyện mượt mà
  const expansionPool = isVi
    ? [
        `Căn phòng bỗng lặng đi hoàn toàn, chỉ còn tiếng đồng hồ tích tắc vang đều giữa khoảng không tĩnh mịch.`,
        `Bàn tay anh khẽ siết chặt lại bên mép bàn, ánh mắt hướng về phía khung cửa sổ cuối hành lang.`,
        `Ngoài kia, vệt nắng cuối chiều hắt lên từng đường nét căng thẳng trên gương mặt vốn trầm lặng bấy lâu.`,
        `“Nếu ngay lúc này không nói ra sự thật, có lẽ cả đời sau chúng ta cũng không còn cơ hội nữa.”`,
        `Giọng nói trầm thấp nhưng dứt khoát vang lên, cắt ngang sự im lặng kéo dài suốt nhiều năm qua.`,
        `Những ký ức cũ bất chợt ùa về, nối tiếp nhau chậm rãi như từng thước phim quay chậm trước mắt.`,
        `Không ai trong số những người có mặt lúc ấy ngờ rằng mọi chuyện lại bắt đầu từ một chi tiết nhỏ bé đến thế.`,
        `Tờ giấy gấp tư nằm yên dưới đáy hộp gỗ bỗng trở thành mảnh ghép quan trọng nhất của cả câu chuyện.`,
        `Những người từng hiểu lầm giờ đây chỉ biết đứng lặng, nhìn lại từng hy sinh âm thầm suốt bao năm trời.`,
        `Họ nhận ra vẻ ngoài bình thản trước nay thực chất chỉ là lớp vỏ bọc che giấu biết bao tổn thương.`,
        `Ngoài hành lang, tiếng bước chân vội vã vọng lại mỗi lúc một gần hơn sau cánh cửa khép hờ.`,
        `Một cuộc đối mặt không thể né tránh sắp sửa diễn ra ngay trước mắt tất cả mọi người.`,
        `Khoảnh khắc ấy, ranh giới giữa danh dự, tình thân và sự thật bị chôn giấu trở nên mong manh hơn bao giờ hết.`,
        `Một ánh nhìn trao vội trong giây lát cũng đủ thay cho hàng trăm lời giải thích muộn màng.`,
        `Khi cánh cửa bật mở, bí mật tưởng chừng đã ngủ yên suốt hai thập kỷ cuối cùng cũng chuẩn bị bước ra ánh sáng.`,
        `Dư âm của lời thú nhận vừa rồi vẫn còn đọng lại nặng trĩu, mở đường cho bước ngoặt lớn ngay phía trước.`,
      ]
    : [
        `The room fell completely silent, save for the steady ticking of the wall clock in the corner.`,
        `His fingers tightened slightly against the edge of the table as his eyes drifted toward the narrow window.`,
        `Outside, the fading afternoon light traced deep lines of quiet exhaustion across his otherwise calm face.`,
        `“If we walk out of here without telling the whole truth, none of us will ever find peace again.”`,
        `The voice was low yet unshakable, cutting straight through years of heavy, unspoken tension.`,
        `In that single heartbeat, forgotten memories began rushing back like slow-motion scenes from another life.`,
        `No one standing in that room had ever imagined the secret began with something so small and ordinary.`,
        `Folded carefully at the bottom of the old wooden box, a faded note finally connected every missing piece.`,
        `Those who had doubted him for years stood frozen, replaying every quiet sacrifice they had overlooked.`,
        `They realized now that his calm silence had never been indifference—it had been protection all along.`,
        `Out in the hallway, hurried footsteps echoed closer toward the half-open door.`,
        `The confrontation everyone had tried to avoid for so long was suddenly only seconds away.`,
        `In that breathless pause, pride, family loyalty, and buried truth hung in delicate balance.`,
        `One steady glance across the room spoke louder than a hundred late apologies ever could.`,
        `As the latch finally clicked open, twenty years of hidden history stood ready to step into the light.`,
        `Yet one unanswered question still lingered in the air, pulling everyone straight into the next turning point.`,
      ];

  let loopGuard = 0;
  while (countWords(result.join(' ')) < 470 && loopGuard < 26) {
    result.push(expansionPool[(loopGuard + chNum - 1) % expansionPool.length]);
    loopGuard++;
  }

  return splitIntoShortReadingParagraphs(result);
}

function buildFallbackMultiChapterStory(params: {
  title: string;
  sourceText: string;
  language: 'en' | 'vi';
  chapterCount: number;
  batchStartChapter?: number;
  batchEndChapter?: number;
  existingSlug?: string;
  sharedCoverImageUrl: string;
}): {
  title: string;
  slug: string;
  excerpt: string;
  tags: string[];
  chapters: StoryChapterPayload[];
} {
  const isVi = params.language === 'vi';
  const cleanText = (params.sourceText || '').replace(/\s+/g, ' ').trim();
  const sentences = cleanText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const count = Math.max(2, Math.min(30, params.chapterCount || 4));
  const startCh = Math.max(1, Math.min(count, params.batchStartChapter || 1));
  const endCh = Math.max(startCh, Math.min(count, params.batchEndChapter || count));
  const chunkSize = Math.max(1, Math.ceil(sentences.length / count));
  const finalTitle = params.title || (isVi ? 'Câu chuyện đặc biệt hôm nay' : 'A Story Worth Remembering');
  const baseSlug = params.existingSlug || slugifyStory(finalTitle) || `story-${Date.now()}`;

  const viArcLabels = [
    'Khởi nguồn câu chuyện',
    'Những dấu hiệu bất thường',
    'Mảnh ghép bị che giấu',
    'Cuộc gặp gỡ không ngờ',
    'Bí mật trong quá khứ',
    'Sóng gió âm thầm nổi lên',
    'Khoảnh khắc nghi ngờ dâng cao',
    'Lời hứa bị thử thách',
    'Những chứng cứ đầu tiên',
    'Bước ngoặt thay đổi tất cả',
    'Khi sự thật chạm giới hạn',
    'Ánh mắt nói thay lời',
    'Cuộc đối thoại định mệnh',
    'Màn sương dần được vén mở',
    'Cái giá của sự im lặng',
    'Lựa chọn không thể quay đầu',
    'Cao trào giữa tâm bão',
    'Sự thật lộ diện hoàn toàn',
    'Khoảnh khắc vỡ òa cảm xúc',
    'Cái kết lắng đọng & dư âm',
  ];

  const enArcLabels = [
    'Where Everything Began',
    'Unspoken Signs Beneath the Surface',
    'Fragments of a Hidden Past',
    'An Unexpected Encounter',
    'Whispers Behind Closed Doors',
    'Quiet Storms Gathering',
    'Shadows of Doubt',
    'A Promise Put to the Test',
    'The First Clue Emerges',
    'The Turning Point Arrives',
    'When Patience Reaches Its Limit',
    'Words Left Unsaid',
    'A Fateful Confrontation',
    'Lifting the Veil of Secrets',
    'The Weight of Silent Years',
    'A Choice with No Return',
    'At the Heart of the Storm',
    'The Whole Truth Unfolds',
    'A Heartbreaking Reckoning',
    'Peace After the Storm',
  ];

  const chapters: StoryChapterPayload[] = [];
  for (let chNum = startCh; chNum <= endCh; chNum++) {
    const i = chNum - 1;
    const isMainContent = chNum === 1;
    const slice = sentences.slice(i * chunkSize, (i + 1) * chunkSize);
    const arcVi = chNum === count ? viArcLabels[viArcLabels.length - 1] : viArcLabels[i % (viArcLabels.length - 1)];
    const arcEn = chNum === count ? enArcLabels[enArcLabels.length - 1] : enArcLabels[i % (enArcLabels.length - 1)];

    const heading = isVi
      ? isMainContent
        ? `Chương 1 (Nội dung chính): ${arcVi}`
        : `Chương ${chNum}: ${arcVi}`
      : isMainContent
      ? `Chapter 1 (Main Story): ${arcEn}`
      : `Chapter ${chNum}: ${arcEn}`;

    const paragraphs = buildFallbackChapterParagraphs({
      title: finalTitle,
      sourceText: cleanText,
      language: params.language,
      chapterIndex: i,
      totalChapters: count,
      baseSlice: slice,
    });

    const contentHtml = buildSingleChapterHtml({
      heading,
      paragraphs,
      sharedCoverImageUrl: params.sharedCoverImageUrl,
      storyTitle: finalTitle,
    });

    chapters.push({
      chapterNumber: chNum,
      heading,
      slug: isMainContent ? baseSlug : `${baseSlug}-chuong-${chNum}`,
      contentHtml,
      excerpt: paragraphs[0]?.slice(0, 155) || finalTitle,
      wordCount: countWords(contentHtml),
      isMainContent,
    });
  }

  return {
    title: finalTitle,
    slug: baseSlug,
    excerpt: cleanText.slice(0, 155) || chapters[0]?.excerpt || finalTitle,
    tags: isVi ? ['Truyện hay', 'Truyện nhiều chương', 'MoviesHD4K'] : ['Story', 'Serial Story', 'MoviesHD4K'],
    chapters,
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
  chapters: StoryChapterPayload[];
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
  const chapterCount = Math.max(2, Math.min(30, Number(params.chapterCount) || 4));
  const batchStart = Math.max(1, Math.min(chapterCount, Number(params.batchStartChapter) || 1));
  const batchEnd = Math.max(batchStart, Math.min(chapterCount, Number(params.batchEndChapter) || chapterCount));
  const batchTotal = batchEnd - batchStart + 1;
  const isContinuationBatch = batchStart > 1;

  let sourceTitle = (params.existingTitle || '').trim();
  let sourceText = stripHtmlTags(params.existingContent || '');
  let candidateImages: { url: string; alt: string; isFeatured?: boolean; isExternal?: boolean }[] =
    Array.isArray(params.existingImages)
      ? params.existingImages.map((im, idx) => ({
          url: String(im.url || ''),
          alt: String(im.alt || sourceTitle || params.topic || 'Story cover'),
          isFeatured: Boolean(im.isFeatured || idx === 0),
          isExternal: Boolean(im.isExternal),
        }))
      : [];

  const cleanSourceUrl = (params.sourceUrl || '').trim();
  if (!params.sharedCoverImageUrl) {
    if (!isContinuationBatch && cleanSourceUrl && cleanSourceUrl.startsWith('http')) {
      try {
        const scraped = await scrapeWebArticleForSeoRewrite(cleanSourceUrl);
        if (scraped.originalTitle && !sourceTitle) sourceTitle = scraped.originalTitle;
        if (scraped.articleText && scraped.articleText.length > sourceText.length) {
          sourceText = scraped.articleText;
        }
        if (scraped.images && scraped.images.length > 0 && candidateImages.length === 0) {
          candidateImages = scraped.images.slice(0, 6).map((im, idx) => ({
            url: im.url,
            alt: im.alt || sourceTitle || 'Story cover',
            isFeatured: idx === 0,
            isExternal: false,
          }));
        }
      } catch {}
    }

    if (!isContinuationBatch && candidateImages.length === 0) {
      try {
        const disc = await tryDiscoverSourceArticleImagesFromText(
          sourceTitle || params.topic,
          sourceText || params.topic,
          []
        );
        if (disc && disc.images.length > 0) {
          candidateImages = disc.images.slice(0, 6).map((im, idx) => ({
            url: im.url,
            alt: im.alt || sourceTitle || params.topic,
            isFeatured: idx === 0,
            isExternal: false,
          }));
        }
      } catch {}
    }

    if (!isContinuationBatch && candidateImages.length === 0 && (sourceTitle || params.topic)) {
      try {
        const ctx = analyzeArticleSubjectAndContext(
          sourceTitle || params.topic,
          sourceText || params.topic,
          params.topic,
          candidateImages
        );
        const ext = await searchExternalRelatedImages(
          ctx?.combinedSearchQuery || sourceTitle || params.topic,
          4,
          new Set(),
          ctx
        );
        if (ext.length > 0) {
          candidateImages = ext.slice(0, 4).map((im, idx) => ({
            url: im.url,
            alt: im.alt || sourceTitle || params.topic,
            isFeatured: idx === 0,
            isExternal: true,
          }));
        }
      } catch {}
    }
  }

  // CHỈ CHỌN 1 ẢNH ĐẠI DIỆN DUY NHẤT ĐỂ DÙNG CHUNG CHO TẤT CẢ CÁC CHƯƠNG
  const singleCoverUrl = (params.sharedCoverImageUrl || candidateImages[0]?.url || '').trim();
  const singleCoverList = candidateImages.slice(0, 6).map((im, idx) => ({
    ...im,
    isFeatured: idx === 0,
  }));

  const ai = createFreeGeminiClient();
  const promptInputText = [
    params.topic ? `User Premise / Story Core:\n${params.topic.trim()}` : '',
    sourceTitle ? `Story Title:\n${sourceTitle}` : '',
    sourceText ? `Reference Facts / Story Material:\n${sourceText.slice(0, 10000)}` : '',
    params.previousStoryContext
      ? `Previous Chapters Continuity (Continue DIRECTLY from this plot point, do NOT repeat events already told):\n${params.previousStoryContext.slice(0, 4000)}`
      : '',
    params.keyword ? `Focus Keyword: ${params.keyword}` : '',
    params.categoryName ? `Category: ${params.categoryName}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const styleGuide = STORY_STYLE_DESCRIPTIONS[storyStyle][language];
  const povInstruction =
    storyPov === 'first_person'
      ? language === 'vi'
        ? 'Kể theo ngôi thứ nhất ("Tôi"), giọng văn tự sự giàu cảm xúc.'
        : 'Tell the story in immersive first-person ("I") voice with vivid personal emotion.'
      : language === 'vi'
      ? 'Kể theo ngôi thứ ba toàn tri, miêu tả sâu tâm lý nhân vật và bối cảnh điện ảnh.'
      : 'Tell the story in cinematic third-person narrative with rich character depth and dialogue.';

  const systemInstruction =
    language === 'vi'
      ? `Bạn là nhà văn viết truyện dài kỳ chuyên nghiệp cho website https://movieshd4k.com/.
Nhiệm vụ hiện tại: Sáng tác ĐÚNG ${batchTotal} chương (từ Chương ${batchStart} đến Chương ${batchEnd}) nằm trong bộ truyện tổng cộng ${chapterCount} chương liên kết chặt chẽ:
1. ${batchStart === 1 ? 'CHƯƠNG 1 LÀ NỘI DUNG CHÍNH (Main Story): Mở đầu cuốn hút, giới thiệu trọn vẹn nhân vật, bối cảnh, mâu thuẫn trung tâm và móc nối dẫn thẳng sang Chương 2.' : `CHƯƠNG ${batchStart}..${batchEnd}: Tiếp nối TRỰC TIẾP mạch truyện và tình huống cuối cùng từ Chương ${batchStart - 1}, phát triển diễn biến mới mẻ không lặp lại, đẩy cao kịch tính qua từng chương.`}
2. ${batchEnd === chapterCount ? `Chương ${batchEnd} là chương kết trọn vẹn (giải quyết nút thắt, cao trào cảm xúc và dư âm sâu sắc).` : `Chương ${batchEnd} kết thúc bằng điểm móc nối hấp dẫn để dẫn tiếp sang Chương ${batchEnd + 1}.`}
3. ĐỘ DÀI & PHONG CÁCH XUỐNG DÒNG LIÊN TỤC: MỖI CHƯƠNG dài TẦM 500 TỪ (460–580 từ MỖI CHƯƠNG) nhưng PHẢI chia thành 16–24 đoạn ngắn trong mảng "paragraphs".
4. QUY TẮC 1–3 DÒNG MỖI ĐOẠN: MỖI phần tử trong "paragraphs" CHỈ DÀI ĐÚNG 1 ĐẾN 3 DÒNG (1–2 câu ngắn, khoảng 15–38 từ), tuyệt đối KHÔNG viết đoạn văn dài 4–8 dòng. Tách riêng từng hành động nhỏ, ánh mắt, lời thoại, khoảng lặng suy tư thành từng đoạn 1–3 dòng xuống dòng liên tục để kéo dài mạch truyện cuốn hút và dễ đọc.
5. Số thứ tự chapterNumber trong JSON phải đánh đúng từ ${batchStart} đến ${batchEnd}.
6. Phong cách: ${styleGuide}. Góc nhìn: ${povInstruction}.`
      : `You are a professional serialized fiction author writing multi-chapter stories for https://movieshd4k.com/.
Current assignment: Write EXACTLY ${batchTotal} connected chapters (Chapters ${batchStart} through ${batchEnd} of a ${chapterCount}-chapter series):
1. ${batchStart === 1 ? 'CHAPTER 1 IS THE MAIN STORY CONTENT: Hook readers immediately, introduce core characters, setting, and central conflict, ending on a cliffhanger leading into Chapter 2.' : `CHAPTERS ${batchStart}..${batchEnd}: Continue DIRECTLY from Chapter ${batchStart - 1} with fresh escalating events, vivid dialogue, and zero repetition.`}
2. ${batchEnd === chapterCount ? `Chapter ${batchEnd} brings the full narrative arc to its emotional climax and satisfying resolution.` : `Chapter ${batchEnd} ends with an engaging hook leading seamlessly into Chapter ${batchEnd + 1}.`}
3. STRICT WORD COUNT & LINE-BREAK PACING: EVERY SINGLE CHAPTER must be around 500 words (460–580 words PER CHAPTER), broken into 16–24 short micro-paragraphs in the "paragraphs" array.
4. STRICT 1–3 LINE RULE: EVERY item in "paragraphs" MUST be ONLY 1 to 3 short lines (1–2 crisp sentences, ~15–38 words max). NEVER write dense 4+ line blocks! Break actions, dialogue beats, reactions, and quiet pauses onto separate 1–3 line paragraphs with continuous line breaks to stretch the story pace effortlessly.
5. Set chapterNumber in JSON cleanly from ${batchStart} to ${batchEnd}.
6. Style: ${styleGuide}. POV: ${povInstruction}.`;

  let usedGemini = false;
  let warning = '';
  let generatedTitle = sourceTitle || params.topic.slice(0, 90);
  let generatedSlug = params.existingSlug || slugifyStory(generatedTitle);
  let generatedExcerpt = '';
  let generatedTags: string[] = [];
  let chapters: StoryChapterPayload[] = [];

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: STORY_AI_MODEL,
        contents: `${promptInputText}\n\nWrite ${batchTotal} tightly linked chapters numbered strictly from Chapter ${batchStart} to Chapter ${batchEnd} (out of ${chapterCount} total chapters) in ${
          language === 'vi' ? 'Vietnamese' : 'English'
        }. EACH chapter MUST be ~500 words divided into 16-24 ultra-readable short paragraphs where every single paragraph is strictly 1-3 lines (15-38 words max, continuous line breaks). Return strictly valid JSON matching the schema.`,
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
                    chapterNumber: { type: Type.INTEGER },
                    heading: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    paragraphs: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ['chapterNumber', 'heading', 'paragraphs'],
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
        if (!isContinuationBatch && parsed.title) generatedTitle = String(parsed.title).trim();
        if (!params.existingSlug && parsed.slug) {
          generatedSlug = slugifyStory(String(parsed.slug)) || slugifyStory(generatedTitle);
        }
        if (parsed.excerpt) generatedExcerpt = String(parsed.excerpt).trim();
        if (Array.isArray(parsed.tags)) {
          generatedTags = parsed.tags.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 8);
        }
        if (Array.isArray(parsed.chapters) && parsed.chapters.length > 0) {
          const baseSlug = generatedSlug || slugifyStory(generatedTitle) || `story-${Date.now()}`;
          chapters = parsed.chapters.slice(0, batchTotal).map((ch: any, idx: number) => {
            const chNum = batchStart + idx;
            const isMain = chNum === 1;
            const heading = String(
              ch.heading ||
                (language === 'vi'
                  ? isMain
                    ? 'Chương 1 (Nội dung chính)'
                    : `Chương ${chNum}`
                  : isMain
                  ? 'Chapter 1 (Main Story)'
                  : `Chapter ${chNum}`)
            ).trim();
            const paras = Array.isArray(ch.paragraphs)
              ? ch.paragraphs.map((p: any) => String(p).trim()).filter(Boolean)
              : [];
            const contentHtml = buildSingleChapterHtml({
              heading,
              paragraphs: paras,
              sharedCoverImageUrl: singleCoverUrl,
              storyTitle: generatedTitle,
            });
            return {
              chapterNumber: chNum,
              heading,
              slug: isMain ? baseSlug : `${baseSlug}-chuong-${chNum}`,
              contentHtml,
              excerpt: String(ch.summary || paras[0] || generatedTitle).slice(0, 160),
              wordCount: countWords(contentHtml),
              isMainContent: isMain,
            };
          });
          usedGemini = true;
        }
      }
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      warning =
        msg.includes('429') || msg.toLowerCase().includes('quota')
          ? 'Gemini Free Tier đang chạm giới hạn lượt gọi tạm thời — đã dựng bộ chương ~500 từ/chương dự phòng để bạn chỉnh sửa ngay.'
          : `Không gọi được Gemini Free Tier (${msg.slice(0, 120)}) — đã tạo bộ chương dự phòng.`;
    }
  } else {
    warning =
      'Chưa phát hiện GEMINI_API_KEY trên máy chủ — đã tạo bộ truyện nhiều chương (~500 từ/chương) dùng chung 1 ảnh đại diện để bạn chỉnh sửa hoặc thêm key để AI viết sâu hơn.';
  }

  if (chapters.length === 0) {
    const fallback = buildFallbackMultiChapterStory({
      title: generatedTitle,
      sourceText: sourceText || params.topic,
      language,
      chapterCount,
      batchStartChapter: batchStart,
      batchEndChapter: batchEnd,
      existingSlug: generatedSlug,
      sharedCoverImageUrl: singleCoverUrl,
    });
    generatedTitle = fallback.title;
    generatedSlug = fallback.slug;
    generatedExcerpt = fallback.excerpt;
    generatedTags = fallback.tags;
    chapters = fallback.chapters;
  }

  const totalWords = chapters.reduce((acc, c) => acc + c.wordCount, 0);
  const readingMinutes = Math.max(1, Math.round(totalWords / 200));

  return {
    ok: true,
    usedGemini,
    model: STORY_AI_MODEL,
    ...(warning ? { warning } : {}),
    title: generatedTitle,
    slug: generatedSlug || slugifyStory(generatedTitle) || `story-${Date.now()}`,
    excerpt: generatedExcerpt || chapters[0]?.excerpt || generatedTitle,
    tags: generatedTags,
    content: chapters[0]?.contentHtml || '',
    chapters,
    wordCount: totalWords,
    chapterCount: chapters.length,
    readingMinutes,
    featuredImageUrl: singleCoverUrl,
    images: singleCoverList,
    sourceUrl: cleanSourceUrl || undefined,
  };
}

function extractHiddenInputValue(html: string, fieldName: string): string {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m1 = html.match(new RegExp(`name=["']${escaped}["'][^>]*value=["']([^"']*)["']`, 'i'));
  if (m1 && m1[1] !== undefined) return m1[1];
  const m2 = html.match(new RegExp(`value=["']([^"']*)["'][^>]*name=["']${escaped}["']`, 'i'));
  return m2 && m2[1] !== undefined ? m2[1] : '';
}

export async function publishLinkedNpChapterOnMoviesHd4k(params: {
  chapterPostId?: number;
  storyId: number;
  chapterNumber: number;
  storyTitle: string;
  chapterHeading: string;
  slug?: string;
  contentHtml: string;
  excerpt?: string;
  status?: 'publish' | 'draft' | 'pending';
  featuredMediaId?: number;
  featuredImageUrl?: string;
  employeeCode?: string;
}): Promise<{
  ok: boolean;
  chapterNumber: number;
  postId: number;
  title: string;
  link: string;
  trackingLink: string;
  status: string;
}> {
  let session = await getMoviesHd4kSession(false);

  const openEditorUrl = params.chapterPostId
    ? `${DEFAULT_MOVIES_SITE}/wp-admin/post.php?post=${params.chapterPostId}&action=edit`
    : `${DEFAULT_MOVIES_SITE}/wp-admin/post-new.php?post_type=np_chapter`;

  let editorRes = await fetch(openEditorUrl, {
    headers: {
      Cookie: session.cookieHeader,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36',
    },
  });

  if (editorRes.url.includes('nghean3737') || editorRes.url.includes('wp-login')) {
    session = await getMoviesHd4kSession(true);
    editorRes = await fetch(openEditorUrl, {
      headers: { Cookie: session.cookieHeader },
    });
  }

  const editorHtml = await editorRes.text();
  const postId = extractHiddenInputValue(editorHtml, 'post_ID') || String(params.chapterPostId || '');
  const wpNonce = extractHiddenInputValue(editorHtml, '_wpnonce');
  const npChapterNonce = extractHiddenInputValue(editorHtml, 'np_chapter_nonce');
  const userId = extractHiddenInputValue(editorHtml, 'user_ID') || '1';
  const originalStatus = extractHiddenInputValue(editorHtml, 'original_post_status') || 'auto-draft';

  if (!postId || !wpNonce) {
    throw new Error(`Không mở được trình tạo chương (np_chapter) trên ${DEFAULT_MOVIES_SITE}.`);
  }

  const chapterFullTitle = params.chapterHeading.trim()
    ? `${params.chapterHeading.trim()}`
    : `${params.storyTitle.trim()} - Chương ${params.chapterNumber}`;

  const wpStatus = params.status === 'draft' ? 'draft' : 'publish';
  const form = new URLSearchParams({
    _wpnonce: wpNonce,
    _wp_http_referer: params.chapterPostId
      ? `/wp-admin/post.php?post=${postId}&action=edit`
      : '/wp-admin/post-new.php?post_type=np_chapter',
    user_ID: userId,
    action: 'editpost',
    originalaction: 'editpost',
    post_author: userId,
    post_type: 'np_chapter',
    original_post_status: originalStatus,
    post_ID: postId,
    post_title: chapterFullTitle,
    post_name: params.slug ? slugifyStory(params.slug) : slugifyStory(`${params.storyTitle}-chuong-${params.chapterNumber}`),
    content: params.contentHtml,
    excerpt: params.excerpt || '',
    post_status: wpStatus,
    ...(wpStatus === 'publish' ? { publish: 'Đăng' } : { save: 'Lưu nháp' }),
    ...(npChapterNonce ? { np_chapter_nonce: npChapterNonce } : {}),
    np_story_id: String(params.storyId),
    np_chapter_number: String(params.chapterNumber),
    _thumbnail_id: params.featuredMediaId && params.featuredMediaId > 0 ? String(params.featuredMediaId) : '-1',
  });

  const saveRes = await fetch(`${DEFAULT_MOVIES_SITE}/wp-admin/post.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: session.cookieHeader,
      Origin: DEFAULT_MOVIES_SITE,
      Referer: openEditorUrl,
    },
    body: form.toString(),
    redirect: 'manual',
  });

  if (saveRes.status >= 400) {
    const errTxt = await saveRes.text().catch(() => '');
    throw new Error(`Không lưu được Chương ${params.chapterNumber} (${saveRes.status}): ${errTxt.slice(0, 160)}`);
  }

  let chapterLink = `${DEFAULT_MOVIES_SITE}/?post_type=np_chapter&p=${postId}`;
  try {
    const verifyRes = await fetch(
      `${DEFAULT_MOVIES_SITE}/wp-json/wp/v2/np_chapter/${postId}?context=edit`,
      {
        headers: {
          Cookie: session.cookieHeader,
          'X-WP-Nonce': session.restNonce,
          Accept: 'application/json',
        },
      }
    );
    if (verifyRes.ok) {
      const chJson = (await verifyRes.json()) as any;
      if (chJson?.link) chapterLink = String(chJson.link);
    }
  } catch {}

  const empCode = (params.employeeCode || '').trim().toUpperCase();
  const trackingLink = empCode
    ? `${chapterLink}${chapterLink.includes('?') ? '&' : '?'}${empCode}`
    : chapterLink;

  return {
    ok: true,
    chapterNumber: params.chapterNumber,
    postId: Number(postId),
    title: chapterFullTitle,
    link: chapterLink,
    trackingLink,
    status: wpStatus,
  };
}

export function buildChapterNavigationFooterHtml(params: {
  currentChapterNumber: number;
  language: 'en' | 'vi';
  chapters: { chapterNumber: number; heading: string; link: string; isMainContent?: boolean }[];
}): string {
  const isVi = params.language === 'vi';
  const sorted = [...params.chapters].sort((a, b) => a.chapterNumber - b.chapterNumber);
  const idx = sorted.findIndex((c) => c.chapterNumber === params.currentChapterNumber);
  const prev = idx > 0 ? sorted[idx - 1] : null;
  const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
  const mainCh = sorted[0];

  const navButtons: string[] = [];
  if (prev) {
    navButtons.push(
      `<a href="${escapeHtml(prev.link)}" style="display:inline-block;padding:8px 14px;background:#f1f5f9;color:#0f172a;border-radius:6px;text-decoration:none;font-weight:600;">← ${
        isVi ? `Chương ${prev.chapterNumber}` : `Chapter ${prev.chapterNumber}`
      }</a>`
    );
  }
  if (mainCh && params.currentChapterNumber !== mainCh.chapterNumber) {
    navButtons.push(
      `<a href="${escapeHtml(mainCh.link)}" style="display:inline-block;padding:8px 14px;background:#e0e7ff;color:#312e81;border-radius:6px;text-decoration:none;font-weight:700;">📖 ${
        isVi ? 'Chương 1 (Nội dung chính)' : 'Chapter 1 (Main Story)'
      }</a>`
    );
  }
  if (next) {
    navButtons.push(
      `<a href="${escapeHtml(next.link)}" style="display:inline-block;padding:8px 16px;background:#4f46e5;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:700;">${
        isVi ? `Đọc tiếp Chương ${next.chapterNumber}` : `Next: Chapter ${next.chapterNumber}`
      } →</a>`
    );
  }

  const tocItems = sorted
    .map((c) => {
      const label = escapeHtml(c.heading);
      if (c.chapterNumber === params.currentChapterNumber) {
        return `<li><strong>${label} (${isVi ? 'Đang đọc' : 'Reading'})</strong></li>`;
      }
      return `<li><a href="${escapeHtml(c.link)}">${label}</a></li>`;
    })
    .join('\n');

  return `<hr class="wp-block-separator" />
<div class="story-chapter-navigation" style="margin:24px 0;padding:18px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
  <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-bottom:14px;">
    ${navButtons.join('\n    ')}
  </div>
  <div style="font-weight:700;margin-bottom:8px;color:#1e293b;">
    ${isVi ? 'Danh sách các chương liên kết:' : 'Connected Story Chapters:'}
  </div>
  <ul style="margin:0;padding-left:20px;line-height:1.8;">
    ${tocItems}
  </ul>
</div>`;
}

export async function linkChaptersContentOnMoviesHd4k(params: {
  postType: 'posts' | 'np_story';
  language?: 'en' | 'vi';
  featuredMediaId?: number;
  chapters: {
    chapterNumber: number;
    postId: number;
    heading: string;
    link: string;
    baseContentHtml: string;
    isMainContent?: boolean;
  }[];
  allChapters?: {
    chapterNumber: number;
    heading: string;
    link: string;
    isMainContent?: boolean;
  }[];
}): Promise<{ ok: boolean; updatedCount: number }> {
  const session = await getMoviesHd4kSession(false);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Cookie: session.cookieHeader,
    'X-WP-Nonce': session.restNonce,
  };
  const lang = params.language === 'vi' ? 'vi' : 'en';
  const tocChapters =
    Array.isArray(params.allChapters) && params.allChapters.length > 0
      ? params.allChapters
      : params.chapters;

  let updatedCount = 0;
  for (let i = 0; i < params.chapters.length; i += 5) {
    const chunk = params.chapters.slice(i, i + 5);
    const results = await Promise.all(
      chunk.map(async (ch) => {
        const cleanBase = ch.baseContentHtml.replace(
          /<hr class="wp-block-separator" \/>\s*<div class="story-chapter-navigation"[\s\S]*$/i,
          ''
        );
        const navFooter = buildChapterNavigationFooterHtml({
          currentChapterNumber: ch.chapterNumber,
          language: lang,
          chapters: tocChapters,
        });
        const fullContent = `${cleanBase.trim()}\n\n${navFooter}`;
        const collection =
          params.postType === 'posts'
            ? 'posts'
            : ch.isMainContent || ch.chapterNumber === 1
            ? 'np_story'
            : 'np_chapter';

        const bodyPayload: Record<string, any> = {
          content: fullContent,
        };
        if (params.featuredMediaId && params.featuredMediaId > 0) {
          bodyPayload.featured_media = params.featuredMediaId;
        }

        const r = await fetch(`${DEFAULT_MOVIES_SITE}/wp-json/wp/v2/${collection}/${ch.postId}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(bodyPayload),
        });
        return r.ok;
      })
    );
    updatedCount += results.filter(Boolean).length;
  }

  return {
    ok: true,
    updatedCount,
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
  featuredMediaId?: number;
  featuredImageUrl?: string;
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

  let finalFeaturedMediaId = Number(params.featuredMediaId || 0);
  let finalFeaturedImageUrl = params.featuredImageUrl || '';
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
      if (uploaded.mediaUrl) finalFeaturedImageUrl = uploaded.mediaUrl;
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

  const resolvedPostType: 'posts' | 'np_story' = params.postType === 'posts' ? 'posts' : 'np_story';
  const restCollection = resolvedPostType === 'np_story' ? 'np_story' : 'posts';

  const tagIds: number[] = [];
  if (resolvedPostType === 'posts' && Array.isArray(params.tags) && params.tags.length > 0) {
    for (const rawTag of params.tags.slice(0, 4)) {
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
        : [12];
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
    featuredMediaId: finalFeaturedMediaId,
    featuredImageUrl: finalFeaturedImageUrl,
    postType: resolvedPostType,
    link: postLink,
    trackingLink,
    status: String(createdPost.status || params.status || 'publish'),
    message: params.postId
      ? `Đã cập nhật Chương 1 (Nội dung chính) #${createdPost.id} trên ${targetSite}!`
      : `Đã đăng Chương 1 (Nội dung chính) #${createdPost.id} lên ${targetSite} thành công!`,
  };
}

export async function fetchLinkedChaptersForStory(params: {
  storyId: number;
  storyLink?: string;
}): Promise<{
  ok: boolean;
  chapters: {
    chapterNumber: number;
    postId: number;
    heading: string;
    slug: string;
    contentHtml: string;
    link: string;
    featuredMediaId: number;
  }[];
}> {
  const session = await getMoviesHd4kSession(false);
  const authHeaders = {
    Accept: 'application/json',
    Cookie: session.cookieHeader,
    'X-WP-Nonce': session.restNonce,
  };

  let targetLink = (params.storyLink || '').trim();
  if (!targetLink && params.storyId > 0) {
    try {
      const sRes = await fetch(`${DEFAULT_MOVIES_SITE}/wp-json/wp/v2/np_story/${params.storyId}`, {
        headers: authHeaders,
      });
      if (sRes.ok) {
        const sJson = (await sRes.json()) as any;
        if (sJson?.link) targetLink = String(sJson.link);
      }
    } catch {}
  }

  const chapterLinks: string[] = [];
  if (targetLink) {
    try {
      const htmlRes = await fetch(targetLink, { headers: { Cookie: session.cookieHeader } });
      if (htmlRes.ok) {
        const pageHtml = await htmlRes.text();
        const sectionMatch = pageHtml.match(/<section[^>]*chapter-section[^>]*>([\s\S]*?)<\/section>/i);
        const zone = sectionMatch ? sectionMatch[1] : pageHtml;
        const hrefMatches = [...zone.matchAll(/href=["']([^"']*\/chuong\/[^"']+)["']/gi)];
        hrefMatches.forEach((m) => {
          const url = String(m[1] || '').replace(/\/+$/, '');
          if (url && !chapterLinks.includes(url)) chapterLinks.push(url);
        });
      }
    } catch {}
  }

  const allChaptersRes = await fetch(
    `${DEFAULT_MOVIES_SITE}/wp-json/wp/v2/np_chapter?per_page=100&status=publish,draft,pending,future`,
    { headers: authHeaders }
  ).catch(() => null);
  const allChapters = allChaptersRes && allChaptersRes.ok ? ((await allChaptersRes.json()) as any[]) : [];

  const matched = (Array.isArray(allChapters) ? allChapters : [])
    .filter((c) => {
      const cleanLink = String(c.link || '').replace(/\/+$/, '');
      return chapterLinks.some((u) => u === cleanLink || cleanLink.endsWith(new URL(u).pathname.replace(/\/+$/, '')));
    })
    .map((c, idx) => {
      const rawTitle = decodeHtmlEntities(stripHtmlTags(String(c.title?.rendered || '')));
      const numMatch = rawTitle.match(/(?:chương|chapter)\s*(\d+)/i);
      return {
        chapterNumber: numMatch ? Math.max(2, Number(numMatch[1])) : idx + 2,
        postId: Number(c.id),
        heading: rawTitle || `Chương ${idx + 2}`,
        slug: String(c.slug || ''),
        contentHtml: String(c.content?.rendered || ''),
        link: String(c.link || ''),
        featuredMediaId: Number(c.featured_media || 0),
      };
    })
    .sort((a, b) => a.chapterNumber - b.chapterNumber);

  return { ok: true, chapters: matched };
}

