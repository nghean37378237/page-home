import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  PageRecord,
  SheetFilter,
  AppUser,
  UserAccount,
  FullViaItem,
  SharedAccount,
  GroupRecord,
  ProxyItem,
  MonthlyFinanceRecord,
  ImageTaskItem,
  TabKey,
  ALL_TAB_KEYS,
  TAB_DEFINITIONS,
  ADMIN_WAITING_POOL,
  isAdminWaitingPool,
  resolveAccountWpEmployeeCode,
  areStaffNamesEquivalent,
  isSameStaffIdentity,
} from './types';
import {
  testFirestoreConnection,
  checkAndApplyCloudDbBridge,
  seedCloudFirestoreIfEmpty,
  MASTER_OWNER_EMAIL,
  subscribeToPageRecords,
  subscribeToVias,
  subscribeToAccounts,
  subscribeToSettings,
  subscribeToSharedAccounts,
  subscribeToGroupRecords,
  subscribeToProxies,
  subscribeToMonthlyFinances,
  getCloudMonthlyFinances,
  setCloudMonthlyFinance,
  updateCloudMonthlyFinance,
  deleteCloudMonthlyFinance,
  setCloudPageRecord,
  updateCloudPageRecord,
  deleteCloudPageRecord,
  batchSaveCloudPageRecords,
  batchDeleteCloudPageRecords,
  setCloudVia,
  updateCloudVia,
  deleteCloudVia,
  batchSaveCloudVias,
  batchDeleteCloudVias,
  setCloudAccount,
  updateCloudAccount,
  deleteCloudAccount,
  setCloudSharedAccount,
  updateCloudSharedAccount,
  deleteCloudSharedAccount,
  batchSaveCloudSharedAccounts,
  setCloudGroupRecord,
  updateCloudGroupRecord,
  deleteCloudGroupRecord,
  batchSaveCloudGroupRecords,
  batchDeleteCloudGroupRecords,
  clearAllCloudGroupRecords,
  getCloudGroupRecords,
  setCloudProxy,
  updateCloudProxy,
  deleteCloudProxy,
  batchSaveCloudProxies,
  batchDeleteCloudProxies,
  saveCloudSettings,
  resetCloudFirestoreToDefaults,
  clearAllCloudMonthlyFinances,
  batchSaveCloudMonthlyFinances,
  subscribeToImageTasks,
  setCloudImageTask,
  updateCloudImageTask,
  deleteCloudImageTask,
  batchSaveCloudImageTasks,
} from './services/firebase';
import {
  loadCurrentUserSession,
  saveCurrentUserSession,
  clearCurrentUserSession,
  clearAllLegacyLocalStorage,
  migrateAndPreserveLocalStorage,
  saveLocalGroupBackup,
  getLocalGroupBackup,
  saveLocalFinanceBackup,
  getLocalFinanceBackup,
  clearLocalFinanceBackup,
  saveLocalImageTasksBackup,
  getLocalImageTasksBackup,
  DEFAULT_STAFF_MEMBERS,
  INITIAL_ACCOUNTS,
  DEFAULT_ADMIN_USER,
  GUEST_USER,
  DEFAULT_ADMIN_SETTINGS,
  AdminSecuritySettings,
} from './services/storage';
import { INITIAL_PROXIES, INITIAL_GROUP_RECORDS, INITIAL_MONTHLY_FINANCES } from './data/initialData';
import { SheetHeader } from './components/SheetHeader';
import { SheetFilterBar } from './components/SheetFilterBar';
import { FanpageSheetTable } from './components/FanpageSheetTable';
import { AddEditPageModal } from './components/AddEditPageModal';
import { AuthModal } from './components/AuthModal';
import { LoginScreen } from './components/LoginScreen';
import { AdminApprovalModal } from './components/AdminApprovalModal';
import { FullViaTable } from './components/FullViaTable';
import { FullViaErrorBoundary } from './components/FullViaErrorBoundary';
import { BulkImportViaModal } from './components/BulkImportViaModal';
import { BulkImportFanpageModal } from './components/BulkImportFanpageModal';
import { SharedAccountsTable } from './components/SharedAccountsTable';
import { StaffManagementTable } from './components/StaffManagementTable';
import { DeleteStaffDataModal } from './components/DeleteStaffDataModal';
import { TransferPageViaModal, TransferPageViaParams } from './components/TransferPageViaModal';
import { FetchPagesFromViaModal } from './components/FetchPagesFromViaModal';
import { GroupManagementTable } from './components/GroupManagementTable';
import { AddEditGroupModal } from './components/AddEditGroupModal';
import { BulkImportGroupModal } from './components/BulkImportGroupModal';
import { ProxyManagementTable } from './components/ProxyManagementTable';
import { ProxyAppView } from './components/ProxyAppView';
import { AddEditProxyModal } from './components/AddEditProxyModal';
import { BulkImportProxyModal } from './components/BulkImportProxyModal';
import { RevenueManagementTable } from './components/RevenueManagementTable';
import { clearAdminMgidVaultForNonAdmin } from './components/MgidDashboardPanel';
import { StaffInfoTable } from './components/StaffInfoTable';
import { ImageStudioTab } from './components/ImageStudioTab';
import { WordPressStatsTab } from './components/WordPressStatsTab';
import { WebPublishStudioTab } from './components/WebPublishStudioTab';
import { getCleanBmName, parseFullVia, parseSupplementalViaInput, buildFullViaString } from './utils/helpers';
import { FileSpreadsheet, KeyRound, RotateCw, Cloud, Globe, Users, Upload, Plus, Network, UserCheck, X, CheckCircle2, RefreshCw, DollarSign, ChevronLeft, ChevronRight, ChevronDown, Layers, Contact, Image as ImageIcon, BarChart3, PenTool } from 'lucide-react';

// Helper chuẩn hóa UID để so khớp chính xác giữa Quản Lý Page và Quản Lý Full Via
function normalizeViaUidKey(raw?: string): string {
  if (!raw) return '';
  return raw.split('|')[0].trim().toLowerCase();
}

const DELETED_VIA_UIDS_STORAGE_KEY = 'mmo_deleted_via_uids_v1';

function loadLocalDeletedViaUids(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DELETED_VIA_UIDS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return Array.from(new Set(parsed.map((u) => normalizeViaUidKey(String(u))).filter(Boolean)));
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function saveLocalDeletedViaUids(uids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DELETED_VIA_UIDS_STORAGE_KEY, JSON.stringify(uids));
  } catch {
    // ignore
  }
}

