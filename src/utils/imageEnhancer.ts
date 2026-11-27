export type EnhancePresetId = 'natural_sharp' | 'studio_beauty' | 'rescue_blur' | 'custom';

export interface EnhanceParams {
  sharpen: number; // 0..100
  clarity: number; // 0..100 (micro-contrast & depth)
  vibrance: number; // 0..100 (skin-safe natural color pop)
  autoTone: number; // 0..100 (auto levels + shadow recovery)
  smoothSkin: number; // 0..100 (edge-aware noise & skin smoothing)
  upscaleMinLongSide: number; // 0 (keep size) or e.g. 1600..2200
}

export interface EnhancePresetConfig {
  id: Exclude<EnhancePresetId, 'custom'>;
  label: string;
  shortLabel: string;
  description: string;
  params: EnhanceParams;
}

export const ENHANCE_PRESETS: EnhancePresetConfig[] = [
  {
    id: 'natural_sharp',
    label: 'Nét Tự Nhiên',
    shortLabel: 'Nét tự nhiên',
    description: 'Tăng độ sắc nét chi tiết (mắt, tóc, viền) và nâng độ phân giải HD mà giữ nguyên màu sắc gốc.',
    params: {
      sharpen: 58,
      clarity: 18,
      vibrance: 10,
      autoTone: 22,
      smoothSkin: 14,
      upscaleMinLongSide: 1600,
    },
  },
  {
    id: 'studio_beauty',
    label: 'Siêu Nét & Đẹp Studio',
    shortLabel: 'Siêu nét Studio',
    description: 'Khuyến nghị: Phóng nét HD, làm trong ảnh, cân bằng ánh sáng, tươi màu tự nhiên & mịn da nhẹ chuẩn tạp chí.',
    params: {
      sharpen: 80,
      clarity: 34,
      vibrance: 24,
      autoTone: 45,
      smoothSkin: 28,
      upscaleMinLongSide: 1800,
    },
  },
  {
    id: 'rescue_blur',
    label: 'Cứu Ảnh Mờ / Tối',
    shortLabel: 'Cứu ảnh mờ',
    description: 'Phục hồi ảnh mờ, tối hoặc bị nén khi tải từ web/MXH: tăng nét sâu, kéo sáng vùng tối và giảm nhiễu hạt.',
    params: {
      sharpen: 96,
      clarity: 48,
      vibrance: 28,
      autoTone: 68,
      smoothSkin: 36,
      upscaleMinLongSide: 2048,
    },
  },
];

export function getPresetParams(presetId: EnhancePresetId, customParams?: EnhanceParams): EnhanceParams {
  if (presetId === 'custom' && customParams) {
    return clampEnhanceParams(customParams);
  }
  const found = ENHANCE_PRESETS.find((p) => p.id === presetId);
  return { ...(found ? found.params : ENHANCE_PRESETS[1].params) };
}

export function clampEnhanceParams(params: EnhanceParams): EnhanceParams {
  const clamp = (v: number, min: number, max: number) =>
    Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : min;
  return {
    sharpen: clamp(params.sharpen, 0, 100),
    clarity: clamp(params.clarity, 0, 100),
    vibrance: clamp(params.vibrance, 0, 100),
    autoTone: clamp(params.autoTone, 0, 100),
    smoothSkin: clamp(params.smoothSkin, 0, 100),
    upscaleMinLongSide: clamp(Math.round(params.upscaleMinLongSide), 0, 2400),
  };
}

export function computeTargetDimensions(
  naturalWidth: number,
  naturalHeight: number,
  upscaleMinLongSide: number
): { width: number; height: number; upscaled: boolean } {
  const w = Math.max(1, Math.round(naturalWidth));
  const h = Math.max(1, Math.round(naturalHeight));
  const longSide = Math.max(w, h);

  if (upscaleMinLongSide <= 0 || longSide >= upscaleMinLongSide) {
    // Cap absurdly huge 6K+ uploads to 2400px long side for crispness + speed
    if (longSide > 2400) {
      const scaleDown = 2400 / longSide;
      return {
        width: Math.max(1, Math.round(w * scaleDown)),
        height: Math.max(1, Math.round(h * scaleDown)),
        upscaled: false,
      };
    }
    return { width: w, height: h, upscaled: false };
  }

  // Cap upscale factor at 2.25x to avoid magnifying extreme low-res artifacts
  const desiredScale = Math.min(2.25, upscaleMinLongSide / longSide);
  if (desiredScale <= 1.03) {
    return { width: w, height: h, upscaled: false };
  }
  return {
    width: Math.min(2400, Math.round(w * desiredScale)),
    height: Math.min(2400, Math.round(h * desiredScale)),
    upscaled: true,
  };
}

