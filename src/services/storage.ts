import { PageRecord, AppUser, UserAccount, FullViaItem, GroupRecord, MonthlyFinanceRecord, ALL_TAB_KEYS } from '../types';
import { INITIAL_PAGE_RECORDS, INITIAL_MONTHLY_FINANCES } from '../data/initialData';
import { getCleanBmName } from '../utils/helpers';

// Storage keys previously used for local storage - retained to purge legacy cache
export const STORAGE_KEY = 'fanpage_sheets_records_v2';
export const USER_STORAGE_KEY = 'fanpage_current_user_session_v2';
export const ACCOUNTS_STORAGE_KEY = 'fanpage_accounts_list_v1';
export const ADMIN_SECURITY_KEY = 'fanpage_admin_security_v1';
export const FULL_VIA_STORAGE_KEY = 'fanpage_full_vias_list_v2';
export const CUSTOM_STAFF_KEY = 'fanpage_custom_staff_v1';
export const GROUP_RECORDS_BACKUP_KEY = 'fanpage_group_records_safe_backup_v3';
export const MONTHLY_FINANCES_BACKUP_KEY = 'fanpage_monthly_finances_safe_backup_v1';

export const DEFAULT_STAFF_MEMBERS = ['Anh Quỳnh', 'Bảo', 'Phương My'];

export const DEFAULT_ADMIN_USER: AppUser = {
  id: 'admin',
  name: 'Quản Lý (Admin)',
  email: 'myphuong2295@gmail.com',
  role: 'admin',
  status: 'approved',
  isAuthenticated: true,
  allowedTabs: ALL_TAB_KEYS,
};

export const GUEST_USER: AppUser = {
  id: 'guest',
  name: 'Chưa Đăng Nhập',
  role: 'staff',
  status: 'pending',
  isAuthenticated: false,
};

export const DEFAULT_ADMIN_ACCOUNT: UserAccount = {
  id: 'account-admin',
  username: 'Quản Lý (Admin)',
  email: 'myphuong2295@gmail.com',
  role: 'admin',
  status: 'approved',
  pin: 'admin123',
  createdAt: '15/09/2026',
  approvedAt: '15/09/2026',
  adminNote: 'Tài khoản Quản Trị Viên tối cao',
  allowedTabs: ALL_TAB_KEYS,
};

export const INITIAL_ACCOUNTS: UserAccount[] = [
  DEFAULT_ADMIN_ACCOUNT,
  {
    id: 'account-anh-quynh',
    username: 'Anh Quỳnh',
    email: 'anhquynh.mmo@gmail.com',
    role: 'staff',
    status: 'approved',
    pin: '123456',
    createdAt: '15/09/2026',
    approvedAt: '15/09/2026',
    adminNote: 'Nhân viên trực page chính',
    allowedTabs: ['fanpage', 'fullvia'],
  },
  {
    id: 'account-bao',
    username: 'Bảo',
    email: 'bao.mmo@gmail.com',
    role: 'staff',
    status: 'approved',
    pin: '123456',
    createdAt: '15/09/2026',
    approvedAt: '15/09/2026',
    adminNote: 'Nhân viên quản lý via & page',
    allowedTabs: ['fanpage', 'group', 'fullvia'],
  },
  {
    id: 'account-phuong-my',
    username: 'Phương My',
    email: 'phuongmy.mmo@gmail.com',
    role: 'staff',
    status: 'approved',
    pin: '123456',
    createdAt: '15/09/2026',
    approvedAt: '15/09/2026',
    adminNote: 'Nhân viên trực ca ngày',
    allowedTabs: ['fanpage'],
  },
];

export interface AdminSecuritySettings {
  adminPin: string;
  requireApproval: boolean;
  adminName?: string;
  adminEmail?: string;
  requireGoogleLoginOnly?: boolean;
}

export const DEFAULT_ADMIN_SETTINGS: AdminSecuritySettings = {
  adminPin: 'admin123',
  requireApproval: true,
  adminName: 'Quản Lý (Admin)',
  adminEmail: 'myphuong2295@gmail.com',
  requireGoogleLoginOnly: false,
};

