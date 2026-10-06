import * as XLSX from 'xlsx';
import { PageRecord, FullViaItem, GroupRecord, ProxyItem } from '../types';

export const SAMPLE_FANPAGE_ROWS = [
  {
    'TÊN NV': 'Anh Quỳnh',
    'Via (UID)': '100058675316160',
    'TÊN PAGE': 'Action Overload Zone',
    'LINK PAGE': 'https://www.facebook.com/profile.php?id=100058675316160',
    'Trạng Thái': 'Đề Xuất',
    'Ngày': '15/9',
    'CHẶN': 'Không Chặn',
    'ĐẾM LIKE': 'Đếm Like',
    'ĐĂNG TAY, TOOL': 'Đăng Tay',
    'TƯƠNG TÁC': 'TỐT',
    'NGÀY TT': '15/9',
    'GHI CHÚ BM': 'B-BM ANH QUYNH',
    'Chỉ tiêu bài': 3,
    'Đã đăng': 3,
    'Full Via (Tùy chọn)': '100058675316160|QuynhFb2024!|JBSWY3DPEHPK3PXP',
  },
  {
    'TÊN NV': 'Anh Quỳnh',
    'Via (UID)': '100058675316160',
    'TÊN PAGE': 'Movie Guild Hub',
    'LINK PAGE': 'https://www.facebook.com/profile.php?id=100084321456',
    'Trạng Thái': 'Đình Chỉ',
    'Ngày': '15/9',
    'CHẶN': 'Không Chặn',
    'ĐẾM LIKE': 'Đếm Like',
    'ĐĂNG TAY, TOOL': 'Tool',
    'TƯƠNG TÁC': 'Bình Thường',
    'NGÀY TT': '15/9',
    'GHI CHÚ BM': 'E-BM BAO 2',
    'Chỉ tiêu bài': 3,
    'Đã đăng': 1,
    'Full Via (Tùy chọn)': '',
  },
  {
    'TÊN NV': 'Bảo',
    'Via (UID)': '100072938471920',
    'TÊN PAGE': 'Hollywood Action Daily',
    'LINK PAGE': 'https://www.facebook.com/profile.php?id=100094123991',
    'Trạng Thái': 'Đề Xuất',
    'Ngày': '15/9',
    'CHẶN': 'Chặn VN',
    'ĐẾM LIKE': 'Đếm Like',
    'ĐĂNG TAY, TOOL': 'Đăng Tay',
    'TƯƠNG TÁC': 'TỐT',
    'NGÀY TT': '15/9',
    'GHI CHÚ BM': 'BM 1 5K+',
    'Chỉ tiêu bài': 3,
    'Đã đăng': 2,
    'Full Via (Tùy chọn)': '100072938471920|BaoPro2024@|KZX7W8Y9A1B2C3D4',
  },
  {
    'TÊN NV': 'Phương My',
    'Via (UID)': '100088921345678',
    'TÊN PAGE': 'Daily Short Clips',
    'LINK PAGE': 'https://www.facebook.com/profile.php?id=100089998877',
    'Trạng Thái': 'Mất Đề Xuất',
    'Ngày': '15/9',
    'CHẶN': 'Chặn Bản Quyền',
    'ĐẾM LIKE': 'Bỏ Đếm Like',
    'ĐĂNG TAY, TOOL': 'Tool',
    'TƯƠNG TÁC': 'Kém',
    'NGÀY TT': '14/9',
    'GHI CHÚ BM': 'BM MY 1',
    'Chỉ tiêu bài': 3,
    'Đã đăng': 0,
    'Full Via (Tùy chọn)': '100088921345678|PhuongMy#2024|H8J9K1L2M3N4P5Q6',
  },
  {
    'TÊN NV': 'Anh Quỳnh',
    'Via (UID)': '100065787653853',
    'TÊN PAGE': 'Fenton Stories',
    'LINK PAGE': 'https://www.facebook.com/profile.php?id=100092384711',
    'Trạng Thái': 'Bị Back',
    'Ngày': '13/9',
    'CHẶN': 'Không Chặn',
    'ĐẾM LIKE': 'Đếm Like',
    'ĐĂNG TAY, TOOL': 'Tool',
    'TƯƠNG TÁC': 'Mất Tương Tác',
    'NGÀY TT': '13/9',
    'GHI CHÚ BM': 'B-BM ANH QUYNH',
    'Chỉ tiêu bài': 2,
    'Đã đăng': 0,
    'Full Via (Tùy chọn)': '',
  },
];

