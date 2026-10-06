import { PageRecord, AppUser, UserAccount, FullViaItem } from '../types';
import { INITIAL_PAGE_RECORDS } from '../data/initialData';

// Storage keys previously used for local storage - retained to purge legacy cache
export const STORAGE_KEY = 'fanpage_sheets_records_v2';
export const USER_STORAGE_KEY = 'fanpage_current_user_session_v2';
export const ACCOUNTS_STORAGE_KEY = 'fanpage_accounts_list_v1';
export const ADMIN_SECURITY_KEY = 'fanpage_admin_security_v1';
export const FULL_VIA_STORAGE_KEY = 'fanpage_full_vias_list_v2';
export const CUSTOM_STAFF_KEY = 'fanpage_custom_staff_v1';

export const DEFAULT_STAFF_MEMBERS = ['Anh Quỳnh', 'Bảo', 'Phương My'];

export const DEFAULT_ADMIN_USER: AppUser = {
  id: 'admin',
  name: 'Quản Lý (Admin)',
  email: 'myphuong2295@gmail.com',
  role: 'admin',
  status: 'approved',
  isAuthenticated: true,
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
} {
  let foundRecords: PageRecord[] = [];
  let foundVias: FullViaItem[] = [];

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
  } catch (error) {
    console.error('Lỗi kiểm tra localStorage cũ:', error);
  }

  return { foundRecords, foundVias };
}

// Giữ hàm để tương thích nhưng tuyệt đối KHÔNG xóa dữ liệu người dùng
export function clearAllLegacyLocalStorage(): void {
  // Không xóa dữ liệu để tránh mất mát dữ liệu cũ của người dùng
  console.log('[Storage] Chế độ bảo toàn dữ liệu đang kích hoạt.');
}

// User active session in browser tab: Mặc định luôn là Quản Lý (Admin) để không bị chặn bởi màn hình đăng nhập
export function loadCurrentUserSession(): AppUser {
  try {
    const raw = sessionStorage.getItem(USER_STORAGE_KEY) || localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return DEFAULT_ADMIN_USER;
    const parsed = JSON.parse(raw);
    return parsed?.name && parsed?.isAuthenticated ? parsed : DEFAULT_ADMIN_USER;
  } catch {
    return DEFAULT_ADMIN_USER;
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
        note: r.bmNote || 'Via chính nuôi page',
        status: 'active',
        createdAt: '15/09/2026',
        rawFullVia: r.fullVia || `${uid}|${parts[1]?.trim() || 'QuynhFb2024!'}|${parts[2]?.trim() || 'JBSWY3DPEHPK3PXP'}`,
      });
    }
  });

  return Array.from(map.values());
}
