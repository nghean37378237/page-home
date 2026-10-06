import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw, ArrowLeft } from 'lucide-react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
  onGoBack?: () => void;
}

interface State {
  hasError: boolean;
  errorSafeMessage: string;
}

/**
 * Lớp bảo vệ Error Boundary chuyên dụng cho Bảng Full Via:
 * Chặn đứng mọi trường hợp crash / bug code làm rò rỉ hoặc in dữ liệu UID, PASS, 2FA ra ngoài giao diện.
 */
export class FullViaErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    errorSafeMessage: '',
  };

  static getDerivedStateFromError(error: Error): State {
    // Trả về thông báo chung, không lộ dữ liệu nhạy cảm
    return {
      hasError: true,
      errorSafeMessage: error?.message ? 'Lỗi xử lý bảng dữ liệu' : 'Đã phát hiện xung đột hiển thị',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Ghi log bảo mật nội bộ, TUYỆT ĐỐI KHÔNG log payload chứa pass hoặc 2fa
    console.warn('[FullViaSecurity] Đã kích hoạt cơ chế cách ly bảo vệ bảng Full Via');
  }

  handleReload = (): void => {
    this.setState({ hasError: false, errorSafeMessage: '' });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="mt-6 p-8 bg-white border border-rose-200 rounded-2xl shadow-sm text-center max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-600 shadow-xs">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-slate-900 tracking-tight mb-2">
            Đã Kích Hoạt Cơ Chế Bảo Vệ Cách Ly Dữ Liệu Full Via
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed mb-6">
            Hệ thống an ninh phát hiện một xung đột mã và đã lập tức ngắt kết nối hiển thị nhằm ngăn chặn nguy cơ rò rỉ thông tin mật khẩu (PASS) và mã 2FA. Toàn bộ kho nick của bạn vẫn được lưu trữ và mã hóa an toàn 100%.
          </p>

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Khôi Phục Hiển Thị An Toàn</span>
            </button>

            {this.props.onGoBack && (
              <button
                type="button"
                onClick={this.props.onGoBack}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Về Bảng 1: Fanpage</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
