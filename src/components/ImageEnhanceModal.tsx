import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  X,
  RotateCcw,
  SlidersHorizontal,
  Check,
  RefreshCw,
  Eye,
  ArrowLeftRight,
} from 'lucide-react';
import {
  ENHANCE_PRESETS,
  EnhanceParams,
  EnhancePresetId,
  enhanceImageSource,
  getPresetParams,
} from '../utils/imageEnhancer';

interface ImageEnhanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  photos: string[];
  initialIndex: number;
  originalsMap: Record<string, string>;
  presetId: EnhancePresetId;
  params: EnhanceParams;
  onApplySingle: (
    photoIndex: number,
    enhancedDataUrl: string,
    originalSrc: string,
    nextPresetId: EnhancePresetId,
    nextParams: EnhanceParams
  ) => void;
  onApplyAll: (nextPresetId: EnhancePresetId, nextParams: EnhanceParams) => Promise<void> | void;
  onRevertSingle: (photoIndex: number) => void;
  isBusyBatch?: boolean;
}

export const ImageEnhanceModal: React.FC<ImageEnhanceModalProps> = ({
  isOpen,
  onClose,
  photos,
  initialIndex,
  originalsMap,
  presetId,
  params,
  onApplySingle,
  onApplyAll,
  onRevertSingle,
  isBusyBatch = false,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(initialIndex);
  const [draftPresetId, setDraftPresetId] = useState<EnhancePresetId>(presetId);
  const [draftParams, setDraftParams] = useState<EnhanceParams>(params);
  const [splitPercent, setSplitPercent] = useState<number>(52);
  const [isDraggingSplit, setIsDraggingSplit] = useState<boolean>(false);
  const [previewResult, setPreviewResult] = useState<{
    enhancedUrl: string;
    origW: number;
    origH: number;
    outW: number;
    outH: number;
  } | null>(null);
  const [isRenderingPreview, setIsRenderingPreview] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(Math.max(0, Math.min(photos.length - 1, initialIndex)));
      setDraftPresetId(presetId);
      setDraftParams(params);
      setSplitPercent(52);
      setPreviewError(null);
    }
  }, [isOpen, initialIndex, presetId, params, photos.length]);

  const currentPhoto = photos[selectedIndex] || '';
  const originalSrc = currentPhoto ? originalsMap[currentPhoto] || currentPhoto : '';
  const isAlreadyEnhanced = Boolean(currentPhoto && originalsMap[currentPhoto]);

  useEffect(() => {
    if (!isOpen || !originalSrc) return;
    let cancelled = false;
    setIsRenderingPreview(true);
    setPreviewError(null);

    const timer = window.setTimeout(async () => {
      try {
        const res = await enhanceImageSource(originalSrc, draftParams);
        if (!cancelled) {
          setPreviewResult({
            enhancedUrl: res.enhancedDataUrl,
            origW: res.originalWidth,
            origH: res.originalHeight,
            outW: res.outputWidth,
            outH: res.outputHeight,
          });
        }
      } catch (err: any) {
        if (!cancelled) {
          setPreviewError(err?.message || 'Không thể tải ảnh để xem trước.');
          setPreviewResult(null);
        }
      } finally {
        if (!cancelled) setIsRenderingPreview(false);
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, originalSrc, draftParams]);

  useEffect(() => {
    if (!isDraggingSplit) return;
    const handleMove = (clientX: number) => {
      const el = splitContainerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;
      const pct = ((clientX - rect.left) / rect.width) * 100;
      setSplitPercent(Math.max(5, Math.min(95, pct)));
    };
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleMove(e.touches[0].clientX);
    };
    const onUp = () => setIsDraggingSplit(false);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, [isDraggingSplit]);

  if (!isOpen || photos.length === 0) return null;

  const updateSlider = (key: keyof EnhanceParams, value: number) => {
    setDraftPresetId('custom');
    setDraftParams((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Làm Nét & Làm Đẹp Ảnh Trước Khi Ghép
              </h3>
              <p className="text-[11px] text-slate-500">
                Kéo thanh chia dọc để so sánh Trước (Ảnh gốc) và Sau (Đã làm nét HD & cân chỉnh studio)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 cursor-pointer transition-colors"
            aria-label="Đóng cửa sổ làm nét ảnh"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Before / After Comparison Preview */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            {/* Thumbnail selector strip */}
            {photos.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                {photos.map((p, idx) => {
                  const isEnhanced = Boolean(originalsMap[p]);
                  return (
                    <button
                      key={`enh-thumb-${idx}`}
                      type="button"
                      onClick={() => setSelectedIndex(idx)}
                      className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer transition-all ${
                        selectedIndex === idx
                          ? 'border-rose-600 ring-2 ring-rose-500/25'
                          : 'border-slate-200 hover:border-slate-400'
                      }`}
                      title={`Xem ảnh #${idx + 1}`}
                    >
                      <img src={p} alt={`#${idx + 1}`} className="w-full h-full object-cover" />
                      <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[9px] font-bold px-1 rounded-tl">
                        #{idx + 1}
                      </span>
                      {isEnhanced && (
                        <span className="absolute top-0 left-0 bg-emerald-600 text-white text-[8px] font-black px-1 rounded-br">
                          HD
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Split Before/After Canvas */}
            <div
              ref={splitContainerRef}
              onMouseDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                if (rect.width > 0) {
                  setSplitPercent(
                    Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100))
                  );
                }
                setIsDraggingSplit(true);
              }}
              onTouchStart={(e) => {
                if (e.touches[0]) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  if (rect.width > 0) {
                    setSplitPercent(
                      Math.max(
                        5,
                        Math.min(95, ((e.touches[0].clientX - rect.left) / rect.width) * 100)
                      )
                    );
                  }
                  setIsDraggingSplit(true);
                }
              }}
              className="relative w-full aspect-4/3 sm:aspect-square max-h-[460px] rounded-xl overflow-hidden bg-slate-900 border border-slate-300 select-none cursor-ew-resize flex items-center justify-center"
            >
              {/* After layer (full right/underneath) */}
              <img
                src={previewResult?.enhancedUrl || currentPhoto}
                alt="Sau khi làm nét"
                draggable={false}
                className="w-full h-full object-contain pointer-events-none"
              />

              {/* Before layer (clipped to left splitPercent%) */}
              <div
                style={{ clipPath: `inset(0 ${100 - splitPercent}% 0 0)` }}
                className="absolute inset-0 pointer-events-none"
              >
                <img
                  src={originalSrc}
                  alt="Ảnh gốc"
                  draggable={false}
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Split divider line & handle */}
              <div
                style={{ left: `${splitPercent}%` }}
                className="absolute inset-y-0 -translate-x-1/2 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.8)] pointer-events-none"
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white text-slate-900 shadow-lg border border-slate-300 flex items-center justify-center">
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Labels */}
              <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 text-white text-[10px] font-bold pointer-events-none">
                TRƯỚC (Ảnh gốc{previewResult ? ` • ${previewResult.origW}×${previewResult.origH}` : ''})
              </div>
              <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-emerald-600/90 text-white text-[10px] font-bold pointer-events-none flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                <span>
                  SAU (Làm nét HD{previewResult ? ` • ${previewResult.outW}×${previewResult.outH}` : ''})
                </span>
              </div>

              {isRenderingPreview && (
                <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-slate-900/85 text-white text-[11px] font-bold flex items-center gap-1.5 pointer-events-none">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Đang xử lý nét HD...</span>
                </div>
              )}
            </div>

            {previewError && (
              <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {previewError}
              </div>
            )}
          </div>

          {/* Right: Preset & Fine-tune Sliders */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-3">
            <div className="space-y-3">
              {/* Presets */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-rose-600" />
                  <span>Chế độ làm nét & đẹp ảnh</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {ENHANCE_PRESETS.map((p) => {
                    const active = draftPresetId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setDraftPresetId(p.id);
                          setDraftParams(getPresetParams(p.id));
                        }}
                        className={`text-left px-3 py-2 rounded-xl border transition-all cursor-pointer ${
                          active
                            ? 'bg-rose-50 border-rose-500 ring-1 ring-rose-500/20'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-slate-900">{p.label}</span>
                          {p.id === 'studio_beauty' && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-black">
                              Khuyên dùng
                            </span>
                          )}
                        </div>
                        <p className="text-[10.5px] text-slate-500 mt-0.5 leading-snug">
                          {p.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fine-tune Sliders */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 text-[11px]">
                    Tinh chỉnh chi tiết (tùy chọn)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftPresetId('studio_beauty');
                      setDraftParams(getPresetParams('studio_beauty'));
                    }}
                    className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    Mặc định Studio
                  </button>
                </div>

                {[
                  { key: 'sharpen' as const, label: 'Độ sắc nét (mắt, tóc, viền)', max: 100 },
                  { key: 'clarity' as const, label: 'Độ trong & Tương phản 3D', max: 100 },
                  { key: 'autoTone' as const, label: 'Cân bằng sáng & Vùng tối', max: 100 },
                  { key: 'vibrance' as const, label: 'Độ tươi màu tự nhiên', max: 100 },
                  { key: 'smoothSkin' as const, label: 'Mịn da & Giảm nhiễu hạt', max: 100 },
                ].map((s) => (
                  <div key={s.key} className="space-y-0.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-700">{s.label}</span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        {draftParams[s.key]}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={s.max}
                      value={draftParams[s.key]}
                      onChange={(e) => updateSlider(s.key, Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                    />
                  </div>
                ))}

                <div className="pt-1 flex items-center justify-between gap-2 border-t border-slate-200/80">
                  <span className="text-[11px] font-semibold text-slate-700">
                    Nâng phân giải đầu ra:
                  </span>
                  <div className="flex items-center gap-1">
                    {[
                      { val: 0, label: 'Giữ gốc' },
                      { val: 1600, label: 'HD 1600px' },
                      { val: 1800, label: 'Full HD 1800' },
                      { val: 2048, label: '2K 2048px' },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => updateSlider('upscaleMinLongSide', opt.val)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                          draftParams.upscaleMinLongSide === opt.val
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="flex items-center gap-2">
                {isAlreadyEnhanced && (
                  <button
                    type="button"
                    onClick={() => onRevertSingle(selectedIndex)}
                    className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Khôi phục gốc #{selectedIndex + 1}</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={!previewResult?.enhancedUrl || isRenderingPreview}
                  onClick={() => {
                    if (!previewResult?.enhancedUrl) return;
                    onApplySingle(
                      selectedIndex,
                      previewResult.enhancedUrl,
                      originalSrc,
                      draftPresetId,
                      draftParams
                    );
                    onClose();
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Áp dụng ảnh #{selectedIndex + 1}</span>
                </button>
              </div>

              <button
                type="button"
                disabled={isBusyBatch}
                onClick={async () => {
                  await onApplyAll(draftPresetId, draftParams);
                  onClose();
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-black shadow-sm cursor-pointer transition-colors"
              >
                {isBusyBatch ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang làm nét toàn bộ {photos.length} ảnh...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Làm nét & Đẹp TẤT CẢ {photos.length} ảnh trước khi ghép</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
