import React from 'react';
import { VolumeX, Sparkles, ShieldAlert } from 'lucide-react';
import { useAudioEngine } from '../hooks/useAudioEngine';

interface AudioUnlockModalProps {
  onUnlocked?: () => void;
}

export const AudioUnlockModal: React.FC<AudioUnlockModalProps> = ({ onUnlocked }) => {
  const { isAudioLocked, unlockEngine } = useAudioEngine();

  if (!isAudioLocked) return null;

  const handleUnlock = async () => {
    await unlockEngine();
    if (onUnlocked) {
      onUnlocked();
    }
  };

  return (
    <div className="fixed inset-0 bg-[#08080c]/90 backdrop-blur-md flex flex-col items-center justify-center p-4 z-50 transition-all duration-300">
      <div className="bg-[#121218] border border-[#2e2e3d] p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/25 flex items-center justify-center mx-auto text-blue-400">
          <VolumeX className="w-6 h-6 animate-pulse text-blue-400" />
        </div>
        
        <div className="space-y-2">
          <h4 className="font-bold text-sm text-white uppercase tracking-wider flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            Autoplay Protected
          </h4>
          <p className="text-xs text-gray-400 leading-relaxed font-sans">
            Chrome, Safari, and Firefox disable synth and audio playback loops until authorized by an explicit, direct human gesture.
          </p>
        </div>

        <button
          onClick={handleUnlock}
          className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 transition-all text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 border border-blue-500/30 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          Unlock Audio Output
        </button>

        <div className="pt-2 border-t border-[#1f1f2a]/60">
          <p className="text-[9px] text-gray-500 flex items-center justify-center gap-1">
            <ShieldAlert className="w-3 h-3 text-gray-600" /> Secure Web Audio Lock Bypass Enabled
          </p>
        </div>
      </div>
    </div>
  );
};
