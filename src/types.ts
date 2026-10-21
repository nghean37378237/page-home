export type PageStatus =
  | 'Đề Xuất'
  | 'Mất Đề Xuất'
  | 'Đình Chỉ'
  | 'Bị Back';

export type BlockStatus =
  | 'Không Chặn'
  | 'Chặn VN'
  | 'Chặn Bản Quyền'
  | 'Chặn Quốc Tế';

export type LikeCountStatus =
  | 'Đếm Like'
  | 'Bỏ Đếm Like';

export type ProgressStatus =
  | 'Đang làm'
  | 'Không làm';

export type PostingMethod =
  | 'Đăng Tay'
  | 'Tool'
  | 'Hẹn Giờ';

export type InteractionQuality =
  | 'TỐT'
  | 'Bình Thường'
  | 'Kém'
  | 'Mất Tương Tác';

export type ViaTransferStatus =
  | 'none'          // Chưa có ghi chú đổi
  | 'pending'       // 🔴 Cần đổi Via (Via lỗi)
  | 'adding'        // 🟡 Đang add Via
  | 'invited'       // 🔵 Đã gửi lời mời
  | 'waiting'       // 🟣 Chờ duyệt quyền
  | 'completed'     // 🟢 Đã đổi xong
  | 'failed'        // ⚠️ Lỗi không add được
  | 'via_deleted';  // 🗑️ Đã xóa Via khỏi bảng Full Via

export type ViaTransferColor =
  | 'yellow'  // Vàng
  | 'green'   // Xanh lá
  | 'blue'    // Xanh dương
  | 'purple'  // Tím
  | 'red'     // Đỏ
  | 'orange'  // Cam
  | 'gray';   // Xám

export interface ViaTransferPreset {
  key: ViaTransferStatus;
  label: string;
  shortLabel: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  description: string;
}

export const VIA_TRANSFER_PRESETS: Record<ViaTransferStatus, ViaTransferPreset> = {
  none: {
    key: 'none',
    label: 'Bình thường',
    shortLabel: '—',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-600',
    badgeBorder: 'border-slate-300',
    dotColor: 'bg-slate-400',
    description: 'Chưa có ghi chú đổi Via',
  },
  pending: {
    key: 'pending',
    label: 'Cần đổi Via (Via lỗi)',
    shortLabel: 'Cần đổi',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-900',
    badgeBorder: 'border-rose-400',
    dotColor: 'bg-rose-600',
    description: 'Via lỗi, cần chuyển page sang Via khác',
  },
  adding: {
    key: 'adding',
    label: 'Đang add Via',
    shortLabel: 'Đang add',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-950 font-bold',
    badgeBorder: 'border-amber-400 ring-1 ring-amber-300/80',
    dotColor: 'bg-amber-500 animate-pulse',
    description: 'Đang thao tác thêm page vào Via mới',
  },
  invited: {
    key: 'invited',
    label: 'Đã gửi lời mời',
    shortLabel: 'Đã mời',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-950',
    badgeBorder: 'border-sky-400',
    dotColor: 'bg-sky-600',
    description: 'Đã gửi lời mời làm quản trị vào Via mới',
  },
  waiting: {
    key: 'waiting',
    label: 'Chờ duyệt quyền',
    shortLabel: 'Chờ duyệt',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-950',
    badgeBorder: 'border-purple-400',
    dotColor: 'bg-purple-600',
    description: 'Đang chờ Via mới xác nhận quyền truy cập',
  },
  completed: {
    key: 'completed',
    label: 'Đã đổi xong',
    shortLabel: 'Đã xong',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-950 font-bold',
    badgeBorder: 'border-emerald-500 ring-1 ring-emerald-400/80',
    dotColor: 'bg-emerald-600',
    description: 'Đã hoàn tất chuyển Page sang Via mới an toàn',
  },
  failed: {
    key: 'failed',
    label: 'Lỗi không add được',
    shortLabel: 'Lỗi add',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-950',
    badgeBorder: 'border-red-400',
    dotColor: 'bg-red-600',
    description: 'Không thêm được via (bị chặn hoặc lỗi BM)',
  },
  via_deleted: {
    key: 'via_deleted',
    label: 'Đã xóa Via cũ',
    shortLabel: 'Đã xóa Via',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-600',
    badgeBorder: 'border-slate-300',
    dotColor: 'bg-slate-400',
    description: 'Nick Via cũ đã được Admin xóa khỏi bảng Full Via',
  },
};

export const VIA_TRANSFER_COLORS: { key: ViaTransferColor; label: string; bgClass: string; textClass: string; borderClass: string }[] = [
  { key: 'yellow', label: 'Vàng (Đang làm)', bgClass: 'bg-amber-50', textClass: 'text-amber-900', borderClass: 'border-amber-400' },
  { key: 'green', label: 'Xanh lá (Đã xong)', bgClass: 'bg-emerald-50', textClass: 'text-emerald-900', borderClass: 'border-emerald-400' },
  { key: 'blue', label: 'Xanh dương (Đã mời)', bgClass: 'bg-sky-50', textClass: 'text-sky-900', borderClass: 'border-sky-400' },
  { key: 'purple', label: 'Tím (Chờ duyệt)', bgClass: 'bg-purple-50', textClass: 'text-purple-900', borderClass: 'border-purple-400' },
  { key: 'red', label: 'Đỏ (Lỗi / Cần đổi)', bgClass: 'bg-rose-50', textClass: 'text-rose-900', borderClass: 'border-rose-400' },
  { key: 'orange', label: 'Cam (Cảnh báo)', bgClass: 'bg-orange-50', textClass: 'text-orange-900', borderClass: 'border-orange-400' },
  { key: 'gray', label: 'Xám (Ghi chú)', bgClass: 'bg-slate-50', textClass: 'text-slate-800', borderClass: 'border-slate-300' },
];

