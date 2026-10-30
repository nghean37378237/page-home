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
  Archive,
} from 'lucide-react';
import { FullViaItem, AppUser, PageRecord, GroupRecord, ViaPageUpdateStatus, ViaAdminReportStatus, VIA_ADMIN_REPORT_OPTIONS, ADMIN_WAITING_POOL, isAdminWaitingPool } from '../types';
import { generateTOTPCode } from '../utils/totp';
import { downloadViaExcelTemplate } from '../utils/excelTemplates';
import { batchDeleteCloudVias } from '../services/firebase';
import { parseFullVia, parseSupplementalViaInput, buildFullViaString } from '../utils/helpers';

function normalizeUidKey(raw?: string): string {
  if (!raw) return '';
  return String(raw).split('|')[0].trim().toLowerCase();
}

interface FullViaTableProps {
  viaList: FullViaItem[];
  allRecords: PageRecord[];
  allGroupRecords?: GroupRecord[];
  currentUser: AppUser;
  availableStaffNames: string[];
  activeStaffFilter?: string;
  adminPin?: string;
  currentUserPin?: string;
  onBackToFanpageTab?: () => void;
  onAddVia: (via: FullViaItem) => void;
  onUpdateVia: (via: FullViaItem) => void;
  onDeleteVia: (
    viaId: string,
    options?: { clearPageViaUid?: boolean; deleteLinkedPages?: boolean; deleteLinkedGroups?: boolean }
  ) => void | Promise<void>;
  onDeleteBatchVias?: (
    viaIds: string[],
    options?: { clearPageViaUid?: boolean; deleteLinkedPages?: boolean; deleteLinkedGroups?: boolean }
  ) => void | Promise<void>;
  onOpenBulkImport: (presetStaff?: string) => void;
  onFilterPageByVia?: (viaUid: string) => void;
  onAddPageForVia?: (viaUid: string, staffName: string) => void;
  onSyncStaffFilter?: (staffName: string) => void;
  onTransferViaPages?: (viaUid: string) => void;
  onFetchPagesForVia?: (viaUid: string, staffName: string) => void;
  onAcknowledgeNewTransfer?: (options?: { viaUid?: string; recordId?: string; staffName?: string }) => void;
}

