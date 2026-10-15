export interface WpRealtimeMinute {
  time: string;
  views: number;
  visitors: number;
}

export interface WpActivePage {
  title: string;
  url: string;
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
  scope: string;
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
  rank?: number;
  title: string;
  url: string;
  views: number;
  visitors?: number;
}

export interface WpTop10PanelData {
  heading: string;
  subtitle: string;
  mutedText: string;
  rows: WpTopPostRow[];
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
  staffTopHeading?: string;
  staffTopDescription?: string;
  staffTopPeriod?: string;
}

export interface WpStatsDashboardPayload {
  ok: boolean;
  siteUrl: string;
  fetchedAt: string;
  range: string;
  from: string;
  to: string;
  timezone: string;
  scope: 'site' | 'mine' | 'employee';
  employee: string;
  liveEmployee: string;
  topRange: string;
  topFrom: string;
  topTo: string;
  employeeOptions: WpEmployeeOption[];
  realtime: WpRealtimeData;
  summary: WpSummaryStats;
  topPosts: WpTopPostRow[];
  primaryTopPanel: WpTop10PanelData;
  secondaryTopPanel: WpTop10PanelData | null;
  daily: WpDailyRow[];
  employeeRanking: {
    days: number;
    selectedEmployee: string;
    staffTopPeriod: string;
    rows: WpEmployeeRankRow[];
    detail: WpEmployeeDetail | null;
  };
}

const DEFAULT_WP_SITE = process.env.WP_STATS_SITE_URL || 'https://celeb24h.com';
const DEFAULT_WP_USER = process.env.WP_STATS_USERNAME || 'adgoole';
const DEFAULT_WP_PASS = process.env.WP_STATS_PASSWORD || 'Biencualo8282#';

const FALLBACK_EMPLOYEE_OPTIONS: WpEmployeeOption[] = [
  { code: 'A0006', label: 'A0006 · Mr Google' },
  { code: 'H0082', label: 'H0082 · admin' },
  { code: 'H0088', label: 'H0088 · Hiep MS' },
  { code: 'H2000', label: 'H2000 · Ms Huyen' },
  { code: 'M2001', label: 'M2001 · Ms Ly' },
  { code: 'A0005', label: 'A0005 · Ms Nhi' },
];

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

function extractUrlFromCell(cellHtml: string): string {
  if (!cellHtml) return '';
  const copyAttr = cellHtml.match(/data-copy-url="([^"]*)"/);
  if (copyAttr && copyAttr[1]) return decodeHtmlEntities(copyAttr[1].trim());
  const valAttr = cellHtml.match(/value="([^"]*)"/);
  if (valAttr && valAttr[1]) return decodeHtmlEntities(valAttr[1].trim());
  const hrefAttr = cellHtml.match(/href="([^"]*)"/);
  if (hrefAttr && hrefAttr[1]) return decodeHtmlEntities(hrefAttr[1].trim());
  return '';
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
    throw new Error(
      'Không thể đăng nhập vào WordPress Admin celeb24h.com. Vui lòng kiểm tra tài khoản.'
    );
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

