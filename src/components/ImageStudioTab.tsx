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
} from 'lucide-react';

interface ImageStudioTabProps {
  currentUser: AppUser;
  availableStaffNames: string[];
  tasks: ImageTaskItem[];
  onAddTask: (task: ImageTaskItem) => Promise<void> | void;
  onUpdateTask: (taskId: string, partial: Partial<ImageTaskItem>) => Promise<void> | void;
  onDeleteTask: (taskId: string) => Promise<void> | void;
  allPageNames?: string[];
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

// Danh sách các bộ khung đa dạng được đề xuất tự động khi lấy ảnh từ bài viết web
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
    presetId: 'story-fb-before-after-classic',
    ratioId: '9:16',
    badge: 'Story FB Before/After',
  },
  {
    presetId: 'story-fb-headline-now-then',
    ratioId: '9:16',
    badge: 'Story Báo Chí Viral',
  },
  {
    presetId: '3-circle-split-v',
    ratioId: '1:1',
    badge: '2 Cột + 1 Tròn Tâm PiP',
  },
  {
    presetId: '3-top-big',
    ratioId: '4:5',
    badge: '1 Lớn Trên + 2 Dưới (4:5)',
  },
  {
    presetId: '4-grid-2x2',
    ratioId: '1:1',
    badge: 'Lưới 4 Ảnh (2x2 Vuông)',
  },
  {
    presetId: '2-split-v',
    ratioId: '4:5',
    badge: '2 Cột Song Song (4:5)',
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
}: ImageStudioTabProps) {
  // Main view mode: Studio Ghép Ảnh vs Phân Chia Việc Làm Ảnh
  const [activeSubTab, setActiveSubTab] = useState<'studio' | 'tasks'>('studio');

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
  const [exportingPresetId, setExportingPresetId] = useState<string | null>(null);

  // --- STUDIO STATE ---
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>(SAMPLE_STUDIO_IMAGES);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('2-circle-bottom-right');
  const [selectedRatioId, setSelectedRatioId] = useState<string>('3:4');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Spacing & Styling
  const [padding, setPadding] = useState<number>(10);
  const [gap, setGap] = useState<number>(8);
  const [borderRadius, setBorderRadius] = useState<number>(12);
  const [selectedBackground, setSelectedBackground] = useState<BackgroundPreset>(COLLAGE_BACKGROUNDS[0]);

  // Watermark & Copyright Embossed Logo
  const [showWatermark, setShowWatermark] = useState<boolean>(true);
  const [watermarkText, setWatermarkText] = useState<string>('© CELEB24H');
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

  // Sync slots when preset changes
  useEffect(() => {
    if (activePreset) {
      if (activePreset.recommendedRatio) {
        setSelectedRatioId(activePreset.recommendedRatio);
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

  // Hàm trích xuất toàn bộ ảnh từ Link Web và tự động ghép vào các khung
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
      const data = await res.json();
      if (!res.ok || !data.ok || !Array.isArray(data.images) || data.images.length === 0) {
        throw new Error(data.error || 'Không tìm thấy ảnh nào trong đường dẫn này!');
      }

      const extractedPhotos: string[] = data.images.map(
        (img: ExtractedWebImageItem) => img.dataUrl || img.url
      );

      setUploadedPhotos(extractedPhotos);
      setExtractedArticleInfo({
        title: data.title || 'Bài viết Web',
        sourceUrl: data.sourceUrl || targetUrl,
        siteName: data.siteName || 'Website',
        imageCount: extractedPhotos.length,
      });
      setShowMultiFrameGallery(true);
      setMultiFrameOffsets({});

      // Tự động áp dụng yêu cầu khung ghép của người dùng
      applyCustomRequirementToStudio(customRequirementText, extractedPhotos, data.title);

      setExportNotice(
        `Đã tự động lấy ${extractedPhotos.length} ảnh từ bài "${(data.title || '').slice(0, 45)}..." và ghép sẵn vào các khung!`
      );
      setTimeout(() => setExportNotice(null), 5000);
    } catch (err: any) {
      setWebExtractError(err?.message || 'Lỗi khi lấy ảnh từ link bài viết web');
    } finally {
      setIsExtractingWeb(false);
    }
  };

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

  // File Upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newPhotos: string[] = [];
    let loaded = 0;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) newPhotos.push(result);
        loaded++;
        if (loaded === files.length) {
          setUploadedPhotos((prev) => {
            const combined = [...newPhotos, ...prev];
            setSlotAssignments((oldSlots) => {
              const next = { ...oldSlots };
              activePreset.slots.forEach((slot, idx) => {
                if (newPhotos[idx]) {
                  next[slot.id] = newPhotos[idx];
                } else if (!next[slot.id] && combined[idx]) {
                  next[slot.id] = combined[idx];
                }
              });
              return next;
            });
            return combined;
          });
          setExportNotice(`Đã tải lên ${newPhotos.length} ảnh!`);
          setTimeout(() => setExportNotice(null), 3000);
        }
      };
      reader.readAsDataURL(file);
    });
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

  // Filtered preset list by category
  const filteredPresets = useMemo(() => {
    if (categoryFilter === 'all') return COLLAGE_PRESETS;
    if (categoryFilter === 'story') return COLLAGE_PRESETS.filter((p) => p.id.startsWith('story-fb'));
    if (categoryFilter === '2-photo') return COLLAGE_PRESETS.filter((p) => p.photoCount === 2);
    if (categoryFilter === '3-photo') return COLLAGE_PRESETS.filter((p) => p.photoCount === 3);
    if (categoryFilter === '4-photo') return COLLAGE_PRESETS.filter((p) => p.photoCount === 4);
    if (categoryFilter === 'circle') return COLLAGE_PRESETS.filter((p) => p.hasCircleAccent);
    return COLLAGE_PRESETS.filter((p) => p.category === categoryFilter);
  }, [categoryFilter]);

  // Danh sách các khung hiển thị trong Bảng "Ghép Đa Khung Tự Động Theo Yêu Cầu"
  const multiFrameVariations = useMemo(() => {
    let baseList = AUTO_MULTI_FRAME_IDS.map((item) => {
      const preset = COLLAGE_PRESETS.find((p) => p.id === item.presetId) || COLLAGE_PRESETS[0];
      const ratio = COLLAGE_RATIOS.find((r) => r.id === item.ratioId) || COLLAGE_RATIOS[0];
      return {
        ...item,
        preset,
        ratio,
      };
    });

    if (selectedQuickRequirement === 'circle_pip') {
      const circlePresets = COLLAGE_PRESETS.filter((p) => p.hasCircleAccent).slice(0, 8);
      baseList = circlePresets.map((preset) => ({
        presetId: preset.id,
        ratioId: preset.recommendedRatio || '3:4',
        badge: preset.name,
        preset,
        ratio:
          COLLAGE_RATIOS.find((r) => r.id === (preset.recommendedRatio || '3:4')) ||
          COLLAGE_RATIOS[3],
      }));
    } else if (selectedQuickRequirement === 'story_fb') {
      const storyPresets = COLLAGE_PRESETS.filter((p) => p.id.startsWith('story-fb')).slice(0, 8);
      baseList = storyPresets.map((preset) => ({
        presetId: preset.id,
        ratioId: '9:16',
        badge: preset.name,
        preset,
        ratio: COLLAGE_RATIOS.find((r) => r.id === '9:16') || COLLAGE_RATIOS[2],
      }));
    } else if (selectedQuickRequirement === '2_photos') {
      const p2 = COLLAGE_PRESETS.filter((p) => p.photoCount === 2).slice(0, 8);
      baseList = p2.map((preset) => ({
        presetId: preset.id,
        ratioId: preset.recommendedRatio || '3:4',
        badge: preset.name,
        preset,
        ratio:
          COLLAGE_RATIOS.find((r) => r.id === (preset.recommendedRatio || '3:4')) ||
          COLLAGE_RATIOS[3],
      }));
    } else if (selectedQuickRequirement === '3_photos') {
      const p3 = COLLAGE_PRESETS.filter((p) => p.photoCount === 3).slice(0, 8);
      baseList = p3.map((preset) => ({
        presetId: preset.id,
        ratioId: preset.recommendedRatio || '3:4',
        badge: preset.name,
        preset,
        ratio:
          COLLAGE_RATIOS.find((r) => r.id === (preset.recommendedRatio || '3:4')) ||
          COLLAGE_RATIOS[3],
      }));
    } else if (selectedQuickRequirement === '4_photos') {
      const p4 = COLLAGE_PRESETS.filter((p) => p.photoCount === 4).slice(0, 8);
      baseList = p4.map((preset) => ({
        presetId: preset.id,
        ratioId: preset.recommendedRatio || '1:1',
        badge: preset.name,
        preset,
        ratio:
          COLLAGE_RATIOS.find((r) => r.id === (preset.recommendedRatio || '1:1')) ||
          COLLAGE_RATIOS[0],
      }));
    } else if (selectedQuickRequirement === 'feed_vertical') {
      baseList = baseList.map((item) => ({
        ...item,
        ratioId: '4:5',
        ratio: COLLAGE_RATIOS.find((r) => r.id === '4:5') || COLLAGE_RATIOS[1],
      }));
    }

    return baseList;
  }, [selectedQuickRequirement]);

  // Hàm vẽ Canvas dùng chung cho cả Khung Chính và từng Khung trong Bộ Sưu Tập Đa Khung
  const generateCanvasForConfig = async (options: {
    preset: CollagePreset;
    ratio: RatioOption;
    slotPhotos: Record<number, string>;
    transforms?: Record<number, SlotTransform>;
    exportRatioScale?: number;
  }): Promise<HTMLCanvasElement> => {
    const {
      preset,
      ratio,
      slotPhotos,
      transforms = {},
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

    const loadedImgs: Record<number, HTMLImageElement> = {};
    await Promise.all(
      preset.slots.map(
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
            img.onerror = () => resolve();
            img.src = src;
          })
      )
    );

    const sortedSlots = [...preset.slots].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    for (const slot of sortedSlots) {
      const slotX = padPx + (slot.x / 100) * innerW + gapPx / 2;
      const slotY = padPx + (slot.y / 100) * innerH + gapPx / 2;
      const slotW = Math.max(1, (slot.width / 100) * innerW - gapPx);
      const slotH = Math.max(1, (slot.height / 100) * innerH - gapPx);

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

    return canvas;
  };

  // Export high resolution canvas for main editor
  const generateCanvas = async (exportRatioScale = 2): Promise<HTMLCanvasElement> => {
    return generateCanvasForConfig({
      preset: activePreset,
      ratio: activeRatio,
      slotPhotos: slotAssignments,
      transforms: slotTransforms,
      exportRatioScale,
    });
  };

  // Tải nhanh 1 khung bất kỳ từ Bộ Sưu Tập Đa Khung
  const handleQuickDownloadVariation = async (
    preset: CollagePreset,
    ratio: RatioOption,
    slotPhotos: Record<number, string>,
    mode: 'download' | 'copy'
  ) => {
    try {
      setExportingPresetId(preset.id);
      const canvas = await generateCanvasForConfig({
        preset,
        ratio,
        slotPhotos,
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
      {/* 1. Header Banner & Sub-Tab Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20 shrink-0">
              <Image className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  Bảng 9: Làm Ảnh & Tự Ghép Ảnh Từ Link Web
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                  Auto Web Collage
                </span>
                {currentWorkingTask && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                    <Clock className="w-3 h-3" />
                    <span>Đang làm: {currentWorkingTask.title.slice(0, 22)}...</span>
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Dán link bài viết web để hệ thống tự lấy toàn bộ ảnh trong bài & ghép sẵn nhiều khung (Story FB, Khung Tròn PiP, Lưới 2-3-4 ảnh) theo yêu cầu.
              </p>
            </div>
          </div>

          {/* Segmented Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 self-start md:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setActiveSubTab('studio')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'studio'
                  ? 'bg-white text-rose-700 shadow-xs ring-1 ring-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-4 h-4 text-rose-600" />
              <span>Xưởng Ghép Ảnh & Lấy Link Web</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('tasks')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'tasks'
                  ? 'bg-white text-rose-700 shadow-xs ring-1 ring-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-4 h-4 text-blue-600" />
              <span>Chia Việc Làm Ảnh</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-800 font-black">
                {tasks.length}
              </span>
            </button>
          </div>
        </div>

        {/* Thông báo thao tác / Export notification */}
        {exportNotice && (
          <div className="mt-3.5 p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center justify-between animate-fadeIn">
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
          {/* KHUNG MỚI: DÁN LINK WEB TỰ ĐỘNG HÚT ẢNH TRONG BÀI & GHÉP CÁC KHUNG THEO YÊU CẦU */}
          <div className="bg-gradient-to-r from-rose-50/90 via-white to-indigo-50/70 rounded-2xl border-2 border-rose-200/90 shadow-xs p-4 sm:p-5 space-y-3.5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                    <span>Ném Link Bài Viết Web → Tự Động Lấy Ảnh & Ghép Đa Khung</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Hỗ trợ celeb24h.com & mọi web báo
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600">
                    Dán link bài viết bất kỳ (hoặc chọn bài mới trên web), hệ thống sẽ tự bóc toàn bộ ảnh trong bài và dựng sẵn các mẫu khung theo đúng yêu cầu của bạn.
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

            {/* Hàng nhập Link Web + Yêu cầu ghép khung + Nút Thực Hiện */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
              {/* Ô nhập Link bài viết */}
              <div className="lg:col-span-5 relative">
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
              <div className="lg:col-span-5 relative">
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

              {/* Nút Lấy Ảnh & Tự Ghép */}
              <div className="lg:col-span-2 flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={isExtractingWeb}
                  onClick={() => void handleExtractImagesFromWebLink()}
                  className="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-60 whitespace-nowrap"
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
              </div>
            </div>

            {/* Các nút chọn nhanh kiểu khung theo yêu cầu */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-extrabold text-slate-600 mr-1">
                  Yêu cầu ghép nhanh:
                </span>
                {[
                  { id: 'all_frames', label: '🔥 Tất cả 8 khung đa dạng' },
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
                        // Áp dụng luôn xuống khung chính
                        if (reqItem.id === 'circle_pip') {
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
                    {showMultiFrameGallery ? 'Thu gọn bảng Đa Khung' : 'Hiện bảng Đa Khung (8 mẫu)'}
                  </button>
                </div>
              </div>
            )}

            {/* BỘ SƯU TẬP 8 KHUNG GHÉP TỰ ĐỘNG TỪ ẢNH BÀI VIẾT WEB (1 CHẠM TẢI HOẶC CHỌN) */}
            {showMultiFrameGallery && uploadedPhotos.length > 0 && (
              <div className="pt-2 border-t border-rose-200/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black text-slate-800 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-rose-600" />
                    <span>
                      Các Khung Ghép Tự Động Theo Yêu Cầu ({multiFrameVariations.length} kiểu khung khác nhau từ bộ {uploadedPhotos.length} ảnh)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      // Đảo đồng loạt vị trí ảnh cho tất cả các khung
                      setMultiFrameOffsets((prev) => {
                        const next: Record<string, number> = {};
                        multiFrameVariations.forEach((v) => {
                          next[v.preset.id] = ((prev[v.preset.id] || 0) + 1) % Math.max(1, uploadedPhotos.length);
                        });
                        return next;
                      });
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[11px] font-bold cursor-pointer shadow-2xs"
                  >
                    <Shuffle className="w-3 h-3 text-rose-600" />
                    <span>Đảo Ảnh Tất Cả Khung</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
                  {multiFrameVariations.map((item) => {
                    const offset = multiFrameOffsets[item.preset.id] || 0;
                    const variationSlots: Record<number, string> = {};
                    item.preset.slots.forEach((s, idx) => {
                      variationSlots[s.id] =
                        uploadedPhotos[(idx + offset) % Math.max(1, uploadedPhotos.length)] || '';
                    });
                    const isCurrentPreset = selectedPresetId === item.preset.id;
                    const isBusy = exportingPresetId === item.preset.id;

                    return (
                      <div
                        key={item.preset.id}
                        className={`rounded-xl border p-2 bg-white flex flex-col justify-between transition-all ${
                          isCurrentPreset
                            ? 'border-rose-600 ring-2 ring-rose-500/20 shadow-sm'
                            : 'border-slate-200 hover:border-rose-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className="text-[10px] font-extrabold text-slate-800 truncate" title={item.badge}>
                              {item.badge}
                            </span>
                            <span className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-slate-100 text-slate-600 shrink-0">
                              {item.ratio.id}
                            </span>
                          </div>

                          {/* Bản xem trước trực tiếp (Live Mini Collage) */}
                          <div
                            onClick={() => {
                              setSelectedPresetId(item.preset.id);
                              setSelectedRatioId(item.ratio.id);
                              setSlotAssignments(variationSlots);
                              setSlotTransforms({});
                            }}
                            style={{
                              aspectRatio: '3/4',
                              background: selectedBackground.value,
                            }}
                            className="w-full rounded-lg relative overflow-hidden border border-slate-200 cursor-pointer group"
                            title="Bấm để mở khung này xuống bàn chỉnh sửa lớn"
                          >
                            {item.preset.slots.map((slot) => {
                              const photoSrc = variationSlots[slot.id];
                              return (
                                <div
                                  key={slot.id}
                                  style={{
                                    left: `calc(${slot.x}% + 1.5px)`,
                                    top: `calc(${slot.y}% + 1.5px)`,
                                    width: `calc(${slot.width}% - 3px)`,
                                    height: `calc(${slot.height}% - 3px)`,
                                    borderRadius: slot.shape === 'circle' ? '9999px' : '4px',
                                    zIndex: slot.zIndex || 1,
                                    border:
                                      slot.shape === 'circle'
                                        ? '2px solid #FFFFFF'
                                        : 'none',
                                  }}
                                  className="absolute overflow-hidden bg-slate-200"
                                >
                                  {photoSrc && (
                                    <img
                                      src={photoSrc}
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                </div>
                              );
                            })}

                            {/* Hiển thị Watermark Logo Nổi Mờ trực tiếp trên từng khung nhỏ */}
                            {showWatermark && watermarkText.trim() && (
                              <div
                                style={{
                                  opacity: Math.max(0.18, Math.min(1, watermarkOpacity / 100)),
                                  ...(watermarkPosition === 'center'
                                    ? { top: '50%', left: '50%', transform: `translate(-50%, -50%) ${watermarkStyle === 'diagonal_stamp' ? 'rotate(-18deg)' : ''}` }
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

                            <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-30">
                              <span className="px-2 py-1 rounded-md bg-white text-slate-900 font-black text-[10px] shadow">
                                Chọn Khung Này
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Nút Đảo ảnh, Copy & Tải nhanh từng khung */}
                        <div className="flex items-center justify-between gap-1 mt-2 pt-1.5 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() =>
                              setMultiFrameOffsets((prev) => ({
                                ...prev,
                                [item.preset.id]:
                                  ((prev[item.preset.id] || 0) + 1) %
                                  Math.max(1, uploadedPhotos.length),
                              }))
                            }
                            className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                            title="Đảo vị trí ảnh trong khung này"
                          >
                            <Shuffle className="w-3 h-3" />
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void handleQuickDownloadVariation(
                                item.preset,
                                item.ratio,
                                variationSlots,
                                'copy'
                              )
                            }
                            className="flex-1 py-1 px-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold flex items-center justify-center gap-0.5 cursor-pointer"
                            title="Copy ảnh khung này vào Clipboard"
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
                                'download'
                              )
                            }
                            className="flex-1 py-1 px-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold flex items-center justify-center gap-0.5 cursor-pointer"
                            title="Tải ảnh PNG khung này về máy"
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
            )}
          </div>

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

              {/* BỘ CHỌN PRESET BỐ CỤC (41 MẪU TỪ LAMANH.VERCEL.APP) */}
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
                      { id: 'all', label: 'Tất cả' },
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
                            ? 'bg-rose-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lưới danh sách 41 mẫu với preview trực quan */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[260px] overflow-y-auto p-1 scrollbar-thin">
                  {filteredPresets.map((preset) => {
                    const isSelected = preset.id === selectedPresetId;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSelectedPresetId(preset.id)}
                        className={`relative flex flex-col p-2.5 rounded-xl border text-left transition-all cursor-pointer group ${
                          isSelected
                            ? 'border-rose-600 bg-rose-50/70 shadow-xs ring-2 ring-rose-500/20'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
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
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* KHUNG GHÉP ẢNH TƯƠNG TÁC (INTERACTIVE COLLAGE PREVIEW) */}
              <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 sm:p-6 flex flex-col items-center justify-center relative overflow-hidden min-h-[460px]">
                {/* Canvas header controls */}
                <div className="w-full flex items-center justify-between text-xs text-white/80 mb-3 px-1">
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
                  {/* RENDER CÁC Ô ẢNH THEO TỶ LỆ PHẦN TRĂM */}
                  {activePreset.slots.map((slot) => {
                    const assignedPhoto = slotAssignments[slot.id];
                    const transform = getSlotTransform(slot.id);
                    const isSelected = activeSlotId === slot.id;

                    return (
                      <div
                        key={slot.id}
                        onClick={() => setActiveSlotId(slot.id)}
                        onMouseDown={(e) => {
                          setDraggingSlot(slot.id);
                          setDragStartPos({ x: e.clientX, y: e.clientY });
                        }}
                        onMouseMove={(e) => {
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
                          left: `calc(${slot.x}% + ${gap / 2}px)`,
                          top: `calc(${slot.y}% + ${gap / 2}px)`,
                          width: `calc(${slot.width}% - ${gap}px)`,
                          height: `calc(${slot.height}% - ${gap}px)`,
                          borderRadius: slot.shape === 'circle' ? '9999px' : `${borderRadius}px`,
                          zIndex: slot.zIndex || 1,
                          border:
                            slot.shape === 'circle'
                              ? `${slot.borderWidth || 4}px solid ${slot.borderColor || '#FFFFFF'}`
                              : isSelected
                              ? '2px solid #e11d48'
                              : 'none',
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

              {/* BẢNG TÙY CHỈNH THÔNG SỐ (ACCORDIONS) */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-4">
                {/* 1. TỶ LỆ KHUNG HÌNH */}
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

                {/* 2. VIỀN & KHOẢNG CÁCH */}
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

                {/* 4. LOGO NỔI BẢN QUYỀN MỜ (EMBOSSED WATERMARK) & TIÊU ĐỀ */}
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
                          placeholder="VD: © CELEB24H hoặc Tên Fanpage..."
                          className="w-full text-xs font-bold px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                        {/* Gợi ý nhanh chữ đóng dấu bản quyền */}
                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                          {[
                            '© CELEB24H',
                            '© CELEB24H.COM',
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
              </div>
            </div>
          </div>
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
