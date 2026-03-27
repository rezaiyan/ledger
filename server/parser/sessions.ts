import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
import { parse as parseDate } from 'date-fns';
import type { SessionMeta, SessionType } from '../../src/types.js';

// Valid session types
const VALID_SESSION_TYPES: SessionType[] = [
  'feature',
  'bug',
  'refactor',
  'explore',
  'research',
  'other',
];

function toSessionType(raw: unknown): SessionType {
  if (
    typeof raw === 'string' &&
    VALID_SESSION_TYPES.includes(raw as SessionType)
  ) {
    return raw as SessionType;
  }
  return 'other';
}

/**
 * Parse a session filename into its components.
 *
 * Supported formats:
 *   YYYY-MM-DD-HHMM.md
 *   YYYY-MM-DD-HHMM-name.md
 *   YYYY-MM-DD-HHMM-some-longer-name.md
 */
function parseFilename(filePath: string): {
  name: string;
  startTime: Date | null;
} {
  const base = path.basename(filePath, '.md');

  // Match: 2026-03-27-1430[-optional-name]
  const match = base.match(
    /^(\d{4}-\d{2}-\d{2})-(\d{4})(?:-(.+))?$/
  );

  if (!match) {
    return { name: base, startTime: null };
  }

  const [, datePart, timePart, namePart] = match;

  // Parse date + time
  const dateTimeStr = `${datePart} ${timePart}`;
  const parsed = parseDate(dateTimeStr, 'yyyy-MM-dd HHmm', new Date());

  const startTime = Number.isNaN(parsed.getTime()) ? null : parsed;
  const name = namePart
    ? namePart.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : `Session ${datePart} ${timePart}`;

  return { name, startTime };
}

function toOptionalDate(raw: unknown): Date | undefined {
  if (!raw) return undefined;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? undefined : raw;
  if (typeof raw === 'string' || typeof raw === 'number') {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

function toOptionalNumber(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const n = Number(raw);
  return Number.isNaN(n) ? undefined : n;
}

function toOptionalString(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  return String(raw);
}

/**
 * Parse a single session markdown file.
 *
 * Frontmatter fields (all optional):
 *   start_time, end_time, type, goal, project,
 *   cost_usd, commits, lines_added, lines_removed,
 *   tokens_in, tokens_out, cache_hit_rate, model, cost_per_commit
 */
export async function parseSession(filePath: string): Promise<SessionMeta> {
  const raw = await fs.readFile(filePath, 'utf-8');

  const { data } = matter(raw);

  const { name: parsedName, startTime: filenameStartTime } =
    parseFilename(filePath);

  // Start time: frontmatter wins, then filename
  const fmStartTime = toOptionalDate(data['start_time']);
  const startTime   = fmStartTime ?? filenameStartTime ?? new Date(0);

  const endTime    = toOptionalDate(data['end_time']);
  const durationMin =
    toOptionalNumber(data['duration_min']) ??
    (endTime
      ? (endTime.getTime() - startTime.getTime()) / 60_000
      : undefined);

  const name =
    toOptionalString(data['name']) ??
    toOptionalString(data['title']) ??
    parsedName;

  const goal =
    toOptionalString(data['goal']) ??
    toOptionalString(data['description']) ??
    '';

  return {
    filePath,
    name,
    type:         toSessionType(data['type']),
    goal,
    startTime,
    endTime,
    durationMin,
    project:      toOptionalString(data['project']),
    cost:         toOptionalNumber(data['cost_usd']),
    costPerCommit: toOptionalNumber(data['cost_per_commit']),
    commits:      toOptionalNumber(data['commits']),
    linesAdded:   toOptionalNumber(data['lines_added']),
    linesRemoved: toOptionalNumber(data['lines_removed']),
    inputTokens:  toOptionalNumber(data['tokens_in']),
    outputTokens: toOptionalNumber(data['tokens_out']),
    cacheHitRate: toOptionalNumber(data['cache_hit_rate']),
    model:        toOptionalString(data['model']),
  };
}

/** Find all .md files in the given sessions directory. */
export async function findAllSessions(sessionsDir: string): Promise<string[]> {
  const pattern = path.join(sessionsDir, '**', '*.md').replace(/\\/g, '/');
  const files = await glob(pattern, { nodir: true, absolute: true });
  files.sort();
  return files;
}

/** Parse all session markdown files in the given directory. */
export async function parseAllSessions(
  sessionsDir: string
): Promise<SessionMeta[]> {
  const files = await findAllSessions(sessionsDir);

  const results = await Promise.allSettled(
    files.map((f) => parseSession(f))
  );

  const sessions: SessionMeta[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      sessions.push(result.value);
    }
    // silently skip files that fail to parse
  }

  // Sort by startTime descending
  sessions.sort(
    (a, b) => b.startTime.getTime() - a.startTime.getTime()
  );

  return sessions;
}
