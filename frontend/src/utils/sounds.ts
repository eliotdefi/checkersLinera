// Web Audio API Sound Generator for Checkers Game
// Generates all game sounds programmatically - no external files needed

type SoundType =
  | 'move'
  | 'capture'
  | 'king'
  | 'yourTurn'
  | 'win'
  | 'lose'
  | 'invalid'
  | 'select';

class GameSoundManager {
  private audioContext: AudioContext | null = null;
  private enabled: boolean = true;
  private volume: number = 0.5;

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    // Resume if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getVolume(): number {
    return this.volume;
  }

  // Play a specific sound type
  play(type: SoundType) {
    if (!this.enabled) return;

    try {
      switch (type) {
        case 'move':
          this.playMoveSound();
          break;
        case 'capture':
          this.playCaptureSound();
          break;
        case 'king':
          this.playKingSound();
          break;
        case 'yourTurn':
          this.playYourTurnSound();
          break;
        case 'win':
          this.playWinSound();
          break;
        case 'lose':
          this.playLoseSound();
          break;
        case 'invalid':
          this.playInvalidSound();
          break;
        case 'select':
          this.playSelectSound();
          break;
      }
    } catch (error) {
      console.warn('Sound playback failed:', error);
    }
  }

  // Wooden piece placement sound - professional chess/checkers style
  private playMoveSound() {
    const ctx = this.getAudioContext();

    // Create noise buffer for wooden "thock" sound
    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.08));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Low-pass filter for wooden tone
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);
    filter.Q.value = 1.5;

    // High-pass to remove rumble
    const hipass = ctx.createBiquadFilter();
    hipass.type = 'highpass';
    hipass.frequency.value = 80;

    // Gain envelope
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(this.volume * 0.8, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

    noise.connect(filter);
    filter.connect(hipass);
    hipass.connect(gainNode);
    gainNode.connect(ctx.destination);

    noise.start(ctx.currentTime);
  }

  // Satisfying thud/pop for capturing a piece
  private playCaptureSound() {
    const ctx = this.getAudioContext();

    // Low thud
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.frequency.setValueAtTime(150, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.15);
    osc1.type = 'sine';
    gain1.gain.setValueAtTime(this.volume * 0.5, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.15);

    // Pop overlay
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.setValueAtTime(600, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.08);
    osc2.type = 'triangle';
    gain2.gain.setValueAtTime(this.volume * 0.4, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 0.08);
  }

  // Triumphant chime for king promotion
  private playKingSound() {
    const ctx = this.getAudioContext();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (major chord arpeggio)

    notes.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
      oscillator.type = 'sine';

      const startTime = ctx.currentTime + i * 0.08;
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

      oscillator.start(startTime);
      oscillator.stop(startTime + 0.3);
    });
  }

  // Gentle notification for "your turn"
  private playYourTurnSound() {
    const ctx = this.getAudioContext();
    const notes = [440, 554.37]; // A4, C#5 (pleasant interval)

    notes.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
      oscillator.type = 'sine';

      const startTime = ctx.currentTime + i * 0.1;
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.2, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

      oscillator.start(startTime);
      oscillator.stop(startTime + 0.2);
    });
  }

  // Victory fanfare
  private playWinSound() {
    const ctx = this.getAudioContext();
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C major scale up

    notes.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
      oscillator.type = i === notes.length - 1 ? 'sine' : 'triangle';

      const startTime = ctx.currentTime + i * 0.12;
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.35, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + (i === notes.length - 1 ? 0.6 : 0.25));

      oscillator.start(startTime);
      oscillator.stop(startTime + 0.6);
    });
  }

  // Defeat sound (descending)
  private playLoseSound() {
    const ctx = this.getAudioContext();
    const notes = [392, 349.23, 329.63, 293.66]; // G4, F4, E4, D4 (descending)

    notes.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
      oscillator.type = 'sine';

      const startTime = ctx.currentTime + i * 0.15;
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.25, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

      oscillator.start(startTime);
      oscillator.stop(startTime + 0.3);
    });
  }

  // Error buzz for invalid move
  private playInvalidSound() {
    const ctx = this.getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.setValueAtTime(150, ctx.currentTime);
    oscillator.type = 'sawtooth';

    gainNode.gain.setValueAtTime(this.volume * 0.2, ctx.currentTime);
    gainNode.gain.setValueAtTime(this.volume * 0.2, ctx.currentTime + 0.05);
    gainNode.gain.setValueAtTime(0, ctx.currentTime + 0.06);
    gainNode.gain.setValueAtTime(this.volume * 0.2, ctx.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.15);
  }

  // Light wooden tap for piece selection - like picking up a piece
  private playSelectSound() {
    const ctx = this.getAudioContext();

    // Create short noise burst for light tap
    const bufferSize = ctx.sampleRate * 0.03;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.05));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Band-pass filter for lighter, higher "click"
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 1.2;

    // Gain envelope - quieter than move sound
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(this.volume * 0.35, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.03);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    noise.start(ctx.currentTime);
  }
}

// Singleton instance
export const gameSounds = new GameSoundManager();

// Export types
export type { SoundType };
