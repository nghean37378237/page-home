import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Copy,
  Check,
  ExternalLink,
  Plus,
  Trash2,
  Edit2,
  Download,
  Upload,
  Sparkles,
  Filter,
  CheckSquare,
  Square,
  AlertTriangle,
  Link as LinkIcon,
  Tag,
  ShieldCheck,
  LayoutGrid,
  List,
  Eye,
  RefreshCw,
  FolderPlus,
} from 'lucide-react';
import { GroupRecord, AppUser } from '../types';
import { exportGroupToXLSX } from '../utils/excelTemplates';

interface GroupManagementTableProps {
  records: GroupRecord[];
  currentUser: AppUser;
  availableStaffNames: string[];
  onAddRecord: (record: GroupRecord) => Promise<void>;
  onAddBatchRecords?: (records: GroupRecord[]) => Promise<void>;
  onUpdateRecord: (id: string, updates: Partial<GroupRecord>) => Promise<void>;
  onDeleteRecord: (id: string) => Promise<void>;
  onDeleteBatchRecords?: (ids: string[]) => Promise<void>;
  onOpenAddModal: (presetGroup?: { groupId: string; groupName: string; groupLink: string; staffName?: string }) => void;
  onOpenBulkImportModal: () => void;
}

export const GroupManagementTable: React.FC<GroupManagementTableProps> = ({
  records,
  currentUser,
  availableStaffNames,
  onAddRecord,
  onAddBatchRecords,
  onUpdateRecord,
  onDeleteRecord,
  onDeleteBatchRecords,
  onOpenAddModal,
  onOpenBulkImportModal,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const myStaffNameLower = (currentUser.name || '').trim().toLowerCase();

  // Scoping: Staff only sees their own assigned groups, Admin sees all
  const scopedRecords = useMemo(() => {
    if (isAdmin) return records;
    return records.filter(
      (r) => (r.staffName || '').trim().toLowerCase() === myStaffNameLower
    );
  }, [records, isAdmin, myStaffNameLower]);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState('ALL');
  const [highlightedOnly, setHighlightedOnly] = useState(false);
  const [hasNoteOnly, setHasNoteOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Copy feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // Filtered list
  const filteredRecords = useMemo(() => {
    return scopedRecords.filter((r) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchGroup = (r.groupName || '').toLowerCase().includes(q);
        const matchLink = (r.groupLink || '').toLowerCase().includes(q);
        const matchUid = (r.uid || '').toLowerCase().includes(q);
        const matchVia = (r.viaName || '').toLowerCase().includes(q);
        const matchNote = (r.note || '').toLowerCase().includes(q);
        const matchStaff = (r.staffName || '').toLowerCase().includes(q);
        if (!matchGroup && !matchLink && !matchUid && !matchVia && !matchNote && !matchStaff) {
          return false;
        }
      }

      // Staff filter for admin
      if (isAdmin && selectedStaffFilter !== 'ALL') {
        if ((r.staffName || '').trim().toLowerCase() !== selectedStaffFilter.toLowerCase()) {
          return false;
        }
      }

      // Highlighted only
      if (highlightedOnly && !r.isHighlighted) {
        return false;
      }

      // Has note only
      if (hasNoteOnly && !(r.note || '').trim()) {
        return false;
      }

      return true;
    });
  }, [scopedRecords, searchQuery, selectedStaffFilter, highlightedOnly, hasNoteOnly, isAdmin]);

  // Grouped structure by groupId or groupName
  const groupedData = useMemo(() => {
    const map = new Map<
      string,
      {
        groupId: string;
        groupName: string;
        groupLink: string;
        staffName: string;
        rows: GroupRecord[];
      }
    >();

    filteredRecords.forEach((r) => {
      const key = r.groupId || r.groupName || 'unknown-group';
      if (!map.has(key)) {
        map.set(key, {
          groupId: r.groupId || key,
          groupName: r.groupName || 'Nhóm Chưa Đặt Tên',
          groupLink: r.groupLink || '',
          staffName: r.staffName || '',
          rows: [],
        });
      }
      map.get(key)!.rows.push(r);
    });

    return Array.from(map.values());
  }, [filteredRecords]);

  // Computed selection values
  const isAllSelected = useMemo(() => {
    return (
      filteredRecords.length > 0 &&
      filteredRecords.every((r) => selectedIds.has(r.id))
    );
  }, [filteredRecords, selectedIds]);

  const isSomeSelected = useMemo(() => {
    return selectedIds.size > 0 && !isAllSelected;
  }, [selectedIds, isAllSelected]);

  // Selection handlers
  const handleToggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRecords.map((r) => r.id)));
    }
  };

  const handleSelectGroupRows = (rows: GroupRecord[]) => {
    const allSelectedInGroup = rows.every((r) => selectedIds.has(r.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelectedInGroup) {
        rows.forEach((r) => next.delete(r.id));
      } else {
        rows.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  // Copy helpers with toast
  const triggerCopyFeedback = (key: string, message: string) => {
    setCopiedKey(key);
    setCopyToast(message);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
    setTimeout(() => {
      setCopyToast(null);
    }, 3000);
  };

  const handleCopyText = (text: string, key: string, label?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    triggerCopyFeedback(key, `Đã copy: ${label || text}`);
  };

  const handleCopySelectedUids = () => {
    const uids = filteredRecords
      .filter((r) => selectedIds.has(r.id) && r.uid?.trim())
      .map((r) => r.uid.trim());

    if (uids.length === 0) {
      alert('Vui lòng chọn ít nhất 1 dòng có UID để copy.');
      return;
    }

    navigator.clipboard.writeText(uids.join('\n'));
    triggerCopyFeedback('btn-copy-selected', `Đã copy ${uids.length} UID đã chọn vào clipboard!`);
  };

  const handleCopyAllUids = () => {
    const uids = filteredRecords
      .filter((r) => r.uid?.trim())
      .map((r) => r.uid.trim());

    if (uids.length === 0) {
      alert('Không có UID nào trong danh sách đang hiển thị.');
      return;
    }

    navigator.clipboard.writeText(uids.join('\n'));
    triggerCopyFeedback('btn-copy-all', `Đã copy toàn bộ ${uids.length} UID vào clipboard!`);
  };

  const handleCopyGroupUids = (rows: GroupRecord[], groupName: string) => {
    const uids = rows
      .filter((r) => r.uid?.trim())
      .map((r) => r.uid.trim());

    if (uids.length === 0) {
      alert('Không có UID nào trong nhóm này.');
      return;
    }

    navigator.clipboard.writeText(uids.join('\n'));
    triggerCopyFeedback(`copy-grp-${groupName}`, `Đã copy ${uids.length} UID của nhóm "${groupName}"!`);
  };

  // Toggle Highlight (Via chính / Bôi xanh)
  const handleToggleHighlight = async (r: GroupRecord) => {
    const nextVal = !r.isHighlighted;
    await onUpdateRecord(r.id, { isHighlighted: nextVal });
  };

  // Delete row
  const handleDeleteRow = async (r: GroupRecord) => {
    if (confirm(`Bạn có chắc muốn xóa dòng nick "${r.viaName || r.uid}" khỏi nhóm "${r.groupName}"?`)) {
      await onDeleteRecord(r.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(r.id);
        return next;
      });
    }
  };

  // Batch delete
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Bạn có chắc muốn xóa ${selectedIds.size} dòng Group đã chọn khỏi Cloud Firestore?`)) {
      const ids = Array.from(selectedIds);
      if (onDeleteBatchRecords) {
        await onDeleteBatchRecords(ids);
      } else {
        for (const id of ids) {
          await onDeleteRecord(id);
        }
      }
      setSelectedIds(new Set());
    }
  };

  // Quick stats
  const totalGroupsCount = useMemo(() => {
    const set = new Set(scopedRecords.map((r) => r.groupName?.trim().toLowerCase()).filter(Boolean));
    return set.size;
  }, [scopedRecords]);

  const totalHighlightedCount = useMemo(() => {
    return scopedRecords.filter((r) => r.isHighlighted).length;
  }, [scopedRecords]);

  const totalWithNotesCount = useMemo(() => {
    return scopedRecords.filter((r) => r.note?.trim()).length;
  }, [scopedRecords]);

  return (
    <div className="space-y-4">
      {/* Toast notification */}
      {copyToast && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 flex items-center space-x-2 text-xs font-bold animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{copyToast}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Title & Stats */}
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold shadow-2xs">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
                  <span>BẢNG QUẢN LÝ GROUP & VIA THÀNH VIÊN</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                    {scopedRecords.length} Dòng Via
                  </span>
                </h1>
                <p className="text-xs text-slate-500">
                  {isAdmin
                    ? 'Chế độ Quản Trị Viên: Quản lý toàn bộ Group và phân quyền nhân viên phụ trách'
                    : `Chế độ Nhân Viên: Đang hiển thị các Group và Nick Via do ${currentUser.name} quản lý`}
                </p>
              </div>
            </div>

            {/* Stats chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <span>Tổng: <b>{totalGroupsCount}</b> Nhóm</span>
              </span>
              <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Via Chính (Bôi xanh): <b>{totalHighlightedCount}</b></span>
              </span>
              <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Có Ghi Chú: <b>{totalWithNotesCount}</b></span>
              </span>
            </div>
          </div>

          {/* Quick Toolbar Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Copy All UIDs Button */}
            <button
              type="button"
              onClick={handleCopyAllUids}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 transition-colors shadow-2xs cursor-pointer"
            >
              {copiedKey === 'btn-copy-all' ? (
                <Check className="w-4 h-4 text-indigo-700" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              <span>Copy Tất Cả UID ({filteredRecords.length})</span>
            </button>

            {/* Select All Toggle */}
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className={`inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors shadow-2xs cursor-pointer ${
                isAllSelected
                  ? 'bg-slate-800 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              {isAllSelected ? (
                <>
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                  <span>Bỏ Chọn Tất Cả</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4" />
                  <span>Lựa Chọn Tất Cả</span>
                </>
              )}
            </button>

            {/* Export Excel */}
            <button
              type="button"
              onClick={() => exportGroupToXLSX(filteredRecords)}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-emerald-700 rounded-xl text-xs font-bold border border-slate-300 transition-colors shadow-2xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Xuất Excel</span>
            </button>

            {/* Import Bulk */}
            <button
              type="button"
              onClick={onOpenBulkImportModal}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 transition-colors shadow-2xs cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Import Hàng Loạt</span>
            </button>

            {/* Add Group / Row Button */}
            <button
              type="button"
              onClick={() => onOpenAddModal()}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Thêm Dòng Group Mới</span>
            </button>
          </div>
        </div>

        {/* Filters and View toggles */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          {/* Left filters */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm tên nhóm, UID, tên via, link nhóm, ghi chú..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Staff filter for Admin */}
            {isAdmin && (
              <div className="flex items-center space-x-1.5 text-xs">
                <span className="text-slate-500 font-semibold text-[11px]">Nhân viên:</span>
                <select
                  value={selectedStaffFilter}
                  onChange={(e) => setSelectedStaffFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-red-500"
                >
                  <option value="ALL">Tất Cả Nhân Viên ({availableStaffNames.length})</option>
                  {availableStaffNames.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Toggle Highlighted Only */}
            <button
              type="button"
              onClick={() => setHighlightedOnly(!highlightedOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center space-x-1.5 ${
                highlightedOnly
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 ring-2 ring-emerald-400/20'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Chỉ Via Chính</span>
            </button>

            {/* Toggle Has Note Only */}
            <button
              type="button"
              onClick={() => setHasNoteOnly(!hasNoteOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center space-x-1.5 ${
                hasNoteOnly
                  ? 'bg-amber-100 text-amber-800 border-amber-300 ring-2 ring-amber-400/20'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Chỉ Có Ghi Chú</span>
            </button>
          </div>

          {/* Right view switcher */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grouped')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center space-x-1 ${
                viewMode === 'grouped'
                  ? 'bg-white text-red-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Xem nhóm gộp từng Group"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Gộp Nhóm</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('flat')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center space-x-1 ${
                viewMode === 'flat'
                  ? 'bg-white text-red-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Xem danh sách chi tiết từng dòng"
            >
              <List className="w-3.5 h-3.5" />
              <span>Bảng Chi Tiết</span>
            </button>
          </div>
        </div>
      </div>

      {/* 🌟 THANH THAO TÁC KHI ĐÃ CHỌN DÒNG */}
      {selectedIds.size > 0 && (
        <div className="bg-gradient-to-r from-red-900 via-rose-900 to-slate-900 text-white px-4 py-3 rounded-2xl shadow-lg border border-red-700 flex flex-wrap items-center justify-between gap-3 animate-slide-down">
          <div className="flex items-center space-x-3">
            <span className="w-6 h-6 rounded-full bg-red-500/30 flex items-center justify-center font-bold text-xs text-red-300">
              {selectedIds.size}
            </span>
            <span className="text-xs font-bold">
              Đã chọn <span className="text-red-300">{selectedIds.size}</span> / {filteredRecords.length} dòng Nick Via
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Copy selected UIDs */}
            <button
              type="button"
              onClick={handleCopySelectedUids}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>📋 Copy {selectedIds.size} UID Đã Chọn</span>
            </button>

            {/* Copy All UIDs */}
            <button
              type="button"
              onClick={handleCopyAllUids}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Tất Cả ({filteredRecords.length})</span>
            </button>

            {/* Delete selected */}
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-red-800 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa Đã Chọn</span>
            </button>

            {/* Deselect */}
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              Bỏ Chọn
            </button>
          </div>
        </div>
      )}

      {/* Main Table Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">Chưa có dữ liệu Group Facebook nào</p>
              <p className="text-xs text-slate-500 mt-1">
                {searchQuery || selectedStaffFilter !== 'ALL'
                  ? 'Không tìm thấy kết quả phù hợp với bộ lọc hiện tại'
                  : 'Hãy bấm "+ Thêm Dòng Group Mới" hoặc "Import Hàng Loạt" để bắt đầu'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenAddModal()}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Dòng Group Đầu Tiên</span>
            </button>
          </div>
        ) : viewMode === 'grouped' ? (
          /* GROUPED VIEW */
          <div className="divide-y divide-slate-200">
            {groupedData.map((group, groupIdx) => {
              const groupUids = group.rows.map((r) => r.uid).filter(Boolean);
              const allRowsInGroupSelected = group.rows.every((r) => selectedIds.has(r.id));
              const someRowsInGroupSelected =
                group.rows.some((r) => selectedIds.has(r.id)) && !allRowsInGroupSelected;

              return (
                <div key={group.groupId || groupIdx} className="overflow-hidden">
                  {/* Group Header Banner */}
                  <div className="bg-gradient-to-r from-red-50 via-rose-50/60 to-slate-50 px-4 py-3 border-b border-red-100/70 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      {/* Checkbox select all in group */}
                      <input
                        type="checkbox"
                        checked={allRowsInGroupSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someRowsInGroupSelected;
                        }}
                        onChange={() => handleSelectGroupRows(group.rows)}
                        className="w-4 h-4 rounded-sm text-red-600 focus:ring-red-500 cursor-pointer"
                        title="Chọn tất cả nick trong nhóm này"
                      />

                      {/* Group Name & Link */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-red-600 uppercase tracking-tight flex items-center space-x-1.5">
                          <span>{group.groupName}</span>
                        </span>

                        {group.groupLink && (
                          <a
                            href={group.groupLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-semibold transition-colors border border-blue-200"
                            title="Mở link nhóm Facebook trên tab mới"
                          >
                            <LinkIcon className="w-3 h-3" />
                            <span className="max-w-[200px] truncate">{group.groupLink}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}

                        <span className="text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200 shadow-2xs">
                          {group.rows.length} Nick Via
                        </span>

                        {group.staffName && (
                          <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                            NV: {group.staffName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Group actions */}
                    <div className="flex items-center space-x-2 shrink-0">
                      {/* Copy all UIDs of this group */}
                      <button
                        type="button"
                        onClick={() => handleCopyGroupUids(group.rows, group.groupName)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-bold bg-white hover:bg-slate-100 text-indigo-700 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                        title="Copy tất cả UID nick của riêng nhóm này"
                      >
                        {copiedKey === `copy-grp-${group.groupName}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>Copy {groupUids.length} UID</span>
                      </button>

                      {/* Add another via to this group */}
                      <button
                        type="button"
                        onClick={() =>
                          onOpenAddModal({
                            groupId: group.groupId,
                            groupName: group.groupName,
                            groupLink: group.groupLink,
                            staffName: group.staffName,
                          })
                        }
                        className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-2xs transition-colors cursor-pointer"
                        title="Thêm nick via mới vào nhóm này"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Thêm Via Vào Nhóm</span>
                      </button>
                    </div>
                  </div>

                  {/* Group Rows Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50/90 text-slate-600 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                          <th className="py-2 px-3 w-10 text-center">Chọn</th>
                          <th className="py-2 px-3 w-12 text-center">STT</th>
                          <th className="py-2 px-3 font-mono">UID FACEBOOK (Cột B)</th>
                          <th className="py-2 px-3">TÊN VIA (Cột C)</th>
                          <th className="py-2 px-3">GHI CHÚ (Cột F)</th>
                          <th className="py-2 px-3 w-28 text-center">VIA CHÍNH</th>
                          <th className="py-2 px-3">NHÂN VIÊN</th>
                          <th className="py-2 px-3 w-28 text-center">THAO TÁC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.rows.map((row, rowIdx) => {
                          const isSelected = selectedIds.has(row.id);
                          const isHighlighted = row.isHighlighted;

                          return (
                            <tr
                              key={row.id}
                              className={`transition-colors font-medium ${
                                isSelected
                                  ? 'bg-red-50/90'
                                  : isHighlighted
                                  ? 'bg-emerald-50/80 hover:bg-emerald-100/90 border-l-4 border-l-emerald-500'
                                  : 'bg-white hover:bg-slate-50/80'
                              }`}
                            >
                              {/* Checkbox */}
                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectRow(row.id)}
                                  className="w-4 h-4 rounded-sm text-red-600 focus:ring-red-500 cursor-pointer"
                                />
                              </td>

                              {/* STT */}
                              <td className="py-2.5 px-3 text-center text-slate-500 font-bold">
                                {rowIdx + 1}
                              </td>

                              {/* UID Facebook */}
                              <td className="py-2.5 px-3">
                                <div className="flex items-center space-x-2">
                                  <span
                                    onClick={() => handleCopyText(row.uid, `uid-${row.id}`, row.uid)}
                                    className="font-mono font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer hover:underline text-xs"
                                    title="Nhấp để copy UID"
                                  >
                                    {row.uid}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => handleCopyText(row.uid, `uid-${row.id}`, row.uid)}
                                    className={`p-1 rounded-md transition-colors cursor-pointer ${
                                      copiedKey === `uid-${row.id}`
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                                    }`}
                                    title="Copy UID nick"
                                  >
                                    {copiedKey === `uid-${row.id}` ? (
                                      <Check className="w-3.5 h-3.5" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </td>

                              {/* Tên Via */}
                              <td className="py-2.5 px-3">
                                <span className="font-bold text-slate-800">
                                  {row.viaName || `Via ${row.uid.slice(-4)}`}
                                </span>
                              </td>

                              {/* Ghi chú */}
                              <td className="py-2.5 px-3">
                                {row.note ? (
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                      row.note.toLowerCase().includes('vhh')
                                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                        : row.note.toLowerCase().includes('đình chỉ')
                                        ? 'bg-red-100 text-red-800 border border-red-300'
                                        : row.note.toLowerCase().includes('hạn chế')
                                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                                    }`}
                                  >
                                    {row.note}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-xs italic">-</span>
                                )}
                              </td>

                              {/* Via Chính (Bôi xanh lá) */}
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleHighlight(row)}
                                  className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                    isHighlighted
                                      ? 'bg-emerald-200/90 text-emerald-900 border border-emerald-400 shadow-2xs'
                                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                                  }`}
                                  title="Nhấp để bật/tắt đánh dấu Via chính"
                                >
                                  {isHighlighted ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-700" />
                                      <span>Via Chính</span>
                                    </>
                                  ) : (
                                    <span>Bình thường</span>
                                  )}
                                </button>
                              </td>

                              {/* Nhân viên */}
                              <td className="py-2.5 px-3">
                                <span className="font-bold text-blue-700 text-xs">
                                  {row.staffName || '-'}
                                </span>
                              </td>

                              {/* Thao tác */}
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center space-x-1">
                                  {/* Edit button */}
                                  <button
                                    type="button"
                                    onClick={() => onOpenAddModal(undefined)}
                                    className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                                    title="Sửa dòng này"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Delete button */}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRow(row)}
                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                    title="Xóa dòng này"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* FLAT DETAILED TABLE VIEW */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider sticky top-0">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeSelected;
                      }}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded-sm text-red-600 focus:ring-red-500 cursor-pointer"
                      title="Chọn tất cả"
                    />
                  </th>
                  <th className="py-3 px-3 w-12 text-center">STT</th>
                  <th className="py-3 px-3 font-mono">UID FACEBOOK (Cột B)</th>
                  <th className="py-3 px-3">TÊN VIA (Cột C)</th>
                  <th className="py-3 px-3">GROUP LINK (Cột D)</th>
                  <th className="py-3 px-3">NHÓM (Cột E)</th>
                  <th className="py-3 px-3">GHI CHÚ (Cột F)</th>
                  <th className="py-3 px-3 w-28 text-center">VIA CHÍNH</th>
                  <th className="py-3 px-3">NHÂN VIÊN</th>
                  <th className="py-3 px-3 w-24 text-center">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredRecords.map((r, idx) => {
                  const isSelected = selectedIds.has(r.id);
                  const isHighlighted = r.isHighlighted;

                  return (
                    <tr
                      key={r.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-red-50/90'
                          : isHighlighted
                          ? 'bg-emerald-50/80 hover:bg-emerald-100/90 border-l-4 border-l-emerald-500'
                          : 'bg-white hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectRow(r.id)}
                          className="w-4 h-4 rounded-sm text-red-600 focus:ring-red-500 cursor-pointer"
                        />
                      </td>

                      <td className="py-2.5 px-3 text-center text-slate-500 font-bold">
                        {idx + 1}
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="flex items-center space-x-1.5">
                          <span
                            onClick={() => handleCopyText(r.uid, `uid-${r.id}`, r.uid)}
                            className="font-mono font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer hover:underline text-xs"
                            title="Nhấp để copy UID"
                          >
                            {r.uid}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(r.uid, `uid-${r.id}`, r.uid)}
                            className={`p-1 rounded-md transition-colors cursor-pointer ${
                              copiedKey === `uid-${r.id}`
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {copiedKey === `uid-${r.id}` ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 font-bold text-slate-800">
                        {r.viaName || `Via ${r.uid.slice(-4)}`}
                      </td>

                      <td className="py-2.5 px-3">
                        {r.groupLink ? (
                          <a
                            href={r.groupLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 text-blue-600 hover:underline text-xs max-w-[200px] truncate"
                          >
                            <LinkIcon className="w-3 h-3 shrink-0" />
                            <span className="truncate">{r.groupLink}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 font-bold text-red-600">
                        {r.groupName}
                      </td>

                      <td className="py-2.5 px-3">
                        {r.note ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              r.note.toLowerCase().includes('vhh')
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : r.note.toLowerCase().includes('đình chỉ')
                                ? 'bg-red-100 text-red-800 border border-red-300'
                                : r.note.toLowerCase().includes('hạn chế')
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {r.note}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleHighlight(r)}
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            isHighlighted
                              ? 'bg-emerald-200/90 text-emerald-900 border border-emerald-400 shadow-2xs'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                          }`}
                        >
                          {isHighlighted ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-700" />
                              <span>Via Chính</span>
                            </>
                          ) : (
                            <span>Bình thường</span>
                          )}
                        </button>
                      </td>

                      <td className="py-2.5 px-3 font-bold text-blue-700">
                        {r.staffName || '-'}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(r)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                            title="Xóa dòng này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating Action Pill on Mobile/Desktop */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-950/95 text-white backdrop-blur-md px-5 py-3 rounded-2xl shadow-2xl border border-red-500/40 flex items-center space-x-3 text-xs animate-bounce-short">
          <span className="font-bold flex items-center space-x-1.5">
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <span>Đã chọn: <b className="text-red-400">{selectedIds.size}</b> UID Group</span>
          </span>

          <div className="h-4 w-px bg-slate-700"></div>

          <button
            type="button"
            onClick={handleCopySelectedUids}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center space-x-1 shadow-xs cursor-pointer transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy UID Đã Chọn</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold cursor-pointer transition-colors"
          >
            Hủy
          </button>
        </div>
      )}
    </div>
  );
};
