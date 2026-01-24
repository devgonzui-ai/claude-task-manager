import * as fs from 'fs-extra';
import * as path from 'path';
import { format } from 'date-fns';
import {
  TaskHistoryItem,
  TaskStatus,
  ExecutionResult,
  TaskManagerError,
  FileSystemError
} from '../types';
import { I18n } from './i18n';

export class HistoryManager {
  private taskFile: string;
  private archiveDir: string;
  private i18n: I18n;

  constructor(taskFile: string, archiveDir: string, i18n: I18n) {
    this.taskFile = taskFile;
    this.archiveDir = archiveDir;
    this.i18n = i18n;
  }

  async getHistory(limit: number = 10): Promise<TaskHistoryItem[]> {
    try {
      if (!await fs.pathExists(this.archiveDir)) {
        return [];
      }

      const files = await fs.readdir(this.archiveDir);
      const taskFiles = files
        .filter(file => file.endsWith('_task.md'))
        .sort()
        .reverse()
        .slice(0, limit);

      const history: TaskHistoryItem[] = [];

      for (const file of taskFiles) {
        const filePath = path.join(this.archiveDir, file);
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
        this.archiveDir,
        'read'
      );
    }
  }

  async getStatus(): Promise<TaskStatus> {
    try {
      const currentTaskExists = await fs.pathExists(this.taskFile);
      let currentTask: string | null = null;
      let currentTaskSize: number | undefined;

      if (currentTaskExists) {
        const content = await fs.readFile(this.taskFile, 'utf8');
        const stats = await fs.stat(this.taskFile);
        const titleMatch = content.match(/# (.+)/);
        currentTask = titleMatch ? titleMatch[1] : 'Untitled Task';
        currentTaskSize = stats.size;
      }

      const archiveFiles = await fs.pathExists(this.archiveDir)
        ? (await fs.readdir(this.archiveDir)).filter(f => f.endsWith('_task.md'))
        : [];

      let lastRun: string | null = null;
      let totalExecutions = 0;

      if (currentTaskExists) {
        const content = await fs.readFile(this.taskFile, 'utf8');
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

  async logExecution(result: ExecutionResult): Promise<void> {
    const status = result.success ? ' Success' : ' Failed';
    const logEntry = `\n\n## Execution Log - ${format(new Date(result.timestamp), 'yyyy-MM-dd HH:mm:ss')} (${result.duration}ms)\n\n**Status:** ${status}\n\n${result.success ? result.output : result.error}\n\n---\n`;

    await fs.appendFile(this.taskFile, logEntry);
  }
}
