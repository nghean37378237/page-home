import rawPresets from './collagePresets.json';
import { CollagePreset } from '../types';

export const COLLAGE_PRESETS: CollagePreset[] = rawPresets as CollagePreset[];

export interface BackgroundPreset {
  type: 'color' | 'gradient';
  value: string;
  name: string;
}

export const COLLAGE_BACKGROUNDS: BackgroundPreset[] = [
  { type: 'color', value: '#FFFFFF', name: 'Trắng tinh khôi' },
  { type: 'color', value: '#F8FAFC', name: 'Trắng xám nhẹ' },
  { type: 'color', value: '#F5F5F0', name: 'Kem Vintage' },
  { type: 'color', value: '#FEE2E2', name: 'Hồng phấn pastel' },
  { type: 'color', value: '#E0F2FE', name: 'Xanh mây pastel' },
  { type: 'color', value: '#ECFDF5', name: 'Xanh bơ mát dịu' },
  { type: 'color', value: '#FEF3C7', name: 'Vàng bơ ấm' },
  { type: 'color', value: '#F3E8FF', name: 'Tím lavender' },
  { type: 'color', value: '#18181B', name: 'Đen sang trọng' },
  { type: 'color', value: '#27272A', name: 'Xám than chì' },
  { type: 'color', value: '#334155', name: 'Xám đá slate' },
  { type: 'gradient', value: 'linear-gradient(135deg, #fdfcfb 0%, #e2d1c3 100%)', name: 'Be ấm gradient' },
  { type: 'gradient', value: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%)', name: 'Hoàng hôn pastel' },
  { type: 'gradient', value: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)', name: 'Bầu trời dịu êm' },
  { type: 'gradient', value: 'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)', name: 'Mầm xanh thiên nhiên' },
  { type: 'gradient', value: 'linear-gradient(135deg, #2b5876 0%, #4e4376 100%)', name: 'Đêm huyền bí' },
  { type: 'gradient', value: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)', name: 'Cam nắng mai' },
];

export interface RatioOption {
  id: string;
  label: string;
  sub: string;
  aspect: number; // width / height
  exportWidth: number;
  exportHeight: number;
}

export const COLLAGE_RATIOS: RatioOption[] = [
  { id: '1:1', label: '1:1 Vuông', sub: 'Feed FB / IG', aspect: 1, exportWidth: 1080, exportHeight: 1080 },
  { id: '4:5', label: '4:5 Dọc', sub: 'Chuẩn Feed FB/IG', aspect: 4 / 5, exportWidth: 1080, exportHeight: 1350 },
  { id: '9:16', label: '9:16 Story', sub: 'Story FB / Reels', aspect: 9 / 16, exportWidth: 1080, exportHeight: 1920 },
  { id: '3:4', label: '3:4 Dọc', sub: 'Chân dung FB', aspect: 3 / 4, exportWidth: 1080, exportHeight: 1440 },
  { id: '16:9', label: '16:9 Ngang', sub: 'Banner / Video', aspect: 16 / 9, exportWidth: 1920, exportHeight: 1080 },
];

export const SAMPLE_STUDIO_IMAGES = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80',
];
