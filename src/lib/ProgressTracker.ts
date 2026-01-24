import * as fs from 'fs-extra';
import chalk from 'chalk';

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

  constructor(taskFile: string) {
    this.taskFile = taskFile;
  }

  async getProgress(): Promise<ProgressResult> {
    if (!await fs.pathExists(this.taskFile)) {
      throw new Error('No task.md file found');
    }

    const content = await fs.readFile(this.taskFile, 'utf8');
    return this.parseProgress(content);
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
    lines.push(chalk.blue(`📊 Task Progress: ${result.title}`));
    lines.push('');

    if (result.total === 0) {
      lines.push(chalk.yellow('No subtasks found. Add checkboxes like:'));
      lines.push(chalk.gray('  - [ ] Task to do'));
      lines.push(chalk.gray('  - [x] Completed task'));
      return lines.join('\n');
    }

    // Progress bar
    const bar = this.formatProgressBar(result.percentage);
    const percentColor = result.percentage === 100 ? chalk.green :
                         result.percentage >= 50 ? chalk.yellow : chalk.red;
    lines.push(`${bar} ${percentColor(`${result.percentage}%`)} (${result.completed}/${result.total} tasks)`);
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
