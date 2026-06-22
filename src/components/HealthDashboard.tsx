import React, { useEffect, useState } from 'react';
import { Activity, ShieldAlert, Cpu, Music, Volume2, ShieldCheck, X, Zap } from 'lucide-react';
import { HealthMetrics } from '../utils/useAppHealth';

interface DiagnosticLogItem {
  timestamp: string;
  message: string;
  severity: string;
}

interface Props {
  metrics: HealthMetrics;
}

export const HealthDashboard: React.FC<Props> = ({ metrics }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<DiagnosticLogItem[]>([]);

  // Toggle overlay on standard keyboard shortcut Ctrl+Shift+H
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch local mock diagnostics files logs
  useEffect(() => {
    if (isOpen) {
      const stored = localStorage.getItem('xennials_diagnostic_logs');
      if (stored) {
        try {
          setLogs(JSON.parse(stored));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[9999] bg-[#121218]/90 hover:bg-zinc-800 border border-zinc-700/50 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-xl flex items-center gap-2 text-[10px] font-bold text-zinc-300 uppercase tracking-wider transition-all duration-200 hover:scale-105 active:scale-95"
        title="Open Studio Health Guard Dashboard (or press Ctrl+Shift+H)"
      >
        <Activity className={`w-3.5 h-3.5 text-blue-400 ${metrics.fps < 45 ? 'animate-bounce' : 'animate-pulse'}`} />
        <span>Health: {metrics.fps} FPS</span>
      </button>
    );
  }

  const fpsColor = metrics.fps >= 55 ? 'text-emerald-400' : metrics.fps >= 30 ? 'text-amber-400' : 'text-red-400';
  const renderColor = metrics.avgRenderTimeMs < 10 ? 'text-emerald-400' : metrics.avgRenderTimeMs < 16.6 ? 'text-amber-400' : 'text-red-400';
  const audioColor = metrics.audioState === 'running' ? 'text-emerald-400' : metrics.audioState === 'suspended' ? 'text-amber-400' : 'text-zinc-500';

  return (
    <div className="fixed inset-0 bg-[#060609]/70 backdrop-blur-sm flex items-center justify-center p-4 z-[99999] transition-all duration-300">
      <div className="bg-[#0e0e13] border border-[#232332] rounded-[32px] w-full max-w-xl shadow-2xl p-6 md:p-8 relative space-y-6 overflow-hidden">
        
        {/* Glow accent */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
        
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
              <Zap className="w-4.5 h-4.5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider">Health Dashboard</h2>
              <p className="text-[10px] text-zinc-500 font-medium">Real-time performance metrics</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-90"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Diagnostic Metrics Matrix */}
        <div className="grid grid-cols-3 gap-3.5">
          <div className="bg-[#14141d] border border-zinc-900 rounded-2xl p-4 text-center space-y-1.5 flex flex-col justify-between">
            <div className="flex items-center justify-center gap-1.5 text-zinc-500 text-[9px] font-bold uppercase tracking-wider">
              <Cpu className="w-3 h-3 text-blue-400" />
              <span>Frame Rate</span>
            </div>
            <div className={`text-2xl font-black font-mono leading-none ${fpsColor}`}>
              {metrics.fps}
            </div>
            <span className="text-[8px] text-zinc-500 font-medium font-mono uppercase">FPS Target 60</span>
          </div>

          <div className="bg-[#14141d] border border-zinc-900 rounded-2xl p-4 text-center space-y-1.5 flex flex-col justify-between">
            <div className="flex items-center justify-center gap-1.5 text-zinc-500 text-[9px] font-bold uppercase tracking-wider">
              <Activity className="w-3 h-3 text-indigo-400" />
              <span>Render latency</span>
            </div>
            <div className={`text-2xl font-black font-mono leading-none ${renderColor}`}>
              {metrics.avgRenderTimeMs}
            </div>
            <span className="text-[8px] text-zinc-500 font-medium font-mono uppercase">MS Commit Frame</span>
          </div>

          <div className="bg-[#14141d] border border-zinc-900 rounded-2xl p-4 text-center space-y-1.5 flex flex-col justify-between">
            <div className="flex items-center justify-center gap-1.5 text-zinc-500 text-[9px] font-bold uppercase tracking-wider">
              <Music className="w-3 h-3 text-purple-400" />
              <span>Audio context</span>
            </div>
            <div className={`text-xs font-black font-mono leading-none uppercase truncate py-1.5 ${audioColor}`}>
              {metrics.audioState}
            </div>
            <span className="text-[8px] text-zinc-500 font-medium font-mono uppercase">State Parameter</span>
          </div>
        </div>

        {/* Warnings Section */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            <span>Active Diagnostics & Performance Warnings</span>
          </h3>
          
          {metrics.warnings.length === 0 ? (
            <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-2xl p-4 flex items-center gap-3 text-emerald-400 text-xs">
              <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <p className="font-bold text-[10px] uppercase tracking-wider">No Warnings Found</p>
                <p className="text-[9px] text-zinc-500 mt-0.5 leading-relaxed font-light">Render streams, audio engines, and thread channels are operating at maximum performance parameters.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {metrics.warnings.map((warning, index) => (
                <div key={index} className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-3 flex items-start gap-2.5 text-amber-400 text-[10px] leading-relaxed">
                  <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Local Error Stack Trace (If any stored recently) */}
        {logs.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-zinc-900">
            <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Recent Local Crash History</h3>
            <div className="bg-zinc-950/80 border border-zinc-900 rounded-xl p-3 font-mono text-[9px] text-zinc-500 max-h-24 overflow-y-auto space-y-1.5 leading-normal">
              {logs.map((log, index) => (
                <div key={index} className="flex flex-col border-b border-zinc-900/40 pb-1.5 last:border-0 last:pb-0">
                  <div className="flex justify-between items-center text-zinc-400 font-bold">
                    <span>{log.message}</span>
                    <span className="text-[8px] text-zinc-600 font-normal">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center font-mono text-[8px] text-zinc-600 select-none">
          Toggle Shortcut: <span className="bg-zinc-900 px-1 py-0.5 rounded border border-zinc-800 text-zinc-400">Ctrl + Shift + H</span>
        </div>
      </div>
    </div>
  );
};