export default function App() {
  // Application data stored purely in Cloud Firestore
  const [records, setRecords] = useState<PageRecord[]>([]);
  const [viaList, setViaList] = useState<FullViaItem[]>([]);
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [sharedAccounts, setSharedAccounts] = useState<SharedAccount[]>([]);
  const [groupRecords, setGroupRecords] = useState<GroupRecord[]>([]);
  const [proxies, setProxies] = useState<ProxyItem[]>(INITIAL_PROXIES);
  const [finances, setFinances] = useState<MonthlyFinanceRecord[]>(() => {
    const sess = loadCurrentUserSession();
    return sess.role === 'admin' ? getLocalFinanceBackup() : [];
  });
  const [imageTasks, setImageTasks] = useState<ImageTaskItem[]>(() => getLocalImageTasksBackup());
  const [customStaffList, setCustomStaffList] = useState<string[]>([]);
  const [deletedViaUids, setDeletedViaUids] = useState<string[]>(() => loadLocalDeletedViaUids());
  const deletedViaUidsRef = useRef<Set<string>>(new Set(loadLocalDeletedViaUids()));
  const [adminSettings, setAdminSettings] = useState<AdminSecuritySettings>(DEFAULT_ADMIN_SETTINGS);
  
  // Current active session in browser tab (sessionStorage, not local persistent storage)
  const [currentUser, setCurrentUser] = useState<AppUser>(() => loadCurrentUserSession());
  
  // Firestore connection and loading states
  const [isLoadingFirestore, setIsLoadingFirestore] = useState<boolean>(true);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState<boolean>(false);

  // Modal and Auth dialog states
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'request'>('login');
  const [isAdminApprovalModalOpen, setIsAdminApprovalModalOpen] = useState(false);
  const [adminApprovalModalTab, setAdminApprovalModalTab] = useState<'staff' | 'pending' | 'blocked' | 'admin_pin' | 'security_db'>('staff');

  // Delete Staff Modal state
  const [isDeleteStaffModalOpen, setIsDeleteStaffModalOpen] = useState(false);
  const [selectedStaffToDelete, setSelectedStaffToDelete] = useState<string>('');

  // Transfer Page to another Via modal state
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedRecordToTransfer, setSelectedRecordToTransfer] = useState<PageRecord | null>(null);
  const [presetTransferViaUid, setPresetTransferViaUid] = useState<string | null>(null);

  // Fetch Pages from Via modal state
  const [isFetchPagesModalOpen, setIsFetchPagesModalOpen] = useState(false);
  const [fetchPagesViaUid, setFetchPagesViaUid] = useState<string>('');
  const [fetchPagesStaffName, setFetchPagesStaffName] = useState<string>('');

  // Full Via state & Bulk import modal
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isBulkImportFanpageOpen, setIsBulkImportFanpageOpen] = useState(false);
  const [bulkImportPresetStaff, setBulkImportPresetStaff] = useState<string | undefined>(undefined);

  // Group Management Modals state
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroupRecord, setEditingGroupRecord] = useState<GroupRecord | null>(null);
  const [presetGroupData, setPresetGroupData] = useState<{
    groupId?: string;
    groupName?: string;
    groupLink?: string;
    staffName?: string;
    initialMode?: 'single' | 'batch';
  } | null>(null);
  const [isBulkImportGroupOpen, setIsBulkImportGroupOpen] = useState(false);

  // Proxy Management Modals state
  const [isAddProxyModalOpen, setIsAddProxyModalOpen] = useState(false);
  const [editingProxy, setEditingProxy] = useState<ProxyItem | null>(null);
  const [isBulkImportProxyModalOpen, setIsBulkImportProxyModalOpen] = useState(false);

  // Tab State: Tab 1 = Quản lý Fanpage, Tab 2 = Quản lý Group, Tab 3 = Quản lý Proxy, Tab 4 = Quản lý Full Via, Tab 5 = Quản lý Tài Khoản Dùng Chung, Tab 6 = Quản lý Nhân Viên
  const [activeTab, setActiveTab] = useState<TabKey>('fanpage');

  // Phân quyền Bảng hiển thị (Smart Tab Access Control):
  // Admin: luôn xem toàn bộ 6 bảng, bao gồm Bảng 5 Quản Trị Nhân Viên.
  // Nhân viên: CHỈ xem các bảng được Admin phân quyền (Bảng 1..4, 6), tự động ẩn toàn bộ bảng không cần thiết để giao diện gọn gàng.
  // Bảng 5 Quản Trị Nhân Viên chỉ dành riêng cho Admin quản lý.
  const userAllowedTabs = useMemo<TabKey[]>(() => {
    if (currentUser.role === 'admin') {
      return ALL_TAB_KEYS;
    }
    const currentAcc = accounts.find(
      (a) =>
        a.id === currentUser.id ||
        a.username.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
    );
    const assigned = currentAcc?.allowedTabs || currentUser.allowedTabs;
    let tabs: TabKey[] = [];
    if (Array.isArray(assigned) && assigned.length > 0) {
      tabs = assigned.filter((t) => ALL_TAB_KEYS.includes(t as TabKey)) as TabKey[];
    } else {
      tabs = ['fanpage', 'fullvia'];
    }
    // Bảng 5 (Quản trị nhân viên) & Bảng 7 (Doanh thu) chỉ có Admin quản lý - loại trừ khỏi danh sách bảng của nhân viên
    const filteredTabs = tabs.filter((t) => t !== 'staff_management' && t !== 'revenue');
    // Tab Thông Tin Nhân Viên luôn hiện cho nhân viên để xem hồ sơ và lương cá nhân (lấy từ Bảng 7)
    if (!filteredTabs.includes('staff_info')) {
      filteredTabs.push('staff_info');
    }
    // Tab Làm Ảnh cho phép nhân viên truy cập để làm ảnh & nhận việc ghép ảnh
    if (!filteredTabs.includes('image_studio')) {
      filteredTabs.push('image_studio');
    }
    // Bảng 10: Thống Kê View (view_stats) hiển thị khi được tích chọn trong allowedTabs HOẶC khi Admin đã gán Mã NV Web
    const hasAssignedWpCode = Boolean(
      (currentAcc?.wpEmployeeCode && currentAcc.wpEmployeeCode !== 'NONE') ||
        (currentUser.wpEmployeeCode && currentUser.wpEmployeeCode !== 'NONE') ||
        (!Array.isArray(assigned) && resolveAccountWpEmployeeCode(currentAcc, currentUser.name))
    );
    if (hasAssignedWpCode && !filteredTabs.includes('view_stats')) {
      filteredTabs.push('view_stats');
    }
    // Bảng 11: Viết Bài & Đẩy Web (WebPublish Studio) cho phép nhân viên truy cập để soạn thảo và đẩy bài lên website
    if (!filteredTabs.includes('web_publish')) {
      filteredTabs.push('web_publish');
    }
    return filteredTabs;
  }, [currentUser, accounts]);

  // Tự động chuyển activeTab về bảng hợp lệ đầu tiên nếu bảng hiện tại không được phép
  useEffect(() => {
    if (userAllowedTabs.length > 0 && !userAllowedTabs.includes(activeTab)) {
      setActiveTab(userAllowedTabs[0]);
    }
  }, [userAllowedTabs, activeTab]);

  const [filter, setFilter] = useState<SheetFilter>({
    search: '',
    staffName: '',
    viaUid: '',
    multiPageOnly: false,
    status: '',
    blockStatus: '',
    likeCountStatus: '',
    postingMethod: '',
    completionFilter: 'all',
    viaTransferFilter: 'all',
    bmFilter: '',
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PageRecord | null>(null);
  const [presetViaData, setPresetViaData] = useState<{ viaUid: string; staffName: string } | null>(null);

  // Modal đổi PIN cá nhân cho nhân viên từ thanh Header
  const [isStaffMyPinModalOpen, setIsStaffMyPinModalOpen] = useState(false);
  const [myNewPinValue, setMyNewPinValue] = useState('');
  const [isSavingMyPin, setIsSavingMyPin] = useState(false);
  const [myPinSuccessNotice, setMyPinSuccessNotice] = useState<string | null>(null);

  const handleSaveMyOwnPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myNewPinValue.trim()) return;
    setIsSavingMyPin(true);
    setMyPinSuccessNotice(null);
    try {
      const myAccount = accounts.find(
        (a) =>
          a.id === currentUser.id ||
          a.username.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
      );
      if (myAccount) {
        await handleUpdateAccountPin(myAccount.id, myNewPinValue.trim());
      }
      setMyPinSuccessNotice('Đã đổi mã PIN thành công! Mã PIN mới đã đồng bộ lên Cloud.');
      setTimeout(() => {
        setIsStaffMyPinModalOpen(false);
        setMyPinSuccessNotice(null);
        setMyNewPinValue('');
      }, 1000);
    } catch (err: any) {
      alert('Lỗi: ' + (err.message || 'Không thể đổi PIN'));
    } finally {
      setIsSavingMyPin(false);
    }
  };

  // 1. Initial boot: purge legacy localStorage and establish basic auth/settings connection
  useEffect(() => {
    clearAllLegacyLocalStorage();

    let unsubAccounts: (() => void) | undefined;
    let unsubSettings: (() => void) | undefined;

    async function initBaseCloudFirestore() {
      try {
        // 0. Kiểm tra Cầu Nối CSDL (db_bridge) ngay khi mở trang để tự động trỏ về CSDL của cualokhachsan@gmail.com
        const redirected = await checkAndApplyCloudDbBridge();
        if (redirected) return;

        const connected = await testFirestoreConnection();
        setIsFirestoreConnected(connected);

        // 1. Listen to live accounts (needed by login screen)
        unsubAccounts = subscribeToAccounts((cloudAccounts) => {
          if (cloudAccounts.length === 0) {
            seedCloudFirestoreIfEmpty().catch(() => {});
            return;
          }
          setAccounts(cloudAccounts);
          const adminAcc = cloudAccounts.find((a) => a.role === 'admin');
          if (adminAcc && adminAcc.email !== MASTER_OWNER_EMAIL) {
            updateCloudAccount(adminAcc.id, { email: MASTER_OWNER_EMAIL }).catch(() => {});
          }
        });

        // 2. Listen to live settings (branding & Google login policy)
        unsubSettings = subscribeToSettings((cloudSettings) => {
          if (cloudSettings) {
            const resolvedEmail = 'cualokhachsan@gmail.com';
            if (cloudSettings.adminEmail !== resolvedEmail) {
              saveCloudSettings({
                ...cloudSettings,
                id: 'general',
                adminEmail: resolvedEmail,
              }).catch(() => {});
            }
            setAdminSettings({
              adminPin: cloudSettings.adminPin || DEFAULT_ADMIN_SETTINGS.adminPin,
              adminName: cloudSettings.adminName || DEFAULT_ADMIN_SETTINGS.adminName,
              adminEmail: resolvedEmail,
              requireApproval: cloudSettings.requireApproval ?? DEFAULT_ADMIN_SETTINGS.requireApproval,
              requireGoogleLoginOnly: cloudSettings.requireGoogleLoginOnly ?? DEFAULT_ADMIN_SETTINGS.requireGoogleLoginOnly,
            });
            if (Array.isArray(cloudSettings.customStaffList)) {
              setCustomStaffList(cloudSettings.customStaffList);
            }
            if (Array.isArray(cloudSettings.deletedViaUids)) {
              const mergedDeleted = Array.from(
                new Set([
                  ...Array.from(deletedViaUidsRef.current),
                  ...cloudSettings.deletedViaUids.map((u) => normalizeViaUidKey(String(u))).filter(Boolean),
                ])
              );
              deletedViaUidsRef.current = new Set(mergedDeleted);
              setDeletedViaUids(mergedDeleted);
              saveLocalDeletedViaUids(mergedDeleted);
            }
          }
        });

        setIsLoadingFirestore(false);
      } catch (err) {
        console.error('[App] Lỗi kết nối Cloud Firestore ban đầu:', err);
        setIsLoadingFirestore(false);
      }
    }

    initBaseCloudFirestore();

    return () => {
      unsubAccounts?.();
      unsubSettings?.();
    };
  }, []);

  // 2. Authenticated Data Lifecycle: ZERO-LEAK MEMORY SHIELD
  // Only subscribe to sensitive database tables (Fanpages, Vias, Passwords, 2FA, Groups, Proxies)
  // AFTER a user is successfully verified. When logged out, automatically cancel listeners and wipe in-memory data!
  useEffect(() => {
    if (!currentUser.isAuthenticated || currentUser.id === 'guest') {
      // Zero-out ALL sensitive data arrays from RAM if not authenticated
      setRecords([]);
      setViaList([]);
      setSharedAccounts([]);
      setGroupRecords([]);
      setProxies([]);
      setFinances([]);
      setImageTasks([]);
      return;
    }

    let unsubRecords: (() => void) | undefined;
    let unsubVias: (() => void) | undefined;
    let unsubSharedAccounts: (() => void) | undefined;
    let unsubGroups: (() => void) | undefined;
    let unsubProxies: (() => void) | undefined;
    let unsubFinances: (() => void) | undefined;
    let unsubImageTasks: (() => void) | undefined;

    async function initAuthenticatedSubscriptions() {
      try {
        // Seed default initial data into Firestore if database is empty (only when authenticated)
        await seedCloudFirestoreIfEmpty();

        // 1. Listen to live page records in Cloud Firestore
        unsubRecords = subscribeToPageRecords((cloudRecords) => {
          let hasDirtyBm = false;
          const cleanedRecords = cloudRecords.map((r) => {
            const clean = getCleanBmName(r.bmNote);
            if (r.bmNote && r.bmNote !== clean) {
              hasDirtyBm = true;
            }
            return { ...r, bmNote: clean };
          });
          setRecords(cleanedRecords);

          // Tự động dọn dẹp các bản ghi cũ có dấu | trong bmNote trên Firestore
          if (hasDirtyBm) {
            const dirtyToClean = cloudRecords
              .filter((r) => r.bmNote && r.bmNote !== getCleanBmName(r.bmNote))
              .map((r) => ({ ...r, bmNote: getCleanBmName(r.bmNote) }));
            batchSaveCloudPageRecords(dirtyToClean).catch((err) =>
              console.warn('[App] Auto-clean dirty BM in Firestore:', err)
            );
          }
        });

        // 2. Listen to live full vias (passwords, 2FA, raw strings)
        unsubVias = subscribeToVias((cloudVias) => {
          const deletedSet = deletedViaUidsRef.current;
          if (deletedSet.size > 0) {
            const staleToPurge = cloudVias.filter((v) => {
              const uLower = normalizeViaUidKey(v.uid) || normalizeViaUidKey(v.rawFullVia);
              return Boolean(uLower && deletedSet.has(uLower));
            });
            if (staleToPurge.length > 0) {
              batchDeleteCloudVias(staleToPurge.map((v) => v.id)).catch(() => {});
            }
            setViaList(
              cloudVias.filter((v) => {
                const uLower = normalizeViaUidKey(v.uid) || normalizeViaUidKey(v.rawFullVia);
                return !uLower || !deletedSet.has(uLower);
              })
            );
            return;
          }
          setViaList(cloudVias);
        });

        // 3. Listen to live shared website accounts
        unsubSharedAccounts = subscribeToSharedAccounts((cloudShared) => {
          setSharedAccounts(cloudShared);
        });

        // 4. Listen to live group records in Cloud Firestore
        unsubGroups = subscribeToGroupRecords((cloudGroups) => {
          const list = cloudGroups || [];
          setGroupRecords(list);
          saveLocalGroupBackup(list);
        });

        // Fetch direct group records immediately on connect
        getCloudGroupRecords()
          .then((list) => {
            setGroupRecords(list || []);
            saveLocalGroupBackup(list || []);
          })
          .catch((err) => console.warn('[App] Direct group fetch warning:', err));

        // 5. Listen to live proxies in Cloud Firestore
        unsubProxies = subscribeToProxies((cloudProxies) => {
          if (cloudProxies && cloudProxies.length > 0) {
            setProxies(cloudProxies);
          }
        });

        // 6. Listen to live monthly finances in Cloud Firestore (KHÓA CỨNG: CHỈ ADMIN MỚI ĐƯỢC TẢI DỮ LIỆU DOANH THU VÀO RAM)
        const isLegacyMockFinance = (rec: MonthlyFinanceRecord) => {
          return (
            rec.revenueItems?.some((r) => r.id?.startsWith('rev-10-') || r.id?.startsWith('rev-09-')) ||
            rec.customExpenses?.some((e) => e.id?.startsWith('exp-10-')) ||
            rec.salaryItems?.some((s) => s.id?.startsWith('sal-10-') || s.id?.startsWith('sal-09-')) ||
            (rec.id === '2026-10' && (rec.totalRevenue === 190000000 || rec.officeCost === 18000000)) ||
            (rec.id === '2026-09' && (rec.totalRevenue === 165000000 || rec.officeCost === 18000000))
          );
        };

        const sanitizeFinanceForRole = (list: MonthlyFinanceRecord[]): MonthlyFinanceRecord[] => {
          if (currentUser.role === 'admin') return list;
          clearLocalFinanceBackup();
          clearAdminMgidVaultForNonAdmin(currentUser.role);
          return list.map((rec) => ({
            ...rec,
            revenueItems: [],
            totalRevenue: 0,
            mgidReport: undefined,
            usdToVndRate: undefined,
            officeCost: 0,
            electricityCost: 0,
            waterCost: 0,
            internetCost: 0,
            otherCosts: 0,
            customExpenses: [],
            totalExpenses: 0,
            netProfit: 0,
            salaryItems: (rec.salaryItems || []).filter(
              (s) =>
                areStaffNamesEquivalent(s.staffName, currentUser.name) ||
                (Boolean(s.accountUsername) && areStaffNamesEquivalent(s.accountUsername, currentUser.name))
            ),
          }));
        };

        unsubFinances = subscribeToMonthlyFinances((cloudFinances) => {
          if (cloudFinances && cloudFinances.length > 0) {
            if (currentUser.role === 'admin') {
              const mockRecords = cloudFinances.filter(isLegacyMockFinance);
              if (mockRecords.length > 0) {
                mockRecords.forEach((m) => {
                  deleteCloudMonthlyFinance(m.id).catch(() => {});
                });
              }
            }
            const cleanList = sanitizeFinanceForRole(
              cloudFinances.filter((f) => !isLegacyMockFinance(f))
            );
            setFinances(cleanList);
            if (currentUser.role === 'admin') {
              saveLocalFinanceBackup(cleanList);
            }
          } else {
            setFinances([]);
            clearLocalFinanceBackup();
          }
        });

        getCloudMonthlyFinances()
          .then((list) => {
            if (list && list.length > 0) {
              const cleanList = sanitizeFinanceForRole(
                list.filter((f) => !isLegacyMockFinance(f))
              );
              setFinances(cleanList);
              if (currentUser.role === 'admin') {
                saveLocalFinanceBackup(cleanList);
              }
            } else {
              setFinances([]);
              clearLocalFinanceBackup();
            }
          })
          .catch((err) => console.warn('[App] Direct finance fetch warning:', err));

        // 7. Listen to live image tasks in Cloud Firestore
        unsubImageTasks = subscribeToImageTasks((cloudTasks) => {
          if (cloudTasks && cloudTasks.length > 0) {
            setImageTasks(cloudTasks);
            saveLocalImageTasksBackup(cloudTasks);
          }
        });
      } catch (err) {
        console.error('[App] Lỗi kết nối cơ sở dữ liệu đã xác thực:', err);
      }
    }

    initAuthenticatedSubscriptions();

    return () => {
      // Unsubscribe all active listeners on logout or session change
      unsubRecords?.();
      unsubVias?.();
      unsubSharedAccounts?.();
      unsubGroups?.();
      unsubProxies?.();
      unsubFinances?.();
      unsubImageTasks?.();
    };
  }, [currentUser.isAuthenticated, currentUser.role]);

  // Real-time Session Security Guard: Tự động thu hồi phiên đăng nhập tức thì nếu tài khoản nhân viên bị Admin khóa hoặc xóa trên Cloud
  useEffect(() => {
    if (!currentUser.isAuthenticated || currentUser.role === 'admin' || accounts.length === 0) return;
    const matched = accounts.find(
      (a) =>
        a.id === currentUser.id ||
        a.username.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
    );
    if (!matched || matched.status !== 'approved') {
      clearCurrentUserSession();
      setCurrentUser(GUEST_USER);
    }
  }, [accounts, currentUser]);

  // Save current active tab session
  useEffect(() => {
    saveCurrentUserSession(currentUser);
  }, [currentUser]);

  // Pending staff approval requests count
  const pendingRequestsCount = useMemo(() => {
    return accounts.filter((a) => a.role === 'staff' && a.status === 'pending').length;
  }, [accounts]);

  // Canonical active staff members: ONLY approved staff from accounts in Cloud Firestore!
  const allStaffNames = useMemo(() => {
    const approvedStaff = accounts
      .filter((a) => a.role === 'staff' && a.status === 'approved')
      .map((a) => a.username.trim())
      .filter(Boolean);

    return Array.from(new Set(approvedStaff)).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [accounts]);

  // All distinct staff names across the entire system (accounts, customStaffList, records, viaList)
  const allSystemStaffNames = useMemo(() => {
    const staffSet = new Set<string>();
    accounts.forEach((a) => {
      if (a.role === 'staff' && a.username?.trim()) {
        staffSet.add(a.username.trim());
      }
    });
    customStaffList.forEach((s) => {
      if (s?.trim()) staffSet.add(s.trim());
    });
    records.forEach((r) => {
      if (r.staffName?.trim()) {
        staffSet.add(r.staffName.trim());
      }
    });
    viaList.forEach((v) => {
      if (v.staffName?.trim()) {
        staffSet.add(v.staffName.trim());
      }
    });
    return Array.from(staffSet).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [accounts, customStaffList, records, viaList]);

  // List of available users (Admin + each approved staff member)
  const availableUsers: AppUser[] = useMemo(() => {
    const list: AppUser[] = [DEFAULT_ADMIN_USER];
    allStaffNames.forEach((name) => {
      const matchedAccount = accounts.find(
        (a) => a.username.trim().toLowerCase() === name.toLowerCase()
      );
      list.push({
        id: matchedAccount?.id || `staff-${name.toLowerCase().replace(/\s+/g, '-')}`,
        name,
        email: matchedAccount?.email,
        role: 'staff',
        status: 'approved',
        isAuthenticated: true,
        allowedTabs: matchedAccount?.allowedTabs,
        wpEmployeeCode: matchedAccount?.wpEmployeeCode,
        wpAllowedEmployeeCodes: matchedAccount?.wpAllowedEmployeeCodes,
      });
    });
    return list;
  }, [allStaffNames, accounts]);

  // 1. Phân quyền: Nếu là nhân viên, CHỈ LẤY dữ liệu của nhân viên đó!
  const userScopedRecords = useMemo(() => {
    if (currentUser.role === 'admin') {
      return records;
    }
    return records.filter(
      (r) => !isAdminWaitingPool(r.staffName) && areStaffNamesEquivalent(r.staffName, currentUser.name)
    );
  }, [records, currentUser]);

  const userScopedVias = useMemo(() => {
    if (currentUser.role === 'admin') {
      return viaList;
    }
    return viaList.filter(
      (v) => v.staffName && !isAdminWaitingPool(v.staffName) && areStaffNamesEquivalent(v.staffName, currentUser.name)
    );
  }, [viaList, currentUser]);

  // Map counting pages per Via UID within the accessible scope
  const viaPageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    userScopedRecords.forEach((r) => {
      const uid = r.viaUid.trim();
      if (uid) {
        counts.set(uid, (counts.get(uid) || 0) + 1);
      }
    });
    return counts;
  }, [userScopedRecords]);

  // Set of Via UIDs that currently have errors
  const errorViaUids = useMemo(() => {
    const set = new Set<string>();

    viaList.forEach((v) => {
      if (v.isError || v.status === 'checkpoint' || v.status === 'dead' || v.status === 'error') {
        const uid = v.uid.trim();
        if (uid) {
          set.add(uid);
          set.add(uid.toLowerCase());
        }
      }
    });

    userScopedRecords.forEach((r) => {
      if (
        r.isViaError ||
        r.viaStatus === 'checkpoint' ||
        r.viaStatus === 'dead' ||
        r.viaStatus === 'error'
      ) {
        const uid = r.viaUid.trim();
        if (uid) {
          set.add(uid);
          set.add(uid.toLowerCase());
        }
      }
    });

    return set;
  }, [viaList, userScopedRecords]);

  // Set of Via UIDs that have been fixed / replaced by admin (bôi xanh)
  const fixedViaUids = useMemo(() => {
    const set = new Set<string>();

    viaList.forEach((v) => {
      if (v.isFixed || v.status === 'fixed') {
        const uid = v.uid.trim();
        if (uid) {
          set.add(uid);
          set.add(uid.toLowerCase());
        }
      }
    });

    userScopedRecords.forEach((r) => {
      if (r.isViaFixed || r.viaStatus === 'fixed') {
        const uid = r.viaUid.trim();
        if (uid) {
          set.add(uid);
          set.add(uid.toLowerCase());
        }
      }
    });

    return set;
  }, [viaList, userScopedRecords]);

  // Count of error vias in current user's scope (taking active staff filter into account)
  const errorViaCountInScope = useMemo(() => {
    const targetStaff =
      currentUser.role === 'staff'
        ? currentUser.name
        : filter.staffName && filter.staffName !== 'all'
        ? filter.staffName
        : null;

    if (targetStaff) {
      const currentStaffLower = targetStaff.trim().toLowerCase();
      const staffVias = viaList.filter(
        (v) => v.staffName.trim().toLowerCase() === currentStaffLower
      );
      const staffErrorViaUids = new Set<string>();
      staffVias.forEach((v) => {
        if (v.isError || v.status === 'checkpoint' || v.status === 'dead' || v.status === 'error') {
          staffErrorViaUids.add(v.uid.trim().toLowerCase());
        }
      });
      userScopedRecords.forEach((r) => {
        if (r.staffName.trim().toLowerCase() === currentStaffLower) {
          if (
            r.isViaError ||
            r.viaStatus === 'checkpoint' ||
            r.viaStatus === 'dead' ||
            r.viaStatus === 'error' ||
            (errorViaUids && r.viaUid && errorViaUids.has(r.viaUid.trim().toLowerCase()))
          ) {
            staffErrorViaUids.add(r.viaUid.trim().toLowerCase());
          }
        }
      });
      return staffErrorViaUids.size;
    }

    return errorViaUids.size;
  }, [currentUser, filter.staffName, viaList, userScopedRecords, errorViaUids]);

  // Count of fixed vias in current user's scope (taking active staff filter into account)
  const fixedViaCountInScope = useMemo(() => {
    const targetStaff =
      currentUser.role === 'staff'
        ? currentUser.name
        : filter.staffName && filter.staffName !== 'all'
        ? filter.staffName
        : null;

    if (targetStaff) {
      const currentStaffLower = targetStaff.trim().toLowerCase();
      const staffVias = viaList.filter(
        (v) => v.staffName.trim().toLowerCase() === currentStaffLower
      );
      const staffFixedViaUids = new Set<string>();
      staffVias.forEach((v) => {
        if (v.isFixed || v.status === 'fixed') {
          staffFixedViaUids.add(v.uid.trim().toLowerCase());
        }
      });
      userScopedRecords.forEach((r) => {
        if (r.staffName.trim().toLowerCase() === currentStaffLower) {
          if (r.isViaFixed || r.viaStatus === 'fixed') {
            staffFixedViaUids.add(r.viaUid.trim().toLowerCase());
          }
        }
      });
      return staffFixedViaUids.size;
    }

    return fixedViaUids.size;
  }, [currentUser, filter.staffName, viaList, userScopedRecords, fixedViaUids]);

  // Tab list scrolling and scientific tab config
  const tabListRef = useRef<HTMLDivElement>(null);

  const handleScrollTabs = (direction: 'left' | 'right') => {
    if (tabListRef.current) {
      const offset = direction === 'left' ? -260 : 260;
      tabListRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const navTabs = useMemo(() => [
    {
      id: 'fanpage' as TabKey,
      num: 1,
      title: 'Fanpage',
      fullTitle: 'Bảng 1: Quản Lý Fanpage & Tiến Độ Đăng Bài',
      icon: FileSpreadsheet,
      count: userScopedRecords.length,
      newCount: userScopedRecords.filter(
        (r) =>
          !isAdminWaitingPool(r.staffName) &&
          (Boolean(r.isNewlyTransferred) ||
            viaList.some(
              (v) =>
                normalizeViaUidKey(v.uid) === normalizeViaUidKey(r.viaUid) &&
                Boolean(v.isNewlyTransferred || v.pageUpdateStatus === 'pending')
            ))
      ).length,
      unit: 'Page',
      activeClass: 'bg-emerald-700 text-white shadow-xs ring-2 ring-emerald-500/25',
      activeNumClass: 'bg-white/20 text-white',
      dotColor: 'bg-emerald-500',
      accentColor: 'text-emerald-700',
      description: 'Theo dõi tiến độ đăng bài, trạng thái đề xuất, phân công Fanpage cho nhân sự',
      visible: userAllowedTabs.includes('fanpage'),
    },
    {
      id: 'group' as TabKey,
      num: 2,
      title: 'Group',
      fullTitle: 'Bảng 2: Quản Lý Group Facebook & Tương Tác',
      icon: Users,
      count:
        currentUser.role === 'admin'
          ? groupRecords.length
          : groupRecords.filter((g) => g.staffName.trim().toLowerCase() === currentUser.name.trim().toLowerCase()).length,
      newCount: 0,
      unit: 'Dòng',
      activeClass: 'bg-red-700 text-white shadow-xs ring-2 ring-red-500/25',
      activeNumClass: 'bg-white/20 text-white',
      dotColor: 'bg-red-500',
      accentColor: 'text-red-700',
      description: 'Quản lý hội nhóm tương tác, thống kê via VHH & hạn chế tài khoản',
      visible: userAllowedTabs.includes('group'),
    },
    {
      id: 'proxy' as TabKey,
      num: 3,
      title: 'Proxy',
      fullTitle: 'Bảng 3: Quản Lý Proxy Mạng & IP Nuôi Via',
      icon: Network,
      count:
        currentUser.role === 'admin'
          ? proxies.length
          : proxies.filter(
              (p) =>
                (p.assignedStaff || []).includes('ALL') ||
                (p.assignedStaff || []).some(
                  (s) => s.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
                )
            ).length,
      newCount: 0,
      unit: 'Proxy',
      activeClass: 'bg-teal-700 text-white shadow-xs ring-2 ring-teal-500/25',
      activeNumClass: 'bg-white/20 text-white',
      dotColor: 'bg-teal-500',
      accentColor: 'text-teal-700',
      description: 'Quản lý IP proxy IPv4/IPv6, kiểm tra live/die, phân công nhân viên',
      visible: userAllowedTabs.includes('proxy'),
    },
    {
      id: 'fullvia' as TabKey,
      num: 4,
      title: 'Full Via',
      fullTitle: 'Bảng 4: Quản Lý Kho Nick Full Via (UID | Pass | 2FA)',
      icon: KeyRound,
      count:
        currentUser.role === 'admin'
          ? viaList.length
          : viaList.filter((v) => v.staffName.trim().toLowerCase() === currentUser.name.trim().toLowerCase()).length,
      newCount: (
        currentUser.role === 'admin'
          ? viaList
          : viaList.filter((v) => v.staffName.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
      ).filter(
        (v) =>
          !isAdminWaitingPool(v.staffName) &&
          Boolean(
            v.isNewlyTransferred ||
              v.pageUpdateStatus === 'pending' ||
              (v.hasAdminAssignedPage && v.pageUpdateStatus !== 'updated')
          )
      ).length,
      unit: 'Via',
      activeClass: 'bg-indigo-700 text-white shadow-xs ring-2 ring-indigo-500/25',
      activeNumClass: 'bg-white/20 text-white',
      dotColor: 'bg-indigo-500',
      accentColor: 'text-indigo-700',
      description: 'Kho lưu trữ UID, mật khẩu, mã 2FA, cookie và trạng thái live nick',
      visible: userAllowedTabs.includes('fullvia'),
    },
    {
      id: 'staff_management' as TabKey,
      num: 5,
      title: 'Quản Trị NV',
      fullTitle: 'Bảng 5: Quản Trị Nhân Sự, Phân Quyền Bảng & Bảo Mật',
      icon: Users,
      count: accounts.filter((a) => a.role === 'staff').length,
      newCount: 0,
      unit: 'NV',
      activeClass: 'bg-blue-700 text-white shadow-xs ring-2 ring-blue-500/25',
      activeNumClass: 'bg-white/20 text-white',
      dotColor: 'bg-blue-500',
      accentColor: 'text-blue-700',
      description: 'Quản trị danh sách nhân sự, cấp quyền bảng, đổi mã PIN và bảo mật (Chỉ Admin)',
      visible: userAllowedTabs.includes('staff_management') && currentUser.role === 'admin',
    },
    {
      id: 'shared_accounts' as TabKey,
      num: 6,
      title: 'Web Chung',
      fullTitle: 'Bảng 6: Quản Lý Tài Khoản Web Dùng Chung',
      icon: Globe,
      count:
        currentUser.role === 'admin'
          ? sharedAccounts.length
          : sharedAccounts.filter(
              (a) =>
                (a.assignedStaff || []).includes('ALL') ||
                (a.assignedStaff || []).some(
                  (s) => s.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
                )
            ).length,
      newCount: 0,
      unit: 'TK',
      activeClass: 'bg-purple-700 text-white shadow-xs ring-2 ring-purple-500/25',
      activeNumClass: 'bg-white/20 text-white',
      dotColor: 'bg-purple-500',
      accentColor: 'text-purple-700',
      description: 'Chia sẻ tài khoản công cụ thiết kế, AI, media cho nhân viên (Canva, GPT, Capcut...)',
      visible: userAllowedTabs.includes('shared_accounts'),
    },
    {
      id: 'revenue' as TabKey,
      num: 7,
      title: 'Doanh Thu & Chi',
      fullTitle: 'Bảng 7: Quản Lý Doanh Thu, Chi Phí & Lương Nhân Viên Từng Tháng',
      icon: DollarSign,
      count: finances.length,
      newCount: 0,
      unit: 'Tháng',
      activeClass: 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-500/25',
      activeNumClass: 'bg-white/20 text-white',
      dotColor: 'bg-amber-500',
      accentColor: 'text-amber-600',
      description: 'Tổng tiền về do admin nhập, trừ chi phí văn phòng, điện, nước và lương nhân viên (Chỉ Admin)',
      visible: userAllowedTabs.includes('revenue') && currentUser.role === 'admin',
    },
    {
      id: 'staff_info' as TabKey,
      num: currentUser.role === 'admin' ? 8 : (userAllowedTabs.indexOf('staff_info') !== -1 ? userAllowedTabs.indexOf('staff_info') + 1 : 5),
      title: 'Thông Tin NV',
      fullTitle: 'Thông Tin Nhân Viên, Ngày Sinh, Lương & Doanh Thu (Từ Bảng 7)',
      icon: Contact,
      count: currentUser.role === 'admin' ? Math.max(allStaffNames.length, 1) : 1,
      newCount: 0,
      unit: 'Hồ sơ',
      activeClass: 'bg-blue-700 text-white shadow-xs ring-2 ring-blue-500/25',
      activeNumClass: 'bg-white/20 text-white',
      dotColor: 'bg-blue-500',
      accentColor: 'text-blue-700',
      description: 'Hiện họ và tên, ngày tháng năm sinh, lương, doanh thu và tổng lương lấy từ Bảng 7',
      visible: userAllowedTabs.includes('staff_info') || currentUser.role === 'staff' || currentUser.role === 'admin',
    },
    {
      id: 'image_studio' as TabKey,
      num: currentUser.role === 'admin' ? 9 : (userAllowedTabs.indexOf('image_studio') !== -1 ? userAllowedTabs.indexOf('image_studio') + 1 : 6),
      title: 'Làm Ảnh',
      fullTitle: 'Bảng 9: Xưởng Ghép Ảnh & Chia Việc Nhân Viên (lamanh.vercel.app)',
      icon: ImageIcon,
      count: imageTasks.length,
      newCount: 0,
      unit: 'Bài',
      activeClass: 'bg-rose-700 text-white shadow-xs ring-2 ring-rose-500/25',
      activeNumClass: 'bg-white/20 text-white',
      dotColor: 'bg-rose-500',
      accentColor: 'text-rose-700',
      description: 'Xưởng ghép ảnh đa bố cục, Story FB, viral, và phân chia việc cho nhân viên làm ảnh',
      visible: userAllowedTabs.includes('image_studio'),
    },
    {
      id: 'view_stats' as TabKey,
      num: currentUser.role === 'admin' ? 10 : (userAllowedTabs.indexOf('view_stats') !== -1 ? userAllowedTabs.indexOf('view_stats') + 1 : 7),
      title: 'Thống Kê View',
      fullTitle: 'Bảng 10: Thống Kê View Website (celeb24h.com)',
      icon: BarChart3,
      count: 'Live',
      newCount: 0,
      unit: 'View',
      activeClass: 'bg-cyan-700 text-white shadow-xs ring-2 ring-cyan-500/25',
      activeNumClass: 'bg-white/20 text-white',
      dotColor: 'bg-cyan-500',
      accentColor: 'text-cyan-700',
      description: 'Số liệu thống kê Realtime, Top 10 bài viết, lượt xem theo ngày và bảng xếp hạng mã nhân viên từ celeb24h.com',
      visible: userAllowedTabs.includes('view_stats'),
    },
    {
      id: 'web_publish' as TabKey,
      num: currentUser.role === 'admin' ? 11 : (userAllowedTabs.indexOf('web_publish') !== -1 ? userAllowedTabs.indexOf('web_publish') + 1 : 8),
      title: 'Viết Bài Web',
      fullTitle: 'Bảng 11: WebPublish Studio - Soạn Thảo & Đẩy Bài Lên Website (celeb24h.com)',
      icon: PenTool,
      count: 'WP',
      newCount: 0,
      unit: 'Bài',
      activeClass: 'bg-emerald-700 text-white shadow-xs ring-2 ring-emerald-500/25',
      activeNumClass: 'bg-white/20 text-white',
      dotColor: 'bg-emerald-500',
      accentColor: 'text-emerald-700',
      description: 'Soạn thảo bài viết chuẩn SEO, viết bài AI, tải ảnh đại diện và đẩy trực tiếp lên website celeb24h.com kèm mã nhân viên',
      visible: userAllowedTabs.includes('web_publish'),
    },
  ].filter((t) => t.visible), [userAllowedTabs, currentUser, userScopedRecords, groupRecords, proxies, viaList, accounts, sharedAccounts, finances, imageTasks]);

  const currentActiveNavTab = useMemo(() => {
    return navTabs.find((t) => t.id === activeTab) || navTabs[0];
  }, [navTabs, activeTab]);

  // Filtered records based on active filters
  const filteredRecords = useMemo(() => {
    return userScopedRecords.filter((r) => {
      if (filter.search && filter.search.trim()) {
        const rawLines = filter.search
          .split(/\r?\n|,|;/)
          .map((l) => l.trim())
          .filter(Boolean);

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
          const rPage = r.pageName.toLowerCase();
          const rVia = r.viaUid.toLowerCase();
          const rFull = (r.fullVia || '').toLowerCase();
          const rStaff = r.staffName.toLowerCase();
          const rNote = getCleanBmName(r.bmNote).toLowerCase();
          const rTransfer = (r.viaTransferNote || '').toLowerCase();

          const matchedAny = searchTokens.some(({ fullLine, uidToken }) => {
            if (uidToken && rVia.includes(uidToken)) return true;
            return (
              rPage.includes(fullLine) ||
              rVia.includes(fullLine) ||
              rFull.includes(fullLine) ||
              rStaff.includes(fullLine) ||
              rNote.includes(fullLine) ||
              rTransfer.includes(fullLine)
            );
          });

          if (!matchedAny) {
            return false;
          }
        }
      }

      if (currentUser.role === 'admin' && filter.staffName) {
        if (isAdminWaitingPool(filter.staffName)) {
          if (!isAdminWaitingPool(r.staffName) && Boolean(r.staffName?.trim())) {
            return false;
          }
        } else if (
          r.staffName.toLowerCase() !== filter.staffName.toLowerCase() &&
          !areStaffNamesEquivalent(r.staffName, filter.staffName)
        ) {
          return false;
        }
      }

      if (filter.viaUid && r.viaUid !== filter.viaUid) {
        return false;
      }

      if (filter.bmFilter && filter.bmFilter !== 'all') {
        const cleanBm = getCleanBmName(r.bmNote);
        if (filter.bmFilter === '__none__') {
          if (cleanBm) return false;
        } else {
          if (cleanBm.toLowerCase() !== getCleanBmName(filter.bmFilter).toLowerCase()) {
            return false;
          }
        }
      }

      if (filter.multiPageOnly) {
        const count = viaPageCounts.get(r.viaUid.trim()) || 0;
        if (count < 2) return false;
      }

      if (filter.errorViaOnly) {
        const isErr = Boolean(
          r.isViaError ||
            r.viaStatus === 'checkpoint' ||
            r.viaStatus === 'dead' ||
            r.viaStatus === 'error' ||
            (r.viaUid && (errorViaUids.has(r.viaUid.trim()) || errorViaUids.has(r.viaUid.trim().toLowerCase())))
        );
        if (!isErr) return false;
      }

      if (filter.fixedViaOnly) {
        const isFix = Boolean(
          r.isViaFixed ||
            r.viaStatus === 'fixed' ||
            (r.viaUid && (fixedViaUids.has(r.viaUid.trim()) || fixedViaUids.has(r.viaUid.trim().toLowerCase())))
        );
        if (!isFix) return false;
      }

      if (filter.status && r.status !== filter.status) {
        return false;
      }

      if (filter.blockStatus && r.blockStatus !== filter.blockStatus) {
        return false;
      }

      if (filter.likeCountStatus && (r.likeCountStatus || 'Đếm Like') !== filter.likeCountStatus) {
        return false;
      }

      if (filter.postingMethod && r.postingMethod !== filter.postingMethod) {
        return false;
      }

      if (filter.completionFilter !== 'all') {
        const isDoing = r.progressStatus
          ? r.progressStatus === 'Đang làm'
          : r.isCompleted || (r.targetPosts > 0 && r.actualPosts >= r.targetPosts);
        if (filter.completionFilter === 'completed' && !isDoing) return false;
        if (filter.completionFilter === 'in_progress' && isDoing) return false;
      }

      if (filter.viaTransferFilter && filter.viaTransferFilter !== 'all') {
        if (filter.viaTransferFilter === 'has_note') {
          const hasNote = Boolean(
            r.viaTransferNote ||
              (r.viaTransferStatus && r.viaTransferStatus !== 'none') ||
              r.viaTransferColor
          );
          if (!hasNote) return false;
        } else if (filter.viaTransferFilter === 'not_none') {
          if (!r.viaTransferStatus || r.viaTransferStatus === 'none') return false;
        } else {
          if (r.viaTransferStatus !== filter.viaTransferFilter) return false;
        }
      }

      return true;
    });
  }, [userScopedRecords, filter, currentUser, viaPageCounts, errorViaUids]);

  // Authentication & Approval Handlers
  const handleLoginSuccess = (user: AppUser) => {
    saveCurrentUserSession(user);
    setCurrentUser(user);
    setIsAuthModalOpen(false);
  };

  const handleLogout = () => {
    clearCurrentUserSession();
    setCurrentUser(GUEST_USER);
    // Sanitize in-memory sensitive collections immediately to prevent memory leaks
    setRecords([]);
    setViaList([]);
    setSharedAccounts([]);
    setGroupRecords([]);
    setProxies([]);
    setAuthModalTab('login');
    setIsAuthModalOpen(true);
  };

  const handleOpenAuthModal = (tab: 'login' | 'request' = 'login') => {
    setAuthModalTab(tab);
    setIsAuthModalOpen(true);
  };

  const handleRequestAccess = (
    username: string,
    pin: string,
    requestNote?: string,
    email?: string
  ): { success: boolean; message: string } => {
    const trimmed = username.trim();
    const cleanEmail = email?.trim() ? email.trim().toLowerCase() : undefined;
    const existing = accounts.find(
      (a) =>
        (cleanEmail && a.email && a.email.trim().toLowerCase() === cleanEmail) ||
        a.username.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (existing) {
      if (existing.status === 'pending') {
        return {
          success: false,
          message: `Email "${existing.email || trimmed}" đã gửi yêu cầu trước đó và đang chờ Admin duyệt.`,
        };
      }
      if (existing.status === 'approved') {
        return {
          success: false,
          message: `Email "${existing.email || trimmed}" đã được Admin duyệt! Vui lòng đăng nhập bằng Google.`,
        };
      }
      if (existing.status === 'blocked') {
        return {
          success: false,
          message: `Email "${existing.email || trimmed}" đang bị Quản Lý tạm khóa. Vui lòng liên hệ Admin!`,
        };
      }
    }

    const cleanNote = requestNote?.trim() || undefined;

    const newRequest: UserAccount = {
      id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      username: trimmed,
      role: 'staff',
      status: 'pending',
      pin: pin.trim(),
      createdAt: new Date().toLocaleDateString('vi-VN'),
      ...(cleanEmail ? { email: cleanEmail } : {}),
      ...(cleanNote ? { requestNote: cleanNote } : {}),
    };

    // Optimistically update React state immediately
    setAccounts((prev) => [...prev.filter((a) => a.id !== newRequest.id), newRequest]);

    // Save directly to Cloud Firestore
    setCloudAccount(newRequest).catch((err) => {
      console.error('[App] Lỗi khi lưu yêu cầu xin cấp quyền lên Cloud Firestore:', err);
    });

    return {
      success: true,
      message: `Đã gửi yêu cầu cấp quyền cho nhân viên "${trimmed}" (${cleanEmail || ''}) tới Admin (${adminSettings.adminEmail || 'cualokhachsan@gmail.com'}) thành công! Vui lòng chờ Admin duyệt.`,
    };
  };

  const handleApproveAccount = async (accountId: string) => {
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) return;

    const approvedAt = new Date().toLocaleDateString('vi-VN');
    const defaultTabs: TabKey[] = ['fanpage', 'fullvia', 'image_studio'];
    const allowedTabs = (acc.allowedTabs && acc.allowedTabs.length > 0) ? acc.allowedTabs : defaultTabs;

    const updatedAcc: UserAccount = {
      ...acc,
      status: 'approved',
      approvedAt,
      allowedTabs,
    };

    // Optimistically update React state immediately
    setAccounts((prev) => prev.map((a) => (a.id === accountId ? updatedAcc : a)));

    const staffName = acc.username.trim();
    const nextStaff = Array.from(new Set([...customStaffList, staffName]));
    setCustomStaffList(nextStaff);

    // Persist to Cloud Firestore
    await updateCloudAccount(accountId, {
      status: 'approved',
      approvedAt,
      allowedTabs,
    });
    await saveCloudSettings({ customStaffList: nextStaff });
  };

  const handleRejectAccount = async (accountId: string) => {
    const acc = accounts.find((a) => a.id === accountId);
    if (
      accountId === 'admin' ||
      accountId === 'account-admin' ||
      acc?.role === 'admin' ||
      acc?.email?.trim().toLowerCase() === MASTER_OWNER_EMAIL
    ) {
      return;
    }

    // Optimistically remove from React state immediately
    setAccounts((prev) => prev.filter((a) => a.id !== accountId));

    await deleteCloudAccount(accountId);

    if (acc) {
      const staffNameLower = acc.username.trim().toLowerCase();
      const nextStaff = customStaffList.filter(
        (name) => name.trim().toLowerCase() !== staffNameLower
      );
      setCustomStaffList(nextStaff);
      await saveCloudSettings({ customStaffList: nextStaff });
    }
  };

  const handleBlockAccount = async (accountId: string) => {
    const acc = accounts.find((a) => a.id === accountId);
    if (
      accountId === 'admin' ||
      accountId === 'account-admin' ||
      acc?.role === 'admin' ||
      acc?.email?.trim().toLowerCase() === MASTER_OWNER_EMAIL
    ) {
      return;
    }
    // Optimistically update React state immediately
    setAccounts((prev) =>
      prev.map((a) => (a.id === accountId ? { ...a, status: 'blocked' } : a))
    );
    await updateCloudAccount(accountId, { status: 'blocked' });

    if (currentUser.id === accountId || accounts.find((a) => a.id === accountId)?.username === currentUser.name) {
      handleLogout();
    }
  };

  const handleUnblockAccount = async (accountId: string) => {
    // Optimistically update React state immediately
    setAccounts((prev) =>
      prev.map((a) => (a.id === accountId ? { ...a, status: 'approved' } : a))
    );
    await updateCloudAccount(accountId, { status: 'approved' });
  };

  const handleUpdateAccountPin = async (accountId: string, newPin: string) => {
    const cleanPin = newPin.trim();
    const existing = accounts.find((a) => a.id === accountId);
    if (existing) {
      // Optimistically update React state immediately
      setAccounts((prev) =>
        prev.map((a) => (a.id === accountId ? { ...a, pin: cleanPin } : a))
      );
      await updateCloudAccount(accountId, { pin: cleanPin });
    } else {
      const username = accountId.replace('staff-', '').replace('account-', '').replace(/-/g, ' ');
      const newAcc: UserAccount = {
        id: accountId,
        username,
        role: 'staff',
        status: 'approved',
        pin: cleanPin,
        createdAt: new Date().toLocaleDateString('vi-VN'),
        approvedAt: new Date().toLocaleDateString('vi-VN'),
        adminNote: 'Tài khoản nhân viên được cấp quyền tự động',
      };
      setAccounts((prev) => [...prev.filter((a) => a.id !== accountId), newAcc]);
      await setCloudAccount(newAcc);
    }
  };

  const handleUpdateAccountInfo = async (accountId: string, updates: Partial<UserAccount>) => {
    const existing = accounts.find((a) => a.id === accountId);
    if (existing) {
      const updated = { ...existing, ...updates };
      setAccounts((prev) => prev.map((a) => (a.id === accountId ? updated : a)));
      await updateCloudAccount(accountId, updates);
    } else {
      const username = updates.username || accountId.replace('staff-', '').replace('account-', '').replace(/-/g, ' ');
      const newAcc: UserAccount = {
        id: accountId,
        username,
        role: 'staff',
        status: 'approved',
        pin: updates.pin || '123456',
        createdAt: new Date().toLocaleDateString('vi-VN'),
        approvedAt: new Date().toLocaleDateString('vi-VN'),
        adminNote: updates.adminNote || 'Tài khoản nhân viên được cấp quyền tự động',
        ...(updates.email ? { email: updates.email } : {}),
      };
      setAccounts((prev) => [...prev.filter((a) => a.id !== accountId), newAcc]);
      await setCloudAccount(newAcc);
    }
  };

  const handleDeleteAccount = async (
    accountId: string,
    options?: { deletePosts?: boolean; deleteVias?: boolean }
  ) => {
    const acc = accounts.find((a) => a.id === accountId);
    if (
      accountId === 'admin' ||
      accountId === 'account-admin' ||
      acc?.role === 'admin' ||
      acc?.email?.trim().toLowerCase() === MASTER_OWNER_EMAIL
    ) {
      return;
    }
    const staffName = acc?.username.trim();
    const staffNameLower = staffName?.toLowerCase();

    // 1. Optimistically remove account from React state immediately
    setAccounts((prev) => prev.filter((a) => a.id !== accountId));

    // 2. Delete account from Cloud Firestore
    await deleteCloudAccount(accountId);

    // 3. Remove staff from customStaffList in React state and Firestore
    if (staffNameLower) {
      const updatedStaff = customStaffList.filter(
        (name) => name.trim().toLowerCase() !== staffNameLower
      );
      setCustomStaffList(updatedStaff);
      await saveCloudSettings({ customStaffList: updatedStaff });
    }

    // 4. Delete records of this staff member if requested
    const shouldDeletePosts = options ? options.deletePosts : true;
    if (shouldDeletePosts && staffNameLower) {
      const idsToDelete = records
        .filter((r) => r.staffName.trim().toLowerCase() === staffNameLower)
        .map((r) => r.id);
      if (idsToDelete.length > 0) {
        setRecords((prev) => prev.filter((r) => r.staffName.trim().toLowerCase() !== staffNameLower));
        await batchDeleteCloudPageRecords(idsToDelete);
      }
    }

    // 5. Delete vias assigned to this staff member if requested
    const shouldDeleteVias = options ? options.deleteVias : true;
    if (shouldDeleteVias && staffNameLower) {
      const viaIdsToDelete = viaList
        .filter((v) => v.staffName.trim().toLowerCase() === staffNameLower)
        .map((v) => v.id);
      if (viaIdsToDelete.length > 0) {
        setViaList((prev) => prev.filter((v) => v.staffName.trim().toLowerCase() !== staffNameLower));
        await batchDeleteCloudVias(viaIdsToDelete);
      }
    }

    // 6. Logout if this was the logged-in user
    if (acc && currentUser.name.trim().toLowerCase() === staffNameLower) {
      handleLogout();
    }
  };

  const handleDeleteStaffPosts = async (staffName: string) => {
    const targetName = staffName.trim().toLowerCase();
    if (!targetName) return;

    const idsToDelete = records
      .filter((r) => r.staffName.trim().toLowerCase() === targetName)
      .map((r) => r.id);

    if (idsToDelete.length > 0) {
      await batchDeleteCloudPageRecords(idsToDelete);
    }
  };

  const handleOpenDeleteStaffModal = (staffName?: string) => {
    setSelectedStaffToDelete(staffName || '');
    setIsDeleteStaffModalOpen(true);
  };

  const handleConfirmDeleteStaffAllData = async (
    staffName: string,
    options: {
      deleteFanpages: boolean;
      deleteVias: boolean;
      deleteAccount: boolean;
    }
  ) => {
    const cleanStaff = staffName.trim();
    const staffLower = cleanStaff.toLowerCase();
    if (!cleanStaff) return;

    // 1. Delete Fanpage records
    if (options.deleteFanpages) {
      const recordsToDelete = records.filter(
        (r) => r.staffName?.trim().toLowerCase() === staffLower
      );
      const ids = recordsToDelete.map((r) => r.id);
      if (ids.length > 0) {
        setRecords((prev) =>
          prev.filter((r) => r.staffName?.trim().toLowerCase() !== staffLower)
        );
        await batchDeleteCloudPageRecords(ids);
      }
    }

    // 2. Delete Vias
    if (options.deleteVias) {
      const viasToDelete = viaList.filter(
        (v) => v.staffName?.trim().toLowerCase() === staffLower
      );
      const viaIds = viasToDelete.map((v) => v.id);
      if (viaIds.length > 0) {
        setViaList((prev) =>
          prev.filter((v) => v.staffName?.trim().toLowerCase() !== staffLower)
        );
        await batchDeleteCloudVias(viaIds);
      }

      // Also clean up Group records of this staff
      const groupsToDelete = groupRecords.filter(
        (g) => g.staffName?.trim().toLowerCase() === staffLower
      );
      const groupIds = groupsToDelete.map((g) => g.id);
      if (groupIds.length > 0) {
        setGroupRecords((prev) =>
          prev.filter((g) => g.staffName?.trim().toLowerCase() !== staffLower)
        );
        await batchDeleteCloudGroupRecords(groupIds);
      }
    }

    // 3. Delete Account(s)
    if (options.deleteAccount) {
      const matchingAccounts = accounts.filter(
        (a) => a.username?.trim().toLowerCase() === staffLower
      );
      for (const acc of matchingAccounts) {
        setAccounts((prev) => prev.filter((a) => a.id !== acc.id));
        await deleteCloudAccount(acc.id);
      }
    }

    // 4. Remove from customStaffList
    const nextStaff = customStaffList.filter(
      (s) => s.trim().toLowerCase() !== staffLower
    );
    setCustomStaffList(nextStaff);
    await saveCloudSettings({ customStaffList: nextStaff });

    // 5. Reset filter if currently filtering by this staff
    if (filter.staffName?.trim().toLowerCase() === staffLower) {
      setFilter((prev) => ({ ...prev, staffName: '' }));
    }

    // 6. If currently logged in as this staff, log out
    if (currentUser.name?.trim().toLowerCase() === staffLower) {
      handleLogout();
    }
  };

  // Helper hợp nhất thông tin Full Via (UID|Pass|2FA) từ danh sách FullViaItem và PageRecord
  const buildMergedViaForStaff = (
    cleanUid: string,
    targetCleanStaff: string,
    matchingVias: FullViaItem[],
    heldPages: PageRecord[],
    options?: {
      rawFullViaHint?: string;
      appendHistoryNote?: boolean;
      historyNoteText?: string;
      dateStr?: string;
      markNewTransfer?: boolean;
    }
  ): { primaryVia: FullViaItem; duplicateViaIds: string[]; resolvedFullViaStr: string } => {
    const uidPure = cleanUid.split('|')[0].trim();
    const pageCount = heldPages.length;
    const dateStr = options?.dateStr || `${new Date().getDate()}/${new Date().getMonth() + 1}`;
    const isMovingToWaitingPool = isAdminWaitingPool(targetCleanStaff);
    const shouldMarkRedNew = Boolean(options?.markNewTransfer && !isMovingToWaitingPool);

    // Tìm FullViaItem giàu dữ liệu nhất (ưu tiên item đã có pass / twoFa / rawFullVia)
    const sortedVias = [...matchingVias].sort((a, b) => {
      const scoreA = (a.pass ? 2 : 0) + (a.twoFa ? 2 : 0) + (a.rawFullVia && a.rawFullVia.includes('|') ? 1 : 0);
      const scoreB = (b.pass ? 2 : 0) + (b.twoFa ? 2 : 0) + (b.rawFullVia && b.rawFullVia.includes('|') ? 1 : 0);
      return scoreB - scoreA;
    });

    const primaryExisting = sortedVias[0];
    const duplicateViaIds = sortedVias.slice(1).map((v) => v.id);

    // Trích xuất pass, 2fa, email, emailPass, rawFullVia tốt nhất từ mọi nguồn (ưu tiên hint mới bổ sung từ người dùng)
    const hintParsed = options?.rawFullViaHint
      ? parseSupplementalViaInput(options.rawFullViaHint, uidPure)
      : null;

    const samplePageFullVia =
      options?.rawFullViaHint ||
      heldPages.find((p) => p.fullVia && p.fullVia.includes('|'))?.fullVia ||
      heldPages.find((p) => p.fullVia)?.fullVia ||
      (cleanUid.includes('|') ? cleanUid : '');

    const bestRawFromVias =
      sortedVias.find((v) => v.rawFullVia && v.rawFullVia.split('|').filter(Boolean).length >= 2)?.rawFullVia ||
      primaryExisting?.rawFullVia ||
      '';

    const parsedSamplePage = parseFullVia(samplePageFullVia);
    const parsedBestVia = parseFullVia(bestRawFromVias);

    const bestPass =
      hintParsed?.pass?.trim() ||
      sortedVias.find((v) => v.pass?.trim())?.pass?.trim() ||
      parsedSamplePage?.pass?.trim() ||
      parsedBestVia?.pass?.trim() ||
      '';

    const bestTwoFa =
      hintParsed?.twoFa?.trim() ||
      sortedVias.find((v) => v.twoFa?.trim())?.twoFa?.trim() ||
      parsedSamplePage?.twoFa?.trim() ||
      parsedBestVia?.twoFa?.trim() ||
      '';

    const bestEmail =
      hintParsed?.email?.trim() ||
      sortedVias.find((v) => v.email?.trim())?.email?.trim() ||
      parsedSamplePage?.email?.trim() ||
      parsedBestVia?.email?.trim() ||
      '';

    const bestEmailPass =
      hintParsed?.emailPass?.trim() ||
      sortedVias.find((v) => v.emailPass?.trim())?.emailPass?.trim() ||
      parsedSamplePage?.emailPass?.trim() ||
      parsedBestVia?.emailPass?.trim() ||
      '';

    const bestExtra =
      (hintParsed?.extra && hintParsed.extra.length > 0 ? hintParsed.extra.join('|') : '') ||
      sortedVias.find((v) => v.extraInfo?.trim())?.extraInfo?.trim() ||
      (parsedSamplePage?.extra && parsedSamplePage.extra.length > 0 ? parsedSamplePage.extra.join('|') : '') ||
      (parsedBestVia?.extra && parsedBestVia.extra.length > 0 ? parsedBestVia.extra.join('|') : '') ||
      '';

    const resolvedFullViaStr = buildFullViaString({
      uid: uidPure,
      pass: bestPass,
      twoFa: bestTwoFa,
      email: bestEmail,
      emailPass: bestEmailPass,
      extra: bestExtra,
    });

    if (primaryExisting) {
      const primaryVia: FullViaItem = {
        ...primaryExisting,
        uid: uidPure,
        pass: bestPass || primaryExisting.pass || '',
        twoFa: bestTwoFa || primaryExisting.twoFa || '',
        ...(bestEmail || primaryExisting.email ? { email: bestEmail || primaryExisting.email } : {}),
        ...(bestEmailPass || primaryExisting.emailPass ? { emailPass: bestEmailPass || primaryExisting.emailPass } : {}),
        ...(bestExtra || primaryExisting.extraInfo ? { extraInfo: bestExtra || primaryExisting.extraInfo } : {}),
        rawFullVia: resolvedFullViaStr,
        staffName: targetCleanStaff,
        pageUpdateStatus: shouldMarkRedNew
          ? 'pending'
          : isMovingToWaitingPool
          ? pageCount > 0
            ? 'updated'
            : 'none'
          : pageCount > 0
          ? primaryExisting.pageUpdateStatus || 'updated'
          : primaryExisting.pageUpdateStatus || 'none',
        hasAdminAssignedPage: shouldMarkRedNew
          ? true
          : pageCount > 0
          ? true
          : primaryExisting.hasAdminAssignedPage,
        isNewlyTransferred: shouldMarkRedNew ? true : isMovingToWaitingPool ? false : primaryExisting.isNewlyTransferred,
        ...(shouldMarkRedNew ? { pageAssignedAt: dateStr } : {}),
        ...(options?.appendHistoryNote && options?.historyNoteText
          ? { note: options.historyNoteText, sharedNote: options.historyNoteText }
          : {}),
      };
      return { primaryVia, duplicateViaIds, resolvedFullViaStr };
    }

    const defaultNote =
      options?.appendHistoryNote && options?.historyNoteText
        ? options.historyNoteText
        : pageCount > 0
        ? `Đang cầm ${pageCount} Page (Bàn giao cho ${targetCleanStaff} ngày ${dateStr})`
        : `Bàn giao cho ${targetCleanStaff} ngày ${dateStr}`;

    const newVia: FullViaItem = {
      id: `via-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      uid: uidPure,
      pass: bestPass,
      twoFa: bestTwoFa,
      ...(bestEmail ? { email: bestEmail } : {}),
      ...(bestEmailPass ? { emailPass: bestEmailPass } : {}),
      ...(bestExtra ? { extraInfo: bestExtra } : {}),
      staffName: targetCleanStaff,
      status: 'active',
      pageUpdateStatus: shouldMarkRedNew ? 'pending' : pageCount > 0 ? 'updated' : 'none',
      hasAdminAssignedPage: shouldMarkRedNew ? true : pageCount > 0,
      isNewlyTransferred: shouldMarkRedNew,
      ...(shouldMarkRedNew ? { pageAssignedAt: dateStr } : {}),
      rawFullVia: resolvedFullViaStr,
      note: defaultNote,
      sharedNote: defaultNote,
      createdAt: new Date().toLocaleDateString('vi-VN'),
    };

    return { primaryVia: newVia, duplicateViaIds: [], resolvedFullViaStr };
  };

  // Transfer Page to another Via handlers
  const handleOpenTransferModal = (record?: PageRecord, viaUid?: string) => {
    setSelectedRecordToTransfer(record || null);
    setPresetTransferViaUid(viaUid || null);
    setIsTransferModalOpen(true);
  };

  // Xác nhận nhân viên đã nhận Via & Page mới chuyển giao -> Gỡ đánh dấu đỏ ở cả Quản Lý Page và Quản Trị Full Via
  const handleAcknowledgeNewTransfer = async (options?: {
    viaUid?: string;
    recordId?: string;
    staffName?: string;
  }) => {
    const targetViaLower = normalizeViaUidKey(options?.viaUid);
    const targetRecordId = options?.recordId;
    const targetStaffLower = options?.staffName?.trim().toLowerCase();

    const dateStr = `${new Date().getDate()}/${new Date().getMonth() + 1}`;

    // 1. Tìm các Page cần gỡ đánh dấu đỏ
    const pagesToClear = records.filter((r) => {
      if (targetRecordId && r.id === targetRecordId) return true;
      if (targetViaLower && normalizeViaUidKey(r.viaUid) === targetViaLower) return true;
      if (targetStaffLower && r.staffName.trim().toLowerCase() === targetStaffLower) {
        return Boolean(
          r.isNewlyTransferred ||
            viaList.some(
              (v) =>
                normalizeViaUidKey(v.uid) === normalizeViaUidKey(r.viaUid) &&
                Boolean(v.isNewlyTransferred || v.pageUpdateStatus === 'pending')
            )
        );
      }
      if (!targetRecordId && !targetViaLower && !targetStaffLower) {
        if (
          currentUser.role === 'staff' &&
          r.staffName.trim().toLowerCase() !== currentUser.name.trim().toLowerCase()
        ) {
          return false;
        }
        return Boolean(r.isNewlyTransferred);
      }
      return false;
    });

    const clearedPageRecords: PageRecord[] = pagesToClear.map((r) => ({
      ...r,
      isNewlyTransferred: false,
      viaTransferColor: r.viaTransferColor === 'red' ? 'green' : r.viaTransferColor,
      viaTransferStatus: r.viaTransferStatus === 'pending' ? 'completed' : r.viaTransferStatus || 'completed',
    }));

    // 2. Tìm các FullViaItem cần gỡ đánh dấu đỏ (chuyển từ pending đỏ sang updated xanh)
    const affectedViaLowers = new Set<string>();
    if (targetViaLower) affectedViaLowers.add(targetViaLower);
    pagesToClear.forEach((p) => {
      const uL = normalizeViaUidKey(p.viaUid);
      if (uL) affectedViaLowers.add(uL);
    });

    const viasToClear = viaList.filter((v) => {
      const vLower = normalizeViaUidKey(v.uid) || normalizeViaUidKey(v.rawFullVia);
      if (affectedViaLowers.has(vLower)) return true;
      if (targetStaffLower && v.staffName.trim().toLowerCase() === targetStaffLower) {
        return Boolean(v.isNewlyTransferred || v.pageUpdateStatus === 'pending');
      }
      if (!targetRecordId && !targetViaLower && !targetStaffLower) {
        if (
          currentUser.role === 'staff' &&
          v.staffName.trim().toLowerCase() !== currentUser.name.trim().toLowerCase()
        ) {
          return false;
        }
        return Boolean(v.isNewlyTransferred || v.pageUpdateStatus === 'pending');
      }
      return false;
    });

    const clearedVias: FullViaItem[] = viasToClear.map((v) => {
      const vLower = normalizeViaUidKey(v.uid) || normalizeViaUidKey(v.rawFullVia);
      const hasPages = records.some((r) => normalizeViaUidKey(r.viaUid) === vLower);
      return {
        ...v,
        isNewlyTransferred: false,
        pageUpdateStatus: hasPages ? 'updated' : 'none',
        pageUpdatedAt: dateStr,
      };
    });

    if (clearedPageRecords.length > 0) {
      const pageMap = new Map(clearedPageRecords.map((p) => [p.id, p]));
      setRecords((prev) => prev.map((r) => pageMap.get(r.id) || r));
    }
    if (clearedVias.length > 0) {
      const viaMap = new Map(clearedVias.map((v) => [v.id, v]));
      setViaList((prev) => prev.map((v) => viaMap.get(v.id) || v));
    }

    if (clearedPageRecords.length > 0) {
      await batchSaveCloudPageRecords(clearedPageRecords);
    }
    if (clearedVias.length > 0) {
      await batchSaveCloudVias(clearedVias);
    }
  };

  const handleConfirmTransferPageVia = async (params: TransferPageViaParams) => {
    const {
      pageIds,
      targetViaUid,
      targetStaffName,
      targetFullVia,
      appendHistoryNote,
      historyNoteText,
      transferViaUidsToStaff,
    } = params;

    const targetCleanStaff = targetStaffName.trim() || currentUser.name;
    const isMovingToWaitingPool = isAdminWaitingPool(targetCleanStaff);
    const shouldMarkRedNew = !isMovingToWaitingPool;
    const now = new Date();
    const dateStr = `${now.getDate()}/${now.getMonth() + 1}`;

    // CASE 1: Chuyển 1 hoặc nhiều Nick Via (UID) + TOÀN BỘ Page mà Via đó đang cầm sang cho nhân viên khác (hoặc Kho Chờ Admin)
    // ĐỒNG THỜI chuyển luôn Full Via trong Quản Lý Full Via sang cho nhân viên đó & ĐÁNH DẤU ĐỎ báo nhân viên có Via & Page mới!
    if (transferViaUidsToStaff && transferViaUidsToStaff.length > 0) {
      const uidLowerSet = new Set(
        transferViaUidsToStaff.map((u) => normalizeViaUidKey(u)).filter(Boolean)
      );
      if (uidLowerSet.size === 0) return;

      // 1a. Chuẩn bị & cập nhật (hoặc tạo mới) các Full Via trong Quản Trị Full Via sang tên nhân viên mới (kèm đánh dấu đỏ)
      const viasToSave: FullViaItem[] = [];
      const duplicateViaIdsToDelete: string[] = [];
      const fullViaStrByUidLower = new Map<string, string>();

      const uniqueRawUids = Array.from(
        new Set(transferViaUidsToStaff.map((u) => u.split('|')[0].trim()).filter(Boolean))
      );

      uniqueRawUids.forEach((cleanUid) => {
        const lower = normalizeViaUidKey(cleanUid);
        if (!lower) return;
        const heldPages = records.filter((r) => normalizeViaUidKey(r.viaUid) === lower);
        const matchingVias = viaList.filter(
          (v) => normalizeViaUidKey(v.uid) === lower || normalizeViaUidKey(v.rawFullVia) === lower
        );

        const { primaryVia, duplicateViaIds, resolvedFullViaStr } = buildMergedViaForStaff(
          cleanUid,
          targetCleanStaff,
          matchingVias,
          heldPages,
          {
            rawFullViaHint: targetFullVia,
            appendHistoryNote,
            historyNoteText,
            dateStr,
            markNewTransfer: shouldMarkRedNew,
          }
        );

        viasToSave.push(primaryVia);
        duplicateViaIdsToDelete.push(...duplicateViaIds);
        if (resolvedFullViaStr) {
          fullViaStrByUidLower.set(lower, resolvedFullViaStr);
        }
      });

      // 1b. Tính toán danh sách Fanpage cần cập nhật trực tiếp từ mảng records (kèm đánh dấu đỏ báo nhân viên mới nhận)
      const transferNoteMsg =
        appendHistoryNote && historyNoteText
          ? historyNoteText
          : shouldMarkRedNew
          ? `🔴 Mới giao Via + Page cho ${targetCleanStaff} (${dateStr})`
          : `📦 Cất Via + Page vào ${targetCleanStaff} (${dateStr})`;

      const updatedRecords: PageRecord[] = [];
      const nextRecords = records.map((r) => {
        const rUidLower = normalizeViaUidKey(r.viaUid);
        if (!rUidLower || !uidLowerSet.has(rUidLower)) return r;

        const cleanBm = (r.bmNote || '').split('|')[0].trim();
        const syncedFullVia = fullViaStrByUidLower.get(rUidLower) || r.fullVia;

        const updated: PageRecord = {
          ...r,
          staffName: targetCleanStaff,
          bmNote: cleanBm,
          viaTransferStatus: 'completed',
          viaTransferColor: shouldMarkRedNew ? 'red' : 'yellow',
          viaTransferNote: transferNoteMsg,
          viaTransferUpdatedAt: dateStr,
          isNewlyTransferred: shouldMarkRedNew,
          newlyTransferredAt: shouldMarkRedNew ? dateStr : undefined,
          ...(syncedFullVia ? { fullVia: syncedFullVia } : {}),
        };
        updatedRecords.push(updated);
        return updated;
      });

      // Cập nhật state React đồng bộ ngay lập tức cho cả Page và Full Via
      if (updatedRecords.length > 0) {
        setRecords(nextRecords);
      }

      if (viasToSave.length > 0) {
        setViaList((prev) => {
          const kept = prev.filter((v) => {
            const vLower = normalizeViaUidKey(v.uid) || normalizeViaUidKey(v.rawFullVia);
            return !uidLowerSet.has(vLower);
          });
          return [...kept, ...viasToSave];
        });
      }

      // Lưu lên Cloud Firestore
      if (updatedRecords.length > 0) {
        await batchSaveCloudPageRecords(updatedRecords);
      }
      if (viasToSave.length > 0) {
        await batchSaveCloudVias(viasToSave);
      }
      if (duplicateViaIdsToDelete.length > 0) {
        await batchDeleteCloudVias(duplicateViaIdsToDelete);
      }

      // 1c. Đồng bộ nhân viên bên Bảng Group nếu có cùng UID Via
      const matchingGroups = groupRecords.filter((g) =>
        uidLowerSet.has(normalizeViaUidKey(g.uid))
      );
      if (matchingGroups.length > 0) {
        const updatedGroups = matchingGroups.map((g) => ({
          ...g,
          staffName: targetCleanStaff,
          updatedAt: new Date().toISOString(),
        }));
        const groupMap = new Map(updatedGroups.map((g) => [g.id, g]));
        setGroupRecords((prev) => {
          const next = prev.map((g) => groupMap.get(g.id) || g);
          saveLocalGroupBackup(next);
          return next;
        });
        await batchSaveCloudGroupRecords(updatedGroups);
      }
      return;
    }

    // CASE 2: Chuyển 1 hoặc nhiều Fanpage sang Nick Via đích (và chuyển luôn Full Via trong Quản Lý Full Via sang nhân viên nhận + Đánh dấu đỏ)
    if (pageIds.length === 0 || !targetViaUid) return;

    const targetCleanVia = targetViaUid.split('|')[0].trim();
    const targetViaLower = normalizeViaUidKey(targetCleanVia);
    const pageIdSet = new Set(pageIds);

    // Tìm toàn bộ FullViaItem của targetViaUid trong Quản Lý Full Via
    const matchingTargetVias = viaList.filter(
      (v) =>
        normalizeViaUidKey(v.uid) === targetViaLower ||
        normalizeViaUidKey(v.rawFullVia) === targetViaLower
    );
    const targetHeldPages = records.filter(
      (r) => pageIdSet.has(r.id) || normalizeViaUidKey(r.viaUid) === targetViaLower
    );

    const {
      primaryVia: updatedTargetVia,
      duplicateViaIds: targetDupIds,
      resolvedFullViaStr,
    } = buildMergedViaForStaff(targetCleanVia, targetCleanStaff, matchingTargetVias, targetHeldPages, {
      rawFullViaHint: targetFullVia,
      appendHistoryNote,
      historyNoteText,
      dateStr,
      markNewTransfer: shouldMarkRedNew,
    });

    // Kiểm tra xem các UID nguồn của những Page đang chuyển có còn cầm Page nào ở nhân viên cũ không;
    // Nếu toàn bộ Page của UID nguồn đều được chuyển sang nhân viên mới thì chuyển luôn cả Full Via nguồn sang nhân viên mới
    const sourceUidsToAlsoMove = new Set<string>();
    const transferredRecordsSource = records.filter((r) => pageIdSet.has(r.id));
    transferredRecordsSource.forEach((r) => {
      const sLower = normalizeViaUidKey(r.viaUid);
      if (!sLower || sLower === targetViaLower) return;
      const remainingPagesOnSourceUid = records.filter(
        (other) => !pageIdSet.has(other.id) && normalizeViaUidKey(other.viaUid) === sLower
      );
      if (remainingPagesOnSourceUid.length === 0 && r.staffName.trim().toLowerCase() !== targetCleanStaff.toLowerCase()) {
        sourceUidsToAlsoMove.add(sLower);
      }
    });

    const viasToPersist: FullViaItem[] = [updatedTargetVia];
    const dupIdsToRemove: string[] = [...targetDupIds];

    sourceUidsToAlsoMove.forEach((srcLower) => {
      const matchingSrcVias = viaList.filter(
        (v) => normalizeViaUidKey(v.uid) === srcLower || normalizeViaUidKey(v.rawFullVia) === srcLower
      );
      if (matchingSrcVias.length > 0) {
        const { primaryVia, duplicateViaIds } = buildMergedViaForStaff(
          matchingSrcVias[0].uid,
          targetCleanStaff,
          matchingSrcVias,
          [],
          { appendHistoryNote, historyNoteText, dateStr, markNewTransfer: shouldMarkRedNew }
        );
        viasToPersist.push(primaryVia);
        dupIdsToRemove.push(...duplicateViaIds);
      }
    });

    // Tính toán danh sách PageRecord cập nhật (gồm các page được chọn + các page khác đang dùng chung targetViaUid để đồng bộ cùng 1 nhân viên)
    const updatedRecords: PageRecord[] = [];
    const nextRecords = records.map((r) => {
      const isSelectedPage = pageIdSet.has(r.id);
      const isSameTargetVia = normalizeViaUidKey(r.viaUid) === targetViaLower;
      if (!isSelectedPage && !isSameTargetVia) return r;

      const cleanBm = (r.bmNote || '').split('|')[0].trim();
      const transferNoteMsg =
        appendHistoryNote && historyNoteText
          ? historyNoteText
          : `🔴 Mới chuyển sang Via ${targetCleanVia} - NV ${targetCleanStaff}`;

      const updated: PageRecord = isSelectedPage
        ? {
            ...r,
            viaUid: targetCleanVia,
            staffName: targetCleanStaff,
            bmNote: cleanBm,
            viaTransferStatus: 'completed',
            viaTransferColor: shouldMarkRedNew ? 'red' : 'yellow',
            viaTransferNote: transferNoteMsg,
            viaTransferUpdatedAt: dateStr,
            isNewlyTransferred: shouldMarkRedNew,
            newlyTransferredAt: shouldMarkRedNew ? dateStr : undefined,
            isViaFixed: true,
            isViaError: false,
            viaStatus: 'active',
            fullVia: resolvedFullViaStr || targetFullVia || r.fullVia,
          }
        : {
            ...r,
            staffName: targetCleanStaff,
            isNewlyTransferred: shouldMarkRedNew ? true : r.isNewlyTransferred,
            newlyTransferredAt: shouldMarkRedNew ? dateStr : r.newlyTransferredAt,
            fullVia: resolvedFullViaStr || targetFullVia || r.fullVia,
          };
      updatedRecords.push(updated);
      return updated;
    });

    // Cập nhật state React đồng bộ ngay lập tức
    const movedViaLowerSet = new Set([targetViaLower, ...Array.from(sourceUidsToAlsoMove)]);
    setViaList((prev) => {
      const kept = prev.filter((v) => {
        const vLower = normalizeViaUidKey(v.uid) || normalizeViaUidKey(v.rawFullVia);
        return !movedViaLowerSet.has(vLower);
      });
      return [...kept, ...viasToPersist];
    });
    if (updatedRecords.length > 0) {
      setRecords(nextRecords);
    }

    // Lưu lên Cloud Firestore
    await batchSaveCloudVias(viasToPersist);
    if (dupIdsToRemove.length > 0) {
      await batchDeleteCloudVias(dupIdsToRemove);
    }
    if (updatedRecords.length > 0) {
      await batchSaveCloudPageRecords(updatedRecords);
    }

    // Đồng bộ bên Bảng Group nếu có cùng UID
    const matchingGroups = groupRecords.filter((g) =>
      movedViaLowerSet.has(normalizeViaUidKey(g.uid))
    );
    if (matchingGroups.length > 0) {
      const updatedGroups = matchingGroups.map((g) => ({
        ...g,
        staffName: targetCleanStaff,
        updatedAt: new Date().toISOString(),
      }));
      const groupMap = new Map(updatedGroups.map((g) => [g.id, g]));
      setGroupRecords((prev) => {
        const next = prev.map((g) => groupMap.get(g.id) || g);
        saveLocalGroupBackup(next);
        return next;
      });
      await batchSaveCloudGroupRecords(updatedGroups);
    }
  };

  const handleAddPreApprovedStaff = async (
    username: string,
    pin: string,
    adminNote?: string,
    email?: string,
    allowedTabs?: TabKey[]
  ) => {
    const trimmed = username.trim();
    if (!trimmed) return;

    const trimmedPin = pin.trim() || '123456';
    const cleanEmail = email?.trim() || undefined;
    const cleanNote = adminNote?.trim() || 'Tài khoản nhân viên được cấp quyền trực tiếp';

    // Check if account already exists
    const existing = accounts.find(
      (a) => a.username.trim().toLowerCase() === trimmed.toLowerCase()
    );

    const targetId = existing ? existing.id : `acc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const newAccount: UserAccount = {
      id: targetId,
      username: trimmed,
      role: 'staff',
      status: 'approved',
      pin: trimmedPin,
      createdAt: existing?.createdAt || new Date().toLocaleDateString('vi-VN'),
      approvedAt: new Date().toLocaleDateString('vi-VN'),
      allowedTabs:
        allowedTabs && allowedTabs.length > 0
          ? allowedTabs
          : existing?.allowedTabs || ['fanpage', 'fullvia', 'staff_management'],
      ...(cleanEmail ? { email: cleanEmail } : (existing?.email ? { email: existing.email } : {})),
      ...(cleanNote ? { adminNote: cleanNote } : {}),
    };

    // 1. Optimistically update local React state IMMEDIATELY so it shows up at once
    setAccounts((prev) => {
      const filtered = prev.filter(
        (a) => a.id !== targetId && a.username.trim().toLowerCase() !== trimmed.toLowerCase()
      );
      return [...filtered, newAccount];
    });

    const nextStaffList = Array.from(new Set([...customStaffList, trimmed]));
    setCustomStaffList(nextStaffList);

    // 2. Persist to Cloud Firestore with full error reporting
    try {
      await setCloudAccount(newAccount);
      await saveCloudSettings({ customStaffList: nextStaffList });
      console.log(`[App] Đã lưu nhân sự mới "${trimmed}" vào Cloud Firestore thành công:`, newAccount);
    } catch (err) {
      console.error('[App] Lỗi khi lưu nhân sự mới vào Cloud Firestore:', err);
      throw err;
    }
  };

  const handleUpdateAccountEmail = async (accountId: string, newEmail: string) => {
    const cleanEmail = newEmail.trim() || undefined;
    setAccounts((prev) =>
      prev.map((a) => (a.id === accountId ? { ...a, email: cleanEmail } : a))
    );
    await updateCloudAccount(accountId, { email: cleanEmail });
  };

  const handleChangeAdminProfile = async (newPin: string, newName?: string, newEmail?: string) => {
    const cleanPin = newPin.trim();
    const cleanName = newName?.trim() || adminSettings.adminName || 'Quản Lý (Admin)';
    const cleanEmail = newEmail?.trim() || adminSettings.adminEmail || 'cualokhachsan@gmail.com';

    setAdminSettings((prev) => ({
      ...prev,
      adminPin: cleanPin,
      adminName: cleanName,
      adminEmail: cleanEmail,
    }));

    if (currentUser.role === 'admin') {
      setCurrentUser((prev) => ({
        ...prev,
        name: cleanName,
        email: cleanEmail,
      }));
    }

    await saveCloudSettings({
      adminPin: cleanPin,
      adminName: cleanName,
      adminEmail: cleanEmail,
    });
  };

  const handleChangeAdminPin = async (newPin: string, newName?: string, newEmail?: string) => {
    await handleChangeAdminProfile(newPin, newName, newEmail);
  };

  const handleToggleRequireGoogleOnly = async (enabled: boolean) => {
    setAdminSettings((prev) => ({
      ...prev,
      requireGoogleLoginOnly: enabled,
    }));
    await saveCloudSettings({
      requireGoogleLoginOnly: enabled,
    });
  };

  const handleRestoreFullBackup = async (backupData: any) => {
    if (!backupData || typeof backupData !== 'object') {
      throw new Error('Dữ liệu file backup không hợp lệ');
    }

    // 1. Page Records
    if (Array.isArray(backupData.pageRecords) && backupData.pageRecords.length > 0) {
      await batchSaveCloudPageRecords(backupData.pageRecords);
      setRecords(backupData.pageRecords);
    }

    // 2. Full Vias
    if (Array.isArray(backupData.vias) && backupData.vias.length > 0) {
      await batchSaveCloudVias(backupData.vias);
      setViaList(backupData.vias);
    }

    // 3. Group Facebook
    if (Array.isArray(backupData.groupRecords) && backupData.groupRecords.length > 0) {
      await batchSaveCloudGroupRecords(backupData.groupRecords);
      setGroupRecords(backupData.groupRecords);
      saveLocalGroupBackup(backupData.groupRecords);
    }

    // 4. Proxies
    if (Array.isArray(backupData.proxies) && backupData.proxies.length > 0) {
      await batchSaveCloudProxies(backupData.proxies);
      setProxies(backupData.proxies);
    }

    // 5. Web Dùng Chung
    if (Array.isArray(backupData.sharedAccounts) && backupData.sharedAccounts.length > 0) {
      await batchSaveCloudSharedAccounts(backupData.sharedAccounts);
      setSharedAccounts(backupData.sharedAccounts);
    }

    // 6. Doanh Thu & Thu Chi
    if (Array.isArray(backupData.monthlyFinances) && backupData.monthlyFinances.length > 0) {
      await batchSaveCloudMonthlyFinances(backupData.monthlyFinances);
      setFinances(backupData.monthlyFinances);
      saveLocalFinanceBackup(backupData.monthlyFinances);
    }

    // 7. Nhiệm vụ làm ảnh
    if (Array.isArray(backupData.imageTasks) && backupData.imageTasks.length > 0) {
      await batchSaveCloudImageTasks(backupData.imageTasks);
      setImageTasks(backupData.imageTasks);
      saveLocalImageTasksBackup(backupData.imageTasks);
    }

    // 8. Tài khoản nhân viên & phân quyền (kèm PIN)
    if (Array.isArray(backupData.accounts) && backupData.accounts.length > 0) {
      const normalizedAccounts = backupData.accounts.map((acc: any) => ({
        ...acc,
        pin: acc.pin || '123456',
        ...(acc.role === 'admin' ? { email: acc.email || 'cualokhachsan@gmail.com' } : {}),
      }));
      for (const acc of normalizedAccounts) {
        if (acc && acc.id && acc.username) {
          await setCloudAccount(acc);
        }
      }
      setAccounts(normalizedAccounts);
    }

    // 9. Cài đặt hệ thống (settings/general)
    if (backupData.settings && typeof backupData.settings === 'object') {
      const nextAdminEmail = backupData.settings.adminEmail || 'cualokhachsan@gmail.com';
      const nextAdminPin = backupData.settings.adminPin || adminSettings.adminPin;
      const nextAdminName = backupData.settings.adminName || adminSettings.adminName;
      const nextStaffList = Array.isArray(backupData.settings.customStaffList)
        ? backupData.settings.customStaffList
        : customStaffList;

      setAdminSettings((prev) => ({
        ...prev,
        adminPin: nextAdminPin,
        adminName: nextAdminName,
        adminEmail: nextAdminEmail,
      }));
      setCustomStaffList(nextStaffList);

      await saveCloudSettings({
        adminPin: nextAdminPin,
        adminName: nextAdminName,
        adminEmail: nextAdminEmail,
        customStaffList: nextStaffList,
      });
    }
  };

  // Switch active user
  const handleSelectUser = (user: AppUser) => {
    setCurrentUser(user);
    setFilter((prev) => ({ ...prev, staffName: '', viaUid: '' }));
  };

  const handleAddCustomStaff = async (staffName: string) => {
    const trimmed = staffName.trim();
    if (!trimmed) return;

    const existing = accounts.find(
      (a) => a.username.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (!existing) {
      const newAcc: UserAccount = {
        id: `acc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        username: trimmed,
        role: 'staff',
        status: 'approved',
        pin: '123456',
        createdAt: new Date().toLocaleDateString('vi-VN'),
        approvedAt: new Date().toLocaleDateString('vi-VN'),
        adminNote: 'Tạo từ danh sách nhân viên',
      };
      setAccounts((prev) => [
        ...prev.filter((a) => a.username.trim().toLowerCase() !== trimmed.toLowerCase()),
        newAcc,
      ]);
      await setCloudAccount(newAcc);
    }

    if (!customStaffList.includes(trimmed)) {
      const nextStaff = [...customStaffList, trimmed];
      setCustomStaffList(nextStaff);
      await saveCloudSettings({ customStaffList: nextStaff });
    }

    const newUser: AppUser = {
      id: `staff-${trimmed.toLowerCase().replace(/\s+/g, '-')}`,
      name: trimmed,
      role: 'staff',
      status: 'approved',
      isAuthenticated: true,
    };
    setCurrentUser(newUser);
  };

  // CRUD for Page Records in Cloud Firestore
  const handleUpdateRecord = async (id: string, updates: Partial<PageRecord>) => {
    const existing = records.find((r) => r.id === id);
    if (!existing) return;

    if (
      currentUser.role === 'staff' &&
      existing.staffName.trim().toLowerCase() !== currentUser.name.trim().toLowerCase()
    ) {
      return;
    }

    const sanitizedUpdates = {
      ...(currentUser.role === 'staff' ? { ...updates, staffName: existing.staffName } : updates),
    };
    if (sanitizedUpdates.bmNote !== undefined) {
      sanitizedUpdates.bmNote = getCleanBmName(sanitizedUpdates.bmNote);
    }

    const nextStaff = (sanitizedUpdates.staffName ?? existing.staffName).trim();
    const nextViaUid = (sanitizedUpdates.viaUid ?? existing.viaUid).trim();
    const staffChanged =
      Boolean(sanitizedUpdates.staffName) &&
      nextStaff.toLowerCase() !== existing.staffName.trim().toLowerCase();
    const viaChanged =
      sanitizedUpdates.viaUid !== undefined &&
      normalizeViaUidKey(nextViaUid) !== normalizeViaUidKey(existing.viaUid);

    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...sanitizedUpdates } : r))
    );
    await updateCloudPageRecord(id, sanitizedUpdates);

    // Nếu chuyển nhân viên hoặc đổi UID trên dòng Page thì đồng bộ luôn Full Via trong Quản Lý Full Via sang nhân viên đó
    if ((staffChanged || viaChanged) && nextViaUid) {
      await handleConfirmTransferPageVia({
        pageIds: [id],
        targetViaUid: nextViaUid,
        targetStaffName: nextStaff,
        targetFullVia: sanitizedUpdates.fullVia || existing.fullVia,
        appendHistoryNote: false,
        historyNoteText: '',
        transferViaUidsToStaff: staffChanged && !viaChanged ? [nextViaUid] : undefined,
      });
    }
  };

  const handleToggleViaError = async (viaUid: string, isError: boolean) => {
    const trimmed = viaUid.trim();
    if (!trimmed) return;

    const matchingRecords = records
      .filter(
        (r) =>
          r.viaUid.trim().toLowerCase() === trimmed.toLowerCase() &&
          (currentUser.role === 'admin' ||
            r.staffName.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
      )
      .map((r) => ({
        ...r,
        isViaError: isError,
        isViaFixed: isError ? false : r.isViaFixed,
        viaStatus: isError ? ('checkpoint' as const) : ('active' as const),
      }));

    if (matchingRecords.length > 0) {
      await batchSaveCloudPageRecords(matchingRecords);
    }

    const matchingVias = viaList
      .filter(
        (v) =>
          v.uid.trim().toLowerCase() === trimmed.toLowerCase() &&
          (currentUser.role === 'admin' ||
            v.staffName.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
      )
      .map((v) => ({
        ...v,
        isError: isError,
        isFixed: isError ? false : v.isFixed,
        status: isError ? ('checkpoint' as const) : ('active' as const),
      }));

    if (matchingVias.length > 0) {
      await batchSaveCloudVias(matchingVias);
    }
  };

  // Handler for "Admin đã sửa lỗi & thay via mới" -> bôi ô via và dòng lại màu xanh lá cây
  const handleToggleViaFixed = async (viaUid: string, isFixed: boolean) => {
    const trimmed = viaUid.trim();
    if (!trimmed) return;

    // 1. Cập nhật tất cả các Page Record dùng chung viaUid này
    const matchingRecords = records
      .filter(
        (r) =>
          r.viaUid.trim().toLowerCase() === trimmed.toLowerCase() &&
          (currentUser.role === 'admin' ||
            r.staffName.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
      )
      .map((r) => ({
        ...r,
        isViaFixed: isFixed,
        isViaError: isFixed ? false : r.isViaError,
        viaStatus: isFixed ? ('fixed' as const) : ('active' as const),
      }));

    if (matchingRecords.length > 0) {
      await batchSaveCloudPageRecords(matchingRecords);
    }

    // 2. Cập nhật Nick Via trong bảng Full Via
    const matchingVias = viaList
      .filter(
        (v) =>
          v.uid.trim().toLowerCase() === trimmed.toLowerCase() &&
          (currentUser.role === 'admin' ||
            v.staffName.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
      )
      .map((v) => ({
        ...v,
        isFixed: isFixed,
        isError: isFixed ? false : v.isError,
        status: isFixed ? ('fixed' as const) : ('active' as const),
      }));

    if (matchingVias.length > 0) {
      await batchSaveCloudVias(matchingVias);
    }
  };

  // Handler for "Ghi chú chung cho tất cả các page chung 1 via" -> đồng bộ cho mọi page cùng via
  const handleUpdateViaSharedNoteForAll = async (viaUid: string, sharedNote: string) => {
    const trimmed = viaUid.trim();
    if (!trimmed) return;

    // 1. Đồng bộ cho tất cả các Page cùng viaUid
    const matchingRecords = records
      .filter(
        (r) =>
          r.viaUid.trim().toLowerCase() === trimmed.toLowerCase() &&
          (currentUser.role === 'admin' ||
            r.staffName.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
      )
      .map((r) => ({
        ...r,
        viaSharedNote: sharedNote,
      }));

    if (matchingRecords.length > 0) {
      await batchSaveCloudPageRecords(matchingRecords);
    }

    // 2. Đồng bộ vào trường note và sharedNote của Nick Via trong bảng 2
    const matchingVias = viaList
      .filter(
        (v) =>
          v.uid.trim().toLowerCase() === trimmed.toLowerCase() &&
          (currentUser.role === 'admin' ||
            v.staffName.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
      )
      .map((v) => ({
        ...v,
        note: sharedNote,
        sharedNote: sharedNote,
      }));

    if (matchingVias.length > 0) {
      await batchSaveCloudVias(matchingVias);
    }
  };

  const handleUpdateViaUidForAll = async (oldUid: string, newUid: string) => {
    const trimmedOld = oldUid.trim();
    const trimmedNew = newUid.split('|')[0].trim();
    if (!trimmedOld || !trimmedNew || trimmedOld === trimmedNew) return;

    const newLower = normalizeViaUidKey(trimmedNew);
    const matchingTargetVias = viaList.filter(
      (v) => normalizeViaUidKey(v.uid) === newLower || normalizeViaUidKey(v.rawFullVia) === newLower
    );
    const targetViaFullStr =
      matchingTargetVias[0]?.rawFullVia ||
      (matchingTargetVias[0]
        ? `${matchingTargetVias[0].uid}|${matchingTargetVias[0].pass || ''}|${matchingTargetVias[0].twoFa || ''}`
        : newUid.includes('|')
        ? newUid.trim()
        : undefined);

    const matching = records
      .filter(
        (r) =>
          normalizeViaUidKey(r.viaUid) === normalizeViaUidKey(trimmedOld) &&
          (currentUser.role === 'admin' ||
            r.staffName.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
      )
      .map((r) => ({
        ...r,
        viaUid: trimmedNew,
        ...(targetViaFullStr ? { fullVia: targetViaFullStr } : {}),
      }));

    if (matching.length > 0) {
      const mapUpdated = new Map(matching.map((m) => [m.id, m]));
      setRecords((prev) => prev.map((r) => mapUpdated.get(r.id) || r));
      await batchSaveCloudPageRecords(matching);

      // Đồng bộ luôn Full Via trong Quản Lý Full Via sang nhân viên đang cầm các Page này
      const ownerStaff = matching[0].staffName?.trim() || currentUser.name;
      const { primaryVia, duplicateViaIds } = buildMergedViaForStaff(
        trimmedNew,
        ownerStaff,
        matchingTargetVias,
        matching,
        { rawFullViaHint: targetViaFullStr }
      );
      setViaList((prev) => {
        const kept = prev.filter(
          (v) =>
            normalizeViaUidKey(v.uid) !== newLower && normalizeViaUidKey(v.rawFullVia) !== newLower
        );
        return [...kept, primaryVia];
      });
      await setCloudVia(primaryVia);
      if (duplicateViaIds.length > 0) {
        await batchDeleteCloudVias(duplicateViaIds);
      }
    }
  };

  const handleUpdateStaffNameForAll = async (oldName: string, newName: string) => {
    if (currentUser.role !== 'admin') return;
    const trimmedOld = oldName.trim();
    const trimmedNew = newName.trim();
    if (!trimmedOld || !trimmedNew || trimmedOld.toLowerCase() === trimmedNew.toLowerCase()) return;

    const oldLower = trimmedOld.toLowerCase();
    const matching = records
      .filter((r) => r.staffName.trim().toLowerCase() === oldLower)
      .map((r) => ({ ...r, staffName: trimmedNew }));

    const heldUidLowers = new Set(
      matching.map((r) => normalizeViaUidKey(r.viaUid)).filter(Boolean)
    );

    if (matching.length > 0) {
      setRecords((prev) =>
        prev.map((r) => (r.staffName.trim().toLowerCase() === oldLower ? { ...r, staffName: trimmedNew } : r))
      );
      await batchSaveCloudPageRecords(matching);
    }

    // Đồng bộ luôn toàn bộ Full Via của nhân viên cũ hoặc các UID đang cầm Page sang nhân viên mới
    const matchingVias = viaList
      .filter(
        (v) =>
          v.staffName.trim().toLowerCase() === oldLower ||
          heldUidLowers.has(normalizeViaUidKey(v.uid)) ||
          heldUidLowers.has(normalizeViaUidKey(v.rawFullVia))
      )
      .map((v) => ({ ...v, staffName: trimmedNew }));

    if (matchingVias.length > 0) {
      const viaMap = new Map(matchingVias.map((v) => [v.id, v]));
      setViaList((prev) => prev.map((v) => viaMap.get(v.id) || v));
      await batchSaveCloudVias(matchingVias);
    }

    // Đồng bộ bên Bảng Group
    const matchingGroups = groupRecords
      .filter(
        (g) =>
          (g.staffName || '').trim().toLowerCase() === oldLower ||
          heldUidLowers.has(normalizeViaUidKey(g.uid))
      )
      .map((g) => ({ ...g, staffName: trimmedNew, updatedAt: new Date().toISOString() }));

    if (matchingGroups.length > 0) {
      const grpMap = new Map(matchingGroups.map((g) => [g.id, g]));
      setGroupRecords((prev) => {
        const next = prev.map((g) => grpMap.get(g.id) || g);
        saveLocalGroupBackup(next);
        return next;
      });
      await batchSaveCloudGroupRecords(matchingGroups);
    }

    const updatedStaff = customStaffList.map((name) =>
      name.trim().toLowerCase() === oldLower ? trimmedNew : name
    );
    await saveCloudSettings({ customStaffList: updatedStaff });
  };

  const handleUpdateFullViaForAll = async (
    viaUid: string,
    newFullVia: string,
    targetStaffHint?: string
  ) => {
    const trimmedUid = (viaUid || '').split('|')[0].trim();
    if (!trimmedUid) return;
    const lowerUid = normalizeViaUidKey(trimmedUid);

    const matchingVia = viaList.find(
      (v) =>
        (normalizeViaUidKey(v.uid) === lowerUid || normalizeViaUidKey(v.rawFullVia) === lowerUid) &&
        (currentUser.role === 'admin' ||
          v.staffName.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
    );

    const parsedOld = parseFullVia(matchingVia?.rawFullVia);
    const parsedNew = parseSupplementalViaInput(newFullVia, trimmedUid);

    const nextPass = parsedNew.pass || matchingVia?.pass || parsedOld?.pass || '';
    const nextTwoFa = parsedNew.twoFa || matchingVia?.twoFa || parsedOld?.twoFa || '';
    const nextEmail = parsedNew.email || matchingVia?.email || parsedOld?.email || '';
    const nextEmailPass = parsedNew.emailPass || matchingVia?.emailPass || parsedOld?.emailPass || '';
    const nextExtra =
      (parsedNew.extra && parsedNew.extra.length > 0 ? parsedNew.extra.join('|') : '') ||
      matchingVia?.extraInfo ||
      (parsedOld?.extra && parsedOld.extra.length > 0 ? parsedOld.extra.join('|') : '') ||
      '';

    const resolvedRawFullVia = newFullVia.trim()
      ? buildFullViaString({
          uid: trimmedUid,
          pass: nextPass,
          twoFa: nextTwoFa,
          email: nextEmail,
          emailPass: nextEmailPass,
          extra: nextExtra,
        })
      : '';

    const matching = records
      .filter(
        (r) =>
          normalizeViaUidKey(r.viaUid) === lowerUid &&
          (currentUser.role === 'admin' ||
            r.staffName.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
      )
      .map((r) => ({ ...r, fullVia: resolvedRawFullVia || undefined }));

    if (matching.length > 0) {
      const updatedMap = new Map(matching.map((m) => [m.id, m]));
      setRecords((prev) => prev.map((r) => updatedMap.get(r.id) || r));
      await batchSaveCloudPageRecords(matching);
    }

    if (matchingVia) {
      const updatedVia: FullViaItem = {
        ...matchingVia,
        pass: nextPass,
        twoFa: nextTwoFa,
        ...(nextEmail ? { email: nextEmail } : {}),
        ...(nextEmailPass ? { emailPass: nextEmailPass } : {}),
        ...(nextExtra ? { extraInfo: nextExtra } : {}),
        rawFullVia: resolvedRawFullVia || `${trimmedUid}||`,
      };
      setViaList((prev) => prev.map((v) => (v.id === matchingVia.id ? updatedVia : v)));
      await setCloudVia(updatedVia);
    } else if (resolvedRawFullVia) {
      const inferredStaff =
        targetStaffHint ||
        matching[0]?.staffName ||
        groupRecords.find((g) => normalizeViaUidKey(g.uid) === lowerUid)?.staffName ||
        currentUser.name ||
        'Chưa gán';
      const newViaItem: FullViaItem = {
        id: `via-sync-${trimmedUid}`,
        uid: trimmedUid,
        pass: nextPass,
        twoFa: nextTwoFa,
        ...(nextEmail ? { email: nextEmail } : {}),
        ...(nextEmailPass ? { emailPass: nextEmailPass } : {}),
        ...(nextExtra ? { extraInfo: nextExtra } : {}),
        staffName: inferredStaff,
        status: 'active',
        rawFullVia: resolvedRawFullVia,
        pageUpdateStatus: matching.length > 0 ? 'updated' : 'none',
        hasAdminAssignedPage: matching.length > 0,
        createdAt: new Date().toLocaleDateString('vi-VN'),
      };
      setViaList((prev) => [
        ...prev.filter((v) => normalizeViaUidKey(v.uid) !== lowerUid),
        newViaItem,
      ]);
      await setCloudVia(newViaItem);
    }
  };

  // Full Via CRUD in Cloud Firestore
  const handleAddVia = async (newVia: FullViaItem) => {
    const addedUidLower = normalizeViaUidKey(newVia.uid) || normalizeViaUidKey(newVia.rawFullVia);
    if (addedUidLower && deletedViaUidsRef.current.has(addedUidLower)) {
      deletedViaUidsRef.current.delete(addedUidLower);
      const nextDeleted = Array.from(deletedViaUidsRef.current);
      setDeletedViaUids(nextDeleted);
      saveLocalDeletedViaUids(nextDeleted);
      saveCloudSettings({ deletedViaUids: nextDeleted }).catch(() => {});
    }

    setViaList((prev) => [...prev.filter((v) => v.id !== newVia.id), newVia]);
    await setCloudVia(newVia);

    const fullStr = newVia.rawFullVia || `${newVia.uid}|${newVia.pass}|${newVia.twoFa}`;
    const matching = records
      .filter((r) => r.viaUid.trim() === newVia.uid.trim())
      .map((r) => ({ ...r, fullVia: fullStr, viaTransferStatus: 'completed' as const }));

    if (matching.length > 0) {
      await batchSaveCloudPageRecords(matching);
    }
  };

  const handleUpdateVia = async (updatedVia: FullViaItem) => {
    const cleanUidLower = normalizeViaUidKey(updatedVia.uid) || normalizeViaUidKey(updatedVia.rawFullVia);
    const prevVia = viaList.find((v) => v.id === updatedVia.id);
    const staffChangedToNewEmployee = Boolean(
      prevVia &&
        prevVia.staffName.trim().toLowerCase() !== updatedVia.staffName.trim().toLowerCase() &&
        !isAdminWaitingPool(updatedVia.staffName)
    );
    const staffMovedToPool = Boolean(
      prevVia &&
        prevVia.staffName.trim().toLowerCase() !== updatedVia.staffName.trim().toLowerCase() &&
        isAdminWaitingPool(updatedVia.staffName)
    );
    const dateStr = `${new Date().getDate()}/${new Date().getMonth() + 1}`;

    const finalVia: FullViaItem = staffChangedToNewEmployee
      ? {
          ...updatedVia,
          pageUpdateStatus: 'pending',
          hasAdminAssignedPage: true,
          isNewlyTransferred: true,
          pageAssignedAt: dateStr,
        }
      : staffMovedToPool
      ? {
          ...updatedVia,
          isNewlyTransferred: false,
        }
      : updatedVia.pageUpdateStatus === 'updated' || updatedVia.pageUpdateStatus === 'none'
      ? {
          ...updatedVia,
          isNewlyTransferred: false,
        }
      : updatedVia;

    const isViaVhh =
      finalVia.adminReportStatus === 'VHH' ||
      finalVia.status === 'dead' ||
      (finalVia.note || '').toLowerCase().includes('vhh');
    const isViaRestored =
      finalVia.status === 'fixed' ||
      finalVia.adminReportStatus === 'Live' ||
      (finalVia.status === 'active' &&
        !finalVia.isError &&
        finalVia.adminReportStatus !== 'VHH' &&
        finalVia.adminReportStatus !== '282' &&
        finalVia.adminReportStatus !== '956');

    const effectiveReportNote =
      finalVia.adminReportStatus && finalVia.adminReportStatus !== 'None'
        ? finalVia.adminReportStatus
        : isViaVhh
        ? 'VHH'
        : '';

    const fullStr =
      finalVia.rawFullVia || `${finalVia.uid}|${finalVia.pass}|${finalVia.twoFa}`;
    const isPendingRed = Boolean(
      finalVia.isNewlyTransferred || finalVia.pageUpdateStatus === 'pending'
    );

    const matching = records
      .filter((r) => normalizeViaUidKey(r.viaUid) === cleanUidLower)
      .map((r) => ({
        ...r,
        fullVia: fullStr,
        staffName: finalVia.staffName || r.staffName,
        isNewlyTransferred: staffChangedToNewEmployee
          ? true
          : !isPendingRed
          ? false
          : r.isNewlyTransferred,
        newlyTransferredAt: staffChangedToNewEmployee ? dateStr : r.newlyTransferredAt,
        ...(staffChangedToNewEmployee
          ? {
              viaTransferStatus: 'completed' as const,
              viaTransferColor: 'red' as const,
              viaTransferNote: `🔴 Mới giao Via + Page cho ${finalVia.staffName} (${dateStr})`,
              viaTransferUpdatedAt: dateStr,
            }
          : !isPendingRed && r.viaTransferColor === 'red' && r.isNewlyTransferred
          ? {
              viaTransferColor: 'green' as const,
            }
          : {}),
        isViaFixed: Boolean(finalVia.isFixed || finalVia.status === 'fixed'),
        isViaError: Boolean(
          finalVia.isError ||
          finalVia.adminReportStatus === 'VHH' ||
          finalVia.adminReportStatus === '282' ||
          finalVia.adminReportStatus === '956' ||
          finalVia.status === 'error' ||
          finalVia.status === 'checkpoint' ||
          finalVia.status === 'dead'
        ),
        viaStatus:
          finalVia.status ||
          (finalVia.isFixed
            ? 'fixed'
            : finalVia.adminReportStatus === 'VHH'
            ? 'dead'
            : finalVia.adminReportStatus === '282' ||
              finalVia.adminReportStatus === '956' ||
              finalVia.isError
            ? 'checkpoint'
            : 'active'),
        viaErrorNote: isViaRestored && finalVia.status === 'fixed' ? '' : effectiveReportNote,
        viaSharedNote: finalVia.sharedNote || finalVia.note || r.viaSharedNote,
      }));

    // Cập nhật state React đồng bộ ngay lập tức cho cả Via và Page (trước khi await)
    setViaList((prev) => prev.map((v) => (v.id === finalVia.id ? finalVia : v)));
    if (matching.length > 0) {
      const updatedMap = new Map(matching.map((m) => [m.id, m]));
      setRecords((prev) => prev.map((r) => updatedMap.get(r.id) || r));
    }

    await setCloudVia(finalVia);
    if (matching.length > 0) {
      await batchSaveCloudPageRecords(matching);
    }

    // Đồng bộ ngược sang Bảng Group nếu Via được báo hoặc đổi nhân viên ở Quản Trị Via
    if (cleanUidLower) {
      const matchingGroups = groupRecords.filter(
        (g) => normalizeViaUidKey(g.uid) === cleanUidLower
      );
      if (matchingGroups.length > 0) {
        const toUpdateGroups = matchingGroups
          .map((g) => {
            const nextStaff = updatedVia.staffName || g.staffName;
            let nextNote = g.note || '';
            if (effectiveReportNote && ['VHH', '282', '956', 'Hạn Chế', 'Live'].includes(effectiveReportNote)) {
              nextNote = effectiveReportNote;
            } else if (isViaRestored || updatedVia.adminReportStatus === 'None') {
              nextNote = '';
            }
            if (nextStaff === g.staffName && nextNote === (g.note || '')) return null;
            return {
              ...g,
              staffName: nextStaff,
              note: nextNote,
              updatedAt: new Date().toISOString(),
            };
          })
          .filter(Boolean) as GroupRecord[];

        if (toUpdateGroups.length > 0) {
          const updatedMap = new Map(toUpdateGroups.map((g) => [g.id, g]));
          setGroupRecords((prev) => {
            const next = prev.map((g) => updatedMap.get(g.id) || g);
            saveLocalGroupBackup(next);
            return next;
          });
          await batchSaveCloudGroupRecords(toUpdateGroups);
        }
      }
    }
  };

  const executeDeleteViasInternal = async (
    viaIds: string[],
    options?: {
      clearPageViaUid?: boolean;
      deleteHeldPages?: boolean;
      deleteLinkedPages?: boolean;
      deleteLinkedGroups?: boolean;
    }
  ) => {
    if (!viaIds || viaIds.length === 0) return;
    const idSet = new Set(viaIds);

    // 1. Tìm tất cả các đối tượng Via khớp ID và các bản ghi trùng cùng UID (bao gồm cả via-sync-...)
    const targetVias = viaList.filter((v) => idSet.has(v.id));
    const targetUidLowers = new Set<string>();
    const rawCleanUids = new Set<string>();

    targetVias.forEach((v) => {
      const uLower = normalizeViaUidKey(v.uid) || normalizeViaUidKey(v.rawFullVia);
      if (uLower) targetUidLowers.add(uLower);
      const cleanRaw = (v.uid || '').split('|')[0].trim();
      if (cleanRaw) rawCleanUids.add(cleanRaw);
    });

    // Hỗ trợ trường hợp truyền vào ID có dạng via-sync-<uid>
    viaIds.forEach((rawId) => {
      if (rawId.startsWith('via-sync-')) {
        const extractedUid = rawId.replace(/^via-sync-/, '').trim();
        const uLower = normalizeViaUidKey(extractedUid);
        if (uLower) targetUidLowers.add(uLower);
        if (extractedUid) rawCleanUids.add(extractedUid);
      }
    });

    const allMatchingViasInList = viaList.filter((v) => {
      if (idSet.has(v.id)) return true;
      const uLower = normalizeViaUidKey(v.uid) || normalizeViaUidKey(v.rawFullVia);
      return Boolean(uLower && targetUidLowers.has(uLower));
    });

    const isSafeDocId = (id: string) =>
      Boolean(id && id.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(id));

    const allDocIdsToDelete = Array.from(
      new Set([
        ...viaIds,
        ...allMatchingViasInList.map((v) => v.id),
        ...Array.from(rawCleanUids).map((u) => `via-sync-${u}`),
        ...Array.from(targetUidLowers).map((u) => `via-sync-${u}`),
      ])
    ).filter(isSafeDocId);

    // 2. Đưa ngay các UID bị xóa vào danh sách chặn tự động tạo lại (deletedViaUidsRef + localStorage + Cloud Settings)
    if (targetUidLowers.size > 0) {
      const nextDeletedList = Array.from(
        new Set([...Array.from(deletedViaUidsRef.current), ...Array.from(targetUidLowers)])
      );
      deletedViaUidsRef.current = new Set(nextDeletedList);
      setDeletedViaUids(nextDeletedList);
      saveLocalDeletedViaUids(nextDeletedList);
      saveCloudSettings({ deletedViaUids: nextDeletedList }).catch((err) =>
        console.warn('[App] Save deletedViaUids warning:', err)
      );
    }

    // 3. Xóa ngay khỏi state viaList
    const deleteDocIdSet = new Set(allDocIdsToDelete);
    setViaList((prev) =>
      prev.filter((v) => {
        if (deleteDocIdSet.has(v.id) || idSet.has(v.id)) return false;
        const uLower = normalizeViaUidKey(v.uid) || normalizeViaUidKey(v.rawFullVia);
        if (uLower && targetUidLowers.has(uLower)) return false;
        return true;
      })
    );

    // 4. Xử lý các Fanpage đang liên kết với UID vừa xóa (Bảng 1)
    if (targetUidLowers.size > 0) {
      const matchingPages = records.filter((r) => {
        const rUid = normalizeViaUidKey(r.viaUid) || normalizeViaUidKey(r.fullVia);
        return Boolean(rUid && targetUidLowers.has(rUid));
      });
      if (matchingPages.length > 0) {
        if (options?.deleteHeldPages || options?.deleteLinkedPages) {
          const pageIdsToRemove = matchingPages.map((p) => p.id);
          const removePageSet = new Set(pageIdsToRemove);
          setRecords((prev) => prev.filter((r) => !removePageSet.has(r.id)));
          await batchDeleteCloudPageRecords(pageIdsToRemove);
        } else if (options?.clearPageViaUid) {
          const clearedPages: PageRecord[] = matchingPages.map((r) => ({
            ...r,
            viaUid: '',
            fullVia: '',
            viaErrorNote: '',
            isViaError: false,
            viaTransferStatus: 'via_deleted',
          }));
          const updatedMap = new Map(clearedPages.map((p) => [p.id, p]));
          setRecords((prev) => prev.map((r) => updatedMap.get(r.id) || r));
          await batchSaveCloudPageRecords(clearedPages);
        } else {
          // Mặc định: giữ nguyên các Fanpage bên Bảng Page nhưng đánh dấu viaTransferStatus = 'via_deleted'
          // để ngăn chặn useEffect tự động hồi sinh lại Via chết trong Bảng Full Via
          const markedPages: PageRecord[] = matchingPages.map((r) => ({
            ...r,
            viaTransferStatus: 'via_deleted',
          }));
          const updatedMap = new Map(markedPages.map((p) => [p.id, p]));
          setRecords((prev) => prev.map((r) => updatedMap.get(r.id) || r));
          batchSaveCloudPageRecords(markedPages).catch(() => {});
        }
      }
    }

    // 4b. Xử lý xóa các dòng Group liên kết với UID vừa xóa (Bảng 2) nếu Admin chọn xóa luôn Group
    if (targetUidLowers.size > 0 && options?.deleteLinkedGroups) {
      const matchingGroups = groupRecords.filter((g) => {
        const gUid = normalizeViaUidKey(g.uid);
        return Boolean(gUid && targetUidLowers.has(gUid));
      });
      if (matchingGroups.length > 0) {
        const groupIdsToRemove = matchingGroups.map((g) => g.id);
        const removeGroupSet = new Set(groupIdsToRemove);
        setGroupRecords((prev) => {
          const next = prev.filter((g) => !removeGroupSet.has(g.id));
          saveLocalGroupBackup(next);
          return next;
        });
        try {
          await batchDeleteCloudGroupRecords(groupIdsToRemove);
        } catch (err) {
          for (const gId of groupIdsToRemove) {
            try {
              await deleteCloudGroupRecord(gId);
            } catch {}
          }
        }
      }
    }

    // 5. Xóa vĩnh viễn trên Cloud Firestore
    if (allDocIdsToDelete.length > 0) {
      try {
        await batchDeleteCloudVias(allDocIdsToDelete);
      } catch (err) {
        for (const docId of allDocIdsToDelete) {
          try {
            await deleteCloudVia(docId);
          } catch {}
        }
      }
    }
  };

  const handleDeleteVia = async (
    viaId: string,
    options?: {
      clearPageViaUid?: boolean;
      deleteHeldPages?: boolean;
      deleteLinkedPages?: boolean;
      deleteLinkedGroups?: boolean;
    }
  ) => {
    await executeDeleteViasInternal([viaId], options);
  };

  const handleDeleteBatchVias = async (
    viaIds: string[],
    options?: {
      clearPageViaUid?: boolean;
      deleteHeldPages?: boolean;
      deleteLinkedPages?: boolean;
      deleteLinkedGroups?: boolean;
    }
  ) => {
    await executeDeleteViasInternal(viaIds, options);
  };

  // Shared Accounts handlers (Add, Update, Delete)
  const handleAddSharedAccount = async (account: SharedAccount) => {
    setSharedAccounts((prev) => [...prev.filter((a) => a.id !== account.id), account]);
    await setCloudSharedAccount(account);
  };

  const handleUpdateSharedAccount = async (id: string, updates: Partial<SharedAccount>) => {
    setSharedAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
    await updateCloudSharedAccount(id, updates);
  };

  const handleDeleteSharedAccount = async (id: string) => {
    setSharedAccounts((prev) => prev.filter((a) => a.id !== id));
    await deleteCloudSharedAccount(id);
  };

  // Image Task handlers (Bảng 9: Làm Ảnh & Ghép Ảnh)
  const handleAddImageTask = async (task: ImageTaskItem) => {
    setImageTasks((prev) => {
      const next = [task, ...prev.filter((t) => t.id !== task.id)];
      saveLocalImageTasksBackup(next);
      return next;
    });
    await setCloudImageTask(task);
  };

  const handleUpdateImageTask = async (id: string, updates: Partial<ImageTaskItem>) => {
    setImageTasks((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, ...updates } : t));
      saveLocalImageTasksBackup(next);
      return next;
    });
    await updateCloudImageTask(id, updates);
  };

  const handleDeleteImageTask = async (id: string) => {
    setImageTasks((prev) => {
      const next = prev.filter((t) => t.id !== id);
      saveLocalImageTasksBackup(next);
      return next;
    });
    await deleteCloudImageTask(id);
  };

  // Đồng bộ trạng thái VHH / 282 / 956 / Hạn Chế / Live từ Bảng Page & Bảng Group sang Bảng Quản Trị Via (Full Via)
  const syncGroupNoteToVia = async (
    uid: string,
    noteValue: string,
    staffName?: string,
    viaName?: string,
    sourceLabel: string = 'Group',
    rawFullViaHint?: string
  ) => {
    const cleanUid = (uid || '').trim();
    if (!cleanUid) return;
    const cleanUidLower = cleanUid.toLowerCase();
    const noteStr = (noteValue || '').trim();
    const noteLower = noteStr.toLowerCase();

    const isVhh =
      noteLower === 'vhh' || noteLower.includes('vhh') || noteLower.includes('vô hiệu');
    const is282 = noteLower.includes('282');
    const isCodeMail = noteLower.includes('code mail') || noteLower.includes('email code');
    const isSdt = noteLower.includes('sdt') || noteLower.includes('sđt');
    const is956 = noteLower.includes('956');
    const isCheckpoint = is282 || is956 || isCodeMail || isSdt;
    const isHanChe = noteLower.includes('hạn chế') || noteLower.includes('han che');
    const isLive = noteLower === 'live' || noteLower.includes('hoạt động tốt');

    const reportStatus: FullViaItem['adminReportStatus'] = isVhh
      ? 'VHH'
      : is282
      ? '282'
      : isCodeMail
      ? 'Email code'
      : isSdt
      ? 'SDT'
      : is956
      ? '956'
      : isHanChe
      ? 'Hạn Chế'
      : isLive
      ? 'Live'
      : 'None';

    const matchedVia = viaList.find(
      (v) => (v.uid || '').trim().toLowerCase() === cleanUidLower
    );

    if (matchedVia) {
      let updatedVia: FullViaItem | null = null;
      if (isVhh) {
        const existingNote = (matchedVia.note || '').trim();
        const nextNote = existingNote
          ? existingNote.toLowerCase().includes('vhh')
            ? existingNote
            : `VHH - ${existingNote}`
          : viaName
          ? `VHH (${viaName})`
          : `VHH (Từ bảng ${sourceLabel})`;
        updatedVia = {
          ...matchedVia,
          adminReportStatus: 'VHH',
          status: 'dead',
          isError: true,
          isFixed: false,
          note: nextNote,
          sharedNote: nextNote,
        };
      } else if (isCheckpoint) {
        const cpCode = is282
          ? '282'
          : isCodeMail
          ? '956 Code mail'
          : isSdt
          ? '956 SDT'
          : '956';
        updatedVia = {
          ...matchedVia,
          adminReportStatus: reportStatus,
          status: 'checkpoint',
          isError: true,
          isFixed: false,
          note: viaName ? `${cpCode} (${viaName})` : `${cpCode} (Từ bảng ${sourceLabel})`,
          sharedNote: viaName ? `${cpCode} (${viaName})` : `${cpCode} (Từ bảng ${sourceLabel})`,
        };
      } else if (isHanChe) {
        updatedVia = {
          ...matchedVia,
          adminReportStatus: 'Hạn Chế',
          note: 'Hạn Chế',
          sharedNote: 'Hạn Chế',
        };
      } else if (isLive) {
        updatedVia = {
          ...matchedVia,
          adminReportStatus: 'Live',
          status: 'active',
          isError: false,
        };
      } else if (!noteStr) {
        const cleanedNote = (matchedVia.note || '')
          .replace(/^(VHH|282|956 Code mail|956 SDT|956|Hạn Chế)\s*-?\s*/i, '')
          .replace(/(VHH|282|956 Code mail|956 SDT|956|Hạn Chế)\s*\([^)]*\)/gi, '')
          .trim();
        updatedVia = {
          ...matchedVia,
          adminReportStatus: 'None',
          status:
            matchedVia.status === 'dead' ||
            matchedVia.status === 'error' ||
            matchedVia.status === 'checkpoint'
              ? 'active'
              : matchedVia.status,
          isError: false,
          note: cleanedNote,
          sharedNote: cleanedNote,
        };
      }

      if (updatedVia) {
        setViaList((prev) => prev.map((v) => (v.id === updatedVia!.id ? updatedVia! : v)));
        await setCloudVia(updatedVia);

        // Đồng bộ trạng thái lỗi sang các Fanpage đang cầm Via này
        const matchingPages = records
          .filter((r) => r.viaUid.trim().toLowerCase() === cleanUidLower)
          .map((r) => ({
            ...r,
            viaErrorNote: noteStr,
            isViaError: Boolean(
              updatedVia!.isError ||
                updatedVia!.adminReportStatus === 'VHH' ||
                updatedVia!.adminReportStatus === '282' ||
                updatedVia!.adminReportStatus === '956'
            ),
            isViaFixed: Boolean(updatedVia!.isFixed),
            viaStatus: updatedVia!.status || 'active',
            viaSharedNote: updatedVia!.sharedNote || updatedVia!.note || r.viaSharedNote,
          }));
        if (matchingPages.length > 0) {
          await batchSaveCloudPageRecords(matchingPages);
        }
      }
    } else if (
      (isVhh || isCheckpoint || isHanChe || isLive) &&
      !deletedViaUidsRef.current.has(cleanUidLower)
    ) {
      // Nếu UID ở bảng Page hoặc Group chưa có trong Quản Trị Full Via (và chưa bị Admin xóa) thì tự động thêm vào để Admin nắm
      const parts = (rawFullViaHint || '').split('|');
      const newVia: FullViaItem = {
        id: `via-sync-${cleanUid}`,
        uid: cleanUid,
        pass: parts[1]?.trim() || '',
        twoFa: parts[2]?.trim() || '',
        staffName: staffName || currentUser.name || 'Chưa gán',
        adminReportStatus: reportStatus,
        status: isVhh ? 'dead' : isCheckpoint ? 'checkpoint' : 'active',
        isError: isVhh || isCheckpoint,
        isFixed: false,
        note: viaName ? `${noteStr} (${viaName} - ${sourceLabel})` : `${noteStr} (Từ bảng ${sourceLabel})`,
        sharedNote: viaName ? `${noteStr} (${viaName} - ${sourceLabel})` : `${noteStr} (Từ bảng ${sourceLabel})`,
        createdAt: new Date().toLocaleDateString('vi-VN'),
        rawFullVia: rawFullViaHint || `${cleanUid}||`,
        pageUpdateStatus: sourceLabel === 'Page' ? 'updated' : 'none',
      };
      setViaList((prev) => [
        ...prev.filter((v) => (v.uid || '').trim().toLowerCase() !== cleanUidLower),
        newVia,
      ]);
      await setCloudVia(newVia);
    }
  };

  // Handler khi nhân viên báo cáo Ghi Chú Via (VHH, 282, 956, Hạn Chế, Live) trực tiếp từ Bảng Quản Lý Page
  const handleUpdateViaReportNoteFromPage = async (
    viaUid: string,
    reportNote: string,
    targetRecord: PageRecord
  ) => {
    const cleanUid = (viaUid || targetRecord.viaUid || '').trim();
    const cleanUidLower = cleanUid.toLowerCase();
    const noteStr = (reportNote || '').trim();
    const noteLower = noteStr.toLowerCase();

    const isVhh =
      noteLower === 'vhh' || noteLower.includes('vhh') || noteLower.includes('vô hiệu');
    const isCheckpoint = noteLower.includes('282') || noteLower.includes('956');
    const isErr = isVhh || isCheckpoint;

    // 1. Cập nhật tất cả các dòng Fanpage cùng UID (hoặc dòng hiện tại nếu chưa có UID)
    const matchingPages = cleanUid
      ? records.filter((r) => r.viaUid.trim().toLowerCase() === cleanUidLower)
      : records.filter((r) => r.id === targetRecord.id);

    if (matchingPages.length > 0) {
      const updatedPages = matchingPages.map((r) => ({
        ...r,
        viaErrorNote: noteStr,
        isViaError: isErr,
        isViaFixed: isErr ? false : r.isViaFixed,
        viaStatus: isVhh ? ('dead' as const) : isCheckpoint ? ('checkpoint' as const) : ('active' as const),
      }));
      await batchSaveCloudPageRecords(updatedPages);
    }

    if (!cleanUid) return;

    // 2. Đồng bộ sang Bảng Group nếu cùng UID có mặt bên Group
    const matchingGroups = groupRecords.filter(
      (g) => (g.uid || '').trim().toLowerCase() === cleanUidLower
    );
    if (matchingGroups.length > 0) {
      const updatedGroups = matchingGroups.map((g) => ({
        ...g,
        note: noteStr,
        updatedAt: new Date().toISOString(),
      }));
      const updatedMap = new Map(updatedGroups.map((g) => [g.id, g]));
      setGroupRecords((prev) => {
        const next = prev.map((g) => updatedMap.get(g.id) || g);
        saveLocalGroupBackup(next);
        return next;
      });
      await batchSaveCloudGroupRecords(updatedGroups);
    }

    // 3. Đồng bộ ngay lập tức sang Quản Trị Full Via để Admin nắm
    await syncGroupNoteToVia(
      cleanUid,
      noteStr,
      targetRecord.staffName,
      targetRecord.pageName,
      'Page',
      targetRecord.fullVia
    );
  };

  // Tự động đồng bộ các dòng Page & Group đã chọn VHH / 282 / 956 / Hạn Chế từ trước sang Quản Trị Via (Full Via)
  useEffect(() => {
    if (!currentUser.isAuthenticated || (groupRecords.length === 0 && records.length === 0)) return;

    const reportedByUid = new Map<
      string,
      {
        uid: string;
        staffName: string;
        label: string;
        source: string;
        reportStatus: FullViaItem['adminReportStatus'];
        rawFullVia?: string;
      }
    >();

    const parseNoteToStatus = (raw: string): FullViaItem['adminReportStatus'] | null => {
      const lower = (raw || '').trim().toLowerCase();
      if (!lower) return null;
      if (lower === 'vhh' || lower.includes('vhh') || lower.includes('vô hiệu')) return 'VHH';
      if (lower.includes('282')) return '282';
      if (lower.includes('code mail') || lower.includes('email code')) return 'Email code';
      if (lower.includes('sdt') || lower.includes('sđt')) return 'SDT';
      if (lower.includes('956')) return '956';
      if (lower.includes('hạn chế') || lower.includes('han che')) return 'Hạn Chế';
      return null;
    };

    groupRecords.forEach((g) => {
      const uid = (g.uid || '').trim();
      const uidLower = normalizeViaUidKey(uid);
      if (!uidLower || deletedViaUidsRef.current.has(uidLower)) return;
      const status = parseNoteToStatus(g.note || '');
      if (uid && status) {
        reportedByUid.set(uidLower, {
          uid,
          staffName: g.staffName || currentUser.name || 'Chưa gán',
          label: g.viaName || 'Group',
          source: 'Group',
          reportStatus: status,
        });
      }
    });

    records.forEach((r) => {
      const uid = (r.viaUid || '').trim();
      const uidLower = normalizeViaUidKey(uid);
      if (!uidLower || deletedViaUidsRef.current.has(uidLower) || r.viaTransferStatus === 'via_deleted') {
        return;
      }
      const status = parseNoteToStatus(r.viaErrorNote || r.viaSharedNote || '');
      if (uid && status) {
        reportedByUid.set(uidLower, {
          uid,
          staffName: r.staffName || currentUser.name || 'Chưa gán',
          label: r.pageName || 'Page',
          source: 'Page',
          reportStatus: status,
          rawFullVia: r.fullVia,
        });
      }
    });

    // Ngoài các dòng báo lỗi (VHH, 282, 956, Hạn Chế), tự động đồng bộ các Nick Via đang cầm Page bên Bảng Quản Lý Page vào Quản Trị Full Via nếu chưa có mặt (và chưa bị Admin xóa)
    const pageHoldingViasByUid = new Map<
      string,
      { uid: string; staffName: string; pageCount: number; rawFullVia?: string; sharedNote?: string }
    >();
    records.forEach((r) => {
      const uid = (r.viaUid || '').trim();
      const lower = normalizeViaUidKey(uid);
      if (!lower || deletedViaUidsRef.current.has(lower) || r.viaTransferStatus === 'via_deleted') {
        return;
      }
      if (!pageHoldingViasByUid.has(lower)) {
        pageHoldingViasByUid.set(lower, {
          uid,
          staffName: r.staffName || currentUser.name || 'Chưa gán',
          pageCount: 0,
          rawFullVia: r.fullVia,
          sharedNote: r.viaSharedNote,
        });
      }
      const entry = pageHoldingViasByUid.get(lower)!;
      entry.pageCount += 1;
      if (!entry.rawFullVia && r.fullVia) entry.rawFullVia = r.fullVia;
    });

    if (reportedByUid.size === 0 && pageHoldingViasByUid.size === 0) return;

    const viasToUpsert: FullViaItem[] = [];
    const existingViaMap = new Map<string, FullViaItem>();
    viaList.forEach((v) => {
      if (v.uid) existingViaMap.set(v.uid.trim().toLowerCase(), v);
    });

    reportedByUid.forEach((info, uidLower) => {
      if (deletedViaUidsRef.current.has(uidLower)) return;
      const existing = existingViaMap.get(uidLower);
      const isVhh = info.reportStatus === 'VHH';
      const isCp = info.reportStatus === '282' || info.reportStatus === '956';
      if (existing) {
        if (
          existing.adminReportStatus !== info.reportStatus &&
          existing.status !== 'fixed' &&
          !existing.isFixed
        ) {
          const existingNote = (existing.note || '').trim();
          const nextNote = existingNote
            ? existingNote.toLowerCase().includes((info.reportStatus || '').toLowerCase())
              ? existingNote
              : `${info.reportStatus} - ${existingNote}`
            : `${info.reportStatus} (${info.label})`;
          viasToUpsert.push({
            ...existing,
            adminReportStatus: info.reportStatus,
            status: isVhh ? 'dead' : isCp ? 'checkpoint' : existing.status || 'active',
            isError: isVhh || isCp ? true : existing.isError,
            isFixed: false,
            note: nextNote,
            sharedNote: nextNote,
          });
        }
      } else {
        const parts = (info.rawFullVia || '').split('|');
        viasToUpsert.push({
          id: `via-sync-${info.uid}`,
          uid: info.uid,
          pass: parts[1]?.trim() || '',
          twoFa: parts[2]?.trim() || '',
          staffName: info.staffName,
          adminReportStatus: info.reportStatus,
          status: isVhh ? 'dead' : isCp ? 'checkpoint' : 'active',
          isError: isVhh || isCp,
          isFixed: false,
          note: `${info.reportStatus} (${info.label} - ${info.source})`,
          sharedNote: `${info.reportStatus} (${info.label} - ${info.source})`,
          createdAt: new Date().toLocaleDateString('vi-VN'),
          rawFullVia: info.rawFullVia || `${info.uid}||`,
          pageUpdateStatus: info.source === 'Page' ? 'updated' : 'none',
          hasAdminAssignedPage: info.source === 'Page',
        });
      }
    });

    // Tự động thêm hoặc đồng bộ nhân viên cho các Via đang cầm Page (1, 2, 3, 4... Page) vào Quản Trị Full Via
    pageHoldingViasByUid.forEach((holdInfo, uidLower) => {
      if (deletedViaUidsRef.current.has(uidLower)) return;
      if (viasToUpsert.some((v) => normalizeViaUidKey(v.uid) === uidLower)) {
        return;
      }
      const existing = existingViaMap.get(uidLower);
      if (existing) {
        const cleanHoldStaff = (holdInfo.staffName || '').trim();
        const cleanExistingStaff = (existing.staffName || '').trim();
        const needStaffSync =
          Boolean(cleanHoldStaff) &&
          cleanHoldStaff !== 'Chưa gán' &&
          cleanHoldStaff.toLowerCase() !== cleanExistingStaff.toLowerCase();

        const parts = (holdInfo.rawFullVia || '').split('|');
        const nextPass = existing.pass?.trim() || parts[1]?.trim() || '';
        const nextTwoFa = existing.twoFa?.trim() || parts[2]?.trim() || '';
        const needCredSync =
          (!existing.pass && Boolean(nextPass)) || (!existing.twoFa && Boolean(nextTwoFa));

        if (needStaffSync || needCredSync) {
          viasToUpsert.push({
            ...existing,
            staffName: needStaffSync ? cleanHoldStaff : existing.staffName,
            pass: nextPass,
            twoFa: nextTwoFa,
            rawFullVia:
              existing.rawFullVia && existing.rawFullVia.split('|').filter(Boolean).length >= 2
                ? existing.rawFullVia
                : holdInfo.rawFullVia || `${existing.uid}|${nextPass}|${nextTwoFa}`,
            pageUpdateStatus: 'updated',
            hasAdminAssignedPage: true,
          });
        }
        return;
      }
      const parts = (holdInfo.rawFullVia || '').split('|');
      viasToUpsert.push({
        id: `via-sync-${holdInfo.uid}`,
        uid: holdInfo.uid,
        pass: parts[1]?.trim() || '',
        twoFa: parts[2]?.trim() || '',
        staffName: holdInfo.staffName,
        status: 'active',
        isError: false,
        isFixed: false,
        note: holdInfo.sharedNote || '',
        sharedNote: holdInfo.sharedNote || '',
        createdAt: new Date().toLocaleDateString('vi-VN'),
        rawFullVia: holdInfo.rawFullVia || `${holdInfo.uid}||`,
        pageUpdateStatus: 'updated',
        hasAdminAssignedPage: true,
      });
    });

    if (viasToUpsert.length > 0) {
      setViaList((prev) => {
        const upsertMap = new Map(viasToUpsert.map((v) => [normalizeViaUidKey(v.uid), v]));
        const kept = prev.filter((v) => !upsertMap.has(normalizeViaUidKey(v.uid)));
        return [...kept, ...viasToUpsert];
      });
      batchSaveCloudVias(viasToUpsert).catch((err) =>
        console.warn('[App] Auto-sync Vias from Page/Group to FullVia warning:', err)
      );
    }
  }, [groupRecords, records, viaList, deletedViaUids, currentUser.isAuthenticated, currentUser.name]);

  // Group Records handlers (Add, Update, Delete, Batch)
  const handleAddGroupRecord = async (record: GroupRecord) => {
    setGroupRecords((prev) => {
      const next = [...prev.filter((g) => g.id !== record.id), record];
      saveLocalGroupBackup(next);
      return next;
    });
    await setCloudGroupRecord(record);

    if (record.uid && record.note) {
      await syncGroupNoteToVia(record.uid, record.note, record.staffName, record.viaName);
    }
  };

  const handleUpdateGroupRecord = async (id: string, updates: Partial<GroupRecord>) => {
    const targetRecord = groupRecords.find((g) => g.id === id);
    const targetUid = (updates.uid ?? targetRecord?.uid ?? '').trim();
    const targetStaff = (updates.staffName ?? targetRecord?.staffName ?? currentUser.name ?? '').trim();
    const targetViaName = (updates.viaName ?? targetRecord?.viaName ?? '').trim();

    // Nếu chuyển UID sang nhân viên khác trong Bảng Group thì chuyển luôn Full Via trong Quản Lý Full Via sang nhân viên đó
    if (updates.staffName && targetUid) {
      const targetUidLower = normalizeViaUidKey(targetUid);
      const matchingVias = viaList.filter(
        (v) =>
          normalizeViaUidKey(v.uid) === targetUidLower ||
          normalizeViaUidKey(v.rawFullVia) === targetUidLower
      );
      if (matchingVias.length > 0) {
        const updatedVias = matchingVias.map((v) => ({ ...v, staffName: targetStaff }));
        const viaMap = new Map(updatedVias.map((v) => [v.id, v]));
        setViaList((prev) => prev.map((v) => viaMap.get(v.id) || v));
        await batchSaveCloudVias(updatedVias);
      }
    }

    // Nếu cập nhật ghi chú tình trạng Via (VHH, 282, 956, Hạn Chế, Live, Trống) cho 1 UID thì đồng bộ cho cả các dòng cùng UID trong Group
    const noteValLower = (updates.note || '').trim().toLowerCase();
    const isGroupInteractionNote =
      noteValLower === 'đang lên tương tác' ||
      noteValLower === 'có tương tác';

    if ('note' in updates && targetUid && !isGroupInteractionNote) {
      const targetUidLower = targetUid.toLowerCase();
      const sameUidRecords = groupRecords.filter(
        (g) => (g.uid || '').trim().toLowerCase() === targetUidLower
      );
      if (sameUidRecords.length > 1) {
        const updatedSameUid = sameUidRecords.map((g) =>
          g.id === id
            ? { ...g, ...updates, updatedAt: new Date().toISOString() }
            : { ...g, note: updates.note || '', updatedAt: new Date().toISOString() }
        );
        const updatedMap = new Map(updatedSameUid.map((g) => [g.id, g]));
        setGroupRecords((prev) => {
          const next = prev.map((g) => updatedMap.get(g.id) || g);
          saveLocalGroupBackup(next);
          return next;
        });
        await batchSaveCloudGroupRecords(updatedSameUid);
      } else {
        setGroupRecords((prev) => {
          const next = prev.map((g) => (g.id === id ? { ...g, ...updates } : g));
          saveLocalGroupBackup(next);
          return next;
        });
        await updateCloudGroupRecord(id, updates);
      }

      await syncGroupNoteToVia(targetUid, updates.note || '', targetStaff, targetViaName);
      return;
    }

    setGroupRecords((prev) => {
      const next = prev.map((g) => (g.id === id ? { ...g, ...updates } : g));
      saveLocalGroupBackup(next);
      return next;
    });
    await updateCloudGroupRecord(id, updates);
  };

  const handleDeleteGroupRecord = async (id: string) => {
    setGroupRecords((prev) => {
      const next = prev.filter((g) => g.id !== id);
      saveLocalGroupBackup(next);
      return next;
    });
    try {
      await deleteCloudGroupRecord(id);
    } catch (err) {
      console.warn('Lỗi khi xóa trên cloud (đã xóa cục bộ):', err);
    }
  };

  const handleBatchSaveGroupRecords = async (newRecords: GroupRecord[]) => {
    setGroupRecords((prev) => {
      const incomingMap = new Map(newRecords.map((r) => [r.id, r]));
      const kept = prev.filter((r) => !incomingMap.has(r.id));
      const next = [...kept, ...newRecords];
      saveLocalGroupBackup(next);
      return next;
    });
    await batchSaveCloudGroupRecords(newRecords);

    // Đồng bộ nhân viên và trạng thái ghi chú (VHH, 282, 956, Hạn Chế) sang Quản Trị Full Via
    const staffByUidLower = new Map<string, string>();
    const seenUids = new Set<string>();
    for (const rec of newRecords) {
      const cleanUid = (rec.uid || '').trim();
      const uidLower = normalizeViaUidKey(cleanUid);
      if (uidLower && rec.staffName?.trim()) {
        staffByUidLower.set(uidLower, rec.staffName.trim());
      }
      if (cleanUid && !seenUids.has(cleanUid.toLowerCase())) {
        seenUids.add(cleanUid.toLowerCase());
        await syncGroupNoteToVia(cleanUid, rec.note || '', rec.staffName, rec.viaName);
      }
    }

    if (staffByUidLower.size > 0) {
      const viasToUpdateStaff = viaList
        .filter((v) => {
          const vLower = normalizeViaUidKey(v.uid) || normalizeViaUidKey(v.rawFullVia);
          const targetStaff = staffByUidLower.get(vLower);
          return Boolean(targetStaff && v.staffName.trim().toLowerCase() !== targetStaff.toLowerCase());
        })
        .map((v) => {
          const vLower = normalizeViaUidKey(v.uid) || normalizeViaUidKey(v.rawFullVia);
          return { ...v, staffName: staffByUidLower.get(vLower) || v.staffName };
        });

      if (viasToUpdateStaff.length > 0) {
        const updatedViaMap = new Map(viasToUpdateStaff.map((v) => [v.id, v]));
        setViaList((prev) => prev.map((v) => updatedViaMap.get(v.id) || v));
        await batchSaveCloudVias(viasToUpdateStaff);
      }
    }
  };

  const handleBatchDeleteGroupRecords = async (ids: string[]) => {
    const idSet = new Set(ids);
    setGroupRecords((prev) => {
      const next = prev.filter((g) => !idSet.has(g.id));
      saveLocalGroupBackup(next);
      return next;
    });
    try {
      await batchDeleteCloudGroupRecords(ids);
    } catch (err) {
      console.warn('Lỗi khi xóa hàng loạt trên cloud (đã xóa cục bộ):', err);
    }
  };

  const handleClearAllGroupRecords = async () => {
    setGroupRecords([]);
    saveLocalGroupBackup([]);
    try {
      await clearAllCloudGroupRecords();
    } catch (err) {
      console.warn('Lỗi khi xóa trắng trên cloud (đã xóa cục bộ):', err);
    }
  };

  // Proxy handlers (Add, Update, Delete, Batch, Edit)
  const handleAddProxy = async (proxy: ProxyItem) => {
    setProxies((prev) => [...prev.filter((p) => p.id !== proxy.id), proxy]);
    await setCloudProxy(proxy);
  };

  const handleUpdateProxy = async (id: string, updates: Partial<ProxyItem>) => {
    setProxies((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
    await updateCloudProxy(id, updates);
  };

  const handleDeleteProxy = async (id: string) => {
    setProxies((prev) => prev.filter((p) => p.id !== id));
    await deleteCloudProxy(id);
  };

  const handleAddBatchProxies = async (newProxies: ProxyItem[]) => {
    setProxies((prev) => {
      const incomingMap = new Map(newProxies.map((p) => [p.id, p]));
      const kept = prev.filter((p) => !incomingMap.has(p.id));
      return [...kept, ...newProxies];
    });
    await batchSaveCloudProxies(newProxies);
  };

  const handleDeleteBatchProxies = async (ids: string[]) => {
    const idSet = new Set(ids);
    setProxies((prev) => prev.filter((p) => !idSet.has(p.id)));
    await batchDeleteCloudProxies(ids);
  };

  const handleOpenEditProxy = (proxy: ProxyItem) => {
    setEditingProxy(proxy);
    setIsAddProxyModalOpen(true);
  };

  const handleImportBulkVia = async (
    newVias: FullViaItem[],
    overwriteExisting: boolean
  ) => {
    let secureVias = newVias;
    if (currentUser.role === 'staff') {
      secureVias = newVias.map((v) => ({
        ...v,
        staffName: currentUser.name,
      }));
    }

    // Nếu Admin chủ động nhập lại các UID đã từng xóa trước đó thì gỡ khỏi danh sách chặn
    let deletedModified = false;
    secureVias.forEach((v) => {
      const uLower = normalizeViaUidKey(v.uid) || normalizeViaUidKey(v.rawFullVia);
      if (uLower && deletedViaUidsRef.current.has(uLower)) {
        deletedViaUidsRef.current.delete(uLower);
        deletedModified = true;
      }
    });
    if (deletedModified) {
      const nextDeleted = Array.from(deletedViaUidsRef.current);
      setDeletedViaUids(nextDeleted);
      saveLocalDeletedViaUids(nextDeleted);
      saveCloudSettings({ deletedViaUids: nextDeleted }).catch(() => {});
    }

    // Merge logic
    const existingMap = new Map<string, FullViaItem>();
    viaList.forEach((item) => existingMap.set(item.uid.trim(), item));

    const finalViasToSave: FullViaItem[] = [];

    secureVias.forEach((incoming) => {
      const uidKey = incoming.uid.trim();
      if (existingMap.has(uidKey)) {
        const old = existingMap.get(uidKey)!;
        if (
          currentUser.role === 'staff' &&
          old.staffName.trim().toLowerCase() !== currentUser.name.trim().toLowerCase()
        ) {
          return;
        }

        if (overwriteExisting) {
          const parsedOld = parseFullVia(old.rawFullVia);
          const parsedInc = parseFullVia(incoming.rawFullVia);
          const mergedPass = incoming.pass?.trim() || old.pass || parsedOld?.pass || '';
          const mergedTwoFa = incoming.twoFa?.trim() || old.twoFa || parsedOld?.twoFa || '';
          const mergedEmail = incoming.email?.trim() || parsedInc?.email || old.email || parsedOld?.email || '';
          const mergedEmailPass = incoming.emailPass?.trim() || parsedInc?.emailPass || old.emailPass || parsedOld?.emailPass || '';
          const mergedExtra =
            incoming.extraInfo?.trim() ||
            (parsedInc?.extra && parsedInc.extra.length > 0 ? parsedInc.extra.join('|') : '') ||
            old.extraInfo ||
            (parsedOld?.extra && parsedOld.extra.length > 0 ? parsedOld.extra.join('|') : '') ||
            '';
          const mergedRaw = buildFullViaString({
            uid: old.uid,
            pass: mergedPass,
            twoFa: mergedTwoFa,
            email: mergedEmail,
            emailPass: mergedEmailPass,
            extra: mergedExtra,
          });
          const merged: FullViaItem = {
            ...old,
            pass: mergedPass,
            twoFa: mergedTwoFa,
            ...(mergedEmail ? { email: mergedEmail } : {}),
            ...(mergedEmailPass ? { emailPass: mergedEmailPass } : {}),
            ...(mergedExtra ? { extraInfo: mergedExtra } : {}),
            staffName: currentUser.role === 'staff' ? currentUser.name : (incoming.staffName || old.staffName),
            note: incoming.note || old.note,
            rawFullVia: mergedRaw,
            pageUpdateStatus:
              incoming.pageUpdateStatus && incoming.pageUpdateStatus !== 'none'
                ? incoming.pageUpdateStatus
                : old.pageUpdateStatus,
            hasAdminAssignedPage: incoming.hasAdminAssignedPage ?? old.hasAdminAssignedPage,
            pageAssignedAt: incoming.pageAssignedAt || old.pageAssignedAt,
          };
          existingMap.set(uidKey, merged);
          finalViasToSave.push(merged);
        }
      } else {
        existingMap.set(uidKey, incoming);
        finalViasToSave.push(incoming);
      }
    });

    if (finalViasToSave.length > 0) {
      await batchSaveCloudVias(finalViasToSave);
    }

    // Sync to page records
    const incomingMap = new Map<string, FullViaItem>();
    newVias.forEach((v) => incomingMap.set(v.uid.trim(), v));

    const recsToUpdate = records
      .filter((r) => incomingMap.has(r.viaUid.trim()))
      .map((r) => {
        const match = incomingMap.get(r.viaUid.trim())!;
        return {
          ...r,
          fullVia: match.rawFullVia || `${match.uid}|${match.pass}|${match.twoFa}`,
        };
      });

    if (recsToUpdate.length > 0) {
      await batchSaveCloudPageRecords(recsToUpdate);
    }
  };

  const handleAddPageToVia = (viaUid: string, staffName: string) => {
    setEditingRecord(null);
    setPresetViaData({ viaUid, staffName });
    setIsModalOpen(true);
  };

  const handleOpenFetchPagesModal = (viaUid?: string, staffName?: string) => {
    setFetchPagesViaUid(viaUid || '');
    setFetchPagesStaffName(staffName || '');
    setIsFetchPagesModalOpen(true);
  };

  const handleBatchAddFetchedPages = async (
    newRecords: PageRecord[],
    syncVia?: FullViaItem
  ) => {
    let secureRecords = newRecords;
    let secureVia = syncVia;

    if (currentUser.role === 'staff') {
      secureRecords = newRecords.map((r) => ({
        ...r,
        staffName: currentUser.name,
      }));
      if (secureVia) {
        secureVia = {
          ...secureVia,
          staffName: currentUser.name,
        };
      }
    }

    // 1. Optimistic state updates
    setRecords((prev) => [...prev, ...secureRecords]);

    // 2. Đồng bộ Full Via trong Quản Lý Full Via sang đúng nhân viên nhận Page
    if (secureVia) {
      const targetLower = normalizeViaUidKey(secureVia.uid);
      const matchingVias = viaList.filter(
        (v) =>
          normalizeViaUidKey(v.uid) === targetLower ||
          normalizeViaUidKey(v.rawFullVia) === targetLower
      );
      const { primaryVia, duplicateViaIds } = buildMergedViaForStaff(
        secureVia.uid,
        secureVia.staffName || secureRecords[0]?.staffName || currentUser.name,
        matchingVias.length > 0 ? matchingVias : [secureVia],
        secureRecords,
        { rawFullViaHint: secureVia.rawFullVia }
      );
      setViaList((prev) => {
        const kept = prev.filter(
          (v) =>
            normalizeViaUidKey(v.uid) !== targetLower &&
            normalizeViaUidKey(v.rawFullVia) !== targetLower
        );
        return [...kept, primaryVia];
      });
      await setCloudVia(primaryVia);
      if (duplicateViaIds.length > 0) {
        await batchDeleteCloudVias(duplicateViaIds);
      }
    }

    // 3. Persist new records to Cloud Firestore
    await batchSaveCloudPageRecords(secureRecords);
  };

  const handleImportBulkFanpage = async (
    newRecords: PageRecord[],
    syncedVias?: FullViaItem[]
  ) => {
    let secureRecords = newRecords;
    let secureVias = syncedVias;

    if (currentUser.role === 'staff') {
      secureRecords = newRecords.map((r) => ({
        ...r,
        staffName: currentUser.name,
      }));
      if (secureVias) {
        secureVias = secureVias.map((v) => ({
          ...v,
          staffName: currentUser.name,
        }));
      }
    }

    setRecords((prev) => [...prev, ...secureRecords]);
    await batchSaveCloudPageRecords(secureRecords);

    // Đồng bộ cả các Via mới VÀ cập nhật nhân viên cho các Full Via đã tồn tại trong Quản Lý Full Via
    const viasToUpsert: FullViaItem[] = [];
    const dupIdsToDelete: string[] = [];
    const processedUids = new Set<string>();

    const sourceList =
      secureVias && secureVias.length > 0
        ? secureVias
        : secureRecords
            .filter((r) => Boolean(r.viaUid?.trim()))
            .map((r) => ({
              id: `via-imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              uid: r.viaUid.trim(),
              pass: r.fullVia?.split('|')[1]?.trim() || '',
              twoFa: r.fullVia?.split('|')[2]?.trim() || '',
              staffName: r.staffName,
              status: 'active' as const,
              rawFullVia: r.fullVia || `${r.viaUid.trim()}||`,
            }));

    sourceList.forEach((vItem) => {
      const uLower = normalizeViaUidKey(vItem.uid);
      if (!uLower || processedUids.has(uLower)) return;
      processedUids.add(uLower);

      const matchingExisting = viaList.filter(
        (v) => normalizeViaUidKey(v.uid) === uLower || normalizeViaUidKey(v.rawFullVia) === uLower
      );
      const held = secureRecords.filter((r) => normalizeViaUidKey(r.viaUid) === uLower);
      const { primaryVia, duplicateViaIds } = buildMergedViaForStaff(
        vItem.uid,
        vItem.staffName,
        matchingExisting.length > 0 ? matchingExisting : [vItem],
        held,
        { rawFullViaHint: vItem.rawFullVia }
      );
      viasToUpsert.push(primaryVia);
      dupIdsToDelete.push(...duplicateViaIds);
    });

    if (viasToUpsert.length > 0) {
      setViaList((prev) => {
        const kept = prev.filter((v) => {
          const vL = normalizeViaUidKey(v.uid) || normalizeViaUidKey(v.rawFullVia);
          return !processedUids.has(vL);
        });
        return [...kept, ...viasToUpsert];
      });
      await batchSaveCloudVias(viasToUpsert);
    }
    if (dupIdsToDelete.length > 0) {
      await batchDeleteCloudVias(dupIdsToDelete);
    }
  };

  const handleSaveModalRecord = async (
    data: Omit<PageRecord, 'id'> & { id?: string }
  ) => {
    const recordStaff =
      currentUser.role === 'staff' ? currentUser.name : (data.staffName || 'Nhân Viên');
    const cleanBm = getCleanBmName(data.bmNote);
    const cleanViaUid = (data.viaUid || '').split('|')[0].trim();
    const cleanViaLower = normalizeViaUidKey(cleanViaUid);

    // Tìm Full Via trong Quản Lý Full Via để đồng bộ 2 chiều (cả nhân viên lẫn chuỗi fullVia UID|Pass|2FA)
    const matchingVias = cleanViaLower
      ? viaList.filter(
          (v) =>
            normalizeViaUidKey(v.uid) === cleanViaLower ||
            normalizeViaUidKey(v.rawFullVia) === cleanViaLower
        )
      : [];

    const siblingPages = cleanViaLower
      ? records.filter((r) => r.id !== data.id && normalizeViaUidKey(r.viaUid) === cleanViaLower)
      : [];

    const mergedViaResult = cleanViaLower
      ? buildMergedViaForStaff(
          cleanViaUid,
          recordStaff,
          matchingVias,
          [{ ...(data as PageRecord), id: data.id || 'temp', staffName: recordStaff }, ...siblingPages],
          { rawFullViaHint: data.fullVia }
        )
      : null;

    const effectiveFullVia = mergedViaResult?.resolvedFullViaStr || data.fullVia;

    if (data.id) {
      const updatedRec: PageRecord = {
        ...(records.find((r) => r.id === data.id) || {}),
        ...data,
        viaUid: cleanViaUid || data.viaUid || '',
        ...(effectiveFullVia ? { fullVia: effectiveFullVia } : {}),
        bmNote: cleanBm,
        id: data.id,
        staffName: recordStaff,
      } as PageRecord;

      // Đồng bộ nhân viên và fullVia cho các Page cùng cầm chung UID này
      const updatedSiblings = siblingPages.map((r) => ({
        ...r,
        staffName: recordStaff,
        ...(effectiveFullVia ? { fullVia: effectiveFullVia } : {}),
      }));

      const allPagesToSave = [updatedRec, ...updatedSiblings];
      const pageMap = new Map(allPagesToSave.map((p) => [p.id, p]));
      setRecords((prev) => prev.map((r) => pageMap.get(r.id) || r));
      await batchSaveCloudPageRecords(allPagesToSave);
    } else {
      const newRec: PageRecord = {
        ...data,
        viaUid: cleanViaUid || data.viaUid || '',
        ...(effectiveFullVia ? { fullVia: effectiveFullVia } : {}),
        bmNote: cleanBm,
        id: `row-${Date.now()}`,
        staffName: recordStaff,
      };

      const updatedSiblings = siblingPages.map((r) => ({
        ...r,
        staffName: recordStaff,
        ...(effectiveFullVia ? { fullVia: effectiveFullVia } : {}),
      }));

      setRecords((prev) => {
        const sibMap = new Map(updatedSiblings.map((p) => [p.id, p]));
        return [...prev.map((r) => sibMap.get(r.id) || r), newRec];
      });
      await batchSaveCloudPageRecords([newRec, ...updatedSiblings]);
    }

    // Tự động chuyển luôn Full Via trong Quản Lý Full Via sang cho nhân viên phụ trách (recordStaff)
    if (mergedViaResult && cleanViaLower) {
      const { primaryVia, duplicateViaIds } = mergedViaResult;
      const finalVia: FullViaItem = {
        ...primaryVia,
        staffName: recordStaff,
        pageUpdateStatus: 'updated',
        hasAdminAssignedPage: true,
        pageUpdatedAt: new Date().toLocaleDateString('vi-VN'),
      };
      setViaList((prev) => {
        const kept = prev.filter(
          (v) =>
            normalizeViaUidKey(v.uid) !== cleanViaLower &&
            normalizeViaUidKey(v.rawFullVia) !== cleanViaLower
        );
        return [...kept, finalVia];
      });
      await setCloudVia(finalVia);
      if (duplicateViaIds.length > 0) {
        await batchDeleteCloudVias(duplicateViaIds);
      }
    }
  };

  const handleSaveBatch = async (batchData: Omit<PageRecord, 'id'>[]) => {
    if (!batchData.length) return;
    const recordStaff =
      currentUser.role === 'staff' ? currentUser.name : (batchData[0].staffName || 'Nhân Viên');

    const newRecords: PageRecord[] = batchData.map((d, idx) => ({
      ...d,
      bmNote: getCleanBmName(d.bmNote),
      id: `row-${Date.now()}-${idx}`,
      staffName: recordStaff,
    }));

    setRecords((prev) => [...prev, ...newRecords]);
    await batchSaveCloudPageRecords(newRecords);

    // Đồng bộ toàn bộ UID trong lô Page mới tạo sang nhân viên nhận trong Quản Lý Full Via
    const batchUids = Array.from(
      new Set(newRecords.map((r) => r.viaUid?.trim()).filter(Boolean))
    );
    if (batchUids.length > 0) {
      await handleConfirmTransferPageVia({
        pageIds: newRecords.map((r) => r.id),
        targetViaUid: batchUids[0],
        targetStaffName: recordStaff,
        appendHistoryNote: false,
        historyNoteText: '',
        transferViaUidsToStaff: batchUids,
      });
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa dòng Fanpage này khỏi Cloud Firestore?')) {
      const target = records.find((r) => r.id === id);
      if (
        currentUser.role === 'staff' &&
        target &&
        target.staffName.trim().toLowerCase() !== currentUser.name.trim().toLowerCase()
      ) {
        return;
      }
      await deleteCloudPageRecord(id);
    }
  };

  const handleDuplicateRecord = async (record: PageRecord) => {
    if (
      currentUser.role === 'staff' &&
      record.staffName.trim().toLowerCase() !== currentUser.name.trim().toLowerCase()
    ) {
      return;
    }

    const duplicated: PageRecord = {
      ...record,
      id: `row-${Date.now()}`,
      pageName: `${record.pageName} (Thêm cùng Via)`,
      bmNote: getCleanBmName(record.bmNote),
      actualPosts: 0,
      isCompleted: false,
    };

    await setCloudPageRecord(duplicated);
  };

  const handleMarkAllDoneToday = async () => {
    const promptMessage =
      currentUser.role === 'staff'
        ? `Đánh dấu tất cả các Fanpage của bạn (${currentUser.name}) hôm nay đã hoàn thành đủ số bài đăng trên Cloud Firestore?`
        : 'Đánh dấu tất cả các Fanpage của toàn bộ nhân viên hôm nay đã hoàn thành đủ số bài đăng trên Cloud Firestore?';

    if (confirm(promptMessage)) {
      if (currentUser.role === 'staff') {
        const staffNameLower = currentUser.name.trim().toLowerCase();
        const updated = records
          .filter((r) => r.staffName.trim().toLowerCase() === staffNameLower)
          .map((r) => ({
            ...r,
            actualPosts: Math.max(r.targetPosts, r.actualPosts),
            isCompleted: true,
          }));
        if (updated.length > 0) {
          await batchSaveCloudPageRecords(updated);
        }
      } else {
        const updated = records.map((r) => ({
          ...r,
          actualPosts: Math.max(r.targetPosts, r.actualPosts),
          isCompleted: true,
        }));
        if (updated.length > 0) {
          await batchSaveCloudPageRecords(updated);
        }
      }
    }
  };

  const handleResetData = async () => {
    if (
      confirm(
        'Khôi phục lại toàn bộ dữ liệu mẫu vào Cloud Firestore? Dữ liệu hiện tại trên Firestore sẽ được đặt lại về mặc định ban đầu.'
      )
    ) {
      setIsLoadingFirestore(true);
      await resetCloudFirestoreToDefaults();
      setCurrentUser(DEFAULT_ADMIN_USER);
      setFilter({
        search: '',
        staffName: '',
        viaUid: '',
        multiPageOnly: false,
        status: '',
        blockStatus: '',
        likeCountStatus: '',
        postingMethod: '',
        completionFilter: 'all',
      });
      setIsLoadingFirestore(false);
    }
  };

  // Loading Screen while connecting to Cloud Firestore
  if (isLoadingFirestore) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 flex flex-col items-center max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center animate-spin">
            <RotateCw className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Đang kết nối Cloud Firestore</h3>
            <p className="text-xs text-slate-500 mt-1">
              Đang tải dữ liệu trực tiếp từ máy chủ Cloud Firestore...
            </p>
          </div>
          <div className="flex items-center space-x-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            <Cloud className="w-3.5 h-3.5" />
            <span>Không lưu dữ liệu trên local</span>
          </div>
        </div>
      </div>
    );
  }

  // Full-page Security Gatekeeper: All users entering via web/vercel must authenticate first
  if (!currentUser.isAuthenticated || currentUser.id === 'guest') {
    return (
      <LoginScreen
        accounts={accounts}
        onVerifyAdminPin={(inputPin) => {
          const clean = inputPin.trim();
          if (!clean) return false;
          const adminAccPin = accounts.find((a) => a.role === 'admin')?.pin?.trim();
          return (
            clean === adminSettings.adminPin.trim() ||
            (Boolean(adminAccPin) && clean === adminAccPin)
          );
        }}
        adminName={adminSettings.adminName}
        adminEmail={adminSettings.adminEmail}
        requireGoogleOnly={adminSettings.requireGoogleLoginOnly}
        onLoginSuccess={handleLoginSuccess}
        onRequestAccess={handleRequestAccess}
        onLinkAccountEmail={handleUpdateAccountEmail}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* HÀNG 1: HEADER HỆ THỐNG + 7 BẢNG ĐIỀU HƯỚNG + TÀI KHOẢN & BẢO MẬT (GỘP TRÊN 1 DÒNG DUY NHẤT) */}
      <SheetHeader
        records={userScopedRecords}
        allRecordsCount={records.length}
        currentUser={currentUser}
        availableUsers={availableUsers}
        pendingRequestsCount={pendingRequestsCount}
        activeTab={activeTab}
        navTabs={navTabs}
        onSelectTab={setActiveTab}
        activeStaffFilter={filter.staffName}
        viaList={viaList}
        errorViaUids={errorViaUids}
        errorViaCount={errorViaCountInScope}
        isFilteringErrorVia={Boolean(filter.errorViaOnly)}
        onFilterErrorVia={() => {
          setActiveTab('fanpage');
          setFilter((prev) => ({ ...prev, errorViaOnly: !prev.errorViaOnly }));
        }}
        onNavigateToStaffTab={() => setActiveTab('staff_management')}
        onOpenAdminApprovalModal={(tab) => {
          if (tab) setAdminApprovalModalTab(tab);
          setIsAdminApprovalModalOpen(true);
        }}
        onOpenAuthModal={handleOpenAuthModal}
        onLogout={handleLogout}
        onSelectUser={handleSelectUser}
        onAddCustomStaff={handleAddCustomStaff}
        onOpenAddModal={() => {
          setEditingRecord(null);
          setPresetViaData(null);
          setIsModalOpen(true);
        }}
        onOpenImportModal={() => setIsBulkImportFanpageOpen(true)}
        onResetData={handleResetData}
        onMarkAllDoneToday={handleMarkAllDoneToday}
        onOpenAddViaModal={() => {
          setActiveTab('fullvia');
        }}
        onOpenBulkImportViaModal={() => {
          setBulkImportPresetStaff(currentUser.role === 'staff' ? currentUser.name : undefined);
          setIsBulkImportOpen(true);
        }}
        onOpenChangeMyPin={() => {
          setMyNewPinValue('');
          setMyPinSuccessNotice(null);
          setIsStaffMyPinModalOpen(true);
        }}
      />

      {/* Thanh liên kết nhanh chỉ hiện riêng khi mở Bảng 7 (Proxy) */}
      {activeTab === 'proxy' && (
        <div className="bg-slate-900 text-white px-4 py-1.5 border-b border-slate-800">
          <div className="max-w-[1700px] mx-auto flex items-center justify-between text-xs">
            <span className="font-bold text-cyan-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              <span>Hệ Thống Proxy — Quản lý & tạo cấu hình Proxy</span>
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => window.open('/proxy-app/index.html', '_blank')}
                className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-md text-[11px] font-bold border border-slate-700 cursor-pointer"
              >
                <Globe className="w-3 h-3" />
                <span>Mở Tab Riêng</span>
              </button>
              <button
                type="button"
                onClick={() => window.open('https://nghean37378237-proxy-37-ce87.vercel.app/', '_blank')}
                className="inline-flex items-center space-x-1 px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md text-[11px] font-bold cursor-pointer"
              >
                <span>Link Vercel App</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Body */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto px-2.5 sm:px-5 py-2 space-y-2">
        {activeTab === 'fanpage' ? (
          <>
            <SheetFilterBar
              filter={filter}
              onChangeFilter={setFilter}
              records={userScopedRecords}
              groupRecords={groupRecords}
              accounts={accounts}
              currentUser={currentUser}
              errorViaUids={errorViaUids}
              errorViaCount={errorViaCountInScope}
              fixedViaUids={fixedViaUids}
              fixedViaCount={fixedViaCountInScope}
              availableStaffNames={allStaffNames}
              onOpenAddModal={() => {
                setEditingRecord(null);
                setPresetViaData(null);
                setIsModalOpen(true);
              }}
              onOpenImportModal={() => setIsBulkImportFanpageOpen(true)}
              onMarkAllDoneToday={handleMarkAllDoneToday}
              onOpenDeleteStaffModal={handleOpenDeleteStaffModal}
              onOpenTransferModal={() => handleOpenTransferModal()}
              onOpenFetchPagesModal={() => handleOpenFetchPagesModal()}
            />

            {(() => {
              const selectedStaff =
                filter.staffName &&
                filter.staffName.trim() &&
                filter.staffName.trim().toLowerCase() !== 'all' &&
                !isAdminWaitingPool(filter.staffName)
                  ? filter.staffName.trim()
                  : '';

              const selectedStaffLower = selectedStaff.toLowerCase();
              const selectedStaffFanpageCount = selectedStaff
                ? userScopedRecords.filter(
                    (r) =>
                      (r.staffName || '').trim().toLowerCase() === selectedStaffLower ||
                      areStaffNamesEquivalent(r.staffName, selectedStaff)
                  ).length
                : userScopedRecords.length;

              const selectedStaffGroupCount = selectedStaff
                ? groupRecords.filter(
                    (g) =>
                      (g.staffName || '').trim().toLowerCase() === selectedStaffLower ||
                      areStaffNamesEquivalent(g.staffName, selectedStaff)
                  ).length
                : 0;

              const selectedStaffAcc = selectedStaff
                ? accounts.find(
                    (a) =>
                      (a.username || '').trim().toLowerCase() === selectedStaffLower ||
                      areStaffNamesEquivalent(a.username, selectedStaff) ||
                      (Boolean(a.fullName) && areStaffNamesEquivalent(a.fullName, selectedStaff))
                  )
                : undefined;

              const isSelectedStaffAssignedGroup = Boolean(
                selectedStaff &&
                  (selectedStaffAcc?.allowedTabs?.includes('group') || selectedStaffGroupCount > 0)
              );

              const showOnlyGroupForStaff =
                isSelectedStaffAssignedGroup && selectedStaffFanpageCount === 0;

              return (
                <>
                  {!showOnlyGroupForStaff && (
                    <FanpageSheetTable
                      records={filteredRecords}
                      allRecords={records}
                      groupRecords={groupRecords}
                      accounts={accounts}
                      existingVias={viaList}
                      currentUser={currentUser}
                      activeStaffFilter={filter.staffName}
                      onSelectStaffFilter={(staffName) =>
                        setFilter((prev) => ({
                          ...prev,
                          staffName: staffName === 'all' || staffName === 'ALL' ? '' : staffName,
                        }))
                      }
                      errorViaUids={errorViaUids}
                      fixedViaUids={fixedViaUids}
                      onUpdateRecord={handleUpdateRecord}
                      onDeleteRecord={handleDeleteRecord}
                      onDuplicateRecord={handleDuplicateRecord}
                      onDeleteStaffAllData={handleOpenDeleteStaffModal}
                      onTransferPageRecord={(record) => handleOpenTransferModal(record)}
                      onTransferViaPages={(viaUid) => handleOpenTransferModal(undefined, viaUid)}
                      availableStaffNames={allStaffNames}
                      onQuickTransferViaToStaff={(viaUid, targetStaffName) => {
                        const cleanUid = viaUid.split('|')[0].trim();
                        if (!cleanUid || !targetStaffName.trim()) return;
                        const lower = normalizeViaUidKey(cleanUid);
                        const heldPages = records.filter((r) => normalizeViaUidKey(r.viaUid) === lower);
                        const todayStr = `${new Date().getDate()}/${new Date().getMonth() + 1}`;
                        void handleConfirmTransferPageVia({
                          pageIds: heldPages.map((p) => p.id),
                          targetViaUid: cleanUid,
                          targetStaffName: targetStaffName.trim(),
                          appendHistoryNote: true,
                          historyNoteText: `Chuyển Via ${cleanUid}${heldPages.length > 0 ? ` + ${heldPages.length} Page` : ''} sang ${targetStaffName.trim()} (${todayStr})`,
                          transferViaUidsToStaff: [cleanUid],
                        });
                      }}
                      onFetchPagesForVia={handleOpenFetchPagesModal}
                      onEditRecord={(record) => {
                        setEditingRecord(record);
                        setPresetViaData(null);
                        setIsModalOpen(true);
                      }}
                      onToggleViaError={handleToggleViaError}
                      onToggleViaFixed={handleToggleViaFixed}
                      onUpdateViaSharedNoteForAll={handleUpdateViaSharedNoteForAll}
                      onUpdateViaReportNote={handleUpdateViaReportNoteFromPage}
                      onUpdateViaUidForAll={handleUpdateViaUidForAll}
                      onUpdateStaffNameForAll={handleUpdateStaffNameForAll}
                      onUpdateFullViaForAll={handleUpdateFullViaForAll}
                      onAddPageToVia={handleAddPageToVia}
                      onAcknowledgeNewTransfer={handleAcknowledgeNewTransfer}
                    />
                  )}

                  {isSelectedStaffAssignedGroup && (
                    <div className={showOnlyGroupForStaff ? '' : 'mt-4 pt-3 border-t-2 border-red-200'}>
                      <GroupManagementTable
                        records={groupRecords}
                        currentUser={currentUser}
                        availableStaffNames={allStaffNames}
                        activeStaffFilter={selectedStaff}
                        onSelectStaffFilter={(staffName) =>
                          setFilter((prev) => ({
                            ...prev,
                            staffName: staffName === 'ALL' || staffName === 'all' ? '' : staffName,
                          }))
                        }
                        existingVias={viaList}
                        onSupplementVia={handleUpdateFullViaForAll}
                        onAddRecord={handleAddGroupRecord}
                        onAddBatchRecords={handleBatchSaveGroupRecords}
                        onUpdateRecord={handleUpdateGroupRecord}
                        onDeleteRecord={handleDeleteGroupRecord}
                        onDeleteBatchRecords={handleBatchDeleteGroupRecords}
                        onOpenAddModal={(preset) => {
                          setEditingGroupRecord(null);
                          setPresetGroupData({
                            ...(preset || {}),
                            staffName: preset?.staffName || selectedStaff,
                          });
                          setIsGroupModalOpen(true);
                        }}
                        onEditRecord={(record) => {
                          setEditingGroupRecord(record);
                          setPresetGroupData(null);
                          setIsGroupModalOpen(true);
                        }}
                        onOpenBulkImportModal={() => setIsBulkImportGroupOpen(true)}
                        onClearAllRecords={handleClearAllGroupRecords}
                        onRefreshRecords={async () => {
                          const list = await getCloudGroupRecords();
                          setGroupRecords(list || []);
                          saveLocalGroupBackup(list || []);
                        }}
                      />
                    </div>
                  )}
                </>
              );
            })()}
          </>
        ) : activeTab === 'group' ? (
          <GroupManagementTable
            records={groupRecords}
            currentUser={currentUser}
            availableStaffNames={allStaffNames}
            activeStaffFilter={filter.staffName}
            onSelectStaffFilter={(staffName) =>
              setFilter((prev) => ({
                ...prev,
                staffName: staffName === 'ALL' || staffName === 'all' ? '' : staffName,
              }))
            }
            existingVias={viaList}
            onSupplementVia={handleUpdateFullViaForAll}
            onAddRecord={handleAddGroupRecord}
            onAddBatchRecords={handleBatchSaveGroupRecords}
            onUpdateRecord={handleUpdateGroupRecord}
            onDeleteRecord={handleDeleteGroupRecord}
            onDeleteBatchRecords={handleBatchDeleteGroupRecords}
            onOpenAddModal={(preset) => {
              setEditingGroupRecord(null);
              setPresetGroupData(preset || null);
              setIsGroupModalOpen(true);
            }}
            onEditRecord={(record) => {
              setEditingGroupRecord(record);
              setPresetGroupData(null);
              setIsGroupModalOpen(true);
            }}
            onOpenBulkImportModal={() => setIsBulkImportGroupOpen(true)}
            onClearAllRecords={handleClearAllGroupRecords}
            onRefreshRecords={async () => {
              const list = await getCloudGroupRecords();
              setGroupRecords(list || []);
              saveLocalGroupBackup(list || []);
            }}
          />
        ) : activeTab === 'proxy' ? (
          <ProxyAppView
            proxies={proxies}
            currentUser={currentUser}
            availableStaffNames={allStaffNames}
            onAddProxy={handleAddProxy}
            onAddBatchProxies={handleAddBatchProxies}
            onUpdateProxy={handleUpdateProxy}
            onDeleteProxy={handleDeleteProxy}
            onDeleteBatchProxies={handleDeleteBatchProxies}
            onOpenAddModal={() => {
              setEditingProxy(null);
              setIsAddProxyModalOpen(true);
            }}
            onOpenBulkImportModal={() => setIsBulkImportProxyModalOpen(true)}
            onEditProxy={handleOpenEditProxy}
          />
        ) : activeTab === 'fullvia' ? (
          <FullViaErrorBoundary onReset={() => {}} onGoBack={() => setActiveTab('fanpage')}>
            <FullViaTable
              viaList={viaList}
              allRecords={records}
              allGroupRecords={groupRecords}
              currentUser={currentUser}
              availableStaffNames={allStaffNames}
              activeStaffFilter={filter.staffName}
              adminPin={adminSettings.adminPin}
              currentUserPin={accounts.find((a) => a.username.trim().toLowerCase() === currentUser.name.trim().toLowerCase())?.pin}
              onBackToFanpageTab={() => setActiveTab('fanpage')}
              onAddVia={handleAddVia}
              onUpdateVia={handleUpdateVia}
              onDeleteVia={handleDeleteVia}
              onDeleteBatchVias={handleDeleteBatchVias}
              onOpenBulkImport={(presetStaff) => {
                setBulkImportPresetStaff(presetStaff || (currentUser.role === 'staff' ? currentUser.name : undefined));
                setIsBulkImportOpen(true);
              }}
              onFilterPageByVia={(viaUid) => {
                setActiveTab('fanpage');
                setFilter((prev) => ({ ...prev, viaUid }));
              }}
              onAddPageForVia={(viaUid, staffName) => {
                setActiveTab('fanpage');
                handleAddPageToVia(viaUid, staffName);
              }}
              onFetchPagesForVia={handleOpenFetchPagesModal}
              onSyncStaffFilter={(staffName) => {
                setFilter((prev) => ({ ...prev, staffName: staffName === 'all' ? '' : staffName }));
              }}
              onTransferViaPages={(viaUid) => handleOpenTransferModal(undefined, viaUid)}
              onAcknowledgeNewTransfer={handleAcknowledgeNewTransfer}
            />
          </FullViaErrorBoundary>
        ) : activeTab === 'staff_management' ? (
          <StaffManagementTable
            currentUser={currentUser}
            accounts={accounts}
            records={records}
            viaList={viaList}
            groupRecords={groupRecords}
            adminPin={adminSettings.adminPin}
            adminName={adminSettings.adminName}
            adminEmail={adminSettings.adminEmail}
            requireGoogleOnly={adminSettings.requireGoogleLoginOnly}
            onChangeAdminProfile={handleChangeAdminProfile}
            onToggleRequireGoogleOnly={handleToggleRequireGoogleOnly}
            onAddStaff={handleAddPreApprovedStaff}
            onUpdatePin={handleUpdateAccountPin}
            onBlockAccount={handleBlockAccount}
            onUnblockAccount={handleUnblockAccount}
            onDeleteAccount={handleDeleteAccount}
            onApproveAccount={handleApproveAccount}
            onRejectAccount={handleRejectAccount}
            onUpdateAccountPermissions={async (accountId, allowedTabs) => {
              await handleUpdateAccountInfo(accountId, { allowedTabs });
            }}
            onUpdateAccountInfo={handleUpdateAccountInfo}
            onUpdateEmail={handleUpdateAccountEmail}
            onOpenDeleteStaffModal={handleOpenDeleteStaffModal}
            onSwitchToStaffView={(staffName) => {
              const staffUser = availableUsers.find((u) => u.name.trim().toLowerCase() === staffName.trim().toLowerCase());
              if (staffUser) {
                handleSelectUser(staffUser);
                setActiveTab('fanpage');
              }
            }}
            onOpenAdminModal={(tab) => {
              if (tab) setAdminApprovalModalTab(tab);
              setIsAdminApprovalModalOpen(true);
            }}
          />
        ) : activeTab === 'revenue' && currentUser.role === 'admin' ? (
          <RevenueManagementTable
            finances={finances}
            currentUser={currentUser}
            availableStaffNames={allStaffNames}
            accounts={accounts}
            onSaveMonthlyFinance={async (record) => {
              await setCloudMonthlyFinance(record);
              setFinances((prev) => {
                const exists = prev.some((f) => f.id === record.id || f.monthKey === record.monthKey);
                const next = exists
                  ? prev.map((f) => (f.id === record.id || f.monthKey === record.monthKey ? record : f))
                  : [record, ...prev];
                saveLocalFinanceBackup(next);
                return next;
              });
            }}
            onDeleteMonthlyFinance={async (monthId) => {
              await deleteCloudMonthlyFinance(monthId);
              setFinances((prev) => {
                const next = prev.filter((f) => f.id !== monthId && f.monthKey !== monthId);
                saveLocalFinanceBackup(next);
                return next;
              });
            }}
            onDeleteBatchMonthlyFinances={async (monthIds) => {
              for (const mId of monthIds) {
                await deleteCloudMonthlyFinance(mId);
              }
              setFinances((prev) => {
                const idSet = new Set(monthIds);
                const next = prev.filter((f) => !idSet.has(f.id) && !idSet.has(f.monthKey));
                saveLocalFinanceBackup(next);
                return next;
              });
            }}
            onRefreshFinances={async () => {
              const list = await getCloudMonthlyFinances();
              if (list && list.length > 0) {
                setFinances(list);
                saveLocalFinanceBackup(list);
              }
            }}
            onClearAllFinances={async () => {
              await clearAllCloudMonthlyFinances();
              setFinances([]);
              clearLocalFinanceBackup();
            }}
            onNavigateToTab={(tab) => setActiveTab(tab as TabKey)}
            onUpdateAccount={async (accountId, data) => {
              await updateCloudAccount(accountId, data);
              setAccounts((prev) =>
                prev.map((a) => (a.id === accountId ? { ...a, ...data } : a))
              );
            }}
          />
        ) : activeTab === 'staff_info' ? (
          <StaffInfoTable
            currentUser={currentUser}
            finances={finances}
            accounts={accounts}
            records={records}
            availableStaffNames={allStaffNames}
            onNavigateToTab={(tab) => setActiveTab(tab as TabKey)}
            onNavigateToStaffPages={(staffCode) => {
              setFilter((prev) => ({
                ...prev,
                staffName: staffCode,
              }));
              setActiveTab('fanpage');
            }}
            onSaveMonthlyFinance={async (record) => {
              await setCloudMonthlyFinance(record);
              setFinances((prev) => {
                const exists = prev.some((f) => f.id === record.id || f.monthKey === record.monthKey);
                const next = exists
                  ? prev.map((f) => (f.id === record.id || f.monthKey === record.monthKey ? record : f))
                  : [record, ...prev];
                if (currentUser.role === 'admin') {
                  saveLocalFinanceBackup(next);
                }
                return next;
              });
            }}
            onUpdateAccount={async (accountId, data) => {
              await updateCloudAccount(accountId, data);
              setAccounts((prev) =>
                prev.map((a) => (a.id === accountId ? { ...a, ...data } : a))
              );
            }}
          />
        ) : activeTab === 'image_studio' ? (
          <ImageStudioTab
            currentUser={currentUser}
            availableStaffNames={allStaffNames}
            tasks={imageTasks}
            onAddTask={handleAddImageTask}
            onUpdateTask={handleUpdateImageTask}
            onDeleteTask={handleDeleteImageTask}
            allPageNames={Array.from(new Set(records.map((r) => r.pageName).filter(Boolean)))}
            onNavigateToTab={(tab) => setActiveTab(tab as TabKey)}
          />
        ) : activeTab === 'view_stats' ? (
          <WordPressStatsTab
            currentUser={currentUser}
            accounts={accounts}
            onUpdateAccountPermissions={async (accountId, allowedTabs) => {
              await handleUpdateAccountInfo(accountId, { allowedTabs });
            }}
            onUpdateAccountInfo={handleUpdateAccountInfo}
          />
        ) : activeTab === 'web_publish' ? (
          <WebPublishStudioTab
            currentUser={currentUser}
            accounts={accounts}
            onNavigateToTab={(tab) => setActiveTab(tab as TabKey)}
          />
        ) : (
          <SharedAccountsTable
            accounts={sharedAccounts}
            currentUser={currentUser}
            availableStaffNames={allStaffNames}
            onAddAccount={handleAddSharedAccount}
            onUpdateAccount={handleUpdateSharedAccount}
            onDeleteAccount={handleDeleteSharedAccount}
          />
        )}
      </main>

      {/* Add / Edit Fanpage Modal */}
      <AddEditPageModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingRecord(null);
          setPresetViaData(null);
        }}
        onSave={handleSaveModalRecord}
        onSaveBatch={handleSaveBatch}
        initialRecord={editingRecord}
        allRecords={records}
        existingVias={viaList}
        onSupplementVia={handleUpdateFullViaForAll}
        currentUser={currentUser}
        availableStaffNames={allStaffNames}
        presetViaData={presetViaData}
      />

      {/* Bulk Import Full Via Modal */}
      <BulkImportViaModal
        isOpen={isBulkImportOpen}
        onClose={() => {
          setIsBulkImportOpen(false);
          setBulkImportPresetStaff(undefined);
        }}
        onImport={handleImportBulkVia}
        availableStaffNames={allStaffNames}
        currentUser={currentUser}
        presetStaff={bulkImportPresetStaff}
        existingVias={viaList}
      />

      {/* Bulk Import Fanpage Modal */}
      <BulkImportFanpageModal
        isOpen={isBulkImportFanpageOpen}
        onClose={() => setIsBulkImportFanpageOpen(false)}
        onImportRecords={handleImportBulkFanpage}
        availableStaffNames={allStaffNames}
        currentUser={currentUser}
      />

      {/* Add / Edit Group Modal */}
      <AddEditGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => {
          setIsGroupModalOpen(false);
          setEditingGroupRecord(null);
          setPresetGroupData(null);
        }}
        onSave={handleAddGroupRecord}
        onSaveBatch={handleBatchSaveGroupRecords}
        initialRecord={editingGroupRecord}
        allRecords={groupRecords}
        currentUser={currentUser}
        availableStaffNames={allStaffNames}
        existingVias={viaList}
        onSupplementVia={handleUpdateFullViaForAll}
        presetGroup={presetGroupData}
        initialMode={presetGroupData?.initialMode || 'single'}
      />

      {/* Bulk Import Group Modal */}
      <BulkImportGroupModal
        isOpen={isBulkImportGroupOpen}
        onClose={() => setIsBulkImportGroupOpen(false)}
        onImport={handleBatchSaveGroupRecords}
        currentUser={currentUser}
        availableStaffNames={allStaffNames}
      />

      {/* Add / Edit Proxy Modal */}
      <AddEditProxyModal
        isOpen={isAddProxyModalOpen}
        onClose={() => {
          setIsAddProxyModalOpen(false);
          setEditingProxy(null);
        }}
        onSave={async (proxy) => {
          if (editingProxy) {
            await handleUpdateProxy(proxy.id, proxy);
          } else {
            await handleAddProxy(proxy);
          }
          setIsAddProxyModalOpen(false);
          setEditingProxy(null);
        }}
        initialProxy={editingProxy}
        currentUser={currentUser}
        availableStaffNames={allStaffNames}
      />

      {/* Bulk Import Proxy Modal */}
      <BulkImportProxyModal
        isOpen={isBulkImportProxyModalOpen}
        onClose={() => setIsBulkImportProxyModalOpen(false)}
        onImport={async (newProxies) => {
          await handleAddBatchProxies(newProxies);
          setIsBulkImportProxyModalOpen(false);
        }}
        currentUser={currentUser}
        availableStaffNames={allStaffNames}
      />

      {/* Admin Approval & User Management Modal */}
      {isAdminApprovalModalOpen && (
        <AdminApprovalModal
          isOpen={isAdminApprovalModalOpen}
          onClose={() => setIsAdminApprovalModalOpen(false)}
          initialTab={adminApprovalModalTab}
          accounts={accounts}
          adminPin={adminSettings.adminPin}
          adminEmail={adminSettings.adminEmail}
          adminName={adminSettings.adminName}
          records={records}
          viaList={viaList}
          groupRecords={groupRecords}
          proxies={proxies}
          sharedAccounts={sharedAccounts}
          finances={finances}
          imageTasks={imageTasks}
          requireGoogleOnly={adminSettings.requireGoogleLoginOnly}
          onToggleRequireGoogleOnly={handleToggleRequireGoogleOnly}
          onApproveAccount={handleApproveAccount}
          onRejectAccount={handleRejectAccount}
          onBlockAccount={handleBlockAccount}
          onUnblockAccount={handleUnblockAccount}
          onUpdateAccountPin={handleUpdateAccountPin}
          onDeleteAccount={handleDeleteAccount}
          onDeleteStaffPosts={handleDeleteStaffPosts}
          onAddPreApprovedStaff={handleAddPreApprovedStaff}
          onChangeAdminPin={handleChangeAdminPin}
          onUpdateAccountEmail={handleUpdateAccountEmail}
          onUpdateAccountInfo={handleUpdateAccountInfo}
          onRestoreBackup={handleRestoreFullBackup}
        />
      )}

      {/* Authentication & Request Access Modal */}
      {isAuthModalOpen && (
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          accounts={accounts}
          adminPin={adminSettings.adminPin}
          onLoginSuccess={handleLoginSuccess}
          onRequestAccess={handleRequestAccess}
          initialTab={authModalTab}
          allowClose={currentUser.isAuthenticated && currentUser.id !== 'guest'}
        />
      )}

      {/* Universal Modal: Chọn Xóa Toàn Bộ Dữ Liệu Của 1 Nhân Viên Bất Kỳ */}
      {isDeleteStaffModalOpen && (
        <DeleteStaffDataModal
          isOpen={isDeleteStaffModalOpen}
          onClose={() => setIsDeleteStaffModalOpen(false)}
          presetStaffName={selectedStaffToDelete}
          allStaffNames={allSystemStaffNames}
          records={records}
          viaList={viaList}
          accounts={accounts}
          onConfirmDelete={handleConfirmDeleteStaffAllData}
        />
      )}

      {/* Universal Modal: Chuyển Page Qua Via Khác Kèm Toàn Bộ Thông Tin */}
      {isTransferModalOpen && (
        <TransferPageViaModal
          isOpen={isTransferModalOpen}
          onClose={() => {
            setIsTransferModalOpen(false);
            setSelectedRecordToTransfer(null);
            setPresetTransferViaUid(null);
          }}
          presetRecord={selectedRecordToTransfer}
          presetViaUid={presetTransferViaUid}
          records={records}
          viaList={viaList}
          allStaffNames={allStaffNames}
          currentUser={currentUser}
          onConfirmTransfer={handleConfirmTransferPageVia}
        />
      )}

      {/* Universal Modal: Lấy Tên & Link Page từ Nick Via Điền Vào Bảng */}
      {isFetchPagesModalOpen && (
        <FetchPagesFromViaModal
          isOpen={isFetchPagesModalOpen}
          onClose={() => setIsFetchPagesModalOpen(false)}
          currentUser={currentUser}
          allVias={userScopedVias}
          availableStaffNames={allStaffNames}
          presetViaUid={fetchPagesViaUid}
          presetStaffName={fetchPagesStaffName}
          onAddRecords={handleBatchAddFetchedPages}
        />
      )}

      {/* Modal Đổi Mã PIN Cá Nhân Dành Cho Nhân Viên */}
      {isStaffMyPinModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Đổi Mã PIN Cá Nhân</h3>
                  <p className="text-xs text-slate-500">Tài khoản: {currentUser.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsStaffMyPinModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {myPinSuccessNotice && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{myPinSuccessNotice}</span>
              </div>
            )}

            <form onSubmit={handleSaveMyOwnPin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mã PIN Mới
                </label>
                <input
                  type="text"
                  placeholder="Nhập mã PIN mới (ví dụ: 123456)"
                  value={myNewPinValue}
                  onChange={(e) => setMyNewPinValue(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsStaffMyPinModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingMyPin}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isSavingMyPin && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Lưu PIN Mới</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
