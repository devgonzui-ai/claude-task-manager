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

  private generateCustomCommandContent(): string {
    return `# /task - Claude Task Manager

Task management custom command for Claude Code.

## Usage

\`/task <action> [options]\`

## Actions

### Create New Task
\`/task new "<task name>" [--priority high|medium|low] [--tags tag1,tag2]\`

Creates a task and saves it to task.md file.

### Check Current Task
\`/task status\`

Shows current task and its progress.

### Execute Task
\`/task run\`

Executes current task with Claude Code using task.md content as context.

### Task History
\`/task history [--limit n]\`

Shows past and archived tasks.

### Archive Task
\`/task archive\`

Moves completed task to archive folder.

## Implementation

This command uses the \`claude-task\` CLI tool for task management.

### How to Process Commands

**IMPORTANT**: Follow these instructions to execute actual CLI commands using the Bash tool.

1. When \`/task new "task name"\` is executed:
   \`\`\`bash
   claude-task new "task name"
   \`\`\`
   - Execute this command using the Bash tool
   - Pass optional arguments appropriately (e.g., \`--priority high --tags auth,backend\`)

2. When \`/task status\` is executed:
   \`\`\`bash
   claude-task status
   \`\`\`
   - Execute this command using the Bash tool

3. When \`/task run\` is executed:
   - Reference the \`@task.md\` file content
   - Execute work according to the task content

4. When \`/task history\` is executed:
   \`\`\`bash
   claude-task history
   \`\`\`
   - Execute this command using the Bash tool
   - Add \`--limit\` option if provided

5. When \`/task archive\` is executed:
   \`\`\`bash
   claude-task archive
   \`\`\`
   - Execute this command using the Bash tool

### Process Flow

\`\`\`
User: /task new "Implement new feature"
↓
Claude: Execute \`claude-task new "Implement new feature"\` using Bash tool
↓
Display result
\`\`\`

## Examples

1. Create new task:
   \`\`\`
   /task new "Implement user authentication" --priority high --tags auth,backend
   \`\`\`
   -> Execute with Bash: \`claude-task new "Implement user authentication" --priority high --tags auth,backend\`

2. Check current task:
   \`\`\`
   /task status
   \`\`\`
   -> Execute with Bash: \`claude-task status\`

3. Execute task:
   \`\`\`
   /task run
   \`\`\`
   -> Reference @task.md and execute work according to content

4. View task history:
   \`\`\`
   /task history --limit 10
   \`\`\`
   -> Execute with Bash: \`claude-task history --limit 10\`

5. Archive completed task:
   \`\`\`
   /task archive
   \`\`\`
   -> Execute with Bash: \`claude-task archive\`

## Important Notes

- **All commands must be executed using the Bash tool to run actual \`claude-task\` CLI commands**
- Task names with spaces must be enclosed in quotes
- Only \`/task run\` requires special processing (reference @task.md and execute)`;
  }
}
