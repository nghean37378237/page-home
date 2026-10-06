import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Users,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Tag,
  ShieldCheck,
  Plus,
  Sparkles,
} from 'lucide-react';
import { GroupRecord, AppUser } from '../types';

interface AddEditGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: GroupRecord) => Promise<void>;
  onSaveBatch?: (records: GroupRecord[]) => Promise<void>;
  initialRecord: GroupRecord | null;
  allRecords: GroupRecord[];
  currentUser: AppUser;
  availableStaffNames: string[];
  presetGroup?: {
    groupId: string;
    groupName: string;
    groupLink: string;
    staffName?: string;
  } | null;
}

export const AddEditGroupModal: React.FC<AddEditGroupModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onSaveBatch,
  initialRecord,
  allRecords,
  currentUser,
  availableStaffNames,
  presetGroup,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const isEditing = Boolean(initialRecord);

  // Form states
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [groupName, setGroupName] = useState('');
  const [groupLink, setGroupLink] = useState('');
  const [uid, setUid] = useState('');
  const [viaName, setViaName] = useState('');
  const [note, setNote] = useState('');
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [staffName, setStaffName] = useState('');

  // Batch text area state
  const [batchRawText, setBatchRawText] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Collect unique existing groups for quick selection
  const existingGroups = React.useMemo(() => {
    const map = new Map<string, { groupName: string; groupLink: string; groupId: string }>();
    allRecords.forEach((r) => {
      if (r.groupName && !map.has(r.groupName.trim().toLowerCase())) {
        map.set(r.groupName.trim().toLowerCase(), {
          groupId: r.groupId,
          groupName: r.groupName,
          groupLink: r.groupLink || '',
        });
      }
    });
    return Array.from(map.values());
  }, [allRecords]);

  // Reset or fill form when opening
  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      setBatchRawText('');
      return;
    }

    if (initialRecord) {
      setMode('single');
      setGroupName(initialRecord.groupName || '');
      setGroupLink(initialRecord.groupLink || '');
      setUid(initialRecord.uid || '');
      setViaName(initialRecord.viaName || '');
      setNote(initialRecord.note || '');
      setIsHighlighted(Boolean(initialRecord.isHighlighted));
      setStaffName(initialRecord.staffName || (isAdmin ? 'Anh Quỳnh' : currentUser.name));
    } else if (presetGroup) {
      setMode('single');
      setGroupName(presetGroup.groupName || '');
      setGroupLink(presetGroup.groupLink || '');
      setUid('');
      setViaName('');
      setNote('');
      setIsHighlighted(false);
      setStaffName(presetGroup.staffName || (isAdmin ? 'Anh Quỳnh' : currentUser.name));
    } else {
      setMode('single');
      setGroupName('');
      setGroupLink('');
      setUid('');
      setViaName('');
      setNote('');
      setIsHighlighted(false);
      setStaffName(isAdmin ? (availableStaffNames[0] || 'Anh Quỳnh') : currentUser.name);
    }
    setErrorMessage(null);
  }, [isOpen, initialRecord, presetGroup, isAdmin, currentUser.name, availableStaffNames]);

  if (!isOpen) return null;

  const handleSelectExistingGroup = (selectedGroupName: string) => {
    const found = existingGroups.find((g) => g.groupName === selectedGroupName);
    if (found) {
      setGroupName(found.groupName);
      setGroupLink(found.groupLink);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanGroupName = groupName.trim();
    const cleanGroupLink = groupLink.trim();
    const effectiveStaff = isAdmin ? (staffName.trim() || 'Anh Quỳnh') : currentUser.name;

    if (!cleanGroupName) {
      setErrorMessage('Vui lòng nhập Tên Nhóm Facebook (Cột E).');
      return;
    }

    // Determine groupId (reuse existing if match or generate clean id)
    const matchedExisting = existingGroups.find(
      (g) => g.groupName.toLowerCase() === cleanGroupName.toLowerCase()
    );
    const resolvedGroupId =
      initialRecord?.groupId ||
      presetGroup?.groupId ||
      matchedExisting?.groupId ||
      `group-${Date.now()}`;

    setIsSubmitting(true);
    try {
      if (mode === 'single') {
        const cleanUid = uid.trim();
        const cleanViaName = viaName.trim();

        if (!cleanUid) {
          setErrorMessage('Vui lòng nhập UID nick Facebook (Cột B).');
          setIsSubmitting(false);
          return;
        }

        const recordToSave: GroupRecord = {
          id: initialRecord?.id || `grp-row-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          groupId: resolvedGroupId,
          groupName: cleanGroupName,
          groupLink: cleanGroupLink || (cleanUid ? `https://www.facebook.com/groups/` : ''),
          uid: cleanUid,
          viaName: cleanViaName || `Via ${cleanUid.slice(-4)}`,
          note: note.trim(),
          isHighlighted,
          staffName: effectiveStaff,
          createdAt: initialRecord?.createdAt || new Date().toLocaleDateString('vi-VN'),
          updatedAt: new Date().toLocaleDateString('vi-VN'),
        };

        await onSave(recordToSave);
        onClose();
      } else {
        // Batch mode: parse lines
        if (!onSaveBatch) {
          throw new Error('Tính năng lưu hàng loạt không được hỗ trợ');
        }

        const lines = batchRawText
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);

        if (lines.length === 0) {
          setErrorMessage('Vui lòng nhập ít nhất 1 dòng UID để thêm hàng loạt.');
          setIsSubmitting(false);
          return;
        }

        const batchRecords: GroupRecord[] = [];
        lines.forEach((line, idx) => {
          // Supports formats:
          // 1. UID|Tên Via|Ghi chú
          // 2. UID\tTên Via\tGhi chú (từ Excel copy sang)
          // 3. Chỉ UID
          let lineUid = '';
          let lineViaName = '';
          let lineNote = '';
          let lineHighlighted = false;

          const separator = line.includes('\t') ? '\t' : line.includes('|') ? '|' : null;

          if (separator) {
            const parts = line.split(separator).map((p) => p.trim());
            lineUid = parts[0] || '';
            lineViaName = parts[1] || '';
            lineNote = parts[2] || '';
            if (lineNote.toLowerCase().includes('vhh') || lineNote.toLowerCase().includes('chính')) {
              lineHighlighted = true;
            }
          } else {
            // Just UID or space separated
            const spaceParts = line.split(/\s+/);
            lineUid = spaceParts[0] || '';
            lineViaName = spaceParts.slice(1).join(' ') || '';
          }

          if (lineUid) {
            batchRecords.push({
              id: `grp-row-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
              groupId: resolvedGroupId,
              groupName: cleanGroupName,
              groupLink: cleanGroupLink,
              uid: lineUid,
              viaName: lineViaName || `Via ${lineUid.slice(-4)}`,
              note: lineNote,
              isHighlighted: lineHighlighted,
              staffName: effectiveStaff,
              createdAt: new Date().toLocaleDateString('vi-VN'),
              updatedAt: new Date().toLocaleDateString('vi-VN'),
            });
          }
        });

        if (batchRecords.length === 0) {
          setErrorMessage('Không trích xuất được UID hợp lệ từ nội dung đã nhập.');
          setIsSubmitting(false);
          return;
        }

        await onSaveBatch(batchRecords);
        onClose();
      }
    } catch (err: any) {
      console.error('Lỗi lưu Group Record:', err);
      setErrorMessage(err.message || 'Có lỗi xảy ra khi lưu vào Firestore.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {isEditing ? 'Chỉnh Sửa Dòng Group Facebook' : 'Thêm Dòng Nick Vào Group Facebook'}
              </h2>
              <p className="text-xs text-red-100">
                Quản lý các tài khoản Nick Via cầm nhóm và trạng thái kiểm duyệt
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher (only for adding new) */}
        {!isEditing && (
          <div className="bg-slate-100 px-6 pt-3 flex space-x-2 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors cursor-pointer ${
                mode === 'single'
                  ? 'bg-white text-red-700 border-t-2 border-red-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Thêm 1 Nick Via
            </button>
            <button
              type="button"
              onClick={() => setMode('batch')}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors cursor-pointer flex items-center space-x-1.5 ${
                mode === 'batch'
                  ? 'bg-white text-red-700 border-t-2 border-red-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Thêm Nhiều Via Cùng Lúc</span>
            </button>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Thông tin Group */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <Users className="w-3.5 h-3.5 text-red-600" />
                <span>1. Thông Tin Nhóm Facebook (Group)</span>
              </label>

              {/* Quick Select Existing Group dropdown */}
              {existingGroups.length > 0 && !isEditing && (
                <div className="flex items-center space-x-1 text-[11px] text-slate-500">
                  <span>Chọn nhóm có sẵn:</span>
                  <select
                    className="text-xs bg-white border border-slate-200 rounded-md px-1.5 py-0.5 text-slate-700 focus:outline-hidden"
                    onChange={(e) => handleSelectExistingGroup(e.target.value)}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      -- Chọn nhóm --
                    </option>
                    {existingGroups.map((g) => (
                      <option key={g.groupId} value={g.groupName}>
                        {g.groupName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên Nhóm (Cột E) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Beautifull World ✅, Movies World..."
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-red-700 font-bold placeholder:text-slate-400 placeholder:font-normal"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Link Nhóm (Cột D)
                </label>
                <div className="relative">
                  <input
                    type="url"
                    placeholder="https://www.facebook.com/groups/..."
                    value={groupLink}
                    onChange={(e) => setGroupLink(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-blue-700"
                  />
                  <LinkIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Thông tin Nick Via */}
          {mode === 'single' ? (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-600" />
                <span>2. Thông Tin Nick Facebook Cầm Group</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    UID Nick Facebook (Cột B) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: 100060665184656"
                    value={uid}
                    onChange={(e) => setUid(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-bold text-indigo-700 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên Via (Cột C)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Lucas Santos, Tolga Yagmur..."
                    value={viaName}
                    onChange={(e) => setViaName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 font-semibold"
                  />
                </div>
              </div>

              {/* Ghi chú & Via Chính */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ghi Chú Tình Trạng (Cột F)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: vhh, hạn chế, đình chỉ..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {/* Quick tag suggestions */}
                  <div className="flex items-center space-x-1.5 mt-1.5">
                    {['vhh', 'hạn chế', 'đình chỉ', 'hoạt động'].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setNote(tag)}
                        className="px-2 py-0.5 text-[10px] font-bold bg-white border border-slate-200 text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Đánh Dấu Via Chính / Duyệt Bài
                  </label>
                  <div
                    onClick={() => setIsHighlighted(!isHighlighted)}
                    className={`mt-1 p-2.5 rounded-lg border flex items-center space-x-2.5 cursor-pointer transition-all ${
                      isHighlighted
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isHighlighted}
                      onChange={(e) => setIsHighlighted(e.target.checked)}
                      className="w-4 h-4 rounded-sm text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <div className="text-xs">
                      <span className="font-bold">Bôi xanh lá (Dòng Via chính)</span>
                      <p className="text-[10px] text-slate-500">
                        Đánh dấu nick cầm quyền duyệt bài / quản trị chính
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Batch Input Section */
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>2. Danh Sách Nick Cần Thêm (Hàng Loạt)</span>
              </label>
              <p className="text-[11px] text-slate-500">
                Mỗi dòng 1 nick theo định dạng: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px]">UID | Tên Via | Ghi chú</code> hoặc dán trực tiếp từ file Excel:
              </p>
              <textarea
                rows={5}
                required
                placeholder="100060665184656 | Lucas Santos&#10;100067576758991 | Rupesh Yadav&#10;100023228976334 | Tolga Yagmur | vhh"
                value={batchRawText}
                onChange={(e) => setBatchRawText(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          )}

          {/* Section 3: Phân Quyền Nhân Viên */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Nhân Viên Phụ Trách (Cột Tên NV)</span>
              </span>
              {!isAdmin && (
                <span className="text-[11px] text-emerald-600 font-bold">
                  (Khóa theo tài khoản của bạn)
                </span>
              )}
            </label>

            {isAdmin ? (
              <select
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold text-slate-800"
              >
                {availableStaffNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                disabled
                value={currentUser.name}
                className="w-full px-3 py-2 text-xs bg-slate-200/70 border border-slate-300 rounded-lg text-slate-700 font-bold cursor-not-allowed"
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center space-x-1.5 px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Đang lưu...' : isEditing ? 'Cập Nhật' : 'Lưu Vào Bảng'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
