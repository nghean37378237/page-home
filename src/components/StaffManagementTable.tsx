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
    const pagesCount = records.filter(
      (r) => (r.staffName || '').trim().toLowerCase() === myStaffNameLower
    ).length;
    const viasCount = viaList.filter(
      (v) => (v.staffName || '').trim().toLowerCase() === myStaffNameLower
    ).length;
    const groupsCount = groupRecords.filter(
      (g) => (g.staffName || '').trim().toLowerCase() === myStaffNameLower
    ).length;
    return { pagesCount, viasCount, groupsCount };
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
        setSelectedAllowedTabs(['fanpage', 'group', 'proxy', 'fullvia', 'shared_accounts']);
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
        message: `Đã cập nhật phân quyền (${selectedAllowedTabs.length}/6 bảng) cho "${permissionModalAccount.username}" thành công!`,
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
          {/* Admin Top Banner & Title */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-3 mb-1.5">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                    <span>Bảng Quản Trị Nhân Viên</span>
                    <span className="text-xs font-black text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300 flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-amber-700" />
                      <span>Chỉ Admin Quản Lý</span>
                    </span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Cloud Firestore Real-time
                    </span>
                  </h1>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Toàn quyền quản trị nhân sự: Thêm nhân viên, cấp mật khẩu PIN, phân quyền xem Bảng 1..6 và theo dõi phân công công việc.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
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
                className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Thêm Nhân Viên Mới</span>
              </button>

              {onOpenDeleteStaffModal && (
                <button
                  type="button"
                  id="btn-delete-staff-data-top"
                  onClick={() => onOpenDeleteStaffModal()}
                  className="inline-flex items-center space-x-2 px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-colors cursor-pointer"
                  title="Chọn xóa toàn bộ dữ liệu của 1 nhân viên bất kỳ"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Xóa Toàn Bộ Dữ Liệu 1 NV</span>
                </button>
              )}

              {onOpenAdminModal && (
                <button
                  type="button"
                  id="btn-open-advanced-security"
                  onClick={() => onOpenAdminModal('security_db')}
                  className="inline-flex items-center space-x-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer"
                >
                  <Shield className="w-4 h-4 text-indigo-600" />
                  <span>Bảo Mật & CSDL Cloud</span>
                </button>
              )}
            </div>
          </div>

          {/* MASTER ADMIN SECURITY & APP LOCKDOWN BANNER */}
          <div className="bg-gradient-to-r from-slate-900 via-[#0f1d3a] to-slate-900 border border-slate-700/80 rounded-2xl p-5 shadow-xl text-white">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Left info */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black uppercase tracking-wider">
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    <span>Tài Khoản Quản Trị Tối Cao</span>
                  </div>
                  <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Khóa Bảo Vệ Ứng Dụng Đang BẬT</span>
                  </div>
                  <div
                    className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                      requireGoogleOnly
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                        : 'bg-slate-800/80 text-slate-400 border border-slate-700'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5 text-sky-400" />
                    <span>Bắt Buộc Đăng Nhập Google: {requireGoogleOnly ? 'ĐANG BẬT' : 'ĐANG TẮT'}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Tên Quản Trị Admin:</span>
                    <span className="font-bold text-white text-sm">{adminName}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Email Admin Chính Thức:</span>
                    <span className="font-mono text-sky-300 text-sm font-semibold">{adminEmail}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Mật Khẩu Master Admin:</span>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className="font-mono font-bold text-amber-300 bg-black/40 px-2.5 py-0.5 rounded-md border border-slate-700">
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

                <p className="text-[11px] text-slate-300/90 leading-relaxed pt-1">
                  🛡️ <strong>Chính sách khóa app:</strong> Người dùng chung email trình duyệt vẫn <em>không thể</em> truy cập vào app nếu không biết đúng Mật khẩu Admin hoặc Mã PIN nhân viên.
                </p>
              </div>

              {/* Right Action Button */}
              <div className="shrink-0 flex flex-wrap items-center gap-2">
                {onToggleRequireGoogleOnly && (
                  <button
                    type="button"
                    id="btn-toggle-google-only"
                    onClick={() => onToggleRequireGoogleOnly(!requireGoogleOnly)}
                    className={`inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl font-black text-xs shadow-md transition-all cursor-pointer ${
                      requireGoogleOnly
                        ? 'bg-sky-600 hover:bg-sky-500 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    }`}
                    title={
                      requireGoogleOnly
                        ? 'Đang bắt buộc 100% nhân viên & admin đăng nhập bằng Google. Bấm để chuyển sang chế độ linh hoạt.'
                        : 'Bấm để bật chế độ BẮT BUỘC ĐĂNG NHẬP GOOGLE.'
                    }
                  >
                    <Shield className="w-4 h-4 text-sky-300" />
                    <span>Google SSO: {requireGoogleOnly ? 'Đang Bắt Buộc' : 'Tắt'}</span>
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
                  className="inline-flex items-center space-x-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer hover:scale-[1.02]"
                >
                  <KeyRound className="w-4 h-4 text-slate-950" />
                  <span>Đổi Mật Khẩu & Quản Trị Admin</span>
                </button>
              </div>
            </div>
          </div>

          {/* Metrics Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div
              onClick={() => setStatusFilter('all')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Tổng Nhân Sự</span>
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 mt-1">{counts.total}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Tất cả nhân sự trong hệ thống</div>
            </div>

            <div
              onClick={() => setStatusFilter('approved')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                statusFilter === 'approved'
                  ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700">Đang Hoạt Động</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-700 mt-1">{counts.active}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Có quyền đăng nhập & quản lý</div>
            </div>

            <div
              onClick={() => setStatusFilter('pending')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700">Chờ Quản Lý Duyệt</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-700 mt-1">{counts.pending}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Cần phê duyệt để vào hệ thống</div>
            </div>

            <div
              onClick={() => setStatusFilter('blocked')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                statusFilter === 'blocked'
                  ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-700">Tạm Khóa Quyền</span>
                <Lock className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl font-black text-rose-700 mt-1">{counts.blocked}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Không thể đăng nhập</div>
            </div>
          </div>

          {/* Filter and Search Bar for Admin */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                id="input-search-staff-table"
                placeholder="Tìm theo tên nhân viên, email, ghi chú..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
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
                    <div className="text-[10px] text-slate-400 mt-0.5">Bảng 1 (Tiến độ bài)</div>
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

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-3 px-3.5 w-12 text-center">STT</th>
                <th className="py-3 px-4 min-w-[200px]">Tên Nhân Viên</th>
                <th className="py-3 px-3.5 min-w-[120px]">Trạng Thái</th>
                <th className="py-3 px-3.5 min-w-[170px]">Mật Khẩu / Mã PIN</th>
                <th className="py-3 px-3.5 min-w-[260px]">Phân Quyền Bảng (1..6)</th>
                <th className="py-3 px-3.5 min-w-[100px] text-center">Phụ Trách</th>
                <th className="py-3 px-3.5 min-w-[140px]">Ngày Tham Gia</th>
                <th className="py-3 px-4 min-w-[180px]">Ghi Chú</th>
                <th className="py-3 px-4 min-w-[240px] text-right">Thao Tác Quản Lý</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
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
                  const isPinVisible = Boolean(visiblePins[acc.id]);

                  return (
                    <tr key={acc.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* STT */}
                      <td className="py-3 px-3.5 text-center font-bold text-slate-400">
                        {index + 1}
                      </td>

                      {/* Tên & Email */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {acc.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                              <span>{acc.username}</span>
                              {acc.role === 'admin' && (
                                <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-1.5 py-0.2 rounded">
                                  ADMIN
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {acc.email || 'Chưa liên kết email'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Trạng Thái */}
                      <td className="py-3 px-3.5">
                        {acc.status === 'approved' && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Hoạt Động</span>
                          </span>
                        )}
                        {acc.status === 'pending' && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            <span>Chờ Duyệt</span>
                          </span>
                        )}
                        {acc.status === 'blocked' && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            <span>Tạm Khóa</span>
                          </span>
                        )}
                      </td>

                      {/* Mật Khẩu / PIN */}
                      <td className="py-3 px-3.5">
                        <div className="flex items-center space-x-1.5 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 w-fit">
                          <Key className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono font-bold text-slate-800 tracking-wider">
                            {isPinVisible ? acc.pin || '123456' : '••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePinVisibility(acc.id)}
                            className="text-slate-400 hover:text-slate-600 p-0.5 ml-1 cursor-pointer"
                            title={isPinVisible ? 'Ẩn PIN' : 'Hiện PIN'}
                          >
                            {isPinVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(acc.pin || '123456', `pin-${acc.id}`)}
                            className="text-slate-400 hover:text-blue-600 p-0.5 cursor-pointer"
                            title="Sao chép mật khẩu PIN"
                          >
                            {copiedKey === `pin-${acc.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Phân Quyền Bảng (1..6) */}
                      <td className="py-3 px-3.5">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex flex-wrap items-center gap-1">
                            {ALL_TAB_KEYS.map((tabKey) => {
                              const tabDef = TAB_DEFINITIONS[tabKey];
                              const isAllowed =
                                acc.role === 'admin' ||
                                (acc.allowedTabs && acc.allowedTabs.length > 0
                                  ? acc.allowedTabs.includes(tabKey)
                                  : ALL_TAB_KEYS.includes(tabKey));

                              let activeColorClass = 'bg-emerald-50 text-emerald-800 border-emerald-300';
                              if (tabDef.color === 'red') activeColorClass = 'bg-red-50 text-red-800 border-red-300';
                              else if (tabDef.color === 'teal') activeColorClass = 'bg-teal-50 text-teal-800 border-teal-300';
                              else if (tabDef.color === 'indigo') activeColorClass = 'bg-indigo-50 text-indigo-800 border-indigo-300';
                              else if (tabDef.color === 'blue') activeColorClass = 'bg-blue-50 text-blue-800 border-blue-300';
                              else if (tabDef.color === 'purple') activeColorClass = 'bg-purple-50 text-purple-800 border-purple-300';

                              return (
                                <span
                                  key={tabKey}
                                  className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all ${
                                    isAllowed
                                      ? activeColorClass
                                      : 'bg-slate-100 text-slate-400 border-slate-200 line-through opacity-40'
                                  }`}
                                  title={isAllowed ? `${tabDef.label}: Được phép xem` : `${tabDef.label}: Đang bị ẩn`}
                                >
                                  <span>{tabDef.shortLabel}</span>
                                </span>
                              );
                            })}
                          </div>
                          {isAdmin && (
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-400 font-medium">
                                {acc.role === 'admin'
                                  ? 'Toàn quyền (Admin)'
                                  : `${(acc.allowedTabs || ['fanpage', 'fullvia']).filter((t) => t !== 'staff_management').length}/5 Bảng`}
                              </span>
                              {acc.role !== 'admin' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenPermissionModal(acc)}
                                  className="inline-flex items-center space-x-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold rounded border border-blue-200 transition-colors cursor-pointer"
                                  title={`Cài đặt phân quyền các bảng cho ${acc.username}`}
                                >
                                  <SlidersHorizontal className="w-2.5 h-2.5" />
                                  <span>Sửa Quyền</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Thống Kê Phụ Trách */}
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                            <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                            <span>{staffPagesCount} Page</span>
                          </span>
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 text-[11px] font-bold border border-indigo-200">
                            <KeyRound className="w-3 h-3 text-indigo-600" />
                            <span>{staffViasCount} Via</span>
                          </span>
                        </div>
                      </td>

                      {/* Ngày Tham Gia */}
                      <td className="py-3 px-3.5 text-slate-500 font-medium">
                        <div>{acc.approvedAt || acc.createdAt || 'Mặc định'}</div>
                      </td>

                      {/* Ghi Chú */}
                      <td className="py-3 px-4 text-slate-600">
                        <div className="truncate max-w-[200px]" title={acc.adminNote || 'Không có ghi chú'}>
                          {acc.adminNote || <span className="text-slate-400 italic">Không có ghi chú</span>}
                        </div>
                      </td>

                      {/* Thao Tác Quản Lý */}
                      <td className="py-3 px-4 text-right">
                        {isAdmin ? (
                          <div className="flex items-center justify-end space-x-1.5">
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
                              title="Đổi mật khẩu PIN"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Phê Duyệt nếu Pending */}
                            {acc.status === 'pending' && (
                              <button
                                type="button"
                                onClick={() => onApproveAccount(acc.id)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                              >
                                Duyệt Vào
                              </button>
                            )}

                            {/* Khóa / Mở Khóa */}
                            {acc.status === 'approved' ? (
                              <button
                                type="button"
                                onClick={() => onBlockAccount(acc.id)}
                                className="p-1.5 text-amber-700 hover:bg-amber-50 rounded-lg border border-amber-200 transition-colors cursor-pointer"
                                title="Tạm khóa quyền truy cập"
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

                            {/* Chuyển sang góc nhìn NV */}
                            {onSwitchToStaffView && acc.status === 'approved' && (
                              <button
                                type="button"
                                onClick={() => onSwitchToStaffView(acc.username)}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                                title={`Xem dưới góc nhìn của ${acc.username}`}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            )}

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
                              title={`Xóa toàn bộ dữ liệu của nhân viên ${acc.username}`}
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Thêm Nhân Viên Mới</h3>
                  <p className="text-xs text-slate-500">Tạo tài khoản và lưu trực tiếp lên Cloud Firestore</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên Nhân Viên <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Hoàng Long, Thu Hà..."
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
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

              <div className="flex items-center justify-end space-x-2 pt-2">
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
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
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
                    Đã chọn {selectedAllowedTabs.length}/6 bảng
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
                    const isAdminOnlyTab = tabKey === 'staff_management';
                    const isChecked = !isAdminOnlyTab && selectedAllowedTabs.includes(tabKey);

                    if (isAdminOnlyTab) {
                      return (
                        <div
                          key={tabKey}
                          className="p-3 rounded-xl border border-slate-200 bg-slate-100/70 select-none flex items-start space-x-2.5 opacity-60 cursor-not-allowed"
                          title="Bảng Quản Trị Nhân Viên chỉ dành riêng cho Admin"
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
                              Bảng quản trị nhân sự chỉ Admin quản lý, tự động ẩn khỏi nhân viên.
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
    </div>
  );
};
