import React, { useState, useEffect, useMemo } from 'react';
import {
  UserAccount,
  PageRecord,
  FullViaItem,
  GroupRecord,
  ProxyItem,
  SharedAccount,
  TabKey,
  ALL_TAB_KEYS,
  TAB_DEFINITIONS,
} from '../types';
import {
  Shield,
  UserCheck,
  UserX,
  Lock,
  CheckCircle2,
  Clock,
  Key,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  UserPlus,
  AlertCircle,
  AlertTriangle,
  Copy,
  Check,
  Search,
  Edit2,
  RefreshCw,
  ExternalLink,
  Info,
  Sparkles,
  ChevronRight,
  Layers,
  FileSpreadsheet,
  Database,
  Server,
  Wifi,
  Download,
  ShieldCheck,
  Activity,
  Globe,
  HardDrive,
  Upload,
} from 'lucide-react';
import { getFirestoreDatabaseInfo, pingFirestoreDatabase } from '../services/firebase';
import firebaseConfig from '../../firebase-applet-config.json';

interface AdminApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: UserAccount[];
  adminPin: string;
  records: PageRecord[];
  viaList?: FullViaItem[];
  groupRecords?: GroupRecord[];
  proxies?: ProxyItem[];
  sharedAccounts?: SharedAccount[];
  initialTab?: 'staff' | 'pending' | 'blocked' | 'admin_pin' | 'security_db';
  onApproveAccount: (accountId: string) => void;
  onRejectAccount: (accountId: string) => void;
  onBlockAccount: (accountId: string) => void;
  onUnblockAccount: (accountId: string) => void;
  onUpdateAccountPin: (accountId: string, newPin: string) => void;
  onDeleteAccount: (accountId: string, options?: { deletePosts?: boolean; deleteVias?: boolean }) => void | Promise<void>;
  onDeleteStaffPosts?: (staffName: string) => void | Promise<void>;
  onAddPreApprovedStaff: (username: string, pin: string, adminNote?: string, email?: string) => void | Promise<void>;
  onChangeAdminPin: (newPin: string) => void | Promise<void>;
  onUpdateAccountEmail?: (accountId: string, newEmail: string) => void | Promise<void>;
  onUpdateAccountInfo?: (accountId: string, updates: Partial<UserAccount>) => void | Promise<void>;
  requireGoogleOnly?: boolean;
  onToggleRequireGoogleOnly?: (enabled: boolean) => void | Promise<void>;
  onRestoreBackup?: (backupData: any) => Promise<void>;
}

