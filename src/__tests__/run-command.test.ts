import { TaskManager } from '../lib/TaskManager';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

describe('Run Command Tests', () => {
  let tempDir: string;
  let taskManager: TaskManager;
  const mockSpawn = spawn as jest.Mock;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'task-manager-test-'));
    taskManager = new TaskManager(tempDir);
    await taskManager.init();
    
    // Reset mock
    mockSpawn.mockClear();
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('should pass full prompt to claude command', async () => {
    // Mock spawn to capture arguments
    const mockProcess = {
      on: jest.fn((event, handler) => {
        if (event === 'close') {
          // Simulate successful execution
          setTimeout(() => handler(0), 10);
        }
      })
    };
    mockSpawn.mockReturnValue(mockProcess);

    // Create a task
    await taskManager.createNewTask({ 
      title: 'Test Task',
      description: 'Test Description'
    });

    // Run the task
    await taskManager.runTask(false, false);

    // Check spawn was called correctly
    const relativePath = path.relative(process.cwd(), path.resolve(tempDir, 'task.md'));
    expect(mockSpawn).toHaveBeenCalledWith(
      'claude',
      ['--dangerously-skip-permissions', '--print', `Please execute the tasks in @${relativePath} and then exit. Do not enter interactive mode.`],
      {
        stdio: 'inherit',
        shell: false
      }
    );
  });

  it('should handle spaces in file paths', async () => {
    // Create TaskManager in directory with spaces
    const dirWithSpaces = await fs.mkdtemp(path.join(os.tmpdir(), 'task manager test-'));
    const tmWithSpaces = new TaskManager(dirWithSpaces);
    await tmWithSpaces.init();

    const mockProcess = {
      on: jest.fn((event, handler) => {
        if (event === 'close') {
          setTimeout(() => handler(0), 10);
        }
      })
    };
    mockSpawn.mockReturnValue(mockProcess);

    await tmWithSpaces.createNewTask({ title: 'Test' });
    await tmWithSpaces.runTask(false, false);

    // Verify the full prompt is passed as single argument
    const relativePath = path.relative(process.cwd(), path.resolve(dirWithSpaces, 'task.md'));
    const expectedPrompt = `Please execute the tasks in @${relativePath} and then exit. Do not enter interactive mode.`;
    expect(mockSpawn).toHaveBeenCalledWith(
      'claude',
      ['--dangerously-skip-permissions', '--print', expectedPrompt],
      expect.any(Object)
    );

    await fs.remove(dirWithSpaces);
  });
});