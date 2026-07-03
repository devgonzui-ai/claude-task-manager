import * as fs from 'fs-extra';
import * as path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TaskManager } from './TaskManager';

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

function textResult(text: string): ToolResult {
  return { content: [{ type: 'text', text }] };
}

function errorResult(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

function readPackageVersion(): string {
  try {
    const pkg = fs.readJsonSync(path.join(__dirname, '..', '..', 'package.json'));
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Build the MCP server that exposes TaskManager operations as schema-bound
 * tools. All operations route through the given TaskManager so the CLI and
 * MCP front-ends stay consistent.
 */
export function createMcpServer(taskManager: TaskManager): McpServer {
  const server = new McpServer({
    name: 'claude-task',
    version: readPackageVersion()
  });

  server.registerTool(
    'task_new',
    {
      title: 'Create a new task',
      description:
        'Create a new task in task.md. The current task (if any) is archived first. Only one task is active at a time.',
      inputSchema: {
        title: z.string().describe('Task title'),
        description: z.string().optional().describe('Task description'),
        priority: z.enum(['low', 'medium', 'high']).optional().describe('Task priority'),
        tags: z.array(z.string()).optional().describe('Tags for the task')
      }
    },
    async ({ title, description, priority, tags }) => {
      try {
        const filePath = await taskManager.createNewTask({ title, description, priority, tags });
        return textResult(`Created task "${title}" at ${filePath}`);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'task_status',
    {
      title: 'Show task status',
      description: 'Show the current task, archived task count, and execution stats.',
      inputSchema: {}
    },
    async () => {
      try {
        const status = await taskManager.getStatus();
        return textResult(JSON.stringify(status, null, 2));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'task_progress',
    {
      title: 'Show subtask progress',
      description:
        'Show subtask checkbox progress for the current task: totals, percentage, and each subtask with its 1-based number. ' +
        'Use this to seed or re-sync an in-session todo list mirroring the task — task.md is the persistent source of truth.',
      inputSchema: {}
    },
    async () => {
      try {
        const progress = await taskManager.getProgress();
        const lines = progress.tasks.map(
          (task, index) => `${index + 1}. [${task.completed ? 'x' : ' '}] ${task.text}`
        );
        return textResult(
          [
            `Task: ${progress.title}`,
            `Progress: ${progress.completed}/${progress.total} (${progress.percentage}%)`,
            ...lines
          ].join('\n')
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'task_done',
    {
      title: 'Mark subtasks done',
      description:
        'Mark subtask checkbox(es) in task.md as done (or uncheck with undo). Numbers are 1-based and match task_progress order. ' +
        'Call this before checking off any in-session todo that mirrors the subtask, so the persistent state is updated first.',
      inputSchema: {
        numbers: z.array(z.number().int().min(1)).min(1).describe('1-based subtask numbers'),
        undo: z.boolean().optional().describe('Uncheck instead of checking')
      }
    },
    async ({ numbers, undo }) => {
      try {
        const { updated, invalid, result } = await taskManager.setTaskCompletion(numbers, !undo);
        const parts = [];
        if (updated.length > 0) {
          parts.push(`${undo ? 'Unchecked' : 'Completed'} subtask(s): ${updated.join(', ')}`);
        }
        if (invalid.length > 0) {
          parts.push(`No subtask at number(s): ${invalid.join(', ')}`);
        }
        parts.push(`Progress: ${result.completed}/${result.total} (${result.percentage}%)`);
        return textResult(parts.join('\n'));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'task_split',
    {
      title: 'Split task into subtasks',
      description:
        'Split the current task into subtask checkboxes using AI. Spawns a claude CLI call in the background, so it may take a while.',
      inputSchema: {
        count: z.number().int().min(2).max(20).optional().describe('Desired number of subtasks')
      }
    },
    async ({ count }) => {
      try {
        const result = await taskManager.splitTask(count);
        if (!result.success) {
          return errorResult(result.error || 'Failed to split task');
        }
        return textResult(
          `Split task into ${result.subtasks.length} subtasks:\n` +
            result.subtasks.map((subtask, index) => `${index + 1}. ${subtask}`).join('\n')
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'task_history',
    {
      title: 'Show task history',
      description: 'List archived tasks, newest first.',
      inputSchema: {
        limit: z.number().int().min(1).optional().describe('Maximum entries to return (default 10)')
      }
    },
    async ({ limit }) => {
      try {
        const history = await taskManager.getHistory(limit ?? 10);
        if (history.length === 0) {
          return textResult('No archived tasks found.');
        }
        return textResult(history.map((item) => `- ${item.date}: ${item.title}`).join('\n'));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'task_archive',
    {
      title: 'Archive current task',
      description: 'Move the current task.md into the archive folder with a timestamp.',
      inputSchema: {}
    },
    async () => {
      try {
        const archivedPath = await taskManager.archiveCurrentTask();
        if (!archivedPath) {
          return textResult('No task to archive.');
        }
        return textResult(`Task archived: ${archivedPath}`);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  return server;
}