export interface PageRecord {
  id: string;
  staffName: string; // TÊN NV (Cột B)
  viaUid: string; // Via (Cột C - UID nick Facebook / Via)
  fullVia?: string; // Full Via: UID|PASS|2FA (Cột bảo mật phân quyền theo nhân viên)
  pageName: string; // TÊN PAGE (Cột D)
  pageLink: string; // LINK PAGE (Cột E)
  status: PageStatus; // Trạng Thái (Cột F)
  date: string; // Ngày (Cột G, VD: '15/9' hoặc '14/9')
  blockStatus: BlockStatus; // CHẶN (Cột H, VD: 'Chặn VN')
  likeCountStatus?: LikeCountStatus; // ĐẾM LIKE (Có 2 trạng thái: 'Đếm Like' | 'Bỏ Đếm Like', Mặc định: 'Đếm Like')
  postingMethod: PostingMethod; // ĐĂNG TAY, TOOL (Cột I)
  postingDate?: string; // Ngày chọn Đăng Tay (tự động ghi nhận khi chọn Đăng Tay)
  progressStatus?: ProgressStatus; // TIẾN ĐỘ (Có 2 trạng thái: 'Đang làm' | 'Không làm')
  interaction: InteractionQuality; // TƯƠNG TÁC (Cột J)
  interactionDate?: string; // Ngày Tương Tác (Cột K, tự động nhảy theo ngày hiện tại khi chọn trạng thái cột tương tác)
  bmNote: string; // GHI CHÚ BM (VD: 'B-BM ANH QUYNH')
  
  // Quản lý số lượng bài đăng hôm nay & hoàn thành chưa
  targetPosts: number; // Chỉ tiêu bài đăng / ngày
  actualPosts: number; // Đã đăng hôm nay
  isCompleted: boolean; // Đã hoàn thành đăng bài hôm nay chưa

  // Tình trạng Nick Via cầm Page (Bình thường / Checkpoint / Die / Lỗi / Đã sửa thay via mới)
  isViaError?: boolean;
  viaStatus?: 'active' | 'checkpoint' | 'dead' | 'error' | 'fixed';
  viaErrorNote?: string;
  isViaFixed?: boolean; // Admin đã sửa lỗi và thay via mới -> bôi màu xanh lá để dễ phân biệt
  viaSharedNote?: string; // Ô ghi chú chung cho 2 hay 3 page chung 1 via (chung cho cả via)

  // Ghi chú màu tiến độ đổi Via / xử lý via lỗi của Admin (Yêu cầu mới)
  viaTransferStatus?: ViaTransferStatus; // Trạng thái đổi via: 'none' | 'pending' | 'adding' | 'invited' | 'waiting' | 'completed' | 'failed'
  viaTransferNote?: string; // Ghi chú màu admin note khi đổi page qua via này via khác (VD: 'Đang add via 1000...', 'Đã add xong')
  viaTransferColor?: ViaTransferColor | string; // Màu sắc ghi chú nổi bật (yellow, green, blue, purple, red, orange, gray)
  viaTransferUpdatedAt?: string; // Thời gian cập nhật ghi chú đổi via

  // Đánh dấu đỏ báo cho nhân viên biết vừa có Via & Page mới được chuyển giao sang
  isNewlyTransferred?: boolean;
  newlyTransferredAt?: string;
}

export interface SheetFilter {
  search: string;
  staffName: string;
  viaUid: string;
  bmFilter?: string; // Lọc theo Ghi chú BM
  multiPageOnly: boolean;
  errorViaOnly?: boolean; // Lọc các Page có Nick Via bị lỗi
  fixedViaOnly?: boolean; // Lọc các Page có Nick Via đã sửa/thay mới (bôi xanh)
  status: string;
  blockStatus: string;
  likeCountStatus?: string;
  postingMethod: string;
  completionFilter: 'all' | 'completed' | 'in_progress';
  viaTransferFilter?: string; // Lọc theo tiến độ đổi via ('all' | 'adding' | 'completed' | 'pending' | 'invited' | 'has_note')
}

export type UserRole = 'admin' | 'staff';

export type StaffAccountStatus = 'approved' | 'pending' | 'blocked';

export type TabKey =
  | 'fanpage'
  | 'group'
  | 'proxy'
  | 'fullvia'
  | 'staff_management'
  | 'shared_accounts'
  | 'revenue'
  | 'staff_info'
  | 'image_studio'
  | 'view_stats'
  | 'web_publish';

export interface TabPermissionConfig {
  id: TabKey;
  tabNumber: number;
  label: string;
  shortLabel: string;
  badgeName: string;
  color: string;
  description: string;
}

export const ALL_TAB_KEYS: TabKey[] = [
  'fanpage',
  'group',
  'proxy',
  'fullvia',
  'staff_management',
  'shared_accounts',
  'revenue',
  'staff_info',
  'image_studio',
  'view_stats',
  'web_publish',
];

// Các bảng phân quyền cho nhân viên (Bảng 5 Quản Trị NV & Bảng 7 Quản Lý Doanh Thu chỉ dành riêng cho Admin quản lý)
export const STAFF_ASSIGNABLE_TABS: TabKey[] = [
  'fanpage',
  'group',
  'proxy',
  'fullvia',
  'shared_accounts',
  'staff_info',
  'image_studio',
  'view_stats',
  'web_publish',
];

