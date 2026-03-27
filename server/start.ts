#!/usr/bin/env tsx
/**
 * Dedicated entry point for running the Ledger server as a long-lived process.
 * Handles signals gracefully and ensures the event loop stays alive under systemd.
 */
import http from 'http';
import { createApp } from './server.js';
import os from 'os';
import path from 'path';

const args = process.argv.slice(2);

function getArg(flag: string, fallback: string): string {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1]! : fallback;
}

const port       = parseInt(getArg('--port', '4200'), 10);
const claudeDir  = getArg('--dir', path.join(os.homedir(), '.claude', 'projects'));
const sessionsDir = getArg('--sessions-dir', path.join(process.cwd(), 'sessions'));

const app = createApp({ port, claudeDir, sessionsDir });
const server = http.createServer(app);

server.listen(port, () => {
  console.log(`\nLedger server running on http://localhost:${port}`);
  console.log(`  JSONL source : ${claudeDir}`);
  console.log(`  Sessions dir : ${sessionsDir}`);
  console.log(`  API          : http://localhost:${port}/api/summary\n`);
});

server.on('error', (err) => {
  console.error('[ledger] Server error:', err);
  process.exit(1);
});

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`\n[ledger] ${signal} received — shutting down...`);
  server.close(() => {
    console.log('[ledger] Closed.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  console.error('[ledger] Uncaught exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[ledger] Unhandled rejection:', reason);
  process.exit(1);
});
