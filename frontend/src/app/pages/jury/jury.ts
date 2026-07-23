import { Component, OnInit, OnDestroy, signal, computed, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { LiftService } from '../../services/lift.service';
import { AudioBeepService } from '../../services/audio-beep.service';
import { RefereePosition, Decision, TimerStatus } from '../../models/lift.model';
import { LiftTimerComponent } from '../../components/lift-timer/lift-timer';
import { QrCodeComponent } from '../../components/qr-code/qr-code';
import { generateSessionId, isValidSessionId, normalizeSessionId } from '../../utils/session-id';
import { environment } from '../../environments/environment';
import { interval } from 'rxjs';
import { takeWhile, tap, finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/** Countdown duration in seconds before a jury overrule is submitted. */
const COUNTDOWN_DURATION_SECONDS = 1;

/** Countdown tick interval in milliseconds. */
const COUNTDOWN_TICK_MS = 100;

/** How long the "Copied!" confirmation stays visible after copying a link. */
const COPY_CONFIRMATION_MS = 2000;

@Component({
  selector: 'app-jury',
  imports: [CommonModule, LiftTimerComponent, QrCodeComponent],
  templateUrl: './jury.html',
  styleUrl: './jury.css',
})
export class JuryComponent implements OnInit, OnDestroy {
  protected liftService = inject(LiftService);
  private audioBeep = inject(AudioBeepService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  state = this.liftService.state;

  Decision = Decision;
  RefereePosition = RefereePosition;

  isSubmitting = signal(false);
  countdown = signal(COUNTDOWN_DURATION_SECONDS);
  pendingDecision = signal<Decision | null>(null);
  private countdownToken = 0;

  // Session/platform ID this jury table is running
  sessionId = signal<string | null>(null);
  sessionIdInput = signal('');
  isSessionIdInputValid = computed(() => isValidSessionId(normalizeSessionId(this.sessionIdInput())));

  displayUrl = computed(() => this.joinUrl('display'));
  refereeUrls = computed(() => ({
    left: this.joinUrl('referee', RefereePosition.LEFT),
    chief: this.joinUrl('referee', RefereePosition.CHIEF),
    right: this.joinUrl('referee', RefereePosition.RIGHT),
  }));

  /** Hidden by default so the session ID/QR codes aren't visible to anyone walking past the table. */
  sessionPanelExpanded = signal(false);

  /** Shown one at a time so only the intended device's QR code is ever scannable. */
  qrIndex = signal(0);
  qrItems = computed(() => [
    { label: 'Public Display', url: this.displayUrl() },
    { label: 'Left Referee', url: this.refereeUrls().left },
    { label: 'Chief Referee', url: this.refereeUrls().chief },
    { label: 'Right Referee', url: this.refereeUrls().right },
  ]);
  currentQrItem = computed(() => this.qrItems()[this.qrIndex()]);

  /** The URL last copied via copyLink(), shown as a brief "Copied!" confirmation. */
  copiedUrl = signal<string | null>(null);
  private copyConfirmationTimer?: ReturnType<typeof setTimeout>;

  // Computed signal for jury overrule
  hasJuryOverrule = computed(() => !!this.liftService.state()?.context.juryOverrule);

  // Lift timer
  timer = computed(() => this.liftService.state()?.context.timer);
  isTimerRunning = computed(() => this.timer()?.status === TimerStatus.RUNNING);

  currentDecision = computed(() => {
    return this.liftService.state()?.context.juryOverrule?.decision || null;
  });

  // Check if a specific decision button should be disabled
  isDecisionDisabled = (decision: Decision) => {
    return this.pendingDecision() === decision || this.currentDecision() === decision;
  };

  ngOnInit() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const idFromRoute = params.get('sessionId');

      if (!idFromRoute) {
        this.router.navigate(['/jury', generateSessionId()], { replaceUrl: true });

        return;
      }

      if (idFromRoute === this.sessionId()) return;

      this.sessionId.set(idFromRoute);
      this.sessionIdInput.set(idFromRoute);
      this.liftService.disconnect();
      this.liftService.connect(idFromRoute);
    });
  }

  ngOnDestroy() {
    this.liftService.disconnect();
    clearTimeout(this.copyConfirmationTimer);
  }

  onSessionIdInput(event: Event) {
    this.sessionIdInput.set((event.target as HTMLInputElement).value);
  }

  applySessionId() {
    const sessionId = normalizeSessionId(this.sessionIdInput());

    if (!isValidSessionId(sessionId) || sessionId === this.sessionId()) return;

    this.router.navigate(['/jury', sessionId]);
  }

  newSessionId() {
    this.router.navigate(['/jury', generateSessionId()]);
  }

  toggleSessionPanel() {
    this.sessionPanelExpanded.update((expanded) => !expanded);
    this.qrIndex.set(0);
  }

  nextQrCode() {
    const total = this.qrItems().length;

    this.qrIndex.update((i) => (i + 1) % total);
  }

  previousQrCode() {
    const total = this.qrItems().length;

    this.qrIndex.update((i) => (i - 1 + total) % total);
  }

  async copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API may be unavailable (e.g. no secure context) - the link text is still visible to copy by hand.
      return;
    }

    this.copiedUrl.set(url);
    clearTimeout(this.copyConfirmationTimer);
    this.copyConfirmationTimer = setTimeout(() => this.copiedUrl.set(null), COPY_CONFIRMATION_MS);
  }

  private joinUrl(...pathSegments: string[]): string {
    const sessionId = this.sessionId();

    if (!sessionId) return '';

    // Prefer the configured public URL (set at deploy time) over window.location.origin, since the
    // jury device may be browsing via "localhost" or a LAN IP that other devices can't reach/scan.
    const origin = (environment.frontendUrl || window.location.origin).replace(/\/+$/, '');

    return `${origin}/${[...pathSegments, sessionId].join('/')}`;
  }

  getDecision(position: RefereePosition): Decision | undefined {
    return this.liftService.state()?.context.decisions.find((d) => d.position === position)?.decision;
  }

  juryOverrule(decision: Decision) {
    this.countdownToken += 1;
    const token = this.countdownToken;

    this.isSubmitting.set(true);
    this.pendingDecision.set(decision);

    this.countdown.set(COUNTDOWN_DURATION_SECONDS);

    interval(COUNTDOWN_TICK_MS)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap((tick) => {
          const remaining = Math.max(0, COUNTDOWN_DURATION_SECONDS - tick * 0.1);

          this.countdown.set(Number(remaining.toFixed(1)));
        }),
        takeWhile(() => this.countdown() > 0 && token === this.countdownToken, true),
        finalize(() => {
          if (token !== this.countdownToken) {
            return;
          }
          if (this.countdown() <= 0) {
            this.liftService.juryOverrule(decision);
          }
          this.isSubmitting.set(false);
          this.pendingDecision.set(null);
        }),
      )
      .subscribe();
  }

  cancelOverrule() {
    this.countdownToken += 1;
    this.countdown.set(0);
    this.isSubmitting.set(false);
  }

  clearJuryOverrule() {
    this.liftService.clearJuryOverrule();
  }

  startTimer() {
    // Unlock audio playback here since this click is a genuine user gesture.
    this.audioBeep.unlock();
    this.liftService.startTimer();
  }

  stopTimer() {
    this.liftService.stopTimer();
  }

  getDecisionClass(position: RefereePosition): string {
    const decision = this.getDecision(position);

    return decision ? decision.toLowerCase() : '';
  }

  getJuryDecisionClass(): string {
    return this.liftService.state()?.context.juryOverrule?.decision?.toLowerCase() || '';
  }

  getJuryDecisionText(): string {
    const decision = this.liftService.state()?.context.juryOverrule?.decision;

    if (!decision) return '';

    return decision === Decision.WHITE ? 'GOOD LIFT' : 'NO LIFT';
  }
}
