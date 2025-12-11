#!/usr/bin/env node
import * as http from "http";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.WEBUI_PORT || "3456");

export interface PendingResolve {
    id: string;
    filePath: string;         // Relative path
    absolutePath: string;     // Absolute path
    projectPath: string;
    type: "resolve" | "delete" | "add";
    fileContent?: string;     // Current file content (if exists)
    gitDiff?: string;         // Git diff output
    timestamp: number;
}

// In-memory pending resolves
const pendingResolves: Map<string, PendingResolve> = new Map();

// Generate unique ID
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Run git command
async function runGit(args: string[], cwd: string): Promise<string> {
    try {
        const { stdout } = await execFileAsync("git", args, { cwd });
        return stdout;
    } catch (error: any) {
        throw new Error(`Git command failed: ${error.stderr || error.message}`);
    }
}

// Get file content with conflict markers
async function getFileContent(absolutePath: string): Promise<string | undefined> {
    try {
        return await fs.readFile(absolutePath, "utf-8");
    } catch {
        return undefined;
    }
}

// Get git diff for the file
async function getGitDiff(filePath: string, projectPath: string): Promise<string> {
    try {
        return await runGit(["diff", filePath], projectPath);
    } catch {
        return "";
    }
}

// Serve static HTML
function getIndexHtml(): string {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Git Conflict Resolution - 確認UI</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-primary: #0d1117;
            --bg-secondary: #161b22;
            --bg-tertiary: #21262d;
            --border-color: #30363d;
            --text-primary: #e6edf3;
            --text-secondary: #8b949e;
            --accent-green: #3fb950;
            --accent-green-hover: #2ea043;
            --accent-red: #f85149;
            --accent-red-hover: #da3633;
            --accent-blue: #58a6ff;
            --accent-yellow: #d29922;
            --shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            --gradient-green: linear-gradient(135deg, #3fb950 0%, #2ea043 100%);
            --gradient-red: linear-gradient(135deg, #f85149 0%, #da3633 100%);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            min-height: 100vh;
            line-height: 1.6;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 2rem;
        }

        header {
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border-color);
            padding: 1.5rem 2rem;
            position: sticky;
            top: 0;
            z-index: 100;
            backdrop-filter: blur(10px);
        }

        .header-content {
            max-width: 1400px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .logo {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .logo-icon {
            width: 40px;
            height: 40px;
            background: var(--gradient-green);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.25rem;
        }

        .logo h1 {
            font-size: 1.5rem;
            font-weight: 600;
            background: linear-gradient(135deg, var(--text-primary) 0%, var(--accent-blue) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .status-badge {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background: var(--bg-tertiary);
            border-radius: 20px;
            font-size: 0.875rem;
            color: var(--text-secondary);
        }

        .status-dot {
            width: 8px;
            height: 8px;
            background: var(--accent-green);
            border-radius: 50%;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .empty-state {
            text-align: center;
            padding: 6rem 2rem;
            color: var(--text-secondary);
        }

        .empty-icon {
            font-size: 4rem;
            margin-bottom: 1.5rem;
            opacity: 0.5;
        }

        .empty-state h2 {
            font-size: 1.5rem;
            font-weight: 500;
            margin-bottom: 0.5rem;
            color: var(--text-primary);
        }

        .pending-list {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
            margin-top: 2rem;
        }

        .pending-card {
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: var(--shadow);
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .pending-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
        }

        .card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1.25rem 1.5rem;
            background: var(--bg-tertiary);
            border-bottom: 1px solid var(--border-color);
        }

        .file-info {
            display: flex;
            align-items: center;
            gap: 1rem;
        }

        .file-icon {
            width: 42px;
            height: 42px;
            background: rgba(88, 166, 255, 0.15);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.25rem;
        }

        .file-details h3 {
            font-size: 1rem;
            font-weight: 600;
            font-family: 'JetBrains Mono', monospace;
            color: var(--accent-blue);
        }

        .file-details .file-path {
            font-size: 0.75rem;
            color: var(--text-secondary);
            margin-top: 0.25rem;
        }

        .type-badge {
            padding: 0.375rem 0.875rem;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .type-resolve {
            background: rgba(63, 185, 80, 0.15);
            color: var(--accent-green);
        }

        .type-delete {
            background: rgba(248, 81, 73, 0.15);
            color: var(--accent-red);
        }

        .type-add {
            background: rgba(88, 166, 255, 0.15);
            color: var(--accent-blue);
        }

        .card-content {
            padding: 1.5rem;
        }

        .code-preview {
            background: var(--bg-primary);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            padding: 0;
            max-height: 500px;
            overflow: auto;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.8125rem;
            line-height: 1.5;
        }

        .code-preview .conflict-ours {
            background: rgba(63, 185, 80, 0.15);
            display: block;
            margin: 0 -1rem;
            padding: 0 1rem;
        }

        .code-preview .conflict-theirs {
            background: rgba(248, 81, 73, 0.15);
            display: block;
            margin: 0 -1rem;
            padding: 0 1rem;
        }

        .code-preview .conflict-marker {
            color: var(--accent-yellow);
            font-weight: 600;
        }

        /* Diff styles */
        .diff-view {
            width: 100%;
        }

        .diff-line {
            display: flex;
            min-height: 1.75em;
        }

        .diff-line-num {
            width: 50px;
            min-width: 50px;
            padding: 0 0.5rem;
            text-align: right;
            color: var(--text-secondary);
            background: var(--bg-secondary);
            border-right: 1px solid var(--border-color);
            user-select: none;
            font-size: 0.75rem;
            display: flex;
            align-items: center;
            justify-content: flex-end;
        }

        .diff-line-content {
            flex: 1;
            padding: 0 0.75rem;
            white-space: pre-wrap;
            word-break: break-all;
        }

        .diff-line.addition {
            background: rgba(46, 160, 67, 0.2);
        }

        .diff-line.addition .diff-line-num {
            background: rgba(46, 160, 67, 0.3);
            color: var(--accent-green);
        }

        .diff-line.addition .diff-line-content::before {
            content: '+';
            color: var(--accent-green);
            font-weight: bold;
            margin-right: 0.5rem;
        }

        .diff-line.deletion {
            background: rgba(248, 81, 73, 0.2);
        }

        .diff-line.deletion .diff-line-num {
            background: rgba(248, 81, 73, 0.3);
            color: var(--accent-red);
        }

        .diff-line.deletion .diff-line-content::before {
            content: '-';
            color: var(--accent-red);
            font-weight: bold;
            margin-right: 0.5rem;
        }

        .diff-line.context .diff-line-content::before {
            content: ' ';
            margin-right: 0.5rem;
        }

        .diff-line.header {
            background: rgba(88, 166, 255, 0.1);
            color: var(--accent-blue);
            font-weight: 500;
        }

        .diff-line.header .diff-line-num {
            background: rgba(88, 166, 255, 0.15);
        }

        .diff-line.hunk-header {
            background: rgba(136, 87, 255, 0.15);
            color: #a371f7;
        }

        .diff-line.hunk-header .diff-line-num {
            background: rgba(136, 87, 255, 0.2);
        }

        .diff-stats {
            display: flex;
            gap: 1rem;
            padding: 0.75rem 1rem;
            background: var(--bg-tertiary);
            border-bottom: 1px solid var(--border-color);
            font-size: 0.875rem;
            border-radius: 10px 10px 0 0;
        }

        .diff-stats .additions {
            color: var(--accent-green);
        }

        .diff-stats .deletions {
            color: var(--accent-red);
        }

        .view-toggle {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 1rem;
        }

        .view-toggle button {
            padding: 0.5rem 1rem;
            border: 1px solid var(--border-color);
            background: var(--bg-tertiary);
            color: var(--text-secondary);
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.8125rem;
            transition: all 0.2s;
        }

        .view-toggle button.active {
            background: var(--accent-blue);
            border-color: var(--accent-blue);
            color: white;
        }

        .view-toggle button:hover:not(.active) {
            background: var(--border-color);
        }

        .raw-content {
            padding: 1rem;
            white-space: pre-wrap;
            word-break: break-all;
        }

        .card-actions {
            display: flex;
            gap: 1rem;
            padding: 1.25rem 1.5rem;
            background: var(--bg-tertiary);
            border-top: 1px solid var(--border-color);
        }

        .btn {
            flex: 1;
            padding: 0.875rem 1.5rem;
            border: none;
            border-radius: 10px;
            font-size: 0.9375rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
        }

        .btn-resolve {
            background: var(--gradient-green);
            color: white;
        }

        .btn-resolve:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 20px rgba(63, 185, 80, 0.4);
        }

        .btn-reject {
            background: var(--bg-primary);
            color: var(--accent-red);
            border: 1px solid var(--accent-red);
        }

        .btn-reject:hover {
            background: rgba(248, 81, 73, 0.1);
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none !important;
        }

        .timestamp {
            font-size: 0.75rem;
            color: var(--text-secondary);
            margin-top: 0.5rem;
        }

        .toast {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            padding: 1rem 1.5rem;
            border-radius: 10px;
            font-weight: 500;
            transform: translateY(100px);
            opacity: 0;
            transition: all 0.3s;
            z-index: 1000;
        }

        .toast.show {
            transform: translateY(0);
            opacity: 1;
        }

        .toast.success {
            background: var(--accent-green);
            color: white;
        }

        .toast.error {
            background: var(--accent-red);
            color: white;
        }

        .refresh-btn {
            background: var(--bg-tertiary);
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            padding: 0.5rem 1rem;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.875rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            transition: all 0.2s;
        }

        .refresh-btn:hover {
            background: var(--border-color);
        }

        .section-title {
            font-size: 1.125rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
            color: var(--text-secondary);
        }

        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }
            
            .header-content {
                flex-direction: column;
                gap: 1rem;
            }
            
            .card-actions {
                flex-direction: column;
            }
        }
    </style>
</head>
<body>
    <header>
        <div class="header-content">
            <div class="logo">
                <div class="logo-icon">🔀</div>
                <h1>Conflict Resolution</h1>
            </div>
            <div style="display: flex; gap: 1rem; align-items: center;">
                <button class="refresh-btn" onclick="loadPending()">
                    🔄 更新
                </button>
                <div class="status-badge">
                    <span class="status-dot"></span>
                    <span id="pending-count">0</span> 件の確認待ち
                </div>
            </div>
        </div>
    </header>

    <div class="container">
        <div id="pending-container"></div>
    </div>

    <div id="toast" class="toast"></div>

    <script>
        function formatTime(timestamp) {
            const date = new Date(timestamp);
            return date.toLocaleString('ja-JP');
        }

        function highlightConflicts(content) {
            if (!content) return '<span style="color: var(--text-secondary);">（ファイルが存在しないか読み取れません）</span>';
            
            return content
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/^(&lt;&lt;&lt;&lt;&lt;&lt;&lt;.*$)/gm, '<span class="conflict-marker">$1</span>')
                .replace(/^(=======)$/gm, '<span class="conflict-marker">$1</span>')
                .replace(/^(&gt;&gt;&gt;&gt;&gt;&gt;&gt;.*$)/gm, '<span class="conflict-marker">$1</span>');
        }

        function escapeHtml(text) {
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }

        function parseAndRenderDiff(diffText) {
            if (!diffText || diffText.trim() === '') {
                return '<div class="raw-content" style="color: var(--text-secondary);">差分情報がありません</div>';
            }

            const lines = diffText.split('\\n');
            let html = '<div class="diff-view">';
            let additions = 0;
            let deletions = 0;
            let lineNumber = 0;

            lines.forEach((line, index) => {
                let lineClass = 'context';
                let displayLineNum = '';
                const escapedLine = escapeHtml(line);

                if (line.startsWith('diff --git') || line.startsWith('index ') || 
                    line.startsWith('---') || line.startsWith('+++')) {
                    lineClass = 'header';
                } else if (line.startsWith('@@')) {
                    lineClass = 'hunk-header';
                    // Parse line numbers from hunk header
                    const match = line.match(/@@ -\\d+(?:,\\d+)? \\+(\\d+)/);
                    if (match) {
                        lineNumber = parseInt(match[1]) - 1;
                    }
                } else if (line.startsWith('+') && !line.startsWith('+++')) {
                    lineClass = 'addition';
                    additions++;
                    lineNumber++;
                    displayLineNum = lineNumber.toString();
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                    lineClass = 'deletion';
                    deletions++;
                    displayLineNum = '';
                } else if (line.trim() !== '' || index < lines.length - 1) {
                    lineClass = 'context';
                    lineNumber++;
                    displayLineNum = lineNumber.toString();
                }

                // Remove the leading +/- for display (we show it via CSS)
                let displayContent = escapedLine;
                if (lineClass === 'addition' || lineClass === 'deletion') {
                    displayContent = escapedLine.substring(1);
                }

                html += '<div class="diff-line ' + lineClass + '">' +
                    '<span class="diff-line-num">' + displayLineNum + '</span>' +
                    '<span class="diff-line-content">' + displayContent + '</span>' +
                    '</div>';
            });

            html += '</div>';

            // Add stats header
            const statsHtml = '<div class="diff-stats">' +
                '<span class="additions">+' + additions + ' 追加</span>' +
                '<span class="deletions">-' + deletions + ' 削除</span>' +
                '</div>';

            return statsHtml + html;
        }

        function renderContent(item, viewMode) {
            if (viewMode === 'diff' && item.gitDiff) {
                return parseAndRenderDiff(item.gitDiff);
            } else {
                return '<div class="raw-content">' + highlightConflicts(item.fileContent) + '</div>';
            }
        }

        function toggleView(id, viewMode) {
            const container = document.querySelector('#content-' + id);
            const item = window.pendingData.find(i => i.id === id);
            if (container && item) {
                container.innerHTML = renderContent(item, viewMode);
            }
            // Update button states
            document.querySelectorAll('#card-' + id + ' .view-toggle button').forEach(btn => {
                btn.classList.remove('active');
            });
            const activeBtn = document.querySelector('#card-' + id + ' .view-toggle button[data-view="' + viewMode + '"]');
            if (activeBtn) activeBtn.classList.add('active');
        }

        window.pendingData = [];

        function getTypeLabel(type) {
            switch(type) {
                case 'resolve': return 'Resolve (git add)';
                case 'delete': return 'Delete (git rm)';
                case 'add': return 'Add (git add)';
                default: return type;
            }
        }

        function showToast(message, type = 'success') {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = 'toast ' + type + ' show';
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }

        async function loadPending() {
            try {
                const res = await fetch('/api/pending');
                const data = await res.json();
                
                document.getElementById('pending-count').textContent = data.length;
                
                const container = document.getElementById('pending-container');
                
                if (data.length === 0) {
                    container.innerHTML = \`
                        <div class="empty-state">
                            <div class="empty-icon">✅</div>
                            <h2>確認待ちの解決はありません</h2>
                            <p>新しい解決リクエストが来ると、ここに表示されます</p>
                        </div>
                    \`;
                    return;
                }

                window.pendingData = data;

                container.innerHTML = \`
                    <h2 class="section-title">確認待ちの解決リクエスト</h2>
                    <div class="pending-list">
                        \${data.map(item => \`
                            <div class="pending-card" id="card-\${item.id}">
                                <div class="card-header">
                                    <div class="file-info">
                                        <div class="file-icon">📄</div>
                                        <div class="file-details">
                                            <h3>\${item.filePath}</h3>
                                            <div class="file-path">\${item.projectPath}</div>
                                        </div>
                                    </div>
                                    <span class="type-badge type-\${item.type}">\${getTypeLabel(item.type)}</span>
                                </div>
                                <div class="card-content">
                                    <div class="view-toggle">
                                        <button data-view="diff" class="\${item.gitDiff ? 'active' : ''}" onclick="toggleView('\${item.id}', 'diff')">📊 差分表示</button>
                                        <button data-view="raw" class="\${!item.gitDiff ? 'active' : ''}" onclick="toggleView('\${item.id}', 'raw')">📄 ファイル内容</button>
                                    </div>
                                    <div class="code-preview" id="content-\${item.id}">\${renderContent(item, item.gitDiff ? 'diff' : 'raw')}</div>
                                    <div class="timestamp">リクエスト時刻: \${formatTime(item.timestamp)}</div>
                                </div>
                                <div class="card-actions">
                                    <button class="btn btn-reject" onclick="rejectResolve('\${item.id}')">
                                        ❌ 拒否
                                    </button>
                                    <button class="btn btn-resolve" onclick="approveResolve('\${item.id}')">
                                        ✅ 解決を実行
                                    </button>
                                </div>
                            </div>
                        \`).join('')}
                    </div>
                \`;
            } catch (e) {
                console.error('Failed to load pending:', e);
                showToast('データの読み込みに失敗しました', 'error');
            }
        }

        async function approveResolve(id) {
            const card = document.getElementById('card-' + id);
            const buttons = card.querySelectorAll('button');
            buttons.forEach(btn => btn.disabled = true);

            try {
                const res = await fetch('/api/approve/' + id, { method: 'POST' });
                const data = await res.json();
                
                if (data.success) {
                    showToast('解決を実行しました: ' + data.message);
                    card.style.opacity = '0.5';
                    setTimeout(() => loadPending(), 500);
                } else {
                    showToast('エラー: ' + data.error, 'error');
                    buttons.forEach(btn => btn.disabled = false);
                }
            } catch (e) {
                showToast('リクエストに失敗しました', 'error');
                buttons.forEach(btn => btn.disabled = false);
            }
        }

        async function rejectResolve(id) {
            const card = document.getElementById('card-' + id);
            const buttons = card.querySelectorAll('button');
            buttons.forEach(btn => btn.disabled = true);

            try {
                const res = await fetch('/api/reject/' + id, { method: 'POST' });
                const data = await res.json();
                
                if (data.success) {
                    showToast('解決を拒否しました');
                    card.style.opacity = '0.5';
                    setTimeout(() => loadPending(), 500);
                } else {
                    showToast('エラー: ' + data.error, 'error');
                    buttons.forEach(btn => btn.disabled = false);
                }
            } catch (e) {
                showToast('リクエストに失敗しました', 'error');
                buttons.forEach(btn => btn.disabled = false);
            }
        }

        // Initial load
        loadPending();
        
        // Auto refresh every 5 seconds
        setInterval(loadPending, 5000);
    </script>
</body>
</html>`;
}

// Request handlers
async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url || "/", `http://localhost:${PORT}`);
    const pathname = url.pathname;
    const method = req.method || "GET";

    // CORS headers for localhost
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    // Routes
    if (pathname === "/" && method === "GET") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(getIndexHtml());
        return;
    }

    if (pathname === "/api/pending" && method === "GET") {
        const pending = Array.from(pendingResolves.values());
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(pending));
        return;
    }

    if (pathname === "/api/add" && method === "POST") {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", async () => {
            try {
                const data = JSON.parse(body);
                const id = generateId();

                const fileContent = await getFileContent(data.absolutePath);
                const gitDiff = await getGitDiff(data.filePath, data.projectPath);

                const pending: PendingResolve = {
                    id,
                    filePath: data.filePath,
                    absolutePath: data.absolutePath,
                    projectPath: data.projectPath,
                    type: data.type || "resolve",
                    fileContent,
                    gitDiff,
                    timestamp: Date.now(),
                };

                pendingResolves.set(id, pending);

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: true, id }));
            } catch (e: any) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    if (pathname.startsWith("/api/approve/") && method === "POST") {
        const id = pathname.replace("/api/approve/", "");
        const pending = pendingResolves.get(id);

        if (!pending) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: "Not found" }));
            return;
        }

        try {
            let message: string;
            switch (pending.type) {
                case "delete":
                    await runGit(["rm", pending.filePath], pending.projectPath);
                    message = `Deleted (git rm) ${pending.filePath}`;
                    break;
                case "add":
                case "resolve":
                default:
                    await runGit(["add", pending.filePath], pending.projectPath);
                    message = `Resolved (git add) ${pending.filePath}`;
                    break;
            }

            pendingResolves.delete(id);

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, message }));
        } catch (e: any) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: e.message }));
        }
        return;
    }

    if (pathname.startsWith("/api/reject/") && method === "POST") {
        const id = pathname.replace("/api/reject/", "");

        if (!pendingResolves.has(id)) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: "Not found" }));
            return;
        }

        pendingResolves.delete(id);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    // 404
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
}

// Start server function (exported for use in main index.ts)
export function startWebUIServer(port: number = PORT): http.Server {
    const server = http.createServer(handleRequest);

    server.listen(port, "127.0.0.1", () => {
        console.error(`🔀 Git Conflict Resolution WebUI`);
        console.error(`   Running at: http://localhost:${port}`);
    });

    return server;
}

// Direct execution (when run as standalone)
const isDirectExecution = process.argv[1]?.includes("webui/server");
if (isDirectExecution) {
    startWebUIServer();
}
