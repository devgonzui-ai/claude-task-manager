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
  return fs.mkdtemp(path.join(os.tmpdir(), 'claude-task-statusline-test-'));
}

describe('Claude Task CLI - status --short / init --hooks', () => {
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

  const settingsPath = () => path.join(tempDir, '.claude', 'settings.json');

  describe('status --short', () => {
    it('should print title and percentage when the task has subtasks', async () => {
      await writeTask('# Feature\n\n## Tasks\n- [x] a\n- [ ] b\n');
      const result = await runCLI(['status', '--short'], tempDir);

      expect(result.code).toBe(0);
      expect(result.stdout.trim()).toBe('Feature ▸ 50%');
    });

    it('should print only the title when the task has no subtasks', async () => {
      await writeTask('# Solo Task\n\nno checkboxes here\n');
      const result = await runCLI(['status', '--short'], tempDir);

      expect(result.code).toBe(0);
      expect(result.stdout.trim()).toBe('Solo Task');
    });

    it('should print the no-task marker when task.md is missing', async () => {
      await fs.remove(path.join(tempDir, 'task.md'));
      const result = await runCLI(['status', '--short'], tempDir);

      expect(result.code).toBe(0);
      expect(result.stdout.trim()).toBe('No task');
    });

    it('should localize the no-task marker in Japanese', async () => {
      await runCLI(['lang', 'ja'], tempDir);
      await fs.remove(path.join(tempDir, 'task.md'));
      const result = await runCLI(['status', '--short'], tempDir);

      expect(result.stdout.trim()).toBe('タスクなし');
    });
  });

  describe('init --hooks', () => {
    it('should not create .claude/settings.json without the flag', async () => {
      // beforeEach already ran a plain init.
      expect(await fs.pathExists(settingsPath())).toBe(false);
    });

    it('should write statusLine and SessionStart hook with the flag', async () => {
      const result = await runCLI(['init', '--hooks'], tempDir);
      expect(result.code).toBe(0);

      const settings = await fs.readJson(settingsPath());
      expect(settings.statusLine).toEqual({
        type: 'command',
        command: 'claude-task status --short',
        padding: 1
      });
      expect(settings.hooks.SessionStart).toEqual([
        { type: 'command', command: 'claude-task status' }
      ]);
    });

    it('should preserve an existing statusLine and unrelated settings', async () => {
      await fs.ensureDir(path.join(tempDir, '.claude'));
      await fs.writeJson(settingsPath(), {
        statusLine: { type: 'command', command: 'my-custom-statusline' },
        permissions: { allow: ['Bash(ls:*)'] }
      });

      await runCLI(['init', '--hooks'], tempDir);

      const settings = await fs.readJson(settingsPath());
      expect(settings.statusLine.command).toBe('my-custom-statusline');
      expect(settings.permissions).toEqual({ allow: ['Bash(ls:*)'] });
      expect(settings.hooks.SessionStart).toEqual([
        { type: 'command', command: 'claude-task status' }
      ]);
    });

    it('should not duplicate the SessionStart hook when run twice', async () => {
      await runCLI(['init', '--hooks'], tempDir);
      await runCLI(['init', '--hooks'], tempDir);

      const settings = await fs.readJson(settingsPath());
      expect(settings.hooks.SessionStart).toHaveLength(1);
    });

    it('should keep existing user SessionStart hooks and append its own', async () => {
      await fs.ensureDir(path.join(tempDir, '.claude'));
      await fs.writeJson(settingsPath(), {
        hooks: {
          SessionStart: [{ type: 'command', command: 'echo hello' }]
        }
      });

      await runCLI(['init', '--hooks'], tempDir);

      const settings = await fs.readJson(settingsPath());
      expect(settings.hooks.SessionStart).toEqual([
        { type: 'command', command: 'echo hello' },
        { type: 'command', command: 'claude-task status' }
      ]);
    });
  });
});
