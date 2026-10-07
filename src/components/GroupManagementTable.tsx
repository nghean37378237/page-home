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
  UserCheck,
  ChevronDown,
  CheckCircle2,
  X,
  Clock,
  XCircle,
} from 'lucide-react';
import { GroupRecord, AppUser, GroupJoinStatus, GROUP_JOIN_STATUS_OPTIONS, FullViaItem } from '../types';
import { exportGroupToXLSX } from '../utils/excelTemplates';

interface GroupManagementTableProps {
  records: GroupRecord[];
  currentUser: AppUser;
  availableStaffNames: string[];
  existingVias?: FullViaItem[];
  onAddRecord: (record: GroupRecord) => Promise<void>;
  onAddBatchRecords?: (records: GroupRecord[]) => Promise<void>;
  onUpdateRecord: (id: string, updates: Partial<GroupRecord>) => Promise<void>;
  onDeleteRecord: (id: string) => Promise<void>;
  onDeleteBatchRecords?: (ids: string[]) => Promise<void>;
  onOpenAddModal: (presetGroup?: {
    groupId?: string;
    groupName?: string;
    groupLink?: string;
    staffName?: string;
    initialMode?: 'single' | 'batch';
  }) => void;
  onOpenBulkImportModal: () => void;
  onEditRecord?: (record: GroupRecord) => void;
  onClearAllRecords?: () => Promise<void>;
  onRestoreSampleRecords?: () => Promise<void>;
}

