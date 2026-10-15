import React, { useState, useMemo } from 'react';
import {
  MonthlyFinanceRecord,
  StaffSalaryItem,
  UserAccount,
  AppUser,
  PageRecord,
  EmployeeContractType,
  isSameStaffIdentity,
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
  Contact,
  Award,
  Wifi,
  PenTool,
  Bot,
  FileSpreadsheet,
  ExternalLink,
  Check,
  Edit2,
  Save,
  X,
} from 'lucide-react';

interface StaffInfoTableProps {
  currentUser: AppUser;
  finances: MonthlyFinanceRecord[];
  accounts: UserAccount[];
  availableStaffNames?: string[];
  records?: PageRecord[];
  onNavigateToTab?: (tab: string) => void;
  onSaveMonthlyFinance?: (record: MonthlyFinanceRecord) => Promise<void>;
  onUpdateAccount?: (accountId: string, data: Partial<UserAccount>) => Promise<void>;
}

export const StaffInfoTable: React.FC<StaffInfoTableProps> = ({
  currentUser,
  finances,
  accounts,
  availableStaffNames = [],
  records = [],
  onNavigateToTab,
  onSaveMonthlyFinance,
  onUpdateAccount,
}) => {
  const isAdmin = currentUser.role === 'admin';

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

  // Đồng bộ selectedMonthKey khi finances tải xong từ Firestore
  React.useEffect(() => {
    if (availableMonths.length > 0) {
      const exists = availableMonths.some((m) => m.monthKey === selectedMonthKey);
      if (!exists) {
        setSelectedMonthKey(availableMonths[0].monthKey);
      }
    }
  }, [availableMonths, selectedMonthKey]);

  // Bản ghi tài chính của tháng được chọn
  const activeMonthRecord = useMemo(() => {
    return availableMonths.find((m) => m.monthKey === selectedMonthKey) || availableMonths[0];
  }, [availableMonths, selectedMonthKey]);

  // Danh sách nhân viên đã gộp thông minh (tránh tách rời MS.HUYEN và CHU THỊ HUYỀN)
  const staffOptionEntries = useMemo(() => {
    const staffAccounts = accounts.filter((a) => a.role === 'staff');
    const allSalaryItems: StaffSalaryItem[] = [];
    finances.forEach((f) => {
      (f.salaryItems || []).forEach((s) => allSalaryItems.push(s));
    });

    const entries: { value: string; label: string }[] = [];
    const addedIdentities: { username?: string; fullName?: string }[] = [];

    // 1. Ưu tiên từ danh sách tài khoản nhân viên
    for (const acc of staffAccounts) {
      const matchedSal = allSalaryItems.find((s) =>
        isSameStaffIdentity(acc.username, s.staffName, acc, s)
      );
      const fullName = acc.fullName || matchedSal?.staffName || '';
      const label =
        fullName && fullName.trim().toLowerCase() !== acc.username.trim().toLowerCase()
          ? `${acc.username} (${fullName})`
          : acc.username;
      entries.push({ value: acc.username, label });
      addedIdentities.push({ username: acc.username, fullName });
    }

    // 2. Bổ sung từ availableStaffNames hoặc bảng lương nếu chưa khớp tài khoản nào
    const extraCandidates = new Set<string>();
    availableStaffNames.forEach((n) => extraCandidates.add(n));
    allSalaryItems.forEach((s) => extraCandidates.add(s.staffName));

    for (const cand of Array.from(extraCandidates)) {
      if (!cand) continue;
      const alreadyExists = addedIdentities.some(
        (id) =>
          isSameStaffIdentity(id.username, cand) ||
          (id.fullName && isSameStaffIdentity(id.fullName, cand))
      );
      if (!alreadyExists) {
        entries.push({ value: cand, label: cand });
        addedIdentities.push({ username: cand, fullName: cand });
      }
    }

    return entries;
  }, [accounts, availableStaffNames, finances]);

  // Nhân viên đang xem (Nếu là Staff thì cố định tên của currentUser, nếu Admin thì có thể chọn)
  const [selectedStaffName, setSelectedStaffName] = useState<string>(() => {
    if (!isAdmin) return currentUser.name;
    return staffOptionEntries[0]?.value || currentUser.name;
  });

  // Cập nhật selectedStaffName nếu currentUser là staff
  React.useEffect(() => {
    if (!isAdmin) {
      setSelectedStaffName(currentUser.name);
    } else if (
      staffOptionEntries.length > 0 &&
      !staffOptionEntries.some((e) => isSameStaffIdentity(e.value, selectedStaffName))
    ) {
      setSelectedStaffName(staffOptionEntries[0].value);
    }
  }, [isAdmin, currentUser.name, staffOptionEntries, selectedStaffName]);

  // Tìm thông tin tài khoản nhân sự từ danh sách Accounts (khớp cả tên đăng nhập MS.HUYEN lẫn họ tên CHU THỊ HUYỀN)
  const matchedAccount = useMemo<UserAccount | undefined>(() => {
    return accounts.find(
      (a) => a.role === 'staff' && isSameStaffIdentity(selectedStaffName, a.username, a, null)
    );
  }, [accounts, selectedStaffName]);

  // Tìm thông tin lương của nhân viên này trong tháng được chọn (khớp thông minh MS.HUYEN <-> CHU THỊ HUYỀN)
  const staffSalaryItem = useMemo<StaffSalaryItem | undefined>(() => {
    if (!activeMonthRecord || !activeMonthRecord.salaryItems) return undefined;
    return activeMonthRecord.salaryItems.find((item) =>
      isSameStaffIdentity(selectedStaffName, item.staffName, matchedAccount, item)
    );
  }, [activeMonthRecord, selectedStaffName, matchedAccount]);

  // Tìm hồ sơ dự phòng từ bất kỳ tháng nào trong Bảng 7 nếu tháng hiện tại chưa có
  const fallbackSalaryProfile = useMemo<StaffSalaryItem | undefined>(() => {
    if (staffSalaryItem) return staffSalaryItem;
    for (const monthRec of availableMonths) {
      const found = (monthRec.salaryItems || []).find((item) =>
        isSameStaffIdentity(selectedStaffName, item.staffName, matchedAccount, item)
      );
      if (found) return found;
    }
    return undefined;
  }, [staffSalaryItem, availableMonths, selectedStaffName, matchedAccount]);

  // Tổng hợp thông tin Hồ Sơ Nhân Sự từ Bảng 7 & Tài khoản
  const resolvedProfile = useMemo(() => {
    const fullName =
      staffSalaryItem?.staffName ||
      fallbackSalaryProfile?.staffName ||
      matchedAccount?.fullName ||
      matchedAccount?.username ||
      selectedStaffName;
    const accountCode = matchedAccount?.username || staffSalaryItem?.accountUsername || '';
    const contractType: EmployeeContractType =
      staffSalaryItem?.contractType ||
      fallbackSalaryProfile?.contractType ||
      matchedAccount?.contractType ||
      'official';
    const dateOfBirth =
      staffSalaryItem?.dateOfBirth ||
      fallbackSalaryProfile?.dateOfBirth ||
      matchedAccount?.dateOfBirth ||
      '';
    const citizenId =
      staffSalaryItem?.citizenId ||
      fallbackSalaryProfile?.citizenId ||
      matchedAccount?.citizenId ||
      '';
    const startDate =
      staffSalaryItem?.startDate ||
      fallbackSalaryProfile?.startDate ||
      matchedAccount?.startDate ||
      '';
    const bankName =
      staffSalaryItem?.bankName ||
      fallbackSalaryProfile?.bankName ||
      matchedAccount?.bankName ||
      '';
    const bankAccountNumber =
      staffSalaryItem?.bankAccountNumber ||
      fallbackSalaryProfile?.bankAccountNumber ||
      matchedAccount?.bankAccountNumber ||
      '';
    const bankAccountHolder =
      staffSalaryItem?.bankAccountHolder ||
      fallbackSalaryProfile?.bankAccountHolder ||
      matchedAccount?.bankAccountHolder ||
      fullName;

    // Quyền hiển thị ô Hồ Sơ Nhân Sự cho nhân viên đó xem
    const isProfileVisible =
      staffSalaryItem?.isProfileVisibleToStaff !== undefined
        ? Boolean(staffSalaryItem.isProfileVisibleToStaff)
        : matchedAccount?.isProfileVisibleToStaff !== undefined
        ? Boolean(matchedAccount.isProfileVisibleToStaff)
        : Boolean(dateOfBirth || citizenId || startDate || bankAccountNumber);

    return {
      fullName,
      accountCode,
      contractType,
      dateOfBirth,
      citizenId,
      startDate,
      bankName,
      bankAccountNumber,
      bankAccountHolder,
      isProfileVisible,
    };
  }, [staffSalaryItem, fallbackSalaryProfile, matchedAccount, selectedStaffName]);

  // Quyền hiển thị Hồ sơ nhân sự (Nếu là Admin luôn thấy đầy đủ để kiểm tra, nếu là Nhân viên thì cần Admin tích chọn)
  const canViewProfileDetails = isAdmin || resolvedProfile.isProfileVisible;

  // Quyền hiển thị lương: Admin đã tích chọn trong Bảng 7 (hoặc tích ngay tại Bảng 8) mới cho hiện số tiền
  const isVisibleToStaff = Boolean(staffSalaryItem?.isVisibleToStaff);

  // State chỉnh sửa nhanh Hồ Sơ Nhân Sự ngay tại ô này cho Admin
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editContractType, setEditContractType] = useState<EmployeeContractType>('official');
  const [editDob, setEditDob] = useState('');
  const [editCitizenId, setEditCitizenId] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editBankName, setEditBankName] = useState('');
  const [editBankNumber, setEditBankNumber] = useState('');
  const [editBankHolder, setEditBankHolder] = useState('');
  const [isSavingAction, setIsSavingAction] = useState(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(null), 3500);
  };

  const handleStartEditProfile = () => {
    setEditFullName(resolvedProfile.fullName);
    setEditContractType(resolvedProfile.contractType);
    setEditDob(resolvedProfile.dateOfBirth);
    setEditCitizenId(resolvedProfile.citizenId);
    setEditStartDate(resolvedProfile.startDate);
    setEditBankName(resolvedProfile.bankName);
    setEditBankNumber(resolvedProfile.bankAccountNumber);
    setEditBankHolder(resolvedProfile.bankAccountHolder);
    setIsEditingProfile(true);
  };

  // Admin tích / bỏ tích hiện thông tin Hồ Sơ Nhân Sự ở ô này cho nhân viên đó xem luôn
  const handleToggleProfileVisibility = async (nextVisible: boolean) => {
    if (!isAdmin) return;
    setIsSavingAction(true);
    try {
      // 1. Lưu trực tiếp lên tài khoản nhân viên trong Cloud Accounts để nhân viên đăng nhập thấy ngay
      if (matchedAccount && onUpdateAccount) {
        await onUpdateAccount(matchedAccount.id, {
          fullName: resolvedProfile.fullName,
          contractType: resolvedProfile.contractType,
          dateOfBirth: resolvedProfile.dateOfBirth,
          citizenId: resolvedProfile.citizenId,
          startDate: resolvedProfile.startDate,
          bankName: resolvedProfile.bankName,
          bankAccountNumber: resolvedProfile.bankAccountNumber,
          bankAccountHolder: resolvedProfile.bankAccountHolder,
          isProfileVisibleToStaff: nextVisible,
        });
      }

      // 2. Đồng bộ trạng thái vào bản ghi tháng hiện tại (Bảng 7)
      if (activeMonthRecord && onSaveMonthlyFinance) {
        const updatedItems = (activeMonthRecord.salaryItems || []).map((item) => {
          if (isSameStaffIdentity(selectedStaffName, item.staffName, matchedAccount, item)) {
            return {
              ...item,
              accountUsername: matchedAccount?.username || item.accountUsername,
              isProfileVisibleToStaff: nextVisible,
            };
          }
          return item;
        });

        await onSaveMonthlyFinance({
          ...activeMonthRecord,
          salaryItems: updatedItems,
          updatedAt: new Date().toLocaleString('vi-VN'),
          updatedBy: currentUser.name || 'Admin',
        });
      }

      showToast(
        nextVisible
          ? `Đã tích hiển thị thông tin Hồ Sơ Nhân Sự cho ${resolvedProfile.fullName} (${resolvedProfile.accountCode || selectedStaffName}) xem!`
          : `Đã ẩn thông tin Hồ Sơ Nhân Sự đối với ${resolvedProfile.fullName}.`
      );
    } catch (err) {
      console.error('Lỗi cập nhật hiển thị hồ sơ:', err);
    } finally {
      setIsSavingAction(false);
    }
  };

  // Admin tích hiện thông tin Hồ Sơ Nhân Sự cho TẤT CẢ nhân viên cùng lúc
  const handleEnableProfileForAllStaff = async () => {
    if (!isAdmin) return;
    setIsSavingAction(true);
    try {
      const allSalaryItems: StaffSalaryItem[] = [];
      availableMonths.forEach((m) => {
        (m.salaryItems || []).forEach((s) => allSalaryItems.push(s));
      });

      if (onUpdateAccount) {
        for (const acc of accounts.filter((a) => a.role === 'staff')) {
          const matchedSal = allSalaryItems.find((s) =>
            isSameStaffIdentity(acc.username, s.staffName, acc, s)
          );
          await onUpdateAccount(acc.id, {
            fullName: matchedSal?.staffName || acc.fullName || acc.username,
            contractType: matchedSal?.contractType || acc.contractType || 'official',
            dateOfBirth: matchedSal?.dateOfBirth || acc.dateOfBirth || '',
            citizenId: matchedSal?.citizenId || acc.citizenId || '',
            startDate: matchedSal?.startDate || acc.startDate || '',
            bankName: matchedSal?.bankName || acc.bankName || '',
            bankAccountNumber: matchedSal?.bankAccountNumber || acc.bankAccountNumber || '',
            bankAccountHolder: matchedSal?.bankAccountHolder || acc.bankAccountHolder || matchedSal?.staffName || acc.username,
            isProfileVisibleToStaff: true,
          });
        }
      }

      if (activeMonthRecord && onSaveMonthlyFinance) {
        const updatedItems = (activeMonthRecord.salaryItems || []).map((item) => {
          const matchedAcc = accounts.find(
            (a) => a.role === 'staff' && isSameStaffIdentity(a.username, item.staffName, a, item)
          );
          return {
            ...item,
            accountUsername: matchedAcc?.username || item.accountUsername,
            isProfileVisibleToStaff: true,
          };
        });
        await onSaveMonthlyFinance({
          ...activeMonthRecord,
          salaryItems: updatedItems,
          updatedAt: new Date().toLocaleString('vi-VN'),
          updatedBy: currentUser.name || 'Admin',
        });
      }

      showToast('Đã tích hiển thị & đồng bộ Hồ Sơ Nhân Sự cho tất cả nhân viên!');
    } catch (err) {
      console.error('Lỗi đồng bộ tất cả hồ sơ:', err);
    } finally {
      setIsSavingAction(false);
    }
  };

  // Lưu chỉnh sửa nhanh thông tin Hồ Sơ Nhân Sự
  const handleSaveQuickProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSavingAction(true);
    try {
      if (matchedAccount && onUpdateAccount) {
        await onUpdateAccount(matchedAccount.id, {
          fullName: editFullName.trim() || resolvedProfile.fullName,
          contractType: editContractType,
          dateOfBirth: editDob.trim(),
          citizenId: editCitizenId.trim(),
          startDate: editStartDate.trim(),
          bankName: editBankName.trim(),
          bankAccountNumber: editBankNumber.trim(),
          bankAccountHolder: editBankHolder.trim().toUpperCase(),
          isProfileVisibleToStaff: true,
        });
      }

      if (activeMonthRecord && onSaveMonthlyFinance) {
        const existingMatch = (activeMonthRecord.salaryItems || []).some((item) =>
          isSameStaffIdentity(selectedStaffName, item.staffName, matchedAccount, item)
        );

        let updatedItems: StaffSalaryItem[];
        if (existingMatch) {
          updatedItems = (activeMonthRecord.salaryItems || []).map((item) => {
            if (isSameStaffIdentity(selectedStaffName, item.staffName, matchedAccount, item)) {
              return {
                ...item,
                staffName: editFullName.trim() || item.staffName,
                accountUsername: matchedAccount?.username || item.accountUsername,
                contractType: editContractType,
                dateOfBirth: editDob.trim(),
                citizenId: editCitizenId.trim(),
                startDate: editStartDate.trim(),
                bankName: editBankName.trim(),
                bankAccountNumber: editBankNumber.trim(),
                bankAccountHolder: editBankHolder.trim().toUpperCase(),
                isProfileVisibleToStaff: true,
              };
            }
            return item;
          });
        } else {
          const newItem: StaffSalaryItem = {
            id: `sal-${Date.now()}`,
            staffName: editFullName.trim() || resolvedProfile.fullName,
            accountUsername: matchedAccount?.username,
            contractType: editContractType,
            dateOfBirth: editDob.trim(),
            citizenId: editCitizenId.trim(),
            startDate: editStartDate.trim(),
            bankName: editBankName.trim(),
            bankAccountNumber: editBankNumber.trim(),
            bankAccountHolder: editBankHolder.trim().toUpperCase(),
            baseSalary: 6000000,
            standardWorkingDays: 26,
            actualWorkingDays: 26,
            salaryByWorkingDays: 6000000,
            kpiBonus: 0,
            deduction: 0,
            actualSalary: 6000000,
            isPaid: false,
            isVisibleToStaff: false,
            isProfileVisibleToStaff: true,
          };
          updatedItems = [...(activeMonthRecord.salaryItems || []), newItem];
        }

        await onSaveMonthlyFinance({
          ...activeMonthRecord,
          salaryItems: updatedItems,
          updatedAt: new Date().toLocaleString('vi-VN'),
          updatedBy: currentUser.name || 'Admin',
        });
      }

      setIsEditingProfile(false);
      showToast('Đã lưu và hiển thị thông tin Hồ Sơ Nhân Sự cho nhân viên!');
    } catch (err) {
      console.error('Lỗi lưu hồ sơ:', err);
    } finally {
      setIsSavingAction(false);
    }
  };

  // Admin tích / bỏ tích hiện Lương & Doanh thu ngay tại Bảng 8
  const handleToggleSalaryVisibilityHere = async (nextVisible: boolean) => {
    if (!isAdmin || !activeMonthRecord || !onSaveMonthlyFinance) return;
    setIsSavingAction(true);
    try {
      const updatedItems = (activeMonthRecord.salaryItems || []).map((item) => {
        if (isSameStaffIdentity(selectedStaffName, item.staffName, matchedAccount, item)) {
          return {
            ...item,
            accountUsername: matchedAccount?.username || item.accountUsername,
            isVisibleToStaff: nextVisible,
          };
        }
        return item;
      });
      await onSaveMonthlyFinance({
        ...activeMonthRecord,
        salaryItems: updatedItems,
        updatedAt: new Date().toLocaleString('vi-VN'),
        updatedBy: currentUser.name || 'Admin',
      });
      showToast(
        nextVisible
          ? `Đã tích mở hiển thị Lương & Doanh thu cho ${resolvedProfile.fullName}!`
          : `Đã ẩn số tiền Lương & Doanh thu đối với ${resolvedProfile.fullName}.`
      );
    } catch (err) {
      console.error('Lỗi cập nhật hiển thị lương:', err);
    } finally {
      setIsSavingAction(false);
    }
  };

  // Thống kê số lượng Page Đăng Tay vs Tool của nhân viên đang xem
  const staffWorkStats = useMemo(() => {
    const myPages = (records || []).filter((r) =>
      isSameStaffIdentity(selectedStaffName, r.staffName, matchedAccount, staffSalaryItem)
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
    const completionRate =
      totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : myPages.length > 0 ? 100 : 0;

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
  }, [records, selectedStaffName, matchedAccount, staffSalaryItem]);

  const formatVND = (num?: number) => {
    if (num === undefined || num === null) return '0 ₫';
    return num.toLocaleString('vi-VN') + ' ₫';
  };

  return (
    <div className="max-w-[1700px] mx-auto p-3 sm:p-6 space-y-5 animate-fadeIn">
      {/* THÔNG BÁO TOAST KHI ADMIN TÍCH CHỌN */}
      {statusToast && (
        <div className="p-3.5 bg-emerald-600 text-white rounded-2xl shadow-lg flex items-center justify-between text-xs sm:text-sm font-black animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{statusToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusToast(null)}
            className="p-1 hover:bg-white/20 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
            {/* Nếu là Admin: Cho phép chọn nhân viên để xem trước & tích hiển thị */}
            {isAdmin && (
              <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl px-3 py-1.5 flex items-center space-x-2">
                <span className="text-[11px] font-bold text-blue-200">Xem NV:</span>
                <select
                  value={selectedStaffName}
                  onChange={(e) => {
                    setSelectedStaffName(e.target.value);
                    setIsEditingProfile(false);
                  }}
                  className="bg-white text-slate-900 text-xs font-bold rounded-lg px-2 py-1 outline-none cursor-pointer"
                >
                  {staffOptionEntries.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-400 text-amber-950">
                  Admin quản lý
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
              Quy chế: Admin tích chọn ở <strong>Ô Hồ Sơ Nhân Sự</strong> để hiện lý lịch cá nhân cho nhân viên xem, và tích chọn công bố để hiện <strong>Lương, Doanh thu & Tổng lương</strong>.
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
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-2">
            <div className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-black shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900">
                  Hồ Sơ Nhân Sự
                </h2>
                <p className="text-[11px] text-slate-500">Thông tin lý lịch nhân viên</p>
              </div>
            </div>

            {isAdmin && !isEditingProfile && (
              <button
                type="button"
                onClick={handleStartEditProfile}
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-[11px] font-black cursor-pointer transition-all"
                title="Chỉnh sửa nhanh thông tin hồ sơ nhân viên tại ô này"
              >
                <Edit2 className="w-3 h-3" />
                <span>Sửa Hồ Sơ</span>
              </button>
            )}
          </div>

          {/* Ô ADMIN TÍCH ĐỂ HIỆN THÔNG TIN NHÂN VIÊN Ở Ô NÀY CHO NHÂN VIÊN ĐÓ XEM LUÔN */}
          {isAdmin && (
            <div
              className={`p-3.5 rounded-2xl border-2 transition-all space-y-2.5 ${
                resolvedProfile.isProfileVisible
                  ? 'bg-emerald-50/90 border-emerald-400 text-emerald-950'
                  : 'bg-amber-50/90 border-amber-400 text-amber-950'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <label className="flex items-start space-x-2.5 cursor-pointer select-none flex-1">
                  <input
                    type="checkbox"
                    checked={resolvedProfile.isProfileVisible}
                    disabled={isSavingAction}
                    onChange={(e) => handleToggleProfileVisibility(e.target.checked)}
                    className="w-4 h-4 mt-0.5 text-emerald-600 rounded border-emerald-400 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div className="text-xs leading-snug">
                    <span className="font-black block">
                      Tích để hiện thông tin nhân viên ở ô này cho nhân viên xem luôn
                    </span>
                    <span className="text-[11px] opacity-85 block mt-0.5">
                      {resolvedProfile.isProfileVisible
                        ? `Đang HIỂN THỊ đầy đủ Họ tên, Ngày sinh, CCCD, Ngày đi làm & STK cho ${resolvedProfile.accountCode || resolvedProfile.fullName}`
                        : `Đang ẨN với nhân viên — Tích vào ô này để hiển thị ngay cho ${resolvedProfile.accountCode || resolvedProfile.fullName}`}
                    </span>
                  </div>
                </label>

                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                    resolvedProfile.isProfileVisible
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-600 text-white'
                  }`}
                >
                  {resolvedProfile.isProfileVisible ? 'Đã Tích Hiện' : 'Chưa Tích'}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-black/10">
                <span className="text-[10px] font-bold opacity-80">
                  Đồng bộ từ Bảng 7 ({resolvedProfile.fullName})
                </span>
                <button
                  type="button"
                  disabled={isSavingAction}
                  onClick={handleEnableProfileForAllStaff}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-[10px] font-black cursor-pointer shadow-2xs transition-all"
                  title="Tích hiện thông tin hồ sơ cho tất cả nhân viên trong hệ thống"
                >
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>Tích Hiện Cho Tất Cả NV</span>
                </button>
              </div>
            </div>
          )}

          {/* FORM SỬA NHANH HỒ SƠ NGAY TẠI Ô NÀY (KHI ADMIN BẤM SỬA HỒ SƠ) */}
          {isAdmin && isEditingProfile ? (
            <form
              onSubmit={handleSaveQuickProfile}
              className="p-3.5 bg-blue-50/60 border-2 border-blue-300 rounded-2xl space-y-3"
            >
              <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                <span className="text-xs font-black text-blue-950 uppercase">
                  Cập Nhật Hồ Sơ Nhân Sự ({resolvedProfile.accountCode || selectedStaffName})
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">
                  Họ Và Tên Nhân Viên
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="VD: CHU THỊ HUYỀN"
                  className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-xl text-xs font-black text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">
                    Chế Độ
                  </label>
                  <select
                    value={editContractType}
                    onChange={(e) => setEditContractType(e.target.value as EmployeeContractType)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                  >
                    <option value="official">Chính Thức</option>
                    <option value="probation">Thử Việc</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">
                    Ngày Tháng Năm Sinh
                  </label>
                  <input
                    type="text"
                    value={editDob}
                    onChange={(e) => setEditDob(e.target.value)}
                    placeholder="VD: 13/10/1998"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">
                    Số CCCD / CMND
                  </label>
                  <input
                    type="text"
                    value={editCitizenId}
                    onChange={(e) => setEditCitizenId(e.target.value)}
                    placeholder="VD: 40198007300"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">
                    Ngày Bắt Đầu Đi Làm
                  </label>
                  <input
                    type="text"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    placeholder="VD: 01/07/2025"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">
                    Ngân Hàng
                  </label>
                  <input
                    type="text"
                    value={editBankName}
                    onChange={(e) => setEditBankName(e.target.value)}
                    placeholder="Vietcombank..."
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">
                    Số Tài Khoản
                  </label>
                  <input
                    type="text"
                    value={editBankNumber}
                    onChange={(e) => setEditBankNumber(e.target.value)}
                    placeholder="1031828185"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">
                    Chủ Tài Khoản
                  </label>
                  <input
                    type="text"
                    value={editBankHolder}
                    onChange={(e) => setEditBankHolder(e.target.value.toUpperCase())}
                    placeholder="CHU THỊ HUYỀN"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold uppercase text-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingAction}
                  className="inline-flex items-center space-x-1 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu & Hiện Cho NV</span>
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Họ và tên nhân viên */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                  Họ Và Tên Nhân Viên
                </span>
                <div className="text-base sm:text-lg font-black text-slate-900 mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span>
                    {canViewProfileDetails
                      ? resolvedProfile.fullName
                      : resolvedProfile.accountCode || selectedStaffName}
                  </span>
                  {resolvedProfile.accountCode &&
                    resolvedProfile.fullName.trim().toLowerCase() !==
                      resolvedProfile.accountCode.trim().toLowerCase() && (
                      <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-lg border border-blue-200">
                        {resolvedProfile.accountCode}
                      </span>
                    )}
                  <span
                    className="w-2 h-2 rounded-full bg-emerald-500"
                    title="Nhân viên chính thức"
                  />
                </div>
                <div className="mt-1">
                  {resolvedProfile.contractType === 'probation' ? (
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

              {/* Ngày tháng năm sinh */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl">
                <div className="flex items-center space-x-1.5 text-blue-900">
                  <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-[11px] font-black uppercase tracking-wide">
                    Ngày Tháng Năm Sinh
                  </span>
                </div>
                <div className="text-sm sm:text-base font-bold text-slate-900 mt-1 pl-5">
                  {!canViewProfileDetails ? (
                    <span className="text-amber-600 italic text-xs flex items-center space-x-1">
                      <Lock className="w-3 h-3" />
                      <span>Chưa tích hiển thị</span>
                    </span>
                  ) : resolvedProfile.dateOfBirth ? (
                    <span className="font-mono font-black text-blue-950">
                      {resolvedProfile.dateOfBirth}
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
                  {!canViewProfileDetails ? (
                    <span className="text-amber-600 italic text-xs font-sans flex items-center space-x-1">
                      <Lock className="w-3 h-3" />
                      <span>Chưa tích hiển thị</span>
                    </span>
                  ) : resolvedProfile.citizenId ? (
                    <span>{resolvedProfile.citizenId}</span>
                  ) : (
                    <span className="text-slate-400 italic text-xs font-sans">
                      Chưa cập nhật CCCD
                    </span>
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
                  {!canViewProfileDetails ? (
                    <span className="text-amber-600 italic text-xs flex items-center space-x-1">
                      <Lock className="w-3 h-3" />
                      <span>Chưa tích hiển thị</span>
                    </span>
                  ) : resolvedProfile.startDate ? (
                    <span>{resolvedProfile.startDate}</span>
                  ) : (
                    <span className="text-slate-400 italic text-xs">
                      Chưa cập nhật ngày đi làm
                    </span>
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
                {!canViewProfileDetails ? (
                  <div className="pl-5 text-amber-600 italic text-xs flex items-center space-x-1">
                    <Lock className="w-3 h-3" />
                    <span>Chưa tích hiển thị</span>
                  </div>
                ) : resolvedProfile.bankAccountNumber ? (
                  <div className="pl-5 space-y-0.5">
                    <div className="font-mono font-black text-sm text-slate-900">
                      {resolvedProfile.bankAccountNumber}
                    </div>
                    <div className="text-[11px] text-slate-600 font-medium">
                      {resolvedProfile.bankName || 'Ngân hàng'} •{' '}
                      <span className="font-bold">{resolvedProfile.bankAccountHolder}</span>
                    </div>
                  </div>
                ) : (
                  <div className="pl-5 text-slate-400 italic text-xs">
                    Chưa có số tài khoản ngân hàng
                  </div>
                )}
              </div>
            </>
          )}

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
                  {staffWorkStats.manualCount}{' '}
                  <span className="text-[10px] font-sans text-slate-500 font-normal">Page</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Bài hôm nay: <strong className="text-emerald-700">{staffWorkStats.manualActual}</strong>/
                  {staffWorkStats.manualTarget}
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
                  {staffWorkStats.toolCount}{' '}
                  <span className="text-[10px] font-sans text-slate-500 font-normal">Page</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Bài hôm nay: <strong className="text-purple-700">{staffWorkStats.toolActual}</strong>/
                  {staffWorkStats.toolTarget}
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
                  <span>
                    Tiến độ: {staffWorkStats.completionRate}% ({staffWorkStats.totalActual}/
                    {staffWorkStats.totalTarget} bài)
                  </span>
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
                  isVisibleToStaff
                    ? 'bg-emerald-200/80 text-emerald-800'
                    : 'bg-amber-200/80 text-amber-800'
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

                  <div className="flex items-center space-x-2">
                    {isAdmin && staffSalaryItem && (
                      <label className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900 cursor-pointer shadow-2xs hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={isVisibleToStaff}
                          disabled={isSavingAction}
                          onChange={(e) => handleToggleSalaryVisibilityHere(e.target.checked)}
                          className="w-3.5 h-3.5 text-emerald-600 rounded cursor-pointer"
                        />
                        <span>Tích hiện Lương & Doanh thu cho NV</span>
                      </label>
                    )}

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
                </div>

                <p className="text-xs mt-1 leading-relaxed">
                  {isVisibleToStaff ? (
                    <>
                      Các số liệu về <strong>Lương theo ngày công</strong>,{' '}
                      <strong>Doanh thu nguồn làm được</strong>, và{' '}
                      <strong>Tổng lương thực nhận</strong> đã được Quản lý tích chọn cho phép nhân
                      viên xem minh bạch.
                    </>
                  ) : (
                    <>
                      Theo quy định hệ thống: Khi Admin hàng tháng chưa tích mở hiển thị, các mục{' '}
                      <strong>Lương</strong>, <strong>Doanh thu</strong> và{' '}
                      <strong>Tổng lương</strong> sẽ <strong>bỏ trống</strong> cho đến khi có xác
                      nhận chính thức từ quản lý.
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
                          (staffSalaryItem.baseSalary /
                            (staffSalaryItem.standardWorkingDays || 26)) *
                            (staffSalaryItem.actualWorkingDays ?? 26)
                        )
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                    <div>
                      Đi làm: <strong>{staffSalaryItem.actualWorkingDays ?? 26}</strong> /{' '}
                      {staffSalaryItem.standardWorkingDays || 26} ngày công
                    </div>
                    <div>Hợp đồng: {formatVND(staffSalaryItem.baseSalary)} / tháng</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-black text-slate-300 font-mono italic">—</div>
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
                    <div
                      className="truncate text-slate-400"
                      title={staffSalaryItem.revenueSourceName}
                    >
                      Nguồn: {staffSalaryItem.revenueSourceName || 'Doanh số phụ trách'}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-black text-slate-300 font-mono italic">—</div>
                  <div className="text-[11px] text-amber-600 mt-1 font-semibold flex items-center space-x-1">
                    <Lock className="w-3 h-3" />
                    <span>Bỏ trống (Chưa tích hiện)</span>
                  </div>
                </>
              )}
            </div>

            {/* THẺ 3: TỔNG LƯƠNG THỰC NHẬN */}
            <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 text-white rounded-3xl p-5 shadow-md relative overflow-hidden">
              <div className="flex items-center justify-between text-blue-100 mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider">
                  Tổng Lương Thực Nhận
                </span>
                <span className="p-1.5 bg-white/15 rounded-xl">
                  <Award className="w-4 h-4 text-amber-300" />
                </span>
              </div>

              {isVisibleToStaff && staffSalaryItem ? (
                <>
                  <div className="text-xl sm:text-2xl font-black text-white font-mono">
                    {formatVND(staffSalaryItem.actualSalary)}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    {staffSalaryItem.isPaid ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-400/25 text-emerald-100 border border-emerald-300/40 font-bold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                        <span>Đã Thanh Toán {staffSalaryItem.paidDate || ''}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-400/25 text-amber-100 border border-amber-300/40 font-bold">
                        <Clock className="w-3 h-3 text-amber-300" />
                        <span>Chờ Thanh Toán</span>
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-black text-white/40 font-mono italic">—</div>
                  <div className="text-[11px] text-blue-200 mt-1 font-semibold flex items-center space-x-1">
                    <Lock className="w-3 h-3" />
                    <span>Bỏ trống (Chưa tích hiện)</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* BẢNG CHI TIẾT CẤU THÀNH THU NHẬP THÁNG */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    Bảng Kê Chi Tiết Lương & Phụ Cấp ({activeMonthRecord?.title || selectedMonthKey})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Chi tiết từng khoản cấu thành thu nhập của{' '}
                    <strong>{resolvedProfile.fullName}</strong>
                  </p>
                </div>
              </div>

              {isVisibleToStaff && staffSalaryItem ? (
                <span className="px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black">
                  Công khai minh bạch
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-xs font-bold">
                  Đang để trống chờ duyệt
                </span>
              )}
            </div>

            {isVisibleToStaff && staffSalaryItem ? (
              <div className="space-y-2.5 text-xs sm:text-sm">
                {/* 1. Mức lương cơ bản */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <div>
                    <span className="font-bold text-slate-800 block">
                      1. Mức Lương Hợp Đồng (
                      {staffSalaryItem.contractType === 'probation' ? 'Thử Việc' : 'Chính Thức'})
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Định mức chuẩn: {staffSalaryItem.standardWorkingDays || 26} ngày công / tháng
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-700">
                    {formatVND(staffSalaryItem.baseSalary)}
                  </span>
                </div>

                {/* 2. Lương tính theo ngày công thực tế */}
                <div className="flex items-center justify-between p-3 bg-blue-50/60 rounded-2xl border border-blue-200/80">
                  <div>
                    <span className="font-black text-blue-950 block">
                      2. Lương Theo Ngày Công Thực Tế (
                      {staffSalaryItem.actualWorkingDays ?? 26}/
                      {staffSalaryItem.standardWorkingDays || 26} công)
                    </span>
                    <span className="text-[11px] text-blue-700">
                      = Lương cơ bản ÷ {staffSalaryItem.standardWorkingDays || 26} ×{' '}
                      {staffSalaryItem.actualWorkingDays ?? 26} ngày đi làm
                    </span>
                  </div>
                  <span className="font-mono font-black text-blue-900">
                    +
                    {formatVND(
                      staffSalaryItem.salaryByWorkingDays ??
                        Math.round(
                          (staffSalaryItem.baseSalary /
                            (staffSalaryItem.standardWorkingDays || 26)) *
                            (staffSalaryItem.actualWorkingDays ?? 26)
                        )
                    )}
                  </span>
                </div>

                {/* 3. Doanh thu & Thưởng KPI */}
                <div className="flex items-center justify-between p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200/80">
                  <div>
                    <span className="font-black text-emerald-950 flex items-center space-x-1.5">
                      <Percent className="w-3.5 h-3.5 text-emerald-600" />
                      <span>
                        3. Thưởng KPI Doanh Thu ({staffSalaryItem.kpiRate ?? 10}% trên Doanh thu{' '}
                        {formatVND(staffSalaryItem.revenueGenerated || 0)})
                      </span>
                    </span>
                    <span className="text-[11px] text-emerald-700 block">
                      Nguồn doanh thu:{' '}
                      {staffSalaryItem.revenueSourceName || 'Doanh thu nhân viên mang về'}
                    </span>
                  </div>
                  <span className="font-mono font-black text-emerald-700">
                    +{formatVND(staffSalaryItem.kpiBonus || 0)}
                  </span>
                </div>

                {/* 4. Hỗ trợ tiền mạng & điện (Nhân viên làm Online) */}
                {(staffSalaryItem.isOnlineStaff ||
                  (staffSalaryItem.onlineSupportAllowance &&
                    staffSalaryItem.onlineSupportAllowance > 0)) && (
                  <div className="flex items-center justify-between p-3 bg-indigo-50/70 rounded-2xl border border-indigo-200">
                    <div>
                      <span className="font-black text-indigo-950 flex items-center space-x-1.5">
                        <Wifi className="w-3.5 h-3.5 text-indigo-600" />
                        <span>4. Phụ Cấp Hỗ Trợ Tiền Mạng & Điện (Nhân Viên Làm Online)</span>
                      </span>
                      <span className="text-[11px] text-indigo-700 block">
                        Cộng trực tiếp vào lương thực nhận hàng tháng
                      </span>
                    </div>
                    <span className="font-mono font-black text-indigo-700">
                      +{formatVND(staffSalaryItem.onlineSupportAllowance || 0)}
                    </span>
                  </div>
                )}

                {/* 5. Thưởng khác */}
                {(staffSalaryItem.otherBonus || 0) > 0 && (
                  <div className="flex items-center justify-between p-3 bg-teal-50/60 rounded-2xl border border-teal-200">
                    <div>
                      <span className="font-bold text-teal-900 block">
                        5. Thưởng Chuyên Cần / Thưởng Thêm Khác
                      </span>
                    </div>
                    <span className="font-mono font-black text-teal-700">
                      +{formatVND(staffSalaryItem.otherBonus || 0)}
                    </span>
                  </div>
                )}

                {/* 6. Khấu trừ / Tạm ứng */}
                {(staffSalaryItem.deduction || 0) > 0 && (
                  <div className="flex items-center justify-between p-3 bg-rose-50/60 rounded-2xl border border-rose-200">
                    <div>
                      <span className="font-bold text-rose-900 block">
                        Khấu Trừ / Tạm Ứng / Phạt
                      </span>
                    </div>
                    <span className="font-mono font-black text-rose-600">
                      -{formatVND(staffSalaryItem.deduction || 0)}
                    </span>
                  </div>
                )}

                {/* Ghi chú của Admin */}
                {staffSalaryItem.note && (
                  <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-2xl text-xs text-amber-900">
                    <strong>Ghi chú từ Quản Lý:</strong> {staffSalaryItem.note}
                  </div>
                )}

                {/* Tổng cộng */}
                <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl flex items-center justify-between shadow-sm">
                  <div>
                    <span className="text-xs uppercase font-black tracking-wider text-blue-100 block">
                      TỔNG LƯƠNG THỰC NHẬN ({activeMonthRecord?.title || selectedMonthKey})
                    </span>
                    <span className="text-[11px] text-blue-200">
                      Chuyển khoản vào STK: {resolvedProfile.bankAccountNumber || 'Tiền mặt'} (
                      {resolvedProfile.bankName || 'Ngân hàng'})
                    </span>
                  </div>
                  <span className="text-lg sm:text-xl font-black font-mono text-amber-300">
                    {formatVND(staffSalaryItem.actualSalary)}
                  </span>
                </div>
              </div>
            ) : (
              /* TRẠNG THÁI BỎ TRỐNG KHI ADMIN CHƯA TÍCH CHỌN */
              <div className="py-10 px-4 text-center bg-slate-50/80 border-2 border-dashed border-slate-200 rounded-3xl space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-slate-200/70 text-slate-400 flex items-center justify-center mx-auto">
                  <EyeOff className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-black text-slate-700">
                  Dữ Liệu Lương & Doanh Thu Đang Để Trống
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  {!staffSalaryItem
                    ? `Hiện chưa có bản ghi bảng lương của "${resolvedProfile.fullName}" trong kỳ ${activeMonthRecord?.title || selectedMonthKey}.`
                    : `Quản lý (Admin) hiện chưa tích chọn hiển thị bảng lương kỳ ${activeMonthRecord?.title || selectedMonthKey} cho nhân sự "${resolvedProfile.fullName}". Khi Admin tích chọn, toàn bộ số tiền Lương, Doanh thu và Tổng lương sẽ tự động hiện ra tại đây.`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
