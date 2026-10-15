export interface WpRealtimeMinute {
  time: string;
  views: number;
  visitors: number;
}

export interface WpActivePage {
  title: string;
  count: number;
}

export interface WpRealtimeData {
  online: number;
  today_views: number;
  today_visitors: number;
  minutes: WpRealtimeMinute[];
  pages: WpActivePage[];
  updated: string;
  code: string;
}

export interface WpEmployeeOption {
  code: string;
  label: string;
}

export interface WpSummaryStats {
  views: number;
  visitors: number;
  newcomers: number;
  returning: number;
}

export interface WpTopPostRow {
  title: string;
  views: number;
}

export interface WpDailyRow {
  day: string;
  views: number;
  visitors: number;
}

export interface WpEmployeeRankRow {
  code: string;
  account: string;
  views: number;
  visitors: number;
  newVisitors: number;
  returningVisitors: number;
  online: number;
}

export interface WpKeyValueRow {
  name: string;
  count: number;
}

export interface WpEmployeeDetail {
  code: string;
  daily: WpDailyRow[];
  sources: WpKeyValueRow[];
  devices: WpKeyValueRow[];
  countries: WpKeyValueRow[];
  regions: WpKeyValueRow[];
  topPosts: WpTopPostRow[];
}

export interface WpStatsDashboardPayload {
  ok: boolean;
  siteUrl: string;
  fetchedAt: string;
  range: string;
  from: string;
  to: string;
  timezone: string;
  employee: string;
  liveEmployee: string;
  topRange: string;
  topFrom: string;
  topTo: string;
  employeeOptions: WpEmployeeOption[];
  realtime: WpRealtimeData;
  summary: WpSummaryStats;
  topPosts: WpTopPostRow[];
  daily: WpDailyRow[];
  employeeRanking: {
    days: number;
    selectedEmployee: string;
    rows: WpEmployeeRankRow[];
    detail: WpEmployeeDetail | null;
  };
}

const DEFAULT_WP_SITE = process.env.WP_STATS_SITE_URL || 'https://celeb24h.com';
const DEFAULT_WP_USER = process.env.WP_STATS_USERNAME || 'adgoole';
const DEFAULT_WP_PASS = process.env.WP_STATS_PASSWORD || 'Biencualo8282#';

interface CachedWpSession {
  cookieHeader: string;
  nonce: string;
  expiresAt: number;
}

let cachedSession: CachedWpSession | null = null;

function decodeHtmlEntities(str: string): string {
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

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, '').trim());
}

function parseNumber(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d-]/g, '');
  const num = parseInt(cleaned, 10);
  return Number.isNaN(num) ? 0 : num;
}

async function loginToWordPress(force = false): Promise<CachedWpSession> {
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

  const rawCookies: string[] =
    typeof (res.headers as any).getSetCookie === 'function'
      ? (res.headers as any).getSetCookie()
      : res.headers.get('set-cookie')
      ? [res.headers.get('set-cookie') as string]
      : [];

  const cookieParts = rawCookies
    .map((c) => c.split(';')[0].trim())
    .filter((c) => c && !c.endsWith('='));

  if (cookieParts.length === 0 || !cookieParts.some((c) => c.startsWith('wordpress_logged_in_'))) {
    throw new Error('Không thể đăng nhập vào WordPress Admin celeb24h.com. Vui lòng kiểm tra tài khoản.');
  }

  const cookieHeader = ['wordpress_test_cookie=WP%20Cookie%20check', ...cookieParts].join('; ');

  cachedSession = {
    cookieHeader,
    nonce: cachedSession?.nonce || '',
    expiresAt: now + 30 * 60 * 1000, // Cache 30 minutes
  };

  return cachedSession;
}

