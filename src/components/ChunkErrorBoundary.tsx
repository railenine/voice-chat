import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackText?: string;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ChunkErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ChunkErrorBoundary] Uncaught chunk loading error:', error, errorInfo);
  }

  private handleRetry = () => {
    if (this.props.onRetry) {
      this.props.onRetry();
    }
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 w-full h-full flex items-center justify-center p-6 bg-(--bg)/90 backdrop-blur-md">
          <div className="max-w-md w-full bg-(--surface) border border-(--border) rounded-(--radius) p-6 shadow-2xl text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-(--radius) bg-(--danger-soft) border border-(--danger-border) flex items-center justify-center text-(--danger) shadow-xs">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-(--fg)">
                {this.props.fallbackText || 'Ошибка загрузки модуля'}
              </h3>
              <p className="text-xs sm:text-sm text-(--muted) mt-1.5 leading-relaxed">
                Не удалось загрузить компонент интерфейса. Проверьте интернет-соединение и повторите попытку.
              </p>
            </div>
            <button
              type="button"
              onClick={this.handleRetry}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 min-h-11 rounded-(--radius) bg-(--accent) text-(--bg) font-semibold text-sm transition-all cursor-pointer hover:bg-[color-mix(in_oklch,var(--accent)_88%,var(--bg))] active:translate-y-px focus:outline-none focus-visible:outline-2 focus-visible:outline-(--accent) focus-visible:outline-offset-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Повторить попытку</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const RoomLoadingFallback: React.FC = () => (
  <div className="flex-1 w-full h-full flex items-center justify-center bg-(--bg)">
    <div className="flex flex-col items-center gap-3">
      <div className="w-9 h-9 border-2 border-(--border) border-t-(--accent) rounded-full animate-spin" />
      <span className="text-xs sm:text-sm font-medium text-(--muted)">Подключение к комнате...</span>
    </div>
  </div>
);
