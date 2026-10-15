import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  RefreshCw,
  ExternalLink,
  AlertCircle,
  BarChart3,
  Users,
  Activity,
  Shield,
  Check,
  Lock,
  Copy,
  Tag,
  Sparkles,
} from 'lucide-react';
import type {
  WpStatsDashboardPayload,
  WpRealtimeMinute,
  WpTopPostRow,
} from '../server/wpStatsService';
import {
  type AppUser,
  type UserAccount,
  type TabKey,
  DEFAULT_WP_EMPLOYEE_OPTIONS,
  resolveAccountWpEmployeeCode,
} from '../types';

interface WordPressStatsTabProps {
  currentUser?: AppUser;
  accounts?: UserAccount[];
  onUpdateAccountPermissions?: (accountId: string, allowedTabs: TabKey[]) => Promise<void> | void;
  onUpdateAccountInfo?: (accountId: string, updates: Partial<UserAccount>) => Promise<void> | void;
}

export const WordPressStatsTab: React.FC<WordPressStatsTabProps> = ({
  currentUser,
  accounts = [],
  onUpdateAccountPermissions,
  onUpdateAccountInfo,
}) => {
  const isAdmin = currentUser?.role === 'admin';

  // Tìm tài khoản hiện tại của nhân viên đang đăng nhập
  const currentAccount = useMemo(() => {
    if (!currentUser) return null;
    const uName = (currentUser.name || '').trim().toLowerCase();
    const uEmail = (currentUser.email || '').trim().toLowerCase();
    return (
      accounts.find(
        (a) =>
          a.id === currentUser.id ||
          (uEmail && a.email?.trim().toLowerCase() === uEmail) ||
          (uName && a.username.trim().toLowerCase() === uName)
      ) || null
    );
  }, [accounts, currentUser]);

  // Mã nhân viên WordPress của người đang xem (VD: M2001 cho MS.LY, H2000 cho MS.HUYEN, A0006 cho Admin)
  const viewerEmployeeCode = useMemo(() => {
    return resolveAccountWpEmployeeCode(
      currentAccount || {
        username: currentUser?.name,
        email: currentUser?.email,
        role: currentUser?.role,
        wpEmployeeCode: currentUser?.wpEmployeeCode,
      },
      currentUser?.name
    );
  }, [currentAccount, currentUser]);

  // Chế độ phân quyền mã nhân viên cho tài khoản hiện tại:
  // - Admin hoặc wpAllowedEmployeeCodes có 'ALL': xem toàn bộ mã + bảng xếp hạng nhân viên
  // - 'MINE_ONLY': chỉ khóa cứng mã nhân viên của mình (không xem toàn web, không xem mã khác)
  // - 'MINE_AND_SITE' (mặc định chuẩn như trang tkw-my-stats trên celeb24h.com): xem mã của mình + toàn website, ẩn mã người khác & ẩn bảng xếp hạng
  const staffPermissionMode = useMemo<'ALL' | 'MINE_ONLY' | 'MINE_AND_SITE'>(() => {
    if (isAdmin) return 'ALL';
    const codes = currentAccount?.wpAllowedEmployeeCodes || currentUser?.wpAllowedEmployeeCodes || [];
    if (codes.includes('ALL')) return 'ALL';
    if (codes.includes('MINE_ONLY')) return 'MINE_ONLY';
    return 'MINE_AND_SITE';
  }, [isAdmin, currentAccount, currentUser]);

  const canSeeAllEmployeesRanking = isAdmin || staffPermissionMode === 'ALL';
  const canSeeSiteWide = isAdmin || staffPermissionMode !== 'MINE_ONLY';

  const [data, setData] = useState<WpStatsDashboardPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshingLive, setRefreshingLive] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Panel phân quyền & gán mã nhân viên xem Bảng Thống Kê View (Dành cho Admin)
  const [showPermissionPanel, setShowPermissionPanel] = useState<boolean>(false);
  const [savingStaffId, setSavingStaffId] = useState<string | null>(null);
  const [customCodeInputs, setCustomCodeInputs] = useState<Record<string, string>>({});

  // Trạng thái copy link
  const [copiedUrlKey, setCopiedUrlKey] = useState<string | null>(null);

  // Phân trang cho bảng "🔵 Khách đang xem gì" (5 bài / trang giống hệt dashboard.js v3.4)
  const [activeLivePage, setActiveLivePage] = useState<number>(1);
  const livePageSize = 5;

  const staffAccounts = useMemo(
    () =>
      accounts
        .filter((a) => a.role === 'staff')
        .sort((a, b) => a.username.localeCompare(b.username, 'vi')),
    [accounts]
  );

  const getStaffTabs = (acc: UserAccount): TabKey[] => {
    const base: TabKey[] =
      Array.isArray(acc.allowedTabs) && acc.allowedTabs.length > 0
        ? (acc.allowedTabs.filter((t) => t !== 'staff_management' && t !== 'revenue') as TabKey[])
        : ['fanpage', 'fullvia', 'staff_info', 'image_studio'];
    if (!base.includes('staff_info')) base.push('staff_info');
    if (!base.includes('image_studio')) base.push('image_studio');
    return base;
  };

  const allowedViewStatsCount = useMemo(
    () => staffAccounts.filter((acc) => getStaffTabs(acc).includes('view_stats')).length,
    [staffAccounts]
  );

  // Danh sách tùy chọn mã nhân viên kết hợp từ celeb24h.com và danh sách chuẩn
  const allEmployeeOptions = useMemo(() => {
    const map = new Map<string, string>();
    DEFAULT_WP_EMPLOYEE_OPTIONS.forEach((o) => map.set(o.code, o.label));
    (data?.employeeOptions || []).forEach((o) => {
      if (o.code) map.set(o.code, o.label || o.code);
    });
    staffAccounts.forEach((acc) => {
      const c = resolveAccountWpEmployeeCode(acc);
      if (c && !map.has(c)) {
        map.set(c, `${c} · ${acc.username}`);
      }
    });
    return Array.from(map.entries()).map(([code, label]) => ({ code, label }));
  }, [data?.employeeOptions, staffAccounts]);

  const handleCopyUrl = useCallback((url: string, key: string) => {
    if (!url) return;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).catch(() => {});
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } catch {}
      document.body.removeChild(textarea);
    }
    setCopiedUrlKey(key);
    window.setTimeout(() => {
      setCopiedUrlKey((prev) => (prev === key ? null : prev));
    }, 1800);
  }, []);

  const handleToggleStaffViewStats = async (acc: UserAccount) => {
    if (!isAdmin || !onUpdateAccountPermissions) return;
    setSavingStaffId(acc.id);
    try {
      const currentTabs = getStaffTabs(acc);
      const hasAccess = currentTabs.includes('view_stats');
      const nextTabs: TabKey[] = hasAccess
        ? currentTabs.filter((t) => t !== 'view_stats')
        : [...currentTabs, 'view_stats'];
      await onUpdateAccountPermissions(acc.id, nextTabs);

      // Nếu bật quyền xem và nhân viên chưa lưu wpEmployeeCode trên DB nhưng có mã gợi ý chuẩn thì lưu luôn
      if (!hasAccess && onUpdateAccountInfo && !acc.wpEmployeeCode) {
        const autoCode = resolveAccountWpEmployeeCode(acc);
        if (autoCode) {
          await onUpdateAccountInfo(acc.id, {
            wpEmployeeCode: autoCode,
            wpAllowedEmployeeCodes: acc.wpAllowedEmployeeCodes || ['MINE_AND_SITE'],
          });
        }
      }
    } finally {
      setSavingStaffId(null);
    }
  };

  const handleUpdateStaffWpCode = async (acc: UserAccount, newCode: string) => {
    if (!isAdmin || !onUpdateAccountInfo) return;
    setSavingStaffId(acc.id);
    try {
      const cleanCode = newCode.trim().toUpperCase() || 'NONE';
      await onUpdateAccountInfo(acc.id, {
        wpEmployeeCode: cleanCode,
        wpAllowedEmployeeCodes: acc.wpAllowedEmployeeCodes || ['MINE_AND_SITE'],
      });
    } finally {
      setSavingStaffId(null);
    }
  };

  const handleUpdateStaffWpScopeMode = async (
    acc: UserAccount,
    mode: 'MINE_AND_SITE' | 'MINE_ONLY' | 'ALL'
  ) => {
    if (!isAdmin || !onUpdateAccountInfo) return;
    setSavingStaffId(acc.id);
    try {
      const currentCode = resolveAccountWpEmployeeCode(acc);
      await onUpdateAccountInfo(acc.id, {
        ...(currentCode && !acc.wpEmployeeCode ? { wpEmployeeCode: currentCode } : {}),
        wpAllowedEmployeeCodes: [mode],
      });
    } finally {
      setSavingStaffId(null);
    }
  };

  const handleAutoSyncAllStaffCodesFromWeb = async () => {
    if (!isAdmin || !onUpdateAccountInfo) return;
    setSavingStaffId('ALL');
    try {
      for (const acc of staffAccounts) {
        const matchedCode = resolveAccountWpEmployeeCode(acc);
        if (matchedCode) {
          const currentTabs = getStaffTabs(acc);
          const nextTabs: TabKey[] = currentTabs.includes('view_stats')
            ? currentTabs
            : [...currentTabs, 'view_stats'];
          if (onUpdateAccountPermissions && !currentTabs.includes('view_stats')) {
            await onUpdateAccountPermissions(acc.id, nextTabs);
          }
          await onUpdateAccountInfo(acc.id, {
            wpEmployeeCode: matchedCode,
            wpAllowedEmployeeCodes: acc.wpAllowedEmployeeCodes?.length
              ? acc.wpAllowedEmployeeCodes
              : ['MINE_AND_SITE'],
          });
        }
      }
    } finally {
      setSavingStaffId(null);
    }
  };

  const handleBatchViewStatsAccess = async (grant: boolean) => {
    if (!isAdmin || !onUpdateAccountPermissions) return;
    setSavingStaffId('ALL');
    try {
      for (const acc of staffAccounts) {
        const currentTabs = getStaffTabs(acc);
        const hasAccess = currentTabs.includes('view_stats');
        if (grant && !hasAccess) {
          await onUpdateAccountPermissions(acc.id, [...currentTabs, 'view_stats']);
        } else if (!grant && hasAccess) {
          await onUpdateAccountPermissions(
            acc.id,
            currentTabs.filter((t) => t !== 'view_stats')
          );
        }
      }
    } finally {
      setSavingStaffId(null);
    }
  };

  // Chế độ hiển thị khu vực:
  // - Admin (hoặc NV có quyền ALL): mặc định 'all' (Hiện cả Lưu lượng truy cập + Thống kê theo mã nhân viên)
  // - Nhân viên thường (như tkw-my-stats trên web): chỉ hiển thị 'traffic' (Lưu lượng truy cập của mã nhân viên đó)
  const [viewSection, setViewSection] = useState<'all' | 'traffic' | 'employees'>(
    canSeeAllEmployeesRanking ? 'all' : 'traffic'
  );

  // Filter states khớp 100% với tkw-stats / tkw-my-stats & tkw-employees v3.4 trên celeb24h.com
  const initialScope: 'site' | 'mine' | 'employee' = isAdmin
    ? 'site'
    : viewerEmployeeCode
    ? 'mine'
    : 'site';
  const initialEmployee = isAdmin ? '' : viewerEmployeeCode || '';

  const [range, setRange] = useState<string>('7');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [useCustomDates, setUseCustomDates] = useState<boolean>(false);

  const [scope, setScope] = useState<'site' | 'mine' | 'employee'>(initialScope);
  const [employee, setEmployee] = useState<string>(initialEmployee);

  const [topRange, setTopRange] = useState<string>('7');
  const [topCustomFrom, setTopCustomFrom] = useState<string>('');
  const [topCustomTo, setTopCustomTo] = useState<string>('');

  const [empDays, setEmpDays] = useState<number>(7);
  const [empDetailCode, setEmpDetailCode] = useState<string>(viewerEmployeeCode || 'M2001');
  const [staffTopPeriod, setStaffTopPeriod] = useState<string>('7');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const fmt = (n?: number | null) => Number(n || 0).toLocaleString('en-US');

  // Khi tài khoản hoặc quyền của người xem thay đổi, đảm bảo nhân viên bị khóa về đúng mã của mình
  useEffect(() => {
    if (!canSeeAllEmployeesRanking) {
      setViewSection('traffic');
      if (staffPermissionMode === 'MINE_ONLY' && viewerEmployeeCode) {
        setScope('mine');
        setEmployee(viewerEmployeeCode);
      } else if (viewerEmployeeCode && scope === 'employee' && employee !== viewerEmployeeCode) {
        setScope('mine');
        setEmployee(viewerEmployeeCode);
      }
    }
  }, [canSeeAllEmployeesRanking, staffPermissionMode, viewerEmployeeCode, scope, employee]);

  const fetchDashboard = useCallback(
    async (overrideParams?: {
      range?: string;
      from?: string;
      to?: string;
      useCustom?: boolean;
      scope?: 'site' | 'mine' | 'employee';
      employee?: string;
      topRange?: string;
      topFrom?: string;
      topTo?: string;
      empDays?: number;
      empDetailCode?: string;
      staffTopPeriod?: string;
      silent?: boolean;
    }) => {
      const r = overrideParams?.range ?? range;
      const isCustom = overrideParams?.useCustom ?? useCustomDates;
      const f = overrideParams?.from ?? customFrom;
      const t = overrideParams?.to ?? customTo;

      let nextScope = overrideParams?.scope ?? scope;
      let nextEmp = overrideParams?.employee ?? employee;

      // Bảo vệ phân quyền phía client cho nhân viên
      if (!canSeeAllEmployeesRanking) {
        if (staffPermissionMode === 'MINE_ONLY') {
          nextScope = 'mine';
          nextEmp = viewerEmployeeCode;
        } else if (nextScope === 'mine') {
          nextEmp = viewerEmployeeCode;
        } else if (nextScope === 'employee' && nextEmp !== viewerEmployeeCode) {
          nextScope = 'mine';
          nextEmp = viewerEmployeeCode;
        } else if (nextScope === 'site') {
          nextEmp = '';
        }
      }

      const tr = overrideParams?.topRange ?? topRange;
      const tf = overrideParams?.topFrom ?? topCustomFrom;
      const tt = overrideParams?.topTo ?? topCustomTo;
      const ed = overrideParams?.empDays ?? empDays;
      const edCode = overrideParams?.empDetailCode ?? empDetailCode;
      const stPeriod = overrideParams?.staffTopPeriod ?? staffTopPeriod;

      if (!overrideParams?.silent) {
        setLoading(true);
      }
      setError(null);

      try {
        const q = new URLSearchParams({
          mode: 'dashboard',
          range: r,
          scope: nextScope,
          employee: nextEmp,
          viewer_employee: viewerEmployeeCode || 'A0006',
          top_range: tr,
          emp_days: String(ed),
          emp_detail: edCode,
          staff_top_period: stPeriod,
        });

        if (isCustom && f && t) {
          q.set('from', f);
          q.set('to', t);
        }
        if (tr === 'custom' && tf && tt) {
          q.set('top_from', tf);
          q.set('top_to', tt);
        }

        const res = await fetch(`/api/wp-stats?${q.toString()}`);
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error || 'Không thể tải dữ liệu thống kê từ celeb24h.com');
        }

        const payload = json as WpStatsDashboardPayload;
        setData(payload);
        setActiveLivePage(1);

        if (!customFrom && payload.from) setCustomFrom(payload.from);
        if (!customTo && payload.to) setCustomTo(payload.to);
        if (!topCustomFrom && payload.topFrom) setTopCustomFrom(payload.topFrom);
        if (!topCustomTo && payload.topTo) setTopCustomTo(payload.topTo);
      } catch (err: any) {
        setError(err?.message || 'Lỗi kết nối đến celeb24h.com');
      } finally {
        setLoading(false);
      }
    },
    [
      range,
      useCustomDates,
      customFrom,
      customTo,
      scope,
      employee,
      viewerEmployeeCode,
      canSeeAllEmployeesRanking,
      staffPermissionMode,
      topRange,
      topCustomFrom,
      topCustomTo,
      empDays,
      empDetailCode,
      staffTopPeriod,
    ]
  );

  // Poll realtime panel every 15 seconds just like assets/dashboard.js v3.4 on celeb24h.com
  const pollRealtimeOnly = useCallback(async () => {
    try {
      setRefreshingLive(true);
      const effectiveLiveCode =
        scope === 'mine'
          ? viewerEmployeeCode
          : scope === 'employee'
          ? employee
          : '';
      const effectiveLiveScope =
        scope === 'mine' || (scope === 'employee' && effectiveLiveCode) ? 'employee' : 'site';

      const q = new URLSearchParams({
        mode: 'live',
        live_employee: effectiveLiveCode,
        scope: effectiveLiveScope,
      });
      const res = await fetch(`/api/wp-stats?${q.toString()}`);
      const json = await res.json();
      if (res.ok && json.ok && json.realtime) {
        setData((prev) => (prev ? { ...prev, realtime: json.realtime } : prev));
      }
    } catch {
      // Ignore silent background poll errors
    } finally {
      setRefreshingLive(false);
    }
  }, [scope, employee, viewerEmployeeCode]);

  useEffect(() => {
    const defaultScope: 'site' | 'mine' = isAdmin ? 'site' : viewerEmployeeCode ? 'mine' : 'site';
    const defaultEmp = isAdmin ? '' : viewerEmployeeCode || '';
    const defaultDetailCode =
      viewerEmployeeCode && viewerEmployeeCode !== 'A0006' ? viewerEmployeeCode : 'M2001';
    setScope(defaultScope);
    setEmployee(defaultEmp);
    setEmpDetailCode(defaultDetailCode);
    void fetchDashboard({
      scope: defaultScope,
      employee: defaultEmp,
      empDetailCode: defaultDetailCode,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerEmployeeCode, isAdmin]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void pollRealtimeOnly();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [pollRealtimeOnly]);

  // Draw 30-minute canvas bar chart matching assets/dashboard.js v3.4 from wp-simple-stats
  const drawChart = useCallback((series: WpRealtimeMinute[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(300, rect.width || 640);
    const height = Math.max(195, rect.height || 245);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const pad = { l: 32, r: 8, t: 10, b: 25 };
    const cw = width - pad.l - pad.r;
    const ch = height - pad.t - pad.b;
    ctx.clearRect(0, 0, width, height);

    let mx = 1;
    series.forEach((s) => {
      mx = Math.max(mx, s.views || 0, s.visitors || 0);
    });
    mx = Math.ceil(mx / 5) * 5;

    ctx.font = '11px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.strokeStyle = '#dbe4f1';
    ctx.fillStyle = '#667d9c';

    for (let j = 0; j <= 5; j++) {
      const y = pad.t + ch - (j * ch) / 5;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(width - pad.r, y);
      ctx.stroke();
      ctx.fillText(String(Math.round((mx * j) / 5)), pad.l - 6, y + 3);
    }

    const step = cw / Math.max(series.length, 1);
    const bar = Math.max(2, Math.min(9, step * 0.34));

    series.forEach((s, i) => {
      const x = pad.l + i * step + step * 0.1;
      const v = (ch * (s.views || 0)) / mx;
      const u = (ch * (s.visitors || 0)) / mx;

      ctx.fillStyle = '#47ce89';
      ctx.fillRect(x, pad.t + ch - v, bar, v);

      ctx.fillStyle = '#55b9eb';
      ctx.fillRect(x + bar + 1, pad.t + ch - u, bar, u);

      if (i % 5 === 0) {
        ctx.fillStyle = '#657b97';
        ctx.textAlign = 'center';
        ctx.fillText(s.time, x + bar, pad.t + ch + 17);
      }
    });
  }, []);

  useEffect(() => {
    const minutes = data?.realtime?.minutes || [];
    drawChart(minutes);
    const handleResize = () => drawChart(minutes);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [data?.realtime?.minutes, drawChart, viewSection]);

  const handleSelectRange = (newRange: string) => {
    setRange(newRange);
    setUseCustomDates(false);
    void fetchDashboard({ range: newRange, useCustom: false });
  };

  const handleApplyCustomDateRange = (e: React.FormEvent) => {
    e.preventDefault();
    setUseCustomDates(true);
    void fetchDashboard({ from: customFrom, to: customTo, useCustom: true });
  };

  const handleChangeScope = (newScopeVal: string) => {
    if (newScopeVal === 'site') {
      if (!canSeeSiteWide) return;
      setScope('site');
      setEmployee('');
      void fetchDashboard({ scope: 'site', employee: '' });
    } else if (newScopeVal === 'mine') {
      const myCode = viewerEmployeeCode || 'A0006';
      setScope('mine');
      setEmployee(myCode);
      void fetchDashboard({ scope: 'mine', employee: myCode });
    }
  };

  const handleChangeEmployeeDropdown = (selectedCode: string) => {
    if (!canSeeAllEmployeesRanking) return;
    if (!selectedCode) {
      setScope('site');
      setEmployee('');
      void fetchDashboard({ scope: 'site', employee: '' });
    } else {
      setScope('employee');
      setEmployee(selectedCode);
      setEmpDetailCode(selectedCode);
      void fetchDashboard({
        scope: 'employee',
        employee: selectedCode,
        empDetailCode: selectedCode,
      });
    }
  };

  const handleSelectTopRange = (newTopRange: string) => {
    setTopRange(newTopRange);
    void fetchDashboard({ topRange: newTopRange });
  };

  const handleApplyTopCustomDates = (e: React.FormEvent) => {
    e.preventDefault();
    setTopRange('custom');
    void fetchDashboard({
      topRange: 'custom',
      topFrom: topCustomFrom,
      topTo: topCustomTo,
    });
  };

  const handleSelectEmpDays = (days: number) => {
    setEmpDays(days);
    void fetchDashboard({ empDays: days });
  };

  const handleSelectEmpDetail = (code: string) => {
    const cleanCode = code === '(Không mã)' ? '' : code;
    setEmpDetailCode(cleanCode);
    if (cleanCode && canSeeAllEmployeesRanking) {
      setScope('employee');
      setEmployee(cleanCode);
      void fetchDashboard({
        scope: 'employee',
        employee: cleanCode,
        empDetailCode: cleanCode,
      });
    } else {
      void fetchDashboard({ empDetailCode: cleanCode });
    }
  };

  const handleSelectStaffTopPeriod = (period: string) => {
    setStaffTopPeriod(period);
    void fetchDashboard({ staffTopPeriod: period });
  };

  // Tính toán danh sách bài viết đang active và phân trang (5 bài / trang)
  const activePagesList = data?.realtime?.pages || [];
  const totalLivePages = Math.max(1, Math.ceil(activePagesList.length / livePageSize));
  const safeLivePage = Math.max(1, Math.min(activeLivePage, totalLivePages));
  const pagedActiveRows = activePagesList.slice(
    (safeLivePage - 1) * livePageSize,
    safeLivePage * livePageSize
  );

  const livePageNumbers = useMemo(() => {
    const nums: number[] = [];
    for (let i = 1; i <= totalLivePages; i++) {
      if (i === 1 || i === totalLivePages || Math.abs(i - safeLivePage) <= 1) {
        nums.push(i);
      }
    }
    return nums;
  }, [totalLivePages, safeLivePage]);

  // Mã nhân viên đang hiển thị trên badge Realtime & Link chia sẻ
  const activeDisplayCode =
    scope === 'mine'
      ? viewerEmployeeCode || 'A0006'
      : scope === 'employee' && employee
      ? employee
      : '';

  const personalShareCode = activeDisplayCode || viewerEmployeeCode;

  // Render bảng Top 10 dùng chung cho cả Primary & Secondary Top 10
  const renderTop10Table = (rows: WpTopPostRow[], tablePrefix: string, emptyText: string) => (
    <div className="max-w-full overflow-x-auto mt-2">
      <table className="w-full min-w-[610px] table-fixed border-collapse text-[12px]">
        <thead>
          <tr>
            <th className="w-[40%] text-left py-3 px-3.5 bg-[#f5f7fa] text-[#586980] text-[11px] font-bold tracking-[0.15px] border-b border-[#e4ebf3]">
              Bài viết / trang
            </th>
            <th className="w-[46%] text-left py-3 px-3.5 bg-[#f5f7fa] text-[#586980] text-[11px] font-bold tracking-[0.15px] border-b border-[#e4ebf3]">
              Link / Sao chép
            </th>
            <th className="w-[14%] text-right py-3 px-3.5 bg-[#f5f7fa] text-[#586980] text-[11px] font-bold tracking-[0.15px] border-b border-[#e4ebf3]">
              Lượt xem
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3} className="py-3.5 px-3.5 text-[#5d6b82] border-b border-[#edf1f6]">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((r, idx) => {
              const copyKey = `${tablePrefix}-${idx}`;
              const isCopied = copiedUrlKey === copyKey;
              return (
                <tr
                  key={`${r.title}-${idx}`}
                  className="even:bg-white hover:bg-[#f8fbff] transition-colors"
                >
                  <td className="py-2.5 px-3.5 border-b border-[#edf1f6] font-semibold text-[#17263e] wrap-anywhere align-middle">
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#17263e] hover:text-[#2271b1] hover:underline"
                      >
                        {r.title}
                      </a>
                    ) : (
                      r.title
                    )}
                  </td>
                  <td className="py-2.5 px-3.5 border-b border-[#edf1f6] align-middle">
                    {r.url ? (
                      <div className="flex items-center gap-1.5 min-w-0 flex-nowrap">
                        <input
                          aria-label="Link bài viết"
                          type="text"
                          readOnly
                          value={r.url}
                          onFocus={(e) => e.currentTarget.select()}
                          className="flex-1 min-w-0 w-full h-8 bg-[#f6f8fc] border border-[#dce5ee] rounded-md text-[11px] text-[#48607d] px-2 text-ellipsis"
                        />
                        <button
                          type="button"
                          onClick={() => handleCopyUrl(r.url, copyKey)}
                          className={`border rounded-md text-[11px] font-semibold min-h-[30px] px-2.5 whitespace-nowrap cursor-pointer transition-colors ${
                            isCopied
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-white border-[#cbd7e8] text-[#244e9c] hover:bg-[#eef4ff] hover:border-[#aec6ed]'
                          }`}
                        >
                          {isCopied ? '✓ Đã copy' : 'Copy'}
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3.5 border-b border-[#edf1f6] text-right font-bold tabular-nums text-[#17263e] align-middle">
                    {fmt(r.views)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4 pb-8">
      {/* Thanh chuyển đổi chế độ xem & Quản lý phân quyền theo mã nhân viên */}
      <div className="bg-white border border-[#d8e0ec] rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          {canSeeAllEmployeesRanking ? (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setViewSection('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  viewSection === 'all'
                    ? 'bg-[#2271b1] text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-white'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Tất cả (Lưu lượng + Xếp hạng Mã NV)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewSection('traffic')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  viewSection === 'traffic'
                    ? 'bg-[#2271b1] text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Lưu lượng truy cập</span>
              </button>
              <button
                type="button"
                onClick={() => setViewSection('employees')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  viewSection === 'employees'
                    ? 'bg-[#2271b1] text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Thống kê theo mã nhân viên</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#eef3fa] text-[#17263e] border border-[#dce5ef]">
                <Tag className="w-3.5 h-3.5 text-[#2271b1]" />
                <span>
                  Tài khoản: <strong>{currentUser?.name}</strong> · Mã nhân viên Web:{' '}
                  <strong className="text-[#2271b1]">
                    {viewerEmployeeCode || 'Chưa gán mã'}
                  </strong>
                </span>
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && onUpdateAccountPermissions && (
            <button
              type="button"
              onClick={() => setShowPermissionPanel((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                showPermissionPanel
                  ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-2xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
              }`}
              title="Phân quyền nhân viên xem Bảng 10 và gán Mã Nhân Viên theo web celeb24h.com"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>
                Phân Quyền & Gán Mã NV ({allowedViewStatsCount}/{staffAccounts.length} NV)
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void fetchDashboard()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#2271b1] hover:bg-[#135e96] text-white transition-colors cursor-pointer disabled:opacity-60"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading || refreshingLive ? 'animate-spin' : ''}`}
            />
            <span>{loading ? 'Đang đồng bộ...' : 'Làm mới dữ liệu'}</span>
          </button>

          {isAdmin && (
            <a
              href="https://celeb24h.com/wp-admin/admin.php?page=tkw-stats"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#2271b1] bg-[#f0f6fc] hover:bg-[#e5f0fa] border border-[#c5d9ed] transition-colors"
            >
              <span>WP Admin</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* BẢNG PHÂN QUYỀN & GÁN MÃ NHÂN VIÊN THEO WEB CELEB24H.COM (CHỈ ADMIN) */}
      {isAdmin && showPermissionPanel && (
        <div className="bg-white border-2 border-amber-300 rounded-xl p-4 shadow-xs space-y-3.5 animate-fadeIn">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 flex-wrap">
                <Shield className="w-4 h-4 text-amber-600" />
                <span>Phân Quyền Theo Mã Nhân Viên Như Trên Web (celeb24h.com)</span>
                <span className="text-[11px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200 px-2.5 py-0.5 rounded-full">
                  Đang mở bảng: {allowedViewStatsCount}/{staffAccounts.length} nhân viên
                </span>
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Mỗi nhân viên được gắn <strong>Mã nhân viên</strong> tương ứng trên web (VD:{' '}
                <code className="bg-slate-100 px-1 rounded font-bold text-cyan-800">
                  MS.LY → M2001
                </code>
                ,{' '}
                <code className="bg-slate-100 px-1 rounded font-bold text-cyan-800">
                  MS.HUYEN → H2000
                </code>
                ,{' '}
                <code className="bg-slate-100 px-1 rounded font-bold text-cyan-800">
                  MSHIEP → H0088
                </code>
                ,{' '}
                <code className="bg-slate-100 px-1 rounded font-bold text-cyan-800">
                  MS.NHI → A0005
                </code>
                ). Khi nhân viên đăng nhập vào app, họ sẽ xem đúng giao diện thống kê của mã nhân viên đó giống hệt trên web WordPress!
              </p>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap shrink-0">
              {onUpdateAccountInfo && (
                <button
                  type="button"
                  disabled={savingStaffId !== null}
                  onClick={() => void handleAutoSyncAllStaffCodesFromWeb()}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-2xs"
                  title="Tự động gán mã M2001 (MS.LY), H2000 (MS.HUYEN), H0088 (MSHIEP), A0005 (MS.NHI) và bật quyền xem cho các nhân viên có mã trên web"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Đồng bộ chuẩn Mã NV từ Web</span>
                </button>
              )}
              <button
                type="button"
                disabled={savingStaffId !== null}
                onClick={() => void handleBatchViewStatsAccess(true)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer disabled:opacity-50"
              >
                ✓ Mở xem cho tất cả NV
              </button>
              <button
                type="button"
                disabled={savingStaffId !== null}
                onClick={() => void handleBatchViewStatsAccess(false)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer disabled:opacity-50"
              >
                ✕ Ẩn khỏi tất cả NV
              </button>
            </div>
          </div>

          {staffAccounts.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Chưa có tài khoản nhân viên nào.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {staffAccounts.map((acc) => {
                const hasAccess = getStaffTabs(acc).includes('view_stats');
                const resolvedCode = resolveAccountWpEmployeeCode(acc);
                const permCodes = acc.wpAllowedEmployeeCodes || ['MINE_AND_SITE'];
                const currentScopeMode: 'MINE_AND_SITE' | 'MINE_ONLY' | 'ALL' = permCodes.includes(
                  'ALL'
                )
                  ? 'ALL'
                  : permCodes.includes('MINE_ONLY')
                  ? 'MINE_ONLY'
                  : 'MINE_AND_SITE';
                const isSavingThis = savingStaffId === acc.id || savingStaffId === 'ALL';
                const customInputVal = customCodeInputs[acc.id] ?? '';

                return (
                  <div
                    key={acc.id}
                    className={`p-3 rounded-xl border transition-all space-y-2.5 ${
                      hasAccess
                        ? 'bg-cyan-50/60 border-cyan-400 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 opacity-85'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-black text-xs text-slate-900 flex items-center gap-1.5 flex-wrap">
                          <span>{acc.username}</span>
                          {resolvedCode ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-cyan-700 text-white">
                              Mã: {resolvedCode}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-200 text-slate-600">
                              Chưa gán mã
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {acc.email || 'Chưa gán Gmail'}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isSavingThis}
                        onClick={() => void handleToggleStaffViewStats(acc)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black shrink-0 cursor-pointer transition-colors ${
                          hasAccess
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                        }`}
                      >
                        {hasAccess ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Được xem B10</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            <span>Đang ẩn B10</span>
                          </>
                        )}
                      </button>
                    </div>

                    {onUpdateAccountInfo && (
                      <div className="pt-2 border-t border-slate-200/80 space-y-2">
                        {/* Chọn mã nhân viên từ danh sách web hoặc tự nhập */}
                        <div className="flex items-center gap-1.5">
                          <label className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
                            Mã NV Web:
                          </label>
                          <select
                            value={resolvedCode}
                            disabled={isSavingThis}
                            onChange={(e) => void handleUpdateStaffWpCode(acc, e.target.value)}
                            className="flex-1 min-w-0 px-2 py-1 text-xs font-bold border border-slate-300 rounded-lg bg-white text-slate-900 cursor-pointer"
                          >
                            <option value="">-- Chưa gán mã --</option>
                            {allEmployeeOptions.map((opt) => (
                              <option key={opt.code} value={opt.code}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Ô nhập nhanh mã nhân viên mới nếu nhân viên mới được tạo trên web */}
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="Hoặc nhập mã NV mới (VD: B0001)..."
                            value={customInputVal}
                            onChange={(e) =>
                              setCustomCodeInputs((prev) => ({
                                ...prev,
                                [acc.id]: e.target.value.toUpperCase(),
                              }))
                            }
                            className="flex-1 min-w-0 px-2 py-1 text-[11px] border border-slate-300 rounded-lg bg-white text-slate-800"
                          />
                          <button
                            type="button"
                            disabled={isSavingThis || !customInputVal.trim()}
                            onClick={() => {
                              void handleUpdateStaffWpCode(acc, customInputVal);
                              setCustomCodeInputs((prev) => ({ ...prev, [acc.id]: '' }));
                            }}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-900 text-white cursor-pointer disabled:opacity-40"
                          >
                            Lưu mã
                          </button>
                        </div>

                        {/* Chọn chế độ phạm vi xem cho nhân viên */}
                        <div className="flex items-center gap-1 flex-wrap pt-0.5">
                          <span className="text-[10px] font-bold text-slate-500 mr-1">
                            Quyền xem:
                          </span>
                          {[
                            {
                              key: 'MINE_AND_SITE' as const,
                              label: 'Mã riêng + Toàn web (Như Web)',
                            },
                            {
                              key: 'MINE_ONLY' as const,
                              label: 'Chỉ khóa Mã riêng',
                            },
                            {
                              key: 'ALL' as const,
                              label: 'Tất cả Mã & Xếp hạng',
                            },
                          ].map((m) => (
                            <button
                              key={m.key}
                              type="button"
                              disabled={isSavingThis}
                              onClick={() => void handleUpdateStaffWpScopeMode(acc, m.key)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
                                currentScopeMode === m.key
                                  ? 'bg-[#2271b1] border-[#2271b1] text-white'
                                  : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between text-rose-800 text-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void fetchDashboard()}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* =====================================================================
          PHẦN 1: GIAO DIỆN NGUYÊN BẢN "LƯU LƯỢNG TRUY CẬP" (tkw-modern v3.4)
         ===================================================================== */}
      {(viewSection === 'all' || viewSection === 'traffic') && (
        <div className="bg-[#f3f6fb] border border-[#d8e0ec] rounded-[14px] p-[18px] text-[#17263e]">
          {/* Header (.tkw-head): 📈 Lưu lượng truy cập + celeb24h.com */}
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <h1 className="m-0 text-[23px] tracking-[-0.6px] font-bold text-[#17263e] flex items-center gap-2">
              <span>📈 Lưu lượng truy cập</span>
            </h1>
            <span className="bg-[#eef3fa] text-[#385270] px-2.5 py-1 rounded-md font-semibold text-[13px]">
              celeb24h.com
            </span>
          </div>

          {/* Bộ lọc chính (.tkw-filters) */}
          <form
            onSubmit={handleApplyCustomDateRange}
            className="flex flex-wrap gap-[9px] items-center my-3.5 bg-white px-4 py-3.5 rounded-[12px] border border-[#dde5f0]"
          >
            {[
              { key: '1', label: 'Hôm nay' },
              { key: 'yesterday', label: 'Hôm qua' },
              { key: '7', label: '7 ngày' },
              { key: '30', label: '30 ngày' },
              { key: '90', label: '90 ngày' },
            ].map((btn) => {
              const isCurrent = range === btn.key && !useCustomDates;
              return (
                <button
                  key={btn.key}
                  type="button"
                  onClick={() => handleSelectRange(btn.key)}
                  className={`min-h-[34px] px-3 rounded-[8px] text-[13px] font-semibold border transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-[#2271b1] border-[#2271b1] text-white'
                      : 'bg-[#f6f7f7] border-[#2271b1] text-[#2271b1] hover:bg-[#f0f6fc]'
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}

            <div className="flex items-center gap-1.5 flex-wrap">
              <input
                aria-label="Từ ngày"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="min-h-[36px] px-2.5 py-1 text-[13px] border border-[#8c8f94] rounded-[8px] bg-white text-[#2c3338]"
              />
              <span className="text-[#5d6b82]">→</span>
              <input
                aria-label="Đến ngày"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="min-h-[36px] px-2.5 py-1 text-[13px] border border-[#8c8f94] rounded-[8px] bg-white text-[#2c3338]"
              />
              <button
                type="submit"
                className="min-h-[34px] px-3 rounded-[8px] text-[13px] font-semibold border border-[#2271b1] bg-[#f6f7f7] text-[#2271b1] hover:bg-[#f0f6fc] cursor-pointer"
              >
                Xem
              </button>
            </div>

            <label
              htmlFor="tkw-scope-select"
              className="text-[12px] font-bold text-[#596b81] ml-1"
            >
              Chế độ xem:
            </label>
            <select
              id="tkw-scope-select"
              value={scope === 'employee' ? 'site' : scope}
              onChange={(e) => handleChangeScope(e.target.value)}
              className="min-h-[36px] max-w-[320px] px-2.5 py-1 text-[13px] border border-[#8c8f94] rounded-[8px] bg-white text-[#2c3338] cursor-pointer"
            >
              {canSeeSiteWide && (
                <option value="site">Toàn website (domain gốc + mọi subdomain)</option>
              )}
              {(viewerEmployeeCode || isAdmin) && (
                <option value="mine">
                  Thống kê của tôi · {viewerEmployeeCode || 'A0006'}
                </option>
              )}
            </select>

            {canSeeAllEmployeesRanking && (
              <select
                aria-label="Chọn nhân viên"
                value={scope === 'employee' ? employee : ''}
                onChange={(e) => handleChangeEmployeeDropdown(e.target.value)}
                className="min-h-[36px] max-w-[320px] px-2.5 py-1 text-[13px] border border-[#8c8f94] rounded-[8px] bg-white text-[#2c3338] cursor-pointer"
              >
                <option value="">Chọn nhân viên riêng</option>
                {allEmployeeOptions.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          </form>

          <p className="text-[#5d6b82] text-[13px] leading-[1.6] mt-2.5 mb-3.5 mx-0.5">
            Khoảng: {data?.from || customFrom || '...'} – {data?.to || customTo || '...'} · Múi giờ{' '}
            {data?.timezone || '+00:00'}. Cả Realtime, tổng hợp và Top 10 theo chế độ xem đã chọn.
            Toàn website gồm cả truy cập không mã. Tài khoản quản trị không được ghi nhận.
          </p>

          {/* Khu vực 🟢 Realtime (.tkw-realtime v3.4) */}
          <section className="bg-white border border-[#dfe6ef] rounded-[12px] p-[18px]">
            <div className="flex justify-between items-center gap-3 flex-wrap pb-3.5 border-b border-[#edf1f5]">
              <h2 className="m-0 text-[17px] font-bold text-[#17263e] flex items-center gap-[7px]">
                <span>🟢 Realtime</span>
              </h2>

              <span className="bg-[#eef3fa] text-[#385270] font-semibold text-[11px] px-2.5 py-1 rounded-md">
                {activeDisplayCode ? `Mã: ${activeDisplayCode}` : 'Toàn website'}
              </span>

              <span className="bg-[#f6f9fc] text-[#5d6b82] text-[12px] px-2.5 py-1 rounded-md">
                cập nhật lúc {data?.realtime?.updated || '--:--:--'} · mỗi 15 giây
              </span>
            </div>

            {/* 3 Ô Counters (.tkw-counters) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3.5">
              <div
                className="rounded-[10px] px-[17px] py-4 border border-[#e0e8f1] bg-white"
                style={{ borderTop: '3px solid #1cc865' }}
              >
                <span className="block text-[11px] text-[#42526b] font-semibold">
                  Đang online (5 phút)
                </span>
                <strong
                  className="block text-[28px] tracking-[-0.8px] leading-[1.15] mt-1.5 font-bold"
                  style={{ color: '#1cc865' }}
                >
                  {fmt(data?.realtime?.online)}
                </strong>
              </div>

              <div
                className="rounded-[10px] px-[17px] py-4 border border-[#e0e8f1] bg-white"
                style={{ borderTop: '3px solid #5342dc' }}
              >
                <span className="block text-[11px] text-[#42526b] font-semibold">
                  Hôm nay · Lượt xem
                </span>
                <strong
                  className="block text-[28px] tracking-[-0.8px] leading-[1.15] mt-1.5 font-bold"
                  style={{ color: '#5342dc' }}
                >
                  {fmt(data?.realtime?.today_views)}
                </strong>
              </div>

              <div
                className="rounded-[10px] px-[17px] py-4 border border-[#e0e8f1] bg-white"
                style={{ borderTop: '3px solid #169ce8' }}
              >
                <span className="block text-[11px] text-[#42526b] font-semibold">
                  Hôm nay · Khách
                </span>
                <strong
                  className="block text-[28px] tracking-[-0.8px] leading-[1.15] mt-1.5 font-bold"
                  style={{ color: '#169ce8' }}
                >
                  {fmt(data?.realtime?.today_visitors)}
                </strong>
              </div>
            </div>

            {/* Biểu đồ 30 phút & Bảng khách đang xem gì (.tkw-realgap) */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-3.5 mt-[15px]">
              <div className="bg-white border border-[#dde5f0] rounded-[12px] p-[18px]">
                <h3 className="m-0 mb-3 text-[15px] tracking-[-0.2px] font-bold text-[#17263e]">
                  🔵 Lượt xem 30 phút qua (theo phút)
                </h3>
                <canvas
                  ref={canvasRef}
                  className="w-full h-[245px] block"
                  aria-label="Biểu đồ lượt xem và khách 30 phút"
                  role="img"
                />
                <div className="flex gap-4 text-[12px] text-[#55657d] mt-2.5">
                  <span className="inline-flex items-center">
                    <i
                      className="inline-block w-2.5 h-2.5 rounded-xs mr-1.5"
                      style={{ background: '#47ce89' }}
                    />
                    Lượt xem
                  </span>
                  <span className="inline-flex items-center">
                    <i
                      className="inline-block w-2.5 h-2.5 rounded-xs mr-1.5"
                      style={{ background: '#55b9eb' }}
                    />
                    Khách
                  </span>
                </div>
              </div>

              <div className="bg-white border border-[#dde5f0] rounded-[12px] p-[18px] flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center gap-2 mb-3">
                    <h3 className="m-0 text-[15px] tracking-[-0.2px] font-bold text-[#17263e]">
                      🔵 Khách đang xem gì
                    </h3>
                    <span className="text-[12px] text-[#5d6b82]">5 bài / trang</span>
                  </div>

                  <div className="max-w-full overflow-x-auto">
                    <table className="w-full min-w-[490px] table-fixed border-collapse text-[12px]">
                      <thead>
                        <tr>
                          <th className="w-[52%] text-left py-3 px-3 bg-[#f5f7fa] text-[#586980] text-[11px] font-bold border-b border-[#e4ebf3]">
                            BÀI VIẾT
                          </th>
                          <th className="w-[36%] text-left py-3 px-3 bg-[#f5f7fa] text-[#586980] text-[11px] font-bold border-b border-[#e4ebf3]">
                            LINK BÀI VIẾT / COPY
                          </th>
                          <th className="w-[12%] text-right py-3 px-3 bg-[#f5f7fa] text-[#586980] text-[11px] font-bold border-b border-[#e4ebf3]">
                            KHÁCH
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedActiveRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={3}
                              className="py-3.5 px-3 text-[#5d6b82] border-b border-[#edf1f6]"
                            >
                              Chưa có khách hoạt động
                            </td>
                          </tr>
                        ) : (
                          pagedActiveRows.map((p, idx) => {
                            const copyKey = `live-${safeLivePage}-${idx}`;
                            const isCopied = copiedUrlKey === copyKey;
                            return (
                              <tr
                                key={`${p.title}-${idx}`}
                                className="even:bg-white hover:bg-[#f8fbff]"
                              >
                                <td className="py-2.5 px-3 border-b border-[#edf1f6] text-[#17263e] font-semibold wrap-anywhere align-middle">
                                  {p.url ? (
                                    <a
                                      href={p.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[#17263e] hover:text-[#2271b1] hover:underline"
                                    >
                                      {p.title}
                                    </a>
                                  ) : (
                                    p.title
                                  )}
                                </td>
                                <td className="py-2.5 px-3 border-b border-[#edf1f6] align-middle">
                                  {p.url ? (
                                    <div className="flex items-center gap-1.5 min-w-0 flex-nowrap">
                                      <input
                                        aria-label="Link bài viết"
                                        type="text"
                                        readOnly
                                        value={p.url}
                                        onFocus={(e) => e.currentTarget.select()}
                                        className="flex-1 min-w-0 w-full h-8 bg-[#f6f8fc] border border-[#dce5ee] rounded-md text-[11px] text-[#48607d] px-2 text-ellipsis"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleCopyUrl(p.url, copyKey)}
                                        className={`border rounded-md text-[11px] font-semibold min-h-[30px] px-2.5 whitespace-nowrap cursor-pointer transition-colors ${
                                          isCopied
                                            ? 'bg-emerald-600 border-emerald-600 text-white'
                                            : 'bg-white border-[#cbd7e8] text-[#244e9c] hover:bg-[#eef4ff] hover:border-[#aec6ed]'
                                        }`}
                                      >
                                        {isCopied ? '✓ Đã copy' : 'Copy'}
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 border-b border-[#edf1f6] text-right font-bold tabular-nums text-[#17263e] align-middle">
                                  {fmt(p.count)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Thanh phân trang Khách đang xem gì (.tkw-live-pagination) */}
                {activePagesList.length > livePageSize && (
                  <nav
                    aria-label="Phân trang khách đang xem"
                    className="flex justify-between items-center gap-3 flex-wrap mt-3 pt-3 border-t border-[#edf1f5] text-[#64748b] text-[12px]"
                  >
                    <span>
                      Hiển thị {(safeLivePage - 1) * livePageSize + 1}–
                      {Math.min(safeLivePage * livePageSize, activePagesList.length)} /{' '}
                      {activePagesList.length} bài
                    </span>
                    <div className="flex gap-1.5 items-center flex-wrap">
                      <button
                        type="button"
                        disabled={safeLivePage === 1}
                        onClick={() => setActiveLivePage((p) => Math.max(1, p - 1))}
                        className="min-w-[32px] h-8 px-2.5 border border-[#dce5ef] rounded-[7px] bg-white text-[#294766] text-[12px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f8fbff]"
                      >
                        ‹ Trước
                      </button>
                      <span className="flex gap-1 items-center">
                        {livePageNumbers.map((n, idx) => {
                          const prev = livePageNumbers[idx - 1];
                          const showDots = prev && n - prev > 1;
                          return (
                            <React.Fragment key={n}>
                              {showDots && <span className="px-0.5 text-[#64748b]">…</span>}
                              <button
                                type="button"
                                onClick={() => setActiveLivePage(n)}
                                className={`min-w-[32px] h-8 px-2.5 border rounded-[7px] text-[12px] cursor-pointer ${
                                  n === safeLivePage
                                    ? 'bg-[#2a59c7] border-[#2a59c7] text-white font-semibold'
                                    : 'bg-white border-[#dce5ef] text-[#294766] hover:bg-[#f8fbff]'
                                }`}
                              >
                                {n}
                              </button>
                            </React.Fragment>
                          );
                        })}
                      </span>
                      <button
                        type="button"
                        disabled={safeLivePage === totalLivePages}
                        onClick={() => setActiveLivePage((p) => Math.min(totalLivePages, p + 1))}
                        className="min-w-[32px] h-8 px-2.5 border border-[#dce5ef] rounded-[7px] bg-white text-[#294766] text-[12px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f8fbff]"
                      >
                        Sau ›
                      </button>
                    </div>
                  </nav>
                )}
              </div>
            </div>
          </section>

          {/* KHU VỰC DƯỚI (.tkw-below v3.4): Tổng hợp truy cập + Top 10 chính + Top 10 phụ + Theo ngày */}
          <div className="grid grid-cols-1 gap-3.5 mt-3.5">
            {/* 1. Tổng hợp truy cập (.tkw-whitepanel.tkw-summary) */}
            <div className="bg-white border border-[#dde5f0] rounded-[12px] p-[18px]">
              <div className="flex items-center justify-between gap-2.5 flex-wrap mb-[15px]">
                <h3 className="m-0 text-[15px] tracking-[-0.2px] font-bold text-[#17263e]">
                  Tổng hợp truy cập
                </h3>
                <span className="text-[12px] text-[#64748b]">
                  {data?.from || ''} – {data?.to || ''}
                </span>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="flex flex-col gap-2 border border-[#e5eaf1] rounded-[10px] px-4 py-[13px] bg-[#f8fafc]">
                  <span className="text-[15px]">👁</span>
                  <span className="text-[12px] text-[#526781]">Lượt xem</span>
                  <strong className="text-[24px] tracking-[-0.5px] leading-[1.3] text-[#162943]">
                    {fmt(data?.summary?.views)}
                  </strong>
                </div>
                <div className="flex flex-col gap-2 border border-[#e5eaf1] rounded-[10px] px-4 py-[13px] bg-[#f8fafc]">
                  <span className="text-[15px]">👥</span>
                  <span className="text-[12px] text-[#526781]">Khách duy nhất</span>
                  <strong className="text-[24px] tracking-[-0.5px] leading-[1.3] text-[#162943]">
                    {fmt(data?.summary?.visitors)}
                  </strong>
                </div>
                <div className="flex flex-col gap-2 border border-[#e5eaf1] rounded-[10px] px-4 py-[13px] bg-[#f8fafc]">
                  <span className="text-[15px]">✦</span>
                  <span className="text-[12px] text-[#526781]">Khách mới</span>
                  <strong className="text-[24px] tracking-[-0.5px] leading-[1.3] text-[#162943]">
                    {fmt(data?.summary?.newcomers)}
                  </strong>
                </div>
                <div className="flex flex-col gap-2 border border-[#e5eaf1] rounded-[10px] px-4 py-[13px] bg-[#f8fafc]">
                  <span className="text-[15px]">↩</span>
                  <span className="text-[12px] text-[#526781]">Quay lại</span>
                  <strong className="text-[24px] tracking-[-0.5px] leading-[1.3] text-[#162943]">
                    {fmt(data?.summary?.returning)}
                  </strong>
                </div>
              </div>
            </div>

            {/* 2. Bảng Top 10 chính (.tkw-whitepanel.tkw-top10) */}
            <div className="bg-white border border-[#dde5f0] rounded-[12px] p-[18px]">
              <div className="flex items-center justify-between gap-2.5 flex-wrap mb-3.5">
                <h3 className="m-0 text-[15px] tracking-[-0.2px] font-bold text-[#17263e]">
                  {data?.primaryTopPanel?.heading ||
                    (activeDisplayCode
                      ? `Top 10 bài viết / trang của nhân viên mã ${activeDisplayCode}`
                      : 'Top 10 bài viết / trang toàn website')}
                </h3>
                <span className="text-[12px] text-[#64748b]">
                  {data?.primaryTopPanel?.subtitle || 'Xếp theo lượt xem'}
                </span>
              </div>

              <div className="flex flex-wrap gap-[7px] items-center my-2 mb-4">
                {[
                  { key: '1', label: 'Hôm nay' },
                  { key: 'yesterday', label: 'Hôm qua' },
                  { key: '7', label: '7 ngày' },
                  { key: '30', label: '30 ngày' },
                  { key: '90', label: '90 ngày' },
                ].map((btn) => (
                  <button
                    key={btn.key}
                    type="button"
                    onClick={() => handleSelectTopRange(btn.key)}
                    className={`px-3 min-h-[31px] rounded-[7px] text-[12px] font-semibold border cursor-pointer ${
                      topRange === btn.key
                        ? 'bg-[#2271b1] border-[#2271b1] text-white'
                        : 'bg-[#f6f7f7] border-[#2271b1] text-[#2271b1] hover:bg-[#f0f6fc]'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}

                <form
                  onSubmit={handleApplyTopCustomDates}
                  className="flex flex-wrap gap-2 items-center ml-1"
                >
                  <label className="inline-flex items-center gap-1.5 text-[12px] text-[#42526b]">
                    Từ
                    <input
                      type="date"
                      value={topCustomFrom}
                      onChange={(e) => setTopCustomFrom(e.target.value)}
                      required
                      className="max-w-[140px] min-h-[31px] px-2 py-0.5 text-[12px] border border-[#8c8f94] rounded-[7px] bg-white"
                    />
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-[12px] text-[#42526b]">
                    Đến
                    <input
                      type="date"
                      value={topCustomTo}
                      onChange={(e) => setTopCustomTo(e.target.value)}
                      required
                      className="max-w-[140px] min-h-[31px] px-2 py-0.5 text-[12px] border border-[#8c8f94] rounded-[7px] bg-white"
                    />
                  </label>
                  <button
                    type="submit"
                    className={`px-3 min-h-[31px] rounded-[7px] text-[12px] font-semibold border cursor-pointer ${
                      topRange === 'custom'
                        ? 'bg-[#2271b1] border-[#2271b1] text-white'
                        : 'bg-[#f6f7f7] border-[#2271b1] text-[#2271b1] hover:bg-[#f0f6fc]'
                    }`}
                  >
                    Xem
                  </button>
                </form>
              </div>

              <p className="text-[#5d6b82] text-[12px] mt-0 mb-3">
                {data?.primaryTopPanel?.mutedText ||
                  `Thống kê từ ${data?.topFrom || topCustomFrom || '...'} đến ${
                    data?.topTo || topCustomTo || '...'
                  } (giữ dữ liệu chi tiết 90 ngày). ${
                    activeDisplayCode
                      ? `Mã nhân viên: ${activeDisplayCode}`
                      : 'Toàn website, bao gồm truy cập không mã'
                  }`}
              </p>

              {renderTop10Table(
                data?.primaryTopPanel?.rows || data?.topPosts || [],
                'primary-top10',
                'Chưa có dữ liệu'
              )}
            </div>

            {/* 3. Bảng Top 10 phụ (.tkw-whitepanel.tkw-top10.tkw-top-secondary) - Luôn hiển thị để thấy đủ cả bài của nhân viên & bài tổng thể toàn website */}
            {data?.secondaryTopPanel && (
              <div
                className="bg-white border border-[#dde5f0] rounded-[12px] p-[18px]"
                style={{ borderLeft: '3px solid #3b82f6' }}
              >
                <div className="flex items-center justify-between gap-2.5 flex-wrap mb-2">
                  <h3 className="m-0 text-[15px] tracking-[-0.2px] font-bold text-[#17263e]">
                    {data.secondaryTopPanel.heading}
                  </h3>
                  <span className="text-[12px] text-[#64748b]">
                    {data.secondaryTopPanel.subtitle}
                  </span>
                </div>

                {data.secondaryTopPanel.mutedText && (
                  <p className="text-[#5d6b82] text-[12px] mt-0 mb-3">
                    {data.secondaryTopPanel.mutedText}
                  </p>
                )}

                {renderTop10Table(
                  data.secondaryTopPanel.rows,
                  'secondary-top10',
                  'Chưa có dữ liệu trong khoảng thời gian này.'
                )}
              </div>
            )}

            {/* 4. Bảng Theo ngày (.tkw-whitepanel.tkw-daily) */}
            <div className="bg-white border border-[#dde5f0] rounded-[12px] p-[18px]">
              <h3 className="m-0 mb-3 text-[15px] tracking-[-0.2px] font-bold text-[#17263e]">
                Theo ngày
              </h3>
              <div className="max-w-full overflow-x-auto">
                <table className="w-full min-w-[350px] border-collapse text-[12px]">
                  <thead>
                    <tr>
                      <th className="text-left py-3 px-3.5 bg-[#f5f7fa] text-[#586980] text-[11px] font-bold border-b border-[#e4ebf3]">
                        Ngày
                      </th>
                      <th className="text-right py-3 px-3.5 bg-[#f5f7fa] text-[#586980] text-[11px] font-bold border-b border-[#e4ebf3]">
                        Lượt xem
                      </th>
                      <th className="text-right py-3 px-3.5 bg-[#f5f7fa] text-[#586980] text-[11px] font-bold border-b border-[#e4ebf3]">
                        Khách
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.daily || []).length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="py-3.5 px-3.5 text-[#5d6b82] border-b border-[#edf1f6]"
                        >
                          Chưa có dữ liệu
                        </td>
                      </tr>
                    ) : (
                      (data?.daily || []).map((r) => (
                        <tr
                          key={r.day}
                          className="even:bg-white hover:bg-[#f8fbff] transition-colors"
                        >
                          <td className="py-2.5 px-3.5 border-b border-[#edf1f6] text-[#17263e]">
                            {r.day}
                          </td>
                          <td className="py-2.5 px-3.5 border-b border-[#edf1f6] text-right font-bold tabular-nums text-[#17263e]">
                            {fmt(r.views)}
                          </td>
                          <td className="py-2.5 px-3.5 border-b border-[#edf1f6] text-right font-bold tabular-nums text-[#17263e]">
                            {fmt(r.visitors)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5. Ô "Link chia sẻ của tôi" (Giống hệt tkw-my-stats trên WordPress celeb24h.com) */}
            {personalShareCode && (
              <div className="bg-white border border-[#dde5f0] rounded-[12px] p-[18px]">
                <h3 className="m-0 mb-3 text-[15px] tracking-[-0.2px] font-bold text-[#17263e]">
                  Link chia sẻ của tôi
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`https://celeb24h.com/?${personalShareCode}`}
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-full sm:w-[360px] h-9 px-3 text-[13px] border border-[#8c8f94] rounded-[8px] bg-[#f6f8fc] text-[#17263e] font-medium"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyUrl(
                        `https://celeb24h.com/?${personalShareCode}`,
                        'personal-share-url'
                      )
                    }
                    className={`min-h-[36px] px-3.5 rounded-[8px] text-[13px] font-semibold border cursor-pointer transition-colors inline-flex items-center gap-1.5 ${
                      copiedUrlKey === 'personal-share-url'
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-[#f6f7f7] border-[#2271b1] text-[#2271b1] hover:bg-[#f0f6fc]'
                    }`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>
                      {copiedUrlKey === 'personal-share-url' ? '✓ Đã sao chép' : 'Sao chép'}
                    </span>
                  </button>
                </div>
                <p className="text-[#5d6b82] text-[12px] mt-2 mb-0">
                  Khi bạn mở bài viết, nút sao chép link ngay dưới bài sẽ tự thêm mã{' '}
                  <strong>{personalShareCode}</strong>.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          PHẦN 2: GIAO DIỆN NGUYÊN BẢN "THỐNG KÊ THEO MÃ NHÂN VIÊN" (tkw-employees v2.9+)
          (Chỉ hiển thị cho Admin hoặc nhân viên được cấp quyền xem tất cả mã)
         ===================================================================== */}
      {canSeeAllEmployeesRanking && (viewSection === 'all' || viewSection === 'employees') && (
        <div className="bg-[#f0f0f1] border border-[#c3c4c7] rounded-[14px] p-5 text-[#1d2327]">
          <h1 className="text-[23px] font-normal m-0 mb-2 text-[#1d2327]">
            Thống kê theo mã nhân viên
          </h1>
          <p className="text-[13px] text-[#3c434a] my-2">
            Link mẫu:{' '}
            <code className="bg-white px-1.5 py-0.5 rounded border border-[#dcdcde] text-[12px]">
              https://celeb24h.com/phim-a?A001
            </code>
            . Mã ở sau dấu ? được ghi nhận và tiếp tục gắn với khách trong phiên trình duyệt. Mã bắt
            đầu bằng một chữ cái A-Z, sau đó có thể là chữ, số, dấu gạch ngang hoặc gạch dưới (tối
            đa 31 ký tự).
          </p>

          <div className="flex items-center gap-2 my-3">
            <button
              type="button"
              onClick={() => handleSelectEmpDays(7)}
              className={`px-3 py-1 rounded text-[13px] border cursor-pointer ${
                empDays === 7
                  ? 'bg-[#2271b1] border-[#2271b1] text-white font-semibold'
                  : 'bg-[#f6f7f7] border-[#2271b1] text-[#2271b1] hover:bg-[#f0f6fc]'
              }`}
            >
              7 ngày
            </button>
            <button
              type="button"
              onClick={() => handleSelectEmpDays(30)}
              className={`px-3 py-1 rounded text-[13px] border cursor-pointer ${
                empDays === 30
                  ? 'bg-[#2271b1] border-[#2271b1] text-white font-semibold'
                  : 'bg-[#f6f7f7] border-[#2271b1] text-[#2271b1] hover:bg-[#f0f6fc]'
              }`}
            >
              30 ngày
            </button>
            <button
              type="button"
              onClick={() => void fetchDashboard()}
              className="px-3 py-1 rounded text-[13px] border border-[#2271b1] bg-[#f6f7f7] text-[#2271b1] hover:bg-[#f0f6fc] cursor-pointer"
            >
              Làm mới online
            </button>
          </div>

          <h2 className="text-[18px] font-semibold mt-4 mb-1 text-[#1d2327]">
            Bảng xếp hạng nhân viên
          </h2>
          <p className="text-[13px] text-[#3c434a] mb-3">
            Gán/sửa mã tại Users → Edit User. User mới được cấp mã tự động; user cũ được cấp khi
            đăng nhập hoặc mở trang thống kê. (Bấm vào mã nhân viên để xem chi tiết bên dưới)
          </p>

          <div className="overflow-x-auto max-w-[1150px] bg-white border border-[#c3c4c7] shadow-2xs">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-white border-b border-[#c3c4c7]">
                  <th className="text-left py-2.5 px-3 font-semibold text-[#2c3338]">
                    Mã nhân viên
                  </th>
                  <th className="text-left py-2.5 px-3 font-semibold text-[#2c3338]">Tài khoản</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-[#2c3338]">Lượt xem</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-[#2c3338]">
                    Khách duy nhất
                  </th>
                  <th className="text-left py-2.5 px-3 font-semibold text-[#2c3338]">Khách mới</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-[#2c3338]">
                    Khách quay lại
                  </th>
                  <th className="text-left py-2.5 px-3 font-semibold text-[#2c3338]">
                    Online (5 phút)
                  </th>
                </tr>
              </thead>
              <tbody>
                {(data?.employeeRanking?.rows || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-3 px-3 text-[#50575e]">
                      Chưa có lượt truy cập gắn mã nhân viên.
                    </td>
                  </tr>
                ) : (
                  (data?.employeeRanking?.rows || []).map((row, idx) => {
                    const isSelected =
                      data?.employeeRanking?.selectedEmployee === row.code ||
                      (row.code === '(Không mã)' && data?.employeeRanking?.selectedEmployee === '');
                    return (
                      <tr
                        key={`${row.code}-${idx}`}
                        className={`${
                          idx % 2 === 0 ? 'bg-[#f6f7f7]' : 'bg-white'
                        } hover:bg-[#f0f6fc] transition-colors ${
                          isSelected ? 'ring-1 ring-inset ring-[#2271b1] bg-[#f0f6fc]' : ''
                        }`}
                      >
                        <td className="py-2 px-3">
                          <button
                            type="button"
                            onClick={() => handleSelectEmpDetail(row.code)}
                            className="text-[#2271b1] hover:text-[#135e96] font-semibold underline cursor-pointer"
                          >
                            {row.code}
                          </button>
                        </td>
                        <td className="py-2 px-3 text-[#50575e]">{row.account}</td>
                        <td className="py-2 px-3 text-[#50575e] font-medium">{fmt(row.views)}</td>
                        <td className="py-2 px-3 text-[#50575e]">{fmt(row.visitors)}</td>
                        <td className="py-2 px-3 text-[#50575e]">{fmt(row.newVisitors)}</td>
                        <td className="py-2 px-3 text-[#50575e]">{fmt(row.returningVisitors)}</td>
                        <td className="py-2 px-3 font-semibold text-[#1cc865]">
                          {fmt(row.online)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Bộ lọc chọn nhanh Top 10 bài viết theo nhân viên (.tkw-staff-top-filter) */}
          <div className="bg-white p-4 my-4 rounded-[10px] max-w-[1150px] flex flex-wrap items-center gap-2.5 border border-[#dce5ef]">
            <label htmlFor="tkw-staff-picker" className="text-[13px] font-bold text-[#1d2327]">
              Top 10 bài viết theo nhân viên:
            </label>
            <select
              id="tkw-staff-picker"
              value={empDetailCode}
              onChange={(e) => handleSelectEmpDetail(e.target.value)}
              className="min-h-[34px] px-2.5 py-1 text-[13px] border border-[#8c8f94] rounded bg-white text-[#2c3338] cursor-pointer"
            >
              <option value="">Chọn nhân viên</option>
              {allEmployeeOptions.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void fetchDashboard({ empDetailCode })}
              className="px-3 py-1.5 rounded text-[13px] font-semibold bg-[#2271b1] hover:bg-[#135e96] text-white cursor-pointer"
            >
              Xem thống kê
            </button>
          </div>

          {/* Chi tiết mã nhân viên (khi chọn 1 mã nhân viên) */}
          {data?.employeeRanking?.detail && (
            <div className="mt-5">
              <h2 className="text-[18px] font-semibold mb-3 text-[#1d2327]">
                Chi tiết: {data.employeeRanking.detail.code}
              </h2>

              <div className="flex gap-4 flex-wrap my-4">
                {/* Theo ngày */}
                <div className="bg-white p-4 min-w-[260px] border border-[#c3c4c7] flex-1">
                  <h3 className="text-[14px] font-semibold mt-0 mb-2.5 text-[#1d2327]">
                    Theo ngày
                  </h3>
                  <table className="w-full border-collapse text-[13px] border border-[#c3c4c7]">
                    <thead>
                      <tr className="border-b border-[#c3c4c7] bg-white">
                        <th className="text-left py-2 px-2.5 font-semibold">Ngày</th>
                        <th className="text-left py-2 px-2.5 font-semibold">Xem</th>
                        <th className="text-left py-2 px-2.5 font-semibold">Khách</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.employeeRanking.detail.daily.map((d, i) => (
                        <tr key={d.day} className={i % 2 === 0 ? 'bg-[#f6f7f7]' : 'bg-white'}>
                          <td className="py-1.5 px-2.5">{d.day}</td>
                          <td className="py-1.5 px-2.5">{fmt(d.views)}</td>
                          <td className="py-1.5 px-2.5">{fmt(d.visitors)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Nguồn truy cập */}
                <div className="bg-white p-4 min-w-[200px] border border-[#c3c4c7] flex-1">
                  <h3 className="text-[14px] font-semibold mt-0 mb-2.5 text-[#1d2327]">
                    Nguồn truy cập
                  </h3>
                  <table className="w-full border-collapse text-[13px] border border-[#c3c4c7]">
                    <thead>
                      <tr className="border-b border-[#c3c4c7] bg-white">
                        <th className="text-left py-2 px-2.5 font-semibold">Nguồn truy cập</th>
                        <th className="text-left py-2 px-2.5 font-semibold">Khách</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.employeeRanking.detail.sources.map((s, i) => (
                        <tr key={s.name} className={i % 2 === 0 ? 'bg-[#f6f7f7]' : 'bg-white'}>
                          <td className="py-1.5 px-2.5">{s.name}</td>
                          <td className="py-1.5 px-2.5">{fmt(s.count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Thiết bị */}
                <div className="bg-white p-4 min-w-[200px] border border-[#c3c4c7] flex-1">
                  <h3 className="text-[14px] font-semibold mt-0 mb-2.5 text-[#1d2327]">Thiết bị</h3>
                  <table className="w-full border-collapse text-[13px] border border-[#c3c4c7]">
                    <thead>
                      <tr className="border-b border-[#c3c4c7] bg-white">
                        <th className="text-left py-2 px-2.5 font-semibold">Thiết bị</th>
                        <th className="text-left py-2 px-2.5 font-semibold">Khách</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.employeeRanking.detail.devices.map((d, i) => (
                        <tr key={d.name} className={i % 2 === 0 ? 'bg-[#f6f7f7]' : 'bg-white'}>
                          <td className="py-1.5 px-2.5">{d.name}</td>
                          <td className="py-1.5 px-2.5">{fmt(d.count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Quốc gia */}
                <div className="bg-white p-4 min-w-[200px] border border-[#c3c4c7] flex-1">
                  <h3 className="text-[14px] font-semibold mt-0 mb-2.5 text-[#1d2327]">Quốc gia</h3>
                  <table className="w-full border-collapse text-[13px] border border-[#c3c4c7]">
                    <thead>
                      <tr className="border-b border-[#c3c4c7] bg-white">
                        <th className="text-left py-2 px-2.5 font-semibold">Quốc gia</th>
                        <th className="text-left py-2 px-2.5 font-semibold">Khách</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.employeeRanking.detail.countries.map((c, i) => (
                        <tr key={c.name} className={i % 2 === 0 ? 'bg-[#f6f7f7]' : 'bg-white'}>
                          <td className="py-1.5 px-2.5">{c.name}</td>
                          <td className="py-1.5 px-2.5">{fmt(c.count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Tỉnh/thành */}
                <div className="bg-white p-4 min-w-[200px] border border-[#c3c4c7] flex-1">
                  <h3 className="text-[14px] font-semibold mt-0 mb-2.5 text-[#1d2327]">
                    Tỉnh/thành
                  </h3>
                  <table className="w-full border-collapse text-[13px] border border-[#c3c4c7]">
                    <thead>
                      <tr className="border-b border-[#c3c4c7] bg-white">
                        <th className="text-left py-2 px-2.5 font-semibold">Tỉnh/thành</th>
                        <th className="text-left py-2 px-2.5 font-semibold">Khách</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.employeeRanking.detail.regions.map((r, i) => (
                        <tr key={r.name} className={i % 2 === 0 ? 'bg-[#f6f7f7]' : 'bg-white'}>
                          <td className="py-1.5 px-2.5">{r.name}</td>
                          <td className="py-1.5 px-2.5">{fmt(r.count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bảng Top 10 bài viết / trang của nhân viên mã ... (.tkw-staff-top v2.9+) */}
              <div className="bg-white border border-[#dce5ef] rounded-[12px] p-[18px] my-[18px] max-w-[1200px]">
                <h2 className="text-[18px] font-semibold m-0 text-[#1d2327]">
                  {data.employeeRanking.detail.staffTopHeading ||
                    `Top 10 bài viết / trang của nhân viên mã ${data.employeeRanking.detail.code}`}
                </h2>

                <div className="flex flex-wrap gap-1.5 items-center my-3.5">
                  {[
                    { key: '1', label: 'Hôm nay' },
                    { key: 'yesterday', label: 'Hôm qua' },
                    { key: '7', label: '7 ngày' },
                    { key: '30', label: '30 ngày' },
                    { key: '90', label: '90 ngày' },
                  ].map((btn) => (
                    <button
                      key={btn.key}
                      type="button"
                      onClick={() => handleSelectStaffTopPeriod(btn.key)}
                      className={`px-3 py-1 rounded-[7px] text-[12px] font-semibold border cursor-pointer ${
                        staffTopPeriod === btn.key
                          ? 'bg-[#2271b1] border-[#2271b1] text-white'
                          : 'bg-[#f6f7f7] border-[#2271b1] text-[#2271b1] hover:bg-[#f0f6fc]'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                {data.employeeRanking.detail.staffTopDescription && (
                  <p className="text-[13px] text-[#64748b] mb-3">
                    {data.employeeRanking.detail.staffTopDescription}
                  </p>
                )}

                <div className="overflow-x-auto bg-white border border-[#c3c4c7]">
                  <table className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b border-[#c3c4c7] bg-white">
                        <th className="w-[48px] text-left py-2.5 px-3 font-semibold">#</th>
                        <th className="text-left py-2.5 px-3 font-semibold">Bài viết / trang</th>
                        <th className="min-w-[260px] text-left py-2.5 px-3 font-semibold">
                          Link bài viết / Copy
                        </th>
                        <th className="text-left py-2.5 px-3 font-semibold whitespace-nowrap">
                          Lượt xem
                        </th>
                        <th className="text-left py-2.5 px-3 font-semibold whitespace-nowrap">
                          Khách
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.employeeRanking.detail.topPosts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-3 px-3 text-[#50575e]">
                            Chưa có dữ liệu
                          </td>
                        </tr>
                      ) : (
                        data.employeeRanking.detail.topPosts.map((p, i) => {
                          const copyKey = `emp-detail-top-${i}`;
                          const isCopied = copiedUrlKey === copyKey;
                          return (
                            <tr
                              key={`${p.title}-${i}`}
                              className={i % 2 === 0 ? 'bg-[#f6f7f7]' : 'bg-white'}
                            >
                              <td className="py-2 px-3 align-middle">{p.rank ?? i + 1}</td>
                              <td className="py-2 px-3 align-middle font-medium">
                                {p.url ? (
                                  <a
                                    href={p.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#1d2327] hover:text-[#2271b1] hover:underline"
                                  >
                                    {p.title}
                                  </a>
                                ) : (
                                  p.title
                                )}
                              </td>
                              <td className="py-2 px-3 align-middle">
                                {p.url ? (
                                  <div className="flex items-center gap-2 my-1">
                                    <input
                                      aria-label="Link bài viết"
                                      type="text"
                                      readOnly
                                      value={p.url}
                                      onFocus={(e) => e.currentTarget.select()}
                                      className="w-full max-w-[360px] h-8 px-2 text-[12px] border border-[#dce5ee] rounded bg-[#f8fafc] text-[#48607d]"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleCopyUrl(p.url, copyKey)}
                                      className={`px-2.5 py-1 rounded text-[11px] font-semibold border whitespace-nowrap cursor-pointer ${
                                        isCopied
                                          ? 'bg-emerald-600 border-emerald-600 text-white'
                                          : 'bg-white border-[#cbd7e8] text-[#244e9c] hover:bg-[#eef4ff]'
                                      }`}
                                    >
                                      {isCopied ? '✓ Đã copy' : 'Copy'}
                                    </button>
                                  </div>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="py-2 px-3 align-middle font-semibold">
                                {fmt(p.views)}
                              </td>
                              <td className="py-2 px-3 align-middle">
                                {p.visitors !== undefined ? fmt(p.visitors) : '—'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bảng Top 10 bài viết / trang tổng thể toàn website ngay bên dưới phần Chi tiết nhân viên để đối chiếu */}
              {data?.siteTopPanel && (
                <div
                  className="bg-white border border-[#dce5ef] rounded-[12px] p-[18px] my-[18px] max-w-[1200px]"
                  style={{ borderLeft: '3px solid #3b82f6' }}
                >
                  <div className="flex items-center justify-between gap-2.5 flex-wrap mb-2">
                    <h2 className="text-[18px] font-semibold m-0 text-[#1d2327]">
                      {data.siteTopPanel.heading || 'Top 10 bài viết / trang toàn website'}
                    </h2>
                    <span className="text-[12px] text-[#64748b]">
                      Cùng kỳ · {data.topFrom || data.from} – {data.topTo || data.to}
                    </span>
                  </div>
                  <p className="text-[13px] text-[#64748b] mb-3">
                    Tất cả lượt truy cập tổng thể ở domain gốc và các subdomain trên toàn website celeb24h.com.
                  </p>
                  {renderTop10Table(
                    data.siteTopPanel.rows,
                    'emp-section-site-top10',
                    'Chưa có dữ liệu toàn website.'
                  )}
                </div>
              )}
            </div>
          )}

          <p className="text-[13px] italic text-[#50575e] mt-4 mb-0">
            Thống kê theo mã bắt đầu từ bản 2.1. Online là khách có hoạt động trong 5 phút gần nhất;
            khách mới/quay lại dựa trên mã định danh trình duyệt. Dữ liệu chi tiết theo mã được giữ
            90 ngày. Một khách có thể được tính ở nhiều mã nếu họ mở link nhiều nhân viên.
          </p>
        </div>
      )}
    </div>
  );
};