// Bảo toàn và tự động khôi phục dữ liệu từ localStorage cũ (Vercel / các phiên bản trước)
export function migrateAndPreserveLocalStorage(): {
  foundRecords: PageRecord[];
  foundVias: FullViaItem[];
  foundGroups: GroupRecord[];
} {
  let foundRecords: PageRecord[] = [];
  let foundVias: FullViaItem[] = [];
  let foundGroups: GroupRecord[] = [];

  try {
    const recordKeys = [
      'fanpage_sheets_records_v2',
      'fanpage_sheets_records_v1',
      'fanpage_records',
      'fanpage_data',
      'fanpage_safe_backup_records',
    ];

    for (const key of recordKeys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            foundRecords = parsed;
            // Lưu bản sao an toàn, tuyệt đối không bao giờ xóa
            localStorage.setItem('fanpage_safe_backup_records', raw);
            break;
          }
        } catch {
          // continue
        }
      }
    }

    const viaKeys = [
      'fanpage_full_vias_list_v2',
      'fanpage_full_vias_list_v1',
      'fanpage_vias',
      'fanpage_safe_backup_vias',
    ];

    for (const key of viaKeys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            foundVias = parsed;
            localStorage.setItem('fanpage_safe_backup_vias', raw);
            break;
          }
        } catch {
          // continue
        }
      }
    }

    // Dữ liệu bảng Group do người dùng tự nhập và xóa trên Firestore,
    // xóa bỏ toàn bộ cache / backup cục bộ cũ để không tự động khôi phục lại dòng đã xóa
    const allGroupLegacyKeys = [
      GROUP_RECORDS_BACKUP_KEY,
      'fanpage_group_records_safe_backup_v3',
      'fanpage_group_records_safe_backup_v2',
      'fanpage_group_records_backup_v1',
      'fanpage_group_records',
      'fanpage_groups_list',
      'group_records',
      'fanpage_safe_backup_groups',
    ];
    allGroupLegacyKeys.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });
    foundGroups = [];
  } catch (error) {
    console.error('Lỗi kiểm tra localStorage cũ:', error);
  }

  return { foundRecords, foundVias, foundGroups };
}

// Lưu bản sao dữ liệu Group vào localStorage (chỉ khi có dữ liệu)
export function saveLocalGroupBackup(groups: GroupRecord[]): void {
  try {
    const allGroupLegacyKeys = [
      'fanpage_group_records_safe_backup_v2',
      'fanpage_group_records_backup_v1',
      'fanpage_group_records',
      'fanpage_groups_list',
      'group_records',
      'fanpage_safe_backup_groups',
    ];
    allGroupLegacyKeys.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });

    if (groups && Array.isArray(groups) && groups.length > 0) {
      localStorage.setItem(GROUP_RECORDS_BACKUP_KEY, JSON.stringify(groups));
    } else {
      localStorage.removeItem(GROUP_RECORDS_BACKUP_KEY);
      localStorage.removeItem('fanpage_group_records_safe_backup_v3');
    }
  } catch (e) {
    console.warn('[Storage] Lỗi lưu bản sao lưu groups vào localStorage:', e);
  }
}

