# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.0] - 2026-07-25

### Added
- **Multiple named tasks and task switching.** A project can now hold several tasks side by side: `claude-task new "<title>" --name <name>` creates one *without* archiving the current task, `claude-task switch <name>` (with `--create`) changes the active task, and `claude-task list` (alias `ls`) shows every task with its subtask progress and marks the active one. Switching writes the active `task.md` back to its own store entry first, so in-progress subtask state is preserved on both sides.
- New `TaskStore` (`src/lib/TaskStore.ts`) owning `.claude-tasks/tasks/<name>.md` snapshots. `task.md` stays the live file of the active task, so every existing manager keeps working unchanged; the active task name is recorded as `activeTask` in `.claude-tasks/config.json`. Copies rather than symlinks, for Windows.
- MCP tools `task_switch` and `task_list`, plus an optional `name` argument on `task_new`, so Claude Code can manage parallel tasks without a Bash round-trip.
- `claude-task status` now reports the active task name, and `status --short` (the statusline) prefixes it as `[<name>] <title> ▸ <pct>%` in multi-task mode.

### Changed
- The generated `/task` slash command, the `task` skill, and the bundled plugin document `list` / `switch` / `new --name` (regenerated via `npm run generate:plugin`).
- `createNewTask()` no longer flattens actionable failures (e.g. a duplicate task name) into a generic create error — the specific error code is preserved.

### Compatibility
- Single-task projects are unaffected until they opt in: multi-task mode turns on the first time a named task is created or switched to, and that first use migrates the existing `task.md` into the store under a name derived from its title. No user action, no flag, no config edit.
- `claude-task new` without `--name` keeps its classic behavior (archive the current task and replace it); in multi-task mode it reuses the active slot, so existing names stay valid.

## [1.6.2] - 2026-07-15

### Fixed
- Flaky CI failure where `status` printed English right after `lang ja` (seen once on Node 18): `TaskManager`'s constructor fired an un-awaited `i18n.init('en')` whose `en.json` read could resolve *after* a later `init('ja')`, overwriting the Japanese messages. `I18n.loadMessages()` now discards stale loads (a load only lands if the language is still current), and the constructor fallback initializes synchronously. Added a deterministic regression test (`i18n.test.ts`) that gates the `en.json` read to force the race.

## [1.6.1] - 2026-07-12

### Fixed
- The plugin failed to load ("Duplicate hooks file detected") because `plugin.json` explicitly referenced `./hooks/hooks.json` and `./.mcp.json`, which Claude Code already auto-loads from their standard locations — so they were loaded twice. The manifest no longer references them; verified end-to-end with `/plugin marketplace add` + `/plugin install` on Claude Code 2.1.207.

## [1.6.0] - 2026-07-04

### Added
- **Claude Code plugin packaging**: the repo now doubles as a plugin marketplace (`.claude-plugin/marketplace.json`) hosting a `claude-task` plugin (`plugin/`) that bundles the `/task` slash command, the `task` skill, the `SessionStart` hook, and the MCP server (launched via `npx -y -p @gonzui/claude-task-manager claude-task-mcp` with `cwd: ${CLAUDE_PROJECT_DIR}`, so no global install is needed for it). Install with `/plugin marketplace add devgonzui-ai/claude-task-manager` + `/plugin install claude-task@gonzui-tools`. The statusline cannot be plugin-provided (user-settings-only in Claude Code), so it stays with `init --hooks` / manual wiring.
- `npm run generate:plugin` regenerates the plugin from the same sources as `claude-task init` (command/skill content from `CustomCommandGenerator`, hook entry from a shared constant), and a new drift-guard test suite (`plugin.test.ts`) fails whenever the checked-in plugin files no longer match the generators.
- `claude-task init` remains fully supported as the non-plugin install path.

### Fixed
- Scoped the repo's `.gitignore` patterns (`/task.md`, `/archive/`, `/task.*.md`) to the repository root so the bundled `plugin/commands/task.md` can be committed.

## [1.5.0] - 2026-07-04

### Added
- **Native todo reconciliation**: a documented, one-way sync between `task.md` (the persistent, cross-session source of truth) and Claude Code's ephemeral in-session todo list. The generated skill and `/task` slash command, the MCP `task_progress` / `task_done` tool descriptions, and the `claude-task run` prompt now all instruct Claude to seed its in-session todos from the unchecked subtasks, persist each completion with `claude-task done <n>` before checking off the mirror, and re-seed from `claude-task progress` on any disagreement — eliminating double management between the two layers.
- README sections (en/ja) documenting the layer split.

