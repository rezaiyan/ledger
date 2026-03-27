#!/usr/bin/env tsx
/**
 * Ledger CLI — main entry point.
 *
 * Commands:
 *   ledger            — launch interactive TUI dashboard
 *   ledger status     — print single-line status
 *   ledger status -s  — ultra-compact shell prompt format
 *   ledger today      — print today's summary
 *   ledger last       — show last completed conversation
 *   ledger sessions   — table of recent sessions
 *   ledger open       — start server (if needed) and open browser
 *   ledger start      — alias for open
 */

import { Command } from 'commander';
import chalk from 'chalk';
import net from 'net';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { render } from 'ink';
import React from 'react';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

import { parseAllConversations } from '../server/parser/jsonl.js';
import type { ParsedConversation, PeriodSummary, EnrichedSession } from '../src/types.js';
import {
  formatCost,
  formatDuration,
  formatTokens,
  formatCacheHit,
  shortModel,
  truncate,
} from '../tui/utils.js';
import { setActiveCurrency, SUPPORTED_CURRENCIES, type CurrencyCode } from '../src/currency.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CLAUDE_DIR = path.join(os.homedir(), '.claude', 'projects');
const DEFAULT_SESSIONS_DIR = path.join(process.cwd(), 'sessions');
const DEFAULT_PORT = 4200;

// ---------------------------------------------------------------------------
// Helper: date arithmetic
// ---------------------------------------------------------------------------

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildPeriodSummary(
  conversations: ParsedConversation[],
  from: Date
): PeriodSummary {
  const filtered = conversations.filter((c) => c.startTime >= from);
  const cost = filtered.reduce((s, c) => s + c.totalCost, 0);
  const inputTokens = filtered.reduce((s, c) => s + c.inputTokens, 0);
  const outputTokens = filtered.reduce((s, c) => s + c.outputTokens, 0);
  const cacheCreationTokens = filtered.reduce((s, c) => s + c.cacheCreationTokens, 0);
  const cacheReadTokens = filtered.reduce((s, c) => s + c.cacheReadTokens, 0);
  const webSearches = filtered.reduce((s, c) => s + c.webSearches, 0);
  const totalCacheActivity = cacheReadTokens + cacheCreationTokens;
  const cacheHitRate = totalCacheActivity > 0 ? cacheReadTokens / totalCacheActivity : 0;
  return {
    cost,
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    conversations: filtered.length,
    sessions: 0,
    cacheHitRate,
    webSearches,
  };
}

// ---------------------------------------------------------------------------
// Helper: API fetching
// ---------------------------------------------------------------------------

async function fetchApi<T>(port: number, endpoint: string): Promise<T | null> {
  try {
    const res = await fetch(`http://localhost:${port}/api${endpoint}`);
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

interface StatusResponse {
  currentSession: Record<string, unknown> | null;
  today: PeriodSummary;
}

// ---------------------------------------------------------------------------
// Helper: check if port is in use
// ---------------------------------------------------------------------------

function isPortBusy(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close(() => resolve(false));
    });
    server.listen(port, '127.0.0.1');
  });
}

// ---------------------------------------------------------------------------
// Helper: wait for server to be ready (polls /api/status)
// ---------------------------------------------------------------------------

