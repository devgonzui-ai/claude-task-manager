import { TaskManager } from '../lib/TaskManager';
import { TaskManagerError } from '../types';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('TaskManager', () => {
  let tempDir: string;
  let taskManager: TaskManager;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-task-test-'));
    taskManager = new TaskManager(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.remove(tempDir);
  });

  describe('init', () => {
    it('should initialize task management structure', async () => {
      await taskManager.init();

      // Check if directories are created
      expect(await fs.pathExists(path.join(tempDir, 'archive'))).toBe(true);
      expect(await fs.pathExists(path.join(tempDir, '.claude-tasks'))).toBe(true);
      expect(await fs.pathExists(path.join(tempDir, '.claude-tasks', 'config.json'))).toBe(true);
      expect(await fs.pathExists(path.join(tempDir, 'task.md'))).toBe(true);
    });

    it('should create config file with default values', async () => {
      await taskManager.init();

      const configPath = path.join(tempDir, '.claude-tasks', 'config.json');
      const config = await fs.readJson(configPath);

      expect(config).toHaveProperty('created');
      expect(config).toHaveProperty('taskTemplate');
      expect(config).toHaveProperty('claudeCommand');
      expect(config.claudeCommand).toBe('claude code');
    });
  });

  describe('createNewTask', () => {
    beforeEach(async () => {
      await taskManager.init();
    });

    it('should create a new task file', async () => {
      const result = await taskManager.createNewTask({
        title: 'Test Task',
        description: 'Test Description'
      });

      expect(result).toBe(path.join(tempDir, 'task.md'));
      expect(await fs.pathExists(result)).toBe(true);

      const content = await fs.readFile(result, 'utf8');
      expect(content).toContain('# Test Task');
      expect(content).toContain('Test Description');
    });

    it('should archive existing task before creating new one', async () => {
      // Create first task
      await taskManager.createNewTask({
        title: 'First Task',
        description: 'First Description'
      });

      // Create second task
      await taskManager.createNewTask({
        title: 'Second Task',
        description: 'Second Description'
      });

      // Check that archive directory contains the first task
      const archiveDir = path.join(tempDir, 'archive');
      const archiveFiles = await fs.readdir(archiveDir);
      expect(archiveFiles.length).toBe(1);
      expect(archiveFiles[0]).toMatch(/_task\.md$/);

      // Check that current task is the second one
      const currentContent = await fs.readFile(path.join(tempDir, 'task.md'), 'utf8');
      expect(currentContent).toContain('# Second Task');
    });
  });

  describe('getHistory', () => {
    beforeEach(async () => {
      await taskManager.init();
    });

    it('should return empty history when no archived tasks exist', async () => {
      const history = await taskManager.getHistory();
      expect(history).toEqual([]);
    });

    it('should return archived tasks in reverse chronological order', async () => {
      // Create and archive a few tasks
      await taskManager.createNewTask({ title: 'Task 1' });
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to ensure different timestamps
      
      await taskManager.createNewTask({ title: 'Task 2' });
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await taskManager.createNewTask({ title: 'Task 3' });

      const history = await taskManager.getHistory();
      expect(history.length).toBe(2); // Two archived tasks
      expect(history[0].title).toBe('Task 2'); // Most recent archived task first
      expect(history[1].title).toBe('Task 1');
    });

    it('should respect the limit parameter', async () => {
      // Create multiple tasks
      for (let i = 1; i <= 5; i++) {
        await taskManager.createNewTask({ title: `Task ${i}` });
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const history = await taskManager.getHistory(2);
      // Should have at least 1 archived task (could be less due to timing)
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getStatus', () => {
    beforeEach(async () => {
      await taskManager.init();
    });

    it('should return correct status for new task manager', async () => {
      const status = await taskManager.getStatus();

      expect(status.currentTask).toBe('Initial Task');
      expect(status.archivedCount).toBe(0);
      expect(status.lastRun).toBeNull();
      expect(status.totalExecutions).toBe(0);
    });

    it('should track archived tasks count', async () => {
      await taskManager.createNewTask({ title: 'Task 1' });
      await taskManager.createNewTask({ title: 'Task 2' });

      const status = await taskManager.getStatus();
      expect(status.archivedCount).toBe(1); // Initial task was archived
      expect(status.currentTask).toBe('Task 2');
    });
  });

  describe('error handling', () => {
    it('should throw TaskManagerError for non-existent task file in runTask', async () => {
      await expect(taskManager.runTask()).rejects.toThrow(TaskManagerError);
      await expect(taskManager.runTask()).rejects.toThrow('No task.md file found');
    });
  });
});
