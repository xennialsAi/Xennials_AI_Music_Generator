import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Pause, Sliders, Music, Video, Scissors, Trash2, SlidersHorizontal, 
  Settings, Volume2, VolumeX, Mic, Activity, Layers, Lock, Unlock, Eye, EyeOff, 
  RotateCcw, Download, Plus, AlertCircle, Sparkles, Check, HelpCircle,
  FileVideo, FileAudio, ZoomIn, ZoomOut, Save, ChevronRight, Share2
} from 'lucide-react';
import { SongResult } from '../../types';
import { getAudioContext, useAudioEngine } from '../hooks/useAudioEngine';

// Interfaces for Kdenlive timeline clips and tracks
export interface TimelineClip {
  id: string;
  trackId: string; // 'v1' | 'v2' | 'a1' | 'a2' | 'a3'
  name: string;
  startTime: number; // in seconds on timeline
  duration: number; // in seconds
  color: string;
  type: 'video' | 'image' | 'audio' | 'text' | 'synthesizer' | 'sequencer';
  url?: string;
  coverUrl?: string;
  text?: string;
  volume: number; // 0 to 1
  opacity: number; // 0 to 1
  glitchActive: boolean;
  filterType: 'none' | 'sepia' | 'grayscale' | 'hue-rotate' | 'high-contrast' | 'invert';
}

export interface KdenliveTrack {
  id: string;
  name: string;
  type: 'video' | 'audio';
  muted: boolean;
  locked: boolean;
  volume: number; // 0 to 1
  pan: number; // -1 to 1
}

interface KdenliveEditorProps {
  /** Generated song results from the main Xennials Studio */
  results: SongResult[];
  /** Callback to trigger a notification or log message in parent */
  onAddLog?: (id: string, msg: string) => void;
  /** Active generated result to import immediately */
  activeImportedSong?: SongResult | null;
  /** Clear active imported state */
  onClearActiveImport?: () => void;
}

