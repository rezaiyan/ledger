# Ledger

[![npm](https://img.shields.io/npm/v/@rezaiyan/ledger)](https://www.npmjs.com/package/@rezaiyan/ledger)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Track Claude Code costs and work sessions — terminal dashboard, web UI, and slash commands in one tool.

**[Project page](https://alirezaiyan.com/projects/ledger)** · **[Blog post](https://alirezaiyan.com/blog/ledger-claude-code-cost-tracking)**

## Install

```bash
npm install -g @rezaiyan/ledger
```

## Quick Start

```bash
npm install
npm run ledger        # print cost report and exit
npm run dev           # web dashboard at http://localhost:4200
```

## CLI Commands

| Command | Description |
|---|---|
| `ledger` | Print cost report and exit |
| `ledger tui` | Launch interactive TUI dashboard |
| `ledger status` | Print current session status line |
| `ledger status -s` | Ultra-compact format for shell prompt |
| `ledger today` | Print today's cost summary |
| `ledger last` | Show last completed conversation |
| `ledger sessions` | Table of recent sessions (last 10) |
| `ledger sessions --type <type>` | Filter sessions by type |
| `ledger open` | Start server and open browser dashboard |
| `ledger start` | Alias for `open` |

Global options: `--dir <path>` (JSONL source, default `~/.claude/projects`), `--port <number>` (default 4200), `--sessions-dir <path>` (default `./sessions`).

## Slash Commands

Place these in your project's `commands/` directory. Invoke them in Claude Code as `/project:session-*`.

| Command | Description |
|---|---|
| `/project:session-start [type] [goal]` | Start a session with pre-flight cost suggestions from similar past sessions |
| `/project:session-update [note]` | Append a timestamped progress note (with git state) to the active session |
| `/project:session-end` | Close the session, calculate duration, extract lessons, add summary |
| `/project:session-check` | Show current cost vs. average of similar sessions |
| `/project:session-review [N]` | Generate an efficiency report across the last N sessions (default 20) |
| `/project:session-lessons` | Re-extract and update lessons from the current or most recent session |

Session types: `feature`, `bug`, `refactor`, `explore`, `research` (default: `other`).

## How It Works

Ledger reads Claude Code's JSONL conversation logs from `~/.claude/projects/` and parses cost, token, model, and timing data directly — no API key required. The Express server (`server/server.ts`) exposes this data via a REST API at `/api/summary`, `/api/conversations`, `/api/sessions`, and `/api/status`. The web frontend (React + Recharts + Vite) and TUI (Ink) both consume this API.

Work sessions are Markdown files written to `./sessions/` with YAML frontmatter. The slash commands are natural-language instruction files that Claude Code executes — they read and write these session files to track progress, costs, commits, and lessons over time.

## License

MIT — see [LICENSE](LICENSE).

## Credits

Built on patterns from:
- [anthropics/claude-code](https://github.com/anthropics/claude-code) — JSONL log format and cost data
- [nicholasgasior/gsfmt](https://github.com/nicholasgasior/gsfmt) — session tracking conventions
