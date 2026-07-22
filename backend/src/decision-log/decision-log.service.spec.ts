import { DecisionLogService } from './decision-log.service';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { RefereePosition, Decision } from '../lift/shared/lift.constants';

describe('DecisionLogService', () => {
  let tempDir: string;
  let logPath: string;
  let service: DecisionLogService;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'decision-log-test-'));
    logPath = join(tempDir, 'nested', 'decision-log.jsonl');
    service = new DecisionLogService(logPath);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should create the log directory if it does not exist', () => {
    expect(existsSync(join(tempDir, 'nested'))).toBe(true);
  });

  it('should append a JSON line with a timestamp for each entry', () => {
    service.record({
      sessionId: 'ABC123',
      eventType: 'decision',
      position: RefereePosition.LEFT,
      decision: Decision.WHITE,
    });

    const lines = readFileSync(logPath, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(1);

    const entry = JSON.parse(lines[0]);
    expect(entry.sessionId).toBe('ABC123');
    expect(entry.eventType).toBe('decision');
    expect(entry.position).toBe(RefereePosition.LEFT);
    expect(entry.decision).toBe(Decision.WHITE);
    expect(typeof entry.timestamp).toBe('string');
    expect(new Date(entry.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('should append multiple entries in order', () => {
    service.record({
      sessionId: 'ABC123',
      eventType: 'decision',
      position: RefereePosition.LEFT,
      decision: Decision.WHITE,
    });
    service.record({ sessionId: 'ABC123', eventType: 'reveal' });
    service.record({ sessionId: 'ABC123', eventType: 'reset_all' });

    const lines = readFileSync(logPath, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[1]).eventType).toBe('reveal');
    expect(JSON.parse(lines[2]).eventType).toBe('reset_all');
  });

  it('should not throw when the write fails', () => {
    // A path that is itself a directory can't be appended to as a file - triggers a real write failure.
    const conflictingDirAsLogPath = join(tempDir, 'conflict');
    mkdirSync(conflictingDirAsLogPath);

    const brokenService = new DecisionLogService(conflictingDirAsLogPath);

    expect(() => brokenService.record({ sessionId: 'ABC123', eventType: 'reveal' })).not.toThrow();
  });
});
