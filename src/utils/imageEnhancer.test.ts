import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeTargetDimensions,
  enhanceRgbaPixels,
  getPresetParams,
  ENHANCE_PRESETS,
} from './imageEnhancer';

test('computeTargetDimensions upscales small images smoothly up to cap without breaking aspect', () => {
  const res = computeTargetDimensions(600, 800, 1800);
  assert.equal(res.upscaled, true);
  // 2.25x cap -> 600*2.25=1350, 800*2.25=1800
  assert.equal(res.width, 1350);
  assert.equal(res.height, 1800);

  const alreadyHd = computeTargetDimensions(1920, 1080, 1800);
  assert.equal(alreadyHd.upscaled, false);
  assert.equal(alreadyHd.width, 1920);
  assert.equal(alreadyHd.height, 1080);

  const capped4k = computeTargetDimensions(4800, 3200, 1800);
  assert.equal(capped4k.upscaled, false);
  assert.equal(capped4k.width, 2400);
  assert.equal(capped4k.height, 1600);
});

test('enhanceRgbaPixels sharpens step edges while keeping uniform flat regions clean', () => {
  const w = 16;
  const h = 16;
  const buf = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      // Left half darker gray (90), right half brighter gray (170)
      const val = x < 8 ? 90 : 170;
      buf[idx] = val;
      buf[idx + 1] = val;
      buf[idx + 2] = val;
      buf[idx + 3] = 255;
    }
  }

  const params = getPresetParams('natural_sharp');
  params.autoTone = 0;
  params.vibrance = 0;
  params.smoothSkin = 0;

  const out = enhanceRgbaPixels(buf, w, h, params);

  // At the left side of the edge (x=7), sharpening darkens slightly; right side (x=8) brightens slightly
  const edgeLeftIdx = (8 * w + 7) * 4;
  const edgeRightIdx = (8 * w + 8) * 4;
  const farLeftIdx = (8 * w + 1) * 4;
  const farRightIdx = (8 * w + 14) * 4;

  assert.ok(out[edgeLeftIdx] < out[farLeftIdx], 'Dark edge side should sharpen darker than flat interior');
  assert.ok(out[edgeRightIdx] > out[farRightIdx], 'Bright edge side should sharpen brighter than flat interior');
  // Grayscale neutrality preserved
  assert.equal(out[edgeRightIdx], out[edgeRightIdx + 1]);
  assert.equal(out[edgeRightIdx + 1], out[edgeRightIdx + 2]);
});

test('enhanceRgbaPixels boosts muted colors with vibrance while preserving transparency', () => {
  const w = 8;
  const h = 8;
  const buf = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    if (i === 0) {
      // Transparent pixel should remain transparent
      buf[p] = 120;
      buf[p + 1] = 80;
      buf[p + 2] = 70;
      buf[p + 3] = 0;
    } else {
      buf[p] = 150;
      buf[p + 1] = 130;
      buf[p + 2] = 120;
      buf[p + 3] = 255;
    }
  }

  const out = enhanceRgbaPixels(buf, w, h, {
    sharpen: 0,
    clarity: 0,
    vibrance: 80,
    autoTone: 0,
    smoothSkin: 0,
    upscaleMinLongSide: 0,
  });

  // Alpha 0 stays 0
  assert.equal(out[3], 0);
  // Color separation R - B increased on opaque pixel
  const origDiff = buf[4] - buf[6];
  const newDiff = out[4] - out[6];
  assert.ok(newDiff > origDiff, `Expected color diff ${newDiff} > ${origDiff}`);
});

test('all default enhance presets have valid parameter bounds', () => {
  assert.equal(ENHANCE_PRESETS.length, 3);
  for (const preset of ENHANCE_PRESETS) {
    assert.ok(preset.params.sharpen >= 50 && preset.params.sharpen <= 100);
    assert.ok(preset.params.upscaleMinLongSide >= 1600);
  }
});