### Changed
- The `claude-task run` prompt is now built by an exported `buildRunPrompt()` so tests assert against the exact string sent to the `claude` CLI.

## [1.4.0] - 2026-07-03

### Added
- `claude-task status --short`: one-line output for statusline embedding, e.g. `Implement auth ▸ 60%` (title only when the task has no subtasks, a localized `No task` marker when there is none).
- `claude-task init --hooks`: opt-in flag that merges a Claude Code `statusLine` entry (`claude-task status --short`) and a `SessionStart` hook (`claude-task status`, whose stdout is injected as session context) into `.claude/settings.json`. Existing user settings are preserved — a configured `statusLine` is never overwritten, user `SessionStart` hooks are kept, and re-running the flag never duplicates entries. Nothing is written without the flag, and no hook performs destructive actions (archiving stays manual).
- CLI tests covering `status --short` (progress, no-subtask, no-task, Japanese locale) and `init --hooks` (generation, merge-preservation, idempotency).

## [1.3.1] - 2026-07-03

### Fixed
- The inline changelog sections in README.md and README.ja.md were stale (stuck at v1.1.0), which made the npm package page appear to have no releases after 1.1.0 — npm renders the README, not CHANGELOG.md. Both sections are now a link to CHANGELOG.md so the npm page can never drift again.

## [1.3.0] - 2026-07-03

### Added
- **MCP server** (`claude-task-mcp`): a new stdio binary that exposes task management to Claude Code as schema-bound MCP tools — `task_new`, `task_status`, `task_progress`, `task_done`, `task_split`, `task_history`, `task_archive`. All tools route through the same `TaskManager` as the CLI, and tool inputs are validated with zod schemas, eliminating argument drift from hand-assembled Bash commands.
- `claude-task init` now registers the MCP server in the project's `.mcp.json` (project scope, intended to be committed) when a `.claude/` directory exists — the same gating as the `/task` command and skill generation. Existing `.mcp.json` entries, including a user-customized `claude-task` entry, are never overwritten.
- MCP server tests driving the real server through the SDK's `InMemoryTransport` and an MCP client, asserting against actual `task.md` changes.

### Fixed
- `claude-task init` now adds the generated `.claude/skills/task/` skill directory to `.gitignore`. The skill file was introduced in 1.2.0 but the `.gitignore` entries were never updated to cover it.

## [1.2.0] - 2026-06-27

### Added
- `done` command to complete subtasks by number, e.g. `claude-task done 1 3` (use `--undo` to uncheck). Numbers match the order shown by `progress`, and the updated progress bar is printed afterwards. This pairs with `progress`, which previously could read checkboxes but offered no way to toggle them.
- `claude-task init` now also generates a Claude Code **Skill** at `.claude/skills/task/SKILL.md` (in addition to the `/task` slash command) when a `.claude` directory exists, so newer Claude Code versions can discover task management automatically.
- Tests for the `progress`, `done`, `claude`, and `archive` CLI commands.
- Unit tests for `ProgressTracker` (including the new completion toggling) and `TaskSplitter` (the latter mocks the Claude CLI so it never invokes the real binary).
- Locale parity tests ensuring `en.json` and `ja.json` always define the same keys and never ship empty values.
- Regression tests ensuring `--help` and `progress` output never leak raw i18n keys.

### CI
- Switched npm publish from long-lived `NPM_TOKEN` to OIDC Trusted Publishing (no secrets required).

### Changed
- The generated `/task` slash command was modernized for accuracy: it now uses Claude Code frontmatter (`description` / `argument-hint` / `allowed-tools`), passes arguments through verbatim via `$ARGUMENTS` instead of asking Claude to re-derive the CLI call, and special-cases `run` / `split` so they don't trigger a nested `claude` invocation. This replaces the long prose template that relied on the model interpreting instructions.
- The `claude` command is now deprecated. It still prints the task content but shows a notice pointing to `claude-task run`, which actually executes the task with Claude Code.

### Fixed
- `new` now uses `config.defaultTaskTitle` when no title is given, instead of always falling back to a timestamped `Task <date>` title. The configured default title was previously ignored entirely.
- `--help` now shows localized command descriptions instead of raw i18n keys (e.g. `commands.init.description`). i18n is now initialized synchronously at startup so descriptions are translated before commander builds the help output.
- `progress` command output is now fully localized. The header and task count were hardcoded in English; `ProgressTracker` now uses i18n (new `progress.title` / `progress.count` keys) and the previously unused `progress.noTasks` translation.

## [1.1.1] - 2026-01-28

