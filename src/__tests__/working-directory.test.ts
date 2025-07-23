import { TaskManager } from '../lib/TaskManager';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('Working Directory Behavior', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Save original working directory
    originalCwd = process.cwd();
    
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-task-wd-test-'));
  });

  afterEach(async () => {
    // Restore original working directory
    process.chdir(originalCwd);
    
    // Clean up temporary directory
    await fs.remove(tempDir);
  });

  describe('when initialized in a directory', () => {
    it('should create all files in the initialized directory', async () => {
      // Initialize in tempDir
      const taskManager = new TaskManager(tempDir);
      await taskManager.init();

      // Change to a different directory
      const otherDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-task-other-'));
      process.chdir(otherDir);

      // Create a new task
      await taskManager.createNewTask({ title: 'Test Task' });

      // Files should be created in the initialized directory (tempDir), not the current directory
      expect(await fs.pathExists(path.join(tempDir, 'task.md'))).toBe(true);
      expect(await fs.pathExists(path.join(tempDir, 'archive'))).toBe(true);
      expect(await fs.pathExists(path.join(tempDir, '.claude-tasks'))).toBe(true);

      // Files should NOT be created in the current directory
      expect(await fs.pathExists(path.join(otherDir, 'task.md'))).toBe(false);
      expect(await fs.pathExists(path.join(otherDir, 'archive'))).toBe(false);

      await fs.remove(otherDir);
    });
  });

  describe('when using current directory (default)', () => {
    it('should create files in the current working directory', async () => {
      // Change to tempDir
      process.chdir(tempDir);

      // Create TaskManager without specifying directory (uses cwd)
      const taskManager = new TaskManager();
      await taskManager.init();

      // Files should be created in current directory
      expect(await fs.pathExists(path.join(tempDir, 'task.md'))).toBe(true);
      expect(await fs.pathExists(path.join(tempDir, 'archive'))).toBe(true);
      expect(await fs.pathExists(path.join(tempDir, '.claude-tasks'))).toBe(true);
    });

    it('should use directory at construction time', async () => {
      // Start in tempDir
      process.chdir(tempDir);
      
      // Create TaskManager (locks to current directory at construction)
      const taskManager = new TaskManager();
      
      // Create another directory and change to it
      const otherDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-task-other2-'));
      process.chdir(otherDir);
      
      // Initialize - should still use the directory from construction time
      await taskManager.init();
      
      // Files should be created in the original directory (tempDir)
      expect(await fs.pathExists(path.join(tempDir, 'task.md'))).toBe(true);
      expect(await fs.pathExists(path.join(tempDir, 'archive'))).toBe(true);
      expect(await fs.pathExists(path.join(tempDir, '.claude-tasks'))).toBe(true);
      
      // Files should NOT be in the new current directory
      expect(await fs.pathExists(path.join(otherDir, 'task.md'))).toBe(false);
      
      await fs.remove(otherDir);
    });
  });

  describe('archiving behavior', () => {
    it('should archive to the same directory as task.md', async () => {
      const taskManager = new TaskManager(tempDir);
      await taskManager.init();

      // Create first task
      await taskManager.createNewTask({ title: 'First Task' });
      
      // Create second task (which archives the first)
      await taskManager.createNewTask({ title: 'Second Task' });

      // Archive should be in tempDir/archive
      const archiveFiles = await fs.readdir(path.join(tempDir, 'archive'));
      expect(archiveFiles.length).toBe(1);
      expect(archiveFiles[0]).toMatch(/_task\.md$/);
    });
  });
});