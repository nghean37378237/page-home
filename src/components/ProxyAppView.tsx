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
  const [activeSubView, setActiveSubView] = useState<'app' | 'cloud_table'>('cloud_table');
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [monitorUrl, setMonitorUrl] = useState<string>('http://192.168.1.27/home');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isAdmin = currentUser.role === 'admin';
  const myStaffNameLower = (currentUser.name || '').trim().toLowerCase();
  const scopedProxiesCount = isAdmin
    ? proxies.length
    : proxies.filter((p) => {
        const assigned = p.assignedStaff || [];
        if (assigned.includes('ALL')) return true;
        return assigned.some((s) => s.trim().toLowerCase() === myStaffNameLower);
      }).length;

  const handleRefreshIframe = () => {
    setIframeKey((prev) => prev + 1);
  };

  const handleOpenPopout = () => {
    window.open(
      monitorUrl,
      'proxy_home_pip',
      'width=960,height=720,left=80,top=60,menubar=no,toolbar=no,location=no,status=no,resizable=yes'
    );
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
        isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen' : activeSubView === 'app' ? 'h-[calc(100vh-110px)] min-h-[780px]' : 'min-h-[820px]'
      }`}
    >
      {/* Top Header / Controller Bar */}
      <div className="bg-slate-950/95 border-b border-slate-800/90 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-slate-200 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-cyan-500/25">
            PX
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-white tracking-wide">
                {activeSubView === 'app' ? 'Soi Trực Tiếp Trang Chủ' : 'ProxySwitcher Pro'}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-mono">
                192.168.1.27
              </span>
            </div>
          </div>
        </div>

        {/* Center URL & Live Monitor Controls when in ProxySwitcher Pro (Tool) */}
        {activeSubView === 'app' && (
          <div className="flex items-center gap-2 flex-1 max-w-2xl mx-2">
            <div className="flex items-center gap-2 flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span className="text-cyan-400 font-semibold shrink-0 hidden sm:inline">
                Soi Trực Tiếp Trang Chủ:
              </span>
              <input
                type="text"
                value={monitorUrl}
                onChange={(e) => setMonitorUrl(e.target.value)}
                className="font-mono text-cyan-300 bg-transparent border-0 focus:outline-none flex-1 min-w-0 truncate"
                placeholder="http://192.168.1.27/home"
              />
            </div>

            <button
              type="button"
              onClick={handleRefreshIframe}
              title="Làm mới trang chủ"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Làm mới</span>
            </button>

            <button
              type="button"
              onClick={handleOpenPopout}
              title="Mở cửa sổ nhỏ nổi"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-800/70 text-cyan-300 text-xs font-medium transition-colors cursor-pointer shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
              <span>Cửa sổ nổi</span>
            </button>

            <a
              href={monitorUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors shrink-0"
            >
              <span>Mở Tab Riêng</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* View Switcher & Fullscreen Button */}
        <div className="flex items-center space-x-2">
          <div className="inline-flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
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
              <span>
                {isAdmin
                  ? `Bảng Quản Lý Proxy (${proxies.length})`
                  : `Proxy Của Tôi (${scopedProxiesCount})`}
              </span>
            </button>
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
              <span>ProxySwitcher Pro (Tool)</span>
            </button>
          </div>

          {activeSubView === 'app' && (
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full bg-slate-950 relative overflow-hidden flex flex-col">
        {activeSubView === 'app' ? (
          <iframe
            key={iframeKey}
            src={monitorUrl}
            className="w-full flex-1 h-full border-0 bg-white"
            title="Soi Trực Tiếp Trang Chủ 192.168.1.27"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
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
