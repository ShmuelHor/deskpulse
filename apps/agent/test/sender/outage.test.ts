import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IngestBatch, type IngestResult, type Sample } from '@deskpulse/shared/ingest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBuffer, type SampleBuffer } from '../../src/core/buffer.js';
import { createIngestClient, type FetchFn } from '../../src/sender/adapters/ingest-client.js';
import { MAX_BACKOFF_MS, SEND_INTERVAL_MS } from '../../src/sender/domain/schedule.js';
import type { ReplyHandler } from '../../src/sender/reply-handlers.js';
import { createSender, type Sender } from '../../src/sender/sender.js';
import { recordingLogger } from '../support/logs.js';
import { VirtualTimers } from './virtual-timers.js';

const START = Date.parse('2026-11-10T08:00:00Z');
const WINDOW_EVERY_MS = 5_000;
const ONE_HOUR = 3_600_000;
const RECOVERY_MS = 1_800_000;
/** At 2, 6, 14 min, then every 10 min: 8 tries in the hour, with some slack. */
const MAX_OUTAGE_ATTEMPTS = 10;
const GATEWAY_RATE_WINDOW_MS = 10_000;
/** The gateway's body limit (SECURITY A17). */
const GATEWAY_BODY_LIMIT = 1_048_576;
/** A full process list per sample: an hour of these is more than one request body. */
const PROCESSES_PER_SAMPLE = 30;
const COMM_LENGTH = 64;
const COMM = 'c'.repeat(COMM_LENGTH);
const TOKEN = 'test-agent-token';
const STATUS_OK = 200;
const STATUS_UNAUTHORIZED = 401;
const STATUS_BAD_REQUEST = 400;
const STATUS_TOO_LARGE = 413;
const STATUS_TOO_MANY = 429;
/** Each test runs hours of real buffer IO on a virtual clock. */
const SLOW_TEST_MS = 30_000;

/**
 * Plays the gateway: refuses connections while "Docker is down", and
 * otherwise enforces the same token, body limit, contract and rate limit.
 */
class FakeGateway {
  up = false;
  readonly received: Sample[] = [];
  readonly attempts: number[] = [];
  readonly statuses: number[] = [];
  /** The size of each accepted batch. */
  readonly batches: number[] = [];
  private lastAcceptedAt = Number.NEGATIVE_INFINITY;

  constructor(private readonly timers: VirtualTimers) {}

  readonly fetch: FetchFn = async (_url, init) => {
    this.attempts.push(this.timers.now);
    if (!this.up) {
      throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
    }
    const status = this.check(init);
    this.statuses.push(status);
    return status === STATUS_OK
      ? Response.json(this.accept(String(init.body)))
      : new Response(null, { status });
  };

  private check(init: RequestInit): number {
    const headers = new Headers(init.headers);
    if (headers.get('authorization') !== `Bearer ${TOKEN}`) {
      return STATUS_UNAUTHORIZED;
    }
    if (Buffer.byteLength(String(init.body)) > GATEWAY_BODY_LIMIT) {
      return STATUS_TOO_LARGE;
    }
    if (this.timers.now - this.lastAcceptedAt < GATEWAY_RATE_WINDOW_MS) {
      return STATUS_TOO_MANY;
    }
    return IngestBatch.safeParse(JSON.parse(String(init.body))).success
      ? STATUS_OK
      : STATUS_BAD_REQUEST;
  }

  private accept(body: string): IngestResult {
    const batch = IngestBatch.parse(JSON.parse(body));
    this.lastAcceptedAt = this.timers.now;
    this.received.push(...batch.samples);
    this.batches.push(batch.samples.length);
    return { accepted: batch.samples.length, deliver: [], queued: 0, degraded: [] };
  }
}

function bulkySample(at: number, pid: number): Sample {
  return {
    kind: 'processes',
    ts: new Date(at).toISOString(),
    processes: Array.from({ length: PROCESSES_PER_SAMPLE }, (_unused, index) => ({
      pid: pid + index,
      comm: COMM,
      cpuPct: 1,
      rssBytes: 1_000_000,
      ioBytesPerSec: 1_000,
    })),
  };
}

