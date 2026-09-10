import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-center flex flex-col items-center justify-center gap-2 m-2">
          <AlertTriangle className="w-6 h-6 text-rose-400 animate-pulse" />
          <h3 className="text-xs font-bold text-rose-200">
            {this.props.name || 'Bu bölüm'} yüklenirken geçici bir sorun oluştu
          </h3>
          <p className="text-[10.5px] text-rose-300/80 max-w-xs">
            {this.state.error?.message || 'Bilinmeyen arayüz hatası'}
          </p>
          <button
            onClick={this.handleReset}
            className="mt-1 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-md cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Yeniden Dene</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