export const TAB_DEFINITIONS: Record<TabKey, TabPermissionConfig> = {
  fanpage: {
    id: 'fanpage',
    tabNumber: 1,
    label: 'Bảng 1: Fanpage',
    shortLabel: 'B1 Fanpage',
    badgeName: 'Page',
    color: 'emerald',
    description: 'Quản lý Fanpage và tiến độ đăng bài hàng ngày',
  },
  group: {
    id: 'group',
    tabNumber: 2,
    label: 'Bảng 2: Group',
    shortLabel: 'B2 Group',
    badgeName: 'Group',
    color: 'red',
    description: 'Quản lý hội nhóm Facebook và trạng thái tham gia',
  },
  proxy: {
    id: 'proxy',
    tabNumber: 3,
    label: 'Bảng 3: Proxy',
    shortLabel: 'B3 Proxy',
    badgeName: 'Proxy',
    color: 'teal',
    description: 'Quản lý danh sách Proxy và IP nuôi Via',
  },
  fullvia: {
    id: 'fullvia',
    tabNumber: 4,
    label: 'Bảng 4: Full Via',
    shortLabel: 'B4 Full Via',
    badgeName: 'Via',
    color: 'indigo',
    description: 'Quản lý nick Full Via (UID|PASS|2FA)',
  },
  staff_management: {
    id: 'staff_management',
    tabNumber: 5,
    label: 'Bảng 5: Quản Trị Nhân Viên',
    shortLabel: 'B5 Quản Trị NV',
    badgeName: 'Quản Trị NV',
    color: 'blue',
    description: 'Bảng quản trị nhân sự, phân quyền bảng và bảo mật hệ thống (Chỉ Admin)',
  },
  shared_accounts: {
    id: 'shared_accounts',
    tabNumber: 6,
    label: 'Bảng 6: Web Dùng Chung',
    shortLabel: 'B6 Web Chung',
    badgeName: 'TK Web',
    color: 'purple',
    description: 'Tài khoản web công cụ dùng chung (Canva, ChatGPT, CapCut...)',
  },
  revenue: {
    id: 'revenue',
    tabNumber: 7,
    label: 'Bảng 7: Doanh Thu & Thu Chi',
    shortLabel: 'B7 Doanh Thu',
    badgeName: 'Doanh Thu',
    color: 'amber',
    description: 'Bảng quản lý doanh thu, tổng tiền về, chi phí văn phòng, điện, nước và lương nhân viên từng tháng (Chỉ Admin)',
  },
  staff_info: {
    id: 'staff_info',
    tabNumber: 8,
    label: 'Thông Tin Nhân Viên',
    shortLabel: 'Thông Tin NV',
    badgeName: 'Hồ Sơ & Lương',
    color: 'blue',
    description: 'Xem thông tin cá nhân, ngày sinh, lương theo ngày công, doanh thu và tổng thu nhập từ Bảng 7',
  },
  image_studio: {
    id: 'image_studio',
    tabNumber: 9,
    label: 'Bảng 9: Làm Ảnh & Ghép Ảnh',
    shortLabel: 'B9 Làm Ảnh',
    badgeName: 'Làm Ảnh',
    color: 'rose',
    description: 'Xưởng ghép ảnh chuyên nghiệp đa bố cục (lamanh.vercel.app), chia việc cho nhân viên làm ảnh và xuất ảnh HD.',
  },
  view_stats: {
    id: 'view_stats',
    tabNumber: 10,
    label: 'Bảng 10: Thống Kê View',
    shortLabel: 'B10 Thống Kê View',
    badgeName: 'TK View',
    color: 'cyan',
    description: 'Bảng thống kê lượt xem Realtime, Top 10 bài viết và xếp hạng mã nhân viên lấy trực tiếp từ web celeb24h.com',
  },
  web_publish: {
    id: 'web_publish',
    tabNumber: 11,
    label: 'Bảng 11: Viết Bài & Đẩy Web',
    shortLabel: 'B11 Viết Bài Web',
    badgeName: 'Viết Bài',
    color: 'emerald',
    description: 'WebPublish Studio — Soạn thảo bài viết chuẩn SEO & tự động đẩy bài trực tiếp lên WordPress (celeb24h.com) kèm mã nhân viên.',
  },
};

// --- Các kiểu dữ liệu phục vụ Bảng 9: Làm Ảnh & Ghép Ảnh ---
export interface CollageSlot {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  shape?: 'rect' | 'circle';
  zIndex?: number;
  borderWidth?: number;
  borderColor?: string;
  badge?: {
    text: string;
    bg?: string;
    textColor?: string;
    style?: 'rect' | 'pill';
    position?: string;
  };
}

export interface StoryHeaderConfig {
  enabled?: boolean;
  heightPercent: number;
  title?: string;
  subtitle?: string;
  bgColor?: string;
  titleColor?: string;
  subtitleColor?: string;
}

export interface CollagePreset {
  id: string;
  name: string;
  photoCount: number;
  category: string;
  recommendedRatio?: string;
  hasCircleAccent?: boolean;
  storyHeader?: StoryHeaderConfig;
  dividerBadge?: {
    enabled?: boolean;
    text?: string;
    positionYPercent?: number;
    textColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    showDividerLine?: boolean;
    dividerLineColor?: string;
    dividerLineWidth?: number;
  };
  slots: CollageSlot[];
}

export interface SlotTransform {
  scale: number;
  panX: number;
  panY: number;
  rotate: number;
}

export type TaskStatus = 'pending' | 'in_progress' | 'review' | 'completed';

