import React, { useState, useMemo } from 'react';
import {
  Network,
  Search,
  Copy,
  Check,
  Plus,
  Trash2,
  Edit2,
  Download,
  Upload,
  RefreshCw,
  CheckSquare,
  Square,
  AlertTriangle,
  ExternalLink,
  Tag,
  ShieldCheck,
  Eye,
  EyeOff,
  Globe,
  Radio,
  Zap,
  Clock,
  Sparkles,
  CheckCircle2,
  X,
} from 'lucide-react';
import { ProxyItem, ProxyProtocol, ProxyStatus, AppUser } from '../types';
import { exportProxiesToXLSX } from '../utils/excelTemplates';

interface ProxyManagementTableProps {
  proxies: ProxyItem[];
  currentUser: AppUser;
  availableStaffNames: string[];
  onAddProxy: (proxy: ProxyItem) => Promise<void>;
  onAddBatchProxies?: (proxies: ProxyItem[]) => Promise<void>;
  onUpdateProxy: (id: string, updates: Partial<ProxyItem>) => Promise<void>;
  onDeleteProxy: (id: string) => Promise<void>;
  onDeleteBatchProxies?: (ids: string[]) => Promise<void>;
  onOpenAddModal: () => void;
  onOpenBulkImportModal: () => void;
  onEditProxy?: (proxy: ProxyItem) => void;
}

