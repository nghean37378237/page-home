import React, { useState, useMemo } from 'react';
import {
  UserAccount,
  PageRecord,
  FullViaItem,
  GroupRecord,
  AppUser,
  TabKey,
  ALL_TAB_KEYS,
  TAB_DEFINITIONS,
} from '../types';
import {
  Users,
  UserPlus,
  Key,
  Shield,
  Search,
  Copy,
  Check,
  Eye,
  EyeOff,
  Trash2,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Edit2,
  RefreshCw,
  FileSpreadsheet,
  KeyRound,
  Sparkles,
  X,
  User,
  UserCheck,
  ShieldAlert,
  FolderOpen,
  SlidersHorizontal,
  Settings,
  Layers,
  Network,
  Globe,
  ChevronDown,
  ChevronUp,
  Filter,
  BadgeCheck,
  BarChart3,
  Bot,
  PenTool,
  TrendingUp,
  PieChart,
  ArrowUpDown,
} from 'lucide-react';

interface StaffManagementTableProps {
  currentUser: AppUser;
  accounts: UserAccount[];
  records: PageRecord[];
  viaList: FullViaItem[];
  groupRecords?: GroupRecord[];
  adminPin: string;
  adminName?: string;
  adminEmail?: string;
  requireGoogleOnly?: boolean;
  onChangeAdminProfile?: (newPin: string, newName?: string, newEmail?: string) => Promise<void> | void;
  onToggleRequireGoogleOnly?: (enabled: boolean) => Promise<void> | void;
  onAddStaff: (username: string, pin: string, adminNote?: string, email?: string, allowedTabs?: TabKey[]) => Promise<void> | void;
  onUpdatePin: (accountId: string, newPin: string) => Promise<void> | void;
  onBlockAccount: (accountId: string) => Promise<void> | void;
  onUnblockAccount: (accountId: string) => Promise<void> | void;
  onDeleteAccount: (accountId: string, options?: { deletePosts?: boolean; deleteVias?: boolean }) => Promise<void> | void;
  onApproveAccount: (accountId: string) => Promise<void> | void;
  onRejectAccount: (accountId: string) => Promise<void> | void;
  onUpdateAccountPermissions?: (accountId: string, allowedTabs: TabKey[]) => Promise<void> | void;
  onSwitchToStaffView?: (staffName: string) => void;
  onOpenAdminModal?: (tab?: 'staff' | 'pending' | 'blocked' | 'admin_pin' | 'security_db') => void;
  onOpenDeleteStaffModal?: (staffName?: string) => void;
}