export interface ImageTaskItem {
  id: string;
  title: string; // Tên bài / chủ đề làm ảnh
  pageName?: string; // Thuộc Page nào (nếu có)
  assignedStaff: string; // Tên nhân viên làm ảnh được giao phụ trách
  deadline?: string; // Hạn chót (ngày)
  presetId?: string; // Gợi ý mẫu ghép (id preset)
  aspectRatio?: string; // Tỷ lệ yêu cầu ('1:1', '4:5', '9:16', '3:4', '16:9')
  referenceNote?: string; // Yêu cầu nội dung làm ảnh
  sampleImages?: string[]; // Ảnh nguồn / link tham khảo
  resultImageUrl?: string; // Ảnh thành phẩm đã ghép xong
  status: TaskStatus; // Trạng thái bài
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface UserAccount {
  id: string;
  username: string; // Tên hiển thị / nhân viên
  email?: string; // Email Google liên kết / nội bộ
  role: UserRole;
  status: StaffAccountStatus; // 'approved' (đã duyệt) | 'pending' (chờ admin duyệt) | 'blocked' (tạm khóa)
  pin: string; // Mã PIN / mật khẩu đăng nhập
  createdAt: string; // Ngày đăng ký / tạo
  approvedAt?: string; // Ngày duyệt
  requestNote?: string; // Lời nhắn xin cấp quyền
  adminNote?: string; // Ghi chú của Admin
  allowedTabs?: TabKey[]; // Danh sách Bảng/Tab được phân quyền thấy: ['fanpage', 'fullvia', ...]

  // Phân quyền Mã nhân viên thống kê WordPress (celeb24h.com)
  wpEmployeeCode?: string; // Mã nhân viên trên web (VD: 'M2001', 'H2000', 'H0088', 'A0005', 'A0006', 'H0082'...)
  wpAllowedEmployeeCodes?: string[]; // Phạm vi mã nhân viên được phép xem: ['MINE_AND_SITE'] (mặc định như web: mã cá nhân + toàn web), ['MINE_ONLY'] (chỉ mã cá nhân), ['ALL'] (tất cả mã & bảng xếp hạng), hoặc danh sách mã cụ thể

  // Thông tin nhân sự hồ sơ
  fullName?: string; // Họ và tên đầy đủ (VD: CHU THỊ HUYỀN, VÕ THỊ TRÀ LY...)
  contractType?: EmployeeContractType; // 'official' | 'probation'
  dateOfBirth?: string; // Ngày tháng năm sinh
  citizenId?: string; // Số CCCD / CMND
  startDate?: string; // Ngày bắt đầu đi làm
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  isProfileVisibleToStaff?: boolean; // true = Admin tích cho hiện thông tin hồ sơ nhân sự ở Bảng 8 cho nhân viên đó xem
}

export const DEFAULT_WP_EMPLOYEE_OPTIONS: { code: string; label: string; staffHint: string }[] = [
  { code: 'M2001', label: 'M2001 · Ms Ly', staffHint: 'MS.LY' },
  { code: 'H2000', label: 'H2000 · Ms Huyen', staffHint: 'MS.HUYEN' },
  { code: 'H0088', label: 'H0088 · Hiep MS', staffHint: 'MSHIEP' },
  { code: 'A0005', label: 'A0005 · Ms Nhi', staffHint: 'MS.NHI' },
  { code: 'A0006', label: 'A0006 · Mr Google', staffHint: 'Quản Lý (Admin)' },
  { code: 'H0082', label: 'H0082 · admin', staffHint: 'Admin' },
];

export function resolveAccountWpEmployeeCode(
  acc?: Partial<UserAccount> | null,
  nameHint?: string
): string {
  const explicit = (acc?.wpEmployeeCode || '').trim();
  if (explicit === 'NONE') return '';
  if (explicit) return explicit;

  const rawName = (acc?.username || nameHint || '').trim().toLowerCase();
  const rawFullName = (acc?.fullName || nameHint || '').trim().toLowerCase();
  const rawEmail = (acc?.email || '').trim().toLowerCase();

  if (
    rawName === 'ms.ly' ||
    rawName === 'ms ly' ||
    rawName === 'ly' ||
    rawName.includes('trà ly') ||
    rawName.includes('tra ly') ||
    rawFullName.includes('trà ly') ||
    rawFullName.includes('tra ly') ||
    rawEmail === 'ly@gmail.com' ||
    rawEmail === 'nghean3737@gmail.com'
  ) {
    return 'M2001';
  }
  if (
    rawName === 'ms.huyen' ||
    rawName === 'ms huyen' ||
    rawName === 'huyen' ||
    rawName.includes('thị huyền') ||
    rawName.includes('thi huyen') ||
    rawFullName.includes('thị huyền') ||
    rawFullName.includes('thi huyen') ||
    rawEmail === 'huyen@gmail.com' ||
    rawEmail === 'xunghe3737@gmail.com'
  ) {
    return 'H2000';
  }
  if (
    rawName === 'mshiep' ||
    rawName === 'ms.hiep' ||
    rawName === 'ms hiep' ||
    rawName === 'hiep' ||
    rawName === 'hiep ms' ||
    rawName.includes('thị hiệp') ||
    rawName.includes('thi hiep') ||
    rawFullName.includes('thị hiệp') ||
    rawFullName.includes('thi hiep') ||
    rawEmail === 'hiep@gmail.com' ||
    rawEmail === 'nghean@gmail.com'
  ) {
    return 'H0088';
  }
  if (
    rawName === 'ms.nhi' ||
    rawName === 'ms nhi' ||
    rawName === 'nhi' ||
    rawFullName.includes('nhi') ||
    rawEmail === 'ms.nhi@gmail.com' ||
    rawEmail === 'pronhi@gmail.com'
  ) {
    return 'A0005';
  }
  if (
    acc?.role === 'admin' ||
    rawName.includes('admin') ||
    rawName === 'adgoole' ||
    rawName === 'mr google' ||
    rawEmail === 'cualokhachsan@gmail.com' ||
    rawEmail === 'anyen7910@gmail.com'
  ) {
    return 'A0006';
  }
  return '';
}

export interface AppUser {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  status?: StaffAccountStatus;
  isAuthenticated: boolean;
  allowedTabs?: TabKey[]; // Danh sách Bảng/Tab được cấp quyền
  wpEmployeeCode?: string;
  wpAllowedEmployeeCodes?: string[];
}

export type ViaPageUpdateStatus = 'none' | 'pending' | 'updated';

export type ViaAdminReportStatus =
  | 'None'
  | 'Live'
  | 'VHH'
  | '282'
  | '956'
  | 'Hạn Chế'
  | 'SDT'
  | 'Selfie'
  | 'Email code';
export const VIA_ADMIN_REPORT_OPTIONS: ViaAdminReportStatus[] = [
  'None',
  'VHH',
  '282',
  '956',
  'Hạn Chế',
  'Live',
  'SDT',
  'Selfie',
  'Email code',
];

export interface FullViaItem {
  id: string;
  uid: string;
  pass: string;
  twoFa: string;
  staffName: string; // Tên nhân viên được giao phụ trách
  note?: string; // Ghi chú loại nick, BM, thông tin thêm (dùng chung cho các page của via)
  status?: 'active' | 'checkpoint' | 'dead' | 'error' | 'fixed'; // Trạng thái nick
  adminReportStatus?: ViaAdminReportStatus; // Cột Báo Admin: 'Live' | 'VHH' | 'SDT' | 'Selfie' | 'Email code'
  isError?: boolean; // Tùy chọn bôi đỏ nếu via lỗi
  isFixed?: boolean; // Ô chọn: Admin đã sửa lỗi và thay via mới -> bôi màu xanh để dễ phân biệt
  sharedNote?: string; // Ghi chú chung cho các page
  createdAt?: string;
  rawFullVia?: string; // UID|PASS|2FA gốc

