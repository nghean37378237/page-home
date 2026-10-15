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

export interface WpEmployeeOption {
  code: string;
  label: string;
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
  staffTopHeading: string;
  staffTopDescription: string;
  staffTopPeriod: string;
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
  siteRealtime?: WpRealtimeData;
  employeeRealtime?: WpRealtimeData | null;
  summary: WpSummaryStats;
  siteSummary?: WpSummaryStats;
  employeeSummary?: WpSummaryStats | null;
  topPosts: WpTopPostRow[];
  primaryTopPanel: WpTop10PanelData;
  secondaryTopPanel: WpTop10PanelData | null;
  siteTopPanel?: WpTop10PanelData;
  employeeTopPanel?: WpTop10PanelData | null;
  daily: WpDailyRow[];
  siteDaily?: WpDailyRow[];
  employeeDaily?: WpDailyRow[];
  employeeRanking: {
    days: number;
    selectedEmployee: string;
    staffTopPeriod: string;
    siteRow?: WpEmployeeRankRow;
    rows: WpEmployeeRankRow[];
    detail: WpEmployeeDetail | null;
  };
}

interface WpCookieSession {
  cookieHeader: string;
  nonce: string;
  expiresAt: number;
}

const DEFAULT_WP_SITE = process.env.WP_STATS_SITE_URL || 'https://celeb24h.com';
const DEFAULT_WP_USER = process.env.WP_STATS_USERNAME || 'adgoole';
const DEFAULT_WP_PASS = process.env.WP_STATS_PASSWORD || 'Biencualo8282#';

const FALLBACK_EMPLOYEE_OPTIONS: WpEmployeeOption[] = [
  { code: 'A0006', label: 'A0006 · Mr Google' },
  { code: 'H0082', label: 'H0082 · admin' },
  { code: 'H000', label: 'H000 · Hiep' },
  { code: 'H0088', label: 'H0088 · Hiep MS' },
  { code: 'H2000', label: 'H2000 · Ms Huyen' },
  { code: 'M2001', label: 'M2001 · Ms Ly' },
  { code: 'A0005', label: 'A0005 · Ms Nhi' },
];

let cachedSession: WpCookieSession | null = null;

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
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function stripTags(html: string): string {
  if (!html) return '';
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));
}

function parseNumber(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function extractSetCookies(res: Response): string[] {
  const anyHeaders = res.headers as any;
  if (typeof anyHeaders.getSetCookie === 'function') {
    return anyHeaders.getSetCookie();
  }
  const raw = res.headers.get('set-cookie');
  if (!raw) return [];
  return raw.split(/,(?=\s*[a-zA-Z0-9_-]+=)/);
}

async function loginToWordPress(force = false): Promise<WpCookieSession> {
  const now = Date.now();
  if (!force && cachedSession && cachedSession.expiresAt > now) {
    return cachedSession;
  }

  const siteUrl = DEFAULT_WP_SITE.replace(/\/$/, '');
  const loginUrl = `${siteUrl}/wp-login.php`;

  const body = new URLSearchParams({
    log: DEFAULT_WP_USER,
    pwd: DEFAULT_WP_PASS,
    'wp-submit': 'Log In',
    redirect_to: `${siteUrl}/wp-admin/`,
    testcookie: '1',
  });

  const loginRes = await fetch(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: 'wordpress_test_cookie=WP%20Cookie%20check',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    },
    body: body.toString(),
    redirect: 'manual',
  });

  const cookies = extractSetCookies(loginRes)
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean);

  if (cookies.length === 0 || !cookies.some((c) => c.startsWith('wordpress_logged_in_'))) {
    throw new Error('Không thể đăng nhập vào WordPress Admin celeb24h.com. Vui lòng kiểm tra tài khoản.');
  }

  const cookieHeader = cookies.join('; ');
  cachedSession = {
    cookieHeader,
    nonce: '',
    expiresAt: now + 25 * 60 * 1000,
  };

  return cachedSession;
}

async function fetchWpAdminHtml(url: string, retry = true): Promise<string> {
  const session = await loginToWordPress(false);
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Cookie: session.cookieHeader,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  });

  const html = await res.text();

  if (
    retry &&
    (res.url.includes('wp-login.php') ||
      html.includes('id="loginform"') ||
      (!html.includes('tkw-modern') && !html.includes('tkw-employees') && !html.includes('Bảng xếp hạng nhân viên')))
  ) {
    const freshSession = await loginToWordPress(true);
    const retryRes = await fetch(url, {
      method: 'GET',
      headers: {
        Cookie: freshSession.cookieHeader,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
    });
    return await retryRes.text();
  }

  return html;
}

