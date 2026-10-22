import {
  MgidDailyStatItem,
  MgidWidgetStatItem,
  MgidCountryStatItem,
  MgidDeviceStatItem,
} from '../types';

export interface MgidFetchParams {
  apiToken?: string;
  clientId?: string;
  email?: string;
  password?: string;
  domain?: string;
  dateInterval?: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'custom';
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  usdToVndRate?: number;
}

export interface MgidDashboardResponse {
  ok: boolean;
  apiConfigured: boolean;
  apiConnected: boolean;
  tokenMasked?: string;
  clientId?: string;
  domain: string;
  usdToVndRate: number;
  dateFrom: string;
  dateTo: string;
  dateInterval: string;
  fetchedAt: string;
  message?: string;
  apiError?: string;
  summary: {
    revenueUsd: number;
    revenueVnd: number;
    pageViews: number;
    impressions: number;
    visibilityRate: number;
    clicks: number;
    ctr: number;
    cpc: number;
    ecpm: number;
    rpm: number;
    forecastMonthUsd: number;
    forecastMonthVnd: number;
  };
  dailyStats: MgidDailyStatItem[];
  widgetStats: MgidWidgetStatItem[];
  countryStats: MgidCountryStatItem[];
  deviceStats: MgidDeviceStatItem[];
}

interface CachedMgidAuth {
  token: string;
  clientId: string;
  expiresAt: number;
}

let cachedMgidAuth: CachedMgidAuth | null = null;

function maskToken(token?: string): string {
  if (!token || token.length < 8) return token ? '****' : '';
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

function safeNum(val: any): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function resolveDateRange(
  interval: string = 'thisMonth',
  customFrom?: string,
  customTo?: string
): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const fmt = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  if (interval === 'custom' && customFrom && customTo) {
    return { dateFrom: customFrom, dateTo: customTo };
  }

  if (interval === 'today') {
    const t = fmt(now);
    return { dateFrom: t, dateTo: t };
  }

  if (interval === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const ys = fmt(y);
    return { dateFrom: ys, dateTo: ys };
  }

  if (interval === 'last7days') {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return { dateFrom: fmt(from), dateTo: fmt(now) };
  }

  if (interval === 'last30days') {
    const from = new Date(now);
    from.setDate(from.getDate() - 29);
    return { dateFrom: fmt(from), dateTo: fmt(now) };
  }

  if (interval === 'lastMonth') {
    const firstLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    return { dateFrom: fmt(firstLastMonth), dateTo: fmt(lastLastMonth) };
  }

  // Default: thisMonth
  const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return { dateFrom: fmt(firstThisMonth), dateTo: fmt(now) };
}

