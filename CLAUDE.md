# Ledger — Claude Code Context

`@rezaiyan/ledger` — a TypeScript CLI + local web dashboard for Claude Code session cost and intelligence. Published to npm.

---

## What It Does

- Parses Claude Code's JSONL session files from `~/.claude/projects/`
- Computes token costs per session, per model, per day
- Provides a TUI (terminal UI) and a local web dashboard
- Runs as a service on the Pi at `http://localhost:4200`

---

## Stack

| Layer | Technology |
|---|---|
| Language | TypeScript |
| CLI runner | `tsx` (ts-node alternative) |
| Web bundler | Vite |
| Web server | Express (dev: tsx watch, prod: compiled node) |
| Package | npm — `@rezaiyan/ledger` |

---

## Project Layout

```
bin/
└── ledger.ts         # CLI entry point — TUI via chalk

server/
└── server.ts         # Express API + static file serving

src/
├── analyzer/         # session parsing, cost calculation
├── parser/           # JSONL parsing logic
├── currency.ts       # pricing tables per model
├── pricing.ts        # cost math
└── types.ts          # shared TypeScript types

web/                  # Vite frontend (if exists) or served from out/
```

---

## Key Commands

```bash
# Development
npm run dev               # concurrent: server + web dev

# CLI usage
npm run ledger            # TUI (same as: tsx bin/ledger.ts)
node_modules/.bin/tsx bin/ledger.ts status
node_modules/.bin/tsx bin/ledger.ts status --short
node_modules/.bin/tsx bin/ledger.ts last
node_modules/.bin/tsx bin/ledger.ts sessions

# Build
npm run build             # tsc + vite build → dist/

# Publish to npm
npm version patch|minor|major
npm publish
```

---

## Architecture Rules

- `src/analyzer/` and `src/parser/` are pure functions — no side effects, no I/O
- All I/O (file reading, API serving) lives in `bin/ledger.ts` or `server/server.ts`
- Pricing tables in `src/currency.ts` — update here when Anthropic changes pricing
- Types shared across CLI and server via `src/types.ts` — no duplication

---

## Verification Checklist

Before marking any change done:
1. `npx tsc --noEmit` — zero errors
2. `node_modules/.bin/tsx bin/ledger.ts status` — runs without error
3. If pricing changed: verify against current Anthropic pricing page
4. If publishing: bump version first, then `npm publish`
