import React, { useMemo } from 'react';
import { Search, Filter, X, Lock, Layers, Plus, AlertTriangle, Trash2, ArrowRightLeft, CheckCircle2, Zap } from 'lucide-react';
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

  // Compute distinct Vias with count of pages for the dropdown
  const viaOptions = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((r) => {
      const uid = r.viaUid.trim();
      if (uid) {
        map.set(uid, (map.get(uid) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([viaUid, count]) => ({ viaUid, count }))
      .sort((a, b) => b.count - a.count);
  }, [records]);

  // Thống kê báo cáo 4 trạng thái của các Fanpage
  const deXuatCount = useMemo(
    () => records.filter((r) => r.status === 'Đề Xuất').length,
    [records]
  );
  const matDeXuatCount = useMemo(
    () => records.filter((r) => r.status === 'Mất Đề Xuất').length,
    [records]
  );
  const dinhChiCount = useMemo(
    () => records.filter((r) => r.status === 'Đình Chỉ').length,
    [records]
  );
  const biBackCount = useMemo(
    () => records.filter((r) => r.status === 'Bị Back').length,
    [records]
  );

  // Thống kê Via Lỗi trong records đang xét
  const computedErrorViaCount = useMemo(() => {
    if (typeof propErrorViaCount === 'number') return propErrorViaCount;
    if (errorViaUids && errorViaUids.size > 0) {
      const uidsInScope = new Set(records.map((r) => r.viaUid.trim()).filter(Boolean));
      let count = 0;
      errorViaUids.forEach((uid) => {
        if (currentUser.role === 'admin' || uidsInScope.has(uid)) {
          count++;
        }
      });
      return count;
    }
    return records.filter((r) => r.isViaError).length;
  }, [propErrorViaCount, errorViaUids, records, currentUser.role]);

  // Thống kê Via Đã Sửa / Thay Mới (Bôi xanh) trong records đang xét
  const computedFixedViaCount = useMemo(() => {
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
  }, [propFixedViaCount, fixedViaUids, records, currentUser.role]);

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
    <div className="bg-slate-50 border-b border-slate-200 py-2.5 px-4 sm:px-6">
      <div className="max-w-[1700px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search input */}
        <div className="flex items-center flex-1 min-w-[240px] max-w-md relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            id="input-sheet-search"
            placeholder={
              currentUser.role === 'staff'
                ? `Tìm trong Page của ${currentUser.name}: Tên Page, Link, UID Via...`
                : 'Tìm theo Tên Page, Link, UID Via, Ghi chú BM...'
            }
            value={filter.search}
            onChange={(e) => onChangeFilter({ ...filter, search: e.target.value })}
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600"
          />
        </div>

        {/* Filter dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Staff filter: only show dropdown if admin; if staff, show locked badge */}
          {currentUser.role === 'admin' ? (
            <div className="flex items-center space-x-1">
              <select
                value={filter.staffName}
                onChange={(e) => onChangeFilter({ ...filter, staffName: e.target.value })}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium"
              >
                <option value="">Tất cả Nhân Viên ({staffList.length} NV)</option>
                {staffList.map((name) => (
                  <option key={name} value={name}>
                    NV: {name}
                  </option>
                ))}
              </select>

              {onOpenDeleteStaffModal && (
                <button
                  type="button"
                  onClick={() => onOpenDeleteStaffModal(filter.staffName || undefined)}
                  className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                    filter.staffName
                      ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300'
                  }`}
                  title={
                    filter.staffName
                      ? `Chọn xóa toàn bộ dữ liệu của nhân viên ${filter.staffName}`
                      : 'Chọn xóa toàn bộ dữ liệu của 1 nhân viên bất kỳ'
                  }
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span className="hidden sm:inline">
                    {filter.staffName ? `Xóa Dữ Liệu NV ${filter.staffName}` : 'Xóa Dữ Liệu 1 NV'}
                  </span>
                </button>
              )}
            </div>
          ) : (
            <div className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg font-bold">
              <Lock className="w-3 h-3 text-emerald-600" />
              <span>Chỉ hiển thị: {currentUser.name}</span>
            </div>
          )}

          {/* Via filter dropdown */}
          <select
            value={filter.viaUid}
            onChange={(e) => onChangeFilter({ ...filter, viaUid: e.target.value })}
            className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium font-mono text-xs"
          >
            <option value="">Tất cả Nick Via ({viaOptions.length} via)</option>
            {viaOptions.map((v) => (
              <option key={v.viaUid} value={v.viaUid}>
                Via {v.viaUid} ({v.count} page)
              </option>
            ))}
          </select>

          {/* Quick toggle: 1 Via cầm nhiều page (>= 2 page) */}
          <button
            type="button"
            onClick={() =>
              onChangeFilter({
                ...filter,
                multiPageOnly: !filter.multiPageOnly,
              })
            }
            className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
              filter.multiPageOnly
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
            }`}
            title="Lọc chỉ hiển thị các Nick Via đang cầm từ 2 Fanpage trở lên"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Via cầm ≥ 2 Page</span>
          </button>

          {/* Quick toggle: Lọc Via Lỗi */}
          <button
            type="button"
            onClick={() =>
              onChangeFilter({
                ...filter,
                errorViaOnly: !filter.errorViaOnly,
              })
            }
            className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
              filter.errorViaOnly
                ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                : computedErrorViaCount > 0
                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Lọc chỉ hiển thị các Fanpage có Nick Via bị lỗi / checkpoint"
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${filter.errorViaOnly ? 'text-white' : 'text-rose-600'}`} />
            <span>Via Lỗi ({computedErrorViaCount})</span>
          </button>

          {/* Quick toggle: Lọc Via Đã Sửa / Thay Mới (Bôi xanh) */}
          <button
            type="button"
            onClick={() =>
              onChangeFilter({
                ...filter,
                fixedViaOnly: !filter.fixedViaOnly,
              })
            }
            className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
              filter.fixedViaOnly
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                : computedFixedViaCount > 0
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Lọc chỉ hiển thị các Fanpage có Nick Via đã được Admin sửa lỗi & thay via mới (bôi màu xanh lá)"
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${filter.fixedViaOnly ? 'text-white' : 'text-emerald-600'}`} />
            <span>Via Đã Sửa ({computedFixedViaCount})</span>
          </button>

          {/* Status filter */}
          <select
            value={filter.status}
            onChange={(e) => onChangeFilter({ ...filter, status: e.target.value })}
            className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium"
          >
            <option value="">Tất cả Trạng Thái</option>
            <option value="Đề Xuất">🚀 Đề Xuất</option>
            <option value="Mất Đề Xuất">🔴 Mất Đề Xuất</option>
            <option value="Đình Chỉ">⚠️ Đình Chỉ</option>
            <option value="Bị Back">🟣 Bị Back</option>
          </select>

          {/* Block filter */}
          <select
            value={filter.blockStatus}
            onChange={(e) => onChangeFilter({ ...filter, blockStatus: e.target.value })}
            className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium"
          >
            <option value="">Tất cả Chặn</option>
            <option value="Chặn VN">🚫 Chặn VN</option>
            <option value="Chặn Bản Quyền">⚠️ Chặn Bản Quyền</option>
            <option value="Không Chặn">Không Chặn</option>
          </select>

          {/* Like count filter */}
          <select
            value={filter.likeCountStatus || ''}
            onChange={(e) => onChangeFilter({ ...filter, likeCountStatus: e.target.value })}
            className={`px-2.5 py-1.5 border rounded-lg font-medium transition-colors ${
              filter.likeCountStatus === 'Bỏ Đếm Like'
                ? 'bg-red-600 text-white border-red-700 font-bold'
                : 'bg-white border-slate-300 text-slate-700'
            }`}
          >
            <option value="" className="bg-white text-slate-700">Tất cả Đếm Like</option>
            <option value="Đếm Like" className="bg-white text-blue-700">👍 Đếm Like</option>
            <option value="Bỏ Đếm Like" className="bg-white text-red-600 font-bold">🚫 Bỏ Đếm Like (Đỏ)</option>
          </select>

          {/* Posting completion filter */}
          <div className="flex items-center space-x-1 bg-white border border-slate-300 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => onChangeFilter({ ...filter, completionFilter: 'all' })}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                filter.completionFilter === 'all'
                  ? 'bg-[#2e7d32] text-white font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả bài
            </button>
            <button
              type="button"
              onClick={() => onChangeFilter({ ...filter, completionFilter: 'completed' })}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                filter.completionFilter === 'completed'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đã xong bài
            </button>
            <button
              type="button"
              onClick={() => onChangeFilter({ ...filter, completionFilter: 'in_progress' })}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                filter.completionFilter === 'in_progress'
                  ? 'bg-amber-600 text-white font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Chưa đủ bài
            </button>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Xóa tất cả bộ lọc"
            >
              <X className="w-3.5 h-3.5" />
              <span>Đặt lại lọc</span>
            </button>
          )}

          {onOpenTransferModal && (
            <button
              type="button"
              id="btn-transfer-page-in-filter-bar"
              onClick={onOpenTransferModal}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 border border-indigo-200 rounded-lg shadow-2xs transition-all cursor-pointer shrink-0 ml-1"
              title="Chuyển Fanpage sang Nick Via khác kèm toàn bộ thông tin bài đăng"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Chuyển Page Qua Via</span>
            </button>
          )}

          {onOpenFetchPagesModal && (
            <button
              type="button"
              id="btn-fetch-pages-in-filter-bar"
              onClick={onOpenFetchPagesModal}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 border border-blue-300 rounded-lg shadow-2xs transition-all cursor-pointer shrink-0 ml-1"
              title="Lấy Tên & Link Page từ Via tự động điền vào bảng"
            >
              <Zap className="w-3.5 h-3.5 text-blue-600 fill-blue-600" />
              <span>⚡ Lấy Page Từ Via</span>
            </button>
          )}

          {onOpenAddModal && (
            <button
              type="button"
              id="btn-add-page-in-filter-bar"
              onClick={onOpenAddModal}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[#2e7d32] hover:bg-[#256629] active:bg-[#1b5e20] rounded-lg shadow-2xs transition-all cursor-pointer shrink-0 ml-1"
              title="Thêm Fanpage mới vào bảng quản lý này"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Thêm Page Mới</span>
            </button>
          )}
        </div>

        {/* Báo cáo thống kê 4 Trạng thái Fanpage + Thống kê Via Lỗi */}
        <div className="w-full pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center space-x-1 mr-1">
              <span>Báo Cáo Trạng Thái:</span>
            </span>

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
              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                filter.status === 'Đề Xuất'
                  ? 'bg-[#009b3a] text-white border-[#009b3a] shadow-xs ring-2 ring-[#009b3a]/30'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              }`}
              title="Nhấn để lọc các Page Đang Đề Xuất"
            >
              <span>🚀 Đề Xuất:</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[11px] font-black ${
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
              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                filter.status === 'Mất Đề Xuất'
                  ? 'bg-[#b31412] text-white border-[#b31412] shadow-xs ring-2 ring-[#b31412]/30'
                  : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
              }`}
              title="Nhấn để lọc các Page Mất Đề Xuất"
            >
              <span>🔴 Mất Đề Xuất:</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[11px] font-black ${
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
              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                filter.status === 'Đình Chỉ'
                  ? 'bg-[#d97706] text-white border-[#b45309] shadow-xs ring-2 ring-[#d97706]/30'
                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
              }`}
              title="Nhấn để lọc các Page Bị Đình Chỉ"
            >
              <span>⚠️ Đình Chỉ:</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[11px] font-black ${
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
              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                filter.status === 'Bị Back'
                  ? 'bg-[#673ab7] text-white border-[#673ab7] shadow-xs ring-2 ring-[#673ab7]/30'
                  : 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
              }`}
              title="Nhấn để lọc các Page Bị Back"
            >
              <span>🟣 Bị Back:</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[11px] font-black ${
                  filter.status === 'Bị Back'
                    ? 'bg-white text-[#673ab7]'
                    : 'bg-purple-200/80 text-purple-900'
                }`}
              >
                {biBackCount}
              </span>
            </button>

            {/* 5. THỐNG KÊ VIA LỖI TRONG BÁO CÁO */}
            <button
              type="button"
              id="status-stat-via-loi"
              onClick={() =>
                onChangeFilter({
                  ...filter,
                  errorViaOnly: !filter.errorViaOnly,
                })
              }
              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                filter.errorViaOnly
                  ? 'bg-[#b31412] text-white border-[#b31412] shadow-xs ring-2 ring-[#b31412]/30'
                  : computedErrorViaCount > 0
                  ? 'bg-rose-100/90 text-rose-900 border-rose-300 hover:bg-rose-200/90'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="Nhấn để lọc các Fanpage có Nick Via đang bị lỗi / checkpoint / die"
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${filter.errorViaOnly ? 'text-white' : 'text-rose-600'}`} />
              <span>Via Lỗi:</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[11px] font-black ${
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

            {(filter.status || filter.errorViaOnly) && (
              <button
                type="button"
                onClick={() => onChangeFilter({ ...filter, status: '', errorViaOnly: false })}
                className="text-[11px] text-slate-500 hover:text-slate-800 underline ml-1 cursor-pointer font-semibold"
              >
                (Xem tất cả)
              </button>
            )}
          </div>

          <div className="text-[11px] text-slate-500 font-medium">
            Tổng cộng: <strong className="text-slate-800">{records.length}</strong> Fanpage
          </div>
        </div>
      </div>
    </div>
  );
};

