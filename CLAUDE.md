# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

claude-task-manager is a TypeScript-based CLI tool/npm package that automates task management for Claude Code. It manages tasks through task.md files and enables efficient task execution through integration with Claude Code.

## Development Commands

### Build and Test
```bash
npm run build            # Compile TypeScript (output to dist/)
npm test                 # Run Jest tests
npm run watch            # Watch files and auto-build
npm run generate:plugin  # Regenerate plugin/ + .claude-plugin/marketplace.json
```

### CLI Execution in Development
```bash
npm run dev -- init                    # Initialize project
npm run dev -- init --hooks            # ...and wire CC statusline + SessionStart hook
npm run dev -- new "Task name"         # Create new task
npm run dev -- new "Task" --name api   # Create a named task without archiving, and switch to it
npm run dev -- list                    # List all tasks (alias: ls)
npm run dev -- switch api              # Switch the active task (--create to make it)
npm run dev -- run                     # Execute current task
npm run dev -- history                 # Show history
npm run dev -- status                  # Check status
npm run dev -- status --short          # One-line statusline output ([<name>] <title> ▸ <pct>%)
npm run dev -- progress                # Subtask progress bar
npm run dev -- done 1 2                # Complete subtasks by number (--undo to uncheck)
npm run dev -- split                   # AI-split task into subtasks
npm run dev -- lang                    # Check/change language
```

### Running Individual Tests
```bash
npm test -- TaskManager.test.ts        # Run specific test file
npm test -- --watch                    # Run tests in watch mode
```

## Architecture

### Directory Structure
- `src/bin/claude-task.ts`: CLI entry point. Defines CLI commands using commander
- `src/bin/claude-task-mcp.ts`: MCP server entry point (stdio, bin `claude-task-mcp`)
- `src/lib/TaskManager.ts`: Facade over the focused managers below; all task operations (CLI, MCP, plugin) route through it
- `src/lib/ConfigManager.ts`: `.claude-tasks/config.json` handling + language detection
- `src/lib/TaskFileManager.ts`: task.md CRUD and archiving
- `src/lib/TaskStore.ts`: named tasks (`.claude-tasks/tasks/<name>.md`) — switching, listing, transparent migration from single-task mode
- `src/lib/ClaudeExecutor.ts`: spawns the `claude` CLI for `run` (prompt built by exported `buildRunPrompt()`)
- `src/lib/HistoryManager.ts`: archive history and status
- `src/lib/CustomCommandGenerator.ts`: generates the `/task` command, `task` skill, `.mcp.json`, and (behind `init --hooks`) statusline + SessionStart hook config; exports the shared hook/statusline entry constants
- `src/lib/ProgressTracker.ts`: subtask checkbox parsing, progress bar, `done` toggling
- `src/lib/TaskSplitter.ts`: AI subtask splitting via the `claude` CLI
- `src/lib/McpServer.ts`: MCP server exposing 9 zod-typed tools wrapping TaskManager
- `src/lib/i18n.ts`: Internationalization system supporting English and Japanese
- `src/types/index.ts`: TypeScript type definitions. Defines types like Task, TaskStatus, TaskPriority
- `src/locales/`: Language files (en.json, ja.json) — keep key parity, `locales.test.ts` enforces it
- `src/index.ts`: Entry point as npm package
- `scripts/generate-plugin.ts`: regenerates `plugin/` and `.claude-plugin/marketplace.json` from the same sources as `init` (run via `npm run generate:plugin`)
- `plugin/`: the installable Claude Code plugin (command, skill, SessionStart hook, MCP via npx). Do not edit by hand — regenerate; `plugin.test.ts` fails on drift
- `.claude-plugin/marketplace.json`: makes this repo a Claude Code plugin marketplace (name `gonzui-tools`, plugin source `./plugin`)