export const StaffManagementTable: React.FC<StaffManagementTableProps> = ({
  currentUser,
  accounts,
  records,
  viaList,
  groupRecords = [],
  adminPin,
  adminName = 'Quản Lý (Admin)',
  adminEmail = 'myphuong2295@gmail.com',
  requireGoogleOnly = true,
  onChangeAdminProfile,
  onToggleRequireGoogleOnly,
  onAddStaff,
  onUpdatePin,
  onBlockAccount,
  onUnblockAccount,
  onDeleteAccount,
  onApproveAccount,
  onRejectAccount,
  onUpdateAccountPermissions,
  onSwitchToStaffView,
  onOpenAdminModal,
  onOpenDeleteStaffModal,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const myStaffNameLower = (currentUser.name || '').trim().toLowerCase();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'blocked'>('all');
  const [visiblePins, setVisiblePins] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Table Permissions Modal State (Admin only)
  const [permissionModalAccount, setPermissionModalAccount] = useState<UserAccount | null>(null);
  const [selectedAllowedTabs, setSelectedAllowedTabs] = useState<TabKey[]>(ALL_TAB_KEYS);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState<{ success: boolean; message: string } | null>(null);

  // Add staff modal state (Admin only)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPin, setAddPin] = useState('123456');
  const [addEmail, setAddEmail] = useState('');
  const [addNote, setAddNote] = useState('');
  const [addAllowedTabs, setAddAllowedTabs] = useState<TabKey[]>(['fanpage', 'fullvia', 'staff_management']);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // State nhập nhanh nhân viên mới trực tiếp trên giao diện (khoa học, không bị che)
  const [quickStaffName, setQuickStaffName] = useState('');
  const [quickStaffPin, setQuickStaffPin] = useState('123456');
  const [quickStaffNote, setQuickStaffNote] = useState('');
  const [isMasterAdminExpanded, setIsMasterAdminExpanded] = useState(false);
  // State hiển thị phần đếm thống kê Đăng Tay vs Tool
  const [isPostingStatsExpanded, setIsPostingStatsExpanded] = useState(true);
  const [postingStatsSearch, setPostingStatsSearch] = useState('');
  const [postingStatsFilter, setPostingStatsFilter] = useState<'all' | 'has_manual' | 'has_tool' | 'completed' | 'incomplete'>('all');
  const [postingStatsSort, setPostingStatsSort] = useState<'total_desc' | 'manual_desc' | 'tool_desc' | 'manual_ratio_desc' | 'tool_ratio_desc' | 'completion_desc' | 'name_asc'>('total_desc');
  // Modal xem chi tiết danh sách Fanpage của 1 nhân viên cụ thể
  const [inspectStaffModal, setInspectStaffModal] = useState<{
    staffName: string;
    tab: 'all' | 'manual' | 'tool' | 'timer';
  } | null>(null);
  const [inspectPageSearch, setInspectPageSearch] = useState('');

  // Change PIN modal state (both Admin and Staff for their own account)
  const [pinModalAccount, setPinModalAccount] = useState<UserAccount | null>(null);
  const [newPinValue, setNewPinValue] = useState('');
  const [confirmPinValue, setConfirmPinValue] = useState('');
  const [pinChangeError, setPinChangeError] = useState<string | null>(null);
  const [pinChangeSuccess, setPinChangeSuccess] = useState<string | null>(null);
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);

  // Delete modal state (Admin only)
  const [deleteAccountTarget, setDeleteAccountTarget] = useState<UserAccount | null>(null);
  const [deletePostsOption, setDeletePostsOption] = useState(false);
  const [deleteViasOption, setDeleteViasOption] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Admin Profile & Master PIN state (Admin only)
  const [isAdminProfileModalOpen, setIsAdminProfileModalOpen] = useState(false);
  const [editAdminPin, setEditAdminPin] = useState(adminPin);
  const [editAdminName, setEditAdminName] = useState(adminName);
  const [editAdminEmail, setEditAdminEmail] = useState(adminEmail);
  const [showAdminPinInBanner, setShowAdminPinInBanner] = useState(false);
  const [showAdminPinInModal, setShowAdminPinInModal] = useState(false);
  const [isSubmittingAdminProfile, setIsSubmittingAdminProfile] = useState(false);
  const [adminProfileSuccess, setAdminProfileSuccess] = useState(false);

  // SCIPING: Admin sees all staff accounts.
  // When currentUser is a staff member, they ONLY see their own account!
  const staffAccounts = useMemo(() => {
    if (isAdmin) {
      return accounts.filter((a) => a.role === 'staff');
    }
    // Staff member sees ONLY their own account
    const matched = accounts.filter(
      (a) => a.role === 'staff' && a.username.trim().toLowerCase() === myStaffNameLower
    );
    if (matched.length > 0) return matched;

    // Fallback: create virtual object if not found in live accounts
    return [
      {
        id: currentUser.id || 'my-staff-account',
        username: currentUser.name,
        email: currentUser.email || '',
        role: 'staff',
        status: 'approved',
        pin: '123456',
        createdAt: 'Hệ thống',
        adminNote: 'Tài khoản nhân viên chính thức',
      } as UserAccount,
    ];
  }, [accounts, isAdmin, myStaffNameLower, currentUser]);

  // Current staff's personal account for quick view
  const myCurrentAccount = useMemo(() => {
    return staffAccounts.find(
      (a) => a.username.trim().toLowerCase() === myStaffNameLower
    ) || staffAccounts[0] || null;
  }, [staffAccounts, myStaffNameLower]);

  // Personal work statistics for current employee
  const myWorkStats = useMemo(() => {
    const myPages = records.filter(
      (r) => (r.staffName || '').trim().toLowerCase() === myStaffNameLower
    );
    const pagesCount = myPages.length;
    const manualPages = myPages.filter((r) => r.postingMethod === 'Đăng Tay').length;
    const toolPages = myPages.filter((r) => r.postingMethod === 'Tool').length;
    const manualActualPosts = myPages.filter((r) => r.postingMethod === 'Đăng Tay').reduce((s, r) => s + (r.actualPosts || 0), 0);
    const toolActualPosts = myPages.filter((r) => r.postingMethod === 'Tool').reduce((s, r) => s + (r.actualPosts || 0), 0);
    const viasCount = viaList.filter(
      (v) => (v.staffName || '').trim().toLowerCase() === myStaffNameLower
    ).length;
    const groupsCount = groupRecords.filter(
      (g) => (g.staffName || '').trim().toLowerCase() === myStaffNameLower
    ).length;
    return { pagesCount, manualPages, toolPages, manualActualPosts, toolActualPosts, viasCount, groupsCount };
  }, [records, viaList, groupRecords, myStaffNameLower]);

  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return staffAccounts.filter((acc) => {
      // Status filter
      if (statusFilter !== 'all' && acc.status !== statusFilter) {
        return false;
      }
      // Search query
      if (q) {
        const matchName = acc.username.toLowerCase().includes(q);
        const matchEmail = acc.email?.toLowerCase().includes(q) || false;
        const matchNote = acc.adminNote?.toLowerCase().includes(q) || false;
        return matchName || matchEmail || matchNote;
      }
      return true;
    });
  }, [staffAccounts, statusFilter, searchQuery]);

  // Counts
  const counts = useMemo(() => {
    const total = staffAccounts.length;
    const active = staffAccounts.filter((a) => a.status === 'approved').length;
    const pending = staffAccounts.filter((a) => a.status === 'pending').length;
    const blocked = staffAccounts.filter((a) => a.status === 'blocked').length;
    return { total, active, pending, blocked };
  }, [staffAccounts]);

  // 4. THỐNG KÊ ĐẾM SỐ LƯỢNG ĐĂNG TAY VS ĐĂNG TOOL CỦA TỪNG NHÂN VIÊN
  const rawStaffPostingStats = useMemo(() => {
    // Thu thập tất cả nhân viên từ staffAccounts và từ danh sách records
    const staffNamesMap = new Map<string, { account?: UserAccount; username: string }>();
    staffAccounts.forEach((acc) => {
      const key = acc.username.trim().toLowerCase();
      if (key) staffNamesMap.set(key, { account: acc, username: acc.username });
    });

    records.forEach((r) => {
      const s = r.staffName?.trim();
      if (s) {
        const key = s.toLowerCase();
        if (!staffNamesMap.has(key)) {
          staffNamesMap.set(key, { username: s });
        }
      }
    });

    return Array.from(staffNamesMap.values()).map(({ account, username }) => {
      const staffNameLower = username.trim().toLowerCase();
      const staffRecords = records.filter(
        (r) => (r.staffName || '').trim().toLowerCase() === staffNameLower
      );
      const staffVias = viaList.filter(
        (v) => (v.staffName || '').trim().toLowerCase() === staffNameLower
      );

      const manualRecords = staffRecords.filter((r) => r.postingMethod === 'Đăng Tay');
      const toolRecords = staffRecords.filter((r) => r.postingMethod === 'Tool');
      const timerRecords = staffRecords.filter((r) => r.postingMethod === 'Hẹn Giờ');

      const manualPages = manualRecords.length;
      const toolPages = toolRecords.length;
      const timerPages = timerRecords.length;

      const manualActual = manualRecords.reduce((s, r) => s + (r.actualPosts || 0), 0);
      const manualTarget = manualRecords.reduce((s, r) => s + (r.targetPosts || 0), 0);

      const toolActual = toolRecords.reduce((s, r) => s + (r.actualPosts || 0), 0);
      const toolTarget = toolRecords.reduce((s, r) => s + (r.targetPosts || 0), 0);

      const timerActual = timerRecords.reduce((s, r) => s + (r.actualPosts || 0), 0);
      const timerTarget = timerRecords.reduce((s, r) => s + (r.targetPosts || 0), 0);

      const totalPages = staffRecords.length;
      const totalActual = staffRecords.reduce((s, r) => s + (r.actualPosts || 0), 0);
      const totalTarget = staffRecords.reduce((s, r) => s + (r.targetPosts || 0), 0);

      const manualRatio = totalPages > 0 ? Math.round((manualPages / totalPages) * 100) : 0;
      const toolRatio = totalPages > 0 ? Math.round((toolPages / totalPages) * 100) : 0;

      const completionRate = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : (totalPages > 0 ? 100 : 0);

      return {
        id: account?.id || `staff-${staffNameLower}`,
        username,
        account,
        role: account?.role || 'staff',
        status: account?.status || 'approved',
        totalPages,
        viasCount: staffVias.length,
        manualPages,
        manualActual,
        manualTarget,
        manualRatio,
        toolPages,
        toolActual,
        toolTarget,
        toolRatio,
        timerPages,
        timerActual,
        timerTarget,
        totalActual,
        totalTarget,
        completionRate,
        records: staffRecords,
      };
    });
  }, [staffAccounts, records, viaList]);

  // Bộ lọc & sắp xếp chuyên sâu cho bảng Thống kê Đăng Tay vs Tool
  const staffPostingStats = useMemo(() => {
    let list = [...rawStaffPostingStats];

    // Lọc theo tìm kiếm tên nhân viên
    if (postingStatsSearch.trim()) {
      const q = postingStatsSearch.trim().toLowerCase();
      list = list.filter((s) => s.username.toLowerCase().includes(q));
    }

    // Lọc theo phương thức & tiến độ
    if (postingStatsFilter === 'has_manual') {
      list = list.filter((s) => s.manualPages > 0);
    } else if (postingStatsFilter === 'has_tool') {
      list = list.filter((s) => s.toolPages > 0);
    } else if (postingStatsFilter === 'completed') {
      list = list.filter((s) => s.totalTarget > 0 && s.totalActual >= s.totalTarget);
    } else if (postingStatsFilter === 'incomplete') {
      list = list.filter((s) => s.totalTarget > 0 && s.totalActual < s.totalTarget);
    }

    // Sắp xếp linh hoạt
    list.sort((a, b) => {
      if (postingStatsSort === 'total_desc') return b.totalPages - a.totalPages;
      if (postingStatsSort === 'manual_desc') return b.manualPages - a.manualPages;
      if (postingStatsSort === 'tool_desc') return b.toolPages - a.toolPages;
      if (postingStatsSort === 'manual_ratio_desc') return b.manualRatio - a.manualRatio;
      if (postingStatsSort === 'tool_ratio_desc') return b.toolRatio - a.toolRatio;
      if (postingStatsSort === 'completion_desc') return b.completionRate - a.completionRate;
      if (postingStatsSort === 'name_asc') return a.username.localeCompare(b.username, 'vi');
      return b.totalPages - a.totalPages;
    });

    return list;
  }, [rawStaffPostingStats, postingStatsSearch, postingStatsFilter, postingStatsSort]);

  // Tổng hợp Đăng Tay vs Tool toàn đội (tính trên toàn bộ rawStaffPostingStats)
  const teamPostingSummary = useMemo(() => {
    let totalManualPages = 0;
    let totalToolPages = 0;
    let totalTimerPages = 0;
    let totalManualActual = 0;
    let totalManualTarget = 0;
    let totalToolActual = 0;
    let totalToolTarget = 0;
    let totalActualAll = 0;
    let totalTargetAll = 0;
    let totalPagesAll = 0;

    rawStaffPostingStats.forEach((s) => {
      totalManualPages += s.manualPages;
      totalToolPages += s.toolPages;
      totalTimerPages += s.timerPages;
      totalManualActual += s.manualActual;
      totalManualTarget += s.manualTarget;
      totalToolActual += s.toolActual;
      totalToolTarget += s.toolTarget;
      totalActualAll += s.totalActual;
      totalTargetAll += s.totalTarget;
      totalPagesAll += s.totalPages;
    });

    const manualRatio = totalPagesAll > 0 ? Math.round((totalManualPages / totalPagesAll) * 100) : 0;
    const toolRatio = totalPagesAll > 0 ? Math.round((totalToolPages / totalPagesAll) * 100) : 0;
    const completionRate = totalTargetAll > 0 ? Math.round((totalActualAll / totalTargetAll) * 100) : (totalPagesAll > 0 ? 100 : 0);

    return {
      totalManualPages,
      totalToolPages,
      totalTimerPages,
      totalManualActual,
      totalManualTarget,
      totalToolActual,
      totalToolTarget,
      totalActualAll,
      totalTargetAll,
      totalPagesAll,
      manualRatio,
      toolRatio,
      completionRate,
    };
  }, [rawStaffPostingStats]);

  const togglePinVisibility = (accountId: string) => {
    setVisiblePins((prev) => ({ ...prev, [accountId]: !prev[accountId] }));
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = addName.trim();
    if (!cleanName) {
      setAddError('Vui lòng nhập tên nhân viên');
      return;
    }

    const cleanPin = addPin.trim() || '123456';
    const cleanEmail = addEmail.trim() || undefined;
    const cleanNote = addNote.trim() || 'Tài khoản nhân viên được cấp quyền trực tiếp';

    setIsSubmittingAdd(true);
    setAddError(null);
    try {
      await onAddStaff(cleanName, cleanPin, cleanNote, cleanEmail, addAllowedTabs);
      setAddName('');
      setAddPin('123456');
      setAddEmail('');
      setAddNote('');
      setAddAllowedTabs(['fanpage', 'fullvia', 'staff_management']);
      setIsAddModalOpen(false);
    } catch (err: any) {
      setAddError(err.message || 'Lỗi khi thêm nhân viên');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Thêm nhanh nhân viên trực tiếp từ thanh nhập (Khoa học, thuận tiện)
  const handleQuickCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = quickStaffName.trim();
    if (!cleanName) {
      alert('Vui lòng nhập họ và tên nhân viên!');
      return;
    }
    const cleanPin = quickStaffPin.trim() || '123456';
    const cleanNote = quickStaffNote.trim() || 'Thêm nhanh từ thanh quản trị';
    setIsSubmittingAdd(true);
    try {
      await onAddStaff(cleanName, cleanPin, cleanNote, undefined, ['fanpage', 'fullvia', 'staff_management']);
      setQuickStaffName('');
      setQuickStaffPin('123456');
      setQuickStaffNote('');
    } catch (err: any) {
      alert(err.message || 'Lỗi khi thêm nhân viên');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Handlers for Table Permissions Modal
  const handleOpenPermissionModal = (account: UserAccount) => {
    setPermissionModalAccount(account);
    const existing =
      account.allowedTabs && account.allowedTabs.length > 0
        ? account.allowedTabs
        : ALL_TAB_KEYS;
    setSelectedAllowedTabs(existing);
    setPermissionNotice(null);
  };

  const handleToggleTabPermission = (tabKey: TabKey) => {
    setSelectedAllowedTabs((prev) => {
      if (prev.includes(tabKey)) {
        if (prev.length <= 1) return prev;
        return prev.filter((t) => t !== tabKey);
      } else {
        return [...prev, tabKey];
      }
    });
  };

  const handleQuickPresetTabs = (preset: 'all' | 'fanpage_only' | 'fanpage_via' | 'fanpage_group' | 'minimal') => {
    switch (preset) {
      case 'all':
        setSelectedAllowedTabs(['fanpage', 'group', 'proxy', 'fullvia', 'shared_accounts', 'staff_info']);
        break;
      case 'fanpage_only':
        setSelectedAllowedTabs(['fanpage']);
        break;
      case 'fanpage_via':
        setSelectedAllowedTabs(['fanpage', 'fullvia']);
        break;
      case 'fanpage_group':
        setSelectedAllowedTabs(['fanpage', 'group']);
        break;
      case 'minimal':
        setSelectedAllowedTabs(['fanpage']);
        break;
    }
  };

  const handleSavePermissions = async () => {
    if (!permissionModalAccount) return;
    setIsSavingPermissions(true);
    setPermissionNotice(null);
    try {
      if (onUpdateAccountPermissions) {
        await onUpdateAccountPermissions(permissionModalAccount.id, selectedAllowedTabs);
      }
      setPermissionNotice({
        success: true,
        message: `Đã cập nhật phân quyền (${selectedAllowedTabs.length} bảng) cho "${permissionModalAccount.username}" thành công!`,
      });
      setTimeout(() => {
        setPermissionModalAccount(null);
      }, 900);
    } catch (err: any) {
      setPermissionNotice({
        success: false,
        message: err.message || 'Lỗi khi lưu phân quyền',
      });
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinModalAccount) return;
    const cleanPin = newPinValue.trim();
    if (!cleanPin) return;

    setIsSubmittingPin(true);
    try {
      await onUpdatePin(pinModalAccount.id, cleanPin);
      setPinModalAccount(null);
      setNewPinValue('');
    } catch (err) {
      console.error('Lỗi khi đổi PIN:', err);
    } finally {
      setIsSubmittingPin(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteAccountTarget) return;
    setIsDeleting(true);
    try {
      await onDeleteAccount(deleteAccountTarget.id, {
        deletePosts: deletePostsOption,
        deleteVias: deleteViasOption,
      });
      setDeleteAccountTarget(null);
    } catch (err) {
      console.error('Lỗi khi xóa nhân viên:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveAdminProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = editAdminPin.trim();
    if (!cleanPin) return;

    setIsSubmittingAdminProfile(true);
    try {
      if (onChangeAdminProfile) {
        await onChangeAdminProfile(cleanPin, editAdminName.trim(), editAdminEmail.trim());
      }
      setAdminProfileSuccess(true);
      setTimeout(() => {
        setAdminProfileSuccess(false);
        setIsAdminProfileModalOpen(false);
      }, 1400);
    } catch (err) {
      console.error('Lỗi khi đổi thông tin Admin:', err);
    } finally {
      setIsSubmittingAdminProfile(false);
    }
  };

  return (
    <div className="max-w-[1700px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {isAdmin ? (
        <>
          {/* 1. HEADER & HUB ĐIỀU KHIỂN CHÍNH */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-3 mb-1.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                    <span>Bảng 5: Quản Trị Nhân Viên & Phân Quyền</span>
                    <span className="text-xs font-black text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300 flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-amber-700" />
                      <span>Chỉ Admin</span>
                    </span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Cloud Firestore Realtime
                    </span>
                  </h1>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Hệ thống quản lý nhân sự tập trung: Cấp mã PIN, phân quyền truy cập Bảng 1..6, kiểm soát tài khoản và bảo mật Google SSO.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                id="btn-add-staff-top"
                onClick={() => {
                  setAddName('');
                  setAddPin('123456');
                  setAddEmail('');
                  setAddNote('');
                  setAddError(null);
                  setIsAddModalOpen(true);
                }}
                className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer hover:scale-[1.02]"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Thêm Nhân Viên Mới</span>
              </button>

              <button
                type="button"
                id="btn-toggle-master-admin-bar"
                onClick={() => setIsMasterAdminExpanded(!isMasterAdminExpanded)}
                className={`inline-flex items-center space-x-1.5 px-3 py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  isMasterAdminExpanded
                    ? 'bg-slate-900 text-amber-300 border-slate-700 shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
                title="Hiện/Ẩn thanh thông tin bảo mật Master Admin"
              >
                <KeyRound className="w-4 h-4 text-amber-500" />
                <span>Bảo Mật Admin</span>
                {isMasterAdminExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {onOpenDeleteStaffModal && (
                <button
                  type="button"
                  id="btn-delete-staff-data-top"
                  onClick={() => onOpenDeleteStaffModal()}
                  className="inline-flex items-center space-x-1.5 px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-colors cursor-pointer"
                  title="Chọn xóa toàn bộ dữ liệu của 1 nhân viên bất kỳ"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Xóa Dữ Liệu 1 NV</span>
                </button>
              )}

              {onOpenAdminModal && (
                <button
                  type="button"
                  id="btn-open-advanced-security"
                  onClick={() => onOpenAdminModal('security_db')}
                  className="inline-flex items-center space-x-1.5 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5 text-indigo-600" />
                  <span>CSDL Cloud</span>
                </button>
              )}
            </div>
          </div>

          {/* 2. DẢI BẢO MẬT MASTER ADMIN & QUẢN TRỊ TỐI CAO (GỌN GÀNG, ĐẲNG CẤP) */}
          {isMasterAdminExpanded && (
            <div className="bg-gradient-to-r from-slate-900 via-[#0e1c36] to-slate-900 border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-lg text-white animate-fadeIn">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-black uppercase tracking-wider">
                      <Shield className="w-3 h-3 text-amber-400" />
                      <span>Master Admin</span>
                    </span>
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                      <Lock className="w-3 h-3 text-emerald-400" />
                      <span>Bảo Vệ Đang BẬT</span>
                    </span>
                    <span
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                        requireGoogleOnly
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      <span>Google SSO: {requireGoogleOnly ? 'Bắt buộc' : 'Linh hoạt'}</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 pt-0.5 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Tên Quản Trị:</span>
                      <span className="font-bold text-white text-xs">{adminName}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] block">Email Admin:</span>
                      <span className="font-mono text-sky-300 text-xs font-semibold">{adminEmail}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] block">Mật Khẩu Master PIN:</span>
                      <div className="flex items-center space-x-1.5 mt-0.5">
                        <span className="font-mono font-bold text-amber-300 bg-black/50 px-2 py-0.5 rounded border border-slate-700 text-xs">
                          {showAdminPinInBanner ? adminPin : '••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAdminPinInBanner(!showAdminPinInBanner)}
                          className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title={showAdminPinInBanner ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        >
                          {showAdminPinInBanner ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(adminPin, 'admin-master-pin')}
                          className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="Sao chép mật khẩu"
                        >
                          {copiedKey === 'admin-master-pin' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {onToggleRequireGoogleOnly && (
                    <button
                      type="button"
                      id="btn-toggle-google-only"
                      onClick={() => onToggleRequireGoogleOnly(!requireGoogleOnly)}
                      className={`inline-flex items-center space-x-1 px-3 py-2 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer ${
                        requireGoogleOnly
                          ? 'bg-sky-600 hover:bg-sky-500 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5 text-sky-300" />
                      <span>Google SSO: {requireGoogleOnly ? 'Bắt Buộc' : 'Tùy Chọn'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    id="btn-edit-admin-profile"
                    onClick={() => {
                      setEditAdminPin(adminPin);
                      setEditAdminName(adminName);
                      setEditAdminEmail(adminEmail);
                      setIsAdminProfileModalOpen(true);
                    }}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-slate-950" />
                    <span>Đổi Mật Khẩu Admin</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. DÀN THỐNG KÊ NHÂN SỰ KHOA HỌC (CLICK ĐỂ LỌC TRỰC TIẾP) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div
              onClick={() => setStatusFilter('all')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">Tổng Nhân Sự</span>
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${statusFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'}`}>
                  <Users className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">{counts.total}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Tất cả nhân sự trong hệ thống</div>
            </div>

            <div
              onClick={() => setStatusFilter('approved')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                statusFilter === 'approved'
                  ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800">Đang Hoạt Động</span>
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${statusFilter === 'approved' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-emerald-700 mt-2">{counts.active}</div>
              <div className="text-[11px] text-emerald-700/80 mt-0.5">Đã duyệt & đang làm việc</div>
            </div>

            <div
              onClick={() => setStatusFilter('pending')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800">Chờ Phê Duyệt</span>
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${statusFilter === 'pending' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-600'}`}>
                  <Clock className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-amber-700 mt-2">{counts.pending}</div>
              <div className="text-[11px] text-amber-700/80 mt-0.5">Cần Admin xét duyệt vào app</div>
            </div>

            <div
              onClick={() => setStatusFilter('blocked')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                statusFilter === 'blocked'
                  ? 'bg-rose-50/90 border-rose-400 ring-2 ring-rose-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-800">Tạm Khóa Quyền</span>
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${statusFilter === 'blocked' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-600'}`}>
                  <Lock className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-rose-700 mt-2">{counts.blocked}</div>
              <div className="text-[11px] text-rose-700/80 mt-0.5">Không thể đăng nhập vào hệ thống</div>
            </div>
          </div>

          {/* 4. THANH THÊM NHANH NHÂN VIÊN MỚI (TRỰC TIẾP, NỔI BẬT, KHÔNG BỊ CHE) */}
          <form
            onSubmit={handleQuickCreateStaff}
            className="p-4 bg-gradient-to-r from-blue-50/90 via-indigo-50/80 to-sky-50/90 border-2 border-blue-400 rounded-2xl flex flex-col md:flex-row md:items-center gap-3 shadow-2xs"
          >
            <div className="flex items-center space-x-2.5 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-black text-blue-950 uppercase tracking-wide block">
                  Thêm Nhanh Nhân Viên Mới:
                </span>
                <span className="text-[11px] text-blue-700 font-semibold">
                  Tạo tài khoản và lưu tức thì lên Cloud
                </span>
              </div>
            </div>

            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="👉 Nhập họ và tên nhân viên (VD: Hoàng Long, Thu Hà...)"
                value={quickStaffName}
                onChange={(e) => setQuickStaffName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border-2 border-blue-500 rounded-xl text-xs font-black text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:ring-2 focus:ring-blue-600 focus:outline-hidden shadow-xs"
              />
            </div>

            <div className="w-28 shrink-0">
              <input
                type="text"
                placeholder="PIN: 123456"
                value={quickStaffPin}
                onChange={(e) => setQuickStaffPin(e.target.value)}
                title="Mã PIN đăng nhập (mặc định: 123456)"
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 text-center"
              />
            </div>

            <div className="flex-1 min-w-[170px] hidden lg:block">
              <input
                type="text"
                placeholder="Ghi chú phân công (tùy chọn)..."
                value={quickStaffNote}
                onChange={(e) => setQuickStaffNote(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="submit"
                disabled={isSubmittingAdd}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer hover:scale-[1.02] flex items-center justify-center space-x-1.5 disabled:opacity-60"
              >
                {isSubmittingAdd ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                <span>+ Thêm Ngay</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAddName(quickStaffName);
                  setAddPin(quickStaffPin);
                  setAddNote(quickStaffNote);
                  setIsAddModalOpen(true);
                }}
                className="px-3 py-2.5 bg-white hover:bg-slate-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-300 transition-colors cursor-pointer"
                title="Mở form nâng cao có chọn phân quyền bảng 1..6"
              >
                <span>Phân Quyền Chi Tiết...</span>
              </button>
            </div>
          </form>

          {/* 5. THANH TÌM KIẾM & BỘ LỌC TRẠNG THÁI */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                id="input-search-staff-table"
                placeholder="Tìm theo tên nhân viên, email, ghi chú..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Xóa tìm kiếm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
              <span className="text-[11px] text-slate-400 hidden md:inline">
                Hiển thị: <strong className="text-slate-700 font-bold">{filteredStaff.length}</strong>/{counts.total} nhân viên
              </span>
              <div className="flex items-center space-x-1 text-xs font-semibold bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tất cả ({counts.total})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('approved')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    statusFilter === 'approved' ? 'bg-emerald-600 text-white shadow-2xs font-bold' : 'text-slate-600 hover:text-emerald-700'
                  }`}
                >
                  Hoạt động ({counts.active})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('pending')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    statusFilter === 'pending' ? 'bg-amber-500 text-white shadow-2xs font-bold' : 'text-slate-600 hover:text-amber-700'
                  }`}
                >
                  Chờ duyệt ({counts.pending})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('blocked')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    statusFilter === 'blocked' ? 'bg-rose-600 text-white shadow-2xs font-bold' : 'text-slate-600 hover:text-rose-700'
                  }`}
                >
                  Tạm khóa ({counts.blocked})
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* CHẾ ĐỘ NHÂN VIÊN: NHÂN VIÊN NÀO THẤY NHÂN VIÊN ĐÓ */
        <div className="space-y-6">
          {/* Staff Top Banner */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md font-black text-lg">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Tài Khoản & Mật Khẩu Cá Nhân
                  </h1>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 flex items-center space-x-1">
                    <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Nhân Viên: {currentUser.name}</span>
                  </span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Đang Hoạt Động</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  🔒 Phân quyền bảo mật: Bạn chỉ xem và quản lý thông tin tài khoản của riêng mình ({currentUser.name}). Dữ liệu nhân viên khác được bảo vệ tuyệt mật.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {myCurrentAccount && (
                <button
                  type="button"
                  id="btn-staff-change-pin-top"
                  onClick={() => {
                    setPinModalAccount(myCurrentAccount);
                    setNewPinValue(myCurrentAccount.pin || '123456');
                    setConfirmPinValue(myCurrentAccount.pin || '123456');
                    setPinChangeError(null);
                    setPinChangeSuccess(null);
                  }}
                  className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Đổi Mật Khẩu / PIN Của Tôi</span>
                </button>
              )}
            </div>
          </div>

          {/* Personal Account Information Card */}
          {myCurrentAccount && (
            <div className="bg-gradient-to-br from-slate-900 via-[#0d1b33] to-slate-900 border border-slate-700/80 rounded-2xl p-6 text-white shadow-xl">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                {/* Account info & Password */}
                <div className="space-y-4 max-w-xl">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-black">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                        Thông Tin Đăng Nhập Hệ Thống
                      </div>
                      <div className="text-lg font-black text-white flex items-center gap-2">
                        <span>{myCurrentAccount.username}</span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Đã Duyệt Vào Hệ Thống
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Password / PIN Section */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-xs space-y-2">
                    <div className="text-xs text-slate-300 font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-amber-400" />
                        <span>Mã PIN / Mật Khẩu Đăng Nhập Của Bạn:</span>
                      </span>
                      <span className="text-[11px] text-slate-400 font-normal">
                        Dùng khi mở khóa ứng dụng
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <div className="flex items-center space-x-2 bg-black/40 px-3 py-1.5 rounded-lg border border-slate-700">
                        <span className="font-mono text-base font-black text-amber-300 tracking-widest">
                          {visiblePins[myCurrentAccount.id] ? myCurrentAccount.pin || '123456' : '••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePinVisibility(myCurrentAccount.id)}
                          className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title={visiblePins[myCurrentAccount.id] ? 'Ẩn mã PIN' : 'Hiện mã PIN'}
                        >
                          {visiblePins[myCurrentAccount.id] ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(myCurrentAccount.pin || '123456', `pin-${myCurrentAccount.id}`)}
                          className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="Sao chép mã PIN"
                        >
                          {copiedKey === `pin-${myCurrentAccount.id}` ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setPinModalAccount(myCurrentAccount);
                          setNewPinValue(myCurrentAccount.pin || '123456');
                          setConfirmPinValue(myCurrentAccount.pin || '123456');
                          setPinChangeError(null);
                          setPinChangeSuccess(null);
                        }}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-lg shadow-sm transition-all cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Đổi Mã PIN Ngay</span>
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-400 pt-1 flex items-center gap-2">
                      <span>Email liên kết Google:</span>
                      <span className="font-mono text-sky-300 font-semibold">
                        {myCurrentAccount.email || 'Chưa liên kết email'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3 Work counters for this employee */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-1.5">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div className="text-2xl font-black text-white">{myWorkStats.pagesCount}</div>
                    <div className="text-xs text-slate-300 font-semibold mt-0.5">Fanpage Quản Lý</div>
                    <div className="text-[10px] text-emerald-300 font-bold mt-1 bg-white/10 px-2 py-0.5 rounded-full inline-block">
                      ✍️ {myWorkStats.manualPages} Tay • 🤖 {myWorkStats.toolPages} Tool
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-1.5">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div className="text-2xl font-black text-white">{myWorkStats.viasCount}</div>
                    <div className="text-xs text-slate-300 font-semibold mt-0.5">Nick Via Đang Giữ</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Bảng 4 (Full Via 2FA)</div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                    <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-1.5">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="text-2xl font-black text-white">{myWorkStats.groupsCount}</div>
                    <div className="text-xs text-slate-300 font-semibold mt-0.5">Group Đang Chăm</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Bảng 2 (Group Facebook)</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. BẢNG ĐẾM THỐNG KÊ ĐĂNG TAY HAY ĐĂNG TOOL SỐ LƯỢNG TỪNG NHÂN VIÊN (YÊU CẦU MỚI) */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-2xs overflow-hidden animate-fadeIn">
        {/* Header của mục Thống Kê */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-teal-50/50 to-indigo-50/40 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Bảng Đếm Thống Kê Đăng Tay vs Đăng Tool Từng Nhân Viên</span>
                </h3>
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full border border-emerald-300">
                  ✍️ {teamPostingSummary.totalManualPages} Page Đăng Tay
                </span>
                <span className="text-[10px] font-black bg-purple-100 text-purple-900 px-2 py-0.5 rounded-full border border-purple-300">
                  🤖 {teamPostingSummary.totalToolPages} Page Đăng Tool
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Đối chiếu chi tiết số lượng Fanpage đăng tay, đăng tool, số bài đăng hôm nay và tỷ lệ hoàn thành chỉ tiêu của từng nhân sự.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsPostingStatsExpanded(!isPostingStatsExpanded)}
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              {isPostingStatsExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                  <span>Thu Gọn Thống Kê</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                  <span>Mở Rộng Thống Kê ({staffPostingStats.length} NV)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Nội dung thống kê chi tiết khi mở rộng */}
        {isPostingStatsExpanded && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Dàn 4 Thẻ KPI Tóm Tắt Nhanh */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Card 1: Tổng Đăng Tay */}
              <div className="p-3.5 bg-gradient-to-br from-emerald-50 to-teal-50/60 border-2 border-emerald-200 rounded-xl shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-xs font-black text-emerald-950 uppercase tracking-wide">
                  <span className="flex items-center space-x-1">
                    <PenTool className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tổng Page Đăng Tay</span>
                  </span>
                  <span className="text-[10px] font-mono bg-emerald-200/80 text-emerald-900 px-1.5 py-0.2 rounded font-bold">
                    {teamPostingSummary.manualRatio}% toàn đội
                  </span>
                </div>
                <div className="text-2xl font-black text-emerald-800 font-mono">
                  {teamPostingSummary.totalManualPages} <span className="text-xs font-sans font-bold text-emerald-600">Page</span>
                </div>
                <div className="text-[11px] text-emerald-700 font-bold flex items-center justify-between pt-0.5">
                  <span>Bài hôm nay:</span>
                  <span className="font-mono">{teamPostingSummary.totalManualActual}/{teamPostingSummary.totalManualTarget} bài</span>
                </div>
              </div>

              {/* Card 2: Tổng Đăng Tool */}
              <div className="p-3.5 bg-gradient-to-br from-purple-50 to-indigo-50/60 border-2 border-purple-200 rounded-xl shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-xs font-black text-purple-950 uppercase tracking-wide">
                  <span className="flex items-center space-x-1">
                    <Bot className="w-3.5 h-3.5 text-purple-600" />
                    <span>Tổng Page Đăng Tool</span>
                  </span>
                  <span className="text-[10px] font-mono bg-purple-200/80 text-purple-900 px-1.5 py-0.2 rounded font-bold">
                    {teamPostingSummary.toolRatio}% toàn đội
                  </span>
                </div>
                <div className="text-2xl font-black text-purple-800 font-mono">
                  {teamPostingSummary.totalToolPages} <span className="text-xs font-sans font-bold text-purple-600">Page</span>
                </div>
                <div className="text-[11px] text-purple-700 font-bold flex items-center justify-between pt-0.5">
                  <span>Bài hôm nay:</span>
                  <span className="font-mono">{teamPostingSummary.totalToolActual}/{teamPostingSummary.totalToolTarget} bài</span>
                </div>
              </div>

              {/* Card 3: Cơ Cấu Tỷ Lệ Toàn Đội */}
              <div className="p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl shadow-2xs space-y-1.5">
                <div className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center justify-between">
                  <span>Cơ Cấu Phương Thức</span>
                  <span className="text-[10px] text-slate-500 font-bold">
                    Tổng: {teamPostingSummary.totalPagesAll} Page
                  </span>
                </div>
                {/* Visual Ratio Bar */}
                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                  <div
                    style={{ width: `${teamPostingSummary.manualRatio}%` }}
                    className="bg-emerald-500 h-full transition-all"
                    title={`Đăng Tay: ${teamPostingSummary.manualRatio}%`}
                  />
                  <div
                    style={{ width: `${teamPostingSummary.toolRatio}%` }}
                    className="bg-purple-600 h-full transition-all"
                    title={`Đăng Tool: ${teamPostingSummary.toolRatio}%`}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 pt-0.5">
                  <span className="flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Đăng Tay: {teamPostingSummary.manualRatio}%</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                    <span>Tool: {teamPostingSummary.toolRatio}%</span>
                  </span>
                </div>
              </div>

              {/* Card 4: Tổng Tiến Độ Bài Đăng Toàn Đội */}
              <div className="p-3.5 bg-gradient-to-br from-blue-50 to-sky-50 border-2 border-blue-200 rounded-xl shadow-2xs space-y-1">
                <div className="text-xs font-black text-blue-950 uppercase tracking-wide flex items-center justify-between">
                  <span>Tiến Độ Đăng Bài Hôm Nay</span>
                  <span className="text-[10px] font-mono bg-blue-200 text-blue-900 px-1.5 py-0.2 rounded font-bold">
                    {teamPostingSummary.completionRate}%
                  </span>
                </div>
                <div className="text-2xl font-black text-blue-900 font-mono">
                  {teamPostingSummary.totalActualAll} <span className="text-xs font-sans font-bold text-blue-600">/ {teamPostingSummary.totalTargetAll} bài</span>
                </div>
                <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden mt-1 shadow-inner">
                  <div
                    style={{ width: `${Math.min(100, teamPostingSummary.completionRate)}%` }}
                    className={`h-full rounded-full transition-all ${
                      teamPostingSummary.completionRate >= 100 ? 'bg-emerald-500' : 'bg-blue-600'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Thanh Công Cụ: Tìm Kiếm, Bộ Lọc & Sắp Xếp Bảng Đếm Thống Kê */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              {/* Bên trái: Ô tìm kiếm & Các nút lọc nhanh */}
              <div className="flex flex-wrap items-center gap-2 flex-1">
                {/* Ô tìm kiếm */}
                <div className="relative min-w-[200px] max-w-[280px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={postingStatsSearch}
                    onChange={(e) => setPostingStatsSearch(e.target.value)}
                    placeholder="Tìm tên nhân viên..."
                    className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  />
                  {postingStatsSearch && (
                    <button
                      type="button"
                      onClick={() => setPostingStatsSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Các nút lọc phương thức & tiến độ */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPostingStatsFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      postingStatsFilter === 'all'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Tất Cả ({rawStaffPostingStats.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setPostingStatsFilter('has_manual')}
                    className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      postingStatsFilter === 'has_manual'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50'
                    }`}
                  >
                    <PenTool className="w-3 h-3" />
                    <span>Có Đăng Tay ({rawStaffPostingStats.filter((s) => s.manualPages > 0).length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPostingStatsFilter('has_tool')}
                    className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      postingStatsFilter === 'has_tool'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                        : 'bg-white text-purple-800 border-purple-300 hover:bg-purple-50'
                    }`}
                  >
                    <Bot className="w-3 h-3" />
                    <span>Có Đăng Tool ({rawStaffPostingStats.filter((s) => s.toolPages > 0).length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPostingStatsFilter('completed')}
                    className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      postingStatsFilter === 'completed'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-white text-blue-800 border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <Check className="w-3 h-3" />
                    <span>Đạt Chỉ Tiêu ({rawStaffPostingStats.filter((s) => s.totalTarget > 0 && s.totalActual >= s.totalTarget).length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPostingStatsFilter('incomplete')}
                    className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      postingStatsFilter === 'incomplete'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                        : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-50'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    <span>Chưa Xong ({rawStaffPostingStats.filter((s) => s.totalTarget > 0 && s.totalActual < s.totalTarget).length})</span>
                  </button>
                </div>
              </div>

              {/* Bên phải: Dropdown sắp xếp */}
              <div className="flex items-center space-x-2 shrink-0">
                <span className="text-[11px] font-bold text-slate-500 flex items-center space-x-1">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  <span>Sắp xếp:</span>
                </span>
                <select
                  value={postingStatsSort}
                  onChange={(e) => setPostingStatsSort(e.target.value as any)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-teal-500 cursor-pointer shadow-2xs"
                >
                  <option value="total_desc">Tổng Page (Nhiều nhất)</option>
                  <option value="manual_desc">✍️ Đăng Tay (Nhiều nhất)</option>
                  <option value="tool_desc">🤖 Đăng Tool (Nhiều nhất)</option>
                  <option value="manual_ratio_desc">% Đăng Tay cao nhất</option>
                  <option value="tool_ratio_desc">% Đăng Tool cao nhất</option>
                  <option value="completion_desc">🎯 Tiến độ cao nhất</option>
                  <option value="name_asc">Tên nhân viên (A → Z)</option>
                </select>
              </div>
            </div>

            {/* Bảng Chi Tiết Từng Nhân Viên */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wide">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center text-slate-400">#</th>
                    <th className="py-2.5 px-3 min-w-[170px]">Nhân Viên</th>
                    <th className="py-2.5 px-3 text-center min-w-[100px]">Tổng Page</th>
                    <th className="py-2.5 px-3 min-w-[180px] bg-emerald-50/70 text-emerald-950 font-black">
                      ✍️ ĐĂNG TAY (Bấm xem Page)
                    </th>
                    <th className="py-2.5 px-3 min-w-[180px] bg-purple-50/70 text-purple-950 font-black">
                      🤖 ĐĂNG TOOL (Bấm xem Page)
                    </th>
                    <th className="py-2.5 px-3 text-center min-w-[140px]">Tỷ Lệ Tay / Tool</th>
                    <th className="py-2.5 px-3 text-center min-w-[130px]">Tiến Độ Hôm Nay</th>
                    <th className="py-2.5 px-3 text-center min-w-[90px]">Nick Via</th>
                    <th className="py-2.5 px-3 text-center min-w-[140px]">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffPostingStats.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        Không tìm thấy nhân viên phù hợp với bộ lọc hiện tại
                      </td>
                    </tr>
                  ) : (
                    staffPostingStats.map((stat, idx) => {
                      const isDone = stat.totalTarget > 0 && stat.totalActual >= stat.totalTarget;

                      return (
                        <tr key={stat.id} className="hover:bg-slate-50/90 transition-colors">
                          {/* STT */}
                          <td className="py-3 px-3 text-center font-bold text-slate-400">
                            {idx + 1}
                          </td>

                          {/* Tên nhân viên */}
                          <td className="py-3 px-3">
                            <div className="flex items-center space-x-2.5">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                {stat.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-black text-slate-900 text-xs">
                                  {stat.username}
                                </div>
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                  stat.status === 'approved'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : stat.status === 'pending'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-rose-50 text-rose-700'
                                }`}>
                                  {stat.status === 'approved' ? 'Hoạt động' : stat.status === 'pending' ? 'Chờ duyệt' : 'Tạm khóa'}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Tổng Page */}
                          <td className="py-3 px-3 text-center">
                            <span className="font-mono font-black text-slate-800 text-sm">
                              {stat.totalPages}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-sans">Fanpage</span>
                          </td>

                          {/* Cột ĐĂNG TAY */}
                          <td
                            className="py-3 px-3 bg-emerald-50/30 hover:bg-emerald-100/60 cursor-pointer transition-colors group"
                            onClick={() => setInspectStaffModal({ staffName: stat.username, tab: 'manual' })}
                            title={`Bấm để xem danh sách ${stat.manualPages} Page Đăng Tay của ${stat.username}`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-black text-emerald-700 text-xs group-hover:underline">
                                  {stat.manualPages} Page
                                </span>
                                <span className="text-[10px] font-black font-mono text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                                  {stat.manualRatio}%
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-600 font-mono">
                                Đã đăng: <strong className="text-emerald-700 font-black">{stat.manualActual}</strong>
                                <span className="text-slate-400"> / {stat.manualTarget} bài</span>
                              </div>
                            </div>
                          </td>

                          {/* Cột ĐĂNG TOOL */}
                          <td
                            className="py-3 px-3 bg-purple-50/30 hover:bg-purple-100/60 cursor-pointer transition-colors group"
                            onClick={() => setInspectStaffModal({ staffName: stat.username, tab: 'tool' })}
                            title={`Bấm để xem danh sách ${stat.toolPages} Page Đăng Tool của ${stat.username}`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-black text-purple-700 text-xs group-hover:underline">
                                  {stat.toolPages} Page
                                </span>
                                <span className="text-[10px] font-black font-mono text-purple-800 bg-purple-100 px-1.5 py-0.2 rounded">
                                  {stat.toolRatio}%
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-600 font-mono">
                                Đã đăng: <strong className="text-purple-700 font-black">{stat.toolActual}</strong>
                                <span className="text-slate-400"> / {stat.toolTarget} bài</span>
                              </div>
                            </div>
                          </td>

                          {/* Tỷ lệ thanh bar trực quan Tay vs Tool */}
                          <td className="py-3 px-3 text-center">
                            {stat.totalPages > 0 ? (
                              <div className="space-y-1">
                                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                                  <div
                                    style={{ width: `${stat.manualRatio}%` }}
                                    className="bg-emerald-500 h-full"
                                    title={`Đăng Tay: ${stat.manualRatio}%`}
                                  />
                                  <div
                                    style={{ width: `${stat.toolRatio}%` }}
                                    className="bg-purple-600 h-full"
                                    title={`Đăng Tool: ${stat.toolRatio}%`}
                                  />
                                </div>
                                <div className="text-[10px] font-mono font-bold text-slate-500 flex justify-between">
                                  <span className="text-emerald-700">{stat.manualRatio}% Tay</span>
                                  <span className="text-purple-700">{stat.toolRatio}% Tool</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Chưa giao Page</span>
                            )}
                          </td>

                          {/* Tiến độ hôm nay */}
                          <td className="py-3 px-3 text-center">
                            <div className="space-y-0.5">
                              <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                                isDone
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : stat.totalActual > 0
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-500'
                              }`}>
                                {isDone ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span>Đạt Chỉ Tiêu</span>
                                  </>
                                ) : (
                                  <span>{stat.completionRate}%</span>
                                )}
                              </span>
                              <div className="text-[10px] text-slate-500 font-mono">
                                {stat.totalActual}/{stat.totalTarget} bài
                              </div>
                            </div>
                          </td>

                          {/* Nick Via */}
                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">
                            <span className="inline-flex items-center space-x-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200 text-xs">
                              <KeyRound className="w-3 h-3 text-indigo-500" />
                              <span>{stat.viasCount}</span>
                            </span>
                          </td>

                          {/* Thao tác */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => setInspectStaffModal({ staffName: stat.username, tab: 'all' })}
                                className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                                title={`Xem danh sách tất cả ${stat.totalPages} Fanpage của ${stat.username}`}
                              >
                                📋 {stat.totalPages} Page
                              </button>
                              {onSwitchToStaffView && (
                                <button
                                  type="button"
                                  onClick={() => onSwitchToStaffView(stat.username)}
                                  className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                                  title={`Chuyển sang góc nhìn nhân viên ${stat.username}`}
                                >
                                  Góc nhìn NV →
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="bg-slate-100/90 font-black text-xs border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={2} className="py-2.5 px-3 uppercase text-slate-700">
                      TỔNG CỘNG TOÀN ĐỘI:
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-900 text-sm">
                      {teamPostingSummary.totalPagesAll}
                    </td>
                    <td className="py-2.5 px-3 bg-emerald-100/60 font-mono text-emerald-900 text-xs">
                      {teamPostingSummary.totalManualPages} Page ({teamPostingSummary.totalManualActual}/{teamPostingSummary.totalManualTarget} bài)
                    </td>
                    <td className="py-2.5 px-3 bg-purple-100/60 font-mono text-purple-900 text-xs">
                      {teamPostingSummary.totalToolPages} Page ({teamPostingSummary.totalToolActual}/{teamPostingSummary.totalToolTarget} bài)
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-800 text-[11px]">
                      {teamPostingSummary.manualRatio}% Tay / {teamPostingSummary.toolRatio}% Tool
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-blue-900 text-xs">
                      {teamPostingSummary.totalActualAll}/{teamPostingSummary.totalTargetAll} bài ({teamPostingSummary.completionRate}%)
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3.5 w-12 text-center text-slate-400">#</th>
                <th className="py-3 px-4 min-w-[220px]">Nhân Viên</th>
                <th className="py-3 px-3.5 min-w-[180px]">Trạng Thái & Mã PIN</th>
                <th className="py-3 px-3.5 min-w-[240px]">Phân Quyền Bảng (1..6)</th>
                <th className="py-3 px-3.5 min-w-[200px] text-center">Phụ Trách Nghiệp Vụ</th>
                <th className="py-3 px-3.5 min-w-[170px]">Ghi Chú & Ngày Vào</th>
                <th className="py-3 px-4 min-w-[180px] text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-sm text-slate-600">Không tìm thấy nhân viên nào</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchQuery ? 'Thử tìm kiếm với từ khóa khác' : 'Bấm nút "Thêm Nhân Viên Mới" ở trên để tạo tài khoản nhân viên'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredStaff.map((acc, index) => {
                  const staffNameLower = acc.username.trim().toLowerCase();
                  const staffPagesCount = records.filter(
                    (r) => r.staffName?.trim().toLowerCase() === staffNameLower
                  ).length;
                  const staffViasCount = viaList.filter(
                    (v) => v.staffName?.trim().toLowerCase() === staffNameLower
                  ).length;
                  const staffGroupsCount = groupRecords.filter(
                    (g) => g.staffName?.trim().toLowerCase() === staffNameLower
                  ).length;
                  const isPinVisible = Boolean(visiblePins[acc.id]);

                  // Danh sách các bảng nhân viên ĐƯỢC PHÉP truy cập
                  const allowedTabsList = ALL_TAB_KEYS.filter((tabKey) => {
                    if (acc.role === 'admin') return true;
                    if (tabKey === 'staff_management' || tabKey === 'revenue') return false;
                    return acc.allowedTabs && acc.allowedTabs.length > 0
                      ? acc.allowedTabs.includes(tabKey)
                      : ALL_TAB_KEYS.includes(tabKey);
                  });

                  return (
                    <tr key={acc.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* STT */}
                      <td className="py-3.5 px-3.5 text-center font-bold text-slate-400">
                        {index + 1}
                      </td>

                      {/* Tên & Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {acc.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                              <span>{acc.username}</span>
                              {acc.role === 'admin' ? (
                                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-1.5 py-0.2 rounded-md">
                                  ADMIN
                                </span>
                              ) : (
                                <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.2 rounded-md">
                                  NV
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono truncate max-w-[180px]">
                              {acc.email || <span className="italic font-sans text-slate-300">Chưa liên kết email</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Trạng Thái & Mã PIN */}
                      <td className="py-3.5 px-3.5">
                        <div className="space-y-1.5">
                          <div>
                            {acc.status === 'approved' && (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                <span>Hoạt Động</span>
                              </span>
                            )}
                            {acc.status === 'pending' && (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                <span>Chờ Duyệt</span>
                              </span>
                            )}
                            {acc.status === 'blocked' && (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                <span>Tạm Khóa</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-1 bg-slate-100/90 px-2 py-1 rounded-lg border border-slate-200 w-fit">
                            <Key className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="font-mono font-bold text-slate-800 tracking-wider text-xs">
                              {isPinVisible ? acc.pin || '123456' : '••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePinVisibility(acc.id)}
                              className="text-slate-400 hover:text-slate-600 p-0.5 ml-0.5 cursor-pointer"
                              title={isPinVisible ? 'Ẩn PIN' : 'Hiện PIN'}
                            >
                              {isPinVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopy(acc.pin || '123456', `pin-${acc.id}`)}
                              className="text-slate-400 hover:text-blue-600 p-0.5 cursor-pointer"
                              title="Sao chép mật khẩu PIN"
                            >
                              {copiedKey === `pin-${acc.id}` ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Phân Quyền Bảng (1..6) */}
                      <td className="py-3.5 px-3.5">
                        <div className="space-y-1.5">
                          {acc.role === 'admin' ? (
                            <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-black">
                              <Shield className="w-3 h-3 text-amber-600" />
                              <span>Toàn quyền Quản Trị (Tất cả bảng)</span>
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-wrap items-center gap-1">
                                {allowedTabsList.map((tabKey) => {
                                  const tabDef = TAB_DEFINITIONS[tabKey];
                                  let colorClass = 'bg-emerald-50 text-emerald-800 border-emerald-300';
                                  if (tabDef.color === 'red') colorClass = 'bg-red-50 text-red-800 border-red-300';
                                  else if (tabDef.color === 'teal') colorClass = 'bg-teal-50 text-teal-800 border-teal-300';
                                  else if (tabDef.color === 'indigo') colorClass = 'bg-indigo-50 text-indigo-800 border-indigo-300';
                                  else if (tabDef.color === 'blue') colorClass = 'bg-blue-50 text-blue-800 border-blue-300';
                                  else if (tabDef.color === 'purple') colorClass = 'bg-purple-50 text-purple-800 border-purple-300';

                                  return (
                                    <span
                                      key={tabKey}
                                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${colorClass}`}
                                      title={tabDef.label}
                                    >
                                      {tabDef.shortLabel}
                                    </span>
                                  );
                                })}
                              </div>

                              {isAdmin && (
                                <div className="flex items-center justify-between pt-0.5">
                                  <span className="text-[10px] text-slate-500 font-semibold">
                                    Được xem: {allowedTabsList.length}/5 Bảng
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPermissionModal(acc)}
                                    className="inline-flex items-center space-x-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md border border-blue-200 transition-colors cursor-pointer"
                                    title={`Chỉnh sửa phân quyền các bảng cho ${acc.username}`}
                                  >
                                    <SlidersHorizontal className="w-2.5 h-2.5" />
                                    <span>Sửa Quyền</span>
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </td>

                      {/* Khối Lượng Phụ Trách Nghiệp Vụ */}
                      <td className="py-3.5 px-3.5 text-center">
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200" title="Số lượng Fanpage đang phụ trách (Bảng 1)">
                            <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                            <span>{staffPagesCount} Page</span>
                          </span>
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 text-[11px] font-bold border border-indigo-200" title="Số lượng Nick Via đang giữ (Bảng 4)">
                            <KeyRound className="w-3 h-3 text-indigo-600" />
                            <span>{staffViasCount} Via</span>
                          </span>
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 text-[11px] font-bold border border-rose-200" title="Số lượng Group Facebook phụ trách (Bảng 2)">
                            <Users className="w-3 h-3 text-rose-600" />
                            <span>{staffGroupsCount} Grp</span>
                          </span>
                        </div>
                        {/* Chi tiết Đăng Tay vs Tool của nhân viên */}
                        {staffPagesCount > 0 && (
                          <div className="mt-1.5 flex flex-col items-center justify-center gap-1 text-[10px]">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => setInspectStaffModal({ staffName: acc.username, tab: 'manual' })}
                                className="inline-flex items-center space-x-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-black px-2 py-0.5 rounded border border-emerald-300 shadow-2xs cursor-pointer transition-colors"
                                title={`Bấm xem danh sách ${records.filter((r) => r.staffName?.trim().toLowerCase() === staffNameLower && r.postingMethod === 'Đăng Tay').length} Fanpage đăng tay`}
                              >
                                <PenTool className="w-2.5 h-2.5 text-emerald-700" />
                                <span>{records.filter((r) => r.staffName?.trim().toLowerCase() === staffNameLower && r.postingMethod === 'Đăng Tay').length} Tay</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setInspectStaffModal({ staffName: acc.username, tab: 'tool' })}
                                className="inline-flex items-center space-x-0.5 bg-purple-100 hover:bg-purple-200 text-purple-900 font-black px-2 py-0.5 rounded border border-purple-300 shadow-2xs cursor-pointer transition-colors"
                                title={`Bấm xem danh sách ${records.filter((r) => r.staffName?.trim().toLowerCase() === staffNameLower && r.postingMethod === 'Tool').length} Fanpage đăng tool`}
                              >
                                <Bot className="w-2.5 h-2.5 text-purple-700" />
                                <span>{records.filter((r) => r.staffName?.trim().toLowerCase() === staffNameLower && r.postingMethod === 'Tool').length} Tool</span>
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => setInspectStaffModal({ staffName: acc.username, tab: 'all' })}
                              className="text-[10px] text-teal-700 hover:text-teal-900 font-bold hover:underline cursor-pointer"
                            >
                              🔍 Xem chi tiết DS Page
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Ghi Chú & Ngày Vào */}
                      <td className="py-3.5 px-3.5">
                        <div className="space-y-0.5">
                          <div className="text-xs text-slate-700 font-medium truncate max-w-[170px]" title={acc.adminNote || 'Chưa có ghi chú'}>
                            {acc.adminNote || <span className="text-slate-400 italic">Không có ghi chú</span>}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-slate-300" />
                            <span>{acc.approvedAt || acc.createdAt || 'Hệ thống'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Thao Tác Quản Lý */}
                      <td className="py-3.5 px-4 text-right">
                        {isAdmin ? (
                          <div className="flex items-center justify-end space-x-1.5">
                            {/* Phê Duyệt nếu Pending */}
                            {acc.status === 'pending' && (
                              <button
                                type="button"
                                onClick={() => onApproveAccount(acc.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center space-x-1"
                                title="Phê duyệt nhân viên vào hệ thống"
                              >
                                <Check className="w-3 h-3" />
                                <span>Duyệt</span>
                              </button>
                            )}

                            {/* Đổi PIN */}
                            <button
                              type="button"
                              onClick={() => {
                                setPinModalAccount(acc);
                                setNewPinValue(acc.pin || '123456');
                                setConfirmPinValue(acc.pin || '123456');
                                setPinChangeError(null);
                                setPinChangeSuccess(null);
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                              title="Đổi mật khẩu PIN cho nhân viên"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Chuyển sang góc nhìn NV */}
                            {onSwitchToStaffView && acc.status === 'approved' && (
                              <button
                                type="button"
                                onClick={() => onSwitchToStaffView(acc.username)}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                                title={`Mở giao diện dưới góc nhìn của ${acc.username}`}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Khóa / Mở Khóa */}
                            {acc.status === 'approved' ? (
                              <button
                                type="button"
                                onClick={() => onBlockAccount(acc.id)}
                                className="p-1.5 text-amber-700 hover:bg-amber-50 rounded-lg border border-amber-200 transition-colors cursor-pointer"
                                title="Tạm khóa quyền đăng nhập"
                              >
                                <Lock className="w-3.5 h-3.5" />
                              </button>
                            ) : acc.status === 'blocked' ? (
                              <button
                                type="button"
                                onClick={() => onUnblockAccount(acc.id)}
                                className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                                title="Mở khóa tài khoản"
                              >
                                <Unlock className="w-3.5 h-3.5" />
                              </button>
                            ) : null}

                            {/* Xóa Nhân Viên */}
                            <button
                              type="button"
                              onClick={() => {
                                if (onOpenDeleteStaffModal) {
                                  onOpenDeleteStaffModal(acc.username);
                                } else {
                                  setDeleteAccountTarget(acc);
                                  setDeletePostsOption(true);
                                  setDeleteViasOption(true);
                                }
                              }}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                              title={`Xóa dữ liệu & tài khoản của ${acc.username}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setPinModalAccount(acc);
                                setNewPinValue(acc.pin || '123456');
                                setConfirmPinValue(acc.pin || '123456');
                                setPinChangeError(null);
                                setPinChangeSuccess(null);
                              }}
                              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors cursor-pointer shadow-2xs"
                            >
                              <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                              <span>Đổi Mật Khẩu PIN</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Thêm Nhân Viên Mới */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs p-2 sm:p-4 md:p-6 flex items-start justify-center min-h-screen animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border-2 border-blue-400 my-auto sm:my-4 flex flex-col max-h-[92vh] overflow-hidden">
            {/* Header: Cố định trên cùng */}
            <div className="flex items-center justify-between p-5 pb-3 border-b border-slate-100 shrink-0 bg-white">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Thêm Nhân Viên Mới</h3>
                  <p className="text-xs text-slate-500">Tạo tài khoản và lưu trực tiếp lên Cloud Firestore</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 cursor-pointer"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form: Cuộn mượt mà bên trong, bắt đầu ngay từ Tên Nhân Viên */}
            <form onSubmit={handleCreateStaff} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {addError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>{addError}</span>
                  </div>
                )}

                {/* Khối Nhập Tên Nhân Viên Nổi Bật - Không Bị Che (Yêu cầu 3) */}
                <div className="p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-sky-50 border-2 border-blue-500 rounded-2xl space-y-2 shadow-xs">
                  <label htmlFor="add-staff-name-input" className="block text-xs font-black text-blue-950 flex items-center justify-between uppercase">
                    <span>HỌ VÀ TÊN NHÂN VIÊN MỚI <span className="text-rose-600 font-black">*</span></span>
                    <span className="text-[10px] font-black text-blue-900 bg-white px-2.5 py-1 rounded-full border-2 border-blue-300 shadow-2xs">
                      BẮT BUỘC NHẬP
                    </span>
                  </label>
                  <input
                    id="add-staff-name-input"
                    type="text"
                    placeholder="👉 Nhập họ và tên (VD: Hoàng Long, Thu Hà...)"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    required
                    autoFocus
                    className="w-full px-4 py-3 bg-white border-2 border-blue-600 rounded-xl text-base font-black text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:ring-4 focus:ring-blue-200 focus:outline-hidden shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mật Khẩu Đăng Nhập / Mã PIN <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Mặc định: 123456"
                    value={addPin}
                    onChange={(e) => setAddPin(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Mã này nhân viên sẽ dùng kèm tên để đăng nhập vào trang tính.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Nhân Viên (Tùy chọn)
                  </label>
                  <input
                    type="email"
                    placeholder="nhanvien@gmail.com"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ghi Chú Phân Công
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ví dụ: Đăng Page mảng Reels, quản lý Via BM..."
                    value={addNote}
                    onChange={(e) => setAddNote(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                {/* Phân quyền bảng cho nhân viên mới */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Phân Quyền Bảng Hiển Thị (1..6)
                    </label>
                    <span className="text-[11px] text-blue-600 font-semibold">
                      Đã chọn {addAllowedTabs.filter((t) => t !== 'staff_management').length}/5 bảng
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    <button
                      type="button"
                      onClick={() => setAddAllowedTabs(['fanpage', 'group', 'proxy', 'fullvia', 'shared_accounts'])}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                    >
                      Tất cả (5 bảng)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddAllowedTabs(['fanpage'])}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 cursor-pointer"
                    >
                      Chỉ Fanpage
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddAllowedTabs(['fanpage', 'fullvia'])}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 cursor-pointer"
                    >
                      Fanpage + Via
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddAllowedTabs(['fanpage', 'group'])}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer"
                    >
                      Fanpage + Group
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['fanpage', 'group', 'proxy', 'fullvia', 'shared_accounts'] as TabKey[]).map((tabKey) => {
                      const tabDef = TAB_DEFINITIONS[tabKey];
                      const isChecked = addAllowedTabs.includes(tabKey);
                      return (
                        <label
                          key={tabKey}
                          className={`flex items-center space-x-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-blue-50/70 border-blue-300 font-bold text-blue-900'
                              : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setAddAllowedTabs((prev) => {
                                if (prev.includes(tabKey)) {
                                  if (prev.length <= 1) return prev;
                                  return prev.filter((t) => t !== tabKey);
                                } else {
                                  return [...prev, tabKey];
                                }
                              });
                            }}
                            className="w-3.5 h-3.5 text-blue-600 rounded cursor-pointer"
                          />
                          <span className="truncate">{tabDef.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Nhân viên chỉ thấy các bảng được chọn, giúp giao diện gọn gàng.
                  </p>
                </div>
              </div>

              {/* Footer: Cố định dưới cùng */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdd}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isSubmittingAdd && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Lưu Nhân Viên Mới</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Đổi PIN Nhanh */}
      {pinModalAccount && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Đổi Mật Khẩu PIN</h3>
                  <p className="text-xs text-slate-500">Nhân viên: {pinModalAccount.username}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPinModalAccount(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mã PIN Mới
                </label>
                <input
                  type="text"
                  value={newPinValue}
                  onChange={(e) => setNewPinValue(e.target.value)}
                  placeholder="Nhập mã PIN mới..."
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPinModalAccount(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPin}
                  className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isSubmittingPin && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Cập Nhật PIN</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xác Nhận Xóa Nhân Viên */}
      {deleteAccountTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center space-x-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Xóa Nhân Viên: {deleteAccountTarget.username}
                </h3>
                <p className="text-xs text-slate-500">Hành động này sẽ xóa tài khoản khỏi Cloud Firestore</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Bạn có chắc chắn muốn xóa tài khoản nhân viên <strong>{deleteAccountTarget.username}</strong> không? Nhân viên này sẽ không thể đăng nhập vào hệ thống nữa.
            </p>

            <div className="space-y-2 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deletePostsOption}
                  onChange={(e) => setDeletePostsOption(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <span>Xóa luôn tất cả Fanpage & bài đăng do nhân viên này phụ trách</span>
              </label>

              <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteViasOption}
                  onChange={(e) => setDeleteViasOption(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <span>Xóa luôn tất cả Via FB thuộc nhân viên này</span>
              </label>
            </div>

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setDeleteAccountTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
              >
                {isDeleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Xác Nhận Xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ĐỔI THÔNG TIN & MẬT KHẨU QUẢN TRỊ ADMIN */}
      {isAdminProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-scaleIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center font-bold">
                  <Shield className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Đổi Mật Khẩu & Quản Trị Admin</h3>
                  <p className="text-[11px] text-slate-500">Khóa bảo vệ cao nhất cho hệ thống</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdminProfileModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {adminProfileSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Đã cập nhật mật khẩu & thông tin Admin thành công! Đồng bộ tức thì lên Cloud Firestore.</span>
              </div>
            )}

            <form onSubmit={handleSaveAdminProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên hiển thị Quản Trị
                </label>
                <input
                  type="text"
                  value={editAdminName}
                  onChange={(e) => setEditAdminName(e.target.value)}
                  placeholder="Ví dụ: Quản Lý (Admin)"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Quản Trị Admin (Google Account)
                </label>
                <input
                  type="email"
                  value={editAdminEmail}
                  onChange={(e) => setEditAdminEmail(e.target.value)}
                  placeholder="Ví dụ: myphuong2295@gmail.com"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono text-slate-800"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Dùng để nhận diện quyền Admin khi đăng nhập qua Google.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mật Khẩu / Mã PIN Quản Trị Master <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showAdminPinInModal ? 'text' : 'password'}
                    value={editAdminPin}
                    onChange={(e) => setEditAdminPin(e.target.value)}
                    required
                    placeholder="Nhập mật khẩu quản trị mới"
                    className="w-full px-3 py-2 pr-10 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono tracking-wider text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPinInModal(!showAdminPinInModal)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showAdminPinInModal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200/80 mt-1.5 block leading-relaxed">
                  ⚠️ <strong>Quan trọng:</strong> Bất cứ ai đăng nhập (kể cả email Google dùng chung) đều phải nhập đúng mật khẩu này mới vào được giao diện Quản Trị!
                </span>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdminProfileModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdminProfile || !editAdminPin.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingAdminProfile ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <KeyRound className="w-3.5 h-3.5" />
                  )}
                  <span>Lưu Mật Khẩu Admin</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Phân Quyền Bảng Hiển Thị (Smart Table Permissions) */}
      {permissionModalAccount && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Phân Quyền Bảng Hiển Thị
                  </h3>
                  <p className="text-xs text-slate-500">
                    Nhân viên: <strong className="text-slate-800">{permissionModalAccount.username}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPermissionModalAccount(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notice */}
            {permissionNotice && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs flex items-center space-x-2 ${
                  permissionNotice.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {permissionNotice.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{permissionNotice.message}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Description */}
              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900">
                <p className="font-semibold mb-1">💡 Cơ chế phân quyền hiển thị thông minh:</p>
                <p className="text-blue-800 text-[11px] leading-relaxed">
                  Nhân viên chỉ thấy các bảng được tích chọn bên dưới. Các bảng không được cấp quyền sẽ tự động ẩn đi hoàn toàn khỏi menu, giúp nhân viên có màn hình làm việc gọn gàng, không bị rối mắt bởi các bảng không cần thiết.
                </p>
              </div>

              {/* Quick Preset Buttons */}
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Chọn Nhanh Mẫu Phân Quyền:</span>
                  <span className="text-blue-600 font-extrabold normal-case">
                    Đã chọn {selectedAllowedTabs.length} bảng
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickPresetTabs('all')}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 transition-all cursor-pointer"
                  >
                    ⚡ Cấp 5 Bảng Nghiệp Vụ (B1..B4, B6)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPresetTabs('fanpage_only')}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all cursor-pointer"
                  >
                    📄 Chỉ Fanpage (B1)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPresetTabs('fanpage_via')}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all cursor-pointer"
                  >
                    🔗 Fanpage + Via (B1 & B4)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPresetTabs('fanpage_group')}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-all cursor-pointer"
                  >
                    👥 Fanpage + Group (B1 & B2)
                  </button>
                </div>
              </div>

              {/* 6 Tab Checkbox Cards */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Danh Sách Bảng Phân Quyền Cho Nhân Viên:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
                  {ALL_TAB_KEYS.map((tabKey) => {
                    const tabDef = TAB_DEFINITIONS[tabKey];
                    const isAdminOnlyTab = tabKey === 'staff_management' || tabKey === 'revenue';
                    const isChecked = !isAdminOnlyTab && selectedAllowedTabs.includes(tabKey);

                    if (isAdminOnlyTab) {
                      return (
                        <div
                          key={tabKey}
                          className="p-3 rounded-xl border border-slate-200 bg-slate-100/70 select-none flex items-start space-x-2.5 opacity-60 cursor-not-allowed"
                          title={tabKey === 'revenue' ? 'Bảng Quản Lý Doanh Thu chỉ dành riêng cho Admin' : 'Bảng Quản Trị Nhân Viên chỉ dành riêng cho Admin'}
                        >
                          <div className="mt-0.5 w-4 h-4 rounded border border-slate-300 bg-slate-200 flex items-center justify-center text-[10px] text-slate-500 font-bold shrink-0">
                            🔒
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-xs text-slate-600 truncate">
                                {tabDef.label}
                              </span>
                              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                Chỉ Admin
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                              {tabKey === 'revenue'
                                ? 'Bảng doanh thu, chi phí & lương nhân viên chỉ Admin xem và quản lý.'
                                : 'Bảng quản trị nhân sự chỉ Admin quản lý, tự động ẩn khỏi nhân viên.'}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={tabKey}
                        onClick={() => handleToggleTabPermission(tabKey)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex items-start space-x-2.5 ${
                          isChecked
                            ? 'bg-blue-50/60 border-blue-300 ring-1 ring-blue-400/40 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 opacity-60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleTabPermission(tabKey)}
                          className="mt-0.5 w-4 h-4 text-blue-600 rounded cursor-pointer shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-xs text-slate-900 truncate">
                              {tabDef.label}
                            </span>
                            <span
                              className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${
                                isChecked
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              Bảng {tabDef.tabNumber}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                            {tabDef.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <span className="text-xs text-slate-400">
                  {selectedAllowedTabs.length === 0 ? (
                    <span className="text-rose-500 font-bold">Cần chọn ít nhất 1 bảng!</span>
                  ) : (
                    <span>Lưu vào Cloud Firestore</span>
                  )}
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setPermissionModalAccount(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={isSavingPermissions || selectedAllowedTabs.length === 0}
                    onClick={handleSavePermissions}
                    className="px-5 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                  >
                    {isSavingPermissions ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Lưu Phân Quyền</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xem Chi Tiết Danh Sách Fanpage Của Nhân Viên */}
      {inspectStaffModal && (() => {
        const staffNameLower = inspectStaffModal.staffName.trim().toLowerCase();
        const staffRecs = records.filter(
          (r) => (r.staffName || '').trim().toLowerCase() === staffNameLower
        );
        const manualRecs = staffRecs.filter((r) => r.postingMethod === 'Đăng Tay');
        const toolRecs = staffRecs.filter((r) => r.postingMethod === 'Tool');
        const timerRecs = staffRecs.filter((r) => r.postingMethod === 'Hẹn Giờ');

        let displayRecs = staffRecs;
        if (inspectStaffModal.tab === 'manual') displayRecs = manualRecs;
        else if (inspectStaffModal.tab === 'tool') displayRecs = toolRecs;
        else if (inspectStaffModal.tab === 'timer') displayRecs = timerRecs;

        if (inspectPageSearch.trim()) {
          const q = inspectPageSearch.trim().toLowerCase();
          displayRecs = displayRecs.filter(
            (r) =>
              (r.pageName || '').toLowerCase().includes(q) ||
              (r.viaUid || '').toLowerCase().includes(q) ||
              (r.pageLink || '').toLowerCase().includes(q) ||
              (r.status || '').toLowerCase().includes(q)
          );
        }

        return (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs p-2 sm:p-4 flex items-center justify-center min-h-screen animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border-2 border-teal-500 flex flex-col max-h-[92vh] overflow-hidden">
              {/* Header */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-50 via-emerald-50 to-indigo-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white font-black text-sm flex items-center justify-center shadow-xs shrink-0">
                    {inspectStaffModal.staffName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-black text-slate-900">
                        Chi Tiết Fanpage: {inspectStaffModal.staffName}
                      </h3>
                      <span className="text-[10px] font-black bg-teal-100 text-teal-900 px-2 py-0.5 rounded-full border border-teal-300">
                        Tổng {staffRecs.length} Fanpage
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Danh sách cụ thể từng Fanpage đăng tay hay chạy tool, link Page và tiến độ bài đăng hôm nay.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInspectStaffModal(null);
                    setInspectPageSearch('');
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
                  title="Đóng"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sub-header: Tabs & Search */}
              <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                {/* Tabs */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setInspectStaffModal({ ...inspectStaffModal, tab: 'all' })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      inspectStaffModal.tab === 'all'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    Tất Cả ({staffRecs.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectStaffModal({ ...inspectStaffModal, tab: 'manual' })}
                    className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      inspectStaffModal.tab === 'manual'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-300'
                    }`}
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>✍️ Đăng Tay ({manualRecs.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectStaffModal({ ...inspectStaffModal, tab: 'tool' })}
                    className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      inspectStaffModal.tab === 'tool'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white text-purple-800 hover:bg-purple-50 border border-purple-300'
                    }`}
                  >
                    <Bot className="w-3.5 h-3.5" />
                    <span>🤖 Đăng Tool ({toolRecs.length})</span>
                  </button>
                  {timerRecs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setInspectStaffModal({ ...inspectStaffModal, tab: 'timer' })}
                      className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        inspectStaffModal.tab === 'timer'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-300'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>⏰ Hẹn Giờ ({timerRecs.length})</span>
                    </button>
                  )}
                </div>

                {/* Search */}
                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={inspectPageSearch}
                    onChange={(e) => setInspectPageSearch(e.target.value)}
                    placeholder="Tìm tên Page, UID Via..."
                    className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:outline-hidden focus:border-teal-500"
                  />
                  {inspectPageSearch && (
                    <button
                      type="button"
                      onClick={() => setInspectPageSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Table Body */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4">
                {displayRecs.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-bold">Không tìm thấy Fanpage nào</p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wide">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center text-slate-400">#</th>
                          <th className="py-2.5 px-3 min-w-[200px]">Tên Fanpage</th>
                          <th className="py-2.5 px-3 min-w-[130px]">Phương Thức</th>
                          <th className="py-2.5 px-3 min-w-[130px]">Nick Via</th>
                          <th className="py-2.5 px-3 text-center min-w-[120px]">Bài Hôm Nay</th>
                          <th className="py-2.5 px-3 text-center min-w-[100px]">Trạng Thái</th>
                          <th className="py-2.5 px-3 text-center min-w-[100px]">Tương Tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {displayRecs.map((r, i) => {
                          const isDone = r.isCompleted || (r.targetPosts > 0 && r.actualPosts >= r.targetPosts);
                          const isManual = r.postingMethod === 'Đăng Tay';
                          const isTool = r.postingMethod === 'Tool';

                          return (
                            <tr key={r.id || `inspect-${i}`} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                                {i + 1}
                              </td>
                              <td className="py-2.5 px-3">
                                <div>
                                  <div className="font-black text-slate-900 text-xs">
                                    {r.pageName || 'Không tên'}
                                  </div>
                                  {r.pageLink ? (
                                    <a
                                      href={r.pageLink.startsWith('http') ? r.pageLink : `https://${r.pageLink}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center space-x-1 text-[11px] text-blue-600 hover:text-blue-800 hover:underline mt-0.5"
                                    >
                                      <span className="truncate max-w-[240px]">{r.pageLink}</span>
                                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                    </a>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 italic">Chưa có link</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-black border shadow-2xs ${
                                    isManual
                                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                      : isTool
                                      ? 'bg-purple-50 text-purple-900 border-purple-300'
                                      : 'bg-amber-50 text-amber-900 border-amber-300'
                                  }`}
                                >
                                  {isManual ? (
                                    <>
                                      <PenTool className="w-3 h-3 text-emerald-700" />
                                      <span>✍️ Đăng Tay</span>
                                    </>
                                  ) : isTool ? (
                                    <>
                                      <Bot className="w-3 h-3 text-purple-700" />
                                      <span>🤖 Đăng Tool</span>
                                    </>
                                  ) : (
                                    <>
                                      <Clock className="w-3 h-3 text-amber-700" />
                                      <span>⏰ {r.postingMethod}</span>
                                    </>
                                  )}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="space-y-0.5">
                                  <div className="font-mono font-bold text-slate-800 text-[11px]">
                                    {r.viaUid || <span className="text-slate-400 italic">Chưa gán Via</span>}
                                  </div>
                                  {r.isViaError && (
                                    <span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 inline-block">
                                      ⚠️ Via Lỗi
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="space-y-0.5">
                                  <span
                                    className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                                      isDone
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : (r.actualPosts || 0) > 0
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-slate-100 text-slate-500'
                                    }`}
                                  >
                                    {isDone ? (
                                      <>
                                        <Check className="w-2.5 h-2.5 text-emerald-600" />
                                        <span>Đạt Chỉ Tiêu</span>
                                      </>
                                    ) : (
                                      <span>{r.actualPosts || 0} / {r.targetPosts || 0} bài</span>
                                    )}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    r.status === 'Đề Xuất'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : r.status === 'Mất Đề Xuất'
                                      ? 'bg-amber-100 text-amber-800'
                                      : r.status === 'Đình Chỉ'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {r.status || 'Bình thường'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    r.interaction === 'TỐT'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : r.interaction === 'Bình Thường'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {r.interaction || 'Chưa đánh giá'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <span className="text-xs text-slate-500">
                  Hiển thị <strong>{displayRecs.length}</strong> / {staffRecs.length} Fanpage của {inspectStaffModal.staffName}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setInspectStaffModal(null);
                    setInspectPageSearch('');
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
