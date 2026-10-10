import React, { useState, useEffect, useMemo } from 'react';
import {
  PageRecord,
  SheetFilter,
  AppUser,
  UserAccount,
  FullViaItem,
  SharedAccount,
  GroupRecord,
  ProxyItem,
  TabKey,
  ALL_TAB_KEYS,
  TAB_DEFINITIONS,
} from './types';
import {
  testFirestoreConnection,
  seedCloudFirestoreIfEmpty,
  subscribeToPageRecords,
  subscribeToVias,
  subscribeToAccounts,
  subscribeToSettings,
  subscribeToSharedAccounts,
  subscribeToGroupRecords,
  subscribeToProxies,
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
} from './services/firebase';
import {
  loadCurrentUserSession,
  saveCurrentUserSession,
  clearCurrentUserSession,
  clearAllLegacyLocalStorage,
  migrateAndPreserveLocalStorage,
  saveLocalGroupBackup,
  getLocalGroupBackup,
  DEFAULT_STAFF_MEMBERS,
  INITIAL_ACCOUNTS,
  DEFAULT_ADMIN_USER,
  GUEST_USER,
  DEFAULT_ADMIN_SETTINGS,
  AdminSecuritySettings,
} from './services/storage';
import { INITIAL_PROXIES, INITIAL_GROUP_RECORDS } from './data/initialData';
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
import { FileSpreadsheet, KeyRound, RotateCw, Cloud, Globe, Users, Upload, Plus, Network, UserCheck, X, CheckCircle2, RefreshCw } from 'lucide-react';

