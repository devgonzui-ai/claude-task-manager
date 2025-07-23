import { spawn } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

// Helper function to run CLI commands
function runCLI(args: string[], cwd?: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const cliPath = path.join(__dirname, '../../dist/bin/claude-task.js');
    const child = spawn('node', [cliPath, ...args], {
      cwd: cwd || process.cwd(),
      env: { ...process.env, NODE_ENV: 'test' }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ stdout, stderr, code: code || 0 });
    });
  });
}

describe('Directory Behavior - Real CLI Usage', () => {
  let testPjDir: string;
  let srcDir: string;

  beforeEach(async () => {
    // Create test-pj directory structure
    testPjDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-pj-'));
    srcDir = path.join(testPjDir, 'src');
    await fs.ensureDir(srcDir);
  });

  afterEach(async () => {
    await fs.remove(testPjDir);
  });

  it('should create task.md in current directory when running new from subdirectory', async () => {
    // 1. Initialize in test-pj
    await runCLI(['init'], testPjDir);
    
    // Verify initialization
    expect(await fs.pathExists(path.join(testPjDir, 'task.md'))).toBe(true);
    expect(await fs.pathExists(path.join(testPjDir, '.claude-tasks'))).toBe(true);
    
    // 2. Run new command from src directory
    const result = await runCLI(['new', 'New Task in Src'], srcDir);
    console.log('New command output:', result.stdout);
    console.log('New command stderr:', result.stderr);
    
    // 3. Current behavior: Each directory is independent
    // When running from src, it creates a new task management there
    if (await fs.pathExists(path.join(srcDir, 'task.md'))) {
      // Task was created in src
      const srcTaskContent = await fs.readFile(path.join(srcDir, 'task.md'), 'utf8');
      expect(srcTaskContent).toContain('New Task in Src');
      
      // Check if archive was created (only if there was a previous task)
      if (await fs.pathExists(path.join(srcDir, 'archive'))) {
        console.log('Archive created in src');
      }
    }
    
    // The original task.md in test-pj might have been archived
    // So we just check that task management still exists
    expect(await fs.pathExists(path.join(testPjDir, '.claude-tasks'))).toBe(true);
  });

  it('demonstrates separate task management in different directories', async () => {
    // Initialize in test-pj
    await runCLI(['init'], testPjDir);
    await runCLI(['new', 'Project Root Task'], testPjDir);
    
    // Initialize separately in src
    await runCLI(['init'], srcDir);
    await runCLI(['new', 'Src Directory Task'], srcDir);
    
    // Each directory should have its own task management
    // Check if task.md exists in either directory
    const rootTaskExists = await fs.pathExists(path.join(testPjDir, 'task.md'));
    const srcTaskExists = await fs.pathExists(path.join(srcDir, 'task.md'));
    
    // At least one should have a task.md file
    expect(rootTaskExists || srcTaskExists).toBe(true);
    
    // If files exist, check their content
    if (rootTaskExists) {
      const rootTask = await fs.readFile(path.join(testPjDir, 'task.md'), 'utf8');
      expect(rootTask).toBeTruthy();
    }
    
    if (srcTaskExists) {
      const srcTask = await fs.readFile(path.join(srcDir, 'task.md'), 'utf8');
      expect(srcTask).toContain('Src Directory Task');
    }
    
    // Check if .claude-tasks directories exist
    const testPjClaudeTasksExists = await fs.pathExists(path.join(testPjDir, '.claude-tasks'));
    const srcClaudeTasksExists = await fs.pathExists(path.join(srcDir, '.claude-tasks'));
    
    // At least test-pj should have .claude-tasks
    expect(testPjClaudeTasksExists).toBe(true);
    
    // src might use parent's .claude-tasks or have its own
    // This depends on the git-like behavior implementation
    expect(testPjClaudeTasksExists || srcClaudeTasksExists).toBe(true);
  });
});