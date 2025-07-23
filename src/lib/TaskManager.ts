import * as fs from 'fs-extra';
import * as path from 'path';
import { format } from 'date-fns';
import { spawn, SpawnOptionsWithStdioTuple, StdioOptions } from 'child_process';
import {
  TaskConfig,
  TaskOptions,
  TaskMetadata,
  TaskHistoryItem,
  TaskStatus,
  ExecutionResult,
  TemplateVariables,
  ClaudeTaskManagerConfig,
  TaskManagerError,
  ClaudeExecutionError,
  FileSystemError
} from '../types';
import { I18n, Language } from './i18n';

export class TaskManager {
  private config: ClaudeTaskManagerConfig;
  private i18n: I18n;

  constructor(workingDir: string = process.cwd()) {
    this.config = {
      workingDir,
      taskFile: path.join(workingDir, 'task.md'),
      archiveDir: path.join(workingDir, 'archive'),
      configDir: path.join(workingDir, '.claude-tasks'),
      configFile: path.join(workingDir, '.claude-tasks', 'config.json')
    };
    this.i18n = I18n.getInstance();
  }

  async init(): Promise<void> {
    try {
      // Create necessary directories
      await fs.ensureDir(this.config.archiveDir);
      await fs.ensureDir(this.config.configDir);

      // Create config file if it doesn't exist
      if (!await fs.pathExists(this.config.configFile)) {
        const defaultConfig: TaskConfig = {
          created: new Date().toISOString(),
          taskTemplate: this.getDefaultTaskTemplate(),
          claudeCommand: 'claude code',
          defaultTaskTitle: 'New Task',
          archiveDir: 'archive',
          language: 'en'
        };
        await fs.writeJson(this.config.configFile, defaultConfig, { spaces: 2 });
      }

      // Initialize i18n with configured language
      const config = await this.getConfig();
      await this.i18n.init(config.language || 'en');

      // Create initial task file if it doesn't exist
      if (!await fs.pathExists(this.config.taskFile)) {
        await this.createTaskFile('Initial Task', 'Welcome to Claude Task Manager!');
      }

      // Create Claude Code custom command if .claude/commands directory exists
      await this.createClaudeCustomCommand();
    } catch (error) {
      throw new FileSystemError(
        this.i18n.t('errors.initFailed', { error: error instanceof Error ? error.message : 'Unknown error' }),
        this.config.workingDir,
        'init'
      );
    }
  }

  async createNewTask(options: TaskOptions = {}): Promise<string> {
    try {
      // Archive current task if it exists
      if (await fs.pathExists(this.config.taskFile)) {
        await this.archiveCurrentTask();
      }

      // Create new task file
      const title = options.title || `Task ${format(new Date(), 'yyyy-MM-dd HH:mm')}`;
      const description = options.description || this.i18n.t('commands.new.success', { title: '' }).replace('✅ ', '').replace(': ', '');
      
      await this.createTaskFile(title, description, options);
      return this.config.taskFile;
    } catch (error) {
      throw new TaskManagerError(
        this.i18n.t('errors.createTaskFailed', { error: error instanceof Error ? error.message : 'Unknown error' }),
        'CREATE_TASK_ERROR'
      );
    }
  }

