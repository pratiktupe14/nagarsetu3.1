import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('NAGARSETU React ErrorBoundary caught an exception:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col justify-center items-center p-6 text-center">
          <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-gray-200 shadow-md space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            
            <h2 className="text-xl font-extrabold text-gray-900 font-outfit">Unable to load your dashboard.</h2>
            <p className="text-xs text-gray-600 leading-relaxed">
              An unexpected error occurred while rendering the interface.
            </p>

            {this.state.error && (
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 font-mono text-[11px] text-rose-700 text-left overflow-x-auto max-h-32">
                {this.state.error.message}
              </div>
            )}

            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center space-x-1.5 transition-all min-h-[44px]"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Try Again / Reload Page</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
