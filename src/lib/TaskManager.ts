import * as fs from 'fs-extra';
import * as path from 'path';
import { format } from 'date-fns';
import {
  TaskConfig,
  TaskOptions,
  TaskHistoryItem,
  TaskListItem,
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
import { TaskStore } from './TaskStore';

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
  private taskStore: TaskStore;

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
    this.progressTracker = new ProgressTracker(this.config.taskFile, this.i18n);
    this.taskSplitter = new TaskSplitter(this.config.taskFile, this.i18n);
    this.taskStore = new TaskStore(
      path.join(this.config.configDir, 'tasks'),
      this.config.taskFile,
      this.i18n
    );

    if (!this.i18n.isInitialized()) {
      // Synchronous on purpose: a fire-and-forget async init() here can
      // resolve after a later init() for the configured language and
      // overwrite its messages (flaky-English race on slow CI).
      try {
        this.i18n.initSync('en');
      } catch {
        // Ignore initialization errors in constructor
      }
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

  async init(options: { hooks?: boolean } = {}): Promise<void> {
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
      await this.customCommandGenerator.createClaudeSkill();
      await this.customCommandGenerator.createMcpConfig();
      if (options.hooks) {
        await this.customCommandGenerator.createHooksConfig();
      }
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

      const config = await this.configManager.getConfig();
      const title =
        options.title ||
        config.defaultTaskTitle ||
        `Task ${format(new Date(), 'yyyy-MM-dd HH:mm')}`;
      const description = options.description || '';

      if (options.name) {
        // Named creation never archives: the previous task keeps living under
        // its own name and is only written back to its snapshot.
        const name = this.taskStore.sanitizeName(options.name);
        const previous = await this.enableMultiTaskMode();

        if (previous !== name && await this.taskStore.exists(name)) {
          throw new TaskManagerError(
            this.i18n.t('errors.taskExists', { name }),
            'TASK_EXISTS'
          );
        }

        if (previous && previous !== name) {
          await this.taskStore.syncActive(previous);
        }

        await this.createTaskFile(title, description, options);
        await this.taskStore.syncActive(name);
        await this.setActiveTaskName(name);
        return this.config.taskFile;
      }

      // Unnamed creation keeps the legacy behavior: archive the current task
      // and replace it. In multi-task mode the active slot is reused, so the
      // name stays valid for `switch` and `list`.
      if (await this.taskFileManager.taskFileExists()) {
        await this.taskFileManager.archiveCurrentTask();
      }

      await this.createTaskFile(title, description, options);

      if (await this.taskStore.isEnabled()) {
        const active = await this.getActiveTaskName() || await this.taskStore.deriveName(title);
        await this.taskStore.syncActive(active);
        await this.setActiveTaskName(active);
      }

      return this.config.taskFile;
    } catch (error) {
      // Keep specific, actionable failures (e.g. a name clash) intact instead
      // of flattening them into a generic create error.
      if (error instanceof TaskManagerError) {
        throw error;
      }
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
    const archivedPath = await this.taskFileManager.archiveCurrentTask();

    if (archivedPath && await this.taskStore.isEnabled()) {
      const active = await this.getActiveTaskName();
      if (active) {
        await this.taskStore.remove(active);
        await this.setActiveTaskName(null);
      }
    }

    return archivedPath;
  }

  /** Name of the active task, or null in single-task (legacy) mode. */
  async getActiveTaskName(): Promise<string | null> {
    if (!await this.taskStore.isEnabled()) {
      return null;
    }
    const config = await this.configManager.getConfig();
    return config.activeTask || null;
  }

  async isMultiTaskMode(): Promise<boolean> {
    return await this.taskStore.isEnabled();
  }

  /**
   * Turn on multi-task mode, migrating a legacy project transparently: the
   * existing task.md becomes a stored task named after its title. Returns the
   * active task name (null only when there is no task at all yet).
   */
  private async enableMultiTaskMode(): Promise<string | null> {
    if (await this.taskStore.isEnabled()) {
      return await this.getActiveTaskName();
    }

    await this.taskStore.enable();

    if (!await this.taskFileManager.taskFileExists()) {
      return null;
    }

    const progress = await this.progressTracker.getProgress();
    const name = await this.taskStore.deriveName(progress.title);
    await this.taskStore.syncActive(name);
    await this.setActiveTaskName(name);
    return name;
  }

  private async setActiveTaskName(name: string | null): Promise<void> {
    await this.configManager.updateConfig(
      { activeTask: name === null ? undefined : name },
      () => this.taskFileManager.getDefaultTaskTemplate()
    );
  }

  /**
   * Make `name` the active task: the current task.md is written back to its own
   * snapshot first, so no in-progress state is lost. With `create`, an unknown
   * name is created from the task template instead of failing.
   */
  async switchTask(
    name: string,
    options: { create?: boolean } = {}
  ): Promise<{ name: string; previous: string | null; created: boolean }> {
    const target = this.taskStore.sanitizeName(name);
    const previous = await this.enableMultiTaskMode();

    if (previous === target) {
      await this.taskStore.syncActive(target);
      return { name: target, previous, created: false };
    }

    if (previous) {
      await this.taskStore.syncActive(previous);
    }

    let created = false;
    if (!await this.taskStore.exists(target)) {
      if (!options.create) {
        throw new TaskManagerError(
          this.i18n.t('errors.unknownTask', { name: target }),
          'UNKNOWN_TASK'
        );
      }
      await this.createTaskFile(target, '');
      await this.taskStore.syncActive(target);
      created = true;
    } else {
      await this.taskStore.activate(target);
    }

    await this.setActiveTaskName(target);
    return { name: target, previous, created };
  }

  /**
   * All known tasks with their progress. In single-task mode this is the
   * current task.md alone, listed under the name it would migrate to.
   */
  async listTasks(): Promise<TaskListItem[]> {
    if (await this.taskStore.isEnabled()) {
      return await this.taskStore.listTasks(await this.getActiveTaskName());
    }

    if (!await this.taskFileManager.taskFileExists()) {
      return [];
    }

    const progress = await this.progressTracker.getProgress();
    return [{
      name: await this.taskStore.deriveName(progress.title),
      title: progress.title,
      active: true,
      completed: progress.completed,
      total: progress.total,
      percentage: progress.percentage
    }];
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
    const status = await this.historyManager.getStatus();
    const activeTaskName = await this.getActiveTaskName();
    return activeTaskName ? { ...status, activeTaskName } : status;
  }

  async getTaskContent(): Promise<string> {
    return await this.taskFileManager.getTaskContent();
  }

  async getLanguage(): Promise<Language> {
    const config = await this.configManager.getConfig();
    return config.language || 'en';
  }

  /**
   * Synchronous language lookup for early startup (e.g. localizing --help).
   * Falls back to the environment-detected language when no config is present.
   */
  getLanguageSync(): Language {
    try {
      if (fs.existsSync(this.config.configFile)) {
        const config = fs.readJsonSync(this.config.configFile) as TaskConfig;
        if (config.language) {
          return config.language;
        }
      }
    } catch {
      // Ignore and fall through to environment detection
    }
    return this.configManager.detectInitialLanguage();
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

  /**
   * One-line status for embedding in a statusline (e.g. Claude Code's
   * `statusLine` setting): `<title> ▸ <pct>%`, title only when the task has
   * no subtasks, or a localized "no task" marker. In multi-task mode the
   * active task name is prefixed as `[<name>]`.
   */
  async getShortStatus(): Promise<string> {
    if (!await this.taskFileManager.taskFileExists()) {
      return this.i18n.t('commands.status.shortNoTask');
    }
    const progress = await this.progressTracker.getProgress();
    const activeTaskName = await this.getActiveTaskName();
    const prefix = activeTaskName ? `[${activeTaskName}] ` : '';
    if (progress.total === 0) {
      return `${prefix}${progress.title}`;
    }
    return `${prefix}${progress.title} ▸ ${progress.percentage}%`;
  }

  formatProgress(result: ProgressResult): string {
    return this.progressTracker.formatOutput(result);
  }

  async setTaskCompletion(
    indices: number[],
    completed: boolean
  ): Promise<{ updated: number[]; invalid: number[]; result: ProgressResult }> {
    return await this.progressTracker.setCompletion(indices, completed);
  }

  async splitTask(count?: number): Promise<SplitResult> {
    return await this.taskSplitter.splitTask(count);
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
      '# Claude Code skill generated by claude-task init',
      '.claude/skills/task/',
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