async function fetchWpAdminHtml(url: string): Promise<string> {
  let session = await loginToWordPress(false);

  let res = await fetch(url, {
    headers: {
      Cookie: session.cookieHeader,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'manual',
  });

  // If redirected to wp-login.php, re-authenticate once
  if (res.status === 301 || res.status === 302) {
    session = await loginToWordPress(true);
    res = await fetch(url, {
      headers: {
        Cookie: session.cookieHeader,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
  }

  const html = await res.text();
  if (html.includes('id="loginform"') && !html.includes('tkw-')) {
    session = await loginToWordPress(true);
    const retryRes = await fetch(url, {
      headers: {
        Cookie: session.cookieHeader,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    });
    return await retryRes.text();
  }

  return html;
}

export function parseTkwStatsHtml(html: string) {
  // 1. Extract window.TKWDash JSON
  let realtime: WpRealtimeData = {
    online: 0,
    today_views: 0,
    today_visitors: 0,
    minutes: [],
    pages: [],
    updated: '',
    code: '',
  };

  const tkwDashMatch = html.match(/window\.TKWDash\s*=\s*(\{.*?\});/s);
  if (tkwDashMatch) {
    try {
      const parsed = JSON.parse(tkwDashMatch[1]);
      if (parsed.nonce && cachedSession) {
        cachedSession.nonce = parsed.nonce;
      }
      if (parsed.initial) {
        realtime = {
          online: Number(parsed.initial.online || 0),
          today_views: Number(parsed.initial.today_views || 0),
          today_visitors: Number(parsed.initial.today_visitors || 0),
          minutes: Array.isArray(parsed.initial.minutes) ? parsed.initial.minutes : [],
          pages: Array.isArray(parsed.initial.pages)
            ? parsed.initial.pages.map((p: any) => ({
                title: decodeHtmlEntities(String(p.title || '')),
                count: Number(p.count || 0),
              }))
            : [],
          updated: String(parsed.initial.updated || ''),
          code: String(parsed.code || ''),
        };
      }
    } catch (e) {
      console.warn('[wpStatsService] Failed to parse window.TKWDash JSON:', e);
    }
  }

  // 2. Extract employee options from <select aria-label="Mã nhân viên" name="employee">
  const employeeOptions: WpEmployeeOption[] = [];
  const selectMatch = html.match(/<select[^>]*name="employee"[^>]*>(.*?)<\/select>/s);
  if (selectMatch) {
    const optRegex = /<option\s+value="([^"]*)"[^>]*>(.*?)<\/option>/gs;
    let m: RegExpExecArray | null;
    while ((m = optRegex.exec(selectMatch[1])) !== null) {
      const code = stripTags(m[1]);
      const label = stripTags(m[2]);
      if (code) {
        employeeOptions.push({ code, label });
      }
    }
  }

  // 3. Extract date inputs & timezone
  const fromMatch = html.match(/<input[^>]*name="from"[^>]*value="([^"]*)"/);
  const toMatch = html.match(/<input[^>]*name="to"[^>]*value="([^"]*)"/);
  const topFromMatch = html.match(/<input[^>]*name="top_from"[^>]*value="([^"]*)"/);
  const topToMatch = html.match(/<input[^>]*name="top_to"[^>]*value="([^"]*)"/);
  const tzMatch = html.match(/Múi giờ\s+([^\.\s<]+)/);

  // 4. Extract Summary table (Tổng hợp ...)
  const summary: WpSummaryStats = {
    views: 0,
    visitors: 0,
    newcomers: 0,
    returning: 0,
  };
  const summarySectionMatch = html.match(
    /<div class="tkw-whitepanel"><h3>Tổng hợp[^<]*<\/h3><table><tbody>(.*?)<\/tbody><\/table><\/div>/s
  );
  if (summarySectionMatch) {
    const rowRegex = /<tr><td>(.*?)<\/td><td>(.*?)<\/td><\/tr>/gs;
    let m: RegExpExecArray | null;
    while ((m = rowRegex.exec(summarySectionMatch[1])) !== null) {
      const label = stripTags(m[1]).toLowerCase();
      const val = parseNumber(stripTags(m[2]));
      if (label.includes('lượt xem')) summary.views = val;
      else if (label.includes('khách duy nhất')) summary.visitors = val;
      else if (label.includes('khách mới')) summary.newcomers = val;
      else if (label.includes('khách quay lại')) summary.returning = val;
    }
  }

  // 5. Extract Top 10 bài viết / trang
  const topPosts: WpTopPostRow[] = [];
  const topSectionMatch = html.match(
    /<div class="tkw-whitepanel tkw-top10">.*?<table><thead>.*?<\/thead><tbody>(.*?)<\/tbody><\/table><\/div>/s
  );
  if (topSectionMatch) {
    const rowRegex = /<tr><td>(.*?)<\/td><td>(.*?)<\/td><\/tr>/gs;
    let m: RegExpExecArray | null;
    while ((m = rowRegex.exec(topSectionMatch[1])) !== null) {
      const title = stripTags(m[1]);
      const views = parseNumber(stripTags(m[2]));
      if (title && title !== 'Chưa có dữ liệu') {
        topPosts.push({ title, views });
      }
    }
  }

  // 6. Extract Theo ngày table
  const daily: WpDailyRow[] = [];
  const dailySectionMatch = html.match(
    /<div class="tkw-whitepanel"><h3>Theo ngày<\/h3><table><thead>.*?<\/thead><tbody>(.*?)<\/tbody><\/table><\/div>/s
  );
  if (dailySectionMatch) {
    const rowRegex = /<tr><td>(.*?)<\/td><td>(.*?)<\/td><td>(.*?)<\/td><\/tr>/gs;
    let m: RegExpExecArray | null;
    while ((m = rowRegex.exec(dailySectionMatch[1])) !== null) {
      const day = stripTags(m[1]);
      const views = parseNumber(stripTags(m[2]));
      const visitors = parseNumber(stripTags(m[3]));
      if (day && day !== 'Chưa có dữ liệu') {
        daily.push({ day, views, visitors });
      }
    }
  }

  return {
    realtime,
    employeeOptions,
    from: fromMatch ? fromMatch[1] : '',
    to: toMatch ? toMatch[1] : '',
    topFrom: topFromMatch ? topFromMatch[1] : '',
    topTo: topToMatch ? topToMatch[1] : '',
    timezone: tzMatch ? tzMatch[1] : '+00:00',
    summary,
    topPosts,
    daily,
  };
}