async function waitForServer(port: number, timeoutMs = 3000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${port}/api/status`);
      if (res.ok) return true;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

// ---------------------------------------------------------------------------
// Helper: spawn detached server
// ---------------------------------------------------------------------------

function spawnServer(
  port: number,
  claudeDir: string,
  sessionsDir: string
): void {
  const serverPath = path.resolve(__dirname, '..', 'server', 'server.ts');
  const tsx = path.resolve(__dirname, '..', 'node_modules', '.bin', 'tsx');
  const child = spawn(
    tsx,
    [
      serverPath,
      '--port',
      String(port),
      '--dir',
      claudeDir,
      '--sessions-dir',
      sessionsDir,
    ],
    {
      detached: true,
      stdio: 'ignore',
    }
  );
  child.unref();
}

// ---------------------------------------------------------------------------
// Helper: format date as "March 27, 2026"
// ---------------------------------------------------------------------------

function formatDateLong(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Command implementations
// ---------------------------------------------------------------------------

async function cmdStatus(opts: {
  short: boolean;
  port: number;
  dir: string;
  sessionsDir: string;
}): Promise<void> {
  const status = await fetchApi<StatusResponse>(opts.port, '/status');

  if (status) {
    const cs = status.currentSession;
    const today = status.today;

    if (opts.short) {
      if (cs && typeof cs['cost'] === 'number') {
        process.stdout.write(`⬡ ${chalk.cyan(formatCost(cs['cost'] as number))}\n`);
      } else {
        process.stdout.write(`⬡ ${chalk.green(formatCost(today.cost))}${chalk.gray('/day')}\n`);
      }
      return;
    }

    if (cs && typeof cs['name'] === 'string') {
      const name = cs['name'] as string;
      const cost = typeof cs['cost'] === 'number' ? formatCost(cs['cost'] as number) : '—';
      const commits = typeof cs['commits'] === 'number' ? cs['commits'] : 0;
      const model = typeof cs['model'] === 'string' ? shortModel(cs['model'] as string) : 'sonnet';
      const startIso = typeof cs['startTime'] === 'string' ? cs['startTime'] as string : null;
      const durationStr = startIso
        ? formatDuration((Date.now() - new Date(startIso).getTime()) / 60_000)
        : '';

      const parts = [
        chalk.green('●'),
        chalk.bold(name),
        chalk.cyan(cost),
        durationStr ? chalk.gray(`· ${durationStr}`) : '',
        chalk.gray(`· ${model}`),
        commits > 0 ? chalk.gray(`· ${commits} commit${commits !== 1 ? 's' : ''}`) : '',
      ].filter(Boolean);

      console.log(parts.join('  '));
    } else {
      const todayLine = [
        chalk.gray('No active session'),
        ' ',
        chalk.dim('Today:'),
        chalk.cyan(formatCost(today.cost)),
        chalk.gray(`· ${today.conversations} conversation${today.conversations !== 1 ? 's' : ''}`),
      ].join(' ');
      console.log(todayLine);
    }
    return;
  }

  // Fallback: parse directly
  const conversations = await parseAllConversations(opts.dir);
  const now = new Date();
  const today = buildPeriodSummary(conversations, startOfDay(now));

  if (opts.short) {
    process.stdout.write(`⬡ ${chalk.green(formatCost(today.cost))}${chalk.gray('/day')}\n`);
    return;
  }

  console.log(
    chalk.gray('No active session') +
      '  ' +
      chalk.dim('Today:') +
      ' ' +
      chalk.cyan(formatCost(today.cost)) +
      ' ' +
      chalk.gray(`· ${today.conversations} conversation${today.conversations !== 1 ? 's' : ''}`)
  );
}

async function cmdToday(opts: {
  port: number;
  dir: string;
  sessionsDir: string;
}): Promise<void> {
  let today: PeriodSummary;
  let activeSession: Record<string, unknown> | null = null;

  const status = await fetchApi<StatusResponse>(opts.port, '/status');
  if (status) {
    today = status.today;
    activeSession = status.currentSession ?? null;
  } else {
    const conversations = await parseAllConversations(opts.dir);
    const now = new Date();
    today = buildPeriodSummary(conversations, startOfDay(now));
  }

  const header = `Today — ${formatDateLong(new Date())}`;
  const sep = chalk.gray('─'.repeat(38));

  console.log(chalk.bold(header));
  console.log(sep);

  const pad = 14;
  console.log(
    chalk.dim('Cost:'.padEnd(pad)) + chalk.cyan(formatCost(today.cost))
  );
  console.log(
    chalk.dim('Conversations:'.padEnd(pad)) + chalk.white(String(today.conversations))
  );
  console.log(
    chalk.dim('Tokens:'.padEnd(pad)) +
      chalk.white(
        `${formatTokens(today.inputTokens)} in / ${formatTokens(today.outputTokens)} out`
      )
  );
  console.log(
    chalk.dim('Cache hit:'.padEnd(pad)) +
      chalk.white(formatCacheHit(today.cacheHitRate))
  );

  console.log(sep);

  if (activeSession && typeof activeSession['name'] === 'string') {
    const name = activeSession['name'] as string;
    const cost =
      typeof activeSession['cost'] === 'number'
        ? formatCost(activeSession['cost'] as number)
        : '—';
    console.log(
      chalk.yellow('Active:') +
        ' ' +
        chalk.bold(name) +
        '  ' +
        chalk.cyan(cost) +
        chalk.gray(' so far')
    );
  }
}

async function cmdLast(opts: { port: number; dir: string }): Promise<void> {
  let conversations: ParsedConversation[];
  const fetched = await fetchApi<ParsedConversation[]>(opts.port, '/conversations');
  if (fetched) {
    conversations = fetched.map((c) => ({
      ...c,
      startTime: new Date((c as unknown as Record<string, string>)['startTime']),
      endTime: new Date((c as unknown as Record<string, string>)['endTime']),
    }));
  } else {
    conversations = await parseAllConversations(opts.dir);
  }

  const completed = conversations
    .filter((c) => !c.isSubagent)
    .sort((a, b) => b.endTime.getTime() - a.endTime.getTime());

  const last = completed[0];
  if (!last) {
    console.log(chalk.gray('No completed conversations found.'));
    return;
  }

  const sep = chalk.gray('─'.repeat(38));
  console.log(chalk.bold('Last conversation'));
  console.log(sep);

  const pad = 14;
  console.log(chalk.dim('Session:'.padEnd(pad)) + chalk.white(last.sessionId));
  console.log(
    chalk.dim('Project:'.padEnd(pad)) + chalk.white(last.projectSlug)
  );
  console.log(chalk.dim('CWD:'.padEnd(pad)) + chalk.white(last.cwd || '—'));
  console.log(
    chalk.dim('Date:'.padEnd(pad)) +
      chalk.white(last.startTime.toLocaleString())
  );
  console.log(
    chalk.dim('Duration:'.padEnd(pad)) +
      chalk.white(formatDuration(last.durationMin))
  );
  console.log(chalk.dim('Model:'.padEnd(pad)) + chalk.white(last.model));
  console.log(
    chalk.dim('Cost:'.padEnd(pad)) + chalk.cyan(formatCost(last.totalCost))
  );
  console.log(
    chalk.dim('Tokens:'.padEnd(pad)) +
      chalk.white(
        `${formatTokens(last.inputTokens)} in / ${formatTokens(last.outputTokens)} out`
      )
  );
  console.log(
    chalk.dim('Cache hit:'.padEnd(pad)) +
      chalk.white(formatCacheHit(last.cacheHitRate))
  );
  console.log(sep);
}

interface SessionsOptions {
  type?: string;
  port: number;
  dir: string;
  sessionsDir: string;
}

async function cmdSessions(opts: SessionsOptions): Promise<void> {
  let sessions: EnrichedSession[];
  const fetched = await fetchApi<EnrichedSession[]>(opts.port, '/sessions');
  if (fetched) {
    sessions = fetched.map((s) => ({
      ...s,
      startTime: new Date((s as unknown as Record<string, string>)['startTime']),
      endTime: s.endTime
        ? new Date((s as unknown as Record<string, string>)['endTime'])
        : undefined,
    }));
  } else {
    // No sessions available without the server
    sessions = [];
  }

  let filtered = sessions;
  if (opts.type) {
    filtered = sessions.filter((s) => s.type === opts.type);
  }

  const rows = filtered.slice(0, 10);

  if (rows.length === 0) {
    console.log(chalk.gray('No sessions found.'));
    return;
  }

  const header = [
    chalk.bold.gray('#'.padEnd(3)),
    chalk.bold('Name'.padEnd(22)),
    chalk.bold('Type'.padEnd(10)),
    chalk.bold('Started'.padEnd(12)),
    chalk.bold('Cost'.padStart(7)),
    chalk.bold('Commits'.padStart(8)),
    chalk.bold('Model'.padEnd(8)),
  ].join('  ');

  console.log(header);
  console.log(chalk.gray('─'.repeat(80)));

  rows.forEach((s, i) => {
    const isActive = !s.endTime;
    const dateStr = s.startTime.toISOString().slice(0, 10);
    const cost = s.cost != null ? formatCost(s.cost) : chalk.gray('—');
    const commits = s.commits != null ? String(s.commits) : chalk.gray('—');
    const model = s.model ? shortModel(s.model) : chalk.gray('—');
    const name = truncate(s.name, 22);

    const row = [
      chalk.gray(String(i + 1).padEnd(3)),
      (isActive ? chalk.green : chalk.white)(name.padEnd(22)),
      chalk.gray(s.type.padEnd(10)),
      chalk.gray(dateStr.padEnd(12)),
      chalk.cyan(cost.padStart(7)),
      chalk.yellow(commits.padStart(8)),
      chalk.magenta(model.padEnd(8)),
    ].join('  ');

    process.stdout.write(row);
    if (isActive) process.stdout.write(chalk.green(' ← active'));
    process.stdout.write('\n');
  });
}

async function cmdOpen(opts: {
  port: number;
  dir: string;
  sessionsDir: string;
}): Promise<void> {
  const { default: open } = await import('open');

  const busy = await isPortBusy(opts.port);
  if (busy) {
    console.log(chalk.dim(`Server already running on port ${opts.port}`));
  } else {
    process.stdout.write(chalk.dim(`Starting server on port ${opts.port}… `));
    spawnServer(opts.port, opts.dir, opts.sessionsDir);

    const ready = await waitForServer(opts.port, 3000);
    if (ready) {
      process.stdout.write(chalk.green('ready\n'));
    } else {
      process.stdout.write(chalk.yellow('timed out (server may still be starting)\n'));
    }
  }

  const url = `http://localhost:${opts.port}`;
  console.log(chalk.cyan(`Opening dashboard at ${url}`));
  await open(url);
}