async function authenticateMgidCredentials(params: {
  apiToken?: string;
  clientId?: string;
  email?: string;
  password?: string;
}): Promise<{ token: string; clientId: string }> {
  const envToken = (process.env.MGID_API_TOKEN || '').trim();
  const envClientId = (process.env.MGID_CLIENT_ID || '').trim();
  const envEmail = (process.env.MGID_EMAIL || '').trim();
  const envPassword = (process.env.MGID_PASSWORD || '').trim();

  const token = (params.apiToken || envToken).trim();
  const clientId = (params.clientId || envClientId).trim();
  const email = (params.email || envEmail).trim();
  const password = (params.password || envPassword).trim();

  if (token) {
    return { token, clientId };
  }

  if (email && password) {
    const now = Date.now();
    if (cachedMgidAuth && cachedMgidAuth.expiresAt > now) {
      return {
        token: cachedMgidAuth.token,
        clientId: clientId || cachedMgidAuth.clientId,
      };
    }

    const body = new URLSearchParams({
      email,
      password,
    });

    const res = await fetch('https://api.mgid.com/v1/auth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    const data: any = await res.json().catch(() => null);
    if (!res.ok || !data || (!data.token && !data.access_token)) {
      throw new Error(
        data?.message ||
          data?.error ||
          `Không thể xác thực MGID API (HTTP ${res.status}). Vui lòng kiểm tra lại API Token hoặc Email/Password MGID.`
      );
    }

    const resolvedToken = String(data.token || data.access_token || '');
    const resolvedClientId = String(clientId || data.idAuth || data.client_id || data.clientId || '');

    cachedMgidAuth = {
      token: resolvedToken,
      clientId: resolvedClientId,
      expiresAt: now + 45 * 60 * 1000,
    };

    return { token: resolvedToken, clientId: resolvedClientId };
  }

  return { token: '', clientId: '' };
}

function normalizeMgidApiData(
  rawStats: any,
  rawSites: any,
  domain: string,
  usdToVndRate: number,
  dateFrom: string,
  dateTo: string
): {
  dailyStats: MgidDailyStatItem[];
  widgetStats: MgidWidgetStatItem[];
  countryStats: MgidCountryStatItem[];
  deviceStats: MgidDeviceStatItem[];
} {
  const dailyMap = new Map<string, MgidDailyStatItem>();
  const widgetMap = new Map<string, MgidWidgetStatItem>();
  const countryMap = new Map<string, MgidCountryStatItem>();

  const rows: any[] = [];
  if (Array.isArray(rawStats)) {
    rows.push(...rawStats);
  } else if (rawStats && typeof rawStats === 'object') {
    const inner = rawStats.data || rawStats.statistics || rawStats.stats || rawStats.items || rawStats;
    if (Array.isArray(inner)) {
      rows.push(...inner);
    } else if (inner && typeof inner === 'object') {
      for (const [k, v] of Object.entries(inner)) {
        if (Array.isArray(v)) {
          v.forEach((item) => rows.push({ _key: k, ...item }));
        } else if (v && typeof v === 'object') {
          rows.push({ _key: k, ...(v as any) });
        }
      }
    }
  }

  rows.forEach((r, idx) => {
    const dateCandidate = String(
      r.date || r.day || r.statDate || ( /^\d{4}-\d{2}-\d{2}$/.test(String(r._key || '')) ? r._key : '' ) || dateTo
    ).slice(0, 10);

    const impressions = safeNum(
      r.impressions ?? r.shows ?? r.adViews ?? r.views ?? r.widgetShows ?? r.loads ?? 0
    );
    const pageViews = safeNum(r.pageViews ?? r.page_views ?? r.requests ?? Math.round(impressions * 1.15));
    const clicks = safeNum(r.clicks ?? r.wages_clicks ?? r.adClicks ?? 0);
    const revenueUsd = safeNum(r.revenue ?? r.wages ?? r.earned ?? r.income ?? r.profit ?? r.sum ?? 0);
    const visibilityRate = safeNum(r.visibility ?? r.visibilityRate ?? r.viewability ?? 78.5);
    const ctr =
      impressions > 0
        ? Math.round((clicks / impressions) * 10000) / 100
        : safeNum(r.ctr ?? 0);
    const cpc =
      clicks > 0
        ? Math.round((revenueUsd / clicks) * 10000) / 10000
        : safeNum(r.cpc ?? 0);
    const ecpm =
      impressions > 0
        ? Math.round((revenueUsd / impressions) * 1000 * 100) / 100
        : safeNum(r.ecpm ?? r.cpm ?? r.rpm ?? 0);
    const rpm =
      pageViews > 0
        ? Math.round((revenueUsd / pageViews) * 1000 * 100) / 100
        : ecpm;

    if (dateCandidate) {
      const existing = dailyMap.get(dateCandidate);
      if (existing) {
        const nextImp = existing.impressions + impressions;
        const nextPv = existing.pageViews + pageViews;
        const nextClk = existing.clicks + clicks;
        const nextRev = Math.round((existing.revenueUsd + revenueUsd) * 1000) / 1000;
        dailyMap.set(dateCandidate, {
          ...existing,
          pageViews: nextPv,
          impressions: nextImp,
          clicks: nextClk,
          revenueUsd: nextRev,
          revenueVnd: Math.round(nextRev * usdToVndRate),
          ctr: nextImp > 0 ? Math.round((nextClk / nextImp) * 10000) / 100 : existing.ctr,
          cpc: nextClk > 0 ? Math.round((nextRev / nextClk) * 10000) / 10000 : existing.cpc,
          ecpm: nextImp > 0 ? Math.round((nextRev / nextImp) * 1000 * 100) / 100 : existing.ecpm,
          rpm: nextPv > 0 ? Math.round((nextRev / nextPv) * 1000 * 100) / 100 : existing.rpm,
        });
      } else {
        dailyMap.set(dateCandidate, {
          id: `mgid-day-${dateCandidate}-${idx}`,
          date: dateCandidate,
          domain: String(r.domain || r.site || domain),
          pageViews,
          impressions,
          visibilityRate,
          clicks,
          ctr,
          cpc,
          ecpm,
          rpm,
          revenueUsd: Math.round(revenueUsd * 1000) / 1000,
          revenueVnd: Math.round(revenueUsd * usdToVndRate),
        });
      }
    }

    const widgetId = String(r.widgetId || r.widget_id || r.compositeId || r.id || '');
    const widgetName = String(r.widgetName || r.widget_name || r.title || r.name || '');
    if (widgetId || widgetName) {
      const wKey = widgetId || widgetName;
      const prevW = widgetMap.get(wKey);
      const nextImp = (prevW?.impressions || 0) + impressions;
      const nextClk = (prevW?.clicks || 0) + clicks;
      const nextRev = Math.round(((prevW?.revenueUsd || 0) + revenueUsd) * 1000) / 1000;
      widgetMap.set(wKey, {
        id: `mgid-widget-${wKey}`,
        widgetId: widgetId || `W-${idx + 1}`,
        widgetName: widgetName || `${domain} - Smart Widget #${idx + 1}`,
        domain: String(r.domain || r.site || domain),
        placement: 'smart_widget',
        status: 'active',
        impressions: nextImp,
        visibilityRate,
        clicks: nextClk,
        ctr: nextImp > 0 ? Math.round((nextClk / nextImp) * 10000) / 100 : ctr,
        cpc: nextClk > 0 ? Math.round((nextRev / nextClk) * 10000) / 10000 : cpc,
        ecpm: nextImp > 0 ? Math.round((nextRev / nextImp) * 1000 * 100) / 100 : ecpm,
        revenueUsd: nextRev,
      });
    }
  });

  if (rawSites && typeof rawSites === 'object' && widgetMap.size === 0) {
    const siteList = Array.isArray(rawSites) ? rawSites : Object.values(rawSites);
    siteList.forEach((s: any, idx: number) => {
      if (!s || typeof s !== 'object') return;
      const siteDomain = String(s.domain || s.url || s.name || domain);
      const widgets = Array.isArray(s.widgets)
        ? s.widgets
        : s.widgets && typeof s.widgets === 'object'
        ? Object.values(s.widgets)
        : [];
      widgets.forEach((w: any, wIdx: number) => {
        const wId = String(w.id || w.widgetId || `${idx + 1}-${wIdx + 1}`);
        widgetMap.set(wId, {
          id: `mgid-w-${wId}`,
          widgetId: wId,
          widgetName: String(w.name || w.title || `${siteDomain} - Widget #${wId}`),
          domain: siteDomain,
          placement: 'under_article',
          status: 'active',
          impressions: safeNum(w.impressions ?? w.shows ?? 0),
          visibilityRate: safeNum(w.visibility ?? 80),
          clicks: safeNum(w.clicks ?? 0),
          ctr: safeNum(w.ctr ?? 0),
          cpc: safeNum(w.cpc ?? 0),
          ecpm: safeNum(w.ecpm ?? w.cpm ?? 0),
          revenueUsd: safeNum(w.revenue ?? w.wages ?? 0),
        });
      });
    });
  }

  const dailyStats = Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  const widgetStats = Array.from(widgetMap.values()).sort((a, b) => b.revenueUsd - a.revenueUsd);
  const countryStats = Array.from(countryMap.values());
  const deviceStats: MgidDeviceStatItem[] = [];

  return {
    dailyStats,
    widgetStats,
    countryStats,
    deviceStats,
  };
}

export function buildMgidSummary(
  dailyStats: MgidDailyStatItem[],
  usdToVndRate: number
): MgidDashboardResponse['summary'] {
  let revenueUsd = 0;
  let pageViews = 0;
  let impressions = 0;
  let clicks = 0;
  let visibilitySum = 0;

  dailyStats.forEach((d) => {
    revenueUsd += safeNum(d.revenueUsd);
    pageViews += safeNum(d.pageViews);
    impressions += safeNum(d.impressions);
    clicks += safeNum(d.clicks);
    visibilitySum += safeNum(d.visibilityRate || 78);
  });

  revenueUsd = Math.round(revenueUsd * 100) / 100;
  const revenueVnd = Math.round(revenueUsd * usdToVndRate);
  const visibilityRate =
    dailyStats.length > 0 ? Math.round((visibilitySum / dailyStats.length) * 10) / 10 : 0;
  const ctr = impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0;
  const cpc = clicks > 0 ? Math.round((revenueUsd / clicks) * 10000) / 10000 : 0;
  const ecpm = impressions > 0 ? Math.round((revenueUsd / impressions) * 1000 * 100) / 100 : 0;
  const rpm = pageViews > 0 ? Math.round((revenueUsd / pageViews) * 1000 * 100) / 100 : ecpm;

  const activeDays = Math.max(1, dailyStats.length);
  const avgDailyUsd = revenueUsd / activeDays;
  const forecastMonthUsd = Math.round(avgDailyUsd * 30 * 100) / 100;
  const forecastMonthVnd = Math.round(forecastMonthUsd * usdToVndRate);

  return {
    revenueUsd,
    revenueVnd,
    pageViews,
    impressions,
    visibilityRate,
    clicks,
    ctr,
    cpc,
    ecpm,
    rpm,
    forecastMonthUsd,
    forecastMonthVnd,
  };
}

export async function fetchMgidPublisherDashboard(
  params: MgidFetchParams = {}
): Promise<MgidDashboardResponse> {
  const domain = (params.domain || process.env.MGID_SITE_DOMAIN || 'celeb24h.com').trim();
  const usdToVndRate =
    Number(params.usdToVndRate) || Number(process.env.MGID_USD_VND_RATE) || 25500;
  const dateInterval = params.dateInterval || 'thisMonth';
  const { dateFrom, dateTo } = resolveDateRange(dateInterval, params.dateFrom, params.dateTo);

  let token = '';
  let clientId = '';
  let apiError = '';

  try {
    const authRes = await authenticateMgidCredentials(params);
    token = authRes.token;
    clientId = authRes.clientId;
  } catch (err: any) {
    apiError = err?.message || 'Lỗi xác thực MGID API';
  }

  const apiConfigured = Boolean(token);

  if (!apiConfigured) {
    return {
      ok: true,
      apiConfigured: false,
      apiConnected: false,
      domain,
      usdToVndRate,
      dateFrom,
      dateTo,
      dateInterval,
      fetchedAt: new Date().toLocaleString('vi-VN'),
      apiError: apiError || undefined,
      message:
        'Chưa cấu hình MGID API Token. Admin có thể dán trực tiếp API Token từ pub.mgid.com/dashboard hoặc nhập báo cáo CSV/trực tiếp.',
      summary: buildMgidSummary([], usdToVndRate),
      dailyStats: [],
      widgetStats: [],
      countryStats: [],
      deviceStats: [],
    };
  }

  // Attempt live MGID Publisher API endpoints
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };

  let rawStats: any = null;
  let rawSites: any = null;
  let connected = false;

  const candidateUrls: string[] = [];
  if (clientId) {
    candidateUrls.push(
      `https://api.mgid.com/v1/publishers/${encodeURIComponent(clientId)}/widget-statistics?dateInterval=custom&dateFrom=${dateFrom}&dateTo=${dateTo}&token=${encodeURIComponent(token)}`,
      `https://api.mgid.com/v1/publishers/${encodeURIComponent(clientId)}/statistics?dateFrom=${dateFrom}&dateTo=${dateTo}&token=${encodeURIComponent(token)}`
    );
  }
  candidateUrls.push(
    `https://api.mgid.com/v1/publishers/widget-statistics?dateFrom=${dateFrom}&dateTo=${dateTo}&token=${encodeURIComponent(token)}`,
    `https://api.mgid.com/v1/publishers/statistics?dateFrom=${dateFrom}&dateTo=${dateTo}&token=${encodeURIComponent(token)}`
  );

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, { method: 'GET', headers });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json && !json.error && !json.errors) {
          rawStats = json;
          connected = true;
          break;
        }
      } else {
        const errBody: any = await res.json().catch(() => null);
        if (errBody?.message || errBody?.error) {
          apiError = String(errBody.message || errBody.error);
        }
      }
    } catch (e: any) {
      apiError = e?.message || 'Không thể kết nối tới api.mgid.com';
    }
  }

  if (clientId) {
    try {
      const sitesRes = await fetch(
        `https://api.mgid.com/v1/publishers/${encodeURIComponent(clientId)}/sites?token=${encodeURIComponent(token)}`,
        { method: 'GET', headers }
      );
      if (sitesRes.ok) {
        rawSites = await sitesRes.json().catch(() => null);
        connected = true;
      }
    } catch {
      // ignore optional sites fetch error
    }
  }

  const normalized = normalizeMgidApiData(
    rawStats,
    rawSites,
    domain,
    usdToVndRate,
    dateFrom,
    dateTo
  );

  const summary = buildMgidSummary(normalized.dailyStats, usdToVndRate);

  return {
    ok: true,
    apiConfigured: true,
    apiConnected: connected,
    tokenMasked: maskToken(token),
    clientId: clientId || undefined,
    domain,
    usdToVndRate,
    dateFrom,
    dateTo,
    dateInterval,
    fetchedAt: new Date().toLocaleString('vi-VN'),
    apiError: !connected ? apiError || 'Token MGID chưa trả về dữ liệu hoặc cần Client ID.' : undefined,
    summary,
    dailyStats: normalized.dailyStats,
    widgetStats: normalized.widgetStats,
    countryStats: normalized.countryStats,
    deviceStats: normalized.deviceStats,
  };
}
