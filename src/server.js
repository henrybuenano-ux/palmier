import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { registerTools } from './tools.js';

const HOST = '127.0.0.1';
const PORT = 19789;

function getServer() {
  const server = new McpServer({ name: 'palmier-pro', version: '1.0.0' });
  registerTools(server);
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
