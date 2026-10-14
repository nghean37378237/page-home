import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  getDocFromServer,
  Unsubscribe,
  DocumentData,
} from 'firebase/firestore';
import firebaseConfigDefault from '../../firebase-applet-config.json';
import bundledBackupJson from '../data/bundledBackup.json';
import { PageRecord, UserAccount, FullViaItem, SharedAccount, GroupRecord, ProxyItem, GroupInteractionStatus, MonthlyFinanceRecord, ImageTaskItem } from '../types';
import {
  INITIAL_PAGE_RECORDS,
  INITIAL_GROUP_RECORDS,
  INITIAL_PROXIES,
  INITIAL_MONTHLY_FINANCES,
} from '../data/initialData';
import {
  INITIAL_ACCOUNTS,
  DEFAULT_ADMIN_ACCOUNT,
  DEFAULT_STAFF_MEMBERS,
  DEFAULT_ADMIN_SETTINGS,
  AdminSecuritySettings,
  getInitialFullViaItems,
  INITIAL_IMAGE_TASKS,
} from './storage';
import { getCleanBmName } from '../utils/helpers';

export const BUNDLED_BACKUP_DATA = bundledBackupJson as any;
const CUSTOM_FIREBASE_CONFIG_STORAGE_KEY = 'mmo_custom_firebase_config_v1';

function getActiveFirebaseConfig(): typeof firebaseConfigDefault {
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(CUSTOM_FIREBASE_CONFIG_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.apiKey && parsed.projectId) {
          return {
            ...firebaseConfigDefault,
            ...parsed,
            firestoreDatabaseId: parsed.firestoreDatabaseId || '(default)',
          };
        }
      }
    } catch (e) {
      console.warn('[Firestore] Failed to read custom firebase config:', e);
    }
  }
  return firebaseConfigDefault;
}

export const firebaseConfig = getActiveFirebaseConfig();

export function hasCustomFirebaseConfig(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.localStorage.getItem(CUSTOM_FIREBASE_CONFIG_STORAGE_KEY));
}

export function clearCustomFirebaseConfig(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(CUSTOM_FIREBASE_CONFIG_STORAGE_KEY);
}