describe('sender during a gateway outage', () => {
  let root: string;
  let timers: VirtualTimers;
  let gateway: FakeGateway;
  let buffer: SampleBuffer;
  let sender: Sender;
  let collected: Sample[];
  let replies: number;

  /** Collects a sample every 5 s until `until`, running the sender in between. */
  async function collectUntil(until: number): Promise<void> {
    while (timers.now + WINDOW_EVERY_MS <= until) {
      await timers.advanceTo(timers.now + WINDOW_EVERY_MS, () => sender.whenIdle());
      const sample = bulkySample(START + timers.now, collected.length + 1);
      collected.push(sample);
      await buffer.append([sample]);
    }
  }

  /** Lets the sender pick up the last samples, with nothing new collected. */
  async function settle(): Promise<void> {
    await timers.advanceTo(timers.now + SEND_INTERVAL_MS, () => sender.whenIdle());
    await sender.stop();
  }

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'deskpulse-outage-'));
    timers = new VirtualTimers();
    timers.install();
    gateway = new FakeGateway(timers);
    const { logger } = recordingLogger();
    buffer = await createBuffer({
      stateDir: join(root, 'state'),
      bufferDir: join(root, 'state', 'buffer'),
      logger,
      now: () => new Date(START + timers.now),
    });
    collected = [];
    replies = 0;
    const counter: ReplyHandler = {
      name: 'counter',
      handle: async () => {
        replies += 1;
      },
    };
    sender = createSender({
      buffer,
      client: createIngestClient({
        gatewayUrl: 'http://127.0.0.1:4711',
        agentToken: TOKEN,
        fetch: gateway.fetch,
      }),
      agentVersion: '0.0.0',
      logger,
      replyHandlers: [counter],
    });
  });

  afterEach(async () => {
    await sender.stop();
    vi.unstubAllGlobals();
    await rm(root, { recursive: true, force: true });
  });

  it(
    'loses no sample when Docker is stopped for an hour',
    async () => {
      sender.start();
      await sender.whenIdle();
      await collectUntil(ONE_HOUR);
      const duringOutage = gateway.attempts.length;

      gateway.up = true;
      await collectUntil(ONE_HOUR + RECOVERY_MS);
      await settle();

      expect(gateway.received).toHaveLength(collected.length);
      expect(gateway.received).toEqual(collected);
      expect(buffer.sizeBytes).toBe(0);
      expect(gateway.statuses.every((status) => status === STATUS_OK)).toBe(true);
      expect(replies).toBe(gateway.statuses.length);
      // The backoff kept the agent quiet: a handful of tries, never more than 10 min apart.
      const gaps = gateway.attempts
        .slice(1)
        .map((at, index) => at - (gateway.attempts[index] ?? 0));
      expect(duringOutage).toBeLessThanOrEqual(MAX_OUTAGE_ATTEMPTS);
      expect(Math.max(...gaps)).toBeLessThanOrEqual(MAX_BACKOFF_MS);
    },
    SLOW_TEST_MS,
  );

  it(
    'drains a backlog bigger than one request body without tripping the rate limit',
    async () => {
      sender.start();
      await sender.whenIdle();
      await collectUntil(ONE_HOUR);
      expect(buffer.sizeBytes).toBeGreaterThan(GATEWAY_BODY_LIMIT);
      const backlog = collected.length;

      gateway.up = true;
      await collectUntil(ONE_HOUR + RECOVERY_MS);
      await settle();

      expect(gateway.batches[0]).toBeLessThan(backlog);
      expect(gateway.received).toEqual(collected);
      expect(gateway.statuses.filter((status) => status !== STATUS_OK)).toEqual([]);
      expect(buffer.sizeBytes).toBe(0);
    },
    SLOW_TEST_MS,
  );
});
