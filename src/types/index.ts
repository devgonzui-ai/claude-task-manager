export interface TaskConfig {
  created: string;
  taskTemplate: string;
  claudeCommand: string;
  defaultTaskTitle?: string;
  archiveDir?: string;
  language?: 'en' | 'ja';
  defaultPrerequisites?: string | string[];
  defaultRules?: string | string[];
  defaultTasks?: string | string[];
  /** Name of the active task in multi-task mode (see .claude-tasks/tasks/). */
  activeTask?: string;
}

export interface TaskOptions {
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  prerequisites?: string;
  rules?: string;
  tasks?: string;
  /** Create the task under this name and switch to it, without archiving. */
  name?: string;
}

export interface TaskListItem {
  name: string;
  title: string;
  active: boolean;
  completed: number;
  total: number;
  percentage: number;
}

export interface TaskMetadata {
  title: string;
  description: string;
  created: string;
  lastModified: string;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  status: 'active' | 'completed' | 'archived';
}

export interface TaskHistoryItem {
  file: string;
  title: string;
  date: string;
  path: string;
  metadata?: TaskMetadata;
  size?: number;
}

export interface TaskStatus {
  /** Active task name in multi-task mode; absent in single-task mode. */
  activeTaskName?: string | null;
  currentTask: string | null;
  archivedCount: number;
  lastRun: string | null;
  totalExecutions: number;
  currentTaskSize?: number;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  timestamp: string;
  duration: number;
}

export interface TemplateVariables {
  TITLE: string;
  DESCRIPTION: string;
  DATE: string;
  TIMESTAMP: string;
  PRIORITY: string;
  TAGS: string;
  PREREQUISITES: string;
  RULES: string;
  TASKS: string;
}

export interface ClaudeTaskManagerConfig {
  workingDir: string;
  taskFile: string;
  archiveDir: string;
  configDir: string;
  configFile: string;
}

export class TaskManagerError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TaskManagerError';
  }
}

export class ClaudeExecutionError extends TaskManagerError {
  constructor(message: string, public exitCode?: number, public stderr?: string) {
    super(message, 'CLAUDE_EXECUTION_ERROR', { exitCode, stderr });
  }
}

export class FileSystemError extends TaskManagerError {
  constructor(message: string, public path: string, public operation: string) {
    super(message, 'FILESYSTEM_ERROR', { path, operation });
  }
}
