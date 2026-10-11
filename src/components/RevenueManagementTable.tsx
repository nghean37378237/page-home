import React, { useState, useMemo, useEffect } from 'react';
import {
  MonthlyFinanceRecord,
  RevenueItem,
  StaffSalaryItem,
  CustomExpenseItem,
  AppUser,
} from '../types';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
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
  ShieldCheck,
  Lock,
  RefreshCw,
  FileSpreadsheet,
  PieChart,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  CreditCard,
  Wifi,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';

interface RevenueManagementTableProps {
  finances: MonthlyFinanceRecord[];
  currentUser: AppUser;
  availableStaffNames: string[];
  onSaveMonthlyFinance: (record: MonthlyFinanceRecord) => Promise<void> | void;
  onDeleteMonthlyFinance: (monthId: string) => Promise<void> | void;
  onRefreshFinances: () => Promise<void> | void;
  onNavigateToTab?: (tab: string) => void;
}

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
  onSaveMonthlyFinance,
  onDeleteMonthlyFinance,
  onRefreshFinances,
  onNavigateToTab,
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

  // Active section tab: 'overview' | 'revenue' | 'expenses' | 'salaries' | 'all_months'
  const [activeSection, setActiveSection] = useState<'overview' | 'revenue' | 'expenses' | 'salaries' | 'all_months'>('overview');

  // Đang lưu dữ liệu
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Modal tạo tháng mới
  const [isNewMonthModalOpen, setIsNewMonthModalOpen] = useState(false);
  const [newMonthNumber, setNewMonthNumber] = useState<number>(currentMonthNum);
  const [newMonthYear, setNewMonthYear] = useState<number>(currentYear);

  // Modal thêm / sửa nguồn thu (Revenue Item)
  const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false);
  const [editingRevenueItem, setEditingRevenueItem] = useState<RevenueItem | null>(null);
  const [revenueSourceName, setRevenueSourceName] = useState('');
  const [revenueAmountInput, setRevenueAmountInput] = useState('');
  const [revenuePayer, setRevenuePayer] = useState('');
  const [revenueDate, setRevenueDate] = useState('');
  const [revenueNote, setRevenueNote] = useState('');

  // Modal thêm / sửa lương nhân viên (Salary Item)
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [editingSalaryItem, setEditingSalaryItem] = useState<StaffSalaryItem | null>(null);
  const [salaryStaffName, setSalaryStaffName] = useState('');
  const [salaryBaseInput, setSalaryBaseInput] = useState('');
  const [salaryBonusInput, setSalaryBonusInput] = useState('');
  const [salaryDeductionInput, setSalaryDeductionInput] = useState('');
  const [salaryIsPaid, setSalaryIsPaid] = useState(false);
  const [salaryPaidDate, setSalaryPaidDate] = useState('');
  const [salaryNote, setSalaryNote] = useState('');

  // Modal thêm chi phí phát sinh (Custom Expense Item)
  const [isCustomExpenseModalOpen, setIsCustomExpenseModalOpen] = useState(false);
  const [expenseName, setExpenseName] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<'office' | 'utility' | 'tools' | 'proxy' | 'other'>('tools');
  const [expenseAmountInput, setExpenseAmountInput] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [expenseNote, setExpenseNote] = useState('');

  // Tìm bản ghi tháng hiện được chọn
  const activeMonthRecord = useMemo<MonthlyFinanceRecord>(() => {
    const found = finances.find((f) => f.monthKey === selectedMonthKey || f.id === selectedMonthKey);
    if (found) return found;

    // Nếu chưa có, tạo cấu trúc rỗng tạm thời cho tháng này
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
      officeCost: 18000000,
      officeCostNote: 'Tiền thuê văn phòng làm việc',
      electricityCost: 4500000,
      electricityCostNote: 'Tiền điện văn phòng & dàn máy tính',
      waterCost: 400000,
      waterCostNote: 'Tiền nước sinh hoạt',
      internetCost: 3200000,
      internetCostNote: 'Internet & Proxy',
      otherCosts: 1500000,
      otherCostsNote: 'Chi phí văn phòng phẩm & tiếp khách',
      customExpenses: [],
      salaryItems: [],
      totalSalary: 0,
      totalExpenses: 27600000,
      netProfit: -27600000,
      profitMargin: 0,
      status: 'loss',
      adminSummaryNote: '',
    };
  }, [finances, selectedMonthKey, currentYear, currentMonthNum]);

  // Working state copy để người dùng chỉnh sửa trực tiếp các chi phí văn phòng/điện/nước
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

  // TÍNH TOÁN THỜI GIAN THỰC (REAL-TIME COMPUTED STATS):
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

  // 3. Tổng chi phí phát sinh custom
  const computedCustomExpenses = useMemo(() => {
    if (!activeMonthRecord.customExpenses) return 0;
    return activeMonthRecord.customExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [activeMonthRecord.customExpenses]);

  // 4. Chi phí cố định = Văn phòng + Điện + Nước
  const computedFixedUtilityCost = useMemo(() => {
    return (Number(workingOfficeCost) || 0) + (Number(workingElectricityCost) || 0) + (Number(workingWaterCost) || 0);
  }, [workingOfficeCost, workingElectricityCost, workingWaterCost]);

  // 5. Tổng chi phí phải chi trong tháng
  const computedTotalExpenses = useMemo(() => {
    return (
      (Number(workingOfficeCost) || 0) +
      (Number(workingElectricityCost) || 0) +
      (Number(workingWaterCost) || 0) +
      (Number(workingInternetCost) || 0) +
      (Number(workingOtherCosts) || 0) +
      computedTotalSalary +
      computedCustomExpenses
    );
  }, [
    workingOfficeCost,
    workingElectricityCost,
    workingWaterCost,
    workingInternetCost,
    workingOtherCosts,
    computedTotalSalary,
    computedCustomExpenses,
  ]);

  // 6. Lợi nhuận ròng = Doanh thu - Tổng chi phí
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
    const newTotalExp =
      (Number(workingOfficeCost) || 0) +
      (Number(workingElectricityCost) || 0) +
      (Number(workingWaterCost) || 0) +
      (Number(workingInternetCost) || 0) +
      (Number(workingOtherCosts) || 0) +
      computedTotalSalary +
      computedCustomExpenses;
    const newNetProfit = newTotalRev - newTotalExp;

    const updatedRecord: MonthlyFinanceRecord = {
      ...activeMonthRecord,
      revenueItems: updatedItems,
      totalRevenue: newTotalRev,
      totalExpenses: newTotalExp,
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
    const newTotalExp =
      (Number(workingOfficeCost) || 0) +
      (Number(workingElectricityCost) || 0) +
      (Number(workingWaterCost) || 0) +
      (Number(workingInternetCost) || 0) +
      (Number(workingOtherCosts) || 0) +
      computedTotalSalary +
      computedCustomExpenses;
    const newNetProfit = newTotalRev - newTotalExp;

    const updatedRecord: MonthlyFinanceRecord = {
      ...activeMonthRecord,
      revenueItems: updatedItems,
      totalRevenue: newTotalRev,
      totalExpenses: newTotalExp,
      netProfit: newNetProfit,
      profitMargin: newTotalRev > 0 ? Math.round((newNetProfit / newTotalRev) * 1000) / 10 : 0,
      updatedAt: new Date().toLocaleString('vi-VN'),
      updatedBy: currentUser.name || 'Admin',
    };
    await onSaveMonthlyFinance(updatedRecord);
  };

  // --- XỬ LÝ LƯƠNG NHÂN VIÊN (SALARY ITEMS) ---
  const handleOpenAddSalary = (defaultStaff?: string) => {
    setEditingSalaryItem(null);
    setSalaryStaffName(defaultStaff || availableStaffNames[0] || '');
    setSalaryBaseInput('8000000');
    setSalaryBonusInput('2000000');
    setSalaryDeductionInput('0');
    setSalaryIsPaid(false);
    setSalaryPaidDate('');
    setSalaryNote('');
    setIsSalaryModalOpen(true);
  };

  const handleOpenEditSalary = (item: StaffSalaryItem) => {
    setEditingSalaryItem(item);
    setSalaryStaffName(item.staffName || '');
    setSalaryBaseInput(String(item.baseSalary || 0));
    setSalaryBonusInput(String(item.kpiBonus || 0));
    setSalaryDeductionInput(String(item.deduction || 0));
    setSalaryIsPaid(item.isPaid || false);
    setSalaryPaidDate(item.paidDate || '');
    setSalaryNote(item.note || '');
    setIsSalaryModalOpen(true);
  };

  const handleSaveSalaryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salaryStaffName.trim()) {
      alert('Vui lòng chọn hoặc nhập tên nhân viên!');
      return;
    }

    const base = parseNumberInput(salaryBaseInput);
    const bonus = parseNumberInput(salaryBonusInput);
    const deduction = parseNumberInput(salaryDeductionInput);
    const actual = Math.max(0, base + bonus - deduction);

    let updatedItems: StaffSalaryItem[] = [];
    if (editingSalaryItem) {
      updatedItems = (activeMonthRecord.salaryItems || []).map((item) =>
        item.id === editingSalaryItem.id
          ? {
              ...item,
              staffName: salaryStaffName.trim(),
              baseSalary: base,
              kpiBonus: bonus,
              deduction,
              actualSalary: actual,
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
        baseSalary: base,
        kpiBonus: bonus,
        deduction,
        actualSalary: actual,
        isPaid: salaryIsPaid,
        paidDate: salaryIsPaid ? (salaryPaidDate.trim() || new Date().toLocaleDateString('vi-VN')) : '',
        note: salaryNote.trim(),
      };
      updatedItems = [...(activeMonthRecord.salaryItems || []), newItem];
    }

    const newTotalSalary = updatedItems.reduce((acc, it) => acc + (it.actualSalary || 0), 0);
    const newTotalExp =
      (Number(workingOfficeCost) || 0) +
      (Number(workingElectricityCost) || 0) +
      (Number(workingWaterCost) || 0) +
      (Number(workingInternetCost) || 0) +
      (Number(workingOtherCosts) || 0) +
      newTotalSalary +
      computedCustomExpenses;
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
      computedCustomExpenses;
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
      ...missingStaff.map((st, i) => ({
        id: `sal-sync-${Date.now()}-${i}`,
        staffName: st,
        baseSalary: 8000000,
        kpiBonus: 2000000,
        deduction: 0,
        actualSalary: 10000000,
        isPaid: false,
        note: 'Đồng bộ từ danh sách nhân viên',
      })),
    ];

    const newTotalSalary = newSalaryItems.reduce((acc, it) => acc + (it.actualSalary || 0), 0);
    const newTotalExp =
      (Number(workingOfficeCost) || 0) +
      (Number(workingElectricityCost) || 0) +
      (Number(workingWaterCost) || 0) +
      (Number(workingInternetCost) || 0) +
      (Number(workingOtherCosts) || 0) +
      newTotalSalary +
      computedCustomExpenses;
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

  // --- XỬ LÝ TẠO THÁNG MỚI ---
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

    // Sao chép các chi phí văn phòng và danh sách nhân viên từ tháng gần nhất
    const previousMonth = finances[0];
    const newRecord: MonthlyFinanceRecord = {
      id: monthKey,
      monthKey,
      month: newMonthNumber,
      year: newMonthYear,
      title,
      revenueItems: [],
      totalRevenue: 0,
      officeCost: previousMonth?.officeCost || 18000000,
      officeCostNote: previousMonth?.officeCostNote || 'Tiền thuê văn phòng làm việc',
      electricityCost: previousMonth?.electricityCost || 4500000,
      electricityCostNote: previousMonth?.electricityCostNote || 'Tiền điện văn phòng & máy tính',
      waterCost: previousMonth?.waterCost || 400000,
      waterCostNote: previousMonth?.waterCostNote || 'Tiền nước sinh hoạt',
      internetCost: previousMonth?.internetCost || 3200000,
      internetCostNote: previousMonth?.internetCostNote || 'Internet & Proxy',
      otherCosts: 1000000,
      otherCostsNote: 'Chi phí văn phòng phẩm phát sinh',
      customExpenses: [],
      salaryItems: previousMonth?.salaryItems
        ? previousMonth.salaryItems.map((s, idx) => ({
            ...s,
            id: `sal-new-${Date.now()}-${idx}`,
            isPaid: false,
            paidDate: '',
          }))
        : availableStaffNames
            .filter((n) => n.trim().toLowerCase() !== 'quản lý (admin)')
            .map((name, idx) => ({
              id: `sal-init-${Date.now()}-${idx}`,
              staffName: name,
              baseSalary: 8000000,
              kpiBonus: 2000000,
              deduction: 0,
              actualSalary: 10000000,
              isPaid: false,
              note: '',
            })),
      totalSalary: 0,
      totalExpenses: 0,
      netProfit: 0,
      profitMargin: 0,
      status: 'break_even',
      adminSummaryNote: `Kế hoạch tài chính & thu chi ${title}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toLocaleString('vi-VN'),
      updatedBy: currentUser.name || 'Admin',
    };

    // Tính lại totalSalary và totalExpenses cho tháng mới
    const totSal = (newRecord.salaryItems || []).reduce((sum, it) => sum + it.actualSalary, 0);
    newRecord.totalSalary = totSal;
    newRecord.totalExpenses =
      newRecord.officeCost +
      newRecord.electricityCost +
      newRecord.waterCost +
      (newRecord.internetCost || 0) +
      (newRecord.otherCosts || 0) +
      totSal;
    newRecord.netProfit = 0 - newRecord.totalExpenses;

    await onSaveMonthlyFinance(newRecord);
    setSelectedMonthKey(monthKey);
    setIsNewMonthModalOpen(false);
  };

  // --- XÓA THÁNG ---
  const handleDeleteMonth = async (monthId: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa toàn bộ dữ liệu tài chính của tháng này (${monthId})? Thao tác không thể hoàn tác!`)) {
      return;
    }
    await onDeleteMonthlyFinance(monthId);
    // Chọn tháng khác nếu có
    const remaining = finances.filter((f) => f.id !== monthId && f.monthKey !== monthId);
    if (remaining.length > 0) {
      setSelectedMonthKey(remaining[0].monthKey || remaining[0].id);
    }
  };

  // Xuất file CSV báo cáo tài chính tháng
  const handleExportCSV = () => {
    const lines: string[] = [];
    lines.push(`BÁO CÁO TÀI CHÍNH & THU CHI - ${activeMonthRecord.title || selectedMonthKey}`);
    lines.push(`Người lập: ${currentUser.name || 'Admin'}`);
    lines.push(`Thời gian xuất: ${new Date().toLocaleString('vi-VN')}`);
    lines.push('');
    lines.push('--- TỔNG KẾT TÀI CHÍNH ---');
    lines.push(`1. Tổng Doanh Thu / Tiền Về:,${computedTotalRevenue}`);
    lines.push(`2. Tiền Thuê Văn Phòng:,${workingOfficeCost}`);
    lines.push(`3. Tiền Điện:,${workingElectricityCost}`);
    lines.push(`4. Tiền Nước:,${workingWaterCost}`);
    lines.push(`5. Tiền Mạng Internet & Proxy:,${workingInternetCost}`);
    lines.push(`6. Chi Phí Khác:,${workingOtherCosts}`);
    lines.push(`7. Tổng Tiền Lương Nhân Viên:,${computedTotalSalary}`);
    lines.push(`8. Tổng Chi Phí Phải Chi:,${computedTotalExpenses}`);
    lines.push(`9. LỢI NHUẬN RÒNG (TIỀN DƯ):,${computedNetProfit}`);
    lines.push(`10. Tỷ Suất Lợi Nhuận:,${computedProfitMargin}%`);
    lines.push('');
    lines.push('--- CHI TIẾT NGUỒN TIỀN VỀ (DOANH THU) ---');
    lines.push('STT,Nguồn Thu,Đối Tác / Khách Hàng,Ngày Nhận,Số Tiền (VNĐ),Ghi Chú');
    (activeMonthRecord.revenueItems || []).forEach((it, idx) => {
      lines.push(`${idx + 1},"${it.sourceName}","${it.payerName || ''}","${it.receivedDate || ''}",${it.amount},"${it.note || ''}"`);
    });
    lines.push('');
    lines.push('--- CHI TIẾT BẢNG LƯƠNG NHÂN VIÊN ---');
    lines.push('STT,Tên Nhân Viên,Lương Cơ Bản,Thưởng KPI,Trừ / Phạt,Thực Nhận (VNĐ),Trạng Thái,Ngày Chi Trả,Ghi Chú');
    (activeMonthRecord.salaryItems || []).forEach((it, idx) => {
      lines.push(
        `${idx + 1},"${it.staffName}",${it.baseSalary},${it.kpiBonus},${it.deduction},${it.actualSalary},"${it.isPaid ? 'Đã Thanh Toán' : 'Chưa Thanh Toán'}","${it.paidDate || ''}","${it.note || ''}"`
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
                  Quản Lý Doanh Thu & Thu Chi Từng Tháng
                </h2>
                <span className="hidden sm:inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Chỉ Admin Quản Lý</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Doanh thu tiền về trừ chi phí văn phòng, điện, nước và lương nhân viên chi tiết.
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
            </div>

            {/* Nút Tạo Tháng Mới */}
            <button
              type="button"
              id="btn-add-new-finance-month"
              onClick={() => setIsNewMonthModalOpen(true)}
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

        {/* Thẻ 2: Tổng Chi Phí Phải Chi */}
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
            <span>Gồm VP, Điện, Nước & Lương</span>
            <span className="font-bold underline">Chi tiết →</span>
          </div>
        </div>

        {/* Thẻ 3: Lợi Nhuận Ròng (Tiền Dư Còn Lại) */}
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
              💎 Lợi Nhuận Ròng (Tiền Dư)
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
            className={`text-[11px] mt-1 font-bold ${
              computedNetProfit >= 0 ? 'text-teal-700' : 'text-rose-700'
            }`}
          >
            Tỷ suất: {computedProfitMargin}% | {computedNetProfit >= 0 ? 'Có Lãi 🎉' : 'Bị Lỗ ⚠️'}
          </div>
        </div>

        {/* Thẻ 4: Tổng Tiền Lương Nhân Viên */}
        <div
          onClick={() => setActiveSection('salaries')}
          className="p-3.5 bg-blue-50/80 hover:bg-blue-100/70 border border-blue-200 rounded-2xl cursor-pointer transition-all shadow-2xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-blue-800 uppercase tracking-wide">
              👥 Lương Nhân Viên
            </span>
            <Users className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-lg sm:text-xl font-black text-blue-700 mt-1.5 truncate">
            {formatCurrencyVND(computedTotalSalary)}
          </div>
          <div className="text-[11px] text-blue-600/90 mt-1 flex items-center justify-between">
            <span>
              {activeMonthRecord.salaryItems?.length || 0} NV (
              {activeMonthRecord.salaryItems?.filter((s) => s.isPaid).length || 0} đã chi)
            </span>
            <span className="font-bold underline">Bảng lương →</span>
          </div>
        </div>

        {/* Thẻ 5: Chi Phí Văn Phòng, Điện, Nước */}
        <div
          onClick={() => setActiveSection('expenses')}
          className="p-3.5 bg-amber-50/80 hover:bg-amber-100/70 border border-amber-200 rounded-2xl cursor-pointer transition-all shadow-2xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-amber-800 uppercase tracking-wide">
              🏢 Chi Phí Cố Định (VP+Điện+Nước)
            </span>
            <Building2 className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-lg sm:text-xl font-black text-amber-700 mt-1.5 truncate">
            {formatCurrencyVND(computedFixedUtilityCost)}
          </div>
          <div className="text-[11px] text-amber-700/90 mt-1 truncate">
            VP: {formatCurrencyVND(workingOfficeCost)} | Điện: {formatCurrencyVND(workingElectricityCost)}
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
          <span>🏢 Chi Phí VP, Điện, Nước</span>
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
          <span>👥 Bảng Lương Nhân Viên</span>
          <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">
            {activeMonthRecord.salaryItems?.length || 0}
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
          <span>📅 Lịch Sử So Sánh Các Tháng</span>
          <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">
            {finances.length}
          </span>
        </button>
      </div>

      {/* 4. NỘI DUNG CHI TIẾT TỪNG TAB */}

      {/* TAB 1: TỔNG KẾT THÁNG (OVERVIEW) */}
      {activeSection === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Cột 1 & 2: Bảng Cân Đối Tài Chính Thu - Chi */}
          <div className="lg:col-span-2 space-y-4">
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
                  <div className="text-[11px] font-black text-slate-500 uppercase tracking-wide">
                    (-) CÁC KHOẢN CHI PHÍ PHẢI CHI:
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
                      <span>4. Mạng Internet Cáp Quang & Proxy Nuôi Via</span>
                      <span className="text-[10px] text-slate-400">({workingInternetNote || 'Hạ tầng mạng'})</span>
                    </span>
                    <span className="font-bold">{formatCurrencyVND(workingInternetCost)}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700 py-1 border-b border-slate-200/60">
                    <span className="flex items-center space-x-2">
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                      <span>5. Tổng Tiền Lương Nhân Viên</span>
                      <span className="text-[10px] text-slate-400">
                        ({activeMonthRecord.salaryItems?.length || 0} nhân sự)
                      </span>
                    </span>
                    <span className="font-black text-blue-700">{formatCurrencyVND(computedTotalSalary)}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700 py-1">
                    <span className="flex items-center space-x-2">
                      <ShoppingBag className="w-3.5 h-3.5 text-slate-500" />
                      <span>6. Chi Phí Văn Phòng Phẩm & Phát Sinh Khác</span>
                      <span className="text-[10px] text-slate-400">({workingOtherNote || 'Khác'})</span>
                    </span>
                    <span className="font-bold">{formatCurrencyVND(workingOtherCosts + computedCustomExpenses)}</span>
                  </div>
                </div>

                {/* Tổng chi phí */}
                <div className="flex items-center justify-between p-2.5 bg-rose-50/70 border border-rose-200/80 rounded-xl font-bold">
                  <span className="text-rose-900 flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span>(=) TỔNG CHI PHÍ PHẢI CHI TRONG THÁNG</span>
                  </span>
                  <span className="text-rose-700 font-black text-sm">
                    {formatCurrencyVND(computedTotalExpenses)}
                  </span>
                </div>

                {/* Kết quả: Lợi Nhuận Ròng */}
                <div
                  className={`flex items-center justify-between p-3.5 rounded-xl border-2 ${
                    computedNetProfit >= 0
                      ? 'bg-teal-50 border-teal-500 text-teal-900'
                      : 'bg-rose-50 border-rose-500 text-rose-900'
                  }`}
                >
                  <div>
                    <div className="font-black text-sm flex items-center space-x-1.5">
                      <span>(=) LỢI NHUẬN RÒNG (TIỀN THỰC THU DƯ)</span>
                    </div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      Công thức: Doanh Thu ({formatCurrencyVND(computedTotalRevenue)}) - Tổng Chi Phí (
                      {formatCurrencyVND(computedTotalExpenses)})
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-xl font-black ${
                        computedNetProfit >= 0 ? 'text-teal-700' : 'text-rose-700'
                      }`}
                    >
                      {computedNetProfit >= 0 ? '+' : ''}
                      {formatCurrencyVND(computedNetProfit)}
                    </div>
                    <div className="text-[11px] font-bold">
                      Tỷ suất sinh lời: {computedProfitMargin}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cột 3: Ghi chú & Đánh giá Admin */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Đánh Giá / Ghi Chú Của Admin</span>
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mb-2">
                Ghi chú hiệu quả kinh doanh, kế hoạch cắt giảm chi phí hoặc thưởng thêm cho team trong tháng.
              </p>
              <textarea
                rows={5}
                value={workingAdminSummary}
                onChange={(e) => setWorkingAdminSummary(e.target.value)}
                placeholder="Nhập nhận xét hoặc ghi chú chiến lược của Admin cho tháng này..."
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
              />
              <button
                type="button"
                onClick={handleSaveMonth}
                disabled={isSaving}
                className="mt-2 w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu Nhận Xét Này</span>
              </button>
            </div>

            {/* Quick Actions Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wide mb-2">
                Thao Tác Nhanh Cho Tháng
              </h4>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleOpenAddRevenue}
                  className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-between"
                >
                  <span>+ Thêm Nguồn Tiền Về</span>
                  <Plus className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenAddSalary()}
                  className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-between"
                >
                  <span>+ Thêm Nhân Viên Vào Bảng Lương</span>
                  <Plus className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleSyncAllStaffIntoSalary}
                  className="w-full py-2 px-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-between"
                >
                  <span>Đồng Bộ Danh Sách NV Hiện Có</span>
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteMonth(selectedMonthKey)}
                  className="w-full py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-between"
                >
                  <span>Xóa Tháng {selectedMonthKey}</span>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DOANH THU & NGUỒN TIỀN VỀ (REVENUE) */}
      {activeSection === 'revenue' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Bảng Kê Chi Tiết Tiền Về / Doanh Thu Tháng ({activeMonthRecord.title || selectedMonthKey})</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Các khoản tiền thu từ Ads, Booking bài đăng, Bán Page/Group, Hợp đồng đối tác do Admin nhập.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                id="btn-add-revenue-item"
                onClick={handleOpenAddRevenue}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Thêm Khoản Thu</span>
              </button>
            </div>
          </div>

          {/* Bảng danh sách các khoản thu */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-black border-b border-slate-200 text-[11px] uppercase tracking-wide">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">STT</th>
                  <th className="py-2.5 px-3">Nguồn Thu / Dịch Vụ</th>
                  <th className="py-2.5 px-3">Đối Tác / Người Trả</th>
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
                      Chưa có khoản thu nào trong tháng này. Hãy bấm <strong>"+ Thêm Khoản Thu"</strong> để nhập!
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
                      <td className="py-2.5 px-3 text-right font-black text-emerald-700 text-sm">
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
                  <td className="py-2.5 px-3 text-right text-emerald-800 text-sm">
                    {formatCurrencyVND(computedTotalRevenue)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CHI PHÍ VĂN PHÒNG, ĐIỆN, NƯỚC (EXPENSES) */}
      {activeSection === 'expenses' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-amber-600" />
              <span>Kê Khai Chi Phí Văn Phòng, Điện, Nước & Chi Phí Khác ({activeMonthRecord.title || selectedMonthKey})</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Admin chỉnh sửa trực tiếp các khoản chi phí bên dưới và bấm nút <strong>"Lưu Thay Đổi"</strong> để cập nhật.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. Chi phí văn phòng */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center space-x-2 text-xs font-black text-slate-800">
                <Building2 className="w-4 h-4 text-amber-600" />
                <span>Tiền Thuê Văn Phòng (Mặt Bằng)</span>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Số tiền (VNĐ):</label>
                <input
                  type="number"
                  value={workingOfficeCost}
                  onChange={(e) => setWorkingOfficeCost(parseNumberInput(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-[11px] text-amber-700 font-bold mt-0.5 block">
                  = {formatCurrencyVND(workingOfficeCost)}
                </span>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Ghi chú địa điểm / Hợp đồng:</label>
                <input
                  type="text"
                  value={workingOfficeNote}
                  onChange={(e) => setWorkingOfficeNote(e.target.value)}
                  placeholder="Ví dụ: Tầng 4, Tòa nhà Sông Đà..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700"
                />
              </div>
            </div>

            {/* 2. Tiền điện */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center space-x-2 text-xs font-black text-slate-800">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span>Tiền Điện Sinh Hoạt & Máy Tính Tool</span>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Số tiền (VNĐ):</label>
                <input
                  type="number"
                  value={workingElectricityCost}
                  onChange={(e) => setWorkingElectricityCost(parseNumberInput(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-[11px] text-yellow-700 font-bold mt-0.5 block">
                  = {formatCurrencyVND(workingElectricityCost)}
                </span>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Chỉ số điện / Chi tiết:</label>
                <input
                  type="text"
                  value={workingElectricityNote}
                  onChange={(e) => setWorkingElectricityNote(e.target.value)}
                  placeholder="Ví dụ: Số điện tiêu thụ 1.250 kWh..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700"
                />
              </div>
            </div>

            {/* 3. Tiền nước */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center space-x-2 text-xs font-black text-slate-800">
                <Droplets className="w-4 h-4 text-cyan-500" />
                <span>Tiền Nước Sinh Hoạt</span>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Số tiền (VNĐ):</label>
                <input
                  type="number"
                  value={workingWaterCost}
                  onChange={(e) => setWorkingWaterCost(parseNumberInput(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-[11px] text-cyan-700 font-bold mt-0.5 block">
                  = {formatCurrencyVND(workingWaterCost)}
                </span>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Ghi chú hóa đơn nước:</label>
                <input
                  type="text"
                  value={workingWaterNote}
                  onChange={(e) => setWorkingWaterNote(e.target.value)}
                  placeholder="Ví dụ: Nước máy + 10 bình Lavie..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700"
                />
              </div>
            </div>

            {/* 4. Mạng Internet & Hạ tầng Proxy */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center space-x-2 text-xs font-black text-slate-800">
                <Wifi className="w-4 h-4 text-indigo-500" />
                <span>Mạng Cáp Quang & Dàn Proxy Nuôi Nick</span>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Số tiền (VNĐ):</label>
                <input
                  type="number"
                  value={workingInternetCost}
                  onChange={(e) => setWorkingInternetCost(parseNumberInput(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-[11px] text-indigo-700 font-bold mt-0.5 block">
                  = {formatCurrencyVND(workingInternetCost)}
                </span>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Nhà mạng / Gói cước:</label>
                <input
                  type="text"
                  value={workingInternetNote}
                  onChange={(e) => setWorkingInternetNote(e.target.value)}
                  placeholder="Ví dụ: Cáp quang Viettel + Proxy tĩnh..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700"
                />
              </div>
            </div>

            {/* 5. Chi phí phát sinh khác */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center space-x-2 text-xs font-black text-slate-800">
                <ShoppingBag className="w-4 h-4 text-slate-600" />
                <span>Chi Phí Văn Phòng Phẩm & Khác</span>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Số tiền (VNĐ):</label>
                <input
                  type="number"
                  value={workingOtherCosts}
                  onChange={(e) => setWorkingOtherCosts(parseNumberInput(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-[11px] text-slate-700 font-bold mt-0.5 block">
                  = {formatCurrencyVND(workingOtherCosts)}
                </span>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Ghi chú chi tiết:</label>
                <input
                  type="text"
                  value={workingOtherNote}
                  onChange={(e) => setWorkingOtherNote(e.target.value)}
                  placeholder="Ví dụ: Giấy in, mực, cafe, trà, vệ sinh..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700"
                />
              </div>
            </div>

            {/* 6. Tổng hợp chi phí cố định */}
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col justify-between">
              <div>
                <span className="text-xs font-black text-amber-900 uppercase tracking-wide block">
                  Tổng Chi Phí Vận Hành (Chưa gồm lương)
                </span>
                <p className="text-[11px] text-amber-800/80 mt-1">
                  Bao gồm: Văn phòng ({formatCurrencyVND(workingOfficeCost)}) + Điện (
                  {formatCurrencyVND(workingElectricityCost)}) + Nước ({formatCurrencyVND(workingWaterCost)}) + Mạng &
                  Khác.
                </p>
                <div className="text-xl font-black text-amber-900 mt-3">
                  {formatCurrencyVND(
                    (Number(workingOfficeCost) || 0) +
                      (Number(workingElectricityCost) || 0) +
                      (Number(workingWaterCost) || 0) +
                      (Number(workingInternetCost) || 0) +
                      (Number(workingOtherCosts) || 0)
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveMonth}
                disabled={isSaving}
                className="mt-3 w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Lưu Khoản Chi Này</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: BẢNG LƯƠNG NHÂN VIÊN (SALARIES) */}
      {activeSection === 'salaries' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Bảng Lương & Thưởng Nhân Viên Tháng ({activeMonthRecord.title || selectedMonthKey})</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Lương cơ bản + Thưởng KPI đăng bài - Trừ phạt / tạm ứng = Thực nhận từng nhân sự.
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
                <span>Đánh Dấu Đã Trả Tất Cả</span>
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

          {/* Bảng lương */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-black border-b border-slate-200 text-[11px] uppercase tracking-wide">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">STT</th>
                  <th className="py-2.5 px-3">Tên Nhân Viên</th>
                  <th className="py-2.5 px-3 text-right">Lương Cứng</th>
                  <th className="py-2.5 px-3 text-right">Thưởng KPI</th>
                  <th className="py-2.5 px-3 text-right">Trừ Phạt / Ứng</th>
                  <th className="py-2.5 px-3 text-right">Thực Nhận</th>
                  <th className="py-2.5 px-3 text-center">Trạng Thái</th>
                  <th className="py-2.5 px-3 text-center">Ngày Chi</th>
                  <th className="py-2.5 px-3">Ghi Chú</th>
                  <th className="py-2.5 px-3 w-20 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!activeMonthRecord.salaryItems || activeMonthRecord.salaryItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      Chưa có nhân viên nào trong bảng lương tháng này. Hãy bấm <strong>"Đồng Bộ NV Hệ Thống"</strong> hoặc{' '}
                      <strong>"+ Thêm Nhân Viên"</strong>!
                    </td>
                  </tr>
                ) : (
                  activeMonthRecord.salaryItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-black text-slate-900 flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                        <span>{item.staffName}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700 font-mono">
                        {formatCurrencyVND(item.baseSalary)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-700 font-mono font-bold">
                        +{formatCurrencyVND(item.kpiBonus)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-rose-600 font-mono font-bold">
                        {item.deduction > 0 ? `-${formatCurrencyVND(item.deduction)}` : '0 ₫'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-blue-700 text-sm">
                        {formatCurrencyVND(item.actualSalary)}
                      </td>
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
                      <td className="py-2.5 px-3 text-slate-500 text-[11px] max-w-xs truncate">
                        {item.note || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditSalary(item)}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                            title="Sửa thông tin lương"
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
                  ))
                )}
              </tbody>
              <tfoot className="bg-blue-50/90 font-black text-xs border-t-2 border-blue-300">
                <tr>
                  <td colSpan={5} className="py-2.5 px-3 text-right text-blue-900 uppercase">
                    TỔNG CỘNG TIỀN LƯƠNG NHÂN VIÊN:
                  </td>
                  <td className="py-2.5 px-3 text-right text-blue-800 text-sm">
                    {formatCurrencyVND(computedTotalSalary)}
                  </td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: LỊCH SỬ SO SÁNH TẤT CẢ CÁC THÁNG (ALL MONTHS) */}
      {activeSection === 'all_months' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center space-x-2">
                <FileSpreadsheet className="w-4 h-4 text-slate-700" />
                <span>Bảng So Sánh Doanh Thu & Chi Phí Các Tháng Trong Hệ Thống</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Xem lại lịch sử thu chi, so sánh tăng trưởng và số dư qua từng tháng.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsNewMonthModalOpen(true)}
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Tháng Mới</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-black border-b border-slate-200 text-[11px] uppercase tracking-wide">
                <tr>
                  <th className="py-3 px-3">Tháng / Năm</th>
                  <th className="py-3 px-3 text-right">Tổng Tiền Về (Doanh Thu)</th>
                  <th className="py-3 px-3 text-right">Tiền VP + Điện + Nước</th>
                  <th className="py-3 px-3 text-right">Lương Nhân Viên</th>
                  <th className="py-3 px-3 text-right">Tổng Chi Phí</th>
                  <th className="py-3 px-3 text-right font-black">Lợi Nhuận Ròng</th>
                  <th className="py-3 px-3 text-center">Tỷ Suất Sinh Lời</th>
                  <th className="py-3 px-3 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {finances.map((f) => {
                  const isCurrent = f.monthKey === selectedMonthKey || f.id === selectedMonthKey;
                  const fixedCost = (f.officeCost || 0) + (f.electricityCost || 0) + (f.waterCost || 0);
                  const isProfitable = (f.netProfit || 0) >= 0;

                  return (
                    <tr
                      key={f.id || f.monthKey}
                      className={`hover:bg-slate-50 transition-colors ${
                        isCurrent ? 'bg-amber-50/60 font-bold' : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-black text-slate-900 flex items-center space-x-2">
                        {isCurrent && <span className="w-2 h-2 rounded-full bg-amber-500"></span>}
                        <span>{f.title || `Tháng ${f.month}/${f.year}`}</span>
                        {isCurrent && (
                          <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded-full font-bold">
                            Đang xem
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-emerald-700">
                        {formatCurrencyVND(f.totalRevenue || 0)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-700">
                        {formatCurrencyVND(fixedCost)}
                      </td>
                      <td className="py-3 px-3 text-right text-blue-700 font-bold">
                        {formatCurrencyVND(f.totalSalary || 0)}
                      </td>
                      <td className="py-3 px-3 text-right text-rose-700 font-bold">
                        {formatCurrencyVND(f.totalExpenses || 0)}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-black text-sm ${
                          isProfitable ? 'text-teal-700' : 'text-rose-700'
                        }`}
                      >
                        {isProfitable ? '+' : ''}
                        {formatCurrencyVND(f.netProfit || 0)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                            isProfitable
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {f.profitMargin || 0}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMonthKey(f.monthKey || f.id);
                              setActiveSection('overview');
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                          >
                            Xem Chi Tiết
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMonth(f.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Xóa tháng"
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
      )}

      {/* ========================================== */}
      {/* MODAL 1: THÊM / SỬA NGUỒN TIỀN VỀ (REVENUE) */}
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
                  Nhập số tiền và nguồn thu đối tác trong tháng {activeMonthRecord.title || selectedMonthKey}
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
      {/* ========================================== */}
      {isSalaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setIsSalaryModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  {editingSalaryItem ? 'Cập Nhật Lương Nhân Viên' : 'Thêm Nhân Viên Vào Bảng Lương'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Lương cứng + thưởng KPI - trừ phạt trong tháng {activeMonthRecord.title || selectedMonthKey}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveSalaryItem} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Chọn Hoặc Nhập Tên Nhân Viên <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  list="staff-suggestions"
                  placeholder="Ví dụ: Anh Quỳnh, Phương My, Bảo..."
                  value={salaryStaffName}
                  onChange={(e) => setSalaryStaffName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
                <datalist id="staff-suggestions">
                  {availableStaffNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Lương Cơ Bản</label>
                  <input
                    type="text"
                    value={salaryBaseInput}
                    onChange={(e) => setSalaryBaseInput(e.target.value)}
                    placeholder="8000000"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-emerald-700 mb-1">Thưởng KPI</label>
                  <input
                    type="text"
                    value={salaryBonusInput}
                    onChange={(e) => setSalaryBonusInput(e.target.value)}
                    placeholder="2000000"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-emerald-700 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-rose-600 mb-1">Trừ / Phạt / Ứng</label>
                  <input
                    type="text"
                    value={salaryDeductionInput}
                    onChange={(e) => setSalaryDeductionInput(e.target.value)}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-rose-700 font-mono"
                  />
                </div>
              </div>

              {/* Tính thực nhận preview */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900">Tổng Thực Nhận:</span>
                <span className="text-base font-black text-blue-800">
                  {formatCurrencyVND(
                    Math.max(
                      0,
                      parseNumberInput(salaryBaseInput) +
                        parseNumberInput(salaryBonusInput) -
                        parseNumberInput(salaryDeductionInput)
                    )
                  )}
                </span>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={salaryIsPaid}
                    onChange={(e) => setSalaryIsPaid(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                  />
                  <span>Đã thanh toán chuyển khoản cho nhân viên này</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ghi Chú Đánh Giá / Lý Do Thưởng Phạt</label>
                <textarea
                  rows={2}
                  placeholder="Ví dụ: Thưởng vượt 200 bài, phạt đi muộn 1 lần..."
                  value={salaryNote}
                  onChange={(e) => setSalaryNote(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsSalaryModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer"
                >
                  {editingSalaryItem ? 'Lưu Cập Nhật' : 'Lưu Vào Bảng Lương'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 3: TẠO THÁNG MỚI */}
      {/* ========================================== */}
      {isNewMonthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setIsNewMonthModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Tạo Kỳ Tài Chính Tháng Mới</h3>
                <p className="text-[11px] text-slate-500">
                  Hệ thống sẽ tự động sao chép bảng chi phí và danh sách nhân viên từ tháng trước sang!
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

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                Mã tháng sẽ tạo:{' '}
                <strong className="text-amber-800 font-mono">
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
                  Tạo Tháng Này
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
