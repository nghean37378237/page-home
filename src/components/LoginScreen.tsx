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
  RefreshCw,
  Send,
  RotateCcw,
} from 'lucide-react';
import { findMatchingAccount, normalizeVietnamese } from '../utils/helpers';
import { getCloudAccounts, subscribeToAccounts, auth } from '../services/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

interface LoginScreenProps {
  accounts: UserAccount[];
  adminPin?: string;
  onVerifyAdminPin?: (pin: string) => boolean | Promise<boolean>;
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
  onVerifyAdminPin,
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

  // Mode: 'google' (Google Sign In - MẶC ĐỊNH BẮT BUỘC CHO NHÂN VIÊN) | 'admin' (Dành riêng cho Quản Lý) | 'request' (Xin cấp quyền) | 'staff' (Dự phòng)
  const [activeTab, setActiveTab] = useState<'google' | 'admin' | 'request' | 'staff'>('google');

  // Dedicated Pending Approval State (User logged in with Gmail but needs Admin approval)
  const [pendingApprovalState, setPendingApprovalState] = useState<{
    email: string;
    username: string;
    createdAt?: string;
    isExistingRequest?: boolean;
  } | null>(null);

  // Prompt for new Gmail users to request approval from cualokhachsan@gmail.com
  const [newGoogleUserPrompt, setNewGoogleUserPrompt] = useState<{
    email: string;
    displayName: string;
  } | null>(null);

  const [isRecheckingStatus, setIsRecheckingStatus] = useState<boolean>(false);
  const [newGoogleStaffName, setNewGoogleStaffName] = useState<string>('');

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

  // Anti-Brute Force Protection States & Lockout Timers
  const [adminFailedAttempts, setAdminFailedAttempts] = useState<number>(0);
  const [adminLockoutSeconds, setAdminLockoutSeconds] = useState<number>(0);
  const [staffFailedAttempts, setStaffFailedAttempts] = useState<number>(0);
  const [staffLockoutSeconds, setStaffLockoutSeconds] = useState<number>(0);