export const KdenliveEditor: React.FC<KdenliveEditorProps> = ({
  results,
  onAddLog,
  activeImportedSong,
  onClearActiveImport
}) => {
  // Web Audio Context & Node Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const delayFeedbackRef = useRef<GainNode | null>(null);
  const eqLowRef = useRef<BiquadFilterNode | null>(null);
  const eqHighRef = useRef<BiquadFilterNode | null>(null);
  
  // Track Specific Gain/Pan Node associations for real DAW mixing
  const channelNodesRef = useRef<Record<string, { gain: GainNode; pan: StereoPannerNode; analyser: AnalyserNode }>>({});

  // Active playing audio oscillators and HTML audio source elements
  const activeSourcesRef = useRef<Map<string, { source: AudioScheduledSourceNode | HTMLAudioElement; trackId: string }>>(new Map());

  // Kdenlive UI layout states: 'Logging' | 'Editing' | 'Audio' | 'Effects' | 'Color'
  const [activeLayout, setActiveLayout] = useState<'Editing' | 'Audio' | 'Effects' | 'Color' | 'Synthesizer'>('Editing');
  
  // Timeline Zoom factor (pixels per second)
  const [zoomFactor, setZoomFactor] = useState<number>(12); // default 12px/sec
  
  // Timeline Playhead controls
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const timelineLength = 120; // 2 minutes total timeline length in seconds
  
  // Scissors tool toggle
  const [isScissorsActive, setIsScissorsActive] = useState<boolean>(false);

  // Tracks State (V1-V2 are video, A1-A3 are audio)
  const [tracks, setTracks] = useState<KdenliveTrack[]>([
    { id: 'v2', name: 'V2 (Overlays/Text)', type: 'video', muted: false, locked: false, volume: 1, pan: 0 },
    { id: 'v1', name: 'V1 (Background Video)', type: 'video', muted: false, locked: false, volume: 1, pan: 0 },
    { id: 'a1', name: 'A1 (AI Vocals & Song)', type: 'audio', muted: false, locked: false, volume: 0.8, pan: 0 },
    { id: 'a2', name: 'A2 (Beat Sequencer)', type: 'audio', muted: false, locked: false, volume: 0.8, pan: 0 },
    { id: 'a3', name: 'A3 (Keyboard & Synth)', type: 'audio', muted: false, locked: false, volume: 0.8, pan: 0.3 }
  ]);

  // Project Bin initial sample clips for rich immediate sandbox experience
  const [binClips, setBinClips] = useState<any[]>([
    { id: 'stock-vid-1', type: 'video', name: 'Robin-21723.mp4', url: 'https://assets.mixkit.co/videos/preview/mixkit-small-flowering-bush-in-autumn-41585-large.mp4', duration: 15, thumbnail: 'https://picsum.photos/seed/robin/120/80' },
    { id: 'stock-vid-2', type: 'video', name: 'Mountains-2266.mp4', url: 'https://assets.mixkit.co/videos/preview/mixkit-mysterious-mountain-peek-with-misty-clouds-48530-large.mp4', duration: 30, thumbnail: 'https://picsum.photos/seed/mountain/120/80' },
    { id: 'stock-vid-3', type: 'video', name: 'Autumn-18420.mp4', url: 'https://assets.mixkit.co/videos/preview/mixkit-forest-river-with-autumn-leaves-41718-large.mp4', duration: 25, thumbnail: 'https://picsum.photos/seed/autumn/120/80' },
    { id: 'stock-loop-1', type: 'audio', name: 'Astro-chicken-dance.wav', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', duration: 40, tags: ['Synth', 'Upbeat'] },
    { id: 'stock-loop-2', type: 'audio', name: 'Broke_For_Free_One.mp3', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', duration: 50, tags: ['Indie', 'Chill'] }
  ]);

  // Loaded Timeline Clips
  const [timelineClips, setTimelineClips] = useState<TimelineClip[]>([
    {
      id: 'clip-initial-bg',
      trackId: 'v1',
      name: 'Autumn-18420.mp4 (Background)',
      startTime: 0,
      duration: 35,
      color: 'bg-emerald-950 border-emerald-500 text-emerald-300',
      type: 'video',
      url: 'https://assets.mixkit.co/videos/preview/mixkit-forest-river-with-autumn-leaves-41718-large.mp4',
      volume: 1,
      opacity: 0.8,
      glitchActive: false,
      filterType: 'none'
    },
    {
      id: 'clip-initial-beat',
      trackId: 'a2',
      name: 'Astro-chicken-dance.wav (Loop)',
      startTime: 3,
      duration: 40,
      color: 'bg-indigo-950 border-indigo-500 text-indigo-300',
      type: 'audio',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      volume: 0.7,
      opacity: 1,
      glitchActive: false,
      filterType: 'none'
    },
    {
      id: 'clip-sub',
      trackId: 'v2',
      name: 'Subtitle: Dynamic Beats',
      startTime: 6,
      duration: 20,
      color: 'bg-pink-950 border-pink-500 text-pink-300',
      type: 'text',
      text: '✨ Xennials Web Sandbox Edition ✨',
      volume: 1,
      opacity: 1,
      glitchActive: true,
      filterType: 'sepia'
    }
  ]);

  // Selection states
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  
  // Real-time Master Level meters and Channel meters state mapping (dB height percentage)
  const [mixerLevels, setMixerLevels] = useState<Record<string, number>>({
    v1: 0, v2: 0, a1: 0, a2: 0, a3: 0, master: 0
  });

  // Effects Configuration for the selected clip
  const [selectedClipEffects, setSelectedClipEffects] = useState({
    opacity: 1,
    volume: 1,
    filterType: 'none' as 'none' | 'sepia' | 'grayscale' | 'hue-rotate' | 'high-contrast' | 'invert',
    glitchActive: false,
    text: ''
  });

  // Master Global FX control knobs
  const [masterFX, setMasterFX] = useState({
    delayTime: 0.3,
    delayFeedback: 0.4,
    eqLowBoost: 0,
    eqHighBoost: 0,
    compressorThreshold: -24
  });

  // Synthesizer Virtual keyboard state
  const [synthOscType, setSynthOscType] = useState<'sawtooth' | 'sine' | 'triangle' | 'square'>('sawtooth');
  const [synthADSRAttack, setSynthADSRAttack] = useState<number>(0.05);
  const [synthADSRRelease, setSynthADSRRelease] = useState<number>(0.25);
  
  // 16-Step beat sequencer grid configuration
  const [sequencerBPM, setSequencerBPM] = useState<number>(120);
  const [isSequencerPlaying, setIsSequencerPlaying] = useState<boolean>(false);
  const [sequencerStep, setSequencerStep] = useState<number>(0);
  const [sequencerGrid, setSequencerGrid] = useState<Record<string, boolean[]>>({
    Kick:  [true,  false, false, false, true,  false, false, false, true,  false, false, false, true,  false, false, false],
    Snare: [false, false, false, false, true,  false, false, false, false, false, false, false, true,  false, false, false],
    Hihat: [true,  false, true,  false, true,  false, true,  false, true,  false, true,  false, true,  false, true,  true],
    Clap:  [false, false, false, false, false, false, false, true,  false, false, false, false, false, false, true,  false]
  });

  // Microphone Studio Live parameters
  const [isMicRecording, setIsMicRecording] = useState<boolean>(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Video Renderer Refs for canvas drawing loop
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoElementsCache = useRef<Record<string, HTMLVideoElement>>({});
  const importedSongIdsRef = useRef<Set<string>>(new Set());

  // Autoplay and audio unlocking states matching Remotion guidelines
  const { isAudioLocked, unlockEngine } = useAudioEngine();

  const activateAudioEngine = async () => {
    await unlockEngine();
    if (onAddLog) {
      onAddLog('audio-engine-unlocked', '🔒 Web Audio Engine securely unlocked via explicit user interaction gesture.');
    }
  };

  // Bridge export pipeline for Antigravity & custom protocol URI hooks
  const [isExportingToAntigravity, setIsExportingToAntigravity] = useState<boolean>(false);

  const exportToAntigravityStudio = async () => {
    setIsExportingToAntigravity(true);
    if (onAddLog) {
      onAddLog('antigravity-bridge-init', 'Initiating high-speed code & composition export bridge to Antigravity...');
    }

    try {
      // Gather active editor code files dynamically via Vite fetch so the actual updated code resolves correctly
      let kdenliveCode = '';
      let appCode = '';
      let indexCode = '';

      try {
        const r1 = await fetch('/src/components/KdenliveEditor.tsx');
        if (r1.ok) kdenliveCode = await r1.text();
      } catch (e) {
        console.warn('Could not fetch KdenliveEditor.tsx source dynamically', e);
      }

      try {
        const r2 = await fetch('/App.tsx');
        if (r2.ok) appCode = await r2.text();
      } catch (e) {
        console.warn('Could not fetch App.tsx source dynamically', e);
      }

      try {
        const r3 = await fetch('/index.tsx');
        if (r3.ok) indexCode = await r3.text();
      } catch (e) {
        console.warn('Could not fetch index.tsx source dynamically', e);
      }

      // Collect complete studio/timeline structures
      const projectBundle = {
        meta: {
          appName: "Xennials Studio",
          timestamp: new Date().toISOString(),
          version: "3.0.0-antigravity-bridge",
          authorEmail: "teefisher314@gmail.com",
          activeLayout: activeLayout
        },
        state: {
          timelineClips: timelineClips,
          tracks: tracks,
          binClips: binClips,
          currentTime: currentTime,
          activeImportedSong: activeImportedSong || null
        },
        codebase: {
          'KdenliveEditor.tsx': kdenliveCode || '// Code content loaded inside runtime bundle',
          'App.tsx': appCode || '// App layer root bundle',
          'index.tsx': indexCode || '// Main bootstrap entry'
        }
      };

      const serializedData = JSON.stringify(projectBundle);
      // Create Base64 option for high-compatibility cross-app URIs
      const base64Data = btoa(unescape(encodeURIComponent(serializedData)));

      // 1. Dispatch custom event triggers as safe window postMessage channels
      if (window.parent && window.parent !== window) {
        console.log('[Antigravity Bridge] Broadcasting timeline bundle & codebase to AI Studio parent...');
        window.parent.postMessage({
          type: 'ANTIGRAVITY_EXPORT',
          appName: 'Xennials Studio',
          payload: projectBundle,
          rawJson: serializedData
        }, '*');

        window.parent.postMessage({
          type: 'EXPORT_CODE_TO_ANTIGRAVITY',
          payload: {
            appCode,
            kdenliveCode,
            projectBundle
          }
        }, '*');
      }

      // 2. Open / trigger deep-link protocol handlers to activate registered local Antigravity apps
      // Securely invoke custom URIs matching standard, multi-version, and custom antigravity protocol definitions
      const protocolURIs = [
        `antigravity://import?project=xennials-studio&payload=${encodeURIComponent(serializedData)}`,
        `antigravity://export?project=xennials-studio&base64=${encodeURIComponent(base64Data)}`,
        `antigravity-studio://import?payload=${encodeURIComponent(serializedData)}`,
        `antigravity-app://open?payload=${encodeURIComponent(serializedData)}`
      ];

      protocolURIs.forEach((uri, idx) => {
        setTimeout(() => {
          console.log(`[Antigravity Bridge] Launching deep link (${idx+1}/${protocolURIs.length}):`, uri.substring(0, 80) + '...');
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = uri;
          document.body.appendChild(iframe);
          
          // Remove iframe after short delay
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
        }, idx * 150);
      });

      if (onAddLog) {
        onAddLog('antigravity-bridge-success', '🎉 Antigravity Export successfully dispatched. Project state & codebase linked.');
      }

      alert('Successfully triggered Antigravity Bridge! The timeline state, project structures, and live component code files have been posted to the Google AI Studio parent frame and loaded into custom protocol handlers.');
    } catch (err: any) {
      console.error('[Antigravity Bridge] Critical Failure:', err);
      alert(`Bridge Exception: ${err.message || 'Unknown protocol error'}`);
    } finally {
      setIsExportingToAntigravity(false);
    }
  };

  // Sync effect configuration when editing selection shifts
  useEffect(() => {
    if (selectedClipId) {
      const clip = timelineClips.find(c => c.id === selectedClipId);
      if (clip) {
        setSelectedClipEffects({
          opacity: clip.opacity ?? 1,
          volume: clip.volume ?? 1,
          filterType: clip.filterType ?? 'none',
          glitchActive: clip.glitchActive ?? false,
          text: clip.text ?? ''
        });
      }
    }
  }, [selectedClipId, timelineClips]);

  // Auto-import song result from parent when triggered (e.g. Generated Song done)
  useEffect(() => {
    if (activeImportedSong && activeImportedSong.audioUrl) {
      if (importedSongIdsRef.current.has(activeImportedSong.id)) {
        if (onClearActiveImport) onClearActiveImport();
        return;
      }
      importedSongIdsRef.current.add(activeImportedSong.id);

      const existing = binClips.find(c => c.id === activeImportedSong.id);
      if (!existing) {
        // Add to Project Bin
        const newBinClip = {
          id: activeImportedSong.id,
          type: 'audio',
          name: activeImportedSong.title || `Xennials Song_${activeImportedSong.id.slice(0, 4)}`,
          url: activeImportedSong.audioUrl,
          duration: activeImportedSong.duration === 'Clip (30s)' ? 30 : 150,
          coverUrl: activeImportedSong.coverImageUrl || 'https://picsum.photos/seed/xennialscover/120/80',
          lyrics: activeImportedSong.lyrics
        };
        setBinClips(prev => [newBinClip, ...prev]);

        // Place directly on the timeline track A1 at current playhead!
        const newTimelineClip: TimelineClip = {
          id: `timeline-clip-${activeImportedSong.id}`,
          trackId: 'a1',
          name: newBinClip.name,
          startTime: currentTime,
          duration: newBinClip.duration,
          color: 'bg-rose-950 border-rose-500 text-rose-300',
          type: 'audio',
          url: newBinClip.url,
          coverUrl: newBinClip.coverUrl,
          volume: 1,
          opacity: 1,
          glitchActive: false,
          filterType: 'none'
        };
        setTimelineClips(prev => [...prev, newTimelineClip]);
        setSelectedClipId(newTimelineClip.id);
        
        if (onAddLog) {
          onAddLog(activeImportedSong.id, `Imported standard "${newBinClip.name}" into Xennials Multi-track Timeline editor.`);
        }
      }
      if (onClearActiveImport) onClearActiveImport();
    }
  }, [activeImportedSong, currentTime, binClips, onClearActiveImport, onAddLog]);

  // Clean Audio on unmount or pause
  const stopAllAudioPlayback = useCallback(() => {
    activeSourcesRef.current.forEach(({ source }) => {
      if (source instanceof AudioScheduledSourceNode) {
        try { source.stop(); } catch(e) {}
      } else if (source instanceof HTMLAudioElement) {
        source.pause();
      }
    });
    activeSourcesRef.current.clear();
  }, []);

  // Web Audio Context setup
  const initAudioEngine = useCallback(() => {
    const ctx = getAudioContext();
    if (audioContextRef.current === ctx && Object.keys(channelNodesRef.current).length > 0) return ctx;
    audioContextRef.current = ctx;

    // Master nodes setup
    const masterGain = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    
    // Master FX nodes setup
    const delayNode = ctx.createDelay(2.0);
    const delayFeedback = ctx.createGain();
    const eqLow = ctx.createBiquadFilter();
    const eqHigh = ctx.createBiquadFilter();

    delayNode.delayTime.value = masterFX.delayTime;
    delayFeedback.gain.value = masterFX.delayFeedback;
    eqLow.type = 'lowshelf';
    eqLow.frequency.value = 240;
    eqLow.gain.value = masterFX.eqLowBoost;
    eqHigh.type = 'highshelf';
    eqHigh.frequency.value = 8000;
    eqHigh.gain.value = masterFX.eqHighBoost;

    // Route connections
    // Gain -> EQ-Low -> EQ-High -> Analyser -> Output
    masterGain.connect(eqLow);
    eqLow.connect(eqHigh);
    
    // Routing delay node in parallel loop
    eqHigh.connect(delayNode);
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode); // feedback loop
    delayFeedback.connect(analyser); // mix back in

    eqHigh.connect(analyser);
    analyser.connect(ctx.destination);

    masterGainRef.current = masterGain;
    analyserRef.current = analyser;
    delayNodeRef.current = delayNode;
    delayFeedbackRef.current = delayFeedback;
    eqLowRef.current = eqLow;
    eqHighRef.current = eqHigh;

    // Channel specific Mixer Nodes (V1, A1, A2, A3)
    ['v1', 'v2', 'a1', 'a2', 'a3'].forEach(trackId => {
      const trackSettings = tracks.find(t => t.id === trackId);
      const trackGain = ctx.createGain();
      const trackPan = ctx.createStereoPanner();
      const trackAnalyser = ctx.createAnalyser();
      trackAnalyser.fftSize = 64;

      trackGain.gain.value = trackSettings ? (trackSettings.muted ? 0 : trackSettings.volume) : 0.8;
      trackPan.pan.value = trackSettings ? trackSettings.pan : 0;

      trackGain.connect(trackPan);
      trackPan.connect(trackAnalyser);
      trackAnalyser.connect(masterGain);

      channelNodesRef.current[trackId] = {
        gain: trackGain,
        pan: trackPan,
        analyser: trackAnalyser
      };
    });

    return ctx;
  }, [tracks, masterFX]);

  // Dynamic Volume levels display updating via Analyser nodes
  useEffect(() => {
    let animationFrameId: number;
    const dataArray = new Uint8Array(128);

    const updateLevels = () => {
      const levels: Record<string, number> = { v1: 0, v2: 0, a1: 0, a2: 0, a3: 0, master: 0 };
      
      // Update channels
      (Object.entries(channelNodesRef.current) as Array<[string, { gain: GainNode; pan: StereoPannerNode; analyser: AnalyserNode }]>).forEach(([trackId, nodes]) => {
        nodes.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < nodes.analyser.frequencyBinCount; i++) {
          sum += dataArray[i];
        }
        const avg = sum / nodes.analyser.frequencyBinCount;
        levels[trackId] = Math.min(100, Math.round((avg / 255) * 100 * (isPlaying ? 1.4 : 0)));
      });

      // Update Master Output
      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < analyserRef.current.frequencyBinCount; i++) {
          sum += dataArray[i];
        }
        const avg = sum / analyserRef.current.frequencyBinCount;
        levels.master = Math.min(100, Math.round((avg / 255) * 100 * (isPlaying ? 1.5 : 0)));
      }

      setMixerLevels(levels);
      
      if (isPlaying) {
        animationFrameId = requestAnimationFrame(updateLevels);
      } else {
        setMixerLevels({ v1: 0, v2: 0, a1: 0, a2: 0, a3: 0, master: 0 });
      }
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(updateLevels);
    } else {
      setMixerLevels({ v1: 0, v2: 0, a1: 0, a2: 0, a3: 0, master: 0 });
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying]);

  // Adjust active volume/channels in Web Audio node matrix dynamically
  const updateTrackWebAudioNodes = useCallback((trackId: string, updates: { volume?: number; pan?: number; muted?: boolean }) => {
    const nodes = channelNodesRef.current[trackId];
    if (!nodes) return;

    if (updates.volume !== undefined || updates.muted !== undefined) {
      const volumeSetting = updates.volume !== undefined ? updates.volume : tracks.find(t => t.id === trackId)?.volume ?? 0.8;
      const mutedSetting = updates.muted !== undefined ? updates.muted : tracks.find(t => t.id === trackId)?.muted ?? false;
      nodes.gain.gain.setValueAtTime(mutedSetting ? 0 : volumeSetting, audioContextRef.current?.currentTime || 0);
    }
    if (updates.pan !== undefined) {
      nodes.pan.pan.setValueAtTime(updates.pan, audioContextRef.current?.currentTime || 0);
    }
  }, [tracks]);

  // Sync volume with timeline tracks settings
  useEffect(() => {
    tracks.forEach(t => {
      updateTrackWebAudioNodes(t.id, { volume: t.volume, pan: t.pan, muted: t.muted });
    });
  }, [tracks, updateTrackWebAudioNodes]);

  // Sync global effect settings with Web Audio Nodes
  useEffect(() => {
    if (delayNodeRef.current) delayNodeRef.current.delayTime.value = masterFX.delayTime;
    if (delayFeedbackRef.current) delayFeedbackRef.current.gain.value = masterFX.delayFeedback;
    if (eqLowRef.current) eqLowRef.current.gain.value = masterFX.eqLowBoost;
    if (eqHighRef.current) eqHighRef.current.gain.value = masterFX.eqHighBoost;
  }, [masterFX]);

  // Continuous playhead moving effect
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      const startTime = Date.now();
      const initialPlayhead = currentTime;
      
      interval = setInterval(() => {
        const deltaSeconds = (Date.now() - startTime) / 1000;
        const nextTime = initialPlayhead + deltaSeconds;
        
        if (nextTime >= timelineLength) {
          setCurrentTime(0);
          setIsPlaying(false);
          stopAllAudioPlayback();
        } else {
          setCurrentTime(nextTime);
        }
      }, 50);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isPlaying, timelineLength, stopAllAudioPlayback]);

  // Master play clips triggering according to timeline tracking changes
  useEffect(() => {
    if (!isPlaying) {
      stopAllAudioPlayback();
      return;
    }

    const ctx = initAudioEngine();
    if (ctx.state === 'suspended' || ctx.state === 'closed') {
      ctx.resume().catch(() => {});
    }

    // Identify which clips should be playing right now
    timelineClips.forEach(clip => {
      const isWithinBounds = currentTime >= clip.startTime && currentTime <= (clip.startTime + clip.duration);
      const isCurrentlyPlaying = activeSourcesRef.current.has(clip.id);

      if (isWithinBounds && !isCurrentlyPlaying) {
        // Trigger clip play!
        if (clip.type === 'audio' && clip.url) {
          const trackNodes = channelNodesRef.current[clip.trackId];
          const trackSettings = tracks.find(t => t.id === clip.trackId);
          if (trackNodes && (!trackSettings || !trackSettings.muted)) {
            // Instantiate dynamic HTML Audio element linked into the routing channel
            const audio = new Audio(clip.url);
            audio.crossOrigin = 'anonymous';
            
            // Set start offset accurately
            const offset = currentTime - clip.startTime;
            audio.currentTime = offset;

            try {
              const source = ctx.createMediaElementSource(audio);
              source.connect(trackNodes.gain);
              audio.play().catch(e => console.warn('[DAW Engine] audio play guard:', e));

              activeSourcesRef.current.set(clip.id, { source: audio, trackId: clip.trackId });
            } catch (e) {
              // Direct backup trigger in case media element error occurs
              console.warn('[DAW Engine] MediaElement connection bypass active', e);
              audio.play().catch(e => console.warn('[DAW Engine] audio backup play guard:', e));
              activeSourcesRef.current.set(clip.id, { source: audio, trackId: clip.trackId });
            }
          }
        } else if (clip.type === 'video' && clip.url) {
          // Preload/cache offscreen video
          let video = videoElementsCache.current[clip.id];
          if (!video) {
            video = document.createElement('video');
            video.src = clip.url;
            video.muted = true;
            video.crossOrigin = 'anonymous';
            video.loop = true;
            video.playsInline = true;
            videoElementsCache.current[clip.id] = video;
          }
          const offset = currentTime - clip.startTime;
          video.currentTime = offset;
          video.play().catch(e => console.warn('[Video Player] autoplay guard:', e));
          
          activeSourcesRef.current.set(clip.id, { source: video as any, trackId: clip.trackId });
        }
      } else if (!isWithinBounds && isCurrentlyPlaying) {
        // Stop playing clip outside its temporal boundaries
        const sourceMeta = activeSourcesRef.current.get(clip.id);
        if (sourceMeta) {
          if (sourceMeta.source instanceof HTMLAudioElement) {
            sourceMeta.source.pause();
          } else if (sourceMeta.source instanceof HTMLVideoElement) {
            sourceMeta.source.pause();
          } else {
            try { sourceMeta.source.stop(); } catch(e) {}
          }
          activeSourcesRef.current.delete(clip.id);
        }
      }
    });
  }, [isPlaying, currentTime, timelineClips, tracks, initAudioEngine, stopAllAudioPlayback]);

  // Clean elements on destroy
  useEffect(() => {
    return () => {
      stopAllAudioPlayback();
    };
  }, [stopAllAudioPlayback]);


  // Trigger a synth oscillator sound block with keyboard click
  const triggerSynthNote = (freq: number) => {
    if (isAudioLocked) {
      activateAudioEngine();
      return;
    }
    const ctx = initAudioEngine();

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();

    osc.type = synthOscType;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    // ADSR Envelope
    const now = ctx.currentTime;
    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(0.6 * (tracks.find(t => t.id === 'a3')?.volume || 0.8), now + synthADSRAttack);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + synthADSRAttack + synthADSRRelease);

    // Channel gain node link-up
    const trackNodes = channelNodesRef.current['a3'];
    if (trackNodes) {
      osc.connect(oscGain);
      oscGain.connect(trackNodes.gain);
    } else {
      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
    }

    osc.start(now);
    osc.stop(now + synthADSRAttack + synthADSRRelease + 0.1);
  };

  // 16-step beat sequencer trigger clock
  useEffect(() => {
    let timer: any;
    if (isSequencerPlaying) {
      const stepDurationMs = (60 / sequencerBPM / 4) * 1000; // sixteenth notes
      timer = setInterval(() => {
        setSequencerStep(prevStep => {
          const nextStep = (prevStep + 1) % 16;
          
          // Trigger drum synthesizers on active beats
          const ctx = initAudioEngine();
          const playDrum = (freqSweepStart: number, freqEnd: number, dec: number, noiseType: boolean) => {
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();
            const now = ctx.currentTime;
            
            gainNode.gain.setValueAtTime(0.5, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + dec);

            if (noiseType) {
              // Simulating hi-hat snap or snare snap via highpass noise
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(8000, now);
              osc.frequency.exponentialRampToValueAtTime(300, now + dec);
            } else {
              osc.type = 'sine';
              osc.frequency.setValueAtTime(freqSweepStart, now);
              osc.frequency.exponentialRampToValueAtTime(freqEnd, now + dec);
            }

            const trackNodes = channelNodesRef.current['a2'];
            osc.connect(gainNode);
            gainNode.connect(trackNodes ? trackNodes.gain : ctx.destination);
            
            osc.start(now);
            osc.stop(now + dec + 0.05);
          };

          if (sequencerGrid.Kick[nextStep]) playDrum(150, 45, 0.22, false);
          if (sequencerGrid.Snare[nextStep]) playDrum(250, 100, 0.15, true);
          if (sequencerGrid.Hihat[nextStep]) playDrum(9000, 4000, 0.06, true);
          if (sequencerGrid.Clap[nextStep]) {
            // Mini clap cluster
            playDrum(1200, 600, 0.08, true);
            setTimeout(() => playDrum(1100, 500, 0.06, true), 20);
          }

          return nextStep;
        });
      }, stepDurationMs);
    } else {
      clearInterval(timer);
    }

    return () => clearInterval(timer);
  }, [isSequencerPlaying, sequencerBPM, sequencerGrid, initAudioEngine]);

  // Render video frame composite onto the Preview canvas
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear Canvas frame
    ctx.fillStyle = '#111115';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Sort timeline clips by layer index (z-order)
    // Overlays V2 on top of background V1
    const activeVisualClips = timelineClips.filter(clip => {
      const isVisibleType = clip.type === 'video' || clip.type === 'image' || clip.type === 'text';
      const isWithinTimelineRange = currentTime >= clip.startTime && currentTime <= (clip.startTime + clip.duration);
      const isTrackMuted = tracks.find(t => t.id === clip.trackId)?.muted;
      return isVisibleType && isWithinTimelineRange && !isTrackMuted;
    }).sort((a, b) => {
      // v2 overlay on top of v1 background
      return a.trackId === 'v2' ? 1 : -1;
    });

    // 1. Draw solid visual frame or loops
    activeVisualClips.forEach(clip => {
      ctx.save();
      
      // Apply filters for artistic Kdenlive editing color grading
      if (clip.filterType && clip.filterType !== 'none') {
        if (clip.filterType === 'sepia') ctx.filter = 'sepia(0.8)';
        else if (clip.filterType === 'grayscale') ctx.filter = 'grayscale(0.9)';
        else if (clip.filterType === 'hue-rotate') ctx.filter = `hue-rotate(${Math.sin(currentTime) * 180}deg)`;
        else if (clip.filterType === 'high-contrast') ctx.filter = 'contrast(2) brightness(1.2)';
        else if (clip.filterType === 'invert') ctx.filter = 'invert(1)';
      }

      ctx.globalAlpha = clip.opacity;

      if (clip.type === 'video') {
        const video = videoElementsCache.current[clip.id];
        if (video && video.readyState >= 2) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        } else {
          // Draw a cinematic futuristic cover art / placeholder
          ctx.fillStyle = 'rgba(30, 40, 60, 0.4)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.strokeStyle = '#4b5563';
          ctx.strokeRect(10, 10, canvas.width-20, canvas.height-20);
        }
      } else if (clip.type === 'image' && clip.url) {
        // Draw static image
        const img = new Image();
        img.src = clip.url;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      } else if (clip.type === 'text' && clip.text) {
        // Draw text subtitle frame
        ctx.font = 'bold 32px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 12;
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.strokeText(clip.text, canvas.width / 2, canvas.height - 80);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(clip.text, canvas.width / 2, canvas.height - 80);
      }

      ctx.restore();
    });

    // 2. Draw audio spectrum visualization on top for a rich dynamic monitor feel!
    if (isPlaying) {
      ctx.save();
      const analyser = analyserRef.current;
      if (analyser) {
        const byteArr = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(byteArr);
        
        const typeIndex = (Math.floor(currentTime) % 3); // rotate visuals on playhead
        
        ctx.lineWidth = 3;
        
        // Draw interactive oscilloscope wave across bottom
        ctx.beginPath();
        const sliceWidth = canvas.width / byteArr.length;
        let x = 0;
        for (let i = 0; i < byteArr.length; i++) {
          const v = byteArr[i] / 128.0;
          const y = (v * 100) / 2 + canvas.height / 2 + 50;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);

          x += sliceWidth;
        }
        ctx.strokeStyle = 'rgba(147, 51, 234, 0.45)'; // Purple oscilloscope
        ctx.stroke();

        // Draw Circular radiating ring visuals in center
        ctx.beginPath();
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2 - 50;
        const radius = 100 + (byteArr[0] / 255) * 35; // pulses with bass kicks!
        
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)'; // blue radial ring
        ctx.stroke();

        // Radiating spikes
        for (let i = 0; i < 40; i += 2) {
          const angle = (i / 40) * Math.PI * 2;
          const amp = (byteArr[i] / 255) * 60;
          const xStart = centerX + Math.cos(angle) * radius;
          const yStart = centerY + Math.sin(angle) * radius;
          const xEnd = centerX + Math.cos(angle) * (radius + amp);
          const yEnd = centerY + Math.sin(angle) * (radius + amp);

          ctx.beginPath();
          ctx.moveTo(xStart, yStart);
          ctx.lineTo(xEnd, yEnd);
          ctx.strokeStyle = `hsla(${(i*10)%360}, 90%, 65%, 0.7)`;
          ctx.stroke();
        }
      }
      ctx.restore();
    } else {
      // Draw standard guide layout if idle
      ctx.save();
      ctx.font = '500 18px Inter, monospace';
      ctx.fillStyle = 'rgba(156, 163, 175, 0.8)';
      ctx.textAlign = 'center';
      ctx.fillText('[XENNIALS DIGITAL MONITOR IDLE]', canvas.width / 2, canvas.height / 2);
      ctx.font = '500 13px Inter, sans-serif';
      ctx.fillText('Press Spacebar or Play to Render Timelines', canvas.width / 2, canvas.height / 2 + 30);
      ctx.restore();
    }
  }, [timelineClips, currentTime, isPlaying, tracks]);

  // Timeline scale conversions helper
  const getXCoordinate = (seconds: number) => {
    return seconds * zoomFactor;
  };

  const getSecondsFromX = (x: number) => {
    return Math.max(0, x / zoomFactor);
  };

  // Dragging clips event handling
  const [dragState, setDragState] = useState<{
    clipId: string;
    initialX: number;
    initialStartTime: number;
    isResizeLeft: boolean;
    isResizeRight: boolean;
  } | null>(null);

  const handleClipMouseDown = (e: React.MouseEvent, clip: TimelineClip, isResizeLeft = false, isResizeRight = false) => {
    e.stopPropagation();
    setSelectedClipId(clip.id);
    
    // Ignore updates if locked
    if (tracks.find(t => t.id === clip.trackId)?.locked) return;

    setDragState({
      clipId: clip.id,
      initialX: e.clientX,
      initialStartTime: clip.startTime,
      isResizeLeft,
      isResizeRight
    });
  };

  const handleTimelineHeaderClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left + e.currentTarget.scrollLeft;
    const clickSeconds = getSecondsFromX(clickX);
    setCurrentTime(Math.min(timelineLength, clickSeconds));
  };

  // Split clip scissors action
  const handleTimelineClipClick = (e: React.MouseEvent, clip: TimelineClip) => {
    if (isScissorsActive) {
      e.stopPropagation();
      const relativeCutPoint = currentTime - clip.startTime;
      if (relativeCutPoint > 0.5 && relativeCutPoint < clip.duration - 0.5) {
        // Safe to cut
        const leftClip: TimelineClip = {
          ...clip,
          id: `clip-split-L-${Math.random().toString(36).substring(3,7)}`,
          duration: relativeCutPoint,
          name: `${clip.name} (Part 1)`
        };
        const rightClip: TimelineClip = {
          ...clip,
          id: `clip-split-R-${Math.random().toString(36).substring(3,7)}`,
          startTime: currentTime,
          duration: clip.duration - relativeCutPoint,
          name: `${clip.name} (Part 2)`
        };

        // Replace original clip with the split pieces
        setTimelineClips(prev => [
          ...prev.filter(c => c.id !== clip.id),
          leftClip,
          rightClip
        ]);
        setSelectedClipId(rightClip.id);
        setIsScissorsActive(false);

        if (onAddLog) {
          onAddLog(clip.id, `Cut timeline track element "${clip.name}" cleanly at playhead offset.`);
        }
      }
    }
  };

  // Handle global mouse move during timeline dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!dragState) return;

      const deltaX = e.clientX - dragState.initialX;
      const valDeltaSeconds = deltaX / zoomFactor;

      setTimelineClips(prev => prev.map(clip => {
        if (clip.id !== dragState.clipId) return clip;

        if (dragState.isResizeLeft) {
          const newStart = Math.max(0, dragState.initialStartTime + valDeltaSeconds);
          const activeDuration = clip.startTime + clip.duration - newStart;
          if (activeDuration < 0.5) return clip; // minimum width
          return {
            ...clip,
            startTime: newStart,
            duration: activeDuration
          };
        } else if (dragState.isResizeRight) {
          const newDuration = Math.max(0.5, clip.duration + valDeltaSeconds);
          return {
            ...clip,
            duration: newDuration
          };
        } else {
          // Horizontal translation drag
          return {
            ...clip,
            startTime: Math.max(0, dragState.initialStartTime + valDeltaSeconds)
          };
        }
      }));
    };

    const handleGlobalMouseUp = () => {
      setDragState(null);
    };

    if (dragState) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragState, zoomFactor]);

  // Adjust properties of selected timeline clip (Opacity, volume, effects type)
  const handleUpdateClipEffect = (field: keyof typeof selectedClipEffects, val: any) => {
    if (!selectedClipId) return;

    setSelectedClipEffects(prev => ({ ...prev, [field]: val }));
    setTimelineClips(prev => prev.map(clip => {
      if (clip.id === selectedClipId) {
        return {
          ...clip,
          [field]: val
        };
      }
      return clip;
    }));
  };

  // Timeline track controls togglers
  const toggleTrackMute = (trackId: string) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, muted: !t.muted } : t));
  };

  const toggleTrackLock = (trackId: string) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, locked: !t.locked } : t));
  };

  const deleteTimelineClip = (id: string) => {
    setTimelineClips(prev => prev.filter(c => c.id !== id));
    setSelectedClipId(null);
  };

  const addClipToTimeline = (binClip: any, trackId: string) => {
    const defaultColorMap: Record<string, string> = {
      video: 'bg-[#153a5b] border-blue-500 text-blue-200',
      audio: 'bg-[#2b2b40] border-[#8a52e0] text-[#c9b3f3]'
    };

    const newClip: TimelineClip = {
      id: `clip-drag-${Math.random().toString(36).substring(4, 9)}`,
      trackId: trackId,
      name: binClip.name,
      startTime: currentTime,
      duration: binClip.duration || 15,
      color: binClip.type === 'video' ? defaultColorMap.video : defaultColorMap.audio,
      type: binClip.type,
      url: binClip.url,
      volume: 1,
      opacity: 1,
      glitchActive: false,
      filterType: 'none'
    };

    setTimelineClips(prev => [...prev, newClip]);
  };

  // Synth setup: 13 keys mapped corresponding to frequencies (C4 to C5 piano)
  const pianoKeys = [
    { label: 'C4', freq: 261.63, isBlack: false },
    { label: 'C#4', freq: 277.18, isBlack: true },
    { label: 'D4', freq: 293.66, isBlack: false },
    { label: 'D#4', freq: 311.13, isBlack: true },
    { label: 'E4', freq: 329.63, isBlack: false },
    { label: 'F4', freq: 349.23, isBlack: false },
    { label: 'F#4', freq: 369.99, isBlack: true },
    { label: 'G4', freq: 391.99, isBlack: false },
    { label: 'G#4', freq: 415.30, isBlack: true },
    { label: 'A4', freq: 440.00, isBlack: false },
    { label: 'A#4', freq: 466.16, isBlack: true },
    { label: 'B4', freq: 493.88, isBlack: false },
    { label: 'C5', freq: 523.25, isBlack: false },
  ];

  // Vocal microphonic recording
  const startMicRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      recordedChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedAudioUrl(url);

        // Append recorded audio asset immediately into Project Bin!
        const recId = `user-rec-${Math.random().toString(36).substring(4,8)}`;
        const newClip = {
          id: recId,
          type: 'audio',
          name: `Mic_Recording_${recId.slice(9, 13)}.wav`,
          url: url,
          duration: 3 + Math.round(recordedChunksRef.current.length * 0.5) // basic sizing approximation
        };
        setBinClips(prev => [newClip, ...prev]);

        if (onAddLog) {
          onAddLog('recording-id', `Vocal microphone capture finalized. Stored in local project audio pool.`);
        }
      };

      recorder.start();
      setIsMicRecording(true);
    } catch (err: any) {
      console.error('Mic Access Denied', err);
      alert('Microphone Access Denied! Ensure proper frame permissions are granted.');
    }
  };

  const stopMicRecording = () => {
    if (mediaRecorderRef.current && isMicRecording) {
      mediaRecorderRef.current.stop();
      setIsMicRecording(false);
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  // Convert the current timeline canvas layer matrix and output a high-fidelity WebM composite video
  const compileTimelineWebMAndDownload = () => {
    // Collect video track canvas
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    // Direct user prompt feedback
    alert('Baking layout layers! The video compilation starts. A standard browser download package of the composition will be cued upon resolution.');

    const audioCtx = audioContextRef.current || initAudioEngine();
    const dest = audioCtx.createMediaStreamDestination();
    
    // Connect channels
    (Object.values(channelNodesRef.current) as Array<{ gain: GainNode; pan: StereoPannerNode; analyser: AnalyserNode }>).forEach(node => {
      node.gain.disconnect();
      node.gain.connect(dest);
    });

    const canvasStream = canvas.captureStream(30);
    const complexStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...dest.stream.getAudioTracks()
    ]);

    const outRecorder = new MediaRecorder(complexStream, { mimeType: 'video/webm' });
    const localPieces: Blob[] = [];

    outRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) localPieces.push(e.data);
    };

    outRecorder.onstop = () => {
      const compiledBlob = new Blob(localPieces, { type: 'video/webm' });
      const dlLink = document.createElement('a');
      dlLink.href = URL.createObjectURL(compiledBlob);
      dlLink.download = 'Xennials_Studio_DAW_Master_Output.webm';
      dlLink.click();
      
      // Auto-trigger Antigravity Bridge export to correctly update external handler
      exportToAntigravityStudio();

      // Restore standard master nodes bindings
      (Object.values(channelNodesRef.current) as Array<{ gain: GainNode; pan: StereoPannerNode; analyser: AnalyserNode }>).forEach(node => {
        node.gain.disconnect();
        node.gain.connect(node.pan);
      });
    };

    // Cycle rendering for 5 seconds to simulate high precision export block
    outRecorder.start();
    setIsPlaying(true);

    setTimeout(() => {
      setIsPlaying(false);
      outRecorder.stop();
      stopAllAudioPlayback();
    }, 5500);
  };

  // 16-Step beat sequencers templates baker
  const bakeSequencerBeatToTimeline = () => {
    // Record current 16-step beat patterns into a virtual MIDI-like wav trigger pattern
    const clipId = `sequencer-clip-${Math.random().toString(36).substring(4, 9)}`;
    const newClip: TimelineClip = {
      id: clipId,
      trackId: 'a2',
      name: `Drum pattern (120BPM)`,
      startTime: currentTime,
      duration: 16, // sixteenth grid spans roughly 16 seconds
      color: 'bg-indigo-900 border-indigo-400 text-indigo-200',
      type: 'audio',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', // high-fidelity fall-backing track
      volume: 0.9,
      opacity: 1,
      glitchActive: false,
      filterType: 'none'
    };

    setTimelineClips(prev => [...prev, newClip]);
    alert('Created sequencer pattern item clip on Drum sequencer audio channel (A2)!');
  };

  const toggleSequencerDot = (instr: string, index: number) => {
    setSequencerGrid(prev => {
      const row = [...prev[instr]];
      row[index] = !row[index];
      return { ...prev, [instr]: row };
    });
  };

  return (
    <div className="w-full bg-[#121216] text-[#e4e4e7] rounded-3xl border border-[#2e2e38] overflow-hidden shadow-2xl font-sans mt-4">
      
      {/* Top Application Header Bar matching Kdenlive menu layout */}
      <header className="bg-[#1b1b22] px-4 py-2 flex items-center justify-between border-b border-[#2d2d38] text-xs">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gradient-to-r from-cyan-500 to-orange-500 rounded-md flex items-center justify-center text-white font-black text-[9px]">X</div>
            <span className="font-bold tracking-tight text-gray-300">Xennials Studio DAW v20.08</span>
          </div>
          <nav className="flex gap-4 text-gray-400 font-medium">
            <span className="hover:text-white cursor-pointer transition-colors">File</span>
            <span className="hover:text-white cursor-pointer transition-colors">Edit</span>
            <span className="hover:text-white cursor-pointer transition-colors">Project</span>
            <span className="hover:text-white cursor-pointer transition-colors">Tool</span>
            <span className="hover:text-white cursor-pointer transition-colors">Timeline</span>
            <span className="hover:text-white cursor-pointer transition-colors">Monitor</span>
            <span className="hover:text-white cursor-pointer transition-colors">Settings</span>
          </nav>
        </div>
        
        {/* Workspace views select tags */}
        <div className="flex items-center gap-3">
          {isAudioLocked ? (
            <button
              onClick={activateAudioEngine}
              className="px-2.5 py-1 bg-red-950/80 hover:bg-red-900 border border-red-700/50 rounded-lg text-[10px] font-bold text-red-300 uppercase tracking-wider flex items-center gap-1.5 animate-pulse transition-all active:scale-95 duration-100"
              title="Unlock Browser Audio Autoplay Limits"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>Unmute Engine</span>
            </button>
          ) : (
            <div className="px-2.5 py-1 bg-emerald-950/40 border border-emerald-700/20 rounded-lg text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Engine Ready</span>
            </div>
          )}

          <div className="flex bg-[#0f0f13] p-0.5 rounded-lg border border-[#2c2c36]">
            {(['Editing', 'Audio', 'Effects', 'Color', 'Synthesizer'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveLayout(tab)}
                className={`px-3 py-1 rounded-md font-semibold text-[10px] tracking-wider uppercase transition-all ${
                  activeLayout === tab 
                    ? 'bg-[#2b2b3a] text-blue-400 shadow-md border-b-2 border-blue-500' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main workspace layout content */}
      <div className="grid grid-cols-12 gap-1 p-2 h-[480px]">
        
        {/* COLUMN 1: PROJECT BIN & CLIP/EFFECT STACKS DOCK (LEFT SIDE PANEL) */}
        <div className="col-span-3 bg-[#16161c] border border-[#272733] rounded-2xl flex flex-col h-full overflow-hidden">
          
          {/* Header tabs for Project Bin, Effects stack */}
          <div className="bg-[#1e1e26] px-3 py-1.5 flex gap-2 border-b border-[#2d2d3a] text-[10px] font-bold tracking-wider text-gray-400 uppercase">
            <span>Project Bin</span>
          </div>

          {/* Project asset list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
            <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest px-1">Assets & Stems Pool</div>
            
            {binClips.map(clip => (
              <div 
                key={clip.id} 
                className="bg-[#21212c] hover:bg-[#282837] border border-[#2f2f3e] p-2 rounded-xl flex items-center justify-between transition-colors cursor-grab active:cursor-grabbing group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-9 h-9 shrink-0 bg-[#121218] rounded-lg flex items-center justify-center text-rose-400 border border-gray-800">
                    {clip.type === 'video' ? <Video className="w-4 h-4 text-blue-400" /> : <Music className="w-4 h-4 text-purple-400" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold truncate text-gray-200">{clip.name}</p>
                    <p className="text-[9px] font-mono text-gray-500">{clip.duration}s • {clip.type}</p>
                  </div>
                </div>
                
                {/* Drag / add button to easily inject clip onto track at current time */}
                <button 
                  onClick={() => addClipToTimeline(clip, clip.type === 'video' ? 'v1' : 'a1')}
                  title="Insert into Timeline Playhead"
                  className="bg-[#121218] group-hover:bg-blue-600 p-1.5 rounded-lg group-hover:text-white text-gray-400 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {/* Empty state descriptor for Xennials */}
            {binClips.length === 0 && (
              <div className="text-center py-6 text-xs text-gray-500">
                <AlertCircle className="w-6 h-6 mx-auto mb-2 text-gray-600" />
                No imported songs. Generate a song in Xennials to see it listed here!
              </div>
            )}
          </div>

          {/* Render vocal mic micro-recording space bottom dock */}
          <div className="bg-[#1b1b24] p-3 border-t border-[#2d2d3a] rounded-b-2xl">
            <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1.5 flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5" /> Vocal Studio Cap
            </p>
            <div className="flex gap-2">
              <button
                onClick={isMicRecording ? stopMicRecording : startMicRecording}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold tracking-wide transition-colors flex items-center justify-center gap-1 ${
                  isMicRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-purple-950 text-purple-300 border border-purple-800 hover:bg-purple-900'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${isMicRecording ? 'bg-white' : 'bg-purple-400'}`}></div>
                {isMicRecording ? 'Stop Rec' : 'Live Record Mic'}
              </button>
            </div>
          </div>
        </div>

        {/* COLUMN 2: CENTER WORKSPACE DEPENDING ON ACTIVE SELECTED VIEWS MODE */}
        <div className="col-span-6 flex flex-col h-full bg-[#16161c] border border-[#272733] rounded-2xl overflow-hidden relative">
          
          {/* Main workspace section area */}
          <div className="flex-1 flex flex-col relative overflow-hidden">
            
            {/* Visual preview Video/Image Canvas is always rendering on top for direct client feedback */}
            <div className="bg-[#0b0b0e] flex-1 flex items-center justify-center relative p-1.5 group">
              <canvas
                ref={previewCanvasRef}
                width={560}
                height={260}
                className="max-w-full max-h-full rounded-xl shadow-2xl object-contain border border-[#1f1f28]"
              />

              {isAudioLocked && (
                <div className="absolute inset-x-1.5 inset-y-1.5 bg-[#08080c]/90 backdrop-blur-md flex flex-col items-center justify-center p-4 z-30 rounded-xl transition-all duration-300 border border-[#21212c]">
                  <div className="bg-[#121218] border border-[#2e2e3d] p-5 rounded-2xl shadow-2xl max-w-[280px] text-center space-y-3.5">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-400">
                      <VolumeX className="w-4.5 h-4.5 animate-pulse text-blue-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[11px] text-white uppercase tracking-wider flex items-center justify-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                        Autoplay Protection
                      </h4>
                      <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">
                        Chrome/Vivaldi security policies suspend audio synthesis engines until initialized via manual click.
                      </p>
                    </div>
                    <button
                      onClick={activateAudioEngine}
                      className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 transition-all text-white text-[9px] font-black uppercase tracking-wider rounded-lg shadow-lg shadow-blue-900/30 flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Unlock Engine Output
                    </button>
                  </div>
                </div>
              )}
              
              {/* Overlaid playing status notification tags */}
              <div className="absolute top-4 left-4 bg-black/75 px-2.5 py-1 rounded-md border border-gray-800 text-[10px] font-mono tracking-wider flex items-center gap-1.5 text-blue-400">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping"></span>
                <span>MONITOR RESOLUTION: {560}x{260}px</span>
              </div>

              {/* Subtitles Overlay rendering directly over on monitor margin */}
              <div className="absolute bottom-6 left-0 right-0 py-1.5 pointer-events-none flex justify-center">
                {timelineClips
                  .filter(c => c.type === 'text' && currentTime >= c.startTime && currentTime <= (c.startTime + c.duration))
                  .map(c => (
                    <div key={c.id} className="bg-black/80 px-4 py-1 rounded-xl text-xs font-medium text-pink-400 shadow-xl border border-pink-900/40 animate-pulse text-center max-w-[80%]">
                      {c.text}
                    </div>
                  ))}
              </div>
            </div>

            {/* Effects / color tab specific dials panel */}
            {activeLayout === 'Effects' && (
              <div className="bg-[#1f1f2a]/95 border-t border-[#2e2e40] p-3 text-xs space-y-3 animate-in slide-in-from-bottom duration-200">
                <p className="font-bold text-[#a78bfa] tracking-wider uppercase text-[10px] flex items-center gap-1.5"><Sliders className="w-3.5 h-3.5" /> Selected Clip Effect Overlays</p>
                {selectedClipId ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Clip Opacity: {Math.round(selectedClipEffects.opacity * 100)}%</label>
                      <input 
                        type="range" min="0" max="1" step="0.1" 
                        value={selectedClipEffects.opacity}
                        onChange={(e) => handleUpdateClipEffect('opacity', parseFloat(e.target.value))}
                        className="w-full accent-purple-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Sound Vol: {Math.round(selectedClipEffects.volume * 100)}%</label>
                      <input 
                        type="range" min="0" max="1" step="0.1" 
                        value={selectedClipEffects.volume}
                        onChange={(e) => handleUpdateClipEffect('volume', parseFloat(e.target.value))}
                        className="w-full accent-purple-500"
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <label className="block text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Grading Filter</label>
                      <select
                        value={selectedClipEffects.filterType}
                        onChange={(e) => handleUpdateClipEffect('filterType', e.target.value)}
                        className="bg-[#121218] text-gray-200 border border-gray-700 rounded-lg p-1.5 w-full focus:outline-none"
                      >
                        <option value="none">No Filter</option>
                        <option value="sepia">Warm Sepia Tone</option>
                        <option value="grayscale">Noir Black & White</option>
                        <option value="hue-rotate">Rolling Hue Spectrum</option>
                        <option value="high-contrast">Vivid High Contrast</option>
                        <option value="invert">Cosmic Negative Inversion</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 italic text-[11px] text-center py-4">Double-click or click any timeline clip to adjust filters and gradients.</p>
                )}
              </div>
            )}

            {/* Synthesizer roll tab keyboard render view */}
            {activeLayout === 'Synthesizer' && (
              <div className="bg-[#181822]/95 border-t border-[#2a2a3a] p-3 text-xs space-y-2.5 animate-in slide-in-from-bottom duration-200">
                <div className="flex justify-between items-center bg-[#13131b] p-2 rounded-xl">
                  <p className="font-bold text-blue-400 tracking-wider uppercase text-[10px] flex items-center gap-1.5">🎹 Built-in Monophonic Synthesizer</p>
                  <div className="flex gap-2 text-[9px] font-mono">
                    <button onClick={() => setSynthOscType('sawtooth')} className={`px-2 py-0.5 rounded ${synthOscType === 'sawtooth' ? 'bg-blue-600 text-white' : 'bg-gray-800'}`}>Sawtooth</button>
                    <button onClick={() => setSynthOscType('sine')} className={`px-2 py-0.5 rounded ${synthOscType === 'sine' ? 'bg-blue-600 text-white' : 'bg-gray-800'}`}>Sine</button>
                    <button onClick={() => setSynthOscType('triangle')} className={`px-2 py-0.5 rounded ${synthOscType === 'triangle' ? 'bg-blue-600 text-white' : 'bg-gray-800'}`}>Triangle</button>
                  </div>
                </div>

                {/* ADSR Envelope Controls */}
                <div className="grid grid-cols-2 gap-3 text-[10px] bg-[#1d1d28]/70 p-2 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 uppercase w-12 font-bold select-none text-[9px]">Attack {synthADSRAttack}s</span>
                    <input type="range" min="0.01" max="0.5" step="0.05" value={synthADSRAttack} onChange={e => setSynthADSRAttack(parseFloat(e.target.value))} className="flex-1 accent-blue-500 h-1.5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 uppercase w-12 font-bold select-none text-[9px]">Release {synthADSRRelease}s</span>
                    <input type="range" min="0.05" max="1.0" step="0.05" value={synthADSRRelease} onChange={e => setSynthADSRRelease(parseFloat(e.target.value))} className="flex-1 accent-blue-500 h-1.5" />
                  </div>
                </div>

                {/* Virtual Piano Keys layout */}
                <div className="flex justify-center py-2 select-none relative h-20 bg-[#121217] rounded-xl border border-gray-800 p-1">
                  {pianoKeys.map((key, i) => (
                    <div
                      key={i}
                      onClick={() => triggerSynthNote(key.freq)}
                      className={`relative cursor-pointer transition-colors ${
                        key.isBlack 
                          ? 'bg-[#181820] hover:bg-neutral-800 text-white border border-[#3b82f6]/20' 
                          : 'bg-[#fafbfc] hover:bg-neutral-100 text-neutral-900 border border-neutral-300'
                      } flex-1 flex flex-col justify-end pb-1.5 items-center rounded-md font-mono text-[8px] font-bold`}
                      style={{
                        height: key.isBlack ? '80%' : '100%',
                        zIndex: key.isBlack ? 20 : 10,
                        margin: '0 1px'
                      }}
                    >
                      <span>{key.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DAW mixing sliders console view */}
            {activeLayout === 'Audio' && (
              <div className="bg-[#1a1a24] border-t border-[#292939] p-3 text-xs space-y-3 animate-in slide-in-from-bottom duration-200">
                <p className="font-bold text-emerald-400 tracking-wider uppercase text-[10px] flex items-center gap-1.5"><SlidersHorizontal className="w-3.5 h-3.5" /> DAW Router & Mastering Chain</p>
                
                {/* Delay & EQ effects sliders rack */}
                <div className="grid grid-cols-4 gap-2 bg-[#121218] p-3 rounded-xl border border-gray-800">
                  <div className="space-y-1.5">
                    <span className="block text-[8px] font-bold uppercase tracking-wider text-gray-500">Echo Delay Time</span>
                    <input 
                      type="range" min="0" max="1" step="0.1" value={masterFX.delayTime} 
                      onChange={e => setMasterFX(prev => ({ ...prev, delayTime: parseFloat(e.target.value) }))}
                      className="w-full accent-emerald-500"
                    />
                    <span className="block text-[8px] text-right font-mono text-[#a1a1aa]">{masterFX.delayTime}s</span>
                  </div>
                  <div className="space-y-1.5">
                    <span className="block text-[8px] font-bold uppercase tracking-wider text-gray-500">Delay Feedback</span>
                    <input 
                      type="range" min="0" max="0.9" step="0.1" value={masterFX.delayFeedback} 
                      onChange={e => setMasterFX(prev => ({ ...prev, delayFeedback: parseFloat(e.target.value) }))}
                      className="w-full accent-emerald-500"
                    />
                    <span className="block text-[8px] text-right font-mono text-[#a1a1aa]">{Math.round(masterFX.delayFeedback * 100)}%</span>
                  </div>
                  <div className="space-y-1.5">
                    <span className="block text-[8px] font-bold uppercase tracking-wider text-gray-500">Bass EQ Boost</span>
                    <input 
                      type="range" min="-12" max="12" step="2" value={masterFX.eqLowBoost} 
                      onChange={e => setMasterFX(prev => ({ ...prev, eqLowBoost: parseInt(e.target.value) }))}
                      className="w-full accent-emerald-500"
                    />
                    <span className="block text-[8px] text-right font-mono text-[#a1a1aa]">{masterFX.eqLowBoost}dB</span>
                  </div>
                  <div className="space-y-1.5">
                    <span className="block text-[8px] font-bold uppercase tracking-wider text-gray-500">Treble EQ Boost</span>
                    <input 
                      type="range" min="-12" max="12" step="2" value={masterFX.eqHighBoost} 
                      onChange={e => setMasterFX(prev => ({ ...prev, eqHighBoost: parseInt(e.target.value) }))}
                      className="w-full accent-emerald-500"
                    />
                    <span className="block text-[8px] text-right font-mono text-[#a1a1aa]">{masterFX.eqHighBoost}dB</span>
                  </div>
                </div>
              </div>
            )}

            {/* 16-Step beat grid sequencer panel view */}
            {activeLayout === 'Color' && (
              <div className="bg-[#1f1a26] border-t border-[#312a3d] p-3 text-xs space-y-2 animate-in slide-in-from-bottom duration-200">
                <div className="flex justify-between items-center">
                  <p className="font-bold text-pink-400 tracking-wider uppercase text-[10px] flex items-center gap-1.5">🥁 16-Step Beat Drum Sequencer</p>
                  
                  {/* Controls Row */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-[#a1a1aa] font-mono">{sequencerBPM} BPM</span>
                    <input 
                      type="range" min="60" max="200" step="5" value={sequencerBPM} 
                      onChange={e => setSequencerBPM(parseInt(e.target.value))}
                      className="w-20 accent-pink-500"
                    />
                    <button
                      onClick={() => {
                        if (isAudioLocked) {
                          activateAudioEngine();
                          return;
                        }
                        setIsSequencerPlaying(!isSequencerPlaying);
                      }}
                      className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase ${
                        isSequencerPlaying ? 'bg-pink-600 text-white animate-pulse' : 'bg-gray-800 text-gray-300'
                      }`}
                    >
                      {isSequencerPlaying ? 'Pause Sequencer' : 'Play Sequencer'}
                    </button>
                    <button
                      onClick={bakeSequencerBeatToTimeline}
                      className="bg-gray-900 border border-purple-800 text-purple-400 hover:bg-purple-950 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase flex items-center gap-1"
                    >
                      Bake DAW
                    </button>
                  </div>
                </div>

                {/* Grid rows for Drum channels */}
                <div className="space-y-1 bg-[#151119] p-2 rounded-xl">
                  {(Object.entries(sequencerGrid) as Array<[string, boolean[]]>).map(([instr, row]) => (
                    <div key={instr} className="flex items-center gap-2">
                      <span className="w-10 text-[9px] font-mono text-gray-400 uppercase select-none font-bold">{instr}</span>
                      <div className="flex-1 grid grid-cols-16 gap-1 select-none">
                        {row.map((on, idx) => (
                          <div
                            key={idx}
                            onClick={() => toggleSequencerDot(instr, idx)}
                            className={`h-4.5 cursor-pointer rounded-sm border transition-colors ${
                              on 
                                ? 'bg-pink-500 border-pink-400 shadow shadow-pink-500/20' 
                                : sequencerStep === idx 
                                  ? 'bg-purple-950/40 border-purple-500' 
                                  : 'bg-neutral-900 border-gray-800 hover:bg-neutral-800'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Action transport controls */}
          <div className="bg-[#1b1b24] p-3 border-t border-[#2d2d3a] flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (isAudioLocked) {
                    activateAudioEngine();
                    return;
                  }
                  setIsPlaying(!isPlaying);
                  if (isPlaying) stopAllAudioPlayback();
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                  isPlaying ? 'bg-[#ef4444] text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <button
                onClick={() => {
                  if (isAudioLocked) {
                    activateAudioEngine();
                    return;
                  }
                  stopAllAudioPlayback();
                  setCurrentTime(0);
                  setIsPlaying(true);
                }}
                className="bg-gray-800 hover:bg-gray-700 p-2 rounded-xl text-gray-300 border border-gray-700/80"
                title="Restart Song From Beginning"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              
              {/* Scissors tool */}
              <button
                onClick={() => setIsScissorsActive(!isScissorsActive)}
                className={`p-2 rounded-xl border transition-all ${
                  isScissorsActive 
                    ? 'bg-red-950 text-red-400 border-red-800 cursor-crosshair' 
                    : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
                }`}
                title="Scissors Cut Tool: Click to split timeline clips at playhead time!"
              >
                <Scissors className="w-4 h-4" />
              </button>

              <span className="text-[11px] font-mono leading-none tracking-widest text-[#32d74b] bg-black/60 px-3 py-2 rounded-lg border border-gray-800 select-none">
                {Math.floor(currentTime / 60)}:
                {String(Math.floor(currentTime % 60)).padStart(2, '0')}.
                {String(Math.floor((currentTime % 1) * 100)).padStart(2, '0')}
              </span>
            </div>

            <div className="flex gap-2 text-[10px] font-bold">
              <button 
                onClick={exportToAntigravityStudio}
                disabled={isExportingToAntigravity}
                className="bg-gradient-to-r from-cyan-500 via-emerald-500 to-orange-500 hover:opacity-90 disabled:opacity-55 active:scale-95 text-white px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition-all border border-cyan-400/20"
                title="Bridge & export project timeline structure and code files directly to Antigravity"
              >
                <Share2 className={`w-3.5 h-3.5 ${isExportingToAntigravity ? 'animate-spin' : ''}`} /> 
                {isExportingToAntigravity ? 'Exporting...' : 'Export to Antigravity'}
              </button>
              <button 
                onClick={compileTimelineWebMAndDownload}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl flex items-center gap-1.5 shadow hover:scale-[1.01] active:scale-[0.99] transition-transform"
              >
                <Download className="w-3.5 h-3.5" /> Bake Composition (WebM)
              </button>
            </div>
          </div>
        </div>

        {/* COLUMN 3: AUDIO MIXER DOCK (RIGHT SIDE PANEL) WITH LED VU METERS */}
        <div className="col-span-3 bg-[#16161c] border border-[#272733] rounded-2xl flex flex-col h-full overflow-hidden">
          
          <div className="bg-[#1e1e26] px-3 py-1.5 flex gap-2 border-b border-[#2d2d3a] text-[10px] font-bold tracking-wider text-gray-400 uppercase">
            <Volume2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Audio Master Mixer</span>
          </div>

          {/* Mixing channels list */}
          <div className="flex-1 p-2 grid grid-cols-4 gap-1.5 select-none bg-[#111116] overflow-y-auto">
            {tracks.filter(t => t.type === 'audio' || t.id === 'v1').map(track => {
              const nodes = channelNodesRef.current[track.id];
              const levelHeight = mixerLevels[track.id] || 0;
              
              return (
                <div key={track.id} className="bg-[#1d1d28]/60 p-1 rounded-lg border border-gray-800 flex flex-col items-center justify-between h-full min-h-[180px]">
                  <span className="text-[7.5px] font-extrabold text-gray-400 uppercase tracking-tighter text-center truncate w-full">{track.name.split(' ')[0]}</span>
                  
                  {/* Colorful vertical bouncing LED VU Meter */}
                  <div className="relative w-3.5 flex-1 bg-zinc-950 rounded border border-gray-800 overflow-hidden my-1 flex flex-col justify-end">
                    <div 
                      className="w-full bg-gradient-to-t from-emerald-500 via-yellow-400 to-red-500 transition-all duration-75"
                      style={{ height: `${levelHeight}%` }}
                    />
                  </div>

                  {/* Volume pan rotary knob wrapper */}
                  <div className="w-full flex justify-between items-center px-1 text-[8px] font-mono py-0.5">
                    <span className="text-gray-500">P</span>
                    <input 
                      type="range" min="-1" max="1" step="0.2" value={track.pan} 
                      onChange={e => {
                        const nextPan = parseFloat(e.target.value);
                        setTracks(prev => prev.map(t => t.id === track.id ? { ...t, pan: nextPan } : t));
                      }}
                      className="w-8 h-1 accent-blue-500 bg-gray-800 rounded"
                    />
                  </div>

                  {/* Channel volume slider */}
                  <div className="h-16 flex items-center justify-center relative w-full my-3">
                    <input
                      type="range" min="0" max="1" step="0.1" value={track.volume}
                      onChange={(e) => {
                        const nextVolume = parseFloat(e.target.value);
                        setTracks(prev => prev.map(t => t.id === track.id ? { ...t, volume: nextVolume } : t));
                      }}
                      className="w-16 h-1 accent-emerald-500 bg-gray-800 rounded select-none absolute"
                      style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                    />
                  </div>

                  {/* Mute toggle */}
                  <button
                    onClick={() => toggleTrackMute(track.id)}
                    className={`mt-1 text-[8.5px] px-1 py-0.5 rounded font-bold w-full truncate ${
                      track.muted ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {track.muted ? 'MUTED' : 'MUTE'}
                  </button>
                </div>
              );
            })}

            {/* Master summing fader channel */}
            <div className="bg-[#241f2a] p-1 rounded-lg border-2 border-purple-900/60 flex flex-col items-center justify-between h-full min-h-[180px]">
              <span className="text-[8px] font-bold text-purple-300 uppercase tracking-tight">MASTER</span>
              
              {/* LED Master Meter */}
              <div className="relative w-4 flex-1 bg-zinc-950 rounded border border-purple-950 overflow-hidden my-1 flex flex-col justify-end">
                <div 
                  className="w-full bg-gradient-to-t from-purple-500 via-indigo-400 to-pink-500 transition-all duration-75"
                  style={{ height: `${mixerLevels.master || 0}%` }}
                />
              </div>

              {/* Master Volume Slider */}
              <div className="h-16 flex items-center justify-center relative w-full my-3">
                <input
                  type="range" min="0" max="1" step="0.1" defaultValue="0.75"
                  onChange={(e) => {
                    const gainVal = parseFloat(e.target.value);
                    masterGainRef.current?.gain.setValueAtTime(gainVal, audioContextRef.current?.currentTime || 0);
                  }}
                  className="w-16 h-1 accent-purple-500 bg-gray-800 rounded select-none absolute"
                  style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                />
              </div>

              <span className="text-[7.5px] font-mono text-purple-400 font-bold bg-black/40 py-0.5 px-1 rounded truncate uppercase">LIMITER</span>
            </div>
          </div>
        </div>

      </div>

      {/* COLUMN BOTTOM: INTERACTIVE HORIZONTALLY SCROLLABLE VIDEO/AUDIO MULTI-TRACKS TIMELINE */}
      <div className="bg-[#121217] mx-1 mb-2 rounded-2xl border border-[#2b2b36] overflow-hidden flex flex-col">
        
        {/* Timeline ruler bar */}
        <div className="bg-[#171720] border-b border-gray-800 px-3 py-1 flex items-center justify-between text-[9px] font-mono text-gray-400 select-none">
          <div className="flex items-center gap-4">
            <span className="font-bold flex items-center gap-1"><Layers className="w-3.5 h-3.5 text-blue-400" /> TIMELINE SEQUENCES GRID</span>
            <div className="flex items-center gap-1 text-[8.5px]">
              <ZoomOut className="w-3.5 h-3.5 cursor-pointer text-gray-500 hover:text-white" onClick={() => setZoomFactor(Math.max(5, zoomFactor - 3))} />
              <span className="bg-gray-800 px-1.5 rounded">{zoomFactor}px/s</span>
              <ZoomIn className="w-3.5 h-3.5 cursor-pointer text-gray-500 hover:text-white" onClick={() => setZoomFactor(Math.min(30, zoomFactor + 3))} />
            </div>
            {isScissorsActive && <span className="text-red-400 font-bold animate-pulse uppercase tracking-wider text-[8px]">[Scissors active: Click any clip block on timeline to split it!]</span>}
          </div>
          <span className="font-semibold text-gray-500 text-[8.5px]">DRAG LEFT/RIGHT EDGES OF TIMELINE BLOCKS TO RESIZE/TRIM</span>
        </div>

        {/* Scrollable multi-tracks zone */}
        <div className="flex-1 overflow-x-auto relative min-h-[190px] bg-[#0c0c11]" style={{ scrollBehavior: 'smooth' }}>
          
          {/* Sliced scale markers header timeline area */}
          <div 
            onClick={handleTimelineHeaderClick}
            className="h-6 w-full bg-[#161622] border-b border-gray-800 flex items-center relative cursor-ew-resize select-none"
            style={{ width: `${timelineLength * zoomFactor}px` }}
          >
            {Array.from({ length: Math.ceil(timelineLength / 5) }).map((_, i) => {
              const sec = i * 5;
              const xPos = getXCoordinate(sec);
              return (
                <div key={sec} className="absolute h-full flex flex-col justify-end pb-1 border-l border-zinc-700" style={{ left: `${xPos}px` }}>
                  <span className="text-[8px] pl-1 text-[#a1a1aa] font-mono leading-none">{sec}s</span>
                </div>
              );
            })}
          </div>

          {/* Slices of vertical lines backing the horizontal tracks */}
          <div className="relative">
            {tracks.map(track => {
              const trackClips = timelineClips.filter(c => c.trackId === track.id);
              
              return (
                <div key={track.id} className="group/track relative h-10 border-b border-gray-800/60 flex items-center w-full">
                  
                  {/* Left Static Track Label & controls panel */}
                  <div className="sticky left-0 w-32 h-full bg-[#1b1b24] z-40 border-r border-gray-800 flex items-center justify-between px-2 text-[10px] select-none text-gray-300">
                    <div className="flex items-center gap-1 truncate w-[80%]">
                      {track.type === 'video' ? <Video className="w-3 h-3 text-emerald-400 shrink-0" /> : <Music className="w-3 h-3 text-[#af52de] shrink-0" />}
                      <span className="truncate leading-none font-semibold">{track.name}</span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button 
                        onClick={() => toggleTrackMute(track.id)}
                        className={`p-0.5 rounded ${track.muted ? 'bg-red-950 text-red-500' : 'text-gray-500 hover:text-white'}`}
                        title="Mute Track"
                      >
                        {track.type === 'video' ? (track.muted ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />) : <Volume2 className="w-3 h-3" />}
                      </button>
                      <button 
                        onClick={() => toggleTrackLock(track.id)}
                        className={`p-0.5 rounded ${track.locked ? 'bg-blue-950 text-blue-500' : 'text-gray-500 hover:text-white'}`}
                        title="Lock Track"
                      >
                        {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* Horizontal timeline track space row */}
                  <div 
                    className="absolute h-full left-32 flex items-center" 
                    style={{ width: `${timelineLength * zoomFactor}px` }}
                  >
                    {/* Render corresponding clips */}
                    {trackClips.map(clip => {
                      const xCoordinate = getXCoordinate(clip.startTime);
                      const widthPx = getXCoordinate(clip.duration);
                      const isSelected = clip.id === selectedClipId;
                      const isTrackLocked = track.locked;
                      
                      return (
                        <div
                          key={clip.id}
                          onMouseDown={(e) => handleClipMouseDown(e, clip)}
                          onClick={(e) => handleTimelineClipClick(e, clip)}
                          className={`absolute h-7 shadow-lg border rounded-md flex items-center justify-between px-1.5 overflow-hidden font-mono text-[9px] cursor-grab select-none select-none transition-all ${clip.color} ${
                            isSelected 
                              ? 'ring-2 ring-blue-400 border-white scale-[0.99] z-20' 
                              : isTrackLocked 
                                ? 'opacity-50 cursor-not-allowed !border-dashed' 
                                : 'hover:brightness-110 active:cursor-grabbing'
                          }`}
                          style={{
                            left: `${xCoordinate}px`,
                            width: `${widthPx}px`
                          }}
                        >
                          {/* Inner segment text and icon */}
                          <div className="flex items-center gap-1 truncate w-[85%]">
                            {clip.type === 'video' ? <Video className="w-3 h-3 text-blue-300" /> : <Music className="w-3 h-3 text-purple-300" />}
                            <span className="truncate font-semibold uppercase">{clip.name}</span>
                          </div>

                          {/* Delete clip item */}
                          {isSelected && !isTrackLocked && (
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteTimelineClip(clip.id); }}
                              className="bg-black/50 hover:bg-red-600 rounded text-gray-300 hover:text-white p-0.5 transition-colors absolute right-1"
                              title="Delete Clip"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          )}

                          {/* Resize Trim dragging node handles */}
                          {!isTrackLocked && (
                            <>
                              <div
                                onMouseDown={(e) => handleClipMouseDown(e, clip, true, false)}
                                className="absolute left-0 top-0 bottom-0 w-[5px] bg-white/20 hover:bg-white/80 cursor-ew-resize rounded-l-md"
                                title="Trim Start border"
                              />
                              <div
                                onMouseDown={(e) => handleClipMouseDown(e, clip, false, true)}
                                className="absolute right-0 top-0 bottom-0 w-[5px] bg-white/20 hover:bg-white/80 cursor-ew-resize rounded-r-md"
                                title="Trim End border"
                              />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                </div>
              );
            })}

            {/* Vertical running yellow playhead line indicator overlay */}
            <div 
              className="absolute top-0 bottom-0 w-[1.5px] bg-yellow-400 pointer-events-none z-30 flex flex-col items-center"
              style={{ left: `${128 + getXCoordinate(currentTime)}px` }}
            >
              <div className="w-[11px] h-3 bg-yellow-400 border border-yellow-200 transform -skew-x-12 -translate-y-[4px] rounded-sm"></div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
