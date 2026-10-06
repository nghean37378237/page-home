import React, { useState } from 'react';
import {
  X,
  Network,
  Download,
  Upload,
  AlertCircle,
  CheckCircle2,
  Users,
  Sparkles,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ProxyItem, ProxyProtocol, AppUser } from '../types';
import { downloadProxyExcelTemplate } from '../utils/excelTemplates';

interface BulkImportProxyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (proxies: ProxyItem[]) => Promise<void>;
  currentUser: AppUser;
  availableStaffNames: string[];
}

export const BulkImportProxyModal: React.FC<BulkImportProxyModalProps> = ({
  isOpen,
  onClose,
  onImport,
  currentUser,
  availableStaffNames,
}) => {
  const isAdmin = currentUser.role === 'admin';

  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  const [pastedText, setPastedText] = useState('');
  const [defaultStaff, setDefaultStaff] = useState<string>(isAdmin ? 'ALL' : currentUser.name);
  const [defaultProtocol, setDefaultProtocol] = useState<ProxyProtocol>('HTTP');
  const [defaultProvider, setDefaultProvider] = useState('Proxy Dân Cư');
  const [parsedProxies, setParsedProxies] = useState<ProxyItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const parseRawLinesToProxies = (lines: string[]): ProxyItem[] => {
    const list: ProxyItem[] = [];
    const effectiveStaff = isAdmin ? (defaultStaff === 'ALL' ? ['ALL'] : [defaultStaff]) : [currentUser.name];

    lines.forEach((line, idx) => {
      let trimmed = line.trim();
      if (!trimmed) return;

      let protocol: ProxyProtocol = defaultProtocol;
      if (trimmed.startsWith('socks5://')) {
        protocol = 'SOCKS5';
        trimmed = trimmed.replace('socks5://', '');
      } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        protocol = 'HTTP';
        trimmed = trimmed.replace(/^https?:\/\//, '');
      }

      // Check tab separation vs colon separation
      let ip = '';
      let port = '';
      let user = '';
      let pass = '';
      let note = '';
      let loc = 'VN';

      if (trimmed.includes('\t')) {
        const parts = trimmed.split('\t').map((p) => p.trim());
        ip = parts[0] || '';
        port = parts[1] || '';
        user = parts[2] || '';
        pass = parts[3] || '';
        if (parts[4]) protocol = parts[4].toUpperCase().includes('SOCKS') ? 'SOCKS5' : 'HTTP';
        if (parts[5]) loc = parts[5].toUpperCase();
        if (parts[6]) note = parts[6];
      } else {
        const parts = trimmed.split(/[:|]/).map((p) => p.trim());
        ip = parts[0] || '';
        port = parts[1] || '';
        user = parts[2] || '';
        pass = parts[3] || '';
      }

      if (ip && port) {
        const fullProxy = user && pass ? `${ip}:${port}:${user}:${pass}` : `${ip}:${port}`;
        list.push({
          id: `proxy-import-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
          ip,
          port,
          username: user,
          password: pass,
          protocol,
          fullProxy,
          location: loc,
          provider: defaultProvider,
          assignedStaff: effectiveStaff,
          assignedViaUids: [],
          status: 'active',
          expireDate: '30/11/2026',
          note,
          isRotating: false,
          lastChecked: new Date().toLocaleDateString('vi-VN'),
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
      setErrorMessage('Vui lòng dán danh sách proxy vào ô bên dưới.');
      return;
    }

    const lines = pastedText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const parsed = parseRawLinesToProxies(lines);

    if (parsed.length === 0) {
      setErrorMessage('Không nhận diện được định dạng proxy. Vui lòng nhập dạng IP:PORT:USER:PASS hoặc IP:PORT.');
      return;
    }

    setParsedProxies(parsed);
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
          setErrorMessage('File Excel trống hoặc không có sheet hợp lệ.');
          return;
        }

        const effectiveStaff = isAdmin ? (defaultStaff === 'ALL' ? ['ALL'] : [defaultStaff]) : [currentUser.name];
        const list: ProxyItem[] = [];

        data.forEach((row: any, idx: number) => {
          const ip = (row['IP'] || row['ip'] || row['Host'] || '').toString().trim();
          const port = (row['PORT'] || row['port'] || row['Port'] || '').toString().trim();
          const user = (row['USER'] || row['user'] || row['Username'] || '').toString().trim();
          const pass = (row['PASS'] || row['pass'] || row['Password'] || '').toString().trim();
          const rawProto = (row['GIAO THỨC'] || row['Protocol'] || '').toString().toUpperCase();
          const proto: ProxyProtocol = rawProto.includes('SOCKS') ? 'SOCKS5' : 'HTTP';
          const loc = (row['QUỐC GIA'] || row['Location'] || 'VN').toString().trim().toUpperCase();
          const prov = (row['NHÀ CUNG CẤP'] || row['Provider'] || defaultProvider).toString().trim();
          const rawStaff = (row['NHÂN VIÊN'] || row['Staff'] || '').toString().trim();
          // Chỉ nhận nhân viên nếu có sẵn trong danh sách CSDL (availableStaffNames), không tạo mới
          const matchedStaff = availableStaffNames.find(
            (s) => s.trim().toLowerCase() === rawStaff.toLowerCase()
          );
          const staffArr = matchedStaff
            ? [matchedStaff]
            : rawStaff.toUpperCase() === 'ALL'
            ? ['ALL']
            : effectiveStaff;
          const note = (row['GHI CHÚ'] || row['Note'] || '').toString().trim();
          const expire = (row['HẠN DÙNG'] || row['Expire'] || '30/11/2026').toString().trim();

          if (ip && port) {
            const fullProxy = user && pass ? `${ip}:${port}:${user}:${pass}` : `${ip}:${port}`;
            list.push({
              id: `proxy-import-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
              ip,
              port,
              username: user,
              password: pass,
              protocol: proto,
              fullProxy,
              location: loc,
              provider: prov,
              assignedStaff: staffArr,
              assignedViaUids: [],
              status: 'active',
              expireDate: expire,
              note,
              isRotating: false,
              lastChecked: new Date().toLocaleDateString('vi-VN'),
              createdAt: new Date().toLocaleDateString('vi-VN'),
              updatedAt: new Date().toLocaleDateString('vi-VN'),
            });
          }
        });

        if (list.length === 0) {
          setErrorMessage('Không tìm thấy cột IP và Port trong file Excel.');
          return;
        }

        setParsedProxies(list);
      } catch (err: any) {
        console.error('Lỗi file excel:', err);
        setErrorMessage('Lỗi khi đọc file: ' + (err.message || ''));
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleCommit = async () => {
    if (parsedProxies.length === 0) return;
    setIsSubmitting(true);
    try {
      await onImport(parsedProxies);
      onClose();
    } catch (err: any) {
      console.error('Lỗi import:', err);
      setErrorMessage(err.message || 'Không thể lưu danh sách proxy vào Firestore.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Import Hàng Loạt Danh Sách Proxy</h2>
              <p className="text-xs text-blue-100">
                Thêm nhanh hàng chục hoặc hàng trăm proxy dạng IP:PORT:USER:PASS hoặc từ file Excel
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

        {/* Tabs & Template Download */}
        <div className="bg-slate-100 px-6 py-3 flex flex-wrap items-center justify-between border-b border-slate-200 gap-2">
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('text');
                setParsedProxies([]);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'text'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dán Dữ Liệu Text
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('file');
                setParsedProxies([]);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'file'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tải Lên File Excel (.xlsx)
            </button>
          </div>

          <button
            type="button"
            onClick={downloadProxyExcelTemplate}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold bg-white text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-50 transition-colors shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Tải Mẫu Excel Proxy</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Quick Config */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {isAdmin && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Gán Cho Nhân Viên (Có sẵn trong CSDL):
                </label>
                <select
                  value={defaultStaff}
                  onChange={(e) => setDefaultStaff(e.target.value)}
                  className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg p-2"
                >
                  <option value="ALL">🌐 Dùng Chung (ALL)</option>
                  {availableStaffNames.map((s) => (
                    <option key={s} value={s}>
                      👤 {s} (CSDL)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Giao Thức Mặc Định:
              </label>
              <select
                value={defaultProtocol}
                onChange={(e) => setDefaultProtocol(e.target.value as ProxyProtocol)}
                className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg p-2"
              >
                <option value="HTTP">HTTP</option>
                <option value="HTTPS">HTTPS</option>
                <option value="SOCKS5">SOCKS5</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nhà Cung Cấp / Loại:
              </label>
              <input
                type="text"
                value={defaultProvider}
                onChange={(e) => setDefaultProvider(e.target.value)}
                placeholder="VD: Viettel, TMProxy..."
                className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg p-2"
              />
            </div>
          </div>

          {activeTab === 'text' ? (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Dán danh sách Proxy (Mỗi dòng 1 Proxy):
              </label>
              <p className="text-[11px] text-slate-500">
                Định dạng hỗ trợ: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px]">IP:PORT:USER:PASS</code> hoặc <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px]">IP:PORT</code>
              </p>
              <textarea
                rows={6}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="103.145.22.10:8080:user01:pass01&#10;103.152.118.45:9080:user02:pass02&#10;154.213.189.70:1080:us_user:pass03"
                className="w-full p-3 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleParseText}
                className="px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
              >
                Trích Xuất Proxy
              </button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center space-y-3 bg-slate-50">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Chọn file Excel (.xlsx, .csv) chứa danh sách Proxy
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Cần có các cột: IP, PORT, USER, PASS, GIAO THỨC, QUỐC GIA...
                </p>
              </div>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white file:cursor-pointer"
              />
            </div>
          )}

          {/* Preview Table */}
          {parsedProxies.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Đã nhận diện: {parsedProxies.length} Proxy hợp lệ</span>
                </span>
                <button
                  type="button"
                  onClick={() => setParsedProxies([])}
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
                      <th className="p-2 font-mono">IP:PORT</th>
                      <th className="p-2 font-mono">USER:PASS</th>
                      <th className="p-2">Giao Thức</th>
                      <th className="p-2">Quốc Gia</th>
                      <th className="p-2">Nhân Viên</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700 font-medium">
                    {parsedProxies.map((p, i) => (
                      <tr key={p.id || i} className="hover:bg-slate-50">
                        <td className="p-2 text-center text-slate-500">{i + 1}</td>
                        <td className="p-2 font-mono font-bold text-blue-700">
                          {p.ip}:{p.port}
                        </td>
                        <td className="p-2 font-mono text-slate-600">
                          {p.username && p.password ? `${p.username}:***` : '-'}
                        </td>
                        <td className="p-2 font-bold">{p.protocol}</td>
                        <td className="p-2 font-bold">{p.location || 'VN'}</td>
                        <td className="p-2 font-bold text-blue-800">
                          {p.assignedStaff.join(', ')}
                        </td>
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
            disabled={parsedProxies.length === 0 || isSubmitting}
            onClick={handleCommit}
            className="inline-flex items-center space-x-1.5 px-6 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Đang lưu vào Cloud...'
                : `Xác Nhận Lưu ${parsedProxies.length} Proxy Vào Cloud`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
