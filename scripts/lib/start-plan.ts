/** One command `npm start` runs before the agent. */
export interface StartStep {
  readonly label: string;
  readonly command: string;
  readonly args: readonly string[];
}

/** The web is published on loopback only (SECURITY: network rules). */
export const WEB_URL = 'http://127.0.0.1:4710/';
/** A cold build plus Postgres init fits well inside this. */
export const HEALTHY_TIMEOUT_SECONDS = 300;

/**
 * The commands before the agent. The legacy data migration always runs first (after
 * `setup`); `setup` runs only when `.env` is missing:
 * it is safe to re-run, but the quiet path should not print on every start.
 * `--wait` returns once every service with a healthcheck is healthy, and
 * fails if one is not within the timeout.
 */
export function planStartSteps(options: { readonly envExists: boolean }): readonly StartStep[] {
  const setup: StartStep = {
    label: 'Creating .env',
    command: 'npm',
    args: ['run', '--silent', 'setup'],
  };
  // Brings a pre-DeskPulse install's database over before the new stack can create an
  // empty one. A no-op on every start after the first.
  const migrate: StartStep = {
    label: 'Checking for data from a pre-DeskPulse install',
    command: 'npm',
    args: ['run', '--silent', 'migrate:yoman'],
  };
  const stack: StartStep = {
    label: 'Starting the stack',
    command: 'docker',
    args: [
      'compose',
      'up',
      '--detach',
      '--build',
      '--wait',
      '--wait-timeout',
      String(HEALTHY_TIMEOUT_SECONDS),
    ],
  };
  return options.envExists ? [migrate, stack] : [setup, migrate, stack];
}

/** The agent runs in the foreground, so Ctrl+C stops it. */
export const AGENT_COMMAND: Pick<StartStep, 'command' | 'args'> = {
  command: 'npm',
  args: ['run', '--silent', 'agent:dev'],
};

export const STOP_STEP: StartStep = {
  label: 'Stopping the stack',
  command: 'docker',
  args: ['compose', 'down'],
};