function parseTop10PanelBlock(panelHtml: string): WpTop10PanelData {
  const headingMatch = panelHtml.match(/<h3>(.*?)<\/h3>/s);
  const subtitleMatch = panelHtml.match(/<span class="tkw-section-subtitle">(.*?)<\/span>/s);
  const mutedMatch = panelHtml.match(/<p class="tkw-muted">(.*?)<\/p>/s);

  const heading = headingMatch ? stripTags(headingMatch[1]) : 'Top 10 bài viết / trang';
  const subtitle = subtitleMatch ? stripTags(subtitleMatch[1]) : '';
  const mutedText = mutedMatch ? stripTags(mutedMatch[1]) : '';

  const rows: WpTopPostRow[] = [];
  const tbodyMatch = panelHtml.match(/<tbody[^>]*>(.*?)<\/tbody>/s);
  if (tbodyMatch) {
    const trRegex = /<tr[^>]*>(.*?)<\/tr>/gs;
    let trMatch: RegExpExecArray | null;
    while ((trMatch = trRegex.exec(tbodyMatch[1])) !== null) {
      const tdRegex = /<td[^>]*>(.*?)<\/td>/gs;
      const rawCells: string[] = [];
      let tdMatch: RegExpExecArray | null;
      while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
        rawCells.push(tdMatch[1]);
      }

      if (rawCells.length >= 3) {
        const title = stripTags(rawCells[0]);
        const url = extractUrlFromCell(rawCells[1]);
        const views = parseNumber(stripTags(rawCells[2]));
        if (title && !title.toLowerCase().includes('chưa có dữ liệu')) {
          rows.push({ title, url, views });
        }
      } else if (rawCells.length === 2) {
        const title = stripTags(rawCells[0]);
        const url = extractUrlFromCell(rawCells[0]);
        const views = parseNumber(stripTags(rawCells[1]));
        if (title && !title.toLowerCase().includes('chưa có dữ liệu')) {
          rows.push({ title, url, views });
        }
      }
    }
  }

  return { heading, subtitle, mutedText, rows };
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
    scope: 'site',
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
                url: decodeHtmlEntities(String(p.url || '')),
                count: Number(p.count || 0),
              }))
            : [],
          updated: String(parsed.initial.updated || ''),
          code: String(parsed.code || ''),
          scope: String(parsed.scope || 'site'),
        };
      }
    } catch (e) {
      console.warn('[wpStatsService] Failed to parse window.TKWDash JSON:', e);
    }
  }

  // 2. Extract employee options from <select ... name="employee">
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
  const finalEmployeeOptions =
    employeeOptions.length > 0 ? employeeOptions : FALLBACK_EMPLOYEE_OPTIONS;

  // 3. Extract date inputs & timezone
  const fromMatch = html.match(/<input[^>]*name="from"[^>]*value="([^"]*)"/);
  const toMatch = html.match(/<input[^>]*name="to"[^>]*value="([^"]*)"/);
  const topFromMatch = html.match(/<input[^>]*name="top_from"[^>]*value="([^"]*)"/);
  const topToMatch = html.match(/<input[^>]*name="top_to"[^>]*value="([^"]*)"/);
  const tzMatch = html.match(/Múi giờ\s+([^\.\s<]+)/);

  // 4. Extract Summary (.tkw-summary-grid in v3.2+ or fallback table)
  const summary: WpSummaryStats = {
    views: 0,
    visitors: 0,
    newcomers: 0,
    returning: 0,
  };

  const summaryGridMatch = html.match(/<div class="tkw-summary-grid">(.*?)<\/div>\s*<\/div>/s);
  if (summaryGridMatch) {
    const cardRegex =
      /<div class="tkw-summary-card">.*?<span class="tkw-summary-label">(.*?)<\/span>\s*<strong>(.*?)<\/strong>\s*<\/div>/gs;
    let m: RegExpExecArray | null;
    while ((m = cardRegex.exec(summaryGridMatch[1])) !== null) {
      const label = stripTags(m[1]).toLowerCase();
      const val = parseNumber(stripTags(m[2]));
      if (label.includes('lượt xem')) summary.views = val;
      else if (label.includes('khách duy nhất')) summary.visitors = val;
      else if (label.includes('khách mới')) summary.newcomers = val;
      else if (label.includes('quay lại')) summary.returning = val;
    }
  } else {
    const summarySectionMatch = html.match(
      /<div class="tkw-whitepanel[^"]*">.*?<h3>Tổng hợp[^<]*<\/h3>.*?<table><tbody>(.*?)<\/tbody><\/table>/s
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
        else if (label.includes('quay lại')) summary.returning = val;
      }
    }
  }

  // 5. Extract Primary Top 10 and Secondary Top 10 panels (.tkw-top10 & .tkw-top-secondary)
  let primaryTopPanel: WpTop10PanelData = {
    heading: 'Top 10 bài viết / trang',
    subtitle: 'Xếp theo lượt xem',
    mutedText: '',
    rows: [],
  };
  let secondaryTopPanel: WpTop10PanelData | null = null;

  const belowMatch = html.match(/<div class="tkw-below">(.*?)<div class="tkw-whitepanel tkw-daily">/s);
  if (belowMatch) {
    const belowHtml = belowMatch[1];
    const topPanels = [
      ...belowHtml.matchAll(
        /<div class="tkw-whitepanel tkw-top10([^"]*)">([\s\S]*?)<\/table>\s*<\/div>\s*<\/div>/g
      ),
    ];
    if (topPanels.length >= 1) {
      primaryTopPanel = parseTop10PanelBlock(topPanels[0][2] + '</table></div></div>');
    }
    if (topPanels.length >= 2) {
      secondaryTopPanel = parseTop10PanelBlock(topPanels[1][2] + '</table></div></div>');
    }
  }

  // 6. Extract Theo ngày table (.tkw-whitepanel.tkw-daily)
  const daily: WpDailyRow[] = [];
  const dailySectionMatch = html.match(
    /<div class="tkw-whitepanel[^"]*"><h3>Theo ngày<\/h3>.*?<table><thead>.*?<\/thead><tbody>(.*?)<\/tbody><\/table>/s
  );
  if (dailySectionMatch) {
    const rowRegex = /<tr><td>(.*?)<\/td><td>(.*?)<\/td><td>(.*?)<\/td><\/tr>/gs;
    let m: RegExpExecArray | null;
    while ((m = rowRegex.exec(dailySectionMatch[1])) !== null) {
      const day = stripTags(m[1]);
      const views = parseNumber(stripTags(m[2]));
      const visitors = parseNumber(stripTags(m[3]));
      if (day && !day.toLowerCase().includes('chưa có dữ liệu')) {
        daily.push({ day, views, visitors });
      }
    }
  }

  return {
    realtime,
    employeeOptions: finalEmployeeOptions,
    from: fromMatch ? fromMatch[1] : '',
    to: toMatch ? toMatch[1] : '',
    topFrom: topFromMatch ? topFromMatch[1] : '',
    topTo: topToMatch ? topToMatch[1] : '',
    timezone: tzMatch ? tzMatch[1] : '+00:00',
    summary,
    topPosts: primaryTopPanel.rows,
    primaryTopPanel,
    secondaryTopPanel,
    daily,
  };
}

