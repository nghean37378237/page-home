import { PageRecord, PageStatus, BlockStatus, LikeCountStatus, ProgressStatus, PostingMethod, InteractionQuality } from '../types';

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

export const PROGRESS_STATUS_OPTIONS: ProgressStatus[] = [
  'Đang làm',
  'Không làm',
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

export function getProgressBadgeStyle(status?: ProgressStatus): string {
  switch (status) {
    case 'Không làm':
      return 'bg-rose-600 text-white font-bold border border-rose-700 shadow-2xs';
    case 'Đang làm':
    default:
      return 'bg-[#009b3a] text-white font-bold border border-emerald-700 shadow-2xs';
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

/**
 * Cắt bỏ phần ghi chú lịch sử sau dấu | để lấy tên BM sạch
 * Ví dụ: "Elarby Travel | [Chuyển từ Via 1000...]" -> "Elarby Travel"
 */
export function getCleanBmName(bm?: string | null): string {
  if (!bm) return '';
  return bm.split('|')[0].trim();
}

export interface ParsedFullVia {
  uid: string;
  pass: string;
  twoFa: string;
  email: string;
  emailPass: string;
  raw: string;
  extra: string[];
}

export function isLikelyTwoFaSecret(token: string): boolean {
  const clean = (token || '').trim().replace(/\s+/g, '');
  if (!clean || clean.includes('@')) return false;
  // Base32 2FA key (12-64 chars of A-Z, 2-7)
  return /^[A-Z2-7]{12,64}$/i.test(clean) && /[A-Z]/i.test(clean);
}

export function isLikelyFbUid(token: string): boolean {
  const clean = (token || '').trim();
  return /^(1000\d{7,14}|615\d{7,14}|\d{9,17})$/.test(clean);
}

export function parseFullVia(rawFullVia?: string): ParsedFullVia | null {
  if (!rawFullVia || !rawFullVia.trim()) return null;
  const parts = rawFullVia.trim().split('|').map((p) => p.trim());
  const uid = parts[0] || '';

  // Hỗ trợ cả định dạng chuẩn UID|PASS|2FA|MAIL|PASS_MAIL và định dạng UID|2FA|MAIL|PASS
  let pass = parts[1] || '';
  let twoFa = parts[2] || '';
  let email = parts[3] || '';
  let emailPass = parts[4] || '';
  let extra = parts.slice(5);

  if (parts.length >= 4 && !parts[1]?.includes('@') && parts[2]?.includes('@')) {
    // Trường hợp UID | 2FA | MAIL | PASS (hoặc PASS_MAIL)
    if (isLikelyTwoFaSecret(parts[1])) {
      twoFa = parts[1];
      email = parts[2];
      pass = parts[3] || '';
      emailPass = parts[4] || '';
      extra = parts.slice(5);
    }
  } else if (parts.length >= 3 && parts[1]?.includes('@')) {
    // Trường hợp UID | MAIL | PASS | 2FA
    email = parts[1];
    pass = parts[2] || '';
    twoFa = parts[3] || '';
    emailPass = parts[4] || '';
    extra = parts.slice(5);
  }

  return {
    uid,
    pass,
    twoFa,
    email,
    emailPass,
    extra,
    raw: rawFullVia.trim(),
  };
}

/**
 * Phân tích thông minh chuỗi bổ sung thông tin Via khi đã có UID hoặc chọn Via:
 * Hỗ trợ mọi thứ tự người dùng dán vào:
 * - "2FA | Mail | Pass" hoặc "2FA | Mail | Pass | PassMail"
 * - "Pass | 2FA | Mail | PassMail"
 * - "UID | Pass | 2FA | Mail | PassMail"
 * - "UID | 2FA | Mail | Pass"
 * - "Mail | PassMail"
 */
export function parseSupplementalViaInput(
  rawInput: string,
  existingUid?: string
): {
  uid: string;
  pass: string;
  twoFa: string;
  email: string;
  emailPass: string;
  extra: string[];
} {
  const cleanInput = (rawInput || '').trim();
  if (!cleanInput) {
    return {
      uid: (existingUid || '').trim(),
      pass: '',
      twoFa: '',
      email: '',
      emailPass: '',
      extra: [],
    };
  }

  const rawParts = cleanInput
    .split(/\||\t/)
    .map((p) => p.trim());

  let uid = (existingUid || '').trim();
  let remaining = [...rawParts];

  // Nếu phần tử đầu tiên trùng với UID đã có hoặc là dãy số UID Facebook (và có nhiều hơn 1 phần tử)
  if (
    remaining.length >= 2 &&
    ((uid && remaining[0].toLowerCase() === uid.toLowerCase()) || isLikelyFbUid(remaining[0]))
  ) {
    if (!uid) uid = remaining[0];
    remaining = remaining.slice(1);
  } else if (remaining.length === 1 && isLikelyFbUid(remaining[0]) && !uid) {
    return { uid: remaining[0], pass: '', twoFa: '', email: '', emailPass: '', extra: [] };
  }

  let pass = '';
  let twoFa = '';
  let email = '';
  let emailPass = '';
  const extra: string[] = [];

  // Tìm vị trí có chứa dấu '@' (Email)
  const emailIdx = remaining.findIndex((p) => p.includes('@') && p.includes('.'));

  if (emailIdx === 0) {
    // Bắt đầu bằng Mail: Mail | PassMail | 2FA | Pass...
    email = remaining[0] || '';
    emailPass = remaining[1] || '';
    if (remaining[2]) {
      if (isLikelyTwoFaSecret(remaining[2])) {
        twoFa = remaining[2];
        pass = remaining[3] || '';
        extra.push(...remaining.slice(4));
      } else {
        pass = remaining[2];
        twoFa = remaining[3] || '';
        extra.push(...remaining.slice(4));
      }
    }
  } else if (emailIdx === 1) {
    // Dạng phổ biến khi bổ sung: "2FA | Mail | Pass | PassMail" hoặc "Pass | Mail | PassMail | 2FA"
    const first = remaining[0] || '';
    email = remaining[1] || '';
    const third = remaining[2] || '';
    const fourth = remaining[3] || '';
    if (isLikelyTwoFaSecret(first) || !isLikelyTwoFaSecret(fourth)) {
      // Mặc định ưu tiên theo đúng gợi ý "2FA | Mail | Pass | PassMail"
      twoFa = first;
      pass = third;
      emailPass = fourth;
      extra.push(...remaining.slice(4));
    } else {
      pass = first;
      emailPass = third;
      twoFa = fourth;
      extra.push(...remaining.slice(4));
    }
  } else if (emailIdx === 2) {
    // Dạng chuẩn: "Pass | 2FA | Mail | PassMail" hoặc "2FA | Pass | Mail | PassMail"
    const first = remaining[0] || '';
    const second = remaining[1] || '';
    email = remaining[2] || '';
    emailPass = remaining[3] || '';
    if (isLikelyTwoFaSecret(first) && !isLikelyTwoFaSecret(second)) {
      twoFa = first;
      pass = second;
    } else {
      pass = first;
      twoFa = second;
    }
    extra.push(...remaining.slice(4));
  } else {
    // Không có email hoặc email ở vị trí khác
    const first = remaining[0] || '';
    const second = remaining[1] || '';
    const third = remaining[2] || '';
    const fourth = remaining[3] || '';
    if (remaining.length === 1) {
      if (isLikelyTwoFaSecret(first)) {
        twoFa = first;
      } else {
        pass = first;
      }
    } else if (isLikelyTwoFaSecret(first) && !isLikelyTwoFaSecret(second)) {
      // 2FA | Pass | Mail | PassMail
      twoFa = first;
      pass = second;
      email = third;
      emailPass = fourth;
      extra.push(...remaining.slice(4));
    } else {
      // Pass | 2FA | Mail | PassMail
      pass = first;
      twoFa = second;
      email = third;
      emailPass = fourth;
      extra.push(...remaining.slice(4));
    }
  }

  return {
    uid,
    pass,
    twoFa,
    email,
    emailPass,
    extra: extra.filter(Boolean),
  };
}

export function buildFullViaString(params: {
  uid: string;
  pass?: string;
  twoFa?: string;
  email?: string;
  emailPass?: string;
  extra?: string[] | string;
}): string {
  const uid = (params.uid || '').split('|')[0].trim();
  const pass = (params.pass || '').trim();
  const twoFa = (params.twoFa || '').trim();
  const email = (params.email || '').trim();
  const emailPass = (params.emailPass || '').trim();
  const extraList = Array.isArray(params.extra)
    ? params.extra.map((x) => x.trim()).filter(Boolean)
    : (params.extra || '')
        .split('|')
        .map((x) => x.trim())
        .filter(Boolean);

  const base = [uid, pass, twoFa];
  if (email || emailPass || extraList.length > 0) {
    base.push(email);
  }
  if (emailPass || extraList.length > 0) {
    base.push(emailPass);
  }
  if (extraList.length > 0) {
    base.push(...extraList);
  }
  return base.join('|');
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
export function findMatchingAccount<T extends { username: string; email?: string; fullName?: string }>(
  identifier: string,
  accounts: T[]
): T | undefined {
  const raw = (identifier || '').trim().toLowerCase();
  if (!raw) return undefined;

  const cleanId = raw.replace(/\s+/g, '');
  const normId = normalizeVietnamese(raw).replace(/\s+/g, '');
  const emailPrefix = raw.includes('@') ? raw.split('@')[0] : raw;
  const normEmailPrefix = normalizeVietnamese(emailPrefix).replace(/\s+/g, '');

  // 1. Khớp chính xác hoàn toàn username, fullName hoặc email
  let found = accounts.find(
    (a) =>
      a.username.trim().toLowerCase() === raw ||
      (a.fullName && a.fullName.trim().toLowerCase() === raw) ||
      (a.email && a.email.trim().toLowerCase() === raw)
  );
  if (found) return found;

  // 2. Khớp bỏ khoảng trắng
  found = accounts.find(
    (a) =>
      a.username.trim().toLowerCase().replace(/\s+/g, '') === cleanId ||
      (a.fullName && a.fullName.trim().toLowerCase().replace(/\s+/g, '') === cleanId) ||
      (a.email && a.email.trim().toLowerCase().replace(/\s+/g, '') === cleanId)
  );
  if (found) return found;

  // 3. Khớp Tiếng Việt không dấu và tiền tố email
  found = accounts.find((a) => {
    const normUsername = normalizeVietnamese(a.username).replace(/\s+/g, '');
    const normFullName = a.fullName ? normalizeVietnamese(a.fullName).replace(/\s+/g, '') : '';
    const normUserEmail = a.email
      ? normalizeVietnamese(a.email.split('@')[0]).replace(/\s+/g, '')
      : '';

    return (
      normUsername === normId ||
      normUsername === normEmailPrefix ||
      (normFullName && (normFullName === normId || normFullName === normEmailPrefix)) ||
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
    `"${(getCleanBmName(r.bmNote)).replace(/"/g, '""')}"`,
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
