import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ExternalLink,
  Trash2,
  Edit2,
  Plus,
  Minus,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Layers,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Info,
  Palette,
  User,
  Shield,
  AlertTriangle,
  Clock,
  ArrowRightLeft,
  Zap,
  Filter,
  ArrowUpDown,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronUp,
  FolderMinus,
  FolderPlus,
  Maximize2,
  Minimize2,
  BarChart3,
  PenTool,
  Bot,
  Users,
  X,
} from 'lucide-react';
import {
  PageRecord,
  PageStatus,
  BlockStatus,
  LikeCountStatus,
  ProgressStatus,
  PostingMethod,
  InteractionQuality,
  AppUser,
  ViaTransferStatus,
  ViaTransferColor,
  VIA_TRANSFER_PRESETS,
  VIA_TRANSFER_COLORS,
  FullViaItem,
  ADMIN_WAITING_POOL,
  isAdminWaitingPool,
} from '../types';
import {
  PAGE_STATUS_OPTIONS,
  BLOCK_STATUS_OPTIONS,
  LIKE_COUNT_OPTIONS,
  PROGRESS_STATUS_OPTIONS,
  POSTING_METHOD_OPTIONS,
  INTERACTION_OPTIONS,
  getStatusBadgeStyle,
  getBlockBadgeStyle,
  getLikeCountBadgeStyle,
  getProgressBadgeStyle,
  getPostingMethodBadgeStyle,
  getInteractionBadgeStyle,
  getCleanBmName,
} from '../utils/helpers';

export interface ViaTheme {
  name: string;
  rowBg: string;
  rowHover: string;
  cellBg: string;
  borderLeft: string;
  badgeBg: string;
  topBorder: string;
  bottomBorder: string;
  innerBorder: string;
  dotColor: string;
  ringColor: string;
  softBadge: string;
  chipBg: string;
  chipText: string;
}

// 8 bảng màu pastel thanh nhã, độ tương phản khoa học, làm nổi bật các khối Via cầm chung page
export const VIA_THEMES: ViaTheme[] = [
  {
    name: 'Xanh Lam Nhạt (Sky Blue)',
    rowBg: 'bg-sky-50/70',
    rowHover: 'hover:bg-sky-100/80',
    cellBg: 'bg-sky-100/80',
    borderLeft: 'border-l-4 border-l-sky-500',
    badgeBg: 'bg-sky-100 text-sky-900 border-sky-300',
    topBorder: 'border-t-2 border-sky-400',
    bottomBorder: 'border-b-2 border-sky-300',
    innerBorder: 'border-t border-dashed border-sky-200/80',
    dotColor: 'bg-sky-500',
    ringColor: 'ring-sky-300',
    softBadge: 'bg-sky-600 text-white',
    chipBg: 'bg-sky-100',
    chipText: 'text-sky-900',
  },
  {
    name: 'Vàng Cát Nhạt (Warm Amber)',
    rowBg: 'bg-amber-50/70',
    rowHover: 'hover:bg-amber-100/80',
    cellBg: 'bg-amber-100/80',
    borderLeft: 'border-l-4 border-l-amber-500',
    badgeBg: 'bg-amber-100 text-amber-950 border-amber-300',
    topBorder: 'border-t-2 border-amber-400',
    bottomBorder: 'border-b-2 border-amber-300',
    innerBorder: 'border-t border-dashed border-amber-200/80',
    dotColor: 'bg-amber-500',
    ringColor: 'ring-amber-300',
    softBadge: 'bg-amber-600 text-white',
    chipBg: 'bg-amber-100',
    chipText: 'text-amber-950',
  },
  {
    name: 'Xanh Bạc Hà (Mint Emerald)',
    rowBg: 'bg-emerald-50/70',
    rowHover: 'hover:bg-emerald-100/80',
    cellBg: 'bg-emerald-100/80',
    borderLeft: 'border-l-4 border-l-emerald-500',
    badgeBg: 'bg-emerald-100 text-emerald-950 border-emerald-300',
    topBorder: 'border-t-2 border-emerald-400',
    bottomBorder: 'border-b-2 border-emerald-300',
    innerBorder: 'border-t border-dashed border-emerald-200/80',
    dotColor: 'bg-emerald-500',
    ringColor: 'ring-emerald-300',
    softBadge: 'bg-emerald-600 text-white',
    chipBg: 'bg-emerald-100',
    chipText: 'text-emerald-950',
  },
  {
    name: 'Tím Oải Hương (Soft Violet)',
    rowBg: 'bg-purple-50/70',
    rowHover: 'hover:bg-purple-100/80',
    cellBg: 'bg-purple-100/80',
    borderLeft: 'border-l-4 border-l-purple-500',
    badgeBg: 'bg-purple-100 text-purple-950 border-purple-300',
    topBorder: 'border-t-2 border-purple-400',
    bottomBorder: 'border-b-2 border-purple-300',
    innerBorder: 'border-t border-dashed border-purple-200/80',
    dotColor: 'bg-purple-500',
    ringColor: 'ring-purple-300',
    softBadge: 'bg-purple-600 text-white',
    chipBg: 'bg-purple-100',
    chipText: 'text-purple-950',
  },
  {
    name: 'Cam Đào Nhạt (Soft Peach)',
    rowBg: 'bg-orange-50/70',
    rowHover: 'hover:bg-orange-100/80',
    cellBg: 'bg-orange-100/80',
    borderLeft: 'border-l-4 border-l-orange-500',
    badgeBg: 'bg-orange-100 text-orange-950 border-orange-300',
    topBorder: 'border-t-2 border-orange-400',
    bottomBorder: 'border-b-2 border-orange-300',
    innerBorder: 'border-t border-dashed border-orange-200/80',
    dotColor: 'bg-orange-500',
    ringColor: 'ring-orange-300',
    softBadge: 'bg-orange-600 text-white',
    chipBg: 'bg-orange-100',
    chipText: 'text-orange-950',
  },
  {
    name: 'Xanh Mòng Két (Teal Pastel)',
    rowBg: 'bg-teal-50/70',
    rowHover: 'hover:bg-teal-100/80',
    cellBg: 'bg-teal-100/80',
    borderLeft: 'border-l-4 border-l-teal-500',
    badgeBg: 'bg-teal-100 text-teal-950 border-teal-300',
    topBorder: 'border-t-2 border-teal-400',
    bottomBorder: 'border-b-2 border-teal-300',
    innerBorder: 'border-t border-dashed border-teal-200/80',
    dotColor: 'bg-teal-500',
    ringColor: 'ring-teal-300',
    softBadge: 'bg-teal-600 text-white',
    chipBg: 'bg-teal-100',
    chipText: 'text-teal-950',
  },
  {
    name: 'Hồng Phấn (Soft Rose)',
    rowBg: 'bg-rose-50/70',
    rowHover: 'hover:bg-rose-100/80',
    cellBg: 'bg-rose-100/80',
    borderLeft: 'border-l-4 border-l-rose-500',
    badgeBg: 'bg-rose-100 text-rose-950 border-rose-300',
    topBorder: 'border-t-2 border-rose-400',
    bottomBorder: 'border-b-2 border-rose-300',
    innerBorder: 'border-t border-dashed border-rose-200/80',
    dotColor: 'bg-rose-500',
    ringColor: 'ring-rose-300',
    softBadge: 'bg-rose-600 text-white',
    chipBg: 'bg-rose-100',
    chipText: 'text-rose-950',
  },
  {
    name: 'Chàm Indigo Nhạt (Soft Indigo)',
    rowBg: 'bg-indigo-50/70',
    rowHover: 'hover:bg-indigo-100/80',
    cellBg: 'bg-indigo-100/80',
    borderLeft: 'border-l-4 border-l-indigo-500',
    badgeBg: 'bg-indigo-100 text-indigo-950 border-indigo-300',
    topBorder: 'border-t-2 border-indigo-400',
    bottomBorder: 'border-b-2 border-indigo-300',
    innerBorder: 'border-t border-dashed border-indigo-200/80',
    dotColor: 'bg-indigo-500',
    ringColor: 'ring-indigo-300',
    softBadge: 'bg-indigo-600 text-white',
    chipBg: 'bg-indigo-100',
    chipText: 'text-indigo-950',
  },
];

// Theme nền trắng thanh lịch cho Via cầm 1 page riêng lẻ (dễ phân biệt với via cầm chung page)
export const NEUTRAL_THEME: ViaTheme = {
  name: 'Via 1 Page (Nền Trắng)',
  rowBg: 'bg-white',
  rowHover: 'hover:bg-slate-50/90',
  cellBg: 'bg-white',
  borderLeft: 'border-l-2 border-l-slate-200',
  badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
  topBorder: 'border-t border-slate-300',
  bottomBorder: 'border-b border-slate-300',
  innerBorder: 'border-t border-slate-200',
  dotColor: 'bg-slate-400',
  ringColor: 'ring-slate-200',
  softBadge: 'bg-slate-600 text-white',
  chipBg: 'bg-slate-100',
  chipText: 'text-slate-700',
};

// Theme cho Page chưa gán nick Via
export const UNASSIGNED_THEME: ViaTheme = {
  name: 'Chưa Gán Nick Via',
  rowBg: 'bg-slate-50/40',
  rowHover: 'hover:bg-slate-100/60',
  cellBg: 'bg-slate-50/60',
  borderLeft: 'border-l-2 border-l-dashed border-l-slate-300',
  badgeBg: 'bg-slate-100 text-slate-400 border-dashed border-slate-200',
  topBorder: 'border-t border-slate-300',
  bottomBorder: 'border-b border-slate-300',
  innerBorder: 'border-t border-slate-200',
  dotColor: 'bg-slate-300',
  ringColor: 'ring-slate-100',
  softBadge: 'bg-slate-400 text-white',
  chipBg: 'bg-slate-100',
  chipText: 'text-slate-400',
};

export const getViaTransferCellStyle = (
  status?: ViaTransferStatus,
  color?: ViaTransferColor | string
) => {
  // Ưu tiên màu sắc được chọn trực tiếp
  if (color === 'yellow') {
    return 'bg-amber-100/95 text-amber-950 border-l-4 border-l-amber-500 ring-1 ring-amber-300';
  }
  if (color === 'green') {
    return 'bg-emerald-100/95 text-emerald-950 border-l-4 border-l-emerald-600 ring-1 ring-emerald-300';
  }
  if (color === 'blue') {
    return 'bg-sky-100/95 text-sky-950 border-l-4 border-l-sky-500 ring-1 ring-sky-300';
  }
  if (color === 'purple') {
    return 'bg-purple-100/95 text-purple-950 border-l-4 border-l-purple-500 ring-1 ring-purple-300';
  }
  if (color === 'red') {
    return 'bg-rose-100/95 text-rose-950 border-l-4 border-l-rose-500 ring-1 ring-rose-300';
  }
  if (color === 'orange') {
    return 'bg-orange-100/95 text-orange-950 border-l-4 border-l-orange-500 ring-1 ring-orange-300';
  }
  if (color === 'gray') {
    return 'bg-slate-100 text-slate-800 border-l-4 border-l-slate-400';
  }

  // Fallback theo trạng thái đổi via
  switch (status) {
    case 'adding':
      return 'bg-amber-100/95 text-amber-950 border-l-4 border-l-amber-500 ring-1 ring-amber-400/80';
    case 'completed':
      return 'bg-emerald-100/95 text-emerald-950 border-l-4 border-l-emerald-600 ring-1 ring-emerald-400/80';
    case 'pending':
      return 'bg-rose-100/95 text-rose-950 border-l-4 border-l-rose-500 ring-1 ring-rose-400/80';
    case 'invited':
      return 'bg-sky-100/95 text-sky-950 border-l-4 border-l-sky-500 ring-1 ring-sky-400/80';
    case 'waiting':
      return 'bg-purple-100/95 text-purple-950 border-l-4 border-l-purple-500 ring-1 ring-purple-400/80';
    case 'failed':
      return 'bg-red-100/95 text-red-950 border-l-4 border-l-red-600 ring-1 ring-red-400/80';
    default:
      return 'bg-slate-50/40 hover:bg-white text-slate-700';
  }
};

interface FanpageSheetTableProps {
  records: PageRecord[];
  allRecords?: PageRecord[];
  existingVias?: FullViaItem[];
  currentUser: AppUser;
  errorViaUids?: Set<string>;
  fixedViaUids?: Set<string>;
  onToggleViaError?: (viaUid: string, isError: boolean, recordId?: string) => void;
  onToggleViaFixed?: (viaUid: string, isFixed: boolean, recordId?: string) => void;
  onUpdateViaSharedNoteForAll?: (viaUid: string, sharedNote: string) => void;
  onUpdateViaReportNote?: (viaUid: string, reportNote: string, record: PageRecord) => void;
  onUpdateRecord: (id: string, updates: Partial<PageRecord>) => void;
  onUpdateViaUidForAll?: (oldUid: string, newUid: string) => void;
  onUpdateStaffNameForAll?: (oldName: string, newName: string) => void;
  onUpdateFullViaForAll?: (viaUid: string, newFullVia: string) => void;
  onAddPageToVia?: (viaUid: string, staffName: string) => void;
  onEditRecord: (record: PageRecord) => void;
  onDeleteRecord: (id: string) => void;
  onDuplicateRecord: (record: PageRecord) => void;
  onDeleteStaffAllData?: (staffName: string) => void;
  onTransferPageRecord?: (record: PageRecord) => void;
  onTransferViaPages?: (viaUid: string) => void;
  onQuickTransferViaToStaff?: (viaUid: string, targetStaffName: string) => void;
  availableStaffNames?: string[];
  onFetchPagesForVia?: (viaUid: string, staffName: string) => void;
}

export type SheetRowItem =
  | {
      isCollapsedStaff: false;
      record: PageRecord;
    }
  | {
      isCollapsedStaff: true;
      staffName: string;
      totalRecords: number;
      totalVias: number;
      deXuatCount: number;
      matDeXuatCount: number;
      errorViaCount: number;
      manualCount: number;
      toolCount: number;
      timerCount: number;
      manualActual: number;
      toolActual: number;
      doingCount: number;
      notDoingCount: number;
    };

