import React, { useState, useMemo, useEffect } from 'react';
import {
  Copy,
  Check,
  Eye,
  EyeOff,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  KeyRound,
  Plus,
  Search,
  Key,
  ExternalLink,
  Edit2,
  Trash2,
  Sparkles,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Users,
  UserCheck,
  Clock,
  Layers,
  X,
  Save,
  ArrowRightLeft,
  Zap,
  Bell,
  FileText,
  CheckSquare,
} from 'lucide-react';
import { FullViaItem, AppUser, PageRecord, ViaPageUpdateStatus, ViaAdminReportStatus, VIA_ADMIN_REPORT_OPTIONS } from '../types';
import { generateTOTPCode } from '../utils/totp';
import { downloadViaExcelTemplate } from '../utils/excelTemplates';

interface FullViaTableProps {
  viaList: FullViaItem[];
  allRecords: PageRecord[];
  currentUser: AppUser;
  availableStaffNames: string[];
  activeStaffFilter?: string;
  adminPin?: string;
  currentUserPin?: string;
  onBackToFanpageTab?: () => void;
  onAddVia: (via: FullViaItem) => void;
  onUpdateVia: (via: FullViaItem) => void;
  onDeleteVia: (viaId: string) => void;
  onOpenBulkImport: (presetStaff?: string) => void;
  onFilterPageByVia?: (viaUid: string) => void;
  onAddPageForVia?: (viaUid: string, staffName: string) => void;
  onSyncStaffFilter?: (staffName: string) => void;
  onTransferViaPages?: (viaUid: string) => void;
  onFetchPagesForVia?: (viaUid: string, staffName: string) => void;
}

