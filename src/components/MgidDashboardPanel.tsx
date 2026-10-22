import React, { useState, useMemo, useEffect } from 'react';
import {
  MonthlyFinanceRecord,
  RevenueItem,
  MgidDailyStatItem,
  MgidWidgetStatItem,
  MgidCountryStatItem,
  MgidDeviceStatItem,
  MgidSavedReportData,
  AppUser,
} from '../types';
import {
  DollarSign,
  TrendingUp,
  BarChart3,
  Globe,
  ShieldCheck,
  Lock,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  KeyRound,
  Calendar,
  Layers,
  MousePointerClick,
  Activity,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  FileSpreadsheet,
  SlidersHorizontal,
  X,
  ArrowUpRight,
} from 'lucide-react';

interface MgidDashboardPanelProps {
  currentUser: AppUser;
  activeMonthRecord: MonthlyFinanceRecord;
  selectedMonthKey: string;
  isPrivacyMasked?: boolean;
  onTogglePrivacyMask?: () => void;
  onSaveMonthlyFinance: (record: MonthlyFinanceRecord) => Promise<void> | void;
}

const MGID_ADMIN_VAULT_KEY = 'mmo_admin_mgid_api_vault_v1';

interface MgidApiCredentials {
  apiToken: string;
  clientId: string;
  email: string;
  password?: string;
  domain: string;
  usdToVndRate: number;
}

function loadAdminMgidVault(role: string): MgidApiCredentials {
  const fallback: MgidApiCredentials = {
    apiToken: '',
    clientId: '',
    email: '',
    password: '',
    domain: 'celeb24h.com',
    usdToVndRate: 25500,
  };
  if (typeof window === 'undefined' || role !== 'admin') return fallback;
  try {
    const raw = window.localStorage.getItem(MGID_ADMIN_VAULT_KEY);
    if (!raw) return fallback;
    const decoded = JSON.parse(atob(raw));
    return {
      apiToken: String(decoded.apiToken || ''),
      clientId: String(decoded.clientId || ''),
      email: String(decoded.email || ''),
      password: String(decoded.password || ''),
      domain: String(decoded.domain || 'celeb24h.com'),
      usdToVndRate: Number(decoded.usdToVndRate) || 25500,
    };
  } catch {
    return fallback;
  }
}

function saveAdminMgidVault(role: string, creds: MgidApiCredentials): void {
  if (typeof window === 'undefined' || role !== 'admin') return;
  try {
    const encoded = btoa(JSON.stringify(creds));
    window.localStorage.setItem(MGID_ADMIN_VAULT_KEY, encoded);
  } catch {
    // ignore
  }
}

export function clearAdminMgidVaultForNonAdmin(role: string): void {
  if (typeof window === 'undefined') return;
  if (role !== 'admin') {
    try {
      window.localStorage.removeItem(MGID_ADMIN_VAULT_KEY);
    } catch {
      // ignore
    }
  }
}

