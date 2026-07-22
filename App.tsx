/**
 * Main Application Component for Xennials Studio
 * 
 * This component serves as the primary container for the Xennials Studio application.
 * It manages the global state for music generation, including user inputs (prompts,
 * duration, lyrics options, image uploads), the generation process, and the display
 * of generated results.
 * 
 * Key Features:
 * - Prompt building (manual or via the PromptBuilder helper)
 * - Image upload for visual prompting
 * - Integration with Google GenAI for audio generation
 * - Audio playback and video export functionality
 * - Display of generated lyrics and metadata (title, cover art)
 */
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { Duration, LyricsOption, GenerationState, SongResult } from './types';
import { Icons, PROMPT_HELPER_CONFIG } from './constants';
import { CONFIG } from './src/config';
import { logFunctionCall } from './src/utils/logger';
import { createAudioUrlFromBase64 } from './src/utils/audioUtils';
import { cleanLyricsForDisplay } from './src/utils/lyricsUtils';
import { handleDownloadVideo } from './src/utils/videoUtils';
import { parseModelOutput, generateSongTitle, generateCoverArt, generateThematicRhymesAndPhrases } from './src/services/genaiService';
import { THEMATIC_RHYMES, THEMATIC_PHRASES } from './src/utils/lyricsPresetDb';
import { getRandomItem } from './src/utils/helpers';
import { PromptBuilder, HelperSection } from './src/components/PromptBuilder';
import { KdenliveEditor } from './src/components/KdenliveEditor';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { useAppHealth } from './src/utils/useAppHealth';
import { HealthDashboard } from './src/components/HealthDashboard';
import { AudioUnlockModal } from './src/components/AudioUnlockModal';
import { useAudioEngine } from './src/hooks/useAudioEngine';
import { XennialsLogo } from './src/components/XennialsLogo';
import { Sun, Moon, ExternalLink, Loader2, FileDown } from 'lucide-react';
import { GoogleDocsIntegration } from './src/components/GoogleDocsIntegration';
import { GoogleMeetIntegration } from './src/components/GoogleMeetIntegration';
import { exportToGoogleDoc } from './src/services/googleDocsService';
import { googleSignIn } from './src/services/googleAuth';
import { exportLyricsToPDF } from './src/utils/pdfExport';

