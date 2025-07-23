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

  constructor(workingDir?: string) {
    // If no directory specified, try to find project root with .claude-tasks
    const baseDir = workingDir || this.findProjectRoot() || process.cwd();
    
    this.config = {
      workingDir: baseDir,
      taskFile: path.join(baseDir, 'task.md'),
      archiveDir: path.join(baseDir, 'archive'),
      configDir: path.join(baseDir, '.claude-tasks'),
      configFile: path.join(baseDir, '.claude-tasks', 'config.json')
    };
    this.i18n = I18n.getInstance();
    
    // Initialize i18n with default language if not already initialized
    // This ensures i18n is ready even if init() hasn't been called yet
    if (!this.i18n.isInitialized()) {
      this.i18n.init('en').catch(() => {
        // Ignore initialization errors in constructor
      });
    }
  }

  /**
   * Find the project root by looking for .claude-tasks directory
   * Similar to how git finds .git directory
   */
  private findProjectRoot(): string | null {
    let currentDir = process.cwd();
    const root = path.parse(currentDir).root;

    while (currentDir !== root) {
      const configDir = path.join(currentDir, '.claude-tasks');
      try {
        if (fs.existsSync(configDir) && fs.statSync(configDir).isDirectory()) {
          return currentDir;
        }
      } catch {
        // Ignore errors and continue searching
      }
      
      currentDir = path.dirname(currentDir);
    }

    // Check root directory as well
    const rootConfigDir = path.join(root, '.claude-tasks');
    try {
      if (fs.existsSync(rootConfigDir) && fs.statSync(rootConfigDir).isDirectory()) {
        return root;
      }
    } catch {
      // Ignore errors
    }

    return null;
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

      // Update .gitignore
      await this.updateGitignore();
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
    try {
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
    } catch {
      // Fallback template if i18n is not initialized
      return `# {{TITLE}}

**Created:** {{DATE}}  
**Priority:** {{PRIORITY}}  
**Tags:** {{TAGS}}

## Description
{{DESCRIPTION}}

## Tasks
{{TASKS}}

## Context
<!-- Add context for Claude Code execution -->

## Notes
<!-- Add your notes here -->

---
*Generated by Claude Task Manager*`;
    }
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
    const claudeDir = path.join(this.config.workingDir, '.claude');
    const claudeCommandsDir = path.join(claudeDir, 'commands');
    
    try {
      // Check if .claude directory exists
      if (await fs.pathExists(claudeDir)) {
        // Create commands directory inside existing .claude directory
        await fs.ensureDir(claudeCommandsDir);
        
        const taskCommandPath = path.join(claudeCommandsDir, 'task.md');
        
        // Generate custom command content based on current language
        const taskCommandContent = this.generateCustomCommandContent();
        
        await fs.writeFile(taskCommandPath, taskCommandContent);
        console.log(this.i18n.t('commands.init.customCommand'));
      }
    } catch (error) {
      // If we can't create the custom command, just log a warning and continue
      console.warn('Could not create Claude custom command:', error);
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
        console.log('\\n=== TASK.MD CONTENT START ===');
        console.log(taskContent);
        console.log('=== TASK.MD CONTENT END ===\\n');
        console.log('📋 Please work on the task defined in the task.md file above.');
        console.log('💡 Note: Focus only on the content between the markers above.');
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

  private async updateGitignore(): Promise<void> {
    const gitignorePath = path.join(this.config.workingDir, '.gitignore');
    const entriesToAdd = [
      '# Claude Task Manager',
      'task.md',
      'archive/',
      '.claude-tasks/',
      '',
      '# Temporary task files',
      '*.tmp.md',
      'task.*.md',
      '',
      '# Claude Code custom commands (if you want to exclude them)',
      '# .claude/commands/task.md'
    ];

    try {
      let content = '';
      let existingEntries: Set<string> = new Set();

      // Read existing .gitignore if it exists
      if (await fs.pathExists(gitignorePath)) {
        content = await fs.readFile(gitignorePath, 'utf8');
        // Parse existing entries (normalize by removing comments and whitespace)
        existingEntries = new Set(
          content.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
        );
      }

      // Check if we need to add any entries
      const newEntries: string[] = [];
      let needsUpdate = false;

      for (const entry of entriesToAdd) {
        if (entry.startsWith('#') || entry === '') {
          // Always add comments and empty lines for formatting
          newEntries.push(entry);
        } else if (!existingEntries.has(entry)) {
          // Only add if not already present
          newEntries.push(entry);
          needsUpdate = true;
        }
      }

      // Only update if there are new entries to add
      if (needsUpdate) {
        // Add a newline before our section if file exists and doesn't end with newline
        if (content && !content.endsWith('\n')) {
          content += '\n';
        }
        
        // Add another newline if file has content to separate our section
        if (content) {
          content += '\n';
        }

        content += newEntries.join('\n');

        // Ensure file ends with newline
        if (!content.endsWith('\n')) {
          content += '\n';
        }

        await fs.writeFile(gitignorePath, content);
        console.log(this.i18n.t('commands.init.gitignoreUpdated') || '✅ Updated .gitignore with task-related entries');
      }
    } catch (error) {
      // Don't fail init if .gitignore update fails
      console.warn('Warning: Could not update .gitignore:', error);
    }
  }
}
