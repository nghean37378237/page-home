import * as XLSX from 'xlsx';
import { PageRecord, FullViaItem } from '../types';

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
