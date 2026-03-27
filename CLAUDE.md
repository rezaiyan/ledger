# Ledger — Claude Code Context

`@rezaiyan/ledger` — a TypeScript CLI + local web dashboard for Claude Code session cost and intelligence. Published to npm.

---

## What It Does

- Parses Claude Code's JSONL session files from `~/.claude/projects/`
- Computes token costs per session, per model, per day
- Provides a TUI (terminal UI) and a local web dashboard
- Runs as a service at `http://localhost:4200`

---

## Stack

| Layer | Technology |
|---|---|
| Language | TypeScript |
| CLI runner | `tsx` (ts-node alternative) |
| Web bundler | Vite |
| Web server | Express (dev: tsx watch, prod: tsx via run.js) |
| Tests | Vitest |
| Package | npm — `@rezaiyan/ledger` |

---

## Project Layout

```
bin/
├── ledger.ts         # CLI entry point — TUI + commands (open, status, last, sessions…)
└── run.js            # JS wrapper: resolves local tsx path, invokes ledger.ts

server/
├── server.ts         # Express API + static file serving (dist/web)
├── start.ts          # Entry point when running compiled JS
├── analyzer/
│   └── efficiency.ts # Session efficiency metrics
└── parser/
    ├── jsonl.ts      # JSONL parsing → ParsedConversation (extracts title from first msg)
    ├── sessions.ts   # Markdown session journal parsing
    └── matcher.ts    # Matches sessions to conversations

src/
├── currency.ts       # Currency formatting + exchange rates (LEDGER_CURRENCY env)
├── pricing.ts        # Cost math — calculateCost(usage, model)
└── types.ts          # Shared TypeScript types (ParsedConversation, EnrichedSession…)

tui/
├── App.tsx           # Ink TUI dashboard
├── StatusLine.tsx    # One-line status for shell prompt
└── utils.ts          # TUI formatting helpers

web/                  # Vite React frontend
├── App.tsx           # Tab shell + CurrencyContext.Provider (fetches /api/config)
├── utils.ts          # fmtCost(v, currency), fmtCostAxis, fmtTokens, fmtDuration…
├── hooks/
│   ├── useData.ts    # useSummary, useStatus, useConversations, useSessions, useConfig
│   └── useCurrency.ts# CurrencyContext — provides { currency, fmt, fmtAxis }
├── views/
│   ├── Overview.tsx
│   ├── ConversationsView.tsx
│   ├── SessionsView.tsx
│   └── EfficiencyView.tsx
└── components/

dist/                 # Build output (gitignored, included in npm package via files[])
├── web/              # Vite build → served as static files by Express
└── server/           # tsc output (not used at runtime — server runs via tsx)
```

---

## Key Commands

```bash
# Development
npm run dev               # concurrent: tsx watch server + vite dev

# Tests
npm run test:run          # vitest run (non-interactive)

# CLI usage (dev)
npm run ledger            # TUI (same as: tsx bin/ledger.ts)
node_modules/.bin/tsx bin/ledger.ts status
node_modules/.bin/tsx bin/ledger.ts status --short
node_modules/.bin/tsx bin/ledger.ts last
node_modules/.bin/tsx bin/ledger.ts sessions
node_modules/.bin/tsx bin/ledger.ts open   # start server + open browser

# Build (required before publish)
npm run build             # tsc + vite build → dist/

# Publish to npm
npm version patch|minor|major
npm publish               # dist/ is included via "files" in package.json
```

---

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/config` | `{ currency }` — lightweight, no file I/O |
| `GET /api/status` | Current session + today's summary |
| `GET /api/summary` | Today / this month / all-time aggregates |
| `GET /api/conversations` | All parsed conversations |
| `GET /api/sessions` | All enriched sessions |

---

## Currency Configuration

Set `LEDGER_CURRENCY=USD` or `LEDGER_CURRENCY=EUR` in the environment before starting the server.
Default is `EUR`. The web dashboard fetches currency from `/api/config` at startup — all views
use `const { fmt, fmtAxis } = useCurrency()` for consistent formatting.

---

## Architecture Rules

- `server/analyzer/` and `server/parser/` are pure functions — no side effects, no I/O
- All I/O (file reading, API serving) lives in `bin/ledger.ts` or `server/server.ts`
- Exchange rates + formatting in `src/currency.ts`; cost math in `server/pricing.ts`
- Types shared across CLI, server, and web via `src/types.ts` — no duplication
- Web currency flows: `/api/config` → `useConfig()` in App.tsx → `CurrencyContext` → `useCurrency()` in views
- `dist/` is gitignored but included in npm `files[]` — always run `npm run build` before `npm publish`

---

## Verification Checklist

Before marking any change done:
1. `npx tsc --noEmit` — zero errors
2. `npm run test:run` — all tests pass
3. `node_modules/.bin/tsx bin/ledger.ts status` — runs without error
4. If pricing changed: verify against current Anthropic pricing page
5. If publishing: `npm run build` first, then `npm version patch && npm publish`
