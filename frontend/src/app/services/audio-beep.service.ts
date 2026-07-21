import { Injectable } from '@angular/core';

/** Generates short beep tones for the lift timer via the Web Audio API - no audio assets needed. */
@Injectable({
  providedIn: 'root',
})
export class AudioBeepService {
  private audioContext: AudioContext | null = null;

  /**
   * Creates (or resumes) the audio context. Browsers block audio until a user
   * gesture occurs, so this must be called from within a click handler.
   */
  unlock(): void {
    const ctx = this.getContext();

    if (ctx?.state === 'suspended') {
      void ctx.resume();
    }
  }

  playShortBeep(): void {
    this.playTone(880, 150);
  }

  playLongBeep(): void {
    this.playTone(440, 800);
  }

  private playTone(frequencyHz: number, durationMs: number): void {
    const ctx = this.getContext();

    if (!ctx) return;

    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = frequencyHz;
    gain.gain.value = 0.3;

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + durationMs / 1000);
  }

  private getContext(): AudioContext | null {
    if (this.audioContext) return this.audioContext;

    const AudioContextCtor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) return null;

    try {
      this.audioContext = new AudioContextCtor();

      return this.audioContext;
    } catch {
      return null;
    }
  }
}
