import React, { useState, useMemo, useEffect } from 'react';
import {
  Trash2,
  AlertTriangle,
  Users,
  FileSpreadsheet,
  KeyRound,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  X,
  Search,
  Check,
} from 'lucide-react';
import { PageRecord, FullViaItem, UserAccount } from '../types';

interface DeleteStaffDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  presetStaffName?: string;
  allStaffNames: string[];
  records: PageRecord[];
  viaList: FullViaItem[];
  accounts: UserAccount[];
  onConfirmDelete: (
    staffName: string,
    options: {
      deleteFanpages: boolean;
      deleteVias: boolean;
      deleteAccount: boolean;
    }
  ) => Promise<void>;
}

export const DeleteStaffDataModal: React.FC<DeleteStaffDataModalProps> = ({
  isOpen,
  onClose,
  presetStaffName = '',
  allStaffNames,
  records,
  viaList,
  accounts,
  onConfirmDelete,
}) => {
  const [selectedStaff, setSelectedStaff] = useState<string>(presetStaffName);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteFanpages, setDeleteFanpages] = useState(true);
  const [deleteVias, setDeleteVias] = useState(true);
  const [deleteAccount, setDeleteAccount] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmationInput, setConfirmationInput] = useState('');

  // Sync presetStaffName when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedStaff(presetStaffName || (allStaffNames.length > 0 ? allStaffNames[0] : ''));
      setConfirmationInput('');
      setErrorMessage(null);
      setDeleteFanpages(true);
      setDeleteVias(true);
      setDeleteAccount(true);
    }
  }, [isOpen, presetStaffName, allStaffNames]);

  // Distinct staff list with counts
  const staffSummaries = useMemo(() => {
    return allStaffNames.map((name) => {
      const nameLower = name.trim().toLowerCase();
      const staffRecords = records.filter(
        (r) => r.staffName?.trim().toLowerCase() === nameLower
      );
      const staffVias = viaList.filter(
        (v) => v.staffName?.trim().toLowerCase() === nameLower
      );
      const matchedAccount = accounts.find(
        (a) => a.username?.trim().toLowerCase() === nameLower
      );

      return {
        name,
        fanpagesCount: staffRecords.length,
        viasCount: staffVias.length,
        hasAccount: Boolean(matchedAccount),
        accountStatus: matchedAccount?.status,
        accountRole: matchedAccount?.role,
      };
    });
  }, [allStaffNames, records, viaList, accounts]);

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

  // Specific list of records & vias of the selected staff to preview
  const staffPagesPreview = useMemo(() => {
    if (!selectedStaff) return [];
    const nameLower = selectedStaff.trim().toLowerCase();
    return records.filter((r) => r.staffName?.trim().toLowerCase() === nameLower);
  }, [records, selectedStaff]);

  const staffViasPreview = useMemo(() => {
    if (!selectedStaff) return [];
    const nameLower = selectedStaff.trim().toLowerCase();
    return viaList.filter((v) => v.staffName?.trim().toLowerCase() === nameLower);
  }, [viaList, selectedStaff]);

  if (!isOpen) return null;

  const handleExecuteDelete = async () => {
    if (!selectedStaff.trim()) {
      setErrorMessage('Vui lòng chọn nhân viên cần xóa dữ liệu.');
      return;
    }

    if (!deleteFanpages && !deleteVias && !deleteAccount) {
      setErrorMessage('Vui lòng chọn ít nhất một mục cần xóa.');
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await onConfirmDelete(selectedStaff.trim(), {
        deleteFanpages,
        deleteVias,
        deleteAccount,
      });
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi xóa toàn bộ dữ liệu nhân viên:', err);
      setErrorMessage(err.message || 'Đã xảy ra lỗi khi xóa dữ liệu trên hệ thống.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-fadeIn my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Xóa Toàn Bộ Dữ Liệu Nhân Viên
              </h3>
              <p className="text-xs text-slate-500">
                Chọn bất kỳ nhân viên nào để xóa sạch Fanpage, Nick Via và Tài khoản
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
          {/* Step 1: Employee Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              1. Chọn Nhân Viên Cần Xóa Dữ Liệu
            </label>
            <div className="space-y-2">
              <div className="relative">
                <select
                  value={selectedStaff}
                  onChange={(e) => {
                    setSelectedStaff(e.target.value);
                    setErrorMessage(null);
                  }}
                  className="w-full pl-3 pr-8 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500/30 focus:border-rose-600 cursor-pointer"
                >
                  <option value="">-- Chọn 1 nhân viên bất kỳ --</option>
                  {filteredStaffList.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name} ({s.fanpagesCount} Page, {s.viasCount} Via{s.hasAccount ? ', Có tài khoản' : ''})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick search filter if many staff */}
              {allStaffNames.length > 5 && (
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
                      {currentStaffSummary?.hasAccount ? 'Tài khoản nhân viên hệ thống' : 'Nhân viên chưa tạo tài khoản'}
                    </span>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                  Chuẩn bị xóa
                </span>
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-center text-emerald-700 mb-1">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div className="text-base font-extrabold text-slate-900">
                    {currentStaffSummary?.fanpagesCount || 0}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500">Fanpage</div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-center text-indigo-700 mb-1">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div className="text-base font-extrabold text-slate-900">
                    {currentStaffSummary?.viasCount || 0}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500">Nick Via FB</div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-center text-blue-700 mb-1">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="text-base font-extrabold text-slate-900">
                    {currentStaffSummary?.hasAccount ? '1' : '0'}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500">Tài khoản PIN</div>
                </div>
              </div>

              {/* Preview preview chips */}
              {staffPagesPreview.length > 0 && (
                <div className="text-xs">
                  <span className="text-[11px] font-bold text-slate-600 block mb-1">
                    Danh sách Page của nhân viên này (sẽ bị xóa):
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                    {staffPagesPreview.slice(0, 12).map((p) => (
                      <span
                        key={p.id}
                        className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-700 font-medium truncate max-w-[130px]"
                        title={p.pageName}
                      >
                        {p.pageName}
                      </span>
                    ))}
                    {staffPagesPreview.length > 12 && (
                      <span className="px-1.5 py-0.5 bg-slate-200 rounded text-[10px] text-slate-600 font-bold">
                        +{staffPagesPreview.length - 12} page khác
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
              Vui lòng chọn 1 nhân viên từ danh sách phía trên để xem trước dữ liệu
            </div>
          )}

          {/* Step 3: Deletion Options */}
          {selectedStaff && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                2. Tùy Chọn Dữ Liệu Sẽ Xóa (Mặc định xóa toàn bộ)
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
            </div>
          )}

          {/* Warning notice */}
          {selectedStaff && (
            <div className="flex items-start space-x-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed text-[11px]">
                <strong>Cảnh báo:</strong> Thao tác xóa sẽ được thực hiện trực tiếp trên cơ sở dữ liệu Cloud Firestore theo thời gian thực và <strong>không thể hoàn tác</strong>. Vui lòng kiểm tra kỹ trước khi xác nhận.
              </div>
            </div>
          )}

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
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            Hủy Bỏ
          </button>

          <button
            type="button"
            disabled={!selectedStaff || isDeleting}
            onClick={handleExecuteDelete}
            className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Đang Xóa Toàn Bộ Dữ Liệu...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {selectedStaff
                    ? `Xác Nhận Xóa Dữ Liệu: ${selectedStaff}`
                    : 'Chọn Nhân Viên Để Xóa'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