export default function App() {
  // Application data stored purely in Cloud Firestore
  const [records, setRecords] = useState<PageRecord[]>([]);
  const [viaList, setViaList] = useState<FullViaItem[]>([]);
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [sharedAccounts, setSharedAccounts] = useState<SharedAccount[]>([]);
  const [groupRecords, setGroupRecords] = useState<GroupRecord[]>([]);
  const [proxies, setProxies] = useState<ProxyItem[]>(INITIAL_PROXIES);
  const [customStaffList, setCustomStaffList] = useState<string[]>([]);
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
    // Bảng 5 (Quản trị nhân viên) chỉ có Admin quản lý - loại trừ khỏi danh sách bảng của nhân viên
    return tabs.filter((t) => t !== 'staff_management');
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
        const connected = await testFirestoreConnection();
        setIsFirestoreConnected(connected);

        // 1. Listen to live accounts (needed by login screen)
        unsubAccounts = subscribeToAccounts((cloudAccounts) => {
          setAccounts(cloudAccounts);
        });

        // 2. Listen to live settings (branding & Google login policy)
        unsubSettings = subscribeToSettings((cloudSettings) => {
          if (cloudSettings) {
            setAdminSettings({
              adminPin: cloudSettings.adminPin || DEFAULT_ADMIN_SETTINGS.adminPin,
              adminName: cloudSettings.adminName || DEFAULT_ADMIN_SETTINGS.adminName,
              adminEmail: cloudSettings.adminEmail || DEFAULT_ADMIN_SETTINGS.adminEmail,
              requireApproval: cloudSettings.requireApproval ?? DEFAULT_ADMIN_SETTINGS.requireApproval,
              requireGoogleLoginOnly: cloudSettings.requireGoogleLoginOnly ?? DEFAULT_ADMIN_SETTINGS.requireGoogleLoginOnly,
            });
            if (Array.isArray(cloudSettings.customStaffList)) {
              setCustomStaffList(cloudSettings.customStaffList);
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
      // Zero-out sensitive data arrays from RAM if not authenticated
      setRecords([]);
      setViaList([]);
      setSharedAccounts([]);
      setGroupRecords([]);
      return;
    }

    let unsubRecords: (() => void) | undefined;
    let unsubVias: (() => void) | undefined;
    let unsubSharedAccounts: (() => void) | undefined;
    let unsubGroups: (() => void) | undefined;
    let unsubProxies: (() => void) | undefined;

    async function initAuthenticatedSubscriptions() {
      try {
        // Seed default initial data into Firestore if database is empty (only when authenticated)
        await seedCloudFirestoreIfEmpty();

        // 1. Listen to live page records in Cloud Firestore
        unsubRecords = subscribeToPageRecords((cloudRecords) => {
          setRecords(cloudRecords);
        });

        // 2. Listen to live full vias (passwords, 2FA, raw strings)
        unsubVias = subscribeToVias((cloudVias) => {
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
    };
  }, [currentUser.isAuthenticated]);

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
      });
    });
    return list;
  }, [allStaffNames, accounts]);

  // 1. Phân quyền: Nếu là nhân viên, CHỈ LẤY dữ liệu của nhân viên đó!
  const userScopedRecords = useMemo(() => {
    if (currentUser.role === 'admin') {
      return records;
    }
    const currentStaffLower = currentUser.name.trim().toLowerCase();
    return records.filter(
      (r) => r.staffName.trim().toLowerCase() === currentStaffLower
    );
  }, [records, currentUser]);

  const userScopedVias = useMemo(() => {
    if (currentUser.role === 'admin') {
      return viaList;
    }
    const currentStaffLower = currentUser.name.trim().toLowerCase();
    return viaList.filter(
      (v) => v.staffName && v.staffName.trim().toLowerCase() === currentStaffLower
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

  // Filtered records based on active filters
  const filteredRecords = useMemo(() => {
    return userScopedRecords.filter((r) => {
      if (filter.search) {
        const query = filter.search.toLowerCase();
        const matchPage = r.pageName.toLowerCase().includes(query);
        const matchVia = r.viaUid.toLowerCase().includes(query);
        const matchFull = (r.fullVia || '').toLowerCase().includes(query);
        const matchStaff = r.staffName.toLowerCase().includes(query);
        const matchNote = (r.bmNote || '').toLowerCase().includes(query);
        if (!matchPage && !matchVia && !matchFull && !matchStaff && !matchNote) {
          return false;
        }
      }

      if (currentUser.role === 'admin' && filter.staffName) {
        if (r.staffName.toLowerCase() !== filter.staffName.toLowerCase()) {
          return false;
        }
      }

      if (filter.viaUid && r.viaUid !== filter.viaUid) {
        return false;
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
        const isDone = r.isCompleted || (r.targetPosts > 0 && r.actualPosts >= r.targetPosts);
        if (filter.completionFilter === 'completed' && !isDone) return false;
        if (filter.completionFilter === 'in_progress' && isDone) return false;
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
    const existing = accounts.find(
      (a) => a.username.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (existing) {
      if (existing.status === 'pending') {
        return {
          success: false,
          message: `Tài khoản "${trimmed}" đã gửi yêu cầu trước đó và đang chờ Admin duyệt.`,
        };
      }
      if (existing.status === 'approved') {
        return {
          success: false,
          message: `Tài khoản "${trimmed}" đã được duyệt trước đó. Vui lòng chuyển sang tab Đăng Nhập!`,
        };
      }
      if (existing.status === 'blocked') {
        return {
          success: false,
          message: `Tài khoản "${trimmed}" đang bị tạm khóa. Vui lòng liên hệ Admin để mở lại!`,
        };
      }
    }

    const cleanEmail = email?.trim() || undefined;
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
      message: `Đã gửi yêu cầu cấp quyền cho nhân viên "${trimmed}" lên Cloud Firestore thành công! Vui lòng chờ Admin duyệt vào hệ thống.`,
    };
  };

  const handleApproveAccount = async (accountId: string) => {
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) return;

    const approvedAt = new Date().toLocaleDateString('vi-VN');
    const updatedAcc: UserAccount = {
      ...acc,
      status: 'approved',
      approvedAt,
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
    });
    await saveCloudSettings({ customStaffList: nextStaff });
  };

  const handleRejectAccount = async (accountId: string) => {
    const acc = accounts.find((a) => a.id === accountId);

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

  // Transfer Page to another Via handlers
  const handleOpenTransferModal = (record?: PageRecord, viaUid?: string) => {
    setSelectedRecordToTransfer(record || null);
    setPresetTransferViaUid(viaUid || null);
    setIsTransferModalOpen(true);
  };

  const handleConfirmTransferPageVia = async (params: TransferPageViaParams) => {
    const {
      pageIds,
      targetViaUid,
      targetStaffName,
      targetFullVia,
      appendHistoryNote,
      historyNoteText,
    } = params;

    if (pageIds.length === 0 || !targetViaUid) return;

    const targetCleanVia = targetViaUid.trim();
    const targetCleanStaff = targetStaffName.trim() || currentUser.name;

    // Check if target Via exists in viaList. If not, automatically create it!
    const targetViaExists = viaList.some(
      (v) => v.uid.trim().toLowerCase() === targetCleanVia.toLowerCase()
    );
    if (!targetViaExists) {
      const newViaItem: FullViaItem = {
        id: `via-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        uid: targetCleanVia,
        staffName: targetCleanStaff,
        status: 'active',
        pass: targetFullVia ? targetFullVia.split('|')[1]?.trim() : undefined,
        twoFa: targetFullVia ? targetFullVia.split('|')[2]?.trim() : undefined,
        rawFullVia: targetFullVia,
        note: `Tự động tạo khi chuyển Fanpage ngày ${new Date().toLocaleDateString('vi-VN')}`,
      };
      setViaList((prev) => [...prev, newViaItem]);
      await setCloudVia(newViaItem);
    }

    // Update records in local state optimistically
    const updatedRecords: PageRecord[] = [];
    setRecords((prev) =>
      prev.map((r) => {
        if (!pageIds.includes(r.id)) return r;

        let newBmNote = r.bmNote || '';
        if (appendHistoryNote && historyNoteText) {
          newBmNote = newBmNote
            ? `${newBmNote} | [${historyNoteText}]`
            : `[${historyNoteText}]`;
        }

        const updated: PageRecord = {
          ...r,
          viaUid: targetCleanVia,
          staffName: targetCleanStaff,
          bmNote: newBmNote,
          ...(targetFullVia ? { fullVia: targetFullVia } : {}),
        };
        updatedRecords.push(updated);
        return updated;
      })
    );

    // Batch save to Cloud Firestore
    if (updatedRecords.length > 0) {
      await batchSaveCloudPageRecords(updatedRecords);
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
    const cleanEmail = newEmail?.trim() || adminSettings.adminEmail || 'myphuong2295@gmail.com';

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

    const sanitizedUpdates =
      currentUser.role === 'staff' ? { ...updates, staffName: existing.staffName } : updates;

    await updateCloudPageRecord(id, sanitizedUpdates);
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
    const trimmedNew = newUid.trim();
    if (!trimmedOld || !trimmedNew || trimmedOld === trimmedNew) return;

    const matching = records
      .filter(
        (r) =>
          r.viaUid.trim() === trimmedOld &&
          (currentUser.role === 'admin' ||
            r.staffName.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
      )
      .map((r) => ({ ...r, viaUid: trimmedNew }));

    if (matching.length > 0) {
      await batchSaveCloudPageRecords(matching);
    }
  };

  const handleUpdateStaffNameForAll = async (oldName: string, newName: string) => {
    if (currentUser.role !== 'admin') return;
    const trimmedOld = oldName.trim();
    const trimmedNew = newName.trim();
    if (!trimmedOld || !trimmedNew || trimmedOld.toLowerCase() === trimmedNew.toLowerCase()) return;

    const matching = records
      .filter((r) => r.staffName.trim().toLowerCase() === trimmedOld.toLowerCase())
      .map((r) => ({ ...r, staffName: trimmedNew }));

    if (matching.length > 0) {
      await batchSaveCloudPageRecords(matching);
    }

    const updatedStaff = customStaffList.map((name) =>
      name.trim().toLowerCase() === trimmedOld.toLowerCase() ? trimmedNew : name
    );
    await saveCloudSettings({ customStaffList: updatedStaff });
  };

  const handleUpdateFullViaForAll = async (viaUid: string, newFullVia: string) => {
    const trimmedUid = viaUid.trim();
    if (!trimmedUid) return;

    const matching = records
      .filter(
        (r) =>
          r.viaUid.trim() === trimmedUid &&
          (currentUser.role === 'admin' ||
            r.staffName.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
      )
      .map((r) => ({ ...r, fullVia: newFullVia.trim() || undefined }));

    if (matching.length > 0) {
      await batchSaveCloudPageRecords(matching);
    }

    const parts = newFullVia.trim().split('|');
    const matchingVia = viaList.find(
      (v) =>
        v.uid.trim() === trimmedUid &&
        (currentUser.role === 'admin' ||
          v.staffName.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
    );

    if (matchingVia) {
      await updateCloudVia(matchingVia.id, {
        pass: parts[1]?.trim() || matchingVia.pass,
        twoFa: parts[2]?.trim() || matchingVia.twoFa,
        rawFullVia: newFullVia.trim(),
      });
    }
  };

  // Full Via CRUD in Cloud Firestore
  const handleAddVia = async (newVia: FullViaItem) => {
    await setCloudVia(newVia);

    const fullStr = newVia.rawFullVia || `${newVia.uid}|${newVia.pass}|${newVia.twoFa}`;
    const matching = records
      .filter((r) => r.viaUid.trim() === newVia.uid.trim())
      .map((r) => ({ ...r, fullVia: fullStr }));

    if (matching.length > 0) {
      await batchSaveCloudPageRecords(matching);
    }
  };

  const handleUpdateVia = async (updatedVia: FullViaItem) => {
    await setCloudVia(updatedVia);

    const fullStr =
      updatedVia.rawFullVia || `${updatedVia.uid}|${updatedVia.pass}|${updatedVia.twoFa}`;
    const matching = records
      .filter((r) => r.viaUid.trim().toLowerCase() === updatedVia.uid.trim().toLowerCase())
      .map((r) => ({
        ...r,
        fullVia: fullStr,
        staffName: updatedVia.staffName || r.staffName,
        isViaFixed: Boolean(updatedVia.isFixed || updatedVia.status === 'fixed'),
        isViaError: Boolean(
          updatedVia.isError ||
          updatedVia.status === 'error' ||
          updatedVia.status === 'checkpoint' ||
          updatedVia.status === 'dead'
        ),
        viaStatus: updatedVia.status || (updatedVia.isFixed ? 'fixed' : updatedVia.isError ? 'checkpoint' : 'active'),
        viaSharedNote: updatedVia.sharedNote || updatedVia.note || r.viaSharedNote,
      }));

    if (matching.length > 0) {
      await batchSaveCloudPageRecords(matching);
    }
  };

  const handleDeleteVia = async (viaId: string) => {
    await deleteCloudVia(viaId);
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

  // Group Records handlers (Add, Update, Delete, Batch)
  const handleAddGroupRecord = async (record: GroupRecord) => {
    setGroupRecords((prev) => {
      const next = [...prev.filter((g) => g.id !== record.id), record];
      saveLocalGroupBackup(next);
      return next;
    });
    await setCloudGroupRecord(record);
  };

  const handleUpdateGroupRecord = async (id: string, updates: Partial<GroupRecord>) => {
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
          const merged: FullViaItem = {
            ...old,
            pass: incoming.pass,
            twoFa: incoming.twoFa,
            staffName: currentUser.role === 'staff' ? currentUser.name : (incoming.staffName || old.staffName),
            note: incoming.note || old.note,
            rawFullVia: incoming.rawFullVia,
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

    // 2. If a new Via was created or needs sync
    if (secureVia) {
      setViaList((prev) => {
        const existing = prev.some(
          (v) => v.uid.trim().toLowerCase() === secureVia!.uid.trim().toLowerCase()
        );
        if (existing) return prev;
        return [...prev, secureVia!];
      });
      await setCloudVia(secureVia);
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

    await batchSaveCloudPageRecords(secureRecords);

    if (secureVias && secureVias.length > 0) {
      const existingUids = new Set(viaList.map((v) => v.uid.trim()));
      const toAdd = secureVias.filter((v) => !existingUids.has(v.uid.trim()));
      if (toAdd.length > 0) {
        await batchSaveCloudVias(toAdd);
      }
    }
  };

  const handleSaveModalRecord = async (
    data: Omit<PageRecord, 'id'> & { id?: string }
  ) => {
    const recordStaff =
      currentUser.role === 'staff' ? currentUser.name : (data.staffName || 'Nhân Viên');

    if (data.id) {
      const updatedRec: PageRecord = {
        ...(records.find((r) => r.id === data.id) || {}),
        ...data,
        id: data.id,
        staffName: recordStaff,
      } as PageRecord;

      await setCloudPageRecord(updatedRec);

      if (data.viaUid && data.fullVia) {
        const syncList = records
          .filter((r) => r.id !== data.id && r.viaUid.trim() === data.viaUid!.trim())
          .map((r) => ({ ...r, fullVia: data.fullVia!.trim() }));
        if (syncList.length > 0) {
          await batchSaveCloudPageRecords(syncList);
        }
      }

      // Tự động chuyển trạng thái via từ 'pending' (Đỏ) sang 'updated' (Xanh) khi nhân viên cập nhật Fanpage
      if (data.viaUid) {
        const cleanViaUid = data.viaUid.trim().toLowerCase();
        const matchedVia = viaList.find((v) => v.uid.trim().toLowerCase() === cleanViaUid);
        if (matchedVia && (matchedVia.pageUpdateStatus === 'pending' || matchedVia.hasAdminAssignedPage)) {
          const updatedVia: FullViaItem = {
            ...matchedVia,
            pageUpdateStatus: 'updated',
            pageUpdatedAt: new Date().toLocaleDateString('vi-VN'),
          };
          setViaList((prev) => prev.map((v) => (v.id === matchedVia.id ? updatedVia : v)));
          await updateCloudVia(matchedVia.id, {
            pageUpdateStatus: 'updated',
            pageUpdatedAt: new Date().toLocaleDateString('vi-VN'),
          });
        }
      }
    } else {
      const newRec: PageRecord = {
        ...data,
        id: `row-${Date.now()}`,
        staffName: recordStaff,
      };

      await setCloudPageRecord(newRec);

      if (data.viaUid && data.fullVia) {
        const syncList = records
          .filter((r) => r.viaUid.trim() === data.viaUid!.trim())
          .map((r) => ({ ...r, fullVia: data.fullVia!.trim() }));
        if (syncList.length > 0) {
          await batchSaveCloudPageRecords(syncList);
        }
      }

      // Tự động chuyển trạng thái via từ 'pending' (Đỏ) sang 'updated' (Xanh) khi nhân viên tạo mới Fanpage
      if (data.viaUid) {
        const cleanViaUid = data.viaUid.trim().toLowerCase();
        const matchedVia = viaList.find((v) => v.uid.trim().toLowerCase() === cleanViaUid);
        if (matchedVia && (matchedVia.pageUpdateStatus === 'pending' || matchedVia.hasAdminAssignedPage)) {
          const updatedVia: FullViaItem = {
            ...matchedVia,
            pageUpdateStatus: 'updated',
            pageUpdatedAt: new Date().toLocaleDateString('vi-VN'),
          };
          setViaList((prev) => prev.map((v) => (v.id === matchedVia.id ? updatedVia : v)));
          await updateCloudVia(matchedVia.id, {
            pageUpdateStatus: 'updated',
            pageUpdatedAt: new Date().toLocaleDateString('vi-VN'),
          });
        }
      }
    }
  };

  const handleSaveBatch = async (batchData: Omit<PageRecord, 'id'>[]) => {
    if (!batchData.length) return;
    const recordStaff =
      currentUser.role === 'staff' ? currentUser.name : (batchData[0].staffName || 'Nhân Viên');

    const newRecords: PageRecord[] = batchData.map((d, idx) => ({
      ...d,
      id: `row-${Date.now()}-${idx}`,
      staffName: recordStaff,
    }));

    await batchSaveCloudPageRecords(newRecords);
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
        onVerifyAdminPin={(inputPin) => inputPin.trim() === adminSettings.adminPin.trim()}
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
      {/* Cloud Firestore Status Notice Bar */}
      <div className="bg-emerald-800 text-emerald-50 text-[11px] font-semibold py-1 px-4 flex items-center justify-between border-b border-emerald-900/30">
        <div className="max-w-[1700px] mx-auto w-full flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Hệ thống cơ sở dữ liệu: Cloud Firestore (Đồng bộ thời gian thực cho mọi thiết bị)</span>
          </div>
          <div className="flex items-center space-x-2 text-[10px] text-emerald-200">
            <span>Dữ liệu lưu 100% trên Cloud Firestore</span>
          </div>
        </div>
      </div>

      {/* Google Sheets Header with Stats & Actions & Permission Switcher */}
      <SheetHeader
        records={userScopedRecords}
        allRecordsCount={records.length}
        currentUser={currentUser}
        availableUsers={availableUsers}
        pendingRequestsCount={pendingRequestsCount}
        activeTab={activeTab}
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

      {/* 2 TABS CHÍNH: TAB 1 (MẶC ĐỊNH) = BẢNG FANPAGE & TIẾN ĐỘ | TAB 2 = BẢNG QUẢN LÝ FULL VIA */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-[1700px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between overflow-x-auto scrollbar-thin py-2 gap-3">
            <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
              {/* TAB 1: Bảng 1 Fanpage */}
              {userAllowedTabs.includes('fanpage') && (
                <button
                  type="button"
                  id="tab-btn-fanpage-table"
                  onClick={() => setActiveTab('fanpage')}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'fanpage'
                      ? 'bg-[#2e7d32] text-white shadow-xs ring-2 ring-[#2e7d32]/25'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 border border-slate-200'
                  }`}
                  title="Bảng 1: Quản lý Fanpage & Tiến độ đăng bài"
                >
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  <span>Bảng 1: Fanpage</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      activeTab === 'fanpage'
                        ? 'bg-white/25 text-white'
                        : 'bg-white text-slate-800 border border-slate-200'
                    }`}
                  >
                    {userScopedRecords.length} Page
                  </span>
                </button>
              )}

              {/* TAB 2: Bảng 2 Group */}
              {userAllowedTabs.includes('group') && (
                <button
                  type="button"
                  id="tab-btn-group-table"
                  onClick={() => setActiveTab('group')}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'group'
                      ? 'bg-red-700 text-white shadow-xs ring-2 ring-red-500/25'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 border border-slate-200'
                  }`}
                  title="Bảng 2: Quản lý Group Facebook & Trạng thái tham gia"
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span>Bảng 2: Group</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      activeTab === 'group'
                        ? 'bg-white/25 text-white'
                        : 'bg-white text-slate-800 border border-slate-200'
                    }`}
                  >
                    {currentUser.role === 'admin'
                      ? groupRecords.length
                      : groupRecords.filter((g) => g.staffName.trim().toLowerCase() === currentUser.name.trim().toLowerCase()).length}{' '}
                    Dòng
                  </span>
                </button>
              )}

              {/* TAB 3: Bảng 3 Proxy */}
              {userAllowedTabs.includes('proxy') && (
                <button
                  type="button"
                  id="tab-btn-proxy-table"
                  onClick={() => setActiveTab('proxy')}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'proxy'
                      ? 'bg-teal-700 text-white shadow-xs ring-2 ring-teal-500/25'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 border border-slate-200'
                  }`}
                  title="Bảng 3: Quản lý Proxy mạng & IP nuôi Via"
                >
                  <Network className="w-4 h-4 shrink-0" />
                  <span>Bảng 3: Proxy</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      activeTab === 'proxy'
                        ? 'bg-white/25 text-white'
                        : 'bg-white text-slate-800 border border-slate-200'
                    }`}
                  >
                    {currentUser.role === 'admin'
                      ? proxies.length
                      : proxies.filter(
                          (p) =>
                            (p.assignedStaff || []).includes('ALL') ||
                            (p.assignedStaff || []).some(
                              (s) => s.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
                            )
                        ).length}{' '}
                    Proxy
                  </span>
                </button>
              )}

              {/* TAB 4: Bảng 4 Full Via */}
              {userAllowedTabs.includes('fullvia') && (
                <button
                  type="button"
                  id="tab-btn-fullvia-table"
                  onClick={() => setActiveTab('fullvia')}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'fullvia'
                      ? 'bg-indigo-700 text-white shadow-xs ring-2 ring-indigo-500/25'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 border border-slate-200'
                  }`}
                  title="Bảng 4: Quản lý Full Via (UID|PASS|2FA)"
                >
                  <KeyRound className="w-4 h-4 shrink-0" />
                  <span>Bảng 4: Full Via</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      activeTab === 'fullvia'
                        ? 'bg-white/25 text-white'
                        : 'bg-white text-slate-800 border border-slate-200'
                    }`}
                  >
                    {currentUser.role === 'admin'
                      ? viaList.length
                      : viaList.filter((v) => v.staffName.trim().toLowerCase() === currentUser.name.trim().toLowerCase()).length}{' '}
                    Via
                  </span>
                </button>
              )}

              {/* TAB 5: Bảng 5 Quản Trị Nhân Viên (Chỉ Admin Quản Lý) */}
              {userAllowedTabs.includes('staff_management') && (
                <button
                  type="button"
                  id="tab-btn-staff-management"
                  onClick={() => setActiveTab('staff_management')}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'staff_management'
                      ? 'bg-blue-700 text-white shadow-xs ring-2 ring-blue-500/25'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 border border-slate-200'
                  }`}
                  title="Bảng 5: Quản trị danh sách nhân sự, phân quyền bảng và bảo mật (Chỉ Admin)"
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span>Bảng 5: Quản Trị Nhân Viên</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      activeTab === 'staff_management'
                        ? 'bg-white/25 text-white'
                        : 'bg-white text-slate-800 border border-slate-200'
                    }`}
                  >
                    {accounts.filter((a) => a.role === 'staff').length} NV
                  </span>
                </button>
              )}

              {/* TAB 6: Bảng 6 Web Dùng Chung */}
              {userAllowedTabs.includes('shared_accounts') && (
                <button
                  type="button"
                  id="tab-btn-shared-accounts"
                  onClick={() => setActiveTab('shared_accounts')}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'shared_accounts'
                      ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-500/25'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 border border-slate-200'
                  }`}
                  title="Bảng 6: Tài khoản Web dùng chung (Canva, GPT, Capcut...)"
                >
                  <Globe className="w-4 h-4 shrink-0" />
                  <span>Bảng 6: Web Dùng Chung</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      activeTab === 'shared_accounts'
                        ? 'bg-white/25 text-white'
                        : 'bg-white text-slate-800 border border-slate-200'
                    }`}
                  >
                    {currentUser.role === 'admin'
                      ? sharedAccounts.length
                      : sharedAccounts.filter(
                          (a) =>
                            (a.assignedStaff || []).includes('ALL') ||
                            (a.assignedStaff || []).some(
                              (s) => s.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
                            )
                        ).length}{' '}
                    TK
                  </span>
                </button>
              )}

              {/* Huy hiệu phân quyền cho nhân viên */}
              {currentUser.role === 'staff' && (
                <div className="hidden lg:flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200/80 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Đã phân quyền {userAllowedTabs.length} bảng (Gọn gàng)</span>
                </div>
              )}
            </div>

            {/* Quick Bulk Import Trigger */}
            <div className="flex items-center space-x-2 shrink-0">
              {activeTab === 'proxy' ? (
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => window.open('/proxy-app/index.html', '_blank')}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-cyan-300 rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Mở Tab Riêng</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open('https://nghean37378237-proxy-37-ce87.vercel.app/', '_blank')}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                  >
                    <span>Link Vercel App</span>
                  </button>
                </div>
              ) : activeTab === 'group' ? (
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    id="btn-trigger-bulk-group"
                    onClick={() => setIsBulkImportGroupOpen(true)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import Excel Group</span>
                  </button>
                  <button
                    type="button"
                    id="btn-trigger-add-group"
                    onClick={() => {
                      setEditingGroupRecord(null);
                      setPresetGroupData(null);
                      setIsGroupModalOpen(true);
                    }}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Thêm Dòng Group</span>
                  </button>
                </div>
              ) : activeTab === 'fullvia' ? (
                <button
                  type="button"
                  id="btn-trigger-bulk-via"
                  onClick={() => {
                    setBulkImportPresetStaff(currentUser.role === 'staff' ? currentUser.name : undefined);
                    setIsBulkImportOpen(true);
                  }}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Import Excel / Hàng Loạt Nick Via</span>
                </button>
              ) : activeTab === 'fanpage' ? (
                <div className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 hidden sm:flex items-center space-x-1.5 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Đồng bộ Realtime Firestore</span>
                </div>
              ) : activeTab === 'staff_management' ? (
                currentUser.role === 'admin' ? (
                  <button
                    type="button"
                    id="btn-trigger-add-staff"
                    onClick={() => {
                      setAdminApprovalModalTab('staff');
                      setIsAdminApprovalModalOpen(true);
                    }}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>+ Thêm Nhân Viên Mới</span>
                  </button>
                ) : (
                  <div className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 flex items-center space-x-1.5 shadow-2xs">
                    <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Nhân Viên: {currentUser.name}</span>
                  </div>
                )
              ) : (
                <div className="text-xs font-semibold text-slate-500 hidden sm:block">
                  Đồng bộ Realtime Firestore
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto p-3 sm:p-6 space-y-4">
        {activeTab === 'fanpage' ? (
          <>
            <SheetFilterBar
              filter={filter}
              onChangeFilter={setFilter}
              records={userScopedRecords}
              currentUser={currentUser}
              errorViaUids={errorViaUids}
              errorViaCount={errorViaCountInScope}
              fixedViaUids={fixedViaUids}
              fixedViaCount={fixedViaCountInScope}
              availableStaffNames={allStaffNames}
              onOpenDeleteStaffModal={handleOpenDeleteStaffModal}
              onOpenTransferModal={() => handleOpenTransferModal()}
              onOpenFetchPagesModal={() => handleOpenFetchPagesModal()}
            />

            <FanpageSheetTable
              records={filteredRecords}
              currentUser={currentUser}
              errorViaUids={errorViaUids}
              fixedViaUids={fixedViaUids}
              onUpdateRecord={handleUpdateRecord}
              onDeleteRecord={handleDeleteRecord}
              onDuplicateRecord={handleDuplicateRecord}
              onDeleteStaffAllData={handleOpenDeleteStaffModal}
              onTransferPageRecord={(record) => handleOpenTransferModal(record)}
              onTransferViaPages={(viaUid) => handleOpenTransferModal(undefined, viaUid)}
              onFetchPagesForVia={handleOpenFetchPagesModal}
              onEditRecord={(record) => {
                setEditingRecord(record);
                setPresetViaData(null);
                setIsModalOpen(true);
              }}
              onToggleViaError={handleToggleViaError}
              onToggleViaFixed={handleToggleViaFixed}
              onUpdateViaSharedNoteForAll={handleUpdateViaSharedNoteForAll}
              onUpdateViaUidForAll={handleUpdateViaUidForAll}
              onUpdateStaffNameForAll={handleUpdateStaffNameForAll}
              onUpdateFullViaForAll={handleUpdateFullViaForAll}
              onAddPageToVia={handleAddPageToVia}
            />
          </>
        ) : activeTab === 'group' ? (
          <GroupManagementTable
            records={groupRecords}
            currentUser={currentUser}
            availableStaffNames={allStaffNames}
            existingVias={viaList}
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
          <FullViaErrorBoundary onReset={() => setActiveTab('fanpage')}>
            <FullViaTable
              viaList={viaList}
              allRecords={records}
              currentUser={currentUser}
              availableStaffNames={allStaffNames}
              activeStaffFilter={filter.staffName}
              adminPin={adminSettings.adminPin}
              currentUserPin={accounts.find((a) => a.username.trim().toLowerCase() === currentUser.name.trim().toLowerCase())?.pin}
              onBackToFanpageTab={() => setActiveTab('fanpage')}
              onAddVia={handleAddVia}
              onUpdateVia={handleUpdateVia}
              onDeleteVia={handleDeleteVia}
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
          records={records}
          viaList={viaList}
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
