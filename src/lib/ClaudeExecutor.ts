import * as fs from 'fs-extra';
import * as path from 'path';
import { spawn } from 'child_process';
import chalk from 'chalk';
import {
  TaskConfig,
  ExecutionResult,
  TaskManagerError,
  ClaudeExecutionError
} from '../types';

export class ClaudeExecutor {
  private taskFile: string;

  constructor(taskFile: string) {
    this.taskFile = taskFile;
  }

  async runTask(
    config: TaskConfig,
    verbose: boolean = false,
    debug: boolean = false,
    editPermission: boolean = true,
    logExecution: (result: ExecutionResult) => Promise<void>
  ): Promise<ExecutionResult> {
    if (!await fs.pathExists(this.taskFile)) {
      throw new TaskManagerError('No task.md file found. Run "claude-task new" first.', 'NO_TASK_FILE');
    }

    const startTime = Date.now();

    try {
      const claudeCommand = config.claudeCommand || 'claude';
      console.log(`\n Running task with ${claudeCommand}...`);

      const taskPath = path.resolve(this.taskFile);
      const relativePath = path.relative(process.cwd(), taskPath);

      const prompt = `Please execute the tasks in @${relativePath} and then exit. Do not enter interactive mode.`;

      console.log(chalk.gray(`Task file: ${relativePath}`));

      if (debug) {
        console.log(chalk.gray(`Command: ${claudeCommand}`));
        console.log(chalk.gray(`Full path: ${taskPath}`));
        console.log(chalk.gray(`Prompt: ${prompt}`));
      }

      let result: string;
      try {
        result = await this.executeClaude(prompt, claudeCommand, editPermission);
        console.log(chalk.green('\n Claude Code execution completed'));
      } catch (error) {
        console.error(chalk.red('\n Claude Code execution failed'));
        throw error;
      }
      const duration = Date.now() - startTime;

      const executionResult: ExecutionResult = {
        success: true,
        output: result,
        timestamp: new Date().toISOString(),
        duration
      };

      await logExecution(executionResult);

      return executionResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      const executionResult: ExecutionResult = {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        duration
      };

      await logExecution(executionResult);
      throw error;
    }
  }

  private async executeClaude(prompt: string, claudeCommand: string = 'claude', editPermission: boolean = true): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = editPermission
        ? ['--dangerously-skip-permissions', '--print', prompt]
        : ['--print', prompt];

      const claudeProcess = spawn(claudeCommand, args, {
        stdio: 'inherit',
        shell: false
      });

      claudeProcess.on('close', (code: number | null) => {
        if (code === 0) {
          resolve('Claude Code execution completed');
        } else {
          reject(new ClaudeExecutionError(
            `Claude Code failed with exit code ${code}`,
            code || undefined
          ));
        }
      });

      claudeProcess.on('error', (error: Error) => {
        reject(new ClaudeExecutionError(
          `Failed to start Claude Code: ${error.message}`
        ));
      });
    });
  }
}
