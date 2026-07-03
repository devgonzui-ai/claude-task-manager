---
name: task
description: Manage development tasks with the claude-task CLI. Use when the user wants to create, run, track, split, complete, or archive tasks, or asks about the current task / task progress. Tasks live in task.md.
metadata:
  source: claude-task-manager
---

# Task Management (claude-task)

This skill drives the `claude-task` CLI, which manages a `task.md` file and an
`archive/` history. Run the commands below with the Bash tool and report the
output back to the user.

## When to use

- The user wants to start, track, or finish a unit of work.
- The user asks "what's the current task?", "how far along am I?", or similar.
- The user mentions task.md, subtasks, or task history.

## Commands

| Intent | Command |
| --- | --- |
| Create a task | `claude-task new "<title>" [--priority high|medium|low] [--tags a,b]` |
| Show current task / counts | `claude-task status` |
| Show subtask progress bar | `claude-task progress` |
| Complete subtask(s) | `claude-task done <n> [<n> ...]` (use `--undo` to uncheck) |
| Split a task into subtasks (AI) | `claude-task split [-c <count>]` |
| Show history | `claude-task history [--limit <n>]` |
| Archive current task | `claude-task archive` |

## Executing a task

To actually do the work described in the current task, read `@task.md` and carry
out the steps yourself. `claude-task run` exists, but inside a Claude Code session
prefer reading `@task.md` directly and editing the relevant files. As you finish
each subtask, mark it complete with `claude-task done <n>`.

## task.md vs your in-session todo list

`task.md` is the **persistent, cross-session source of truth**; your in-session
todo list is an **ephemeral working mirror** of it. To keep them from conflicting:

- When you start working on the current task, run `claude-task progress` and
  seed your todo list from the unchecked subtasks (keep their numbering).
- When you finish a subtask, persist it first with `claude-task done <n>`, then
  check off the mirrored todo. Never update only the in-session list.
- Add or reword subtasks by editing the checkboxes in `task.md` (or via
  `claude-task split`), not only in the in-session list.
- If the two ever disagree, `task.md` wins — re-seed your todo list from
  `claude-task progress`.

## Notes

- Quote titles that contain spaces.
- Subtask numbers in `done` match the order shown by `claude-task progress`.
- Only one task is active at a time; creating a new task archives the previous one.
