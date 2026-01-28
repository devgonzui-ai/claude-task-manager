# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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