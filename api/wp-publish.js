const DEFAULT_WP_SITE = process.env.WP_STATS_SITE_URL || 'https://celeb24h.com';
const DEFAULT_WP_USER = process.env.WP_STATS_USERNAME || 'adgoole';
const DEFAULT_WP_PASS = process.env.WP_STATS_PASSWORD || 'Biencualo8282#';

const WP_EMPLOYEE_AUTHOR_MAP = [
  { code: 'M2001', wpUserId: 2, wpUsername: 'Ly', displayName: 'Ms Ly (M2001)', staffUsername: 'MS.LY' },
  { code: 'H2000', wpUserId: 3, wpUsername: 'Huyen', displayName: 'Ms Huyen (H2000)', staffUsername: 'MS.HUYEN' },
  { code: 'H0088', wpUserId: 4, wpUsername: 'Hiep', displayName: 'Hiep MS (H0088)', staffUsername: 'MSHIEP' },
  { code: 'A0005', wpUserId: 5, wpUsername: 'Nhi', displayName: 'Ms Nhi (A0005)', staffUsername: 'MS.NHI' },
  { code: 'A0006', wpUserId: 6, wpUsername: 'adgoole', displayName: 'Mr Google (A0006)', staffUsername: 'Quản Lý (Admin)' },
  { code: 'H0082', wpUserId: 1, wpUsername: 'admin', displayName: 'Admin (H0082)', staffUsername: 'Admin' },
];

let cachedPublishSession = null;

function decodeHtmlEntities(text) {
  if (!text) return '';
  return String(text)
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

function stripHtmlTags(html) {
  if (!html) return '';
  return decodeHtmlEntities(String(html).replace(/<[^>]*>/g, '')).trim();
}

function resolveWpUserIdByEmployeeCode(code) {
  const clean = String(code || '').trim().toUpperCase();
  const found = WP_EMPLOYEE_AUTHOR_MAP.find((m) => m.code === clean);
  return found ? found.wpUserId : 6;
}

function resolveEmployeeByWpUserId(wpUserId) {
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

async function getWpRestSession(forceRefresh = false) {
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
    } catch {}
  }

  cachedPublishSession = {
    cookieHeader,
    restNonce,
    restRoot: restRoot.endsWith('/') ? restRoot : `${restRoot}/`,
    expiresAt: Date.now() + 20 * 60 * 1000,
  };

  return cachedPublishSession;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
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

      const rawCats = catRes.ok ? await catRes.json() : [];
      const categories = Array.isArray(rawCats)
        ? rawCats.map((c) => ({
            id: Number(c.id),
            name: decodeHtmlEntities(c.name || ''),
            slug: String(c.slug || ''),
            count: Number(c.count || 0),
          }))
        : [];

      const catMap = new Map();
      categories.forEach((c) => catMap.set(c.id, c.name));

      const rawPosts = postsRes.ok ? await postsRes.json() : [];
      const posts = Array.isArray(rawPosts)
        ? rawPosts.map((p) => {
            const authorInfo = resolveEmployeeByWpUserId(p.author);
            const catIds = Array.isArray(p.categories) ? p.categories.map(Number) : [];
            const embeddedMedia = p._embedded?.['wp:featuredmedia']?.[0];
            const featuredImageUrl =
              embeddedMedia?.source_url ||
              embeddedMedia?.media_details?.sizes?.medium?.source_url ||
              '';
            return {
              id: Number(p.id),
              title: decodeHtmlEntities(
                typeof p.title === 'object' ? p.title.raw || p.title.rendered || '' : p.title || ''
              ),
              content:
                typeof p.content === 'object'
                  ? p.content.raw || p.content.rendered || ''
                  : p.content || '',
              excerpt: stripHtmlTags(
                typeof p.excerpt === 'object'
                  ? p.excerpt.raw || p.excerpt.rendered || ''
                  : p.excerpt || ''
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
          })
        : [];

      return res.status(200).json({
        ok: true,
        siteUrl: DEFAULT_WP_SITE,
        categories,
        posts,
        authors: WP_EMPLOYEE_AUTHOR_MAP,
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const action = body.action || 'publish';
      const session = await getWpRestSession();

      if (action === 'upload_media') {
        let buffer;
        let mimeType = 'image/jpeg';
        let finalFileName = body.fileName || `celeb24h-${Date.now()}.jpg`;
        if (body.base64Data) {
          const match = String(body.base64Data).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
          if (match) {
            mimeType = match[1];
            buffer = Buffer.from(match[2], 'base64');
          } else {
            buffer = Buffer.from(body.base64Data, 'base64');
          }
        } else if (body.imageUrl) {
          const imgRes = await fetch(body.imageUrl);
          const arr = await imgRes.arrayBuffer();
          buffer = Buffer.from(arr);
        }
        const uploadRes = await fetch(`${session.restRoot}wp/v2/media`, {
          method: 'POST',
          headers: {
            Cookie: session.cookieHeader,
            'X-WP-Nonce': session.restNonce,
            'Content-Type': mimeType,
            'Content-Disposition': `attachment; filename="${encodeURIComponent(finalFileName)}"`,
          },
          body: new Uint8Array(buffer),
        });
        const mediaJson = await uploadRes.json();
        return res.status(200).json({
          ok: uploadRes.ok,
          id: Number(mediaJson.id || 0),
          url: String(mediaJson.source_url || ''),
        });
      }

      const empCode = String(body.employeeCode || '').trim().toUpperCase();
      const wpAuthorId = resolveWpUserIdByEmployeeCode(empCode);
      const postPayload = {
        title: body.title,
        content: body.content,
        excerpt: body.excerpt || '',
        status: body.status || 'publish',
        author: wpAuthorId,
        categories: Array.isArray(body.categories) && body.categories.length > 0 ? body.categories : [2],
      };
      if (body.slug) postPayload.slug = body.slug;
      if (body.featuredMediaId) postPayload.featured_media = Number(body.featuredMediaId);

      const endpoint = body.postId
        ? `${session.restRoot}wp/v2/posts/${body.postId}`
        : `${session.restRoot}wp/v2/posts`;

      const wpRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Cookie: session.cookieHeader,
          'X-WP-Nonce': session.restNonce,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postPayload),
      });
      const created = await wpRes.json();
      if (!wpRes.ok) {
        return res.status(wpRes.status).json({
          ok: false,
          error: created?.message || 'Không thể đẩy bài lên WordPress',
        });
      }
      const cleanLink = String(created.link || `${DEFAULT_WP_SITE}/${created.id}`).replace(/\/+$/, '');
      const trackingLink = empCode
        ? `${cleanLink}${cleanLink.includes('?') ? '&' : '?'}${empCode}`
        : cleanLink;

      return res.status(200).json({
        ok: true,
        post: {
          id: Number(created.id),
          title: body.title,
          link: cleanLink,
          trackingLink,
          status: created.status || body.status || 'publish',
          slug: String(created.slug || ''),
          date: String(created.date || new Date().toISOString()),
          authorId: wpAuthorId,
          employeeCode: empCode,
        },
      });
    }

    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Internal Server Error' });
  }
}