  // Countdown timer for Admin Lockout
  useEffect(() => {
    if (adminLockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setAdminLockoutSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [adminLockoutSeconds]);

  // Countdown timer for Staff Lockout
  useEffect(() => {
    if (staffLockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setStaffLockoutSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [staffLockoutSeconds]);

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

  // Check approval status directly from Cloud Firestore
  const handleCheckApprovalStatusAgain = async () => {
    if (!pendingApprovalState?.email) return;
    setIsRecheckingStatus(true);
    try {
      const cloudAccounts = await getCloudAccounts();
      if (cloudAccounts.length > 0) {
        setLiveAccounts(cloudAccounts);
      }
      const targetEmail = pendingApprovalState.email.toLowerCase().trim();
      const updated = cloudAccounts.find((a) => a.email?.toLowerCase().trim() === targetEmail);
      if (updated && updated.status === 'approved') {
        onLoginSuccess({
          id: updated.id,
          name: updated.username,
          email: targetEmail,
          role: 'staff',
          status: 'approved',
          isAuthenticated: true,
          allowedTabs: updated.allowedTabs,
        });
        return;
      }
      if (updated && updated.status === 'blocked') {
        setGoogleError(`Tài khoản Gmail (${targetEmail}) đã bị Quản Lý (${adminEmail || 'cualokhachsan@gmail.com'}) tạm khóa.`);
        setPendingApprovalState(null);
        return;
      }
      setGoogleError(null);
    } catch (err) {
      console.error('[LoginScreen] Lỗi kiểm tra trạng thái phê duyệt:', err);
    } finally {
      setIsRecheckingStatus(false);
    }
  };

  // Quick submit approval request from Google Sign-In prompt
  const handleQuickSubmitGoogleRequest = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newGoogleUserPrompt) return;
    const name = newGoogleStaffName.trim() || newGoogleUserPrompt.displayName.trim() || newGoogleUserPrompt.email.split('@')[0];
    const email = newGoogleUserPrompt.email.trim().toLowerCase();

    if (onRequestAccess) {
      const result = onRequestAccess(name, '123456', 'Nhân viên đăng nhập bằng Gmail', email);
      if (result.success) {
        setNewGoogleUserPrompt(null);
        setPendingApprovalState({
          email,
          username: name,
          createdAt: new Date().toLocaleDateString('vi-VN'),
          isExistingRequest: true,
        });
        getCloudAccounts().then((accs) => {
          if (accs.length > 0) setLiveAccounts(accs);
        });
      } else {
        setGoogleError(result.message);
      }
    }
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

    // Verify PIN safely with anti-brute force lock
    const expectedPin = String(account.pin ?? '123456').trim();
    if (expectedPin !== staffPinInput.trim()) {
      const nextFails = staffFailedAttempts + 1;
      setStaffFailedAttempts(nextFails);
      if (nextFails >= 10) {
        setStaffLockoutSeconds(300);
        setStaffError('Hệ thống phát hiện nhập sai mã PIN quá 10 lần liên tiếp! Khóa bảo mật 5 phút (300 giây) để ngăn chặn tấn công dò quét.');
      } else if (nextFails >= 5) {
        setStaffLockoutSeconds(60);
        setStaffError('Hệ thống phát hiện nhập sai mã PIN quá 5 lần. Tạm khóa bảo vệ 60 giây để phòng chống dò mật khẩu!');
      } else {
        setStaffError(`Mã PIN không chính xác cho tài khoản "${account.username}". (Sai ${nextFails}/5 lần, nhập sai 5 lần sẽ khóa 60s)`);
      }
      return;
    }

    // Reset failed counter on successful staff login
    setStaffFailedAttempts(0);
    setStaffLockoutSeconds(0);

    // Login successful
    onLoginSuccess({
      id: account.id,
      name: account.username,
      email: account.email,
      role: 'staff',
      status: 'approved',
      isAuthenticated: true,
      allowedTabs: account.allowedTabs,
    });
  };

  // 2. Handle Admin Login Submit
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);

    if (adminLockoutSeconds > 0) {
      setAdminError(`Tài khoản Admin đang tạm khóa. Vui lòng chờ ${adminLockoutSeconds} giây để thử lại.`);
      return;
    }

    if (!adminPinInput.trim()) {
      setAdminError('Vui lòng nhập mật khẩu Quản Lý (Admin)');
      return;
    }

    const isPinValid = onVerifyAdminPin
      ? await onVerifyAdminPin(adminPinInput.trim())
      : (adminPin !== undefined && adminPinInput.trim() === adminPin.trim());

    if (isPinValid) {
      setAdminFailedAttempts(0);
      setAdminLockoutSeconds(0);
      onLoginSuccess({
        id: 'admin',
        name: adminName || 'Quản Lý (Admin)',
        email: adminEmail || 'cualokhachsan@gmail.com',
        role: 'admin',
        status: 'approved',
        isAuthenticated: true,
      });
    } else {
      const nextFails = adminFailedAttempts + 1;
      setAdminFailedAttempts(nextFails);
      if (nextFails >= 10) {
        setAdminLockoutSeconds(300);
        setAdminError('Hệ thống phát hiện nhập sai mật khẩu Quản Lý quá 10 lần liên tiếp! Khóa bảo mật 5 phút (300 giây) để phòng chống tấn công dò quét.');
      } else if (nextFails >= 5) {
        setAdminLockoutSeconds(60);
        setAdminError('Hệ thống phát hiện nhập sai mật khẩu Quản Lý quá 5 lần. Tạm khóa bảo vệ 60 giây để phòng chống dò mật khẩu!');
      } else {
        setAdminError(`Mật khẩu Quản Lý (Admin) không chính xác! (Sai ${nextFails}/5 lần, nhập sai 5 lần sẽ khóa 60s)`);
      }
    }
  };

