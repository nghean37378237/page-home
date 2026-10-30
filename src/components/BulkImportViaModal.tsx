import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Users,
  Copy,
  Check,
  Info,
  Sparkles,
  Filter,
  Shield,
  ArrowRight,
  Download,
  FileText,
  Layers,
} from 'lucide-react';
import { FullViaItem, AppUser, ADMIN_WAITING_POOL, isAdminWaitingPool } from '../types';
import { downloadViaExcelTemplate } from '../utils/excelTemplates';
import { parseSupplementalViaInput, buildFullViaString } from '../utils/helpers';

interface BulkImportViaModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableStaffNames: string[];
  existingVias?: FullViaItem[];
  existingUids?: string[];
  presetStaff?: string;
  currentUser?: AppUser;
  onImport: (newVias: FullViaItem[], overwriteExisting: boolean) => void;
}

interface ParsedRow {
  index: number;
  rawLine: string;
  uid: string;
  pass: string;
  twoFa: string;
  email: string;
  emailPass: string;
  detectedStaff?: string;
  extra?: string;
  isValid: boolean;
  duplicateInDb?: FullViaItem;
  isDuplicateInDb: boolean;
  duplicateBatchIndex?: number;
  isDuplicateInBatch: boolean;
  duplicateMessage?: string;
}

