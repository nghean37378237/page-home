import React, { useState, useRef, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  CheckCircle2,
  UserCheck,
  Shield,
  ShieldCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  User,
  Users,
  LogOut,
  KeyRound,
  Database,
  Layers,
  Globe,
  Briefcase,
  Wrench,
  LayoutGrid,
  ListFilter,
} from 'lucide-react';
import { PageRecord, AppUser, FullViaItem, TabKey } from '../types';

export interface NavTabItem {
  id: TabKey;
  num: number;
  title: string;
  fullTitle: string;
  description: string;
  count: string | number;
  unit: string;
  newCount: number;
  icon: React.ComponentType<{ className?: string }>;
  activeClass: string;
  activeNumClass: string;
  dotColor: string;
  accentColor: string;
}

export type NavGroupKey = 'fb_ops' | 'web_studio' | 'hr_finance' | 'infra_tools';

interface NavGroupConfig {
  id: NavGroupKey;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tabIds: TabKey[];
  activeBg: string;
  activeBorder: string;
  badgeBg: string;
  subBarBg: string;
}

const NAV_GROUPS: NavGroupConfig[] = [
  {
    id: 'fb_ops',
    label: 'Facebook & Via',
    shortLabel: 'FB & Via',
    description: 'Quản lý Fanpage, Group Facebook và Kho Nick Full Via',
    icon: FileSpreadsheet,
    tabIds: ['fanpage', 'group', 'fullvia'],
    activeBg: 'bg-emerald-700 text-white shadow-xs ring-2 ring-emerald-500/25',
    activeBorder: 'border-emerald-600',
    badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    subBarBg: 'from-emerald-50/80 via-white to-indigo-50/50 border-emerald-200/80',
  },
  {
    id: 'web_studio',
    label: 'Website & Làm Ảnh',
    shortLabel: 'Web & Làm Ảnh',
    description: 'Quy trình chuẩn: 1. Viết Bài Lên Web → 2. Xưởng Ghép Ảnh Tự Động → 3. Thống Kê View Realtime',
    icon: Globe,
    tabIds: ['web_publish', 'image_studio', 'view_stats'],
    activeBg: 'bg-cyan-700 text-white shadow-xs ring-2 ring-cyan-500/25',
    activeBorder: 'border-cyan-600',
    badgeBg: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    subBarBg: 'from-cyan-50/80 via-white to-emerald-50/50 border-cyan-200/80',
  },
  {
    id: 'hr_finance',
    label: 'Nhân Sự & Lương',
    shortLabel: 'Nhân Sự & Lương',
    description: 'Hồ sơ nhân viên, bảng lương tháng, doanh thu & phân quyền hệ thống',
    icon: Briefcase,
    tabIds: ['staff_info', 'staff_management', 'revenue'],
    activeBg: 'bg-blue-700 text-white shadow-xs ring-2 ring-blue-500/25',
    activeBorder: 'border-blue-600',
    badgeBg: 'bg-blue-50 text-blue-800 border-blue-200',
    subBarBg: 'from-blue-50/80 via-white to-amber-50/50 border-blue-200/80',
  },
  {
    id: 'infra_tools',
    label: 'Proxy & Công Cụ',
    shortLabel: 'Proxy & Web',
    description: 'Quản lý IP Proxy nuôi Via & Tài khoản Web dùng chung (Canva, ChatGPT...)',
    icon: Wrench,
    tabIds: ['proxy', 'shared_accounts'],
    activeBg: 'bg-purple-700 text-white shadow-xs ring-2 ring-purple-500/25',
    activeBorder: 'border-purple-600',
    badgeBg: 'bg-purple-50 text-purple-800 border-purple-200',
    subBarBg: 'from-purple-50/80 via-white to-teal-50/50 border-purple-200/80',
  },
];

const NAV_LAYOUT_STORAGE_KEY = 'ql_fanpage_nav_layout_mode_v1';

interface SheetHeaderProps {
  records: PageRecord[];
  allRecordsCount: number;
  currentUser: AppUser;
  availableUsers: AppUser[];
  pendingRequestsCount: number;
  activeTab?: TabKey;
  navTabs?: NavTabItem[];
  onSelectTab?: (tab: TabKey) => void;
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
  onOpenChangeMyPin?: () => void;
}

