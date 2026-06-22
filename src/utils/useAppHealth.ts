import { useState, useEffect, useRef } from 'react';

export interface HealthMetrics {
  fps: number;
  audioState: 'running' | 'suspended' | 'closed' | 'unavailable';
  avgRenderTimeMs: number;
  lastTickMs: number;
  warnings: string[];
}

export const useAppHealth = (audioContext?: AudioContext | null) => {
  const [metrics, setMetrics] = useState<HealthMetrics>({
    fps: 60,
    audioState: 'unavailable',
    avgRenderTimeMs: 0,
    lastTickMs: 0,
    warnings: [],
  });

  const frameTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(performance.now());
  const renderStartTimeRef = useRef<number>(performance.now());
  const renderTimesRef = useRef<number[]>([]);

  // Track component render time bounds
  renderStartTimeRef.current = performance.now();

  useEffect(() => {
    // Calculate component render times
    const duration = performance.now() - renderStartTimeRef.current;
    if (renderTimesRef.current.length > 50) {
      renderTimesRef.current.shift();
    }
    renderTimesRef.current.push(duration);
  });

  useEffect(() => {
    let animationFrameId: number;
    let isMounted = true;

    const measurePerf = () => {
      const now = performance.now();
      frameCountRef.current += 1;

      // Update FPS metrics every second
      if (now - lastFpsUpdateRef.current >= 1000) {
        const calculatedFps = Math.round((frameCountRef.current * 1000) / (now - lastFpsUpdateRef.current));
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = now;

        // Determine current Web Audio safety parameters
        let resolvedAudioState: HealthMetrics['audioState'] = 'unavailable';
        if (audioContext) {
          resolvedAudioState = audioContext.state as HealthMetrics['audioState'];
        } else if ((window as any).AudioContext || (window as any).webkitAudioContext) {
          // Check if there is any active context on the window or running engines
          resolvedAudioState = 'suspended';
        }

        // Aggregate health warnings based on active metrics
        const liveWarnings: string[] = [];
        if (calculatedFps < 30) {
          liveWarnings.push('CPU Throttling detected: Frame rate dropped below optimal 30 FPS boundary.');
        }
        if (resolvedAudioState === 'suspended') {
          liveWarnings.push('Autoplay Prevention active: Web Audio is suspended. Click "Unmute Engine" to restore sound.');
        }

        // Calculate Average Render Latency from tracked render intervals
        const totalRender = renderTimesRef.current.reduce((acc, current) => acc + current, 0);
        const avgRender = renderTimesRef.current.length > 0 
          ? Number((totalRender / renderTimesRef.current.length).toFixed(2)) 
          : 0;

        if (avgRender > 16.6) {
          liveWarnings.push(`Heavy rendering overhead: Average React commit time (${avgRender}ms) exceeds 1 frame interval (16.6ms).`);
        }

        if (isMounted) {
          setMetrics({
            fps: calculatedFps,
            audioState: resolvedAudioState,
            avgRenderTimeMs: avgRender,
            lastTickMs: Number((now - frameTimeRef.current).toFixed(1)),
            warnings: liveWarnings,
          });
        }
      }

      frameTimeRef.current = now;
      if (isMounted) {
        animationFrameId = requestAnimationFrame(measurePerf);
      }
    };

    animationFrameId = requestAnimationFrame(measurePerf);

    return () => {
      isMounted = false;
      cancelAnimationFrame(animationFrameId);
    };
  }, [audioContext]);

  return metrics;
};
