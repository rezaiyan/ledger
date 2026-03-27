import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { parseAllConversations } from './parser/jsonl.js';
import { parseAllSessions } from './parser/sessions.js';
import { enrichAllSessions } from './parser/matcher.js';
import { getSessionSummary } from './analyzer/efficiency.js';
import { getActiveCurrency } from '../src/currency.js';
import type {
  ParsedConversation,
  EnrichedSession,
  PeriodSummary,
} from '../src/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ServerOptions {
  port?: number;
  claudeDir?: string;
  sessionsDir?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_CLAUDE_DIR  = path.join(os.homedir(), '.claude', 'projects');
const DEFAULT_SESSIONS_DIR = path.join(process.cwd(), 'sessions');

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
  from: Date,
  sessions: EnrichedSession[]
): PeriodSummary {
  const filtered = conversations.filter((c) => c.startTime >= from);

  const cost               = filtered.reduce((s, c) => s + c.totalCost, 0);
  const inputTokens        = filtered.reduce((s, c) => s + c.inputTokens, 0);
  const outputTokens       = filtered.reduce((s, c) => s + c.outputTokens, 0);
  const cacheCreationTokens = filtered.reduce((s, c) => s + c.cacheCreationTokens, 0);
  const cacheReadTokens    = filtered.reduce((s, c) => s + c.cacheReadTokens, 0);
  const webSearches        = filtered.reduce((s, c) => s + c.webSearches, 0);

  const totalCacheActivity = cacheReadTokens + cacheCreationTokens;
  const cacheHitRate =
    totalCacheActivity > 0 ? cacheReadTokens / totalCacheActivity : 0;

  const filteredSessions = sessions.filter((s) => s.startTime >= from);

  return {
    cost,
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    conversations: filtered.length,
    sessions: filteredSessions.length,
    cacheHitRate,
    webSearches,
  };
}

/**
 * Try to read a .current-session file from the given directory.
 * Returns null if not found or unreadable.
 */
async function readCurrentSession(
  dir: string
): Promise<Record<string, unknown> | null> {
  const candidates = [
    path.join(dir, '.current-session'),
    path.join(process.cwd(), '.current-session'),
  ];

  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, 'utf-8');
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // try next
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Data cache (simple in-memory, refreshed on each request for dev)
// ---------------------------------------------------------------------------

interface Cache {
  conversations: ParsedConversation[];
  sessions: EnrichedSession[];
  loadedAt: Date;
}

let cache: Cache | null = null;
const CACHE_TTL_MS = 30_000; // 30 s

async function loadData(
  claudeDir: string,
  sessionsDir: string
): Promise<Cache> {
  if (cache && Date.now() - cache.loadedAt.getTime() < CACHE_TTL_MS) {
    return cache;
  }

  const conversations = await parseAllConversations(claudeDir);

  let sessions: EnrichedSession[] = [];
  try {
    await fs.access(sessionsDir);
    const rawSessions = await parseAllSessions(sessionsDir);
    sessions = enrichAllSessions(rawSessions, conversations);
  } catch {
    // sessions dir doesn't exist — that's fine
  }

  cache = { conversations, sessions, loadedAt: new Date() };
  return cache;
}

// ---------------------------------------------------------------------------
// Route builders
// ---------------------------------------------------------------------------