/**
 * Separable 5-tap Gaussian blur [1, 4, 6, 4, 1] / 16 on Float32Array luminance buffer
 */
function blurFloatChannel(
  src: Float32Array,
  width: number,
  height: number
): Float32Array {
  const temp = new Float32Array(src.length);
  const dst = new Float32Array(src.length);

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const xm2 = x >= 2 ? x - 2 : 0;
      const xm1 = x >= 1 ? x - 1 : 0;
      const xp1 = x + 1 < width ? x + 1 : width - 1;
      const xp2 = x + 2 < width ? x + 2 : width - 1;
      temp[rowOffset + x] =
        (src[rowOffset + xm2] +
          src[rowOffset + xm1] * 4 +
          src[rowOffset + x] * 6 +
          src[rowOffset + xp1] * 4 +
          src[rowOffset + xp2]) *
        0.0625;
    }
  }

  // Vertical pass
  for (let y = 0; y < height; y++) {
    const ym2 = (y >= 2 ? y - 2 : 0) * width;
    const ym1 = (y >= 1 ? y - 1 : 0) * width;
    const y0 = y * width;
    const yp1 = (y + 1 < height ? y + 1 : height - 1) * width;
    const yp2 = (y + 2 < height ? y + 2 : height - 1) * width;
    for (let x = 0; x < width; x++) {
      dst[y0 + x] =
        (temp[ym2 + x] +
          temp[ym1 + x] * 4 +
          temp[y0 + x] * 6 +
          temp[yp1 + x] * 4 +
          temp[yp2 + x]) *
        0.0625;
    }
  }

  return dst;
}

/**
 * Pure pixel-level Studio Enhancement Engine (Luminance-only Unsharp Mask +
 * Edge-aware skin/noise smoothing + Auto-tone & Shadow recovery + Micro-clarity +
 * Skin-safe natural vibrance).
 * Works deterministically on raw RGBA buffers for both Browser Canvas & Node unit tests.
 */