const App: React.FC = () => {
  const { audioContext } = useAudioEngine();
  const healthMetrics = useAppHealth(audioContext);
  const [darkMode, setDarkMode] = useState<boolean>(true);

  // Google Docs and Drive Integration State
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [colabTab, setColabTab] = useState<'docs' | 'meet'>('docs');
  const [exportingSongIds, setExportingSongIds] = useState<Record<string, { loading: boolean; url?: string; error?: string }>>({});

  const handleExportSongLyrics = async (songId: string, title: string, lyrics: string) => {
    let currentToken = googleToken;
    if (!currentToken) {
      const confirmLogin = window.confirm('To export lyrics to a Google Doc, you need to sign in with Google Docs and Drive permissions. Would you like to sign in now?');
      if (!confirmLogin) return;
      try {
        const result = await googleSignIn();
        if (result) {
          currentToken = result.accessToken;
          setGoogleToken(result.accessToken);
        } else {
          return;
        }
      } catch (err: any) {
        alert('Google Sign-In failed: ' + (err.message || err));
        return;
      }
    }
    
    if (!currentToken) return;

    setExportingSongIds(prev => ({ ...prev, [songId]: { loading: true } }));
    try {
      const cleanLyricsText = cleanLyricsForDisplay(lyrics);
      const docTitle = `${title || 'Untitled Composition'} - Lyrics`;
      const result = await exportToGoogleDoc(currentToken, docTitle, cleanLyricsText);
      setExportingSongIds(prev => ({
        ...prev,
        [songId]: { loading: false, url: result.url }
      }));
    } catch (err: any) {
      console.error(err);
      setExportingSongIds(prev => ({
        ...prev,
        [songId]: { loading: false, error: err.message || 'Export failed.' }
      }));
    }
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [darkMode]);

  const [prompt, setPrompt] = useState('');
  const [isPromptManual, setIsPromptManual] = useState(false);
  const [duration, setDuration] = useState<Duration>('Clip (30s)');
  const [lyricsOption, setLyricsOption] = useState<LyricsOption>('Auto');
  const [customLyrics, setCustomLyrics] = useState(() => localStorage.getItem('xennials_lyrics_draft') || '');
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(() => localStorage.getItem('xennials_lyrics_draft_time') || null);

  // Auto-save customLyrics draft
  useEffect(() => {
    if (customLyrics.trim()) {
      localStorage.setItem('xennials_lyrics_draft', customLyrics);
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      localStorage.setItem('xennials_lyrics_draft_time', nowStr);
      setDraftSavedAt(nowStr);
    } else {
      localStorage.removeItem('xennials_lyrics_draft');
      localStorage.removeItem('xennials_lyrics_draft_time');
      setDraftSavedAt(null);
    }
  }, [customLyrics]);
  const [gen, setGen] = useState<GenerationState>({ results: [] });
  const [isResultPlaying, setIsResultPlaying] = useState<string | null>(null);
  const [encodingVideoId, setEncodingVideoId] = useState<string | null>(null);
  const [encodingProgress, setEncodingProgress] = useState(0);
  const [selectedImages, setSelectedImages] = useState<{data: string, mimeType: string, previewUrl: string}[]>([]);
  const [isTriggering, setIsTriggering] = useState(false);
  
  // Tab Views Switchers
  const [activeTab, setActiveTab] = useState<'composer' | 'kdenlive'>('composer');
  const [kdenliveImportTarget, setKdenliveImportTarget] = useState<SongResult | null>(null);

  // Songwriting Assistant States
  const [lyricsTheme, setLyricsTheme] = useState<string>('Midnight City');
  const [rhymeSearch, setRhymeSearch] = useState<string>('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState<boolean>(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [assistantTab, setAssistantTab] = useState<'presets' | 'ai'>('presets');

  const insertTextAtCursor = (textToInsert: string) => {
    const textarea = document.getElementById('custom-lyrics-textarea') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = customLyrics.substring(0, start);
      const after = customLyrics.substring(end);
      setCustomLyrics(before + textToInsert + after);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
      }, 50);
    } else {
      setCustomLyrics(prev => prev ? prev + '\n' + textToInsert : textToInsert);
    }
  };

  const handleFetchSuggestions = async (type: 'rhymes' | 'phrases') => {
    if (type === 'rhymes' && !rhymeSearch.trim()) {
      setSuggestionError('Please type a search word first!');
      return;
    }
    
    setIsGeneratingSuggestions(true);
    setSuggestionError(null);
    try {
      const suggestions = await generateThematicRhymesAndPhrases(lyricsTheme, rhymeSearch, type);
      if (suggestions && suggestions.length > 0) {
        setAiSuggestions(suggestions);
      } else {
        setSuggestionError('No suggestions returned. Try again or try a different word.');
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestionError('Failed to fetch from Gemini. Check settings or network.');
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  // Helper Mode States
  const [isHelperOpen, setIsHelperOpen] = useState(false);
  const [helperSections, setHelperSections] = useState<HelperSection[]>([
    { 
      id: 'initial', 
      type: 'main', 
      mood: getRandomItem(PROMPT_HELPER_CONFIG.moods), 
      gender: getRandomItem(PROMPT_HELPER_CONFIG.genders), 
      theme: getRandomItem(PROMPT_HELPER_CONFIG.themes) 
    }
  ]);
  const [activeSelector, setActiveSelector] = useState<{ sectionId: string, type: 'mood' | 'gender' | 'theme' | 'timestamp' | 'bpm' | 'scale' } | null>(null);
  
  const consoleRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (promptTextareaRef.current) {
      promptTextareaRef.current.style.height = 'auto';
      promptTextareaRef.current.style.height = `${promptTextareaRef.current.scrollHeight}px`;
    }
  }, [prompt]);

  // Sync Helper sections to Prompt
  useEffect(() => {
    if (isHelperOpen) {
      const generated = helperSections.map(s => {
        const scaleInfo = s.scale ? ` in the scale of ${s.scale.toLowerCase()}` : '';

        if (s.type === 'main') {
          const bpmInfo = s.bpm ? ` at ${s.bpm.toLowerCase()}` : '';
          const musicDetails = `${bpmInfo}${scaleInfo}`;
          return `Create a ${s.mood?.toLowerCase()} ${s.gender?.toLowerCase()} song about ${s.theme?.toLowerCase()}${musicDetails}.`;
        } else {
          const musicDetails = `${scaleInfo}`;
          return `[From ${s.timestamp}] the song transitions to a ${s.mood?.toLowerCase()} ${s.gender?.toLowerCase()} song${musicDetails}.`;
        }
      }).join('\n');
      setPrompt(generated);
      setIsPromptManual(false); // Helper sync is not "manual typing"
    }
  }, [isHelperOpen, helperSections]);

  useEffect(() => {
    Object.values(consoleRefs.current).forEach(el => {
      if (el) {
        (el as HTMLDivElement).scrollTop = (el as HTMLDivElement).scrollHeight;
      }
    });
  }, [gen.results]);

  const handleSelectKey = async () => {
    if ((window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Limit to 10 images total
    const remainingSlots = 10 - selectedImages.length;
    const filesToProcess = files.slice(0, remainingSlots);

    filesToProcess.forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        setSelectedImages(prev => [...prev, { data: base64, mimeType: file.type, previewUrl: URL.createObjectURL(file) }]);
      };
      reader.readAsDataURL(file);
    });
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].previewUrl);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  const handleFeelingLucky = () => {
    // Check if the prompt is manual and not empty. If so, do nothing.
    if (isPromptManual && prompt.trim() !== '') return;

    const randomMood = getRandomItem(PROMPT_HELPER_CONFIG.moods);
    const randomGender = getRandomItem(PROMPT_HELPER_CONFIG.genders);
    const randomTheme = getRandomItem(PROMPT_HELPER_CONFIG.themes);
    
    setPrompt(`Create a ${randomMood.toLowerCase()} ${randomGender.toLowerCase()} song about ${randomTheme.toLowerCase()}.`);
    setIsPromptManual(false); // Mark as generated
  };

  const updateHelperSection = (id: string, updates: Partial<HelperSection>) => {
    setHelperSections(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const updateResult = (id: string, updater: (prev: SongResult) => SongResult) => {
    setGen(prev => ({ results: prev.results.map(r => r.id === id ? updater(r) : r) }));
  };

  const addLog = (id: string, message: string) => {
    updateResult(id, prev => ({ ...prev, logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] ${message}`] }));
    
    // Auto-record persistent critical failure diagnostics to local storage
    const lowerMsg = message.toLowerCase();
    const isError = lowerMsg.includes('fail') || 
                    lowerMsg.includes('error') || 
                    lowerMsg.includes('exception') || 
                    lowerMsg.includes('denied') || 
                    lowerMsg.includes('reject') ||
                    lowerMsg.includes('locked');
                    
    if (isError) {
      try {
        const existingLogs = localStorage.getItem('xennials_diagnostic_logs');
        const logs = existingLogs ? JSON.parse(existingLogs) : [];
        logs.push({
          timestamp: new Date().toISOString(),
          message: `[ID: ${id}] ${message}`,
          severity: 'critical'
        });
        localStorage.setItem('xennials_diagnostic_logs', JSON.stringify(logs.slice(-20))); // Keep last 20
      } catch (e) {
        console.warn('Failed to serialise diagnostic log entry:', e);
      }
    }
  };

  const toggleExpand = (id: string) => {
    setGen(prev => ({ results: prev.results.map(r => r.id === id ? { ...r, isExpanded: !r.isExpanded } : r) }));
  };

  const handleGenerateSongTitle = async (id: string, musicPrompt: string, lyricContext: string) => {
    addLog(id, "Decoding narrative architecture for title...");
    const title = await generateSongTitle(musicPrompt, lyricContext);
    updateResult(id, r => ({ ...r, title }));
    addLog(id, `Identity confirmed: "${title}"`);
    return title;
  };

  const handleGenerateCoverArt = async (id: string, musicPrompt: string, lyricContext: string, title?: string) => {
    addLog(id, "Synthesizing visual representation...");
    const base64Image = await generateCoverArt(musicPrompt, lyricContext, title);
    if (base64Image) {
      updateResult(id, r => ({ ...r, coverImageUrl: base64Image }));
      addLog(id, "Visual synthesis finalized.");
    } else {
      addLog(id, "Visual synthesis skipped.");
    }
  };

  const handleGenerate = async (overrides?: { prompt: string, duration: Duration, lyricsOption: LyricsOption, customLyrics?: string }) => {
    const activePrompt = overrides?.prompt ?? prompt;
    const activeDuration = overrides?.duration ?? duration;
    const activeLyricsOption = overrides?.lyricsOption ?? lyricsOption;
    const activeCustomLyrics = overrides?.customLyrics ?? customLyrics;
    if (!activePrompt.trim() && selectedImages.length === 0) return;

    // Check for API key if Pro or Clip model is selected
    if (activeDuration === 'Pro' || activeDuration === 'Clip (30s)') {
      if ((window as any).aistudio?.hasSelectedApiKey) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
          if ((window as any).aistudio?.openSelectKey) {
            await (window as any).aistudio.openSelectKey();
          }
          return; // Stop generation so the user can select the key and try again
        }
      }
    }

    setIsTriggering(true);
    setTimeout(() => setIsTriggering(false), 200);

    const newId = Math.random().toString(36).substring(7);
    const newResult: SongResult = {
      id: newId, status: 'generating', logs: [], audioUrl: null, coverImageUrl: null, title: null, lyrics: '', metadata: '', fullPrompt: null, error: null, duration: activeDuration, timestamp: new Date(), isExpanded: true,
      originalPrompt: activePrompt, originalDuration: activeDuration, originalLyricsOption: activeLyricsOption
    };
    setGen(prev => ({ results: [newResult, ...prev.results.map(r => ({ ...r, isExpanded: false }))] }));
    const modelId = activeDuration === 'Pro' ? CONFIG.MODEL_ID_FULL : CONFIG.MODEL_ID_SHORT;
    const modelDisplayName = activeDuration === 'Pro' ? 'Xennials Pro' : 'Xennials Clip';
    addLog(newId, `Waking ${modelDisplayName} engine...`);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let lyricInstruction = activeLyricsOption === 'Instrumental' ? "IMPORTANT: This track MUST be strictly INSTRUMENTAL." : 
                          activeLyricsOption === 'Custom' ? `\nUse these exact lyrics:\n ${activeCustomLyrics}` : "\nGenerate lyrics with precise [seconds:] timing markers.";
      const contextPart = activePrompt.trim() ? `\nContext: "${activePrompt}".` : '';
      const promptText = `Generate a ${activeDuration === 'Pro' ? 'full-length' : '30-second'} track.${contextPart} ${ lyricInstruction }.`;
      
      // Save the full prompt for display later
      updateResult(newId, r => ({ ...r, fullPrompt: promptText }));
      
      const contents: any = selectedImages.length > 0 ? { 
        parts: [
          { text: promptText }, 
          ...selectedImages.map(img => ({ inlineData: { data: img.data, mimeType: img.mimeType } }))
        ] 
      } : promptText;
      const responseStream = await ai.models.generateContentStream({ model: modelId, contents: contents, config: { responseModalities: [Modality.AUDIO] } });
      let audioAccumulator = ""; let textAccumulator = ""; let mimeType = "audio/wav"; let auxTriggered = false;
      let currentPartType = ''; let textPartsSeen = 0;
      
      for await (const chunk of responseStream) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) continue;
        for (const part of parts) {
          if (part.inlineData?.data) { 
            currentPartType = 'audio';
            if (!audioAccumulator && part.inlineData.mimeType) mimeType = part.inlineData.mimeType; 
            audioAccumulator += part.inlineData.data; 
          }
          if (part.text) {
            if (currentPartType !== 'text') { 
              textPartsSeen++; 
              currentPartType = 'text'; 
            }
            if (textPartsSeen === 1) {
              textAccumulator += part.text;
              const { lyrics, metadata } = parseModelOutput(textAccumulator);
              updateResult(newId, r => ({ ...r, lyrics, metadata }));
              if (!auxTriggered && textAccumulator.length > 50) { auxTriggered = true; handleGenerateSongTitle(newId, activePrompt, textAccumulator).then(t => handleGenerateCoverArt(newId, activePrompt, textAccumulator, t)); }
            }
          }
        }
      }
      console.log('[Raw Generated Lyrics]', textAccumulator);
      if (audioAccumulator) { updateResult(newId, r => ({ ...r, status: 'completed', audioUrl: createAudioUrlFromBase64(audioAccumulator, mimeType) })); addLog(newId, "Signal stabilized."); }
      else throw new Error("Zero audio bits captured.");
    } catch (err: any) { updateResult(newId, r => ({ ...r, status: 'error', error: err.message || "Synthesis interrupted." })); }
  };

  const handleDownload = (result: SongResult) => {
    if (!result.audioUrl) return;
    const link = document.createElement('a'); link.href = result.audioUrl; link.download = `${result.title || 'Xennials'}.wav`; link.click();
  };

  const onDownloadVideo = async (result: SongResult, withLyrics: boolean = false) => {
    if (!result.audioUrl || !result.coverImageUrl || encodingVideoId) return;
    setEncodingVideoId(result.id);
    setEncodingProgress(0);

    await handleDownloadVideo(
      result,
      withLyrics,
      (progress) => setEncodingProgress(progress),
      () => {
        setEncodingVideoId(null);
        setEncodingProgress(0);
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleGenerate(); };

  return (
    <div className="min-h-screen flex flex-col pb-20 overflow-x-hidden bg-[#fbfbfd] text-[#1d1d1f] dark:bg-[#07070c] dark:text-[#f8fafc]" onClick={() => setActiveSelector(null)}>
      <nav className="sticky top-0 z-50 glass border-b border-gray-200/50 dark:border-zinc-800/50 h-14 flex items-center px-6 justify-between">
        <div className="flex items-center gap-2">
          <XennialsLogo showText={true} textSize="text-sm font-black" className="w-7 h-7" />
        </div>
        
        {/* Workspace views select tags */}
        <div className="flex bg-gray-100/65 dark:bg-zinc-900/65 p-0.5 rounded-xl border border-gray-200/50 dark:border-zinc-800/50 scale-95 md:scale-100">
          <button
            onClick={() => setActiveTab('composer')}
            className={`px-4.5 py-1.5 rounded-lg text-xs font-extrabold tracking-wide transition-all duration-300 ${
              activeTab === 'composer' ? 'bg-white dark:bg-zinc-800 shadow-md text-black dark:text-white scale-[1.02]' : 'text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-white'
            }`}
          >
            Composer Studio
          </button>
          <button
            id="xennials-workspace-trigger"
            onClick={() => setActiveTab('kdenlive')}
            className={`px-4.5 py-1.5 rounded-lg text-xs font-black tracking-widest uppercase transition-all duration-300 flex items-center gap-1.5 border ${
              activeTab === 'kdenlive' 
                ? 'bg-gradient-to-r from-cyan-500 via-emerald-500 to-orange-500 text-white shadow-lg shadow-cyan-500/25 border-cyan-400/20 scale-[1.04]' 
                : 'text-gray-500 dark:text-zinc-400 border-transparent hover:text-cyan-400 dark:hover:text-cyan-400 hover:bg-cyan-500/5 hover:border-cyan-500/10'
            }`}
          >
            <span className={`w-2 h-2 rounded-full animate-pulse ${activeTab === 'kdenlive' ? 'bg-white' : 'bg-cyan-400'}`}></span>
            Xennials DAW Workspace
          </button>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="px-3 py-1 bg-gray-100 dark:bg-zinc-800 rounded-full text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-widest border border-gray-200 dark:border-zinc-700 hidden md:block">xennials 3 preview</div>
          
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 transition-colors"
            title="Toggle Light/Dark Theme"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-cyan-600" />}
          </button>

          <button 
            onClick={handleSelectKey} 
            className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest hover:underline"
          >
            api key
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 pt-12">
        {activeTab === 'kdenlive' ? (
          <div>
            <section className="text-center mb-6 space-y-2">
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-gray-900 leading-tight">Post-Production DAW</h1>
              <p className="text-sm text-gray-500 max-w-2xl mx-auto font-light leading-relaxed">Edit your generated tracks, overlays, synth chords, and timelines in Xennials.</p>
            </section>
            
            <KdenliveEditor 
              results={gen.results} 
              activeImportedSong={kdenliveImportTarget} 
              onAddLog={(id, msg) => addLog(id, msg)}
              onClearActiveImport={() => setKdenliveImportTarget(null)} 
            />
          </div>
        ) : (
          <>
            <section className="text-center mb-16 space-y-4">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900 leading-tight">Create your sound</h1>
              <p className="text-lg text-gray-500 max-w-2xl mx-auto font-light leading-relaxed">Synthesis of professional music from narrative engineering.</p>
            </section>

        <section className="bg-zinc-950 rounded-[40px] p-8 md:p-12 border border-zinc-800 mb-12 relative z-10 text-white shadow-2xl">
          <div className="space-y-8">
            <div className="space-y-3">
              <div className="flex justify-between items-end mb-1">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 ml-1">Track Directives (Ctrl + Enter to send)</label>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsHelperOpen(!isHelperOpen); }}
                    className={`text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors ${isHelperOpen ? 'text-purple-400' : 'text-purple-400 hover:text-purple-300'}`}
                  >
                    <Icons.Sparkles className="w-3.5 h-3.5" />
                    {isHelperOpen ? 'Free Text' : 'Help me create'}
                  </button>
                </div>
              </div>
              
              <div className="relative group/prompt min-h-[160px]">
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" multiple className="hidden" />
                {isHelperOpen ? (
                  <PromptBuilder
                    isHelperOpen={isHelperOpen}
                    helperSections={helperSections}
                    setHelperSections={setHelperSections}
                    activeSelector={activeSelector}
                    setActiveSelector={setActiveSelector}
                    selectedImages={selectedImages}
                    onImageSelect={() => fileInputRef.current?.click()}
                    onImageRemove={removeImage}
                  />
                ) : (
                  <div className="relative">
                    <textarea
                      ref={promptTextareaRef}
                      value={prompt}
                      onChange={(e) => {
                        setPrompt(e.target.value);
                        setIsPromptManual(true);
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="Atmospheric cinematic track with heavy sub-bass..."
                      className="w-full min-h-[128px] bg-zinc-900 border border-zinc-800 rounded-3xl p-6 pb-20 text-xl font-light leading-relaxed resize-none text-white placeholder-zinc-500 focus:bg-zinc-900 focus:border-zinc-700 transition-all pr-16"
                      style={{ overflow: 'hidden' }}
                    />
                    <div className="absolute bottom-4 left-4 flex items-center gap-2">
                      {selectedImages.length < 10 && (
                        <button 
                          title="By using this feature, you confirm that you have the necessary rights to any content that you upload. Do not generate content that infringes on others’ intellectual property or privacy rights. Your use of this generative AI service is subject to our Prohibited Use Policy." 
                          onClick={() => fileInputRef.current?.click()} 
                          className={`transition-all shadow-sm border border-zinc-800 flex items-center justify-center ${selectedImages.length > 0 ? 'p-2.5 rounded-2xl bg-purple-600 text-white' : 'px-4 py-2.5 rounded-2xl bg-zinc-900 text-zinc-400 hover:text-white gap-2 text-sm font-medium'}`}
                        >
                          <Icons.Camera className="w-5 h-5" />
                          {selectedImages.length === 0 && <span>Add image references</span>}
                        </button>
                      )}
                      {selectedImages.length > 0 && (
                        <div className="flex gap-2">
                          {selectedImages.map((img, idx) => (
                            <div key={idx} className="relative w-12 h-12 rounded-xl overflow-hidden border-2 border-zinc-800 shadow-lg animate-in zoom-in duration-200">
                              <img src={img.previewUrl} className="w-full h-full object-cover" />
                              <button onClick={() => removeImage(idx)} className="absolute top-0 right-0 w-4 h-4 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur hover:bg-black"><Icons.X className="w-2.5 h-2.5" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-4 right-4">
                      <button 
                        title="I'm feeling lucky" 
                        onClick={handleFeelingLucky} 
                        className={`p-2.5 bg-zinc-900 shadow-sm border border-zinc-800 text-zinc-400 hover:text-purple-400 rounded-2xl transition-transform active:scale-90 ${isPromptManual && prompt.trim() !== '' ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                      >
                        <Icons.Sparkles className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 ml-1">Length</label>
                <div className="flex bg-zinc-900 p-1 rounded-2xl w-fit border border-zinc-850">
                  {(['Clip (30s)', 'Pro'] as Duration[]).map((opt) => (
                    <button key={opt} onClick={() => setDuration(opt)} className={`px-8 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${duration === opt ? 'bg-zinc-800 shadow-sm text-white' : 'text-zinc-400 hover:text-zinc-200'}`}>{opt}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 ml-1">Lyrics</label>
                <div className="flex bg-zinc-900 p-1 rounded-2xl w-fit border border-zinc-850">
                  {(['Auto', 'Custom', 'Instrumental'] as LyricsOption[]).map((opt) => (
                    <button key={opt} onClick={() => setLyricsOption(opt)} className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${lyricsOption === opt ? 'bg-zinc-800 shadow-sm text-white' : 'text-zinc-400 hover:text-zinc-200'}`}>{opt}</button>
                  ))}
                </div>
              </div>
            </div>

            {lyricsOption === 'Custom' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 ml-1">Custom Composition Lyrics</label>
                    {draftSavedAt && (
                      <span className="text-[10px] bg-emerald-950/25 border border-emerald-900/40 text-emerald-400 px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Saved {draftSavedAt}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                    {customLyrics.trim() && (
                      <button
                        type="button"
                        onClick={() => exportLyricsToPDF(prompt || 'Draft Composition', customLyrics)}
                        className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-purple-400 hover:text-purple-300 bg-purple-500/10 border border-purple-500/25 hover:border-purple-500/45 px-3 py-1.5 rounded-full hover:bg-purple-500/20 active:scale-95 transition-all cursor-pointer"
                        title="Export current lyrics to standard PDF"
                      >
                        <FileDown className="w-3.5 h-3.5 text-purple-400" />
                        <span>Export PDF</span>
                      </button>
                    )}
                    <span className="text-[10px] text-zinc-500 font-mono">Use brackets like [0:00 - 0:15] for timing</span>
                  </div>
                </div>
                
                <textarea
                  id="custom-lyrics-textarea"
                  value={customLyrics}
                  onChange={(e) => setCustomLyrics(e.target.value)}
                  placeholder={`[0:00 - 0:15] Hey this is your song\n[0:15 - ] You can write any lyrics you want`}
                  className="w-full min-h-[180px] bg-black border border-zinc-800 rounded-3xl p-6 text-lg font-light leading-relaxed resize-none text-white placeholder-zinc-600 focus:border-zinc-700 transition-all custom-scrollbar focus:ring-2 focus:ring-purple-500/30"
                />

                {/* Xennials Co-Lab Studio Hub */}
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="flex bg-zinc-950 p-1.5 rounded-2xl w-fit border border-zinc-850">
                    <button
                      type="button"
                      onClick={() => setColabTab('docs')}
                      className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        colabTab === 'docs'
                          ? 'bg-zinc-800 text-white shadow-sm border border-zinc-705/50'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      📝 Google Docs Suite
                    </button>
                    <button
                      type="button"
                      onClick={() => setColabTab('meet')}
                      className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        colabTab === 'meet'
                          ? 'bg-zinc-800 text-white shadow-sm border border-zinc-705/50'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      🎙️ Google Meet Rooms
                    </button>
                  </div>

                  {colabTab === 'docs' ? (
                    <GoogleDocsIntegration 
                      currentLyrics={customLyrics} 
                      onImportLyrics={setCustomLyrics} 
                      defaultTitle={prompt} 
                      onAuthChange={setGoogleToken} 
                    />
                  ) : (
                    <GoogleMeetIntegration 
                      defaultTitle={prompt} 
                      onAuthChange={setGoogleToken} 
                    />
                  )}
                </div>

                {/* Songwriting and Rhyme Assistant */}
                <div id="lyrics-assistant-panel" className="bg-zinc-900/40 border border-zinc-800/80 rounded-[24px] p-5 space-y-4 animate-in fade-in duration-300">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/40 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-purple-950/40 rounded-lg text-purple-400 border border-purple-900/30">
                        <Icons.Sparkles className="w-4 h-4 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="font-bold text-zinc-100 text-sm">Xennials Lyrist Assistant</h4>
                        <p className="text-[10px] text-zinc-500">Thematic prompts, rhymes, and analog stanzas</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-zinc-400 font-medium">Theme:</span>
                      <select 
                        id="assistant-theme-select"
                        value={lyricsTheme} 
                        onChange={(e) => setLyricsTheme(e.target.value)} 
                        className="bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/30 text-zinc-300 cursor-pointer shadow-sm hover:border-zinc-700"
                      >
                        {PROMPT_HELPER_CONFIG.themes.map((themeName) => (
                          <option key={themeName} value={themeName}>{themeName}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex bg-zinc-950 p-1 rounded-xl gap-1 text-xs border border-zinc-800/60">
                      <button 
                        id="assistant-tab-presets"
                        type="button"
                        onClick={() => setAssistantTab('presets')} 
                        className={`px-4 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${assistantTab === 'presets' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                      >
                        📖 Theme Starter Kit
                      </button>
                      <button 
                        id="assistant-tab-ai"
                        type="button"
                        onClick={() => setAssistantTab('ai')} 
                        className={`px-4 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${assistantTab === 'ai' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                      >
                        ⚡ AI Muse (Gemini)
                      </button>
                    </div>

                    <span className="text-[10px] text-purple-400 font-bold bg-purple-950/40 px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-purple-900/30">
                      {lyricsTheme}
                    </span>
                  </div>

                  {assistantTab === 'presets' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
                      {/* Starter stanzas */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Atmospheric Stanzas</span>
                          <span className="text-[9px] text-zinc-500">Click to insert at cursor</span>
                        </div>
                        <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                          {(THEMATIC_PHRASES[lyricsTheme] || []).map((phrase, idx) => (
                            <button 
                              key={idx}
                              id={`phrase-preset-${idx}`}
                              type="button"
                              onClick={() => insertTextAtCursor(phrase + '\n')}
                              className="w-full text-left bg-zinc-900 hover:bg-purple-950/20 border border-zinc-800 hover:border-purple-900/40 p-3 rounded-xl transition-all font-mono text-[11px] leading-relaxed text-zinc-300 hover:text-purple-200 group relative shadow-sm cursor-pointer"
                            >
                              <div className="whitespace-pre-wrap">{phrase}</div>
                              <div className="absolute right-2 bottom-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] text-purple-400 font-semibold bg-purple-950/40 px-1 rounded border border-purple-900/30">
                                + Insert
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Theme Rhymes */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Thematic Rhymes</span>
                          <span className="text-[9px] text-zinc-500">Click rhyme word to insert</span>
                        </div>
                        <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                          {(THEMATIC_RHYMES[lyricsTheme] || []).map((item, idx) => (
                            <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 space-y-1.5 shadow-sm">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-purple-400 font-mono bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-900/30">
                                  {item.word}
                                </span>
                                <span className="text-[9px] text-zinc-500">rhymes with:</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {item.rhymes.map((rhyme, rIdx) => (
                                  <button 
                                    key={rIdx}
                                    id={`rhyme-preset-${idx}-${rIdx}`}
                                    type="button"
                                    onClick={() => insertTextAtCursor(rhyme)}
                                    className="bg-zinc-950 hover:bg-purple-950/40 border border-zinc-800 hover:border-purple-900/40 text-[10px] text-zinc-400 hover:text-purple-200 px-2.5 py-1 rounded-lg transition-all active:scale-95 cursor-pointer"
                                  >
                                    {rhyme}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 animate-in fade-in duration-200">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                          <input 
                            id="assistant-rhyme-search-input"
                            type="text" 
                            placeholder="Enter a word or songwriter idea (e.g., tape, glow)..." 
                            value={rhymeSearch} 
                            onChange={(e) => setRhymeSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleFetchSuggestions('rhymes');
                              }
                            }}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/30 text-zinc-100 placeholder-zinc-500 shadow-sm"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button 
                            id="assistant-btn-get-rhymes"
                            type="button"
                            onClick={() => handleFetchSuggestions('rhymes')} 
                            disabled={isGeneratingSuggestions}
                            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 border border-zinc-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm cursor-pointer"
                          >
                            {isGeneratingSuggestions ? (
                              <Icons.Loading className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <span>🔍 Find Rhymes</span>
                            )}
                          </button>
                          <button 
                            id="assistant-btn-get-lines"
                            type="button"
                            onClick={() => handleFetchSuggestions('phrases')} 
                            disabled={isGeneratingSuggestions}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm cursor-pointer"
                          >
                            {isGeneratingSuggestions ? (
                              <Icons.Loading className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <span>✨ Write Lines</span>
                            )}
                          </button>
                        </div>
                      </div>

                      {suggestionError && (
                        <div className="bg-red-950/40 border border-red-900/50 text-red-400 text-[11px] p-2.5 rounded-xl font-medium animate-in shake">
                          ⚠️ {suggestionError}
                        </div>
                      )}

                      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 min-h-[100px] flex flex-col justify-center shadow-sm">
                        {isGeneratingSuggestions ? (
                          <div className="text-center py-6 space-y-2">
                            <Icons.Loading className="w-6 h-6 animate-spin mx-auto text-purple-400" />
                            <p className="text-[11px] text-zinc-500 font-mono">Asking Gemini for thematic retro suggestions...</p>
                          </div>
                        ) : aiSuggestions.length > 0 ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider font-mono">Gemini Suggestions:</span>
                              <span className="text-[9px] text-zinc-500">Click to insert</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {aiSuggestions.map((sug, idx) => (
                                <button 
                                  key={idx}
                                  id={`ai-suggestion-item-${idx}`}
                                  type="button"
                                  onClick={() => insertTextAtCursor(sug + (sug.includes('[') ? '\n' : ' '))}
                                  className="text-left bg-purple-950/10 hover:bg-purple-950/30 border border-purple-900/20 hover:border-purple-800/40 p-2.5 rounded-xl text-xs text-purple-200 font-medium transition-all group relative hover:scale-[1.01] cursor-pointer"
                                >
                                  <div className="font-mono text-[11px] line-clamp-2">{sug}</div>
                                  <span className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-[8px] text-purple-400 font-bold bg-zinc-950 px-1 rounded shadow-sm border border-purple-900/20">
                                    + Use
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6 text-zinc-500 space-y-1">
                            <Icons.Sparkles className="w-5 h-5 mx-auto text-zinc-600" />
                            <p className="text-xs">Type a word (like <span className="font-mono text-purple-400">"tapes"</span> or <span className="font-mono text-purple-400">"neon"</span>) and click <b>Find Rhymes</b> or <b>Write Lines</b> to let Gemini craft custom ideas!</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <button 
              onClick={() => handleGenerate()} 
              disabled={(!prompt.trim() && selectedImages.length === 0) || CONFIG.IS_MAINTENANCE_MODE} 
              className={`w-full py-5 rounded-3xl text-lg font-bold text-white transition-all shadow-xl cursor-pointer ${
                ((!prompt.trim() && selectedImages.length === 0) || CONFIG.IS_MAINTENANCE_MODE)
                  ? 'bg-zinc-800 cursor-not-allowed shadow-none text-zinc-500' 
                  : `music-gradient shadow-red-500/20 active:scale-[0.98] active:brightness-110 ${isTriggering ? 'scale-[0.98] brightness-125 ring-4 ring-pink-200' : ''}`
              }`}
            >
              Generate Song
            </button>
          </div>
        </section>

        {gen.results.length > 0 && (
          <div className="relative mb-12 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200/60"></div></div>
            <div className="relative bg-[#fbfbfd] px-6 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Songs Gallery</div>
          </div>
        )}

        <div className="space-y-6">
          {gen.results.map((result) => {
            const isExpanded = result.isExpanded;
            const isEncoding = encodingVideoId === result.id;
            const isGenerating = result.status === 'generating';
            const isFailed = result.status === 'error';
            
            return (
              <div key={result.id} className="group relative transition-all duration-700 ease-in-out transform">
                
                {/* Visual indicator for Kdenlive quick loading shortcut */}
                {result.status === 'completed' && (
                  <div className="absolute -top-3.5 right-6 z-20">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setKdenliveImportTarget(result);
                        setActiveTab('kdenlive');
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-3.5 py-1.5 text-[9px] font-extrabold uppercase tracking-wider shadow-lg flex items-center gap-1.5 transition-transform hover:scale-105 active:scale-95"
                    >
                      <Icons.Video className="w-3.5 h-3.5" />
                      <span>Open in Xennials DAW</span>
                    </button>
                  </div>
                )}

                <div className={`relative transition-all duration-700 ease-in-out border border-gray-200/60 shadow-lg rounded-[40px] ${isExpanded ? 'p-8 pb-12' : 'p-4'}`}>
                  <div className="absolute inset-0 z-0 rounded-[40px] overflow-hidden" style={{ backgroundImage: result.coverImageUrl ? `url(${result.coverImageUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}>
                    <div className={`absolute inset-0 transition-opacity duration-700 ease-in-out backdrop-blur-2xl ${isExpanded ? 'bg-white/75 opacity-100' : 'bg-white/85 opacity-100'}`} />
                  </div>

                  <div className={`relative z-[30] flex transition-all duration-700 ease-in-out gap-6 items-center ${isExpanded ? 'flex-col md:flex-row mb-8' : 'flex-row'}`} onClick={() => !isExpanded && toggleExpand(result.id)} style={{ cursor: isExpanded ? 'default' : 'pointer' }}>
                    <div className={`relative shrink-0 transition-all duration-700 ease-in-out rounded-3xl overflow-hidden shadow-2xl ${isExpanded ? 'w-48 h-48 md:w-56 md:h-56' : 'w-16 h-16'}`}>
                      {result.coverImageUrl ? <img src={result.coverImageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-gray-100/50"><Icons.Sparkles className={`text-blue-300 ${isExpanded ? 'w-12 h-12 animate-pulse' : 'w-5 h-5'}`} /></div>}
                      {isEncoding && <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center"><Icons.Loading className={`${isExpanded ? 'w-12 h-12' : 'w-6 h-6'} text-blue-600 animate-spin`} /></div>}
                      <button onClick={(e) => { e.stopPropagation(); if (isGenerating) return; const audio = document.getElementById(`audio-${result.id}`) as HTMLAudioElement; if (audio) { if (audio.paused) { audio.play().catch(err => console.warn('[App] play error:', err)); } else { audio.pause(); } } }} disabled={(!result.audioUrl && !isGenerating) || isEncoding} className={`absolute inset-0 flex items-center justify-center text-white z-10 transition-opacity duration-300 ${isExpanded || isGenerating ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${isEncoding ? 'cursor-wait' : 'cursor-pointer'}`}>
                        <div className={`music-gradient backdrop-blur-xl rounded-full flex items-center justify-center border border-white/40 shadow-2xl hover:scale-110 transition-transform ${isExpanded ? 'w-16 h-16' : 'w-10 h-10'}`}>
                          {isGenerating ? <Icons.Loading className={`${isExpanded ? 'w-8 h-8' : 'w-5 h-5'} animate-spin`} /> : isResultPlaying === result.id ? <Icons.Pause className={isExpanded ? 'w-8 h-8' : 'w-5 h-5'} /> : <Icons.Play className={`${isExpanded ? 'w-8 h-8' : 'w-5 h-5'} ml-1`} />}
                        </div>
                      </button>
                    </div>

                    <div className={`flex-1 min-w-0 transition-all duration-700 ease-in-out ${isExpanded ? 'text-center md:text-left' : ''}`}>
                      <div className="space-y-1 relative">
                        <div className={`flex items-center gap-4 ${isExpanded ? 'justify-center md:justify-start flex-wrap' : ''}`}>
                          <h4 className={`font-extrabold text-blue-900 tracking-tight transition-all duration-700 ease-in-out truncate ${isExpanded ? 'text-3xl md:text-4xl' : 'text-lg'}`}>
                            {isFailed ? 'Processing Failed' : (result.title || (isGenerating ? "Synthesizing..." : "Untitled Composition"))}
                          </h4>
                          {(isFailed || result.audioUrl) && (
                            <div className="relative" onClick={e => e.stopPropagation()}>
                              <button onClick={() => handleGenerate({ prompt: result.originalPrompt, duration: result.originalDuration, lyricsOption: result.originalLyricsOption })} className="flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-blue-100 border border-blue-200 text-blue-600 text-[10px] font-bold uppercase tracking-[0.1em] hover:bg-blue-200 transition-all shadow-sm active:scale-95 z-20">
                                <Icons.RefreshCw className="w-3.5 h-3.5 shrink-0" />
                                <span>{isFailed ? 'Retry' : 'Regenerate'}</span>
                              </button>
                            </div>
                          )}
                        </div>
                        <div className={`flex items-center gap-2 text-[10px] font-bold text-blue-500 uppercase tracking-widest transition-all duration-700 ease-in-out ${isExpanded ? 'justify-center md:justify-start' : ''}`}>
                          <span className="px-2 py-0.5 bg-blue-500 text-white rounded">XENNIALS 3.0</span>
                          <span>• {result.duration}</span>
                        </div>
                      </div>

                      <div className={`transition-all duration-700 ease-in-out overflow-visible ${isExpanded ? 'max-h-[200px] mt-6 opacity-100' : 'max-h-0 opacity-0'}`}>
                        {result.audioUrl && (
                          <div className="space-y-4">
                            <audio id={`audio-${result.id}`} onPlay={() => setIsResultPlaying(result.id)} onPause={() => setIsResultPlaying(null)} controls className="h-10 w-full rounded-2xl"><source src={result.audioUrl} /></audio>
                            <div className="flex gap-4 items-start relative">
                              <div className="flex-1 relative group/download" onClick={e => e.stopPropagation()}>
                                <button onClick={(e) => { e.stopPropagation(); handleDownload(result); }} className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600 text-white text-[10px] font-bold uppercase tracking-[0.1em] hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95 ${isEncoding ? 'opacity-50 cursor-wait' : ''}`} disabled={isEncoding}>
                                  {isEncoding ? <Icons.Loading className="w-4 h-4 animate-spin" /> : <Icons.Download className="w-4 h-4" />}
                                  {isEncoding ? `Processing ${Math.round(encodingProgress)}%` : 'Download'}
                                </button>
                                {!isEncoding && (
                                  <div className="absolute top-full left-0 right-0 pt-2 opacity-0 translate-y-2 pointer-events-none group-hover/download:opacity-100 group-hover/download:translate-y-0 group-hover/download:pointer-events-auto transition-all duration-300 z-[60]">
                                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                                      <button onClick={(e) => { e.stopPropagation(); handleDownload(result); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
                                        <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center"><Icons.Download className="w-4 h-4" /></div>
                                        <div><div className="text-[10px] font-bold uppercase tracking-wider text-gray-900">Track</div><div className="text-[9px] text-gray-400">High fidelity master</div></div>
                                      </button>
                                      <button onClick={(e) => { e.stopPropagation(); onDownloadVideo(result, false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 border-t border-gray-50 transition-colors">
                                        <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center"><Icons.Video className="w-4 h-4" /></div>
                                        <div><div className="text-[10px] font-bold uppercase tracking-wider text-gray-900">Video</div><div className="text-[9px] text-gray-400">Reactive visual map</div></div>
                                      </button>
                                      <button onClick={(e) => { e.stopPropagation(); onDownloadVideo(result, true); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 border-t border-gray-50 transition-colors">
                                        <div className="w-8 h-8 bg-pink-50 text-pink-600 rounded-lg flex items-center justify-center"><Icons.Sparkles className="w-4 h-4" /></div>
                                        <div><div className="text-[10px] font-bold uppercase tracking-wider text-gray-900">Karaoke</div><div className="text-[9px] text-gray-400">Timed sync engine</div></div>
                                      </button>
                                      
                                      <button 
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          setKdenliveImportTarget(result); 
                                          setActiveTab('kdenlive'); 
                                        }} 
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-emerald-50 border-t border-gray-50 transition-colors group"
                                      >
                                        <div className="w-8 h-8 bg-emerald-500/10 text-emerald-600 rounded-lg flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                          <Icons.Video className="w-4 h-4 text-emerald-600 group-hover:text-white" />
                                        </div>
                                        <div>
                                          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">Edit in Xennials</div>
                                          <div className="text-[9px] text-emerald-600 font-medium">Open in Multi-track DAW workspace</div>
                                        </div>
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        {!result.audioUrl && isGenerating && <div className="h-1 w-full bg-blue-100 rounded-full overflow-hidden mt-6"><div className="h-full bg-blue-500 animate-[loading_2s_infinite]"></div></div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4"><button onClick={(e) => { e.stopPropagation(); toggleExpand(result.id); }} className={`p-2 rounded-full transition-all duration-500 ${isExpanded ? 'bg-blue-100 text-blue-600 rotate-90' : 'text-gray-400 group-hover:text-blue-500'}`}><Icons.ChevronRight className="w-6 h-6" /></button></div>
                  </div>

                  <div className={`relative z-10 grid transition-all duration-700 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      {/* Generation Directive Box */}
                      {(result.fullPrompt || result.originalPrompt) && (
                        <div className="mb-6 space-y-3">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Generation Directive</label>
                          <div className="bg-gray-50/80 border border-gray-100 rounded-[24px] p-6 text-xs font-mono text-gray-600 whitespace-pre-wrap shadow-inner overflow-x-auto custom-scrollbar">
                            {result.fullPrompt || result.originalPrompt}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 pb-2">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between ml-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Composition Lyrics</label>
                            {result.lyrics && result.status === 'completed' && (
                              <div onClick={e => e.stopPropagation()} className="relative shrink-0 flex items-center gap-2">
                                <button
                                  onClick={() => exportLyricsToPDF(result.title || 'Untitled', result.lyrics)}
                                  className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-purple-600 hover:text-purple-700 bg-purple-500/10 border border-purple-200 hover:border-purple-300 px-3 py-1.5 rounded-full shadow-sm transition-all active:scale-[0.97] cursor-pointer"
                                  title="Export this song's lyrics to a formatted PDF"
                                >
                                  <FileDown className="w-3.5 h-3.5 text-purple-600" />
                                  <span>Export PDF</span>
                                </button>

                                {exportingSongIds[result.id]?.url ? (
                                  <a
                                    href={exportingSongIds[result.id].url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-500/10 border border-emerald-200 px-3 py-1.5 rounded-full shadow-sm transition-colors cursor-pointer"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    <span>Open Doc</span>
                                  </a>
                                ) : (
                                  <button
                                    onClick={() => handleExportSongLyrics(result.id, result.title || 'Untitled', result.lyrics)}
                                    disabled={exportingSongIds[result.id]?.loading}
                                    className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-blue-600 hover:text-blue-700 bg-blue-500/10 border border-blue-200 hover:border-blue-300 px-3 py-1.5 rounded-full shadow-sm transition-all active:scale-[0.97] cursor-pointer"
                                  >
                                    {exportingSongIds[result.id]?.loading ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                        <line x1="16" y1="13" x2="8" y2="13" />
                                        <line x1="16" y1="17" x2="8" y2="17" />
                                        <polyline points="10 9 9 9 8 9" />
                                      </svg>
                                    )}
                                    <span>{exportingSongIds[result.id]?.loading ? 'Exporting...' : 'Export to Docs'}</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="bg-white/40 border border-white/50 backdrop-blur-md rounded-[32px] p-8 h-[240px] overflow-y-auto text-base text-gray-800 italic whitespace-pre-wrap font-serif shadow-inner custom-scrollbar">{result.lyrics ? cleanLyricsForDisplay(result.lyrics) : (isGenerating ? "Synthesizing narrative..." : "Instrumental")}</div>
                          {exportingSongIds[result.id]?.error && (
                            <p className="text-[10px] font-mono text-red-500 mt-1 ml-1 animate-in shake">
                              ⚠️ {exportingSongIds[result.id].error}
                            </p>
                          )}
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">System Console</label>
                          <div ref={el => { consoleRefs.current[result.id] = el; }} className="bg-[#1c1c1e] rounded-[32px] p-8 h-[240px] overflow-y-auto font-mono text-[11px] text-[#32d74b] space-y-1 shadow-2xl border border-gray-800/50 custom-scrollbar">{result.logs.map((log, i) => <div key={i} className="opacity-80 leading-relaxed">{log}</div>)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
          </>
        )}
      </main>
      <style>{`
        @keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
      `}</style>
      <HealthDashboard metrics={healthMetrics} />
      <AudioUnlockModal />
    </div>
  );
};

const AppWithBoundary: React.FC = () => {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
};

export default AppWithBoundary;