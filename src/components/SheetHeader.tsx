import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Download,
  Upload,
  RotateCcw,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Share2,
  UserCheck,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  User,
  Users,
  Lock,
  LogOut,
  Clock,
  KeyRound,
  Database,
} from 'lucide-react';
import { PageRecord, AppUser, FullViaItem } from '../types';
import { exportSheetToCSV } from '../utils/helpers';
import {
  downloadFanpageExcelTemplate,
  downloadViaExcelTemplate,
  exportFanpageToXLSX,
  exportViaToXLSX,
} from '../utils/excelTemplates';

interface SheetHeaderProps {
  records: PageRecord[];
  allRecordsCount: number;
  currentUser: AppUser;
  availableUsers: AppUser[];
  pendingRequestsCount: number;
  activeTab?: 'fanpage' | 'group' | 'proxy' | 'fullvia' | 'shared_accounts' | 'staff_management';
  activeStaffFilter?: string;
  viaList?: FullViaItem[];
  errorViaUids?: Set<string>;
  errorViaCount?: number;
  isFilteringErrorVia?: boolean;
  onFilterErrorVia?: () => void;
  onNavigateToStaffTab?: () => void;
  onOpenAdminApprovalModal: (tab?: 'staff' | 'pending' | 'blocked' | 'admin_pin' | 'security_db') => void;
  onOpenAuthModal: (tab?: 'login' | 'request') => void;
  onLogout: () => void;
  onSelectUser: (user: AppUser) => void;
  onAddCustomStaff: (staffName: string) => void;
  onOpenAddModal: () => void;
  onOpenImportModal?: () => void;
  onResetData: () => void;
  onMarkAllDoneToday: () => void;
  onOpenAddViaModal?: () => void;
  onOpenBulkImportViaModal?: () => void;
  onFilterViaErrorInFullVia?: () => void;
  isFilteringViaErrorInFullVia?: boolean;
}