  // 2b. Native Firebase Google Sign-In with real Google OAuth Popup
  const handleFirebaseGoogleSignIn = async () => {
    setIsGoogleSigningIn(true);
    setGoogleError(null);
    setShowLinkingBox(false);
    setPendingApprovalState(null);

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
      const currentAdminEmail = (adminEmail || 'cualokhachsan@gmail.com').trim().toLowerCase();

      // 1. Check Admin Google Account (Chỉ cualokhachsan@gmail.com)
      if (
        email === currentAdminEmail ||
        email === 'cualokhachsan@gmail.com' ||
        freshAccounts.some((a) => a.role === 'admin' && a.email?.toLowerCase() === email)
      ) {
        onLoginSuccess({
          id: 'admin',
          name: adminName || displayName || 'Quản Lý (Admin)',
          email: email,
          role: 'admin',
          status: 'approved',
          isAuthenticated: true,
          allowedTabs: [
            'fanpage',
            'group',
            'proxy',
            'fullvia',
            'staff_management',
            'shared_accounts',
            'revenue',
            'staff_info',
            'image_studio',
          ],
        });
        return;
      }

      // 2. Check Staff Google Account granted by Admin in system
      const matched =
        findMatchingAccount(email, freshAccounts) ||
        (displayName ? findMatchingAccount(displayName, freshAccounts) : undefined);

      if (matched) {
        if (matched.status === 'blocked') {
          setGoogleError(`Tài khoản Gmail "${email}" (${matched.username}) đang bị Quản Lý (${currentAdminEmail}) tạm khóa.`);
          return;
        }
        if (matched.status === 'pending') {
          setPendingApprovalState({
            email,
            username: matched.username,
            createdAt: matched.createdAt,
            isExistingRequest: true,
          });
          setGoogleError(null);
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
          allowedTabs: matched.allowedTabs,
        });
        return;
      }

