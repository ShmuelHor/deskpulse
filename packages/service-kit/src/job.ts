/** Background work that lives and dies with its service. */
export interface Job {
  /** Begins scheduling; returns at once. */
  readonly start: () => void;
  /** Stops scheduling and waits for a run in progress. */
  readonly stop: () => Promise<void>;
}