// ---------------------------------------------------------------------------
// Command: report (default)
// ---------------------------------------------------------------------------

async function cmdReport(opts: {
  port: number;
  dir: string;
  sessionsDir: string;
}): Promise<void> {
  const isTTY = process.stdout.isTTY;
  if (isTTY) {
    // Go up 2 lines (npm's header lines) and clear, then show loading indicator
    process.stdout.write('\x1b[2A\x1b[0J' + chalk.dim('  ⬡ Ledger  loading…'));
  }

  let today: PeriodSummary;
  let thisMonth: PeriodSummary;
  let activeSession: Record<string, unknown> | null = null;
  let recentConversations: ParsedConversation[] = [];

  interface SummaryResponse { today: PeriodSummary; thisMonth: PeriodSummary }
  interface ConversationsResponse extends Array<unknown> {}

  const [status, summaryData, convsData] = await Promise.all([
    fetchApi<StatusResponse>(opts.port, '/status'),
    fetchApi<SummaryResponse>(opts.port, '/summary'),
    fetchApi<ConversationsResponse>(opts.port, '/conversations'),
  ]);

  if (status && summaryData) {
    today = summaryData.today;
    thisMonth = summaryData.thisMonth;
    activeSession = status.currentSession ?? null;
  } else {
    const conversations = await parseAllConversations(opts.dir);
    const now = new Date();
    today = buildPeriodSummary(conversations, startOfDay(now));
    thisMonth = buildPeriodSummary(conversations, startOfMonth(now));
  }

  if (convsData && Array.isArray(convsData)) {
    recentConversations = (convsData as Array<Record<string, unknown>>)
      .map((c) => ({
        ...(c as unknown as ParsedConversation),
        startTime: new Date(c['startTime'] as string),
        endTime: new Date(c['endTime'] as string),
      }))
      .slice(0, 8);
  } else if (!status) {
    const conversations = await parseAllConversations(opts.dir);
    recentConversations = conversations.slice(0, 8);
  }

  const now = new Date();
  const sep = chalk.gray('─'.repeat(57));
  const pad = 16;

  // Clear loading indicator before printing report
  if (isTTY) process.stdout.write('\r\x1b[2K');

  // Header
  console.log(chalk.cyan('┌─ Ledger ') + chalk.gray('─'.repeat(38)) + chalk.cyan('─┐'));
  console.log(chalk.cyan('│') + ' '.repeat(57) + chalk.cyan('│'));

  // TODAY / MONTH
  const todayLine = chalk.bold.yellow('TODAY'.padEnd(7)) + ' ' + chalk.cyan(formatCost(today.cost)) +
    chalk.gray(' · ' + (today.conversations) + ' conversations');
  const monthLine = chalk.bold.yellow('MONTH'.padEnd(7)) + ' ' + chalk.cyan(formatCost(thisMonth.cost)) +
    chalk.gray(' · ' + (thisMonth.conversations) + ' conversations');

  console.log(chalk.cyan('│  ') + todayLine + chalk.cyan(' ').repeat(0));
  console.log(chalk.cyan('│  ') + monthLine);
  console.log(chalk.cyan('│') + ' '.repeat(57) + chalk.cyan('│'));

  // Active session
  console.log(chalk.cyan('│  ') + chalk.gray('─── ACTIVE SESSION ') + chalk.gray('─'.repeat(36)));
  if (activeSession && typeof activeSession['name'] === 'string') {
    const name = activeSession['name'] as string;
    const cost = typeof activeSession['cost'] === 'number' ? formatCost(activeSession['cost']) : '—';
    const model = typeof activeSession['model'] === 'string' ? shortModel(activeSession['model']) : '—';
    const startIso = typeof activeSession['startTime'] === 'string' ? activeSession['startTime'] as string : null;
    const durStr = startIso ? formatDuration((Date.now() - new Date(startIso).getTime()) / 60_000) : '';
    const cacheHit = typeof activeSession['cacheHitRate'] === 'number'
      ? formatCacheHit(activeSession['cacheHitRate'] as number) : '—';
    console.log(chalk.cyan('│  ') + chalk.bold.white(name) + (durStr ? chalk.gray('  started ' + durStr + ' ago') : ''));
    console.log(chalk.cyan('│  ') + chalk.gray('cost: ') + chalk.cyan(cost) +
      chalk.gray('  ·  cache: ') + chalk.white(cacheHit) +
      chalk.gray('  ·  ') + chalk.magenta(model));
  } else {
    console.log(chalk.cyan('│  ') + chalk.gray('No active session'));
  }
  console.log(chalk.cyan('│') + ' '.repeat(57) + chalk.cyan('│'));

  // Recent conversations
  console.log(chalk.cyan('│  ') + chalk.gray('─── RECENT CONVERSATIONS ') + chalk.gray('─'.repeat(30)));
  if (recentConversations.length === 0) {
    console.log(chalk.cyan('│  ') + chalk.gray('No conversations found'));
  } else {
    for (const conv of recentConversations) {
      const dateStr = conv.startTime.toISOString().slice(0, 10);
      const cwd = truncate(conv.cwd || conv.projectSlug, 20);
      const cost = formatCost(conv.totalCost);
      const cache = formatCacheHit(conv.cacheHitRate);
      const model = shortModel(conv.model);
      const dur = formatDuration(conv.durationMin);
      console.log(
        chalk.cyan('│  ') +
        chalk.gray(dateStr + '  ') +
        chalk.white(cwd.padEnd(22)) +
        chalk.cyan(cost.padStart(7) + '  ') +
        chalk.yellow(cache.padStart(4) + '  ') +
        chalk.magenta(model.padEnd(7) + '  ') +
        chalk.gray(dur)
      );
    }
  }

  // Footer
  console.log(chalk.cyan('│') + ' '.repeat(57) + chalk.cyan('│'));
  console.log(chalk.cyan('│  ') + chalk.gray('run "ledger tui" for interactive dashboard'));
  console.log(chalk.cyan('└') + chalk.gray('─'.repeat(57)) + chalk.cyan('┘'));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name('ledger')
  .description('Claude Code cost + session intelligence')
  .version(version)
  .option('--dir <path>', 'JSONL source directory', DEFAULT_CLAUDE_DIR)
  .option('--sessions-dir <path>', 'Sessions directory', DEFAULT_SESSIONS_DIR)
  .option('--port <number>', 'Server port', String(DEFAULT_PORT))
  .option(
    '--currency <code>',
    `Display currency (${SUPPORTED_CURRENCIES.join(', ')})`,
    'EUR'
  );

// Apply currency setting before any command executes
program.hook('preAction', () => {
  const opts = program.opts<{ currency?: string }>();
  const code = opts.currency?.toUpperCase() as CurrencyCode | undefined;
  if (code && SUPPORTED_CURRENCIES.includes(code)) {
    setActiveCurrency(code);
  } else if (opts.currency) {
    console.error(
      chalk.yellow(`Unknown currency "${opts.currency}". Supported: ${SUPPORTED_CURRENCIES.join(', ')}`)
    );
  }
});

// Default action: print report and exit
program.action(async () => {
  const opts = program.opts<{ dir: string; sessionsDir: string; port: string }>();
  await cmdReport({
    port: parseInt(opts.port, 10),
    dir: opts.dir,
    sessionsDir: opts.sessionsDir,
  });
});

// ledger tui
program
  .command('tui')
  .description('Launch interactive TUI dashboard')
  .action(async () => {
    const opts = program.opts<{ dir: string; sessionsDir: string; port: string }>();
    const port = parseInt(opts.port, 10);
    const claudeDir = opts.dir;
    const sessionsDir = opts.sessionsDir;
    const { default: App } = await import('../tui/App.js');
    render(
      React.createElement(App, { port, claudeDir, sessionsDir }),
      { exitOnCtrlC: true }
    );
  });

// ledger status
program
  .command('status')
  .description('Print current status line')
  .option('-s, --short', 'Ultra-compact format for shell prompt')
  .action(async (cmdOpts: { short?: boolean }) => {
    const opts = program.opts<{ dir: string; sessionsDir: string; port: string }>();
    await cmdStatus({
      short: cmdOpts.short ?? false,
      port: parseInt(opts.port, 10),
      dir: opts.dir,
      sessionsDir: opts.sessionsDir,
    });
  });

// ledger today
program
  .command('today')
  .description("Print today's usage summary")
  .action(async () => {
    const opts = program.opts<{ dir: string; sessionsDir: string; port: string }>();
    await cmdToday({
      port: parseInt(opts.port, 10),
      dir: opts.dir,
      sessionsDir: opts.sessionsDir,
    });
  });

// ledger last
program
  .command('last')
  .description('Show the last completed conversation')
  .action(async () => {
    const opts = program.opts<{ dir: string; sessionsDir: string; port: string }>();
    await cmdLast({
      port: parseInt(opts.port, 10),
      dir: opts.dir,
    });
  });

// ledger sessions
program
  .command('sessions')
  .description('Table of recent sessions (last 10)')
  .option('--type <type>', 'Filter by session type (bug, feature, refactor, explore, research, other)')
  .action(async (cmdOpts: { type?: string }) => {
    const opts = program.opts<{ dir: string; sessionsDir: string; port: string }>();
    await cmdSessions({
      type: cmdOpts.type,
      port: parseInt(opts.port, 10),
      dir: opts.dir,
      sessionsDir: opts.sessionsDir,
    });
  });

// ledger open
program
  .command('open')
  .description('Start server if needed, then open browser dashboard')
  .action(async () => {
    const opts = program.opts<{ dir: string; sessionsDir: string; port: string }>();
    await cmdOpen({
      port: parseInt(opts.port, 10),
      dir: opts.dir,
      sessionsDir: opts.sessionsDir,
    });
  });

// ledger start (alias for open)
program
  .command('start')
  .description('Alias for "open"')
  .action(async () => {
    const opts = program.opts<{ dir: string; sessionsDir: string; port: string }>();
    await cmdOpen({
      port: parseInt(opts.port, 10),
      dir: opts.dir,
      sessionsDir: opts.sessionsDir,
    });
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(chalk.red('Error:'), err instanceof Error ? err.message : String(err));
  process.exit(1);
});
