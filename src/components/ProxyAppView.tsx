import React, { useState, useRef } from 'react';
import {
  ExternalLink,
  RefreshCw,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Server,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { ProxyItem, AppUser } from '../types';
import { ProxyManagementTable } from './ProxyManagementTable';

interface ProxyAppViewProps {
  currentUser: AppUser;
  proxies: ProxyItem[];
  availableStaffNames: string[];
  onAddProxy: (proxy: ProxyItem) => Promise<void>;
  onAddBatchProxies?: (proxies: ProxyItem[]) => Promise<void>;
  onUpdateProxy: (id: string, updates: Partial<ProxyItem>) => Promise<void>;
  onDeleteProxy: (id: string) => Promise<void>;
  onDeleteBatchProxies?: (ids: string[]) => Promise<void>;
  onOpenAddModal: () => void;
  onOpenBulkImportModal: () => void;
  onEditProxy?: (proxy: ProxyItem) => void;
}

export const ProxyAppView: React.FC<ProxyAppViewProps> = ({
  currentUser,
  proxies,
  availableStaffNames,
  onAddProxy,
  onAddBatchProxies,
  onUpdateProxy,
  onDeleteProxy,
  onDeleteBatchProxies,
  onOpenAddModal,
  onOpenBulkImportModal,
  onEditProxy,
}) => {
  const [activeSubView, setActiveSubView] = useState<'app' | 'cloud_table'>('app');
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleRefreshIframe = () => {
    setIframeKey((prev) => prev + 1);
  };

  const handleOpenNewTab = () => {
    window.open('/proxy-app/index.html', '_blank');
  };

  const handleOpenVercelApp = () => {
    window.open('https://nghean37378237-proxy-37-ce87.vercel.app/', '_blank');
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
      setIsFullscreen(true);
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`w-full flex flex-col bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden transition-all duration-200 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'min-h-[820px]'
      }`}
    >
      {/* Top Header / Controller Bar */}
      <div className="bg-slate-950/95 border-b border-slate-800/90 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-slate-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-cyan-500/25">
            PX
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-white tracking-wide">
                ProxySwitcher Pro
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
                192.168.1.27
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Đồng bộ chuẩn Vercel
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden md:block">
              Quản lý Dcom & Proxy Farm 4000-4030 • Phân chia 3 nhân viên (NV01, NV02, NV03) • Đổi IP & LAN Monitor
            </p>
          </div>
        </div>

        {/* View Switcher & Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* Subview Selector */}
          <div className="inline-flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveSubView('app')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeSubView === 'app'
                  ? 'bg-cyan-600 text-white shadow-xs font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>ProxySwitcher Pro (Gốc)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubView('cloud_table')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeSubView === 'cloud_table'
                  ? 'bg-teal-600 text-white shadow-xs font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Bảng Cloud Firestore ({proxies.length})</span>
            </button>
          </div>

          {activeSubView === 'app' && (
            <>
              {/* Refresh button */}
              <button
                type="button"
                onClick={handleRefreshIframe}
                title="Tải lại ứng dụng Proxy"
                className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              {/* Fullscreen button */}
              <button
                type="button"
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
                className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              {/* Open in new tab button */}
              <button
                type="button"
                onClick={handleOpenNewTab}
                title="Mở ứng dụng trong tab riêng biệt"
                className="hidden sm:inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Tab riêng</span>
              </button>

              {/* Open Vercel link */}
              <button
                type="button"
                onClick={handleOpenVercelApp}
                title="Mở link Vercel gốc: https://nghean37378237-proxy-37-ce87.vercel.app/"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <span>Vercel App</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full bg-slate-950 relative overflow-hidden flex flex-col">
        {activeSubView === 'app' ? (
          <iframe
            key={iframeKey}
            src="/proxy-app/index.html"
            className="w-full flex-1 border-0 min-h-[750px] h-[calc(100vh-180px)]"
            title="ProxySwitcher Pro"
            allow="clipboard-write; clipboard-read; fullscreen"
          />
        ) : (
          <div className="p-4 bg-slate-50 flex-1 overflow-auto">
            <ProxyManagementTable
              proxies={proxies}
              currentUser={currentUser}
              availableStaffNames={availableStaffNames}
              onAddProxy={onAddProxy}
              onAddBatchProxies={onAddBatchProxies}
              onUpdateProxy={onUpdateProxy}
              onDeleteProxy={onDeleteProxy}
              onDeleteBatchProxies={onDeleteBatchProxies}
              onOpenAddModal={onOpenAddModal}
              onOpenBulkImportModal={onOpenBulkImportModal}
              onEditProxy={onEditProxy}
            />
          </div>
        )}
      </div>
    </div>
  );
};
