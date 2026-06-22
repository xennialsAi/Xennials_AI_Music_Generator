import { useState, useEffect, useCallback } from 'react';

// Persist the actual AudioContext instance globally (module scope)
// so that switching tabs in App.tsx doesn't destroy and recreate a suspended context.
let globalAudioContext: AudioContext | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(listener => listener());
}

export function getAudioContext(): AudioContext {
  if (globalAudioContext && globalAudioContext.state !== 'closed') {
    return globalAudioContext;
  }
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioContextClass();
  globalAudioContext = ctx;
  
  // Set up event listeners for state changes to automatically notify hooks
  ctx.onstatechange = () => {
    notifyListeners();
  };

  return ctx;
}

export const useAudioEngine = () => {
  const [audioState, setAudioState] = useState<'running' | 'suspended' | 'closed'>(() => {
    if (globalAudioContext) {
      return globalAudioContext.state;
    }
    return 'suspended';
  });

  useEffect(() => {
    const handleStateChange = () => {
      if (globalAudioContext) {
        setAudioState(globalAudioContext.state);
      }
    };

    listeners.add(handleStateChange);
    // Trigger initial state sync
    handleStateChange();

    return () => {
      listeners.delete(handleStateChange);
    };
  }, []);

  const unlockEngine = useCallback(async () => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended' || ctx.state === 'closed') {
      try {
        await ctx.resume();
        
        // Play a subtle silent pulse / short oscillator click
        // strictly synchronously within the user gesture callback
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.05);
        
        console.log('[Audio Engine] Autoplay authorization cleared successfully');
      } catch (err) {
        console.warn('[Audio Engine] Failed to unlock audio context:', err);
      }
    }
    notifyListeners();
  }, []);

  const isUnlocked = audioState === 'running';
  const isAudioLocked = !isUnlocked;

  return {
    audioContext: globalAudioContext,
    audioState,
    isUnlocked,
    isAudioLocked,
    unlockEngine,
  };
};
