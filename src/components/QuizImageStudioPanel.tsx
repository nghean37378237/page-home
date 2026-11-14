import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Download,
  Copy,
  RefreshCw,
  Upload,
  Shuffle,
  Sparkles,
  Image as ImageIcon,
  Check,
  ZoomIn,
  ZoomOut,
  Move,
  Type,
  Palette,
  Globe,
  HelpCircle,
  Tv,
  Mic,
  Star,
  Sliders,
  Trash2,
} from 'lucide-react';

export type QuizTemplateId = 'retro_tv_host' | 'retro_tv_star' | 'classic_actor_blue';

export interface QuizSlotState {
  imageUrl: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
  grayscale: boolean;
}

interface QuizImageStudioPanelProps {
  sharedPoolPhotos?: string[];
  defaultWatermarkText?: string;
}

interface QuizTemplatePreset {
  id: QuizTemplateId;
  name: string;
  subtitle: string;
  badge: string;
  previewAsset: string;
  defaultLine1Prefix: string;
  defaultLine1Highlight: string;
  defaultLine2Prefix: string;
  defaultLine2Highlight: string;
  defaultLine2Suffix: string;
  defaultAnswers: [string, string, string, string];
  leftIcon: 'mic' | 'tv_star' | 'none';
  showRightQuestionMark: boolean;
  showTvColorBars: boolean;
  numberBadgeStyle: 'retro_tv' | 'red_circle';
}

const QUIZ_TEMPLATE_PRESETS: QuizTemplatePreset[] = [
  {
    id: 'retro_tv_host',
    name: 'Mẫu 1: Retro TV Host (Micro Vàng)',
    subtitle: 'Nền xanh cổ vịt chấm bi • Micro thu âm • Thanh màu TV',
    badge: 'Giống Mẫu 1',
    previewAsset: '/assets/aistudio/inline_6af3a107b1604_800w_e6d31f39.webp',
    defaultLine1Prefix: 'WHO IS THE ',
    defaultLine1Highlight: 'TV HOST',
    defaultLine2Prefix: 'IN PHOTO ',
    defaultLine2Highlight: '#3',
    defaultLine2Suffix: '?',
    defaultAnswers: [
      'Richard Simmons',
      'Geraldo Rivera',
      'Morley Safer',
      'Bob Ross',
    ],
    leftIcon: 'mic',
    showRightQuestionMark: true,
    showTvColorBars: true,
    numberBadgeStyle: 'retro_tv',
  },
  {
    id: 'retro_tv_star',
    name: 'Mẫu 2: Retro TV Star (Tivi Vàng)',
    subtitle: 'Nền xanh cổ vịt chấm bi • Icon Tivi Ngôi Sao • Thanh màu TV',
    badge: 'Giống Mẫu 2',
    previewAsset: '/assets/aistudio/inline_6af454572eef9_800w_ef900fa8.webp',
    defaultLine1Prefix: 'WHO IS THE ',
    defaultLine1Highlight: 'TV STAR',
    defaultLine2Prefix: 'IN PHOTO ',
    defaultLine2Highlight: '#1',
    defaultLine2Suffix: '?',
    defaultAnswers: [
      'Fran Drescher',
      'Teri Hatcher',
      'Lucy Lawless',
      'Patrick Stewart',
    ],
    leftIcon: 'tv_star',
    showRightQuestionMark: true,
    showTvColorBars: true,
    numberBadgeStyle: 'retro_tv',
  },
  {
    id: 'classic_actor_blue',
    name: 'Mẫu 3: Classic Actor (Xanh Đêm & Vàng Gold)',
    subtitle: 'Nền xanh đêm sao • Khung viền Gold • Đáp án Vàng Gold nổi bật',
    badge: 'Giống Mẫu 3',
    previewAsset: '/assets/aistudio/inline_6af0c0e75ff37_800w_d1d4536a.webp',
    defaultLine1Prefix: 'WHO IS THIS',
    defaultLine1Highlight: '',
    defaultLine2Prefix: '',
    defaultLine2Highlight: 'ACTOR?',
    defaultLine2Suffix: '',
    defaultAnswers: [
      'Robert Vaughn',
      'George C. Scott',
      'Jane Fonda',
      'Laurence Olivier',
    ],
    leftIcon: 'none',
    showRightQuestionMark: false,
    showTvColorBars: false,
    numberBadgeStyle: 'red_circle',
  },
];

const DEFAULT_DEMO_PHOTOS = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80',
];

const QUICK_HEADLINE_PRESETS = [
  {
    label: 'TV HOST (#3)',
    l1Pre: 'WHO IS THE ',
    l1Hi: 'TV HOST',
    l2Pre: 'IN PHOTO ',
    l2Hi: '#3',
    l2Suf: '?',
  },
  {
    label: 'TV STAR (#1)',
    l1Pre: 'WHO IS THE ',
    l1Hi: 'TV STAR',
    l2Pre: 'IN PHOTO ',
    l2Hi: '#1',
    l2Suf: '?',
  },
  {
    label: 'WHO IS THIS ACTOR?',
    l1Pre: 'WHO IS THIS',
    l1Hi: '',
    l2Pre: '',
    l2Hi: 'ACTOR?',
    l2Suf: '',
  },
  {
    label: 'WHO IS THIS ACTRESS?',
    l1Pre: 'WHO IS THIS',
    l1Hi: '',
    l2Pre: '',
    l2Hi: 'ACTRESS?',
    l2Suf: '',
  },
  {
    label: 'SINGER (#2)',
    l1Pre: 'WHO IS THE ',
    l1Hi: 'SINGER',
    l2Pre: 'IN PHOTO ',
    l2Hi: '#2',
    l2Suf: '?',
  },
  {
    label: 'MOVIE STAR (#4)',
    l1Pre: 'WHO IS THE ',
    l1Hi: 'MOVIE STAR',
    l2Pre: 'IN PHOTO ',
    l2Hi: '#4',
    l2Suf: '?',
  },
];

// Helper vẽ hình chữ nhật bo góc trên Canvas
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// Vẽ ngôi sao 5 cánh
function drawFivePointStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes: number,
  outerRadius: number,
  innerRadius: number
) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
}

