import * as fs from 'fs-extra';
import chalk from 'chalk';
import { I18n } from './i18n';

export interface TaskItem {
  text: string;
  completed: boolean;
}

export interface ProgressResult {
  total: number;
  completed: number;
  percentage: number;
  tasks: TaskItem[];
  title: string;
}

export class ProgressTracker {
  private taskFile: string;
  private i18n: I18n;

  constructor(taskFile: string, i18n: I18n) {
    this.taskFile = taskFile;
    this.i18n = i18n;
  }

  async getProgress(): Promise<ProgressResult> {
    if (!await fs.pathExists(this.taskFile)) {
      throw new Error('No task.md file found');
    }

    const content = await fs.readFile(this.taskFile, 'utf8');
    return this.parseProgress(content);
  }

  /**
   * Mark the given 1-based checkbox numbers (matching `progress` output order)
   * as completed or pending and persist the change to task.md.
   */
  async setCompletion(
    indices: number[],
    completed: boolean
  ): Promise<{ updated: number[]; invalid: number[]; result: ProgressResult }> {
    if (!await fs.pathExists(this.taskFile)) {
      throw new Error('No task.md file found');
    }

    const content = await fs.readFile(this.taskFile, 'utf8');
    const mark = completed ? 'x' : ' ';
    const requested = new Set(indices);
    const updated: number[] = [];

    let counter = 0;
    const checkboxLine = /^([ \t]*-\s+\[)([ xX])(\]\s+.+)$/gm;
    const newContent = content.replace(checkboxLine, (full, pre, _state, post) => {
      counter += 1;
      if (requested.has(counter)) {
        updated.push(counter);
        return `${pre}${mark}${post}`;
      }
      return full;
    });

    const total = counter;
    const invalid = indices.filter((n) => n < 1 || n > total);

    if (updated.length > 0) {
      await fs.writeFile(this.taskFile, newContent);
    }

    return { updated, invalid, result: this.parseProgress(newContent) };
  }

  private parseProgress(content: string): ProgressResult {
    // Extract title
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : 'Untitled Task';

    // Find all checkbox items
    const checkboxPattern = /^[\s]*-\s+\[([ xX])\]\s+(.+)$/gm;
    const tasks: TaskItem[] = [];
    let match;

    while ((match = checkboxPattern.exec(content)) !== null) {
      tasks.push({
        completed: match[1].toLowerCase() === 'x',
        text: match[2].trim()
      });
    }

    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      percentage,
      tasks,
      title
    };
  }

  formatProgressBar(percentage: number, width: number = 20): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return bar;
  }

  formatOutput(result: ProgressResult): string {
    const lines: string[] = [];

    // Header
    lines.push(chalk.blue(`${this.i18n.t('commands.progress.title')} ${result.title}`));
    lines.push('');

    if (result.total === 0) {
      lines.push(chalk.yellow(this.i18n.t('commands.progress.noTasks')));
      return lines.join('\n');
    }

    // Progress bar
    const bar = this.formatProgressBar(result.percentage);
    const percentColor = result.percentage === 100 ? chalk.green :
                         result.percentage >= 50 ? chalk.yellow : chalk.red;
    const count = this.i18n.t('commands.progress.count', {
      completed: result.completed,
      total: result.total
    });
    lines.push(`${bar} ${percentColor(`${result.percentage}%`)} ${count}`);
    lines.push('');

    // Task list
    for (const task of result.tasks) {
      if (task.completed) {
        lines.push(chalk.green(`  ✅ ${task.text}`));
      } else {
        lines.push(chalk.gray(`  ⬜ ${task.text}`));
      }
    }

    return lines.join('\n');
  }
}
