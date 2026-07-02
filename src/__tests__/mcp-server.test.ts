import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { TaskManager } from '../lib/TaskManager';
import { createMcpServer } from '../lib/McpServer';

async function createTempDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'claude-task-mcp-test-'));
}

function resultText(result: unknown): string {
  const { content } = result as { content: Array<{ type: string; text: string }> };
  return content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

describe('claude-task MCP server', () => {
  let tempDir: string;
  let taskManager: TaskManager;
  let server: ReturnType<typeof createMcpServer>;
  let client: Client;

  beforeEach(async () => {
    tempDir = await createTempDir();
    taskManager = new TaskManager(tempDir);
    await taskManager.init();

    server = createMcpServer(taskManager);
    client = new Client({ name: 'test-client', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
    await fs.remove(tempDir);
  });

  it('exposes the full task tool set', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name).sort();
    expect(names).toEqual([
      'task_archive',
      'task_done',
      'task_history',
      'task_new',
      'task_progress',
      'task_split',
      'task_status'
    ]);
  });

  it('task_new creates task.md through TaskManager', async () => {
    const result = await client.callTool({
      name: 'task_new',
      arguments: { title: 'MCP Test Task', priority: 'high' }
    });

    expect(result.isError).toBeFalsy();
    expect(resultText(result)).toContain('MCP Test Task');

    const taskContent = await fs.readFile(path.join(tempDir, 'task.md'), 'utf8');
    expect(taskContent).toContain('MCP Test Task');
    expect(taskContent).toContain('high');
  });

  it('task_status reports the current task', async () => {
    await client.callTool({ name: 'task_new', arguments: { title: 'Status Task' } });

    const result = await client.callTool({ name: 'task_status', arguments: {} });

    expect(result.isError).toBeFalsy();
    const status = JSON.parse(resultText(result));
    expect(status.currentTask).toContain('Status Task');
  });

  it('task_progress and task_done work with subtask checkboxes', async () => {
    await client.callTool({
      name: 'task_new',
      arguments: { title: 'Progress Task' }
    });
    await fs.appendFile(
      path.join(tempDir, 'task.md'),
      '\n- [ ] First step\n- [ ] Second step\n'
    );

    const progress = await client.callTool({ name: 'task_progress', arguments: {} });
    expect(resultText(progress)).toContain('0/2');

    const done = await client.callTool({ name: 'task_done', arguments: { numbers: [1] } });
    expect(resultText(done)).toContain('Completed subtask(s): 1');
    expect(resultText(done)).toContain('1/2');

    const undone = await client.callTool({
      name: 'task_done',
      arguments: { numbers: [1], undo: true }
    });
    expect(resultText(undone)).toContain('Unchecked subtask(s): 1');
    expect(resultText(undone)).toContain('0/2');
  });

  it('task_done reports invalid subtask numbers', async () => {
    await client.callTool({ name: 'task_new', arguments: { title: 'Invalid Done Task' } });
    await fs.appendFile(path.join(tempDir, 'task.md'), '\n- [ ] Only step\n');

    const result = await client.callTool({ name: 'task_done', arguments: { numbers: [5] } });
    expect(resultText(result)).toContain('No subtask at number(s): 5');
  });

  it('task_archive moves the task and task_history lists it', async () => {
    await client.callTool({ name: 'task_new', arguments: { title: 'Archive Me' } });

    const archived = await client.callTool({ name: 'task_archive', arguments: {} });
    expect(resultText(archived)).toContain('Task archived:');
    expect(await fs.pathExists(path.join(tempDir, 'task.md'))).toBe(false);

    const history = await client.callTool({ name: 'task_history', arguments: {} });
    expect(resultText(history)).toContain('Archive Me');
  });

  it('returns isError for operations without a task file', async () => {
    await taskManager.archiveCurrentTask();

    const result = await client.callTool({ name: 'task_progress', arguments: {} });
    expect(result.isError).toBe(true);
    expect(resultText(result)).toContain('Error:');
  });
});
