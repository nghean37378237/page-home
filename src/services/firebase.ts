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
import firebaseConfig from '../../firebase-applet-config.json';
import { PageRecord, UserAccount, FullViaItem, SharedAccount, GroupRecord, ProxyItem } from '../types';
import {
  INITIAL_PAGE_RECORDS,
  INITIAL_GROUP_RECORDS,
  INITIAL_PROXIES,
} from '../data/initialData';
import {
  INITIAL_ACCOUNTS,
  DEFAULT_ADMIN_ACCOUNT,
  DEFAULT_STAFF_MEMBERS,
  DEFAULT_ADMIN_SETTINGS,
  AdminSecuritySettings,
  getInitialFullViaItems,
} from './storage';

// 1. Initialize Firebase App and Firestore Database instance with ignoreUndefinedProperties: true
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// CRITICAL: Must pass firebaseConfig.firestoreDatabaseId and enable ignoreUndefinedProperties
export const db = initializeFirestore(
  app,
  { ignoreUndefinedProperties: true },
  firebaseConfig.firestoreDatabaseId
);
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

// 4. Seeding Cloud Firestore with initial data if empty
export async function seedCloudFirestoreIfEmpty(): Promise<void> {
  try {
    // Only seed initial accounts if the collection is completely empty (first initialization)
    const accountsSnapshot = await getDocs(collection(db, ACCOUNTS_COLLECTION));
    if (accountsSnapshot.empty) {
      console.log('[Firestore] Cơ sở dữ liệu tài khoản trống. Khởi tạo tài khoản ban đầu...');
      const batch = writeBatch(db);
      INITIAL_ACCOUNTS.forEach((acc) => {
        const ref = doc(db, ACCOUNTS_COLLECTION, acc.id);
        batch.set(ref, acc);
      });
      await batch.commit();
    } else {
      // If accounts collection already exists, ensure Admin account exists so admin access is never locked out
      const existingDocs = accountsSnapshot.docs.map((d) => d.data() as UserAccount);
      const hasAdmin = existingDocs.some((a) => a.role === 'admin');
      if (!hasAdmin) {
        console.log('[Firestore] Bổ sung tài khoản Quản Lý (Admin)...');
        await setDoc(doc(db, ACCOUNTS_COLLECTION, DEFAULT_ADMIN_ACCOUNT.id), DEFAULT_ADMIN_ACCOUNT);
      }
    }

    // Check if settings doc already exists
    const settingsDocRef = doc(db, SETTINGS_COLLECTION, GENERAL_SETTINGS_DOC);
    const settingsSnap = await getDoc(settingsDocRef);
    if (!settingsSnap.exists()) {
      console.log('[Firestore] Seeding general settings to Cloud Firestore...');
      const initialSettings: CloudSettingsData = {
        id: GENERAL_SETTINGS_DOC,
        adminPin: DEFAULT_ADMIN_SETTINGS.adminPin,
        requireApproval: DEFAULT_ADMIN_SETTINGS.requireApproval,
        customStaffList: DEFAULT_STAFF_MEMBERS,
        adminName: DEFAULT_ADMIN_SETTINGS.adminName,
        adminEmail: DEFAULT_ADMIN_SETTINGS.adminEmail,
        requireGoogleLoginOnly: DEFAULT_ADMIN_SETTINGS.requireGoogleLoginOnly ?? true,
      };
      await setDoc(settingsDocRef, initialSettings);
    }

    // Check if vias collection has data
    const viasSnapshot = await getDocs(collection(db, VIAS_COLLECTION));
    if (viasSnapshot.empty) {
      console.log('[Firestore] Seeding Full Vias to Cloud Firestore...');
      const initialVias = getInitialFullViaItems();
      const batch = writeBatch(db);
      initialVias.forEach((via) => {
        const ref = doc(db, VIAS_COLLECTION, via.id);
        batch.set(ref, via);
      });
      await batch.commit();
    }

    // Check if pageRecords collection has data
    const recordsSnapshot = await getDocs(collection(db, PAGE_RECORDS_COLLECTION));
    if (recordsSnapshot.empty) {
      console.log('[Firestore] Seeding Fanpage Records to Cloud Firestore...');
      // Split into batches of 400 (Firestore batch max is 500)
      const chunkSize = 400;
      for (let i = 0; i < INITIAL_PAGE_RECORDS.length; i += chunkSize) {
        const chunk = INITIAL_PAGE_RECORDS.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach((rec) => {
          const ref = doc(db, PAGE_RECORDS_COLLECTION, rec.id);
          batch.set(ref, rec);
        });
        await batch.commit();
      }
    }

    // Check if sharedAccounts collection has data
    const sharedSnapshot = await getDocs(collection(db, SHARED_ACCOUNTS_COLLECTION));
    if (sharedSnapshot.empty) {
      console.log('[Firestore] Seeding Shared Accounts to Cloud Firestore...');
      const batch = writeBatch(db);
      INITIAL_SHARED_ACCOUNTS.forEach((acc) => {
        const ref = doc(db, SHARED_ACCOUNTS_COLLECTION, acc.id);
        batch.set(ref, sanitizeForFirestore(acc));
      });
      await batch.commit();
    }

    // Check if groupRecords collection has data
    const groupsSnapshot = await getDocs(collection(db, GROUP_RECORDS_COLLECTION));
    if (groupsSnapshot.empty) {
      console.log('[Firestore] Seeding Group Records to Cloud Firestore...');
      const batch = writeBatch(db);
      INITIAL_GROUP_RECORDS.forEach((grp) => {
        const ref = doc(db, GROUP_RECORDS_COLLECTION, grp.id);
        batch.set(ref, sanitizeForFirestore(grp));
      });
      await batch.commit();
    }

    // Check if proxies collection has data
    const proxiesSnapshot = await getDocs(collection(db, PROXIES_COLLECTION));
    if (proxiesSnapshot.empty) {
      console.log('[Firestore] Seeding Proxies to Cloud Firestore...');
      const batch = writeBatch(db);
      INITIAL_PROXIES.forEach((prx) => {
        const ref = doc(db, PROXIES_COLLECTION, prx.id);
        batch.set(ref, sanitizeForFirestore(prx));
      });
      await batch.commit();
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
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, GROUP_RECORDS_COLLECTION);
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

// 6. Direct Cloud Firestore Operations (Create, Update, Delete)

// --- Page Records ---
export async function setCloudPageRecord(record: PageRecord): Promise<void> {
  const path = `${PAGE_RECORDS_COLLECTION}/${record.id}`;
  try {
    await setDoc(doc(db, PAGE_RECORDS_COLLECTION, record.id), record);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateCloudPageRecord(id: string, updates: Partial<PageRecord>): Promise<void> {
  const path = `${PAGE_RECORDS_COLLECTION}/${id}`;
  try {
    await updateDoc(doc(db, PAGE_RECORDS_COLLECTION, id), updates as DocumentData);
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
        batch.set(doc(db, PAGE_RECORDS_COLLECTION, rec.id), rec);
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

// --- Accounts ---
export async function setCloudAccount(account: UserAccount): Promise<void> {
  const path = `${ACCOUNTS_COLLECTION}/${account.id}`;
  try {
    const clean = sanitizeForFirestore(account);
    await setDoc(doc(db, ACCOUNTS_COLLECTION, account.id), clean);
    console.log(`[Firestore] Đã lưu thành công tài khoản "${account.username}" (ID: ${account.id}) vào collection accounts.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateCloudAccount(id: string, updates: Partial<UserAccount>): Promise<void> {
  const path = `${ACCOUNTS_COLLECTION}/${id}`;
  try {
    const clean = sanitizeForFirestore(updates);
    await updateDoc(doc(db, ACCOUNTS_COLLECTION, id), clean as DocumentData);
    console.log(`[Firestore] Đã cập nhật thành công tài khoản ID: ${id}.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCloudAccount(id: string): Promise<void> {
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

// --- Settings ---
export async function saveCloudSettings(settings: Partial<CloudSettingsData>): Promise<void> {
  const path = `${SETTINGS_COLLECTION}/${GENERAL_SETTINGS_DOC}`;
  try {
    const clean = sanitizeForFirestore({ ...settings, id: GENERAL_SETTINGS_DOC });
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
