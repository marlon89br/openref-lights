import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LiftTimerComponent } from './lift-timer';
import { TimerState, TimerStatus } from '../../models/lift.model';

describe('LiftTimerComponent', () => {
  let component: LiftTimerComponent;
  let fixture: ComponentFixture<LiftTimerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LiftTimerComponent],
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
});