export const FullViaTable: React.FC<FullViaTableProps> = ({
  viaList,
  allRecords,
  allGroupRecords = [],
  currentUser,
  availableStaffNames,
  activeStaffFilter,
  adminPin,
  currentUserPin,
  onBackToFanpageTab,
  onAddVia,
  onUpdateVia,
  onDeleteVia,
  onDeleteBatchVias,
  onOpenBulkImport,
  onFilterPageByVia,
  onAddPageForVia,
  onSyncStaffFilter,
  onTransferViaPages,
  onFetchPagesForVia,
  onAcknowledgeNewTransfer,
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
  const [statusFilter, setStatusFilter] = useState<
    | 'all'
    | 'active'
    | 'error'
    | 'checkpoint'
    | 'fixed'
    | 'pending_page'
    | 'has_page'
    | 'no_page'
    | 'all_group'
    | 'group_them_moi'
    | 'group_admin_them'
    | 'group_co_tu_dau'
    | 'group_can_them'
    | 'has_group'
    | 'group_chua_gan'
  >('all');
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

  // Multiple selection state for batch actions (Copy, Delete, Report)
  const [selectedViaIds, setSelectedViaIds] = useState<Set<string>>(new Set());
  const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
  const [pendingDeleteVia, setPendingDeleteVia] = useState<FullViaItem | null>(null);
  const [deletePageAction, setDeletePageAction] = useState<'keep' | 'unlink' | 'delete_pages'>('keep');
  const [deleteGroupAction, setDeleteGroupAction] = useState<'keep' | 'delete_groups'>('keep');
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  // Live TOTP generator state: stores { viaId: { code: string; remainingSeconds: number } }
  const [liveOtpMap, setLiveOtpMap] = useState<Record<string, { code: string; remainingSeconds: number; loading?: boolean }>>({});

  // Add / Edit Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingVia, setEditingVia] = useState<FullViaItem | null>(null);
  const [modalForm, setModalForm] = useState<{
    uid: string;
    pass: string;
    twoFa: string;
    email: string;
    emailPass: string;
    quickPaste: string;
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
    email: '',
    emailPass: '',
    quickPaste: '',
    staffName: availableStaffNames[0] || 'Anh Quỳnh',
    note: '',
    status: 'active',
    isError: false,
    isFixed: false,
    pageUpdateStatus: 'none',
    adminReportStatus: 'None',
  });

  // Calculate pages associated with each viaUid (case-insensitive & exact)
  const pagesPerViaUid = useMemo(() => {
    const map = new Map<string, PageRecord[]>();
    allRecords.forEach((r) => {
      const uid = r.viaUid?.trim();
      if (!uid) return;
      const lowerKey = uid.toLowerCase();
      if (!map.has(lowerKey)) {
        map.set(lowerKey, []);
      }
      map.get(lowerKey)!.push(r);
      if (uid !== lowerKey) {
        if (!map.has(uid)) {
          map.set(uid, []);
        }
        map.get(uid)!.push(r);
      }
    });
    return map;
  }, [allRecords]);

  // Calculate group records associated with each viaUid (case-insensitive)
  const groupsPerViaUid = useMemo(() => {
    const map = new Map<string, GroupRecord[]>();
    (allGroupRecords || []).forEach((g) => {
      const uid = normalizeUidKey(g.uid);
      if (!uid) return;
      if (!map.has(uid)) {
        map.set(uid, []);
      }
      map.get(uid)!.push(g);
    });
    return map;
  }, [allGroupRecords]);

  // Helper: Phân loại ghi chú Group của Nick Via
  const getViaGroupNoteFlags = (via: FullViaItem) => {
    const noteLower = `${via.note || ''} ${via.sharedNote || ''}`.toLowerCase();
    const isThemMoiGroup = noteLower.includes('thêm mới để thêm group');
    const isAdminThemGroup =
      noteLower.includes('admin đã thêm group') || noteLower.includes('admin thêm group');
    const isCoGroupTuDau =
      noteLower.includes('có group từ đầu') || noteLower.includes('đã có group');
    const isCanThemGroup =
      noteLower.includes('cần thêm group') || noteLower.includes('cần join group');
    const hasGroupNote =
      isThemMoiGroup ||
      isAdminThemGroup ||
      isCoGroupTuDau ||
      isCanThemGroup ||
      noteLower.includes('group') ||
      via.pageUpdateStatus === 'for_group';

    return {
      isThemMoiGroup,
      isAdminThemGroup,
      isCoGroupTuDau,
      isCanThemGroup,
      hasGroupNote,
    };
  };

  // List of all distinct staff names (excluding Admin Waiting Pool which gets its own prominent tab)
  const distinctStaffNames = useMemo(() => {
    if (currentUser.role === 'staff') {
      return [currentUser.name];
    }
    const list: string[] = [];
    const seen = new Set<string>();

    availableStaffNames.forEach((n) => {
      const trimmed = n.trim();
      if (trimmed && !isAdminWaitingPool(trimmed) && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        list.push(trimmed);
      }
    });

    strictlyGuardedVias.forEach((v) => {
      const trimmed = v.staffName?.trim();
      if (trimmed && !isAdminWaitingPool(trimmed) && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        list.push(trimmed);
      }
    });

    return list;
  }, [availableStaffNames, strictlyGuardedVias, currentUser]);

  // Statistics for Admin Waiting Pool (Kho Chờ Admin: bao gồm Via trống, Via + Page cầm & Via Group)
  const waitingPoolStats = useMemo(() => {
    let total = 0;
    let emptyVias = 0;
    let viasWithPages = 0;
    let totalPages = 0;
    let viasForGroup = 0;
    let totalGroups = 0;

    strictlyGuardedVias.forEach((v) => {
      if (isAdminWaitingPool(v.staffName) || !v.staffName?.trim()) {
        total++;
        const uidClean = v.uid?.trim().toLowerCase() || '';
        const pages = uidClean ? pagesPerViaUid.get(uidClean) || [] : [];
        const groups = uidClean ? groupsPerViaUid.get(normalizeUidKey(uidClean)) || [] : [];
        const gFlags = getViaGroupNoteFlags(v);

        if (pages.length > 0) {
          viasWithPages++;
          totalPages += pages.length;
        }
        if (gFlags.hasGroupNote || groups.length > 0) {
          viasForGroup++;
          totalGroups += groups.length;
        }
        if (pages.length === 0 && !gFlags.hasGroupNote && groups.length === 0) {
          emptyVias++;
        }
      }
    });

    return { total, emptyVias, viasWithPages, totalPages, viasForGroup, totalGroups };
  }, [strictlyGuardedVias, pagesPerViaUid, groupsPerViaUid]);

  // Statistics per staff for quick badges (including Page and Group stats)
  const staffStats = useMemo(() => {
    const stats: Record<
      string,
      {
        total: number;
        active: number;
        checkpoint: number;
        dead: number;
        viasWithPages: number;
        totalPages: number;
        viasForGroup: number;
        totalGroups: number;
        pendingNew: number;
      }
    > = {};
    distinctStaffNames.forEach((name) => {
      stats[name] = {
        total: 0,
        active: 0,
        checkpoint: 0,
        dead: 0,
        viasWithPages: 0,
        totalPages: 0,
        viasForGroup: 0,
        totalGroups: 0,
        pendingNew: 0,
      };
    });

    strictlyGuardedVias.forEach((v) => {
      const rawName = v.staffName?.trim() || '';
      const name = isAdminWaitingPool(rawName) || !rawName ? ADMIN_WAITING_POOL : rawName;
      if (!stats[name]) {
        stats[name] = {
          total: 0,
          active: 0,
          checkpoint: 0,
          dead: 0,
          viasWithPages: 0,
          totalPages: 0,
          viasForGroup: 0,
          totalGroups: 0,
          pendingNew: 0,
        };
      }
      stats[name].total++;
      if (v.status === 'checkpoint') stats[name].checkpoint++;
      else if (v.status === 'dead') stats[name].dead++;
      else stats[name].active++;

      const uidClean = v.uid?.trim().toLowerCase() || '';
      const pages = uidClean ? pagesPerViaUid.get(uidClean) || [] : [];
      const groups = uidClean ? groupsPerViaUid.get(normalizeUidKey(uidClean)) || [] : [];
      const gFlags = getViaGroupNoteFlags(v);

      if (pages.length > 0) {
        stats[name].viasWithPages++;
        stats[name].totalPages += pages.length;
      }
      if (gFlags.hasGroupNote || groups.length > 0) {
        stats[name].viasForGroup++;
        stats[name].totalGroups += groups.length;
      }
      const isPending = Boolean(
        v.isNewlyTransferred ||
          v.pageUpdateStatus === 'pending' ||
          (v.hasAdminAssignedPage && v.pageUpdateStatus !== 'updated') ||
          pages.some((p) => p.isNewlyTransferred)
      );
      if (isPending && !isAdminWaitingPool(name)) {
        stats[name].pendingNew++;
      }
    });

    return stats;
  }, [distinctStaffNames, strictlyGuardedVias, pagesPerViaUid, groupsPerViaUid]);

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
    return (
      Boolean(v.isError) ||
      v.status === 'error' ||
      v.status === 'dead' ||
      v.adminReportStatus === 'VHH'
    );
  };

  // Helper: Admin đã chuyển Via / thêm Page mới cho nhân viên (Màu Đỏ để báo nhân viên có Via & Page mới)
  const isViaPendingPageUpdate = (via: FullViaItem): boolean => {
    if (isAdminWaitingPool(via.staffName)) return false;
    const uidLower = via.uid?.trim().toLowerCase() || '';
    const heldPages = uidLower ? pagesPerViaUid.get(uidLower) || [] : [];
    return Boolean(
      via.isNewlyTransferred ||
      via.pageUpdateStatus === 'pending' ||
      (via.hasAdminAssignedPage && via.pageUpdateStatus !== 'updated') ||
      heldPages.some((p) => p.isNewlyTransferred)
    );
  };

  // Helper: Nick đã có Page và đã được cập nhật (Màu Xanh lá như đang hiển thị)
  const isViaPageUpdated = (via: FullViaItem, pagesCount: number): boolean => {
    if (isViaPendingPageUpdate(via)) return false;
    return Boolean(via.pageUpdateStatus === 'updated' || pagesCount > 0);
  };

  // Quick action: Cập nhật trạng thái Page của Via (Admin tự cập nhật màu đỏ hoặc nhân viên bấm Đã nhận chuyển sang màu xanh)
  const handleSetViaPageStatus = (via: FullViaItem, newStatus: ViaPageUpdateStatus) => {
    const isPending = newStatus === 'pending';
    const isUpdated = newStatus === 'updated';
    const updated: FullViaItem = {
      ...via,
      pageUpdateStatus: newStatus,
      isNewlyTransferred: isPending,
      hasAdminAssignedPage: isPending || isUpdated ? true : false,
      ...(isPending ? { pageAssignedAt: new Date().toLocaleDateString('vi-VN') } : {}),
      ...(isUpdated ? { pageUpdatedAt: new Date().toLocaleDateString('vi-VN') } : {}),
    };
    onUpdateVia(updated);
    if (!isPending && onAcknowledgeNewTransfer && via.uid) {
      onAcknowledgeNewTransfer({ viaUid: via.uid });
    }
    if (isPending) {
      setCopyToastMessage(`🔴 Đã đánh dấu đỏ nick ${via.uid}: Báo nhân viên có Via & Page mới!`);
    } else if (isUpdated) {
      setCopyToastMessage(`🟢 Đã xác nhận nhận Via ${via.uid} & Page (Chuyển sang màu xanh)!`);
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
      if (isAdminWaitingPool(selectedStaffFilter)) {
        return strictlyGuardedVias.filter((v) => isAdminWaitingPool(v.staffName) || !v.staffName?.trim());
      }
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

  // Đếm nick Đã có Page (Màu xanh) và tổng số lượng Fanpage đang cầm trong phạm vi
  const { hasPageCountInScope, totalPagesInScope, multiPageViasCountInScope } = useMemo(() => {
    let hasPageCount = 0;
    let totalPages = 0;
    let multiPageVias = 0;
    currentBaseVias.forEach((v) => {
      const uid = v.uid?.trim().toLowerCase();
      const pages = uid ? pagesPerViaUid.get(uid) || [] : [];
      if (isViaPageUpdated(v, pages.length) || pages.length > 0) {
        hasPageCount++;
      }
      totalPages += pages.length;
      if (pages.length >= 2) {
        multiPageVias++;
      }
    });
    return {
      hasPageCountInScope: hasPageCount,
      totalPagesInScope: totalPages,
      multiPageViasCountInScope: multiPageVias,
    };
  }, [currentBaseVias, pagesPerViaUid]);

  // 🟣 THỐNG KÊ MỤC GROUP CHO VIA TRONG PHẠM VI HIỆN TẠI (Thêm mới để thêm Group, Admin đã thêm Group, Có Group từ đầu, Cần thêm Group, Đang cầm Group)
  const groupViaStatsInScope = useMemo(() => {
    let totalGroupVias = 0;
    let themMoiGroup = 0;
    let adminThemGroup = 0;
    let coGroupTuDau = 0;
    let canThemGroup = 0;
    let hasGroupInTable2 = 0;
    let totalGroupsInTable2 = 0;
    let chuaGanGroup = 0;

    currentBaseVias.forEach((v) => {
      const uidKey = normalizeUidKey(v.uid);
      const assignedGroups = uidKey ? groupsPerViaUid.get(uidKey) || [] : [];
      const flags = getViaGroupNoteFlags(v);

      if (flags.isThemMoiGroup) themMoiGroup++;
      if (flags.isAdminThemGroup) adminThemGroup++;
      if (flags.isCoGroupTuDau) coGroupTuDau++;
      if (flags.isCanThemGroup) canThemGroup++;

      if (assignedGroups.length > 0) {
        hasGroupInTable2++;
        totalGroupsInTable2 += assignedGroups.length;
      }

      if (flags.hasGroupNote || assignedGroups.length > 0) {
        totalGroupVias++;
      }

      if (flags.hasGroupNote && assignedGroups.length === 0) {
        chuaGanGroup++;
      }
    });

    return {
      totalGroupVias,
      themMoiGroup,
      adminThemGroup,
      coGroupTuDau,
      canThemGroup,
      hasGroupInTable2,
      totalGroupsInTable2,
      chuaGanGroup,
    };
  }, [currentBaseVias, groupsPerViaUid]);

  // Đếm nick Chưa có Page (Trắng/Trống)
  const noPageCountInScope = useMemo(() => {
    return currentBaseVias.filter((v) => {
      const uid = v.uid?.trim().toLowerCase();
      const pages = uid ? pagesPerViaUid.get(uid) || [] : [];
      return !isViaPendingPageUpdate(v) && !isViaPageUpdated(v, pages.length) && pages.length === 0;
    }).length;
  }, [currentBaseVias, pagesPerViaUid]);

  // Counts for Báo Admin: Live, VHH, 282, 956, Hạn Chế, SDT, Selfie, Email code
  const adminReportCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: currentBaseVias.length,
      Live: 0,
      VHH: 0,
      '282': 0,
      '956': 0,
      'Hạn Chế': 0,
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
        if (isAdminWaitingPool(selectedStaffFilter)) {
          list = list.filter((v) => isAdminWaitingPool(v.staffName) || !v.staffName?.trim());
        } else {
          list = list.filter(
            (v) => v.staffName.trim().toLowerCase() === selectedStaffFilter.trim().toLowerCase()
          );
        }
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
    } else if (statusFilter === 'all_group') {
      list = list.filter((v) => {
        const uidKey = normalizeUidKey(v.uid);
        const groups = uidKey ? groupsPerViaUid.get(uidKey) || [] : [];
        return getViaGroupNoteFlags(v).hasGroupNote || groups.length > 0;
      });
    } else if (statusFilter === 'group_them_moi') {
      list = list.filter((v) => getViaGroupNoteFlags(v).isThemMoiGroup);
    } else if (statusFilter === 'group_admin_them') {
      list = list.filter((v) => getViaGroupNoteFlags(v).isAdminThemGroup);
    } else if (statusFilter === 'group_co_tu_dau') {
      list = list.filter((v) => getViaGroupNoteFlags(v).isCoGroupTuDau);
    } else if (statusFilter === 'group_can_them') {
      list = list.filter((v) => getViaGroupNoteFlags(v).isCanThemGroup);
    } else if (statusFilter === 'has_group') {
      list = list.filter((v) => {
        const uidKey = normalizeUidKey(v.uid);
        return Boolean(uidKey && (groupsPerViaUid.get(uidKey) || []).length > 0);
      });
    } else if (statusFilter === 'group_chua_gan') {
      list = list.filter((v) => {
        const uidKey = normalizeUidKey(v.uid);
        const groups = uidKey ? groupsPerViaUid.get(uidKey) || [] : [];
        return getViaGroupNoteFlags(v).hasGroupNote && groups.length === 0;
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
      const rawLines = searchQuery
        .split(/\r?\n|,|;/)
        .map((line) => line.trim())
        .filter(Boolean);

      // Extract clean UID or search token per line (supports pasting UID|Pass|2FA per line too)
      const searchTokens = rawLines
        .map((line) => {
          const firstPart = line.split(/[|\t]/)[0]?.trim().toLowerCase() || '';
          return {
            fullLine: line.toLowerCase(),
            uidToken: firstPart,
          };
        })
        .filter((t) => Boolean(t.fullLine));

      if (searchTokens.length > 0) {
        list = list.filter((v) => {
          const vUid = v.uid.trim().toLowerCase();
          const vPass = v.pass.toLowerCase();
          const vTwoFa = v.twoFa.toLowerCase();
          const vEmail = (v.email || '').toLowerCase();
          const vRaw = (v.rawFullVia || '').toLowerCase();
          const vStaff = v.staffName.toLowerCase();
          const vRep = (v.adminReportStatus || '').toLowerCase();
          const vNote = (v.note || '').toLowerCase();

          return searchTokens.some(({ fullLine, uidToken }) => {
            if (uidToken && vUid.includes(uidToken)) return true;
            return (
              vUid.includes(fullLine) ||
              vPass.includes(fullLine) ||
              vTwoFa.includes(fullLine) ||
              vEmail.includes(fullLine) ||
              vRaw.includes(fullLine) ||
              vStaff.includes(fullLine) ||
              vRep.includes(fullLine) ||
              vNote.includes(fullLine)
            );
          });
        });
      }
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

  const getSelectedViasForDelete = () => {
    const inScope = scopedVias.filter((v) => selectedViaIds.has(v.id));
    if (inScope.length > 0) return inScope;
    return viaList.filter((v) => selectedViaIds.has(v.id));
  };

  const handlePromptBulkDelete = () => {
    const selectedToDelete = getSelectedViasForDelete();
    if (selectedToDelete.length === 0) {
      setCopyToastMessage('⚠️ Bạn chưa chọn nick nào. Vui lòng tick chọn các ô checkbox của nick cần xóa (hoặc bấm "Chọn tất cả") rồi thử lại!');
      setTimeout(() => setCopyToastMessage(null), 3500);
      return;
    }
    setPendingDeleteVia(null);
    setDeletePageAction('keep');
    setDeleteGroupAction('keep');
    setIsConfirmDeleteModalOpen(true);
  };

  const handlePromptSingleDelete = (via: FullViaItem) => {
    setPendingDeleteVia(via);
    setDeletePageAction('keep');
    setDeleteGroupAction('keep');
    setIsConfirmDeleteModalOpen(true);
  };

  const handleConfirmBulkDelete = async () => {
    const targetVias = pendingDeleteVia ? [pendingDeleteVia] : getSelectedViasForDelete();
    const idsToDelete = targetVias.map((v) => v.id);
    if (idsToDelete.length === 0) {
      setIsConfirmDeleteModalOpen(false);
      setPendingDeleteVia(null);
      return;
    }

    const deleteOptions = {
      clearPageViaUid: deletePageAction === 'unlink',
      deleteLinkedPages: deletePageAction === 'delete_pages',
      deleteLinkedGroups: deleteGroupAction === 'delete_groups',
    };

    const extraSummaryParts: string[] = [];
    if (deleteOptions.deleteLinkedPages) extraSummaryParts.push('xóa luôn Fanpage liên quan');
    else if (deleteOptions.clearPageViaUid) extraSummaryParts.push('gỡ UID khỏi Fanpage');
    if (deleteOptions.deleteLinkedGroups) extraSummaryParts.push('xóa luôn Group liên quan');
    const extraSummary = extraSummaryParts.length > 0 ? ` (Đã ${extraSummaryParts.join(' & ')})` : '';

    setIsDeletingBatch(true);
    try {
      if (pendingDeleteVia && idsToDelete.length === 1) {
        await onDeleteVia(pendingDeleteVia.id, deleteOptions);
      } else if (onDeleteBatchVias) {
        await onDeleteBatchVias(idsToDelete, deleteOptions);
      } else {
        await batchDeleteCloudVias(idsToDelete);
      }
      setSelectedViaIds((prev) => {
        const next = new Set(prev);
        idsToDelete.forEach((id) => next.delete(id));
        return next;
      });
      setIsConfirmDeleteModalOpen(false);
      setPendingDeleteVia(null);
      setCopyToastMessage(
        `🗑️ Đã xóa vĩnh viễn ${idsToDelete.length} nick Via (${targetVias.map((v) => v.uid).join(', ')})${extraSummary} khỏi hệ thống!`
      );
      setTimeout(() => setCopyToastMessage(null), 4000);
    } catch (err: any) {
      console.error('Lỗi khi xóa via:', err);
      for (const id of idsToDelete) {
        try {
          await onDeleteVia(id, deleteOptions);
        } catch (e) {
          console.error(e);
        }
      }
      setSelectedViaIds((prev) => {
        const next = new Set(prev);
        idsToDelete.forEach((id) => next.delete(id));
        return next;
      });
      setIsConfirmDeleteModalOpen(false);
      setPendingDeleteVia(null);
      setCopyToastMessage(`🗑️ Đã xóa ${idsToDelete.length} nick Via${extraSummary} khỏi hệ thống!`);
      setTimeout(() => setCopyToastMessage(null), 3500);
    } finally {
      setIsDeletingBatch(false);
    }
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

  // Batch transfer all selected Vias + all their held Pages to another staff member
  const handleBatchTransferViasToStaff = (newStaffName: string) => {
    const cleanStaff = newStaffName.trim();
    if (!cleanStaff) return;
    const selectedVias = scopedVias.filter((v) => selectedViaIds.has(v.id));
    if (selectedVias.length === 0) return;

    let totalTransferredPages = 0;
    const movingToPool = isAdminWaitingPool(cleanStaff);
    selectedVias.forEach((v) => {
      const uidLower = v.uid?.trim().toLowerCase() || '';
      const heldPages = uidLower ? pagesPerViaUid.get(uidLower) || [] : [];
      totalTransferredPages += heldPages.length;
      onUpdateVia({
        ...v,
        staffName: cleanStaff,
        ...(movingToPool
          ? {
              isNewlyTransferred: false,
              pageUpdateStatus: heldPages.length > 0 ? 'updated' : 'none',
            }
          : {
              isNewlyTransferred: true,
              pageUpdateStatus: 'pending',
              hasAdminAssignedPage: true,
              pageAssignedAt: new Date().toLocaleDateString('vi-VN'),
            }),
      });
    });

    setSelectedViaIds(new Set());
    setCopyToastMessage(
      movingToPool
        ? `📦 Đã cất ${selectedVias.length} Via kèm ${totalTransferredPages} Page vào Kho Chờ Admin!`
        : `🔴 Đã chuyển ${selectedVias.length} Via kèm toàn bộ ${totalTransferredPages} Page sang cho NV: ${cleanStaff} (Đã đánh dấu đỏ báo Via & Page mới)!`
    );
    setTimeout(() => setCopyToastMessage(null), 3500);
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
      email: '',
      emailPass: '',
      quickPaste: '',
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
      email: '',
      emailPass: '',
      quickPaste: '',
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

    const parsedRaw = parseFullVia(via.rawFullVia);

    setModalForm({
      uid: via.uid,
      pass: via.pass || parsedRaw?.pass || '',
      twoFa: via.twoFa || parsedRaw?.twoFa || '',
      email: via.email || parsedRaw?.email || '',
      emailPass: via.emailPass || parsedRaw?.emailPass || '',
      quickPaste: '',
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
    const targetExistingVia = editingVia || duplicateViaInModal;
    const trimmedUid = modalForm.uid.trim();
    if (!trimmedUid) {
      setCopyToastMessage('⚠️ Vui lòng nhập UID Facebook!');
      setTimeout(() => setCopyToastMessage(null), 2500);
      return;
    }

    const parsedExistingRaw = parseFullVia(targetExistingVia?.rawFullVia);
    const trimmedPass = modalForm.pass.trim() || targetExistingVia?.pass || parsedExistingRaw?.pass || '';
    const trimmed2Fa = modalForm.twoFa.trim() || targetExistingVia?.twoFa || parsedExistingRaw?.twoFa || '';
    const trimmedEmail = modalForm.email.trim() || targetExistingVia?.email || parsedExistingRaw?.email || '';
    const trimmedEmailPass = modalForm.emailPass.trim() || targetExistingVia?.emailPass || parsedExistingRaw?.emailPass || '';

    if (!trimmedPass && !trimmed2Fa && !trimmedEmail && !targetExistingVia) {
      setCopyToastMessage('⚠️ Vui lòng nhập ít nhất Mật khẩu (Pass), 2FA hoặc Mail cho Via!');
      setTimeout(() => setCopyToastMessage(null), 2500);
      return;
    }

    const rawFull = buildFullViaString(
      trimmedUid,
      trimmedPass,
      trimmed2Fa,
      trimmedEmail,
      trimmedEmailPass
    );
    const isErr = modalForm.status === 'error' || modalForm.status === 'dead' || Boolean(modalForm.isError);
    const isFix = modalForm.status === 'fixed' || Boolean(modalForm.isFixed);
    const finalStatus = isFix ? 'fixed' : isErr ? (modalForm.status === 'dead' ? 'dead' : 'error') : modalForm.status;

    const isPending = modalForm.pageUpdateStatus === 'pending';
    const isUpdated = modalForm.pageUpdateStatus === 'updated';

    if (targetExistingVia) {
      onUpdateVia({
        ...targetExistingVia,
        uid: trimmedUid,
        pass: trimmedPass,
        twoFa: trimmed2Fa,
        ...(trimmedEmail ? { email: trimmedEmail } : { email: '' }),
        ...(trimmedEmailPass ? { emailPass: trimmedEmailPass } : { emailPass: '' }),
        staffName: modalForm.staffName || targetExistingVia.staffName,
        note: modalForm.note.trim() || targetExistingVia.note || '',
        status: finalStatus,
        isError: isFix ? false : isErr,
        isFixed: isFix,
        rawFullVia: rawFull,
        pageUpdateStatus: modalForm.pageUpdateStatus,
        adminReportStatus: modalForm.adminReportStatus || targetExistingVia.adminReportStatus || 'None',
        hasAdminAssignedPage: isPending || isUpdated ? true : Boolean(targetExistingVia.hasAdminAssignedPage),
        ...(isPending ? { pageAssignedAt: targetExistingVia.pageAssignedAt || new Date().toLocaleDateString('vi-VN') } : {}),
        ...(isUpdated ? { pageUpdatedAt: new Date().toLocaleDateString('vi-VN') } : {}),
      });
      setCopyToastMessage(`✅ Đã cập nhật / bổ sung thông tin (2FA | Mail | Pass) cho Via UID ${trimmedUid}!`);
      setTimeout(() => setCopyToastMessage(null), 3000);
    } else {
      const newItem: FullViaItem = {
        id: `via-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        uid: trimmedUid,
        pass: trimmedPass,
        twoFa: trimmed2Fa,
        ...(trimmedEmail ? { email: trimmedEmail } : {}),
        ...(trimmedEmailPass ? { emailPass: trimmedEmailPass } : {}),
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
      setCopyToastMessage(`✅ Đã thêm nick Full Via mới UID ${trimmedUid}!`);
      setTimeout(() => setCopyToastMessage(null), 3000);
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
    const assignedGroups = (uidClean && groupsPerViaUid.get(normalizeUidKey(uidClean))) || [];
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
              {assignedPages.length > 0 && (
                <button
                  type="button"
                  onClick={() => onFilterPageByVia && onFilterPageByVia(via.uid)}
                  className={`font-extrabold text-[9.5px] px-1.5 py-0.2 rounded shadow-2xs shrink-0 cursor-pointer transition-colors ${
                    assignedPages.length >= 2
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-1 ring-emerald-400'
                      : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300'
                  }`}
                  title={`Nick Via này đang cầm ${assignedPages.length} Fanpage: ${assignedPages.map((p) => p.pageName).join(', ')}. Bấm để xem chi tiết bên Quản Lý Page.`}
                >
                  📗 {assignedPages.length} Page
                </button>
              )}
              {assignedGroups.length > 0 && (
                <span
                  className="font-extrabold text-[9.5px] px-1.5 py-0.2 rounded shadow-2xs shrink-0 bg-purple-100 text-purple-900 border border-purple-300"
                  title={`Nick Via này đang gắn với ${assignedGroups.length} dòng Group trong Bảng Group (${assignedGroups.map((g) => g.viaName || `${g.groupCount} nhóm`).join(', ')})`}
                >
                  🟣 {assignedGroups.length} Group
                </span>
              )}
              {via.adminReportStatus === 'VHH' ? (
                <span
                  className="bg-rose-600 text-white font-extrabold text-[9px] px-1.5 py-0.2 rounded shadow-2xs shrink-0"
                  title="Nick bị Vô Hiệu Hóa (VHH) - Đồng bộ từ Quản Lý Page & Bảng Group"
                >
                  🔴 VHH
                </span>
              ) : via.adminReportStatus === '282' ? (
                <span
                  className="bg-amber-500 text-white font-extrabold text-[9px] px-1.5 py-0.2 rounded shadow-2xs shrink-0"
                  title="Nick bị Checkpoint 282 - Đồng bộ từ Quản Lý Page & Bảng Group"
                >
                  🟠 282
                </span>
              ) : via.adminReportStatus === '956' ? (
                <span
                  className="bg-purple-600 text-white font-extrabold text-[9px] px-1.5 py-0.2 rounded shadow-2xs shrink-0"
                  title="Nick bị Khóa Tím 956 - Đồng bộ từ Quản Lý Page & Bảng Group"
                >
                  🟣 956
                </span>
              ) : via.adminReportStatus === 'Hạn Chế' ? (
                <span
                  className="bg-yellow-500 text-slate-950 font-extrabold text-[9px] px-1.5 py-0.2 rounded shadow-2xs shrink-0"
                  title="Nick bị Hạn Chế / Spam - Đồng bộ từ Quản Lý Page & Bảng Group"
                >
                  🟡 HẠN CHẾ
                </span>
              ) : (
                isRowError && (
                  <span className="bg-red-600 text-white font-extrabold text-[9px] px-1 py-0.2 rounded shadow-2xs shrink-0">
                    LỖI
                  </span>
                )
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
                  className="bg-rose-600 text-white font-black text-[9px] px-1.5 py-0.2 rounded shadow-2xs shrink-0 flex items-center space-x-0.5 animate-pulse"
                  title="Via & Page mới được chuyển giao cho nhân viên!"
                >
                  <span>🔴 VIA & PAGE MỚI</span>
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
          {via.pass?.trim() ? (
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
          ) : (
            <button
              type="button"
              onClick={() => handleOpenEditModal(via)}
              className="w-full py-1 px-2 rounded border border-dashed border-amber-300 bg-amber-50/70 hover:bg-amber-100 text-amber-800 font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-colors"
              title="Nick đã có UID nhưng chưa có Pass — Bấm để bổ sung 2FA | Mail | Pass"
            >
              <Plus className="w-3 h-3 text-amber-600" />
              <span>Bổ sung Pass/Mail</span>
            </button>
          )}
        </td>

        {/* 4. CỘT MÃ 2FA & MAIL BỔ SUNG */}
        <td className={`py-2 px-2.5 border-r ${isRowError ? 'border-red-200' : 'border-slate-200'}`}>
          <div className="flex flex-col space-y-1">
            {via.twoFa?.trim() ? (
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
                  <button
                    type="button"
                    onClick={() => toggleRow2Fa(via.id)}
                    className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer shrink-0"
                    title={is2FaVisible ? 'Ẩn mã 2FA' : 'Hiện mã 2FA'}
                  >
                    {is2FaVisible ? <EyeOff className="w-3 h-3 text-emerald-600" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>

                <div className="flex items-center space-x-0.5 shrink-0">
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

                  <button
                    type="button"
                    onClick={() => handleGetLiveOtp(via)}
                    className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100 transition-colors cursor-pointer"
                    title="Tính ngay mã 6 số đăng nhập (OTP Live)"
                  >
                    <Sparkles className="w-2.5 h-2.5 text-purple-700" />
                    <span>OTP</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleOpenEditModal(via)}
                className="w-full py-1 px-2 rounded border border-dashed border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-colors"
                title="Bấm để bổ sung 2FA | Mail | Pass cho UID này"
              >
                <Plus className="w-3 h-3 text-emerald-600" />
                <span>+ Bổ sung 2FA | Mail | Pass</span>
              </button>
            )}

            {/* Hiển thị Mail & Pass Mail bổ sung nếu có */}
            {(() => {
              const pRaw = parseFullVia(via.rawFullVia);
              const mailVal = via.email || pRaw?.email || '';
              const mailPassVal = via.emailPass || pRaw?.emailPass || '';
              if (!mailVal && !mailPassVal) return null;
              return (
                <div className="flex items-center justify-between gap-1 px-1.5 py-0.5 bg-sky-50 border border-sky-200 rounded text-[10px]">
                  <span className="font-mono text-sky-900 truncate font-semibold" title={`Mail: ${mailVal}${mailPassVal ? ` | PassMail: ${mailPassVal}` : ''}`}>
                    ✉️ {mailVal || 'Có PassMail'}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {mailVal && (
                      <button
                        type="button"
                        onClick={() => handleCopyText(mailVal, `mail-${via.id}`, 'Email Via')}
                        className="px-1 py-0.2 bg-white hover:bg-sky-100 text-sky-800 border border-sky-300 rounded font-bold text-[9px] cursor-pointer"
                        title={`Copy Mail: ${mailVal}`}
                      >
                        {copiedKey === `mail-${via.id}` ? '✓ Mail' : 'Mail'}
                      </button>
                    )}
                    {mailPassVal && (
                      <button
                        type="button"
                        onClick={() => handleCopyText(mailPassVal, `mailpass-${via.id}`, 'Pass Mail')}
                        className="px-1 py-0.2 bg-white hover:bg-sky-100 text-sky-800 border border-sky-300 rounded font-bold text-[9px] cursor-pointer"
                        title="Copy Pass Mail"
                      >
                        {copiedKey === `mailpass-${via.id}` ? '✓ PassM' : 'PassM'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

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

        {/* 5. CỘT NHÂN VIÊN / KHO CHỜ ADMIN (CHUYỂN VIA + TOÀN BỘ PAGE CẦM) */}
        <td className={`py-2 px-2 border-r ${isRowError ? 'border-red-200' : 'border-slate-200'}`}>
          <div className="flex flex-col space-y-1">
            {currentUser.role === 'admin' ? (
              <select
                value={
                  isAdminWaitingPool(via.staffName) || !via.staffName?.trim()
                    ? ADMIN_WAITING_POOL
                    : via.staffName
                }
                onChange={(e) => {
                  const newStaff = e.target.value;
                  if (!newStaff) return;
                  const movingToPool = isAdminWaitingPool(newStaff);
                  onUpdateVia({
                    ...via,
                    staffName: newStaff,
                    ...(movingToPool
                      ? {
                          isNewlyTransferred: false,
                          pageUpdateStatus: assignedPages.length > 0 ? 'updated' : 'none',
                        }
                      : {
                          isNewlyTransferred: true,
                          pageUpdateStatus: 'pending',
                          hasAdminAssignedPage: true,
                          pageAssignedAt: new Date().toLocaleDateString('vi-VN'),
                        }),
                  });
                  setCopyToastMessage(
                    movingToPool
                      ? assignedPages.length > 0
                        ? `📦 Đã chuyển Via ${via.uid} + ${assignedPages.length} Page vào Kho Chờ Admin (Chưa NV nào dùng)!`
                        : `📦 Đã chuyển Via ${via.uid} vào Kho Chờ Admin (Chưa NV nào dùng)!`
                      : assignedPages.length > 0
                      ? `🔴 Đã giao Via ${via.uid} + toàn bộ ${assignedPages.length} Page sang cho NV: ${newStaff} (Đã đánh dấu đỏ báo Via & Page mới)!`
                      : `🔴 Đã giao nick Via ${via.uid} sang cho NV: ${newStaff} (Đã đánh dấu đỏ báo Via mới)!`
                  );
                  setTimeout(() => setCopyToastMessage(null), 3200);
                }}
                className={`border text-xs font-bold rounded px-1.5 py-1 shadow-2xs focus:ring-1 focus:outline-hidden cursor-pointer w-full ${
                  isAdminWaitingPool(via.staffName) || !via.staffName?.trim()
                    ? 'bg-amber-50 border-amber-400 text-amber-950 focus:ring-amber-500'
                    : 'bg-white border-slate-300 hover:border-indigo-400 text-slate-800 focus:ring-indigo-500'
                }`}
                title={`Đổi nơi quản lý (Tự động chuyển cả Via ${via.uid} + toàn bộ ${assignedPages.length} Page vào Kho Chờ Admin hoặc sang Nhân viên mới)`}
              >
                <option value={ADMIN_WAITING_POOL}>
                  📦 {ADMIN_WAITING_POOL} (Chưa NV dùng)
                </option>
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

            <div className="flex items-center justify-between gap-1 flex-wrap">
              <div className="flex items-center gap-1 flex-wrap">
                {assignedPages.length > 0 ? (
                  <span
                    className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded truncate"
                    title={`Via đang cầm ${assignedPages.length} Fanpage`}
                  >
                    📗 Cầm {assignedPages.length} Page
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 italic">⚪ 0 Page</span>
                )}
                {assignedGroups.length > 0 ? (
                  <span
                    className="text-[10px] font-extrabold text-purple-900 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded truncate"
                    title={`Via đang cầm ${assignedGroups.length} dòng Group ở Bảng 2`}
                  >
                    🟣 Cầm {assignedGroups.length} Group
                  </span>
                ) : getViaGroupNoteFlags(via).hasGroupNote ? (
                  <span
                    className="text-[10px] font-bold text-purple-800 bg-purple-50/80 border border-purple-200 px-1.5 py-0.2 rounded truncate"
                    title="Via thuộc mục Thêm mới để thêm Group"
                  >
                    🟣 Via Group
                  </span>
                ) : null}
              </div>

              <div className="flex items-center space-x-1">
                {currentUser.role === 'admin' &&
                  !isAdminWaitingPool(via.staffName) &&
                  Boolean(via.staffName?.trim()) && (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateVia({
                          ...via,
                          staffName: ADMIN_WAITING_POOL,
                          ...(assignedPages.length > 0
                            ? { pageUpdateStatus: 'updated', hasAdminAssignedPage: true }
                            : {}),
                        });
                        setCopyToastMessage(
                          `📦 Đã đưa Via ${via.uid}${
                            assignedPages.length > 0 ? ` + ${assignedPages.length} Page` : ''
                          } vào Kho Chờ Admin!`
                        );
                        setTimeout(() => setCopyToastMessage(null), 3000);
                      }}
                      className="inline-flex items-center space-x-0.5 px-1.5 py-0.2 text-[9.5px] font-bold text-amber-900 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded cursor-pointer shrink-0 transition-colors"
                      title={`Cất nhanh Via "${via.uid}" kèm ${assignedPages.length} Page vào Kho Chờ Admin (Chưa NV nào dùng)`}
                    >
                      <span>📦 Cất Kho</span>
                    </button>
                  )}

                {onTransferViaPages && (
                  <button
                    type="button"
                    onClick={() => onTransferViaPages(via.uid)}
                    className="inline-flex items-center space-x-0.5 px-1.5 py-0.2 text-[9.5px] font-bold text-indigo-700 hover:text-indigo-950 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded cursor-pointer shrink-0 transition-colors"
                    title={`Mở bảng Chuyển Via "${via.uid}" kèm toàn bộ ${assignedPages.length} Page sang nhân viên khác hoặc Kho Chờ`}
                  >
                    <ArrowRightLeft className="w-2.5 h-2.5 text-indigo-600" />
                    <span>
                      {isAdminWaitingPool(via.staffName) || !via.staffName?.trim()
                        ? 'Giao NV'
                        : 'Chuyển NV'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </td>

        {/* 6. PAGE / GROUP ĐANG CẦM (HIỂN THỊ RÕ SỐ LƯỢNG PAGE & TRẠNG THÁI GROUP VIA CẦM) */}
        <td
          className={`py-2 px-2 border-r transition-all text-center ${
            isRowError
              ? 'border-red-200'
              : isRowFixed
              ? 'border-emerald-200 bg-emerald-50/50'
              : isPendingPage
              ? 'border-rose-300 bg-rose-50/95 ring-1 ring-inset ring-rose-300'
              : isUpdatedPage || assignedPages.length > 0
              ? 'border-emerald-300 bg-emerald-50/90'
              : getViaGroupNoteFlags(via).hasGroupNote || assignedGroups.length > 0
              ? 'border-purple-300 bg-purple-50/70'
              : 'border-slate-200'
          }`}
        >
          <div className="flex flex-col items-center space-y-1 w-full min-w-[175px] max-w-[235px] mx-auto">
            {isPendingPage ? (
              <>
                {/* 🔴 Via & Page mới bàn giao / Admin đã thêm Page (Màu đỏ để nhân viên biết) */}
                <div className="flex items-center justify-between gap-1 w-full">
                  {currentUser.role === 'admin' ? (
                    <button
                      type="button"
                      onClick={() => handleSetViaPageStatus(via, 'none')}
                      className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10.5px] font-bold shadow-2xs cursor-pointer flex items-center space-x-1"
                      title="Via & Page mới bàn giao (Đang đánh dấu đỏ để nhân viên biết). Bấm để xóa đánh dấu."
                    >
                      <AlertCircle className="w-3 h-3" />
                      <span>
                        🔴 Mới giao {assignedPages.length > 0 ? `(${assignedPages.length} Page)` : 'Via'}
                      </span>
                    </button>
                  ) : (
                    <span
                      className="px-2 py-0.5 bg-rose-600 text-white rounded text-[10.5px] font-bold shadow-2xs flex items-center space-x-1 animate-pulse"
                      title="Admin vừa chuyển giao Via & Page mới này cho bạn!"
                    >
                      <AlertCircle className="w-3 h-3" />
                      <span>
                        🔴 Mới giao {assignedPages.length > 0 ? `(${assignedPages.length} Page)` : 'Via'}
                      </span>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleSetViaPageStatus(via, 'updated')}
                    className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow-2xs cursor-pointer"
                    title="Xác nhận đã nhận Via & Page mới (Chuyển sang màu xanh)"
                  >
                    ✓ Đã nhận
                  </button>
                </div>

                {assignedPages.length > 0 && (
                  <div className="w-full bg-white/95 border border-rose-200 rounded px-1.5 py-1 text-left space-y-0.5">
                    <div className="text-[10px] font-extrabold text-rose-900 flex items-center justify-between">
                      <span>📗 Đang cầm {assignedPages.length} Page:</span>
                      <button
                        type="button"
                        onClick={() => onFilterPageByVia && onFilterPageByVia(via.uid)}
                        className="text-indigo-700 hover:underline font-bold cursor-pointer"
                      >
                        Mở xem →
                      </button>
                    </div>
                    {assignedPages.map((p, pIdx) => (
                      <div key={p.id} className="text-[10px] text-slate-700 truncate font-medium">
                        {pIdx + 1}. {p.pageName || `Page ${pIdx + 1}`}
                      </div>
                    ))}
                  </div>
                )}

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
            ) : isUpdatedPage || assignedPages.length > 0 ? (
              <>
                {/* 🟢 Đã Có Page: Hiển thị rõ Số Lượng Page Via Cầm (1, 2, 3, 4... Page) */}
                <div className="flex items-center justify-between gap-1 w-full">
                  <button
                    type="button"
                    onClick={() => onFilterPageByVia && onFilterPageByVia(via.uid)}
                    className={`px-2 py-0.5 text-white rounded text-[11px] font-extrabold shadow-2xs cursor-pointer flex items-center space-x-1 ${
                      assignedPages.length >= 2
                        ? 'bg-emerald-700 hover:bg-emerald-800 ring-1 ring-emerald-400'
                        : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                    title={`Nick Via ${via.uid} của ${via.staffName} đang cầm ${assignedPages.length || 1} Fanpage. Bấm để lọc xem danh sách các Fanpage này.`}
                  >
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span>📗 Đang cầm {assignedPages.length || 1} Page</span>
                  </button>

                  <div className="flex items-center space-x-0.5">
                    {onAddPageForVia && (
                      <button
                        type="button"
                        onClick={() => onAddPageForVia(via.uid, via.staffName)}
                        className="px-1 py-0.5 text-[10px] font-bold text-emerald-800 bg-white hover:bg-emerald-100 border border-emerald-300 rounded cursor-pointer"
                        title="Thêm Fanpage mới vào Via này"
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
                  <div className="w-full bg-white/90 border border-emerald-200/90 rounded px-1.5 py-1 text-left space-y-0.5 shadow-2xs">
                    {assignedPages.length > 1 && (
                      <div className="flex items-center justify-between text-[9.5px] font-bold text-emerald-900 border-b border-emerald-100 pb-0.5 mb-0.5">
                        <span>
                          🟢 {assignedPages.filter((p) => p.status !== 'Không làm').length} làm • 🔴{' '}
                          {assignedPages.filter((p) => p.status === 'Không làm').length} nghỉ
                        </span>
                        <span className="text-indigo-700 font-extrabold">
                          Tổng: {assignedPages.length} Page
                        </span>
                      </div>
                    )}
                    <div className="max-h-16 overflow-y-auto space-y-0.5 pr-0.5">
                      {assignedPages.map((p, pIdx) => (
                        <div
                          key={p.id}
                          onClick={() => onFilterPageByVia && onFilterPageByVia(via.uid)}
                          className="text-[10px] flex items-center justify-between gap-1 cursor-pointer hover:text-indigo-700"
                          title={`${p.pageName} (${p.status}) - Bấm để mở bên Quản Lý Page`}
                        >
                          <span className="truncate font-semibold text-slate-800">
                            {assignedPages.length > 1 ? `${pIdx + 1}. ` : ''}
                            {p.pageName || `Page ${pIdx + 1}`}
                          </span>
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              p.status === 'Không làm' ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                            title={p.status}
                          />
                        </div>
                      ))}
                    </div>
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
                      <span>0 Page (Chưa có)</span>
                    </button>
                  ) : (
                    <span className="px-2 py-0.5 bg-slate-50 text-slate-500 border border-slate-200 rounded text-[11px] font-medium flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      <span>0 Page (Chưa có)</span>
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

            {/* 🟣 HIỂN THỊ TRẠNG THÁI MỤC GROUP CỦA VIA (Thêm mới để thêm Group, Admin đã thêm Group, Có Group từ đầu, Cần thêm Group & Group đang cầm) */}
            {(() => {
              const gFlags = getViaGroupNoteFlags(via);
              if (!gFlags.hasGroupNote && assignedGroups.length === 0) return null;
              return (
                <div className="w-full pt-1 border-t border-purple-200/80 flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    {gFlags.isThemMoiGroup ? (
                      <span className="px-1.5 py-0.2 rounded bg-purple-600 text-white font-extrabold text-[10px] shadow-2xs truncate">
                        🟣 Thêm mới để thêm Group
                      </span>
                    ) : gFlags.isAdminThemGroup ? (
                      <span className="px-1.5 py-0.2 rounded bg-purple-600 text-white font-extrabold text-[10px] shadow-2xs truncate">
                        🟣 Admin đã thêm Group
                      </span>
                    ) : gFlags.isCoGroupTuDau ? (
                      <span className="px-1.5 py-0.2 rounded bg-indigo-600 text-white font-extrabold text-[10px] shadow-2xs truncate">
                        🔵 Có Group từ đầu
                      </span>
                    ) : gFlags.isCanThemGroup ? (
                      <span className="px-1.5 py-0.2 rounded bg-amber-600 text-white font-extrabold text-[10px] shadow-2xs truncate">
                        🟠 Cần thêm Group
                      </span>
                    ) : gFlags.hasGroupNote ? (
                      <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-900 border border-purple-300 font-bold text-[10px] truncate">
                        🟣 Mục Group
                      </span>
                    ) : null}

                    {assignedGroups.length > 0 && (
                      <span
                        className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-950 border border-purple-300 font-black text-[10px] shrink-0"
                        title={assignedGroups.map((g) => g.groupName).join(', ')}
                      >
                        👥 {assignedGroups.length} Nhóm
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}
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

        {/* 8. BÁO ADMIN / GHI CHÚ VIA TỪ PAGE & GROUP */}
        <td
          className={`py-2 px-2 border-r text-center transition-all ${
            via.adminReportStatus === 'VHH'
              ? 'bg-rose-50/90 border-rose-200'
              : via.adminReportStatus === '282'
              ? 'bg-amber-50/90 border-amber-200'
              : via.adminReportStatus === '956'
              ? 'bg-purple-50/90 border-purple-200'
              : via.adminReportStatus === 'Hạn Chế'
              ? 'bg-yellow-50/90 border-yellow-200'
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
              const isVhh = val === 'VHH';
              const isCp = val === '282' || val === '956';
              const isLive = val === 'Live';
              onUpdateVia({
                ...via,
                adminReportStatus: val,
                ...(isVhh ? { status: 'dead', isError: true, isFixed: false } : {}),
                ...(isCp ? { status: 'checkpoint', isError: true, isFixed: false } : {}),
                ...(isLive ? { status: 'active', isError: false } : {}),
              });
              setCopyToastMessage(
                val === 'None'
                  ? `Đã xóa Báo Admin cho nick ${via.uid}`
                  : isVhh
                  ? `🔴 Đã báo VHH cho nick ${via.uid} & đồng bộ sang Quản Lý Page / Group!`
                  : `📢 Đã báo Admin: [${val}] cho nick ${via.uid} & đồng bộ sang Quản Lý Page / Group!`
              );
              setTimeout(() => setCopyToastMessage(null), 2500);
            }}
            className={`w-full text-[11px] font-bold rounded-lg px-2 py-1 border shadow-2xs cursor-pointer focus:outline-hidden transition-all text-center ${
              via.adminReportStatus === 'Live'
                ? 'bg-emerald-600 text-white border-emerald-700'
                : via.adminReportStatus === 'VHH'
                ? 'bg-rose-600 text-white border-rose-700 ring-1 ring-rose-300'
                : via.adminReportStatus === '282'
                ? 'bg-amber-500 text-white border-amber-600'
                : via.adminReportStatus === '956'
                ? 'bg-purple-600 text-white border-purple-700'
                : via.adminReportStatus === 'Hạn Chế'
                ? 'bg-yellow-500 text-slate-950 border-yellow-600'
                : via.adminReportStatus === 'SDT'
                ? 'bg-blue-600 text-white border-blue-700'
                : via.adminReportStatus === 'Selfie'
                ? 'bg-purple-600 text-white border-purple-700'
                : via.adminReportStatus === 'Email code' || (via.adminReportStatus as any) === 'Code mail'
                ? 'bg-amber-500 text-white border-amber-600'
                : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'
            }`}
            title="Báo tình trạng nick lên Admin (Đồng bộ 2 chiều với cột Ghi Chú Via ở Quản Lý Page & Group)"
          >
            <option value="None">⚪ Chưa báo</option>
            <option value="VHH">🔴 VHH (Vô Hiệu Hóa)</option>
            <option value="282">🟠 282 (Checkpoint)</option>
            <option value="956">🟣 956 (Khóa Tím)</option>
            <option value="Hạn Chế">🟡 Hạn Chế / Spam</option>
            <option value="Live">🟢 Live (Hoạt Động Tốt)</option>
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
                onClick={(e) => {
                  e.stopPropagation();
                  handlePromptSingleDelete(via);
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

            {/* Nút Xóa Toàn Bộ Via Đã Chọn trên Header */}
            <button
              type="button"
              id="btn-bulk-delete-header"
              onClick={handlePromptBulkDelete}
              className={`inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer border ${
                selectedCount > 0
                  ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-md ring-2 ring-rose-400/50'
                  : 'bg-white/10 hover:bg-white/20 text-rose-300 border-rose-400/30'
              }`}
              title={
                selectedCount > 0
                  ? `Xóa toàn bộ ${selectedCount} via đã chọn khỏi hệ thống`
                  : 'Tick chọn các nick via cần xóa trong bảng rồi bấm nút này'
              }
            >
              <Trash2 className="w-4 h-4 text-rose-300" />
              <span>Xóa Via Đã Chọn {selectedCount > 0 ? `(${selectedCount})` : ''}</span>
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

      {/* 🌟 THANH TAB LỌC THEO TỪNG NHÂN VIÊN & KHO CHỜ ADMIN (DÀNH CHO ADMIN) */}
      {currentUser.role === 'admin' ? (
        <>
          <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-1.5 overflow-x-auto py-1 scrollbar-thin">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                <span>Phân loại:</span>
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
                  {viaList.length} Via
                </span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  selectedStaffFilter === 'all' ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}>
                  📗 {allRecords.filter((r) => Boolean(r.viaUid?.trim())).length} Page
                </span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  selectedStaffFilter === 'all' ? 'bg-purple-500 text-white' : 'bg-purple-50 text-purple-900 border border-purple-200'
                }`}>
                  🟣 {(allGroupRecords || []).filter((g) => Boolean(g.uid?.trim())).length} Group
                </span>
              </button>

              {/* 📦 TAB KHO CHỜ CỦA ADMIN (CHƯA NHÂN VIÊN NÀO DÙNG - BAO GỒM VIA & VIA + PAGE CẦM) */}
              <button
                type="button"
                onClick={() => {
                  setSelectedStaffFilter(ADMIN_WAITING_POOL);
                  onSyncStaffFilter?.(ADMIN_WAITING_POOL);
                }}
                className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold border-2 transition-all cursor-pointer shrink-0 ${
                  isAdminWaitingPool(selectedStaffFilter)
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white border-amber-700 shadow-sm ring-2 ring-amber-300/60'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-400 shadow-2xs'
                }`}
                title={`Kho Chờ Của Admin (Chưa nhân viên nào dùng): ${waitingPoolStats.total} Nick Via (${waitingPoolStats.emptyVias} Via trống + ${waitingPoolStats.viasWithPages} Via đang cầm ${waitingPoolStats.totalPages} Page + ${waitingPoolStats.viasForGroup} Via mục Group)`}
              >
                <Archive className={`w-3.5 h-3.5 ${isAdminWaitingPool(selectedStaffFilter) ? 'text-white' : 'text-amber-700'}`} />
                <span>📦 Kho Chờ Admin</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  isAdminWaitingPool(selectedStaffFilter)
                    ? 'bg-black/25 text-white'
                    : 'bg-white text-amber-950 border border-amber-300'
                }`}>
                  {waitingPoolStats.total} Via
                </span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  isAdminWaitingPool(selectedStaffFilter)
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                }`}>
                  📗 {waitingPoolStats.totalPages} Page
                </span>
                {waitingPoolStats.viasForGroup > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    isAdminWaitingPool(selectedStaffFilter)
                      ? 'bg-purple-200 text-purple-950'
                      : 'bg-purple-100 text-purple-900 border border-purple-300'
                  }`}>
                    🟣 {waitingPoolStats.viasForGroup} Via Group
                  </span>
                )}
              </button>

              {/* Individual Staff Tabs */}
              {distinctStaffNames.map((name) => {
                const theme = getStaffTheme(name);
                const stats = staffStats[name] || {
                  total: 0,
                  active: 0,
                  checkpoint: 0,
                  dead: 0,
                  viasWithPages: 0,
                  totalPages: 0,
                  viasForGroup: 0,
                  totalGroups: 0,
                  pendingNew: 0,
                };
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
                    title={`Nhân viên ${name}: ${stats.total} Nick Via (${stats.viasWithPages} Via có Page - cầm ${stats.totalPages} Fanpage • ${stats.viasForGroup} Via mục Group - cầm ${stats.totalGroups} Group)`}
                  >
                    <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : theme.dot}`} />
                    <span>{name}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                      isSelected ? 'bg-black/25 text-white' : 'bg-white text-slate-800'
                    }`}>
                      {stats.total} Via
                    </span>
                    {stats.totalPages > 0 && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                        isSelected ? 'bg-emerald-400 text-slate-950' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      }`}>
                        📗 {stats.totalPages} Page
                      </span>
                    )}
                    {stats.viasForGroup > 0 && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                        isSelected ? 'bg-purple-200 text-purple-950' : 'bg-purple-100 text-purple-900 border border-purple-300'
                      }`}>
                        🟣 {stats.viasForGroup} Via Group
                      </span>
                    )}
                    {stats.pendingNew > 0 && (
                      <span
                        className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-2xs animate-pulse"
                        title={`Nhân viên ${name} có ${stats.pendingNew} Via & Page mới được chuyển giao (Đánh dấu đỏ)`}
                      >
                        🔴 {stats.pendingNew} mới
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              {onTransferViaPages && (
                <button
                  type="button"
                  onClick={() => onTransferViaPages('')}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 shadow-2xs transition-colors cursor-pointer"
                  title="Chuyển Via / Via + Page vào Kho Chờ Admin hoặc cấp từ Kho Chờ sang cho Nhân viên dùng"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Chuyển Kho Chờ ⇄ Nhân Viên</span>
                </button>
              )}
              {selectedStaffFilter === 'all' && (
                <button
                  type="button"
                  onClick={() => setIsGroupedByStaff(!isGroupedByStaff)}
                  className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    isGroupedByStaff
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-bold'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                  title="Nhóm các dòng theo Kho Chờ Admin và từng Nhân viên"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{isGroupedByStaff ? 'Đang phân nhóm NV' : 'Phân nhóm theo NV'}</span>
                </button>
              )}
            </div>
          </div>

          {/* 📦 BANNER CHI TIẾT KHI ADMIN ĐANG MỞ KHO CHỜ ADMIN */}
          {isAdminWaitingPool(selectedStaffFilter) && (
            <div className="bg-gradient-to-r from-amber-50 via-orange-50/80 to-amber-50 border-b-2 border-amber-300 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
                  <Archive className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center flex-wrap gap-2">
                    <h3 className="font-black text-amber-950 text-sm uppercase tracking-tight">
                      📦 KHO CHỜ CỦA ADMIN (CHƯA NHÂN VIÊN NÀO DÙNG)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-200/80 text-amber-950 border border-amber-400">
                      Tổng: {waitingPoolStats.total} Nick Via
                    </span>
                    <button
                      type="button"
                      onClick={() => setStatusFilter(statusFilter === 'no_page' ? 'all' : 'no_page')}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold border cursor-pointer transition-all ${
                        statusFilter === 'no_page'
                          ? 'bg-slate-800 text-white border-slate-900 ring-2 ring-slate-400'
                          : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                      }`}
                      title="Bấm để lọc xem các Via trống (chưa cầm Page) trong Kho Chờ"
                    >
                      ⚪ Via trống: {waitingPoolStats.emptyVias} Via
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter(statusFilter === 'has_page' ? 'all' : 'has_page')}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold border cursor-pointer transition-all ${
                        statusFilter === 'has_page'
                          ? 'bg-emerald-700 text-white border-emerald-800 ring-2 ring-emerald-300'
                          : 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                      }`}
                      title="Bấm để lọc xem các Via + Page đang cầm trong Kho Chờ"
                    >
                      📗 Via + Page cầm: {waitingPoolStats.viasWithPages} Via (Đang cầm {waitingPoolStats.totalPages} Page)
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter(statusFilter === 'all_group' ? 'all' : 'all_group')}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold border cursor-pointer transition-all ${
                        statusFilter === 'all_group'
                          ? 'bg-purple-700 text-white border-purple-800 ring-2 ring-purple-300'
                          : 'bg-purple-600 text-white border-purple-700 hover:bg-purple-700'
                      }`}
                      title="Bấm để lọc xem các Via mục Group trong Kho Chờ"
                    >
                      🟣 Via mục Group: {waitingPoolStats.viasForGroup} Via ({waitingPoolStats.totalGroups} Group)
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-900 mt-1">
                    Nơi lưu trữ dự phòng các <strong>Nick Via trống</strong>, <strong>Via mục Group</strong> và <strong>Via + Toàn bộ Page cầm</strong> chưa giao cho nhân viên nào. Khi cần giao cho ai, chọn nhân viên ở cột <strong>NHÂN VIÊN</strong> hoặc bấm <strong>Giao Via + Page Cho NV</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-center flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenAddModalForStaff(ADMIN_WAITING_POOL)}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-amber-100 text-amber-950 border border-amber-400 shadow-2xs cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-700" />
                  <span>+ Thêm 1 Via Vào Kho Chờ</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenBulkImport(ADMIN_WAITING_POOL)}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs cursor-pointer transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>📥 Nhập Hàng Loạt Vào Kho Chờ</span>
                </button>
                {onTransferViaPages && (
                  <button
                    type="button"
                    onClick={() => onTransferViaPages('')}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer transition-colors"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>👤 Giao Via / Via + Page Cho Nhân Viên Dùng</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Staff Banner: Dedicated to current logged-in staff */
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900">
          <div className="flex items-center space-x-2">
            <UserCheck className="w-4 h-4 text-emerald-700" />
            <span>Tài khoản Full Via bàn giao cho: <strong className="uppercase">{currentUser.name}</strong></span>
          </div>
          <div className="flex items-center flex-wrap gap-2">
            <span className="font-bold bg-white text-emerald-900 border border-emerald-300 px-2.5 py-0.5 rounded-full text-[11px]">
              {scopedVias.length} Nick Via
            </span>
            <span className="font-extrabold bg-emerald-600 text-white px-2.5 py-0.5 rounded-full text-[11px] shadow-2xs">
              📗 Đang cầm {totalPagesInScope} Fanpage ({multiPageViasCountInScope} Via cầm ≥ 2 Page)
            </span>
            <span className="font-extrabold bg-purple-600 text-white px-2.5 py-0.5 rounded-full text-[11px] shadow-2xs">
              🟣 Mục Group: {groupViaStatsInScope.totalGroupVias} Via (Đang cầm {groupViaStatsInScope.totalGroupsInTable2} Group)
            </span>
          </div>
        </div>
      )}

      {/* 🔴 BANNER ĐỎ BÁO NHÂN VIÊN CÓ VIA VÀ PAGE MỚI BÀN GIAO */}
      {pendingPageCountInScope > 0 && (
        <div className="bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 text-white px-4 py-2.5 border-b border-rose-800 shadow-sm flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center flex-wrap gap-2">
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-white text-rose-700 font-black text-[11px] shadow-2xs animate-pulse">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 fill-rose-100" />
              <span>🔴 CÓ {pendingPageCountInScope} VIA & PAGE MỚI NHẬN!</span>
            </span>
            <span className="font-semibold text-rose-50">
              {currentUser.role === 'staff'
                ? `Bạn vừa được chuyển giao ${pendingPageCountInScope} Nick Via & Page mới (được tô đỏ trong bảng để dễ nhận biết).`
                : `Đang có ${pendingPageCountInScope} Nick Via & Page mới chuyển giao cho nhân viên (đang đánh dấu đỏ chờ nhân viên nhận).`}
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'pending_page' ? 'all' : 'pending_page')}
              className={`px-2.5 py-1 rounded-lg font-extrabold text-[11px] border transition-all cursor-pointer ${
                statusFilter === 'pending_page'
                  ? 'bg-amber-300 text-slate-950 border-amber-400 shadow-2xs'
                  : 'bg-rose-800/80 hover:bg-rose-900 text-white border-rose-400/60'
              }`}
            >
              {statusFilter === 'pending_page'
                ? '✕ Bỏ lọc Via & Page mới'
                : `🔍 Lọc riêng ${pendingPageCountInScope} Via mới`}
            </button>

            <button
              type="button"
              onClick={() => {
                const pendingVias = currentBaseVias.filter((v) => isViaPendingPageUpdate(v));
                pendingVias.forEach((v) => {
                  onUpdateVia({
                    ...v,
                    pageUpdateStatus: 'updated',
                    isNewlyTransferred: false,
                    hasAdminAssignedPage: true,
                    pageUpdatedAt: new Date().toLocaleDateString('vi-VN'),
                  });
                });
                if (onAcknowledgeNewTransfer) {
                  onAcknowledgeNewTransfer(
                    currentUser.role === 'staff'
                      ? { staffName: currentUser.name }
                      : selectedStaffFilter !== 'all' && !isAdminWaitingPool(selectedStaffFilter)
                      ? { staffName: selectedStaffFilter }
                      : {}
                  );
                }
                if (statusFilter === 'pending_page') {
                  setStatusFilter('all');
                }
                setCopyToastMessage(
                  `✅ Đã xác nhận nhận tất cả ${pendingVias.length} Via & Page mới (Đã xóa đánh dấu đỏ)!`
                );
                setTimeout(() => setCopyToastMessage(null), 3000);
              }}
              className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[11px] border border-emerald-400 shadow-2xs transition-colors cursor-pointer flex items-center space-x-1"
              title="Xác nhận đã nhận tất cả các Via & Page mới (Chuyển từ màu đỏ sang màu xanh)"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>✓ Đã nhận tất cả ({pendingPageCountInScope} Via)</span>
            </button>
          </div>
        </div>
      )}

      {/* 🟣 THANH THỐNG KÊ & LỌC NHANH CHO MỤC GROUP CỦA VIA (THÊM MỚI ĐỂ THÊM GROUP, ADMIN ĐÃ THÊM GROUP, CÓ GROUP TỪ ĐẦU, CẦN THÊM GROUP) */}
      <div className="bg-gradient-to-r from-purple-50/90 via-indigo-50/70 to-purple-50/90 border-b border-purple-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center flex-wrap gap-1.5">
          <span className="text-[11px] font-black text-purple-950 uppercase tracking-wider mr-1 flex items-center gap-1">
            <span>🟣 Thống Kê Group (Mục Via):</span>
          </span>

          {/* Tổng Via Mục Group */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'all_group' ? 'all' : 'all_group')}
            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-black border transition-all cursor-pointer ${
              statusFilter === 'all_group'
                ? 'bg-purple-700 text-white border-purple-800 shadow-xs ring-2 ring-purple-300'
                : 'bg-white text-purple-950 border-purple-300 hover:bg-purple-100 shadow-2xs'
            }`}
            title="Lọc toàn bộ các nick Via có ghi chú mục Group hoặc đang cầm Group ở Bảng 2"
          >
            <span>📊 Tổng Via Mục Group:</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                statusFilter === 'all_group' ? 'bg-white/25 text-white' : 'bg-purple-100 text-purple-900'
              }`}
            >
              {groupViaStatsInScope.totalGroupVias} Via
            </span>
          </button>

          {/* 1. Thêm mới để thêm Group */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'group_them_moi' ? 'all' : 'group_them_moi')}
            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
              statusFilter === 'group_them_moi'
                ? 'bg-purple-600 text-white border-purple-700 shadow-xs ring-2 ring-purple-300'
                : 'bg-white text-purple-900 border-purple-300 hover:bg-purple-100'
            }`}
            title="Lọc các nick có ghi chú: Thêm mới để thêm Group"
          >
            <span>🟣 Thêm mới để thêm Group:</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                statusFilter === 'group_them_moi' ? 'bg-white/25 text-white' : 'bg-purple-100 text-purple-900'
              }`}
            >
              {groupViaStatsInScope.themMoiGroup}
            </span>
          </button>

          {/* 2. Admin đã thêm Group */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'group_admin_them' ? 'all' : 'group_admin_them')}
            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
              statusFilter === 'group_admin_them'
                ? 'bg-purple-600 text-white border-purple-700 shadow-xs ring-2 ring-purple-300'
                : 'bg-white text-purple-900 border-purple-300 hover:bg-purple-100'
            }`}
            title="Lọc các nick có ghi chú: Admin đã thêm Group"
          >
            <span>🟣 Admin đã thêm Group:</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                statusFilter === 'group_admin_them' ? 'bg-white/25 text-white' : 'bg-purple-100 text-purple-900'
              }`}
            >
              {groupViaStatsInScope.adminThemGroup}
            </span>
          </button>

          {/* 3. Có Group từ đầu */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'group_co_tu_dau' ? 'all' : 'group_co_tu_dau')}
            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
              statusFilter === 'group_co_tu_dau'
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs ring-2 ring-indigo-300'
                : 'bg-white text-indigo-900 border-indigo-300 hover:bg-indigo-100'
            }`}
            title="Lọc các nick có ghi chú: Có Group từ đầu"
          >
            <span>🔵 Có Group từ đầu:</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                statusFilter === 'group_co_tu_dau' ? 'bg-white/25 text-white' : 'bg-indigo-100 text-indigo-900'
              }`}
            >
              {groupViaStatsInScope.coGroupTuDau}
            </span>
          </button>

          {/* 4. Cần thêm Group */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'group_can_them' ? 'all' : 'group_can_them')}
            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
              statusFilter === 'group_can_them'
                ? 'bg-amber-600 text-white border-amber-700 shadow-xs ring-2 ring-amber-300'
                : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-100'
            }`}
            title="Lọc các nick có ghi chú: Cần thêm Group"
          >
            <span>🟠 Cần thêm Group:</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                statusFilter === 'group_can_them' ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-900'
              }`}
            >
              {groupViaStatsInScope.canThemGroup}
            </span>
          </button>

          {/* 5. Đang cầm Group (Bảng 2) */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'has_group' ? 'all' : 'has_group')}
            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
              statusFilter === 'has_group'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs ring-2 ring-emerald-300'
                : 'bg-white text-emerald-900 border-emerald-300 hover:bg-emerald-100'
            }`}
            title="Lọc các nick Via hiện đang gắn với các nhóm bên Bảng 2 (Quản Lý Group)"
          >
            <span>👥 Đang cầm Group (Bảng 2):</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                statusFilter === 'has_group' ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-900'
              }`}
            >
              {groupViaStatsInScope.hasGroupInTable2} Via ({groupViaStatsInScope.totalGroupsInTable2} nhóm)
            </span>
          </button>

          {/* 6. Chưa gắn vào Bảng Group */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'group_chua_gan' ? 'all' : 'group_chua_gan')}
            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
              statusFilter === 'group_chua_gan'
                ? 'bg-slate-800 text-white border-slate-900 shadow-xs ring-2 ring-slate-300'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
            title="Lọc các nick đã đánh dấu mục Group nhưng chưa gắn vào nhóm nào ở Bảng 2"
          >
            <span>⏳ Chưa gắn vào Bảng Group:</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                statusFilter === 'group_chua_gan' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-800'
              }`}
            >
              {groupViaStatsInScope.chuaGanGroup}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {statusFilter.includes('group') && (
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className="px-2 py-1 rounded-lg text-[11px] font-bold bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 cursor-pointer"
            >
              ✕ Bỏ lọc Group
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const targetGroupVias = statusFilter.includes('group')
                ? scopedVias
                : currentBaseVias.filter((v) => {
                    const uidKey = normalizeUidKey(v.uid);
                    const groups = uidKey ? groupsPerViaUid.get(uidKey) || [] : [];
                    return getViaGroupNoteFlags(v).hasGroupNote || groups.length > 0;
                  });
              const uids = targetGroupVias.map((v) => v.uid?.trim()).filter(Boolean);
              if (uids.length === 0) {
                setCopyToastMessage('⚠️ Hiện chưa có UID nào thuộc mục Via Group để sao chép!');
                setTimeout(() => setCopyToastMessage(null), 2500);
                return;
              }
              navigator.clipboard.writeText(uids.join('\n'));
              setCopyToastMessage(`📋 Đã copy ${uids.length} UID thuộc mục Via Group vào clipboard!`);
              setTimeout(() => setCopyToastMessage(null), 3000);
            }}
            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-purple-600 hover:bg-purple-700 text-white shadow-2xs cursor-pointer transition-colors"
            title="Sao chép toàn bộ UID thuộc mục Group (mỗi UID 1 dòng) để dán nhanh sang Bảng Group"
          >
            <Copy className="w-3 h-3" />
            <span>Copy UID Via Group ({statusFilter.includes('group') ? scopedVias.length : groupViaStatsInScope.totalGroupVias})</span>
          </button>
        </div>
      </div>

      {/* Unified Filter Toolbar */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Search Input (Supports Bulk Multi-line UID Search - 1 UID per line) */}
          <div className="relative min-w-[230px] sm:min-w-[280px] max-w-md flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            <textarea
              rows={
                searchQuery.includes('\n')
                  ? Math.min(searchQuery.split(/\r?\n/).filter((l) => l.trim()).length, 5)
                  : 1
              }
              placeholder="Tìm 1 hoặc dán hàng loạt UID (mỗi UID 1 dòng), Pass, 2FA, NV..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-16 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono resize-y leading-snug"
              title="Có thể dán nhiều UID cùng lúc (mỗi UID 1 dòng) để lọc hàng loạt"
            />
            {searchQuery && (
              <div className="absolute right-1.5 top-1.5 flex items-center space-x-1">
                {searchQuery.split(/\r?\n/).filter((l) => l.trim()).length > 1 && (
                  <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded text-[10px] font-extrabold font-sans">
                    {searchQuery.split(/\r?\n/).filter((l) => l.trim()).length} UID
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer bg-white/90 rounded"
                  title="Xóa tìm kiếm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
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
              onClick={() =>
                setAdminReportFilter((prev) => (prev === 'VHH' ? 'all' : 'VHH'))
              }
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                adminReportFilter === 'VHH'
                  ? 'bg-rose-600 text-white shadow-2xs ring-1 ring-rose-300'
                  : adminReportCounts.VHH > 0
                  ? 'bg-rose-50 text-rose-700 font-black hover:bg-rose-100 border border-rose-200'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
              title="Lọc nhanh các nick bị VHH (Đồng bộ từ Bảng Group & Báo Admin)"
            >
              🔴 VHH ({adminReportCounts.VHH})
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
              title="Lọc các nick Via & Page mới chuyển giao cho nhân viên (Màu đỏ để NV biết)"
            >
              🔴 Via & Page mới ({pendingPageCountInScope})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('has_page')}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'has_page'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
              title="Lọc các nick đang cầm Page (Màu xanh)"
            >
              🟢 Có Page ({hasPageCountInScope} Via / {totalPagesInScope} Page)
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all_group')}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'all_group'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-purple-800 hover:bg-purple-50'
              }`}
              title="Lọc các nick thuộc mục Group (Thêm mới để thêm Group / Đang cầm Group)"
            >
              🟣 Via Group ({groupViaStatsInScope.totalGroupVias} Via / {groupViaStatsInScope.totalGroupsInTable2} Group)
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
              title="Lọc theo trạng thái Báo Admin / Ghi chú Via từ Quản Lý Page & Group"
            >
              <option value="all">📢 Báo Admin: Tất cả ({adminReportCounts.all})</option>
              <option value="VHH">🔴 Báo: VHH ({adminReportCounts.VHH})</option>
              <option value="282">🟠 Báo: 282 ({adminReportCounts['282']})</option>
              <option value="956">🟣 Báo: 956 ({adminReportCounts['956']})</option>
              <option value="Hạn Chế">🟡 Báo: Hạn Chế ({adminReportCounts['Hạn Chế']})</option>
              <option value="Live">🟢 Báo: Live ({adminReportCounts.Live})</option>
              <option value="SDT">📱 Báo: SDT ({adminReportCounts.SDT})</option>
              <option value="Selfie">🤳 Báo: Selfie ({adminReportCounts.Selfie})</option>
              <option value="Email code">✉️ Báo: Email code ({adminReportCounts['Email code']})</option>
              <option value="None">⚪ Chưa báo Admin ({adminReportCounts.None})</option>
            </select>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2 text-slate-500 text-[11px] shrink-0">
          {/* Select all toggle button */}
          <button
            type="button"
            id="btn-toggle-select-all"
            onClick={handleSelectAll}
            className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer ${
              isAllSelected
                ? 'bg-indigo-50 text-indigo-700 border-indigo-300 font-bold'
                : selectedCount > 0
                ? 'bg-slate-100 text-slate-700 border-slate-300 font-bold'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>{isAllSelected ? 'Bỏ chọn' : selectedCount > 0 ? `Chọn hết (${scopedVias.length})` : 'Chọn tất cả'}</span>
          </button>

          {/* Nút Xóa Toàn Bộ Via Đã Chọn Trên Toolbar */}
          <button
            type="button"
            id="btn-bulk-delete-toolbar"
            onClick={handlePromptBulkDelete}
            className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer shadow-2xs ${
              selectedCount > 0
                ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-sm animate-pulse'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 hover:border-rose-300'
            }`}
            title={
              selectedCount > 0
                ? `Xóa toàn bộ ${selectedCount} via đã chọn trên hệ thống`
                : 'Tick chọn các nick via cần xóa trong bảng rồi bấm nút này'
            }
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{selectedCount > 0 ? `Xóa toàn bộ ${selectedCount} via đã chọn` : 'Xóa toàn bộ via đã chọn'}</span>
          </button>

          {selectedCount > 0 && (
            <>
              {currentUser.role === 'admin' && (
                <>
                  {!isAdminWaitingPool(selectedStaffFilter) && (
                    <button
                      type="button"
                      onClick={() => handleBatchTransferViasToStaff(ADMIN_WAITING_POOL)}
                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-amber-500 bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold cursor-pointer shadow-2xs"
                      title="Chuyển toàn bộ các Via đã chọn kèm tất cả Fanpage đang cầm vào Kho Chờ Admin (Chưa nhân viên nào dùng)"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>📦 Cất {selectedCount} Via + Page Vào Kho Chờ</span>
                    </button>
                  )}

                  <select
                    onChange={(e) => {
                      if (!e.target.value) return;
                      handleBatchTransferViasToStaff(e.target.value);
                      e.target.value = '';
                    }}
                    defaultValue=""
                    className="px-2.5 py-1.5 rounded-lg border border-emerald-400 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer shadow-2xs"
                    title="Chuyển toàn bộ các Via đã chọn kèm tất cả Fanpage của các Via đó sang nhân viên khác hoặc vào Kho Chờ Admin"
                  >
                    <option value="" disabled>
                      👤 Giao {selectedCount} Via + Page cho NV...
                    </option>
                    <option value={ADMIN_WAITING_POOL} className="bg-amber-50 text-amber-950 font-black">
                      📦 Đưa vào: {ADMIN_WAITING_POOL} (Chưa NV dùng)
                    </option>
                    {distinctStaffNames.map((name) => (
                      <option key={name} value={name} className="bg-white text-slate-900 font-bold">
                        → Giao cho NV: {name}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <button
                type="button"
                onClick={handleCopySelectedUids}
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold cursor-pointer"
                title="Sao chép UID của các nick đã chọn"
              >
                <Copy className="w-3 h-3 text-indigo-600" />
                <span>Copy {selectedCount} UID</span>
              </button>

              <button
                type="button"
                onClick={handleCopySelectedFullVia}
                className="hidden md:inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-bold cursor-pointer"
                title="Sao chép Full Via (UID|PASS|2FA) của các nick đã chọn"
              >
                <Copy className="w-3 h-3 text-emerald-600" />
                <span>Copy Full Via ({selectedCount})</span>
              </button>
            </>
          )}

          <span>
            Hiển thị: <strong className="text-slate-800">{scopedVias.length}</strong> / {viaList.length} Via (Đang cầm <strong className="text-emerald-700">{totalPagesInScope} Page</strong>)
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
              /* Grouped by Staff View (Including Admin Waiting Pool first) */
              [ADMIN_WAITING_POOL, ...distinctStaffNames].map((staffName) => {
                const isPoolGroup = isAdminWaitingPool(staffName);
                const staffVias = scopedVias.filter((v) =>
                  isPoolGroup
                    ? isAdminWaitingPool(v.staffName) || !v.staffName?.trim()
                    : v.staffName.trim().toLowerCase() === staffName.trim().toLowerCase()
                );
                if (staffVias.length === 0) return null;

                const activeCount = staffVias.filter((v) => v.status !== 'checkpoint' && v.status !== 'dead').length;
                const checkpointCount = staffVias.filter((v) => v.status === 'checkpoint').length;
                const staffPagesCount = staffVias.reduce((acc, v) => {
                  const uid = v.uid?.trim().toLowerCase();
                  return acc + (uid ? (pagesPerViaUid.get(uid) || []).length : 0);
                }, 0);

                return (
                  <React.Fragment key={staffName}>
                    {/* Staff Group Header Row */}
                    <tr className={isPoolGroup ? 'bg-amber-100/90 border-y-2 border-amber-400' : 'bg-slate-100 border-y-2 border-slate-300'}>
                      <td colSpan={10} className="py-2.5 px-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className={`text-xs font-black uppercase tracking-wide flex items-center gap-1.5 ${isPoolGroup ? 'text-amber-950' : 'text-indigo-950'}`}>
                              {isPoolGroup ? <Archive className="w-4 h-4 text-amber-700" /> : <Users className="w-4 h-4 text-indigo-600" />}
                              <span>{isPoolGroup ? `📦 ${ADMIN_WAITING_POOL} (Chưa nhân viên nào dùng)` : `Nhân Viên: ${staffName}`}</span>
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">
                              {staffVias.length} Nick Via
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white shadow-2xs">
                              📗 Đang cầm tổng {staffPagesCount} Page
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
                              onClick={() => {
                                const ids = staffVias.map((v) => v.id);
                                const allSelected = ids.every((id) => selectedViaIds.has(id));
                                setSelectedViaIds((prev) => {
                                  const next = new Set(prev);
                                  ids.forEach((id) => {
                                    if (allSelected) next.delete(id);
                                    else next.add(id);
                                  });
                                  return next;
                                });
                              }}
                              className="text-xs font-bold text-slate-700 hover:text-indigo-800 hover:underline cursor-pointer flex items-center space-x-1"
                              title={`Chọn tất cả ${staffVias.length} nick của ${staffName} để thao tác hàng loạt hoặc xóa`}
                            >
                              <CheckSquare className="w-3 h-3 text-slate-500" />
                              <span>Chọn {staffVias.length} nick</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden my-auto max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <Key className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm">
                  {editingVia
                    ? `Bổ Sung / Sửa Full Via (UID: ${editingVia.uid})`
                    : duplicateViaInModal
                    ? `Bổ Sung Thêm 2FA | Mail | Pass Cho UID Đã Có`
                    : 'Thêm Nick Mới Hoặc Bổ Sung Thông Tin Via (2FA | Mail | Pass)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveModalForm} className="p-5 space-y-3.5 text-xs overflow-y-auto">
              {/* Chọn nhanh UID đã có nhưng còn thiếu 2FA/Pass/Mail để bổ sung */}
              {!editingVia && strictlyGuardedVias.length > 0 && (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">
                      📌 Chọn nhanh Via đã có UID để bổ sung thêm 2FA | Mail | Pass:
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {strictlyGuardedVias.filter((v) => !v.pass?.trim() || !v.twoFa?.trim()).length} nick thiếu thông tin
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {strictlyGuardedVias
                      .slice()
                      .sort((a, b) => {
                        const aMissing = (!a.pass?.trim() ? 2 : 0) + (!a.twoFa?.trim() ? 1 : 0);
                        const bMissing = (!b.pass?.trim() ? 2 : 0) + (!b.twoFa?.trim() ? 1 : 0);
                        return bMissing - aMissing;
                      })
                      .slice(0, 15)
                      .map((v) => {
                        const isSelected = modalForm.uid.trim() === v.uid.trim();
                        const missingInfo = !v.pass?.trim() || !v.twoFa?.trim();
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => handleOpenEditModal(v)}
                            className={`px-2 py-1 rounded-lg font-mono text-[10px] font-bold border shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : missingInfo
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                            title={`UID: ${v.uid} (${v.staffName}) - Bấm để nạp và bổ sung 2FA | Mail | Pass`}
                          >
                            <span>{v.uid}</span>
                            {missingInfo && (
                              <span className="text-[9px] px-1 rounded bg-amber-200/80 text-amber-950">
                                +Bổ sung
                              </span>
                            )}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  UID Facebook <span className="text-red-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nhập UID hoặc dán thẳng UID|Pass|2FA|Mail|PassMail..."
                  value={modalForm.uid}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.includes('|') || val.includes('\t')) {
                      const parsed = parseSupplementalViaInput(val, modalForm.uid);
                      setModalForm((prev) => ({
                        ...prev,
                        uid: parsed.uid || prev.uid,
                        pass: parsed.pass || prev.pass,
                        twoFa: parsed.twoFa || prev.twoFa,
                        email: parsed.email || prev.email,
                        emailPass: parsed.emailPass || prev.emailPass,
                      }));
                    } else {
                      setModalForm({ ...modalForm, uid: val });
                    }
                  }}
                  className={`w-full px-3 py-2 border rounded-lg font-mono focus:ring-2 focus:outline-hidden ${
                    duplicateViaInModal
                      ? 'border-emerald-500 bg-emerald-50/40 focus:ring-emerald-500'
                      : 'border-slate-300 focus:ring-indigo-500'
                  }`}
                />
                {duplicateViaInModal && (
                  <div className="mt-1.5 p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-950 text-xs flex items-start justify-between gap-2">
                    <div className="flex items-start space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">
                          ✓ UID đã có trong hệ thống ({duplicateViaInModal.staffName}) — Chế độ Bổ Sung Thông Tin!
                        </span>
                        <span className="text-[11px] text-emerald-800 block mt-0.5">
                          Hiện có: {duplicateViaInModal.pass ? '✓ Pass' : '⚪ Chưa Pass'} •{' '}
                          {duplicateViaInModal.twoFa ? '✓ 2FA' : '⚪ Chưa 2FA'} •{' '}
                          {duplicateViaInModal.email || parseFullVia(duplicateViaInModal.rawFullVia)?.email
                            ? '✓ Mail'
                            : '⚪ Chưa Mail'}. Khi lưu sẽ tự động gộp bổ sung vào UID này.
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(duplicateViaInModal)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] shrink-0 cursor-pointer shadow-2xs"
                    >
                      Nạp dữ liệu cũ
                    </button>
                  </div>
                )}
              </div>

              {/* Ô Dán Nhanh Bổ Sung: 2FA | Mail | Pass */}
              <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-300 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>⚡ Dán nhanh bổ sung: 2FA | Mail | Pass (Tự tách thông minh)</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={modalForm.quickPaste}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const parsed = parseSupplementalViaInput(raw, modalForm.uid);
                    setModalForm((prev) => ({
                      ...prev,
                      quickPaste: raw,
                      uid: parsed.uid || prev.uid,
                      pass: parsed.pass || prev.pass,
                      twoFa: parsed.twoFa || prev.twoFa,
                      email: parsed.email || prev.email,
                      emailPass: parsed.emailPass || prev.emailPass,
                    }));
                  }}
                  placeholder="Dán: 2FA|Mail|Pass hoặc Pass|2FA|Mail|PassMail hoặc UID|Pass|2FA|Mail..."
                  className="w-full px-3 py-1.5 bg-white border border-emerald-300 rounded-lg font-mono text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                <p className="text-[10px] text-emerald-800">
                  💡 Hỗ trợ mọi định dạng: <code>2FA|Mail|Pass</code>, <code>Pass|2FA|Mail|PassMail</code>, hoặc <code>UID|Pass|2FA|Mail|PassMail</code>.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">
                      Mật Khẩu (PASS):
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

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Mail khôi phục (Email):
                  </label>
                  <input
                    type="text"
                    placeholder="VD: example@hotmail.com"
                    value={modalForm.email}
                    onChange={(e) => setModalForm({ ...modalForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Pass Mail / Thông tin thêm:
                  </label>
                  <input
                    type="text"
                    placeholder="Mật khẩu mail..."
                    value={modalForm.emailPass}
                    onChange={(e) => setModalForm({ ...modalForm, emailPass: e.target.value })}
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
                      <option value={ADMIN_WAITING_POOL}>
                        📦 {ADMIN_WAITING_POOL} (Chưa nhân viên nào dùng)
                      </option>
                      {distinctStaffNames.map((name) => (
                        <option key={name} value={name}>
                          👤 {name}
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

              {/* Cập nhật trạng thái Page / Group của Via */}
              <div className="p-3 rounded-xl border border-slate-300 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Trạng Thái Cập Nhật Page / Group Của Nick:</span>
                  </label>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {modalForm.note?.toLowerCase().includes('group')
                      ? '🟣 Thêm mới để thêm Group'
                      : modalForm.pageUpdateStatus === 'pending'
                      ? '🔴 Admin đã thêm Page (Màu đỏ)'
                      : modalForm.pageUpdateStatus === 'updated'
                      ? '🟢 Có page từ đầu (Màu xanh)'
                      : '⚪ Chưa có Page / Group'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const cleanedNote = modalForm.note
                        .replace(/(\s*-\s*)?Admin đã thêm page/gi, '')
                        .replace(/(\s*-\s*)?Có page từ đầu/gi, '')
                        .replace(/(\s*-\s*)?Thêm mới để thêm Group/gi, '')
                        .replace(/(\s*-\s*)?Admin đã thêm Group/gi, '')
                        .replace(/(\s*-\s*)?Có Group từ đầu/gi, '')
                        .trim();
                      setModalForm({ ...modalForm, pageUpdateStatus: 'none', note: cleanedNote });
                    }}
                    className={`p-2 rounded-lg border text-center transition-all cursor-pointer font-bold text-[11px] ${
                      modalForm.pageUpdateStatus === 'none' &&
                      !modalForm.note?.toLowerCase().includes('group')
                        ? 'bg-white border-slate-400 text-slate-800 shadow-2xs ring-2 ring-slate-400'
                        : 'bg-white/80 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    ⚪ Chưa có Page/Group
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setModalForm({
                        ...modalForm,
                        pageUpdateStatus: 'pending',
                        note:
                          !modalForm.note ||
                          modalForm.note === 'Có page từ đầu' ||
                          modalForm.note === 'Thêm mới để thêm Group' ||
                          modalForm.note === 'Admin đã thêm Group'
                            ? 'Admin đã thêm page'
                            : modalForm.note,
                      })
                    }
                    className={`p-2 rounded-lg border text-center transition-all cursor-pointer font-bold text-[11px] ${
                      modalForm.pageUpdateStatus === 'pending' &&
                      !modalForm.note?.toLowerCase().includes('group')
                        ? 'bg-rose-600 text-white border-rose-700 shadow-2xs ring-2 ring-rose-300'
                        : 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100'
                    }`}
                    title="Chuyển sang trạng thái: Admin đã thêm Page (Màu đỏ để nhân viên biết)"
                  >
                    🔴 Admin thêm Page
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setModalForm({
                        ...modalForm,
                        pageUpdateStatus: 'updated',
                        note:
                          !modalForm.note ||
                          modalForm.note === 'Admin đã thêm page' ||
                          modalForm.note === 'Thêm mới để thêm Group' ||
                          modalForm.note === 'Admin đã thêm Group'
                            ? 'Có page từ đầu'
                            : modalForm.note,
                      })
                    }
                    className={`p-2 rounded-lg border text-center transition-all cursor-pointer font-bold text-[11px] ${
                      modalForm.pageUpdateStatus === 'updated' &&
                      !modalForm.note?.toLowerCase().includes('group')
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs ring-2 ring-emerald-300'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                    }`}
                    title="Đánh dấu nick có page từ đầu (Màu xanh)"
                  >
                    🟢 Có page từ đầu
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setModalForm({
                        ...modalForm,
                        pageUpdateStatus: 'pending',
                        note:
                          !modalForm.note ||
                          modalForm.note === 'Admin đã thêm page' ||
                          modalForm.note === 'Có page từ đầu'
                            ? 'Thêm mới để thêm Group'
                            : modalForm.note.toLowerCase().includes('group')
                            ? modalForm.note
                            : `${modalForm.note} - Thêm mới để thêm Group`,
                      })
                    }
                    className={`p-2 rounded-lg border text-center transition-all cursor-pointer font-bold text-[11px] ${
                      modalForm.note?.toLowerCase().includes('group')
                        ? 'bg-purple-600 text-white border-purple-700 shadow-2xs ring-2 ring-purple-300'
                        : 'bg-purple-50 border-purple-300 text-purple-800 hover:bg-purple-100'
                    }`}
                    title="Đánh dấu nick thêm mới dùng để thêm Group / làm Group"
                  >
                    🟣 Thêm mới để thêm Group
                  </button>
                </div>

                <p className="text-[10px] text-slate-500 italic">
                  💡 <strong>Quy trình:</strong> Chọn <strong>🔴 Admin thêm Page</strong> hoặc <strong>🟢 Có page từ đầu</strong> cho nick làm Page, hoặc chọn <strong>🟣 Thêm mới để thêm Group</strong> cho nick thêm mới làm Group.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 block">
                    Ghi Chú Chung Cả Via (Chọn nhanh cho Thêm Page hoặc Thêm Group):
                  </label>
                  {modalForm.note && (
                    <button
                      type="button"
                      onClick={() => setModalForm({ ...modalForm, note: '' })}
                      className="text-[10px] font-bold text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      Xóa ghi chú
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="VD: Thêm mới để thêm Group, Admin đã thêm Group, Admin đã thêm page..."
                  value={modalForm.note}
                  onChange={(e) => setModalForm({ ...modalForm, note: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />

                {/* Chọn nhanh ghi chú cho Phần Thêm Page & Phần Thêm Mới Để Thêm Group */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                  {/* Khối 1: Chọn nhanh Ghi chú Thêm Page */}
                  <div className="p-2 rounded-lg bg-rose-50/60 border border-rose-200 space-y-1">
                    <span className="text-[10px] font-extrabold text-rose-900 uppercase tracking-wider block">
                      📗 Chọn nhanh ghi chú Thêm Page:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setModalForm((prev) => ({
                            ...prev,
                            pageUpdateStatus: 'pending',
                            note: 'Admin đã thêm page',
                          }))
                        }
                        className={`px-2 py-1 rounded text-[11px] font-bold border transition-all cursor-pointer ${
                          modalForm.note.toLowerCase().includes('admin đã thêm page')
                            ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                            : 'bg-white text-rose-800 border-rose-300 hover:bg-rose-100'
                        }`}
                      >
                        🔴 Admin đã thêm page
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setModalForm((prev) => ({
                            ...prev,
                            pageUpdateStatus: 'updated',
                            note: 'Có page từ đầu',
                          }))
                        }
                        className={`px-2 py-1 rounded text-[11px] font-bold border transition-all cursor-pointer ${
                          modalForm.note.toLowerCase().includes('có page từ đầu')
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                            : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                        }`}
                      >
                        🟢 Có page từ đầu
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setModalForm((prev) => ({
                            ...prev,
                            pageUpdateStatus: 'pending',
                            note: 'Cần gán page',
                          }))
                        }
                        className={`px-2 py-1 rounded text-[11px] font-bold border transition-all cursor-pointer ${
                          modalForm.note.toLowerCase().includes('cần gán page')
                            ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                            : 'bg-white text-rose-800 border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        🔴 Cần gán page
                      </button>
                    </div>
                  </div>

                  {/* Khối 2: Chọn nhanh Ghi chú Phần Thêm Mới Để Thêm Group */}
                  <div className="p-2 rounded-lg bg-purple-50/70 border border-purple-200 space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-extrabold text-purple-900 uppercase tracking-wider block">
                        🟣 Chọn nhanh ghi chú Thêm Mới Để Thêm Group:
                      </span>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-purple-600 text-white shadow-2xs shrink-0">
                        📊 Tổng Via Group: {groupViaStatsInScope.totalGroupVias} nick
                      </span>
                    </div>

                    {/* Bảng thống kê mini cho mục Via Group */}
                    <div className="grid grid-cols-2 gap-1 bg-white/90 p-1.5 rounded-md border border-purple-200 text-[10px]">
                      <div className="flex items-center justify-between px-1.5 py-0.5 rounded bg-purple-50 border border-purple-100">
                        <span className="font-semibold text-purple-800 truncate">🟣 Thêm mới Group:</span>
                        <span className="font-black text-purple-900 ml-1">{groupViaStatsInScope.themMoiGroup}</span>
                      </div>
                      <div className="flex items-center justify-between px-1.5 py-0.5 rounded bg-fuchsia-50 border border-fuchsia-100">
                        <span className="font-semibold text-fuchsia-800 truncate">🟣 Admin thêm Group:</span>
                        <span className="font-black text-fuchsia-900 ml-1">{groupViaStatsInScope.adminThemGroup}</span>
                      </div>
                      <div className="flex items-center justify-between px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100">
                        <span className="font-semibold text-indigo-800 truncate">🔵 Có Group từ đầu:</span>
                        <span className="font-black text-indigo-900 ml-1">{groupViaStatsInScope.coGroupTuDau}</span>
                      </div>
                      <div className="flex items-center justify-between px-1.5 py-0.5 rounded bg-amber-50 border border-amber-100">
                        <span className="font-semibold text-amber-800 truncate">🟠 Cần thêm Group:</span>
                        <span className="font-black text-amber-900 ml-1">{groupViaStatsInScope.canThemGroup}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setModalForm((prev) => ({
                            ...prev,
                            pageUpdateStatus: 'pending',
                            note: 'Thêm mới để thêm Group',
                          }))
                        }
                        className={`px-2 py-1 rounded text-[11px] font-bold border transition-all cursor-pointer inline-flex items-center gap-1 ${
                          modalForm.note.toLowerCase().includes('thêm mới để thêm group')
                            ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
                            : 'bg-white text-purple-900 border-purple-300 hover:bg-purple-100'
                        }`}
                      >
                        <span>🟣 Thêm mới để thêm Group</span>
                        <span
                          className={`px-1 py-0.2 rounded-full text-[9px] font-extrabold ${
                            modalForm.note.toLowerCase().includes('thêm mới để thêm group')
                              ? 'bg-purple-800 text-purple-100'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {groupViaStatsInScope.themMoiGroup}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setModalForm((prev) => ({
                            ...prev,
                            pageUpdateStatus: 'pending',
                            note: 'Admin đã thêm Group',
                          }))
                        }
                        className={`px-2 py-1 rounded text-[11px] font-bold border transition-all cursor-pointer inline-flex items-center gap-1 ${
                          modalForm.note.toLowerCase().includes('admin đã thêm group')
                            ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
                            : 'bg-white text-purple-900 border-purple-300 hover:bg-purple-100'
                        }`}
                      >
                        <span>🟣 Admin đã thêm Group</span>
                        <span
                          className={`px-1 py-0.2 rounded-full text-[9px] font-extrabold ${
                            modalForm.note.toLowerCase().includes('admin đã thêm group')
                              ? 'bg-purple-800 text-purple-100'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {groupViaStatsInScope.adminThemGroup}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setModalForm((prev) => ({
                            ...prev,
                            pageUpdateStatus: 'updated',
                            note: 'Có Group từ đầu',
                          }))
                        }
                        className={`px-2 py-1 rounded text-[11px] font-bold border transition-all cursor-pointer inline-flex items-center gap-1 ${
                          modalForm.note.toLowerCase().includes('có group từ đầu')
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                            : 'bg-white text-indigo-800 border-indigo-300 hover:bg-indigo-100'
                        }`}
                      >
                        <span>🔵 Có Group từ đầu</span>
                        <span
                          className={`px-1 py-0.2 rounded-full text-[9px] font-extrabold ${
                            modalForm.note.toLowerCase().includes('có group từ đầu')
                              ? 'bg-indigo-800 text-indigo-100'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {groupViaStatsInScope.coGroupTuDau}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setModalForm((prev) => ({
                            ...prev,
                            pageUpdateStatus: 'pending',
                            note: 'Cần thêm Group',
                          }))
                        }
                        className={`px-2 py-1 rounded text-[11px] font-bold border transition-all cursor-pointer inline-flex items-center gap-1 ${
                          modalForm.note.toLowerCase().includes('cần thêm group')
                            ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                            : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-100'
                        }`}
                      >
                        <span>🟠 Cần thêm Group</span>
                        <span
                          className={`px-1 py-0.2 rounded-full text-[9px] font-extrabold ${
                            modalForm.note.toLowerCase().includes('cần thêm group')
                              ? 'bg-amber-800 text-amber-100'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {groupViaStatsInScope.canThemGroup}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
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

          {/* Nút XÓA TOÀN BỘ VIA ĐÃ CHỌN - Nổi bật màu đỏ */}
          <button
            type="button"
            id="btn-bulk-delete-float"
            onClick={handlePromptBulkDelete}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white rounded-xl font-black shadow-lg transition-all cursor-pointer shrink-0 border border-rose-500 ring-2 ring-rose-400/40"
            title="Xóa toàn bộ các nick Via đã chọn khỏi hệ thống"
          >
            <Trash2 className="w-3.5 h-3.5 text-white" />
            <span>Xóa Toàn Bộ {selectedCount} Via Đã Chọn</span>
          </button>

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

          {/* Quick Chuyển Via + Page sang NV khác hoặc Kho Chờ Admin batch in floating pill */}
          {currentUser.role === 'admin' && (
            <div className="flex items-center space-x-1.5 pl-1 border-l border-slate-700 shrink-0">
              {!isAdminWaitingPool(selectedStaffFilter) && (
                <button
                  type="button"
                  onClick={() => handleBatchTransferViasToStaff(ADMIN_WAITING_POOL)}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-xl font-extrabold shadow-md transition-all cursor-pointer shrink-0"
                  title="Đưa toàn bộ các Via đang chọn kèm Page vào Kho Chờ Admin (Chưa nhân viên nào dùng)"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>📦 Cất Vào Kho Chờ</span>
                </button>
              )}
              <select
                onChange={(e) => {
                  if (!e.target.value) return;
                  handleBatchTransferViasToStaff(e.target.value);
                  e.target.value = '';
                }}
                defaultValue=""
                className="bg-emerald-700 hover:bg-emerald-600 border border-emerald-400 text-white text-xs font-extrabold rounded-xl px-2.5 py-1.5 focus:outline-hidden cursor-pointer shadow-md"
                title="Chuyển các Via đang chọn kèm toàn bộ Fanpage của Via đó sang nhân viên khác hoặc vào Kho Chờ Admin"
              >
                <option value="" disabled>
                  👤 Giao {selectedCount} Via + Page cho NV...
                </option>
                <option value={ADMIN_WAITING_POOL} className="bg-slate-900 text-amber-300 font-bold">
                  📦 Đưa vào: {ADMIN_WAITING_POOL}
                </option>
                {distinctStaffNames.map((name) => (
                  <option key={name} value={name} className="bg-slate-900 text-white font-bold">
                    → Giao cho NV: {name}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              <option value="282">🟠 282</option>
              <option value="956">🟣 956</option>
              <option value="Hạn Chế">🟡 Hạn Chế</option>
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

      {/* Modal Xác Nhận Xóa Via (Đơn Lẻ Hoặc Hàng Loạt) - Hỏi Xóa Luôn Group Và Page Liên Quan */}
      {isConfirmDeleteModalOpen && (() => {
        const targetVias = pendingDeleteVia ? [pendingDeleteVia] : getSelectedViasForDelete();
        const targetUidSet = new Set(targetVias.map((v) => normalizeUidKey(v.uid)).filter(Boolean));
        const linkedPages = allRecords.filter((r) => {
          const rUid = normalizeUidKey(r.viaUid) || normalizeUidKey(r.fullVia);
          return Boolean(rUid && targetUidSet.has(rUid));
        });
        const linkedGroups = (allGroupRecords || []).filter((g) => {
          const gUid = normalizeUidKey(g.uid);
          return Boolean(gUid && targetUidSet.has(gUid));
        });
        const isDeletingAllRelated =
          deletePageAction === 'delete_pages' && deleteGroupAction === 'delete_groups';
        const isKeepingAllRelated =
          deletePageAction === 'keep' && deleteGroupAction === 'keep';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto max-h-[92vh] flex flex-col">
              {/* Modal Header */}
              <div className="px-5 py-4 bg-gradient-to-r from-rose-700 via-rose-600 to-red-700 text-white flex items-center justify-between shadow-xs shrink-0">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Trash2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm tracking-tight">
                      {pendingDeleteVia
                        ? `Xác Nhận Xóa Vĩnh Viễn Via UID ${pendingDeleteVia.uid}`
                        : `Xác Nhận Xóa Toàn Bộ (${targetVias.length}) Via Đã Chọn`}
                    </h3>
                    <p className="text-[11px] text-rose-100 font-medium">
                      Tùy chọn xóa luôn Fanpage (Bảng 1) & Group (Bảng 2) liên quan với Via
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!isDeletingBatch) {
                      setIsConfirmDeleteModalOpen(false);
                      setPendingDeleteVia(null);
                    }
                  }}
                  disabled={isDeletingBatch}
                  className="p-1 rounded-lg text-rose-200 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4 text-xs overflow-y-auto">
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-950 flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-extrabold text-sm text-rose-900">
                      Bạn đang chuẩn bị xóa vĩnh viễn {targetVias.length} tài khoản nick Via!
                    </p>
                    <p className="text-xs text-rose-800 leading-relaxed">
                      Toàn bộ thông tin UID, Mật khẩu (PASS), mã 2FA, ghi chú sẽ bị xóa khỏi Kho Via. Bạn có thể chọn <strong>xóa luôn các Fanpage và Group liên quan</strong> hoặc giữ lại bên dưới.
                    </p>
                  </div>
                </div>

                {/* Danh sách các UID chuẩn bị xóa */}
                <div>
                  <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                    <label className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-slate-500" />
                      <span>Danh sách Nick UID sẽ bị xóa ({targetVias.length}):</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300">
                        📗 {linkedPages.length} Fanpage liên quan
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-900 border border-purple-300">
                        🟣 {linkedGroups.length} dòng Group liên quan
                      </span>
                    </div>
                  </div>
                  <div className="max-h-32 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 space-y-1 divide-y divide-slate-200/60 font-mono text-xs">
                    {targetVias.map((via, idx) => {
                      const vUid = normalizeUidKey(via.uid);
                      const pCount = (vUid && (pagesPerViaUid.get(vUid) || []).length) || 0;
                      const gCount = (vUid && (groupsPerViaUid.get(vUid) || []).length) || 0;
                      return (
                        <div key={via.id} className="pt-1 first:pt-0 flex items-center justify-between text-[11px] gap-2">
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="text-slate-400 w-5 text-right font-sans shrink-0">{idx + 1}.</span>
                            <span className="font-bold text-slate-900 truncate">{via.uid}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-sm bg-indigo-100 text-indigo-800 font-sans font-semibold shrink-0">
                              {via.staffName}
                            </span>
                            {pCount > 0 && (
                              <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 font-sans font-bold shrink-0">
                                {pCount} Page
                              </span>
                            )}
                            {gCount > 0 && (
                              <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-900 font-sans font-bold shrink-0">
                                {gCount} Group
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 truncate max-w-[140px] font-sans">
                            {via.note || via.sharedNote || (via.status === 'checkpoint' ? 'Checkpoint' : 'Live')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* KHỐI LỰA CHỌN XÓA DỮ LIỆU LIÊN QUAN: FANPAGE & GROUP */}
                <div className="p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200 pb-2.5">
                    <div>
                      <p className="font-black text-slate-900 text-xs uppercase tracking-tight">
                        ⚙️ Tùy chọn xóa dữ liệu liên quan (Fanpage & Group):
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Admin chọn xử lý các Fanpage (Bảng 1) và Group (Bảng 2) đang gắn với Via này
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setDeletePageAction('keep');
                          setDeleteGroupAction('keep');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                          isKeepingAllRelated
                            ? 'bg-slate-800 text-white border-slate-900 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        🛡️ Chỉ xóa Via
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeletePageAction('delete_pages');
                          setDeleteGroupAction('delete_groups');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition-all cursor-pointer ${
                          isDeletingAllRelated
                            ? 'bg-rose-600 text-white border-rose-700 shadow-2xs ring-2 ring-rose-300'
                            : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                        }`}
                      >
                        🔥 Chọn xóa tất cả (Via + Page + Group)
                      </button>
                    </div>
                  </div>

                  {/* 1. Tùy chọn xử lý Fanpage (Bảng 1) */}
                  <div className="p-3 bg-white border border-emerald-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className="font-extrabold text-emerald-950 text-xs flex items-center gap-1.5">
                        <span>📗 1. Fanpage liên kết (Bảng 1 - Quản Lý Fanpage):</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        linkedPages.length > 0
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {linkedPages.length > 0
                          ? `Có ${linkedPages.length} Fanpage (${linkedPages.slice(0, 2).map((p) => p.pageName).join(', ')}${linkedPages.length > 2 ? '...' : ''})`
                          : '0 Fanpage liên kết'}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="flex items-start space-x-2 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200">
                        <input
                          type="radio"
                          name="deletePageAction"
                          checked={deletePageAction === 'keep'}
                          onChange={() => setDeletePageAction('keep')}
                          className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <span className="font-bold text-slate-800 block">
                            Giữ nguyên các Fanpage bên Bảng 1
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Chỉ xóa Via khỏi Kho Via, không xóa các Fanpage đang hiển thị ở Bảng Quản Lý Page.
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start space-x-2 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200">
                        <input
                          type="radio"
                          name="deletePageAction"
                          checked={deletePageAction === 'unlink'}
                          onChange={() => setDeletePageAction('unlink')}
                          className="mt-0.5 text-amber-600 focus:ring-amber-500"
                        />
                        <div>
                          <span className="font-bold text-slate-800 block">
                            Gỡ mã UID này khỏi {linkedPages.length} Fanpage (Giữ lại Page trống Via)
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Làm trống cột Via Cầm trên các Fanpage đang liên kết để Admin gán Via mới sau.
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start space-x-2 cursor-pointer p-1.5 rounded-lg hover:bg-rose-50/70 border border-transparent hover:border-rose-200">
                        <input
                          type="radio"
                          name="deletePageAction"
                          checked={deletePageAction === 'delete_pages'}
                          onChange={() => setDeletePageAction('delete_pages')}
                          className="mt-0.5 text-rose-600 focus:ring-rose-500"
                        />
                        <div>
                          <span className="font-extrabold text-rose-700 block">
                            🗑️ Xóa luôn {linkedPages.length > 0 ? `${linkedPages.length} ` : ''}Fanpage liên quan khỏi Bảng 1
                          </span>
                          <span className="text-[11px] text-rose-600">
                            Xóa vĩnh viễn toàn bộ các Fanpage đang gắn với UID này khỏi hệ thống.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* 2. Tùy chọn xử lý Group (Bảng 2) */}
                  <div className="p-3 bg-white border border-purple-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className="font-extrabold text-purple-950 text-xs flex items-center gap-1.5">
                        <span>🟣 2. Group liên kết (Bảng 2 - Quản Lý Group):</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        linkedGroups.length > 0
                          ? 'bg-purple-100 text-purple-900 border border-purple-300'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {linkedGroups.length > 0
                          ? `Có ${linkedGroups.length} dòng Group (${linkedGroups.slice(0, 2).map((g) => g.viaName || `${g.groupCount} nhóm`).join(', ')}${linkedGroups.length > 2 ? '...' : ''})`
                          : '0 dòng Group liên kết'}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="flex items-start space-x-2 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200">
                        <input
                          type="radio"
                          name="deleteGroupAction"
                          checked={deleteGroupAction === 'keep'}
                          onChange={() => setDeleteGroupAction('keep')}
                          className="mt-0.5 text-purple-600 focus:ring-purple-500"
                        />
                        <div>
                          <span className="font-bold text-slate-800 block">
                            Giữ nguyên các dòng Group bên Bảng 2
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Chỉ xóa Via khỏi Kho Via, giữ nguyên dữ liệu của UID này trong Bảng Quản Lý Group.
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start space-x-2 cursor-pointer p-1.5 rounded-lg hover:bg-rose-50/70 border border-transparent hover:border-rose-200">
                        <input
                          type="radio"
                          name="deleteGroupAction"
                          checked={deleteGroupAction === 'delete_groups'}
                          onChange={() => setDeleteGroupAction('delete_groups')}
                          className="mt-0.5 text-rose-600 focus:ring-rose-500"
                        />
                        <div>
                          <span className="font-extrabold text-rose-700 block">
                            🗑️ Xóa luôn {linkedGroups.length > 0 ? `${linkedGroups.length} ` : ''}dòng Group liên quan khỏi Bảng 2
                          </span>
                          <span className="text-[11px] text-rose-600">
                            Xóa vĩnh viễn toàn bộ các dòng Group đang gắn với UID này trong Bảng Quản Lý Group.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2 shrink-0">
                <div className="text-[11px] font-bold text-slate-600">
                  Sẽ xóa:{' '}
                  <span className="text-rose-700 font-black">
                    {targetVias.length} Via
                    {deletePageAction === 'delete_pages' ? ` + ${linkedPages.length} Fanpage` : ''}
                    {deleteGroupAction === 'delete_groups' ? ` + ${linkedGroups.length} dòng Group` : ''}
                  </span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsConfirmDeleteModalOpen(false);
                      setPendingDeleteVia(null);
                    }}
                    disabled={isDeletingBatch}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Hủy Bỏ
                  </button>
                  <button
                    type="button"
                    id="btn-confirm-execute-bulk-delete"
                    onClick={handleConfirmBulkDelete}
                    disabled={isDeletingBatch}
                    className="px-4 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-xl shadow-md transition-all cursor-pointer flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeletingBatch ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Đang Xóa Dữ Liệu...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5 text-white" />
                        <span>
                          Xác Nhận Xóa ({targetVias.length} Via
                          {deletePageAction === 'delete_pages' ? ` + ${linkedPages.length} Page` : ''}
                          {deleteGroupAction === 'delete_groups' ? ` + ${linkedGroups.length} Group` : ''})
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
};
