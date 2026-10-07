# ChatRail MCP server

[![npm version](https://img.shields.io/npm/v/chatrail-mcp)](https://www.npmjs.com/package/chatrail-mcp)
[![npm downloads](https://img.shields.io/npm/dm/chatrail-mcp)](https://www.npmjs.com/package/chatrail-mcp)

Operate a [ChatRail](https://www.chatrail.dev) workspace from Claude, Cursor, VS Code and any other
[Model Context Protocol](https://modelcontextprotocol.io) client. Check the health of your WhatsApp
connections, look up groups, trace why a message failed, manage scheduled messages and replay
webhook deliveries without leaving your editor.

ChatRail is a WhatsApp API for developers: send and receive WhatsApp messages over HTTP from a number
you already have. See the [MCP documentation](https://www.chatrail.dev/mcp) for the full reference.

## Privacy by design

- Message bodies, recipient phone numbers and credentials are never returned by any tool.
- Tools that change state return a preview first and apply only when called again with
  `confirm: true`.
- Every call is scoped to one workspace and recorded in its audit log.

## Two ways to connect

### 1. Hosted server with OAuth (recommended)

Point any client that supports remote MCP servers at:

```
https://www.chatrail.dev/v1/mcp
```

Your client opens a browser window where a workspace owner, admin or developer approves access.
Nothing to install and no key to copy.

**Claude Code**

```bash
claude mcp add --transport http chatrail https://www.chatrail.dev/v1/mcp
```

**Cursor** (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "chatrail": { "url": "https://www.chatrail.dev/v1/mcp" }
  }
}
```

**VS Code** (`.vscode/mcp.json`)

```json
{
  "servers": {
    "chatrail": { "type": "http", "url": "https://www.chatrail.dev/v1/mcp" }
  }
}
```

### 2. Local stdio server with an API key

For clients that only run local servers, or when you would rather use an API key. This package runs
on your machine and forwards requests to the hosted server.

1. In the [ChatRail dashboard](https://www.chatrail.dev/dashboard), create a workspace API key with
   the `mcp:read` scope. Add `mcp:write` if the assistant may reschedule, cancel, react or replay.
2. Add the server to your client.

**Claude Desktop** (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "chatrail": {
      "command": "npx",
      "args": ["-y", "chatrail-mcp"],
      "env": { "CHATRAIL_API_KEY": "cr_live_..." }
    }
  }
}
```

The package is published on npm as `chatrail-mcp`, so `npx` fetches it from the
registry. If you need a version that is not published yet, run it straight from
the repository instead:

```json
"args": ["-y", "github:chatrail/chatrail_mcp"]
```

**Docker**

```bash
docker build -t chatrail-mcp .
docker run -i --rm -e CHATRAIL_API_KEY=cr_live_... chatrail-mcp
```

| Variable | Required | Description |
| --- | --- | --- |
| `CHATRAIL_API_KEY` | Yes, to call tools | Workspace API key with `mcp:read` (and optionally `mcp:write`). |
| `CHATRAIL_MCP_URL` | No | Override the endpoint. Defaults to `https://www.chatrail.dev/v1/mcp`. |

Without a key the server still starts and lists its tools, so you can inspect it before signing up.

## Tools

| Tool | Scope | What it does |
| --- | --- | --- |
| `list_connections` | read | Every WhatsApp connection in the workspace with its state and health. |
| `get_connection` | read | One connection with its state, health and recent state history. |
| `list_whatsapp_groups` | read | Groups visible to a connected number, with ids and participant counts. |
| `get_whatsapp_group` | read | Name, description, settings and member counts for one group. |
| `list_messages` | read | Recent messages with their delivery state. |
| `get_message` | read | One message and its delivery timeline. |
| `explain_message_failure` | read | A structured explanation of why a message failed. |
| `list_scheduled_messages` | read | Messages waiting to be sent, soonest first. |
| `list_webhook_deliveries` | read | Recent webhook deliveries and their outcomes. |
| `reschedule_message` | write | Change when a scheduled message is sent. Previews first. |
| `cancel_scheduled_message` | write | Cancel a message that has not been sent. Previews first. |
| `react_to_message` | write | Set or remove an emoji reaction on a message. Previews first. |
| `replay_webhook` | write | Requeue a dead or skipped webhook delivery. Previews first. |

## Plans

MCP access is included on the ChatRail **Core + AI** and **Team** plans. See
[pricing](https://www.chatrail.dev/pricing).

## Development

```bash
npm install
npm run build
CHATRAIL_API_KEY=cr_test_... node dist/index.js
```

`tools.json` is the tool catalog served when no API key is configured. It is exported from the
hosted server and should be refreshed when the hosted tools change.

## Agent skill

ChatRail publishes a skill file that tells an agent when to use ChatRail, what a person has to set
up, how to send and receive, and the rules for sending. This MCP server operates a workspace and
cannot send messages, so the skill points to the REST API for sending.

Give your agent this line:

```
Read https://www.chatrail.dev/SKILL.md and follow it to set up ChatRail.
```

Or install it yourself in Claude Code:

```bash
mkdir -p ~/.claude/skills/chatrail
curl -fsSL https://www.chatrail.dev/SKILL.md -o ~/.claude/skills/chatrail/SKILL.md
```

The canonical file is https://www.chatrail.dev/SKILL.md. A copy lives in this repository at
`skills/chatrail/SKILL.md` so tools that install skills from GitHub can find it.

## Links

- Website: <https://www.chatrail.dev>
- MCP docs: <https://www.chatrail.dev/mcp>
- API reference: <https://www.chatrail.dev/api-reference>
- Authentication: <https://www.chatrail.dev/auth.md>
- Agent skill: <https://www.chatrail.dev/SKILL.md>

## License

[MIT](LICENSE)
