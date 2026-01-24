import * as fs from 'fs-extra';
import * as path from 'path';
import { format } from 'date-fns';
import {
  TaskConfig,
  TaskOptions,
  TaskHistoryItem,
  TaskStatus,
  ExecutionResult,
  ClaudeTaskManagerConfig,
  TaskManagerError,
  FileSystemError
} from '../types';
import { I18n, Language } from './i18n';
import { ConfigManager } from './ConfigManager';
import { TaskFileManager } from './TaskFileManager';
import { ClaudeExecutor } from './ClaudeExecutor';
import { HistoryManager } from './HistoryManager';
import { CustomCommandGenerator } from './CustomCommandGenerator';
import { ProgressTracker, ProgressResult } from './ProgressTracker';
import { TaskSplitter, SplitResult } from './TaskSplitter';
import { HooksManager, HooksConfig } from './HooksManager';

export class TaskManager {
  private config: ClaudeTaskManagerConfig;
  private i18n: I18n;
  private configManager: ConfigManager;
  private taskFileManager: TaskFileManager;
  private claudeExecutor: ClaudeExecutor;
  private historyManager: HistoryManager;
  private customCommandGenerator: CustomCommandGenerator;
  private progressTracker: ProgressTracker;
  private taskSplitter: TaskSplitter;
  private hooksManager: HooksManager;

  constructor(workingDir?: string) {
    const baseDir = workingDir || this.findProjectRoot() || process.cwd();

    this.config = {
      workingDir: baseDir,
      taskFile: path.join(baseDir, 'task.md'),
      archiveDir: path.join(baseDir, 'archive'),
      configDir: path.join(baseDir, '.claude-tasks'),
      configFile: path.join(baseDir, '.claude-tasks', 'config.json')
    };
    this.i18n = I18n.getInstance();

    // Initialize managers
    this.configManager = new ConfigManager(this.config.configFile, this.i18n);
    this.taskFileManager = new TaskFileManager(this.config.taskFile, this.config.archiveDir, this.i18n);
    this.claudeExecutor = new ClaudeExecutor(this.config.taskFile);
    this.historyManager = new HistoryManager(this.config.taskFile, this.config.archiveDir, this.i18n);
    this.customCommandGenerator = new CustomCommandGenerator(this.config.workingDir, this.i18n);
    this.progressTracker = new ProgressTracker(this.config.taskFile);
    this.taskSplitter = new TaskSplitter(this.config.taskFile, this.i18n);
    this.hooksManager = new HooksManager(this.config.workingDir, this.i18n);

    if (!this.i18n.isInitialized()) {
      this.i18n.init('en').catch(() => {
        // Ignore initialization errors in constructor
      });
    }
  }

  /**
   * Find the project root by looking for .claude-tasks directory
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
      await fs.ensureDir(this.config.archiveDir);
      await fs.ensureDir(this.config.configDir);

      if (!await this.configManager.configExists()) {
        const initialLang = this.configManager.detectInitialLanguage();
        await this.i18n.init(initialLang);
        await this.configManager.createInitialConfig(
          initialLang,
          () => this.taskFileManager.getDefaultTaskTemplate()
        );
      } else {
        const config = await this.configManager.getConfig();
        await this.i18n.init(config.language || 'en');
      }

      if (!await this.taskFileManager.taskFileExists()) {
        await this.createTaskFile('Initial Task', 'Welcome to Claude Task Manager!');
      }

      await this.customCommandGenerator.createClaudeCustomCommand();
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
      if (!this.i18n.isInitialized()) {
        try {
          const config = await this.configManager.getConfig();
          await this.i18n.init(config.language || 'en');
        } catch {
          await this.i18n.init('en');
        }
      }

      if (await this.taskFileManager.taskFileExists()) {
        await this.archiveCurrentTask();
      }

      const title = options.title || `Task ${format(new Date(), 'yyyy-MM-dd HH:mm')}`;
      const description = options.description || '';

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
    const config = await this.configManager.getConfig();
    const template = await this.taskFileManager.getTaskTemplate(config);
    await this.taskFileManager.createTaskFile(title, description, options, template, config);
  }

  async archiveCurrentTask(): Promise<string | null> {
    return await this.taskFileManager.archiveCurrentTask();
  }

  async runTask(verbose: boolean = false, debug: boolean = false, editPermission: boolean = true): Promise<ExecutionResult> {
    const config = await this.configManager.getConfig();
    return await this.claudeExecutor.runTask(
      config,
      verbose,
      debug,
      editPermission,
      async (result) => await this.historyManager.logExecution(result)
    );
  }

  async recordExecution(result: ExecutionResult): Promise<void> {
    await this.historyManager.logExecution(result);
  }

  async getHistory(limit: number = 10): Promise<TaskHistoryItem[]> {
    return await this.historyManager.getHistory(limit);
  }

  async getStatus(): Promise<TaskStatus> {
    return await this.historyManager.getStatus();
  }

  async getTaskContent(): Promise<string> {
    return await this.taskFileManager.getTaskContent();
  }

  async getLanguage(): Promise<Language> {
    const config = await this.configManager.getConfig();
    return config.language || 'en';
  }

  async setLanguage(lang: Language): Promise<void> {
    await this.configManager.updateConfig(
      { language: lang },
      () => this.taskFileManager.getDefaultTaskTemplate()
    );
  }

  async getProgress(): Promise<ProgressResult> {
    return await this.progressTracker.getProgress();
  }

  formatProgress(result: ProgressResult): string {
    return this.progressTracker.formatOutput(result);
  }

  async splitTask(count?: number): Promise<SplitResult> {
    return await this.taskSplitter.splitTask(count);
  }

  async setupHooks(config?: HooksConfig): Promise<void> {
    await this.hooksManager.setupHooks(config);
  }

  async getHooksStatus(): Promise<{ configured: boolean; hooksCount: number; hooks: string[] }> {
    return await this.hooksManager.getHooksStatus();
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

      if (await fs.pathExists(gitignorePath)) {
        content = await fs.readFile(gitignorePath, 'utf8');
        existingEntries = new Set(
          content.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
        );
      }

      const newEntries: string[] = [];
      let needsUpdate = false;

      for (const entry of entriesToAdd) {
        if (entry.startsWith('#') || entry === '') {
          newEntries.push(entry);
        } else if (!existingEntries.has(entry)) {
          newEntries.push(entry);
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        if (content && !content.endsWith('\n')) {
          content += '\n';
        }

        if (content) {
          content += '\n';
        }

        content += newEntries.join('\n');

        if (!content.endsWith('\n')) {
          content += '\n';
        }

        await fs.writeFile(gitignorePath, content);
        console.log(this.i18n.t('commands.init.gitignoreUpdated') || ' Updated .gitignore with task-related entries');
      }
    } catch (error) {
      console.warn('Warning: Could not update .gitignore:', error);
    }
  }
}
