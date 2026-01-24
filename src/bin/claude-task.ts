#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { TaskManager } from '../lib/TaskManager';
import { TaskOptions, TaskManagerError, ClaudeExecutionError, FileSystemError } from '../types';
import { I18n, Language } from '../lib/i18n';
import * as fs from 'fs';
import * as path from 'path';

// Read version from package.json
const packageJsonPath = path.join(__dirname, '../../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

const program = new Command();
const taskManager = new TaskManager();
const i18n = I18n.getInstance();

// Initialize i18n with system or config language
async function initI18n() {
  try {
    const lang = await taskManager.getLanguage();
    await i18n.init(lang);
  } catch {
    await i18n.init('en');
  }
}

program
  .name('claude-task')
  .description('Claude Code Task Manager')
  .version(version)
  .hook('preAction', async () => {
    await initI18n();
  });

program
  .command('init')
  .description(i18n.t('commands.init.description'))
  .action(async () => {
    try {
      await taskManager.init();
      console.log(chalk.green(i18n.t('commands.init.success')));
      console.log(chalk.gray('  Created: task.md, archive/, .claude-tasks/'));
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('new [title]')
  .description(i18n.t('commands.new.description'))
  .option('-d, --description <description>', 'Task description')
  .option('-p, --priority <priority>', 'Task priority (low, medium, high)', 'medium')
  .option('--tags <tags>', 'Task tags (comma-separated)')
  .action(async (title, options) => {
    try {
      const taskOptions: TaskOptions = {
        title: title || options.title,
        description: options.description,
        priority: options.priority as 'low' | 'medium' | 'high',
        tags: options.tags ? options.tags.split(',').map((tag: string) => tag.trim()) : undefined
      };

      const taskFile = await taskManager.createNewTask(taskOptions);
      console.log(chalk.green(i18n.t('commands.new.success', { title: taskOptions.title || 'New Task' })));
      if (taskOptions.title) {
        console.log(chalk.blue(i18n.t('commands.new.archiving')));
      }
      
      if (taskOptions.priority && taskOptions.priority !== 'medium') {
        console.log(chalk.yellow(`  Priority: ${taskOptions.priority.toUpperCase()}`));
      }
      
      if (taskOptions.tags && taskOptions.tags.length > 0) {
        console.log(chalk.cyan(`  Tags: ${taskOptions.tags.join(', ')}`));
      }
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('run')
  .description(i18n.t('commands.run.description'))
  .option('-v, --verbose', 'Verbose output')
  .option('-d, --debug', 'Debug output')
  .option('--no-edit-permission', 'Disable file edit permissions for Claude (default: edit permissions enabled)')
  .action(async (options) => {
    try {
      console.log(chalk.blue(i18n.t('commands.run.starting')));
      const startTime = Date.now();
      
      const result = await taskManager.runTask(options.verbose, options.debug, options.editPermission);
      const duration = Date.now() - startTime;
      
      if (result.success) {
        console.log(chalk.green(i18n.t('commands.run.success')));
        if (options.verbose && result.output) {
          console.log(chalk.gray('Output:'));
          console.log(result.output);
        }
      } else {
        console.log(chalk.red(i18n.t('commands.run.error', { error: result.error || 'Unknown error' })));
      }
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('history')
  .description(i18n.t('commands.history.description'))
  .option('-l, --limit <number>', 'Limit number of results', '10')
  .option('--size', 'Show file sizes')
  .action(async (options) => {
    try {
      const history = await taskManager.getHistory(parseInt(options.limit));
      
      if (history.length === 0) {
        console.log(chalk.yellow(i18n.t('commands.history.empty')));
        return;
      }

      console.log(chalk.blue(i18n.t('commands.history.title')));
      history.forEach((task) => {
        const sizeInfo = options.size && task.size ? ` (${formatBytes(task.size)})` : '';
        console.log(i18n.t('commands.history.item', { date: task.date, title: task.title }) + chalk.gray(sizeInfo));
      });
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('status')
  .description(i18n.t('commands.status.description'))
  .action(async () => {
    try {
      const status = await taskManager.getStatus();
      console.log(chalk.blue(i18n.t('commands.status.title')));
      console.log(status.currentTask 
        ? i18n.t('commands.status.currentTask', { task: chalk.yellow(status.currentTask) })
        : i18n.t('commands.status.noCurrentTask'));
      
      if (status.currentTaskSize) {
        console.log(`Task file size: ${chalk.gray(formatBytes(status.currentTaskSize))}`);
      }
      
      console.log(i18n.t('commands.status.archivedCount', { count: chalk.green(status.archivedCount.toString()) }));
      console.log(i18n.t('commands.status.totalExecutions', { count: chalk.cyan(status.totalExecutions.toString()) }));
      console.log(status.lastRun 
        ? i18n.t('commands.status.lastRun', { time: chalk.gray(status.lastRun) })
        : i18n.t('commands.status.noLastRun'));
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('archive')
  .description(i18n.t('commands.archive.description'))
  .action(async () => {
    try {
      const archivedPath = await taskManager.archiveCurrentTask();
      if (archivedPath) {
        console.log(chalk.green(i18n.t('commands.archive.success', { path: path.basename(archivedPath) })));
      } else {
        console.log(chalk.yellow(i18n.t('commands.archive.noTask')));
      }
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('claude [prompt...]')
  .description(i18n.t('commands.claude.description'))
  .action(async (promptParts: string[]) => {
    try {
      const prompt = promptParts.join(' ');
      
      if (!prompt) {
        // No prompt provided, just show task content
        console.log(chalk.blue('📋 Executing task with Claude Code...'));
        const taskContent = await taskManager.getTaskContent();
        console.log('\n' + taskContent);
        console.log('\n💡 Please use the task content above in Claude Code.');
      } else {
        // Prompt provided, execute with task context
        console.log(chalk.blue('🚀 Executing Claude Code with prompt...'));
        const taskContent = await taskManager.getTaskContent();
        console.log('\n=== TASK CONTEXT ===');
        console.log(taskContent);
        console.log('=== END TASK CONTEXT ===\n');
        console.log('📝 Your prompt:', chalk.yellow(prompt));
        console.log('\n💡 Please execute the above prompt with the task context in Claude Code.');
      }
      
      // Update execution count
      await taskManager.recordExecution({
        success: true,
        output: 'Claude Code execution initiated',
        timestamp: new Date().toISOString(),
        duration: 0
      });
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('lang [language]')
  .description(i18n.t('commands.lang.description'))
  .action(async (language?: string) => {
    try {
      if (!language) {
        const currentLang = await taskManager.getLanguage();
        console.log(i18n.t('commands.lang.current', { lang: currentLang }));
        return;
      }

      if (language !== 'en' && language !== 'ja') {
        console.log(chalk.red(i18n.t('commands.lang.invalid')));
        return;
      }

      await taskManager.setLanguage(language as Language);
      await i18n.init(language as Language);
      console.log(chalk.green(i18n.t('commands.lang.changed', { lang: language })));
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('progress')
  .description(i18n.t('commands.progress.description'))
  .action(async () => {
    try {
      const result = await taskManager.getProgress();
      console.log(taskManager.formatProgress(result));
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('split')
  .description(i18n.t('commands.split.description'))
  .option('-c, --count <number>', 'Number of subtasks to generate')
  .action(async (options) => {
    try {
      console.log(chalk.blue(i18n.t('commands.split.analyzing')));
      const count = options.count ? parseInt(options.count) : undefined;
      const result = await taskManager.splitTask(count);

      if (result.success) {
        console.log(chalk.green(i18n.t('commands.split.success', { count: result.subtasks.length })));
        console.log('');
        result.subtasks.forEach((task, index) => {
          console.log(chalk.gray(`  ${index + 1}. ${task}`));
        });
      } else {
        console.log(chalk.red(i18n.t('commands.split.error', { error: result.error })));
      }
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('hooks')
  .description(i18n.t('commands.hooks.description'))
  .option('--status', 'Show current hooks status')
  .action(async (options) => {
    try {
      if (options.status) {
        const status = await taskManager.getHooksStatus();
        if (status.configured) {
          console.log(chalk.blue('Hooks Status:'));
          console.log(chalk.green(`  Configured: ${status.hooksCount} hook(s)`));
          status.hooks.forEach(hook => {
            console.log(chalk.gray(`    - ${hook}`));
          });
        } else {
          console.log(chalk.yellow('No hooks configured. Run `claude-task hooks` to set up.'));
        }
      } else {
        await taskManager.setupHooks();
        console.log(chalk.green(i18n.t('commands.hooks.success')));
        console.log('');
        console.log(chalk.gray('Configured hooks:'));
        console.log(chalk.gray('  - Post claude-task run: Log completion'));
        console.log(chalk.gray('  - Post claude-task new: Show progress'));
        console.log(chalk.gray('  - Post claude-task archive: Show status'));
        console.log('');
        console.log(chalk.blue('Edit .claude/settings.json to customize hooks.'));
      }
    } catch (error) {
      handleError(error);
    }
  });

// Error handling function
function handleError(error: unknown): void {
  if (error instanceof ClaudeExecutionError) {
    console.error(chalk.red('Claude Execution Error:'), error.message);
    if (error.stderr) {
      console.error(chalk.gray('Claude stderr:'), error.stderr);
    }
    if (error.exitCode) {
      console.error(chalk.gray('Exit code:'), error.exitCode);
    }
  } else if (error instanceof FileSystemError) {
    console.error(chalk.red('File System Error:'), error.message);
    console.error(chalk.gray('Path:'), error.details?.path);
    console.error(chalk.gray('Operation:'), error.details?.operation);
  } else if (error instanceof TaskManagerError) {
    console.error(chalk.red('Task Manager Error:'), error.message);
    console.error(chalk.gray('Code:'), error.code);
  } else if (error instanceof Error) {
    console.error(chalk.red('Error:'), error.message);
  } else {
    console.error(chalk.red('Unknown error occurred'));
  }
  process.exit(1);
}

// Utility function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Handle unknown commands
program.on('command:*', () => {
  console.error(chalk.red('Invalid command. See --help for available commands.'));
  process.exit(1);
});

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
