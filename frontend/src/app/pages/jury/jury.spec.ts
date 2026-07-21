import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JuryComponent } from './jury';
import { LiftService } from '../../services/lift.service';
import { LiftStateType, Decision, RefereePosition, TimerStatus } from '../../models/lift.model';
import { signal, WritableSignal } from '@angular/core';
import { LiftState } from '../../models/lift.model';

describe('JuryComponent', () => {
  let component: JuryComponent;
  let fixture: ComponentFixture<JuryComponent>;
  let mockLiftService: Partial<LiftService>;
  let stateSignal: WritableSignal<LiftState | null>;

  beforeEach(async () => {
    stateSignal = signal<LiftState | null>(null);

    mockLiftService = {
      state: stateSignal.asReadonly(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      juryOverrule: vi.fn(),
      startTimer: vi.fn(),
      stopTimer: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [JuryComponent],
      providers: [{ provide: LiftService, useValue: mockLiftService }],
    }).compileComponents();

    fixture = TestBed.createComponent(JuryComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should connect to service on init', () => {
    component.ngOnInit();
    expect(mockLiftService.connect).toHaveBeenCalled();
  });

  it('should disconnect on destroy', () => {
    component.ngOnDestroy();
    expect(mockLiftService.disconnect).toHaveBeenCalled();
  });

  it('should expose state from service', () => {
    expect(component.state).toBe(mockLiftService.state);
  });

  it('should expose Decision enum for template', () => {
    expect(component.Decision).toBe(Decision);
  });

  it('should expose RefereePosition enum for template', () => {
    expect(component.RefereePosition).toBe(RefereePosition);
  });

  it('should initialize with isSubmitting as false', () => {
    expect(component.isSubmitting()).toBe(false);
  });

  it('should initialize countdown at 1', () => {
    expect(component.countdown()).toBe(1);
  });

  it('should get decision for a referee position', () => {
    stateSignal.set({
      state: LiftStateType.COLLECTING_DECISIONS,
      context: {
        decisions: [{ position: RefereePosition.CHIEF, decision: Decision.RED }],
        connectedReferees: [],
      },
    });

    const decision = component.getDecision(RefereePosition.CHIEF);

    expect(decision).toBe(Decision.RED);
  });

  it('should compute hasJuryOverrule correctly when overrule exists', () => {
    stateSignal.set({
      state: LiftStateType.JURY_OVERRULE,
      context: {
        decisions: [],
        connectedReferees: [],
        juryOverrule: { decision: Decision.WHITE, timestamp: Date.now() },
      },
    });

    expect(component.hasJuryOverrule()).toBe(true);
  });

  it('should compute hasJuryOverrule correctly when no overrule', () => {
    stateSignal.set({
      state: LiftStateType.COLLECTING_DECISIONS,
      context: {
        decisions: [],
        connectedReferees: [],
      },
    });

    expect(component.hasJuryOverrule()).toBe(false);
  });

  it('should call juryOverrule service method', () => {
    component.juryOverrule(Decision.BLUE);
    expect(component.isSubmitting()).toBe(true);
  });

  it('should call startTimer service method', () => {
    component.startTimer();
    expect(mockLiftService.startTimer).toHaveBeenCalled();
  });

  it('should call stopTimer service method', () => {
    component.stopTimer();
    expect(mockLiftService.stopTimer).toHaveBeenCalled();
  });

  it('should compute isTimerRunning correctly when timer is running', () => {
    stateSignal.set({
      state: LiftStateType.AWAITING_DECISIONS,
      context: {
        decisions: [],
        connectedReferees: [],
        timer: { status: TimerStatus.RUNNING, durationMs: 60_000, endsAt: Date.now() + 60_000 },
      },
    });

    expect(component.isTimerRunning()).toBe(true);
  });

  it('should compute isTimerRunning correctly when timer is stopped', () => {
    stateSignal.set({
      state: LiftStateType.AWAITING_DECISIONS,
      context: {
        decisions: [],
        connectedReferees: [],
        timer: { status: TimerStatus.STOPPED, durationMs: 60_000 },
      },
    });

    expect(component.isTimerRunning()).toBe(false);
  });
});
