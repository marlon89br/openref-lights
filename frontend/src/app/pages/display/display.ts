import { Component, OnInit, OnDestroy, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { LiftService } from '../../services/lift.service';
import { AudioBeepService } from '../../services/audio-beep.service';
import { RefereePosition, Decision, LiftStateType, TimerStatus } from '../../models/lift.model';
import { LiftTimerComponent } from '../../components/lift-timer/lift-timer';
import { SessionIdPromptComponent } from '../../components/session-id-prompt/session-id-prompt';
import { isValidSessionId } from '../../utils/session-id';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-display',
  imports: [CommonModule, LiftTimerComponent, SessionIdPromptComponent],
  templateUrl: './display.html',
  styleUrl: './display.css',
})
export class DisplayComponent implements OnInit, OnDestroy {
  protected liftService = inject(LiftService);
  private audioBeep = inject(AudioBeepService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  state = this.liftService.state;

  /** The session/platform ID this display is showing, or null until one is known. */
  sessionId = signal<string | null>(null);

  Decision = Decision;
  RefereePosition = RefereePosition;

  readonly refereePositions = [RefereePosition.LEFT, RefereePosition.CHIEF, RefereePosition.RIGHT];

  private showTimer?: ReturnType<typeof setTimeout>;
  private autoResetTimer?: ReturnType<typeof setTimeout>;
  private readonly AUTO_SHOW_DELAY = 500;
  private readonly AUTO_RESET_DELAY = 5000;

  /** Whether a jury overrule is currently active. */
  hasJuryOverrule = computed(() => !!this.liftService.state()?.context.juryOverrule);

  /** Whether the display is not connected to the backend. */
  isDisconnected = computed(() => !this.liftService.state());

  /** The current lift timer, started by the jury/table once the bar is loaded. */
  timer = computed(() => this.liftService.state()?.context.timer);

  /** Whether the lift timer is actively counting down. */
  isTimerRunning = computed(() => this.timer()?.status === TimerStatus.RUNNING);

  /** Whether the one-time "tap to enable sound" prompt has been dismissed.
   *  Browsers block audio until a user gesture occurs on this page. */
  soundUnlocked = signal(false);

  constructor() {
    // Use effect to handle state transitions
    effect((onCleanup) => {
      const currentState = this.liftService.state()?.state;

      // Auto-reveal when all decisions are in
      if (currentState === LiftStateType.READY_TO_REVEAL) {
        this.clearShowTimer();
        this.showTimer = setTimeout(() => {
          this.liftService.revealDecisions();
        }, this.AUTO_SHOW_DELAY);
      }

      if (currentState !== LiftStateType.READY_TO_REVEAL) {
        this.clearShowTimer();
      }

      // Auto-reset after revealing for X seconds
      if (currentState === LiftStateType.REVEALING_DECISIONS) {
        this.clearAutoResetTimer();
        this.autoResetTimer = setTimeout(() => {
          this.liftService.resetAll();
        }, this.AUTO_RESET_DELAY);
      }

      // Clear timer if we leave revealing state
      if (currentState !== LiftStateType.REVEALING_DECISIONS) {
        this.clearAutoResetTimer();
      }

      onCleanup(() => {
        this.clearTimers();
      });
    });
  }

  ngOnInit() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const sessionId = params.get('sessionId');

      if (!sessionId || !isValidSessionId(sessionId)) {
        this.sessionId.set(null);
        this.liftService.disconnect();

        return;
      }

      if (sessionId === this.sessionId()) return;

      this.sessionId.set(sessionId);
      this.liftService.disconnect();
      this.liftService.connect(sessionId);
    });
  }

  ngOnDestroy() {
    this.clearTimers();
    this.liftService.disconnect();
  }

  onSessionIdSubmitted(sessionId: string) {
    this.router.navigate(['/display', sessionId]);
  }

  private clearTimers() {
    this.clearShowTimer();
    this.clearAutoResetTimer();
  }

  private clearShowTimer() {
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = undefined;
    }
  }

  private clearAutoResetTimer() {
    if (this.autoResetTimer) {
      clearTimeout(this.autoResetTimer);
      this.autoResetTimer = undefined;
    }
  }

  getDecision(position: RefereePosition): Decision | undefined {
    return this.liftService.state()?.context.decisions.find((d) => d.position === position)?.decision;
  }

  getDisplayDecision(position: RefereePosition): Decision | undefined {
    const state = this.liftService.state();

    if (state?.context.juryOverrule) {
      return state.context.juryOverrule.decision;
    }

    if (state?.state === LiftStateType.REVEALING_DECISIONS || state?.state === LiftStateType.JURY_OVERRULE) {
      return this.getDecision(position);
    }

    return undefined;
  }

  getCircleClass(decision: Decision | undefined): string {
    if (decision === Decision.WHITE) return 'display-light-white';
    if (decision) return 'display-light-red';

    return 'display-light-inactive';
  }

  getIndicatorClass(decision: Decision): string {
    return `indicator-${decision.toLowerCase()}`;
  }

  enableSound() {
    this.audioBeep.unlock();
    this.soundUnlocked.set(true);
  }
}
