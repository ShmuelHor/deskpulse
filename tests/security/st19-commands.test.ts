import { describe, it } from 'vitest';

describe('ST19 commands', () => {
  it.todo('[T72] a command without a session or CSRF token returns 403');
  it.todo('[T72] a system command type (liveMode, mute, restore) in a web request returns 400');
  it.todo('[T72] the gateway refuses an unknown type, a replayed ID or one past its TTL');
  it.todo('[T72] the agent refuses an unknown type, a replayed ID or one past its TTL');
});
