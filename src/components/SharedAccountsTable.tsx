import React, { useState, useMemo } from 'react';
import {
  Globe,
  Key,
  ShieldCheck,
  Eye,
  EyeOff,
  Copy,
  Check,
  Plus,
  Search,
  ExternalLink,
  Edit2,
  Trash2,
  Users,
  UserCheck,
  Sparkles,
  Lock,
  Unlock,
  AlertCircle,
  X,
  Save,
  RefreshCw,
  Info,
} from 'lucide-react';
import { SharedAccount, AppUser } from '../types';

interface SharedAccountsTableProps {
  accounts: SharedAccount[];
  currentUser: AppUser;
  availableStaffNames: string[];
  onAddAccount: (account: SharedAccount) => Promise<void>;
  onUpdateAccount: (id: string, updates: Partial<SharedAccount>) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
}

export const SharedAccountsTable: React.FC<SharedAccountsTableProps> = ({
  accounts,
  currentUser,
  availableStaffNames,
  onAddAccount,
  onUpdateAccount,
  onDeleteAccount,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const myStaffName = (currentUser.name || '').trim().toLowerCase();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState('ALL');

  // Password visibility map (id -> boolean)
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  // Master reveal all
  const [revealAllPasswords, setRevealAllPasswords] = useState(false);

  // Copied feedback map (key -> boolean)
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SharedAccount | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form fields
  const [formWebsiteName, setFormWebsiteName] = useState('');
  const [formWebsiteUrl, setFormWebsiteUrl] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formTwoFa, setFormTwoFa] = useState('');
  const [formNote, setFormNote] = useState('');
  const [isAllStaffAssigned, setIsAllStaffAssigned] = useState(true);
  const [selectedStaffList, setSelectedStaffList] = useState<string[]>([]);

  // Delete confirm state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  // Toggle single password visibility
  const togglePasswordVisibility = (id: string) => {
    setShowPasswordMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Strict Scoping: Staff only sees accounts assigned to 'ALL' or explicitly to their name
  const accessibleAccounts = useMemo(() => {
    if (isAdmin) return accounts;
    return accounts.filter((acc) => {
      const assigned = acc.assignedStaff || ['ALL'];
      if (assigned.includes('ALL')) return true;
      return assigned.some((name) => name.trim().toLowerCase() === myStaffName);
    });
  }, [accounts, isAdmin, myStaffName]);

  // Filtered accounts for display
  const filteredAccounts = useMemo(() => {
    let list = accessibleAccounts;

    // Filter by staff (Admin only)
    if (isAdmin && selectedStaffFilter !== 'ALL') {
      if (selectedStaffFilter === 'ONLY_ALL') {
        list = list.filter((a) => (a.assignedStaff || []).includes('ALL'));
      } else {
        list = list.filter((a) => {
          const assigned = a.assignedStaff || [];
          return assigned.includes('ALL') || assigned.includes(selectedStaffFilter);
        });
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.websiteName.toLowerCase().includes(q) ||
          a.username.toLowerCase().includes(q) ||
          (a.websiteUrl && a.websiteUrl.toLowerCase().includes(q)) ||
          (a.note && a.note.toLowerCase().includes(q))
      );
    }

    return list;
  }, [accessibleAccounts, isAdmin, selectedStaffFilter, searchQuery]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingAccount(null);
    setFormWebsiteName('');
    setFormWebsiteUrl('');
    setFormUsername('');
    setFormPassword('');
    setFormTwoFa('');
    setFormNote('');
    setIsAllStaffAssigned(true);
    setSelectedStaffList([]);
    setModalError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (acc: SharedAccount) => {
    setEditingAccount(acc);
    setFormWebsiteName(acc.websiteName || '');
    setFormWebsiteUrl(acc.websiteUrl || '');
    setFormUsername(acc.username || '');
    setFormPassword(acc.password || '');
    setFormTwoFa(acc.twoFa || '');
    setFormNote(acc.note || '');
    const assigned = acc.assignedStaff || ['ALL'];
    if (assigned.includes('ALL')) {
      setIsAllStaffAssigned(true);
      setSelectedStaffList([]);
    } else {
      setIsAllStaffAssigned(false);
      setSelectedStaffList(assigned);
    }
    setModalError(null);
    setIsModalOpen(true);
  };

  // Toggle staff selection for form
  const handleToggleStaffSelection = (staffName: string) => {
    setSelectedStaffList((prev) => {
      if (prev.includes(staffName)) {
        return prev.filter((s) => s !== staffName);
      } else {
        return [...prev, staffName];
      }
    });
  };

  // Select/Deselect all staff
  const handleSelectAllStaff = () => {
    setSelectedStaffList([...availableStaffNames]);
  };
  const handleDeselectAllStaff = () => {
    setSelectedStaffList([]);
  };

  // Save Modal Form
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const name = formWebsiteName.trim();
    const uname = formUsername.trim();
    const pass = formPassword.trim();

    if (!name) {
      setModalError('Vui lòng nhập Tên Trang Web hoặc Công Cụ');
      return;
    }
    if (!uname) {
      setModalError('Vui lòng nhập Tên Đăng Nhập / Email');
      return;
    }
    if (!pass) {
      setModalError('Vui lòng nhập Mật Khẩu (Pass)');
      return;
    }

    const assignedStaff = isAllStaffAssigned
      ? ['ALL']
      : selectedStaffList.length > 0
      ? selectedStaffList
      : ['ALL']; // Default to ALL if none selected

    setIsSubmitting(true);
    try {
      if (editingAccount) {
        // Update existing
        await onUpdateAccount(editingAccount.id, {
          websiteName: name,
          websiteUrl: formWebsiteUrl.trim() || undefined,
          username: uname,
          password: pass,
          twoFa: formTwoFa.trim() || undefined,
          assignedStaff,
          note: formNote.trim() || undefined,
          updatedAt: new Date().toLocaleDateString('vi-VN'),
        });
      } else {
        // Create new
        const newAcc: SharedAccount = {
          id: `shared-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          websiteName: name,
          websiteUrl: formWebsiteUrl.trim() || undefined,
          username: uname,
          password: pass,
          twoFa: formTwoFa.trim() || undefined,
          assignedStaff,
          note: formNote.trim() || undefined,
          createdAt: new Date().toLocaleDateString('vi-VN'),
          updatedAt: new Date().toLocaleDateString('vi-VN'),
        };
        await onAddAccount(newAcc);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Lỗi khi lưu tài khoản:', err);
      setModalError(err.message || 'Không thể lưu tài khoản. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick preset template
  const handleApplyPreset = (siteName: string, url: string) => {
    setFormWebsiteName(siteName);
    setFormWebsiteUrl(url);
  };

  return (
    <div className="space-y-4" id="shared-accounts-section">
      {/* Header & Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Title & Badge */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-800">
                  Bảng Quản Lý Tài Khoản Dùng Chung
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-bold bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                  {accessibleAccounts.length} Tài Khoản
                </span>
                {isAdmin && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 rounded-md border border-amber-200 flex items-center space-x-1">
                    <ShieldCheck className="w-3 h-3 text-amber-600" />
                    <span>Quyền Admin</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isAdmin
                  ? 'Quản lý tài khoản các trang web/công cụ (Canva, ChatGPT, CapCut...) và phân quyền cho nhân viên'
                  : `Danh sách các tài khoản trang web/tool bạn được phân quyền truy cập và sử dụng`}
              </p>
            </div>
          </div>

          {/* Action buttons & Search */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm trang web, username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter by Staff (Admin only) */}
            {isAdmin && (
              <select
                value={selectedStaffFilter}
                onChange={(e) => setSelectedStaffFilter(e.target.value)}
                className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">Tất Cả Phân Quyền</option>
                <option value="ONLY_ALL">Dùng Chung Cho Tất Cả NV</option>
                {availableStaffNames.map((name) => (
                  <option key={name} value={name}>
                    NV: {name}
                  </option>
                ))}
              </select>
            )}

            {/* Master Reveal Toggle */}
            <button
              onClick={() => setRevealAllPasswords(!revealAllPasswords)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors border cursor-pointer ${
                revealAllPasswords
                  ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
              title={revealAllPasswords ? 'Ẩn tất cả mật khẩu' : 'Hiện tất cả mật khẩu'}
            >
              {revealAllPasswords ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                  <span>Ẩn Mật Khẩu</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-slate-600" />
                  <span>Hiện Mật Khẩu</span>
                </>
              )}
            </button>

            {/* Add Account Button (Admin only) */}
            {isAdmin && (
              <button
                onClick={handleOpenCreateModal}
                id="btn-add-shared-account"
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-bold shadow-sm shadow-indigo-100 flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Tài Khoản Mới</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white uppercase text-[11px] font-bold tracking-wider">
                <th className="py-3 px-3 w-12 text-center">STT</th>
                <th className="py-3 px-4 min-w-[180px]">Tên Trang Web</th>
                <th className="py-3 px-4 min-w-[200px]">Tên Đăng Nhập</th>
                <th className="py-3 px-4 min-w-[180px]">Mật Khẩu (Pass)</th>
                <th className="py-3 px-4 min-w-[160px]">Mã 2FA (Nếu Có)</th>
                <th className="py-3 px-4 min-w-[200px]">Nhân Viên Được Dùng</th>
                <th className="py-3 px-4 w-28 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Globe className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="font-semibold text-slate-600 text-xs">
                        {searchQuery
                          ? 'Không tìm thấy tài khoản phù hợp với tìm kiếm.'
                          : 'Chưa có tài khoản nào được phân quyền cho bạn.'}
                      </p>
                      {isAdmin && !searchQuery && (
                        <button
                          onClick={handleOpenCreateModal}
                          className="mt-2 inline-flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Thêm Tài Khoản Đầu Tiên</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc, index) => {
                  const isPassVisible = revealAllPasswords || !!showPasswordMap[acc.id];
                  const assigned = acc.assignedStaff || ['ALL'];
                  const isAllStaff = assigned.includes('ALL');

                  return (
                    <tr
                      key={acc.id}
                      className="hover:bg-indigo-50/40 transition-colors group"
                    >
                      {/* 1. STT */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-500">
                        {index + 1}
                      </td>

                      {/* 2. Tên Trang Web */}
                      <td className="py-3 px-4">
                        <div className="flex items-start space-x-2.5">
                          <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                            <Globe className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-slate-800 text-xs">
                                {acc.websiteName}
                              </span>
                              {acc.websiteUrl && (
                                <a
                                  href={
                                    acc.websiteUrl.startsWith('http')
                                      ? acc.websiteUrl
                                      : `https://${acc.websiteUrl}`
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-slate-400 hover:text-indigo-600 transition-colors"
                                  title={`Mở trang web: ${acc.websiteUrl}`}
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                            {acc.note && (
                              <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                {acc.note}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 3. Tên Đăng Nhập */}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-between group/user">
                          <span className="font-mono text-xs font-semibold text-slate-800 select-all">
                            {acc.username}
                          </span>
                          <button
                            onClick={() => handleCopy(acc.username, `user-${acc.id}`)}
                            className="opacity-60 group-hover/user:opacity-100 hover:text-indigo-600 p-1 rounded hover:bg-slate-100 transition-all cursor-pointer"
                            title="Sao chép tên đăng nhập"
                          >
                            {copiedKey === `user-${acc.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-slate-500" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* 4. Mật Khẩu (Pass) */}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-between group/pass">
                          <div className="font-mono text-xs font-bold text-slate-800 flex items-center space-x-1">
                            {isPassVisible ? (
                              <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 select-all">
                                {acc.password}
                              </span>
                            ) : (
                              <span className="text-slate-400 tracking-wider select-none">
                                ••••••••••••
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => togglePasswordVisibility(acc.id)}
                              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                              title={isPassVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                            >
                              {isPassVisible ? (
                                <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => handleCopy(acc.password, `pass-${acc.id}`)}
                              className="opacity-70 group-hover/pass:opacity-100 hover:text-indigo-600 p-1 rounded hover:bg-slate-100 transition-all cursor-pointer"
                              title="Sao chép mật khẩu"
                            >
                              {copiedKey === `pass-${acc.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 text-slate-500" />
                              )}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* 5. Mã 2FA Nếu Có */}
                      <td className="py-3 px-4">
                        {acc.twoFa ? (
                          <div className="flex items-center justify-between group/twofa">
                            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 select-all max-w-[120px] truncate">
                              {acc.twoFa}
                            </span>
                            <button
                              onClick={() => handleCopy(acc.twoFa || '', `2fa-${acc.id}`)}
                              className="opacity-70 group-hover/twofa:opacity-100 hover:text-indigo-600 p-1 rounded hover:bg-slate-100 transition-all cursor-pointer"
                              title="Sao chép mã 2FA"
                            >
                              {copiedKey === `2fa-${acc.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 text-slate-500" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-mono text-xs italic">
                            Không có
                          </span>
                        )}
                      </td>

                      {/* 6. Nhân Viên Được Thấy Và Dùng */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 items-center">
                          {isAllStaff ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold text-[11px]">
                              <Users className="w-3 h-3 text-emerald-600" />
                              <span>Tất Cả Nhân Viên</span>
                            </span>
                          ) : (
                            assigned.map((staffName) => (
                              <span
                                key={staffName}
                                className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded font-semibold text-[11px] border ${
                                  staffName.trim().toLowerCase() === myStaffName
                                    ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                <UserCheck className="w-3 h-3 text-slate-500" />
                                <span>{staffName}</span>
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      {/* 7. Thao Tác */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          {/* Copy Full Credentials (Username | Password) */}
                          <button
                            onClick={() => {
                              const fullText = `Web: ${acc.websiteName}\nUser: ${acc.username}\nPass: ${acc.password}${
                                acc.twoFa ? `\n2FA: ${acc.twoFa}` : ''
                              }`;
                              handleCopy(fullText, `all-${acc.id}`);
                            }}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                            title="Sao chép toàn bộ thông tin tài khoản"
                          >
                            {copiedKey === `all-${acc.id}` ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>

                          {/* Admin Edit & Delete Actions */}
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => handleOpenEditModal(acc)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                title="Chỉnh sửa tài khoản"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeletingId(acc.id)}
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                title="Xóa tài khoản"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between text-[11px] text-slate-500 gap-2">
          <div className="flex items-center space-x-2">
            <Info className="w-3.5 h-3.5 text-indigo-500" />
            <span>
              Tài khoản được lưu trữ bảo mật và đồng bộ thời gian thực qua Cloud Firestore.
            </span>
          </div>
          <div className="font-semibold text-slate-600">
            Hiển thị {filteredAccounts.length} / {accessibleAccounts.length} tài khoản
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">
                Xác Nhận Xóa Tài Khoản Này?
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn xóa tài khoản này khỏi danh sách dùng chung? Hành động này sẽ được đồng bộ ngay trên toàn bộ nhân viên.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setDeletingId(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={async () => {
                  if (deletingId) {
                    await onDeleteAccount(deletingId);
                    setDeletingId(null);
                  }
                }}
                className="px-4 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg cursor-pointer shadow-sm"
              >
                Xác Nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-700 to-indigo-800 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Globe className="w-5 h-5 text-indigo-200" />
                <div>
                  <h3 className="font-bold text-sm">
                    {editingAccount ? 'Chỉnh Sửa Tài Khoản Dùng Chung' : 'Thêm Tài Khoản Dùng Chung Mới'}
                  </h3>
                  <p className="text-[11px] text-indigo-200">
                    Cấu hình thông tin đăng nhập và phân quyền nhân sự được phép sử dụng
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-indigo-200 hover:text-white p-1 rounded-lg hover:bg-indigo-600/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveForm} className="p-5 space-y-4 text-xs">
              {/* Error Message */}
              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Quick Presets for New Account */}
              {!editingAccount && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                    Gợi ý mẫu dịch vụ thường dùng:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { name: 'Canva Pro', url: 'https://canva.com' },
                      { name: 'ChatGPT Plus', url: 'https://chatgpt.com' },
                      { name: 'CapCut Pro', url: 'https://capcut.com' },
                      { name: 'Gmail Team', url: 'https://mail.google.com' },
                      { name: 'Proxy / VPS', url: '' },
                    ].map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => handleApplyPreset(preset.name, preset.url)}
                        className="px-2 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 border border-slate-200 rounded text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer"
                      >
                        + {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 1. Website Name & Link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tên Trang Web / Công Cụ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: ChatGPT Plus, Canva Pro..."
                    value={formWebsiteName}
                    onChange={(e) => setFormWebsiteName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Link Truy Cập (URL)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: https://chatgpt.com"
                    value={formWebsiteUrl}
                    onChange={(e) => setFormWebsiteUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* 2. Username & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tên Đăng Nhập / Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: teamagency@gmail.com"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Mật Khẩu (Pass) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nhập mật khẩu..."
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* 3. 2FA Code or Secret Key */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Mã 2FA / Khóa Bảo Mật (Nếu có)
                </label>
                <input
                  type="text"
                  placeholder="VD: JBSWY3DPEHPK3PXP hoặc mã xác thực phụ..."
                  value={formTwoFa}
                  onChange={(e) => setFormTwoFa(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Nhân viên có thể bấm 1-click copy mã 2FA này để lấy mã xác nhận khi đăng nhập.
                </p>
              </div>

              {/* 4. Permissions: Cho nhân viên nào thấy và dùng */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <Users className="w-4 h-4 text-indigo-600" />
                    <span>Phân Quyền: Nhân Viên Nào Có Thể Thấy Và Dùng?</span>
                  </span>
                </label>

                {/* Radio choice: All vs Custom */}
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="staffAssignmentOption"
                      checked={isAllStaffAssigned}
                      onChange={() => setIsAllStaffAssigned(true)}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-semibold text-slate-700">
                      Tất Cả Nhân Viên (Mọi người đều dùng được)
                    </span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="staffAssignmentOption"
                      checked={!isAllStaffAssigned}
                      onChange={() => setIsAllStaffAssigned(false)}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-semibold text-slate-700">
                      Chỉ Nhân Viên Được Chọn
                    </span>
                  </label>
                </div>

                {/* Specific staff selector checkbox list */}
                {!isAllStaffAssigned && (
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">
                        Tick chọn các nhân viên được phép thấy tài khoản này:
                      </span>
                      <div className="space-x-2 text-[11px]">
                        <button
                          type="button"
                          onClick={handleSelectAllStaff}
                          className="text-indigo-600 hover:underline font-semibold"
                        >
                          Chọn tất cả
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={handleDeselectAllStaff}
                          className="text-slate-500 hover:underline"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1">
                      {availableStaffNames.map((name) => {
                        const isChecked = selectedStaffList.includes(name);
                        return (
                          <label
                            key={name}
                            className={`flex items-center space-x-2 p-1.5 rounded-lg border cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleStaffSelection(name)}
                              className="w-3.5 h-3.5 text-indigo-600 rounded focus:ring-indigo-500"
                            />
                            <span className="truncate text-xs">{name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Ghi Chú */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Ghi Chú Sử Dụng (Tùy chọn)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Không đổi pass, dùng chung cho tổ kịch bản..."
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 text-white font-bold rounded-lg shadow-sm flex items-center space-x-1.5 cursor-pointer transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang Lưu Lên Cloud...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>{editingAccount ? 'Lưu Thay Đổi' : 'Thêm Tài Khoản'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
