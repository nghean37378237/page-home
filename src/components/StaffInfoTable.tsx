import React, { useState, useMemo } from 'react';
import {
  MonthlyFinanceRecord,
  StaffSalaryItem,
  UserAccount,
  AppUser,
  PageRecord,
} from '../types';
import {
  User,
  Calendar,
  CreditCard,
  Briefcase,
  DollarSign,
  TrendingUp,
  Percent,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  Building2,
  Lock,
  ChevronDown,
  Contact,
  Award,
  Wifi,
  PenTool,
  Bot,
  FileSpreadsheet,
  ExternalLink,
} from 'lucide-react';

interface StaffInfoTableProps {
  currentUser: AppUser;
  finances: MonthlyFinanceRecord[];
  accounts: UserAccount[];
  availableStaffNames?: string[];
  records?: PageRecord[];
  onNavigateToTab?: (tab: string) => void;
}

export const StaffInfoTable: React.FC<StaffInfoTableProps> = ({
  currentUser,
  finances,
  accounts,
  availableStaffNames = [],
  records = [],
  onNavigateToTab,
}) => {
  const isAdmin = currentUser.role === 'admin';

  // Danh sách nhân viên để Admin chọn xem trước (nếu là Admin)
  const staffOptions = useMemo(() => {
    const names = new Set<string>();
    accounts.filter((a) => a.role === 'staff').forEach((a) => names.add(a.username));
    availableStaffNames.forEach((n) => names.add(n));
    finances.forEach((f) => (f.salaryItems || []).forEach((s) => names.add(s.staffName)));
    return Array.from(names).filter(Boolean);
  }, [accounts, availableStaffNames, finances]);

  // Nhân viên đang xem (Nếu là Staff thì cố định tên của currentUser, nếu Admin thì có thể chọn)
  const [selectedStaffName, setSelectedStaffName] = useState<string>(() => {
    if (!isAdmin) return currentUser.name;
    return staffOptions[0] || currentUser.name;
  });

  // Cập nhật selectedStaffName nếu currentUser là staff
  React.useEffect(() => {
    if (!isAdmin) {
      setSelectedStaffName(currentUser.name);
    }
  }, [isAdmin, currentUser.name]);

  // Danh sách các tháng có dữ liệu
  const availableMonths = useMemo(() => {
    if (!finances || finances.length === 0) return [];
    return [...finances].sort((a, b) => (b.monthKey || '').localeCompare(a.monthKey || ''));
  }, [finances]);

  // Tháng đang được chọn xem
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    if (availableMonths.length > 0) {
      return availableMonths[0].monthKey;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Bản ghi tài chính của tháng được chọn
  const activeMonthRecord = useMemo(() => {
    return availableMonths.find((m) => m.monthKey === selectedMonthKey) || availableMonths[0];
  }, [availableMonths, selectedMonthKey]);

  // Tìm thông tin lương của nhân viên này trong tháng được chọn (lấy từ Bảng 7)
  const staffSalaryItem = useMemo<StaffSalaryItem | undefined>(() => {
    if (!activeMonthRecord || !activeMonthRecord.salaryItems) return undefined;
    const cleanTarget = selectedStaffName.trim().toLowerCase();
    return activeMonthRecord.salaryItems.find(
      (item) => item.staffName.trim().toLowerCase() === cleanTarget
    );
  }, [activeMonthRecord, selectedStaffName]);

  // Tìm thông tin tài khoản nhân sự từ danh sách Accounts
  const matchedAccount = useMemo<UserAccount | undefined>(() => {
    const cleanTarget = selectedStaffName.trim().toLowerCase();
    return accounts.find((a) => a.username.trim().toLowerCase() === cleanTarget);
  }, [accounts, selectedStaffName]);

  // Quyền hiển thị lương: Admin đã tích chọn trong Bảng 7 mới cho hiện số tiền
  // Nếu Admin bỏ tích hoặc chưa tích: Lương, Doanh thu và Tổng lương BỎ TRỐNG
  const isVisibleToStaff = Boolean(staffSalaryItem?.isVisibleToStaff);

  // Thống kê số lượng Page Đăng Tay vs Tool của nhân viên đang xem
  const staffWorkStats = useMemo(() => {
    const cleanTarget = selectedStaffName.trim().toLowerCase();
    const myPages = (records || []).filter(
      (r) => (r.staffName || '').trim().toLowerCase() === cleanTarget
    );
    const manualPages = myPages.filter((r) => r.postingMethod === 'Đăng Tay');
    const toolPages = myPages.filter((r) => r.postingMethod === 'Tool');
    const timerPages = myPages.filter((r) => r.postingMethod === 'Hẹn Giờ');

    const manualActual = manualPages.reduce((s, r) => s + (r.actualPosts || 0), 0);
    const manualTarget = manualPages.reduce((s, r) => s + (r.targetPosts || 0), 0);
    const toolActual = toolPages.reduce((s, r) => s + (r.actualPosts || 0), 0);
    const toolTarget = toolPages.reduce((s, r) => s + (r.targetPosts || 0), 0);

    const totalActual = myPages.reduce((s, r) => s + (r.actualPosts || 0), 0);
    const totalTarget = myPages.reduce((s, r) => s + (r.targetPosts || 0), 0);
    const completionRate = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : (myPages.length > 0 ? 100 : 0);

    const manualRatio = myPages.length > 0 ? Math.round((manualPages.length / myPages.length) * 100) : 0;
    const toolRatio = myPages.length > 0 ? Math.round((toolPages.length / myPages.length) * 100) : 0;

    return {
      totalPages: myPages.length,
      manualCount: manualPages.length,
      toolCount: toolPages.length,
      timerCount: timerPages.length,
      manualActual,
      manualTarget,
      toolActual,
      toolTarget,
      totalActual,
      totalTarget,
      completionRate,
      manualRatio,
      toolRatio,
    };
  }, [records, selectedStaffName]);

  const formatVND = (num?: number) => {
    if (num === undefined || num === null) return '0 ₫';
    return num.toLocaleString('vi-VN') + ' ₫';
  };

  return (
    <div className="max-w-[1700px] mx-auto p-3 sm:p-6 space-y-5 animate-fadeIn">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-700 text-white rounded-3xl p-5 sm:p-7 shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-radial from-white to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="p-2 bg-white/15 backdrop-blur-md rounded-2xl">
                <Contact className="w-6 h-6 text-white" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                  Thông Tin Nhân Viên & Bảng Lương Cá Nhân
                </h1>
                <p className="text-xs sm:text-sm text-blue-100 font-medium mt-0.5">
                  Dữ liệu đồng bộ trực tiếp từ Bảng 7: Doanh Thu & Thu Chi
                </p>
              </div>
            </div>
          </div>

          {/* BỘ LỌC CHỌN THÁNG & CHỌN NHÂN VIÊN */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Nếu là Admin: Cho phép chọn nhân viên để xem trước */}
            {isAdmin && (
              <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl px-3 py-1.5 flex items-center space-x-2">
                <span className="text-[11px] font-bold text-blue-200">Xem NV:</span>
                <select
                  value={selectedStaffName}
                  onChange={(e) => setSelectedStaffName(e.target.value)}
                  className="bg-white text-slate-900 text-xs font-bold rounded-lg px-2 py-1 outline-none cursor-pointer"
                >
                  {staffOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-400 text-amber-950">
                  Admin xem trước
                </span>
              </div>
            )}

            {/* Chọn Tháng */}
            {availableMonths.length > 0 && (
              <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl px-3 py-1.5 flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-blue-200" />
                <span className="text-[11px] font-bold text-blue-200">Kỳ Lương:</span>
                <select
                  value={selectedMonthKey}
                  onChange={(e) => setSelectedMonthKey(e.target.value)}
                  className="bg-white text-slate-900 text-xs font-bold rounded-lg px-2 py-1 outline-none cursor-pointer"
                >
                  {availableMonths.map((m) => (
                    <option key={m.id || m.monthKey} value={m.monthKey}>
                      {m.title || `Tháng ${m.monthKey}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* THÔNG BÁO QUY CHẾ BẢO MẬT HIỂN THỊ */}
        <div className="mt-4 pt-3 border-t border-white/15 flex flex-wrap items-center justify-between text-xs text-blue-100 gap-2">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>
              Quy chế: Các số <strong>Lương</strong>, <strong>Doanh thu</strong> và <strong>Tổng lương</strong> chỉ hiển thị khi Quản Lý (Admin) tích chọn mở công bố tại Bảng 7 hàng tháng.
            </span>
          </div>

          {isAdmin && onNavigateToTab && (
            <button
              type="button"
              onClick={() => onNavigateToTab('revenue')}
              className="text-[11px] font-bold text-white underline hover:text-blue-200 cursor-pointer"
            >
              Đi đến Bảng 7 (Doanh thu & Bảng Lương) →
            </button>
          )}
        </div>
      </div>

      {/* DÀN NỘI DUNG CHÍNH: 2 KHỐI (HỒ SƠ CÁ NHÂN & THU NHẬP THÁNG) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ========================================================= */}
        {/* KHỐI 1: HỒ SƠ NHÂN SỰ CÁ NHÂN (HỌ TÊN, NGÀY SINH, CCCD...) */}
        {/* ========================================================= */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-3xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <div className="w-9 h-9 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-black">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900">
                Hồ Sơ Nhân Sự
              </h2>
              <p className="text-[11px] text-slate-500">Thông tin lý lịch nhân viên</p>
            </div>
          </div>

          {/* Họ và tên nhân viên */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
              Họ Và Tên Nhân Viên
            </span>
            <div className="text-base sm:text-lg font-black text-slate-900 mt-0.5 flex items-center space-x-1.5">
              <span>{staffSalaryItem?.staffName || matchedAccount?.username || selectedStaffName}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Nhân viên chính thức" />
            </div>
            <div className="mt-1">
              {staffSalaryItem?.contractType === 'probation' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                  Chế độ: Thử Việc
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Chế độ: Chính Thức
                </span>
              )}
            </div>
          </div>

          {/* Ngày tháng năm sinh (Yêu cầu chính) */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl">
            <div className="flex items-center space-x-1.5 text-blue-900">
              <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-[11px] font-black uppercase tracking-wide">
                Ngày Tháng Năm Sinh
              </span>
            </div>
            <div className="text-sm sm:text-base font-bold text-slate-900 mt-1 pl-5">
              {staffSalaryItem?.dateOfBirth || matchedAccount?.dateOfBirth ? (
                <span className="font-mono font-black text-blue-950">
                  {staffSalaryItem?.dateOfBirth || matchedAccount?.dateOfBirth}
                </span>
              ) : (
                <span className="text-slate-400 italic text-xs">Chưa cập nhật ngày sinh</span>
              )}
            </div>
          </div>

          {/* Số CCCD / CMND */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
              Số Căn Cước Công Dân (CCCD)
            </span>
            <div className="text-sm font-mono font-bold text-slate-800 mt-0.5">
              {staffSalaryItem?.citizenId || matchedAccount?.citizenId ? (
                <span>{staffSalaryItem?.citizenId || matchedAccount?.citizenId}</span>
              ) : (
                <span className="text-slate-400 italic text-xs">Chưa cập nhật CCCD</span>
              )}
            </div>
          </div>

          {/* Ngày bắt đầu đi làm */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="flex items-center space-x-1.5 text-slate-700">
              <Briefcase className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[10px] font-black uppercase tracking-wider">
                Ngày Bắt Đầu Đi Làm
              </span>
            </div>
            <div className="text-xs font-bold text-slate-800 mt-0.5 pl-5">
              {staffSalaryItem?.startDate || matchedAccount?.startDate ? (
                <span>{staffSalaryItem?.startDate || matchedAccount?.startDate}</span>
              ) : (
                <span className="text-slate-400 italic text-xs">Chưa cập nhật ngày đi làm</span>
              )}
            </div>
          </div>

          {/* Thông tin tài khoản ngân hàng */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="flex items-center space-x-1.5 text-slate-700 mb-1">
              <CreditCard className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[10px] font-black uppercase tracking-wider">
                Tài Khoản Nhận Lương
              </span>
            </div>
            {staffSalaryItem?.bankAccountNumber || matchedAccount?.bankAccountNumber ? (
              <div className="pl-5 space-y-0.5">
                <div className="font-mono font-black text-sm text-slate-900">
                  {staffSalaryItem?.bankAccountNumber || matchedAccount?.bankAccountNumber}
                </div>
                <div className="text-[11px] text-slate-600 font-medium">
                  {staffSalaryItem?.bankName || matchedAccount?.bankName || 'Ngân hàng'} •{' '}
                  <span className="font-bold">
                    {staffSalaryItem?.bankAccountHolder ||
                      matchedAccount?.bankAccountHolder ||
                      staffSalaryItem?.staffName ||
                      selectedStaffName}
                  </span>
                </div>
              </div>
            ) : (
              <div className="pl-5 text-slate-400 italic text-xs">
                Chưa có số tài khoản ngân hàng
              </div>
            )}
          </div>

          {/* KHỐI THỐNG KÊ QUẢN LÝ FANPAGE: ĐĂNG TAY VS TOOL */}
          <div className="p-4 bg-gradient-to-br from-teal-50 via-emerald-50/60 to-white border-2 border-teal-300 rounded-2xl shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="p-1.5 bg-teal-600 text-white rounded-xl shadow-2xs">
                  <FileSpreadsheet className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                    Fanpage Đang Phụ Trách
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    Phân loại Đăng Tay vs Tool (Bảng 1)
                  </p>
                </div>
              </div>
              <span className="font-mono font-black text-teal-800 text-xs bg-teal-100 px-2.5 py-0.5 rounded-full border border-teal-300">
                {staffWorkStats.totalPages} Page
              </span>
            </div>

            {/* Dàn 2 Thẻ Tay vs Tool */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Đăng tay */}
              <div className="p-2.5 bg-white border border-emerald-300 rounded-xl shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-[10px] font-black text-emerald-950 uppercase">
                  <span className="flex items-center space-x-1">
                    <PenTool className="w-3 h-3 text-emerald-600" />
                    <span>Đăng Tay</span>
                  </span>
                  <span className="font-mono text-emerald-700 bg-emerald-50 px-1 rounded font-bold">
                    {staffWorkStats.manualRatio}%
                  </span>
                </div>
                <div className="text-base font-black text-emerald-800 font-mono">
                  {staffWorkStats.manualCount} <span className="text-[10px] font-sans text-slate-500 font-normal">Page</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Bài hôm nay: <strong className="text-emerald-700">{staffWorkStats.manualActual}</strong>/{staffWorkStats.manualTarget}
                </div>
              </div>

              {/* Đăng tool */}
              <div className="p-2.5 bg-white border border-purple-300 rounded-xl shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-[10px] font-black text-purple-950 uppercase">
                  <span className="flex items-center space-x-1">
                    <Bot className="w-3 h-3 text-purple-600" />
                    <span>Đăng Tool</span>
                  </span>
                  <span className="font-mono text-purple-700 bg-purple-50 px-1 rounded font-bold">
                    {staffWorkStats.toolRatio}%
                  </span>
                </div>
                <div className="text-base font-black text-purple-800 font-mono">
                  {staffWorkStats.toolCount} <span className="text-[10px] font-sans text-slate-500 font-normal">Page</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Bài hôm nay: <strong className="text-purple-700">{staffWorkStats.toolActual}</strong>/{staffWorkStats.toolTarget}
                </div>
              </div>
            </div>

            {/* Thanh tỷ lệ & nút mở bảng 1 */}
            {staffWorkStats.totalPages > 0 && (
              <div className="space-y-1 pt-0.5">
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                  <div
                    style={{ width: `${staffWorkStats.manualRatio}%` }}
                    className="bg-emerald-500 h-full"
                    title={`Đăng Tay: ${staffWorkStats.manualRatio}%`}
                  />
                  <div
                    style={{ width: `${staffWorkStats.toolRatio}%` }}
                    className="bg-purple-600 h-full"
                    title={`Đăng Tool: ${staffWorkStats.toolRatio}%`}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold">
                  <span>Tiến độ: {staffWorkStats.completionRate}% ({staffWorkStats.totalActual}/{staffWorkStats.totalTarget} bài)</span>
                  {onNavigateToTab && (
                    <button
                      type="button"
                      onClick={() => onNavigateToTab('fanpage')}
                      className="text-teal-700 hover:text-teal-900 inline-flex items-center space-x-0.5 cursor-pointer font-bold"
                    >
                      <span>Vào Bảng 1</span>
                      <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* KHỐI 2: LƯƠNG, DOANH THU & TỔNG LƯƠNG (LẤY TỪ BẢNG 7) */}
        {/* ========================================================= */}
        <div className="lg:col-span-2 space-y-5">
          {/* TRẠNG THÁI HIỂN THỊ CỦA ADMIN (TÍCH HAY CHƯA TÍCH) */}
          <div
            className={`p-4 rounded-3xl border transition-all ${
              isVisibleToStaff
                ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                : 'bg-amber-50/90 border-amber-300 text-amber-950'
            }`}
          >
            <div className="flex items-start space-x-3">
              <span
                className={`p-2 rounded-2xl shrink-0 ${
                  isVisibleToStaff ? 'bg-emerald-200/80 text-emerald-800' : 'bg-amber-200/80 text-amber-800'
                }`}
              >
                {isVisibleToStaff ? (
                  <Eye className="w-5 h-5 text-emerald-700" />
                ) : (
                  <EyeOff className="w-5 h-5 text-amber-700" />
                )}
              </span>

              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-black">
                    {isVisibleToStaff
                      ? `✓ Quản Lý (Admin) Đã Tích Mở Công Bố Thu Nhập (${activeMonthRecord?.title || selectedMonthKey})`
                      : `🔒 Bảng Lương & Doanh Thu Tháng Này Chưa Được Admin Tích Mở`}
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                      isVisibleToStaff
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-600 text-white'
                    }`}
                  >
                    {isVisibleToStaff ? 'Đang Hiển Thị' : 'Tạm Bỏ Trống'}
                  </span>
                </div>

                <p className="text-xs mt-1 leading-relaxed">
                  {isVisibleToStaff ? (
                    <>
                      Các số liệu về <strong>Lương theo ngày công</strong>, <strong>Doanh thu nguồn làm được</strong>, và <strong>Tổng lương thực nhận</strong> đã được Quản lý tích chọn cho phép nhân viên xem minh bạch.
                    </>
                  ) : (
                    <>
                      Theo quy định hệ thống: Khi Admin hàng tháng chưa tích mở hiển thị tại Bảng 7, các mục <strong>Lương</strong>, <strong>Doanh thu</strong> và <strong>Tổng lương</strong> sẽ <strong>bỏ trống</strong> cho đến khi có xác nhận chính thức từ quản lý.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* DÀN 3 THẺ SỐ LIỆU CHỦ ĐẠO: LƯƠNG - DOANH THU - TỔNG LƯƠNG */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* THẺ 1: LƯƠNG */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-2xs relative overflow-hidden">
              <div className="flex items-center justify-between text-blue-600 mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Lương Theo Ngày Công
                </span>
                <span className="p-1.5 bg-blue-100 rounded-xl">
                  <DollarSign className="w-4 h-4 text-blue-700" />
                </span>
              </div>

              {isVisibleToStaff && staffSalaryItem ? (
                <>
                  <div className="text-xl sm:text-2xl font-black text-blue-900 font-mono">
                    {formatVND(
                      staffSalaryItem.salaryByWorkingDays ??
                        Math.round(
                          (staffSalaryItem.baseSalary / (staffSalaryItem.standardWorkingDays || 26)) *
                            (staffSalaryItem.actualWorkingDays ?? 26)
                        )
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                    <div>
                      Đi làm: <strong>{staffSalaryItem.actualWorkingDays ?? 26}</strong> /{' '}
                      {staffSalaryItem.standardWorkingDays || 26} ngày công
                    </div>
                    <div>
                      Hợp đồng: {formatVND(staffSalaryItem.baseSalary)} / tháng
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-black text-slate-300 font-mono italic">
                    —
                  </div>
                  <div className="text-[11px] text-amber-600 mt-1 font-semibold flex items-center space-x-1">
                    <Lock className="w-3 h-3" />
                    <span>Bỏ trống (Chưa tích hiện)</span>
                  </div>
                </>
              )}
            </div>

            {/* THẺ 2: DOANH THU */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-2xs relative overflow-hidden">
              <div className="flex items-center justify-between text-emerald-600 mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Doanh Thu Mang Về
                </span>
                <span className="p-1.5 bg-emerald-100 rounded-xl">
                  <TrendingUp className="w-4 h-4 text-emerald-700" />
                </span>
              </div>

              {isVisibleToStaff && staffSalaryItem ? (
                <>
                  <div className="text-xl sm:text-2xl font-black text-emerald-800 font-mono">
                    {formatVND(staffSalaryItem.revenueGenerated || 0)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                    <div>
                      Thưởng KPI:{' '}
                      <strong className="text-emerald-700 font-mono font-black">
                        +{formatVND(staffSalaryItem.kpiBonus || 0)}
                      </strong>{' '}
                      ({staffSalaryItem.kpiRate ?? 10}%)
                    </div>
                    <div className="truncate text-slate-400" title={staffSalaryItem.revenueSourceName}>
                      Nguồn: {staffSalaryItem.revenueSourceName || 'Doanh số phụ trách'}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-black text-slate-300 font-mono italic">
                    —
                  </div>
                  <div className="text-[11px] text-amber-600 mt-1 font-semibold flex items-center space-x-1">
                    <Lock className="w-3 h-3" />
                    <span>Bỏ trống (Chưa tích hiện)</span>
                  </div>
                </>
              )}
            </div>

            {/* THẺ 3: TỔNG LƯƠNG */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-3xl p-5 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between text-indigo-700 mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-blue-900">
                  Tổng Lương Thực Nhận
                </span>
                <span className="p-1.5 bg-blue-200/80 rounded-xl">
                  <Award className="w-4 h-4 text-blue-800" />
                </span>
              </div>

              {isVisibleToStaff && staffSalaryItem ? (
                <>
                  <div className="text-2xl sm:text-3xl font-black text-blue-900 font-mono">
                    {formatVND(staffSalaryItem.actualSalary)}
                  </div>
                  <div className="text-[11px] text-blue-800 font-bold mt-1">
                    = Lương công + Thưởng KPI
                    {staffSalaryItem.onlineSupportAllowance ? ` + Tiền mạng/điện online` : ''}
                    {staffSalaryItem.otherBonus ? ` + Thưởng khác` : ''}
                    {staffSalaryItem.deduction ? ` - Trừ` : ''}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-2xl sm:text-3xl font-black text-slate-300 font-mono italic">
                    —
                  </div>
                  <div className="text-[11px] text-amber-700 mt-1 font-semibold flex items-center space-x-1">
                    <Lock className="w-3 h-3" />
                    <span>Bỏ trống (Chưa tích hiện)</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* BẢNG CHI TIẾT CÁC KHOẢN THU NHẬP THÁNG */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  Chi Tiết Thu Nhập Tháng ({activeMonthRecord?.title || selectedMonthKey})
                </h3>
                <p className="text-xs text-slate-500">
                  Bảng chi tiết các cấu phần thu nhập theo hợp đồng và ngày công
                </p>
              </div>

              {staffSalaryItem && isVisibleToStaff && (
                <div>
                  {staffSalaryItem.isPaid ? (
                    <span className="inline-flex items-center space-x-1 px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-xs font-black">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Đã Thanh Toán ({staffSalaryItem.paidDate || 'Thành công'})</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 px-3 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-xs font-black">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Đang Chờ Chi Trả</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {!staffSalaryItem ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs sm:text-sm font-bold text-slate-600">
                  Chưa có dữ liệu bảng lương cho nhân viên "{selectedStaffName}" trong tháng {activeMonthRecord?.title || selectedMonthKey}.
                </p>
                <p className="text-xs text-slate-400">
                  Admin sẽ cập nhật số ngày công và doanh thu khi tổng kết tháng.
                </p>
              </div>
            ) : !isVisibleToStaff ? (
              <div className="py-10 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2 p-6">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                  <Lock className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-black text-slate-800">
                  Số Tiền Lương & Doanh Thu Đang Bỏ Trống
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  Quản Lý (Admin) chưa tích chọn cho phép hiển thị thông tin lương tháng này. Khi Admin tích chọn "Hiển thị cho NV" ở Bảng 7, hệ thống sẽ tự động hiển thị đầy đủ chi tiết thu nhập tại đây.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-700 font-black border-b border-slate-200 text-[11px] uppercase tracking-wide">
                    <tr>
                      <th className="py-2.5 px-3.5">Hạng Mục</th>
                      <th className="py-2.5 px-3.5 text-center">Chi Tiết / Số Lượng</th>
                      <th className="py-2.5 px-3.5 text-right">Số Tiền (VNĐ)</th>
                      <th className="py-2.5 px-3.5">Ghi Chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* 1. Mức lương cơ bản theo hợp đồng */}
                    <tr className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3.5 font-bold text-slate-900">
                        1. Mức Lương Hợp Đồng (
                        {staffSalaryItem.contractType === 'probation' ? 'Thử Việc' : 'Chính Thức'}
                        )
                      </td>
                      <td className="py-2.5 px-3.5 text-center text-slate-600">
                        Chuẩn: {staffSalaryItem.standardWorkingDays || 26} công / tháng
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-800">
                        {formatVND(staffSalaryItem.baseSalary)}
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-500 text-[11px]">
                        Mức lương cơ sở tính công
                      </td>
                    </tr>

                    {/* 2. Ngày công làm việc thực tế & Lương theo công */}
                    <tr className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3.5 font-bold text-slate-900">
                        2. Lương Tính Theo Ngày Công Đi Làm
                      </td>
                      <td className="py-2.5 px-3.5 text-center">
                        <span className="font-mono font-black text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {staffSalaryItem.actualWorkingDays ?? 26} / {staffSalaryItem.standardWorkingDays || 26} công
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-black text-blue-900">
                        {formatVND(
                          staffSalaryItem.salaryByWorkingDays ??
                            Math.round(
                              (staffSalaryItem.baseSalary / (staffSalaryItem.standardWorkingDays || 26)) *
                                (staffSalaryItem.actualWorkingDays ?? 26)
                            )
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-500 text-[11px]">
                        = (Lương / {staffSalaryItem.standardWorkingDays || 26}) × {staffSalaryItem.actualWorkingDays ?? 26}
                      </td>
                    </tr>

                    {/* 3. Thưởng KPI tiền về doanh thu nguồn nhân viên làm được */}
                    <tr className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3.5 font-bold text-emerald-950">
                        3. Thưởng KPI Doanh Thu Nguồn Làm Được
                      </td>
                      <td className="py-2.5 px-3.5 text-center text-emerald-800 font-semibold text-[11px]">
                        {staffSalaryItem.revenueGenerated ? (
                          <>
                            Doanh thu: {formatVND(staffSalaryItem.revenueGenerated)} (Tỷ lệ {staffSalaryItem.kpiRate ?? 10}%)
                          </>
                        ) : (
                          'KPI chỉ định'
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-black text-emerald-800">
                        +{formatVND(staffSalaryItem.kpiBonus || 0)}
                      </td>
                      <td className="py-2.5 px-3.5 text-emerald-700 text-[11px]">
                        {staffSalaryItem.revenueSourceName || 'Thưởng phần trăm tiền về'}
                      </td>
                    </tr>

                    {/* 4. Hỗ trợ tiền mạng, điện cho nhân viên làm online (Yêu cầu 5) */}
                    {(staffSalaryItem.isOnlineStaff || (staffSalaryItem.onlineSupportAllowance && staffSalaryItem.onlineSupportAllowance > 0)) ? (
                      <tr className="hover:bg-slate-50/70 bg-indigo-50/30">
                        <td className="py-2.5 px-3.5 font-bold text-indigo-950 flex items-center space-x-1.5">
                          <Wifi className="w-3.5 h-3.5 text-indigo-600" />
                          <span>4. Hỗ Trợ Tiền Mạng & Điện (Làm Online)</span>
                        </td>
                        <td className="py-2.5 px-3.5 text-center text-indigo-800 font-semibold text-[11px]">
                          Phụ cấp làm việc từ xa
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono font-black text-indigo-800">
                          +{formatVND(staffSalaryItem.onlineSupportAllowance || 0)}
                        </td>
                        <td className="py-2.5 px-3.5 text-indigo-700 text-[11px]">
                          Cộng thêm vào lương
                        </td>
                      </tr>
                    ) : null}

                    {/* 5. Thưởng khác (nếu có) */}
                    {staffSalaryItem.otherBonus ? (
                      <tr className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3.5 font-bold text-teal-900">
                          5. Thưởng Khác (Chuyên cần, đột xuất)
                        </td>
                        <td className="py-2.5 px-3.5 text-center text-teal-700">-</td>
                        <td className="py-2.5 px-3.5 text-right font-mono font-bold text-teal-800">
                          +{formatVND(staffSalaryItem.otherBonus)}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-500 text-[11px]">Thưởng thêm</td>
                      </tr>
                    ) : null}

                    {/* 6. Khấu trừ phạt / tạm ứng (nếu có) */}
                    {staffSalaryItem.deduction ? (
                      <tr className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3.5 font-bold text-rose-900">
                          6. Khấu Trừ / Phạt / Tạm Ứng
                        </td>
                        <td className="py-2.5 px-3.5 text-center text-rose-700">-</td>
                        <td className="py-2.5 px-3.5 text-right font-mono font-bold text-rose-800">
                          -{formatVND(staffSalaryItem.deduction)}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-500 text-[11px]">Trừ lương</td>
                      </tr>
                    ) : null}
                  </tbody>

                  <tfoot className="bg-blue-50/90 font-black text-xs border-t-2 border-blue-300">
                    <tr>
                      <td colSpan={2} className="py-3 px-3.5 text-blue-900 uppercase tracking-wide">
                        TỔNG LƯƠNG THỰC NHẬN TRONG THÁNG:
                      </td>
                      <td className="py-3 px-3.5 text-right text-blue-900 text-base font-mono">
                        {formatVND(staffSalaryItem.actualSalary)}
                      </td>
                      <td className="py-3 px-3.5 text-blue-800 text-[11px]">
                        {staffSalaryItem.note ? `Ghi chú: ${staffSalaryItem.note}` : 'Đã xác nhận'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
