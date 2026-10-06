import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Network,
  ShieldCheck,
  AlertCircle,
  Globe,
  Tag,
  KeyRound,
  RefreshCw,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { ProxyItem, ProxyProtocol, ProxyStatus, AppUser } from '../types';

interface AddEditProxyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (proxy: ProxyItem) => Promise<void>;
  initialProxy?: ProxyItem | null;
  currentUser: AppUser;
  availableStaffNames: string[];
}

export const AddEditProxyModal: React.FC<AddEditProxyModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialProxy,
  currentUser,
  availableStaffNames,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const isEditing = Boolean(initialProxy);

  // Raw input parser helper
  const [rawProxyInput, setRawProxyInput] = useState('');

  // Form fields
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('8080');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [protocol, setProtocol] = useState<ProxyProtocol>('HTTP');
  const [location, setLocation] = useState('VN');
  const [provider, setProvider] = useState('Viettel Dân Cư');
  const [status, setStatus] = useState<ProxyStatus>('active');
  const [expireDate, setExpireDate] = useState('');
  const [note, setNote] = useState('');
  const [isRotating, setIsRotating] = useState(false);
  const [rotateUrl, setRotateUrl] = useState('');

  // Staff assignment
  const [isAllStaff, setIsAllStaff] = useState(true);
  const [assignedStaffList, setAssignedStaffList] = useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state on open
  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      setRawProxyInput('');
      return;
    }

    if (initialProxy) {
      setIp(initialProxy.ip || '');
      setPort(initialProxy.port || '8080');
      setUsername(initialProxy.username || '');
      setPassword(initialProxy.password || '');
      setProtocol(initialProxy.protocol || 'HTTP');
      setLocation(initialProxy.location || 'VN');
      setProvider(initialProxy.provider || '');
      setStatus(initialProxy.status || 'active');
      setExpireDate(initialProxy.expireDate || '');
      setNote(initialProxy.note || '');
      setIsRotating(Boolean(initialProxy.isRotating));
      setRotateUrl(initialProxy.rotateUrl || '');

      const isAll = (initialProxy.assignedStaff || []).includes('ALL');
      setIsAllStaff(isAll);
      setAssignedStaffList(isAll ? [] : initialProxy.assignedStaff || []);
    } else {
      setIp('');
      setPort('8080');
      setUsername('');
      setPassword('');
      setProtocol('HTTP');
      setLocation('VN');
      setProvider('Dân Cư Tĩnh');
      setStatus('active');
      setExpireDate('30/11/2026');
      setNote('');
      setIsRotating(false);
      setRotateUrl('');

      if (isAdmin) {
        setIsAllStaff(true);
        setAssignedStaffList([]);
      } else {
        setIsAllStaff(false);
        setAssignedStaffList([currentUser.name]);
      }
    }
    setErrorMessage(null);
  }, [isOpen, initialProxy, isAdmin, currentUser.name]);

  if (!isOpen) return null;

  // Auto-parse raw string like: 103.145.22.10:8080:user:pass or 103.145.22.10:8080
  const handleParseRawString = (val: string) => {
    setRawProxyInput(val);
    const trimmed = val.trim();
    if (!trimmed) return;

    let clean = trimmed;
    if (clean.startsWith('socks5://')) {
      setProtocol('SOCKS5');
      clean = clean.replace('socks5://', '');
    } else if (clean.startsWith('http://') || clean.startsWith('https://')) {
      setProtocol('HTTP');
      clean = clean.replace(/^https?:\/\//, '');
    }

    const parts = clean.split(/[:|]/).map((p) => p.trim());
    if (parts.length >= 2) {
      setIp(parts[0]);
      setPort(parts[1]);
      if (parts[2]) setUsername(parts[2]);
      if (parts[3]) setPassword(parts[3]);
    }
  };

  const handleToggleStaff = (staffName: string) => {
    setAssignedStaffList((prev) => {
      if (prev.includes(staffName)) {
        return prev.filter((s) => s !== staffName);
      } else {
        return [...prev, staffName];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanIp = ip.trim();
    const cleanPort = port.trim();

    if (!cleanIp || !cleanPort) {
      setErrorMessage('Vui lòng nhập IP và Port hợp lệ.');
      return;
    }

    let finalStaff: string[] = [];
    if (!isAdmin) {
      finalStaff = [currentUser.name];
    } else if (isAllStaff) {
      finalStaff = ['ALL'];
    } else {
      // Chỉ lấy nhân viên có sẵn trong CSDL (availableStaffNames), không tạo mới
      const validStaff = assignedStaffList.filter((s) => availableStaffNames.includes(s));
      finalStaff = validStaff.length > 0 ? validStaff : ['ALL'];
    }

    // Build standard full proxy string
    const cleanUser = username.trim();
    const cleanPass = password.trim();
    const fullProxy = cleanUser && cleanPass
      ? `${cleanIp}:${cleanPort}:${cleanUser}:${cleanPass}`
      : `${cleanIp}:${cleanPort}`;

    setIsSubmitting(true);
    try {
      const proxyToSave: ProxyItem = {
        id: initialProxy?.id || `proxy-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        ip: cleanIp,
        port: cleanPort,
        username: cleanUser,
        password: cleanPass,
        protocol,
        fullProxy,
        location: location.trim().toUpperCase() || 'VN',
        provider: provider.trim(),
        assignedStaff: finalStaff,
        assignedViaUids: initialProxy?.assignedViaUids || [],
        status,
        expireDate: expireDate.trim(),
        note: note.trim(),
        isRotating,
        rotateUrl: rotateUrl.trim(),
        lastChecked: new Date().toLocaleDateString('vi-VN'),
        createdAt: initialProxy?.createdAt || new Date().toLocaleDateString('vi-VN'),
        updatedAt: new Date().toLocaleDateString('vi-VN'),
      };

      await onSave(proxyToSave);
      onClose();
    } catch (err: any) {
      console.error('Lỗi lưu proxy:', err);
      setErrorMessage(err.message || 'Không thể lưu proxy vào Cloud Firestore.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white font-bold">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {isEditing ? 'Chỉnh Sửa Thông Tin Proxy' : 'Thêm Proxy Mới Vào Hệ Thống'}
              </h2>
              <p className="text-xs text-blue-100">
                Quản lý IP, Port, User, Pass và phân công nhân viên sử dụng
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Quick Paste Raw String */}
          <div className="bg-blue-50/80 p-3.5 rounded-xl border border-blue-200 space-y-1.5">
            <label className="text-xs font-bold text-blue-900 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Dán Nhanh Chuỗi Proxy (Tự động điền các ô):</span>
            </label>
            <input
              type="text"
              placeholder="VD: 103.145.22.10:8080:user:pass hoặc 103.145.22.10:8080"
              value={rawProxyInput}
              onChange={(e) => handleParseRawString(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-blue-800"
            />
          </div>

          {/* IP & Port */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Địa Chỉ IP / Host <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="VD: 103.145.22.10"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono font-bold text-slate-800 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Port <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="VD: 8080"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono font-bold text-slate-800 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* User & Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tài Khoản Xác Thực (User - nếu có)
              </label>
              <input
                type="text"
                placeholder="VD: user_mmo_01"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mật Khẩu (Pass - nếu có)
              </label>
              <input
                type="text"
                placeholder="VD: ProxyPass2026@"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Protocol, Location, Provider */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Giao Thức
              </label>
              <select
                value={protocol}
                onChange={(e) => setProtocol(e.target.value as ProxyProtocol)}
                className="w-full px-2.5 py-2 text-xs font-bold border border-slate-300 rounded-lg bg-white"
              >
                <option value="HTTP">HTTP</option>
                <option value="HTTPS">HTTPS</option>
                <option value="SOCKS5">SOCKS5</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quốc Gia / Vị Trí
              </label>
              <input
                type="text"
                placeholder="VN, US, SG..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold text-slate-800 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nhà Cung Cấp
              </label>
              <input
                type="text"
                placeholder="Viettel, TMProxy..."
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Status & Expire Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Trạng Thái Kết Nối
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProxyStatus)}
                className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-lg bg-white"
              >
                <option value="active">🟢 Hoạt Động (Live)</option>
                <option value="die">🔴 Lỗi / Chết (Die)</option>
                <option value="expired">⚠️ Hết Hạn (Expired)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ngày Hết Hạn
              </label>
              <input
                type="text"
                placeholder="VD: 30/10/2026"
                value={expireDate}
                onChange={(e) => setExpireDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Rotating Proxy Option */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div
              onClick={() => setIsRotating(!isRotating)}
              className="flex items-center space-x-2.5 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={isRotating}
                onChange={(e) => setIsRotating(e.target.checked)}
                className="w-4 h-4 rounded-sm text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-800">
                Đây là Proxy Xoay Đổi IP (Rotating Proxy)
              </span>
            </div>

            {isRotating && (
              <div className="pt-1">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Link API Đổi IP (URL Rotate):
                </label>
                <input
                  type="url"
                  placeholder="https://tmproxy.com/api/proxy/get-new-proxy?api_key=..."
                  value={rotateUrl}
                  onChange={(e) => setRotateUrl(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
            )}
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ghi Chú
            </label>
            <input
              type="text"
              placeholder="VD: Nuôi dàn via chính, proxy sạch không dính checkpoint..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          {/* Phân công nhân viên */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Phân Công Cho Nhân Viên Sử Dụng</span>
              </span>
              {!isAdmin && (
                <span className="text-[11px] text-emerald-600 font-bold">
                  (Khóa theo tài khoản {currentUser.name})
                </span>
              )}
            </label>

            {isAdmin ? (
              <div className="space-y-2">
                <div
                  onClick={() => {
                    setIsAllStaff(true);
                    setAssignedStaffList([]);
                  }}
                  className={`p-2.5 rounded-lg border flex items-center space-x-2.5 cursor-pointer transition-all ${
                    isAllStaff
                      ? 'bg-blue-50 border-blue-300 text-blue-900 ring-2 ring-blue-500/20'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="staff_assign_type"
                    checked={isAllStaff}
                    onChange={() => {
                      setIsAllStaff(true);
                      setAssignedStaffList([]);
                    }}
                    className="w-4 h-4 text-blue-600 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold">Dùng Chung Cho Toàn Bộ Nhân Sự (ALL)</span>
                    <p className="text-[10px] text-slate-500">
                      Mọi nhân viên trong nhóm đều thấy và được phép dùng proxy này
                    </p>
                  </div>
                </div>

                <div
                  onClick={() => setIsAllStaff(false)}
                  className={`p-2.5 rounded-lg border flex items-start space-x-2.5 cursor-pointer transition-all ${
                    !isAllStaff
                      ? 'bg-blue-50 border-blue-300 text-blue-900 ring-2 ring-blue-500/20'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="staff_assign_type"
                    checked={!isAllStaff}
                    onChange={() => setIsAllStaff(false)}
                    className="w-4 h-4 text-blue-600 cursor-pointer mt-0.5"
                  />
                  <div className="text-xs w-full">
                    <span className="font-bold">Chỉ Phân Công Cho Nhân Viên Cụ Thể (Có Sẵn Trong CSDL):</span>
                    <p className="text-[10px] text-slate-500 mb-1">
                      Danh sách chọn nhân viên được lấy từ tài khoản nhân sự có sẵn trong hệ thống (Bảng 5)
                    </p>
                    {!isAllStaff && (
                      availableStaffNames.length === 0 ? (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 mt-1">
                          Chưa có tài khoản nhân viên nào trong CSDL. Vui lòng tạo tài khoản nhân viên tại Bảng 5.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 pt-2 border-t border-blue-200">
                          {availableStaffNames.map((s) => (
                            <label
                              key={s}
                              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-800 bg-white p-1.5 rounded-md border border-slate-200 cursor-pointer hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                checked={assignedStaffList.includes(s)}
                                onChange={() => handleToggleStaff(s)}
                                className="w-3.5 h-3.5 rounded-sm text-blue-600"
                              />
                              <span className="truncate">{s}</span>
                            </label>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <input
                type="text"
                disabled
                value={`Đang cấp quyền riêng cho: ${currentUser.name}`}
                className="w-full px-3 py-2 text-xs bg-slate-200/70 border border-slate-300 rounded-lg text-slate-700 font-bold"
              />
            )}
          </div>

          {/* Action Buttons */}
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
              className="inline-flex items-center space-x-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
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
