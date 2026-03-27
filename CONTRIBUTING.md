# Contributing

## Setup

```bash
git clone https://github.com/rezaiyan/ledger.git
cd ledger
npm install
npm run dev
```

## Project Structure

- `bin/ledger.ts` — CLI entry point
- `server/` — Express API server + JSONL parser
- `tui/` — Ink terminal UI
- `src/` — shared types and utilities
- `commands/` — Claude Code slash commands

## Making Changes

- `npm run ledger` — test the CLI report
- `npm run tui` — test the interactive TUI
- `npm run dev` — start server + web dashboard

## Publishing

Bump the version in `package.json`, then:

```bash
npm publish --access public
```
