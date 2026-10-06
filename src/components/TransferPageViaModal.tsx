import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowRightLeft,
  X,
  FileSpreadsheet,
  Layers,
  Search,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  ExternalLink,
  UserCheck,
  RefreshCw,
  Check,
  Plus,
  Info,
  Calendar,
  ShieldAlert,
} from 'lucide-react';
import { PageRecord, FullViaItem, AppUser } from '../types';

export interface TransferPageViaParams {
  pageIds: string[];
  targetViaUid: string;
  targetStaffName: string;
  targetFullVia?: string;
  appendHistoryNote: boolean;
  historyNoteText: string;
}

interface TransferPageViaModalProps {
  isOpen: boolean;
  onClose: () => void;
  presetRecord?: PageRecord | null;
  presetViaUid?: string | null;
  records: PageRecord[];
  viaList: FullViaItem[];
  allStaffNames: string[];
  currentUser: AppUser;
  onConfirmTransfer: (params: TransferPageViaParams) => Promise<void>;
}

export const TransferPageViaModal: React.FC<TransferPageViaModalProps> = ({
  isOpen,
  onClose,
  presetRecord,
  presetViaUid,
  records,
  viaList,
  allStaffNames,
  currentUser,
  onConfirmTransfer,
}) => {
  // Transfer Mode: 'single' (1 page) or 'batch' (nhiều page từ 1 via)
  const [transferMode, setTransferMode] = useState<'single' | 'batch'>('single');

  // Selected single page ID
  const [selectedPageId, setSelectedPageId] = useState<string>('');

  // Selected batch page IDs
  const [selectedBatchPageIds, setSelectedBatchPageIds] = useState<string[]>([]);

  // Source Via filter or selection
  const [sourceViaFilter, setSourceViaFilter] = useState<string>('');

  // Search query for page selection
  const [pageSearchQuery, setPageSearchQuery] = useState<string>('');

  // Target Via selection mode: 'existing' | 'new'
  const [targetViaMode, setTargetViaMode] = useState<'existing' | 'new'>('existing');
  const [selectedTargetViaUid, setSelectedTargetViaUid] = useState<string>('');
  const [customTargetViaUid, setCustomTargetViaUid] = useState<string>('');
  const [targetViaSearchQuery, setTargetViaSearchQuery] = useState<string>('');

  // Target Staff option
  const [staffAssignmentMode, setStaffAssignmentMode] = useState<'target_via_owner' | 'keep_current' | 'custom'>('target_via_owner');
  const [customStaffName, setCustomStaffName] = useState<string>('');

  // Note option
  const [appendHistoryNote, setAppendHistoryNote] = useState<boolean>(true);
  const [historyNoteText, setHistoryNoteText] = useState<string>('');

  // Processing state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Available pages based on user permissions
  const accessibleRecords = useMemo(() => {
    if (currentUser.role === 'admin') {
      return records;
    }
    const userLower = currentUser.name.trim().toLowerCase();
    return records.filter((r) => r.staffName?.trim().toLowerCase() === userLower);
  }, [records, currentUser]);

  // Aggregate all known Vias in system (combining viaList and records)
  const knownVias = useMemo(() => {
    const map = new Map<
      string,
      {
        uid: string;
        staffName: string;
        pageCount: number;
        pages: PageRecord[];
        fullViaItem?: FullViaItem;
        isError: boolean;
      }
    >();

    // Seed from viaList
    viaList.forEach((v) => {
      const uid = v.uid.trim();
      if (!uid) return;
      if (!map.has(uid)) {
        map.set(uid, {
          uid,
          staffName: v.staffName || '',
          pageCount: 0,
          pages: [],
          fullViaItem: v,
          isError: Boolean(v.isError || v.status === 'checkpoint' || v.status === 'dead' || v.status === 'error'),
        });
      }
    });

    // Add / enrich from records
    records.forEach((r) => {
      const uid = r.viaUid?.trim();
      if (!uid) return;
      if (!map.has(uid)) {
        map.set(uid, {
          uid,
          staffName: r.staffName || '',
          pageCount: 0,
          pages: [],
          isError: Boolean(r.isViaError || r.viaStatus === 'checkpoint' || r.viaStatus === 'dead' || r.viaStatus === 'error'),
        });
      }
      const item = map.get(uid)!;
      item.pageCount += 1;
      item.pages.push(r);
      if (!item.staffName && r.staffName) {
        item.staffName = r.staffName;
      }
      if (r.isViaError || r.viaStatus === 'checkpoint' || r.viaStatus === 'dead' || r.viaStatus === 'error') {
        item.isError = true;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.pageCount - a.pageCount);
  }, [viaList, records]);

  // Filtered target vias
  const filteredTargetVias = useMemo(() => {
    const q = targetViaSearchQuery.trim().toLowerCase();
    if (!q) return knownVias;
    return knownVias.filter(
      (v) =>
        v.uid.toLowerCase().includes(q) ||
        v.staffName.toLowerCase().includes(q) ||
        (v.fullViaItem?.note && v.fullViaItem.note.toLowerCase().includes(q))
    );
  }, [knownVias, targetViaSearchQuery]);

  // Initialize or reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
      setErrorMessage(null);
      setTargetViaSearchQuery('');
      setPageSearchQuery('');
      setCustomTargetViaUid('');

      const todayStr = `${new Date().getDate()}/${new Date().getMonth() + 1}`;

      if (presetRecord) {
        setSelectedPageId(presetRecord.id);
        setSelectedBatchPageIds([presetRecord.id]);
        setSourceViaFilter(presetRecord.viaUid || '');
        setTransferMode('single');
        setHistoryNoteText(`Chuyển từ Via ${presetRecord.viaUid || 'cũ'} ngày ${todayStr}`);
      } else if (presetViaUid) {
        const pagesOfVia = accessibleRecords.filter(
          (r) => r.viaUid.trim().toLowerCase() === presetViaUid.trim().toLowerCase()
        );
        if (pagesOfVia.length > 0) {
          setSelectedPageId(pagesOfVia[0].id);
          setSelectedBatchPageIds(pagesOfVia.map((p) => p.id));
          setSourceViaFilter(presetViaUid);
          setTransferMode(pagesOfVia.length > 1 ? 'batch' : 'single');
          setHistoryNoteText(`Chuyển từ Via ${presetViaUid} ngày ${todayStr}`);
        } else if (accessibleRecords.length > 0) {
          setSelectedPageId(accessibleRecords[0].id);
          setSelectedBatchPageIds([accessibleRecords[0].id]);
          setSourceViaFilter(accessibleRecords[0].viaUid || '');
          setTransferMode('single');
          setHistoryNoteText(`Chuyển từ Via ${accessibleRecords[0].viaUid || 'cũ'} ngày ${todayStr}`);
        }
      } else if (accessibleRecords.length > 0) {
        setSelectedPageId(accessibleRecords[0].id);
        setSelectedBatchPageIds([accessibleRecords[0].id]);
        setSourceViaFilter(accessibleRecords[0].viaUid || '');
        setTransferMode('single');
        setHistoryNoteText(`Chuyển từ Via ${accessibleRecords[0].viaUid || 'cũ'} ngày ${todayStr}`);
      }

      // Default target Via (first known via that is different from source)
      const firstTarget = knownVias.find(
        (v) => v.uid !== (presetRecord?.viaUid || presetViaUid)
      );
      if (firstTarget) {
        setSelectedTargetViaUid(firstTarget.uid);
      } else {
        setSelectedTargetViaUid('');
      }

      setStaffAssignmentMode('target_via_owner');
      setAppendHistoryNote(true);
    }
  }, [isOpen, presetRecord, presetViaUid, accessibleRecords, knownVias]);

  // The active single page being transferred
  const currentSinglePage = useMemo(() => {
    return accessibleRecords.find((r) => r.id === selectedPageId) || null;
  }, [accessibleRecords, selectedPageId]);

  // When selected single page changes, update default history note if not manually modified
  useEffect(() => {
    if (currentSinglePage) {
      const todayStr = `${new Date().getDate()}/${new Date().getMonth() + 1}`;
      setHistoryNoteText(
        `Chuyển từ Via ${currentSinglePage.viaUid || 'cũ'} sang Via mới (${todayStr})`
      );
    }
  }, [currentSinglePage]);

  // The active pages to transfer (single or batch)
  const pagesToTransfer = useMemo(() => {
    if (transferMode === 'single') {
      return currentSinglePage ? [currentSinglePage] : [];
    }
    return accessibleRecords.filter((r) => selectedBatchPageIds.includes(r.id));
  }, [transferMode, currentSinglePage, accessibleRecords, selectedBatchPageIds]);

  // Target Via UID computed
  const resolvedTargetViaUid = useMemo(() => {
    if (targetViaMode === 'new') {
      return customTargetViaUid.trim();
    }
    return selectedTargetViaUid.trim();
  }, [targetViaMode, customTargetViaUid, selectedTargetViaUid]);

  // Target Via Info
  const resolvedTargetViaInfo = useMemo(() => {
    if (!resolvedTargetViaUid) return null;
    return (
      knownVias.find(
        (v) => v.uid.trim().toLowerCase() === resolvedTargetViaUid.toLowerCase()
      ) || null
    );
  }, [resolvedTargetViaUid, knownVias]);

  // Target Staff Name computed
  const resolvedTargetStaffName = useMemo(() => {
    if (staffAssignmentMode === 'custom') {
      return customStaffName.trim() || currentUser.name;
    }
    if (staffAssignmentMode === 'keep_current') {
      return pagesToTransfer[0]?.staffName || currentUser.name;
    }
    // target_via_owner
    if (resolvedTargetViaInfo?.staffName) {
      return resolvedTargetViaInfo.staffName;
    }
    return pagesToTransfer[0]?.staffName || currentUser.name;
  }, [staffAssignmentMode, customStaffName, currentUser, pagesToTransfer, resolvedTargetViaInfo]);

  // Target Full Via if available
  const resolvedTargetFullVia = useMemo(() => {
    if (!resolvedTargetViaInfo) return undefined;
    if (resolvedTargetViaInfo.fullViaItem?.rawFullVia) {
      return resolvedTargetViaInfo.fullViaItem.rawFullVia;
    }
    if (resolvedTargetViaInfo.fullViaItem) {
      const { uid, pass, twoFa } = resolvedTargetViaInfo.fullViaItem;
      if (pass || twoFa) return `${uid}|${pass || ''}|${twoFa || ''}`;
    }
    return undefined;
  }, [resolvedTargetViaInfo]);

  // Filtered page list for selection dropdown / search
  const selectablePages = useMemo(() => {
    let list = accessibleRecords;
    if (sourceViaFilter) {
      list = list.filter((r) => r.viaUid.trim().toLowerCase() === sourceViaFilter.trim().toLowerCase());
    }
    const q = pageSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.pageName.toLowerCase().includes(q) ||
          r.viaUid.toLowerCase().includes(q) ||
          r.staffName.toLowerCase().includes(q) ||
          (r.pageLink && r.pageLink.toLowerCase().includes(q))
      );
    }
    return list;
  }, [accessibleRecords, sourceViaFilter, pageSearchQuery]);

  if (!isOpen) return null;

  // Handle batch selection toggle
  const toggleBatchPage = (id: string) => {
    setSelectedBatchPageIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const selectAllPagesFromSource = () => {
    setSelectedBatchPageIds(selectablePages.map((p) => p.id));
  };

  const deselectAllPages = () => {
    setSelectedBatchPageIds([]);
  };

  const handleExecuteTransfer = async () => {
    if (pagesToTransfer.length === 0) {
      setErrorMessage('Vui lòng chọn ít nhất 1 Fanpage để chuyển.');
      return;
    }

    if (!resolvedTargetViaUid) {
      setErrorMessage('Vui lòng chọn hoặc nhập UID của Nick Via đích.');
      return;
    }

    // Check if transferring to same Via
    const sameVia = pagesToTransfer.every(
      (p) => p.viaUid.trim().toLowerCase() === resolvedTargetViaUid.toLowerCase()
    );
    if (sameVia && staffAssignmentMode === 'keep_current') {
      setErrorMessage(
        `Fanpage hiện tại đã ở trên Via "${resolvedTargetViaUid}". Vui lòng chọn một Via khác để chuyển.`
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onConfirmTransfer({
        pageIds: pagesToTransfer.map((p) => p.id),
        targetViaUid: resolvedTargetViaUid,
        targetStaffName: resolvedTargetStaffName,
        targetFullVia: resolvedTargetFullVia,
        appendHistoryNote,
        historyNoteText: historyNoteText.trim(),
      });
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi chuyển page sang Via khác:', err);
      setErrorMessage(err.message || 'Đã xảy ra lỗi trong quá trình chuyển Fanpage.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-fadeIn my-auto max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 shadow-2xs">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <span>Chuyển Fanpage Qua Via Khác</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Bảo toàn dữ liệu
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Chuyển Page sang Nick Via mới kèm toàn bộ thông tin bài đăng, liên kết và tiến độ
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
          {/* Mode Switch: Chuyển 1 Page vs Chuyển Nhiều Page */}
          <div className="flex items-center justify-between bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setTransferMode('single')}
              className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                transferMode === 'single'
                  ? 'bg-white text-indigo-700 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Chuyển 1 Fanpage cụ thể
            </button>
            <button
              type="button"
              onClick={() => setTransferMode('batch')}
              className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                transferMode === 'batch'
                  ? 'bg-white text-indigo-700 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Chuyển nhiều Page cùng lúc ({pagesToTransfer.length} Page chọn)
            </button>
          </div>

          {/* STEP 1: CHỌN FANPAGE CẦN CHUYỂN */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] flex items-center justify-center font-bold">
                  1
                </span>
                <span>Chọn Fanpage Cần Chuyển</span>
              </label>

              {transferMode === 'batch' && (
                <div className="flex items-center space-x-2 text-[11px]">
                  <button
                    type="button"
                    onClick={selectAllPagesFromSource}
                    className="text-indigo-600 hover:underline font-semibold cursor-pointer"
                  >
                    Chọn tất cả ({selectablePages.length})
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={deselectAllPages}
                    className="text-slate-500 hover:underline cursor-pointer"
                  >
                    Bỏ chọn
                  </button>
                </div>
              )}
            </div>

            {transferMode === 'single' ? (
              /* Single Page Selector */
              <div className="space-y-2">
                <div className="relative">
                  <select
                    value={selectedPageId}
                    onChange={(e) => setSelectedPageId(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
                  >
                    {accessibleRecords.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.pageName} (Via: {r.viaUid} | NV: {r.staffName} | {r.status})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Card hiển thị toàn bộ thông tin hiện tại của Page */}
                {currentSinglePage && (
                  <div className="bg-slate-50/90 rounded-xl p-3 border border-slate-200 text-xs space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div className="flex items-center space-x-2">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span className="font-extrabold text-slate-900 text-sm">
                          {currentSinglePage.pageName}
                        </span>
                      </div>
                      {currentSinglePage.pageLink && (
                        <a
                          href={currentSinglePage.pageLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center space-x-1 text-[11px] text-blue-600 hover:underline font-semibold"
                        >
                          <span>Mở Page</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {/* Thuộc tính của Page sẽ được chuyển nguyên vẹn */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                      <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">
                          Via Hiện Tại (C)
                        </span>
                        <span className="font-mono font-bold text-indigo-900 truncate block">
                          {currentSinglePage.viaUid}
                        </span>
                      </div>

                      <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">
                          Nhân Viên (B)
                        </span>
                        <span className="font-bold text-slate-800 truncate block">
                          {currentSinglePage.staffName}
                        </span>
                      </div>

                      <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">
                          Trạng Thái (F)
                        </span>
                        <span className="font-bold text-emerald-700 truncate block">
                          {currentSinglePage.status}
                        </span>
                      </div>

                      <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">
                          Tiến Độ Bài (K)
                        </span>
                        <span className="font-bold text-slate-800 truncate block">
                          {currentSinglePage.actualPosts}/{currentSinglePage.targetPosts} bài
                        </span>
                      </div>
                    </div>

                    {/* Chi tiết phụ: Chặn, Cách đăng, Tương tác, Ghi chú BM */}
                    <div className="flex flex-wrap gap-1.5 pt-1 text-[11px]">
                      <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-medium">
                        Chặn: <strong className="text-slate-800">{currentSinglePage.blockStatus}</strong>
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-medium">
                        Cách đăng: <strong className="text-slate-800">{currentSinglePage.postingMethod}</strong>
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-medium">
                        Tương tác: <strong className="text-slate-800">{currentSinglePage.interaction}</strong>
                      </span>
                      {currentSinglePage.bmNote && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 font-medium truncate max-w-full">
                          BM: <strong>{currentSinglePage.bmNote}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Batch Pages Selector */
              <div className="space-y-2">
                {/* Search filter for pages */}
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={pageSearchQuery}
                      onChange={(e) => setPageSearchQuery(e.target.value)}
                      placeholder="Tìm kiếm theo tên Page hoặc UID Via..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                  {sourceViaFilter && (
                    <button
                      type="button"
                      onClick={() => setSourceViaFilter('')}
                      className="text-[11px] text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded-lg shrink-0 cursor-pointer"
                    >
                      Bỏ lọc Via nguồn ({sourceViaFilter})
                    </button>
                  )}
                </div>

                {/* Page checkbox list */}
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                  {selectablePages.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Không tìm thấy Fanpage nào phù hợp
                    </div>
                  ) : (
                    selectablePages.map((page) => {
                      const isChecked = selectedBatchPageIds.includes(page.id);
                      return (
                        <label
                          key={page.id}
                          className={`flex items-center justify-between p-2.5 hover:bg-slate-50 cursor-pointer transition-colors ${
                            isChecked ? 'bg-indigo-50/60' : ''
                          }`}
                        >
                          <div className="flex items-center space-x-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleBatchPage(page.id)}
                              className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <div>
                              <div className="font-bold text-xs text-slate-900">
                                {page.pageName}
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center space-x-2">
                                <span>Via: <strong className="font-mono text-slate-700">{page.viaUid}</strong></span>
                                <span>•</span>
                                <span>NV: {page.staffName}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1 text-[10px]">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                              {page.status}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                              {page.actualPosts}/{page.targetPosts} bài
                            </span>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: CHỌN NICK VIA ĐÍCH (NHẬN PAGE) */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] flex items-center justify-center font-bold">
                2
              </span>
              <span>Chọn Nick Via Đích (Nhận Page)</span>
            </label>

            {/* Switch: Chọn Via có sẵn vs Nhập UID mới */}
            <div className="flex items-center space-x-2 text-xs">
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="targetViaMode"
                  checked={targetViaMode === 'existing'}
                  onChange={() => setTargetViaMode('existing')}
                  className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="font-bold text-slate-800">
                  Chọn từ danh sách Via có sẵn ({knownVias.length} Via)
                </span>
              </label>

              <label className="flex items-center space-x-1.5 cursor-pointer ml-3">
                <input
                  type="radio"
                  name="targetViaMode"
                  checked={targetViaMode === 'new'}
                  onChange={() => setTargetViaMode('new')}
                  className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="font-bold text-slate-800">Nhập UID Via Mới</span>
              </label>
            </div>

            {targetViaMode === 'existing' ? (
              <div className="space-y-2">
                {/* Search via */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={targetViaSearchQuery}
                    onChange={(e) => setTargetViaSearchQuery(e.target.value)}
                    placeholder="Tìm theo UID Via, tên nhân viên phụ trách, ghi chú nick..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                {/* Dropdown / list of target vias */}
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                  {filteredTargetVias.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400">
                      Không tìm thấy Nick Via nào
                    </div>
                  ) : (
                    filteredTargetVias.map((v) => {
                      const isSelected = selectedTargetViaUid === v.uid;
                      return (
                        <div
                          key={v.uid}
                          onClick={() => setSelectedTargetViaUid(v.uid)}
                          className={`flex items-center justify-between p-2.5 hover:bg-slate-50 cursor-pointer transition-colors text-xs ${
                            isSelected ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : ''
                          }`}
                        >
                          <div className="flex items-center space-x-2.5">
                            <div
                              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border ${
                                isSelected
                                  ? 'border-indigo-600 bg-indigo-600 text-white'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5" />}
                            </div>

                            <div>
                              <div className="font-mono font-bold text-slate-900 flex items-center space-x-1.5">
                                <span>{v.uid}</span>
                                {v.isError && (
                                  <span className="px-1.5 py-0.2 bg-rose-100 text-rose-700 rounded text-[9px] font-bold">
                                    Lỗi / Checkpoint
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center space-x-2">
                                <span>Chủ sở hữu: <strong>{v.staffName || 'Chưa gán'}</strong></span>
                                {v.fullViaItem?.note && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate max-w-[140px] text-slate-400">
                                      {v.fullViaItem.note}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              Đang cầm {v.pageCount} Page
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* Custom new via UID input */
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={customTargetViaUid}
                  onChange={(e) => setCustomTargetViaUid(e.target.value)}
                  placeholder="Nhập UID Nick Via mới (VD: 100089283748291)..."
                  className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
                <p className="text-[11px] text-slate-500">
                  Nick Via mới sẽ được tạo trong hệ thống và nhận quyền quản lý Fanpage này.
                </p>
              </div>
            )}
          </div>

          {/* STEP 3: PHÂN BỔ NHÂN SỰ & GHI CHÚ BM */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] flex items-center justify-center font-bold">
                3
              </span>
              <span>Phân Công Nhân Viên & Ghi Chú Lịch Sử Chuyển</span>
            </label>

            {/* Phân công nhân viên */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 text-xs">
              <span className="font-bold text-slate-700 block text-[11px] uppercase">
                Nhân viên phụ trách sau khi chuyển:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="flex items-start space-x-2 bg-white p-2 rounded-lg border border-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="staffAssignmentMode"
                    checked={staffAssignmentMode === 'target_via_owner'}
                    onChange={() => setStaffAssignmentMode('target_via_owner')}
                    className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block text-[11px]">
                      Theo chủ Via đích
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate">
                      {resolvedTargetViaInfo?.staffName || '(Chưa có chủ)'}
                    </span>
                  </div>
                </label>

                <label className="flex items-start space-x-2 bg-white p-2 rounded-lg border border-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="staffAssignmentMode"
                    checked={staffAssignmentMode === 'keep_current'}
                    onChange={() => setStaffAssignmentMode('keep_current')}
                    className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block text-[11px]">
                      Giữ nhân viên cũ
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate">
                      {pagesToTransfer[0]?.staffName || currentUser.name}
                    </span>
                  </div>
                </label>

                <label className="flex items-start space-x-2 bg-white p-2 rounded-lg border border-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="staffAssignmentMode"
                    checked={staffAssignmentMode === 'custom'}
                    onChange={() => setStaffAssignmentMode('custom')}
                    className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block text-[11px]">
                      Chỉ định người khác
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Chọn tùy ý
                    </span>
                  </div>
                </label>
              </div>

              {staffAssignmentMode === 'custom' && (
                <div className="pt-1">
                  <select
                    value={customStaffName}
                    onChange={(e) => setCustomStaffName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                  >
                    <option value="">-- Chọn nhân viên mới --</option>
                    {allStaffNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Tùy chọn tự động thêm ghi chú BM để theo dõi lịch sử luân chuyển */}
            <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 text-xs space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={appendHistoryNote}
                  onChange={(e) => setAppendHistoryNote(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="font-bold text-indigo-950">
                  Thêm ghi chú lịch sử chuyển vào Cột K (Ghi Chú BM)
                </span>
              </label>

              {appendHistoryNote && (
                <input
                  type="text"
                  value={historyNoteText}
                  onChange={(e) => setHistoryNoteText(e.target.value)}
                  placeholder="Nội dung ghi chú chuyển..."
                  className="w-full px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500"
                />
              )}
            </div>
          </div>

          {/* STEP 4: TỔNG KẾT SO SÁNH TRƯỚC KHI CHUYỂN */}
          {resolvedTargetViaUid && pagesToTransfer.length > 0 && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-2">
              <div className="flex items-center space-x-2 text-emerald-900 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Xem trước kết quả sau khi chuyển:</span>
              </div>

              <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-emerald-200/80">
                <div className="text-left">
                  <span className="text-[10px] text-slate-400 block font-bold">TỪ VIA NGUỒN</span>
                  <span className="font-mono font-bold text-slate-800">
                    {pagesToTransfer[0]?.viaUid || 'Chưa có'}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    NV: {pagesToTransfer[0]?.staffName}
                  </span>
                </div>

                <div className="flex flex-col items-center px-3">
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full mb-0.5">
                    {pagesToTransfer.length} Page
                  </span>
                  <ArrowRightLeft className="w-4 h-4 text-emerald-700" />
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-emerald-600 block font-bold">SANG VIA ĐÍCH</span>
                  <span className="font-mono font-extrabold text-indigo-900">
                    {resolvedTargetViaUid}
                  </span>
                  <span className="text-[11px] text-slate-700 font-semibold block">
                    NV: {resolvedTargetStaffName}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-emerald-800 leading-relaxed">
                ✓ <strong>Bảo toàn 100% dữ liệu:</strong> Tên Page, Link Page, Trạng thái, Chặn, Cách đăng, Tương tác và Số bài đã đăng hôm nay đều được chuyển đầy đủ qua Nick Via đích.
              </p>
            </div>
          )}

          {/* Error notice */}
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
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            Hủy Bỏ
          </button>

          <button
            type="button"
            disabled={pagesToTransfer.length === 0 || !resolvedTargetViaUid || isSubmitting}
            onClick={handleExecuteTransfer}
            className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Đang Chuyển Dữ Liệu...</span>
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>
                  Xác Nhận Chuyển {pagesToTransfer.length} Page Qua Via {resolvedTargetViaUid || '...'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
