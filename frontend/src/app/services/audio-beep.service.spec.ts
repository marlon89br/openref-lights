import { AudioBeepService } from './audio-beep.service';

describe('AudioBeepService', () => {
  let service: AudioBeepService;
  let mockContext: {
    state: 'running' | 'suspended';
    currentTime: number;
    destination: object;
    createOscillator: ReturnType<typeof vi.fn>;
    createGain: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
  };
  let audioContextCtor: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockContext = {
      state: 'suspended',
      currentTime: 0,
      destination: {},
      createOscillator: vi.fn(() => ({
        type: '',
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      })),
      createGain: vi.fn(() => ({
        gain: { value: 0 },
        connect: vi.fn(),
      })),
      resume: vi.fn(),
    };
    mockContext.resume.mockImplementation(() => {
      mockContext.state = 'running';

      return Promise.resolve();
    });

    // Must be a real function (not an arrow function) so `new AudioContextCtor()` works.
    audioContextCtor = vi.fn(function AudioContextMock() {
      return mockContext;
    });
    vi.stubGlobal('AudioContext', audioContextCtor);

    service = new AudioBeepService();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should do nothing when AudioContext is unavailable', () => {
    vi.unstubAllGlobals();
    const bareService = new AudioBeepService();

    expect(() => bareService.unlock()).not.toThrow();
    expect(() => bareService.playShortBeep()).not.toThrow();
    expect(() => bareService.playLongBeep()).not.toThrow();
  });

  it('should resume a suspended context on unlock', () => {
    service.unlock();
    expect(mockContext.resume).toHaveBeenCalled();
  });

  it('should not resume an already-running context on unlock', () => {
    mockContext.state = 'running';
    service.unlock();
    expect(mockContext.resume).not.toHaveBeenCalled();
  });

  it('should play a short beep tone', () => {
    service.playShortBeep();

    const oscillator = mockContext.createOscillator.mock.results[0].value;

    expect(oscillator.frequency.value).toBe(880);
    expect(oscillator.start).toHaveBeenCalled();
    expect(oscillator.stop).toHaveBeenCalled();
  });

  it('should play a long beep tone at a lower frequency', () => {
    service.playLongBeep();

    const oscillator = mockContext.createOscillator.mock.results[0].value;

    expect(oscillator.frequency.value).toBe(440);
  });

  it('should reuse the same audio context across calls', () => {
    service.playShortBeep();
    service.playLongBeep();

    expect(audioContextCtor).toHaveBeenCalledTimes(1);
  });
});
