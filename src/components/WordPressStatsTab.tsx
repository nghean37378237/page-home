import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RefreshCw, ExternalLink, AlertCircle, BarChart3, Users, Activity, Shield, Check, Lock } from 'lucide-react';
import type {
  WpStatsDashboardPayload,
  WpRealtimeMinute,
} from '../server/wpStatsService';
import type { AppUser, UserAccount, TabKey } from '../types';

interface WordPressStatsTabProps {
  currentUser?: AppUser;
  accounts?: UserAccount[];
  onUpdateAccountPermissions?: (accountId: string, allowedTabs: TabKey[]) => Promise<void> | void;
}

export const WordPressStatsTab: React.FC<WordPressStatsTabProps> = ({
  currentUser,
  accounts = [],
  onUpdateAccountPermissions,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const [data, setData] = useState<WpStatsDashboardPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshingLive, setRefreshingLive] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Panel phân quyền nhân viên xem Bảng Thống Kê View (Dành cho Admin)
  const [showPermissionPanel, setShowPermissionPanel] = useState<boolean>(false);
  const [savingStaffId, setSavingStaffId] = useState<string | null>(null);

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

  // Chế độ hiển thị: 'all' (Gộp cả Lưu lượng truy cập + Theo mã nhân viên) | 'traffic' | 'employees'
  const [viewSection, setViewSection] = useState<'all' | 'traffic' | 'employees'>('all');

  // Filter states matching WordPress tkw-stats & tkw-employees
  const [range, setRange] = useState<string>('7');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [useCustomDates, setUseCustomDates] = useState<boolean>(false);

  const [employee, setEmployee] = useState<string>('');
  const [liveEmployee, setLiveEmployee] = useState<string>('');

  const [topRange, setTopRange] = useState<string>('7');
  const [topCustomFrom, setTopCustomFrom] = useState<string>('');
  const [topCustomTo, setTopCustomTo] = useState<string>('');

  const [empDays, setEmpDays] = useState<number>(7);
  const [empDetailCode, setEmpDetailCode] = useState<string>('M2001');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const fmt = (n?: number | null) => Number(n || 0).toLocaleString('vi-VN');

  const fetchDashboard = useCallback(
    async (overrideParams?: {
      range?: string;
      from?: string;
      to?: string;
      useCustom?: boolean;
      employee?: string;
      liveEmployee?: string;
      topRange?: string;
      topFrom?: string;
      topTo?: string;
      empDays?: number;
      empDetailCode?: string;
      silent?: boolean;
    }) => {
      const r = overrideParams?.range ?? range;
      const isCustom = overrideParams?.useCustom ?? useCustomDates;
      const f = overrideParams?.from ?? customFrom;
      const t = overrideParams?.to ?? customTo;
      const emp = overrideParams?.employee ?? employee;
      const liveEmp = overrideParams?.liveEmployee ?? liveEmployee;
      const tr = overrideParams?.topRange ?? topRange;
      const tf = overrideParams?.topFrom ?? topCustomFrom;
      const tt = overrideParams?.topTo ?? topCustomTo;
      const ed = overrideParams?.empDays ?? empDays;
      const edCode = overrideParams?.empDetailCode ?? empDetailCode;

      if (!overrideParams?.silent) {
        setLoading(true);
      }
      setError(null);

      try {
        const q = new URLSearchParams({
          mode: 'dashboard',
          range: r,
          employee: emp,
          live_employee: liveEmp,
          top_range: tr,
          emp_days: String(ed),
          emp_detail: edCode,
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
      employee,
      liveEmployee,
      topRange,
      topCustomFrom,
      topCustomTo,
      empDays,
      empDetailCode,
    ]
  );

  // Poll realtime panel every 15 seconds just like assets/dashboard.js on celeb24h.com
  const pollRealtimeOnly = useCallback(async () => {
    try {
      setRefreshingLive(true);
      const q = new URLSearchParams({
        mode: 'live',
        live_employee: liveEmployee,
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
  }, [liveEmployee]);

  useEffect(() => {
    void fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void pollRealtimeOnly();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [pollRealtimeOnly]);

  // Draw 30-minute canvas bar chart matching assets/dashboard.js from wp-simple-stats
  const drawChart = useCallback((series: WpRealtimeMinute[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(300, rect.width || 640);
    const height = Math.max(195, rect.height || 200);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const pad = { l: 34, r: 10, t: 12, b: 26 };
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

  const handleChangeEmployee = (newEmp: string) => {
    setEmployee(newEmp);
    void fetchDashboard({ employee: newEmp });
  };

  const handleChangeLiveEmployee = (newLiveEmp: string) => {
    setLiveEmployee(newLiveEmp);
    void fetchDashboard({ liveEmployee: newLiveEmp });
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
    void fetchDashboard({ empDetailCode: cleanCode });
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Thanh chuyển đổi chế độ xem & Trạng thái kết nối trực tiếp celeb24h.com */}
      <div className="bg-white border border-[#d8e0ec] rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
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
              <span>Tất cả (Toàn cảnh + Mã NV)</span>
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
              <span>Theo mã nhân viên</span>
            </button>
          </div>
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
              title="Chọn nhân viên nào được phép nhìn thấy Bảng 10: Thống Kê View"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>
                Phân Quyền NV Xem Bảng ({allowedViewStatsCount}/{staffAccounts.length} NV)
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void fetchDashboard()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#2271b1] hover:bg-[#135e96] text-white transition-colors cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || refreshingLive ? 'animate-spin' : ''}`} />
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

      {/* BẢNG PHÂN QUYỀN NHÂN VIÊN ĐƯỢC PHÉP XEM BẢNG THỐNG KÊ VIEW (CHỈ ADMIN) */}
      {isAdmin && showPermissionPanel && (
        <div className="bg-white border-2 border-amber-300 rounded-xl p-4 shadow-xs space-y-3 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-600" />
                <span>Phân Quyền Nhân Viên Xem Bảng 10: Thống Kê View</span>
                <span className="text-[11px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200 px-2 py-0.5 rounded-full">
                  Đang cấp quyền: {allowedViewStatsCount}/{staffAccounts.length} nhân viên
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Bấm vào tên nhân viên bên dưới để <strong>Bật / Tắt</strong> quyền nhìn thấy tab <strong>Thống Kê View</strong> trên màn hình của nhân viên đó. Nhân viên không được chọn sẽ tự động ẩn tab này.
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={savingStaffId !== null}
                onClick={() => void handleBatchViewStatsAccess(true)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer disabled:opacity-50"
              >
                ✓ Cho phép tất cả NV
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {staffAccounts.map((acc) => {
                const hasAccess = getStaffTabs(acc).includes('view_stats');
                const isSavingThis = savingStaffId === acc.id || savingStaffId === 'ALL';
                return (
                  <button
                    key={acc.id}
                    type="button"
                    disabled={isSavingThis}
                    onClick={() => void handleToggleStaffViewStats(acc)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      hasAccess
                        ? 'bg-cyan-50/90 border-cyan-400 text-cyan-950 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-xs truncate flex items-center gap-1.5">
                        <span>{acc.username}</span>
                      </div>
                      <div className="text-[10px] truncate opacity-75">
                        {acc.email || 'Chưa gán Gmail'}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black shrink-0 ${
                        hasAccess
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {hasAccess ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Được xem</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3" />
                          <span>Đang ẩn</span>
                        </>
                      )}
                    </span>
                  </button>
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
          PHẦN 1: GIAO DIỆN NGUYÊN BẢN "LƯU LƯỢNG TRUY CẬP" (tkw-stats)
         ===================================================================== */}
      {(viewSection === 'all' || viewSection === 'traffic') && (
        <div className="bg-[#f3f6fb] border border-[#d8e0ec] rounded-[14px] p-[18px] text-[#1f2a3d]">
          {/* Header: Lưu lượng truy cập + celeb24h.com */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="m-0 text-[26px] font-bold text-[#1f2a3d] flex items-center gap-2">
              <span>📈 Lưu lượng truy cập</span>
            </h1>
            <span className="bg-[#e8eef7] text-[#355070] px-2.5 py-1 rounded-md font-semibold text-[13px]">
              celeb24h.com
            </span>
          </div>

          {/* Bộ lọc chính (.tkw-filters) */}
          <form
            onSubmit={handleApplyCustomDateRange}
            className="flex flex-wrap gap-2 items-center my-3.5 bg-white p-3 rounded-[10px] border border-[#dde5f0]"
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
                  className={`px-3 py-1.5 rounded-md text-[13px] border transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-[#2271b1] border-[#2271b1] text-white font-semibold'
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
                className="px-2.5 py-1 text-[13px] border border-[#8c8f94] rounded bg-white text-[#2c3338]"
              />
              <span className="text-[#5d6b82]">→</span>
              <input
                aria-label="Đến ngày"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2.5 py-1 text-[13px] border border-[#8c8f94] rounded bg-white text-[#2c3338]"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-md text-[13px] border border-[#2271b1] bg-[#f6f7f7] text-[#2271b1] hover:bg-[#f0f6fc] cursor-pointer"
              >
                Xem
              </button>
            </div>

            <select
              aria-label="Mã nhân viên"
              value={employee}
              onChange={(e) => handleChangeEmployee(e.target.value)}
              className="px-2.5 py-1.5 text-[13px] border border-[#8c8f94] rounded bg-white text-[#2c3338] cursor-pointer"
            >
              <option value="">Mã NV: tất cả</option>
              {(data?.employeeOptions || []).map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
          </form>

          <p className="text-[#5d6b82] text-[13px] mt-1 mb-3.5">
            Khoảng: {data?.from || customFrom || '...'} – {data?.to || customTo || '...'} · Múi giờ{' '}
            {data?.timezone || '+00:00'}. Phần tổng hợp/Top 10 lọc theo mã nhân viên; Realtime có bộ
            lọc riêng và chế độ toàn website gồm cả truy cập không mã. Tài khoản quản trị không được
            ghi nhận.
          </p>

          {/* Khu vực 🟢 Realtime (.tkw-realtime) */}
          <section className="bg-white border border-[#d7e2f0] rounded-xl p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex justify-between items-center gap-3 flex-wrap mb-3">
              <h2 className="m-0 text-[18px] font-bold text-[#1f2a3d]">🟢 Realtime</h2>

              <div className="inline-flex items-center gap-2 flex-wrap text-[13px] text-[#355070] font-semibold">
                <label htmlFor="tkw-live-employee">Xem Realtime:</label>
                <select
                  id="tkw-live-employee"
                  value={liveEmployee}
                  onChange={(e) => handleChangeLiveEmployee(e.target.value)}
                  className="min-w-[230px] px-2.5 py-1 text-[13px] border border-[#8c8f94] rounded bg-white text-[#2c3338] font-normal cursor-pointer"
                >
                  <option value="">Toàn website (cả không có mã)</option>
                  {(data?.employeeOptions || []).map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-[#5d6b82] text-[12px]">
                cập nhật lúc {data?.realtime?.updated || '--:--:--'} · mỗi 15 giây
              </span>
            </div>

            {/* 3 Ô Counters (.tkw-counters) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-3">
              <div
                className="rounded-[10px] px-4 py-3.5 border border-[#dce6f2]"
                style={{
                  background: '#e6fbef',
                  borderLeft: '4px solid #1cc865',
                }}
              >
                <span className="block text-[12px] text-[#42526b] font-semibold">
                  Đang online (5 phút)
                </span>
                <strong
                  className="block text-[30px] leading-[1.15] mt-1 font-bold"
                  style={{ color: '#1cc865' }}
                >
                  {fmt(data?.realtime?.online)}
                </strong>
              </div>

              <div
                className="rounded-[10px] px-4 py-3.5 border border-[#dce6f2]"
                style={{
                  background: '#efedff',
                  borderLeft: '4px solid #5342dc',
                }}
              >
                <span className="block text-[12px] text-[#42526b] font-semibold">
                  Hôm nay · Lượt xem
                </span>
                <strong
                  className="block text-[30px] leading-[1.15] mt-1 font-bold"
                  style={{ color: '#5342dc' }}
                >
                  {fmt(data?.realtime?.today_views)}
                </strong>
              </div>

              <div
                className="rounded-[10px] px-4 py-3.5 border border-[#dce6f2]"
                style={{
                  background: '#e9f7ff',
                  borderLeft: '4px solid #169ce8',
                }}
              >
                <span className="block text-[12px] text-[#42526b] font-semibold">
                  Hôm nay · Khách
                </span>
                <strong
                  className="block text-[30px] leading-[1.15] mt-1 font-bold"
                  style={{ color: '#169ce8' }}
                >
                  {fmt(data?.realtime?.today_visitors)}
                </strong>
              </div>
            </div>

            {/* Biểu đồ 30 phút & Bảng khách đang xem gì (.tkw-realgap) */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] gap-3.5 mt-3.5">
              <div className="bg-white border border-[#dde5f0] rounded-[10px] p-3.5">
                <h3 className="m-0 mb-2.5 text-[15px] font-bold text-[#1f2a3d]">
                  🔵 Lượt xem 30 phút qua (theo phút)
                </h3>
                <canvas
                  ref={canvasRef}
                  className="w-full h-[200px] block"
                  aria-label="Biểu đồ lượt xem và khách 30 phút"
                  role="img"
                />
                <div className="flex gap-4 text-[12px] text-[#55657d] mt-2">
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

              <div className="bg-white border border-[#dde5f0] rounded-[10px] p-3.5 overflow-x-auto">
                <h3 className="m-0 mb-2.5 text-[15px] font-bold text-[#1f2a3d]">
                  🔵 Khách đang xem gì
                </h3>
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr>
                      <th className="text-left py-2 px-1.5 border-b border-[#edf2f8] text-[#6a7a92] text-[12px] font-semibold">
                        TRANG / BÀI VIẾT
                      </th>
                      <th className="text-right py-2 px-1.5 border-b border-[#edf2f8] text-[#6a7a92] text-[12px] font-semibold whitespace-nowrap">
                        KHÁCH
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.realtime?.pages || []).length === 0 ? (
                      <tr>
                        <td colSpan={2} className="py-3 px-1.5 text-[#5d6b82]">
                          Chưa có khách hoạt động
                        </td>
                      </tr>
                    ) : (
                      (data?.realtime?.pages || []).map((p, idx) => (
                        <tr key={`${p.title}-${idx}`}>
                          <td className="py-2 px-1.5 border-b border-[#edf2f8] text-[#1f2a3d]">
                            {p.title}
                          </td>
                          <td className="py-2 px-1.5 border-b border-[#edf2f8] text-right font-bold text-[#1f2a3d]">
                            {fmt(p.count)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* 3 Bảng dưới (.tkw-below): Tổng hợp + Top 10 bài viết/trang + Theo ngày */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 mt-3.5">
            {/* Bảng 1: Tổng hợp */}
            <div className="bg-white border border-[#dde5f0] rounded-[10px] p-3.5">
              <h3 className="m-0 mb-2.5 text-[15px] font-bold text-[#1f2a3d]">
                Tổng hợp {data?.from || ''} – {data?.to || ''}
              </h3>
              <table className="w-full border-collapse text-[13px]">
                <tbody>
                  <tr>
                    <td className="py-2 px-1.5 border-b border-[#edf2f8]">Lượt xem</td>
                    <td className="py-2 px-1.5 border-b border-[#edf2f8] text-right font-bold">
                      {fmt(data?.summary?.views)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-1.5 border-b border-[#edf2f8]">Khách duy nhất</td>
                    <td className="py-2 px-1.5 border-b border-[#edf2f8] text-right font-bold">
                      {fmt(data?.summary?.visitors)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-1.5 border-b border-[#edf2f8]">Khách mới</td>
                    <td className="py-2 px-1.5 border-b border-[#edf2f8] text-right font-bold">
                      {fmt(data?.summary?.newcomers)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-1.5 border-b border-[#edf2f8]">Khách quay lại</td>
                    <td className="py-2 px-1.5 border-b border-[#edf2f8] text-right font-bold">
                      {fmt(data?.summary?.returning)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Bảng 2: Top 10 bài viết / trang */}
            <div className="bg-white border border-[#dde5f0] rounded-[10px] p-3.5">
              <h3 className="m-0 mb-2.5 text-[15px] font-bold text-[#1f2a3d]">
                Top 10 bài viết / trang
              </h3>

              <div className="flex flex-wrap gap-1.5 items-center mb-2.5">
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
                    className={`px-2 py-0.5 min-h-[28px] rounded text-[12px] border cursor-pointer ${
                      topRange === btn.key
                        ? 'bg-[#2271b1] border-[#2271b1] text-white font-semibold'
                        : 'bg-[#f6f7f7] border-[#2271b1] text-[#2271b1] hover:bg-[#f0f6fc]'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}

                <form
                  onSubmit={handleApplyTopCustomDates}
                  className="flex flex-wrap gap-1.5 items-center w-full mt-1"
                >
                  <label className="inline-flex items-center gap-1 text-[12px] text-[#42526b]">
                    Từ
                    <input
                      type="date"
                      value={topCustomFrom}
                      onChange={(e) => setTopCustomFrom(e.target.value)}
                      required
                      className="max-w-[132px] px-1.5 py-0.5 text-[12px] border border-[#8c8f94] rounded bg-white"
                    />
                  </label>
                  <label className="inline-flex items-center gap-1 text-[12px] text-[#42526b]">
                    Đến
                    <input
                      type="date"
                      value={topCustomTo}
                      onChange={(e) => setTopCustomTo(e.target.value)}
                      required
                      className="max-w-[132px] px-1.5 py-0.5 text-[12px] border border-[#8c8f94] rounded bg-white"
                    />
                  </label>
                  <button
                    type="submit"
                    className={`px-2 py-0.5 min-h-[28px] rounded text-[12px] border cursor-pointer ${
                      topRange === 'custom'
                        ? 'bg-[#2271b1] border-[#2271b1] text-white font-semibold'
                        : 'bg-[#f6f7f7] border-[#2271b1] text-[#2271b1] hover:bg-[#f0f6fc]'
                    }`}
                  >
                    Xem
                  </button>
                </form>
              </div>

              <p className="text-[#5d6b82] text-[12px] my-1.5">
                Thống kê từ {data?.topFrom || topCustomFrom || '...'} đến{' '}
                {data?.topTo || topCustomTo || '...'} (giữ dữ liệu chi tiết 90 ngày).{' '}
                {employee ? `Mã nhân viên: ${employee}` : 'Tất cả mã nhân viên'}
              </p>

              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-1.5 border-b border-[#edf2f8] text-[#6a7a92] text-[12px] font-semibold">
                      Bài viết / trang
                    </th>
                    <th className="text-right py-2 px-1.5 border-b border-[#edf2f8] text-[#6a7a92] text-[12px] font-semibold whitespace-nowrap">
                      Lượt xem
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.topPosts || []).length === 0 ? (
                    <tr>
                      <td colSpan={2} className="py-3 px-1.5 text-[#5d6b82]">
                        Chưa có dữ liệu
                      </td>
                    </tr>
                  ) : (
                    (data?.topPosts || []).map((r, idx) => (
                      <tr key={`${r.title}-${idx}`}>
                        <td className="py-2 px-1.5 border-b border-[#edf2f8]">{r.title}</td>
                        <td className="py-2 px-1.5 border-b border-[#edf2f8] text-right font-bold">
                          {fmt(r.views)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Bảng 3: Theo ngày */}
            <div className="bg-white border border-[#dde5f0] rounded-[10px] p-3.5">
              <h3 className="m-0 mb-2.5 text-[15px] font-bold text-[#1f2a3d]">Theo ngày</h3>
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-1.5 border-b border-[#edf2f8] text-[#6a7a92] text-[12px] font-semibold">
                      Ngày
                    </th>
                    <th className="text-right py-2 px-1.5 border-b border-[#edf2f8] text-[#6a7a92] text-[12px] font-semibold">
                      Lượt xem
                    </th>
                    <th className="text-right py-2 px-1.5 border-b border-[#edf2f8] text-[#6a7a92] text-[12px] font-semibold">
                      Khách
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.daily || []).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-3 px-1.5 text-[#5d6b82]">
                        Chưa có dữ liệu
                      </td>
                    </tr>
                  ) : (
                    (data?.daily || []).map((r) => (
                      <tr key={r.day}>
                        <td className="py-2 px-1.5 border-b border-[#edf2f8]">{r.day}</td>
                        <td className="py-2 px-1.5 border-b border-[#edf2f8] text-right font-bold">
                          {fmt(r.views)}
                        </td>
                        <td className="py-2 px-1.5 border-b border-[#edf2f8] text-right font-bold">
                          {fmt(r.visitors)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PHẦN 2: GIAO DIỆN NGUYÊN BẢN "THỐNG KÊ THEO MÃ NHÂN VIÊN" (tkw-employees)
         ===================================================================== */}
      {(viewSection === 'all' || viewSection === 'employees') && (
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

          {/* Chi tiết mã nhân viên (khi chọn 1 mã nhân viên) */}
          {data?.employeeRanking?.detail && (
            <div className="mt-6">
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
                        <tr
                          key={d.day}
                          className={i % 2 === 0 ? 'bg-[#f6f7f7]' : 'bg-white'}
                        >
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
                        <tr
                          key={s.name}
                          className={i % 2 === 0 ? 'bg-[#f6f7f7]' : 'bg-white'}
                        >
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
                        <tr
                          key={d.name}
                          className={i % 2 === 0 ? 'bg-[#f6f7f7]' : 'bg-white'}
                        >
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
                        <tr
                          key={c.name}
                          className={i % 2 === 0 ? 'bg-[#f6f7f7]' : 'bg-white'}
                        >
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
                        <tr
                          key={r.name}
                          className={i % 2 === 0 ? 'bg-[#f6f7f7]' : 'bg-white'}
                        >
                          <td className="py-1.5 px-2.5">{r.name}</td>
                          <td className="py-1.5 px-2.5">{fmt(r.count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top bài viết/trang của mã nhân viên */}
              <h3 className="text-[15px] font-semibold mt-4 mb-2 text-[#1d2327]">
                Top bài viết/trang ({data.employeeRanking.detail.code})
              </h3>
              <div className="overflow-x-auto max-w-[760px] bg-white border border-[#c3c4c7]">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-[#c3c4c7] bg-white">
                      <th className="text-left py-2 px-3 font-semibold">Trang</th>
                      <th className="text-left py-2 px-3 font-semibold whitespace-nowrap">
                        Lượt xem
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.employeeRanking.detail.topPosts.map((p, i) => (
                      <tr
                        key={`${p.title}-${i}`}
                        className={i % 2 === 0 ? 'bg-[#f6f7f7]' : 'bg-white'}
                      >
                        <td className="py-2 px-3">{p.title}</td>
                        <td className="py-2 px-3 font-medium">{fmt(p.views)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
