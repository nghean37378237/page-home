// Vercel Serverless Function for /api/movieshd4k-publish (100% Self-Contained Pure JS)
import { GoogleGenAI, Type } from '@google/genai';

const DEFAULT_MOVIES_SITE = (process.env.MOVIESHD4K_SITE_URL || 'https://movieshd4k.com').replace(/\/+$/, '');
const DEFAULT_MOVIES_LOGIN_URL = (
  process.env.MOVIESHD4K_LOGIN_URL || `${DEFAULT_MOVIES_SITE}/nghean3737`
).replace(/\/+$/, '');
const DEFAULT_MOVIES_USER = process.env.MOVIESHD4K_USERNAME || 'admin';
const DEFAULT_MOVIES_PASS = process.env.MOVIESHD4K_PASSWORD || 'Biencualo8282$$';

const STORY_AI_MODEL = 'gemini-4-hydrogen'; // Free-tier Gemini model
const SCRAPER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const WP_EMPLOYEE_AUTHOR_MAP = [
  { code: 'M2001', wpUserId: 2, wpUsername: 'Ly', displayName: 'Ms Ly (M2001)', staffUsername: 'MS.LY' },
  { code: 'H2000', wpUserId: 3, wpUsername: 'Huyen', displayName: 'Ms Huyen (H2000)', staffUsername: 'MS.HUYEN' },
  { code: 'H0088', wpUserId: 4, wpUsername: 'Hiep', displayName: 'Hiep MS (H0088)', staffUsername: 'MSHIEP' },
  { code: 'A0005', wpUserId: 5, wpUsername: 'Nhi', displayName: 'Ms Nhi (A0005)', staffUsername: 'MS.NHI' },
  { code: 'A0006', wpUserId: 6, wpUsername: 'adgoole', displayName: 'Mr Google (A0006)', staffUsername: 'Quản Lý (Admin)' },
  { code: 'H0082', wpUserId: 1, wpUsername: 'admin', displayName: 'Admin (H0082)', staffUsername: 'Admin' },
];

let cachedMoviesSession = null;

