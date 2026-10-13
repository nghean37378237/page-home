import React, { useState, useRef, useEffect, useMemo } from 'react';
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

  // --- STUDIO STATE ---
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>(SAMPLE_STUDIO_IMAGES);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('story-fb-before-after-classic');
  const [selectedRatioId, setSelectedRatioId] = useState<string>('9:16');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Spacing & Styling
  const [padding, setPadding] = useState<number>(10);
  const [gap, setGap] = useState<number>(8);
  const [borderRadius, setBorderRadius] = useState<number>(12);
  const [selectedBackground, setSelectedBackground] = useState<BackgroundPreset>(COLLAGE_BACKGROUNDS[0]);

  // Watermark & Headline
  const [showWatermark, setShowWatermark] = useState<boolean>(true);
  const [watermarkText, setWatermarkText] = useState<string>('SWIPE UP ▶');
  const [watermarkPosition, setWatermarkPosition] = useState<'top' | 'center' | 'bottom'>('top');
  const [watermarkBgColor, setWatermarkBgColor] = useState<string>('rgba(225, 29, 72, 0.9)');
  const [watermarkTextColor, setWatermarkTextColor] = useState<string>('#FFFFFF');
  const [watermarkFontSize, setWatermarkFontSize] = useState<number>(24);

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
  const [taskForm, setTaskForm] = useState({
    title: '',
    pageName: '',
    assignedStaff: availableStaffNames[0] || currentUser.name,
    deadline: '',
    presetId: 'story-fb-before-after-classic',
    aspectRatio: '9:16',
    referenceNote: '',
    sampleImages: '' as string,
  });

  // Task filtering
  const [taskFilterStaff, setTaskFilterStaff] = useState<string>('ALL');
  const [taskFilterStatus, setTaskFilterStatus] = useState<string>('ALL');
  const [taskSearchQuery, setTaskSearchQuery] = useState<string>('');

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
      // Re-map photos into slots if not assigned
      setSlotAssignments((prev) => {
        const next: Record<number, string> = {};
        activePreset.slots.forEach((slot, idx) => {
          if (prev[slot.id]) {
            next[slot.id] = prev[slot.id];
          } else if (uploadedPhotos[idx]) {
            next[slot.id] = uploadedPhotos[idx];
          } else {
            next[slot.id] = uploadedPhotos[idx % uploadedPhotos.length] || '';
          }
        });
        return next;
      });
    }
  }, [selectedPresetId, activePreset]);

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
                // Automatically assign to active slot or first empty
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
          setUploadedPhotos((prev) => [...newPhotos, ...prev]);
          // Assign to slots
          setSlotAssignments((prev) => {
            const next = { ...prev };
            activePreset.slots.forEach((slot, idx) => {
              if (!next[slot.id] && newPhotos[idx]) {
                next[slot.id] = newPhotos[idx];
              }
            });
            return next;
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

  // Export high resolution canvas
  const generateCanvas = async (exportRatioScale = 2): Promise<HTMLCanvasElement> => {
    const canvas = document.createElement('canvas');
    const targetW = activeRatio.exportWidth * (exportRatioScale / 2);
    const targetH = activeRatio.exportHeight * (exportRatioScale / 2);
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2d context');

    // 1. Draw Background
    if (selectedBackground.type === 'color') {
      ctx.fillStyle = selectedBackground.value;
      ctx.fillRect(0, 0, targetW, targetH);
    } else {
      // Linear gradient approximation
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

    // Inner area for grid
    const innerW = targetW - padPx * 2;
    const innerH = targetH - padPx * 2;

    // Load images async
    const loadedImgs: Record<number, HTMLImageElement> = {};
    await Promise.all(
      activePreset.slots.map(
        (slot) =>
          new Promise<void>((resolve) => {
            const src = slotAssignments[slot.id];
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

    // Sort slots by zIndex
    const sortedSlots = [...activePreset.slots].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    for (const slot of sortedSlots) {
      const slotX = padPx + (slot.x / 100) * innerW + (gapPx / 2);
      const slotY = padPx + (slot.y / 100) * innerH + (gapPx / 2);
      const slotW = Math.max(1, (slot.width / 100) * innerW - gapPx);
      const slotH = Math.max(1, (slot.height / 100) * innerH - gapPx);

      ctx.save();

      // Shape clipping
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
        const transform = getSlotTransform(slot.id);
        const centerX = slotX + slotW / 2;
        const centerY = slotY + slotH / 2;

        ctx.translate(centerX, centerY);
        ctx.rotate((transform.rotate * Math.PI) / 180);

        // Aspect ratio cover calculation
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
        // Fallback placeholder
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(slotX, slotY, slotW, slotH);
      }
      ctx.restore();

      // Draw border for circle slots
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

    // 3. Draw Watermark / Banner
    if (showWatermark && watermarkText.trim()) {
      ctx.save();
      const scaledFontSize = Math.round((watermarkFontSize / 1080) * targetW);
      ctx.font = `bold ${scaledFontSize}px sans-serif`;

      let bannerY = targetH * 0.1;
      if (watermarkPosition === 'center') bannerY = targetH / 2;
      if (watermarkPosition === 'bottom') bannerY = targetH * 0.9;

      const textMetrics = ctx.measureText(watermarkText);
      const paddingX = scaledFontSize * 0.8;
      const paddingY = scaledFontSize * 0.4;
      const bannerW = textMetrics.width + paddingX * 2;
      const bannerH = scaledFontSize + paddingY * 2;
      const bannerX = (targetW - bannerW) / 2;

      // Draw banner background
      ctx.fillStyle = watermarkBgColor;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(bannerX, bannerY - bannerH / 2, bannerW, bannerH, 8);
        ctx.fill();
      } else {
        ctx.fillRect(bannerX, bannerY - bannerH / 2, bannerW, bannerH);
      }

      // Draw text
      ctx.fillStyle = watermarkTextColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(watermarkText, targetW / 2, bannerY);
      ctx.restore();
    }

    return canvas;
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
      // Auto assign
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
                  Bảng 9: Làm Ảnh & Ghép Ảnh
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                  lamanh.vercel.app
                </span>
                {currentWorkingTask && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                    <Clock className="w-3 h-3" />
                    <span>Đang làm: {currentWorkingTask.title.slice(0, 22)}...</span>
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Trình ghép ảnh đa bố cục Story FB, Báo Chí Viral, PiP Tròn Tâm & chia việc cho nhân viên làm ảnh.
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
              <span>Xưởng Ghép Ảnh</span>
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
                    (Kéo thả, chọn file hoặc bấm Ctrl+V để dán trực tiếp)
                  </span>
                </div>

                <div className="flex items-center space-x-2">
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
                          if (activeSlotId !== null) {
                            setSlotAssignments((prev) => ({ ...prev, [activeSlotId]: photo }));
                          }
                        }}
                        className="p-1 rounded bg-white text-slate-800 text-[10px] font-black hover:bg-rose-600 hover:text-white"
                        title="Gán vào ô đang chọn"
                      >
                        Gán
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadedPhotos((prev) => prev.filter((_, i) => i !== idx));
                        }}
                        className="p-1 rounded bg-red-600 text-white hover:bg-red-700"
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
                    Chưa có ảnh nào. Bấm &quot;Thêm ảnh&quot; hoặc &quot;Dùng 4 ảnh mẫu&quot; để bắt đầu ghép ảnh!
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
                              border: s.shape === 'circle' ? '2px solid white' : '1px solid rgba(255,255,255,0.7)',
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
                              transition: draggingSlot === slot.id ? 'none' : 'transform 0.15s ease-out',
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

                {/* OVERLAY WATERMARK / HEADLINE BANNER */}
                {showWatermark && watermarkText.trim() && (
                  <div
                    style={{
                      top:
                        watermarkPosition === 'top'
                          ? '8%'
                          : watermarkPosition === 'center'
                          ? '50%'
                          : '88%',
                      transform: 'translate(-50%, -50%)',
                    }}
                    className="absolute left-1/2 z-30 pointer-events-none select-none"
                  >
                    <div
                      style={{
                        backgroundColor: watermarkBgColor,
                        color: watermarkTextColor,
                        fontSize: `${Math.round((watermarkFontSize / 1080) * 380)}px`,
                      }}
                      className="px-3.5 py-1.5 rounded-lg font-black tracking-wide shadow-lg whitespace-nowrap text-center"
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

              {/* 4. CHỮ VIRAL & WATERMARK ĐÓNG DẤU */}
              <div className="pt-2 border-t border-slate-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-rose-600" />
                    Tiêu Đề / Watermark
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
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={watermarkText}
                      onChange={(e) => setWatermarkText(e.target.value)}
                      placeholder="Nhập tiêu đề hoặc tên Fanpage..."
                      className="w-full text-xs font-bold px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />

                    <div className="grid grid-cols-3 gap-1 text-[11px] font-bold">
                      {(['top', 'center', 'bottom'] as const).map((pos) => (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => setWatermarkPosition(pos)}
                          className={`py-1 rounded-md border text-center transition-colors cursor-pointer ${
                            watermarkPosition === pos
                              ? 'bg-rose-100 border-rose-300 text-rose-800'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {pos === 'top' ? 'Trên (Story)' : pos === 'center' ? 'Giữa (Chìm)' : 'Dưới'}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center space-x-2 pt-1">
                      <div className="flex items-center space-x-1">
                        <span className="text-[10px] text-slate-500">Màu nền:</span>
                        <input
                          type="color"
                          value={watermarkBgColor.startsWith('#') ? watermarkBgColor : '#e11d48'}
                          onChange={(e) => setWatermarkBgColor(e.target.value)}
                          className="w-6 h-6 rounded cursor-pointer border border-slate-300"
                        />
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="text-[10px] text-slate-500">Màu chữ:</span>
                        <input
                          type="color"
                          value={watermarkTextColor}
                          onChange={(e) => setWatermarkTextColor(e.target.value)}
                          className="w-6 h-6 rounded cursor-pointer border border-slate-300"
                        />
                      </div>
                      <div className="flex-1 flex items-center justify-end space-x-1">
                        <span className="text-[10px] text-slate-500">Cỡ chữ:</span>
                        <input
                          type="number"
                          min="14"
                          max="48"
                          value={watermarkFontSize}
                          onChange={(e) => setWatermarkFontSize(Number(e.target.value))}
                          className="w-12 text-xs font-bold px-1.5 py-0.5 border border-slate-300 rounded text-center"
                        />
                      </div>
                    </div>
                  </div>
                )}
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
                setTaskForm({
                  title: '',
                  pageName: allPageNames[0] || '',
                  assignedStaff: availableStaffNames[0] || currentUser.name,
                  deadline: 'Hôm nay',
                  presetId: 'story-fb-before-after-classic',
                  aspectRatio: '9:16',
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
                                  setTaskForm({
                                    title: task.title,
                                    pageName: task.pageName || '',
                                    assignedStaff: task.assignedStaff,
                                    deadline: task.deadline || '',
                                    presetId: task.presetId || 'story-fb-before-after-classic',
                                    aspectRatio: task.aspectRatio || '9:16',
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
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200">
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
              className="space-y-3.5 mt-4 text-xs"
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
                    <option value="story-fb-before-after-classic">Story FB (Before/After)</option>
                    <option value="story-fb-headline-now-then">Story FB (Báo chí Viral)</option>
                    <option value="4-grid-2x2">Lưới 4 ô (2x2 Classic)</option>
                    <option value="2-circle-bottom-right">1 Nền + 1 Tròn góc</option>
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
                    <option value="9:16">9:16 Story</option>
                    <option value="1:1">1:1 Vuông</option>
                    <option value="4:5">4:5 Dọc Feed</option>
                    <option value="3:4">3:4 Chân dung</option>
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