export function parseTkwEmployeesHtml(
  html: string,
  selectedEmployee: string,
  staffTopPeriod = '7'
) {
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

  // 2. Parse Chi tiết: <CODE> and .tkw-staff-top if present
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

    // Parse v2.9+ .tkw-staff-top panel or legacy Top bài viết/trang
    const topPosts: WpTopPostRow[] = [];
    let staffTopHeading = `Top 10 bài viết / trang của nhân viên mã ${code || selectedEmployee}`;
    let staffTopDescription = '';

    const staffTopMatch = detailHtml.match(/<div class="tkw-staff-top">([\s\S]*?)<\/table>\s*<\/div>/);
    if (staffTopMatch) {
      const staffTopHtml = staffTopMatch[1] + '</table>';
      const h2Match = staffTopHtml.match(/<h2>(.*?)<\/h2>/s);
      if (h2Match) staffTopHeading = stripTags(h2Match[1]);
      const descMatch = staffTopHtml.match(/<p class="description">(.*?)<\/p>/s);
      if (descMatch) staffTopDescription = stripTags(descMatch[1]);

      const tbodyMatch = staffTopHtml.match(/<tbody[^>]*>(.*?)<\/tbody>/s);
      if (tbodyMatch) {
        const trRegex = /<tr[^>]*>(.*?)<\/tr>/gs;
        let trMatch: RegExpExecArray | null;
        while ((trMatch = trRegex.exec(tbodyMatch[1])) !== null) {
          const tdRegex = /<td[^>]*>(.*?)<\/td>/gs;
          const rawCells: string[] = [];
          let tdMatch: RegExpExecArray | null;
          while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
            rawCells.push(tdMatch[1]);
          }
          if (rawCells.length >= 5) {
            const rank = parseNumber(stripTags(rawCells[0]));
            const title = stripTags(rawCells[1]);
            const url = extractUrlFromCell(rawCells[2]);
            const views = parseNumber(stripTags(rawCells[3]));
            const visitors = parseNumber(stripTags(rawCells[4]));
            if (title && !title.toLowerCase().includes('chưa có dữ liệu')) {
              topPosts.push({ rank, title, url, views, visitors });
            }
          }
        }
      }
    } else {
      const topBoxMatch = detailHtml.match(
        /<h3>Top bài viết\/trang<\/h3><table[^>]*>(.*?)<\/table>/s
      );
      if (topBoxMatch) {
        const trRegex = /<tr><td>(.*?)<\/td><td>(.*?)<\/td><\/tr>/gs;
        let m: RegExpExecArray | null;
        while ((m = trRegex.exec(topBoxMatch[1])) !== null) {
          const title = stripTags(m[1]);
          const views = parseNumber(stripTags(m[2]));
          if (title && !title.toLowerCase().includes('chưa có dữ liệu')) {
            topPosts.push({ title, url: '', views });
          }
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
      staffTopHeading,
      staffTopDescription,
      staffTopPeriod,
    };
  }

  return { rows, detail };
}