export const SheetHeader: React.FC<SheetHeaderProps> = ({
  records,
  allRecordsCount,
  currentUser,
  availableUsers,
  pendingRequestsCount,
  activeTab = 'fanpage',
  activeStaffFilter,
  viaList = [],
  errorViaUids,
  errorViaCount: propErrorViaCount,
  isFilteringErrorVia = false,
  onFilterErrorVia,
  onNavigateToStaffTab,
  onOpenAdminApprovalModal,
  onOpenAuthModal,
  onLogout,
  onSelectUser,
  onAddCustomStaff,
  onOpenAddModal,
  onOpenImportModal,
  onResetData,
  onMarkAllDoneToday,
  onOpenAddViaModal,
  onOpenBulkImportViaModal,
  onFilterViaErrorInFullVia,
  isFilteringViaErrorInFullVia = false,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [newStaffInput, setNewStaffInput] = useState('');
  const [showAddStaffInput, setShowAddStaffInput] = useState(false);
  const [isFanpageAlertDismissed, setIsFanpageAlertDismissed] = useState(false);
  const [isFullViaAlertDismissed, setIsFullViaAlertDismissed] = useState(false);

  // === THỐNG KÊ CHO TAB 1: BẢNG FANPAGE ===
  // Nếu có bộ lọc theo 1 nhân viên cụ thể thì chỉ thống kê các Fanpage của nhân viên đó
  const effectiveRecordsForStats = React.useMemo(() => {
    if (activeStaffFilter && activeStaffFilter.trim() && activeStaffFilter !== 'all') {
      const target = activeStaffFilter.trim().toLowerCase();
      return records.filter((r) => r.staffName && r.staffName.trim().toLowerCase() === target);
    }
    return records;
  }, [records, activeStaffFilter]);

  const totalPages = effectiveRecordsForStats.length;
  const uniqueVias = new Set(effectiveRecordsForStats.map((r) => r.viaUid.trim().toLowerCase()).filter(Boolean)).size;

  const deXuatCount = effectiveRecordsForStats.filter((r) => r.status === 'Đề Xuất').length;
  const matDeXuatCount = effectiveRecordsForStats.filter((r) => r.status === 'Mất Đề Xuất').length;
  const dinhChiCount = effectiveRecordsForStats.filter((r) => r.status === 'Đình Chỉ').length;
  const biBackCount = effectiveRecordsForStats.filter((r) => r.status === 'Bị Back').length;

  const totalTargetPosts = effectiveRecordsForStats.reduce((acc, r) => acc + (r.targetPosts || 0), 0);
  const totalActualPosts = effectiveRecordsForStats.reduce((acc, r) => acc + (r.actualPosts || 0), 0);

  // Thống kê Nick Via Lỗi đang cầm Fanpage trong Tab 1
  const computedErrorViaCount = React.useMemo(() => {
    if (typeof propErrorViaCount === 'number') return propErrorViaCount;
    if (errorViaUids && errorViaUids.size > 0) {
      const uidsInScope = new Set(effectiveRecordsForStats.map((r) => r.viaUid.trim().toLowerCase()).filter(Boolean));
      let count = 0;
      errorViaUids.forEach((uid) => {
        if ((currentUser.role === 'admin' && (!activeStaffFilter || activeStaffFilter === 'all')) || uidsInScope.has(uid)) {
          count++;
        }
      });
      return count;
    }
    return effectiveRecordsForStats.filter((r) => r.isViaError).length;
  }, [propErrorViaCount, errorViaUids, effectiveRecordsForStats, currentUser.role, activeStaffFilter]);

  const pagesImpactedByErrorVia = React.useMemo(() => {
    return effectiveRecordsForStats.filter(
      (r) =>
        r.isViaError ||
        r.viaStatus === 'checkpoint' ||
        r.viaStatus === 'dead' ||
        r.viaStatus === 'error' ||
        (errorViaUids && r.viaUid && errorViaUids.has(r.viaUid.trim().toLowerCase()))
    ).length;
  }, [effectiveRecordsForStats, errorViaUids]);

  // === THỐNG KÊ CHO TAB 2: BẢNG FULL VIA ===
  const scopedViaList = React.useMemo(() => {
    if (currentUser.role === 'staff') {
      const staffNameLower = currentUser.name.trim().toLowerCase();
      return viaList.filter((v) => v.staffName.trim().toLowerCase() === staffNameLower);
    }
    return viaList;
  }, [viaList, currentUser]);

  const fullViaTotalCount = scopedViaList.length;
  const fullViaLiveCount = scopedViaList.filter(
    (v) => !v.isError && v.status === 'active'
  ).length;
  const fullViaCheckpointCount = scopedViaList.filter((v) => v.status === 'checkpoint').length;
  const fullViaErrorCount = scopedViaList.filter(
    (v) => v.isError || v.status === 'error' || v.status === 'dead'
  ).length;
  const totalViaIssuesCount = fullViaCheckpointCount + fullViaErrorCount;

  return (
    <header className="bg-white border-b border-slate-200 shadow-2xs">
      {/* HÀNG 1: THÔNG TIN HỆ THỐNG & TÀI KHOẢN (GỌN GÀNG, KHÔNG RỐI MẮT) */}
      <div className="max-w-[1700px] mx-auto px-3 sm:px-6 py-2">
        <div className="flex items-center justify-between gap-3">
          {/* 1.1 Bên trái: Logo, Tiêu đề & Quyền hạn */}
          <div className="flex items-center space-x-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#2e7d32] text-white flex items-center justify-center shadow-2xs shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight whitespace-nowrap">
                Quản Lý Fanpage & Via
              </h1>
              <span
                className={`hidden sm:inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                  currentUser.role === 'admin'
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                }`}
              >
                {currentUser.role === 'admin' ? (
                  <>
                    <Shield className="w-3 h-3 text-amber-600" />
                    <span>Admin</span>
                  </>
                ) : (
                  <>
                    <User className="w-3 h-3 text-emerald-600" />
                    <span>{currentUser.name}</span>
                  </>
                )}
              </span>
              <span
                className="hidden md:inline-flex items-center space-x-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200"
                title="Dữ liệu và mã nguồn đã được mã hóa bảo mật chống lộ"
              >
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Đã Mã Hóa</span>
              </span>

              {/* Thông số CSDL & Trung Tâm Bảo Mật Chống Hack - Bấm vào mở thẳng tab Sec */}
              <button
                type="button"
                id="btn-security-center-header"
                onClick={() => onOpenAdminApprovalModal('security_db')}
                className="inline-flex items-center space-x-1.5 text-[10px] font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300 cursor-pointer shadow-2xs transition-colors"
                title="Bảo vệ tài khoản, chống hack app & CSDL Cloud Firestore. Bấm để xem chi tiết an ninh và đổi mã PIN"
              >
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Bảo Mật: Bật</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[9px] bg-emerald-200/80 text-emerald-800 font-extrabold px-1 rounded">Sec</span>
              </button>
            </div>
          </div>

          {/* 1.2 Bên phải: Tài khoản, Phê duyệt, Đăng xuất, Reset */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Admin Approval Button */}
            {currentUser.role === 'admin' && (
              <button
                type="button"
                id="btn-admin-approvals"
                onClick={() => {
                  if (onNavigateToStaffTab) {
                    onNavigateToStaffTab();
                  } else {
                    onOpenAdminApprovalModal('staff');
                  }
                }}
                className={`relative inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1 text-xs font-bold rounded-lg border shadow-2xs transition-all cursor-pointer ${
                  pendingRequestsCount > 0
                    ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-md animate-pulse'
                    : activeTab === 'staff_management'
                    ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                    : 'bg-indigo-50 text-indigo-900 border-indigo-200 hover:bg-indigo-100'
                }`}
                title="Bấm để mở trực tiếp Bảng 5: Quản lý danh sách nhân viên, tài khoản và mật khẩu"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span className="font-bold">QL Nhân Sự</span>
                {pendingRequestsCount > 0 && (
                  <span className="bg-red-600 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                    {pendingRequestsCount}
                  </span>
                )}
              </button>
            )}

            {/* Account / Role Switcher dropdown */}
            <div className="relative">
              <button
                type="button"
                id="btn-role-switcher"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className={`inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border transition-all shadow-2xs cursor-pointer ${
                  currentUser.role === 'admin'
                    ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                    : 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                }`}
                title="Tài khoản đang thao tác"
              >
                {currentUser.role === 'admin' ? (
                  <Shield className="w-3.5 h-3.5 text-amber-600" />
                ) : (
                  <User className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span className="max-w-[90px] sm:max-w-[120px] truncate">{currentUser.name}</span>
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </button>

              {/* Dropdown Menu */}
              {isUserMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2 text-xs">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <div className="font-bold text-slate-800">Tài Khoản Hiện Tại</div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {currentUser.role === 'admin'
                          ? 'Đang có toàn quyền quản lý & phê duyệt nhân viên'
                          : `Đang giới hạn xem và sửa chỉ riêng dữ liệu của ${currentUser.name}`}
                      </p>
                    </div>

                    <div className="py-1 space-y-1 max-h-64 overflow-y-auto">
                      {currentUser.role === 'admin' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectUser({ id: 'admin', name: 'Quản Lý (Admin)', role: 'admin', status: 'approved', isAuthenticated: true });
                              setIsUserMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                              currentUser.role === 'admin'
                                ? 'bg-amber-100/70 text-amber-900 font-bold'
                                : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <Shield className="w-4 h-4 text-amber-600" />
                              <div>
                                <div className="font-bold">Xem Toàn Bộ (Admin)</div>
                                <div className="text-[10px] text-slate-500 font-normal">
                                  Tất cả ({allRecordsCount} page của hệ thống)
                                </div>
                              </div>
                            </div>
                            {currentUser.role === 'admin' && (
                              <CheckCircle2 className="w-4 h-4 text-amber-600" />
                            )}
                          </button>

                          <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                            <span>Xem Dưới Góc Nhìn Nhân Viên</span>
                            <span className="text-slate-500 font-semibold lowercase">
                              ({availableUsers.filter((u) => u.role === 'staff').length} nhân viên)
                            </span>
                          </div>

                          {availableUsers
                            .filter((u) => u.role === 'staff')
                            .map((user) => {
                              const isCurrent =
                                currentUser.role === 'staff' && currentUser.name === user.name;
                              return (
                                <button
                                  key={user.id}
                                  type="button"
                                  onClick={() => {
                                    onSelectUser({ ...user, isAuthenticated: true });
                                    setIsUserMenuOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                                    isCurrent
                                      ? 'bg-emerald-100/70 text-emerald-900 font-bold'
                                      : 'hover:bg-slate-50 text-slate-800'
                                  }`}
                                >
                                  <div className="flex items-center space-x-2">
                                    <User className="w-4 h-4 text-emerald-600" />
                                    <div>
                                      <div className="font-bold">{user.name}</div>
                                      <div className="text-[10px] text-slate-500 font-normal">
                                        Xem riêng page của {user.name}
                                      </div>
                                    </div>
                                  </div>
                                  {isCurrent && (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                  )}
                                </button>
                              );
                            })}
                        </>
                      ) : (
                        <div className="p-2 space-y-2">
                          <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-900">
                            <strong>Nhân viên:</strong> {currentUser.name}
                            <div className="text-slate-500 text-[10px] mt-0.5">
                              Tài khoản đã được Admin phê duyệt quyền truy cập.
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              onOpenAuthModal('login');
                            }}
                            className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-lg flex items-center space-x-2 transition-colors"
                          >
                            <Shield className="w-4 h-4 text-amber-600" />
                            <div>
                              <div className="font-bold">Đăng Nhập Quản Lý (Admin)</div>
                              <div className="text-[10px] text-slate-500">Yêu cầu nhập mật khẩu Admin</div>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Footer options in dropdown */}
                    <div className="pt-2 border-t border-slate-100 px-2 space-y-1">
                      {currentUser.role === 'admin' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              onOpenAdminApprovalModal('staff');
                            }}
                            className="w-full text-left py-2 px-2.5 text-xs text-indigo-700 hover:bg-indigo-50 font-bold rounded-lg transition-colors flex items-center justify-between cursor-pointer"
                          >
                            <div className="flex items-center space-x-2">
                              <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                              <span>Quản Lý Nhân Viên & Mật Khẩu</span>
                            </div>
                            {pendingRequestsCount > 0 ? (
                              <span className="bg-amber-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                                {pendingRequestsCount} chờ duyệt
                              </span>
                            ) : (
                              <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {availableUsers.filter((u) => u.role === 'staff').length} NV
                              </span>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              onOpenAdminApprovalModal('security_db');
                            }}
                            className="w-full text-left py-2 px-2.5 text-xs text-slate-800 hover:bg-slate-100 font-bold rounded-lg transition-colors flex items-center justify-between cursor-pointer"
                            title="Xem chi tiết các thông số kỹ thuật kết nối CSDL Cloud Firestore, Ping test và Bảo mật"
                          >
                            <div className="flex items-center space-x-2">
                              <Database className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>Thông Số CSDL & Bảo Mật (Sec)</span>
                            </div>
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center space-x-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span>Online</span>
                            </span>
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full text-left py-1.5 px-2 text-xs text-red-600 hover:bg-red-50 font-bold rounded-lg transition-colors flex items-center space-x-2"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Đăng Xuất / Đổi Tài Khoản</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              id="btn-logout-header"
              onClick={onLogout}
              className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Đăng xuất khỏi hệ thống"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              id="btn-backup-json"
              onClick={() => {
                const backupPayload = {
                  timestamp: new Date().toISOString(),
                  totalRecords: records.length,
                  totalVias: viaList.length,
                  records,
                  viaList,
                };
                const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
                  type: 'application/json',
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `sao_luu_du_lieu_fanpage_${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="p-1.5 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
              title="Tải bản sao lưu an toàn toàn bộ dữ liệu (JSON)"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* HÀNG 2: THANH THAO TÁC & THỐNG KÊ (TAB NÀO HIỂN THỊ ĐÚNG CỦA TAB ĐÓ) */}
      <div className="bg-slate-50/95 border-t border-slate-200/80 px-3 sm:px-6 py-2">
        <div className="max-w-[1700px] mx-auto flex flex-wrap items-center justify-between gap-2.5">
          {/* ============================================================ */}
          {/* 2.1 NHÓM HÀNH ĐỘNG DÀNH RIÊNG THEO TAB ĐANG CHỌN */}
          {/* ============================================================ */}
          <div className="flex items-center flex-wrap gap-1.5">
            {activeTab === 'fanpage' ? (
              <>
                {/* TAB 1: Nút thêm Page */}
                <button
                  type="button"
                  id="btn-add-page-row"
                  onClick={onOpenAddModal}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#2e7d32] hover:bg-[#256629] active:bg-[#1b5e20] rounded-lg shadow-2xs transition-all cursor-pointer shrink-0"
                  title="Thêm Fanpage mới vào bảng"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Thêm Page</span>
                </button>

                {/* TAB 1: Nhập Excel */}
                {onOpenImportModal && (
                  <button
                    type="button"
                    id="btn-import-excel"
                    onClick={onOpenImportModal}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                    title="Nhập dữ liệu Fanpage từ file Excel (.xlsx) hoặc Copy-Paste"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-600" />
                    <span>Nhập Excel</span>
                  </button>
                )}

                {/* TAB 1: Xuất Excel Fanpage */}
                <button
                  type="button"
                  id="btn-export-sheet"
                  onClick={() => exportFanpageToXLSX(records)}
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  title="Tải về toàn bộ danh sách Fanpage dạng file Excel .xlsx"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Xuất Excel</span>
                </button>

                {/* TAB 1: Tải Mẫu Excel Fanpage */}
                <button
                  type="button"
                  id="btn-download-excel-template"
                  onClick={() => downloadFanpageExcelTemplate('xlsx')}
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  title="Tải file Excel mẫu chuẩn (.xlsx) có sẵn 4 trạng thái để import Fanpage"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Tải Mẫu Excel</span>
                </button>

                {/* TAB 1: Duyệt Bài Xong */}
                <button
                  type="button"
                  id="btn-mark-all-done-today"
                  onClick={onMarkAllDoneToday}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  title="Đánh dấu các page đang hiển thị hôm nay đã hoàn thành đủ số bài đăng"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden md:inline">Duyệt Bài Xong</span>
                </button>
              </>
            ) : (
              <>
                {/* TAB 2: Nút thêm 1 Nick Via */}
                {onOpenAddViaModal && (
                  <button
                    type="button"
                    id="btn-add-single-via"
                    onClick={onOpenAddViaModal}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-2xs transition-all cursor-pointer shrink-0"
                    title="Thêm 1 Nick Via mới vào bảng"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Thêm 1 Nick</span>
                  </button>
                )}

                {/* TAB 2: Nút thêm nhiều nick (Dán Excel) */}
                {onOpenBulkImportViaModal && (
                  <button
                    type="button"
                    id="btn-add-bulk-via"
                    onClick={onOpenBulkImportViaModal}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                    title="Dán nhanh nhiều nick Via dạng UID|Pass|2FA từ Excel hoặc text"
                  >
                    <Upload className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Dán Excel Nick</span>
                  </button>
                )}

                {/* TAB 2: Tải Mẫu Excel Via */}
                <button
                  type="button"
                  id="btn-download-via-template"
                  onClick={() => downloadViaExcelTemplate('xlsx')}
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-bold text-indigo-900 bg-indigo-100 hover:bg-indigo-200 border border-indigo-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  title="Tải file Excel mẫu chuẩn (.xlsx) để import nick Via"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-700" />
                  <span>Tải Mẫu Excel</span>
                </button>

                {/* TAB 2: Xuất Excel Nick Via */}
                <button
                  type="button"
                  id="btn-export-via-excel"
                  onClick={() => exportViaToXLSX(scopedViaList)}
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  title="Tải về danh sách Full Via dạng file Excel .xlsx"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Xuất Excel</span>
                </button>
              </>
            )}
          </div>

          {/* ============================================================ */}
          {/* 2.2 NHÓM THỐNG KÊ DÀNH RIÊNG THEO TAB ĐANG CHỌN */}
          {/* ============================================================ */}
          <div className="flex items-center flex-wrap gap-1.5 text-xs">
            {activeTab === 'fanpage' ? (
              <>
                {/* TAB 1 STATS: Tổng số Page */}
                <span className="inline-flex items-center px-2.5 py-1 bg-white rounded-lg border border-slate-200 text-slate-700 font-bold shadow-2xs">
                  <span>📄</span>
                  <span className="ml-1"><strong>{totalPages}</strong> Page</span>
                </span>

                {/* TAB 1 STATS: Tổng Nick Via */}
                <span className="inline-flex items-center px-2.5 py-1 bg-white rounded-lg border border-slate-200 text-indigo-700 font-bold shadow-2xs">
                  <span>🔑</span>
                  <span className="ml-1"><strong>{uniqueVias}</strong> Nick Via</span>
                </span>

                {/* TAB 1 STATS: Tiến độ bài đăng hôm nay */}
                <span
                  className="hidden sm:inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-50 text-blue-900 border border-blue-200 rounded-lg font-semibold shadow-2xs"
                  title="Tiến độ bài đăng hôm nay"
                >
                  <span>📝 <strong>{totalActualPosts}/{totalTargetPosts}</strong> bài</span>
                </span>

                {/* TAB 1 STATS: THỐNG KÊ VIA LỖI NẾU CÓ (BẤM VÀO ĐỂ LỌC NHANH) */}
                {computedErrorViaCount > 0 && (
                  <button
                    type="button"
                    onClick={onFilterErrorVia}
                    className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer border shadow-2xs ${
                      isFilteringErrorVia
                        ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-500/30 shadow-xs'
                        : 'bg-rose-100 text-rose-900 border-rose-300 hover:bg-rose-200'
                    }`}
                    title={`Có ${computedErrorViaCount} Nick Via bị lỗi (ảnh hưởng ${pagesImpactedByErrorVia} Page). Bấm để ${
                      isFilteringErrorVia ? 'bỏ lọc' : 'lọc nhanh'
                    }`}
                  >
                    <AlertTriangle
                      className={`w-3.5 h-3.5 ${isFilteringErrorVia ? 'text-white' : 'text-rose-600'}`}
                    />
                    <span>VIA LỖI:</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[11px] font-black ${
                        isFilteringErrorVia ? 'bg-white text-rose-700' : 'bg-rose-600 text-white'
                      }`}
                    >
                      {computedErrorViaCount}
                    </span>
                  </button>
                )}
              </>
            ) : (
              <>
                {/* TAB 2 STATS: Tổng số Nick Via */}
                <span className="inline-flex items-center px-2 py-1 bg-white rounded-lg border border-slate-200 text-slate-700 font-semibold shadow-2xs">
                  <strong>{fullViaTotalCount}</strong>&nbsp;Nick Via
                </span>

                {/* TAB 2 STATS: Live (Hoạt Động) */}
                <span
                  className="inline-flex items-center space-x-1 px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-bold shadow-2xs"
                  title="Số Nick Via đang hoạt động bình thường"
                >
                  <span>🟢</span>
                  <span><strong>{fullViaLiveCount}</strong> Live</span>
                </span>

                {/* TAB 2 STATS: Checkpoint */}
                <span
                  className="inline-flex items-center space-x-1 px-2 py-1 bg-amber-50 text-amber-900 border border-amber-300 rounded-lg font-bold shadow-2xs"
                  title="Số Nick Via đang bị Checkpoint"
                >
                  <span>🟠</span>
                  <span><strong>{fullViaCheckpointCount}</strong> CP</span>
                </span>

                {/* TAB 2 STATS: Báo Lỗi / Die */}
                <span
                  className="inline-flex items-center space-x-1 px-2 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg font-bold shadow-2xs"
                  title="Số Nick Via bị báo lỗi hoặc Die"
                >
                  <span>🔴</span>
                  <span><strong>{fullViaErrorCount}</strong> Lỗi/Die</span>
                </span>

                {/* TAB 2 STATS: THỐNG KÊ LỖI NICK VIA (BẤM VÀO ĐỂ LỌC NICK LỖI) */}
                <button
                  type="button"
                  onClick={onFilterViaErrorInFullVia}
                  className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer border shadow-2xs ${
                    isFilteringViaErrorInFullVia
                      ? 'bg-red-600 text-white border-red-700 ring-2 ring-red-500/30 shadow-xs'
                      : totalViaIssuesCount > 0
                      ? 'bg-red-100/90 text-red-900 border-red-300 hover:bg-red-200/90'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                  title={
                    totalViaIssuesCount > 0
                      ? `Có ${totalViaIssuesCount} nick cần xử lý (${fullViaCheckpointCount} CP, ${fullViaErrorCount} Lỗi). Bấm để ${
                          isFilteringViaErrorInFullVia ? 'xem tất cả' : 'lọc nhanh'
                        }`
                      : 'Tất cả nick Via đang hoạt động tốt'
                  }
                >
                  <AlertTriangle
                    className={`w-3.5 h-3.5 ${
                      isFilteringViaErrorInFullVia ? 'text-white' : 'text-red-600'
                    }`}
                  />
                  <span>VIA LỖI:</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[11px] font-black ${
                      isFilteringViaErrorInFullVia
                        ? 'bg-white text-red-700'
                        : totalViaIssuesCount > 0
                        ? 'bg-red-600 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {totalViaIssuesCount}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2.3 THANH THÔNG BÁO CẢNH BÁO LỖI (CHỈ TAB NÀO HIỆN CỦA TAB ĐÓ) */}
      {/* ============================================================ */}
      {activeTab === 'fanpage' &&
        !isFanpageAlertDismissed &&
        computedErrorViaCount > 0 && (
          <div className="bg-rose-50/90 border-t border-b border-rose-200 px-4 py-2 text-xs text-rose-900">
            <div className="max-w-[1700px] mx-auto flex items-center justify-between gap-3">
              <div className="flex items-center space-x-2 flex-wrap">
                <span className="p-1 bg-rose-600 text-white rounded-md shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </span>
                <span className="font-extrabold uppercase tracking-wide text-rose-800">
                  Cảnh báo Nick Via Lỗi:
                </span>
                <span>
                  Đang có{' '}
                  <strong className="text-rose-700 font-black">
                    {computedErrorViaCount} Nick Via bị lỗi (ảnh hưởng {pagesImpactedByErrorVia} Page).
                  </strong>{' '}
                  Cần kiểm tra mở lại hoặc thay Via mới để tránh gián đoạn đăng bài!
                </span>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                {computedErrorViaCount > 0 && onFilterErrorVia && (
                  <button
                    type="button"
                    onClick={onFilterErrorVia}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-[11px] transition-colors cursor-pointer"
                  >
                    {isFilteringErrorVia ? 'Bỏ lọc lỗi' : 'Lọc Nick Via lỗi'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsFanpageAlertDismissed(true)}
                  className="p-1 text-rose-600 hover:text-rose-900 rounded hover:bg-rose-100 transition-colors cursor-pointer"
                  title="Đóng thông báo này"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}

      {activeTab === 'fullvia' && !isFullViaAlertDismissed && totalViaIssuesCount > 0 && (
        <div className="bg-red-50/95 border-t border-b border-red-200 px-4 py-2 text-xs text-red-950">
          <div className="max-w-[1700px] mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2 flex-wrap">
              <span className="p-1 bg-red-600 text-white rounded-md shrink-0">
                <AlertTriangle className="w-3.5 h-3.5" />
              </span>
              <span className="font-extrabold uppercase tracking-wide text-red-900">
                Thông báo Bảng Full Via:
              </span>
              <span>
                Đang có <strong className="text-red-700 font-black">{totalViaIssuesCount} Nick Via</strong> gặp sự cố ({fullViaErrorCount > 0 ? `${fullViaErrorCount} nick Báo Lỗi/Die` : ''}{fullViaErrorCount > 0 && fullViaCheckpointCount > 0 ? ' • ' : ''}{fullViaCheckpointCount > 0 ? `${fullViaCheckpointCount} nick Checkpoint` : ''}). Cần xử lý mở lại hoặc thay thế!
              </span>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              {onFilterViaErrorInFullVia && (
                <button
                  type="button"
                  onClick={onFilterViaErrorInFullVia}
                  className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded font-bold text-[11px] transition-colors cursor-pointer"
                >
                  {isFilteringViaErrorInFullVia ? 'Xem tất cả' : 'Lọc nick lỗi'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsFullViaAlertDismissed(true)}
                className="p-1 text-red-600 hover:text-red-900 rounded hover:bg-red-100 transition-colors cursor-pointer"
                title="Đóng thông báo này"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
