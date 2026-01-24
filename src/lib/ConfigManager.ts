import * as fs from 'fs-extra';
import * as path from 'path';
import {
  TaskConfig,
  FileSystemError
} from '../types';
import { I18n, Language } from './i18n';

export class ConfigManager {
  private configFile: string;
  private i18n: I18n;

  constructor(configFile: string, i18n: I18n) {
    this.configFile = configFile;
    this.i18n = i18n;
  }

  /**
   * Detect initial language from environment
   */
  detectInitialLanguage(): Language {
    const lang = process.env.LANG || process.env.LANGUAGE || '';
    if (lang.toLowerCase().includes('ja')) {
      return 'ja';
    }
    return 'en';
  }

  async getConfig(): Promise<TaskConfig> {
    try {
      if (await fs.pathExists(this.configFile)) {
        return await fs.readJson(this.configFile);
      }
      return {
        created: new Date().toISOString(),
        taskTemplate: '',
        claudeCommand: 'claude'
      };
    } catch (error) {
      throw new FileSystemError(
        this.i18n.t('errors.configFailed', { error: error instanceof Error ? error.message : 'Unknown error' }),
        this.configFile,
        'read'
      );
    }
  }

  async updateConfig(updates: Partial<TaskConfig>, getDefaultTaskTemplate: () => string): Promise<void> {
    try {
      const currentConfig = await this.getConfig();
      let newConfig = { ...currentConfig, ...updates };

      if (updates.language && updates.language !== this.i18n.getLanguage()) {
        await this.i18n.init(updates.language);

        const isJapanese = updates.language === 'ja';

        const isDefaultPrerequisites = (val: string | string[] | undefined) => {
          if (typeof val === 'string') {
            return val === '<!-- Add prerequisites here -->' || val === '<!-- 前提条件を記入してください -->';
          }
          if (Array.isArray(val) && val.length === 1) {
            return val[0] === '<!-- Add prerequisites here -->' || val[0] === '<!-- 前提条件を記入してください -->';
          }
          return false;
        };

        const isDefaultRules = (val: string | string[] | undefined) => {
          if (typeof val === 'string') {
            return val === '<!-- Add rules here -->' || val === '<!-- ルールを記入してください -->';
          }
          if (Array.isArray(val) && val.length === 1) {
            return val[0] === '<!-- Add rules here -->' || val[0] === '<!-- ルールを記入してください -->';
          }
          return false;
        };

        const isDefaultTasks = (val: string | string[] | undefined) => {
          if (typeof val === 'string') {
            return val === '- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3' || val === '- [ ] タスク 1\n- [ ] タスク 2\n- [ ] タスク 3' ||
                   val === '- Task 1\n- Task 2\n- Task 3' || val === '- タスク 1\n- タスク 2\n- タスク 3';
          }
          if (Array.isArray(val) && val.length === 3) {
            return (val[0] === 'Task 1' && val[1] === 'Task 2' && val[2] === 'Task 3') ||
                   (val[0] === 'タスク 1' && val[1] === 'タスク 2' && val[2] === 'タスク 3');
          }
          return false;
        };

        if (isDefaultPrerequisites(currentConfig.defaultPrerequisites)) {
          newConfig.defaultPrerequisites = isJapanese ? ['<!-- 前提条件を記入してください -->'] : ['<!-- Add prerequisites here -->'];
        }

        if (isDefaultRules(currentConfig.defaultRules)) {
          newConfig.defaultRules = isJapanese ? ['<!-- ルールを記入してください -->'] : ['<!-- Add rules here -->'];
        }

        if (isDefaultTasks(currentConfig.defaultTasks)) {
          newConfig.defaultTasks = isJapanese ? ['タスク 1', 'タスク 2', 'タスク 3'] : ['Task 1', 'Task 2', 'Task 3'];
        }

        if (currentConfig.defaultTaskTitle === 'New Task' ||
            currentConfig.defaultTaskTitle === '新しいタスク') {
          newConfig.defaultTaskTitle = isJapanese ? '新しいタスク' : 'New Task';
        }

        newConfig.taskTemplate = getDefaultTaskTemplate();
      }

      await fs.writeJson(this.configFile, newConfig, { spaces: 2 });
    } catch (error) {
      throw new FileSystemError(
        `Failed to update config: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.configFile,
        'write'
      );
    }
  }

  async createInitialConfig(initialLang: Language, getDefaultTaskTemplate: () => string): Promise<void> {
    const isJapanese = initialLang === 'ja';
    const defaultConfig: TaskConfig = {
      created: new Date().toISOString(),
      taskTemplate: getDefaultTaskTemplate(),
      claudeCommand: 'claude',
      defaultTaskTitle: isJapanese ? '新しいタスク' : 'New Task',
      archiveDir: 'archive',
      language: initialLang,
      defaultPrerequisites: isJapanese ? ['<!-- 前提条件を記入してください -->'] : ['<!-- Add prerequisites here -->'],
      defaultRules: isJapanese ? ['<!-- ルールを記入してください -->'] : ['<!-- Add rules here -->'],
      defaultTasks: isJapanese ? ['タスク 1', 'タスク 2', 'タスク 3'] : ['Task 1', 'Task 2', 'Task 3']
    };
    await fs.writeJson(this.configFile, defaultConfig, { spaces: 2 });
  }

  async configExists(): Promise<boolean> {
    return await fs.pathExists(this.configFile);
  }
}
