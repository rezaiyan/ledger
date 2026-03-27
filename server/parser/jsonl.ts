import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { glob } from 'glob';
import { calculateCost } from '../pricing.js';
import type {
  AssistantEntry,
  ParsedConversation,
  RawEntry,
  UsageData,
} from '../../src/types.js';

const DEFAULT_CLAUDE_DIR = path.join(os.homedir(), '.claude', 'projects');

function isAssistantEntry(entry: RawEntry): entry is AssistantEntry {
  return (
    entry.type === 'assistant' &&
    entry.message != null &&
    typeof (entry.message as Record<string, unknown>).model === 'string' &&
    (entry.message as Record<string, unknown>).usage != null
  );
}

/** Extract the project slug from a file path under the projects dir. */
function extractProjectSlug(
  filePath: string,
  claudeDir: string
): string {
  const rel = path.relative(claudeDir, filePath);
  // rel is like: "-Users-ali-projects-foo/uuid.jsonl"
  // or:          "-Users-ali-projects-foo/uuid/subagents/agent-xxx.jsonl"
  const parts = rel.split(path.sep);
  return parts[0] ?? path.basename(path.dirname(filePath));
}

/** Detect subagent files: either path contains "subagents/" or any message has isSidechain. */
function detectSubagent(
  filePath: string,
  entries: RawEntry[]
): boolean {
  if (filePath.includes(`${path.sep}subagents${path.sep}`)) return true;
  return entries.some((e) => e.isSidechain === true);
}

/**
 * Parse a single JSONL conversation file.
 * Returns null if the file has no assistant messages (e.g. empty / user-only).
 */
export async function parseConversation(
  filePath: string,
  claudeDir: string = DEFAULT_CLAUDE_DIR
): Promise<ParsedConversation | null> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }

  const lines = raw.split('\n').filter((l) => l.trim().length > 0);

  const entries: RawEntry[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as RawEntry;
      entries.push(parsed);
    } catch {
      // skip malformed lines
    }
  }

  if (entries.length === 0) return null;

  const assistantEntries = entries.filter(isAssistantEntry);
  if (assistantEntries.length === 0) return null;

  // Session ID — prefer the first entry's sessionId
  const sessionId =
    entries[0]?.sessionId ??
    path.basename(filePath, '.jsonl');

  // CWD — prefer first user entry's cwd, fall back to first entry
  const cwdEntry = entries.find((e) => e.cwd);
  const cwd = cwdEntry?.cwd ?? '';

  // Timestamps — use all entries
  const timestamps = entries
    .map((e) => new Date(e.timestamp).getTime())
    .filter((t) => !Number.isNaN(t));

  const startTime = new Date(Math.min(...timestamps));
  const endTime   = new Date(Math.max(...timestamps));
  const durationMin =
    (endTime.getTime() - startTime.getTime()) / 60_000;

  // Model — prefer the most recently used model
  const model =
    assistantEntries[assistantEntries.length - 1]?.message.model ??
    'unknown';

  // Aggregate token usage and cost
  let totalCost             = 0;
  let inputTokens           = 0;
  let outputTokens          = 0;
  let cacheCreationTokens   = 0;
  let cacheReadTokens       = 0;
  let webSearches           = 0;

  for (const entry of assistantEntries) {
    const usage: UsageData = entry.message.usage;
    const entryModel       = entry.message.model;

    totalCost           += calculateCost(usage, entryModel);
    inputTokens         += usage.input_tokens;
    outputTokens        += usage.output_tokens;
    cacheReadTokens     += usage.cache_read_input_tokens ?? 0;

    // Cache creation — sum the detailed breakdown if present, else the
    // rolled-up field.
    if (usage.cache_creation) {
      cacheCreationTokens +=
        usage.cache_creation.ephemeral_1h_input_tokens +
        usage.cache_creation.ephemeral_5m_input_tokens;
    } else {
      cacheCreationTokens += usage.cache_creation_input_tokens ?? 0;
    }

    webSearches +=
      usage.server_tool_use?.web_search_requests ?? 0;
  }

  // Cache-hit rate: reads / (reads + writes), as a fraction 0–1
  const totalCacheActivity = cacheReadTokens + cacheCreationTokens;
  const cacheHitRate =
    totalCacheActivity > 0 ? cacheReadTokens / totalCacheActivity : 0;

  const projectSlug = extractProjectSlug(filePath, claudeDir);
  const isSubagent  = detectSubagent(filePath, entries);

  return {
    sessionId,
    filePath,
    projectSlug,
    startTime,
    endTime,
    durationMin,
    model,
    messages: entries.length,
    totalCost,
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    cacheHitRate,
    webSearches,
    cwd,
    isSubagent,
  };
}

/**
 * Find all .jsonl files under the Claude projects directory.
 * Includes subagent files in nested subagents/ directories.
 */
export async function findAllConversations(
  claudeDir: string = DEFAULT_CLAUDE_DIR
): Promise<string[]> {
  // Match top-level conversation files AND subagent files
  const patterns = [
    path.join(claudeDir, '*', '*.jsonl').replace(/\\/g, '/'),
    path.join(claudeDir, '*', '*', 'subagents', '*.jsonl').replace(/\\/g, '/'),
  ];

  const results = await Promise.all(
    patterns.map((p) => glob(p, { nodir: true, absolute: true }))
  );

  // De-duplicate and sort
  const unique = [...new Set(results.flat())];
  unique.sort();
  return unique;
}

/**
 * Parse all conversations found under the Claude projects directory.
 * Skips files that fail to parse or contain no assistant messages.
 */
export async function parseAllConversations(
  claudeDir: string = DEFAULT_CLAUDE_DIR
): Promise<ParsedConversation[]> {
  const files = await findAllConversations(claudeDir);

  const results = await Promise.allSettled(
    files.map((f) => parseConversation(f, claudeDir))
  );

  const conversations: ParsedConversation[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value != null) {
      conversations.push(result.value);
    }
  }

  // Sort by startTime descending (newest first)
  conversations.sort(
    (a, b) => b.startTime.getTime() - a.startTime.getTime()
  );

  return conversations;
}
