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
        <div className="flex-1 w-full h-full flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
          <div className="max-w-md w-full bg-slate-900/90 border border-red-500/30 rounded-2xl p-6 shadow-2xl text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">
                {this.props.fallbackText || 'Ошибка загрузки модуля'}
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Не удалось загрузить компонент интерфейса. Проверьте интернет-соединение и повторите попытку.
              </p>
            </div>
            <button
              onClick={this.handleRetry}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-all shadow-lg shadow-emerald-900/30 active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              Повторить попытку
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const RoomLoadingFallback: React.FC = () => (
  <div className="flex-1 w-full h-full flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
    <div className="flex flex-col items-center gap-3">
      <div className="w-9 h-9 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
      <span className="text-sm font-medium text-slate-300">Подключение к комнате...</span>
    </div>
  </div>
);
