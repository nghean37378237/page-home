import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowRightLeft,
  X,
  FileSpreadsheet,
  Layers,
  Search,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  UserCheck,
  RefreshCw,
  Check,
  Users,
  Archive,
  KeyRound,
  UserMinus,
  Lock,
  Trash2,
} from 'lucide-react';
import {
  PageRecord,
  FullViaItem,
  GroupRecord,
  UserAccount,
  AppUser,
  ADMIN_WAITING_POOL,
  isAdminWaitingPool,
  areStaffNamesEquivalent,
} from '../types';
import { getCleanBmName, parseFullVia, parseSupplementalViaInput, buildFullViaString } from '../utils/helpers';

export interface FullStaffTransferOptions {
  sourceStaffName: string;
  targetStaffName: string;
  transferVias: boolean;
  transferGroups: boolean;
  transferPages: boolean;
  oldAccountAction: 'keep' | 'block' | 'delete';
  appendHistoryNote: boolean;
  historyNoteText: string;
}

export interface TransferPageViaParams {
  pageIds: string[];
  targetViaUid: string;
  targetStaffName: string;
  targetFullVia?: string;
  appendHistoryNote: boolean;
  historyNoteText: string;
  /** Nếu chuyển nguyên cả Nick Via (1 hoặc nhiều Via) kèm toàn bộ Page sang nhân viên khác hoặc vào Kho Chờ Admin */
  transferViaUidsToStaff?: string[];
  /** Nếu chuyển toàn bộ Via + Group + Page của 1 nhân viên sang nhân viên khác (khi NV nghỉ việc / bàn giao) */
  fullStaffTransfer?: FullStaffTransferOptions;
}

interface TransferPageViaModalProps {
  isOpen: boolean;
  onClose: () => void;
  presetRecord?: PageRecord | null;
  presetViaUid?: string | null;
  presetSourceStaff?: string | null;
  presetTargetStaff?: string | null;
  initialMode?: 'single' | 'batch' | 'via_to_staff' | 'staff_to_staff';
  records: PageRecord[];
  viaList: FullViaItem[];
  groupRecords?: GroupRecord[];
  accounts?: UserAccount[];
  allStaffNames: string[];
  currentUser: AppUser;
  onConfirmTransfer: (params: TransferPageViaParams) => Promise<void>;
}

