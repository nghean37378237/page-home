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
import { FullViaItem, AppUser, PageRecord, ViaPageUpdateStatus } from '../types';
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

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (v) =>
          v.uid.toLowerCase().includes(q) ||
          v.pass.toLowerCase().includes(q) ||
          v.twoFa.toLowerCase().includes(q) ||
          v.staffName.toLowerCase().includes(q) ||
          (v.note && v.note.toLowerCase().includes(q))
      );
    }

    return list;
  }, [strictlyGuardedVias, currentUser, selectedStaffFilter, searchQuery, statusFilter, pagesPerViaUid]);

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
    const headers = ['STT', 'UID', 'PASS', '2FA', 'TÊN NHÂN VIÊN', 'TRẠNG THÁI', 'GHI CHÚ'];
    const rows = scopedVias.map((v, i) => [
      `"${i + 1}"`,
      `"${v.uid.replace(/"/g, '""')}"`,
      `"${v.pass.replace(/"/g, '""')}"`,
      `"${v.twoFa.replace(/"/g, '""')}"`,
      `"${v.staffName.replace(/"/g, '""')}"`,
      `"${v.status || 'active'}"`,
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
            ? 'bg-indigo-100/70 hover:bg-indigo-100/90 border-l-4 border-l-indigo-600 border-indigo-300 ring-1 ring-inset ring-indigo-200'
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
          className={`py-1.5 px-2 text-center font-mono font-semibold border-r text-[11px] ${
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
          className={`py-1.5 px-2.5 border-r transition-colors ${
            isSelected
              ? 'border-indigo-300 bg-indigo-100/40'
              : isRowError
              ? 'border-red-200 bg-red-100/60 ring-1 ring-inset ring-red-300'
              : isRowFixed
              ? 'border-emerald-300 bg-emerald-100/80 ring-1 ring-inset ring-emerald-400'
              : isPendingPage
              ? 'border-rose-300 bg-rose-100/60 ring-1 ring-inset ring-rose-300'
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
                  className="bg-rose-600 text-white font-black text-[9px] px-1.5 py-0.5 rounded shadow-2xs shrink-0 flex items-center space-x-0.5 animate-pulse"
                  title="Admin đã chuyển sang trạng thái: Đã Có Page! Cần nhân viên cập nhật Page lên"
                >
                  <AlertCircle className="w-2.5 h-2.5 text-white" />
                  <span>ĐÃ CÓ PAGE</span>
                </span>
              )}
              {isUpdatedPage && !isRowError && !isRowFixed && (
                <span
                  className="bg-emerald-600 text-white font-extrabold text-[9px] px-1 py-0.2 rounded shadow-2xs shrink-0 flex items-center space-x-0.5"
                  title={`Nick này đã được cập nhật ${assignedPages.length || 1} Page`}
                >
                  <Check className="w-2.5 h-2.5 text-white stroke-[2.5]" />
                  <span>CÓ PAGE</span>
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
              {(via.pass || via.twoFa) && (
                <button
                  type="button"
                  onClick={() => {
                    const fullStr = via.rawFullVia || `${via.uid}|${via.pass}|${via.twoFa}`;
                    handleCopyText(fullStr, `full-${via.id}`, 'Full Via (UID|PASS|2FA)');
                  }}
                  className={`inline-flex items-center space-x-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded border transition-all cursor-pointer ${
                    isFullCopied
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                  title="Sao chép toàn bộ chuỗi Full Via (UID|PASS|2FA)"
                >
                  {isFullCopied ? (
                    <>
                      <Check className="w-2.5 h-2.5 text-white" />
                      <span>Full ✓</span>
                    </>
                  ) : (
                    <span>Full</span>
                  )}
                </button>
              )}
            </div>
          </div>
        </td>

        {/* 3. CỘT MẬT KHẨU PASS */}
        <td className={`py-1.5 px-2.5 border-r ${isRowError ? 'border-red-200' : 'border-slate-200'}`}>
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
                className="text-slate-400 hover:text-slate-700 p-0.5 shrink-0"
                title={isPasswordVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {isPasswordVisible ? (
                  <EyeOff className="w-3 h-3 text-amber-600" />
                ) : (
                  <Eye className="w-3 h-3" />
                )}
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
        <td className={`py-1.5 px-2.5 border-r ${isRowError ? 'border-red-200' : 'border-slate-200'}`}>
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
                    {is2FaVisible ? (
                      <EyeOff className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Eye className="w-3 h-3" />
                    )}
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
        <td className={`py-1.5 px-2.5 border-r ${isRowError ? 'border-red-200' : 'border-slate-200'}`}>
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

        {/* 6. PAGE ĐANG CẦM (BÔI MÀU & GHI CHÚ NHÂN VIÊN CẬP NHẬT) */}
        <td
          className={`py-1.5 px-2.5 border-r transition-all text-center ${
            isRowError
              ? 'border-red-200'
              : isRowFixed
              ? 'border-emerald-200 bg-emerald-50/50'
              : isPendingPage
              ? 'border-rose-300 bg-rose-50/95 ring-1 ring-inset ring-rose-300'
              : isUpdatedPage
              ? 'border-emerald-300 bg-emerald-50/90 ring-1 ring-inset ring-emerald-200/80'
              : 'border-slate-200'
          }`}
        >
          <div className="flex flex-col items-center space-y-1 w-full min-w-[170px] max-w-[240px] mx-auto">
            {isPendingPage ? (
              <>
                {/* 🔴 TRẠNG THÁI MÀU ĐỎ: ĐÃ CÓ PAGE (Admin đã ấn vào) */}
                <div className="flex items-center justify-center space-x-1 w-full">
                  {currentUser.role === 'admin' ? (
                    <button
                      type="button"
                      onClick={() => handleSetViaPageStatus(via, 'none')}
                      className="w-full inline-flex items-center justify-center space-x-1.5 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md font-black text-[11px] shadow-xs tracking-tight cursor-pointer transition-all animate-pulse"
                      title="🔴 Đã Có Page! (Admin bấm vào đây nếu muốn chuyển lại về Chưa có page)"
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-white shrink-0" />
                      <span>🔴 Đã Có Page</span>
                    </button>
                  ) : (
                    <div
                      className="w-full inline-flex items-center justify-center space-x-1.5 px-2.5 py-1 bg-rose-600 text-white rounded-md font-black text-[11px] shadow-xs tracking-tight animate-pulse"
                      title="Admin đã báo nick này: Đã Có Page! Cần nhân viên cập nhật Page lên"
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-white shrink-0" />
                      <span>🔴 Đã Có Page</span>
                    </div>
                  )}
                </div>

                {/* Hộp thông báo nhắc nhở nhân viên */}
                <div
                  onClick={() => onFilterPageByVia && onFilterPageByVia(via.uid)}
                  className="w-full text-center px-1.5 py-0.5 rounded text-[10px] font-bold border border-rose-200 bg-rose-100/90 text-rose-950 shadow-2xs cursor-pointer hover:bg-rose-200 transition-colors flex items-center justify-center space-x-1"
                  title="Nhấn để chuyển sang Bảng Fanpage cập nhật ngay"
                >
                  <Bell className="w-2.5 h-2.5 text-rose-700 shrink-0 animate-bounce" />
                  <span className="truncate">👉 NV cập nhật Page lên</span>
                </div>

                {/* Nút hành động nhanh: Xác nhận đã update page (Chuyển sang màu xanh lá) */}
                <div className="flex items-center justify-center flex-wrap gap-1 pt-0.5 w-full">
                  <button
                    type="button"
                    onClick={() => handleSetViaPageStatus(via, 'updated')}
                    className="inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-black shadow-2xs transition-all cursor-pointer"
                    title="Bấm để xác nhận đã update Page -> Chuyển thành Màu Xanh Lá!"
                  >
                    <CheckCircle2 className="w-2.5 h-2.5 text-white stroke-[2.5]" />
                    <span>✓ Đã Update Page</span>
                  </button>

                  {onFilterPageByVia && (
                    <button
                      type="button"
                      onClick={() => onFilterPageByVia(via.uid)}
                      className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded text-[10px] font-bold transition-colors cursor-pointer"
                      title="Mở Bảng Fanpage lọc nick này để tạo hoặc sửa Page"
                    >
                      <Layers className="w-2.5 h-2.5 text-indigo-600" />
                      <span>Vào Page</span>
                    </button>
                  )}

                  {onAddPageForVia && (
                    <button
                      type="button"
                      onClick={() => onAddPageForVia(via.uid, via.staffName)}
                      className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 text-[10px] font-bold text-rose-800 bg-rose-100 hover:bg-rose-200 border border-rose-300 rounded transition-colors cursor-pointer"
                      title="Thêm Page mới cho nick này"
                    >
                      <Plus className="w-2.5 h-2.5 text-rose-700" />
                      <span>+Page</span>
                    </button>
                  )}
                </div>
              </>
            ) : isUpdatedPage ? (
              <>
                {/* 🟢 BÔI MÀU XANH LÁ: ĐÃ CÓ PAGE VÀ ĐÃ ĐƯỢC CẬP NHẬT */}
                <div className="flex items-center justify-center space-x-1.5 w-full">
                  <button
                    type="button"
                    onClick={() => onFilterPageByVia && onFilterPageByVia(via.uid)}
                    className="inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-black text-[11px] shadow-2xs cursor-pointer transition-all tracking-tight"
                    title="Bấm để lọc xem danh sách các Fanpage này ở Bảng Fanpage để cập nhật bài"
                  >
                    <CheckCircle2 className="w-3 h-3 text-white" />
                    <span>ĐÃ CÓ {assignedPages.length || 1} PAGE</span>
                  </button>
                </div>

                {/* Ghi chú nhắc nhở nhân viên cập nhật */}
                <div
                  onClick={() => onFilterPageByVia && onFilterPageByVia(via.uid)}
                  className={`w-full text-center px-1.5 py-0.5 rounded text-[10px] font-bold border shadow-2xs cursor-pointer transition-colors flex items-center justify-center space-x-1 ${
                    allPagesDone
                      ? 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100'
                      : pendingPagesCount > 0
                      ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                      : 'bg-white/95 border-emerald-300 text-emerald-900 hover:bg-emerald-50'
                  }`}
                  title="Nhấn để chuyển sang Bảng Fanpage cập nhật ngay"
                >
                  <Bell className={`w-2.5 h-2.5 shrink-0 ${allPagesDone ? 'text-blue-600' : 'text-amber-600'}`} />
                  <span className="truncate">
                    {allPagesDone
                      ? '✓ Đã xong bài hôm nay'
                      : pendingPagesCount > 0
                      ? `👉 Cần cập nhật (${pendingPagesCount} page)`
                      : '✓ Đã cập nhật Page'}
                  </span>
                </div>

                {/* Danh sách tên các Page ngắn gọn (chip nhỏ) */}
                {assignedPages.length > 0 && (
                  <div className="w-full flex flex-col space-y-0.5 text-left pt-0.5">
                    {assignedPages.slice(0, 2).map((p) => (
                      <div
                        key={p.id}
                        onClick={() => onFilterPageByVia && onFilterPageByVia(via.uid)}
                        className="flex items-center justify-between space-x-1 px-1.5 py-0.5 bg-white/90 hover:bg-white border border-emerald-200/90 rounded text-[10px] text-slate-800 cursor-pointer shadow-2xs transition-colors"
                        title={`Page: ${p.pageName} (Tiến độ: ${p.actualPosts || 0}/${p.targetPosts || 0} bài. Nhấn để cập nhật)`}
                      >
                        <span className="truncate font-semibold text-emerald-950 flex items-center space-x-0.5">
                          <FileText className="w-2.5 h-2.5 text-emerald-600 shrink-0 inline mr-0.5" />
                          <span className="truncate">{p.pageName || 'Chưa đặt tên'}</span>
                        </span>
                        <span className={`text-[9px] font-mono font-bold px-1 rounded shrink-0 ${
                          p.isCompleted || (p.actualPosts || 0) >= (p.targetPosts || 0)
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {p.actualPosts || 0}/{p.targetPosts || 0}
                        </span>
                      </div>
                    ))}
                    {assignedPages.length > 2 && (
                      <button
                        type="button"
                        onClick={() => onFilterPageByVia && onFilterPageByVia(via.uid)}
                        className="text-[9px] font-bold text-emerald-800 hover:text-emerald-950 hover:underline text-center cursor-pointer"
                      >
                        + {assignedPages.length - 2} page nữa (xem tất cả)
                      </button>
                    )}
                  </div>
                )}

                {/* Hàng nút hành động nhanh (xếp ngang gọn gàng) */}
                <div className="flex items-center justify-center flex-wrap gap-1 pt-0.5 w-full">
                  {onFilterPageByVia && (
                    <button
                      type="button"
                      onClick={() => onFilterPageByVia(via.uid)}
                      className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded text-[10px] font-bold transition-colors cursor-pointer"
                      title="Chuyển sang Bảng Fanpage lọc đúng nick này để cập nhật tiến độ bài đăng"
                    >
                      <Layers className="w-2.5 h-2.5 text-indigo-600" />
                      <span>Cập nhật</span>
                    </button>
                  )}
                  {onAddPageForVia && (
                    <button
                      type="button"
                      onClick={() => onAddPageForVia(via.uid, via.staffName)}
                      className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded transition-colors cursor-pointer"
                      title="Thêm 1 Fanpage mới cho Nick Via này"
                    >
                      <Plus className="w-2.5 h-2.5 text-emerald-600" />
                      <span>+Page</span>
                    </button>
                  )}
                  {onFetchPagesForVia && (
                    <button
                      type="button"
                      onClick={() => onFetchPagesForVia(via.uid, via.staffName)}
                      className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 text-[10px] font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors cursor-pointer"
                      title="Lấy Tên & Link Page từ Via và điền tự động"
                    >
                      <Zap className="w-2.5 h-2.5 text-blue-600 fill-blue-600" />
                      <span>Quét</span>
                    </button>
                  )}
                  {onTransferViaPages && (
                    <button
                      type="button"
                      onClick={() => onTransferViaPages(via.uid)}
                      className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded transition-colors cursor-pointer"
                      title="Chuyển toàn bộ Page của nick này sang nick khác"
                    >
                      <ArrowRightLeft className="w-2.5 h-2.5 text-slate-600" />
                      <span>Chuyển</span>
                    </button>
                  )}
                  {currentUser.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => handleSetViaPageStatus(via, 'pending')}
                      className="text-[9px] text-rose-600 hover:text-rose-800 hover:underline px-1 py-0.5 cursor-pointer font-bold"
                      title="Admin đổi lại sang màu đỏ để báo nhân viên cập nhật lại"
                    >
                      🔴 Báo Đỏ
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* ⚪ TRẠNG THÁI MẶC ĐỊNH MÀU TRẮNG: "Chưa có page" (Khi admin ấn vào sẽ chuyển sang: Màu đỏ Đã Có Page) */}
                <div className="w-full">
                  {currentUser.role === 'admin' ? (
                    <button
                      type="button"
                      onClick={() => handleSetViaPageStatus(via, 'pending')}
                      className="w-full py-1.5 px-2 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-300 hover:border-rose-400 rounded-md shadow-2xs text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 group"
                      title="Nhấn vào để chuyển sang: Màu đỏ Đã Có Page"
                    >
                      <span className="w-2 h-2 rounded-full border border-slate-400 bg-slate-100 group-hover:border-rose-500 group-hover:bg-rose-500 transition-colors shrink-0" />
                      <span>Chưa có page</span>
                    </button>
                  ) : (
                    <div className="w-full py-1.5 px-2 bg-white text-slate-600 border border-slate-200 rounded-md shadow-2xs text-[11px] font-semibold flex items-center justify-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full border border-slate-300 bg-slate-200 shrink-0" />
                      <span>Chưa có page</span>
                    </div>
                  )}
                </div>

                {/* Các nút thao tác nhỏ gọn bên dưới */}
                <div className="flex items-center justify-center space-x-1 pt-0.5 w-full">
                  {onAddPageForVia && (
                    <button
                      type="button"
                      onClick={() => onAddPageForVia(via.uid, via.staffName)}
                      className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded transition-colors cursor-pointer"
                      title="Tạo Page mới cho Nick Via này"
                    >
                      <Plus className="w-2.5 h-2.5 text-slate-500" />
                      <span>+ Thêm</span>
                    </button>
                  )}
                  {onFetchPagesForVia && (
                    <button
                      type="button"
                      onClick={() => onFetchPagesForVia(via.uid, via.staffName)}
                      className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 bg-blue-50/70 hover:bg-blue-100 border border-blue-200 rounded transition-colors cursor-pointer"
                      title="Lấy Tên & Link Page từ Via và điền tự động"
                    >
                      <Zap className="w-2.5 h-2.5 text-blue-600" />
                      <span>Quét</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </td>

        {/* 7. TRẠNG THÁI & Ô CHỌN BÔI XANH KHI ADMIN ĐÃ SỬA LỖI & THAY VIA MỚI */}
        <td className={`py-1.5 px-2.5 border-r ${isRowError ? 'border-red-200' : isRowFixed ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'}`}>
          <div className="flex flex-col space-y-1 min-w-[130px] max-w-[150px]">
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
              className={`text-[11px] font-bold rounded px-1.5 py-0.5 border shadow-2xs cursor-pointer focus:outline-hidden transition-colors ${
                isRowError
                  ? 'bg-red-600 text-white border-red-700 font-extrabold ring-1 ring-red-300'
                  : isRowFixed
                  ? 'bg-emerald-600 text-white border-emerald-700 font-extrabold ring-1 ring-emerald-300'
                  : via.status === 'checkpoint'
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-emerald-50 text-emerald-900 border-emerald-300'
              }`}
              title="Bấm để đổi trạng thái hoặc bôi màu đỏ/xanh"
            >
              <option value="active">🟢 Hoạt Động (Live)</option>
              <option value="fixed">❇️ Đã Sửa (Bôi Xanh)</option>
              <option value="error">🔴 Nick Lỗi (Bôi đỏ)</option>
              <option value="checkpoint">🟠 Checkpoint</option>
              <option value="dead">🪦 Bị Die</option>
            </select>

            <label
              className={`flex items-center space-x-1 px-1.5 py-0.5 rounded border text-[10px] font-bold cursor-pointer select-none transition-all shadow-2xs ${
                isRowFixed
                  ? 'bg-emerald-600 text-white border-emerald-700 ring-1 ring-emerald-300'
                  : 'bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border-slate-300'
              }`}
              title="Ô chọn trong Via: Click vào bôi ô via này lại màu xanh lá để dễ phân biệt khi Admin đã sửa lỗi và thay via mới"
            >
              <input
                type="checkbox"
                checked={isRowFixed}
                onChange={() => {
                  const nextFixed = !isRowFixed;
                  onUpdateVia({
                    ...via,
                    isFixed: nextFixed,
                    isError: nextFixed ? false : via.isError,
                    status: nextFixed ? 'fixed' : 'active',
                  });
                  setCopyToastMessage(
                    nextFixed
                      ? `❇️ Đã bôi xanh nick ${via.uid} (Admin đã sửa lỗi & thay via mới)`
                      : `Đã bỏ bôi xanh nick ${via.uid}`
                  );
                  setTimeout(() => setCopyToastMessage(null), 2500);
                }}
                className="w-3 h-3 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer shrink-0"
              />
              <span className="truncate">
                {isRowFixed ? '✓ Đã sửa (Xanh)' : 'Bôi xanh đã sửa'}
              </span>
            </label>
          </div>
        </td>

        {/* 8. GHI CHÚ CHUNG CHO TẤT CẢ CÁC PAGE CÙNG VIA */}
        <td
          className={`py-1.5 px-2.5 border-r text-xs min-w-[170px] max-w-[220px] ${
            isRowError
              ? 'border-red-200 bg-red-50/30'
              : isRowFixed
              ? 'border-emerald-200 bg-emerald-50/40'
              : 'border-slate-200'
          }`}
        >
          <div className="flex flex-col space-y-0.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-slate-700 flex items-center space-x-1">
                <span>📝 Ghi chú cả via:</span>
              </span>
              {assignedPages.length > 0 && (
                <span className="text-[9px] text-emerald-800 font-bold bg-emerald-50 px-1 py-0.2 rounded border border-emerald-300">
                  {assignedPages.length} page
                </span>
              )}
            </div>
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
              placeholder="Ghi chú chung cho các page..."
              className="w-full text-xs font-medium bg-white hover:bg-white focus:bg-white border border-slate-300 focus:border-emerald-600 rounded px-1.5 py-0.5 text-slate-800 focus:outline-hidden shadow-2xs resize-none"
              title="Ghi chú chung này được đồng bộ và áp dụng cho tất cả các Fanpage dùng chung nick Via này"
            />
          </div>
        </td>

        {/* 9. THAO TÁC */}
        <td className="py-1.5 px-2 text-center">
          <div className="flex items-center justify-center space-x-1">
            {/* Quick 1-click Báo Lỗi / Bôi Đỏ button */}
            <button
              type="button"
              onClick={() => handleToggleErrorVia(via)}
              className={`p-1 rounded border transition-all cursor-pointer ${
                isRowError
                  ? 'bg-red-600 text-white border-red-700 hover:bg-red-700 shadow-2xs ring-1 ring-red-300'
                  : 'bg-slate-50 text-slate-400 hover:text-red-700 hover:bg-red-50 border-slate-200'
              }`}
              title={
                isRowError
                  ? 'Nick đang bị bôi đỏ (Lỗi). Bấm để gỡ bôi đỏ và khôi phục hoạt động'
                  : 'Bấm để bôi màu đỏ cảnh báo (Via bị lỗi / die)'
              }
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
              title="Sao chép toàn bộ chuỗi UID|PASS|2FA"
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
      <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white">
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
                Bảng danh sách nick Facebook gồm <strong>STT</strong>, <strong>UID</strong>, <strong>PASS</strong>, <strong>2FA</strong> mỗi thông tin 1 cột riêng biệt. Bấm 1-click để copy ngay vào clipboard hoặc tạo mã 2FA 6 số live.
              </p>
            </div>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center flex-wrap gap-2 shrink-0">
            {/* Copy All UIDs button */}
            <button
              type="button"
              id="btn-copy-all-uids"
              onClick={handleCopyAllUids}
              className={`inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md ${
                copiedKey === 'copy-all-uids'
                  ? 'bg-emerald-600 text-white shadow-emerald-900/30 ring-2 ring-emerald-400'
                  : 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white'
              }`}
              title="Sao chép toàn bộ UID của các tài khoản nick đang lọc (mỗi UID trên 1 dòng)"
            >
              {copiedKey === 'copy-all-uids' ? (
                <>
                  <Check className="w-4 h-4 text-white stroke-[3]" />
                  <span>Đã Copy {scopedVias.length} UID!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-white" />
                  <span>📋 Copy Tất Cả UID ({scopedVias.length})</span>
                </>
              )}
            </button>

            {/* Select All / Deselect All Toggle button */}
            <button
              type="button"
              id="btn-toggle-select-all"
              onClick={handleSelectAll}
              className={`inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                isAllSelected
                  ? 'bg-indigo-200 text-indigo-950 border-indigo-400 shadow-2xs font-extrabold'
                  : selectedCount > 0
                  ? 'bg-indigo-500/30 text-indigo-200 border-indigo-400/50'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
              }`}
              title={isAllSelected ? 'Bỏ chọn tất cả nick' : 'Lựa chọn tất cả tài khoản nick đang hiển thị'}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{isAllSelected ? 'Bỏ Chọn Hết' : selectedCount > 0 ? `Chọn Hết (${scopedVias.length})` : 'Lựa Chọn Tất Cả'}</span>
            </button>

            {/* Bulk Import button for both Admin and Staff */}
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
              title="Dán 1 lúc nhiều nick UID|PASS|2FA từ Excel hoặc danh sách có tính năng check trùng UID"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>
                {currentUser.role === 'staff'
                  ? '+ Thêm Nhiều Nick (Dán Excel)'
                  : selectedStaffFilter !== 'all'
                  ? `+ Thêm Nhiều Nick Cho ${selectedStaffFilter}`
                  : '+ Thêm Nhiều Nick (Check Trùng)'}
              </span>
            </button>

            {/* Add single via button */}
            <button
              type="button"
              id="btn-add-single-via"
              onClick={handleOpenAddModal}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold text-indigo-900 bg-indigo-100 hover:bg-indigo-200 rounded-xl transition-all cursor-pointer"
              title="Thêm 1 nick Full Via mới"
            >
              <Plus className="w-4 h-4 text-indigo-700" />
              <span>+ Thêm 1 Nick</span>
            </button>

            {/* Fetch pages from via button */}
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
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold text-blue-900 bg-blue-100 hover:bg-blue-200 active:bg-blue-300 rounded-xl transition-all cursor-pointer shadow-2xs"
                title="Lấy Tên & Link Page từ Via và điền tự động vào Bảng Fanpage"
              >
                <Zap className="w-4 h-4 text-blue-700 fill-blue-700" />
                <span>⚡ Lấy Page Từ Via</span>
              </button>
            )}

            {/* Toggle all passwords */}
            <button
              type="button"
              onClick={() => setShowAllPasswords(!showAllPasswords)}
              className="inline-flex items-center space-x-1 px-3 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition-colors cursor-pointer"
              title={showAllPasswords ? 'Ẩn tất cả mật khẩu (tự tắt sau 30s)' : 'Hiện tất cả mật khẩu (tự tắt sau 30s)'}
            >
              {showAllPasswords ? <EyeOff className="w-3.5 h-3.5 text-amber-300" /> : <Eye className="w-3.5 h-3.5 text-slate-300" />}
              <span className="hidden sm:inline">{showAllPasswords ? 'Ẩn Pass' : 'Hiện Pass'}</span>
            </button>

            {/* Toggle all 2FA */}
            <button
              type="button"
              onClick={() => setShowAll2Fa(!showAll2Fa)}
              className="inline-flex items-center space-x-1 px-3 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition-colors cursor-pointer"
              title={showAll2Fa ? 'Ẩn tất cả mã 2FA' : 'Hiện tất cả mã 2FA'}
            >
              {showAll2Fa ? <EyeOff className="w-3.5 h-3.5 text-emerald-300" /> : <Eye className="w-3.5 h-3.5 text-slate-300" />}
              <span className="hidden sm:inline">{showAll2Fa ? 'Ẩn 2FA' : 'Hiện 2FA'}</span>
            </button>

            {/* Tải Mẫu Excel Nick Via */}
            <button
              type="button"
              id="btn-download-via-excel-template"
              onClick={() => downloadViaExcelTemplate('xlsx')}
              className="inline-flex items-center space-x-1 px-3 py-2 text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 rounded-xl border border-emerald-400/30 transition-colors cursor-pointer"
              title="Tải file Excel mẫu chuẩn (.xlsx) có sẵn UID, PASS, 2FA để import nhanh"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
              <span>Tải Mẫu Excel</span>
            </button>

            {/* Export CSV with PIN Verification */}
            <button
              type="button"
              onClick={handleRequestExportCSV}
              className="inline-flex items-center space-x-1 px-3 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition-colors cursor-pointer"
              title="Xuất bảng Full Via ra file CSV (Yêu cầu xác nhận mã PIN)"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Xuất CSV</span>
            </button>

            {/* Lock Button */}
            <button
              type="button"
              onClick={() => {
                setIsVaultUnlocked(false);
                setCopyToastMessage('🔒 Đã chủ động khóa Bảng Full Via!');
                setTimeout(() => setCopyToastMessage(null), 2500);
              }}
              className="inline-flex items-center space-x-1 px-3 py-2 text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-xl border border-rose-400/30 transition-colors cursor-pointer"
              title="Khóa ngay bảng Full Via để bảo vệ dữ liệu"
            >
              <Lock className="w-3.5 h-3.5 text-rose-300" />
              <span>Khóa</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar inside Header */}
        <div className="mt-4 pt-3 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center flex-wrap gap-2 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm UID, Mật khẩu, 2FA, Nhân viên hoặc Ghi chú..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-800/90 border border-slate-600 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Admin: Staff Filter Dropdown */}
            {currentUser.role === 'admin' && (
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-300 text-[11px] font-medium hidden sm:inline">Lọc nhanh:</span>
                <select
                  value={selectedStaffFilter}
                  onChange={(e) => {
                    setSelectedStaffFilter(e.target.value);
                    onSyncStaffFilter?.(e.target.value);
                  }}
                  className="px-2.5 py-1.5 bg-slate-800 border border-slate-600 text-white text-xs font-semibold rounded-lg focus:outline-hidden focus:border-indigo-400 cursor-pointer"
                >
                  <option value="all">🌟 Tất cả nhân viên ({viaList.length} nick)</option>
                  {distinctStaffNames.map((name) => {
                    const count = viaList.filter(
                      (v) => v.staffName.trim().toLowerCase() === name.trim().toLowerCase()
                    ).length;
                    return (
                      <option key={name} value={name}>
                        👤 {name} ({count} nick)
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
            {/* Quick Status Filter Tabs */}
            <div className="flex items-center space-x-1 bg-slate-800/90 p-1 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
                title="Xem tất cả nick"
              >
                Tất cả ({currentBaseVias.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  statusFilter === 'active'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-emerald-300 hover:text-white hover:bg-slate-700/50'
                }`}
                title="Lọc các nick đang hoạt động bình thường"
              >
                🟢 Live ({activeCountInScope})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('error')}
                className={`px-2 py-1 rounded text-[11px] font-black transition-all cursor-pointer flex items-center space-x-1 ${
                  statusFilter === 'error'
                    ? 'bg-red-600 text-white shadow-2xs ring-1 ring-red-300'
                    : errorCountInScope > 0
                    ? 'bg-red-950/70 text-red-300 border border-red-800/90 hover:bg-red-900/60'
                    : 'text-slate-400 hover:text-red-300 hover:bg-slate-700/50'
                }`}
                title="Lọc các Nick Via đang bị bôi đỏ (Via lỗi / Die)"
              >
                <span>🔴 Bôi Đỏ / Lỗi</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${
                    statusFilter === 'error' ? 'bg-white text-red-700' : 'bg-red-600 text-white'
                  }`}
                >
                  {errorCountInScope}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('fixed')}
                className={`px-2 py-1 rounded text-[11px] font-black transition-all cursor-pointer flex items-center space-x-1 ${
                  statusFilter === 'fixed'
                    ? 'bg-emerald-600 text-white shadow-2xs ring-1 ring-emerald-300'
                    : fixedCountInScope > 0
                    ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/90 hover:bg-emerald-900/60'
                    : 'text-slate-400 hover:text-emerald-300 hover:bg-slate-700/50'
                }`}
                title="Lọc các Nick Via đã được Admin sửa lỗi & thay mới (Được bôi xanh)"
              >
                <span>❇️ Bôi Xanh (Đã sửa)</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${
                    statusFilter === 'fixed' ? 'bg-white text-emerald-800' : 'bg-emerald-600 text-white'
                  }`}
                >
                  {fixedCountInScope}
                </span>
              </button>
              {checkpointCountInScope > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('checkpoint')}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    statusFilter === 'checkpoint'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-amber-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                  title="Lọc các nick đang bị checkpoint"
                >
                  🟠 CP ({checkpointCountInScope})
                </button>
              )}
              {/* Filter 🔴 Đã Có Page */}
              <button
                type="button"
                onClick={() => setStatusFilter('pending_page')}
                className={`px-2 py-1 rounded text-[11px] font-black transition-all cursor-pointer flex items-center space-x-1 ${
                  statusFilter === 'pending_page'
                    ? 'bg-rose-600 text-white shadow-2xs ring-1 ring-rose-300'
                    : pendingPageCountInScope > 0
                    ? 'bg-rose-950/70 text-rose-300 border border-rose-800/90 hover:bg-rose-900/60 animate-pulse'
                    : 'text-slate-400 hover:text-rose-300 hover:bg-slate-700/50'
                }`}
                title="Lọc các Nick đang ở trạng thái: Màu đỏ Đã Có Page"
              >
                <span>🔴 Đã Có Page</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${
                    statusFilter === 'pending_page' ? 'bg-white text-rose-700' : 'bg-rose-600 text-white'
                  }`}
                >
                  {pendingPageCountInScope}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('has_page')}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                  statusFilter === 'has_page'
                    ? 'bg-emerald-600 text-white shadow-2xs ring-1 ring-emerald-300'
                    : 'text-emerald-300 hover:text-white hover:bg-slate-700/50'
                }`}
                title="Lọc các nick Via ĐÃ ĐƯỢC GÁN PAGE (Được bôi xanh lá để nhân viên cập nhật)"
              >
                <span>📗 Đã có Page</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${
                    statusFilter === 'has_page' ? 'bg-white text-emerald-800' : 'bg-emerald-600 text-white'
                  }`}
                >
                  {hasPageCountInScope}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('no_page')}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
                  statusFilter === 'no_page'
                    ? 'bg-slate-600 text-white shadow-2xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
                title="Lọc các nick Via chưa có page (Màu trắng)"
              >
                <span>⚪ Chưa có page ({noPageCountInScope})</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-300 flex items-center flex-wrap gap-2">
            <span>Hiển thị: <strong>{scopedVias.length}</strong> / {viaList.length} nick</span>
            <span>•</span>
            <span className="text-slate-300 font-medium bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              ⚪ Trắng: Chưa có page
            </span>
            <span>•</span>
            <span className="text-rose-300 font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-700/50">
              🔴 Đỏ: Đã Có Page (Admin ấn vào)
            </span>
            <span>•</span>
            <span className="text-emerald-300 font-semibold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-700/50">
              🟢 Xanh lá: Đã có Page
            </span>
          </div>
        </div>
      </div>

      {/* 🌟 THANH TAB HIỂN THỊ THEO TỪNG NHÂN VIÊN DO ADMIN NHẬP VÀO */}
      {currentUser.role === 'admin' ? (
        <div className="bg-slate-100/95 border-b border-slate-300 px-4 pt-3 pb-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>Bảng Hiện Theo Từng Nhân Viên:</span>
              </span>
              <span className="text-[11px] text-slate-500 hidden md:inline">
                (Bấm vào tên nhân viên để lọc và quản lý nick do Admin nhập cho người đó)
              </span>
            </div>

            {/* View options: Group by staff toggle */}
            <div className="flex items-center space-x-2">
              {selectedStaffFilter === 'all' && (
                <button
                  type="button"
                  onClick={() => setIsGroupedByStaff(!isGroupedByStaff)}
                  className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    isGroupedByStaff
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                  title="Nhóm các dòng theo từng nhân viên có tiêu đề phân đoạn"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{isGroupedByStaff ? 'Đang phân nhóm theo NV' : 'Phân nhóm theo từng NV'}</span>
                </button>
              )}

              {activeStaffFilter && activeStaffFilter !== 'all' && activeStaffFilter !== selectedStaffFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStaffFilter(activeStaffFilter);
                    onSyncStaffFilter?.(activeStaffFilter);
                  }}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-semibold cursor-pointer"
                  title="Đồng bộ với nhân viên đang được lọc ở bảng Fanpage phía trên"
                >
                  <span>Đồng bộ: <strong>{activeStaffFilter}</strong></span>
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Tabs Bar */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-thin">
            {/* Tab: All Staff */}
            <button
              type="button"
              onClick={() => {
                setSelectedStaffFilter('all');
                onSyncStaffFilter?.('all');
              }}
              className={`inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                selectedStaffFilter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span>🌟 Tất Cả Nhân Viên</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  selectedStaffFilter === 'all'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 text-slate-800'
                }`}
              >
                {viaList.length} nick
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
                  className={`inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                    isSelected ? theme.activeTab : theme.inactiveTab
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : theme.dot}`} />
                  <span>👤 {name}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      isSelected
                        ? 'bg-black/25 text-white'
                        : 'bg-white text-slate-800 border border-slate-200'
                    }`}
                  >
                    {stats.total} nick
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Staff Banner: Dedicated to current logged-in staff */
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <span>🛡️ BẢNG FULL VIA ĐƯỢC ADMIN CẤP CHO BẠN:</span>
                  <span className="uppercase text-emerald-800 underline font-black">{currentUser.name}</span>
                </h3>
                <p className="text-[11px] text-emerald-700">
                  Bạn đang có <strong>{scopedVias.length}</strong> nick Via do Admin nhập và bàn giao. Toàn bộ mã 2FA và mật khẩu được bảo mật riêng biệt.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs rounded-full self-start sm:self-auto">
              {scopedVias.length} Nick Hoạt Động
            </span>
          </div>
        </div>
      )}

      {/* Sub Banner when Admin selects a specific staff member */}
      {currentUser.role === 'admin' && selectedStaffFilter !== 'all' && (
        <div className="bg-indigo-50/80 border-b border-indigo-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-slate-600">Đang xem bảng nick của Nhân Viên:</span>
            <span className="font-extrabold text-indigo-950 bg-indigo-100 border border-indigo-300 px-2.5 py-0.5 rounded-lg text-xs flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-indigo-700" />
              <span>{selectedStaffFilter}</span>
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-600">
              Tổng: <strong className="text-indigo-900">{scopedVias.length}</strong> nick do Admin nhập
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-emerald-700 font-semibold">
              {scopedVias.filter((v) => v.status !== 'checkpoint' && v.status !== 'dead').length} Hoạt động
            </span>
            {scopedVias.filter((v) => v.status === 'checkpoint').length > 0 && (
              <>
                <span className="text-slate-400">•</span>
                <span className="text-amber-700 font-semibold">
                  {scopedVias.filter((v) => v.status === 'checkpoint').length} Checkpoint
                </span>
              </>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => handleOpenAddModalForStaff(selectedStaffFilter)}
              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Thêm nick cho {selectedStaffFilter}</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenBulkImport(selectedStaffFilter)}
              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Nhập hàng loạt cho {selectedStaffFilter}</span>
            </button>
          </div>
        </div>
      )}

      {/* 🌟 THANH THAO TÁC KHI ĐÃ LỰA CHỌN TÀI KHOẢN NICK */}
      {selectedCount > 0 && (
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white px-4 py-2.5 border-y border-indigo-700 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-500/30 flex items-center justify-center border border-indigo-400/40 shrink-0">
              <CheckSquare className="w-3.5 h-3.5 text-indigo-300" />
            </div>
            <span className="font-bold text-white">
              Đã lựa chọn <span className="text-emerald-300 font-extrabold text-sm">{selectedCount}</span> / {scopedVias.length} tài khoản nick
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              id="btn-copy-selected-uids-banner"
              onClick={handleCopySelectedUids}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-md cursor-pointer transition-all active:scale-95"
              title="Sao chép toàn bộ UID của các tài khoản nick đã chọn (1 UID trên 1 dòng)"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>📋 Copy {selectedCount} UID Đã Chọn</span>
            </button>

            <button
              type="button"
              onClick={handleCopySelectedFullVia}
              className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold shadow-xs cursor-pointer transition-all"
              title="Sao chép chuỗi UID|PASS|2FA của các nick đã chọn"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Full Via</span>
            </button>

            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs text-indigo-200 hover:text-white underline underline-offset-2 px-2 py-1 cursor-pointer font-medium"
            >
              {isAllSelected ? 'Bỏ chọn tất cả' : `Lựa chọn tất cả (${scopedVias.length} nick)`}
            </button>

            <button
              type="button"
              onClick={handleDeselectAll}
              className="inline-flex items-center space-x-1 text-xs text-slate-300 hover:text-white px-2 py-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Hủy chọn</span>
            </button>
          </div>
        </div>
      )}

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
              <th className="py-2 px-2.5 min-w-[170px] max-w-[220px] border-r border-slate-200">GHI CHÚ CHUNG CẢ VIA</th>
              <th className="py-2 px-2 w-24 text-center">THAO TÁC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80 font-sans">
            {scopedVias.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
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
                      <td colSpan={9} className="py-2.5 px-4">
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