function fetchWithTimeout(url, options = {}, timeoutMs = 5500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function decodeHtmlEntities(text) {
  if (!text) return '';
  return String(text)
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

function stripHtmlTags(html) {
  if (!html) return '';
  return decodeHtmlEntities(String(html).replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugifyStory(input) {
  return String(input || '')
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

function resolveAbsoluteUrl(rawUrl, baseUrl) {
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

function isJunkImageUrl(url, altText = '') {
  const lower = String(url || '').toLowerCase().trim();
  if (
    !lower ||
    !lower.startsWith('http') ||
    lower.endsWith('.svg') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.ico') ||
    lower.includes('.svg?') ||
    lower.includes('.gif?') ||
    lower.includes('gravatar.com') ||
    lower.includes('/plugins/') ||
    lower.includes('/themes/') ||
    lower.includes('emoji') ||
    lower.includes('favicon') ||
    lower.includes('site-logo') ||
    lower.includes('custom-logo') ||
    lower.includes('avatar') ||
    lower.includes('pixel') ||
    lower.includes('doubleclick') ||
    lower.includes('googlesyndication') ||
    lower.includes('mgid.com') ||
    lower.includes('taboola') ||
    lower.includes('outbrain') ||
    lower.includes('1x1') ||
    lower.includes('spacer') ||
    lower.includes('placeholder') ||
    lower.includes('adbanner') ||
    lower.includes('ad-banner')
  ) {
    return true;
  }
  const lowerAlt = String(altText || '').toLowerCase().trim();
  if (/^(advertisement|sponsored|promoted|ad|ads|banner|quảng cáo|tài trợ)$/i.test(lowerAlt)) {
    return true;
  }
  return false;
}

function createFreeGeminiClient() {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
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

async function attemptWpCookieLogin(loginEndpoint, siteUrl, username, password) {
  let seedCookie = 'wordpress_test_cookie=WP%20Cookie%20check';
  let formActionUrl = loginEndpoint;

  try {
    const preRes = await fetchWithTimeout(
      loginEndpoint,
      {
        method: 'GET',
        headers: { 'User-Agent': SCRAPER_USER_AGENT },
        redirect: 'manual',
      },
      4500
    );
    const preCookies = preRes.headers.getSetCookie ? preRes.headers.getSetCookie() : [];
    const prePairs = preCookies.map((c) => c.split(';')[0]).filter(Boolean);
    if (prePairs.length > 0) {
      seedCookie = prePairs.join('; ');
    }
    if (preRes.ok) {
      const preHtml = await preRes.text();
      const actionMatch = preHtml.match(
        /<form[^>]*name=["']loginform["'][^>]*action=["']([^"']+)["']/i
      );
      if (actionMatch && actionMatch[1]) {
        formActionUrl = actionMatch[1];
      }
    }
  } catch {
    // fallback to default formActionUrl & seedCookie
  }

  const body = new URLSearchParams({
    log: username,
    pwd: password,
    rememberme: 'forever',
    'wp-submit': 'Log In',
    redirect_to: `${siteUrl}/wp-admin/`,
    testcookie: '1',
  });

  const loginRes = await fetchWithTimeout(
    formActionUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: seedCookie,
        Origin: siteUrl,
        Referer: loginEndpoint,
        'User-Agent': SCRAPER_USER_AGENT,
      },
      body: body.toString(),
      redirect: 'manual',
    },
    5500
  );

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

async function getMoviesHd4kSession(forceRefresh = false) {
  if (!forceRefresh && cachedMoviesSession && cachedMoviesSession.expiresAt > Date.now()) {
    return cachedMoviesSession;
  }

  const candidates = [DEFAULT_MOVIES_LOGIN_URL, `${DEFAULT_MOVIES_SITE}/wp-login.php`];
  let cookieHeader = '';
  for (const endpoint of candidates) {
    try {
      cookieHeader = await attemptWpCookieLogin(
        endpoint,
        DEFAULT_MOVIES_SITE,
        DEFAULT_MOVIES_USER,
        DEFAULT_MOVIES_PASS
      );
      if (cookieHeader.includes('wordpress_logged_in_')) {
        break;
      }
    } catch {
      // try next login endpoint
    }
  }

  if (!cookieHeader.includes('wordpress_logged_in_')) {
    throw new Error(
      `Không thể đăng nhập vào WordPress ${DEFAULT_MOVIES_SITE} (cổng ${DEFAULT_MOVIES_LOGIN_URL}). Kiểm tra lại tài khoản hoặc bật Application Password trong Cài đặt.`
    );
  }

  const postNewRes = await fetchWithTimeout(
    `${DEFAULT_MOVIES_SITE}/wp-admin/post-new.php`,
    {
      headers: {
        Cookie: cookieHeader,
        'User-Agent': SCRAPER_USER_AGENT,
      },
    },
    5500
  );
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
    throw new Error(
      `Đã đăng nhập ${DEFAULT_MOVIES_SITE} nhưng không lấy được X-WP-Nonce từ wp-admin.`
    );
  }

  cachedMoviesSession = {
    cookieHeader,
    restNonce,
    restRoot,
    expiresAt: Date.now() + 20 * 60 * 1000,
  };
  return cachedMoviesSession;
}

async function fetchMoviesHd4kInitData() {
  const catPromise = fetchWithTimeout(
    `${DEFAULT_MOVIES_SITE}/wp-json/wp/v2/categories?per_page=50`,
    { headers: { Accept: 'application/json', 'User-Agent': SCRAPER_USER_AGENT } },
    5000
  )
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []);

  const genrePromise = fetchWithTimeout(
    `${DEFAULT_MOVIES_SITE}/wp-json/wp/v2/np_genre?per_page=50`,
    { headers: { Accept: 'application/json', 'User-Agent': SCRAPER_USER_AGENT } },
    5000
  )
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []);

  let session = null;
  let authWarning = '';
  try {
    session = await getMoviesHd4kSession();
  } catch (err) {
    authWarning = err?.message || 'Chưa kết nối được phiên đăng nhập quản trị';
  }

  const [rawCats, rawGenres] = await Promise.all([catPromise, genrePromise]);
  const categories = Array.isArray(rawCats)
    ? rawCats
        .map((c) => ({
          id: Number(c.id),
          name: decodeHtmlEntities(String(c.name || '')),
          slug: String(c.slug || ''),
          count: Number(c.count || 0),
        }))
        .sort((a, b) => {
          const score = (c) => (c.slug === 'story' ? 3 : c.slug === 'film' ? 2 : c.count > 0 ? 1 : 0);
          return score(b) - score(a) || b.count - a.count;
        })
    : [];

  const genres = Array.isArray(rawGenres)
    ? rawGenres.map((g) => ({
        id: Number(g.id),
        name: decodeHtmlEntities(String(g.name || '')),
        slug: String(g.slug || ''),
        count: Number(g.count || 0),
      }))
    : [];

  let wpUsers = [];
  const rawPosts = [];

  if (session) {
    const authHeaders = {
      Accept: 'application/json',
      Cookie: session.cookieHeader,
      'X-WP-Nonce': session.restNonce,
      'User-Agent': SCRAPER_USER_AGENT,
    };
    const [postsRes, storiesRes, usersRes] = await Promise.all([
      fetchWithTimeout(
        `${DEFAULT_MOVIES_SITE}/wp-json/wp/v2/posts?per_page=30&status=publish,draft,pending,future&_embed=1`,
        { headers: authHeaders },
        5500
      ).catch(() => null),
      fetchWithTimeout(
        `${DEFAULT_MOVIES_SITE}/wp-json/wp/v2/np_story?per_page=30&status=publish,draft,pending,future&_embed=1`,
        { headers: authHeaders },
        5500
      ).catch(() => null),
      fetchWithTimeout(
        `${DEFAULT_MOVIES_SITE}/wp-json/wp/v2/users?per_page=50`,
        { headers: authHeaders },
        5000
      ).catch(() => null),
    ]);

    if (storiesRes && storiesRes.ok) {
      const sJson = await storiesRes.json().catch(() => []);
      if (Array.isArray(sJson)) {
        rawPosts.push(...sJson.map((item) => ({ item, postType: 'np_story' })));
      }
    }
    if (postsRes && postsRes.ok) {
      const pJson = await postsRes.json().catch(() => []);
      if (Array.isArray(pJson)) {
        rawPosts.push(...pJson.map((item) => ({ item, postType: 'posts' })));
      }
    }
    if (usersRes && usersRes.ok) {
      const uJson = await usersRes.json().catch(() => []);
      if (Array.isArray(uJson)) {
        wpUsers = uJson.map((u) => ({
          id: Number(u.id),
          name: String(u.name || u.slug || `User #${u.id}`),
          slug: String(u.slug || ''),
        }));
      }
    }
  } else {
    try {
      const [pubPostsRes, pubStoriesRes] = await Promise.all([
        fetchWithTimeout(
          `${DEFAULT_MOVIES_SITE}/wp-json/wp/v2/posts?per_page=20&_embed=1`,
          { headers: { Accept: 'application/json', 'User-Agent': SCRAPER_USER_AGENT } },
          5000
        ).catch(() => null),
        fetchWithTimeout(
          `${DEFAULT_MOVIES_SITE}/wp-json/wp/v2/np_story?per_page=20&_embed=1`,
          { headers: { Accept: 'application/json', 'User-Agent': SCRAPER_USER_AGENT } },
          5000
        ).catch(() => null),
      ]);
      if (pubStoriesRes && pubStoriesRes.ok) {
        const sJson = await pubStoriesRes.json().catch(() => []);
        if (Array.isArray(sJson)) {
          rawPosts.push(...sJson.map((item) => ({ item, postType: 'np_story' })));
        }
      }
      if (pubPostsRes && pubPostsRes.ok) {
        const pubJson = await pubPostsRes.json().catch(() => []);
        if (Array.isArray(pubJson)) {
          rawPosts.push(...pubJson.map((item) => ({ item, postType: 'posts' })));
        }
      }
    } catch {}
  }

  const catNameById = new Map();
  categories.forEach((c) => catNameById.set(c.id, c.name));
  const genreNameById = new Map();
  genres.forEach((g) => genreNameById.set(g.id, g.name));
  const userNameById = new Map();
  wpUsers.forEach((u) => userNameById.set(u.id, u.name));

  const posts = rawPosts
    .map(({ item: p, postType }) => {
      const catIds =
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
        status: p.status || 'publish',
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

async function scrapeSourceForStory(rawUrl) {
  let cleanUrl = String(rawUrl || '').trim();
  if (!cleanUrl) {
    throw new Error('Vui lòng nhập đường dẫn bài viết/phim hợp lệ');
  }
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = `https://${cleanUrl}`;
  }

  let parsed;
  try {
    parsed = new URL(cleanUrl);
  } catch {
    throw new Error('URL nguồn không hợp lệ');
  }

  let title = '';
  const paragraphs = [];
  const images = [];
  const seenImg = new Set();

  const addImg = (u, alt = '', isFeatured = false) => {
    const abs = resolveAbsoluteUrl(u, cleanUrl);
    if (!abs || isJunkImageUrl(abs, alt)) return;
    const key = abs.split('?')[0].toLowerCase();
    if (seenImg.has(key)) return;
    seenImg.add(key);
    images.push({
      url: abs,
      alt: alt || title || 'Story scene',
      isFeatured,
      isExternal: false,
    });
  };

  // Try direct HTML fetch first
  try {
    const res = await fetchWithTimeout(
      cleanUrl,
      {
        headers: {
          'User-Agent': SCRAPER_USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      },
      5500
    );

    if (res.ok) {
      const html = await res.text();
      const ogTitleMatch =
        html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
        html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (ogTitleMatch && ogTitleMatch[1]) {
        title = decodeHtmlEntities(stripHtmlTags(ogTitleMatch[1]));
      }

      const ogImgMatch =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
      if (ogImgMatch && ogImgMatch[1]) {
        addImg(ogImgMatch[1], title || 'Featured cover', true);
      }

      const cleanBody = html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, '');

      const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
      let pm;
      while ((pm = pRegex.exec(cleanBody)) !== null) {
        const txt = stripHtmlTags(pm[1]);
        if (txt.length >= 35 && !paragraphs.includes(txt)) {
          paragraphs.push(txt);
        }
      }

      const imgRegex = /<img\b[^>]*>/gi;
      let im;
      while ((im = imgRegex.exec(cleanBody)) !== null) {
        const tag = im[0];
        const altM = tag.match(/\balt=["']([^"']*)["']/i);
        const srcM =
          tag.match(/\b(?:data-orig-file|data-large-file|data-original|data-lazy-src|data-src|src)=["']([^"']+)["']/i);
        if (srcM && srcM[1]) {
          addImg(srcM[1], altM ? decodeHtmlEntities(altM[1]) : title, images.length === 0);
        }
      }
    }
  } catch {}

  // Fallback to Jina Reader if blocked/sparse
  if (paragraphs.length < 3 || images.length === 0) {
    try {
      const jinaRes = await fetchWithTimeout(
        `https://r.jina.ai/${cleanUrl}`,
        {
          headers: {
            Accept: 'application/json',
            'X-With-Images-Summary': 'true',
            'User-Agent': SCRAPER_USER_AGENT,
          },
        },
        5500
      );
      if (jinaRes.ok) {
        const jinaJson = await jinaRes.json().catch(() => null);
        const jData = jinaJson?.data || {};
        if (!title && jData.title) {
          title = decodeHtmlEntities(String(jData.title));
        }
        if (jData.content) {
          const md = String(jData.content);
          const mdImgRegex = /!\[([^\]]*)\]\((https?:\/\/[^)\s"']+)\)/gi;
          let mim;
          while ((mim = mdImgRegex.exec(md)) !== null) {
            addImg(mim[2], mim[1] || title, images.length === 0);
          }
          if (paragraphs.length < 3) {
            const lines = md
              .split(/\n+/)
              .map((l) =>
                l
                  .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
                  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
                  .replace(/[*_#>~`]+/g, '')
                  .trim()
              )
              .filter((l) => l.length >= 40);
            for (const l of lines) {
              if (!paragraphs.includes(l)) paragraphs.push(l);
            }
          }
        }
      }
    } catch {}
  }

  return {
    sourceUrl: parsed.href,
    originalTitle: title || 'Câu chuyện từ liên kết nguồn',
    articleText: paragraphs.join('\n\n').slice(0, 14000),
    images: images.slice(0, 10),
  };
}

async function searchBingStoryImages(rawQuery, limit = 6, existingImages = []) {
  const cleanQuery = String(rawQuery || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);

  if (!cleanQuery) return [];

  const excludeKeys = new Set(
    (Array.isArray(existingImages) ? existingImages : []).map((im) =>
      String(im?.url || '')
        .split('?')[0]
        .toLowerCase()
    )
  );

  const results = [];
  try {
    const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(
      cleanQuery
    )}&setmkt=en-US&setlang=en-US&cc=US&first=1`;
    const res = await fetchWithTimeout(
      searchUrl,
      {
        headers: {
          'User-Agent': SCRAPER_USER_AGENT,
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
      4500
    );
    if (res.ok) {
      const html = await res.text();
      const matches = html.matchAll(/m="(\{[^"]+\})"/g);
      for (const m of matches) {
        if (results.length >= limit) break;
        try {
          const obj = JSON.parse(decodeHtmlEntities(m[1]));
          const imgUrl = String(obj.murl || '').trim();
          const altText = decodeHtmlEntities(String(obj.t || cleanQuery)).trim();
          if (!imgUrl || isJunkImageUrl(imgUrl, altText)) continue;
          const key = imgUrl.split('?')[0].toLowerCase();
          if (excludeKeys.has(key)) continue;
          excludeKeys.add(key);
          results.push({
            url: imgUrl,
            alt: altText || cleanQuery,
            isFeatured: false,
            isExternal: true,
          });
        } catch {}
      }
    }
  } catch {}

  return results;
}

async function uploadMediaToMoviesHd4k(params) {
  let buffer;
  let mimeType = 'image/jpeg';
  let finalFileName = String(params.fileName || `story-cover-${Date.now()}.jpg`).replace(
    /[^a-zA-Z0-9._-]/g,
    '-'
  );

  if (params.base64Data) {
    const match = String(params.base64Data).match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      buffer = Buffer.from(match[2], 'base64');
      const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
      if (!finalFileName.includes('.')) finalFileName = `${finalFileName}.${ext}`;
    } else {
      buffer = Buffer.from(String(params.base64Data), 'base64');
    }
  } else if (params.imageUrl) {
    let parsedOrigin = DEFAULT_MOVIES_SITE;
    try {
      parsedOrigin = new URL(params.imageUrl).origin;
    } catch {}
    const imgRes = await fetchWithTimeout(
      params.imageUrl,
      {
        headers: {
          'User-Agent': SCRAPER_USER_AGENT,
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          Referer: `${parsedOrigin}/`,
        },
      },
      5000
    );
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
    Boolean(String(params.customWpUrl || '').trim()) &&
    Boolean(String(params.customWpUser || '').trim()) &&
    Boolean(String(params.customWpAppPassword || '').trim());

  const targetSite = useCustomBasic
    ? String(params.customWpUrl).trim().replace(/\/+$/, '')
    : DEFAULT_MOVIES_SITE;

  const headers = {
    'Content-Disposition': `attachment; filename="${finalFileName}"`,
    'Content-Type': mimeType,
    Accept: 'application/json',
  };

  if (useCustomBasic) {
    const token = Buffer.from(
      `${String(params.customWpUser).trim()}:${String(params.customWpAppPassword).trim()}`
    ).toString('base64');
    headers.Authorization = `Basic ${token}`;
  } else {
    const session = await getMoviesHd4kSession();
    headers.Cookie = session.cookieHeader;
    headers['X-WP-Nonce'] = session.restNonce;
  }

  let uploadRes = await fetchWithTimeout(
    `${targetSite}/wp-json/wp/v2/media`,
    {
      method: 'POST',
      headers,
      body: new Uint8Array(buffer),
    },
    6500
  );

  if ((uploadRes.status === 401 || uploadRes.status === 403) && !useCustomBasic) {
    const freshSession = await getMoviesHd4kSession(true);
    headers.Cookie = freshSession.cookieHeader;
    headers['X-WP-Nonce'] = freshSession.restNonce;
    uploadRes = await fetchWithTimeout(
      `${targetSite}/wp-json/wp/v2/media`,
      {
        method: 'POST',
        headers,
        body: new Uint8Array(buffer),
      },
      6500
    );
  }

  const uploadText = await uploadRes.text();
  if (!uploadRes.ok) {
    throw new Error(`Lỗi upload ảnh lên ${targetSite} (${uploadRes.status}): ${uploadText.slice(0, 220)}`);
  }

  const uploadedJson = JSON.parse(uploadText);
  const mediaId = Number(uploadedJson.id || 0);
  const mediaUrl = String(uploadedJson.source_url || '');

  if (mediaId > 0 && params.altText) {
    fetchWithTimeout(
      `${targetSite}/wp-json/wp/v2/media/${mediaId}`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ alt_text: params.altText }),
      },
      3000
    ).catch(() => {});
  }

  return {
    mediaId,
    mediaUrl,
    fileName: finalFileName,
  };
}

const STORY_STYLE_DESCRIPTIONS = {
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

function interleaveStoryImages(chapters, images, storyTitle) {
  const usableImages = (Array.isArray(images) ? images : [])
    .map((im) => ({ url: String(im?.url || '').trim(), alt: String(im?.alt || storyTitle).trim() }))
    .filter((im) => im.url.startsWith('http'));

  const htmlParts = [];
  let imgCursor = 0;

  chapters.forEach((ch, idx) => {
    htmlParts.push(`<h2>${escapeHtml(ch.heading)}</h2>`);
    const paras = Array.isArray(ch.paragraphs) ? ch.paragraphs.filter((p) => p && p.trim()) : [];
    paras.forEach((p, pIdx) => {
      htmlParts.push(`<p>${escapeHtml(p.trim())}</p>`);
      if (pIdx === 0 && imgCursor < usableImages.length) {
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

function buildFallbackStory({ title, sourceText, language, chapterCount, images }) {
  const isVi = language === 'vi';
  const cleanText = String(sourceText || '').replace(/\s+/g, ' ').trim();
  const sentences = cleanText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);

  const count = Math.max(3, Math.min(6, chapterCount || 4));
  const chunkSize = Math.max(2, Math.ceil(sentences.length / count));
  const chapters = [];

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
        : 'When Everything Changed';

    const paras = [];
    if (slice.length > 0) {
      for (let j = 0; j < slice.length; j += 2) {
        paras.push(slice.slice(j, j + 2).join(' '));
      }
    } else {
      paras.push(
        isVi
          ? `${title} bước vào khoảnh khắc quyết định khiến không khí trở nên lặng đi từng nhịp.`
          : `At that moment, the silence around ${title} felt heavier than any spoken word.`
      );
    }
    chapters.push({
      heading: `${headingPrefix}: ${headingSub}`,
      paragraphs: paras,
    });
  }

  const finalTitle = title || (isVi ? 'Câu chuyện đặc biệt hôm nay' : 'A Story Worth Remembering');
  const excerpt = cleanText.slice(0, 155) || finalTitle;
  const html = interleaveStoryImages(chapters, images, finalTitle);

  return {
    title: finalTitle,
    slug: slugifyStory(finalTitle) || `story-${Date.now()}`,
    excerpt,
    tags: isVi ? ['Truyện hay', 'Câu chuyện', 'MoviesHD4K'] : ['Story', 'Drama', 'Featured Story'],
    chapters,
    html,
  };
}

async function generateStoryArticleWithAi(params) {
  const language = params.language === 'vi' ? 'vi' : 'en';
  const storyStyle = STORY_STYLE_DESCRIPTIONS[params.storyStyle]
    ? params.storyStyle
    : 'emotional_drama';
  const storyPov = params.storyPov === 'first_person' ? 'first_person' : 'third_person';
  const chapterCount = Math.max(3, Math.min(6, Number(params.chapterCount) || 5));

  let sourceTitle = String(params.existingTitle || '').trim();
  let sourceText = stripHtmlTags(params.existingContent || '');
  let collectedImages = Array.isArray(params.existingImages)
    ? params.existingImages.map((im, idx) => ({
        url: String(im.url || ''),
        alt: String(im.alt || sourceTitle || params.topic || 'Story scene'),
        isFeatured: Boolean(im.isFeatured || idx === 0),
        isExternal: Boolean(im.isExternal),
      }))
    : [];

  const cleanSourceUrl = String(params.sourceUrl || '').trim();
  if (cleanSourceUrl && cleanSourceUrl.startsWith('http')) {
    try {
      const scraped = await scrapeSourceForStory(cleanSourceUrl);
      if (scraped.originalTitle && !sourceTitle) sourceTitle = scraped.originalTitle;
      if (scraped.articleText && scraped.articleText.length > sourceText.length) {
        sourceText = scraped.articleText;
      }
      if (scraped.images && scraped.images.length > 0 && collectedImages.length === 0) {
        collectedImages = scraped.images.slice(0, 8);
      }
    } catch {}
  }

  if (collectedImages.length < 3 && (sourceTitle || params.topic)) {
    try {
      const extra = await searchBingStoryImages(
        sourceTitle || params.topic,
        Math.max(1, 5 - collectedImages.length),
        collectedImages
      );
      if (extra.length > 0) {
        collectedImages = [...collectedImages, ...extra];
      }
    } catch {}
  }

  const ai = createFreeGeminiClient();
  const promptInputText = [
    params.topic ? `User Premise / Topic:\n${String(params.topic).trim()}` : '',
    sourceTitle ? `Original Reference Title:\n${sourceTitle}` : '',
    sourceText ? `Reference Facts / Story Material:\n${sourceText.slice(0, 10000)}` : '',
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
  let generatedTitle = sourceTitle || String(params.topic || '').slice(0, 90);
  let generatedSlug = slugifyStory(generatedTitle);
  let generatedExcerpt = '';
  let generatedTags = [];
  let chapters = [];

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
        if (parsed.slug) {
          generatedSlug = slugifyStory(String(parsed.slug)) || slugifyStory(generatedTitle);
        }
        if (parsed.excerpt) generatedExcerpt = String(parsed.excerpt).trim();
        if (Array.isArray(parsed.tags)) {
          generatedTags = parsed.tags
            .map((t) => String(t).trim())
            .filter(Boolean)
            .slice(0, 8);
        }
        if (Array.isArray(parsed.chapters) && parsed.chapters.length > 0) {
          chapters = parsed.chapters.map((ch, idx) => ({
            heading: String(
              ch.heading || (language === 'vi' ? `Chương ${idx + 1}` : `Part ${idx + 1}`)
            ).trim(),
            paragraphs: Array.isArray(ch.paragraphs)
              ? ch.paragraphs.map((p) => String(p).trim()).filter(Boolean)
              : [],
          }));
          usedGemini = true;
        }
      }
    } catch (err) {
      const msg = String(err?.message || err || '');
      warning =
        msg.includes('429') || msg.toLowerCase().includes('quota')
          ? 'Gemini Free Tier đang chạm giới hạn lượt gọi tạm thời — đã dùng bộ dựng khung truyện dự phòng để bạn chỉnh sửa ngay.'
          : `Không gọi được Gemini Free Tier (${msg.slice(0, 120)}) — đã tạo bản khung truyện dự phòng.`;
    }
  } else {
    warning =
      'Chưa phát hiện GEMINI_API_KEY trong biến môi trường máy chủ — đã tạo khung truyện cấu trúc sẵn từ nội dung đầu vào.';
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

async function publishStoryToMoviesHd4k(params) {
  if (!String(params.title || '').trim()) {
    throw new Error('Tiêu đề truyện không được để trống');
  }
  if (!String(params.content || '').trim()) {
    throw new Error('Nội dung truyện không được để trống');
  }

  if (params.targetMode === 'webhook' && String(params.webhookUrl || '').trim()) {
    const res = await fetchWithTimeout(
      String(params.webhookUrl).trim(),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(String(params.webhookSecret || '').trim()
            ? { 'X-Webhook-Secret': String(params.webhookSecret).trim() }
            : {}),
        },
        body: JSON.stringify({
          site: DEFAULT_MOVIES_SITE,
          type: 'story',
          title: String(params.title).trim(),
          slug: params.slug || slugifyStory(params.title),
          content: params.content,
          excerpt: params.excerpt || '',
          status: params.status || 'publish',
          categories: params.categories || [12],
          tags: params.tags || [],
          employeeCode: params.employeeCode || '',
          featuredImageUrl: params.featuredImageUrl || '',
        }),
      },
      7000
    );
    const txt = await res.text();
    if (!res.ok) {
      throw new Error(`Webhook trả về lỗi (${res.status}): ${txt.slice(0, 200)}`);
    }
    return {
      ok: true,
      status: params.status || 'publish',
      link: String(params.webhookUrl).trim(),
      message: 'Đã đẩy truyện sang Webhook thành công!',
    };
  }

  const useCustomBasic =
    params.targetMode === 'custom_wp' &&
    Boolean(String(params.customWpUrl || '').trim()) &&
    Boolean(String(params.customWpUser || '').trim()) &&
    Boolean(String(params.customWpAppPassword || '').trim());

  const targetSite = useCustomBasic
    ? String(params.customWpUrl).trim().replace(/\/+$/, '')
    : DEFAULT_MOVIES_SITE;

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
    } catch {
      // ignore thumbnail failure and continue publishing story
    }
  }

  const buildHeaders = async (forceRefresh = false) => {
    const h = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (useCustomBasic) {
      const token = Buffer.from(
        `${String(params.customWpUser).trim()}:${String(params.customWpAppPassword).trim()}`
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

  const resolvedPostType = params.postType === 'posts' ? 'posts' : 'np_story';
  const restCollection = resolvedPostType === 'np_story' ? 'np_story' : 'posts';

  const tagIds = [];
  if (resolvedPostType === 'posts' && Array.isArray(params.tags) && params.tags.length > 0) {
    for (const rawTag of params.tags.slice(0, 4)) {
      const tName = String(rawTag || '').trim();
      if (!tName) continue;
      try {
        const searchRes = await fetchWithTimeout(
          `${targetSite}/wp-json/wp/v2/tags?search=${encodeURIComponent(tName)}&per_page=5`,
          { headers },
          3000
        );
        if (searchRes.ok) {
          const foundTags = await searchRes.json();
          const exact = Array.isArray(foundTags)
            ? foundTags.find((ft) => String(ft.name || '').toLowerCase() === tName.toLowerCase())
            : null;
          if (exact?.id) {
            tagIds.push(Number(exact.id));
            continue;
          }
        }
        const createRes = await fetchWithTimeout(
          `${targetSite}/wp-json/wp/v2/tags`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: tName }),
          },
          3000
        );
        if (createRes.ok) {
          const created = await createRes.json();
          if (created?.id) tagIds.push(Number(created.id));
        }
      } catch {}
    }
  }

  const endpoint = params.postId
    ? `${targetSite}/wp-json/wp/v2/${restCollection}/${params.postId}`
    : `${targetSite}/wp-json/wp/v2/${restCollection}`;

  const payloadBody = {
    title: String(params.title).trim(),
    content: params.content,
    status: params.status || 'publish',
  };

  if (resolvedPostType === 'posts') {
    payloadBody.categories =
      Array.isArray(params.categories) && params.categories.length > 0 ? params.categories : [12];
    if (tagIds.length > 0) payloadBody.tags = tagIds;
  } else if (Array.isArray(params.genres) && params.genres.length > 0) {
    payloadBody.np_genre = params.genres;
  }

  if (String(params.excerpt || '').trim()) payloadBody.excerpt = String(params.excerpt).trim();
  if (String(params.slug || '').trim()) payloadBody.slug = slugifyStory(params.slug);
  if (finalFeaturedMediaId > 0) payloadBody.featured_media = finalFeaturedMediaId;

  let res = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(payloadBody),
    },
    7000
  );

  if ((res.status === 401 || res.status === 403) && !useCustomBasic) {
    headers = await buildHeaders(true);
    res = await fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payloadBody),
      },
      7000
    );
  }

  const resText = await res.text();
  if (!res.ok) {
    throw new Error(`Không thể đăng truyện lên ${targetSite} (${res.status}): ${resText.slice(0, 260)}`);
  }

  const createdPost = JSON.parse(resText);
  const postLink = String(createdPost.link || `${targetSite}/?p=${createdPost.id}`);
  const empCode = String(params.employeeCode || '').trim().toUpperCase();
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const data = await fetchMoviesHd4kInitData();
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      let body = req.body || {};
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }
      const action = String(body.action || 'publish');

      if (action === 'upload_media') {
        const uploaded = await uploadMediaToMoviesHd4k({
          base64Data: body.base64Data,
          imageUrl: body.imageUrl,
          fileName: body.fileName,
          altText: body.altText,
          customWpUrl: body.customWpUrl,
          customWpUser: body.customWpUser,
          customWpAppPassword: body.customWpAppPassword,
        });
        return res.status(200).json({ ok: true, ...uploaded });
      }

      if (action === 'extract_source') {
        const cleanUrl = String(body.sourceUrl || body.url || '').trim();
        if (!cleanUrl || !cleanUrl.startsWith('http')) {
          return res
            .status(400)
            .json({ ok: false, error: 'Vui lòng nhập link bài viết hoặc link phim hợp lệ' });
        }
        const scraped = await scrapeSourceForStory(cleanUrl);
        return res.status(200).json({
          ok: true,
          title: scraped.originalTitle,
          articleText: scraped.articleText,
          images: scraped.images,
        });
      }

      if (action === 'search_external_images') {
        const query = String(body.query || body.title || '').trim();
        if (!query) {
          return res
            .status(400)
            .json({ ok: false, error: 'Nhập từ khóa hoặc tiêu đề truyện để tìm ảnh' });
        }
        const imgs = await searchBingStoryImages(
          query,
          Number(body.limit) || 6,
          Array.isArray(body.existingImages) ? body.existingImages : []
        );
        return res.status(200).json({ ok: true, images: imgs });
      }

      if (action === 'ai_story' || action === 'ai_write') {
        const story = await generateStoryArticleWithAi({
          topic: String(body.topic || body.title || ''),
          sourceUrl: body.sourceUrl ? String(body.sourceUrl) : undefined,
          mode: body.mode || 'from_idea',
          storyStyle: body.storyStyle || 'emotional_drama',
          storyPov: body.storyPov || 'third_person',
          chapterCount: Number(body.chapterCount) || 5,
          language: body.language === 'vi' ? 'vi' : 'en',
          categoryName: body.categoryName ? String(body.categoryName) : undefined,
          keyword: body.keyword ? String(body.keyword) : undefined,
          existingTitle: body.existingTitle ? String(body.existingTitle) : undefined,
          existingContent: body.existingContent ? String(body.existingContent) : undefined,
          existingImages: Array.isArray(body.existingImages) ? body.existingImages : undefined,
        });
        return res.status(200).json(story);
      }

      const published = await publishStoryToMoviesHd4k({
        postId: body.postId ? Number(body.postId) : undefined,
        postType: body.postType === 'posts' ? 'posts' : 'np_story',
        title: String(body.title || ''),
        content: String(body.content || ''),
        excerpt: body.excerpt ? String(body.excerpt) : undefined,
        slug: body.slug ? String(body.slug) : undefined,
        status: body.status || 'publish',
        categories: Array.isArray(body.categories) ? body.categories.map(Number) : undefined,
        genres: Array.isArray(body.genres) ? body.genres.map(Number) : undefined,
        tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
        employeeCode: body.employeeCode ? String(body.employeeCode) : undefined,
        featuredMediaId: body.featuredMediaId ? Number(body.featuredMediaId) : undefined,
        featuredImageBase64: body.featuredImageBase64 ? String(body.featuredImageBase64) : undefined,
        featuredImageUrl: body.featuredImageUrl ? String(body.featuredImageUrl) : undefined,
        featuredImageAlt: body.featuredImageAlt ? String(body.featuredImageAlt) : undefined,
        targetMode: body.targetMode || 'default_wp',
        customWpUrl: body.customWpUrl ? String(body.customWpUrl) : undefined,
        customWpUser: body.customWpUser ? String(body.customWpUser) : undefined,
        customWpAppPassword: body.customWpAppPassword ? String(body.customWpAppPassword) : undefined,
        webhookUrl: body.webhookUrl ? String(body.webhookUrl) : undefined,
        webhookSecret: body.webhookSecret ? String(body.webhookSecret) : undefined,
      });
      return res.status(200).json(published);
    }

    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Lỗi máy chủ khi kết nối movieshd4k.com',
    });
  }
}
