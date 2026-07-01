import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { z } from 'zod';

const HOST = '127.0.0.1';
const PORT = 19789;

let nextId = 1;
const todos = new Map();

function serializeTodo(todo) {
  return { id: todo.id, text: todo.text, done: todo.done };
}

function textResult(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

function getServer() {
  const server = new McpServer({ name: 'palmier-pro', version: '1.0.0' });

  server.registerTool(
    'add_todo',
    {
      title: 'Add todo',
      description: 'Add a new todo item to the list',
      inputSchema: { text: z.string().describe('The todo item text') }
    },
    async ({ text }) => {
      const todo = { id: nextId++, text, done: false };
      todos.set(todo.id, todo);
      return textResult(serializeTodo(todo));
    }
  );

  server.registerTool(
    'list_todos',
    {
      title: 'List todos',
      description: 'List all todo items',
      inputSchema: {}
    },
    async () => textResult([...todos.values()].map(serializeTodo))
  );

  server.registerTool(
    'complete_todo',
    {
      title: 'Complete todo',
      description: 'Mark a todo item as done',
      inputSchema: { id: z.number().int().describe('The todo id') }
    },
    async ({ id }) => {
      const todo = todos.get(id);
      if (!todo) {
        return { content: [{ type: 'text', text: `No todo with id ${id}` }], isError: true };
      }
      todo.done = true;
      return textResult(serializeTodo(todo));
    }
  );

  server.registerTool(
    'delete_todo',
    {
      title: 'Delete todo',
      description: 'Remove a todo item from the list',
      inputSchema: { id: z.number().int().describe('The todo id') }
    },
    async ({ id }) => {
      const existed = todos.delete(id);
      if (!existed) {
        return { content: [{ type: 'text', text: `No todo with id ${id}` }], isError: true };
      }
      return textResult({ deleted: id });
    }
  );

  return server;
}

const app = createMcpExpressApp({ host: HOST });

app.post('/mcp', async (req, res) => {
  try {
    const server = getServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('close', () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null
      });
    }
  }
});

app.get('/mcp', async (_req, res) => {
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed.' },
      id: null
    })
  );
});

app.delete('/mcp', async (_req, res) => {
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed.' },
      id: null
    })
  );
});

app.listen(PORT, HOST, () => {
  console.log(`palmier-pro MCP server listening on http://${HOST}:${PORT}/mcp`);
});

process.on('SIGINT', () => process.exit(0));
