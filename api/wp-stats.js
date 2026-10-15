// Vercel Serverless Function for /api/wp-stats
const DEFAULT_WP_SITE = process.env.WP_STATS_SITE_URL || 'https://celeb24h.com';
const DEFAULT_WP_USER = process.env.WP_STATS_USERNAME || 'adgoole';
const DEFAULT_WP_PASS = process.env.WP_STATS_PASSWORD || 'Biencualo8282#';

let cachedSession = null;

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8217;/g, '’')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function stripTags(html) {
  return decodeHtmlEntities(String(html || '').replace(/<[^>]*>/g, '').trim());
}

function parseNumber(raw) {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[^\d-]/g, '');
  const num = parseInt(cleaned, 10);
  return Number.isNaN(num) ? 0 : num;
}

async function loginToWordPress(force = false) {
  const now = Date.now();
  if (!force && cachedSession && cachedSession.expiresAt > now && cachedSession.cookieHeader) {
    return cachedSession;
  }

  const loginUrl = `${DEFAULT_WP_SITE.replace(/\/$/, '')}/wp-login.php`;
  const body = new URLSearchParams({
    log: DEFAULT_WP_USER,
    pwd: DEFAULT_WP_PASS,
    'wp-submit': 'Log In',
    redirect_to: `${DEFAULT_WP_SITE.replace(/\/$/, '')}/wp-admin/`,
    testcookie: '1',
  });

  const res = await fetch(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: 'wordpress_test_cookie=WP%20Cookie%20check',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
    body: body.toString(),
    redirect: 'manual',
  });

  const rawCookies =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : res.headers.get('set-cookie')
      ? [res.headers.get('set-cookie')]
      : [];

  const cookieParts = rawCookies
    .map((c) => c.split(';')[0].trim())
    .filter((c) => c && !c.endsWith('='));

  const cookieHeader = ['wordpress_test_cookie=WP%20Cookie%20check', ...cookieParts].join('; ');
  cachedSession = {
    cookieHeader,
    nonce: cachedSession ? cachedSession.nonce : '',
    expiresAt: now + 30 * 60 * 1000,
  };
  return cachedSession;
}

