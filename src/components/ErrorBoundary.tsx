import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw, FileText, Send, Check } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  reported: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State;
  props: Props;
  setState: (
    state: Partial<State> | ((prevState: State) => Partial<State>),
    callback?: () => void
  ) => void;
  constructor(props: Props) {
    super(props);
    this.setState = super.setState.bind(this);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      reported: false,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, reported: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Auto-record to active browser diagnostics logs
    const existingLogs = localStorage.getItem('xennials_diagnostic_logs');
    const logs = existingLogs ? JSON.parse(existingLogs) : [];
    logs.push({
      timestamp: new Date().toISOString(),
      message: error.message || 'Fatal Runtime Exception',
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      severity: 'fatal',
    });
    localStorage.setItem('xennials_diagnostic_logs', JSON.stringify(logs.slice(-20))); // Keep last 20
    
    console.error('ErrorBoundary captured a fatal crash:', error, errorInfo);
  }

  handleReport = () => {
    this.setState({ reported: true });
    // Simulate telemetry transmitting of logs
    try {
      const errorPayload = {
        error: this.state.error?.message,
        stack: this.state.error?.stack,
        componentStack: this.state.errorInfo?.componentStack,
        timestamp: new Date().toISOString(),
        env: 'development',
      };
      console.log('Telemetry payload transmitted to diagnostic hub:', errorPayload);
    } catch (e) {
      console.error('Failed to send failure diagnostics:', e);
    }
  };

  handleReset = () => {
    try {
      // Clear specific troubleshooting state keys or entire storage to restore stability
      localStorage.removeItem('xennials_diagnostic_logs');
      // Force reload to completely clean active React context stacks
      window.location.reload();
    } catch (e) {
      window.location.href = window.location.pathname;
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#08080c] flex items-center justify-center p-6 text-zinc-300 font-sans">
          <div className="max-w-2xl w-full bg-[#111116] border border-red-500/20 rounded-[32px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
            
            {/* Elegant warning backdrop */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/5 rounded-full filter blur-3xl -z-10" />
            
            <div className="space-y-6">
              <div className="flex items-center gap-4 border-b border-zinc-800/60 pb-6">
                <div className="w-12 h-12 bg-red-950/40 border border-red-500/30 rounded-2xl flex items-center justify-center text-red-500">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-black text-white uppercase tracking-wider">Xennials Studio</h1>
                  <p className="text-xs text-red-400 font-medium tracking-wide">Fatal Run-time Exception Intercepted</p>
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-zinc-100">What went wrong?</h2>
                <div className="bg-[#171720] border border-zinc-800 rounded-2xl p-4 font-mono text-xs text-red-300 overflow-x-auto max-h-48 whitespace-pre">
                  {this.state.error?.toString() || 'Unknown runtime error'}
                  {this.state.errorInfo && (
                    <div className="text-zinc-500 mt-2 border-t border-zinc-800/50 pt-2 text-[10px]">
                      {this.state.errorInfo.componentStack}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-2xl p-4 text-xs space-y-2 text-zinc-400">
                <div className="flex justify-between">
                  <span className="font-medium text-zinc-500">Execution State:</span>
                  <span className="font-mono text-zinc-300">corrupted_render_catch</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-zinc-500">Platform Isolation:</span>
                  <span className="font-mono text-emerald-500">Client-Side Sandbox Active</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                <button
                  onClick={this.handleReport}
                  disabled={this.state.reported}
                  className={`py-3 px-5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all ${
                    this.state.reported
                      ? 'bg-zinc-900/60 border-zinc-800 text-zinc-500 cursor-default'
                      : 'bg-zinc-800/50 hover:bg-zinc-800 border-zinc-700 hover:border-zinc-600 text-white active:scale-98'
                  }`}
                >
                  {this.state.reported ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span>Diagnostics Submitted</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-blue-400" />
                      <span>Transmit Crash Report</span>
                    </>
                  )}
                </button>

                <button
                  onClick={this.handleReset}
                  className="py-3 px-5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:scale-98 transition-all text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-red-900/30 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset Application State</span>
                </button>
              </div>

              <p className="text-center text-[10px] text-zinc-600 font-light pt-2">
                Restoring will clean the error stack and restart standard sound synthesis modules.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
