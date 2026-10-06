import { PageRecord, PageStatus, BlockStatus, LikeCountStatus, PostingMethod, InteractionQuality } from '../types';

export const PAGE_STATUS_OPTIONS: PageStatus[] = [
  'Đề Xuất',
  'Mất Đề Xuất',
  'Đình Chỉ',
  'Bị Back',
];

export const BLOCK_STATUS_OPTIONS: BlockStatus[] = [
  'Không Chặn',
  'Chặn VN',
  'Chặn Bản Quyền',
  'Chặn Quốc Tế',
];

export const LIKE_COUNT_OPTIONS: LikeCountStatus[] = [
  'Đếm Like',
  'Bỏ Đếm Like',
];

export const POSTING_METHOD_OPTIONS: PostingMethod[] = [
  'Đăng Tay',
  'Tool',
  'Hẹn Giờ',
];

export const INTERACTION_OPTIONS: InteractionQuality[] = [
  'TỐT',
  'Bình Thường',
  'Kém',
  'Mất Tương Tác',
];

export function getStatusBadgeStyle(status: PageStatus): string {
  switch (status) {
    case 'Đề Xuất':
      return 'bg-[#009b3a] text-white font-bold shadow-xs';
    case 'Mất Đề Xuất':
      return 'bg-[#b31412] text-white font-bold shadow-xs';
    case 'Đình Chỉ':
      return 'bg-[#f4d19b] text-[#7a4100] font-bold border border-[#e5ba7a]';
    case 'Bị Back':
      return 'bg-[#673ab7] text-white font-bold shadow-xs';
    default:
      return 'bg-slate-200 text-slate-700';
  }
}

export function getBlockBadgeStyle(block: BlockStatus): string {
  switch (block) {
    case 'Chặn VN':
      return 'bg-[#c5221f] text-white font-bold';
    case 'Chặn Bản Quyền':
      return 'bg-[#8e0000] text-white font-bold';
    case 'Chặn Quốc Tế':
      return 'bg-[#e65100] text-white font-bold';
    case 'Không Chặn':
    default:
      return 'bg-slate-100 text-slate-500 border border-slate-200';
  }
}

export function getLikeCountBadgeStyle(status?: LikeCountStatus): string {
  switch (status) {
    case 'Bỏ Đếm Like':
      return 'bg-red-600 text-white font-bold border border-red-700 shadow-2xs';
    case 'Đếm Like':
    default:
      return 'bg-blue-50 text-blue-700 border border-blue-200 font-bold';
  }
}

export function getPostingMethodBadgeStyle(method: PostingMethod): string {
  switch (method) {
    case 'Đăng Tay':
      return 'bg-[#0d652d] text-white font-bold';
    case 'Tool':
      return 'bg-[#1565c0] text-white font-medium';
    case 'Hẹn Giờ':
      return 'bg-[#e65100] text-white font-medium';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export function getInteractionBadgeStyle(interaction: InteractionQuality): string {
  switch (interaction) {
    case 'TỐT':
      return 'bg-[#005a36] text-white font-bold tracking-wide';
    case 'Bình Thường':
      return 'bg-slate-100 text-slate-700 border border-slate-200';
    case 'Kém':
      return 'bg-[#d84315] text-white font-medium';
    case 'Mất Tương Tác':
      return 'bg-[#4a148c] text-white font-medium';
    default:
      return 'bg-slate-100 text-slate-500';
  }
}

export interface ParsedFullVia {
  uid: string;
  pass: string;
  twoFa: string;
  raw: string;
  extra: string[];
}

export function parseFullVia(rawFullVia?: string): ParsedFullVia | null {
  if (!rawFullVia || !rawFullVia.trim()) return null;
  const parts = rawFullVia.trim().split('|');
  return {
    uid: parts[0]?.trim() || '',
    pass: parts[1]?.trim() || '',
    twoFa: parts[2]?.trim() || '',
    extra: parts.slice(3).map((p) => p.trim()),
    raw: rawFullVia.trim(),
  };
}

export function normalizeVietnamese(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
}

/**
 * Tìm tài khoản người dùng thông minh:
 * - Khớp chính xác tên hiển thị hoặc email
 * - Khớp không dấu (VD: 'anh quynh' -> 'Anh Quỳnh')
 * - Khớp không khoảng trắng (VD: 'anhquynh' -> 'Anh Quỳnh')
 * - Khớp phần prefix email (VD: 'anhquynh@gmail.com' -> 'Anh Quỳnh')
 */
export function findMatchingAccount<T extends { username: string; email?: string }>(
  identifier: string,
  accounts: T[]
): T | undefined {
  const raw = (identifier || '').trim().toLowerCase();
  if (!raw) return undefined;

  const cleanId = raw.replace(/\s+/g, '');
  const normId = normalizeVietnamese(raw).replace(/\s+/g, '');
  const emailPrefix = raw.includes('@') ? raw.split('@')[0] : raw;
  const normEmailPrefix = normalizeVietnamese(emailPrefix).replace(/\s+/g, '');

  // 1. Khớp chính xác hoàn toàn username hoặc email
  let found = accounts.find(
    (a) =>
      a.username.trim().toLowerCase() === raw ||
      (a.email && a.email.trim().toLowerCase() === raw)
  );
  if (found) return found;

  // 2. Khớp bỏ khoảng trắng
  found = accounts.find(
    (a) =>
      a.username.trim().toLowerCase().replace(/\s+/g, '') === cleanId ||
      (a.email && a.email.trim().toLowerCase().replace(/\s+/g, '') === cleanId)
  );
  if (found) return found;

  // 3. Khớp Tiếng Việt không dấu và tiền tố email
  found = accounts.find((a) => {
    const normUsername = normalizeVietnamese(a.username).replace(/\s+/g, '');
    const normUserEmail = a.email
      ? normalizeVietnamese(a.email.split('@')[0]).replace(/\s+/g, '')
      : '';

    return (
      normUsername === normId ||
      normUsername === normEmailPrefix ||
      (normUserEmail && (normUserEmail === normId || normUserEmail === normEmailPrefix))
    );
  });
  if (found) return found;

  return undefined;
}

export function exportSheetToCSV(records: PageRecord[]): void {
  const headers = [
    'TÊN NV',
    'Via',
    'TÊN PAGE',
    'LINK PAGE',
    'Trạng Thái',
    'Ngày',
    'CHẶN',
    'ĐĂNG TAY, TOOL',
    'TƯƠNG TÁC',
    'GHI CHÚ BM',
    'Chỉ tiêu bài',
    'Đã đăng',
    'Hoàn thành chưa',
  ];

  const rows = records.map((r) => [
    `"${(r.staffName || '').replace(/"/g, '""')}"`,
    `"${(r.viaUid || '').replace(/"/g, '""')}"`,
    `"${(r.pageName || '').replace(/"/g, '""')}"`,
    `"${(r.pageLink || '').replace(/"/g, '""')}"`,
    `"${(r.status || '').replace(/"/g, '""')}"`,
    `"${(r.date || '').replace(/"/g, '""')}"`,
    `"${(r.blockStatus || '').replace(/"/g, '""')}"`,
    `"${(r.postingMethod || '').replace(/"/g, '""')}"`,
    `"${(r.interaction || '').replace(/"/g, '""')}"`,
    `"${(r.bmNote || '').replace(/"/g, '""')}"`,
    `"${r.targetPosts}"`,
    `"${r.actualPosts}"`,
    `"${r.isCompleted ? 'Đã hoàn thành' : 'Chưa hoàn thành'}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Bang_Theo_Doi_Fanpage_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