export interface FetchWpStatsParams {
  range?: string;
  from?: string;
  to?: string;
  scope?: 'site' | 'mine' | 'employee';
  employee?: string;
  viewerEmployeeCode?: string;
  liveEmployee?: string;
  topRange?: string;
  topFrom?: string;
  topTo?: string;
  empDays?: string | number;
  empDetailCode?: string;
  staffTopPeriod?: string;
}

export async function fetchWpStatsDashboard(
  params: FetchWpStatsParams = {}
): Promise<WpStatsDashboardPayload> {
  const baseUrl = `${DEFAULT_WP_SITE.replace(/\/$/, '')}/wp-admin/admin.php`;

  const range = params.range || '7';
  const rawScope = params.scope || (params.employee ? 'employee' : 'site');
  const viewerCode = (params.viewerEmployeeCode || '').trim();
  const employee =
    rawScope === 'mine'
      ? viewerCode || params.employee || 'A0006'
      : rawScope === 'employee'
      ? (params.employee || viewerCode || '').trim()
      : '';

  const effectiveWpScope =
    rawScope === 'mine' || (rawScope === 'employee' && employee) ? 'employee' : 'site';

  const liveEmployee =
    params.liveEmployee !== undefined
      ? params.liveEmployee
      : effectiveWpScope === 'employee'
      ? employee
      : '';

  const topRange = params.topRange || '7';
  const empDays = Number(params.empDays) === 30 ? 30 : 7;
  const empDetailCode = params.empDetailCode ?? (employee || 'M2001');
  const staffTopPeriod = params.staffTopPeriod || '7';

  // Build URL for tkw-stats
  const statsQuery = new URLSearchParams({
    page: 'tkw-stats',
    range,
    scope: effectiveWpScope,
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
    staff_top_period: staffTopPeriod,
  });
  if (empDetailCode && empDetailCode !== '(Không mã)') {
    empQuery.set('employee', empDetailCode);
  }

  // If viewing site-wide (scope=site) AND the viewer has a specific employee code (e.g. M2001, H2000) different from A0006,
  // also fetch that employee's Top 10 so the Secondary Top 10 panel ("Top 10 bài viết / trang của nhân viên mã ...") matches their code!
  const needViewerSecondaryFetch =
    effectiveWpScope === 'site' && Boolean(viewerCode) && viewerCode !== 'A0006';

  const viewerStatsQuery = new URLSearchParams(statsQuery);
  if (needViewerSecondaryFetch) {
    viewerStatsQuery.set('scope', 'employee');
    viewerStatsQuery.set('employee', viewerCode);
  }

  const [statsHtml, empHtml, viewerStatsHtml] = await Promise.all([
    fetchWpAdminHtml(`${baseUrl}?${statsQuery.toString()}`),
    fetchWpAdminHtml(`${baseUrl}?${empQuery.toString()}`),
    needViewerSecondaryFetch
      ? fetchWpAdminHtml(`${baseUrl}?${viewerStatsQuery.toString()}`)
      : Promise.resolve(''),
  ]);

  const parsedStats = parseTkwStatsHtml(statsHtml);
  const parsedEmp = parseTkwEmployeesHtml(empHtml, empDetailCode, staffTopPeriod);

  let secondaryTopPanel = parsedStats.secondaryTopPanel;
  if (needViewerSecondaryFetch && viewerStatsHtml) {
    const parsedViewer = parseTkwStatsHtml(viewerStatsHtml);
    secondaryTopPanel = {
      heading: `Top 10 bài viết / trang của nhân viên mã ${viewerCode}`,
      subtitle: `Cùng kỳ · ${parsedStats.topFrom || parsedStats.from} – ${
        parsedStats.topTo || parsedStats.to
      }`,
      mutedText: `Chỉ các lượt truy cập gắn với mã ${viewerCode}`,
      rows: parsedViewer.primaryTopPanel.rows,
    };
  }

  return {
    ok: true,
    siteUrl: DEFAULT_WP_SITE,
    fetchedAt: new Date().toISOString(),
    range,
    from: parsedStats.from,
    to: parsedStats.to,
    timezone: parsedStats.timezone,
    scope: rawScope,
    employee,
    liveEmployee,
    topRange,
    topFrom: parsedStats.topFrom,
    topTo: parsedStats.topTo,
    employeeOptions: parsedStats.employeeOptions,
    realtime: parsedStats.realtime,
    summary: parsedStats.summary,
    topPosts: parsedStats.topPosts,
    primaryTopPanel: parsedStats.primaryTopPanel,
    secondaryTopPanel,
    daily: parsedStats.daily,
    employeeRanking: {
      days: empDays,
      selectedEmployee: empDetailCode,
      staffTopPeriod,
      rows: parsedEmp.rows,
      detail: parsedEmp.detail,
    },
  };
}

