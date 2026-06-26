import { TaskSplitter } from '../lib/TaskSplitter';
import { I18n } from '../lib/i18n';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';

// Mock child_process so we never hit the real `claude` CLI.
jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

const mockSpawn = spawn as unknown as jest.Mock;

// Build a fake claude process that emits `responseText` on stdout and exits 0.
function mockClaudeResponse(responseText: string, exitCode = 0) {
  const proc = {
    stdin: { write: jest.fn(), end: jest.fn(), on: jest.fn() },
    stdout: {
      on: jest.fn((event: string, cb: (data: Buffer) => void) => {
        if (event === 'data') cb(Buffer.from(responseText));
      })
    },
    stderr: { on: jest.fn() },
    on: jest.fn((event: string, cb: (code: number) => void) => {
      if (event === 'close') setTimeout(() => cb(exitCode), 5);
    }),
    kill: jest.fn()
  };
  mockSpawn.mockReturnValue(proc);
  return proc;
}

describe('TaskSplitter', () => {
  let tempDir: string;
  let taskFile: string;
  let i18n: I18n;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'task-splitter-test-'));
    taskFile = path.join(tempDir, 'task.md');
    i18n = I18n.getInstance();
    await i18n.init('en');
    mockSpawn.mockClear();
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('should throw when task.md does not exist (without calling claude)', async () => {
    const splitter = new TaskSplitter(taskFile, i18n);
    await expect(splitter.splitTask()).rejects.toThrow('No task.md file found');
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('should parse subtasks from the claude response', async () => {
    await fs.writeFile(taskFile, '# Feature\n\n## Description\nBuild it\n\n## Tasks\n- old\n');
    mockClaudeResponse('Design the API\nImplement the handler\nWrite tests');

    const splitter = new TaskSplitter(taskFile, i18n);
    const result = await splitter.splitTask();

    expect(result.success).toBe(true);
    expect(result.subtasks).toEqual([
      'Design the API',
      'Implement the handler',
      'Write tests'
    ]);
  });

  it('should strip bullets, numbers and code fences from the response', async () => {
    await fs.writeFile(taskFile, '# T\n\n## Tasks\n- old\n');
    mockClaudeResponse('```\n1. First step\n- Second step\n* Third step\n```');

    const splitter = new TaskSplitter(taskFile, i18n);
    const result = await splitter.splitTask();

    expect(result.subtasks).toEqual(['First step', 'Second step', 'Third step']);
  });

  it('should rewrite the Tasks section of task.md with the new subtasks', async () => {
    await fs.writeFile(taskFile, '# Feature\n\n## Tasks\n- [ ] stale task\n\n## Notes\nkeep me\n');
    mockClaudeResponse('Alpha\nBeta');

    const splitter = new TaskSplitter(taskFile, i18n);
    await splitter.splitTask();

    const updated = await fs.readFile(taskFile, 'utf8');
    expect(updated).toContain('- [ ] Alpha');
    expect(updated).toContain('- [ ] Beta');
    expect(updated).not.toContain('stale task');
    // Other sections are preserved.
    expect(updated).toContain('## Notes');
    expect(updated).toContain('keep me');
  });

  it('should request an exact count when one is provided', async () => {
    await fs.writeFile(taskFile, '# T\n\n## Tasks\n- old\n');
    mockClaudeResponse('One\nTwo\nThree\nFour');

    const splitter = new TaskSplitter(taskFile, i18n);
    await splitter.splitTask(4);

    // The prompt is written to the mocked process stdin.
    const proc = mockSpawn.mock.results[0].value;
    const writtenPrompt = proc.stdin.write.mock.calls[0][0] as string;
    expect(writtenPrompt).toContain('exactly 4');
  });

  it('should return a failed result when claude exits non-zero', async () => {
    await fs.writeFile(taskFile, '# T\n\n## Tasks\n- old\n');
    mockClaudeResponse('boom', 1);

    const splitter = new TaskSplitter(taskFile, i18n);
    const result = await splitter.splitTask();

    expect(result.success).toBe(false);
    expect(result.subtasks).toEqual([]);
    expect(result.error).toBeDefined();
  });
});
