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

export type PostingMethod =
  | 'Đăng Tay'
  | 'Tool'
  | 'Hẹn Giờ';

export type InteractionQuality =
  | 'TỐT'
  | 'Bình Thường'
  | 'Kém'
  | 'Mất Tương Tác';

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
}

export interface SheetFilter {
  search: string;
  staffName: string;
  viaUid: string;
  multiPageOnly: boolean;
  errorViaOnly?: boolean; // Lọc các Page có Nick Via bị lỗi
  fixedViaOnly?: boolean; // Lọc các Page có Nick Via đã sửa/thay mới (bôi xanh)
  status: string;
  blockStatus: string;
  likeCountStatus?: string;
  postingMethod: string;
  completionFilter: 'all' | 'completed' | 'in_progress';
}

export type UserRole = 'admin' | 'staff';

export type StaffAccountStatus = 'approved' | 'pending' | 'blocked';

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
}

export interface AppUser {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  status?: StaffAccountStatus;
  isAuthenticated: boolean;
}

export type ViaPageUpdateStatus = 'none' | 'pending' | 'updated';

export interface FullViaItem {
  id: string;
  uid: string;
  pass: string;
  twoFa: string;
  staffName: string; // Tên nhân viên được giao phụ trách
  note?: string; // Ghi chú loại nick, BM, thông tin thêm (dùng chung cho các page của via)
  status?: 'active' | 'checkpoint' | 'dead' | 'error' | 'fixed'; // Trạng thái nick
  isError?: boolean; // Tùy chọn bôi đỏ nếu via lỗi
  isFixed?: boolean; // Ô chọn: Admin đã sửa lỗi và thay via mới -> bôi màu xanh để dễ phân biệt
  sharedNote?: string; // Ghi chú chung cho các page
  createdAt?: string;
  rawFullVia?: string; // UID|PASS|2FA gốc

  // Admin tự cập nhật "Đã có Page" (Màu đỏ) -> Nhân viên update page lên sẽ chuyển sang Màu xanh
  pageUpdateStatus?: ViaPageUpdateStatus; // 'pending' (Đỏ - Admin báo có page), 'updated' (Xanh - Đã update page), 'none' (Trắng - Chưa có page)
  hasAdminAssignedPage?: boolean; // Cờ đánh dấu Admin đã báo có page
  pageAssignedAt?: string; // Thời điểm Admin báo
  pageUpdatedAt?: string; // Thời điểm nhân viên hoàn tất update
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

