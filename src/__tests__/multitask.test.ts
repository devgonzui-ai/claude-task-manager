import { TaskManager } from '../lib/TaskManager';
import { I18n } from '../lib/i18n';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('Multiple named tasks', () => {
  let tempDir: string;
  let manager: TaskManager;
  let taskFile: string;
  let tasksDir: string;
  let configFile: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'multitask-test-'));
    await I18n.getInstance().init('en');
    manager = new TaskManager(tempDir);
    await manager.init();
    taskFile = path.join(tempDir, 'task.md');
    tasksDir = path.join(tempDir, '.claude-tasks', 'tasks');
    configFile = path.join(tempDir, '.claude-tasks', 'config.json');
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  const readTask = async () => fs.readFile(taskFile, 'utf8');
  const writeTask = async (content: string) => fs.writeFile(taskFile, content);

  describe('single-task (legacy) mode', () => {
    it('stays in single-task mode after init', async () => {
      expect(await fs.pathExists(tasksDir)).toBe(false);
      expect(await manager.isMultiTaskMode()).toBe(false);
      expect(await manager.getActiveTaskName()).toBeNull();
    });

    it('lists the current task under the name it would migrate to', async () => {
      await manager.createNewTask({ title: 'Fix login bug' });
      const tasks = await manager.listTasks();

      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({ name: 'Fix-login-bug', title: 'Fix login bug', active: true });
      expect(await fs.pathExists(tasksDir)).toBe(false);
    });

    it('keeps the plain short status without a name prefix', async () => {
      await manager.createNewTask({ title: 'Plain Task' });
      await writeTask('# Plain Task\n\n- [x] a\n- [ ] b\n');

      expect(await manager.getShortStatus()).toBe('Plain Task ▸ 50%');
    });
  });

  describe('migration', () => {
    it('migrates the existing task.md on the first named creation', async () => {
      await manager.createNewTask({ title: 'Legacy Task' });
      await writeTask('# Legacy Task\n\n- [x] done one\n- [ ] pending\n');

      await manager.createNewTask({ title: 'Second Task', name: 'second' });

      expect(await manager.isMultiTaskMode()).toBe(true);
      const migrated = await fs.readFile(path.join(tasksDir, 'Legacy-Task.md'), 'utf8');
      expect(migrated).toContain('- [x] done one');
      expect(await manager.getActiveTaskName()).toBe('second');
    });

    it('migrates on the first switch --create as well', async () => {
      await manager.createNewTask({ title: 'Legacy Task' });
      const result = await manager.switchTask('other', { create: true });

      expect(result.previous).toBe('Legacy-Task');
      expect(result.created).toBe(true);
      expect(await fs.pathExists(path.join(tasksDir, 'Legacy-Task.md'))).toBe(true);
    });

    it('does not archive anything while migrating', async () => {
      await manager.createNewTask({ title: 'Legacy Task' });
      const before = await manager.getStatus();

      await manager.createNewTask({ title: 'Named', name: 'named' });

      const after = await manager.getStatus();
      expect(after.archivedCount).toBe(before.archivedCount);
    });
  });

  describe('switching', () => {
    beforeEach(async () => {
      await manager.createNewTask({ title: 'Task A', name: 'a' });
      await writeTask('# Task A\n\n- [x] a1\n- [ ] a2\n');
      await manager.createNewTask({ title: 'Task B', name: 'b' });
      await writeTask('# Task B\n\n- [ ] b1\n- [ ] b2\n- [ ] b3\n');
    });

    it('preserves both tasks subtask state across switches', async () => {
      await manager.switchTask('a');
      expect(await readTask()).toContain('- [x] a1');
      expect(await manager.getActiveTaskName()).toBe('a');

      await manager.setTaskCompletion([2], true);

      await manager.switchTask('b');
      expect(await readTask()).toContain('- [ ] b1');
      expect((await manager.getProgress()).completed).toBe(0);

      await manager.switchTask('a');
      const progress = await manager.getProgress();
      expect(progress.completed).toBe(2);
      expect(progress.total).toBe(2);
    });

    it('reports the previous task name', async () => {
      const result = await manager.switchTask('a');
      expect(result).toEqual({ name: 'a', previous: 'b', created: false });
    });

    it('is a no-op when switching to the active task', async () => {
      const result = await manager.switchTask('b');
      expect(result).toEqual({ name: 'b', previous: 'b', created: false });
      expect(await readTask()).toContain('- [ ] b1');
    });

    it('rejects an unknown task name', async () => {
      await expect(manager.switchTask('nope')).rejects.toMatchObject({ code: 'UNKNOWN_TASK' });
      expect(await manager.getActiveTaskName()).toBe('b');
      expect(await readTask()).toContain('# Task B');
    });

    it('creates an unknown task with the create option', async () => {
      const result = await manager.switchTask('c', { create: true });

      expect(result.created).toBe(true);
      expect(await manager.getActiveTaskName()).toBe('c');
      expect(await readTask()).toContain('# c');
      expect(await fs.pathExists(path.join(tasksDir, 'b.md'))).toBe(true);
    });

    it('rejects names that would escape the task store', async () => {
      for (const bad of ['../evil', 'nested/name', '..', '']) {
        await expect(manager.switchTask(bad)).rejects.toMatchObject({ code: 'INVALID_TASK_NAME' });
      }
    });

    it('normalizes whitespace in names', async () => {
      const result = await manager.switchTask('  my task  ', { create: true });
      expect(result.name).toBe('my-task');
      expect(await fs.pathExists(path.join(tasksDir, 'my-task.md'))).toBe(true);
    });
  });

  describe('creating tasks', () => {
    it('creates a named task without archiving the current one', async () => {
      await manager.createNewTask({ title: 'Task A', name: 'a' });
      const before = await manager.getStatus();

      await manager.createNewTask({ title: 'Task B', name: 'b' });

      const after = await manager.getStatus();
      expect(after.archivedCount).toBe(before.archivedCount);
      expect(await manager.getActiveTaskName()).toBe('b');
      expect(await fs.pathExists(path.join(tasksDir, 'a.md'))).toBe(true);
    });

    it('refuses to overwrite an existing name', async () => {
      await manager.createNewTask({ title: 'Task A', name: 'a' });
      await manager.createNewTask({ title: 'Task B', name: 'b' });

      await expect(manager.createNewTask({ title: 'Other', name: 'a' })).rejects.toMatchObject({
        code: 'TASK_EXISTS'
      });
    });

    it('still archives and reuses the active slot without a name', async () => {
      await manager.createNewTask({ title: 'Task A', name: 'a' });
      const before = await manager.getStatus();

      await manager.createNewTask({ title: 'Replacement' });

      const after = await manager.getStatus();
      expect(after.archivedCount).toBe(before.archivedCount + 1);
      expect(await manager.getActiveTaskName()).toBe('a');
      expect(await readTask()).toContain('# Replacement');
      expect(await fs.readFile(path.join(tasksDir, 'a.md'), 'utf8')).toContain('# Replacement');
      // 'Initial-Task' is the migrated task.md that init() created.
      expect((await manager.listTasks()).map((t) => t.name)).toEqual(['Initial-Task', 'a']);
    });
  });

  describe('listing and status', () => {
    beforeEach(async () => {
      await manager.createNewTask({ title: 'Task A', name: 'a' });
      await writeTask('# Task A\n\n- [x] a1\n- [ ] a2\n');
      await manager.createNewTask({ title: 'Task B', name: 'b' });
      await writeTask('# Task B\n\n- [ ] b1\n');
    });

    it('lists every task with progress and marks the active one', async () => {
      const tasks = await manager.listTasks();

      expect(tasks.map((t) => t.name)).toEqual(['Initial-Task', 'a', 'b']);
      expect(tasks.find((t) => t.name === 'a')).toMatchObject({
        title: 'Task A', active: false, completed: 1, total: 2, percentage: 50
      });
      expect(tasks.find((t) => t.name === 'b')).toMatchObject({
        title: 'Task B', active: true, completed: 0, total: 1
      });
    });

    it('reads live progress for the active task', async () => {
      await manager.setTaskCompletion([1], true);
      const tasks = await manager.listTasks();

      expect(tasks.find((t) => t.name === 'b')).toMatchObject({ completed: 1, percentage: 100 });
    });

    it('prefixes the short status with the active task name', async () => {
      expect(await manager.getShortStatus()).toBe('[b] Task B ▸ 0%');
    });

    it('exposes the active task name in status', async () => {
      const status = await manager.getStatus();
      expect(status.activeTaskName).toBe('b');
    });
  });

  describe('archiving', () => {
    it('removes the archived task from the store and clears the active slot', async () => {
      await manager.createNewTask({ title: 'Task A', name: 'a' });
      await manager.createNewTask({ title: 'Task B', name: 'b' });

      const archived = await manager.archiveCurrentTask();

      expect(archived).not.toBeNull();
      expect(await fs.pathExists(path.join(tasksDir, 'b.md'))).toBe(false);
      expect(await manager.getActiveTaskName()).toBeNull();
      expect((await manager.listTasks()).map((t) => t.name)).toEqual(['Initial-Task', 'a']);

      await manager.switchTask('a');
      expect(await readTask()).toContain('# Task A');
    });

    it('keeps the config readable after clearing the active task', async () => {
      await manager.createNewTask({ title: 'Task A', name: 'a' });
      await manager.archiveCurrentTask();

      const config = await fs.readJson(configFile);
      expect(config.activeTask).toBeUndefined();
      expect(config.claudeCommand).toBe('claude');
    });
  });
});