      // 3. Email not granted in system by Admin
      setGoogleError(
        `Email Gmail "${email}" chưa được Quản Lý (${currentAdminEmail}) cấp quyền trong hệ thống. Vui lòng báo Quản Lý thêm Gmail này vào danh sách nhân viên!`
      );
    } catch (err: any) {
      console.warn('[LoginScreen] Lỗi Google OAuth popup:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setGoogleError('Bạn đã đóng cửa sổ đăng nhập Google trước khi hoàn tất. Bạn có thể thử lại hoặc nhập Gmail bên dưới.');
      } else if (err.code === 'auth/popup-blocked') {
        setGoogleError('Trình duyệt hoặc khung hiển thị (iFrame) đang chặn cửa sổ đăng nhập Google (Pop-up). Bạn có thể bấm chọn hoặc nhập Gmail bên dưới.');
        setIsGoogleChooserOpen(true);
      } else if (err.code === 'auth/unauthorized-domain') {
        setIsUnauthorizedDomain(true);
        setGoogleError(
          `Tên miền (${window.location.hostname}) chưa được thêm vào mục Authorized Domains trong Firebase Console. Bạn có thể nhập Gmail bên dưới để vào hệ thống ngay!`
        );
        setIsGoogleChooserOpen(true);
      } else {
        setGoogleError(`Không thể mở cửa sổ Google (${err.message || err.code}). Bạn có thể chuyển sang nhập Gmail bên dưới để tiếp tục.`);
        setIsGoogleChooserOpen(true);
      }
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  // 3. Handle Google Sign-In Step 1: Verify Email directly against Admin's authorized staff list
  const processEmailVerification = (targetEmail: string) => {
    setGoogleError(null);
    setShowLinkingBox(false);
    setPendingGoogleAuth(null);
    setPendingApprovalState(null);
    setNewGoogleUserPrompt(null);

    const freshAccounts = getFreshAccounts();
    const email = targetEmail.trim().toLowerCase();

    if (!email) {
      setGoogleError('Vui lòng nhập địa chỉ Email Gmail của bạn');
      return;
    }

    const currentAdminEmail = (adminEmail || 'cualokhachsan@gmail.com').trim().toLowerCase();

    // Check if it's the Admin email (cualokhachsan@gmail.com) - Yêu cầu nhập Pass Admin để bảo mật
    if (
      email === currentAdminEmail ||
      email === 'cualokhachsan@gmail.com' ||
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

    // Match accounts by email, or by normalized username/email prefix
    const matched = findMatchingAccount(email, freshAccounts);

    if (matched) {
      if (matched.status === 'blocked') {
        setGoogleError(`Tài khoản liên kết với Gmail "${email}" đang bị tạm khóa bởi Quản Lý (${currentAdminEmail}).`);
        return;
      }
      if (matched.status === 'pending') {
        setPendingApprovalState({
          email,
          username: matched.username,
          createdAt: matched.createdAt,
          isExistingRequest: true,
        });
        return;
      }

      // Auto-link email if not linked yet
      if (!matched.email || matched.email.toLowerCase() !== email) {
        onLinkAccountEmail?.(matched.id, email);
      }

      // Approved Staff Account in system -> Log in directly by Gmail without PIN!
      onLoginSuccess({
        id: matched.id,
        name: matched.username,
        email: email,
        role: 'staff',
        status: 'approved',
        isAuthenticated: true,
        allowedTabs: matched.allowedTabs,
      });
      return;
    }

    // If not matched, inform user that Admin must grant permission in the system
    setGoogleError(
      `Email Gmail "${email}" chưa được Quản Lý (${currentAdminEmail}) cấp quyền trong hệ thống. Vui lòng báo Quản Lý thêm Gmail này vào hệ thống!`
    );
  };

  const handleCustomGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processEmailVerification(customGoogleEmail);
  };

  const handleQuickSelectAccount = (email: string) => {
    setCustomGoogleEmail(email);
    processEmailVerification(email);
  };

  // Verify Admin Password for Admin Email
  const handleConfirmGooglePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setGoogleError(null);

    if (!pendingGoogleAuth) return;

    if (!googlePasswordInput.trim()) {
      setGoogleError('Vui lòng nhập Mật Khẩu Admin để mở khóa!');
      return;
    }

    const isPinValid = onVerifyAdminPin
      ? onVerifyAdminPin(googlePasswordInput.trim())
      : (adminPin !== undefined && googlePasswordInput.trim() === adminPin.trim());

    if (isPinValid) {
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
              <span>Bảo Mật Gmail</span>
            </div>
          </div>

          {/* TOP SECURITY NOTICE */}
          <div className="mb-3 p-2.5 bg-sky-950/70 rounded-xl border border-sky-500/40 text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center space-x-2 min-w-0">
              <Shield className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="text-[11px] text-sky-200 truncate">
                Chỉ đăng nhập bằng Gmail được Admin (<strong className="text-amber-300 font-bold">{adminEmail || 'cualokhachsan@gmail.com'}</strong>) cấp quyền
              </span>
            </div>
          </div>

          {/* CHỈ ĐỂ 2 PHẦN: LOG BẰNG GMAIL & QUẢN LÝ */}
          <div className="grid grid-cols-2 gap-2 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 text-xs font-bold mb-4">
            <button
              type="button"
              id="tab-google-login"
              onClick={() => {
                setActiveTab('google');
                setGoogleError(null);
              }}
              className={`py-2.5 px-3 rounded-lg transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                activeTab === 'google'
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <Mail className="w-4 h-4 shrink-0" />
              <span className="truncate">Log Bằng Gmail</span>
            </button>

            <button
              type="button"
              id="tab-admin-login"
              onClick={() => {
                setActiveTab('admin');
                setAdminError(null);
              }}
              className={`py-2.5 px-3 rounded-lg transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span className="truncate">Quản Lý (Admin)</span>
            </button>
          </div>

          {/* TAB 1: LOG BẰNG GMAIL */}
          {activeTab === 'google' && (
            <div className="space-y-4 animate-fadeIn">
              {/* THÔNG BÁO NẾU TÀI KHOẢN GMAIL ĐANG CHỜ DUYỆT */}
              {pendingApprovalState && (
                <div className="p-4 bg-amber-950/80 border-2 border-amber-500/80 rounded-2xl text-amber-200 text-xs space-y-3.5 shadow-2xl animate-fadeIn">
                  <div className="flex items-start space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-amber-300">
                        Tài Khoản Gmail Đang Chờ Admin Kích Hoạt
                      </h4>
                      <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                        Gmail của bạn cần được Quản Lý bật quyền hoạt động trong hệ thống trước khi truy cập bảng làm việc.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950/90 rounded-xl border border-slate-800 space-y-2 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Gmail nhân viên:</span>
                      <span className="text-amber-300 font-mono font-bold truncate max-w-[200px]">
                        {pendingApprovalState.email}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Họ & Tên:</span>
                      <span className="text-white font-bold">{pendingApprovalState.username}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Admin cấp quyền:</span>
                      <span className="text-emerald-400 font-mono font-bold">
                        {adminEmail || 'cualokhachsan@gmail.com'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCheckApprovalStatusAgain}
                      disabled={isRecheckingStatus}
                      className="flex-1 py-3 px-3.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-60 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg"
                    >
                      <RefreshCw className={`w-4 h-4 ${isRecheckingStatus ? 'animate-spin' : ''}`} />
                      <span>{isRecheckingStatus ? 'Đang kiểm tra...' : 'Kiểm Tra Lại Quyền Truy Cập'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingApprovalState(null);
                        setGoogleError(null);
                      }}
                      className="py-3 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Đổi Gmail Khác
                    </button>
                  </div>
                </div>
              )}

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
                    👉 <strong>Đăng nhập ngay không cần chờ:</strong> Bạn và nhân viên có thể nhập hoặc chọn Gmail đã được Admin cấp quyền bên dưới để vào thẳng hệ thống!
                  </p>
                </div>
              )}

              {googleError && !isUnauthorizedDomain && (
                <div className="p-3.5 bg-red-950/80 border border-red-700/70 rounded-xl text-red-200 text-xs space-y-2.5 shadow-md animate-fadeIn">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span className="leading-snug">{googleError}</span>
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
                    ? 'Đang kết nối tài khoản Gmail...'
                    : 'Đăng nhập bằng Gmail (Google)'}
                </span>
              </button>

              {/* Direct Gmail Entry / Quick Select for Authorized Staff */}
              <div className="p-4 bg-slate-900/95 rounded-xl border border-sky-500/30 space-y-3.5 shadow-xl">
                <div className="flex items-center justify-between text-xs text-slate-200 font-bold border-b border-slate-800 pb-2">
                  <span className="flex items-center space-x-1.5 text-sky-400">
                    <Mail className="w-3.5 h-3.5 text-sky-400" />
                    <span>Đăng Nhập Nhanh Bằng Gmail Đã Cấp Quyền</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold">
                    {approvedStaffAccounts.length} Gmail được phép
                  </span>
                </div>

                {pendingGoogleAuth ? (
                  <form onSubmit={handleConfirmGooglePassword} className="space-y-3.5">
                    <div className="p-3 rounded-xl border text-xs bg-amber-950/50 border-amber-500/50 text-amber-200">
                      <div className="flex items-center space-x-1.5 font-bold mb-1">
                        <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-amber-300">Xác Thực Email Quản Trị Viên (Admin)</span>
                      </div>
                      <div className="text-[11px] text-slate-300 font-mono break-all mb-1.5">
                        {pendingGoogleAuth.email}
                      </div>
                      <p className="text-[10.5px] leading-snug text-slate-300">
                        Nhập Mật Khẩu Admin để mở khóa quyền Quản Trị tối cao:
                      </p>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-300 font-bold mb-1">
                        Mật Khẩu Quản Lý (Admin):
                      </label>
                      <div className="relative">
                        <input
                          type={showGooglePassword ? 'text' : 'password'}
                          id="input-google-password"
                          placeholder="Nhập mật khẩu Admin..."
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
                        ← Đổi Gmail
                      </button>
                      <button
                        type="submit"
                        id="btn-verify-google-password"
                        className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center space-x-1.5 shadow-md"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Mở Khóa Admin</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-3">
                    {/* Manual Gmail Input */}
                    <form onSubmit={handleCustomGoogleSubmit} className="space-y-2.5">
                      <div>
                        <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                          Nhập Địa Chỉ Gmail Đã Được Admin Cấp Quyền:
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="email"
                            id="input-google-email"
                            placeholder="VD: nhanvien@gmail.com"
                            value={customGoogleEmail}
                            onChange={(e) => setCustomGoogleEmail(e.target.value)}
                            className="flex-1 px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500 font-mono"
                          />
                          <button
                            type="submit"
                            id="btn-confirm-google-email"
                            className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center space-x-1.5 shadow-sm shrink-0"
                          >
                            <span>Vào Hệ Thống</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </form>

                    {/* Quick Select Authorized Staff Gmails */}
                    {approvedStaffAccounts.length > 0 && (
                      <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                        <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
                          <span>Hoặc bấm chọn Gmail nhân viên đã cấp quyền:</span>
                        </div>
                        <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
                          {approvedStaffAccounts.map((staff) => {
                            const staffEmailDisplay =
                              staff.email || `${staff.username.toLowerCase().replace(/\s+/g, '')}@gmail.com`;
                            return (
                              <button
                                key={staff.id}
                                type="button"
                                onClick={() => handleQuickSelectAccount(staffEmailDisplay)}
                                className="p-2.5 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-sky-500/60 rounded-xl text-left transition-all flex items-center space-x-2.5 cursor-pointer group"
                              >
                                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-slate-200 truncate flex items-center space-x-1.5">
                                    <span>{staff.username}</span>
                                    <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-medium">
                                      Đã cấp quyền
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-sky-400 font-mono truncate">
                                    {staffEmailDisplay}
                                  </div>
                                </div>
                                <span className="text-[10px] text-sky-400 font-bold shrink-0">Đăng nhập →</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: QUẢN LÝ (ADMIN) */}
          {activeTab === 'admin' && (
            <form onSubmit={handleAdminLogin} className="space-y-4 animate-fadeIn">
              <div className="p-3.5 bg-amber-950/40 border border-amber-600/40 rounded-xl text-xs text-amber-200 space-y-1.5">
                <div className="font-bold flex items-center space-x-1.5 text-amber-300">
                  <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Quản Trị Hệ Thống & Cấp Quyền Gmail Nhân Viên</span>
                </div>
                <p className="text-[11px] text-amber-200/80 leading-relaxed">
                  Tài khoản Admin (<strong className="text-white font-mono">{adminEmail || 'cualokhachsan@gmail.com'}</strong>) có toàn quyền thêm Gmail nhân viên mới, phân quyền bảng làm việc và quản lý dữ liệu.
                </p>
              </div>

              {adminError && (
                <div className="p-2.5 bg-red-950/70 border border-red-700/60 rounded-xl text-red-200 text-xs flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">{adminError}</span>
                </div>
              )}

              {/* Option 1: Login Admin via Google OAuth (cualokhachsan@gmail.com) */}
              <div>
                <button
                  type="button"
                  disabled={isGoogleSigningIn}
                  onClick={handleFirebaseGoogleSignIn}
                  className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 font-extrabold rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2.5 border border-slate-300"
                >
                  <Mail className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Đăng Nhập Nhanh Bằng Gmail Admin ({adminEmail || 'cualokhachsan@gmail.com'})</span>
                </button>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="shrink mx-3 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  Hoặc mở khóa bằng Mật Khẩu Admin
                </span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Mật Khẩu Quản Lý (Admin):</span>
                  <span className="text-[10px] text-amber-400 font-semibold">Bảo mật Quản Trị</span>
                </label>
                <div className="relative">
                  <input
                    type={showAdminPin ? 'text' : 'password'}
                    id="input-admin-password"
                    disabled={adminLockoutSeconds > 0}
                    placeholder={adminLockoutSeconds > 0 ? `Đang khóa (${adminLockoutSeconds}s)...` : "Nhập mật khẩu Admin..."}
                    value={adminPinInput}
                    onChange={(e) => setAdminPinInput(e.target.value)}
                    className="w-full px-3 py-2.5 pr-10 bg-slate-950 border border-slate-700 disabled:opacity-50 rounded-xl text-white text-xs font-mono focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
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
                disabled={adminLockoutSeconds > 0}
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-2"
              >
                {adminLockoutSeconds > 0 ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin text-amber-200" />
                    <span>⏳ Tạm Khóa An Toàn ({adminLockoutSeconds}s)</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Đăng Nhập Quản Trị Viên (Admin)</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Footer Note */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 text-center text-[11px] text-slate-400 flex items-center justify-center space-x-1.5">
            <span>🔐</span>
            <span>Bảo mật tuyệt đối: Chỉ Gmail đã được Admin cấp quyền trong hệ thống mới được truy cập.</span>
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
