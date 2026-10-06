import React, { useState, useEffect, useMemo } from 'react';
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

export const GROUP_NOTE_CHOICES = [
  {
    key: 'VHH',
    label: 'VHH',
    fullName: 'Vô Hiệu Hóa',
    color: 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100',
    activeColor: 'bg-rose-600 text-white border-rose-700 shadow-sm ring-2 ring-rose-500/25',
    dot: 'bg-rose-500',
  },
  {
    key: '282',
    label: '282',
    fullName: 'Checkpoint 282',
    color: 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100',
    activeColor: 'bg-amber-600 text-white border-amber-700 shadow-sm ring-2 ring-amber-500/25',
    dot: 'bg-amber-500',
  },
  {
    key: '956',
    label: '956',
    fullName: 'Checkpoint 956 (Két Sắt)',
    color: 'bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-100',
    activeColor: 'bg-purple-600 text-white border-purple-700 shadow-sm ring-2 ring-purple-500/25',
    dot: 'bg-purple-500',
  },
  {
    key: 'Hạn Chế',
    label: 'Hạn Chế',
    fullName: 'Hạn Chế Tính Năng',
    color: 'bg-yellow-50 text-yellow-800 border-yellow-300 hover:bg-yellow-100',
    activeColor: 'bg-yellow-600 text-white border-yellow-700 shadow-sm ring-2 ring-yellow-500/25',
    dot: 'bg-yellow-500',
  },
];

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
    groupId?: string;
    groupName?: string;
    groupLink?: string;
    staffName?: string;
    initialMode?: 'single' | 'batch';
  } | null;
  initialMode?: 'single' | 'batch';
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
  initialMode,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const isEditing = Boolean(initialRecord);

  // Form states
  const [mode, setMode] = useState<'single' | 'batch'>(initialMode || 'single');
  const [groupName, setGroupName] = useState('');
  const [groupLink, setGroupLink] = useState('');
  const [uid, setUid] = useState('');
  const [viaName, setViaName] = useState('');
  const [note, setNote] = useState('');
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [staffName, setStaffName] = useState('');

  // Batch states
  const [batchRawText, setBatchRawText] = useState('');
  const [batchDefaultNote, setBatchDefaultNote] = useState<string>('');
  const [batchDefaultHighlighted, setBatchDefaultHighlighted] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Collect unique existing groups for quick selection
  const existingGroups = useMemo(() => {
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
      setBatchDefaultNote('');
      setBatchDefaultHighlighted(false);
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
      setStaffName(initialRecord.staffName || currentUser.name || 'Anh Quỳnh');
    } else if (presetGroup) {
      setMode(presetGroup.initialMode || initialMode || 'single');
      setGroupName(presetGroup.groupName || '');
      setGroupLink(presetGroup.groupLink || '');
      setUid('');
      setViaName('');
      setNote('');
      setIsHighlighted(false);
      setStaffName(presetGroup.staffName || currentUser.name || 'Anh Quỳnh');
    } else {
      setMode(initialMode || 'single');
      setGroupName('');
      setGroupLink('');
      setUid('');
      setViaName('');
      setNote('');
      setIsHighlighted(false);
      setStaffName(currentUser.name || availableStaffNames[0] || 'Anh Quỳnh');
    }
    setErrorMessage(null);
  }, [isOpen, initialRecord, presetGroup, initialMode, isAdmin, currentUser.name, availableStaffNames]);

  // Live parsed items for batch mode
  const parsedBatchItems = useMemo(() => {
    if (!batchRawText.trim()) return [];
    const lines = batchRawText.split('\n').map((l) => l.trim()).filter(Boolean);
    const items: { uid: string; viaName: string; note: string; isHighlighted: boolean }[] = [];

    lines.forEach((line) => {
      let lineUid = '';
      let lineViaName = '';
      let lineNote = batchDefaultNote;
      let lineHighlighted = batchDefaultHighlighted;

      const separator = line.includes('\t') ? '\t' : line.includes('|') ? '|' : null;

      if (separator) {
        const parts = line.split(separator).map((p) => p.trim());
        lineUid = parts[0] || '';
        lineViaName = parts[1] || '';
        if (parts[2]) {
          lineNote = parts[2];
        }
        if (parts[3]) {
          const hl = parts[3].toLowerCase();
          if (hl.includes('có') || hl.includes('true') || hl.includes('1') || hl.includes('chính')) {
            lineHighlighted = true;
          }
        }
      } else {
        // Space separated or pure UID
        const spaceParts = line.split(/\s+/);
        lineUid = spaceParts[0] || '';
        if (spaceParts.length > 1) {
          lineViaName = spaceParts.slice(1).join(' ');
        }
      }

      // Sanitize uid: remove leading/trailing non-alphanumeric chars
      lineUid = lineUid.replace(/[^\w]/g, '');

      if (lineUid) {
        items.push({
          uid: lineUid,
          viaName: lineViaName || `Via ${lineUid.slice(-4)}`,
          note: lineNote,
          isHighlighted: lineHighlighted,
        });
      }
    });

    return items;
  }, [batchRawText, batchDefaultNote, batchDefaultHighlighted]);

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
        const cleanUid = uid.trim().replace(/[^\w]/g, '');
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
        // Batch mode: add multiple UIDs into this single group
        if (!onSaveBatch) {
          throw new Error('Tính năng lưu hàng loạt không được hỗ trợ');
        }

        if (parsedBatchItems.length === 0) {
          setErrorMessage('Vui lòng nhập ít nhất 1 UID hợp lệ để thêm vào nhóm.');
          setIsSubmitting(false);
          return;
        }

        const batchRecords: GroupRecord[] = parsedBatchItems.map((item, idx) => ({
          id: `grp-row-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
          groupId: resolvedGroupId,
          groupName: cleanGroupName,
          groupLink: cleanGroupLink || `https://www.facebook.com/groups/`,
          uid: item.uid,
          viaName: item.viaName,
          note: item.note,
          isHighlighted: item.isHighlighted,
          staffName: effectiveStaff,
          createdAt: new Date().toLocaleDateString('vi-VN'),
          updatedAt: new Date().toLocaleDateString('vi-VN'),
        }));

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
                {isEditing
                  ? 'Chỉnh Sửa Dòng Group Facebook'
                  : presetGroup
                  ? `Thêm Nick Vào Nhóm: ${presetGroup.groupName}`
                  : 'Quản Lý Thêm Nick Vào Group Facebook'}
              </h2>
              <p className="text-xs text-red-100">
                Thêm 1 nick hoặc nhập hàng loạt danh sách UID vào 1 group tiện lợi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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
              <span>Nhập Hàng Loạt UID Vào 1 Group</span>
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
                    className="text-xs bg-white border border-slate-200 rounded-md px-1.5 py-0.5 text-slate-700 focus:outline-hidden font-bold"
                    onChange={(e) => handleSelectExistingGroup(e.target.value)}
                    value={existingGroups.some((g) => g.groupName === groupName) ? groupName : ''}
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
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-red-700 font-bold placeholder:text-slate-400 placeholder:font-normal bg-white"
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
                    className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-blue-700 bg-white"
                  />
                  <LinkIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Thông tin Nick Via (Single Mode) */}
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
                    className="w-full px-3 py-2 text-xs font-mono font-bold text-indigo-700 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
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
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 font-semibold bg-white"
                  />
                </div>
              </div>

              {/* Ghi chú & Lựa chọn VHH, 282, 956, Hạn Chế */}
              <div className="pt-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ghi Chú Tình Trạng (Cột F)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Nhập ghi chú hoặc bấm chọn nhanh bên dưới..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 font-semibold text-slate-800 bg-white"
                  />
                  {note && (
                    <button
                      type="button"
                      onClick={() => setNote('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                      title="Xóa ghi chú"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* 4 Lựa chọn ghi chú theo yêu cầu: VHH, 282, 956, Hạn Chế */}
                <div className="mt-2">
                  <div className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center justify-between">
                    <span>Chọn nhanh tình trạng:</span>
                    <span className="text-[10px] text-slate-400">(Nhấp để chọn / bỏ chọn)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {GROUP_NOTE_CHOICES.map((choice) => {
                      const isSelected = note.trim() === choice.key;
                      return (
                        <button
                          key={choice.key}
                          type="button"
                          onClick={() => setNote(isSelected ? '' : choice.key)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                            isSelected ? choice.activeColor : choice.color
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isSelected ? 'bg-white' : choice.dot
                            }`}
                          ></span>
                          <span>{choice.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Via Chính (Bôi xanh lá) */}
              <div className="pt-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Đánh Dấu Via Chính / Quản Trị Duyệt Bài
                </label>
                <div
                  onClick={() => setIsHighlighted(!isHighlighted)}
                  className={`p-2.5 rounded-lg border flex items-center space-x-2.5 cursor-pointer transition-all ${
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
                      Đánh dấu nick cầm quyền duyệt bài / quản trị chính của nhóm
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Batch Mode: Nhập hàng loạt UID vào 1 group */
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-red-600" />
                  <span>2. Nhập Hàng Loạt UID Vào Nhóm "{groupName || 'Nhóm này'}"</span>
                </label>
                <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                  Đã nhận diện: <b>{parsedBatchItems.length}</b> UID
                </span>
              </div>

              <p className="text-[11px] text-slate-500">
                Dán danh sách UID vào ô bên dưới (mỗi dòng 1 UID), hoặc định dạng: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px]">UID | Tên Via | Ghi chú</code>:
              </p>

              <textarea
                rows={6}
                required
                placeholder="100060665184656&#10;100067576758991&#10;100023228976334&#10;100091827364512 | Lucas Santos | VHH"
                value={batchRawText}
                onChange={(e) => setBatchRawText(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
              />

              {/* Lựa chọn ghi chú mặc định cho cả danh sách: VHH, 282, 956, Hạn Chế */}
              <div className="pt-1 border-t border-slate-200/80">
                <div className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Ghi chú mặc định áp dụng cho các UID trên (nếu dòng chưa có):</span>
                  {batchDefaultNote && (
                    <button
                      type="button"
                      onClick={() => setBatchDefaultNote('')}
                      className="text-[11px] text-red-600 hover:underline cursor-pointer"
                    >
                      Bỏ chọn (Trống)
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {GROUP_NOTE_CHOICES.map((choice) => {
                    const isSelected = batchDefaultNote === choice.key;
                    return (
                      <button
                        key={choice.key}
                        type="button"
                        onClick={() => setBatchDefaultNote(isSelected ? '' : choice.key)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                          isSelected ? choice.activeColor : choice.color
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isSelected ? 'bg-white' : choice.dot
                          }`}
                        ></span>
                        <span>{choice.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Đánh dấu tất cả via chính */}
              <div
                onClick={() => setBatchDefaultHighlighted(!batchDefaultHighlighted)}
                className={`p-2.5 rounded-lg border flex items-center space-x-2.5 cursor-pointer transition-all ${
                  batchDefaultHighlighted
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-500/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <input
                  type="checkbox"
                  checked={batchDefaultHighlighted}
                  onChange={(e) => setBatchDefaultHighlighted(e.target.checked)}
                  className="w-4 h-4 rounded-sm text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-bold">Bôi xanh lá (Dòng Via chính) cho toàn bộ danh sách</span>
                </div>
              </div>

              {/* Preview Box if UIDs detected */}
              {parsedBatchItems.length > 0 && (
                <div className="p-3 bg-red-50/60 border border-red-200 rounded-lg max-h-36 overflow-y-auto text-[11px]">
                  <div className="font-bold text-red-800 mb-1.5 flex items-center justify-between">
                    <span>
                      Xem trước ({parsedBatchItems.length} UID sẽ được lưu vào nhóm "{groupName || 'Nhóm này'}"):
                    </span>
                  </div>
                  <div className="space-y-1 text-slate-700 font-mono">
                    {parsedBatchItems.slice(0, 6).map((item, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <span className="text-slate-400 w-6">#{idx + 1}</span>
                        <span className="font-bold text-indigo-700">{item.uid}</span>
                        <span className="text-slate-500 text-[10px]">({item.viaName})</span>
                        {item.note && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-white border border-slate-300 text-slate-800">
                            {item.note}
                          </span>
                        )}
                        {item.isHighlighted && (
                          <span className="text-emerald-700 font-bold text-[10px]">★ Via chính</span>
                        )}
                      </div>
                    ))}
                    {parsedBatchItems.length > 6 && (
                      <div className="text-slate-400 italic pt-0.5">
                        ...và {parsedBatchItems.length - 6} UID khác nữa
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 3: Phân Quyền & Chỉnh Sửa Nhân Viên Chăm Group */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>Nhân Viên Chăm Nhóm (Cột Tên NV)</span>
              </label>
              {currentUser.name && (
                <button
                  type="button"
                  onClick={() => setStaffName(currentUser.name)}
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                    staffName.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                  }`}
                >
                  Gán cho tôi ({currentUser.name})
                </button>
              )}
            </div>

            {/* Quick staff chips */}
            <div>
              <div className="text-[11px] font-semibold text-slate-500 mb-1.5">
                Chọn nhanh nhân viên:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(
                  new Set([
                    ...(currentUser.name ? [currentUser.name.trim()] : []),
                    ...availableStaffNames.map((n) => n.trim()),
                    ...allRecords.map((r) => (r.staffName || '').trim()).filter(Boolean),
                  ])
                ).map((name) => {
                  const isSelected = staffName.trim().toLowerCase() === name.toLowerCase();
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setStaffName(name)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center space-x-1 ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-700 shadow-2xs ring-2 ring-blue-500/25'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <span>{name}</span>
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Text Input + Dropdown selector for custom or existing staff */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  list="group-staff-list"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder="Nhập hoặc chọn tên nhân viên..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-bold text-slate-800 bg-white"
                />
                <datalist id="group-staff-list">
                  {Array.from(
                    new Set([
                      ...(currentUser.name ? [currentUser.name.trim()] : []),
                      ...availableStaffNames.map((n) => n.trim()),
                      ...allRecords.map((r) => (r.staffName || '').trim()).filter(Boolean),
                    ])
                  ).map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>

              <select
                value={staffName}
                onChange={(e) => {
                  if (e.target.value) setStaffName(e.target.value);
                }}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-semibold text-slate-700 cursor-pointer"
              >
                <option value="">-- Danh sách tất cả NV --</option>
                {Array.from(
                  new Set([
                    ...(currentUser.name ? [currentUser.name.trim()] : []),
                    ...availableStaffNames.map((n) => n.trim()),
                    ...allRecords.map((r) => (r.staffName || '').trim()).filter(Boolean),
                  ])
                ).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-[11px] text-slate-500">
              {mode === 'batch'
                ? `Mẹo: Tất cả ${parsedBatchItems.length} UID nhập đợt này sẽ được giao cho nhân viên "${staffName || '...'}" chăm sóc.`
                : `Nhân viên "${staffName || '...'}" sẽ phụ trách chăm sóc dòng nick UID này.`}
            </p>
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
              <span>
                {isSubmitting
                  ? 'Đang lưu...'
                  : isEditing
                  ? 'Cập Nhật'
                  : mode === 'batch'
                  ? `Lưu ${parsedBatchItems.length} UID Vào Nhóm`
                  : 'Lưu Vào Nhóm'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