// 1. Initialize Firebase App and Firestore Database instance with ignoreUndefinedProperties: true
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// CRITICAL: Must pass firebaseConfig.firestoreDatabaseId and enable ignoreUndefinedProperties
export const db =
  !firebaseConfig.firestoreDatabaseId || firebaseConfig.firestoreDatabaseId === '(default)'
    ? initializeFirestore(app, { ignoreUndefinedProperties: true })
    : initializeFirestore(app, { ignoreUndefinedProperties: true }, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

/**
 * Loại bỏ hoàn toàn các trường undefined trước khi ghi vào Cloud Firestore
 * để đảm bảo an toàn tuyệt đối, không bao giờ bị lỗi Unsupported field value: undefined
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        clean[key] = sanitizeForFirestore(value);
      }
    }
    return clean as T;
  }
  return data;
}

// Get complete database connection metadata
export function getFirestoreDatabaseInfo() {
  return {
    provider: 'Google Cloud Firestore',
    projectId: firebaseConfig.projectId,
    databaseId: firebaseConfig.firestoreDatabaseId,
    appId: firebaseConfig.appId,
    authDomain: firebaseConfig.authDomain,
    storageBucket: firebaseConfig.storageBucket,
    region: 'asia-east1 (Taiwan / Asia Pacific)',
    status: 'Đang hoạt động (Connected)',
    syncMode: 'Real-time WebSocket & OnSnapshot',
    apiKeyMasked: `${firebaseConfig.apiKey.slice(0, 8)}...${firebaseConfig.apiKey.slice(-6)}`,
    oAuthClientId: firebaseConfig.oAuthClientId || '',
  };
}

// Test and ping connection
export async function pingFirestoreDatabase(): Promise<{ success: boolean; latencyMs: number; message: string }> {
  const start = performance.now();
  try {
    await getDocFromServer(doc(db, 'settings', 'general'));
    const latencyMs = Math.round(performance.now() - start);
    return {
      success: true,
      latencyMs,
      message: `Kết nối máy chủ Google Cloud Firestore thành công (${latencyMs}ms)`,
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('offline')) {
      return {
        success: false,
        latencyMs,
        message: 'Mất kết nối mạng hoặc Firestore đang offline',
      };
    }
    return {
      success: true,
      latencyMs,
      message: `Phản hồi máy chủ CSDL thành công (${latencyMs}ms)`,
    };
  }
}

// Test connection on boot
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[Firestore] Connection verified successfully to database:', firebaseConfig.firestoreDatabaseId);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('[Firestore] Client is offline. Please check your Firebase configuration.');
    } else {
      console.warn('[Firestore] Test connection check response:', error);
    }
    return false;
  }
}

// 2. Strict Error Handling conforming to Firebase Skill guidelines
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// 3. Collection References
export const PAGE_RECORDS_COLLECTION = 'pageRecords';
export const VIAS_COLLECTION = 'vias';
export const ACCOUNTS_COLLECTION = 'accounts';
export const SETTINGS_COLLECTION = 'settings';
export const GENERAL_SETTINGS_DOC = 'general';
export const SHARED_ACCOUNTS_COLLECTION = 'sharedAccounts';
export const GROUP_RECORDS_COLLECTION = 'groupRecords';
export const PROXIES_COLLECTION = 'proxies';
export const MONTHLY_FINANCES_COLLECTION = 'monthlyFinances';

export const INITIAL_SHARED_ACCOUNTS: SharedAccount[] = [
  {
    id: 'shared-canva-01',
    websiteName: 'Canva Pro Thiết Kế',
    websiteUrl: 'https://www.canva.com',
    username: 'teamcanva.mmo@gmail.com',
    password: 'CanvaTeam2026@Pass',
    twoFa: 'JBSWY3DPEHPK3PXP',
    assignedStaff: ['ALL'],
    note: 'Tài khoản Edu Pro dùng chung cho toàn bộ nhân sự làm thumbnail & ảnh bài viết',
    createdAt: '16/09/2026',
    updatedAt: '16/09/2026',
  },
  {
    id: 'shared-chatgpt-01',
    websiteName: 'ChatGPT Plus (OpenAI)',
    websiteUrl: 'https://chatgpt.com',
    username: 'chatgpt.agency2026@gmail.com',
    password: 'GptPlus4o@Secured',
    twoFa: '',
    assignedStaff: ['ALL'],
    note: 'Dùng viết caption, kịch bản reels và sáng tạo content',
    createdAt: '16/09/2026',
    updatedAt: '16/09/2026',
  },
  {
    id: 'shared-capcut-01',
    websiteName: 'CapCut Pro Edit Video',
    websiteUrl: 'https://www.capcut.com',
    username: 'editvideo.capcut@gmail.com',
    password: 'CapcutPro2026#Vip',
    twoFa: '',
    assignedStaff: ['Anh Quỳnh', 'Bảo'],
    note: 'Tài khoản xuất video 4K không watermark, phân công cho nhân viên dựng video',
    createdAt: '16/09/2026',
    updatedAt: '16/09/2026',
  },
];

export interface CloudSettingsData {
  id: string;
  adminPin: string;
  requireApproval: boolean;
  customStaffList: string[];
  adminName?: string;
  adminEmail?: string;
  requireGoogleLoginOnly?: boolean;
}

export const MASTER_OWNER_EMAIL = 'cualokhachsan@gmail.com';

/**
 * Kiểm tra Cầu Nối Chuyển Hướng CSDL (settings/db_bridge) ngay khi khởi động ứng dụng (trước cả màn hình đăng nhập)
 * để đảm bảo mọi thiết bị mở link app đều tự động trỏ thẳng về CSDL của cualokhachsan@gmail.com
 */
export async function checkAndApplyCloudDbBridge(): Promise<boolean> {
  if (!hasCustomFirebaseConfig() && typeof window !== 'undefined') {
    try {
      const bridgeSnap = await getDoc(doc(db, SETTINGS_COLLECTION, 'db_bridge'));
      if (bridgeSnap.exists()) {
        const bridgeData = bridgeSnap.data() as { redirectConfigJson?: string; targetProjectId?: string };
        if (bridgeData?.redirectConfigJson) {
          const parsedBridge = JSON.parse(bridgeData.redirectConfigJson);
          if (
            parsedBridge?.apiKey &&
            parsedBridge?.projectId &&
            parsedBridge.projectId !== firebaseConfigDefault.projectId
          ) {
            window.localStorage.setItem(CUSTOM_FIREBASE_CONFIG_STORAGE_KEY, bridgeData.redirectConfigJson);
            window.location.reload();
            return true;
          }
        }
      }
    } catch (bridgeErr) {
      console.warn('[Firestore] Kiểm tra db_bridge:', bridgeErr);
    }
  }
  return false;
}

// 4. Seeding Cloud Firestore with bundled backup data (backup_toan_bo_csdl_2026-10-14.json) if empty
export async function seedCloudFirestoreIfEmpty(): Promise<void> {
  try {
    const redirected = await checkAndApplyCloudDbBridge();
    if (redirected) return;

    const writeBundledCollection = async (colName: string, items: any[]) => {
      if (!Array.isArray(items) || items.length === 0) return;
      const chunkSize = 350;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach((item, idx) => {
          const docId = item?.id ? String(item.id) : `doc-${Date.now()}-${i + idx}`;
          batch.set(doc(db, colName, docId), sanitizeForFirestore({ ...item, id: docId }));
        });
        await batch.commit();
      }
    };

    // 1. Accounts
    const accountsSnapshot = await getDocs(collection(db, ACCOUNTS_COLLECTION));
    if (accountsSnapshot.empty) {
      console.log('[Firestore] Khởi tạo danh sách tài khoản từ bản sao lưu chuẩn...');
      const bundledAccounts = Array.isArray(BUNDLED_BACKUP_DATA?.accounts) && BUNDLED_BACKUP_DATA.accounts.length > 0
        ? BUNDLED_BACKUP_DATA.accounts
        : INITIAL_ACCOUNTS;
      await writeBundledCollection(ACCOUNTS_COLLECTION, bundledAccounts);
    } else {
      const existingDocs = accountsSnapshot.docs.map((d) => ({ id: d.id, ...(d.data() as UserAccount) }));
      // Xóa bỏ hoàn toàn tài khoản phụ thuộc mail cũ nếu tồn tại
      for (const acc of existingDocs) {
        const lowerEmail = (acc.email || '').trim().toLowerCase();
        const lowerUser = (acc.username || '').trim().toLowerCase();
        if (acc.role !== 'admin' && (lowerEmail === 'myphuong2295@gmail.com' || lowerUser === 'myphuong2295@gmail.com')) {
          await deleteDoc(doc(db, ACCOUNTS_COLLECTION, acc.id)).catch(() => {});
        }
      }
      const adminAcc = existingDocs.find((a) => a.role === 'admin');
      if (!adminAcc) {
        await setDoc(doc(db, ACCOUNTS_COLLECTION, DEFAULT_ADMIN_ACCOUNT.id), DEFAULT_ADMIN_ACCOUNT);
      } else if (adminAcc.email !== 'cualokhachsan@gmail.com') {
        await updateDoc(doc(db, ACCOUNTS_COLLECTION, adminAcc.id), {
          email: 'cualokhachsan@gmail.com',
        });
      }
    }

    // 2. Settings
    const settingsDocRef = doc(db, SETTINGS_COLLECTION, GENERAL_SETTINGS_DOC);
    const settingsSnap = await getDoc(settingsDocRef);
    if (!settingsSnap.exists()) {
      const bundledSettings = BUNDLED_BACKUP_DATA?.settings || {};
      const initialSettings: CloudSettingsData = {
        id: GENERAL_SETTINGS_DOC,
        adminPin: bundledSettings.adminPin || DEFAULT_ADMIN_SETTINGS.adminPin,
        requireApproval: bundledSettings.requireApproval ?? DEFAULT_ADMIN_SETTINGS.requireApproval,
        customStaffList: Array.isArray(bundledSettings.customStaffList) && bundledSettings.customStaffList.length > 0
          ? bundledSettings.customStaffList
          : DEFAULT_STAFF_MEMBERS,
        adminName: bundledSettings.adminName || DEFAULT_ADMIN_SETTINGS.adminName,
        adminEmail: 'cualokhachsan@gmail.com',
        requireGoogleLoginOnly: bundledSettings.requireGoogleLoginOnly ?? true,
      };
      await setDoc(settingsDocRef, sanitizeForFirestore(initialSettings));
    } else {
      const currentSettings = settingsSnap.data() as CloudSettingsData;
      if (currentSettings.adminEmail !== 'cualokhachsan@gmail.com') {
        await updateDoc(settingsDocRef, { adminEmail: 'cualokhachsan@gmail.com' });
      }
    }

    // 3. Full Vias
    const viasSnapshot = await getDocs(collection(db, VIAS_COLLECTION));
    if (viasSnapshot.empty) {
      const bundledVias = Array.isArray(BUNDLED_BACKUP_DATA?.vias) && BUNDLED_BACKUP_DATA.vias.length > 0
        ? BUNDLED_BACKUP_DATA.vias
        : getInitialFullViaItems();
      await writeBundledCollection(VIAS_COLLECTION, bundledVias);
    }

    // 4. Fanpage Records
    const recordsSnapshot = await getDocs(collection(db, PAGE_RECORDS_COLLECTION));
    if (recordsSnapshot.empty) {
      const bundledRecords = Array.isArray(BUNDLED_BACKUP_DATA?.pageRecords) && BUNDLED_BACKUP_DATA.pageRecords.length > 0
        ? BUNDLED_BACKUP_DATA.pageRecords
        : INITIAL_PAGE_RECORDS;
      await writeBundledCollection(PAGE_RECORDS_COLLECTION, bundledRecords);
    }

    // 5. Group Records
    const groupsSnapshot = await getDocs(collection(db, GROUP_RECORDS_COLLECTION));
    if (groupsSnapshot.empty && Array.isArray(BUNDLED_BACKUP_DATA?.groupRecords) && BUNDLED_BACKUP_DATA.groupRecords.length > 0) {
      await writeBundledCollection(GROUP_RECORDS_COLLECTION, BUNDLED_BACKUP_DATA.groupRecords);
    }

    // 6. Shared Accounts
    const sharedSnapshot = await getDocs(collection(db, SHARED_ACCOUNTS_COLLECTION));
    if (sharedSnapshot.empty) {
      const bundledShared = Array.isArray(BUNDLED_BACKUP_DATA?.sharedAccounts) && BUNDLED_BACKUP_DATA.sharedAccounts.length > 0
        ? BUNDLED_BACKUP_DATA.sharedAccounts
        : INITIAL_SHARED_ACCOUNTS;
      await writeBundledCollection(SHARED_ACCOUNTS_COLLECTION, bundledShared);
    }

    // 7. Proxies
    const proxiesSnapshot = await getDocs(collection(db, PROXIES_COLLECTION));
    if (proxiesSnapshot.empty) {
      const bundledProxies = Array.isArray(BUNDLED_BACKUP_DATA?.proxies) && BUNDLED_BACKUP_DATA.proxies.length > 0
        ? BUNDLED_BACKUP_DATA.proxies
        : INITIAL_PROXIES;
      await writeBundledCollection(PROXIES_COLLECTION, bundledProxies);
    }

    // 8. Monthly Finances
    const financesSnapshot = await getDocs(collection(db, MONTHLY_FINANCES_COLLECTION));
    if (financesSnapshot.empty && Array.isArray(BUNDLED_BACKUP_DATA?.monthlyFinances) && BUNDLED_BACKUP_DATA.monthlyFinances.length > 0) {
      await writeBundledCollection(MONTHLY_FINANCES_COLLECTION, BUNDLED_BACKUP_DATA.monthlyFinances);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seed_data');
  }
}

// 5. Cloud Firestore Data Subscriptions (Real-time listeners)
export function subscribeToPageRecords(
  onData: (records: PageRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, PAGE_RECORDS_COLLECTION),
    (snapshot) => {
      const list: PageRecord[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as PageRecord);
      });
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, PAGE_RECORDS_COLLECTION);
    }
  );
}

