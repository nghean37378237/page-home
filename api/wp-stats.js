// Vercel Serverless Function for /api/wp-stats (tkw-modern v3.4 & tkw-employees v2.9+)
const DEFAULT_WP_SITE = process.env.WP_STATS_SITE_URL || 'https://celeb24h.com';
const DEFAULT_WP_USER = process.env.WP_STATS_USERNAME || 'adgoole';
const DEFAULT_WP_PASS = process.env.WP_STATS_PASSWORD || 'Biencualo8282#';

const FALLBACK_EMPLOYEE_OPTIONS = [
  { code: 'A0006', label: 'A0006 · Mr Google' },
  { code: 'H0082', label: 'H0082 · admin' },
  { code: 'H000', label: 'H000 · Hiep' },
  { code: 'H0088', label: 'H0088 · Hiep MS' },
  { code: 'H2000', label: 'H2000 · Ms Huyen' },
  { code: 'M2001', label: 'M2001 · Ms Ly' },
  { code: 'A0005', label: 'A0005 · Ms Nhi' },
];

let cachedSession = null;

function decodeHtmlEntities(str) {
  if (!str) return '';
  return String(str)
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
    .replace(/&#8230;/g, '…')
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

function extractUrlFromCell(cellHtml) {
  if (!cellHtml) return '';
  const dataCopyMatch = String(cellHtml).match(/data-copy-url="([^"]+)"/i);
  if (dataCopyMatch && dataCopyMatch[1]) {
    return decodeHtmlEntities(dataCopyMatch[1].trim());
  }
  const inputValMatch = String(cellHtml).match(/<input[^>]*value="([^"]+)"/i);
  if (inputValMatch && inputValMatch[1]) {
    return decodeHtmlEntities(inputValMatch[1].trim());
  }
  const hrefMatch = String(cellHtml).match(/<a[^>]*href="([^"]+)"/i);
  if (hrefMatch && hrefMatch[1]) {
    return decodeHtmlEntities(hrefMatch[1].trim());
  }
  return '';
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
    expiresAt: now + 35 * 60 * 1000,
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

  const html = await res.text();
  if (html.includes('id="loginform"') && !html.includes('tkw-modern') && !html.includes('tkw-stats')) {
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

function parseTop10PanelBlock(panelHtml) {
  const h3Match = panelHtml.match(/<h3>([\s\S]*?)<\/h3>/);
  const subMatch = panelHtml.match(/<span class="tkw-section-subtitle">([\s\S]*?)<\/span>/);
  const mutedMatch = panelHtml.match(/<p class="tkw-muted">([\s\S]*?)<\/p>/);

  const heading = h3Match ? stripTags(h3Match[1]) : 'Top 10 bài viết / trang';
  const subtitle = subMatch ? stripTags(subMatch[1]) : 'Xếp theo lượt xem';
  const mutedText = mutedMatch ? stripTags(mutedMatch[1]) : '';

  const rows = [];
  const tbodyMatch = panelHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  if (tbodyMatch) {
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let trMatch;
    while ((trMatch = trRegex.exec(tbodyMatch[1])) !== null) {
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
      const rawCells = [];
      let tdMatch;
      while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
        rawCells.push(tdMatch[1]);
      }

      if (rawCells.length >= 3) {
        const title = stripTags(rawCells[0]);
        const url = extractUrlFromCell(rawCells[1]) || extractUrlFromCell(rawCells[0]);
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

function parseTkwStatsHtml(html) {
  let realtime = {
    online: 0,
    today_views: 0,
    today_visitors: 0,
    minutes: [],
    pages: [],
    updated: '',
    code: '',
    scope: 'site',
  };

  const tkwDashMatch = html.match(/window\.TKWDash\s*=\s*(\{[\s\S]*?\});/);
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
            ? parsed.initial.pages.map((p) => ({
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
    } catch {}
  }

  const employeeOptions = [];
  const selectMatch = html.match(/<select[^>]*name="employee"[^>]*>([\s\S]*?)<\/select>/);
  if (selectMatch) {
    const optRegex = /<option\s+value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/g;
    let m;
    while ((m = optRegex.exec(selectMatch[1])) !== null) {
      const code = stripTags(m[1]);
      const label = stripTags(m[2]);
      if (code) employeeOptions.push({ code, label });
    }
  }
  const finalEmployeeOptions =
    employeeOptions.length > 0 ? employeeOptions : FALLBACK_EMPLOYEE_OPTIONS;

  const fromMatch = html.match(/<input[^>]*name="from"[^>]*value="([^"]*)"/);
  const toMatch = html.match(/<input[^>]*name="to"[^>]*value="([^"]*)"/);
  const topFromMatch = html.match(/<input[^>]*name="top_from"[^>]*value="([^"]*)"/);
  const topToMatch = html.match(/<input[^>]*name="top_to"[^>]*value="([^"]*)"/);
  const tzMatch = html.match(/Múi giờ\s+([^\.\s<]+)/);

  const summary = { views: 0, visitors: 0, newcomers: 0, returning: 0 };
  const cardRegex =
    /<div class="tkw-summary-card">[\s\S]*?<span class="tkw-summary-label">([\s\S]*?)<\/span>\s*<strong>([\s\S]*?)<\/strong>\s*<\/div>/g;
  let cardMatch;
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
      let m;
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

  let primaryTopPanel = {
    heading: 'Top 10 bài viết / trang',
    subtitle: 'Xếp theo lượt xem',
    mutedText: '',
    rows: [],
  };
  let secondaryTopPanel = null;

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

  const daily = [];
  const dailySectionMatch = html.match(
    /<div class="tkw-whitepanel[^"]*tkw-daily[^"]*">[\s\S]*?<h3>Theo ngày<\/h3>[\s\S]*?<tbody[^>]*>([\s\S]*?)<\/tbody>\s*<\/table>/
  );
  if (dailySectionMatch) {
    const rowRegex = /<tr>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g;
    let m;
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

function parseTkwEmployeesHtml(html, selectedEmployee, staffTopPeriod = '7') {
  const rows = [];
  const rankTableMatch = html.match(
    /<h2>Bảng xếp hạng nhân viên<\/h2>[\s\S]*?<table[^>]*><thead>[\s\S]*?<\/thead><tbody>([\s\S]*?)<\/tbody><\/table>/
  );
  if (rankTableMatch) {
    const trRegex = /<tr>([\s\S]*?)<\/tr>/g;
    let trMatch;
    while ((trMatch = trRegex.exec(rankTableMatch[1])) !== null) {
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
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
  const detailHeaderMatch = html.match(/<h2>Chi tiết:\s*([^<]+)<\/h2>([\s\S]*)/);
  if (detailHeaderMatch) {
    const code = stripTags(detailHeaderMatch[1]);
    const detailHtml = detailHeaderMatch[2];
    const empDaily = [];
    const dailyBoxMatch = detailHtml.match(/<h3>Theo ngày<\/h3><table[^>]*>([\s\S]*?)<\/table>/);
    if (dailyBoxMatch) {
      const trRegex = /<tr><td>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><\/tr>/g;
      let m;
      while ((m = trRegex.exec(dailyBoxMatch[1])) !== null) {
        empDaily.push({
          day: stripTags(m[1]),
          views: parseNumber(stripTags(m[2])),
          visitors: parseNumber(stripTags(m[3])),
        });
      }
    }
    const parseTwoColBox = (heading) => {
      const list = [];
      const regex = new RegExp(`<h3>${heading}<\\/h3><table[^>]*>([\\s\\S]*?)<\\/table>`);
      const match = detailHtml.match(regex);
      if (match) {
        const trRegex = /<tr><td>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><\/tr>/g;
        let m;
        while ((m = trRegex.exec(match[1])) !== null) {
          const name = stripTags(m[1]);
          const count = parseNumber(stripTags(m[2]));
          if (name && !name.toLowerCase().includes('chưa có dữ liệu')) list.push({ name, count });
        }
      }
      return list;
    };

    const topPosts = [];
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
        let trMatch;
        while ((trMatch = trRegex.exec(tbodyMatch[1])) !== null) {
          const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
          const rawCells = [];
          let tdMatch;
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
      const topBoxMatch = detailHtml.match(/<h3>Top bài viết\/trang<\/h3><table[^>]*>([\s\S]*?)<\/table>/);
      if (topBoxMatch) {
        const trRegex = /<tr><td>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><\/tr>/g;
        let m;
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
      daily: empDaily,
      sources: parseTwoColBox('Nguồn truy cập'),
      devices: parseTwoColBox('Thiết bị'),
      countries: parseTwoColBox('Quốc gia'),
      regions: parseTwoColBox('Tỉnh/thành'),
      topPosts,
      staffTopHeading,
      staffTopDescription,
      staffTopPeriod,
    };
  }

  return { rows, detail };
}

export default async function handler(req, res) {
  try {
    const q = req.query || {};
    const mode = String(q.mode || 'dashboard');
    const baseUrl = `${DEFAULT_WP_SITE.replace(/\/$/, '')}/wp-admin/admin.php`;

    if (mode === 'live') {
      const liveEmployee = String(q.live_employee || '');
      const scope = String(q.scope || (liveEmployee ? 'employee' : 'site'));
      const html = await fetchWpAdminHtml(
        `${baseUrl}?page=tkw-stats&scope=${encodeURIComponent(scope)}&employee=${encodeURIComponent(
          liveEmployee
        )}&live_employee=${encodeURIComponent(liveEmployee)}`
      );
      const parsed = parseTkwStatsHtml(html);
      return res.status(200).json({ ok: true, realtime: parsed.realtime });
    }

    const range = String(q.range || '7');
    const rawScope =
      q.scope === 'mine' || q.scope === 'employee' || q.scope === 'site'
        ? q.scope
        : q.employee
        ? 'employee'
        : 'site';
    const viewerCode = String(q.viewer_employee || '').trim();
    const employee =
      rawScope === 'mine'
        ? viewerCode || String(q.employee || '') || 'M2001'
        : rawScope === 'employee'
        ? String(q.employee || viewerCode || '').trim()
        : '';

    const effectiveWpScope =
      rawScope === 'mine' || (rawScope === 'employee' && employee) ? 'employee' : 'site';

    const liveEmployee =
      q.live_employee !== undefined && q.live_employee !== ''
        ? String(q.live_employee)
        : effectiveWpScope === 'employee'
        ? employee
        : '';

    const topRange = String(q.top_range || '7');
    const empDays = Number(q.emp_days) === 30 ? 30 : 7;
    const empDetailCode = String(
      q.emp_detail || employee || (viewerCode && viewerCode !== 'A0006' ? viewerCode : 'M2001')
    );
    const staffTopPeriod = String(q.staff_top_period || '7');

    const statsQuery = new URLSearchParams({
      page: 'tkw-stats',
      range,
      scope: effectiveWpScope,
    });
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

    const empQuery = new URLSearchParams({
      page: 'tkw-employees',
      days: String(empDays),
      staff_top_period: staffTopPeriod,
    });
    if (empDetailCode && empDetailCode !== '(Không mã)') {
      empQuery.set('employee', empDetailCode);
    }

    const secondaryComparisonCode =
      effectiveWpScope === 'site'
        ? viewerCode && viewerCode !== 'A0006'
          ? viewerCode
          : employee || (empDetailCode && empDetailCode !== 'A0006' ? empDetailCode : 'M2001')
        : '';

    const viewerStatsQuery = new URLSearchParams(statsQuery);
    if (secondaryComparisonCode) {
      viewerStatsQuery.set('scope', 'employee');
      viewerStatsQuery.set('employee', secondaryComparisonCode);
    }

    const [statsHtml, empHtml, viewerStatsHtml] = await Promise.all([
      fetchWpAdminHtml(`${baseUrl}?${statsQuery.toString()}`),
      fetchWpAdminHtml(`${baseUrl}?${empQuery.toString()}`),
      secondaryComparisonCode
        ? fetchWpAdminHtml(`${baseUrl}?${viewerStatsQuery.toString()}`)
        : Promise.resolve(''),
    ]);

    const parsedStats = parseTkwStatsHtml(statsHtml);
    const parsedEmp = parseTkwEmployeesHtml(empHtml, empDetailCode, staffTopPeriod);

    let primaryTopPanel = parsedStats.primaryTopPanel;
    let secondaryTopPanel = parsedStats.secondaryTopPanel;

    if (secondaryComparisonCode && viewerStatsHtml) {
      const parsedViewer = parseTkwStatsHtml(viewerStatsHtml);
      secondaryTopPanel = {
        heading: `Top 10 bài viết / trang của nhân viên mã ${secondaryComparisonCode}`,
        subtitle: `Cùng kỳ · ${parsedStats.topFrom || parsedStats.from} – ${
          parsedStats.topTo || parsedStats.to
        }`,
        mutedText: `Chỉ các lượt truy cập gắn với mã ${secondaryComparisonCode}`,
        rows: parsedViewer.primaryTopPanel.rows,
      };
    }

    const siteTopPanel =
      effectiveWpScope === 'site'
        ? primaryTopPanel
        : secondaryTopPanel || {
            heading: 'Top 10 bài viết / trang toàn website',
            subtitle: 'Xếp theo lượt xem',
            mutedText: 'Tất cả lượt truy cập ở domain gốc và các subdomain',
            rows: [],
          };

    const employeeTopPanel =
      effectiveWpScope === 'employee' ? primaryTopPanel : secondaryTopPanel;

    return res.status(200).json({
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
      topPosts: primaryTopPanel.rows,
      primaryTopPanel,
      secondaryTopPanel,
      siteTopPanel,
      employeeTopPanel,
      daily: parsedStats.daily,
      employeeRanking: {
        days: empDays,
        selectedEmployee: empDetailCode,
        staffTopPeriod,
        rows: parsedEmp.rows,
        detail: parsedEmp.detail,
      },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Lỗi kết nối WordPress celeb24h.com',
    });
  }
}