export const SheetHeader: React.FC<SheetHeaderProps> = ({
  records,
  allRecordsCount,
  currentUser,
  availableUsers,
  pendingRequestsCount,
  activeTab = 'fanpage',
  navTabs = [],
  onSelectTab,
  viaList = [],
  onNavigateToStaffTab,
  onOpenAdminApprovalModal,
  onOpenAuthModal,
  onLogout,
  onSelectUser,
  onOpenChangeMyPin,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isAllTabsMenuOpen, setIsAllTabsMenuOpen] = useState(false);
  const [navMode, setNavMode] = useState<'grouped' | 'flat'>(() => {
    try {
      const saved = localStorage.getItem(NAV_LAYOUT_STORAGE_KEY);
      if (saved === 'flat' || saved === 'grouped') return saved;
    } catch {}
    return 'grouped';
  });
  // Lưu lại tab gần nhất người dùng chọn trong từng nhóm để khi bấm chuyển nhóm sẽ mở đúng tab quen dùng
  const [lastTabByGroup, setLastTabByGroup] = useState<Partial<Record<NavGroupKey, TabKey>>>({});
  const tabListRef = useRef<HTMLDivElement | null>(null);

  const handleToggleNavMode = () => {
    const next = navMode === 'grouped' ? 'flat' : 'grouped';
    setNavMode(next);
    try {
      localStorage.setItem(NAV_LAYOUT_STORAGE_KEY, next);
    } catch {}
  };

  const handleScrollTabs = (direction: 'left' | 'right') => {
    if (!tabListRef.current) return;
    const scrollAmount = 260;
    tabListRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // Phân bổ navTabs hiện có vào 4 nhóm khoa học
  const visibleGroups = useMemo(() => {
    const tabMap = new Map<TabKey, NavTabItem>();
    navTabs.forEach((t) => tabMap.set(t.id, t));

    return NAV_GROUPS.map((group) => {
      const items = group.tabIds
        .map((id) => tabMap.get(id))
        .filter((item): item is NavTabItem => Boolean(item));
      const totalNewCount = items.reduce((sum, item) => sum + (item.newCount || 0), 0);
      return {
        ...group,
        items,
        totalNewCount,
      };
    }).filter((g) => g.items.length > 0);
  }, [navTabs]);

  // Xác định nhóm đang active dựa trên activeTab hiện tại
  const currentGroup = useMemo(() => {
    return (
      visibleGroups.find((g) => g.items.some((i) => i.id === activeTab)) ||
      visibleGroups[0] ||
      null
    );
  }, [visibleGroups, activeTab]);

  const handleSelectTabWithMemory = (tabId: TabKey) => {
    if (!onSelectTab) return;
    const grp = visibleGroups.find((g) => g.items.some((i) => i.id === tabId));
    if (grp) {
      setLastTabByGroup((prev) => ({ ...prev, [grp.id]: tabId }));
    }
    onSelectTab(tabId);
  };

  const handleSelectGroup = (group: (typeof visibleGroups)[number]) => {
    if (!onSelectTab || group.items.length === 0) return;
    const remembered = lastTabByGroup[group.id];
    const targetTab =
      remembered && group.items.some((i) => i.id === remembered)
        ? remembered
        : group.items[0].id;
    setLastTabByGroup((prev) => ({ ...prev, [group.id]: targetTab }));
    onSelectTab(targetTab);
  };

  const activeNavTabObj = useMemo(
    () => navTabs.find((t) => t.id === activeTab) || navTabs[0],
    [navTabs, activeTab]
  );

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
      {/* HÀNG 1: LOGO + 4 NHÓM ĐIỀU HƯỚNG KHOA HỌC (HOẶC DẠNG ĐẦY ĐỦ) + TÀI KHOẢN */}
      <div className="max-w-[1700px] mx-auto px-2.5 sm:px-5 py-1.5">
        <div className="flex items-center justify-between gap-2">
          {/* 1. Bên trái: Logo, Tên Hệ Thống & Nút Bảo Mật / Cloud */}
          <div className="flex items-center space-x-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-[#2e7d32] text-white flex items-center justify-center shadow-2xs shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div className="flex items-center space-x-1.5">
              <h1 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight whitespace-nowrap hidden xl:block">
                QL Fanpage & Web
              </h1>
              <button
                type="button"
                id="btn-security-center-header"
                onClick={() => onOpenAdminApprovalModal('security_db')}
                className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded-md border border-emerald-300 cursor-pointer shadow-2xs transition-colors"
                title="Hệ thống CSDL Cloud Firestore (Đồng bộ thời gian thực) & Trung tâm Bảo mật. Bấm để xem chi tiết"
              >
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span className="hidden md:inline">Cloud</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[9px] bg-emerald-200/80 text-emerald-800 font-extrabold px-1 rounded">
                  Sec
                </span>
              </button>
            </div>
          </div>

          {/* 2. Ở giữa: Thanh Điều Hướng Gom Nhóm Khoa Học (4 Phân Khu Chính) */}
          {navTabs.length > 0 && onSelectTab && (
            <div className="flex items-center gap-1.5 flex-1 min-w-0 mx-1">
              {navMode === 'grouped' ? (
                <>
                  {/* 4 Phân Khu Chính — Gọn gàng, không cần cuộn ngang */}
                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 flex-1">
                    {visibleGroups.map((group, gIdx) => {
                      const isGroupActive = currentGroup?.id === group.id;
                      const GroupIcon = group.icon;
                      const activeSubInGroup =
                        group.items.find((i) => i.id === activeTab) || group.items[0];

                      return (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => handleSelectGroup(group)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
                            isGroupActive
                              ? `${group.activeBg} border-transparent`
                              : 'bg-slate-50/90 text-slate-700 hover:bg-slate-100 hover:text-slate-950 border-slate-200/90'
                          }`}
                          title={`${group.label}: ${group.items.map((i) => i.title).join(' • ')}`}
                        >
                          <span
                            className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
                              isGroupActive
                                ? 'bg-white/20 text-white'
                                : 'bg-white text-slate-700 border border-slate-200'
                            }`}
                          >
                            {gIdx + 1}
                          </span>
                          <GroupIcon className="w-3.5 h-3.5 shrink-0" />
                          <span>{group.label}</span>

                          {/* Hiển thị số tab con hoặc tên tab con đang mở */}
                          <span
                            className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                              isGroupActive
                                ? 'bg-black/20 text-white'
                                : 'bg-white text-slate-500 border border-slate-200/80'
                            }`}
                          >
                            {isGroupActive && activeSubInGroup
                              ? activeSubInGroup.title
                              : `${group.items.length} mục`}
                          </span>

                          {group.totalNewCount > 0 && (
                            <span
                              className="px-1.5 py-0.1 rounded-full text-[9.5px] font-black bg-rose-600 text-white shadow-xs ring-1 ring-rose-300 animate-pulse"
                              title={`Có ${group.totalNewCount} mục mới cần xử lý`}
                            >
                              🔴+{group.totalNewCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Nút mở Menu Tất Cả Bảng (1 chạm nhảy tới bất kỳ bảng nào) & Đổi kiểu hiển thị */}
                  <div className="relative shrink-0 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setIsAllTabsMenuOpen((prev) => !prev)}
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/90 cursor-pointer transition-colors"
                      title="Xem danh mục tất cả các bảng trong hệ thống"
                    >
                      <LayoutGrid className="w-3.5 h-3.5 text-slate-600" />
                      <span className="hidden md:inline">Tất cả ({navTabs.length})</span>
                      <ChevronDown className="w-3 h-3 text-slate-500" />
                    </button>

                    {isAllTabsMenuOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setIsAllTabsMenuOpen(false)}
                        />
                        <div className="absolute right-0 top-full mt-1.5 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 p-3 text-xs space-y-2.5">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <div>
                              <div className="font-black text-slate-900 text-xs">
                                Danh Mục Hệ Thống ({navTabs.length} Bảng)
                              </div>
                              <p className="text-[10px] text-slate-500">
                                Đã gom thành {visibleGroups.length} nhóm khoa học để thao tác nhanh
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                handleToggleNavMode();
                                setIsAllTabsMenuOpen(false);
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] cursor-pointer"
                            >
                              Dàn ngang 1 hàng
                            </button>
                          </div>

                          <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-1">
                            {visibleGroups.map((grp) => (
                              <div key={grp.id} className="space-y-1">
                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1 flex items-center justify-between">
                                  <span>{grp.label}</span>
                                  <span>{grp.items.length} bảng</span>
                                </div>
                                <div className="grid grid-cols-1 gap-1">
                                  {grp.items.map((item) => {
                                    const isCurrent = item.id === activeTab;
                                    const ItemIcon = item.icon;
                                    return (
                                      <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => {
                                          handleSelectTabWithMemory(item.id);
                                          setIsAllTabsMenuOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left transition-all cursor-pointer ${
                                          isCurrent
                                            ? `${item.activeClass} font-bold`
                                            : 'hover:bg-slate-50 text-slate-800 border border-slate-100'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span
                                            className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
                                              isCurrent
                                                ? 'bg-white/20 text-white'
                                                : 'bg-slate-100 text-slate-700'
                                            }`}
                                          >
                                            B{item.num}
                                          </span>
                                          <ItemIcon className="w-3.5 h-3.5 shrink-0" />
                                          <div className="truncate">
                                            <div className="text-xs font-bold truncate">
                                              {item.title}
                                            </div>
                                          </div>
                                        </div>
                                        <span
                                          className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                                            isCurrent
                                              ? 'bg-white/25 text-white'
                                              : 'bg-slate-100 text-slate-600'
                                          }`}
                                        >
                                          {item.count} {item.unit}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : (
                /* Chế độ Dàn Ngang Tất Cả Bảng (Flat Mode) nếu người dùng muốn mở rộng */
                <>
                  <button
                    type="button"
                    onClick={() => handleScrollTabs('left')}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer hidden sm:flex"
                    title="Cuộn sang trái"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <div
                    ref={tabListRef}
                    className="flex items-center space-x-1 overflow-x-auto scrollbar-none scroll-smooth flex-1 py-0.5"
                  >
                    {navTabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        id={`tab-btn-${tab.id}-table`}
                        onClick={() => handleSelectTabWithMemory(tab.id)}
                        className={`inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 group ${
                          activeTab === tab.id
                            ? tab.activeClass
                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/90'
                        }`}
                        title={`${tab.fullTitle} — ${tab.description}`}
                      >
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-black shrink-0 transition-colors ${
                            activeTab === tab.id
                              ? tab.activeNumClass
                              : 'bg-white text-slate-700 border border-slate-200/80 group-hover:bg-slate-200'
                          }`}
                        >
                          {tab.num}
                        </span>

                        <tab.icon className="w-3 h-3 shrink-0" />
                        <span>{tab.title}</span>

                        <span
                          className={`px-1.5 py-0.1 rounded-full text-[10px] font-black ${
                            activeTab === tab.id
                              ? 'bg-white/25 text-white'
                              : 'bg-white text-slate-700 border border-slate-200'
                          }`}
                        >
                          {tab.count}
                        </span>

                        {tab.newCount > 0 && (
                          <span
                            className="px-1.5 py-0.1 rounded-full text-[9.5px] font-black bg-rose-600 text-white shadow-xs ring-1 ring-rose-300 animate-pulse"
                            title={`Có ${tab.newCount} ${tab.unit} mới được chuyển giao!`}
                          >
                            🔴+{tab.newCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleScrollTabs('right')}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer hidden sm:flex"
                    title="Cuộn sang phải"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleNavMode}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0 cursor-pointer"
                    title="Thu gọn thành 4 nhóm khoa học"
                  >
                    <Layers className="w-3 h-3" />
                    <span className="hidden md:inline">Gom Nhóm</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* 3. Bên phải: QL Nhân Sự, Chuyển đổi Tài khoản, Sao lưu, Đăng xuất */}
          <div className="flex items-center space-x-1.5 shrink-0">
            {currentUser.role === 'admin' && pendingRequestsCount > 0 && (
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
                className="relative inline-flex items-center space-x-1 px-2 py-1 text-[11px] font-bold rounded-lg border bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-xs animate-pulse cursor-pointer"
                title="Có yêu cầu tài khoản nhân viên chờ duyệt"
              >
                <UserCheck className="w-3 h-3" />
                <span className="hidden sm:inline">Duyệt NV</span>
                <span className="bg-red-600 text-white text-[10px] font-extrabold px-1 rounded-full">
                  {pendingRequestsCount}
                </span>
              </button>
            )}

            {/* Account / Role Switcher dropdown */}
            <div className="relative">
              <button
                type="button"
                id="btn-role-switcher"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className={`inline-flex items-center space-x-1 px-2 py-1 text-[11px] font-bold rounded-lg border transition-all shadow-2xs cursor-pointer ${
                  currentUser.role === 'admin'
                    ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                    : 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                }`}
                title="Tài khoản đang thao tác (Bấm để đổi góc nhìn Nhân viên / Admin)"
              >
                {currentUser.role === 'admin' ? (
                  <Shield className="w-3 h-3 text-amber-600" />
                ) : (
                  <User className="w-3 h-3 text-emerald-600" />
                )}
                <span className="max-w-[85px] sm:max-w-[110px] truncate">
                  {currentUser.role === 'admin' ? 'Admin' : currentUser.name}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </button>

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
                              onSelectUser({
                                id: 'admin',
                                name: 'Quản Lý (Admin)',
                                role: 'admin',
                                status: 'approved',
                                isAuthenticated: true,
                              });
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

                          {onOpenChangeMyPin && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsUserMenuOpen(false);
                                onOpenChangeMyPin();
                              }}
                              className="w-full text-left px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-lg flex items-center space-x-2 transition-colors cursor-pointer border border-blue-200"
                            >
                              <KeyRound className="w-4 h-4 text-blue-600 shrink-0" />
                              <div>
                                <div className="font-bold">Đổi Mật Khẩu / PIN Của Tôi</div>
                                <div className="text-[10px] text-blue-700">Cập nhật mã PIN cá nhân</div>
                              </div>
                            </button>
                          )}

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
              className="p-1 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
              title="Tải bản sao lưu an toàn toàn bộ dữ liệu (JSON)"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              id="btn-logout-header"
              onClick={onLogout}
              className="p-1 text-slate-500 hover:text-red-700 hover:bg-red-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Đăng xuất khỏi hệ thống"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* HÀNG 2 SIÊU GỌN: THANH CHUYỂN NHANH CÁC BẢNG CON TRONG NHÓM ĐANG MỞ */}
      {navMode === 'grouped' && currentGroup && onSelectTab && (
        <div
          className={`bg-gradient-to-r ${currentGroup.subBarBg} border-t border-slate-200/80 px-2.5 sm:px-5 py-1`}
        >
          <div className="max-w-[1700px] mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mr-1 hidden sm:inline-flex items-center gap-1">
                <span>Nhóm {currentGroup.label}:</span>
              </span>

              {currentGroup.items.map((tab) => {
                const isSelected = tab.id === activeTab;
                const SubIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    id={`tab-btn-${tab.id}-table`}
                    onClick={() => handleSelectTabWithMemory(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      isSelected
                        ? tab.activeClass
                        : 'bg-white/90 text-slate-700 hover:bg-white hover:text-slate-950 border border-slate-200/90 shadow-2xs'
                    }`}
                    title={`${tab.fullTitle} — ${tab.description}`}
                  >
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-black shrink-0 ${
                        isSelected
                          ? tab.activeNumClass
                          : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                      }`}
                    >
                      B{tab.num}
                    </span>

                    <SubIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>{tab.title}</span>

                    <span
                      className={`px-1.5 py-0.1 rounded-full text-[10px] font-black ${
                        isSelected
                          ? 'bg-white/25 text-white'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {tab.count} {tab.unit}
                    </span>

                    {tab.newCount > 0 && (
                      <span
                        className="px-1.5 py-0.1 rounded-full text-[9.5px] font-black bg-rose-600 text-white shadow-xs ring-1 ring-rose-300 animate-pulse"
                        title={`Có ${tab.newCount} ${tab.unit} mới được chuyển giao!`}
                      >
                        🔴+{tab.newCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {activeNavTabObj && (
              <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-500 truncate">
                <span className="font-semibold text-slate-700 truncate">
                  {activeNavTabObj.fullTitle}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