export async function fetchWpLivePanelOnly(
  liveEmployee = '',
  scope = ''
): Promise<WpRealtimeData> {
  const session = await loginToWordPress(false);
  const ajaxUrl = `${DEFAULT_WP_SITE.replace(/\/$/, '')}/wp-admin/admin-ajax.php`;
  const effectiveScope = scope || (liveEmployee ? 'employee' : 'site');

  if (session.nonce) {
    try {
      const body = new URLSearchParams({
        action: 'tkw_live_panel',
        nonce: session.nonce,
        code: liveEmployee,
        scope: effectiveScope,
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
                  url: decodeHtmlEntities(String(p.url || '')),
                  count: Number(p.count || 0),
                }))
              : [],
            updated: String(json.data.updated || ''),
            code: liveEmployee,
            scope: effectiveScope,
          };
        }
      }
    } catch (e) {
      console.warn('[wpStatsService] AJAX live panel fallback to full HTML:', e);
    }
  }

  // Fallback: fetch tkw-stats HTML to refresh nonce + live data
  const baseUrl = `${DEFAULT_WP_SITE.replace(
    /\/$/,
    ''
  )}/wp-admin/admin.php?page=tkw-stats&scope=${encodeURIComponent(
    effectiveScope
  )}&employee=${encodeURIComponent(liveEmployee)}`;
  const html = await fetchWpAdminHtml(baseUrl);
  const parsed = parseTkwStatsHtml(html);
  return parsed.realtime;
}