function buildRouter(claudeDir: string, sessionsDir: string) {
  const router = express.Router();

  // GET /api/config
  router.get('/config', (_req: Request, res: Response) => {
    res.json({ currency: getActiveCurrency() });
  });

  // GET /api/conversations
  router.get('/conversations', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversations } = await loadData(claudeDir, sessionsDir);
      res.json(conversations);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/conversations/:sessionId
  router.get('/conversations/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversations } = await loadData(claudeDir, sessionsDir);
      const found = conversations.find(
        (c) => c.sessionId === req.params['sessionId']
      );
      if (!found) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }
      res.json(found);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/sessions
  router.get('/sessions', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessions } = await loadData(claudeDir, sessionsDir);
      // Sort by startTime descending
      const sorted = [...sessions].sort(
        (a, b) => b.startTime.getTime() - a.startTime.getTime()
      );
      res.json(sorted);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/summary
  router.get('/summary', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversations, sessions } = await loadData(claudeDir, sessionsDir);
      const now   = new Date();
      const today = buildPeriodSummary(conversations, startOfDay(now), sessions);
      const thisMonth = buildPeriodSummary(
        conversations,
        startOfMonth(now),
        sessions
      );
      const allTime = buildPeriodSummary(
        conversations,
        new Date(0),
        sessions
      );
      const sessionSummary = getSessionSummary(sessions);

      res.json({ today, thisMonth, allTime, sessions: sessionSummary });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/status
  router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversations, sessions } = await loadData(claudeDir, sessionsDir);
      const currentSession = await readCurrentSession(sessionsDir);

      const now   = new Date();
      const today = buildPeriodSummary(conversations, startOfDay(now), sessions);

      res.json({
        currentSession,
        today,
        serverTime: now.toISOString(),
        claudeDir,
        sessionsDir,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

export function createApp(options: ServerOptions = {}): express.Application {
  const claudeDir   = options.claudeDir  ?? DEFAULT_CLAUDE_DIR;
  const sessionsDir = options.sessionsDir ?? DEFAULT_SESSIONS_DIR;

  const app = express();

  app.use(cors());
  app.use(express.json());

  // API routes
  app.use('/api', buildRouter(claudeDir, sessionsDir));

  // Serve the built frontend in production
  const webDist = path.resolve(__dirname, '..', 'dist', 'web');
  app.use(
    express.static(webDist, { index: 'index.html' })
  );

  // SPA fallback — any non-API route serves index.html
  app.get('/{*path}', async (req: Request, res: Response) => {
    if (req.path.startsWith('/api')) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const indexPath = path.join(webDist, 'index.html');
    try {
      await fs.access(indexPath);
      res.sendFile(indexPath);
    } catch {
      res.status(200).json({ status: 'ok', message: 'Ledger API is running' });
    }
  });

  // Global error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[ledger server error]', err);
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  });

  return app;
}

export function startServer(port = 4200, options: Omit<ServerOptions, 'port'> = {}): void {
  const app = createApp({ ...options, port });

  app.listen(port, () => {
    const claudeDir   = options.claudeDir  ?? DEFAULT_CLAUDE_DIR;
    const sessionsDir = options.sessionsDir ?? DEFAULT_SESSIONS_DIR;

    console.log(`\nLedger server running on http://localhost:${port}`);
    console.log(`  JSONL source : ${claudeDir}`);
    console.log(`  Sessions dir : ${sessionsDir}`);
    console.log(`  API          : http://localhost:${port}/api/summary\n`);
  });
}

// ---------------------------------------------------------------------------
// CLI entry (when run directly via `node server.ts` or `tsx server.ts`)
// ---------------------------------------------------------------------------

// Detect whether this module is the main entry point
const isMain =
  process.argv[1] != null &&
  (process.argv[1].endsWith('server.ts') ||
    process.argv[1].endsWith('server.js'));

if (isMain) {
  const args = process.argv.slice(2);

  const portIdx = args.indexOf('--port');
  const port = portIdx !== -1 ? parseInt(args[portIdx + 1] ?? '4200', 10) : 4200;

  const dirIdx = args.indexOf('--dir');
  const claudeDir =
    dirIdx !== -1 ? args[dirIdx + 1] : undefined;

  const sessionsDirIdx = args.indexOf('--sessions-dir');
  const sessionsDir =
    sessionsDirIdx !== -1 ? args[sessionsDirIdx + 1] : undefined;

  startServer(port, { claudeDir, sessionsDir });
}
