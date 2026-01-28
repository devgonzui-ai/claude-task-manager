import * as fs from 'fs-extra';
import { spawn } from 'child_process';
import { I18n } from './i18n';

export interface SplitResult {
  success: boolean;
  subtasks: string[];
  error?: string;
}

export class TaskSplitter {
  private taskFile: string;
  private i18n: I18n;

  constructor(taskFile: string, i18n: I18n) {
    this.taskFile = taskFile;
    this.i18n = i18n;
  }

  async splitTask(count?: number): Promise<SplitResult> {
    if (!await fs.pathExists(this.taskFile)) {
      throw new Error('No task.md file found');
    }

    const content = await fs.readFile(this.taskFile, 'utf8');
    const title = this.extractTitle(content);
    const description = this.extractDescription(content);

    const prompt = this.buildPrompt(title, description, count);

    try {
      const response = await this.callClaude(prompt);
      const subtasks = this.parseSubtasks(response);

      if (subtasks.length > 0) {
        await this.updateTaskFile(content, subtasks);
      }

      return {
        success: true,
        subtasks
      };
    } catch (error) {
      return {
        success: false,
        subtasks: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private extractTitle(content: string): string {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1] : 'Untitled Task';
  }

  private extractDescription(content: string): string {
    const descMatch = content.match(/##\s+(Description|説明)\s*\n([\s\S]*?)(?=\n##|$)/i);
    return descMatch ? descMatch[2].trim() : '';
  }

  private buildPrompt(title: string, description: string, count?: number): string {
    const countInstruction = count ? `exactly ${count}` : '3-7';
    return `Analyze this task and break it down into ${countInstruction} actionable subtasks.

Task Title: ${title}
Description: ${description}

Requirements:
1. Each subtask should be specific and actionable
2. Subtasks should be in logical order
3. Each subtask should be completable independently
4. Keep subtask descriptions concise (one line each)

Output format (ONLY output the subtasks, one per line, no numbers or bullets):
Subtask description 1
Subtask description 2
Subtask description 3
...`;
  }

  private async callClaude(prompt: string, timeoutMs: number = 300000): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = ['-p'];

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const claudeProcess = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false
      });

      // Set timeout first
      const timeoutId = setTimeout(() => {
        timedOut = true;
        claudeProcess.kill('SIGTERM');
        reject(new Error(`Claude CLI timed out after ${timeoutMs / 1000} seconds`));
      }, timeoutMs);

      // Handle stdin errors
      claudeProcess.stdin.on('error', (err) => {
        clearTimeout(timeoutId);
        if (timedOut) return;
        reject(new Error(`Stdin error: ${err.message}`));
      });

      // Write prompt to stdin
      try {
        claudeProcess.stdin.write(prompt);
        claudeProcess.stdin.end();
      } catch (err) {
        clearTimeout(timeoutId);
        reject(new Error(`Failed to write to stdin: ${err instanceof Error ? err.message : String(err)}`));
        return;
      }

      claudeProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      claudeProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      claudeProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        if (timedOut) return; // Already rejected

        if (code === 0) {
          resolve(stdout.trim());
        } else {
          // Check for API limit error
          if (stdout.includes('hit your limit') || stdout.includes('limit')) {
            reject(new Error(`Claude API limit reached. Please wait until the limit resets (usually 6pm local time).`));
          } else {
            reject(new Error(`Claude failed with code ${code}: ${stderr || stdout}`));
          }
        }
      });

      claudeProcess.on('error', (error) => {
        clearTimeout(timeoutId);
        if (timedOut) return;
        reject(new Error(`Failed to start Claude: ${error.message}`));
      });
    });
  }

  private parseSubtasks(response: string): string[] {
    const lines = response.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .filter(line => !line.startsWith('#'))
      .filter(line => !line.startsWith('```'))
      .map(line => {
        // Remove leading numbers, bullets, or dashes
        return line.replace(/^[\d\.\-\*\)]+\s*/, '').trim();
      })
      .filter(line => line.length > 0);

    return lines;
  }

  private async updateTaskFile(content: string, subtasks: string[]): Promise<void> {
    // Find the Tasks section and replace its content
    const tasksSection = subtasks.map(task => `- [ ] ${task}`).join('\n');

    // Look for existing Tasks section
    const tasksPattern = /(##\s+(Tasks|タスク)\s*\n)([\s\S]*?)(?=\n##|$)/i;
    const match = content.match(tasksPattern);

    let newContent: string;
    if (match) {
      // Replace existing tasks section content
      newContent = content.replace(tasksPattern, `$1${tasksSection}\n`);
    } else {
      // Add new Tasks section before Notes or at the end
      const notesPattern = /\n##\s+(Notes|メモ)/i;
      if (notesPattern.test(content)) {
        newContent = content.replace(notesPattern, `\n## Tasks\n${tasksSection}\n\n$&`);
      } else {
        newContent = content + `\n\n## Tasks\n${tasksSection}\n`;
      }
    }

    await fs.writeFile(this.taskFile, newContent);
  }
}
