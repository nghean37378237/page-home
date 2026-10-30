import React, { useMemo } from 'react';
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
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b, 'vi' as any));
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

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
      <div className="flex flex-col gap-1.5 text-xs">
        {/* HÀNG 2: NHÂN VIÊN (TRÁI) + TRẠNG THÁI (GIỮA) + THAO TÁC CHÍNH (PHẢI) */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1 border-b border-slate-200/80">
          {/* Trái: Danh sách nhân viên (Chỉ hiển thị cho Admin; ẩn ở góc nhìn Nhân viên vì đã lọc riêng theo NV đó) */}
          {currentUser.role === 'admin' && (
            <div className="flex items-center space-x-1 overflow-x-auto scrollbar-none py-0.5 max-w-full">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider shrink-0 mr-0.5 flex items-center gap-0.5">
                <Users className="w-3 h-3 text-indigo-600" />
                <span>NV:</span>
              </span>

              <button
                type="button"
                onClick={() => onChangeFilter({ ...filter, staffName: '' })}
                className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-bold border transition-all cursor-pointer shrink-0 ${
                  !filter.staffName || filter.staffName === 'all'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <span>Tất Cả</span>
                <span
                  className={`px-1 rounded-full text-[10px] font-extrabold ${
                    !filter.staffName || filter.staffName === 'all'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-700'
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
                className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold border transition-all cursor-pointer shrink-0 ${
                  isAdminWaitingPool(filter.staffName)
                    ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                    : 'bg-amber-50 text-amber-950 border-amber-300 hover:bg-amber-100'
                }`}
              >
                <Archive className={`w-3 h-3 ${isAdminWaitingPool(filter.staffName) ? 'text-white' : 'text-amber-700'}`} />
                <span>Kho Chờ</span>
                <span
                  className={`px-1 rounded-full text-[10px] font-black ${
                    isAdminWaitingPool(filter.staffName)
                      ? 'bg-white/25 text-white'
                      : 'bg-white text-amber-950 border border-amber-300'
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
                        ? `${name}: ${staffPagesCount} Fanpage (✍️ ${manualCount} Đăng Tay • 🤖 ${toolCount} Đăng Tool) • ${staffGroupsCount} dòng Group`
                        : `${name}: ${staffPagesCount} Fanpage (✍️ ${manualCount} Đăng Tay • 🤖 ${toolCount} Đăng Tool)`
                    }
                    className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-bold border transition-all cursor-pointer shrink-0 ${
                      isSelected
                        ? isGroupOnly
                          ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                          : 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : isGroupOnly
                        ? 'bg-rose-50/70 text-rose-900 border-rose-300 hover:bg-rose-100'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-white' : isGroupOnly ? 'bg-red-500' : 'bg-indigo-500'
                      }`}
                    />
                    <span>{name}</span>
                    {isGroupOnly ? (
                      <span
                        className={`px-1.5 rounded-full text-[10px] font-extrabold ${
                          isSelected
                            ? 'bg-white/25 text-white'
                            : 'bg-red-600 text-white'
                        }`}
                      >
                        Group: {staffGroupsCount}
                      </span>
                    ) : (
                      <>
                        <span
                          className={`px-1 rounded-full text-[10px] font-extrabold ${
                            isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {staffPagesCount}
                        </span>
                        {staffGroupsCount > 0 && (
                          <span
                            className={`px-1 rounded-full text-[10px] font-extrabold ${
                              isSelected
                                ? 'bg-amber-300 text-slate-900'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}
                          >
                            G:{staffGroupsCount}
                          </span>
                        )}
                      </>
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
                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-700 hover:to-indigo-700 text-white shadow-2xs transition-all cursor-pointer shrink-0"
                    title={`Chuyển toàn bộ Via + Group + Page của ${filter.staffName} sang cho nhân viên khác`}
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>Bàn giao Full {filter.staffName}</span>
                  </button>
                )}
            </div>
          )}

          {/* Giữa: Báo cáo trạng thái tương tác nhanh (1-click lọc) */}
          <div className="flex items-center flex-wrap gap-1">
            <button
              type="button"
              id="status-stat-de-xuat"
              onClick={() =>
                onChangeFilter({
                  ...filter,
                  status: filter.status === 'Đề Xuất' ? '' : 'Đề Xuất',
                })
              }
              className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer border ${
                filter.status === 'Đề Xuất'
                  ? 'bg-[#009b3a] text-white border-[#009b3a]'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              }`}
              title="Nhấn để lọc các Page Đang Đề Xuất"
            >
              <span>🚀 ĐX:</span>
              <span className="font-black">{deXuatCount}</span>
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
              className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer border ${
                filter.status === 'Mất Đề Xuất'
                  ? 'bg-[#b31412] text-white border-[#b31412]'
                  : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
              }`}
              title="Nhấn để lọc các Page Mất Đề Xuất"
            >
              <span>🔴 Mất ĐX:</span>
              <span className="font-black">{matDeXuatCount}</span>
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
              className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer border ${
                filter.status === 'Đình Chỉ'
                  ? 'bg-[#d97706] text-white border-[#b45309]'
                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
              }`}
              title="Nhấn để lọc các Page Bị Đình Chỉ"
            >
              <span>⚠️ Đ.Chỉ:</span>
              <span className="font-black">{dinhChiCount}</span>
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
              className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer border ${
                filter.status === 'Bị Back'
                  ? 'bg-[#673ab7] text-white border-[#673ab7]'
                  : 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
              }`}
              title="Nhấn để lọc các Page Bị Back"
            >
              <span>🟣 Back:</span>
              <span className="font-black">{biBackCount}</span>
            </button>

            <button
              type="button"
              id="status-stat-via-loi"
              onClick={() =>
                onChangeFilter({
                  ...filter,
                  errorViaOnly: !filter.errorViaOnly,
                })
              }
              className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer border ${
                filter.errorViaOnly
                  ? 'bg-[#b31412] text-white border-[#b31412]'
                  : computedErrorViaCount > 0
                  ? 'bg-rose-100 text-rose-900 border-rose-300 hover:bg-rose-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="Nhấn để lọc các Fanpage có Nick Via đang bị lỗi"
            >
              <AlertTriangle className={`w-3 h-3 ${filter.errorViaOnly ? 'text-white' : 'text-rose-600'}`} />
              <span>Via Lỗi:</span>
              <span className="font-black">{computedErrorViaCount}</span>
            </button>

            <button
              type="button"
              id="status-stat-adding-via"
              onClick={() =>
                onChangeFilter({
                  ...filter,
                  viaTransferFilter: filter.viaTransferFilter === 'adding' ? 'all' : 'adding',
                })
              }
              className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer border ${
                filter.viaTransferFilter === 'adding'
                  ? 'bg-amber-500 text-white border-amber-600'
                  : addingViaCount > 0
                  ? 'bg-amber-100 text-amber-950 border-amber-300 hover:bg-amber-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="Lọc các Page đang trong quá trình add sang Via mới"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span>Đang Add:</span>
              <span className="font-black">{addingViaCount}</span>
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
              className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer border ${
                filter.viaTransferFilter === 'completed'
                  ? 'bg-emerald-600 text-white border-emerald-700'
                  : completedViaCount > 0
                  ? 'bg-emerald-100 text-emerald-950 border-emerald-300 hover:bg-emerald-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="Lọc các Page đã đổi Via thành công"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Đã Đổi:</span>
              <span className="font-black">{completedViaCount}</span>
            </button>
          </div>

          {/* Phải: Các nút thao tác chính (Thêm Page, Lấy Page, Chuyển Via, Nhập/Xuất/Mẫu Excel, Duyệt Bài) */}
          <div className="flex items-center flex-wrap gap-1 ml-auto shrink-0">
            {onOpenAddModal && (
              <button
                type="button"
                id="btn-add-page-row"
                onClick={onOpenAddModal}
                className="inline-flex items-center space-x-1 px-2.5 py-0.5 text-[11px] font-bold text-white bg-[#2e7d32] hover:bg-[#256629] rounded-md shadow-2xs transition-all cursor-pointer"
                title="Thêm Fanpage mới vào bảng"
              >
                <Plus className="w-3 h-3" />
                <span>+ Thêm Page</span>
              </button>
            )}

            {onOpenFetchPagesModal && (
              <button
                type="button"
                id="btn-fetch-pages-table-top"
                onClick={onOpenFetchPagesModal}
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md border text-[11px] font-bold transition-all shadow-2xs cursor-pointer bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-300"
                title="Lấy Tên & Link Page từ Nick Via tự động điền lên bảng"
              >
                <Zap className="w-3 h-3 text-blue-600 fill-blue-600" />
                <span>Lấy Page</span>
              </button>
            )}

            {onOpenTransferModal && (
              <button
                type="button"
                id="btn-transfer-page-in-filter-bar"
                onClick={onOpenTransferModal}
                className="inline-flex items-center space-x-1 px-2 py-0.5 text-[11px] font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md shadow-2xs transition-all cursor-pointer"
                title="Chuyển Full 1 Nhân Viên (Via + Group + Page) sang Nhân viên khác khi nghỉ việc hoặc chuyển lẻ Via/Page"
              >
                <ArrowRightLeft className="w-3 h-3" />
                <span>Chuyển Full NV / Via / Page</span>
              </button>
            )}

            {onOpenImportModal && (
              <button
                type="button"
                id="btn-import-excel"
                onClick={onOpenImportModal}
                className="inline-flex items-center space-x-1 px-2 py-0.5 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md shadow-2xs transition-colors cursor-pointer"
                title="Nhập dữ liệu Fanpage từ file Excel (.xlsx) hoặc Copy-Paste"
              >
                <Upload className="w-3 h-3 text-slate-600" />
                <span>Nhập Excel</span>
              </button>
            )}

            <button
              type="button"
              id="btn-export-sheet"
              onClick={() => exportFanpageToXLSX(records)}
              className="inline-flex items-center space-x-1 px-2 py-0.5 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md shadow-2xs transition-colors cursor-pointer"
              title="Xuất danh sách Fanpage ra file Excel (.xlsx)"
            >
              <Download className="w-3 h-3 text-slate-600" />
              <span>Xuất</span>
            </button>

            <button
              type="button"
              id="btn-download-excel-template"
              onClick={() => downloadFanpageExcelTemplate('xlsx')}
              className="inline-flex items-center space-x-1 px-2 py-0.5 text-[11px] font-bold text-emerald-900 bg-emerald-100/80 hover:bg-emerald-200 border border-emerald-300 rounded-md shadow-2xs transition-colors cursor-pointer"
              title="Tải file Excel mẫu chuẩn (.xlsx)"
            >
              <FileSpreadsheet className="w-3 h-3 text-emerald-700" />
              <span>Mẫu</span>
            </button>

            {onMarkAllDoneToday && (
              <button
                type="button"
                id="btn-mark-all-done-today"
                onClick={onMarkAllDoneToday}
                className="inline-flex items-center space-x-1 px-2 py-0.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-md shadow-2xs transition-colors cursor-pointer"
                title={`Đánh dấu các page đã hoàn thành đủ số bài đăng hôm nay (${totalActualPosts}/${totalTargetPosts} bài)`}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Duyệt Bài ({totalActualPosts}/{totalTargetPosts})</span>
              </button>
            )}
          </div>
        </div>

        {/* HÀNG 3: TÌM KIẾM & BỘ LỌC CHI TIẾT TRÊN 1 DÒNG GỌN GÀNG */}
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5 flex-1">
            {/* Search input (Supports multi-line bulk UID search - 1 UID per line) */}
            <div className="relative w-52 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1.5 pointer-events-none" />
              <textarea
                id="input-sheet-search"
                rows={
                  filter.search.includes('\n')
                    ? Math.min(filter.search.split(/\r?\n/).filter((l) => l.trim()).length, 5)
                    : 1
                }
                placeholder={
                  currentUser.role === 'staff'
                    ? `Tìm page hoặc dán nhiều UID (1 UID/dòng)...`
                    : 'Tìm Page, Link, hoặc dán nhiều UID (1 UID/dòng)...'
                }
                value={filter.search}
                onChange={(e) => onChangeFilter({ ...filter, search: e.target.value })}
                className="w-full pl-7 pr-14 py-1 bg-white border border-slate-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 text-[11px] shadow-2xs font-mono resize-y leading-snug"
                title="Có thể dán hàng loạt UID (mỗi UID 1 dòng) để lọc nhanh các Fanpage theo nhiều UID"
              />
              {filter.search && (
                <div className="absolute right-1.5 top-1 flex items-center space-x-1">
                  {filter.search.split(/\r?\n/).filter((l) => l.trim()).length > 1 && (
                    <span className="px-1 py-0.2 bg-emerald-100 text-emerald-800 rounded text-[9px] font-extrabold font-sans">
                      {filter.search.split(/\r?\n/).filter((l) => l.trim()).length} UID
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onChangeFilter({ ...filter, search: '' })}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer bg-white/90 rounded"
                    title="Xóa tìm kiếm"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Lọc Nick Via */}
            <select
              value={filter.viaUid}
              onChange={(e) => onChangeFilter({ ...filter, viaUid: e.target.value })}
              className="px-2 py-0.5 bg-white border border-slate-300 rounded-md text-slate-700 font-medium font-mono text-[11px] shadow-2xs cursor-pointer max-w-[140px] truncate"
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
              value={filter.bmFilter || ''}
              onChange={(e) => onChangeFilter({ ...filter, bmFilter: e.target.value })}
              className={`px-2 py-0.5 rounded-md border text-[11px] font-medium transition-all shadow-2xs cursor-pointer max-w-[130px] truncate ${
                filter.bmFilter
                  ? 'bg-emerald-50 text-emerald-950 border-emerald-400 font-bold'
                  : 'bg-white text-slate-700 border-slate-300'
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
              value={filter.blockStatus}
              onChange={(e) => onChangeFilter({ ...filter, blockStatus: e.target.value })}
              className="px-2 py-0.5 bg-white border border-slate-300 rounded-md text-slate-700 font-medium text-[11px] shadow-2xs cursor-pointer"
            >
              <option value="">Tất cả Chặn</option>
              <option value="Chặn VN">🚫 Chặn VN</option>
              <option value="Chặn Bản Quyền">⚠️ Chặn Bản Quyền</option>
              <option value="Không Chặn">Không Chặn</option>
            </select>

            {/* Lọc Đếm Like */}
            <select
              value={filter.likeCountStatus || ''}
              onChange={(e) => onChangeFilter({ ...filter, likeCountStatus: e.target.value })}
              className={`px-2 py-0.5 border rounded-md font-medium transition-colors text-[11px] shadow-2xs cursor-pointer ${
                filter.likeCountStatus === 'Bỏ Đếm Like'
                  ? 'bg-rose-600 text-white border-rose-700 font-bold'
                  : 'bg-white border-slate-300 text-slate-700'
              }`}
            >
              <option value="" className="bg-white text-slate-700">Đếm Like</option>
              <option value="Đếm Like" className="bg-white text-blue-700">👍 Đếm Like</option>
              <option value="Bỏ Đếm Like" className="bg-white text-rose-600 font-bold">🚫 Bỏ Đếm Like</option>
            </select>

            {/* Tiến độ: Segmented control (Đang làm / Không làm) */}
            <div className="flex items-center space-x-0.5 bg-slate-200/80 p-0.5 rounded-md border border-slate-300">
              <button
                type="button"
                onClick={() => onChangeFilter({ ...filter, completionFilter: 'all' })}
                className={`px-1.5 py-0.2 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                  filter.completionFilter === 'all'
                    ? 'bg-white text-slate-900 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => onChangeFilter({ ...filter, completionFilter: 'completed' })}
                className={`px-1.5 py-0.2 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                  filter.completionFilter === 'completed'
                    ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đang làm
              </button>
              <button
                type="button"
                onClick={() => onChangeFilter({ ...filter, completionFilter: 'in_progress' })}
                className={`px-1.5 py-0.2 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                  filter.completionFilter === 'in_progress'
                    ? 'bg-rose-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Không làm
              </button>
            </div>

            {/* Toggle: Via Đã Sửa */}
            <button
              type="button"
              onClick={() => onChangeFilter({ ...filter, fixedViaOnly: !filter.fixedViaOnly })}
              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md border text-[11px] font-bold transition-all cursor-pointer shadow-2xs ${
                filter.fixedViaOnly
                  ? 'bg-emerald-600 text-white border-emerald-700'
                  : computedFixedViaCount > 0
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              title="Lọc Nick Via đã sửa / thay mới"
            >
              <CheckCircle2 className={`w-3 h-3 ${filter.fixedViaOnly ? 'text-white' : 'text-emerald-600'}`} />
              <span>Đã Sửa ({computedFixedViaCount})</span>
            </button>

            {/* Lọc Tiến độ đổi Via / Admin Note */}
            <select
              value={filter.viaTransferFilter || 'all'}
              onChange={(e) => onChangeFilter({ ...filter, viaTransferFilter: e.target.value })}
              className={`px-2 py-0.5 rounded-md border text-[11px] font-bold transition-all shadow-2xs cursor-pointer ${
                filter.viaTransferFilter && filter.viaTransferFilter !== 'all'
                  ? 'bg-amber-100 text-amber-950 border-amber-400'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
              title="Lọc theo ghi chú & tiến độ đổi Via của Admin"
            >
              <option value="all">Tiến độ Đổi Via ({staffScopedRecords.length})</option>
              <option value="adding">🟡 Đang add Via ({addingViaCount})</option>
              <option value="completed">🟢 Đã đổi xong ({completedViaCount})</option>
              <option value="pending">🔴 Cần đổi Via ({pendingTransferCount})</option>
              <option value="invited">🔵 Đã gửi lời mời</option>
              <option value="waiting">🟣 Chờ duyệt quyền</option>
              <option value="failed">⚠️ Lỗi add</option>
              <option value="has_note">📝 Có ghi chú đổi ({hasTransferNoteCount})</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center space-x-1 px-2 py-0.5 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors cursor-pointer"
                title="Xóa tất cả các bộ lọc đang chọn"
              >
                <X className="w-3 h-3" />
                <span>Đặt lại lọc</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