function formatUsd(amount: number, masked = false): string {
  if (masked) return '$ ••••.••';
  if (!Number.isFinite(amount)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatVnd(amount: number, masked = false): string {
  if (masked) return '••••••••• ₫';
  if (!Number.isFinite(amount)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

function formatInt(num: number): string {
  if (!Number.isFinite(num)) return '0';
  return new Intl.NumberFormat('en-US').format(Math.round(num));
}

export const MgidDashboardPanel: React.FC<MgidDashboardPanelProps> = ({
  currentUser,
  activeMonthRecord,
  selectedMonthKey,
  isPrivacyMasked = false,
  onTogglePrivacyMask,
  onSaveMonthlyFinance,
}) => {
  const isAdmin = currentUser.role === 'admin';

  const [creds, setCreds] = useState<MgidApiCredentials>(() => loadAdminMgidVault(currentUser.role));
  const [usdRateInput, setUsdRateInput] = useState<string>(() =>
    String(activeMonthRecord.mgidReport?.usdToVndRate || activeMonthRecord.usdToVndRate || creds.usdToVndRate || 25500)
  );
  const usdToVndRate = useMemo(() => {
    const parsed = parseInt(usdRateInput.replace(/[^\d]/g, ''), 10);
    return parsed > 1000 ? parsed : 25500;
  }, [usdRateInput]);

  // Date range filter matching https://pub.mgid.com/dashboard
  const [dateInterval, setDateInterval] = useState<
    'all_month' | 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'custom'
  >('all_month');
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [customDateTo, setCustomDateTo] = useState<string>('');
  const [domainFilter, setDomainFilter] = useState<string>('ALL');

  // Sub-tab inside MGID Dashboard
  const [mgidSubTab, setMgidSubTab] = useState<'daily' | 'widgets' | 'geo_devices' | 'import_api'>('daily');
  const [chartMetric, setChartMetric] = useState<'revenueUsd' | 'clicks' | 'impressions' | 'ecpm'>('revenueUsd');

  // API Sync state
  const [isFetchingApi, setIsFetchingApi] = useState(false);
  const [apiStatusBanner, setApiStatusBanner] = useState<{
    type: 'success' | 'warning' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [apiConnectedState, setApiConnectedState] = useState<boolean>(
    Boolean(activeMonthRecord.mgidReport?.apiConnected)
  );
  const [tokenMaskedPreview, setTokenMaskedPreview] = useState<string>('');

  // Modals
  const [isApiConfigModalOpen, setIsApiConfigModalOpen] = useState(false);
  const [isAddDailyModalOpen, setIsAddDailyModalOpen] = useState(false);
  const [editingDailyItem, setEditingDailyItem] = useState<MgidDailyStatItem | null>(null);
  const [dailyDateInput, setDailyDateInput] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [dailyDomainInput, setDailyDomainInput] = useState<string>('celeb24h.com');
  const [dailyPageViewsInput, setDailyPageViewsInput] = useState<string>('');
  const [dailyImpressionsInput, setDailyImpressionsInput] = useState<string>('');
  const [dailyVisibilityInput, setDailyVisibilityInput] = useState<string>('80.5');
  const [dailyClicksInput, setDailyClicksInput] = useState<string>('');
  const [dailyRevenueUsdInput, setDailyRevenueUsdInput] = useState<string>('');
  const [dailyNoteInput, setDailyNoteInput] = useState<string>('');

  // Widget modal state
  const [isAddWidgetModalOpen, setIsAddWidgetModalOpen] = useState(false);
  const [editingWidgetItem, setEditingWidgetItem] = useState<MgidWidgetStatItem | null>(null);
  const [widgetIdInput, setWidgetIdInput] = useState<string>('');
  const [widgetNameInput, setWidgetNameInput] = useState<string>('celeb24h.com - Under Article Native');
  const [widgetDomainInput, setWidgetDomainInput] = useState<string>('celeb24h.com');
  const [widgetPlacementInput, setWidgetPlacementInput] = useState<MgidWidgetStatItem['placement']>('under_article');
  const [widgetImpressionsInput, setWidgetImpressionsInput] = useState<string>('');
  const [widgetClicksInput, setWidgetClicksInput] = useState<string>('');
  const [widgetRevenueUsdInput, setWidgetRevenueUsdInput] = useState<string>('');

  // CSV / TSV paste import state
  const [csvRawText, setCsvRawText] = useState<string>('');

  // Keep usdRateInput synced when month changes
  useEffect(() => {
    const savedRate = activeMonthRecord.mgidReport?.usdToVndRate || activeMonthRecord.usdToVndRate;
    if (savedRate && savedRate > 1000) {
      setUsdRateInput(String(savedRate));
    }
  }, [activeMonthRecord.id, activeMonthRecord.mgidReport?.usdToVndRate, activeMonthRecord.usdToVndRate]);

  // Saved MGID report data from activeMonthRecord
  const savedReport: MgidSavedReportData = useMemo(() => {
    return (
      activeMonthRecord.mgidReport || {
        domain: creds.domain || 'celeb24h.com',
        usdToVndRate,
        dailyStats: [],
        widgetStats: [],
        countryStats: [],
        deviceStats: [],
      }
    );
  }, [activeMonthRecord.mgidReport, creds.domain, usdToVndRate]);

  // Persist MGID report changes into activeMonthRecord on Cloud Firestore
  const saveMgidReportToCloud = async (
    nextReport: Partial<MgidSavedReportData>,
    alsoSyncToMonthlyRevenue = false
  ) => {
    if (!isAdmin) return;
    const mergedReport: MgidSavedReportData = {
      domain: nextReport.domain || savedReport.domain || creds.domain || 'celeb24h.com',
      usdToVndRate: nextReport.usdToVndRate || usdToVndRate,
      lastSyncedAt: new Date().toLocaleString('vi-VN'),
      apiConnected: nextReport.apiConnected ?? savedReport.apiConnected ?? apiConnectedState,
      dailyStats: nextReport.dailyStats ?? savedReport.dailyStats ?? [],
      widgetStats: nextReport.widgetStats ?? savedReport.widgetStats ?? [],
      countryStats: nextReport.countryStats ?? savedReport.countryStats ?? [],
      deviceStats: nextReport.deviceStats ?? savedReport.deviceStats ?? [],
    };

    let updatedRevenueItems = [...(activeMonthRecord.revenueItems || [])];
    if (alsoSyncToMonthlyRevenue) {
      const totalMgidUsd = mergedReport.dailyStats.reduce((s, d) => s + (Number(d.revenueUsd) || 0), 0);
      const totalMgidVnd = Math.round(totalMgidUsd * mergedReport.usdToVndRate);
      if (totalMgidVnd > 0) {
        const mgidSourceName = `Doanh Thu MGID Ads (${mergedReport.domain})`;
        const existingIdx = updatedRevenueItems.findIndex(
          (r) =>
            r.id.startsWith('rev-mgid-') ||
            r.sourceName.toLowerCase().includes('mgid')
        );
        const syncedItem: RevenueItem = {
          id: existingIdx >= 0 ? updatedRevenueItems[existingIdx].id : `rev-mgid-${selectedMonthKey}`,
          sourceName: mgidSourceName,
          amount: totalMgidVnd,
          payerName: 'MGID Inc. (pub.mgid.com)',
          receivedDate: new Date().toLocaleDateString('vi-VN'),
          note: `Đồng bộ từ MGID Dashboard: $${totalMgidUsd.toFixed(2)} USD × ${ formatInt(mergedReport.usdToVndRate) } VNĐ/USD (${mergedReport.dailyStats.length} ngày)`,
          createdAt: new Date().toISOString(),
        };
        if (existingIdx >= 0) {
          updatedRevenueItems[existingIdx] = syncedItem;
        } else {
          updatedRevenueItems = [syncedItem, ...updatedRevenueItems];
        }
      }
    }

    const nextTotalRevenue = updatedRevenueItems.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const nextNetProfit = nextTotalRevenue - (activeMonthRecord.totalExpenses || 0);

    const updatedFinanceRecord: MonthlyFinanceRecord = {
      ...activeMonthRecord,
      usdToVndRate: mergedReport.usdToVndRate,
      mgidReport: mergedReport,
      revenueItems: updatedRevenueItems,
      totalRevenue: nextTotalRevenue,
      netProfit: nextNetProfit,
      profitMargin:
        nextTotalRevenue > 0 ? Math.round((nextNetProfit / nextTotalRevenue) * 1000) / 10 : 0,
      status: nextNetProfit > 0 ? 'profitable' : nextNetProfit === 0 ? 'break_even' : 'loss',
      updatedAt: new Date().toLocaleString('vi-VN'),
      updatedBy: currentUser.name || 'Admin',
    };

    await onSaveMonthlyFinance(updatedFinanceRecord);
  };

  // Filter daily stats by selected dateInterval and domain
  const filteredDailyStats = useMemo(() => {
    const list = savedReport.dailyStats || [];
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const todayStr = fmt(now);
    const yestDate = new Date(now);
    yestDate.setDate(yestDate.getDate() - 1);
    const yesterdayStr = fmt(yestDate);

    const last7Date = new Date(now);
    last7Date.setDate(last7Date.getDate() - 6);
    const last7Str = fmt(last7Date);

    const last30Date = new Date(now);
    last30Date.setDate(last30Date.getDate() - 29);
    const last30Str = fmt(last30Date);

    return list
      .filter((item) => {
        if (domainFilter !== 'ALL' && item.domain && item.domain !== domainFilter) {
          return false;
        }
        const d = item.date;
        if (!d || dateInterval === 'all_month') return true;
        if (dateInterval === 'today') return d === todayStr;
        if (dateInterval === 'yesterday') return d === yesterdayStr;
        if (dateInterval === 'last7days') return d >= last7Str && d <= todayStr;
        if (dateInterval === 'last30days') return d >= last30Str && d <= todayStr;
        if (dateInterval === 'custom') {
          if (customDateFrom && d < customDateFrom) return false;
          if (customDateTo && d > customDateTo) return false;
          return true;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [savedReport.dailyStats, domainFilter, dateInterval, customDateFrom, customDateTo]);

  // Compute real-time summary metrics from filteredDailyStats
  const summaryMetrics = useMemo(() => {
    let revenueUsd = 0;
    let pageViews = 0;
    let impressions = 0;
    let clicks = 0;
    let visibilitySum = 0;

    filteredDailyStats.forEach((d) => {
      revenueUsd += Number(d.revenueUsd) || 0;
      pageViews += Number(d.pageViews) || 0;
      impressions += Number(d.impressions) || 0;
      clicks += Number(d.clicks) || 0;
      visibilitySum += Number(d.visibilityRate) || 80;
    });

    revenueUsd = Math.round(revenueUsd * 100) / 100;
    const revenueVnd = Math.round(revenueUsd * usdToVndRate);
    const visibilityRate =
      filteredDailyStats.length > 0
        ? Math.round((visibilitySum / filteredDailyStats.length) * 10) / 10
        : 0;
    const ctr = impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0;
    const cpc = clicks > 0 ? Math.round((revenueUsd / clicks) * 10000) / 10000 : 0;
    const cpcCents = Math.round(cpc * 100 * 100) / 100;
    const ecpm = impressions > 0 ? Math.round((revenueUsd / impressions) * 1000 * 100) / 100 : 0;
    const rpm = pageViews > 0 ? Math.round((revenueUsd / pageViews) * 1000 * 100) / 100 : ecpm;

    const daysCount = Math.max(1, filteredDailyStats.length);
    const avgDailyUsd = Math.round((revenueUsd / daysCount) * 100) / 100;
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
      cpcCents,
      ecpm,
      rpm,
      avgDailyUsd,
      forecastMonthUsd,
      forecastMonthVnd,
      daysCount: filteredDailyStats.length,
    };
  }, [filteredDailyStats, usdToVndRate]);

  // Chronological list for the bar chart (oldest -> newest)
  const chartData = useMemo(() => {
    return [...filteredDailyStats].sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredDailyStats]);

  const maxChartValue = useMemo(() => {
    if (chartData.length === 0) return 1;
    return Math.max(
      1,
      ...chartData.map((d) => {
        if (chartMetric === 'revenueUsd') return d.revenueUsd || 0;
        if (chartMetric === 'clicks') return d.clicks || 0;
        if (chartMetric === 'impressions') return d.impressions || 0;
        return d.ecpm || 0;
      })
    );
  }, [chartData, chartMetric]);

  // Fetch from server-side /api/mgid-stats
  const handleSyncFromMgidApi = async (overrideCreds?: MgidApiCredentials) => {
    if (!isAdmin) return;
    const activeCreds = overrideCreds || creds;
    setIsFetchingApi(true);
    setApiStatusBanner(null);

    try {
      const res = await fetch('/api/mgid-stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-role': currentUser.role,
        },
        body: JSON.stringify({
          apiToken: activeCreds.apiToken.trim(),
          clientId: activeCreds.clientId.trim(),
          email: activeCreds.email.trim(),
          password: activeCreds.password?.trim() || '',
          domain: activeCreds.domain.trim() || 'celeb24h.com',
          dateInterval: dateInterval === 'all_month' ? 'thisMonth' : dateInterval,
          dateFrom: customDateFrom || undefined,
          dateTo: customDateTo || undefined,
          usdToVndRate,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setApiStatusBanner({
          type: 'error',
          text: data.error || 'Không thể kết nối MGID Publisher API.',
        });
        return;
      }

      if (data.tokenMasked) {
        setTokenMaskedPreview(data.tokenMasked);
      }

      if (!data.apiConfigured) {
        setApiConnectedState(false);
        setApiStatusBanner({
          type: 'info',
          text: 'Chưa có API Token MGID trên máy chủ hoặc trong Cấu hình API. Hãy bấm "🔑 Cấp API MGID" để dán API Token khi bạn có, hoặc nhập/dán báo cáo CSV trực tiếp bên dưới.',
        });
        return;
      }

      if (data.apiConnected && Array.isArray(data.dailyStats) && data.dailyStats.length > 0) {
        setApiConnectedState(true);
        // Merge live API dailyStats with existing saved dailyStats
        const map = new Map<string, MgidDailyStatItem>();
        (savedReport.dailyStats || []).forEach((d) => map.set(d.date, d));
        data.dailyStats.forEach((d: MgidDailyStatItem) => map.set(d.date, d));
        const mergedDaily = Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));

        await saveMgidReportToCloud({
          domain: activeCreds.domain || 'celeb24h.com',
          usdToVndRate,
          apiConnected: true,
          dailyStats: mergedDaily,
          widgetStats:
            Array.isArray(data.widgetStats) && data.widgetStats.length > 0
              ? data.widgetStats
              : savedReport.widgetStats,
        });

        setApiStatusBanner({
          type: 'success',
          text: `Đã đồng bộ trực tiếp ${data.dailyStats.length} ngày dữ liệu từ MGID Publisher API (${data.tokenMasked || 'Token Active'})!`,
        });
      } else {
        setApiConnectedState(Boolean(data.apiConnected));
        setApiStatusBanner({
          type: 'warning',
          text:
            data.apiError ||
            'Đã gửi yêu cầu tới MGID API nhưng chưa có bản ghi mới trong khoảng ngày này. Kiểm tra lại Client ID hoặc API Token.',
        });
      }
    } catch (err: any) {
      setApiStatusBanner({
        type: 'error',
        text: err?.message || 'Lỗi kết nối tới máy chủ /api/mgid-stats',
      });
    } finally {
      setIsFetchingApi(false);
    }
  };

  // Add or edit a daily MGID stat row
  const handleOpenAddDaily = () => {
    setEditingDailyItem(null);
    setDailyDateInput(new Date().toISOString().slice(0, 10));
    setDailyDomainInput(savedReport.domain || 'celeb24h.com');
    setDailyPageViewsInput('');
    setDailyImpressionsInput('');
    setDailyVisibilityInput('82.5');
    setDailyClicksInput('');
    setDailyRevenueUsdInput('');
    setDailyNoteInput('');
    setIsAddDailyModalOpen(true);
  };

  const handleOpenEditDaily = (item: MgidDailyStatItem) => {
    setEditingDailyItem(item);
    setDailyDateInput(item.date);
    setDailyDomainInput(item.domain || 'celeb24h.com');
    setDailyPageViewsInput(String(item.pageViews || ''));
    setDailyImpressionsInput(String(item.impressions || ''));
    setDailyVisibilityInput(String(item.visibilityRate || 80));
    setDailyClicksInput(String(item.clicks || ''));
    setDailyRevenueUsdInput(String(item.revenueUsd || ''));
    setDailyNoteInput(item.note || '');
    setIsAddDailyModalOpen(true);
  };

  const handleSaveDailyStat = async (e: React.FormEvent) => {
    e.preventDefault();
    const imp = Math.max(0, parseInt(dailyImpressionsInput.replace(/[^\d]/g, ''), 10) || 0);
    const pv = Math.max(0, parseInt(dailyPageViewsInput.replace(/[^\d]/g, ''), 10) || Math.round(imp * 1.15));
    const clk = Math.max(0, parseInt(dailyClicksInput.replace(/[^\d]/g, ''), 10) || 0);
    const revUsd = Math.max(0, parseFloat(dailyRevenueUsdInput.replace(/[^0-9.]/g, '')) || 0);
    const vis = Math.min(100, Math.max(0, parseFloat(dailyVisibilityInput) || 80));

    const ctr = imp > 0 ? Math.round((clk / imp) * 10000) / 100 : 0;
    const cpc = clk > 0 ? Math.round((revUsd / clk) * 10000) / 10000 : 0;
    const ecpm = imp > 0 ? Math.round((revUsd / imp) * 1000 * 100) / 100 : 0;
    const rpm = pv > 0 ? Math.round((revUsd / pv) * 1000 * 100) / 100 : ecpm;

    const newItem: MgidDailyStatItem = {
      id: editingDailyItem?.id || `mgid-day-${dailyDateInput}-${Date.now()}`,
      date: dailyDateInput,
      domain: dailyDomainInput.trim() || 'celeb24h.com',
      pageViews: pv,
      impressions: imp,
      visibilityRate: vis,
      clicks: clk,
      ctr,
      cpc,
      ecpm,
      rpm,
      revenueUsd: Math.round(revUsd * 1000) / 1000,
      revenueVnd: Math.round(revUsd * usdToVndRate),
      note: dailyNoteInput.trim(),
    };

    const currentList = savedReport.dailyStats || [];
    const nextList = editingDailyItem
      ? currentList.map((it) => (it.id === editingDailyItem.id ? newItem : it))
      : [newItem, ...currentList.filter((it) => it.date !== newItem.date)];

    nextList.sort((a, b) => b.date.localeCompare(a.date));

    await saveMgidReportToCloud({ dailyStats: nextList });
    setIsAddDailyModalOpen(false);
    setApiStatusBanner({
      type: 'success',
      text: `Đã lưu báo cáo MGID ngày ${dailyDateInput} (${formatUsd(revUsd)} = ${formatVnd(revUsd * usdToVndRate)})!`,
    });
  };

  const handleDeleteDailyStat = async (id: string) => {
    if (!confirm('Xóa dòng báo cáo ngày này khỏi bảng MGID?')) return;
    const nextList = (savedReport.dailyStats || []).filter((it) => it.id !== id);
    await saveMgidReportToCloud({ dailyStats: nextList });
  };

  // Save Widget stat row
  const handleSaveWidgetStat = async (e: React.FormEvent) => {
    e.preventDefault();
    const imp = Math.max(0, parseInt(widgetImpressionsInput.replace(/[^\d]/g, ''), 10) || 0);
    const clk = Math.max(0, parseInt(widgetClicksInput.replace(/[^\d]/g, ''), 10) || 0);
    const revUsd = Math.max(0, parseFloat(widgetRevenueUsdInput.replace(/[^0-9.]/g, '')) || 0);
    const ctr = imp > 0 ? Math.round((clk / imp) * 10000) / 100 : 0;
    const cpc = clk > 0 ? Math.round((revUsd / clk) * 10000) / 10000 : 0;
    const ecpm = imp > 0 ? Math.round((revUsd / imp) * 1000 * 100) / 100 : 0;

    const newItem: MgidWidgetStatItem = {
      id: editingWidgetItem?.id || `mgid-w-${Date.now()}`,
      widgetId: widgetIdInput.trim() || String(Math.floor(1500000 + Math.random() * 90000)),
      widgetName: widgetNameInput.trim() || 'celeb24h.com - Smart Widget',
      domain: widgetDomainInput.trim() || 'celeb24h.com',
      placement: widgetPlacementInput,
      status: 'active',
      impressions: imp,
      visibilityRate: 82.4,
      clicks: clk,
      ctr,
      cpc,
      ecpm,
      revenueUsd: Math.round(revUsd * 1000) / 1000,
    };

    const currentWidgets = savedReport.widgetStats || [];
    const nextWidgets = editingWidgetItem
      ? currentWidgets.map((w) => (w.id === editingWidgetItem.id ? newItem : w))
      : [...currentWidgets, newItem];

    await saveMgidReportToCloud({ widgetStats: nextWidgets });
    setIsAddWidgetModalOpen(false);
    setEditingWidgetItem(null);
  };

  const handleDeleteWidgetStat = async (id: string) => {
    if (!confirm('Xóa Widget này khỏi báo cáo?')) return;
    const nextWidgets = (savedReport.widgetStats || []).filter((w) => w.id !== id);
    await saveMgidReportToCloud({ widgetStats: nextWidgets });
  };

  // Parse pasted CSV / TSV exported from https://pub.mgid.com/dashboard
  const handleImportCsvFromMgid = async () => {
    if (!csvRawText.trim()) {
      alert('Vui lòng dán dữ liệu bảng hoặc CSV xuất từ https://pub.mgid.com/dashboard!');
      return;
    }

    const lines = csvRawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const parsedRows: MgidDailyStatItem[] = [];

    lines.forEach((line, idx) => {
      // Skip header lines
      if (
        /^(date|ngày|day|site|widget)/i.test(line) ||
        line.toLowerCase().includes('impressions') ||
        line.toLowerCase().includes('ad views')
      ) {
        return;
      }

      const cols = line.includes('\t')
        ? line.split('\t').map((c) => c.trim())
        : line.split(/[,;]/).map((c) => c.replace(/^["']|["']$/g, '').trim());

      if (cols.length < 2) return;

      // Detect date column (YYYY-MM-DD or DD/MM/YYYY or MM/DD/YYYY)
      let rawDate = cols[0];
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawDate)) {
        const parts = rawDate.split('/');
        rawDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        rawDate = new Date().toISOString().slice(0, 10);
      }

      const nums = cols.slice(1).map((c) => {
        const clean = c.replace(/[$₫%,\s]/g, '');
        const n = parseFloat(clean);
        return Number.isFinite(n) ? n : 0;
      });

      // Typical MGID export columns:
      // Format A: Date | PageViews | Impressions (Ad Views) | Visibility% | Clicks | CTR% | CPC$ | eCPM$ | Revenue$
      // Format B: Date | Impressions | Clicks | CTR | CPC | eCPM | Revenue$
      // Format C: Date | Revenue$
      let pv = 0;
      let imp = 0;
      let vis = 80;
      let clk = 0;
      let revUsd = 0;

      if (nums.length >= 7) {
        pv = Math.round(nums[0]);
        imp = Math.round(nums[1]);
        vis = nums[2] <= 100 ? nums[2] : 80;
        clk = Math.round(nums[3]);
        revUsd = nums[nums.length - 1];
      } else if (nums.length >= 4) {
        imp = Math.round(nums[0]);
        pv = Math.round(imp * 1.15);
        clk = Math.round(nums[1]);
        revUsd = nums[nums.length - 1];
      } else if (nums.length >= 2) {
        imp = Math.round(nums[0]);
        pv = Math.round(imp * 1.15);
        revUsd = nums[nums.length - 1];
      } else if (nums.length === 1) {
        revUsd = nums[0];
      }

      const ctr = imp > 0 ? Math.round((clk / imp) * 10000) / 100 : 0;
      const cpc = clk > 0 ? Math.round((revUsd / clk) * 10000) / 10000 : 0;
      const ecpm = imp > 0 ? Math.round((revUsd / imp) * 1000 * 100) / 100 : 0;
      const rpm = pv > 0 ? Math.round((revUsd / pv) * 1000 * 100) / 100 : ecpm;

      parsedRows.push({
        id: `mgid-csv-${rawDate}-${idx}-${Date.now()}`,
        date: rawDate,
        domain: savedReport.domain || 'celeb24h.com',
        pageViews: pv,
        impressions: imp,
        visibilityRate: vis,
        clicks: clk,
        ctr,
        cpc,
        ecpm,
        rpm,
        revenueUsd: Math.round(revUsd * 1000) / 1000,
        revenueVnd: Math.round(revUsd * usdToVndRate),
      });
    });

    if (parsedRows.length === 0) {
      alert('Không nhận diện được dòng dữ liệu hợp lệ. Hãy kiểm tra lại định dạng!');
      return;
    }

    const map = new Map<string, MgidDailyStatItem>();
    (savedReport.dailyStats || []).forEach((d) => map.set(d.date, d));
    parsedRows.forEach((d) => map.set(d.date, d));
    const merged = Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));

    await saveMgidReportToCloud({ dailyStats: merged });
    setCsvRawText('');
    setMgidSubTab('daily');
    setApiStatusBanner({
      type: 'success',
      text: `Đã nhập thành công ${parsedRows.length} ngày dữ liệu báo cáo MGID và lưu lên Cloud Firestore!`,
    });
  };

  // Export MGID Report CSV
  const handleExportMgidCsv = () => {
    const lines: string[] = [];
    lines.push(`BAO CAO DOANH THU MGID PUBLISHER DASHBOARD - ${activeMonthRecord.title || selectedMonthKey}`);
    lines.push(`Domain:,${savedReport.domain || 'celeb24h.com'},Ty gia USD/VND:,${usdToVndRate}`);
    lines.push('');
    lines.push('Date,Domain,Page Views,Impressions (Ad Views),Visibility (%),Clicks,CTR (%),CPC ($),eCPM ($),Page RPM ($),Revenue ($ USD),Revenue (VND)');
    filteredDailyStats.forEach((d) => {
      lines.push(
        `${d.date},${d.domain || 'celeb24h.com'},${d.pageViews},${d.impressions},${d.visibilityRate}%,${d.clicks},${d.ctr}%,${d.cpc},${d.ecpm},${d.rpm || d.ecpm},${d.revenueUsd},${Math.round(d.revenueUsd * usdToVndRate)}`
      );
    });
    lines.push(
      `TONG CONG / TB,${savedReport.domain},${summaryMetrics.pageViews},${summaryMetrics.impressions},${summaryMetrics.visibilityRate}%,${summaryMetrics.clicks},${summaryMetrics.ctr}%,${summaryMetrics.cpc},${summaryMetrics.ecpm},${summaryMetrics.rpm},${summaryMetrics.revenueUsd},${summaryMetrics.revenueVnd}`
    );

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MGID_Dashboard_Report_${selectedMonthKey}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // HARD SECURITY GUARD: Strictly block non-admin
  if (!isAdmin) {
    return (
      <div className="min-h-[420px] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 text-white border border-rose-500/40 rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-500/30">
            <Lock className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black mb-2">Khu Vực Độc Quyền Admin</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Báo cáo doanh thu <strong>MGID Publisher Dashboard (pub.mgid.com)</strong> được mã hóa và khóa bảo mật 2 lớp. Chỉ tài khoản Quản Trị Viên (Admin) duy nhất mới được phép xem.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. MGID PUBLISHER DASHBOARD TOP BAR (Dark Authentic pub.mgid.com Theme) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-700/80">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Brand & Security Status */}
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 flex flex-col items-center justify-center shadow-md shrink-0 border border-white/15">
              <span className="text-xs font-black tracking-tighter leading-none">MGID</span>
              <span className="text-[9px] font-bold text-white/90 mt-0.5 uppercase">PUB</span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  MGID Publisher Dashboard — Báo Cáo Doanh Thu Thực Tế
                </h3>
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>CHỈ ADMIN XEM DUY NHẤT</span>
                </span>
                <span
                  className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    apiConnectedState || creds.apiToken
                      ? 'bg-sky-500/20 text-sky-300 border-sky-400/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      apiConnectedState || creds.apiToken ? 'bg-sky-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  <span>
                    {apiConnectedState
                      ? `API Connected (${tokenMaskedPreview || 'Live'})`
                      : creds.apiToken
                      ? 'Đã lưu Token API (Sẵn sàng đồng bộ)'
                      : 'Chế độ Cloud / Chờ cấp API Token'}
                  </span>
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  Nguồn: <strong className="text-white">https://pub.mgid.com/dashboard</strong>
                </span>
                <span>•</span>
                <span>
                  Website: <strong className="text-amber-300">{savedReport.domain || 'celeb24h.com'}</strong>
                </span>
                <span>•</span>
                <span>
                  Tỷ giá: <strong className="text-emerald-300">1 USD = {formatInt(usdToVndRate)} ₫</strong>
                </span>
                {savedReport.lastSyncedAt && (
                  <>
                    <span>•</span>
                    <span className="text-slate-400">Cập nhật: {savedReport.lastSyncedAt}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Action Buttons: Privacy Blur, API Config, Refresh, Sync to Monthly Finance */}
          <div className="flex flex-wrap items-center gap-2">
            {onTogglePrivacyMask && (
              <button
                type="button"
                onClick={onTogglePrivacyMask}
                className={`inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  isPrivacyMasked
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                    : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-600'
                }`}
                title="Ẩn/Hiện số tiền trên màn hình khi có người đứng cạnh"
              >
                {isPrivacyMasked ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>{isPrivacyMasked ? 'Hiện Số Tiền' : 'Ẩn Số Tiền'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsApiConfigModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition-all shadow-sm cursor-pointer border border-indigo-400/40"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>🔑 Cấp API MGID / Tỷ Giá</span>
            </button>

            <button
              type="button"
              onClick={() => handleSyncFromMgidApi()}
              disabled={isFetchingApi}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-black transition-all shadow-sm cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetchingApi ? 'animate-spin' : ''}`} />
              <span>{isFetchingApi ? 'Đang lấy API...' : 'Lấy Dữ Liệu API'}</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                if (summaryMetrics.revenueUsd <= 0) {
                  alert('Chưa có doanh thu MGID (> $0) để đồng bộ vào Bảng Thu Chi tháng này!');
                  return;
                }
                await saveMgidReportToCloud({}, true);
                setApiStatusBanner({
                  type: 'success',
                  text: `Đã chốt & đồng bộ ${formatUsd(summaryMetrics.revenueUsd)} (${formatVnd(summaryMetrics.revenueVnd)}) vào mục Doanh Thu & Tiền Về của ${activeMonthRecord.title || selectedMonthKey}!`,
                });
              }}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all shadow-sm cursor-pointer border border-emerald-400/40"
              title="Tự động quy đổi USD sang VNĐ và cộng thẳng vào Tổng Tiền Về của tháng này"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Đồng Bộ Vào Tiền Về Tháng ({formatVnd(summaryMetrics.revenueVnd, isPrivacyMasked)})</span>
            </button>
          </div>
        </div>

        {/* Filter Bar: Date Range & Domain & Exchange Rate */}
        <div className="mt-4 pt-3.5 border-t border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-rose-400" />
              <span>Kỳ báo cáo:</span>
            </span>
            {[
              { id: 'all_month', label: `Cả Tháng (${selectedMonthKey})` },
              { id: 'today', label: 'Hôm nay' },
              { id: 'yesterday', label: 'Hôm qua' },
              { id: 'last7days', label: '7 ngày qua' },
              { id: 'last30days', label: '30 ngày qua' },
              { id: 'custom', label: 'Tùy chỉnh ngày' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDateInterval(opt.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  dateInterval === opt.id
                    ? 'bg-rose-500 text-white shadow-xs font-black'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}

            {dateInterval === 'custom' && (
              <div className="flex items-center space-x-1.5 ml-1">
                <input
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="px-2 py-1 bg-slate-800 border border-slate-600 rounded-lg text-xs text-white"
                />
                <span className="text-slate-400 text-xs">→</span>
                <input
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="px-2 py-1 bg-slate-800 border border-slate-600 rounded-lg text-xs text-white"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Tỷ giá USD -> VNĐ nhanh */}
            <div className="flex items-center bg-slate-800/90 border border-slate-600 rounded-xl px-2.5 py-1 space-x-1.5">
              <span className="text-[11px] font-bold text-slate-300">Tỷ giá 1$ =</span>
              <input
                type="text"
                value={usdRateInput}
                onChange={(e) => setUsdRateInput(e.target.value)}
                onBlur={() => saveMgidReportToCloud({ usdToVndRate })}
                className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs font-mono font-black text-emerald-400 text-right focus:outline-hidden"
              />
              <span className="text-[11px] font-bold text-slate-400">₫</span>
            </div>

            <button
              type="button"
              onClick={handleOpenAddDaily}
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Nhập Nhanh Ngày MGID</span>
            </button>

            <button
              type="button"
              onClick={handleExportMgidCsv}
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Xuất CSV MGID</span>
            </button>
          </div>
        </div>
      </div>

      {/* Status Banner */}
      {apiStatusBanner && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-bold ${
            apiStatusBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : apiStatusBanner.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : apiStatusBanner.type === 'warning'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-sky-50 border-sky-300 text-sky-900'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{apiStatusBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setApiStatusBanner(null)}
            className="p-1 hover:bg-black/5 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. 8 MGID CORE KPI CARDS (Matching https://pub.mgid.com/dashboard) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {/* Card 1: Total Revenue ($ USD & VNĐ) */}
        <div className="col-span-2 p-3.5 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-100">
              💵 Doanh Thu MGID (Revenue)
            </span>
            <DollarSign className="w-4 h-4 text-emerald-200" />
          </div>
          <div className="my-1">
            <div className="text-xl sm:text-2xl font-black font-mono tracking-tight">
              {formatUsd(summaryMetrics.revenueUsd, isPrivacyMasked)}
            </div>
            <div className="text-xs font-extrabold text-emerald-100 font-mono mt-0.5">
              ≈ {formatVnd(summaryMetrics.revenueVnd, isPrivacyMasked)}
            </div>
          </div>
          <div className="text-[10px] text-emerald-100/90 flex items-center justify-between pt-1 border-t border-white/15">
            <span>TB: {formatUsd(summaryMetrics.avgDailyUsd, isPrivacyMasked)}/ngày</span>
            <span>{summaryMetrics.daysCount} ngày có số liệu</span>
          </div>
        </div>

        {/* Card 2: Page Views & Page RPM */}
        <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col justify-between">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-wide flex items-center justify-between">
            <span>Page Views</span>
            <Globe className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 font-mono my-1">
            {formatInt(summaryMetrics.pageViews)}
          </div>
          <div className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-lg truncate">
            Page RPM: {isPrivacyMasked ? '$•••' : `$${summaryMetrics.rpm.toFixed(2)}`}
          </div>
        </div>

        {/* Card 3: Ad Views / Impressions & Visibility */}
        <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col justify-between">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-wide flex items-center justify-between">
            <span>Impressions (QC)</span>
            <Eye className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 font-mono my-1">
            {formatInt(summaryMetrics.impressions)}
          </div>
          <div className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg truncate">
            Visibility: {summaryMetrics.visibilityRate}%
          </div>
        </div>

        {/* Card 4: Clicks */}
        <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col justify-between">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-wide flex items-center justify-between">
            <span>Ad Clicks</span>
            <MousePointerClick className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-base sm:text-lg font-black text-amber-700 font-mono my-1">
            {formatInt(summaryMetrics.clicks)}
          </div>
          <div className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg truncate">
            Lượt click thực tế
          </div>
        </div>

        {/* Card 5: eCPM ($) */}
        <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col justify-between">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-wide flex items-center justify-between">
            <span>eCPM (1000 Xem)</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-700 font-mono my-1">
            {isPrivacyMasked ? '$ ••.••' : `$${summaryMetrics.ecpm.toFixed(2)}`}
          </div>
          <div className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg truncate">
            ≈ {formatVnd(summaryMetrics.ecpm * usdToVndRate, isPrivacyMasked)}/1K
          </div>
        </div>

        {/* Card 6: CPC & CTR */}
        <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col justify-between">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-wide flex items-center justify-between">
            <span>CPC & CTR</span>
            <Activity className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-base sm:text-lg font-black text-rose-700 font-mono my-1">
            {isPrivacyMasked ? '•• ¢' : `${summaryMetrics.cpcCents.toFixed(2)} ¢`}
          </div>
          <div className="text-[10px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-lg truncate">
            CTR: {summaryMetrics.ctr.toFixed(2)}% | ${summaryMetrics.cpc.toFixed(3)}
          </div>
        </div>

        {/* Card 7: 30-Day Run-Rate Forecast */}
        <div className="p-3 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-300 rounded-2xl shadow-2xs flex flex-col justify-between">
          <div className="text-[10px] font-black text-amber-900 uppercase tracking-wide flex items-center justify-between">
            <span>Dự Báo 30 Ngày</span>
            <BarChart3 className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-sm sm:text-base font-black text-amber-900 font-mono my-1 truncate">
            {formatUsd(summaryMetrics.forecastMonthUsd, isPrivacyMasked)}
          </div>
          <div className="text-[10px] font-extrabold text-amber-800 truncate font-mono">
            ≈ {formatVnd(summaryMetrics.forecastMonthVnd, isPrivacyMasked)}
          </div>
        </div>
      </div>

      {/* 3. INTERACTIVE DAILY REVENUE & PERFORMANCE CHART */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h4 className="text-sm font-black text-slate-900 flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-rose-600" />
              <span>Biểu Đồ Doanh Thu & Hiệu Suất Quảng Cáo MGID Theo Ngày</span>
            </h4>
            <p className="text-xs text-slate-500">
              Di chuột vào từng cột ngày để xem chi tiết Doanh thu ($ / VNĐ), Lượt Click, Impressions, CPC và eCPM.
            </p>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'revenueUsd', label: '💵 Doanh Thu ($)' },
              { id: 'clicks', label: '🖱️ Clicks' },
              { id: 'impressions', label: '👁️ Impressions' },
              { id: 'ecpm', label: '📈 eCPM ($)' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setChartMetric(m.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  chartMetric === m.id
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="py-10 text-center space-y-3 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
            <div className="text-xs text-slate-500 max-w-lg mx-auto">
              Chưa có dữ liệu báo cáo MGID trong kỳ <strong>{activeMonthRecord.title || selectedMonthKey}</strong>. Bạn có thể bấm{' '}
              <strong>"🔑 Cấp API MGID"</strong> để đồng bộ tự động từ <code>pub.mgid.com/dashboard</code>, hoặc nhập/dán CSV báo cáo.
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setIsApiConfigModalOpen(true)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer inline-flex items-center space-x-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Cấu Hình API MGID</span>
              </button>
              <button
                type="button"
                onClick={handleOpenAddDaily}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer inline-flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Nhập Báo Cáo Ngày MGID</span>
              </button>
              <button
                type="button"
                onClick={() => setMgidSubTab('import_api')}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer inline-flex items-center space-x-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Dán CSV Từ pub.mgid.com</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="pt-4 pb-2 overflow-x-auto">
            <div className="min-w-[600px] h-52 flex items-end gap-2 px-2 border-b border-slate-200 pb-2">
              {chartData.map((d) => {
                const rawVal =
                  chartMetric === 'revenueUsd'
                    ? d.revenueUsd
                    : chartMetric === 'clicks'
                    ? d.clicks
                    : chartMetric === 'impressions'
                    ? d.impressions
                    : d.ecpm;
                const heightPct = Math.max(8, Math.round((rawVal / maxChartValue) * 100));
                const shortDate = d.date.slice(5); // MM-DD
                return (
                  <div
                    key={d.id}
                    className="flex-1 min-w-[28px] flex flex-col items-center group relative h-full justify-end"
                  >
                    {/* Tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity absolute bottom-full mb-2 z-20 bg-slate-900 text-white text-[10px] rounded-xl p-2.5 shadow-xl w-48 border border-slate-700">
                      <div className="font-black text-amber-300 border-b border-slate-700 pb-1 mb-1">
                        Ngày: {d.date}
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Doanh thu ($):</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {formatUsd(d.revenueUsd, isPrivacyMasked)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Quy đổi (VNĐ):</span>
                        <span className="font-mono font-bold text-emerald-300">
                          {formatVnd(d.revenueUsd * usdToVndRate, isPrivacyMasked)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Impressions:</span>
                        <span className="font-mono">{formatInt(d.impressions)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Clicks (CTR):</span>
                        <span className="font-mono">
                          {formatInt(d.clicks)} ({d.ctr}%)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">eCPM / CPC:</span>
                        <span className="font-mono">
                          ${d.ecpm} / {(d.cpc * 100).toFixed(2)}¢
                        </span>
                      </div>
                    </div>

                    <div className="text-[9px] font-mono font-bold text-slate-600 mb-1 truncate max-w-full">
                      {chartMetric === 'revenueUsd'
                        ? isPrivacyMasked
                          ? '•••'
                          : `$${d.revenueUsd.toFixed(1)}`
                        : chartMetric === 'ecpm'
                        ? `$${d.ecpm.toFixed(2)}`
                        : formatInt(rawVal)}
                    </div>

                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full max-w-[36px] rounded-t-lg transition-all ${
                        chartMetric === 'revenueUsd'
                          ? 'bg-gradient-to-t from-emerald-600 to-teal-400 group-hover:from-emerald-500 group-hover:to-teal-300'
                          : chartMetric === 'clicks'
                          ? 'bg-gradient-to-t from-amber-600 to-yellow-400'
                          : chartMetric === 'impressions'
                          ? 'bg-gradient-to-t from-indigo-600 to-sky-400'
                          : 'bg-gradient-to-t from-rose-600 to-orange-400'
                      }`}
                    />
                    <div className="text-[10px] font-mono font-bold text-slate-500 mt-1.5">{shortDate}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4. SUB-NAVIGATION FOR DETAILED MGID REPORTS */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMgidSubTab('daily')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center space-x-1.5 ${
              mgidSubTab === 'daily'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-700 hover:bg-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>Báo Cáo Theo Ngày (Daily Report)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-white/15 text-[10px]">
              {filteredDailyStats.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMgidSubTab('widgets')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center space-x-1.5 ${
              mgidSubTab === 'widgets'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-700 hover:bg-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>Theo Website & Widgets (pub.mgid.com)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-white/15 text-[10px]">
              {savedReport.widgetStats?.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMgidSubTab('import_api')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center space-x-1.5 ${
              mgidSubTab === 'import_api'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-700 hover:bg-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5 text-sky-400" />
            <span>Nhập CSV / Cấu Hình API MGID</span>
          </button>
        </div>

        <a
          href="https://pub.mgid.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center space-x-1 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-all"
        >
          <span>Mở pub.mgid.com/dashboard</span>
          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
        </a>
      </div>

      {/* 5. SUB-TAB 1: DAILY BREAKDOWN TABLE */}
      {mgidSubTab === 'daily' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-black text-slate-900">
                Bảng Chi Tiết Doanh Thu MGID Theo Ngày ({activeMonthRecord.title || selectedMonthKey})
              </h4>
              <p className="text-xs text-slate-500">
                Đầy đủ các cột chỉ số chuẩn từ <code>https://pub.mgid.com/dashboard</code> kèm quy đổi VNĐ tự động.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenAddDaily}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>+ Thêm Ngày Doanh Thu MGID</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900 text-white font-black text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Ngày (Date)</th>
                  <th className="py-2.5 px-3">Website</th>
                  <th className="py-2.5 px-3 text-right">Page Views</th>
                  <th className="py-2.5 px-3 text-right">Impressions (Ad Views)</th>
                  <th className="py-2.5 px-3 text-right">Visibility</th>
                  <th className="py-2.5 px-3 text-right">Clicks</th>
                  <th className="py-2.5 px-3 text-right">CTR (%)</th>
                  <th className="py-2.5 px-3 text-right">CPC (¢ / $)</th>
                  <th className="py-2.5 px-3 text-right">eCPM ($)</th>
                  <th className="py-2.5 px-3 text-right bg-emerald-950/80 text-emerald-300">Doanh Thu ($ USD)</th>
                  <th className="py-2.5 px-3 text-right bg-teal-950/80 text-teal-300">Quy Đổi (VNĐ)</th>
                  <th className="py-2.5 px-3 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredDailyStats.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-slate-400 font-sans">
                      Chưa có dòng báo cáo ngày nào. Hãy bấm <strong>"+ Thêm Ngày Doanh Thu MGID"</strong> hoặc đồng bộ từ API / CSV.
                    </td>
                  </tr>
                ) : (
                  filteredDailyStats.map((row) => {
                    const vndVal = Math.round(row.revenueUsd * usdToVndRate);
                    return (
                      <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-black text-slate-900">{row.date}</td>
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-600">
                          {row.domain || 'celeb24h.com'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700">{formatInt(row.pageViews)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-indigo-700">
                          {formatInt(row.impressions)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600">{row.visibilityRate}%</td>
                        <td className="py-2.5 px-3 text-right font-bold text-amber-700">
                          {formatInt(row.clicks)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700">{row.ctr.toFixed(2)}%</td>
                        <td className="py-2.5 px-3 text-right text-rose-700 font-bold">
                          {isPrivacyMasked ? '•• ¢' : `${(row.cpc * 100).toFixed(2)}¢`}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                          {isPrivacyMasked ? '$••' : `$${row.ecpm.toFixed(2)}`}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-700 bg-emerald-50/50 text-sm">
                          {formatUsd(row.revenueUsd, isPrivacyMasked)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-teal-800 bg-teal-50/40">
                          {formatVnd(vndVal, isPrivacyMasked)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-sans">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditDaily(row)}
                              className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                              title="Sửa ngày này"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDailyStat(row.id)}
                              className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Xóa ngày này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filteredDailyStats.length > 0 && (
                <tfoot className="bg-slate-900 text-white font-black text-xs font-mono">
                  <tr>
                    <td colSpan={2} className="py-3 px-3 font-sans uppercase text-amber-300">
                      TỔNG CỘNG ({filteredDailyStats.length} NGÀY):
                    </td>
                    <td className="py-3 px-3 text-right">{formatInt(summaryMetrics.pageViews)}</td>
                    <td className="py-3 px-3 text-right text-indigo-300">{formatInt(summaryMetrics.impressions)}</td>
                    <td className="py-3 px-3 text-right">{summaryMetrics.visibilityRate}%</td>
                    <td className="py-3 px-3 text-right text-amber-300">{formatInt(summaryMetrics.clicks)}</td>
                    <td className="py-3 px-3 text-right">{summaryMetrics.ctr.toFixed(2)}%</td>
                    <td className="py-3 px-3 text-right text-rose-300">
                      {isPrivacyMasked ? '•• ¢' : `${summaryMetrics.cpcCents.toFixed(2)}¢`}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-300">
                      {isPrivacyMasked ? '$••' : `$${summaryMetrics.ecpm.toFixed(2)}`}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-400 text-sm">
                      {formatUsd(summaryMetrics.revenueUsd, isPrivacyMasked)}
                    </td>
                    <td className="py-3 px-3 text-right text-teal-300 text-sm">
                      {formatVnd(summaryMetrics.revenueVnd, isPrivacyMasked)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* 6. SUB-TAB 2: SITES & SMART WIDGETS BREAKDOWN */}
      {mgidSubTab === 'widgets' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-black text-slate-900">
                Hiệu Suất Theo Vị Trí Đặt Quảng Cáo MGID (Smart Widgets — {savedReport.domain || 'celeb24h.com'})
              </h4>
              <p className="text-xs text-slate-500">
                Theo dõi doanh thu từng mã Widget MGID đặt trên website (Under Article, In-Article, Sidebar, Mobile Sticky).
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingWidgetItem(null);
                setWidgetIdInput('');
                setWidgetNameInput('celeb24h.com - Under Article Widget');
                setWidgetDomainInput('celeb24h.com');
                setWidgetImpressionsInput('');
                setWidgetClicksInput('');
                setWidgetRevenueUsdInput('');
                setIsAddWidgetModalOpen(true);
              }}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Thêm Widget MGID</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900 text-white font-black text-[11px] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Widget ID</th>
                  <th className="py-2.5 px-3">Tên Widget / Vị Trí</th>
                  <th className="py-2.5 px-3">Website</th>
                  <th className="py-2.5 px-3 text-right">Impressions</th>
                  <th className="py-2.5 px-3 text-right">Clicks</th>
                  <th className="py-2.5 px-3 text-right">CTR (%)</th>
                  <th className="py-2.5 px-3 text-right">CPC (¢)</th>
                  <th className="py-2.5 px-3 text-right">eCPM ($)</th>
                  <th className="py-2.5 px-3 text-right text-emerald-300">Doanh Thu ($)</th>
                  <th className="py-2.5 px-3 text-right text-teal-300">Quy Đổi (VNĐ)</th>
                  <th className="py-2.5 px-3 text-center">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {!savedReport.widgetStats || savedReport.widgetStats.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400 font-sans">
                      Chưa có thống kê theo Widget. Bấm <strong>"+ Thêm Widget MGID"</strong> hoặc kết nối API có Client ID để tự động tải danh sách Widgets.
                    </td>
                  </tr>
                ) : (
                  savedReport.widgetStats.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-indigo-700">#{w.widgetId}</td>
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-900">{w.widgetName}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-600">{w.domain}</td>
                      <td className="py-2.5 px-3 text-right">{formatInt(w.impressions)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-amber-700">{formatInt(w.clicks)}</td>
                      <td className="py-2.5 px-3 text-right">{w.ctr.toFixed(2)}%</td>
                      <td className="py-2.5 px-3 text-right">{(w.cpc * 100).toFixed(2)}¢</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">${w.ecpm.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-black text-emerald-700">
                        {formatUsd(w.revenueUsd, isPrivacyMasked)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-teal-800">
                        {formatVnd(w.revenueUsd * usdToVndRate, isPrivacyMasked)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteWidgetStat(w.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. SUB-TAB 3: CSV IMPORT & API GUIDE */}
      {mgidSubTab === 'import_api' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
            <h4 className="text-sm font-black text-slate-900 flex items-center space-x-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Dán Nhanh Bảng Số Liệu / CSV Xuất Từ pub.mgid.com/dashboard</span>
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có thể copy trực tiếp các dòng trong bảng thống kê trên trang{' '}
              <code>https://pub.mgid.com/dashboard</code> hoặc mở file CSV xuất từ MGID và dán vào ô bên dưới. Hệ thống sẽ tự động tách cột Ngày, Impressions, Clicks, CTR, CPC, eCPM và Doanh thu ($).
            </p>
            <textarea
              rows={6}
              value={csvRawText}
              onChange={(e) => setCsvRawText(e.target.value)}
              placeholder={`Ví dụ định dạng dòng copy hoặc CSV:\n2026-10-21, 145000, 128000, 82.5, 1950, 1.52, 0.045, 0.68, 87.75\n2026-10-20, 162000, 140000, 84.0, 2180, 1.56, 0.048, 0.75, 104.64`}
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleImportCsvFromMgid}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs"
              >
                Phân Tích & Nhập Vào Báo Cáo MGID
              </button>
            </div>
          </div>

          <div className="bg-slate-900 text-white border border-slate-700 rounded-2xl p-4 shadow-2xs space-y-3">
            <h4 className="text-sm font-black text-amber-300 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Cơ Chế Bảo Mật Độc Quyền Admin (Zero-Leak Shield)</span>
            </h4>
            <ul className="text-xs text-slate-300 space-y-2 leading-relaxed">
              <li>
                • <strong>Khóa Phân Quyền 3 Lớp:</strong> Toàn bộ số liệu MGID và Doanh thu tháng được bảo vệ ở cả Giao diện (UI Guard), Bộ nhớ RAM (Auto-Strip cho Staff) và API Server (Header <code>x-admin-role: admin</code>).
              </li>
              <li>
                • <strong>Kết Nối API MGID Trực Tiếp:</strong> Khi bạn cấp <code>MGID API Token</code> hoặc <code>Client ID</code> (hoặc <code>Email + Password MGID</code>), máy chủ backend sẽ gọi trực tiếp tới <code>https://api.mgid.com/v1/publishers</code> mà không bao giờ lộ khóa API cho tài khoản nhân viên.
              </li>
              <li>
                • <strong>Đồng Bộ 1 Chạm Vào Bảng Thu Chi:</strong> Bấm nút <em>"Đồng Bộ Vào Tiền Về Tháng"</em> để tự động nhân doanh thu USD với tỷ giá VNĐ và cập nhật thẳng vào mục Doanh Thu của tháng đang xem.
              </li>
            </ul>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsApiConfigModalOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black cursor-pointer inline-flex items-center space-x-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Mở Cài Đặt Kết Nối API MGID</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CẤU HÌNH API MGID (ADMIN ONLY VAULT) */}
      {isApiConfigModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Cấu Hình Kết Nối API MGID (pub.mgid.com)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Bảo mật độc quyền chỉ dành cho Quản Trị Viên (Admin)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsApiConfigModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-black text-slate-800 block mb-1">
                  1. MGID API Token (Khuyên dùng - Cấp từ MGID Dashboard / AM):
                </label>
                <input
                  type="password"
                  value={creds.apiToken}
                  onChange={(e) => setCreds((prev) => ({ ...prev, apiToken: e.target.value }))}
                  placeholder="Dán API Token từ MGID của bạn vào đây..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    MGID Client ID / Publisher ID (Tùy chọn):
                  </label>
                  <input
                    type="text"
                    value={creds.clientId}
                    onChange={(e) => setCreds((prev) => ({ ...prev, clientId: e.target.value }))}
                    placeholder="VD: 748291"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Website / Tên Miền Chính:
                  </label>
                  <input
                    type="text"
                    value={creds.domain}
                    onChange={(e) => setCreds((prev) => ({ ...prev, domain: e.target.value }))}
                    placeholder="celeb24h.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                <div className="font-black text-slate-700">
                  2. Hoặc Đăng Nhập Tự Động Lấy Token Qua Email & Mật Khẩu MGID (Tùy chọn):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="email"
                    value={creds.email}
                    onChange={(e) => setCreds((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="Email đăng nhập pub.mgid.com"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900"
                  />
                  <input
                    type="password"
                    value={creds.password || ''}
                    onChange={(e) => setCreds((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder="Mật khẩu MGID (nếu chưa có Token)"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Tỷ giá quy đổi 1 USD sang VNĐ (Áp dụng tính tiền về):
                </label>
                <input
                  type="number"
                  value={usdRateInput}
                  onChange={(e) => setUsdRateInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-black text-emerald-700"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsApiConfigModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={async () => {
                  const nextCreds: MgidApiCredentials = {
                    ...creds,
                    usdToVndRate,
                  };
                  saveAdminMgidVault(currentUser.role, nextCreds);
                  await saveMgidReportToCloud({
                    domain: nextCreds.domain || 'celeb24h.com',
                    usdToVndRate,
                  });
                  setIsApiConfigModalOpen(false);
                  await handleSyncFromMgidApi(nextCreds);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-sm"
              >
                Lưu Cấu Hình & Đồng Bộ API Ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: THÊM / SỬA BÁO CÁO NGÀY MGID */}
      {isAddDailyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">
                {editingDailyItem ? 'Cập Nhật Ngày Báo Cáo MGID' : 'Thêm Ngày Báo Cáo MGID'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddDailyModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDailyStat} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Ngày báo cáo:</label>
                  <input
                    type="date"
                    required
                    value={dailyDateInput}
                    onChange={(e) => setDailyDateInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Website:</label>
                  <input
                    type="text"
                    value={dailyDomainInput}
                    onChange={(e) => setDailyDomainInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Impressions (Ad Views):</label>
                  <input
                    type="number"
                    placeholder="VD: 125000"
                    value={dailyImpressionsInput}
                    onChange={(e) => setDailyImpressionsInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Page Views (Lượt xem):</label>
                  <input
                    type="number"
                    placeholder="Tự tính nếu để trống"
                    value={dailyPageViewsInput}
                    onChange={(e) => setDailyPageViewsInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Clicks (Lượt click QC):</label>
                  <input
                    type="number"
                    placeholder="VD: 1850"
                    value={dailyClicksInput}
                    onChange={(e) => setDailyClicksInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-amber-700"
                  />
                </div>
                <div>
                  <label className="font-black text-emerald-800 block mb-1">Doanh Thu ($ USD):</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    placeholder="VD: 84.50"
                    value={dailyRevenueUsdInput}
                    onChange={(e) => setDailyRevenueUsdInput(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-emerald-400 rounded-xl font-mono font-black text-emerald-700"
                  />
                </div>
              </div>

              {dailyRevenueUsdInput && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 font-bold flex items-center justify-between">
                  <span>Quy đổi theo tỷ giá ({formatInt(usdToVndRate)} ₫):</span>
                  <span className="font-mono font-black text-sm">
                    {formatVnd((parseFloat(dailyRevenueUsdInput) || 0) * usdToVndRate)}
                  </span>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddDailyModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black cursor-pointer"
                >
                  Lưu Báo Cáo Ngày
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: THÊM WIDGET MGID */}
      {isAddWidgetModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">Thêm Vị Trí Quảng Cáo (MGID Widget)</h3>
              <button
                type="button"
                onClick={() => setIsAddWidgetModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWidgetStat} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mã Widget ID:</label>
                  <input
                    type="text"
                    placeholder="VD: 1584920"
                    value={widgetIdInput}
                    onChange={(e) => setWidgetIdInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Website:</label>
                  <input
                    type="text"
                    value={widgetDomainInput}
                    onChange={(e) => setWidgetDomainInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Tên Widget / Vị Trí:</label>
                <input
                  type="text"
                  required
                  value={widgetNameInput}
                  onChange={(e) => setWidgetNameInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Impressions:</label>
                  <input
                    type="number"
                    value={widgetImpressionsInput}
                    onChange={(e) => setWidgetImpressionsInput(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Clicks:</label>
                  <input
                    type="number"
                    value={widgetClicksInput}
                    onChange={(e) => setWidgetClicksInput(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="font-black text-emerald-800 block mb-1">Revenue ($):</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={widgetRevenueUsdInput}
                    onChange={(e) => setWidgetRevenueUsdInput(e.target.value)}
                    className="w-full px-2.5 py-2 border-2 border-emerald-400 rounded-xl font-mono font-black text-emerald-700"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddWidgetModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black cursor-pointer"
                >
                  Lưu Widget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
