# git-conflict-mcp

## Usage / 使い方

### via npx

You can run the server directly using `npx`. This requires no manual installation if you have Node.js installed.

```bash
npx -y git-conflict-mcp
```

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
      "args": ["-y", "git-conflict-mcp"]
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

To build:

```bash
npm run build
```

To run locally:

```bash
npm start
```
