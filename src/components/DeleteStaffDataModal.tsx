import React, { useState, useMemo, useEffect } from 'react';
import {
  Trash2,
  AlertTriangle,
  Users,
  FileSpreadsheet,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  X,
  Search,
  Check,
  ArrowRightLeft,
  UserCheck,
  Lock,
} from 'lucide-react';
import {
  PageRecord,
  FullViaItem,
  GroupRecord,
  UserAccount,
  ADMIN_WAITING_POOL,
  isAdminWaitingPool,
  areStaffNamesEquivalent,
} from '../types';
import { FullStaffTransferOptions } from './TransferPageViaModal';

interface DeleteStaffDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  presetStaffName?: string;
  allStaffNames: string[];
  records: PageRecord[];
  viaList: FullViaItem[];
  groupRecords?: GroupRecord[];
  accounts: UserAccount[];
  onConfirmDelete: (
    staffName: string,
    options: {
      deleteFanpages: boolean;
      deleteVias: boolean;
      deleteGroups?: boolean;
      deleteAccount: boolean;
    }
  ) => Promise<void>;
  onConfirmTransferFullStaff?: (options: FullStaffTransferOptions) => Promise<void>;
}

export const DeleteStaffDataModal: React.FC<DeleteStaffDataModalProps> = ({
  isOpen,
  onClose,
  presetStaffName = '',
  allStaffNames,
  records,
  viaList,
  groupRecords = [],
  accounts,
  onConfirmDelete,
  onConfirmTransferFullStaff,
}) => {
  // 'transfer_all': Chuyển toàn bộ Via + Group + Page sang nhân viên khác (Khuyên dùng khi nhân viên nghỉ việc)
  // 'delete_all': Xóa vĩnh viễn dữ liệu của nhân viên
  const [actionMode, setActionMode] = useState<'transfer_all' | 'delete_all'>('transfer_all');

  const [selectedStaff, setSelectedStaff] = useState<string>(presetStaffName);
  const [targetStaff, setTargetStaff] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Transfer options
  const [transferVias, setTransferVias] = useState(true);
  const [transferGroups, setTransferGroups] = useState(true);
  const [transferPages, setTransferPages] = useState(true);
  const [oldAccountAction, setOldAccountAction] = useState<'keep' | 'block' | 'delete'>('delete');

  // Delete options
  const [deleteFanpages, setDeleteFanpages] = useState(true);
  const [deleteVias, setDeleteVias] = useState(true);
  const [deleteGroups, setDeleteGroups] = useState(true);
  const [deleteAccount, setDeleteAccount] = useState(true);

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Distinct staff list with counts (including records, viaList, groupRecords, accounts)
  const staffSummaries = useMemo(() => {
    const nameMap = new Map<string, string>();
    const registerName = (raw?: string) => {
      const clean = (raw || '').trim();
      if (!clean || isAdminWaitingPool(clean) || clean.toLowerCase() === 'all') return;
      const lower = clean.toLowerCase();
      if (!nameMap.has(lower)) {
        nameMap.set(lower, clean);
      }
    };

    allStaffNames.forEach(registerName);
    accounts.forEach((a) => {
      if (a.role !== 'admin') registerName(a.username);
    });
    records.forEach((r) => registerName(r.staffName));
    viaList.forEach((v) => registerName(v.staffName));
    groupRecords.forEach((g) => registerName(g.staffName));

    return Array.from(nameMap.values()).map((name) => {
      const nameLower = name.trim().toLowerCase();
      const matchStaff = (candidate?: string) =>
        Boolean(
          candidate &&
            (candidate.trim().toLowerCase() === nameLower ||
              areStaffNamesEquivalent(candidate, name))
        );

      const staffRecords = records.filter((r) => matchStaff(r.staffName));
      const staffVias = viaList.filter((v) => matchStaff(v.staffName));
      const staffGroups = groupRecords.filter((g) => matchStaff(g.staffName));
      const matchedAccount = accounts.find((a) => matchStaff(a.username));

      return {
        name,
        fanpagesCount: staffRecords.length,
        viasCount: staffVias.length,
        groupsCount: staffGroups.length,
        hasAccount: Boolean(matchedAccount),
        accountStatus: matchedAccount?.status,
        accountRole: matchedAccount?.role,
      };
    });
  }, [allStaffNames, records, viaList, groupRecords, accounts]);

  // Sync presetStaffName when modal opens
  useEffect(() => {
    if (isOpen) {
      const initialSrc =
        presetStaffName || (staffSummaries.length > 0 ? staffSummaries[0].name : '');
      setSelectedStaff(initialSrc);
      const firstOther = staffSummaries.find(
        (s) => s.name.trim().toLowerCase() !== initialSrc.trim().toLowerCase()
      );
      setTargetStaff(firstOther ? firstOther.name : ADMIN_WAITING_POOL);
      setActionMode(onConfirmTransferFullStaff ? 'transfer_all' : 'delete_all');
      setErrorMessage(null);
      setTransferVias(true);
      setTransferGroups(true);
      setTransferPages(true);
      setOldAccountAction('delete');
      setDeleteFanpages(true);
      setDeleteVias(true);
      setDeleteGroups(true);
      setDeleteAccount(true);
    }
  }, [isOpen, presetStaffName, staffSummaries, onConfirmTransferFullStaff]);

  // Filtered staff dropdown list
  const filteredStaffList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return staffSummaries;
    return staffSummaries.filter((s) => s.name.toLowerCase().includes(q));
  }, [staffSummaries, searchQuery]);

  // Active selected staff details
  const currentStaffSummary = useMemo(() => {
    return staffSummaries.find(
      (s) => s.name.trim().toLowerCase() === selectedStaff.trim().toLowerCase()
    );
  }, [staffSummaries, selectedStaff]);

  // Specific list of records, vias & groups of the selected staff to preview
  const staffPagesPreview = useMemo(() => {
    if (!selectedStaff) return [];
    const nameLower = selectedStaff.trim().toLowerCase();
    return records.filter(
      (r) =>
        r.staffName?.trim().toLowerCase() === nameLower ||
        areStaffNamesEquivalent(r.staffName, selectedStaff)
    );
  }, [records, selectedStaff]);

  const staffGroupsPreview = useMemo(() => {
    if (!selectedStaff) return [];
    const nameLower = selectedStaff.trim().toLowerCase();
    return groupRecords.filter(
      (g) =>
        g.staffName?.trim().toLowerCase() === nameLower ||
        areStaffNamesEquivalent(g.staffName, selectedStaff)
    );
  }, [groupRecords, selectedStaff]);

  if (!isOpen) return null;

  const handleExecuteAction = async () => {
    if (!selectedStaff.trim()) {
      setErrorMessage('Vui lòng chọn nhân viên cũ / nguồn cần xử lý.');
      return;
    }

    if (actionMode === 'transfer_all' && onConfirmTransferFullStaff) {
      if (!targetStaff.trim()) {
        setErrorMessage('Vui lòng chọn nhân viên mới nhận bàn giao (hoặc Kho Chờ Admin).');
        return;
      }
      if (
        selectedStaff.trim().toLowerCase() === targetStaff.trim().toLowerCase() ||
        areStaffNamesEquivalent(selectedStaff, targetStaff)
      ) {
        setErrorMessage('Nhân viên nhận bàn giao phải khác với nhân viên cũ.');
        return;
      }
      if (!transferVias && !transferGroups && !transferPages) {
        setErrorMessage('Vui lòng tích chọn ít nhất 1 mục cần chuyển (Via, Group hoặc Page).');
        return;
      }

      setIsProcessing(true);
      setErrorMessage(null);
      try {
        const todayStr = `${new Date().getDate()}/${new Date().getMonth() + 1}`;
        await onConfirmTransferFullStaff({
          sourceStaffName: selectedStaff.trim(),
          targetStaffName: targetStaff.trim(),
          transferVias,
          transferGroups,
          transferPages,
          oldAccountAction,
          appendHistoryNote: true,
          historyNoteText: `Bàn giao full từ NV ${selectedStaff.trim()} sang ${targetStaff.trim()} (${todayStr})`,
        });
        onClose();
      } catch (err: any) {
        console.error('Lỗi khi chuyển full dữ liệu nhân viên:', err);
        setErrorMessage(err.message || 'Đã xảy ra lỗi khi chuyển dữ liệu nhân viên.');
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    if (!deleteFanpages && !deleteVias && !deleteGroups && !deleteAccount) {
      setErrorMessage('Vui lòng chọn ít nhất một mục cần xóa.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      await onConfirmDelete(selectedStaff.trim(), {
        deleteFanpages,
        deleteVias,
        deleteGroups,
        deleteAccount,
      });
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi xóa toàn bộ dữ liệu nhân viên:', err);
      setErrorMessage(err.message || 'Đã xảy ra lỗi khi xóa dữ liệu trên hệ thống.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-fadeIn my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                actionMode === 'transfer_all'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-rose-100 text-rose-600'
              }`}
            >
              {actionMode === 'transfer_all' ? (
                <ArrowRightLeft className="w-5 h-5" />
              ) : (
                <Trash2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Xử Lý Nhân Viên Nghỉ Việc: Bàn Giao Full (Via/Group/Page) Hoặc Xóa
              </h3>
              <p className="text-xs text-slate-500">
                Chuyển toàn bộ Via, Group, Fanpage sang nhân viên khác khi NV cũ nghỉ hoặc xóa sạch dữ liệu
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="py-4 space-y-4 overflow-y-auto flex-1 pr-1">
          {/* Mode Switcher */}
          {onConfirmTransferFullStaff && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActionMode('transfer_all')}
                className={`py-2 px-3 rounded-lg transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                  actionMode === 'transfer_all'
                    ? 'bg-gradient-to-r from-indigo-600 to-emerald-600 text-white shadow-xs font-extrabold'
                    : 'text-slate-700 hover:bg-white'
                }`}
              >
                <UserCheck className="w-4 h-4 shrink-0" />
                <span>🔄 Chuyển Full Sang NV Khác (Khuyên dùng)</span>
              </button>
              <button
                type="button"
                onClick={() => setActionMode('delete_all')}
                className={`py-2 px-3 rounded-lg transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                  actionMode === 'delete_all'
                    ? 'bg-rose-600 text-white shadow-xs font-extrabold'
                    : 'text-rose-700 hover:bg-white'
                }`}
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <span>🗑️ Xóa Vĩnh Viễn Dữ Liệu NV</span>
              </button>
            </div>
          )}

          {/* Step 1: Employee Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              1. Chọn Nhân Viên Cũ (Nhân Viên Nghỉ / Cần Chuyển Hoặc Xóa)
            </label>
            <div className="space-y-2">
              <div className="relative">
                <select
                  value={selectedStaff}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedStaff(val);
                    setErrorMessage(null);
                    if (targetStaff.trim().toLowerCase() === val.trim().toLowerCase()) {
                      const other = staffSummaries.find(
                        (s) => s.name.trim().toLowerCase() !== val.trim().toLowerCase()
                      );
                      setTargetStaff(other ? other.name : ADMIN_WAITING_POOL);
                    }
                  }}
                  className="w-full pl-3 pr-8 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 cursor-pointer"
                >
                  <option value="">-- Chọn 1 nhân viên bất kỳ --</option>
                  {filteredStaffList.map((s) => (
                    <option key={s.name} value={s.name}>
                      👤 {s.name} ({s.viasCount} Via • {s.groupsCount} Group • {s.fanpagesCount} Page
                      {s.hasAccount ? ' • Có TK' : ''})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick search filter if many staff */}
              {staffSummaries.length > 5 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm nhanh tên nhân viên trong danh sách..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-slate-400"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Employee Stats Preview */}
          {selectedStaff ? (
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-xs shadow-2xs">
                    {selectedStaff.trim().slice(0, 2).toUpperCase() || 'NV'}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{selectedStaff}</h4>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {currentStaffSummary?.hasAccount
                        ? 'Tài khoản nhân viên hệ thống'
                        : 'Nhân viên chưa tạo tài khoản'}
                    </span>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                    actionMode === 'transfer_all'
                      ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                      : 'bg-rose-100 text-rose-700 border-rose-200'
                  }`}
                >
                  {actionMode === 'transfer_all' ? 'Chuẩn bị bàn giao Full' : 'Chuẩn bị xóa'}
                </span>
              </div>

              {/* 4 Stat Cards: Via, Group, Fanpage, Tài khoản */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-center text-indigo-700 mb-1">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div className="text-base font-extrabold text-slate-900">
                    {currentStaffSummary?.viasCount || 0}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500">Nick Via (Bảng 4)</div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-center text-rose-600 mb-1">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="text-base font-extrabold text-slate-900">
                    {currentStaffSummary?.groupsCount || 0}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500">Group FB (Bảng 2)</div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-center text-emerald-700 mb-1">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div className="text-base font-extrabold text-slate-900">
                    {currentStaffSummary?.fanpagesCount || 0}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500">Fanpage (Bảng 1)</div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-center text-blue-700 mb-1">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div className="text-base font-extrabold text-slate-900">
                    {currentStaffSummary?.hasAccount ? '1' : '0'}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500">Tài khoản PIN</div>
                </div>
              </div>

              {/* Preview chips */}
              {(staffPagesPreview.length > 0 || staffGroupsPreview.length > 0) && (
                <div className="text-xs space-y-1.5">
                  {staffPagesPreview.length > 0 && (
                    <div>
                      <span className="text-[11px] font-bold text-slate-600 block mb-1">
                        Fanpage của nhân viên này ({staffPagesPreview.length} Page):
                      </span>
                      <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                        {staffPagesPreview.slice(0, 10).map((p) => (
                          <span
                            key={p.id}
                            className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-700 font-medium truncate max-w-[130px]"
                            title={p.pageName}
                          >
                            {p.pageName}
                          </span>
                        ))}
                        {staffPagesPreview.length > 10 && (
                          <span className="px-1.5 py-0.5 bg-slate-200 rounded text-[10px] text-slate-600 font-bold">
                            +{staffPagesPreview.length - 10} page khác
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
              Vui lòng chọn 1 nhân viên từ danh sách phía trên để xem trước dữ liệu
            </div>
          )}

          {/* Step 3: Mode-specific Options */}
          {selectedStaff && actionMode === 'transfer_all' && onConfirmTransferFullStaff ? (
            <div className="space-y-3">
              {/* Chọn nhân viên nhận bàn giao */}
              <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 space-y-2">
                <label className="block text-xs font-bold text-emerald-950 uppercase tracking-wide">
                  2. Chọn Nhân Viên Mới Nhận Toàn Bộ Bàn Giao (Via + Group + Page)
                </label>
                <select
                  value={targetStaff}
                  onChange={(e) => {
                    setTargetStaff(e.target.value);
                    setErrorMessage(null);
                  }}
                  className="w-full px-3 py-2 bg-white border-2 border-emerald-400 rounded-xl text-sm font-extrabold text-slate-900 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
                >
                  <option value="">-- Chọn nhân viên nhận bàn giao --</option>
                  <option value={ADMIN_WAITING_POOL}>
                    📦 {ADMIN_WAITING_POOL} (Cất vào Kho Chờ Admin)
                  </option>
                  {staffSummaries
                    .filter(
                      (s) => s.name.trim().toLowerCase() !== selectedStaff.trim().toLowerCase()
                    )
                    .map((s) => (
                      <option key={s.name} value={s.name}>
                        👤 {s.name} (Hiện có: {s.viasCount} Via • {s.groupsCount} Group • {s.fanpagesCount} Page)
                      </option>
                    ))}
                </select>

                {/* Tích chọn dữ liệu chuyển */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                  <label className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={transferVias}
                      onChange={(e) => setTransferVias(e.target.checked)}
                      className="rounded text-indigo-600 cursor-pointer"
                    />
                    <span className="font-bold text-slate-800">
                      Chuyển {currentStaffSummary?.viasCount || 0} Via
                    </span>
                  </label>
                  <label className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={transferGroups}
                      onChange={(e) => setTransferGroups(e.target.checked)}
                      className="rounded text-rose-600 cursor-pointer"
                    />
                    <span className="font-bold text-slate-800">
                      Chuyển {currentStaffSummary?.groupsCount || 0} Group
                    </span>
                  </label>
                  <label className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={transferPages}
                      onChange={(e) => setTransferPages(e.target.checked)}
                      className="rounded text-emerald-600 cursor-pointer"
                    />
                    <span className="font-bold text-slate-800">
                      Chuyển {currentStaffSummary?.fanpagesCount || 0} Page
                    </span>
                  </label>
                </div>
              </div>

              {/* Xử lý tài khoản nhân viên cũ sau khi chuyển */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 text-xs">
                <span className="font-bold text-slate-800 block uppercase text-[11px]">
                  3. Xử Lý Tài Khoản Nhân Viên Cũ ({selectedStaff}) Sau Khi Chuyển Xong:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="deleteModalOldAccAction"
                      checked={oldAccountAction === 'delete'}
                      onChange={() => setOldAccountAction('delete')}
                      className="text-rose-600"
                    />
                    <span className="font-bold text-rose-700">🗑️ Xóa TK NV cũ nghỉ</span>
                  </label>
                  <label className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="deleteModalOldAccAction"
                      checked={oldAccountAction === 'block'}
                      onChange={() => setOldAccountAction('block')}
                      className="text-amber-600"
                    />
                    <span className="font-bold text-amber-800">🔒 Tạm khóa TK NV cũ</span>
                  </label>
                  <label className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="deleteModalOldAccAction"
                      checked={oldAccountAction === 'keep'}
                      onChange={() => setOldAccountAction('keep')}
                      className="text-indigo-600"
                    />
                    <span className="font-bold text-slate-700">Giữ nguyên TK</span>
                  </label>
                </div>
              </div>
            </div>
          ) : selectedStaff ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                2. Tùy Chọn Dữ Liệu Sẽ Xóa Vĩnh Viễn (Mặc định xóa toàn bộ)
              </label>
              <div className="space-y-2 bg-rose-50/50 p-3 rounded-xl border border-rose-200 text-xs">
                <label className="flex items-start space-x-2.5 text-slate-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={deleteFanpages}
                    onChange={(e) => setDeleteFanpages(e.target.checked)}
                    className="mt-0.5 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-900">
                      Xóa toàn bộ {currentStaffSummary?.fanpagesCount || 0} Fanpage & lịch sử đăng bài
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Toàn bộ các dòng bảng tính Fanpage của nhân viên này sẽ được xóa vĩnh viễn trên Cloud Firestore.
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-2.5 text-slate-800 cursor-pointer select-none pt-1 border-t border-rose-100">
                  <input
                    type="checkbox"
                    checked={deleteVias}
                    onChange={(e) => setDeleteVias(e.target.checked)}
                    className="mt-0.5 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-900">
                      Xóa toàn bộ {currentStaffSummary?.viasCount || 0} Nick Via FB thuộc nhân viên này
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Xóa danh sách tài khoản Full Via (UID/Pass/2FA) được gán cho nhân viên này.
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-2.5 text-slate-800 cursor-pointer select-none pt-1 border-t border-rose-100">
                  <input
                    type="checkbox"
                    checked={deleteGroups}
                    onChange={(e) => setDeleteGroups(e.target.checked)}
                    className="mt-0.5 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-900">
                      Xóa toàn bộ {currentStaffSummary?.groupsCount || 0} dòng Group FB thuộc nhân viên này
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Xóa các nhóm Facebook do nhân viên này đang đứng tên phụ trách trong Bảng 2.
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-2.5 text-slate-800 cursor-pointer select-none pt-1 border-t border-rose-100">
                  <input
                    type="checkbox"
                    checked={deleteAccount}
                    onChange={(e) => setDeleteAccount(e.target.checked)}
                    className="mt-0.5 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-900">
                      Xóa tài khoản đăng nhập & thu hồi quyền hệ thống
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Thu hồi mã PIN, khóa đăng nhập và xóa tên khỏi danh sách nhân viên gợi ý.
                    </p>
                  </div>
                </label>
              </div>

              <div className="mt-2 flex items-start space-x-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed text-[11px]">
                  <strong>Cảnh báo:</strong> Thao tác xóa vĩnh viễn sẽ không thể hoàn tác. Nếu nhân viên nghỉ việc nhưng bạn muốn giữ lại Via, Group và Page cho nhân viên khác làm tiếp, hãy chọn tab{' '}
                  <button
                    type="button"
                    onClick={() => setActionMode('transfer_all')}
                    className="font-extrabold text-indigo-700 underline cursor-pointer"
                  >
                    🔄 Chuyển Full Sang NV Khác
                  </button>
                  .
                </div>
              </div>
            </div>
          ) : null}

          {/* Error display */}
          {errorMessage && (
            <div className="p-2.5 bg-rose-100 border border-rose-300 rounded-xl text-xs font-bold text-rose-800">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            Hủy Bỏ
          </button>

          {actionMode === 'transfer_all' && onConfirmTransferFullStaff ? (
            <button
              type="button"
              disabled={!selectedStaff || !targetStaff || isProcessing}
              onClick={handleExecuteAction}
              className="px-5 py-2 text-xs font-extrabold text-white bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700 rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang Bàn Giao Toàn Bộ...</span>
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>
                    🔄 Chuyển Full ({currentStaffSummary?.viasCount || 0} Via +{' '}
                    {currentStaffSummary?.groupsCount || 0} Group +{' '}
                    {currentStaffSummary?.fanpagesCount || 0} Page) Sang {targetStaff || '...'}
                  </span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled={!selectedStaff || isProcessing}
              onClick={handleExecuteAction}
              className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang Xóa Toàn Bộ Dữ Liệu...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    {selectedStaff
                      ? `Xác Nhận Xóa Vĩnh Viễn: ${selectedStaff}`
                      : 'Chọn Nhân Viên Để Xóa'}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