export const BulkImportViaModal: React.FC<BulkImportViaModalProps> = ({
  isOpen,
  onClose,
  availableStaffNames,
  existingVias = [],
  existingUids = [],
  presetStaff,
  currentUser,
  onImport,
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<string>(
    presetStaff ||
      (currentUser?.role === 'staff' ? currentUser.name : availableStaffNames[0] || 'Anh Quỳnh')
  );
  const [batchNote, setBatchNote] = useState('');
  const [pageStatusOption, setPageStatusOption] = useState<
    | 'none'
    | 'has_page'
    | 'admin_added_page'
    | 'pending_page'
    | 'admin_added_group'
    | 'has_group'
    | 'not_joined_group'
  >('none');
  const [overwriteDuplicates, setOverwriteDuplicates] = useState(true); // Default to supplement/update existing UIDs with 2FA|Mail|Pass
  const [assignmentMode, setAssignmentMode] = useState<'single' | 'round_robin' | 'auto_detect'>('auto_detect');
  const [previewFilter, setPreviewFilter] = useState<'all' | 'new' | 'duplicate' | 'invalid'>('all');
  const [copiedDuplicates, setCopiedDuplicates] = useState(false);
  const [cleanedToast, setCleanedToast] = useState(false);

  // Sync selectedStaff when presetStaff or currentUser changes
  useEffect(() => {
    if (currentUser?.role === 'staff') {
      setSelectedStaff(currentUser.name);
      setAssignmentMode('single');
    } else if (presetStaff) {
      if (isAdminWaitingPool(presetStaff)) {
        setSelectedStaff(ADMIN_WAITING_POOL);
        setAssignmentMode('single');
      } else if (availableStaffNames.includes(presetStaff)) {
        setSelectedStaff(presetStaff);
      }
    }
  }, [presetStaff, availableStaffNames, currentUser, isOpen]);

  // Build existing map of UIDs
  const existingViaMap = useMemo(() => {
    const map = new Map<string, FullViaItem>();
    existingVias.forEach((v) => {
      const u = v.uid?.trim();
      if (u) map.set(u, v);
    });
    // Fallback for existingUids if existingVias is empty
    if (map.size === 0 && existingUids.length > 0) {
      existingUids.forEach((u) => {
        const trimmed = u.trim();
        if (trimmed) {
          map.set(trimmed, {
            id: trimmed,
            uid: trimmed,
            pass: '',
            twoFa: '',
            staffName: 'Đã có trong hệ thống',
          });
        }
      });
    }
    return map;
  }, [existingVias, existingUids]);

  // Parse lines and detect duplicate UIDs in database and within the batch
  const parsedRows: ParsedRow[] = useMemo(() => {
    if (!inputText.trim()) return [];

    const lines = inputText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const seenUidsInBatch = new Map<string, number>(); // uid -> first line index seen

    return lines.map((line, idx) => {
      // Strip out known staff names first if any token matches availableStaffNames
      let rawTokens: string[] = [];
      if (line.includes('|')) {
        rawTokens = line.split('|');
      } else if (line.includes('\t')) {
        rawTokens = line.split('\t');
      } else if (line.includes('----')) {
        rawTokens = line.split('----');
      } else if (line.includes(';')) {
        rawTokens = line.split(';');
      } else if (line.includes(':') && !line.startsWith('http')) {
        rawTokens = line.split(':');
      } else {
        rawTokens = line.split(/\s+/);
      }

      let detectedStaff: string | undefined;
      const nonStaffTokens: string[] = [];
      rawTokens.forEach((tok, tIdx) => {
        const trimmedTok = tok.trim();
        if (tIdx >= 1 && trimmedTok) {
          const matchedStaff = availableStaffNames.find(
            (s) => s.trim().toLowerCase() === trimmedTok.toLowerCase()
          );
          if (matchedStaff && !detectedStaff) {
            detectedStaff = matchedStaff;
            return;
          }
        }
        nonStaffTokens.push(trimmedTok);
      });

      const parsed = parseSupplementalViaInput(nonStaffTokens.join('|'));
      const uid = parsed.uid || nonStaffTokens[0]?.trim() || '';
      const pass = parsed.pass || '';
      const twoFa = parsed.twoFa || '';
      const email = parsed.email || '';
      const emailPass = parsed.emailPass || '';
      const extra = parsed.extraInfo || '';
      const isValid = uid.length >= 4 && Boolean(pass || twoFa || email);

      // Check duplicate against existing database
      const duplicateInDb = existingViaMap.get(uid);
      const isDuplicateInDb = Boolean(duplicateInDb);

      // Check duplicate within the batch
      let isDuplicateInBatch = false;
      let duplicateBatchIndex: number | undefined;
      if (uid) {
        if (seenUidsInBatch.has(uid)) {
          isDuplicateInBatch = true;
          duplicateBatchIndex = seenUidsInBatch.get(uid);
        } else {
          seenUidsInBatch.set(uid, idx + 1);
        }
      }

      let duplicateMessage = '';
      if (isDuplicateInDb) {
        duplicateMessage = `Đã có UID (Thuộc: ${duplicateInDb?.staffName || 'Chưa rõ'}) — Sẽ bổ sung 2FA/Mail/Pass`;
      } else if (isDuplicateInBatch) {
        duplicateMessage = `Trùng lặp với dòng #${duplicateBatchIndex} trong danh sách này`;
      }

      return {
        index: idx + 1,
        rawLine: line,
        uid,
        pass,
        twoFa,
        email,
        emailPass,
        detectedStaff,
        extra,
        isValid,
        duplicateInDb,
        isDuplicateInDb,
        duplicateBatchIndex,
        isDuplicateInBatch,
        duplicateMessage,
      };
    });
  }, [inputText, existingViaMap, availableStaffNames]);

  // Statistics
  const validRows = useMemo(() => parsedRows.filter((r) => r.isValid), [parsedRows]);
  
  // Rows that are duplicate in DB or internal batch
  const duplicateDbRows = useMemo(() => validRows.filter((r) => r.isDuplicateInDb), [validRows]);
  const duplicateBatchRows = useMemo(() => validRows.filter((r) => r.isDuplicateInBatch), [validRows]);
  const allDuplicateRows = useMemo(
    () => validRows.filter((r) => r.isDuplicateInDb || r.isDuplicateInBatch),
    [validRows]
  );
  const newValidRows = useMemo(
    () => validRows.filter((r) => !r.isDuplicateInDb && !r.isDuplicateInBatch),
    [validRows]
  );
  const invalidRows = useMemo(() => parsedRows.filter((r) => !r.isValid), [parsedRows]);

  // Distinct duplicate UIDs list for quick export/copy
  const distinctDuplicateUids = useMemo(() => {
    const set = new Set<string>();
    allDuplicateRows.forEach((r) => {
      if (r.uid) set.add(r.uid);
    });
    return Array.from(set);
  }, [allDuplicateRows]);

  // Thống kê số lượng Via mục Group hiện có trong Kho Via (Bảng 4)
  const existingGroupViaStats = useMemo(() => {
    let totalGroupVias = 0;
    let themMoiGroup = 0;
    let adminThemGroup = 0;
    let coGroupTuDau = 0;
    let canThemGroup = 0;
    let chuaJonGroup = 0;

    existingVias.forEach((v) => {
      const noteLower = `${v.note || ''} ${v.sharedNote || ''}`.toLowerCase();
      const isThemMoi = noteLower.includes('thêm mới để thêm group');
      const isAdminThem =
        noteLower.includes('admin đã thêm group') || noteLower.includes('admin thêm group');
      const isCoTuDau =
        noteLower.includes('có group từ đầu') || noteLower.includes('đã có group');
      const isCanThem =
        noteLower.includes('cần thêm group') || noteLower.includes('cần join group');
      const isChuaJon =
        v.groupJoinStatus === 'chua_jon' ||
        v.pageUpdateStatus === 'not_joined_group' ||
        noteLower.includes('chưa jon group') ||
        noteLower.includes('chưa join group') ||
        noteLower.includes('via chưa jon');
      const isAnyGroup =
        isThemMoi ||
        isAdminThem ||
        isCoTuDau ||
        isCanThem ||
        isChuaJon ||
        noteLower.includes('group') ||
        v.pageUpdateStatus === 'for_group';

      if (isAnyGroup) totalGroupVias++;
      if (isThemMoi) themMoiGroup++;
      if (isAdminThem) adminThemGroup++;
      if (isCoTuDau) coGroupTuDau++;
      if (isCanThem) canThemGroup++;
      if (isChuaJon) chuaJonGroup++;
    });

    return {
      totalGroupVias,
      themMoiGroup,
      adminThemGroup,
      coGroupTuDau,
      canThemGroup,
      chuaJonGroup,
    };
  }, [existingVias]);

  // Rows to display based on active filter tab
  const filteredDisplayRows = useMemo(() => {
    switch (previewFilter) {
      case 'new':
        return newValidRows;
      case 'duplicate':
        return allDuplicateRows;
      case 'invalid':
        return invalidRows;
      default:
        return parsedRows;
    }
  }, [previewFilter, parsedRows, newValidRows, allDuplicateRows, invalidRows]);

  // Copy list of duplicate UIDs to clipboard
  const handleCopyDuplicateUids = async () => {
    if (distinctDuplicateUids.length === 0) return;
    try {
      const textToCopy = distinctDuplicateUids.join('\n');
      await navigator.clipboard.writeText(textToCopy);
      setCopiedDuplicates(true);
      setTimeout(() => setCopiedDuplicates(false), 2000);
    } catch (e) {
      console.error('Không thể copy UID trùng:', e);
    }
  };

  // Quick Action: Auto-remove duplicate lines from inputText
  const handleRemoveDuplicatesFromInput = () => {
    if (allDuplicateRows.length === 0) return;

    const seenUids = new Set<string>();
    const cleanedLines: string[] = [];

    parsedRows.forEach((row) => {
      // If row is invalid, keep or skip? Keep if needed, but if valid and not duplicate in DB or batch:
      if (row.isValid) {
        if (!row.isDuplicateInDb && !seenUids.has(row.uid)) {
          seenUids.add(row.uid);
          cleanedLines.push(row.rawLine);
        }
      } else {
        cleanedLines.push(row.rawLine);
      }
    });

    setInputText(cleanedLines.join('\n'));
    setCleanedToast(true);
    setTimeout(() => setCleanedToast(false), 2500);
    setPreviewFilter('all');
  };

  const handlePasteSample = () => {
    // Generate sample with both new vias, one existing via (if any) and one duplicate in batch
    const existingSampleUid = existingVias[0]?.uid || '100092182746192';
    const sample = `100083920194857|FbPassAnhQuynh#1|4X7Y2Z3A4B5C6D7E|Anh Quỳnh|Lô US 2024
${existingSampleUid}|MatKhauCheckTrung#99|JBSWY3DPEHPK3PXP|Anh Quỳnh|Nick Đã Có Trong Bảng
100078192837465|BaoSecurity2024!|KZX7W8Y9A1B2C3D4|Bảo
100069283746519|PhuongMyPro#2024|H8J9K1L2M3N4P5Q6|Phương My
100083920194857|FbPassAnhQuynh#1|4X7Y2Z3A4B5C6D7E|Anh Quỳnh|Nick Bị Dán Lặp Lại`;
    setInputText(sample);
  };

  const handleExecuteImport = () => {
    if (validRows.length === 0) return;

    const newItems: FullViaItem[] = [];
    const staffPool = availableStaffNames.length > 0 ? availableStaffNames : ['Anh Quỳnh'];

    // Track seen UIDs in this execution to prevent inserting duplicates into the array
    const processedUids = new Set<string>();

    validRows.forEach((row, index) => {
      // If internal duplicate in batch and already processed, skip
      if (processedUids.has(row.uid)) {
        return;
      }
      processedUids.add(row.uid);

      // If duplicate in DB and user chose NOT to overwrite, skip it
      if (row.isDuplicateInDb && !overwriteDuplicates) {
        return;
      }

      let assignedStaff = selectedStaff;
      if (currentUser?.role === 'staff') {
        assignedStaff = currentUser.name;
      } else if (assignmentMode === 'auto_detect') {
        assignedStaff = row.detectedStaff || selectedStaff;
      } else if (assignmentMode === 'round_robin') {
        assignedStaff = staffPool[index % staffPool.length];
      }

      const noteLower = batchNote.toLowerCase();
      const isNotJoinedGroup =
        pageStatusOption === 'not_joined_group' ||
        noteLower.includes('chưa jon group') ||
        noteLower.includes('chưa join group') ||
        noteLower.includes('via chưa jon');

      const isAdminAddedGroup =
        !isNotJoinedGroup &&
        (pageStatusOption === 'admin_added_group' ||
          noteLower.includes('thêm mới để thêm group') ||
          noteLower.includes('admin đã thêm group') ||
          noteLower.includes('admin thêm group') ||
          noteLower.includes('cần thêm group') ||
          noteLower.includes('cần join group'));

      const isMarkedHasGroup =
        !isNotJoinedGroup &&
        !isAdminAddedGroup &&
        (pageStatusOption === 'has_group' ||
          noteLower.includes('có group từ đầu') ||
          noteLower.includes('đã có group'));

      const isAdminAddedPage =
        !isNotJoinedGroup &&
        !isAdminAddedGroup &&
        !isMarkedHasGroup &&
        (pageStatusOption === 'admin_added_page' ||
          pageStatusOption === 'pending_page' ||
          noteLower.includes('admin đã thêm page') ||
          noteLower.includes('admin thêm page') ||
          noteLower.includes('cần gán page'));

      const isMarkedHasPage =
        !isNotJoinedGroup &&
        !isAdminAddedPage &&
        !isAdminAddedGroup &&
        !isMarkedHasGroup &&
        (pageStatusOption === 'has_page' ||
          noteLower.includes('có page từ đầu') ||
          noteLower.includes('đã có page'));

      const isPendingAssign = isAdminAddedPage || isAdminAddedGroup;
      const isUpdatedAssign = isMarkedHasPage || isMarkedHasGroup;

      const finalNote = batchNote
        ? `${batchNote}${row.extra ? ` - ${row.extra}` : ''}`
        : row.extra ||
          (isNotJoinedGroup
            ? 'Via chưa Jon Group'
            : isAdminAddedGroup
            ? 'Thêm mới để thêm Group'
            : isMarkedHasGroup
            ? 'Có Group từ đầu'
            : isAdminAddedPage
            ? 'Admin đã thêm page'
            : isMarkedHasPage
            ? 'Có page từ đầu'
            : 'Nhập hàng loạt');

      const item: FullViaItem = {
        id: `via-imported-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
        uid: row.uid,
        pass: row.pass,
        twoFa: row.twoFa,
        ...(row.email ? { email: row.email } : {}),
        ...(row.emailPass ? { emailPass: row.emailPass } : {}),
        ...(row.extra ? { extraInfo: row.extra } : {}),
        staffName: assignedStaff,
        note: finalNote,
        status: 'active',
        adminReportStatus: 'None',
        createdAt: new Date().toLocaleDateString('vi-VN'),
        rawFullVia: buildFullViaString(row.uid, row.pass, row.twoFa, row.email, row.emailPass, row.extra),
        pageUpdateStatus: isNotJoinedGroup
          ? 'not_joined_group'
          : isPendingAssign
          ? 'pending'
          : isUpdatedAssign
          ? 'updated'
          : 'none',
        groupJoinStatus: isNotJoinedGroup
          ? 'chua_jon'
          : isMarkedHasGroup
          ? 'da_jon'
          : isAdminAddedGroup
          ? 'chua_jon'
          : 'none',
        hasAdminAssignedPage: isPendingAssign,
        pageAssignedAt: isPendingAssign ? new Date().toLocaleDateString('vi-VN') : undefined,
        pageUpdatedAt: isUpdatedAssign ? new Date().toLocaleDateString('vi-VN') : undefined,
      };

      newItems.push(item);
    });

    onImport(newItems, overwriteDuplicates);
    onClose();
    setInputText('');
  };

  if (!isOpen) return null;

  const totalEffectiveToImport = overwriteDuplicates
    ? validRows.length - duplicateBatchRows.length
    : newValidRows.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/10 rounded-xl border border-white/20">
              <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black flex items-center gap-2">
                Bổ Sung Nhiều Nick 1 Lúc & Check Trùng UID
                <span className="text-[10px] uppercase tracking-wider bg-emerald-500/40 text-emerald-100 font-extrabold px-2 py-0.5 rounded-full border border-emerald-400/30">
                  Tự Động Báo Trùng
                </span>
              </h2>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                Dán danh sách nick Facebook (UID|PASS|2FA) từ Excel hoặc file text. Hệ thống tự động quét và cảnh báo các UID đã có.
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

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs text-slate-700">
          {/* Format Helper & Sample */}
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center flex-wrap gap-2 text-slate-700">
              <Info className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold text-slate-800">Định dạng hỗ trợ:</span>
              <code className="bg-emerald-100 text-emerald-900 font-mono px-1.5 py-0.5 rounded text-[11px] font-bold">
                UID|PASS|2FA
              </code>
              <code className="bg-slate-200 text-slate-800 font-mono px-1.5 py-0.5 rounded text-[11px]">
                UID|PASS|2FA|TÊN_NV|GHI_CHÚ...
              </code>
              <span className="text-slate-500">hoặc copy các cột từ Google Sheet / Excel</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => downloadViaExcelTemplate('xlsx')}
                className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                title="Tải về file Excel mẫu chuẩn cho Nick Via"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Tải Mẫu Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={handlePasteSample}
                className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 font-bold border border-emerald-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Dán Dữ Liệu Mẫu</span>
              </button>
            </div>
          </div>

          {/* Textarea Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between font-bold text-slate-800">
              <label htmlFor="bulk-via-textarea" className="flex items-center space-x-1.5">
                <span>Dán danh sách nick vào đây (mỗi nick 1 dòng):</span>
              </label>
              <div className="flex items-center space-x-2 text-[11px] font-normal">
                {inputText && (
                  <button
                    type="button"
                    onClick={() => setInputText('')}
                    className="text-slate-400 hover:text-red-600 transition-colors"
                  >
                    Xóa sạch
                  </button>
                )}
                <span className="text-slate-500">
                  Tổng nhận diện: <strong className="text-emerald-700 font-bold">{validRows.length}</strong> nick hợp lệ
                </span>
              </div>
            </div>
            <textarea
              id="bulk-via-textarea"
              rows={6}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Dán nick theo định dạng:&#10;100092182746192|MatKhauVia99@|JBSWY3DPEHPK3PXP&#10;100083920194857|FbPassAnhQuynh#1|4X7Y2Z3A4B5C6D7E|Anh Quỳnh&#10;100078192837465	BaoSecurity2024!	KZX7W8Y9A1B2C3D4"
              className="w-full font-mono text-xs p-3.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden bg-slate-50/60 leading-relaxed"
            />
          </div>

          {/* PROMINENT DUPLICATE ALERT BANNER (BÁO TRÙNG UID RÕ RÀNG) */}
          {allDuplicateRows.length > 0 && (
            <div className="bg-amber-50 border-2 border-amber-400/80 rounded-xl p-3.5 sm:p-4 text-slate-800 shadow-xs animate-in slide-in-from-top-2 duration-150">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-amber-200 text-amber-900 rounded-lg shrink-0 mt-0.5">
                    <AlertTriangle className="w-5 h-5 text-amber-800" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-amber-900 flex items-center flex-wrap gap-2">
                      <span>CẢNH BÁO PHÁT HIỆN TRÙNG UID:</span>
                      <span className="bg-amber-600 text-white font-black px-2 py-0.5 rounded-full text-xs">
                        {distinctDuplicateUids.length} UID bị trùng
                      </span>
                    </h3>
                    <p className="text-xs text-amber-950 mt-1 leading-relaxed">
                      {duplicateDbRows.length > 0 && (
                        <span>
                          • Có <strong>{duplicateDbRows.length} dòng</strong> trùng với nick đã tồn tại trong bảng quản lý.{' '}
                        </span>
                      )}
                      {duplicateBatchRows.length > 0 && (
                        <span>
                          • Có <strong>{duplicateBatchRows.length} dòng</strong> bị dán lặp lại nhiều lần trong chính danh sách này.
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Quick actions for duplicate resolution */}
                <div className="flex items-center flex-wrap gap-2 shrink-0 self-start sm:self-center">
                  <button
                    type="button"
                    onClick={handleCopyDuplicateUids}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold border border-amber-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                    title="Copy danh sách các UID trùng để kiểm tra hoặc gửi lại bên cấp nick"
                  >
                    {copiedDuplicates ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        <span className="text-emerald-800 font-extrabold">Đã chép {distinctDuplicateUids.length} UID!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-amber-800" />
                        <span>Copy {distinctDuplicateUids.length} UID Trùng</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleRemoveDuplicatesFromInput}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                    title="Tự động xóa các dòng UID trùng khỏi ô dán, chỉ giữ lại các nick mới"
                  >
                    <Filter className="w-3.5 h-3.5" />
                    <span>⚡ Lọc Bỏ UID Trùng Khỏi Ô Dán</span>
                  </button>
                </div>
              </div>

              {/* Duplicate List Chips with Ownership */}
              <div className="mt-3 pt-2.5 border-t border-amber-200/80">
                <span className="text-[11px] font-bold text-amber-900 block mb-1.5">
                  Danh sách chi tiết các UID bị trùng:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {allDuplicateRows.slice(0, 20).map((dup, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center space-x-1 bg-white border border-amber-300 text-amber-950 px-2 py-0.5 rounded-md text-[11px] font-mono shadow-2xs"
                      title={dup.duplicateMessage}
                    >
                      <span className="font-bold">{dup.uid}</span>
                      {dup.duplicateInDb ? (
                        <span className="text-[10px] text-amber-800 font-sans font-medium bg-amber-100 px-1 rounded">
                          Thuộc: {dup.duplicateInDb.staffName || 'Hệ thống'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-orange-800 font-sans font-medium bg-orange-100 px-1 rounded">
                          Lặp dòng #{dup.duplicateBatchIndex}
                        </span>
                      )}
                    </span>
                  ))}
                  {allDuplicateRows.length > 20 && (
                    <span className="text-[11px] text-amber-800 font-semibold px-2 py-0.5">
                      + và {allDuplicateRows.length - 20} UID khác...
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {cleanedToast && (
            <div className="p-2.5 bg-emerald-100 border border-emerald-300 rounded-xl text-emerald-900 font-bold flex items-center space-x-2 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Đã tự động loại bỏ tất cả các dòng trùng! Hiện chỉ còn lại các nick mới trong ô dán.</span>
            </div>
          )}

          {/* Configuration Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            {/* Staff Assignment */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 block mb-1 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                <span>Phân Quyền Cho Nhân Viên:</span>
              </label>

              {currentUser?.role === 'staff' ? (
                <div className="p-2.5 bg-white border border-indigo-200 rounded-lg text-xs">
                  <span className="text-slate-500 block text-[11px]">Đang đăng nhập:</span>
                  <span className="font-bold text-indigo-950 text-sm">👤 {currentUser.name}</span>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Các nick nạp vào sẽ được giao tự động cho tài khoản của bạn.
                  </p>
                </div>
              ) : (
                <div className="space-y-1 text-xs">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="assignmentMode"
                      checked={assignmentMode === 'auto_detect'}
                      onChange={() => setAssignmentMode('auto_detect')}
                      className="text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                    />
                    <span className="text-slate-800 font-medium">
                      Tự nhận diện NV từ dòng dán (cột 4)
                    </span>
                  </label>

                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="assignmentMode"
                      checked={assignmentMode === 'single'}
                      onChange={() => setAssignmentMode('single')}
                      className="text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                    />
                    <span className="text-slate-800 font-medium">Gán tất cả cho:</span>
                  </label>

                  <select
                    value={selectedStaff}
                    onChange={(e) => {
                      setSelectedStaff(e.target.value);
                      setAssignmentMode('single');
                    }}
                    disabled={assignmentMode === 'round_robin'}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-indigo-900 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 mt-1"
                  >
                    <option value={ADMIN_WAITING_POOL}>
                      📦 {ADMIN_WAITING_POOL} (Chưa nhân viên nào dùng)
                    </option>
                    {availableStaffNames
                      .filter((n) => !isAdminWaitingPool(n))
                      .map((name) => (
                        <option key={name} value={name}>
                          👤 {name}
                        </option>
                      ))}
                  </select>

                  <label className="flex items-center space-x-1.5 cursor-pointer pt-0.5">
                    <input
                      type="radio"
                      name="assignmentMode"
                      checked={assignmentMode === 'round_robin'}
                      onChange={() => setAssignmentMode('round_robin')}
                      className="text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                    />
                    <span className="text-slate-700">
                      Chia đều xoay vòng ({availableStaffNames.length} NV)
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Batch Note & Page Status */}
            <div className="space-y-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Ghi Chú Lô Nick (Tùy chọn):</span>
                  </label>
                  {batchNote && (
                    <button
                      type="button"
                      onClick={() => {
                        setBatchNote('');
                        setPageStatusOption('none');
                      }}
                      className="text-[10px] text-slate-400 hover:text-red-600 font-bold cursor-pointer"
                      title="Xóa trắng ghi chú"
                    >
                      Xóa
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="VD: Thêm mới để thêm Group, Admin đã thêm Group, Admin đã thêm page..."
                  value={batchNote}
                  onChange={(e) => {
                    const val = e.target.value;
                    const lower = val.toLowerCase();
                    setBatchNote(val);
                    if (
                      lower.includes('thêm mới để thêm group') ||
                      lower.includes('admin đã thêm group') ||
                      lower.includes('admin thêm group') ||
                      lower.includes('cần thêm group')
                    ) {
                      setPageStatusOption('admin_added_group');
                    } else if (lower.includes('có group từ đầu') || lower.includes('đã có group')) {
                      setPageStatusOption('has_group');
                    } else if (lower.includes('admin đã thêm page') || lower.includes('admin thêm page')) {
                      setPageStatusOption('admin_added_page');
                    } else if (lower.includes('có page từ đầu') || lower.includes('đã có page')) {
                      setPageStatusOption('has_page');
                    } else if (lower.includes('cần gán page')) {
                      setPageStatusOption('admin_added_page');
                    }
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 font-medium"
                />
              </div>

              {/* CÁC NÚT CHỌN NHANH GHI CHÚ: CHỌN THÊM PAGE & CHỌN THÊM MỚI ĐỂ THÊM GROUP */}
              <div className="space-y-1.5">
                {/* NHÓM 1: GHI CHÚ THÊM PAGE */}
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Chọn Nhanh Ghi Chú — Phần Thêm Page:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {/* NÚT CHỌN "ADMIN ĐÃ THÊM PAGE" - MÀU ĐỎ ĐỂ NHÂN VIÊN BIẾT */}
                    <button
                      type="button"
                      onClick={() => {
                        const isSelected =
                          pageStatusOption === 'admin_added_page' ||
                          batchNote.toLowerCase().includes('admin đã thêm page');
                        if (isSelected) {
                          setPageStatusOption('none');
                          setBatchNote((prev) =>
                            prev.replace(/(\s*-\s*)?Admin đã thêm page/gi, '').trim()
                          );
                        } else {
                          setPageStatusOption('admin_added_page');
                          setBatchNote((prev) => {
                            const cleaned = prev
                              .replace(/(\s*-\s*)?Có page từ đầu/gi, '')
                              .replace(/(\s*-\s*)?Đã có page/gi, '')
                              .replace(/(\s*-\s*)?Cần gán page/gi, '')
                              .replace(/(\s*-\s*)?Thêm mới để thêm Group/gi, '')
                              .replace(/(\s*-\s*)?Admin đã thêm Group/gi, '')
                              .replace(/(\s*-\s*)?Có Group từ đầu/gi, '')
                              .replace(/(\s*-\s*)?Cần thêm Group/gi, '')
                              .trim();
                            return cleaned ? `${cleaned} - Admin đã thêm page` : 'Admin đã thêm page';
                          });
                        }
                      }}
                      className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer border ${
                        pageStatusOption === 'admin_added_page' ||
                        batchNote.toLowerCase().includes('admin đã thêm page')
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs ring-2 ring-rose-400/30'
                          : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                      }`}
                      title="Admin đã thêm page để nhân viên biết (MÀU ĐỎ)"
                    >
                      <span>🔴 Admin đã thêm page</span>
                    </button>

                    {/* NÚT CHỌN "CÓ PAGE TỪ ĐẦU" - MÀU XANH */}
                    <button
                      type="button"
                      onClick={() => {
                        const isSelected =
                          pageStatusOption === 'has_page' ||
                          batchNote.toLowerCase().includes('có page từ đầu') ||
                          batchNote.toLowerCase().includes('đã có page');
                        if (isSelected) {
                          setPageStatusOption('none');
                          setBatchNote((prev) =>
                            prev
                              .replace(/(\s*-\s*)?Có page từ đầu/gi, '')
                              .replace(/(\s*-\s*)?Đã có page/gi, '')
                              .trim()
                          );
                        } else {
                          setPageStatusOption('has_page');
                          setBatchNote((prev) => {
                            const cleaned = prev
                              .replace(/(\s*-\s*)?Admin đã thêm page/gi, '')
                              .replace(/(\s*-\s*)?Cần gán page/gi, '')
                              .replace(/(\s*-\s*)?Thêm mới để thêm Group/gi, '')
                              .replace(/(\s*-\s*)?Admin đã thêm Group/gi, '')
                              .replace(/(\s*-\s*)?Có Group từ đầu/gi, '')
                              .replace(/(\s*-\s*)?Cần thêm Group/gi, '')
                              .trim();
                            return cleaned ? `${cleaned} - Có page từ đầu` : 'Có page từ đầu';
                          });
                        }
                      }}
                      className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer border ${
                        pageStatusOption === 'has_page' ||
                        batchNote.toLowerCase().includes('có page từ đầu') ||
                        batchNote.toLowerCase().includes('đã có page')
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-500/30'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                      }`}
                      title="Nick có page từ đầu (MÀU XANH)"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>🟢 Có page từ đầu</span>
                    </button>

                    {/* Nút Cần Gán Page */}
                    <button
                      type="button"
                      onClick={() => {
                        const isSelected =
                          pageStatusOption === 'pending_page' ||
                          batchNote.toLowerCase().includes('cần gán page');
                        if (isSelected) {
                          setPageStatusOption('none');
                          setBatchNote((prev) =>
                            prev.replace(/(\s*-\s*)?Cần gán page/gi, '').trim()
                          );
                        } else {
                          setPageStatusOption('admin_added_page');
                          setBatchNote((prev) => {
                            const cleaned = prev
                              .replace(/(\s*-\s*)?Admin đã thêm page/gi, '')
                              .replace(/(\s*-\s*)?Có page từ đầu/gi, '')
                              .replace(/(\s*-\s*)?Đã có page/gi, '')
                              .replace(/(\s*-\s*)?Thêm mới để thêm Group/gi, '')
                              .replace(/(\s*-\s*)?Admin đã thêm Group/gi, '')
                              .replace(/(\s*-\s*)?Có Group từ đầu/gi, '')
                              .replace(/(\s*-\s*)?Cần thêm Group/gi, '')
                              .trim();
                            return cleaned ? `${cleaned} - Cần gán page` : 'Cần gán page';
                          });
                        }
                      }}
                      className={`inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                        pageStatusOption === 'pending_page' ||
                        batchNote.toLowerCase().includes('cần gán page')
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                      }`}
                      title="Báo động đỏ: Cần nhân viên gán Page"
                    >
                      <span>🔴 Cần gán page</span>
                    </button>
                  </div>
                </div>

                {/* NHÓM 2: GHI CHÚ CHO PHẦN THÊM MỚI ĐỂ THÊM GROUP + THỐNG KÊ MỤC VIA GROUP */}
                <div className="p-2.5 rounded-xl bg-purple-50/80 border border-purple-200 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="text-[10px] font-extrabold text-purple-900 uppercase tracking-wider">
                      🟣 Chọn Nhanh Ghi Chú — Phần Thêm Mới Để Thêm Group:
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-600 text-white shadow-2xs"
                      title="Tổng số nick Via đang có ghi chú mục Group trong Kho Via (Bảng 4)"
                    >
                      📊 Tổng Via Group: {existingGroupViaStats.totalGroupVias} nick
                    </span>
                  </div>

                  {/* Bảng thống kê mini cho mục Group của Via */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 bg-white/90 p-1.5 rounded-lg border border-purple-200/80 text-[10px]">
                    <div className="px-1.5 py-1 rounded bg-orange-50 border border-orange-200 flex flex-col">
                      <span className="text-orange-800 font-bold truncate">🟠 Chưa Jon Group</span>
                      <span className="font-black text-orange-950 text-xs">
                        {existingGroupViaStats.chuaJonGroup} <span className="text-[9px] font-normal">via</span>
                      </span>
                    </div>
                    <div className="px-1.5 py-1 rounded bg-purple-50 border border-purple-100 flex flex-col">
                      <span className="text-purple-700 font-semibold truncate">🟣 Thêm mới Group</span>
                      <span className="font-black text-purple-950 text-xs">
                        {existingGroupViaStats.themMoiGroup} <span className="text-[9px] font-normal">via</span>
                      </span>
                    </div>
                    <div className="px-1.5 py-1 rounded bg-purple-50 border border-purple-100 flex flex-col">
                      <span className="text-purple-700 font-semibold truncate">🟣 Admin thêm Group</span>
                      <span className="font-black text-purple-950 text-xs">
                        {existingGroupViaStats.adminThemGroup} <span className="text-[9px] font-normal">via</span>
                      </span>
                    </div>
                    <div className="px-1.5 py-1 rounded bg-indigo-50 border border-indigo-100 flex flex-col">
                      <span className="text-indigo-700 font-semibold truncate">🔵 Có Group từ đầu</span>
                      <span className="font-black text-indigo-950 text-xs">
                        {existingGroupViaStats.coGroupTuDau} <span className="text-[9px] font-normal">via</span>
                      </span>
                    </div>
                    <div className="px-1.5 py-1 rounded bg-amber-50 border border-amber-100 flex flex-col">
                      <span className="text-amber-800 font-semibold truncate">🟠 Cần thêm Group</span>
                      <span className="font-black text-amber-950 text-xs">
                        {existingGroupViaStats.canThemGroup} <span className="text-[9px] font-normal">via</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {/* Nút 1: Thêm mới để thêm Group */}
                    <button
                      type="button"
                      onClick={() => {
                        const isSelected = batchNote
                          .toLowerCase()
                          .includes('thêm mới để thêm group');
                        if (isSelected) {
                          setPageStatusOption('none');
                          setBatchNote((prev) =>
                            prev.replace(/(\s*-\s*)?Thêm mới để thêm Group/gi, '').trim()
                          );
                        } else {
                          setPageStatusOption('admin_added_group');
                          setBatchNote((prev) => {
                            const cleaned = prev
                              .replace(/(\s*-\s*)?Admin đã thêm page/gi, '')
                              .replace(/(\s*-\s*)?Có page từ đầu/gi, '')
                              .replace(/(\s*-\s*)?Đã có page/gi, '')
                              .replace(/(\s*-\s*)?Cần gán page/gi, '')
                              .replace(/(\s*-\s*)?Admin đã thêm Group/gi, '')
                              .replace(/(\s*-\s*)?Có Group từ đầu/gi, '')
                              .replace(/(\s*-\s*)?Cần thêm Group/gi, '')
                              .trim();
                            return cleaned
                              ? `${cleaned} - Thêm mới để thêm Group`
                              : 'Thêm mới để thêm Group';
                          });
                        }
                      }}
                      className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer border ${
                        batchNote.toLowerCase().includes('thêm mới để thêm group')
                          ? 'bg-purple-600 text-white border-purple-700 shadow-xs ring-2 ring-purple-400/30'
                          : 'bg-white text-purple-900 border-purple-300 hover:bg-purple-100'
                      }`}
                      title="Ghi chú nick thêm mới dùng để thêm Group / làm Group"
                    >
                      <span>🟣 Thêm mới để thêm Group</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                          batchNote.toLowerCase().includes('thêm mới để thêm group')
                            ? 'bg-white/25 text-white'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {existingGroupViaStats.themMoiGroup}
                      </span>
                    </button>

                    {/* Nút 2: Admin đã thêm Group */}
                    <button
                      type="button"
                      onClick={() => {
                        const isSelected = batchNote
                          .toLowerCase()
                          .includes('admin đã thêm group');
                        if (isSelected) {
                          setPageStatusOption('none');
                          setBatchNote((prev) =>
                            prev.replace(/(\s*-\s*)?Admin đã thêm Group/gi, '').trim()
                          );
                        } else {
                          setPageStatusOption('admin_added_group');
                          setBatchNote((prev) => {
                            const cleaned = prev
                              .replace(/(\s*-\s*)?Admin đã thêm page/gi, '')
                              .replace(/(\s*-\s*)?Có page từ đầu/gi, '')
                              .replace(/(\s*-\s*)?Đã có page/gi, '')
                              .replace(/(\s*-\s*)?Cần gán page/gi, '')
                              .replace(/(\s*-\s*)?Thêm mới để thêm Group/gi, '')
                              .replace(/(\s*-\s*)?Có Group từ đầu/gi, '')
                              .replace(/(\s*-\s*)?Cần thêm Group/gi, '')
                              .trim();
                            return cleaned
                              ? `${cleaned} - Admin đã thêm Group`
                              : 'Admin đã thêm Group';
                          });
                        }
                      }}
                      className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer border ${
                        batchNote.toLowerCase().includes('admin đã thêm group')
                          ? 'bg-purple-600 text-white border-purple-700 shadow-xs ring-2 ring-purple-400/30'
                          : 'bg-white text-purple-900 border-purple-300 hover:bg-purple-100'
                      }`}
                      title="Admin đã thêm Group cho nhân viên biết"
                    >
                      <span>🟣 Admin đã thêm Group</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                          batchNote.toLowerCase().includes('admin đã thêm group')
                            ? 'bg-white/25 text-white'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {existingGroupViaStats.adminThemGroup}
                      </span>
                    </button>

                    {/* Nút 3: Có Group từ đầu */}
                    <button
                      type="button"
                      onClick={() => {
                        const isSelected =
                          pageStatusOption === 'has_group' ||
                          batchNote.toLowerCase().includes('có group từ đầu');
                        if (isSelected) {
                          setPageStatusOption('none');
                          setBatchNote((prev) =>
                            prev.replace(/(\s*-\s*)?Có Group từ đầu/gi, '').trim()
                          );
                        } else {
                          setPageStatusOption('has_group');
                          setBatchNote((prev) => {
                            const cleaned = prev
                              .replace(/(\s*-\s*)?Admin đã thêm page/gi, '')
                              .replace(/(\s*-\s*)?Có page từ đầu/gi, '')
                              .replace(/(\s*-\s*)?Đã có page/gi, '')
                              .replace(/(\s*-\s*)?Cần gán page/gi, '')
                              .replace(/(\s*-\s*)?Thêm mới để thêm Group/gi, '')
                              .replace(/(\s*-\s*)?Admin đã thêm Group/gi, '')
                              .replace(/(\s*-\s*)?Cần thêm Group/gi, '')
                              .trim();
                            return cleaned
                              ? `${cleaned} - Có Group từ đầu`
                              : 'Có Group từ đầu';
                          });
                        }
                      }}
                      className={`inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                        pageStatusOption === 'has_group' ||
                        batchNote.toLowerCase().includes('có group từ đầu')
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                          : 'bg-white text-indigo-800 border-indigo-300 hover:bg-indigo-100'
                      }`}
                      title="Nick đã có sẵn Group từ đầu"
                    >
                      <span>🔵 Có Group từ đầu</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                          pageStatusOption === 'has_group' ||
                          batchNote.toLowerCase().includes('có group từ đầu')
                            ? 'bg-white/25 text-white'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {existingGroupViaStats.coGroupTuDau}
                      </span>
                    </button>

                    {/* Nút 4: Cần thêm Group */}
                    <button
                      type="button"
                      onClick={() => {
                        const isSelected = batchNote
                          .toLowerCase()
                          .includes('cần thêm group');
                        if (isSelected) {
                          setPageStatusOption('none');
                          setBatchNote((prev) =>
                            prev.replace(/(\s*-\s*)?Cần thêm Group/gi, '').trim()
                          );
                        } else {
                          setPageStatusOption('admin_added_group');
                          setBatchNote((prev) => {
                            const cleaned = prev
                              .replace(/(\s*-\s*)?Admin đã thêm page/gi, '')
                              .replace(/(\s*-\s*)?Có page từ đầu/gi, '')
                              .replace(/(\s*-\s*)?Đã có page/gi, '')
                              .replace(/(\s*-\s*)?Cần gán page/gi, '')
                              .replace(/(\s*-\s*)?Thêm mới để thêm Group/gi, '')
                              .replace(/(\s*-\s*)?Admin đã thêm Group/gi, '')
                              .replace(/(\s*-\s*)?Có Group từ đầu/gi, '')
                              .trim();
                            return cleaned
                              ? `${cleaned} - Cần thêm Group`
                              : 'Cần thêm Group';
                          });
                        }
                      }}
                      className={`inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                        batchNote.toLowerCase().includes('cần thêm group')
                          ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                          : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-100'
                      }`}
                      title="Nick cần Join / Thêm Group"
                    >
                      <span>🟠 Cần thêm Group</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                          batchNote.toLowerCase().includes('cần thêm group')
                            ? 'bg-white/25 text-white'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {existingGroupViaStats.canThemGroup}
                      </span>
                    </button>

                    {/* Nút 5: Via chưa Jon Group */}
                    <button
                      type="button"
                      onClick={() => {
                        const isSelected =
                          pageStatusOption === 'not_joined_group' ||
                          batchNote.toLowerCase().includes('chưa jon group');
                        if (isSelected) {
                          setPageStatusOption('none');
                          setBatchNote((prev) =>
                            prev.replace(/(\s*-\s*)?Via chưa Jon Group/gi, '').trim()
                          );
                        } else {
                          setPageStatusOption('not_joined_group');
                          setBatchNote((prev) => {
                            const cleaned = prev
                              .replace(/(\s*-\s*)?Admin đã thêm page/gi, '')
                              .replace(/(\s*-\s*)?Có page từ đầu/gi, '')
                              .replace(/(\s*-\s*)?Đã có page/gi, '')
                              .replace(/(\s*-\s*)?Cần gán page/gi, '')
                              .replace(/(\s*-\s*)?Thêm mới để thêm Group/gi, '')
                              .replace(/(\s*-\s*)?Admin đã thêm Group/gi, '')
                              .replace(/(\s*-\s*)?Có Group từ đầu/gi, '')
                              .replace(/(\s*-\s*)?Cần thêm Group/gi, '')
                              .trim();
                            return cleaned
                              ? `${cleaned} - Via chưa Jon Group`
                              : 'Via chưa Jon Group';
                          });
                        }
                      }}
                      className={`inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                        pageStatusOption === 'not_joined_group' ||
                        batchNote.toLowerCase().includes('chưa jon group')
                          ? 'bg-orange-600 text-white border-orange-700 shadow-xs ring-2 ring-orange-300'
                          : 'bg-white text-orange-800 border-orange-300 hover:bg-orange-100'
                      }`}
                      title="Đánh dấu nick Via chưa Jon Group (đồng bộ mục Trạng Thái)"
                    >
                      <span>🟠 Via chưa Jon Group</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                          pageStatusOption === 'not_joined_group' ||
                          batchNote.toLowerCase().includes('chưa jon group')
                            ? 'bg-white/25 text-white'
                            : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {existingGroupViaStats.chuaJonGroup}
                      </span>
                    </button>
                  </div>
                </div>

                {/* NHÓM 3: TAG KHÁC */}
                <div className="flex flex-wrap gap-1 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setBatchNote((prev) =>
                        prev ? `${prev} - Via Ngoại` : 'Lô Via Ngoại'
                      );
                    }}
                    className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 cursor-pointer"
                  >
                    Via Ngoại
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBatchNote((prev) => (prev ? `${prev} - BM 2K5` : 'BM 2K5'));
                    }}
                    className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 cursor-pointer"
                  >
                    BM 2K5
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBatchNote((prev) => (prev ? `${prev} - Ngâm` : 'Via Ngâm'));
                    }}
                    className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 cursor-pointer"
                  >
                    Ngâm
                  </button>
                </div>
              </div>

              {/* TÙY CHỌN TRẠNG THÁI PAGE / GROUP KÈM THEO (BẢNG 4) */}
              <div className="pt-1.5 border-t border-slate-200/80">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Trạng Thái Cột Page / Group (Bảng 4):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {/* LỰA CHỌN 1: ADMIN ĐÃ THÊM PAGE (MÀU ĐỎ NHÉ - ĐỂ NHÂN VIÊN BIẾT) */}
                  <label
                    className={`flex items-center space-x-1.5 px-2 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      pageStatusOption === 'admin_added_page' ||
                      pageStatusOption === 'pending_page' ||
                      batchNote.toLowerCase().includes('admin đã thêm page') ||
                      batchNote.toLowerCase().includes('cần gán page')
                        ? 'bg-rose-50 border-rose-400 font-bold text-rose-950 shadow-2xs ring-1 ring-rose-300'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-rose-50/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pageStatusRadio"
                      checked={
                        pageStatusOption === 'admin_added_page' ||
                        pageStatusOption === 'pending_page' ||
                        batchNote.toLowerCase().includes('admin đã thêm page') ||
                        batchNote.toLowerCase().includes('cần gán page')
                      }
                      onChange={() => {
                        setPageStatusOption('admin_added_page');
                        if (
                          !batchNote ||
                          batchNote === 'Có page từ đầu' ||
                          batchNote === 'Đã có page' ||
                          batchNote === 'Thêm mới để thêm Group' ||
                          batchNote === 'Admin đã thêm Group' ||
                          batchNote === 'Có Group từ đầu'
                        ) {
                          setBatchNote('Admin đã thêm page');
                        }
                      }}
                      className="w-3.5 h-3.5 text-rose-600 focus:ring-rose-500 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="truncate block font-bold text-rose-700">🔴 Admin đã thêm page</span>
                      <span className="text-[10px] text-rose-600 font-medium block">Màu đỏ để NV biết</span>
                    </div>
                  </label>

                  {/* LỰA CHỌN 2: CÓ PAGE TỪ ĐẦU (MÀU XANH) */}
                  <label
                    className={`flex items-center space-x-1.5 px-2 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      (pageStatusOption === 'has_page' ||
                        batchNote.toLowerCase().includes('có page từ đầu') ||
                        batchNote.toLowerCase().includes('đã có page')) &&
                      !batchNote.toLowerCase().includes('admin đã thêm page') &&
                      !batchNote.toLowerCase().includes('cần gán page')
                        ? 'bg-emerald-50 border-emerald-400 font-bold text-emerald-950 shadow-2xs ring-1 ring-emerald-300'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-emerald-50/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pageStatusRadio"
                      checked={
                        (pageStatusOption === 'has_page' ||
                          batchNote.toLowerCase().includes('có page từ đầu') ||
                          batchNote.toLowerCase().includes('đã có page')) &&
                        !batchNote.toLowerCase().includes('admin đã thêm page') &&
                        !batchNote.toLowerCase().includes('cần gán page')
                      }
                      onChange={() => {
                        setPageStatusOption('has_page');
                        if (
                          !batchNote ||
                          batchNote === 'Admin đã thêm page' ||
                          batchNote === 'Cần gán page' ||
                          batchNote === 'Thêm mới để thêm Group' ||
                          batchNote === 'Admin đã thêm Group' ||
                          batchNote === 'Có Group từ đầu'
                        ) {
                          setBatchNote('Có page từ đầu');
                        }
                      }}
                      className="w-3.5 h-3.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="truncate block font-bold text-emerald-700">🟢 Có page từ đầu</span>
                      <span className="text-[10px] text-emerald-600 font-medium block">Màu xanh có từ đầu</span>
                    </div>
                  </label>

                  {/* LỰA CHỌN 3: THÊM MỚI ĐỂ THÊM GROUP / ADMIN ĐÃ THÊM GROUP */}
                  <label
                    className={`flex items-center space-x-1.5 px-2 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      pageStatusOption === 'admin_added_group' ||
                      batchNote.toLowerCase().includes('thêm mới để thêm group') ||
                      batchNote.toLowerCase().includes('admin đã thêm group') ||
                      batchNote.toLowerCase().includes('cần thêm group')
                        ? 'bg-purple-50 border-purple-400 font-bold text-purple-950 shadow-2xs ring-1 ring-purple-300'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-purple-50/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pageStatusRadio"
                      checked={
                        pageStatusOption === 'admin_added_group' ||
                        batchNote.toLowerCase().includes('thêm mới để thêm group') ||
                        batchNote.toLowerCase().includes('admin đã thêm group') ||
                        batchNote.toLowerCase().includes('cần thêm group')
                      }
                      onChange={() => {
                        setPageStatusOption('admin_added_group');
                        if (
                          !batchNote ||
                          batchNote === 'Admin đã thêm page' ||
                          batchNote === 'Có page từ đầu' ||
                          batchNote === 'Đã có page' ||
                          batchNote === 'Cần gán page' ||
                          batchNote === 'Có Group từ đầu'
                        ) {
                          setBatchNote('Thêm mới để thêm Group');
                        }
                      }}
                      className="w-3.5 h-3.5 text-purple-600 focus:ring-purple-500 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="truncate block font-bold text-purple-700">🟣 Thêm mới để thêm Group</span>
                      <span className="text-[10px] text-purple-600 font-medium block">Ghi chú thêm Group cho NV</span>
                    </div>
                  </label>

                  {/* LỰA CHỌN 4: VIA CHƯA JON GROUP */}
                  <label
                    className={`flex items-center space-x-1.5 px-2 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      pageStatusOption === 'not_joined_group' ||
                      batchNote.toLowerCase().includes('chưa jon group')
                        ? 'bg-orange-50 border-orange-400 font-bold text-orange-950 shadow-2xs ring-1 ring-orange-300'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-orange-50/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pageStatusRadio"
                      checked={
                        pageStatusOption === 'not_joined_group' ||
                        batchNote.toLowerCase().includes('chưa jon group')
                      }
                      onChange={() => {
                        setPageStatusOption('not_joined_group');
                        if (
                          !batchNote ||
                          batchNote === 'Admin đã thêm page' ||
                          batchNote === 'Có page từ đầu' ||
                          batchNote === 'Đã có page' ||
                          batchNote === 'Cần gán page' ||
                          batchNote === 'Thêm mới để thêm Group' ||
                          batchNote === 'Admin đã thêm Group' ||
                          batchNote === 'Có Group từ đầu'
                        ) {
                          setBatchNote('Via chưa Jon Group');
                        }
                      }}
                      className="w-3.5 h-3.5 text-orange-600 focus:ring-orange-500 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="truncate block font-bold text-orange-700">🟠 Via chưa Jon Group</span>
                      <span className="text-[10px] text-orange-600 font-medium block">Chưa Jon Group ({existingGroupViaStats.chuaJonGroup} nick)</span>
                    </div>
                  </label>

                  {/* LỰA CHỌN 5: CHƯA CÓ PAGE / GROUP */}
                  <label
                    className={`flex items-center space-x-1.5 px-2 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      pageStatusOption === 'none' &&
                      !batchNote.toLowerCase().includes('admin đã thêm page') &&
                      !batchNote.toLowerCase().includes('có page từ đầu') &&
                      !batchNote.toLowerCase().includes('đã có page') &&
                      !batchNote.toLowerCase().includes('cần gán page') &&
                      !batchNote.toLowerCase().includes('group')
                        ? 'bg-slate-100 border-slate-400 font-bold text-slate-900 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pageStatusRadio"
                      checked={
                        pageStatusOption === 'none' &&
                        !batchNote.toLowerCase().includes('admin đã thêm page') &&
                        !batchNote.toLowerCase().includes('có page từ đầu') &&
                        !batchNote.toLowerCase().includes('đã có page') &&
                        !batchNote.toLowerCase().includes('cần gán page') &&
                        !batchNote.toLowerCase().includes('group')
                      }
                      onChange={() => {
                        setPageStatusOption('none');
                        if (
                          batchNote === 'Admin đã thêm page' ||
                          batchNote === 'Có page từ đầu' ||
                          batchNote === 'Đã có page' ||
                          batchNote === 'Cần gán page' ||
                          batchNote === 'Thêm mới để thêm Group' ||
                          batchNote === 'Admin đã thêm Group' ||
                          batchNote === 'Có Group từ đầu' ||
                          batchNote === 'Cần thêm Group' ||
                          batchNote === 'Via chưa Jon Group'
                        ) {
                          setBatchNote('');
                        }
                      }}
                      className="w-3.5 h-3.5 text-slate-600 focus:ring-slate-500 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="truncate block font-semibold text-slate-700">⚪ Chưa có Page / Group</span>
                      <span className="text-[10px] text-slate-400 font-normal block">Nick trống chưa gán</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* DUPLICATE HANDLING POLICY */}
            <div className="p-3 bg-white border border-slate-300 rounded-xl space-y-2">
              <label className="font-bold text-slate-800 block flex items-center justify-between">
                <span>Xử Lý Khi Bị Trùng UID:</span>
                {allDuplicateRows.length > 0 && (
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                    Có {distinctDuplicateUids.length} UID trùng
                  </span>
                )}
              </label>

              <div className="space-y-1.5">
                <label
                  className={`flex items-start space-x-2 p-2 rounded-lg border cursor-pointer transition-all ${
                    overwriteDuplicates
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-semibold shadow-2xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="duplicatePolicy"
                    checked={overwriteDuplicates}
                    onChange={() => setOverwriteDuplicates(true)}
                    className="text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 mt-0.5"
                  />
                  <div>
                    <span className="block text-xs font-bold">
                      Bổ sung / Cập nhật thêm 2FA | Mail | Pass cho UID đã có (Khuyên dùng)
                    </span>
                    <span className="block text-[10px] text-slate-500 font-normal">
                      Tự động ghép thêm 2FA, Mail, Pass mới vào các UID đã tồn tại trong bảng mà không làm mất thông tin cũ.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start space-x-2 p-2 rounded-lg border cursor-pointer transition-all ${
                    !overwriteDuplicates
                      ? 'bg-amber-50 border-amber-400 text-amber-950 font-semibold shadow-2xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="duplicatePolicy"
                    checked={!overwriteDuplicates}
                    onChange={() => setOverwriteDuplicates(false)}
                    className="text-amber-600 focus:ring-amber-500 w-3.5 h-3.5 mt-0.5"
                  />
                  <div>
                    <span className="block text-xs font-bold">
                      Bỏ qua UID đã có
                    </span>
                    <span className="block text-[10px] text-slate-500 font-normal">
                      Chỉ thêm các nick hoàn toàn mới chưa có UID trong hệ thống.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* PREVIEW TABLE WITH FILTER TABS */}
          {parsedRows.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                {/* Filter Tabs */}
                <div className="flex items-center flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      previewFilter === 'all'
                        ? 'bg-slate-800 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Tất cả ({parsedRows.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewFilter('new')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ${
                      previewFilter === 'new'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Nick Mới Hợp Lệ ({newValidRows.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewFilter('duplicate')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ${
                      previewFilter === 'duplicate'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : allDuplicateRows.length > 0
                        ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300 font-black'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Trùng UID ({allDuplicateRows.length})</span>
                  </button>

                  {invalidRows.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('invalid')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ${
                        previewFilter === 'invalid'
                          ? 'bg-red-600 text-white shadow-2xs'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Lỗi Định Dạng ({invalidRows.length})</span>
                    </button>
                  )}
                </div>

                <div className="text-[11px] text-slate-500">
                  Hiển thị {filteredDisplayRows.length} dòng
                </div>
              </div>

              {/* Table Container */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs max-h-60 overflow-y-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider sticky top-0 border-b border-slate-200 select-none">
                    <tr>
                      <th className="py-2 px-3 w-12 text-center">Dòng</th>
                      <th className="py-2 px-3 min-w-[140px]">UID Facebook</th>
                      <th className="py-2 px-3 min-w-[120px]">Mật Khẩu (PASS)</th>
                      <th className="py-2 px-3 min-w-[140px]">Mã 2FA</th>
                      <th className="py-2 px-3 min-w-[120px]">Gán Cho NV</th>
                      <th className="py-2 px-3 min-w-[140px]">Trạng Thái Page / Group</th>
                      <th className="py-2 px-3 min-w-[160px]">Kiểm Tra Trùng / Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {filteredDisplayRows.slice(0, 50).map((row) => {
                      const staffAssigned =
                        currentUser?.role === 'staff'
                          ? currentUser.name
                          : assignmentMode === 'auto_detect'
                          ? row.detectedStaff || selectedStaff
                          : assignmentMode === 'round_robin'
                          ? availableStaffNames[(row.index - 1) % availableStaffNames.length]
                          : selectedStaff;

                      const isDup = row.isDuplicateInDb || row.isDuplicateInBatch;

                      return (
                        <tr
                          key={row.index}
                          className={
                            !row.isValid
                              ? 'bg-red-50/90 text-red-900 font-medium'
                              : isDup
                              ? 'bg-amber-50 text-slate-900 hover:bg-amber-100/70'
                              : 'hover:bg-slate-50'
                          }
                        >
                          <td className="py-2 px-3 text-center text-slate-400 font-mono">
                            #{row.index}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold">
                            <span className={isDup ? 'text-amber-900 bg-amber-100 px-1 py-0.5 rounded' : 'text-indigo-900'}>
                              {row.uid || <span className="italic text-red-500">Thiếu UID</span>}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono">
                            {row.pass ? (
                              <span className="text-slate-800 font-semibold">{row.pass}</span>
                            ) : (
                              <span className="text-red-600 italic font-bold">Thiếu PASS</span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-emerald-800 break-all">
                            {row.twoFa || <span className="text-slate-400 italic">Không có</span>}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-800">
                            <div className="flex items-center space-x-1">
                              <span className="text-xs font-bold text-indigo-950">{staffAssigned}</span>
                              {row.detectedStaff && assignmentMode === 'auto_detect' && (
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-full border border-emerald-300">
                                  Tự nhận
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            {pageStatusOption === 'admin_added_group' ||
                            batchNote.toLowerCase().includes('thêm mới để thêm group') ||
                            batchNote.toLowerCase().includes('admin đã thêm group') ||
                            batchNote.toLowerCase().includes('cần thêm group') ? (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-900 font-extrabold rounded-md text-[10px] inline-flex items-center gap-1 border border-purple-300">
                                <span>🟣 Thêm Group</span>
                              </span>
                            ) : pageStatusOption === 'has_group' ||
                              batchNote.toLowerCase().includes('có group từ đầu') ? (
                              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 font-extrabold rounded-md text-[10px] inline-flex items-center gap-1 border border-indigo-300">
                                <span>🔵 Có Group từ đầu</span>
                              </span>
                            ) : pageStatusOption === 'has_page' ||
                              batchNote.toLowerCase().includes('đã có page') ||
                              batchNote.toLowerCase().includes('có page từ đầu') ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold rounded-md text-[10px] inline-flex items-center gap-1 border border-emerald-300">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>📗 Đã có page</span>
                              </span>
                            ) : pageStatusOption === 'admin_added_page' ||
                              pageStatusOption === 'pending_page' ||
                              batchNote.toLowerCase().includes('admin đã thêm page') ||
                              batchNote.toLowerCase().includes('cần gán page') ? (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-extrabold rounded-md text-[10px] inline-flex items-center gap-1 border border-rose-300 animate-pulse">
                                <span>🔴 Admin thêm page</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">⚪ Chưa có Page/Group</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {!row.isValid ? (
                              <span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded-md text-[10px] inline-flex items-center gap-1 border border-red-200">
                                <AlertCircle className="w-3 h-3 text-red-600" />
                                <span>Sai định dạng</span>
                              </span>
                            ) : row.isDuplicateInDb ? (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-bold rounded-md text-[10px] inline-flex items-center gap-1 border border-amber-300">
                                <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                                <span>Trùng DB: {row.duplicateInDb?.staffName}</span>
                              </span>
                            ) : row.isDuplicateInBatch ? (
                              <span className="px-2 py-0.5 bg-orange-100 text-orange-900 font-bold rounded-md text-[10px] inline-flex items-center gap-1 border border-orange-300">
                                <AlertTriangle className="w-3 h-3 text-orange-700 shrink-0" />
                                <span>Lặp dòng #{row.duplicateBatchIndex}</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-md text-[10px] inline-flex items-center gap-1 border border-emerald-300">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>Hợp lệ (Nick mới)</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Clear Action Status */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 flex items-center space-x-2">
            {validRows.length > 0 ? (
              <div>
                <span>
                  Sẽ thêm vào bảng:{' '}
                  <strong className="text-emerald-700 font-extrabold text-sm">
                    {totalEffectiveToImport}
                  </strong>{' '}
                  nick
                </span>
                {allDuplicateRows.length > 0 && (
                  <span className="text-amber-800 ml-2 font-medium">
                    ({!overwriteDuplicates
                      ? `đã bỏ qua ${distinctDuplicateUids.length} nick trùng`
                      : `sẽ ghi đè ${distinctDuplicateUids.length} nick trùng`})
                  </span>
                )}
              </div>
            ) : (
              <span>Vui lòng dán danh sách nick để bắt đầu</span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Đóng / Hủy
            </button>
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={validRows.length === 0 || totalEffectiveToImport === 0}
              className="inline-flex items-center space-x-2 px-5 py-2.5 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:pointer-events-none rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {totalEffectiveToImport > 0
                  ? `Xác Nhận Thêm ${totalEffectiveToImport} Nick Vào Bảng`
                  : 'Không có nick mới nào'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