export function parseTkwEmployeesHtml(html: string, selectedEmployee: string) {
  const rows: WpEmployeeRankRow[] = [];

  // 1. Parse Bảng xếp hạng nhân viên
  const rankTableMatch = html.match(
    /<h2>Bảng xếp hạng nhân viên<\/h2>.*?<table[^>]*><thead>.*?<\/thead><tbody>(.*?)<\/tbody><\/table>/s
  );
  if (rankTableMatch) {
    const trRegex = /<tr>(.*?)<\/tr>/gs;
    let trMatch: RegExpExecArray | null;
    while ((trMatch = trRegex.exec(rankTableMatch[1])) !== null) {
      const tdRegex = /<td[^>]*>(.*?)<\/td>/gs;
      const cols: string[] = [];
      let tdMatch: RegExpExecArray | null;
      while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
        cols.push(stripTags(tdMatch[1]));
      }
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

  // 2. Parse Chi tiết: <CODE> if present
  let detail: WpEmployeeDetail | null = null;
  const detailHeaderMatch = html.match(/<h2>Chi tiết:\s*([^<]+)<\/h2>(.*)/s);
  if (detailHeaderMatch) {
    const code = stripTags(detailHeaderMatch[1]);
    const detailHtml = detailHeaderMatch[2];

    const daily: WpDailyRow[] = [];
    const dailyBoxMatch = detailHtml.match(/<h3>Theo ngày<\/h3><table[^>]*>(.*?)<\/table>/s);
    if (dailyBoxMatch) {
      const trRegex = /<tr><td>(.*?)<\/td><td>(.*?)<\/td><td>(.*?)<\/td><\/tr>/gs;
      let m: RegExpExecArray | null;
      while ((m = trRegex.exec(dailyBoxMatch[1])) !== null) {
        daily.push({
          day: stripTags(m[1]),
          views: parseNumber(stripTags(m[2])),
          visitors: parseNumber(stripTags(m[3])),
        });
      }
    }

    const parseTwoColBox = (heading: string): WpKeyValueRow[] => {
      const list: WpKeyValueRow[] = [];
      const regex = new RegExp(`<h3>${heading}<\\/h3><table[^>]*>(.*?)<\\/table>`, 's');
      const match = detailHtml.match(regex);
      if (match) {
        const trRegex = /<tr><td>(.*?)<\/td><td>(.*?)<\/td><\/tr>/gs;
        let m: RegExpExecArray | null;
        while ((m = trRegex.exec(match[1])) !== null) {
          const name = stripTags(m[1]);
          const count = parseNumber(stripTags(m[2]));
          if (name && !name.toLowerCase().includes('chưa có dữ liệu')) {
            list.push({ name, count });
          }
        }
      }
      return list;
    };

    const sources = parseTwoColBox('Nguồn truy cập');
    const devices = parseTwoColBox('Thiết bị');
    const countries = parseTwoColBox('Quốc gia');
    const regions = parseTwoColBox('Tỉnh/thành');

    const topPosts: WpTopPostRow[] = [];
    const topBoxMatch = detailHtml.match(/<h3>Top bài viết\/trang<\/h3><table[^>]*>(.*?)<\/table>/s);
    if (topBoxMatch) {
      const trRegex = /<tr><td>(.*?)<\/td><td>(.*?)<\/td><\/tr>/gs;
      let m: RegExpExecArray | null;
      while ((m = trRegex.exec(topBoxMatch[1])) !== null) {
        const title = stripTags(m[1]);
        const views = parseNumber(stripTags(m[2]));
        if (title) {
          topPosts.push({ title, views });
        }
      }
    }

    detail = {
      code: code || selectedEmployee,
      daily,
      sources,
      devices,
      countries,
      regions,
      topPosts,
    };
  }

  return { rows, detail };
}

export interface FetchWpStatsParams {
  range?: string;
  from?: string;
  to?: string;
  employee?: string;
  liveEmployee?: string;
  topRange?: string;
  topFrom?: string;
  topTo?: string;
  empDays?: string | number;
  empDetailCode?: string;
}

export async function fetchWpStatsDashboard(
  params: FetchWpStatsParams = {}
): Promise<WpStatsDashboardPayload> {
  const baseUrl = `${DEFAULT_WP_SITE.replace(/\/$/, '')}/wp-admin/admin.php`;

  const range = params.range || '7';
  const employee = params.employee || '';
  const liveEmployee = params.liveEmployee || '';
  const topRange = params.topRange || '7';
  const empDays = Number(params.empDays) === 30 ? 30 : 7;
  const empDetailCode = params.empDetailCode ?? employee ?? '';

  // Build URL for tkw-stats
  const statsQuery = new URLSearchParams({
    page: 'tkw-stats',
    range,
  });
  if (employee) statsQuery.set('employee', employee);
  if (liveEmployee) statsQuery.set('live_employee', liveEmployee);
  if (params.from && params.to) {
    statsQuery.set('from', params.from);
    statsQuery.set('to', params.to);
  }
  if (topRange) statsQuery.set('top_range', topRange);
  if (topRange === 'custom' && params.topFrom && params.topTo) {
    statsQuery.set('top_from', params.topFrom);
    statsQuery.set('top_to', params.topTo);
  }

  // Build URL for tkw-employees
  const empQuery = new URLSearchParams({
    page: 'tkw-employees',
    days: String(empDays),
  });
  if (empDetailCode && empDetailCode !== '(Không mã)') {
    empQuery.set('employee', empDetailCode);
  }

  const [statsHtml, empHtml] = await Promise.all([
    fetchWpAdminHtml(`${baseUrl}?${statsQuery.toString()}`),
    fetchWpAdminHtml(`${baseUrl}?${empQuery.toString()}`),
  ]);

  const parsedStats = parseTkwStatsHtml(statsHtml);
  const parsedEmp = parseTkwEmployeesHtml(empHtml, empDetailCode);

  return {
    ok: true,
    siteUrl: DEFAULT_WP_SITE,
    fetchedAt: new Date().toISOString(),
    range,
    from: parsedStats.from,
    to: parsedStats.to,
    timezone: parsedStats.timezone,
    employee,
    liveEmployee,
    topRange,
    topFrom: parsedStats.topFrom,
    topTo: parsedStats.topTo,
    employeeOptions: parsedStats.employeeOptions,
    realtime: parsedStats.realtime,
    summary: parsedStats.summary,
    topPosts: parsedStats.topPosts,
    daily: parsedStats.daily,
    employeeRanking: {
      days: empDays,
      selectedEmployee: empDetailCode,
      rows: parsedEmp.rows,
      detail: parsedEmp.detail,
    },
  };
}

export async function fetchWpLivePanelOnly(liveEmployee = ''): Promise<WpRealtimeData> {
  const session = await loginToWordPress(false);
  const ajaxUrl = `${DEFAULT_WP_SITE.replace(/\/$/, '')}/wp-admin/admin-ajax.php`;

  if (session.nonce) {
    try {
      const body = new URLSearchParams({
        action: 'tkw_live_panel',
        nonce: session.nonce,
        code: liveEmployee,
      });
      const res = await fetch(ajaxUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: session.cookieHeader,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
        body: body.toString(),
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.success && json.data) {
          return {
            online: Number(json.data.online || 0),
            today_views: Number(json.data.today_views || 0),
            today_visitors: Number(json.data.today_visitors || 0),
            minutes: Array.isArray(json.data.minutes) ? json.data.minutes : [],
            pages: Array.isArray(json.data.pages)
              ? json.data.pages.map((p: any) => ({
                  title: decodeHtmlEntities(String(p.title || '')),
                  count: Number(p.count || 0),
                }))
              : [],
            updated: String(json.data.updated || ''),
            code: liveEmployee,
          };
        }
      }
    } catch (e) {
      console.warn('[wpStatsService] AJAX live panel fallback to full HTML:', e);
    }
  }

  // Fallback: fetch tkw-stats HTML to refresh nonce + live data
  const baseUrl = `${DEFAULT_WP_SITE.replace(/\/$/, '')}/wp-admin/admin.php?page=tkw-stats&live_employee=${encodeURIComponent(
    liveEmployee
  )}`;
  const html = await fetchWpAdminHtml(baseUrl);
  const parsed = parseTkwStatsHtml(html);
  return parsed.realtime;
}