export function enhanceRgbaPixels(
  input: Uint8ClampedArray,
  width: number,
  height: number,
  rawParams: EnhanceParams
): Uint8ClampedArray {
  const params = clampEnhanceParams(rawParams);
  const pixelCount = width * height;
  if (pixelCount <= 0 || input.length < pixelCount * 4) {
    return new Uint8ClampedArray(input);
  }

  const out = new Uint8ClampedArray(input.length);
  const lum = new Float32Array(pixelCount);

  // Build luminance & histogram in one pass
  const hist = new Uint32Array(256);
  const stride = Math.max(1, Math.floor(pixelCount / 120000));
  let sampledCount = 0;

  for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
    const l = 0.299 * input[p] + 0.587 * input[p + 1] + 0.114 * input[p + 2];
    lum[i] = l;
    if (i % stride === 0 && input[p + 3] > 16) {
      hist[Math.max(0, Math.min(255, Math.round(l)))]++;
      sampledCount++;
    }
  }

  // 1. Histogram percentile bounds for gentle Auto-Tone & Shadow lift
  let lowBound = 0;
  let highBound = 255;
  if (sampledCount > 50 && params.autoTone > 0) {
    const lowTarget = sampledCount * 0.008;
    const highTarget = sampledCount * 0.992;
    let acc = 0;
    for (let b = 0; b < 256; b++) {
      acc += hist[b];
      if (acc >= lowTarget) {
        lowBound = b;
        break;
      }
    }
    acc = 0;
    for (let b = 0; b < 256; b++) {
      acc += hist[b];
      if (acc >= highTarget) {
        highBound = b;
        break;
      }
    }
  }

  const toneStrength = params.autoTone / 100;
  const canStretchLevels = toneStrength > 0 && highBound - lowBound > 28;
  // Blend toward auto-levels gently (max 58% stretch) and clamp black/white lift to keep contrast natural
  const effectiveLow = canStretchLevels ? Math.min(48, lowBound * 0.85) : 0;
  const effectiveHigh = canStretchLevels ? Math.max(205, highBound + (255 - highBound) * 0.15) : 255;
  const levelSpan = Math.max(1, effectiveHigh - effectiveLow);
  const levelBlend = toneStrength * 0.58;

  // 2. Blur passes for Unsharp Mask (fine edges) & Clarity (midtone structure)
  const blur1 =
    params.sharpen > 0 || params.smoothSkin > 0 || params.clarity > 0
      ? blurFloatChannel(lum, width, height)
      : lum;
  const blur2 = params.clarity > 0 ? blurFloatChannel(blur1, width, height) : blur1;

  const sharpAmount = (params.sharpen / 100) * 1.5;
  const clarityAmount = (params.clarity / 100) * 0.62;
  const smoothStrength = params.smoothSkin / 100;
  const vibranceStrength = params.vibrance / 100;
  const coringThreshold = 2.0 + smoothStrength * 3.4;

  // 3. Apply per-pixel studio pipeline
  for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
    const r0 = input[p];
    const g0 = input[p + 1];
    const b0 = input[p + 2];
    const a0 = input[p + 3];

    if (a0 === 0) {
      out[p] = 0;
      out[p + 1] = 0;
      out[p + 2] = 0;
      out[p + 3] = 0;
      continue;
    }

    const l0 = lum[i];
    const lBlur1 = blur1[i];
    const lBlur2 = blur2[i];

    // Fine detail (eyes, hair, crisp contours) & medium detail (clarity)
    const fineDetail = l0 - lBlur1;
    const absFine = Math.abs(fineDetail);
    const mediumDetail = lBlur1 - lBlur2;

    // A. Edge-aware smoothing on flat/skin areas (when |fineDetail| < coringThreshold)
    let r = r0;
    let g = g0;
    let b = b0;
    let lCur = l0;

    if (smoothStrength > 0 && absFine < coringThreshold && l0 > 12) {
      // Softly reduce compression grain / skin blemishes by pulling luminance slightly toward lBlur1
      // while scaling RGB smoothly so color stays clean
      const smoothFactor = smoothStrength * 0.45 * (1 - absFine / coringThreshold);
      const smoothedL = l0 + (lBlur1 - l0) * smoothFactor;
      const ratio = smoothedL / Math.max(1, l0);
      r = Math.min(255, r0 * ratio);
      g = Math.min(255, g0 * ratio);
      b = Math.min(255, b0 * ratio);
      lCur = smoothedL;
    }

    // B. Auto-tone (levels + gentle shadow lift + soft studio S-curve)
    let targetL = lCur;
    if (toneStrength > 0) {
      if (canStretchLevels) {
        const stretched = Math.max(0, Math.min(255, ((lCur - effectiveLow) / levelSpan) * 255));
        targetL = lCur + (stretched - lCur) * levelBlend;
      }
      // Subtle shadow recovery on dark areas (L < 110)
      if (targetL < 110) {
        const shadowWeight = 1 - targetL / 110;
        targetL += toneStrength * 14 * shadowWeight * (targetL / 110 + 0.25);
      }
    }

    // Subtle S-curve contrast proportional to clarity
    if (clarityAmount > 0) {
      const norm = targetL / 255;
      const sCurve = norm - 0.14 * (params.clarity / 100) * Math.sin(norm * Math.PI * 2);
      targetL = Math.max(0, Math.min(255, sCurve * 255));
    }

    // C. Luminance-only Unsharp Mask with Coring + Halo Clamping
    let sharpDelta = 0;
    if (sharpAmount > 0 && absFine >= coringThreshold) {
      const effectiveDetail = fineDetail > 0 ? fineDetail - coringThreshold : fineDetail + coringThreshold;
      sharpDelta = Math.max(-44, Math.min(44, sharpAmount * effectiveDetail));
    }

    // D. Midtone Clarity boost
    let clarityDelta = 0;
    if (clarityAmount > 0) {
      clarityDelta = Math.max(-28, Math.min(28, clarityAmount * mediumDetail));
    }

    const totalDeltaL = (targetL - lCur) + sharpDelta + clarityDelta;

    if (Math.abs(totalDeltaL) > 0.01) {
      if (lCur > 8) {
        // Scale RGB proportionally by target luminance ratio to prevent color shifts
        const nextL = Math.max(0, Math.min(255, lCur + totalDeltaL));
        const scale = nextL / lCur;
        // Blend luminance scaling + additive highlight tail when channels approach 255
        r = r * scale;
        g = g * scale;
        b = b * scale;
      } else {
        r += totalDeltaL;
        g += totalDeltaL;
        b += totalDeltaL;
      }
    }

    // E. Skin-safe Natural Vibrance (boosts muted hues, protects already-saturated reds/skin)
    if (vibranceStrength > 0) {
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const deltaC = maxC - minC;
      if (deltaC > 1.5 && maxC > 4) {
        const sat = deltaC / maxC;
        const avgL = 0.299 * r + 0.587 * g + 0.114 * b;
        // Extra protection for warm skin-tone range (R > G > B)
        const isWarmSkin = r > g && g > b && (r - b) < 110;
        const skinDampen = isWarmSkin ? 0.65 : 1.0;
        const boost = 1 + vibranceStrength * 0.55 * (1 - sat * 0.85) * skinDampen;
        r = avgL + (r - avgL) * boost;
        g = avgL + (g - avgL) * boost;
        b = avgL + (b - avgL) * boost;
      }
    }

    out[p] = r < 0 ? 0 : r > 255 ? 255 : Math.round(r);
    out[p + 1] = g < 0 ? 0 : g > 255 ? 255 : Math.round(g);
    out[p + 2] = b < 0 ? 0 : b > 255 ? 255 : Math.round(b);
    out[p + 3] = a0;
  }

  return out;
}