### Removed
- `hooks` command and related functionality
- HooksManager.ts module
- All hooks-related i18n translations

### Changed
- Removed hooks integration from TaskManager.ts
- Updated README and README.ja.md to remove hooks documentation
- Increased split command timeout from 60 seconds to 5 minutes

### Fixed
- Split command now passes prompt via stdin instead of command-line argument for proper Claude CLI compatibility
- Improved error message for Claude API limit - now shows clear message when limit is reached

### Reason for Removal
Claude Code's hooks system underwent a breaking format change. The old hooks system supported CLI command-based hooks (e.g., `postExec`), but the new system only supports tool-based hooks (PreToolUse, PostToolUse, etc.). Since claude-task-manager's hooks were designed to run after CLI commands (like `claude-task run`, `claude-task new`), they are no longer compatible with the new hooks format. Users who need similar functionality should configure hooks manually using the new format in `.claude/settings.json`.

## [1.1.0] - 2026-01-24

### Added
- `progress` command to track subtask completion with visual progress bar
- `split` command to automatically break down tasks into subtasks using AI (Claude CLI)
- 60-second timeout for Claude CLI calls in split command

### Changed
- Major code refactoring: Split TaskManager.ts (865 lines) into focused modules
  - ConfigManager.ts - Configuration management
  - TaskFileManager.ts - Task file CRUD operations
  - ClaudeExecutor.ts - Claude CLI execution logic
  - HistoryManager.ts - History and status management
  - CustomCommandGenerator.ts - Custom command generation
  - ProgressTracker.ts - Progress tracking
  - TaskSplitter.ts - AI-powered task splitting
- Updated Node.js requirement to >= 18.0.0
- Improved type safety: Replaced `any` types with proper types
- Made `setLanguage` method async for consistency

### Fixed
- Split command now properly handles Claude CLI timeout
- Removed unused TypeScript decorator options from tsconfig.json

## [1.0.8] - 2025-08-04

### Added
- `archive` command to manually archive current task

### Changed
- Custom command file (`/task`) now generated in English for better Claude Code compatibility
- Improved custom command instructions to explicitly use Bash tool for execution
- `/task run` command simplified to use `@task.md` reference

### Fixed
- `/task new` command now properly creates new tasks through actual CLI execution

## [1.0.7] - 2025-07-25

### Fixed
- Documentation dates corrected from 2024 to 2025

## [1.0.6] - 2025-07-25

### Added
- Task template now includes Prerequisites and Rules sections
- Support for array format in config.json for `defaultPrerequisites`, `defaultRules`, and `defaultTasks` for easier editing
- `--dangerously-skip-permissions` flag by default for `claude-task run` to enable file edit permissions
- `--no-edit-permission` option for `claude-task run` to disable file edit permissions

### Changed
- Improved language detection from environment variables (LANG) during initialization
- Enhanced language switching to update defaults appropriately
- Updated archive filename format to include milliseconds to prevent overwrites
- Task items no longer include checkboxes by default (changed from `- [ ] Task` to `- Task`)

### Fixed
- Template variable replacement now works correctly for both English and Japanese
- Language-specific defaults are properly set when switching languages

## [1.0.5] - 2025-07-24

### Added
- `--debug` flag for `claude-task run` command to show detailed execution information
- Comprehensive tests for the run command

### Changed
- Fixed `claude-task run` command to properly execute tasks with Claude
- Changed from absolute to relative paths in Claude prompts for better readability
- Updated npm publish workflow to use tag-based triggers instead of automatic version bumping
- Use `--print` flag for non-interactive Claude execution

### Fixed
- Default claude command updated from 'claude code' to 'claude'
- Task execution now properly exits after completion

### Removed
- Automatic version bump workflow (version-bump.yml)

## [1.0.4] - 2025-07-23

### Fixed
- Various bug fixes and improvements

## [1.0.3] - 2025-07-23

### Fixed
- Various bug fixes and improvements

## [1.0.2] - 2025-07-23

### Fixed
- Dynamic version reading from package.json for accurate version display

## [1.0.1] - 2025-07-23

### Fixed
- Create .claude/commands directory when .claude exists during init

### Improved
- Claude Code custom command generation

## [1.0.0] - 2025-07-23

### Added
- Initial release
- Task management with archiving and history
- Multi-language support (English/Japanese)
- Git-like directory behavior for finding project root
- Claude Code integration with custom commands
- Automatic .gitignore updates
- Priority levels (high/medium/low) for tasks
- Tag support for task categorization
- TypeScript implementation with full type safety