import React, { useState, useMemo } from 'react';
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

interface ViaTheme {
  name: string;
  rowBg: string;
  rowHover: string;
  cellBg: string;
  borderLeft: string;
  badgeBg: string;
  topBorder: string;
  dotColor: string;
}

// 8 harmonious, clean pastel palettes for distinguishing different Vias (1 via 3 page chung 1 màu)
const VIA_THEMES: ViaTheme[] = [
  {
    name: 'Xanh Lam (Sky)',
    rowBg: 'bg-sky-50/80',
    rowHover: 'hover:bg-sky-100/90',
    cellBg: 'bg-sky-100/95',
    borderLeft: 'border-l-4 border-l-sky-500',
    badgeBg: 'bg-sky-100 text-sky-900 border-sky-300',
    topBorder: 'border-t-2 border-sky-300',
    dotColor: 'bg-sky-500',
  },
  {
    name: 'Vàng Hổ Phách (Amber)',
    rowBg: 'bg-amber-50/80',
    rowHover: 'hover:bg-amber-100/90',
    cellBg: 'bg-amber-100/95',
    borderLeft: 'border-l-4 border-l-amber-500',
    badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
    topBorder: 'border-t-2 border-amber-300',
    dotColor: 'bg-amber-500',
  },
  {
    name: 'Xanh Lá (Emerald)',
    rowBg: 'bg-emerald-50/75',
    rowHover: 'hover:bg-emerald-100/90',
    cellBg: 'bg-emerald-100/95',
    borderLeft: 'border-l-4 border-l-emerald-600',
    badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    topBorder: 'border-t-2 border-emerald-300',
    dotColor: 'bg-emerald-600',
  },
  {
    name: 'Tím Oải Hương (Purple)',
    rowBg: 'bg-purple-50/80',
    rowHover: 'hover:bg-purple-100/90',
    cellBg: 'bg-purple-100/95',
    borderLeft: 'border-l-4 border-l-purple-500',
    badgeBg: 'bg-purple-100 text-purple-900 border-purple-300',
    topBorder: 'border-t-2 border-purple-300',
    dotColor: 'bg-purple-500',
  },
  {
    name: 'Hồng San Hô (Rose)',
    rowBg: 'bg-rose-50/75',
    rowHover: 'hover:bg-rose-100/90',
    cellBg: 'bg-rose-100/95',
    borderLeft: 'border-l-4 border-l-rose-500',
    badgeBg: 'bg-rose-100 text-rose-900 border-rose-300',
    topBorder: 'border-t-2 border-rose-300',
    dotColor: 'bg-rose-500',
  },
  {
    name: 'Xanh Mòng Két (Teal)',
    rowBg: 'bg-teal-50/80',
    rowHover: 'hover:bg-teal-100/90',
    cellBg: 'bg-teal-100/95',
    borderLeft: 'border-l-4 border-l-teal-500',
    badgeBg: 'bg-teal-100 text-teal-900 border-teal-300',
    topBorder: 'border-t-2 border-teal-300',
    dotColor: 'bg-teal-500',
  },
  {
    name: 'Cam Đào (Orange)',
    rowBg: 'bg-orange-50/80',
    rowHover: 'hover:bg-orange-100/90',
    cellBg: 'bg-orange-100/95',
    borderLeft: 'border-l-4 border-l-orange-500',
    badgeBg: 'bg-orange-100 text-orange-900 border-orange-300',
    topBorder: 'border-t-2 border-orange-300',
    dotColor: 'bg-orange-500',
  },
  {
    name: 'Chàm Indigo (Indigo)',
    rowBg: 'bg-indigo-50/80',
    rowHover: 'hover:bg-indigo-100/90',
    cellBg: 'bg-indigo-100/95',
    borderLeft: 'border-l-4 border-l-indigo-500',
    badgeBg: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    topBorder: 'border-t-2 border-indigo-300',
    dotColor: 'bg-indigo-500',
  },
];

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

  // Group records so all rows of the same Staff stay contiguous,
  // and within each Staff, all rows of the same Via stay contiguous
  const displayRecords = useMemo(() => {
    const staffMap = new Map<string, PageRecord[]>();
    records.forEach((r) => {
      const s = r.staffName.trim();
      if (!staffMap.has(s)) staffMap.set(s, []);
      staffMap.get(s)!.push(r);
    });

    const grouped: PageRecord[] = [];
    staffMap.forEach((staffRecs) => {
      const viaMap = new Map<string, PageRecord[]>();
      staffRecs.forEach((r) => {
        const v = r.viaUid.trim();
        if (!viaMap.has(v)) viaMap.set(v, []);
        viaMap.get(v)!.push(r);
      });
      viaMap.forEach((vRecs) => {
        grouped.push(...vRecs);
      });
    });
    return grouped;
  }, [records]);

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

  // Compute rowSpan for Staff name (written ONCE per employee)
  const staffSpans = useMemo(() => {
    const spans: { rowSpan: number; isFirst: boolean; totalInGroup: number }[] = [];
    let i = 0;
    while (i < displayRecords.length) {
      const currentStaff = displayRecords[i].staffName.trim().toLowerCase();
      let count = 1;
      while (
        i + count < displayRecords.length &&
        displayRecords[i + count].staffName.trim().toLowerCase() === currentStaff
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
  }, [displayRecords]);

  // Compute rowSpan and theme index for each distinct Via
  const { viaSpans, rowViaThemeIndices } = useMemo(() => {
    const spans: {
      rowSpan: number;
      isFirst: boolean;
      totalInGroup: number;
      groupIndex: number;
    }[] = [];
    const themeIndices: number[] = [];
    let i = 0;
    let groupCounter = 0;

    while (i < displayRecords.length) {
      const currentVia = displayRecords[i].viaUid.trim();
      const currentStaff = displayRecords[i].staffName.trim().toLowerCase();

      let count = 1;
      if (currentVia) {
        while (
          i + count < displayRecords.length &&
          displayRecords[i + count].viaUid.trim() === currentVia &&
          displayRecords[i + count].staffName.trim().toLowerCase() === currentStaff
        ) {
          count++;
        }
      }

      const currentThemeIndex = groupCounter % VIA_THEMES.length;
      groupCounter++;

      spans.push({
        rowSpan: count,
        isFirst: true,
        totalInGroup: count,
        groupIndex: currentThemeIndex,
      });
      themeIndices.push(currentThemeIndex);

      for (let j = 1; j < count; j++) {
        spans.push({
          rowSpan: 0,
          isFirst: false,
          totalInGroup: count,
          groupIndex: currentThemeIndex,
        });
        themeIndices.push(currentThemeIndex);
      }

      i += count;
    }
    return { viaSpans: spans, rowViaThemeIndices: themeIndices };
  }, [displayRecords]);

  // Statistics about Vias
  const viaStats = useMemo(() => {
    const viaMap = new Map<string, number>();
    displayRecords.forEach((r) => {
      const uid = r.viaUid.trim();
      if (uid) {
        viaMap.set(uid, (viaMap.get(uid) || 0) + 1);
      }
    });
    let multiPageCount = 0;
    viaMap.forEach((count) => {
      if (count > 1) multiPageCount++;
    });
    return {
      totalVias: viaMap.size,
      multiPageVias: multiPageCount,
    };
  }, [displayRecords]);

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
      {/* Top Spreadsheet Bar with View Options and Via Color Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2 px-1">
        <div className="flex items-center flex-wrap gap-2 text-xs text-slate-600">
          <div className="flex items-center space-x-1.5 font-medium">
            <Layers className="w-4 h-4 text-emerald-700" />
            <span>
              <strong>{displayRecords.length}</strong> Fanpage •{' '}
              <strong className="text-indigo-700">{viaStats.totalVias}</strong> Nick Via
            </span>
          </div>

          {viaStats.multiPageVias > 0 && (
            <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-indigo-600" />
              <span>{viaStats.multiPageVias} Via cầm từ 2 page trở lên</span>
            </span>
          )}

          {/* Color theme indicator */}
          <span className="inline-flex items-center space-x-1.5 bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-slate-200">
            <Palette className="w-3 h-3 text-slate-500" />
            <span>Mỗi Via được bôi màu nền riêng biệt</span>
          </span>
        </div>

        {/* View Mode Toggle: Gộp ô chuẩn Google Sheet vs Từng ô riêng lẻ */}
        <div className="flex items-center space-x-2 text-xs">
          {onFetchPagesForVia && (
            <button
              type="button"
              id="btn-fetch-pages-table-top"
              onClick={() => onFetchPagesForVia('', '')}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all shadow-xs cursor-pointer bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-800 border-blue-300"
              title="Lấy Tên & Link Page từ Nick Via tự động điền lên bảng"
            >
              <Zap className="w-3.5 h-3.5 text-blue-600 fill-blue-600" />
              <span>⚡ Lấy Page từ Via</span>
            </button>
          )}

          {/* Nút Sao Chép Tất Cả UID Nick trong bảng Fanpage */}
          <button
            type="button"
            id="btn-copy-all-fanpage-vias"
            onClick={handleCopyAllViaUids}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all shadow-xs cursor-pointer ${
              copiedViaId === 'all-vias'
                ? 'bg-emerald-700 text-white border-emerald-800 ring-2 ring-emerald-600/30'
                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
            }`}
            title="Sao chép toàn bộ UID tài khoản nick Via trên bảng (danh sách không trùng lặp, 1 UID/dòng)"
          >
            {copiedViaId === 'all-vias' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-100 stroke-[3]" />
                <span>Đã Copy UID!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-indigo-600" />
                <span>📋 Copy Tất Cả UID Nick ({viaStats.totalVias})</span>
              </>
            )}
          </button>

          <span className="text-slate-600 font-bold text-xs">Chế độ hiển thị:</span>
          <button
            type="button"
            id="btn-toggle-merge-via"
            onClick={() => setMergeViaCells(!mergeViaCells)}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all shadow-xs cursor-pointer ${
              mergeViaCells
                ? 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-800 ring-2 ring-emerald-600/30'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
            }`}
            title="Bấm để bật/tắt gộp ô theo Via: 1 Via cầm nhiều Page cùng 1 màu hoặc tách riêng lẻ từng dòng"
          >
            {mergeViaCells ? (
              <>
                <ToggleRight className="w-4 h-4 text-emerald-200" />
                <span>Gộp ô theo Via (Chuẩn Sheet)</span>
                <span className="text-[10px] bg-emerald-900/60 text-emerald-100 px-1.5 py-0.2 rounded-full font-extrabold">
                  Đang Bật
                </span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-4 h-4 text-slate-400" />
                <span>Tách từng ô riêng lẻ</span>
                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-extrabold">
                  Tắt Gộp
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Spreadsheet Container */}
      <div className="bg-white border-2 border-[#2e7d32] rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[750px] overflow-y-auto">
          <table className="w-full border-collapse text-left text-xs font-sans">
            {/* Sheet row labels (A, B, C, D, E, F, G, H, I, J, K) */}
            <thead className="sticky top-0 z-20 shadow-xs">
              <tr className="bg-[#f3f4f6] text-slate-500 text-[10px] font-mono border-b border-slate-300 h-6">
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

              {/* Exact Green Headers from Google Sheet - Compact Excel style */}
              <tr className="bg-[#38761d] text-white text-[11px] uppercase tracking-wider font-bold select-none border-b-2 border-slate-400 h-8">
                <th className="w-8 min-w-[34px] max-w-[36px] px-1 py-1 text-center border-r border-emerald-800/80">STT</th>
                <th className="w-20 min-w-[80px] max-w-[90px] px-1 py-1 border-r border-emerald-800/80 text-center">
                  <div className="flex flex-col items-center">
                    <span>TÊN NV</span>
                    <span className="text-[9px] font-normal opacity-85 lowercase">
                      {mergeViaCells ? '(gộp ô)' : '(tách ô)'}
                    </span>
                  </div>
                </th>
                <th className="w-56 min-w-[210px] max-w-[240px] px-1.5 py-1 border-r border-emerald-800/80 text-left">
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

                <th className="w-36 min-w-[125px] max-w-[145px] px-1.5 py-1 border-r border-emerald-800/80 text-left">
                  TÊN PAGE
                </th>
                <th className="w-24 min-w-[95px] max-w-[110px] px-1.5 py-1 border-r border-emerald-800/80 text-left">
                  LINK PAGE
                </th>
                <th className="w-22 min-w-[85px] max-w-[95px] px-1 py-1 border-r border-emerald-800/80 text-center">
                  <span>Trạng Thái</span>
                </th>
                <th className="w-12 min-w-[50px] max-w-[55px] px-0.5 py-1 border-r border-emerald-800/80 text-center">
                  Ngày
                </th>
                <th className="w-22 min-w-[82px] max-w-[92px] px-1 py-1 border-r border-emerald-800/80 text-center">
                  CHẶN
                </th>
                <th className="w-24 min-w-[88px] max-w-[98px] px-1 py-1 border-r border-emerald-800/80 text-center" title="Đếm Like: Có 2 trạng thái 'Đếm Like' (mặc định) và 'Bỏ Đếm Like'">
                  ĐẾM LIKE
                </th>
                <th className="w-26 min-w-[96px] max-w-[110px] px-1 py-1 border-r border-emerald-800/80 text-center" title="Phương thức đăng: Đăng Tay / Tool / Hẹn Giờ. Khi chọn Đăng Tay sẽ tự động ghi nhận và hiển thị ngày chọn">
                  <div className="flex flex-col items-center">
                    <span>ĐĂNG BÀI</span>
                    <span className="text-[8px] font-normal opacity-85 lowercase">(tay / tool)</span>
                  </div>
                </th>
                <th className="w-18 min-w-[70px] max-w-[80px] px-1 py-1 border-r border-emerald-800/80 text-center">
                  TƯƠNG TÁC
                </th>
                <th className="w-12 min-w-[52px] max-w-[58px] px-0.5 py-1 border-r border-emerald-800/80 text-center" title="Ngày nhảy tự động theo ngày hiện tại khi chọn trạng thái cột tương tác">
                  <div className="flex flex-col items-center">
                    <span>NGÀY TT</span>
                    <span className="text-[8px] font-normal opacity-85 lowercase">(tự nhảy)</span>
                  </div>
                </th>
                <th className="w-24 min-w-[90px] max-w-[105px] px-1.5 py-1 border-r border-emerald-800/80 text-left">
                  GHI CHÚ BM
                </th>
                <th className="w-28 min-w-[105px] max-w-[115px] px-1 py-1 border-r border-emerald-800/80 text-center bg-[#255e11]">
                  TIẾN ĐỘ
                </th>
                <th className="w-16 min-w-[65px] max-w-[75px] px-0.5 py-1 text-center">Thao Tác</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-300 text-slate-800">
              {displayRecords.length === 0 ? (
                <tr>
                  <td colSpan={16} className="py-12 text-center text-slate-400 bg-white">
                    Không tìm thấy dòng nào phù hợp. Hãy tạo thêm Page mới hoặc đặt lại bộ lọc.
                  </td>
                </tr>
              ) : (
                displayRecords.map((record, index) => {
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
                    totalInGroup: 1,
                    groupIndex: 0,
                  };

                  const themeIndex = rowViaThemeIndices[index] ?? 0;
                  const theme = VIA_THEMES[themeIndex] || VIA_THEMES[0];

                  const shouldRenderStaffCell = !mergeViaCells || staffSpan.isFirst;
                  const staffRowSpan = mergeViaCells ? staffSpan.rowSpan : 1;

                  const shouldRenderViaCell = !mergeViaCells || viaSpan.isFirst;
                  const viaRowSpan = mergeViaCells ? viaSpan.rowSpan : 1;
                  const isGroupedVia = viaSpan.totalInGroup > 1;

                  const isFirstOfStaff = staffSpan.isFirst;
                  const isFirstOfVia = viaSpan.isFirst;

                  // Border on top: strong green line between staff, clear theme border between vias
                  const topDividerClass = isFirstOfStaff && index > 0
                    ? 'border-t-2 border-[#38761d]/60'
                    : isFirstOfVia && index > 0
                    ? theme.topBorder
                    : 'border-t border-slate-200';

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

                  return (
                    <tr
                      key={record.id}
                      className={`transition-colors border-b border-slate-300 ${topDividerClass} ${
                        isRowViaError
                          ? 'bg-rose-50/75 hover:bg-rose-100/75 border-l-4 border-l-rose-600'
                          : isRowViaFixed
                          ? 'bg-emerald-50/80 hover:bg-emerald-100/80 border-l-4 border-l-emerald-600'
                          : `${theme.rowBg} ${theme.rowHover}`
                      }`}
                    >
                      {/* Col A: Row index */}
                      <td className="px-1 py-1 text-center border-r border-slate-300 font-mono text-slate-500 text-[10px] bg-slate-50/70 select-none">
                        {index + 1}
                      </td>

                      {/* Col B: TÊN NV - VIẾT 1 LẦN DUY NHẤT KHI BẬT GỘP Ô HOẶC TỪNG DÒNG KHI TÁCH */}
                      {shouldRenderStaffCell && (
                        <td
                          rowSpan={staffRowSpan}
                          className="px-1 py-1 border-r border-slate-300 font-bold text-slate-900 align-middle bg-slate-50/95 text-center select-none shadow-2xs"
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
                                  <span className="font-bold text-slate-900 text-xs tracking-tight leading-tight truncate max-w-[75px]" title={record.staffName}>
                                    {record.staffName}
                                  </span>
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
                                  ) : (
                                    <span
                                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center space-x-1 ${theme.badgeBg}`}
                                      title={`Via này đang cầm ${viaSpan.totalInGroup} Page`}
                                    >
                                      <span className={`w-1.5 h-1.5 rounded-full ${theme.dotColor}`}></span>
                                      <span>{viaSpan.totalInGroup} Page</span>
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

        {/* Footer info with Color Palette Guide & 4 Status Breakdown */}
        <div className="bg-slate-50 border-t border-slate-300 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-600 font-sans">
          <div className="flex items-center flex-wrap gap-2">
            <span className="font-bold text-slate-700">
              Đang hiển thị <strong>{displayRecords.length}</strong> Fanpage •{' '}
              <strong>{viaStats.totalVias}</strong> Nick Via
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-emerald-700 font-semibold" title="Đề Xuất">
              🚀 <strong>{displayRecords.filter((r) => r.status === 'Đề Xuất').length}</strong> Đề Xuất
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-rose-700 font-semibold" title="Mất Đề Xuất">
              🔴 <strong>{displayRecords.filter((r) => r.status === 'Mất Đề Xuất').length}</strong> Mất ĐX
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-amber-800 font-semibold" title="Đình Chỉ">
              ⚠️ <strong>{displayRecords.filter((r) => r.status === 'Đình Chỉ').length}</strong> Đình Chỉ
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-purple-700 font-semibold" title="Bị Back">
              🟣 <strong>{displayRecords.filter((r) => r.status === 'Bị Back').length}</strong> Bị Back
            </span>
          </div>

          <div className="flex items-center space-x-1.5 text-[11px]">
            <span className="text-slate-500 font-medium">Bảng màu phân biệt Via:</span>
            <div className="flex items-center space-x-1">
              {VIA_THEMES.map((t) => (
                <span
                  key={t.name}
                  className={`w-3.5 h-3.5 rounded-full ${t.dotColor} border border-white shadow-2xs`}
                  title={`Màu ${t.name}`}
                />
              ))}
            </div>
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
