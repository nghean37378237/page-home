import React, { useEffect, useState } from 'react';
import { Download, FolderOpen, X } from 'lucide-react';
import {
  ImageSaveFormat,
  sanitizeImageFileName,
  triggerDirectBlobDownload,
} from '../utils/saveImageWithPicker';

export interface PendingFallbackSaveData {
  blob: Blob;
  suggestedName: string;
  format: ImageSaveFormat;
}

interface SaveImageConfirmModalProps {
  pendingSave: PendingFallbackSaveData | null;
  onClose: () => void;
  onSaved?: (savedFileName: string) => void;
}

export const SaveImageConfirmModal: React.FC<SaveImageConfirmModalProps> = ({
  pendingSave,
  onClose,
  onSaved,
}) => {
  const [fileNameInput, setFileNameInput] = useState('');

  useEffect(() => {
    if (pendingSave) {
      setFileNameInput(pendingSave.suggestedName);
    }
  }, [pendingSave]);

  if (!pendingSave) return null;

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = sanitizeImageFileName(
      fileNameInput || pendingSave.suggestedName,
      pendingSave.format
    );
    triggerDirectBlobDownload(pendingSave.blob, finalName);
    onSaved?.(finalName);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900">
                Chọn Tên File &amp; Xác Nhận Lưu Ảnh
              </h4>
              <p className="text-[11px] text-slate-500">
                Định dạng: {pendingSave.format === 'png' ? 'PNG nét cao' : 'JPEG nhẹ'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tên file ảnh sẽ lưu:
            </label>
            <input
              type="text"
              value={fileNameInput}
              onChange={(e) => setFileNameInput(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-rose-500 focus:outline-none text-xs font-bold text-slate-900"
            />
          </div>

          <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-2.5 leading-relaxed">
            Mẹo: Nếu trình duyệt chưa bật hỏi thư mục lưu tự động khi chạy trong khung nhúng, hãy mở trình duyệt ở tab riêng hoặc bật mục <b>&quot;Hỏi vị trí lưu từng tệp trước khi tải xuống&quot;</b> trong Cài đặt Tải xuống của Chrome/Edge.
          </p>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 shadow cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Lưu Ảnh Về Máy</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