### Key Design Patterns
1. **TaskManager facade**: central entry for all task operations; CLI, MCP server, and plugin all route through it so front-ends stay consistent
2. **Named tasks**: `task.md` is always the live file of the *active* task; `TaskStore` keeps per-name snapshots in `.claude-tasks/tasks/<name>.md` and the active name in `config.activeTask`. Multi-task mode is on iff that directory exists, so single-task projects are untouched until the first `new --name` / `switch` migrates them
3. **task.md file**: Stores tasks in Markdown format. Directly readable by Claude Code — the persistent, cross-session source of truth; Claude Code's in-session todo list is only an ephemeral mirror of it (seeded from `progress`, persisted via `done`)
4. **Automatic archiving**: Old tasks are saved in `archive/` folder with timestamps
5. **Claude Code integration surfaces**: `/task` slash command, `task` skill, MCP server (`.mcp.json`), opt-in statusline + SessionStart hook (`init --hooks`), and the plugin — all generated from `CustomCommandGenerator`, gated on `.claude/` existing (except `--hooks`, which is explicit)
6. **Plugin/init no-drift rule**: the plugin bundles byte-identical command/skill content as `init`; after changing generated content, run `npm run generate:plugin` and commit, or `plugin.test.ts` fails
7. **Internationalization**: Supports multiple languages (English/Japanese) with configurable language settings

### Important Implementation Details
- Uses TypeScript strict mode
- Abstracts file system operations with fs-extra
- Colors terminal output with chalk
- Standardizes date handling with date-fns
- Builds CLI commands with commander
- Implements i18n with custom localization system

## Claude Code Custom Commands

When you run `claude-task init` in a project with a `.claude/` directory, `CustomCommandGenerator` creates a `/task` slash command (`.claude/commands/task.md`), a `task` skill (`.claude/skills/task/SKILL.md`), and registers the MCP server in `.mcp.json`. This enables the following within Claude Code:

- `/task new "task name"` - Create a new task
- `/task status` - Check current task status
- `/task list` / `/task switch <name>` - List tasks and switch the active one
- `/task progress` / `/task done <n>` - Track and complete subtasks
- `/task run` - Execute current task (uses task.md content as context)
- `/task history` - Show task history
- `/task archive` - Archive completed task

The same integration ships as an installable plugin: `/plugin marketplace add devgonzui-ai/claude-task-manager` + `/plugin install claude-task@gonzui-tools`. The statusline cannot be plugin-provided (user-settings-only in Claude Code) and comes from `claude-task init --hooks` instead.

## Testing Requirements

### **CRITICAL: Always Run Tests Before Committing**

**Never commit code without running tests. A task is NOT complete unless all tests pass.**

#### Before Every Commit:
1. Run all tests:
   ```bash
   npm test
   ```
2. If any test fails, fix the issue before proceeding
3. Run tests again to confirm the fix
4. Only commit when all tests pass

#### After Implementation:
1. Run specific test files related to your changes:
   ```bash
   npm test -- TaskManager.test.ts
   npm test -- run-command.test.ts
   ```
2. Run all tests to ensure no regressions:
   ```bash
   npm test
   ```
3. If tests fail, the implementation is NOT complete

#### Test-Driven Development:
- Write tests for new features before implementation
- Update existing tests when changing behavior
- Never skip or disable tests without proper justification

#### Common Test Issues:
- **i18n initialization**: Ensure i18n is initialized before using translations
- **File system operations**: Clean up test directories in afterEach
- **Async operations**: Always use async/await properly
- **Mock cleanup**: Reset mocks between tests

## Release Process

### **CRITICAL: Before Creating a Release Tag**

**Always update the following files before creating a tag:**

1. **package.json** - Update the version number
   ```json
   {
     "version": "1.0.5"
   }
   ```

2. **CHANGELOG.md** - Add entry for the new version
   ```markdown
   ## [1.0.5] - 2024-07-24
   
   ### Added
   - New features...
   
   ### Changed
   - Changes...
   
   ### Fixed
   - Bug fixes...
   ```

### Release Steps

1. Update version in package.json
2. Update CHANGELOG.md with all changes
3. Update README files if needed (README.md, README.ja.md)
4. Commit all changes
5. Push to main branch
6. Create and push tag:
   ```bash
   git tag v1.0.5
   git push origin v1.0.5
   ```

### Important Notes
- Tag version must match package.json version exactly
- Tag must be prefixed with 'v' (e.g., v1.0.5)
- GitHub Actions will automatically publish to npm when tag is pushed
- Once published to npm, versions cannot be unpublished