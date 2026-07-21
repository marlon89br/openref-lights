import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LiftTimerComponent } from './lift-timer';
import { AudioBeepService } from '../../services/audio-beep.service';
import { TimerState, TimerStatus } from '../../models/lift.model';

describe('LiftTimerComponent', () => {
  let component: LiftTimerComponent;
  let fixture: ComponentFixture<LiftTimerComponent>;
  let mockAudioBeep: { unlock: ReturnType<typeof vi.fn>; playShortBeep: ReturnType<typeof vi.fn>; playLongBeep: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockAudioBeep = { unlock: vi.fn(), playShortBeep: vi.fn(), playLongBeep: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [LiftTimerComponent],
      providers: [{ provide: AudioBeepService, useValue: mockAudioBeep }],
    }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Creates the fixture. Fake timers (if any) must be enabled beforehand so the
   *  component's internal clock signal is initialized from the fake time base. */
  function createFixture() {
    fixture = TestBed.createComponent(LiftTimerComponent);
    component = fixture.componentInstance;
  }

  it('should create', () => {
    createFixture();
    expect(component).toBeTruthy();
  });

  it('should show the full duration when stopped', () => {
    createFixture();
    fixture.componentRef.setInput('timer', { status: TimerStatus.STOPPED, durationMs: 60_000 } as TimerState);
    fixture.detectChanges();

    expect(component.displayTime()).toBe('1:00');
    expect(component.isRunning()).toBe(false);
  });

  it('should count down while running', () => {
    vi.useFakeTimers();
    const now = Date.now();

    vi.setSystemTime(now);
    createFixture();

    fixture.componentRef.setInput('timer', {
      status: TimerStatus.RUNNING,
      durationMs: 60_000,
      endsAt: now + 45_000,
    } as TimerState);
    fixture.detectChanges();

    expect(component.displayTime()).toBe('0:45');

    vi.setSystemTime(now + 20_000);
    vi.advanceTimersByTime(200);
    fixture.detectChanges();

    expect(component.displayTime()).toBe('0:25');
  });

  it('should mark as expired once the countdown reaches zero while running', () => {
    vi.useFakeTimers();
    const now = Date.now();

    vi.setSystemTime(now);
    createFixture();

    fixture.componentRef.setInput('timer', {
      status: TimerStatus.RUNNING,
      durationMs: 60_000,
      endsAt: now - 1_000,
    } as TimerState);
    fixture.detectChanges();

    expect(component.isExpired()).toBe(true);
    expect(component.displayTime()).toBe('0:00');
  });

  it('should not be expired when stopped', () => {
    createFixture();
    fixture.componentRef.setInput('timer', { status: TimerStatus.STOPPED, durationMs: 60_000 } as TimerState);
    fixture.detectChanges();

    expect(component.isExpired()).toBe(false);
  });

  it('should not beep when stopped', () => {
    createFixture();
    fixture.componentRef.setInput('timer', { status: TimerStatus.STOPPED, durationMs: 60_000 } as TimerState);
    fixture.detectChanges();

    expect(mockAudioBeep.playShortBeep).not.toHaveBeenCalled();
    expect(mockAudioBeep.playLongBeep).not.toHaveBeenCalled();
  });

  it('should play a short beep at the 30-second mark', () => {
    vi.useFakeTimers();
    const now = Date.now();

    vi.setSystemTime(now);
    createFixture();

    fixture.componentRef.setInput('timer', {
      status: TimerStatus.RUNNING,
      durationMs: 60_000,
      endsAt: now + 30_000,
    } as TimerState);
    fixture.detectChanges();

    expect(mockAudioBeep.playShortBeep).toHaveBeenCalledTimes(1);
  });

  it('should not beep again while still at the 30-second mark on the next tick', () => {
    vi.useFakeTimers();
    const now = Date.now();

    vi.setSystemTime(now);
    createFixture();

    fixture.componentRef.setInput('timer', {
      status: TimerStatus.RUNNING,
      durationMs: 60_000,
      endsAt: now + 30_000,
    } as TimerState);
    fixture.detectChanges();

    vi.advanceTimersByTime(200);
    fixture.detectChanges();

    expect(mockAudioBeep.playShortBeep).toHaveBeenCalledTimes(1);
  });

  it('should beep every second during the final 10-second countdown', () => {
    vi.useFakeTimers();
    const now = Date.now();

    vi.setSystemTime(now);
    createFixture();

    fixture.componentRef.setInput('timer', {
      status: TimerStatus.RUNNING,
      durationMs: 60_000,
      endsAt: now + 10_000,
    } as TimerState);
    fixture.detectChanges();

    expect(mockAudioBeep.playShortBeep).toHaveBeenCalledTimes(1);

    vi.setSystemTime(now + 1_000);
    vi.advanceTimersByTime(200);
    fixture.detectChanges();

    expect(mockAudioBeep.playShortBeep).toHaveBeenCalledTimes(2);
  });

  it('should not beep between the 30-second mark and the final countdown', () => {
    vi.useFakeTimers();
    const now = Date.now();

    vi.setSystemTime(now);
    createFixture();

    fixture.componentRef.setInput('timer', {
      status: TimerStatus.RUNNING,
      durationMs: 60_000,
      endsAt: now + 20_000,
    } as TimerState);
    fixture.detectChanges();

    expect(mockAudioBeep.playShortBeep).not.toHaveBeenCalled();
    expect(mockAudioBeep.playLongBeep).not.toHaveBeenCalled();
  });

  it('should play a long beep exactly once when the timer expires', () => {
    vi.useFakeTimers();
    const now = Date.now();

    vi.setSystemTime(now);
    createFixture();

    fixture.componentRef.setInput('timer', {
      status: TimerStatus.RUNNING,
      durationMs: 60_000,
      endsAt: now - 1_000,
    } as TimerState);
    fixture.detectChanges();

    vi.advanceTimersByTime(200);
    fixture.detectChanges();
    vi.advanceTimersByTime(200);
    fixture.detectChanges();

    expect(mockAudioBeep.playLongBeep).toHaveBeenCalledTimes(1);
    expect(mockAudioBeep.playShortBeep).not.toHaveBeenCalled();
  });

  it('should reset the beep marker so the next lifter timer beeps again at 30 seconds', () => {
    vi.useFakeTimers();
    const now = Date.now();

    vi.setSystemTime(now);
    createFixture();

    fixture.componentRef.setInput('timer', {
      status: TimerStatus.RUNNING,
      durationMs: 60_000,
      endsAt: now + 30_000,
    } as TimerState);
    fixture.detectChanges();
    expect(mockAudioBeep.playShortBeep).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput('timer', { status: TimerStatus.STOPPED, durationMs: 60_000 } as TimerState);
    fixture.detectChanges();

    fixture.componentRef.setInput('timer', {
      status: TimerStatus.RUNNING,
      durationMs: 60_000,
      endsAt: now + 30_000,
    } as TimerState);
    fixture.detectChanges();

    expect(mockAudioBeep.playShortBeep).toHaveBeenCalledTimes(2);
  });
});