async function fetchWpAdminHtml(url) {
  let session = await loginToWordPress(false);
  let res = await fetch(url, {
    headers: {
      Cookie: session.cookieHeader,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
    redirect: 'manual',
  });

  if (res.status === 301 || res.status === 302) {
    session = await loginToWordPress(true);
    res = await fetch(url, {
      headers: {
        Cookie: session.cookieHeader,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    });
  }

  return await res.text();
}

export default async function handler(req, res) {
  try {
    const q = req.query || {};
    const mode = String(q.mode || 'dashboard');
    const baseUrl = `${DEFAULT_WP_SITE.replace(/\/$/, '')}/wp-admin/admin.php`;

    if (mode === 'live') {
      const liveEmployee = String(q.live_employee || '');
      const html = await fetchWpAdminHtml(
        `${baseUrl}?page=tkw-stats&live_employee=${encodeURIComponent(liveEmployee)}`
      );
      const tkwDashMatch = html.match(/window\.TKWDash\s*=\s*(\{.*?\});/s);
      let realtime = { online: 0, today_views: 0, today_visitors: 0, minutes: [], pages: [], updated: '', code: liveEmployee };
      if (tkwDashMatch) {
        const parsed = JSON.parse(tkwDashMatch[1]);
        if (parsed.initial) {
          realtime = {
            online: Number(parsed.initial.online || 0),
            today_views: Number(parsed.initial.today_views || 0),
            today_visitors: Number(parsed.initial.today_visitors || 0),
            minutes: parsed.initial.minutes || [],
            pages: (parsed.initial.pages || []).map((p) => ({
              title: decodeHtmlEntities(String(p.title || '')),
              count: Number(p.count || 0),
            })),
            updated: String(parsed.initial.updated || ''),
            code: liveEmployee,
          };
        }
      }
      return res.status(200).json({ ok: true, realtime });
    }

    const range = String(q.range || '7');
    const employee = String(q.employee || '');
    const liveEmployee = String(q.live_employee || '');
    const topRange = String(q.top_range || '7');
    const empDays = Number(q.emp_days) === 30 ? 30 : 7;
    const empDetailCode = q.emp_detail !== undefined ? String(q.emp_detail) : employee;

    const statsQuery = new URLSearchParams({ page: 'tkw-stats', range });
    if (employee) statsQuery.set('employee', employee);
    if (liveEmployee) statsQuery.set('live_employee', liveEmployee);
    if (q.from && q.to) {
      statsQuery.set('from', String(q.from));
      statsQuery.set('to', String(q.to));
    }
    if (topRange) statsQuery.set('top_range', topRange);
    if (topRange === 'custom' && q.top_from && q.top_to) {
      statsQuery.set('top_from', String(q.top_from));
      statsQuery.set('top_to', String(q.top_to));
    }

    const empQuery = new URLSearchParams({ page: 'tkw-employees', days: String(empDays) });
    if (empDetailCode && empDetailCode !== '(Không mã)') {
      empQuery.set('employee', empDetailCode);
    }

    const [statsHtml, empHtml] = await Promise.all([
      fetchWpAdminHtml(`${baseUrl}?${statsQuery.toString()}`),
      fetchWpAdminHtml(`${baseUrl}?${empQuery.toString()}`),
    ]);

    // Parse statsHtml
    let realtime = { online: 0, today_views: 0, today_visitors: 0, minutes: [], pages: [], updated: '', code: liveEmployee };
    const tkwDashMatch = statsHtml.match(/window\.TKWDash\s*=\s*(\{.*?\});/s);
    if (tkwDashMatch) {
      const parsed = JSON.parse(tkwDashMatch[1]);
      if (parsed.initial) {
        realtime = {
          online: Number(parsed.initial.online || 0),
          today_views: Number(parsed.initial.today_views || 0),
          today_visitors: Number(parsed.initial.today_visitors || 0),
          minutes: parsed.initial.minutes || [],
          pages: (parsed.initial.pages || []).map((p) => ({
            title: decodeHtmlEntities(String(p.title || '')),
            count: Number(p.count || 0),
          })),
          updated: String(parsed.initial.updated || ''),
          code: String(parsed.code || ''),
        };
      }
    }

    const employeeOptions = [];
    const selectMatch = statsHtml.match(/<select[^>]*name="employee"[^>]*>(.*?)<\/select>/s);
    if (selectMatch) {
      const optRegex = /<option\s+value="([^"]*)"[^>]*>(.*?)<\/option>/gs;
      let m;
      while ((m = optRegex.exec(selectMatch[1])) !== null) {
        const code = stripTags(m[1]);
        const label = stripTags(m[2]);
        if (code) employeeOptions.push({ code, label });
      }
    }

    const summary = { views: 0, visitors: 0, newcomers: 0, returning: 0 };
    const summarySectionMatch = statsHtml.match(
      /<div class="tkw-whitepanel"><h3>Tổng hợp[^<]*<\/h3><table><tbody>(.*?)<\/tbody><\/table><\/div>/s
    );
    if (summarySectionMatch) {
      const rowRegex = /<tr><td>(.*?)<\/td><td>(.*?)<\/td><\/tr>/gs;
      let m;
      while ((m = rowRegex.exec(summarySectionMatch[1])) !== null) {
        const label = stripTags(m[1]).toLowerCase();
        const val = parseNumber(stripTags(m[2]));
        if (label.includes('lượt xem')) summary.views = val;
        else if (label.includes('khách duy nhất')) summary.visitors = val;
        else if (label.includes('khách mới')) summary.newcomers = val;
        else if (label.includes('khách quay lại')) summary.returning = val;
      }
    }

    const topPosts = [];
    const topSectionMatch = statsHtml.match(
      /<div class="tkw-whitepanel tkw-top10">.*?<table><thead>.*?<\/thead><tbody>(.*?)<\/tbody><\/table><\/div>/s
    );
    if (topSectionMatch) {
      const rowRegex = /<tr><td>(.*?)<\/td><td>(.*?)<\/td><\/tr>/gs;
      let m;
      while ((m = rowRegex.exec(topSectionMatch[1])) !== null) {
        const title = stripTags(m[1]);
        const views = parseNumber(stripTags(m[2]));
        if (title && title !== 'Chưa có dữ liệu') topPosts.push({ title, views });
      }
    }

    const daily = [];
    const dailySectionMatch = statsHtml.match(
      /<div class="tkw-whitepanel"><h3>Theo ngày<\/h3><table><thead>.*?<\/thead><tbody>(.*?)<\/tbody><\/table><\/div>/s
    );
    if (dailySectionMatch) {
      const rowRegex = /<tr><td>(.*?)<\/td><td>(.*?)<\/td><td>(.*?)<\/td><\/tr>/gs;
      let m;
      while ((m = rowRegex.exec(dailySectionMatch[1])) !== null) {
        const day = stripTags(m[1]);
        const views = parseNumber(stripTags(m[2]));
        const visitors = parseNumber(stripTags(m[3]));
        if (day && day !== 'Chưa có dữ liệu') daily.push({ day, views, visitors });
      }
    }

    const rows = [];
    const rankTableMatch = empHtml.match(
      /<h2>Bảng xếp hạng nhân viên<\/h2>.*?<table[^>]*><thead>.*?<\/thead><tbody>(.*?)<\/tbody><\/table>/s
    );
    if (rankTableMatch) {
      const trRegex = /<tr>(.*?)<\/tr>/gs;
      let trMatch;
      while ((trMatch = trRegex.exec(rankTableMatch[1])) !== null) {
        const tdRegex = /<td[^>]*>(.*?)<\/td>/gs;
        const cols = [];
        let tdMatch;
        while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) cols.push(stripTags(tdMatch[1]));
        if (cols.length >= 7) {
          rows.push({
            code: cols[0] || '(Không mã)',
            account: cols[1] || 'Chưa gán',
            views: parseNumber(cols[2]),
            visitors: parseNumber(cols[3]),
            newVisitors: parseNumber(cols[4]),
            returningVisitors: parseNumber(cols[5]),
            online: parseNumber(cols[6]),
          });
        }
      }
    }

    let detail = null;
    const detailHeaderMatch = empHtml.match(/<h2>Chi tiết:\s*([^<]+)<\/h2>(.*)/s);
    if (detailHeaderMatch) {
      const code = stripTags(detailHeaderMatch[1]);
      const detailHtml = detailHeaderMatch[2];
      const empDaily = [];
      const dailyBoxMatch = detailHtml.match(/<h3>Theo ngày<\/h3><table[^>]*>(.*?)<\/table>/s);
      if (dailyBoxMatch) {
        const trRegex = /<tr><td>(.*?)<\/td><td>(.*?)<\/td><td>(.*?)<\/td><\/tr>/gs;
        let m;
        while ((m = trRegex.exec(dailyBoxMatch[1])) !== null) {
          empDaily.push({ day: stripTags(m[1]), views: parseNumber(stripTags(m[2])), visitors: parseNumber(stripTags(m[3])) });
        }
      }
      const parseTwoColBox = (heading) => {
        const list = [];
        const regex = new RegExp(`<h3>${heading}<\\/h3><table[^>]*>(.*?)<\\/table>`, 's');
        const match = detailHtml.match(regex);
        if (match) {
          const trRegex = /<tr><td>(.*?)<\/td><td>(.*?)<\/td><\/tr>/gs;
          let m;
          while ((m = trRegex.exec(match[1])) !== null) {
            const name = stripTags(m[1]);
            const count = parseNumber(stripTags(m[2]));
            if (name && !name.toLowerCase().includes('chưa có dữ liệu')) list.push({ name, count });
          }
        }
        return list;
      };
      const empTop = [];
      const topBoxMatch = detailHtml.match(/<h3>Top bài viết\/trang<\/h3><table[^>]*>(.*?)<\/table>/s);
      if (topBoxMatch) {
        const trRegex = /<tr><td>(.*?)<\/td><td>(.*?)<\/td><\/tr>/gs;
        let m;
        while ((m = trRegex.exec(topBoxMatch[1])) !== null) {
          const title = stripTags(m[1]);
          const views = parseNumber(stripTags(m[2]));
          if (title) empTop.push({ title, views });
        }
      }
      detail = {
        code: code || empDetailCode,
        daily: empDaily,
        sources: parseTwoColBox('Nguồn truy cập'),
        devices: parseTwoColBox('Thiết bị'),
        countries: parseTwoColBox('Quốc gia'),
        regions: parseTwoColBox('Tỉnh/thành'),
        topPosts: empTop,
      };
    }

    const fromMatch = statsHtml.match(/<input[^>]*name="from"[^>]*value="([^"]*)"/);
    const toMatch = statsHtml.match(/<input[^>]*name="to"[^>]*value="([^"]*)"/);
    const topFromMatch = statsHtml.match(/<input[^>]*name="top_from"[^>]*value="([^"]*)"/);
    const topToMatch = statsHtml.match(/<input[^>]*name="top_to"[^>]*value="([^"]*)"/);
    const tzMatch = statsHtml.match(/Múi giờ\s+([^\.\s<]+)/);

    return res.status(200).json({
      ok: true,
      siteUrl: DEFAULT_WP_SITE,
      fetchedAt: new Date().toISOString(),
      range,
      from: fromMatch ? fromMatch[1] : '',
      to: toMatch ? toMatch[1] : '',
      timezone: tzMatch ? tzMatch[1] : '+00:00',
      employee,
      liveEmployee,
      topRange,
      topFrom: topFromMatch ? topFromMatch[1] : '',
      topTo: topToMatch ? topToMatch[1] : '',
      employeeOptions,
      realtime,
      summary,
      topPosts,
      daily,
      employeeRanking: {
        days: empDays,
        selectedEmployee: empDetailCode,
        rows,
        detail,
      },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Lỗi kết nối WordPress celeb24h.com',
    });
  }
}
