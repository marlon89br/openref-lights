import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JuryComponent } from './jury';
import { LiftService } from '../../services/lift.service';
import { AudioBeepService } from '../../services/audio-beep.service';
import { ActivatedRoute, ActivatedRouteSnapshot, Router, convertToParamMap } from '@angular/router';
import { LiftStateType, Decision, RefereePosition, TimerStatus } from '../../models/lift.model';
import { signal, WritableSignal } from '@angular/core';
import { LiftState } from '../../models/lift.model';
import { of } from 'rxjs';

const SESSION_ID = 'SESSION1';

describe('JuryComponent', () => {
  let component: JuryComponent;
  let fixture: ComponentFixture<JuryComponent>;
  let mockLiftService: Partial<LiftService>;
  let mockAudioBeep: { unlock: ReturnType<typeof vi.fn> };
  let mockRouter: Partial<Router>;
  let stateSignal: WritableSignal<LiftState | null>;

  function configure(params: Record<string, string>) {
    return TestBed.configureTestingModule({
      imports: [JuryComponent],
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
      juryOverrule: vi.fn(),
      startTimer: vi.fn(),
      stopTimer: vi.fn(),
    };

    mockAudioBeep = { unlock: vi.fn() };
    mockRouter = { navigate: vi.fn() };

    await configure({ sessionId: SESSION_ID });

    fixture = TestBed.createComponent(JuryComponent);
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

  it('should generate and navigate to a new session ID when the URL has none', async () => {
    TestBed.resetTestingModule();
    await configure({});
    fixture = TestBed.createComponent(JuryComponent);
    component = fixture.componentInstance;

    component.ngOnInit();

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/jury', expect.any(String)], { replaceUrl: true });
    expect(mockLiftService.connect).not.toHaveBeenCalled();
  });

  it('should navigate to a freshly generated session ID', () => {
    component.newSessionId();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/jury', expect.any(String)]);
  });

  it('should navigate when applying a valid typed session ID', () => {
    component.ngOnInit();
    component.sessionIdInput.set('NEWSESH');
    component.applySessionId();

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/jury', 'NEWSESH']);
  });

  it('should not navigate when applying an invalid typed session ID', () => {
    component.ngOnInit();
    component.sessionIdInput.set('!!');
    component.applySessionId();

    expect(mockRouter.navigate).not.toHaveBeenCalledWith(['/jury', '!!']);
  });

  it('should compute join URLs once a session ID is known', () => {
    component.ngOnInit();

    expect(component.displayUrl()).toContain(`/display/${SESSION_ID}`);
    expect(component.refereeUrls().left).toContain(`/referee/left/${SESSION_ID}`);
    expect(component.refereeUrls().chief).toContain(`/referee/chief/${SESSION_ID}`);
    expect(component.refereeUrls().right).toContain(`/referee/right/${SESSION_ID}`);
  });

  it('should start with the session panel collapsed', () => {
    expect(component.sessionPanelExpanded()).toBe(false);
  });

  it('should toggle the session panel', () => {
    component.toggleSessionPanel();
    expect(component.sessionPanelExpanded()).toBe(true);

    component.toggleSessionPanel();
    expect(component.sessionPanelExpanded()).toBe(false);
  });

  it('should reset the QR carousel to the first item when toggling the panel', () => {
    component.ngOnInit();
    component.nextQrCode();
    expect(component.qrIndex()).toBe(1);

    component.toggleSessionPanel();
    expect(component.qrIndex()).toBe(0);
  });

  it('should list one QR item per join destination', () => {
    component.ngOnInit();

    const labels = component.qrItems().map((item) => item.label);

    expect(labels).toEqual(['Public Display', 'Left Referee', 'Chief Referee', 'Right Referee']);
  });

  it('should show only one QR code at a time and cycle forward', () => {
    component.ngOnInit();

    expect(component.currentQrItem().label).toBe('Public Display');

    component.nextQrCode();
    expect(component.currentQrItem().label).toBe('Left Referee');

    component.nextQrCode();
    component.nextQrCode();
    component.nextQrCode();
    expect(component.currentQrItem().label).toBe('Public Display');
  });

  it('should cycle backward through QR codes', () => {
    component.ngOnInit();

    component.previousQrCode();
    expect(component.currentQrItem().label).toBe('Right Referee');
  });

  it('should disconnect on destroy', () => {
    component.ngOnDestroy();
    expect(mockLiftService.disconnect).toHaveBeenCalled();
  });

  describe('copyLink', () => {
    let writeText: ReturnType<typeof vi.fn>;
    let originalClipboard: unknown;

    beforeEach(() => {
      writeText = vi.fn().mockResolvedValue(undefined);
      originalClipboard = navigator.clipboard;
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    });

    afterEach(() => {
      Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true });
      vi.useRealTimers();
    });

    it('should copy the link to the clipboard', async () => {
      await component.copyLink('https://example.com/display/ABC123');
      expect(writeText).toHaveBeenCalledWith('https://example.com/display/ABC123');
    });

    it('should show a "Copied!" confirmation for the copied URL', async () => {
      await component.copyLink('https://example.com/display/ABC123');
      expect(component.copiedUrl()).toBe('https://example.com/display/ABC123');
    });

    it('should clear the confirmation after the timeout', async () => {
      vi.useFakeTimers();

      await component.copyLink('https://example.com/display/ABC123');
      expect(component.copiedUrl()).toBe('https://example.com/display/ABC123');

      vi.advanceTimersByTime(2000);
      expect(component.copiedUrl()).toBeNull();
    });

    it('should not set the confirmation when the clipboard write fails', async () => {
      writeText.mockRejectedValue(new Error('denied'));

      await component.copyLink('https://example.com/display/ABC123');

      expect(component.copiedUrl()).toBeNull();
    });
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

  it('should unlock audio playback when starting the timer', () => {
    component.startTimer();
    expect(mockAudioBeep.unlock).toHaveBeenCalled();
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
