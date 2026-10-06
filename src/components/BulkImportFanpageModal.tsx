import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  FileSpreadsheet,
  Download,
  Upload,
  ClipboardCopy,
  Check,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Layers,
  ArrowRight,
  Shield,
  HelpCircle,
} from 'lucide-react';
import {
  PageRecord,
  PageStatus,
  BlockStatus,
  LikeCountStatus,
  PostingMethod,
  InteractionQuality,
  AppUser,
  FullViaItem,
} from '../types';
import {
  downloadFanpageExcelTemplate,
  SAMPLE_FANPAGE_ROWS,
} from '../utils/excelTemplates';
import { getStatusBadgeStyle, getLikeCountBadgeStyle } from '../utils/helpers';

interface BulkImportFanpageModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser;
  availableStaffNames: string[];
  onImportRecords: (newRecords: PageRecord[], syncVias?: FullViaItem[]) => void;
}

interface ParsedImportRow {
  id: string;
  staffName: string;
  viaUid: string;
  fullVia?: string;
  pageName: string;
  pageLink: string;
  status: PageStatus;
  date: string;
  blockStatus: BlockStatus;
  likeCountStatus?: LikeCountStatus;
  postingMethod: PostingMethod;
  postingDate?: string;
  interaction: InteractionQuality;
  interactionDate?: string;
  bmNote: string;
  targetPosts: number;
  actualPosts: number;
  isCompleted: boolean;
  isValid: boolean;
  validationError?: string;
}

