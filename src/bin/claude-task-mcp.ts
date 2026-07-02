#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { TaskManager } from '../lib/TaskManager';
import { createMcpServer } from '../lib/McpServer';

async function main(): Promise<void> {
  // stdout carries the JSON-RPC stream; route all library logging to stderr
  // so TaskManager's console output never corrupts the protocol.
  console.log = (...args: Parameters<typeof console.error>) => console.error(...args);

  const taskManager = new TaskManager();
  const server = createMcpServer(taskManager);
  await server.connect(new StdioServerTransport());
  console.error('claude-task MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in claude-task MCP server:', error);
  process.exit(1);
});
