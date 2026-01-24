import * as fs from 'fs-extra';
import * as path from 'path';
import { I18n } from './i18n';

export interface HooksConfig {
  onTaskComplete?: boolean;
  onTaskCreate?: boolean;
  onTaskArchive?: boolean;
}

export class HooksManager {
  private workingDir: string;
  private i18n: I18n;

  constructor(workingDir: string, i18n: I18n) {
    this.workingDir = workingDir;
    this.i18n = i18n;
  }

  async setupHooks(config: HooksConfig = {}): Promise<void> {
    const settingsPath = path.join(this.workingDir, '.claude', 'settings.json');

    // Ensure .claude directory exists
    await fs.ensureDir(path.join(this.workingDir, '.claude'));

    // Read existing settings or create new
    let settings: Record<string, unknown> = {};
    if (await fs.pathExists(settingsPath)) {
      try {
        settings = await fs.readJson(settingsPath);
      } catch {
        settings = {};
      }
    }

    // Add hooks configuration
    const hooks: Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }> = [];

    // Hook for task completion (when run command succeeds)
    if (config.onTaskComplete !== false) {
      hooks.push({
        matcher: 'claude-task run',
        hooks: [
          {
            type: 'postExec',
            command: 'echo "Task execution completed at $(date)"'
          }
        ]
      });
    }

    // Hook for task creation
    if (config.onTaskCreate !== false) {
      hooks.push({
        matcher: 'claude-task new',
        hooks: [
          {
            type: 'postExec',
            command: 'claude-task progress'
          }
        ]
      });
    }

    // Hook for task archiving
    if (config.onTaskArchive !== false) {
      hooks.push({
        matcher: 'claude-task archive',
        hooks: [
          {
            type: 'postExec',
            command: 'claude-task status'
          }
        ]
      });
    }

    settings.hooks = hooks;

    await fs.writeJson(settingsPath, settings, { spaces: 2 });
  }

  async getHooksStatus(): Promise<{
    configured: boolean;
    hooksCount: number;
    hooks: string[];
  }> {
    const settingsPath = path.join(this.workingDir, '.claude', 'settings.json');

    if (!await fs.pathExists(settingsPath)) {
      return { configured: false, hooksCount: 0, hooks: [] };
    }

    try {
      const settings = await fs.readJson(settingsPath);
      const hooks = settings.hooks || [];
      return {
        configured: hooks.length > 0,
        hooksCount: hooks.length,
        hooks: hooks.map((h: { matcher: string }) => h.matcher)
      };
    } catch {
      return { configured: false, hooksCount: 0, hooks: [] };
    }
  }

  generateHooksTemplate(): string {
    return `# Claude Code Hooks for Task Manager

This file explains the hooks that have been configured for your project.

## Configured Hooks

### Post-Execution Hooks

1. **After \`claude-task run\`**
   - Logs completion timestamp
   - Can be customized to trigger notifications, commits, etc.

2. **After \`claude-task new\`**
   - Shows task progress automatically

3. **After \`claude-task archive\`**
   - Shows task status automatically

## Customization

Edit \`.claude/settings.json\` to customize hooks:

\`\`\`json
{
  "hooks": [
    {
      "matcher": "claude-task run",
      "hooks": [
        {
          "type": "postExec",
          "command": "your-custom-command"
        }
      ]
    }
  ]
}
\`\`\`

## Available Hook Types

- \`preExec\`: Runs before the command
- \`postExec\`: Runs after the command completes successfully

## Example Custom Hooks

### Auto-commit after task completion
\`\`\`json
{
  "matcher": "claude-task archive",
  "hooks": [
    {
      "type": "postExec",
      "command": "git add -A && git commit -m 'Task completed'"
    }
  ]
}
\`\`\`

### Send notification
\`\`\`json
{
  "matcher": "claude-task run",
  "hooks": [
    {
      "type": "postExec",
      "command": "notify-send 'Task Manager' 'Task execution completed'"
    }
  ]
}
\`\`\`
`;
  }
}
