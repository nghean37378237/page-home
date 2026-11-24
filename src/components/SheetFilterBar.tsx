import React, { useMemo, useState } from 'react';
import {
  Search,
  X,
  Plus,
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Zap,
  Users,
  Archive,
  Upload,
  Download,
  FileSpreadsheet,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import {
  SheetFilter,
  PageRecord,
  GroupRecord,
  UserAccount,
  AppUser,
  ADMIN_WAITING_POOL,
  isAdminWaitingPool,
  areStaffNamesEquivalent,
} from '../types';
import { getCleanBmName } from '../utils/helpers';
import { downloadFanpageExcelTemplate, exportFanpageToXLSX } from '../utils/excelTemplates';

interface SheetFilterBarProps {
  filter: SheetFilter;
  onChangeFilter: (newFilter: SheetFilter) => void;
  records: PageRecord[];
  groupRecords?: GroupRecord[];
  accounts?: UserAccount[];
  currentUser: AppUser;
  errorViaUids?: Set<string>;
  errorViaCount?: number;
  fixedViaUids?: Set<string>;
  fixedViaCount?: number;
  onOpenAddModal?: () => void;
  onOpenImportModal?: () => void;
  onMarkAllDoneToday?: () => void;
  availableStaffNames?: string[];
  onOpenDeleteStaffModal?: (staffName?: string) => void;
  onOpenTransferModal?: () => void;
  onOpenFetchPagesModal?: () => void;
}

export const SheetFilterBar: React.FC<SheetFilterBarProps> = ({
  filter,
  onChangeFilter,
  records,
  groupRecords = [],
  accounts = [],
  currentUser,
  errorViaUids,
  errorViaCount: propErrorViaCount,
  fixedViaUids,
  fixedViaCount: propFixedViaCount,
  onOpenAddModal,
  onOpenImportModal,
  onMarkAllDoneToday,
  availableStaffNames,
  onOpenTransferModal,
  onOpenFetchPagesModal,
}) => {
  const [isExcelMenuOpen, setIsExcelMenuOpen] = useState(false);

  const staffList = useMemo(() => {
    const base = availableStaffNames && availableStaffNames.length > 0 ? [...availableStaffNames] : [];
    const list = base.filter((s) => !isAdminWaitingPool(s));
    records.forEach((r) => {
      const name = r.staffName?.trim();
      if (name && !isAdminWaitingPool(name) && !list.some((s) => s.toLowerCase() === name.toLowerCase())) {
        list.push(name);
      }
    });
    groupRecords.forEach((g) => {
      const name = g.staffName?.trim();
      if (
        name &&
        !isAdminWaitingPool(name) &&
        !list.some((s) => s.toLowerCase() === name.toLowerCase() || areStaffNamesEquivalent(s, name))
      ) {
        list.push(name);
      }
    });
    return list.sort((a, b) => a.localeCompare(b, 'vi'));
  }, [records, groupRecords, availableStaffNames]);

  const waitingPoolRecordsCount = useMemo(() => {
    return records.filter((r) => isAdminWaitingPool(r.staffName) || !r.staffName?.trim()).length;
  }, [records]);

  const staffScopedRecords = useMemo(() => {
    if (filter.staffName && filter.staffName.trim() && filter.staffName !== 'all') {
      if (isAdminWaitingPool(filter.staffName)) {
        return records.filter((r) => isAdminWaitingPool(r.staffName) || !r.staffName?.trim());
      }
      const selectedStaffLower = filter.staffName.trim().toLowerCase();
      return records.filter(
        (r) =>
          r.staffName &&
          (r.staffName.trim().toLowerCase() === selectedStaffLower ||
            areStaffNamesEquivalent(r.staffName, filter.staffName))
      );
    }
    return records;
  }, [records, filter.staffName]);

  const viaOptions = useMemo(() => {
    const map = new Map<string, number>();
    staffScopedRecords.forEach((r) => {
      const uid = r.viaUid.trim();
      if (uid) {
        map.set(uid, (map.get(uid) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([viaUid, count]) => ({ viaUid, count }))
      .sort((a, b) => b.count - a.count);
  }, [staffScopedRecords]);

  const deXuatCount = useMemo(
    () => staffScopedRecords.filter((r) => r.status === 'Đề Xuất').length,
    [staffScopedRecords]
  );
  const matDeXuatCount = useMemo(
    () => staffScopedRecords.filter((r) => r.status === 'Mất Đề Xuất').length,
    [staffScopedRecords]
  );
  const dinhChiCount = useMemo(
    () => staffScopedRecords.filter((r) => r.status === 'Đình Chỉ').length,
    [staffScopedRecords]
  );
  const biBackCount = useMemo(
    () => staffScopedRecords.filter((r) => r.status === 'Bị Back').length,
    [staffScopedRecords]
  );

  const totalTargetPosts = useMemo(
    () => staffScopedRecords.reduce((acc, r) => acc + (r.targetPosts || 0), 0),
    [staffScopedRecords]
  );
  const totalActualPosts = useMemo(
    () => staffScopedRecords.reduce((acc, r) => acc + (r.actualPosts || 0), 0),
    [staffScopedRecords]
  );

  const computedErrorViaCount = useMemo(() => {
    if (filter.staffName && filter.staffName.trim() && filter.staffName !== 'all') {
      const errorUidsForStaff = new Set<string>();
      staffScopedRecords.forEach((r) => {
        const uid = r.viaUid.trim().toLowerCase();
        if (
          r.isViaError ||
          r.viaStatus === 'checkpoint' ||
          r.viaStatus === 'dead' ||
          r.viaStatus === 'error' ||
          (errorViaUids && uid && errorViaUids.has(uid))
        ) {
          if (uid) errorUidsForStaff.add(uid);
        }
      });
      return errorUidsForStaff.size;
    }

    if (typeof propErrorViaCount === 'number') return propErrorViaCount;
    if (errorViaUids && errorViaUids.size > 0) {
      const uidsInScope = new Set(records.map((r) => r.viaUid.trim().toLowerCase()).filter(Boolean));
      let count = 0;
      errorViaUids.forEach((uid) => {
        if (currentUser.role === 'admin' || uidsInScope.has(uid.toLowerCase())) {
          count++;
        }
      });
      return count;
    }
    return records.filter((r) => r.isViaError).length;
  }, [filter.staffName, staffScopedRecords, propErrorViaCount, errorViaUids, records, currentUser.role]);

  const computedFixedViaCount = useMemo(() => {
    if (filter.staffName && filter.staffName.trim() && filter.staffName !== 'all') {
      const fixedUidsForStaff = new Set<string>();
      staffScopedRecords.forEach((r) => {
        const uid = r.viaUid.trim().toLowerCase();
        if (
          r.isViaFixed ||
          r.viaStatus === 'fixed' ||
          (fixedViaUids && uid && fixedViaUids.has(uid))
        ) {
          if (uid) fixedUidsForStaff.add(uid);
        }
      });
      return fixedUidsForStaff.size;
    }

    if (typeof propFixedViaCount === 'number') return propFixedViaCount;
    if (fixedViaUids && fixedViaUids.size > 0) {
      const uidsInScope = new Set(records.map((r) => r.viaUid.trim().toLowerCase()).filter(Boolean));
      let count = 0;
      fixedViaUids.forEach((uid) => {
        if (currentUser.role === 'admin' || uidsInScope.has(uid.toLowerCase())) {
          count++;
        }
      });
      return count;
    }
    return records.filter((r) => r.isViaFixed || r.viaStatus === 'fixed').length;
  }, [filter.staffName, staffScopedRecords, propFixedViaCount, fixedViaUids, records, currentUser.role]);

  const addingViaCount = useMemo(() => {
    return staffScopedRecords.filter((r) => r.viaTransferStatus === 'adding').length;
  }, [staffScopedRecords]);

  const completedViaCount = useMemo(() => {
    return staffScopedRecords.filter((r) => r.viaTransferStatus === 'completed').length;
  }, [staffScopedRecords]);

  const pendingTransferCount = useMemo(() => {
    return staffScopedRecords.filter((r) => r.viaTransferStatus === 'pending').length;
  }, [staffScopedRecords]);

  const hasTransferNoteCount = useMemo(() => {
    return staffScopedRecords.filter((r) =>
      Boolean(r.viaTransferNote || (r.viaTransferStatus && r.viaTransferStatus !== 'none') || r.viaTransferColor)
    ).length;
  }, [staffScopedRecords]);

  const bmOptions = useMemo(() => {
    const map = new Map<string, number>();
    staffScopedRecords.forEach((r) => {
      const b = getCleanBmName(r.bmNote);
      if (b) {
        map.set(b, (map.get(b) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi'));
  }, [staffScopedRecords]);

  const handleClear = () => {
    onChangeFilter({
      search: '',
      staffName: '',
      viaUid: '',
      bmFilter: '',
      multiPageOnly: false,
      errorViaOnly: false,
      fixedViaOnly: false,
      status: '',
      blockStatus: '',
      likeCountStatus: '',
      postingMethod: '',
      completionFilter: 'all',
      viaTransferFilter: 'all',
    });
  };

  const hasActiveFilters =
    Boolean(filter.search) ||
    (currentUser.role === 'admin' && Boolean(filter.staffName)) ||
    Boolean(filter.viaUid) ||
    Boolean(filter.bmFilter) ||
    Boolean(filter.multiPageOnly) ||
    Boolean(filter.errorViaOnly) ||
    Boolean(filter.fixedViaOnly) ||
    Boolean(filter.status) ||
    Boolean(filter.blockStatus) ||
    Boolean(filter.likeCountStatus) ||
    Boolean(filter.postingMethod) ||
    (Boolean(filter.viaTransferFilter) && filter.viaTransferFilter !== 'all') ||
    filter.completionFilter !== 'all';

  const isMultiLineSearch = filter.search.includes('\n');
  const searchLineCount = isMultiLineSearch
    ? filter.search.split(/\r?\n/).filter((l) => l.trim()).length
    : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-2xs text-xs">
      {/* TẦNG 1: PHẠM VI NHÂN VIÊN (TRÁI) & THAO TÁC CHÍNH (PHẢI) */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-slate-200/80 bg-slate-50/70 rounded-t-xl">
        {/* Trái: Danh sách Nhân viên (Chỉ hiển thị cho Admin) */}
        {currentUser.role === 'admin' ? (
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none min-w-0 flex-1 py-0.5">
            <span className="text-[11px] font-bold text-slate-500 shrink-0 mr-1 inline-flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>Nhân viên</span>
            </span>

            <button
              type="button"
              onClick={() => onChangeFilter({ ...filter, staffName: '' })}
              className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer shrink-0 whitespace-nowrap tabular-nums ${
                !filter.staffName || filter.staffName === 'all'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
              }`}
            >
              <span>Tất cả</span>
              <span
                className={`text-[10px] font-bold ${
                  !filter.staffName || filter.staffName === 'all'
                    ? 'text-slate-300'
                    : 'text-slate-400'
                }`}
              >
                {records.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                onChangeFilter({
                  ...filter,
                  staffName: isAdminWaitingPool(filter.staffName) ? '' : ADMIN_WAITING_POOL,
                })
              }
              title={`Kho Chờ Admin (Chưa nhân viên nào dùng): ${waitingPoolRecordsCount} Fanpage đang lưu kho`}
              className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer shrink-0 whitespace-nowrap tabular-nums ${
                isAdminWaitingPool(filter.staffName)
                  ? 'bg-amber-600 text-white border-amber-700'
                  : 'bg-amber-50/80 text-amber-900 border-amber-200 hover:bg-amber-100'
              }`}
            >
              <Archive className={`w-3 h-3 ${isAdminWaitingPool(filter.staffName) ? 'text-white' : 'text-amber-700'}`} />
              <span>Kho chờ</span>
              <span
                className={`text-[10px] font-extrabold ${
                  isAdminWaitingPool(filter.staffName) ? 'text-amber-100' : 'text-amber-700'
                }`}
              >
                {waitingPoolRecordsCount}
              </span>
            </button>

            {staffList.map((name) => {
              const nameLower = name.trim().toLowerCase();
              const isSelected =
                filter.staffName?.trim().toLowerCase() === nameLower ||
                (Boolean(filter.staffName) &&
                  filter.staffName !== 'all' &&
                  !isAdminWaitingPool(filter.staffName) &&
                  areStaffNamesEquivalent(filter.staffName, name));
              const staffRecords = records.filter(
                (r) =>
                  (r.staffName || '').trim().toLowerCase() === nameLower ||
                  areStaffNamesEquivalent(r.staffName, name)
              );
              const staffPagesCount = staffRecords.length;
              const manualCount = staffRecords.filter((r) => r.postingMethod === 'Đăng Tay').length;
              const toolCount = staffRecords.filter((r) => r.postingMethod === 'Tool').length;

              const staffGroupRecords = groupRecords.filter(
                (g) =>
                  (g.staffName || '').trim().toLowerCase() === nameLower ||
                  areStaffNamesEquivalent(g.staffName, name)
              );
              const staffGroupsCount = staffGroupRecords.length;
              const matchedAcc = accounts.find(
                (a) =>
                  (a.username || '').trim().toLowerCase() === nameLower ||
                  areStaffNamesEquivalent(a.username, name) ||
                  (Boolean(a.fullName) && areStaffNamesEquivalent(a.fullName, name))
              );
              const isAssignedGroup = Boolean(
                matchedAcc?.allowedTabs?.includes('group') || staffGroupsCount > 0
              );
              const isGroupOnly = staffPagesCount === 0 && isAssignedGroup;

              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => onChangeFilter({ ...filter, staffName: isSelected ? '' : name })}
                  title={
                    isGroupOnly
                      ? `${name}: Nhân viên chuyên trách Group (${staffGroupsCount} dòng Group)`
                      : isAssignedGroup
                      ? `${name}: ${staffPagesCount} Fanpage (${manualCount} Đăng Tay · ${toolCount} Đăng Tool) · ${staffGroupsCount} dòng Group`
                      : `${name}: ${staffPagesCount} Fanpage (${manualCount} Đăng Tay · ${toolCount} Đăng Tool)`
                  }
                  className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer shrink-0 whitespace-nowrap tabular-nums ${
                    isSelected
                      ? isGroupOnly
                        ? 'bg-rose-600 text-white border-rose-700'
                        : 'bg-[#2e7d32] text-white border-[#1b5e20]'
                      : isGroupOnly
                      ? 'bg-rose-50/80 text-rose-800 border-rose-200 hover:bg-rose-100'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <span>{name}</span>
                  {isGroupOnly ? (
                    <span
                      className={`text-[10px] font-bold ${
                        isSelected ? 'text-rose-100' : 'text-rose-600'
                      }`}
                    >
                      Group {staffGroupsCount}
                    </span>
                  ) : (
                    <span
                      className={`text-[10px] font-bold ${
                        isSelected ? 'text-emerald-100' : 'text-slate-400'
                      }`}
                    >
                      {staffPagesCount}
                      {staffGroupsCount > 0 ? ` · G:${staffGroupsCount}` : ''}
                    </span>
                  )}
                </button>
              );
            })}

            {onOpenTransferModal &&
              filter.staffName &&
              filter.staffName.trim() &&
              filter.staffName.trim().toLowerCase() !== 'all' &&
              !isAdminWaitingPool(filter.staffName) && (
                <button
                  type="button"
                  onClick={onOpenTransferModal}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                  title={`Chuyển toàn bộ Via + Group + Page của ${filter.staffName} sang cho nhân viên khác`}
                >
                  <ArrowRightLeft className="w-3 h-3" />
                  <span>Bàn giao {filter.staffName}</span>
                </button>
              )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Users className="w-3.5 h-3.5 text-emerald-700" />
            <span>Fanpage của {currentUser.name}</span>
            <span className="text-slate-400 font-semibold tabular-nums">({records.length})</span>
          </div>
        )}

        {/* Phải: Nhóm thao tác chính (1 Primary CTA + Secondary + Dropdown Excel gọn gàng) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onOpenAddModal && (
            <button
              type="button"
              id="btn-add-page-row"
              onClick={onOpenAddModal}
              className="inline-flex items-center gap-1 h-7 px-3 text-[11px] font-bold text-white bg-[#2e7d32] hover:bg-[#256629] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Thêm Fanpage mới vào bảng"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Page</span>
            </button>
          )}

          {onOpenFetchPagesModal && (
            <button
              type="button"
              id="btn-fetch-pages-table-top"
              onClick={onOpenFetchPagesModal}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer bg-white hover:bg-slate-100 text-slate-700 border-slate-200 whitespace-nowrap shrink-0"
              title="Lấy Tên & Link Page từ Nick Via tự động điền lên bảng"
            >
              <Zap className="w-3 h-3 text-blue-600" />
              <span>Lấy Page</span>
            </button>
          )}

          {onOpenTransferModal && (
            <button
              type="button"
              id="btn-transfer-page-in-filter-bar"
              onClick={onOpenTransferModal}
              className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Chuyển Full 1 Nhân Viên (Via + Group + Page) sang Nhân viên khác khi nghỉ việc hoặc chuyển lẻ Via/Page"
            >
              <ArrowRightLeft className="w-3 h-3 text-indigo-600" />
              <span>Chuyển NV / Via</span>
            </button>
          )}

          {onMarkAllDoneToday && (
            <button
              type="button"
              id="btn-mark-all-done-today"
              onClick={onMarkAllDoneToday}
              className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums"
              title={`Đánh dấu các page đã hoàn thành đủ số bài đăng hôm nay (${totalActualPosts}/${totalTargetPosts} bài)`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Duyệt bài ({totalActualPosts}/{totalTargetPosts})</span>
            </button>
          )}

          {/* Menu gom nhóm Excel: Nhập / Xuất / File Mẫu */}
          <div className="relative">
            <button
              type="button"
              id="btn-excel-actions-menu"
              onClick={() => setIsExcelMenuOpen((prev) => !prev)}
              aria-expanded={isExcelMenuOpen}
              className={`relative z-50 inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-semibold border rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isExcelMenuOpen
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'text-slate-700 bg-white hover:bg-slate-100 border-slate-200'
              }`}
              title="Nhập Excel, Xuất danh sách hoặc Tải file mẫu (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Excel</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isExcelMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsExcelMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-lg border border-slate-200 z-50 p-1 text-xs">
                  {onOpenImportModal && (
                    <button
                      type="button"
                      id="btn-import-excel"
                      onClick={() => {
                        setIsExcelMenuOpen(false);
                        onOpenImportModal();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                      <span>Nhập từ Excel / Dán</span>
                    </button>
                  )}
                  <button
                    type="button"
                    id="btn-export-sheet"
                    onClick={() => {
                      setIsExcelMenuOpen(false);
                      exportFanpageToXLSX(records);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Xuất danh sách (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    id="btn-download-excel-template"
                    onClick={() => {
                      setIsExcelMenuOpen(false);
                      downloadFanpageExcelTemplate('xlsx');
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-emerald-800 hover:bg-emerald-50 font-semibold cursor-pointer transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tải file Excel mẫu</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* TẦNG 2: TÌM KIẾM & BỘ LỌC CHI TIẾT */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-slate-100">
        {/* Search input: 1 dòng sắc nét, tự giãn khi dán nhiều UID */}
        <div className="relative w-60 sm:w-72 shrink-0">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1.5 pointer-events-none" />
          <textarea
            id="input-sheet-search"
            rows={isMultiLineSearch ? Math.min(searchLineCount || 2, 5) : 1}
            placeholder="Tìm Page, Link hoặc dán nhiều UID..."
            value={filter.search}
            onChange={(e) => onChangeFilter({ ...filter, search: e.target.value })}
            className={`w-full pl-8 pr-12 bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 text-[11px] font-mono leading-tight ${
              isMultiLineSearch
                ? 'py-1.5 resize-y'
                : 'h-7 py-1.5 resize-none overflow-hidden whitespace-nowrap'
            }`}
            title="Tìm theo tên Page, Link hoặc dán hàng loạt UID (mỗi UID 1 dòng)"
          />
          {filter.search && (
            <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
              {searchLineCount > 1 && (
                <span className="px-1 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-bold font-sans tabular-nums">
                  {searchLineCount} UID
                </span>
              )}
              <button
                type="button"
                onClick={() => onChangeFilter({ ...filter, search: '' })}
                className="text-slate-400 hover:text-slate-600 cursor-pointer bg-white/90 rounded p-0.5"
                title="Xóa tìm kiếm"
                aria-label="Xóa tìm kiếm"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Lọc Nick Via */}
        <select
          aria-label="Lọc theo Nick Via"
          value={filter.viaUid}
          onChange={(e) => onChangeFilter({ ...filter, viaUid: e.target.value })}
          className={`h-7 px-2 rounded-lg border text-[11px] font-medium font-mono cursor-pointer max-w-[148px] truncate transition-colors ${
            filter.viaUid
              ? 'bg-emerald-50 text-emerald-900 border-emerald-400 font-bold'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
          }`}
        >
          <option value="">Tất cả Via ({viaOptions.length})</option>
          {viaOptions.map((v) => (
            <option key={v.viaUid} value={v.viaUid}>
              Via {v.viaUid} ({v.count})
            </option>
          ))}
        </select>

        {/* Lọc Ghi Chú BM */}
        <select
          aria-label="Lọc theo Ghi chú BM"
          value={filter.bmFilter || ''}
          onChange={(e) => onChangeFilter({ ...filter, bmFilter: e.target.value })}
          className={`h-7 px-2 rounded-lg border text-[11px] font-medium cursor-pointer max-w-[138px] truncate transition-colors ${
            filter.bmFilter
              ? 'bg-emerald-50 text-emerald-900 border-emerald-400 font-bold'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
          }`}
          title="Lọc Fanpage theo Ghi chú BM"
        >
          <option value="">Tất cả BM ({bmOptions.length})</option>
          {bmOptions.map((b) => (
            <option key={b.name} value={b.name}>
              BM: {b.name} ({b.count})
            </option>
          ))}
          <option value="__none__">Chưa có BM</option>
        </select>

        {/* Lọc Chặn */}
        <select
          aria-label="Lọc trạng thái chặn"
          value={filter.blockStatus}
          onChange={(e) => onChangeFilter({ ...filter, blockStatus: e.target.value })}
          className={`h-7 px-2 rounded-lg border text-[11px] font-medium cursor-pointer transition-colors ${
            filter.blockStatus
              ? 'bg-amber-50 text-amber-900 border-amber-400 font-bold'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
          }`}
        >
          <option value="">Tất cả Chặn</option>
          <option value="Chặn VN">Chặn VN</option>
          <option value="Chặn Bản Quyền">Chặn Bản Quyền</option>
          <option value="Không Chặn">Không Chặn</option>
        </select>

        {/* Lọc Đếm Like */}
        <select
          aria-label="Lọc đếm like"
          value={filter.likeCountStatus || ''}
          onChange={(e) => onChangeFilter({ ...filter, likeCountStatus: e.target.value })}
          className={`h-7 px-2 border rounded-lg font-medium transition-colors text-[11px] cursor-pointer ${
            filter.likeCountStatus === 'Bỏ Đếm Like'
              ? 'bg-rose-600 text-white border-rose-700 font-bold'
              : filter.likeCountStatus
              ? 'bg-blue-50 text-blue-900 border-blue-300 font-bold'
              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
          }`}
        >
          <option value="" className="bg-white text-slate-700">Đếm Like</option>
          <option value="Đếm Like" className="bg-white text-blue-700">Đếm Like</option>
          <option value="Bỏ Đếm Like" className="bg-white text-rose-600 font-bold">Bỏ Đếm Like</option>
        </select>

        {/* Lọc Tiến độ đổi Via */}
        <select
          aria-label="Lọc tiến độ đổi Via"
          value={filter.viaTransferFilter || 'all'}
          onChange={(e) => onChangeFilter({ ...filter, viaTransferFilter: e.target.value })}
          className={`h-7 px-2 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
            filter.viaTransferFilter && filter.viaTransferFilter !== 'all'
              ? 'bg-amber-50 text-amber-950 border-amber-400 font-bold'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
          }`}
          title="Lọc theo ghi chú & tiến độ đổi Via của Admin"
        >
          <option value="all">Tiến độ Đổi Via ({staffScopedRecords.length})</option>
          <option value="adding">Đang add Via ({addingViaCount})</option>
          <option value="completed">Đã đổi xong ({completedViaCount})</option>
          <option value="pending">Cần đổi Via ({pendingTransferCount})</option>
          <option value="invited">Đã gửi lời mời</option>
          <option value="waiting">Chờ duyệt quyền</option>
          <option value="failed">Lỗi add</option>
          <option value="has_note">Có ghi chú đổi ({hasTransferNoteCount})</option>
        </select>

        {/* Tiến độ: Segmented control */}
        <div className="inline-flex items-center h-7 bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => onChangeFilter({ ...filter, completionFilter: 'all' })}
            className={`px-2 h-full rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              filter.completionFilter === 'all'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={() => onChangeFilter({ ...filter, completionFilter: 'completed' })}
            className={`px-2 h-full rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              filter.completionFilter === 'completed'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đang làm
          </button>
          <button
            type="button"
            onClick={() => onChangeFilter({ ...filter, completionFilter: 'in_progress' })}
            className={`px-2 h-full rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              filter.completionFilter === 'in_progress'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Không làm
          </button>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1 h-7 px-2.5 ml-auto text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Xóa tất cả các bộ lọc đang chọn"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Đặt lại lọc</span>
          </button>
        )}
      </div>

      {/* TẦNG 3: CHỈ SỐ & LỌC NHANH TRẠNG THÁI (CHIA 3 NHÓM: PAGE · VIA · ĐỔI VIA) */}
      <div className="flex flex-wrap items-center gap-y-1.5 gap-x-2 px-3 py-1.5 bg-slate-50/40 rounded-b-xl">
        {/* Nhóm 1: Trạng thái Fanpage */}
        <div className="flex items-center flex-wrap gap-1">
          <span className="text-[10px] font-bold text-slate-400 mr-0.5 select-none">Trạng thái:</span>

          <button
            type="button"
            id="status-stat-de-xuat"
            onClick={() =>
              onChangeFilter({
                ...filter,
                status: filter.status === 'Đề Xuất' ? '' : 'Đề Xuất',
              })
            }
            className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-[11px] font-semibold transition-colors cursor-pointer border whitespace-nowrap tabular-nums ${
              filter.status === 'Đề Xuất'
                ? 'bg-[#009b3a] text-white border-[#009b3a]'
                : 'bg-emerald-50/80 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
            title="Nhấn để lọc các Page Đang Đề Xuất"
          >
            <span>Đề Xuất</span>
            <span className="font-extrabold">{deXuatCount}</span>
          </button>

          <button
            type="button"
            id="status-stat-mat-de-xuat"
            onClick={() =>
              onChangeFilter({
                ...filter,
                status: filter.status === 'Mất Đề Xuất' ? '' : 'Mất Đề Xuất',
              })
            }
            className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-[11px] font-semibold transition-colors cursor-pointer border whitespace-nowrap tabular-nums ${
              filter.status === 'Mất Đề Xuất'
                ? 'bg-[#b31412] text-white border-[#b31412]'
                : matDeXuatCount > 0
                ? 'bg-rose-50/80 text-rose-800 border-rose-200 hover:bg-rose-100'
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
            }`}
            title="Nhấn để lọc các Page Mất Đề Xuất"
          >
            <span>Mất ĐX</span>
            <span className="font-extrabold">{matDeXuatCount}</span>
          </button>

          <button
            type="button"
            id="status-stat-dinh-chi"
            onClick={() =>
              onChangeFilter({
                ...filter,
                status: filter.status === 'Đình Chỉ' ? '' : 'Đình Chỉ',
              })
            }
            className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-[11px] font-semibold transition-colors cursor-pointer border whitespace-nowrap tabular-nums ${
              filter.status === 'Đình Chỉ'
                ? 'bg-amber-600 text-white border-amber-700'
                : dinhChiCount > 0
                ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
            }`}
            title="Nhấn để lọc các Page Bị Đình Chỉ"
          >
            <span>Đình Chỉ</span>
            <span className="font-extrabold">{dinhChiCount}</span>
          </button>

          <button
            type="button"
            id="status-stat-bi-back"
            onClick={() =>
              onChangeFilter({
                ...filter,
                status: filter.status === 'Bị Back' ? '' : 'Bị Back',
              })
            }
            className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-[11px] font-semibold transition-colors cursor-pointer border whitespace-nowrap tabular-nums ${
              filter.status === 'Bị Back'
                ? 'bg-purple-700 text-white border-purple-700'
                : biBackCount > 0
                ? 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
            }`}
            title="Nhấn để lọc các Page Bị Back"
          >
            <span>Bị Back</span>
            <span className="font-extrabold">{biBackCount}</span>
          </button>
        </div>

        <span className="hidden sm:inline-block h-4 w-px bg-slate-200" aria-hidden="true" />

        {/* Nhóm 2: Tình trạng Nick Via (Via Lỗi & Đã Sửa gom về 1 chỗ) */}
        <div className="flex items-center flex-wrap gap-1">
          <span className="text-[10px] font-bold text-slate-400 mr-0.5 select-none">Via:</span>

          <button
            type="button"
            id="status-stat-via-loi"
            onClick={() =>
              onChangeFilter({
                ...filter,
                errorViaOnly: !filter.errorViaOnly,
              })
            }
            className={`inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-semibold transition-colors cursor-pointer border whitespace-nowrap tabular-nums ${
              filter.errorViaOnly
                ? 'bg-[#b31412] text-white border-[#b31412]'
                : computedErrorViaCount > 0
                ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
            }`}
            title="Nhấn để lọc các Fanpage có Nick Via đang bị lỗi"
          >
            <AlertTriangle className={`w-3 h-3 ${filter.errorViaOnly ? 'text-white' : computedErrorViaCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
            <span>Via Lỗi</span>
            <span className="font-extrabold">{computedErrorViaCount}</span>
          </button>

          <button
            type="button"
            id="status-stat-via-da-sua"
            onClick={() => onChangeFilter({ ...filter, fixedViaOnly: !filter.fixedViaOnly })}
            className={`inline-flex items-center gap-1 h-6 px-2 rounded-md border text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
              filter.fixedViaOnly
                ? 'bg-emerald-600 text-white border-emerald-700'
                : computedFixedViaCount > 0
                ? 'bg-emerald-50/80 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
            }`}
            title="Lọc Nick Via đã sửa / thay mới"
          >
            <CheckCircle2 className={`w-3 h-3 ${filter.fixedViaOnly ? 'text-white' : computedFixedViaCount > 0 ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span>Đã Sửa</span>
            <span className="font-extrabold">{computedFixedViaCount}</span>
          </button>
        </div>

        <span className="hidden sm:inline-block h-4 w-px bg-slate-200" aria-hidden="true" />

        {/* Nhóm 3: Tiến độ Đổi Via */}
        <div className="flex items-center flex-wrap gap-1">
          <span className="text-[10px] font-bold text-slate-400 mr-0.5 select-none">Đổi Via:</span>

          <button
            type="button"
            id="status-stat-adding-via"
            onClick={() =>
              onChangeFilter({
                ...filter,
                viaTransferFilter: filter.viaTransferFilter === 'adding' ? 'all' : 'adding',
              })
            }
            className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-[11px] font-semibold transition-colors cursor-pointer border whitespace-nowrap tabular-nums ${
              filter.viaTransferFilter === 'adding'
                ? 'bg-amber-600 text-white border-amber-700'
                : addingViaCount > 0
                ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
            }`}
            title="Lọc các Page đang trong quá trình add sang Via mới"
          >
            <span>Đang Add</span>
            <span className="font-extrabold">{addingViaCount}</span>
          </button>

          <button
            type="button"
            id="status-stat-completed-via"
            onClick={() =>
              onChangeFilter({
                ...filter,
                viaTransferFilter: filter.viaTransferFilter === 'completed' ? 'all' : 'completed',
              })
            }
            className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-[11px] font-semibold transition-colors cursor-pointer border whitespace-nowrap tabular-nums ${
              filter.viaTransferFilter === 'completed'
                ? 'bg-emerald-600 text-white border-emerald-700'
                : completedViaCount > 0
                ? 'bg-emerald-50/80 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
            }`}
            title="Lọc các Page đã đổi Via thành công"
          >
            <span>Đã Đổi</span>
            <span className="font-extrabold">{completedViaCount}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

