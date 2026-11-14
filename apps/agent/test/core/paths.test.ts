import { describe, expect, it } from 'vitest';
import { resolveAgentPaths } from '../../src/core/paths.js';

describe('resolveAgentPaths', () => {
  it('uses the SPEC locations under HOME by default', () => {
    expect(resolveAgentPaths({ HOME: '/home/u' })).toEqual({
      configFile: '/home/u/.config/deskpulse/agent.json',
      stateDir: '/home/u/.local/state/deskpulse',
      bufferDir: '/home/u/.local/state/deskpulse/buffer',
    });
  });

  it('honors absolute XDG base directories', () => {
    const paths = resolveAgentPaths({
      HOME: '/home/u',
      XDG_CONFIG_HOME: '/cfg',
      XDG_STATE_HOME: '/state',
    });
    expect(paths.configFile).toBe('/cfg/deskpulse/agent.json');
    expect(paths.bufferDir).toBe('/state/deskpulse/buffer');
  });

  it('ignores relative XDG base directories', () => {
    const paths = resolveAgentPaths({ HOME: '/home/u', XDG_STATE_HOME: 'state' });
    expect(paths.stateDir).toBe('/home/u/.local/state/deskpulse');
  });

  it.each([{}, { HOME: 'relative' }])('rejects a missing or relative HOME: %o', (env) => {
    expect(() => resolveAgentPaths(env)).toThrow('HOME');
  });
});