  // Admin cập nhật "Admin đã thêm Page" (Màu đỏ để NV biết) | "Có page từ đầu" (Màu xanh) | "Chưa có page" (Trắng)
  pageUpdateStatus?: ViaPageUpdateStatus; // 'pending' (Đỏ - Admin đã thêm page / mới bàn giao để NV biết), 'updated' (Xanh - Có page từ đầu / Đã update page), 'none' (Trắng - Chưa có page)
  hasAdminAssignedPage?: boolean; // Cờ đánh dấu Admin đã thêm page
  pageAssignedAt?: string; // Thời điểm Admin thêm page / bàn giao
  pageUpdatedAt?: string; // Thời điểm hoàn tất update page
  isNewlyTransferred?: boolean; // Đánh dấu đỏ báo nhân viên mới nhận Via & Page mới chuyển giao
}

export interface SharedAccount {
  id: string;
  websiteName: string; // Tên Trang Web (VD: ChatGPT Plus, Canva Pro, CapCut, v.v...)
  websiteUrl?: string; // Link truy cập trang web (nếu có)
  username: string; // Tên đăng nhập (Email / Tài khoản)
  password: string; // Mật khẩu (Pass)
  twoFa?: string; // Mã 2FA hoặc Secret Key (nếu có)
  assignedStaff: string[]; // Danh sách nhân viên được phép thấy và dùng, hoặc ['ALL'] cho tất cả nhân viên
  note?: string; // Ghi chú thêm
  createdAt?: string; // Ngày tạo
  updatedAt?: string; // Ngày cập nhật
}

export type GroupJoinStatus = 'Đã Jon' | 'Jon chờ duyệt' | 'Chưa';
export const GROUP_JOIN_STATUS_OPTIONS: GroupJoinStatus[] = ['Đã Jon', 'Jon chờ duyệt', 'Chưa'];

export type GroupInteractionStatus =
  | 'Đang lên tương tác'
  | 'Có tương tác'
  | 'Tương tác ổn'
  | 'Tương tác vừa'
  | 'Không có tương tác';
export const GROUP_INTERACTION_STATUS_OPTIONS: GroupInteractionStatus[] = [
  'Đang lên tương tác',
  'Có tương tác',
  'Tương tác ổn',
  'Tương tác vừa',
  'Không có tương tác',
];

export interface GroupRecord {
  id: string;
  groupId: string; // Mã nhóm duy nhất để gộp ô các Via trong cùng 1 Group
  groupName: string; // Cột E: NHÓM (Chữ màu đỏ, VD: 'Beautifull World ✅', 'Movies World ✅', 'NETFLIX Highlight Movies')
  groupLink: string; // Cột D: GROUP (Link nhóm Facebook: https://www.facebook.com/groups/...)
  uid: string; // Cột B: UID nick Facebook (VD: '100060665184656')
  viaName: string; // Cột C: TÊN VIA (VD: 'Lucas Santos', 'Rupesh Yadav'...)
  joinStatus?: GroupJoinStatus; // Cột TRẠNG THÁI: 'Đã Jon' | 'Jon chờ duyệt' | 'Chưa'
  interactionStatus?: GroupInteractionStatus; // Ô chọn màu / ghi chú tương tác: 'Đang lên tương tác' | 'Có tương tác' | 'Tương tác ổn' | 'Tương tác vừa' | 'Không có tương tác'
  interactionDate?: string; // Cột NGÀY TT: Tự động nhảy theo ngày hiện tại (VD: '20/10') khi chọn tương tác
  note: string; // Cột F: Ghi Chú (VD: 'vhh', 'hạn chế', 'đình chỉ'...)
  isHighlighted?: boolean; // Ô bôi xanh lá (dòng via chính / via duyệt theo yêu cầu hình ảnh)
  staffName: string; // TÊN NV (Quản lý phân quyền tài khoản tương tự như Page)
  createdAt?: string;
  updatedAt?: string;
}

export const GROUP_NOTE_OPTIONS = ['VHH', '282', '956', 'Hạn Chế'] as const;
export type GroupNoteType = (typeof GROUP_NOTE_OPTIONS)[number];

export interface GroupFilter {
  search: string;
  staffName: string;
  noteFilter?: string; // 'ALL' | 'VHH' | '282' | '956' | 'Hạn Chế' | 'HAS_NOTE'
  highlightedOnly: boolean;
  hasNoteOnly: boolean;
}

export type ProxyProtocol = 'HTTP' | 'HTTPS' | 'SOCKS5';
export type ProxyStatus = 'active' | 'die' | 'expired' | 'checking';

export interface ProxyItem {
  id: string;
  ip: string; // IP host (VD: 103.145.22.10)
  port: string; // Port (VD: 8080, 1080)
  username?: string; // User xác thực (nếu có)
  password?: string; // Pass xác thực (nếu có)
  protocol: ProxyProtocol; // HTTP / HTTPS / SOCKS5
  fullProxy: string; // Chuỗi chuẩn: IP:Port:User:Pass hoặc IP:Port
  location?: string; // Quốc gia / Vị trí (VN, US, SG, ...)
  provider?: string; // Nhà cung cấp (ProxyNo1, Tinsoft, Viettel, FPT...)
  assignedStaff: string[]; // Nhân viên phụ trách (hoặc ['ALL'] cho tất cả)
  assignedViaUids?: string[]; // Danh sách UID nick Facebook đang dùng
  status: ProxyStatus; // 'active' (Sống) | 'die' (Chết) | 'expired' (Hết hạn)
  expireDate?: string; // Ngày hết hạn (VD: 30/10/2026)
  note?: string; // Ghi chú (Proxy tĩnh, nuôi Via chính...)
  isRotating?: boolean; // Cờ proxy xoay đổi IP
  rotateUrl?: string; // Link API đổi IP nếu là proxy xoay
  resetUrl?: string; // Link Reset Proxy (VD: http://192.168.1.27/reset?proxy=4000 hoặc link API đổi IP)
  lastResetTime?: number; // Thời điểm bấm reset gần nhất
  lastChecked?: string; // Thời gian kiểm tra live
  createdAt?: string;
  updatedAt?: string;
}

export interface ProxyFilter {
  search: string;
  staffName: string;
  status: string;
  protocol: string;
  location: string;
}

// ==========================================
// 7. QUẢN LÝ DOANH THU & THU CHI HÀNG THÁNG (CHỈ ADMIN)
// ==========================================

export interface RevenueItem {
  id: string;
  sourceName: string; // Tên nguồn thu (VD: Ads Facebook, Tiền Booking Page, Tiền Kéo Tương Tác Group, Hợp đồng đối tác...)
  amount: number; // Số tiền (VNĐ)
  receivedDate?: string; // Ngày nhận tiền (VD: 15/10/2026)
  payerName?: string; // Khách hàng / Đối tác chi trả
  note?: string; // Ghi chú thêm
  createdAt?: string;
}

export type EmployeeContractType = 'official' | 'probation'; // 'Chính Thức' | 'Thử Việc'

export interface StaffSalaryItem {
  id: string;
  staffName: string; // Tên nhân viên

