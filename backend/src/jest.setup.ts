import { join } from 'path';
import { tmpdir } from 'os';

// Keep the decision log out of the repo during test runs - real usage sets this via the environment.
process.env.DECISION_LOG_PATH = join(tmpdir(), 'openref-lights-test', 'decision-log.jsonl');