export const BulkImportFanpageModal: React.FC<BulkImportFanpageModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  availableStaffNames,
  onImportRecords,
}) => {
  const [importTab, setImportTab] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [isCopiedSample, setIsCopiedSample] = useState(false);
  const [overrideStaff, setOverrideStaff] = useState(
    currentUser.role === 'staff' ? currentUser.name : ''
  );
  const [syncToViaList, setSyncToViaList] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Clean status mapper (chỉ 4 trạng thái chuẩn, bỏ Bình Thường)
  const normalizeStatus = (raw: string): PageStatus => {
    const s = (raw || '').trim().toLowerCase();
    if (s.includes('mất') || s.includes('mat')) return 'Mất Đề Xuất';
    if (s.includes('đình') || s.includes('dinh') || s.includes('chỉ') || s.includes('chi')) return 'Đình Chỉ';
    if (s.includes('back') || s.includes('bị back')) return 'Bị Back';
    return 'Đề Xuất'; // Default safe fallback
  };

  const normalizeBlockStatus = (raw: string): BlockStatus => {
    const s = (raw || '').trim().toLowerCase();
    if (s.includes('vn')) return 'Chặn VN';
    if (s.includes('quyền') || s.includes('quyen')) return 'Chặn Bản Quyền';
    if (s.includes('tế') || s.includes('te')) return 'Chặn Quốc Tế';
    return 'Không Chặn';
  };

  const normalizeLikeCountStatus = (raw: string): LikeCountStatus => {
    const s = (raw || '').trim().toLowerCase();
    if (s.includes('bỏ') || s.includes('bo') || s.includes('tắt') || s.includes('tat') || s.includes('không') || s.includes('khong')) return 'Bỏ Đếm Like';
    return 'Đếm Like';
  };

  const normalizePostingMethod = (raw: string): PostingMethod => {
    const s = (raw || '').trim().toLowerCase();
    if (s.includes('tool')) return 'Tool';
    if (s.includes('hẹn') || s.includes('hen')) return 'Hẹn Giờ';
    return 'Đăng Tay';
  };

  const normalizeInteraction = (raw: string): InteractionQuality => {
    const s = (raw || '').trim().toLowerCase();
    if (s.includes('tốt') || s.includes('tot')) return 'TỐT';
    if (s.includes('mất') || s.includes('mat')) return 'Mất Tương Tác';
    if (s.includes('kém') || s.includes('kem')) return 'Kém';
    return 'Bình Thường';
  };

  // Parse raw matrix into ParsedImportRow array
  const processRawDataMatrix = (matrix: string[][], sourceFileName = '') => {
    setErrorMsg('');
    if (!matrix || matrix.length === 0) {
      setErrorMsg('Không tìm thấy dữ liệu trong file hoặc nội dung dán!');
      return;
    }

    // Filter out completely empty lines
    const nonEmptyRows = matrix.filter((row) =>
      row.some((cell) => cell && cell.toString().trim() !== '')
    );

    if (nonEmptyRows.length === 0) {
      setErrorMsg('Tất cả các dòng đều trống.');
      return;
    }

    // Check if row 0 is header
    const firstRowLower = nonEmptyRows[0].map((c) => (c ? String(c).toLowerCase().trim() : ''));
    const hasHeader = firstRowLower.some(
      (c) =>
        c.includes('tên page') ||
        c.includes('ten page') ||
        c.includes('page') ||
        c.includes('via') ||
        c.includes('tên nv') ||
        c.includes('link')
    );

    let colIndex = {
      staff: -1,
      via: -1,
      pageName: -1,
      pageLink: -1,
      status: -1,
      date: -1,
      block: -1,
      likeCount: -1,
      method: -1,
      interaction: -1,
      interDate: -1,
      bmNote: -1,
      target: -1,
      actual: -1,
      fullVia: -1,
    };

    let dataRows: string[][] = [];

    if (hasHeader) {
      // Map columns from header names
      firstRowLower.forEach((col, idx) => {
        if (col.includes('nv') || col.includes('nhân viên') || col.includes('staff')) colIndex.staff = idx;
        else if (col.includes('via') || col.includes('uid')) colIndex.via = idx;
        else if (col.includes('tên page') || col.includes('ten page') || col.includes('fanpage') || col === 'page') colIndex.pageName = idx;
        else if (col.includes('link') || col.includes('url')) colIndex.pageLink = idx;
        else if (col.includes('trạng thái') || col.includes('status')) colIndex.status = idx;
        else if (col.includes('ngày tt') || col.includes('ngay tt') || col.includes('ngày tương tác')) colIndex.interDate = idx;
        else if (col.includes('ngày') || col.includes('date')) colIndex.date = idx;
        else if (col.includes('đếm like') || col.includes('dem like') || col.includes('like')) colIndex.likeCount = idx;
        else if (col.includes('chặn') || col.includes('block')) colIndex.block = idx;
        else if (col.includes('đăng') || col.includes('tool') || col.includes('method')) colIndex.method = idx;
        else if (col.includes('tương tác') || col.includes('interaction')) colIndex.interaction = idx;
        else if (col.includes('bm') || col.includes('ghi chú') || col.includes('note')) colIndex.bmNote = idx;
        else if (col.includes('chỉ tiêu') || col.includes('target')) colIndex.target = idx;
        else if (col.includes('đã đăng') || col.includes('actual')) colIndex.actual = idx;
        else if (col.includes('full') || col.includes('pass') || col.includes('2fa')) colIndex.fullVia = idx;
      });
      dataRows = nonEmptyRows.slice(1);
    } else {
      // Standard positional mapping if no header detected
      colIndex = {
        staff: 0,
        via: 1,
        pageName: 2,
        pageLink: 3,
        status: 4,
        date: 5,
        block: 6,
        likeCount: -1,
        method: 7,
        interaction: 8,
        interDate: -1,
        bmNote: 9,
        target: 10,
        actual: 11,
        fullVia: 12,
      };
      dataRows = nonEmptyRows;
    }

    // Default column fallbacks if missing
    if (colIndex.pageName === -1 && dataRows[0]?.length >= 3) colIndex.pageName = 2;
    if (colIndex.via === -1 && dataRows[0]?.length >= 2) colIndex.via = 1;
    if (colIndex.pageLink === -1 && dataRows[0]?.length >= 4) colIndex.pageLink = 3;

    const todayStr = `${new Date().getDate()}/${new Date().getMonth() + 1}`;

    let lastStaff = overrideStaff || (currentUser.role === 'staff' ? currentUser.name : availableStaffNames[0] || 'Anh Quỳnh');
    let lastVia = '';
    let lastFullVia = '';

    const parsed: ParsedImportRow[] = dataRows.map((row, idx) => {
      const getVal = (colIdx: number) => (colIdx >= 0 && row[colIdx] ? String(row[colIdx]).trim() : '');

      let rawStaff = getVal(colIndex.staff);
      if (overrideStaff) {
        rawStaff = overrideStaff;
      } else if (rawStaff) {
        lastStaff = rawStaff;
      } else {
        // Inherit from previous row (e.g. merged cell in Excel)
        rawStaff = lastStaff;
      }

      let viaVal = getVal(colIndex.via);
      let fullViaVal = getVal(colIndex.fullVia);

      // If via column contains full via format UID|PASS|2FA
      if (viaVal.includes('|')) {
        fullViaVal = viaVal;
        viaVal = viaVal.split('|')[0].trim();
      }

      if (viaVal) {
        lastVia = viaVal;
        lastFullVia = fullViaVal;
      } else if (lastVia) {
        // Inherit from previous row (merged cell across rows in Excel)
        viaVal = lastVia;
        fullViaVal = lastFullVia;
      }

      const pName = getVal(colIndex.pageName);
      const pLink = getVal(colIndex.pageLink);
      const rawStatus = getVal(colIndex.status);
      const rawDate = getVal(colIndex.date) || todayStr;
      const rawBlock = getVal(colIndex.block);
      const rawLikeCount = getVal(colIndex.likeCount);
      const rawMethod = getVal(colIndex.method);
      const rawInter = getVal(colIndex.interaction);
      const rawInterDate = colIndex.interDate >= 0 ? getVal(colIndex.interDate) : undefined;
      const bmNoteVal = getVal(colIndex.bmNote);

      const targetVal = parseInt(getVal(colIndex.target), 10) || 3;
      const actualVal = parseInt(getVal(colIndex.actual), 10) || 0;

      const isValid = Boolean(pName || pLink || viaVal);
      const validationError = !isValid ? 'Thiếu Tên Page hoặc Link hoặc UID Via' : undefined;

      return {
        id: `import-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        staffName: rawStaff,
        viaUid: viaVal,
        fullVia: fullViaVal,
        pageName: pName || (viaVal ? `Page của Via ${viaVal}` : `Page Mới #${idx + 1}`),
        pageLink: pLink,
        status: normalizeStatus(rawStatus),
        date: rawDate,
        blockStatus: normalizeBlockStatus(rawBlock),
        likeCountStatus: rawLikeCount ? normalizeLikeCountStatus(rawLikeCount) : 'Đếm Like',
        postingMethod: normalizePostingMethod(rawMethod),
        postingDate:
          normalizePostingMethod(rawMethod) === 'Đăng Tay'
            ? rawDate || todayStr
            : undefined,
        interaction: normalizeInteraction(rawInter),
        interactionDate: rawInterDate || rawDate || todayStr,
        bmNote: bmNoteVal,
        targetPosts: targetVal,
        actualPosts: actualVal,
        isCompleted: actualVal >= targetVal && targetVal > 0,
        isValid,
        validationError,
      };
    });

    setParsedRows(parsed.filter((r) => r.isValid));
    if (sourceFileName) setFileName(sourceFileName);
  };

  // Handle File Upload (.xlsx, .xls, .csv)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const matrix: string[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: '',
          raw: false,
        });
        processRawDataMatrix(matrix, file.name);
      } catch (err) {
        console.error('Lỗi khi đọc file Excel:', err);
        setErrorMsg('Không thể đọc file Excel này. Vui lòng kiểm tra lại định dạng file (.xlsx, .xls, .csv)!');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Handle Paste from Excel / Sheets
  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedText.trim()) {
      setErrorMsg('Vui lòng dán dữ liệu từ Excel vào khung bên dưới.');
      return;
    }

    // Split text into lines, then split each line by tab or comma
    const lines = pastedText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const matrix = lines.map((line) => {
      if (line.includes('\t')) {
        return line.split('\t');
      }
      return line.split(',');
    });

    processRawDataMatrix(matrix, 'Dữ liệu dán từ Excel');
  };

  // Copy sample TSV to clipboard
  const handleCopySampleToClipboard = () => {
    const headers = Object.keys(SAMPLE_FANPAGE_ROWS[0]).join('\t');
    const rows = SAMPLE_FANPAGE_ROWS.map((r) => Object.values(r).join('\t')).join('\n');
    const fullText = `${headers}\n${rows}`;

    navigator.clipboard.writeText(fullText).then(() => {
      setIsCopiedSample(true);
      setTimeout(() => setIsCopiedSample(false), 2500);
    });
  };

  // Delete a parsed row from preview
  const handleDeleteRow = (id: string) => {
    setParsedRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Confirm and import
  const handleConfirmImport = () => {
    if (parsedRows.length === 0) return;

    const newRecords: PageRecord[] = parsedRows.map((r) => ({
      id: r.id,
      staffName: overrideStaff || r.staffName,
      viaUid: r.viaUid,
      fullVia: r.fullVia,
      pageName: r.pageName,
      pageLink: r.pageLink,
      status: r.status,
      date: r.date,
      blockStatus: r.blockStatus,
      likeCountStatus: r.likeCountStatus || 'Đếm Like',
      postingMethod: r.postingMethod,
      postingDate: r.postingDate,
      interaction: r.interaction,
      interactionDate: r.interactionDate || r.date || '15/9',
      bmNote: r.bmNote,
      targetPosts: r.targetPosts,
      actualPosts: r.actualPosts,
      isCompleted: r.isCompleted,
    }));

    // Optional sync to Via List if requested
    let syncedVias: FullViaItem[] | undefined = undefined;
    if (syncToViaList) {
      syncedVias = [];
      const seenUids = new Set<string>();

      newRecords.forEach((rec) => {
        const uid = rec.viaUid?.trim();
        if (uid && !seenUids.has(uid)) {
          seenUids.add(uid);
          let pass = '';
          let twoFa = '';
          if (rec.fullVia && rec.fullVia.includes('|')) {
            const parts = rec.fullVia.split('|');
            pass = parts[1]?.trim() || '';
            twoFa = parts[2]?.trim() || '';
          }
          syncedVias?.push({
            id: `via-sync-${uid}`,
            uid,
            pass,
            twoFa,
            staffName: rec.staffName,
            note: `Tự động tạo từ Page ${rec.pageName}`,
          });
        }
      });
    }

    onImportRecords(newRecords, syncedVias);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#2e7d32] text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                Nhập Dữ Liệu Fanpage Từ Excel / Google Sheets
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Hỗ trợ tải file (.xlsx, .xls, .csv) hoặc Copy & Paste trực tiếp từ Excel
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Banner: Download Template & Quick Copy */}
        <div className="bg-emerald-50/60 border-b border-emerald-100 px-6 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-emerald-900 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Chưa có mẫu? Tải file mẫu chuẩn với 4 trạng thái Facebook:</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => downloadFanpageExcelTemplate('xlsx')}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#2e7d32] hover:bg-[#256629] text-white font-bold shadow-2xs transition-colors cursor-pointer"
              title="Tải về file Excel .xlsx chuẩn với đầy đủ các cột và dữ liệu mẫu"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải Mẫu Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={() => downloadFanpageExcelTemplate('csv')}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-300 shadow-2xs transition-colors cursor-pointer"
              title="Tải về file CSV chuẩn"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải Mẫu CSV</span>
            </button>

            <button
              type="button"
              onClick={handleCopySampleToClipboard}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-300 shadow-2xs transition-colors cursor-pointer"
              title="Copy các dòng mẫu để dán thẳng vào trang tính Excel"
            >
              {isCopiedSample ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">Đã Copy Mẫu!</span>
                </>
              ) : (
                <>
                  <ClipboardCopy className="w-3.5 h-3.5 text-slate-600" />
                  <span>Copy Dòng Mẫu</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Method Selection Tabs */}
          <div className="flex items-center space-x-3 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setImportTab('upload')}
              className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                importTab === 'upload'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Cách 1: Tải Lên File Excel (.xlsx, .xls, .csv)</span>
            </button>

            <button
              type="button"
              onClick={() => setImportTab('paste')}
              className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                importTab === 'paste'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ClipboardCopy className="w-4 h-4" />
              <span>Cách 2: Copy & Dán Trực Tiếp Từ Excel / Google Sheets</span>
            </button>
          </div>

          {/* TAB 1: File Upload */}
          {importTab === 'upload' && (
            <div className="space-y-3">
              <label
                htmlFor="excel-file-input"
                className="border-2 border-dashed border-slate-300 hover:border-emerald-600 hover:bg-emerald-50/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-sm font-bold text-slate-800 mb-1">
                  Nhấp để chọn file Excel hoặc kéo thả file vào đây
                </div>
                <div className="text-xs text-slate-500">
                  Hỗ trợ các định dạng: <strong className="text-slate-700">.xlsx, .xls, .csv</strong>
                </div>
                {fileName && (
                  <div className="mt-3 inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-900 font-bold text-xs border border-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Đã nạp file: {fileName}</span>
                  </div>
                )}
                <input
                  id="excel-file-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* TAB 2: Direct Copy & Paste */}
          {importTab === 'paste' && (
            <form onSubmit={handlePasteSubmit} className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Dán vùng dữ liệu copy từ Excel hoặc Google Sheets vào đây:
                  </label>
                  <span className="text-[11px] text-slate-500">
                    (Mẹo: Trong Excel bấm Ctrl+C vùng cần nhập, sau đó bấm Ctrl+V vào ô này)
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder={`TÊN NV\tVia\tTÊN PAGE\tLINK PAGE\tTrạng Thái\tNgày\tCHẶN\tĐĂNG TAY, TOOL\tTƯƠNG TÁC\tGHI CHÚ BM\tChỉ tiêu bài\tĐã đăng
Anh Quỳnh\t100058675316160\tAction Overload Zone\thttps://facebook.com/...\tĐề Xuất\t15/9\tKhông Chặn\tĐăng Tay\tTỐT\tB-BM ANH QUYNH\t3\t3
Bảo\t100072938471920\tHollywood Action Daily\thttps://facebook.com/...\tĐề Xuất\t15/9\tChặn VN\tĐăng Tay\tTỐT\tBM 1 5K+\t3\t2`}
                  className="w-full p-3 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50/50"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#2e7d32] hover:bg-[#256629] shadow-xs cursor-pointer transition-colors"
                >
                  Phân Tích Dữ Liệu Đã Dán
                </button>
              </div>
            </form>
          )}

          {/* Error notice */}
          {errorMsg && (
            <div className="flex items-center space-x-2 p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Import Settings & Roles */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Gán Tên Nhân Viên Cho Dữ Liệu Nhập:
              </label>
              {currentUser.role === 'staff' ? (
                <div className="px-3 py-2 bg-emerald-100/70 border border-emerald-300 rounded-lg text-emerald-900 font-bold flex items-center space-x-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Cố định tài khoản của bạn: {currentUser.name}</span>
                </div>
              ) : (
                <select
                  value={overrideStaff}
                  onChange={(e) => setOverrideStaff(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium"
                >
                  <option value="">Giữ nguyên tên NV theo từng dòng file Excel</option>
                  {availableStaffNames.map((name) => (
                    <option key={name} value={name}>
                      Đổi toàn bộ sang NV: {name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center">
              <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={syncToViaList}
                  onChange={(e) => setSyncToViaList(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-slate-700 font-semibold">
                  Tự động đồng bộ các UID Via này sang <strong>Bảng Quản Lý Nick (Tab 2)</strong> nếu chưa có
                </span>
              </label>
            </div>
          </div>

          {/* Data Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="font-black text-slate-900 text-sm">
                    Xem Trước Dữ Liệu ({parsedRows.length} Fanpage Sẵn Sàng Nhập)
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                    Hợp lệ
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setParsedRows([])}
                  className="text-xs text-rose-600 hover:text-rose-800 underline font-semibold cursor-pointer"
                >
                  Xóa danh sách xem trước
                </button>
              </div>

              <div className="border border-slate-300 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 sticky top-0 border-b border-slate-300 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2 border-r border-slate-300 w-10 text-center">STT</th>
                      <th className="p-2 border-r border-slate-300">TÊN NV</th>
                      <th className="p-2 border-r border-slate-300">Via (UID)</th>
                      <th className="p-2 border-r border-slate-300">TÊN PAGE</th>
                      <th className="p-2 border-r border-slate-300">Trạng Thái</th>
                      <th className="p-2 border-r border-slate-300">CHẶN</th>
                      <th className="p-2 border-r border-slate-300 text-center">ĐẾM LIKE</th>
                      <th className="p-2 border-r border-slate-300">ĐĂNG TAY/TOOL</th>
                      <th className="p-2 border-r border-slate-300">GHI CHÚ BM</th>
                      <th className="p-2 border-r border-slate-300 text-center">Chỉ Tiêu</th>
                      <th className="p-2 text-center w-10">Xóa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {parsedRows.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-2 text-center text-slate-500 border-r border-slate-200">
                          {idx + 1}
                        </td>
                        <td className="p-2 font-bold text-slate-800 border-r border-slate-200">
                          {overrideStaff || row.staffName}
                        </td>
                        <td className="p-2 font-mono text-slate-700 border-r border-slate-200">
                          {row.viaUid || <span className="text-slate-400 italic">Chưa có</span>}
                        </td>
                        <td className="p-2 font-bold text-slate-900 border-r border-slate-200">
                          <div>{row.pageName}</div>
                          {row.pageLink && (
                            <div className="text-[10px] text-blue-600 truncate max-w-xs">
                              {row.pageLink}
                            </div>
                          )}
                        </td>
                        <td className="p-2 text-center border-r border-slate-200 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${getStatusBadgeStyle(
                              row.status
                            )}`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="p-2 border-r border-slate-200 whitespace-nowrap text-slate-700">
                          {row.blockStatus}
                        </td>
                        <td className="p-2 border-r border-slate-200 whitespace-nowrap text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${getLikeCountBadgeStyle(
                              row.likeCountStatus
                            )}`}
                          >
                            {row.likeCountStatus || 'Đếm Like'}
                          </span>
                        </td>
                        <td className="p-2 border-r border-slate-200 whitespace-nowrap text-slate-700">
                          {row.postingMethod}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-slate-600">
                          {row.bmNote || '—'}
                        </td>
                        <td className="p-2 text-center font-bold border-r border-slate-200">
                          {row.actualPosts}/{row.targetPosts}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(row.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                            title="Xóa dòng này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Quick Column Guide */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5">
            <div className="font-bold text-slate-800 flex items-center space-x-1.5">
              <HelpCircle className="w-4 h-4 text-emerald-600" />
              <span>Thứ tự các cột chuẩn trong file Excel:</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed font-mono">
              [Cột A: TÊN NV] → [Cột B: Via (UID)] → [Cột C: TÊN PAGE] → [Cột D: LINK PAGE] → [Cột E: Trạng Thái (Đề Xuất / Mất Đề Xuất / Đình Chỉ / Bị Back)] → [Cột F: Ngày] → [Cột G: CHẶN] → [Cột H: ĐĂNG TAY, TOOL] → [Cột I: TƯƠNG TÁC] → [Cột J: GHI CHÚ BM] → [Cột K: Chỉ tiêu bài] → [Cột L: Đã đăng]
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-slate-50/80 shrink-0">
          <div className="text-xs text-slate-500">
            {parsedRows.length > 0 ? (
              <span>
                Đã sẵn sàng thêm <strong>{parsedRows.length}</strong> Fanpage vào bảng.
              </span>
            ) : (
              <span>Chưa có dữ liệu nào được nạp.</span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Hủy
            </button>

            <button
              type="button"
              disabled={parsedRows.length === 0}
              onClick={handleConfirmImport}
              className={`inline-flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-all ${
                parsedRows.length > 0
                  ? 'bg-[#2e7d32] hover:bg-[#256629] cursor-pointer'
                  : 'bg-slate-300 cursor-not-allowed text-slate-500'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>Xác Nhận Nhập {parsedRows.length > 0 ? `${parsedRows.length} Fanpage` : ''}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
