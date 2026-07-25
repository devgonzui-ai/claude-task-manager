import * as fs from 'fs-extra';
import * as path from 'path';
import { TaskListItem, TaskManagerError } from '../types';
import { parseProgressContent } from './ProgressTracker';
import { I18n } from './i18n';

/**
 * Storage for multiple named tasks.
 *
 * `task.md` stays the live file of the *active* task — every other manager
 * keeps reading and writing exactly that path, unaware of names. This store
 * owns the per-name snapshots under `.claude-tasks/tasks/<name>.md`, which are
 * authoritative for the *inactive* tasks. Switching means: write the active
 * task back to its snapshot, then copy the target snapshot over `task.md`.
 *
 * Copies rather than symlinks, deliberately: symlinks are unreliable on
 * Windows. Multi-task mode is on iff the tasks directory exists, so projects
 * that never switch behave exactly as they did before.
 */
export class TaskStore {
  private tasksDir: string;
  private taskFile: string;
  private i18n: I18n;

  constructor(tasksDir: string, taskFile: string, i18n: I18n) {
    this.tasksDir = tasksDir;
    this.taskFile = taskFile;
    this.i18n = i18n;
  }

  async isEnabled(): Promise<boolean> {
    return await fs.pathExists(this.tasksDir);
  }

  async enable(): Promise<void> {
    await fs.ensureDir(this.tasksDir);
  }

  /**
   * Normalize a user-supplied task name into a safe single path segment.
   * Throws rather than silently mangling names that could escape the store.
   */
  sanitizeName(name: string): string {
    const raw = (name || '').trim();
    const withoutExt = raw.endsWith('.md') ? raw.slice(0, -3) : raw;
    const normalized = withoutExt.trim().replace(/\s+/g, '-');

    const invalid =
      normalized === '' ||
      normalized === '.' ||
      normalized === '..' ||
      /[/\\]/.test(normalized) ||
      /[\u0000-\u001f]/.test(normalized);

    if (invalid) {
      throw new TaskManagerError(
        this.i18n.t('errors.invalidTaskName', { name: raw }),
        'INVALID_TASK_NAME'
      );
    }

    return normalized;
  }

  getTaskPath(name: string): string {
    return path.join(this.tasksDir, `${this.sanitizeName(name)}.md`);
  }

  async exists(name: string): Promise<boolean> {
    return await fs.pathExists(this.getTaskPath(name));
  }

  async listNames(): Promise<string[]> {
    if (!await this.isEnabled()) {
      return [];
    }
    const entries = await fs.readdir(this.tasksDir);
    return entries
      .filter((file) => file.endsWith('.md'))
      .map((file) => file.slice(0, -3))
      .sort();
  }

  /**
   * All stored tasks with their titles and subtask progress. The active task is
   * read from `task.md` so its numbers are live rather than from its snapshot.
   */
  async listTasks(activeName: string | null): Promise<TaskListItem[]> {
    const names = await this.listNames();
    const items: TaskListItem[] = [];

    for (const name of names) {
      const active = name === activeName;
      const source = active ? this.taskFile : this.getTaskPath(name);
      let content = '';
      if (await fs.pathExists(source)) {
        content = await fs.readFile(source, 'utf8');
      }
      const progress = parseProgressContent(content);
      items.push({
        name,
        title: progress.title,
        active,
        completed: progress.completed,
        total: progress.total,
        percentage: progress.percentage
      });
    }

    return items;
  }

  /** Write the live task.md back to `<name>`'s snapshot. */
  async syncActive(name: string): Promise<void> {
    if (!await fs.pathExists(this.taskFile)) {
      return;
    }
    await this.enable();
    await fs.copy(this.taskFile, this.getTaskPath(name), { overwrite: true });
  }

  /** Make `<name>` the live task.md. The caller must have synced the previous one. */
  async activate(name: string): Promise<void> {
    const source = this.getTaskPath(name);
    if (!await fs.pathExists(source)) {
      throw new TaskManagerError(
        this.i18n.t('errors.unknownTask', { name }),
        'UNKNOWN_TASK'
      );
    }
    await fs.copy(source, this.taskFile, { overwrite: true });
  }

  async remove(name: string): Promise<void> {
    await fs.remove(this.getTaskPath(name));
  }

  /**
   * Derive a store name from a task title, used when migrating a legacy
   * project whose task.md has no name yet.
   */
  async deriveName(title: string): Promise<string> {
    const slug = (title || '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[/\\]/g, '-')
      .replace(/[\u0000-\u001f]/g, '')
      .replace(/^[.]+/, '')
      .slice(0, 60);

    const base = slug || 'task';
    if (!await this.exists(base)) {
      return base;
    }

    let suffix = 2;
    while (await this.exists(`${base}-${suffix}`)) {
      suffix++;
    }
    return `${base}-${suffix}`;
  }
}