function extractUrlFromCell(cellHtml: string): string {
  if (!cellHtml) return '';
  const dataCopyMatch = cellHtml.match(/data-copy-url="([^"]+)"/);
  if (dataCopyMatch) return decodeHtmlEntities(dataCopyMatch[1]);
  const inputValMatch = cellHtml.match(/value="([^"]+)"/);
  if (inputValMatch) return decodeHtmlEntities(inputValMatch[1]);
  const hrefMatch = cellHtml.match(/href="([^"]+)"/);
  if (hrefMatch) return decodeHtmlEntities(hrefMatch[1]);
  return '';
}

function parseTop10PanelBlock(panelHtml: string): WpTop10PanelData {
  const h3Match = panelHtml.match(/<h3>([\s\S]*?)<\/h3>/);
  const subMatch = panelHtml.match(/<span class="tkw-section-subtitle">([\s\S]*?)<\/span>/);
  const mutedMatch = panelHtml.match(/<p class="tkw-muted">([\s\S]*?)<\/p>/);

  const heading = h3Match ? stripTags(h3Match[1]) : 'Top 10 bài viết / trang';
  const subtitle = subMatch ? stripTags(subMatch[1]) : '';
  const mutedText = mutedMatch ? stripTags(mutedMatch[1]) : '';

  const rows: WpTopPostRow[] = [];
  const tbodyMatch = panelHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  if (tbodyMatch) {
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let trMatch: RegExpExecArray | null;
    while ((trMatch = trRegex.exec(tbodyMatch[1])) !== null) {
      const rowHtml = trMatch[1];
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
      const rawCells: string[] = [];
      let tdMatch: RegExpExecArray | null;
      while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
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

  // 1. Extract embedded TKWLive.initial JSON
  const tkwLiveMatch = html.match(/var\s+TKWLive\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (tkwLiveMatch) {
    try {
      const parsed = JSON.parse(tkwLiveMatch[1]);
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
                title: String(p.title || '(Không tiêu đề)'),
                url: String(p.url || ''),
                count: Number(p.count || 0),
              }))
            : [],
          updated: String(parsed.initial.updated || ''),
          code: String(parsed.initial.code || parsed.liveEmployee || ''),
          scope: String(parsed.initial.scope || parsed.scope || 'site'),
        };
      }
    } catch {
      // Fallback to DOM regex below
    }
  }

  // Fallback for active pages if not in TKWLive.initial
  if (realtime.pages.length === 0) {
    const activeBodyMatch = html.match(/<tbody\s+data-active-pages>([\s\S]*?)<\/tbody>/);
    if (activeBodyMatch) {
      const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
      let trMatch: RegExpExecArray | null;
      while ((trMatch = trRegex.exec(activeBodyMatch[1])) !== null) {
        const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
        const cells: string[] = [];
        let tdMatch: RegExpExecArray | null;
        while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
          cells.push(tdMatch[1]);
        }
        if (cells.length >= 3) {
          const title = stripTags(cells[0]);
          const url = extractUrlFromCell(cells[1]);
          const count = parseNumber(stripTags(cells[2]));
          if (title && !title.toLowerCase().includes('chưa có khách')) {
            realtime.pages.push({ title, url, count });
          }
        }
      }
    }
  }

  // 2. Extract employee dropdown options
  const employeeOptions: WpEmployeeOption[] = [];
  const empSelectMatch = html.match(/<select[^>]*name="employee"[^>]*>([\s\S]*?)<\/select>/);
  if (empSelectMatch) {
    const optRegex = /<option\s+value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/g;
    let m: RegExpExecArray | null;
    while ((m = optRegex.exec(empSelectMatch[1])) !== null) {
      const code = decodeHtmlEntities(m[1]);
      const label = stripTags(m[2]);
      if (code) {
        employeeOptions.push({ code, label });
      }
    }
  }
  const finalEmployeeOptions =
    employeeOptions.length > 0 ? employeeOptions : FALLBACK_EMPLOYEE_OPTIONS;

  // 3. Extract date range & timezone
  const mutedMatch = html.match(
    /Khoảng:\s*(\d{4}-\d{2}-\d{2})\s*[–-]\s*(\d{4}-\d{2}-\d{2})\s*·\s*Múi giờ\s*([+\-\d:]+)/
  );
  const fromMatch = html.match(/name="from"\s+value="([^"]*)"/);
  const toMatch = html.match(/name="to"\s+value="([^"]*)"/);
  const topFromMatch = html.match(/name="top_from"\s+value="([^"]*)"/);
  const topToMatch = html.match(/name="top_to"\s+value="([^"]*)"/);
  const tzMatch = mutedMatch ? [mutedMatch[0], mutedMatch[3]] : null;

  // 4. Extract Summary stats (.tkw-summary-grid / .tkw-summary-card in v3.4)
  const summary: WpSummaryStats = {
    views: 0,
    visitors: 0,
    newcomers: 0,
    returning: 0,
  };

  const cardRegex =
    /<div class="tkw-summary-card">[\s\S]*?<span class="tkw-summary-label">([\s\S]*?)<\/span>\s*<strong>([\s\S]*?)<\/strong>\s*<\/div>/g;
  let cardMatch: RegExpExecArray | null;
  let foundCards = false;
  while ((cardMatch = cardRegex.exec(html)) !== null) {
    foundCards = true;
    const label = stripTags(cardMatch[1]).toLowerCase();
    const val = parseNumber(stripTags(cardMatch[2]));
    if (label.includes('lượt xem')) summary.views = val;
    else if (label.includes('khách duy nhất')) summary.visitors = val;
    else if (label.includes('khách mới')) summary.newcomers = val;
    else if (label.includes('quay lại')) summary.returning = val;
  }

  if (!foundCards) {
    const summarySectionMatch = html.match(
      /<div class="tkw-whitepanel[^"]*">[\s\S]*?<h3>Tổng hợp[^<]*<\/h3>[\s\S]*?<table><tbody>([\s\S]*?)<\/tbody><\/table>/
    );
    if (summarySectionMatch) {
      const rowRegex = /<tr><td>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><\/tr>/g;
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

  const topPanels = [
    ...html.matchAll(
      /<div class="tkw-whitepanel tkw-top10[^"]*">([\s\S]*?<table class="tkw-data-table">[\s\S]*?<\/table>)\s*<\/div>\s*<\/div>/g
    ),
  ];
  if (topPanels.length >= 1) {
    primaryTopPanel = parseTop10PanelBlock(topPanels[0][1]);
  }
  if (topPanels.length >= 2) {
    secondaryTopPanel = parseTop10PanelBlock(topPanels[1][1]);
  }

  // 6. Extract Theo ngày table (.tkw-whitepanel.tkw-daily)
  const daily: WpDailyRow[] = [];
  const dailySectionMatch = html.match(
    /<div class="tkw-whitepanel[^"]*tkw-daily[^"]*">[\s\S]*?<h3>Theo ngày<\/h3>[\s\S]*?<tbody[^>]*>([\s\S]*?)<\/tbody>\s*<\/table>/
  );
  if (dailySectionMatch) {
    const rowRegex = /<tr>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g;
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
    /<h2>Bảng xếp hạng nhân viên<\/h2>[\s\S]*?<table[^>]*><thead>[\s\S]*?<\/thead><tbody>([\s\S]*?)<\/tbody><\/table>/
  );
  if (rankTableMatch) {
    const trRegex = /<tr>([\s\S]*?)<\/tr>/g;
    let trMatch: RegExpExecArray | null;
    while ((trMatch = trRegex.exec(rankTableMatch[1])) !== null) {
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
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
  const detailHeaderMatch = html.match(/<h2>Chi tiết:\s*([^<]+)<\/h2>([\s\S]*)/);
  if (detailHeaderMatch) {
    const code = stripTags(detailHeaderMatch[1]);
    const detailHtml = detailHeaderMatch[2];

    const daily: WpDailyRow[] = [];
    const dailyBoxMatch = detailHtml.match(/<h3>Theo ngày<\/h3><table[^>]*>([\s\S]*?)<\/table>/);
    if (dailyBoxMatch) {
      const trRegex = /<tr><td>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><\/tr>/g;
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
      const regex = new RegExp(`<h3>${heading}<\\/h3><table[^>]*>([\\s\\S]*?)<\\/table>`);
      const match = detailHtml.match(regex);
      if (match) {
        const trRegex = /<tr><td>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><\/tr>/g;
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
      const h2Match = staffTopHtml.match(/<h2>([\s\S]*?)<\/h2>/);
      if (h2Match) staffTopHeading = stripTags(h2Match[1]);
      const descMatch = staffTopHtml.match(/<p class="description">([\s\S]*?)<\/p>/);
      if (descMatch) staffTopDescription = stripTags(descMatch[1]);

      const tbodyMatch = staffTopHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
      if (tbodyMatch) {
        const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
        let trMatch: RegExpExecArray | null;
        while ((trMatch = trRegex.exec(tbodyMatch[1])) !== null) {
          const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
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
        /<h3>Top bài viết\/trang<\/h3><table[^>]*>([\s\S]*?)<\/table>/
      );
      if (topBoxMatch) {
        const trRegex = /<tr><td>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><\/tr>/g;
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
      ? viewerCode || params.employee || 'M2001'
      : rawScope === 'employee'
      ? (params.employee || viewerCode || '').trim()
      : '';

  const effectiveWpScope =
    rawScope === 'mine' || (rawScope === 'employee' && employee) ? 'employee' : 'site';

  const liveEmployee =
    params.liveEmployee !== undefined && params.liveEmployee !== ''
      ? params.liveEmployee
      : effectiveWpScope === 'employee'
      ? employee
      : '';

  const topRange = params.topRange || '7';
  const empDays = Number(params.empDays) === 30 ? 30 : 7;
  const targetEmpCode =
    employee ||
    params.empDetailCode ||
    (viewerCode && viewerCode !== 'A0006' ? viewerCode : 'M2001');
  const empDetailCode = params.empDetailCode || targetEmpCode;
  const staffTopPeriod = params.staffTopPeriod || '7';

  // Build URL for site-wide tkw-stats
  const siteStatsQuery = new URLSearchParams({
    page: 'tkw-stats',
    range,
    scope: 'site',
  });
  if (params.from && params.to) {
    siteStatsQuery.set('from', params.from);
    siteStatsQuery.set('to', params.to);
  }
  if (topRange) siteStatsQuery.set('top_range', topRange);
  if (topRange === 'custom' && params.topFrom && params.topTo) {
    siteStatsQuery.set('top_from', params.topFrom);
    siteStatsQuery.set('top_to', params.topTo);
  }

  // Build URL for employee-scoped tkw-stats
  const empStatsQuery = new URLSearchParams(siteStatsQuery);
  if (targetEmpCode) {
    empStatsQuery.set('scope', 'employee');
    empStatsQuery.set('employee', targetEmpCode);
    empStatsQuery.set('live_employee', targetEmpCode);
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

  // Fetch site-wide stats, employee stats, and employee ranking/detail in parallel
  const [siteStatsHtml, empStatsHtml, empHtml] = await Promise.all([
    fetchWpAdminHtml(`${baseUrl}?${siteStatsQuery.toString()}`),
    targetEmpCode
      ? fetchWpAdminHtml(`${baseUrl}?${empStatsQuery.toString()}`)
      : Promise.resolve(''),
    fetchWpAdminHtml(`${baseUrl}?${empQuery.toString()}`),
  ]);

  const parsedSite = parseTkwStatsHtml(siteStatsHtml);
  const parsedEmpStats = empStatsHtml ? parseTkwStatsHtml(empStatsHtml) : null;
  const parsedEmp = parseTkwEmployeesHtml(empHtml, empDetailCode, staffTopPeriod);

  const activeParsed =
    effectiveWpScope === 'employee' && parsedEmpStats ? parsedEmpStats : parsedSite;

  const siteTopPanel: WpTop10PanelData = {
    heading: parsedSite.primaryTopPanel.heading || 'Top 10 bài viết / trang toàn website',
    subtitle:
      parsedSite.primaryTopPanel.subtitle ||
      `Cùng kỳ · ${parsedSite.topFrom || parsedSite.from} – ${parsedSite.topTo || parsedSite.to}`,
    mutedText:
      parsedSite.primaryTopPanel.mutedText ||
      'Tất cả lượt truy cập ở domain gốc và các subdomain',
    rows: parsedSite.primaryTopPanel.rows,
  };

  const employeeTopPanel: WpTop10PanelData | null = parsedEmpStats
    ? {
        heading:
          parsedEmpStats.primaryTopPanel.heading ||
          `Top 10 bài viết / trang của nhân viên mã ${targetEmpCode}`,
        subtitle:
          parsedEmpStats.primaryTopPanel.subtitle ||
          `Cùng kỳ · ${parsedEmpStats.topFrom || parsedEmpStats.from} – ${
            parsedEmpStats.topTo || parsedEmpStats.to
          }`,
        mutedText:
          parsedEmpStats.primaryTopPanel.mutedText ||
          `Chỉ các lượt truy cập gắn với mã ${targetEmpCode}`,
        rows: parsedEmpStats.primaryTopPanel.rows,
      }
    : null;

  const primaryTopPanel =
    effectiveWpScope === 'employee' && employeeTopPanel ? employeeTopPanel : siteTopPanel;
  const secondaryTopPanel =
    effectiveWpScope === 'employee' ? siteTopPanel : employeeTopPanel;

  // Build overall website row for Bảng xếp hạng nhân viên (so employee & admin can see Tổng thể của web + Mã nhân viên)
  const sumRankViews = parsedEmp.rows.reduce((acc, r) => acc + (r.views || 0), 0);
  const sumRankVisitors = parsedEmp.rows.reduce((acc, r) => acc + (r.visitors || 0), 0);
  const sumRankNew = parsedEmp.rows.reduce((acc, r) => acc + (r.newVisitors || 0), 0);
  const sumRankReturning = parsedEmp.rows.reduce((acc, r) => acc + (r.returningVisitors || 0), 0);
  const sumRankOnline = parsedEmp.rows.reduce((acc, r) => acc + (r.online || 0), 0);

  const useSiteSummaryForRank = String(empDays) === String(range) && !params.from;
  const siteRow: WpEmployeeRankRow = {
    code: 'Toàn website',
    account: 'Tổng thể celeb24h.com (Gốc + Subdomain)',
    views: useSiteSummaryForRank
      ? Math.max(parsedSite.summary.views, sumRankViews)
      : sumRankViews || parsedSite.summary.views,
    visitors: useSiteSummaryForRank
      ? Math.max(parsedSite.summary.visitors, sumRankVisitors)
      : sumRankVisitors || parsedSite.summary.visitors,
    newVisitors: useSiteSummaryForRank
      ? Math.max(parsedSite.summary.newcomers, sumRankNew)
      : sumRankNew || parsedSite.summary.newcomers,
    returningVisitors: useSiteSummaryForRank
      ? Math.max(parsedSite.summary.returning, sumRankReturning)
      : sumRankReturning || parsedSite.summary.returning,
    online: Math.max(parsedSite.realtime.online, sumRankOnline),
  };

  return {
    ok: true,
    siteUrl: DEFAULT_WP_SITE,
    fetchedAt: new Date().toISOString(),
    range,
    from: activeParsed.from || parsedSite.from,
    to: activeParsed.to || parsedSite.to,
    timezone: activeParsed.timezone || parsedSite.timezone,
    scope: rawScope,
    employee,
    liveEmployee,
    topRange,
    topFrom: activeParsed.topFrom || parsedSite.topFrom,
    topTo: activeParsed.topTo || parsedSite.topTo,
    employeeOptions:
      parsedSite.employeeOptions.length > 0
        ? parsedSite.employeeOptions
        : activeParsed.employeeOptions,
    realtime: activeParsed.realtime,
    siteRealtime: parsedSite.realtime,
    employeeRealtime: parsedEmpStats ? parsedEmpStats.realtime : null,
    summary: activeParsed.summary,
    siteSummary: parsedSite.summary,
    employeeSummary: parsedEmpStats ? parsedEmpStats.summary : null,
    topPosts: primaryTopPanel.rows,
    primaryTopPanel,
    secondaryTopPanel,
    siteTopPanel,
    employeeTopPanel,
    daily: activeParsed.daily,
    siteDaily: parsedSite.daily,
    employeeDaily: parsedEmpStats ? parsedEmpStats.daily : [],
    employeeRanking: {
      days: empDays,
      selectedEmployee: empDetailCode,
      staffTopPeriod,
      siteRow,
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
    const body = new URLSearchParams({
      action: 'tkw_live_panel',
      nonce: session.nonce,
      live_employee: liveEmployee,
      scope: effectiveScope,
    });
    const res = await fetch(ajaxUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: session.cookieHeader,
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
          pages: Array.isArray(json.data.pages) ? json.data.pages : [],
          updated: String(json.data.updated || ''),
          code: String(json.data.code || liveEmployee),
          scope: String(json.data.scope || effectiveScope),
        };
      }
    }
  }

  const baseUrl = `${DEFAULT_WP_SITE.replace(/\/$/, '')}/wp-admin/admin.php`;
  const q = new URLSearchParams({
    page: 'tkw-stats',
    range: '7',
    scope: effectiveScope,
  });
  if (liveEmployee) {
    q.set('employee', liveEmployee);
    q.set('live_employee', liveEmployee);
  }
  const html = await fetchWpAdminHtml(`${baseUrl}?${q.toString()}`);
  return parseTkwStatsHtml(html).realtime;
}
