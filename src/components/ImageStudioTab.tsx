import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  ImageTaskItem,
  AppUser,
  CollagePreset,
  CollageSlot,
  SlotTransform,
  TaskStatus,
} from '../types';
import {
  COLLAGE_PRESETS,
  COLLAGE_BACKGROUNDS,
  COLLAGE_RATIOS,
  SAMPLE_STUDIO_IMAGES,
  BackgroundPreset,
  RatioOption,
} from '../data/collageData';
import {
  Image,
  Sparkles,
  Layers,
  Sliders,
  Download,
  Copy,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  User,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Move,
  Type,
  Palette,
  LayoutGrid,
  Check,
  ArrowRight,
  ExternalLink,
  Calendar,
  X,
  FileSpreadsheet,
  Upload,
  Crop,
  Smartphone,
  Square,
  Monitor,
  Maximize2,
  Minimize2,
  Search,
  Filter,
  Globe,
  Link2,
  Wand2,
  Shuffle,
  Star,
  Settings2,
} from 'lucide-react';

interface ImageStudioTabProps {
  currentUser: AppUser;
  availableStaffNames: string[];
  tasks: ImageTaskItem[];
  onAddTask: (task: ImageTaskItem) => Promise<void> | void;
  onUpdateTask: (taskId: string, partial: Partial<ImageTaskItem>) => Promise<void> | void;
  onDeleteTask: (taskId: string) => Promise<void> | void;
  allPageNames?: string[];
  onNavigateToTab?: (tab: string) => void;
}

interface ExtractedWebImageItem {
  url: string;
  dataUrl: string;
  alt?: string;
  isFeatured?: boolean;
}

interface QuickWpArticleOption {
  id: number;
  title: string;
  link: string;
  employeeCode?: string;
}

interface CircleSlotOverride {
  dx: number;
  dy: number;
  sizeScale: number;
}

type CircleQuickSnapPos =
  | 'top_left'
  | 'top_right'
  | 'bottom_left'
  | 'bottom_right'
  | 'bottom_center'
  | 'center';

// Hàng 1: 8 mẫu ảnh cho bài viết (Kích thước ưu tiên mặc định: 3:4)
const AUTO_MULTI_FRAME_IDS: {
  presetId: string;
  ratioId: string;
  badge: string;
}[] = [
  {
    presetId: '2-circle-bottom-right',
    ratioId: '3:4',
    badge: '1 Nền + 1 Tròn Góc (Hot)',
  },
  {
    presetId: '3-circle-split-h-right',
    ratioId: '3:4',
    badge: '2 Ngang + 1 Tròn Phải',
  },
  {
    presetId: '3-circle-split-v',
    ratioId: '3:4',
    badge: '2 Cột + 1 Tròn Tâm PiP',
  },
  {
    presetId: '3-top-big',
    ratioId: '3:4',
    badge: '1 Banner Trên + 2 Ô Dưới',
  },
  {
    presetId: '4-grid-2x2',
    ratioId: '3:4',
    badge: 'Lưới 4 Ảnh (2x2)',
  },
  {
    presetId: '2-split-v',
    ratioId: '3:4',
    badge: '2 Cột Đôi Song Song',
  },
  {
    presetId: '2-split-h',
    ratioId: '3:4',
    badge: '2 Hàng Ngang (Trên - Dưới)',
  },
  {
    presetId: '4-circle-banner-trio',
    ratioId: '3:4',
    badge: 'Banner Trên + 2 Dưới + Tròn',
  },
];

// Hàng 2: 4 mẫu ảnh Story (Kích thước mặc định: 9:16)
const AUTO_STORY_FRAME_IDS: {
  presetId: string;
  ratioId: string;
  badge: string;
}[] = [
  {
    presetId: 'story-fb-before-after-classic',
    ratioId: '9:16',
    badge: 'Story FB: Before & After',
  },
  {
    presetId: 'story-fb-headline-now-then',
    ratioId: '9:16',
    badge: 'Story FB: Báo Chí Viral',
  },
  {
    presetId: 'story-fb-swipe-up-divider',
    ratioId: '9:16',
    badge: 'Story FB: Swipe Up 2 Ảnh',
  },
  {
    presetId: 'story-fb-circle-signature',
    ratioId: '9:16',
    badge: 'Story FB: Khung Dọc + Tròn',
  },
];