  // Thông tin nhân sự (Yêu cầu mới: Ngày sinh, CCCD, Ngày đi làm)
  dateOfBirth?: string; // Ngày tháng năm sinh (VD: 15/08/1998)
  citizenId?: string; // Số CCCD / CMND (VD: 001298012345)
  startDate?: string; // Ngày bắt đầu đi làm (VD: 01/06/2023)

  // 1. Chế độ lương & Mức lương
  contractType?: EmployeeContractType; // 'official' (Chính thức) | 'probation' (Thử việc)
  probationSalary?: number; // Mức lương thử việc (VNĐ/tháng, VD: 6.000.000)
  officialSalary?: number; // Mức lương chính thức (VNĐ/tháng, VD: 9.000.000)
  baseSalary: number; // Mức lương cơ bản áp dụng (lấy theo thử việc/chính thức hoặc nhập trực tiếp)

  // 2. Ngày công làm việc thực tế
  standardWorkingDays?: number; // Ngày công chuẩn trong tháng (mặc định 26 ngày công)
  actualWorkingDays?: number; // Ngày công đi làm thực tế (VD: 24 công, 26 công, 22.5 công)
  salaryByWorkingDays?: number; // Tiền lương theo ngày công = (baseSalary / standardWorkingDays) * actualWorkingDays

  // 3. Thông tin tài khoản ngân hàng của nhân viên
  bankName?: string; // Tên ngân hàng (MB Bank, Techcombank, Vietcombank, VPBank, TPBank...)
  bankAccountNumber?: string; // Số tài khoản ngân hàng (VD: 0389123456789)
  bankAccountHolder?: string; // Tên chủ tài khoản (VD: NGUYEN VAN A)

