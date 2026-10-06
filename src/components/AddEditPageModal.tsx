import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Layers,
  ExternalLink,
  ShieldCheck,
  FileText,
  UserCheck,
  Lock,
  Plus,
  ListPlus,
  Info,
  Key,
  Clock,
} from 'lucide-react';
import {
  PageRecord,
  PageStatus,
  BlockStatus,
  LikeCountStatus,
  PostingMethod,
  InteractionQuality,
  AppUser,
} from '../types';
import {
  PAGE_STATUS_OPTIONS,
  BLOCK_STATUS_OPTIONS,
  LIKE_COUNT_OPTIONS,
  POSTING_METHOD_OPTIONS,
  INTERACTION_OPTIONS,
} from '../utils/helpers';

interface AddEditPageModalProps {
  isOpen: boolean;
  currentUser: AppUser;
  availableStaffNames: string[];
  allRecords: PageRecord[];
  presetViaData?: { viaUid: string; staffName: string } | null;
  onClose: () => void;
  onSave: (record: Omit<PageRecord, 'id'> & { id?: string }) => void;
  onSaveBatch?: (records: Omit<PageRecord, 'id'>[]) => void;
  initialRecord?: PageRecord | null;
}

export const AddEditPageModal: React.FC<AddEditPageModalProps> = ({
  isOpen,
  currentUser,
  availableStaffNames,
  allRecords,
  presetViaData,
  onClose,
  onSave,
  onSaveBatch,
  initialRecord,
}) => {
  const [staffName, setStaffName] = useState('');
  const [viaUid, setViaUid] = useState('');
  const [pageName, setPageName] = useState('');
  const [pageLink, setPageLink] = useState('');
  const [status, setStatus] = useState<PageStatus>('Đề Xuất');
  const [date, setDate] = useState('15/9');
  const [blockStatus, setBlockStatus] = useState<BlockStatus>('Không Chặn');
  const [likeCountStatus, setLikeCountStatus] = useState<LikeCountStatus>('Đếm Like');
  const [postingMethod, setPostingMethod] = useState<PostingMethod>('Đăng Tay');
  const [postingDate, setPostingDate] = useState('');
  const [interaction, setInteraction] = useState<InteractionQuality>('TỐT');
  const [interactionDate, setInteractionDate] = useState('15/9');
  const [bmNote, setBmNote] = useState('');
  const [targetPosts, setTargetPosts] = useState<number>(3);
  const [actualPosts, setActualPosts] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Multi-page batch mode: 1 Via cầm nhiều page
  const [isMultiPageMode, setIsMultiPageMode] = useState<boolean>(false);
  const [batchPageNamesText, setBatchPageNamesText] = useState<string>('');
  const [fullVia, setFullVia] = useState<string>('');

  // Compute existing Vias in the system (filtered by current user if staff)
  const existingVias = useMemo(() => {
    const relevantRecords =
      currentUser.role === 'staff'
        ? allRecords.filter(
            (r) =>
              r.staffName.trim().toLowerCase() ===
              currentUser.name.trim().toLowerCase()
          )
        : allRecords;

    const map = new Map<string, { viaUid: string; staffName: string; pages: string[] }>();
    relevantRecords.forEach((r) => {
      const uid = r.viaUid.trim();
      if (!uid) return;
      if (!map.has(uid)) {
        map.set(uid, { viaUid: uid, staffName: r.staffName, pages: [] });
      }
      map.get(uid)!.pages.push(r.pageName);
    });

    return Array.from(map.values()).sort((a, b) => b.pages.length - a.pages.length);
  }, [allRecords, currentUser]);

  // Current via's existing pages info
  const selectedViaInfo = useMemo(() => {
    const trimmed = viaUid.trim();
    if (!trimmed) return null;
    return existingVias.find((v) => v.viaUid === trimmed) || null;
  }, [viaUid, existingVias]);

  useEffect(() => {
    if (initialRecord) {
      setStaffName(
        initialRecord.staffName ||
          (currentUser.role === 'staff' ? currentUser.name : '')
      );
      setViaUid(initialRecord.viaUid || '');
      setFullVia(initialRecord.fullVia || '');
      setPageName(initialRecord.pageName || '');
      setPageLink(initialRecord.pageLink || '');
      setStatus(initialRecord.status || 'Đề Xuất');
      setDate(initialRecord.date || '15/9');
      setBlockStatus(initialRecord.blockStatus || 'Không Chặn');
      setLikeCountStatus(initialRecord.likeCountStatus || 'Đếm Like');
      setPostingMethod(initialRecord.postingMethod || 'Đăng Tay');
      setPostingDate(
        initialRecord.postingDate ||
          (initialRecord.postingMethod === 'Đăng Tay' ? initialRecord.date || '15/9' : '')
      );
      setInteraction(initialRecord.interaction || 'TỐT');
      setInteractionDate(initialRecord.interactionDate || initialRecord.date || '15/9');
      setBmNote(initialRecord.bmNote || '');
      setTargetPosts(initialRecord.targetPosts ?? 3);
      setActualPosts(initialRecord.actualPosts ?? 0);
      setIsCompleted(initialRecord.isCompleted ?? false);
      setIsMultiPageMode(false);
      setBatchPageNamesText('');
    } else if (presetViaData) {
      setStaffName(
        currentUser.role === 'staff'
          ? currentUser.name
          : presetViaData.staffName || availableStaffNames[0] || 'Anh Quỳnh'
      );
      setViaUid(presetViaData.viaUid);
      const existingViaRec = allRecords.find(
        (r) => r.viaUid.trim() === presetViaData.viaUid.trim() && r.fullVia
      );
      setFullVia(existingViaRec?.fullVia || '');
      setPageName('');
      setPageLink('');
      setStatus('Đề Xuất');
      const now = new Date();
      const todayStr = `${now.getDate()}/${now.getMonth() + 1}`;
      setDate(todayStr);
      setBlockStatus('Không Chặn');
      setLikeCountStatus('Đếm Like');
      setPostingMethod('Đăng Tay');
      setPostingDate(todayStr);
      setInteraction('TỐT');
      setInteractionDate(todayStr);
      setBmNote('');
      setTargetPosts(3);
      setActualPosts(0);
      setIsCompleted(false);
      setIsMultiPageMode(false);
      setBatchPageNamesText('');
    } else {
      setStaffName(
        currentUser.role === 'staff'
          ? currentUser.name
          : availableStaffNames[0] || 'Anh Quỳnh'
      );
      setViaUid('');
      setFullVia('');
      setPageName('');
      setPageLink('');
      setStatus('Đề Xuất');
      const now = new Date();
      const todayStr = `${now.getDate()}/${now.getMonth() + 1}`;
      setDate(todayStr);
      setBlockStatus('Không Chặn');
      setLikeCountStatus('Đếm Like');
      setPostingMethod('Đăng Tay');
      setPostingDate(todayStr);
      setInteraction('TỐT');
      setInteractionDate(todayStr);
      setBmNote('');
      setTargetPosts(3);
      setActualPosts(0);
      setIsCompleted(false);
      setIsMultiPageMode(false);
      setBatchPageNamesText('');
    }
  }, [initialRecord, presetViaData, isOpen, currentUser, availableStaffNames, allRecords]);

  const handleViaUidChange = (value: string) => {
    // If user pastes full via: UID|PASS|2FA into this input
    if (value.includes('|')) {
      const parts = value.split('|');
      setViaUid(parts[0].trim());
      setFullVia(value.trim());
    } else {
      setViaUid(value);
      // If matches existing via, load its fullVia
      const match = allRecords.find((r) => r.viaUid.trim() === value.trim() && r.fullVia);
      if (match && !fullVia) {
        setFullVia(match.fullVia);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const resolvedStaff =
      currentUser.role === 'staff' ? currentUser.name : staffName.trim() || 'Nhân Viên';
    const resolvedVia = viaUid.trim() || '1000...';

    // Batch mode: add multiple pages to this 1 Via
    if (!initialRecord && isMultiPageMode && batchPageNamesText.trim()) {
      const pageNames = batchPageNamesText
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean);

      if (pageNames.length === 0) return;

      const newRecords: Omit<PageRecord, 'id'>[] = pageNames.map((pName) => ({
        staffName: resolvedStaff,
        viaUid: resolvedVia,
        fullVia: fullVia.trim() || undefined,
        pageName: pName,
        pageLink: `https://www.facebook.com/search/top?q=${encodeURIComponent(pName)}`,
        status,
        date: date.trim() || '15/9',
        blockStatus,
        likeCountStatus,
        postingMethod,
        postingDate:
          postingMethod === 'Đăng Tay'
            ? postingDate.trim() || date.trim() || '15/9'
            : undefined,
        interaction,
        interactionDate: interactionDate.trim() || date.trim() || '15/9',
        bmNote: bmNote.trim(),
        targetPosts: Number(targetPosts) || 1,
        actualPosts: Number(actualPosts) || 0,
        isCompleted: isCompleted || Number(actualPosts) >= (Number(targetPosts) || 1),
      }));

      if (onSaveBatch) {
        onSaveBatch(newRecords);
      } else {
        newRecords.forEach((rec) => onSave(rec));
      }

      onClose();
      return;
    }

    // Single record mode
    if (!pageName.trim()) return;

    onSave({
      id: initialRecord?.id,
      staffName: resolvedStaff,
      viaUid: resolvedVia,
      fullVia: fullVia.trim() || undefined,
      pageName: pageName.trim(),
      pageLink:
        pageLink.trim() ||
        `https://www.facebook.com/search/top?q=${encodeURIComponent(pageName.trim())}`,
      status,
      date: date.trim() || '15/9',
      blockStatus,
      likeCountStatus,
      postingMethod,
      postingDate:
        postingMethod === 'Đăng Tay'
          ? postingDate.trim() || date.trim() || '15/9'
          : undefined,
      interaction,
      interactionDate: interactionDate.trim() || date.trim() || '15/9',
      bmNote: bmNote.trim(),
      targetPosts: Number(targetPosts) || 1,
      actualPosts: Number(actualPosts) || 0,
      isCompleted: isCompleted || Number(actualPosts) >= (Number(targetPosts) || 1),
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-[#2e7d32] text-white">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-emerald-200" />
            <div>
              <h3 className="text-base font-bold">
                {initialRecord
                  ? 'Chỉnh Sửa Dòng Fanpage'
                  : presetViaData
                  ? `Thêm Page Vào Via ${presetViaData.viaUid}`
                  : 'Thêm Fanpage Mới Vào Bảng'}
              </h3>
              <p className="text-xs text-emerald-100 mt-0.5">
                {presetViaData
                  ? `Gán thêm Fanpage cho cùng một nick Via (${presetViaData.viaUid})`
                  : 'Quản lý Fanpage & Nick Via cầm page chuẩn mẫu Google Sheet'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-emerald-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs max-h-[85vh] overflow-y-auto">
          {/* Row 1: TÊN NV & Via */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>
                  TÊN NV (Cột B) <span className="text-rose-500">*</span>
                </span>
                {currentUser.role === 'staff' && (
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center space-x-1">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Cố định</span>
                  </span>
                )}
              </label>
              {currentUser.role === 'staff' ? (
                <div className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-800 font-bold flex items-center justify-between">
                  <span>{currentUser.name}</span>
                  <span className="text-[10px] text-slate-500 font-normal">Nhân viên</span>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    required
                    list="staff-list-options"
                    placeholder="Chọn hoặc nhập tên nhân viên..."
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 font-medium"
                  />
                  <datalist id="staff-list-options">
                    {availableStaffNames.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>
                  Via cầm page (Cột C) <span className="text-rose-500">*</span>
                </span>
                {selectedViaInfo && (
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                    Đang cầm {selectedViaInfo.pages.length} page
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  list="existing-via-options"
                  placeholder="VD: 100058675316160..."
                  value={viaUid}
                  onChange={(e) => handleViaUidChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 font-mono text-xs"
                />
                <datalist id="existing-via-options">
                  {existingVias.map((v) => (
                    <option
                      key={v.viaUid}
                      value={v.viaUid}
                      label={`Via ${v.viaUid} (${v.pages.length} page)`}
                    />
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          {/* Quick Via selector chips if there are existing Vias */}
          {existingVias.length > 0 && !initialRecord && (
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="text-[11px] font-bold text-slate-600 block mb-1.5 flex items-center space-x-1">
                <Layers className="w-3 h-3 text-indigo-600" />
                <span>Chọn nhanh Nick Via đang có (để gán thêm page vào Via):</span>
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {existingVias.map((v) => {
                  const isSelected = viaUid.trim() === v.viaUid;
                  return (
                    <button
                      key={v.viaUid}
                      type="button"
                      onClick={() => {
                        setViaUid(v.viaUid);
                        if (currentUser.role === 'admin' && v.staffName) {
                          setStaffName(v.staffName);
                        }
                      }}
                      className={`px-2 py-1 rounded-md text-[11px] font-mono border transition-all flex items-center space-x-1 ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-700 font-bold shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <span>{v.viaUid}</span>
                      <span
                        className={`text-[10px] px-1 rounded-sm ${
                          isSelected
                            ? 'bg-indigo-700 text-indigo-100'
                            : 'bg-slate-100 text-indigo-700 font-sans font-bold'
                        }`}
                      >
                        {v.pages.length} page
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Multi-page banner info if 1 via holds multiple pages */}
          {selectedViaInfo && (
            <div className="bg-indigo-50/80 border border-indigo-200 rounded-lg p-2.5 flex items-start space-x-2 text-indigo-950 text-[11px]">
              <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <strong>1 Via cầm nhiều Page:</strong> Nick Via{' '}
                <span className="font-mono font-bold text-indigo-800">{selectedViaInfo.viaUid}</span> hiện đang cầm{' '}
                <strong>{selectedViaInfo.pages.length} Fanpage</strong>:{' '}
                <span className="text-indigo-800 italic">
                  {selectedViaInfo.pages.slice(0, 3).join(', ')}
                  {selectedViaInfo.pages.length > 3 ? '...' : ''}
                </span>
                . Page mới sẽ được tự động gộp chung vào ô Via này trên bảng tính!
              </div>
            </div>
          )}

          {/* Multi-page batch mode toggle (only when adding new) */}
          {!initialRecord && (
            <div className="flex items-center justify-between bg-emerald-50/60 border border-emerald-200 rounded-lg p-2.5">
              <div className="flex items-center space-x-2">
                <ListPlus className="w-4 h-4 text-emerald-700" />
                <div>
                  <div className="font-bold text-emerald-900 text-xs">
                    Thêm cùng lúc nhiều Page cho Via này
                  </div>
                  <div className="text-[11px] text-emerald-700">
                    Nhập danh sách tên các Page (1 dòng = 1 page) để gán đồng loạt
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                id="toggle-multi-page-mode"
                checked={isMultiPageMode}
                onChange={(e) => setIsMultiPageMode(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
              />
            </div>
          )}

          {/* Single Page Mode inputs */}
          {!isMultiPageMode ? (
            <>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  TÊN PAGE (Cột D) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required={!isMultiPageMode}
                  placeholder="VD: Action Overload Zone"
                  value={pageName}
                  onChange={(e) => setPageName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  LINK PAGE (Cột E)
                </label>
                <input
                  type="url"
                  placeholder="https://www.facebook.com/profile.php?id=..."
                  value={pageLink}
                  onChange={(e) => setPageLink(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600"
                />
              </div>
            </>
          ) : (
            /* Multi-Page Batch Textarea */
            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>
                  Danh sách TÊN PAGE (mỗi dòng 1 page) <span className="text-rose-500">*</span>
                </span>
                <span className="text-[11px] text-emerald-700 font-medium">
                  {batchPageNamesText.split('\n').filter((p) => p.trim()).length} page được nhập
                </span>
              </label>
              <textarea
                required={isMultiPageMode}
                rows={4}
                value={batchPageNamesText}
                onChange={(e) => setBatchPageNamesText(e.target.value)}
                placeholder="VD:&#10;Action Overload Zone&#10;Movie Guild Hub&#10;Cinema Lovers World"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 font-semibold text-xs leading-relaxed"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Tất cả các page trên sẽ được tạo và gán chung vào nick Via{' '}
                <strong className="font-mono text-slate-700">{viaUid || 'đã chọn'}</strong>
              </p>
            </div>
          )}

          {/* Row 3: Trạng Thái, Ngày, CHẶN, ĐẾM LIKE */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Trạng Thái (Cột F)
              </label>
              <select
                value={status}
                onChange={(e) => {
                  const newStatus = e.target.value as PageStatus;
                  setStatus(newStatus);
                  const now = new Date();
                  setDate(`${now.getDate()}/${now.getMonth() + 1}`);
                }}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-bold text-slate-800"
              >
                {PAGE_STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Ngày (Cột G)
              </label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="15/9"
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium text-center"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                CHẶN (Cột H)
              </label>
              <select
                value={blockStatus}
                onChange={(e) => setBlockStatus(e.target.value as BlockStatus)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-bold text-slate-800"
              >
                {BLOCK_STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Đếm Like
              </label>
              <select
                value={likeCountStatus}
                onChange={(e) => setLikeCountStatus(e.target.value as LikeCountStatus)}
                className={`w-full px-2.5 py-2 border rounded-lg font-bold transition-colors ${
                  likeCountStatus === 'Bỏ Đếm Like'
                    ? 'bg-red-600 text-white border-red-700 shadow-2xs'
                    : 'bg-white text-slate-800 border-slate-300'
                }`}
              >
                {LIKE_COUNT_OPTIONS.map((opt) => (
                  <option
                    key={opt}
                    value={opt}
                    className={
                      opt === 'Bỏ Đếm Like'
                        ? 'bg-red-600 text-white font-bold'
                        : 'bg-white text-slate-800 font-bold'
                    }
                  >
                    {opt === 'Đếm Like' ? '👍 Đếm Like (Mặc định)' : '🚫 Bỏ Đếm Like (Màu đỏ)'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: ĐĂNG TAY/TOOL, TƯƠNG TÁC, NGÀY TT, GHI CHÚ BM */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>ĐĂNG TAY, TOOL (Cột I)</span>
                {postingMethod === 'Đăng Tay' && (
                  <span className="text-[10px] text-emerald-700 font-bold">Ngày chọn</span>
                )}
              </label>
              <select
                value={postingMethod}
                onChange={(e) => {
                  const newMethod = e.target.value as PostingMethod;
                  setPostingMethod(newMethod);
                  if (newMethod === 'Đăng Tay' && !postingDate) {
                    const now = new Date();
                    setPostingDate(`${now.getDate()}/${now.getMonth() + 1}`);
                  }
                }}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-medium text-slate-800"
              >
                {POSTING_METHOD_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>

              {postingMethod === 'Đăng Tay' && (
                <div className="mt-1.5 flex items-center space-x-1">
                  <span className="text-xs text-slate-500 font-medium shrink-0">Ngày:</span>
                  <input
                    type="text"
                    value={postingDate}
                    onChange={(e) => setPostingDate(e.target.value)}
                    placeholder="VD: 18/9"
                    className="flex-1 px-2 py-1 border border-emerald-300 rounded text-xs font-bold text-emerald-900 bg-emerald-50/60"
                    title="Ngày chọn Đăng Tay (Tự động lưu ngày hiện tại)"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      setPostingDate(`${now.getDate()}/${now.getMonth() + 1}`);
                    }}
                    className="p-1 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 rounded"
                    title="Lấy ngày hôm nay"
                  >
                    <Clock className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                TƯƠNG TÁC (Cột J)
              </label>
              <select
                value={interaction}
                onChange={(e) => {
                  const newInter = e.target.value as InteractionQuality;
                  setInteraction(newInter);
                  const now = new Date();
                  setInteractionDate(`${now.getDate()}/${now.getMonth() + 1}`);
                }}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-medium text-slate-800"
              >
                {INTERACTION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>NGÀY TT (Cột K)</span>
                <span className="text-[10px] text-emerald-600 font-normal">Tự nhảy</span>
              </label>
              <div className="flex items-center space-x-1">
                <input
                  type="text"
                  value={interactionDate}
                  onChange={(e) => setInteractionDate(e.target.value)}
                  placeholder="16/9"
                  className="w-full px-2 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium text-center"
                  title="Ngày tương tác (Tự động cập nhật theo ngày hiện tại khi chọn trạng thái tương tác)"
                />
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setInteractionDate(`${now.getDate()}/${now.getMonth() + 1}`);
                  }}
                  className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                  title="Đặt ngày hôm nay"
                >
                  <Clock className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                GHI CHÚ BM (Cột L)
              </label>
              <input
                type="text"
                placeholder="VD: B-BM ANH QUYNH"
                value={bmNote}
                onChange={(e) => setBmNote(e.target.value)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
              />
            </div>
          </div>

          {/* Row 5: TIẾN ĐỘ BÀI ĐĂNG */}
          <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-3">
            <span className="font-bold text-emerald-950 block mb-2">
              Tiến Độ Đăng Bài Hôm Nay
            </span>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 mb-1">Chỉ tiêu (bài/ngày)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={targetPosts}
                  onChange={(e) => setTargetPosts(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-bold text-slate-900 text-center"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Đã đăng hôm nay</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={actualPosts}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setActualPosts(val);
                    if (val >= targetPosts) {
                      setIsCompleted(true);
                    }
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-bold text-slate-900 text-center"
                />
              </div>

              <div className="flex items-center pt-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isCompleted}
                    onChange={(e) => setIsCompleted(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="font-bold text-slate-800">Đã xong bài hôm nay</span>
                </label>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#2e7d32] hover:bg-[#256629] text-white rounded-lg font-bold shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>
                {initialRecord
                  ? 'Lưu Thay Đổi'
                  : isMultiPageMode
                  ? `Thêm ${
                      batchPageNamesText.split('\n').filter((p) => p.trim()).length || 0
                    } Page Vào Via`
                  : 'Thêm Fanpage Vào Bảng'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