export function ImageStudioTab({
  currentUser,
  availableStaffNames,
  tasks,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  allPageNames = [],
  onNavigateToTab,
}: ImageStudioTabProps) {
  // Main view mode: Studio Ghép Ảnh vs Phân Chia Việc Làm Ảnh
  const [activeSubTab, setActiveSubTab] = useState<'studio' | 'tasks'>('studio');
  // Bộ lọc menu quy trình khoa học trong Xưởng Ghép Ảnh: Xem tất cả 3 bước hoặc tập trung từng bước
  const [studioSectionFilter, setStudioSectionFilter] = useState<
    'all' | 'step1_pool' | 'step2_auto' | 'step3_editor'
  >('all');
  // Menu tab cài đặt bên phải Bàn Chỉnh Sửa Lớn (mặc định mở Logo & Nhãn CTA để thấy ngay © CELEB24H.COM)
  const [editorSettingsTab, setEditorSettingsTab] = useState<'logo_cta' | 'ratio_border' | 'all'>(
    'logo_cta'
  );

  // Currently loaded task in Studio (if opened from a task)
  const [currentWorkingTask, setCurrentWorkingTask] = useState<ImageTaskItem | null>(null);

  // --- WEB LINK IMAGE EXTRACTION & CUSTOM REQUIREMENT STATE ---
  const [webArticleUrl, setWebArticleUrl] = useState<string>('');
  const [customRequirementText, setCustomRequirementText] = useState<string>('');
  const [selectedQuickRequirement, setSelectedQuickRequirement] = useState<
    'all_frames' | 'circle_pip' | 'story_fb' | 'feed_vertical' | '2_photos' | '3_photos' | '4_photos'
  >('all_frames');
  const [isExtractingWeb, setIsExtractingWeb] = useState<boolean>(false);
  const [webExtractError, setWebExtractError] = useState<string | null>(null);
  const [extractedArticleInfo, setExtractedArticleInfo] = useState<{
    title: string;
    sourceUrl: string;
    siteName: string;
    imageCount: number;
  } | null>(null);
  const [recentWpArticles, setRecentWpArticles] = useState<QuickWpArticleOption[]>([]);
  const [loadingWpArticles, setLoadingWpArticles] = useState<boolean>(false);
  const [showMultiFrameGallery, setShowMultiFrameGallery] = useState<boolean>(true);
  // Offset xoay vòng thứ tự ảnh cho từng khung trong bảng ghép đa khung
  const [multiFrameOffsets, setMultiFrameOffsets] = useState<Record<string, number>>({});
  // Chế độ phân bổ ảnh từ Kho Tự Ghép vào 8 khung bài viết & 4 khung Story
  const [poolDistributionMode, setPoolDistributionMode] = useState<
    'diverse_8_frames' | 'hero_lock_random' | 'same_set'
  >('diverse_8_frames');
  // Tổ hợp chỉ số ảnh riêng cho từng khung (khi bấm Tự Ghép Ngẫu Nhiên Phong Phú 8 Khung hoặc Đảo riêng từng khung)
  const [multiFrameCustomIndices, setMultiFrameCustomIndices] = useState<Record<string, number[]>>(
    {}
  );
  // Các ảnh trong Kho Tự Ghép tạm thời bỏ tích (không đưa vào đảo ngẫu nhiên)
  const [excludedPoolIndices, setExcludedPoolIndices] = useState<number[]>([]);
  // Mục Đảo Tổ Hợp Ảnh Ngẫu Nhiên Để Chọn & Tự Ghép ngay trong Kho Tự Ghép
  const [showRandomComboPicker, setShowRandomComboPicker] = useState<boolean>(true);
  const [randomComboPacks, setRandomComboPacks] = useState<number[][]>([]);
  const [activeSelectedComboIdx, setActiveSelectedComboIdx] = useState<number | null>(null);
  const [exportingPresetId, setExportingPresetId] = useState<string | null>(null);

  // --- HÀNG CHỜ ẢNH TƯƠNG TỰ TỰ ĐỘNG TÌM TỪ BÀI VIẾT ĐỂ CHỌN VÔ KHO TỰ GHÉP ---
  const [pendingSimilarImages, setPendingSimilarImages] = useState<
    { url: string; alt: string }[]
  >([]);
  const [rejectedSimilarUrls, setRejectedSimilarUrls] = useState<string[]>([]);
  const [isSearchingSimilar, setIsSearchingSimilar] = useState<boolean>(false);
  const [similarSearchQuery, setSimilarSearchQuery] = useState<string>('');
  const [similarSearchNotice, setSimilarSearchNotice] = useState<string | null>(null);
  const [extractedRawUrls, setExtractedRawUrls] = useState<string[]>([]);
  const [extractedArticleBodyText, setExtractedArticleBodyText] = useState<string>('');

  // --- HÀNG 1: 8 MẪU ẢNH CHO BÀI VIẾT (ƯU TIÊN MẶC ĐỊNH 3:4) ---
  const favStorageKey = `celeb24h_fav8_post_v2_${currentUser?.id || currentUser?.name || 'default'}`;
  const [favoritePresetIds, setFavoritePresetIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(favStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter((id: string) =>
            COLLAGE_PRESETS.some((p) => p.id === id)
          );
          if (valid.length === 8) return valid;
        }
      }
    } catch {
      // ignore storage errors
    }
    return AUTO_MULTI_FRAME_IDS.map((item) => item.presetId);
  });

  // --- HÀNG 2: 4 MẪU ẢNH STORY (MẶC ĐỊNH 9:16) ---
  const storyStorageKey = `celeb24h_fav4_story_v2_${currentUser?.id || currentUser?.name || 'default'}`;
  const [favoriteStoryPresetIds, setFavoriteStoryPresetIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storyStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter((id: string) =>
            COLLAGE_PRESETS.some((p) => p.id === id)
          );
          if (valid.length === 4) return valid;
        }
      }
    } catch {
      // ignore storage errors
    }
    return AUTO_STORY_FRAME_IDS.map((item) => item.presetId);
  });

  const [showFavoriteManager, setShowFavoriteManager] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem(favStorageKey, JSON.stringify(favoritePresetIds));
    } catch {
      // ignore storage errors
    }
  }, [favoritePresetIds, favStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storyStorageKey, JSON.stringify(favoriteStoryPresetIds));
    } catch {
      // ignore storage errors
    }
  }, [favoriteStoryPresetIds, storyStorageKey]);

  // Hàm bật/tắt 1 mẫu vào danh sách 8 mẫu bài viết hay dùng nhất
  const handleToggleFavoritePreset = useCallback((presetId: string) => {
    setFavoritePresetIds((prev) => {
      if (prev.includes(presetId)) {
        if (prev.length <= 1) {
          setExportNotice('Cần giữ ít nhất 1 mẫu trong danh sách mẫu hay dùng!');
          setTimeout(() => setExportNotice(null), 2500);
          return prev;
        }
        const presetObj = COLLAGE_PRESETS.find((p) => p.id === presetId);
        setExportNotice(`Đã bỏ "${presetObj?.name || presetId}" khỏi bộ 8 mẫu bài viết.`);
        setTimeout(() => setExportNotice(null), 2500);
        return prev.filter((id) => id !== presetId);
      } else {
        const presetObj = COLLAGE_PRESETS.find((p) => p.id === presetId);
        if (prev.length >= 8) {
          const next = [...prev.slice(0, 7), presetId];
          setExportNotice(
            `Đã ghim "${presetObj?.name || presetId}" vào vị trí #8 trong Hàng 1 (8 mẫu bài viết)!`
          );
          setTimeout(() => setExportNotice(null), 3000);
          return next;
        }
        const next = [...prev, presetId];
        setExportNotice(
          `Đã thêm "${presetObj?.name || presetId}" vào Hàng 1 (${next.length}/8 mẫu bài viết)!`
        );
        setTimeout(() => setExportNotice(null), 2500);
        return next;
      }
    });
  }, []);

  // Hàm đổi mẫu tại đúng 1 ô cụ thể (từ #1 đến #8) trong Hàng 1 (8 mẫu bài viết)
  const handleReplaceFavoriteSlot = useCallback((slotIndex: number, newPresetId: string) => {
    setFavoritePresetIds((prev) => {
      const next = [...prev];
      const existingIdx = next.indexOf(newPresetId);
      if (existingIdx !== -1 && existingIdx !== slotIndex) {
        const temp = next[slotIndex];
        next[slotIndex] = newPresetId;
        next[existingIdx] = temp;
      } else {
        next[slotIndex] = newPresetId;
      }
      return next.slice(0, 8);
    });
  }, []);

  // Hàm đổi mẫu tại đúng 1 ô cụ thể (từ Story #1 đến Story #4) trong Hàng 2 (4 mẫu Story)
  const handleReplaceStorySlot = useCallback((slotIndex: number, newPresetId: string) => {
    setFavoriteStoryPresetIds((prev) => {
      const next = [...prev];
      const existingIdx = next.indexOf(newPresetId);
      if (existingIdx !== -1 && existingIdx !== slotIndex) {
        const temp = next[slotIndex];
        next[slotIndex] = newPresetId;
        next[existingIdx] = temp;
      } else {
        next[slotIndex] = newPresetId;
      }
      return next.slice(0, 4);
    });
  }, []);

  const handleResetDefaultFavorites = useCallback(() => {
    setFavoritePresetIds(AUTO_MULTI_FRAME_IDS.map((item) => item.presetId));
    setFavoriteStoryPresetIds(AUTO_STORY_FRAME_IDS.map((item) => item.presetId));
    setExportNotice('Đã khôi phục mặc định: Hàng 1 (8 mẫu bài viết 3:4) & Hàng 2 (4 mẫu Story 9:16)!');
    setTimeout(() => setExportNotice(null), 2500);
  }, []);

  // --- STUDIO STATE ---
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>(SAMPLE_STUDIO_IMAGES);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('2-circle-bottom-right');
  const [selectedRatioId, setSelectedRatioId] = useState<string>('3:4');
  const [categoryFilter, setCategoryFilter] = useState<string>('favorites');

  // Spacing & Styling
  const [padding, setPadding] = useState<number>(10);
  const [gap, setGap] = useState<number>(8);
  const [borderRadius, setBorderRadius] = useState<number>(12);
  const [selectedBackground, setSelectedBackground] = useState<BackgroundPreset>(COLLAGE_BACKGROUNDS[0]);

  // Watermark & Copyright Embossed Logo
  const [showWatermark, setShowWatermark] = useState<boolean>(true);
  const [watermarkText, setWatermarkText] = useState<string>('© CELEB24H.COM');
  const [watermarkStyle, setWatermarkStyle] = useState<
    'embossed_logo' | 'glass_badge' | 'diagonal_stamp' | 'solid_banner'
  >('embossed_logo');
  const [watermarkPosition, setWatermarkPosition] = useState<
    'center' | 'bottom_right' | 'bottom_left' | 'bottom' | 'top' | 'top_right'
  >('center');
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(48);
  const [watermarkBgColor, setWatermarkBgColor] = useState<string>('#e11d48');
  const [watermarkTextColor, setWatermarkTextColor] = useState<string>('#FFFFFF');
  const [watermarkFontSize, setWatermarkFontSize] = useState<number>(30);

  // Nhãn Kêu Gọi Góc Cuối Ảnh Bên Phải ("Full Comments 👇")
  const [showCornerCta, setShowCornerCta] = useState<boolean>(true);
  const [cornerCtaText, setCornerCtaText] = useState<string>('Full Comments 👇');
  const [cornerCtaPosition, setCornerCtaPosition] = useState<
    'bottom_right' | 'bottom_center' | 'bottom_left'
  >('bottom_right');
  const [cornerCtaFontSize, setCornerCtaFontSize] = useState<number>(28);

  // --- PHẦN VIẾT CHỮ TIÊU ĐỀ Ở KHOẢNG TRẮNG PHÍA TRÊN CỦA MẪU STORY (S#2, S#3 & STORY HEADER) ---
  const [storyTopText, setStoryTopText] = useState<string>(
    'A Familiar TV Star Spotted In Throwback Photos — Can You Recognize Her Now?'
  );
  // Cho phép sửa riêng chữ từng khung Story nếu muốn (mặc định đồng bộ với storyTopText)
  const [perStoryCustomTopText, setPerStoryCustomTopText] = useState<Record<string, string>>({});
  // Màu nền & màu chữ phần tiêu đề phía trên Story
  const [storyTopTheme, setStoryTopTheme] = useState<
    'white_black' | 'white_red' | 'black_white' | 'black_yellow'
  >('white_black');
  const [storyTopFontScale, setStoryTopFontScale] = useState<number>(1);
  // Cho phép bật/tắt phần viết chữ phía trên trên từng khung Story ('on' | 'off')
  const [storyHeaderToggleMap, setStoryHeaderToggleMap] = useState<Record<string, 'on' | 'off'>>(
    {}
  );

  // Per-slot photo assignments and transform states
  const [slotAssignments, setSlotAssignments] = useState<Record<number, string>>({
    0: SAMPLE_STUDIO_IMAGES[0],
    1: SAMPLE_STUDIO_IMAGES[1],
  });
  const [slotTransforms, setSlotTransforms] = useState<Record<number, SlotTransform>>({});
  const [activeSlotId, setActiveSlotId] = useState<number | null>(null);

  // Export / copy status
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Dragging state for photo pan
  const [draggingSlot, setDraggingSlot] = useState<number | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);

  // --- DI CHUYỂN & THU PHÓNG KHUNG ẢNH TRÒN (PIP) TRÁNH CHE ẢNH NỀN ---
  // Lưu vị trí & kích thước vòng tròn cho từng khung trong Bộ Sưu Tập 2 Hàng (key: offsetKey)
  const [multiFrameCircleOverrides, setMultiFrameCircleOverrides] = useState<
    Record<string, CircleSlotOverride>
  >({});
  // Lưu vị trí & kích thước vòng tròn trên Bàn Chỉnh Sửa Lớn (key: slot.id)
  const [mainCircleOverrides, setMainCircleOverrides] = useState<
    Record<number, CircleSlotOverride>
  >({});
  // Chế độ kéo trên bàn chỉnh sửa lớn đối với ô tròn: 'move_circle' (di chuyển vị trí vòng tròn) hoặc 'pan_photo' (chỉnh tâm ảnh trong vòng tròn)
  const [circleDragMode, setCircleDragMode] = useState<'move_circle' | 'pan_photo'>('move_circle');
  const [activeCircleDragKey, setActiveCircleDragKey] = useState<string | null>(null);
  const circleDragRef = useRef<{
    targetType: 'gallery' | 'main';
    targetKey: string;
    slotId: number;
    startClientX: number;
    startClientY: number;
    startDx: number;
    startDy: number;
    sizeScale: number;
    containerWidth: number;
    containerHeight: number;
    moved: boolean;
  } | null>(null);
  const suppressNextCardClickRef = useRef<boolean>(false);

  // Modal create/edit task
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ImageTaskItem | null>(null);
  const [taskWebUrlInput, setTaskWebUrlInput] = useState<string>('');
  const [isExtractingForTask, setIsExtractingForTask] = useState<boolean>(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    pageName: '',
    assignedStaff: availableStaffNames[0] || currentUser.name,
    deadline: '',
    presetId: '2-circle-bottom-right',
    aspectRatio: '3:4',
    referenceNote: '',
    sampleImages: '' as string,
  });

  // Task filtering
  const [taskFilterStaff, setTaskFilterStaff] = useState<string>('ALL');
  const [taskFilterStatus, setTaskFilterStatus] = useState<string>('ALL');
  const [taskSearchQuery, setTaskSearchQuery] = useState<string>('');

  // Tải danh sách bài viết mới trên celeb24h.com để người dùng có thể chọn nhanh 1 chạm
  const fetchQuickWpPosts = useCallback(async () => {
    setLoadingWpArticles(true);
    try {
      const res = await fetch('/api/wp-publish');
      const data = await res.json();
      if (res.ok && data.ok && Array.isArray(data.posts)) {
        setRecentWpArticles(
          data.posts.slice(0, 15).map((p: any) => ({
            id: Number(p.id),
            title: String(p.title || ''),
            link: String(p.link || `https://celeb24h.com/${p.id}`),
            employeeCode: String(p.employeeCode || ''),
          }))
        );
      }
    } catch {
      // Ignore silent error
    } finally {
      setLoadingWpArticles(false);
    }
  }, []);

  useEffect(() => {
    fetchQuickWpPosts();
  }, [fetchQuickWpPosts]);

  // Selected preset object
  const activePreset: CollagePreset = useMemo(() => {
    return (
      COLLAGE_PRESETS.find((p) => p.id === selectedPresetId) ||
      COLLAGE_PRESETS[0]
    );
  }, [selectedPresetId]);

  // Selected ratio object
  const activeRatio: RatioOption = useMemo(() => {
    return (
      COLLAGE_RATIOS.find((r) => r.id === selectedRatioId) ||
      COLLAGE_RATIOS[0]
    );
  }, [selectedRatioId]);

  // Sync slots when preset changes (Ưu tiên mặc định 3:4 cho ảnh bài viết, 9:16 cho ảnh Story)
  useEffect(() => {
    if (activePreset) {
      if (activePreset.id.startsWith('story-fb') || activePreset.recommendedRatio === '9:16') {
        setSelectedRatioId('9:16');
      } else {
        setSelectedRatioId('3:4');
      }
      setSlotAssignments((prev) => {
        const next: Record<number, string> = {};
        activePreset.slots.forEach((slot, idx) => {
          if (prev[slot.id]) {
            next[slot.id] = prev[slot.id];
          } else if (uploadedPhotos[idx]) {
            next[slot.id] = uploadedPhotos[idx];
          } else {
            next[slot.id] = uploadedPhotos[idx % Math.max(1, uploadedPhotos.length)] || '';
          }
        });
        return next;
      });
    }
  }, [selectedPresetId, activePreset]);

  // Phân tích yêu cầu tùy chỉnh bằng chữ (Natural Language Requirement Parser)
  const applyCustomRequirementToStudio = useCallback(
    (reqText: string, photosToUse: string[], articleTitle?: string) => {
      const lower = reqText.trim().toLowerCase();
      const count = photosToUse.length;

      let chosenPresetId = selectedPresetId;
      let chosenRatioId = selectedRatioId;

      // 1. Theo nút chọn nhanh hoặc từ khóa trong yêu cầu
      if (
        lower.includes('story') ||
        lower.includes('9:16') ||
        selectedQuickRequirement === 'story_fb'
      ) {
        chosenPresetId =
          lower.includes('báo') || lower.includes('tiêu đề') || lower.includes('viral')
            ? 'story-fb-headline-now-then'
            : 'story-fb-before-after-classic';
        chosenRatioId = '9:16';
      } else if (
        lower.includes('tròn') ||
        lower.includes('pip') ||
        selectedQuickRequirement === 'circle_pip'
      ) {
        if (lower.includes('3 ảnh') || (count >= 3 && !lower.includes('2 ảnh'))) {
          chosenPresetId = lower.includes('cột') || lower.includes('tâm')
            ? '3-circle-split-v'
            : '3-circle-split-h-right';
          chosenRatioId = lower.includes('vuông') || lower.includes('1:1') ? '1:1' : '3:4';
        } else {
          chosenPresetId = lower.includes('tâm') || lower.includes('giữa')
            ? '2-circle-pip'
            : '2-circle-bottom-right';
          chosenRatioId = '3:4';
        }
      } else if (
        lower.includes('4 ảnh') ||
        lower.includes('lưới') ||
        lower.includes('2x2') ||
        selectedQuickRequirement === '4_photos'
      ) {
        chosenPresetId = '4-grid-2x2';
        chosenRatioId = lower.includes('4:5') || lower.includes('dọc') ? '4:5' : '1:1';
      } else if (lower.includes('3 ảnh') || selectedQuickRequirement === '3_photos') {
        chosenPresetId = lower.includes('tròn')
          ? '3-circle-split-h-right'
          : lower.includes('dọc') || lower.includes('cột')
          ? '3-left-big'
          : '3-top-big';
        chosenRatioId = '4:5';
      } else if (lower.includes('2 ảnh') || selectedQuickRequirement === '2_photos') {
        chosenPresetId = lower.includes('ngang') || lower.includes('trên dưới')
          ? '2-split-h'
          : lower.includes('tròn')
          ? '2-circle-bottom-right'
          : '2-split-v';
        chosenRatioId = '3:4';
      } else if (selectedQuickRequirement === 'feed_vertical') {
        chosenPresetId = count >= 3 ? '3-top-big' : '2-circle-bottom-right';
        chosenRatioId = '4:5';
      } else {
        // Mặc định thông minh theo số ảnh lấy được từ bài viết
        if (count >= 3) {
          chosenPresetId = '3-circle-split-h-right';
          chosenRatioId = '3:4';
        } else {
          chosenPresetId = '2-circle-bottom-right';
          chosenRatioId = '3:4';
        }
      }

      // 2. Kiểm tra tỷ lệ khung nếu người dùng ghi rõ trong yêu cầu
      if (lower.includes('1:1') || lower.includes('vuông')) chosenRatioId = '1:1';
      else if (lower.includes('4:5')) chosenRatioId = '4:5';
      else if (lower.includes('3:4')) chosenRatioId = '3:4';
      else if (lower.includes('9:16')) chosenRatioId = '9:16';
      else if (lower.includes('16:9') || lower.includes('ngang')) chosenRatioId = '16:9';

      // 3. Kiểm tra màu nền nếu người dùng yêu cầu
      if (lower.includes('nền đen') || lower.includes('viền đen')) {
        const darkBg = COLLAGE_BACKGROUNDS.find((b) => b.value === '#18181B');
        if (darkBg) setSelectedBackground(darkBg);
      } else if (lower.includes('nền trắng') || lower.includes('viền trắng')) {
        setSelectedBackground(COLLAGE_BACKGROUNDS[0]);
      } else if (lower.includes('nền hồng')) {
        const pinkBg = COLLAGE_BACKGROUNDS.find((b) => b.value === '#FEE2E2');
        if (pinkBg) setSelectedBackground(pinkBg);
      }

      // 4. Kiểm tra bo góc / không viền
      if (lower.includes('không viền') || lower.includes('sát nhau')) {
        setPadding(0);
        setGap(4);
      } else if (lower.includes('bo góc') || lower.includes('bo tròn')) {
        setBorderRadius(18);
      }

      // 5. Kiểm tra yêu cầu chữ / tiêu đề đóng dấu
      if (lower.includes('không chữ') || lower.includes('ẩn chữ') || lower.includes('tắt chữ')) {
        setShowWatermark(false);
      } else {
        const quoteMatch = reqText.match(/["“]([^"”]+)["”]/);
        if (quoteMatch && quoteMatch[1]) {
          setShowWatermark(true);
          setWatermarkText(quoteMatch[1].trim());
        } else if (lower.includes('lấy tiêu đề bài') && articleTitle) {
          setShowWatermark(true);
          setWatermarkText(articleTitle.slice(0, 48));
        }
      }

      setSelectedPresetId(chosenPresetId);
      setSelectedRatioId(chosenRatioId);

      // Gán ảnh vào các ô của preset đã chọn
      const targetPreset =
        COLLAGE_PRESETS.find((p) => p.id === chosenPresetId) || COLLAGE_PRESETS[0];
      const nextAssignments: Record<number, string> = {};
      targetPreset.slots.forEach((slot, idx) => {
        nextAssignments[slot.id] = photosToUse[idx % Math.max(1, photosToUse.length)] || '';
      });
      setSlotAssignments(nextAssignments);
      setSlotTransforms({});
    },
    [selectedPresetId, selectedRatioId, selectedQuickRequirement]
  );

  // Tự động hoặc chủ động tìm ảnh tương tự ngoài web đưa vào Hàng Chờ để người dùng chọn vô kho tự ghép
  const handleSearchSimilarImagesToQueue = async (options?: {
    titleOverride?: string;
    articleTextOverride?: string;
    sourceUrlOverride?: string;
    existingRawUrlsOverride?: string[];
    replaceQueue?: boolean;
    customQueryOverride?: string;
  }) => {
    const resolvedSourceUrl = (
      options?.sourceUrlOverride ??
      extractedArticleInfo?.sourceUrl ??
      webArticleUrl
    ).trim();
    const resolvedTitle = (
      options?.titleOverride ??
      extractedArticleInfo?.title ??
      ''
    ).trim();
    const resolvedBodyText = (
      options?.articleTextOverride ??
      extractedArticleBodyText ??
      ''
    ).trim();
    const resolvedQuery = (
      options?.customQueryOverride ??
      similarSearchQuery.trim() ??
      ''
    ).trim();

    if (!resolvedQuery && !resolvedTitle && !resolvedSourceUrl) {
      setSimilarSearchNotice(
        'Vui lòng dán Link bài viết hoặc nhập Tên nhân vật / Từ khóa để tìm ảnh tương tự vào hàng chờ!'
      );
      return;
    }

    setIsSearchingSimilar(true);
    setSimilarSearchNotice('⏳ Đang tự động tìm ảnh tương tự cùng nhân vật & bối cảnh vào hàng chờ...');
    try {
      const rawOrigUrls = options?.existingRawUrlsOverride ?? extractedRawUrls;
      const replaceQueue = options?.replaceQueue ?? false;

      const excludedList = [
        ...rawOrigUrls.map((u) => ({ url: u, isExternal: false })),
        ...uploadedPhotos
          .filter((u) => u.startsWith('http'))
          .map((u) => ({ url: u, isExternal: false })),
        ...(replaceQueue
          ? []
          : pendingSimilarImages.map((x) => ({ url: x.url, alt: x.alt, isExternal: true }))),
        ...rejectedSimilarUrls.map((u) => ({ url: u, isExternal: true })),
      ];

      const res = await fetch('/api/wp-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'search_external_images',
          forceExternalSearch: true,
          query: resolvedQuery || resolvedTitle || resolvedSourceUrl,
          sourceUrl: resolvedSourceUrl || undefined,
          title: resolvedTitle,
          articleText: resolvedBodyText.slice(0, 8000),
          existingImages: excludedList,
          limit: 8,
        }),
      });
      const rawText = await res.text();
      let data: any = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = null;
      }

      const rawExtList = Array.isArray(data?.externalImages)
        ? data.externalImages
        : Array.isArray(data?.images)
        ? data.images.filter((im: any) => im.isExternal !== false)
        : [];

      if (res.ok && data?.ok && rawExtList.length > 0) {
        if (data.primaryPerson && !similarSearchQuery.trim()) {
          setSimilarSearchQuery(String(data.primaryPerson));
        }

        const existingKeySet = new Set(
          [
            ...rawOrigUrls,
            ...uploadedPhotos.filter((u) => u.startsWith('http')),
            ...(replaceQueue ? [] : pendingSimilarImages.map((p) => p.url)),
          ].map((u) => u.split('?')[0].toLowerCase())
        );

        const freshItems: { url: string; alt: string }[] = [];
        for (const item of rawExtList) {
          const url = String(item?.url || '').trim();
          if (!url) continue;
          const key = url.split('?')[0].toLowerCase();
          if (existingKeySet.has(key)) continue;
          existingKeySet.add(key);
          freshItems.push({
            url,
            alt: String(item?.alt || data?.primaryPerson || resolvedTitle || 'Ảnh tương tự'),
          });
        }

        if (freshItems.length > 0) {
          if (replaceQueue) {
            setRejectedSimilarUrls((prev) => [
              ...Array.from(new Set([...prev, ...pendingSimilarImages.map((p) => p.url)])),
            ]);
            setPendingSimilarImages(freshItems);
          } else {
            setPendingSimilarImages((prev) => [...prev, ...freshItems]);
          }
          setSimilarSearchNotice(
            `✅ Đã tìm thấy ${freshItems.length} ảnh tương tự${
              data.primaryPerson ? ` (${data.primaryPerson})` : ''
            } vào hàng chờ! Bấm "+ Chọn vô kho" để đưa vào kho tự ghép.`
          );
        } else {
          setSimilarSearchNotice(
            'Đã lọc trùng với các ảnh hiện có. Hãy bấm "🔄 Đổi loạt khác" hoặc nhập thêm từ khóa cụ thể hơn!'
          );
        }
      } else {
        setSimilarSearchNotice(
          'Không tìm thấy thêm ảnh tương tự mới. Bạn có thể nhập tên nhân vật vào ô tìm kiếm bên dưới rồi bấm Tìm!'
        );
      }
    } catch {
      setSimilarSearchNotice('Lỗi kết nối khi tìm ảnh tương tự. Vui lòng thử lại!');
    } finally {
      setIsSearchingSimilar(false);
    }
  };

  // Chọn 1 ảnh từ Hàng Chờ Ảnh Tương Tự đưa vào Kho Ảnh Tự Ghép
  const handleSelectSimilarToPool = (
    item: { url: string; alt: string },
    putAtFront: boolean = false
  ) => {
    setUploadedPhotos((prev) => {
      const filtered = prev.filter((p) => p !== item.url);
      const nextPool = putAtFront ? [item.url, ...filtered] : [...filtered, item.url];
      setSlotAssignments((oldSlots) => {
        const nextSlots = { ...oldSlots };
        if (putAtFront) {
          activePreset.slots.forEach((slot, idx) => {
            nextSlots[slot.id] = nextPool[idx % Math.max(1, nextPool.length)] || '';
          });
        } else {
          activePreset.slots.forEach((slot, idx) => {
            if (!nextSlots[slot.id]) {
              nextSlots[slot.id] = nextPool[idx % Math.max(1, nextPool.length)] || '';
            }
          });
        }
        return nextSlots;
      });
      return nextPool;
    });
    setPendingSimilarImages((prev) => prev.filter((x) => x.url !== item.url));
    setShowMultiFrameGallery(true);
    setExportNotice(
      putAtFront
        ? 'Đã đưa ảnh tương tự lên vị trí #1 trong Kho Tự Ghép và cập nhật tất cả khung!'
        : 'Đã thêm ảnh tương tự vào Kho Tự Ghép!'
    );
    setTimeout(() => setExportNotice(null), 3000);
  };

  // Chọn toàn bộ ảnh trong Hàng Chờ đưa vào Kho Ảnh Tự Ghép
  const handleSelectAllSimilarToPool = () => {
    if (pendingSimilarImages.length === 0) return;
    const urlsToAdd = pendingSimilarImages.map((x) => x.url);
    setUploadedPhotos((prev) => {
      const existing = new Set(prev);
      const combined = [...prev, ...urlsToAdd.filter((u) => !existing.has(u))];
      setSlotAssignments((oldSlots) => {
        const nextSlots = { ...oldSlots };
        activePreset.slots.forEach((slot, idx) => {
          if (!nextSlots[slot.id] && combined[idx]) {
            nextSlots[slot.id] = combined[idx];
          }
        });
        return nextSlots;
      });
      return combined;
    });
    setPendingSimilarImages([]);
    setShowMultiFrameGallery(true);
    setExportNotice(`Đã đưa toàn bộ ${urlsToAdd.length} ảnh tương tự vào Kho Tự Ghép!`);
    setTimeout(() => setExportNotice(null), 3500);
  };

  // Hàm trích xuất toàn bộ ảnh từ Link Web, tự động ghép khung VÀ tự động tìm ảnh tương tự vào hàng chờ
  const handleExtractImagesFromWebLink = async (overrideUrl?: string) => {
    const targetUrl = (overrideUrl ?? webArticleUrl).trim();
    if (!targetUrl) {
      setWebExtractError('Vui lòng dán đường dẫn (link) bài viết web cần lấy ảnh!');
      return;
    }

    setIsExtractingWeb(true);
    setWebExtractError(null);
    try {
      const res = await fetch('/api/extract-web-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });
      const rawText = await res.text();
      let data: any = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        throw new Error(
          'Máy chủ phản hồi quá thời gian hoặc đường dẫn chặn truy cập. Vui lòng thử lại!'
        );
      }
      if (!res.ok || !data?.ok || !Array.isArray(data.images) || data.images.length === 0) {
        throw new Error(data?.error || 'Không tìm thấy ảnh nào trong đường dẫn này!');
      }

      const extractedPhotos: string[] = data.images.map(
        (img: ExtractedWebImageItem) => img.dataUrl || img.url
      );
      const rawUrls: string[] = data.images
        .map((img: ExtractedWebImageItem) => img.url)
        .filter(Boolean);

      setUploadedPhotos(extractedPhotos);
      setExtractedRawUrls(rawUrls);
      setExtractedArticleBodyText(String(data.articleText || data.excerpt || ''));
      setExtractedArticleInfo({
        title: data.title || 'Bài viết Web',
        sourceUrl: data.sourceUrl || targetUrl,
        siteName: data.siteName || 'Website',
        imageCount: extractedPhotos.length,
      });
      if (data.title && String(data.title).trim()) {
        setStoryTopText(String(data.title).trim());
        setPerStoryCustomTopText({});
      }
      setShowMultiFrameGallery(true);
      setMultiFrameOffsets({});

      // Tự động áp dụng yêu cầu khung ghép của người dùng
      applyCustomRequirementToStudio(customRequirementText, extractedPhotos, data.title);

      setExportNotice(
        `Đã tự động lấy ${extractedPhotos.length} ảnh từ bài "${(data.title || '').slice(0, 45)}..." vào Kho Tự Ghép & đang tìm thêm ảnh tương tự vào hàng chờ!`
      );
      setTimeout(() => setExportNotice(null), 5000);

      // Tự động tìm luôn ảnh tương tự ngoài web đưa vào Hàng Chờ để người dùng chọn thêm vào kho
      void handleSearchSimilarImagesToQueue({
        titleOverride: data.title || '',
        articleTextOverride: String(data.articleText || data.excerpt || ''),
        sourceUrlOverride: data.sourceUrl || targetUrl,
        existingRawUrlsOverride: rawUrls,
        replaceQueue: true,
        customQueryOverride: '',
      });
    } catch (err: any) {
      setWebExtractError(err?.message || 'Lỗi khi lấy ảnh từ link bài viết web');
    } finally {
      setIsExtractingWeb(false);
    }
  };

  // Tự động nhận Link bài viết vừa đẩy từ Tab Viết Bài Web chuyển sang (nếu có)
  useEffect(() => {
    try {
      const pendingUrl = localStorage.getItem('celeb24h_pending_collage_url');
      if (pendingUrl && pendingUrl.trim()) {
        localStorage.removeItem('celeb24h_pending_collage_url');
        const clean = pendingUrl.trim();
        setWebArticleUrl(clean);
        setActiveSubTab('studio');
        setStudioSectionFilter('all');
        void handleExtractImagesFromWebLink(clean);
      }
    } catch {
      // ignore storage errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Xoay vòng (Đảo) thứ tự ảnh đang ghép trong khung chính
  const handleShuffleMainSlots = () => {
    if (uploadedPhotos.length === 0) return;
    setSlotAssignments((prev) => {
      const currentFirst = prev[0];
      const startIndex = Math.max(0, uploadedPhotos.indexOf(currentFirst)) + 1;
      const next: Record<number, string> = {};
      activePreset.slots.forEach((slot, idx) => {
        next[slot.id] = uploadedPhotos[(startIndex + idx) % uploadedPhotos.length];
      });
      return next;
    });
  };

  // Paste image directly from clipboard (Ctrl+V) anywhere in window
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const result = event.target?.result as string;
              if (result) {
                setUploadedPhotos((prev) => [result, ...prev]);
                if (activeSlotId !== null) {
                  setSlotAssignments((prev) => ({ ...prev, [activeSlotId]: result }));
                }
                setExportNotice('Đã dán ảnh từ Clipboard thành công!');
                setTimeout(() => setExportNotice(null), 3000);
              }
            };
            reader.readAsDataURL(file);
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeSlotId]);

  // File Upload handler (hỗ trợ cả thêm vào kho hoặc thay mới toàn bộ kho ảnh tự ghép)
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    mode: 'append' | 'replace' = 'append'
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newPhotos: string[] = [];
    let loaded = 0;
    const totalFiles = files.length;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) newPhotos.push(result);
        loaded++;
        if (loaded === totalFiles) {
          setUploadedPhotos((prev) => {
            const combined = mode === 'replace' ? [...newPhotos] : [...newPhotos, ...prev];
            setSlotAssignments((oldSlots) => {
              const next = { ...oldSlots };
              activePreset.slots.forEach((slot, idx) => {
                if (newPhotos[idx]) {
                  next[slot.id] = newPhotos[idx];
                } else if (mode === 'replace' || !next[slot.id]) {
                  next[slot.id] = combined[idx % Math.max(1, combined.length)] || '';
                }
              });
              return next;
            });
            return combined;
          });
          setShowMultiFrameGallery(true);
          setMultiFrameOffsets({});
          setExportNotice(
            mode === 'replace'
              ? `Đã thay mới Kho Tự Ghép bằng ${newPhotos.length} ảnh tải lên từ máy!`
              : `Đã tải thêm ${newPhotos.length} ảnh từ máy lên Kho Tự Ghép!`
          );
          setTimeout(() => setExportNotice(null), 3500);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  // Helper for slot transform
  const getSlotTransform = (slotId: number): SlotTransform => {
    return (
      slotTransforms[slotId] || {
        scale: 1,
        panX: 0,
        panY: 0,
        rotate: 0,
      }
    );
  };

  const updateSlotTransform = (slotId: number, partial: Partial<SlotTransform>) => {
    setSlotTransforms((prev) => ({
      ...prev,
      [slotId]: {
        ...getSlotTransform(slotId),
        ...partial,
      },
    }));
  };

  // Tính toán tọa độ & kích thước thực tế của từng ô (đặc biệt hỗ trợ di chuyển & thu phóng ô ảnh tròn khỏi che ảnh nền)
  const getEffectiveSlotBounds = useCallback(
    (
      slot: CollageSlot,
      ratioAspect: number,
      override?: CircleSlotOverride
    ): { x: number; y: number; width: number; height: number } => {
      if (slot.shape !== 'circle') {
        return {
          x: slot.x,
          y: slot.y,
          width: slot.width,
          height: slot.height,
        };
      }
      const scale = override?.sizeScale ?? 1;
      const dx = override?.dx ?? 0;
      const dy = override?.dy ?? 0;

      // Chuẩn hóa chiều cao theo tỷ lệ khung để vòng tròn luôn tròn đều cả ở 3:4, 9:16 và 1:1
      const safeAspect = ratioAspect > 0 ? ratioAspect : 0.75;
      const baseW = slot.width;
      const baseH = slot.width * safeAspect;

      const origCenterX = slot.x + slot.width / 2;
      const origCenterY = slot.y + slot.height / 2;

      const width = Math.max(14, Math.min(85, baseW * scale));
      const height = Math.max(10, Math.min(85, baseH * scale));

      const rawX = origCenterX - width / 2 + dx;
      const rawY = origCenterY - height / 2 + dy;

      const x = Math.max(1, Math.min(99 - width, rawX));
      const y = Math.max(1, Math.min(99 - height, rawY));

      return { x, y, width, height };
    },
    []
  );

  // Tính toán nhanh dx, dy để nhảy vòng tròn tới các góc tránh che mặt nhân vật
  const computeSnapCircleOverride = useCallback(
    (
      slot: CollageSlot,
      ratioAspect: number,
      snapPos: CircleQuickSnapPos,
      currentScale = 1
    ): CircleSlotOverride => {
      const safeAspect = ratioAspect > 0 ? ratioAspect : 0.75;
      const width = Math.max(14, Math.min(85, slot.width * currentScale));
      const height = Math.max(10, Math.min(85, slot.width * safeAspect * currentScale));
      const origCenterX = slot.x + slot.width / 2;
      const origCenterY = slot.y + slot.height / 2;

      let targetX = slot.x;
      let targetY = slot.y;
      const margin = 3;

      if (snapPos === 'top_left') {
        targetX = margin;
        targetY = margin;
      } else if (snapPos === 'top_right') {
        targetX = 100 - width - margin;
        targetY = margin;
      } else if (snapPos === 'bottom_left') {
        targetX = margin;
        targetY = 96 - height;
      } else if (snapPos === 'bottom_right') {
        targetX = 100 - width - margin;
        targetY = 90 - height; // Chừa chỗ cho nhãn Full Comments 👇 ở góc dưới phải
      } else if (snapPos === 'bottom_center') {
        targetX = 50 - width / 2;
        targetY = 95 - height;
      } else if (snapPos === 'center') {
        targetX = 50 - width / 2;
        targetY = 50 - height / 2;
      }

      const targetCenterX = targetX + width / 2;
      const targetCenterY = targetY + height / 2;

      return {
        dx: targetCenterX - origCenterX,
        dy: targetCenterY - origCenterY,
        sizeScale: currentScale,
      };
    },
    []
  );

  // Lắng nghe kéo chuột toàn cục để di chuyển vòng tròn mượt mà trong cả ô nhỏ lẫn khung lớn
  useEffect(() => {
    const handleWindowMouseMove = (ev: MouseEvent) => {
      const drag = circleDragRef.current;
      if (!drag) return;

      const deltaPxX = ev.clientX - drag.startClientX;
      const deltaPxY = ev.clientY - drag.startClientY;
      if (Math.abs(deltaPxX) > 2 || Math.abs(deltaPxY) > 2) {
        drag.moved = true;
      }

      const deltaPercentX = (deltaPxX / Math.max(1, drag.containerWidth)) * 100;
      const deltaPercentY = (deltaPxY / Math.max(1, drag.containerHeight)) * 100;

      const nextOverride: CircleSlotOverride = {
        dx: drag.startDx + deltaPercentX,
        dy: drag.startDy + deltaPercentY,
        sizeScale: drag.sizeScale,
      };

      if (drag.targetType === 'gallery') {
        setMultiFrameCircleOverrides((prev) => ({
          ...prev,
          [drag.targetKey]: nextOverride,
        }));
      } else {
        setMainCircleOverrides((prev) => ({
          ...prev,
          [drag.slotId]: nextOverride,
        }));
      }
    };

    const handleWindowMouseUp = () => {
      if (circleDragRef.current) {
        if (circleDragRef.current.moved) {
          suppressNextCardClickRef.current = true;
          setTimeout(() => {
            suppressNextCardClickRef.current = false;
          }, 120);
        }
        circleDragRef.current = null;
        setActiveCircleDragKey(null);
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, []);

  const handleStartGalleryCircleDrag = (
    e: React.MouseEvent<HTMLDivElement>,
    offsetKey: string,
    slotId: number
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const containerEl = e.currentTarget.parentElement;
    if (!containerEl) return;
    const rect = containerEl.getBoundingClientRect();
    const current = multiFrameCircleOverrides[offsetKey] || { dx: 0, dy: 0, sizeScale: 1 };
    circleDragRef.current = {
      targetType: 'gallery',
      targetKey: offsetKey,
      slotId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startDx: current.dx,
      startDy: current.dy,
      sizeScale: current.sizeScale,
      containerWidth: rect.width,
      containerHeight: rect.height,
      moved: false,
    };
    setActiveCircleDragKey(offsetKey);
  };

  const handleStartMainCircleDrag = (
    e: React.MouseEvent<HTMLDivElement>,
    slotId: number
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const containerEl = e.currentTarget.parentElement;
    if (!containerEl) return;
    const rect = containerEl.getBoundingClientRect();
    const current = mainCircleOverrides[slotId] || { dx: 0, dy: 0, sizeScale: 1 };
    circleDragRef.current = {
      targetType: 'main',
      targetKey: `main-${slotId}`,
      slotId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startDx: current.dx,
      startDy: current.dy,
      sizeScale: current.sizeScale,
      containerWidth: rect.width,
      containerHeight: rect.height,
      moved: false,
    };
    setActiveCircleDragKey(`main-${slotId}`);
  };

  // Áp dụng vị trí nhanh cho tất cả các khung có ảnh tròn trong Bộ Sưu Tập 2 Hàng
  const handleApplyGlobalCircleSnap = (snapPos: CircleQuickSnapPos | 'reset' | 'smaller' | 'larger') => {
    setMultiFrameCircleOverrides((prev) => {
      const next: Record<string, CircleSlotOverride> = { ...prev };
      const applyToList = (
        list: { preset: CollagePreset; ratio: RatioOption }[],
        prefix: 'post' | 'story'
      ) => {
        list.forEach((item, idx) => {
          const circleSlot = item.preset.slots.find((s) => s.shape === 'circle');
          if (!circleSlot) return;
          const key = `${prefix}-${idx}-${item.preset.id}`;
          const cur = prev[key] || { dx: 0, dy: 0, sizeScale: 1 };
          if (snapPos === 'reset') {
            delete next[key];
          } else if (snapPos === 'smaller') {
            next[key] = { ...cur, sizeScale: Math.max(0.55, Number((cur.sizeScale - 0.1).toFixed(2))) };
          } else if (snapPos === 'larger') {
            next[key] = { ...cur, sizeScale: Math.min(1.35, Number((cur.sizeScale + 0.1).toFixed(2))) };
          } else {
            next[key] = computeSnapCircleOverride(
              circleSlot,
              item.ratio.exportWidth / item.ratio.exportHeight,
              snapPos,
              cur.sizeScale
            );
          }
        });
      };
      applyToList(multiFrameVariations, 'post');
      applyToList(storyFrameVariations, 'story');
      return next;
    });

    // Đồng bộ luôn với khung chính nếu đang chọn mẫu có ảnh tròn
    const mainCircleSlot = activePreset.slots.find((s) => s.shape === 'circle');
    if (mainCircleSlot) {
      setMainCircleOverrides((prev) => {
        const cur = prev[mainCircleSlot.id] || { dx: 0, dy: 0, sizeScale: 1 };
        if (snapPos === 'reset') {
          const copy = { ...prev };
          delete copy[mainCircleSlot.id];
          return copy;
        }
        if (snapPos === 'smaller') {
          return {
            ...prev,
            [mainCircleSlot.id]: {
              ...cur,
              sizeScale: Math.max(0.55, Number((cur.sizeScale - 0.1).toFixed(2))),
            },
          };
        }
        if (snapPos === 'larger') {
          return {
            ...prev,
            [mainCircleSlot.id]: {
              ...cur,
              sizeScale: Math.min(1.35, Number((cur.sizeScale + 0.1).toFixed(2))),
            },
          };
        }
        return {
          ...prev,
          [mainCircleSlot.id]: computeSnapCircleOverride(
            mainCircleSlot,
            activeRatio.exportWidth / activeRatio.exportHeight,
            snapPos,
            cur.sizeScale
          ),
        };
      });
    }
  };

  // Filtered preset list by category
  const filteredPresets = useMemo(() => {
    if (categoryFilter === 'favorites') {
      return favoritePresetIds
        .map((id) => COLLAGE_PRESETS.find((p) => p.id === id))
        .filter((p): p is CollagePreset => Boolean(p));
    }
    if (categoryFilter === 'all') return COLLAGE_PRESETS;
    if (categoryFilter === 'story') return COLLAGE_PRESETS.filter((p) => p.id.startsWith('story-fb'));
    if (categoryFilter === '2-photo') return COLLAGE_PRESETS.filter((p) => p.photoCount === 2);
    if (categoryFilter === '3-photo') return COLLAGE_PRESETS.filter((p) => p.photoCount === 3);
    if (categoryFilter === '4-photo') return COLLAGE_PRESETS.filter((p) => p.photoCount === 4);
    if (categoryFilter === 'circle') return COLLAGE_PRESETS.filter((p) => p.hasCircleAccent);
    return COLLAGE_PRESETS.filter((p) => p.category === categoryFilter);
  }, [categoryFilter, favoritePresetIds]);

  // HÀNG 1: Danh sách 8 mẫu ảnh cho bài viết (Kích thước ưu tiên mặc định: 3:4)
  const multiFrameVariations = useMemo(() => {
    const ratio34 = COLLAGE_RATIOS.find((r) => r.id === '3:4') || COLLAGE_RATIOS[3];
    const ratio45 = COLLAGE_RATIOS.find((r) => r.id === '4:5') || COLLAGE_RATIOS[1];

    let baseList = favoritePresetIds.slice(0, 8).map((presetId, idx) => {
      const preset = COLLAGE_PRESETS.find((p) => p.id === presetId) || COLLAGE_PRESETS[0];
      const defaultMeta = AUTO_MULTI_FRAME_IDS.find((m) => m.presetId === preset.id);
      return {
        slotIdx: idx,
        presetId: preset.id,
        ratioId: '3:4',
        badge: defaultMeta?.badge || preset.name,
        preset,
        ratio: ratio34,
      };
    });

    if (selectedQuickRequirement === 'circle_pip') {
      const circlePresets = COLLAGE_PRESETS.filter(
        (p) => p.hasCircleAccent && !p.id.startsWith('story-fb')
      ).slice(0, 8);
      baseList = circlePresets.map((preset, idx) => ({
        slotIdx: idx,
        presetId: preset.id,
        ratioId: '3:4',
        badge: preset.name,
        preset,
        ratio: ratio34,
      }));
    } else if (selectedQuickRequirement === '2_photos') {
      const p2 = COLLAGE_PRESETS.filter(
        (p) => p.photoCount === 2 && !p.id.startsWith('story-fb')
      ).slice(0, 8);
      baseList = p2.map((preset, idx) => ({
        slotIdx: idx,
        presetId: preset.id,
        ratioId: '3:4',
        badge: preset.name,
        preset,
        ratio: ratio34,
      }));
    } else if (selectedQuickRequirement === '3_photos') {
      const p3 = COLLAGE_PRESETS.filter(
        (p) => p.photoCount === 3 && !p.id.startsWith('story-fb')
      ).slice(0, 8);
      baseList = p3.map((preset, idx) => ({
        slotIdx: idx,
        presetId: preset.id,
        ratioId: '3:4',
        badge: preset.name,
        preset,
        ratio: ratio34,
      }));
    } else if (selectedQuickRequirement === '4_photos') {
      const p4 = COLLAGE_PRESETS.filter(
        (p) => p.photoCount === 4 && !p.id.startsWith('story-fb')
      ).slice(0, 8);
      baseList = p4.map((preset, idx) => ({
        slotIdx: idx,
        presetId: preset.id,
        ratioId: '3:4',
        badge: preset.name,
        preset,
        ratio: ratio34,
      }));
    } else if (selectedQuickRequirement === 'feed_vertical') {
      baseList = baseList.map((item) => ({
        ...item,
        ratioId: '4:5',
        ratio: ratio45,
      }));
    }

    return baseList;
  }, [selectedQuickRequirement, favoritePresetIds]);

  // HÀNG 2: Danh sách 4 mẫu ảnh Story (Kích thước mặc định: 9:16)
  const storyFrameVariations = useMemo(() => {
    const ratio916 = COLLAGE_RATIOS.find((r) => r.id === '9:16') || COLLAGE_RATIOS[2];
    return favoriteStoryPresetIds.slice(0, 4).map((presetId, idx) => {
      const preset =
        COLLAGE_PRESETS.find((p) => p.id === presetId) ||
        COLLAGE_PRESETS.find((p) => p.id.startsWith('story-fb')) ||
        COLLAGE_PRESETS[0];
      const defaultMeta = AUTO_STORY_FRAME_IDS.find((m) => m.presetId === preset.id);
      return {
        slotIdx: idx,
        presetId: preset.id,
        ratioId: '9:16',
        badge: defaultMeta?.badge || preset.name,
        preset,
        ratio: ratio916,
      };
    });
  }, [favoriteStoryPresetIds]);

  // Danh sách chỉ số ảnh đang được bật chọn trong Kho Tự Ghép
  const activePoolPhotoIndices = useMemo(() => {
    const total = uploadedPhotos.length;
    if (total === 0) return [];
    const excludedSet = new Set(excludedPoolIndices);
    const filtered = Array.from({ length: total }, (_, i) => i).filter((i) => !excludedSet.has(i));
    return filtered.length > 0 ? filtered : Array.from({ length: total }, (_, i) => i);
  }, [uploadedPhotos.length, excludedPoolIndices]);

  // Hàm rút ngẫu nhiên k chỉ số ảnh không trùng nhau từ Kho Tự Ghép
  const pickRandomDistinctIndices = useCallback(
    (countNeeded: number, lockFirstIndex?: number, avoidFirstSet?: Set<number>): number[] => {
      const pool = activePoolPhotoIndices;
      if (pool.length === 0) return [0];
      const result: number[] = [];

      if (typeof lockFirstIndex === 'number' && lockFirstIndex >= 0 && lockFirstIndex < uploadedPhotos.length) {
        result.push(lockFirstIndex);
      }

      const candidates = pool.filter((idx) => !result.includes(idx));
      // Shuffle candidates using Fisher-Yates
      const shuffled = [...candidates];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = tmp;
      }

      // Ưu tiên ảnh đầu chưa bị trùng với khung trước đó để 8 khung phong phú nhất
      if (result.length === 0 && avoidFirstSet && shuffled.length > 1) {
        const nonUsedPos = shuffled.findIndex((idx) => !avoidFirstSet.has(idx));
        if (nonUsedPos > 0) {
          const picked = shuffled[nonUsedPos];
          shuffled.splice(nonUsedPos, 1);
          shuffled.unshift(picked);
        }
      }

      for (const idx of shuffled) {
        if (result.length >= countNeeded) break;
        result.push(idx);
      }

      while (result.length < countNeeded) {
        result.push(pool[result.length % pool.length]);
      }

      return result;
    },
    [activePoolPhotoIndices, uploadedPhotos.length]
  );

  // Tự động sinh 8 Bộ Tổ Hợp Ảnh Ngẫu Nhiên (Combo #1 -> #8) mỗi khi Kho Tự Ghép thay đổi
  const generateFreshRandomComboPacks = useCallback(
    (keepHeroFirst = false, autoApplyTo8Frames = false) => {
      const pool = activePoolPhotoIndices;
      if (pool.length === 0) {
        setRandomComboPacks([]);
        return;
      }
      const usedFirstSet = new Set<number>();
      const packs: number[][] = [];
      for (let i = 0; i < 8; i++) {
        if (usedFirstSet.size >= pool.length) usedFirstSet.clear();
        const combo = pickRandomDistinctIndices(
          Math.min(4, Math.max(2, pool.length)),
          keepHeroFirst ? pool[0] : undefined,
          usedFirstSet
        );
        usedFirstSet.add(combo[0]);
        packs.push(combo);
      }
      setRandomComboPacks(packs);
      setActiveSelectedComboIdx(null);

      if (autoApplyTo8Frames) {
        const nextCustom: Record<string, number[]> = {};
        multiFrameVariations.forEach((v, idx) => {
          const key = `post-${idx}-${v.preset.id}`;
          nextCustom[key] = packs[idx % packs.length];
        });
        storyFrameVariations.forEach((v, idx) => {
          const key = `story-${idx}-${v.preset.id}`;
          nextCustom[key] = pickRandomDistinctIndices(
            Math.max(2, v.preset.slots.length),
            keepHeroFirst ? pool[0] : undefined
          );
        });
        setMultiFrameCustomIndices(nextCustom);
        setMultiFrameOffsets({});
      }
    },
    [activePoolPhotoIndices, multiFrameVariations, storyFrameVariations, pickRandomDistinctIndices]
  );

  // Khi số lượng ảnh trong Kho Tự Ghép thay đổi, tự động tạo mới 8 Bộ Tổ Hợp Ngẫu Nhiên
  useEffect(() => {
    setExcludedPoolIndices((prev) => prev.filter((i) => i < uploadedPhotos.length));
    if (uploadedPhotos.length > 0) {
      generateFreshRandomComboPacks(
        poolDistributionMode === 'hero_lock_random',
        poolDistributionMode !== 'same_set' && uploadedPhotos.length >= 3
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedPhotos.length]);

  // Đảo ngẫu nhiên phong phú toàn bộ 8 khung bài viết & 4 khung Story (mỗi khung 1 bộ ảnh khác nhau từ kho)
  const handleRandomizeAll8FramesRichly = useCallback(
    (modeOverride?: 'diverse_8_frames' | 'hero_lock_random' | 'same_set') => {
      const targetMode = modeOverride || poolDistributionMode;
      if (modeOverride) setPoolDistributionMode(modeOverride);

      if (targetMode === 'same_set') {
        // Đảo chọn 1 bộ ngẫu nhiên rồi áp đồng loạt cho cả 8 khung để so sánh mẫu
        const sharedCombo = pickRandomDistinctIndices(4);
        const nextCustom: Record<string, number[]> = {};
        multiFrameVariations.forEach((v, idx) => {
          nextCustom[`post-${idx}-${v.preset.id}`] = sharedCombo;
        });
        storyFrameVariations.forEach((v, idx) => {
          nextCustom[`story-${idx}-${v.preset.id}`] = sharedCombo;
        });
        setMultiFrameCustomIndices(nextCustom);
        setMultiFrameOffsets({});
        setExportNotice(
          `Đã đảo bộ ảnh chung (${sharedCombo.map((i) => `#${i + 1}`).join(', ')}) cho toàn bộ 8 khung để so sánh bố cục!`
        );
        setTimeout(() => setExportNotice(null), 3000);
        return;
      }

      const keepHero = targetMode === 'hero_lock_random';
      generateFreshRandomComboPacks(keepHero, true);
      setExportNotice(
        keepHero
          ? `📌 Đã giữ ảnh #${(activePoolPhotoIndices[0] ?? 0) + 1} làm ảnh chính và đảo ngẫu nhiên các ảnh phụ khác nhau cho 8 khung!`
          : `🎲 Đã đảo & tự ghép ngẫu nhiên 8 tổ hợp ảnh phong phú từ Kho (${activePoolPhotoIndices.length} ảnh) vào 8 khung bài viết & 4 khung Story!`
      );
      setTimeout(() => setExportNotice(null), 3500);
    },
    [
      poolDistributionMode,
      pickRandomDistinctIndices,
      multiFrameVariations,
      storyFrameVariations,
      generateFreshRandomComboPacks,
      activePoolPhotoIndices,
    ]
  );

  // Đảo ngẫu nhiên riêng 1 khung bất kỳ (lấy tổ hợp ảnh mới từ toàn bộ Kho Tự Ghép)
  const handleRandomizeSingleFrame = useCallback(
    (offsetKey: string, slotCount: number) => {
      const keepHero = poolDistributionMode === 'hero_lock_random';
      const currentCombo = multiFrameCustomIndices[offsetKey] || [];
      const avoidFirst = new Set<number>(currentCombo.length > 0 ? [currentCombo[0]] : []);
      const freshCombo = pickRandomDistinctIndices(
        Math.max(4, slotCount),
        keepHero ? activePoolPhotoIndices[0] : undefined,
        avoidFirst
      );
      setMultiFrameCustomIndices((prev) => ({
        ...prev,
        [offsetKey]: freshCombo,
      }));
    },
    [poolDistributionMode, multiFrameCustomIndices, pickRandomDistinctIndices, activePoolPhotoIndices]
  );

  // Áp dụng 1 Bộ Tổ Hợp Ngẫu Nhiên người dùng chọn vào toàn bộ 8 khung VÀ Bàn Chỉnh Sửa Lớn
  const handleApplySelectedComboPack = useCallback(
    (comboIndices: number[], packIdx: number, mode: 'all_8_frames' | 'single_frame' = 'all_8_frames') => {
      setActiveSelectedComboIdx(packIdx);
      if (mode === 'all_8_frames') {
        const nextCustom: Record<string, number[]> = {};
        multiFrameVariations.forEach((v, idx) => {
          nextCustom[`post-${idx}-${v.preset.id}`] = comboIndices;
        });
        storyFrameVariations.forEach((v, idx) => {
          nextCustom[`story-${idx}-${v.preset.id}`] = comboIndices;
        });
        setMultiFrameCustomIndices(nextCustom);
        setMultiFrameOffsets({});
      } else {
        setMultiFrameCustomIndices((prev) => {
          const targetIdx = packIdx % Math.max(1, multiFrameVariations.length);
          const v = multiFrameVariations[targetIdx];
          if (!v) return prev;
          return {
            ...prev,
            [`post-${targetIdx}-${v.preset.id}`]: comboIndices,
          };
        });
      }

      // Cập nhật luôn xuống Bàn Chỉnh Sửa Lớn
      const nextMainSlots: Record<number, string> = {};
      activePreset.slots.forEach((slot, sIdx) => {
        const pIdx = comboIndices[sIdx % comboIndices.length] ?? 0;
        nextMainSlots[slot.id] = uploadedPhotos[pIdx] || uploadedPhotos[0] || '';
      });
      setSlotAssignments(nextMainSlots);
      setSlotTransforms({});

      setExportNotice(
        mode === 'all_8_frames'
          ? `✅ Đã chọn Tổ hợp #${packIdx + 1} (${comboIndices.map((i) => `Ảnh #${i + 1}`).join(' + ')}) tự ghép đồng loạt vào 8 khung & Bàn sửa!`
          : `✅ Đã gán Tổ hợp #${packIdx + 1} (${comboIndices.map((i) => `Ảnh #${i + 1}`).join(' + ')}) vào Khung #${(packIdx % 8) + 1}!`
      );
      setTimeout(() => setExportNotice(null), 3200);
    },
    [multiFrameVariations, storyFrameVariations, activePreset, uploadedPhotos]
  );

  // Đảo ngẫu nhiên vị trí toàn bộ ảnh trong Kho Tự Ghép
  const handleShufflePoolPhotosOrder = useCallback(() => {
    if (uploadedPhotos.length <= 1) return;
    setUploadedPhotos((prev) => {
      const copy = [...prev];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = copy[i];
        copy[i] = copy[j];
        copy[j] = tmp;
      }
      setSlotAssignments((oldSlots) => {
        const updated = { ...oldSlots };
        activePreset.slots.forEach((slot, sIdx) => {
          updated[slot.id] = copy[sIdx % copy.length] || '';
        });
        return updated;
      });
      return copy;
    });
    setExcludedPoolIndices([]);
    setTimeout(() => {
      generateFreshRandomComboPacks(poolDistributionMode === 'hero_lock_random', true);
    }, 30);
    setExportNotice('🔀 Đã đảo ngẫu nhiên thứ tự ảnh trong Kho Tự Ghép & làm mới toàn bộ 8 khung!');
    setTimeout(() => setExportNotice(null), 3000);
  }, [uploadedPhotos.length, activePreset.slots, generateFreshRandomComboPacks, poolDistributionMode]);

  // Tính toán danh sách ảnh cho từng ô của 1 khung (đảm bảo khi kho nhiều ảnh thì 8 khung luôn phong phú, đa dạng)
  const getFrameVariationSlotsAndIndices = useCallback(
    (
      offsetKey: string,
      preset: CollagePreset,
      frameIdx: number
    ): { variationSlots: Record<number, string>; usedPhotoIndices: number[] } => {
      const total = uploadedPhotos.length;
      if (total === 0) {
        return { variationSlots: {}, usedPhotoIndices: [] };
      }
      const pool = activePoolPhotoIndices.length > 0 ? activePoolPhotoIndices : [0];
      const offset = multiFrameOffsets[offsetKey] || 0;
      const customList = multiFrameCustomIndices[offsetKey];

      const variationSlots: Record<number, string> = {};
      const usedPhotoIndices: number[] = [];

      preset.slots.forEach((s, sIdx) => {
        let chosenPoolIdx = 0;
        if (customList && customList.length > 0) {
          const baseIdx = customList[(sIdx + offset) % customList.length];
          chosenPoolIdx = baseIdx < total ? baseIdx : pool[(sIdx + offset) % pool.length];
        } else if (poolDistributionMode === 'same_set') {
          chosenPoolIdx = pool[(sIdx + offset) % pool.length];
        } else if (poolDistributionMode === 'hero_lock_random') {
          if (sIdx === 0 && offset === 0) {
            chosenPoolIdx = pool[0];
          } else {
            const subPool = pool.length > 1 ? pool.slice(1) : pool;
            chosenPoolIdx = subPool[(frameIdx + sIdx - 1 + offset + subPool.length) % subPool.length];
          }
        } else {
          // 'diverse_8_frames': Phân bổ bước nhảy thông minh khắp kho ảnh để 8 khung không bị trùng lặp
          const step = pool.length >= 6 ? 2 : 1;
          let pos = (frameIdx * step + sIdx + offset) % pool.length;
          // Tránh trùng ảnh trong cùng 1 khung nếu kho đủ ảnh
          if (usedPhotoIndices.includes(pool[pos]) && pool.length > sIdx) {
            pos = (pos + 1) % pool.length;
          }
          chosenPoolIdx = pool[pos];
        }

        usedPhotoIndices.push(chosenPoolIdx);
        variationSlots[s.id] = uploadedPhotos[chosenPoolIdx] || uploadedPhotos[0] || '';
      });

      return { variationSlots, usedPhotoIndices };
    },
    [
      uploadedPhotos,
      activePoolPhotoIndices,
      multiFrameOffsets,
      multiFrameCustomIndices,
      poolDistributionMode,
    ]
  );

  // Helper xác định cấu hình Phần Viết Chữ Phía Trên (Story Header) và các ô ảnh đã chuẩn hóa cho từng khung
  const resolveStoryHeaderAndSlots = useCallback(
    (preset: CollagePreset, cardKey?: string) => {
      const defaultHasHeader = Boolean(
        preset.storyHeader?.enabled && (preset.storyHeader?.heightPercent || 0) > 0
      );
      const overrideState = cardKey ? storyHeaderToggleMap[cardKey] : undefined;
      const isHeaderActive =
        overrideState === 'on' ? true : overrideState === 'off' ? false : defaultHasHeader;

      const headerHeightPercent = isHeaderActive
        ? preset.storyHeader?.heightPercent || 18
        : 0;

      // Điều chỉnh tọa độ các ô ảnh:
      // - Nếu mẫu vốn có phần trắng trên đầu (y > 0) nhưng người dùng tắt phần chữ -> kéo ô trên cùng tràn lên y = 0
      // - Nếu mẫu vốn không có phần trắng trên đầu (y === 0) nhưng người dùng bật phần chữ -> đẩy ô trên xuống dưới phần chữ
      const minTopY = Math.min(...preset.slots.map((s) => s.y));
      const adjustedSlots: CollageSlot[] = preset.slots.map((s) => {
        if (s.shape === 'circle') return s;
        if (!isHeaderActive && minTopY > 0 && Math.abs(s.y - minTopY) < 1.5) {
          return {
            ...s,
            y: 0,
            height: s.height + minTopY,
          };
        }
        if (isHeaderActive && minTopY === 0 && s.y === 0) {
          return {
            ...s,
            y: headerHeightPercent,
            height: Math.max(15, s.height - headerHeightPercent),
          };
        }
        return s;
      });

      const resolvedText =
        (cardKey && perStoryCustomTopText[cardKey] !== undefined
          ? perStoryCustomTopText[cardKey]
          : storyTopText) || '';

      const themeColors =
        storyTopTheme === 'white_red'
          ? { bg: '#FFFFFF', text: '#be123c', border: '#fecdd3' }
          : storyTopTheme === 'black_white'
          ? { bg: '#111827', text: '#FFFFFF', border: '#374151' }
          : storyTopTheme === 'black_yellow'
          ? { bg: '#09090b', text: '#facc15', border: '#27272a' }
          : { bg: '#FFFFFF', text: '#0f172a', border: '#e2e8f0' };

      return {
        isHeaderActive,
        headerHeightPercent,
        adjustedSlots,
        resolvedText,
        themeColors,
      };
    },
    [storyHeaderToggleMap, perStoryCustomTopText, storyTopText, storyTopTheme]
  );

  // Hàm vẽ Canvas dùng chung cho cả Khung Chính và từng Khung trong Bộ Sưu Tập Đa Khung
  const generateCanvasForConfig = async (options: {
    preset: CollagePreset;
    ratio: RatioOption;
    slotPhotos: Record<number, string>;
    transforms?: Record<number, SlotTransform>;
    circleOverrides?: Record<number, CircleSlotOverride>;
    storyCardKey?: string;
    exportRatioScale?: number;
  }): Promise<HTMLCanvasElement> => {
    const {
      preset,
      ratio,
      slotPhotos,
      transforms = {},
      circleOverrides = {},
      storyCardKey,
      exportRatioScale = 2,
    } = options;

    const canvas = document.createElement('canvas');
    const targetW = ratio.exportWidth * (exportRatioScale / 2);
    const targetH = ratio.exportHeight * (exportRatioScale / 2);
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2d context');

    // 1. Draw Background
    if (selectedBackground.type === 'color') {
      ctx.fillStyle = selectedBackground.value;
      ctx.fillRect(0, 0, targetW, targetH);
    } else {
      const grad = ctx.createLinearGradient(0, 0, targetW, targetH);
      if (selectedBackground.value.includes('#fdfcfb')) {
        grad.addColorStop(0, '#fdfcfb');
        grad.addColorStop(1, '#e2d1c3');
      } else if (selectedBackground.value.includes('#ff9a9e')) {
        grad.addColorStop(0, '#ff9a9e');
        grad.addColorStop(1, '#fecfef');
      } else if (selectedBackground.value.includes('#a1c4fd')) {
        grad.addColorStop(0, '#a1c4fd');
        grad.addColorStop(1, '#c2e9fb');
      } else if (selectedBackground.value.includes('#d4fc79')) {
        grad.addColorStop(0, '#d4fc79');
        grad.addColorStop(1, '#96e6a1');
      } else if (selectedBackground.value.includes('#2b5876')) {
        grad.addColorStop(0, '#2b5876');
        grad.addColorStop(1, '#4e4376');
      } else {
        grad.addColorStop(0, '#f6d365');
        grad.addColorStop(1, '#fda085');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, targetW, targetH);
    }

    // 2. Draw slots with padding & gap scaling
    const padPx = (padding / 100) * Math.min(targetW, targetH);
    const gapPx = (gap / 100) * Math.min(targetW, targetH);
    const cornerPx = (borderRadius / 100) * Math.min(targetW, targetH);

    const innerW = targetW - padPx * 2;
    const innerH = targetH - padPx * 2;
    const ratioAspect = targetW / targetH;

    const {
      isHeaderActive,
      headerHeightPercent,
      adjustedSlots,
      resolvedText,
      themeColors,
    } = resolveStoryHeaderAndSlots(preset, storyCardKey);

    const loadedImgs: Record<number, HTMLImageElement> = {};
    await Promise.all(
      adjustedSlots.map(
        (slot) =>
          new Promise<void>((resolve) => {
            const src = slotPhotos[slot.id];
            if (!src) {
              resolve();
              return;
            }
            const img = new window.Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              loadedImgs[slot.id] = img;
              resolve();
            };
            img.onerror = () => {
              if (!src.startsWith('data:') && !src.includes('wsrv.nl')) {
                const proxyImg = new window.Image();
                proxyImg.crossOrigin = 'anonymous';
                proxyImg.onload = () => {
                  loadedImgs[slot.id] = proxyImg;
                  resolve();
                };
                proxyImg.onerror = () => resolve();
                proxyImg.src = `https://wsrv.nl/?url=${encodeURIComponent(src)}&output=jpg`;
              } else {
                resolve();
              }
            };
            img.src = src;
          })
      )
    );

    // 2A. Vẽ Phần Trắng Viết Chữ Phía Trên Cho Mẫu Story (nếu mẫu có bật phần viết chữ đầu)
    if (isHeaderActive && headerHeightPercent > 0) {
      ctx.save();
      const headerX = padPx + gapPx / 2;
      const headerY = padPx + gapPx / 2;
      const headerW = Math.max(1, innerW - gapPx);
      const headerH = Math.max(1, (headerHeightPercent / 100) * innerH - gapPx);
      const r = Math.min(cornerPx, headerW / 2, headerH / 2);

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(headerX, headerY, headerW, headerH, r);
      } else {
        ctx.rect(headerX, headerY, headerW, headerH);
      }
      ctx.fillStyle = themeColors.bg;
      ctx.fill();

      const cleanHeadline = resolvedText.trim();
      if (cleanHeadline) {
        const baseFontPx = Math.round(
          Math.max(24, Math.min(54, (targetW / 1080) * 38 * storyTopFontScale))
        );
        ctx.font = `900 ${baseFontPx}px "Inter", "Segoe UI", Arial, sans-serif`;
        ctx.fillStyle = themeColors.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const maxTextW = headerW * 0.9;
        const words = cleanHeadline.split(/\s+/);
        const lines: string[] = [];
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          if (ctx.measureText(testLine).width > maxTextW && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);

        const maxLines = 4;
        const displayLines = lines.slice(0, maxLines);
        const lineHeight = baseFontPx * 1.24;
        const totalTextH = displayLines.length * lineHeight;
        let startY = headerY + headerH / 2 - totalTextH / 2 + lineHeight / 2;

        for (const line of displayLines) {
          ctx.fillText(line, headerX + headerW / 2, startY);
          startY += lineHeight;
        }
      }
      ctx.restore();
    }

    const sortedSlots = [...adjustedSlots].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    for (const slot of sortedSlots) {
      const eff = getEffectiveSlotBounds(slot, ratioAspect, circleOverrides[slot.id]);
      const slotX = padPx + (eff.x / 100) * innerW + gapPx / 2;
      const slotY = padPx + (eff.y / 100) * innerH + gapPx / 2;
      const slotW = Math.max(1, (eff.width / 100) * innerW - gapPx);
      const slotH = Math.max(1, (eff.height / 100) * innerH - gapPx);

      ctx.save();

      ctx.beginPath();
      if (slot.shape === 'circle') {
        const radius = Math.min(slotW, slotH) / 2;
        const centerX = slotX + slotW / 2;
        const centerY = slotY + slotH / 2;
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      } else {
        const r = Math.min(cornerPx, slotW / 2, slotH / 2);
        if (ctx.roundRect) {
          ctx.roundRect(slotX, slotY, slotW, slotH, r);
        } else {
          ctx.rect(slotX, slotY, slotW, slotH);
        }
      }
      ctx.clip();

      const img = loadedImgs[slot.id];
      if (img) {
        const transform = transforms[slot.id] || { scale: 1, panX: 0, panY: 0, rotate: 0 };
        const centerX = slotX + slotW / 2;
        const centerY = slotY + slotH / 2;

        ctx.translate(centerX, centerY);
        ctx.rotate((transform.rotate * Math.PI) / 180);

        const imgAspect = img.width / img.height;
        const slotAspect = slotW / slotH;
        let drawW = slotW;
        let drawH = slotH;
        if (imgAspect > slotAspect) {
          drawW = slotH * imgAspect;
        } else {
          drawH = slotW / imgAspect;
        }

        drawW *= transform.scale;
        drawH *= transform.scale;

        const panXPx = (transform.panX / 100) * slotW;
        const panYPx = (transform.panY / 100) * slotH;

        ctx.drawImage(img, -drawW / 2 + panXPx, -drawH / 2 + panYPx, drawW, drawH);
      } else {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(slotX, slotY, slotW, slotH);
      }
      ctx.restore();

      if (slot.shape === 'circle' && slot.borderWidth) {
        ctx.save();
        ctx.beginPath();
        const radius = Math.min(slotW, slotH) / 2;
        const centerX = slotX + slotW / 2;
        const centerY = slotY + slotH / 2;
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.lineWidth = ((slot.borderWidth || 4) / 100) * Math.min(targetW, targetH);
        ctx.strokeStyle = slot.borderColor || '#FFFFFF';
        ctx.stroke();
        ctx.restore();
      }
    }

    // 3. Draw Watermark / Embossed 3D Copyright Logo
    if (showWatermark && watermarkText.trim()) {
      ctx.save();
      const text = watermarkText.trim();
      const alpha = Math.max(0.1, Math.min(1, watermarkOpacity / 100));
      const scaledFontSize = Math.round((watermarkFontSize / 1080) * targetW);
      ctx.font = `900 ${scaledFontSize}px "Inter", "Segoe UI", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const textMetrics = ctx.measureText(text);
      const paddingX = scaledFontSize * 0.75;
      const paddingY = scaledFontSize * 0.38;
      const boxW = textMetrics.width + paddingX * 2;
      const boxH = scaledFontSize + paddingY * 2;

      const edgeMargin = Math.max(24, targetW * 0.045);
      let posX = targetW / 2;
      let posY = targetH / 2;

      if (watermarkPosition === 'top') {
        posX = targetW / 2;
        posY = Math.max(boxH / 2 + edgeMargin, targetH * 0.09);
      } else if (watermarkPosition === 'bottom') {
        posX = targetW / 2;
        posY = Math.min(targetH - boxH / 2 - edgeMargin, targetH * 0.91);
      } else if (watermarkPosition === 'bottom_right') {
        posX = targetW - boxW / 2 - edgeMargin;
        posY = targetH - boxH / 2 - edgeMargin;
      } else if (watermarkPosition === 'bottom_left') {
        posX = boxW / 2 + edgeMargin;
        posY = targetH - boxH / 2 - edgeMargin;
      } else if (watermarkPosition === 'top_right') {
        posX = targetW - boxW / 2 - edgeMargin;
        posY = boxH / 2 + edgeMargin;
      }

      ctx.translate(posX, posY);
      if (watermarkStyle === 'diagonal_stamp') {
        ctx.rotate((-18 * Math.PI) / 180);
      }

      if (watermarkStyle === 'embossed_logo' || watermarkStyle === 'diagonal_stamp') {
        // Hiệu ứng Logo Nổi 3D Bán Trong Suốt (Mờ nhưng sắc nét trên mọi nền sáng/tối)
        const bevelOffset = Math.max(1.5, scaledFontSize * 0.055);

        // Lớp 1: Viền ngoài tối mỏng tạo độ tương phản trên nền ảnh trắng/sáng
        ctx.globalAlpha = Math.min(1, alpha * 0.95);
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(2.5, scaledFontSize * 0.14);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.strokeText(text, 0, 0);

        // Lớp 2: Bóng đổ khắc chìm phía dưới phải (3D Drop Emboss)
        ctx.globalAlpha = Math.min(1, alpha * 0.85);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillText(text, bevelOffset, bevelOffset);

        // Lớp 3: Ánh sáng gờ nổi phía trên trái (3D Top-Left Highlight)
        ctx.globalAlpha = Math.min(1, alpha * 0.9);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillText(text, -bevelOffset * 0.6, -bevelOffset * 0.6);

        // Lớp 4: Thân chữ Logo chính bán trong suốt
        ctx.globalAlpha = alpha;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = Math.max(4, scaledFontSize * 0.2);
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = Math.max(1, scaledFontSize * 0.05);
        ctx.fillStyle = watermarkTextColor;
        ctx.fillText(text, 0, 0);

        // Nếu là đóng dấu chéo: vẽ thêm khung viền con dấu mảnh nổi
        if (watermarkStyle === 'diagonal_stamp') {
          ctx.shadowBlur = 0;
          ctx.globalAlpha = alpha * 0.85;
          ctx.lineWidth = Math.max(2, scaledFontSize * 0.07);
          ctx.strokeStyle = watermarkTextColor;
          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 10);
            ctx.stroke();
          } else {
            ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);
          }
        }
      } else if (watermarkStyle === 'glass_badge') {
        // Huy hiệu kính mờ bán trong suốt kèm viền sáng nổi
        ctx.globalAlpha = alpha * 0.65;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 3;
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, boxH / 2);
          ctx.fill();
        } else {
          ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);
        }

        // Viền sáng khắc nổi quanh huy hiệu
        ctx.shadowBlur = 0;
        ctx.globalAlpha = Math.min(1, alpha * 0.9);
        ctx.lineWidth = Math.max(1.5, scaledFontSize * 0.055);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.stroke();

        // Chữ nổi bên trong
        ctx.globalAlpha = Math.min(1, alpha + 0.15);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillText(text, 1.5, 1.5);
        ctx.fillStyle = watermarkTextColor;
        ctx.fillText(text, 0, 0);
      } else {
        // Banner Tiêu Đề Nổi truyền thống
        ctx.globalAlpha = alpha;
        ctx.fillStyle = watermarkBgColor;
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 10);
          ctx.fill();
        } else {
          ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);
        }
        ctx.fillStyle = watermarkTextColor;
        ctx.fillText(text, 0, 0);
      }

      ctx.restore();
    }

    // 4. Draw Bottom-Right Pill Badge ("Full Comments 👇")
    if (showCornerCta && cornerCtaText.trim()) {
      ctx.save();
      const ctaLabel = cornerCtaText.trim();
      const ctaScaledFont = Math.round((cornerCtaFontSize / 1080) * targetW);
      ctx.font = `800 ${ctaScaledFont}px "Inter", "Segoe UI", "Apple Color Emoji", "Segoe UI Emoji", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const metrics = ctx.measureText(ctaLabel);
      const padX = ctaScaledFont * 0.85;
      const padY = ctaScaledFont * 0.42;
      const pillW = metrics.width + padX * 2;
      const pillH = ctaScaledFont + padY * 2;

      const margin = Math.max(20, targetW * 0.032);
      let pillCenterX = targetW - pillW / 2 - margin;
      if (cornerCtaPosition === 'bottom_center') {
        pillCenterX = targetW / 2;
      } else if (cornerCtaPosition === 'bottom_left') {
        pillCenterX = pillW / 2 + margin;
      }
      const pillCenterY = targetH - pillH / 2 - margin;

      // Đổ bóng nổi cho khung thuốc đen "Full Comments 👇"
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = Math.max(8, ctaScaledFont * 0.35);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = Math.max(2, ctaScaledFont * 0.1);

      ctx.fillStyle = 'rgba(10, 10, 12, 0.86)';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(
          pillCenterX - pillW / 2,
          pillCenterY - pillH / 2,
          pillW,
          pillH,
          pillH / 2
        );
        ctx.fill();
      } else {
        ctx.fillRect(pillCenterX - pillW / 2, pillCenterY - pillH / 2, pillW, pillH);
      }

      // Viền sáng mảnh nhẹ giống ảnh mẫu
      ctx.shadowBlur = 0;
      ctx.lineWidth = Math.max(1.5, ctaScaledFont * 0.06);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.stroke();

      // Chữ trắng đậm sắc nét
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(ctaLabel, pillCenterX, pillCenterY + ctaScaledFont * 0.03);
      ctx.restore();
    }

    return canvas;
  };

  // Export high resolution canvas for main editor
  const generateCanvas = async (exportRatioScale = 2): Promise<HTMLCanvasElement> => {
    return generateCanvasForConfig({
      preset: activePreset,
      ratio: activeRatio,
      slotPhotos: slotAssignments,
      transforms: slotTransforms,
      circleOverrides: mainCircleOverrides,
      storyCardKey: `main-${activePreset.id}`,
      exportRatioScale,
    });
  };

  // Tải nhanh 1 khung bất kỳ từ Bộ Sưu Tập Đa Khung
  const handleQuickDownloadVariation = async (
    preset: CollagePreset,
    ratio: RatioOption,
    slotPhotos: Record<number, string>,
    mode: 'download' | 'copy',
    circleOverrides?: Record<number, CircleSlotOverride>,
    storyCardKey?: string
  ) => {
    try {
      setExportingPresetId(preset.id);
      const canvas = await generateCanvasForConfig({
        preset,
        ratio,
        slotPhotos,
        circleOverrides,
        storyCardKey,
        exportRatioScale: 2,
      });

      if (mode === 'copy') {
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            setExportNotice(`Đã Copy ảnh khung "${preset.name}" vào Clipboard!`);
            setTimeout(() => setExportNotice(null), 3500);
          } catch {
            setExportNotice('Trình duyệt chưa hỗ trợ copy trực tiếp, hãy bấm nút Tải PNG!');
            setTimeout(() => setExportNotice(null), 3500);
          }
        }, 'image/png');
      } else {
        const dataUrl = canvas.toDataURL('image/png', 0.95);
        const link = document.createElement('a');
        const timeStr = new Date().toISOString().slice(0, 10);
        link.download = `Ghep_Web_${preset.id}_${timeStr}.png`;
        link.href = dataUrl;
        link.click();
        setExportNotice(`Đã tải khung "${preset.name}" (${ratio.id}) thành công!`);
        setTimeout(() => setExportNotice(null), 3500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setExportingPresetId(null);
    }
  };

  // Download Image
  const handleDownloadImage = async (format: 'png' | 'jpeg') => {
    try {
      setIsExporting(true);
      const canvas = await generateCanvas(2);
      const mime = format === 'png' ? 'image/png' : 'image/jpeg';
      const dataUrl = canvas.toDataURL(mime, 0.92);

      const link = document.createElement('a');
      const timeStr = new Date().toISOString().slice(0, 10);
      link.download = `Ghep_Anh_${activePreset.id}_${timeStr}.${format}`;
      link.href = dataUrl;
      link.click();

      setExportNotice(`Đã xuất và tải ảnh ${format.toUpperCase()} thành công!`);
      setTimeout(() => setExportNotice(null), 3500);
    } catch (err) {
      console.error(err);
      setExportNotice('Không thể xuất ảnh, vui lòng thử lại!');
    } finally {
      setIsExporting(false);
    }
  };

  // Copy Image to Clipboard
  const handleCopyImage = async () => {
    try {
      setIsExporting(true);
      const canvas = await generateCanvas(2);
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          setExportNotice('Đã sao chép ảnh vào Clipboard! Dán ngay vào Facebook hoặc Zalo.');
          setTimeout(() => setExportNotice(null), 4000);
        } catch {
          setExportNotice('Trình duyệt chưa hỗ trợ sao chép ảnh trực tiếp. Hãy bấm Tải Ảnh.');
          setTimeout(() => setExportNotice(null), 4000);
        }
      }, 'image/png');
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  // Save Result to Current Task
  const handleSaveToTask = async () => {
    if (!currentWorkingTask) return;
    try {
      setIsExporting(true);
      const canvas = await generateCanvas(1.5);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      await onUpdateTask(currentWorkingTask.id, {
        resultImageUrl: dataUrl,
        status: 'completed',
        updatedAt: new Date().toLocaleDateString('vi-VN'),
      });

      setExportNotice(`Đã lưu ảnh thành phẩm và hoàn thành bài: "${currentWorkingTask.title}"!`);
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  // Open task into Studio
  const handleOpenTaskInStudio = (task: ImageTaskItem) => {
    setCurrentWorkingTask(task);
    if (task.presetId) setSelectedPresetId(task.presetId);
    if (task.aspectRatio) setSelectedRatioId(task.aspectRatio);
    if (task.sampleImages && task.sampleImages.length > 0) {
      setUploadedPhotos(task.sampleImages);
      const nextSlots: Record<number, string> = {};
      task.sampleImages.forEach((img, idx) => {
        nextSlots[idx] = img;
      });
      setSlotAssignments(nextSlots);
    }
    setActiveSubTab('studio');
    setExportNotice(`Đang làm nhiệm vụ: "${task.title}" (Giao cho: ${task.assignedStaff})`);
    setTimeout(() => setExportNotice(null), 4000);
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (taskFilterStaff === 'MY_TASKS') {
        if (t.assignedStaff.trim().toLowerCase() !== currentUser.name.trim().toLowerCase()) return false;
      } else if (taskFilterStaff !== 'ALL') {
        if (t.assignedStaff !== taskFilterStaff) return false;
      }
      if (taskFilterStatus !== 'ALL' && t.status !== taskFilterStatus) return false;
      if (taskSearchQuery.trim()) {
        const q = taskSearchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchPage = (t.pageName || '').toLowerCase().includes(q);
        const matchStaff = t.assignedStaff.toLowerCase().includes(q);
        if (!matchTitle && !matchPage && !matchStaff) return false;
      }
      return true;
    });
  }, [tasks, taskFilterStaff, taskFilterStatus, taskSearchQuery, currentUser]);

  // Task statistics
  const taskStats = useMemo(() => {
    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      inProgress: tasks.filter((t) => t.status === 'in_progress').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      myCount: tasks.filter((t) => t.assignedStaff.trim().toLowerCase() === currentUser.name.trim().toLowerCase()).length,
    };
  }, [tasks, currentUser]);

  return (
    <div className="w-full space-y-4 pb-12">
      {/* 1. THANH MENU CHÍNH & QUY TRÌNH KHOA HỌC 3 BƯỚC */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20 shrink-0">
              <Image className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Bảng 9: Xưởng Ghép Ảnh Tự Động & Chia Việc Nhân Viên
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                  Logo mặc định: © CELEB24H.COM
                </span>
                {currentWorkingTask && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                    <Clock className="w-3 h-3" />
                    <span>Đang làm: {currentWorkingTask.title.slice(0, 22)}...</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Quy trình 3 bước khoa học: <b>(1)</b> Hút ảnh từ Link Web / Tải ảnh máy & Chọn ảnh tương tự → <b>(2)</b> Tự ghép 2 Hàng (8 Bài 3:4 + 4 Story 9:16) → <b>(3)</b> Bàn chỉnh sửa chi tiết & Xuất ảnh.
              </p>
            </div>
          </div>

          {/* Cụm Menu Chuyển Chế Độ Chính & Liên Kết Sang Tab Viết Bài Web */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200/80 self-start lg:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setActiveSubTab('studio')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                activeSubTab === 'studio'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Xưởng Ghép Ảnh Tự Động</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('tasks')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                activeSubTab === 'tasks'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Chia Việc Làm Ảnh</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  activeSubTab === 'tasks'
                    ? 'bg-white/25 text-white'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {tasks.length}
              </span>
            </button>
            {onNavigateToTab && (
              <>
                <span className="text-slate-300 hidden sm:inline">|</span>
                <button
                  type="button"
                  onClick={() => onNavigateToTab('web_publish')}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer flex items-center space-x-1"
                  title="Chuyển nhanh sang Tab Viết Bài Lên Web (celeb24h.com)"
                >
                  <Globe className="w-3.5 h-3.5 text-emerald-600" />
                  <span>✍️ Viết Bài Web →</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* THANH MENU QUY TRÌNH 3 BƯỚC KHOA HỌC (HIỂN THỊ KHI ĐANG Ở XƯỞNG GHÉP ẢNH) */}
        {activeSubTab === 'studio' && (
          <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider mr-1">
                Menu Quy Trình:
              </span>
              {[
                {
                  id: 'all' as const,
                  label: '⚡ Hiện Đầy Đủ Cả 3 Bước',
                  badge: 'Full',
                },
                {
                  id: 'step1_pool' as const,
                  label: 'Bước 1: Nguồn Ảnh & Hàng Chờ Tương Tự',
                  badge: `${uploadedPhotos.length} kho · ${pendingSimilarImages.length} chờ`,
                },
                {
                  id: 'step2_auto' as const,
                  label: 'Bước 2: Ghép Tự Động 2 Hàng (8 Bài 3:4 + 4 Story 9:16)',
                  badge: '12 mẫu',
                },
                {
                  id: 'step3_editor' as const,
                  label: 'Bước 3: Bàn Sửa Lớn, 41 Mẫu & Logo Nổi',
                  badge: activeRatio.id,
                },
              ].map((step) => {
                const isActive = studioSectionFilter === step.id;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => {
                      setStudioSectionFilter(step.id);
                      if (step.id === 'step2_auto') {
                        setShowMultiFrameGallery(true);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                      isActive
                        ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                        : 'bg-slate-50 hover:bg-rose-50 text-slate-700 border-slate-200/90'
                    }`}
                  >
                    <span>{step.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                        isActive
                          ? 'bg-rose-500 text-white'
                          : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      {step.badge}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Hiển thị nhanh trạng thái Logo mặc định & Nhãn góc */}
            <div className="flex items-center gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setStudioSectionFilter('all');
                  setEditorSettingsTab('logo_cta');
                }}
                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold cursor-pointer flex items-center gap-1"
                title="Bấm để mở phần chỉnh Logo Bản Quyền Nổi"
              >
                <Type className="w-3 h-3 text-rose-600" />
                <span>Logo: {showWatermark ? watermarkText : 'Đang tắt'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Thông báo thao tác / Export notification */}
        {exportNotice && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center justify-between animate-fadeIn">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{exportNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setExportNotice(null)}
              className="text-emerald-700 hover:text-emerald-900 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* VIEW 1: XƯỞNG GHÉP ẢNH (COLLAGE STUDIO) */}
      {/* ==================================================== */}
      {activeSubTab === 'studio' && (
        <div className="space-y-5">
          {/* KHUNG BƯỚC 1 & BƯỚC 2 */}
          {(studioSectionFilter === 'all' ||
            studioSectionFilter === 'step1_pool' ||
            studioSectionFilter === 'step2_auto') && (
            <div className="bg-gradient-to-r from-rose-50/90 via-white to-indigo-50/70 rounded-2xl border-2 border-rose-200/90 shadow-xs p-4 sm:p-5 space-y-3.5">
              {(studioSectionFilter === 'all' || studioSectionFilter === 'step1_pool') && (
                <>
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black text-xs shadow-xs shrink-0">
                        B1
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-black text-slate-900 flex flex-wrap items-center gap-2">
                          <span>Bước 1: Lấy Ảnh Từ Link Bài Viết, Tải Ảnh Máy & Hàng Chờ Ảnh Tương Tự</span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Hỗ trợ celeb24h.com & mọi web báo
                          </span>
                        </h3>
                        <p className="text-xs text-slate-600">
                          Dán link bài viết (hoặc tải ảnh từ máy lên kho), hệ thống tự bóc toàn bộ ảnh trong bài và tự tìm ảnh tương tự vào hàng chờ để bạn chọn vô kho tự ghép.
                        </p>
                      </div>
                    </div>

              {/* Chọn nhanh bài vừa đăng trên celeb24h.com */}
              {recentWpArticles.length > 0 && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-bold text-slate-600 whitespace-nowrap">
                    Bài mới trên web:
                  </span>
                  <select
                    value=""
                    onChange={(e) => {
                      const chosenLink = e.target.value;
                      if (chosenLink) {
                        setWebArticleUrl(chosenLink);
                        void handleExtractImagesFromWebLink(chosenLink);
                      }
                    }}
                    className="max-w-[260px] text-xs font-bold bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-rose-500 cursor-pointer shadow-2xs"
                  >
                    <option value="">-- Chọn bài từ celeb24h.com để lấy ảnh ngay --</option>
                    {recentWpArticles.map((art) => (
                      <option key={art.id} value={art.link}>
                        #{art.id} [{art.employeeCode || 'Web'}] {art.title.slice(0, 48)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Hàng nhập Link Web + Yêu cầu ghép khung + Nút Lấy Ảnh & Tải Ảnh Từ Máy */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
              {/* Ô nhập Link bài viết */}
              <div className="lg:col-span-4 relative">
                <Link2 className="w-4 h-4 text-rose-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={webArticleUrl}
                  onChange={(e) => setWebArticleUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleExtractImagesFromWebLink();
                    }
                  }}
                  placeholder="Dán link bài viết web (VD: https://celeb24h.com/1159?H2000)..."
                  className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-2xs"
                />
                {webArticleUrl && (
                  <button
                    type="button"
                    onClick={() => setWebArticleUrl('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Ô nhập Yêu cầu ghép khung tùy ý */}
              <div className="lg:col-span-4 relative">
                <Wand2 className="w-4 h-4 text-indigo-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={customRequirementText}
                  onChange={(e) => setCustomRequirementText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (webArticleUrl.trim()) {
                        void handleExtractImagesFromWebLink();
                      } else {
                        applyCustomRequirementToStudio(
                          customRequirementText,
                          uploadedPhotos,
                          extractedArticleInfo?.title
                        );
                      }
                    }
                  }}
                  placeholder='Yêu cầu khung (VD: Ghép 3 ảnh khung tròn góc phải, nền đen, chữ "XEM NGAY")...'
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
              </div>

              {/* Cụm nút: Lấy Ảnh & Tự Ghép + Tải Ảnh Từ Máy Lên Kho */}
              <div className="lg:col-span-4 flex items-center gap-2">
                <button
                  type="button"
                  disabled={isExtractingWeb}
                  onClick={() => void handleExtractImagesFromWebLink()}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-60 whitespace-nowrap"
                >
                  {isExtractingWeb ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang hút ảnh...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Lấy Ảnh & Tự Ghép</span>
                    </>
                  )}
                </button>

                <label
                  title="Tải ảnh từ máy tính của bạn lên Kho Tự Ghép"
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all whitespace-nowrap shrink-0"
                >
                  <Upload className="w-4 h-4" />
                  <span>Tải Ảnh Từ Máy Lên Kho</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'append')}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Các nút chọn nhanh kiểu khung theo yêu cầu */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-extrabold text-slate-600 mr-1">
                  Yêu cầu ghép nhanh:
                </span>
                {[
                  { id: 'all_frames', label: `⭐ 8 Mẫu Hay Dùng Nhất (${favoritePresetIds.length}/8)` },
                  { id: 'circle_pip', label: '⭕ Khung Tròn Góc / Tròn Tâm (PiP)' },
                  { id: 'story_fb', label: '📱 Story FB 9:16 Viral' },
                  { id: 'feed_vertical', label: '📐 Chuẩn Feed Dọc 4:5' },
                  { id: '2_photos', label: '2 Ảnh' },
                  { id: '3_photos', label: '3 Ảnh' },
                  { id: '4_photos', label: '4 Ảnh (Lưới 2x2)' },
                ].map((reqItem) => {
                  const isActive = selectedQuickRequirement === reqItem.id;
                  return (
                    <button
                      key={reqItem.id}
                      type="button"
                      onClick={() => {
                        setSelectedQuickRequirement(reqItem.id as any);
                        setShowMultiFrameGallery(true);
                        if (reqItem.id === 'all_frames' && favoritePresetIds[0]) {
                          setSelectedPresetId(favoritePresetIds[0]);
                        } else if (reqItem.id === 'circle_pip') {
                          setSelectedPresetId(
                            uploadedPhotos.length >= 3
                              ? '3-circle-split-h-right'
                              : '2-circle-bottom-right'
                          );
                          setSelectedRatioId('3:4');
                        } else if (reqItem.id === 'story_fb') {
                          setSelectedPresetId('story-fb-before-after-classic');
                          setSelectedRatioId('9:16');
                        } else if (reqItem.id === 'feed_vertical') {
                          setSelectedRatioId('4:5');
                        } else if (reqItem.id === '2_photos') {
                          setSelectedPresetId('2-circle-bottom-right');
                        } else if (reqItem.id === '3_photos') {
                          setSelectedPresetId('3-circle-split-h-right');
                        } else if (reqItem.id === '4_photos') {
                          setSelectedPresetId('4-grid-2x2');
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                        isActive
                          ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                          : 'bg-white text-slate-700 hover:bg-rose-50 border-slate-200'
                      }`}
                    >
                      {reqItem.label}
                    </button>
                  );
                })}
              </div>

              {customRequirementText.trim() && (
                <button
                  type="button"
                  onClick={() =>
                    applyCustomRequirementToStudio(
                      customRequirementText,
                      uploadedPhotos,
                      extractedArticleInfo?.title
                    )
                  }
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                >
                  Áp dụng yêu cầu chữ ngay
                </button>
              )}
            </div>

            {/* Hiển thị lỗi hoặc thông tin bài viết vừa bóc tách */}
            {webExtractError && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{webExtractError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setWebExtractError(null)}
                  className="text-red-600 hover:text-red-800"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {extractedArticleInfo && (
              <div className="p-2.5 rounded-xl bg-white/90 border border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-black text-[10px] shrink-0">
                    ĐÃ LẤY {extractedArticleInfo.imageCount} ẢNH TỪ WEB
                  </span>
                  <span className="font-extrabold text-slate-900 truncate">
                    {extractedArticleInfo.title}
                  </span>
                  <a
                    href={extractedArticleInfo.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center gap-0.5 text-[11px] font-bold shrink-0"
                  >
                    <span>Mở bài gốc</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowWatermark(true);
                      setWatermarkText(extractedArticleInfo.title.slice(0, 46));
                    }}
                    className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] cursor-pointer"
                  >
                    Chèn Tiêu Đề Bài Vào Ảnh
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMultiFrameGallery((prev) => !prev)}
                    className="px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-[11px] cursor-pointer"
                  >
                    {showMultiFrameGallery ? 'Thu gọn bảng Đa Khung' : 'Hiện bảng Đa Khung'}
                  </button>
                </div>
              </div>
            )}

            {/* ================================================================================= */}
            {/* KHU VỰC KHO ẢNH TỰ GHÉP (TẢI TỪ MÁY LÊN KHO) & HÀNG CHỜ ẢNH TƯƠNG TỰ (CHỌN VÔ KHO) */}
            {/* ================================================================================= */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-1">
              {/* CỘT 1 (6 COL): KHO ẢNH ĐANG DÙNG ĐỂ TỰ GHÉP + MỤC ĐẢO ẢNH GHÉP NGẪU NHIÊN ĐỂ CHỌN */}
              <div className="lg:col-span-6 bg-white/95 rounded-xl border border-emerald-200 p-3 space-y-2.5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-black uppercase">
                      Kho Tự Ghép ({activePoolPhotoIndices.length}/{uploadedPhotos.length} ảnh)
                    </span>
                    <span className="text-[11px] font-bold text-slate-700">
                      Bấm ảnh để Chọn/Bỏ hoặc Đặt #1
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {uploadedPhotos.length >= 2 && (
                      <button
                        type="button"
                        onClick={() => handleRandomizeAll8FramesRichly()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-rose-600 to-orange-500 hover:from-rose-700 hover:to-orange-600 text-white text-[11px] font-extrabold cursor-pointer shadow-2xs transition-all"
                        title="Đảo & tự ghép ngẫu nhiên toàn bộ ảnh trong kho thành 8 khung khác nhau thật phong phú"
                      >
                        <Shuffle className="w-3 h-3" />
                        <span>🎲 Đảo Ghép Phong Phú 8 Khung</span>
                      </button>
                    )}

                    {uploadedPhotos.length >= 2 && (
                      <button
                        type="button"
                        onClick={handleShufflePoolPhotosOrder}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-bold cursor-pointer transition-colors"
                        title="Xáo trộn ngẫu nhiên thứ tự toàn bộ ảnh trong Kho Tự Ghép"
                      >
                        <RefreshCw className="w-3 h-3 text-emerald-700" />
                        <span>Đảo thứ tự kho</span>
                      </button>
                    )}

                    <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold cursor-pointer shadow-2xs transition-colors">
                      <Upload className="w-3 h-3" />
                      <span>+ Tải Ảnh Máy</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'append')}
                        className="hidden"
                      />
                    </label>

                    <label
                      title="Xóa ảnh cũ và thay toàn bộ kho bằng ảnh tải từ máy lên"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Thay Kho</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'replace')}
                        className="hidden"
                      />
                    </label>

                    {uploadedPhotos.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setUploadedPhotos([]);
                          setSlotAssignments({});
                          setMultiFrameCustomIndices({});
                          setExcludedPoolIndices([]);
                        }}
                        className="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold cursor-pointer"
                        title="Xóa trống kho ảnh"
                      >
                        Xóa kho
                      </button>
                    )}
                  </div>
                </div>

                {/* Danh sách ảnh trong Kho Tự Ghép (hỗ trợ tích chọn/bỏ chọn để tham gia tự ghép ngẫu nhiên) */}
                {uploadedPhotos.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
                      {uploadedPhotos.map((photo, idx) => {
                        const isExcluded = excludedPoolIndices.includes(idx);
                        return (
                          <div
                            key={`pool-${idx}`}
                            className={`relative group shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all shadow-2xs ${
                              isExcluded
                                ? 'border-slate-300 opacity-45 grayscale bg-slate-100'
                                : idx === 0
                                ? 'border-amber-500 ring-2 ring-amber-400/30 bg-slate-100'
                                : 'border-emerald-300 hover:border-emerald-600 bg-slate-100'
                            }`}
                          >
                            <img
                              src={photo}
                              alt={`Kho #${idx + 1}`}
                              onClick={() => {
                                setExcludedPoolIndices((prev) =>
                                  prev.includes(idx)
                                    ? prev.filter((i) => i !== idx)
                                    : [...prev, idx]
                                );
                              }}
                              className="w-full h-full object-cover cursor-pointer"
                              title={
                                isExcluded
                                  ? 'Ảnh này đang tạm tắt khỏi tự ghép. Bấm để bật lại!'
                                  : 'Bấm vào ảnh để bật/tắt tham gia đảo ngẫu nhiên 8 khung'
                              }
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setExcludedPoolIndices((prev) =>
                                  prev.includes(idx)
                                    ? prev.filter((i) => i !== idx)
                                    : [...prev, idx]
                                );
                              }}
                              className={`absolute top-1 left-1 text-[9px] font-black px-1.5 py-0.2 rounded cursor-pointer flex items-center gap-0.5 ${
                                isExcluded
                                  ? 'bg-slate-700 text-slate-200'
                                  : idx === 0
                                  ? 'bg-amber-500 text-slate-950'
                                  : 'bg-emerald-700/90 text-white'
                              }`}
                              title="Bấm để tích chọn / bỏ chọn ảnh này khi tự ghép ngẫu nhiên"
                            >
                              <span>{isExcluded ? '☐' : '☑'}</span>
                              <span>#{idx + 1}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setUploadedPhotos((prev) => prev.filter((_, i) => i !== idx))
                              }
                              title="Xóa ảnh này khỏi kho"
                              className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] font-black opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                              ×
                            </button>
                            <div className="absolute inset-x-0 bottom-0 bg-black/75 p-1 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {idx !== 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUploadedPhotos((prev) => {
                                      const next = [
                                        prev[idx],
                                        ...prev.filter((_, i) => i !== idx),
                                      ];
                                      setSlotAssignments((oldSlots) => {
                                        const updated = { ...oldSlots };
                                        activePreset.slots.forEach((slot, sIdx) => {
                                          updated[slot.id] =
                                            next[sIdx % Math.max(1, next.length)] || '';
                                        });
                                        return updated;
                                      });
                                      return next;
                                    });
                                    setExcludedPoolIndices((prev) => prev.filter((i) => i !== idx));
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[9px] font-black cursor-pointer"
                                  title="Đưa ảnh này lên vị trí #1 để làm ảnh chính cho toàn bộ mẫu ghép"
                                >
                                  Đặt #1
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  const targetSlot = activeSlotId !== null ? activeSlotId : 0;
                                  setSlotAssignments((prev) => ({ ...prev, [targetSlot]: photo }));
                                }}
                                className="px-1.5 py-0.5 rounded bg-white text-slate-900 text-[9px] font-black cursor-pointer"
                                title="Gán vào ô đang chọn ở bàn chỉnh sửa"
                              >
                                Gán ô
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* MỤC ĐẢO ẢNH GHÉP NGẪU NHIÊN ĐỂ CHỌN & TỰ GHÉP CHO PHONG PHÚ 8 KHUNG */}
                    {uploadedPhotos.length >= 2 && (
                      <div className="rounded-xl bg-gradient-to-r from-emerald-50/90 via-teal-50/80 to-amber-50/80 border border-emerald-200/90 p-2.5 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-black">
                              🎲 ĐẢO ẢNH NGẪU NHIÊN ({randomComboPacks.length} BỘ ĐỀ XUẤT)
                            </span>
                            <span className="text-[11px] font-bold text-slate-700">
                              Chọn bộ ảnh bất kỳ hoặc bấm Tự Ghép Phong Phú 8 Khung
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleRandomizeAll8FramesRichly('diverse_8_frames')}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold cursor-pointer border transition-all ${
                                poolDistributionMode === 'diverse_8_frames'
                                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                  : 'bg-white hover:bg-emerald-50 text-emerald-900 border-emerald-300'
                              }`}
                              title="Mỗi khung trong 8 khung sẽ tự động lấy 1 tổ hợp ảnh ngẫu nhiên khác nhau từ kho để phong phú nhất"
                            >
                              ✨ Tự Ghép 8 Khung Khác Nhau
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRandomizeAll8FramesRichly('hero_lock_random')}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold cursor-pointer border transition-all ${
                                poolDistributionMode === 'hero_lock_random'
                                  ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                                  : 'bg-white hover:bg-amber-50 text-amber-900 border-amber-300'
                              }`}
                              title="Giữ cố định Ảnh #1 làm ảnh chính và đảo ngẫu nhiên các ảnh phụ khác nhau cho 8 khung"
                            >
                              📌 Giữ Ảnh #1 + Đảo Ảnh Phụ
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                generateFreshRandomComboPacks(
                                  poolDistributionMode === 'hero_lock_random',
                                  true
                                )
                              }
                              className="px-2 py-0.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-extrabold cursor-pointer shadow-2xs flex items-center gap-1"
                              title="Quay ngẫu nhiên 8 tổ hợp ảnh mới từ Kho Tự Ghép và cập nhật ngay xuống 8 khung"
                            >
                              <Shuffle className="w-2.5 h-2.5" />
                              <span>Đảo Loạt Mới</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowRandomComboPicker((prev) => !prev)}
                              className="px-1.5 py-0.5 rounded-md bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold cursor-pointer"
                            >
                              {showRandomComboPicker ? 'Thu gọn' : 'Hiện 8 bộ'}
                            </button>
                          </div>
                        </div>

                        {showRandomComboPicker && randomComboPacks.length > 0 && (
                          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
                            {randomComboPacks.map((combo, packIdx) => {
                              const isSelectedPack = activeSelectedComboIdx === packIdx;
                              return (
                                <div
                                  key={`combo-pack-${packIdx}-${combo.join('-')}`}
                                  className={`shrink-0 rounded-xl border p-1.5 bg-white shadow-2xs transition-all flex flex-col gap-1 ${
                                    isSelectedPack
                                      ? 'border-rose-600 ring-2 ring-rose-500/25 bg-rose-50/30'
                                      : 'border-emerald-200 hover:border-rose-400'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1.5">
                                    <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 text-[9px] font-black">
                                      Bộ #{packIdx + 1}
                                    </span>
                                    <span className="text-[9px] font-mono font-bold text-slate-500">
                                      {combo.slice(0, 3).map((i) => `#${i + 1}`).join('•')}
                                    </span>
                                  </div>

                                  {/* 3 ảnh thu nhỏ trong Tổ hợp ngẫu nhiên */}
                                  <div
                                    onClick={() =>
                                      handleApplySelectedComboPack(combo, packIdx, 'all_8_frames')
                                    }
                                    className="flex items-center gap-1 cursor-pointer"
                                    title="Bấm để áp bộ ảnh ngẫu nhiên này vào toàn bộ 8 khung & Bàn sửa"
                                  >
                                    {combo.slice(0, 3).map((photoIndex, subIdx) => (
                                      <div
                                        key={`sub-${subIdx}`}
                                        className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0"
                                      >
                                        {uploadedPhotos[photoIndex] && (
                                          <img
                                            src={uploadedPhotos[photoIndex]}
                                            alt=""
                                            className="w-full h-full object-cover"
                                          />
                                        )}
                                        <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-black/75 text-white text-[8px] font-black leading-tight">
                                          #{photoIndex + 1}
                                        </span>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleApplySelectedComboPack(combo, packIdx, 'all_8_frames')
                                      }
                                      className="flex-1 py-0.5 px-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-black cursor-pointer text-center"
                                      title="Dùng bộ ảnh này tự ghép cho cả 8 khung để chọn kiểu khung ưng ý"
                                    >
                                      Ghép 8 khung
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleApplySelectedComboPack(combo, packIdx, 'single_frame')
                                      }
                                      className="py-0.5 px-1.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[9px] font-black cursor-pointer"
                                      title={`Gán riêng bộ ảnh này vào Khung #${packIdx + 1}`}
                                    >
                                      Khung #{packIdx + 1}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-4 px-3 text-center text-xs text-slate-500 border border-dashed border-emerald-300 rounded-lg bg-emerald-50/30">
                    Kho đang trống. Hãy dán Link bài viết hoặc bấm <b>&quot;+ Tải Ảnh Máy&quot;</b> (hoặc nhấn Ctrl+V dán ảnh) để đưa ảnh vào kho tự ghép!
                  </div>
                )}
              </div>

              {/* CỘT 2 (6 COL): HÀNG CHỜ ẢNH TƯƠNG TỰ TỰ ĐỘNG TÌM (CHỜ CHỌN VÔ KHO TỰ GHÉP) */}
              <div className="lg:col-span-6 bg-indigo-50/70 rounded-xl border border-indigo-200 p-3 space-y-2 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-black uppercase">
                      Hàng Chờ Ảnh Tương Tự ({pendingSimilarImages.length})
                    </span>
                    <span className="text-[11px] font-bold text-indigo-950">
                      Bấm chọn để đưa vô Kho Tự Ghép
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {pendingSimilarImages.length > 0 && (
                      <button
                        type="button"
                        onClick={handleSelectAllSimilarToPool}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold cursor-pointer shadow-2xs"
                      >
                        ✅ Chọn Tất Cả Vô Kho ({pendingSimilarImages.length})
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isSearchingSimilar}
                      onClick={() =>
                        void handleSearchSimilarImagesToQueue({
                          replaceQueue: pendingSimilarImages.length > 0,
                        })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-extrabold cursor-pointer shadow-2xs disabled:opacity-60"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${isSearchingSimilar ? 'animate-spin' : ''}`}
                      />
                      <span>
                        {isSearchingSimilar
                          ? 'Đang tìm...'
                          : pendingSimilarImages.length > 0
                          ? '🔄 Tìm Loạt Tương Tự Khác'
                          : '🔍 Tìm Ảnh Tương Tự'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Thanh nhập từ khóa nhân vật / chủ đề để tìm ảnh tương tự theo ý muốn */}
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-indigo-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={similarSearchQuery}
                      onChange={(e) => setSimilarSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleSearchSimilarImagesToQueue({
                            customQueryOverride: similarSearchQuery,
                            replaceQueue: false,
                          });
                        }
                      }}
                      placeholder="Nhập tên nhân vật / từ khóa để tìm thêm ảnh tương tự (hoặc tự động theo link bài)..."
                      className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-white border border-indigo-200 text-[11px] font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={isSearchingSimilar}
                    onClick={() =>
                      void handleSearchSimilarImagesToQueue({
                        customQueryOverride: similarSearchQuery,
                        replaceQueue: false,
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-300 text-[11px] font-bold cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    + Tìm thêm
                  </button>
                </div>

                {similarSearchNotice && (
                  <div className="text-[11px] font-semibold text-indigo-900 bg-white/80 px-2.5 py-1 rounded-lg border border-indigo-200/80">
                    {similarSearchNotice}
                  </div>
                )}

                {/* Danh sách ảnh tương tự đang nằm trong hàng chờ */}
                {pendingSimilarImages.length > 0 ? (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
                    {pendingSimilarImages.map((item, idx) => (
                      <div
                        key={`sim-${idx}-${item.url}`}
                        className="relative group shrink-0 w-24 rounded-xl overflow-hidden border-2 border-indigo-200 hover:border-indigo-600 bg-white shadow-2xs flex flex-col"
                      >
                        <div className="relative w-full h-16 bg-slate-100 overflow-hidden">
                          <img
                            src={item.url}
                            alt={item.alt}
                            className="w-full h-full object-cover"
                            onError={() => {
                              setPendingSimilarImages((prev) =>
                                prev.filter((x) => x.url !== item.url)
                              );
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setRejectedSimilarUrls((prev) => [...prev, item.url]);
                              setPendingSimilarImages((prev) =>
                                prev.filter((x) => x.url !== item.url)
                              );
                            }}
                            title="Bỏ qua ảnh này"
                            className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/70 hover:bg-red-600 text-white flex items-center justify-center text-[10px] font-black cursor-pointer"
                          >
                            ×
                          </button>
                        </div>
                        <div className="p-1 flex items-center gap-1 bg-white">
                          <button
                            type="button"
                            onClick={() => handleSelectSimilarToPool(item, false)}
                            className="flex-1 py-0.5 px-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black cursor-pointer text-center truncate"
                            title="Chọn đưa ảnh này vào Kho Tự Ghép"
                          >
                            + Vô kho
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectSimilarToPool(item, true)}
                            className="py-0.5 px-1 rounded bg-amber-400 hover:bg-amber-500 text-slate-950 text-[9px] font-black cursor-pointer shrink-0"
                            title="Chọn làm ảnh #1 chính cho toàn bộ mẫu ghép"
                          >
                            #1
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-3 px-3 text-center text-[11px] text-indigo-800/80 border border-dashed border-indigo-300 rounded-lg bg-white/50">
                    {isSearchingSimilar
                      ? '⏳ Hệ thống đang tự động tìm ảnh tương tự ngoài web...'
                      : 'Khi bạn bấm "Lấy Ảnh & Tự Ghép" (hoặc bấm "🔍 Tìm Ảnh Tương Tự"), ảnh tương tự cùng nhân vật sẽ tự động hiện vào hàng chờ tại đây để bạn chọn vô kho tự ghép!'}
                  </div>
                )}
              </div>
            </div>
                </>
              )}

            {/* BỘ SƯU TẬP KHUNG GHÉP TỰ ĐỘNG 2 HÀNG: HÀNG 1 (8 MẪU BÀI VIẾT 3:4) + HÀNG 2 (4 MẪU STORY 9:16) */}
            {(studioSectionFilter === 'all' || studioSectionFilter === 'step2_auto') &&
              showMultiFrameGallery &&
              uploadedPhotos.length > 0 && (
              <div className="pt-2 border-t border-rose-200/60 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-black text-slate-800 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-rose-600 text-white flex items-center justify-center font-black text-[10px]">
                      B2
                    </span>
                    <span>
                      Bước 2: Ghép Ảnh Tự Động 2 Hàng — Hàng 1 (8 Mẫu Bài Viết • Mặc định 3:4) & Hàng 2 (4 Mẫu Story • Mặc định 9:16)
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => handleRandomizeAll8FramesRichly('diverse_8_frames')}
                        className={`px-2 py-1 rounded-md text-[10px] font-extrabold cursor-pointer transition-all ${
                          poolDistributionMode === 'diverse_8_frames'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-700 hover:text-slate-900'
                        }`}
                        title="Tự động chia các bộ ảnh khác nhau từ Kho Tự Ghép vào 8 khung để 8 khung phong phú nhất"
                      >
                        🎲 8 Khung Khác Nhau (Phong Phú)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRandomizeAll8FramesRichly('hero_lock_random')}
                        className={`px-2 py-1 rounded-md text-[10px] font-extrabold cursor-pointer transition-all ${
                          poolDistributionMode === 'hero_lock_random'
                            ? 'bg-amber-500 text-white shadow-2xs'
                            : 'text-slate-700 hover:text-slate-900'
                        }`}
                        title="Giữ Ảnh #1 làm ảnh chính ở mọi khung, chỉ đảo ngẫu nhiên các ảnh phụ / ảnh tròn"
                      >
                        📌 Giữ #1 + Đảo Ảnh Phụ
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRandomizeAll8FramesRichly('same_set')}
                        className={`px-2 py-1 rounded-md text-[10px] font-extrabold cursor-pointer transition-all ${
                          poolDistributionMode === 'same_set'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'text-slate-700 hover:text-slate-900'
                        }`}
                        title="Dùng chung 1 bộ ảnh cho cả 8 khung để dễ so sánh bố cục"
                      >
                        🔢 Cùng Bộ Ảnh
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowFavoriteManager((prev) => !prev)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer border transition-colors ${
                        showFavoriteManager
                          ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                      }`}
                    >
                      <Settings2 className="w-3 h-3" />
                      <span>{showFavoriteManager ? 'Đóng chọn mẫu' : '⭐ Chọn 8 Mẫu Bài & 4 Mẫu Story'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRandomizeAll8FramesRichly()}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-gradient-to-r from-rose-600 to-orange-500 hover:from-rose-700 hover:to-orange-600 text-white text-[11px] font-extrabold cursor-pointer shadow-xs transition-all"
                      title="Đảo ngẫu nhiên tổ hợp ảnh mới từ Kho Tự Ghép cho toàn bộ 8 khung Bài Viết & 4 khung Story"
                    >
                      <Shuffle className="w-3 h-3" />
                      <span>🎲 Đảo Ngẫu Nhiên 8 Khung</span>
                    </button>
                  </div>
                </div>

                {/* BẢNG TÙY CHỈNH NHANH 8 MẪU BÀI VIẾT + 4 MẪU STORY */}
                {showFavoriteManager && (
                  <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-300 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          <span>Thiết Lập 8 Mẫu Bài Viết (3:4) & 4 Mẫu Story (9:16)</span>
                        </p>
                        <p className="text-[11px] text-amber-800">
                          Chọn mẫu cho từng ô bên dưới. Hệ thống tự động lưu lại theo tài khoản của bạn.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetDefaultFavorites}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold cursor-pointer"
                      >
                        Khôi phục mặc định (8 + 4 mẫu)
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[11px] font-extrabold text-amber-950">
                        Hàng 1 — 8 Mẫu Ảnh Cho Bài Viết (Mặc định 3:4):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                        {Array.from({ length: 8 }).map((_, idx) => {
                          const currentId =
                            favoritePresetIds[idx] || COLLAGE_PRESETS[idx]?.id || COLLAGE_PRESETS[0].id;
                          return (
                            <div
                              key={idx}
                              className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-amber-200 shadow-2xs"
                            >
                              <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white font-black text-[10px] shrink-0">
                                #{idx + 1}
                              </span>
                              <select
                                value={currentId}
                                onChange={(e) => handleReplaceFavoriteSlot(idx, e.target.value)}
                                className="w-full text-[11px] font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer truncate"
                              >
                                {COLLAGE_PRESETS.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({p.photoCount} ảnh)
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1 border-t border-amber-200/80">
                      <div className="text-[11px] font-extrabold text-indigo-950">
                        Hàng 2 — 4 Mẫu Ảnh Story (Mặc định 9:16):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                        {Array.from({ length: 4 }).map((_, idx) => {
                          const currentId =
                            favoriteStoryPresetIds[idx] ||
                            AUTO_STORY_FRAME_IDS[idx]?.presetId ||
                            COLLAGE_PRESETS[0].id;
                          return (
                            <div
                              key={idx}
                              className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-indigo-200 shadow-2xs"
                            >
                              <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white font-black text-[10px] shrink-0">
                                Story #{idx + 1}
                              </span>
                              <select
                                value={currentId}
                                onChange={(e) => handleReplaceStorySlot(idx, e.target.value)}
                                className="w-full text-[11px] font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer truncate"
                              >
                                {COLLAGE_PRESETS.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({p.photoCount} ảnh)
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* THANH ĐIỀU KHIỂN NHANH VỊ TRÍ & KÍCH THƯỚC ẢNH TRÒN (PIP) CHO TOÀN BỘ KHUNG */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-rose-50/90 border border-rose-200/80">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-950">
                    <Move className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>
                      Di chuyển Ảnh Tròn (tránh che mặt ảnh sau):{' '}
                      <span className="font-normal text-rose-800">
                        Kéo trực tiếp hình tròn bằng chuột trên từng khung hoặc bấm nhảy góc nhanh:
                      </span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {(
                      [
                        { id: 'top_left', label: '↖ Góc Trái Trên' },
                        { id: 'top_right', label: '↗ Góc Phải Trên' },
                        { id: 'bottom_left', label: '↙ Góc Trái Dưới' },
                        { id: 'bottom_right', label: '↘ Góc Phải Dưới' },
                        { id: 'bottom_center', label: '⬇ Giữa Dưới' },
                        { id: 'center', label: '⏺ Giữa' },
                      ] as const
                    ).map((btn) => (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => handleApplyGlobalCircleSnap(btn.id)}
                        className="px-2 py-0.5 rounded-md bg-white hover:bg-rose-600 hover:text-white text-slate-700 border border-rose-200 text-[10px] font-bold transition-colors cursor-pointer shadow-2xs"
                        title={`Đưa tất cả ảnh tròn về ${btn.label}`}
                      >
                        {btn.label}
                      </button>
                    ))}
                    <span className="text-rose-300 mx-0.5">|</span>
                    <button
                      type="button"
                      onClick={() => handleApplyGlobalCircleSnap('smaller')}
                      className="px-2 py-0.5 rounded-md bg-white hover:bg-slate-800 hover:text-white text-slate-700 border border-slate-300 text-[10px] font-bold cursor-pointer"
                      title="Thu nhỏ kích thước vòng tròn để đỡ che ảnh nền"
                    >
                      Thu nhỏ (-)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyGlobalCircleSnap('larger')}
                      className="px-2 py-0.5 rounded-md bg-white hover:bg-slate-800 hover:text-white text-slate-700 border border-slate-300 text-[10px] font-bold cursor-pointer"
                      title="Phóng to kích thước vòng tròn"
                    >
                      To hơn (+)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyGlobalCircleSnap('reset')}
                      className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 text-[10px] font-bold cursor-pointer"
                      title="Khôi phục vị trí & kích thước vòng tròn mặc định"
                    >
                      ↺ Mặc định
                    </button>
                  </div>
                </div>

                {/* ========================================================= */}
                {/* HÀNG 1: 8 MẪU ẢNH CHO BÀI VIẾT (KÍCH THƯỚC MẶC ĐỊNH 3:4) */}
                {/* ========================================================= */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-black uppercase tracking-wide">
                        Hàng 1
                      </span>
                      <span className="text-xs font-extrabold text-slate-800">
                        8 Mẫu Ảnh Cho Bài Viết
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold font-mono">
                        Kích thước ưu tiên mặc định: 3:4 (1080×1440)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
                    {multiFrameVariations.map((item, idx) => {
                      const offsetKey = `post-${idx}-${item.preset.id}`;
                      const { variationSlots, usedPhotoIndices } = getFrameVariationSlotsAndIndices(
                        offsetKey,
                        item.preset,
                        idx
                      );
                      const circleSlot = item.preset.slots.find((s) => s.shape === 'circle');
                      const cardCircleOverride = multiFrameCircleOverrides[offsetKey];
                      const cardCircleMap: Record<number, CircleSlotOverride> =
                        circleSlot && cardCircleOverride
                          ? { [circleSlot.id]: cardCircleOverride }
                          : {};
                      const ratioAspect = item.ratio.exportWidth / item.ratio.exportHeight;
                      const isCurrentPreset =
                        selectedPresetId === item.preset.id && selectedRatioId === item.ratio.id;
                      const isBusy = exportingPresetId === item.preset.id;

                      return (
                        <div
                          key={`post-${item.preset.id}-${idx}`}
                          className={`rounded-xl border p-2 bg-white flex flex-col justify-between transition-all ${
                            isCurrentPreset
                              ? 'border-rose-600 ring-2 ring-rose-500/20 shadow-sm'
                              : 'border-slate-200 hover:border-rose-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-black text-[9px] shrink-0">
                                #{idx + 1}
                              </span>
                              {selectedQuickRequirement === 'all_frames' ? (
                                <select
                                  value={item.preset.id}
                                  onChange={(e) => {
                                    const newId = e.target.value;
                                    handleReplaceFavoriteSlot(idx, newId);
                                    setSelectedPresetId(newId);
                                    setSelectedRatioId('3:4');
                                  }}
                                  title="Đổi mẫu bài viết cho ô này"
                                  className="flex-1 min-w-0 text-[10px] font-extrabold text-slate-800 bg-slate-50 hover:bg-amber-50 border border-slate-200 rounded px-1 py-0.5 cursor-pointer truncate"
                                >
                                  {COLLAGE_PRESETS.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span
                                  className="text-[10px] font-extrabold text-slate-800 truncate"
                                  title={item.badge}
                                >
                                  {item.badge}
                                </span>
                              )}
                              <span className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                                {item.ratio.id}
                              </span>
                            </div>

                            {/* Bản xem trước trực tiếp (Live Mini Collage - Chuẩn 3:4) */}
                            <div
                              onClick={() => {
                                if (suppressNextCardClickRef.current) return;
                                setSelectedPresetId(item.preset.id);
                                setSelectedRatioId(item.ratio.id);
                                setSlotAssignments(variationSlots);
                                setSlotTransforms({});
                                setMainCircleOverrides(cardCircleMap);
                              }}
                              style={{
                                aspectRatio: '3/4',
                                background: selectedBackground.value,
                              }}
                              className="w-full rounded-lg relative overflow-hidden border border-slate-200 cursor-pointer group select-none"
                              title={
                                circleSlot
                                  ? 'Kéo trực tiếp ảnh tròn để di chuyển khỏi che mặt • Bấm vào nền để mở xuống bàn chỉnh sửa lớn'
                                  : 'Bấm để mở khung bài viết 3:4 này xuống bàn chỉnh sửa lớn'
                              }
                            >
                              {item.preset.slots.map((slot) => {
                                const photoSrc = variationSlots[slot.id];
                                const isCircle = slot.shape === 'circle';
                                const eff = getEffectiveSlotBounds(
                                  slot,
                                  ratioAspect,
                                  isCircle ? cardCircleOverride : undefined
                                );
                                const isDraggingThisCircle =
                                  isCircle && activeCircleDragKey === offsetKey;

                                return (
                                  <div
                                    key={slot.id}
                                    onMouseDown={
                                      isCircle
                                        ? (e) =>
                                            handleStartGalleryCircleDrag(e, offsetKey, slot.id)
                                        : undefined
                                    }
                                    onClick={
                                      isCircle
                                        ? (e) => {
                                            e.stopPropagation();
                                          }
                                        : undefined
                                    }
                                    style={{
                                      left: `calc(${eff.x}% + 1.5px)`,
                                      top: `calc(${eff.y}% + 1.5px)`,
                                      width: `calc(${eff.width}% - 3px)`,
                                      height: `calc(${eff.height}% - 3px)`,
                                      borderRadius: isCircle ? '9999px' : '4px',
                                      zIndex: isCircle ? 25 : slot.zIndex || 1,
                                      border: isCircle
                                        ? isDraggingThisCircle
                                          ? '2.5px solid #f59e0b'
                                          : '2px solid #FFFFFF'
                                        : 'none',
                                      boxShadow: isCircle
                                        ? '0 4px 12px rgba(0,0,0,0.35)'
                                        : 'none',
                                    }}
                                    className={`absolute overflow-hidden bg-slate-200 ${
                                      isCircle
                                        ? 'cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-amber-400 group/circle'
                                        : ''
                                    }`}
                                    title={
                                      isCircle
                                        ? 'Giữ chuột và kéo để di chuyển ảnh tròn khỏi che các ảnh phía sau'
                                        : undefined
                                    }
                                  >
                                    {photoSrc && (
                                      <img
                                        src={photoSrc}
                                        alt=""
                                        draggable={false}
                                        className="w-full h-full object-cover pointer-events-none select-none"
                                      />
                                    )}
                                    {isCircle && (
                                      <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[8px] font-bold py-0.5 text-center opacity-0 group-hover/circle:opacity-100 transition-opacity pointer-events-none flex items-center justify-center gap-0.5">
                                        <Move className="w-2.5 h-2.5 text-amber-300" />
                                        <span>Kéo di chuyển</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {showWatermark && watermarkText.trim() && (
                                <div
                                  style={{
                                    opacity: Math.max(0.18, Math.min(1, watermarkOpacity / 100)),
                                    ...(watermarkPosition === 'center'
                                      ? {
                                          top: '50%',
                                          left: '50%',
                                          transform: `translate(-50%, -50%) ${
                                            watermarkStyle === 'diagonal_stamp'
                                              ? 'rotate(-18deg)'
                                              : ''
                                          }`,
                                        }
                                      : watermarkPosition === 'top'
                                      ? { top: '10%', left: '50%', transform: 'translate(-50%, -50%)' }
                                      : watermarkPosition === 'bottom'
                                      ? { bottom: '6%', left: '50%', transform: 'translateX(-50%)' }
                                      : watermarkPosition === 'bottom_right'
                                      ? { bottom: '5%', right: '5%' }
                                      : watermarkPosition === 'bottom_left'
                                      ? { bottom: '5%', left: '5%' }
                                      : { top: '5%', right: '5%' }),
                                  }}
                                  className="absolute z-20 pointer-events-none select-none"
                                >
                                  <span
                                    style={{
                                      color: watermarkTextColor,
                                      backgroundColor:
                                        watermarkStyle === 'solid_banner'
                                          ? watermarkBgColor
                                          : watermarkStyle === 'glass_badge'
                                          ? 'rgba(15,23,42,0.45)'
                                          : 'transparent',
                                      textShadow:
                                        watermarkStyle === 'solid_banner'
                                          ? 'none'
                                          : '-0.5px -0.5px 0 rgba(255,255,255,0.85), 1px 1px 1.5px rgba(0,0,0,0.85), 0 0 4px rgba(0,0,0,0.55)',
                                      border:
                                        watermarkStyle === 'diagonal_stamp'
                                          ? `1px solid ${watermarkTextColor}`
                                          : watermarkStyle === 'glass_badge'
                                          ? '1px solid rgba(255,255,255,0.55)'
                                          : 'none',
                                    }}
                                    className="px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider whitespace-nowrap block"
                                  >
                                    {watermarkText}
                                  </span>
                                </div>
                              )}

                              {showCornerCta && cornerCtaText.trim() && (
                                <div
                                  style={{
                                    bottom: '4%',
                                    ...(cornerCtaPosition === 'bottom_right'
                                      ? { right: '4%' }
                                      : cornerCtaPosition === 'bottom_left'
                                      ? { left: '4%' }
                                      : { left: '50%', transform: 'translateX(-50%)' }),
                                  }}
                                  className="absolute z-20 pointer-events-none select-none"
                                >
                                  <span className="px-1.5 py-0.5 rounded-full bg-black/85 text-white border border-white/25 text-[7px] font-extrabold tracking-tight shadow whitespace-nowrap block">
                                    {cornerCtaText}
                                  </span>
                                </div>
                              )}

                              <div className="absolute top-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                                <span className="px-2 py-0.5 rounded-md bg-black/75 text-white font-bold text-[9px] shadow whitespace-nowrap">
                                  {circleSlot ? 'Kéo ảnh tròn hoặc bấm chọn' : 'Chọn Khung 3:4'}
                                </span>
                              </div>
                            </div>

                            {/* Thanh chỉnh nhanh vị trí & cỡ vòng tròn ngay dưới từng khung có ảnh tròn */}
                            {circleSlot && (
                              <div className="mt-1.5 px-1 py-1 rounded-lg bg-amber-50/80 border border-amber-200/80 flex items-center justify-between gap-0.5">
                                <div className="flex items-center gap-0.5">
                                  {(
                                    [
                                      { pos: 'top_left', label: '↖', title: 'Đưa ảnh tròn lên góc trái trên' },
                                      { pos: 'top_right', label: '↗', title: 'Đưa ảnh tròn lên góc phải trên' },
                                      { pos: 'bottom_left', label: '↙', title: 'Đưa ảnh tròn xuống góc trái dưới' },
                                      { pos: 'bottom_right', label: '↘', title: 'Đưa ảnh tròn xuống góc phải dưới' },
                                      { pos: 'bottom_center', label: '⬇', title: 'Đưa ảnh tròn xuống giữa dưới' },
                                    ] as const
                                  ).map((b) => (
                                    <button
                                      key={b.pos}
                                      type="button"
                                      onClick={() =>
                                        setMultiFrameCircleOverrides((prev) => ({
                                          ...prev,
                                          [offsetKey]: computeSnapCircleOverride(
                                            circleSlot,
                                            ratioAspect,
                                            b.pos,
                                            prev[offsetKey]?.sizeScale ?? 1
                                          ),
                                        }))
                                      }
                                      title={b.title}
                                      className="w-4 h-4 rounded bg-white hover:bg-rose-600 hover:text-white text-slate-700 border border-amber-200 text-[9px] font-black flex items-center justify-center cursor-pointer"
                                    >
                                      {b.label}
                                    </button>
                                  ))}
                                </div>
                                <div className="flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setMultiFrameCircleOverrides((prev) => {
                                        const cur = prev[offsetKey] || { dx: 0, dy: 0, sizeScale: 1 };
                                        return {
                                          ...prev,
                                          [offsetKey]: {
                                            ...cur,
                                            sizeScale: Math.max(
                                              0.55,
                                              Number((cur.sizeScale - 0.1).toFixed(2))
                                            ),
                                          },
                                        };
                                      })
                                    }
                                    title="Thu nhỏ ảnh tròn"
                                    className="w-4 h-4 rounded bg-white hover:bg-slate-800 hover:text-white text-slate-700 border border-amber-200 text-[10px] font-black flex items-center justify-center cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setMultiFrameCircleOverrides((prev) => {
                                        const cur = prev[offsetKey] || { dx: 0, dy: 0, sizeScale: 1 };
                                        return {
                                          ...prev,
                                          [offsetKey]: {
                                            ...cur,
                                            sizeScale: Math.min(
                                              1.35,
                                              Number((cur.sizeScale + 0.1).toFixed(2))
                                            ),
                                          },
                                        };
                                      })
                                    }
                                    title="Phóng to ảnh tròn"
                                    className="w-4 h-4 rounded bg-white hover:bg-slate-800 hover:text-white text-slate-700 border border-amber-200 text-[10px] font-black flex items-center justify-center cursor-pointer"
                                  >
                                    +
                                  </button>
                                  {cardCircleOverride && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setMultiFrameCircleOverrides((prev) => {
                                          const copy = { ...prev };
                                          delete copy[offsetKey];
                                          return copy;
                                        })
                                      }
                                      title="Đặt lại vị trí ảnh tròn mặc định"
                                      className="w-4 h-4 rounded bg-rose-100 hover:bg-rose-600 hover:text-white text-rose-700 text-[9px] font-black flex items-center justify-center cursor-pointer"
                                    >
                                      ↺
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Nút Đảo ngẫu nhiên ảnh từ kho, Copy & Tải nhanh từng khung */}
                          <div className="flex items-center justify-between gap-1 mt-1.5 pt-1 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() =>
                                handleRandomizeSingleFrame(offsetKey, item.preset.slots.length)
                              }
                              className="px-1.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[9px] font-extrabold cursor-pointer flex items-center gap-0.5 shrink-0"
                              title={`Đảo bộ ảnh ngẫu nhiên khác từ Kho Tự Ghép cho khung #${idx + 1} (Đang ghép ảnh: ${usedPhotoIndices.map((i) => `#${i + 1}`).join(', ')})`}
                            >
                              <Shuffle className="w-2.5 h-2.5 text-emerald-700" />
                              <span>{usedPhotoIndices.map((i) => `#${i + 1}`).join('•')}</span>
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                void handleQuickDownloadVariation(
                                  item.preset,
                                  item.ratio,
                                  variationSlots,
                                  'copy',
                                  cardCircleMap
                                )
                              }
                              className="flex-1 py-1 px-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold flex items-center justify-center gap-0.5 cursor-pointer"
                              title="Copy ảnh khung 3:4 này vào Clipboard"
                            >
                              <Copy className="w-2.5 h-2.5" />
                              <span>Copy</span>
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                void handleQuickDownloadVariation(
                                  item.preset,
                                  item.ratio,
                                  variationSlots,
                                  'download',
                                  cardCircleMap
                                )
                              }
                              className="flex-1 py-1 px-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold flex items-center justify-center gap-0.5 cursor-pointer"
                              title="Tải ảnh PNG 3:4 khung này về máy"
                            >
                              <Download className="w-2.5 h-2.5" />
                              <span>Tải</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ========================================================= */}
                {/* HÀNG 2: 4 MẪU ẢNH STORY (KÍCH THƯỚC MẶC ĐỊNH 9:16)        */}
                {/* ========================================================= */}
                <div className="space-y-2.5 pt-2 border-t border-rose-200/50">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wide">
                        Hàng 2
                      </span>
                      <span className="text-xs font-extrabold text-slate-800">
                        4 Mẫu Ảnh Story Facebook / Reels
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold font-mono">
                        Kích thước mặc định: 9:16 (1080×1920)
                      </span>
                    </div>

                    {/* Thanh nhập & tùy chỉnh nhanh Chữ Tiêu Đề Phần Trắng Phía Trên cho các mẫu Story (S#2, S#3...) */}
                    <div className="flex flex-wrap items-center gap-1.5 bg-indigo-50/90 border border-indigo-200 px-2.5 py-1.5 rounded-xl flex-1 max-w-3xl">
                      <span className="text-[11px] font-black text-indigo-950 flex items-center gap-1 shrink-0">
                        <Type className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Chữ phần trắng trên đầu Story:</span>
                      </span>
                      <input
                        type="text"
                        value={storyTopText}
                        onChange={(e) => {
                          setStoryTopText(e.target.value);
                          setPerStoryCustomTopText({});
                        }}
                        placeholder="Nhập tiêu đề chữ cho phần trắng phía trên của mẫu Story (S#2, S#3)..."
                        className="flex-1 min-w-[180px] px-2.5 py-1 rounded-lg bg-white border border-indigo-300 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600"
                      />
                      {extractedArticleInfo?.title && (
                        <button
                          type="button"
                          onClick={() => {
                            setStoryTopText(extractedArticleInfo.title);
                            setPerStoryCustomTopText({});
                          }}
                          className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold cursor-pointer shrink-0"
                          title="Lấy tiêu đề bài viết web điền vào phần trắng trên đầu Story"
                        >
                          📋 Lấy tiêu đề bài
                        </button>
                      )}
                      <div className="flex items-center gap-1 shrink-0">
                        {(
                          [
                            { id: 'white_black', label: 'Nền Trắng•Chữ Đen', cls: 'bg-white text-slate-900 border-slate-300' },
                            { id: 'white_red', label: 'Nền Trắng•Chữ Đỏ', cls: 'bg-white text-rose-700 border-rose-300' },
                            { id: 'black_white', label: 'Nền Đen•Chữ Trắng', cls: 'bg-slate-900 text-white border-slate-800' },
                            { id: 'black_yellow', label: 'Nền Đen•Chữ Vàng', cls: 'bg-slate-950 text-amber-300 border-slate-800' },
                          ] as const
                        ).map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setStoryTopTheme(t.id)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black border cursor-pointer ${t.cls} ${
                              storyTopTheme === t.id ? 'ring-2 ring-indigo-500' : 'opacity-75 hover:opacity-100'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setStoryTopFontScale((prev) =>
                              Math.max(0.65, Number((prev - 0.1).toFixed(2)))
                            )
                          }
                          className="px-1.5 py-0.5 rounded bg-white border border-indigo-200 text-slate-700 text-[10px] font-black cursor-pointer hover:bg-slate-100"
                          title="Thu nhỏ cỡ chữ tiêu đề trên Story"
                        >
                          A-
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setStoryTopFontScale((prev) =>
                              Math.min(1.5, Number((prev + 0.1).toFixed(2)))
                            )
                          }
                          className="px-1.5 py-0.5 rounded bg-white border border-indigo-200 text-slate-700 text-[10px] font-black cursor-pointer hover:bg-slate-100"
                          title="Phóng to cỡ chữ tiêu đề trên Story"
                        >
                          A+
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
                    {storyFrameVariations.map((item, idx) => {
                      const offsetKey = `story-${idx}-${item.preset.id}`;
                      const { variationSlots, usedPhotoIndices } = getFrameVariationSlotsAndIndices(
                        offsetKey,
                        item.preset,
                        idx + 8
                      );
                      const {
                        isHeaderActive,
                        headerHeightPercent,
                        adjustedSlots,
                        resolvedText,
                        themeColors,
                      } = resolveStoryHeaderAndSlots(item.preset, offsetKey);

                      const circleSlot = adjustedSlots.find((s) => s.shape === 'circle');
                      const cardCircleOverride = multiFrameCircleOverrides[offsetKey];
                      const cardCircleMap: Record<number, CircleSlotOverride> =
                        circleSlot && cardCircleOverride
                          ? { [circleSlot.id]: cardCircleOverride }
                          : {};
                      const ratioAspect = item.ratio.exportWidth / item.ratio.exportHeight;
                      const isCurrentPreset =
                        selectedPresetId === item.preset.id && selectedRatioId === '9:16';
                      const isBusy = exportingPresetId === item.preset.id;

                      return (
                        <div
                          key={`story-${item.preset.id}-${idx}`}
                          className={`rounded-xl border p-2 bg-white flex flex-col justify-between transition-all ${
                            isCurrentPreset
                              ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-sm'
                              : 'border-slate-200 hover:border-indigo-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-900 font-black text-[9px] shrink-0">
                                S#{idx + 1}
                              </span>
                              <select
                                value={item.preset.id}
                                onChange={(e) => {
                                  const newId = e.target.value;
                                  handleReplaceStorySlot(idx, newId);
                                  setSelectedPresetId(newId);
                                  setSelectedRatioId('9:16');
                                }}
                                title="Đổi mẫu Story 9:16 cho ô này"
                                className="flex-1 min-w-0 text-[10px] font-extrabold text-slate-800 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded px-1 py-0.5 cursor-pointer truncate"
                              >
                                {COLLAGE_PRESETS.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() =>
                                  setStoryHeaderToggleMap((prev) => ({
                                    ...prev,
                                    [offsetKey]: isHeaderActive ? 'off' : 'on',
                                  }))
                                }
                                title={
                                  isHeaderActive
                                    ? 'Đang bật ô viết chữ phía trên • Bấm để bỏ ô chữ và kéo ảnh tràn lên kín khung'
                                    : 'Bấm để mở ô viết chữ tiêu đề ở phía trên khung Story này'
                                }
                                className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border cursor-pointer shrink-0 transition-colors ${
                                  isHeaderActive
                                    ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                }`}
                              >
                                {isHeaderActive ? '✍️ Có chữ' : '+ Chữ đầu'}
                              </button>
                            </div>

                            {/* Bản xem trước trực tiếp (Live Mini Story - Chuẩn 9:16) */}
                            <div
                              onClick={() => {
                                if (suppressNextCardClickRef.current) return;
                                setSelectedPresetId(item.preset.id);
                                setSelectedRatioId('9:16');
                                setSlotAssignments(variationSlots);
                                setSlotTransforms({});
                                setMainCircleOverrides(cardCircleMap);
                              }}
                              style={{
                                aspectRatio: '9/16',
                                background: selectedBackground.value,
                              }}
                              className="w-full rounded-lg relative overflow-hidden border border-slate-200 cursor-pointer group select-none"
                              title={
                                circleSlot
                                  ? 'Kéo trực tiếp ảnh tròn để di chuyển khỏi che mặt • Bấm vào nền để mở xuống bàn chỉnh sửa lớn'
                                  : 'Bấm để mở khung Story 9:16 này xuống bàn chỉnh sửa lớn'
                              }
                            >
                              {/* Ô VIẾT CHỮ TRỰC TIẾP Ở PHẦN TRẮNG PHÍA TRÊN CỦA MẪU STORY (S#2, S#3...) */}
                              {isHeaderActive && headerHeightPercent > 0 && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  style={{
                                    left: '1.5px',
                                    top: '1.5px',
                                    width: 'calc(100% - 3px)',
                                    height: `calc(${headerHeightPercent}% - 3px)`,
                                    backgroundColor: themeColors.bg,
                                    borderBottom: `1px solid ${themeColors.border}`,
                                    zIndex: 30,
                                  }}
                                  className="absolute rounded-t-md overflow-hidden flex flex-col justify-center px-1.5 py-1 group/header"
                                >
                                  <textarea
                                    value={resolvedText}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setPerStoryCustomTopText((prev) => ({
                                        ...prev,
                                        [offsetKey]: val,
                                      }));
                                    }}
                                    placeholder="✍️ Nhập chữ tiêu đề vào đây..."
                                    rows={3}
                                    style={{
                                      color: themeColors.text,
                                      fontSize: `${Math.max(8, Math.min(14, Math.round(10 * storyTopFontScale)))}px`,
                                      lineHeight: '1.2',
                                    }}
                                    className="w-full h-full bg-transparent resize-none border-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded font-black text-center flex items-center justify-center overflow-hidden p-0.5 cursor-text select-text"
                                    title="Bấm trực tiếp vào đây để gõ hoặc sửa chữ tiêu đề phần trắng phía trên của mẫu Story này!"
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setStoryHeaderToggleMap((prev) => ({
                                        ...prev,
                                        [offsetKey]: 'off',
                                      }));
                                    }}
                                    title="Ẩn phần viết chữ phía trên để ảnh tràn kín khung"
                                    className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-black/50 hover:bg-red-600 text-white text-[8px] font-black flex items-center justify-center opacity-0 group-hover/header:opacity-100 transition-opacity cursor-pointer"
                                  >
                                    ×
                                  </button>
                                </div>
                              )}

                              {adjustedSlots.map((slot) => {
                                const photoSrc = variationSlots[slot.id];
                                const isCircle = slot.shape === 'circle';
                                const eff = getEffectiveSlotBounds(
                                  slot,
                                  ratioAspect,
                                  isCircle ? cardCircleOverride : undefined
                                );
                                const isDraggingThisCircle =
                                  isCircle && activeCircleDragKey === offsetKey;

                                return (
                                  <div
                                    key={slot.id}
                                    onMouseDown={
                                      isCircle
                                        ? (e) =>
                                            handleStartGalleryCircleDrag(e, offsetKey, slot.id)
                                        : undefined
                                    }
                                    onClick={
                                      isCircle
                                        ? (e) => {
                                            e.stopPropagation();
                                          }
                                        : undefined
                                    }
                                    style={{
                                      left: `calc(${eff.x}% + 1.5px)`,
                                      top: `calc(${eff.y}% + 1.5px)`,
                                      width: `calc(${eff.width}% - 3px)`,
                                      height: `calc(${eff.height}% - 3px)`,
                                      borderRadius: isCircle ? '9999px' : '4px',
                                      zIndex: isCircle ? 25 : slot.zIndex || 1,
                                      border: isCircle
                                        ? isDraggingThisCircle
                                          ? '2.5px solid #f59e0b'
                                          : '2px solid #FFFFFF'
                                        : 'none',
                                      boxShadow: isCircle
                                        ? '0 4px 12px rgba(0,0,0,0.35)'
                                        : 'none',
                                    }}
                                    className={`absolute overflow-hidden bg-slate-200 ${
                                      isCircle
                                        ? 'cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-amber-400 group/circle'
                                        : ''
                                    }`}
                                    title={
                                      isCircle
                                        ? 'Giữ chuột và kéo để di chuyển ảnh tròn khỏi che các ảnh phía sau'
                                        : undefined
                                    }
                                  >
                                    {photoSrc && (
                                      <img
                                        src={photoSrc}
                                        alt=""
                                        draggable={false}
                                        className="w-full h-full object-cover pointer-events-none select-none"
                                      />
                                    )}
                                    {isCircle && (
                                      <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[8px] font-bold py-0.5 text-center opacity-0 group-hover/circle:opacity-100 transition-opacity pointer-events-none flex items-center justify-center gap-0.5">
                                        <Move className="w-2.5 h-2.5 text-amber-300" />
                                        <span>Kéo di chuyển</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {showWatermark && watermarkText.trim() && (
                                <div
                                  style={{
                                    opacity: Math.max(0.18, Math.min(1, watermarkOpacity / 100)),
                                    ...(watermarkPosition === 'center'
                                      ? {
                                          top: '50%',
                                          left: '50%',
                                          transform: `translate(-50%, -50%) ${
                                            watermarkStyle === 'diagonal_stamp'
                                              ? 'rotate(-18deg)'
                                              : ''
                                          }`,
                                        }
                                      : watermarkPosition === 'top'
                                      ? { top: '10%', left: '50%', transform: 'translate(-50%, -50%)' }
                                      : watermarkPosition === 'bottom'
                                      ? { bottom: '6%', left: '50%', transform: 'translateX(-50%)' }
                                      : watermarkPosition === 'bottom_right'
                                      ? { bottom: '5%', right: '5%' }
                                      : watermarkPosition === 'bottom_left'
                                      ? { bottom: '5%', left: '5%' }
                                      : { top: '5%', right: '5%' }),
                                  }}
                                  className="absolute z-20 pointer-events-none select-none"
                                >
                                  <span
                                    style={{
                                      color: watermarkTextColor,
                                      backgroundColor:
                                        watermarkStyle === 'solid_banner'
                                          ? watermarkBgColor
                                          : watermarkStyle === 'glass_badge'
                                          ? 'rgba(15,23,42,0.45)'
                                          : 'transparent',
                                      textShadow:
                                        watermarkStyle === 'solid_banner'
                                          ? 'none'
                                          : '-0.5px -0.5px 0 rgba(255,255,255,0.85), 1px 1px 1.5px rgba(0,0,0,0.85), 0 0 4px rgba(0,0,0,0.55)',
                                      border:
                                        watermarkStyle === 'diagonal_stamp'
                                          ? `1px solid ${watermarkTextColor}`
                                          : watermarkStyle === 'glass_badge'
                                          ? '1px solid rgba(255,255,255,0.55)'
                                          : 'none',
                                    }}
                                    className="px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider whitespace-nowrap block"
                                  >
                                    {watermarkText}
                                  </span>
                                </div>
                              )}

                              {showCornerCta && cornerCtaText.trim() && (
                                <div
                                  style={{
                                    bottom: '4%',
                                    ...(cornerCtaPosition === 'bottom_right'
                                      ? { right: '4%' }
                                      : cornerCtaPosition === 'bottom_left'
                                      ? { left: '4%' }
                                      : { left: '50%', transform: 'translateX(-50%)' }),
                                  }}
                                  className="absolute z-20 pointer-events-none select-none"
                                >
                                  <span className="px-1.5 py-0.5 rounded-full bg-black/85 text-white border border-white/25 text-[7px] font-extrabold tracking-tight shadow whitespace-nowrap block">
                                    {cornerCtaText}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Thanh chỉnh nhanh vị trí & cỡ vòng tròn ngay dưới khung Story có ảnh tròn */}
                            {circleSlot && (
                              <div className="mt-1.5 px-1 py-1 rounded-lg bg-indigo-50/80 border border-indigo-200/80 flex items-center justify-between gap-0.5">
                                <div className="flex items-center gap-0.5">
                                  {(
                                    [
                                      { pos: 'top_left', label: '↖', title: 'Đưa ảnh tròn lên góc trái trên' },
                                      { pos: 'top_right', label: '↗', title: 'Đưa ảnh tròn lên góc phải trên' },
                                      { pos: 'bottom_left', label: '↙', title: 'Đưa ảnh tròn xuống góc trái dưới' },
                                      { pos: 'bottom_right', label: '↘', title: 'Đưa ảnh tròn xuống góc phải dưới' },
                                      { pos: 'bottom_center', label: '⬇', title: 'Đưa ảnh tròn xuống giữa dưới' },
                                    ] as const
                                  ).map((b) => (
                                    <button
                                      key={b.pos}
                                      type="button"
                                      onClick={() =>
                                        setMultiFrameCircleOverrides((prev) => ({
                                          ...prev,
                                          [offsetKey]: computeSnapCircleOverride(
                                            circleSlot,
                                            ratioAspect,
                                            b.pos,
                                            prev[offsetKey]?.sizeScale ?? 1
                                          ),
                                        }))
                                      }
                                      title={b.title}
                                      className="w-4 h-4 rounded bg-white hover:bg-indigo-600 hover:text-white text-slate-700 border border-indigo-200 text-[9px] font-black flex items-center justify-center cursor-pointer"
                                    >
                                      {b.label}
                                    </button>
                                  ))}
                                </div>
                                <div className="flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setMultiFrameCircleOverrides((prev) => {
                                        const cur = prev[offsetKey] || { dx: 0, dy: 0, sizeScale: 1 };
                                        return {
                                          ...prev,
                                          [offsetKey]: {
                                            ...cur,
                                            sizeScale: Math.max(
                                              0.55,
                                              Number((cur.sizeScale - 0.1).toFixed(2))
                                            ),
                                          },
                                        };
                                      })
                                    }
                                    title="Thu nhỏ ảnh tròn"
                                    className="w-4 h-4 rounded bg-white hover:bg-slate-800 hover:text-white text-slate-700 border border-indigo-200 text-[10px] font-black flex items-center justify-center cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setMultiFrameCircleOverrides((prev) => {
                                        const cur = prev[offsetKey] || { dx: 0, dy: 0, sizeScale: 1 };
                                        return {
                                          ...prev,
                                          [offsetKey]: {
                                            ...cur,
                                            sizeScale: Math.min(
                                              1.35,
                                              Number((cur.sizeScale + 0.1).toFixed(2))
                                            ),
                                          },
                                        };
                                      })
                                    }
                                    title="Phóng to ảnh tròn"
                                    className="w-4 h-4 rounded bg-white hover:bg-slate-800 hover:text-white text-slate-700 border border-indigo-200 text-[10px] font-black flex items-center justify-center cursor-pointer"
                                  >
                                    +
                                  </button>
                                  {cardCircleOverride && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setMultiFrameCircleOverrides((prev) => {
                                          const copy = { ...prev };
                                          delete copy[offsetKey];
                                          return copy;
                                        })
                                      }
                                      title="Đặt lại vị trí ảnh tròn mặc định"
                                      className="w-4 h-4 rounded bg-indigo-100 hover:bg-indigo-600 hover:text-white text-indigo-700 text-[9px] font-black flex items-center justify-center cursor-pointer"
                                    >
                                      ↺
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Nút Đảo ảnh ngẫu nhiên từ kho, Copy & Tải nhanh từng khung Story */}
                          <div className="flex items-center justify-between gap-1 mt-1.5 pt-1 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() =>
                                handleRandomizeSingleFrame(offsetKey, item.preset.slots.length)
                              }
                              className="px-1.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[9px] font-extrabold cursor-pointer flex items-center gap-0.5 shrink-0"
                              title={`Đảo bộ ảnh ngẫu nhiên khác từ Kho Tự Ghép cho Story #${idx + 1} (Đang ghép ảnh: ${usedPhotoIndices.map((i) => `#${i + 1}`).join(', ')})`}
                            >
                              <Shuffle className="w-2.5 h-2.5 text-indigo-700" />
                              <span>{usedPhotoIndices.map((i) => `#${i + 1}`).join('•')}</span>
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                void handleQuickDownloadVariation(
                                  item.preset,
                                  item.ratio,
                                  variationSlots,
                                  'copy',
                                  cardCircleMap,
                                  offsetKey
                                )
                              }
                              className="flex-1 py-1 px-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold flex items-center justify-center gap-0.5 cursor-pointer"
                              title="Copy ảnh Story 9:16 này vào Clipboard"
                            >
                              <Copy className="w-2.5 h-2.5" />
                              <span>Copy</span>
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                void handleQuickDownloadVariation(
                                  item.preset,
                                  item.ratio,
                                  variationSlots,
                                  'download',
                                  cardCircleMap,
                                  offsetKey
                                )
                              }
                              className="flex-1 py-1 px-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold flex items-center justify-center gap-0.5 cursor-pointer"
                              title="Tải ảnh Story 9:16 PNG về máy"
                            >
                              <Download className="w-2.5 h-2.5" />
                              <span>Tải</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
          )}

          {(studioSectionFilter === 'all' || studioSectionFilter === 'step3_editor') && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* CỘT TRÁI & GIỮA (8 COL): KHUNG CANVAS + BỘ CHỌN PRESET */}
            <div className="lg:col-span-8 space-y-4">
              {/* Thanh tải ảnh & danh sách ảnh gốc */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-rose-600" />
                      Ảnh nguồn ({uploadedPhotos.length} ảnh)
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      (Bấm vào ảnh để gán vào ô đang chọn, hoặc bấm Đảo Ảnh để đổi vị trí)
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleShuffleMainSlots}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 hover:text-rose-800 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                    >
                      <Shuffle className="w-3 h-3" />
                      <span>Đảo vị trí ảnh</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadedPhotos(SAMPLE_STUDIO_IMAGES)}
                      className="text-[11px] font-bold text-slate-600 hover:text-rose-700 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                    >
                      Dùng 4 ảnh mẫu
                    </button>
                    <label className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-2xs transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm ảnh</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    {uploadedPhotos.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Xóa toàn bộ ảnh đang tải lên?')) {
                            setUploadedPhotos([]);
                            setSlotAssignments({});
                            setExtractedArticleInfo(null);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Xóa tất cả ảnh"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Dải ảnh thumbnails cuộn ngang */}
                <div className="flex items-center space-x-2.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin">
                  {uploadedPhotos.map((photo, idx) => (
                    <div
                      key={idx}
                      className="relative group shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 border-slate-200 hover:border-rose-500 shadow-2xs transition-all"
                    >
                      <img
                        src={photo}
                        alt={`Photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-1">
                        <button
                          type="button"
                          onClick={() => {
                            const targetSlot = activeSlotId !== null ? activeSlotId : 0;
                            setSlotAssignments((prev) => ({ ...prev, [targetSlot]: photo }));
                          }}
                          className="p-1 rounded bg-white text-slate-800 text-[10px] font-black hover:bg-rose-600 hover:text-white cursor-pointer"
                          title="Gán vào ô đang chọn"
                        >
                          Gán
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadedPhotos((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          className="p-1 rounded bg-red-600 text-white hover:bg-red-700 cursor-pointer"
                          title="Xóa ảnh"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[9px] px-1 rounded font-bold">
                        #{idx + 1}
                      </span>
                    </div>
                  ))}

                  {uploadedPhotos.length === 0 && (
                    <div className="w-full py-4 text-center text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                      Chưa có ảnh nào. Hãy dán link bài viết web ở trên hoặc bấm &quot;Thêm ảnh&quot; để bắt đầu!
                    </div>
                  )}
                </div>
              </div>

              {/* BỘ CHỌN PRESET BỐ CỤC (8 MẪU HAY DÙNG NHẤT & KHO 41 MẪU) */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4">
                <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <LayoutGrid className="w-3.5 h-3.5 text-rose-600" />
                      Mẫu bố cục ({filteredPresets.length}/{COLLAGE_PRESETS.length} mẫu)
                    </span>
                    <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                      {activePreset.name}
                    </span>
                  </div>

                  {/* Filter tags */}
                  <div className="flex items-center space-x-1 overflow-x-auto text-xs font-bold">
                    {[
                      { id: 'favorites', label: `⭐ 8 Mẫu Hay Dùng (${favoritePresetIds.length}/8)` },
                      { id: 'all', label: `Tất cả (${COLLAGE_PRESETS.length})` },
                      { id: 'story', label: 'Story FB' },
                      { id: '2-photo', label: '2 Ảnh' },
                      { id: '3-photo', label: '3 Ảnh' },
                      { id: '4-photo', label: '4 Ảnh' },
                      { id: 'circle', label: 'Khung Tròn' },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategoryFilter(cat.id)}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                          categoryFilter === cat.id
                            ? cat.id === 'favorites'
                              ? 'bg-amber-500 text-white shadow-2xs'
                              : 'bg-rose-600 text-white shadow-2xs'
                            : cat.id === 'favorites'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Gợi ý nhanh cách chọn 8 mẫu hay dùng */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 px-2.5 py-1.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900">
                  <div className="flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                    <span>
                      {categoryFilter === 'favorites' ? (
                        <>
                          Đang hiển thị <b>8 mẫu phổ biến bạn hay dùng nhất</b>. Muốn đổi mẫu khác, hãy bấm sang tab{' '}
                          <button
                            type="button"
                            onClick={() => setCategoryFilter('all')}
                            className="font-black underline text-rose-700 cursor-pointer"
                          >
                            Tất cả (41)
                          </button>{' '}
                          rồi bấm nút <b>⭐ Ghim</b> trên mẫu bạn thích!
                        </>
                      ) : (
                        <>
                          Bấm nút <b>⭐ Ghim</b> ở góc phải từng mẫu bên dưới để đưa vào <b>8 mẫu phổ biến hay dùng nhất</b> của bạn.
                        </>
                      )}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetDefaultFavorites}
                    className="text-[10px] font-bold text-amber-800 hover:text-amber-950 underline shrink-0 cursor-pointer"
                  >
                    Đặt lại 8 mẫu mặc định
                  </button>
                </div>

                {/* Lưới danh sách mẫu với preview trực quan + nút ⭐ Ghim vào 8 mẫu hay dùng */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[275px] overflow-y-auto p-1 scrollbar-thin">
                  {filteredPresets.map((preset) => {
                    const isSelected = preset.id === selectedPresetId;
                    const favIndex = favoritePresetIds.indexOf(preset.id);
                    const isFav = favIndex !== -1;

                    return (
                      <div
                        key={preset.id}
                        onClick={() => setSelectedPresetId(preset.id)}
                        className={`relative flex flex-col p-2.5 rounded-xl border text-left transition-all cursor-pointer group ${
                          isSelected
                            ? 'border-rose-600 bg-rose-50/70 shadow-xs ring-2 ring-rose-500/20'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {/* Nút Ghim / Bỏ ghim khỏi 8 mẫu hay dùng nhất */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFavoritePreset(preset.id);
                          }}
                          title={
                            isFav
                              ? `Đang là mẫu hay dùng #${favIndex + 1} (Bấm để bỏ khỏi 8 mẫu)`
                              : 'Bấm để thêm vào 8 mẫu phổ biến hay dùng nhất'
                          }
                          className={`absolute top-3.5 right-3.5 z-20 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black shadow-xs transition-all cursor-pointer ${
                            isFav
                              ? 'bg-amber-400 text-slate-950 border border-amber-500'
                              : 'bg-white/90 text-slate-500 hover:text-amber-600 hover:bg-amber-50 border border-slate-200'
                          }`}
                        >
                          <Star
                            className={`w-2.5 h-2.5 ${
                              isFav ? 'fill-slate-950 text-slate-950' : 'text-amber-500'
                            }`}
                          />
                          <span>{isFav ? `#${favIndex + 1}` : 'Ghim'}</span>
                        </button>

                        {/* Mini visual diagram of slots */}
                        <div className="w-full aspect-[4/3] bg-slate-100 rounded-lg relative overflow-hidden mb-2 border border-slate-200/80">
                          {preset.slots.map((s, idx) => (
                            <div
                              key={idx}
                              style={{
                                left: `${s.x}%`,
                                top: `${s.y}%`,
                                width: `${s.width}%`,
                                height: `${s.height}%`,
                                borderRadius: s.shape === 'circle' ? '9999px' : '3px',
                                zIndex: s.zIndex || 1,
                                border:
                                  s.shape === 'circle'
                                    ? '2px solid white'
                                    : '1px solid rgba(255,255,255,0.7)',
                              }}
                              className={`absolute ${
                                s.shape === 'circle'
                                  ? 'bg-rose-500 shadow-sm'
                                  : idx % 2 === 0
                                  ? 'bg-slate-300'
                                  : 'bg-slate-400'
                              }`}
                            />
                          ))}
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-slate-800 line-clamp-1 group-hover:text-rose-700">
                            {preset.name}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1 mt-1 text-[10px] text-slate-500 font-semibold">
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                            {preset.photoCount} ảnh
                          </span>
                          {preset.recommendedRatio && (
                            <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700">
                              {preset.recommendedRatio}
                            </span>
                          )}
                          {preset.hasCircleAccent && (
                            <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 font-bold">
                              ● PiP
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* KHUNG GHÉP ẢNH TƯƠNG TÁC (INTERACTIVE COLLAGE PREVIEW) */}
              <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 sm:p-6 flex flex-col items-center justify-center relative overflow-hidden min-h-[460px]">
                {/* Canvas header controls */}
                <div className="w-full flex flex-wrap items-center justify-between gap-2 text-xs text-white/80 mb-3 px-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white">Xem trước bố cục:</span>
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-[11px]">
                      {activeRatio.id} ({activeRatio.exportWidth}x{activeRatio.exportHeight})
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-[11px]">
                    <span>Kéo rê ảnh trong ô để chỉnh vị trí</span>
                    {activeSlotId !== null && (
                      <span className="text-rose-400 font-bold">
                        (Đang chọn Ô #{activeSlotId + 1})
                      </span>
                    )}
                  </div>
                </div>

                {/* Thanh điều khiển vị trí & kích thước Vòng Tròn trên Bàn Chỉnh Sửa Lớn */}
                {activePreset.slots.some((s) => s.shape === 'circle') && (
                  <div className="w-full mb-3 p-2.5 rounded-xl bg-slate-800/95 border border-amber-500/40 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-black text-amber-300 flex items-center gap-1">
                        <Move className="w-3.5 h-3.5" />
                        <span>Ảnh Tròn:</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setCircleDragMode('move_circle')}
                        className={`px-2 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                          circleDragMode === 'move_circle'
                            ? 'bg-amber-500 text-slate-950 shadow-2xs'
                            : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                        }`}
                        title="Khi kéo chuột vào hình tròn sẽ di chuyển cả khung tròn tới vị trí khác"
                      >
                        ✥ Kéo di chuyển khung tròn
                      </button>
                      <button
                        type="button"
                        onClick={() => setCircleDragMode('pan_photo')}
                        className={`px-2 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                          circleDragMode === 'pan_photo'
                            ? 'bg-rose-600 text-white shadow-2xs'
                            : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                        }`}
                        title="Khi kéo chuột vào hình tròn sẽ dịch chuyển tâm bức ảnh bên trong hình tròn"
                      >
                        🔍 Kéo chỉnh tâm ảnh trong vòng tròn
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                      {activePreset.slots
                        .filter((s) => s.shape === 'circle')
                        .map((circleSlot) => {
                          const curOverride = mainCircleOverrides[circleSlot.id] || {
                            dx: 0,
                            dy: 0,
                            sizeScale: 1,
                          };
                          const ratioAspect =
                            activeRatio.exportWidth / activeRatio.exportHeight;
                          return (
                            <React.Fragment key={circleSlot.id}>
                              {(
                                [
                                  { pos: 'top_left', label: '↖ Trái Trên' },
                                  { pos: 'top_right', label: '↗ Phải Trên' },
                                  { pos: 'bottom_left', label: '↙ Trái Dưới' },
                                  { pos: 'bottom_right', label: '↘ Phải Dưới' },
                                  { pos: 'bottom_center', label: '⬇ Giữa Dưới' },
                                  { pos: 'center', label: '⏺ Giữa' },
                                ] as const
                              ).map((b) => (
                                <button
                                  key={b.pos}
                                  type="button"
                                  onClick={() =>
                                    setMainCircleOverrides((prev) => ({
                                      ...prev,
                                      [circleSlot.id]: computeSnapCircleOverride(
                                        circleSlot,
                                        ratioAspect,
                                        b.pos,
                                        curOverride.sizeScale
                                      ),
                                    }))
                                  }
                                  className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-amber-500 hover:text-slate-950 text-slate-100 text-[10px] font-bold cursor-pointer transition-colors"
                                >
                                  {b.label}
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() =>
                                  setMainCircleOverrides((prev) => ({
                                    ...prev,
                                    [circleSlot.id]: {
                                      ...curOverride,
                                      sizeScale: Math.max(
                                        0.55,
                                        Number((curOverride.sizeScale - 0.1).toFixed(2))
                                      ),
                                    },
                                  }))
                                }
                                className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-amber-300 text-[10px] font-black cursor-pointer"
                                title="Thu nhỏ vòng tròn"
                              >
                                Cỡ -
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setMainCircleOverrides((prev) => ({
                                    ...prev,
                                    [circleSlot.id]: {
                                      ...curOverride,
                                      sizeScale: Math.min(
                                        1.35,
                                        Number((curOverride.sizeScale + 0.1).toFixed(2))
                                      ),
                                    },
                                  }))
                                }
                                className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-amber-300 text-[10px] font-black cursor-pointer"
                                title="Phóng to vòng tròn"
                              >
                                Cỡ +
                              </button>
                              {mainCircleOverrides[circleSlot.id] && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setMainCircleOverrides((prev) => {
                                      const copy = { ...prev };
                                      delete copy[circleSlot.id];
                                      return copy;
                                    })
                                  }
                                  className="px-1.5 py-0.5 rounded bg-rose-600/80 hover:bg-rose-600 text-white text-[10px] font-bold cursor-pointer"
                                >
                                  ↺ Mặc định
                                </button>
                              )}
                            </React.Fragment>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* CONTAINER GIỮ TỶ LỆ CHUẨN */}
                <div
                  style={{
                    aspectRatio: `${activeRatio.aspect}`,
                    background: selectedBackground.value,
                    padding: `${padding}px`,
                    gap: `${gap}px`,
                  }}
                  className="w-full max-w-[480px] max-h-[620px] rounded-2xl relative shadow-2xl overflow-hidden transition-all select-none"
                >
                  {(() => {
                    const mainStoryInfo = resolveStoryHeaderAndSlots(
                      activePreset,
                      `main-${activePreset.id}`
                    );
                    if (!mainStoryInfo.isHeaderActive || mainStoryInfo.headerHeightPercent <= 0) {
                      return null;
                    }
                    return (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        style={{
                          left: `calc(0% + ${gap / 2}px)`,
                          top: `calc(0% + ${gap / 2}px)`,
                          width: `calc(100% - ${gap}px)`,
                          height: `calc(${mainStoryInfo.headerHeightPercent}% - ${gap}px)`,
                          backgroundColor: mainStoryInfo.themeColors.bg,
                          borderBottom: `1px solid ${mainStoryInfo.themeColors.border}`,
                          borderRadius: `${borderRadius}px`,
                          zIndex: 30,
                        }}
                        className="absolute overflow-hidden flex flex-col justify-center px-3 py-2"
                      >
                        <textarea
                          value={mainStoryInfo.resolvedText}
                          onChange={(e) => {
                            setStoryTopText(e.target.value);
                          }}
                          placeholder="✍️ Nhập chữ tiêu đề phần trắng phía trên của Story..."
                          rows={3}
                          style={{
                            color: mainStoryInfo.themeColors.text,
                            fontSize: `${Math.max(12, Math.min(24, Math.round(16 * storyTopFontScale)))}px`,
                            lineHeight: '1.25',
                          }}
                          className="w-full h-full bg-transparent resize-none border-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded font-black text-center flex items-center justify-center overflow-hidden p-1 cursor-text select-text"
                        />
                      </div>
                    );
                  })()}

                  {/* RENDER CÁC Ô ẢNH THEO TỶ LỆ PHẦN TRĂM */}
                  {resolveStoryHeaderAndSlots(
                    activePreset,
                    `main-${activePreset.id}`
                  ).adjustedSlots.map((slot) => {
                    const assignedPhoto = slotAssignments[slot.id];
                    const transform = getSlotTransform(slot.id);
                    const isSelected = activeSlotId === slot.id;
                    const isCircle = slot.shape === 'circle';
                    const eff = getEffectiveSlotBounds(
                      slot,
                      activeRatio.exportWidth / activeRatio.exportHeight,
                      isCircle ? mainCircleOverrides[slot.id] : undefined
                    );

                    return (
                      <div
                        key={slot.id}
                        onClick={() => setActiveSlotId(slot.id)}
                        onMouseDown={(e) => {
                          if (isCircle && circleDragMode === 'move_circle') {
                            setActiveSlotId(slot.id);
                            handleStartMainCircleDrag(e, slot.id);
                            return;
                          }
                          setDraggingSlot(slot.id);
                          setDragStartPos({ x: e.clientX, y: e.clientY });
                        }}
                        onMouseMove={(e) => {
                          if (isCircle && circleDragMode === 'move_circle') return;
                          if (draggingSlot === slot.id && dragStartPos) {
                            const deltaX = (e.clientX - dragStartPos.x) / 3;
                            const deltaY = (e.clientY - dragStartPos.y) / 3;
                            updateSlotTransform(slot.id, {
                              panX: Math.max(-60, Math.min(60, transform.panX + deltaX)),
                              panY: Math.max(-60, Math.min(60, transform.panY + deltaY)),
                            });
                            setDragStartPos({ x: e.clientX, y: e.clientY });
                          }
                        }}
                        onMouseUp={() => setDraggingSlot(null)}
                        onMouseLeave={() => setDraggingSlot(null)}
                        style={{
                          left: `calc(${eff.x}% + ${gap / 2}px)`,
                          top: `calc(${eff.y}% + ${gap / 2}px)`,
                          width: `calc(${eff.width}% - ${gap}px)`,
                          height: `calc(${eff.height}% - ${gap}px)`,
                          borderRadius: isCircle ? '9999px' : `${borderRadius}px`,
                          zIndex: isCircle ? 25 : slot.zIndex || 1,
                          border: isCircle
                            ? `${slot.borderWidth || 4}px solid ${slot.borderColor || '#FFFFFF'}`
                            : isSelected
                            ? '2px solid #e11d48'
                            : 'none',
                          boxShadow: isCircle ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
                        }}
                        className="absolute overflow-hidden cursor-move group transition-shadow"
                      >
                        {assignedPhoto ? (
                          <div className="w-full h-full relative">
                            <img
                              src={assignedPhoto}
                              alt={`Slot ${slot.id}`}
                              draggable={false}
                              style={{
                                transform: `scale(${transform.scale}) translate(${transform.panX}%, ${transform.panY}%) rotate(${transform.rotate}deg)`,
                                transition:
                                  draggingSlot === slot.id ? 'none' : 'transform 0.15s ease-out',
                              }}
                              className="w-full h-full object-cover pointer-events-none select-none"
                            />

                            {/* Quick overlay actions on hover */}
                            <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateSlotTransform(slot.id, {
                                    scale: Math.min(3, transform.scale + 0.15),
                                  });
                                }}
                                className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-slate-800 shadow cursor-pointer"
                                title="Phóng to ảnh"
                              >
                                <ZoomIn className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateSlotTransform(slot.id, {
                                    scale: Math.max(1, transform.scale - 0.15),
                                  });
                                }}
                                className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-slate-800 shadow cursor-pointer"
                                title="Thu nhỏ ảnh"
                              >
                                <ZoomOut className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateSlotTransform(slot.id, {
                                    rotate: (transform.rotate + 90) % 360,
                                  });
                                }}
                                className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-slate-800 shadow cursor-pointer"
                                title="Xoay 90 độ"
                              >
                                <RotateCw className="w-3.5 h-3.5" />
                              </button>
                              {uploadedPhotos.length > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const curIdx = uploadedPhotos.indexOf(assignedPhoto);
                                    const nextPhoto =
                                      uploadedPhotos[(curIdx + 1) % uploadedPhotos.length];
                                    setSlotAssignments((prev) => ({
                                      ...prev,
                                      [slot.id]: nextPhoto,
                                    }));
                                  }}
                                  className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-rose-700 shadow cursor-pointer"
                                  title="Đổi sang ảnh tiếp theo trong bài"
                                >
                                  <Shuffle className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSlotAssignments((prev) => ({ ...prev, [slot.id]: '' }));
                                }}
                                className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow cursor-pointer"
                                title="Xóa ảnh khỏi ô"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full bg-slate-200/80 hover:bg-slate-300/80 flex flex-col items-center justify-center text-slate-500 cursor-pointer p-2">
                            <Plus className="w-5 h-5 text-slate-400 group-hover:text-rose-600 transition-colors" />
                            <span className="text-[10px] font-bold mt-1 text-center">
                              Chọn ảnh ô #{slot.id + 1}
                            </span>
                          </div>
                        )}

                        {/* Number badge */}
                        <span className="absolute top-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1 rounded pointer-events-none">
                          #{slot.id + 1}
                        </span>
                      </div>
                    );
                  })}

                  {/* OVERLAY WATERMARK / EMBOSSED 3D COPYRIGHT LOGO */}
                  {showWatermark && watermarkText.trim() && (
                    <div
                      style={{
                        opacity: Math.max(0.15, Math.min(1, watermarkOpacity / 100)),
                        ...(watermarkPosition === 'center'
                          ? {
                              top: '50%',
                              left: '50%',
                              transform: `translate(-50%, -50%) ${
                                watermarkStyle === 'diagonal_stamp' ? 'rotate(-18deg)' : ''
                              }`,
                            }
                          : watermarkPosition === 'top'
                          ? {
                              top: '9%',
                              left: '50%',
                              transform: `translate(-50%, -50%) ${
                                watermarkStyle === 'diagonal_stamp' ? 'rotate(-18deg)' : ''
                              }`,
                            }
                          : watermarkPosition === 'bottom'
                          ? {
                              top: '91%',
                              left: '50%',
                              transform: `translate(-50%, -50%) ${
                                watermarkStyle === 'diagonal_stamp' ? 'rotate(-18deg)' : ''
                              }`,
                            }
                          : watermarkPosition === 'bottom_right'
                          ? {
                              bottom: '4.5%',
                              right: '4.5%',
                              transform: watermarkStyle === 'diagonal_stamp' ? 'rotate(-18deg)' : 'none',
                            }
                          : watermarkPosition === 'bottom_left'
                          ? {
                              bottom: '4.5%',
                              left: '4.5%',
                              transform: watermarkStyle === 'diagonal_stamp' ? 'rotate(-18deg)' : 'none',
                            }
                          : {
                              top: '4.5%',
                              right: '4.5%',
                              transform: watermarkStyle === 'diagonal_stamp' ? 'rotate(-18deg)' : 'none',
                            }),
                      }}
                      className="absolute z-30 pointer-events-none select-none transition-all"
                    >
                      <div
                        style={{
                          color: watermarkTextColor,
                          fontSize: `${Math.round((watermarkFontSize / 1080) * 420)}px`,
                          backgroundColor:
                            watermarkStyle === 'solid_banner'
                              ? watermarkBgColor
                              : watermarkStyle === 'glass_badge'
                              ? 'rgba(15, 23, 42, 0.5)'
                              : 'transparent',
                          backdropFilter: watermarkStyle === 'glass_badge' ? 'blur(4px)' : 'none',
                          border:
                            watermarkStyle === 'diagonal_stamp'
                              ? `2px solid ${watermarkTextColor}`
                              : watermarkStyle === 'glass_badge'
                              ? '1.5px solid rgba(255, 255, 255, 0.65)'
                              : 'none',
                          textShadow:
                            watermarkStyle === 'solid_banner'
                              ? 'none'
                              : '-1px -1px 0px rgba(255,255,255,0.85), 1.5px 1.5px 0px rgba(0,0,0,0.75), 0px 2px 6px rgba(0,0,0,0.6)',
                          WebkitTextStroke:
                            watermarkStyle === 'embossed_logo' || watermarkStyle === 'diagonal_stamp'
                              ? '0.6px rgba(0,0,0,0.45)'
                              : 'none',
                        }}
                        className={`px-3.5 py-1.5 font-black tracking-wider whitespace-nowrap text-center ${
                          watermarkStyle === 'glass_badge' ? 'rounded-full shadow-lg' : 'rounded-lg'
                        }`}
                      >
                        {watermarkText}
                      </div>
                    </div>
                  )}

                  {/* OVERLAY NHÃN GÓC CUỐI ẢNH BÊN PHẢI ("Full Comments 👇") */}
                  {showCornerCta && cornerCtaText.trim() && (
                    <div
                      style={{
                        bottom: '3.2%',
                        ...(cornerCtaPosition === 'bottom_right'
                          ? { right: '3.2%' }
                          : cornerCtaPosition === 'bottom_left'
                          ? { left: '3.2%' }
                          : { left: '50%', transform: 'translateX(-50%)' }),
                      }}
                      className="absolute z-30 pointer-events-none select-none transition-all"
                    >
                      <div
                        style={{
                          fontSize: `${Math.round((cornerCtaFontSize / 1080) * 420)}px`,
                          backgroundColor: 'rgba(10, 10, 12, 0.86)',
                          border: '1.5px solid rgba(255, 255, 255, 0.25)',
                          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.5)',
                        }}
                        className="px-3.5 py-1 rounded-full text-white font-extrabold tracking-tight whitespace-nowrap text-center"
                      >
                        {cornerCtaText}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CỘT PHẢI (4 COL): THANH ĐIỀU CHỈNH THÔNG SỐ & XUẤT ẢNH */}
            <div className="lg:col-span-4 space-y-4">
              {/* THAO TÁC XUẤT & TẢI ẢNH (QUAN TRỌNG NHẤT) */}
              <div className="bg-gradient-to-br from-rose-500 via-rose-600 to-pink-600 rounded-2xl p-5 text-white shadow-lg shadow-rose-600/20">
                <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2 mb-1">
                  <Download className="w-4 h-4" />
                  Xuất & Tải Ảnh Thành Phẩm
                </h3>
                <p className="text-xs text-rose-100 mb-4">
                  Độ phân giải siêu nét (Full HD / 2K), tối ưu hiển thị Facebook & TikTok.
                </p>

                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={() => handleDownloadImage('png')}
                    className="w-full py-2.5 px-4 rounded-xl font-black text-xs bg-white text-rose-700 hover:bg-rose-50 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 shadow cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tải Ảnh PNG (Nét Căng Chuẩn)</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={() => handleDownloadImage('jpeg')}
                      className="py-2 px-3 rounded-xl font-bold text-xs bg-rose-700/80 hover:bg-rose-700 text-white border border-rose-400/40 transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải JPG Nhẹ</span>
                    </button>
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={handleCopyImage}
                      className="py-2 px-3 rounded-xl font-bold text-xs bg-rose-700/80 hover:bg-rose-700 text-white border border-rose-400/40 transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                      title="Sao chép ảnh vào clipboard để dán Ctrl+V ngay"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Ảnh</span>
                    </button>
                  </div>

                  {currentWorkingTask && (
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={handleSaveToTask}
                      className="w-full mt-2 py-2.5 px-4 rounded-xl font-black text-xs bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white transition-all flex items-center justify-center space-x-2 shadow cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Lưu Vào Bài: {currentWorkingTask.title.slice(0, 18)}...</span>
                    </button>
                  )}
                </div>
              </div>

              {/* BẢNG TÙY CHỈNH THÔNG SỐ CÓ MENU KHOA HỌC 3 TAB */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-4">
                {/* Thanh Menu 3 Tab Tùy Chỉnh Khoa Học */}
                <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setEditorSettingsTab('logo_cta')}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer text-center truncate ${
                      editorSettingsTab === 'logo_cta'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'text-slate-700 hover:bg-white'
                    }`}
                  >
                    🏷️ Logo & Nhãn
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorSettingsTab('ratio_border')}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer text-center truncate ${
                      editorSettingsTab === 'ratio_border'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'text-slate-700 hover:bg-white'
                    }`}
                  >
                    📐 Khung & Nền
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorSettingsTab('all')}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer text-center truncate ${
                      editorSettingsTab === 'all'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-700 hover:bg-white'
                    }`}
                  >
                    ⚙️ Hiện Tất Cả
                  </button>
                </div>

                {/* 1. TỶ LỆ KHUNG HÌNH */}
                {(editorSettingsTab === 'ratio_border' || editorSettingsTab === 'all') && (
                <div>
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <Smartphone className="w-3.5 h-3.5 text-rose-600" />
                    Tỷ lệ khung hình
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {COLLAGE_RATIOS.map((ratio) => (
                      <button
                        key={ratio.id}
                        type="button"
                        onClick={() => setSelectedRatioId(ratio.id)}
                        className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                          selectedRatioId === ratio.id
                            ? 'border-rose-600 bg-rose-50/70 text-rose-900 font-bold ring-1 ring-rose-500'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="text-xs font-black">{ratio.label}</div>
                        <div className="text-[10px] text-slate-500 font-medium">{ratio.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>
                )}

                {/* 2. VIỀN & KHOẢNG CÁCH */}
                {(editorSettingsTab === 'ratio_border' || editorSettingsTab === 'all') && (
                <>
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-rose-600" />
                    Viền & Bo Góc
                  </label>

                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Viền ngoài (Padding)</span>
                      <span className="font-bold">{padding}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="28"
                      value={padding}
                      onChange={(e) => setPadding(Number(e.target.value))}
                      className="w-full accent-rose-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Khoảng cách giữa các ô (Gap)</span>
                      <span className="font-bold">{gap}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="24"
                      value={gap}
                      onChange={(e) => setGap(Number(e.target.value))}
                      className="w-full accent-rose-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Bo góc ảnh (Radius)</span>
                      <span className="font-bold">{borderRadius}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="32"
                      value={borderRadius}
                      onChange={(e) => setBorderRadius(Number(e.target.value))}
                      className="w-full accent-rose-600 cursor-pointer"
                    />
                  </div>
                </div>

                {/* 3. MÀU NỀN & GRADIENT */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-rose-600" />
                      Màu nền khung ảnh
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">
                      {selectedBackground.name}
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COLLAGE_BACKGROUNDS.map((bg, idx) => {
                      const isSelected = selectedBackground.name === bg.name;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedBackground(bg)}
                          style={{ background: bg.value }}
                          className={`w-7 h-7 rounded-lg border transition-all cursor-pointer shadow-2xs relative ${
                            isSelected
                              ? 'ring-2 ring-rose-600 ring-offset-2 scale-110 border-white'
                              : 'border-slate-300 hover:scale-105'
                          }`}
                          title={bg.name}
                        >
                          {isSelected && (
                            <Check className="w-3 h-3 text-white drop-shadow-md mx-auto" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                </>
                )}

                {/* 4. NHÃN GÓC CUỐI ẢNH BÊN PHẢI ("Full Comments 👇") */}
                {(editorSettingsTab === 'logo_cta' || editorSettingsTab === 'all') && (
                <>
                <div className="pt-2 border-t border-slate-100 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-rose-600" />
                      Nhãn Góc Phải Cuối Ảnh (Full Comments 👇)
                    </label>
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showCornerCta}
                        onChange={(e) => setShowCornerCta(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-7 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-rose-600"></div>
                    </label>
                  </div>

                  {showCornerCta && (
                    <div className="space-y-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
                      <input
                        type="text"
                        value={cornerCtaText}
                        onChange={(e) => setCornerCtaText(e.target.value)}
                        placeholder="Full Comments 👇"
                        className="w-full text-xs font-bold px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />

                      <div className="flex flex-wrap gap-1">
                        {[
                          'Full Comments 👇',
                          'Link In Comments 👇',
                          'See Full Story 👇',
                          'Xem Full Ở Comment 👇',
                        ].map((presetLabel) => (
                          <button
                            key={presetLabel}
                            type="button"
                            onClick={() => setCornerCtaText(presetLabel)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                              cornerCtaText === presetLabel
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {presetLabel}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-1 flex-1">
                          {(
                            [
                              { id: 'bottom_right', label: 'Cuối Phải (Chuẩn)' },
                              { id: 'bottom_center', label: 'Giữa Dưới' },
                              { id: 'bottom_left', label: 'Cuối Trái' },
                            ] as const
                          ).map((pos) => (
                            <button
                              key={pos.id}
                              type="button"
                              onClick={() => setCornerCtaPosition(pos.id)}
                              className={`flex-1 py-1 px-1.5 rounded-md border text-[10px] font-bold text-center transition-colors cursor-pointer ${
                                cornerCtaPosition === pos.id
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {pos.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center space-x-1 shrink-0">
                          <span className="text-[10px] text-slate-500 font-semibold">Cỡ:</span>
                          <input
                            type="number"
                            min="16"
                            max="52"
                            value={cornerCtaFontSize}
                            onChange={(e) => setCornerCtaFontSize(Number(e.target.value))}
                            className="w-12 text-xs font-bold px-1 py-0.5 bg-white border border-slate-300 rounded text-center"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. LOGO NỔI BẢN QUYỀN MỜ (EMBOSSED WATERMARK) & TIÊU ĐỀ */}
                <div className="pt-2 border-t border-slate-100 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5 text-rose-600" />
                      Logo Bản Quyền Nổi / Watermark
                    </label>
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showWatermark}
                        onChange={(e) => setShowWatermark(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-7 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-rose-600"></div>
                    </label>
                  </div>

                  {showWatermark && (
                    <div className="space-y-2.5">
                      <div>
                        <input
                          type="text"
                          value={watermarkText}
                          onChange={(e) => setWatermarkText(e.target.value)}
                          placeholder="VD: © CELEB24H.COM hoặc Tên Fanpage..."
                          className="w-full text-xs font-bold px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                        {/* Gợi ý nhanh chữ đóng dấu bản quyền */}
                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                          {[
                            '© CELEB24H.COM',
                            '© CELEB24H',
                            ...(allPageNames.slice(0, 2).map((p) => `© ${p.toUpperCase()}`)),
                            'SWIPE UP ▶',
                          ].map((sample) => (
                            <button
                              key={sample}
                              type="button"
                              onClick={() => setWatermarkText(sample)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                                watermarkText === sample
                                  ? 'bg-rose-600 text-white border-rose-600'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {sample}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Kiểu hiển thị: Logo Nổi 3D Mờ vs Kính Mờ vs Con Dấu Chéo vs Banner */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          Kiểu đóng dấu bản quyền:
                        </span>
                        <div className="grid grid-cols-2 gap-1.5 text-[11px] font-bold">
                          {[
                            { id: 'embossed_logo', label: '✨ Logo Nổi 3D Mờ' },
                            { id: 'glass_badge', label: '🛡️ Kính Mờ Bản Quyền' },
                            { id: 'diagonal_stamp', label: '🔖 Đóng Dấu Chéo Giữa' },
                            { id: 'solid_banner', label: '📢 Banner Tiêu Đề Đậm' },
                          ].map((st) => (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => setWatermarkStyle(st.id as any)}
                              className={`py-1.5 px-2 rounded-lg border text-left transition-all cursor-pointer truncate ${
                                watermarkStyle === st.id
                                  ? 'bg-rose-50 border-rose-500 text-rose-900 ring-1 ring-rose-500/30 font-black'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {st.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Vị trí đóng dấu */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          Vị trí trên khung ảnh:
                        </span>
                        <div className="grid grid-cols-3 gap-1 text-[10px] font-bold">
                          {(
                            [
                              { id: 'center', label: 'Giữa Ảnh (Chìm)' },
                              { id: 'bottom_right', label: 'Góc Dưới Phải' },
                              { id: 'bottom_left', label: 'Góc Dưới Trái' },
                              { id: 'bottom', label: 'Giữa Dưới' },
                              { id: 'top', label: 'Giữa Trên' },
                              { id: 'top_right', label: 'Góc Trên Phải' },
                            ] as const
                          ).map((pos) => (
                            <button
                              key={pos.id}
                              type="button"
                              onClick={() => setWatermarkPosition(pos.id)}
                              className={`py-1 px-1.5 rounded-md border text-center transition-colors cursor-pointer ${
                                watermarkPosition === pos.id
                                  ? 'bg-rose-100 border-rose-400 text-rose-900 font-black'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {pos.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Thanh trượt Độ Mờ / Nổi (Opacity) */}
                      <div>
                        <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                          <span>Độ rõ Logo nổi (Mờ xuyên thấu)</span>
                          <span className="font-black text-rose-700">{watermarkOpacity}%</span>
                        </div>
                        <input
                          type="range"
                          min="18"
                          max="100"
                          value={watermarkOpacity}
                          onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                          className="w-full accent-rose-600 cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[10px] text-slate-500 font-semibold">Màu chữ nổi:</span>
                          <input
                            type="color"
                            value={watermarkTextColor}
                            onChange={(e) => setWatermarkTextColor(e.target.value)}
                            className="w-6 h-6 rounded cursor-pointer border border-slate-300"
                          />
                        </div>
                        {watermarkStyle === 'solid_banner' && (
                          <div className="flex items-center space-x-1">
                            <span className="text-[10px] text-slate-500 font-semibold">Nền:</span>
                            <input
                              type="color"
                              value={watermarkBgColor.startsWith('#') ? watermarkBgColor : '#e11d48'}
                              onChange={(e) => setWatermarkBgColor(e.target.value)}
                              className="w-6 h-6 rounded cursor-pointer border border-slate-300"
                            />
                          </div>
                        )}
                        <div className="flex items-center space-x-1">
                          <span className="text-[10px] text-slate-500 font-semibold">Cỡ Logo:</span>
                          <input
                            type="number"
                            min="14"
                            max="72"
                            value={watermarkFontSize}
                            onChange={(e) => setWatermarkFontSize(Number(e.target.value))}
                            className="w-14 text-xs font-bold px-1.5 py-0.5 border border-slate-300 rounded text-center"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                </>
                )}
              </div>
            </div>
          </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* VIEW 2: PHÂN CHIA VIỆC CHO NHÂN VIÊN LÀM ẢNH */}
      {/* ==================================================== */}
      {activeSubTab === 'tasks' && (
        <div className="space-y-4">
          {/* 4 Thẻ KPI thống kê nhiệm vụ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black">
                {taskStats.total}
              </div>
              <div>
                <div className="text-xs text-slate-500 font-semibold">Tổng Nhiệm Vụ</div>
                <div className="text-base font-black text-slate-900">{taskStats.total} bài</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black">
                {taskStats.pending}
              </div>
              <div>
                <div className="text-xs text-slate-500 font-semibold">Chờ Thực Hiện</div>
                <div className="text-base font-black text-amber-800">{taskStats.pending} bài</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-black">
                {taskStats.inProgress}
              </div>
              <div>
                <div className="text-xs text-slate-500 font-semibold">Đang Làm</div>
                <div className="text-base font-black text-orange-800">{taskStats.inProgress} bài</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
                {taskStats.completed}
              </div>
              <div>
                <div className="text-xs text-slate-500 font-semibold">Đã Hoàn Thành</div>
                <div className="text-base font-black text-emerald-800">{taskStats.completed} bài</div>
              </div>
            </div>
          </div>

          {/* Thanh công cụ lọc & nút tạo nhiệm vụ mới */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Nút lọc bài của tôi */}
              <button
                type="button"
                onClick={() =>
                  setTaskFilterStaff((prev) => (prev === 'MY_TASKS' ? 'ALL' : 'MY_TASKS'))
                }
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  taskFilterStaff === 'MY_TASKS'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Bài của tôi ({taskStats.myCount})</span>
              </button>

              {/* Dropdown nhân viên */}
              <select
                value={taskFilterStaff}
                onChange={(e) => setTaskFilterStaff(e.target.value)}
                className="text-xs font-bold bg-white text-slate-800 border border-slate-300 rounded-xl py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
              >
                <option value="ALL">Tất cả nhân viên</option>
                <option value="MY_TASKS">-- Bài của tôi ({currentUser.name}) --</option>
                {availableStaffNames.map((name) => (
                  <option key={name} value={name}>
                    NV: {name}
                  </option>
                ))}
              </select>

              {/* Dropdown trạng thái */}
              <select
                value={taskFilterStatus}
                onChange={(e) => setTaskFilterStatus(e.target.value)}
                className="text-xs font-bold bg-white text-slate-800 border border-slate-300 rounded-xl py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="pending">Chờ làm</option>
                <option value="in_progress">Đang làm</option>
                <option value="review">Cần sửa</option>
                <option value="completed">Đã xong</option>
              </select>

              {/* Tìm kiếm */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={taskSearchQuery}
                  onChange={(e) => setTaskSearchQuery(e.target.value)}
                  placeholder="Tìm theo tiêu đề, page..."
                  className="pl-8 pr-3 py-1.5 text-xs font-medium border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 w-44 sm:w-56"
                />
              </div>
            </div>

            {/* Nút Giao việc mới */}
            <button
              type="button"
              onClick={() => {
                setEditingTask(null);
                setTaskWebUrlInput('');
                setTaskForm({
                  title: '',
                  pageName: allPageNames[0] || '',
                  assignedStaff: availableStaffNames[0] || currentUser.name,
                  deadline: 'Hôm nay',
                  presetId: '2-circle-bottom-right',
                  aspectRatio: '3:4',
                  referenceNote: '',
                  sampleImages: '',
                });
                setIsTaskModalOpen(true);
              }}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Giao Việc Làm Ảnh Mới</span>
            </button>
          </div>

          {/* BẢNG DANH SÁCH NHIỆM VỤ LÀM ẢNH */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-bold text-center w-12">#</th>
                    <th className="px-4 py-3 font-bold">Nhiệm Vụ & Fanpage</th>
                    <th className="px-4 py-3 font-bold">Nhân Viên Làm Ảnh</th>
                    <th className="px-4 py-3 font-bold">Mẫu Gợi Ý & Tỷ Lệ</th>
                    <th className="px-4 py-3 font-bold">Hạn Chót</th>
                    <th className="px-4 py-3 font-bold text-center">Trạng Thái</th>
                    <th className="px-4 py-3 font-bold text-center">Ảnh Thành Phẩm</th>
                    <th className="px-4 py-3 font-bold text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        Không có nhiệm vụ nào phù hợp với bộ lọc. Bấm &quot;+ Giao Việc Làm Ảnh Mới&quot; để tạo nhiệm vụ!
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((task, idx) => {
                      const isAssignedToMe =
                        task.assignedStaff.trim().toLowerCase() === currentUser.name.trim().toLowerCase();

                      return (
                        <tr
                          key={task.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isAssignedToMe ? 'bg-rose-50/25' : ''
                          }`}
                        >
                          <td className="px-4 py-3.5 text-center font-bold text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-slate-900">{task.title}</div>
                            {task.pageName && (
                              <div className="text-[11px] text-blue-600 font-semibold flex items-center gap-1 mt-0.5">
                                <FileSpreadsheet className="w-3 h-3" />
                                <span>{task.pageName}</span>
                              </div>
                            )}
                            {task.referenceNote && (
                              <div className="text-[11px] text-slate-500 mt-1 line-clamp-2 italic">
                                &quot;{task.referenceNote}&quot;
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center space-x-2">
                              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-black text-[10px]">
                                {task.assignedStaff.charAt(0)}
                              </div>
                              <span className="font-bold text-slate-800">
                                {task.assignedStaff}
                              </span>
                            </div>
                            {isAssignedToMe && (
                              <span className="inline-block mt-1 px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 text-[9px] font-black">
                                Việc của bạn
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="text-[11px] font-bold text-slate-800">
                              {task.presetId || 'Mẫu tự do'}
                            </div>
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono">
                              {task.aspectRatio || '1:1'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-bold text-slate-700">
                            {task.deadline || 'Hôm nay'}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <select
                              value={task.status}
                              onChange={(e) =>
                                onUpdateTask(task.id, {
                                  status: e.target.value as TaskStatus,
                                  updatedAt: new Date().toLocaleDateString('vi-VN'),
                                })
                              }
                              className={`text-[11px] font-black rounded-lg px-2 py-1 border focus:outline-none cursor-pointer ${
                                task.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                  : task.status === 'in_progress'
                                  ? 'bg-orange-100 text-orange-900 border-orange-300'
                                  : task.status === 'review'
                                  ? 'bg-rose-100 text-rose-900 border-rose-300'
                                  : 'bg-amber-100 text-amber-900 border-amber-300'
                              }`}
                            >
                              <option value="pending">Chờ làm</option>
                              <option value="in_progress">Đang làm</option>
                              <option value="review">Cần sửa</option>
                              <option value="completed">Đã xong</option>
                            </select>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {task.resultImageUrl ? (
                              <div className="relative group inline-block">
                                <img
                                  src={task.resultImageUrl}
                                  alt="Result"
                                  className="w-12 h-12 object-cover rounded-lg border border-slate-300 shadow-2xs"
                                />
                                <a
                                  href={task.resultImageUrl}
                                  download={`${task.title}.jpg`}
                                  className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center"
                                  title="Tải ảnh kết quả"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Chưa có</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenTaskInStudio(task)}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center space-x-1 shadow-2xs transition-colors cursor-pointer"
                                title="Mở studio ghép ảnh bài này"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>Ghép ảnh</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTask(task);
                                  setTaskWebUrlInput('');
                                  setTaskForm({
                                    title: task.title,
                                    pageName: task.pageName || '',
                                    assignedStaff: task.assignedStaff,
                                    deadline: task.deadline || '',
                                    presetId: task.presetId || '2-circle-bottom-right',
                                    aspectRatio: task.aspectRatio || '3:4',
                                    referenceNote: task.referenceNote || '',
                                    sampleImages: (task.sampleImages || []).join('\n'),
                                  });
                                  setIsTaskModalOpen(true);
                                }}
                                className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                                title="Sửa thông tin nhiệm vụ"
                              >
                                <Sliders className="w-3.5 h-3.5" />
                              </button>

                              {(currentUser.role === 'admin' || isAssignedToMe) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`Xóa nhiệm vụ "${task.title}"?`)) {
                                      onDeleteTask(task.id);
                                    }
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                  title="Xóa nhiệm vụ"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
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
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL GIAO VIỆC LÀM ẢNH MỚI / SỬA NHIỆM VỤ */}
      {/* ==================================================== */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-rose-600" />
                <span>{editingTask ? 'Chỉnh Sửa Nhiệm Vụ Làm Ảnh' : 'Giao Việc Làm Ảnh Cho Nhân Viên'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsTaskModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Hút tự động từ Link Web ngay trong Modal Giao Việc */}
            <div className="mt-3 p-3 rounded-xl bg-rose-50/70 border border-rose-200 space-y-2 text-xs">
              <label className="font-extrabold text-rose-950 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-rose-600" />
                <span>Dán link bài viết web để tự điền Tiêu đề & Ảnh trong bài:</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={taskWebUrlInput}
                  onChange={(e) => setTaskWebUrlInput(e.target.value)}
                  placeholder="https://celeb24h.com/1159..."
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                />
                <button
                  type="button"
                  disabled={isExtractingForTask || !taskWebUrlInput.trim()}
                  onClick={async () => {
                    setIsExtractingForTask(true);
                    try {
                      const res = await fetch('/api/extract-web-images', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: taskWebUrlInput.trim() }),
                      });
                      const data = await res.json();
                      if (res.ok && data.ok && Array.isArray(data.images)) {
                        const urls = data.images.map((i: any) => i.dataUrl || i.url);
                        setTaskForm((prev) => ({
                          ...prev,
                          title: prev.title || data.title || 'Ghép ảnh bài viết web',
                          sampleImages: urls.join('\n'),
                        }));
                      }
                    } catch {}
                    setIsExtractingForTask(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {isExtractingForTask ? 'Đang lấy...' : 'Lấy Ảnh Bài'}
                </button>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!taskForm.title.trim()) {
                  alert('Vui lòng nhập tên bài / chủ đề làm ảnh!');
                  return;
                }
                const sampleUrls = taskForm.sampleImages
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean);

                if (editingTask) {
                  onUpdateTask(editingTask.id, {
                    title: taskForm.title.trim(),
                    pageName: taskForm.pageName.trim(),
                    assignedStaff: taskForm.assignedStaff,
                    deadline: taskForm.deadline.trim(),
                    presetId: taskForm.presetId,
                    aspectRatio: taskForm.aspectRatio,
                    referenceNote: taskForm.referenceNote.trim(),
                    sampleImages: sampleUrls.length > 0 ? sampleUrls : editingTask.sampleImages,
                    updatedAt: new Date().toLocaleDateString('vi-VN'),
                  });
                } else {
                  const newTask: ImageTaskItem = {
                    id: `task-${Date.now()}`,
                    title: taskForm.title.trim(),
                    pageName: taskForm.pageName.trim(),
                    assignedStaff: taskForm.assignedStaff,
                    deadline: taskForm.deadline.trim() || 'Hôm nay',
                    presetId: taskForm.presetId,
                    aspectRatio: taskForm.aspectRatio,
                    referenceNote: taskForm.referenceNote.trim(),
                    sampleImages: sampleUrls.length > 0 ? sampleUrls : SAMPLE_STUDIO_IMAGES.slice(0, 2),
                    status: 'pending',
                    createdBy: currentUser.name,
                    createdAt: new Date().toLocaleDateString('vi-VN'),
                  };
                  onAddTask(newTask);
                }
                setIsTaskModalOpen(false);
              }}
              className="space-y-3.5 mt-3.5 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tiêu đề bài viết / Chủ đề làm ảnh *
                </label>
                <input
                  type="text"
                  required
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  placeholder="VD: Ghép ảnh Story FB Before/After giới thiệu phim hành động"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Giao cho nhân viên làm ảnh *
                  </label>
                  <select
                    value={taskForm.assignedStaff}
                    onChange={(e) => setTaskForm({ ...taskForm, assignedStaff: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 font-bold bg-white"
                  >
                    {availableStaffNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Thuộc Fanpage (nếu có)
                  </label>
                  <input
                    type="text"
                    value={taskForm.pageName}
                    onChange={(e) => setTaskForm({ ...taskForm, pageName: e.target.value })}
                    placeholder="VD: Action Overload Zone"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Hạn chót (Deadline)
                  </label>
                  <input
                    type="text"
                    value={taskForm.deadline}
                    onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })}
                    placeholder="VD: 15/10 hoặc 18h"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Gợi ý mẫu ghép
                  </label>
                  <select
                    value={taskForm.presetId}
                    onChange={(e) => setTaskForm({ ...taskForm, presetId: e.target.value })}
                    className="w-full px-2 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 font-medium bg-white"
                  >
                    <option value="2-circle-bottom-right">1 Nền + 1 Tròn góc</option>
                    <option value="3-circle-split-h-right">2 Ngang + 1 Tròn phải</option>
                    <option value="story-fb-before-after-classic">Story FB (Before/After)</option>
                    <option value="story-fb-headline-now-then">Story FB (Báo chí Viral)</option>
                    <option value="4-grid-2x2">Lưới 4 ô (2x2 Classic)</option>
                    <option value="2-split-v">2 Cột đôi song song</option>
                    <option value="3-top-big">1 Banner trên + 2 Dưới</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tỷ lệ khung
                  </label>
                  <select
                    value={taskForm.aspectRatio}
                    onChange={(e) => setTaskForm({ ...taskForm, aspectRatio: e.target.value })}
                    className="w-full px-2 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 font-bold bg-white"
                  >
                    <option value="3:4">3:4 Chân dung</option>
                    <option value="4:5">4:5 Dọc Feed</option>
                    <option value="9:16">9:16 Story</option>
                    <option value="1:1">1:1 Vuông</option>
                    <option value="16:9">16:9 Ngang</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Yêu cầu chi tiết / Ghi chú cho nhân viên
                </label>
                <textarea
                  rows={2}
                  value={taskForm.referenceNote}
                  onChange={(e) => setTaskForm({ ...taskForm, referenceNote: e.target.value })}
                  placeholder="VD: Ghép ảnh sắc nét, bo góc 12px, chèn tiêu đề SWIPE UP đỏ nổi bật..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Link ảnh tư liệu / ảnh mẫu (mỗi link 1 dòng)
                </label>
                <textarea
                  rows={2}
                  value={taskForm.sampleImages}
                  onChange={(e) => setTaskForm({ ...taskForm, sampleImages: e.target.value })}
                  placeholder="https://images.unsplash.com/photo-..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 font-mono text-[11px]"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black shadow cursor-pointer"
                >
                  {editingTask ? 'Cập Nhật' : 'Giao Việc Ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
