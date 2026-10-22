import React, { useState, useMemo, useEffect } from 'react';
import {
  MonthlyFinanceRecord,
  RevenueItem,
  StaffSalaryItem,
  CustomExpenseItem,
  EmployeeContractType,
  ExpenseType,
  AppUser,
  UserAccount,
  isSameStaffIdentity,
} from '../types';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  ArrowUpDown,
  SlidersHorizontal,
  Minus,
  Sparkles,
  Building2,
  Zap,
  Droplets,
  Users,
  Receipt,
  Plus,
  Trash2,
  Edit2,
  Save,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
  Lock,
  RefreshCw,
  FileSpreadsheet,
  PieChart,
  X,
  CreditCard,
  Wifi,
  ShoppingBag,
  Copy,
  Check,
  Wrench,
  Percent,
  Calendar,
  Briefcase,
  UserCheck,
  Contact,
  Eye,
  EyeOff,
  RotateCcw,
  CheckSquare,
  Globe,
} from 'lucide-react';
import { MgidDashboardPanel } from './MgidDashboardPanel';

interface RevenueManagementTableProps {
  finances: MonthlyFinanceRecord[];
  currentUser: AppUser;
  availableStaffNames: string[];
  accounts?: UserAccount[];
  onSaveMonthlyFinance: (record: MonthlyFinanceRecord) => Promise<void> | void;
  onDeleteMonthlyFinance: (monthId: string) => Promise<void> | void;
  onDeleteBatchMonthlyFinances?: (monthIds: string[]) => Promise<void> | void;
  onClearAllFinances?: () => Promise<void> | void;
  onRefreshFinances?: () => Promise<void> | void;
  onNavigateToTab?: (tab: string) => void;
  onUpdateAccount?: (accountId: string, data: Partial<UserAccount>) => Promise<void> | void;
}

// Danh sách ngân hàng phổ biến tại Việt Nam để gợi ý nhanh
export const POPULAR_VIETNAM_BANKS = [
  'MB Bank (Quân Đội)',
  'Techcombank',
  'Vietcombank',
  'VPBank',
  'TPBank',
  'BIDV',
  'Agribank',
  'ACB (Á Châu)',
  'VietinBank',
  'Sacombank',
  'HDBank',
  'VIB',
  'SHB',
  'OCB',
  'MSB',
  'SeABank',
];

