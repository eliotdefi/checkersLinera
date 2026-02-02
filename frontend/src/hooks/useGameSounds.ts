"use client";

import { useCallback, useEffect, useState } from 'react';
import { gameSounds, SoundType } from '@/utils/sounds';

interface UseGameSoundsReturn {
  playSound: (type: SoundType) => void;
  toggleSound: () => void;
  setVolume: (volume: number) => void;
  isSoundEnabled: boolean;
  volume: number;
}

export function useGameSounds(): UseGameSoundsReturn {
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [volume, setVolumeState] = useState(0.5);

  // Initialize sound settings from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedEnabled = localStorage.getItem('checkers-sound-enabled');
      const savedVolume = localStorage.getItem('checkers-sound-volume');

      if (savedEnabled !== null) {
        const enabled = savedEnabled === 'true';
        setIsSoundEnabled(enabled);
        gameSounds.setEnabled(enabled);
      }

      if (savedVolume !== null) {
        const vol = parseFloat(savedVolume);
        setVolumeState(vol);
        gameSounds.setVolume(vol);
      }
    }
  }, []);

  const playSound = useCallback((type: SoundType) => {
    gameSounds.play(type);
  }, []);

  const toggleSound = useCallback(() => {
    const newEnabled = !isSoundEnabled;
    setIsSoundEnabled(newEnabled);
    gameSounds.setEnabled(newEnabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('checkers-sound-enabled', String(newEnabled));
    }
  }, [isSoundEnabled]);

  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(newVolume);
    gameSounds.setVolume(newVolume);
    if (typeof window !== 'undefined') {
      localStorage.setItem('checkers-sound-volume', String(newVolume));
    }
  }, []);

  return {
    playSound,
    toggleSound,
    setVolume,
    isSoundEnabled,
    volume,
  };
}
