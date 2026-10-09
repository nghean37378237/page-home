import React, { useState, useMemo, useEffect } from 'react';
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
} from 'lucide-react';
import {
  PageRecord,
  PageStatus,
  BlockStatus,
  LikeCountStatus,
  PostingMethod,
  InteractionQuality,
  AppUser,
} from '../types';
import {
  PAGE_STATUS_OPTIONS,
  BLOCK_STATUS_OPTIONS,
  LIKE_COUNT_OPTIONS,
  POSTING_METHOD_OPTIONS,
  INTERACTION_OPTIONS,
  getStatusBadgeStyle,
  getBlockBadgeStyle,
  getLikeCountBadgeStyle,
  getPostingMethodBadgeStyle,
  getInteractionBadgeStyle,
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

interface FanpageSheetTableProps {
  records: PageRecord[];
  currentUser: AppUser;
  errorViaUids?: Set<string>;
  fixedViaUids?: Set<string>;
  onToggleViaError?: (viaUid: string, isError: boolean, recordId?: string) => void;
  onToggleViaFixed?: (viaUid: string, isFixed: boolean, recordId?: string) => void;
  onUpdateViaSharedNoteForAll?: (viaUid: string, sharedNote: string) => void;
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
    };

export const FanpageSheetTable: React.FC<FanpageSheetTableProps> = ({
  records,
  currentUser,
  errorViaUids,
  fixedViaUids,
  onToggleViaError,
  onToggleViaFixed,
  onUpdateViaSharedNoteForAll,
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
  onFetchPagesForVia,
}) => {
  const [copiedViaId, setCopiedViaId] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);

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

  // Phân trang khoa học (Smart Pagination): Mặc định 10 dòng ngắn gọn, không chiếm quá nhiều màn hình
  const [pageSize, setPageSize] = useState<number | 'all'>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Chiều cao khung nhìn: 'compact' (max-h-[380px]) | 'medium' (max-h-[580px]) | 'full' (max-h-none)
  const [viewportHeight, setViewportHeight] = useState<'compact' | 'medium' | 'full'>('compact');

  // Mật độ dòng: 'compact' (siêu gọn, py-0.5, font 11px) | 'normal' (chuẩn)
  const [densityMode, setDensityMode] = useState<'compact' | 'normal'>('compact');

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
          className={`overflow-x-auto overflow-y-auto ${
            viewportHeight === 'compact'
              ? 'max-h-[380px]'
              : viewportHeight === 'medium'
              ? 'max-h-[580px]'
              : 'max-h-none'
          }`}
        >
          <table className="w-full border-collapse text-left text-xs font-sans">
            {/* Sheet row labels (A, B, C, D, E, F, G, H, I, J, K) */}
            <thead className="sticky top-0 z-20 shadow-xs">
              <tr className="bg-[#f3f4f6] text-slate-500 text-[10px] font-mono border-b border-slate-300 h-5">
                <th className="w-8 min-w-[34px] max-w-[36px] px-1 py-0.5 text-center border-r border-slate-300 font-normal">#</th>
                <th className="w-20 min-w-[80px] max-w-[90px] px-1 py-0.5 text-center border-r border-slate-300 font-bold">B</th>
                <th className="w-56 min-w-[210px] max-w-[240px] px-1 py-0.5 text-center border-r border-slate-300 font-bold">C</th>
                <th className="w-36 min-w-[125px] max-w-[145px] px-1 py-0.5 text-center border-r border-slate-300 font-bold">D</th>
                <th className="w-24 min-w-[95px] max-w-[110px] px-1 py-0.5 text-center border-r border-slate-300 font-bold">E</th>
                <th className="w-22 min-w-[85px] max-w-[95px] px-1 py-0.5 text-center border-r border-slate-300 font-bold">F</th>
                <th className="w-12 min-w-[50px] max-w-[55px] px-0.5 py-0.5 text-center border-r border-slate-300 font-bold">G</th>
                <th className="w-22 min-w-[82px] max-w-[92px] px-1 py-0.5 text-center border-r border-slate-300 font-bold">H</th>
                <th className="w-24 min-w-[88px] max-w-[98px] px-1 py-0.5 text-center border-r border-slate-300 font-bold">I</th>
                <th className="w-26 min-w-[96px] max-w-[110px] px-1 py-0.5 text-center border-r border-slate-300 font-bold">J</th>
                <th className="w-18 min-w-[70px] max-w-[80px] px-1 py-0.5 text-center border-r border-slate-300 font-bold">K</th>
                <th className="w-12 min-w-[52px] max-w-[58px] px-0.5 py-0.5 text-center border-r border-slate-300 font-bold">L</th>
                <th className="w-24 min-w-[90px] max-w-[105px] px-1 py-0.5 text-center border-r border-slate-300 font-bold">M</th>
                <th className="w-28 min-w-[105px] max-w-[115px] px-1 py-0.5 text-center border-r border-slate-300 font-bold text-blue-700">TIẾN ĐỘ</th>
                <th className="w-16 min-w-[65px] max-w-[75px] px-0.5 py-0.5 text-center font-normal">Thao Tác</th>
              </tr>

              {/* Green Headers from Google Sheet */}
              <tr className="bg-[#38761d] text-white text-[11px] uppercase tracking-wider font-bold select-none border-b-2 border-slate-400 h-7">
                <th className="w-8 min-w-[34px] max-w-[36px] px-1 py-0.5 text-center border-r border-emerald-800/80">STT</th>
                <th className="w-20 min-w-[80px] max-w-[90px] px-1 py-0.5 border-r border-emerald-800/80 text-center">
                  <div className="flex flex-col items-center leading-tight">
                    <span>TÊN NV</span>
                    <span className="text-[8px] font-normal opacity-85 lowercase">
                      {mergeViaCells ? '(gộp ô)' : '(tách ô)'}
                    </span>
                  </div>
                </th>
                <th className="w-56 min-w-[210px] max-w-[240px] px-1.5 py-0.5 border-r border-emerald-800/80 text-left">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold tracking-tight">VIA (UID) & GHI CHÚ CHUNG</span>
                    <button
                      type="button"
                      onClick={handleCopyAllViaUids}
                      className={`inline-flex items-center space-x-1 text-[9px] font-bold px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                        copiedViaId === 'all-vias'
                          ? 'bg-white text-emerald-900 border-white font-black shadow-2xs'
                          : 'bg-emerald-900/90 hover:bg-emerald-800 text-emerald-100 border-emerald-700/80'
                      }`}
                      title="Sao chép toàn bộ UID nick Via trên bảng (1 UID / dòng)"
                    >
                      <Copy className="w-2.5 h-2.5" />
                      <span>{copiedViaId === 'all-vias' ? 'Đã Copy!' : 'Copy UID'}</span>
                    </button>
                  </div>
                </th>

                <th className="w-36 min-w-[125px] max-w-[145px] px-1.5 py-0.5 border-r border-emerald-800/80 text-left">
                  TÊN PAGE
                </th>
                <th className="w-24 min-w-[95px] max-w-[110px] px-1.5 py-0.5 border-r border-emerald-800/80 text-left">
                  LINK PAGE
                </th>
                <th className="w-22 min-w-[85px] max-w-[95px] px-1 py-0.5 border-r border-emerald-800/80 text-center">
                  <span>Trạng Thái</span>
                </th>
                <th className="w-12 min-w-[50px] max-w-[55px] px-0.5 py-0.5 border-r border-emerald-800/80 text-center">
                  Ngày
                </th>
                <th className="w-22 min-w-[82px] max-w-[92px] px-1 py-0.5 border-r border-emerald-800/80 text-center">
                  CHẶN
                </th>
                <th className="w-24 min-w-[88px] max-w-[98px] px-1 py-0.5 border-r border-emerald-800/80 text-center" title="Đếm Like: Có 2 trạng thái 'Đếm Like' (mặc định) và 'Bỏ Đếm Like'">
                  ĐẾM LIKE
                </th>
                <th className="w-26 min-w-[96px] max-w-[110px] px-1 py-0.5 border-r border-emerald-800/80 text-center" title="Phương thức đăng: Đăng Tay / Tool / Hẹn Giờ. Khi chọn Đăng Tay sẽ tự động ghi nhận và hiển thị ngày chọn">
                  <div className="flex flex-col items-center leading-tight">
                    <span>ĐĂNG BÀI</span>
                    <span className="text-[8px] font-normal opacity-85 lowercase">(tay / tool)</span>
                  </div>
                </th>
                <th className="w-18 min-w-[70px] max-w-[80px] px-1 py-0.5 border-r border-emerald-800/80 text-center">
                  TƯƠNG TÁC
                </th>
                <th className="w-12 min-w-[52px] max-w-[58px] px-0.5 py-0.5 border-r border-emerald-800/80 text-center" title="Ngày nhảy tự động theo ngày hiện tại khi chọn trạng thái cột tương tác">
                  <div className="flex flex-col items-center leading-tight">
                    <span>NGÀY TT</span>
                    <span className="text-[8px] font-normal opacity-85 lowercase">(tự nhảy)</span>
                  </div>
                </th>
                <th className="w-24 min-w-[90px] max-w-[105px] px-1.5 py-0.5 border-r border-emerald-800/80 text-left">
                  GHI CHÚ BM
                </th>
                <th className="w-28 min-w-[105px] max-w-[115px] px-1 py-0.5 border-r border-emerald-800/80 text-center bg-[#255e11]">
                  TIẾN ĐỘ
                </th>
                <th className="w-16 min-w-[65px] max-w-[75px] px-0.5 py-0.5 text-center">Thao Tác</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-300 text-slate-800">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={16} className="py-8 text-center text-slate-400 bg-white">
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
                        <td colSpan={15} className="px-2.5 py-1 text-xs text-emerald-950 font-bold">
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
                                {mergeViaCells && staffSpan.totalInGroup > 1 && (
                                  <span className="text-[9px] text-slate-500 font-semibold bg-white px-1.5 py-0.2 rounded-full border border-slate-200 mt-0.5 shadow-2xs">
                                    {staffSpan.totalInGroup} Page
                                  </span>
                                )}
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
                                        className="text-[9px] font-bold text-indigo-700 hover:text-indigo-950 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded px-1 py-0.2 inline-flex items-center space-x-0.5 transition-colors shadow-2xs cursor-pointer"
                                        title={`Chuyển tất cả page của Nick Via "${record.viaUid}" sang Via khác`}
                                      >
                                        <ArrowRightLeft className="w-2 h-2 text-indigo-600" />
                                        <span>Chuyển</span>
                                      </button>
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

                                {/* Ô GHI CHÚ CHUNG CHO 2 HAY 3 PAGE CHUNG 1 VIA (CHUNG CHO CẢ VIA) */}
                                <div className="pt-1 border-t border-slate-300/80 flex flex-col space-y-0.5">
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

                      {/* Col J: ĐĂNG TAY, TOOL */}
                      <td className="px-1 py-1 border-r border-slate-300 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center justify-center space-y-1">
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
                            className={`w-full appearance-none px-1.5 py-0.5 text-center font-bold rounded text-[11px] border focus:outline-hidden cursor-pointer transition-colors shadow-2xs ${getPostingMethodBadgeStyle(
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

                          {/* Khi chọn Đăng Tay -> hiển thị ngày chọn: Đăng Tay */}
                          {record.postingMethod === 'Đăng Tay' && (
                            <div
                              className="flex items-center justify-center space-x-0.5 px-1 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-bold shadow-2xs w-full"
                              title="Ngày chọn: Đăng Tay (Tự động lưu ngày khi chọn Đăng Tay, có thể chỉnh sửa)"
                            >
                              <span className="text-[9px] text-emerald-700 font-semibold shrink-0">
                                Ngày:
                              </span>
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
                                className="w-9 text-center bg-white border border-emerald-300 focus:border-emerald-600 rounded px-0.5 py-0.2 text-[10px] font-bold text-emerald-900 focus:outline-hidden"
                                title="Ngày chọn Đăng Tay (Tự động ghi nhận ngày khi chọn Đăng Tay)"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const now = new Date();
                                  onUpdateRecord(record.id, {
                                    postingDate: `${now.getDate()}/${now.getMonth() + 1}`,
                                  });
                                }}
                                className="p-0.5 text-emerald-700 hover:text-emerald-950 hover:bg-emerald-100 rounded transition-colors shrink-0"
                                title="Cập nhật ngày chọn Đăng Tay thành hôm nay"
                              >
                                <Clock className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Col J: TƯƠNG TÁC */}
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

                      {/* Col K: NGÀY TƯƠNG TÁC (Tự động nhảy theo ngày hiện tại khi chọn trạng thái tương tác) */}
                      <td className="px-0.5 py-1 border-r border-slate-300 text-center whitespace-nowrap font-medium text-slate-700">
                        <div className="flex items-center justify-center space-x-0.5">
                          <input
                            type="text"
                            value={record.interactionDate ?? record.date ?? ''}
                            onChange={(e) =>
                              onUpdateRecord(record.id, { interactionDate: e.target.value })
                            }
                            placeholder="16/9"
                            className="w-10 text-center bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-emerald-600 rounded px-0.5 py-0.5 focus:outline-hidden text-[11px] font-semibold"
                            title="Ngày cập nhật tương tác (Tự động nhảy theo ngày hiện tại khi chọn trạng thái tương tác)"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const now = new Date();
                              onUpdateRecord(record.id, {
                                interactionDate: `${now.getDate()}/${now.getMonth() + 1}`,
                              });
                            }}
                            className="p-0.5 text-slate-400 hover:text-emerald-700 rounded hover:bg-emerald-50 transition-colors"
                            title="Ghi nhận ngày tương tác hôm nay"
                          >
                            <Clock className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </td>

                      {/* Col L: GHI CHÚ BM */}
                      <td className="px-1.5 py-1 border-r border-slate-300 whitespace-nowrap text-xs">
                        <input
                          type="text"
                          value={record.bmNote}
                          onChange={(e) =>
                            onUpdateRecord(record.id, { bmNote: e.target.value })
                          }
                          className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-emerald-600 rounded px-1 py-0.5 text-slate-700 font-medium focus:outline-hidden text-xs max-w-[100px] truncate"
                          placeholder="Ghi chú..."
                        />
                      </td>

                      {/* Tiến độ Đăng Bài Hôm Nay */}
                      <td className="px-1 py-1 border-r border-slate-300 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1">
                          {/* Minus 1 */}
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateRecord(record.id, {
                                actualPosts: Math.max(0, record.actualPosts - 1),
                                isCompleted:
                                  Math.max(0, record.actualPosts - 1) >= record.targetPosts,
                              })
                            }
                            className="w-4 h-4 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center"
                            title="Giảm 1 bài"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>

                          {/* Actual / Target posts */}
                          <span className="font-bold text-slate-900 text-[11px] w-10 text-center">
                            {record.actualPosts}/{record.targetPosts}
                          </span>

                          {/* Plus 1 */}
                          <button
                            type="button"
                            onClick={() => {
                              const next = record.actualPosts + 1;
                              onUpdateRecord(record.id, {
                                actualPosts: next,
                                isCompleted: next >= record.targetPosts,
                              });
                            }}
                            className="w-4 h-4 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center"
                            title="Tăng 1 bài"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>

                          {/* 1-Click Status Badge */}
                          <button
                            type="button"
                            onClick={() => {
                              const newDone = !isDone;
                              onUpdateRecord(record.id, {
                                isCompleted: newDone,
                                actualPosts: newDone
                                  ? Math.max(record.targetPosts, record.actualPosts)
                                  : record.actualPosts,
                              });
                            }}
                            className={`ml-0.5 inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                              isDone
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                            }`}
                            title="Bấm để đổi trạng thái hoàn thành bài đăng hôm nay"
                          >
                            {isDone ? (
                              <>
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                <span>Xong</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-2.5 h-2.5 text-rose-500" />
                                <span>Chưa</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-0.5 py-1 text-center whitespace-nowrap">
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
    </div>
  );
};