export const TransferPageViaModal: React.FC<TransferPageViaModalProps> = ({
  isOpen,
  onClose,
  presetRecord,
  presetViaUid,
  presetSourceStaff,
  presetTargetStaff,
  initialMode,
  records,
  viaList,
  groupRecords = [],
  accounts = [],
  allStaffNames,
  currentUser,
  onConfirmTransfer,
}) => {
  // Transfer Mode:
  // 'staff_to_staff': Chuyển FULL 1 Nhân Viên (Toàn bộ Via + Group + Page) sang cho nhân viên khác (khi NV cũ nghỉ)
  // 'via_to_staff': Chuyển Via + Toàn bộ Page Via đó cầm sang cho 1 nhân viên khác hoặc vào Kho Chờ Admin
  // 'single': Chuyển 1 Page sang Via khác
  // 'batch': Chuyển nhiều Page sang Via khác
  const [transferMode, setTransferMode] = useState<
    'staff_to_staff' | 'via_to_staff' | 'single' | 'batch'
  >('via_to_staff');

  // States for 'staff_to_staff' mode (Chuyển Full 1 Nhân Viên sang Nhân Viên khác)
  const [sourceStaffForFullTransfer, setSourceStaffForFullTransfer] = useState<string>('');
  const [targetStaffForFullTransfer, setTargetStaffForFullTransfer] = useState<string>('');
  const [customNewTargetStaff, setCustomNewTargetStaff] = useState<string>('');
  const [sourceStaffSearchQuery, setSourceStaffSearchQuery] = useState<string>('');
  const [fullTransferIncludeVias, setFullTransferIncludeVias] = useState<boolean>(true);
  const [fullTransferIncludeGroups, setFullTransferIncludeGroups] = useState<boolean>(true);
  const [fullTransferIncludePages, setFullTransferIncludePages] = useState<boolean>(true);
  const [oldAccountAction, setOldAccountAction] = useState<'keep' | 'block' | 'delete'>('keep');

  // Selected Vias for 'via_to_staff' mode
  const [selectedViaUidsForStaffTransfer, setSelectedViaUidsForStaffTransfer] = useState<string[]>([]);
  const [viaSourceSearchQuery, setViaSourceSearchQuery] = useState<string>('');
  const [viaSourceQuickFilter, setViaSourceQuickFilter] = useState<
    'all' | 'waiting_pool' | 'staff' | 'has_pages' | 'no_pages'
  >('all');
  const [targetStaffForViaTransfer, setTargetStaffForViaTransfer] = useState<string>('');

  // Selected single page ID
  const [selectedPageId, setSelectedPageId] = useState<string>('');

  // Selected batch page IDs
  const [selectedBatchPageIds, setSelectedBatchPageIds] = useState<string[]>([]);

  // Source Via filter or selection
  const [sourceViaFilter, setSourceViaFilter] = useState<string>('');

  // Search query for page selection
  const [pageSearchQuery, setPageSearchQuery] = useState<string>('');

  // Target Via selection mode: 'existing' | 'new'
  const [targetViaMode, setTargetViaMode] = useState<'existing' | 'new'>('existing');
  const [selectedTargetViaUid, setSelectedTargetViaUid] = useState<string>('');
  const [customTargetViaUid, setCustomTargetViaUid] = useState<string>('');
  const [targetViaSearchQuery, setTargetViaSearchQuery] = useState<string>('');

  // Các trường bổ sung thêm thông tin cho Via đích (2FA | Mail | Pass | PassMail)
  const [suppPass, setSuppPass] = useState<string>('');
  const [suppTwoFa, setSuppTwoFa] = useState<string>('');
  const [suppEmail, setSuppEmail] = useState<string>('');
  const [suppEmailPass, setSuppEmailPass] = useState<string>('');
  const [quickPasteSupp, setQuickPasteSupp] = useState<string>('');

  // Target Staff option
  const [staffAssignmentMode, setStaffAssignmentMode] = useState<'target_via_owner' | 'keep_current' | 'custom'>('target_via_owner');
  const [customStaffName, setCustomStaffName] = useState<string>('');

  // Note option
  const [appendHistoryNote, setAppendHistoryNote] = useState<boolean>(true);
  const [historyNoteText, setHistoryNoteText] = useState<string>('');

  // Processing state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Available pages based on user permissions
  const accessibleRecords = useMemo(() => {
    if (currentUser.role === 'admin') {
      return records;
    }
    const userLower = currentUser.name.trim().toLowerCase();
    return records.filter((r) => r.staffName?.trim().toLowerCase() === userLower);
  }, [records, currentUser]);

  // Aggregate all known Vias in system (combining viaList and records, normalizing UID|Pass|2FA)
  const knownVias = useMemo(() => {
    const map = new Map<
      string,
      {
        uid: string;
        staffName: string;
        pageCount: number;
        pages: PageRecord[];
        fullViaItem?: FullViaItem;
        isError: boolean;
      }
    >();

    // Seed from viaList (prefer item with pass / twoFa / rawFullVia if duplicate UIDs exist)
    viaList.forEach((v) => {
      const raw = (v.uid || v.rawFullVia || '').trim();
      const uid = raw.split('|')[0].trim();
      if (!uid) return;
      const key = uid.toLowerCase();
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          uid,
          staffName: v.staffName || '',
          pageCount: 0,
          pages: [],
          fullViaItem: v,
          isError: Boolean(v.isError || v.status === 'checkpoint' || v.status === 'dead' || v.status === 'error'),
        });
      } else {
        const oldScore =
          (existing.fullViaItem?.pass ? 2 : 0) +
          (existing.fullViaItem?.twoFa ? 2 : 0) +
          (existing.fullViaItem?.rawFullVia?.includes('|') ? 1 : 0);
        const newScore =
          (v.pass ? 2 : 0) + (v.twoFa ? 2 : 0) + (v.rawFullVia?.includes('|') ? 1 : 0);
        if (newScore > oldScore) {
          existing.fullViaItem = v;
        }
        if (!existing.staffName && v.staffName) {
          existing.staffName = v.staffName;
        }
      }
    });

    // Add / enrich from records
    records.forEach((r) => {
      const raw = (r.viaUid || '').trim();
      const uid = raw.split('|')[0].trim();
      if (!uid) return;
      const key = uid.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          uid,
          staffName: r.staffName || '',
          pageCount: 0,
          pages: [],
          isError: Boolean(r.isViaError || r.viaStatus === 'checkpoint' || r.viaStatus === 'dead' || r.viaStatus === 'error'),
        });
      }
      const item = map.get(key)!;
      item.pageCount += 1;
      item.pages.push(r);
      if (r.staffName && (!item.staffName || isAdminWaitingPool(item.staffName))) {
        item.staffName = r.staffName;
      }
      if (r.isViaError || r.viaStatus === 'checkpoint' || r.viaStatus === 'dead' || r.viaStatus === 'error') {
        item.isError = true;
      }
    });

    const list = Array.from(map.values()).sort((a, b) => b.pageCount - a.pageCount);
    if (currentUser.role === 'admin') {
      return list;
    }
    const myNameLower = currentUser.name.trim().toLowerCase();
    return list.filter((v) => v.staffName.trim().toLowerCase() === myNameLower);
  }, [viaList, records, currentUser]);

  // Quick counts for source Vias filter bar
  const sourceViaCounts = useMemo(() => {
    let waitingPool = 0;
    let staffAssigned = 0;
    let hasPages = 0;
    let noPages = 0;

    knownVias.forEach((v) => {
      if (isAdminWaitingPool(v.staffName) || !v.staffName.trim()) {
        waitingPool++;
      } else {
        staffAssigned++;
      }
      if (v.pageCount > 0) {
        hasPages++;
      } else {
        noPages++;
      }
    });

    return {
      all: knownVias.length,
      waitingPool,
      staffAssigned,
      hasPages,
      noPages,
    };
  }, [knownVias]);

  // Filtered source vias for 'via_to_staff' mode
  const filteredSourceVias = useMemo(() => {
    let list = knownVias;
    if (viaSourceQuickFilter === 'waiting_pool') {
      list = list.filter((v) => isAdminWaitingPool(v.staffName) || !v.staffName.trim());
    } else if (viaSourceQuickFilter === 'staff') {
      list = list.filter((v) => !isAdminWaitingPool(v.staffName) && Boolean(v.staffName.trim()));
    } else if (viaSourceQuickFilter === 'has_pages') {
      list = list.filter((v) => v.pageCount > 0);
    } else if (viaSourceQuickFilter === 'no_pages') {
      list = list.filter((v) => v.pageCount === 0);
    }

    const q = viaSourceSearchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (v) =>
        v.uid.toLowerCase().includes(q) ||
        v.staffName.toLowerCase().includes(q) ||
        v.pages.some((p) => p.pageName.toLowerCase().includes(q)) ||
        (v.fullViaItem?.note && v.fullViaItem.note.toLowerCase().includes(q))
    );
  }, [knownVias, viaSourceQuickFilter, viaSourceSearchQuery]);

  // Filtered target vias
  const filteredTargetVias = useMemo(() => {
    const q = targetViaSearchQuery.trim().toLowerCase();
    if (!q) return knownVias;
    return knownVias.filter(
      (v) =>
        v.uid.toLowerCase().includes(q) ||
        v.staffName.toLowerCase().includes(q) ||
        (v.fullViaItem?.note && v.fullViaItem.note.toLowerCase().includes(q))
    );
  }, [knownVias, targetViaSearchQuery]);

  // Tổng hợp danh sách toàn bộ Nhân Viên trong hệ thống (từ accounts, allStaffNames, records, viaList, groupRecords) cho chế độ Chuyển Full 1 NV
  const staffSummariesForFullTransfer = useMemo(() => {
    const nameMap = new Map<string, string>();
    const registerName = (raw?: string) => {
      const clean = (raw || '').trim();
      if (!clean || isAdminWaitingPool(clean) || clean.toLowerCase() === 'all') return;
      const lower = clean.toLowerCase();
      if (!nameMap.has(lower)) {
        nameMap.set(lower, clean);
      }
    };

    allStaffNames.forEach(registerName);
    accounts.forEach((a) => {
      if (a.role !== 'admin') registerName(a.username);
    });
    records.forEach((r) => registerName(r.staffName));
    viaList.forEach((v) => registerName(v.staffName));
    groupRecords.forEach((g) => registerName(g.staffName));

    const list = Array.from(nameMap.values()).map((staffName) => {
      const sLower = staffName.trim().toLowerCase();
      const matchStaff = (candidate?: string) =>
        Boolean(
          candidate &&
            (candidate.trim().toLowerCase() === sLower ||
              areStaffNamesEquivalent(candidate, staffName))
        );

      const staffPages = records.filter((r) => matchStaff(r.staffName));
      const staffVias = viaList.filter((v) => matchStaff(v.staffName));
      const staffGroups = groupRecords.filter((g) => matchStaff(g.staffName));
      const matchedAccount = accounts.find((a) => matchStaff(a.username));

      return {
        name: staffName,
        pagesCount: staffPages.length,
        viasCount: staffVias.length,
        groupsCount: staffGroups.length,
        totalAssets: staffPages.length + staffVias.length + staffGroups.length,
        hasAccount: Boolean(matchedAccount),
        accountStatus: matchedAccount?.status,
      };
    });

    return list.sort((a, b) => b.totalAssets - a.totalAssets || a.name.localeCompare(b.name));
  }, [allStaffNames, accounts, records, viaList, groupRecords]);

  const filteredSourceStaffList = useMemo(() => {
    const q = sourceStaffSearchQuery.trim().toLowerCase();
    if (!q) return staffSummariesForFullTransfer;
    return staffSummariesForFullTransfer.filter((s) => s.name.toLowerCase().includes(q));
  }, [staffSummariesForFullTransfer, sourceStaffSearchQuery]);

  // Chi tiết toàn bộ Via + Group + Page của Nhân viên nguồn đang chọn để bàn giao
  const sourceStaffDetails = useMemo(() => {
    const src = sourceStaffForFullTransfer.trim();
    if (!src) {
      return {
        pages: [] as PageRecord[],
        vias: [] as FullViaItem[],
        groups: [] as GroupRecord[],
        uniqueGroupNames: [] as string[],
        matchedAccount: undefined as UserAccount | undefined,
      };
    }
    const sLower = src.toLowerCase();
    const matchStaff = (candidate?: string) =>
      Boolean(
        candidate &&
          (candidate.trim().toLowerCase() === sLower || areStaffNamesEquivalent(candidate, src))
      );

    const pages = records.filter((r) => matchStaff(r.staffName));
    const vias = viaList.filter((v) => matchStaff(v.staffName));
    const groups = groupRecords.filter((g) => matchStaff(g.staffName));
    const uniqueGroupNames = Array.from(
      new Set(groups.map((g) => (g.groupName || g.groupLink || '').trim()).filter(Boolean))
    );
    const matchedAccount = accounts.find((a) => matchStaff(a.username));

    return {
      pages,
      vias,
      groups,
      uniqueGroupNames,
      matchedAccount,
    };
  }, [sourceStaffForFullTransfer, records, viaList, groupRecords, accounts]);

  const resolvedFullTransferTargetStaff = useMemo(() => {
    if (targetStaffForFullTransfer === '__CUSTOM_NEW__') {
      return customNewTargetStaff.trim();
    }
    return targetStaffForFullTransfer.trim();
  }, [targetStaffForFullTransfer, customNewTargetStaff]);

  // Initialize or reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
      setErrorMessage(null);
      setTargetViaSearchQuery('');
      setViaSourceSearchQuery('');
      setViaSourceQuickFilter('all');
      setPageSearchQuery('');
      setCustomTargetViaUid('');
      setSourceStaffSearchQuery('');
      setCustomNewTargetStaff('');
      setFullTransferIncludeVias(true);
      setFullTransferIncludeGroups(true);
      setFullTransferIncludePages(true);
      setOldAccountAction('keep');

      const todayStr = `${new Date().getDate()}/${new Date().getMonth() + 1}`;

      if (initialMode) {
        setTransferMode(initialMode);
      } else if (presetSourceStaff) {
        setTransferMode('staff_to_staff');
      } else if (presetRecord) {
        setTransferMode('single');
      } else if (presetViaUid) {
        setTransferMode('via_to_staff');
      } else {
        setTransferMode('staff_to_staff');
      }

      // Default source & target staff for 'staff_to_staff'
      const defaultSrcStaff =
        presetSourceStaff?.trim() ||
        staffSummariesForFullTransfer.find((s) => s.totalAssets > 0)?.name ||
        staffSummariesForFullTransfer[0]?.name ||
        '';
      setSourceStaffForFullTransfer(defaultSrcStaff);

      const defaultDestStaff =
        presetTargetStaff?.trim() ||
        allStaffNames.find(
          (name) =>
            !isAdminWaitingPool(name) &&
            name.trim().toLowerCase() !== defaultSrcStaff.trim().toLowerCase()
        ) ||
        staffSummariesForFullTransfer.find(
          (s) => s.name.trim().toLowerCase() !== defaultSrcStaff.trim().toLowerCase()
        )?.name ||
        ADMIN_WAITING_POOL;
      setTargetStaffForFullTransfer(defaultDestStaff);

      if (presetRecord) {
        setSelectedPageId(presetRecord.id);
        setSelectedBatchPageIds([presetRecord.id]);
        setSourceViaFilter(presetRecord.viaUid || '');
        if (presetRecord.viaUid) {
          setSelectedViaUidsForStaffTransfer([presetRecord.viaUid.trim()]);
        }
        setHistoryNoteText(`Chuyển từ Via ${presetRecord.viaUid || 'cũ'} ngày ${todayStr}`);
      } else if (presetViaUid) {
        const cleanPresetUid = presetViaUid.trim();
        setSelectedViaUidsForStaffTransfer([cleanPresetUid]);
        const pagesOfVia = accessibleRecords.filter(
          (r) => r.viaUid.trim().toLowerCase() === cleanPresetUid.toLowerCase()
        );
        if (pagesOfVia.length > 0) {
          setSelectedPageId(pagesOfVia[0].id);
          setSelectedBatchPageIds(pagesOfVia.map((p) => p.id));
          setSourceViaFilter(cleanPresetUid);
          setHistoryNoteText(`Bàn giao Via ${cleanPresetUid} (${pagesOfVia.length} Page) ngày ${todayStr}`);
        } else {
          setHistoryNoteText(`Bàn giao Via ${cleanPresetUid} ngày ${todayStr}`);
        }
      } else {
        if (knownVias.length > 0) {
          setSelectedViaUidsForStaffTransfer([knownVias[0].uid]);
        } else {
          setSelectedViaUidsForStaffTransfer([]);
        }
        if (accessibleRecords.length > 0) {
          setSelectedPageId(accessibleRecords[0].id);
          setSelectedBatchPageIds([accessibleRecords[0].id]);
          setSourceViaFilter(accessibleRecords[0].viaUid || '');
          setHistoryNoteText(`Bàn giao Via & Page ngày ${todayStr}`);
        }
      }

      // Default target staff for 'via_to_staff'
      if (presetTargetStaff) {
        setTargetStaffForViaTransfer(presetTargetStaff);
      } else {
        const currentViaOwner = presetViaUid
          ? knownVias.find((v) => v.uid.toLowerCase() === presetViaUid.trim().toLowerCase())?.staffName
          : presetRecord?.staffName || knownVias[0]?.staffName;

        const defaultNewStaff =
          allStaffNames.find(
            (name) => name.trim().toLowerCase() !== (currentViaOwner || '').trim().toLowerCase()
          ) ||
          allStaffNames[0] ||
          ADMIN_WAITING_POOL;
        setTargetStaffForViaTransfer(defaultNewStaff);
      }

      // Default target Via (first known via that is different from source)
      const firstTarget = knownVias.find(
        (v) => v.uid.toLowerCase() !== (presetRecord?.viaUid || presetViaUid || '').trim().toLowerCase()
      );
      if (firstTarget) {
        setSelectedTargetViaUid(firstTarget.uid);
      } else {
        setSelectedTargetViaUid('');
      }

      setStaffAssignmentMode('target_via_owner');
      setAppendHistoryNote(true);
    }
  }, [
    isOpen,
    presetRecord,
    presetViaUid,
    presetSourceStaff,
    presetTargetStaff,
    initialMode,
    accessibleRecords,
    knownVias,
    allStaffNames,
    staffSummariesForFullTransfer,
  ]);

  // Selected Via objects in 'via_to_staff' mode
  const selectedViaObjectsForStaffTransfer = useMemo(() => {
    const lowerSet = new Set(selectedViaUidsForStaffTransfer.map((u) => u.trim().toLowerCase()));
    return knownVias.filter((v) => lowerSet.has(v.uid.trim().toLowerCase()));
  }, [knownVias, selectedViaUidsForStaffTransfer]);

  // All pages belonging to selected Vias in 'via_to_staff' mode
  const pagesOfSelectedViasForStaffTransfer = useMemo(() => {
    const lowerSet = new Set(selectedViaUidsForStaffTransfer.map((u) => u.trim().toLowerCase()));
    return records.filter((r) => r.viaUid && lowerSet.has(r.viaUid.trim().toLowerCase()));
  }, [records, selectedViaUidsForStaffTransfer]);

  const isTargetWaitingPool = useMemo(
    () => isAdminWaitingPool(targetStaffForViaTransfer),
    [targetStaffForViaTransfer]
  );

  // Update history note automatically in 'staff_to_staff' mode
  useEffect(() => {
    if (transferMode === 'staff_to_staff' && sourceStaffForFullTransfer && resolvedFullTransferTargetStaff) {
      const todayStr = `${new Date().getDate()}/${new Date().getMonth() + 1}`;
      const destLabel = isAdminWaitingPool(resolvedFullTransferTargetStaff)
        ? 'Kho Chờ Admin'
        : `NV ${resolvedFullTransferTargetStaff}`;
      setHistoryNoteText(
        `Bàn giao full từ NV ${sourceStaffForFullTransfer} sang ${destLabel} (${todayStr})`
      );
    }
  }, [transferMode, sourceStaffForFullTransfer, resolvedFullTransferTargetStaff]);

  // Update history note automatically in 'via_to_staff' mode
  useEffect(() => {
    if (transferMode === 'via_to_staff' && selectedViaUidsForStaffTransfer.length > 0 && targetStaffForViaTransfer) {
      const todayStr = `${new Date().getDate()}/${new Date().getMonth() + 1}`;
      const destLabel = isAdminWaitingPool(targetStaffForViaTransfer)
        ? 'Kho Chờ Admin'
        : `NV ${targetStaffForViaTransfer}`;
      if (selectedViaUidsForStaffTransfer.length === 1) {
        const uid = selectedViaUidsForStaffTransfer[0];
        const pCount = pagesOfSelectedViasForStaffTransfer.length;
        setHistoryNoteText(
          `Chuyển Via ${uid}${pCount > 0 ? ` + ${pCount} Page` : ''} sang ${destLabel} (${todayStr})`
        );
      } else {
        setHistoryNoteText(
          `Chuyển ${selectedViaUidsForStaffTransfer.length} Via + ${pagesOfSelectedViasForStaffTransfer.length} Page sang ${destLabel} (${todayStr})`
        );
      }
    }
  }, [transferMode, selectedViaUidsForStaffTransfer, pagesOfSelectedViasForStaffTransfer.length, targetStaffForViaTransfer]);

  // The active single page being transferred
  const currentSinglePage = useMemo(() => {
    return accessibleRecords.find((r) => r.id === selectedPageId) || null;
  }, [accessibleRecords, selectedPageId]);

  // When selected single page changes, update default history note if not manually modified
  useEffect(() => {
    if (transferMode !== 'via_to_staff' && transferMode !== 'staff_to_staff' && currentSinglePage) {
      const todayStr = `${new Date().getDate()}/${new Date().getMonth() + 1}`;
      setHistoryNoteText(
        `Chuyển từ Via ${currentSinglePage.viaUid || 'cũ'} sang Via mới (${todayStr})`
      );
    }
  }, [currentSinglePage, transferMode]);

  // The active pages to transfer (single or batch)
  const pagesToTransfer = useMemo(() => {
    if (transferMode === 'via_to_staff') {
      return pagesOfSelectedViasForStaffTransfer;
    }
    if (transferMode === 'single') {
      return currentSinglePage ? [currentSinglePage] : [];
    }
    return accessibleRecords.filter((r) => selectedBatchPageIds.includes(r.id));
  }, [transferMode, pagesOfSelectedViasForStaffTransfer, currentSinglePage, accessibleRecords, selectedBatchPageIds]);

  // Target Via UID computed
  const resolvedTargetViaUid = useMemo(() => {
    if (transferMode === 'via_to_staff') {
      return selectedViaUidsForStaffTransfer[0] || '';
    }
    if (targetViaMode === 'new') {
      return customTargetViaUid.trim();
    }
    return selectedTargetViaUid.trim();
  }, [transferMode, selectedViaUidsForStaffTransfer, targetViaMode, customTargetViaUid, selectedTargetViaUid]);

  // Target Via Info
  const resolvedTargetViaInfo = useMemo(() => {
    if (!resolvedTargetViaUid) return null;
    return (
      knownVias.find(
        (v) => v.uid.trim().toLowerCase() === resolvedTargetViaUid.toLowerCase()
      ) || null
    );
  }, [resolvedTargetViaUid, knownVias]);

  // Target Staff Name computed
  const resolvedTargetStaffName = useMemo(() => {
    if (transferMode === 'via_to_staff') {
      return targetStaffForViaTransfer.trim();
    }
    if (staffAssignmentMode === 'custom') {
      return customStaffName.trim() || currentUser.name;
    }
    if (staffAssignmentMode === 'keep_current') {
      return pagesToTransfer[0]?.staffName || currentUser.name;
    }
    // target_via_owner
    if (resolvedTargetViaInfo?.staffName) {
      return resolvedTargetViaInfo.staffName;
    }
    return pagesToTransfer[0]?.staffName || currentUser.name;
  }, [
    transferMode,
    targetStaffForViaTransfer,
    staffAssignmentMode,
    customStaffName,
    currentUser,
    pagesToTransfer,
    resolvedTargetViaInfo,
  ]);

  // Khi đổi Via đích được chọn, tự động nạp thông tin hiện có của Via đó vào các ô bổ sung
  useEffect(() => {
    if (!resolvedTargetViaUid) {
      setSuppPass('');
      setSuppTwoFa('');
      setSuppEmail('');
      setSuppEmailPass('');
      setQuickPasteSupp('');
      return;
    }
    const vItem = resolvedTargetViaInfo?.fullViaItem;
    const parsed = parseFullVia(vItem?.rawFullVia);
    setSuppPass(vItem?.pass || parsed?.pass || '');
    setSuppTwoFa(vItem?.twoFa || parsed?.twoFa || '');
    setSuppEmail(vItem?.email || parsed?.email || '');
    setSuppEmailPass(vItem?.emailPass || parsed?.emailPass || '');
    setQuickPasteSupp('');
  }, [resolvedTargetViaUid, resolvedTargetViaInfo]);

  const handleQuickPasteSuppChange = (rawVal: string) => {
    setQuickPasteSupp(rawVal);
    if (!rawVal.trim()) return;
    const parsed = parseSupplementalViaInput(rawVal, resolvedTargetViaUid);
    if (targetViaMode === 'new' && parsed.uid && parsed.uid !== customTargetViaUid.trim()) {
      setCustomTargetViaUid(parsed.uid);
    }
    if (parsed.pass) setSuppPass(parsed.pass);
    if (parsed.twoFa) setSuppTwoFa(parsed.twoFa);
    if (parsed.email) setSuppEmail(parsed.email);
    if (parsed.emailPass) setSuppEmailPass(parsed.emailPass);
  };

  // Target Full Via if available (including newly supplemented Pass / 2FA / Mail / PassMail)
  const resolvedTargetFullVia = useMemo(() => {
    const cleanUid = (resolvedTargetViaUid || '').split('|')[0].trim();
    if (!cleanUid) return undefined;
    if (suppPass.trim() || suppTwoFa.trim() || suppEmail.trim() || suppEmailPass.trim()) {
      return buildFullViaString({
        uid: cleanUid,
        pass: suppPass,
        twoFa: suppTwoFa,
        email: suppEmail,
        emailPass: suppEmailPass,
      });
    }
    if (!resolvedTargetViaInfo) return undefined;
    if (resolvedTargetViaInfo.fullViaItem?.rawFullVia) {
      return resolvedTargetViaInfo.fullViaItem.rawFullVia;
    }
    if (resolvedTargetViaInfo.fullViaItem) {
      const { uid, pass, twoFa, email, emailPass } = resolvedTargetViaInfo.fullViaItem;
      if (pass || twoFa || email || emailPass) {
        return buildFullViaString({ uid, pass, twoFa, email, emailPass });
      }
    }
    return undefined;
  }, [resolvedTargetViaUid, resolvedTargetViaInfo, suppPass, suppTwoFa, suppEmail, suppEmailPass]);

  // Filtered page list for selection dropdown / search
  const selectablePages = useMemo(() => {
    let list = accessibleRecords;
    if (sourceViaFilter) {
      list = list.filter((r) => r.viaUid.trim().toLowerCase() === sourceViaFilter.trim().toLowerCase());
    }
    const q = pageSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.pageName.toLowerCase().includes(q) ||
          r.viaUid.toLowerCase().includes(q) ||
          r.staffName.toLowerCase().includes(q) ||
          (r.pageLink && r.pageLink.toLowerCase().includes(q))
      );
    }
    return list;
  }, [accessibleRecords, sourceViaFilter, pageSearchQuery]);

  if (!isOpen) return null;

  const toggleViaForStaffTransfer = (uid: string) => {
    const clean = uid.trim();
    setSelectedViaUidsForStaffTransfer((prev) => {
      const exists = prev.some((u) => u.trim().toLowerCase() === clean.toLowerCase());
      if (exists) {
        return prev.filter((u) => u.trim().toLowerCase() !== clean.toLowerCase());
      }
      return [...prev, clean];
    });
  };

  // Handle batch selection toggle
  const toggleBatchPage = (id: string) => {
    setSelectedBatchPageIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const selectAllPagesFromSource = () => {
    setSelectedBatchPageIds(selectablePages.map((p) => p.id));
  };

  const deselectAllPages = () => {
    setSelectedBatchPageIds([]);
  };

  const handleExecuteTransfer = async () => {
    if (transferMode === 'staff_to_staff') {
      const srcStaff = sourceStaffForFullTransfer.trim();
      const destStaff = resolvedFullTransferTargetStaff;

      if (!srcStaff) {
        setErrorMessage('Vui lòng chọn Nhân viên cũ / nguồn cần chuyển dữ liệu.');
        return;
      }
      if (!destStaff) {
        setErrorMessage('Vui lòng chọn Nhân viên mới nhận bàn giao (hoặc Kho Chờ Admin).');
        return;
      }
      if (
        srcStaff.toLowerCase() === destStaff.toLowerCase() ||
        areStaffNamesEquivalent(srcStaff, destStaff)
      ) {
        setErrorMessage('Nhân viên nguồn và Nhân viên nhận bàn giao đang trùng nhau. Vui lòng chọn nhân viên khác.');
        return;
      }
      if (!fullTransferIncludeVias && !fullTransferIncludeGroups && !fullTransferIncludePages) {
        setErrorMessage('Vui lòng tích chọn ít nhất 1 mục cần chuyển (Via, Group hoặc Page).');
        return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);
      try {
        await onConfirmTransfer({
          pageIds: fullTransferIncludePages ? sourceStaffDetails.pages.map((p) => p.id) : [],
          targetViaUid: '',
          targetStaffName: destStaff,
          appendHistoryNote,
          historyNoteText: historyNoteText.trim(),
          fullStaffTransfer: {
            sourceStaffName: srcStaff,
            targetStaffName: destStaff,
            transferVias: fullTransferIncludeVias,
            transferGroups: fullTransferIncludeGroups,
            transferPages: fullTransferIncludePages,
            oldAccountAction,
            appendHistoryNote,
            historyNoteText: historyNoteText.trim(),
          },
        });
        onClose();
      } catch (err: any) {
        console.error('Lỗi khi chuyển full dữ liệu nhân viên:', err);
        setErrorMessage(err.message || 'Đã xảy ra lỗi trong quá trình bàn giao dữ liệu nhân viên.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (transferMode === 'via_to_staff') {
      if (selectedViaUidsForStaffTransfer.length === 0) {
        setErrorMessage('Vui lòng chọn ít nhất 1 Nick Via để chuyển.');
        return;
      }
      if (!targetStaffForViaTransfer.trim()) {
        setErrorMessage('Vui lòng chọn Kho Chờ Admin hoặc Nhân viên nhận bàn giao.');
        return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);
      try {
        await onConfirmTransfer({
          pageIds: pagesOfSelectedViasForStaffTransfer.map((p) => p.id),
          targetViaUid: selectedViaUidsForStaffTransfer[0],
          targetStaffName: targetStaffForViaTransfer.trim(),
          targetFullVia: selectedViaUidsForStaffTransfer.length === 1 ? resolvedTargetFullVia : undefined,
          appendHistoryNote,
          historyNoteText: historyNoteText.trim(),
          transferViaUidsToStaff: selectedViaUidsForStaffTransfer,
        });
        onClose();
      } catch (err: any) {
        console.error('Lỗi khi chuyển Via + Page:', err);
        setErrorMessage(err.message || 'Đã xảy ra lỗi trong quá trình chuyển Via & Page.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (pagesToTransfer.length === 0) {
      setErrorMessage('Vui lòng chọn ít nhất 1 Fanpage để chuyển.');
      return;
    }

    if (!resolvedTargetViaUid) {
      setErrorMessage('Vui lòng chọn hoặc nhập UID của Nick Via đích.');
      return;
    }

    // Check if transferring to same Via
    const sameVia = pagesToTransfer.every(
      (p) => p.viaUid.trim().toLowerCase() === resolvedTargetViaUid.toLowerCase()
    );
    if (sameVia && staffAssignmentMode === 'keep_current') {
      setErrorMessage(
        `Fanpage hiện tại đã ở trên Via "${resolvedTargetViaUid}". Vui lòng chọn một Via khác hoặc chọn nhân viên mới.`
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onConfirmTransfer({
        pageIds: pagesToTransfer.map((p) => p.id),
        targetViaUid: resolvedTargetViaUid,
        targetStaffName: resolvedTargetStaffName,
        targetFullVia: resolvedTargetFullVia,
        appendHistoryNote,
        historyNoteText: historyNoteText.trim(),
      });
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi chuyển page sang Via khác:', err);
      setErrorMessage(err.message || 'Đã xảy ra lỗi trong quá trình chuyển Fanpage.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-fadeIn my-auto max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 shadow-2xs">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2 flex-wrap gap-y-1">
                <span>Bàn Giao & Chuyển Toàn Bộ Via • Group • Page Giữa Các Nhân Viên</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Đồng bộ 100% Cloud
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Chuyển Full 100% Via + Group + Page khi nhân viên cũ nghỉ sang nhân viên mới hoặc chuyển lẻ theo từng Via / Page
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="py-4 space-y-4 overflow-y-auto flex-1 pr-1">
          {/* Mode Switch: 4 Modes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setTransferMode('staff_to_staff')}
              className={`py-2 px-2 rounded-lg transition-all text-center cursor-pointer flex items-center justify-center space-x-1 ${
                transferMode === 'staff_to_staff'
                  ? 'bg-gradient-to-r from-rose-600 to-indigo-600 text-white shadow-xs font-extrabold'
                  : 'text-rose-700 bg-rose-50/70 hover:bg-white border border-rose-200/70'
              }`}
              title="Chuyển toàn bộ Via, Group, Page của 1 nhân viên cũ nghỉ sang cho 1 nhân viên khác chỉ với 1 cú nhấp"
            >
              <UserCheck className="w-3.5 h-3.5 shrink-0" />
              <span>🔄 Chuyển Full 1 NV (Via+Group+Page)</span>
            </button>
            <button
              type="button"
              onClick={() => setTransferMode('via_to_staff')}
              className={`py-2 px-2 rounded-lg transition-all text-center cursor-pointer flex items-center justify-center space-x-1 ${
                transferMode === 'via_to_staff'
                  ? 'bg-emerald-600 text-white shadow-xs font-extrabold'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>Chuyển Lẻ Via + Page</span>
            </button>
            <button
              type="button"
              onClick={() => setTransferMode('single')}
              className={`py-2 px-2 rounded-lg transition-all text-center cursor-pointer ${
                transferMode === 'single'
                  ? 'bg-white text-indigo-700 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              Đổi 1 Page Sang Via Khác
            </button>
            <button
              type="button"
              onClick={() => setTransferMode('batch')}
              className={`py-2 px-2 rounded-lg transition-all text-center cursor-pointer ${
                transferMode === 'batch'
                  ? 'bg-white text-indigo-700 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              Đổi Nhiều Page Sang Via Khác
            </button>
          </div>

          {transferMode === 'staff_to_staff' ? (
            /* ================= MODE 0: CHUYỂN FULL 1 NHÂN VIÊN (TOÀN BỘ VIA + GROUP + PAGE) SANG NHÂN VIÊN KHÁC ================= */
            <div className="space-y-4">
              {/* Banner hướng dẫn */}
              <div className="p-3 bg-gradient-to-r from-indigo-50 via-purple-50 to-rose-50 border border-indigo-200 rounded-xl flex items-start space-x-2.5 text-xs">
                <UserCheck className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                <div className="text-slate-700 leading-relaxed">
                  <strong className="text-indigo-950">Bàn Giao Full Khi Nhân Viên Nghỉ Việc / Điều Chuyển:</strong>{' '}
                  Chọn <strong>1 Nhân viên cũ (nguồn)</strong> và <strong>1 Nhân viên mới nhận bàn giao</strong>. Hệ thống sẽ tự động chuyển toàn bộ{' '}
                  <span className="font-bold text-indigo-700">Nick Via (Bảng 4)</span> +{' '}
                  <span className="font-bold text-rose-700">Group FB (Bảng 2)</span> +{' '}
                  <span className="font-bold text-emerald-700">Fanpage (Bảng 1)</span> sang cho nhân viên mới đồng bộ 100% trên Cloud Firestore.
                </div>
              </div>

              {/* STEP 1: CHỌN NHÂN VIÊN CŨ / NGUỒN CẦN BÀN GIAO */}
              <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
                    <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[11px] flex items-center justify-center font-bold">
                      1
                    </span>
                    <span>Chọn Nhân Viên Cũ / Nguồn Cần Chuyển Đi</span>
                  </label>
                  {staffSummariesForFullTransfer.length > 5 && (
                    <div className="relative w-56">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={sourceStaffSearchQuery}
                        onChange={(e) => setSourceStaffSearchQuery(e.target.value)}
                        placeholder="Tìm nhanh tên nhân viên..."
                        className="w-full pl-8 pr-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-rose-500"
                      />
                    </div>
                  )}
                </div>

                {/* Dropdown chọn nhân viên nguồn */}
                <select
                  value={sourceStaffForFullTransfer}
                  onChange={(e) => {
                    const nextSrc = e.target.value;
                    setSourceStaffForFullTransfer(nextSrc);
                    setErrorMessage(null);
                    if (
                      targetStaffForFullTransfer &&
                      (targetStaffForFullTransfer.trim().toLowerCase() === nextSrc.trim().toLowerCase() ||
                        areStaffNamesEquivalent(targetStaffForFullTransfer, nextSrc))
                    ) {
                      const alt = staffSummariesForFullTransfer.find(
                        (s) => s.name.trim().toLowerCase() !== nextSrc.trim().toLowerCase()
                      );
                      setTargetStaffForFullTransfer(alt ? alt.name : ADMIN_WAITING_POOL);
                    }
                  }}
                  className="w-full px-3 py-2 bg-white border-2 border-rose-300 rounded-xl text-sm font-extrabold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 cursor-pointer"
                >
                  <option value="">-- Chọn nhân viên cũ cần chuyển toàn bộ dữ liệu --</option>
                  {filteredSourceStaffList.map((s) => (
                    <option key={s.name} value={s.name}>
                      👤 {s.name} — Đang giữ: {s.viasCount} Via • {s.groupsCount} Group • {s.pagesCount} Page
                      {s.accountStatus === 'blocked' ? ' (Đã khóa TK)' : ''}
                    </option>
                  ))}
                </select>

                {/* Lưới chọn nhanh nhân viên nguồn kèm badge số lượng Via / Group / Page */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pt-1">
                  {filteredSourceStaffList.map((s) => {
                    const isSelected =
                      sourceStaffForFullTransfer.trim().toLowerCase() === s.name.trim().toLowerCase();
                    return (
                      <button
                        key={s.name}
                        type="button"
                        onClick={() => {
                          setSourceStaffForFullTransfer(s.name);
                          setErrorMessage(null);
                          if (
                            targetStaffForFullTransfer &&
                            targetStaffForFullTransfer.trim().toLowerCase() === s.name.trim().toLowerCase()
                          ) {
                            const alt = staffSummariesForFullTransfer.find(
                              (other) => other.name.trim().toLowerCase() !== s.name.trim().toLowerCase()
                            );
                            setTargetStaffForFullTransfer(alt ? alt.name : ADMIN_WAITING_POOL);
                          }
                        }}
                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-rose-600 text-white border-rose-700 shadow-xs ring-2 ring-rose-300'
                            : 'bg-white hover:bg-rose-50/60 text-slate-800 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-extrabold text-xs truncate">👤 {s.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </div>
                        <div
                          className={`text-[10px] font-semibold mt-1 flex flex-wrap items-center gap-1 ${
                            isSelected ? 'text-rose-100' : 'text-slate-500'
                          }`}
                        >
                          <span>{s.viasCount} Via</span>
                          <span>•</span>
                          <span>{s.groupsCount} Grp</span>
                          <span>•</span>
                          <span>{s.pagesCount} Page</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Chi tiết 3 hạng mục dữ liệu của Nhân viên nguồn (Tích chọn chuyển Full Via + Group + Page) */}
                {sourceStaffForFullTransfer && (
                  <div className="mt-2 pt-3 border-t border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className="text-xs font-extrabold text-slate-800">
                        Dữ liệu của <span className="text-rose-600">{sourceStaffForFullTransfer}</span> sẽ được chuyển:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setFullTransferIncludeVias(true);
                          setFullTransferIncludeGroups(true);
                          setFullTransferIncludePages(true);
                        }}
                        className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        ✓ Chọn Full cả 3 (Via + Group + Page)
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Card 1: Nick Via (Bảng 4) */}
                      <label
                        className={`p-2.5 rounded-xl border-2 cursor-pointer transition-all select-none flex flex-col justify-between ${
                          fullTransferIncludeVias
                            ? 'bg-indigo-50/80 border-indigo-400 shadow-2xs'
                            : 'bg-white border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex items-center space-x-1.5">
                            <input
                              type="checkbox"
                              checked={fullTransferIncludeVias}
                              onChange={(e) => setFullTransferIncludeVias(e.target.checked)}
                              className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className="text-xs font-extrabold text-indigo-950 flex items-center gap-1">
                              <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Nick Via (Bảng 4)</span>
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-xs font-black bg-indigo-600 text-white">
                            {sourceStaffDetails.vias.length}
                          </span>
                        </div>
                        <div className="mt-1.5 text-[10px] text-slate-600">
                          {sourceStaffDetails.vias.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-h-14 overflow-y-auto">
                              {sourceStaffDetails.vias.slice(0, 6).map((v) => (
                                <span
                                  key={v.id}
                                  className="px-1.5 py-0.5 bg-white border border-indigo-200 rounded font-mono text-[10px] text-indigo-900"
                                >
                                  {v.uid}
                                </span>
                              ))}
                              {sourceStaffDetails.vias.length > 6 && (
                                <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded font-bold">
                                  +{sourceStaffDetails.vias.length - 6} Via
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="italic text-slate-400">Không có Via nào</span>
                          )}
                        </div>
                      </label>

                      {/* Card 2: Group FB (Bảng 2) */}
                      <label
                        className={`p-2.5 rounded-xl border-2 cursor-pointer transition-all select-none flex flex-col justify-between ${
                          fullTransferIncludeGroups
                            ? 'bg-rose-50/80 border-rose-400 shadow-2xs'
                            : 'bg-white border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex items-center space-x-1.5">
                            <input
                              type="checkbox"
                              checked={fullTransferIncludeGroups}
                              onChange={(e) => setFullTransferIncludeGroups(e.target.checked)}
                              className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                            />
                            <span className="text-xs font-extrabold text-rose-950 flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-rose-600" />
                              <span>Group FB (Bảng 2)</span>
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white">
                            {sourceStaffDetails.groups.length}
                          </span>
                        </div>
                        <div className="mt-1.5 text-[10px] text-slate-600">
                          {sourceStaffDetails.groups.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-h-14 overflow-y-auto">
                              {sourceStaffDetails.uniqueGroupNames.slice(0, 5).map((gName, idx) => (
                                <span
                                  key={idx}
                                  className="px-1.5 py-0.5 bg-white border border-rose-200 rounded text-[10px] text-rose-900 truncate max-w-[130px]"
                                  title={gName}
                                >
                                  {gName}
                                </span>
                              ))}
                              {sourceStaffDetails.uniqueGroupNames.length > 5 && (
                                <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded font-bold">
                                  +{sourceStaffDetails.uniqueGroupNames.length - 5} nhóm
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="italic text-slate-400">Không có Group nào</span>
                          )}
                        </div>
                      </label>

                      {/* Card 3: Fanpage (Bảng 1) */}
                      <label
                        className={`p-2.5 rounded-xl border-2 cursor-pointer transition-all select-none flex flex-col justify-between ${
                          fullTransferIncludePages
                            ? 'bg-emerald-50/80 border-emerald-400 shadow-2xs'
                            : 'bg-white border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex items-center space-x-1.5">
                            <input
                              type="checkbox"
                              checked={fullTransferIncludePages}
                              onChange={(e) => setFullTransferIncludePages(e.target.checked)}
                              className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <span className="text-xs font-extrabold text-emerald-950 flex items-center gap-1">
                              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Fanpage (Bảng 1)</span>
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-600 text-white">
                            {sourceStaffDetails.pages.length}
                          </span>
                        </div>
                        <div className="mt-1.5 text-[10px] text-slate-600">
                          {sourceStaffDetails.pages.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-h-14 overflow-y-auto">
                              {sourceStaffDetails.pages.slice(0, 5).map((p) => (
                                <span
                                  key={p.id}
                                  className="px-1.5 py-0.5 bg-white border border-emerald-200 rounded text-[10px] text-emerald-900 truncate max-w-[130px]"
                                  title={p.pageName}
                                >
                                  {p.pageName}
                                </span>
                              ))}
                              {sourceStaffDetails.pages.length > 5 && (
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold">
                                  +{sourceStaffDetails.pages.length - 5} page
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="italic text-slate-400">Không có Fanpage nào</span>
                          )}
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 2: CHỌN NHÂN VIÊN MỚI NHẬN BÀN GIAO (HOẶC KHO CHỜ ADMIN) */}
              <div className="space-y-2.5 bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center font-bold">
                    2
                  </span>
                  <span>Chọn Nhân Viên Khác Nhận Toàn Bộ Bàn Giao (Hoặc Kho Chờ Admin)</span>
                </label>

                <select
                  value={targetStaffForFullTransfer}
                  onChange={(e) => {
                    setTargetStaffForFullTransfer(e.target.value);
                    setErrorMessage(null);
                  }}
                  className="w-full px-3 py-2 bg-white border-2 border-emerald-400 rounded-xl text-sm font-extrabold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 cursor-pointer"
                >
                  <option value="">-- Chọn nhân viên nhận bàn giao --</option>
                  {currentUser.role === 'admin' && (
                    <option value={ADMIN_WAITING_POOL}>
                      📦 {ADMIN_WAITING_POOL} (Cất vào Kho Chờ Admin - Chưa NV nào dùng)
                    </option>
                  )}
                  {staffSummariesForFullTransfer
                    .filter(
                      (s) =>
                        s.name.trim().toLowerCase() !==
                        sourceStaffForFullTransfer.trim().toLowerCase()
                    )
                    .map((s) => (
                      <option key={s.name} value={s.name}>
                        👤 {s.name} (Hiện có: {s.viasCount} Via • {s.groupsCount} Group • {s.pagesCount} Page)
                      </option>
                    ))}
                  <option value="__CUSTOM_NEW__">➕ Nhập tên nhân viên mới khác...</option>
                </select>

                {targetStaffForFullTransfer === '__CUSTOM_NEW__' && (
                  <input
                    type="text"
                    value={customNewTargetStaff}
                    onChange={(e) => setCustomNewTargetStaff(e.target.value)}
                    placeholder="Nhập tên nhân viên mới nhận bàn giao (VD: MS.LAN)..."
                    className="w-full px-3 py-2 bg-white border border-emerald-400 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-600"
                  />
                )}

                {/* Nút chọn nhanh nhân viên đích */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pt-1">
                  {currentUser.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => setTargetStaffForFullTransfer(ADMIN_WAITING_POOL)}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between ${
                        isAdminWaitingPool(targetStaffForFullTransfer)
                          ? 'bg-amber-600 text-white border-amber-700 shadow-xs font-extrabold'
                          : 'bg-amber-50/80 hover:bg-amber-100 text-amber-950 border-amber-300 font-bold'
                      }`}
                    >
                      <span className="text-xs truncate">📦 {ADMIN_WAITING_POOL}</span>
                      {isAdminWaitingPool(targetStaffForFullTransfer) && (
                        <Check className="w-3.5 h-3.5 shrink-0" />
                      )}
                    </button>
                  )}
                  {staffSummariesForFullTransfer
                    .filter(
                      (s) =>
                        s.name.trim().toLowerCase() !==
                        sourceStaffForFullTransfer.trim().toLowerCase()
                    )
                    .map((s) => {
                      const isSelected =
                        targetStaffForFullTransfer.trim().toLowerCase() ===
                        s.name.trim().toLowerCase();
                      return (
                        <button
                          key={s.name}
                          type="button"
                          onClick={() => setTargetStaffForFullTransfer(s.name)}
                          className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs ring-2 ring-emerald-300'
                              : 'bg-white hover:bg-emerald-50 text-slate-800 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-extrabold text-xs truncate">👤 {s.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                          </div>
                          <span
                            className={`text-[10px] font-semibold mt-0.5 ${
                              isSelected ? 'text-emerald-100' : 'text-slate-500'
                            }`}
                          >
                            Đang có: {s.viasCount} Via • {s.groupsCount} Grp • {s.pagesCount} Page
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* STEP 3: XỬ LÝ TÀI KHOẢN NHÂN VIÊN CŨ (KHI NHÂN VIÊN NGHỈ VIỆC) & GHI CHÚ */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-700 text-white text-[11px] flex items-center justify-center font-bold">
                    3
                  </span>
                  <span>Tùy Chọn Xử Lý Tài Khoản Nhân Viên Cũ ({sourceStaffForFullTransfer || '...'})</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <label
                    className={`flex items-start space-x-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      oldAccountAction === 'keep'
                        ? 'bg-white border-indigo-500 ring-1 ring-indigo-500 font-bold'
                        : 'bg-white/70 border-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="oldAccountAction"
                      checked={oldAccountAction === 'keep'}
                      onChange={() => setOldAccountAction('keep')}
                      className="mt-0.5 text-indigo-600"
                    />
                    <div>
                      <span className="block text-slate-900 font-bold">Giữ nguyên tài khoản</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        Chỉ chuyển Via, Group, Page sang NV mới
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start space-x-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      oldAccountAction === 'block'
                        ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-500 font-bold'
                        : 'bg-white/70 border-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="oldAccountAction"
                      checked={oldAccountAction === 'block'}
                      onChange={() => setOldAccountAction('block')}
                      className="mt-0.5 text-amber-600"
                    />
                    <div>
                      <span className="block text-amber-950 font-bold flex items-center gap-1">
                        <Lock className="w-3 h-3 text-amber-600" />
                        <span>Tạm khóa TK NV cũ</span>
                      </span>
                      <span className="text-[10px] text-amber-800 font-normal">
                        Khóa đăng nhập nhân viên cũ sau khi bàn giao
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start space-x-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      oldAccountAction === 'delete'
                        ? 'bg-rose-50 border-rose-500 ring-1 ring-rose-500 font-bold'
                        : 'bg-white/70 border-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="oldAccountAction"
                      checked={oldAccountAction === 'delete'}
                      onChange={() => setOldAccountAction('delete')}
                      className="mt-0.5 text-rose-600"
                    />
                    <div>
                      <span className="block text-rose-950 font-bold flex items-center gap-1">
                        <Trash2 className="w-3 h-3 text-rose-600" />
                        <span>Xóa TK đăng nhập NV cũ</span>
                      </span>
                      <span className="text-[10px] text-rose-800 font-normal">
                        Thu hồi PIN & xóa tên NV cũ đã nghỉ việc
                      </span>
                    </div>
                  </label>
                </div>

                {/* Ghi chú bàn giao */}
                <div className="pt-2 border-t border-slate-200 space-y-1.5 text-xs">
                  <label className="flex items-center space-x-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={appendHistoryNote}
                      onChange={(e) => setAppendHistoryNote(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="font-bold text-slate-800">
                      Ghi chú lịch sử bàn giao vào Via & Page
                    </span>
                  </label>
                  {appendHistoryNote && (
                    <input
                      type="text"
                      value={historyNoteText}
                      onChange={(e) => setHistoryNoteText(e.target.value)}
                      placeholder="Nội dung ghi chú bàn giao..."
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500"
                    />
                  )}
                </div>
              </div>

              {/* STEP 4: TỔNG KẾT ĐỐI CHIẾU TRƯỚC KHI BÀN GIAO FULL */}
              {sourceStaffForFullTransfer && resolvedFullTransferTargetStaff && (
                <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-xl text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-emerald-950 font-extrabold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Xác nhận bàn giao toàn bộ tài nguyên nhân sự:</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white">
                      Chuyển 1 Chạm
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
                    <div>
                      <span className="text-[10px] text-rose-600 font-extrabold uppercase block">
                        NHÂN VIÊN CŨ (NGUỒN)
                      </span>
                      <span className="text-sm font-black text-slate-900 block">
                        👤 {sourceStaffForFullTransfer}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {oldAccountAction === 'delete'
                          ? '🗑️ Sẽ xóa TK đăng nhập sau khi chuyển'
                          : oldAccountAction === 'block'
                          ? '🔒 Sẽ tạm khóa TK sau khi chuyển'
                          : 'Giữ nguyên tài khoản'}
                      </span>
                    </div>

                    <div className="flex flex-col items-center px-3 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-1 mb-1">
                        {fullTransferIncludeVias && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-300">
                            {sourceStaffDetails.vias.length} Via
                          </span>
                        )}
                        {fullTransferIncludeGroups && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                            {sourceStaffDetails.groups.length} Group
                          </span>
                        )}
                        {fullTransferIncludePages && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                            {sourceStaffDetails.pages.length} Page
                          </span>
                        )}
                      </div>
                      <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-emerald-700 font-extrabold uppercase block">
                        NHÂN VIÊN NHẬN BÀN GIAO
                      </span>
                      <span className="text-sm font-black text-emerald-800 block">
                        {isAdminWaitingPool(resolvedFullTransferTargetStaff)
                          ? `📦 ${resolvedFullTransferTargetStaff}`
                          : `👤 ${resolvedFullTransferTargetStaff}`}
                      </span>
                      <span className="text-[11px] text-slate-600 font-semibold">
                        {isAdminWaitingPool(resolvedFullTransferTargetStaff)
                          ? 'Lưu trữ vào Kho Chờ Admin'
                          : '🔴 Tự động báo đỏ Via & Page mới nhận'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : transferMode === 'via_to_staff' ? (
            /* ================= MODE 1: CHUYỂN VIA + TOÀN BỘ PAGE VIA ĐÓ CẦM (KHO CHỜ ADMIN ⇄ NHÂN VIÊN) ================= */
            <>
              {/* STEP 1: CHỌN NICK VIA (KÈM TOÀN BỘ PAGE ĐANG CẦM) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center font-bold">
                      1
                    </span>
                    <span>Chọn Nick Via (Via Trống Hoặc Via + Toàn Bộ Page Cầm)</span>
                  </label>
                  <div className="flex items-center space-x-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSelectedViaUidsForStaffTransfer(filteredSourceVias.map((v) => v.uid))}
                      className="text-emerald-700 hover:underline font-bold cursor-pointer"
                    >
                      Chọn hết ({filteredSourceVias.length} Via)
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedViaUidsForStaffTransfer([])}
                      className="text-slate-500 hover:underline cursor-pointer"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>

                {/* Bộ lọc nhanh nguồn Via: Tất cả / Trong Kho Chờ Admin / Đang ở NV / Có Page / Via trống */}
                <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setViaSourceQuickFilter('all')}
                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                      viaSourceQuickFilter === 'all'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-white'
                    }`}
                  >
                    Tất cả ({sourceViaCounts.all})
                  </button>
                  <button
                    type="button"
                    onClick={() => setViaSourceQuickFilter('waiting_pool')}
                    className={`px-2 py-1 rounded-md transition-all cursor-pointer flex items-center space-x-1 ${
                      viaSourceQuickFilter === 'waiting_pool'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'text-amber-900 bg-amber-50/80 hover:bg-amber-100 border border-amber-200'
                    }`}
                  >
                    <span>📦 Trong Kho Chờ Admin ({sourceViaCounts.waitingPool})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViaSourceQuickFilter('staff')}
                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                      viaSourceQuickFilter === 'staff'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-700 hover:bg-white'
                    }`}
                  >
                    👤 Đang ở NV ({sourceViaCounts.staffAssigned})
                  </button>
                  <button
                    type="button"
                    onClick={() => setViaSourceQuickFilter('has_pages')}
                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                      viaSourceQuickFilter === 'has_pages'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-emerald-800 hover:bg-white'
                    }`}
                  >
                    📗 Via + Page ({sourceViaCounts.hasPages})
                  </button>
                  <button
                    type="button"
                    onClick={() => setViaSourceQuickFilter('no_pages')}
                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                      viaSourceQuickFilter === 'no_pages'
                        ? 'bg-slate-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-white'
                    }`}
                  >
                    ⚪ Via trống 0 Page ({sourceViaCounts.noPages})
                  </button>
                </div>

                {/* Search Via */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={viaSourceSearchQuery}
                    onChange={(e) => setViaSourceSearchQuery(e.target.value)}
                    placeholder="Tìm theo UID Via, Kho Chờ Admin, tên nhân viên, hoặc tên Fanpage..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                {/* List of Vias with their Page counts & Page names */}
                <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                  {filteredSourceVias.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Không tìm thấy Nick Via nào phù hợp trong bộ lọc này
                    </div>
                  ) : (
                    filteredSourceVias.map((v) => {
                      const isChecked = selectedViaUidsForStaffTransfer.some(
                        (u) => u.trim().toLowerCase() === v.uid.trim().toLowerCase()
                      );
                      const inWaitingPool = isAdminWaitingPool(v.staffName) || !v.staffName.trim();
                      const doingPagesCount = v.pages.filter((p) => p.status !== 'Không làm').length;
                      const notDoingPagesCount = v.pages.filter((p) => p.status === 'Không làm').length;

                      return (
                        <label
                          key={v.uid}
                          className={`flex flex-col p-2.5 hover:bg-slate-50 cursor-pointer transition-colors ${
                            isChecked ? 'bg-emerald-50/70 border-l-4 border-l-emerald-600' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleViaForStaffTransfer(v.uid)}
                                className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer w-4 h-4 shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center space-x-1.5 flex-wrap">
                                  <span className="font-mono font-black text-xs text-indigo-950">
                                    {v.uid}
                                  </span>
                                  {inWaitingPool ? (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-extrabold text-[10px] border border-amber-300">
                                      📦 Kho Chờ Admin (Chưa NV dùng)
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-bold text-[10px] border border-slate-200">
                                      👤 NV đang cầm: {v.staffName}
                                    </span>
                                  )}
                                  {v.fullViaItem && (v.fullViaItem.pass || v.fullViaItem.twoFa || v.fullViaItem.rawFullVia?.includes('|')) && (
                                    <span className="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[9px] font-bold">
                                      🔑 Full Via (Pass/2FA)
                                    </span>
                                  )}
                                  {v.isError && (
                                    <span className="px-1.5 py-0.2 bg-rose-100 text-rose-700 rounded text-[9px] font-bold">
                                      Đang báo lỗi
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-1.5 shrink-0">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border shadow-2xs ${
                                  v.pageCount >= 2
                                    ? 'bg-emerald-600 text-white border-emerald-700'
                                    : v.pageCount === 1
                                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}
                              >
                                {v.pageCount > 0 ? `📗 Đang cầm ${v.pageCount} Page` : '⚪ Via trống (0 Page)'}
                              </span>
                            </div>
                          </div>

                          {/* Danh sách các Page mà Via này đang cầm */}
                          {v.pages.length > 0 && (
                            <div className="mt-1.5 pl-6 flex flex-wrap items-center gap-1">
                              <span className="text-[10px] font-bold text-slate-500 mr-1">
                                ({doingPagesCount} Đang làm{notDoingPagesCount > 0 ? `, ${notDoingPagesCount} Không làm` : ''}):
                              </span>
                              {v.pages.map((p, idx) => (
                                <span
                                  key={p.id}
                                  className={`inline-flex items-center space-x-1 text-[10px] px-1.5 py-0.2 rounded border font-semibold ${
                                    p.status === 'Không làm'
                                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                                      : 'bg-white text-slate-800 border-slate-200 shadow-2xs'
                                  }`}
                                >
                                  <span className="text-slate-400 font-mono">{idx + 1}.</span>
                                  <span className="truncate max-w-[150px]">{p.pageName}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* STEP 2: CHỌN KHO CHỜ ADMIN HOẶC NHÂN VIÊN NHẬN VIA + TOÀN BỘ PAGE */}
              <div className="space-y-2.5 pt-2 border-t border-slate-200">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center font-bold">
                    2
                  </span>
                  <span>Chọn Nơi Chuyển Đến: Kho Chờ Admin Hoặc Nhân Viên Nhận Dùng</span>
                </label>

                {/* LỰA CHỌN ĐẶC BIỆT: ĐƯA VÀO KHO CHỜ CỦA ADMIN (CHƯA NHÂN VIÊN NÀO DÙNG) */}
                {currentUser.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => setTargetStaffForViaTransfer(ADMIN_WAITING_POOL)}
                    className={`w-full p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex items-center justify-between ${
                      isTargetWaitingPool
                        ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white border-amber-700 shadow-md ring-2 ring-amber-300'
                        : 'bg-amber-50/80 hover:bg-amber-100/80 text-amber-950 border-amber-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div
                        className={`p-2 rounded-lg shrink-0 ${
                          isTargetWaitingPool ? 'bg-white/20 text-white' : 'bg-amber-200/80 text-amber-900'
                        }`}
                      >
                        <Archive className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black flex items-center space-x-1.5">
                          <span>📦 CHUYỂN VÀO KHO CHỜ CỦA ADMIN ({ADMIN_WAITING_POOL})</span>
                        </div>
                        <p
                          className={`text-[11px] mt-0.5 ${
                            isTargetWaitingPool ? 'text-amber-100' : 'text-amber-800'
                          }`}
                        >
                          Lưu trữ Via & Via + Page vào Kho Chờ (Chưa nhân viên nào dùng — Khi nào cần sẽ chuyển qua cho nhân viên dùng)
                        </p>
                      </div>
                    </div>
                    {isTargetWaitingPool && <Check className="w-5 h-5 text-white shrink-0" />}
                  </button>
                )}

                {/* DANH SÁCH NHÂN VIÊN NHẬN VIA + PAGE ĐỂ DÙNG */}
                <div>
                  <span className="text-[11px] font-bold text-slate-500 block mb-1.5">
                    Hoặc chọn Nhân Viên để giao Via + Page sử dụng ngay:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {allStaffNames
                      .filter((n) => !isAdminWaitingPool(n))
                      .map((name) => {
                        const isSelected =
                          !isTargetWaitingPool &&
                          targetStaffForViaTransfer.trim().toLowerCase() === name.trim().toLowerCase();
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => setTargetStaffForViaTransfer(name)}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs font-extrabold ring-2 ring-emerald-300'
                                : 'bg-white hover:bg-emerald-50/60 text-slate-800 border-slate-200 font-bold'
                            }`}
                          >
                            <div className="flex items-center space-x-2 min-w-0">
                              <UserCheck className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-emerald-600'}`} />
                              <span className="text-xs truncate">{name}</span>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-white shrink-0" />}
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* PHẦN BỔ SUNG THÊM THÔNG TIN VIA (2FA | MAIL | PASS...) NẾU CHỌN 1 VIA TRONG MODE 1 */}
              {selectedViaUidsForStaffTransfer.length === 1 && resolvedTargetViaUid && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <div className="flex items-center space-x-1.5 font-extrabold text-amber-950">
                      <KeyRound className="w-3.5 h-3.5 text-amber-700" />
                      <span>
                        Bổ sung thêm thông tin cho Via ({resolvedTargetViaUid}): 2FA | Mail | Pass...
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 text-[10px] font-bold">
                      <span className={`px-1.5 py-0.5 rounded border ${suppPass ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                        {suppPass ? '✓ Có Pass' : 'Thiếu Pass'}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded border ${suppTwoFa ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                        {suppTwoFa ? '✓ Có 2FA' : 'Thiếu 2FA'}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded border ${suppEmail ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-slate-600 border-slate-200'}`}>
                        {suppEmail ? '✓ Có Mail' : '+ Mail'}
                      </span>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={quickPasteSupp}
                    onChange={(e) => handleQuickPasteSuppChange(e.target.value)}
                    placeholder="⚡ Dán nhanh: 2FA|Mail|Pass hoặc Pass|2FA|Mail|PassMail (tự động tách vào các ô dưới)..."
                    className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-[11px] font-mono text-slate-900 focus:outline-hidden focus:border-amber-600"
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      value={suppPass}
                      onChange={(e) => setSuppPass(e.target.value)}
                      placeholder="Pass Via..."
                      className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-[11px] font-mono"
                    />
                    <input
                      type="text"
                      value={suppTwoFa}
                      onChange={(e) => setSuppTwoFa(e.target.value)}
                      placeholder="Mã 2FA..."
                      className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-[11px] font-mono"
                    />
                    <input
                      type="text"
                      value={suppEmail}
                      onChange={(e) => setSuppEmail(e.target.value)}
                      placeholder="Mail khôi phục..."
                      className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-[11px] font-mono"
                    />
                    <input
                      type="text"
                      value={suppEmailPass}
                      onChange={(e) => setSuppEmailPass(e.target.value)}
                      placeholder="Pass Mail..."
                      className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-[11px] font-mono"
                    />
                  </div>
                </div>
              )}

              {/* STEP 3: GHI CHÚ LỊCH SỬ BÀN GIAO */}
              <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200 text-xs space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={appendHistoryNote}
                    onChange={(e) => setAppendHistoryNote(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="font-bold text-emerald-950">
                    Lưu lịch sử bàn giao vào cột Đổi Via & Ghi Chú Chung Cả Via
                  </span>
                </label>

                {appendHistoryNote && (
                  <input
                    type="text"
                    value={historyNoteText}
                    onChange={(e) => setHistoryNoteText(e.target.value)}
                    placeholder="Nội dung ghi chú bàn giao..."
                    className="w-full px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-emerald-600"
                  />
                )}
              </div>

              {/* STEP 4: XEM TRƯỚC KẾT QUẢ BÀN GIAO */}
              {selectedViaObjectsForStaffTransfer.length > 0 && targetStaffForViaTransfer && (
                <div
                  className={`p-3.5 border rounded-xl text-xs space-y-2.5 ${
                    isTargetWaitingPool
                      ? 'bg-amber-50/90 border-amber-300'
                      : 'bg-indigo-50/80 border-indigo-200'
                  }`}
                >
                  <div className="flex items-center space-x-2 text-slate-900 font-extrabold text-xs">
                    <CheckCircle2
                      className={`w-4 h-4 shrink-0 ${
                        isTargetWaitingPool ? 'text-amber-600' : 'text-emerald-600'
                      }`}
                    />
                    <span>
                      {isTargetWaitingPool
                        ? 'Tổng kết chuyển Via & Page vào Kho Chờ Của Admin:'
                        : 'Tổng kết bàn giao Via + Toàn bộ Page sang Nhân Viên:'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                    <div className="text-left">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">
                        NICK VIA & PAGE CHUYỂN ĐI
                      </span>
                      <span className="font-mono font-black text-indigo-950 text-xs block">
                        {selectedViaObjectsForStaffTransfer.length === 1
                          ? `UID: ${selectedViaObjectsForStaffTransfer[0].uid}`
                          : `${selectedViaObjectsForStaffTransfer.length} Nick Via đã chọn`}
                      </span>
                      <span className="text-[11px] text-slate-600 font-semibold block">
                        Đang ở:{' '}
                        {Array.from(
                          new Set(
                            selectedViaObjectsForStaffTransfer.map((v) =>
                              isAdminWaitingPool(v.staffName) || !v.staffName.trim()
                                ? ADMIN_WAITING_POOL
                                : v.staffName
                            )
                          )
                        ).join(', ')}
                      </span>
                    </div>

                    <div className="flex flex-col items-center px-3">
                      <span
                        className={`text-[11px] font-extrabold text-white px-2.5 py-0.5 rounded-full mb-1 shadow-2xs ${
                          isTargetWaitingPool ? 'bg-amber-600' : 'bg-emerald-600'
                        }`}
                      >
                        {selectedViaObjectsForStaffTransfer.length} Via + {pagesOfSelectedViasForStaffTransfer.length} Page
                      </span>
                      <ArrowRightLeft
                        className={`w-4 h-4 ${
                          isTargetWaitingPool ? 'text-amber-700' : 'text-emerald-700'
                        }`}
                      />
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-[10px] block font-bold uppercase ${
                          isTargetWaitingPool ? 'text-amber-700' : 'text-emerald-700'
                        }`}
                      >
                        {isTargetWaitingPool ? 'KHO LƯU TRỮ ADMIN' : 'NHÂN VIÊN NHẬN DÙNG'}
                      </span>
                      <span
                        className={`font-black text-sm block ${
                          isTargetWaitingPool ? 'text-amber-900' : 'text-emerald-900'
                        }`}
                      >
                        {isTargetWaitingPool
                          ? `📦 ${ADMIN_WAITING_POOL}`
                          : `👤 ${targetStaffForViaTransfer}`}
                      </span>
                      <span
                        className={`text-[11px] font-bold block ${
                          isTargetWaitingPool ? 'text-amber-800' : 'text-emerald-700'
                        }`}
                      >
                        {isTargetWaitingPool
                          ? 'Chưa nhân viên nào dùng'
                          : `Báo cầm ${pagesOfSelectedViasForStaffTransfer.length} Page trong Full Via`}
                      </span>
                    </div>
                  </div>

                  {isTargetWaitingPool ? (
                    <p className="text-[11px] text-amber-950 leading-relaxed">
                      ✓ <strong>Cất vào Kho Chờ Của Admin (Gồm cả Full Via):</strong> Toàn bộ{' '}
                      <strong>{selectedViaObjectsForStaffTransfer.length} Nick Via (UID + Full Via Pass/2FA trong Quản Trị Full Via)</strong> và{' '}
                      <strong>{pagesOfSelectedViasForStaffTransfer.length} Fanpage</strong> đi kèm sẽ được đưa vào{' '}
                      <strong>📦 {ADMIN_WAITING_POOL}</strong> (ẩn khỏi tài khoản nhân viên, chưa nhân viên nào dùng). Khi nào cần, Admin chỉ cần chọn và bấm chuyển sang cho nhân viên đó dùng!
                    </p>
                  ) : (
                    <p className="text-[11px] text-indigo-900 leading-relaxed">
                      ✓ <strong>Đồng bộ tự động 100% cả Quản Lý Page & Quản Trị Full Via:</strong> Khi chuyển UID & Page sang cho{' '}
                      <strong>{targetStaffForViaTransfer}</strong>, toàn bộ{' '}
                      <strong>{selectedViaObjectsForStaffTransfer.length} Full Via (UID | Pass | 2FA) trong Quản Trị Full Via</strong> và{' '}
                      <strong>{pagesOfSelectedViasForStaffTransfer.length} Fanpage</strong> của Via đó sẽ chuyển sang tên{' '}
                      <strong>{targetStaffForViaTransfer}</strong> ngay lập tức!
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            /* ================= MODE 2 & 3: CHUYỂN PAGE SANG VIA KHÁC ================= */
            <>
              {/* STEP 1: CHỌN FANPAGE CẦN CHUYỂN */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] flex items-center justify-center font-bold">
                      1
                    </span>
                    <span>Chọn Fanpage Cần Chuyển</span>
                  </label>

                  {transferMode === 'batch' && (
                    <div className="flex items-center space-x-2 text-[11px]">
                      <button
                        type="button"
                        onClick={selectAllPagesFromSource}
                        className="text-indigo-600 hover:underline font-semibold cursor-pointer"
                      >
                        Chọn tất cả ({selectablePages.length})
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={deselectAllPages}
                        className="text-slate-500 hover:underline cursor-pointer"
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  )}
                </div>

                {transferMode === 'single' ? (
                  /* Single Page Selector */
                  <div className="space-y-2">
                    <div className="relative">
                      <select
                        value={selectedPageId}
                        onChange={(e) => setSelectedPageId(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
                      >
                        {accessibleRecords.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.pageName} (Via: {r.viaUid} | NV: {r.staffName} | {r.status})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Card hiển thị toàn bộ thông tin hiện tại của Page */}
                    {currentSinglePage && (
                      <div className="bg-slate-50/90 rounded-xl p-3 border border-slate-200 text-xs space-y-2">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                          <div className="flex items-center space-x-2">
                            <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
                            <span className="font-extrabold text-slate-900 text-sm">
                              {currentSinglePage.pageName}
                            </span>
                          </div>
                          {currentSinglePage.pageLink && (
                            <a
                              href={currentSinglePage.pageLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center space-x-1 text-[11px] text-blue-600 hover:underline font-semibold"
                            >
                              <span>Mở Page</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>

                        {/* Thuộc tính của Page sẽ được chuyển nguyên vẹn */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                          <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">
                              Via Hiện Tại (C)
                            </span>
                            <span className="font-mono font-bold text-indigo-900 truncate block">
                              {currentSinglePage.viaUid}
                            </span>
                          </div>

                          <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">
                              Nhân Viên (B)
                            </span>
                            <span className="font-bold text-slate-800 truncate block">
                              {currentSinglePage.staffName}
                            </span>
                          </div>

                          <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">
                              Trạng Thái (F)
                            </span>
                            <span className="font-bold text-emerald-700 truncate block">
                              {currentSinglePage.status}
                            </span>
                          </div>

                          <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">
                              Tiến Độ Bài (K)
                            </span>
                            <span className="font-bold text-slate-800 truncate block">
                              {currentSinglePage.actualPosts}/{currentSinglePage.targetPosts} bài
                            </span>
                          </div>
                        </div>

                        {/* Chi tiết phụ: Chặn, Cách đăng, Tương tác, Ghi chú BM */}
                        <div className="flex flex-wrap gap-1.5 pt-1 text-[11px]">
                          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-medium">
                            Chặn: <strong className="text-slate-800">{currentSinglePage.blockStatus}</strong>
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-medium">
                            Cách đăng: <strong className="text-slate-800">{currentSinglePage.postingMethod}</strong>
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-medium">
                            Tương tác: <strong className="text-slate-800">{currentSinglePage.interaction}</strong>
                          </span>
                          {currentSinglePage.bmNote && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 font-medium truncate max-w-full">
                              BM: <strong>{getCleanBmName(currentSinglePage.bmNote)}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Batch Pages Selector */
                  <div className="space-y-2">
                    {/* Search filter for pages */}
                    <div className="flex items-center space-x-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={pageSearchQuery}
                          onChange={(e) => setPageSearchQuery(e.target.value)}
                          placeholder="Tìm kiếm theo tên Page hoặc UID Via..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                        />
                      </div>
                      {sourceViaFilter && (
                        <button
                          type="button"
                          onClick={() => setSourceViaFilter('')}
                          className="text-[11px] text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded-lg shrink-0 cursor-pointer"
                        >
                          Bỏ lọc Via nguồn ({sourceViaFilter})
                        </button>
                      )}
                    </div>

                    {/* Page checkbox list */}
                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                      {selectablePages.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                          Không tìm thấy Fanpage nào phù hợp
                        </div>
                      ) : (
                        selectablePages.map((page) => {
                          const isChecked = selectedBatchPageIds.includes(page.id);
                          return (
                            <label
                              key={page.id}
                              className={`flex items-center justify-between p-2.5 hover:bg-slate-50 cursor-pointer transition-colors ${
                                isChecked ? 'bg-indigo-50/60' : ''
                              }`}
                            >
                              <div className="flex items-center space-x-2.5">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleBatchPage(page.id)}
                                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                                <div>
                                  <div className="font-bold text-xs text-slate-900">
                                    {page.pageName}
                                  </div>
                                  <div className="text-[10px] text-slate-500 flex items-center space-x-2">
                                    <span>Via: <strong className="font-mono text-slate-700">{page.viaUid}</strong></span>
                                    <span>•</span>
                                    <span>NV: {page.staffName}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center space-x-1 text-[10px]">
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                                  {page.status}
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                                  {page.actualPosts}/{page.targetPosts} bài
                                </span>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 2: CHỌN NICK VIA ĐÍCH (NHẬN PAGE) */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] flex items-center justify-center font-bold">
                    2
                  </span>
                  <span>Chọn Nick Via Đích (Nhận Page)</span>
                </label>

                {/* Switch: Chọn Via có sẵn vs Nhập UID mới */}
                <div className="flex items-center space-x-2 text-xs">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="targetViaMode"
                      checked={targetViaMode === 'existing'}
                      onChange={() => setTargetViaMode('existing')}
                      className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="font-bold text-slate-800">
                      Chọn từ danh sách Via có sẵn ({knownVias.length} Via)
                    </span>
                  </label>

                  <label className="flex items-center space-x-1.5 cursor-pointer ml-3">
                    <input
                      type="radio"
                      name="targetViaMode"
                      checked={targetViaMode === 'new'}
                      onChange={() => setTargetViaMode('new')}
                      className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="font-bold text-slate-800">Nhập UID Via Mới</span>
                  </label>
                </div>

                {targetViaMode === 'existing' ? (
                  <div className="space-y-2">
                    {/* Search via */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={targetViaSearchQuery}
                        onChange={(e) => setTargetViaSearchQuery(e.target.value)}
                        placeholder="Tìm theo UID Via, Kho Chờ Admin, tên nhân viên phụ trách..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>

                    {/* Dropdown / list of target vias */}
                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                      {filteredTargetVias.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400">
                          Không tìm thấy Nick Via nào
                        </div>
                      ) : (
                        filteredTargetVias.map((v) => {
                          const isSelected = selectedTargetViaUid === v.uid;
                          const inPool = isAdminWaitingPool(v.staffName) || !v.staffName.trim();
                          return (
                            <div
                              key={v.uid}
                              onClick={() => setSelectedTargetViaUid(v.uid)}
                              className={`flex items-center justify-between p-2.5 hover:bg-slate-50 cursor-pointer transition-colors text-xs ${
                                isSelected ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : ''
                              }`}
                            >
                              <div className="flex items-center space-x-2.5">
                                <div
                                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border ${
                                    isSelected
                                      ? 'border-indigo-600 bg-indigo-600 text-white'
                                      : 'border-slate-300 bg-white'
                                  }`}
                                >
                                  {isSelected && <Check className="w-2.5 h-2.5" />}
                                </div>

                                <div>
                                  <div className="font-mono font-bold text-slate-900 flex items-center space-x-1.5">
                                    <span>{v.uid}</span>
                                    {inPool && (
                                      <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[9px] font-bold">
                                        📦 Kho Chờ Admin
                                      </span>
                                    )}
                                    {v.isError && (
                                      <span className="px-1.5 py-0.2 bg-rose-100 text-rose-700 rounded text-[9px] font-bold">
                                        Lỗi / Checkpoint
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 flex items-center space-x-2">
                                    <span>
                                      Chủ sở hữu: <strong>{inPool ? ADMIN_WAITING_POOL : v.staffName}</strong>
                                    </span>
                                    {v.fullViaItem?.note && (
                                      <>
                                        <span>•</span>
                                        <span className="truncate max-w-[140px] text-slate-400">
                                          {v.fullViaItem.note}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  📗 Đang cầm {v.pageCount} Page
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  /* Custom new via UID input */
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={customTargetViaUid}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.includes('|')) {
                          const parsed = parseSupplementalViaInput(val);
                          setCustomTargetViaUid(parsed.uid || val.split('|')[0].trim());
                          if (parsed.pass) setSuppPass(parsed.pass);
                          if (parsed.twoFa) setSuppTwoFa(parsed.twoFa);
                          if (parsed.email) setSuppEmail(parsed.email);
                          if (parsed.emailPass) setSuppEmailPass(parsed.emailPass);
                        } else {
                          setCustomTargetViaUid(val);
                        }
                      }}
                      placeholder="Nhập UID Nick Via mới hoặc dán UID|Pass|2FA|Mail|PassMail..."
                      className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    />
                    <p className="text-[11px] text-slate-500">
                      Nick Via mới sẽ được tạo trong hệ thống và nhận quyền quản lý Fanpage này.
                    </p>
                  </div>
                )}

                {/* BỔ SUNG THÊM THÔNG TIN VIA (2FA | MAIL | PASS...) KHI CHỌN VIA HOẶC ĐÃ CÓ UID ĐÍCH */}
                {resolvedTargetViaUid && (
                  <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <div className="flex items-center space-x-1.5 font-extrabold text-amber-950">
                        <KeyRound className="w-3.5 h-3.5 text-amber-700" />
                        <span>
                          Bổ sung thêm thông tin Via đích ({resolvedTargetViaUid.split('|')[0].trim()}): 2FA | Mail | Pass...
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 text-[10px] font-bold">
                        <span className={`px-1.5 py-0.5 rounded border ${suppPass ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                          {suppPass ? '✓ Có Pass' : 'Thiếu Pass'}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded border ${suppTwoFa ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                          {suppTwoFa ? '✓ Có 2FA' : 'Thiếu 2FA'}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded border ${suppEmail ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-slate-600 border-slate-200'}`}>
                          {suppEmail ? '✓ Có Mail' : '+ Mail'}
                        </span>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={quickPasteSupp}
                      onChange={(e) => handleQuickPasteSuppChange(e.target.value)}
                      placeholder="⚡ Dán nhanh: 2FA|Mail|Pass hoặc Pass|2FA|Mail|PassMail (tự động tách vào các ô dưới)..."
                      className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-[11px] font-mono text-slate-900 focus:outline-hidden focus:border-amber-600"
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <input
                        type="text"
                        value={suppPass}
                        onChange={(e) => setSuppPass(e.target.value)}
                        placeholder="Pass Via..."
                        className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-[11px] font-mono"
                      />
                      <input
                        type="text"
                        value={suppTwoFa}
                        onChange={(e) => setSuppTwoFa(e.target.value)}
                        placeholder="Mã 2FA..."
                        className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-[11px] font-mono"
                      />
                      <input
                        type="text"
                        value={suppEmail}
                        onChange={(e) => setSuppEmail(e.target.value)}
                        placeholder="Mail khôi phục..."
                        className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-[11px] font-mono"
                      />
                      <input
                        type="text"
                        value={suppEmailPass}
                        onChange={(e) => setSuppEmailPass(e.target.value)}
                        placeholder="Pass Mail..."
                        className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-[11px] font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 3: PHÂN BỔ NHÂN SỰ & GHI CHÚ BM */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] flex items-center justify-center font-bold">
                    3
                  </span>
                  <span>Phân Công Nhân Viên & Ghi Chú Lịch Sử Chuyển</span>
                </label>

                {/* Phân công nhân viên */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <span className="font-bold text-slate-700 block text-[11px] uppercase">
                    Nhân viên phụ trách sau khi chuyển:
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className="flex items-start space-x-2 bg-white p-2 rounded-lg border border-slate-200 cursor-pointer">
                      <input
                        type="radio"
                        name="staffAssignmentMode"
                        checked={staffAssignmentMode === 'target_via_owner'}
                        onChange={() => setStaffAssignmentMode('target_via_owner')}
                        className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold text-slate-900 block text-[11px]">
                          Theo chủ Via đích
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {resolvedTargetViaInfo?.staffName || '(Chưa có chủ)'}
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start space-x-2 bg-white p-2 rounded-lg border border-slate-200 cursor-pointer">
                      <input
                        type="radio"
                        name="staffAssignmentMode"
                        checked={staffAssignmentMode === 'keep_current'}
                        onChange={() => setStaffAssignmentMode('keep_current')}
                        className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold text-slate-900 block text-[11px]">
                          Giữ nhân viên cũ
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {pagesToTransfer[0]?.staffName || currentUser.name}
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start space-x-2 bg-white p-2 rounded-lg border border-slate-200 cursor-pointer">
                      <input
                        type="radio"
                        name="staffAssignmentMode"
                        checked={staffAssignmentMode === 'custom'}
                        onChange={() => setStaffAssignmentMode('custom')}
                        className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold text-slate-900 block text-[11px]">
                          Chỉ định người khác
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          Kho Chờ / NV khác
                        </span>
                      </div>
                    </label>
                  </div>

                  {staffAssignmentMode === 'custom' && (
                    <div className="pt-1">
                      <select
                        value={customStaffName}
                        onChange={(e) => setCustomStaffName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      >
                        <option value="">-- Chọn nơi nhận --</option>
                        {currentUser.role === 'admin' && (
                          <option value={ADMIN_WAITING_POOL}>
                            📦 {ADMIN_WAITING_POOL} (Chưa nhân viên nào dùng)
                          </option>
                        )}
                        {allStaffNames
                          .filter((n) => !isAdminWaitingPool(n))
                          .map((name) => (
                            <option key={name} value={name}>
                              👤 {name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Tùy chọn tự động thêm ghi chú lịch sử luân chuyển */}
                <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 text-xs space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={appendHistoryNote}
                      onChange={(e) => setAppendHistoryNote(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="font-bold text-indigo-950">
                      Lưu ghi chú lịch sử chuyển vào Cột Đổi Via
                    </span>
                  </label>

                  {appendHistoryNote && (
                    <input
                      type="text"
                      value={historyNoteText}
                      onChange={(e) => setHistoryNoteText(e.target.value)}
                      placeholder="Nội dung ghi chú chuyển..."
                      className="w-full px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500"
                    />
                  )}
                </div>
              </div>

              {/* STEP 4: TỔNG KẾT SO SÁNH TRƯỚC KHI CHUYỂN */}
              {resolvedTargetViaUid && pagesToTransfer.length > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-2">
                  <div className="flex items-center space-x-2 text-emerald-900 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Xem trước kết quả sau khi chuyển:</span>
                  </div>

                  <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-emerald-200/80">
                    <div className="text-left">
                      <span className="text-[10px] text-slate-400 block font-bold">TỪ VIA NGUỒN</span>
                      <span className="font-mono font-bold text-slate-800">
                        {pagesToTransfer[0]?.viaUid || 'Chưa có'}
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        NV: {pagesToTransfer[0]?.staffName}
                      </span>
                    </div>

                    <div className="flex flex-col items-center px-3">
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full mb-0.5">
                        {pagesToTransfer.length} Page
                      </span>
                      <ArrowRightLeft className="w-4 h-4 text-emerald-700" />
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-emerald-600 block font-bold">SANG VIA ĐÍCH</span>
                      <span className="font-mono font-extrabold text-indigo-900">
                        {resolvedTargetViaUid}
                      </span>
                      <span className="text-[11px] text-slate-700 font-semibold block">
                        NV: {resolvedTargetStaffName}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Error notice */}
          {errorMessage && (
            <div className="p-2.5 bg-rose-100 border border-rose-300 rounded-xl text-xs font-bold text-rose-800">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            Hủy Bỏ
          </button>

          {transferMode === 'staff_to_staff' ? (
            <button
              type="button"
              disabled={
                !sourceStaffForFullTransfer.trim() ||
                !resolvedFullTransferTargetStaff ||
                (!fullTransferIncludeVias &&
                  !fullTransferIncludeGroups &&
                  !fullTransferIncludePages) ||
                isSubmitting
              }
              onClick={handleExecuteTransfer}
              className="px-5 py-2.5 text-xs font-extrabold text-white bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-700 hover:to-indigo-700 rounded-xl shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang Bàn Giao Toàn Bộ Dữ Liệu...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>
                    🔄 Xác Nhận Chuyển Full (
                    {[
                      fullTransferIncludeVias ? `${sourceStaffDetails.vias.length} Via` : '',
                      fullTransferIncludeGroups ? `${sourceStaffDetails.groups.length} Group` : '',
                      fullTransferIncludePages ? `${sourceStaffDetails.pages.length} Page` : '',
                    ]
                      .filter(Boolean)
                      .join(' + ')}
                    ) Từ {sourceStaffForFullTransfer || '...'} ➔ {resolvedFullTransferTargetStaff || '...'}
                  </span>
                </>
              )}
            </button>
          ) : transferMode === 'via_to_staff' ? (
            <button
              type="button"
              disabled={
                selectedViaUidsForStaffTransfer.length === 0 ||
                !targetStaffForViaTransfer.trim() ||
                isSubmitting
              }
              onClick={handleExecuteTransfer}
              className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isTargetWaitingPool
                  ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang Chuyển Via & Page...</span>
                </>
              ) : isTargetWaitingPool ? (
                <>
                  <Archive className="w-3.5 h-3.5" />
                  <span>
                    📦 Đưa {selectedViaUidsForStaffTransfer.length} Via +{' '}
                    {pagesOfSelectedViasForStaffTransfer.length} Page Vào {ADMIN_WAITING_POOL}
                  </span>
                </>
              ) : (
                <>
                  <Users className="w-3.5 h-3.5" />
                  <span>
                    Xác Nhận Chuyển {selectedViaUidsForStaffTransfer.length} Via +{' '}
                    {pagesOfSelectedViasForStaffTransfer.length} Page Sang NV{' '}
                    {targetStaffForViaTransfer || '...'}
                  </span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled={pagesToTransfer.length === 0 || !resolvedTargetViaUid || isSubmitting}
              onClick={handleExecuteTransfer}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang Chuyển Dữ Liệu...</span>
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>
                    Xác Nhận Chuyển {pagesToTransfer.length} Page Qua Via {resolvedTargetViaUid || '...'}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