// Hàm format tiền tệ VNĐ chuẩn đẹp (VD: 150.000.000 ₫)
export function formatCurrencyVND(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format số có dấu phân cách (VD: 150,000,000)
export function formatNumber(num: number): string {
  if (isNaN(num) || num === null || num === undefined) return '0';
  return new Intl.NumberFormat('vi-VN').format(num);
}

// Parse chuỗi có thể chứa dấu chấm, phẩy thành số
export function parseNumberInput(str: string): number {
  if (!str) return 0;
  const clean = str.replace(/[^\d-]/g, '');
  const parsed = parseInt(clean, 10);
  return isNaN(parsed) ? 0 : parsed;
}

export const RevenueManagementTable: React.FC<RevenueManagementTableProps> = ({
  finances,
  currentUser,
  availableStaffNames,
  accounts = [],
  onSaveMonthlyFinance,
  onDeleteMonthlyFinance,
  onDeleteBatchMonthlyFinances,
  onClearAllFinances,
  onNavigateToTab,
  onUpdateAccount,
}) => {
  const isAdmin = currentUser.role === 'admin';

  // Lấy danh sách tháng hoặc tạo tháng mặc định hiện tại
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonthNum = currentDate.getMonth() + 1;
  const currentMonthKey = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;

  // State chọn tháng đang xem / quản lý
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    if (finances.length > 0 && finances[0]?.monthKey) {
      return finances[0].monthKey;
    }
    return currentMonthKey;
  });

  // Active section tab: 'overview' | 'mgid_dashboard' | 'revenue' | 'expenses' | 'salaries' | 'all_months'
  const [activeSection, setActiveSection] = useState<'overview' | 'mgid_dashboard' | 'revenue' | 'expenses' | 'salaries' | 'all_months'>('overview');

  // Chế độ ẩn/làm mờ số tiền bảo mật khi Admin ngồi cạnh người khác
  const [isPrivacyMasked, setIsPrivacyMasked] = useState<boolean>(false);

  // Đang lưu dữ liệu
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Copy số tài khoản trạng thái
  const [copiedBankAccId, setCopiedBankAccId] = useState<string | null>(null);

  // Modal tạo tháng mới & Sao chép dữ liệu từ tháng cũ
  const [isNewMonthModalOpen, setIsNewMonthModalOpen] = useState(false);
  const [newMonthNumber, setNewMonthNumber] = useState<number>(currentMonthNum);
  const [newMonthYear, setNewMonthYear] = useState<number>(currentYear);
  const [newMonthCopySourceKey, setNewMonthCopySourceKey] = useState<string>('');
  const [newMonthCopySalaries, setNewMonthCopySalaries] = useState<boolean>(true);
  const [newMonthCopyOfficeCosts, setNewMonthCopyOfficeCosts] = useState<boolean>(true);
  const [newMonthCopyExpenses, setNewMonthCopyExpenses] = useState<boolean>(true);
  const [newMonthCopyRevenue, setNewMonthCopyRevenue] = useState<boolean>(true);

  // Modal sao chép dữ liệu từ tháng khác vào tháng hiện tại
  const [isCopyFromMonthModalOpen, setIsCopyFromMonthModalOpen] = useState(false);
  const [copySourceMonthKey, setCopySourceMonthKey] = useState<string>('');
  const [copySalariesOption, setCopySalariesOption] = useState<boolean>(true);
  const [copyOfficeCostsOption, setCopyOfficeCostsOption] = useState<boolean>(true);
  const [copyExpensesOption, setCopyExpensesOption] = useState<boolean>(true);
  const [copyRevenueOption, setCopyRevenueOption] = useState<boolean>(true);

  // Modal Quản Lý & Chọn Xóa Dữ Liệu Theo Tháng (Yêu cầu 4: có thể chọn và xóa toàn bộ dữ liệu theo tháng)
  const [isManageMonthsModalOpen, setIsManageMonthsModalOpen] = useState(false);
  const [selectedMonthKeysToDelete, setSelectedMonthKeysToDelete] = useState<string[]>([]);

  // Modal thêm / sửa nguồn thu (Revenue Item)
  const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false);
  const [editingRevenueItem, setEditingRevenueItem] = useState<RevenueItem | null>(null);
  const [revenueSourceName, setRevenueSourceName] = useState('');
  const [revenueAmountInput, setRevenueAmountInput] = useState('');
  const [revenuePayer, setRevenuePayer] = useState('');
  const [revenueDate, setRevenueDate] = useState('');
  const [revenueNote, setRevenueNote] = useState('');

  // ==========================================
  // STATE CHO MODAL BẢNG LƯƠNG NHÂN VIÊN
  // ==========================================
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [editingSalaryItem, setEditingSalaryItem] = useState<StaffSalaryItem | null>(null);
  const [salaryStaffName, setSalaryStaffName] = useState('');

  // Thông tin nhân sự bổ sung (Yêu cầu: Ngày tháng năm sinh, Số CCCD, Ngày bắt đầu đi làm)
  const [salaryDateOfBirth, setSalaryDateOfBirth] = useState('');
  const [salaryCitizenId, setSalaryCitizenId] = useState('');
  const [salaryStartDate, setSalaryStartDate] = useState('');

  const [salaryContractType, setSalaryContractType] = useState<EmployeeContractType>('official');
  const [salaryProbationInput, setSalaryProbationInput] = useState('');
  const [salaryOfficialInput, setSalaryOfficialInput] = useState('');
  const [salaryStandardDays, setSalaryStandardDays] = useState<number>(26);
  const [salaryActualDaysInput, setSalaryActualDaysInput] = useState('26');
  // Tài khoản ngân hàng của nhân viên
  const [salaryBankName, setSalaryBankName] = useState('');
  const [salaryBankAccountNumber, setSalaryBankAccountNumber] = useState('');
  const [salaryBankAccountHolder, setSalaryBankAccountHolder] = useState('');
  // Thưởng KPI tiền về theo doanh thu nguồn làm được (5% hoặc 10%)
  const [salaryRevenueGeneratedInput, setSalaryRevenueGeneratedInput] = useState('');
  const [salaryRevenueSourceName, setSalaryRevenueSourceName] = useState('');
  const [salaryKpiRate, setSalaryKpiRate] = useState<number>(10); // Mặc định 10%
  // Hỗ trợ tiền mạng, điện cho nhân viên làm online (Yêu cầu 5: cộng vào lương thực nhận cho NV online)
  const [salaryIsOnlineStaff, setSalaryIsOnlineStaff] = useState(false);
  const [salaryOnlineSupportInput, setSalaryOnlineSupportInput] = useState('0');
  const [salaryOtherBonusInput, setSalaryOtherBonusInput] = useState('0');
  const [salaryDeductionInput, setSalaryDeductionInput] = useState('0');
  const [salaryIsPaid, setSalaryIsPaid] = useState(false);
  const [salaryPaidDate, setSalaryPaidDate] = useState('');
  const [salaryNote, setSalaryNote] = useState('');
  // Quyền hiển thị cho nhân viên (Tích hiện / Bỏ tích ẩn số tiền)
  const [salaryIsVisibleToStaff, setSalaryIsVisibleToStaff] = useState(false);
  // Quyền hiển thị Hồ Sơ Nhân Sự ở ô Hồ Sơ Nhân Sự cho nhân viên đó xem luôn (Mặc định tích chọn true)
  const [salaryIsProfileVisibleToStaff, setSalaryIsProfileVisibleToStaff] = useState(true);

  // State sắp xếp & hiển thị bảng so sánh doanh thu các tháng
  const [comparisonSortOrder, setComparisonSortOrder] = useState<'desc' | 'asc'>('desc');
  // State chọn 2 tháng để đối chiếu trực tiếp chỉ số (Doanh thu, Chi phí, Lợi nhuận)
  const [directCompareKeyA, setDirectCompareKeyA] = useState<string>('');
  const [directCompareKeyB, setDirectCompareKeyB] = useState<string>('');

  // Hàm tự động gợi ý/điền nhanh thông tin nhân sự khi Admin chọn tên nhân viên
  const handleStaffNameChange = (name: string) => {
    setSalaryStaffName(name);
    if (!editingSalaryItem && name.trim()) {
      const matchedAccount = accounts.find(
        (a) => a.role === 'staff' && isSameStaffIdentity(name, a.username, a, null)
      );
      let matchedPastSalary: StaffSalaryItem | undefined;
      for (const fin of finances) {
        const found = fin.salaryItems?.find((s) =>
          isSameStaffIdentity(name, s.staffName, matchedAccount, s)
        );
        if (found) {
          matchedPastSalary = found;
          break;
        }
      }

      if (matchedAccount?.dateOfBirth || matchedPastSalary?.dateOfBirth) {
        setSalaryDateOfBirth(matchedAccount?.dateOfBirth || matchedPastSalary?.dateOfBirth || '');
      }
      if (matchedAccount?.citizenId || matchedPastSalary?.citizenId) {
        setSalaryCitizenId(matchedAccount?.citizenId || matchedPastSalary?.citizenId || '');
      }
      if (matchedAccount?.startDate || matchedPastSalary?.startDate) {
        setSalaryStartDate(matchedAccount?.startDate || matchedPastSalary?.startDate || '');
      }
      if (matchedAccount?.bankAccountNumber || matchedPastSalary?.bankAccountNumber) {
        setSalaryBankAccountNumber(matchedAccount?.bankAccountNumber || matchedPastSalary?.bankAccountNumber || '');
      }
      if (matchedAccount?.bankName || matchedPastSalary?.bankName) {
        setSalaryBankName(matchedAccount?.bankName || matchedPastSalary?.bankName || '');
      }
      if (matchedAccount?.bankAccountHolder || matchedPastSalary?.bankAccountHolder) {
        setSalaryBankAccountHolder(matchedAccount?.bankAccountHolder || matchedPastSalary?.bankAccountHolder || '');
      }
      if (matchedPastSalary?.probationSalary && !salaryProbationInput) {
        setSalaryProbationInput(String(matchedPastSalary.probationSalary));
      }
      if (matchedPastSalary?.officialSalary && !salaryOfficialInput) {
        setSalaryOfficialInput(String(matchedPastSalary.officialSalary));
      }
      if (matchedPastSalary?.contractType) {
        setSalaryContractType(matchedPastSalary.contractType);
      }
      if (matchedPastSalary?.isOnlineStaff !== undefined) {
        setSalaryIsOnlineStaff(Boolean(matchedPastSalary.isOnlineStaff));
      }
      if (matchedPastSalary?.onlineSupportAllowance) {
        setSalaryOnlineSupportInput(String(matchedPastSalary.onlineSupportAllowance));
      }
    }
  };

  // State cho thanh nhập nhanh nhân viên mới ở Bảng Lương (không bị che)
  const [quickSalaryName, setQuickSalaryName] = useState('');

  // ==========================================
  // STATE CHO MODAL BẢNG CHI PHÍ & CHI PHÍ NGOÀI Ý MUỐN
  // ==========================================
  const [isCustomExpenseModalOpen, setIsCustomExpenseModalOpen] = useState(false);
  const [editingExpenseItem, setEditingExpenseItem] = useState<CustomExpenseItem | null>(null);
  const [expenseName, setExpenseName] = useState('');
  const [expenseType, setExpenseType] = useState<ExpenseType>('unexpected'); // Mặc định: Ngoài ý muốn / Phát sinh
  const [expenseCategory, setExpenseCategory] = useState<'office' | 'utility' | 'tools' | 'proxy' | 'hardware' | 'unexpected' | 'other'>('unexpected');
  const [expenseAmountInput, setExpenseAmountInput] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [expensePayer, setExpensePayer] = useState('');
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<'transfer' | 'cash'>('transfer');
  const [expenseNote, setExpenseNote] = useState('');

  // Bộ lọc bảng chi phí hàng tháng
  const [expenseFilterType, setExpenseFilterType] = useState<'all' | 'unexpected' | 'fixed' | 'tools' | 'other'>('all');

  // Tìm bản ghi tháng hiện được chọn
  const activeMonthRecord = useMemo<MonthlyFinanceRecord>(() => {
    const found = finances.find((f) => f.monthKey === selectedMonthKey || f.id === selectedMonthKey);
    if (found) return found;

    // Nếu chưa có, tạo cấu trúc rỗng trắng hoàn toàn cho tháng này (Admin tự nhập từ đầu)
    const [yStr, mStr] = selectedMonthKey.split('-');
    const y = parseInt(yStr, 10) || currentYear;
    const m = parseInt(mStr, 10) || currentMonthNum;

    return {
      id: selectedMonthKey,
      monthKey: selectedMonthKey,
      month: m,
      year: y,
      title: `Tháng ${String(m).padStart(2, '0')}/${y}`,
      revenueItems: [],
      totalRevenue: 0,
      officeCost: 0,
      officeCostNote: '',
      electricityCost: 0,
      electricityCostNote: '',
      waterCost: 0,
      waterCostNote: '',
      internetCost: 0,
      internetCostNote: '',
      otherCosts: 0,
      otherCostsNote: '',
      customExpenses: [],
      salaryItems: [],
      totalSalary: 0,
      totalExpenses: 0,
      netProfit: 0,
      profitMargin: 0,
      status: 'break_even',
      adminSummaryNote: '',
    };
  }, [finances, selectedMonthKey, currentYear, currentMonthNum]);

  // Working state copy để Admin chỉnh sửa trực tiếp các chi phí văn phòng/điện/nước
  const [workingOfficeCost, setWorkingOfficeCost] = useState<number>(activeMonthRecord.officeCost || 0);
  const [workingOfficeNote, setWorkingOfficeNote] = useState<string>(activeMonthRecord.officeCostNote || '');
  const [workingElectricityCost, setWorkingElectricityCost] = useState<number>(activeMonthRecord.electricityCost || 0);
  const [workingElectricityNote, setWorkingElectricityNote] = useState<string>(activeMonthRecord.electricityCostNote || '');
  const [workingWaterCost, setWorkingWaterCost] = useState<number>(activeMonthRecord.waterCost || 0);
  const [workingWaterNote, setWorkingWaterNote] = useState<string>(activeMonthRecord.waterCostNote || '');
  const [workingInternetCost, setWorkingInternetCost] = useState<number>(activeMonthRecord.internetCost || 0);
  const [workingInternetNote, setWorkingInternetNote] = useState<string>(activeMonthRecord.internetCostNote || '');
  const [workingOtherCosts, setWorkingOtherCosts] = useState<number>(activeMonthRecord.otherCosts || 0);
  const [workingOtherNote, setWorkingOtherNote] = useState<string>(activeMonthRecord.otherCostsNote || '');
  const [workingAdminSummary, setWorkingAdminSummary] = useState<string>(activeMonthRecord.adminSummaryNote || '');

  // Cập nhật working states khi activeMonthRecord thay đổi
  useEffect(() => {
    setWorkingOfficeCost(activeMonthRecord.officeCost || 0);
    setWorkingOfficeNote(activeMonthRecord.officeCostNote || '');
    setWorkingElectricityCost(activeMonthRecord.electricityCost || 0);
    setWorkingElectricityNote(activeMonthRecord.electricityCostNote || '');
    setWorkingWaterCost(activeMonthRecord.waterCost || 0);
    setWorkingWaterNote(activeMonthRecord.waterCostNote || '');
    setWorkingInternetCost(activeMonthRecord.internetCost || 0);
    setWorkingInternetNote(activeMonthRecord.internetCostNote || '');
    setWorkingOtherCosts(activeMonthRecord.otherCosts || 0);
    setWorkingOtherNote(activeMonthRecord.otherCostsNote || '');
    setWorkingAdminSummary(activeMonthRecord.adminSummaryNote || '');
  }, [activeMonthRecord]);

  // ==========================================
  // TÍNH TOÁN THỜI GIAN THỰC (REAL-TIME COMPUTED STATS):
  // ==========================================

  // 1. Tổng doanh thu = Tổng các khoản thu trong revenueItems
  const computedTotalRevenue = useMemo(() => {
    if (activeMonthRecord.revenueItems && activeMonthRecord.revenueItems.length > 0) {
      return activeMonthRecord.revenueItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    }
    return activeMonthRecord.manualTotalRevenue || 0;
  }, [activeMonthRecord.revenueItems, activeMonthRecord.manualTotalRevenue]);

  // 2. Tổng lương = Tổng actualSalary của các nhân viên
  const computedTotalSalary = useMemo(() => {
    if (!activeMonthRecord.salaryItems) return 0;
    return activeMonthRecord.salaryItems.reduce((sum, item) => sum + (Number(item.actualSalary) || 0), 0);
  }, [activeMonthRecord.salaryItems]);

  // Tổng thưởng KPI doanh thu cho nhân viên
  const computedTotalKpiBonus = useMemo(() => {
    if (!activeMonthRecord.salaryItems) return 0;
    return activeMonthRecord.salaryItems.reduce((sum, item) => sum + (Number(item.kpiBonus) || 0), 0);
  }, [activeMonthRecord.salaryItems]);

  // Tổng tiền phụ cấp hỗ trợ mạng, điện cho nhân viên làm online (Yêu cầu 5)
  const computedTotalOnlineSupport = useMemo(() => {
    if (!activeMonthRecord.salaryItems) return 0;
    return activeMonthRecord.salaryItems.reduce((sum, item) => sum + (Number(item.onlineSupportAllowance) || 0), 0);
  }, [activeMonthRecord.salaryItems]);

  // 3. Phân loại & Tổng chi phí trong bảng chi phí hàng tháng
  const computedUnexpectedExpenses = useMemo(() => {
    if (!activeMonthRecord.customExpenses) return 0;
    return activeMonthRecord.customExpenses
      .filter((e) => e.expenseType === 'unexpected')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [activeMonthRecord.customExpenses]);

  const computedFixedCustomExpenses = useMemo(() => {
    if (!activeMonthRecord.customExpenses) return 0;
    return activeMonthRecord.customExpenses
      .filter((e) => e.expenseType === 'fixed')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [activeMonthRecord.customExpenses]);

  const computedTotalCustomExpenses = useMemo(() => {
    if (!activeMonthRecord.customExpenses) return 0;
    return activeMonthRecord.customExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [activeMonthRecord.customExpenses]);

  // 4. Chi phí cố định toàn diện = Văn phòng + Điện + Nước + Mạng Internet + Các khoản cố định tự thêm
  const computedTotalFixedCosts = useMemo(() => {
    return (
      (Number(workingOfficeCost) || 0) +
      (Number(workingElectricityCost) || 0) +
      (Number(workingWaterCost) || 0) +
      (Number(workingInternetCost) || 0) +
      computedFixedCustomExpenses
    );
  }, [workingOfficeCost, workingElectricityCost, workingWaterCost, workingInternetCost, computedFixedCustomExpenses]);

  // Chi phí cố định cơ bản (VP + Điện + Nước)
  const computedFixedUtilityCost = useMemo(() => {
    return (Number(workingOfficeCost) || 0) + (Number(workingElectricityCost) || 0) + (Number(workingWaterCost) || 0);
  }, [workingOfficeCost, workingElectricityCost, workingWaterCost]);

  // Chi phí phát sinh & ngoài ý muốn = Chi phí ngoài ý muốn + Công cụ/Tool/Khác + Chi phí phát sinh khác
  const computedTotalUnexpectedCosts = useMemo(() => {
    const toolsAndOther = (activeMonthRecord.customExpenses || [])
      .filter((e) => e.expenseType === 'tools' || e.expenseType === 'other')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    return computedUnexpectedExpenses + toolsAndOther + (Number(workingOtherCosts) || 0);
  }, [activeMonthRecord.customExpenses, computedUnexpectedExpenses, workingOtherCosts]);

  // 5. Tổng chi phí phải chi trong tháng (Yêu cầu 4: Tổng Lương & KPI + Chi Phí Cố Định + Chi Phí Phát Sinh Ngoài Ý Muốn)
  const computedTotalExpenses = useMemo(() => {
    return (
      computedTotalSalary +
      computedTotalFixedCosts +
      computedTotalUnexpectedCosts
    );
  }, [
    computedTotalSalary,
    computedTotalFixedCosts,
    computedTotalUnexpectedCosts,
  ]);

  // 6. Lợi nhuận ròng = Tổng thu tiền về (Doanh thu) - Tất cả chi phí lương, KPI và chi phí phát sinh, cố định (Yêu cầu 4)
  const computedNetProfit = useMemo(() => {
    return computedTotalRevenue - computedTotalExpenses;
  }, [computedTotalRevenue, computedTotalExpenses]);

  // 7. Tỷ suất lợi nhuận (%)
  const computedProfitMargin = useMemo(() => {
    if (computedTotalRevenue <= 0) return 0;
    return Math.round((computedNetProfit / computedTotalRevenue) * 1000) / 10;
  }, [computedTotalRevenue, computedNetProfit]);

  // Trạng thái lãi / lỗ
  const profitStatus = computedNetProfit > 0 ? 'profitable' : computedNetProfit === 0 ? 'break_even' : 'loss';

  // Lọc danh sách chi phí hàng tháng
  const filteredCustomExpenses = useMemo(() => {
    const list = activeMonthRecord.customExpenses || [];
    if (expenseFilterType === 'all') return list;
    return list.filter((item) => (item.expenseType || 'unexpected') === expenseFilterType);
  }, [activeMonthRecord.customExpenses, expenseFilterType]);

  // ==========================================
  // THỐNG KÊ DOANH THU & SO SÁNH TĂNG GIẢM CÁC THÁNG (MoM ANALYTICS)
  // ==========================================
  const monthlyComparisonStats = useMemo(() => {
    const allRecordsMap = new Map<string, MonthlyFinanceRecord>();
    finances.forEach((f) => {
      const key = f.monthKey || f.id || `${f.year}-${String(f.month).padStart(2, '0')}`;
      allRecordsMap.set(key, f);
    });

    // Đảm bảo tháng đang chọn luôn có mặt với dữ liệu thời gian thực
    if (selectedMonthKey && !allRecordsMap.has(selectedMonthKey)) {
      allRecordsMap.set(selectedMonthKey, activeMonthRecord);
    }

    const recordsList = Array.from(allRecordsMap.values());

    // Sắp xếp theo thứ tự thời gian tăng dần (cũ nhất -> mới nhất)
    const sortedChronological = [...recordsList].sort((a, b) => {
      const keyA = a.monthKey || a.id || `${a.year}-${String(a.month).padStart(2, '0')}`;
      const keyB = b.monthKey || b.id || `${b.year}-${String(b.month).padStart(2, '0')}`;
      return keyA.localeCompare(keyB);
    });

    return sortedChronological.map((f, idx, arr) => {
      const mKey = f.monthKey || f.id || `${f.year}-${String(f.month).padStart(2, '0')}`;
      const isCurrent = mKey === selectedMonthKey;

      // Doanh thu
      const rev = isCurrent
        ? computedTotalRevenue
        : (f.revenueItems && f.revenueItems.length > 0)
        ? f.revenueItems.reduce((sum, it) => sum + (Number(it.amount) || 0), 0)
        : (f.totalRevenue || 0);

      // Chi phí lương & KPI
      const sal = isCurrent
        ? computedTotalSalary
        : (f.salaryItems && f.salaryItems.length > 0)
        ? f.salaryItems.reduce((sum, it) => sum + (Number(it.actualSalary) || 0), 0)
        : (f.totalSalary || 0);

      // Thưởng KPI
      const kpi = isCurrent
        ? computedTotalKpiBonus
        : (f.salaryItems || []).reduce((sum, it) => sum + (Number(it.kpiBonus) || 0), 0);

      // Phụ cấp mạng/điện online
      const onlineSup = isCurrent
        ? computedTotalOnlineSupport
        : (f.salaryItems || []).reduce((sum, it) => sum + (Number(it.onlineSupportAllowance) || 0), 0);

      // Chi phí cố định
      const fixed = isCurrent
        ? computedTotalFixedCosts
        : (Number(f.officeCost) || 0) +
          (Number(f.electricityCost) || 0) +
          (Number(f.waterCost) || 0) +
          (Number(f.internetCost) || 0) +
          (f.customExpenses || []).filter((e) => e.expenseType === 'fixed').reduce((s, e) => s + (Number(e.amount) || 0), 0);

      // Chi phí ngoài ý muốn & khác
      const unexp = isCurrent
        ? computedTotalUnexpectedCosts
        : (f.customExpenses || []).filter((e) => e.expenseType !== 'fixed').reduce((s, e) => s + (Number(e.amount) || 0), 0) + (Number(f.otherCosts) || 0);

      // Tổng chi phí
      const exp = isCurrent ? computedTotalExpenses : sal + fixed + unexp;

      // Lợi nhuận ròng
      const profit = isCurrent ? computedNetProfit : rev - exp;

      // Tỷ suất sinh lời
      const margin = rev > 0 ? Math.round((profit / rev) * 1000) / 10 : 0;

      // So sánh với tháng liền kề trước đó
      let prevRevenue = 0;
      let prevProfit = 0;
      let prevExpenses = 0;
      let prevMonthTitle = '';
      let diffRevenue = 0;
      let diffRevenuePercent = 0;
      let diffProfit = 0;
      let diffProfitPercent = 0;
      let diffExpenses = 0;
      let diffExpensesPercent = 0;
      let hasPrevious = false;

      if (idx > 0) {
        hasPrevious = true;
        const prevF = arr[idx - 1];
        const prevKey = prevF.monthKey || prevF.id || `${prevF.year}-${String(prevF.month).padStart(2, '0')}`;
        prevMonthTitle = prevF.title || `Tháng ${prevF.month}/${prevF.year}`;

        prevRevenue = prevKey === selectedMonthKey
          ? computedTotalRevenue
          : (prevF.revenueItems && prevF.revenueItems.length > 0)
          ? prevF.revenueItems.reduce((s, it) => s + (Number(it.amount) || 0), 0)
          : (prevF.totalRevenue || 0);

        const prevSal = prevKey === selectedMonthKey
          ? computedTotalSalary
          : (prevF.salaryItems && prevF.salaryItems.length > 0)
          ? prevF.salaryItems.reduce((s, it) => s + (Number(it.actualSalary) || 0), 0)
          : (prevF.totalSalary || 0);

        const prevFixed = prevKey === selectedMonthKey
          ? computedTotalFixedCosts
          : (Number(prevF.officeCost) || 0) +
            (Number(prevF.electricityCost) || 0) +
            (Number(prevF.waterCost) || 0) +
            (Number(prevF.internetCost) || 0) +
            (prevF.customExpenses || []).filter((e) => e.expenseType === 'fixed').reduce((s, e) => s + (Number(e.amount) || 0), 0);

        const prevUnexp = prevKey === selectedMonthKey
          ? computedTotalUnexpectedCosts
          : (prevF.customExpenses || []).filter((e) => e.expenseType !== 'fixed').reduce((s, e) => s + (Number(e.amount) || 0), 0) + (Number(prevF.otherCosts) || 0);

        prevExpenses = prevKey === selectedMonthKey ? computedTotalExpenses : prevSal + prevFixed + prevUnexp;
        prevProfit = prevKey === selectedMonthKey ? computedNetProfit : prevRevenue - prevExpenses;

        diffRevenue = rev - prevRevenue;
        diffRevenuePercent = prevRevenue > 0
          ? Math.round(((rev - prevRevenue) / prevRevenue) * 1000) / 10
          : rev > 0 ? 100 : 0;

        diffProfit = profit - prevProfit;
        diffProfitPercent = prevProfit !== 0
          ? Math.round(((profit - prevProfit) / Math.abs(prevProfit)) * 1000) / 10
          : 0;

        diffExpenses = exp - prevExpenses;
        diffExpensesPercent = prevExpenses > 0
          ? Math.round(((exp - prevExpenses) / prevExpenses) * 1000) / 10
          : 0;
      }

      const revenueTrend: 'up' | 'down' | 'equal' | 'first' = !hasPrevious
        ? 'first'
        : diffRevenue > 0
        ? 'up'
        : diffRevenue < 0
        ? 'down'
        : 'equal';

      const profitTrend: 'up' | 'down' | 'equal' | 'first' = !hasPrevious
        ? 'first'
        : diffProfit > 0
        ? 'up'
        : diffProfit < 0
        ? 'down'
        : 'equal';

      return {
        record: f,
        monthKey: mKey,
        month: f.month,
        year: f.year,
        title: f.title || `Tháng ${f.month}/${f.year}`,
        revenue: rev,
        salary: sal,
        kpiBonus: kpi,
        onlineSupport: onlineSup,
        fixedCost: fixed,
        unexpectedCost: unexp,
        totalExpenses: exp,
        netProfit: profit,
        profitMargin: margin,
        isCurrent,
        hasPrevious,
        prevMonthTitle,
        prevRevenue,
        diffRevenue,
        diffRevenuePercent,
        prevProfit,
        diffProfit,
        diffProfitPercent,
        prevExpenses,
        diffExpenses,
        diffExpensesPercent,
        revenueTrend,
        profitTrend,
      };
    });
  }, [
    finances,
    selectedMonthKey,
    activeMonthRecord,
    computedTotalRevenue,
    computedTotalSalary,
    computedTotalKpiBonus,
    computedTotalOnlineSupport,
    computedTotalFixedCosts,
    computedTotalUnexpectedCosts,
    computedTotalExpenses,
    computedNetProfit,
  ]);

  // Tổng hợp chỉ số thống kê phân tích doanh thu qua các tháng
  const revenueComparisonInsights = useMemo(() => {
    if (monthlyComparisonStats.length === 0) {
      return {
        maxRevenueMonth: null,
        minRevenueMonth: null,
        avgRevenue: 0,
        totalAllTimeRevenue: 0,
        totalAllTimeProfit: 0,
        bestGrowthMonth: null,
        bestGrowthPercentMonth: null,
        highestProfitMonth: null,
        upMonthsCount: 0,
        downMonthsCount: 0,
        growthCountWithPrev: 0,
        avgMoMGrowthPercent: 0,
        currentMonthStat: null,
        prevMonthStat: null,
      };
    }

    const totalAllTimeRevenue = monthlyComparisonStats.reduce((sum, it) => sum + it.revenue, 0);
    const totalAllTimeProfit = monthlyComparisonStats.reduce((sum, it) => sum + it.netProfit, 0);
    const avgRevenue = Math.round(totalAllTimeRevenue / monthlyComparisonStats.length);

    let maxRev = monthlyComparisonStats[0];
    let minRev = monthlyComparisonStats[0];
    let bestGrowthAmount = monthlyComparisonStats[0];
    let bestGrowthPercent = monthlyComparisonStats[0];
    let highestProfit = monthlyComparisonStats[0];
    let upMonthsCount = 0;
    let downMonthsCount = 0;
    let totalGrowthPercentSum = 0;
    let growthCountWithPrev = 0;

    monthlyComparisonStats.forEach((it) => {
      if (it.revenue > maxRev.revenue) maxRev = it;
      if (it.revenue < minRev.revenue) minRev = it;
      if (it.netProfit > highestProfit.netProfit) highestProfit = it;

      if (it.hasPrevious) {
        growthCountWithPrev += 1;
        totalGrowthPercentSum += it.diffRevenuePercent;
        if (it.diffRevenue > 0) upMonthsCount += 1;
        else if (it.diffRevenue < 0) downMonthsCount += 1;

        if (it.diffRevenue > (bestGrowthAmount?.diffRevenue || 0)) {
          bestGrowthAmount = it;
        }
        if (it.diffRevenuePercent > (bestGrowthPercent?.diffRevenuePercent || 0)) {
          bestGrowthPercent = it;
        }
      }
    });

    const avgMoMGrowthPercent = growthCountWithPrev > 0
      ? Math.round((totalGrowthPercentSum / growthCountWithPrev) * 10) / 10
      : 0;

    const currentIdx = monthlyComparisonStats.findIndex((it) => it.isCurrent);
    const currentMonthStat = currentIdx >= 0 ? monthlyComparisonStats[currentIdx] : monthlyComparisonStats[monthlyComparisonStats.length - 1];
    const prevMonthStat = currentIdx > 0 ? monthlyComparisonStats[currentIdx - 1] : null;

    return {
      maxRevenueMonth: maxRev,
      minRevenueMonth: minRev,
      avgRevenue,
      totalAllTimeRevenue,
      totalAllTimeProfit,
      bestGrowthMonth: bestGrowthAmount?.hasPrevious ? bestGrowthAmount : null,
      bestGrowthPercentMonth: bestGrowthPercent?.hasPrevious ? bestGrowthPercent : null,
      highestProfitMonth: highestProfit,
      upMonthsCount,
      downMonthsCount,
      growthCountWithPrev,
      avgMoMGrowthPercent,
      currentMonthStat,
      prevMonthStat,
    };
  }, [monthlyComparisonStats]);

  // Bộ so sánh đối chiếu trực tiếp giữa 2 tháng bất kỳ do người dùng chọn
  const directComparisonResult = useMemo(() => {
    if (monthlyComparisonStats.length < 2) return null;

    // Tháng mốc (Tháng A)
    const keyA = directCompareKeyA || selectedMonthKey || monthlyComparisonStats[monthlyComparisonStats.length - 1]?.monthKey;
    // Tháng đối chiếu (Tháng B)
    let keyB = directCompareKeyB;
    if (!keyB || keyB === keyA) {
      const other = monthlyComparisonStats.slice().reverse().find((m) => m.monthKey !== keyA);
      keyB = other ? other.monthKey : monthlyComparisonStats[0]?.monthKey;
    }

    const statA = monthlyComparisonStats.find((m) => m.monthKey === keyA) || monthlyComparisonStats[monthlyComparisonStats.length - 1];
    const statB = monthlyComparisonStats.find((m) => m.monthKey === keyB) || monthlyComparisonStats[0];

    if (!statA || !statB) return null;

    const diffRev = statA.revenue - statB.revenue;
    const diffRevPercent = statB.revenue > 0
      ? Math.round(((statA.revenue - statB.revenue) / statB.revenue) * 1000) / 10
      : (statA.revenue > 0 ? 100 : 0);

    const diffExp = statA.totalExpenses - statB.totalExpenses;
    const diffExpPercent = statB.totalExpenses > 0
      ? Math.round(((statA.totalExpenses - statB.totalExpenses) / statB.totalExpenses) * 1000) / 10
      : 0;

    const diffProfit = statA.netProfit - statB.netProfit;
    const diffProfitPercent = statB.netProfit !== 0
      ? Math.round(((statA.netProfit - statB.netProfit) / Math.abs(statB.netProfit)) * 1000) / 10
      : 0;

    const diffSalary = statA.salary - statB.salary;
    const diffKpi = statA.kpiBonus - statB.kpiBonus;
    const diffOnline = statA.onlineSupport - statB.onlineSupport;

    return {
      statA,
      statB,
      keyA,
      keyB,
      diffRev,
      diffRevPercent,
      diffExp,
      diffExpPercent,
      diffProfit,
      diffProfitPercent,
      diffSalary,
      diffKpi,
      diffOnline,
    };
  }, [monthlyComparisonStats, directCompareKeyA, directCompareKeyB, selectedMonthKey]);

  // LƯU TOÀN BỘ BẢN GHI THÁNG LÊN CLOUD FIRESTORE
  const handleSaveMonth = async () => {
    setIsSaving(true);
    setSaveSuccessMsg(null);
    try {
      const updatedRecord: MonthlyFinanceRecord = {
        ...activeMonthRecord,
        id: selectedMonthKey,
        monthKey: selectedMonthKey,
        totalRevenue: computedTotalRevenue,
        officeCost: Number(workingOfficeCost) || 0,
        officeCostNote: workingOfficeNote,
        electricityCost: Number(workingElectricityCost) || 0,
        electricityCostNote: workingElectricityNote,
        waterCost: Number(workingWaterCost) || 0,
        waterCostNote: workingWaterNote,
        internetCost: Number(workingInternetCost) || 0,
        internetCostNote: workingInternetNote,
        otherCosts: Number(workingOtherCosts) || 0,
        otherCostsNote: workingOtherNote,
        totalSalary: computedTotalSalary,
        totalExpenses: computedTotalExpenses,
        netProfit: computedNetProfit,
        profitMargin: computedProfitMargin,
        status: profitStatus,
        adminSummaryNote: workingAdminSummary,
        updatedAt: new Date().toLocaleString('vi-VN'),
        updatedBy: currentUser.name || 'Admin',
      };

      await onSaveMonthlyFinance(updatedRecord);
      setSaveSuccessMsg(`Đã lưu thành công dữ liệu tài chính ${updatedRecord.title || selectedMonthKey}!`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Lỗi khi lưu tài chính tháng:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // --- XỬ LÝ DOANH THU (REVENUE ITEMS) ---
  const handleOpenAddRevenue = () => {
    setEditingRevenueItem(null);
    setRevenueSourceName('');
    setRevenueAmountInput('');
    setRevenuePayer('');
    setRevenueDate(new Date().toLocaleDateString('vi-VN'));
    setRevenueNote('');
    setIsRevenueModalOpen(true);
  };

  const handleOpenEditRevenue = (item: RevenueItem) => {
    setEditingRevenueItem(item);
    setRevenueSourceName(item.sourceName || '');
    setRevenueAmountInput(String(item.amount || ''));
    setRevenuePayer(item.payerName || '');
    setRevenueDate(item.receivedDate || '');
    setRevenueNote(item.note || '');
    setIsRevenueModalOpen(true);
  };

  const handleSaveRevenueItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseNumberInput(revenueAmountInput);
    if (!revenueSourceName.trim() || amount <= 0) {
      alert('Vui lòng nhập tên nguồn thu và số tiền hợp lệ (> 0 VNĐ)!');
      return;
    }

    let updatedItems: RevenueItem[] = [];
    if (editingRevenueItem) {
      updatedItems = (activeMonthRecord.revenueItems || []).map((item) =>
        item.id === editingRevenueItem.id
          ? {
              ...item,
              sourceName: revenueSourceName.trim(),
              amount,
              payerName: revenuePayer.trim(),
              receivedDate: revenueDate.trim() || new Date().toLocaleDateString('vi-VN'),
              note: revenueNote.trim(),
            }
          : item
      );
    } else {
      const newItem: RevenueItem = {
        id: `rev-${Date.now()}`,
        sourceName: revenueSourceName.trim(),
        amount,
        payerName: revenuePayer.trim(),
        receivedDate: revenueDate.trim() || new Date().toLocaleDateString('vi-VN'),
        note: revenueNote.trim(),
        createdAt: new Date().toISOString(),
      };
      updatedItems = [...(activeMonthRecord.revenueItems || []), newItem];
    }

    const newTotalRev = updatedItems.reduce((acc, it) => acc + (it.amount || 0), 0);
    const newNetProfit = newTotalRev - computedTotalExpenses;

    const updatedRecord: MonthlyFinanceRecord = {
      ...activeMonthRecord,
      revenueItems: updatedItems,
      totalRevenue: newTotalRev,
      netProfit: newNetProfit,
      profitMargin: newTotalRev > 0 ? Math.round((newNetProfit / newTotalRev) * 1000) / 10 : 0,
      updatedAt: new Date().toLocaleString('vi-VN'),
      updatedBy: currentUser.name || 'Admin',
    };

    setIsRevenueModalOpen(false);
    await onSaveMonthlyFinance(updatedRecord);
  };

  const handleDeleteRevenueItem = async (itemId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa khoản thu này?')) return;
    const updatedItems = (activeMonthRecord.revenueItems || []).filter((it) => it.id !== itemId);
    const newTotalRev = updatedItems.reduce((acc, it) => acc + (it.amount || 0), 0);
    const newNetProfit = newTotalRev - computedTotalExpenses;

    const updatedRecord: MonthlyFinanceRecord = {
      ...activeMonthRecord,
      revenueItems: updatedItems,
      totalRevenue: newTotalRev,
      netProfit: newNetProfit,
      profitMargin: newTotalRev > 0 ? Math.round((newNetProfit / newTotalRev) * 1000) / 10 : 0,
      updatedAt: new Date().toLocaleString('vi-VN'),
      updatedBy: currentUser.name || 'Admin',
    };
    await onSaveMonthlyFinance(updatedRecord);
  };

  // ==========================================
  // XỬ LÝ BẢNG LƯƠNG NHÂN VIÊN (SALARY ITEMS)
  // Có Lương Thử Việc, Lương Chính Thức, Ngày Công Đi Làm Thực Tế,
  // Cột Tài Khoản Ngân Hàng, và Thưởng KPI Tiền Về 5% / 10% Doanh Thu
  // ==========================================
  const handleOpenAddSalary = (defaultStaff?: string) => {
    setEditingSalaryItem(null);
    const initialName = defaultStaff || availableStaffNames[0] || '';
    setSalaryStaffName(initialName);
    setSalaryDateOfBirth('');
    setSalaryCitizenId('');
    setSalaryStartDate('');
    setSalaryContractType('official');
    setSalaryOfficialInput('');
    setSalaryProbationInput('');
    setSalaryStandardDays(26);
    setSalaryActualDaysInput('26');
    setSalaryBankName('');
    setSalaryBankAccountNumber('');
    setSalaryBankAccountHolder('');
    setSalaryRevenueGeneratedInput('');
    setSalaryRevenueSourceName('');
    setSalaryKpiRate(10);
    setSalaryIsOnlineStaff(false);
    setSalaryOnlineSupportInput('0');
    setSalaryOtherBonusInput('0');
    setSalaryDeductionInput('0');
    setSalaryIsPaid(false);
    setSalaryPaidDate('');
    setSalaryNote('');
    setSalaryIsVisibleToStaff(false);
    setSalaryIsProfileVisibleToStaff(true);

    if (initialName) {
      handleStaffNameChange(initialName);
    }
    setIsSalaryModalOpen(true);
  };

  const handleOpenEditSalary = (item: StaffSalaryItem) => {
    setEditingSalaryItem(item);
    setSalaryStaffName(item.staffName || '');
    setSalaryDateOfBirth(item.dateOfBirth || '');
    setSalaryCitizenId(item.citizenId || '');
    setSalaryStartDate(item.startDate || '');
    setSalaryContractType(item.contractType || 'official');
    setSalaryOfficialInput(item.officialSalary ? String(item.officialSalary) : item.baseSalary ? String(item.baseSalary) : '');
    setSalaryProbationInput(item.probationSalary ? String(item.probationSalary) : '');
    setSalaryStandardDays(item.standardWorkingDays || 26);
    setSalaryActualDaysInput(String(item.actualWorkingDays ?? 26));
    setSalaryBankName(item.bankName || '');
    setSalaryBankAccountNumber(item.bankAccountNumber || '');
    setSalaryBankAccountHolder(item.bankAccountHolder || '');
    setSalaryRevenueGeneratedInput(item.revenueGenerated ? String(item.revenueGenerated) : '');
    setSalaryRevenueSourceName(item.revenueSourceName || '');
    setSalaryKpiRate(item.kpiRate ?? 10);
    setSalaryIsOnlineStaff(Boolean(item.isOnlineStaff));
    setSalaryOnlineSupportInput(item.onlineSupportAllowance ? String(item.onlineSupportAllowance) : '0');
    setSalaryOtherBonusInput(String(item.otherBonus || 0));
    setSalaryDeductionInput(String(item.deduction || 0));
    setSalaryIsPaid(item.isPaid || false);
    setSalaryPaidDate(item.paidDate || '');
    setSalaryNote(item.note || '');
    setSalaryIsVisibleToStaff(Boolean(item.isVisibleToStaff));
    setSalaryIsProfileVisibleToStaff(item.isProfileVisibleToStaff !== false);
    setIsSalaryModalOpen(true);
  };

  // Tính nháp số tiền trong modal lương
  const previewSalaryCalculation = useMemo(() => {
    const probation = parseNumberInput(salaryProbationInput);
    const official = parseNumberInput(salaryOfficialInput);
    const chosenBase = salaryContractType === 'probation' ? probation : official;

    const stdDays = Math.max(1, salaryStandardDays || 26);
    const actualDays = parseFloat(salaryActualDaysInput) || 0;

    // Lương theo ngày công thực tế
    const salaryByDays = Math.round((chosenBase / stdDays) * actualDays);

    // Thưởng KPI tiền về (5% hoặc 10% doanh thu nhân viên đó làm được)
    const revGen = parseNumberInput(salaryRevenueGeneratedInput);
    const kpiBonusAmount = Math.round(revGen * (salaryKpiRate / 100));

    // Phụ cấp hỗ trợ mạng, điện cho nhân viên làm online (Yêu cầu 5: cộng vào lương thực nhận cho NV online)
    const onlineSupportAmount = parseNumberInput(salaryOnlineSupportInput);

    const otherBonus = parseNumberInput(salaryOtherBonusInput);
    const deduction = parseNumberInput(salaryDeductionInput);

    const totalActual = Math.max(0, salaryByDays + kpiBonusAmount + onlineSupportAmount + otherBonus - deduction);

    return {
      chosenBase,
      stdDays,
      actualDays,
      salaryByDays,
      revGen,
      kpiBonusAmount,
      onlineSupportAmount,
      otherBonus,
      deduction,
      totalActual,
    };
  }, [
    salaryContractType,
    salaryProbationInput,
    salaryOfficialInput,
    salaryStandardDays,
    salaryActualDaysInput,
    salaryRevenueGeneratedInput,
    salaryKpiRate,
    salaryOnlineSupportInput,
    salaryIsOnlineStaff,
    salaryOtherBonusInput,
    salaryDeductionInput,
  ]);

  const handleSaveSalaryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salaryStaffName.trim()) {
      alert('Vui lòng chọn hoặc nhập tên nhân viên!');
      return;
    }

    const {
      chosenBase,
      stdDays,
      actualDays,
      salaryByDays,
      revGen,
      kpiBonusAmount,
      onlineSupportAmount,
      otherBonus,
      deduction,
      totalActual,
    } = previewSalaryCalculation;

    const probation = parseNumberInput(salaryProbationInput);
    const official = parseNumberInput(salaryOfficialInput);

    const matchedAcc = accounts.find(
      (a) => a.role === 'staff' && isSameStaffIdentity(salaryStaffName.trim(), a.username, a, editingSalaryItem)
    );

    let updatedItems: StaffSalaryItem[] = [];
    if (editingSalaryItem) {
      updatedItems = (activeMonthRecord.salaryItems || []).map((item) =>
        item.id === editingSalaryItem.id
          ? {
              ...item,
              staffName: salaryStaffName.trim(),
              accountUsername: matchedAcc?.username || item.accountUsername,
              dateOfBirth: salaryDateOfBirth.trim(),
              citizenId: salaryCitizenId.trim(),
              startDate: salaryStartDate.trim(),
              contractType: salaryContractType,
              probationSalary: probation,
              officialSalary: official,
              baseSalary: chosenBase,
              standardWorkingDays: stdDays,
              actualWorkingDays: actualDays,
              salaryByWorkingDays: salaryByDays,
              bankName: salaryBankName.trim(),
              bankAccountNumber: salaryBankAccountNumber.trim(),
              bankAccountHolder: salaryBankAccountHolder.trim().toUpperCase(),
              revenueGenerated: revGen,
              revenueSourceName: salaryRevenueSourceName.trim(),
              kpiRate: salaryKpiRate,
              kpiBonus: kpiBonusAmount,
              isOnlineStaff: salaryIsOnlineStaff,
              onlineSupportAllowance: onlineSupportAmount,
              otherBonus,
              deduction,
              actualSalary: totalActual,
              isVisibleToStaff: salaryIsVisibleToStaff,
              isProfileVisibleToStaff: salaryIsProfileVisibleToStaff,
              isPaid: salaryIsPaid,
              paidDate: salaryIsPaid ? (salaryPaidDate.trim() || new Date().toLocaleDateString('vi-VN')) : '',
              note: salaryNote.trim(),
            }
          : item
      );
    } else {
      const newItem: StaffSalaryItem = {
        id: `sal-${Date.now()}`,
        staffName: salaryStaffName.trim(),
        accountUsername: matchedAcc?.username,
        dateOfBirth: salaryDateOfBirth.trim(),
        citizenId: salaryCitizenId.trim(),
        startDate: salaryStartDate.trim(),
        contractType: salaryContractType,
        probationSalary: probation,
        officialSalary: official,
        baseSalary: chosenBase,
        standardWorkingDays: stdDays,
        actualWorkingDays: actualDays,
        salaryByWorkingDays: salaryByDays,
        bankName: salaryBankName.trim(),
        bankAccountNumber: salaryBankAccountNumber.trim(),
        bankAccountHolder: salaryBankAccountHolder.trim().toUpperCase(),
        revenueGenerated: revGen,
        revenueSourceName: salaryRevenueSourceName.trim(),
        kpiRate: salaryKpiRate,
        kpiBonus: kpiBonusAmount,
        isOnlineStaff: salaryIsOnlineStaff,
        onlineSupportAllowance: onlineSupportAmount,
        otherBonus,
        deduction,
        actualSalary: totalActual,
        isVisibleToStaff: salaryIsVisibleToStaff,
        isProfileVisibleToStaff: salaryIsProfileVisibleToStaff,
        isPaid: salaryIsPaid,
        paidDate: salaryIsPaid ? (salaryPaidDate.trim() || new Date().toLocaleDateString('vi-VN')) : '',
        note: salaryNote.trim(),
      };
      updatedItems = [...(activeMonthRecord.salaryItems || []), newItem];
    }

    // Đồng bộ trực tiếp thông tin Hồ Sơ Nhân Sự sang tài khoản nhân viên để nhân viên xem được ngay ở Bảng 8
    if (matchedAcc && onUpdateAccount) {
      await onUpdateAccount(matchedAcc.id, {
        fullName: salaryStaffName.trim(),
        contractType: salaryContractType,
        dateOfBirth: salaryDateOfBirth.trim(),
        citizenId: salaryCitizenId.trim(),
        startDate: salaryStartDate.trim(),
        bankName: salaryBankName.trim(),
        bankAccountNumber: salaryBankAccountNumber.trim(),
        bankAccountHolder: salaryBankAccountHolder.trim().toUpperCase(),
        isProfileVisibleToStaff: salaryIsProfileVisibleToStaff,
      });
    }

    const newTotalSalary = updatedItems.reduce((acc, it) => acc + (it.actualSalary || 0), 0);
    const newTotalExp =
      (Number(workingOfficeCost) || 0) +
      (Number(workingElectricityCost) || 0) +
      (Number(workingWaterCost) || 0) +
      (Number(workingInternetCost) || 0) +
      (Number(workingOtherCosts) || 0) +
      newTotalSalary +
      computedTotalCustomExpenses;
    const newNetProfit = computedTotalRevenue - newTotalExp;

    const updatedRecord: MonthlyFinanceRecord = {
      ...activeMonthRecord,
      salaryItems: updatedItems,
      totalSalary: newTotalSalary,
      totalExpenses: newTotalExp,
      netProfit: newNetProfit,
      profitMargin: computedTotalRevenue > 0 ? Math.round((newNetProfit / computedTotalRevenue) * 1000) / 10 : 0,
      updatedAt: new Date().toLocaleString('vi-VN'),
      updatedBy: currentUser.name || 'Admin',
    };

    setIsSalaryModalOpen(false);
    await onSaveMonthlyFinance(updatedRecord);
  };

  const handleTogglePaidSalary = async (salaryId: string) => {
    const updatedItems = (activeMonthRecord.salaryItems || []).map((item) => {
      if (item.id === salaryId) {
        const nextPaid = !item.isPaid;
        return {
          ...item,
          isPaid: nextPaid,
          paidDate: nextPaid ? new Date().toLocaleDateString('vi-VN') : '',
        };
      }
      return item;
    });

    const updatedRecord: MonthlyFinanceRecord = {
      ...activeMonthRecord,
      salaryItems: updatedItems,
      updatedAt: new Date().toLocaleString('vi-VN'),
      updatedBy: currentUser.name || 'Admin',
    };
    await onSaveMonthlyFinance(updatedRecord);
  };

  // Bật/tắt quyền hiển thị Hồ Sơ Nhân Sự (Họ tên, Ngày sinh, CCCD, Ngày đi làm, STK) ở Bảng 8 cho nhân viên xem luôn
  const handleToggleProfileVisibility = async (salaryId: string) => {
    let targetItem: StaffSalaryItem | undefined;
    const updatedItems = (activeMonthRecord.salaryItems || []).map((item) => {
      if (item.id === salaryId) {
        const nextProfileVis = item.isProfileVisibleToStaff === false ? true : false;
        const nextItem = {
          ...item,
          isProfileVisibleToStaff: nextProfileVis,
        };
        targetItem = nextItem;
        return nextItem;
      }
      return item;
    });

    if (targetItem && onUpdateAccount) {
      const matchedAcc = accounts.find(
        (a) => a.role === 'staff' && isSameStaffIdentity(targetItem!.staffName, a.username, a, targetItem)
      );
      if (matchedAcc) {
        await onUpdateAccount(matchedAcc.id, {
          fullName: targetItem.staffName,
          contractType: targetItem.contractType || 'official',
          dateOfBirth: targetItem.dateOfBirth || '',
          citizenId: targetItem.citizenId || '',
          startDate: targetItem.startDate || '',
          bankName: targetItem.bankName || '',
          bankAccountNumber: targetItem.bankAccountNumber || '',
          bankAccountHolder: targetItem.bankAccountHolder || targetItem.staffName,
          isProfileVisibleToStaff: targetItem.isProfileVisibleToStaff,
        });
      }
    }

    const updatedRecord: MonthlyFinanceRecord = {
      ...activeMonthRecord,
      salaryItems: updatedItems,
      updatedAt: new Date().toLocaleString('vi-VN'),
      updatedBy: currentUser.name || 'Admin',
    };
    await onSaveMonthlyFinance(updatedRecord);
  };

  // Bật/tắt quyền hiển thị bảng lương & doanh thu cho nhân viên (Yêu cầu mới)
  const handleToggleSalaryVisibility = async (salaryId: string) => {
    let targetItem: StaffSalaryItem | undefined;
    const updatedItems = (activeMonthRecord.salaryItems || []).map((item) => {
      if (item.id === salaryId) {
        const nextVis = !item.isVisibleToStaff;
        const nextItem = {
          ...item,
          isVisibleToStaff: nextVis,
          isProfileVisibleToStaff: nextVis ? true : item.isProfileVisibleToStaff !== false,
        };
        targetItem = nextItem;
        return nextItem;
      }
      return item;
    });

    if (targetItem && onUpdateAccount) {
      const matchedAcc = accounts.find(
        (a) => a.role === 'staff' && isSameStaffIdentity(targetItem!.staffName, a.username, a, targetItem)
      );
      if (matchedAcc) {
        await onUpdateAccount(matchedAcc.id, {
          fullName: targetItem.staffName,
          contractType: targetItem.contractType || 'official',
          dateOfBirth: targetItem.dateOfBirth || '',
          citizenId: targetItem.citizenId || '',
          startDate: targetItem.startDate || '',
          bankName: targetItem.bankName || '',
          bankAccountNumber: targetItem.bankAccountNumber || '',
          bankAccountHolder: targetItem.bankAccountHolder || targetItem.staffName,
          isProfileVisibleToStaff: true,
        });
      }
    }

    const updatedRecord: MonthlyFinanceRecord = {
      ...activeMonthRecord,
      salaryItems: updatedItems,
      updatedAt: new Date().toLocaleString('vi-VN'),
      updatedBy: currentUser.name || 'Admin',
    };
    await onSaveMonthlyFinance(updatedRecord);
  };

  // Tích hiện hoặc ẩn toàn bộ bảng lương cho nhân viên tháng này
  const handleToggleAllSalariesVisibility = async (visible: boolean) => {
    const updatedItems = (activeMonthRecord.salaryItems || []).map((item) => ({
      ...item,
      isVisibleToStaff: visible,
      isProfileVisibleToStaff: visible ? true : item.isProfileVisibleToStaff !== false,
    }));

    if (visible && onUpdateAccount) {
      for (const item of updatedItems) {
        const matchedAcc = accounts.find(
          (a) => a.role === 'staff' && isSameStaffIdentity(item.staffName, a.username, a, item)
        );
        if (matchedAcc) {
          await onUpdateAccount(matchedAcc.id, {
            fullName: item.staffName,
            contractType: item.contractType || 'official',
            dateOfBirth: item.dateOfBirth || '',
            citizenId: item.citizenId || '',
            startDate: item.startDate || '',
            bankName: item.bankName || '',
            bankAccountNumber: item.bankAccountNumber || '',
            bankAccountHolder: item.bankAccountHolder || item.staffName,
            isProfileVisibleToStaff: true,
          });
        }
      }
    }

    const updatedRecord: MonthlyFinanceRecord = {
      ...activeMonthRecord,
      salaryItems: updatedItems,
      updatedAt: new Date().toLocaleString('vi-VN'),
      updatedBy: currentUser.name || 'Admin',
    };
    await onSaveMonthlyFinance(updatedRecord);
  };

  const handleDeleteSalaryItem = async (salaryId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa nhân viên này khỏi bảng lương?')) return;
    const updatedItems = (activeMonthRecord.salaryItems || []).filter((it) => it.id !== salaryId);
    const newTotalSalary = updatedItems.reduce((acc, it) => acc + (it.actualSalary || 0), 0);
    const newTotalExp =
      (Number(workingOfficeCost) || 0) +
      (Number(workingElectricityCost) || 0) +
      (Number(workingWaterCost) || 0) +
      (Number(workingInternetCost) || 0) +
      (Number(workingOtherCosts) || 0) +
      newTotalSalary +
      computedTotalCustomExpenses;
    const newNetProfit = computedTotalRevenue - newTotalExp;

    const updatedRecord: MonthlyFinanceRecord = {
      ...activeMonthRecord,
      salaryItems: updatedItems,
      totalSalary: newTotalSalary,
      totalExpenses: newTotalExp,
      netProfit: newNetProfit,
      profitMargin: computedTotalRevenue > 0 ? Math.round((newNetProfit / computedTotalRevenue) * 1000) / 10 : 0,
      updatedAt: new Date().toLocaleString('vi-VN'),
      updatedBy: currentUser.name || 'Admin',
    };
    await onSaveMonthlyFinance(updatedRecord);
  };

  // Đồng bộ nhanh tất cả nhân sự đang có vào bảng lương
  const handleSyncAllStaffIntoSalary = async () => {
    const existingNames = new Set((activeMonthRecord.salaryItems || []).map((s) => s.staffName.trim().toLowerCase()));
    const missingStaff = availableStaffNames.filter(
      (name) => name.trim() && !existingNames.has(name.trim().toLowerCase()) && name.trim().toLowerCase() !== 'quản lý (admin)'
    );

    if (missingStaff.length === 0) {
      alert('Tất cả nhân viên trong hệ thống đã có trong bảng lương tháng này!');
      return;
    }

    const newSalaryItems: StaffSalaryItem[] = [
      ...(activeMonthRecord.salaryItems || []),
      ...missingStaff.map((st, i) => {
        const trimmed = st.trim().toLowerCase();
        const acc = accounts.find((a) => a.username.trim().toLowerCase() === trimmed);
        let pastSal: StaffSalaryItem | undefined;
        for (const fin of finances) {
          const found = fin.salaryItems?.find((s) => s.staffName.trim().toLowerCase() === trimmed);
          if (found) {
            pastSal = found;
            break;
          }
        }

        return {
          id: `sal-sync-${Date.now()}-${i}`,
          staffName: st,
          dateOfBirth: acc?.dateOfBirth || pastSal?.dateOfBirth || '',
          citizenId: acc?.citizenId || pastSal?.citizenId || '',
          startDate: acc?.startDate || pastSal?.startDate || '',
          contractType: (pastSal?.contractType || 'official') as EmployeeContractType,
          officialSalary: pastSal?.officialSalary || 0,
          probationSalary: pastSal?.probationSalary || 0,
          baseSalary: pastSal?.baseSalary || 0,
          standardWorkingDays: 26,
          actualWorkingDays: 26,
          salaryByWorkingDays: 0,
          bankName: acc?.bankName || pastSal?.bankName || '',
          bankAccountNumber: acc?.bankAccountNumber || pastSal?.bankAccountNumber || '',
          bankAccountHolder: acc?.bankAccountHolder || pastSal?.bankAccountHolder || st.toUpperCase(),
          revenueGenerated: 0,
          revenueSourceName: '',
          kpiRate: pastSal?.kpiRate ?? 10,
          kpiBonus: 0,
          isOnlineStaff: pastSal?.isOnlineStaff || false,
          onlineSupportAllowance: pastSal?.onlineSupportAllowance || 0,
          otherBonus: 0,
          deduction: 0,
          actualSalary: pastSal?.onlineSupportAllowance || 0,
          isPaid: false,
          note: '',
        };
      }),
    ];

    const newTotalSalary = newSalaryItems.reduce((acc, it) => acc + (it.actualSalary || 0), 0);
    const newTotalExp =
      (Number(workingOfficeCost) || 0) +
      (Number(workingElectricityCost) || 0) +
      (Number(workingWaterCost) || 0) +
      (Number(workingInternetCost) || 0) +
      (Number(workingOtherCosts) || 0) +
      newTotalSalary +
      computedTotalCustomExpenses;
    const newNetProfit = computedTotalRevenue - newTotalExp;

    const updatedRecord: MonthlyFinanceRecord = {
      ...activeMonthRecord,
      salaryItems: newSalaryItems,
      totalSalary: newTotalSalary,
      totalExpenses: newTotalExp,
      netProfit: newNetProfit,
      profitMargin: computedTotalRevenue > 0 ? Math.round((newNetProfit / computedTotalRevenue) * 1000) / 10 : 0,
      updatedAt: new Date().toLocaleString('vi-VN'),
      updatedBy: currentUser.name || 'Admin',
    };

    await onSaveMonthlyFinance(updatedRecord);
    alert(`Đã thêm thành công ${missingStaff.length} nhân viên vào bảng lương!`);
  };

  // Đánh dấu tất cả nhân sự đã nhận lương
  const handleMarkAllSalariesPaid = async () => {
    if (!activeMonthRecord.salaryItems?.length) return;
    const today = new Date().toLocaleDateString('vi-VN');
    const updatedItems = activeMonthRecord.salaryItems.map((item) => ({
      ...item,
      isPaid: true,
      paidDate: item.paidDate || today,
    }));

    const updatedRecord: MonthlyFinanceRecord = {
      ...activeMonthRecord,
      salaryItems: updatedItems,
      updatedAt: new Date().toLocaleString('vi-VN'),
      updatedBy: currentUser.name || 'Admin',
    };
    await onSaveMonthlyFinance(updatedRecord);
  };

  // Copy nhanh số tài khoản ngân hàng
  const handleCopyBankAccount = (accNum: string, id: string) => {
    if (!accNum) return;
    navigator.clipboard.writeText(accNum);
    setCopiedBankAccId(id);
    setTimeout(() => setCopiedBankAccId(null), 2000);
  };

  // ==========================================
  // XỬ LÝ BẢNG CHI PHÍ & CHI PHÍ NGOÀI Ý MUỐN (EXPENSES)
  // Cho phép tự thêm mục chi phí ngoài điện nước, thêm chi phí ngoài ý muốn
  // ==========================================
  const handleOpenAddCustomExpense = (presetType: ExpenseType = 'unexpected') => {
    setEditingExpenseItem(null);
    setExpenseType(presetType);
    setExpenseName('');
    setExpenseCategory(presetType === 'unexpected' ? 'unexpected' : 'office');
    setExpenseAmountInput('');
    setExpenseDate(new Date().toLocaleDateString('vi-VN'));
    setExpensePayer('Admin');
    setExpensePaymentMethod('transfer');
    setExpenseNote('');
    setIsCustomExpenseModalOpen(true);
  };

  const handleOpenEditCustomExpense = (item: CustomExpenseItem) => {
    setEditingExpenseItem(item);
    setExpenseType(item.expenseType || 'unexpected');
    setExpenseName(item.name || '');
    setExpenseCategory(item.category || 'other');
    setExpenseAmountInput(String(item.amount || ''));
    setExpenseDate(item.paidDate || '');
    setExpensePayer(item.payer || 'Admin');
    setExpensePaymentMethod(item.paymentMethod || 'transfer');
    setExpenseNote(item.note || '');
    setIsCustomExpenseModalOpen(true);
  };

  const handleSaveCustomExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseNumberInput(expenseAmountInput);
    if (!expenseName.trim() || amount <= 0) {
      alert('Vui lòng nhập tên khoản chi và số tiền hợp lệ (> 0 VNĐ)!');
      return;
    }

    let updatedList: CustomExpenseItem[] = [];
    if (editingExpenseItem) {
      updatedList = (activeMonthRecord.customExpenses || []).map((it) =>
        it.id === editingExpenseItem.id
          ? {
              ...it,
              name: expenseName.trim(),
              expenseType,
              category: expenseCategory,
              amount,
              paidDate: expenseDate.trim() || new Date().toLocaleDateString('vi-VN'),
              payer: expensePayer.trim(),
              paymentMethod: expensePaymentMethod,
              note: expenseNote.trim(),
            }
          : it
      );
    } else {
      const newItem: CustomExpenseItem = {
        id: `exp-${Date.now()}`,
        name: expenseName.trim(),
        expenseType,
        category: expenseCategory,
        amount,
        paidDate: expenseDate.trim() || new Date().toLocaleDateString('vi-VN'),
        payer: expensePayer.trim(),
        paymentMethod: expensePaymentMethod,
        note: expenseNote.trim(),
        createdAt: new Date().toISOString(),
      };
      updatedList = [...(activeMonthRecord.customExpenses || []), newItem];
    }

    const newTotalCustom = updatedList.reduce((acc, it) => acc + (it.amount || 0), 0);
    const newTotalExp =
      (Number(workingOfficeCost) || 0) +
      (Number(workingElectricityCost) || 0) +
      (Number(workingWaterCost) || 0) +
      (Number(workingInternetCost) || 0) +
      (Number(workingOtherCosts) || 0) +
      computedTotalSalary +
      newTotalCustom;
    const newNetProfit = computedTotalRevenue - newTotalExp;

    const updatedRecord: MonthlyFinanceRecord = {
      ...activeMonthRecord,
      customExpenses: updatedList,
      totalExpenses: newTotalExp,
      netProfit: newNetProfit,
      profitMargin: computedTotalRevenue > 0 ? Math.round((newNetProfit / computedTotalRevenue) * 1000) / 10 : 0,
      updatedAt: new Date().toLocaleString('vi-VN'),
      updatedBy: currentUser.name || 'Admin',
    };

    setIsCustomExpenseModalOpen(false);
    await onSaveMonthlyFinance(updatedRecord);
  };

  const handleDeleteCustomExpense = async (itemId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa khoản chi này?')) return;
    const updatedList = (activeMonthRecord.customExpenses || []).filter((it) => it.id !== itemId);
    const newTotalCustom = updatedList.reduce((acc, it) => acc + (it.amount || 0), 0);
    const newTotalExp =
      (Number(workingOfficeCost) || 0) +
      (Number(workingElectricityCost) || 0) +
      (Number(workingWaterCost) || 0) +
      (Number(workingInternetCost) || 0) +
      (Number(workingOtherCosts) || 0) +
      computedTotalSalary +
      newTotalCustom;
    const newNetProfit = computedTotalRevenue - newTotalExp;

    const updatedRecord: MonthlyFinanceRecord = {
      ...activeMonthRecord,
      customExpenses: updatedList,
      totalExpenses: newTotalExp,
      netProfit: newNetProfit,
      profitMargin: computedTotalRevenue > 0 ? Math.round((newNetProfit / computedTotalRevenue) * 1000) / 10 : 0,
      updatedAt: new Date().toLocaleString('vi-VN'),
      updatedBy: currentUser.name || 'Admin',
    };
    await onSaveMonthlyFinance(updatedRecord);
  };

  // --- HÀM SAO CHÉP DỮ LIỆU TỪ THÁNG KHÁC SANG THÁNG HIỆN TẠI (KHÔNG CẦN NHẬP LẠI) ---
  const handleCopyMonthData = async (
    sourceKey: string,
    targetKey: string,
    options: {
      copySalaries: boolean;
      copyOfficeCosts: boolean;
      copyExpenses: boolean;
      copyRevenue: boolean;
    }
  ) => {
    const source = finances.find((f) => f.monthKey === sourceKey || f.id === sourceKey);
    if (!source) {
      alert('Không tìm thấy dữ liệu tháng nguồn để sao chép!');
      return;
    }

    const currentTarget = finances.find((f) => f.monthKey === targetKey || f.id === targetKey) || activeMonthRecord;

    // 1. Sao chép bảng lương & thông tin nhân sự
    let newSalaryItems: StaffSalaryItem[] = currentTarget.salaryItems || [];
    if (options.copySalaries && source.salaryItems && source.salaryItems.length > 0) {
      newSalaryItems = source.salaryItems.map((item, idx) => ({
        ...item,
        id: `sal-copy-${Date.now()}-${idx}`,
        // Đặt lại cờ thanh toán cho kỳ mới
        isPaid: false,
        paidDate: '',
      }));
    }

    // 2. Sao chép chi phí văn phòng & điện nước
    const newOfficeCost = options.copyOfficeCosts ? (source.officeCost || 0) : (currentTarget.officeCost || 0);
    const newOfficeNote = options.copyOfficeCosts ? (source.officeCostNote || '') : (currentTarget.officeCostNote || '');
    const newElectricityCost = options.copyOfficeCosts ? (source.electricityCost || 0) : (currentTarget.electricityCost || 0);
    const newElectricityNote = options.copyOfficeCosts ? (source.electricityCostNote || '') : (currentTarget.electricityCostNote || '');
    const newWaterCost = options.copyOfficeCosts ? (source.waterCost || 0) : (currentTarget.waterCost || 0);
    const newWaterNote = options.copyOfficeCosts ? (source.waterCostNote || '') : (currentTarget.waterCostNote || '');
    const newInternetCost = options.copyOfficeCosts ? (source.internetCost || 0) : (currentTarget.internetCost || 0);
    const newInternetNote = options.copyOfficeCosts ? (source.internetCostNote || '') : (currentTarget.internetCostNote || '');
    const newOtherCosts = options.copyOfficeCosts ? (source.otherCosts || 0) : (currentTarget.otherCosts || 0);
    const newOtherNote = options.copyOfficeCosts ? (source.otherCostsNote || '') : (currentTarget.otherCostsNote || '');

    // 3. Sao chép chi phí phát sinh / ngoài ý muốn
    let newCustomExpenses: CustomExpenseItem[] = currentTarget.customExpenses || [];
    if (options.copyExpenses && source.customExpenses && source.customExpenses.length > 0) {
      newCustomExpenses = source.customExpenses.map((exp, idx) => ({
        ...exp,
        id: `exp-copy-${Date.now()}-${idx}`,
        paidDate: new Date().toLocaleDateString('vi-VN'),
      }));
    }

    // 4. Sao chép danh mục nguồn thu
    let newRevenueItems: RevenueItem[] = currentTarget.revenueItems || [];
    if (options.copyRevenue && source.revenueItems && source.revenueItems.length > 0) {
      newRevenueItems = source.revenueItems.map((rev, idx) => ({
        ...rev,
        id: `rev-copy-${Date.now()}-${idx}`,
        receivedDate: new Date().toLocaleDateString('vi-VN'),
      }));
    }

    // Tính toán lại tổng chi phí & lợi nhuận
    const totalRev = newRevenueItems.reduce((acc, it) => acc + (it.amount || 0), 0);
    const totalSal = newSalaryItems.reduce((acc, it) => acc + (it.actualSalary || 0), 0);
    const totalCustomExp = newCustomExpenses.reduce((acc, it) => acc + (it.amount || 0), 0);
    const totalExp = newOfficeCost + newElectricityCost + newWaterCost + newInternetCost + newOtherCosts + totalSal + totalCustomExp;
    const netProf = totalRev - totalExp;

    const [yStr, mStr] = targetKey.split('-');
    const mNum = parseInt(mStr, 10) || 1;
    const yNum = parseInt(yStr, 10) || 2026;

    const updatedRecord: MonthlyFinanceRecord = {
      ...currentTarget,
      id: targetKey,
      monthKey: targetKey,
      month: mNum,
      year: yNum,
      title: currentTarget.title || `Tháng ${String(mNum).padStart(2, '0')}/${yNum}`,
      revenueItems: newRevenueItems,
      totalRevenue: totalRev,
      officeCost: newOfficeCost,
      officeCostNote: newOfficeNote,
      electricityCost: newElectricityCost,
      electricityCostNote: newElectricityNote,
      waterCost: newWaterCost,
      waterCostNote: newWaterNote,
      internetCost: newInternetCost,
      internetCostNote: newInternetNote,
      otherCosts: newOtherCosts,
      otherCostsNote: newOtherNote,
      customExpenses: newCustomExpenses,
      salaryItems: newSalaryItems,
      totalSalary: totalSal,
      totalExpenses: totalExp,
      netProfit: netProf,
      profitMargin: totalRev > 0 ? Math.round((netProf / totalRev) * 1000) / 10 : 0,
      status: netProf > 0 ? 'profitable' : netProf === 0 ? 'break_even' : 'loss',
      updatedAt: new Date().toLocaleString('vi-VN'),
      updatedBy: currentUser.name || 'Admin',
    };

    await onSaveMonthlyFinance(updatedRecord);
    setIsCopyFromMonthModalOpen(false);
    setSaveSuccessMsg(`Đã sao chép toàn bộ dữ liệu từ ${source.title || sourceKey} sang ${updatedRecord.title || targetKey} thành công! Bạn không cần phải nhập lại.`);
    setTimeout(() => setSaveSuccessMsg(null), 5000);
  };

  // --- XỬ LÝ TẠO THÁNG MỚI (CÓ TÙY CHỌN SAO CHÉP TOÀN BỘ TỪ THÁNG CŨ) ---
  const handleCreateNewMonth = async (e: React.FormEvent) => {
    e.preventDefault();
    const monthKey = `${newMonthYear}-${String(newMonthNumber).padStart(2, '0')}`;
    const title = `Tháng ${String(newMonthNumber).padStart(2, '0')}/${newMonthYear}`;

    // Kiểm tra xem tháng đã tồn tại chưa
    const existing = finances.find((f) => f.monthKey === monthKey || f.id === monthKey);
    if (existing) {
      setSelectedMonthKey(monthKey);
      setIsNewMonthModalOpen(false);
      alert(`Tháng ${title} đã tồn tại! Hệ thống đã chuyển bạn đến tháng này.`);
      return;
    }

    // Nếu Admin chọn sao chép từ một tháng cũ có sẵn
    const sourceRecord = newMonthCopySourceKey
      ? finances.find((f) => f.monthKey === newMonthCopySourceKey || f.id === newMonthCopySourceKey)
      : null;

    let initialSalaries: StaffSalaryItem[] = [];
    let initialOfficeCost = 0;
    let initialOfficeNote = '';
    let initialElectricityCost = 0;
    let initialElectricityNote = '';
    let initialWaterCost = 0;
    let initialWaterNote = '';
    let initialInternetCost = 0;
    let initialInternetNote = '';
    let initialOtherCosts = 0;
    let initialOtherNote = '';
    let initialCustomExpenses: CustomExpenseItem[] = [];
    let initialRevenueItems: RevenueItem[] = [];

    if (sourceRecord) {
      if (newMonthCopySalaries && sourceRecord.salaryItems) {
        initialSalaries = sourceRecord.salaryItems.map((item, idx) => ({
          ...item,
          id: `sal-copy-${Date.now()}-${idx}`,
          isPaid: false,
          paidDate: '',
        }));
      }
      if (newMonthCopyOfficeCosts) {
        initialOfficeCost = sourceRecord.officeCost || 0;
        initialOfficeNote = sourceRecord.officeCostNote || '';
        initialElectricityCost = sourceRecord.electricityCost || 0;
        initialElectricityNote = sourceRecord.electricityCostNote || '';
        initialWaterCost = sourceRecord.waterCost || 0;
        initialWaterNote = sourceRecord.waterCostNote || '';
        initialInternetCost = sourceRecord.internetCost || 0;
        initialInternetNote = sourceRecord.internetCostNote || '';
        initialOtherCosts = sourceRecord.otherCosts || 0;
        initialOtherNote = sourceRecord.otherCostsNote || '';
      }
      if (newMonthCopyExpenses && sourceRecord.customExpenses) {
        initialCustomExpenses = sourceRecord.customExpenses.map((exp, idx) => ({
          ...exp,
          id: `exp-copy-${Date.now()}-${idx}`,
          paidDate: new Date().toLocaleDateString('vi-VN'),
        }));
      }
      if (newMonthCopyRevenue && sourceRecord.revenueItems) {
        initialRevenueItems = sourceRecord.revenueItems.map((rev, idx) => ({
          ...rev,
          id: `rev-copy-${Date.now()}-${idx}`,
          receivedDate: new Date().toLocaleDateString('vi-VN'),
        }));
      }
    }

    const totSal = initialSalaries.reduce((sum, it) => sum + (it.actualSalary || 0), 0);
    const totCustom = initialCustomExpenses.reduce((sum, it) => sum + (it.amount || 0), 0);
    const totRev = initialRevenueItems.reduce((sum, it) => sum + (it.amount || 0), 0);
    const totExp = initialOfficeCost + initialElectricityCost + initialWaterCost + initialInternetCost + initialOtherCosts + totSal + totCustom;
    const netProfit = totRev - totExp;

    const newRecord: MonthlyFinanceRecord = {
      id: monthKey,
      monthKey,
      month: newMonthNumber,
      year: newMonthYear,
      title,
      revenueItems: initialRevenueItems,
      totalRevenue: totRev,
      officeCost: initialOfficeCost,
      officeCostNote: initialOfficeNote,
      electricityCost: initialElectricityCost,
      electricityCostNote: initialElectricityNote,
      waterCost: initialWaterCost,
      waterCostNote: initialWaterNote,
      internetCost: initialInternetCost,
      internetCostNote: initialInternetNote,
      otherCosts: initialOtherCosts,
      otherCostsNote: initialOtherNote,
      customExpenses: initialCustomExpenses,
      salaryItems: initialSalaries,
      totalSalary: totSal,
      totalExpenses: totExp,
      netProfit,
      profitMargin: totRev > 0 ? Math.round((netProfit / totRev) * 1000) / 10 : 0,
      status: netProfit > 0 ? 'profitable' : netProfit === 0 ? 'break_even' : 'loss',
      adminSummaryNote: sourceRecord ? `Sao chép toàn bộ từ ${sourceRecord.title || newMonthCopySourceKey}` : '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toLocaleString('vi-VN'),
      updatedBy: currentUser.name || 'Admin',
    };

    await onSaveMonthlyFinance(newRecord);
    setSelectedMonthKey(monthKey);
    setIsNewMonthModalOpen(false);
    if (sourceRecord) {
      setSaveSuccessMsg(`Đã tạo ${title} và sao chép toàn bộ dữ liệu từ ${sourceRecord.title || newMonthCopySourceKey} thành công! Không cần nhập lại.`);
      setTimeout(() => setSaveSuccessMsg(null), 5000);
    }
  };

  // --- XÓA THÁNG ---
  const handleDeleteMonth = async (monthId: string) => {
    const record = finances.find((f) => f.id === monthId || f.monthKey === monthId);
    const title = record?.title || monthId;
    if (!confirm(`Bạn có chắc chắn muốn xóa toàn bộ dữ liệu tài chính của ${title}? Thao tác không thể hoàn tác!`)) {
      return;
    }
    await onDeleteMonthlyFinance(monthId);
    const remaining = finances.filter((f) => f.id !== monthId && f.monthKey !== monthId);
    if (remaining.length > 0) {
      setSelectedMonthKey(remaining[0].monthKey || remaining[0].id);
    }
    setSaveSuccessMsg(`Đã xóa thành công ${title}!`);
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // --- LÀM TRỐNG TOÀN BỘ DỮ LIỆU CỦA 1 THÁNG (BẢNG TRẮNG) ---
  const handleClearMonthData = async (monthId: string) => {
    const record = finances.find((f) => f.id === monthId || f.monthKey === monthId);
    const title = record?.title || monthId;
    if (!confirm(`Bạn có chắc chắn muốn xóa sạch toàn bộ nguồn thu, chi phí và bảng lương của ${title}? Kỳ tháng vẫn được giữ lại nhưng các số liệu sẽ trở về 0.`)) {
      return;
    }
    const emptyRecord: MonthlyFinanceRecord = {
      ...(record || activeMonthRecord),
      id: monthId,
      monthKey: monthId,
      revenueItems: [],
      totalRevenue: 0,
      officeCost: 0,
      officeCostNote: '',
      electricityCost: 0,
      electricityCostNote: '',
      waterCost: 0,
      waterCostNote: '',
      internetCost: 0,
      internetCostNote: '',
      otherCosts: 0,
      otherCostsNote: '',
      customExpenses: [],
      salaryItems: [],
      totalSalary: 0,
      totalExpenses: 0,
      netProfit: 0,
      profitMargin: 0,
      status: 'break_even',
      adminSummaryNote: '',
      updatedAt: new Date().toLocaleString('vi-VN'),
      updatedBy: currentUser.name || 'Admin',
    };
    await onSaveMonthlyFinance(emptyRecord);
    setSaveSuccessMsg(`Đã làm trống toàn bộ dữ liệu của ${title}!`);
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // --- XÓA HÀNG LOẠT CÁC THÁNG ĐƯỢC CHỌN (Yêu cầu 4: có thể chọn và xóa toàn bộ dữ liệu theo tháng) ---
  const handleBatchDeleteSelectedMonths = async () => {
    if (selectedMonthKeysToDelete.length === 0) {
      alert('Vui lòng tích chọn ít nhất 1 tháng để xóa!');
      return;
    }
    const count = selectedMonthKeysToDelete.length;
    if (!confirm(`Bạn có chắc chắn muốn xóa toàn bộ dữ liệu của ${count} tháng đã chọn? Thao tác không thể hoàn tác!`)) {
      return;
    }
    if (onDeleteBatchMonthlyFinances) {
      await onDeleteBatchMonthlyFinances(selectedMonthKeysToDelete);
    } else {
      for (const mId of selectedMonthKeysToDelete) {
        await onDeleteMonthlyFinance(mId);
      }
    }
    const remaining = finances.filter((f) => !selectedMonthKeysToDelete.includes(f.id) && !selectedMonthKeysToDelete.includes(f.monthKey));
    if (remaining.length > 0) {
      setSelectedMonthKey(remaining[0].monthKey || remaining[0].id);
    }
    setSelectedMonthKeysToDelete([]);
    setIsManageMonthsModalOpen(false);
    setSaveSuccessMsg(`Đã xóa thành công ${count} kỳ tháng được chọn!`);
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // Xuất file CSV báo cáo tài chính tháng (Đầy đủ cột lương, ngân hàng, KPI, và chi phí ngoài ý muốn)
  const handleExportCSV = () => {
    const lines: string[] = [];
    lines.push(`BÁO CÁO TÀI CHÍNH & THU CHI CHI TIẾT - ${activeMonthRecord.title || selectedMonthKey}`);
    lines.push(`Người lập: ${currentUser.name || 'Admin'}`);
    lines.push(`Thời gian xuất: ${new Date().toLocaleString('vi-VN')}`);
    lines.push('');
    lines.push('--- TỔNG KẾT TÀI CHÍNH ---');
    lines.push(`1. Tổng Doanh Thu / Tiền Về:,${computedTotalRevenue}`);
    lines.push(`2. Tiền Thuê Văn Phòng:,${workingOfficeCost}`);
    lines.push(`3. Tiền Điện:,${workingElectricityCost}`);
    lines.push(`4. Tiền Nước:,${workingWaterCost}`);
    lines.push(`5. Tiền Mạng Internet & Proxy:,${workingInternetCost}`);
    lines.push(`6. Chi Phí Ngoài Ý Muốn (Phát Sinh):,${computedUnexpectedExpenses}`);
    lines.push(`7. Chi Phí Hàng Tháng Khác:,${computedTotalCustomExpenses}`);
    lines.push(`8. Tổng Tiền Lương Nhân Viên (gồm KPI & Online):,${computedTotalSalary}`);
    lines.push(`9. Tổng Thưởng KPI Doanh Thu Đã Chi:,${computedTotalKpiBonus}`);
    lines.push(`10. Tổng Tiền Hỗ Trợ Mạng & Điện Cho NV Online:,${computedTotalOnlineSupport}`);
    lines.push(`11. TỔNG CHI PHÍ PHẢI CHI:,${computedTotalExpenses}`);
    lines.push(`12. LỢI NHUẬN RÒNG (TIỀN DƯ):,${computedNetProfit}`);
    lines.push(`13. Tỷ Suất Lợi Nhuận:,${computedProfitMargin}%`);
    lines.push('');
    lines.push('--- CHI TIẾT NGUỒN TIỀN VỀ (DOANH THU) ---');
    lines.push('STT,Nguồn Thu,Đối Tác / Khách Hàng,Ngày Nhận,Số Tiền (VNĐ),Ghi Chú');
    (activeMonthRecord.revenueItems || []).forEach((it, idx) => {
      lines.push(`${idx + 1},"${it.sourceName}","${it.payerName || ''}","${it.receivedDate || ''}",${it.amount},"${it.note || ''}"`);
    });
    lines.push('');
    lines.push('--- CHI TIẾT BẢNG LƯƠNG & HỒ SƠ NHÂN VIÊN ---');
    lines.push('STT,Tên Nhân Viên,Ngày Sinh,Số CCCD,Ngày Vào Làm,Chế Độ,Lương Hợp Đồng,Ngày Công Thực Tế,Lương Theo Ngày Công,Ngân Hàng,Số Tài Khoản,Chủ Tài Khoản,Doanh Thu Mang Về,Tỷ Lệ KPI (%),Tiền Thưởng KPI,Hỗ Trợ Mạng & Điện (Online),Thưởng Khác,Trừ / Phạt,Tổng Thực Nhận (VNĐ),Trạng Thái,Ngày Chi Trả,Ghi Chú');
    (activeMonthRecord.salaryItems || []).forEach((it, idx) => {
      lines.push(
        `${idx + 1},"${it.staffName}","${it.dateOfBirth || ''}","${it.citizenId || ''}","${it.startDate || ''}","${it.contractType === 'probation' ? 'Thử Việc' : 'Chính Thức'}",${it.baseSalary},"${it.actualWorkingDays || 26}/${it.standardWorkingDays || 26}",${it.salaryByWorkingDays || it.baseSalary},"${it.bankName || ''}","${it.bankAccountNumber || ''}","${it.bankAccountHolder || ''}",${it.revenueGenerated || 0},"${it.kpiRate || 10}%",${it.kpiBonus || 0},${it.onlineSupportAllowance || 0},${it.otherBonus || 0},${it.deduction || 0},${it.actualSalary},"${it.isPaid ? 'Đã Thanh Toán' : 'Chưa Thanh Toán'}","${it.paidDate || ''}","${it.note || ''}"`
      );
    });
    lines.push('');
    lines.push('--- BẢNG CHI PHÍ HÀNG THÁNG & CHI PHÍ NGOÀI Ý MUỐN ---');
    lines.push('STT,Tên Khoản Chi,Phân Loại,Số Tiền (VNĐ),Ngày Chi,Người Chi / Duyệt,Phương Thức,Ghi Chú Lý Do Chi');
    (activeMonthRecord.customExpenses || []).forEach((it, idx) => {
      const typeLabel = it.expenseType === 'unexpected' ? 'Ngoài Ý Muốn (Phát Sinh)' : it.expenseType === 'fixed' ? 'Cố Định Tự Thêm' : 'Khác';
      lines.push(
        `${idx + 1},"${it.name}","${typeLabel}",${it.amount},"${it.paidDate || ''}","${it.payer || ''}","${it.paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'}","${it.note || ''}"`
      );
    });

    const csvContent = '\uFEFF' + lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `BaoCao_TaiChinh_${selectedMonthKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Nếu người dùng KHÔNG PHẢI ADMIN, chặn hoàn toàn giao diện
  if (!isAdmin) {
    return (
      <div className="min-h-[500px] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-rose-200 rounded-3xl p-8 text-center shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Khu Vực Bảo Mật Giới Hạn</h2>
          <p className="text-xs text-slate-600 leading-relaxed mb-6">
            Bảng <strong>Quản Lý Doanh Thu & Tài Chính Hàng Tháng</strong> chỉ dành riêng cho tài khoản Quản Trị Viên (Admin). Nhân viên không có quyền truy cập tab này.
          </p>
          {onNavigateToTab && (
            <button
              type="button"
              onClick={() => onNavigateToTab('fanpage')}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
            >
              Quay Lại Bảng Fanpage Của Bạn
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-16">
      {/* 1. THANH ĐIỀU HƯỚNG THÁNG & NÚT THAO TÁC ADMIN */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* 1.1 Bên trái: Tiêu đề & Chọn Tháng */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Quản Lý Doanh Thu, Chi Phí & Bảng Lương Từng Tháng
                </h2>
                <span className="hidden sm:inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Chỉ Admin Quản Lý</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Doanh thu tiền về trừ chi phí văn phòng, điện, nước, chi phí ngoài ý muốn và bảng lương theo ngày công thực tế + thưởng KPI 5%-10%.
              </p>
            </div>
          </div>

          {/* 1.2 Bên phải: Dropdown chọn tháng, nút thêm tháng mới & xuất file */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Bộ chọn tháng */}
            <div className="flex items-center bg-slate-100 border border-slate-300/80 rounded-xl p-1 shadow-2xs">
              <label htmlFor="select-finance-month" className="text-[11px] font-black text-slate-600 px-2 uppercase tracking-wide">
                Tháng:
              </label>
              <select
                id="select-finance-month"
                value={selectedMonthKey}
                onChange={(e) => setSelectedMonthKey(e.target.value)}
                className="bg-white font-extrabold text-xs text-slate-900 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                {finances.map((f) => (
                  <option key={f.monthKey || f.id} value={f.monthKey || f.id}>
                    {f.title || `Tháng ${f.month}/${f.year}`} {f.netProfit ? `(${formatCurrencyVND(f.netProfit)})` : ''}
                  </option>
                ))}
                {!finances.some((f) => f.monthKey === selectedMonthKey || f.id === selectedMonthKey) && (
                  <option value={selectedMonthKey}>
                    Tháng {selectedMonthKey} (Đang tạo mới)
                  </option>
                )}
              </select>

              {/* Nút Xóa nhanh tháng hiện tại */}
              {finances.some((f) => f.monthKey === selectedMonthKey || f.id === selectedMonthKey) && (
                <button
                  type="button"
                  onClick={() => handleDeleteMonth(selectedMonthKey)}
                  className="ml-1 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="Xóa bỏ hoàn toàn kỳ tháng này khỏi hệ thống"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                </button>
              )}
            </div>

            {/* Nút Chọn & Xóa Toàn Bộ Dữ Liệu Theo Tháng (Yêu cầu 4) */}
            {finances.length > 0 && (
              <button
                type="button"
                id="btn-manage-delete-months"
                onClick={() => {
                  setSelectedMonthKeysToDelete([]);
                  setIsManageMonthsModalOpen(true);
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                title="Tích chọn và xóa toàn bộ dữ liệu của từng tháng hoặc xóa hàng loạt các tháng"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Chọn & Xóa Theo Tháng</span>
              </button>
            )}

            {/* Nút Xóa Hết Dữ Liệu Mẫu (Về Bảng Trắng) */}
            {onClearAllFinances && finances.length > 0 && (
              <button
                type="button"
                id="btn-clear-finance-samples"
                onClick={async () => {
                  if (confirm('Bạn có chắc chắn muốn xóa hết tất cả các tháng và dữ liệu mẫu trong Bảng 7 để Admin tự nhập từ đầu?')) {
                    await onClearAllFinances();
                  }
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                title="Xóa hết dữ liệu mẫu trong Bảng 7 về bảng trắng hoàn toàn"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Xóa Hết Dữ Liệu Mẫu</span>
              </button>
            )}

            {/* Nút Báo Cáo Doanh Thu MGID Publisher Dashboard (https://pub.mgid.com/dashboard) - Chỉ Admin */}
            <button
              type="button"
              id="btn-goto-mgid-dashboard"
              onClick={() => setActiveSection('mgid_dashboard')}
              className={`inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all shadow-2xs cursor-pointer ${
                activeSection === 'mgid_dashboard'
                  ? 'bg-gradient-to-r from-rose-600 to-orange-600 text-white shadow-md ring-2 ring-rose-300'
                  : 'bg-slate-900 hover:bg-slate-800 text-white border border-slate-700'
              }`}
              title="Mở Báo Cáo Doanh Thu MGID Publisher Dashboard (pub.mgid.com/dashboard) - Chỉ Admin Xem Duy Nhất"
            >
              <Globe className="w-4 h-4 text-rose-400" />
              <span>🌐 Báo Cáo Doanh Thu MGID</span>
              <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-mono font-bold">
                PUB
              </span>
            </button>

            {/* Nút Ẩn/Hiện Số Tiền (Privacy Shield) */}
            <button
              type="button"
              onClick={() => setIsPrivacyMasked((prev) => !prev)}
              className={`inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer border ${
                isPrivacyMasked
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
              title="Ẩn hoặc hiện số tiền nhạy cảm trên màn hình"
            >
              {isPrivacyMasked ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              <span>{isPrivacyMasked ? 'Hiện Số Tiền' : 'Ẩn Số Tiền'}</span>
            </button>

            {/* Nút Thống Kê & So Sánh Tăng Giảm Doanh Thu Các Tháng */}
            <button
              type="button"
              id="btn-goto-revenue-growth-comparison"
              onClick={() => setActiveSection('all_months')}
              className={`inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all shadow-2xs cursor-pointer ${
                activeSection === 'all_months'
                  ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-300'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
              }`}
              title="Xem bảng thống kê & so sánh tăng giảm doanh thu giữa các tháng"
            >
              <BarChart3 className="w-4 h-4 text-amber-600" />
              <span>📈 So Sánh Doanh Thu Các Tháng</span>
              <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded-full text-[10px] font-mono font-bold">
                {monthlyComparisonStats.length}
              </span>
            </button>

            {/* Nút Sao Chép Dữ Liệu Từ Tháng Khác (Áp dụng cho tháng hiện tại đang xem) */}
            {finances.length > 0 && (
              <button
                type="button"
                id="btn-copy-month-data"
                onClick={() => {
                  const otherMonths = finances.filter((f) => f.monthKey !== selectedMonthKey && f.id !== selectedMonthKey);
                  if (otherMonths.length > 0) {
                    setCopySourceMonthKey(otherMonths[0].monthKey || otherMonths[0].id);
                  } else {
                    setCopySourceMonthKey(finances[0].monthKey || finances[0].id);
                  }
                  setIsCopyFromMonthModalOpen(true);
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                title="Sao chép toàn bộ dữ liệu từ tháng cũ sang tháng này (Lương, nhân sự, chi phí, nguồn thu) mà không cần nhập lại"
              >
                <Copy className="w-4 h-4 text-blue-600" />
                <span>Sao Chép Từ Tháng Cũ</span>
              </button>
            )}

            {/* Nút Tạo Tháng Mới */}
            <button
              type="button"
              id="btn-add-new-finance-month"
              onClick={() => {
                if (finances.length > 0 && !newMonthCopySourceKey) {
                  setNewMonthCopySourceKey(finances[0].monthKey || finances[0].id);
                }
                setIsNewMonthModalOpen(true);
              }}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Thêm Tháng Mới</span>
            </button>

            {/* Nút Xuất Excel / CSV */}
            <button
              type="button"
              id="btn-export-finance-csv"
              onClick={handleExportCSV}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="Xuất báo cáo tài chính tháng ra file CSV"
            >
              <Download className="w-4 h-4" />
              <span>Xuất CSV</span>
            </button>

            {/* Nút Lưu Lại Thay Đổi */}
            <button
              type="button"
              id="btn-save-finance-changes"
              onClick={handleSaveMonth}
              disabled={isSaving}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer hover:scale-[1.02]"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi'}</span>
            </button>
          </div>
        </div>

        {/* Thông báo đã lưu thành công */}
        {saveSuccessMsg && (
          <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center space-x-2 text-xs font-bold text-emerald-800 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Thông báo bảng trống cho Admin khi chưa có tháng nào được tạo */}
        {finances.length === 0 && (
          <div className="mt-3 p-3 bg-amber-50/90 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900 animate-fadeIn">
            <div className="flex items-start sm:items-center space-x-2">
              <span className="text-base shrink-0">📝</span>
              <div>
                <span className="font-bold">Bảng 7 đang để trắng hoàn toàn:</span> Tất cả dữ liệu mặc định đã được xóa sạch. Admin hãy bấm nút <b>"+ Thêm Tháng Mới"</b> hoặc nhập doanh thu, chi phí, bảng lương bên dưới rồi bấm <b>"Lưu Thay Đổi"</b> để lưu trữ!
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsNewMonthModalOpen(true)}
              className="self-start sm:self-auto shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              + Tạo Tháng Mới
            </button>
          </div>
        )}
      </div>

      {/* 2. DÀN 5 THẺ KPI TỔNG QUAN TÀI CHÍNH CỦA THÁNG */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Thẻ 1: Tổng Doanh Thu / Tiền Về */}
        <div
          onClick={() => setActiveSection('revenue')}
          className="p-3.5 bg-emerald-50/80 hover:bg-emerald-100/70 border border-emerald-200 rounded-2xl cursor-pointer transition-all shadow-2xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wide">
              🟢 Tổng Tiền Về (Doanh Thu)
            </span>
            <DollarSign className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-lg sm:text-xl font-black text-emerald-700 mt-1.5 truncate">
            {formatCurrencyVND(computedTotalRevenue)}
          </div>
          <div className="text-[11px] text-emerald-600/90 mt-1 flex items-center justify-between">
            <span>{activeMonthRecord.revenueItems?.length || 0} nguồn thu đã nhập</span>
            <span className="font-bold underline">Chi tiết →</span>
          </div>
        </div>

        {/* Thẻ 2: Tổng Chi Phí Phải Chi (Bao gồm lương, KPI, chi phí cố định và phát sinh) */}
        <div
          onClick={() => setActiveSection('expenses')}
          className="p-3.5 bg-rose-50/80 hover:bg-rose-100/70 border border-rose-200 rounded-2xl cursor-pointer transition-all shadow-2xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-rose-800 uppercase tracking-wide">
              🔴 Tổng Chi Phí Phải Chi
            </span>
            <Receipt className="w-4 h-4 text-rose-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-lg sm:text-xl font-black text-rose-700 mt-1.5 truncate">
            {formatCurrencyVND(computedTotalExpenses)}
          </div>
          <div className="text-[11px] text-rose-600/90 mt-1 flex items-center justify-between">
            <span>Lương & KPI + Cố định + Phát sinh</span>
            <span className="font-bold underline">Chi tiết →</span>
          </div>
        </div>

        {/* Thẻ 3: Lợi Nhuận Ròng (Tiền Dư Còn Lại) - Yêu cầu 4 */}
        <div
          className={`p-3.5 border rounded-2xl transition-all shadow-2xs col-span-2 sm:col-span-1 ${
            computedNetProfit >= 0
              ? 'bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-300'
              : 'bg-gradient-to-br from-rose-50 to-red-100 border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] font-black uppercase tracking-wide ${
                computedNetProfit >= 0 ? 'text-teal-900' : 'text-rose-900'
              }`}
            >
              💎 Lợi Nhuận (Tiền Về - Chi Phí)
            </span>
            {computedNetProfit >= 0 ? (
              <TrendingUp className="w-4 h-4 text-teal-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-600" />
            )}
          </div>
          <div
            className={`text-lg sm:text-xl font-black mt-1.5 truncate ${
              computedNetProfit >= 0 ? 'text-teal-700' : 'text-rose-700'
            }`}
          >
            {computedNetProfit >= 0 ? '+' : ''}
            {formatCurrencyVND(computedNetProfit)}
          </div>
          <div
            className={`text-[10px] mt-1 font-extrabold truncate ${
              computedNetProfit >= 0 ? 'text-teal-800' : 'text-rose-800'
            }`}
            title={`Thu về (${formatCurrencyVND(computedTotalRevenue)}) trừ đi Chi phí (${formatCurrencyVND(computedTotalExpenses)})`}
          >
            = Thu về ({formatCurrencyVND(computedTotalRevenue)}) - Chi ({formatCurrencyVND(computedTotalExpenses)})
          </div>
          <div
            className={`text-[10px] mt-0.5 font-bold ${
              computedNetProfit >= 0 ? 'text-teal-600' : 'text-rose-600'
            }`}
          >
            Tỷ suất: {computedProfitMargin}% | {computedNetProfit >= 0 ? 'Có Lãi 🎉' : 'Bị Lỗ ⚠️'}
          </div>
        </div>

        {/* Thẻ 4: Tổng Tiền Lương Nhân Viên (gồm KPI doanh thu 5%-10%) */}
        <div
          onClick={() => setActiveSection('salaries')}
          className="p-3.5 bg-blue-50/80 hover:bg-blue-100/70 border border-blue-200 rounded-2xl cursor-pointer transition-all shadow-2xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-blue-800 uppercase tracking-wide">
              👥 Bảng Lương & KPI
            </span>
            <Users className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-lg sm:text-xl font-black text-blue-700 mt-1.5 truncate">
            {formatCurrencyVND(computedTotalSalary)}
          </div>
          <div className="text-[11px] text-blue-600/90 mt-1 flex items-center justify-between">
            <span>
              {activeMonthRecord.salaryItems?.length || 0} NV | Thưởng KPI: {formatCurrencyVND(computedTotalKpiBonus)}
            </span>
            <span className="font-bold underline">Bảng lương →</span>
          </div>
        </div>

        {/* Thẻ 5: Chi Phí Ngoài Ý Muốn & Vận Hành Cố Định */}
        <div
          onClick={() => setActiveSection('expenses')}
          className="p-3.5 bg-amber-50/80 hover:bg-amber-100/70 border border-amber-200 rounded-2xl cursor-pointer transition-all shadow-2xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-amber-800 uppercase tracking-wide">
              ⚠️ Chi Phí Ngoài Ý Muốn: {formatCurrencyVND(computedUnexpectedExpenses)}
            </span>
            <Building2 className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-lg sm:text-xl font-black text-amber-700 mt-1.5 truncate">
            {formatCurrencyVND(computedFixedUtilityCost + computedTotalCustomExpenses)}
          </div>
          <div className="text-[11px] text-amber-700/90 mt-1 truncate">
            VP+Điện+Nước: {formatCurrencyVND(computedFixedUtilityCost)} | Phát sinh: {formatCurrencyVND(computedUnexpectedExpenses)}
          </div>
        </div>
      </div>

      {/* 3. SUB-NAV TABS ĐIỀU HƯỚNG CÁC PHẦN */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveSection('overview')}
          className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
            activeSection === 'overview'
              ? 'bg-white text-slate-900 shadow-xs font-black'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          📊 Tổng Kết Tháng ({activeMonthRecord.title || selectedMonthKey})
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('revenue')}
          className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
            activeSection === 'revenue'
              ? 'bg-emerald-600 text-white shadow-xs font-black'
              : 'text-emerald-800 hover:bg-emerald-50'
          }`}
        >
          <span>💰 Doanh Thu & Tiền Về</span>
          <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">
            {activeMonthRecord.revenueItems?.length || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('expenses')}
          className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
            activeSection === 'expenses'
              ? 'bg-rose-600 text-white shadow-xs font-black'
              : 'text-rose-800 hover:bg-rose-50'
          }`}
        >
          <span>🏢 Chi Phí Cố Định & Ngoài Ý Muốn</span>
          <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">
            {(activeMonthRecord.customExpenses?.length || 0) + 5}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('salaries')}
          className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
            activeSection === 'salaries'
              ? 'bg-blue-600 text-white shadow-xs font-black'
              : 'text-blue-800 hover:bg-blue-50'
          }`}
        >
          <span>👥 Bảng Lương, Ngày Công & KPI</span>
          <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">
            {activeMonthRecord.salaryItems?.length || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('mgid_dashboard')}
          className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
            activeSection === 'mgid_dashboard'
              ? 'bg-gradient-to-r from-rose-600 to-orange-600 text-white shadow-xs font-black'
              : 'text-rose-900 bg-rose-50/80 hover:bg-rose-100 border border-rose-200/80 font-extrabold'
          }`}
        >
          <Globe className="w-4 h-4 text-rose-500" />
          <span>🌐 Báo Cáo Doanh Thu MGID (pub.mgid.com)</span>
          <span className="px-1.5 py-0.2 bg-rose-600/20 rounded-full text-[10px]">
            {activeMonthRecord.mgidReport?.dailyStats?.length || 0} ngày
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('all_months')}
          className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
            activeSection === 'all_months'
              ? 'bg-slate-800 text-white shadow-xs font-black'
              : 'text-slate-700 hover:bg-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-amber-400" />
          <span>📈 Thống Kê & So Sánh Tăng Giảm Doanh Thu</span>
          <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">
            {monthlyComparisonStats.length}
          </span>
        </button>
      </div>

      {/* 4. NỘI DUNG CHI TIẾT TỪNG TAB */}

      {/* TAB MỚI: BÁO CÁO DOANH THU MGID PUBLISHER DASHBOARD (CHỈ ADMIN XEM DUY NHẤT) */}
      {activeSection === 'mgid_dashboard' && (
        <MgidDashboardPanel
          currentUser={currentUser}
          activeMonthRecord={activeMonthRecord}
          selectedMonthKey={selectedMonthKey}
          isPrivacyMasked={isPrivacyMasked}
          onTogglePrivacyMask={() => setIsPrivacyMasked((prev) => !prev)}
          onSaveMonthlyFinance={onSaveMonthlyFinance}
        />
      )}

      {/* TAB 1: TỔNG KẾT THÁNG (OVERVIEW) */}
      {activeSection === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Cột 1 & 2: Bảng Cân Đối Tài Chính Thu - Chi */}
          <div className="lg:col-span-2 space-y-4">
            {/* HỘP CÔNG THỨC LỢI NHUẬN CHÍNH XÁC (YÊU CẦU 4) */}
            <div className="bg-gradient-to-r from-teal-50 via-emerald-50 to-blue-50 border-2 border-emerald-300 rounded-2xl p-4 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-950 flex items-center space-x-1.5 uppercase tracking-wide">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>CÔNG THỨC LỢI NHUẬN RÒNG ({activeMonthRecord.title || selectedMonthKey}):</span>
                </span>
                <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full text-white shadow-2xs ${computedNetProfit >= 0 ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                  {computedNetProfit >= 0 ? 'CÓ LÃI RÒNG 🎉' : 'BỊ LỖ THÁNG ⚠️'}
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                💎 <b>Lợi nhuận</b> = <b>Tổng thu tiền về</b> trừ đi tất cả <b>chi phí lương & KPI</b>, <b>chi phí cố định</b> (văn phòng, điện, nước, internet) và <b>chi phí phát sinh ngoài ý muốn</b>.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center font-mono">
                <div className="p-2.5 bg-white rounded-xl border border-emerald-300 shadow-2xs">
                  <span className="text-[10px] text-emerald-800 font-extrabold block">(+) THU TIỀN VỀ</span>
                  <span className="text-xs font-black text-emerald-700 truncate block mt-0.5">{formatCurrencyVND(computedTotalRevenue)}</span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-blue-300 shadow-2xs">
                  <span className="text-[10px] text-blue-800 font-extrabold block">(-) LƯƠNG & KPI</span>
                  <span className="text-xs font-black text-blue-700 truncate block mt-0.5">{formatCurrencyVND(computedTotalSalary)}</span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-amber-300 shadow-2xs">
                  <span className="text-[10px] text-amber-800 font-extrabold block">(-) CỐ ĐỊNH (VP/ĐIỆN/NƯỚC)</span>
                  <span className="text-xs font-black text-amber-700 truncate block mt-0.5">{formatCurrencyVND(computedTotalFixedCosts)}</span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-rose-300 shadow-2xs">
                  <span className="text-[10px] text-rose-800 font-extrabold block">(-) PHÁT SINH / KHÁC</span>
                  <span className="text-xs font-black text-rose-700 truncate block mt-0.5">{formatCurrencyVND(computedTotalUnexpectedCosts)}</span>
                </div>
              </div>
              <div className="p-3 bg-white/95 border-2 border-emerald-400 rounded-xl flex items-center justify-between text-xs font-black">
                <span className="text-emerald-950 uppercase">(=) LỢI NHUẬN RÒNG THỰC TẾ (TIỀN DƯ):</span>
                <span className={`text-base sm:text-lg font-black font-mono ${computedNetProfit >= 0 ? 'text-teal-700' : 'text-rose-700'}`}>
                  {computedNetProfit >= 0 ? '+' : ''}{formatCurrencyVND(computedNetProfit)}
                </span>
              </div>
            </div>

            {/* THẺ SO SÁNH TĂNG GIẢM DOANH THU VỚI THÁNG TRƯỚC (MoM STATS) */}
            {revenueComparisonInsights.prevMonthStat ? (
              <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/90 to-sky-50/90 border-2 border-indigo-300 rounded-2xl p-4 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-200/80 pb-2.5">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wide">
                        So Sánh Tăng Trưởng Doanh Thu (So Với Tháng Trước)
                      </h4>
                      <p className="text-[11px] text-indigo-800 font-medium">
                        Đối chiếu giữa <strong>{activeMonthRecord.title || selectedMonthKey}</strong> và <strong>{revenueComparisonInsights.prevMonthStat.title}</strong>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveSection('all_months')}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer self-start sm:self-auto"
                  >
                    <span>Xem Bảng So Sánh & Biểu Đồ</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono">
                  {/* Doanh thu biến động */}
                  <div className="p-3 bg-white rounded-xl border border-indigo-200/80 shadow-2xs">
                    <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between">
                      <span>Biến Động Doanh Thu:</span>
                      {(revenueComparisonInsights.currentMonthStat?.diffRevenue || 0) >= 0 ? (
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                      )}
                    </div>
                    <div className={`text-base font-black mt-1 ${
                      (revenueComparisonInsights.currentMonthStat?.diffRevenue || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {(revenueComparisonInsights.currentMonthStat?.diffRevenue || 0) >= 0 ? '+' : ''}
                      {formatCurrencyVND(revenueComparisonInsights.currentMonthStat?.diffRevenue || 0)}
                    </div>
                    <div className="text-[11px] font-bold mt-0.5 flex items-center space-x-1">
                      <span className={`px-1.5 py-0.2 rounded-md ${
                        (revenueComparisonInsights.currentMonthStat?.diffRevenuePercent || 0) >= 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {(revenueComparisonInsights.currentMonthStat?.diffRevenuePercent || 0) >= 0 ? '+' : ''}
                        {revenueComparisonInsights.currentMonthStat?.diffRevenuePercent || 0}%
                      </span>
                      <span className="text-slate-400 font-sans text-[10px]">
                        (Tháng trước: {formatCurrencyVND(revenueComparisonInsights.prevMonthStat.revenue)})
                      </span>
                    </div>
                  </div>

                  {/* Lợi nhuận biến động */}
                  <div className="p-3 bg-white rounded-xl border border-indigo-200/80 shadow-2xs">
                    <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between">
                      <span>Biến Động Lợi Nhuận:</span>
                      {(revenueComparisonInsights.currentMonthStat?.diffProfit || 0) >= 0 ? (
                        <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                      )}
                    </div>
                    <div className={`text-base font-black mt-1 ${
                      (revenueComparisonInsights.currentMonthStat?.diffProfit || 0) >= 0 ? 'text-teal-700' : 'text-rose-700'
                    }`}>
                      {(revenueComparisonInsights.currentMonthStat?.diffProfit || 0) >= 0 ? '+' : ''}
                      {formatCurrencyVND(revenueComparisonInsights.currentMonthStat?.diffProfit || 0)}
                    </div>
                    <div className="text-[11px] font-bold mt-0.5 flex items-center space-x-1">
                      <span className={`px-1.5 py-0.2 rounded-md ${
                        (revenueComparisonInsights.currentMonthStat?.diffProfitPercent || 0) >= 0
                          ? 'bg-teal-100 text-teal-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {(revenueComparisonInsights.currentMonthStat?.diffProfitPercent || 0) >= 0 ? '+' : ''}
                        {revenueComparisonInsights.currentMonthStat?.diffProfitPercent || 0}%
                      </span>
                      <span className="text-slate-400 font-sans text-[10px]">
                        (Tháng trước: {formatCurrencyVND(revenueComparisonInsights.prevMonthStat.netProfit)})
                      </span>
                    </div>
                  </div>

                  {/* Chi phí biến động */}
                  <div className="p-3 bg-white rounded-xl border border-indigo-200/80 shadow-2xs">
                    <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between">
                      <span>Biến Động Chi Phí:</span>
                      <Receipt className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div className="text-base font-black mt-1 text-slate-800">
                      {(revenueComparisonInsights.currentMonthStat?.diffExpenses || 0) >= 0 ? '+' : ''}
                      {formatCurrencyVND(revenueComparisonInsights.currentMonthStat?.diffExpenses || 0)}
                    </div>
                    <div className="text-[11px] font-bold mt-0.5 flex items-center space-x-1">
                      <span className="px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-700">
                        {(revenueComparisonInsights.currentMonthStat?.diffExpensesPercent || 0) >= 0 ? '+' : ''}
                        {revenueComparisonInsights.currentMonthStat?.diffExpensesPercent || 0}%
                      </span>
                      <span className="text-slate-400 font-sans text-[10px]">
                        (Tháng trước: {formatCurrencyVND(revenueComparisonInsights.prevMonthStat.totalExpenses)})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : monthlyComparisonStats.length > 1 ? (
              <div className="bg-gradient-to-r from-amber-50 via-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                      Thống Kê So Sánh Tăng Giảm Doanh Thu
                    </h4>
                    <p className="text-[11px] text-slate-600 font-medium">
                      Hệ thống đang có <b>{monthlyComparisonStats.length} tháng</b> dữ liệu. Nhấn để xem biểu đồ tăng trưởng và công cụ đối chiếu trực tiếp giữa các tháng.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection('all_months')}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <span>Xem Bảng So Sánh & Biểu Đồ</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : null}

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                  <PieChart className="w-4 h-4 text-amber-600" />
                  <span>Bảng Cân Đối Thu - Chi & Lợi Nhuận Ròng ({activeMonthRecord.title || selectedMonthKey})</span>
                </h3>
                <span className="text-xs text-slate-400">Đơn vị: VNĐ</span>
              </div>

              <div className="space-y-2.5 text-xs">
                {/* 1. Tổng tiền về */}
                <div className="flex items-center justify-between p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl font-bold">
                  <span className="text-emerald-900 flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>(+) TỔNG TIỀN VỀ (DOANH THU)</span>
                  </span>
                  <span className="text-emerald-700 font-black text-sm">
                    {formatCurrencyVND(computedTotalRevenue)}
                  </span>
                </div>

                {/* Các khoản chi tiết chi phí */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="text-[11px] font-black text-slate-500 uppercase tracking-wide flex items-center justify-between">
                    <span>(-) CÁC KHOẢN CHI PHÍ PHẢI CHI:</span>
                    <span>{formatCurrencyVND(computedTotalExpenses)}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700 py-1 border-b border-slate-200/60">
                    <span className="flex items-center space-x-2">
                      <Building2 className="w-3.5 h-3.5 text-amber-600" />
                      <span>1. Chi Phí Thuê Văn Phòng</span>
                      <span className="text-[10px] text-slate-400">({workingOfficeNote || 'Mặt bằng'})</span>
                    </span>
                    <span className="font-bold">{formatCurrencyVND(workingOfficeCost)}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700 py-1 border-b border-slate-200/60">
                    <span className="flex items-center space-x-2">
                      <Zap className="w-3.5 h-3.5 text-yellow-600" />
                      <span>2. Tiền Điện Sinh Hoạt & Máy Tính</span>
                      <span className="text-[10px] text-slate-400">({workingElectricityNote || 'Hóa đơn điện'})</span>
                    </span>
                    <span className="font-bold">{formatCurrencyVND(workingElectricityCost)}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700 py-1 border-b border-slate-200/60">
                    <span className="flex items-center space-x-2">
                      <Droplets className="w-3.5 h-3.5 text-cyan-600" />
                      <span>3. Tiền Nước Sinh Hoạt</span>
                      <span className="text-[10px] text-slate-400">({workingWaterNote || 'Hóa đơn nước'})</span>
                    </span>
                    <span className="font-bold">{formatCurrencyVND(workingWaterCost)}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700 py-1 border-b border-slate-200/60">
                    <span className="flex items-center space-x-2">
                      <Wifi className="w-3.5 h-3.5 text-indigo-600" />
                      <span>4. Mạng Cáp Quang & Dàn Proxy</span>
                      <span className="text-[10px] text-slate-400">({workingInternetNote || 'Internet'})</span>
                    </span>
                    <span className="font-bold">{formatCurrencyVND(workingInternetCost)}</span>
                  </div>

                  {/* Chi phí ngoài ý muốn / phát sinh */}
                  <div className="flex items-center justify-between text-slate-700 py-1 border-b border-slate-200/60 bg-rose-50/70 px-2 rounded-lg">
                    <span className="flex items-center space-x-2 font-black text-rose-800">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>5. Chi Phí Ngoài Ý Muốn / Phát Sinh</span>
                      <span className="text-[10px] text-rose-600">
                        ({(activeMonthRecord.customExpenses || []).filter((e) => e.expenseType === 'unexpected').length} khoản phát sinh)
                      </span>
                    </span>
                    <span className="font-black text-rose-700">{formatCurrencyVND(computedUnexpectedExpenses)}</span>
                  </div>

                  {/* Các khoản chi tự thêm khác */}
                  <div className="flex items-center justify-between text-slate-700 py-1 border-b border-slate-200/60">
                    <span className="flex items-center space-x-2">
                      <ShoppingBag className="w-3.5 h-3.5 text-slate-600" />
                      <span>6. Chi Phí Hàng Tháng Tự Thêm Khác</span>
                      <span className="text-[10px] text-slate-400">({workingOtherNote || 'Văn phòng phẩm, Tool'})</span>
                    </span>
                    <span className="font-bold">
                      {formatCurrencyVND(
                        (Number(workingOtherCosts) || 0) +
                          (activeMonthRecord.customExpenses || [])
                            .filter((e) => e.expenseType !== 'unexpected')
                            .reduce((sum, it) => sum + (it.amount || 0), 0)
                      )}
                    </span>
                  </div>

                  {/* Tiền lương nhân viên */}
                  <div className="flex items-center justify-between text-slate-700 py-1 font-black bg-blue-50/70 px-2 rounded-lg">
                    <span className="flex items-center space-x-2 text-blue-900">
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                      <span>7. Tiền Lương Nhân Viên (Theo Ngày Công + KPI)</span>
                      <span className="text-[10px] text-blue-600">
                        ({activeMonthRecord.salaryItems?.length || 0} nhân sự)
                      </span>
                    </span>
                    <span className="font-black text-blue-700">{formatCurrencyVND(computedTotalSalary)}</span>
                  </div>
                </div>

                {/* Kết quả Lợi Nhuận Ròng */}
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between font-black ${
                    computedNetProfit >= 0
                      ? 'bg-teal-50 border-teal-300 text-teal-900'
                      : 'bg-rose-50 border-rose-300 text-rose-900'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-base">(=)</span>
                    <span className="text-xs uppercase">LỢI NHUẬN RÒNG (TIỀN DƯ CÒN LẠI):</span>
                  </div>
                  <div className="text-base sm:text-lg">
                    {computedNetProfit >= 0 ? '+' : ''}
                    {formatCurrencyVND(computedNetProfit)}
                  </div>
                </div>
              </div>
            </div>

            {/* Ghi chú tổng kết của Admin */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2">
              <label className="text-xs font-black text-slate-800 flex items-center space-x-1.5">
                <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                <span>Nhận Xét & Tổng Kết Của Admin ({activeMonthRecord.title || selectedMonthKey})</span>
              </label>
              <textarea
                rows={3}
                value={workingAdminSummary}
                onChange={(e) => setWorkingAdminSummary(e.target.value)}
                placeholder="Nhập ghi chú tổng kết tài chính, định hướng doanh thu và chi phí tháng tới..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveMonth}
                  disabled={isSaving}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs inline-flex items-center space-x-1"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu Nhận Xét</span>
                </button>
              </div>
            </div>
          </div>

          {/* Cột 3: Tóm tắt nguồn thu và các nút thao tác nhanh */}
          <div className="space-y-4">
            {/* Top nguồn doanh thu lớn nhất */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center space-x-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Các Nguồn Tiền Về</span>
                </h4>
                <button
                  type="button"
                  onClick={handleOpenAddRevenue}
                  className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  + Thêm khoản thu
                </button>
              </div>

              {(!activeMonthRecord.revenueItems || activeMonthRecord.revenueItems.length === 0) ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  Chưa có khoản thu nào. Hãy bấm "+ Thêm khoản thu" để nhập tiền về!
                </div>
              ) : (
                <div className="space-y-2">
                  {activeMonthRecord.revenueItems.slice(0, 5).map((rev) => (
                    <div
                      key={rev.id}
                      className="p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="truncate mr-2">
                        <div className="font-bold text-slate-900 truncate">{rev.sourceName}</div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {rev.payerName || 'Đối tác'} {rev.receivedDate ? `• ${rev.receivedDate}` : ''}
                        </div>
                      </div>
                      <div className="font-black text-emerald-700 shrink-0 font-mono">
                        {formatCurrencyVND(rev.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Thống kê chi phí ngoài ý muốn */}
            <div className="bg-white border border-rose-200 rounded-2xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-rose-100 pb-2">
                <h4 className="text-xs font-black text-rose-900 uppercase tracking-wide flex items-center space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Chi Phí Ngoài Ý Muốn</span>
                </h4>
                <button
                  type="button"
                  onClick={() => handleOpenAddCustomExpense('unexpected')}
                  className="text-[11px] font-bold text-rose-700 hover:underline cursor-pointer"
                >
                  + Thêm phát sinh
                </button>
              </div>

              <div className="text-xs text-slate-600">
                Tổng cộng phát sinh đột xuất:{' '}
                <strong className="text-rose-700 font-black">{formatCurrencyVND(computedUnexpectedExpenses)}</strong>
              </div>

              {(activeMonthRecord.customExpenses || []).filter((e) => e.expenseType === 'unexpected').length === 0 ? (
                <div className="text-center py-3 text-xs text-slate-400">
                  Tháng này chưa có chi phí ngoài ý muốn nào 🎉
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {(activeMonthRecord.customExpenses || [])
                    .filter((e) => e.expenseType === 'unexpected')
                    .map((item) => (
                      <div
                        key={item.id}
                        className="p-2 bg-rose-50/60 border border-rose-200 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="truncate mr-2">
                          <div className="font-bold text-slate-900 truncate">{item.name}</div>
                          <div className="text-[10px] text-slate-500">{item.paidDate || 'Phát sinh'}</div>
                        </div>
                        <div className="font-black text-rose-700 shrink-0 font-mono">
                          {formatCurrencyVND(item.amount)}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DOANH THU & TIỀN VỀ (REVENUE) */}
      {activeSection === 'revenue' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>Danh Sách Nguồn Tiền Về (Doanh Thu) - {activeMonthRecord.title || selectedMonthKey}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Các nguồn doanh thu Facebook Ads, Booking Reels, Dịch vụ Group do Admin quản lý nhập vào.
              </p>
            </div>

            <button
              type="button"
              id="btn-add-revenue-item"
              onClick={handleOpenAddRevenue}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Thêm Khoản Thu Mới</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-black border-b border-slate-200 text-[11px] uppercase tracking-wide">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">STT</th>
                  <th className="py-2.5 px-3">Tên Nguồn Thu / Dịch Vụ</th>
                  <th className="py-2.5 px-3">Đối Tác / Khách Hàng</th>
                  <th className="py-2.5 px-3 text-center">Ngày Nhận</th>
                  <th className="py-2.5 px-3 text-right">Số Tiền (VNĐ)</th>
                  <th className="py-2.5 px-3">Ghi Chú</th>
                  <th className="py-2.5 px-3 w-20 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!activeMonthRecord.revenueItems || activeMonthRecord.revenueItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Chưa có khoản thu nào trong tháng này. Hãy bấm <strong>"+ Thêm Khoản Thu Mới"</strong> để nhập!
                    </td>
                  </tr>
                ) : (
                  activeMonthRecord.revenueItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{item.sourceName}</td>
                      <td className="py-2.5 px-3 text-slate-600">{item.payerName || '-'}</td>
                      <td className="py-2.5 px-3 text-center text-slate-600 font-mono text-[11px]">
                        {item.receivedDate || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-emerald-700 text-sm font-mono">
                        {formatCurrencyVND(item.amount)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px] max-w-xs truncate">
                        {item.note || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditRevenue(item)}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                            title="Sửa khoản thu"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRevenueItem(item.id)}
                            className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Xóa khoản thu"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-emerald-50/90 font-black text-xs border-t-2 border-emerald-300">
                <tr>
                  <td colSpan={4} className="py-2.5 px-3 text-right text-emerald-900 uppercase">
                    TỔNG CỘNG DOANH THU:
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-800 text-sm font-mono">
                    {formatCurrencyVND(computedTotalRevenue)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CHI PHÍ VĂN PHÒNG, ĐIỆN, NƯỚC & CHI PHÍ NGOÀI Ý MUỐN (EXPENSES) */}
      {activeSection === 'expenses' && (
        <div className="space-y-5">
          {/* 3.1 Khối chi phí cố định (Văn phòng, Điện, Nước, Mạng) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-amber-600" />
                  <span>Chi Phí Cố Định Hàng Tháng (Văn Phòng, Điện, Nước, Internet)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chỉnh sửa trực tiếp số tiền hoặc ghi chú chi phí cố định cho {activeMonthRecord.title || selectedMonthKey}.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleOpenAddCustomExpense('fixed')}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Thêm Chi Phí Cố Định Mới</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. Tiền thuê văn phòng */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center space-x-1.5 text-xs font-black text-slate-800">
                  <Building2 className="w-4 h-4 text-amber-600" />
                  <span>Tiền Thuê Văn Phòng (Mặt Bằng)</span>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Số tiền (VNĐ):</label>
                  <input
                    type="number"
                    value={workingOfficeCost}
                    onChange={(e) => setWorkingOfficeCost(parseNumberInput(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-900 font-mono"
                  />
                  <span className="text-[10px] text-amber-700 font-bold mt-0.5 block truncate">
                    = {formatCurrencyVND(workingOfficeCost)}
                  </span>
                </div>
                <div>
                  <input
                    type="text"
                    value={workingOfficeNote}
                    onChange={(e) => setWorkingOfficeNote(e.target.value)}
                    placeholder="Ghi chú mặt bằng, địa điểm..."
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-[11px] text-slate-700"
                  />
                </div>
              </div>

              {/* 2. Tiền điện */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center space-x-1.5 text-xs font-black text-slate-800">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span>Tiền Điện Sinh Hoạt & Dàn Máy Tool</span>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Số tiền (VNĐ):</label>
                  <input
                    type="number"
                    value={workingElectricityCost}
                    onChange={(e) => setWorkingElectricityCost(parseNumberInput(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-900 font-mono"
                  />
                  <span className="text-[10px] text-yellow-700 font-bold mt-0.5 block truncate">
                    = {formatCurrencyVND(workingElectricityCost)}
                  </span>
                </div>
                <div>
                  <input
                    type="text"
                    value={workingElectricityNote}
                    onChange={(e) => setWorkingElectricityNote(e.target.value)}
                    placeholder="Ghi chú chỉ số điện, kWh..."
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-[11px] text-slate-700"
                  />
                </div>
              </div>

              {/* 3. Tiền nước */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center space-x-1.5 text-xs font-black text-slate-800">
                  <Droplets className="w-4 h-4 text-cyan-500" />
                  <span>Tiền Nước Sinh Hoạt</span>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Số tiền (VNĐ):</label>
                  <input
                    type="number"
                    value={workingWaterCost}
                    onChange={(e) => setWorkingWaterCost(parseNumberInput(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-900 font-mono"
                  />
                  <span className="text-[10px] text-cyan-700 font-bold mt-0.5 block truncate">
                    = {formatCurrencyVND(workingWaterCost)}
                  </span>
                </div>
                <div>
                  <input
                    type="text"
                    value={workingWaterNote}
                    onChange={(e) => setWorkingWaterNote(e.target.value)}
                    placeholder="Ghi chú nước máy + nước uống..."
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-[11px] text-slate-700"
                  />
                </div>
              </div>

              {/* 4. Mạng Internet & Proxy */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center space-x-1.5 text-xs font-black text-slate-800">
                  <Wifi className="w-4 h-4 text-indigo-500" />
                  <span>Mạng Internet & Proxy Nuôi Via</span>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Số tiền (VNĐ):</label>
                  <input
                    type="number"
                    value={workingInternetCost}
                    onChange={(e) => setWorkingInternetCost(parseNumberInput(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-900 font-mono"
                  />
                  <span className="text-[10px] text-indigo-700 font-bold mt-0.5 block truncate">
                    = {formatCurrencyVND(workingInternetCost)}
                  </span>
                </div>
                <div>
                  <input
                    type="text"
                    value={workingInternetNote}
                    onChange={(e) => setWorkingInternetNote(e.target.value)}
                    placeholder="Gói cước mạng, proxy..."
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-[11px] text-slate-700"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleSaveMonth}
                disabled={isSaving}
                className="inline-flex items-center space-x-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu Khoản Chi Phí Cố Định</span>
              </button>
            </div>
          </div>

          {/* 3.2 BẢNG CHI PHÍ HÀNG THÁNG & CÁC KHOẢN PHÁT SINH NGOÀI Ý MUỐN (Yêu cầu thêm mục tự thêm & ngoài ý muốn) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Bảng Chi Phí Hàng Tháng & Các Mục Tự Thêm (Chi Phí Ngoài Ý Muốn)</span>
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                    {activeMonthRecord.customExpenses?.length || 0} mục
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tự thêm các mục chi phí đột xuất ngoài ý muốn (sửa chữa máy tính, thiết bị, liên hoan, phạt, v.v.) hoặc các chi phí hàng tháng khác.
                </p>
              </div>

              {/* Nút thêm mới */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  id="btn-add-unexpected-expense"
                  onClick={() => handleOpenAddCustomExpense('unexpected')}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer hover:scale-[1.02]"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>+ Thêm Chi Phí Ngoài Ý Muốn</span>
                </button>

                <button
                  type="button"
                  id="btn-add-custom-expense"
                  onClick={() => handleOpenAddCustomExpense('other')}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Thêm Khoản Chi Tự Thêm</span>
                </button>
              </div>
            </div>

            {/* Thanh lọc loại chi phí */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="text-slate-500">Lọc theo loại:</span>
              <button
                type="button"
                onClick={() => setExpenseFilterType('all')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  expenseFilterType === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất cả ({(activeMonthRecord.customExpenses || []).length})
              </button>

              <button
                type="button"
                onClick={() => setExpenseFilterType('unexpected')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center space-x-1 ${
                  expenseFilterType === 'unexpected'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>
                  Ngoài ý muốn (
                  {(activeMonthRecord.customExpenses || []).filter((e) => e.expenseType === 'unexpected').length}
                  )
                </span>
              </button>

              <button
                type="button"
                onClick={() => setExpenseFilterType('fixed')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  expenseFilterType === 'fixed'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                Cố định tự thêm (
                {(activeMonthRecord.customExpenses || []).filter((e) => e.expenseType === 'fixed').length}
                )
              </button>

              <button
                type="button"
                onClick={() => setExpenseFilterType('tools')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  expenseFilterType === 'tools'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                }`}
              >
                Tool & Công cụ (
                {(activeMonthRecord.customExpenses || []).filter((e) => e.expenseType === 'tools').length}
                )
              </button>
            </div>

            {/* Bảng danh sách chi phí hàng tháng chi tiết */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-black border-b border-slate-200 text-[11px] uppercase tracking-wide">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">STT</th>
                    <th className="py-2.5 px-3">Tên Mục Chi Phí Tự Thêm</th>
                    <th className="py-2.5 px-3 text-center">Phân Loại</th>
                    <th className="py-2.5 px-3 text-right">Số Tiền (VNĐ)</th>
                    <th className="py-2.5 px-3 text-center">Ngày Chi</th>
                    <th className="py-2.5 px-3">Người Chi / Duyệt</th>
                    <th className="py-2.5 px-3 text-center">Hình Thức</th>
                    <th className="py-2.5 px-3">Lý Do / Ghi Chú Phát Sinh</th>
                    <th className="py-2.5 px-3 w-20 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCustomExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        Chưa có mục chi phí tự thêm nào phù hợp bộ lọc. Hãy bấm{' '}
                        <strong className="text-rose-600">"+ Thêm Chi Phí Ngoài Ý Muốn"</strong> hoặc{' '}
                        <strong>"+ Thêm Khoản Chi Tự Thêm"</strong>!
                      </td>
                    </tr>
                  ) : (
                    filteredCustomExpenses.map((item, idx) => {
                      const isUnexpected = item.expenseType === 'unexpected';
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50 transition-colors ${
                            isUnexpected ? 'bg-rose-50/20' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-black text-slate-900">
                            <div className="flex items-center space-x-1.5">
                              {isUnexpected ? (
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              ) : (
                                <Receipt className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              )}
                              <span>{item.name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isUnexpected ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                <span>Ngoài Ý Muốn</span>
                              </span>
                            ) : item.expenseType === 'fixed' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                                <span>Cố Định Tự Thêm</span>
                              </span>
                            ) : item.expenseType === 'tools' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-300">
                                <span>Tool & Proxy</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                <span>Khác</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black font-mono text-sm">
                            <span className={isUnexpected ? 'text-rose-700' : 'text-slate-800'}>
                              {formatCurrencyVND(item.amount)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-600 font-mono text-[11px]">
                            {item.paidDate || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 font-medium">
                            {item.payer || 'Admin'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              {item.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 text-[11px] max-w-xs truncate" title={item.note}>
                            {item.note || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditCustomExpense(item)}
                                className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                                title="Sửa khoản chi"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomExpense(item.id)}
                                className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                title="Xóa khoản chi"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="bg-rose-50/90 font-black text-xs border-t-2 border-rose-300">
                  <tr>
                    <td colSpan={3} className="py-2.5 px-3 text-right text-rose-900 uppercase">
                      TỔNG CỘNG CÁC MỤC CHI PHÍ TỰ THÊM:
                    </td>
                    <td className="py-2.5 px-3 text-right text-rose-800 text-sm font-mono">
                      {formatCurrencyVND(computedTotalCustomExpenses)}
                    </td>
                    <td colSpan={5} className="py-2.5 px-3 text-rose-700 text-[11px]">
                      (Trong đó chi phí ngoài ý muốn: <strong>{formatCurrencyVND(computedUnexpectedExpenses)}</strong>)
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: BẢNG LƯƠNG NHÂN VIÊN, NGÀY CÔNG & THƯỞNG KPI (SALARIES) */}
      {activeSection === 'salaries' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center space-x-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>Bảng Lương, Ngày Công Thực Tế, Tài Khoản Ngân Hàng & KPI ({activeMonthRecord.title || selectedMonthKey})</span>
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                  {activeMonthRecord.salaryItems?.length || 0} nhân sự
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Lương theo ngày công thực tế (Lương thử việc / Lương chính thức) + Thưởng KPI doanh thu nguồn tiền về (5% - 10%) + Cột số tài khoản ngân hàng.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSyncAllStaffIntoSalary}
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200"
                title="Tự động thêm nhân viên còn thiếu vào bảng lương"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Đồng Bộ NV Hệ Thống</span>
              </button>

              <button
                type="button"
                onClick={handleMarkAllSalariesPaid}
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-emerald-200"
                title="Đánh dấu tất cả nhân sự đã nhận lương tháng này"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Đã Trả Hết Lương</span>
              </button>

              {/* Nút tích hiện / ẩn hàng loạt cho nhân viên */}
              <button
                type="button"
                onClick={() => handleToggleAllSalariesVisibility(true)}
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-blue-200"
                title="Tích hiện thông tin Lương, Doanh thu và Tổng lương cho tất cả nhân viên ở Tab Thông Tin Nhân Viên"
              >
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                <span>Tích Hiện Tất Cả Cho NV</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleAllSalariesVisibility(false)}
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200"
                title="Bỏ tích: Ẩn số tiền Lương & Doanh thu với tất cả nhân viên (bỏ trống)"
              >
                <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                <span>Ẩn Với NV (Trống)</span>
              </button>

              <button
                type="button"
                id="btn-add-salary-item"
                onClick={() => handleOpenAddSalary()}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Thêm Nhân Viên</span>
              </button>
            </div>
          </div>

          {/* THANH NHẬP NHANH HỌ TÊN NHÂN VIÊN MỚI (TRỰC TIẾP, KHÔNG BỊ CHE - YÊU CẦU 3) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!quickSalaryName.trim()) {
                alert('Vui lòng nhập họ và tên nhân viên!');
                return;
              }
              handleOpenAddSalary(quickSalaryName.trim());
              setQuickSalaryName('');
            }}
            className="p-3.5 bg-gradient-to-r from-blue-50/95 via-indigo-50/95 to-sky-50/95 border-2 border-blue-400 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-2.5 shadow-2xs"
          >
            <div className="flex items-center space-x-2 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-black text-blue-950 uppercase tracking-wide block">
                  Nhập Họ Và Tên Nhân Viên Mới:
                </span>
                <span className="text-[10px] text-blue-700 font-semibold">
                  Nhập trực tiếp tại đây hoặc chọn bấm nút "+ Thêm Nhân Viên"
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-[220px]">
              <input
                type="text"
                list="quick-staff-salary-suggestions"
                placeholder="👉 Nhập họ và tên nhân viên vào đây (VD: Anh Quỳnh, Thu Hà...)..."
                value={quickSalaryName}
                onChange={(e) => setQuickSalaryName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border-2 border-blue-500 rounded-xl text-xs font-black text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:ring-2 focus:ring-blue-600 focus:outline-hidden shadow-xs"
              />
              <datalist id="quick-staff-salary-suggestions">
                {availableStaffNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-xs shrink-0 cursor-pointer hover:scale-[1.02] flex items-center justify-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>+ Thêm Vào Bảng Lương</span>
            </button>
          </form>

          {/* Dàn tóm tắt quỹ lương */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-blue-800 uppercase tracking-wide block">
                  Tổng Quỹ Lương Thực Nhận
                </span>
                <span className="text-base sm:text-lg font-black text-blue-900 font-mono">
                  {formatCurrencyVND(computedTotalSalary)}
                </span>
              </div>
              <Users className="w-5 h-5 text-blue-600" />
            </div>

            <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wide block">
                  Tổng Tiền Thưởng KPI Doanh Thu (5%-10%)
                </span>
                <span className="text-base sm:text-lg font-black text-emerald-800 font-mono">
                  {formatCurrencyVND(computedTotalKpiBonus)}
                </span>
              </div>
              <Percent className="w-5 h-5 text-emerald-600" />
            </div>

            <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-indigo-800 uppercase tracking-wide block">
                  Hỗ Trợ Mạng & Điện (Online)
                </span>
                <span className="text-base sm:text-lg font-black text-indigo-800 font-mono">
                  {formatCurrencyVND(computedTotalOnlineSupport)}
                </span>
                <span className="text-[10px] text-indigo-700 block font-medium">
                  {activeMonthRecord.salaryItems?.filter((s) => s.isOnlineStaff || (s.onlineSupportAllowance && s.onlineSupportAllowance > 0)).length || 0} NV làm online
                </span>
              </div>
              <Wifi className="w-5 h-5 text-indigo-600" />
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide block">
                  Trạng Thái Thanh Toán
                </span>
                <span className="text-xs font-bold text-slate-800">
                  Đã chuyển:{' '}
                  <strong className="text-emerald-700 font-black">
                    {activeMonthRecord.salaryItems?.filter((s) => s.isPaid).length || 0}
                  </strong>{' '}
                  / {activeMonthRecord.salaryItems?.length || 0} nhân sự
                </span>
              </div>
              <CreditCard className="w-5 h-5 text-slate-600" />
            </div>
          </div>

          {/* Bảng lương chi tiết */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-black border-b border-slate-200 text-[11px] uppercase tracking-wide">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">STT</th>
                  <th className="py-2.5 px-3">Nhân Viên & Chế Độ</th>
                  <th className="py-2.5 px-3">Hồ Sơ Nhân Sự (Ngày Sinh / CCCD / Đi Làm)</th>
                  <th className="py-2.5 px-3">Tài Khoản Ngân Hàng (STK / Chủ TK)</th>
                  <th className="py-2.5 px-3 text-center">Ngày Công Thực Tế</th>
                  <th className="py-2.5 px-3 text-right">Lương Theo Công</th>
                  <th className="py-2.5 px-3 text-right">Doanh Thu Mang Về & KPI</th>
                  <th className="py-2.5 px-3 text-right">Hỗ Trợ Mạng/Điện (Online)</th>
                  <th className="py-2.5 px-3 text-right">Thưởng Khác / Trừ</th>
                  <th className="py-2.5 px-3 text-right">Tổng Thực Nhận</th>
                  <th className="py-2.5 px-3 text-center">Hiển Thị Cho NV</th>
                  <th className="py-2.5 px-3 text-center">Trạng Thái</th>
                  <th className="py-2.5 px-3 text-center">Ngày Chi</th>
                  <th className="py-2.5 px-3">Ghi Chú</th>
                  <th className="py-2.5 px-3 w-20 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!activeMonthRecord.salaryItems || activeMonthRecord.salaryItems.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="py-8 text-center text-slate-400">
                      Chưa có nhân viên nào trong bảng lương tháng này. Hãy bấm{' '}
                      <strong>"Đồng Bộ NV Hệ Thống"</strong> hoặc <strong>"+ Thêm Nhân Viên"</strong>!
                    </td>
                  </tr>
                ) : (
                  activeMonthRecord.salaryItems.map((item, idx) => {
                    const isProbation = item.contractType === 'probation';
                    const workingDays = item.actualWorkingDays ?? 26;
                    const stdDays = item.standardWorkingDays || 26;
                    const salaryByDays = item.salaryByWorkingDays ?? Math.round((item.baseSalary / stdDays) * workingDays);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>

                        {/* Tên nhân viên & Chế độ */}
                        <td className="py-2.5 px-3">
                          <div className="font-black text-slate-900 flex items-center space-x-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                            <span>{item.staffName}</span>
                          </div>
                          <div className="mt-0.5">
                            {isProbation ? (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                                Lương Thử Việc
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                Lương Chính Thức
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500 ml-1 font-mono">
                              ({formatCurrencyVND(item.baseSalary)})
                            </span>
                          </div>
                        </td>

                        {/* Thông tin nhân sự: Ngày sinh, Số CCCD, Ngày bắt đầu đi làm (Yêu cầu mới) */}
                        <td className="py-2.5 px-3">
                          {item.dateOfBirth || item.citizenId || item.startDate ? (
                            <div className="space-y-1">
                              {item.citizenId && (
                                <div className="flex items-center space-x-1.5 font-mono text-slate-900 font-bold">
                                  <span className="text-[10px] px-1 py-0.2 bg-slate-100 border border-slate-200 rounded text-slate-600 font-sans font-black">
                                    CCCD
                                  </span>
                                  <span className="text-xs">{item.citizenId}</span>
                                </div>
                              )}
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-600">
                                {item.dateOfBirth && (
                                  <span className="inline-flex items-center space-x-1 text-slate-700">
                                    <Calendar className="w-3 h-3 text-blue-500 shrink-0" />
                                    <span>Sinh: <b>{item.dateOfBirth}</b></span>
                                  </span>
                                )}
                                {item.startDate && (
                                  <span className="inline-flex items-center space-x-1 text-slate-700">
                                    <Briefcase className="w-3 h-3 text-amber-600 shrink-0" />
                                    <span>Đi làm: <b>{item.startDate}</b></span>
                                  </span>
                                )}
                              </div>
                              <div className="pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleToggleProfileVisibility(item.id)}
                                  className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-black cursor-pointer border transition-all ${
                                    item.isProfileVisibleToStaff !== false
                                      ? 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100'
                                      : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                                  }`}
                                  title="Tích để hiện thông tin Hồ Sơ Nhân Sự ở Bảng 8 cho nhân viên đó xem luôn"
                                >
                                  {item.isProfileVisibleToStaff !== false ? (
                                    <>
                                      <Check className="w-2.5 h-2.5 text-blue-600" />
                                      <span>Hiện Hồ Sơ NV</span>
                                    </>
                                  ) : (
                                    <>
                                      <EyeOff className="w-2.5 h-2.5 text-slate-400" />
                                      <span>Ẩn Hồ Sơ NV</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400 italic">
                              Chưa cập nhật hồ sơ
                            </div>
                          )}
                        </td>

                        {/* Tài khoản ngân hàng của nhân viên (Cột mới yêu cầu) */}
                        <td className="py-2.5 px-3">
                          {item.bankAccountNumber ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center space-x-1 font-mono font-bold text-slate-800">
                                <span>{item.bankAccountNumber}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyBankAccount(item.bankAccountNumber || '', item.id)}
                                  className="p-0.5 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                                  title="Sao chép số tài khoản"
                                >
                                  {copiedBankAccId === item.id ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                              <div className="text-[10px] text-slate-500 font-semibold truncate max-w-[160px]">
                                {item.bankName || 'Ngân hàng'} • {item.bankAccountHolder || item.staffName}
                              </div>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400 italic flex items-center space-x-1">
                              <CreditCard className="w-3 h-3" />
                              <span>Chưa nhập STK</span>
                            </div>
                          )}
                        </td>

                        {/* Ngày công đi làm thực tế (Cột mới yêu cầu) */}
                        <td className="py-2.5 px-3 text-center">
                          <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                            {workingDays} / {stdDays} công
                          </span>
                        </td>

                        {/* Lương tính theo ngày công thực tế */}
                        <td className="py-2.5 px-3 text-right text-slate-800 font-mono font-bold">
                          {formatCurrencyVND(salaryByDays)}
                        </td>

                        {/* Doanh thu tiền về & Thưởng KPI 5% - 10% (Cột mới yêu cầu) */}
                        <td className="py-2.5 px-3 text-right font-mono">
                          <div className="font-black text-emerald-700">
                            +{formatCurrencyVND(item.kpiBonus || 0)}
                          </div>
                          {item.revenueGenerated ? (
                            <div className="text-[10px] text-emerald-600 font-semibold">
                              Doanh thu: {formatCurrencyVND(item.revenueGenerated)} ({item.kpiRate ?? 10}%)
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400">KPI cứng</div>
                          )}
                        </td>

                        {/* Hỗ trợ tiền mạng, điện cho nhân viên làm online (Yêu cầu 5: cộng vào lương) */}
                        <td className="py-2.5 px-3 text-right font-mono">
                          {item.onlineSupportAllowance && item.onlineSupportAllowance > 0 ? (
                            <div>
                              <div className="font-black text-indigo-700">
                                +{formatCurrencyVND(item.onlineSupportAllowance)}
                              </div>
                              <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                                <Wifi className="w-2.5 h-2.5 text-indigo-600" />
                                <span>Làm Online</span>
                              </span>
                            </div>
                          ) : item.isOnlineStaff ? (
                            <div>
                              <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                <Wifi className="w-2.5 h-2.5 text-slate-400" />
                                <span>Online (0đ)</span>
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono">-</span>
                          )}
                        </td>

                        {/* Thưởng khác / Trừ phạt */}
                        <td className="py-2.5 px-3 text-right font-mono text-[11px]">
                          {item.otherBonus ? (
                            <div className="text-teal-600 font-bold">+{formatCurrencyVND(item.otherBonus)}</div>
                          ) : null}
                          {item.deduction > 0 ? (
                            <div className="text-rose-600 font-bold">-{formatCurrencyVND(item.deduction)}</div>
                          ) : null}
                          {!item.otherBonus && !item.deduction && <span className="text-slate-400">-</span>}
                        </td>

                        {/* Tổng thực nhận */}
                        <td className="py-2.5 px-3 text-right font-black text-blue-700 text-sm font-mono">
                          {formatCurrencyVND(item.actualSalary)}
                        </td>

                        {/* Quyền hiển thị cho nhân viên (Yêu cầu mới: Tích hiện mới cho hiện, bỏ tích thì Lương và Doanh thu bỏ trống) */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSalaryVisibility(item.id)}
                            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer transition-all border shadow-2xs ${
                              item.isVisibleToStaff
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                            }`}
                            title={
                              item.isVisibleToStaff
                                ? 'Đang TÍCH HIỆN: Nhân viên xem được Lương & Doanh thu (Bấm để bỏ tích ẩn: số tiền sẽ bỏ trống)'
                                : 'Đang BỎ TÍCH: Lương & Doanh thu bỏ trống ở tab cá nhân của NV (Bấm để tích hiện)'
                            }
                          >
                            {item.isVisibleToStaff ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <Eye className="w-3 h-3 text-emerald-600" />
                                <span>Tích Hiện</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3 h-3 text-slate-400" />
                                <span>Ẩn (Trống)</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Trạng thái chi trả */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleTogglePaidSalary(item.id)}
                            className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black cursor-pointer transition-all ${
                              item.isPaid
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                            }`}
                            title="Bấm để đổi trạng thái Đã trả / Chưa trả"
                          >
                            {item.isPaid ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Đã Thanh Toán</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Chưa Chi Trả</span>
                              </>
                            )}
                          </button>
                        </td>

                        <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]">
                          {item.paidDate || '-'}
                        </td>

                        <td className="py-2.5 px-3 text-slate-500 text-[11px] max-w-xs truncate" title={item.note}>
                          {item.note || '-'}
                        </td>

                        {/* Thao tác */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditSalary(item)}
                              className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                              title="Sửa bảng lương nhân viên"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSalaryItem(item.id)}
                              className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Xóa nhân viên khỏi bảng lương"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="bg-blue-50/90 font-black text-xs border-t-2 border-blue-300">
                <tr>
                  <td colSpan={8} className="py-2.5 px-3 text-right text-blue-900 uppercase">
                    TỔNG CỘNG TIỀN LƯƠNG NHÂN VIÊN (BAO GỒM KPI):
                  </td>
                  <td className="py-2.5 px-3 text-right text-blue-800 text-sm font-mono">
                    {formatCurrencyVND(computedTotalSalary)}
                  </td>
                  <td colSpan={5}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: LỊCH SỬ SO SÁNH & THỐNG KÊ TĂNG GIẢM DOANH THU CÁC THÁNG (ALL MONTHS) */}
      {activeSection === 'all_months' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Header Bảng So Sánh & Thao Tác */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2.5 mb-1">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center shadow-md">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 flex-wrap">
                    <span>Báo Cáo Thống Kê & So Sánh Tăng Giảm Doanh Thu Giữa Các Tháng</span>
                    <span className="text-xs font-black text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                      {monthlyComparisonStats.length} Tháng Ghi Nhận
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Phân tích tốc độ tăng trưởng doanh thu (MoM), tỷ suất sinh lời, biến động chi phí và xu hướng tài chính toàn hệ thống.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setComparisonSortOrder('desc')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    comparisonSortOrder === 'desc'
                      ? 'bg-white text-slate-900 shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Xếp tháng mới nhất lên đầu bảng"
                >
                  Mới nhất trước
                </button>
                <button
                  type="button"
                  onClick={() => setComparisonSortOrder('asc')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    comparisonSortOrder === 'asc'
                      ? 'bg-white text-slate-900 shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Xếp theo trình tự thời gian từ cũ đến mới"
                >
                  Cũ nhất trước
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsNewMonthModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer hover:scale-[1.02]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Thêm Tháng Mới</span>
              </button>

              <button
                type="button"
                onClick={() => setIsManageMonthsModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors border border-slate-200 cursor-pointer"
                title="Quản lý và chọn xóa tháng"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Quản Lý Tháng</span>
              </button>
            </div>
          </div>

          {/* Dàn 4 Thẻ KPI Phân Tích Cấp Điều Hành (Executive KPI Analytics Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Thẻ 1: Tăng Trưởng Doanh Thu Tháng Đang Xem */}
            <div className="bg-gradient-to-br from-indigo-50/90 via-blue-50/80 to-white border-2 border-indigo-200 rounded-2xl p-4 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-indigo-950 uppercase tracking-wide">
                  Tăng Trưởng Tháng Này (MoM)
                </span>
                <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  {(revenueComparisonInsights.currentMonthStat?.diffRevenue || 0) >= 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                </span>
              </div>

              {revenueComparisonInsights.prevMonthStat ? (
                <>
                  <div className={`text-xl font-black font-mono mt-1 ${
                    (revenueComparisonInsights.currentMonthStat?.diffRevenue || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {(revenueComparisonInsights.currentMonthStat?.diffRevenue || 0) >= 0 ? '+' : ''}
                    {formatCurrencyVND(revenueComparisonInsights.currentMonthStat?.diffRevenue || 0)}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <span className={`px-2 py-0.5 rounded-full font-mono text-[11px] ${
                      (revenueComparisonInsights.currentMonthStat?.diffRevenuePercent || 0) >= 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {(revenueComparisonInsights.currentMonthStat?.diffRevenuePercent || 0) >= 0 ? '+' : ''}
                      {revenueComparisonInsights.currentMonthStat?.diffRevenuePercent || 0}%
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      so với {revenueComparisonInsights.prevMonthStat.title}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-lg font-black text-slate-800 font-mono mt-1">
                    {formatCurrencyVND(computedTotalRevenue)}
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Tháng đầu tiên trong danh sách ghi nhận
                  </span>
                </>
              )}
            </div>

            {/* Thẻ 2: Kỷ Lục Doanh Thu Cao Nhất */}
            <div className="bg-gradient-to-br from-emerald-50/90 via-teal-50/80 to-white border-2 border-emerald-200 rounded-2xl p-4 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                  Kỷ Lục Doanh Thu Cao Nhất
                </span>
                <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </span>
              </div>
              <div className="text-xl font-black text-emerald-800 font-mono mt-1">
                {formatCurrencyVND(revenueComparisonInsights.maxRevenueMonth?.revenue || 0)}
              </div>
              <div className="text-xs text-emerald-700 font-bold flex items-center space-x-1">
                <span>🏆 Đạt được:</span>
                <span className="underline cursor-pointer" onClick={() => revenueComparisonInsights.maxRevenueMonth && setSelectedMonthKey(revenueComparisonInsights.maxRevenueMonth.monthKey)}>
                  {revenueComparisonInsights.maxRevenueMonth?.title || 'Chưa có'}
                </span>
              </div>
            </div>

            {/* Thẻ 3: Tỷ Lệ Tăng Trưởng Toàn Hệ Thống */}
            <div className="bg-gradient-to-br from-amber-50/90 via-yellow-50/80 to-white border-2 border-amber-200 rounded-2xl p-4 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-950 uppercase tracking-wide">
                  Tăng Trưởng TB & Hiệu Suất
                </span>
                <span className="w-7 h-7 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
                  <BarChart3 className="w-4 h-4" />
                </span>
              </div>
              <div className="text-xl font-black text-amber-900 font-mono mt-1 flex items-baseline gap-1.5">
                <span>{revenueComparisonInsights.avgMoMGrowthPercent >= 0 ? '+' : ''}{revenueComparisonInsights.avgMoMGrowthPercent}%</span>
                <span className="text-xs text-amber-700 font-bold font-sans">TB/tháng</span>
              </div>
              <div className="text-xs text-amber-800 font-medium flex items-center justify-between">
                <span>TB: <b>{formatCurrencyVND(revenueComparisonInsights.avgRevenue)}</b></span>
                <span className="font-bold text-[11px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded">
                  🟢 {revenueComparisonInsights.upMonthsCount} tăng | 🔴 {revenueComparisonInsights.downMonthsCount} giảm
                </span>
              </div>
            </div>

            {/* Thẻ 4: Tổng Doanh Thu Lũy Kế */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border border-slate-700 rounded-2xl p-4 shadow-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-300 uppercase tracking-wide">
                  Tổng Doanh Thu Lũy Kế
                </span>
                <span className="w-7 h-7 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs shadow-xs">
                  Σ
                </span>
              </div>
              <div className="text-xl font-black text-amber-300 font-mono mt-1">
                {formatCurrencyVND(revenueComparisonInsights.totalAllTimeRevenue)}
              </div>
              <div className="text-[11px] text-slate-300 flex items-center justify-between">
                <span>Tổng Lợi Nhuận:</span>
                <span className={`font-mono font-bold ${revenueComparisonInsights.totalAllTimeProfit >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
                  {revenueComparisonInsights.totalAllTimeProfit >= 0 ? '+' : ''}
                  {formatCurrencyVND(revenueComparisonInsights.totalAllTimeProfit)}
                </span>
              </div>
            </div>
          </div>

          {/* CÔNG CỤ ĐỐI CHIẾU TRỰC TIẾP 2 THÁNG BẤT KỲ (DIRECT 2-MONTH COMPARATIVE ANALYZER) */}
          {monthlyComparisonStats.length >= 2 && directComparisonResult && (
            <div className="bg-gradient-to-br from-indigo-50/70 via-slate-50 to-blue-50/60 border-2 border-indigo-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <ArrowUpDown className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                      <span>Đối Chiếu Trực Tiếp Giữa 2 Tháng Tùy Chọn</span>
                      <span className="text-[10px] font-black bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded-full border border-indigo-300">
                        So Sánh Tùy Biến
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Chọn 2 tháng bất kỳ để phân tích sự chênh lệch doanh thu, biến động chi phí, lương & KPI, và lợi nhuận ròng.
                    </p>
                  </div>
                </div>

                {/* Bộ Chọn 2 Tháng & Nút Đổi Chiều */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center space-x-1.5 bg-white p-1.5 rounded-xl border border-indigo-200 shadow-2xs text-xs">
                    <span className="text-[10px] font-black text-indigo-900 uppercase px-1">Mốc A:</span>
                    <select
                      value={directComparisonResult.keyA}
                      onChange={(e) => setDirectCompareKeyA(e.target.value)}
                      className="bg-indigo-50/80 font-black text-indigo-950 px-2 py-1 rounded-lg border border-indigo-200 focus:outline-hidden cursor-pointer"
                    >
                      {monthlyComparisonStats.map((m) => (
                        <option key={m.monthKey} value={m.monthKey}>
                          {m.title} {m.isCurrent ? '(Đang xem)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const temp = directComparisonResult.keyA;
                      setDirectCompareKeyA(directComparisonResult.keyB);
                      setDirectCompareKeyB(temp);
                    }}
                    className="p-2 bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl transition-all shadow-2xs cursor-pointer"
                    title="Đổi chiều so sánh A <-> B"
                  >
                    <ArrowUpDown className="w-4 h-4" />
                  </button>

                  <div className="flex items-center space-x-1.5 bg-white p-1.5 rounded-xl border border-indigo-200 shadow-2xs text-xs">
                    <span className="text-[10px] font-black text-slate-700 uppercase px-1">Đối Chiếu B:</span>
                    <select
                      value={directComparisonResult.keyB}
                      onChange={(e) => setDirectCompareKeyB(e.target.value)}
                      className="bg-slate-100 font-black text-slate-900 px-2 py-1 rounded-lg border border-slate-200 focus:outline-hidden cursor-pointer"
                    >
                      {monthlyComparisonStats.map((m) => (
                        <option key={m.monthKey} value={m.monthKey}>
                          {m.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Dàn 4 Thẻ So Sánh Chênh Lệch A vs B */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Doanh Thu */}
                <div className="bg-white border-2 border-emerald-200 rounded-xl p-3.5 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-emerald-950 uppercase">
                    <span>Doanh Thu (Tiền Về)</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                      directComparisonResult.diffRev >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {directComparisonResult.diffRev >= 0 ? '+' : ''}{directComparisonResult.diffRevPercent}%
                    </span>
                  </div>
                  <div className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>{directComparisonResult.statA.title}:</span>
                      <strong className="text-emerald-700 font-black">{formatCurrencyVND(directComparisonResult.statA.revenue)}</strong>
                    </div>
                    <div className="flex justify-between items-center text-slate-500">
                      <span>{directComparisonResult.statB.title}:</span>
                      <span>{formatCurrencyVND(directComparisonResult.statB.revenue)}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600">Chênh lệch (A - B):</span>
                    <span className={`font-mono font-black ${
                      directComparisonResult.diffRev >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {directComparisonResult.diffRev >= 0 ? '+' : ''}{formatCurrencyVND(directComparisonResult.diffRev)}
                    </span>
                  </div>
                </div>

                {/* 2. Tổng Chi Phí */}
                <div className="bg-white border-2 border-rose-200 rounded-xl p-3.5 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-rose-950 uppercase">
                    <span>Tổng Chi Phí Phải Chi</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                      directComparisonResult.diffExp > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {directComparisonResult.diffExp >= 0 ? '+' : ''}{directComparisonResult.diffExpPercent}%
                    </span>
                  </div>
                  <div className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>{directComparisonResult.statA.title}:</span>
                      <strong className="text-rose-700 font-black">{formatCurrencyVND(directComparisonResult.statA.totalExpenses)}</strong>
                    </div>
                    <div className="flex justify-between items-center text-slate-500">
                      <span>{directComparisonResult.statB.title}:</span>
                      <span>{formatCurrencyVND(directComparisonResult.statB.totalExpenses)}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600">Chênh lệch:</span>
                    <span className={`font-mono font-black ${
                      directComparisonResult.diffExp > 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}>
                      {directComparisonResult.diffExp >= 0 ? '+' : ''}{formatCurrencyVND(directComparisonResult.diffExp)}
                    </span>
                  </div>
                </div>

                {/* 3. Lợi Nhuận Ròng */}
                <div className="bg-white border-2 border-teal-200 rounded-xl p-3.5 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-teal-950 uppercase">
                    <span>Lợi Nhuận Ròng (Tiền Dư)</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                      directComparisonResult.diffProfit >= 0 ? 'bg-teal-100 text-teal-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {directComparisonResult.diffProfit >= 0 ? '+' : ''}{directComparisonResult.diffProfitPercent}%
                    </span>
                  </div>
                  <div className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>{directComparisonResult.statA.title}:</span>
                      <strong className="text-teal-700 font-black">{formatCurrencyVND(directComparisonResult.statA.netProfit)}</strong>
                    </div>
                    <div className="flex justify-between items-center text-slate-500">
                      <span>{directComparisonResult.statB.title}:</span>
                      <span>{formatCurrencyVND(directComparisonResult.statB.netProfit)}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600">Chênh lệch:</span>
                    <span className={`font-mono font-black ${
                      directComparisonResult.diffProfit >= 0 ? 'text-teal-700' : 'text-rose-700'
                    }`}>
                      {directComparisonResult.diffProfit >= 0 ? '+' : ''}{formatCurrencyVND(directComparisonResult.diffProfit)}
                    </span>
                  </div>
                </div>

                {/* 4. Quỹ Lương & KPI & Online */}
                <div className="bg-white border-2 border-indigo-200 rounded-xl p-3.5 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-indigo-950 uppercase">
                    <span>Lương, KPI & Phụ Cấp</span>
                    <Users className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="space-y-1 font-mono text-[11px]">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Quỹ lương {directComparisonResult.statA.title}:</span>
                      <strong className="text-indigo-900">{formatCurrencyVND(directComparisonResult.statA.salary)}</strong>
                    </div>
                    <div className="flex justify-between items-center text-slate-500">
                      <span>Quỹ lương {directComparisonResult.statB.title}:</span>
                      <span>{formatCurrencyVND(directComparisonResult.statB.salary)}</span>
                    </div>
                    <div className="flex justify-between items-center text-indigo-700 font-bold">
                      <span>Chênh lệch lương:</span>
                      <span>{directComparisonResult.diffSalary >= 0 ? '+' : ''}{formatCurrencyVND(directComparisonResult.diffSalary)}</span>
                    </div>
                  </div>
                  <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-indigo-900 font-bold">
                    <span>Chênh lệch KPI Doanh Thu:</span>
                    <span className="font-mono">
                      {directComparisonResult.diffKpi >= 0 ? '+' : ''}{formatCurrencyVND(directComparisonResult.diffKpi)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Banner Nhận Định So Sánh Tự Động */}
              <div className="p-3 bg-white rounded-xl border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-base shrink-0">
                    {directComparisonResult.diffRev > 0 ? '🚀' : directComparisonResult.diffRev < 0 ? '⚠️' : '⏸️'}
                  </span>
                  <div className="text-slate-800">
                    <b>Nhận định đối chiếu:</b> Doanh thu <b>{directComparisonResult.statA.title}</b>{' '}
                    {directComparisonResult.diffRev > 0 ? (
                      <span className="text-emerald-700 font-bold">
                        tăng {formatCurrencyVND(directComparisonResult.diffRev)} (+{directComparisonResult.diffRevPercent}%)
                      </span>
                    ) : directComparisonResult.diffRev < 0 ? (
                      <span className="text-rose-700 font-bold">
                        giảm {formatCurrencyVND(Math.abs(directComparisonResult.diffRev))} ({directComparisonResult.diffRevPercent}%)
                      </span>
                    ) : (
                      <span className="text-slate-600 font-bold">tương đương (0%)</span>
                    )}{' '}
                    so với <b>{directComparisonResult.statB.title}</b>. Lợi nhuận ròng{' '}
                    {directComparisonResult.diffProfit >= 0 ? (
                      <span className="text-teal-700 font-bold">
                        tăng +{formatCurrencyVND(directComparisonResult.diffProfit)}
                      </span>
                    ) : (
                      <span className="text-rose-700 font-bold">
                        giảm {formatCurrencyVND(Math.abs(directComparisonResult.diffProfit))}
                      </span>
                    )}.
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMonthKey(directComparisonResult.statA.monthKey);
                      setActiveSection('overview');
                    }}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Xem Chi Tiết {directComparisonResult.statA.title} →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Biểu Đồ Cột Trực Quan Tăng Trưởng Doanh Thu Từng Tháng (Visual MoM Growth Bar Chart) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  <span>Biểu Đồ So Sánh Tăng Trưởng Doanh Thu Theo Trình Tự Thời Gian</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Màu xanh thể hiện tháng tăng trưởng so với tháng trước; Màu đỏ thể hiện tháng giảm sút. Click vào cột để chuyển xem tháng đó.
                </p>
              </div>

              <div className="flex items-center space-x-3 text-xs font-bold shrink-0">
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-3 rounded-md bg-emerald-500"></span>
                  <span className="text-slate-600">Tăng Trưởng</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-3 rounded-md bg-rose-500"></span>
                  <span className="text-slate-600">Giảm Sút</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-3 rounded-md bg-indigo-600 ring-2 ring-indigo-300"></span>
                  <span className="text-slate-900">Tháng Đang Xem</span>
                </span>
              </div>
            </div>

            {/* Container Biểu Đồ Cột */}
            <div className="pt-6 pb-2 px-2 overflow-x-auto">
              <div className="min-w-[620px] h-64 flex items-end justify-between gap-3 sm:gap-4 border-b-2 border-slate-200 pb-2">
                {monthlyComparisonStats.map((item) => {
                  const maxVal = Math.max(1, revenueComparisonInsights.maxRevenueMonth?.revenue || 1);
                  const rawPercent = Math.round((item.revenue / maxVal) * 100);
                  const barHeightPercent = Math.max(14, rawPercent);
                  const isCurrent = item.isCurrent;

                  // Màu gradient
                  let gradientClass = 'from-blue-500 to-indigo-600';
                  if (item.revenueTrend === 'up') gradientClass = 'from-emerald-500 to-teal-600';
                  else if (item.revenueTrend === 'down') gradientClass = 'from-rose-500 to-amber-600';

                  return (
                    <div
                      key={item.monthKey}
                      onClick={() => {
                        setSelectedMonthKey(item.monthKey);
                        setActiveSection('overview');
                      }}
                      className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer transition-all"
                      title={`${item.title}: ${formatCurrencyVND(item.revenue)} (${item.diffRevenuePercent >= 0 ? '+' : ''}${item.diffRevenuePercent}% so với tháng trước)`}
                    >
                      {/* Top Label: Doanh thu & Badge % */}
                      <div className="mb-2 text-center transition-transform group-hover:scale-105 space-y-0.5">
                        <span className="font-mono font-black text-slate-800 text-[11px] block whitespace-nowrap">
                          {formatCurrencyVND(item.revenue)}
                        </span>
                        {item.hasPrevious && (
                          <span
                            className={`inline-flex items-center space-x-0.5 px-1.5 py-0.2 rounded-md text-[10px] font-black font-mono ${
                              item.diffRevenue >= 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.diffRevenue >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                            <span>
                              {item.diffRevenuePercent >= 0 ? '+' : ''}
                              {item.diffRevenuePercent}%
                            </span>
                          </span>
                        )}
                        {item.isCurrent && (
                          <span className="block text-[9px] font-black uppercase text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded-full mt-0.5">
                            Đang xem
                          </span>
                        )}
                      </div>

                      {/* Cột biểu đồ */}
                      <div className="w-full max-w-[56px] relative flex items-end justify-center">
                        <div
                          style={{ height: `${barHeightPercent}%` }}
                          className={`w-full rounded-t-xl bg-gradient-to-t ${gradientClass} transition-all duration-300 shadow-sm group-hover:brightness-110 relative ${
                            isCurrent ? 'ring-4 ring-indigo-400/60 ring-offset-1' : ''
                          }`}
                        >
                          {/* Đỉnh cột lấp lánh */}
                          <div className="absolute top-0 inset-x-0 h-1.5 bg-white/40 rounded-t-xl"></div>
                        </div>
                      </div>

                      {/* Chân cột: Tên tháng */}
                      <div className="mt-2 text-center">
                        <span className={`text-[11px] font-bold block whitespace-nowrap transition-colors ${
                          isCurrent ? 'text-indigo-900 font-black' : 'text-slate-600 group-hover:text-slate-900'
                        }`}>
                          {item.title}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          Lãi: {formatCurrencyVND(item.netProfit)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bảng Thống Kê So Sánh Tăng / Giảm Chi Tiết */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide flex items-center space-x-2">
                  <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                  <span>Bảng Chi Tiết Biến Động Doanh Thu & Lợi Nhuận Qua Từng Tháng</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Bảng tổng hợp đối chiếu doanh thu, chi phí, lợi nhuận và mức tăng giảm (MoM) so với tháng trước.
                </p>
              </div>

              <span className="text-xs text-slate-400 font-medium">
                Đang hiển thị {monthlyComparisonStats.length} tháng ({comparisonSortOrder === 'desc' ? 'Mới nhất trên cùng' : 'Cũ nhất trên cùng'})
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-black border-b border-slate-200 text-[11px] uppercase tracking-wide">
                  <tr>
                    <th className="py-3 px-3 w-12 text-center text-slate-400">#</th>
                    <th className="py-3 px-3 min-w-[150px]">Tháng / Năm</th>
                    <th className="py-3 px-3 text-right min-w-[150px]">Tổng Doanh Thu</th>
                    <th className="py-3 px-3 text-center min-w-[180px]">Tăng / Giảm Doanh Thu (MoM)</th>
                    <th className="py-3 px-3 text-right min-w-[140px]">Tổng Chi Phí</th>
                    <th className="py-3 px-3 text-right min-w-[150px]">Lợi Nhuận Ròng</th>
                    <th className="py-3 px-3 text-center min-w-[110px]">Tỷ Suất Lãi</th>
                    <th className="py-3 px-3 text-center min-w-[130px]">Đánh Giá Xu Hướng</th>
                    <th className="py-3 px-3 text-center min-w-[140px]">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    const displayList = comparisonSortOrder === 'desc'
                      ? [...monthlyComparisonStats].reverse()
                      : monthlyComparisonStats;

                    return displayList.map((item, idx) => {
                      const isCurrent = item.isCurrent;
                      const isMaxRevenue = revenueComparisonInsights.maxRevenueMonth?.monthKey === item.monthKey;
                      const isProfitable = item.netProfit >= 0;

                      return (
                        <tr
                          key={item.monthKey}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isCurrent ? 'bg-amber-50/70 font-semibold' : ''
                          }`}
                        >
                          {/* STT */}
                          <td className="py-3.5 px-3 text-center font-bold text-slate-400">
                            {idx + 1}
                          </td>

                          {/* Tháng / Năm */}
                          <td className="py-3.5 px-3">
                            <div className="flex items-center space-x-2">
                              {isCurrent && <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>}
                              <div>
                                <span className="font-black text-slate-900 text-sm block">
                                  {item.title}
                                </span>
                                {isCurrent && (
                                  <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded-full font-bold inline-block mt-0.5">
                                    Tháng Đang Xem
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Tổng Doanh Thu */}
                          <td className="py-3.5 px-3 text-right">
                            <div className="font-mono font-black text-sm text-emerald-700">
                              {formatCurrencyVND(item.revenue)}
                            </div>
                            {isMaxRevenue && (
                              <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.2 rounded inline-block mt-0.5">
                                🏆 Cao nhất
                              </span>
                            )}
                          </td>

                          {/* So Sánh Tăng / Giảm Doanh Thu (MoM) */}
                          <td className="py-3.5 px-3 text-center">
                            {item.hasPrevious ? (
                              <div className="space-y-1">
                                <div className="flex items-center justify-center space-x-1 font-mono font-bold">
                                  <span
                                    className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-black ${
                                      item.diffRevenue >= 0
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}
                                  >
                                    {item.diffRevenue >= 0 ? (
                                      <TrendingUp className="w-3.5 h-3.5" />
                                    ) : (
                                      <TrendingDown className="w-3.5 h-3.5" />
                                    )}
                                    <span>
                                      {item.diffRevenue >= 0 ? '+' : ''}
                                      {item.diffRevenuePercent}%
                                    </span>
                                  </span>
                                </div>
                                <div className={`font-mono text-xs font-black ${
                                  item.diffRevenue >= 0 ? 'text-emerald-700' : 'text-rose-700'
                                }`}>
                                  {item.diffRevenue >= 0 ? '+' : ''}
                                  {formatCurrencyVND(item.diffRevenue)}
                                </div>
                                <span className="text-[10px] text-slate-400 block">
                                  (vs {item.prevMonthTitle})
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                                Tháng Khởi Đầu
                              </span>
                            )}
                          </td>

                          {/* Tổng Chi Phí */}
                          <td className="py-3.5 px-3 text-right">
                            <div className="font-mono font-bold text-slate-800">
                              {formatCurrencyVND(item.totalExpenses)}
                            </div>
                            {item.hasPrevious && (
                              <span className={`text-[10px] font-mono block mt-0.5 ${
                                item.diffExpenses > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'
                              }`}>
                                {item.diffExpenses >= 0 ? '+' : ''}
                                {formatCurrencyVND(item.diffExpenses)} ({item.diffExpensesPercent >= 0 ? '+' : ''}{item.diffExpensesPercent}%)
                              </span>
                            )}
                          </td>

                          {/* Lợi Nhuận Ròng */}
                          <td className="py-3.5 px-3 text-right">
                            <div className={`font-mono font-black text-sm ${
                              isProfitable ? 'text-teal-700' : 'text-rose-700'
                            }`}>
                              {isProfitable ? '+' : ''}
                              {formatCurrencyVND(item.netProfit)}
                            </div>
                            {item.hasPrevious && (
                              <span className={`text-[10px] font-mono block mt-0.5 ${
                                item.diffProfit >= 0 ? 'text-teal-600 font-bold' : 'text-rose-600 font-bold'
                              }`}>
                                {item.diffProfit >= 0 ? '+' : ''}
                                {formatCurrencyVND(item.diffProfit)} ({item.diffProfitPercent >= 0 ? '+' : ''}{item.diffProfitPercent}%)
                              </span>
                            )}
                          </td>

                          {/* Tỷ Suất Lợi Nhuận */}
                          <td className="py-3.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-black font-mono ${
                              item.profitMargin >= 30
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.profitMargin >= 10
                                ? 'bg-teal-100 text-teal-800'
                                : item.profitMargin >= 0
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {item.profitMargin}%
                            </span>
                          </td>

                          {/* Đánh Giá Xu Hướng */}
                          <td className="py-3.5 px-3 text-center">
                            {isMaxRevenue ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                <span>🏆 Kỷ Lục Doanh Thu</span>
                              </span>
                            ) : item.diffRevenuePercent >= 15 ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                                <span>🚀 Bứt Phá Mạnh</span>
                              </span>
                            ) : item.diffRevenuePercent > 0 ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                                <span>📈 Tăng Trưởng Tốt</span>
                              </span>
                            ) : item.diffRevenuePercent === 0 ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                <span>⏸️ Ổn Định</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                <span>📉 Cần Thúc Đẩy</span>
                              </span>
                            )}
                          </td>

                          {/* Thao Tác */}
                          <td className="py-3.5 px-3 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedMonthKey(item.monthKey);
                                  setActiveSection('overview');
                                }}
                                className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                              >
                                Xem Tháng
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCopySourceMonthKey(item.monthKey);
                                  setIsCopyFromMonthModalOpen(true);
                                }}
                                className="p-1 text-slate-400 hover:text-blue-600 rounded-lg cursor-pointer"
                                title="Sao chép dữ liệu tháng này sang tháng khác"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMonth(item.record.id || item.monthKey)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                                title="Xóa dữ liệu tháng này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 1: THÊM / SỬA NGUỒN TIỀN VỀ (REVENUE ITEM) */}
      {/* ========================================== */}
      {isRevenueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setIsRevenueModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  {editingRevenueItem ? 'Chỉnh Sửa Khoản Thu' : 'Thêm Nguồn Tiền Về (Doanh Thu)'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Nhập số tiền và nguồn thu đối tác trong {activeMonthRecord.title || selectedMonthKey}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveRevenueItem} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên Nguồn Thu / Dịch Vụ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Tiền Ads Facebook, Booking Reels, Bán Page..."
                  value={revenueSourceName}
                  onChange={(e) => setRevenueSourceName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số Tiền Thu Về (VNĐ) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 50000000 hoặc 50.000.000"
                  value={revenueAmountInput}
                  onChange={(e) => setRevenueAmountInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-black text-emerald-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                />
                {parseNumberInput(revenueAmountInput) > 0 && (
                  <span className="text-[11px] text-emerald-600 font-bold mt-1 block">
                    = {formatCurrencyVND(parseNumberInput(revenueAmountInput))}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Đối Tác / Khách Hàng</label>
                  <input
                    type="text"
                    placeholder="Tên Shop / Agency..."
                    value={revenuePayer}
                    onChange={(e) => setRevenuePayer(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ngày Nhận</label>
                  <input
                    type="text"
                    placeholder="VD: 15/10/2026"
                    value={revenueDate}
                    onChange={(e) => setRevenueDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ghi Chú Thêm</label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú điều khoản thanh toán, đợt nhận tiền..."
                  value={revenueNote}
                  onChange={(e) => setRevenueNote(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsRevenueModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer"
                >
                  {editingRevenueItem ? 'Lưu Cập Nhật' : 'Thêm Vào Doanh Thu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 2: THÊM / SỬA LƯƠNG NHÂN VIÊN */}
      {/* (Lương thử việc, Lương chính thức, Ngày công thực tế, STK Ngân hàng, KPI 5% / 10%) */}
      {/* ========================================== */}
      {isSalaryModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs p-2 sm:p-4 md:p-6 flex items-start justify-center min-h-screen animate-fadeIn">
          <div className="bg-white border-2 border-blue-400 rounded-3xl max-w-xl w-full shadow-2xl relative my-auto sm:my-4 flex flex-col max-h-[92vh] overflow-hidden">
            {/* Header: Cố định trên cùng, không bao giờ bị che */}
            <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingSalaryItem ? 'Cập Nhật Lương & Hồ Sơ Nhân Viên' : 'Thêm Nhân Viên Vào Bảng Lương'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {activeMonthRecord.title || selectedMonthKey} • Tính lương theo ngày công & KPI doanh thu
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSalaryModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 cursor-pointer"
                title="Đóng cửa sổ"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form: Có khung cuộn bên trong, bắt đầu ngay từ ô Tên Nhân Viên */}
            <form onSubmit={handleSaveSalaryItem} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {/* 1. KHỐI TÊN NHÂN VIÊN (NỔI BẬT NHẤT Ở ĐẦU FORM, KHÔNG BAO GIỜ BỊ CHE - YÊU CẦU 3) */}
                <div className="p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-sky-50 border-2 border-blue-500 rounded-2xl shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="salary-staff-name-input" className="text-xs font-black text-blue-950 flex items-center space-x-1.5 uppercase">
                      <UserCheck className="w-4 h-4 text-blue-600" />
                      <span>HỌ VÀ TÊN NHÂN VIÊN <span className="text-rose-600 font-black">*</span></span>
                    </label>
                    <span className="text-[10px] font-black text-blue-900 bg-white px-2.5 py-1 rounded-full border-2 border-blue-300 shadow-2xs">
                      BẮT BUỘC NHẬP
                    </span>
                  </div>

                  {/* Input nhập tên trực tiếp */}
                  <div>
                    <input
                      id="salary-staff-name-input"
                      type="text"
                      required
                      autoFocus
                      list="staff-salary-suggestions"
                      placeholder="👉 Nhập họ và tên nhân viên vào đây (VD: Anh Quỳnh, Phương My...)"
                      value={salaryStaffName}
                      onChange={(e) => handleStaffNameChange(e.target.value)}
                      className="w-full px-4 py-3 bg-white border-2 border-blue-600 rounded-xl text-base font-black text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:ring-4 focus:ring-blue-200 focus:outline-hidden shadow-xs"
                    />
                    <datalist id="staff-salary-suggestions">
                      {availableStaffNames.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  </div>

                  {/* Danh sách gợi ý bấm nhanh tên nhân viên có sẵn trong hệ thống */}
                  {availableStaffNames.length > 0 && (
                    <div className="pt-1.5 border-t border-blue-200/70">
                      <span className="text-[10px] font-bold text-blue-900 block mb-1">
                        ⚡ Hoặc bấm chọn nhanh từ danh sách nhân viên:
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                        {availableStaffNames.map((name) => {
                          const isSelected = salaryStaffName.trim().toLowerCase() === name.trim().toLowerCase();
                          return (
                            <button
                              key={name}
                              type="button"
                              onClick={() => handleStaffNameChange(name)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-300'
                                  : 'bg-white hover:bg-blue-100 text-blue-900 border border-blue-200'
                              }`}
                            >
                              + {name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. CHẾ ĐỘ HỢP ĐỒNG */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Chế Độ Hợp Đồng <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setSalaryContractType('official')}
                      className={`py-2 text-xs font-black rounded-lg cursor-pointer transition-all ${
                        salaryContractType === 'official'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ✓ Chính Thức
                    </button>
                    <button
                      type="button"
                      onClick={() => setSalaryContractType('probation')}
                      className={`py-2 text-xs font-black rounded-lg cursor-pointer transition-all ${
                        salaryContractType === 'probation'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ⏳ Thử Việc
                    </button>
                  </div>
                </div>

                {/* KHỐI HỒ SƠ NHÂN SỰ: NGÀY SINH, SỐ CCCD, NGÀY BẮT ĐẦU ĐI LÀM (YÊU CẦU MỚI) */}
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2.5">
                  <div className="text-xs font-black text-blue-900 flex items-center justify-between">
                    <span className="flex items-center space-x-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                      <span>Hồ Sơ Nhân Sự (Ngày Sinh • Số CCCD • Ngày Đi Làm)</span>
                    </span>
                    <span className="text-[10px] text-blue-600/80 font-bold">
                      Admin quản lý
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-1">
                        Ngày Tháng Năm Sinh
                      </label>
                      <input
                        type="text"
                        value={salaryDateOfBirth}
                        onChange={(e) => setSalaryDateOfBirth(e.target.value)}
                        placeholder="VD: 15/08/1998"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-1">
                        Số CCCD / CMND
                      </label>
                      <input
                        type="text"
                        value={salaryCitizenId}
                        onChange={(e) => setSalaryCitizenId(e.target.value)}
                        placeholder="VD: 001298012345"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold font-mono text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-1">
                        Ngày Đi Làm
                      </label>
                      <input
                        type="text"
                        value={salaryStartDate}
                        onChange={(e) => setSalaryStartDate(e.target.value)}
                        placeholder="VD: 01/06/2023"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-blue-200/80">
                    <label className="flex items-center space-x-2 text-xs font-black text-blue-950 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={salaryIsProfileVisibleToStaff}
                        onChange={(e) => setSalaryIsProfileVisibleToStaff(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                      />
                      <span>
                        Tích để hiện thông tin nhân viên ở ô Hồ Sơ Nhân Sự (Bảng 8) cho nhân viên đó xem luôn
                      </span>
                    </label>
                  </div>
                </div>

                {/* Mức lương Thử việc & Chính thức */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <label className="block text-[11px] font-bold text-amber-800 mb-1">
                    Lương Thử Việc (VNĐ/tháng)
                  </label>
                  <input
                    type="text"
                    value={salaryProbationInput}
                    onChange={(e) => setSalaryProbationInput(e.target.value)}
                    placeholder="6000000"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-amber-900 font-mono"
                  />
                  <span className="text-[10px] text-amber-700 block mt-0.5 font-semibold">
                    = {formatCurrencyVND(parseNumberInput(salaryProbationInput))}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-emerald-800 mb-1">
                    Lương Chính Thức (VNĐ/tháng)
                  </label>
                  <input
                    type="text"
                    value={salaryOfficialInput}
                    onChange={(e) => setSalaryOfficialInput(e.target.value)}
                    placeholder="9000000"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-emerald-900 font-mono"
                  />
                  <span className="text-[10px] text-emerald-700 block mt-0.5 font-semibold">
                    = {formatCurrencyVND(parseNumberInput(salaryOfficialInput))}
                  </span>
                </div>
              </div>

              {/* Ngày công chuẩn & Ngày công đi làm thực tế */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ngày Công Chuẩn Tháng
                  </label>
                  <input
                    type="number"
                    value={salaryStandardDays}
                    onChange={(e) => setSalaryStandardDays(parseInt(e.target.value, 10) || 26)}
                    placeholder="26"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">Mặc định 26 ngày công</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-blue-800 mb-1">
                    Ngày Công Thực Tế Đi Làm <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={salaryActualDaysInput}
                    onChange={(e) => setSalaryActualDaysInput(e.target.value)}
                    placeholder="24"
                    className="w-full px-3 py-1.5 border border-blue-400 bg-blue-50/50 rounded-xl text-xs font-black text-blue-900 font-mono"
                  />
                  <span className="text-[10px] text-blue-700 font-bold block mt-0.5">
                    Lương theo công: {formatCurrencyVND(previewSalaryCalculation.salaryByDays)}
                  </span>
                </div>
              </div>

              {/* Thông tin tài khoản ngân hàng của nhân viên (Yêu cầu mới) */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="text-xs font-black text-slate-800 flex items-center space-x-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                  <span>Thông Tin Tài Khoản Ngân Hàng Của Nhân Viên</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Ngân Hàng</label>
                    <input
                      type="text"
                      list="bank-suggestions"
                      value={salaryBankName}
                      onChange={(e) => setSalaryBankName(e.target.value)}
                      placeholder="MB Bank, VCB..."
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-semibold"
                    />
                    <datalist id="bank-suggestions">
                      {POPULAR_VIETNAM_BANKS.map((b) => (
                        <option key={b} value={b} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Số Tài Khoản</label>
                    <input
                      type="text"
                      value={salaryBankAccountNumber}
                      onChange={(e) => setSalaryBankAccountNumber(e.target.value)}
                      placeholder="0389123456789"
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Tên Chủ Tài Khoản</label>
                    <input
                      type="text"
                      value={salaryBankAccountHolder}
                      onChange={(e) => setSalaryBankAccountHolder(e.target.value.toUpperCase())}
                      placeholder="NGUYEN VAN A"
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-bold uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Thưởng KPI tiền về doanh thu do nguồn nhân viên đó làm (5% hoặc 10%) */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                <div className="text-xs font-black text-emerald-900 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <Percent className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Thưởng KPI Doanh Thu Tiền Về (5% hoặc 10%)</span>
                  </span>
                  <span className="text-emerald-700 font-mono font-black">
                    +{formatCurrencyVND(previewSalaryCalculation.kpiBonusAmount)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-800 mb-1">
                      Doanh Thu Tiền Về NV Làm Được (VNĐ):
                    </label>
                    <input
                      type="text"
                      value={salaryRevenueGeneratedInput}
                      onChange={(e) => setSalaryRevenueGeneratedInput(e.target.value)}
                      placeholder="30000000"
                      className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-black text-emerald-900 font-mono"
                    />
                    {parseNumberInput(salaryRevenueGeneratedInput) > 0 && (
                      <span className="text-[10px] text-emerald-700 block mt-0.5">
                        = {formatCurrencyVND(parseNumberInput(salaryRevenueGeneratedInput))}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-emerald-800 mb-1">
                      Tỷ Lệ Thưởng KPI (%):
                    </label>
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => setSalaryKpiRate(5)}
                        className={`px-2.5 py-1.5 text-xs font-black rounded-lg cursor-pointer transition-all ${
                          salaryKpiRate === 5
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                        }`}
                      >
                        5% KPI
                      </button>
                      <button
                        type="button"
                        onClick={() => setSalaryKpiRate(10)}
                        className={`px-2.5 py-1.5 text-xs font-black rounded-lg cursor-pointer transition-all ${
                          salaryKpiRate === 10
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                        }`}
                      >
                        10% KPI
                      </button>
                      <input
                        type="number"
                        value={salaryKpiRate}
                        onChange={(e) => setSalaryKpiRate(parseFloat(e.target.value) || 0)}
                        className="w-14 px-1.5 py-1 bg-white border border-emerald-300 rounded-lg text-xs font-black text-emerald-900 font-mono text-center"
                        title="Nhập tỷ lệ % KPI tùy chỉnh"
                      />
                      <span className="text-xs text-emerald-800 font-bold">%</span>
                    </div>
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    value={salaryRevenueSourceName}
                    onChange={(e) => setSalaryRevenueSourceName(e.target.value)}
                    placeholder="Tên nguồn thu / hợp đồng nhân viên phụ trách (tùy chọn)..."
                    className="w-full px-2 py-1 bg-white border border-emerald-300 rounded text-[11px] text-slate-700"
                  />
                </div>
              </div>

              {/* HỖ TRỢ TIỀN MẠNG & ĐIỆN CHO NHÂN VIÊN LÀM ONLINE (YÊU CẦU 5) */}
              <div className="p-3.5 bg-gradient-to-r from-indigo-50/90 via-sky-50/90 to-blue-50/90 border-2 border-indigo-300 rounded-2xl space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={salaryIsOnlineStaff}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSalaryIsOnlineStaff(checked);
                        if (checked && (!salaryOnlineSupportInput || salaryOnlineSupportInput === '0')) {
                          setSalaryOnlineSupportInput('300000');
                        }
                      }}
                      className="w-4 h-4 text-indigo-600 rounded border-indigo-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="text-xs font-black text-indigo-950 uppercase flex items-center space-x-1.5">
                      <Wifi className="w-4 h-4 text-indigo-600" />
                      <span>Hỗ Trợ Tiền Mạng, Điện (Nhân Viên Làm Online)</span>
                    </span>
                  </label>
                  <span className="text-indigo-800 font-mono font-black text-xs">
                    +{formatCurrencyVND(previewSalaryCalculation.onlineSupportAmount)}
                  </span>
                </div>

                <p className="text-[11px] text-indigo-900 font-medium leading-relaxed">
                  🌐 Khoản tiền hỗ trợ mạng & điện này sẽ được <strong>cộng trực tiếp vào tổng lương thực nhận</strong> cho nhân viên làm online (và trừ vào lợi nhuận công ty).
                </p>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-indigo-900 mb-1">
                      Số Tiền Hỗ Trợ Mạng & Điện (VNĐ):
                    </label>
                    <input
                      type="text"
                      value={salaryOnlineSupportInput}
                      onChange={(e) => {
                        setSalaryOnlineSupportInput(e.target.value);
                        if (parseNumberInput(e.target.value) > 0 && !salaryIsOnlineStaff) {
                          setSalaryIsOnlineStaff(true);
                        }
                      }}
                      placeholder="300000"
                      className="w-full px-3 py-1.5 bg-white border border-indigo-300 rounded-xl text-xs font-black text-indigo-950 font-mono focus:ring-2 focus:ring-indigo-200"
                    />
                    {parseNumberInput(salaryOnlineSupportInput) > 0 && (
                      <span className="text-[10px] text-indigo-700 block mt-0.5 font-bold">
                        = {formatCurrencyVND(parseNumberInput(salaryOnlineSupportInput))}
                      </span>
                    )}
                  </div>

                  <div className="shrink-0 space-y-1">
                    <span className="text-[10px] font-bold text-indigo-800 block">⚡ Mức hỗ trợ phổ biến:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: '300k Mạng', val: '300000' },
                        { label: '500k Mạng+Điện', val: '500000' },
                        { label: '700k', val: '700000' },
                        { label: '1 Triệu', val: '1000000' },
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => {
                            setSalaryOnlineSupportInput(preset.val);
                            setSalaryIsOnlineStaff(true);
                          }}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                            salaryOnlineSupportInput === preset.val
                              ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                              : 'bg-white text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Thưởng khác & Khấu trừ phạt */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Thưởng Khác (Chuyên cần...)</label>
                  <input
                    type="text"
                    value={salaryOtherBonusInput}
                    onChange={(e) => setSalaryOtherBonusInput(e.target.value)}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-rose-600 mb-1">Trừ Phạt / Tạm Ứng</label>
                  <input
                    type="text"
                    value={salaryDeductionInput}
                    onChange={(e) => setSalaryDeductionInput(e.target.value)}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-rose-700 font-mono"
                  />
                </div>
              </div>

              {/* Tổng thực nhận Preview */}
              <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-blue-900 block">Tổng Lương Thực Nhận:</span>
                  <span className="text-[10px] text-blue-700">
                    Lương theo công ({formatCurrencyVND(previewSalaryCalculation.salaryByDays)}) + KPI ({formatCurrencyVND(previewSalaryCalculation.kpiBonusAmount)}) {previewSalaryCalculation.onlineSupportAmount > 0 ? `+ Hỗ trợ online (${formatCurrencyVND(previewSalaryCalculation.onlineSupportAmount)})` : ''} - Trừ
                  </span>
                </div>
                <span className="text-lg font-black text-blue-800 font-mono">
                  {formatCurrencyVND(previewSalaryCalculation.totalActual)}
                </span>
              </div>

              {/* Trạng thái thanh toán */}
              <div className="flex items-center space-x-2 pt-1">
                <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={salaryIsPaid}
                    onChange={(e) => setSalaryIsPaid(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                  />
                  <span>Đã thanh toán chuyển khoản lương cho nhân viên này</span>
                </label>
              </div>

              {/* Quyền hiển thị cho nhân viên (Yêu cầu mới: Admin tích mới hiện, bỏ tích thì Lương và Doanh thu bỏ trống) */}
              <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-1">
                <label className="flex items-center space-x-2.5 text-xs font-bold text-blue-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={salaryIsVisibleToStaff}
                    onChange={(e) => setSalaryIsVisibleToStaff(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                  <span>Tích chọn: Cho phép nhân viên xem Lương & Doanh thu tháng này ở Tab cá nhân</span>
                </label>
                <p className="text-[11px] text-blue-700 pl-6.5">
                  • <strong>Tích chọn:</strong> Nhân viên sẽ thấy đầy đủ Lương, Doanh thu và Tổng lương.<br />
                  • <strong>Bỏ tích:</strong> Các số Lương và Doanh thu sẽ <strong>bỏ trống</strong> khi nhân viên xem.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ghi Chú Đánh Giá</label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú đánh giá hiệu quả, số bài đăng, lý do thưởng phạt..."
                  value={salaryNote}
                  onChange={(e) => setSalaryNote(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-800"
                />
              </div>

              </div>

              {/* Footer: Cố định ở dưới cùng, luôn bấm được Lưu / Hủy mà không phải cuộn xuống đáy */}
              <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                <span className="text-xs text-slate-500 hidden sm:inline">
                  {salaryStaffName.trim() ? (
                    <span>Đang cập nhật: <b className="text-blue-900 font-bold">{salaryStaffName}</b></span>
                  ) : (
                    <span className="text-rose-600 font-bold">* Vui lòng nhập tên nhân viên</span>
                  )}
                </span>
                <div className="flex items-center space-x-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsSalaryModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer"
                  >
                    {editingSalaryItem ? 'Lưu Cập Nhật' : 'Lưu Vào Bảng Lương'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 3: THÊM / SỬA CHI PHÍ HÀNG THÁNG & CHI PHÍ NGOÀI Ý MUỐN */}
      {/* ========================================== */}
      {isCustomExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setIsCustomExpenseModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 mb-4">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  expenseType === 'unexpected'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {expenseType === 'unexpected' ? <AlertTriangle className="w-5 h-5" /> : <Receipt className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  {editingExpenseItem
                    ? 'Chỉnh Sửa Khoản Chi'
                    : expenseType === 'unexpected'
                    ? 'Thêm Chi Phí Ngoài Ý Muốn (Phát Sinh)'
                    : 'Thêm Mục Chi Phí Tự Thêm Vào Tháng'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Kê khai khoản chi cho {activeMonthRecord.title || selectedMonthKey}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveCustomExpense} className="space-y-3.5">
              {/* Phân loại khoản chi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phân Loại Khoản Chi <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExpenseType('unexpected')}
                    className={`p-2 rounded-xl text-xs font-black flex items-center justify-center space-x-1.5 cursor-pointer border transition-all ${
                      expenseType === 'unexpected'
                        ? 'bg-rose-50 border-rose-400 text-rose-800 ring-2 ring-rose-400'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Ngoài Ý Muốn (Phát Sinh)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExpenseType('fixed')}
                    className={`p-2 rounded-xl text-xs font-black flex items-center justify-center space-x-1.5 cursor-pointer border transition-all ${
                      expenseType === 'fixed'
                        ? 'bg-amber-50 border-amber-400 text-amber-800 ring-2 ring-amber-400'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-amber-600" />
                    <span>Cố Định Tự Thêm</span>
                  </button>
                </div>
              </div>

              {/* Tên khoản chi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên Khoản Chi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    expenseType === 'unexpected'
                      ? 'Ví dụ: Sửa máy tính số 03 bị hỏng nguồn, Mua switch mạng...'
                      : 'Ví dụ: Phí bảo vệ tòa nhà, Nước uống Lavie, Phần mềm...'
                  }
                  value={expenseName}
                  onChange={(e) => setExpenseName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Số tiền */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số Tiền Chi (VNĐ) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 2500000"
                  value={expenseAmountInput}
                  onChange={(e) => setExpenseAmountInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-black text-rose-700 font-mono focus:ring-2 focus:ring-rose-500"
                />
                {parseNumberInput(expenseAmountInput) > 0 && (
                  <span className="text-[11px] text-rose-600 font-bold mt-1 block">
                    = {formatCurrencyVND(parseNumberInput(expenseAmountInput))}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ngày Chi</label>
                  <input
                    type="text"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    placeholder="VD: 15/10/2026"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Người Chi / Duyệt</label>
                  <input
                    type="text"
                    value={expensePayer}
                    onChange={(e) => setExpensePayer(e.target.value)}
                    placeholder="Admin..."
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hình Thức Thanh Toán</label>
                  <select
                    value={expensePaymentMethod}
                    onChange={(e) => setExpensePaymentMethod(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-800"
                  >
                    <option value="transfer">Chuyển khoản</option>
                    <option value="cash">Tiền mặt</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Danh Mục Phụ</label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-800"
                  >
                    <option value="unexpected">Sự cố / Đột xuất</option>
                    <option value="hardware">Phần cứng / Sửa chữa</option>
                    <option value="tools">Công cụ / Tool phần mềm</option>
                    <option value="office">Văn phòng / Sinh hoạt</option>
                    <option value="other">Khoản chi khác</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Lý Do / Nguyên Nhân Phát Sinh
                </label>
                <textarea
                  rows={2}
                  value={expenseNote}
                  onChange={(e) => setExpenseNote(e.target.value)}
                  placeholder="Ghi chú nguyên nhân phát sinh ngoài ý muốn hoặc chứng từ..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-800"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCustomExpenseModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer ${
                    expenseType === 'unexpected'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-slate-900 hover:bg-black'
                  }`}
                >
                  {editingExpenseItem ? 'Lưu Cập Nhật' : 'Thêm Vào Bảng Chi Phí'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 4: TẠO THÁNG MỚI (CÓ TÙY CHỌN SAO CHÉP TỪ THÁNG CŨ) */}
      {/* ========================================== */}
      {isNewMonthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setIsNewMonthModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Tạo Kỳ Tài Chính Tháng Mới</h3>
                <p className="text-[11px] text-slate-500">
                  Có thể tạo bảng trắng hoặc sao chép toàn bộ dữ liệu từ tháng cũ sang để không phải nhập lại!
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateNewMonth} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tháng (1 - 12)</label>
                  <select
                    value={newMonthNumber}
                    onChange={(e) => setNewMonthNumber(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-black text-slate-800"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        Tháng {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Năm</label>
                  <select
                    value={newMonthYear}
                    onChange={(e) => setNewMonthYear(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-black text-slate-800"
                  >
                    {[2025, 2026, 2027, 2028].map((y) => (
                      <option key={y} value={y}>
                        Năm {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* TÙY CHỌN SAO CHÉP TỪ THÁNG CŨ SANG THÁNG MỚI */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2.5">
                <div className="flex items-center space-x-1.5 text-blue-900 text-xs font-black">
                  <Copy className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Sao Chép Dữ Liệu Từ Tháng Cũ (Không Nhập Lại)</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-blue-800 mb-1">
                    Chọn tháng cũ để sao chép sang:
                  </label>
                  <select
                    value={newMonthCopySourceKey}
                    onChange={(e) => setNewMonthCopySourceKey(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-blue-300 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="">-- Tạo tháng trắng hoàn toàn (Nhập mới từ đầu) --</option>
                    {finances.map((f) => (
                      <option key={f.monthKey || f.id} value={f.monthKey || f.id}>
                        Sao chép từ: {f.title || f.monthKey} ({f.salaryItems?.length || 0} nhân sự)
                      </option>
                    ))}
                  </select>
                </div>

                {newMonthCopySourceKey && (
                  <div className="space-y-1.5 pt-1 border-t border-blue-200/80 text-[11px]">
                    <span className="font-bold text-blue-900 block text-[10px] uppercase tracking-wide">
                      Các dữ liệu sẽ tự động sao chép sang:
                    </span>
                    <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newMonthCopySalaries}
                        onChange={(e) => setNewMonthCopySalaries(e.target.checked)}
                        className="w-3.5 h-3.5 text-blue-600 rounded"
                      />
                      <span>Bảng lương & nhân sự (Họ tên, ngày sinh, CCCD, ngày đi làm, lương thử việc/chính thức, STK ngân hàng, KPI %)</span>
                    </label>
                    <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newMonthCopyOfficeCosts}
                        onChange={(e) => setNewMonthCopyOfficeCosts(e.target.checked)}
                        className="w-3.5 h-3.5 text-blue-600 rounded"
                      />
                      <span>Chi phí cố định (Tiền văn phòng, điện, nước, internet)</span>
                    </label>
                    <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newMonthCopyExpenses}
                        onChange={(e) => setNewMonthCopyExpenses(e.target.checked)}
                        className="w-3.5 h-3.5 text-blue-600 rounded"
                      />
                      <span>Bảng chi phí phát sinh & ngoài ý muốn</span>
                    </label>
                    <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newMonthCopyRevenue}
                        onChange={(e) => setNewMonthCopyRevenue(e.target.checked)}
                        className="w-3.5 h-3.5 text-blue-600 rounded"
                      />
                      <span>Danh mục các nguồn doanh thu / khách hàng</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between">
                <span>Mã kỳ tháng sẽ tạo:</span>
                <strong className="text-amber-800 font-mono font-black">
                  {newMonthYear}-{String(newMonthNumber).padStart(2, '0')}
                </strong>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsNewMonthModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer"
                >
                  {newMonthCopySourceKey ? 'Tạo Tháng & Sao Chép Dữ Liệu' : 'Tạo Tháng Mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 5: SAO CHÉP DỮ LIỆU TỪ THÁNG KHÁC SANG THÁNG ĐANG XEM */}
      {/* ========================================== */}
      {isCopyFromMonthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setIsCopyFromMonthModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <Copy className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Sao Chép Dữ Liệu Vào {activeMonthRecord.title || selectedMonthKey}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Sao chép toàn bộ bảng lương, chi phí hoặc nguồn thu từ một tháng cũ sang mà không cần nhập lại.
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!copySourceMonthKey) {
                  alert('Vui lòng chọn tháng nguồn để sao chép!');
                  return;
                }
                handleCopyMonthData(copySourceMonthKey, selectedMonthKey, {
                  copySalaries: copySalariesOption,
                  copyOfficeCosts: copyOfficeCostsOption,
                  copyExpenses: copyExpensesOption,
                  copyRevenue: copyRevenueOption,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Chọn Tháng Nguồn (Tháng Muốn Lấy Dữ Liệu): <span className="text-rose-500">*</span>
                </label>
                <select
                  value={copySourceMonthKey}
                  onChange={(e) => setCopySourceMonthKey(e.target.value)}
                  className="w-full px-3 py-2 border border-blue-300 bg-blue-50/50 rounded-xl text-xs font-black text-slate-900 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Chọn tháng nguồn --</option>
                  {finances
                    .filter((f) => f.monthKey !== selectedMonthKey && f.id !== selectedMonthKey)
                    .map((f) => (
                      <option key={f.monthKey || f.id} value={f.monthKey || f.id}>
                        {f.title || f.monthKey} ({f.salaryItems?.length || 0} nhân sự, CP: {formatCurrencyVND(f.totalExpenses || 0)})
                      </option>
                    ))}
                </select>
              </div>

              {/* Hạng mục sao chép */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <span className="text-xs font-black text-slate-800 block">
                  Tùy Chọn Hạng Mục Muốn Sao Chép:
                </span>

                <label className="flex items-start space-x-2.5 text-xs font-bold text-slate-800 cursor-pointer p-1.5 hover:bg-white rounded-lg transition-colors">
                  <input
                    type="checkbox"
                    checked={copySalariesOption}
                    onChange={(e) => setCopySalariesOption(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded mt-0.5 cursor-pointer"
                  />
                  <div>
                    <span>Bảng Lương & Toàn Bộ Hồ Sơ Nhân Sự</span>
                    <p className="text-[11px] text-slate-500 font-normal">
                      Họ tên, ngày sinh, CCCD, ngày đi làm, lương thử việc/chính thức, ngày công, STK ngân hàng, tỷ lệ KPI %.
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-2.5 text-xs font-bold text-slate-800 cursor-pointer p-1.5 hover:bg-white rounded-lg transition-colors">
                  <input
                    type="checkbox"
                    checked={copyOfficeCostsOption}
                    onChange={(e) => setCopyOfficeCostsOption(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded mt-0.5 cursor-pointer"
                  />
                  <div>
                    <span>Chi Phí Cố Định Văn Phòng, Điện, Nước, Mạng</span>
                    <p className="text-[11px] text-slate-500 font-normal">
                      Tiền thuê mặt bằng, điện nước, internet và các ghi chú đi kèm.
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-2.5 text-xs font-bold text-slate-800 cursor-pointer p-1.5 hover:bg-white rounded-lg transition-colors">
                  <input
                    type="checkbox"
                    checked={copyExpensesOption}
                    onChange={(e) => setCopyExpensesOption(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded mt-0.5 cursor-pointer"
                  />
                  <div>
                    <span>Bảng Chi Phí Hàng Tháng & Ngoài Ý Muốn</span>
                    <p className="text-[11px] text-slate-500 font-normal">
                      Các khoản chi phát sinh tự thêm ngoài điện nước.
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-2.5 text-xs font-bold text-slate-800 cursor-pointer p-1.5 hover:bg-white rounded-lg transition-colors">
                  <input
                    type="checkbox"
                    checked={copyRevenueOption}
                    onChange={(e) => setCopyRevenueOption(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded mt-0.5 cursor-pointer"
                  />
                  <div>
                    <span>Danh Mục Các Nguồn Tiền Về (Doanh Thu)</span>
                    <p className="text-[11px] text-slate-500 font-normal">
                      Nguồn thu, tên đối tác, số tiền và ghi chú hợp đồng.
                    </p>
                  </div>
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCopyFromMonthModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!copySourceMonthKey}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer"
                >
                  Xác Nhận Sao Chép Toàn Bộ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 6: QUẢN LÝ & CHỌN XÓA DỮ LIỆU THEO THÁNG (Yêu cầu 4) */}
      {/* ========================================== */}
      {isManageMonthsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            <button
              type="button"
              onClick={() => setIsManageMonthsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 mb-4 shrink-0">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Chọn & Xóa Toàn Bộ Dữ Liệu Theo Tháng
                </h3>
                <p className="text-xs text-slate-500">
                  Tích chọn một hoặc nhiều tháng để xóa hàng loạt, hoặc làm trống dữ liệu từng tháng để nhập lại.
                </p>
              </div>
            </div>

            {/* THANH THAO TÁC HÀNG LOẠT */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-2 shrink-0 mb-3">
              <label className="flex items-center space-x-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={
                    finances.length > 0 &&
                    selectedMonthKeysToDelete.length === finances.length
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedMonthKeysToDelete(finances.map((f) => f.monthKey || f.id));
                    } else {
                      setSelectedMonthKeysToDelete([]);
                    }
                  }}
                  className="w-4 h-4 text-rose-600 rounded cursor-pointer"
                />
                <span>
                  Chọn tất cả ({finances.length} tháng)
                </span>
              </label>

              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500 font-medium">
                  Đã chọn: <strong className="text-rose-700 font-black">{selectedMonthKeysToDelete.length}</strong> tháng
                </span>
                <button
                  type="button"
                  disabled={selectedMonthKeysToDelete.length === 0}
                  onClick={handleBatchDeleteSelectedMonths}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa {selectedMonthKeysToDelete.length > 0 ? `(${selectedMonthKeysToDelete.length})` : ''} Tháng Đã Chọn</span>
                </button>
              </div>
            </div>

            {/* DANH SÁCH CÁC THÁNG */}
            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 border border-slate-200 rounded-2xl">
              {finances.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Hiện tại không có tháng nào trong hệ thống.
                </div>
              ) : (
                finances.map((f) => {
                  const mKey = f.monthKey || f.id;
                  const isChecked = selectedMonthKeysToDelete.includes(mKey);
                  const isCurrent = mKey === selectedMonthKey;

                  return (
                    <div
                      key={mKey}
                      className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        isChecked ? 'bg-rose-50/60' : isCurrent ? 'bg-amber-50/40' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMonthKeysToDelete((prev) => [...prev, mKey]);
                            } else {
                              setSelectedMonthKeysToDelete((prev) => prev.filter((id) => id !== mKey));
                            }
                          }}
                          className="w-4 h-4 text-rose-600 rounded mt-0.5 cursor-pointer"
                        />

                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="text-xs sm:text-sm font-black text-slate-900">
                              {f.title || `Tháng ${f.month}/${f.year}`}
                            </h4>
                            <span className="font-mono text-[10px] text-slate-500 font-bold px-1.5 py-0.2 bg-slate-100 rounded">
                              {mKey}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-black px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded">
                                Đang xem
                              </span>
                            )}
                          </div>

                          {/* Số liệu thống kê tóm tắt của tháng */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-600">
                            <span>
                              Doanh thu: <b className="text-emerald-700 font-mono">{formatCurrencyVND(f.totalRevenue || 0)}</b> ({f.revenueItems?.length || 0} nguồn)
                            </span>
                            <span>•</span>
                            <span>
                              Chi phí: <b className="text-rose-700 font-mono">{formatCurrencyVND(f.totalExpenses || 0)}</b>
                            </span>
                            <span>•</span>
                            <span>
                              Lương: <b className="text-blue-700 font-mono">{formatCurrencyVND(f.totalSalary || 0)}</b> ({f.salaryItems?.length || 0} NV)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* NÚT THAO TÁC CHO TỪNG THÁNG */}
                      <div className="flex items-center space-x-2 self-end sm:self-center shrink-0">
                        {/* Làm trống dữ liệu tháng (giữ kỳ tháng) */}
                        <button
                          type="button"
                          onClick={() => handleClearMonthData(mKey)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                          title="Xóa toàn bộ số liệu thu, chi, lương để tháng này về bảng trắng"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                          <span>Làm Trống</span>
                        </button>

                        {/* Xóa hẳn kỳ tháng */}
                        <button
                          type="button"
                          onClick={() => handleDeleteMonth(mKey)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                          title="Xóa bỏ hoàn toàn kỳ tháng này"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>Xóa Tháng</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500">
                Gợi ý: Dữ liệu sau khi xóa sẽ được đồng bộ lên Cloud Firestore.
              </span>
              <button
                type="button"
                onClick={() => setIsManageMonthsModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
