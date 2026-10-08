import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  Upload,
  AlertCircle,
  CheckCircle2,
  Users,
  Sparkles,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { GroupRecord, AppUser, GroupJoinStatus, GroupInteractionStatus } from '../types';
import { downloadGroupExcelTemplate } from '../utils/excelTemplates';
import { GROUP_NOTE_CHOICES } from './AddEditGroupModal';

interface BulkImportGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (records: GroupRecord[]) => Promise<void>;
  currentUser: AppUser;
  availableStaffNames: string[];
}

export const BulkImportGroupModal: React.FC<BulkImportGroupModalProps> = ({
  isOpen,
  onClose,
  onImport,
  currentUser,
  availableStaffNames,
}) => {
  const isAdmin = currentUser.role === 'admin';

  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  const [pastedText, setPastedText] = useState('');
  const [defaultNote, setDefaultNote] = useState('');
  const [selectedStaff, setSelectedStaff] = useState(
    isAdmin ? (availableStaffNames[0] || 'Anh Quỳnh') : currentUser.name
  );
  const [parsedRecords, setParsedRecords] = useState<GroupRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Parser helper
  const parseRowsToRecords = (rows: any[]): GroupRecord[] => {
    const list: GroupRecord[] = [];
    const effectiveStaff = isAdmin ? selectedStaff : currentUser.name;

    rows.forEach((row, idx) => {
      // Handle both object (from XLSX) or array (from TSV/text split)
      let uid = '';
      let viaName = '';
      let groupLink = '';
      let groupName = '';
      let note = '';
      let isHighlighted = false;
      let rowStaff = effectiveStaff;

      if (Array.isArray(row)) {
        // [UID, Tên Via, Link Group, Tên Nhóm, Ghi Chú, Via Chính, Staff]
        uid = (row[0] || '').toString().trim();
        viaName = (row[1] || '').toString().trim();
        groupLink = (row[2] || '').toString().trim();
        groupName = (row[3] || '').toString().trim();
        note = (row[4] || '').toString().trim();
        const highlightRaw = (row[5] || '').toString().toLowerCase();
        isHighlighted = highlightRaw.includes('có') || highlightRaw.includes('true') || highlightRaw.includes('chính') || note.toLowerCase().includes('vhh');
        if (isAdmin && row[6]) {
          rowStaff = row[6].toString().trim();
        }
      } else {
        // Object keys
        uid = (row['UID VIA'] || row['UID'] || row['uid'] || row['Via (UID)'] || '').toString().trim();
        viaName = (row['TÊN VIA'] || row['Via Name'] || row['Tên Via'] || row['viaName'] || '').toString().trim();
        groupLink = (row['LINK GROUP'] || row['Link Group'] || row['GROUP'] || row['groupLink'] || '').toString().trim();
        groupName = (row['TÊN NHÓM'] || row['NHÓM'] || row['Group Name'] || row['groupName'] || '').toString().trim();
        note = (row['GHI CHÚ'] || row['Ghi Chú'] || row['note'] || row['Note'] || '').toString().trim();
        const hl = (row['VIA CHÍNH'] || row['Via Chính'] || row['isHighlighted'] || '').toString().toLowerCase();
        isHighlighted = hl.includes('có') || hl.includes('true') || hl.includes('1') || note.toLowerCase().includes('vhh');
        if (isAdmin && (row['NHÂN VIÊN'] || row['TÊN NV'] || row['staffName'])) {
          rowStaff = (row['NHÂN VIÊN'] || row['TÊN NV'] || row['staffName']).toString().trim();
        }
      }

      // Parse Trạng Thái: Đã Jon, Jon chờ duyệt, Chưa
      let joinStatus: GroupJoinStatus = 'Chưa';
      const rawStatus = (
        row['TRẠNG THÁI'] ||
        row['Trạng Thái'] ||
        row['trạng thái'] ||
        row['status'] ||
        row['joinStatus'] ||
        ''
      )
        .toString()
        .trim()
        .toLowerCase();

      if (rawStatus.includes('đã') || rawStatus === 'đã jon' || rawStatus === 'đã join') {
        joinStatus = 'Đã Jon';
      } else if (rawStatus.includes('chờ') || rawStatus.includes('duyệt') || rawStatus === 'jon chờ duyệt') {
        joinStatus = 'Jon chờ duyệt';
      } else if (rawStatus.includes('chưa')) {
        joinStatus = 'Chưa';
      }

      // Parse Mức Tương Tác
      let interactionStatus: GroupInteractionStatus | undefined = undefined;
      const rawInteraction = (
        (row as any)['MỨC TƯƠNG TÁC'] ||
        (row as any)['TƯƠNG TÁC'] ||
        (row as any)['Mức Tương Tác'] ||
        (row as any)['Tương Tác'] ||
        (row as any)['interactionStatus'] ||
        (row as any)['interaction'] ||
        ''
      )
        .toString()
        .trim()
        .toLowerCase();

      if (rawInteraction.includes('ổn') || rawInteraction.includes('tốt') || rawInteraction === 'tương tác ổn') {
        interactionStatus = 'Tương tác ổn';
      } else if (rawInteraction.includes('vừa') || rawInteraction.includes('bình thường') || rawInteraction === 'tương tác vừa') {
        interactionStatus = 'Tương tác vừa';
      } else if (rawInteraction.includes('không') || rawInteraction.includes('kém') || rawInteraction === 'không có tương tác') {
        interactionStatus = 'Không có tương tác';
      }

      // If groupName is missing but groupLink exists, formulate default groupName
      if (!groupName && groupLink) {
        groupName = 'Nhóm Facebook';
      }

      if (!note && defaultNote) {
        note = defaultNote;
      }

      if (uid) {
        list.push({
          id: `grp-row-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
          groupId: groupName ? `group-${groupName.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : `group-${Date.now()}`,
          groupName: groupName || 'Nhóm Facebook ✅',
          groupLink: groupLink || 'https://www.facebook.com/groups/',
          uid,
          viaName: viaName || `Via ${uid.slice(-4)}`,
          joinStatus,
          interactionStatus,
          note,
          isHighlighted,
          staffName: rowStaff,
          createdAt: new Date().toLocaleDateString('vi-VN'),
          updatedAt: new Date().toLocaleDateString('vi-VN'),
        });
      }
    });

    return list;
  };

  const handleParseText = () => {
    setErrorMessage(null);
    if (!pastedText.trim()) {
      setErrorMessage('Vui lòng dán dữ liệu vào ô trước.');
      return;
    }

    const lines = pastedText.split('\n').filter((l) => l.trim().length > 0);
    const rows = lines.map((line) => {
      if (line.includes('\t')) return line.split('\t');
      if (line.includes('|')) return line.split('|');
      return line.split(/\s+/);
    });

    const records = parseRowsToRecords(rows);
    if (records.length === 0) {
      setErrorMessage('Không trích xuất được UID nào. Vui lòng kiểm tra định dạng.');
      return;
    }

    setParsedRecords(records);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (!data || data.length === 0) {
          setErrorMessage('File Excel trống hoặc không đọc được sheet.');
          return;
        }

        const records = parseRowsToRecords(data);
        if (records.length === 0) {
          setErrorMessage('Không tìm thấy cột UID trong file Excel.');
          return;
        }

        setParsedRecords(records);
      } catch (err: any) {
        console.error('Lỗi đọc file Excel:', err);
        setErrorMessage('Lỗi khi đọc file Excel: ' + (err.message || ''));
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleCommitImport = async () => {
    if (parsedRecords.length === 0) return;
    setIsSubmitting(true);
    try {
      await onImport(parsedRecords);
      onClose();
    } catch (err: any) {
      console.error('Lỗi import:', err);
      setErrorMessage(err.message || 'Lỗi khi nhập dữ liệu vào Firestore.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Import Hàng Loạt Dữ Liệu Group Facebook</h2>
              <p className="text-xs text-red-100">
                Thêm danh sách nhóm và các nick Via nhanh chóng từ Excel hoặc Google Sheets
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

        {/* Tabs & Template Download */}
        <div className="bg-slate-100 px-6 py-3 flex flex-wrap items-center justify-between border-b border-slate-200 gap-2">
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('text');
                setParsedRecords([]);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'text'
                  ? 'bg-white text-red-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dán Dữ Liệu Copy-Paste
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('file');
                setParsedRecords([]);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'file'
                  ? 'bg-white text-red-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tải Lên File Excel (.xlsx)
            </button>
          </div>

          <button
            type="button"
            onClick={downloadGroupExcelTemplate}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold bg-white text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-50 transition-colors shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Tải File Excel Mẫu Group</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Staff selection for Admin */}
          {isAdmin && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Gán mặc định cho nhân viên:</span>
              </label>
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                className="text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-slate-800"
              >
                {availableStaffNames.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Lựa chọn ghi chú mặc định: VHH, 282, 956, Hạn Chế */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Ghi chú mặc định (nếu dòng trống):</span>
              {defaultNote && (
                <button
                  type="button"
                  onClick={() => setDefaultNote('')}
                  className="text-[11px] text-red-600 hover:underline cursor-pointer"
                >
                  Bỏ chọn
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {GROUP_NOTE_CHOICES.map((choice) => {
                const isSelected = defaultNote === choice.key;
                return (
                  <button
                    key={choice.key}
                    type="button"
                    onClick={() => setDefaultNote(isSelected ? '' : choice.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                      isSelected ? choice.activeColor : choice.color
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : choice.dot}`}></span>
                    <span>{choice.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {activeTab === 'text' ? (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Dán các dòng từ Google Sheets / Excel:
              </label>
              <p className="text-[11px] text-slate-500">
                Hỗ trợ định dạng: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px]">UID | Tên Via | Link Group | Tên Nhóm | Ghi Chú</code>
              </p>
              <textarea
                rows={6}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="100060665184656	Lucas Santos	https://www.facebook.com/groups/289880638621489	Beautifull World ✅	&#10;100023228976334	Tolga Yagmur	https://www.facebook.com/groups/289880638621489	Beautifull World ✅	vhh"
                className="w-full p-3 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <button
                type="button"
                onClick={handleParseText}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-2xs cursor-pointer"
              >
                Trích Xuất Dữ Liệu
              </button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center space-y-3 bg-slate-50">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Chọn file Excel (.xlsx, .csv) chứa danh sách Group
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Đảm bảo có các cột: UID, Tên Via, Link Group, Tên Nhóm, Ghi Chú
                </p>
              </div>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-red-600 file:text-white file:cursor-pointer"
              />
            </div>
          )}

          {/* Preview Table */}
          {parsedRecords.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Đã nhận diện: {parsedRecords.length} dòng Group</span>
                </span>
                <button
                  type="button"
                  onClick={() => setParsedRecords([])}
                  className="text-xs text-red-600 hover:underline cursor-pointer"
                >
                  Xóa xem trước
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 sticky top-0 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2 w-10 text-center">STT</th>
                      <th className="p-2">UID</th>
                      <th className="p-2">Tên Via</th>
                      <th className="p-2">Tên Nhóm (Cột E)</th>
                      <th className="p-2">Ghi Chú</th>
                      <th className="p-2">Via Chính</th>
                      <th className="p-2">Nhân Viên</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700 font-medium">
                    {parsedRecords.map((r, i) => (
                      <tr key={r.id || i} className={r.isHighlighted ? 'bg-emerald-50' : 'bg-white'}>
                        <td className="p-2 text-center text-slate-500">{i + 1}</td>
                        <td className="p-2 font-mono text-indigo-700 font-bold">{r.uid}</td>
                        <td className="p-2 font-semibold">{r.viaName}</td>
                        <td className="p-2 font-bold text-red-700">{r.groupName}</td>
                        <td className="p-2 text-slate-600">{r.note || '-'}</td>
                        <td className="p-2">
                          {r.isHighlighted ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Có
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-2 font-bold text-blue-700">{r.staffName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-4 flex items-center justify-between border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={parsedRecords.length === 0 || isSubmitting}
            onClick={handleCommitImport}
            className="inline-flex items-center space-x-1.5 px-6 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Đang lưu vào Cloud...'
                : `Xác Nhận Lưu ${parsedRecords.length} Dòng Vào Cloud`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