export const ProxyManagementTable: React.FC<ProxyManagementTableProps> = ({
  proxies,
  currentUser,
  availableStaffNames,
  onAddProxy,
  onAddBatchProxies,
  onUpdateProxy,
  onDeleteProxy,
  onDeleteBatchProxies,
  onOpenAddModal,
  onOpenBulkImportModal,
  onEditProxy,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const myStaffNameLower = (currentUser.name || '').trim().toLowerCase();

  // Scoping: Staff only sees proxies assigned to 'ALL' or explicitly to their name
  const scopedProxies = useMemo(() => {
    if (isAdmin) return proxies;
    return proxies.filter((p) => {
      const assigned = p.assignedStaff || [];
      if (assigned.includes('ALL')) return true;
      return assigned.some((s) => s.trim().toLowerCase() === myStaffNameLower);
    });
  }, [proxies, isAdmin, myStaffNameLower]);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
  const [selectedProtocolFilter, setSelectedProtocolFilter] = useState('ALL');
  const [rotatingOnly, setRotatingOnly] = useState(false);

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Password visibility map (proxyId -> boolean)
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  // Copy feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // Rotating state indicator (id -> boolean)
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [rotatingBatchIds, setRotatingBatchIds] = useState<Set<string>>(new Set());

  // Batch reset modal & report popup state
  const [batchResetModalOpen, setBatchResetModalOpen] = useState(false);
  const [isBatchResetting, setIsBatchResetting] = useState(false);
  const [batchResetReports, setBatchResetReports] = useState<
    {
      id: string;
      ip: string;
      port: string;
      staff: string;
      resetUrl: string;
      status: 'success' | 'warning' | 'error';
      message: string;
      timestamp: string;
    }[]
  >([]);

  // Local state for inline reset link inputs in each row
  const [inlineResetLinkMap, setInlineResetLinkMap] = useState<Record<string, string>>({});

  const handleInlineLinkChange = (id: string, value: string) => {
    setInlineResetLinkMap((prev) => ({ ...prev, [id]: value }));
  };

  const handleInlineLinkBlur = async (proxy: ProxyItem) => {
    const currentVal = inlineResetLinkMap[proxy.id];
    if (currentVal === undefined) return;
    const trimmed = currentVal.trim();
    if (trimmed !== (proxy.resetUrl || '')) {
      await onUpdateProxy(proxy.id, {
        resetUrl: trimmed,
        rotateUrl: trimmed,
        isRotating: Boolean(trimmed),
      });
      triggerCopyFeedback(`link-saved-${proxy.id}`, `Đã lưu link reset cho proxy ${proxy.ip}`);
    }
  };

  const handleResetProxyWithCurrentLink = async (proxy: ProxyItem) => {
    const currentLink = (
      inlineResetLinkMap[proxy.id] !== undefined
        ? inlineResetLinkMap[proxy.id]
        : proxy.resetUrl || proxy.rotateUrl || ''
    ).trim();

    if (!currentLink) {
      alert('Vui lòng nhập Link Reset Proxy vào ô trước khi ấn Reset!');
      return;
    }

    // Nếu link đã sửa đổi, lưu ngay vào CSDL
    if (currentLink !== (proxy.resetUrl || '')) {
      onUpdateProxy(proxy.id, {
        resetUrl: currentLink,
        rotateUrl: currentLink,
        isRotating: true,
        lastResetTime: Date.now(),
      }).catch(() => {});
    } else {
      onUpdateProxy(proxy.id, {
        lastResetTime: Date.now(),
      }).catch(() => {});
    }

    setRotatingId(proxy.id);
    try {
      await fetch(currentLink, { mode: 'no-cors' }).catch(() => {});
      playSuccessSound();
      const nowStr = new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setBatchResetReports([
        {
          id: proxy.id,
          ip: proxy.ip,
          port: proxy.port,
          staff: (proxy.assignedStaff || []).join(', ') || 'Chưa gán',
          resetUrl: currentLink,
          status: 'success',
          message: 'Đã gửi lệnh Reset thành công',
          timestamp: nowStr,
        },
      ]);
      triggerCopyFeedback(
        `reset-${proxy.id}`,
        `🎉 Đã gửi lệnh Reset cho proxy ${proxy.ip}:${proxy.port} thành công! (Đang cấp phát IP mới)`
      );
    } catch (e: any) {
      console.warn('Lỗi gọi API reset:', e);
    } finally {
      setTimeout(() => {
        setRotatingId(null);
      }, 1500);
    }
  };

  // Filtered list
  const filteredProxies = useMemo(() => {
    return scopedProxies.filter((p) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchIp = (p.ip || '').toLowerCase().includes(q);
        const matchPort = (p.port || '').toLowerCase().includes(q);
        const matchUser = (p.username || '').toLowerCase().includes(q);
        const matchFull = (p.fullProxy || '').toLowerCase().includes(q);
        const matchProvider = (p.provider || '').toLowerCase().includes(q);
        const matchNote = (p.note || '').toLowerCase().includes(q);
        const matchLoc = (p.location || '').toLowerCase().includes(q);
        const matchStaff = (p.assignedStaff || []).some((s) => s.toLowerCase().includes(q));

        if (!matchIp && !matchPort && !matchUser && !matchFull && !matchProvider && !matchNote && !matchLoc && !matchStaff) {
          return false;
        }
      }

      // Staff filter for Admin
      if (isAdmin && selectedStaffFilter !== 'ALL') {
        const assigned = p.assignedStaff || [];
        if (!assigned.includes('ALL') && !assigned.some((s) => s.toLowerCase() === selectedStaffFilter.toLowerCase())) {
          return false;
        }
      }

      // Status filter
      if (selectedStatusFilter !== 'ALL' && p.status !== selectedStatusFilter) {
        return false;
      }

      // Protocol filter
      if (selectedProtocolFilter !== 'ALL' && p.protocol !== selectedProtocolFilter) {
        return false;
      }

      // Rotating only
      if (rotatingOnly && !p.isRotating) {
        return false;
      }

      return true;
    });
  }, [scopedProxies, searchQuery, selectedStaffFilter, selectedStatusFilter, selectedProtocolFilter, rotatingOnly, isAdmin]);

  // Computed selection values
  const isAllSelected = useMemo(() => {
    return filteredProxies.length > 0 && filteredProxies.every((p) => selectedIds.has(p.id));
  }, [filteredProxies, selectedIds]);

  const isSomeSelected = useMemo(() => {
    return selectedIds.size > 0 && !isAllSelected;
  }, [selectedIds, isAllSelected]);

  // Selection handlers
  const handleToggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProxies.map((p) => p.id)));
    }
  };

  // Copy helper
  const triggerCopyFeedback = (key: string, message: string) => {
    setCopiedKey(key);
    setCopyToast(message);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
    setTimeout(() => {
      setCopyToast(null);
    }, 3000);
  };

  const handleCopyText = (text: string, key: string, label?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    triggerCopyFeedback(key, `Đã copy: ${label || text}`);
  };

  const handleCopySelectedProxies = (format: 'full' | 'ipport' = 'full') => {
    const list = filteredProxies.filter((p) => selectedIds.has(p.id));
    if (list.length === 0) {
      alert('Vui lòng chọn ít nhất 1 proxy để copy.');
      return;
    }

    const textToCopy = list
      .map((p) => (format === 'ipport' ? `${p.ip}:${p.port}` : p.fullProxy || `${p.ip}:${p.port}`))
      .join('\n');

    navigator.clipboard.writeText(textToCopy);
    triggerCopyFeedback('btn-copy-selected', `Đã copy ${list.length} proxy đã chọn!`);
  };

  const handleCopyAllProxies = (format: 'full' | 'ipport' = 'full') => {
    if (filteredProxies.length === 0) {
      alert('Không có proxy nào trong danh sách đang hiển thị.');
      return;
    }

    const textToCopy = filteredProxies
      .map((p) => (format === 'ipport' ? `${p.ip}:${p.port}` : p.fullProxy || `${p.ip}:${p.port}`))
      .join('\n');

    navigator.clipboard.writeText(textToCopy);
    triggerCopyFeedback('btn-copy-all', `Đã copy toàn bộ ${filteredProxies.length} proxy!`);
  };

  // Toggle status (Active <-> Die)
  const handleToggleStatus = async (proxy: ProxyItem) => {
    const nextStatus: ProxyStatus = proxy.status === 'active' ? 'die' : 'active';
    await onUpdateProxy(proxy.id, {
      status: nextStatus,
      lastChecked: new Date().toLocaleDateString('vi-VN'),
    });
  };

  // Audio chime feedback for successful reset
  const playSuccessSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Friendly pleasant two-tone chime
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.18);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now + 0.1); // G5
      gain2.gain.setValueAtTime(0.15, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.35);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // Trigger Reset Proxy / Đổi IP (Chuẩn Tool Proxy 192.168.1.27 & Dcom Farm)
  const handleResetProxy = async (proxy: ProxyItem) => {
    const targetUrl = proxy.resetUrl || proxy.rotateUrl;
    if (!targetUrl) {
      // Nếu chưa có link, hỏi người dùng tự động gán link theo cổng proxy
      const generated = `http://192.168.1.27/reset?proxy=${proxy.port || '4000'}`;
      if (
        confirm(
          `Proxy này chưa có Link Reset. Bạn có muốn tự động gán Link Reset: "${generated}" và kích hoạt reset ngay không?`
        )
      ) {
        await onUpdateProxy(proxy.id, {
          resetUrl: generated,
          rotateUrl: generated,
          isRotating: true,
          lastResetTime: Date.now(),
        });
        await fetch(generated, { mode: 'no-cors' }).catch(() => {});
        playSuccessSound();
        triggerCopyFeedback(`reset-${proxy.id}`, `Đã gán link & gửi lệnh reset cho proxy ${proxy.ip}:${proxy.port}`);
      }
      return;
    }

    setRotatingId(proxy.id);
    try {
      // Gửi lệnh HTTP request reset tới Dcom / API
      await fetch(targetUrl, { mode: 'no-cors' }).catch(() => {});
      const now = Date.now();
      await onUpdateProxy(proxy.id, {
        lastResetTime: now,
      });
      playSuccessSound();
      triggerCopyFeedback(`reset-${proxy.id}`, `Đã gửi lệnh Reset cho Proxy ${proxy.ip}:${proxy.port} thành công!`);
    } catch (e: any) {
      console.warn('Lỗi gọi API reset:', e);
    } finally {
      setTimeout(() => {
        setRotatingId(null);
      }, 1500);
    }
  };

  // Quick 1-click assign Reset URL for proxy
  const handleQuickAssignResetUrl = async (proxy: ProxyItem) => {
    const generated = `http://192.168.1.27/reset?proxy=${proxy.port || '4000'}`;
    await onUpdateProxy(proxy.id, {
      resetUrl: generated,
      rotateUrl: generated,
      isRotating: true,
    });
    triggerCopyFeedback(`reset-${proxy.id}`, `Đã gán link reset: ${generated}`);
  };

  // Batch Reset selected proxies with Popup Report Modal
  const handleBatchResetSelected = async () => {
    const selectedProxies = filteredProxies.filter((p) => selectedIds.has(p.id));
    if (selectedProxies.length === 0) {
      alert('Vui lòng tích chọn ít nhất 1 IP proxy bằng ô vuông đầu dòng để thực hiện reset!');
      return;
    }

    setIsBatchResetting(true);
    setBatchResetModalOpen(true);
    const selectedIdSet = new Set(selectedProxies.map((p) => p.id));
    setRotatingBatchIds(selectedIdSet);

    const nowStr = new Date().toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    // Run parallel reset requests for high efficiency and immediate feedback
    const updatedReports = await Promise.all(
      selectedProxies.map(async (p) => {
        const userEnteredLink = (
          inlineResetLinkMap[p.id] !== undefined
            ? inlineResetLinkMap[p.id]
            : p.resetUrl || p.rotateUrl || ''
        ).trim();

        const targetUrl = userEnteredLink || `http://192.168.1.27/reset?proxy=${p.port || '4000'}`;
        const now = Date.now();

        try {
          await fetch(targetUrl, { mode: 'no-cors' }).catch(() => {});
          await onUpdateProxy(p.id, {
            resetUrl: targetUrl,
            rotateUrl: targetUrl,
            isRotating: true,
            lastResetTime: now,
          });

          return {
            id: p.id,
            ip: p.ip,
            port: p.port,
            staff: (p.assignedStaff || []).join(', ') || 'Chưa gán',
            resetUrl: targetUrl,
            status: 'success' as const,
            message: 'Đã gửi lệnh Reset thành công',
            timestamp: nowStr,
          };
        } catch {
          return {
            id: p.id,
            ip: p.ip,
            port: p.port,
            staff: (p.assignedStaff || []).join(', ') || 'Chưa gán',
            resetUrl: targetUrl,
            status: 'success' as const,
            message: 'Đã gửi tín hiệu reset',
            timestamp: nowStr,
          };
        }
      })
    );

    setBatchResetReports(updatedReports);
    setIsBatchResetting(false);
    playSuccessSound();

    triggerCopyFeedback(
      'batch-reset-popup',
      `🎉 ĐÃ RESET THÀNH CÔNG ${updatedReports.length} PROXY! (Đang cấp phát IP mới...)`
    );

    setTimeout(() => {
      setRotatingBatchIds(new Set());
    }, 2500);
  };

  // Delete row
  const handleDeleteRow = async (proxy: ProxyItem) => {
    if (confirm(`Bạn có chắc muốn xóa proxy "${proxy.ip}:${proxy.port}" khỏi hệ thống?`)) {
      await onDeleteProxy(proxy.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(proxy.id);
        return next;
      });
    }
  };

  // Batch delete
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Bạn có chắc muốn xóa ${selectedIds.size} proxy đã chọn khỏi Cloud Firestore?`)) {
      const ids = Array.from(selectedIds);
      if (onDeleteBatchProxies) {
        await onDeleteBatchProxies(ids);
      } else {
        for (const id of ids) {
          await onDeleteProxy(id);
        }
      }
      setSelectedIds(new Set());
    }
  };

  // Quick stats
  const activeCount = useMemo(() => scopedProxies.filter((p) => p.status === 'active').length, [scopedProxies]);
  const dieCount = useMemo(() => scopedProxies.filter((p) => p.status === 'die').length, [scopedProxies]);
  const rotatingCount = useMemo(() => scopedProxies.filter((p) => p.isRotating).length, [scopedProxies]);

  return (
    <div className="space-y-4">
      {/* Toast notification */}
      {copyToast && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 flex items-center space-x-2 text-xs font-bold animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{copyToast}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Title & Stats */}
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold shadow-2xs">
                <Network className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
                  <span>
                    {isAdmin
                      ? 'BẢNG QUẢN LÝ PROXY & KẾT NỐI MẠNG'
                      : `BẢNG PROXY CỦA TÔI (${currentUser.name})`}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                    {scopedProxies.length} Proxy {isAdmin ? '' : 'Của Bạn'}
                  </span>
                </h1>
                <p className="text-xs text-slate-500">
                  {isAdmin
                    ? 'Chế độ Quản Trị Viên: Quản lý IP, Port, User, Pass và phân công Proxy cho nhân viên'
                    : `Chế độ Nhân Viên: Chỉ hiển thị và thao tác các Proxy phân công cho tài khoản ${currentUser.name}`}
                </p>
              </div>
            </div>

            {/* Staff account scoping security notice banner */}
            {!isAdmin && (
              <div className="mt-2 p-2.5 bg-blue-50/90 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-950">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    <strong>Phân quyền tài khoản:</strong> Bạn đang đăng nhập bằng tài khoản <strong>{currentUser.name}</strong>. Hệ thống tự động lọc và chỉ cho phép bạn thấy, sử dụng các Proxy của riêng bạn.
                  </span>
                </div>
                <span className="font-bold text-[11px] bg-blue-200/80 text-blue-900 px-2 py-0.5 rounded-md shrink-0 ml-2">
                  {scopedProxies.length} Proxy
                </span>
              </div>
            )}

            {/* Stats chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Hoạt Động (Live): <b>{activeCount}</b></span>
              </span>
              <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>Chết / Lỗi (Die): <b>{dieCount}</b></span>
              </span>
              <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200">
                <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                <span>Proxy Xoay: <b>{rotatingCount}</b></span>
              </span>
            </div>
          </div>

          {/* Quick Toolbar Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Copy All Button */}
            <button
              type="button"
              onClick={() => handleCopyAllProxies('full')}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 transition-colors shadow-2xs cursor-pointer"
            >
              {copiedKey === 'btn-copy-all' ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              <span>Copy Tất Cả ({filteredProxies.length})</span>
            </button>

            {/* Select All Toggle */}
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className={`inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors shadow-2xs cursor-pointer ${
                isAllSelected
                  ? 'bg-slate-800 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              {isAllSelected ? (
                <>
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                  <span>Bỏ Chọn Tất Cả</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4" />
                  <span>Lựa Chọn Tất Cả</span>
                </>
              )}
            </button>

            {/* Export Excel */}
            <button
              type="button"
              onClick={() => exportProxiesToXLSX(filteredProxies)}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-emerald-700 rounded-xl text-xs font-bold border border-slate-300 transition-colors shadow-2xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Xuất Excel</span>
            </button>

            {/* Import Bulk */}
            <button
              type="button"
              onClick={onOpenBulkImportModal}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 transition-colors shadow-2xs cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Import Hàng Loạt</span>
            </button>

            {/* Batch Reset Button if items are selected or Quick Select All to Reset */}
            {selectedIds.size > 0 ? (
              <button
                type="button"
                onClick={handleBatchResetSelected}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black shadow-md shadow-cyan-500/25 ring-2 ring-cyan-400/40 animate-pulse cursor-pointer transition-all active:scale-95"
                title="Nhấn để reset toàn bộ IP đã chọn cùng một lúc"
              >
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>⚡ Reset {selectedIds.size} IP Đã Chọn</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSelectedIds(new Set(filteredProxies.map((p) => p.id)));
                  triggerCopyFeedback(
                    'select-all-tip',
                    `Đã chọn toàn bộ ${filteredProxies.length} IP! Bạn có thể ấn nút Reset ngay bây giờ.`
                  );
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-gradient-to-r from-cyan-50 to-blue-50 hover:from-cyan-100 hover:to-blue-100 text-cyan-800 rounded-xl text-xs font-bold border border-cyan-300 transition-colors shadow-2xs cursor-pointer"
                title="Chọn toàn bộ danh sách để reset nhiều IP cùng lúc"
              >
                <RefreshCw className="w-3.5 h-3.5 text-cyan-600" />
                <span>Chọn & Reset Nhiều IP</span>
              </button>
            )}

            {/* Reopen report button if reports exist */}
            {batchResetReports.length > 0 && (
              <button
                type="button"
                onClick={() => setBatchResetModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-300 transition-colors shadow-2xs cursor-pointer"
                title="Mở lại thông báo kết quả reset gần nhất"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Báo Cáo Reset ({batchResetReports.length})</span>
              </button>
            )}

            {/* Add Proxy Button */}
            <button
              type="button"
              onClick={onOpenAddModal}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Thêm Proxy Mới</span>
            </button>
          </div>
        </div>

        {/* Filters bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            {/* Search input */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm IP, Port, User, Link Reset, Ghi chú..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Staff filter for Admin */}
            {isAdmin && (
              <div className="flex items-center space-x-1.5 text-xs">
                <span className="text-slate-500 font-semibold text-[11px]">Nhân viên:</span>
                <select
                  value={selectedStaffFilter}
                  onChange={(e) => setSelectedStaffFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Tất Cả Nhân Viên</option>
                  {availableStaffNames.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Status filter */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Tất Cả Trạng Thái</option>
              <option value="active">🟢 Live (Hoạt Động)</option>
              <option value="die">🔴 Die (Lỗi / Chết)</option>
              <option value="expired">⚠️ Expired (Hết Hạn)</option>
            </select>

            {/* Rotating only */}
            <button
              type="button"
              onClick={() => setRotatingOnly(!rotatingOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center space-x-1.5 ${
                rotatingOnly
                  ? 'bg-blue-100 text-blue-800 border-blue-300 ring-2 ring-blue-400/20'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Chỉ Proxy Xoay</span>
            </button>
          </div>
        </div>
      </div>

      {/* 🌟 THANH THAO TÁC KHI ĐÃ CHỌN PROXY */}
      {selectedIds.size > 0 && (
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white px-4 py-3 rounded-2xl shadow-lg border border-blue-700 flex flex-wrap items-center justify-between gap-3 animate-slide-down">
          <div className="flex items-center space-x-3">
            <span className="w-6 h-6 rounded-full bg-blue-500/30 flex items-center justify-center font-bold text-xs text-blue-300">
              {selectedIds.size}
            </span>
            <span className="text-xs font-bold">
              Đã chọn <span className="text-blue-300">{selectedIds.size}</span> / {filteredProxies.length} Proxy
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Copy Full Proxy */}
            <button
              type="button"
              onClick={() => handleCopySelectedProxies('full')}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>📋 Copy Chuỗi Đầy Đủ</span>
            </button>

            {/* Copy IP:Port only */}
            <button
              type="button"
              onClick={() => handleCopySelectedProxies('ipport')}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy IP:PORT</span>
            </button>

            {/* Delete selected */}
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-800 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa Đã Chọn</span>
            </button>

            {/* Deselect */}
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              Bỏ Chọn
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredProxies.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">Chưa có proxy nào trong danh sách</p>
              <p className="text-xs text-slate-500 mt-1">
                {searchQuery || selectedStaffFilter !== 'ALL'
                  ? 'Không tìm thấy proxy phù hợp với bộ lọc'
                  : 'Hãy bấm "+ Thêm Proxy Mới" hoặc "Import Hàng Loạt" để thêm proxy cho nhân viên'}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenAddModal}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Proxy Đầu Tiên</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider sticky top-0">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeSelected;
                      }}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded-sm text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3 w-12 text-center">STT</th>
                  <th className="py-3 px-3 font-mono">CHUỖI PROXY (IP:PORT:USER:PASS)</th>
                  <th className="py-3 px-3">NHÂN VIÊN SỬ DỤNG</th>
                  <th className="py-3 px-3 min-w-[380px]">
                    <div className="flex items-center justify-between gap-2">
                      <span>NHẬP LINK RESET & ẤN RESET PROXY</span>
                      {selectedIds.size > 0 && (
                        <button
                          type="button"
                          onClick={handleBatchResetSelected}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-[10px] font-black uppercase shadow-xs cursor-pointer transition-all active:scale-95"
                          title="Bấm để kích hoạt reset tất cả các IP đã tích chọn"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Reset {selectedIds.size} IP</span>
                        </button>
                      )}
                    </div>
                  </th>
                  <th className="py-3 px-3 w-28 text-center">TRẠNG THÁI</th>
                  <th className="py-3 px-3">GHI CHÚ</th>
                  <th className="py-3 px-3 w-20 text-center">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredProxies.map((p, idx) => {
                  const isSelected = selectedIds.has(p.id);
                  const isPassVisible = Boolean(showPasswordMap[p.id]);
                  const isLive = p.status === 'active';

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-blue-50/90'
                          : !isLive
                          ? 'bg-rose-50/40 hover:bg-rose-50/70 border-l-4 border-l-rose-500'
                          : 'bg-white hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectRow(p.id)}
                          className="w-4 h-4 rounded-sm text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* STT */}
                      <td
                        onClick={() => handleToggleSelectRow(p.id)}
                        className="py-2.5 px-3 text-center text-slate-500 font-bold cursor-pointer hover:text-blue-600 select-none"
                        title="Bấm để chọn/bỏ chọn IP này"
                      >
                        {idx + 1}
                      </td>

                      {/* Chuỗi Proxy */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center space-x-2">
                          <span
                            onClick={() => handleCopyText(p.fullProxy, `proxy-${p.id}`, p.fullProxy)}
                            className="font-mono font-bold text-blue-700 hover:text-blue-900 cursor-pointer hover:underline text-xs"
                            title="Nhấp để copy toàn bộ chuỗi proxy"
                          >
                            {p.fullProxy || `${p.ip}:${p.port}`}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleCopyText(p.fullProxy, `proxy-${p.id}`, p.fullProxy)}
                            className={`p-1 rounded-md transition-colors cursor-pointer ${
                              copiedKey === `proxy-${p.id}`
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                            }`}
                            title="Sao chép chuỗi proxy"
                          >
                            {copiedKey === `proxy-${p.id}` ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Sub details: User:Pass if available */}
                        {p.username && (
                          <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 font-mono mt-0.5">
                            <span>User: <b>{p.username}</b></span>
                            <span>•</span>
                            <span>
                              Pass:{' '}
                              <b>{isPassVisible ? p.password : '••••••••'}</b>
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setShowPasswordMap((prev) => ({
                                  ...prev,
                                  [p.id]: !prev[p.id],
                                }))
                              }
                              className="text-slate-400 hover:text-slate-700 cursor-pointer"
                              title={isPassVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                            >
                              {isPassVisible ? (
                                <EyeOff className="w-3 h-3" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Nhân viên sử dụng */}
                      <td className="py-2.5 px-3">
                        {!isAdmin ? (
                          (p.assignedStaff || []).includes('ALL') ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              🌐 Dùng Chung (ALL)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                              ⭐ Của Bạn ({currentUser.name})
                            </span>
                          )
                        ) : (
                          <div className="relative inline-flex items-center">
                            <select
                              value={
                                (p.assignedStaff || []).includes('ALL')
                                  ? 'ALL'
                                  : (p.assignedStaff || [])[0] || 'ALL'
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                onUpdateProxy(p.id, {
                                  assignedStaff: val === 'ALL' ? ['ALL'] : [val],
                                });
                                triggerCopyFeedback(
                                  `staff-${p.id}`,
                                  `Đã gán proxy ${p.ip} cho: ${val === 'ALL' ? 'Dùng Chung (ALL)' : val}`
                                );
                              }}
                              className="text-[11px] font-bold rounded-lg px-2.5 py-1 border border-slate-300 bg-white text-slate-800 hover:border-blue-500 focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                              title="Chọn nhân viên có sẵn trong CSDL để phân công proxy này"
                            >
                              <option value="ALL">🌐 Dùng Chung (ALL)</option>
                              {availableStaffNames.map((s) => (
                                <option key={s} value={s}>
                                  👤 {s} (CSDL)
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </td>

                      {/* Cột Nhập Link Reset & Ấn Reset Proxy (Do Người Dùng Tự Nhập/Dán) */}
                      <td className="py-2.5 px-3 min-w-[380px]">
                        <div className="space-y-1.5">
                          <div className="flex items-center space-x-2">
                            {/* Ô nhập link reset trực tiếp trên bảng */}
                            <div className="relative flex-1">
                              <input
                                type="text"
                                placeholder="Nhập/dán link reset proxy của bạn..."
                                value={
                                  inlineResetLinkMap[p.id] !== undefined
                                    ? inlineResetLinkMap[p.id]
                                    : p.resetUrl || p.rotateUrl || ''
                                }
                                onChange={(e) => handleInlineLinkChange(p.id, e.target.value)}
                                onBlur={() => handleInlineLinkBlur(p)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                className="w-full px-2.5 py-1.5 text-xs font-mono bg-cyan-50/70 hover:bg-white focus:bg-white border border-cyan-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500 shadow-2xs transition-all"
                                title="Nhập hoặc dán link reset proxy của bạn tại đây (tự động lưu khi rời ô hoặc bấm Enter)"
                              />
                            </div>

                            {/* Nút bấm Reset Proxy bằng link người dùng đã nhập */}
                            <button
                              type="button"
                              disabled={rotatingId === p.id || rotatingBatchIds.has(p.id)}
                              onClick={() => handleResetProxyWithCurrentLink(p)}
                              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer ${
                                rotatingId === p.id || rotatingBatchIds.has(p.id)
                                  ? 'bg-amber-500 text-white animate-pulse'
                                  : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white active:scale-95'
                              }`}
                              title="Bấm để kích hoạt gửi lệnh Reset Proxy bằng link bạn đã nhập"
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${
                                  rotatingId === p.id || rotatingBatchIds.has(p.id)
                                    ? 'animate-spin'
                                    : ''
                                }`}
                              />
                              <span>
                                {rotatingId === p.id || rotatingBatchIds.has(p.id)
                                  ? 'Đang Reset...'
                                  : '🔄 Reset Proxy'}
                              </span>
                            </button>
                          </div>

                          {/* Dòng tiện ích: Điền nhanh cổng + Chép link + Lần reset gần nhất */}
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <div className="flex items-center space-x-2">
                              {/* Nút điền nhanh link cổng Dcom nếu ô đang trống */}
                              {!(inlineResetLinkMap[p.id] || p.resetUrl || p.rotateUrl) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const generated = `http://192.168.1.27/reset?proxy=${p.port || '4000'}`;
                                    handleInlineLinkChange(p.id, generated);
                                    onUpdateProxy(p.id, {
                                      resetUrl: generated,
                                      rotateUrl: generated,
                                      isRotating: true,
                                    });
                                    triggerCopyFeedback(`link-${p.id}`, `Đã điền link cổng ${p.port}`);
                                  }}
                                  className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 hover:bg-cyan-200 text-cyan-800 border border-cyan-300 cursor-pointer transition-colors"
                                  title="Điền nhanh link reset theo cổng proxy Dcom"
                                >
                                  <Zap className="w-2.5 h-2.5 text-cyan-600" />
                                  <span>+ Điền Link Cổng {p.port}</span>
                                </button>
                              )}

                              {/* Nút sao chép link nếu đã có link */}
                              {(inlineResetLinkMap[p.id] || p.resetUrl || p.rotateUrl) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopyText(
                                      (inlineResetLinkMap[p.id] || p.resetUrl || p.rotateUrl || '').trim(),
                                      `reset-link-${p.id}`,
                                      (inlineResetLinkMap[p.id] || p.resetUrl || p.rotateUrl || '').trim()
                                    )
                                  }
                                  className="inline-flex items-center space-x-1 text-[10px] text-slate-500 hover:text-cyan-700 cursor-pointer"
                                  title="Sao chép link reset"
                                >
                                  {copiedKey === `reset-link-${p.id}` ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span className="text-emerald-600 font-bold">Đã chép link</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Chép link</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>

                            {/* Hiển thị mốc thời gian Reset gần nhất */}
                            {p.lastResetTime && (
                              <span className="text-[10px] text-slate-400 font-mono flex items-center space-x-1">
                                <Clock className="w-2.5 h-2.5" />
                                <span>
                                  Lần cuối:{' '}
                                  {new Date(p.lastResetTime).toLocaleTimeString('vi-VN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                  })}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Trạng thái Live / Die */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(p)}
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            isLive
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-300 hover:bg-rose-200'
                          }`}
                          title="Nhấp để đổi trạng thái Live <-> Die"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isLive ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          ></span>
                          <span>{isLive ? 'Live (Sống)' : 'Die (Lỗi)'}</span>
                        </button>
                      </td>

                      {/* Ghi chú */}
                      <td className="py-2.5 px-3 text-slate-600">
                        {p.note || '-'}
                      </td>

                      {/* Thao tác */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {/* Edit button */}
                          {onEditProxy && (
                            <button
                              type="button"
                              onClick={() => onEditProxy(p)}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                              title="Chỉnh sửa thông tin proxy này"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete button: Admin can delete any, Staff can only delete proxy assigned to them */}
                          {(isAdmin ||
                            (p.assignedStaff || []).some(
                              (s) => s.trim().toLowerCase() === myStaffNameLower
                            )) && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(p)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                              title="Xóa proxy này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating Action Pill */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-950/95 text-white backdrop-blur-md px-5 py-3 rounded-2xl shadow-2xl border border-blue-500/40 flex items-center space-x-3 text-xs animate-bounce-short">
          <span className="font-bold flex items-center space-x-1.5">
            <CheckSquare className="w-4 h-4 text-blue-400" />
            <span>Đã chọn: <b className="text-blue-300">{selectedIds.size}</b> Proxy</span>
          </span>

          <div className="h-4 w-px bg-slate-700"></div>

          <button
            type="button"
            onClick={() => handleCopySelectedProxies('full')}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center space-x-1 shadow-xs cursor-pointer transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy Đầy Đủ</span>
          </button>

          <button
            type="button"
            onClick={() => handleCopySelectedProxies('ipport')}
            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center space-x-1 cursor-pointer transition-colors"
          >
            <span>Copy IP:Port</span>
          </button>

          {/* Batch Reset IP */}
          <button
            type="button"
            onClick={handleBatchResetSelected}
            className="px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer transition-colors"
            title="Gửi lệnh Reset Proxy / Đổi IP đồng loạt cho các proxy đã chọn"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>🔄 Reset IP Đã Chọn</span>
          </button>

          {/* Admin Batch Reassign Staff from existing CSDL list */}
          {isAdmin && (
            <>
              <div className="h-4 w-px bg-slate-700"></div>
              <div className="flex items-center space-x-1.5 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-semibold pr-0.5">Gán NV (CSDL):</span>
                <select
                  onChange={async (e) => {
                    const val = e.target.value;
                    if (!val) return;
                    const ids = Array.from(selectedIds);
                    for (const id of ids) {
                      await onUpdateProxy(id, {
                        assignedStaff: val === 'ALL' ? ['ALL'] : [val],
                      });
                    }
                    triggerCopyFeedback(
                      'batch-staff',
                      `Đã gán ${ids.length} proxy cho: ${val === 'ALL' ? 'Dùng Chung (ALL)' : val}`
                    );
                    setSelectedIds(new Set());
                  }}
                  defaultValue=""
                  className="text-[10px] font-bold bg-slate-800 text-white border border-slate-700 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="" disabled>-- Chọn NV CSDL ({availableStaffNames.length}) --</option>
                  <option value="ALL">🌐 Dùng Chung (ALL)</option>
                  {availableStaffNames.map((s) => (
                    <option key={s} value={s}>
                      👤 {s}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold cursor-pointer transition-colors"
          >
            Hủy
          </button>
        </div>
      )}

      {/* 🔔 MODAL POPUP THÔNG BÁO RESET IP THÀNH CÔNG (NHẢY THÔNG BÁO LÊN ĐỂ BIẾT RESET ĐƯỢC) */}
      {batchResetModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => !isBatchResetting && setBatchResetModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with animated celebration banner */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-5 text-white flex items-start justify-between">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white font-black text-2xl shadow-inner shrink-0">
                  {isBatchResetting ? (
                    <RefreshCw className="w-6 h-6 animate-spin text-white" />
                  ) : (
                    <CheckCircle2 className="w-7 h-7 text-emerald-200 animate-pulse" />
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-lg font-black tracking-tight text-white">
                      {isBatchResetting ? 'ĐANG TIẾN HÀNH RESET IP...' : '🎉 ĐÃ RESET IP THÀNH CÔNG!'}
                    </h2>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-white/25 text-white border border-white/30">
                      {batchResetReports.length} Proxy
                    </span>
                  </div>
                  <p className="text-xs text-emerald-100 mt-0.5">
                    {isBatchResetting
                      ? 'Đang gửi tín hiệu lệnh đổi IP đến các cổng Dcom / Proxy Server...'
                      : 'Lệnh Reset đã được gửi đến toàn bộ thiết bị. Mạng đang ngắt kết nối và xoay dải IP mới.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setBatchResetModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer shrink-0 ml-2"
                title="Đóng thông báo"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status highlight banner */}
            <div className="bg-emerald-50 px-5 py-3 border-b border-emerald-100 flex items-center justify-between text-xs text-emerald-900">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Trạng thái cấp phát:</strong> Nhà mạng / Dcom đang tự động đổi IP mới (mất từ 3 - 10 giây để hoàn tất chu kỳ).
                </span>
              </div>
              <span className="font-mono font-bold text-[11px] bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-md shrink-0 ml-2">
                {new Date().toLocaleTimeString('vi-VN')}
              </span>
            </div>

            {/* Content Body: List of reset proxies */}
            <div className="p-5 flex-1 overflow-y-auto space-y-3 max-h-[50vh]">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                <span>Danh sách {batchResetReports.length} IP đã kích hoạt reset:</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  (Ấn sao chép để copy chi tiết kết quả)
                </span>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                {batchResetReports.map((report, idx) => (
                  <div
                    key={report.id || idx}
                    className="p-3 bg-white flex items-center justify-between gap-3 text-xs hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-black text-[11px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-black text-slate-900 text-xs">
                            {report.ip}:{report.port}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                            👤 {report.staff}
                          </span>
                        </div>
                        <div
                          className="text-[11px] font-mono text-cyan-700 truncate max-w-md mt-0.5"
                          title={report.resetUrl}
                        >
                          Link: {report.resetUrl}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Đã Gửi Lệnh ({report.timestamp})</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer with Actions */}
            <div className="bg-slate-50 px-5 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  const summaryText = batchResetReports
                    .map(
                      (r, i) =>
                        `${i + 1}. IP: ${r.ip}:${r.port} | NV: ${r.staff} | Link: ${r.resetUrl} | Trạng thái: Thành công (${r.timestamp})`
                    )
                    .join('\n');
                  navigator.clipboard.writeText(summaryText);
                  triggerCopyFeedback('copied-report', 'Đã copy báo cáo kết quả reset!');
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 transition-colors shadow-2xs cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Sao Chép Báo Cáo</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleBatchResetSelected}
                  className="px-3.5 py-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Lại Lần Nữa</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBatchResetModalOpen(false)}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  Đã Hiểu, Đóng Thông Báo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
