# git-conflict-mcp

A powerful Model Context Protocol (MCP) server designed to help AI agents and developers resolve Git merge conflicts efficiently. It includes a built-in visual WebUI for interactive conflict resolution.

## Features

- **MCP Tools**: Full suite of tools for agents to detect, read, and resolve git conflicts.
- **Visual WebUI**: A dedicated web interface (default: http://localhost:3456) for human-in-the-loop resolution.
  - **Syntax Highlighting**: Read code clearly with automatic language detection.
  - **Diff View**: See changes clearly with intelligent diff display.
  - **Editable Interface**: Directly edit conflicting files in the browser.
  - **IDE Integration**: One-click opening of files in your preferred editor (VSCode, WebStorm, Cursor, etc.).
- **Smart Port Management**: Automatically detects if the WebUI is already running and reuses the instance to avoid conflicts.
- **Conflict Tracking**: Keeps track of resolution status and rejection reasons.

## Usage

### via npx

You can run the server directly using `npx`. This requires no manual installation if you have Node.js installed.

```bash
npx -y git-conflict-mcp
```

The WebUI will start automatically. You can access it at:
http://localhost:3456

## MCP Configuration

### Claude Desktop

You can add the server using the `claude` CLI:

```bash
claude mcp add git-conflict-mcp -- npx -y git-conflict-mcp
```

Or manually edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "git-conflict-mcp": {
      "command": "npx",
      "args": ["-y", "git-conflict-mcp"],
      "env": {
        "WEBUI_PORT": "3456"
      }
    }
  }
}
```

### Codex

You can add the server using the `codex` CLI:

```bash
codex mcp add git-conflict-mcp -- npx -y git-conflict-mcp
```

### JSON Type (Generic)

```json
{
  "mcpServers": {
    "git-conflict-mcp": {
      "command": "npx",
      "args": ["-y", "git-conflict-mcp"]
    }
  }
}
```

## Development

To install dependencies:

```bash
npm install
```

To build (includes both Core and WebUI):

```bash
npm run build
```

To run locally:

```bash
npm start
```

To run WebUI in development mode:

```bash
npm run dev:webui
```
