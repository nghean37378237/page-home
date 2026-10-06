import React, { useState, useEffect, useMemo } from 'react';
import { UserAccount, AppUser } from '../types';
import {
  Lock,
  Shield,
  User,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Mail,
  ChevronDown,
  Eye,
  EyeOff,
  UserCheck,
  UserPlus,
  Globe,
  Copy,
} from 'lucide-react';
import { findMatchingAccount, normalizeVietnamese } from '../utils/helpers';
import { getCloudAccounts, subscribeToAccounts, auth } from '../services/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

interface LoginScreenProps {
  accounts: UserAccount[];
  adminPin: string;
  adminName?: string;
  adminEmail?: string;
  requireGoogleOnly?: boolean;
  onLoginSuccess: (user: AppUser) => void;
  onRequestAccess: (
    username: string,
    pin: string,
    requestNote?: string,
    email?: string
  ) => { success: boolean; message: string };
  onLinkAccountEmail?: (accountId: string, email: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  accounts: propAccounts,
  adminPin,
  adminName,
  adminEmail,
  requireGoogleOnly = true,
  onLoginSuccess,
  onRequestAccess,
  onLinkAccountEmail,
}) => {
  const [liveAccounts, setLiveAccounts] = useState<UserAccount[]>(propAccounts || []);
  const [isCheckingLogin, setIsCheckingLogin] = useState<boolean>(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState<boolean>(false);

  // Synchronize liveAccounts real-time directly from Cloud Firestore
  useEffect(() => {
    const unsub = subscribeToAccounts(
      (fresh) => {
        if (Array.isArray(fresh)) {
          setLiveAccounts(fresh);
        }
      },
      (err) => {
        console.warn('[LoginScreen] Lỗi lắng nghe tài khoản real-time:', err);
      }
    );
    return () => unsub();
  }, []);

  // Also keep liveAccounts synchronized whenever propAccounts updates from App.tsx
  useEffect(() => {
    if (propAccounts && propAccounts.length > 0) {
      setLiveAccounts(propAccounts);
    }
  }, [propAccounts]);

  // Query Cloud Firestore directly on mount to guarantee fresh state
  useEffect(() => {
    getCloudAccounts()
      .then((cloudAccounts) => {
        if (cloudAccounts.length > 0) {
          setLiveAccounts(cloudAccounts);
        }
      })
      .catch((err) => {
        console.warn('[LoginScreen] Lỗi đồng bộ tài khoản ban đầu:', err);
      });
  }, []);

  // Mode: 'staff' (Tên + PIN) | 'google' (Google Sign In) | 'admin' (Admin PIN) | 'request' (Xin cấp quyền)
  const [activeTab, setActiveTab] = useState<'staff' | 'google' | 'admin' | 'request'>(
    requireGoogleOnly ? 'google' : 'staff'
  );

  // Staff Login State
  const [selectedStaffName, setSelectedStaffName] = useState<string>('');
  const [staffIdentifier, setStaffIdentifier] = useState<string>('');
  const [staffPinInput, setStaffPinInput] = useState<string>('');
  const [showStaffPin, setShowStaffPin] = useState<boolean>(false);
  const [staffError, setStaffError] = useState<string | null>(null);

  // Admin Login State
  const [adminPinInput, setAdminPinInput] = useState<string>('');
  const [showAdminPin, setShowAdminPin] = useState<boolean>(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  // Google Sign-In Flow
  const [isGoogleChooserOpen, setIsGoogleChooserOpen] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [isUnauthorizedDomain, setIsUnauthorizedDomain] = useState<boolean>(false);
  const [domainCopied, setDomainCopied] = useState<boolean>(false);
  const [linkingStaffName, setLinkingStaffName] = useState<string>('');
  const [linkingStaffPin, setLinkingStaffPin] = useState<string>('');
  const [showLinkingBox, setShowLinkingBox] = useState<boolean>(false);

  const handleCopyDomain = () => {
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(window.location.hostname);
      } else {
        throw new Error('Fallback needed');
      }
      setDomainCopied(true);
      setTimeout(() => setDomainCopied(false), 3000);
    } catch {
      const el = document.createElement('textarea');
      el.value = window.location.hostname;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setDomainCopied(true);
      setTimeout(() => setDomainCopied(false), 3000);
    }
  };

  // Security Gate: Strict Password Verification for Google Login (No Passwordless Bypass)
  const [pendingGoogleAuth, setPendingGoogleAuth] = useState<{
    role: 'admin' | 'staff';
    account?: UserAccount;
    adminName?: string;
    email: string;
  } | null>(null);
  const [googlePasswordInput, setGooglePasswordInput] = useState<string>('');
  const [showGooglePassword, setShowGooglePassword] = useState<boolean>(false);

  // Request Access State
  const [reqName, setReqName] = useState('');
  const [reqEmail, setReqEmail] = useState('');
  const [reqPin, setReqPin] = useState('');
  const [reqConfirmPin, setReqConfirmPin] = useState('');
  const [reqNote, setReqNote] = useState('');
  const [reqResult, setReqResult] = useState<{ success: boolean; message: string } | null>(null);

  // Approved Staff Accounts for Quick Selection
  const approvedStaffAccounts = useMemo(() => {
    return liveAccounts.filter((a) => a.role === 'staff' && a.status === 'approved');
  }, [liveAccounts]);

  // Refresh accounts freshly before validating login
  const getFreshAccounts = (): UserAccount[] => {
    return liveAccounts.length > 0 ? liveAccounts : (propAccounts && propAccounts.length > 0 ? propAccounts : []);
  };

  // 1. Handle Staff Login Submit
  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError(null);

    const freshAccounts = getFreshAccounts();
    const targetIdentifier = selectedStaffName || staffIdentifier;
    const trimmedId = targetIdentifier.trim();

    if (!trimmedId) {
      setStaffError('Vui lòng chọn tên hoặc nhập Tên / Email nhân viên của bạn');
      return;
    }

    if (!staffPinInput.trim()) {
      setStaffError('Vui lòng nhập mã PIN bảo mật (mặc định: 123456 hoặc PIN bạn đã tạo)');
      return;
    }

    setIsCheckingLogin(true);
    let account = findMatchingAccount(trimmedId, freshAccounts);

    // If not found in current memory state, query Cloud Firestore directly
    if (!account) {
      try {
        const cloudAccounts = await getCloudAccounts();
        if (cloudAccounts.length > 0) {
          setLiveAccounts(cloudAccounts);
          account = findMatchingAccount(trimmedId, cloudAccounts);
        }
      } catch (err) {
        console.error('[LoginScreen] Lỗi kiểm tra tài khoản từ cloud:', err);
      }
    }

    setIsCheckingLogin(false);

    if (!account) {
      // Check if user has a pending request
      const currentList = liveAccounts.length > 0 ? liveAccounts : freshAccounts;
      const pendingAccount = currentList.find(
        (a) =>
          a.status === 'pending' &&
          (a.username.toLowerCase() === trimmedId.toLowerCase() ||
            (a.email && a.email.toLowerCase() === trimmedId.toLowerCase()) ||
            normalizeVietnamese(a.username) === normalizeVietnamese(trimmedId))
      );

      if (pendingAccount) {
        setStaffError(`Tài khoản "${pendingAccount.username}" đang chờ Quản Lý (Admin) phê duyệt. Vui lòng nhắc Quản Lý bấm "Duyệt Cho Vào"!`);
        return;
      }

      setStaffError(`Không tìm thấy tài khoản "${trimmedId}" trong danh sách nhân viên đã được cấp phép. Vui lòng liên hệ Admin hoặc bấm tab "Xin Cấp Quyền".`);
      return;
    }

    if (account.status === 'blocked') {
      setStaffError(`Tài khoản nhân viên "${account.username}" đang bị tạm khóa bởi Admin. Vui lòng liên hệ Admin để mở lại.`);
      return;
    }

    if (account.status === 'pending') {
      setStaffError(`Tài khoản "${account.username}" đang chờ Quản Lý duyệt cấp quyền. Vui lòng liên hệ Quản Lý để được duyệt vào!`);
      return;
    }

    // Verify PIN safely (string comparison)
    const expectedPin = String(account.pin ?? '123456').trim();
    if (expectedPin !== staffPinInput.trim()) {
      setStaffError(`Mã PIN không chính xác cho tài khoản "${account.username}". Vui lòng thử lại hoặc yêu cầu Admin xem lại mã PIN.`);
      return;
    }

    // Login successful
    onLoginSuccess({
      id: account.id,
      name: account.username,
      email: account.email,
      role: 'staff',
      status: 'approved',
      isAuthenticated: true,
    });
  };

  // 2. Handle Admin Login Submit
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);

    if (!adminPinInput.trim()) {
      setAdminError('Vui lòng nhập mật khẩu Quản Lý (Admin)');
      return;
    }

    if (adminPinInput.trim() === adminPin.trim()) {
      onLoginSuccess({
        id: 'admin',
        name: adminName || 'Quản Lý (Admin)',
        email: adminEmail || 'myphuong2295@gmail.com',
        role: 'admin',
        status: 'approved',
        isAuthenticated: true,
      });
    } else {
      setAdminError('Mật khẩu Quản Lý (Admin) không chính xác! Vui lòng nhập đúng mật khẩu đã thiết lập.');
    }
  };

  // 2b. Native Firebase Google Sign-In with real Google OAuth Popup
  const handleFirebaseGoogleSignIn = async () => {
    setIsGoogleSigningIn(true);
    setGoogleError(null);
    setShowLinkingBox(false);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);

      if (!result.user || !result.user.email) {
        throw new Error('Không thể lấy địa chỉ Email từ tài khoản Google.');
      }

      const email = result.user.email.toLowerCase().trim();
      const displayName = result.user.displayName || '';

      const freshAccounts = getFreshAccounts();
      const currentAdminEmail = (adminEmail || 'myphuong2295@gmail.com').trim().toLowerCase();

      // 1. Check Admin Google Account
      if (
        email === currentAdminEmail ||
        email === 'myphuong2295@gmail.com' ||
        email === 'admin@gmail.com' ||
        freshAccounts.some((a) => a.role === 'admin' && a.email?.toLowerCase() === email)
      ) {
        onLoginSuccess({
          id: 'admin',
          name: adminName || displayName || 'Quản Lý (Admin)',
          email: email,
          role: 'admin',
          status: 'approved',
          isAuthenticated: true,
        });
        return;
      }

      // 2. Check Approved Staff Google Account with intelligent matching (exact email, prefix, or Vietnamese name)
      const matched =
        findMatchingAccount(email, freshAccounts) ||
        (displayName ? findMatchingAccount(displayName, freshAccounts) : undefined);

      if (matched) {
        if (matched.status === 'blocked') {
          setGoogleError(`Tài khoản nhân viên "${matched.username}" (${email}) đang bị Quản Lý tạm khóa.`);
          return;
        }
        if (matched.status === 'pending') {
          setGoogleError(`Tài khoản nhân viên "${matched.username}" (${email}) đang chờ Quản Lý phê duyệt.`);
          return;
        }

        // Auto-link email if not linked yet
        if (!matched.email || matched.email.toLowerCase() !== email) {
          onLinkAccountEmail?.(matched.id, email);
        }

        // Successfully verified staff by Google OAuth -> Direct access granted!
        onLoginSuccess({
          id: matched.id,
          name: matched.username,
          email: email,
          role: 'staff',
          status: 'approved',
          isAuthenticated: true,
        });
        return;
      }

      // 3. Email is unlinked or not recognized
      setCustomGoogleEmail(email);
      setGoogleError(
        `Email Google "${email}" chưa được Quản Lý cấp phép trong danh sách nhân viên. Nếu bạn là nhân viên cũ, hãy chọn tên và nhập mã PIN một lần duy nhất bên dưới để liên kết.`
      );
      setIsGoogleChooserOpen(true);
      setShowLinkingBox(true);
    } catch (err: any) {
      console.warn('[LoginScreen] Lỗi Google OAuth popup:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setGoogleError('Bạn đã đóng cửa sổ đăng nhập Google trước khi hoàn tất. Bạn có thể thử lại hoặc bấm đăng nhập bằng Tên / Mã PIN bên dưới.');
      } else if (err.code === 'auth/popup-blocked') {
        setGoogleError('Trình duyệt hoặc khung hiển thị (iFrame) đang chặn cửa sổ đăng nhập Google (Pop-up). Bạn có thể bấm chọn tài khoản hoặc chuyển sang đăng nhập bằng Tên & Mã PIN bên dưới.');
        setIsGoogleChooserOpen(true);
      } else if (err.code === 'auth/unauthorized-domain') {
        setIsUnauthorizedDomain(true);
        setGoogleError(
          `Tên miền (${window.location.hostname}) chưa được thêm vào mục Authorized Domains trong Firebase Console. Bạn có thể đăng nhập ngay bằng Tên & Mã PIN bên dưới mà không cần chờ cấu hình domain!`
        );
        setIsGoogleChooserOpen(true);
      } else {
        setGoogleError(`Không thể mở cửa sổ Google (${err.message || err.code}). Bạn có thể chuyển sang đăng nhập bằng Tên / Mã PIN bên dưới để vào hệ thống ngay.`);
        setIsGoogleChooserOpen(true);
      }
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  // 3. Handle Google Sign-In Step 1: Detect Account by Email
  const processEmailVerification = (targetEmail: string) => {
    setGoogleError(null);
    setShowLinkingBox(false);
    setPendingGoogleAuth(null);

    const freshAccounts = getFreshAccounts();
    const email = targetEmail.trim().toLowerCase();

    if (!email) {
      setGoogleError('Vui lòng nhập địa chỉ Email Google');
      return;
    }

    const currentAdminEmail = (adminEmail || 'myphuong2295@gmail.com').trim().toLowerCase();

    // Check if it's the Admin email - BẮT BUỘC NHẬP PASS ADMIN, KHÔNG CHO VÀO TỰ ĐỘNG!
    if (
      email === currentAdminEmail ||
      email === 'myphuong2295@gmail.com' ||
      email === 'admin@gmail.com' ||
      freshAccounts.some((a) => a.role === 'admin' && a.email?.toLowerCase() === email)
    ) {
      setPendingGoogleAuth({
        role: 'admin',
        adminName: adminName || 'Quản Lý (Admin)',
        email: email,
      });
      setGooglePasswordInput('');
      return;
    }

    // Match approved accounts by email, or by normalized username/email prefix
    const matched = findMatchingAccount(email, freshAccounts);

    if (matched) {
      if (matched.status === 'blocked') {
        setGoogleError(`Tài khoản liên kết với Email "${email}" đang bị tạm khóa bởi Admin.`);
        return;
      }
      if (matched.status === 'pending') {
        setGoogleError(`Tài khoản "${matched.username}" đang chờ Quản Lý phê duyệt.`);
        return;
      }

      // BẮT BUỘC NHẬP MÃ PIN NHÂN VIÊN, KHÔNG CHO VÀO TỰ ĐỘNG!
      setPendingGoogleAuth({
        role: 'staff',
        account: matched,
        email: email,
      });
      setGooglePasswordInput('');
      return;
    }

    // If not matched, suggest linking or show error
    setGoogleError(`Email "${email}" chưa được liên kết với nhân viên nào. Nếu bạn là nhân viên đã được duyệt, bạn có thể liên kết tài khoản bằng mã PIN bên dưới.`);
    setShowLinkingBox(true);
  };

  const handleCustomGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processEmailVerification(customGoogleEmail);
  };

  const handleQuickSelectAccount = (email: string) => {
    setCustomGoogleEmail(email);
    processEmailVerification(email);
  };

  // 3b. Handle Google Sign-In Step 2: Verify Password/PIN for Recognized Email
  const handleConfirmGooglePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setGoogleError(null);

    if (!pendingGoogleAuth) return;

    if (!googlePasswordInput.trim()) {
      setGoogleError(
        pendingGoogleAuth.role === 'admin'
          ? 'Vui lòng nhập Mật Khẩu Admin để mở khóa!'
          : 'Vui lòng nhập Mã PIN nhân viên để mở khóa!'
      );
      return;
    }

    // Admin Verification
    if (pendingGoogleAuth.role === 'admin') {
      if (googlePasswordInput.trim() === adminPin.trim()) {
        onLoginSuccess({
          id: 'admin',
          name: pendingGoogleAuth.adminName || adminName || 'Quản Lý (Admin)',
          email: pendingGoogleAuth.email,
          role: 'admin',
          status: 'approved',
          isAuthenticated: true,
        });
      } else {
        setGoogleError('Mật khẩu Quản Trị Viên (Admin) không đúng! Vui lòng nhập lại chính xác.');
      }
      return;
    }

    // Staff Verification
    if (pendingGoogleAuth.role === 'staff' && pendingGoogleAuth.account) {
      const expectedPin = String(pendingGoogleAuth.account.pin ?? '123456').trim();
      if (googlePasswordInput.trim() === expectedPin) {
        // Automatically link this email to the account if not already saved
        if (
          !pendingGoogleAuth.account.email ||
          pendingGoogleAuth.account.email.toLowerCase() !== pendingGoogleAuth.email
        ) {
          onLinkAccountEmail?.(pendingGoogleAuth.account.id, pendingGoogleAuth.email);
        }

        onLoginSuccess({
          id: pendingGoogleAuth.account.id,
          name: pendingGoogleAuth.account.username,
          email: pendingGoogleAuth.email,
          role: 'staff',
          status: 'approved',
          isAuthenticated: true,
        });
      } else {
        setGoogleError(
          `Mã PIN không đúng cho tài khoản nhân viên "${pendingGoogleAuth.account.username}". Vui lòng thử lại.`
        );
      }
    }
  };

  // 4. Handle Link Google Email with Approved Staff
  const handleLinkGoogleEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setGoogleError(null);

    if (!linkingStaffName) {
      setGoogleError('Vui lòng chọn tên nhân viên của bạn');
      return;
    }

    const freshAccounts = getFreshAccounts();
    const acc = freshAccounts.find((a) => a.username === linkingStaffName && a.status === 'approved');

    if (!acc) {
      setGoogleError('Không tìm thấy tài khoản nhân viên đã duyệt.');
      return;
    }

    const expectedPin = String(acc.pin ?? '123456').trim();
    if (expectedPin !== linkingStaffPin.trim()) {
      setGoogleError(`Mã PIN không đúng cho tài khoản "${acc.username}".`);
      return;
    }

    // Save linked email
    const email = customGoogleEmail.trim().toLowerCase();
    onLinkAccountEmail?.(acc.id, email);

    // Login directly
    onLoginSuccess({
      id: acc.id,
      name: acc.username,
      email: email,
      role: 'staff',
      status: 'approved',
      isAuthenticated: true,
    });
  };

  // 5. Handle Request Access Submit
  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setReqResult(null);

    const name = reqName.trim();
    if (!name) {
      setReqResult({ success: false, message: 'Vui lòng nhập họ & tên nhân viên' });
      return;
    }

    if (!reqPin || reqPin.length < 4) {
      setReqResult({ success: false, message: 'Mã PIN phải có ít nhất 4 ký tự' });
      return;
    }

    if (reqPin !== reqConfirmPin) {
      setReqResult({ success: false, message: 'Xác nhận mã PIN không khớp với mã PIN đã nhập' });
      return;
    }

    const res = onRequestAccess(name, reqPin.trim(), reqNote.trim(), reqEmail.trim());
    setReqResult(res);

    if (res.success) {
      setReqName('');
      setReqEmail('');
      setReqPin('');
      setReqConfirmPin('');
      setReqNote('');
    }
  };

  return (
    <div className="min-h-screen bg-[#070d1e] text-slate-100 flex flex-col justify-center items-center p-3 sm:p-6 relative overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-indigo-900/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-lg mx-auto z-10 flex flex-col items-center">
        {/* 1. Circular Golden Emblem & Piggy Mascot */}
        <div className="relative mb-3 flex flex-col items-center">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 bg-gradient-to-tr from-amber-500 via-yellow-200 to-amber-600 shadow-[0_0_25px_rgba(245,158,11,0.25)] flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-[#0b1329] border border-amber-400/50 flex flex-col items-center justify-center relative overflow-hidden p-2">
              {/* Social Icons */}
              <div className="absolute top-2 left-2.5 w-4 h-4 rounded-full bg-[#1877F2] text-white flex items-center justify-center text-[9px] font-bold shadow-xs">
                f
              </div>
              <div className="absolute top-2.5 right-2.5 w-4 h-3.5 rounded bg-[#FF0000] text-white flex items-center justify-center text-[8px] font-bold shadow-xs">
                ▶
              </div>
              <div className="absolute bottom-4 left-2.5 w-3.5 h-3.5 rounded bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-600 text-white flex items-center justify-center text-[7px] font-bold shadow-xs">
                📷
              </div>
              <div className="absolute bottom-4 right-2.5 w-4 h-3.5 rounded bg-emerald-600 text-white flex items-center justify-center text-[7px] font-bold shadow-xs">
                📈
              </div>

              {/* Cute Pig Mascot */}
              <div className="text-2xl sm:text-3xl filter drop-shadow-md select-none mt-0.5">
                🐷
              </div>

              {/* Growth Laptop / Badge */}
              <div className="text-[9px] text-amber-300 font-extrabold tracking-tighter mt-0.5 flex items-center space-x-0.5 bg-black/40 px-1 py-0.2 rounded">
                <span>💻</span>
                <span>MMO PRO</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Brand Titles & GROW TOGETHER Badge */}
        <div className="text-center mb-4 flex flex-col items-center">
          <div className="flex items-center space-x-2 justify-center mb-1">
            <span className="text-lg sm:text-xl font-black text-white tracking-wider uppercase font-mono">
              MMO SYSTEM
            </span>
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold text-amber-400 border border-amber-500/50 bg-amber-950/40 shadow-xs">
              <TrendingUp className="w-2.5 h-2.5 text-amber-400" />
              <span>GROW TOGETHER</span>
            </span>
          </div>
          <p className="text-slate-400 text-xs font-medium">
            Hệ thống Quản lý Nội bộ & Phân Quyền Fanpage MMO
          </p>
        </div>

        {/* 3. Main Security Login Card */}
        <div className="w-full bg-[#0c162e]/95 border border-slate-700/70 rounded-2xl p-4 sm:p-6 shadow-2xl backdrop-blur-md relative">
          {/* Card Header with Blue Lock & Security notice */}
          <div className="flex items-center justify-between text-xs mb-3">
            <div className="flex items-center space-x-1.5 text-sky-400 font-bold tracking-wider uppercase text-[11px] sm:text-xs">
              <Lock className="w-4 h-4 text-sky-400" />
              <span>XÁC THỰC AN TOÀN NỘI BỘ</span>
            </div>
            <div className="text-[10px] text-emerald-400 font-semibold flex items-center space-x-1 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-800/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Bảo Vệ Đa Lớp</span>
            </div>
          </div>

          {/* TOP TABS NAVIGATION */}
          {requireGoogleOnly && (
            <div className="mb-3 p-2 bg-sky-950/60 rounded-xl border border-sky-500/30 text-xs flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-2 min-w-0">
                <Shield className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="text-[11px] text-sky-200 truncate">
                  Ưu tiên: Đăng nhập bằng Google nội bộ (hoặc dùng mã PIN nếu trình duyệt chặn Popup)
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-[11px] font-bold mb-4">
            <button
              type="button"
              id="tab-staff-login"
              onClick={() => {
                setActiveTab('staff');
                setStaffError(null);
              }}
              className={`py-2 px-1.5 rounded-lg transition-all flex flex-col items-center justify-center cursor-pointer ${
                activeTab === 'staff'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <User className="w-3.5 h-3.5 mb-0.5" />
              <span className="truncate">Nhân Viên</span>
            </button>

            <button
              type="button"
              id="tab-google-login"
              onClick={() => {
                setActiveTab('google');
                setGoogleError(null);
              }}
              className={`py-2 px-1.5 rounded-lg transition-all flex flex-col items-center justify-center cursor-pointer ${
                activeTab === 'google'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <Mail className="w-3.5 h-3.5 mb-0.5" />
              <span className="truncate">Google</span>
            </button>

            <button
              type="button"
              id="tab-admin-login"
              onClick={() => {
                setActiveTab('admin');
                setAdminError(null);
              }}
              className={`py-2 px-1.5 rounded-lg transition-all flex flex-col items-center justify-center cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <Shield className="w-3.5 h-3.5 mb-0.5" />
              <span className="truncate">Quản Lý</span>
            </button>

            <button
              type="button"
              id="tab-request-access"
              onClick={() => {
                setActiveTab('request');
                setReqResult(null);
              }}
              className={`py-2 px-1.5 rounded-lg transition-all flex flex-col items-center justify-center cursor-pointer ${
                activeTab === 'request'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 mb-0.5" />
              <span className="truncate">Xin Vào</span>
            </button>
          </div>

          {/* TAB 1: NHÂN VIÊN ĐĂNG NHẬP (TÊN + PIN) */}
          {activeTab === 'staff' && (
            <form onSubmit={handleStaffLogin} className="space-y-3.5 animate-fadeIn">
              {staffError && (
                <div className="p-2.5 bg-red-950/70 border border-red-700/60 rounded-xl text-red-200 text-xs flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">{staffError}</span>
                </div>
              )}

              {/* Quick Select from Approved Staff */}
              {approvedStaffAccounts.length > 0 ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center justify-between">
                    <span>Chọn Tên Nhân Viên Đã Được Duyệt:</span>
                    <span className="text-[10px] text-emerald-400 font-semibold">
                      ({approvedStaffAccounts.length} nhân viên sẵn sàng)
                    </span>
                  </label>
                  <select
                    id="select-approved-staff"
                    value={selectedStaffName}
                    onChange={(e) => {
                      setSelectedStaffName(e.target.value);
                      if (e.target.value) {
                        setStaffIdentifier(e.target.value);
                      }
                      setStaffError(null);
                    }}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="">-- Chọn tài khoản của bạn trong danh sách --</option>
                    {approvedStaffAccounts.map((acc) => (
                      <option key={acc.id} value={acc.username}>
                        👤 {acc.username} {acc.email ? `(${acc.email})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-2.5 bg-slate-900/70 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-start space-x-2">
                  <UserCheck className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <span>
                    Chưa có tài khoản nhân viên nào. Quản lý vào tab Quản Lý để thêm nhân sự, hoặc bạn chuyển sang tab <strong>Xin Vào</strong> để đăng ký.
                  </span>
                </div>
              )}

              {/* Or manual type */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Hoặc Nhập Tên / Email Nhân Viên Của Bạn:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="input-staff-identifier"
                    list="staff-options-datalist"
                    placeholder="Nhập tên nhân viên hoặc email..."
                    value={staffIdentifier}
                    onChange={(e) => {
                      setStaffIdentifier(e.target.value);
                      if (selectedStaffName && e.target.value !== selectedStaffName) {
                        setSelectedStaffName('');
                      }
                      setStaffError(null);
                    }}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                  {approvedStaffAccounts.length > 0 && (
                    <datalist id="staff-options-datalist">
                      {approvedStaffAccounts.map((acc) => (
                        <option key={acc.id} value={acc.username}>
                          {acc.username} {acc.email ? `(${acc.email})` : ''}
                        </option>
                      ))}
                    </datalist>
                  )}
                  {staffIdentifier && (
                    <button
                      type="button"
                      onClick={() => {
                        setStaffIdentifier('');
                        setSelectedStaffName('');
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* PIN input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Mã PIN Đăng Nhập:</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    Mặc định: 123456
                  </span>
                </label>
                <div className="relative">
                  <input
                    type={showStaffPin ? 'text' : 'password'}
                    id="input-staff-pin"
                    placeholder="Nhập mã PIN của bạn..."
                    value={staffPinInput}
                    onChange={(e) => setStaffPinInput(e.target.value)}
                    className="w-full px-3 py-2.5 pr-10 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffPin(!showStaffPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    title={showStaffPin ? 'Ẩn mã PIN' : 'Hiện mã PIN'}
                  >
                    {showStaffPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                id="btn-submit-staff-login"
                disabled={isCheckingLogin}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-60 text-white font-bold rounded-xl text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-2 group hover:scale-[1.01]"
              >
                {isCheckingLogin ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Đang Xác Thực Tài Khoản...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>Đăng Nhập Vào Bảng Làm Việc</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>

              <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
                <button
                  type="button"
                  onClick={() => setActiveTab('google')}
                  className="hover:text-sky-300 underline cursor-pointer"
                >
                  Đăng nhập nhanh bằng Google
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('request')}
                  className="hover:text-emerald-300 underline cursor-pointer"
                >
                  Chưa có tài khoản? Xin cấp quyền
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: GOOGLE SIGN-IN */}
          {activeTab === 'google' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Domain Warning Banner for Firebase OAuth */}
              {isUnauthorizedDomain && (
                <div className="p-3.5 bg-amber-950/60 border border-amber-500/50 rounded-xl text-xs text-amber-200 space-y-2.5 animate-fadeIn">
                  <div className="flex items-start space-x-2 font-bold text-amber-300">
                    <Globe className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>Tên Miền Chưa Cấp Phép Trong Firebase Auth</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Google Firebase chặn mở cửa sổ Popup nếu tên miền chưa nằm trong danh sách <strong>Authorized domains</strong>.
                  </p>
                  <div className="p-2 bg-slate-950/90 border border-slate-800 rounded-lg flex items-center justify-between space-x-2">
                    <span className="text-[11px] font-mono text-amber-300 truncate select-all">{window.location.hostname}</span>
                    <button
                      type="button"
                      onClick={handleCopyDomain}
                      className="px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40 rounded text-[10px] font-bold flex items-center space-x-1 shrink-0 cursor-pointer transition-colors"
                    >
                      {domainCopied ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Đã chép!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-amber-300" />
                          <span>Sao chép domain</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[10.5px] text-emerald-300 font-medium">
                    👉 <strong>Đăng nhập ngay không cần chờ:</strong> Bạn và nhân viên có thể bấm chọn tài khoản bên dưới để đăng nhập an toàn 100%!
                  </p>
                </div>
              )}

              {googleError && !isUnauthorizedDomain && (
                <div className="p-3.5 bg-red-950/80 border border-red-700/70 rounded-xl text-red-200 text-xs space-y-2.5 shadow-md animate-fadeIn">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span className="leading-snug">{googleError}</span>
                  </div>
                  <div className="pt-1 flex flex-col sm:flex-row gap-2 border-t border-red-800/40">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('staff');
                        setStaffError(null);
                      }}
                      className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm transition-colors"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Đăng Nhập Bằng Tên / Mã PIN Nhân Viên</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('admin');
                        setAdminError(null);
                      }}
                      className="py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm transition-colors"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>Đăng Nhập Quản Lý (Admin)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Big White Google Login Button */}
              <button
                type="button"
                id="btn-google-login-main"
                disabled={isGoogleSigningIn}
                onClick={handleFirebaseGoogleSignIn}
                className="w-full bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-800 font-extrabold py-3.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center space-x-3 text-sm cursor-pointer group hover:scale-[1.01] disabled:opacity-75 disabled:cursor-not-allowed border border-slate-300"
              >
                {isGoogleSigningIn ? (
                  <div className="w-5 h-5 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>
                  {isGoogleSigningIn
                    ? 'Đang kết nối tài khoản Google...'
                    : 'Đăng nhập với Google'}
                </span>
              </button>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5 px-1">
                <button
                  type="button"
                  onClick={() => setIsGoogleChooserOpen(!isGoogleChooserOpen)}
                  className="text-sky-400 hover:text-sky-300 underline cursor-pointer"
                >
                  {isGoogleChooserOpen ? '▲ Thu gọn danh sách chọn tài khoản' : '⚡ Bấm chọn nhanh tài khoản nội bộ (Không cần Popup)'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('staff');
                    setStaffError(null);
                  }}
                  className="text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Đăng nhập mã PIN →
                </button>
              </div>

              {/* Google Input Dialog */}
              {isGoogleChooserOpen && (
                <div className="p-4 bg-slate-900/95 rounded-xl border border-sky-500/40 space-y-3 shadow-xl">
                  <div className="flex items-center justify-between text-xs text-slate-200 font-bold border-b border-slate-800 pb-2">
                    <span className="flex items-center space-x-1.5 text-sky-400">
                      <Shield className="w-3.5 h-3.5 text-sky-400" />
                      <span>Xác thực Email Google Nội Bộ</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsGoogleChooserOpen(false);
                        setGoogleError(null);
                        setShowLinkingBox(false);
                      }}
                      className="text-slate-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-800"
                    >
                      ✕
                    </button>
                  </div>

                  {/* STEP 2: NẾU PHÁT HIỆN EMAIL THÌ BẮT BUỘC NHẬP PASS / PIN */}
                  {pendingGoogleAuth ? (
                    <form onSubmit={handleConfirmGooglePassword} className="space-y-3.5">
                      <div
                        className={`p-3 rounded-xl border text-xs ${
                          pendingGoogleAuth.role === 'admin'
                            ? 'bg-amber-950/50 border-amber-500/50 text-amber-200'
                            : 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
                        }`}
                      >
                        <div className="flex items-center space-x-1.5 font-bold mb-1">
                          {pendingGoogleAuth.role === 'admin' ? (
                            <>
                              <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                              <span className="text-amber-300">Phát hiện Email Quản Trị Viên (Admin)</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span className="text-emerald-300">
                                Phát hiện Email Nhân Viên: {pendingGoogleAuth.account?.username}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-300 font-mono break-all mb-1.5">
                          {pendingGoogleAuth.email}
                        </div>
                        <p className="text-[10.5px] leading-snug text-slate-300">
                          {pendingGoogleAuth.role === 'admin'
                            ? '⚠️ Lưu ý an ninh: Trình duyệt có thể dùng chung email này. Bạn BẮT BUỘC phải nhập Mật Khẩu Admin để mở khóa hệ thống!'
                            : 'Nhập đúng mã PIN nhân viên của bạn để xác thực vào bảng làm việc:'}
                        </p>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-300 font-bold mb-1">
                          {pendingGoogleAuth.role === 'admin'
                            ? 'Nhập Mật Khẩu Quản Lý (Admin):'
                            : 'Nhập Mã PIN Nhân Viên:'}
                        </label>
                        <div className="relative">
                          <input
                            type={showGooglePassword ? 'text' : 'password'}
                            id="input-google-password"
                            placeholder={
                              pendingGoogleAuth.role === 'admin'
                                ? 'Nhập mật khẩu Admin...'
                                : 'Nhập mã PIN của bạn...'
                            }
                            value={googlePasswordInput}
                            onChange={(e) => setGooglePasswordInput(e.target.value)}
                            className="w-full px-3 py-2.5 pr-10 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-hidden focus:border-amber-500"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => setShowGooglePassword(!showGooglePassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                          >
                            {showGooglePassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPendingGoogleAuth(null);
                            setGoogleError(null);
                          }}
                          className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium cursor-pointer transition-colors"
                        >
                          ← Đổi Email
                        </button>
                        <button
                          type="submit"
                          id="btn-verify-google-password"
                          className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center space-x-1.5 shadow-md"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Mở Khóa & Đăng Nhập</span>
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* STEP 1: NHẬP EMAIL GOOGLE HOẶC BẤM CHỌN NHANH */
                    <div className="space-y-3.5">
                      {/* Quick Select Buttons */}
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                          <span>Bấm Chọn Nhanh Tài Khoản Của Bạn:</span>
                          <span className="text-[10px] text-sky-400 font-semibold">1-Click Đăng Nhập</span>
                        </div>
                        <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1">
                          {/* Admin Account Button */}
                          <button
                            type="button"
                            onClick={() => handleQuickSelectAccount(adminEmail || 'myphuong2295@gmail.com')}
                            className="p-2.5 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-600/40 hover:border-amber-500 rounded-xl text-left transition-all flex items-center space-x-2.5 cursor-pointer group shadow-sm"
                          >
                            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                              <Shield className="w-4 h-4 text-amber-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-amber-200 truncate flex items-center space-x-1.5">
                                <span>{adminName || 'Quản Lý (Admin)'}</span>
                                <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/30 text-amber-300 rounded font-bold uppercase tracking-wider">Quản Trị</span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono truncate">
                                {adminEmail || 'myphuong2295@gmail.com'}
                              </div>
                            </div>
                            <span className="text-[10px] text-amber-300/80 font-bold shrink-0">Chọn →</span>
                          </button>

                          {/* Approved Staff Accounts */}
                          {approvedStaffAccounts.map((staff) => {
                            const staffEmailDisplay = staff.email || `${staff.username.toLowerCase().replace(/\s+/g, '')}@gmail.com`;
                            return (
                              <button
                                key={staff.id}
                                type="button"
                                onClick={() => handleQuickSelectAccount(staffEmailDisplay)}
                                className="p-2.5 bg-slate-950 hover:bg-slate-800/80 border border-slate-700/70 hover:border-sky-500 rounded-xl text-left transition-all flex items-center space-x-2.5 cursor-pointer group shadow-sm"
                              >
                                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                  <UserCheck className="w-4 h-4 text-emerald-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-slate-200 truncate flex items-center space-x-1.5">
                                    <span>{staff.username}</span>
                                    <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-medium">Nhân viên</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono truncate">
                                    {staffEmailDisplay}
                                  </div>
                                </div>
                                <span className="text-[10px] text-sky-400/80 font-bold shrink-0">Chọn →</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Manual Email Input */}
                      <form onSubmit={handleCustomGoogleSubmit} className="pt-2 border-t border-slate-800/80 space-y-2.5">
                        <div>
                          <label className="block text-[11px] text-slate-300 font-medium mb-1">
                            Hoặc Nhập Địa Chỉ Email Google Khác:
                          </label>
                          <input
                            type="email"
                            id="input-google-email"
                            placeholder="VD: emailcuaban@gmail.com"
                            value={customGoogleEmail}
                            onChange={(e) => setCustomGoogleEmail(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500 font-mono"
                          />
                        </div>
                        <button
                          type="submit"
                          id="btn-confirm-google-email"
                          className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center space-x-1.5 shadow-sm"
                        >
                          <span>Tiếp Tục & Xác Thực Mật Khẩu</span>
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Account linking helper if email not recognized */}
                  {showLinkingBox && approvedStaffAccounts.length > 0 && (
                    <form
                      onSubmit={handleLinkGoogleEmail}
                      className="mt-3 p-3 bg-indigo-950/60 border border-indigo-700/50 rounded-lg space-y-2 text-xs"
                    >
                      <div className="font-bold text-indigo-300 flex items-center space-x-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Liên kết Email này với tài khoản đã được duyệt:</span>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Tên nhân viên của bạn:</label>
                        <select
                          value={linkingStaffName}
                          onChange={(e) => setLinkingStaffName(e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                        >
                          <option value="">-- Chọn tên bạn trong danh sách đã duyệt --</option>
                          {approvedStaffAccounts.map((a) => (
                            <option key={a.id} value={a.username}>
                              {a.username}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Mã PIN của bạn để xác thực:</label>
                        <input
                          type="password"
                          placeholder="Nhập mã PIN để liên kết..."
                          value={linkingStaffPin}
                          onChange={(e) => setLinkingStaffPin(e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white font-mono"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-xs"
                      >
                        Liên Kết Email & Đăng Nhập Ngay
                      </button>
                    </form>
                  )}
                </div>
              )}

              {!requireGoogleOnly && (
                <div className="pt-2 text-center text-xs text-slate-400">
                  <button
                    type="button"
                    onClick={() => setActiveTab('staff')}
                    className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
                  >
                    ← Đăng nhập bằng Tên & Mã PIN nội bộ
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: QUẢN LÝ (ADMIN) */}
          {activeTab === 'admin' && (
            <form onSubmit={handleAdminLogin} className="space-y-3.5 animate-fadeIn">
              <div className="p-3 bg-amber-950/40 border border-amber-600/40 rounded-xl text-xs text-amber-200">
                <div className="font-bold flex items-center space-x-1 text-amber-300 mb-0.5">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  <span>Khu Vực Dành Riêng Cho Quản Lý (Admin)</span>
                </div>
                <p className="text-[11px] text-amber-200/80">
                  Admin có toàn quyền phê duyệt nhân viên, phân chia Fanpage, quản lý Nick Via và cài đặt khóa ứng dụng.
                </p>
              </div>

              {adminError && (
                <div className="p-2.5 bg-red-950/70 border border-red-700/60 rounded-xl text-red-200 text-xs flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">{adminError}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Mật Khẩu Quản Lý (Admin):</span>
                  <span className="text-[10px] text-amber-400 font-semibold">Bắt buộc mật khẩu bảo mật</span>
                </label>
                <div className="relative">
                  <input
                    type={showAdminPin ? 'text' : 'password'}
                    id="input-admin-password"
                    placeholder="Nhập mật khẩu Admin..."
                    value={adminPinInput}
                    onChange={(e) => setAdminPinInput(e.target.value)}
                    className="w-full px-3 py-2.5 pr-10 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPin(!showAdminPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showAdminPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                id="btn-submit-admin-login"
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-2"
              >
                <Shield className="w-4 h-4" />
                <span>Đăng Nhập Quản Trị Viên (Admin)</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="pt-1 text-center text-xs text-slate-400">
                <button
                  type="button"
                  onClick={() => setActiveTab(requireGoogleOnly ? 'google' : 'staff')}
                  className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
                >
                  {requireGoogleOnly ? '← Quay lại Đăng Nhập Google' : '← Chuyển sang Đăng nhập Nhân Viên'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: XIN CẤP QUYỀN TRUY CẬP (NHÂN VIÊN MỚI) */}
          {activeTab === 'request' && (
            <form onSubmit={handleRequestSubmit} className="space-y-3 animate-fadeIn">
              <div className="text-xs text-slate-300 font-bold border-b border-slate-800 pb-2 flex items-center justify-between">
                <span>Đăng Ký Cấp Quyền Cho Nhân Viên Mới</span>
                <span className="text-[10px] text-emerald-400">Duyệt tự động bởi Admin</span>
              </div>

              {reqResult && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-start space-x-2 ${
                    reqResult.success
                      ? 'bg-emerald-950/60 border border-emerald-700/50 text-emerald-200'
                      : 'bg-red-950/60 border border-red-700/50 text-red-200'
                  }`}
                >
                  {reqResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <span className="leading-snug">{reqResult.message}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Họ & Tên Nhân Viên: <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  id="req-name-input"
                  placeholder="Ví dụ: Hoàng Long, Minh Quân..."
                  value={reqName}
                  onChange={(e) => setReqName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Email Google liên kết: {requireGoogleOnly ? <span className="text-amber-400 font-semibold">(Bắt buộc để đăng nhập)</span> : <span className="text-slate-500 font-normal">(khuyên dùng)</span>}
                </label>
                <input
                  type="email"
                  required={requireGoogleOnly}
                  placeholder="VD: hoanglong.mmo@gmail.com"
                  value={reqEmail}
                  onChange={(e) => setReqEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Mã PIN muốn đặt: <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Tối thiểu 4 số (VD: 123456)"
                    value={reqPin}
                    onChange={(e) => setReqPin(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Xác nhận mã PIN: <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Nhập lại mã PIN"
                    value={reqConfirmPin}
                    onChange={(e) => setReqConfirmPin(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Ghi chú cho Admin:
                </label>
                <input
                  type="text"
                  placeholder="VD: Em xin phụ trách trực Page và Nick Via ca chiều"
                  value={reqNote}
                  onChange={(e) => setReqNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                id="btn-submit-request-access"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>Gửi Yêu Cầu Cho Admin Phê Duyệt</span>
              </button>

              <div className="pt-1 text-center text-xs text-slate-400">
                <button
                  type="button"
                  onClick={() => setActiveTab(requireGoogleOnly ? 'google' : 'staff')}
                  className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
                >
                  {requireGoogleOnly ? '← Đã có tài khoản? Đăng Nhập Google' : '← Đã được duyệt? Bấm vào đây để Đăng Nhập'}
                </button>
              </div>
            </form>
          )}

          {/* Emergency Admin Access Link when requireGoogleOnly is true */}
          {requireGoogleOnly && activeTab !== 'admin' && (
            <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('admin');
                  setAdminError(null);
                }}
                className="text-slate-400 hover:text-amber-300 flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400/80" />
                <span>Quản Lý: Đăng nhập dự phòng bằng Master PIN</span>
              </button>
              <span className="text-slate-500 text-[10px] font-mono">Google SSO Active</span>
            </div>
          )}

          {/* Footer Note */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 text-center text-[11px] text-slate-400 flex items-center justify-center space-x-1.5">
            <span>🔐</span>
            <span>Hệ thống bảo mật dữ liệu nội bộ. Chỉ nhân viên được cấp quyền mới có thể truy cập.</span>
          </div>
        </div>

        {/* Quick Help Tip */}
        <div className="mt-4 text-center text-[11px] text-slate-500">
          Quản Lý Đăng Bài Fanpage & Nick Via • MMO PRO Hệ Thống Nội Bộ 2026
        </div>
      </div>
    </div>
  );
};