export function subscribeToVias(
  onData: (vias: FullViaItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, VIAS_COLLECTION),
    (snapshot) => {
      const list: FullViaItem[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as FullViaItem);
      });
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, VIAS_COLLECTION);
    }
  );
}

export function subscribeToAccounts(
  onData: (accounts: UserAccount[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, ACCOUNTS_COLLECTION),
    (snapshot) => {
      const list: UserAccount[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as UserAccount);
      });
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, ACCOUNTS_COLLECTION);
    }
  );
}

export async function getCloudAccounts(): Promise<UserAccount[]> {
  try {
    const snapshot = await getDocs(collection(db, ACCOUNTS_COLLECTION));
    const list: UserAccount[] = [];
    snapshot.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as UserAccount);
    });
    return list;
  } catch (error) {
    console.error('[Firestore] Lỗi đọc accounts trực tiếp:', error);
    return [];
  }
}

export function subscribeToSettings(
  onData: (settings: CloudSettingsData) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const ref = doc(db, SETTINGS_COLLECTION, GENERAL_SETTINGS_DOC);
  return onSnapshot(
    ref,
    (snapshot) => {
      if (snapshot.exists()) {
        onData(snapshot.data() as CloudSettingsData);
      } else {
        onData({
          id: GENERAL_SETTINGS_DOC,
          adminPin: DEFAULT_ADMIN_SETTINGS.adminPin,
          requireApproval: DEFAULT_ADMIN_SETTINGS.requireApproval,
          customStaffList: DEFAULT_STAFF_MEMBERS,
          adminName: DEFAULT_ADMIN_SETTINGS.adminName,
          adminEmail: DEFAULT_ADMIN_SETTINGS.adminEmail,
        });
      }
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, `${SETTINGS_COLLECTION}/${GENERAL_SETTINGS_DOC}`);
    }
  );
}

export function subscribeToSharedAccounts(
  onData: (accounts: SharedAccount[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, SHARED_ACCOUNTS_COLLECTION),
    (snapshot) => {
      const list: SharedAccount[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as SharedAccount);
      });
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, SHARED_ACCOUNTS_COLLECTION);
    }
  );
}

export async function getCloudSharedAccounts(): Promise<SharedAccount[]> {
  try {
    const snapshot = await getDocs(collection(db, SHARED_ACCOUNTS_COLLECTION));
    const list: SharedAccount[] = [];
    snapshot.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as SharedAccount);
    });
    return list;
  } catch (error) {
    console.error('[Firestore] Lỗi đọc shared accounts trực tiếp:', error);
    return [];
  }
}

export function subscribeToGroupRecords(
  onData: (groups: GroupRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, GROUP_RECORDS_COLLECTION),
    (snapshot) => {
      const list: GroupRecord[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as GroupRecord);
      });
      onData(list);
    },
    (error) => {
      console.warn('[Firestore] Live groupRecords listener warning:', error);
      if (onError) onError(error);
    }
  );
}

export async function getCloudGroupRecords(): Promise<GroupRecord[]> {
  try {
    const snapshot = await getDocs(collection(db, GROUP_RECORDS_COLLECTION));
    const list: GroupRecord[] = [];
    snapshot.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as GroupRecord);
    });
    return list;
  } catch (error) {
    console.error('[Firestore] Lỗi đọc group records trực tiếp:', error);
    return [];
  }
}

export function subscribeToProxies(
  onData: (proxies: ProxyItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, PROXIES_COLLECTION),
    (snapshot) => {
      const list: ProxyItem[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as ProxyItem);
      });
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, PROXIES_COLLECTION);
    }
  );
}

export async function getCloudProxies(): Promise<ProxyItem[]> {
  try {
    const snapshot = await getDocs(collection(db, PROXIES_COLLECTION));
    const list: ProxyItem[] = [];
    snapshot.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as ProxyItem);
    });
    return list;
  } catch (error) {
    console.error('[Firestore] Lỗi đọc proxies trực tiếp:', error);
    return [];
  }
}

// --- Monthly Finances (Chỉ Admin Quản Lý) ---
export function subscribeToMonthlyFinances(
  onData: (finances: MonthlyFinanceRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, MONTHLY_FINANCES_COLLECTION),
    (snapshot) => {
      const list: MonthlyFinanceRecord[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as MonthlyFinanceRecord);
      });
      // Sắp xếp giảm dần theo thời gian (tháng mới nhất lên đầu)
      list.sort((a, b) => (b.monthKey || '').localeCompare(a.monthKey || ''));
      onData(list);
    },
    (error) => {
      console.warn('[Firestore] Live monthlyFinances listener warning:', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, MONTHLY_FINANCES_COLLECTION);
    }
  );
}

