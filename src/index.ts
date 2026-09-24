#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * A local stdio MCP server for ChatRail.
 *
 * It forwards every request to the hosted ChatRail MCP endpoint, authenticated with a workspace
 * API key. The hosted endpoint is the single source of truth for what the tools do and who may
 * call them; this process holds no business logic and stores nothing.
 *
 * Without an API key it still starts and lists the bundled tool catalog, so clients and
 * directories can inspect it. Calling a tool then explains how to configure a key.
 */

const VERSION = '0.1.0';
const DEFAULT_URL = 'https://www.chatrail.dev/v1/mcp';

interface Catalog {
  instructions: string;
  tools: Tool[];
}

const catalog = JSON.parse(
  readFileSync(new URL('../tools.json', import.meta.url), 'utf8'),
) as Catalog;

const apiKey = process.env.CHATRAIL_API_KEY?.trim() || undefined;
const endpoint = new URL(process.env.CHATRAIL_MCP_URL?.trim() || DEFAULT_URL);

const MISSING_KEY =
  'CHATRAIL_API_KEY is not set. Create a workspace API key with the mcp:read scope ' +
  '(add mcp:write to allow changes) at https://www.chatrail.dev/dashboard and pass it to ' +
  'this server as the CHATRAIL_API_KEY environment variable.';

/** Turn the hosted endpoint's HTTP refusals into messages a person can act on. */
function explain(err: unknown): unknown {
  const status = (err as { code?: unknown }).code;
  if (status === 401) {
    return new McpError(
      ErrorCode.InvalidRequest,
      'ChatRail rejected the API key. Check that CHATRAIL_API_KEY is a current workspace key.',
    );
  }
  if (status === 403) {
    return new McpError(
      ErrorCode.InvalidRequest,
      'ChatRail refused the request. The API key needs the mcp:read scope (mcp:write for ' +
        'changes), and MCP is included on the Core + AI and Team plans.',
    );
  }
  return err;
}

let upstream: Promise<Client> | undefined;

/** One connection to the hosted endpoint, opened on first use and reused afterwards. */
function connectUpstream(key: string): Promise<Client> {
  upstream ??= (async () => {
    const client = new Client({ name: 'chatrail-mcp', version: VERSION });
    const transport = new StreamableHTTPClientTransport(endpoint, {
      requestInit: {
        headers: {
          Authorization: `Bearer ${key}`,
          'User-Agent': `chatrail-mcp/${VERSION}`,
        },
      },
    });
    await client.connect(transport);
    return client;
  })().catch((err: unknown) => {
    // Let the next call try again instead of caching the failure.
    upstream = undefined;
    throw explain(err);
  });
  return upstream;
}

const server = new Server(
  { name: 'chatrail', version: VERSION },
  { capabilities: { tools: {} }, instructions: catalog.instructions },
);

server.setRequestHandler(ListToolsRequestSchema, async (request) => {
  if (!apiKey) return { tools: catalog.tools };
  const client = await connectUpstream(apiKey);
  return client.listTools(request.params).catch((err: unknown) => {
    throw explain(err);
  });
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (!apiKey) {
    return { content: [{ type: 'text' as const, text: MISSING_KEY }], isError: true };
  }
  const client = await connectUpstream(apiKey);
  return client.callTool(request.params).catch((err: unknown) => {
    throw explain(err);
  });
});

await server.connect(new StdioServerTransport());

// The client owns this process: when it closes stdin, exit rather than let the open upstream
// connection keep us alive.
process.stdin.on('close', () => process.exit(0));