export const QuizImageStudioPanel: React.FC<QuizImageStudioPanelProps> = ({
  sharedPoolPhotos = [],
  defaultWatermarkText = '© CELEB24H.COM',
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<QuizTemplateId>('retro_tv_host');
  const [canvasRatio, setCanvasRatio] = useState<'9:16' | '4:5' | '3:4'>('9:16');

  // Headline state
  const [line1Prefix, setLine1Prefix] = useState('WHO IS THE ');
  const [line1Highlight, setLine1Highlight] = useState('TV HOST');
  const [line2Prefix, setLine2Prefix] = useState('IN PHOTO ');
  const [line2Highlight, setLine2Highlight] = useState('#3');
  const [line2Suffix, setLine2Suffix] = useState('?');

  // Visual toggles
  const [leftBannerIcon, setLeftBannerIcon] = useState<'mic' | 'tv_star' | 'none'>('mic');
  const [showRightQuestionMark, setShowRightQuestionMark] = useState(true);
  const [showTvColorBars, setShowTvColorBars] = useState(true);
  const [numberBadgeStyle, setNumberBadgeStyle] = useState<'retro_tv' | 'red_circle'>('retro_tv');
  const [showWatermark, setShowWatermark] = useState(false);
  const [watermarkText, setWatermarkText] = useState(defaultWatermarkText);

  // 4 Answers (A, B, C, D)
  const [answers, setAnswers] = useState<[string, string, string, string]>([
    'Richard Simmons',
    'Geraldo Rivera',
    'Morley Safer',
    'Bob Ross',
  ]);
  const [bulkAnswersInput, setBulkAnswersInput] = useState('');

  // 4 Photo Slots
  const [slots, setSlots] = useState<[QuizSlotState, QuizSlotState, QuizSlotState, QuizSlotState]>(() => {
    const initialUrls =
      sharedPoolPhotos.length >= 4
        ? sharedPoolPhotos.slice(0, 4)
        : [
            ...sharedPoolPhotos,
            ...DEFAULT_DEMO_PHOTOS.slice(sharedPoolPhotos.length, 4),
          ];
    return [
      { imageUrl: initialUrls[0], zoom: 1, offsetX: 0, offsetY: 0, grayscale: false },
      { imageUrl: initialUrls[1], zoom: 1, offsetX: 0, offsetY: 0, grayscale: true },
      { imageUrl: initialUrls[2], zoom: 1, offsetX: 0, offsetY: 0, grayscale: false },
      { imageUrl: initialUrls[3], zoom: 1, offsetX: 0, offsetY: 0, grayscale: false },
    ];
  });

  const [activeSlotIdx, setActiveSlotIdx] = useState<number>(0);
  const [webUrlInput, setWebUrlInput] = useState('');
  const [isFetchingWeb, setIsFetchingWeb] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showRefSampleModal, setShowRefSampleModal] = useState<string | null>(null);

  // Loaded HTMLImageElement cache for canvas
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [imageLoadTick, setImageLoadTick] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingCanvasRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Switch template preset
  const handleSelectTemplate = (preset: QuizTemplatePreset) => {
    setSelectedTemplateId(preset.id);
    setLine1Prefix(preset.defaultLine1Prefix);
    setLine1Highlight(preset.defaultLine1Highlight);
    setLine2Prefix(preset.defaultLine2Prefix);
    setLine2Highlight(preset.defaultLine2Highlight);
    setLine2Suffix(preset.defaultLine2Suffix);
    setAnswers([...preset.defaultAnswers] as [string, string, string, string]);
    setLeftBannerIcon(preset.leftIcon);
    setShowRightQuestionMark(preset.showRightQuestionMark);
    setShowTvColorBars(preset.showTvColorBars);
    setNumberBadgeStyle(preset.numberBadgeStyle);
  };

  // Load images into cache for canvas drawing
  useEffect(() => {
    slots.forEach((slot) => {
      const url = slot.imageUrl?.trim();
      if (!url || imageCacheRef.current.has(url)) return;

      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageCacheRef.current.set(url, img);
        setImageLoadTick((t) => t + 1);
      };
      img.onerror = () => {
        // Fallback without crossOrigin if needed for preview
        const fallbackImg = new window.Image();
        fallbackImg.onload = () => {
          imageCacheRef.current.set(url, fallbackImg);
          setImageLoadTick((t) => t + 1);
        };
        fallbackImg.src = url;
      };
      img.src = url;
    });
  }, [slots]);

  // Quick change photo number (#1, #2, #3, #4)
  const handleQuickPhotoNumber = (num: 1 | 2 | 3 | 4) => {
    setLine2Highlight(`#${num}`);
    if (!line2Prefix.trim()) {
      setLine2Prefix('IN PHOTO ');
      setLine2Suffix('?');
    }
  };

  // Update a single slot
  const updateSlot = (idx: number, partial: Partial<QuizSlotState>) => {
    setSlots((prev) => {
      const next = [...prev] as [QuizSlotState, QuizSlotState, QuizSlotState, QuizSlotState];
      next[idx] = { ...next[idx], ...partial };
      return next;
    });
  };

  // Upload image file for a specific slot or all 4 slots
  const handleUploadFiles = (files: FileList | null, targetSlotIdx?: number) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);

    if (typeof targetSlotIdx === 'number' && fileArray.length === 1) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = String(e.target?.result || '');
        if (result) {
          updateSlot(targetSlotIdx, { imageUrl: result, zoom: 1, offsetX: 0, offsetY: 0 });
          showToast(`Đã tải ảnh vào Ô số ${targetSlotIdx + 1}!`);
        }
      };
      reader.readAsDataURL(fileArray[0]);
      return;
    }

    // Multiple files: fill into slots 1..4 sequentially
    fileArray.slice(0, 4).forEach((file, idx) => {
      const slotIndex = typeof targetSlotIdx === 'number' ? (targetSlotIdx + idx) % 4 : idx;
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = String(e.target?.result || '');
        if (result) {
          updateSlot(slotIndex, { imageUrl: result, zoom: 1, offsetX: 0, offsetY: 0 });
        }
      };
      reader.readAsDataURL(file);
    });
    showToast(`Đã nạp ${Math.min(fileArray.length, 4)} ảnh vào khung Quiz!`);
  };

  // Pull photos from shared pool
  const handleLoadFromSharedPool = () => {
    if (!sharedPoolPhotos || sharedPoolPhotos.length === 0) {
      showToast('Kho Tự Ghép hiện chưa có ảnh nào. Hãy tải ảnh hoặc lấy từ link bài viết!');
      return;
    }
    setSlots((prev) => {
      const next = [...prev] as [QuizSlotState, QuizSlotState, QuizSlotState, QuizSlotState];
      for (let i = 0; i < 4; i++) {
        const src = sharedPoolPhotos[i % sharedPoolPhotos.length];
        if (src) {
          next[i] = { ...next[i], imageUrl: src, zoom: 1, offsetX: 0, offsetY: 0 };
        }
      }
      return next;
    });
    showToast(`Đã lấy 4 ảnh từ Kho Tự Ghép vào 4 ô Quiz!`);
  };

  // Extract images from web article link directly
  const handleExtractFromWebUrl = async () => {
    const cleanUrl = webUrlInput.trim();
    if (!cleanUrl) return;
    setIsFetchingWeb(true);
    try {
      const res = await fetch('/api/extract-web-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !Array.isArray(data.images) || data.images.length === 0) {
        throw new Error(data?.error || 'Không tìm thấy ảnh trong đường dẫn này!');
      }
      const urls: string[] = data.images.map((item: any) => item.dataUrl || item.url).filter(Boolean);
      setSlots((prev) => {
        const next = [...prev] as [QuizSlotState, QuizSlotState, QuizSlotState, QuizSlotState];
        for (let i = 0; i < 4; i++) {
          const picked = urls[i % urls.length];
          if (picked) {
            next[i] = { ...next[i], imageUrl: picked, zoom: 1, offsetX: 0, offsetY: 0 };
          }
        }
        return next;
      });
      showToast(`Đã hút ${Math.min(urls.length, 4)} ảnh từ bài viết vào 4 ô Quiz!`);
    } catch (err: any) {
      showToast(err?.message || 'Lỗi khi lấy ảnh từ link web');
    } finally {
      setIsFetchingWeb(false);
    }
  };

  // Shuffle 4 photos
  const handleShufflePhotos = () => {
    setSlots((prev) => {
      const copy = [...prev];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy as [QuizSlotState, QuizSlotState, QuizSlotState, QuizSlotState];
    });
    showToast('🔀 Đã đảo vị trí 4 ô ảnh!');
  };

  // Shuffle 4 answers
  const handleShuffleAnswers = () => {
    setAnswers((prev) => {
      const copy = [...prev];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy as [string, string, string, string];
    });
    showToast('🔀 Đã đảo ngẫu nhiên thứ tự 4 đáp án A, B, C, D!');
  };

  // Main Canvas Render Function
  const renderQuizCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 1080;
    const H = canvasRatio === '9:16' ? 1920 : canvasRatio === '4:5' ? 1350 : 1440;
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;

    const isBlueTheme = selectedTemplateId === 'classic_actor_blue';
    const scaleY = H / 1920;

    ctx.clearRect(0, 0, W, H);

    // =======================================================
    // 1. VẼ NỀN (BACKGROUND)
    // =======================================================
    if (isBlueTheme) {
      // Nền xanh đêm đậm chuyển sắc (Mẫu 3)
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#071442');
      bgGrad.addColorStop(0.5, '#0B236E');
      bgGrad.addColorStop(1, '#061238');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Các hạt sao lấp lánh nhẹ trên nền xanh đêm
      const starPositions = [
        [180, 14], [960, 22], [55, 290], [1035, 310], [32, 620],
        [1050, 780], [28, 1180], [1042, 1290], [60, 1650], [920, 1890],
        [545, 1895], [140, 1885], [830, 18], [410, 12],
      ];
      starPositions.forEach(([sx, sy], idx) => {
        const py = sy * scaleY;
        ctx.save();
        ctx.fillStyle = idx % 2 === 0 ? 'rgba(255, 255, 255, 0.7)' : 'rgba(147, 197, 253, 0.55)';
        ctx.beginPath();
        ctx.arc(sx, py, idx % 3 === 0 ? 4.5 : 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    } else {
      // Nền xanh cổ vịt đậm (Mẫu 1 & Mẫu 2)
      ctx.fillStyle = '#13433B';
      ctx.fillRect(0, 0, W, H);

      // Họa tiết chấm bi vàng cổ điển (Polka dots)
      ctx.save();
      ctx.fillStyle = 'rgba(168, 148, 84, 0.42)';
      const dotSpacingX = 68;
      const dotSpacingY = 68;
      const dotRadius = 11.5;
      for (let row = 0; row * dotSpacingY < H + dotSpacingY; row++) {
        const offsetX = row % 2 === 1 ? dotSpacingX / 2 : 0;
        for (let col = -1; col * dotSpacingX < W + dotSpacingX; col++) {
          const cx = col * dotSpacingX + offsetX;
          const cy = row * dotSpacingY;
          ctx.beginPath();
          ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // =======================================================
    // 2. VẼ BANNER CÂU HỎI TRÊN CÙNG (TOP QUESTION BANNER)
    // =======================================================
    const bannerX = 48;
    const bannerY = Math.round(32 * scaleY);
    const bannerW = W - 96;
    const bannerH = Math.round(248 * Math.max(0.86, scaleY));
    const bannerRadius = 40;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.32)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    drawRoundedRect(ctx, bannerX, bannerY, bannerW, bannerH, bannerRadius);
    ctx.fillStyle = isBlueTheme ? '#FFFFFF' : '#F6F2E2';
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = isBlueTheme ? '#B91C1C' : '#CE472E';
    ctx.stroke();
    ctx.restore();

    // Vẽ chữ trong Banner câu hỏi
    const centerX = W / 2 + (leftBannerIcon !== 'none' && !showRightQuestionMark ? 24 : 0);
    const l1Pre = line1Prefix;
    const l1Hi = line1Highlight;
    const l2Pre = line2Prefix;
    const l2Hi = line2Highlight;
    const l2Suf = line2Suffix;

    if (isBlueTheme && !l1Hi && !l2Pre) {
      // Phong cách chữ cực lớn 2 dòng như Mẫu 3: "WHO IS THIS" / "ACTOR?"
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Dòng 1
      const font1 = Math.round(86 * Math.max(0.85, scaleY));
      ctx.font = `900 ${font1}px "Arial Black", "Montserrat", "Inter", sans-serif`;
      ctx.fillStyle = '#0F172A';
      ctx.fillText(l1Pre.trim(), W / 2, bannerY + bannerH * 0.33);

      // Dòng 2
      const font2 = Math.round(96 * Math.max(0.85, scaleY));
      ctx.font = `900 ${font2}px "Arial Black", "Montserrat", "Inter", sans-serif`;
      ctx.fillStyle = '#D91B24';
      ctx.fillText((l2Hi || l2Suf).trim(), W / 2, bannerY + bannerH * 0.74);
      ctx.restore();
    } else {
      // Phong cách chữ đa màu trên mỗi dòng như Mẫu 1 & Mẫu 2
      ctx.save();
      ctx.textBaseline = 'middle';
      const fontSize1 = Math.round(54 * Math.max(0.85, scaleY));
      ctx.font = `900 ${fontSize1}px "Arial Black", "Montserrat", "Inter", sans-serif`;

      // Đo độ rộng dòng 1
      const w1Pre = ctx.measureText(l1Pre).width;
      const w1Hi = ctx.measureText(l1Hi).width;
      const totalW1 = w1Pre + w1Hi;
      let startX1 = centerX - totalW1 / 2;
      const line1Y = bannerY + bannerH * 0.36;

      ctx.textAlign = 'left';
      ctx.fillStyle = isBlueTheme ? '#0F172A' : '#123D35';
      ctx.fillText(l1Pre, startX1, line1Y);
      ctx.fillStyle = isBlueTheme ? '#D91B24' : '#D04830';
      ctx.fillText(l1Hi, startX1 + w1Pre, line1Y);

      // Đo độ rộng dòng 2
      const fontSize2 = Math.round(58 * Math.max(0.85, scaleY));
      ctx.font = `900 ${fontSize2}px "Arial Black", "Montserrat", "Inter", sans-serif`;
      const w2Pre = ctx.measureText(l2Pre).width;
      const w2Hi = ctx.measureText(l2Hi).width;
      const w2Suf = ctx.measureText(l2Suf).width;
      const totalW2 = w2Pre + w2Hi + w2Suf;
      let startX2 = centerX - totalW2 / 2;
      const line2Y = bannerY + bannerH * 0.71;

      ctx.fillStyle = isBlueTheme ? '#0F172A' : '#123D35';
      ctx.fillText(l2Pre, startX2, line2Y);
      ctx.fillStyle = isBlueTheme ? '#D91B24' : '#236D53';
      ctx.fillText(l2Hi, startX2 + w2Pre, line2Y);
      ctx.fillStyle = isBlueTheme ? '#0F172A' : '#123D35';
      ctx.fillText(l2Suf, startX2 + w2Pre + w2Hi, line2Y);
      ctx.restore();
    }

    // Vẽ Icon Bên Trái Banner (Micro Vàng hoặc Tivi Ngôi Sao)
    if (leftBannerIcon === 'mic') {
      const micCx = bannerX + 46;
      const micCy = bannerY + bannerH * 0.46;
      ctx.save();
      // Củ micro bầu dục vàng
      drawRoundedRect(ctx, micCx - 38, micCy - 62, 76, 108, 38);
      ctx.fillStyle = '#E8BE42';
      ctx.fill();
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#1E1B18';
      ctx.stroke();

      // Các đường kẻ ngang trên micro
      ctx.lineWidth = 5;
      for (let my = micCy - 32; my <= micCy + 18; my += 16) {
        ctx.beginPath();
        ctx.moveTo(micCx - 34, my);
        ctx.lineTo(micCx + 34, my);
        ctx.stroke();
      }

      // Giá đỡ chữ U của micro
      ctx.beginPath();
      ctx.arc(micCx, micCy - 2, 54, 0.1 * Math.PI, 0.9 * Math.PI, false);
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#1E1B18';
      ctx.stroke();

      // Chân đứng & Đế micro
      ctx.beginPath();
      ctx.moveTo(micCx, micCy + 52);
      ctx.lineTo(micCx, micCy + 86);
      ctx.moveTo(micCx - 38, micCy + 86);
      ctx.lineTo(micCx + 38, micCy + 86);
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    } else if (leftBannerIcon === 'tv_star') {
      const tvX = bannerX - 20;
      const tvY = bannerY + bannerH * 0.25;
      const tvW = 148;
      const tvH = 112;
      ctx.save();
      // Râu ăng-ten chữ V
      ctx.beginPath();
      ctx.moveTo(tvX + tvW * 0.25, tvY - 34);
      ctx.lineTo(tvX + tvW * 0.48, tvY + 2);
      ctx.lineTo(tvX + tvW * 0.74, tvY - 34);
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#1E1B18';
      ctx.stroke();

      // Thân Tivi vàng
      drawRoundedRect(ctx, tvX, tvY, tvW, tvH, 20);
      ctx.fillStyle = '#F2C94C';
      ctx.fill();
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#1E1B18';
      ctx.stroke();

      // Màn hình trắng bên trong
      drawRoundedRect(ctx, tvX + 14, tvY + 14, tvW - 48, tvH - 28, 12);
      ctx.fillStyle = '#F9F6EB';
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#1E1B18';
      ctx.stroke();

      // Ngôi sao vàng ở giữa màn hình
      drawFivePointStar(ctx, tvX + 14 + (tvW - 48) / 2, tvY + tvH / 2, 5, 22, 10);
      ctx.fillStyle = '#F2C94C';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#1E1B18';
      ctx.stroke();

      // 2 nút tròn bên phải Tivi
      ctx.fillStyle = '#1E1B18';
      ctx.beginPath();
      ctx.arc(tvX + tvW - 18, tvY + 36, 7, 0, Math.PI * 2);
      ctx.arc(tvX + tvW - 18, tvY + 62, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Vẽ Dấu Chấm Hỏi Lớn Bên Phải Banner (kèm tia sáng vàng)
    if (showRightQuestionMark) {
      const qx = bannerX + bannerW - 58;
      const qy = bannerY + bannerH * 0.55;
      ctx.save();
      // 3 vạch tia sáng vàng
      ctx.strokeStyle = '#F2C94C';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      const rays = [
        [-64, -76, -42, -58],
        [-74, -22, -48, -18],
        [-60, 26, -38, 14],
      ];
      rays.forEach(([x1, y1, x2, y2]) => {
        ctx.beginPath();
        ctx.moveTo(qx + x1, qy + y1);
        ctx.lineTo(qx + x2, qy + y2);
        ctx.stroke();
      });

      // Chữ ? lớn màu đỏ cam
      ctx.font = `900 ${Math.round(165 * Math.max(0.85, scaleY))}px "Arial Black", "Montserrat", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#D04830';
      ctx.fillText('?', qx + 12, qy + 6);
      ctx.restore();
    }

    // =======================================================
    // 3. VẼ LƯỚI 4 Ô ẢNH (2x2 PHOTO GRID) & THANH MÀU TV
    // =======================================================
    const gridTop = bannerY + bannerH + Math.round(30 * scaleY);
    const gridHeight = Math.round(990 * scaleY);
    const gridLeft = 48;
    const gridRight = W - 48;
    const gridTotalW = gridRight - gridLeft;
    const gap = 18;
    const cellW = Math.floor((gridTotalW - gap) / 2);
    const cellH = Math.floor((gridHeight - gap) / 2);

    // Vẽ dải sọc màu TV cổ điển (SMPTE Color Bars) ở 2 mép trái & phải nếu bật
    if (showTvColorBars) {
      const tvColors = [
        '#F8FAFC',
        '#FACC15',
        '#22D3EE',
        '#22C55E',
        '#E879F9',
        '#EF4444',
        '#2563EB',
        '#0F172A',
      ];
      const totalStrips = 22;
      const stripH = gridHeight / totalStrips;
      const barW = 40;

      ctx.save();
      for (let i = 0; i < totalStrips; i++) {
        ctx.fillStyle = tvColors[i % tvColors.length];
        const sy = gridTop + i * stripH;
        // Mép trái
        ctx.fillRect(0, sy, barW, stripH + 1);
        // Mép phải
        ctx.fillRect(W - barW, sy, barW, stripH + 1);
      }
      // Viền đen mảnh ngăn cách thanh màu TV
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 4;
      ctx.strokeRect(0, gridTop, barW, gridHeight);
      ctx.strokeRect(W - barW, gridTop, barW, gridHeight);
      ctx.restore();
    }

    // Vẽ từng ô ảnh 1, 2, 3, 4
    for (let idx = 0; idx < 4; idx++) {
      const row = Math.floor(idx / 2);
      const col = idx % 2;
      const cx = gridLeft + col * (cellW + gap);
      const cy = gridTop + row * (cellH + gap);
      const slot = slots[idx];

      ctx.save();
      drawRoundedRect(ctx, cx, cy, cellW, cellH, 16);
      ctx.fillStyle = '#1E293B';
      ctx.fill();
      ctx.clip();

      const img = imageCacheRef.current.get(slot.imageUrl?.trim());
      if (img && img.width > 0 && img.height > 0) {
        if (slot.grayscale) {
          ctx.filter = 'grayscale(100%) contrast(108%)';
        }
        const imgRatio = img.width / img.height;
        const boxRatio = cellW / cellH;
        let drawW = cellW;
        let drawH = cellH;
        if (imgRatio > boxRatio) {
          drawH = cellH;
          drawW = cellH * imgRatio;
        } else {
          drawW = cellW;
          drawH = cellW / imgRatio;
        }
        drawW *= slot.zoom || 1;
        drawH *= slot.zoom || 1;

        const dx = cx + (cellW - drawW) / 2 + (slot.offsetX || 0);
        const dy = cy + (cellH - drawH) / 2 + (slot.offsetY || 0);
        ctx.drawImage(img, dx, dy, drawW, drawH);
        ctx.filter = 'none';
      } else {
        // Placeholder nếu chưa tải xong ảnh
        ctx.fillStyle = '#334155';
        ctx.fillRect(cx, cy, cellW, cellH);
        ctx.fillStyle = '#94A3B8';
        ctx.font = 'bold 34px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`ẢNH SỐ ${idx + 1}`, cx + cellW / 2, cy + cellH / 2);
      }
      ctx.restore();

      // Viền khung ảnh
      ctx.save();
      drawRoundedRect(ctx, cx, cy, cellW, cellH, 16);
      ctx.lineWidth = 8;
      ctx.strokeStyle = isBlueTheme ? '#EAB308' : '#DEC87A';
      ctx.stroke();
      ctx.restore();

      // Vẽ Nhãn Số Thứ Tự (1, 2, 3, 4) ở góc trên trái mỗi ô ảnh
      const numStr = String(idx + 1);
      if (numberBadgeStyle === 'retro_tv') {
        const bx = cx + 16;
        const by = cy + 20;
        const bw = 96;
        const bh = 74;

        ctx.save();
        // 2 râu ăng-ten nhỏ màu trắng trên đầu nhãn TV
        ctx.beginPath();
        ctx.moveTo(bx + bw * 0.32, by - 14);
        ctx.lineTo(bx + bw * 0.5, by + 2);
        ctx.lineTo(bx + bw * 0.68, by - 14);
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        // Viền ngoài trắng
        drawRoundedRect(ctx, bx - 3, by - 3, bw + 6, bh + 6, 18);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        // Khung TV đen
        drawRoundedRect(ctx, bx, by, bw, bh, 15);
        ctx.fillStyle = '#18181B';
        ctx.fill();

        // Màn hình đỏ cam bên trong
        drawRoundedRect(ctx, bx + 7, by + 7, bw - 14, bh - 14, 10);
        ctx.fillStyle = '#CE472E';
        ctx.fill();

        // Chữ số trắng ở giữa
        ctx.font = '900 44px "Arial Black", "Montserrat", sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(numStr, bx + bw / 2, by + bh / 2 + 2);
        ctx.restore();
      } else {
        // Nhãn tròn đỏ viền trắng (Mẫu 3)
        const r = 44;
        const bcx = cx + 18 + r;
        const bcy = cy + 18 + r;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(bcx, bcy, r, 0, Math.PI * 2);
        ctx.fillStyle = '#DC2626';
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        ctx.font = '900 46px "Arial Black", "Montserrat", sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(numStr, bcx, bcy + 2);
        ctx.restore();
      }
    }

    // =======================================================
    // 4. VẼ 4 THANH ĐÁP ÁN A, B, C, D BÊN DƯỚI
    // =======================================================
    const answersTop = gridTop + gridHeight + Math.round(30 * scaleY);
    const availableBottomH = H - answersTop - Math.round(32 * scaleY);
    const pillGap = Math.round(18 * scaleY);
    const pillH = Math.floor((availableBottomH - pillGap * 3) / 4);
    const pillX = 54;
    const pillW = W - 108;

    const letters = ['A', 'B', 'C', 'D'];
    const retroCircleColors = ['#D04830', '#26785C', '#F2C641', '#6923B4'];
    const blueThemeCircleColors = ['#DC2626', '#2563EB', '#16A34A', '#7C3AED'];

    for (let i = 0; i < 4; i++) {
      const py = answersTop + i * (pillH + pillGap);
      const pillRadius = pillH / 2;

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.32)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 5;

      drawRoundedRect(ctx, pillX, py, pillW, pillH, pillRadius);
      if (isBlueTheme) {
        // Thanh vàng Gold chuyển sắc bóng (Mẫu 3)
        const goldGrad = ctx.createLinearGradient(pillX, py, pillX, py + pillH);
        goldGrad.addColorStop(0, '#FEF08A');
        goldGrad.addColorStop(0.5, '#FACC15');
        goldGrad.addColorStop(1, '#CA8A04');
        ctx.fillStyle = goldGrad;
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#EAB308';
        ctx.stroke();
      } else {
        // Thanh kem viền vàng nhạt (Mẫu 1 & 2)
        ctx.fillStyle = '#F6F1DF';
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#DEC882';
        ctx.stroke();
      }
      ctx.restore();

      // Vòng tròn chữ cái A, B, C, D bên trái thanh đáp án
      const circleR = pillH * 0.48;
      const circleCx = pillX + circleR + 4;
      const circleCy = py + pillH / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(circleCx, circleCy, circleR, 0, Math.PI * 2);
      ctx.fillStyle = isBlueTheme ? blueThemeCircleColors[i] : retroCircleColors[i];
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      ctx.font = `900 ${Math.round(pillH * 0.52)}px "Arial Black", "Montserrat", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Riêng chữ C trên nền vàng của Mẫu 1 & 2 dùng chữ màu đen đậm giống hệt ảnh mẫu
      ctx.fillStyle = !isBlueTheme && i === 2 ? '#111827' : '#FFFFFF';
      ctx.fillText(letters[i], circleCx, circleCy + 2);
      ctx.restore();

      // Tên đáp án ở giữa thanh
      ctx.save();
      const answerText = (answers[i] || '').trim() || `Option ${letters[i]}`;
      const maxTextW = pillW - circleR * 2 - 60;
      let fontSizeAns = Math.round(pillH * 0.46);
      ctx.font = `900 ${fontSizeAns}px "Arial Black", "Montserrat", "Inter", sans-serif`;
      while (ctx.measureText(answerText).width > maxTextW && fontSizeAns > 24) {
        fontSizeAns -= 2;
        ctx.font = `900 ${fontSizeAns}px "Arial Black", "Montserrat", "Inter", sans-serif`;
      }
      ctx.fillStyle = isBlueTheme ? '#090D16' : '#103B33';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(answerText, pillX + pillW / 2 + circleR * 0.35, py + pillH / 2 + 2);
      ctx.restore();
    }

    // =======================================================
    // 5. WATERMARK TÙY CHỌN (NẾU BẬT)
    // =======================================================
    if (showWatermark && watermarkText.trim()) {
      ctx.save();
      ctx.font = 'bold 22px Inter, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(watermarkText.trim(), W - 28, H - 8);
      ctx.restore();
    }
  }, [
    canvasRatio,
    selectedTemplateId,
    line1Prefix,
    line1Highlight,
    line2Prefix,
    line2Highlight,
    line2Suffix,
    leftBannerIcon,
    showRightQuestionMark,
    showTvColorBars,
    numberBadgeStyle,
    slots,
    answers,
    showWatermark,
    watermarkText,
    imageLoadTick,
  ]);

  useEffect(() => {
    renderQuizCanvas();
  }, [renderQuizCanvas]);

  // Download PNG/JPG
  const handleDownloadQuizImage = (format: 'png' | 'jpeg' = 'png') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const mime = format === 'png' ? 'image/png' : 'image/jpeg';
      const dataUrl = canvas.toDataURL(mime, 0.96);
      const link = document.createElement('a');
      const slug = (line1Highlight || line2Highlight || 'quiz')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');
      link.download = `quiz-${selectedTemplateId}-${slug}-${Date.now()}.${format === 'png' ? 'png' : 'jpg'}`;
      link.href = dataUrl;
      link.click();
      showToast(`✅ Đã tải xuống ảnh Quiz (${canvas.width}x${canvas.height}px)!`);
    } catch (err) {
      console.error(err);
      showToast('⚠️ Một số ảnh ngoài web bị chặn CORS, hãy dùng tính năng Hút ảnh từ Link Web hoặc tải ảnh từ máy!');
    }
  };

  // Copy image to clipboard
  const handleCopyQuizImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        showToast('📋 Đã copy ảnh Quiz vào Clipboard! Bạn có thể Ctrl+V dán ngay lên Fanpage/Group.');
      }, 'image/png');
    } catch (err) {
      console.error(err);
      showToast('Không thể copy trực tiếp, vui lòng bấm Tải Ảnh PNG.');
    }
  };

  const activeSlot = slots[activeSlotIdx] || slots[0];

  return (
    <div className="space-y-4">
      {/* Toast thông báo */}
      {toastMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-emerald-700 hover:text-emerald-950 font-black px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* HÀNG CHỌN NHANH 3 MẪU QUIZ CHUẨN NHƯ ẢNH MẪU */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
              <span>🎯 Chọn Kiểu Mẫu Làm Ảnh Quiz Đố Vui (4 Ảnh 1-2-3-4 & Đáp Án A-B-C-D)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                Chuẩn Viral Fanpage & Group US/UK
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Bấm chọn 1 trong 3 mẫu chuẩn bên dưới để áp dụng ngay bố cục, màu nền, thanh màu TV và kiểu chữ giống hệt ảnh mẫu.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {sharedPoolPhotos.length > 0 && (
              <button
                type="button"
                onClick={handleLoadFromSharedPool}
                className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 cursor-pointer flex items-center gap-1.5 transition-all"
              >
                <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                <span>Lấy 4 ảnh từ Kho Tự Ghép ({sharedPoolPhotos.length})</span>
              </button>
            )}
            <label className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer flex items-center gap-1.5 transition-all">
              <Upload className="w-3.5 h-3.5" />
              <span>+ Tải 4 Ảnh Từ Máy</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleUploadFiles(e.target.files)}
              />
            </label>
          </div>
        </div>

        {/* 3 Cards chọn Mẫu */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {QUIZ_TEMPLATE_PRESETS.map((preset) => {
            const isSelected = selectedTemplateId === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => handleSelectTemplate(preset)}
                className={`group relative rounded-2xl border-2 p-3 transition-all cursor-pointer flex items-center gap-3 ${
                  isSelected
                    ? 'border-rose-600 bg-rose-50/50 shadow-sm ring-2 ring-rose-500/20'
                    : 'border-slate-200 hover:border-rose-300 bg-slate-50/60 hover:bg-white'
                }`}
              >
                <div className="w-16 h-24 rounded-xl overflow-hidden border border-slate-300 shrink-0 bg-slate-900 relative">
                  <img
                    src={preset.previewAsset}
                    alt={preset.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowRefSampleModal(preset.previewAsset);
                    }}
                    className="absolute bottom-1 right-1 bg-black/70 hover:bg-black text-white text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer"
                    title="Xem ảnh mẫu gốc cỡ lớn"
                  >
                    Mẫu
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                      {preset.badge}
                    </span>
                    {isSelected && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-600 text-white">
                        ✓ Đang chọn
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 mt-1 truncate">
                    {preset.name}
                  </h4>
                  <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">
                    {preset.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* BÀN LÀM VIỆC CHÍNH: TRÁI (CÀI ĐẶT CHI TIẾT) - PHẢI (XEM TRƯỚC CANVAS & XUẤT ẢNH) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* CỘT TRÁI (7 CỘT): CÀI ĐẶT CÂU HỎI, 4 Ô ẢNH & 4 ĐÁP ÁN A-B-C-D */}
        <div className="lg:col-span-7 space-y-4">
          {/* KHỐI 1: CÂU HỎI TIÊU ĐỀ TRÊN CÙNG & ICON BANNER */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-rose-600 text-white font-black text-xs flex items-center justify-center">
                  1
                </span>
                <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide">
                  Tiêu Đề Câu Hỏi & Trang Trí Banner Trên
                </h4>
              </div>

              {/* Chọn nhanh số ảnh đố #1, #2, #3, #4 */}
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold text-slate-500 mr-1">Đố ảnh số:</span>
                {([1, 2, 3, 4] as const).map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleQuickPhotoNumber(num)}
                    className={`px-2 py-0.5 rounded-lg text-xs font-black border cursor-pointer transition-all ${
                      line2Highlight.trim() === `#${num}`
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                        : 'bg-slate-100 hover:bg-emerald-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    #{num}
                  </button>
                ))}
              </div>
            </div>

            {/* Gợi ý mẫu câu hỏi 1 chạm */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500">Mẫu câu nhanh:</span>
              {QUICK_HEADLINE_PRESETS.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setLine1Prefix(q.l1Pre);
                    setLine1Highlight(q.l1Hi);
                    setLine2Prefix(q.l2Pre);
                    setLine2Highlight(q.l2Hi);
                    setLine2Suffix(q.l2Suf);
                  }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 transition-colors cursor-pointer"
                >
                  {q.label}
                </button>
              ))}
            </div>

            {/* Ô nhập Dòng 1 & Dòng 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-[11px] font-black text-slate-700 uppercase">
                  Dòng 1 (Chữ chính + Chữ nhấn Đỏ)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500">Chữ đầu dòng 1:</span>
                    <input
                      type="text"
                      value={line1Prefix}
                      onChange={(e) => setLine1Prefix(e.target.value)}
                      placeholder="WHO IS THE "
                      className="w-full px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-rose-600">Chữ nhấn Đỏ (Dòng 1):</span>
                    <input
                      type="text"
                      value={line1Highlight}
                      onChange={(e) => setLine1Highlight(e.target.value)}
                      placeholder="TV HOST / TV STAR"
                      className="w-full px-2.5 py-1.5 text-xs font-black text-rose-600 border border-rose-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-[11px] font-black text-slate-700 uppercase">
                  Dòng 2 (IN PHOTO + Số #1..#4 + ?)
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  <div className="col-span-2">
                    <span className="text-[10px] font-semibold text-slate-500">Chữ đầu:</span>
                    <input
                      type="text"
                      value={line2Prefix}
                      onChange={(e) => setLine2Prefix(e.target.value)}
                      placeholder="IN PHOTO "
                      className="w-full px-2 py-1.5 text-xs font-bold border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] font-semibold text-emerald-700">Chữ nhấn (#3 / ACTOR?):</span>
                    <input
                      type="text"
                      value={line2Highlight}
                      onChange={(e) => setLine2Highlight(e.target.value)}
                      placeholder="#3"
                      className="w-full px-2 py-1.5 text-xs font-black text-emerald-700 border border-emerald-300 rounded-lg bg-white"
                    />
                  </div>
                  <div className="col-span-1">
                    <span className="text-[10px] font-semibold text-slate-500">Đuôi:</span>
                    <input
                      type="text"
                      value={line2Suffix}
                      onChange={(e) => setLine2Suffix(e.target.value)}
                      placeholder="?"
                      className="w-full px-2 py-1.5 text-xs font-bold border border-slate-300 rounded-lg bg-white text-center"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Tùy chọn Icon & Trang trí khung */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-600">Icon Trái:</span>
                {[
                  { id: 'mic' as const, label: '🎙️ Micro Vàng' },
                  { id: 'tv_star' as const, label: '📺 Tivi Ngôi Sao' },
                  { id: 'none' as const, label: 'Ẩn Icon' },
                ].map((ic) => (
                  <button
                    key={ic.id}
                    type="button"
                    onClick={() => setLeftBannerIcon(ic.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                      leftBannerIcon === ic.id
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {ic.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showRightQuestionMark}
                    onChange={(e) => setShowRightQuestionMark(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Dấu ? Đỏ Phải</span>
                </label>

                <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showTvColorBars}
                    onChange={(e) => setShowTvColorBars(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Sọc màu TV 2 bên</span>
                </label>

                <select
                  value={numberBadgeStyle}
                  onChange={(e) => setNumberBadgeStyle(e.target.value as 'retro_tv' | 'red_circle')}
                  className="px-2 py-1 text-xs font-bold border border-slate-300 rounded-lg bg-white cursor-pointer"
                >
                  <option value="retro_tv">Số 1-4: Tivi Đỏ có ăng-ten</option>
                  <option value="red_circle">Số 1-4: Vòng Tròn Đỏ</option>
                </select>
              </div>
            </div>
          </div>

          {/* KHỐI 2: QUẢN LÝ 4 Ô ẢNH (1, 2, 3, 4) & HÚT ẢNH TỪ LINK WEB */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-rose-600 text-white font-black text-xs flex items-center justify-center">
                  2
                </span>
                <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide">
                  4 Ô Ảnh Nhân Vật (1 - 2 - 3 - 4)
                </h4>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleShufflePhotos}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 cursor-pointer flex items-center gap-1"
                >
                  <Shuffle className="w-3.5 h-3.5 text-amber-700" />
                  <span>Đảo vị trí 4 ảnh</span>
                </button>
              </div>
            </div>

            {/* Thanh hút ảnh nhanh từ Link bài viết web */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  value={webUrlInput}
                  onChange={(e) => setWebUrlInput(e.target.value)}
                  placeholder="Dán link bài viết web để tự hút 4 ảnh vào 4 ô (hoặc tải từ máy)..."
                  className="w-full pl-9 pr-3 py-2 text-xs font-medium border border-slate-300 rounded-xl bg-slate-50 focus:bg-white"
                />
              </div>
              <button
                type="button"
                disabled={isFetchingWeb || !webUrlInput.trim()}
                onClick={handleExtractFromWebUrl}
                className="px-3.5 py-2 rounded-xl text-xs font-black bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50 cursor-pointer shrink-0 flex items-center gap-1.5"
              >
                {isFetchingWeb ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang lấy ảnh...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Hút 4 Ảnh Từ Web</span>
                  </>
                )}
              </button>
            </div>

            {/* 4 Thẻ Ô Ảnh 1, 2, 3, 4 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {slots.map((slot, idx) => {
                const isSelected = activeSlotIdx === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => setActiveSlotIdx(idx)}
                    className={`rounded-xl border-2 p-2 transition-all cursor-pointer space-y-2 ${
                      isSelected
                        ? 'border-rose-600 bg-rose-50/40 shadow-2xs'
                        : 'border-slate-200 bg-slate-50/60 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[11px] font-black bg-rose-600 text-white">
                        Ô Số {idx + 1}
                      </span>
                      <label
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 cursor-pointer"
                        title="Bật hiệu ứng ảnh đen trắng cổ điển cho ô này"
                      >
                        <input
                          type="checkbox"
                          checked={slot.grayscale}
                          onChange={(e) => updateSlot(idx, { grayscale: e.target.checked })}
                          className="rounded text-slate-800"
                        />
                        <span>Đen trắng</span>
                      </label>
                    </div>

                    <div className="aspect-square w-full rounded-lg overflow-hidden bg-slate-200 border border-slate-300 relative group">
                      <img
                        src={slot.imageUrl}
                        alt={`Slot ${idx + 1}`}
                        className={`w-full h-full object-cover ${slot.grayscale ? 'grayscale' : ''}`}
                      />
                      <label
                        onClick={(e) => e.stopPropagation()}
                        className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[11px] font-bold cursor-pointer gap-1"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Đổi ảnh Ô {idx + 1}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleUploadFiles(e.target.files, idx)}
                        />
                      </label>
                    </div>

                    <input
                      type="text"
                      value={slot.imageUrl.startsWith('data:') ? '' : slot.imageUrl}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        updateSlot(idx, {
                          imageUrl: e.target.value,
                          zoom: 1,
                          offsetX: 0,
                          offsetY: 0,
                        })
                      }
                      placeholder={slot.imageUrl.startsWith('data:') ? 'Ảnh tải từ máy' : 'Dán link ảnh...'}
                      className="w-full px-2 py-1 text-[10px] border border-slate-200 rounded-md bg-white text-slate-700"
                    />
                  </div>
                );
              })}
            </div>

            {/* Thanh chỉnh Zoom & Dịch chuyển tâm ảnh cho Ô đang chọn */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800">
                <Sliders className="w-4 h-4 text-rose-600" />
                <span>Căn chỉnh Ô Số {activeSlotIdx + 1}:</span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <ZoomOut className="w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="range"
                    min="1"
                    max="2.4"
                    step="0.05"
                    value={activeSlot.zoom}
                    onChange={(e) => updateSlot(activeSlotIdx, { zoom: parseFloat(e.target.value) })}
                    className="w-24 accent-rose-600 cursor-pointer"
                  />
                  <ZoomIn className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-mono font-bold text-[11px] text-slate-600">
                    {Math.round(activeSlot.zoom * 100)}%
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Ngang:</span>
                  <input
                    type="range"
                    min="-220"
                    max="220"
                    step="5"
                    value={activeSlot.offsetX}
                    onChange={(e) => updateSlot(activeSlotIdx, { offsetX: parseInt(e.target.value, 10) })}
                    className="w-20 accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Dọc:</span>
                  <input
                    type="range"
                    min="-220"
                    max="220"
                    step="5"
                    value={activeSlot.offsetY}
                    onChange={(e) => updateSlot(activeSlotIdx, { offsetY: parseInt(e.target.value, 10) })}
                    className="w-20 accent-indigo-600 cursor-pointer"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => updateSlot(activeSlotIdx, { zoom: 1, offsetX: 0, offsetY: 0 })}
                  className="px-2 py-1 rounded-md text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* KHỐI 3: 4 ĐÁP ÁN TRẮC NGHIỆM A, B, C, D */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-rose-600 text-white font-black text-xs flex items-center justify-center">
                  3
                </span>
                <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide">
                  4 Đáp Án Trắc Nghiệm (A • B • C • D)
                </h4>
              </div>

              <button
                type="button"
                onClick={handleShuffleAnswers}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 cursor-pointer flex items-center gap-1"
              >
                <Shuffle className="w-3.5 h-3.5 text-indigo-600" />
                <span>Đảo ngẫu nhiên A-B-C-D</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(['A', 'B', 'C', 'D'] as const).map((letter, idx) => {
                const badgeColors = [
                  'bg-red-600 text-white',
                  'bg-emerald-700 text-white',
                  'bg-amber-400 text-slate-900',
                  'bg-purple-700 text-white',
                ];
                return (
                  <div
                    key={letter}
                    className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200"
                  >
                    <span
                      className={`w-7 h-7 rounded-full font-black text-xs flex items-center justify-center shrink-0 shadow-2xs ${badgeColors[idx]}`}
                    >
                      {letter}
                    </span>
                    <input
                      type="text"
                      value={answers[idx]}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAnswers((prev) => {
                          const next = [...prev] as [string, string, string, string];
                          next[idx] = val;
                          return next;
                        });
                      }}
                      placeholder={`Nhập tên đáp án ${letter}...`}
                      className="w-full px-2.5 py-1.5 text-xs font-black text-slate-900 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                );
              })}
            </div>

            {/* Ô dán nhanh 4 dòng tên */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center gap-2">
              <input
                type="text"
                value={bulkAnswersInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setBulkAnswersInput(val);
                  const parts = val
                    .split(/\r?\n|\||,|;/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  if (parts.length >= 2) {
                    setAnswers((prev) => [
                      parts[0] || prev[0],
                      parts[1] || prev[1],
                      parts[2] || prev[2],
                      parts[3] || prev[3],
                    ]);
                  }
                }}
                placeholder="⚡ Dán nhanh 4 tên cách nhau bởi dấu phẩy (,) hoặc gạch đứng (|): Richard Simmons, Geraldo Rivera, Morley Safer, Bob Ross"
                className="w-full px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* CỘT PHẢI (5 CỘT): BẢN XEM TRƯỚC CANVAS TRỰC TIẾP & NÚT TẢI ẢNH */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 space-y-3 sticky top-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div>
              <h4 className="text-xs sm:text-sm font-black text-slate-900">
                Xem Trước Trực Tiếp & Xuất Ảnh Nét Cao
              </h4>
              <p className="text-[11px] text-slate-500">
                Chuẩn kích thước {canvasRatio} (1080px HD)
              </p>
            </div>

            {/* Chọn tỷ lệ khung */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              {(['9:16', '4:5', '3:4'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setCanvasRatio(r)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer transition-all ${
                    canvasRatio === r
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Khung Canvas */}
          <div className="w-full flex justify-center bg-slate-900/95 rounded-2xl p-3 border border-slate-800 shadow-inner">
            <canvas
              ref={canvasRef}
              onMouseDown={(e) => {
                isDraggingCanvasRef.current = true;
                dragStartRef.current = { x: e.clientX, y: e.clientY };
              }}
              onMouseMove={(e) => {
                if (!isDraggingCanvasRef.current) return;
                const dx = (e.clientX - dragStartRef.current.x) * 1.8;
                const dy = (e.clientY - dragStartRef.current.y) * 1.8;
                dragStartRef.current = { x: e.clientX, y: e.clientY };
                updateSlot(activeSlotIdx, {
                  offsetX: Math.round((activeSlot.offsetX || 0) + dx),
                  offsetY: Math.round((activeSlot.offsetY || 0) + dy),
                });
              }}
              onMouseUp={() => {
                isDraggingCanvasRef.current = false;
              }}
              onMouseLeave={() => {
                isDraggingCanvasRef.current = false;
              }}
              className="max-h-[560px] w-auto rounded-xl shadow-2xl cursor-move select-none"
              title="Kéo chuột để chỉnh vị trí ảnh của Ô đang chọn"
            />
          </div>

          {/* Tùy chọn Watermark nhỏ */}
          <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs">
            <label className="inline-flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showWatermark}
                onChange={(e) => setShowWatermark(e.target.checked)}
                className="rounded text-rose-600"
              />
              <span>Chèn chữ ký nhỏ góc dưới</span>
            </label>
            {showWatermark && (
              <input
                type="text"
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                className="px-2 py-1 text-xs font-bold border border-slate-300 rounded-lg bg-white w-44"
              />
            )}
          </div>

          {/* Các nút Xuất ảnh */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => handleDownloadQuizImage('png')}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Tải Ảnh PNG (Nét Cao)</span>
            </button>

            <button
              type="button"
              onClick={handleCopyQuizImage}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Copy className="w-4 h-4" />
              <span>Copy Ảnh Vào Clipboard</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal phóng to xem ảnh mẫu gốc */}
      {showRefSampleModal && (
        <div
          onClick={() => setShowRefSampleModal(null)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-3 max-w-md w-full space-y-2 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800">Ảnh Mẫu Tham Chiếu</span>
              <button
                type="button"
                onClick={() => setShowRefSampleModal(null)}
                className="px-2 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Đóng ✕
              </button>
            </div>
            <img
              src={showRefSampleModal}
              alt="Sample Reference"
              className="w-full max-h-[75vh] object-contain rounded-xl bg-slate-900"
            />
          </div>
        </div>
      )}
    </div>
  );
};
