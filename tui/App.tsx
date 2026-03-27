import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import open from 'open';
import { formatCost, formatDuration, formatTokens, formatCacheHit, shortModel, truncate } from './utils.js';
import { parseAllConversations } from '../server/parser/jsonl.js';
import type { ParsedConversation, PeriodSummary, EnrichedSession } from '../src/types.js';
import os from 'os';
import path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AppProps {
  port?: number;
  claudeDir?: string;
  sessionsDir?: string;
}

interface DashboardData {
  today: PeriodSummary;
  thisMonth: PeriodSummary;
  currentSession: Record<string, unknown> | null;
  recentConversations: ParsedConversation[];
  sessions: EnrichedSession[];
}

// ---------------------------------------------------------------------------
// Helpers
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

function buildSummary(
  conversations: ParsedConversation[],
  from: Date,
  sessions: EnrichedSession[]
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

function minutesSince(date: Date): number {
  return (Date.now() - date.getTime()) / 60_000;
}

async function fetchFromApi(
  port: number
): Promise<{ summary: { today: PeriodSummary; thisMonth: PeriodSummary }; status: Record<string, unknown>; conversations: ParsedConversation[] } | null> {
  try {
    const baseUrl = `http://localhost:${port}`;
    const [summaryRes, statusRes, convRes] = await Promise.all([
      fetch(`${baseUrl}/api/summary`),
      fetch(`${baseUrl}/api/status`),
      fetch(`${baseUrl}/api/conversations`),
    ]);
    if (!summaryRes.ok || !statusRes.ok || !convRes.ok) return null;
    const [summary, status, conversations] = await Promise.all([
      summaryRes.json() as Promise<{ today: PeriodSummary; thisMonth: PeriodSummary }>,
      statusRes.json() as Promise<Record<string, unknown>>,
      convRes.json() as Promise<ParsedConversation[]>,
    ]);
    return { summary, status, conversations };
  } catch {
    return null;
  }
}

async function loadDataDirect(
  claudeDir: string,
  _sessionsDir: string
): Promise<DashboardData> {
  const conversations = await parseAllConversations(claudeDir);
  const now = new Date();
  const today = buildSummary(conversations, startOfDay(now), []);
  const thisMonth = buildSummary(conversations, startOfMonth(now), []);
  return {
    today,
    thisMonth,
    currentSession: null,
    recentConversations: conversations.slice(0, 10),
    sessions: [],
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const HRule: React.FC<{ width?: number; label?: string }> = ({ width = 55, label }) => {
  if (label) {
    const dashes = '─'.repeat(Math.max(0, width - label.length - 3));
    return (
      <Text color="gray">{` ─── ${label} `}<Text>{dashes}</Text></Text>
    );
  }
  return <Text color="gray">{'─'.repeat(width)}</Text>;
};

interface ConvRowProps {
  conv: ParsedConversation;
  isSelected: boolean;
  index: number;
}

const ConvRow: React.FC<ConvRowProps> = ({ conv, isSelected, index }) => {
  const dateStr = conv.startTime.toISOString().slice(0, 10);
  const cwd = truncate(conv.cwd || conv.projectSlug, 20);
  const cost = formatCost(conv.totalCost);
  const cache = formatCacheHit(conv.cacheHitRate);
  const model = shortModel(conv.model);
  const dur = formatDuration(conv.durationMin);

  return (
    <Box>
      <Text color={isSelected ? 'cyan' : 'gray'}>{isSelected ? ' ▶  ' : '     '}</Text>
      <Text color={isSelected ? 'white' : 'gray'}>{dateStr}  </Text>
      <Text color={isSelected ? 'white' : 'gray'}>{cwd.padEnd(22)}</Text>
      <Text color={isSelected ? 'cyan' : 'gray'}>{cost.padStart(7)}  </Text>
      <Text color={isSelected ? 'yellow' : 'gray'}>{cache.padStart(4)}  </Text>
      <Text color={isSelected ? 'magenta' : 'gray'}>{model.padEnd(7)}  </Text>
      <Text color={isSelected ? 'white' : 'gray'}>{dur}</Text>
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------

const App: React.FC<AppProps> = ({
  port = 4200,
  claudeDir = path.join(os.homedir(), '.claude', 'projects'),
  sessionsDir = path.join(process.cwd(), 'sessions'),
}) => {
  const { exit } = useApp();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiData = await fetchFromApi(port);
      if (apiData) {
        // Dates from JSON are strings — coerce them back
        const conversations: ParsedConversation[] = (apiData.conversations as unknown[]).map(
          (c) => {
            const conv = c as unknown as ParsedConversation & { startTime: string; endTime: string };
            return {
              ...conv,
              startTime: new Date(conv.startTime),
              endTime: new Date(conv.endTime),
            };
          }
        );
        const status = apiData.status;
        setData({
          today: apiData.summary.today,
          thisMonth: apiData.summary.thisMonth,
          currentSession: (status['currentSession'] as Record<string, unknown> | null) ?? null,
          recentConversations: conversations.slice(0, 10),
          sessions: [],
        });
      } else {
        // Fallback: parse directly
        const direct = await loadDataDirect(claudeDir, sessionsDir);
        setData(direct);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [port, claudeDir, sessionsDir]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshTick]);

  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) {
      exit();
      return;
    }

    if (input === 'r') {
      setRefreshTick((t) => t + 1);
      return;
    }

    if (input === 'o') {
      void open(`http://localhost:${port}`);
      return;
    }

    if (key.downArrow && data) {
      setSelectedIndex((i) => Math.min(i + 1, (data.recentConversations.length || 1) - 1));
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(i - 1, 0));
      return;
    }
  });

  const width = 57;

  // Active session info
  const cs = data?.currentSession;
  const csName = typeof cs?.['name'] === 'string' ? cs['name'] : null;
  const csCost = typeof cs?.['cost'] === 'number' ? cs['cost'] : null;
  const csType = typeof cs?.['type'] === 'string' ? cs['type'] : null;
  const csModel = typeof cs?.['model'] === 'string' ? shortModel(cs['model']) : 'sonnet';
  const csStart = typeof cs?.['startTime'] === 'string' ? new Date(cs['startTime']) : null;
  const csCache =
    typeof cs?.['cacheHitRate'] === 'number'
      ? formatCacheHit(cs['cacheHitRate'])
      : '—';

  const todayCost = formatCost(data?.today.cost ?? 0);
  const todaySessions = data?.today.sessions ?? 0;
  const todayConvs = data?.today.conversations ?? 0;
  const todayCommitsRaw = data?.sessions.filter((s) => {
    const startOfToday = startOfDay(new Date());
    return s.startTime >= startOfToday;
  }).reduce((sum, s) => sum + (s.commits ?? 0), 0) ?? 0;

  const monthCost = formatCost(data?.thisMonth.cost ?? 0);
  const monthSessions = data?.thisMonth.sessions ?? 0;
  const monthConvs = data?.thisMonth.conversations ?? 0;

  return (
    <Box flexDirection="column" width={width + 2}>
      {/* Top border */}
      <Box>
        <Text color="cyan">{'┌─ Ledger '}</Text>
        <Text color="gray">{'─'.repeat(Math.max(0, width - 28))}</Text>
        <Text color="cyan">{' press q to quit ─┐'}</Text>
      </Box>

      <Box>
        <Text color="cyan">{'│'}</Text>
        <Text>{' '.repeat(width)}</Text>
        <Text color="cyan">{'│'}</Text>
      </Box>

      {/* TODAY / MONTH summary */}
      <Box>
        <Text color="cyan">{'│  '}</Text>
        <Text bold color="yellow">TODAY  </Text>
        <Text color="cyan">{todayCost}</Text>
        <Text color="gray">
          {' · '}
          {todaySessions > 0 ? `${todaySessions} sessions` : `${todayConvs} conversations`}
          {todayCommitsRaw > 0 ? ` · ${todayCommitsRaw} commits` : ''}
        </Text>
        <Text>{' '.repeat(Math.max(0, width - 7 - todayCost.length - String(todaySessions > 0 ? `${todaySessions} sessions` : `${todayConvs} conversations`).length - (todayCommitsRaw > 0 ? ` · ${todayCommitsRaw} commits`.length : 0) - 3))}</Text>
        <Text color="cyan">{'│'}</Text>
      </Box>

      <Box>
        <Text color="cyan">{'│  '}</Text>
        <Text bold color="yellow">MONTH  </Text>
        <Text color="cyan">{monthCost}</Text>
        <Text color="gray">
          {' · '}
          {monthSessions > 0 ? `${monthSessions} sessions` : `${monthConvs} conversations`}
        </Text>
        <Text>{' '.repeat(Math.max(0, width - 7 - monthCost.length - String(monthSessions > 0 ? `${monthSessions} sessions` : `${monthConvs} conversations`).length - 3))}</Text>
        <Text color="cyan">{'│'}</Text>
      </Box>

      <Box>
        <Text color="cyan">{'│'}</Text>
        <Text>{' '.repeat(width)}</Text>
        <Text color="cyan">{'│'}</Text>
      </Box>

      {/* Active session section */}
      <Box>
        <Text color="cyan">{'│  '}</Text>
        <HRule width={width - 4} label="ACTIVE SESSION" />
        <Text color="cyan">{'  │'}</Text>
      </Box>

      {loading ? (
        <Box>
          <Text color="cyan">{'│  '}</Text>
          <Text color="gray">Loading…</Text>
          <Text>{' '.repeat(Math.max(0, width - 10))}</Text>
          <Text color="cyan">{'│'}</Text>
        </Box>
      ) : error ? (
        <Box>
          <Text color="cyan">{'│  '}</Text>
          <Text color="red">{truncate(error, width - 4)}</Text>
          <Text color="cyan">{'│'}</Text>
        </Box>
      ) : cs && csName ? (
        <>
          <Box>
            <Text color="cyan">{'│  '}</Text>
            <Text bold color="white">{csName}</Text>
            {csType ? <Text color="gray">  [{csType}]</Text> : null}
            {csStart ? (
              <Text color="gray">  started {formatDuration(minutesSince(csStart))} ago</Text>
            ) : null}
            <Text color="cyan">{'│'}</Text>
          </Box>
          <Box>
            <Text color="cyan">{'│  '}</Text>
            <Text color="gray">cost so far: </Text>
            <Text color="cyan">{csCost !== null ? formatCost(csCost) : '—'}</Text>
            <Text color="gray">  ·  cache: {csCache}  ·  {csModel}</Text>
            <Text color="cyan">{'│'}</Text>
          </Box>
        </>
      ) : (
        <Box>
          <Text color="cyan">{'│  '}</Text>
          <Text color="gray">No active session</Text>
          <Text>{' '.repeat(Math.max(0, width - 20))}</Text>
          <Text color="cyan">{'│'}</Text>
        </Box>
      )}

      <Box>
        <Text color="cyan">{'│'}</Text>
        <Text>{' '.repeat(width)}</Text>
        <Text color="cyan">{'│'}</Text>
      </Box>

      {/* Recent conversations */}
      <Box>
        <Text color="cyan">{'│  '}</Text>
        <HRule width={width - 4} label="RECENT CONVERSATIONS" />
        <Text color="cyan">{'  │'}</Text>
      </Box>

      {(data?.recentConversations ?? []).length === 0 ? (
        <Box>
          <Text color="cyan">{'│  '}</Text>
          <Text color="gray">No conversations found</Text>
          <Text>{' '.repeat(Math.max(0, width - 24))}</Text>
          <Text color="cyan">{'│'}</Text>
        </Box>
      ) : (
        (data?.recentConversations ?? []).map((conv, i) => (
          <Box key={conv.sessionId}>
            <Text color="cyan">{'│'}</Text>
            <ConvRow conv={conv} isSelected={i === selectedIndex} index={i} />
            <Text color="cyan">{'│'}</Text>
          </Box>
        ))
      )}

      <Box>
        <Text color="cyan">{'│'}</Text>
        <Text>{' '.repeat(width)}</Text>
        <Text color="cyan">{'│'}</Text>
      </Box>

      {/* Keyboard hints */}
      <Box>
        <Text color="cyan">{'│  '}</Text>
        <Text color="gray">
          [o] open dashboard  [r] refresh  [↑↓] navigate  [q] quit
        </Text>
        <Text>{' '.repeat(Math.max(0, width - 52))}</Text>
        <Text color="cyan">{'│'}</Text>
      </Box>

      {/* Bottom border */}
      <Box>
        <Text color="cyan">{'└'}</Text>
        <Text color="gray">{'─'.repeat(width)}</Text>
        <Text color="cyan">{'┘'}</Text>
      </Box>
    </Box>
  );
};

export default App;
