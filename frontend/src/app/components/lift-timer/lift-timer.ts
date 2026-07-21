import { Component, computed, effect, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimerState, TimerStatus } from '../../models/lift.model';

/** How often the displayed countdown refreshes while the timer is running. */
const TICK_MS = 200;

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

  private now = signal(Date.now());

  isRunning = computed(() => this.timer()?.status === TimerStatus.RUNNING);

  private remainingMs = computed(() => {
    const timer = this.timer();

    if (!timer) return 0;

    if (timer.status === TimerStatus.RUNNING && timer.endsAt) {
      return Math.max(0, timer.endsAt - this.now());
    }

    return timer.durationMs;
  });

  isExpired = computed(() => this.isRunning() && this.remainingMs() <= 0);

  displayTime = computed(() => {
    const totalSeconds = Math.ceil(this.remainingMs() / 1000);
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
  }
}