export async function getCloudMonthlyFinances(): Promise<MonthlyFinanceRecord[]> {
  try {
    const snapshot = await getDocs(collection(db, MONTHLY_FINANCES_COLLECTION));
    const list: MonthlyFinanceRecord[] = [];
    snapshot.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as MonthlyFinanceRecord);
    });
    list.sort((a, b) => (b.monthKey || '').localeCompare(a.monthKey || ''));
    return list;
  } catch (error) {
    console.error('[Firestore] Lỗi đọc monthly finances trực tiếp:', error);
    return [];
  }
}

// 6. Direct Cloud Firestore Operations (Create, Update, Delete)

// --- Page Records ---
export async function setCloudPageRecord(record: PageRecord): Promise<void> {
  const path = `${PAGE_RECORDS_COLLECTION}/${record.id}`;
  try {
    const cleanRecord = {
      ...record,
      bmNote: getCleanBmName(record.bmNote),
    };
    await setDoc(doc(db, PAGE_RECORDS_COLLECTION, record.id), cleanRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateCloudPageRecord(id: string, updates: Partial<PageRecord>): Promise<void> {
  const path = `${PAGE_RECORDS_COLLECTION}/${id}`;
  try {
    const cleanUpdates =
      updates.bmNote !== undefined
        ? { ...updates, bmNote: getCleanBmName(updates.bmNote) }
        : updates;
    await updateDoc(doc(db, PAGE_RECORDS_COLLECTION, id), cleanUpdates as DocumentData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCloudPageRecord(id: string): Promise<void> {
  const path = `${PAGE_RECORDS_COLLECTION}/${id}`;
  try {
    await deleteDoc(doc(db, PAGE_RECORDS_COLLECTION, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function batchSaveCloudPageRecords(records: PageRecord[]): Promise<void> {
  if (!records.length) return;
  const chunkSize = 400;
  try {
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((rec) => {
        const cleanRec = {
          ...rec,
          bmNote: getCleanBmName(rec.bmNote),
        };
        batch.set(doc(db, PAGE_RECORDS_COLLECTION, rec.id), cleanRec);
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, PAGE_RECORDS_COLLECTION);
  }
}

export async function batchDeleteCloudPageRecords(recordIds: string[]): Promise<void> {
  if (!recordIds.length) return;
  const chunkSize = 400;
  try {
    for (let i = 0; i < recordIds.length; i += chunkSize) {
      const chunk = recordIds.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((id) => {
        batch.delete(doc(db, PAGE_RECORDS_COLLECTION, id));
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, PAGE_RECORDS_COLLECTION);
  }
}

// --- Vias ---
export async function setCloudVia(via: FullViaItem): Promise<void> {
  const path = `${VIAS_COLLECTION}/${via.id}`;
  try {
    await setDoc(doc(db, VIAS_COLLECTION, via.id), via);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateCloudVia(id: string, updates: Partial<FullViaItem>): Promise<void> {
  const path = `${VIAS_COLLECTION}/${id}`;
  try {
    await updateDoc(doc(db, VIAS_COLLECTION, id), updates as DocumentData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCloudVia(id: string): Promise<void> {
  const path = `${VIAS_COLLECTION}/${id}`;
  try {
    await deleteDoc(doc(db, VIAS_COLLECTION, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function batchSaveCloudVias(vias: FullViaItem[]): Promise<void> {
  if (!vias.length) return;
  const chunkSize = 400;
  try {
    for (let i = 0; i < vias.length; i += chunkSize) {
      const chunk = vias.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((via) => {
        batch.set(doc(db, VIAS_COLLECTION, via.id), via);
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, VIAS_COLLECTION);
  }
}

export async function batchDeleteCloudVias(viaIds: string[]): Promise<void> {
  if (!viaIds.length) return;
  const chunkSize = 400;
  try {
    for (let i = 0; i < viaIds.length; i += chunkSize) {
      const chunk = viaIds.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((id) => {
        batch.delete(doc(db, VIAS_COLLECTION, id));
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, VIAS_COLLECTION);
  }
}

// --- Accounts (Bảo vệ khóa cứng tài khoản Super Admin cualokhachsan@gmail.com) ---
export async function setCloudAccount(account: UserAccount): Promise<void> {
  const path = `${ACCOUNTS_COLLECTION}/${account.id}`;
  try {
    const isMasterAdmin =
      account.id === 'admin' ||
      account.id === 'account-admin' ||
      account.role === 'admin' ||
      account.email?.trim().toLowerCase() === MASTER_OWNER_EMAIL;
    const enforcedAccount: UserAccount = isMasterAdmin
      ? {
          ...account,
          role: 'admin',
          status: 'approved',
          email: MASTER_OWNER_EMAIL,
        }
      : account;
    const clean = sanitizeForFirestore(enforcedAccount);
    await setDoc(doc(db, ACCOUNTS_COLLECTION, enforcedAccount.id), clean);
    console.log(`[Firestore] Đã lưu thành công tài khoản "${enforcedAccount.username}" (ID: ${enforcedAccount.id}) vào collection accounts.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateCloudAccount(id: string, updates: Partial<UserAccount>): Promise<void> {
  const path = `${ACCOUNTS_COLLECTION}/${id}`;
  try {
    const isMasterAdmin =
      id === 'admin' ||
      id === 'account-admin' ||
      updates.email?.trim().toLowerCase() === MASTER_OWNER_EMAIL;
    const safeUpdates: Partial<UserAccount> = isMasterAdmin
      ? {
          ...updates,
          role: 'admin',
          status: 'approved',
          email: MASTER_OWNER_EMAIL,
        }
      : updates;
    const clean = sanitizeForFirestore(safeUpdates);
    await updateDoc(doc(db, ACCOUNTS_COLLECTION, id), clean as DocumentData);
    console.log(`[Firestore] Đã cập nhật thành công tài khoản ID: ${id}.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCloudAccount(id: string): Promise<void> {
  if (id === 'admin' || id === 'account-admin') {
    console.warn('[Security] Chặn lệnh xóa tài khoản Quản Trị Viên Tối Cao (cualokhachsan@gmail.com).');
    return;
  }
  const path = `${ACCOUNTS_COLLECTION}/${id}`;
  try {
    await deleteDoc(doc(db, ACCOUNTS_COLLECTION, id));
    console.log(`[Firestore] Đã xóa thành công tài khoản ID: ${id}.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Shared Accounts ---
export async function setCloudSharedAccount(account: SharedAccount): Promise<void> {
  const path = `${SHARED_ACCOUNTS_COLLECTION}/${account.id}`;
  try {
    const clean = sanitizeForFirestore(account);
    await setDoc(doc(db, SHARED_ACCOUNTS_COLLECTION, account.id), clean);
    console.log(`[Firestore] Đã lưu thành công tài khoản web dùng chung: ${account.websiteName}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function updateCloudSharedAccount(id: string, updates: Partial<SharedAccount>): Promise<void> {
  const path = `${SHARED_ACCOUNTS_COLLECTION}/${id}`;
  try {
    const clean = sanitizeForFirestore(updates);
    await updateDoc(doc(db, SHARED_ACCOUNTS_COLLECTION, id), clean as DocumentData);
    console.log(`[Firestore] Đã cập nhật tài khoản web dùng chung ID: ${id}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function deleteCloudSharedAccount(id: string): Promise<void> {
  const path = `${SHARED_ACCOUNTS_COLLECTION}/${id}`;
  try {
    await deleteDoc(doc(db, SHARED_ACCOUNTS_COLLECTION, id));
    console.log(`[Firestore] Đã xóa thành công tài khoản web dùng chung ID: ${id}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

export async function batchSaveCloudSharedAccounts(accounts: SharedAccount[]): Promise<void> {
  if (!accounts.length) return;
  const chunkSize = 400;
  try {
    for (let i = 0; i < accounts.length; i += chunkSize) {
      const chunk = accounts.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((acc) => {
        const clean = sanitizeForFirestore(acc);
        batch.set(doc(db, SHARED_ACCOUNTS_COLLECTION, acc.id), clean);
      });
      await batch.commit();
    }
    console.log(`[Firestore] Đã lưu hàng loạt ${accounts.length} tài khoản web dùng chung.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, SHARED_ACCOUNTS_COLLECTION);
    throw error;
  }
}

// --- Group Records ---
export async function setCloudGroupRecord(record: GroupRecord): Promise<void> {
  const path = `${GROUP_RECORDS_COLLECTION}/${record.id}`;
  try {
    const clean = sanitizeForFirestore(record);
    await setDoc(doc(db, GROUP_RECORDS_COLLECTION, record.id), clean);
    console.log(`[Firestore] Đã lưu thành công dòng group: ${record.groupName} (${record.uid})`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function updateCloudGroupRecord(id: string, updates: Partial<GroupRecord>): Promise<void> {
  const path = `${GROUP_RECORDS_COLLECTION}/${id}`;
  try {
    const clean = sanitizeForFirestore(updates);
    await updateDoc(doc(db, GROUP_RECORDS_COLLECTION, id), clean as DocumentData);
    console.log(`[Firestore] Đã cập nhật dòng group ID: ${id}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function batchUpdateGroupInteractionStatus(
  ids: string[],
  interactionStatus: GroupInteractionStatus | undefined
): Promise<void> {
  if (!ids.length) return;
  const chunkSize = 400;
  try {
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((id) => {
        const ref = doc(db, GROUP_RECORDS_COLLECTION, id);
        batch.update(ref, {
          interactionStatus: interactionStatus || '',
          updatedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
    }
    console.log(`[Firestore] Đã cập nhật trạng thái tương tác "${interactionStatus || 'bỏ chọn'}" cho ${ids.length} dòng.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, GROUP_RECORDS_COLLECTION);
    throw error;
  }
}

export async function deleteCloudGroupRecord(id: string): Promise<void> {
  const path = `${GROUP_RECORDS_COLLECTION}/${id}`;
  try {
    await deleteDoc(doc(db, GROUP_RECORDS_COLLECTION, id));
    console.log(`[Firestore] Đã xóa thành công dòng group ID: ${id}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

export async function batchSaveCloudGroupRecords(records: GroupRecord[]): Promise<void> {
  if (!records.length) return;
  const chunkSize = 400;
  try {
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((rec) => {
        const clean = sanitizeForFirestore(rec);
        batch.set(doc(db, GROUP_RECORDS_COLLECTION, rec.id), clean);
      });
      await batch.commit();
    }
    console.log(`[Firestore] Đã lưu hàng loạt ${records.length} dòng group.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, GROUP_RECORDS_COLLECTION);
    throw error;
  }
}

export async function batchDeleteCloudGroupRecords(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const chunkSize = 400;
  try {
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((id) => {
        batch.delete(doc(db, GROUP_RECORDS_COLLECTION, id));
      });
      await batch.commit();
    }
    console.log(`[Firestore] Đã xóa hàng loạt ${ids.length} dòng group.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, GROUP_RECORDS_COLLECTION);
    throw error;
  }
}

export async function clearAllCloudGroupRecords(): Promise<void> {
  try {
    const snapshot = await getDocs(collection(db, GROUP_RECORDS_COLLECTION));
    if (snapshot.empty) return;
    const chunkSize = 400;
    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();
    }
    console.log(`[Firestore] Đã xóa trắng toàn bộ ${docs.length} dòng group.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, GROUP_RECORDS_COLLECTION);
    throw error;
  }
}

// --- Proxy Operations ---
export async function setCloudProxy(proxy: ProxyItem): Promise<void> {
  const path = `${PROXIES_COLLECTION}/${proxy.id}`;
  try {
    const clean = sanitizeForFirestore(proxy);
    await setDoc(doc(db, PROXIES_COLLECTION, proxy.id), clean);
    console.log(`[Firestore] Đã lưu proxy: ${proxy.ip}:${proxy.port}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function updateCloudProxy(id: string, updates: Partial<ProxyItem>): Promise<void> {
  const path = `${PROXIES_COLLECTION}/${id}`;
  try {
    const clean = sanitizeForFirestore(updates);
    await updateDoc(doc(db, PROXIES_COLLECTION, id), clean as DocumentData);
    console.log(`[Firestore] Đã cập nhật proxy ID: ${id}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function deleteCloudProxy(id: string): Promise<void> {
  const path = `${PROXIES_COLLECTION}/${id}`;
  try {
    await deleteDoc(doc(db, PROXIES_COLLECTION, id));
    console.log(`[Firestore] Đã xóa proxy ID: ${id}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

export async function batchSaveCloudProxies(proxies: ProxyItem[]): Promise<void> {
  if (!proxies.length) return;
  const chunkSize = 400;
  try {
    for (let i = 0; i < proxies.length; i += chunkSize) {
      const chunk = proxies.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((prx) => {
        const clean = sanitizeForFirestore(prx);
        batch.set(doc(db, PROXIES_COLLECTION, prx.id), clean);
      });
      await batch.commit();
    }
    console.log(`[Firestore] Đã lưu hàng loạt ${proxies.length} proxy.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, PROXIES_COLLECTION);
    throw error;
  }
}

export async function batchDeleteCloudProxies(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const chunkSize = 400;
  try {
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((id) => {
        batch.delete(doc(db, PROXIES_COLLECTION, id));
      });
      await batch.commit();
    }
    console.log(`[Firestore] Đã xóa hàng loạt ${ids.length} proxy.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, PROXIES_COLLECTION);
    throw error;
  }
}

// --- Monthly Finance Operations ---
export async function setCloudMonthlyFinance(record: MonthlyFinanceRecord): Promise<void> {
  const path = `${MONTHLY_FINANCES_COLLECTION}/${record.id}`;
  try {
    const clean = sanitizeForFirestore(record);
    await setDoc(doc(db, MONTHLY_FINANCES_COLLECTION, record.id), clean);
    console.log(`[Firestore] Đã lưu thông tin tài chính tháng ${record.monthKey} thành công.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function updateCloudMonthlyFinance(id: string, updates: Partial<MonthlyFinanceRecord>): Promise<void> {
  const path = `${MONTHLY_FINANCES_COLLECTION}/${id}`;
  try {
    const clean = sanitizeForFirestore(updates);
    await updateDoc(doc(db, MONTHLY_FINANCES_COLLECTION, id), clean as DocumentData);
    console.log(`[Firestore] Đã cập nhật tài chính tháng ${id} thành công.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function deleteCloudMonthlyFinance(id: string): Promise<void> {
  const path = `${MONTHLY_FINANCES_COLLECTION}/${id}`;
  try {
    await deleteDoc(doc(db, MONTHLY_FINANCES_COLLECTION, id));
    console.log(`[Firestore] Đã xóa dữ liệu tài chính tháng ${id}.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

export async function clearAllCloudMonthlyFinances(): Promise<void> {
  try {
    const snapshot = await getDocs(collection(db, MONTHLY_FINANCES_COLLECTION));
    if (snapshot.empty) return;
    const chunkSize = 400;
    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();
    }
    console.log(`[Firestore] Đã xóa toàn bộ ${docs.length} bản ghi tài chính tháng.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, MONTHLY_FINANCES_COLLECTION);
    throw error;
  }
}

export async function batchSaveCloudMonthlyFinances(records: MonthlyFinanceRecord[]): Promise<void> {
  if (!records.length) return;
  const chunkSize = 400;
  try {
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((rec) => {
        batch.set(doc(db, MONTHLY_FINANCES_COLLECTION, rec.id), sanitizeForFirestore(rec));
      });
      await batch.commit();
    }
    console.log(`[Firestore] Đã lưu hàng loạt ${records.length} bản ghi tài chính tháng.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, MONTHLY_FINANCES_COLLECTION);
    throw error;
  }
}

// --- Settings (Khóa cứng quyền sở hữu Admin về cualokhachsan@gmail.com) ---
export async function saveCloudSettings(settings: Partial<CloudSettingsData>): Promise<void> {
  const path = `${SETTINGS_COLLECTION}/${GENERAL_SETTINGS_DOC}`;
  try {
    const clean = sanitizeForFirestore({
      ...settings,
      id: GENERAL_SETTINGS_DOC,
      adminEmail: MASTER_OWNER_EMAIL,
    });
    await setDoc(
      doc(db, SETTINGS_COLLECTION, GENERAL_SETTINGS_DOC),
      clean,
      { merge: true }
    );
    console.log(`[Firestore] Đã lưu thành công cài đặt hệ thống vào settings/${GENERAL_SETTINGS_DOC}.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- Reset to Default Seed Data in Cloud Firestore ---
export async function resetCloudFirestoreToDefaults(): Promise<void> {
  try {
    // 1. Clear old records
    const recSnap = await getDocs(collection(db, PAGE_RECORDS_COLLECTION));
    const recBatch = writeBatch(db);
    recSnap.docs.forEach((d) => recBatch.delete(d.ref));
    await recBatch.commit();

    // Seed new default records
    const chunkRecs = 400;
    for (let i = 0; i < INITIAL_PAGE_RECORDS.length; i += chunkRecs) {
      const chunk = INITIAL_PAGE_RECORDS.slice(i, i + chunkRecs);
      const batch = writeBatch(db);
      chunk.forEach((rec) => {
        batch.set(doc(db, PAGE_RECORDS_COLLECTION, rec.id), rec);
      });
      await batch.commit();
    }

    // 2. Clear old vias & seed defaults
    const viaSnap = await getDocs(collection(db, VIAS_COLLECTION));
    const viaBatch = writeBatch(db);
    viaSnap.docs.forEach((d) => viaBatch.delete(d.ref));
    await viaBatch.commit();

    const initialVias = getInitialFullViaItems();
    const newViaBatch = writeBatch(db);
    initialVias.forEach((v) => newViaBatch.set(doc(db, VIAS_COLLECTION, v.id), v));
    await newViaBatch.commit();

    // 3. Clear old accounts & seed defaults
    const accSnap = await getDocs(collection(db, ACCOUNTS_COLLECTION));
    const accBatch = writeBatch(db);
    accSnap.docs.forEach((d) => accBatch.delete(d.ref));
    await accBatch.commit();

    const newAccBatch = writeBatch(db);
    INITIAL_ACCOUNTS.forEach((a) => newAccBatch.set(doc(db, ACCOUNTS_COLLECTION, a.id), a));
    await newAccBatch.commit();

    // 4. Reset Settings
    await setDoc(doc(db, SETTINGS_COLLECTION, GENERAL_SETTINGS_DOC), {
      id: GENERAL_SETTINGS_DOC,
      adminPin: DEFAULT_ADMIN_SETTINGS.adminPin,
      requireApproval: DEFAULT_ADMIN_SETTINGS.requireApproval,
      customStaffList: DEFAULT_STAFF_MEMBERS,
      adminName: DEFAULT_ADMIN_SETTINGS.adminName,
      adminEmail: DEFAULT_ADMIN_SETTINGS.adminEmail,
    });

    // 5. Clear old shared accounts & seed defaults
    const sharedSnap = await getDocs(collection(db, SHARED_ACCOUNTS_COLLECTION));
    const sharedBatch = writeBatch(db);
    sharedSnap.docs.forEach((d) => sharedBatch.delete(d.ref));
    await sharedBatch.commit();

    const newSharedBatch = writeBatch(db);
    INITIAL_SHARED_ACCOUNTS.forEach((s) =>
      newSharedBatch.set(doc(db, SHARED_ACCOUNTS_COLLECTION, s.id), sanitizeForFirestore(s))
    );
    await newSharedBatch.commit();

    console.log('[Firestore] Reset all collections to default seed data in Cloud Firestore successfully.');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'reset_all');
  }
}

// ==========================================
// 10. IMAGE TASKS MANAGEMENT (BẢNG 9: LÀM ẢNH & GHÉP ẢNH)
// ==========================================
export const IMAGE_TASKS_COLLECTION = 'imageTasks';

export function subscribeToImageTasks(callback: (tasks: ImageTaskItem[]) => void): Unsubscribe {
  const colRef = collection(db, IMAGE_TASKS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.empty) {
        // Tự động seed initial tasks nếu rỗng
        callback(INITIAL_IMAGE_TASKS);
        return;
      }
      const list: ImageTaskItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as ImageTaskItem;
        list.push({ ...data, id: docSnap.id });
      });
      // Sắp xếp theo ngày tạo mới nhất
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      callback(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, IMAGE_TASKS_COLLECTION);
    }
  );
}

export async function setCloudImageTask(task: ImageTaskItem): Promise<void> {
  try {
    const docRef = doc(db, IMAGE_TASKS_COLLECTION, task.id);
    await setDoc(docRef, sanitizeForFirestore(task));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${IMAGE_TASKS_COLLECTION}/${task.id}`);
    throw error;
  }
}

export async function updateCloudImageTask(taskId: string, partial: Partial<ImageTaskItem>): Promise<void> {
  try {
    const docRef = doc(db, IMAGE_TASKS_COLLECTION, taskId);
    await updateDoc(docRef, sanitizeForFirestore(partial) as DocumentData);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${IMAGE_TASKS_COLLECTION}/${taskId}`);
    throw error;
  }
}

export async function deleteCloudImageTask(taskId: string): Promise<void> {
  try {
    const docRef = doc(db, IMAGE_TASKS_COLLECTION, taskId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${IMAGE_TASKS_COLLECTION}/${taskId}`);
    throw error;
  }
}

export async function batchSaveCloudImageTasks(tasks: ImageTaskItem[]): Promise<void> {
  if (!tasks || tasks.length === 0) return;
  try {
    const batch = writeBatch(db);
    tasks.forEach((task) => {
      const docRef = doc(db, IMAGE_TASKS_COLLECTION, task.id);
      batch.set(docRef, sanitizeForFirestore(task));
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${IMAGE_TASKS_COLLECTION}/batch`);
    throw error;
  }
}

/**
 * Phân tích cú pháp chuỗi cấu hình Firebase (hỗ trợ cả JSON chuẩn và đoạn code JS copy từ Firebase Console)
 */
export function parseFirebaseConfigInput(rawInput: string): {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  firestoreDatabaseId?: string;
} {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('Vui lòng dán cấu hình Firebase (firebaseConfig) của project mới.');
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && parsed.apiKey && parsed.projectId) {
      return parsed;
    }
  } catch {
    // Fallback sang regex trích xuất từ đoạn code JS của Firebase Console
  }

  const extractField = (key: string): string | undefined => {
    const regex = new RegExp(`["']?${key}["']?\\s*:\\s*["']([^"']+)["']`, 'i');
    const match = trimmed.match(regex);
    return match ? match[1].trim() : undefined;
  };

  const apiKey = extractField('apiKey');
  const projectId = extractField('projectId');
  if (!apiKey || !projectId) {
    throw new Error(
      'Không tìm thấy apiKey hoặc projectId trong đoạn cấu hình. Vui lòng copy nguyên khối firebaseConfig từ Project Settings của Firebase mới.'
    );
  }

  return {
    apiKey,
    projectId,
    authDomain: extractField('authDomain') || `${projectId}.firebaseapp.com`,
    storageBucket: extractField('storageBucket') || `${projectId}.appspot.com`,
    messagingSenderId: extractField('messagingSenderId'),
    appId: extractField('appId'),
    firestoreDatabaseId: extractField('firestoreDatabaseId') || '(default)',
  };
}

/**
 * Đẩy toàn bộ dữ liệu CSDL (từ bản sao lưu hoặc đang chạy) sang 1 Project Firebase mới của mail mới
 */
export async function pushBackupToExternalFirebase(
  rawConfigInput: string,
  backupData: any,
  targetDatabaseId?: string,
  onProgress?: (msg: string) => void
): Promise<{ totalDocsWritten: number; targetProjectId: string; targetDbId: string }> {
  const parsedConfig = parseFirebaseConfigInput(rawConfigInput);
  const dbId = (targetDatabaseId || parsedConfig.firestoreDatabaseId || '(default)').trim();
  const appName = `migration_target_${Date.now()}`;

  onProgress?.(`Đang kết nối tới Project mới: ${parsedConfig.projectId} (DB: ${dbId})...`);
  const targetApp = initializeApp(parsedConfig, appName);
  const targetDb =
    dbId === '(default)' || !dbId
      ? initializeFirestore(targetApp, { ignoreUndefinedProperties: true })
      : initializeFirestore(targetApp, { ignoreUndefinedProperties: true }, dbId);

  let totalDocsWritten = 0;

  const writeCollectionBatch = async (colName: string, items: any[], label: string) => {
    if (!Array.isArray(items) || items.length === 0) return;
    onProgress?.(`Đang đẩy ${items.length} bản ghi bảng ${label} (${colName})...`);
    const chunkSize = 350;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const batch = writeBatch(targetDb);
      chunk.forEach((item, idx) => {
        const docId = item?.id ? String(item.id) : `doc-${Date.now()}-${i + idx}`;
        const cleanItem = sanitizeForFirestore({ ...item, id: docId });
        batch.set(doc(targetDb, colName, docId), cleanItem);
      });
      await batch.commit();
      totalDocsWritten += chunk.length;
    }
  };

  await writeCollectionBatch(PAGE_RECORDS_COLLECTION, backupData.pageRecords || [], 'Fanpage');
  await writeCollectionBatch(VIAS_COLLECTION, backupData.vias || [], 'Full Via');
  await writeCollectionBatch(GROUP_RECORDS_COLLECTION, backupData.groupRecords || [], 'Group');
  await writeCollectionBatch(PROXIES_COLLECTION, backupData.proxies || [], 'Proxy');
  await writeCollectionBatch(SHARED_ACCOUNTS_COLLECTION, backupData.sharedAccounts || [], 'Web Chung');
  await writeCollectionBatch(MONTHLY_FINANCES_COLLECTION, backupData.monthlyFinances || [], 'Doanh Thu');
  await writeCollectionBatch(IMAGE_TASKS_COLLECTION, backupData.imageTasks || [], 'Làm Ảnh');
  await writeCollectionBatch(ACCOUNTS_COLLECTION, backupData.accounts || [], 'Nhân Viên & Tài Khoản');

  onProgress?.('Đang đồng bộ cấu hình hệ thống & Admin (settings/general)...');
  const settingsPayload = sanitizeForFirestore({
    id: GENERAL_SETTINGS_DOC,
    adminPin: backupData.settings?.adminPin || DEFAULT_ADMIN_SETTINGS.adminPin,
    adminName: backupData.settings?.adminName || DEFAULT_ADMIN_SETTINGS.adminName,
    adminEmail: backupData.settings?.adminEmail || 'cualokhachsan@gmail.com',
    requireApproval: true,
    requireGoogleLoginOnly: backupData.settings?.requireGoogleLoginOnly ?? true,
    customStaffList: backupData.settings?.customStaffList || DEFAULT_STAFF_MEMBERS,
  });
  await setDoc(doc(targetDb, SETTINGS_COLLECTION, GENERAL_SETTINGS_DOC), settingsPayload, { merge: true });
  totalDocsWritten += 1;

  return {
    totalDocsWritten,
    targetProjectId: parsedConfig.projectId,
    targetDbId: dbId,
  };
}

/**
 * Lưu cấu hình Firebase mới của mail cualokhachsan@gmail.com làm CSDL chính thức của ứng dụng
 * Đồng thời lưu Cầu Nối (settings/db_bridge) để mọi thiết bị mở link app đều tự động đẩy dữ liệu về CSDL của cualokhachsan@gmail.com
 */
export async function saveActiveFirebaseConfig(rawConfigInput: string, targetDatabaseId?: string): Promise<void> {
  const parsed = parseFirebaseConfigInput(rawConfigInput);
  const dbId = (targetDatabaseId || parsed.firestoreDatabaseId || '(default)').trim();
  const configPayload = JSON.stringify({
    ...parsed,
    firestoreDatabaseId: dbId,
  });

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(CUSTOM_FIREBASE_CONFIG_STORAGE_KEY, configPayload);
  }

  // Ghi Cầu Nối (db_bridge) lên host mặc định để mọi máy tính/nhân viên truy cập app đều tự động trỏ sang CSDL của cualokhachsan@gmail.com
  try {
    const bridgeAppName = `bridge_save_${Date.now()}`;
    const bridgeApp = initializeApp(firebaseConfigDefault, bridgeAppName);
    const bridgeDb =
      !firebaseConfigDefault.firestoreDatabaseId || firebaseConfigDefault.firestoreDatabaseId === '(default)'
        ? initializeFirestore(bridgeApp, { ignoreUndefinedProperties: true })
        : initializeFirestore(bridgeApp, { ignoreUndefinedProperties: true }, firebaseConfigDefault.firestoreDatabaseId);

    await setDoc(doc(bridgeDb, SETTINGS_COLLECTION, 'db_bridge'), {
      id: 'db_bridge',
      redirectConfigJson: configPayload,
      targetProjectId: parsed.projectId,
      targetDatabaseId: dbId,
      ownerEmail: 'cualokhachsan@gmail.com',
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[Firestore] Không thể lưu cầu nối db_bridge (không ảnh hưởng kết nối chính):', err);
  }
}

/**
 * Xóa sạch toàn bộ dữ liệu trên CSDL mặc định cũ (gen-lang-client-0516107785) sau khi đã chuyển sang Project riêng của cualokhachsan@gmail.com
 * Giữ lại duy nhất con trỏ điều hướng db_bridge (không chứa bất kỳ dữ liệu nghiệp vụ nào) để các thiết bị mở app tự động trỏ sang CSDL của cualokhachsan@gmail.com
 */
export async function wipeLegacyDefaultFirebaseDatabase(
  onProgress?: (msg: string) => void
): Promise<{ totalDeleted: number; oldProjectId: string }> {
  const oldAppName = `legacy_cleanup_${Date.now()}`;
  const oldApp = initializeApp(firebaseConfigDefault, oldAppName);
  const oldDb =
    !firebaseConfigDefault.firestoreDatabaseId || firebaseConfigDefault.firestoreDatabaseId === '(default)'
      ? initializeFirestore(oldApp, { ignoreUndefinedProperties: true })
      : initializeFirestore(oldApp, { ignoreUndefinedProperties: true }, firebaseConfigDefault.firestoreDatabaseId);

  const collectionsToWipe = [
    PAGE_RECORDS_COLLECTION,
    VIAS_COLLECTION,
    GROUP_RECORDS_COLLECTION,
    PROXIES_COLLECTION,
    SHARED_ACCOUNTS_COLLECTION,
    MONTHLY_FINANCES_COLLECTION,
    IMAGE_TASKS_COLLECTION,
    ACCOUNTS_COLLECTION,
    SETTINGS_COLLECTION,
  ];

  let totalDeleted = 0;
  for (const colName of collectionsToWipe) {
    onProgress?.(`Đang xóa sạch bảng ${colName} trên CSDL cũ (${firebaseConfigDefault.projectId})...`);
    const snap = await getDocs(collection(oldDb, colName));
    if (!snap.empty) {
      const docs = snap.docs.filter((d) => !(colName === SETTINGS_COLLECTION && d.id === 'db_bridge'));
      const chunkSize = 350;
      for (let i = 0; i < docs.length; i += chunkSize) {
        const chunk = docs.slice(i, i + chunkSize);
        const batch = writeBatch(oldDb);
        chunk.forEach((d) => batch.delete(doc(oldDb, colName, d.id)));
        await batch.commit();
        totalDeleted += chunk.length;
      }
    }
  }

  return {
    totalDeleted,
    oldProjectId: firebaseConfigDefault.projectId,
  };
}

/**
 * Bộ quy tắc bảo mật chuẩn Firestore Rules v2 khóa độc quyền cho cualokhachsan@gmail.com
 * Dùng để dán vào tab Rules trên Firebase Console của mail cualokhachsan@gmail.com sau khi chuyển dữ liệu
 */
export const HARDENED_FIRESTORE_RULES_V2 = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }

    match /test/{docId} {
      allow read, write: if isValidId(docId);
    }

    function isValidId(id) {
      return id is string && id.size() > 0 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\\\-\\\\.]+$');
    }

    function isSignedIn() {
      return request.auth != null;
    }

    // Super Admin độc quyền: cualokhachsan@gmail.com (Chống giả mạo với email_verified == true)
    function isSuperAdmin() {
      return isSignedIn() &&
        request.auth.token.email_verified == true &&
        request.auth.token.email.lower() == 'cualokhachsan@gmail.com';
    }

    function isProtectedMasterAdminDoc(docId, existingData) {
      return docId == 'admin' ||
        docId == 'account-admin' ||
        ('email' in existingData && existingData.email is string && existingData.email.lower() == 'cualokhachsan@gmail.com');
    }

    match /pageRecords/{recordId} {
      allow read: if true;
      allow create, update, delete: if isValidId(recordId);
    }

    match /vias/{viaId} {
      allow read: if true;
      allow create, update, delete: if isValidId(viaId);
    }

    match /accounts/{accountId} {
      allow read: if true;
      allow create: if isValidId(accountId) &&
        (request.resource.data.role == 'staff' ||
         (request.resource.data.role == 'admin' && request.resource.data.email.lower() == 'cualokhachsan@gmail.com') ||
         isSuperAdmin());
      allow update: if isValidId(accountId) &&
        (request.resource.data.role == resource.data.role || isSuperAdmin()) &&
        (!isProtectedMasterAdminDoc(accountId, resource.data) ||
         (request.resource.data.role == 'admin' && request.resource.data.status == 'approved'));
      allow delete: if isValidId(accountId) && !isProtectedMasterAdminDoc(accountId, resource.data);
    }

    match /settings/{settingId} {
      allow read: if true;
      allow create, update: if isValidId(settingId) &&
        (!('adminEmail' in request.resource.data) || request.resource.data.adminEmail.lower() == 'cualokhachsan@gmail.com' || isSuperAdmin()) &&
        (!('ownerEmail' in request.resource.data) || request.resource.data.ownerEmail.lower() == 'cualokhachsan@gmail.com' || isSuperAdmin());
      allow delete: if isValidId(settingId) && isSuperAdmin();
    }

    match /sharedAccounts/{accountId} {
      allow read: if true;
      allow create, update, delete: if isValidId(accountId);
    }

    match /groupRecords/{recordId} {
      allow read: if true;
      allow create, update, delete: if isValidId(recordId);
    }

    match /proxies/{proxyId} {
      allow read: if true;
      allow create, update, delete: if isValidId(proxyId);
    }

    match /monthlyFinances/{monthId} {
      allow read: if true;
      allow create, update, delete: if isValidId(monthId);
    }

    match /imageTasks/{taskId} {
      allow read: if true;
      allow create, update, delete: if isValidId(taskId);
    }
  }
}`;