export const FullViaTable: React.FC<FullViaTableProps> = ({
  viaList,
  allRecords,
  currentUser,
  availableStaffNames,
  activeStaffFilter,
  adminPin,
  currentUserPin,
  onBackToFanpageTab,
  onAddVia,
  onUpdateVia,
  onDeleteVia,
  onOpenBulkImport,
  onFilterPageByVia,
  onAddPageForVia,
  onSyncStaffFilter,
  onTransferViaPages,
  onFetchPagesForVia,
}) => {
  // LAYER 1: STRICT SCOPING GATE
  // Ensures that regardless of any code bugs upstream, Staff can NEVER access other users' data
  const strictlyGuardedVias = useMemo(() => {
    if (!viaList || !Array.isArray(viaList)) return [];
    if (!currentUser.isAuthenticated || currentUser.id === 'guest') return [];
    if (currentUser.role === 'admin') return viaList;
    if (currentUser.role === 'staff') {
      const myName = currentUser.name.trim().toLowerCase();
      return viaList.filter((v) => v.staffName && v.staffName.trim().toLowerCase() === myName);
    }
    return [];
  }, [viaList, currentUser]);

  // VAULT GATE (PIN LOCK) STATE
  const [isVaultUnlocked, setIsVaultUnlocked] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isPinVisible, setIsPinVisible] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLockout, setIsLockout] = useState(false);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  // MASKING STATES
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  const [visiblePasswordRowIds, setVisiblePasswordRowIds] = useState<Set<string>>(new Set());
  const [showAll2Fa, setShowAll2Fa] = useState(false);
  const [visible2FaRowIds, setVisible2FaRowIds] = useState<Set<string>>(new Set());

  // EXPORT CSV PIN CONFIRMATION MODAL
  const [isExportPinModalOpen, setIsExportPinModalOpen] = useState(false);
  const [exportPinInput, setExportPinInput] = useState('');
  const [exportPinError, setExportPinError] = useState<string | null>(null);

  // MODAL FIELD VISIBILITY
  const [isModalPassVisible, setIsModalPassVisible] = useState(false);
  const [isModalTwoFaVisible, setIsModalTwoFaVisible] = useState(false);

  // PIN resolution
  const requiredPin = useMemo(() => {
    if (currentUser.role === 'admin') {
      return (adminPin || 'admin123').trim();
    }
    return (currentUserPin || '123456').trim();
  }, [currentUser.role, adminPin, currentUserPin]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'error' | 'checkpoint' | 'fixed' | 'pending_page' | 'has_page' | 'no_page'>('all');
  const [adminReportFilter, setAdminReportFilter] = useState<'all' | ViaAdminReportStatus>('all');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>(
    currentUser.role === 'staff'
      ? currentUser.name
      : activeStaffFilter && activeStaffFilter !== 'all'
      ? activeStaffFilter
      : 'all'
  );
  const [isGroupedByStaff, setIsGroupedByStaff] = useState(false);

  // Sync with activeStaffFilter from parent if admin
  React.useEffect(() => {
    if (currentUser.role === 'admin' && activeStaffFilter) {
      setSelectedStaffFilter(activeStaffFilter);
    }
  }, [activeStaffFilter, currentUser.role]);

  // Copy indicator state: stores string key of what was copied (e.g. 'uid-1000', 'pass-1000', '2fa-1000', 'full-1000')
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copyToastMessage, setCopyToastMessage] = useState<string | null>(null);

  // Multiple selection state for batch copying UID
  const [selectedViaIds, setSelectedViaIds] = useState<Set<string>>(new Set());

  // Live TOTP generator state: stores { viaId: { code: string; remainingSeconds: number } }
  const [liveOtpMap, setLiveOtpMap] = useState<Record<string, { code: string; remainingSeconds: number; loading?: boolean }>>({});

  // Add / Edit Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingVia, setEditingVia] = useState<FullViaItem | null>(null);
  const [modalForm, setModalForm] = useState<{
    uid: string;
    pass: string;
    twoFa: string;
    staffName: string;
    note: string;
    status: 'active' | 'checkpoint' | 'dead' | 'error' | 'fixed';
    isError?: boolean;
    isFixed?: boolean;
    pageUpdateStatus: ViaPageUpdateStatus;
    adminReportStatus?: ViaAdminReportStatus;
  }>({
    uid: '',
    pass: '',
    twoFa: '',
    staffName: availableStaffNames[0] || 'Anh Quỳnh',
    note: '',
    status: 'active',
    isError: false,
    isFixed: false,
    pageUpdateStatus: 'none',
    adminReportStatus: 'None',
  });

  // Calculate pages associated with each viaUid
  const pagesPerViaUid = useMemo(() => {
    const map = new Map<string, PageRecord[]>();
    allRecords.forEach((r) => {
      const uid = r.viaUid?.trim();
      if (!uid) return;
      if (!map.has(uid)) {
        map.set(uid, []);
      }
      map.get(uid)!.push(r);
    });
    return map;
  }, [allRecords]);

  // List of all distinct staff names from both availableStaffNames and current strictlyGuardedVias
  const distinctStaffNames = useMemo(() => {
    if (currentUser.role === 'staff') {
      return [currentUser.name];
    }
    const list: string[] = [];
    const seen = new Set<string>();

    availableStaffNames.forEach((n) => {
      const trimmed = n.trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        list.push(trimmed);
      }
    });

    strictlyGuardedVias.forEach((v) => {
      const trimmed = v.staffName?.trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        list.push(trimmed);
      }
    });

    return list;
  }, [availableStaffNames, strictlyGuardedVias, currentUser]);

  // Statistics per staff for quick badges
  const staffStats = useMemo(() => {
    const stats: Record<string, { total: number; active: number; checkpoint: number; dead: number }> = {};
    distinctStaffNames.forEach((name) => {
      stats[name] = { total: 0, active: 0, checkpoint: 0, dead: 0 };
    });

    strictlyGuardedVias.forEach((v) => {
      const name = v.staffName?.trim() || 'Chưa gán';
      if (!stats[name]) {
        stats[name] = { total: 0, active: 0, checkpoint: 0, dead: 0 };
      }
      stats[name].total++;
      if (v.status === 'checkpoint') stats[name].checkpoint++;
      else if (v.status === 'dead') stats[name].dead++;
      else stats[name].active++;
    });

    return stats;
  }, [distinctStaffNames, strictlyGuardedVias]);

  // Visual theme helper per staff
  const getStaffTheme = (staffName: string) => {
    const s = staffName.trim().toLowerCase();
    if (s.includes('quỳnh') || s.includes('quynh')) {
      return {
        badge: 'bg-blue-50 text-blue-800 border-blue-200',
        activeTab: 'bg-blue-600 text-white shadow-xs border-blue-600',
        inactiveTab: 'bg-blue-50/70 text-blue-900 hover:bg-blue-100 border-blue-200',
        dot: 'bg-blue-500',
        accentBorder: 'border-blue-300',
      };
    }
    if (s.includes('bảo') || s.includes('bao')) {
      return {
        badge: 'bg-purple-50 text-purple-800 border-purple-200',
        activeTab: 'bg-purple-600 text-white shadow-xs border-purple-600',
        inactiveTab: 'bg-purple-50/70 text-purple-900 hover:bg-purple-100 border-purple-200',
        dot: 'bg-purple-500',
        accentBorder: 'border-purple-300',
      };
    }
    if (s.includes('my') || s.includes('phương')) {
      return {
        badge: 'bg-rose-50 text-rose-800 border-rose-200',
        activeTab: 'bg-rose-600 text-white shadow-xs border-rose-600',
        inactiveTab: 'bg-rose-50/70 text-rose-900 hover:bg-rose-100 border-rose-200',
        dot: 'bg-rose-500',
        accentBorder: 'border-rose-300',
      };
    }
    return {
      badge: 'bg-teal-50 text-teal-800 border-teal-200',
      activeTab: 'bg-teal-600 text-white shadow-xs border-teal-600',
      inactiveTab: 'bg-teal-50/70 text-teal-900 hover:bg-teal-100 border-teal-200',
      dot: 'bg-teal-500',
      accentBorder: 'border-teal-300',
    };
  };

  // Permission filter: Staff only sees their own; Admin sees all (or filtered by staff tab/dropdown)
  // Helper to check if a via is in error state or marked red
  const isViaError = (v: FullViaItem) => {
    return Boolean(v.isError) || v.status === 'error' || v.status === 'dead';
  };

  // Helper: Admin đã tự cập nhật báo "Đã có Page" (Màu Đỏ) -> Chờ nhân viên update page lên
  const isViaPendingPageUpdate = (via: FullViaItem): boolean => {
    return Boolean(
      via.pageUpdateStatus === 'pending' ||
      (via.hasAdminAssignedPage && via.pageUpdateStatus !== 'updated')
    );
  };

  // Helper: Nick đã có Page và đã được cập nhật (Màu Xanh lá như đang hiển thị)
  const isViaPageUpdated = (via: FullViaItem, pagesCount: number): boolean => {
    if (isViaPendingPageUpdate(via)) return false;
    return Boolean(via.pageUpdateStatus === 'updated' || pagesCount > 0);
  };

  // Quick action: Cập nhật trạng thái Page của Via (Admin tự cập nhật màu đỏ hoặc nhân viên update lên màu xanh)
  const handleSetViaPageStatus = (via: FullViaItem, newStatus: ViaPageUpdateStatus) => {
    const isPending = newStatus === 'pending';
    const isUpdated = newStatus === 'updated';
    const updated: FullViaItem = {
      ...via,
      pageUpdateStatus: newStatus,
      hasAdminAssignedPage: isPending || isUpdated ? true : false,
      ...(isPending ? { pageAssignedAt: new Date().toLocaleDateString('vi-VN') } : {}),
      ...(isUpdated ? { pageUpdatedAt: new Date().toLocaleDateString('vi-VN') } : {}),
    };
    onUpdateVia(updated);
    if (isPending) {
      setCopyToastMessage(`🔴 Đã chuyển nick ${via.uid} sang: Đã Có Page (Màu đỏ)!`);
    } else if (isUpdated) {
      setCopyToastMessage(`🟢 Đã chuyển nick ${via.uid} sang: Đã có Page (Màu xanh lá)!`);
    } else {
      setCopyToastMessage(`⚪ Đã chuyển nick ${via.uid} về: Chưa có page (Màu trắng).`);
    }
    setTimeout(() => setCopyToastMessage(null), 3000);
  };

  // Toggle error status for via (bôi đỏ / bỏ bôi đỏ)
  const handleToggleErrorVia = (via: FullViaItem) => {
    const currentlyError = isViaError(via);
    const nextError = !currentlyError;
    const nextStatus: 'active' | 'error' = nextError ? 'error' : 'active';
    onUpdateVia({
      ...via,
      status: nextStatus,
      isError: nextError,
    });
    setCopyToastMessage(
      nextError
        ? `🔴 Đã bôi màu đỏ nick UID ${via.uid} (Đánh dấu Via Bị Lỗi)`
        : `🟢 Đã khôi phục nick UID ${via.uid} về trạng thái Hoạt Động`
    );
    setTimeout(() => setCopyToastMessage(null), 2500);
  };

  // Base list of vias for the current user/staff scope
  const currentBaseVias = useMemo(() => {
    if (currentUser.role === 'staff') {
      const staffNameLower = currentUser.name.trim().toLowerCase();
      return strictlyGuardedVias.filter((v) => v.staffName.trim().toLowerCase() === staffNameLower);
    }
    if (selectedStaffFilter !== 'all') {
      return strictlyGuardedVias.filter((v) => v.staffName.trim().toLowerCase() === selectedStaffFilter.trim().toLowerCase());
    }
    return strictlyGuardedVias;
  }, [strictlyGuardedVias, currentUser, selectedStaffFilter]);

  const errorCountInScope = useMemo(() => {
    return currentBaseVias.filter((v) => isViaError(v)).length;
  }, [currentBaseVias]);

  const fixedCountInScope = useMemo(() => {
    return currentBaseVias.filter((v) => Boolean(v.isFixed || v.status === 'fixed')).length;
  }, [currentBaseVias]);

  const activeCountInScope = useMemo(() => {
    return currentBaseVias.filter((v) => !isViaError(v) && v.status !== 'checkpoint' && !v.isFixed && v.status !== 'fixed').length;
  }, [currentBaseVias]);

  const checkpointCountInScope = useMemo(() => {
    return currentBaseVias.filter((v) => v.status === 'checkpoint').length;
  }, [currentBaseVias]);

  // Đếm nick Admin đã báo Đã Có Page (Màu đỏ chờ nhân viên update)
  const pendingPageCountInScope = useMemo(() => {
    return currentBaseVias.filter((v) => isViaPendingPageUpdate(v)).length;
  }, [currentBaseVias]);

  // Đếm nick Đã có Page (Màu xanh)
  const hasPageCountInScope = useMemo(() => {
    return currentBaseVias.filter((v) => {
      const uid = v.uid?.trim();
      const pages = uid ? (pagesPerViaUid.get(uid) || pagesPerViaUid.get(uid.toLowerCase()) || []) : [];
      return isViaPageUpdated(v, pages.length);
    }).length;
  }, [currentBaseVias, pagesPerViaUid]);

  // Đếm nick Chưa có Page (Trắng/Trống)
  const noPageCountInScope = useMemo(() => {
    return currentBaseVias.filter((v) => {
      const uid = v.uid?.trim();
      const pages = uid ? (pagesPerViaUid.get(uid) || pagesPerViaUid.get(uid.toLowerCase()) || []) : [];
      return !isViaPendingPageUpdate(v) && !isViaPageUpdated(v, pages.length);
    }).length;
  }, [currentBaseVias, pagesPerViaUid]);

  // Counts for Báo Admin: Live, VHH, SDT, Selfie, Email code
  const adminReportCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: currentBaseVias.length,
      Live: 0,
      VHH: 0,
      SDT: 0,
      Selfie: 0,
      'Email code': 0,
      None: 0,
    };
    currentBaseVias.forEach((v) => {
      const rep = v.adminReportStatus || 'None';
      if ((rep as string) === 'Code mail' || rep === 'Email code') {
        counts['Email code']++;
      } else if (rep in counts) {
        counts[rep]++;
      } else {
        counts.None++;
      }
    });
    return counts;
  }, [currentBaseVias]);

  const scopedVias = useMemo(() => {
    let list = strictlyGuardedVias;

    if (currentUser.role === 'staff') {
      const staffNameLower = currentUser.name.trim().toLowerCase();
      list = list.filter((v) => v.staffName.trim().toLowerCase() === staffNameLower);
    } else {
      if (selectedStaffFilter !== 'all') {
        list = list.filter(
          (v) => v.staffName.trim().toLowerCase() === selectedStaffFilter.trim().toLowerCase()
        );
      }
    }

    if (statusFilter === 'active') {
      list = list.filter((v) => !isViaError(v) && v.status !== 'checkpoint' && !v.isFixed && v.status !== 'fixed');
    } else if (statusFilter === 'fixed') {
      list = list.filter((v) => Boolean(v.isFixed || v.status === 'fixed'));
    } else if (statusFilter === 'error') {
      list = list.filter((v) => isViaError(v));
    } else if (statusFilter === 'checkpoint') {
      list = list.filter((v) => v.status === 'checkpoint');
    } else if (statusFilter === 'pending_page') {
      list = list.filter((v) => isViaPendingPageUpdate(v));
    } else if (statusFilter === 'has_page') {
      list = list.filter((v) => {
        const uid = v.uid?.trim();
        const pages = uid ? (pagesPerViaUid.get(uid) || pagesPerViaUid.get(uid.toLowerCase()) || []) : [];
        return isViaPageUpdated(v, pages.length);
      });
    } else if (statusFilter === 'no_page') {
      list = list.filter((v) => {
        const uid = v.uid?.trim();
        const pages = uid ? (pagesPerViaUid.get(uid) || pagesPerViaUid.get(uid.toLowerCase()) || []) : [];
        return !isViaPendingPageUpdate(v) && !isViaPageUpdated(v, pages.length);
      });
    }

    // Filter by Báo Admin
    if (adminReportFilter !== 'all') {
      if (adminReportFilter === 'None') {
        list = list.filter((v) => !v.adminReportStatus || v.adminReportStatus === 'None');
      } else if (adminReportFilter === 'Email code') {
        list = list.filter((v) => v.adminReportStatus === 'Email code' || (v.adminReportStatus as any) === 'Code mail');
      } else {
        list = list.filter((v) => v.adminReportStatus === adminReportFilter);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (v) =>
          v.uid.toLowerCase().includes(q) ||
          v.pass.toLowerCase().includes(q) ||
          v.twoFa.toLowerCase().includes(q) ||
          v.staffName.toLowerCase().includes(q) ||
          (v.adminReportStatus && v.adminReportStatus.toLowerCase().includes(q)) ||
          (v.note && v.note.toLowerCase().includes(q))
      );
    }

    return list;
  }, [strictlyGuardedVias, currentUser, selectedStaffFilter, searchQuery, statusFilter, adminReportFilter, pagesPerViaUid]);

  // Computed values for multi-selection
  const isAllSelected = useMemo(() => {
    return scopedVias.length > 0 && scopedVias.every((v) => selectedViaIds.has(v.id));
  }, [scopedVias, selectedViaIds]);

  const isSomeSelected = useMemo(() => {
    const count = scopedVias.filter((v) => selectedViaIds.has(v.id)).length;
    return count > 0 && count < scopedVias.length;
  }, [scopedVias, selectedViaIds]);

  const selectedCount = useMemo(() => {
    return scopedVias.filter((v) => selectedViaIds.has(v.id)).length;
  }, [scopedVias, selectedViaIds]);

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedViaIds(new Set());
    } else {
      const newSet = new Set<string>();
      scopedVias.forEach((v) => newSet.add(v.id));
      setSelectedViaIds(newSet);
    }
  };

  const handleDeselectAll = () => {
    setSelectedViaIds(new Set());
  };

  const handleToggleSelectVia = (viaId: string) => {
    setSelectedViaIds((prev) => {
      const next = new Set(prev);
      if (next.has(viaId)) {
        next.delete(viaId);
      } else {
        next.add(viaId);
      }
      return next;
    });
  };

  const handleCopyAllUids = () => {
    const uids = scopedVias
      .map((v) => v.uid?.trim())
      .filter(Boolean);

    if (uids.length === 0) {
      setCopyToastMessage('⚠️ Không có UID nào để sao chép!');
      setTimeout(() => setCopyToastMessage(null), 2500);
      return;
    }

    const text = uids.join('\n');
    navigator.clipboard.writeText(text);
    setCopiedKey('copy-all-uids');
    setCopyToastMessage(`📋 Đã sao chép tất cả ${uids.length} UID tài khoản nick (1 UID/dòng)!`);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === 'copy-all-uids' ? null : prev));
    }, 2500);
    setTimeout(() => setCopyToastMessage(null), 3500);
  };

  const handleCopySelectedUids = () => {
    const selectedVias = scopedVias.filter((v) => selectedViaIds.has(v.id));
    const uids = selectedVias
      .map((v) => v.uid?.trim())
      .filter(Boolean);

    if (uids.length === 0) {
      setCopyToastMessage('⚠️ Vui lòng chọn ít nhất 1 nick có UID để sao chép!');
      setTimeout(() => setCopyToastMessage(null), 2500);
      return;
    }

    const text = uids.join('\n');
    navigator.clipboard.writeText(text);
    setCopiedKey('copy-selected-uids');
    setCopyToastMessage(`📋 Đã sao chép ${uids.length} UID tài khoản nick đã chọn (1 UID/dòng)!`);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === 'copy-selected-uids' ? null : prev));
    }, 2500);
    setTimeout(() => setCopyToastMessage(null), 3500);
  };

  const handleCopySelectedFullVia = () => {
    const selectedVias = scopedVias.filter((v) => selectedViaIds.has(v.id));
    const lines = selectedVias
      .map((v) => v.rawFullVia || `${v.uid}|${v.pass}|${v.twoFa}`)
      .filter(Boolean);

    if (lines.length === 0) return;
    const text = lines.join('\n');
    navigator.clipboard.writeText(text);
    setCopiedKey('copy-selected-full');
    setCopyToastMessage(`📋 Đã sao chép ${lines.length} chuỗi Full Via (UID|PASS|2FA) đã chọn!`);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === 'copy-selected-full' ? null : prev));
    }, 2500);
    setTimeout(() => setCopyToastMessage(null), 3500);
  };

  // 30s auto-hide for Passwords
  useEffect(() => {
    if (showAllPasswords) {
      const timer = setTimeout(() => {
        setShowAllPasswords(false);
        setCopyToastMessage('🛡️ Đã tự động ẩn mật khẩu sau 30 giây để bảo mật.');
        setTimeout(() => setCopyToastMessage(null), 3000);
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [showAllPasswords]);

  // 30s auto-hide for 2FA
  useEffect(() => {
    if (showAll2Fa) {
      const timer = setTimeout(() => {
        setShowAll2Fa(false);
        setCopyToastMessage('🛡️ Đã tự động ẩn mã 2FA sau 30 giây để bảo mật.');
        setTimeout(() => setCopyToastMessage(null), 3000);
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [showAll2Fa]);

  // 5 minutes inactivity auto-lock for Full Via Vault
  useEffect(() => {
    if (!isVaultUnlocked) return;
    let timeoutId: any;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsVaultUnlocked(false);
        setCopyToastMessage('🔒 Đã tự động khóa Bảng Full Via sau 5 phút không thao tác.');
        setTimeout(() => setCopyToastMessage(null), 3000);
      }, 5 * 60 * 1000);
    };

    resetTimer();
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
    };
  }, [isVaultUnlocked]);

  // Lockout countdown timer
  useEffect(() => {
    let interval: any;
    if (isLockout && lockoutTimer > 0) {
      interval = setInterval(() => {
        setLockoutTimer((prev) => {
          if (prev <= 1) {
            setIsLockout(false);
            setFailedAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isLockout, lockoutTimer]);

  // Unlock vault handler
  const handleUnlockVault = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockout) return;

    if (pinInput.trim() === requiredPin) {
      setIsVaultUnlocked(true);
      setPinInput('');
      setPinError(null);
      setFailedAttempts(0);
      setCopyToastMessage('🔓 Đã mở khóa Bảng Full Via an toàn cho phiên làm việc!');
      setTimeout(() => setCopyToastMessage(null), 3000);
    } else {
      const nextFailed = failedAttempts + 1;
      setFailedAttempts(nextFailed);
      if (nextFailed >= 5) {
        setIsLockout(true);
        setLockoutTimer(30);
        setPinError('Đã nhập sai 5 lần! Bị khóa tạm thời trong 30 giây.');
      } else {
        setPinError(`Mã PIN không đúng! Bạn còn ${5 - nextFailed} lần thử.`);
      }
    }
  };

  // Helper copy function with anti-leak visual feedback (never displays password or 2FA secret in toast)
  const handleCopyText = (text: string, key: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);

    if (key.startsWith('pass-')) {
      setCopyToastMessage('🛡️ Đã sao chép Mật khẩu vào Clipboard an toàn!');
    } else if (key.startsWith('2fa-')) {
      setCopyToastMessage('🛡️ Đã sao chép Secret Key 2FA vào Clipboard an toàn!');
    } else if (key.startsWith('full-')) {
      setCopyToastMessage('🛡️ Đã sao chép toàn bộ chuỗi (UID|PASS|2FA) vào Clipboard an toàn!');
    } else {
      setCopyToastMessage(`Đã copy ${label}: ${text}`);
    }

    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
    setTimeout(() => {
      setCopyToastMessage((prev) => (prev?.includes(label) || prev?.includes('Clipboard') ? null : prev));
    }, 2500);
  };

  // Toggle single row password
  const toggleRowPassword = (id: string) => {
    setVisiblePasswordRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle single row 2FA Secret Key
  const toggleRow2Fa = (id: string) => {
    setVisible2FaRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Format masked 2FA string
  const formatMasked2Fa = (key: string) => {
    if (!key) return '';
    const trimmed = key.trim();
    if (trimmed.length <= 6) return '••••••••••••';
    return `${trimmed.slice(0, 4)}••••••••••••${trimmed.slice(-2)}`;
  };

  // Generate Live 2FA OTP code directly
  const handleGetLiveOtp = async (via: FullViaItem) => {
    if (!via.twoFa || !via.twoFa.trim()) {
      setCopyToastMessage('Nick này chưa có mã 2FA Secret Key!');
      setTimeout(() => setCopyToastMessage(null), 2500);
      return;
    }

    setLiveOtpMap((prev) => ({
      ...prev,
      [via.id]: { code: '...', remainingSeconds: 0, loading: true },
    }));

    const result = await generateTOTPCode(via.twoFa);
    if (result) {
      setLiveOtpMap((prev) => ({
        ...prev,
        [via.id]: { code: result.code, remainingSeconds: result.remainingSeconds, loading: false },
      }));
      // Auto copy the 6 digit code!
      navigator.clipboard.writeText(result.code);
      setCopiedKey(`live-otp-${via.id}`);
      setCopyToastMessage(`Đã lấy & copy mã 2FA Live: ${result.code} (${result.remainingSeconds}s)`);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === `live-otp-${via.id}` ? null : prev));
      }, 2500);
      setTimeout(() => setCopyToastMessage(null), 3500);
    } else {
      setLiveOtpMap((prev) => {
        const next = { ...prev };
        delete next[via.id];
        return next;
      });
      setCopyToastMessage('Mã 2FA không hợp lệ hoặc sai định dạng Base32!');
      setTimeout(() => setCopyToastMessage(null), 3000);
    }
  };

  // Batch update Admin Report status for all selected vias
  const handleBatchUpdateAdminReport = (status: ViaAdminReportStatus) => {
    const selectedVias = scopedVias.filter((v) => selectedViaIds.has(v.id));
    if (selectedVias.length === 0) return;

    selectedVias.forEach((v) => {
      onUpdateVia({
        ...v,
        adminReportStatus: status,
      });
    });

    setCopyToastMessage(
      status === 'None'
        ? `Đã xóa Báo Admin cho ${selectedVias.length} nick đã chọn`
        : `📢 Đã báo Admin [${status}] cho ${selectedVias.length} nick đã chọn!`
    );
    setTimeout(() => setCopyToastMessage(null), 3000);
  };

  // Open modal for add
  const handleOpenAddModal = () => {
    setEditingVia(null);
    setIsModalPassVisible(false);
    setIsModalTwoFaVisible(false);
    const defaultStaff =
      currentUser.role === 'staff'
        ? currentUser.name
        : selectedStaffFilter !== 'all'
        ? selectedStaffFilter
        : availableStaffNames[0] || 'Anh Quỳnh';

    setModalForm({
      uid: '',
      pass: '',
      twoFa: '',
      staffName: defaultStaff,
      note: '',
      status: 'active',
      isError: false,
      isFixed: false,
      pageUpdateStatus: 'none',
      adminReportStatus: 'None',
    });
    setIsEditModalOpen(true);
  };

  const handleOpenAddModalForStaff = (staffName: string) => {
    setEditingVia(null);
    setIsModalPassVisible(false);
    setIsModalTwoFaVisible(false);
    setModalForm({
      uid: '',
      pass: '',
      twoFa: '',
      staffName: staffName,
      note: '',
      status: 'active',
      isError: false,
      isFixed: false,
      pageUpdateStatus: 'none',
      adminReportStatus: 'None',
    });
    setIsEditModalOpen(true);
  };

  // Open modal for edit
  const handleOpenEditModal = (via: FullViaItem) => {
    setEditingVia(via);
    setIsModalPassVisible(false);
    setIsModalTwoFaVisible(false);
    const isErr = isViaError(via);
    const isFix = Boolean(via.isFixed || via.status === 'fixed');
    const uidClean = via.uid?.trim() || '';
    const assignedPages = (uidClean && (pagesPerViaUid.get(uidClean) || pagesPerViaUid.get(uidClean.toLowerCase()))) || [];
    
    // Resolve initial pageUpdateStatus
    const initialPageStatus: ViaPageUpdateStatus =
      via.pageUpdateStatus ||
      (via.hasAdminAssignedPage ? 'pending' : (assignedPages.length > 0 ? 'updated' : 'none'));

    setModalForm({
      uid: via.uid,
      pass: via.pass,
      twoFa: via.twoFa,
      staffName: via.staffName,
      note: via.note || '',
      status: isErr ? 'error' : isFix ? 'fixed' : (via.status || 'active'),
      isError: isErr,
      isFixed: isFix,
      pageUpdateStatus: initialPageStatus,
      adminReportStatus: via.adminReportStatus || 'None',
    });
    setIsEditModalOpen(true);
  };

  // Check if UID in single add modal is duplicate
  const duplicateViaInModal = useMemo(() => {
    const trimmed = modalForm.uid.trim();
    if (!trimmed || trimmed.length < 4) return null;
    if (editingVia && editingVia.uid.trim() === trimmed) return null;
    return strictlyGuardedVias.find((v) => v.uid.trim() === trimmed && v.id !== editingVia?.id) || null;
  }, [modalForm.uid, editingVia, strictlyGuardedVias]);

  // Save modal form
  const handleSaveModalForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalForm.uid.trim() || !modalForm.pass.trim()) {
      alert('Vui lòng nhập UID và Mật khẩu (PASS)!');
      return;
    }

    const trimmedUid = modalForm.uid.trim();
    const trimmedPass = modalForm.pass.trim();
    const trimmed2Fa = modalForm.twoFa.trim();
    const rawFull = `${trimmedUid}|${trimmedPass}|${trimmed2Fa}`;
    const isErr = modalForm.status === 'error' || modalForm.status === 'dead' || Boolean(modalForm.isError);
    const isFix = modalForm.status === 'fixed' || Boolean(modalForm.isFixed);
    const finalStatus = isFix ? 'fixed' : isErr ? (modalForm.status === 'dead' ? 'dead' : 'error') : modalForm.status;

    if (!editingVia && duplicateViaInModal) {
      if (
        !window.confirm(
          `Cảnh báo: UID "${trimmedUid}" đã tồn tại trong hệ thống (thuộc nhân viên "${duplicateViaInModal.staffName}"). Bạn có chắc chắn muốn thêm tiếp nick này không?`
        )
      ) {
        return;
      }
    }

    const isPending = modalForm.pageUpdateStatus === 'pending';
    const isUpdated = modalForm.pageUpdateStatus === 'updated';

    if (editingVia) {
      onUpdateVia({
        ...editingVia,
        uid: trimmedUid,
        pass: trimmedPass,
        twoFa: trimmed2Fa,
        staffName: modalForm.staffName,
        note: modalForm.note.trim(),
        status: finalStatus,
        isError: isFix ? false : isErr,
        isFixed: isFix,
        rawFullVia: rawFull,
        pageUpdateStatus: modalForm.pageUpdateStatus,
        adminReportStatus: modalForm.adminReportStatus || 'None',
        hasAdminAssignedPage: isPending || isUpdated ? true : false,
        ...(isPending ? { pageAssignedAt: editingVia.pageAssignedAt || new Date().toLocaleDateString('vi-VN') } : {}),
        ...(isUpdated ? { pageUpdatedAt: new Date().toLocaleDateString('vi-VN') } : {}),
      });
    } else {
      const newItem: FullViaItem = {
        id: `via-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        uid: trimmedUid,
        pass: trimmedPass,
        twoFa: trimmed2Fa,
        staffName: modalForm.staffName,
        note: modalForm.note.trim(),
        status: finalStatus,
        isError: isFix ? false : isErr,
        isFixed: isFix,
        createdAt: new Date().toLocaleDateString('vi-VN'),
        rawFullVia: rawFull,
        pageUpdateStatus: modalForm.pageUpdateStatus,
        adminReportStatus: modalForm.adminReportStatus || 'None',
        hasAdminAssignedPage: isPending || isUpdated ? true : false,
        ...(isPending ? { pageAssignedAt: new Date().toLocaleDateString('vi-VN') } : {}),
        ...(isUpdated ? { pageUpdatedAt: new Date().toLocaleDateString('vi-VN') } : {}),
      };
      onAddVia(newItem);
    }

    setIsEditModalOpen(false);
  };

  // Real CSV export
  const executeExportCSV = () => {
    const headers = ['STT', 'UID', 'PASS', '2FA', 'TÊN NHÂN VIÊN', 'TRẠNG THÁI', 'BÁO ADMIN', 'GHI CHÚ'];
    const rows = scopedVias.map((v, i) => [
      `"${i + 1}"`,
      `"${v.uid.replace(/"/g, '""')}"`,
      `"${v.pass.replace(/"/g, '""')}"`,
      `"${v.twoFa.replace(/"/g, '""')}"`,
      `"${v.staffName.replace(/"/g, '""')}"`,
      `"${v.status || 'active'}"`,
      `"${(v.adminReportStatus && v.adminReportStatus !== 'None' ? v.adminReportStatus : '').replace(/"/g, '""')}"`,
      `"${(v.note || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bang_Full_Via_${currentUser.role === 'staff' ? currentUser.name : 'All'}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Request CSV Export with PIN verification modal
  const handleRequestExportCSV = () => {
    setExportPinInput('');
    setExportPinError(null);
    setIsExportPinModalOpen(true);
  };

  const handleConfirmExportWithPin = () => {
    if (exportPinInput.trim() === requiredPin) {
      setIsExportPinModalOpen(false);
      executeExportCSV();
      setCopyToastMessage('✅ Đã xuất file CSV thành công sau khi xác thực PIN!');
      setTimeout(() => setCopyToastMessage(null), 3000);
    } else {
      setExportPinError('Mã PIN không chính xác! Không thể xuất file dữ liệu bảo mật.');
    }
  };

  // Reusable row renderer supporting compact layout, color highlight when has pages, and clear notes for staff
  const renderViaRow = (via: FullViaItem, index: number) => {
    const isPasswordVisible = showAllPasswords || visiblePasswordRowIds.has(via.id);
    const is2FaVisible = showAll2Fa || visible2FaRowIds.has(via.id);
    const isUidCopied = copiedKey === `uid-${via.id}`;
    const isPassCopied = copiedKey === `pass-${via.id}`;
    const is2FaCopied = copiedKey === `2fa-${via.id}`;
    const isFullCopied = copiedKey === `full-${via.id}`;
    const liveOtp = liveOtpMap[via.id];
    const uidClean = via.uid?.trim() || '';
    const assignedPages = (uidClean && (pagesPerViaUid.get(uidClean) || pagesPerViaUid.get(uidClean.toLowerCase()))) || [];
    const isPendingPage = isViaPendingPageUpdate(via);
    const isUpdatedPage = !isPendingPage && isViaPageUpdated(via, assignedPages.length);
    const hasPages = isUpdatedPage || assignedPages.length > 0;
    const isRowError = isViaError(via);
    const isRowFixed = Boolean(via.isFixed || via.status === 'fixed');
    const isCheckpoint = via.status === 'checkpoint';

    // Check posts completion status for assigned pages
    const pendingPagesCount = assignedPages.filter(p => !p.isCompleted && (p.actualPosts || 0) < (p.targetPosts || 0)).length;
    const allPagesDone = hasPages && pendingPagesCount === 0;
    const isSelected = selectedViaIds.has(via.id);

    return (
      <tr
        key={via.id}
        className={`transition-colors group border-b ${
          isSelected
            ? 'bg-indigo-100/70 hover:bg-indigo-100/90 border-l-4 border-l-indigo-600 border-indigo-300'
            : isRowError
            ? 'bg-red-50/95 hover:bg-red-100/90 border-l-4 border-l-red-600 border-red-200'
            : isRowFixed
            ? 'bg-emerald-50/95 hover:bg-emerald-100/90 border-l-4 border-l-emerald-600 border-emerald-300'
            : isCheckpoint
            ? 'bg-amber-50/70 hover:bg-amber-100/70 border-l-4 border-l-amber-500 border-amber-200'
            : isPendingPage
            ? 'bg-rose-50/90 hover:bg-rose-100/95 border-l-4 border-l-rose-600 border-rose-300'
            : isUpdatedPage
            ? 'bg-emerald-50/40 hover:bg-emerald-100/60 border-l-4 border-l-emerald-500 border-slate-200'
            : 'bg-white hover:bg-slate-50/80 border-slate-200'
        }`}
      >
        {/* 1. CHỌN & STT */}
        <td
          className={`py-2 px-2 text-center font-mono font-semibold border-r text-[11px] ${
            isSelected
              ? 'bg-indigo-200/60 text-indigo-950 border-indigo-300 font-bold'
              : isRowError
              ? 'text-red-800 bg-red-100/60 border-red-200 font-bold'
              : isRowFixed
              ? 'text-emerald-800 bg-emerald-100/60 border-emerald-200 font-bold'
              : isPendingPage
              ? 'text-rose-950 bg-rose-100/80 border-rose-300 font-black'
              : isUpdatedPage
              ? 'text-emerald-800 bg-emerald-50/50 border-slate-200 font-bold'
              : 'text-slate-400 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-center space-x-1.5">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => handleToggleSelectVia(via.id)}
              className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-400 focus:ring-indigo-500 cursor-pointer shrink-0"
              title={`Lựa chọn tài khoản nick UID ${via.uid}`}
            />
            <span className="text-[10px] select-none">{index + 1}</span>
          </div>
        </td>

        {/* 2. CỘT UID */}
        <td
          className={`py-2 px-2.5 border-r transition-colors ${
            isSelected
              ? 'border-indigo-300 bg-indigo-100/40'
              : isRowError
              ? 'border-red-200 bg-red-100/60'
              : isRowFixed
              ? 'border-emerald-300 bg-emerald-100/80'
              : isPendingPage
              ? 'border-rose-300 bg-rose-100/60'
              : isUpdatedPage
              ? 'border-slate-200 bg-emerald-50/20'
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center space-x-1 min-w-0">
              <span
                onClick={() => handleCopyText(via.uid, `uid-${via.id}`, 'UID')}
                className={`font-mono font-bold tracking-tight text-xs cursor-pointer hover:underline select-all ${
                  isRowError
                    ? 'text-red-900 font-black'
                    : isRowFixed
                    ? 'text-emerald-950 font-black'
                    : isPendingPage
                    ? 'text-rose-950 font-black'
                    : 'text-indigo-950'
                }`}
                title="Bấm để sao chép nhanh UID"
              >
                {via.uid}
              </span>
              {isRowError && (
                <span className="bg-red-600 text-white font-extrabold text-[9px] px-1 py-0.2 rounded shadow-2xs shrink-0">
                  LỖI
                </span>
              )}
              {isRowFixed && (
                <span
                  className="bg-emerald-600 text-white font-extrabold text-[9px] px-1 py-0.2 rounded shadow-2xs shrink-0 flex items-center space-x-0.5"
                  title="Admin đã sửa lỗi và thay via mới"
                >
                  <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                  <span>ĐÃ SỬA</span>
                </span>
              )}
              {isPendingPage && !isRowError && !isRowFixed && (
                <span
                  className="bg-rose-600 text-white font-black text-[9px] px-1 py-0.2 rounded shadow-2xs shrink-0 flex items-center space-x-0.5 animate-pulse"
                  title="Admin đã báo Đã Có Page! Cần nhân viên cập nhật Page"
                >
                  <span>CẦN PAGE</span>
                </span>
              )}
              <a
                href={`https://facebook.com/${via.uid}`}
                target="_blank"
                rel="noreferrer"
                className="p-0.5 rounded text-slate-400 hover:text-indigo-600 shrink-0"
                title="Mở trang cá nhân Facebook"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center space-x-0.5 shrink-0">
              <button
                type="button"
                onClick={() => handleCopyText(via.uid, `uid-${via.id}`, 'UID')}
                className={`inline-flex items-center space-x-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded border transition-all cursor-pointer ${
                  isUidCopied
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : isRowError
                    ? 'bg-red-100 text-red-900 border-red-300 hover:bg-red-200'
                    : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                }`}
                title="Sao chép UID"
              >
                {isUidCopied ? (
                  <>
                    <Check className="w-2.5 h-2.5 text-white" />
                    <span>Đã copy</span>
                  </>
                ) : (
                  <>
                    <Copy className={`w-2.5 h-2.5 ${isRowError ? 'text-red-700' : 'text-indigo-600'}`} />
                    <span>UID</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </td>

        {/* 3. CỘT MẬT KHẨU PASS */}
        <td className={`py-2 px-2.5 border-r ${isRowError ? 'border-red-200' : 'border-slate-200'}`}>
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center space-x-1 min-w-0 flex-1">
              <span
                className={`font-mono text-xs font-semibold truncate ${
                  isPasswordVisible
                    ? isRowError
                      ? 'text-red-950 font-bold select-all'
                      : 'text-slate-800 select-all'
                    : 'text-slate-400 tracking-widest'
                }`}
              >
                {isPasswordVisible ? via.pass : '••••••••••'}
              </span>
              <button
                type="button"
                onClick={() => toggleRowPassword(via.id)}
                className="text-slate-400 hover:text-slate-700 p-0.5 shrink-0 cursor-pointer"
                title={isPasswordVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {isPasswordVisible ? <EyeOff className="w-3 h-3 text-amber-600" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleCopyText(via.pass, `pass-${via.id}`, 'Mật khẩu')}
              className={`inline-flex items-center space-x-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded border transition-all cursor-pointer shrink-0 ${
                isPassCopied
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : isRowError
                  ? 'bg-red-100 text-red-900 border-red-300 hover:bg-red-200'
                  : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
              }`}
              title="Sao chép Mật khẩu (PASS)"
            >
              {isPassCopied ? (
                <>
                  <Check className="w-2.5 h-2.5 text-white" />
                  <span>Đã copy</span>
                </>
              ) : (
                <>
                  <Copy className={`w-2.5 h-2.5 ${isRowError ? 'text-red-700' : 'text-amber-700'}`} />
                  <span>Pass</span>
                </>
              )}
            </button>
          </div>
        </td>

        {/* 4. CỘT MÃ 2FA */}
        <td className={`py-2 px-2.5 border-r ${isRowError ? 'border-red-200' : 'border-slate-200'}`}>
          <div className="flex flex-col space-y-1">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center space-x-1 min-w-0 flex-1 font-mono text-xs">
                <span
                  className={`truncate ${
                    is2FaVisible
                      ? isRowError
                        ? 'text-red-950 font-bold select-all'
                        : 'text-slate-800 font-semibold select-all'
                      : 'text-slate-400 tracking-widest'
                  }`}
                  title={via.twoFa}
                >
                  {is2FaVisible ? via.twoFa : '••••••••••••••••'}
                </span>
                {via.twoFa && (
                  <button
                    type="button"
                    onClick={() => toggleRow2Fa(via.id)}
                    className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer shrink-0"
                    title={is2FaVisible ? 'Ẩn mã 2FA' : 'Hiện mã 2FA'}
                  >
                    {is2FaVisible ? <EyeOff className="w-3 h-3 text-emerald-600" /> : <Eye className="w-3 h-3" />}
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-0.5 shrink-0">
                {via.twoFa && (
                  <button
                    type="button"
                    onClick={() => handleCopyText(via.twoFa, `2fa-${via.id}`, 'Mã 2FA Key')}
                    className={`inline-flex items-center space-x-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded border transition-all cursor-pointer ${
                      is2FaCopied
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : isRowError
                        ? 'bg-red-100 text-red-900 border-red-300 hover:bg-red-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    }`}
                    title="Sao chép Secret Key 2FA"
                  >
                    {is2FaCopied ? (
                      <>
                        <Check className="w-2.5 h-2.5 text-white" />
                        <span>Đã copy</span>
                      </>
                    ) : (
                      <>
                        <Copy className={`w-2.5 h-2.5 ${isRowError ? 'text-red-700' : 'text-emerald-700'}`} />
                        <span>Key</span>
                      </>
                    )}
                  </button>
                )}

                {via.twoFa && (
                  <button
                    type="button"
                    onClick={() => handleGetLiveOtp(via)}
                    className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100 transition-colors cursor-pointer"
                    title="Tính ngay mã 6 số đăng nhập (OTP Live)"
                  >
                    <Sparkles className="w-2.5 h-2.5 text-purple-700" />
                    <span>OTP</span>
                  </button>
                )}
              </div>
            </div>

            {liveOtp && (
              <div className="flex items-center justify-between px-1.5 py-0.5 bg-purple-50 border border-purple-200 rounded text-xs">
                <div className="flex items-center space-x-1.5">
                  <span className="text-[9px] uppercase font-black text-purple-700">OTP:</span>
                  <span className="font-mono font-black text-xs text-purple-900 tracking-wider">
                    {liveOtp.code}
                  </span>
                  <span className="text-[9px] text-purple-600">({liveOtp.remainingSeconds}s)</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyText(liveOtp.code, `live-otp-${via.id}`, 'Mã OTP Live')}
                  className="px-1.5 py-0.2 bg-purple-600 hover:bg-purple-700 text-white rounded text-[9px] font-bold cursor-pointer"
                >
                  Copy
                </button>
              </div>
            )}
          </div>
        </td>

        {/* 5. CỘT NHÂN VIÊN */}
        <td className={`py-2 px-2 border-r ${isRowError ? 'border-red-200' : 'border-slate-200'}`}>
          {currentUser.role === 'admin' ? (
            <select
              value={via.staffName}
              onChange={(e) => {
                const newStaff = e.target.value;
                onUpdateVia({ ...via, staffName: newStaff });
                setCopyToastMessage(`Đã chuyển quyền quản lý nick ${via.uid} sang cho: ${newStaff}`);
                setTimeout(() => setCopyToastMessage(null), 2500);
              }}
              className="bg-white border border-slate-300 hover:border-indigo-400 text-xs font-semibold text-slate-800 rounded px-1.5 py-1 shadow-2xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden cursor-pointer w-full"
              title="Bấm để chuyển nick này cho nhân viên khác"
            >
              <option value="">-- Chọn nhân viên --</option>
              {distinctStaffNames.map((name) => (
                <option key={name} value={name}>
                  👤 {name}
                </option>
              ))}
            </select>
          ) : (
            <div className="inline-flex items-center space-x-1 px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-semibold text-[11px] border border-slate-200">
              <UserCheck className="w-3 h-3 text-slate-600" />
              <span>{via.staffName || 'Chưa phân công'}</span>
            </div>
          )}
        </td>

        {/* 6. PAGE ĐANG CẦM (GỌN GÀNG, SẠCH SẼ) */}
        <td
          className={`py-2 px-2 border-r transition-all text-center ${
            isRowError
              ? 'border-red-200'
              : isRowFixed
              ? 'border-emerald-200 bg-emerald-50/50'
              : isPendingPage
              ? 'border-rose-300 bg-rose-50/95 ring-1 ring-inset ring-rose-300'
              : isUpdatedPage
              ? 'border-emerald-300 bg-emerald-50/90'
              : 'border-slate-200'
          }`}
        >
          <div className="flex flex-col items-center space-y-1 w-full min-w-[155px] max-w-[210px] mx-auto">
            {isPendingPage ? (
              <>
                {/* 🔴 Cần Gán Page */}
                <div className="flex items-center justify-between gap-1 w-full">
                  {currentUser.role === 'admin' ? (
                    <button
                      type="button"
                      onClick={() => handleSetViaPageStatus(via, 'none')}
                      className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold shadow-2xs cursor-pointer flex items-center space-x-1"
                      title="Admin bấm để chuyển lại về Chưa có page"
                    >
                      <AlertCircle className="w-3 h-3" />
                      <span>🔴 Cần gán Page</span>
                    </button>
                  ) : (
                    <span className="px-2 py-0.5 bg-rose-600 text-white rounded text-[11px] font-bold shadow-2xs flex items-center space-x-1 animate-pulse">
                      <AlertCircle className="w-3 h-3" />
                      <span>🔴 Cần gán Page</span>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleSetViaPageStatus(via, 'updated')}
                    className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow-2xs cursor-pointer"
                    title="Xác nhận đã cập nhật Page"
                  >
                    ✓ Đã gán
                  </button>
                </div>

                <div className="flex items-center justify-center space-x-1 w-full text-[10px]">
                  {onFilterPageByVia && (
                    <button
                      type="button"
                      onClick={() => onFilterPageByVia(via.uid)}
                      className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded font-semibold cursor-pointer"
                      title="Mở Bảng Fanpage lọc nick này"
                    >
                      Vào Page
                    </button>
                  )}
                  {onAddPageForVia && (
                    <button
                      type="button"
                      onClick={() => onAddPageForVia(via.uid, via.staffName)}
                      className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded font-semibold cursor-pointer"
                      title="Thêm Page mới"
                    >
                      + Page
                    </button>
                  )}
                </div>
              </>
            ) : isUpdatedPage ? (
              <>
                {/* 🟢 Đã Có Page */}
                <div className="flex items-center justify-between gap-1 w-full">
                  <button
                    type="button"
                    onClick={() => onFilterPageByVia && onFilterPageByVia(via.uid)}
                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold shadow-2xs cursor-pointer flex items-center space-x-1"
                    title="Bấm để lọc xem danh sách các Fanpage của nick này"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>📗 {assignedPages.length || 1} Page</span>
                  </button>

                  <div className="flex items-center space-x-0.5">
                    {onAddPageForVia && (
                      <button
                        type="button"
                        onClick={() => onAddPageForVia(via.uid, via.staffName)}
                        className="px-1 py-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded cursor-pointer"
                        title="Thêm Fanpage mới"
                      >
                        +Page
                      </button>
                    )}
                    {onFetchPagesForVia && (
                      <button
                        type="button"
                        onClick={() => onFetchPagesForVia(via.uid, via.staffName)}
                        className="p-1 text-[10px] text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded cursor-pointer"
                        title="Quét Page từ Via"
                      >
                        <Zap className="w-3 h-3 text-blue-600 fill-blue-600" />
                      </button>
                    )}
                  </div>
                </div>

                {assignedPages.length > 0 && (
                  <div className="w-full flex items-center space-x-1 overflow-hidden text-[10px]">
                    <span className="truncate text-slate-700 font-medium" title={assignedPages.map(p => p.pageName).join(', ')}>
                      {assignedPages[0].pageName || 'Page 1'}
                    </span>
                    {assignedPages.length > 1 && (
                      <span className="text-[9px] bg-slate-100 text-slate-600 px-1 rounded shrink-0">
                        +{assignedPages.length - 1}
                      </span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* ⚪ Chưa có page */}
                <div className="flex items-center justify-between gap-1 w-full">
                  {currentUser.role === 'admin' ? (
                    <button
                      type="button"
                      onClick={() => handleSetViaPageStatus(via, 'pending')}
                      className="px-2 py-0.5 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-300 rounded text-[11px] font-semibold cursor-pointer flex items-center space-x-1"
                      title="Nhấn để chuyển sang trạng thái: Cần gán Page"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      <span>Chưa có page</span>
                    </button>
                  ) : (
                    <span className="px-2 py-0.5 bg-slate-50 text-slate-500 border border-slate-200 rounded text-[11px] font-medium flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      <span>Chưa có page</span>
                    </span>
                  )}

                  <div className="flex items-center space-x-0.5">
                    {onAddPageForVia && (
                      <button
                        type="button"
                        onClick={() => onAddPageForVia(via.uid, via.staffName)}
                        className="px-1.5 py-0.5 text-[10px] text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded cursor-pointer"
                        title="Tạo Page mới"
                      >
                        +Page
                      </button>
                    )}
                    {onFetchPagesForVia && (
                      <button
                        type="button"
                        onClick={() => onFetchPagesForVia(via.uid, via.staffName)}
                        className="p-1 text-[10px] text-blue-700 bg-blue-50/70 hover:bg-blue-100 border border-blue-200 rounded cursor-pointer"
                        title="Quét Page"
                      >
                        <Zap className="w-3 h-3 text-blue-600" />
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </td>

        {/* 7. TRẠNG THÁI (GỌN GÀNG) */}
        <td className={`py-2 px-2 border-r ${isRowError ? 'border-red-200' : isRowFixed ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'}`}>
          <select
            value={isRowError ? (via.status === 'dead' ? 'dead' : 'error') : isRowFixed ? 'fixed' : via.status || 'active'}
            onChange={(e) => {
              const val = e.target.value as 'active' | 'checkpoint' | 'dead' | 'error' | 'fixed';
              const isErr = val === 'error' || val === 'dead';
              const isFix = val === 'fixed';
              onUpdateVia({
                ...via,
                status: val,
                isError: isErr,
                isFixed: isFix,
              });
              setCopyToastMessage(
                isFix
                  ? `❇️ Đã bôi màu xanh nick ${via.uid} (Admin đã sửa lỗi & thay via mới)`
                  : isErr
                  ? `🔴 Đã bôi màu đỏ nick ${via.uid} (Đánh dấu Via Bị Lỗi)`
                  : `🟢 Đã chuyển trạng thái nick ${via.uid} thành: ${val === 'active' ? 'Hoạt Động' : 'Checkpoint'}`
              );
              setTimeout(() => setCopyToastMessage(null), 2500);
            }}
            className={`w-full text-[11px] font-bold rounded px-2 py-1 border shadow-2xs cursor-pointer focus:outline-hidden transition-colors ${
              isRowError
                ? 'bg-red-600 text-white border-red-700 ring-1 ring-red-300'
                : isRowFixed
                ? 'bg-emerald-600 text-white border-emerald-700 ring-1 ring-emerald-300'
                : via.status === 'checkpoint'
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-emerald-50 text-emerald-900 border-emerald-300'
            }`}
            title="Đổi trạng thái nick"
          >
            <option value="active">🟢 Live</option>
            <option value="fixed">❇️ Đã Sửa (Xanh)</option>
            <option value="error">🔴 Lỗi (Đỏ)</option>
            <option value="checkpoint">🟠 Checkpoint</option>
            <option value="dead">🪦 Bị Die</option>
          </select>
        </td>

        {/* 8. BÁO ADMIN (GỌN GÀNG) */}
        <td
          className={`py-2 px-2 border-r text-center transition-all ${
            via.adminReportStatus === 'VHH'
              ? 'bg-rose-50/90 border-rose-200'
              : via.adminReportStatus === 'SDT'
              ? 'bg-blue-50/80 border-blue-200'
              : via.adminReportStatus === 'Selfie'
              ? 'bg-purple-50/80 border-purple-200'
              : via.adminReportStatus === 'Email code' || (via.adminReportStatus as any) === 'Code mail'
              ? 'bg-amber-50/90 border-amber-200'
              : via.adminReportStatus === 'Live'
              ? 'bg-emerald-50/60 border-emerald-200'
              : isRowError
              ? 'border-red-200'
              : 'border-slate-200'
          }`}
        >
          <select
            value={via.adminReportStatus || 'None'}
            onChange={(e) => {
              const val = e.target.value as ViaAdminReportStatus;
              onUpdateVia({
                ...via,
                adminReportStatus: val,
              });
              setCopyToastMessage(
                val === 'None'
                  ? `Đã xóa Báo Admin cho nick ${via.uid}`
                  : `📢 Đã báo Admin: [${val}] cho nick ${via.uid}!`
              );
              setTimeout(() => setCopyToastMessage(null), 2500);
            }}
            className={`w-full text-[11px] font-bold rounded-lg px-2 py-1 border shadow-2xs cursor-pointer focus:outline-hidden transition-all text-center ${
              via.adminReportStatus === 'Live'
                ? 'bg-emerald-600 text-white border-emerald-700'
                : via.adminReportStatus === 'VHH'
                ? 'bg-rose-600 text-white border-rose-700 ring-1 ring-rose-300'
                : via.adminReportStatus === 'SDT'
                ? 'bg-blue-600 text-white border-blue-700'
                : via.adminReportStatus === 'Selfie'
                ? 'bg-purple-600 text-white border-purple-700'
                : via.adminReportStatus === 'Email code' || (via.adminReportStatus as any) === 'Code mail'
                ? 'bg-amber-500 text-white border-amber-600'
                : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'
            }`}
            title="Báo tình trạng nick lên Admin: Live, VHH, SDT, Selfie, Email code"
          >
            <option value="None">⚪ Chưa báo</option>
            <option value="Live">🟢 Live</option>
            <option value="VHH">🔴 VHH</option>
            <option value="SDT">📱 SDT</option>
            <option value="Selfie">🤳 Selfie</option>
            <option value="Email code">✉️ Email code</option>
          </select>
        </td>

        {/* 9. GHI CHÚ CHUNG CẢ VIA */}
        <td
          className={`py-2 px-2.5 border-r text-xs min-w-[150px] max-w-[200px] ${
            isRowError
              ? 'border-red-200 bg-red-50/30'
              : isRowFixed
              ? 'border-emerald-200 bg-emerald-50/40'
              : 'border-slate-200'
          }`}
        >
          <textarea
            rows={1}
            value={via.sharedNote ?? via.note ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              onUpdateVia({
                ...via,
                note: val,
                sharedNote: val,
              });
            }}
            onFocus={(e) => (e.target.rows = 2)}
            onBlur={(e) => {
              if (!e.target.value.trim()) e.target.rows = 1;
            }}
            placeholder="Ghi chú chung..."
            className="w-full text-xs font-medium bg-white hover:bg-white focus:bg-white border border-slate-300 focus:border-indigo-500 rounded px-1.5 py-1 text-slate-800 focus:outline-hidden shadow-2xs resize-none"
            title="Ghi chú chung cho các page cùng Via"
          />
        </td>

        {/* 10. THAO TÁC */}
        <td className="py-2 px-2 text-center">
          <div className="flex items-center justify-center space-x-1">
            <button
              type="button"
              onClick={() => handleToggleErrorVia(via)}
              className={`p-1 rounded border transition-all cursor-pointer ${
                isRowError
                  ? 'bg-red-600 text-white border-red-700 hover:bg-red-700 shadow-2xs'
                  : 'bg-slate-50 text-slate-400 hover:text-red-700 hover:bg-red-50 border-slate-200'
              }`}
              title={isRowError ? 'Gỡ bôi đỏ / khôi phục' : 'Bôi đỏ cảnh báo lỗi'}
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${isRowError ? 'text-white' : 'text-slate-500'}`} />
            </button>

            <button
              type="button"
              onClick={() => {
                const fullStr = via.rawFullVia || `${via.uid}|${via.pass}|${via.twoFa}`;
                handleCopyText(fullStr, `full-${via.id}`, 'Full Via (UID|PASS|2FA)');
              }}
              className={`p-1 rounded border transition-all cursor-pointer ${
                isFullCopied
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
              }`}
              title="Sao chép UID|PASS|2FA"
            >
              {isFullCopied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
            </button>

            <button
              type="button"
              onClick={() => handleOpenEditModal(via)}
              className="p-1 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
              title="Sửa thông tin nick"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>

            {currentUser.role === 'admin' && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Bạn có chắc muốn xóa nick Via UID ${via.uid}?`)) {
                    onDeleteVia(via.id);
                  }
                }}
                className="p-1 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors cursor-pointer"
                title="Xóa nick khỏi bảng"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  if (!isVaultUnlocked) {
    return (
      <section
        id="bang-quan-ly-full-via-locked"
        className="mt-8 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
      >
        <div className="p-8 sm:p-12 bg-gradient-to-b from-slate-900 via-slate-800 to-indigo-950 text-white text-center flex flex-col items-center justify-center min-h-[460px]">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-indigo-500/20 border-2 border-indigo-400/40 rounded-3xl flex items-center justify-center mb-5 shadow-inner">
            <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-300" />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold mb-3">
            <ShieldCheck className="w-4 h-4" />
            <span>KHO DỮ LIỆU BẢO MẬT FULL VIA (UID | PASS | 2FA)</span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white mb-2">
            NHẬP MÃ PIN ĐỂ MỞ KHÓA BẢNG FULL VIA
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-lg mb-6 leading-relaxed">
            Dữ liệu tài khoản Facebook gồm mật khẩu và mã 2FA là thông tin bảo mật cấp cao. Vui lòng xác thực mã PIN của {currentUser.role === 'admin' ? 'Quản Trị Viên (Admin)' : `Nhân Viên (${currentUser.name})`} để mở khóa làm việc an toàn.
          </p>

          <form onSubmit={handleUnlockVault} className="w-full max-w-xs sm:max-w-sm space-y-3">
            <div className="relative">
              <KeyRound className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={isPinVisible ? 'text' : 'password'}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  if (pinError) setPinError(null);
                }}
                disabled={isLockout}
                placeholder="Nhập mã PIN..."
                autoFocus
                className="w-full pl-11 pr-11 py-3 bg-slate-950/90 border border-slate-600 rounded-xl text-center font-mono text-base tracking-widest text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/40 transition-all disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setIsPinVisible(!isPinVisible)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                title={isPinVisible ? 'Ẩn mã PIN' : 'Hiện mã PIN'}
              >
                {isPinVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {pinError && (
              <div className="text-rose-300 text-xs font-semibold flex items-center justify-center space-x-1.5 bg-rose-950/60 py-2 px-3 rounded-lg border border-rose-800/60 animate-shake">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{pinError}</span>
              </div>
            )}

            {isLockout && (
              <div className="text-amber-300 text-xs font-bold py-1 bg-amber-950/60 px-3 rounded-lg border border-amber-800/60">
                ⏳ Đang khóa tạm thời. Thử lại sau: {lockoutTimer} giây
              </div>
            )}

            <button
              type="submit"
              disabled={isLockout || !pinInput.trim()}
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 active:scale-[0.99] text-white font-bold rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Unlock className="w-4 h-4" />
              <span>Mở Khóa Bảng Full Via</span>
            </button>
          </form>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400 border-t border-slate-700/60 pt-4">
            {onBackToFanpageTab && (
              <button
                type="button"
                onClick={onBackToFanpageTab}
                className="text-indigo-300 hover:text-white underline underline-offset-4 cursor-pointer font-medium"
              >
                ← Quay lại Bảng Fanpage
              </button>
            )}
            <span className="hidden sm:inline text-slate-600">•</span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              Tự động khóa sau 5 phút không hoạt động
            </span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="bang-quan-ly-full-via"
      className="mt-8 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
    >
      {/* Toast notification for copy */}
      {copyToastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center space-x-2 text-xs font-semibold animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{copyToastMessage}</span>
        </div>
      )}

      {/* Security Status Ribbon */}
      <div className="bg-emerald-950 px-4 py-1.5 border-b border-emerald-800/40 flex flex-wrap items-center justify-between gap-2 text-[11px] text-emerald-200">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-bold text-emerald-100 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            PHIÊN LÀM VIỆC BẢO MẬT ĐANG MỞ
          </span>
          <span className="hidden md:inline text-emerald-400">• Tự động khóa sau 5 phút không thao tác</span>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-emerald-300">
            Phạm vi: <strong>{currentUser.role === 'admin' ? 'Tất cả nhân viên (Admin)' : currentUser.name}</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              setIsVaultUnlocked(false);
              setCopyToastMessage('🔒 Đã chủ động khóa Bảng Full Via!');
              setTimeout(() => setCopyToastMessage(null), 2500);
            }}
            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-rose-500/30 hover:bg-rose-500/50 text-rose-200 border border-rose-400/40 font-bold text-[10px] cursor-pointer"
            title="Khóa ngay lập tức bảng Full Via"
          >
            <Lock className="w-3 h-3" />
            <span>Khóa Ngay</span>
          </button>
        </div>
      </div>

      {/* Table Header Section */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left info */}
          <div className="flex items-start space-x-3">
            <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30 shrink-0 mt-0.5">
              <Key className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                  BẢNG QUẢN LÝ FULL VIA (UID | PASS | 2FA)
                </h2>
                <span className="bg-emerald-500/30 text-emerald-300 font-extrabold px-2.5 py-0.5 rounded-full text-xs border border-emerald-400/30">
                  {scopedVias.length} Nick
                </span>
                {currentUser.role === 'admin' ? (
                  <span className="bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full text-[11px] border border-amber-400/30 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-amber-400" /> Toàn Quyền Admin
                  </span>
                ) : (
                  <span className="bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full text-[11px] border border-emerald-400/30 flex items-center gap-1">
                    <Users className="w-3 h-3 text-emerald-400" /> Chỉ Xem Của: {currentUser.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                Quản lý tập trung UID, Mật khẩu, 2FA/OTP live, phân quyền nhân viên và tình trạng Fanpage.
              </p>
            </div>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center flex-wrap gap-2 shrink-0">
            {/* Primary Action 1: Add single */}
            <button
              type="button"
              id="btn-add-single-via"
              onClick={handleOpenAddModal}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-xl shadow-md transition-all cursor-pointer"
              title="Thêm 1 nick Full Via mới"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>+ Thêm 1 Nick</span>
            </button>

            {/* Primary Action 2: Bulk import */}
            <button
              type="button"
              id="btn-bulk-import-via"
              onClick={() =>
                onOpenBulkImport(
                  currentUser.role === 'staff'
                    ? currentUser.name
                    : selectedStaffFilter !== 'all'
                    ? selectedStaffFilter
                    : undefined
                )
              }
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl shadow-md transition-all cursor-pointer"
              title="Nhập hàng loạt nick UID|PASS|2FA từ Excel hoặc dán danh sách"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>+ Nhập Hàng Loạt (Excel)</span>
            </button>

            {/* Secondary Action: Copy all UIDs */}
            <button
              type="button"
              id="btn-copy-all-uids"
              onClick={handleCopyAllUids}
              className={`inline-flex items-center space-x-1 px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer border ${
                copiedKey === 'copy-all-uids'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
              }`}
              title="Sao chép toàn bộ UID đang hiển thị (1 UID / dòng)"
            >
              {copiedKey === 'copy-all-uids' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Đã Copy!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-300" />
                  <span>Copy UID ({scopedVias.length})</span>
                </>
              )}
            </button>

            {/* Toggle Passwords */}
            <button
              type="button"
              onClick={() => setShowAllPasswords(!showAllPasswords)}
              className="inline-flex items-center space-x-1 px-2.5 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition-colors cursor-pointer"
              title={showAllPasswords ? 'Ẩn tất cả mật khẩu' : 'Hiện tất cả mật khẩu (tự tắt sau 30s)'}
            >
              {showAllPasswords ? <EyeOff className="w-3.5 h-3.5 text-amber-300" /> : <Eye className="w-3.5 h-3.5 text-slate-300" />}
              <span className="hidden sm:inline">{showAllPasswords ? 'Ẩn Pass' : 'Hiện Pass'}</span>
            </button>

            {/* Toggle 2FA */}
            <button
              type="button"
              onClick={() => setShowAll2Fa(!showAll2Fa)}
              className="inline-flex items-center space-x-1 px-2.5 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition-colors cursor-pointer"
              title={showAll2Fa ? 'Ẩn tất cả mã 2FA' : 'Hiện tất cả mã 2FA (tự tắt sau 30s)'}
            >
              {showAll2Fa ? <EyeOff className="w-3.5 h-3.5 text-emerald-300" /> : <Eye className="w-3.5 h-3.5 text-slate-300" />}
              <span className="hidden sm:inline">{showAll2Fa ? 'Ẩn 2FA' : 'Hiện 2FA'}</span>
            </button>

            {/* Tải Mẫu Excel */}
            <button
              type="button"
              id="btn-download-via-excel-template"
              onClick={() => downloadViaExcelTemplate('xlsx')}
              className="inline-flex items-center space-x-1 px-2.5 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-emerald-300 rounded-xl border border-white/20 transition-colors cursor-pointer"
              title="Tải file Excel mẫu (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Mẫu Excel</span>
            </button>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleRequestExportCSV}
              className="inline-flex items-center space-x-1 px-2.5 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition-colors cursor-pointer"
              title="Xuất bảng Full Via ra CSV (Yêu cầu mã PIN)"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Xuất CSV</span>
            </button>

            {/* Quét Page từ Via nếu có callback */}
            {onFetchPagesForVia && (
              <button
                type="button"
                id="btn-fetch-pages-top-via-table"
                onClick={() =>
                  onFetchPagesForVia(
                    '',
                    currentUser.role === 'staff'
                      ? currentUser.name
                      : selectedStaffFilter !== 'all'
                      ? selectedStaffFilter
                      : ''
                  )
                }
                className="inline-flex items-center space-x-1 px-2.5 py-2 text-xs font-bold text-blue-200 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 rounded-xl transition-all cursor-pointer"
                title="Lấy Tên & Link Page từ Via và điền tự động vào Bảng Fanpage"
              >
                <Zap className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Quét Page</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 🌟 THANH TAB LỌC THEO TỪNG NHÂN VIÊN (DÀNH CHO ADMIN) */}
      {currentUser.role === 'admin' ? (
        <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-1.5 overflow-x-auto py-1 scrollbar-thin">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>Nhân viên:</span>
            </span>

            {/* Tab Tất Cả */}
            <button
              type="button"
              onClick={() => {
                setSelectedStaffFilter('all');
                onSyncStaffFilter?.('all');
              }}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                selectedStaffFilter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span>Tất Cả</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                selectedStaffFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {viaList.length}
              </span>
            </button>

            {/* Individual Staff Tabs */}
            {distinctStaffNames.map((name) => {
              const theme = getStaffTheme(name);
              const stats = staffStats[name] || { total: 0, active: 0, checkpoint: 0, dead: 0 };
              const isSelected = selectedStaffFilter.trim().toLowerCase() === name.trim().toLowerCase();

              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setSelectedStaffFilter(name);
                    onSyncStaffFilter?.(name);
                  }}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                    isSelected ? theme.activeTab : theme.inactiveTab
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : theme.dot}`} />
                  <span>{name}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    isSelected ? 'bg-black/25 text-white' : 'bg-white text-slate-800'
                  }`}>
                    {stats.total}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {selectedStaffFilter === 'all' && (
              <button
                type="button"
                onClick={() => setIsGroupedByStaff(!isGroupedByStaff)}
                className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  isGroupedByStaff
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-bold'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
                title="Nhóm các dòng theo từng nhân viên có tiêu đề phân đoạn"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isGroupedByStaff ? 'Đang phân nhóm NV' : 'Phân nhóm theo NV'}</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Staff Banner: Dedicated to current logged-in staff */
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center space-x-2">
            <UserCheck className="w-4 h-4 text-emerald-700" />
            <span>Tài khoản Full Via bàn giao cho: <strong className="uppercase">{currentUser.name}</strong></span>
          </div>
          <span className="font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full text-[11px]">
            {scopedVias.length} Nick
          </span>
        </div>
      )}

      {/* Unified Filter Toolbar */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Search Input */}
          <div className="relative min-w-[200px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm UID, Mật khẩu, 2FA, NV, Ghi chú..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Status Filter Tabs (Sleek Pills) */}
          <div className="flex items-center space-x-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'bg-slate-800 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Tất cả ({currentBaseVias.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              🟢 Live ({activeCountInScope})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('error')}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'error'
                  ? 'bg-red-600 text-white shadow-2xs'
                  : errorCountInScope > 0
                  ? 'text-red-700 font-black hover:bg-red-50'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              🔴 Lỗi ({errorCountInScope})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('fixed')}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'fixed'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : fixedCountInScope > 0
                  ? 'text-emerald-800 font-black hover:bg-emerald-50'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              ❇️ Đã sửa ({fixedCountInScope})
            </button>
            {checkpointCountInScope > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter('checkpoint')}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === 'checkpoint'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                🟠 CP ({checkpointCountInScope})
              </button>
            )}
            <button
              type="button"
              onClick={() => setStatusFilter('pending_page')}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'pending_page'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : pendingPageCountInScope > 0
                  ? 'text-rose-700 font-black hover:bg-rose-50'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              🔴 Cần Page ({pendingPageCountInScope})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('has_page')}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'has_page'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              📗 Có Page ({hasPageCountInScope})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('no_page')}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'no_page'
                  ? 'bg-slate-600 text-white shadow-2xs'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              ⚪ Chưa page ({noPageCountInScope})
            </button>
          </div>

          {/* Báo Admin Filter Dropdown (Gọn gàng thay vì cả một thanh dài) */}
          <div className="flex items-center space-x-1">
            <select
              value={adminReportFilter}
              onChange={(e) => setAdminReportFilter(e.target.value as any)}
              className={`px-2.5 py-1.5 border rounded-lg text-xs font-bold cursor-pointer focus:outline-hidden transition-colors ${
                adminReportFilter !== 'all'
                  ? 'bg-amber-100 text-amber-900 border-amber-400 ring-1 ring-amber-300'
                  : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
              }`}
              title="Lọc theo trạng thái Báo Admin"
            >
              <option value="all">📢 Báo Admin: Tất cả ({adminReportCounts.all})</option>
              <option value="Live">🟢 Báo: Live ({adminReportCounts.Live})</option>
              <option value="VHH">🔴 Báo: VHH ({adminReportCounts.VHH})</option>
              <option value="SDT">📱 Báo: SDT ({adminReportCounts.SDT})</option>
              <option value="Selfie">🤳 Báo: Selfie ({adminReportCounts.Selfie})</option>
              <option value="Email code">✉️ Báo: Email code ({adminReportCounts['Email code']})</option>
              <option value="None">⚪ Chưa báo Admin ({adminReportCounts.None})</option>
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-slate-500 text-[11px] shrink-0">
          {/* Select all toggle button */}
          <button
            type="button"
            id="btn-toggle-select-all"
            onClick={handleSelectAll}
            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border font-semibold transition-colors cursor-pointer ${
              isAllSelected
                ? 'bg-indigo-50 text-indigo-700 border-indigo-300 font-bold'
                : selectedCount > 0
                ? 'bg-slate-100 text-slate-700 border-slate-300'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>{isAllSelected ? 'Bỏ chọn' : selectedCount > 0 ? `Chọn hết (${scopedVias.length})` : 'Chọn tất cả'}</span>
          </button>

          <span>
            Hiển thị: <strong className="text-slate-800">{scopedVias.length}</strong> / {viaList.length} nick
          </span>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <th className="py-2 px-2 w-16 text-center border-r border-slate-200">
                <div className="flex items-center justify-center space-x-1">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeSelected;
                    }}
                    onChange={handleSelectAll}
                    className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-400 focus:ring-indigo-500 cursor-pointer"
                    title={isAllSelected ? 'Bỏ chọn tất cả nick' : 'Lựa chọn tất cả tài khoản nick'}
                  />
                  <span className="text-[10px]">STT</span>
                </div>
              </th>
              <th className="py-2 px-2.5 w-52 border-r border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-600" />
                    <span>UID FACEBOOK</span>
                  </div>
                  <button
                    type="button"
                    id="btn-copy-all-uids-th"
                    onClick={handleCopyAllUids}
                    className="inline-flex items-center space-x-1 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50 border border-indigo-300 rounded shadow-2xs transition-all cursor-pointer"
                    title={`Sao chép tất cả ${scopedVias.length} UID nick đang hiển thị`}
                  >
                    <Copy className="w-2.5 h-2.5 text-indigo-600" />
                    <span>Copy All</span>
                  </button>
                </div>
              </th>
              <th className="py-2 px-2.5 w-40 border-r border-slate-200">
                <div className="flex items-center space-x-1.5">
                  <Eye className="w-3.5 h-3.5 text-amber-600" />
                  <span>MẬT KHẨU (PASS)</span>
                </div>
              </th>
              <th className="py-2 px-2.5 min-w-[210px] border-r border-slate-200">
                <div className="flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>MÃ 2FA / OTP LIVE</span>
                </div>
              </th>
              <th className="py-2 px-2.5 w-36 border-r border-slate-200">NHÂN VIÊN</th>
              <th className="py-2 px-2.5 min-w-[170px] max-w-[240px] border-r border-slate-200 text-center">
                <div className="flex items-center justify-center space-x-1">
                  <Layers className="w-3.5 h-3.5 text-emerald-700" />
                  <span>PAGE ĐANG CẦM (CẬP NHẬT)</span>
                </div>
              </th>
              <th className="py-2 px-2.5 w-36 border-r border-slate-200 text-center">TRẠNG THÁI</th>
              <th className="py-2 px-2.5 min-w-[165px] max-w-[215px] border-r border-slate-200 text-center bg-amber-50/70">
                <div className="flex items-center justify-center space-x-1 text-amber-950 font-black">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>BÁO ADMIN</span>
                </div>
                <div className="text-[9px] text-amber-800 font-bold lowercase tracking-tight mt-0.5">
                  Live • VHH • SDT • Selfie • Email code
                </div>
              </th>
              <th className="py-2 px-2.5 min-w-[170px] max-w-[220px] border-r border-slate-200">GHI CHÚ CHUNG CẢ VIA</th>
              <th className="py-2 px-2 w-24 text-center">THAO TÁC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80 font-sans">
            {scopedVias.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400">
                  <div className="max-w-xs mx-auto space-y-2">
                    <Key className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-semibold text-slate-600">Không có nick Full Via nào phù hợp</p>
                    <p className="text-[11px] text-slate-400">
                      {searchQuery
                        ? 'Thử thay đổi từ khóa tìm kiếm hoặc bỏ lọc'
                        : currentUser.role === 'admin'
                        ? selectedStaffFilter !== 'all'
                          ? `Chưa có nick nào gán cho ${selectedStaffFilter}. Bấm "+ Thêm nick cho ${selectedStaffFilter}" hoặc "Nhập hàng loạt"`
                          : 'Bấm "Nhập Hàng Loạt" hoặc "+ Thêm 1 Nick" để bắt đầu lưu trữ tài khoản'
                        : 'Bạn chưa được bàn giao nick Via nào. Vui lòng liên hệ Admin.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : isGroupedByStaff && selectedStaffFilter === 'all' && currentUser.role === 'admin' ? (
              /* Grouped by Staff View */
              distinctStaffNames.map((staffName) => {
                const staffVias = scopedVias.filter(
                  (v) => v.staffName.trim().toLowerCase() === staffName.trim().toLowerCase()
                );
                if (staffVias.length === 0) return null;

                const activeCount = staffVias.filter((v) => v.status !== 'checkpoint' && v.status !== 'dead').length;
                const checkpointCount = staffVias.filter((v) => v.status === 'checkpoint').length;

                return (
                  <React.Fragment key={staffName}>
                    {/* Staff Group Header Row */}
                    <tr className="bg-slate-100 border-y-2 border-slate-300">
                      <td colSpan={10} className="py-2.5 px-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-black text-indigo-950 uppercase tracking-wide flex items-center gap-1.5">
                              <Users className="w-4 h-4 text-indigo-600" />
                              <span>Nhân Viên: {staffName}</span>
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">
                              {staffVias.length} Nick do Admin nhập
                            </span>
                            <span className="text-[11px] text-slate-500">
                              ({activeCount} Hoạt Động{checkpointCount > 0 ? `, ${checkpointCount} Checkpoint` : ''})
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                const uids = staffVias.map((v) => v.uid?.trim()).filter(Boolean);
                                if (uids.length === 0) return;
                                navigator.clipboard.writeText(uids.join('\n'));
                                setCopyToastMessage(`📋 Đã copy ${uids.length} UID nick của ${staffName}!`);
                                setTimeout(() => setCopyToastMessage(null), 3000);
                              }}
                              className="text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer flex items-center space-x-1"
                              title={`Sao chép tất cả ${staffVias.length} UID nick của ${staffName}`}
                            >
                              <Copy className="w-3 h-3" />
                              <span>Copy {staffVias.length} UID</span>
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() => handleOpenAddModalForStaff(staffName)}
                              className="text-xs font-bold text-indigo-700 hover:text-indigo-900 hover:underline cursor-pointer"
                            >
                              + Thêm nick cho {staffName}
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() => onOpenBulkImport(staffName)}
                              className="text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
                            >
                              📥 Nhập hàng loạt cho {staffName}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Staff Group Rows */}
                    {staffVias.map((via, index) => renderViaRow(via, index))}
                  </React.Fragment>
                );
              })
            ) : (
              /* Standard sequential list */
              scopedVias.map((via, index) => renderViaRow(via, index))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info of Table */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-emerald-600" />
          <span>
            Bảo mật phân quyền: Mật khẩu và mã 2FA được mã hóa tự động trong trình duyệt, phân quyền bảo mật theo từng nhân viên.
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() =>
              onOpenBulkImport(
                currentUser.role === 'staff' ? currentUser.name : undefined
              )
            }
            className="text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer"
          >
            + Bổ sung nhiều nick cùng lúc (Check trùng UID)
          </button>
        </div>
      </div>

      {/* Single Via Add / Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Key className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm">
                  {editingVia ? 'Chỉnh Sửa Thông Tin Full Via' : 'Thêm 1 Nick Full Via Mới'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveModalForm} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  UID Facebook <span className="text-red-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 100084392019485"
                  value={modalForm.uid}
                  onChange={(e) => setModalForm({ ...modalForm, uid: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg font-mono focus:ring-2 focus:outline-hidden ${
                    duplicateViaInModal
                      ? 'border-amber-500 bg-amber-50/50 focus:ring-amber-500'
                      : 'border-slate-300 focus:ring-indigo-500'
                  }`}
                />
                {duplicateViaInModal && (
                  <div className="mt-1.5 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">⚠️ Cảnh báo: UID đã tồn tại trong hệ thống!</span>
                      <span className="text-[11px] text-amber-800 block mt-0.5">
                        Nick này đang được quản lý bởi: <strong>{duplicateViaInModal.staffName}</strong> (Trạng thái: {duplicateViaInModal.status || 'Live'}). Hãy kiểm tra kỹ tránh tạo trùng.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">
                      Mật Khẩu (PASS) <span className="text-red-500">*</span>:
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsModalPassVisible(!isModalPassVisible)}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center space-x-0.5 cursor-pointer"
                    >
                      {isModalPassVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{isModalPassVisible ? 'Ẩn' : 'Hiện'}</span>
                    </button>
                  </div>
                  <input
                    type={isModalPassVisible ? 'text' : 'password'}
                    required
                    placeholder="Nhập mật khẩu..."
                    value={modalForm.pass}
                    onChange={(e) => setModalForm({ ...modalForm, pass: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">
                      Mã 2FA (Secret Key):
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsModalTwoFaVisible(!isModalTwoFaVisible)}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center space-x-0.5 cursor-pointer"
                    >
                      {isModalTwoFaVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{isModalTwoFaVisible ? 'Ẩn' : 'Hiện'}</span>
                    </button>
                  </div>
                  <input
                    type={isModalTwoFaVisible ? 'text' : 'password'}
                    placeholder="VD: JBSWY3DPEHPK3PXP"
                    value={modalForm.twoFa}
                    onChange={(e) => setModalForm({ ...modalForm, twoFa: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Nhân Viên Phụ Trách:
                  </label>
                  {currentUser.role === 'admin' ? (
                    <select
                      value={modalForm.staffName}
                      onChange={(e) => setModalForm({ ...modalForm, staffName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
                    >
                      {availableStaffNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      disabled
                      value={currentUser.name}
                      className="w-full px-3 py-2 border border-slate-200 bg-slate-100 rounded-lg font-semibold text-slate-600"
                    />
                  )}
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Trạng Thái Nick:
                  </label>
                  <select
                    value={modalForm.status}
                    onChange={(e) => {
                      const val = e.target.value as 'active' | 'checkpoint' | 'dead' | 'fixed';
                      setModalForm({
                        ...modalForm,
                        status: val,
                        isFixed: val === 'fixed',
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
                  >
                    <option value="active">Hoạt Động (Live)</option>
                    <option value="fixed">❇️ Đã Sửa / Thay Via Mới (Bôi xanh)</option>
                    <option value="checkpoint">Bị Checkpoint</option>
                    <option value="dead">Bị Die</option>
                  </select>
                </div>
              </div>

              {/* Báo Admin: Live, VHH, SDT, Selfie, Email code */}
              <div className="p-3 rounded-xl border border-amber-300 bg-amber-50/70 space-y-1.5">
                <label className="font-bold text-amber-950 text-xs flex items-center space-x-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Báo Admin (Tình trạng Nick Via):</span>
                </label>
                <select
                  value={modalForm.adminReportStatus || 'None'}
                  onChange={(e) => {
                    setModalForm({
                      ...modalForm,
                      adminReportStatus: e.target.value as ViaAdminReportStatus,
                    });
                  }}
                  className="w-full px-3 py-2 border border-amber-300 rounded-lg bg-white font-bold text-xs"
                >
                  <option value="None">⚪ -- Chưa báo Admin --</option>
                  <option value="Live">🟢 Live (Nick sống bình thường)</option>
                  <option value="VHH">🔴 VHH (Vô hiệu hóa)</option>
                  <option value="SDT">📱 SDT (Checkpoint số điện thoại)</option>
                  <option value="Selfie">🤳 Selfie (Checkpoint quét mặt)</option>
                  <option value="Email code">✉️ Email code (Code mail)</option>
                </select>
                <p className="text-[10px] text-amber-800 italic">
                  💡 Cột Báo Admin giúp quản lý nhanh: Live, VHH, SDT, Selfie, Email code.
                </p>
              </div>

              {/* Ô chọn: Admin đã sửa lỗi và thay via mới -> bôi xanh */}
              <label className="flex items-center space-x-2 p-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-xs font-bold text-emerald-950 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(modalForm.isFixed || modalForm.status === 'fixed')}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setModalForm({
                      ...modalForm,
                      isFixed: checked,
                      status: checked ? 'fixed' : 'active',
                      isError: checked ? false : modalForm.isError,
                    });
                  }}
                  className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                />
                <span>
                  ✓ Ô chọn: Admin đã sửa lỗi & thay via mới (Bôi ô via này màu xanh để dễ phân biệt)
                </span>
              </label>

              {/* Cập nhật trạng thái Page của Via (🔴 Đỏ: Admin báo có Page -> 🟢 Xanh: Đã update page) */}
              <div className="p-3 rounded-xl border border-slate-300 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Trạng Thái Cập Nhật Page Của Nick:</span>
                  </label>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {modalForm.pageUpdateStatus === 'pending'
                      ? '🔴 Đã Có Page (Màu đỏ)'
                      : modalForm.pageUpdateStatus === 'updated'
                      ? '🟢 Đã có Page (Màu xanh lá)'
                      : '⚪ Chưa có page (Màu trắng)'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalForm({ ...modalForm, pageUpdateStatus: 'none' })}
                    className={`p-2 rounded-lg border text-center transition-all cursor-pointer font-bold text-[11px] ${
                      modalForm.pageUpdateStatus === 'none'
                        ? 'bg-white border-slate-400 text-slate-800 shadow-2xs ring-2 ring-slate-400'
                        : 'bg-white/80 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    ⚪ Chưa có page
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalForm({ ...modalForm, pageUpdateStatus: 'pending' })}
                    className={`p-2 rounded-lg border text-center transition-all cursor-pointer font-bold text-[11px] ${
                      modalForm.pageUpdateStatus === 'pending'
                        ? 'bg-rose-600 text-white border-rose-700 shadow-2xs ring-2 ring-rose-300'
                        : 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100'
                    }`}
                    title="Chuyển sang trạng thái: Màu đỏ Đã Có Page để nhân viên biết vào update page lên"
                  >
                    🔴 Đã Có Page (Đỏ)
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalForm({ ...modalForm, pageUpdateStatus: 'updated' })}
                    className={`p-2 rounded-lg border text-center transition-all cursor-pointer font-bold text-[11px] ${
                      modalForm.pageUpdateStatus === 'updated'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs ring-2 ring-emerald-300'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                    }`}
                    title="Đánh dấu đã cập nhật Page (Màu xanh lá)"
                  >
                    🟢 Đã có Page (Xanh)
                  </button>
                </div>

                <p className="text-[10px] text-slate-500 italic">
                  💡 <strong>Quy trình:</strong> Mặc định là <strong>⚪ Chưa có page (Màu trắng)</strong>. Khi Admin ấn vào sẽ chuyển sang <strong>🔴 Màu đỏ Đã Có Page</strong> để nhân viên biết cần update. Khi nhân viên lưu Fanpage hoặc bấm <em>✓ Đã Update Page</em>, hệ thống sẽ tự động chuyển sang <strong>🟢 Màu Xanh Lá</strong>.
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Ghi Chú Chung Cả Via (Chung cho 2 hay 3 page chung nick này):
                </label>
                <input
                  type="text"
                  placeholder="VD: Nick via US 2019, đã thay ngày 18/09, chung cho 3 page..."
                  value={modalForm.note}
                  onChange={(e) => setModalForm({ ...modalForm, note: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Action buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center space-x-1.5 px-5 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingVia ? 'Cập Nhật' : 'Lưu Nick Mới'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Export CSV PIN Verification Modal */}
      {isExportPinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">XÁC THỰC XUẤT DỮ LIỆU</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsExportPinModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirmExportWithPin();
              }}
              className="p-5 space-y-4"
            >
              <p className="text-xs text-slate-600 leading-relaxed">
                Tải file CSV chứa toàn bộ tài khoản (UID, PASS, 2FA) là thao tác nhạy cảm. Vui lòng nhập mã PIN bảo mật của bạn để xác nhận tải file:
              </p>

              <div>
                <input
                  type="password"
                  autoFocus
                  required
                  placeholder="Nhập mã PIN xác nhận..."
                  value={exportPinInput}
                  onChange={(e) => {
                    setExportPinInput(e.target.value);
                    if (exportPinError) setExportPinError(null);
                  }}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-center font-mono text-base tracking-widest focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              {exportPinError && (
                <div className="text-xs font-semibold text-red-600 bg-red-50 p-2 rounded-lg border border-red-200 text-center">
                  {exportPinError}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsExportPinModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={!exportPinInput.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  Xác Nhận & Xuất File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Action Pill for selected items on mobile/desktop */}
      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-950/95 text-white backdrop-blur-md px-5 py-3 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center space-x-3 text-xs animate-in slide-in-from-bottom-5 duration-200 max-w-[92vw] overflow-x-auto">
          <div className="flex items-center space-x-2 pr-2 border-r border-slate-700 shrink-0">
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <span className="font-bold whitespace-nowrap">
              Đã chọn <span className="text-emerald-400 font-black">{selectedCount}</span> nick
            </span>
          </div>

          <button
            type="button"
            id="btn-copy-selected-uids-float"
            onClick={handleCopySelectedUids}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl font-bold shadow-md transition-all cursor-pointer shrink-0"
            title="Sao chép UID của các nick đã chọn (1 UID / dòng)"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Sao Chép {selectedCount} UID</span>
          </button>

          <button
            type="button"
            onClick={handleCopySelectedFullVia}
            className="inline-flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl font-bold shadow-md transition-all cursor-pointer shrink-0"
            title="Sao chép UID|PASS|2FA của các nick đã chọn"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy Full</span>
          </button>

          {/* Quick Báo Admin batch in floating pill */}
          <div className="flex items-center space-x-1 pl-1 border-l border-slate-700 shrink-0">
            <select
              onChange={(e) => {
                if (!e.target.value) return;
                handleBatchUpdateAdminReport(e.target.value as ViaAdminReportStatus);
                e.target.value = '';
              }}
              defaultValue=""
              className="bg-amber-950/80 hover:bg-amber-900 border border-amber-500/70 text-amber-200 text-xs font-bold rounded-xl px-2 py-1.5 focus:outline-hidden cursor-pointer"
              title="Cập nhật nhanh Báo Admin cho các nick đang chọn"
            >
              <option value="" disabled>📢 Báo Admin...</option>
              <option value="Live">🟢 Live</option>
              <option value="VHH">🔴 VHH</option>
              <option value="SDT">📱 SDT</option>
              <option value="Selfie">🤳 Selfie</option>
              <option value="Email code">✉️ Email code</option>
              <option value="None">⚪ Xóa báo</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleSelectAll}
            className="text-xs text-indigo-300 hover:text-white underline underline-offset-2 px-1 cursor-pointer font-medium whitespace-nowrap shrink-0"
          >
            {isAllSelected ? 'Bỏ chọn' : `Chọn tất cả (${scopedVias.length})`}
          </button>

          <button
            type="button"
            onClick={handleDeselectAll}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Hủy lựa chọn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </section>
  );
};
