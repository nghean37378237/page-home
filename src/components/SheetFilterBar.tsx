import React, { useMemo } from 'react';
import { Search, Filter, X, Lock, Layers, Plus, AlertTriangle, Trash2, ArrowRightLeft, CheckCircle2, Zap, Users } from 'lucide-react';
import { SheetFilter, PageRecord, AppUser } from '../types';

interface SheetFilterBarProps {
  filter: SheetFilter;
  onChangeFilter: (newFilter: SheetFilter) => void;
  records: PageRecord[];
  currentUser: AppUser;
  errorViaUids?: Set<string>;
  errorViaCount?: number;
  fixedViaUids?: Set<string>;
  fixedViaCount?: number;
  onOpenAddModal?: () => void;
  availableStaffNames?: string[];
  onOpenDeleteStaffModal?: (staffName?: string) => void;
  onOpenTransferModal?: () => void;
  onOpenFetchPagesModal?: () => void;
}

export const SheetFilterBar: React.FC<SheetFilterBarProps> = ({
  filter,
  onChangeFilter,
  records,
  currentUser,
  errorViaUids,
  errorViaCount: propErrorViaCount,
  fixedViaUids,
  fixedViaCount: propFixedViaCount,
  onOpenAddModal,
  availableStaffNames,
  onOpenDeleteStaffModal,
  onOpenTransferModal,
  onOpenFetchPagesModal,
}) => {
  const staffList = useMemo(() => {
    const list = availableStaffNames && availableStaffNames.length > 0 ? [...availableStaffNames] : [];
    records.forEach((r) => {
      const name = r.staffName?.trim();
      if (name && !list.some((s) => s.toLowerCase() === name.toLowerCase())) {
        list.push(name);
      }
    });
    return list.sort((a, b) => a.localeCompare(b, 'vi'));
  }, [records, availableStaffNames]);

  // Phân phạm vi dữ liệu: Khi chọn 1 nhân viên bất kỳ (hoặc nhân viên đang đăng nhập),
  // toàn bộ thống kê trạng thái (Đề Xuất, Mất Đề Xuất, Đình Chỉ, Bị Back, Via Lỗi...)
  // sẽ CHỈ tính trên các Fanpage của nhân viên đó!
  const staffScopedRecords = useMemo(() => {
    if (filter.staffName && filter.staffName.trim() && filter.staffName !== 'all') {
      const selectedStaffLower = filter.staffName.trim().toLowerCase();
      return records.filter(
        (r) => r.staffName && r.staffName.trim().toLowerCase() === selectedStaffLower
      );
    }
    return records;
  }, [records, filter.staffName]);

  // Compute distinct Vias with count of pages for the dropdown (chỉ trong phạm vi nhân viên đang chọn)
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

  // Thống kê báo cáo 4 trạng thái của các Fanpage (CHỈ THEO NHÂN VIÊN ĐANG CHỌN)
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

  // Thống kê Via Lỗi trong records đang xét (CHỈ THEO NHÂN VIÊN ĐANG CHỌN)
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

  // Thống kê Via Đã Sửa / Thay Mới (Bôi xanh) trong records đang xét (CHỈ THEO NHÂN VIÊN ĐANG CHỌN)
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

  const handleClear = () => {
    onChangeFilter({
      search: '',
      staffName: '',
      viaUid: '',
      multiPageOnly: false,
      errorViaOnly: false,
      fixedViaOnly: false,
      status: '',
      blockStatus: '',
      likeCountStatus: '',
      postingMethod: '',
      completionFilter: 'all',
    });
  };

  const hasActiveFilters =
    Boolean(filter.search) ||
    (currentUser.role === 'admin' && Boolean(filter.staffName)) ||
    Boolean(filter.viaUid) ||
    Boolean(filter.multiPageOnly) ||
    Boolean(filter.errorViaOnly) ||
    Boolean(filter.fixedViaOnly) ||
    Boolean(filter.status) ||
    Boolean(filter.blockStatus) ||
    Boolean(filter.likeCountStatus) ||
    Boolean(filter.postingMethod) ||
    filter.completionFilter !== 'all';

  return (
    <div className="bg-slate-50 border-b border-slate-200 py-1.5 px-3 sm:px-6">
      <div className="max-w-[1700px] mx-auto flex flex-col gap-1.5 text-xs">
        {/* HÀNG 1: NHÂN VIÊN (BÊN TRÁI) + BÁO CÁO TRẠNG THÁI (BÊN PHẢI) - GỘP CHUNG 1 DÒNG GỌN GÀNG */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1 border-b border-slate-200/80">
          {/* Bên trái: Danh sách nhân viên */}
          <div className="flex items-center space-x-1 overflow-x-auto scrollbar-thin py-0.5 max-w-full md:max-w-[55%]">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>NV:</span>
            </span>

            {/* Tab Tất Cả */}
            <button
              type="button"
              onClick={() => onChangeFilter({ ...filter, staffName: '' })}
              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                !filter.staffName || filter.staffName === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <span>Tất Cả</span>
              <span
                className={`px-1 py-0.2 rounded-full text-[10px] font-extrabold ${
                  !filter.staffName || filter.staffName === 'all'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {records.length}
              </span>
            </button>

            {/* Từng nhân viên */}
            {staffList.map((name) => {
              const isSelected = filter.staffName?.trim().toLowerCase() === name.trim().toLowerCase();
              const staffPagesCount = records.filter(
                (r) => r.staffName?.trim().toLowerCase() === name.trim().toLowerCase()
              ).length;

              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => onChangeFilter({ ...filter, staffName: isSelected ? '' : name })}
                  className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-indigo-500'}`} />
                  <span>{name}</span>
                  <span
                    className={`px-1 py-0.2 rounded-full text-[10px] font-extrabold ${
                      isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {staffPagesCount}
                  </span>
                </button>
              );
            })}

            {filter.staffName && filter.staffName !== 'all' && (
              <button
                type="button"
                onClick={() => onChangeFilter({ ...filter, staffName: '' })}
                className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded text-[11px] text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer shrink-0 font-medium"
                title="Bỏ chọn nhân viên, xem tất cả"
              >
                <X className="w-3 h-3" />
                <span>Bỏ lọc</span>
              </button>
            )}
          </div>

          {/* Bên phải: Báo cáo trạng thái tương tác nhanh (Click để lọc ngay) */}
          <div className="flex items-center flex-wrap gap-1 ml-auto shrink-0">
            {/* 1. Đề Xuất */}
            <button
              type="button"
              id="status-stat-de-xuat"
              onClick={() =>
                onChangeFilter({
                  ...filter,
                  status: filter.status === 'Đề Xuất' ? '' : 'Đề Xuất',
                })
              }
              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border shadow-2xs ${
                filter.status === 'Đề Xuất'
                  ? 'bg-[#009b3a] text-white border-[#009b3a] ring-1 ring-[#009b3a]/30'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              }`}
              title="Nhấn để lọc các Page Đang Đề Xuất"
            >
              <span>🚀 Đề Xuất:</span>
              <span
                className={`px-1 py-0.1 rounded-full text-[10px] font-black ${
                  filter.status === 'Đề Xuất'
                    ? 'bg-white text-[#009b3a]'
                    : 'bg-emerald-200/80 text-emerald-900'
                }`}
              >
                {deXuatCount}
              </span>
            </button>

            {/* 2. Mất Đề Xuất */}
            <button
              type="button"
              id="status-stat-mat-de-xuat"
              onClick={() =>
                onChangeFilter({
                  ...filter,
                  status: filter.status === 'Mất Đề Xuất' ? '' : 'Mất Đề Xuất',
                })
              }
              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border shadow-2xs ${
                filter.status === 'Mất Đề Xuất'
                  ? 'bg-[#b31412] text-white border-[#b31412] ring-1 ring-[#b31412]/30'
                  : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
              }`}
              title="Nhấn để lọc các Page Mất Đề Xuất"
            >
              <span>🔴 Mất ĐX:</span>
              <span
                className={`px-1 py-0.1 rounded-full text-[10px] font-black ${
                  filter.status === 'Mất Đề Xuất'
                    ? 'bg-white text-[#b31412]'
                    : 'bg-rose-200/80 text-rose-900'
                }`}
              >
                {matDeXuatCount}
              </span>
            </button>

            {/* 3. Đình Chỉ */}
            <button
              type="button"
              id="status-stat-dinh-chi"
              onClick={() =>
                onChangeFilter({
                  ...filter,
                  status: filter.status === 'Đình Chỉ' ? '' : 'Đình Chỉ',
                })
              }
              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border shadow-2xs ${
                filter.status === 'Đình Chỉ'
                  ? 'bg-[#d97706] text-white border-[#b45309] ring-1 ring-[#d97706]/30'
                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
              }`}
              title="Nhấn để lọc các Page Bị Đình Chỉ"
            >
              <span>⚠️ Đình Chỉ:</span>
              <span
                className={`px-1 py-0.1 rounded-full text-[10px] font-black ${
                  filter.status === 'Đình Chỉ'
                    ? 'bg-white text-[#b45309]'
                    : 'bg-amber-200/80 text-amber-950'
                }`}
              >
                {dinhChiCount}
              </span>
            </button>

            {/* 4. Bị Back */}
            <button
              type="button"
              id="status-stat-bi-back"
              onClick={() =>
                onChangeFilter({
                  ...filter,
                  status: filter.status === 'Bị Back' ? '' : 'Bị Back',
                })
              }
              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border shadow-2xs ${
                filter.status === 'Bị Back'
                  ? 'bg-[#673ab7] text-white border-[#673ab7] ring-1 ring-[#673ab7]/30'
                  : 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
              }`}
              title="Nhấn để lọc các Page Bị Back"
            >
              <span>🟣 Bị Back:</span>
              <span
                className={`px-1 py-0.1 rounded-full text-[10px] font-black ${
                  filter.status === 'Bị Back'
                    ? 'bg-white text-[#673ab7]'
                    : 'bg-purple-200/80 text-purple-900'
                }`}
              >
                {biBackCount}
              </span>
            </button>

            {/* 5. THỐNG KÊ VIA LỖI */}
            <button
              type="button"
              id="status-stat-via-loi"
              onClick={() =>
                onChangeFilter({
                  ...filter,
                  errorViaOnly: !filter.errorViaOnly,
                })
              }
              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border shadow-2xs ${
                filter.errorViaOnly
                  ? 'bg-[#b31412] text-white border-[#b31412] ring-1 ring-[#b31412]/30'
                  : computedErrorViaCount > 0
                  ? 'bg-rose-100/90 text-rose-900 border-rose-300 hover:bg-rose-200/90'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="Nhấn để lọc các Fanpage có Nick Via đang bị lỗi"
            >
              <AlertTriangle className={`w-3 h-3 ${filter.errorViaOnly ? 'text-white' : 'text-rose-600'}`} />
              <span>Via Lỗi:</span>
              <span
                className={`px-1 py-0.1 rounded-full text-[10px] font-black ${
                  filter.errorViaOnly
                    ? 'bg-white text-[#b31412]'
                    : computedErrorViaCount > 0
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {computedErrorViaCount}
              </span>
            </button>

            {/* Tổng số trang */}
            <span className="text-[11px] text-slate-500 font-medium pl-1 border-l border-slate-200">
              Tổng: <strong className="text-slate-900 font-black">{staffScopedRecords.length}</strong>
            </span>
          </div>
        </div>

        {/* HÀNG 2: TÌM KIẾM & BỘ LỌC TINH GỌN & THAO TÁC - TOÀN BỘ TRÊN 1 DÒNG DUY NHẤT */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 py-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Search input */}
            <div className="relative w-44 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                id="input-sheet-search"
                placeholder={
                  currentUser.role === 'staff'
                    ? `Tìm page của ${currentUser.name}...`
                    : 'Tìm Page, Link, UID Via...'
                }
                value={filter.search}
                onChange={(e) => onChangeFilter({ ...filter, search: e.target.value })}
                className="w-full pl-8 pr-7 py-1 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 text-xs shadow-2xs"
              />
              {filter.search && (
                <button
                  type="button"
                  onClick={() => onChangeFilter({ ...filter, search: '' })}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Xóa tìm kiếm"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Lọc Nick Via */}
            <select
              value={filter.viaUid}
              onChange={(e) => onChangeFilter({ ...filter, viaUid: e.target.value })}
              className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium font-mono text-xs shadow-2xs cursor-pointer max-w-[150px] truncate"
            >
              <option value="">Tất cả Via ({viaOptions.length})</option>
              {viaOptions.map((v) => (
                <option key={v.viaUid} value={v.viaUid}>
                  Via {v.viaUid} ({v.count})
                </option>
              ))}
            </select>

            {/* Lọc Chặn */}
            <select
              value={filter.blockStatus}
              onChange={(e) => onChangeFilter({ ...filter, blockStatus: e.target.value })}
              className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium text-xs shadow-2xs cursor-pointer"
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
              className={`px-2 py-1 border rounded-lg font-medium transition-colors text-xs shadow-2xs cursor-pointer ${
                filter.likeCountStatus === 'Bỏ Đếm Like'
                  ? 'bg-rose-600 text-white border-rose-700 font-bold'
                  : 'bg-white border-slate-300 text-slate-700'
              }`}
            >
              <option value="" className="bg-white text-slate-700">Đếm Like</option>
              <option value="Đếm Like" className="bg-white text-blue-700">👍 Đếm Like</option>
              <option value="Bỏ Đếm Like" className="bg-white text-rose-600 font-bold">🚫 Bỏ Đếm Like</option>
            </select>

            {/* Tiến độ bài: Segmented control */}
            <div className="flex items-center space-x-0.5 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300">
              <button
                type="button"
                onClick={() => onChangeFilter({ ...filter, completionFilter: 'all' })}
                className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  filter.completionFilter === 'all'
                    ? 'bg-white text-slate-900 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả bài
              </button>
              <button
                type="button"
                onClick={() => onChangeFilter({ ...filter, completionFilter: 'completed' })}
                className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  filter.completionFilter === 'completed'
                    ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Xong bài
              </button>
              <button
                type="button"
                onClick={() => onChangeFilter({ ...filter, completionFilter: 'in_progress' })}
                className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  filter.completionFilter === 'in_progress'
                    ? 'bg-amber-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Chưa đủ
              </button>
            </div>

            {/* Toggle: Via Đã Sửa */}
            <button
              type="button"
              onClick={() => onChangeFilter({ ...filter, fixedViaOnly: !filter.fixedViaOnly })}
              className={`inline-flex items-center space-x-1 px-2 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer shadow-2xs ${
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
          </div>

          {/* Nhóm nút tác vụ bên phải */}
          <div className="flex items-center space-x-1.5 ml-auto shrink-0">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center space-x-1 px-2 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                title="Xóa tất cả các bộ lọc đang chọn"
              >
                <X className="w-3 h-3" />
                <span>Đặt lại lọc</span>
              </button>
            )}

            {onOpenTransferModal && (
              <button
                type="button"
                id="btn-transfer-page-in-filter-bar"
                onClick={onOpenTransferModal}
                className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg shadow-2xs transition-all cursor-pointer shrink-0"
                title="Chuyển Fanpage sang Nick Via khác"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Chuyển Page Qua Via</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

