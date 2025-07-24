# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.5] - 2024-07-24

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

## [1.0.4] - 2024-07-23

### Fixed
- Various bug fixes and improvements

## [1.0.3] - 2024-07-23

### Fixed
- Various bug fixes and improvements

## [1.0.2] - 2024-07-23

### Fixed
- Dynamic version reading from package.json for accurate version display

## [1.0.1] - 2024-07-23

### Fixed
- Create .claude/commands directory when .claude exists during init

### Improved
- Claude Code custom command generation

## [1.0.0] - 2024-07-23

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