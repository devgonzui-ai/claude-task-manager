import * as fs from 'fs-extra';
import * as path from 'path';
import { I18n } from './i18n';

export class CustomCommandGenerator {
  private workingDir: string;
  private i18n: I18n;

  constructor(workingDir: string, i18n: I18n) {
    this.workingDir = workingDir;
    this.i18n = i18n;
  }

  async createClaudeCustomCommand(): Promise<void> {
    const claudeDir = path.join(this.workingDir, '.claude');
    const claudeCommandsDir = path.join(claudeDir, 'commands');

    try {
      if (await fs.pathExists(claudeDir)) {
        await fs.ensureDir(claudeCommandsDir);

        const taskCommandPath = path.join(claudeCommandsDir, 'task.md');
        const taskCommandContent = this.generateCustomCommandContent();

        await fs.writeFile(taskCommandPath, taskCommandContent);
        console.log(this.i18n.t('commands.init.customCommand'));
      }
    } catch (error) {
      console.warn('Could not create Claude custom command:', error);
    }
  }

  /**
   * Create a Claude Code Skill (.claude/skills/task/SKILL.md) so newer Claude
   * Code versions can discover task management automatically. Created only when
   * a .claude directory already exists, mirroring the slash command behavior.
   */
  async createClaudeSkill(): Promise<void> {
    const claudeDir = path.join(this.workingDir, '.claude');
    const skillDir = path.join(claudeDir, 'skills', 'task');

    try {
      if (await fs.pathExists(claudeDir)) {
        await fs.ensureDir(skillDir);

        const skillPath = path.join(skillDir, 'SKILL.md');
        await fs.writeFile(skillPath, this.generateSkillContent());
        console.log(this.i18n.t('commands.init.skill'));
      }
    } catch (error) {
      console.warn('Could not create Claude skill:', error);
    }
  }

  private generateSkillContent(): string {
    return `---
name: task
description: Manage development tasks with the claude-task CLI. Use when the user wants to create, run, track, split, complete, or archive tasks, or asks about the current task / task progress. Tasks live in task.md.
metadata:
  source: claude-task-manager
---

# Task Management (claude-task)

This skill drives the \`claude-task\` CLI, which manages a \`task.md\` file and an
\`archive/\` history. Run the commands below with the Bash tool and report the
output back to the user.

## When to use

- The user wants to start, track, or finish a unit of work.
- The user asks "what's the current task?", "how far along am I?", or similar.
- The user mentions task.md, subtasks, or task history.

## Commands

| Intent | Command |
| --- | --- |
| Create a task | \`claude-task new "<title>" [--priority high|medium|low] [--tags a,b]\` |
| Show current task / counts | \`claude-task status\` |
| Show subtask progress bar | \`claude-task progress\` |
| Complete subtask(s) | \`claude-task done <n> [<n> ...]\` (use \`--undo\` to uncheck) |
| Split a task into subtasks (AI) | \`claude-task split [-c <count>]\` |
| Show history | \`claude-task history [--limit <n>]\` |
| Archive current task | \`claude-task archive\` |

## Executing a task

To actually do the work described in the current task, read \`@task.md\` and carry
out the steps yourself. \`claude-task run\` exists, but inside a Claude Code session
prefer reading \`@task.md\` directly and editing the relevant files. As you finish
each subtask, mark it complete with \`claude-task done <n>\`.

## Notes

- Quote titles that contain spaces.
- Subtask numbers in \`done\` match the order shown by \`claude-task progress\`.
- Only one task is active at a time; creating a new task archives the previous one.
`;
  }

  private generateCustomCommandContent(): string {
    return `---
description: Manage tasks with the claude-task CLI
argument-hint: <new|status|progress|done|split|history|archive|run> [options]
allowed-tools: Bash(claude-task:*), Read, Edit
---

# /task — Claude Task Manager

The user ran: \`/task $ARGUMENTS\`

## Actions

- \`/task new "<title>" [--priority high|medium|low] [--tags a,b]\` — create a task
- \`/task status\` — show the current task and counts
- \`/task progress\` — show the subtask progress bar
- \`/task done <numbers...>\` — mark subtasks done (\`--undo\` to uncheck)
- \`/task split [--count n]\` — break the task into subtasks (uses AI)
- \`/task history [--limit n]\` — show task history
- \`/task archive\` — archive the current task
- \`/task run\` — execute the current task

## How to handle this invocation

Pass arguments through **verbatim** — never rewrite, reorder, or drop flags.

- **run** (or no argument): do NOT shell out to \`claude-task run\`. Instead read
  the current \`task.md\`, carry out the work yourself, and mark each subtask done
  with \`claude-task done <n>\` as you finish it.
- **split**: run \`claude-task split $ARGUMENTS\`. It calls Claude in the
  background to generate subtasks, so it may take a moment — this is expected.
- **everything else** (new / status / progress / done / history / archive): run
  \`claude-task $ARGUMENTS\` with the Bash tool and report the output to the user.

Quote titles that contain spaces. Subtask numbers for \`done\` match the order
shown by \`/task progress\`.`;
  }
}