// Đọc bản sao an toàn dữ liệu Group từ localStorage
export function getLocalGroupBackup(): GroupRecord[] {
  try {
    const raw = localStorage.getItem(GROUP_RECORDS_BACKUP_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('[Storage] Lỗi đọc bản sao lưu groups từ localStorage:', e);
  }
  return [];
}

// Giữ hàm để tương thích và xóa phiên đăng nhập cũ trong localStorage để bắt buộc đăng nhập
export function clearAllLegacyLocalStorage(): void {
  try {
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem('fanpage_current_user_session_v1');
    localStorage.removeItem('fanpage_current_user_session');
    localStorage.removeItem(GROUP_RECORDS_BACKUP_KEY);
    localStorage.removeItem('fanpage_group_records_safe_backup_v3');
    localStorage.removeItem('fanpage_group_records_safe_backup_v2');
    localStorage.removeItem('fanpage_group_records_backup_v1');
    localStorage.removeItem('fanpage_group_records');
    localStorage.removeItem('fanpage_groups_list');
    localStorage.removeItem('group_records');
    localStorage.removeItem('fanpage_safe_backup_groups');
  } catch (e) {
    console.warn(e);
  }
  console.log('[Storage] Chế độ bảo mật đăng nhập đã kích hoạt.');
}

// User active session in browser tab: Mặc định là GUEST_USER để bắt buộc đăng nhập
export function loadCurrentUserSession(): AppUser {
  try {
    const raw = sessionStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return GUEST_USER;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.isAuthenticated && parsed.id !== 'guest') {
      return parsed;
    }
    return GUEST_USER;
  } catch {
    return GUEST_USER;
  }
}

export function saveCurrentUserSession(user: AppUser): void {
  try {
    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Lỗi khi lưu phiên đăng nhập:', error);
  }
}

export function clearCurrentUserSession(): void {
  try {
    sessionStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch (error) {
    console.error('Lỗi khi xóa phiên đăng nhập:', error);
  }
}

export function getInitialFullViaItems(): FullViaItem[] {
  const map = new Map<string, FullViaItem>();

  INITIAL_PAGE_RECORDS.forEach((r, idx) => {
    const uid = r.viaUid?.trim();
    if (!uid) return;
    if (!map.has(uid)) {
      const parts = r.fullVia ? r.fullVia.split('|') : [];
      map.set(uid, {
        id: `via-seed-${idx + 1}`,
        uid,
        pass: parts[1]?.trim() || 'QuynhFb2024!',
        twoFa: parts[2]?.trim() || 'JBSWY3DPEHPK3PXP',
        staffName: r.staffName || 'Anh Quỳnh',
        note: getCleanBmName(r.bmNote) || 'Via chính nuôi page',
        status: 'active',
        createdAt: '15/09/2026',
        rawFullVia: r.fullVia || `${uid}|${parts[1]?.trim() || 'QuynhFb2024!'}|${parts[2]?.trim() || 'JBSWY3DPEHPK3PXP'}`,
      });
    }
  });

  return Array.from(map.values());
}

export function saveLocalFinanceBackup(finances: MonthlyFinanceRecord[]): void {
  try {
    localStorage.setItem(MONTHLY_FINANCES_BACKUP_KEY, JSON.stringify(finances));
  } catch (err) {
    console.warn('[Storage] Không thể sao lưu dự phòng tài chính:', err);
  }
}

export function clearLocalFinanceBackup(): void {
  try {
    localStorage.removeItem(MONTHLY_FINANCES_BACKUP_KEY);
  } catch (err) {
    console.warn('[Storage] Không thể xóa bộ nhớ đệm tài chính:', err);
  }
}

export function getLocalFinanceBackup(): MonthlyFinanceRecord[] {
  try {
    const raw = localStorage.getItem(MONTHLY_FINANCES_BACKUP_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Tự động loại bỏ hoàn toàn các bản ghi mẫu cũ để đảm bảo Admin tự nhập từ đầu
    const filtered = parsed.filter((rec: MonthlyFinanceRecord) => {
      const isMock =
        rec.revenueItems?.some((r) => r.id?.startsWith('rev-10-') || r.id?.startsWith('rev-09-')) ||
        rec.customExpenses?.some((e) => e.id?.startsWith('exp-10-')) ||
        rec.salaryItems?.some((s) => s.id?.startsWith('sal-10-') || s.id?.startsWith('sal-09-')) ||
        (rec.id === '2026-10' && (rec.totalRevenue === 190000000 || rec.officeCost === 18000000)) ||
        (rec.id === '2026-09' && (rec.totalRevenue === 165000000 || rec.officeCost === 18000000));
      return !isMock;
    });
    return filtered;
  } catch {
    return [];
  }
}