export const GroupManagementTable: React.FC<GroupManagementTableProps> = ({
  records,
  currentUser,
  availableStaffNames,
  existingVias,
  onAddRecord,
  onAddBatchRecords,
  onUpdateRecord,
  onDeleteRecord,
  onDeleteBatchRecords,
  onOpenAddModal,
  onOpenBulkImportModal,
  onEditRecord,
  onClearAllRecords,
  onRestoreSampleRecords,
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
  const [selectedNoteFilter, setSelectedNoteFilter] = useState<'ALL' | 'VHH' | '282' | '956' | 'Hạn Chế' | 'NONE'>('ALL');
  const [selectedJoinStatusFilter, setSelectedJoinStatusFilter] = useState<'ALL' | 'Đã Jon' | 'Jon chờ duyệt' | 'Chưa'>('ALL');
  const [highlightedOnly, setHighlightedOnly] = useState(false);
  const [hasNoteOnly, setHasNoteOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Copy feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // Staff change modal state
  const [staffChangeTarget, setStaffChangeTarget] = useState<{
    type: 'single' | 'group' | 'bulk';
    title: string;
    groupName?: string;
    count: number;
    recordIds: string[];
    currentStaff: string;
  } | null>(null);
  const [targetStaffInput, setTargetStaffInput] = useState('');
  const [applyToWholeGroupInModal, setApplyToWholeGroupInModal] = useState(false);
  const [staffActionToast, setStaffActionToast] = useState<string | null>(null);

  // Via update modal state
  const [viaUpdateTarget, setViaUpdateTarget] = useState<{
    type: 'single' | 'group' | 'bulk';
    title: string;
    groupName?: string;
    groupId?: string;
    count: number;
    recordIds: string[];
    currentUid: string;
    currentViaName: string;
  } | null>(null);
  const [newViaUidInput, setNewViaUidInput] = useState('');
  const [newViaNameInput, setNewViaNameInput] = useState('');
  const [newViaJoinStatusInput, setNewViaJoinStatusInput] = useState<GroupJoinStatus | 'keep'>('keep');
  const [newViaStaffInput, setNewViaStaffInput] = useState<string>('keep');
  const [applyToWholeGroupInViaModal, setApplyToWholeGroupInViaModal] = useState(false);
  const [viaSearchQuery, setViaSearchQuery] = useState('');

  // Collect all known staff across the application and existing groups
  const allKnownStaff = useMemo(() => {
    const set = new Set<string>();
    if (currentUser.name) set.add(currentUser.name.trim());
    availableStaffNames.forEach((n) => n && set.add(n.trim()));
    records.forEach((r) => r.staffName && set.add(r.staffName.trim()));
    return Array.from(set).filter(Boolean);
  }, [availableStaffNames, records, currentUser.name]);

  // Note counts
  const noteCounts = useMemo(() => {
    let vhh = 0;
    let c282 = 0;
    let c956 = 0;
    let hanChe = 0;
    let none = 0;

    scopedRecords.forEach((r) => {
      const n = (r.note || '').trim().toLowerCase();
      if (!n) {
        none++;
      } else if (n === 'vhh' || n.includes('vhh')) {
        vhh++;
      } else if (n === '282' || n.includes('282')) {
        c282++;
      } else if (n === '956' || n.includes('956')) {
        c956++;
      } else if (n === 'hạn chế' || n.includes('hạn chế')) {
        hanChe++;
      }
    });

    return { vhh, c282, c956, hanChe, none };
  }, [scopedRecords]);

  // Join status counts
  const joinStatusCounts = useMemo(() => {
    let daJon = 0;
    let choDuyet = 0;
    let chua = 0;

    scopedRecords.forEach((r) => {
      const s = r.joinStatus || 'Chưa';
      if (s === 'Đã Jon') daJon++;
      else if (s === 'Jon chờ duyệt') choDuyet++;
      else chua++;
    });

    return { daJon, choDuyet, chua };
  }, [scopedRecords]);

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
        const matchJoinStatus = (r.joinStatus || 'Chưa').toLowerCase().includes(q);
        if (!matchGroup && !matchLink && !matchUid && !matchVia && !matchNote && !matchStaff && !matchJoinStatus) {
          return false;
        }
      }

      // Join status filter: 'ALL' | 'Đã Jon' | 'Jon chờ duyệt' | 'Chưa'
      if (selectedJoinStatusFilter !== 'ALL') {
        const st = r.joinStatus || 'Chưa';
        if (st !== selectedJoinStatusFilter) {
          return false;
        }
      }

      // Staff filter for admin
      if (isAdmin && selectedStaffFilter !== 'ALL') {
        if ((r.staffName || '').trim().toLowerCase() !== selectedStaffFilter.toLowerCase()) {
          return false;
        }
      }

      // Note filter: VHH, 282, 956, Hạn Chế, NONE
      if (selectedNoteFilter !== 'ALL') {
        const n = (r.note || '').trim().toLowerCase();
        if (selectedNoteFilter === 'NONE') {
          if (n) return false;
        } else if (selectedNoteFilter === 'VHH') {
          if (n !== 'vhh' && !n.includes('vhh')) return false;
        } else if (selectedNoteFilter === '282') {
          if (n !== '282' && !n.includes('282')) return false;
        } else if (selectedNoteFilter === '956') {
          if (n !== '956' && !n.includes('956')) return false;
        } else if (selectedNoteFilter === 'Hạn Chế') {
          if (n !== 'hạn chế' && !n.includes('hạn chế')) return false;
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
  }, [scopedRecords, searchQuery, selectedStaffFilter, selectedNoteFilter, selectedJoinStatusFilter, highlightedOnly, hasNoteOnly, isAdmin]);

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

  // Quick update note for single row
  const handleQuickUpdateNote = async (rowId: string, newNote: string) => {
    try {
      await onUpdateRecord(rowId, { note: newNote });
      triggerCopyFeedback(`note-${rowId}`, `Đã đổi ghi chú thành "${newNote || 'Trống'}"`);
    } catch (err) {
      console.error('Lỗi cập nhật ghi chú:', err);
    }
  };

  // Batch update note for selected rows
  const handleBatchUpdateNote = async (newNote: string) => {
    if (selectedIds.size === 0) return;
    try {
      const updatedList = scopedRecords
        .filter((r) => selectedIds.has(r.id))
        .map((r) => ({ ...r, note: newNote }));

      if (onAddBatchRecords) {
        await onAddBatchRecords(updatedList);
      } else {
        for (const item of updatedList) {
          await onUpdateRecord(item.id, { note: newNote });
        }
      }

      triggerCopyFeedback('batch-note', `Đã gán ghi chú "${newNote || 'Trống'}" cho ${selectedIds.size} UID!`);
    } catch (err) {
      console.error('Lỗi gán ghi chú hàng loạt:', err);
    }
  };

  // Update Join Status for a single row
  const handleUpdateJoinStatus = async (id: string, newStatus: GroupJoinStatus) => {
    await onUpdateRecord(id, { joinStatus: newStatus });
    triggerCopyFeedback(`status-${id}`, `Đã chuyển: ${newStatus}`);
  };

  // Batch update Join Status
  const handleBatchUpdateJoinStatus = async (newStatus: GroupJoinStatus) => {
    if (selectedIds.size === 0) return;
    try {
      const ids = Array.from(selectedIds);
      const updatedList = records
        .filter((r) => selectedIds.has(r.id))
        .map((r) => ({ ...r, joinStatus: newStatus }));

      if (onAddBatchRecords) {
        await onAddBatchRecords(updatedList);
      } else {
        for (const id of ids) {
          await onUpdateRecord(id, { joinStatus: newStatus });
        }
      }

      triggerCopyFeedback('batch-status', `Đã gán trạng thái "${newStatus}" cho ${selectedIds.size} UID!`);
    } catch (err) {
      console.error('Lỗi cập nhật trạng thái hàng loạt:', err);
    }
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

  // Apply staff change for single, group, or bulk selection
  const handleApplyStaffChange = async (newStaff: string) => {
    if (!staffChangeTarget || !newStaff.trim()) return;
    const staff = newStaff.trim();
    let idsToUpdate = [...staffChangeTarget.recordIds];

    // If single row but user checked "apply to whole group"
    if (applyToWholeGroupInModal && staffChangeTarget.groupName) {
      const gNameLower = staffChangeTarget.groupName.trim().toLowerCase();
      const groupRowIds = records
        .filter((r) => (r.groupName || '').trim().toLowerCase() === gNameLower)
        .map((r) => r.id);
      idsToUpdate = Array.from(new Set([...idsToUpdate, ...groupRowIds]));
    }

    const idSet = new Set(idsToUpdate);
    if (idsToUpdate.length === 1) {
      await onUpdateRecord(idsToUpdate[0], { staffName: staff });
    } else if (onAddBatchRecords) {
      const updated = records
        .filter((r) => idSet.has(r.id))
        .map((r) => ({ ...r, staffName: staff }));
      await onAddBatchRecords(updated);
    } else {
      for (const id of idsToUpdate) {
        await onUpdateRecord(id, { staffName: staff });
      }
    }

    setStaffActionToast(`Đã chuyển ${idsToUpdate.length} UID cho nhân viên: "${staff}"`);
    setTimeout(() => setStaffActionToast(null), 3500);
    setStaffChangeTarget(null);
    setTargetStaffInput('');
    setApplyToWholeGroupInModal(false);
  };

  // Apply Via update for single row, group, or bulk selection
  const handleApplyViaUpdate = async () => {
    if (!viaUpdateTarget || !newViaUidInput.trim()) return;

    const trimmedUid = newViaUidInput.trim();
    const trimmedViaName = newViaNameInput.trim();

    let idsToUpdate = [...viaUpdateTarget.recordIds];

    if (applyToWholeGroupInViaModal && viaUpdateTarget.groupName) {
      const gNameLower = viaUpdateTarget.groupName.trim().toLowerCase();
      const groupRowIds = records
        .filter((r) => (r.groupName || '').trim().toLowerCase() === gNameLower)
        .map((r) => r.id);
      idsToUpdate = Array.from(new Set([...idsToUpdate, ...groupRowIds]));
    }

    const updates: Partial<GroupRecord> = {
      uid: trimmedUid,
      ...(trimmedViaName ? { viaName: trimmedViaName } : {}),
      ...(newViaJoinStatusInput !== 'keep' ? { joinStatus: newViaJoinStatusInput as GroupJoinStatus } : {}),
      ...(newViaStaffInput !== 'keep' && newViaStaffInput ? { staffName: newViaStaffInput } : {}),
      updatedAt: new Date().toISOString(),
    };

    const idSet = new Set(idsToUpdate);

    if (idsToUpdate.length === 1) {
      await onUpdateRecord(idsToUpdate[0], updates);
    } else if (onAddBatchRecords) {
      const updated = records
        .filter((r) => idSet.has(r.id))
        .map((r) => ({ ...r, ...updates }));
      await onAddBatchRecords(updated);
    } else {
      for (const id of idsToUpdate) {
        await onUpdateRecord(id, updates);
      }
    }

    setStaffActionToast(`🎉 Đã update Via "${trimmedUid}" thành công cho ${idsToUpdate.length} dòng Group!`);
    setTimeout(() => setStaffActionToast(null), 3500);
    setViaUpdateTarget(null);
    setNewViaUidInput('');
    setNewViaNameInput('');
    setApplyToWholeGroupInViaModal(false);
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
      {(copyToast || staffActionToast) && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-blue-500 flex items-center space-x-2 text-xs font-bold animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{staffActionToast || copyToast}</span>
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
                  <span>BẢNG QUẢN LÝ GROUP FACEBOOK</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                    {scopedRecords.length} Dòng Group
                  </span>
                </h1>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <p className="text-xs text-slate-500">
                    {isAdmin
                      ? 'Chế độ Quản Trị Viên: Quản lý toàn bộ Group và phân quyền nhân viên phụ trách'
                      : `Chế độ Nhân Viên: Chỉ hiển thị các Group Facebook do ${currentUser.name} phụ trách chăm sóc`}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <span>Tổng: <b>{totalGroupsCount}</b> Nhóm</span>
              </span>
              <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Đã Jon: <b>{joinStatusCounts.daJon}</b></span>
              </span>
              <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Jon chờ duyệt: <b>{joinStatusCounts.choDuyet}</b></span>
              </span>
              <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                <XCircle className="w-3.5 h-3.5 text-slate-500" />
                <span>Chưa: <b>{joinStatusCounts.chua}</b></span>
              </span>
              <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Via Chính: <b>{totalHighlightedCount}</b></span>
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

            {/* Select All / Soát Tất Cả Toggle */}
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className={`inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors shadow-2xs cursor-pointer ${
                isAllSelected
                  ? 'bg-slate-800 text-white border-slate-900 ring-2 ring-slate-400'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
              title="Soát / Chọn toàn bộ các dòng Nick Via trong danh sách hiện tại"
            >
              {isAllSelected ? (
                <>
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                  <span>Bỏ Soát / Bỏ Chọn Tất Cả</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4" />
                  <span>Soát Tất Cả ({filteredRecords.length})</span>
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

            {/* Restore Sample Records when empty or on demand */}
            {onRestoreSampleRecords && records.length === 0 && (
              <button
                type="button"
                onClick={async () => {
                  await onRestoreSampleRecords();
                  setStaffActionToast('🎉 Đã nạp lại dữ liệu nhóm mẫu thành công!');
                  setTimeout(() => setStaffActionToast(null), 3000);
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-300 transition-colors shadow-2xs cursor-pointer"
                title="Nạp lại dữ liệu mẫu các nhóm Facebook (Beautifull World, Movies World...)"
              >
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Nạp Lại Dữ Liệu Mẫu</span>
              </button>
            )}

            {/* Clear All Group Records - Admin Only */}
            {records.length > 0 && isAdmin && (
              <button
                type="button"
                onClick={async () => {
                  if (confirm(`⚠️ QUYỀN ADMIN: Bạn có chắc chắn muốn XÓA TRẮNG toàn bộ ${records.length} dòng dữ liệu trong bảng Group không? Thao tác này sẽ xóa sạch dữ liệu để nhập lại từ đầu.`)) {
                    if (onClearAllRecords) {
                      await onClearAllRecords();
                    } else if (onDeleteBatchRecords) {
                      await onDeleteBatchRecords(records.map((r) => r.id));
                    }
                    setSelectedIds(new Set());
                    setStaffActionToast('🗑️ Admin đã xóa trắng toàn bộ bảng Group thành công!');
                    setTimeout(() => setStaffActionToast(null), 3000);
                  }
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold border border-rose-300 transition-colors shadow-2xs cursor-pointer"
                title="Quyền Admin: Xóa trắng toàn bộ dữ liệu group để bạn tự nhập mới từ đầu"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Admin: Xóa Trắng Bảng Group</span>
              </button>
            )}

            {/* Add Batch UIDs to Group Button */}
            <button
              type="button"
              onClick={() => onOpenAddModal({ initialMode: 'batch' })}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              title="Nhập hàng loạt danh sách UID vào 1 group bất kỳ"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>+ Nhập Hàng Loạt UID Vào Group</span>
            </button>

            {/* Add Group / Row Button */}
            <button
              type="button"
              onClick={() => onOpenAddModal({ initialMode: 'single' })}
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

            {/* Staff filter */}
            {isAdmin && (
              <div className="flex items-center space-x-1.5 text-xs">
                <span className="text-slate-500 font-semibold text-[11px]">Nhân viên:</span>
                <select
                  value={selectedStaffFilter}
                  onChange={(e) => setSelectedStaffFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-red-500 cursor-pointer"
                >
                  <option value="ALL">Tất Cả Nhân Viên ({allKnownStaff.length})</option>
                  {allKnownStaff.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Join status filter: Đã Jon, Jon chờ duyệt, Chưa */}
            <div className="flex items-center space-x-1.5 text-xs">
              <span className="text-slate-500 font-semibold text-[11px]">Trạng thái:</span>
              <select
                value={selectedJoinStatusFilter}
                onChange={(e) => setSelectedJoinStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-red-500"
              >
                <option value="ALL">Tất Cả ({scopedRecords.length})</option>
                <option value="Đã Jon">✅ Đã Jon ({joinStatusCounts.daJon})</option>
                <option value="Jon chờ duyệt">⏳ Jon chờ duyệt ({joinStatusCounts.choDuyet})</option>
                <option value="Chưa">✕ Chưa ({joinStatusCounts.chua})</option>
              </select>
            </div>

            {/* Note filter: VHH, 282, 956, Hạn Chế */}
            <div className="flex items-center space-x-1.5 text-xs">
              <span className="text-slate-500 font-semibold text-[11px]">Tình trạng:</span>
              <select
                value={selectedNoteFilter}
                onChange={(e) => setSelectedNoteFilter(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-red-500"
              >
                <option value="ALL">Tất Cả ({scopedRecords.length})</option>
                <option value="VHH">🔴 VHH ({noteCounts.vhh})</option>
                <option value="282">🟠 282 ({noteCounts.c282})</option>
                <option value="956">🟣 956 ({noteCounts.c956})</option>
                <option value="Hạn Chế">🟡 Hạn Chế ({noteCounts.hanChe})</option>
                <option value="NONE">Trống ({noteCounts.none})</option>
              </select>
            </div>

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
            {/* Update Via Button for Batch Selection */}
            <button
              type="button"
              onClick={() => {
                setViaUpdateTarget({
                  type: 'bulk',
                  title: `Cập nhật / Đổi Via hàng loạt cho ${selectedIds.size} dòng Group đã chọn`,
                  count: selectedIds.size,
                  recordIds: Array.from(selectedIds),
                  currentUid: '',
                  currentViaName: '',
                });
                setNewViaUidInput('');
                setNewViaNameInput('');
                setNewViaJoinStatusInput('keep');
                setNewViaStaffInput('keep');
                setApplyToWholeGroupInViaModal(false);
              }}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
              title="Cập nhật / Thay đổi UID và Tên Via cho tất cả các dòng đang chọn"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>🔄 Update Via ({selectedIds.size} dòng)</span>
            </button>

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
              <span>{isAdmin ? `Admin Xóa Đã Chọn (${selectedIds.size})` : `Xóa Đã Chọn (${selectedIds.size})`}</span>
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
                  : 'Hãy bấm "Nạp Lại Dữ Liệu Mẫu", "Import Hàng Loạt", hoặc "+ Thêm Dòng Group Mới" để bắt đầu'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {onRestoreSampleRecords && (
                <button
                  type="button"
                  onClick={async () => {
                    await onRestoreSampleRecords();
                    setStaffActionToast('🎉 Đã nạp lại dữ liệu nhóm mẫu thành công!');
                    setTimeout(() => setStaffActionToast(null), 3000);
                  }}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                  title="Nạp lại các nhóm Facebook mẫu ban đầu (Beautifull World, Movies World...)"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Nạp Lại Dữ Liệu Mẫu (4 Nhóm)</span>
                </button>
              )}
              <button
                type="button"
                onClick={onOpenBulkImportModal}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Import Hàng Loạt Từ Excel / Text</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenAddModal()}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Dòng Group Đầu Tiên</span>
              </button>
            </div>
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

                        {/* Staff display / change on group card header */}
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => {
                              setStaffChangeTarget({
                                type: 'group',
                                title: `Đổi NV chăm sóc nhóm "${group.groupName}"`,
                                groupName: group.groupName,
                                count: group.rows.length,
                                recordIds: group.rows.map((r) => r.id),
                                currentStaff: group.staffName || '',
                              });
                              setTargetStaffInput(group.staffName || currentUser.name || '');
                            }}
                            className="inline-flex items-center space-x-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-0.5 rounded-full border border-blue-200 hover:border-blue-300 transition-all cursor-pointer shadow-2xs group"
                            title="Nhấp để đổi nhân viên chăm sóc cho TOÀN BỘ nhóm này"
                          >
                            <UserCheck className="w-3 h-3 text-blue-600 group-hover:scale-110 transition-transform" />
                            <span>NV: <b>{group.staffName || 'Chưa gán'}</b></span>
                            <ChevronDown className="w-2.5 h-2.5 text-blue-500 opacity-60 group-hover:opacity-100" />
                          </button>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                            <UserCheck className="w-3 h-3 text-blue-600" />
                            <span>NV: <b>{group.staffName || currentUser.name}</b></span>
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

                      {/* Add 1 via to this group */}
                      <button
                        type="button"
                        onClick={() =>
                          onOpenAddModal({
                            groupId: group.groupId,
                            groupName: group.groupName,
                            groupLink: group.groupLink,
                            staffName: group.staffName,
                            initialMode: 'single',
                          })
                        }
                        className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                        title="Thêm 1 nick via vào nhóm này"
                      >
                        <Plus className="w-3.5 h-3.5 text-slate-500" />
                        <span>+ Thêm 1 Nick</span>
                      </button>

                      {/* Update / Đổi Via cho nhóm */}
                      <button
                        type="button"
                        onClick={() => {
                          setViaUpdateTarget({
                            type: 'group',
                            title: `Update / Đổi Nick Via cho nhóm "${group.groupName}"`,
                            groupName: group.groupName,
                            groupId: group.groupId,
                            count: group.rows.length,
                            recordIds: group.rows.map((r) => r.id),
                            currentUid: group.rows[0]?.uid || '',
                            currentViaName: group.rows[0]?.viaName || '',
                          });
                          setNewViaUidInput(group.rows[0]?.uid || '');
                          setNewViaNameInput(group.rows[0]?.viaName || '');
                          setNewViaJoinStatusInput('keep');
                          setNewViaStaffInput(group.staffName || 'keep');
                          setApplyToWholeGroupInViaModal(true);
                        }}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                        title="Cập nhật hoặc đổi Via cho các dòng trong nhóm này"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Đổi Via Nhóm</span>
                      </button>

                      {/* Batch add UIDs to this group */}
                      <button
                        type="button"
                        onClick={() =>
                          onOpenAddModal({
                            groupId: group.groupId,
                            groupName: group.groupName,
                            groupLink: group.groupLink,
                            staffName: group.staffName,
                            initialMode: 'batch',
                          })
                        }
                        className="inline-flex items-center space-x-1 px-3 py-1 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-2xs transition-colors cursor-pointer"
                        title="Nhập hàng loạt danh sách UID vào nhóm này"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>+ Nhập Hàng Loạt UID</span>
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
                          <th className="py-2 px-3 w-36">TRẠNG THÁI</th>
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

                              {/* Tên Via (Cột C) */}
                              <td className="py-2.5 px-3">
                                <div className="flex items-center space-x-2">
                                  <span
                                    onClick={() =>
                                      handleCopyText(
                                        row.viaName || `Via ${row.uid.slice(-4)}`,
                                        `via-${row.id}`,
                                        row.viaName || `Via ${row.uid.slice(-4)}`
                                      )
                                    }
                                    className="font-bold text-slate-800 hover:text-indigo-900 cursor-pointer hover:underline text-xs"
                                    title="Nhấp để copy Tên Via"
                                  >
                                    {row.viaName || `Via ${row.uid.slice(-4)}`}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopyText(
                                        row.viaName || `Via ${row.uid.slice(-4)}`,
                                        `via-${row.id}`,
                                        row.viaName || `Via ${row.uid.slice(-4)}`
                                      )
                                    }
                                    className={`p-1 rounded-md transition-colors cursor-pointer ${
                                      copiedKey === `via-${row.id}`
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                                    }`}
                                    title="Copy Tên Via"
                                  >
                                    {copiedKey === `via-${row.id}` ? (
                                      <Check className="w-3.5 h-3.5" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </td>

                              {/* Cột Trạng Thái: Đã Jon, Jon chờ duyệt, Chưa */}
                              <td className="py-2.5 px-3">
                                <div className="relative inline-flex items-center">
                                  <select
                                    value={row.joinStatus || 'Chưa'}
                                    onChange={(e) =>
                                      handleUpdateJoinStatus(row.id, e.target.value as GroupJoinStatus)
                                    }
                                    className={`text-[11px] font-bold rounded-lg px-2.5 py-1 border transition-all cursor-pointer focus:ring-2 focus:ring-red-500 shadow-2xs ${
                                      row.joinStatus === 'Đã Jon'
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                        : row.joinStatus === 'Jon chờ duyệt'
                                        ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                        : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                                    }`}
                                    title="Nhấp để đổi trạng thái tham gia: Đã Jon / Jon chờ duyệt / Chưa"
                                  >
                                    <option value="Đã Jon">✅ Đã Jon</option>
                                    <option value="Jon chờ duyệt">⏳ Jon chờ duyệt</option>
                                    <option value="Chưa">✕ Chưa</option>
                                  </select>
                                </div>
                              </td>

                              {/* Ghi chú: dropdown tương tác nhanh VHH, 282, 956, Hạn Chế */}
                              <td className="py-2.5 px-3">
                                <div className="relative inline-flex items-center">
                                  <select
                                    value={row.note || ''}
                                    onChange={(e) => handleQuickUpdateNote(row.id, e.target.value)}
                                    className={`text-[11px] font-bold rounded-lg px-2 py-1 border transition-all cursor-pointer focus:ring-2 focus:ring-red-500 shadow-2xs ${
                                      (row.note || '').toLowerCase().includes('vhh')
                                        ? 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200'
                                        : (row.note || '').includes('282')
                                        ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                                        : (row.note || '').includes('956')
                                        ? 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200'
                                        : (row.note || '').toLowerCase().includes('hạn chế')
                                        ? 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200'
                                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                    }`}
                                    title="Nhấp để đổi nhanh tình trạng ghi chú: VHH, 282, 956, Hạn Chế"
                                  >
                                    <option value="">- Trống -</option>
                                    <option value="VHH">🔴 VHH (Vô Hiệu Hóa)</option>
                                    <option value="282">🟠 282 (Checkpoint 282)</option>
                                    <option value="956">🟣 956 (Checkpoint 956)</option>
                                    <option value="Hạn Chế">🟡 Hạn Chế</option>
                                    {row.note && !['VHH', '282', '956', 'Hạn Chế'].includes(row.note) && (
                                      <option value={row.note}>{row.note}</option>
                                    )}
                                  </select>
                                </div>
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

                              {/* Nhân viên - Interactive Click to Change (Admin only) */}
                              <td className="py-2.5 px-3">
                                {isAdmin ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setStaffChangeTarget({
                                        type: 'single',
                                        title: `Đổi NV chăm sóc UID ${row.uid || row.viaName}`,
                                        groupName: row.groupName,
                                        count: 1,
                                        recordIds: [row.id],
                                        currentStaff: row.staffName || '',
                                      });
                                      setTargetStaffInput(row.staffName || currentUser.name || '');
                                    }}
                                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 hover:border-blue-300 transition-all cursor-pointer group"
                                    title="Nhấp để chọn / đổi nhân viên cho dòng này"
                                  >
                                    <UserCheck className="w-3.5 h-3.5 text-blue-500 group-hover:scale-110 transition-transform" />
                                    <span>{row.staffName || 'Chưa gán'}</span>
                                    <ChevronDown className="w-3 h-3 text-blue-400 opacity-60 group-hover:opacity-100" />
                                  </button>
                                ) : (
                                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                                    <span>{row.staffName || currentUser.name}</span>
                                  </span>
                                )}
                              </td>

                              {/* Thao tác */}
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center space-x-1">
                                  {/* Update Via button */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setViaUpdateTarget({
                                        type: 'single',
                                        title: `Update / Đổi Via cho nick "${row.viaName || row.uid}" (${row.groupName})`,
                                        groupName: row.groupName,
                                        groupId: row.groupId,
                                        count: 1,
                                        recordIds: [row.id],
                                        currentUid: row.uid || '',
                                        currentViaName: row.viaName || '',
                                      });
                                      setNewViaUidInput(row.uid || '');
                                      setNewViaNameInput(row.viaName || '');
                                      setNewViaJoinStatusInput(row.joinStatus || 'Đã Jon');
                                      setNewViaStaffInput(row.staffName || 'keep');
                                      setApplyToWholeGroupInViaModal(false);
                                    }}
                                    className="p-1 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                                    title="Update / Đổi Nick Via cho dòng này"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                                  </button>

                                  {/* Edit button */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onEditRecord
                                        ? onEditRecord(row)
                                        : onOpenAddModal({
                                            groupId: row.groupId,
                                            groupName: row.groupName,
                                            groupLink: row.groupLink,
                                            staffName: row.staffName,
                                            initialMode: 'single',
                                          })
                                    }
                                    className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                                    title="Sửa thông tin dòng này (kèm nhân viên & ghi chú)"
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
                  <th className="py-3 px-3 w-36">TRẠNG THÁI</th>
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

                      {/* Tên Via (Cột C) */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center space-x-1.5">
                          <span
                            onClick={() =>
                              handleCopyText(
                                r.viaName || `Via ${r.uid.slice(-4)}`,
                                `via-${r.id}`,
                                r.viaName || `Via ${r.uid.slice(-4)}`
                              )
                            }
                            className="font-bold text-slate-800 hover:text-indigo-900 cursor-pointer hover:underline text-xs"
                            title="Nhấp để copy Tên Via"
                          >
                            {r.viaName || `Via ${r.uid.slice(-4)}`}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyText(
                                r.viaName || `Via ${r.uid.slice(-4)}`,
                                `via-${r.id}`,
                                r.viaName || `Via ${r.uid.slice(-4)}`
                              )
                            }
                            className={`p-1 rounded-md transition-colors cursor-pointer ${
                              copiedKey === `via-${r.id}`
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                            }`}
                            title="Copy Tên Via"
                          >
                            {copiedKey === `via-${r.id}` ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Trạng Thái trong Flat View */}
                      <td className="py-2.5 px-3">
                        <div className="relative inline-flex items-center">
                          <select
                            value={r.joinStatus || 'Chưa'}
                            onChange={(e) =>
                              handleUpdateJoinStatus(r.id, e.target.value as GroupJoinStatus)
                            }
                            className={`text-[11px] font-bold rounded-lg px-2.5 py-1 border transition-all cursor-pointer focus:ring-2 focus:ring-red-500 shadow-2xs ${
                              r.joinStatus === 'Đã Jon'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                : r.joinStatus === 'Jon chờ duyệt'
                                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                            }`}
                            title="Nhấp để đổi trạng thái tham gia: Đã Jon / Jon chờ duyệt / Chưa"
                          >
                            <option value="Đã Jon">✅ Đã Jon</option>
                            <option value="Jon chờ duyệt">⏳ Jon chờ duyệt</option>
                            <option value="Chưa">✕ Chưa</option>
                          </select>
                        </div>
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

                      {/* Ghi chú trong chế độ Flat View */}
                      <td className="py-2.5 px-3">
                        <div className="relative inline-flex items-center">
                          <select
                            value={r.note || ''}
                            onChange={(e) => handleQuickUpdateNote(r.id, e.target.value)}
                            className={`text-[11px] font-bold rounded-lg px-2 py-1 border transition-all cursor-pointer focus:ring-2 focus:ring-red-500 shadow-2xs ${
                              (r.note || '').toLowerCase().includes('vhh')
                                ? 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200'
                                : (r.note || '').includes('282')
                                ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                                : (r.note || '').includes('956')
                                ? 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200'
                                : (r.note || '').toLowerCase().includes('hạn chế')
                                ? 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200'
                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                            }`}
                            title="Nhấp để đổi nhanh tình trạng ghi chú"
                          >
                            <option value="">- Trống -</option>
                            <option value="VHH">🔴 VHH (Vô Hiệu Hóa)</option>
                            <option value="282">🟠 282 (Checkpoint 282)</option>
                            <option value="956">🟣 956 (Checkpoint 956)</option>
                            <option value="Hạn Chế">🟡 Hạn Chế</option>
                            {r.note && !['VHH', '282', '956', 'Hạn Chế'].includes(r.note) && (
                              <option value={r.note}>{r.note}</option>
                            )}
                          </select>
                        </div>
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

                      {/* Nhân viên - Interactive Click to Change (Admin only) */}
                      <td className="py-2.5 px-3">
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => {
                              setStaffChangeTarget({
                                type: 'single',
                                title: `Đổi NV chăm sóc UID ${r.uid || r.viaName}`,
                                groupName: r.groupName,
                                count: 1,
                                recordIds: [r.id],
                                currentStaff: r.staffName || '',
                              });
                              setTargetStaffInput(r.staffName || currentUser.name || '');
                            }}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 hover:border-blue-300 transition-all cursor-pointer group"
                            title="Nhấp để chọn / đổi nhân viên cho dòng này"
                          >
                            <UserCheck className="w-3.5 h-3.5 text-blue-500 group-hover:scale-110 transition-transform" />
                            <span>{r.staffName || 'Chưa gán'}</span>
                            <ChevronDown className="w-3 h-3 text-blue-400 opacity-60 group-hover:opacity-100" />
                          </button>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                            <span>{r.staffName || currentUser.name}</span>
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {/* Update Via button */}
                          <button
                            type="button"
                            onClick={() => {
                              setViaUpdateTarget({
                                type: 'single',
                                title: `Update / Đổi Via cho nick "${r.viaName || r.uid}" (${r.groupName})`,
                                groupName: r.groupName,
                                groupId: r.groupId,
                                count: 1,
                                recordIds: [r.id],
                                currentUid: r.uid || '',
                                currentViaName: r.viaName || '',
                              });
                              setNewViaUidInput(r.uid || '');
                              setNewViaNameInput(r.viaName || '');
                              setNewViaJoinStatusInput(r.joinStatus || 'Đã Jon');
                              setNewViaStaffInput(r.staffName || 'keep');
                              setApplyToWholeGroupInViaModal(false);
                            }}
                            className="p-1 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                            title="Update / Đổi Nick Via cho dòng này"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onEditRecord
                                ? onEditRecord(r)
                                : onOpenAddModal({
                                    groupId: r.groupId,
                                    groupName: r.groupName,
                                    groupLink: r.groupLink,
                                    staffName: r.staffName,
                                    initialMode: 'single',
                                  })
                            }
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                            title="Sửa thông tin dòng này"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-950/95 text-white backdrop-blur-md px-5 py-3 rounded-2xl shadow-2xl border border-red-500/40 flex flex-wrap items-center justify-center gap-2.5 text-xs animate-bounce-short">
          <span className="font-bold flex items-center space-x-1.5 shrink-0">
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <span>Đã chọn: <b className="text-red-400">{selectedIds.size}</b> UID</span>
          </span>

          <div className="h-4 w-px bg-slate-700 hidden sm:block"></div>

          <button
            type="button"
            onClick={handleCopySelectedUids}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center space-x-1 shadow-xs cursor-pointer transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy UID Đã Chọn</span>
          </button>

          <div className="h-4 w-px bg-slate-700 hidden sm:block"></div>

          {/* Quick Batch Update Via */}
          <button
            type="button"
            onClick={() => {
              setViaUpdateTarget({
                type: 'bulk',
                title: `Cập nhật / Đổi Via hàng loạt cho ${selectedIds.size} dòng đã chọn`,
                count: selectedIds.size,
                recordIds: Array.from(selectedIds),
                currentUid: '',
                currentViaName: '',
              });
              setNewViaUidInput('');
              setNewViaNameInput('');
              setNewViaJoinStatusInput('keep');
              setNewViaStaffInput('keep');
              setApplyToWholeGroupInViaModal(false);
            }}
            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer transition-colors"
            title="Update hoặc đổi Via cho các dòng đang chọn"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Update Via ({selectedIds.size})</span>
          </button>

          <div className="h-4 w-px bg-slate-700 hidden sm:block"></div>

          {/* Quick Batch Staff Assignment (Admin only) */}
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => {
                  setStaffChangeTarget({
                    type: 'bulk',
                    title: `Đổi nhân viên phụ trách cho ${selectedIds.size} UID đã chọn`,
                    count: selectedIds.size,
                    recordIds: Array.from(selectedIds),
                    currentStaff: '',
                  });
                  setTargetStaffInput(currentUser.name || availableStaffNames[0] || '');
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer transition-colors"
                title="Chuyển nhân viên phụ trách cho tất cả UID đang chọn"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Đổi NV ({selectedIds.size} UID)</span>
              </button>

              <div className="h-4 w-px bg-slate-700 hidden sm:block"></div>
            </>
          )}

          {/* Quick Batch Join Status Assignment */}
          <div className="flex items-center space-x-1 bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 font-semibold pr-1">Trạng Thái:</span>
            <button
              type="button"
              onClick={() => handleBatchUpdateJoinStatus('Đã Jon')}
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer transition-colors shadow-2xs"
              title="Gán trạng thái Đã Jon cho các UID đã chọn"
            >
              Đã Jon
            </button>
            <button
              type="button"
              onClick={() => handleBatchUpdateJoinStatus('Jon chờ duyệt')}
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500 text-white hover:bg-amber-400 cursor-pointer transition-colors shadow-2xs"
              title="Gán trạng thái Jon chờ duyệt cho các UID đã chọn"
            >
              Chờ Duyệt
            </button>
            <button
              type="button"
              onClick={() => handleBatchUpdateJoinStatus('Chưa')}
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-600 text-white hover:bg-slate-500 cursor-pointer transition-colors shadow-2xs"
              title="Gán trạng thái Chưa cho các UID đã chọn"
            >
              Chưa
            </button>
          </div>

          <div className="h-4 w-px bg-slate-700 hidden sm:block"></div>

          {/* Quick Batch Note Assignment */}
          <div className="flex items-center space-x-1 bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 font-semibold pr-1">Gán Ghi Chú:</span>
            <button
              type="button"
              onClick={() => handleBatchUpdateNote('VHH')}
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-600 text-white hover:bg-rose-500 cursor-pointer transition-colors shadow-2xs"
              title="Gán ghi chú VHH cho các UID đã chọn"
            >
              VHH
            </button>
            <button
              type="button"
              onClick={() => handleBatchUpdateNote('282')}
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-600 text-white hover:bg-amber-500 cursor-pointer transition-colors shadow-2xs"
              title="Gán ghi chú 282 cho các UID đã chọn"
            >
              282
            </button>
            <button
              type="button"
              onClick={() => handleBatchUpdateNote('956')}
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-600 text-white hover:bg-purple-500 cursor-pointer transition-colors shadow-2xs"
              title="Gán ghi chú 956 cho các UID đã chọn"
            >
              956
            </button>
            <button
              type="button"
              onClick={() => handleBatchUpdateNote('Hạn Chế')}
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-yellow-600 text-white hover:bg-yellow-500 cursor-pointer transition-colors shadow-2xs"
              title="Gán ghi chú Hạn Chế cho các UID đã chọn"
            >
              Hạn Chế
            </button>
            <button
              type="button"
              onClick={() => handleBatchUpdateNote('')}
              className="px-1.5 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors"
              title="Xóa ghi chú của các UID đã chọn"
            >
              Xóa
            </button>
          </div>

          <div className="h-4 w-px bg-slate-700 hidden sm:block"></div>

          {onDeleteBatchRecords && (
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="px-2.5 py-1.5 bg-red-700/80 hover:bg-red-700 text-white rounded-xl font-bold flex items-center space-x-1 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold cursor-pointer transition-colors"
          >
            Hủy
          </button>
        </div>
      )}
      {/* Modal: Đổi Nhân Viên Chăm Sóc Group */}
      {staffChangeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-bold">
                  <UserCheck className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold leading-tight">
                    Đổi Nhân Viên Chăm Sóc Group
                  </h3>
                  <p className="text-[11px] text-blue-100">
                    {staffChangeTarget.title} ({staffChangeTarget.count} UID)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStaffChangeTarget(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  1. Chọn nhanh nhân viên:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {allKnownStaff.map((staff) => {
                    const isSelected = targetStaffInput.trim().toLowerCase() === staff.toLowerCase();
                    return (
                      <button
                        key={staff}
                        type="button"
                        onClick={() => setTargetStaffInput(staff)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center space-x-1.5 ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-700 shadow-xs ring-2 ring-blue-500/25'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{staff}</span>
                        {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    2. Hoặc nhập / chọn tên nhân viên:
                  </label>
                  {currentUser.name && (
                    <button
                      type="button"
                      onClick={() => setTargetStaffInput(currentUser.name)}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      Gán cho tôi ({currentUser.name})
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    list="staff-quick-picker"
                    value={targetStaffInput}
                    onChange={(e) => setTargetStaffInput(e.target.value)}
                    placeholder="Nhập tên nhân viên mới..."
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <datalist id="staff-quick-picker">
                    {allKnownStaff.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Option to apply to whole group if single row */}
              {staffChangeTarget.type === 'single' && staffChangeTarget.groupName && (
                <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200">
                  <label className="flex items-start space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyToWholeGroupInModal}
                      onChange={(e) => setApplyToWholeGroupInModal(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded-sm text-blue-600 focus:ring-blue-500"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-blue-900">
                        Áp dụng cho TOÀN BỘ các UID khác trong nhóm "{staffChangeTarget.groupName}"
                      </span>
                      <p className="text-[10px] text-blue-700">
                        Đổi nhân viên phụ trách cho tất cả các nick thuộc nhóm này cùng lúc
                      </p>
                    </div>
                  </label>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setStaffChangeTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={!targetStaffInput.trim()}
                onClick={() => handleApplyStaffChange(targetStaffInput)}
                className="inline-flex items-center space-x-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>
                  Lưu & Chuyển Cho "{targetStaffInput || '...'}"
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Update / Đổi Nick Via Cho Group */}
      {viaUpdateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-bold">
                  <RefreshCw className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold leading-tight">
                    Update / Đổi Nick Via Cho Group
                  </h3>
                  <p className="text-[11px] text-emerald-100">
                    {viaUpdateTarget.title} ({viaUpdateTarget.count} dòng)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViaUpdateTarget(null)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Quick info banner */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 space-y-1">
                <p className="font-semibold flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {viaUpdateTarget.type === 'bulk'
                      ? `Đang chọn ${viaUpdateTarget.count} dòng Group để cập nhật đồng loạt Via mới.`
                      : viaUpdateTarget.type === 'group'
                      ? `Đang chọn cả nhóm "${viaUpdateTarget.groupName}" (${viaUpdateTarget.count} dòng) để đổi Via.`
                      : `Cập nhật hoặc đổi Via cho nick "${viaUpdateTarget.currentViaName || viaUpdateTarget.currentUid}".`}
                  </span>
                </p>
                {viaUpdateTarget.currentUid && (
                  <p className="text-[11px] text-emerald-700 font-mono">
                    UID hiện tại: <b>{viaUpdateTarget.currentUid}</b> {viaUpdateTarget.currentViaName ? `(${viaUpdateTarget.currentViaName})` : ''}
                  </p>
                )}
              </div>

              {/* Existing Via quick picker if available */}
              {existingVias && existingVias.length > 0 && (
                <div className="space-y-2 bg-slate-50 border border-slate-200 p-3 rounded-xl">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Chọn nhanh từ Kho Via hệ thống ({existingVias.length} Via):</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Tìm UID, tên, NV..."
                      value={viaSearchQuery}
                      onChange={(e) => setViaSearchQuery(e.target.value)}
                      className="text-[11px] px-2 py-0.5 border border-slate-200 rounded-lg bg-white max-w-[140px]"
                    />
                  </div>
                  <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white">
                    {existingVias
                      .filter((v) => {
                        if (!viaSearchQuery.trim()) return true;
                        const q = viaSearchQuery.toLowerCase();
                        return (
                          (v.uid || '').toLowerCase().includes(q) ||
                          (v.staffName || '').toLowerCase().includes(q) ||
                          (v.note || '').toLowerCase().includes(q) ||
                          (v.adminReportStatus || '').toLowerCase().includes(q)
                        );
                      })
                      .slice(0, 20)
                      .map((v) => (
                        <button
                          key={v.id || v.uid}
                          type="button"
                          onClick={() => {
                            setNewViaUidInput(v.uid);
                            setNewViaNameInput(v.note || v.uid);
                            if (v.staffName && isAdmin) {
                              setNewViaStaffInput(v.staffName);
                            }
                          }}
                          className="w-full px-2.5 py-1.5 text-left text-xs hover:bg-emerald-50/70 flex items-center justify-between transition-colors group cursor-pointer"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-slate-900 group-hover:text-emerald-700">
                              {v.uid}
                            </span>
                            {v.note && (
                              <span className="text-[11px] text-slate-500 max-w-[150px] truncate">
                                ({v.note})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-1.5 shrink-0">
                            {v.adminReportStatus && v.adminReportStatus !== 'None' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-800">
                                {v.adminReportStatus}
                              </span>
                            )}
                            <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium">
                              {v.staffName}
                            </span>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Inputs */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    UID Nick Facebook Mới <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    list="group-modal-update-via-list"
                    placeholder="VD: 100060665184656"
                    value={newViaUidInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewViaUidInput(val);
                      if (existingVias) {
                        const matched = existingVias.find((v) => v.uid === val.trim());
                        if (matched && matched.note && !newViaNameInput) {
                          setNewViaNameInput(matched.note);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 focus:bg-white"
                  />
                  {existingVias && existingVias.length > 0 && (
                    <datalist id="group-modal-update-via-list">
                      {existingVias.map((v) => (
                        <option key={v.id || v.uid} value={v.uid} label={`${v.note || ''} (${v.staffName})`} />
                      ))}
                    </datalist>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tên Via / Mô Tả Mới (Cột C)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Lucas Santos, Rupesh Yadav, Via Kháng..."
                    value={newViaNameInput}
                    onChange={(e) => setNewViaNameInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Trạng Thái Jon Nhóm
                    </label>
                    <select
                      value={newViaJoinStatusInput}
                      onChange={(e) => setNewViaJoinStatusInput(e.target.value as any)}
                      className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white"
                    >
                      <option value="keep">Giữ nguyên hiện tại</option>
                      <option value="Đã Jon">Đã Jon</option>
                      <option value="Jon chờ duyệt">Jon chờ duyệt</option>
                      <option value="Chưa">Chưa</option>
                    </select>
                  </div>

                  {isAdmin && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nhân Viên Phụ Trách
                      </label>
                      <select
                        value={newViaStaffInput}
                        onChange={(e) => setNewViaStaffInput(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white"
                      >
                        <option value="keep">Giữ nguyên nhân viên</option>
                        {allKnownStaff.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Option to apply to whole group if editing a single row */}
                {viaUpdateTarget.type === 'single' && viaUpdateTarget.groupName && (
                  <label className="flex items-center space-x-2 pt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={applyToWholeGroupInViaModal}
                      onChange={(e) => setApplyToWholeGroupInViaModal(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                    <span className="text-xs text-slate-700 font-medium">
                      Áp dụng thay đổi Via này cho <b>toàn bộ các dòng thuộc nhóm "{viaUpdateTarget.groupName}"</b>
                    </span>
                  </label>
                )}
              </div>
            </div>

            {/* Footer buttons */}
            <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViaUpdateTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Hủy Bỏ
              </button>

              <button
                type="button"
                onClick={handleApplyViaUpdate}
                disabled={!newViaUidInput.trim()}
                className="px-5 py-2 text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white rounded-xl shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Xác Nhận Update Via</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