  // 4. Thưởng KPI tiền về doanh thu do nhân viên đó làm được (5%, 10%)
  revenueGenerated?: number; // Doanh thu tiền về nhân viên đó mang lại (VNĐ)
  revenueSourceName?: string; // Nguồn/dự án/khách hàng mang tiền về (tùy chọn)
  kpiRate?: number; // Tỷ lệ thưởng KPI doanh thu % (5%, 10% hoặc tùy chỉnh)
  kpiBonus: number; // Tiền thưởng KPI doanh thu = (revenueGenerated * kpiRate / 100)
  otherBonus?: number; // Thưởng chuyên cần, thưởng thêm khác (nếu có)

  // 4b. Hỗ trợ tiền mạng, điện cho nhân viên làm Online (Yêu cầu 5: cộng vào lương thực nhận cho NV online)
  isOnlineStaff?: boolean; // Tích chọn nếu là nhân viên làm Online / Từ xa
  onlineSupportAllowance?: number; // Tiền hỗ trợ mạng, điện cho nhân viên làm online (VNĐ, VD: 300.000, 500.000)

  // 5. Khấu trừ / Phạt / Tạm ứng
  deduction: number; // Phạt / Trừ lương / Tạm ứng (VNĐ)

  // 6. Tổng thực nhận
  actualSalary: number; // Tổng thực nhận = salaryByWorkingDays + kpiBonus + (onlineSupportAllowance || 0) + (otherBonus || 0) - deduction

  // Tài khoản đăng nhập liên kết (VD: 'MS.HUYEN', 'MS.LY', 'MS.HIEN', 'MSHIEP'...)
  accountUsername?: string;

  // 7. Quyền hiển thị cho nhân viên (Yêu cầu mới: Admin tích chọn thì mới cho hiện ở Tab Thông Tin Nhân Viên, bỏ tích thì Lương và Doanh thu bỏ trống)
  isVisibleToStaff?: boolean; // true = Admin đã tích cho hiện Lương & Doanh thu | false / undefined = Bỏ tích, ẩn số tiền Lương & Doanh thu
  isProfileVisibleToStaff?: boolean; // true = Admin tích cho hiện thông tin Hồ Sơ Nhân Sự (Họ tên, Ngày sinh, CCCD, Ngày đi làm, STK) ở ô Hồ Sơ Nhân Sự cho nhân viên xem