export const SAMPLE_VIA_ROWS = [
  {
    'TÊN NV': 'Anh Quỳnh',
    'UID VIA': '100058675316160',
    'MẬT KHẨU (PASS)': 'QuynhFb2024!',
    'MÃ 2FA': 'JBSWY3DPEHPK3PXP',
    'GHI CHÚ': 'Via chính cầm 2 Page Action',
    'ĐỊNH DẠNG RAW': '100058675316160|QuynhFb2024!|JBSWY3DPEHPK3PXP',
  },
  {
    'TÊN NV': 'Bảo',
    'UID VIA': '100072938471920',
    'MẬT KHẨU (PASS)': 'BaoPro2024@',
    'MÃ 2FA': 'KZX7W8Y9A1B2C3D4',
    'GHI CHÚ': 'Via cổ 2019 live tốt',
    'ĐỊNH DẠNG RAW': '100072938471920|BaoPro2024@|KZX7W8Y9A1B2C3D4',
  },
  {
    'TÊN NV': 'Phương My',
    'UID VIA': '100088921345678',
    'MẬT KHẨU (PASS)': 'PhuongMy#2024',
    'MÃ 2FA': 'H8J9K1L2M3N4P5Q6',
    'GHI CHÚ': 'Via cầm page reels',
    'ĐỊNH DẠNG RAW': '100088921345678|PhuongMy#2024|H8J9K1L2M3N4P5Q6',
  },
];

/**
 * Tải file mẫu Excel chuẩn cho bảng quản lý Fanpage (.xlsx hoặc .csv)
 */
