import { spawn } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

// Helper to run the built CLI in a given directory.
function runCLI(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const cliPath = path.join(__dirname, '../../dist/bin/claude-task.js');
    const child = spawn('node', [cliPath, ...args], {
      cwd,
      env: { ...process.env, NODE_ENV: 'test' }
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => resolve({ stdout, stderr, code: code || 0 }));
  });
}

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'claude-task-extra-test-'));
}

describe('Claude Task CLI - progress / claude / archive', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
    await runCLI(['init'], tempDir);
    // Normalize language so assertions are independent of the host LANG.
    await runCLI(['lang', 'en'], tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  const writeTask = (content: string) =>
    fs.writeFile(path.join(tempDir, 'task.md'), content);

  describe('progress command', () => {
    it('should show a 50% progress bar with localized header and count', async () => {
      await writeTask('# Feature\n\n## Tasks\n- [x] a\n- [ ] b\n');
      const result = await runCLI(['progress'], tempDir);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('📊 Task Progress: Feature');
      expect(result.stdout).toContain('50%');
      expect(result.stdout).toContain('(1/2 tasks)');
      // Regression guard: never leak the raw i18n key.
      expect(result.stdout).not.toContain('commands.progress');
    });

    it('should show 100% when all checkboxes are complete', async () => {
      await writeTask('# Done\n\n## Tasks\n- [x] a\n- [x] b\n');
      const result = await runCLI(['progress'], tempDir);
      expect(result.stdout).toContain('100%');
      expect(result.stdout).toContain('(2/2 tasks)');
    });

    it('should show the empty-state message when there are no checkboxes', async () => {
      await writeTask('# Empty\n\nno checkboxes here\n');
      const result = await runCLI(['progress'], tempDir);
      expect(result.stdout).toContain('No subtasks found');
    });

    it('should localize the header in Japanese', async () => {
      await runCLI(['lang', 'ja'], tempDir);
      await writeTask('# 機能\n\n## タスク\n- [x] a\n- [ ] b\n');
      const result = await runCLI(['progress'], tempDir);
      expect(result.stdout).toContain('📊 タスク進捗: 機能');
      expect(result.stdout).toContain('(1/2 件)');
    });

    it('should error when no task.md exists', async () => {
      await fs.remove(path.join(tempDir, 'task.md'));
      const result = await runCLI(['progress'], tempDir);
      expect(result.code).not.toBe(0);
      expect(result.stdout + result.stderr).toContain('No task.md file found');
    });
  });

  describe('done command', () => {
    it('should mark subtasks as done and show updated progress', async () => {
      await writeTask('# Feature\n\n## Tasks\n- [ ] a\n- [ ] b\n- [ ] c\n');
      const result = await runCLI(['done', '1', '3'], tempDir);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('1, 3');
      expect(result.stdout).toContain('(2/3 tasks)');

      const content = await fs.readFile(path.join(tempDir, 'task.md'), 'utf8');
      expect(content).toContain('- [x] a');
      expect(content).toContain('- [ ] b');
      expect(content).toContain('- [x] c');
    });

    it('should uncheck subtasks with --undo', async () => {
      await writeTask('# Feature\n\n## Tasks\n- [x] a\n- [x] b\n');
      const result = await runCLI(['done', '--undo', '1'], tempDir);

      expect(result.code).toBe(0);
      const content = await fs.readFile(path.join(tempDir, 'task.md'), 'utf8');
      expect(content).toContain('- [ ] a');
      expect(content).toContain('- [x] b');
    });

    it('should warn about out-of-range subtask numbers', async () => {
      await writeTask('# Feature\n\n## Tasks\n- [ ] a\n');
      const result = await runCLI(['done', '9'], tempDir);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('9');
      // task.md untouched
      const content = await fs.readFile(path.join(tempDir, 'task.md'), 'utf8');
      expect(content).toContain('- [ ] a');
    });

    it('should error when no task.md exists', async () => {
      await fs.remove(path.join(tempDir, 'task.md'));
      const result = await runCLI(['done', '1'], tempDir);
      expect(result.code).not.toBe(0);
      expect(result.stdout + result.stderr).toContain('No task.md file found');
    });
  });

  describe('claude command', () => {
    it('should print a deprecation notice pointing to run', async () => {
      await writeTask('# T\n\n## Tasks\n- [ ] x\n');
      const result = await runCLI(['claude'], tempDir);
      expect(result.code).toBe(0);
      expect(result.stdout.toLowerCase()).toContain('deprecated');
      expect(result.stdout).toContain('claude-task run');
    });

    it('should print the task content when no prompt is given', async () => {
      await writeTask('# Context Task\n\n## Tasks\n- [ ] something\n');
      const result = await runCLI(['claude'], tempDir);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Context Task');
    });

    it('should print the task context and the prompt when a prompt is given', async () => {
      await writeTask('# My Task\n\n## Tasks\n- [ ] do it\n');
      const result = await runCLI(['claude', 'please', 'help'], tempDir);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('TASK CONTEXT');
      expect(result.stdout).toContain('My Task');
      expect(result.stdout).toContain('please help');
    });

    it('should record an execution that shows up in status', async () => {
      const before = await runCLI(['status'], tempDir);
      expect(before.stdout).toContain('Total executions: 0');

      await runCLI(['claude', 'hello'], tempDir);

      const after = await runCLI(['status'], tempDir);
      expect(after.stdout).toMatch(/Total executions: [1-9]/);
    });
  });

  describe('archive command', () => {
    it('should archive the current task and remove task.md', async () => {
      await writeTask('# Archive Me\n\n## Tasks\n- [ ] x\n');
      const result = await runCLI(['archive'], tempDir);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('✅');
      expect(await fs.pathExists(path.join(tempDir, 'task.md'))).toBe(false);

      const archived = await fs.readdir(path.join(tempDir, 'archive'));
      expect(archived.some((f) => f.endsWith('_task.md'))).toBe(true);
    });

    it('should report when there is no task to archive', async () => {
      await fs.remove(path.join(tempDir, 'task.md'));
      const result = await runCLI(['archive'], tempDir);
      expect(result.code).toBe(0);
      // Localized "no task to archive" message (warning emoji).
      expect(result.stdout).toContain('⚠️');
    });
  });

  describe('--help localization (regression)', () => {
    it('should render translated command descriptions, not raw i18n keys', async () => {
      const result = await runCLI(['--help'], tempDir);

      expect(result.code).toBe(0);
      // The bug: descriptions printed as "commands.init.description" etc.
      expect(result.stdout).not.toContain('commands.init.description');
      expect(result.stdout).not.toContain('commands.progress.description');
      expect(result.stdout).not.toContain('.description');
      // English descriptions should be present.
      expect(result.stdout).toContain('Show subtask progress');
    });

    it('should localize command descriptions to Japanese when configured', async () => {
      await runCLI(['lang', 'ja'], tempDir);
      const result = await runCLI(['--help'], tempDir);
      expect(result.stdout).toContain('サブタスクの進捗を表示');
      expect(result.stdout).not.toContain('commands.');
    });
  });
});
