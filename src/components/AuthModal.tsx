import React, { useState } from 'react';
import { UserAccount, AppUser } from '../types';
import {
  Shield,
  User,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
  Clock,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { findMatchingAccount } from '../utils/helpers';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  accounts: UserAccount[];
  adminPin: string;
  onLoginSuccess: (user: AppUser) => void;
  onRequestAccess: (username: string, pin: string, requestNote?: string) => { success: boolean; message: string };
  initialTab?: 'login' | 'request';
  allowClose?: boolean;
}

export function AuthModal({
  isOpen,
  onClose,
  accounts,
  adminPin,
  onLoginSuccess,
  onRequestAccess,
  initialTab = 'login',
  allowClose = false,
}: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'request'>(initialTab);

  // Login form state
  const [selectedRole, setSelectedRole] = useState<'admin' | 'staff'>('staff');
  const [selectedUsername, setSelectedUsername] = useState<string>('');
  const [customUsername, setCustomUsername] = useState<string>('');
  const [pinInput, setPinInput] = useState<string>('');
  const [showPin, setShowPin] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [accountStatusNotice, setAccountStatusNotice] = useState<{
    type: 'pending' | 'blocked' | 'info';
    message: string;
    details?: string;
  } | null>(null);

  // Request access form state
  const [reqFullName, setReqFullName] = useState('');
  const [reqPin, setReqPin] = useState('');
  const [reqPinConfirm, setReqPinConfirm] = useState('');
  const [reqNote, setReqNote] = useState('');
  const [reqStatus, setReqStatus] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  // Filter accounts
  const approvedStaffAccounts = accounts.filter(
    (a) => a.role === 'staff' && a.status === 'approved'
  );

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setAccountStatusNotice(null);

    // 1. Admin Login
    if (selectedRole === 'admin') {
      if (pinInput.trim() === adminPin.trim()) {
        const adminAccount: AppUser = {
          id: 'admin',
          name: 'Quản Lý (Admin)',
          role: 'admin',
          status: 'approved',
          isAuthenticated: true,
        };
        onLoginSuccess(adminAccount);
        if (onClose) onClose();
      } else {
        setLoginError('Mật khẩu Quản Lý không đúng. (Mặc định ban đầu là "admin123")');
      }
      return;
    }

    // 2. Staff Login
    const username = selectedUsername || customUsername.trim();
    if (!username) {
      setLoginError('Vui lòng chọn hoặc nhập tên nhân viên của bạn');
      return;
    }

    // Look up account in system
    const existingAccount = findMatchingAccount(username, accounts);

    if (!existingAccount) {
      setAccountStatusNotice({
        type: 'info',
        message: `Tài khoản "${username}" chưa được đăng ký trong hệ thống!`,
        details: 'Bạn vui lòng chuyển sang tab "Nhân Viên Mới Xin Cấp Quyền" để gửi yêu cầu cho Quản Lý phê duyệt.',
      });
      return;
    }

    // Check account status
    if (existingAccount.status === 'pending') {
      setAccountStatusNotice({
        type: 'pending',
        message: `Tài khoản "${existingAccount.username}" đang CHỜ ADMIN PHÊ DUYỆT!`,
        details:
          'Bạn chưa được phép truy cập vào dữ liệu. Vui lòng báo Quản Lý (Admin) vào phần "Phê Duyệt & Cấp Quyền" để xác nhận cho bạn vào nhé.',
      });
      return;
    }

    if (existingAccount.status === 'blocked') {
      setAccountStatusNotice({
        type: 'blocked',
        message: `Tài khoản "${existingAccount.username}" hiện đã bị TẠM KHÓA!`,
        details: 'Vui lòng liên hệ Quản Lý (Admin) để mở lại quyền truy cập cho bạn.',
      });
      return;
    }

    // Check PIN safely
    const expectedPin = String(existingAccount.pin ?? '123456').trim();
    if (pinInput.trim() !== expectedPin) {
      setLoginError(
        'Mã PIN đăng nhập không chính xác. Nếu là tài khoản mẫu mặc định mã PIN là "123456", hoặc nhờ Admin đặt lại mã PIN giúp bạn.'
      );
      return;
    }

    // Login success
    const staffUser: AppUser = {
      id: existingAccount.id,
      name: existingAccount.username,
      role: 'staff',
      status: 'approved',
      isAuthenticated: true,
    };
    onLoginSuccess(staffUser);
    if (onClose) onClose();
  };

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setReqStatus(null);

    const name = reqFullName.trim();
    if (!name) {
      setReqStatus({ success: false, message: 'Vui lòng nhập Họ và Tên của bạn' });
      return;
    }

    if (!reqPin || reqPin.length < 4) {
      setReqStatus({ success: false, message: 'Mã PIN bảo vệ phải có ít nhất 4 ký tự hoặc số' });
      return;
    }

    if (reqPin !== reqPinConfirm) {
      setReqStatus({ success: false, message: 'Xác nhận mã PIN không khớp nhau' });
      return;
    }

    const res = onRequestAccess(name, reqPin, reqNote);
    setReqStatus(res);

    if (res.success) {
      setReqFullName('');
      setReqPin('');
      setReqPinConfirm('');
      setReqNote('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Top Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6 text-center relative">
          {allowClose && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              ×
            </button>
          )}

          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md mb-3 border border-white/20 shadow-inner">
            <Lock className="w-6 h-6 text-amber-400" />
          </div>

          <h2 className="text-xl font-extrabold tracking-tight">Xác Thực & Phân Quyền</h2>
          <p className="text-xs text-slate-300 mt-1">
            Bảng Theo Dõi Fanpage & Nick Via • Phê Duyệt Bởi Quản Lý (Admin)
          </p>

          <div className="mt-4 flex items-center justify-center space-x-1 p-1 bg-black/30 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setLoginError(null);
                setAccountStatusNotice(null);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                activeTab === 'login'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>1. Đăng Nhập</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('request');
                setReqStatus(null);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                activeTab === 'request'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>2. Xin Cấp Quyền Vào</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {activeTab === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Role Switcher */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Bạn Đăng Nhập Với Tư Cách
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRole('staff');
                      setLoginError(null);
                      setAccountStatusNotice(null);
                    }}
                    className={`flex items-center justify-center space-x-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                      selectedRole === 'staff'
                        ? 'border-emerald-500 bg-emerald-50/80 text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <User className="w-4 h-4 text-emerald-600" />
                    <span>Nhân Viên</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRole('admin');
                      setLoginError(null);
                      setAccountStatusNotice(null);
                    }}
                    className={`flex items-center justify-center space-x-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                      selectedRole === 'admin'
                        ? 'border-amber-500 bg-amber-50/80 text-amber-900 ring-2 ring-amber-500/20 shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Shield className="w-4 h-4 text-amber-600" />
                    <span>Quản Lý (Admin)</span>
                  </button>
                </div>
              </div>

              {/* Staff selection if staff role is chosen */}
              {selectedRole === 'staff' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Chọn Tên Nhân Viên
                  </label>
                  {approvedStaffAccounts.length > 0 ? (
                    <select
                      value={selectedUsername}
                      onChange={(e) => {
                        setSelectedUsername(e.target.value);
                        setCustomUsername('');
                        setLoginError(null);
                        setAccountStatusNotice(null);
                      }}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    >
                      <option value="">-- Chọn nhân viên đã được duyệt --</option>
                      {approvedStaffAccounts.map((acc) => (
                        <option key={acc.id} value={acc.username}>
                          {acc.username} (Đã duyệt)
                        </option>
                      ))}
                      <option value="__other__">Tên nhân viên khác...</option>
                    </select>
                  ) : null}

                  {(selectedUsername === '__other__' || approvedStaffAccounts.length === 0) && (
                    <div className="mt-2">
                      <input
                        type="text"
                        placeholder="Nhập chính xác họ và tên của bạn..."
                        value={customUsername}
                        onChange={(e) => {
                          setCustomUsername(e.target.value);
                          setLoginError(null);
                          setAccountStatusNotice(null);
                        }}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Password / PIN Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    {selectedRole === 'admin' ? 'Mật Khẩu Quản Lý (Admin)' : 'Mã PIN / Mật Khẩu Cá Nhân'}
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {selectedRole === 'admin' ? 'Mặc định: admin123' : 'Mặc định mẫu: 123456'}
                  </span>
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPin ? 'text' : 'password'}
                    required
                    placeholder={selectedRole === 'admin' ? 'Nhập mật khẩu Admin...' : 'Nhập mã PIN của bạn...'}
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value);
                      setLoginError(null);
                    }}
                    className="w-full pl-9 pr-10 py-2.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error messages */}
              {loginError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-start space-x-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <div>{loginError}</div>
                </div>
              )}

              {/* Account Status Notice (Pending / Blocked / Info) */}
              {accountStatusNotice && (
                <div
                  className={`p-3.5 rounded-xl border text-xs animate-in fade-in ${
                    accountStatusNotice.type === 'pending'
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : accountStatusNotice.type === 'blocked'
                      ? 'bg-red-50 border-red-300 text-red-900'
                      : 'bg-blue-50 border-blue-300 text-blue-900'
                  }`}
                >
                  <div className="flex items-start space-x-2">
                    {accountStatusNotice.type === 'pending' ? (
                      <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    ) : accountStatusNotice.type === 'blocked' ? (
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-bold text-[13px]">{accountStatusNotice.message}</div>
                      {accountStatusNotice.details && (
                        <p className="mt-1 text-[11px] leading-relaxed opacity-90">
                          {accountStatusNotice.details}
                        </p>
                      )}
                    </div>
                  </div>

                  {accountStatusNotice.type === 'info' && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('request');
                        setReqFullName(customUsername || selectedUsername);
                        setAccountStatusNotice(null);
                      }}
                      className="mt-2.5 inline-flex items-center space-x-1 text-xs font-bold text-blue-700 hover:text-blue-900 underline"
                    >
                      <span>Gửi yêu cầu xin cấp quyền cho tên này</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Đăng Nhập Vào Hệ Thống</span>
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('request');
                    setLoginError(null);
                    setAccountStatusNotice(null);
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold hover:underline"
                >
                  Chưa có tài khoản? Nhấn vào đây để xin Admin phê duyệt
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRequestSubmit} className="space-y-3.5">
              <div className="bg-indigo-50/70 border border-indigo-200 p-3 rounded-xl text-xs text-indigo-900">
                <div className="font-bold flex items-center space-x-1.5 mb-1">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Cơ chế cấp quyền bảo mật</span>
                </div>
                <p className="text-[11px] text-indigo-800 leading-relaxed">
                  Nhân viên mới gửi thông tin đăng ký tại đây. Quản Lý (Admin) sẽ nhận thông báo và bấm
                  <strong> "Duyệt Cho Vào"</strong> trong hệ thống thì bạn mới có thể đăng nhập.
                </p>
              </div>

              {reqStatus && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start space-x-2 ${
                    reqStatus.success
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-red-50 border-red-300 text-red-900'
                  }`}
                >
                  {reqStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-bold">{reqStatus.message}</div>
                    {reqStatus.success && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('login');
                          setSelectedRole('staff');
                        }}
                        className="mt-1.5 inline-flex items-center space-x-1 text-xs font-bold text-emerald-700 underline hover:text-emerald-900"
                      >
                        <span>Quay lại màn hình Đăng nhập</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Họ và Tên Nhân Viên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn Nam, Lan Anh..."
                  value={reqFullName}
                  onChange={(e) => setReqFullName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mã PIN Đăng Nhập <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Mã PIN (>= 4 ký tự)"
                    value={reqPin}
                    onChange={(e) => setReqPin(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nhập Lại Mã PIN <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Xác nhận mã PIN"
                    value={reqPinConfirm}
                    onChange={(e) => setReqPinConfirm(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Lời Nhắn Gửi Quản Lý (Tùy chọn)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ví dụ: Em nhận ca trực Fanpage tối, nhờ Admin duyệt cấp quyền giúp em..."
                  value={reqNote}
                  onChange={(e) => setReqNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Gửi Yêu Cầu Cấp Quyền Cho Admin Duyệt</span>
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  className="text-xs text-slate-500 hover:text-slate-800 underline"
                >
                  Đã có tài khoản? Quay lại Đăng Nhập
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
