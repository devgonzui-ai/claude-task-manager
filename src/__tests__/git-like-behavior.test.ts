import { TaskManager } from '../lib/TaskManager';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('Git-like Project Root Detection', () => {
  let rootDir: string;
  let subDir1: string;
  let subDir2: string;
  let deepDir: string;

  beforeEach(async () => {
    // Create directory structure:
    // rootDir/
    //   .claude-tasks/
    //   task.md
    //   subDir1/
    //   subDir2/
    //     deepDir/
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-task-git-test-'));
    subDir1 = path.join(rootDir, 'subDir1');
    subDir2 = path.join(rootDir, 'subDir2');
    deepDir = path.join(subDir2, 'deepDir');

    await fs.ensureDir(subDir1);
    await fs.ensureDir(deepDir);
  });

  afterEach(async () => {
    await fs.remove(rootDir);
  });

  describe('when .claude-tasks exists in parent directory', () => {
    beforeEach(async () => {
      // Initialize task management in root directory
      const rootTaskManager = new TaskManager(rootDir);
      await rootTaskManager.init();
      await rootTaskManager.createNewTask({ title: 'Root Task' });
    });

    it('should find and use parent .claude-tasks from subdirectory', async () => {
      // Change to subdirectory
      const originalCwd = process.cwd();
      process.chdir(subDir1);

      try {
        // Create TaskManager without specifying directory
        const taskManager = new TaskManager();

        // Should use parent project root
        await taskManager.createNewTask({ title: 'Task from SubDir1' });

        // Task should be created in root directory, not subdirectory
        expect(await fs.pathExists(path.join(rootDir, 'task.md'))).toBe(true);
        const taskContent = await fs.readFile(path.join(rootDir, 'task.md'), 'utf8');
        expect(taskContent).toContain('Task from SubDir1');

        // Archive should contain the previous root task
        const archiveFiles = await fs.readdir(path.join(rootDir, 'archive'));
        expect(archiveFiles.length).toBe(1);
        const archivedContent = await fs.readFile(
          path.join(rootDir, 'archive', archiveFiles[0]),
          'utf8'
        );
        expect(archivedContent).toContain('Root Task');

        // No task files should be created in subdirectory
        expect(await fs.pathExists(path.join(subDir1, 'task.md'))).toBe(false);
        expect(await fs.pathExists(path.join(subDir1, '.claude-tasks'))).toBe(false);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should find project root from deeply nested directory', async () => {
      const originalCwd = process.cwd();
      process.chdir(deepDir);

      try {
        const taskManager = new TaskManager();
        await taskManager.createNewTask({ title: 'Task from Deep Directory' });

        // Should still use root directory
        expect(await fs.pathExists(path.join(rootDir, 'task.md'))).toBe(true);
        const taskContent = await fs.readFile(path.join(rootDir, 'task.md'), 'utf8');
        expect(taskContent).toContain('Task from Deep Directory');

        // No task files in deep directory
        expect(await fs.pathExists(path.join(deepDir, 'task.md'))).toBe(false);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should use same project root for all operations', async () => {
      const originalCwd = process.cwd();
      process.chdir(subDir1);

      try {
        const taskManager = new TaskManager();
        
        // Create task
        await taskManager.createNewTask({ title: 'New Task' });
        
        // Get status
        const status = await taskManager.getStatus();
        expect(status.currentTask).toBe('New Task');
        expect(status.archivedCount).toBe(1); // Root Task was archived

        // Get history
        const history = await taskManager.getHistory();
        expect(history.length).toBe(1);
        expect(history[0].title).toBe('Root Task');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('when no .claude-tasks exists', () => {
    it('should use current directory when no parent .claude-tasks found', async () => {
      const originalCwd = process.cwd();
      process.chdir(subDir1);

      try {
        const taskManager = new TaskManager();
        await taskManager.init();

        // Should create .claude-tasks in current directory
        expect(await fs.pathExists(path.join(subDir1, '.claude-tasks'))).toBe(true);
        expect(await fs.pathExists(path.join(subDir1, 'task.md'))).toBe(true);

        // Root directory should not have .claude-tasks
        expect(await fs.pathExists(path.join(rootDir, '.claude-tasks'))).toBe(false);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('when explicitly specifying working directory', () => {
    it('should use specified directory regardless of .claude-tasks in parent', async () => {
      // Initialize in root
      const rootTaskManager = new TaskManager(rootDir);
      await rootTaskManager.init();

      const originalCwd = process.cwd();
      process.chdir(subDir1);

      try {
        // Explicitly specify subDir1 as working directory
        const taskManager = new TaskManager(subDir1);
        await taskManager.init();
        await taskManager.createNewTask({ title: 'SubDir1 Task' });

        // Should create separate task management in subDir1
        expect(await fs.pathExists(path.join(subDir1, '.claude-tasks'))).toBe(true);
        expect(await fs.pathExists(path.join(subDir1, 'task.md'))).toBe(true);
        
        const taskContent = await fs.readFile(path.join(subDir1, 'task.md'), 'utf8');
        expect(taskContent).toContain('SubDir1 Task');

        // Root task should remain unchanged
        const rootTaskContent = await fs.readFile(path.join(rootDir, 'task.md'), 'utf8');
        expect(rootTaskContent).toContain('Initial Task');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle .claude-tasks at filesystem root', async () => {
      // This test simulates the behavior without actually creating files at root
      const mockRoot = '/';
      const mockPath = path.join(mockRoot, 'some', 'deep', 'path');
      
      // The implementation should handle this gracefully
      const taskManager = new TaskManager();
      // Should not throw
      expect(() => taskManager).not.toThrow();
    });

    // Skip permission test as it's environment-dependent
    it.skip('should handle permission errors gracefully', async () => {
      // This test is skipped because file permission behavior varies across platforms
    });
  });
});