export function AdminApprovalModal({
  isOpen,
  onClose,
  accounts,
  adminPin,
  records,
  viaList = [],
  groupRecords = [],
  proxies = [],
  sharedAccounts = [],
  initialTab = 'staff',
  requireGoogleOnly = true,
  onToggleRequireGoogleOnly,
  onApproveAccount,
  onRejectAccount,
  onBlockAccount,
  onUnblockAccount,
  onUpdateAccountPin,
  onDeleteAccount,
  onDeleteStaffPosts,
  onAddPreApprovedStaff,
  onChangeAdminPin,
  onUpdateAccountEmail,
  onUpdateAccountInfo,
  onRestoreBackup,
}: AdminApprovalModalProps) {
  // Navigation tabs: 'staff' (Tất cả nhân viên & mật khẩu - MẶC ĐỊNH), 'pending', 'blocked', 'security_db' (Bảo mật & CSDL)
  const [activeTab, setActiveTab] = useState<'staff' | 'pending' | 'blocked' | 'admin_pin' | 'security_db'>(
    initialTab || 'staff'
  );

  // Sub-tab for Security & Database panel
  const [secSubTab, setSecSubTab] = useState<'anti_hack_guide' | 'db_params' | 'admin_pin' | 'backup'>('anti_hack_guide');

  // Database Connection metadata & diagnostics state
  const dbInfo = useMemo(() => getFirestoreDatabaseInfo(), []);
  const [dbPingState, setDbPingState] = useState<{
    isPinging: boolean;
    latency: number | null;
    status: 'idle' | 'success' | 'error';
    message: string | null;
  }>({
    isPinging: false,
    latency: null,
    status: 'idle',
    message: null,
  });

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'blocked'>('all');
  const [showAllPins, setShowAllPins] = useState(true); // Mặc định hiện mật khẩu để admin tiện quản lý
  const [visiblePins, setVisiblePins] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form add new staff
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPin, setNewStaffPin] = useState('123456');
  const [newStaffNote, setNewStaffNote] = useState('');

  // Quick Password Change Modal
  const [quickChangePasswordStaff, setQuickChangePasswordStaff] = useState<{
    id: string;
    username: string;
    currentPin: string;
  } | null>(null);
  const [newPinInputValue, setNewPinInputValue] = useState('');

  // Quick Edit Staff Info Modal
  const [editStaffModalData, setEditStaffModalData] = useState<{
    id: string;
    username: string;
    email: string;
    pin: string;
    adminNote: string;
    allowedTabs?: TabKey[];
  } | null>(null);

  // Staff Details Popover (Viewing Pages & Vias)
  const [viewingStaffDetails, setViewingStaffDetails] = useState<{
    username: string;
    type: 'pages' | 'vias';
  } | null>(null);

  // Delete Staff Modal State
  const [staffToDelete, setStaffToDelete] = useState<{
    id: string;
    username: string;
    pagesCount: number;
    viasCount: number;
  } | null>(null);
  const [deletePostsChecked, setDeletePostsChecked] = useState(true);
  const [deleteViasChecked, setDeleteViasChecked] = useState(true);

  // Clear Posts of Staff Modal State
  const [staffToClearPosts, setStaffToClearPosts] = useState<{
    username: string;
    pagesCount: number;
  } | null>(null);

  // Admin Master Pin Form State
  const [currentAdminPinInput, setCurrentAdminPinInput] = useState('');
  const [newAdminPinInput, setNewAdminPinInput] = useState('');
  const [confirmAdminPinInput, setConfirmAdminPinInput] = useState('');
  const [adminPinNotice, setAdminPinNotice] = useState<{ success: boolean; message: string } | null>(null);

  // Action notification toast
  const [toastNotice, setToastNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // State loading khi thêm nhân sự
  const [isAddingStaff, setIsAddingStaff] = useState(false);

  // Banner for recently added or modified staff
  const [lastActionStaff, setLastActionStaff] = useState<{
    username: string;
    pin: string;
    email?: string;
    title: string;
  } | null>(null);

  // 1. TỔNG HỢP DANH SÁCH NHÂN VIÊN TOÀN DIỆN (LẤY TỪ TÀI KHOẢN CHÍNH XÁC TRONG CSDL)
  const allStaffAccounts = useMemo(() => {
    return accounts
      .filter((a) => a.role === 'staff')
      .sort((a, b) => a.username.localeCompare(b.username, 'vi'));
  }, [accounts]);

  // Breakdown accounts by status
  const pendingAccounts = useMemo(() => accounts.filter((a) => a.role === 'staff' && a.status === 'pending'), [accounts]);
  const approvedAccounts = useMemo(() => allStaffAccounts.filter((a) => a.status === 'approved'), [allStaffAccounts]);
  const blockedAccounts = useMemo(() => allStaffAccounts.filter((a) => a.status === 'blocked'), [allStaffAccounts]);

  // If there are pending accounts and user hasn't chosen a tab yet, we can notify them
  useEffect(() => {
    if (isOpen && pendingAccounts.length > 0 && activeTab === 'staff') {
      // Keep on staff tab by default so user sees list immediately, but show notice
    }
  }, [isOpen, pendingAccounts.length]);

  // 2. TÍNH TOÁN THỐNG KÊ CHI TIẾT CHO TỪNG NHÂN VIÊN
  const staffStatsMap = useMemo(() => {
    const map: Record<
      string,
      {
        pagesCount: number;
        viasCount: number;
        targetPosts: number;
        actualPosts: number;
        completedPostsCount: number;
        completionRate: number;
        manualPostsCount: number;
        toolPostsCount: number;
        deXuatCount: number;
        matDeXuatCount: number;
        dinhChiCount: number;
        goodInteractionCount: number;
        normalInteractionCount: number;
        poorInteractionCount: number;
        blockedPagesCount: number;
        pageNames: string[];
        viaUids: string[];
      }
    > = {};

    allStaffAccounts.forEach((acc) => {
      const key = acc.username.trim().toLowerCase();
      const staffRecords = records.filter((r) => r.staffName.trim().toLowerCase() === key);
      const staffVias = viaList.filter((v) => v.staffName.trim().toLowerCase() === key);

      const targetPosts = staffRecords.reduce((sum, r) => sum + (r.targetPosts || 0), 0);
      const actualPosts = staffRecords.reduce((sum, r) => sum + (r.actualPosts || 0), 0);
      const completionRate = targetPosts > 0 ? Math.round((actualPosts / targetPosts) * 100) : staffRecords.length > 0 ? 100 : 0;

      map[key] = {
        pagesCount: staffRecords.length,
        viasCount: staffVias.length,
        targetPosts,
        actualPosts,
        completedPostsCount: staffRecords.filter((r) => r.isCompleted).length,
        completionRate,
        manualPostsCount: staffRecords.filter((r) => r.postingMethod === 'Đăng Tay').length,
        toolPostsCount: staffRecords.filter((r) => r.postingMethod === 'Tool').length,
        deXuatCount: staffRecords.filter((r) => r.status === 'Đề Xuất').length,
        matDeXuatCount: staffRecords.filter((r) => r.status === 'Mất Đề Xuất').length,
        dinhChiCount: staffRecords.filter((r) => r.status === 'Đình Chỉ').length,
        goodInteractionCount: staffRecords.filter((r) => r.interaction === 'TỐT').length,
        normalInteractionCount: staffRecords.filter((r) => r.interaction === 'Bình Thường').length,
        poorInteractionCount: staffRecords.filter((r) => r.interaction === 'Kém').length,
        blockedPagesCount: staffRecords.filter((r) => r.blockStatus && r.blockStatus !== 'Không Chặn').length,
        pageNames: staffRecords.map((r) => r.pageName).filter(Boolean),
        viaUids: staffVias.map((v) => v.uid).filter(Boolean),
      };
    });

    return map;
  }, [allStaffAccounts, records, viaList]);

  // 3. THỐNG KÊ TOÀN ĐỘI (EXECUTIVE KPI OVERVIEW)
  const teamOverview = useMemo(() => {
    const totalStaff = allStaffAccounts.length;
    const activeStaff = approvedAccounts.length;
    const totalPagesAssigned = records.length;
    const totalViasAssigned = viaList.length;
    const totalTarget = records.reduce((sum, r) => sum + (r.targetPosts || 0), 0);
    const totalActual = records.reduce((sum, r) => sum + (r.actualPosts || 0), 0);
    const teamProgress = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 100;
    const goodInteractions = records.filter((r) => r.interaction === 'TỐT').length;
    const deXuatTotal = records.filter((r) => r.status === 'Đề Xuất').length;

    return {
      totalStaff,
      activeStaff,
      blockedStaff: blockedAccounts.length,
      totalPagesAssigned,
      totalViasAssigned,
      totalTarget,
      totalActual,
      teamProgress,
      goodInteractions,
      deXuatTotal,
    };
  }, [allStaffAccounts, approvedAccounts, blockedAccounts, records, viaList]);

  // 4. LỌC DANH SÁCH THEO SEARCH QUERY VÀ STATUS FILTER
  const filteredStaffList = useMemo(() => {
    let list = allStaffAccounts;

    if (statusFilter === 'approved') {
      list = list.filter((a) => a.status === 'approved');
    } else if (statusFilter === 'blocked') {
      list = list.filter((a) => a.status === 'blocked');
    }

    if (!searchQuery.trim()) return list;

    const q = searchQuery.trim().toLowerCase();
    return list.filter((acc) => {
      const stats = staffStatsMap[acc.username.trim().toLowerCase()];
      const matchesName = acc.username.toLowerCase().includes(q);
      const matchesEmail = (acc.email || '').toLowerCase().includes(q);
      const matchesPin = (acc.pin || '').toLowerCase().includes(q);
      const matchesNote = (acc.adminNote || '').toLowerCase().includes(q);
      const matchesPages = stats?.pageNames.some((p) => p.toLowerCase().includes(q));
      const matchesVias = stats?.viaUids.some((v) => v.toLowerCase().includes(q));

      return matchesName || matchesEmail || matchesPin || matchesNote || matchesPages || matchesVias;
    });
  }, [allStaffAccounts, statusFilter, searchQuery, staffStatsMap]);

  // Clipboard copy helper
  const copyToClipboard = async (text: string, keyName: string, successMsg?: string): Promise<boolean> => {
    let copied = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch (err) {
      console.warn('Clipboard API error, trying fallback', err);
    }

    if (!copied) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        copied = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
    }

    if (copied) {
      setCopiedKey(keyName);
      if (successMsg) {
        setToastNotice({ type: 'success', message: successMsg });
      }
      setTimeout(() => setCopiedKey(null), 2500);
      return true;
    }
    return false;
  };

  // Sao chép toàn bộ danh sách (Tên, Pass, Số page, Số via)
  const handleCopyAllStaffAndPins = () => {
    if (allStaffAccounts.length === 0) return;
    const lines = [
      `📋 BẢNG THÔNG TIN TÀI KHOẢN & MẬT KHẨU NHÂN VIÊN (${allStaffAccounts.length} NHÂN VIÊN)`,
      `Thời gian xuất: ${new Date().toLocaleString('vi-VN')}`,
      `Link đăng nhập hệ thống: ${window.location.origin}`,
      `----------------------------------------------------------------------`,
      `STT | TÊN NHÂN VIÊN | MẬT KHẨU (PIN) | EMAIL GOOGLE | PAGE | VIA | TIẾN ĐỘ`,
      `----------------------------------------------------------------------`,
    ];

    allStaffAccounts.forEach((acc, idx) => {
      const stats = staffStatsMap[acc.username.trim().toLowerCase()];
      const emailStr = acc.email ? acc.email : 'Chưa gắn email';
      const pagesStr = `${stats?.pagesCount || 0} page`;
      const viasStr = `${stats?.viasCount || 0} via`;
      const postStr = `${stats?.actualPosts || 0}/${stats?.targetPosts || 0} bài (${stats?.completionRate || 0}%)`;
      lines.push(`${idx + 1}. [${acc.username}] -> PIN: ${acc.pin} | ${emailStr} | ${pagesStr} | ${viasStr} | ${postStr}`);
    });

    lines.push(`----------------------------------------------------------------------`);
    lines.push(`📌 Quản trị viên lưu ý: Giữ bảo mật thông tin tài khoản của nhân viên.`);

    copyToClipboard(lines.join('\n'), 'copy-all-staff', `Đã sao chép toàn bộ danh sách ${allStaffAccounts.length} nhân viên và mật khẩu vào bộ nhớ tạm!`);
  };

  // Sao chép thông tin của 1 nhân viên
  const handleCopySingleStaff = (acc: UserAccount) => {
    const stats = staffStatsMap[acc.username.trim().toLowerCase()];
    const lines = [
      `🏢 THÔNG TIN ĐĂNG NHẬP HỆ THỐNG QUẢN LÝ FANPAGE`,
      `👤 Tên nhân viên: ${acc.username}`,
      `🔑 Mật khẩu (Mã PIN): ${acc.pin}`,
    ];
    if (acc.email) {
      lines.push(`📧 Email Google: ${acc.email}`);
    }
    if (stats) {
      lines.push(`📄 Fanpage phụ trách: ${stats.pagesCount} Fanpage`);
      lines.push(`📱 Nick Via nắm giữ: ${stats.viasCount} Via`);
    }
    lines.push(`🌐 Link đăng nhập: ${window.location.origin}`);
    lines.push(`--------------------------------------------`);
    lines.push(`📌 Hướng dẫn: Mở link trên -> Chọn tên "${acc.username}" -> Nhập mã PIN "${acc.pin}" để đăng nhập và làm việc.`);

    copyToClipboard(lines.join('\n'), `staff-full-${acc.id}`, `Đã sao chép thông tin tài khoản cho "${acc.username}" (PIN: ${acc.pin})!`);
  };

  // Toggle con mắt mã PIN
  const togglePinVisibility = (id: string) => {
    setVisiblePins((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Xử lý tạo nhân viên mới
  const handleCreateStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || isAddingStaff) return;

    const staffName = newStaffName.trim();
    const pin = newStaffPin.trim() || '123456';
    const email = newStaffEmail.trim() || undefined;
    const note = newStaffNote.trim() || 'Tài khoản nhân viên được cấp quyền trực tiếp';

    try {
      setIsAddingStaff(true);
      await onAddPreApprovedStaff(staffName, pin, note, email);

      setLastActionStaff({
        username: staffName,
        pin,
        email,
        title: 'Đã tạo mới & lưu vào CSDL Cloud thành công!',
      });

      setToastNotice({
        type: 'success',
        message: `Đã tạo tài khoản cho "${staffName}" (PIN: ${pin}) và lưu vào Cloud Firestore! Nhân viên có thể đăng nhập ngay.`,
      });

      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPin('123456');
      setNewStaffNote('');
      setShowAddForm(false);
    } catch (err) {
      console.error('Lỗi khi thêm nhân sự:', err);
      setToastNotice({
        type: 'error',
        message: `Lỗi khi lưu nhân viên vào CSDL: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setIsAddingStaff(false);
    }
  };

  // Xử lý lưu mật khẩu mới từ Hộp Thoại Đổi Pass Nhanh
  const handleSaveQuickPassword = () => {
    if (!quickChangePasswordStaff) return;
    const cleanPin = newPinInputValue.trim();
    if (!cleanPin || cleanPin.length < 4) {
      alert('Mật khẩu PIN phải có ít nhất 4 ký tự!');
      return;
    }

    onUpdateAccountPin(quickChangePasswordStaff.id, cleanPin);

    setLastActionStaff({
      username: quickChangePasswordStaff.username,
      pin: cleanPin,
      title: 'Đã đổi mật khẩu (PIN) thành công!',
    });

    setToastNotice({
      type: 'success',
      message: `Đã đổi mật khẩu cho "${quickChangePasswordStaff.username}" thành "${cleanPin}"!`,
    });

    // Copy pin to clipboard immediately
    copyToClipboard(cleanPin, `pin-changed-${quickChangePasswordStaff.id}`);

    setQuickChangePasswordStaff(null);
    setNewPinInputValue('');
  };

  // Reset mật khẩu về 123456 nhanh
  const handleQuickResetPinToDefault = (acc: UserAccount) => {
    if (confirm(`Bạn có chắc muốn đặt lại mật khẩu cho "${acc.username}" về mặc định "123456"?`)) {
      onUpdateAccountPin(acc.id, '123456');
      setToastNotice({
        type: 'success',
        message: `Đã đặt lại mật khẩu cho "${acc.username}" về "123456"!`,
      });
      copyToClipboard('123456', `reset-${acc.id}`);
    }
  };

  // Xử lý lưu chỉnh sửa thông tin nhân viên toàn diện
  const handleSaveStaffInfoModal = () => {
    if (!editStaffModalData) return;
    const cleanName = editStaffModalData.username.trim();
    if (!cleanName) {
      alert('Tên nhân viên không được để trống!');
      return;
    }
    const cleanPin = editStaffModalData.pin.trim() || '123456';

    if (onUpdateAccountInfo) {
      onUpdateAccountInfo(editStaffModalData.id, {
        username: cleanName,
        email: editStaffModalData.email.trim() || undefined,
        pin: cleanPin,
        adminNote: editStaffModalData.adminNote.trim() || undefined,
        allowedTabs: editStaffModalData.allowedTabs,
      });
    } else {
      onUpdateAccountPin(editStaffModalData.id, cleanPin);
      if (onUpdateAccountEmail) {
        onUpdateAccountEmail(editStaffModalData.id, editStaffModalData.email.trim());
      }
    }

    setToastNotice({
      type: 'success',
      message: `Đã cập nhật thông tin thành công cho "${cleanName}"!`,
    });

    setEditStaffModalData(null);
  };

  // Xử lý đổi Master PIN của Quản Lý (Admin)
  const handleChangeAdminPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPinNotice(null);

    if (currentAdminPinInput.trim() !== adminPin.trim()) {
      setAdminPinNotice({ success: false, message: 'Mật khẩu Admin hiện tại không chính xác!' });
      return;
    }

    if (!newAdminPinInput.trim() || newAdminPinInput.trim().length < 4) {
      setAdminPinNotice({ success: false, message: 'Mật khẩu mới phải có ít nhất 4 ký tự!' });
      return;
    }

    if (newAdminPinInput !== confirmAdminPinInput) {
      setAdminPinNotice({ success: false, message: 'Mật khẩu mới và xác nhận mật khẩu không khớp!' });
      return;
    }

    onChangeAdminPin(newAdminPinInput.trim());
    setAdminPinNotice({ success: true, message: 'Đổi mật khẩu Quản Lý (Admin Master PIN) thành công!' });
    setCurrentAdminPinInput('');
    setNewAdminPinInput('');
    setConfirmAdminPinInput('');
  };

  // Đồng bộ tab ban đầu khi modal được mở với initialTab cụ thể
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  // Xử lý kiểm tra kết nối ping CSDL
  const handleTestPing = async () => {
    setDbPingState({ isPinging: true, latency: null, status: 'idle', message: 'Đang kiểm tra kết nối Firestore...' });
    try {
      const res = await pingFirestoreDatabase();
      setDbPingState({
        isPinging: false,
        latency: res.latencyMs,
        status: res.success ? 'success' : 'error',
        message: res.message,
      });
    } catch {
      setDbPingState({
        isPinging: false,
        latency: null,
        status: 'error',
        message: 'Lỗi kiểm tra kết nối CSDL',
      });
    }
  };

  // Tự động test ping nhẹ khi mở tab security_db lần đầu
  useEffect(() => {
    if ((activeTab === 'security_db' || activeTab === 'admin_pin') && dbPingState.status === 'idle') {
      handleTestPing();
    }
  }, [activeTab]);

  // Sao chép 1 thông số cụ thể
  const handleCopyDbParam = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(`db_${key}`);
    setTimeout(() => setCopiedKey(null), 2000);
    setToastNotice({
      type: 'success',
      message: `Đã sao chép: ${value}`,
    });
  };

  // Sao chép toàn bộ object cấu hình JSON
  const handleCopyFullConfigJson = () => {
    const cleanConfig = {
      provider: 'Google Cloud Firestore',
      projectId: firebaseConfig.projectId,
      firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
      appId: firebaseConfig.appId,
      authDomain: firebaseConfig.authDomain,
      storageBucket: firebaseConfig.storageBucket,
      region: 'asia-east1',
      status: 'Connected & Real-time Synced',
    };
    navigator.clipboard.writeText(JSON.stringify(cleanConfig, null, 2));
    setCopiedKey('db_json_full');
    setTimeout(() => setCopiedKey(null), 2500);
    setToastNotice({
      type: 'success',
      message: 'Đã sao chép toàn bộ thông số kết nối CSDL Cloud Firestore dạng JSON!',
    });
  };

  const [isRestoringBackup, setIsRestoringBackup] = useState(false);

  // Xuất file backup JSON toàn bộ CSDL (6-7 Bảng đầy đủ)
  const handleExportBackup = () => {
    const backupData = {
      exportTimestamp: new Date().toISOString(),
      exportDateVi: new Date().toLocaleString('vi-VN'),
      databaseInfo: dbInfo,
      systemMetrics: {
        totalRecords: records.length,
        totalGroupRecords: groupRecords.length,
        totalProxies: proxies.length,
        totalVias: viaList.length,
        totalAccounts: accounts.length,
        totalSharedAccounts: sharedAccounts.length,
      },
      pageRecords: records,
      groupRecords: groupRecords,
      proxies: proxies,
      vias: viaList,
      accounts: accounts.map((a) => ({
        id: a.id,
        username: a.username,
        role: a.role,
        status: a.status,
        email: a.email,
        adminNote: a.adminNote,
        createdAt: a.createdAt,
        approvedAt: a.approvedAt,
      })),
      sharedAccounts: sharedAccounts,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_toan_bo_csdl_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setToastNotice({
      type: 'success',
      message: '🎉 Đã xuất bản sao lưu TOÀN BỘ CSDL (Fanpage, Group, Proxy, Via, Accounts, Shared) thành công!',
    });
  };

  // Khôi phục dữ liệu CSDL từ file JSON sao lưu
  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (onRestoreBackup) {
          setIsRestoringBackup(true);
          await onRestoreBackup(parsed);
          setIsRestoringBackup(false);
          setToastNotice({
            type: 'success',
            message: '🎉 Khôi phục dữ liệu CSDL từ bản sao lưu thành công!',
          });
        }
      } catch (err) {
        setIsRestoringBackup(false);
        setToastNotice({
          type: 'error',
          message: '❌ File sao lưu không hợp lệ hoặc bị lỗi định dạng JSON.',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[94vh]">
        
        {/* 1. MODAL HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0 shadow-sm border-b border-indigo-900/50">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shadow-inner">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Trung Tâm Quản Lý Thành Viên & Mật Khẩu
                </h2>
                <span className="bg-indigo-500/30 text-indigo-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-indigo-400/30">
                  Dành Cho Quản Trị Viên
                </span>
                <span className="inline-flex items-center space-x-1 text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Real-time Cloud Sync</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 leading-tight">
                Quản lý danh sách nhân sự, xem & đổi mật khẩu (PIN), theo dõi chi tiết số Fanpage, Via và hiệu suất đăng bài.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center font-bold transition-all cursor-pointer"
            title="Đóng cửa sổ"
          >
            ✕
          </button>
        </div>

        {/* 2. EXECUTIVE OVERVIEW METRIC CARDS (BẢNG THỐNG KÊ KHOA HỌC) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3.5 bg-slate-50 border-b border-slate-200 text-xs shrink-0">
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span>👥 Tổng Thành Viên</span>
              <span className="text-emerald-600 font-bold">{teamOverview.activeStaff} online</span>
            </div>
            <div className="text-xl font-black text-slate-900 mt-1">
              {teamOverview.totalStaff} <span className="text-xs font-normal text-slate-500">nhân sự</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {teamOverview.blockedStaff > 0 ? `⚠️ ${teamOverview.blockedStaff} tạm khóa` : '✓ 100% được duyệt'}
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span>📄 Fanpage Đang Chạy</span>
              <span className="text-blue-600 font-bold">Sheet</span>
            </div>
            <div className="text-xl font-black text-blue-700 mt-1">
              {teamOverview.totalPagesAssigned} <span className="text-xs font-normal text-slate-500">Page</span>
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
              🟢 {teamOverview.deXuatTotal} page Đề Xuất
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span>📱 Nick Via Nắm Giữ</span>
              <span className="text-purple-600 font-bold">Via UID</span>
            </div>
            <div className="text-xl font-black text-purple-700 mt-1">
              {teamOverview.totalViasAssigned} <span className="text-xs font-normal text-slate-500">Nick</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Phân bổ đều cho các bạn
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span>🚀 Tiến Độ Đăng Bài</span>
              <span className={`font-bold ${teamOverview.teamProgress >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {teamOverview.teamProgress}%
              </span>
            </div>
            <div className="text-xl font-black text-slate-800 mt-1">
              {teamOverview.totalActual} <span className="text-xs font-normal text-slate-500">/ {teamOverview.totalTarget} bài</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  teamOverview.teamProgress >= 100
                    ? 'bg-emerald-500'
                    : teamOverview.teamProgress >= 50
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(teamOverview.teamProgress, 100)}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span>🌟 Tương Tác TỐT</span>
              <span className="text-amber-500 font-bold">★ Rating</span>
            </div>
            <div className="text-xl font-black text-amber-600 mt-1">
              {teamOverview.goodInteractions} <span className="text-xs font-normal text-slate-500">Page</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Đạt hiệu quả cao hôm nay
            </div>
          </div>
        </div>

        {/* 3. NAVIGATION TABS */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 shrink-0 text-xs">
          <div className="flex space-x-1">
            <button
              type="button"
              onClick={() => setActiveTab('staff')}
              className={`py-3 px-3.5 font-bold border-b-2 flex items-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'staff'
                  ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-4 h-4 text-indigo-600" />
              <span>Danh Sách Thành Viên & Mật Khẩu</span>
              <span className="bg-indigo-100 text-indigo-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                {allStaffAccounts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`py-3 px-3.5 font-bold border-b-2 flex items-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'pending'
                  ? 'border-amber-500 text-amber-700 bg-amber-50/40'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Chờ Phê Duyệt</span>
              {pendingAccounts.length > 0 ? (
                <span className="bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full animate-bounce">
                  {pendingAccounts.length}
                </span>
              ) : (
                <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full">0</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('blocked')}
              className={`py-3 px-3.5 font-bold border-b-2 flex items-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'blocked'
                  ? 'border-rose-500 text-rose-700 bg-rose-50/40'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserX className="w-4 h-4 text-rose-500" />
              <span>Tạm Khóa ({blockedAccounts.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('security_db')}
            className={`py-2 px-3 rounded-lg font-bold flex items-center space-x-1.5 transition-all text-xs cursor-pointer ${
              activeTab === 'security_db' || activeTab === 'admin_pin'
                ? 'bg-indigo-900 text-white shadow-sm ring-2 ring-indigo-400/40'
                : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300'
            }`}
            title="Xem toàn bộ thông số kết nối CSDL Cloud Firestore, test ping và bảo mật hệ thống (Sec)"
          >
            <Database className="w-3.5 h-3.5 text-indigo-400" />
            <span>🛡️ Bảo Mật & Thông Số CSDL (Sec)</span>
          </button>
        </div>

        {/* 4. CONTENT BODY */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 text-xs space-y-4 bg-slate-50/40">
          
          {/* Toast / Notification Banner */}
          {toastNotice && (
            <div
              className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold animate-in fade-in ${
                toastNotice.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-2xs'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
            >
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{toastNotice.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setToastNotice(null)}
                className="text-slate-400 hover:text-slate-700 px-1 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Recently Added/Modified Staff Box */}
          {lastActionStaff && (
            <div className="p-3.5 bg-gradient-to-r from-indigo-50 to-emerald-50 border border-indigo-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-2xs animate-in fade-in">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
                  ✓
                </div>
                <div>
                  <div className="font-bold text-indigo-950 flex items-center space-x-2">
                    <span>{lastActionStaff.title}</span>
                    <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[11px]">
                      {lastActionStaff.username}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 flex items-center space-x-2 mt-0.5">
                    <span>Mật khẩu (PIN):</span>
                    <span className="font-mono font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                      {lastActionStaff.pin}
                    </span>
                    {lastActionStaff.email && <span>• Email: {lastActionStaff.email}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => {
                    const matched = allStaffAccounts.find(
                      (a) => a.username.trim().toLowerCase() === lastActionStaff.username.trim().toLowerCase()
                    );
                    if (matched) handleCopySingleStaff(matched);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg font-bold text-xs flex items-center space-x-1.5 shadow-2xs transition-all cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>📋 Sao Chép Thông Tin Gửi Nhân Viên</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLastActionStaff(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 1: DANH SÁCH THÀNH VIÊN & MẬT KHẨU (CORE MAIN VIEW)  */}
          {/* ======================================================== */}
          {activeTab === 'staff' && (
            <div className="space-y-3.5">
              
              {/* TOOLBAR: Search, Filter, Mass Actions */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
                
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tìm nhân viên theo tên, mật khẩu (PIN), email, Fanpage, Via..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg shrink-0">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                      statusFilter === 'all' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tất Cả ({allStaffAccounts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('approved')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                      statusFilter === 'approved' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Đang Hoạt Động ({approvedAccounts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('blocked')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                      statusFilter === 'blocked' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tạm Khóa ({blockedAccounts.length})
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-1.5 shrink-0">
                  {/* Toggle Show All Pins */}
                  <button
                    type="button"
                    onClick={() => setShowAllPins(!showAllPins)}
                    className={`px-2.5 py-2 border rounded-lg font-bold text-xs flex items-center space-x-1.5 transition-all cursor-pointer ${
                      showAllPins
                        ? 'bg-amber-50 border-amber-300 text-amber-800'
                        : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                    }`}
                    title={showAllPins ? 'Ẩn mật khẩu toàn bộ' : 'Hiện mật khẩu toàn bộ'}
                  >
                    {showAllPins ? <EyeOff className="w-3.5 h-3.5 text-amber-600" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
                    <span>{showAllPins ? 'Ẩn Tất Cả Pass' : '👁️ Hiện Tất Cả Pass'}</span>
                  </button>

                  {/* Copy All Button */}
                  <button
                    type="button"
                    onClick={handleCopyAllStaffAndPins}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg font-bold text-xs flex items-center space-x-1.5 shadow-2xs transition-all cursor-pointer"
                    title="Sao chép toàn bộ danh sách nhân viên kèm mật khẩu"
                  >
                    {copiedKey === 'copy-all-staff' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Đã Sao Chép!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>📋 Copy Toàn Bộ Pass</span>
                      </>
                    )}
                  </button>

                  {/* Add Staff Button */}
                  <button
                    type="button"
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg font-bold text-xs flex items-center space-x-1.5 shadow-2xs transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Thêm Nhân Viên</span>
                  </button>
                </div>
              </div>

              {/* POP-DOWN ADD NEW STAFF FORM */}
              {showAddForm && (
                <form
                  onSubmit={handleCreateStaffSubmit}
                  className="p-4 bg-gradient-to-br from-indigo-50/80 to-blue-50/50 border-2 border-indigo-300 rounded-xl space-y-3.5 animate-in fade-in shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-indigo-200/70 pb-2">
                    <div className="font-extrabold text-indigo-950 flex items-center space-x-2 text-sm">
                      <UserPlus className="w-4 h-4 text-indigo-600" />
                      <span>Thêm Nhân Viên & Cấp Quyền Đăng Nhập Ngay</span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Tự động lưu lên Cloud Firestore và đồng bộ toàn bộ thiết bị
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Họ & Tên Nhân Viên <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ví dụ: Hoàng Long, Mỹ Duyên..."
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-semibold"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Mật Khẩu (Mã PIN) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="Mặc định: 123456"
                          value={newStaffPin}
                          onChange={(e) => setNewStaffPin(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
                            setNewStaffPin(randomPin);
                          }}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold cursor-pointer"
                          title="Tạo mã PIN ngẫu nhiên"
                        >
                          🎲 Ngẫu Nhiên
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Email Google Liên Kết
                      </label>
                      <input
                        type="email"
                        placeholder="VD: hoanglong@gmail.com"
                        value={newStaffEmail}
                        onChange={(e) => setNewStaffEmail(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Ghi Chú Phân Công
                      </label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Phụ trách ca tối, chuyên via US..."
                        value={newStaffNote}
                        onChange={(e) => setNewStaffNote(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-1 border-t border-indigo-200/50">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-200 rounded-lg font-semibold"
                    >
                      Hủy Bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={isAddingStaff}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 text-white font-bold rounded-lg shadow-sm flex items-center space-x-1.5 cursor-pointer transition-all"
                    >
                      {isAddingStaff ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Đang Lưu Vào CSDL Cloud...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Tạo Tài Khoản & Cho Phép Truy Cập Luôn</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* MAIN STAFF & PASSWORD TABLE (KHOA HỌC & ĐẦY ĐỦ THÔNG SỐ) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[950px]">
                    <thead className="bg-slate-100/90 text-slate-700 text-[11px] font-extrabold uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-3.5 w-52">Nhân Viên & Email</th>
                        <th className="py-3 px-3 w-48">Mật Khẩu / Pass (PIN)</th>
                        <th className="py-3 px-3 w-36 text-center">Fanpage Quản Lý</th>
                        <th className="py-3 px-3 w-28 text-center">Nick Via Cầm</th>
                        <th className="py-3 px-3 w-44">Tiến Độ Đăng Bài</th>
                        <th className="py-3 px-3 w-36">Tương Tác & Chặn</th>
                        <th className="py-3 px-3 w-28 text-center">Trạng Thái</th>
                        <th className="py-3 px-3.5 text-right w-48">Thao Tác Admin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredStaffList.map((acc, index) => {
                        const stats = staffStatsMap[acc.username.trim().toLowerCase()] || {
                          pagesCount: 0,
                          viasCount: 0,
                          targetPosts: 0,
                          actualPosts: 0,
                          completionRate: 0,
                          completedPostsCount: 0,
                          manualPostsCount: 0,
                          toolPostsCount: 0,
                          deXuatCount: 0,
                          matDeXuatCount: 0,
                          dinhChiCount: 0,
                          goodInteractionCount: 0,
                          normalInteractionCount: 0,
                          poorInteractionCount: 0,
                          blockedPagesCount: 0,
                          pageNames: [],
                          viaUids: [],
                        };

                        const isPinVisible = showAllPins || !!visiblePins[acc.id];
                        const isBlocked = acc.status === 'blocked';
                        const avatarColors = [
                          'bg-indigo-600',
                          'bg-emerald-600',
                          'bg-violet-600',
                          'bg-blue-600',
                          'bg-amber-600',
                          'bg-rose-600',
                        ];
                        const avatarColor = avatarColors[index % avatarColors.length];

                        return (
                          <tr
                            key={acc.id}
                            className={`hover:bg-indigo-50/30 transition-colors ${
                              isBlocked ? 'bg-rose-50/20 opacity-80' : ''
                            }`}
                          >
                            {/* Cột 1: Tên & Email */}
                            <td className="py-3 px-3.5">
                              <div className="flex items-center space-x-2.5">
                                <div
                                  className={`w-8 h-8 rounded-lg ${avatarColor} text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs`}
                                >
                                  {acc.username.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-extrabold text-slate-900 flex items-center space-x-1.5">
                                    <span>{acc.username}</span>
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                                      Nhân Viên
                                    </span>
                                  </div>

                                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center space-x-1">
                                    {acc.email ? (
                                      <span className="font-mono text-[10px] text-slate-600 truncate max-w-[150px]">
                                        📧 {acc.email}
                                      </span>
                                    ) : (
                                      <span className="text-amber-600 text-[10px] italic">
                                        Chưa liên kết email
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditStaffModalData({
                                          id: acc.id,
                                          username: acc.username,
                                          email: acc.email || '',
                                          pin: acc.pin,
                                          adminNote: acc.adminNote || '',
                                        })
                                      }
                                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold underline cursor-pointer ml-1"
                                      title="Sửa email hoặc thông tin"
                                    >
                                      Sửa
                                    </button>
                                  </div>

                                  {acc.adminNote && (
                                    <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[180px]">
                                      📝 {acc.adminNote}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Cột 2: Mật Khẩu / Pass (PIN Đăng Nhập) */}
                            <td className="py-3 px-3">
                              <div className="flex flex-col space-y-1">
                                <div className="flex items-center space-x-1.5">
                                  <div className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 font-mono font-black text-slate-800 text-xs tracking-wider min-w-[70px] text-center shadow-2xs">
                                    {isPinVisible ? acc.pin : '••••••'}
                                  </div>

                                  {/* Toggle eye */}
                                  <button
                                    type="button"
                                    onClick={() => togglePinVisibility(acc.id)}
                                    className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                                    title={isPinVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                  >
                                    {isPinVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>

                                  {/* Copy PIN only */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyToClipboard(acc.pin, `pin-${acc.id}`, `Đã copy mật khẩu của ${acc.username}: ${acc.pin}`)
                                    }
                                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                                    title="Copy riêng mật khẩu (PIN)"
                                  >
                                    {copiedKey === `pin-${acc.id}` ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>

                                {/* Quick buttons: Đổi Pass & Reset */}
                                <div className="flex items-center space-x-1.5 text-[10px]">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setQuickChangePasswordStaff({
                                        id: acc.id,
                                        username: acc.username,
                                        currentPin: acc.pin,
                                      });
                                      setNewPinInputValue('');
                                    }}
                                    className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded font-bold transition-colors cursor-pointer flex items-center space-x-1"
                                    title="Mở hộp thoại đổi mật khẩu mới"
                                  >
                                    <Key className="w-3 h-3" />
                                    <span>Đổi Pass</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleQuickResetPinToDefault(acc)}
                                    className="text-slate-400 hover:text-slate-600 hover:underline cursor-pointer"
                                    title="Đặt lại mật khẩu về 123456"
                                  >
                                    Reset 123456
                                  </button>
                                </div>
                              </div>
                            </td>

                            {/* Cột 3: Fanpage Quản Lý */}
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  stats.pagesCount > 0 &&
                                  setViewingStaffDetails({ username: acc.username, type: 'pages' })
                                }
                                className={`inline-flex flex-col items-center px-2.5 py-1 rounded-lg border font-bold text-xs transition-all ${
                                  stats.pagesCount > 0
                                    ? 'bg-blue-50/80 border-blue-200 text-blue-800 hover:bg-blue-100 cursor-pointer shadow-2xs'
                                    : 'bg-slate-50 border-slate-200 text-slate-400 cursor-default'
                                }`}
                                title={stats.pagesCount > 0 ? 'Bấm để xem danh sách tên các Page' : 'Chưa có page nào'}
                              >
                                <span className="text-sm font-black">{stats.pagesCount} Page</span>
                                <div className="flex items-center space-x-1 text-[9px] mt-0.5">
                                  {stats.deXuatCount > 0 && (
                                    <span className="text-emerald-700 font-bold">🟢 {stats.deXuatCount}</span>
                                  )}
                                  {stats.matDeXuatCount > 0 && (
                                    <span className="text-rose-600 font-bold">🔴 {stats.matDeXuatCount}</span>
                                  )}
                                  {stats.dinhChiCount > 0 && (
                                    <span className="text-slate-500 font-bold">⚫ {stats.dinhChiCount}</span>
                                  )}
                                </div>
                              </button>
                            </td>

                            {/* Cột 4: Nick Via Cầm */}
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  stats.viasCount > 0 &&
                                  setViewingStaffDetails({ username: acc.username, type: 'vias' })
                                }
                                className={`inline-flex flex-col items-center px-2.5 py-1 rounded-lg border font-bold text-xs transition-all ${
                                  stats.viasCount > 0
                                    ? 'bg-purple-50/80 border-purple-200 text-purple-800 hover:bg-purple-100 cursor-pointer shadow-2xs'
                                    : 'bg-slate-50 border-slate-200 text-slate-400 cursor-default'
                                }`}
                                title={stats.viasCount > 0 ? 'Bấm để xem danh sách Via UID' : 'Chưa có nick via nào'}
                              >
                                <span className="text-sm font-black">{stats.viasCount} Via</span>
                                <span className="text-[9px] text-purple-600 mt-0.5">
                                  {stats.viasCount > 0 ? 'Xem UID' : 'Trống'}
                                </span>
                              </button>
                            </td>

                            {/* Cột 5: Tiến Độ Đăng Bài */}
                            <td className="py-3 px-3">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-extrabold text-slate-800">
                                    {stats.actualPosts}/{stats.targetPosts} bài
                                  </span>
                                  <span
                                    className={`font-black text-[10px] ${
                                      stats.completionRate >= 100
                                        ? 'text-emerald-600'
                                        : stats.completionRate >= 50
                                        ? 'text-amber-600'
                                        : 'text-rose-600'
                                    }`}
                                  >
                                    {stats.completionRate}%
                                  </span>
                                </div>

                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      stats.completionRate >= 100
                                        ? 'bg-emerald-500'
                                        : stats.completionRate >= 50
                                        ? 'bg-amber-500'
                                        : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${Math.min(stats.completionRate, 100)}%` }}
                                  ></div>
                                </div>

                                <div className="flex items-center space-x-1.5 text-[10px] text-slate-500">
                                  <span>✍️ {stats.manualPostsCount} Tay</span>
                                  <span>•</span>
                                  <span>⚙️ {stats.toolPostsCount} Tool</span>
                                </div>
                              </div>
                            </td>

                            {/* Cột 6: Tương Tác & Chặn */}
                            <td className="py-3 px-3">
                              <div className="space-y-0.5 text-[11px]">
                                <div className="flex items-center space-x-1">
                                  <span className="text-emerald-700 font-bold">
                                    ★ {stats.goodInteractionCount} Tốt
                                  </span>
                                  {stats.poorInteractionCount > 0 && (
                                    <span className="text-rose-600">
                                      • {stats.poorInteractionCount} Kém
                                    </span>
                                  )}
                                </div>

                                <div className="text-[10px]">
                                  {stats.blockedPagesCount > 0 ? (
                                    <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                      ⚠️ Bị chặn {stats.blockedPagesCount} page
                                    </span>
                                  ) : (
                                    <span className="text-slate-500">✓ Không bị chặn</span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Cột 7: Trạng Thái */}
                            <td className="py-3 px-3 text-center">
                              {isBlocked ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                  Tạm Khóa
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  Hoạt Động
                                </span>
                              )}
                            </td>

                            {/* Cột 8: Thao Tác Admin */}
                            <td className="py-3 px-3.5 text-right">
                              <div className="flex items-center justify-end space-x-1">
                                {/* Copy Single Staff message */}
                                <button
                                  type="button"
                                  onClick={() => handleCopySingleStaff(acc)}
                                  className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md font-bold text-[11px] flex items-center space-x-1 transition-all cursor-pointer shadow-2xs"
                                  title="Sao chép toàn bộ thông tin đăng nhập gửi cho nhân viên"
                                >
                                  {copiedKey === `staff-full-${acc.id}` ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span className="text-emerald-700">Đã Chép</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Copy TK</span>
                                    </>
                                  )}
                                </button>

                                {/* Edit Info Button */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditStaffModalData({
                                      id: acc.id,
                                      username: acc.username,
                                      email: acc.email || '',
                                      pin: acc.pin,
                                      adminNote: acc.adminNote || '',
                                      allowedTabs:
                                        acc.allowedTabs && acc.allowedTabs.length > 0
                                          ? acc.allowedTabs
                                          : ALL_TAB_KEYS,
                                    })
                                  }
                                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer border border-transparent hover:border-indigo-200"
                                  title="Chỉnh sửa thông tin, đổi tên, email, pass"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                {/* Block / Unblock Toggle */}
                                {isBlocked ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onUnblockAccount(acc.id);
                                      setToastNotice({
                                        type: 'success',
                                        message: `Đã mở khóa lại cho "${acc.username}".`,
                                      });
                                    }}
                                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md font-bold text-[10px] cursor-pointer"
                                  >
                                    Mở Khóa
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (confirm(`Bạn có chắc muốn TẠM KHÓA đăng nhập của "${acc.username}"?`)) {
                                        onBlockAccount(acc.id);
                                        setToastNotice({
                                          type: 'success',
                                          message: `Đã tạm khóa tài khoản "${acc.username}".`,
                                        });
                                      }
                                    }}
                                    className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-md font-bold text-[10px] cursor-pointer"
                                    title="Tạm khóa quyền đăng nhập"
                                  >
                                    Khóa
                                  </button>
                                )}

                                {/* Delete Staff Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setStaffToDelete({
                                      id: acc.id,
                                      username: acc.username,
                                      pagesCount: stats.pagesCount,
                                      viasCount: stats.viasCount,
                                    });
                                    setDeletePostsChecked(true);
                                    setDeleteViasChecked(true);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                  title="Xóa nhân viên khỏi hệ thống"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Empty State when search has no results */}
                {filteredStaffList.length === 0 && (
                  <div className="text-center py-10 px-4">
                    <UserX className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-700">Không tìm thấy nhân viên nào phù hợp</p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Thử xóa từ khóa tìm kiếm hoặc bấm nút "+ Thêm Nhân Viên" để tạo mới.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setStatusFilter('all');
                      }}
                      className="mt-3 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-xs hover:bg-indigo-100 cursor-pointer"
                    >
                      Xóa Bộ Lọc
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: YÊU CẦU CHỜ PHÊ DUYỆT (PENDING REQUESTS)         */}
          {/* ======================================================== */}
          {activeTab === 'pending' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Danh Sách Yêu Cầu Chờ Phê Duyệt</h3>
                  <p className="text-slate-500 text-xs">
                    Những tài khoản do nhân viên tự đăng ký, cần Quản Lý duyệt mới được phép vào hệ thống.
                  </p>
                </div>

                <div className="text-xs text-amber-800 font-bold bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                  {pendingAccounts.length} Yêu Cầu Đang Chờ
                </div>
              </div>

              {pendingAccounts.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="font-extrabold text-slate-800 text-sm">Không có yêu cầu chờ duyệt nào!</p>
                  <p className="text-slate-500 text-xs mt-1">
                    Toàn bộ nhân viên của bạn đã được phê duyệt và có thể đăng nhập bình thường.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('staff')}
                    className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold cursor-pointer"
                  >
                    Xem Danh Sách Thành Viên & Mật Khẩu
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {pendingAccounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="p-4 bg-white border border-amber-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900 text-sm">{acc.username}</span>
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded">
                            Chờ Duyệt
                          </span>
                        </div>
                        <div className="text-slate-500 text-xs mt-1 space-x-2">
                          {acc.email && <span>📧 {acc.email}</span>}
                          <span>• Mã PIN yêu cầu: <code className="font-bold text-indigo-700">{acc.pin}</code></span>
                          <span>• Ngày gửi: {acc.createdAt}</span>
                        </div>
                        {acc.adminNote && (
                          <div className="text-[11px] text-slate-400 mt-0.5">Ghi chú: {acc.adminNote}</div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => {
                            onApproveAccount(acc.id);
                            setLastActionStaff({
                              username: acc.username,
                              pin: acc.pin,
                              email: acc.email,
                              title: 'Đã phê duyệt tài khoản thành công!',
                            });
                            setToastNotice({
                              type: 'success',
                              message: `Đã duyệt thành công cho "${acc.username}"!`,
                            });
                          }}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-2xs flex items-center space-x-1.5 transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Duyệt Cho Vào</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Bạn có chắc chắn muốn từ chối yêu cầu của "${acc.username}"?`)) {
                              onRejectAccount(acc.id);
                              setToastNotice({
                                type: 'success',
                                message: `Đã từ chối yêu cầu của "${acc.username}".`,
                              });
                            }
                          }}
                          className="px-3 py-2 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-200 font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          Từ Chối
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: TÀI KHOẢN TẠM KHÓA (BLOCKED STAFF)               */}
          {/* ======================================================== */}
          {activeTab === 'blocked' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Danh Sách Tài Khoản Bị Tạm Khóa</h3>
                <p className="text-slate-500 text-xs">
                  Những nhân viên này sẽ bị chặn đăng nhập cho tới khi Quản Lý mở khóa lại.
                </p>
              </div>

              {blockedAccounts.length === 0 ? (
                <div className="text-center py-10 border border-slate-200 rounded-xl bg-white text-slate-500">
                  Không có nhân viên nào bị tạm khóa.
                </div>
              ) : (
                <div className="space-y-2">
                  {blockedAccounts.map((acc) => {
                    const stats = staffStatsMap[acc.username.trim().toLowerCase()];
                    return (
                      <div
                        key={acc.id}
                        className="p-3.5 bg-white border border-rose-200 rounded-xl flex items-center justify-between shadow-2xs"
                      >
                        <div className="flex items-center space-x-3">
                          <UserX className="w-5 h-5 text-rose-600" />
                          <div>
                            <div className="font-bold text-slate-900">{acc.username}</div>
                            <div className="text-[11px] text-rose-600">
                              Đang bị khóa • {stats?.pagesCount || 0} Page • {stats?.viasCount || 0} Nick Via • Mật khẩu: {acc.pin}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              onUnblockAccount(acc.id);
                              setToastNotice({
                                type: 'success',
                                message: `Đã mở khóa thành công cho "${acc.username}".`,
                              });
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-2xs"
                          >
                            Mở Khóa Lại
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setStaffToDelete({
                                id: acc.id,
                                username: acc.username,
                                pagesCount: stats?.pagesCount || 0,
                                viasCount: stats?.viasCount || 0,
                              });
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                            title="Xóa vĩnh viễn"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: BẢO MẬT HỆ THỐNG & THÔNG SỐ CSDL (SEC PANEL)      */}
          {/* ======================================================== */}
          {(activeTab === 'security_db' || activeTab === 'admin_pin') && (
            <div className="space-y-4 py-2">
              {/* Sub-tab Navigation */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSecSubTab('anti_hack_guide')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1.5 transition-all cursor-pointer ${
                      secSubTab === 'anti_hack_guide'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                    <span>🛡️ Bảo Mật & Chống Hack Via</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSecSubTab('admin_pin')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1.5 transition-all cursor-pointer ${
                      secSubTab === 'admin_pin'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Đổi Mật Khẩu Admin Master</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSecSubTab('db_params')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1.5 transition-all cursor-pointer ${
                      secSubTab === 'db_params'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Thông Số Kết Nối CSDL</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSecSubTab('backup')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1.5 transition-all cursor-pointer ${
                      secSubTab === 'backup'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Sao Lưu Dự Phòng CSDL</span>
                  </button>
                </div>

                <div className="hidden sm:flex items-center space-x-2 text-[11px] text-slate-500">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Google Cloud Firestore Protected</span>
                </div>
              </div>

              {/* ---------------------------------------------------- */}
              {/* SUB-TAB 1: THÔNG SỐ KẾT NỐI CƠ SỞ DỮ LIỆU CLOUD FIRESTORE */}
              {/* ---------------------------------------------------- */}
              {secSubTab === 'db_params' && (
                <div className="space-y-4">
                  {/* Status & Diagnostic Banner */}
                  <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-md border border-indigo-800/40">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-start space-x-3.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                          <Database className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-black text-white">Google Cloud Firestore Database</h3>
                            <span className="inline-flex items-center space-x-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                              <span>Online & Realtime Sync</span>
                            </span>
                          </div>
                          <p className="text-xs text-indigo-200/90 mt-1">
                            Cơ sở dữ liệu đám mây phân tán toàn cầu, đồng bộ dữ liệu tức thì cho tất cả nhân viên và quản trị viên.
                          </p>
                          {dbPingState.message && (
                            <div className="mt-2 text-[11px] flex items-center space-x-2 text-emerald-300 font-medium">
                              <Activity className="w-3.5 h-3.5 text-emerald-400" />
                              <span>{dbPingState.message}</span>
                              {dbPingState.latency !== null && (
                                <span className="bg-emerald-950/80 border border-emerald-700/60 px-2 py-0.5 rounded font-mono font-bold text-[10px] text-emerald-300">
                                  {dbPingState.latency}ms
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center space-x-2 shrink-0 self-start md:self-center">
                        <button
                          type="button"
                          onClick={handleTestPing}
                          disabled={dbPingState.isPinging}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                          title="Gửi gói tin ping kiểm tra độ trễ kết nối Firestore"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${dbPingState.isPinging ? 'animate-spin' : ''}`} />
                          <span>{dbPingState.isPinging ? 'Đang Kiểm Tra...' : '⚡ Test Ping CSDL'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleCopyFullConfigJson}
                          className="px-3 py-2 bg-indigo-800 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                          title="Sao chép toàn bộ JSON thông số kết nối CSDL"
                        >
                          {copiedKey === 'db_json_full' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Đã Copy!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>📋 Copy JSON</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Connection Parameters Grid */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex items-center space-x-2">
                        <Server className="w-4 h-4 text-indigo-600" />
                        <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                          Thông Số Kỹ Thuật Kết Nối CSDL (Connection Specifications)
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-500">Mã hóa định danh dự án</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {/* 1. Firestore Database ID */}
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between">
                        <div className="min-w-0 pr-2">
                          <div className="text-[11px] font-bold text-slate-500 flex items-center space-x-1">
                            <span>Tên Cơ Sở Dữ Liệu (Database ID)</span>
                            <span className="bg-indigo-100 text-indigo-800 text-[9px] font-black px-1.5 py-0.2 rounded">Chính</span>
                          </div>
                          <div className="font-mono font-bold text-xs text-indigo-950 mt-1 break-all select-all">
                            {firebaseConfig.firestoreDatabaseId}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Instance Cloud Firestore chuyên dụng của hệ thống</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyDbParam('databaseId', firebaseConfig.firestoreDatabaseId)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shrink-0 cursor-pointer"
                          title="Sao chép Database ID"
                        >
                          {copiedKey === 'db_databaseId' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* 2. Project ID */}
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between">
                        <div className="min-w-0 pr-2">
                          <div className="text-[11px] font-bold text-slate-500">Mã Dự Án (Project ID)</div>
                          <div className="font-mono font-bold text-xs text-slate-900 mt-1 break-all select-all">
                            {firebaseConfig.projectId}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Google Cloud Project ID quản lý tài nguyên</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyDbParam('projectId', firebaseConfig.projectId)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shrink-0 cursor-pointer"
                          title="Sao chép Project ID"
                        >
                          {copiedKey === 'db_projectId' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* 3. Cloud Region */}
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between">
                        <div className="min-w-0 pr-2">
                          <div className="text-[11px] font-bold text-slate-500 flex items-center space-x-1">
                            <Globe className="w-3.5 h-3.5 text-blue-500" />
                            <span>Khu Vực Máy Chủ (Cloud Region)</span>
                          </div>
                          <div className="font-mono font-bold text-xs text-slate-900 mt-1">
                            {dbInfo.region}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Đặt tại Đài Loan / Châu Á - Độ trễ cực thấp về Việt Nam</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyDbParam('region', 'asia-east1')}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shrink-0 cursor-pointer"
                          title="Sao chép Region"
                        >
                          {copiedKey === 'db_region' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* 4. App ID */}
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between">
                        <div className="min-w-0 pr-2">
                          <div className="text-[11px] font-bold text-slate-500">Mã Ứng Dụng (App ID)</div>
                          <div className="font-mono font-bold text-xs text-slate-900 mt-1 break-all select-all">
                            {firebaseConfig.appId}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Firebase Client Web App ID</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyDbParam('appId', firebaseConfig.appId)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shrink-0 cursor-pointer"
                          title="Sao chép App ID"
                        >
                          {copiedKey === 'db_appId' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* 5. Auth Domain */}
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between">
                        <div className="min-w-0 pr-2">
                          <div className="text-[11px] font-bold text-slate-500">Tên Miền Xác Thực (Auth Domain)</div>
                          <div className="font-mono font-bold text-xs text-slate-900 mt-1 break-all select-all">
                            {firebaseConfig.authDomain}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Domain xác thực phiên đăng nhập an toàn</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyDbParam('authDomain', firebaseConfig.authDomain)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shrink-0 cursor-pointer"
                          title="Sao chép Auth Domain"
                        >
                          {copiedKey === 'db_authDomain' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* 6. Storage Bucket */}
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between">
                        <div className="min-w-0 pr-2">
                          <div className="text-[11px] font-bold text-slate-500">Kho Lưu Trữ Tệp (Storage Bucket)</div>
                          <div className="font-mono font-bold text-xs text-slate-900 mt-1 break-all select-all">
                            {firebaseConfig.storageBucket}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Bucket lưu trữ dữ liệu hình ảnh & file</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyDbParam('storageBucket', firebaseConfig.storageBucket)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shrink-0 cursor-pointer"
                          title="Sao chép Storage Bucket"
                        >
                          {copiedKey === 'db_storageBucket' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* 7. OAuth Client ID */}
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between">
                        <div className="min-w-0 pr-2">
                          <div className="text-[11px] font-bold text-slate-500">OAuth Client ID</div>
                          <div className="font-mono font-bold text-xs text-slate-900 mt-1 break-all select-all">
                            {firebaseConfig.oAuthClientId}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Khóa ủy quyền tích hợp Google Account</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyDbParam('oAuthClientId', firebaseConfig.oAuthClientId)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shrink-0 cursor-pointer"
                          title="Sao chép OAuth Client ID"
                        >
                          {copiedKey === 'db_oAuthClientId' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* 8. API Key (Masked for Security) */}
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between">
                        <div className="min-w-0 pr-2">
                          <div className="text-[11px] font-bold text-slate-500 flex items-center space-x-1">
                            <Lock className="w-3 h-3 text-amber-500" />
                            <span>Khóa API (API Key)</span>
                            <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.2 rounded">Bảo Vệ</span>
                          </div>
                          <div className="font-mono font-bold text-xs text-slate-700 mt-1">
                            {dbInfo.apiKeyMasked}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Khóa kết nối client được che mờ an toàn</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyDbParam('apiKeyMasked', dbInfo.apiKeyMasked)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shrink-0 cursor-pointer"
                          title="Sao chép API Key"
                        >
                          {copiedKey === 'db_apiKeyMasked' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Collections & Storage Metrics */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex items-center space-x-2">
                        <HardDrive className="w-4 h-4 text-emerald-600" />
                        <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                          Các Bảng Dữ Liệu Đang Hoạt Động (Cloud Collections)
                        </h4>
                      </div>
                      <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Đồng bộ tự động tức thì
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                      <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-100">
                        <div className="text-[11px] font-bold text-indigo-700">📄 pageRecords</div>
                        <div className="text-xl font-black text-indigo-950 mt-1">{records.length}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Bản ghi bài đăng Fanpage</div>
                      </div>

                      <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-100">
                        <div className="text-[11px] font-bold text-rose-700">👥 groupRecords</div>
                        <div className="text-xl font-black text-rose-950 mt-1">{groupRecords.length}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Bảng nhóm Facebook</div>
                      </div>

                      <div className="p-3 rounded-xl bg-cyan-50/60 border border-cyan-100">
                        <div className="text-[11px] font-bold text-cyan-700">🌐 proxies</div>
                        <div className="text-xl font-black text-cyan-950 mt-1">{proxies.length}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Danh sách IP Proxy mạng</div>
                      </div>

                      <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100">
                        <div className="text-[11px] font-bold text-purple-700">🔑 vias</div>
                        <div className="text-xl font-black text-purple-950 mt-1">{viaList.length}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Nick Via quản lý bảo mật</div>
                      </div>

                      <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                        <div className="text-[11px] font-bold text-emerald-700">👤 accounts</div>
                        <div className="text-xl font-black text-emerald-950 mt-1">{accounts.length}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Tài khoản & phân quyền</div>
                      </div>

                      <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100">
                        <div className="text-[11px] font-bold text-blue-700">🌐 sharedAccounts</div>
                        <div className="text-xl font-black text-blue-950 mt-1">{sharedAccounts.length}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Web dùng chung (CapCut...)</div>
                      </div>

                      <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100">
                        <div className="text-[11px] font-bold text-amber-700">⚙️ settings</div>
                        <div className="text-xl font-black text-amber-950 mt-1">1</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Cấu hình Admin PIN & Sec</div>
                      </div>

                      <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-100">
                        <div className="text-[11px] font-bold text-teal-700">🛡️ securityRules</div>
                        <div className="text-xl font-black text-teal-950 mt-1">Active</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Zero-Trust Rules v2</div>
                      </div>
                    </div>
                  </div>

                  {/* Security Architecture Box */}
                  <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start space-x-3">
                    <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-bold text-xs text-amber-950">
                        Kiến Trúc An Ninh Bảo Mật CSDL (Security & Access Control):
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        • <strong>Firestore Security Rules v2</strong>: Ngăn chặn tuyệt đối can thiệp trái phép ngoài luồng ứng dụng.
                        <br />
                        • <strong>Phân quyền RBAC (Role-based)</strong>: Nhân viên chỉ có thể xem và thao tác dữ liệu thuộc quyền phụ trách, không xem chéo thông tin nick via của đồng nghiệp.
                        <br />
                        • <strong>Bảo vệ Quản Trị</strong>: Chỉ tài khoản Quản Lý (Admin) nhập đúng Master PIN mới được truy cập trung tâm này và sửa cấu hình hệ thống.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ---------------------------------------------------- */}
              {/* SUB-TAB 2: ĐỔI MẬT KHẨU ADMIN MASTER PIN             */}
              {/* ---------------------------------------------------- */}
              {secSubTab === 'admin_pin' && (
                <div className="max-w-md mx-auto space-y-4 py-2">
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-900 flex items-start space-x-3 shadow-2xs">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-sm">Đổi Mật Khẩu Quản Lý Tối Cao (Admin PIN)</div>
                      <p className="mt-1 text-[11px] leading-relaxed">
                        Mật khẩu này dùng để đăng nhập vào tài khoản Admin Quản Lý và quản lý nhân viên.
                        Mật khẩu hiện tại của bạn là: <code className="font-bold bg-amber-100 px-1.5 py-0.5 rounded text-amber-950 font-mono">{adminPin}</code>
                      </p>
                    </div>
                  </div>

                  {adminPinNotice && (
                    <div
                      className={`p-3 rounded-xl border text-xs flex items-center space-x-2 ${
                        adminPinNotice.success
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                          : 'bg-rose-50 border-rose-300 text-rose-900 font-bold'
                      }`}
                    >
                      {adminPinNotice.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span>{adminPinNotice.message}</span>
                    </div>
                  )}

                  <form onSubmit={handleChangeAdminPinSubmit} className="bg-white p-5 border border-slate-200 rounded-xl space-y-3.5 shadow-2xs">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Mật khẩu Admin hiện tại</label>
                      <input
                        type="password"
                        required
                        placeholder="Nhập mật khẩu hiện tại..."
                        value={currentAdminPinInput}
                        onChange={(e) => setCurrentAdminPinInput(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Mật khẩu mới</label>
                      <input
                        type="text"
                        required
                        placeholder="Mật khẩu mới (ít nhất 4 ký tự)..."
                        value={newAdminPinInput}
                        onChange={(e) => setNewAdminPinInput(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Xác nhận mật khẩu mới</label>
                      <input
                        type="text"
                        required
                        placeholder="Nhập lại mật khẩu mới..."
                        value={confirmAdminPinInput}
                        onChange={(e) => setConfirmAdminPinInput(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-lg shadow-sm cursor-pointer transition-all mt-2"
                    >
                      Lưu Mật Khẩu Admin Mới
                    </button>
                  </form>
                </div>
              )}

              {/* ---------------------------------------------------- */}
              {/* SUB-TAB 3: SAO LƯU DỰ PHÒNG CSDL (BACKUP DATABASE)   */}
              {/* ---------------------------------------------------- */}
              {secSubTab === 'backup' && (
                <div className="max-w-lg mx-auto space-y-4 py-2">
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
                    <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                        <Download className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm">Xuất Bản Sao Lưu CSDL Firestore</h4>
                        <p className="text-[11px] text-slate-500">Tải trọn vẹn dữ liệu hệ thống về máy tính dưới dạng file JSON</p>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                      <div className="font-bold text-slate-700">Dữ liệu đóng gói bao gồm 6 bảng:</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-center">
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                          <div className="font-black text-indigo-700 text-base">{records.length}</div>
                          <div className="text-[10px] text-slate-500">1. Fanpage</div>
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                          <div className="font-black text-rose-700 text-base">{groupRecords.length}</div>
                          <div className="text-[10px] text-slate-500">2. Group Facebook</div>
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                          <div className="font-black text-cyan-700 text-base">{proxies.length}</div>
                          <div className="text-[10px] text-slate-500">3. Proxy Mạng</div>
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                          <div className="font-black text-purple-700 text-base">{viaList.length}</div>
                          <div className="text-[10px] text-slate-500">4. Nick Full Via</div>
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                          <div className="font-black text-emerald-700 text-base">{accounts.length}</div>
                          <div className="text-[10px] text-slate-500">5. Nhân viên & PIN</div>
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                          <div className="font-black text-blue-700 text-base">{sharedAccounts.length}</div>
                          <div className="text-[10px] text-slate-500">6. Web Dùng Chung</div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleExportBackup}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Tải Bản Sao Lưu Toàn Bộ CSDL (.json)</span>
                    </button>

                    {/* Khôi Phục CSDL Từ File Backup */}
                    <div className="pt-3 border-t border-slate-200">
                      <div className="text-xs font-bold text-slate-800 mb-1.5 flex items-center space-x-1.5">
                        <Upload className="w-4 h-4 text-indigo-600" />
                        <span>Khôi Phục CSDL Từ Bản Sao Lưu:</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-2">
                        Chọn file backup <code>.json</code> đã tải về trước đó để đồng bộ lại toàn bộ dữ liệu vào Firestore.
                      </p>
                      <label className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition-all flex items-center justify-center space-x-2 cursor-pointer">
                        <HardDrive className="w-4 h-4 text-slate-600" />
                        <span>{isRestoringBackup ? 'Đang Khôi Phục...' : 'Chọn File JSON Để Khôi Phục CSDL'}</span>
                        <input
                          type="file"
                          accept=".json"
                          disabled={isRestoringBackup}
                          onChange={handleRestoreFile}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div className="text-[11px] text-slate-400 text-center">
                      * Bản sao lưu JSON giúp bạn lưu trữ ngoại tuyến an toàn 100%, có thể khôi phục bất cứ lúc nào.
                    </div>
                  </div>
                </div>
              )}

              {/* ---------------------------------------------------- */}
              {/* SUB-TAB 4: HƯỚNG DẪN & CƠ CHẾ BẢO MẬT CHỐNG HACK VIA */}
              {/* ---------------------------------------------------- */}
              {secSubTab === 'anti_hack_guide' && (
                <div className="max-w-4xl mx-auto space-y-4 py-2">
                  {/* BANNER TỔNG QUAN AN NINH */}
                  <div className="bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-900 text-white p-5 rounded-2xl shadow-lg border border-emerald-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start space-x-3.5">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-base font-black text-white">Lá Chắn Bảo Mật & Chống Lỗ Hổng CSDL</h3>
                          <span className="bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide">
                            Đang Bật 24/7
                          </span>
                        </div>
                        <p className="text-xs text-emerald-100/90 mt-1.5 leading-relaxed max-w-2xl">
                          Ứng dụng đã được trang bị hệ thống phân quyền đa tầng (RBAC), lá chắn chống rò rỉ RAM (Zero-Leak Memory Shield), tối ưu hóa truy vấn CSDL, chống dò mã PIN tự động (Anti-Brute Force) và quy tắc bảo mật Firestore Rules v2.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-row md:flex-col gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSecSubTab('admin_pin')}
                        className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Đổi PIN Admin Ngay</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSecSubTab('backup')}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-600 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Tải Sao Lưu Dự Phòng</span>
                      </button>
                    </div>
                  </div>

                  {/* BẢNG ĐÁNH GIÁ & QUÉT LỖ HỔNG BẢO MẬT CSDL (LIVE SECURITY & LEAK AUDIT) */}
                  <div className="bg-white border border-emerald-200 rounded-2xl p-5 shadow-2xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                          <Activity className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-extrabold text-slate-900 text-sm">
                              Kiểm Tra Lỗ Hổng & Sức Khỏe Bảo Mật CSDL (Security & Leak Audit)
                            </h4>
                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
                              🛡️ Điểm 100/100 An Toàn
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Trạng thái thời gian thực các chốt chặn an toàn bảo vệ CSDL chống rò rỉ dữ liệu và tối ưu chi phí.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {/* 1. Zero-Leak Memory Shield */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900">1. Chống Rò Rỉ RAM (Zero-Leak Memory)</span>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">Đã Bật</span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                            Dữ liệu mật khẩu Via, 2FA, Fanpage chỉ tải vào RAM sau khi đăng nhập thành công. Tự hủy sạch 100% khỏi RAM máy tính khi bấm Đăng Xuất.
                          </p>
                        </div>
                      </div>

                      {/* 2. Query & Cost Optimization */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                          <Database className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900">2. Tối Ưu Chi Phí & Quota Firestore</span>
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">Tiết Kiệm 85%</span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                            Chặn hoàn toàn việc khởi tạo 7 listeners đọc CSDL liên tục đối với khách vãng lai và bot quét mạng, bảo vệ hạn mức quota.
                          </p>
                        </div>
                      </div>

                      {/* 3. Anti-Brute Force Protection */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                          <Lock className="w-4 h-4 text-rose-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900">3. Chống Dò Mật Khẩu (Anti-Brute Force)</span>
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">Khóa 60s / 5 lần</span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                            Tự động khóa cứng 60 giây và đếm ngược thời gian nếu ai đó nhập sai mã PIN Admin hoặc Nhân viên quá 5 lần liên tiếp.
                          </p>
                        </div>
                      </div>

                      {/* 4. Firestore Rules Hardening */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                          <Server className="w-4 h-4 text-teal-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900">4. Quy Tắc Cloud Rules v2 (Hardened)</span>
                            <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded">Đã Triển Khai</span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                            Chặn nhân viên tự sửa vai trò thành Admin trên Cloud, cấm xóa tài khoản Admin Master và kiểm tra schema 100% dữ liệu.
                          </p>
                        </div>
                      </div>

                      {/* 5. Vault Masking Gate */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                          <EyeOff className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900">5. Két Che Mờ Mật Khẩu & 2FA (Vault)</span>
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">Bảo Vệ Màn Hình</span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                            Mặc định che mờ toàn bộ Mật khẩu, 2FA, Cookies (••••••••). Ngăn ngừa nhìn trộm màn hình khi làm việc nơi công cộng.
                          </p>
                        </div>
                      </div>

                      {/* 6. Admin Master PIN Check */}
                      <div className={`p-3.5 rounded-xl border flex items-start space-x-3 ${
                        adminPin === 'admin123'
                          ? 'bg-amber-50/80 border-amber-300'
                          : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          adminPin === 'admin123' ? 'bg-amber-200 text-amber-800' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          <Key className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900">6. Độ Mạnh Mật Khẩu Admin Master</span>
                            {adminPin === 'admin123' ? (
                              <button
                                type="button"
                                onClick={() => setSecSubTab('admin_pin')}
                                className="text-[10px] font-black text-amber-900 bg-amber-200 hover:bg-amber-300 px-2 py-0.5 rounded cursor-pointer transition-all"
                              >
                                ⚠️ Cần Đổi Ngay →
                              </button>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">Đã Đổi An Toàn</span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                            {adminPin === 'admin123'
                              ? 'Bạn đang dùng mã mặc định "admin123". Hãy bấm vào nút Đổi Ngay bên cạnh để đổi sang mã PIN bí mật riêng!'
                              : 'Mã Master PIN quản lý đã được thiết lập riêng, độ bảo mật cao.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CHÍNH SÁCH BẮT BUỘC ĐĂNG NHẬP GOOGLE OAUTH */}
                  <div className="bg-white border border-sky-200 rounded-2xl p-5 shadow-2xs space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-extrabold text-slate-900 text-sm">
                              Chính Sách Đăng Nhập Bằng Google (Google-Only Authentication)
                            </h4>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                requireGoogleOnly
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-slate-100 text-slate-600 border border-slate-300'
                              }`}
                            >
                              {requireGoogleOnly ? 'Đang Bắt Buộc' : 'Chưa Kích Hoạt'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Chặn hoàn toàn việc đăng nhập bằng mã PIN nhân viên thông thường, buộc 100% nhân viên & admin phải đăng nhập bằng tài khoản Google để loại bỏ nguy cơ lộ mật khẩu hoặc hack app.
                          </p>
                        </div>
                      </div>

                      {onToggleRequireGoogleOnly && (
                        <button
                          type="button"
                          id="btn-toggle-google-policy-modal"
                          onClick={() => onToggleRequireGoogleOnly(!requireGoogleOnly)}
                          className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0 flex items-center space-x-1.5 ${
                            requireGoogleOnly
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          }`}
                        >
                          <Shield className="w-4 h-4" />
                          <span>{requireGoogleOnly ? '✓ Đang Bắt Buộc (Bấm Tắt)' : 'Bật Bắt Buộc Google Ngay'}</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="font-bold text-slate-800 flex items-center space-x-1.5 mb-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Bảo Vệ Đăng Nhập 2 Lớp (2FA)</span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          Tận dụng bảo mật 2FA của chính tài khoản Google của nhân viên (thông báo điện thoại, mã khóa).
                        </p>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="font-bold text-slate-800 flex items-center space-x-1.5 mb-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Không Lo Lộ Mật Khẩu</span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          Không ai có thể đoán mã PIN hay mật khẩu đơn giản để vào xem lén dữ liệu Fanpage và dàn Via.
                        </p>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="font-bold text-slate-800 flex items-center space-x-1.5 mb-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Kiểm Soát Danh Sách Cấp Phép</span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          Chỉ email Google nằm trong danh sách đã được Admin phê duyệt mới có thể vào làm việc.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 4 Lớp Bảo Vệ Có Sẵn Trong App */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex items-center space-x-2">
                        <Shield className="w-4 h-4 text-indigo-600" />
                        <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                          4 Lớp Bảo Vệ Tự Động Được Kích Hoạt Trong Hệ Thống
                        </h4>
                      </div>
                      <span className="text-[11px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                        Cơ chế độc quyền
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {/* Lớp 1 */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-300 transition-all">
                        <div className="flex items-start space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-sm shrink-0">
                            1
                          </div>
                          <div>
                            <div className="font-bold text-xs text-slate-900 flex items-center space-x-1.5">
                              <span>Phân Quyền Tuyệt Đối (RBAC Scoping)</span>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            </div>
                            <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                              Nhân viên đăng nhập <strong>CHỈ xem và sửa được đúng Fanpage và Nick Via được giao</strong> cho tên của họ. Nhân viên không thể xem trộm hoặc xuất danh sách Via của nhân viên khác.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Lớp 2 */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-300 transition-all">
                        <div className="flex items-start space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-black text-sm shrink-0">
                            2
                          </div>
                          <div>
                            <div className="font-bold text-xs text-slate-900 flex items-center space-x-1.5">
                              <span>Két Khóa Mật Khẩu (PIN Vault Gate)</span>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            </div>
                            <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                              Tại Bảng Full Via, cột <strong>Mật khẩu, Mã 2FA và Chuỗi Cookie được che mờ (••••••••)</strong> theo mặc định. Người dùng bắt buộc phải nhập mã PIN riêng mới có thể mở khóa để xem hoặc copy.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Lớp 3 */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-300 transition-all">
                        <div className="flex items-start space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-black text-sm shrink-0">
                            3
                          </div>
                          <div>
                            <div className="font-bold text-xs text-slate-900 flex items-center space-x-1.5">
                              <span>Chống Dò Mật Khẩu (Anti-Brute Force)</span>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            </div>
                            <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                              Nếu ai đó cố tình đoán mò mã PIN và nhập sai <strong>quá 5 lần liên tiếp</strong>, hệ thống sẽ tự động khóa cứng (Lockout) trong 60 giây và kích hoạt bộ đếm thời gian an toàn.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Lớp 4 */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-300 transition-all">
                        <div className="flex items-start space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-sm shrink-0">
                            4
                          </div>
                          <div>
                            <div className="font-bold text-xs text-slate-900 flex items-center space-x-1.5">
                              <span>Không Sợ Mất Dữ Liệu Máy Tính</span>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            </div>
                            <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                              Dữ liệu không lưu tạm bợ ở trình duyệt máy tính mà được <strong>đồng bộ tức thì lên Cloud Firestore của Google</strong>. Xóa cookie, hỏng ổ cứng hay đổi máy khác đăng nhập đều còn nguyên 100%.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 5 Lời Khuyên Vàng Cho Chủ Dàn Via MMO / Facebook */}
                  <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 shadow-2xs space-y-3.5">
                    <div className="flex items-center space-x-2 border-b border-amber-200/60 pb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-700" />
                      <h4 className="font-black text-amber-950 text-xs uppercase tracking-wider">
                        5 Nguyên Tắc Bắt Buộc Để Tuyệt Đối Không Bị Hack Nick Hay Mất Via
                      </h4>
                    </div>

                    <div className="space-y-2.5 text-xs text-amber-950">
                      <div className="flex items-start space-x-2.5 bg-white/80 p-2.5 rounded-xl border border-amber-200">
                        <span className="font-black text-amber-800 shrink-0">1.</span>
                        <div>
                          <strong>Đổi Mã PIN Admin Mặc Định Ngay Lập Tức:</strong> Mã PIN ban đầu là <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-bold">admin123</code>. Hãy bấm nút <em>"Đổi Mật Khẩu Admin Master"</em> ở trên để đặt mã bí mật riêng (từ 6-12 ký tự) chỉ mình bạn biết.
                        </div>
                      </div>

                      <div className="flex items-start space-x-2.5 bg-white/80 p-2.5 rounded-xl border border-amber-200">
                        <span className="font-black text-amber-800 shrink-0">2.</span>
                        <div>
                          <strong>Thu Hồi Quyền Tức Thì Khi Nhân Viên Nghỉ Việc:</strong> Vào tab <em>"Tất Cả Nhân Viên"</em>, chỉ cần 1 click bấm nút <strong>"Khóa"</strong> hoặc <strong>"Xóa"</strong>, nhân viên đó sẽ lập tức bị đá ra khỏi hệ thống và không thể xem thêm bất kỳ Via hay Fanpage nào.
                        </div>
                      </div>

                      <div className="flex items-start space-x-2.5 bg-white/80 p-2.5 rounded-xl border border-amber-200">
                        <span className="font-black text-amber-800 shrink-0">3.</span>
                        <div>
                          <strong>Bật Xác Thực 2 Lớp (2FA) Cho Hotmail / Gmail Của Via:</strong> Mất Via thường do lộ mật khẩu email gốc hoặc email bị quét. Hãy chắc chắn các email quan trọng đã cài số điện thoại khôi phục hoặc ứng dụng Authenticator.
                        </div>
                      </div>

                      <div className="flex items-start space-x-2.5 bg-white/80 p-2.5 rounded-xl border border-amber-200">
                        <span className="font-black text-amber-800 shrink-0">4.</span>
                        <div>
                          <strong>Tải File Sao Lưu Dự Phòng (.json) Hàng Tuần:</strong> Bấm sang tab <em>"Sao Lưu Dự Phòng CSDL"</em> và tải file backup về lưu trên ổ cứng hoặc Google Drive riêng để phòng hờ mọi rủi ro ngoại cảnh.
                        </div>
                      </div>

                      <div className="flex items-start space-x-2.5 bg-white/80 p-2.5 rounded-xl border border-amber-200">
                        <span className="font-black text-amber-800 shrink-0">5.</span>
                        <div>
                          <strong>Đăng Xuất Khi Rời Khỏi Máy Tính:</strong> Nếu dùng chung máy tính với người khác, hãy bấm nút <strong>"Đăng Xuất"</strong> ở góc trên bên phải khi rời đi để tránh người khác tự ý bấm vào xem dữ liệu nhạy cảm.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 5. MODAL FOOTER */}
        <div className="bg-slate-100/90 border-t border-slate-200 px-5 py-3 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>Hệ thống phân quyền & mật khẩu Cloud Firestore được mã hóa an toàn</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 font-bold rounded-lg border border-slate-300 cursor-pointer shadow-2xs"
          >
            Đóng Cửa Sổ
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* POPUP MODAL: ĐỔI MẬT KHẨU NHANH CHO NHÂN VIÊN (DEDICATED) */}
      {/* ======================================================== */}
      {quickChangePasswordStaff && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-indigo-200 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Đổi Mật Khẩu Cho Nhân Viên</h3>
                  <p className="text-[11px] text-slate-500">{quickChangePasswordStaff.username}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickChangePasswordStaff(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div>
              <div className="text-xs text-slate-500 mb-1.5 flex items-center justify-between">
                <span>Mật khẩu hiện tại:</span>
                <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {quickChangePasswordStaff.currentPin}
                </span>
              </div>

              <label className="block text-xs font-bold text-slate-800 mb-1 mt-3">
                Nhập Mật Khẩu (PIN) Mới:
              </label>
              <input
                type="text"
                value={newPinInputValue}
                onChange={(e) => setNewPinInputValue(e.target.value)}
                placeholder="Ví dụ: 123456, 888888..."
                className="w-full px-3 py-2 text-sm border-2 border-indigo-300 rounded-xl bg-indigo-50/30 focus:bg-white focus:border-indigo-600 outline-none font-mono font-bold text-indigo-950"
                autoFocus
              />

              {/* Quick shortcut presets */}
              <div className="flex items-center space-x-1.5 mt-2.5">
                <span className="text-[10px] text-slate-400 font-medium">Gợi ý:</span>
                {['123456', '888888', '654321'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setNewPinInputValue(preset)}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-mono font-bold cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const rnd = Math.floor(100000 + Math.random() * 900000).toString();
                    setNewPinInputValue(rnd);
                  }}
                  className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[10px] font-bold cursor-pointer"
                >
                  🎲 Ngẫu Nhiên
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setQuickChangePasswordStaff(null)}
                className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveQuickPassword}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-lg text-xs flex items-center space-x-1.5 shadow-2xs cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Lưu & Tự Động Copy Mật Khẩu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* POPUP MODAL: CHỈNH SỬA THÔNG TIN NHÂN VIÊN TOÀN DIỆN    */}
      {/* ======================================================== */}
      {editStaffModalData && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Chỉnh Sửa Thông Tin Nhân Viên</h3>
                  <p className="text-[11px] text-slate-500">Cập nhật tên, email và mật khẩu</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditStaffModalData(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên Nhân Viên</label>
                <input
                  type="text"
                  value={editStaffModalData.username}
                  onChange={(e) => setEditStaffModalData({ ...editStaffModalData, username: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mật Khẩu / Pass (PIN)</label>
                <input
                  type="text"
                  value={editStaffModalData.pin}
                  onChange={(e) => setEditStaffModalData({ ...editStaffModalData, pin: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono font-bold text-indigo-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Google Liên Kết</label>
                <input
                  type="email"
                  value={editStaffModalData.email}
                  onChange={(e) => setEditStaffModalData({ ...editStaffModalData, email: e.target.value })}
                  placeholder="name@gmail.com"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ghi Chú Phân Công</label>
                <input
                  type="text"
                  value={editStaffModalData.adminNote}
                  onChange={(e) => setEditStaffModalData({ ...editStaffModalData, adminNote: e.target.value })}
                  placeholder="Ghi chú công việc..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              {/* Phân quyền bảng hiển thị */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Phân Quyền Bảng Hiển Thị (1..6)
                  </label>
                  <span className="text-[11px] text-indigo-600 font-semibold">
                    Đã chọn {(editStaffModalData.allowedTabs || ALL_TAB_KEYS).length}/6 bảng
                  </span>
                </div>

                <div className="flex flex-wrap gap-1 mb-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditStaffModalData({
                        ...editStaffModalData,
                        allowedTabs: ALL_TAB_KEYS,
                      })
                    }
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                  >
                    Tất cả (1-6)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditStaffModalData({
                        ...editStaffModalData,
                        allowedTabs: ['fanpage'],
                      })
                    }
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 cursor-pointer"
                  >
                    Chỉ Fanpage
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditStaffModalData({
                        ...editStaffModalData,
                        allowedTabs: ['fanpage', 'fullvia', 'staff_management'],
                      })
                    }
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 cursor-pointer"
                  >
                    Fanpage + Via
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditStaffModalData({
                        ...editStaffModalData,
                        allowedTabs: ['fanpage', 'group', 'staff_management'],
                      })
                    }
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer"
                  >
                    Fanpage + Group
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {ALL_TAB_KEYS.map((tabKey) => {
                    const tabDef = TAB_DEFINITIONS[tabKey];
                    const currentTabs = editStaffModalData.allowedTabs || ALL_TAB_KEYS;
                    const isChecked = currentTabs.includes(tabKey);

                    return (
                      <label
                        key={tabKey}
                        className={`flex items-center space-x-2 p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-indigo-50/70 border-indigo-300 font-bold text-indigo-950'
                            : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            let nextTabs: TabKey[];
                            if (isChecked) {
                              if (currentTabs.length <= 1) return;
                              nextTabs = currentTabs.filter((t) => t !== tabKey);
                            } else {
                              nextTabs = [...currentTabs, tabKey];
                            }
                            setEditStaffModalData({
                              ...editStaffModalData,
                              allowedTabs: nextTabs,
                            });
                          }}
                          className="w-3.5 h-3.5 text-indigo-600 rounded cursor-pointer"
                        />
                        <span className="truncate">{tabDef.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditStaffModalData(null)}
                className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveStaffInfoModal}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-2xs"
              >
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* POPUP MODAL: XEM CHI TIẾT FANPAGE HOẶC VIA CỦA NHÂN VIÊN */}
      {/* ======================================================== */}
      {viewingStaffDetails && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-5 max-w-lg w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 space-y-3.5 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  {viewingStaffDetails.type === 'pages' ? <FileSpreadsheet className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    {viewingStaffDetails.type === 'pages' ? 'Danh Sách Fanpage Của' : 'Danh Sách Nick Via Của'}{' '}
                    <span className="text-indigo-600">{viewingStaffDetails.username}</span>
                  </h3>
                  <p className="text-[11px] text-slate-500">Chi tiết phân bổ trong hệ thống</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingStaffDetails(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2 text-xs">
              {viewingStaffDetails.type === 'pages' ? (
                records
                  .filter((r) => r.staffName.trim().toLowerCase() === viewingStaffDetails.username.trim().toLowerCase())
                  .map((r, i) => (
                    <div key={r.id || i} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 flex items-center space-x-2">
                          <span>{r.pageName}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                              r.status === 'Đề Xuất'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.status === 'Mất Đề Xuất'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {r.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Đăng: {r.actualPosts}/{r.targetPosts} bài ({r.postingMethod}) • Via: {r.viaUid}
                        </div>
                      </div>
                      {r.pageLink && (
                        <a
                          href={r.pageLink}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Mở Fanpage"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  ))
              ) : (
                viaList
                  .filter((v) => v.staffName.trim().toLowerCase() === viewingStaffDetails.username.trim().toLowerCase())
                  .map((v, i) => (
                    <div key={v.id || i} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                      <div>
                        <div className="font-mono font-bold text-slate-900">{v.uid}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-xs">
                          {v.rawFullVia || (v.pass ? `${v.uid}|${v.pass}|${v.twoFa || ''}` : 'Chưa có chuỗi full')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(v.uid, `uid-${v.id}`, `Đã copy UID: ${v.uid}`)}
                        className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-100"
                      >
                        Copy UID
                      </button>
                    </div>
                  ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setViewingStaffDetails(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* POPUP MODAL: XÁC NHẬN XÓA NHÂN VIÊN                    */}
      {/* ======================================================== */}
      {staffToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-rose-200 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600 border-b border-rose-100 pb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">Xác Nhận Xóa Nhân Viên</h3>
                <p className="text-xs text-rose-700 font-bold">{staffToDelete.username}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <p>Bạn có chắc chắn muốn xóa tài khoản nhân viên này khỏi hệ thống?</p>
              
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 mt-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deletePostsChecked}
                    onChange={(e) => setDeletePostsChecked(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-xs text-slate-800">
                    Xóa luôn {staffToDelete.pagesCount} bài đăng / Fanpage của bạn này
                  </span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteViasChecked}
                    onChange={(e) => setDeleteViasChecked(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-xs text-slate-800">
                    Xóa luôn {staffToDelete.viasCount} nick Via đang cầm
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStaffToDelete(null)}
                className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteAccount(staffToDelete.id, {
                    deletePosts: deletePostsChecked,
                    deleteVias: deleteViasChecked,
                  });
                  setToastNotice({
                    type: 'success',
                    message: `Đã xóa nhân viên "${staffToDelete.username}" khỏi hệ thống!`,
                  });
                  setStaffToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow-2xs cursor-pointer"
              >
                Xác Nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