export const FanpageSheetTable: React.FC<FanpageSheetTableProps> = ({
  records,
  allRecords,
  existingVias,
  currentUser,
  errorViaUids,
  fixedViaUids,
  onToggleViaError,
  onToggleViaFixed,
  onUpdateViaSharedNoteForAll,
  onUpdateViaReportNote,
  onUpdateRecord,
  onUpdateViaUidForAll,
  onUpdateStaffNameForAll,
  onUpdateFullViaForAll,
  onAddPageToVia,
  onEditRecord,
  onDeleteRecord,
  onDuplicateRecord,
  onDeleteStaffAllData,
  onTransferPageRecord,
  onTransferViaPages,
  onQuickTransferViaToStaff,
  availableStaffNames = [],
  onFetchPagesForVia,
}) => {
  const [copiedViaId, setCopiedViaId] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [mergeViaCells, setMergeViaCells] = useState<boolean>(true);
  const [editingStaffName, setEditingStaffName] = useState<{ [oldName: string]: string }>({});
  const [isEditingStaffNameMode, setIsEditingStaffNameMode] = useState<string | null>(null);

  // Chế độ màu sắc: 'multi-only' (Tập trung khối màu cho Via cầm chung page - Chuẩn khoa học)
  // 'all-vias' (Tô màu tất cả các Via riêng biệt) | 'monochrome' (Đơn sắc chuẩn bảng tính)
  const [colorMode, setColorMode] = useState<'multi-only' | 'all-vias' | 'monochrome'>('multi-only');

  // Sắp xếp khoa học: 'multi-first' (Nhóm các Via cầm chung 2+ page lên đầu mỗi nhân viên)
  // 'natural' (Giữ nguyên thứ tự danh sách)
  const [sortMode, setSortMode] = useState<'multi-first' | 'natural'>('multi-first');

  // Lọc nhanh theo loại Via: 'all' | 'multi' (chỉ via cầm chung) | 'single' (via 1 page) | 'unassigned' (chưa gán via)
  const [filterViaType, setFilterViaType] = useState<'all' | 'multi' | 'single' | 'unassigned'>('all');

  // Lọc nhanh theo nhân viên (Staff Scope Pill)
  const [selectedStaff, setSelectedStaff] = useState<string>('all');

  // Danh sách nhân viên bị thu gọn (Collapsible Staff)
  const [collapsedStaffSet, setCollapsedStaffSet] = useState<Set<string>>(new Set());

  // Phân trang: Mặc định 'all' để bảng hiển thị dài đầy đủ như cũ
  const [pageSize, setPageSize] = useState<number | 'all'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Chiều cao khung nhìn: Mặc định 'full' (không giới hạn, bảng dài như cũ)
  const [viewportHeight, setViewportHeight] = useState<'compact' | 'medium' | 'full'>('full');

  // Mật độ dòng: 'normal' (chuẩn như cũ) | 'compact' (siêu gọn)
  const [densityMode, setDensityMode] = useState<'compact' | 'normal'>('normal');

  // Modal thống kê Đăng Tay vs Tool theo từng nhân viên
  const [isPostingStatsModalOpen, setIsPostingStatsModalOpen] = useState(false);

  // State chỉnh sửa BM thủ công cho từng dòng Page
  const [editingBmRecordId, setEditingBmRecordId] = useState<string | null>(null);
  const [editingBmValue, setEditingBmValue] = useState<string>('');

  // 1. Thu thập danh sách tất cả BM hiện tại để làm list lựa chọn (loại bỏ phần sau dấu |)
  const existingBmList = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    const defaultBms = ['B-BM ANH QUYNH', 'E-BM BAO 2', 'BM Bao 1', 'BM 1 5K+', 'BM MY 1'];
    defaultBms.forEach((b) => {
      const clean = getCleanBmName(b);
      if (clean) {
        map.set(clean.toLowerCase(), { name: clean, count: 0 });
      }
    });
    const pool = allRecords && allRecords.length > 0 ? allRecords : records;
    pool.forEach((r) => {
      const b = getCleanBmName(r.bmNote);
      if (b) {
        const key = b.toLowerCase();
        if (map.has(key)) {
          map.get(key)!.count++;
        } else {
          map.set(key, { name: b, count: 1 });
        }
      }
    });
    return Array.from(map.values()).sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi')
    );
  }, [records, allRecords]);

  // 2. Map tra cứu BM theo Nick Via để tự động gợi ý mặc định nếu cùng Via đã có Page gắn BM
  const viaBmMap = useMemo(() => {
    const map = new Map<string, string>();
    const pool = allRecords && allRecords.length > 0 ? allRecords : records;
    pool.forEach((r) => {
      const uid = r.viaUid?.trim().toLowerCase();
      const bm = getCleanBmName(r.bmNote);
      if (uid && bm && !map.has(uid)) {
        map.set(uid, bm);
      }
    });
    return map;
  }, [records, allRecords]);

  // Thống kê Đăng Tay vs Tool & Đang làm vs Không làm cho từng nhân viên trên Bảng 1
  const staffPostingBreakdown = useMemo(() => {
    const map = new Map<string, {
      staffName: string;
      total: number;
      manualPages: number;
      toolPages: number;
      timerPages: number;
      doingPages: number;
      notDoingPages: number;
      doingRatio: number;
      manualActual: number;
      manualTarget: number;
      toolActual: number;
      toolTarget: number;
      totalActual: number;
      totalTarget: number;
      manualRatio: number;
      toolRatio: number;
      completionRate: number;
    }>();

    records.forEach((r) => {
      const s = r.staffName?.trim() || 'Chưa gán NV';
      if (!map.has(s)) {
        map.set(s, {
          staffName: s,
          total: 0,
          manualPages: 0,
          toolPages: 0,
          timerPages: 0,
          doingPages: 0,
          notDoingPages: 0,
          doingRatio: 0,
          manualActual: 0,
          manualTarget: 0,
          toolActual: 0,
          toolTarget: 0,
          totalActual: 0,
          totalTarget: 0,
          manualRatio: 0,
          toolRatio: 0,
          completionRate: 0,
        });
      }
      const item = map.get(s)!;
      item.total++;
      const isDoing = r.progressStatus
        ? r.progressStatus === 'Đang làm'
        : Boolean(r.isCompleted || (r.targetPosts > 0 && r.actualPosts >= r.targetPosts));
      if (isDoing) {
        item.doingPages++;
      } else {
        item.notDoingPages++;
      }
      if (r.postingMethod === 'Đăng Tay') {
        item.manualPages++;
        item.manualActual += (r.actualPosts || 0);
        item.manualTarget += (r.targetPosts || 0);
      } else if (r.postingMethod === 'Tool') {
        item.toolPages++;
        item.toolActual += (r.actualPosts || 0);
        item.toolTarget += (r.targetPosts || 0);
      } else if (r.postingMethod === 'Hẹn Giờ') {
        item.timerPages++;
      }
      item.totalActual += (r.actualPosts || 0);
      item.totalTarget += (r.targetPosts || 0);
    });

    const list = Array.from(map.values()).map((item) => {
      item.manualRatio = item.total > 0 ? Math.round((item.manualPages / item.total) * 100) : 0;
      item.toolRatio = item.total > 0 ? Math.round((item.toolPages / item.total) * 100) : 0;
      item.doingRatio = item.total > 0 ? Math.round((item.doingPages / item.total) * 100) : 0;
      item.completionRate = item.doingRatio;
      return item;
    });

    return list.sort((a, b) => b.total - a.total);
  }, [records]);

  // Map tra cứu nhanh thống kê đăng tay vs tool theo tên nhân viên
  const staffPostingMap = useMemo(() => {
    const map = new Map<string, (typeof staffPostingBreakdown)[0]>();
    staffPostingBreakdown.forEach((item) => {
      map.set(item.staffName.trim().toLowerCase(), item);
    });
    return map;
  }, [staffPostingBreakdown]);

  const totalManualInSheet = useMemo(() => records.filter((r) => r.postingMethod === 'Đăng Tay').length, [records]);
  const totalToolInSheet = useMemo(() => records.filter((r) => r.postingMethod === 'Tool').length, [records]);
  const totalDoingInSheet = useMemo(
    () =>
      records.filter((r) =>
        r.progressStatus
          ? r.progressStatus === 'Đang làm'
          : Boolean(r.isCompleted || (r.targetPosts > 0 && r.actualPosts >= r.targetPosts))
      ).length,
    [records]
  );
  const totalNotDoingInSheet = useMemo(() => records.length - totalDoingInSheet, [records, totalDoingInSheet]);

  // Danh sách nhân viên riêng biệt và số lượng page của họ
  const distinctStaff = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((r) => {
      const s = r.staffName?.trim();
      if (s) map.set(s, (map.get(s) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [records]);

  const toggleStaffCollapse = (staffName: string) => {
    setCollapsedStaffSet((prev) => {
      const next = new Set(prev);
      const key = staffName.trim().toLowerCase();
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const collapseAllStaff = () => {
    const all = new Set<string>();
    distinctStaff.forEach((st) => all.add(st.name.trim().toLowerCase()));
    setCollapsedStaffSet(all);
  };

  const expandAllStaff = () => {
    setCollapsedStaffSet(new Set());
  };

  // Group records so all rows of the same Staff stay contiguous,
  // and within each Staff, all rows of the same Via stay contiguous.
  // Supports collapsible staff accordion.
  const { displayItems, totalRecordCount } = useMemo(() => {
    const baseRecs = selectedStaff === 'all'
      ? records
      : records.filter((r) => r.staffName.trim().toLowerCase() === selectedStaff.trim().toLowerCase());

    const staffMap = new Map<string, PageRecord[]>();
    baseRecs.forEach((r) => {
      const s = r.staffName.trim();
      if (!staffMap.has(s)) staffMap.set(s, []);
      staffMap.get(s)!.push(r);
    });

    const items: SheetRowItem[] = [];
    let countTotal = 0;

    staffMap.forEach((staffRecs, staffName) => {
      const isStaffCollapsed = collapsedStaffSet.has(staffName.toLowerCase());

      if (isStaffCollapsed) {
        const vias = new Set(staffRecs.map((r) => r.viaUid.trim()).filter(Boolean));
        const deXuat = staffRecs.filter((r) => r.status === 'Đề Xuất').length;
        const matDeXuat = staffRecs.filter((r) => r.status === 'Mất Đề Xuất').length;
        const manualCount = staffRecs.filter((r) => r.postingMethod === 'Đăng Tay').length;
        const toolCount = staffRecs.filter((r) => r.postingMethod === 'Tool').length;
        const timerCount = staffRecs.filter((r) => r.postingMethod === 'Hẹn Giờ').length;
        const manualActual = staffRecs.filter((r) => r.postingMethod === 'Đăng Tay').reduce((s, r) => s + (r.actualPosts || 0), 0);
        const toolActual = staffRecs.filter((r) => r.postingMethod === 'Tool').reduce((s, r) => s + (r.actualPosts || 0), 0);
        const doingCount = staffRecs.filter((r) =>
          r.progressStatus
            ? r.progressStatus === 'Đang làm'
            : Boolean(r.isCompleted || (r.targetPosts > 0 && r.actualPosts >= r.targetPosts))
        ).length;
        const notDoingCount = staffRecs.length - doingCount;
        const errVias = new Set(
          staffRecs
            .filter(
              (r) =>
                r.isViaError ||
                r.viaStatus === 'checkpoint' ||
                r.viaStatus === 'dead' ||
                r.viaStatus === 'error' ||
                (errorViaUids && r.viaUid && errorViaUids.has(r.viaUid.trim().toLowerCase()))
            )
            .map((r) => r.viaUid.trim().toLowerCase())
            .filter(Boolean)
        );

        items.push({
          isCollapsedStaff: true,
          staffName,
          totalRecords: staffRecs.length,
          totalVias: vias.size,
          deXuatCount: deXuat,
          matDeXuatCount: matDeXuat,
          errorViaCount: errVias.size,
          manualCount,
          toolCount,
          timerCount,
          manualActual,
          toolActual,
          doingCount,
          notDoingCount,
        });
      } else {
        const viaMap = new Map<string, PageRecord[]>();
        const noViaRecs: PageRecord[] = [];

        staffRecs.forEach((r) => {
          const v = r.viaUid.trim();
          if (!v) {
            noViaRecs.push(r);
          } else {
            if (!viaMap.has(v)) viaMap.set(v, []);
            viaMap.get(v)!.push(r);
          }
        });

        const staffOrderedRecs: PageRecord[] = [];
        if (sortMode === 'multi-first') {
          const multiVias: PageRecord[][] = [];
          const singleVias: PageRecord[][] = [];

          viaMap.forEach((vRecs) => {
            if (vRecs.length > 1) {
              multiVias.push(vRecs);
            } else {
              singleVias.push(vRecs);
            }
          });

          multiVias.sort((a, b) => b.length - a.length);
          multiVias.forEach((vRecs) => staffOrderedRecs.push(...vRecs));
          singleVias.forEach((vRecs) => staffOrderedRecs.push(...vRecs));
          staffOrderedRecs.push(...noViaRecs);
        } else {
          viaMap.forEach((vRecs) => staffOrderedRecs.push(...vRecs));
          staffOrderedRecs.push(...noViaRecs);
        }

        const viaCountMap = new Map<string, number>();
        records.forEach((r) => {
          const v = r.viaUid.trim();
          if (v) viaCountMap.set(v, (viaCountMap.get(v) || 0) + 1);
        });

        const filteredStaffRecs = staffOrderedRecs.filter((r) => {
          if (filterViaType === 'all') return true;
          const v = r.viaUid.trim();
          if (filterViaType === 'unassigned') return !v;
          if (!v) return false;
          const cnt = viaCountMap.get(v) || 0;
          if (filterViaType === 'multi') return cnt > 1;
          if (filterViaType === 'single') return cnt === 1;
          return true;
        });

        filteredStaffRecs.forEach((r) => {
          items.push({ isCollapsedStaff: false, record: r });
          countTotal++;
        });
      }
    });

    return { displayItems: items, totalRecordCount: countTotal };
  }, [records, selectedStaff, collapsedStaffSet, sortMode, filterViaType, errorViaUids]);

  // Phân trang
  const totalItems = displayItems.length;
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalItems / (pageSize as number)));

  useEffect(() => {
    setCurrentPage(1);
  }, [filterViaType, sortMode, selectedStaff, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const startIndex = pageSize === 'all' ? 0 : (currentPage - 1) * (pageSize as number);
  const endIndex = pageSize === 'all' ? totalItems : Math.min(startIndex + (pageSize as number), totalItems);

  const paginatedItems = useMemo(() => {
    return displayItems.slice(startIndex, endIndex);
  }, [displayItems, startIndex, endIndex]);

  // Map to synchronize shared note for all pages under the same Via
  const viaSharedNotesMap = useMemo(() => {
    const map = new Map<string, string>();
    records.forEach((r) => {
      const uid = r.viaUid.trim().toLowerCase();
      if (uid && r.viaSharedNote) {
        map.set(uid, r.viaSharedNote);
      }
    });
    return map;
  }, [records]);

  // Map UID -> FullViaItem from Quản Trị Full Via (Bảng 4)
  const viaMapByUid = useMemo(() => {
    const map = new Map<string, FullViaItem>();
    if (!existingVias) return map;
    existingVias.forEach((v) => {
      if (v.uid) map.set(v.uid.trim().toLowerCase(), v);
    });
    return map;
  }, [existingVias]);

  // Map UID -> viaErrorNote across records in Fanpage table
  const viaReportNoteMap = useMemo(() => {
    const map = new Map<string, string>();
    const pool = allRecords && allRecords.length > 0 ? allRecords : records;
    pool.forEach((r) => {
      const uid = r.viaUid.trim().toLowerCase();
      if (uid && r.viaErrorNote && !map.has(uid)) {
        map.set(uid, r.viaErrorNote);
      }
    });
    return map;
  }, [records, allRecords]);

  // Lấy giá trị Ghi Chú Via đồng bộ giữa Quản Lý Page và Quản Trị Full Via
  const getEffectiveViaNote = (r: PageRecord): string => {
    const uidLower = (r.viaUid || '').trim().toLowerCase();
    const directNote = (r.viaErrorNote || (uidLower ? viaReportNoteMap.get(uidLower) : '') || '').trim();
    if (directNote) {
      const lower = directNote.toLowerCase();
      if (lower === 'vhh' || lower.includes('vhh') || lower.includes('vô hiệu')) return 'VHH';
      if (lower.includes('282')) return '282';
      if (lower.includes('956')) return '956';
      if (lower.includes('hạn chế') || lower.includes('han che')) return 'Hạn Chế';
      if (lower === 'live' || lower.includes('hoạt động tốt')) return 'Live';
      return directNote;
    }

    if (uidLower) {
      const matchedVia = viaMapByUid.get(uidLower);
      if (matchedVia) {
        if (matchedVia.adminReportStatus === 'VHH') return 'VHH';
        if (matchedVia.adminReportStatus === '282') return '282';
        if (matchedVia.adminReportStatus === '956') return '956';
        if (matchedVia.adminReportStatus === 'Hạn Chế') return 'Hạn Chế';
        if (matchedVia.adminReportStatus === 'Live') return 'Live';
        if (matchedVia.adminReportStatus && matchedVia.adminReportStatus !== 'None') {
          return matchedVia.adminReportStatus;
        }
        const vNote = (matchedVia.note || matchedVia.sharedNote || '').trim().toLowerCase();
        if (vNote === 'vhh' || vNote.includes('vhh')) return 'VHH';
        if (vNote.includes('282')) return '282';
        if (vNote.includes('956')) return '956';
        if (vNote.includes('hạn chế')) return 'Hạn Chế';
      }
    }

    const sharedLower = (r.viaSharedNote || (uidLower ? viaSharedNotesMap.get(uidLower) : '') || '')
      .trim()
      .toLowerCase();
    if (sharedLower === 'vhh' || sharedLower.startsWith('vhh ')) return 'VHH';
    if (sharedLower === '282' || sharedLower.includes('282')) return '282';
    if (sharedLower === '956' || sharedLower.includes('956')) return '956';
    if (sharedLower === 'hạn chế' || sharedLower.includes('hạn chế')) return 'Hạn Chế';

    return '';
  };

  const handleQuickUpdateViaNote = (record: PageRecord, newNote: string) => {
    const cleanUid = (record.viaUid || '').trim();
    if (onUpdateViaReportNote) {
      onUpdateViaReportNote(cleanUid, newNote, record);
    } else {
      const isErr = newNote === 'VHH' || newNote === '282' || newNote === '956';
      onUpdateRecord(record.id, {
        viaErrorNote: newNote,
        isViaError: isErr,
        isViaFixed: isErr ? false : record.isViaFixed,
        viaStatus:
          newNote === 'VHH'
            ? 'dead'
            : newNote === '282' || newNote === '956'
            ? 'checkpoint'
            : 'active',
      });
    }

    if (newNote === 'VHH') {
      setCopyToast(
        `🔴 Đã báo VHH cho Via ${cleanUid || record.pageName} & tự động cập nhật sang Quản Trị Full Via!`
      );
    } else if (newNote) {
      setCopyToast(
        `📢 Đã báo Ghi chú Via "${newNote}" cho UID ${cleanUid || record.pageName} & đồng bộ sang Quản Trị Full Via!`
      );
    } else {
      setCopyToast(`⚪ Đã xóa Ghi chú Via cho UID ${cleanUid || record.pageName} & đồng bộ Quản Trị Full Via.`);
    }
    setTimeout(() => setCopyToast(null), 2800);
  };

  // Global theme map for Via to ensure consistent colors across pages and filters
  const globalViaThemeMap = useMemo(() => {
    const map = new Map<string, number>();
    let multiCounter = 0;
    let allCounter = 0;

    const viaCountMap = new Map<string, number>();
    records.forEach((r) => {
      const v = r.viaUid.trim();
      if (v) viaCountMap.set(v, (viaCountMap.get(v) || 0) + 1);
    });

    records.forEach((r) => {
      const v = r.viaUid.trim();
      if (!v) return;
      if (!map.has(v)) {
        const count = viaCountMap.get(v) || 0;
        if (colorMode === 'multi-only') {
          if (count > 1) {
            map.set(v, multiCounter % VIA_THEMES.length);
            multiCounter++;
          } else {
            map.set(v, -1);
          }
        } else if (colorMode === 'all-vias') {
          map.set(v, allCounter % VIA_THEMES.length);
          allCounter++;
        } else {
          map.set(v, -1);
        }
      }
    });
    return map;
  }, [records, colorMode]);

  // Compute rowSpan for Staff name on the current visible page
  const staffSpans = useMemo(() => {
    const spans: { rowSpan: number; isFirst: boolean; totalInGroup: number }[] = [];
    let i = 0;
    while (i < paginatedItems.length) {
      const item = paginatedItems[i];
      if (item.isCollapsedStaff) {
        spans.push({ rowSpan: 1, isFirst: true, totalInGroup: 1 });
        i++;
        continue;
      }
      const recordItem = item as { isCollapsedStaff: false; record: PageRecord };
      const currentStaff = recordItem.record.staffName.trim().toLowerCase();
      let count = 1;
      while (
        i + count < paginatedItems.length &&
        !paginatedItems[i + count].isCollapsedStaff &&
        (paginatedItems[i + count] as { isCollapsedStaff: false; record: PageRecord }).record.staffName.trim().toLowerCase() === currentStaff
      ) {
        count++;
      }
      spans.push({ rowSpan: count, isFirst: true, totalInGroup: count });
      for (let j = 1; j < count; j++) {
        spans.push({ rowSpan: 0, isFirst: false, totalInGroup: count });
      }
      i += count;
    }
    return spans;
  }, [paginatedItems]);

  // Compute rowSpan and theme index for each distinct Via on current visible page
  const { viaSpans, rowViaThemeIndices } = useMemo(() => {
    const spans: {
      rowSpan: number;
      isFirst: boolean;
      isLast: boolean;
      totalInGroup: number;
      indexInGroup: number;
      groupIndex: number;
      isMultiPage: boolean;
      hasVia: boolean;
    }[] = [];
    const themeIndices: number[] = [];
    let i = 0;

    const viaCountMap = new Map<string, number>();
    records.forEach((r) => {
      const v = r.viaUid.trim();
      if (v) viaCountMap.set(v, (viaCountMap.get(v) || 0) + 1);
    });

    while (i < paginatedItems.length) {
      const item = paginatedItems[i];
      if (item.isCollapsedStaff) {
        spans.push({
          rowSpan: 1,
          isFirst: true,
          isLast: true,
          totalInGroup: 1,
          indexInGroup: 0,
          groupIndex: -1,
          isMultiPage: false,
          hasVia: false,
        });
        themeIndices.push(-1);
        i++;
        continue;
      }

      const recordItem = item as { isCollapsedStaff: false; record: PageRecord };
      const currentVia = recordItem.record.viaUid.trim();
      const currentStaff = recordItem.record.staffName.trim().toLowerCase();

      let count = 1;
      if (currentVia) {
        while (
          i + count < paginatedItems.length &&
          !paginatedItems[i + count].isCollapsedStaff &&
          (paginatedItems[i + count] as { isCollapsedStaff: false; record: PageRecord }).record.viaUid.trim() === currentVia &&
          (paginatedItems[i + count] as { isCollapsedStaff: false; record: PageRecord }).record.staffName.trim().toLowerCase() === currentStaff
        ) {
          count++;
        }
      }

      const totalInAll = currentVia ? (viaCountMap.get(currentVia) || 1) : 1;
      const isMultiPage = totalInAll > 1 && Boolean(currentVia);
      const hasVia = Boolean(currentVia);
      const themeIdx = currentVia ? (globalViaThemeMap.get(currentVia) ?? -1) : -1;

      for (let j = 0; j < count; j++) {
        spans.push({
          rowSpan: j === 0 ? count : 0,
          isFirst: j === 0,
          isLast: j === count - 1,
          totalInGroup: totalInAll,
          indexInGroup: j,
          groupIndex: themeIdx,
          isMultiPage,
          hasVia,
        });
        themeIndices.push(themeIdx);
      }

      i += count;
    }
    return { viaSpans: spans, rowViaThemeIndices: themeIndices };
  }, [paginatedItems, records, globalViaThemeMap]);

  // Statistics about Vias
  const viaStats = useMemo(() => {
    const viaMap = new Map<string, number>();
    let unassignedCount = 0;
    records.forEach((r) => {
      const uid = r.viaUid.trim();
      if (uid) {
        viaMap.set(uid, (viaMap.get(uid) || 0) + 1);
      } else {
        unassignedCount++;
      }
    });

    let multiPageCount = 0;
    let multiPagePages = 0;
    let singlePageCount = 0;

    viaMap.forEach((count) => {
      if (count > 1) {
        multiPageCount++;
        multiPagePages += count;
      } else {
        singlePageCount++;
      }
    });

    return {
      totalVias: viaMap.size,
      multiPageVias: multiPageCount,
      multiPagePages,
      singlePageVias: singlePageCount,
      unassignedPages: unassignedCount,
    };
  }, [records]);

  const handleCopyVia = async (uid: string, rowId: string) => {
    if (!uid) return;
    try {
      await navigator.clipboard.writeText(uid);
      setCopiedViaId(rowId);
      setTimeout(() => {
        setCopiedViaId((current) => (current === rowId ? null : current));
      }, 1800);
    } catch (err) {
      console.error('Không thể sao chép UID:', err);
    }
  };

  const handleCopyAllViaUids = async () => {
    const uniqueUids = Array.from(
      new Set(
        records
          .map((r) => r.viaUid?.trim())
          .filter(Boolean)
      )
    );

    if (uniqueUids.length === 0) {
      setCopyToast('⚠️ Không có UID Nick nào trên bảng để sao chép!');
      setTimeout(() => setCopyToast(null), 2500);
      return;
    }

    try {
      await navigator.clipboard.writeText(uniqueUids.join('\n'));
      setCopiedViaId('all-vias');
      setCopyToast(`📋 Đã sao chép tất cả ${uniqueUids.length} UID Nick Via (1 UID/dòng)!`);
      setTimeout(() => {
        setCopiedViaId((current) => (current === 'all-vias' ? null : current));
      }, 2500);
      setTimeout(() => setCopyToast(null), 3000);
    } catch (err) {
      console.error('Không thể sao chép UID:', err);
    }
  };

  const handleViaUidChange = (
    oldUid: string,
    newUid: string,
    recordId: string,
    isMerged: boolean
  ) => {
    if (isMerged && onUpdateViaUidForAll) {
      onUpdateViaUidForAll(oldUid, newUid);
    } else {
      onUpdateRecord(recordId, { viaUid: newUid });
    }
  };

  const handleSaveStaffRename = (oldName: string) => {
    const newName = (editingStaffName[oldName] || '').trim();
    if (newName && newName !== oldName && onUpdateStaffNameForAll) {
      onUpdateStaffNameForAll(oldName, newName);
    }
    setIsEditingStaffNameMode(null);
  };

  return (
    <div className="max-w-[1700px] mx-auto px-4 sm:px-6 py-3">
      {/* Top Spreadsheet Bar: Exactly 2 Compact & Scientific Rows */}
      <div className="flex flex-col gap-1.5 mb-2 px-1 text-xs">
        {/* DÒNG 1: Thống kê, Lọc loại Via & Thao tác chính */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-0.5">
          {/* Trái: Thống kê + Lọc loại Via + Nút thu gọn NV */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Badge Thống kê */}
            <span className="font-bold text-slate-800 inline-flex items-center space-x-1.5 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 text-[11px] shrink-0 select-none">
              <Layers className="w-3.5 h-3.5 text-emerald-700" />
              <span>{totalRecordCount} Page</span>
              <span className="text-slate-300">•</span>
              <span className="text-indigo-700 font-extrabold">{viaStats.totalVias} Via</span>
            </span>

            {/* Filter Pills: Lọc loại Via */}
            <div className="inline-flex items-center space-x-0.5 bg-white p-0.5 rounded-lg border border-slate-300 shadow-2xs">
              <button
                type="button"
                onClick={() => setFilterViaType('all')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  filterViaType === 'all'
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Tất cả ({records.length})
              </button>

              <button
                type="button"
                onClick={() => setFilterViaType(filterViaType === 'multi' ? 'all' : 'multi')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all inline-flex items-center space-x-1 cursor-pointer ${
                  filterViaType === 'multi'
                    ? 'bg-indigo-700 text-white shadow-2xs'
                    : 'text-indigo-800 hover:bg-indigo-50'
                }`}
                title="Lọc các Nick Via đang cầm từ 2 Fanpage trở lên"
              >
                <Sparkles className="w-3 h-3 text-indigo-400" />
                <span>Via Chung ({viaStats.multiPageVias})</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterViaType(filterViaType === 'single' ? 'all' : 'single')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all inline-flex items-center space-x-1 cursor-pointer ${
                  filterViaType === 'single'
                    ? 'bg-slate-700 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Lọc các Nick Via cầm 1 page riêng lẻ"
              >
                <User className="w-3 h-3 text-slate-400" />
                <span>1 Page ({viaStats.singlePageVias})</span>
              </button>

              {viaStats.unassignedPages > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterViaType(filterViaType === 'unassigned' ? 'all' : 'unassigned')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold border border-dashed transition-all cursor-pointer ${
                    filterViaType === 'unassigned'
                      ? 'bg-amber-700 text-white border-amber-800 shadow-2xs'
                      : 'text-amber-800 hover:bg-amber-50 border-amber-300'
                  }`}
                  title="Các fanpage chưa được gán Nick Via"
                >
                  Chưa Via ({viaStats.unassignedPages})
                </button>
              )}
            </div>

            {/* Thu gọn / Mở rộng tất cả nhân viên */}
            {distinctStaff.length > 1 && (
              <button
                type="button"
                onClick={collapsedStaffSet.size > 0 ? expandAllStaff : collapseAllStaff}
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 cursor-pointer shadow-2xs transition-colors shrink-0"
                title="Thu gọn hoặc mở rộng toàn bộ danh sách nhân viên để bảng cực ngắn gọn"
              >
                {collapsedStaffSet.size > 0 ? (
                  <>
                    <FolderPlus className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Mở NV</span>
                  </>
                ) : (
                  <>
                    <FolderMinus className="w-3.5 h-3.5 text-slate-500" />
                    <span>Thu gọn NV</span>
                  </>
                )}
              </button>
            )}
            {/* Nút Thống Kê Đăng Tay/Tool & Đang Làm/Không Làm từng nhân viên */}
            <button
              type="button"
              id="btn-posting-stats-modal-open"
              onClick={() => setIsPostingStatsModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-lg border text-[11px] font-black transition-all shadow-2xs cursor-pointer bg-teal-50 hover:bg-teal-100 text-teal-900 border-teal-300 shrink-0"
              title="Xem bảng thống kê Page Đang Làm / Không Làm và Đăng Tay / Tool của từng nhân viên"
            >
              <BarChart3 className="w-3.5 h-3.5 text-teal-700" />
              <span>📊 Thống kê NV:</span>
              <span className="text-emerald-700 bg-white px-1.5 py-0.1 rounded border border-emerald-300">
                🟢 {totalDoingInSheet} Đang làm
              </span>
              <span className="text-rose-700 bg-white px-1.5 py-0.1 rounded border border-rose-300">
                🔴 {totalNotDoingInSheet} Không làm
              </span>
              <span className="text-slate-600 hidden sm:inline">
                ({totalManualInSheet} Tay • {totalToolInSheet} Tool)
              </span>
            </button>
          </div>

          {/* Phải: Các thao tác chính (Lấy Page, Copy UID, Gộp ô) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {onFetchPagesForVia && (
              <button
                type="button"
                id="btn-fetch-pages-table-top"
                onClick={() => onFetchPagesForVia('', '')}
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg border text-[11px] font-bold transition-all shadow-2xs cursor-pointer bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-800 border-blue-300 shrink-0"
                title="Lấy Tên & Link Page từ Nick Via tự động điền lên bảng"
              >
                <Zap className="w-3 h-3 text-blue-600 fill-blue-600" />
                <span>⚡ Lấy Page</span>
              </button>
            )}

            <button
              type="button"
              id="btn-copy-all-fanpage-vias"
              onClick={handleCopyAllViaUids}
              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg border text-[11px] font-bold transition-all shadow-2xs cursor-pointer shrink-0 ${
                copiedViaId === 'all-vias'
                  ? 'bg-emerald-700 text-white border-emerald-800 ring-2 ring-emerald-600/30'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
              }`}
              title="Sao chép toàn bộ UID tài khoản nick Via trên bảng (danh sách không trùng lặp, 1 UID/dòng)"
            >
              {copiedViaId === 'all-vias' ? (
                <>
                  <Check className="w-3 h-3 text-emerald-100 stroke-[3]" />
                  <span>Đã Copy!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-indigo-600" />
                  <span>📋 Copy UID ({viaStats.totalVias})</span>
                </>
              )}
            </button>

            {/* View Mode Toggle: Gộp ô vs Tách ô */}
            <button
              type="button"
              id="btn-toggle-merge-via"
              onClick={() => setMergeViaCells(!mergeViaCells)}
              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg border text-[11px] font-bold transition-all shadow-2xs cursor-pointer shrink-0 ${
                mergeViaCells
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-800 ring-2 ring-emerald-600/30'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
              title="Bật/tắt gộp ô theo Via: 1 Via cầm nhiều Page cùng 1 màu hoặc tách riêng lẻ từng dòng"
            >
              {mergeViaCells ? (
                <>
                  <ToggleRight className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Gộp ô</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-3.5 h-3.5 text-slate-400" />
                  <span>Tách ô</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* DÒNG 2: Phân trang khoa học, Khung nhìn, Mật độ dòng & Sắp xếp / Chế độ màu */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pt-1 border-t border-slate-200">
          {/* Trái: Phân trang + Khung nhìn màn hình */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Phân trang ngắn gọn */}
            <div className="inline-flex items-center space-x-1 bg-white px-1.5 py-0.5 rounded-lg border border-slate-300 shadow-2xs">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Hàng:</span>
              {([10, 15, 25, 50, 'all'] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => {
                    setPageSize(sz);
                    setCurrentPage(1);
                  }}
                  className={`px-1.5 py-0.2 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    pageSize === sz
                      ? 'bg-[#2e7d32] text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title={sz === 'all' ? 'Hiển thị tất cả dòng' : `Hiển thị ${sz} dòng mỗi trang`}
                >
                  {sz === 'all' ? 'Tất cả' : sz}
                </button>
              ))}

              {pageSize !== 'all' && totalPages > 1 && (
                <div className="flex items-center space-x-1 pl-1 border-l border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-0.5 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    title="Trang trước"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-extrabold text-slate-800 px-1 py-0.1 bg-slate-100 rounded border border-slate-300 select-none">
                    {currentPage}/{totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-0.5 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    title="Trang sau"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Khung nhìn màn hình */}
            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-2xs items-center">
              <span className="text-[10px] text-slate-400 font-bold px-1 select-none">↕ Khung:</span>
              <button
                type="button"
                onClick={() => setViewportHeight('compact')}
                className={`px-1.5 py-0.2 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  viewportHeight === 'compact'
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Khung nhìn gọn 380px - Vừa vặn màn hình laptop"
              >
                Gọn
              </button>
              <button
                type="button"
                onClick={() => setViewportHeight('medium')}
                className={`px-1.5 py-0.2 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  viewportHeight === 'medium'
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Khung nhìn vừa 580px"
              >
                Vừa
              </button>
              <button
                type="button"
                onClick={() => setViewportHeight('full')}
                className={`px-1.5 py-0.2 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  viewportHeight === 'full'
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Khung nhìn tự do (toàn bộ dòng)"
              >
                Hết
              </button>
            </div>

            {/* Mật độ dòng */}
            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-2xs items-center">
              <button
                type="button"
                onClick={() => setDensityMode('compact')}
                className={`px-1.5 py-0.2 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  densityMode === 'compact'
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Mật độ siêu gọn: giảm khoảng cách dòng tối đa"
              >
                ⚡ Siêu gọn
              </button>
              <button
                type="button"
                onClick={() => setDensityMode('normal')}
                className={`px-1.5 py-0.2 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  densityMode === 'normal'
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Mật độ chuẩn Google Sheet"
              >
                Chuẩn
              </button>
            </div>

            {/* Phím cuộn ngang nhanh chống khuất cột */}
            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-2xs items-center gap-0.5">
              <span className="text-[10px] text-slate-500 font-bold px-1 select-none flex items-center gap-0.5">
                <ArrowRightLeft className="w-2.5 h-2.5 text-emerald-600" />
                <span>Xem cột:</span>
              </span>
              <button
                type="button"
                onClick={() => scrollContainerRef.current?.scrollTo({ left: 0, behavior: 'smooth' })}
                className="px-2 py-0.5 rounded text-[11px] font-bold text-slate-700 hover:text-emerald-900 hover:bg-emerald-50 transition-all cursor-pointer"
                title="Cuộn về đầu bảng (xem Tên NV, Nick Via, Tên Page)"
              >
                ◀ Đầu (Via/Page)
              </button>
              <button
                type="button"
                onClick={() => {
                  if (scrollContainerRef.current) {
                    const mid = (scrollContainerRef.current.scrollWidth - scrollContainerRef.current.clientWidth) / 2;
                    scrollContainerRef.current.scrollTo({ left: mid > 0 ? mid : 500, behavior: 'smooth' });
                  }
                }}
                className="px-2 py-0.5 rounded text-[11px] font-bold text-slate-700 hover:text-emerald-900 hover:bg-emerald-50 transition-all cursor-pointer"
                title="Cuộn đến giữa bảng (Trạng thái, Chặn, Đăng bài, Tương tác)"
              >
                ● Giữa (Trạng thái)
              </button>
              <button
                type="button"
                onClick={() => {
                  if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollTo({
                      left: scrollContainerRef.current.scrollWidth,
                      behavior: 'smooth',
                    });
                  }
                }}
                className="px-2 py-0.5 rounded text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer shadow-2xs"
                title="Cuộn về cuối bảng (xem Ghi chú BM, Tiến độ, Đổi Via, Thao tác)"
              >
                Cuối (BM/Đổi Via) ▶
              </button>
            </div>
          </div>

          {/* Phải: Sắp xếp khoa học & Chế độ màu */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Sắp xếp khoa học */}
            <button
              type="button"
              onClick={() => setSortMode(sortMode === 'multi-first' ? 'natural' : 'multi-first')}
              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg border text-[11px] font-bold transition-all shadow-2xs cursor-pointer shrink-0 ${
                sortMode === 'multi-first'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300 ring-1 ring-emerald-400'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
              title="Sắp xếp khoa học: Đưa tất cả các Via cầm từ 2 page trở lên lên trên đầu của mỗi nhân viên"
            >
              <ArrowUpDown className="w-3 h-3 text-emerald-600" />
              <span>{sortMode === 'multi-first' ? '🔗 Via chung trước' : 'Thứ tự gốc'}</span>
            </button>

            {/* Chế độ màu nền */}
            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-2xs items-center">
              <span className="text-[10px] text-slate-400 font-bold px-1 select-none">Màu:</span>
              <button
                type="button"
                onClick={() => setColorMode('multi-only')}
                className={`px-1.5 py-0.2 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  colorMode === 'multi-only'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Chỉ tô màu pastel cho Via cầm chung 2+ page"
              >
                ✨ Chung
              </button>
              <button
                type="button"
                onClick={() => setColorMode('all-vias')}
                className={`px-1.5 py-0.2 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  colorMode === 'all-vias'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tô màu tất cả các Via riêng biệt"
              >
                🎨 Tất Cả
              </button>
              <button
                type="button"
                onClick={() => setColorMode('monochrome')}
                className={`px-1.5 py-0.2 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  colorMode === 'monochrome'
                    ? 'bg-slate-700 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Đơn sắc trắng đen tối giản"
              >
                📋 Đơn Sắc
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Spreadsheet Container */}
      <div className="bg-white border-2 border-[#2e7d32] rounded-lg shadow-sm overflow-hidden">
        <div
          ref={scrollContainerRef}
          className={`overflow-x-auto overflow-y-auto ${
            viewportHeight === 'compact'
              ? 'max-h-[380px]'
              : viewportHeight === 'medium'
              ? 'max-h-[580px]'
              : 'max-h-none'
          }`}
        >
          <table className="w-full min-w-[1120px] border-collapse text-left text-xs font-sans">
            {/* Sheet row labels (A..O + Thao Tác = 16 columns) */}
            <thead className="sticky top-0 z-20 shadow-xs">
              <tr className="bg-[#f3f4f6] text-slate-500 text-[10px] font-mono border-b border-slate-300 h-5">
                <th className="w-8 min-w-[32px] px-0.5 py-0.5 text-center border-r border-slate-300 font-normal">#</th>
                <th className="w-18 min-w-[70px] max-w-[85px] px-0.5 py-0.5 text-center border-r border-slate-300 font-bold">B</th>
                <th className="w-56 min-w-[200px] max-w-[240px] px-1 py-0.5 text-center border-r border-slate-300 font-bold">C</th>
                <th className="w-32 min-w-[115px] max-w-[140px] px-1 py-0.5 text-center border-r border-slate-300 font-bold">D</th>
                <th className="w-20 min-w-[72px] max-w-[85px] px-0.5 py-0.5 text-center border-r border-slate-300 font-bold">E</th>
                <th className="w-24 min-w-[82px] max-w-[95px] px-0.5 py-0.5 text-center border-r border-slate-300 font-bold">F</th>
                <th className="w-11 min-w-[40px] max-w-[46px] px-0.5 py-0.5 text-center border-r border-slate-300 font-bold">G</th>
                <th className="w-20 min-w-[72px] max-w-[82px] px-0.5 py-0.5 text-center border-r border-slate-300 font-bold">H</th>
                <th className="w-20 min-w-[72px] max-w-[82px] px-0.5 py-0.5 text-center border-r border-slate-300 font-bold">I</th>
                <th className="w-14 min-w-[54px] max-w-[62px] px-0.5 py-0.5 text-center border-r border-slate-300 font-bold text-emerald-800">J</th>
                <th className="w-18 min-w-[66px] max-w-[76px] px-0.5 py-0.5 text-center border-r border-slate-300 font-bold text-emerald-800">K</th>
                <th className="w-20 min-w-[72px] max-w-[85px] px-0.5 py-0.5 text-center border-r border-slate-300 font-bold">L</th>
                <th className="w-11 min-w-[38px] max-w-[44px] px-0.5 py-0.5 text-center border-r border-slate-300 font-bold">M</th>
                <th className="w-36 min-w-[130px] max-w-[160px] px-1 py-0.5 text-center border-r border-slate-300 font-bold text-slate-700">N - BM</th>
                <th className="w-28 min-w-[104px] max-w-[122px] px-1 py-0.5 text-center border-r border-slate-300 font-bold text-rose-800 bg-rose-50/70">O - VIA</th>
                <th className="w-28 min-w-[100px] max-w-[118px] px-1 py-0.5 text-center border-r border-slate-300 font-bold text-amber-900 bg-amber-50/70">P</th>
                <th className="w-20 min-w-[70px] max-w-[85px] px-0.5 py-0.5 text-center font-normal border-l border-slate-300">Thao Tác</th>
              </tr>

              {/* Green Headers from Google Sheet */}
              <tr className="bg-[#38761d] text-white text-[11px] uppercase tracking-wider font-bold select-none border-b-2 border-slate-400 h-7">
                <th className="w-8 min-w-[32px] px-0.5 py-0.5 text-center border-r border-emerald-800/80">STT</th>
                <th className="w-18 min-w-[70px] max-w-[85px] px-0.5 py-0.5 border-r border-emerald-800/80 text-center">
                  <div className="flex flex-col items-center leading-tight">
                    <span>TÊN NV</span>
                    <span className="text-[7.5px] font-normal opacity-85 lowercase">
                      {mergeViaCells ? '(gộp ô)' : '(tách)'}
                    </span>
                  </div>
                </th>
                <th className="w-56 min-w-[200px] max-w-[240px] px-1 py-0.5 border-r border-emerald-800/80 text-left">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold tracking-tight text-[10px]">VIA & GHI CHÚ</span>
                    <button
                      type="button"
                      onClick={handleCopyAllViaUids}
                      className={`inline-flex items-center space-x-0.5 text-[8.5px] font-bold px-1 py-0.2 rounded border transition-all cursor-pointer ${
                        copiedViaId === 'all-vias'
                          ? 'bg-white text-emerald-900 border-white font-black shadow-2xs'
                          : 'bg-emerald-900/90 hover:bg-emerald-800 text-emerald-100 border-emerald-700/80'
                      }`}
                      title="Sao chép toàn bộ UID nick Via trên bảng"
                    >
                      <Copy className="w-2 h-2" />
                      <span>{copiedViaId === 'all-vias' ? 'Đã Copy!' : 'Copy'}</span>
                    </button>
                  </div>
                </th>

                <th className="w-32 min-w-[115px] max-w-[140px] px-1 py-0.5 border-r border-emerald-800/80 text-left text-[10.5px]">
                  TÊN PAGE
                </th>
                <th className="w-20 min-w-[72px] max-w-[85px] px-0.5 py-0.5 border-r border-emerald-800/80 text-left text-[10.5px]">
                  LINK
                </th>
                <th className="w-24 min-w-[82px] max-w-[95px] px-0.5 py-0.5 border-r border-emerald-800/80 text-center text-[10.5px]">
                  TRẠNG THÁI
                </th>
                <th className="w-11 min-w-[40px] max-w-[46px] px-0.5 py-0.5 border-r border-emerald-800/80 text-center text-[9.5px]">
                  NGÀY
                </th>
                <th className="w-20 min-w-[72px] max-w-[82px] px-0.5 py-0.5 border-r border-emerald-800/80 text-center text-[10.5px]">
                  CHẶN
                </th>
                <th className="w-20 min-w-[72px] max-w-[82px] px-0.5 py-0.5 border-r border-emerald-800/80 text-center text-[10.5px]" title="Đếm Like">
                  ĐẾM LIKE
                </th>
                <th className="w-14 min-w-[54px] max-w-[62px] px-0.5 py-0.5 border-r border-emerald-800/80 text-center text-[9.5px] leading-tight" title="Phương thức đăng bài (Đăng Tay / Tool)">
                  ĐĂNG BÀI
                </th>
                <th className="w-18 min-w-[66px] max-w-[76px] px-0.5 py-0.5 border-r border-emerald-800/80 text-center text-[9.5px]" title="Tiến độ (Đang làm / Không làm)">
                  TIẾN ĐỘ
                </th>
                <th className="w-20 min-w-[72px] max-w-[85px] px-0.5 py-0.5 border-r border-emerald-800/80 text-center text-[10.5px]">
                  TƯƠNG TÁC
                </th>
                <th className="w-11 min-w-[38px] max-w-[44px] px-0.5 py-0.5 border-r border-emerald-800/80 text-center text-[9px]" title="Ngày nhảy tự động theo ngày hiện tại khi chọn trạng thái cột tương tác">
                  <div className="flex flex-col items-center leading-none">
                    <span>NGÀY TT</span>
                  </div>
                </th>
                <th className="w-36 min-w-[130px] max-w-[160px] px-1 py-0.5 border-r border-emerald-800/80 text-left text-[10.5px]" title="Ghi chú BM">
                  <div className="flex items-center justify-between">
                    <span>GHI CHÚ BM</span>
                    <span className="text-[7.5px] font-normal opacity-90 bg-emerald-950/60 px-1 py-0.1 rounded border border-emerald-600/50 shrink-0">
                      {existingBmList.length} BM
                    </span>
                  </div>
                </th>
                <th className="w-28 min-w-[104px] max-w-[122px] px-1 py-0.5 border-r border-emerald-800/80 text-center bg-[#7f1d1d]" title="Ghi chú tình trạng Via (VHH, 282, 956, Hạn Chế) - Tự động đồng bộ sang Quản Trị Full Via">
                  <span className="font-extrabold tracking-tight text-[9.5px]">GHI CHÚ VIA</span>
                </th>
                <th className="w-28 min-w-[100px] max-w-[118px] px-1 py-0.5 border-r border-emerald-800/80 text-center bg-[#1d5212]" title="Ghi chú & trạng thái đổi Via (VD: Đang add, Đã xong)">
                  <span className="font-extrabold tracking-tight text-[9.5px]">ĐỔI VIA</span>
                </th>
                <th className="w-20 min-w-[70px] max-w-[85px] px-0.5 py-0.5 text-center text-[10px] bg-[#38761d] border-l border-emerald-800/80">
                  Thao Tác
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-300 text-slate-800">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={17} className="py-8 text-center text-slate-400 bg-white">
                    Không tìm thấy dòng nào phù hợp. Hãy đặt lại bộ lọc hoặc tạo thêm Page mới.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, index) => {
                  if (item.isCollapsedStaff) {
                    return (
                      <tr
                        key={`collapsed-staff-${item.staffName}`}
                        className="bg-emerald-50/90 hover:bg-emerald-100 border-y-2 border-emerald-400 font-sans transition-colors"
                      >
                        <td className="px-1 py-1 text-center border-r border-emerald-300 font-mono text-emerald-800 text-[10px] bg-emerald-100/50 select-none">
                          {startIndex + index + 1}
                        </td>
                        <td colSpan={16} className="px-2.5 py-1 text-xs text-emerald-950 font-bold">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => toggleStaffCollapse(item.staffName)}
                                className="px-2 py-0.5 rounded-md bg-white hover:bg-emerald-200 border border-emerald-300 text-emerald-900 font-bold inline-flex items-center space-x-1 text-[11px] cursor-pointer shadow-2xs"
                                title={`Bấm để mở rộng toàn bộ ${item.totalRecords} Fanpage của nhân viên ${item.staffName}`}
                              >
                                <ChevronRight className="w-3.5 h-3.5 text-emerald-700" />
                                <span>Mở rộng</span>
                              </button>
                              <span className="text-xs font-black text-emerald-900 flex items-center space-x-1">
                                <User className="w-3.5 h-3.5 text-emerald-700" />
                                <span>NV: {item.staffName}</span>
                              </span>
                              <span className="text-[10px] bg-white text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300 shadow-2xs">
                                📄 {item.totalRecords} Fanpage
                              </span>
                              <span className="text-[10px] bg-emerald-100 text-emerald-900 font-black px-2 py-0.5 rounded-full border border-emerald-300 shadow-2xs">
                                🟢 {item.doingCount} Đang làm
                              </span>
                              <span className="text-[10px] bg-rose-100 text-rose-900 font-black px-2 py-0.5 rounded-full border border-rose-300 shadow-2xs">
                                🔴 {item.notDoingCount} Không làm
                              </span>
                              <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200 shadow-2xs" title={`Đăng tay: ${item.manualCount} Fanpage`}>
                                ✍️ {item.manualCount} Đăng Tay
                              </span>
                              <span className="text-[10px] bg-purple-100 text-purple-900 font-black px-2 py-0.5 rounded-full border border-purple-300 shadow-2xs" title={`Đăng tool: ${item.toolCount} Fanpage`}>
                                🤖 {item.toolCount} Tool
                              </span>
                              <span className="text-[10px] bg-white text-indigo-800 font-bold px-2 py-0.5 rounded-full border border-indigo-300 shadow-2xs">
                                🔗 {item.totalVias} Nick Via
                              </span>
                              {item.deXuatCount > 0 && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                                  🚀 {item.deXuatCount} Đề Xuất
                                </span>
                              )}
                              {item.errorViaCount > 0 && (
                                <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full border border-rose-300">
                                  ⚠️ {item.errorViaCount} Via lỗi
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleStaffCollapse(item.staffName)}
                              className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer"
                            >
                              Mở rộng hàng ({item.totalRecords} Fanpage) ▾
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  const record = (item as { isCollapsedStaff: false; record: PageRecord }).record;
                  const isDone =
                    record.isCompleted ||
                    (record.targetPosts > 0 && record.actualPosts >= record.targetPosts);

                  const staffSpan = staffSpans[index] || {
                    rowSpan: 1,
                    isFirst: true,
                    totalInGroup: 1,
                  };

                  const viaSpan = viaSpans[index] || {
                    rowSpan: 1,
                    isFirst: true,
                    isLast: true,
                    totalInGroup: 1,
                    indexInGroup: 0,
                    groupIndex: -1,
                    isMultiPage: false,
                    hasVia: false,
                  };

                  const themeIndex = rowViaThemeIndices[index] ?? -1;
                  const theme = (() => {
                    if (themeIndex >= 0) {
                      return VIA_THEMES[themeIndex] || VIA_THEMES[0];
                    }
                    if (!viaSpan.hasVia) {
                      return UNASSIGNED_THEME;
                    }
                    return NEUTRAL_THEME;
                  })();

                  const shouldRenderStaffCell = !mergeViaCells || staffSpan.isFirst;
                  const staffRowSpan = mergeViaCells ? staffSpan.rowSpan : 1;

                  const shouldRenderViaCell = !mergeViaCells || viaSpan.isFirst;
                  const viaRowSpan = mergeViaCells ? viaSpan.rowSpan : 1;
                  const isGroupedVia = viaSpan.isMultiPage;

                  const isFirstOfStaff = staffSpan.isFirst;
                  const isFirstOfVia = viaSpan.isFirst;
                  const isLastOfVia = viaSpan.isLast;

                  // Border on top: strong green line between staff, clear theme border between vias, subtle dashed within same via
                  const topDividerClass = isFirstOfStaff && index > 0
                    ? 'border-t-2 border-[#2e7d32]'
                    : isFirstOfVia && index > 0
                    ? (isGroupedVia ? theme.topBorder : 'border-t border-slate-300')
                    : (isGroupedVia ? theme.innerBorder : 'border-t border-slate-200');

                  const bottomDividerClass = isGroupedVia && isLastOfVia
                    ? theme.bottomBorder
                    : 'border-b border-slate-300';

                  const isRowViaError = Boolean(
                    record.isViaError ||
                      record.viaStatus === 'checkpoint' ||
                      record.viaStatus === 'dead' ||
                      record.viaStatus === 'error' ||
                      (errorViaUids &&
                        record.viaUid &&
                        errorViaUids.has(record.viaUid.trim().toLowerCase()))
                  );

                  const isRowViaFixed = Boolean(
                    record.isViaFixed ||
                      record.viaStatus === 'fixed' ||
                      (fixedViaUids &&
                        record.viaUid &&
                        fixedViaUids.has(record.viaUid.trim().toLowerCase()))
                  );

                  const isCompact = densityMode === 'compact';
                  const cellPyClass = isCompact ? 'py-0.5' : 'py-1';

                  return (
                    <tr
                      key={record.id}
                      className={`transition-colors ${topDividerClass} ${bottomDividerClass} ${
                        isRowViaError
                          ? 'bg-rose-50/75 hover:bg-rose-100/75 border-l-4 border-l-rose-600'
                          : isRowViaFixed
                          ? 'bg-emerald-50/80 hover:bg-emerald-100/80 border-l-4 border-l-emerald-600'
                          : `${theme.rowBg} ${theme.rowHover} ${isGroupedVia ? theme.borderLeft : ''}`
                      }`}
                    >
                      {/* Col A: Row index */}
                      <td className={`px-1 ${cellPyClass} text-center border-r border-slate-300 font-mono text-slate-500 text-[10px] bg-slate-50/70 select-none`}>
                        {startIndex + index + 1}
                      </td>

                      {/* Col B: TÊN NV - VIẾT 1 LẦN DUY NHẤT KHI BẬT GỘP Ô HOẶC TỪNG DÒNG KHI TÁCH */}
                      {shouldRenderStaffCell && (
                        <td
                          rowSpan={staffRowSpan}
                          className={`px-1 ${cellPyClass} border-r border-slate-300 font-bold text-slate-900 align-middle bg-slate-50/95 text-center select-none shadow-2xs`}
                        >
                          <div className="flex flex-col items-center justify-center p-0.5 max-w-[88px] mx-auto">
                            {/* Staff Avatar with Initials */}
                            <div className="w-5 h-5 rounded-full bg-[#2e7d32] text-white font-bold flex items-center justify-center text-[10px] shadow-2xs mb-0.5 border border-emerald-700 shrink-0">
                              {record.staffName.trim().slice(0, 2).toUpperCase() || 'NV'}
                            </div>

                            {/* Staff Name display / edit */}
                            {currentUser.role === 'admin' && isEditingStaffNameMode === record.staffName ? (
                              <div className="flex flex-col items-center space-y-0.5 w-full">
                                <input
                                  type="text"
                                  autoFocus
                                  value={
                                    editingStaffName[record.staffName] !== undefined
                                      ? editingStaffName[record.staffName]
                                      : record.staffName
                                  }
                                  onChange={(e) =>
                                    setEditingStaffName({
                                      ...editingStaffName,
                                      [record.staffName]: e.target.value,
                                    })
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveStaffRename(record.staffName);
                                    if (e.key === 'Escape') setIsEditingStaffNameMode(null);
                                  }}
                                  className="w-full text-center px-1 py-0.5 text-xs font-bold bg-white border border-emerald-600 rounded shadow-2xs focus:outline-hidden"
                                />
                                <div className="flex items-center space-x-1">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveStaffRename(record.staffName)}
                                    className="px-1.5 py-0.2 bg-emerald-600 text-white rounded text-[9px] font-bold hover:bg-emerald-700"
                                  >
                                    Lưu
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setIsEditingStaffNameMode(null)}
                                    className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded text-[9px] hover:bg-slate-300"
                                  >
                                    Hủy
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="group flex flex-col items-center">
                                <div className="flex items-center justify-center space-x-0.5">
                                  <span className="font-bold text-slate-900 text-xs tracking-tight leading-tight truncate max-w-[70px]" title={record.staffName}>
                                    {record.staffName}
                                  </span>
                                  {/* Button to collapse this staff */}
                                  <button
                                    type="button"
                                    onClick={() => toggleStaffCollapse(record.staffName)}
                                    className="p-0.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                                    title={`Thu gọn toàn bộ hàng của nhân viên ${record.staffName}`}
                                  >
                                    <ChevronDown className="w-2.5 h-2.5 text-slate-500" />
                                  </button>
                                  {currentUser.role === 'admin' && onUpdateStaffNameForAll && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingStaffName({
                                          ...editingStaffName,
                                          [record.staffName]: record.staffName,
                                        });
                                        setIsEditingStaffNameMode(record.staffName);
                                      }}
                                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-emerald-700 transition-opacity cursor-pointer"
                                      title="Đổi tên nhân viên này cho toàn bộ bảng"
                                    >
                                      <Edit2 className="w-2.5 h-2.5" />
                                    </button>
                                  )}
                                  {currentUser.role === 'admin' && onDeleteStaffAllData && (
                                    <button
                                      type="button"
                                      onClick={() => onDeleteStaffAllData(record.staffName)}
                                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-600 transition-opacity cursor-pointer"
                                      title={`Chọn xóa toàn bộ dữ liệu (Fanpage, Via, Tài khoản) của NV "${record.staffName}"`}
                                    >
                                      <Trash2 className="w-2.5 h-2.5" />
                                    </button>
                                  )}
                                </div>
                                {(() => {
                                  const sInfo = staffPostingMap.get(record.staffName.trim().toLowerCase());
                                  return (
                                    <div className="flex flex-col items-center mt-0.5 space-y-0.5">
                                      {mergeViaCells && staffSpan.totalInGroup > 1 && (
                                        <span className="text-[9px] text-slate-500 font-semibold bg-white px-1.5 py-0.2 rounded-full border border-slate-200 shadow-2xs">
                                          {staffSpan.totalInGroup} Page
                                        </span>
                                      )}
                                      {sInfo && (
                                        <div
                                          onClick={() => setIsPostingStatsModalOpen(true)}
                                          className="flex flex-col items-center gap-0.5 text-[8.5px] font-bold cursor-pointer hover:opacity-85 transition-opacity"
                                          title={`Bấm để xem thống kê của ${sInfo.staffName}: ${sInfo.doingPages} Page Đang làm, ${sInfo.notDoingPages} Page Không làm (${sInfo.manualPages} Tay, ${sInfo.toolPages} Tool)`}
                                        >
                                          <div className="flex items-center gap-0.5">
                                            <span className="text-emerald-800 bg-emerald-100/90 px-1 py-0.1 rounded border border-emerald-300" title="Số Page Đang làm">
                                              🟢{sInfo.doingPages}
                                            </span>
                                            <span className="text-rose-800 bg-rose-100/90 px-1 py-0.1 rounded border border-rose-300" title="Số Page Không làm">
                                              🔴{sInfo.notDoingPages}
                                            </span>
                                          </div>
                                          {(sInfo.manualPages > 0 || sInfo.toolPages > 0) && (
                                            <div className="flex items-center gap-0.5">
                                              {sInfo.manualPages > 0 && (
                                                <span className="text-emerald-800 bg-white px-1 py-0.1 rounded border border-emerald-200">
                                                  ✍️{sInfo.manualPages}
                                                </span>
                                              )}
                                              {sInfo.toolPages > 0 && (
                                                <span className="text-purple-800 bg-white px-1 py-0.1 rounded border border-purple-200">
                                                  🤖{sInfo.toolPages}
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Col C: Via (UID) & GHI CHÚ CHUNG CHO CẢ VIA (CHO 2-3 PAGE CHUNG 1 VIA) */}
                      {shouldRenderViaCell && (
                        (() => {
                          const isThisViaError = Boolean(
                            record.isViaError ||
                              record.viaStatus === 'checkpoint' ||
                              record.viaStatus === 'dead' ||
                              record.viaStatus === 'error' ||
                              (errorViaUids &&
                                record.viaUid &&
                                errorViaUids.has(record.viaUid.trim().toLowerCase()))
                          );

                          const isThisViaFixed = Boolean(
                            record.isViaFixed ||
                              record.viaStatus === 'fixed' ||
                              (fixedViaUids &&
                                record.viaUid &&
                                fixedViaUids.has(record.viaUid.trim().toLowerCase()))
                          );

                          return (
                            <td
                              rowSpan={viaRowSpan}
                              className={`px-2 py-1.5 border-r border-slate-300 font-mono text-xs text-slate-800 align-top transition-all ${
                                isThisViaError
                                  ? 'bg-rose-100/95 border-l-4 border-l-rose-600 ring-1 ring-rose-500/40 text-rose-950'
                                  : isThisViaFixed
                                  ? 'bg-emerald-100/95 border-l-4 border-l-emerald-600 ring-2 ring-emerald-500/60 text-emerald-950 shadow-xs'
                                  : `${theme.cellBg} ${theme.borderLeft}`
                              }`}
                            >
                              <div className="flex flex-col space-y-1.5 py-0.5 w-full min-w-[195px] max-w-[230px]">
                                {/* UID input & Copy button */}
                                <div className="flex items-center space-x-1">
                                  <input
                                    type="text"
                                    value={record.viaUid}
                                    onChange={(e) =>
                                      handleViaUidChange(
                                        record.viaUid,
                                        e.target.value,
                                        record.id,
                                        mergeViaCells && isGroupedVia
                                      )
                                    }
                                    className={`w-full min-w-[90px] bg-white/95 hover:bg-white focus:bg-white border rounded px-1.5 py-0.5 font-mono focus:outline-hidden text-xs font-bold ${
                                      isThisViaError
                                        ? 'border-rose-400 focus:border-rose-600 text-rose-950 ring-1 ring-rose-300'
                                        : isThisViaFixed
                                        ? 'border-emerald-500 focus:border-emerald-700 text-emerald-950 ring-1 ring-emerald-400 font-black'
                                        : 'border-slate-300 focus:border-emerald-600'
                                    }`}
                                    placeholder="UID / Via"
                                    title={
                                      isGroupedVia
                                        ? `Nick Via đang cầm ${viaSpan.totalInGroup} Fanpage (Màu ${theme.name})`
                                        : `UID nick Via (Màu ${theme.name})`
                                    }
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleCopyVia(record.viaUid, record.id)}
                                    className={`px-1.5 py-0.5 rounded flex items-center shrink-0 border transition-all text-[10px] font-sans ${
                                      copiedViaId === record.id
                                        ? 'bg-emerald-600 text-white border-emerald-700 font-bold shadow-2xs'
                                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                                    }`}
                                    title={`Sao chép UID Via "${record.viaUid}"`}
                                  >
                                    {copiedViaId === record.id ? (
                                      <Check className="w-3 h-3 text-white" />
                                    ) : (
                                      <Copy className="w-3 h-3 text-slate-500" />
                                    )}
                                  </button>
                                </div>

                                {/* Badges and Controls for this Via */}
                                <div className="flex items-center justify-between flex-wrap gap-1">
                                  {isThisViaFixed ? (
                                    <span
                                      className="text-[9px] font-black px-1.5 py-0.5 rounded border border-emerald-600 bg-emerald-600 text-white shadow-2xs inline-flex items-center space-x-1"
                                      title="Admin đã sửa lỗi và thay via mới thành công (Đang bôi xanh)"
                                    >
                                      <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                                      <span>ĐÃ SỬA / THAY VIA</span>
                                    </span>
                                  ) : isThisViaError ? (
                                    <span
                                      className="text-[9px] font-black px-1.5 py-0.5 rounded border border-rose-700 bg-rose-600 text-white shadow-2xs inline-flex items-center space-x-1"
                                      title="Nick Via này đang bị báo lỗi trên toàn hệ thống"
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                                      <span>BỊ LỖI</span>
                                    </span>
                                  ) : isGroupedVia ? (
                                    <span
                                      className={`text-[9px] font-black px-1.5 py-0.5 rounded border inline-flex items-center space-x-1 shadow-2xs ${theme.badgeBg}`}
                                      title={`Khối Via cầm chung ${viaSpan.totalInGroup} Fanpage (Màu ${theme.name})`}
                                    >
                                      <Layers className="w-2.5 h-2.5 stroke-[2.5]" />
                                      <span>CẦM CHUNG {viaSpan.totalInGroup} PAGE</span>
                                      <span className={`w-1.5 h-1.5 rounded-full ${theme.dotColor}`}></span>
                                    </span>
                                  ) : viaSpan.hasVia ? (
                                    <span
                                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded border border-slate-200 bg-slate-100 text-slate-700 inline-flex items-center space-x-1"
                                      title="Nick Via này chỉ cầm 1 page riêng lẻ"
                                    >
                                      <User className="w-2.5 h-2.5 text-slate-400" />
                                      <span>1 Page đơn</span>
                                    </span>
                                  ) : (
                                    <span
                                      className="text-[9px] italic px-1.5 py-0.5 rounded border border-dashed border-slate-300 bg-slate-100 text-slate-400"
                                      title="Chưa gán UID Nick Via"
                                    >
                                      Chưa có Via
                                    </span>
                                  )}

                                  <div className="flex items-center space-x-0.5">
                                    {/* Quick toggle: Báo Lỗi / Gỡ Lỗi Via */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (onToggleViaError) {
                                          onToggleViaError(record.viaUid, !isThisViaError, record.id);
                                        } else {
                                          onUpdateRecord(record.id, {
                                            isViaError: !isThisViaError,
                                            viaStatus: !isThisViaError ? 'checkpoint' : 'active',
                                          });
                                        }
                                      }}
                                      className={`text-[9px] font-bold px-1 py-0.2 rounded border inline-flex items-center space-x-0.5 transition-all cursor-pointer ${
                                        isThisViaError
                                          ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700'
                                          : 'bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border-slate-300'
                                      }`}
                                      title={
                                        isThisViaError
                                          ? 'Nick Via đang báo lỗi! Nhấn để gỡ lỗi và chuyển về bình thường'
                                          : 'Nhấn để báo lỗi nick Via này'
                                      }
                                    >
                                      <AlertTriangle className={`w-2.5 h-2.5 ${isThisViaError ? 'text-white' : 'text-rose-600'}`} />
                                      <span>{isThisViaError ? 'Gỡ' : 'Lỗi'}</span>
                                    </button>

                                    {onAddPageToVia && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onAddPageToVia(record.viaUid, record.staffName)
                                        }
                                        className="text-[9px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded px-1 py-0.2 inline-flex items-center space-x-0.5 transition-colors shadow-2xs"
                                        title={`Thêm 1 Fanpage nữa vào nick Via "${record.viaUid}"`}
                                      >
                                        <Plus className="w-2 h-2 text-emerald-700" />
                                        <span>+Page</span>
                                      </button>
                                    )}

                                    {onTransferViaPages && (
                                      <button
                                        type="button"
                                        onClick={() => onTransferViaPages(record.viaUid)}
                                        className="text-[9px] font-bold text-indigo-800 hover:text-indigo-950 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 rounded px-1.5 py-0.2 inline-flex items-center space-x-0.5 transition-colors shadow-2xs cursor-pointer"
                                        title={`Chuyển Nick Via "${record.viaUid}" kèm toàn bộ ${viaSpan.totalInGroup} Page đang cầm + Full Via sang cho Nhân viên khác`}
                                      >
                                        <ArrowRightLeft className="w-2.5 h-2.5 text-indigo-600" />
                                        <span>Chuyển Via+{viaSpan.totalInGroup}P</span>
                                      </button>
                                    )}

                                    {currentUser.role === 'admin' &&
                                      record.viaUid?.trim() &&
                                      onQuickTransferViaToStaff && (
                                        <select
                                          value=""
                                          onChange={(e) => {
                                            const targetStaff = e.target.value;
                                            if (!targetStaff) return;
                                            onQuickTransferViaToStaff(record.viaUid, targetStaff);
                                          }}
                                          className="text-[9px] font-extrabold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-400 rounded px-1 py-0.2 cursor-pointer focus:outline-hidden shadow-2xs max-w-[92px]"
                                          title={`Giao nhanh UID "${record.viaUid}" + ${viaSpan.totalInGroup} Page + Full Via (trong Quản Trị Full Via) sang cho Nhân Viên khác`}
                                        >
                                          <option value="">⇄ Giao NV...</option>
                                          <option value={ADMIN_WAITING_POOL}>
                                            📦 Kho Chờ Admin
                                          </option>
                                          {availableStaffNames
                                            .filter(
                                              (name) =>
                                                !isAdminWaitingPool(name) &&
                                                name.trim().toLowerCase() !==
                                                  record.staffName.trim().toLowerCase()
                                            )
                                            .map((name) => (
                                              <option key={name} value={name}>
                                                👤 {name}
                                              </option>
                                            ))}
                                        </select>
                                      )}

                                    {onFetchPagesForVia && (
                                      <button
                                        type="button"
                                        onClick={() => onFetchPagesForVia(record.viaUid, record.staffName)}
                                        className="text-[9px] font-bold text-blue-700 hover:text-blue-950 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded px-1 py-0.2 inline-flex items-center space-x-0.5 transition-colors shadow-2xs cursor-pointer"
                                        title={`Lấy Tên & Link Page tự động từ Nick Via "${record.viaUid}" điền vào bảng`}
                                      >
                                        <Zap className="w-2 h-2 text-blue-600 fill-blue-600" />
                                        <span>Quét Page</span>
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Ô CHỌN: KHI ADMIN ĐÃ SỬA LỖI & THAY VIA MỚI -> BÔI MÀU XANH LÁ ĐỂ DỄ PHÂN BIỆT */}
                                <label
                                  className={`flex items-center space-x-1.5 px-2 py-1 rounded-md border text-[10px] font-extrabold cursor-pointer select-none transition-all shadow-2xs ${
                                    isThisViaFixed
                                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs ring-2 ring-emerald-400'
                                      : 'bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border-slate-300'
                                  }`}
                                  title="Bấm chọn: Admin đã sửa lỗi và thay via mới -> Bôi toàn bộ ô và dòng màu xanh lá để dễ phân biệt"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isThisViaFixed}
                                    onChange={() => {
                                      if (onToggleViaFixed) {
                                        onToggleViaFixed(record.viaUid, !isThisViaFixed, record.id);
                                      } else {
                                        onUpdateRecord(record.id, {
                                          isViaFixed: !isThisViaFixed,
                                          isViaError: false,
                                          viaStatus: !isThisViaFixed ? 'fixed' : 'active',
                                        });
                                      }
                                    }}
                                    className="w-3.5 h-3.5 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                                  />
                                  <span className="truncate">
                                    {isThisViaFixed ? '✓ ĐÃ SỬA & THAY VIA (BÔI XANH)' : 'Ô chọn: Đã sửa & thay via mới'}
                                  </span>
                                </label>

                                {/* Ô CHỌN NHANH BÁO CÁO GHI CHÚ VIA (VHH, 282, 956, Hạn Chế) ĐỒNG BỘ FULL VIA */}
                                {(() => {
                                  const effViaNote = getEffectiveViaNote(record);
                                  return (
                                    <div className="pt-1 border-t border-slate-300/80 flex flex-col space-y-1">
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="text-[9.5px] font-extrabold text-slate-700 shrink-0">
                                          📢 Báo Via:
                                        </span>
                                        <select
                                          value={effViaNote}
                                          onChange={(e) => handleQuickUpdateViaNote(record, e.target.value)}
                                          className={`w-full text-[10.5px] font-bold rounded-md px-1.5 py-0.5 border transition-all cursor-pointer focus:outline-hidden shadow-2xs ${
                                            effViaNote.toLowerCase().includes('vhh')
                                              ? 'bg-rose-600 text-white border-rose-700 ring-1 ring-rose-300'
                                              : effViaNote.includes('282')
                                              ? 'bg-amber-100 text-amber-900 border-amber-400'
                                              : effViaNote.includes('956')
                                              ? 'bg-purple-100 text-purple-900 border-purple-400'
                                              : effViaNote.toLowerCase().includes('hạn chế')
                                              ? 'bg-yellow-100 text-yellow-900 border-yellow-400'
                                              : effViaNote === 'Live'
                                              ? 'bg-emerald-100 text-emerald-900 border-emerald-400'
                                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                          }`}
                                          title="Báo tình trạng Via (Tự động cập nhật sang Quản Trị Full Via & Bảng Group)"
                                        >
                                          <option value="">- Trống -</option>
                                          <option value="VHH">🔴 VHH (Vô Hiệu Hóa)</option>
                                          <option value="282">🟠 282 (Checkpoint)</option>
                                          <option value="956">🟣 956 (Khóa Tím)</option>
                                          <option value="Hạn Chế">🟡 Hạn Chế / Spam</option>
                                          <option value="Live">🟢 Hoạt Động Tốt</option>
                                          {effViaNote &&
                                            !['VHH', '282', '956', 'Hạn Chế', 'Live'].includes(effViaNote) && (
                                              <option value={effViaNote}>{effViaNote}</option>
                                            )}
                                        </select>
                                      </div>

                                      {/* Ô GHI CHÚ CHUNG CHO 2 HAY 3 PAGE CHUNG 1 VIA */}
                                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-700">
                                        <span className="flex items-center space-x-1">
                                          <span>📝 Ghi chú chung cả via:</span>
                                        </span>
                                        {isGroupedVia && (
                                          <span className="text-[9px] text-emerald-800 font-bold bg-emerald-50 px-1 rounded border border-emerald-300">
                                            chung {viaSpan.totalInGroup} page
                                          </span>
                                        )}
                                      </div>
                                      <textarea
                                        rows={isGroupedVia ? 2 : 1}
                                        value={record.viaSharedNote ?? viaSharedNotesMap.get(record.viaUid.trim().toLowerCase()) ?? ''}
                                        onChange={(e) => {
                                          const newNote = e.target.value;
                                          if (onUpdateViaSharedNoteForAll) {
                                            onUpdateViaSharedNoteForAll(record.viaUid, newNote);
                                          } else {
                                            onUpdateRecord(record.id, { viaSharedNote: newNote });
                                          }
                                        }}
                                        placeholder="Ghi chú chung cho các page cùng via này..."
                                        className="w-full text-xs font-medium bg-white hover:bg-white focus:bg-white border border-slate-300 focus:border-emerald-600 rounded px-1.5 py-0.5 text-slate-800 focus:outline-hidden shadow-2xs resize-none"
                                        title="Ghi chú chung này áp dụng cho tất cả các Fanpage dùng chung nick Via này"
                                      />
                                    </div>
                                  );
                                })()}
                              </div>
                            </td>
                          );
                        })()
                      )}

                      {/* Col D: TÊN PAGE */}
                      <td className="px-1.5 py-1 border-r border-slate-300 whitespace-nowrap font-semibold text-slate-900">
                        <div className="flex items-center space-x-1">
                          {isGroupedVia && (
                            <span
                              className={`px-1.5 py-0.5 text-[9px] font-black rounded-md ${theme.chipBg} ${theme.chipText} border border-current/25 select-none shrink-0 shadow-2xs`}
                              title={`Fanpage thứ ${viaSpan.indexInGroup + 1} trong số ${viaSpan.totalInGroup} page của nick Via này`}
                            >
                              #{viaSpan.indexInGroup + 1}
                            </span>
                          )}
                          <input
                            type="text"
                            value={record.pageName}
                            onChange={(e) =>
                              onUpdateRecord(record.id, { pageName: e.target.value })
                            }
                            className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-emerald-600 rounded px-1 py-0.5 font-semibold focus:outline-hidden text-xs max-w-[140px] truncate"
                            placeholder="Tên Fanpage"
                            title={record.pageName}
                          />
                        </div>
                      </td>

                      {/* Col E: LINK PAGE - Compact and truncated */}
                      <td className="px-1.5 py-1 border-r border-slate-300 whitespace-nowrap">
                        <div className="flex items-center space-x-1 max-w-[105px]">
                          <a
                            href={record.pageLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            referrerPolicy="no-referrer"
                            className="text-blue-700 hover:text-blue-900 underline truncate block text-[11px] max-w-[82px]"
                            title={record.pageLink || 'Chưa có link'}
                          >
                            {record.pageLink ? (
                              record.pageLink.replace(/^https?:\/\/(www\.)?facebook\.com\//, 'fb/')
                            ) : (
                              <span className="text-slate-400 italic text-[10px]">chưa có</span>
                            )}
                          </a>
                          {record.pageLink && (
                            <a
                              href={record.pageLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              referrerPolicy="no-referrer"
                              className="text-blue-600 hover:text-blue-800 p-0.5 shrink-0"
                              title="Mở link page trong tab mới"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Col F: Trạng Thái (Dropdown Chip) */}
                      <td className="px-1 py-1 border-r border-slate-300 text-center whitespace-nowrap">
                        <div className="relative inline-block w-full">
                          <select
                            value={record.status}
                            onChange={(e) => {
                              const newStatus = e.target.value as PageStatus;
                              const now = new Date();
                              const todayDateStr = `${now.getDate()}/${now.getMonth() + 1}`;
                              onUpdateRecord(record.id, {
                                status: newStatus,
                                date: todayDateStr,
                              });
                            }}
                            className={`w-full appearance-none px-1 py-0.5 text-center font-bold rounded text-[11px] border focus:outline-hidden cursor-pointer ${getStatusBadgeStyle(
                              record.status
                            )}`}
                            title="Đổi trạng thái (Tự động cập nhật ngày bên cạnh sang ngày hôm nay)"
                          >
                            {PAGE_STATUS_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* Col G: Ngày */}
                      <td className="px-0.5 py-1 border-r border-slate-300 text-center whitespace-nowrap font-medium text-slate-700">
                        <div className="flex items-center justify-center space-x-0.5">
                          <input
                            type="text"
                            value={record.date}
                            onChange={(e) =>
                              onUpdateRecord(record.id, { date: e.target.value })
                            }
                            placeholder="15/9"
                            className="w-10 text-center bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-emerald-600 rounded px-0.5 py-0.5 focus:outline-hidden text-[11px] font-semibold"
                            title="Ngày ghi nhận (Tự động cập nhật khi đổi trạng thái)"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const now = new Date();
                              onUpdateRecord(record.id, {
                                date: `${now.getDate()}/${now.getMonth() + 1}`,
                              });
                            }}
                            className="p-0.5 text-slate-400 hover:text-emerald-700 rounded hover:bg-emerald-50 transition-colors"
                            title="Ghi nhận ngày hôm nay"
                          >
                            <Clock className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </td>

                      {/* Col H: CHẶN */}
                      <td className="px-1 py-1 border-r border-slate-300 text-center whitespace-nowrap">
                        <select
                          value={record.blockStatus}
                          onChange={(e) =>
                            onUpdateRecord(record.id, {
                              blockStatus: e.target.value as BlockStatus,
                            })
                          }
                          className={`w-full appearance-none px-1 py-0.5 text-center font-semibold rounded text-[11px] border focus:outline-hidden cursor-pointer ${getBlockBadgeStyle(
                            record.blockStatus
                          )}`}
                        >
                          {BLOCK_STATUS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Cột: ĐẾM LIKE (Bên cạnh cột Chặn) */}
                      <td className="px-1 py-1 border-r border-slate-300 text-center whitespace-nowrap">
                        <select
                          value={record.likeCountStatus || 'Đếm Like'}
                          onChange={(e) =>
                            onUpdateRecord(record.id, {
                              likeCountStatus: e.target.value as LikeCountStatus,
                            })
                          }
                          className={`w-full appearance-none px-1.5 py-0.5 text-center font-bold rounded text-[11px] border focus:outline-hidden cursor-pointer transition-colors shadow-2xs ${getLikeCountBadgeStyle(
                            record.likeCountStatus || 'Đếm Like'
                          )}`}
                          title={`Trạng thái: ${record.likeCountStatus || 'Đếm Like'} (Bấm để chuyển đổi giữa Đếm Like và Bỏ Đếm Like)`}
                        >
                          {LIKE_COUNT_OPTIONS.map((opt) => (
                            <option
                              key={opt}
                              value={opt}
                              className={
                                opt === 'Bỏ Đếm Like'
                                  ? 'bg-red-600 text-white font-bold'
                                  : 'bg-white text-slate-800 font-bold'
                              }
                            >
                              {opt}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Cột: ĐĂNG BÀI (Đăng Tay / Tool) - Nhỏ gọn */}
                      <td className="w-14 min-w-[54px] max-w-[62px] px-0.5 py-0.5 border-r border-slate-300 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center justify-center space-y-0.5 w-full">
                          <select
                            value={record.postingMethod}
                            onChange={(e) => {
                              const newMethod = e.target.value as PostingMethod;
                              const now = new Date();
                              const todayDateStr = `${now.getDate()}/${now.getMonth() + 1}`;
                              onUpdateRecord(record.id, {
                                postingMethod: newMethod,
                                ...(newMethod === 'Đăng Tay'
                                  ? { postingDate: record.postingDate || todayDateStr }
                                  : {}),
                              });
                            }}
                            className={`w-full appearance-none px-0.5 py-0.5 text-center font-bold rounded text-[10px] border focus:outline-hidden cursor-pointer transition-colors shadow-2xs ${getPostingMethodBadgeStyle(
                              record.postingMethod
                            )}`}
                            title={`Phương thức: ${record.postingMethod}${
                              record.postingMethod === 'Đăng Tay'
                                ? ` (Ngày chọn: ${record.postingDate || record.date || 'Hôm nay'})`
                                : ''
                            }`}
                          >
                            {POSTING_METHOD_OPTIONS.map((opt) => (
                              <option key={opt} value={opt} className="bg-white text-slate-800 font-bold">
                                {opt}
                              </option>
                            ))}
                          </select>

                          {/* Khi chọn Đăng Tay -> hiển thị ô ngày mini */}
                          {record.postingMethod === 'Đăng Tay' && (
                            <input
                              type="text"
                              value={
                                record.postingDate ??
                                record.date ??
                                `${new Date().getDate()}/${new Date().getMonth() + 1}`
                              }
                              onChange={(e) =>
                                onUpdateRecord(record.id, { postingDate: e.target.value })
                              }
                              placeholder={`${new Date().getDate()}/${new Date().getMonth() + 1}`}
                              className="w-full text-center bg-white border border-emerald-300 focus:border-emerald-600 rounded px-0.5 py-0 text-[8.5px] font-bold text-emerald-900 focus:outline-hidden shadow-2xs"
                              title="Ngày chọn Đăng Tay"
                            />
                          )}
                        </div>
                      </td>

                      {/* Cột: TIẾN ĐỘ (2 trạng thái: Đang làm / Không làm) */}
                      <td className="w-18 min-w-[66px] max-w-[76px] px-0.5 py-0.5 border-r border-slate-300 text-center whitespace-nowrap">
                        {(() => {
                          const currentProgress: ProgressStatus =
                            record.progressStatus || (isDone ? 'Đang làm' : 'Không làm');
                          return (
                            <select
                              value={currentProgress}
                              onChange={(e) => {
                                const newProg = e.target.value as ProgressStatus;
                                onUpdateRecord(record.id, {
                                  progressStatus: newProg,
                                  isCompleted: newProg === 'Đang làm',
                                });
                              }}
                              className={`w-full appearance-none px-1 py-0.5 text-center font-bold rounded text-[10px] border focus:outline-hidden cursor-pointer transition-colors shadow-2xs ${getProgressBadgeStyle(
                                currentProgress
                              )}`}
                              title={`Tiến độ: ${currentProgress} (Bấm để chuyển đổi Đang làm / Không làm)`}
                            >
                              {PROGRESS_STATUS_OPTIONS.map((opt) => (
                                <option
                                  key={opt}
                                  value={opt}
                                  className={
                                    opt === 'Không làm'
                                      ? 'bg-rose-600 text-white font-bold'
                                      : 'bg-white text-slate-800 font-bold'
                                  }
                                >
                                  {opt}
                                </option>
                              ))}
                            </select>
                          );
                        })()}
                      </td>

                      {/* Col L: TƯƠNG TÁC */}
                      <td className="px-1 py-1 border-r border-slate-300 text-center whitespace-nowrap">
                        <select
                          value={record.interaction}
                          onChange={(e) => {
                            const newInteraction = e.target.value as InteractionQuality;
                            const now = new Date();
                            const todayDateStr = `${now.getDate()}/${now.getMonth() + 1}`;
                            onUpdateRecord(record.id, {
                              interaction: newInteraction,
                              interactionDate: todayDateStr,
                            });
                          }}
                          className={`w-full appearance-none px-1 py-0.5 text-center font-semibold rounded text-[11px] border focus:outline-hidden cursor-pointer ${getInteractionBadgeStyle(
                            record.interaction
                          )}`}
                          title="Đổi trạng thái tương tác (Tự động cập nhật cột ngày tương tác bên cạnh sang ngày hôm nay)"
                        >
                          {INTERACTION_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Col M: NGÀY TT (Nhỏ gọn, tự động nhảy theo ngày hiện tại khi chọn trạng thái tương tác) */}
                      <td className="w-11 min-w-[38px] max-w-[44px] px-0.5 py-0.5 border-r border-slate-300 text-center whitespace-nowrap font-medium text-slate-700">
                        <input
                          type="text"
                          value={record.interactionDate ?? record.date ?? ''}
                          onChange={(e) =>
                            onUpdateRecord(record.id, { interactionDate: e.target.value })
                          }
                          onDoubleClick={() => {
                            const now = new Date();
                            onUpdateRecord(record.id, {
                              interactionDate: `${now.getDate()}/${now.getMonth() + 1}`,
                            });
                          }}
                          placeholder="16/9"
                          className="w-9 text-center bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-emerald-600 rounded px-0.5 py-0.5 focus:outline-hidden text-[10px] font-semibold"
                          title="Ngày TT (Tự động nhảy khi đổi tương tác, hoặc nhấp đúp để lấy ngày hôm nay)"
                        />
                      </td>

                      {/* Col M: GHI CHÚ BM (DANH SÁCH LỰA CHỌN TẤT CẢ BM HIỆN TẠI HOẶC THÊM MỚI, BỎ HẾT TỪ DẤU | PHÍA SAU) */}
                      <td className="px-1.5 py-1 border-r border-slate-300 whitespace-nowrap text-xs">
                        {editingBmRecordId === record.id ? (
                          <div className="flex items-center space-x-1 min-w-[125px] max-w-[160px]">
                            <input
                              type="text"
                              autoFocus
                              list="global-bm-datalist"
                              value={editingBmValue}
                              onChange={(e) => setEditingBmValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  onUpdateRecord(record.id, { bmNote: getCleanBmName(editingBmValue) });
                                  setEditingBmRecordId(null);
                                } else if (e.key === 'Escape') {
                                  setEditingBmRecordId(null);
                                }
                              }}
                              placeholder="Nhập tên BM..."
                              className="w-full px-1.5 py-0.5 text-xs font-bold bg-white border border-emerald-600 rounded shadow-2xs focus:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateRecord(record.id, { bmNote: getCleanBmName(editingBmValue) });
                                setEditingBmRecordId(null);
                              }}
                              className="px-1.5 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold hover:bg-emerald-700 shrink-0 cursor-pointer shadow-2xs"
                              title="Lưu tên BM (tự động bỏ ký tự sau dấu |)"
                            >
                              Lưu
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingBmRecordId(null)}
                              className="px-1 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] hover:bg-slate-300 shrink-0 cursor-pointer"
                              title="Hủy"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col space-y-0.5 min-w-[120px] max-w-[155px]">
                            <div className="flex items-center space-x-1">
                              <select
                                value={getCleanBmName(record.bmNote)}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '__custom_new_bm__') {
                                    setEditingBmValue(getCleanBmName(record.bmNote));
                                    setEditingBmRecordId(record.id);
                                  } else {
                                    onUpdateRecord(record.id, { bmNote: getCleanBmName(val) });
                                  }
                                }}
                                className={`w-full appearance-none px-1.5 py-0.5 rounded text-[11px] font-bold border focus:outline-hidden cursor-pointer transition-colors shadow-2xs truncate ${
                                  getCleanBmName(record.bmNote)
                                    ? 'bg-slate-50 text-slate-900 border-slate-300 hover:bg-white'
                                    : 'bg-amber-50/80 text-amber-900 border-amber-300/80 font-normal hover:bg-amber-100/70'
                                }`}
                                title={
                                  getCleanBmName(record.bmNote)
                                    ? `BM hiện tại: ${getCleanBmName(record.bmNote)}`
                                    : 'Chưa có BM - Chọn từ danh sách tất cả BM hiện tại hoặc thêm mới'
                                }
                              >
                                <option value="">— Chưa có BM —</option>
                                {existingBmList.map((bm) => (
                                  <option key={bm.name} value={bm.name}>
                                    {bm.name} {bm.count > 0 ? `(${bm.count})` : ''}
                                  </option>
                                ))}
                                {getCleanBmName(record.bmNote) &&
                                  !existingBmList.some(
                                    (b) => b.name.toLowerCase() === getCleanBmName(record.bmNote).toLowerCase()
                                  ) && (
                                    <option value={getCleanBmName(record.bmNote)}>
                                      {getCleanBmName(record.bmNote)}
                                    </option>
                                  )}
                                <option value="__custom_new_bm__">➕ Thêm BM mới...</option>
                              </select>

                              {/* Nút bút chì để gõ trực tiếp tên BM bất kỳ */}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingBmValue(getCleanBmName(record.bmNote));
                                  setEditingBmRecordId(record.id);
                                }}
                                className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors shrink-0 cursor-pointer"
                                title="Nhập hoặc đổi tên BM thủ công"
                              >
                                <Edit2 className="w-2.5 h-2.5" />
                              </button>
                            </div>

                            {/* Gợi ý nhanh: nếu Page này chưa có BM nhưng Nick Via này đã có Page khác gắn BM */}
                            {!getCleanBmName(record.bmNote) &&
                              record.viaUid &&
                              viaBmMap.has(record.viaUid.trim().toLowerCase()) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const suggested = viaBmMap.get(record.viaUid.trim().toLowerCase())!;
                                    onUpdateRecord(record.id, { bmNote: getCleanBmName(suggested) });
                                  }}
                                  className="text-[9.5px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded px-1 py-0.2 text-left truncate flex items-center gap-0.5 cursor-pointer shadow-2xs"
                                  title={`Bấm để lấy theo BM của cùng Via này: ${viaBmMap.get(
                                    record.viaUid.trim().toLowerCase()
                                  )}`}
                                >
                                  <span>✨ Theo Via:</span>
                                  <span className="truncate">
                                    {viaBmMap.get(record.viaUid.trim().toLowerCase())}
                                  </span>
                                </button>
                              )}
                          </div>
                        )}
                      </td>

                      {/* Col O: GHI CHÚ VIA (Tương tự cột Ghi chú bên Group: VHH, 282, 956, Hạn Chế - Đồng bộ Quản Trị Full Via) */}
                      <td className="w-28 min-w-[104px] max-w-[122px] px-1 py-0.5 border-r border-slate-300 text-center align-middle">
                        {(() => {
                          const effViaNote = getEffectiveViaNote(record);
                          return (
                            <select
                              value={effViaNote}
                              onChange={(e) => handleQuickUpdateViaNote(record, e.target.value)}
                              className={`w-full text-[10.5px] font-bold rounded-lg px-1.5 py-1 border transition-all cursor-pointer focus:ring-2 focus:ring-red-500 shadow-2xs ${
                                effViaNote.toLowerCase().includes('vhh')
                                  ? 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200'
                                  : effViaNote.includes('282')
                                  ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                                  : effViaNote.includes('956')
                                  ? 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200'
                                  : effViaNote.toLowerCase().includes('hạn chế')
                                  ? 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200'
                                  : effViaNote === 'Live'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                              }`}
                              title="Chọn ghi chú Via (VHH, 282, 956, Hạn Chế) - Tự động đồng bộ ngay vào Quản Trị Full Via để Admin nắm"
                            >
                              <option value="">- Trống -</option>
                              <option value="VHH">🔴 VHH (Vô Hiệu Hóa)</option>
                              <option value="282">🟠 282 (Checkpoint)</option>
                              <option value="956">🟣 956 (Khóa Tím)</option>
                              <option value="Hạn Chế">🟡 Hạn Chế / Spam</option>
                              <option value="Live">🟢 Hoạt Động Tốt</option>
                              {effViaNote &&
                                !['VHH', '282', '956', 'Hạn Chế', 'Live'].includes(effViaNote) && (
                                  <option value={effViaNote}>{effViaNote}</option>
                                )}
                            </select>
                          );
                        })()}
                      </td>

                      {/* Col P: GHI CHÚ ĐỔI VIA (Nhỏ gọn, khoa học) */}
                      <td
                        className={`w-28 min-w-[100px] max-w-[118px] px-1 py-0.5 border-r border-slate-300 transition-all align-middle ${getViaTransferCellStyle(
                          record.viaTransferStatus,
                          record.viaTransferColor
                        )}`}
                      >
                        <div className="flex flex-col space-y-0.5 w-full">
                          {/* Hàng 1: Trạng thái đổi via nhỏ gọn */}
                          <select
                            value={record.viaTransferStatus || 'none'}
                            onChange={(e) => {
                              const newStatus = e.target.value as ViaTransferStatus;
                              const now = new Date();
                              const timeStr = `${now.getDate()}/${now.getMonth() + 1} ${String(
                                now.getHours()
                              ).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                              const defaultColors: Record<ViaTransferStatus, ViaTransferColor> = {
                                none: 'gray',
                                adding: 'yellow',
                                completed: 'green',
                                pending: 'red',
                                invited: 'blue',
                                waiting: 'purple',
                                failed: 'red',
                              };
                              onUpdateRecord(record.id, {
                                viaTransferStatus: newStatus,
                                viaTransferColor: defaultColors[newStatus] || 'gray',
                                viaTransferUpdatedAt: timeStr,
                              });
                            }}
                            className={`w-full appearance-none px-1 py-0.5 rounded text-[9.5px] font-bold border focus:outline-hidden cursor-pointer transition-colors shadow-2xs text-center truncate ${
                              record.viaTransferStatus === 'adding'
                                ? 'bg-amber-400 text-amber-950 border-amber-500 font-black'
                                : record.viaTransferStatus === 'completed'
                                ? 'bg-emerald-600 text-white border-emerald-700 font-black'
                                : record.viaTransferStatus === 'pending'
                                ? 'bg-rose-600 text-white border-rose-700 font-black'
                                : record.viaTransferStatus === 'invited'
                                ? 'bg-sky-500 text-white border-sky-600'
                                : record.viaTransferStatus === 'waiting'
                                ? 'bg-purple-600 text-white border-purple-700'
                                : record.viaTransferStatus === 'failed'
                                ? 'bg-red-700 text-white border-red-800'
                                : 'bg-white text-slate-600 border-slate-300'
                            }`}
                            title={
                              record.viaTransferUpdatedAt
                                ? `Cập nhật: ${record.viaTransferUpdatedAt}`
                                : 'Chọn trạng thái đổi Via'
                            }
                          >
                            <option value="none">— Bình thường —</option>
                            <option value="adding">🟡 Đang add</option>
                            <option value="completed">🟢 Đã xong</option>
                            <option value="pending">🔴 Cần đổi</option>
                            <option value="invited">🔵 Đã mời</option>
                            <option value="waiting">🟣 Chờ duyệt</option>
                            <option value="failed">⚠️ Lỗi add</option>
                          </select>

                          {/* Hàng 2: Ô ghi chú ngắn gọn */}
                          <div className="flex items-center space-x-0.5">
                            <input
                              type="text"
                              value={record.viaTransferNote || ''}
                              onChange={(e) => {
                                const now = new Date();
                                const timeStr = `${now.getDate()}/${now.getMonth() + 1} ${String(
                                  now.getHours()
                                ).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                                onUpdateRecord(record.id, {
                                  viaTransferNote: e.target.value,
                                  viaTransferUpdatedAt: timeStr,
                                  ...(!record.viaTransferStatus || record.viaTransferStatus === 'none'
                                    ? { viaTransferStatus: 'adding', viaTransferColor: 'yellow' }
                                    : {}),
                                });
                              }}
                              placeholder="Ghi chú..."
                              className="w-full px-1 py-0.2 text-[9.5px] font-medium bg-white/90 focus:bg-white border border-slate-300 focus:border-emerald-600 rounded text-slate-800 placeholder-slate-400 focus:outline-hidden"
                              title={
                                record.viaTransferNote
                                  ? `Ghi chú: ${record.viaTransferNote}${
                                      record.viaTransferUpdatedAt ? ` (${record.viaTransferUpdatedAt})` : ''
                                    }`
                                  : 'Nhập ghi chú đổi Via'
                              }
                            />
                            {(record.viaTransferNote ||
                              (record.viaTransferStatus && record.viaTransferStatus !== 'none') ||
                              record.viaTransferColor) && (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateRecord(record.id, {
                                    viaTransferNote: '',
                                    viaTransferStatus: 'none',
                                    viaTransferColor: undefined,
                                    viaTransferUpdatedAt: undefined,
                                  })
                                }
                                className="p-0.5 text-slate-400 hover:text-rose-600 rounded shrink-0 cursor-pointer"
                                title="Xóa ghi chú & đặt lại"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-1 py-1 text-center whitespace-nowrap bg-white/50">
                        <div className="flex items-center justify-center space-x-0.5">
                          <button
                            type="button"
                            onClick={() => onDuplicateRecord(record)}
                            className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Nhân bản dòng này (thêm page cho cùng Via)"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          {onTransferPageRecord && (
                            <button
                              type="button"
                              onClick={() => onTransferPageRecord(record)}
                              className="p-0.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                              title={`Chuyển page "${record.pageName}" qua Via khác (bảo toàn toàn bộ thông tin page)`}
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onEditRecord(record)}
                            className="p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                            title="Chỉnh sửa chi tiết"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Xóa dòng page "${record.pageName}"?`)) {
                                onDeleteRecord(record.id);
                              }
                            }}
                            className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                            title="Xóa dòng"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Datalist gợi ý tự động cho tất cả BM hiện tại trong hệ thống */}
          <datalist id="global-bm-datalist">
            {existingBmList.map((bm) => (
              <option key={bm.name} value={bm.name} />
            ))}
          </datalist>
        </div>

        {/* Footer info with Pagination Navigation, Color Palette Guide & 4 Status Breakdown */}
        <div className="bg-slate-50 border-t border-slate-300 px-4 py-2.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs text-slate-600 font-sans">
          <div className="flex items-center flex-wrap gap-2">
            <span className="font-bold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200">
              Hiển thị: <strong>{paginatedItems.length > 0 ? `${startIndex + 1} - ${endIndex}` : 0}</strong> / <strong>{totalItems}</strong> hàng
              <span className="text-slate-400 font-normal"> (Tổng {records.length} Fanpage • {viaStats.totalVias} Via)</span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-emerald-700 font-semibold" title="Đề Xuất">
              🚀 <strong>{records.filter((r) => r.status === 'Đề Xuất').length}</strong> Đề Xuất
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-rose-700 font-semibold" title="Mất Đề Xuất">
              🔴 <strong>{records.filter((r) => r.status === 'Mất Đề Xuất').length}</strong> Mất ĐX
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-amber-800 font-semibold" title="Đình Chỉ">
              ⚠️ <strong>{records.filter((r) => r.status === 'Đình Chỉ').length}</strong> Đình Chỉ
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-purple-700 font-semibold" title="Bị Back">
              🟣 <strong>{records.filter((r) => r.status === 'Bị Back').length}</strong> Bị Back
            </span>
          </div>

          {/* Bottom Pagination Controls */}
          {pageSize !== 'all' && totalPages > 1 && (
            <div className="flex items-center space-x-1 shrink-0">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-[11px] font-bold rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Về trang đầu"
              >
                « Đầu
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 text-[11px] font-bold rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Trang trước"
              >
                ‹ Trước
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  const hasGap = prev && p - prev > 1;
                  return (
                    <React.Fragment key={p}>
                      {hasGap && <span className="px-1 text-slate-400">...</span>}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={`w-7 h-7 text-[11px] font-bold rounded border transition-colors cursor-pointer ${
                          currentPage === p
                            ? 'bg-emerald-700 text-white border-emerald-800 shadow-2xs'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-[11px] font-bold rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Trang sau"
              >
                Sau ›
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-[11px] font-bold rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Trang cuối"
              >
                Cuối »
              </button>
            </div>
          )}

          <div className="flex items-center space-x-2 text-[11px] flex-wrap">
            <span className="text-slate-600 font-semibold">🎨 Khối màu Via chung:</span>
            <div className="flex items-center space-x-1">
              {VIA_THEMES.map((t) => (
                <span
                  key={t.name}
                  className={`w-3.5 h-3.5 rounded-full ${t.dotColor} border border-white shadow-2xs`}
                  title={`Khối màu ${t.name}`}
                />
              ))}
            </div>
            <span className="text-slate-300">|</span>
            <span className="inline-flex items-center space-x-1 text-slate-600 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-white border border-slate-300 shadow-2xs" />
              <span>Nền trắng: Via 1 Page</span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="inline-flex items-center space-x-1 text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200 border border-dashed border-slate-400" />
              <span>Nền xám: Chưa có Via</span>
            </span>
          </div>
        </div>
      </div>

      {/* Toast thông báo sao chép UID */}
      {copyToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center space-x-2 text-xs font-semibold animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{copyToast}</span>
        </div>
      )}

      {/* Modal Bảng Đếm Thống Kê Page Đang Làm / Không Làm & Đăng Tay / Tool Từng Nhân Viên */}
      {isPostingStatsModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header Modal */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-700 via-emerald-700 to-indigo-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white font-black shadow-inner">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                    <span>Thống Kê Page Đang Làm / Không Làm & Phương Thức Đăng</span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
                      Bảng 1 (Sheet Fanpage)
                    </span>
                  </h3>
                  <p className="text-xs text-teal-100 mt-0.5">
                    Tổng hợp chi tiết số lượng Fanpage đang làm, không làm, đăng tay và đăng tool của từng nhân viên.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPostingStatsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
              {/* Dàn KPI tóm tắt */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-emerald-50 border-2 border-emerald-300 rounded-2xl">
                  <span className="text-[10px] font-black text-emerald-900 uppercase block">🟢 Tổng Page Đang Làm</span>
                  <span className="text-xl font-black text-emerald-700 font-mono mt-1 block">{totalDoingInSheet} Page</span>
                  <span className="text-[10px] text-emerald-700 font-bold">
                    {records.length > 0 ? Math.round((totalDoingInSheet / records.length) * 100) : 0}% tổng số Fanpage
                  </span>
                </div>

                <div className="p-3 bg-rose-50 border-2 border-rose-300 rounded-2xl">
                  <span className="text-[10px] font-black text-rose-900 uppercase block">🔴 Tổng Page Không Làm</span>
                  <span className="text-xl font-black text-rose-700 font-mono mt-1 block">{totalNotDoingInSheet} Page</span>
                  <span className="text-[10px] text-rose-700 font-bold">
                    {records.length > 0 ? Math.round((totalNotDoingInSheet / records.length) * 100) : 0}% tổng số Fanpage
                  </span>
                </div>

                <div className="p-3 bg-teal-50 border-2 border-teal-200 rounded-2xl">
                  <span className="text-[10px] font-black text-teal-900 uppercase block">✍️ Đăng Tay / 🤖 Tool</span>
                  <span className="text-xl font-black text-teal-800 font-mono mt-1 block">
                    {totalManualInSheet} Tay • {totalToolInSheet} Tool
                  </span>
                  <span className="text-[10px] text-teal-700 font-bold">
                    Trên tổng số {records.length} Fanpage
                  </span>
                </div>

                <div className="p-3 bg-blue-50 border-2 border-blue-200 rounded-2xl">
                  <span className="text-[10px] font-black text-blue-900 uppercase block">Tổng Nhân Sự Quản Lý</span>
                  <span className="text-xl font-black text-blue-800 font-mono mt-1 block">{staffPostingBreakdown.length} Nhân Viên</span>
                  <span className="text-[10px] text-blue-700 font-bold">Đang phụ trách {records.length} Page</span>
                </div>
              </div>

              {/* Bảng chi tiết từng nhân viên */}
              <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wide">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center text-slate-400">#</th>
                      <th className="py-2.5 px-3 min-w-[140px]">Nhân Viên</th>
                      <th className="py-2.5 px-3 text-center min-w-[85px]">Tổng Page</th>
                      <th className="py-2.5 px-3 bg-emerald-50 text-emerald-950 font-black text-center min-w-[115px]">
                        🟢 ĐANG LÀM
                      </th>
                      <th className="py-2.5 px-3 bg-rose-50 text-rose-950 font-black text-center min-w-[115px]">
                        🔴 KHÔNG LÀM
                      </th>
                      <th className="py-2.5 px-3 text-center min-w-[140px]">Tỷ Lệ Đang Làm</th>
                      <th className="py-2.5 px-3 bg-teal-50/60 text-teal-950 font-black text-center min-w-[110px]">
                        ✍️ ĐĂNG TAY
                      </th>
                      <th className="py-2.5 px-3 bg-purple-50/60 text-purple-950 font-black text-center min-w-[110px]">
                        🤖 ĐĂNG TOOL
                      </th>
                      <th className="py-2.5 px-3 text-center min-w-[95px]">Xem Chi Tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {staffPostingBreakdown.map((item, idx) => (
                      <tr key={item.staffName} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center space-x-2">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-600 to-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                              {item.staffName.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-black text-slate-900 text-xs">{item.staffName}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">
                          {item.total} Page
                        </td>
                        <td className="py-2.5 px-3 bg-emerald-50/40 text-center font-mono">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                            🟢 {item.doingPages} Page
                          </span>
                        </td>
                        <td className="py-2.5 px-3 bg-rose-50/40 text-center font-mono">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
                            🔴 {item.notDoingPages} Page
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="space-y-1">
                            <div className="w-full h-2.5 bg-rose-200 rounded-full overflow-hidden flex shadow-inner">
                              <div style={{ width: `${item.doingRatio}%` }} className="bg-emerald-500 h-full" />
                            </div>
                            <div className="text-[10px] font-mono font-bold flex justify-between">
                              <span className="text-emerald-700">{item.doingRatio}% Làm</span>
                              <span className="text-rose-700">{100 - item.doingRatio}% Nghỉ</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 bg-teal-50/20 text-center font-mono">
                          <strong className="text-teal-800 font-black">{item.manualPages} Page</strong>
                        </td>
                        <td className="py-2.5 px-3 bg-purple-50/20 text-center font-mono">
                          <strong className="text-purple-700 font-black">{item.toolPages} Page</strong>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStaff(item.staffName);
                              setIsPostingStatsModalOpen(false);
                            }}
                            className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                          >
                            Lọc Xem Page →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsPostingStatsModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