  isPaid: boolean; // Đã thanh toán / Chưa thanh toán
  paidDate?: string; // Ngày chi trả
  note?: string; // Ghi chú (VD: Lương chính thức 25 công + KPI 10% Ads Page X...)
}

export function normalizeVietnameseText(input?: string): string {
  if (!input) return '';
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function isSpecialNonStaffIdentity(norm?: string): boolean {
  if (!norm) return false;
  return (
    norm.includes('admin') ||
    norm.includes('quan ly') ||
    norm.includes('kho cho') ||
    norm.includes('chua gan')
  );
}

export function extractStaffGivenToken(name?: string): string {
  const norm = normalizeVietnameseText(name);
  if (!norm || isSpecialNonStaffIdentity(norm)) return '';
  // Nếu dạng MS.HUYEN, MS.LY, MR.BAO, MSHIEP, MS HIEP...
  const cleanedPrefix = norm
    .replace(/^(ms|mr|mrs|miss)[\.\s_\-]*/i, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
  const parts = cleanedPrefix.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  return parts[parts.length - 1];
}

export function areStaffNamesEquivalent(name1?: string, name2?: string): boolean {
  const n1 = normalizeVietnameseText(name1);
  const n2 = normalizeVietnameseText(name2);
  if (!n1 || !n2) return false;

  const isSpec1 = isSpecialNonStaffIdentity(n1);
  const isSpec2 = isSpecialNonStaffIdentity(n2);
  if (isSpec1 || isSpec2) {
    return n1 === n2;
  }

  if (n1 === n2) return true;

  const t1 = extractStaffGivenToken(n1);
  const t2 = extractStaffGivenToken(n2);
  if (t1 && t2 && t1.length >= 2 && t1 === t2) {
    return true;
  }

  return false;
}

export function isSameStaffIdentity(
  nameA?: string,
  nameB?: string,
  acc?: Partial<UserAccount> | null,
  sal?: Partial<StaffSalaryItem> | null
): boolean {
  if (!nameA && !nameB) return false;

  // 1. So khớp trực tiếp 2 tên truyền vào (nameA vs nameB)
  if (nameA && nameB && areStaffNamesEquivalent(nameA, nameB)) {
    return true;
  }

  // 2. Tách biệt tuyệt đối tập tên của Bên A và Bên B (không bao giờ trộn chéo acc/sal sang bên kia)
  const sideA = new Set<string>();
  const sideB = new Set<string>();

  if (nameA?.trim()) sideA.add(nameA.trim());
  if (nameB?.trim()) sideB.add(nameB.trim());

  if (acc) {
    const accUser = acc.username?.trim();
    // Chỉ dùng fullName của tài khoản nếu nó không bị lệch với mã username (VD: MS.HUYEN <-> CHU THỊ HUYỀN)
    const accFull =
      acc.fullName?.trim() &&
      (!accUser || !extractStaffGivenToken(accUser) || areStaffNamesEquivalent(accUser, acc.fullName))
        ? acc.fullName.trim()
        : undefined;

    const accMatchesA =
      Boolean(nameA) &&
      (areStaffNamesEquivalent(nameA, accUser) || (Boolean(accFull) && areStaffNamesEquivalent(nameA, accFull)));
    const accMatchesB =
      Boolean(nameB) &&
      (areStaffNamesEquivalent(nameB, accUser) || (Boolean(accFull) && areStaffNamesEquivalent(nameB, accFull)));

    if (accMatchesA && accMatchesB) return true;
    if (accMatchesA && !accMatchesB) {
      if (accUser) sideA.add(accUser);
      if (accFull) sideA.add(accFull);
    } else if (accMatchesB && !accMatchesA) {
      if (accUser) sideB.add(accUser);
      if (accFull) sideB.add(accFull);
    }
  }

  if (sal) {
    const salName = sal.staffName?.trim();
    // Chỉ dùng accountUsername của bảng lương nếu hợp lệ với họ tên nhân viên trong bảng lương
    const salAccUser =
      sal.accountUsername?.trim() &&
      (!salName || !extractStaffGivenToken(salName) || areStaffNamesEquivalent(salName, sal.accountUsername))
        ? sal.accountUsername.trim()
        : undefined;

    const salMatchesA =
      Boolean(nameA) &&
      (areStaffNamesEquivalent(nameA, salName) ||
        (Boolean(salAccUser) && areStaffNamesEquivalent(nameA, salAccUser)));
    const salMatchesB =
      Boolean(nameB) &&
      (areStaffNamesEquivalent(nameB, salName) ||
        (Boolean(salAccUser) && areStaffNamesEquivalent(nameB, salAccUser)));

    if (salMatchesA && salMatchesB) return true;
    if (salMatchesA && !salMatchesB) {
      if (salName) sideA.add(salName);
      if (salAccUser) sideA.add(salAccUser);
    } else if (salMatchesB && !salMatchesA) {
      if (salName) sideB.add(salName);
      if (salAccUser) sideB.add(salAccUser);
    }
  }

  for (const a of sideA) {
    for (const b of sideB) {
      if (areStaffNamesEquivalent(a, b)) {
        return true;
      }
    }
  }

  return false;
}

export type ExpenseType = 'unexpected' | 'fixed' | 'tools' | 'other'; // 'Chi phí ngoài ý muốn / Phát sinh' | 'Cố định' | 'Công cụ' | 'Khác'

export interface CustomExpenseItem {
  id: string;
  name: string; // Tên khoản chi (VD: Sửa máy tính hỏng, Mua switch mạng, Mua Tool nuôi nick, Bàn ghế mới,...)
  expenseType?: ExpenseType; // Phân loại: 'unexpected' (Ngoài ý muốn / Phát sinh) | 'fixed' (Cố định tự thêm) | 'tools' | 'other'
  category?: 'office' | 'utility' | 'tools' | 'proxy' | 'hardware' | 'unexpected' | 'other';
  amount: number; // Số tiền (VNĐ)
  paidDate?: string; // Ngày chi
  payer?: string; // Người chi / Người duyệt
  paymentMethod?: 'transfer' | 'cash'; // 'Chuyển khoản' | 'Tiền mặt'
  note?: string; // Lý do chi / Ghi chú phát sinh ngoài ý muốn
  createdAt?: string;
}

export interface MonthlyFinanceRecord {
  id: string; // ID tháng (VD: '2026-10', '2026-09')
  monthKey: string; // '2026-10'
  month: number; // 10
  year: number; // 2026
  title?: string; // "Tháng 10/2026"

  // 1. DOANH THU / TỔNG TIỀN VỀ (Admin nhập)
  manualTotalRevenue?: number; // Cho phép Admin nhập trực tiếp nếu không muốn chia nhỏ
  revenueItems: RevenueItem[]; // Danh sách các khoản tiền về chi tiết
  totalRevenue: number; // Tổng tiền về = sum(revenueItems) hoặc manualTotalRevenue

  // 2. CHI PHÍ VĂN PHÒNG, ĐIỆN, NƯỚC (Admin nhập)
  officeCost: number; // Chi phí văn phòng (tiền thuê mặt bằng, bảo vệ, văn phòng phẩm...)
  officeCostNote?: string;
  electricityCost: number; // Tiền điện
  electricityCostNote?: string;
  waterCost: number; // Tiền nước
  waterCostNote?: string;
  internetCost?: number; // Tiền mạng Internet & hạ tầng
  internetCostNote?: string;
  otherCosts?: number; // Chi phí phát sinh khác
  otherCostsNote?: string;
  customExpenses?: CustomExpenseItem[]; // Danh sách các khoản chi phát sinh khác

  // 3. TIỀN LƯƠNG NHÂN VIÊN
  salaryItems: StaffSalaryItem[]; // Bảng lương chi tiết từng nhân viên
  totalSalary: number; // Tổng tiền lương nhân viên = sum(actualSalary)

  // 4. TỔNG KẾT TÀI CHÍNH & LỢI NHUẬN
  totalExpenses: number; // Tổng chi phí = officeCost + electricityCost + waterCost + internetCost + otherCosts + totalSalary + customExpenses
  netProfit: number; // Lợi nhuận ròng = totalRevenue - totalExpenses
  profitMargin?: number; // Tỷ suất sinh lời (%) = (netProfit / totalRevenue) * 100
  status?: 'profitable' | 'loss' | 'break_even'; // Có lãi / Lỗ / Hòa vốn
  adminSummaryNote?: string; // Nhận xét, tổng kết của Admin cho tháng
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

// ==========================================
// 8. KHO CHỜ CỦA ADMIN (CHƯA NHÂN VIÊN NÀO DÙNG - BAO GỒM VIA & VIA + PAGE CẦM)
// ==========================================
export const ADMIN_WAITING_POOL = 'Kho Chờ Admin';

export const isAdminWaitingPool = (staffName?: string): boolean => {
  const s = (staffName || '').trim().toLowerCase();
  return (
    s === 'kho chờ admin' ||
    s === 'kho cho admin' ||
    s === 'kho chờ' ||
    s === 'kho cho' ||
    s === 'chưa gán' ||
    s === 'chua gan'
  );
};