export interface EnhancedImageResult {
  enhancedDataUrl: string;
  originalWidth: number;
  originalHeight: number;
  outputWidth: number;
  outputHeight: number;
  upscaled: boolean;
}

function loadCorsImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      if (!src.startsWith('data:') && !src.startsWith('blob:') && !src.includes('wsrv.nl')) {
        const proxyImg = new window.Image();
        proxyImg.crossOrigin = 'anonymous';
        proxyImg.onload = () => resolve(proxyImg);
        proxyImg.onerror = () => reject(new Error('Không thể đọc dữ liệu pixel của ảnh (CORS).'));
        proxyImg.src = `https://wsrv.nl/?url=${encodeURIComponent(src)}&output=png`;
      } else {
        reject(new Error('Không thể tải ảnh để làm nét.'));
      }
    };
    img.src = src;
  });
}

function drawProgressiveUpscale(
  img: HTMLImageElement,
  targetW: number,
  targetH: number
): HTMLCanvasElement {
  const natW = Math.max(1, img.naturalWidth || img.width);
  const natH = Math.max(1, img.naturalHeight || img.height);

  let currentCanvas: HTMLCanvasElement | null = null;
  let curW = natW;
  let curH = natH;

  // Progressive multi-pass upscale (~1.5x per pass) gives visibly cleaner edges than single-jump scaling
  if (targetW > curW * 1.45) {
    const midW = Math.round((curW + targetW) * 0.52);
    const midH = Math.round((curH + targetH) * 0.52);
    const stepCanvas = document.createElement('canvas');
    stepCanvas.width = midW;
    stepCanvas.height = midH;
    const sCtx = stepCanvas.getContext('2d');
    if (sCtx) {
      sCtx.imageSmoothingEnabled = true;
      sCtx.imageSmoothingQuality = 'high';
      sCtx.drawImage(img, 0, 0, midW, midH);
      currentCanvas = stepCanvas;
      curW = midW;
      curH = midH;
    }
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = targetW;
  outCanvas.height = targetH;
  const ctx = outCanvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh 2D Canvas.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (currentCanvas) {
    ctx.drawImage(currentCanvas, 0, 0, curW, curH, 0, 0, targetW, targetH);
  } else {
    ctx.drawImage(img, 0, 0, targetW, targetH);
  }
  return outCanvas;
}

/**
 * Browser pipeline: loads image (with CORS proxy fallback), progressively upscales to HD if needed,
 * runs studio pixel enhancement, and outputs a crisp high-quality data URL.
 */
export async function enhanceImageSource(
  src: string,
  params: EnhanceParams
): Promise<EnhancedImageResult> {
  const img = await loadCorsImage(src);
  const natW = Math.max(1, img.naturalWidth || img.width);
  const natH = Math.max(1, img.naturalHeight || img.height);
  const { width: targetW, height: targetH, upscaled } = computeTargetDimensions(
    natW,
    natH,
    params.upscaleMinLongSide
  );

  const workCanvas = drawProgressiveUpscale(img, targetW, targetH);
  const ctx = workCanvas.getContext('2d');
  if (!ctx) throw new Error('Cannot access canvas 2d context');

  const imgData = ctx.getImageData(0, 0, targetW, targetH);
  const enhancedPixels = enhanceRgbaPixels(imgData.data, targetW, targetH, params);

  // Detect whether any pixel has meaningful transparency
  let hasAlpha = false;
  for (let p = 3; p < enhancedPixels.length; p += 64) {
    if (enhancedPixels[p] < 252) {
      hasAlpha = true;
      break;
    }
  }

  const outImgData = new ImageData(new Uint8ClampedArray(enhancedPixels), targetW, targetH);
  ctx.putImageData(outImgData, 0, 0);

  const enhancedDataUrl = hasAlpha
    ? workCanvas.toDataURL('image/png')
    : workCanvas.toDataURL('image/jpeg', 0.96);

  return {
    enhancedDataUrl,
    originalWidth: natW,
    originalHeight: natH,
    outputWidth: targetW,
    outputHeight: targetH,
    upscaled,
  };
}
