# Claude Task Manager

[![npm version](https://badge.fury.io/js/@gonzui%2Fclaude-task-manager.svg)](https://badge.fury.io/js/@gonzui%2Fclaude-task-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

日本語版: [README.ja.md](https://github.com/devgonzui-ai/claude-task-manager/blob/main/README.ja.md) をご覧ください。

A powerful task management extension for Claude Code that automates task tracking and execution.

## Features

- 📝 **Markdown-based Task Management**: Tasks are stored in `task.md` files that can be directly read by Claude Code
- 🚀 **Seamless Claude Code Integration**: Execute tasks directly through Claude Code with full context
- 🗂️ **Automatic Archiving**: Completed tasks are automatically archived with timestamps
- 🏷️ **Priority and Tags**: Organize tasks with priority levels (high/medium/low) and custom tags
- 📊 **Task History**: View and track all completed tasks
- 🎯 **Custom Commands**: Automatically creates `/task` custom command for Claude Code
- 🔌 **MCP Server**: Exposes task management to Claude Code as schema-bound MCP tools via `.mcp.json`
- 📟 **Statusline & Hooks**: Shows the current task in Claude Code's status line and injects it at session start (opt-in via `init --hooks`)
- 🔄 **Todo Reconciliation**: `task.md` stays the persistent source of truth; Claude Code's in-session todo list mirrors it one way
- 📦 **Plugin Packaging**: One-step install of the command + skill + hook + MCP server as a Claude Code plugin
- 📈 **Progress Tracking**: Visual progress bar for subtask completion
- 🤖 **AI Task Splitting**: Automatically break down tasks into subtasks using Claude

## Installation

### Global Installation (Recommended)
```bash
npm install -g @gonzui/claude-task-manager
```

### Local Installation
```bash
npm install @gonzui/claude-task-manager
```

## Usage

### Initialize Project
```bash
claude-task init
```

This command:
- Creates necessary directories (`archive/`, `.claude-tasks/`)
- Generates initial configuration
- Creates a starter `task.md` file
- If `.claude/commands/` exists, creates `/task` custom command
- Updates `.gitignore` to exclude task-related files

Options:
- `--hooks`: Also wire the current task into Claude Code's status line and
  session start (see [Statusline & SessionStart Hook](#statusline--sessionstart-hook))

**Git-like Directory Behavior**: 
- When you run any command, Claude Task Manager searches upward for a `.claude-tasks` directory (similar to how Git finds `.git`)
- If found, all operations use that project root, regardless of your current directory
- Example: If you `init` in `/project` and then `cd src/components && claude-task new`, the task will be created in `/project/`, NOT in `/project/src/components/`
- This ensures centralized task management across your entire project
- To create a separate task management in a subdirectory, explicitly specify the directory: `claude-task init .`

### Create New Task
```bash
claude-task new "Implement user authentication" --priority high --tags auth,backend
```

Options:
- `--priority`: Set task priority (high/medium/low, default: medium)
- `--tags`: Add comma-separated tags

### Check Current Task Status
```bash
claude-task status
```

Displays:
- Current task name
- Number of archived tasks
- Last execution time
- Total execution count

Options:
- `--short`: One-line output for statusline embedding, e.g. `Implement auth ▸ 60%`
  (title only when the task has no subtasks, `No task` when there is none)

### Execute Current Task
```bash
claude-task run
```

Executes the current task using Claude Code with `task.md` content as context.

Options:
- `-v, --verbose`: Show verbose output
- `-d, --debug`: Show debug information (command, file path, prompt)
- `--no-edit-permission`: Disable file edit permissions for Claude (default: edit permissions enabled)

**Note**: By default, Claude is executed with file edit permissions (`--dangerously-skip-permissions` flag) to allow complete task execution. Use `--no-edit-permission` if you want Claude to run in read-only mode.

### Work on Several Tasks
```bash
claude-task new "API rework" --name api   # create alongside the current task
claude-task list                          # list every task with its progress
claude-task switch api                    # make another task the active one
claude-task switch spike --create         # create it on the spot
```

One task is active at a time — it lives in `task.md`, exactly as before — but
several **named** tasks can coexist under `.claude-tasks/tasks/<name>.md`:

- `new --name <name>` creates a task **without archiving** the current one and
  switches to it. Plain `new` keeps its classic behavior (archive and replace).
- `switch <name>` saves the active task first, so nothing in progress is lost.
- `list` marks the active task with `*` and shows `done/total` per task.
- `status --short` (the statusline) becomes `[<name>] <title> ▸ <pct>%`.
- Nothing changes until you use one of these commands: existing single-task
  projects are migrated transparently the first time you create or switch to a
  named task.

### Record Progress Snapshots
```bash
claude-task snapshot            # append one line if progress changed
claude-task init --stop-hook    # let Claude Code do it automatically
```

`snapshot` records the current subtask progress in a managed block at the end
of `task.md`:

```markdown
<!-- claude-task:snapshots -->
- 2026-07-26 14:03 — 3/5 subtasks (60%)
- 2026-07-26 15:20 — 5/5 subtasks (100%)
<!-- /claude-task:snapshots -->
```

`init --stop-hook` wires it into Claude Code's `Stop` hook, so the trail is kept
without anyone asking. That hook fires **once per assistant turn**, so
`snapshot` only writes when the numbers actually changed and keeps the last 10
entries. Nothing outside the two markers is ever touched, nothing is archived,
and it always exits 0 — it can never block Claude from stopping.

The flag is separate from `--hooks` and can be combined with it
(`claude-task init --hooks --stop-hook`). It is deliberately **not** part of the
plugin: plugin hooks cannot be toggled per user, and this one writes to your
task file, so it stays opt-in through `init`.

### View Task History
```bash
claude-task history --limit 10
```

### Archive Current Task
```bash
claude-task archive
```

Moves the current task to the archive folder with a timestamp.

### Track Progress
```bash
claude-task progress
```

Displays a visual progress bar showing subtask completion status:
```
📊 Task Progress
================
Progress: [████████░░░░░░░░░░░░] 40%
Completed: 2/5 tasks
```

### Complete Subtasks
```bash
claude-task done 1 3      # mark subtasks 1 and 3 as done
claude-task done --undo 1 # uncheck subtask 1
```

Marks subtasks complete (or, with `--undo`, incomplete) by their number. The
numbers match the order shown by `claude-task progress`, and the updated
progress bar is printed afterwards.

### Split Task into Subtasks
```bash
claude-task split
claude-task split --count 5
```

Uses Claude AI to automatically break down your current task into actionable subtasks. The generated subtasks are added to your `task.md` file.

Options:
- `--count`: Specify the number of subtasks to generate (default: 3-7)

### Direct Claude Code Execution (deprecated)
```bash
claude-task claude "Review and optimize the database schema"
```

> **Deprecated:** `claude` only prints the task content. Use `claude-task run`
> to actually execute the current task with Claude Code.

## Claude Code Integration

### Plugin Installation (one step)

The repository doubles as a Claude Code plugin marketplace. Inside Claude Code:

```
/plugin marketplace add devgonzui-ai/claude-task-manager
/plugin install claude-task@gonzui-tools
```

The plugin bundles the `/task` slash command, the `task` skill, a
`SessionStart` hook (injects the current task into every new session), and the
MCP server (launched via `npx`, so no global npm install is required for it).

Two things still need a local step:

- The `claude-task` CLI itself (used by the command, skill, and hook) comes
  from npm: `npm install -g @gonzui/claude-task-manager`, then run
  `claude-task init` once per project to create `task.md` / `archive/`.
- Claude Code does not let plugins set the status line, so for the statusline
  either run `claude-task init --hooks` or add the `statusLine` entry from the
  [Statusline & SessionStart Hook](#statusline--sessionstart-hook) section to
  your settings yourself.

The plugin package lives in [`plugin/`](plugin/) and is regenerated from the
same sources as `init` (`npm run generate:plugin`), so both install paths
always ship identical content — a test fails if they drift.

### Custom Command, Skill & MCP Server (via `init`)

If you prefer not to use the plugin, `claude-task init` wires up the same
integrations per-project. After running it in a project that has a `.claude/`
directory, three integrations are generated automatically:

- A `/task` **slash command** at `.claude/commands/task.md`
- A **Skill** at `.claude/skills/task/SKILL.md`, so newer Claude Code versions
  can discover task management on their own.
- An **MCP server** registration in `.mcp.json`, exposing task management as
  schema-bound tools (see [MCP Server](#mcp-server) below).

The `/task` command lets you use the following directly within Claude Code:

#### Available Commands

- `/task new "Task name" [--priority high|medium|low] [--tags tag1,tag2]` - Create a new task
- `/task status` - Check current task status  
- `/task run` - Execute current task (displays task.md content for Claude Code to process)
- `/task history [--limit n]` - View task history
- `/task archive` - Archive completed task

#### Examples within Claude Code

```
/task new "Implement user authentication" --priority high --tags auth,backend
```

```
/task status
```

```
/task run
```

The custom command file is automatically generated in the language configured in your project settings (English or Japanese).

### MCP Server

The package ships a `claude-task-mcp` binary — a stdio [MCP](https://modelcontextprotocol.io) server that lets Claude Code manage tasks through typed, schema-validated tools instead of assembling CLI commands:

| Tool | Description |
| --- | --- |
| `task_new` | Create a new task (archives the current one first) |
| `task_status` | Show current task and execution stats |
| `task_progress` | Show subtask checkbox progress |
| `task_done` | Mark subtasks done by number (supports undo) |
| `task_split` | Split the task into subtasks using AI |
| `task_history` | List archived tasks |
| `task_archive` | Archive the current task |

`claude-task init` registers the server in your project's `.mcp.json` (safe to commit — Claude Code asks for approval before using project-scoped servers):

```json
{
  "mcpServers": {
    "claude-task": {
      "command": "claude-task-mcp",
      "args": []
    }
  }
}
```

If a `claude-task` entry already exists in `.mcp.json`, init leaves it untouched. All tools route through the same `TaskManager` core as the CLI, so both front-ends stay consistent.

### Statusline & SessionStart Hook

Run `claude-task init --hooks` to make the current task ambient in Claude Code.
It merges the following into `.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "claude-task status --short",
    "padding": 1
  },
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "claude-task status"
      }
    ]
  }
}
```

- **Statusline**: Claude Code's status bar shows the current task and progress,
  e.g. `Implement auth ▸ 60%`, refreshed as you work.
- **SessionStart hook**: the hook's stdout is injected as context, so every new
  session starts already knowing the current task — no need to ask.

Existing settings are preserved: a `statusLine` you already configured is left
untouched, your own `SessionStart` hooks are kept, and re-running
`init --hooks` never duplicates entries. Nothing is written unless you pass the
flag, and no hook performs destructive actions (archiving stays manual).

### task.md vs Claude Code's Todo List

Claude Code keeps its own in-session todo list. The two layers have distinct
roles and are kept in sync one way:

| Layer | Role |
| --- | --- |
| `task.md` (claude-task) | Persistent, file-based, cross-session **source of truth** |
| Claude Code todo list | Ephemeral in-session working mirror |

The generated skill, slash command, MCP tool descriptions, and the
`claude-task run` prompt all instruct Claude to:

1. Seed its in-session todo list from the unchecked subtasks in `task.md`
   (via `claude-task progress`) when starting work.
2. Persist each finished subtask with `claude-task done <n>` **before**
   checking off the mirrored todo.
3. Treat `task.md` as authoritative on any disagreement — re-seed the todo
   list from `claude-task progress`, never the other way around.

This removes double management: subtasks live in `task.md` and survive across
sessions, while the in-session list is just a live view of them.

### task.md Format
```markdown
# Task Title

**Created:** 2025-01-15 10:30:00  
**Priority:** high  
**Tags:** feature, backend

## Description
Detailed task description

## Tasks
- [ ] Subtask 1
- [ ] Subtask 2
- [ ] Subtask 3

## Context
<!-- Additional context for Claude Code -->

## Notes
<!-- Your notes here -->

---
*Generated by Claude Task Manager*
```

## Programmatic Usage

```typescript
import { TaskManager } from '@gonzui/claude-task-manager';

const taskManager = new TaskManager('/path/to/project');

// Initialize
await taskManager.init();

// Create new task
await taskManager.createNewTask({
  title: 'New Feature',
  description: 'Implement new feature',
  priority: 'high',
  tags: ['feature', 'urgent']
});

// Get status
const status = await taskManager.getStatus();

// Execute task
const result = await taskManager.runTask();
```

## Configuration

Configuration is stored in `.claude-tasks/config.json`:

```json
{
  "created": "2025-01-15T10:00:00.000Z",
  "taskTemplate": "...",
  "claudeCommand": "claude",
  "defaultTaskTitle": "New Task",
  "archiveDir": "archive",
  "language": "en",
  "defaultPrerequisites": [
    "<!-- Add prerequisites here -->"
  ],
  "defaultRules": [
    "<!-- Add rules here -->"
  ],
  "defaultTasks": [
    "Task 1",
    "Task 2",
    "Task 3"
  ]
}
```

### Array Configuration

Since v1.0.6, `defaultPrerequisites`, `defaultRules`, and `defaultTasks` support array format for easier editing:

```json
{
  "defaultPrerequisites": [
    "<!-- Add prerequisites here -->",
    "Required environment",
    "Required permissions",
    "Pre-setup steps"
  ]
}
```

This will be automatically converted to:
```markdown
## Prerequisites
<!-- Add prerequisites here -->
- Required environment
- Required permissions
- Pre-setup steps
```

### Language Settings

Claude Task Manager supports multiple languages (English and Japanese):

```bash
# Check current language
claude-task lang

# Change language to Japanese
claude-task lang ja

# Change language to English  
claude-task lang en
```

The language setting affects:
- CLI command outputs
- Task templates
- Custom command templates
- Error messages

## Requirements

- Node.js >= 18.0.0
- Claude Code CLI installed and configured

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Development mode
npm run dev -- [command]
```

## License

MIT

## Contributing

Contributions are welcome!

## Changelog

See [CHANGELOG.md](https://github.com/devgonzui-ai/claude-task-manager/blob/main/CHANGELOG.md) for the full release history.