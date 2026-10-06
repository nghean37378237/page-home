import React, { useState, useMemo } from 'react';
import {
  Search,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Layers,
  Sparkles,
  ExternalLink,
  Edit2,
  Save,
  X,
} from 'lucide-react';
import { PageRecord, AppUser } from '../types';
import { parseFullVia } from '../utils/helpers';

interface QuickViaLookupProps {
  allRecords: PageRecord[];
  currentUser: AppUser;
  onUpdateFullViaForAll?: (viaUid: string, newFullVia: string) => void;
  onFilterVia?: (viaUid: string) => void;
}

export const QuickViaLookup: React.FC<QuickViaLookupProps> = ({
  allRecords,
  currentUser,
  onUpdateFullViaForAll,
  onFilterVia,
}) => {
  const [searchUid, setSearchUid] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isEditingAdmin, setIsEditingAdmin] = useState<boolean>(false);
  const [adminFullViaDraft, setAdminFullViaDraft] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Group all records by viaUid to find all unique Vias in company
  const systemViasMap = useMemo(() => {
    const map = new Map<
      string,
      {
        viaUid: string;
        staffName: string;
        fullVia: string;
        pages: { name: string; link: string }[];
      }
    >();

    allRecords.forEach((r) => {
      const uid = r.viaUid.trim();
      if (!uid) return;
      if (!map.has(uid)) {
        map.set(uid, {
          viaUid: uid,
          staffName: r.staffName,
          fullVia: r.fullVia || '',
          pages: [],
        });
      }
      const item = map.get(uid)!;
      if (!item.fullVia && r.fullVia) {
        item.fullVia = r.fullVia;
      }
      item.pages.push({ name: r.pageName, link: r.pageLink });
    });

    return map;
  }, [allRecords]);

  // List of Vias belonging to the current user (if staff) or all (if admin)
  const myAssignedVias = useMemo(() => {
    const list: { viaUid: string; pageCount: number; hasFullVia: boolean }[] = [];
    systemViasMap.forEach((val) => {
      const isMine =
        currentUser.role === 'admin' ||
        val.staffName.trim().toLowerCase() === currentUser.name.trim().toLowerCase();
      if (isMine) {
        list.push({
          viaUid: val.viaUid,
          pageCount: val.pages.length,
          hasFullVia: Boolean(val.fullVia),
        });
      }
    });
    return list;
  }, [systemViasMap, currentUser]);

  // Evaluate query
  const trimmedSearch = searchUid.trim();
  const foundVia = trimmedSearch ? systemViasMap.get(trimmedSearch) : null;

  // Check authorization
  const isAuthorized = useMemo(() => {
    if (!foundVia) return false;
    if (currentUser.role === 'admin') return true;
    return (
      foundVia.staffName.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
    );
  }, [foundVia, currentUser]);

  const parsed = useMemo(() => {
    return parseFullVia(foundVia?.fullVia);
  }, [foundVia]);

  const handleCopy = async (text: string, keyName: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(keyName);
      setTimeout(() => {
        setCopiedKey((curr) => (curr === keyName ? null : curr));
      }, 2000);
    } catch (err) {
      console.error('Không thể sao chép:', err);
    }
  };

  const handleSaveAdminFullVia = () => {
    if (!foundVia || !onUpdateFullViaForAll) return;
    onUpdateFullViaForAll(foundVia.viaUid, adminFullViaDraft.trim());
    setIsEditingAdmin(false);
  };

  return (
    <div className="bg-gradient-to-r from-emerald-900 via-[#1b4332] to-[#2d6a4f] text-white rounded-xl shadow-md border border-emerald-700/50 p-3.5 sm:p-4 mb-3">
      {/* Header bar of Quick Lookup */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-emerald-600/40">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
            <Key className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-tight text-white flex items-center space-x-2">
              <span>Tra Cứu Nhanh Full Via (UID|PASS|2FA)</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full font-mono">
                {currentUser.role === 'admin' ? 'Quyền Admin: Tất Cả Via' : `Quyền NV: ${currentUser.name}`}
              </span>
            </h3>
            <p className="text-[11px] text-emerald-200/80">
              Nhập hoặc chọn UID Nick Via để lấy thông tin đăng nhập Full Via được phân công.
            </p>
          </div>
        </div>

        {/* Toggle open/collapse details if needed */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-emerald-200 hover:text-white underline font-medium self-end sm:self-center"
        >
          {isExpanded ? 'Thu gọn tra cứu' : 'Mở rộng hướng dẫn'}
        </button>
      </div>

      {/* Quick search input */}
      <div className="mt-3 flex flex-col sm:flex-row items-stretch gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-emerald-300 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchUid}
            onChange={(e) => {
              setSearchUid(e.target.value);
              setIsEditingAdmin(false);
            }}
            placeholder="Dán hoặc nhập UID nick Via cần lấy Full..."
            className="w-full pl-9 pr-8 py-2 bg-emerald-950/60 border border-emerald-500/50 rounded-lg text-white placeholder-emerald-300/50 focus:outline-hidden focus:ring-2 focus:ring-emerald-400 text-xs sm:text-sm font-mono"
          />
          {searchUid && (
            <button
              type="button"
              onClick={() => {
                setSearchUid('');
                setIsEditingAdmin(false);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-300/70 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick select chips for user's assigned Vias */}
        {myAssignedVias.length > 0 && (
          <div className="flex items-center space-x-1 overflow-x-auto py-0.5 max-w-full sm:max-w-md">
            <span className="text-[11px] text-emerald-200 shrink-0 mr-1 font-medium">
              Via của bạn:
            </span>
            {myAssignedVias.map((v) => (
              <button
                key={v.viaUid}
                type="button"
                onClick={() => {
                  setSearchUid(v.viaUid);
                  setIsEditingAdmin(false);
                }}
                className={`text-[11px] font-mono px-2 py-1 rounded border transition-colors shrink-0 ${
                  searchUid === v.viaUid
                    ? 'bg-emerald-400 text-emerald-950 font-bold border-white'
                    : 'bg-emerald-800/60 hover:bg-emerald-700/80 text-emerald-100 border-emerald-600/60'
                }`}
                title={`UID: ${v.viaUid} (${v.pageCount} page)`}
              >
                {v.viaUid.slice(-6)} ({v.pageCount}p)
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Result Card when UID is entered */}
      {trimmedSearch && (
        <div className="mt-3 transition-all animate-fadeIn">
          {!foundVia ? (
            <div className="p-3 bg-emerald-950/80 border border-emerald-600/50 rounded-lg text-xs flex items-center space-x-2 text-amber-200">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Không tìm thấy Nick Via có UID <strong>{trimmedSearch}</strong> trong hệ thống. Hãy kiểm tra lại dãy số UID.
              </span>
            </div>
          ) : !isAuthorized ? (
            /* SECURITY BLOCK: Employee tries to view a Via assigned to someone else */
            <div className="p-3.5 bg-rose-950/80 border border-rose-500/60 rounded-xl text-xs text-rose-100 flex items-start space-x-3 shadow-inner">
              <Lock className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-rose-200 flex items-center space-x-1.5">
                  <span>🔒 GIỚI HẠN BẢO MẬT PHÂN QUYỀN NHÂN VIÊN</span>
                </div>
                <p className="text-rose-200/90 text-[11px] leading-relaxed">
                  Nick Via UID <strong>{trimmedSearch}</strong> đang được phân công cho nhân viên{' '}
                  <strong className="text-white underline">{foundVia.staffName}</strong>. Theo chính sách bảo mật,
                  bạn (<strong>{currentUser.name}</strong>) chỉ có quyền xem thông tin Full Via (UID|PASS|2FA) của các Nick Via được giao cho mình.
                </p>
              </div>
            </div>
          ) : (
            /* AUTHORIZED VIEW: Staff views their own Via, or Admin views any Via */
            <div className="p-3.5 bg-emerald-950/90 border-2 border-emerald-400 rounded-xl text-xs space-y-3 shadow-lg">
              {/* Top info badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-emerald-800/70">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-bold text-white text-xs sm:text-sm font-mono">
                    UID: {foundVia.viaUid}
                  </span>
                  <span className="bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                    Người phụ trách: {foundVia.staffName}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-[11px] text-emerald-300">
                    Cầm {foundVia.pages.length} Fanpage
                  </span>
                  {onFilterVia && (
                    <button
                      type="button"
                      onClick={() => onFilterVia(foundVia.viaUid)}
                      className="text-[11px] text-emerald-200 hover:text-white underline inline-flex items-center space-x-0.5"
                    >
                      <span>Lọc trên bảng</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Full Via credentials display / edit */}
              {currentUser.role === 'admin' && isEditingAdmin ? (
                <div className="space-y-2 bg-emerald-900/40 p-2.5 rounded-lg border border-emerald-500/40">
                  <label className="block text-[11px] font-bold text-emerald-200">
                    Chỉnh sửa chuỗi Full Via (Định dạng UID|PASS|2FA):
                  </label>
                  <input
                    type="text"
                    value={adminFullViaDraft}
                    onChange={(e) => setAdminFullViaDraft(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-black/50 border border-emerald-400 rounded font-mono text-xs text-white"
                    placeholder="Ví dụ: 100058675316160|MatKhau123@|JBSWY3DPEHPK3PXP"
                  />
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSaveAdminFullVia}
                      className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold rounded text-xs flex items-center space-x-1"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Lưu Full Via</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingAdmin(false)}
                      className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              ) : foundVia.fullVia ? (
                <div className="space-y-2.5">
                  {/* Entire raw UID|PASS|2FA string with 1-click copy */}
                  <div className="bg-black/50 border border-emerald-500/40 rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex-1 overflow-hidden font-mono text-xs">
                      <span className="text-emerald-400 font-bold block text-[10px] uppercase tracking-wider mb-0.5">
                        Chuỗi Full Via Đăng Nhập (UID|PASS|2FA):
                      </span>
                      <span className="text-white select-all break-all font-semibold">
                        {showPassword
                          ? foundVia.fullVia
                          : parsed
                          ? `${parsed.uid}|••••••••••••|${parsed.twoFa || '••••'}`
                          : foundVia.fullVia}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1.5 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 hover:text-white rounded border border-emerald-600/50"
                        title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopy(foundVia.fullVia, 'full')}
                        className={`px-3 py-1.5 rounded font-bold text-xs flex items-center space-x-1 transition-all ${
                          copiedKey === 'full'
                            ? 'bg-emerald-400 text-emerald-950 font-black shadow-xs'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs'
                        }`}
                        title="Sao chép toàn bộ chuỗi UID|PASS|2FA để dán vào tool hoặc trình duyệt"
                      >
                        {copiedKey === 'full' ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Đã chép Full Via!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Sao Chép Full Via</span>
                          </>
                        )}
                      </button>

                      {currentUser.role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => {
                            setAdminFullViaDraft(foundVia.fullVia);
                            setIsEditingAdmin(true);
                          }}
                          className="p-1.5 bg-emerald-800/60 hover:bg-emerald-700 text-emerald-200 rounded border border-emerald-600/40"
                          title="Sửa thông tin Full Via"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Split elements: Password & 2FA pills */}
                  {parsed && (parsed.pass || parsed.twoFa) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                      {/* Password pill */}
                      <div className="bg-emerald-900/40 border border-emerald-600/40 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-emerald-300 font-bold block">
                            MẬT KHẨU (PASS):
                          </span>
                          <span className="font-mono text-xs text-white font-semibold">
                            {showPassword ? parsed.pass : '••••••••••••'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(parsed.pass, 'pass')}
                          className={`px-2 py-1 rounded text-[11px] font-medium border flex items-center space-x-1 ${
                            copiedKey === 'pass'
                              ? 'bg-emerald-400 text-emerald-950 border-white font-bold'
                              : 'bg-emerald-800 hover:bg-emerald-700 text-white border-emerald-600'
                          }`}
                        >
                          {copiedKey === 'pass' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === 'pass' ? 'Đã chép' : 'Chép Pass'}</span>
                        </button>
                      </div>

                      {/* 2FA Key pill */}
                      <div className="bg-emerald-900/40 border border-emerald-600/40 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-emerald-300 font-bold block">
                            MÃ BẢO MẬT 2FA (KEY):
                          </span>
                          <span className="font-mono text-xs text-amber-300 font-bold tracking-wider">
                            {parsed.twoFa || '(Không có)'}
                          </span>
                        </div>
                        {parsed.twoFa && (
                          <button
                            type="button"
                            onClick={() => handleCopy(parsed.twoFa, '2fa')}
                            className={`px-2 py-1 rounded text-[11px] font-medium border flex items-center space-x-1 ${
                              copiedKey === '2fa'
                                ? 'bg-amber-400 text-amber-950 border-white font-bold'
                                : 'bg-emerald-800 hover:bg-emerald-700 text-white border-emerald-600'
                            }`}
                          >
                            {copiedKey === '2fa' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKey === '2fa' ? 'Đã chép' : 'Chép 2FA'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Fanpages currently managed by this Via */}
                  <div className="text-[11px] text-emerald-200/90 pt-1 flex items-center flex-wrap gap-1.5">
                    <span className="font-bold text-emerald-300">Fanpage đang cầm:</span>
                    {foundVia.pages.map((p, idx) => (
                      <span
                        key={idx}
                        className="bg-emerald-900/60 border border-emerald-700/60 text-white px-2 py-0.5 rounded text-[11px] font-medium"
                      >
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                /* Full via not set yet */
                <div className="bg-emerald-900/30 p-2.5 rounded-lg border border-emerald-600/30 flex items-center justify-between">
                  <span className="text-xs text-emerald-200">
                    Nick Via này chưa được nhập thông tin Full Via (UID|PASS|2FA).
                  </span>
                  {currentUser.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setAdminFullViaDraft(`${foundVia.viaUid}|`);
                        setIsEditingAdmin(true);
                      }}
                      className="px-2.5 py-1 bg-emerald-500 text-emerald-950 font-bold rounded text-xs hover:bg-emerald-400"
                    >
                      + Nhập Full Via cho Nick này
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Expandable guide on how staff and admin use Full Via */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-emerald-700/50 text-[11px] text-emerald-100/90 grid grid-cols-1 md:grid-cols-2 gap-3 leading-relaxed">
          <div className="bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-700/40">
            <strong className="text-emerald-300 block mb-1">Dành Cho Nhân Viên:</strong>
            - Khi bạn được Admin giao Nick Via nào cầm Fanpage, bạn có thể nhập UID vào ô trên hoặc bấm vào UID của bạn để nhận chuỗi Full Via.<br />
            - Có sẵn nút <strong>Sao Chép Full Via</strong>, <strong>Chép Pass</strong>, và <strong>Chép 2FA</strong> để đăng nhập đăng bài.<br />
            - Bạn không thể tra cứu Full Via của nhân viên khác (được bảo vệ quyền riêng tư).
          </div>
          <div className="bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-700/40">
            <strong className="text-emerald-300 block mb-1">Dành Cho Admin:</strong>
            - Quản lý toàn quyền mọi Nick Via trong hệ thống.<br />
            - <strong>Bảng Quản Lý Full Nick (Tab 2)</strong> giúp Admin xem, lọc và chỉnh sửa trực tiếp thông tin đăng nhập.<br />
            - Có thể bấm nút chỉnh sửa để cập nhật mật khẩu hoặc 2FA mới bất cứ lúc nào.
          </div>
        </div>
      )}
    </div>
  );
};
