import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

export type SiteState = 'safe' | 'scanning' | 'exposed' | 'remediated';

export const STATE_ACCENT_MAP: Record<SiteState, [number, number, number]> = {
  safe: [109, 190, 48],       // #6DBE30
  scanning: [255, 176, 32],   // #FFB020
  exposed: [255, 59, 78],     // #FF3B4E
  remediated: [109, 190, 48], // #6DBE30
};

export interface ThemeStateContextType {
  state: SiteState;
  setState: (s: SiteState) => void;
  exposureScore: number; // 0-100, drives animation intensity
  setExposureScore: (n: number) => void;
  accent: string; // resolved accent hex for current state/interpolated intermediate
  accentRgb: [number, number, number]; // intermediate RGB array for canvas
  reducedMotion: boolean;
}

const ThemeStateContext = createContext<ThemeStateContextType | undefined>(undefined);

function rgbToHex(r: number, g: number, b: number): string {
  const clampR = Math.max(0, Math.min(255, Math.round(r)));
  const clampG = Math.max(0, Math.min(255, Math.round(g)));
  const clampB = Math.max(0, Math.min(255, Math.round(b)));
  return '#' + [clampR, clampG, clampB].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export const ThemeStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setStateInternal] = useState<SiteState>('safe');
  const [exposureScore, setExposureScore] = useState<number>(0);
  const [currentRgb, setCurrentRgb] = useState<[number, number, number]>(STATE_ACCENT_MAP.safe);

  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const startRgbRef = useRef<[number, number, number]>(STATE_ACCENT_MAP.safe);
  const targetRgbRef = useRef<[number, number, number]>(STATE_ACCENT_MAP.safe);
  const animStartTimeRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const setState = useCallback((newState: SiteState) => {
    setStateInternal(newState);
    // Set default exposure scores per state
    if (newState === 'safe') setExposureScore(0);
    else if (newState === 'scanning') setExposureScore(40);
    else if (newState === 'exposed') setExposureScore(100);
    else if (newState === 'remediated') setExposureScore(0);
  }, []);

  // Handle 600ms RGB color interpolation on state change
  useEffect(() => {
    const target = STATE_ACCENT_MAP[state];
    startRgbRef.current = currentRgb;
    targetRgbRef.current = target;
    animStartTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - animStartTimeRef.current;
      const progress = Math.min(1, elapsed / 600); // 600ms transition
      // Easing curve (easeOutCubic)
      const ease = 1 - Math.pow(1 - progress, 3);

      const r = startRgbRef.current[0] + (targetRgbRef.current[0] - startRgbRef.current[0]) * ease;
      const g = startRgbRef.current[1] + (targetRgbRef.current[1] - startRgbRef.current[1]) * ease;
      const b = startRgbRef.current[2] + (targetRgbRef.current[2] - startRgbRef.current[2]) * ease;

      setCurrentRgb([r, g, b]);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [state]);

  const accent = rgbToHex(currentRgb[0], currentRgb[1], currentRgb[2]);

  return (
    <ThemeStateContext.Provider
      value={{
        state,
        setState,
        exposureScore,
        setExposureScore,
        accent,
        accentRgb: currentRgb,
        reducedMotion,
      }}
    >
      {children}
    </ThemeStateContext.Provider>
  );
};

export const useThemeState = (): ThemeStateContextType => {
  const context = useContext(ThemeStateContext);
  if (!context) {
    throw new Error('useThemeState must be used within a ThemeStateProvider');
  }
  return context;
};
