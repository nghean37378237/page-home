import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Zap,
  Globe,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  Search,
  Sparkles,
  Layers,
  ArrowRight,
  Shield,
  HelpCircle,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { PageRecord, FullViaItem, AppUser, PageStatus, BlockStatus, PostingMethod, InteractionQuality } from '../types';

interface ExtractedPageItem {
  id: string;
  pageId: string;
  name: string;
  link: string;
  category?: string;
  isSelected: boolean;
  source: 'facebook_api' | 'parsed_text';
}

interface FetchPagesFromViaModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser;
  allVias: FullViaItem[];
  availableStaffNames: string[];
  presetViaUid?: string;
  presetStaffName?: string;
  onAddRecords: (newRecords: PageRecord[], syncVia?: FullViaItem) => Promise<void> | void;
}

export const FetchPagesFromViaModal: React.FC<FetchPagesFromViaModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  allVias,
  availableStaffNames,
  presetViaUid = '',
  presetStaffName = '',
  onAddRecords,
}) => {
  // Active method: 'token_api' (Quét Facebook API) or 'paste_text' (Dán text / Meta Business Suite)
  const [activeTab, setActiveTab] = useState<'token_api' | 'paste_text'>('token_api');

  // Selected Via and Staff
  const [selectedViaUid, setSelectedViaUid] = useState<string>(presetViaUid);
  const [customViaInput, setCustomViaInput] = useState<string>(presetViaUid);
  const [selectedStaffName, setSelectedStaffName] = useState<string>(
    presetStaffName || (currentUser.role === 'staff' ? currentUser.name : '')
  );

  // Tab 1 state: Facebook Graph API
  const [accessToken, setAccessToken] = useState<string>('');
  const [isScanningApi, setIsScanningApi] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Tab 2 state: Paste text
  const [pastedText, setPastedText] = useState<string>('');
  const [pasteError, setPasteError] = useState<string | null>(null);

  // Extracted list
  const [extractedPages, setExtractedPages] = useState<ExtractedPageItem[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Quick defaults for imported pages
  const [defaultStatus, setDefaultStatus] = useState<PageStatus>('Đề Xuất');
  const [defaultBlock, setDefaultBlock] = useState<BlockStatus>('Không Chặn');
  const [defaultPosting, setDefaultPosting] = useState<PostingMethod>('Tool');
  const [defaultInteraction, setDefaultInteraction] = useState<InteractionQuality>('TỐT');
  const [defaultTargetPosts, setDefaultTargetPosts] = useState<number>(2);

  // Sync state when opening with preset
  useEffect(() => {
    if (isOpen) {
      const initialUid = presetViaUid || (allVias.length > 0 ? allVias[0].uid : '');
      setSelectedViaUid(initialUid);
      setCustomViaInput(initialUid);

      const matchedVia = allVias.find(
        (v) => v.uid.trim().toLowerCase() === initialUid.trim().toLowerCase()
      );

      const initialStaff =
        presetStaffName ||
        matchedVia?.staffName ||
        (currentUser.role === 'staff' ? currentUser.name : availableStaffNames[0] || 'Admin');
      setSelectedStaffName(initialStaff);

      // Auto-detect token if the Via already has a token in its raw string or note
      if (matchedVia?.rawFullVia) {
        const parts = matchedVia.rawFullVia.split('|');
        const tokenCandidate = parts.find((p) => p.trim().startsWith('EAA'));
        if (tokenCandidate) {
          setAccessToken(tokenCandidate.trim());
        }
      }

      setExtractedPages([]);
      setApiError(null);
      setPasteError(null);
      setSaveSuccessMsg(null);
    }
  }, [isOpen, presetViaUid, presetStaffName, allVias, currentUser, availableStaffNames]);

  // When selected via changes, update staff and check for token
  const handleViaSelectionChange = (uid: string) => {
    setSelectedViaUid(uid);
    setCustomViaInput(uid);
    const matched = allVias.find((v) => v.uid.trim().toLowerCase() === uid.trim().toLowerCase());
    if (matched) {
      if (currentUser.role === 'admin' && matched.staffName) {
        setSelectedStaffName(matched.staffName);
      }
      if (matched.rawFullVia) {
        const parts = matched.rawFullVia.split('|');
        const tokenCandidate = parts.find((p) => p.trim().startsWith('EAA'));
        if (tokenCandidate) {
          setAccessToken(tokenCandidate.trim());
        }
      }
    }
  };

  // Find currently matched via item
  const currentViaItem = useMemo(() => {
    const targetUid = (customViaInput || selectedViaUid).trim().toLowerCase();
    return allVias.find((v) => v.uid.trim().toLowerCase() === targetUid);
  }, [allVias, customViaInput, selectedViaUid]);

  // Handler: Scan via Facebook Graph API
  const handleScanFacebookApi = async () => {
    setApiError(null);
    setSaveSuccessMsg(null);

    let cleanToken = accessToken.trim();
    if (!cleanToken) {
      setApiError('Vui lòng dán Access Token của nick Via (chuỗi bắt đầu bằng EAA...) để quét.');
      return;
    }

    // If user pasted full via like "UID|PASS|2FA|COOKIE|EAA...", extract the token part
    if (cleanToken.includes('|')) {
      const parts = cleanToken.split('|');
      const foundToken = parts.find((p) => p.trim().startsWith('EAA'));
      if (foundToken) {
        cleanToken = foundToken.trim();
        setAccessToken(cleanToken);
      }
    }

    setIsScanningApi(true);

    try {
      // Facebook Graph API me/accounts endpoint:
      // Returns all pages administered by the user profile
      const endpoint = `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,link,category,is_published&limit=100&access_token=${encodeURIComponent(
        cleanToken
      )}`;

      const res = await fetch(endpoint);
      const data = await res.json();

      if (data.error) {
        let msg = data.error.message || 'Lỗi khi gọi Facebook API';
        if (data.error.code === 190) {
          msg = 'Access Token đã hết hạn hoặc không hợp lệ. Vui lòng lấy Token mới của Nick Via.';
        } else if (data.error.code === 100) {
          msg = 'Token không đúng quyền truy cập danh sách Trang (me/accounts). Cần token quyền pages_show_list.';
        }
        setApiError(msg);
        setIsScanningApi(false);
        return;
      }

      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        setApiError(
          'Không tìm thấy Fanpage nào trong nick Via này. Kiểm tra xem Via đã được phân quyền quản trị Fanpage chưa hoặc token có đúng tài khoản không.'
        );
        setIsScanningApi(false);
        return;
      }

      const items: ExtractedPageItem[] = data.data.map((item: any, idx: number) => {
        const pageId = String(item.id || '');
        const pageName = String(item.name || `Fanpage ${pageId}`);
        // Canonical page link
        let pageLink = item.link;
        if (!pageLink || !pageLink.startsWith('http')) {
          pageLink = `https://www.facebook.com/${pageId}`;
        }

        return {
          id: `ext-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          pageId,
          name: pageName,
          link: pageLink,
          category: item.category || 'Trang',
          isSelected: true,
          source: 'facebook_api',
        };
      });

      setExtractedPages(items);
    } catch (err: any) {
      console.error('[FetchPages] Network error calling Facebook Graph API:', err);
      setApiError(
        'Không thể kết nối trực tiếp đến Facebook Graph API từ trình duyệt. Nếu mạng chặn Facebook hoặc gặp lỗi CORS, bạn có thể chuyển sang Tab 2 "Dán văn bản / Meta Business Suite" để trích xuất ngay lập tức!'
      );
    } finally {
      setIsScanningApi(false);
    }
  };

  // Handler: Smart Text Parser for pasted list (Meta Business Suite, FPlus, Excel, text)
  const handleParsePastedText = () => {
    setPasteError(null);
    setSaveSuccessMsg(null);

    const raw = pastedText.trim();
    if (!raw) {
      setPasteError('Vui lòng dán danh sách Fanpage (tên trang, link, hoặc bảng sao chép từ Meta Business Suite / Excel).');
      return;
    }

    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsed: ExtractedPageItem[] = [];

    // Helper to test if a string is a Facebook URL
    const isFbUrl = (str: string) => {
      return /https?:\/\/(www\.|m\.|web\.)?(facebook\.com|fb\.com)\/[^\s]+/i.test(str);
    };

    // Helper to extract page ID or clean url
    const cleanFbUrl = (str: string) => {
      const match = str.match(/https?:\/\/(www\.|m\.|web\.)?(facebook\.com|fb\.com)\/[^\s]+/i);
      return match ? match[0] : str;
    };

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // Format 1: Tab-separated or comma/pipe separated on one line:
      // "Tên Page \t https://facebook.com/..." OR "https://facebook.com/... \t Tên Page" OR "ID | Tên Page | Link"
      if (line.includes('\t') || line.includes('|') || (line.includes(',') && line.includes('facebook.com'))) {
        const separator = line.includes('\t') ? '\t' : line.includes('|') ? '|' : ',';
        const parts = line.split(separator).map((p) => p.trim()).filter(Boolean);

        let pName = '';
        let pLink = '';
        let pId = '';

        for (const part of parts) {
          if (isFbUrl(part)) {
            pLink = cleanFbUrl(part);
          } else if (/^\d{10,20}$/.test(part) && !pId) {
            pId = part;
          } else if (!pName) {
            pName = part;
          }
        }

        if (!pLink && pId) {
          pLink = `https://www.facebook.com/${pId}`;
        }
        if (!pName && pId) {
          pName = `Page ${pId}`;
        }
        if (!pName && pLink) {
          pName = 'Fanpage';
        }

        if (pName || pLink) {
          parsed.push({
            id: `paste-${Date.now()}-${parsed.length}-${Math.random().toString(36).substring(2, 6)}`,
            pageId: pId || (pLink.match(/\d{10,20}/) ? pLink.match(/\d{10,20}/)![0] : ''),
            name: pName || 'Trang Facebook',
            link: pLink || `https://www.facebook.com/${pId || ''}`,
            isSelected: true,
            source: 'parsed_text',
          });
        }
        i++;
        continue;
      }

      // Format 2: Consecutive lines:
      // Line 1: Page Name
      // Line 2: Page Link (URL)
      if (i + 1 < lines.length && !isFbUrl(line) && isFbUrl(lines[i + 1])) {
        const namePart = line;
        const linkPart = cleanFbUrl(lines[i + 1]);
        const idMatch = linkPart.match(/\d{10,20}/);

        parsed.push({
          id: `paste-${Date.now()}-${parsed.length}-${Math.random().toString(36).substring(2, 6)}`,
          pageId: idMatch ? idMatch[0] : '',
          name: namePart,
          link: linkPart,
          isSelected: true,
          source: 'parsed_text',
        });
        i += 2;
        continue;
      }

      // Format 3: Line contains a Facebook URL
      if (isFbUrl(line)) {
        const linkPart = cleanFbUrl(line);
        const idMatch = linkPart.match(/\d{10,20}/);
        const namePart = idMatch ? `Page ${idMatch[0]}` : 'Fanpage';

        parsed.push({
          id: `paste-${Date.now()}-${parsed.length}-${Math.random().toString(36).substring(2, 6)}`,
          pageId: idMatch ? idMatch[0] : '',
          name: namePart,
          link: linkPart,
          isSelected: true,
          source: 'parsed_text',
        });
        i++;
        continue;
      }

      // Format 4: Line is just a Numeric Page ID (15-16 digits)
      if (/^\d{10,20}$/.test(line)) {
        parsed.push({
          id: `paste-${Date.now()}-${parsed.length}-${Math.random().toString(36).substring(2, 6)}`,
          pageId: line,
          name: `Fanpage ${line}`,
          link: `https://www.facebook.com/${line}`,
          isSelected: true,
          source: 'parsed_text',
        });
        i++;
        continue;
      }

      // Format 5: Just plain page name
      if (line.length > 1) {
        parsed.push({
          id: `paste-${Date.now()}-${parsed.length}-${Math.random().toString(36).substring(2, 6)}`,
          pageId: '',
          name: line,
          link: '',
          isSelected: true,
          source: 'parsed_text',
        });
      }
      i++;
    }

    if (parsed.length === 0) {
      setPasteError(
        'Không thể nhận diện danh sách Fanpage. Vui lòng kiểm tra lại định dạng (Tên Page | Link Facebook hoặc copy từ Excel).'
      );
      return;
    }

    setExtractedPages(parsed);
  };

  // Toggle page selection
  const togglePageSelection = (id: string) => {
    setExtractedPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isSelected: !p.isSelected } : p))
    );
  };

  // Select all or deselect all
  const handleSelectAll = (select: boolean) => {
    setExtractedPages((prev) => prev.map((p) => ({ ...p, isSelected: select })));
  };

  // Update extracted page field directly in table
  const handleUpdateExtractedPage = (id: string, updates: Partial<ExtractedPageItem>) => {
    setExtractedPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  // Remove page from list
  const handleRemoveExtractedPage = (id: string) => {
    setExtractedPages((prev) => prev.filter((p) => p.id !== id));
  };

  // Confirm and submit to database
  const handleApplyToTable = async () => {
    const finalViaUid = (customViaInput || selectedViaUid).trim();
    if (!finalViaUid) {
      alert('Vui lòng chọn hoặc nhập UID Nick Via để gán các Fanpage này!');
      return;
    }

    const finalStaffName =
      selectedStaffName.trim() ||
      (currentUser.role === 'staff' ? currentUser.name : availableStaffNames[0] || 'Admin');

    const selectedList = extractedPages.filter((p) => p.isSelected && p.name.trim());
    if (selectedList.length === 0) {
      alert('Vui lòng tích chọn ít nhất 1 Fanpage để điền vào bảng!');
      return;
    }

    setIsSaving(true);

    try {
      const today = new Date();
      const todayStr = `${today.getDate()}/${today.getMonth() + 1}`;
      const fullDateStr = today.toLocaleDateString('vi-VN');

      // Check if Via exists; if not, create sync object
      let syncVia: FullViaItem | undefined = currentViaItem;
      if (!syncVia) {
        syncVia = {
          id: `via-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          uid: finalViaUid,
          staffName: finalStaffName,
          pass: '',
          twoFa: '',
          status: 'active',
          note: `Tự động tạo khi quét Fanpage ngày ${fullDateStr}`,
          sharedNote: '',
        };
      }

      const newRecords: PageRecord[] = selectedList.map((page, idx) => {
        let finalLink = page.link.trim();
        if (!finalLink && page.pageId) {
          finalLink = `https://www.facebook.com/${page.pageId}`;
        }

        return {
          id: `page-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          staffName: finalStaffName,
          viaUid: finalViaUid,
          fullVia: syncVia?.rawFullVia || (syncVia ? `${syncVia.uid}|${syncVia.pass || ''}|${syncVia.twoFa || ''}` : undefined),
          pageName: page.name.trim(),
          pageLink: finalLink,
          status: defaultStatus,
          date: todayStr,
          blockStatus: defaultBlock,
          likeCountStatus: 'Đếm Like',
          postingMethod: defaultPosting,
          interaction: defaultInteraction,
          interactionDate: fullDateStr,
          bmNote: syncVia?.note ? `Via: ${syncVia.note}` : '',
          targetPosts: defaultTargetPosts,
          actualPosts: 0,
          isCompleted: false,
          isViaError: syncVia?.isError || false,
          isViaFixed: syncVia?.isFixed || false,
          viaStatus: syncVia?.status || 'active',
          viaSharedNote: syncVia?.sharedNote || syncVia?.note,
        };
      });

      await onAddRecords(newRecords, syncVia);

      setSaveSuccessMsg(
        `Thành công! Đã điền ${newRecords.length} Fanpage từ Nick Via "${finalViaUid}" vào Bảng Quản Lý và lưu lên Cloud Firestore.`
      );

      // Close modal after 1.5s
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('[FetchPages] Error saving records:', err);
      alert('Có lỗi khi lưu các Fanpage vào hệ thống: ' + (err.message || 'Thử lại sau.'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const selectedCount = extractedPages.filter((p) => p.isSelected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-linear-to-r from-blue-700 via-indigo-700 to-blue-800 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-white/10 rounded-lg backdrop-blur-xs">
              <Zap className="w-5 h-5 text-amber-300 fill-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight flex items-center space-x-2">
                <span>Lấy Tên & Link Page Tự Động Từ Nick Via</span>
                <span className="bg-amber-400 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Tự động điền
                </span>
              </h2>
              <p className="text-xs text-blue-100 opacity-90 mt-0.5">
                Quét Facebook Graph API hoặc trích xuất danh sách Fanpage gắn trực tiếp vào Nick Via & Bảng Quản Lý
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Đóng modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Target Via & Staff Assignment Panel */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-2xs">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>1. Chọn Nick Via & Nhân Viên Phụ Trách</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Via UID Picker */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nick Via (UID Facebook):
                </label>
                <div className="flex items-center space-x-1.5">
                  <select
                    value={selectedViaUid}
                    onChange={(e) => handleViaSelectionChange(e.target.value)}
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Chọn từ danh sách Via đã có --</option>
                    {allVias.map((v) => (
                      <option key={v.id} value={v.uid}>
                        {v.uid} {v.staffName ? `(${v.staffName})` : ''} {v.note ? `- ${v.note}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-1.5 flex items-center space-x-1 text-[11px] text-slate-500">
                  <span>Hoặc gõ UID trực tiếp:</span>
                  <input
                    type="text"
                    value={customViaInput}
                    onChange={(e) => {
                      setCustomViaInput(e.target.value);
                      setSelectedViaUid(e.target.value);
                    }}
                    placeholder="VD: 10008892182"
                    className="w-32 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-slate-800 font-mono text-xs focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Staff Name Assignment */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nhân viên phụ trách:
                </label>
                {currentUser.role === 'admin' ? (
                  <select
                    value={selectedStaffName}
                    onChange={(e) => setSelectedStaffName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    {availableStaffNames.map((name) => (
                      <option key={name} value={name}>
                        👤 {name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-xs font-bold text-emerald-800 flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Tài khoản của bạn: {currentUser.name}</span>
                  </div>
                )}
                {currentViaItem?.sharedNote && (
                  <p className="mt-1 text-[11px] text-emerald-700 font-medium truncate">
                    📝 Ghi chú chung của Via: {currentViaItem.sharedNote}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Tab Selection: API vs Text Parser */}
          <div>
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>2. Chọn Phương Thức Lấy Page</span>
            </div>

            <div className="flex border-b border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('token_api')}
                className={`flex-1 py-2.5 px-4 text-xs font-extrabold flex items-center justify-center space-x-2 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'token_api'
                    ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span>Cách 1: Quét Tự Động Qua Token (Facebook Graph API)</span>
                <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.2 rounded font-bold">
                  Khuyên dùng
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('paste_text')}
                className={`flex-1 py-2.5 px-4 text-xs font-extrabold flex items-center justify-center space-x-2 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'paste_text'
                    ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Cách 2: Dán Danh Sách Copy (Meta Business / Excel)</span>
              </button>
            </div>
          </div>

          {/* TAB 1: Facebook Token API */}
          {activeTab === 'token_api' && (
            <div className="space-y-3 bg-blue-50/30 border border-blue-100 rounded-xl p-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <span>Dán Access Token của Nick Via (bắt đầu bằng EAA...):</span>
                  </label>
                  <span className="text-[11px] text-blue-700 font-medium">
                    (Hoặc dán chuỗi Full Via chứa Token)
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="VD: EAAB... hoặc dán chuỗi UID|PASS|2FA|COOKIE|EAA..."
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs pr-24"
                  />
                  <button
                    type="button"
                    onClick={handleScanFacebookApi}
                    disabled={isScanningApi || !accessToken.trim()}
                    className="absolute right-1 top-1 bottom-1 px-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-md text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
                  >
                    {isScanningApi ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang quét...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5" />
                        <span>Quét Page</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Instructions on how to get token */}
              <div className="bg-white border border-blue-200 rounded-lg p-2.5 text-[11px] text-slate-600 flex items-start space-x-2">
                <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Cách lấy Access Token của Via:</strong>
                  <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-slate-600">
                    <li>Nếu bạn dùng phần mềm nuôi Via (FPlus, MaxCare, FTool), hãy sao chép cột <strong>Token</strong> hoặc <strong>Full Via</strong> dán vào đây.</li>
                    <li>Hoặc dùng tiện ích Get Token Facebook trên trình duyệt đăng nhập nick Via đó để copy token.</li>
                    <li>Hệ thống gọi trực tiếp Facebook Graph API chính thức: <code>/me/accounts</code> để lấy toàn bộ Tên Page & Link chuẩn xác 100%.</li>
                  </ul>
                </div>
              </div>

              {apiError && (
                <div className="bg-rose-50 border border-rose-300 text-rose-800 rounded-lg p-2.5 text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Không thể lấy Page:</span> {apiError}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Smart Text Paste */}
          {activeTab === 'paste_text' && (
            <div className="space-y-3 bg-indigo-50/30 border border-indigo-100 rounded-xl p-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-800">
                    Dán nội dung sao chép (Từ Meta Business Suite, Excel, FPlus hoặc Text):
                  </label>
                  <span className="text-[11px] text-indigo-700 font-medium">
                    Tự động nhận diện Tên Page, Link Facebook, ID Trang
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder={`Ví dụ các định dạng được hỗ trợ:
1. Copy từ Excel: Cột Tên Page và Cột Link Page
2. Gạch đứng: Tên Page | https://facebook.com/100012345678
3. Nhiều dòng:
Tên Trang A
https://www.facebook.com/100012345678
Tên Trang B
https://www.facebook.com/100087654321
4. Hoặc dán danh sách UID Page: 100012345678`}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleParsePastedText}
                  disabled={!pastedText.trim()}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Trích Xuất Tên & Link Page</span>
                </button>
              </div>

              {pasteError && (
                <div className="bg-rose-50 border border-rose-300 text-rose-800 rounded-lg p-2.5 text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Lỗi trích xuất:</span> {pasteError}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 3: Extracted Pages Table & Preview */}
          {extractedPages.length > 0 && (
            <div className="space-y-2.5 pt-2 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center space-x-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>3. Danh Sách Fanpage Tìm Thấy ({extractedPages.length} Page)</span>
                  </span>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    Đã chọn: {selectedCount}/{extractedPages.length}
                  </span>
                </div>

                <div className="flex items-center space-x-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleSelectAll(true)}
                    className="text-blue-700 hover:text-blue-900 font-bold hover:underline cursor-pointer"
                  >
                    Chọn tất cả
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => handleSelectAll(false)}
                    className="text-slate-500 hover:text-slate-800 font-medium hover:underline cursor-pointer"
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>

              {/* Table of extracted pages */}
              <div className="border border-slate-300 rounded-lg overflow-hidden shadow-2xs max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 sticky top-0 z-10 text-[11px]">
                    <tr>
                      <th className="w-8 px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={selectedCount === extractedPages.length && extractedPages.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </th>
                      <th className="w-8 px-1.5 py-1.5 text-center">#</th>
                      <th className="w-44 px-2 py-1.5">TÊN FANPAGE</th>
                      <th className="px-2 py-1.5">LINK FANPAGE</th>
                      <th className="w-24 px-2 py-1.5 text-center">ID TRANG</th>
                      <th className="w-12 px-1.5 py-1.5 text-center">Xóa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800 bg-white font-sans">
                    {extractedPages.map((page, idx) => (
                      <tr
                        key={page.id}
                        className={`hover:bg-blue-50/40 transition-colors ${
                          page.isSelected ? 'bg-white' : 'bg-slate-50 opacity-60'
                        }`}
                      >
                        <td className="px-2 py-1 text-center">
                          <input
                            type="checkbox"
                            checked={page.isSelected}
                            onChange={() => togglePageSelection(page.id)}
                            className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-1.5 py-1 text-center font-mono text-[10px] text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={page.name}
                            onChange={(e) =>
                              handleUpdateExtractedPage(page.id, { name: e.target.value })
                            }
                            className="w-full text-xs font-bold text-slate-900 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded px-1.5 py-0.5 focus:outline-hidden"
                            placeholder="Nhập tên page..."
                          />
                        </td>
                        <td className="px-2 py-1">
                          <div className="flex items-center space-x-1">
                            <input
                              type="text"
                              value={page.link}
                              onChange={(e) =>
                                handleUpdateExtractedPage(page.id, { link: e.target.value })
                              }
                              className="flex-1 text-xs text-blue-700 font-mono border border-transparent hover:border-slate-300 focus:border-blue-500 rounded px-1.5 py-0.5 focus:outline-hidden truncate"
                              placeholder="https://facebook.com/..."
                            />
                            {page.link && (
                              <a
                                href={page.link}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-400 hover:text-blue-600 p-0.5 rounded cursor-pointer shrink-0"
                                title="Mở trang Facebook để kiểm tra"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1 text-center font-mono text-[11px] text-slate-500">
                          {page.pageId || '—'}
                        </td>
                        <td className="px-1.5 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveExtractedPage(page.id)}
                            className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                            title="Xóa trang này khỏi danh sách điền"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Default presets configuration */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs">
                <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Thiết lập mặc định cho các Fanpage này khi điền vào bảng:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <span className="block text-[10px] text-slate-500">Trạng thái:</span>
                    <select
                      value={defaultStatus}
                      onChange={(e) => setDefaultStatus(e.target.value as PageStatus)}
                      className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-semibold text-slate-800"
                    >
                      <option value="Đề Xuất">🚀 Đề Xuất</option>
                      <option value="Mất Đề Xuất">⚠️ Mất Đề Xuất</option>
                      <option value="Đình Chỉ">🛑 Đình Chỉ</option>
                      <option value="Bị Back">↩️ Bị Back</option>
                    </select>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500">Chặn:</span>
                    <select
                      value={defaultBlock}
                      onChange={(e) => setDefaultBlock(e.target.value as BlockStatus)}
                      className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-semibold text-slate-800"
                    >
                      <option value="Không Chặn">Không Chặn</option>
                      <option value="Chặn VN">Chặn VN</option>
                      <option value="Chặn Bản Quyền">Chặn Bản Quyền</option>
                      <option value="Chặn Quốc Tế">Chặn Quốc Tế</option>
                    </select>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500">Đăng bài:</span>
                    <select
                      value={defaultPosting}
                      onChange={(e) => setDefaultPosting(e.target.value as PostingMethod)}
                      className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-semibold text-slate-800"
                    >
                      <option value="Tool">Tool</option>
                      <option value="Đăng Tay">Đăng Tay</option>
                      <option value="Hẹn Giờ">Hẹn Giờ</option>
                    </select>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500">Chỉ tiêu / ngày:</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={defaultTargetPosts}
                      onChange={(e) => setDefaultTargetPosts(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-semibold text-slate-800"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Success Message Banner */}
          {saveSuccessMsg && (
            <div className="bg-emerald-50 border border-emerald-400 text-emerald-900 rounded-xl p-3 text-xs flex items-center space-x-2 font-bold shadow-2xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            {extractedPages.length > 0 ? (
              <span>
                Sẵn sàng điền <strong>{selectedCount}</strong> Fanpage vào nick Via{' '}
                <strong className="text-slate-800">{customViaInput || selectedViaUid || '—'}</strong>
              </span>
            ) : (
              <span>Vui lòng chọn hoặc quét để lấy danh sách Fanpage</span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>

            <button
              type="button"
              onClick={handleApplyToTable}
              disabled={isSaving || selectedCount === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-black flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang điền vào bảng...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>✓ Điền Lên Bảng Fanpage ({selectedCount} Page)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
