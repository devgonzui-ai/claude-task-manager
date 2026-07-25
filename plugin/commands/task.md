---
description: Manage tasks with the claude-task CLI
argument-hint: <new|list|switch|status|progress|done|split|history|archive|run> [options]
allowed-tools: Bash(claude-task:*), Read, Edit
---

# /task — Claude Task Manager

The user ran: `/task $ARGUMENTS`

## Actions

- `/task new "<title>" [--priority high|medium|low] [--tags a,b]` — create a task
  (archives the current one; add `--name <name>` to create it alongside instead)
- `/task list` — list all tasks with their progress
- `/task switch <name>` — make another task active (`--create` to start it)
- `/task status` — show the current task and counts
- `/task progress` — show the subtask progress bar
- `/task done <numbers...>` — mark subtasks done (`--undo` to uncheck)
- `/task split [--count n]` — break the task into subtasks (uses AI)
- `/task history [--limit n]` — show task history
- `/task archive` — archive the current task
- `/task run` — execute the current task

## How to handle this invocation

Pass arguments through **verbatim** — never rewrite, reorder, or drop flags.

- **run** (or no argument): do NOT shell out to `claude-task run`. Instead read
  the current `task.md`, seed your in-session todo list from its unchecked
  checkboxes, and carry out the work yourself. As you finish each subtask,
  persist it with `claude-task done <n>` first, then check off the mirrored
  todo. `task.md` is the source of truth — if it and your todo list disagree,
  re-seed from `claude-task progress`.
- **split**: run `claude-task split $ARGUMENTS`. It calls Claude in the
  background to generate subtasks, so it may take a moment — this is expected.
- **everything else** (new / list / switch / status / progress / done / history /
  archive): run
  `claude-task $ARGUMENTS` with the Bash tool and report the output to the user.

Quote titles that contain spaces. Subtask numbers for `done` match the order
shown by `/task progress`.