  private async createTaskFile(title: string, description: string, options: TaskOptions = {}): Promise<void> {
    const template = await this.getTaskTemplate();
    const variables: TemplateVariables = {
      TITLE: title,
      DESCRIPTION: description,
      DATE: new Date().toISOString(),
      TIMESTAMP: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      PRIORITY: options.priority || 'medium',
      TAGS: options.tags?.join(', ') || ''
    };

    let content = template;
    Object.entries(variables).forEach(([key, value]) => {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    await fs.writeFile(this.config.taskFile, content);
  }

  async archiveCurrentTask(): Promise<string | null> {
    try {
      if (!await fs.pathExists(this.config.taskFile)) {
        return null;
      }

      const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
      const archiveFileName = `${timestamp}_task.md`;
      const archivePath = path.join(this.config.archiveDir, archiveFileName);

      // Read current task and add archive metadata
      const currentContent = await fs.readFile(this.config.taskFile, 'utf8');
      const archivedContent = `<!-- Archived: ${new Date().toISOString()} -->\n\n${currentContent}`;

      await fs.writeFile(archivePath, archivedContent);
      await fs.remove(this.config.taskFile);

      return archivePath;
    } catch (error) {
      throw new FileSystemError(
        `Failed to archive current task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.config.taskFile,
        'archive'
      );
    }
  }

  async runTask(verbose: boolean = false): Promise<ExecutionResult> {
    if (!await fs.pathExists(this.config.taskFile)) {
      throw new TaskManagerError('No task.md file found. Run "claude-task new" first.', 'NO_TASK_FILE');
    }

    const startTime = Date.now();
    
    try {
      const config = await this.getConfig();
      const taskContent = await fs.readFile(this.config.taskFile, 'utf8');

      // Execute Claude Code with task content
      const claudeCommand = config.claudeCommand || 'claude code';
      const prompt = `Execute the following task:\n\n${taskContent}`;

      const result = await this.executeClaude(prompt, claudeCommand);
      const duration = Date.now() - startTime;

      const executionResult: ExecutionResult = {
        success: true,
        output: result,
        timestamp: new Date().toISOString(),
        duration
      };

      // Update task file with execution log
      await this.logExecution(executionResult);
      
      return executionResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      const executionResult: ExecutionResult = {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        duration
      };

      await this.logExecution(executionResult);
      throw error;
    }
  }

  private async executeClaude(prompt: string, claudeCommand: string = 'claude code'): Promise<string> {
    return new Promise((resolve, reject) => {
      const [command, ...args] = claudeCommand.split(' ');
      const claudeProcess = spawn(command, [...args, prompt], {
        stdio: ['pipe', 'pipe', 'pipe'] as StdioOptions,
        shell: true
      });

      let output = '';
      let errorOutput = '';

      claudeProcess.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      claudeProcess.stderr?.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      claudeProcess.on('close', (code: number | null) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new ClaudeExecutionError(
            `Claude Code failed with exit code ${code}`,
            code || undefined,
            errorOutput
          ));
        }
      });

      claudeProcess.on('error', (error: Error) => {
        reject(new ClaudeExecutionError(
          `Failed to start Claude Code: ${error.message}`
        ));
      });
    });
  }

  private async logExecution(result: ExecutionResult): Promise<void> {
    const status = result.success ? '✅ Success' : '❌ Failed';
    const logEntry = `\n\n## Execution Log - ${format(new Date(result.timestamp), 'yyyy-MM-dd HH:mm:ss')} (${result.duration}ms)\n\n**Status:** ${status}\n\n${result.success ? result.output : result.error}\n\n---\n`;
    
    await fs.appendFile(this.config.taskFile, logEntry);
  }

  async getHistory(limit: number = 10): Promise<TaskHistoryItem[]> {
    try {
      if (!await fs.pathExists(this.config.archiveDir)) {
        return [];
      }

      const files = await fs.readdir(this.config.archiveDir);
      const taskFiles = files
        .filter(file => file.endsWith('_task.md'))
        .sort()
        .reverse()
        .slice(0, limit);

      const history: TaskHistoryItem[] = [];
      
      for (const file of taskFiles) {
        const filePath = path.join(this.config.archiveDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const stats = await fs.stat(filePath);
        
        const titleMatch = content.match(/# (.+)/);
        const title = titleMatch ? titleMatch[1] : 'Untitled';
        const date = file.split('_')[0];

        history.push({
          file,
          title,
          date,
          path: filePath,
          size: stats.size
        });
      }

      return history;
    } catch (error) {
      throw new FileSystemError(
        this.i18n.t('errors.historyFailed', { error: error instanceof Error ? error.message : 'Unknown error' }),
        this.config.archiveDir,
        'read'
      );
    }
  }

  async getStatus(): Promise<TaskStatus> {
    try {
      const currentTaskExists = await fs.pathExists(this.config.taskFile);
      let currentTask: string | null = null;
      let currentTaskSize: number | undefined;
      
      if (currentTaskExists) {
        const content = await fs.readFile(this.config.taskFile, 'utf8');
        const stats = await fs.stat(this.config.taskFile);
        const titleMatch = content.match(/# (.+)/);
        currentTask = titleMatch ? titleMatch[1] : 'Untitled Task';
        currentTaskSize = stats.size;
      }

      const archiveFiles = await fs.pathExists(this.config.archiveDir) 
        ? (await fs.readdir(this.config.archiveDir)).filter(f => f.endsWith('_task.md'))
        : [];

      // Get last run time and count executions from task file
      let lastRun: string | null = null;
      let totalExecutions = 0;
      
      if (currentTaskExists) {
        const content = await fs.readFile(this.config.taskFile, 'utf8');
        const logMatches = content.match(/## Execution Log - (.+?) \(/g);
        if (logMatches && logMatches.length > 0) {
          totalExecutions = logMatches.length;
          const lastLogMatch = logMatches[logMatches.length - 1];
          const timeMatch = lastLogMatch.match(/## Execution Log - (.+?) \(/);
          lastRun = timeMatch ? timeMatch[1] : null;
        }
      }

      return {
        currentTask,
        archivedCount: archiveFiles.length,
        lastRun,
        totalExecutions,
        currentTaskSize
      };
    } catch (error) {
      throw new TaskManagerError(
        this.i18n.t('errors.statusFailed', { error: error instanceof Error ? error.message : 'Unknown error' }),
        'GET_STATUS_ERROR'
      );
    }
  }

  private async getTaskTemplate(): Promise<string> {
    try {
      const config = await this.getConfig();
      return config.taskTemplate || this.getDefaultTaskTemplate();
    } catch {
      return this.getDefaultTaskTemplate();
    }
  }

  private getDefaultTaskTemplate(): string {
    const t = this.i18n.getNamespace('taskTemplate');
    return `${t.title}

${t.created}  
${t.priority}  
${t.tags}

${t.description}

${t.tasks}

${t.context}

${t.notes}

${t.footer}
`;
  }

  private async getConfig(): Promise<TaskConfig> {
    try {
      if (await fs.pathExists(this.config.configFile)) {
        return await fs.readJson(this.config.configFile);
      }
      return {
        created: new Date().toISOString(),
        taskTemplate: this.getDefaultTaskTemplate(),
        claudeCommand: 'claude code'
      };
    } catch (error) {
      throw new FileSystemError(
        this.i18n.t('errors.configFailed', { error: error instanceof Error ? error.message : 'Unknown error' }),
        this.config.configFile,
        'read'
      );
    }
  }

  async updateConfig(updates: Partial<TaskConfig>): Promise<void> {
    try {
      const currentConfig = await this.getConfig();
      const newConfig = { ...currentConfig, ...updates };
      await fs.writeJson(this.config.configFile, newConfig, { spaces: 2 });
      
      // Update i18n language if changed
      if (updates.language && updates.language !== this.i18n.getLanguage()) {
        await this.i18n.init(updates.language);
      }
    } catch (error) {
      throw new FileSystemError(
        `Failed to update config: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.config.configFile,
        'write'
      );
    }
  }

  private async createClaudeCustomCommand(): Promise<void> {
    const claudeCommandsDir = path.join(this.config.workingDir, '.claude', 'commands');
    
    // Check if .claude/commands directory exists
    if (await fs.pathExists(claudeCommandsDir)) {
      const taskCommandPath = path.join(claudeCommandsDir, 'task.md');
      
      // Generate custom command content based on current language
      const taskCommandContent = this.generateCustomCommandContent();

## 使用方法

\`/task <action> [options]\`

## アクション

### 新しいタスクを作成
\`/task new "<タスク名>" [--priority high|medium|low] [--tags tag1,tag2]\`

タスクを作成し、task.mdファイルに保存します。

### 現在のタスクを確認
\`/task status\`

現在のタスクとその進捗状況を表示します。

### タスクを実行
\`/task run\`

現在のタスクをClaude Codeで実行します。task.mdの内容がコンテキストとして使用されます。

### タスク履歴
\`/task history [--limit n]\`

過去のタスクとアーカイブされたタスクを表示します。

### タスクをアーカイブ
\`/task archive\`

完了したタスクをアーカイブフォルダに移動します。

## 実装

\`\`\`typescript
import { TaskManager } from 'claude-task-manager';
import * as path from 'path';

async function executeTaskCommand(action: string, ...args: string[]) {
  const taskManager = new TaskManager(process.cwd());
  
  try {
    switch (action) {
      case 'new': {
        // パース引数
        const title = args[0] || 'New Task';
        let priority = 'medium';
        let tags: string[] = [];
        
        for (let i = 1; i < args.length; i++) {
          if (args[i] === '--priority' && args[i + 1]) {
            priority = args[i + 1];
            i++;
          } else if (args[i] === '--tags' && args[i + 1]) {
            tags = args[i + 1].split(',');
            i++;
          }
        }
        
        await taskManager.createNewTask({ title, priority, tags });
        console.log(\`✅ 新しいタスクを作成しました: \${title}\`);
        break;
      }
      
      case 'status': {
        const status = await taskManager.getStatus();
        console.log('📊 タスクステータス:');
        console.log(\`現在のタスク: \${status.currentTask || 'なし'}\`);
        console.log(\`アーカイブ済み: \${status.archivedCount}件\`);
        console.log(\`最後の実行: \${status.lastRun || 'なし'}\`);
        console.log(\`総実行回数: \${status.totalExecutions}\`);
        break;
      }
      
      case 'run': {
        console.log('🚀 タスクを実行します...');
        const taskContent = await taskManager.getTaskContent();
        console.log('\\n現在のタスク内容:');
        console.log(taskContent);
        console.log('\\n上記のタスクに基づいて作業を開始してください。');
        break;
      }
      
      case 'history': {
        const limit = parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '10');
        const history = await taskManager.getHistory(limit);
        console.log('📜 タスク履歴:');
        history.forEach(item => {
          console.log(\`- \${item.date}: \${item.title}\`);
        });
        break;
      }
      
      case 'archive': {
        const archivedPath = await taskManager.archiveCurrentTask();
        if (archivedPath) {
          console.log(\`✅ タスクをアーカイブしました: \${path.basename(archivedPath)}\`);
        } else {
          console.log('⚠️  アーカイブするタスクがありません。');
        }
        break;
      }
      
      default:
        console.log('使用方法: /task <new|status|run|history|archive> [options]');
        console.log('詳細は /task help を実行してください。');
    }
  } catch (error) {
    console.error('❌ エラー:', error instanceof Error ? error.message : error);
  }
}

// Claude Codeから呼び出される場合
const args = process.argv.slice(2);
if (args.length > 0) {
  executeTaskCommand(args[0], ...args.slice(1));
}
\`\`\`

## 使用例

1. 新しいタスクを作成:
   \`\`\`
   /task new "ユーザー認証機能の実装" --priority high --tags auth,backend
   \`\`\`

2. 現在のタスクを確認:
   \`\`\`
   /task status
   \`\`\`

3. タスクを実行:
   \`\`\`
   /task run
   \`\`\`

4. タスク履歴を確認:
   \`\`\`
   /task history --limit 10
   \`\`\`

5. 完了したタスクをアーカイブ:
   \`\`\`
   /task archive
   \`\`\``;
      
      await fs.writeFile(taskCommandPath, taskCommandContent);
      console.log(this.i18n.t('commands.init.customCommand'));
    }
  }

  private generateCustomCommandContent(): string {
    const cmd = this.i18n.getNamespace('customCommand');
    const actions = cmd.actions;
    const examples = cmd.examples;
    
    return `${cmd.title}

${cmd.description}

${cmd.usage}

${actions.title}

${actions.new.title}
${actions.new.syntax}

${actions.new.description}

${actions.status.title}
${actions.status.syntax}

${actions.status.description}

${actions.run.title}
${actions.run.syntax}

${actions.run.description}

${actions.history.title}
${actions.history.syntax}

${actions.history.description}

${actions.archive.title}
${actions.archive.syntax}

${actions.archive.description}

## Implementation

\`\`\`typescript
import { TaskManager } from 'claude-task-manager';
import * as path from 'path';

async function executeTaskCommand(action: string, ...args: string[]) {
  const taskManager = new TaskManager(process.cwd());
  
  try {
    await taskManager.init();
    const i18n = await taskManager.getLanguage();
    
    switch (action) {
      case 'new': {
        const title = args[0] || 'New Task';
        let priority = 'medium';
        let tags: string[] = [];
        
        for (let i = 1; i < args.length; i++) {
          if (args[i] === '--priority' && args[i + 1]) {
            priority = args[i + 1];
            i++;
          } else if (args[i] === '--tags' && args[i + 1]) {
            tags = args[i + 1].split(',');
            i++;
          }
        }
        
        await taskManager.createNewTask({ title, priority, tags });
        console.log('✅ Task created: ' + title);
        break;
      }
      
      case 'status': {
        const status = await taskManager.getStatus();
        console.log('📊 Task Status:');
        console.log('Current task: ' + (status.currentTask || 'None'));
        console.log('Archived: ' + status.archivedCount);
        console.log('Last run: ' + (status.lastRun || 'Never'));
        console.log('Total executions: ' + status.totalExecutions);
        break;
      }
      
      case 'run': {
        console.log('🚀 Executing task...');
        const taskContent = await taskManager.getTaskContent();
        console.log('\\nCurrent task content:');
        console.log(taskContent);
        console.log('\\nPlease start working based on the above task.');
        break;
      }
      
      case 'history': {
        const limit = parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '10');
        const history = await taskManager.getHistory(limit);
        console.log('📜 Task History:');
        history.forEach(item => {
          console.log('- ' + item.date + ': ' + item.title);
        });
        break;
      }
      
      case 'archive': {
        const archivedPath = await taskManager.archiveCurrentTask();
        if (archivedPath) {
          console.log('✅ Task archived: ' + path.basename(archivedPath));
        } else {
          console.log('⚠️  No task to archive.');
        }
        break;
      }
      
      default:
        console.log('Usage: /task <new|status|run|history|archive> [options]');
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
  }
}

// When called from Claude Code
const args = process.argv.slice(2);
if (args.length > 0) {
  executeTaskCommand(args[0], ...args.slice(1));
}
\`\`\`

${examples.title}

${examples.items.join('\n\n')}`;
  }

  async getTaskContent(): Promise<string> {
    if (!await fs.pathExists(this.config.taskFile)) {
      throw new TaskManagerError(this.i18n.t('errors.noTaskFile'), 'NO_TASK_FILE');
    }
    return await fs.readFile(this.config.taskFile, 'utf8');
  }

  async getLanguage(): Promise<Language> {
    const config = await this.getConfig();
    return config.language || 'en';
  }

  async setLanguage(lang: Language): Promise<void> {
    await this.updateConfig({ language: lang });
  }
}
