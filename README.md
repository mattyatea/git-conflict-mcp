# git-conflict-mcp

## Installation / インストール

### English
You can easily install the latest version using the `install.sh` script. This will download the appropriate binary for your platform from the latest GitHub Release.

```bash
curl -fsSL https://raw.githubusercontent.com/mattyatea/git-conflict-mcp/main/install.sh | bash
```

After running the script, follow the instructions to move the binary to your executable path (e.g., `/usr/local/bin`).

### 日本語
`install.sh` スクリプトを使用して、最新バージョンを簡単にインストールできます。このスクリプトは、GitHubの最新リリースからプラットフォームに適したバイナリをダウンロードします。

```bash
curl -fsSL https://raw.githubusercontent.com/mattyatea/git-conflict-mcp/main/install.sh | bash
```

スクリプトの実行後、表示される指示に従ってバイナリを実行パス（例: `/usr/local/bin`）に移動してください。

## Development

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.2.9. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
