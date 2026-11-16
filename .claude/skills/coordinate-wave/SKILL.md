---

name: coordinate-wave
description: Coordinate a DeskPulse wave as the main session - move board cards, launch task workers and reviewers, merge PRs, run the wave gate and hand off. Use when acting as coordinator, not for implementing a task.
---

# Coordinate a wave

The coordinator is the main session. It owns `docs/` and `CLAUDE.md`, and never implements task code.

| Role              | Agent               | Does                                                            | Never                                                 |
| ----------------- | ------------------- | --------------------------------------------------------------- | ----------------------------------------------------- |
| Coordinator       | main session        | Board, launches, merges, wave gates, docs                       | Implements task code                                  |
| Worker            | `task-worker`       | One task per branch and worktree, one PR, answers review        | Reviews or merges its own PR, rewrites pushed history |
| Code reviewer     | `code-reviewer`     | Runs the branch, tries to break it, inline comments, `Verdict:` | Edits, commits, pushes or merges                      |
| Security reviewer | `security-reviewer` | Second review on PRs labeled `security`                         | Edits, commits, pushes or merges                      |

Reviewers start from a clean context and are never the PR's worker.

## Before every launch

Check plan usage (`get_usage`). At 80% or more of the 5-hour or weekly window, start nothing new: let
running agents finish, then tell the user the usage, the reset time and exactly where to resume.
At most 3 agents at once.

## Board flow

[Roadmap board](https://github.com/users/ShmuelHor/projects/3):
`Todo` → `Ready` (all "Blocked by" issues closed; the coordinator moves it) → `In progress` (a worker took
it) → `In review` (PR open) → `Done` (merged; `Closes #N` closes the issue).

## Launching

- A task starts only when its wave gate has passed and its dependencies are merged.
- Workers run on Sonnet; code reviews and re-reviews run on Opus.
- Every PR gets a code review. PRs labeled `security` (gateway, agent muter and collectors, CD) also get a
  security review. Both must end in `Verdict: approved`.

## Review budget

- One full review per PR. Only `blocking:` findings are fixed before merge; suggestions go into a
  follow-up issue.
- After fixes, a lean re-review of only the fix commits records `Verdict: approved`.
- Reviewers have reported tests passing while CI failed: always check CI yourself.

## Merge

Merge only when CI is green, the latest review says `Verdict: approved`, and every thread is resolved.
- **Rebase merge** (`gh pr merge <n> --rebase --delete-branch`) when every commit is clean.
- **Squash merge** with a Conventional Commit message and `Closes #N` when the branch has commits that must
  not reach `main`: red probes, fixtures a secret scanner flags, or merge commits.
- Git hooks are shared by every worktree (`.git/hooks`). After a merge, install hooks from the main clone
  (`npm run hooks:install`); workers never do.
- A gate proven red happens on a throwaway branch and draft PR that is closed unmerged, never on the task's
  PR. Link the red run in the task's PR and quote the key error lines.

## Closing a wave

- Tick the tasks in `docs/TASKS.md` through one small `chore(tasks)` PR per wave, then run the wave gate
  once the whole wave is merged.
- Each wave runs in a fresh coordinator session. When the gate passes and the user approves the next wave,
  start a new session with a short brief (board state, open PRs, budget rules) and hand off.
- Talk to the user only in Hebrew; everything in the repo stays English.
