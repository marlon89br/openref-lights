import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimerState, TimerStatus } from '../../models/lift.model';
import { AudioBeepService } from '../../services/audio-beep.service';

/** How often the displayed countdown refreshes while the timer is running. */
const TICK_MS = 200;

/** Remaining-seconds mark for the early warning beep. */
const WARNING_BEEP_SECONDS = 30;

/** Remaining-seconds mark at which a short beep sounds every second, counting down to expiry. */
const FINAL_COUNTDOWN_SECONDS = 10;

/**
 * Reusable countdown display for the 1-minute lift timer.
 * Reads a server-authoritative end timestamp and ticks locally so the
 * jury view and public display stay in sync without extra socket traffic.
 */
@Component({
  selector: 'app-lift-timer',
  imports: [CommonModule],
  templateUrl: './lift-timer.html',
  styleUrl: './lift-timer.css',
})
export class LiftTimerComponent {
  timer = input<TimerState | undefined>(undefined);

  private audioBeep = inject(AudioBeepService);
  private now = signal(Date.now());

  /** Remaining-seconds value at which a beep last sounded, to avoid re-triggering every tick. */
  private lastBeepMarker: number | null = null;

  isRunning = computed(() => this.timer()?.status === TimerStatus.RUNNING);

  private remainingMs = computed(() => {
    const timer = this.timer();

    if (!timer) return 0;

    if (timer.status === TimerStatus.RUNNING && timer.endsAt) {
      return Math.max(0, timer.endsAt - this.now());
    }

    return timer.durationMs;
  });

  private remainingSeconds = computed(() => Math.ceil(this.remainingMs() / 1000));

  isExpired = computed(() => this.isRunning() && this.remainingMs() <= 0);

  displayTime = computed(() => {
    const totalSeconds = this.remainingSeconds();
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  });

  constructor() {
    effect((onCleanup) => {
      if (!this.isRunning()) return;

      const intervalId = setInterval(() => this.now.set(Date.now()), TICK_MS);

      onCleanup(() => clearInterval(intervalId));
    });

    effect(() => {
      if (!this.isRunning()) {
        this.lastBeepMarker = null;

        return;
      }

      if (this.isExpired()) {
        if (this.lastBeepMarker !== 0) {
          this.lastBeepMarker = 0;
          this.audioBeep.playLongBeep();
        }

        return;
      }

      const seconds = this.remainingSeconds();
      const shouldBeep = seconds === WARNING_BEEP_SECONDS || (seconds <= FINAL_COUNTDOWN_SECONDS && seconds >= 1);

      if (shouldBeep && this.lastBeepMarker !== seconds) {
        this.lastBeepMarker = seconds;
        this.audioBeep.playShortBeep();
      }
    });
  }
}