export function downloadFanpageExcelTemplate(format: 'xlsx' | 'csv' = 'xlsx'): void {
  const ws = XLSX.utils.json_to_sheet(SAMPLE_FANPAGE_ROWS);

  // Set column widths
  ws['!cols'] = [
    { wch: 15 }, // TÊN NV
    { wch: 20 }, // Via (UID)
    { wch: 26 }, // TÊN PAGE
    { wch: 45 }, // LINK PAGE
    { wch: 15 }, // Trạng Thái
    { wch: 10 }, // Ngày
    { wch: 16 }, // CHẶN
    { wch: 14 }, // ĐẾM LIKE
    { wch: 16 }, // ĐĂNG TAY, TOOL
    { wch: 15 }, // TƯƠNG TÁC
    { wch: 12 }, // NGÀY TT
    { wch: 18 }, // GHI CHÚ BM
    { wch: 12 }, // Chỉ tiêu bài
    { wch: 10 }, // Đã đăng
    { wch: 45 }, // Full Via
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mau_Import_Fanpage');

  if (format === 'xlsx') {
    XLSX.writeFile(wb, 'Mau_Excel_Import_Fanpage_Chuan.xlsx');
  } else {
    XLSX.writeFile(wb, 'Mau_Excel_Import_Fanpage_Chuan.csv', { bookType: 'csv' });
  }
}

/**
 * Tải file mẫu Excel chuẩn cho bảng Nick Via (.xlsx hoặc .csv)
 */
export function downloadViaExcelTemplate(format: 'xlsx' | 'csv' = 'xlsx'): void {
  const ws = XLSX.utils.json_to_sheet(SAMPLE_VIA_ROWS);

  ws['!cols'] = [
    { wch: 15 }, // TÊN NV
    { wch: 20 }, // UID VIA
    { wch: 18 }, // PASS
    { wch: 22 }, // 2FA
    { wch: 30 }, // GHI CHÚ
    { wch: 50 }, // RAW
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mau_Import_Via');

  if (format === 'xlsx') {
    XLSX.writeFile(wb, 'Mau_Excel_Import_Via_Chuan.xlsx');
  } else {
    XLSX.writeFile(wb, 'Mau_Excel_Import_Via_Chuan.csv', { bookType: 'csv' });
  }
}

/**
 * Xuất dữ liệu Fanpage ra file Excel .xlsx
 */
export function exportFanpageToXLSX(records: PageRecord[]): void {
  const data = records.map((r) => ({
    'TÊN NV': r.staffName || '',
    'Via (UID)': r.viaUid || '',
    'TÊN PAGE': r.pageName || '',
    'LINK PAGE': r.pageLink || '',
    'Trạng Thái': r.status || 'Đề Xuất',
    'Ngày': r.date || '',
    'CHẶN': r.blockStatus || 'Không Chặn',
    'ĐẾM LIKE': r.likeCountStatus || 'Đếm Like',
    'ĐĂNG TAY, TOOL':
      r.postingMethod === 'Đăng Tay'
        ? r.postingDate
          ? `Đăng Tay (${r.postingDate})`
          : 'Đăng Tay'
        : r.postingMethod || 'Đăng Tay',
    'NGÀY ĐĂNG TAY': r.postingMethod === 'Đăng Tay' ? (r.postingDate || r.date || '') : '',
    'TƯƠNG TÁC': r.interaction || 'TỐT',
    'NGÀY TT': r.interactionDate || r.date || '',
    'GHI CHÚ BM': r.bmNote || '',
    'Chỉ tiêu bài': r.targetPosts || 0,
    'Đã đăng': r.actualPosts || 0,
    'Tiến độ': r.isCompleted ? 'Đã xong' : 'Chưa xong',
    'Full Via': r.fullVia || '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 15 },
    { wch: 20 },
    { wch: 26 },
    { wch: 45 },
    { wch: 15 },
    { wch: 10 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
    { wch: 15 },
    { wch: 12 },
    { wch: 18 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 45 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh_Sach_Fanpage');
  XLSX.writeFile(wb, `Danh_Sach_Fanpage_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Xuất dữ liệu Full Via ra file Excel .xlsx
 */
export function exportViaToXLSX(vias: FullViaItem[]): void {
  const data = vias.map((v) => ({
    'NHÂN VIÊN': v.staffName || '',
    'UID VIA': v.uid || '',
    'MẬT KHẨU': v.pass || '',
    'MÃ 2FA': v.twoFa || '',
    'TRẠNG THÁI':
      v.status === 'checkpoint'
        ? 'Checkpoint'
        : v.status === 'dead'
        ? 'Die'
        : v.status === 'error' || v.isError
        ? 'Lỗi'
        : 'Hoạt Động',
    'GHI CHÚ': v.note || '',
    'CHUỖI RAW': v.rawFullVia || `${v.uid}|${v.pass}|${v.twoFa}`,
    'NGÀY TẠO': v.createdAt || '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 16 },
    { wch: 22 },
    { wch: 20 },
    { wch: 24 },
    { wch: 16 },
    { wch: 28 },
    { wch: 45 },
    { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh_Sach_Full_Via');
  XLSX.writeFile(wb, `Danh_Sach_Full_Via_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Xuất dữ liệu Group Facebook ra file Excel .xlsx
 */
export function exportGroupToXLSX(groups: GroupRecord[]): void {
  const data = groups.map((g, idx) => ({
    'STT': idx + 1,
    'UID VIA': g.uid || '',
    'TÊN VIA': g.viaName || '',
    'TRẠNG THÁI': g.joinStatus || 'Chưa',
    'LINK GROUP': g.groupLink || '',
    'TÊN NHÓM': g.groupName || '',
    'GHI CHÚ': g.note || '',
    'VIA CHÍNH / BÔI XANH': g.isHighlighted ? 'Có (Via chính)' : 'Không',
    'NHÂN VIÊN': g.staffName || '',
    'MÃ GROUP': g.groupId || '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 8 },
    { wch: 22 },
    { wch: 25 },
    { wch: 18 },
    { wch: 45 },
    { wch: 35 },
    { wch: 20 },
    { wch: 22 },
    { wch: 18 },
    { wch: 25 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh_Sach_Group');
  XLSX.writeFile(wb, `Danh_Sach_Group_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Tải file Excel mẫu Quản lý Group
 */
export function downloadGroupExcelTemplate(): void {
  const sampleData = [
    {
      'UID VIA': '100060665184656',
      'TÊN VIA': 'Lucas Santos',
      'TRẠNG THÁI': 'Đã Jon',
      'LINK GROUP': 'https://www.facebook.com/groups/289880638621489',
      'TÊN NHÓM': 'Beautifull World ✅',
      'GHI CHÚ': '282',
      'VIA CHÍNH': 'Không',
      'NHÂN VIÊN': 'Anh Quỳnh',
    },
    {
      'UID VIA': '100023228976334',
      'TÊN VIA': 'Tolga Yagmur',
      'TRẠNG THÁI': 'Jon chờ duyệt',
      'LINK GROUP': 'https://www.facebook.com/groups/289880638621489',
      'TÊN NHÓM': 'Beautifull World ✅',
      'GHI CHÚ': 'VHH',
      'VIA CHÍNH': 'Có',
      'NHÂN VIÊN': 'Anh Quỳnh',
    },
    {
      'UID VIA': '100060467292965',
      'TÊN VIA': 'Ansh Patial',
      'TRẠNG THÁI': 'Chưa',
      'LINK GROUP': 'https://www.facebook.com/groups/1055686641112045',
      'TÊN NHÓM': 'Movies World ✅',
      'GHI CHÚ': '956',
      'VIA CHÍNH': 'Không',
      'NHÂN VIÊN': 'Bảo',
    },
    {
      'UID VIA': '100091827364512',
      'TÊN VIA': 'David Miller',
      'TRẠNG THÁI': 'Đã Jon',
      'LINK GROUP': 'https://www.facebook.com/groups/1055686641112045',
      'TÊN NHÓM': 'Movies World ✅',
      'GHI CHÚ': 'Hạn Chế',
      'VIA CHÍNH': 'Không',
      'NHÂN VIÊN': 'Phương My',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  ws['!cols'] = [
    { wch: 22 },
    { wch: 25 },
    { wch: 45 },
    { wch: 30 },
    { wch: 18 },
    { wch: 15 },
    { wch: 18 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mau_Group');
  XLSX.writeFile(wb, 'Mau_Nhap_Group_Facebook.xlsx');
}

/**
 * Xuất danh sách Proxy ra file Excel .xlsx
 */
export function exportProxiesToXLSX(proxies: ProxyItem[]): void {
  const data = proxies.map((p, idx) => ({
    'STT': idx + 1,
    'IP': p.ip || '',
    'PORT': p.port || '',
    'USER': p.username || '',
    'PASS': p.password || '',
    'GIAO THỨC': p.protocol || 'HTTP',
    'CHUỖI PROXY': p.fullProxy || '',
    'QUỐC GIA': p.location || '',
    'NHÀ CUNG CẤP': p.provider || '',
    'NHÂN VIÊN': (p.assignedStaff || []).join(', '),
    'TRẠNG THÁI': p.status === 'active' ? 'Hoạt Động' : p.status === 'die' ? 'Chết / Lỗi' : 'Hết Hạn',
    'HẠN DÙNG': p.expireDate || '',
    'LOẠI': p.isRotating ? 'Proxy Xoay' : 'Proxy Tĩnh',
    'GHI CHÚ': p.note || '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 8 },
    { wch: 18 },
    { wch: 10 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    { wch: 35 },
    { wch: 12 },
    { wch: 20 },
    { wch: 20 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh_Sach_Proxy');
  XLSX.writeFile(wb, `Danh_Sach_Proxy_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Tải file Excel mẫu Proxy
 */
export function downloadProxyExcelTemplate(): void {
  const sampleData = [
    {
      'IP': '103.145.22.10',
      'PORT': '9080',
      'USER': 'user01',
      'PASS': 'pass123',
      'GIAO THỨC': 'HTTP',
      'QUỐC GIA': 'VN',
      'NHÀ CUNG CẤP': 'Viettel Dân Cư',
      'NHÂN VIÊN': 'Anh Quỳnh',
      'HẠN DÙNG': '25/10/2026',
      'GHI CHÚ': 'Proxy tĩnh nuôi via',
    },
    {
      'IP': '154.213.189.70',
      'PORT': '1080',
      'USER': 'us_user',
      'PASS': 'pass456',
      'GIAO THỨC': 'SOCKS5',
      'QUỐC GIA': 'US',
      'NHÀ CUNG CẤP': 'ProxyNo1',
      'NHÂN VIÊN': 'Phương My',
      'HẠN DÙNG': '30/10/2026',
      'GHI CHÚ': 'Proxy US dân cư',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  ws['!cols'] = [
    { wch: 18 },
    { wch: 10 },
    { wch: 15 },
    { wch: 15 },
    { wch: 12 },
    { wch: 10 },
    { wch: 20 },
    { wch: 18 },
    { wch: 15 },
    { wch: 25 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mau_Proxy');
  XLSX.writeFile(wb, 'Mau_Nhap_Proxy.xlsx');
}
