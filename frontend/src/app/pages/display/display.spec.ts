import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DisplayComponent } from './display';
import { LiftService } from '../../services/lift.service';
import { AudioBeepService } from '../../services/audio-beep.service';
import { ActivatedRoute, ActivatedRouteSnapshot, Router, convertToParamMap } from '@angular/router';
import { LiftStateType, Decision, RefereePosition, LiftState, TimerStatus } from '../../models/lift.model';
import { signal, WritableSignal } from '@angular/core';
import { of } from 'rxjs';

const SESSION_ID = 'SESSION1';

describe('DisplayComponent', () => {
  let component: DisplayComponent;
  let fixture: ComponentFixture<DisplayComponent>;
  let mockLiftService: Partial<LiftService>;
  let mockAudioBeep: { unlock: ReturnType<typeof vi.fn> };
  let mockRouter: Partial<Router>;
  let stateSignal: WritableSignal<LiftState | null>;

  function configure(params: Record<string, string>) {
    return TestBed.configureTestingModule({
      imports: [DisplayComponent],
      providers: [
        { provide: LiftService, useValue: mockLiftService },
        { provide: AudioBeepService, useValue: mockAudioBeep },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap(params)),
            snapshot: { params } as unknown as ActivatedRouteSnapshot,
          },
        },
      ],
    }).compileComponents();
  }

  beforeEach(async () => {
    stateSignal = signal<LiftState | null>(null);

    mockLiftService = {
      state: stateSignal.asReadonly(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      revealDecisions: vi.fn(),
      resetAll: vi.fn(),
    };

    mockAudioBeep = { unlock: vi.fn() };
    mockRouter = { navigate: vi.fn() };

    await configure({ sessionId: SESSION_ID });

    fixture = TestBed.createComponent(DisplayComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should connect to service with the session ID from the URL on init', () => {
    component.ngOnInit();
    expect(mockLiftService.connect).toHaveBeenCalledWith(SESSION_ID);
    expect(component.sessionId()).toBe(SESSION_ID);
  });

  it('should not connect and should show the prompt when the URL has no session ID', async () => {
    TestBed.resetTestingModule();
    await configure({});
    fixture = TestBed.createComponent(DisplayComponent);
    component = fixture.componentInstance;

    component.ngOnInit();

    expect(mockLiftService.connect).not.toHaveBeenCalled();
    expect(component.sessionId()).toBeNull();
  });

  it('should navigate to the entered session ID when submitted from the prompt', () => {
    component.onSessionIdSubmitted('NEWSESH');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/display', 'NEWSESH']);
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

  it('should get decision for a referee position', () => {
    stateSignal.set({
      state: LiftStateType.COLLECTING_DECISIONS,
      context: {
        decisions: [{ position: RefereePosition.LEFT, decision: Decision.WHITE }],
        connectedReferees: [],
      },
    });

    const decision = component.getDecision(RefereePosition.LEFT);

    expect(decision).toBe(Decision.WHITE);
  });

  it('should return undefined for position without decision', () => {
    stateSignal.set({
      state: LiftStateType.AWAITING_DECISIONS,
      context: {
        decisions: [],
        connectedReferees: [],
      },
    });

    const decision = component.getDecision(RefereePosition.LEFT);

    expect(decision).toBeUndefined();
  });

  it('should show jury overrule when present', () => {
    stateSignal.set({
      state: LiftStateType.JURY_OVERRULE,
      context: {
        decisions: [],
        connectedReferees: [],
        juryOverrule: { decision: Decision.RED, timestamp: Date.now() },
      },
    });

    expect(component.state()?.context.juryOverrule?.decision).toBe(Decision.RED);
  });

  it('should clear auto-reset timer on destroy', () => {
    component.ngOnInit();
    component.ngOnDestroy();
    expect(mockLiftService.disconnect).toHaveBeenCalled();
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

  it('should compute isTimerRunning as false when no timer is present', () => {
    stateSignal.set({
      state: LiftStateType.AWAITING_DECISIONS,
      context: { decisions: [], connectedReferees: [] },
    });

    expect(component.isTimerRunning()).toBe(false);
  });

  it('should start with the sound-unlock overlay showing', () => {
    expect(component.soundUnlocked()).toBe(false);
  });

  it('should unlock audio and dismiss the overlay when enableSound is called', () => {
    component.enableSound();

    expect(mockAudioBeep.unlock).toHaveBeenCalled();
    expect(component.soundUnlocked()).toBe(true);
  });

  describe('Fullscreen', () => {
    afterEach(() => {
      Reflect.deleteProperty(document.documentElement, 'requestFullscreen');
      Reflect.deleteProperty(document, 'exitFullscreen');
    });

    async function recreateComponent() {
      TestBed.resetTestingModule();
      await configure({ sessionId: SESSION_ID });
      fixture = TestBed.createComponent(DisplayComponent);
      component = fixture.componentInstance;
    }

    it('should report unsupported when the Fullscreen API is unavailable', () => {
      expect(component.isFullscreenSupported).toBe(false);
    });

    it('should report supported when the Fullscreen API is available', async () => {
      document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined);
      await recreateComponent();

      expect(component.isFullscreenSupported).toBe(true);
    });

    it('should request fullscreen when toggled while not fullscreen', async () => {
      const requestFullscreen = vi.fn().mockResolvedValue(undefined);

      document.documentElement.requestFullscreen = requestFullscreen;
      await recreateComponent();

      component.toggleFullscreen();

      expect(requestFullscreen).toHaveBeenCalled();
    });

    it('should exit fullscreen when toggled while fullscreen', async () => {
      document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined);
      const exitFullscreen = vi.fn().mockResolvedValue(undefined);

      document.exitFullscreen = exitFullscreen;
      await recreateComponent();

      component.isFullscreen.set(true);
      component.toggleFullscreen();

      expect(exitFullscreen).toHaveBeenCalled();
    });

    it('should update isFullscreen when a fullscreenchange event fires', async () => {
      document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined);
      await recreateComponent();
      component.ngOnInit();

      Object.defineProperty(document, 'fullscreenElement', { value: document.body, configurable: true });
      document.dispatchEvent(new Event('fullscreenchange'));
      expect(component.isFullscreen()).toBe(true);

      Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
      document.dispatchEvent(new Event('fullscreenchange'));
      expect(component.isFullscreen()).toBe(false);
    });

    it('should stop listening for fullscreenchange events after destroy', async () => {
      document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined);
      await recreateComponent();
      component.ngOnInit();
      component.ngOnDestroy();

      Object.defineProperty(document, 'fullscreenElement', { value: document.body, configurable: true });
      document.dispatchEvent(new Event('fullscreenchange'));

      expect(component.isFullscreen()).toBe(false);
    });
  });
});
