import type {
  EfficiencyMetrics,
  EnrichedSession,
  ParsedConversation,
  SessionMeta,
  SessionSummary,
  SessionType,
} from '../../src/types.js';

/**
 * Compute the efficiency metrics for a session given its matched conversations.
 *
 * - costPerCommit:  derived from session frontmatter if present; otherwise
 *                  computed from total conversation cost ÷ commits.
 * - inputRatio:     fraction of tokens that were uncached inputs
 *                  (lower = better cache utilisation).
 * - cacheHitRate:  fraction 0–1; from session frontmatter if present,
 *                  otherwise computed from conversations.
 * - isDeadEnd:     true when the session produced no commits and
 *                  accumulated meaningful cost (> $0.10).
 */
export function computeEfficiency(
  session: SessionMeta,
  conversations: ParsedConversation[]
): EfficiencyMetrics {
  // ---- Cost & commit data ------------------------------------------------
  const totalConvCost = conversations.reduce(
    (sum, c) => sum + c.totalCost,
    0
  );
  const effectiveCost = session.cost ?? totalConvCost;

  const commits = session.commits ?? 0;

  const costPerCommit: number | null =
    session.costPerCommit != null
      ? session.costPerCommit
      : commits > 0
      ? effectiveCost / commits
      : null;

  // ---- Token aggregates --------------------------------------------------
  let totalInput     = 0;
  let totalOutput    = 0;
  let totalCacheRead = 0;
  let totalCacheCreation = 0;

  for (const conv of conversations) {
    totalInput         += conv.inputTokens;
    totalOutput        += conv.outputTokens;
    totalCacheRead     += conv.cacheReadTokens;
    totalCacheCreation += conv.cacheCreationTokens;
  }

  const allTokens =
    totalInput + totalOutput + totalCacheRead + totalCacheCreation;

  // inputRatio: raw uncached input tokens as a fraction of all tokens
  const inputRatio = allTokens > 0 ? totalInput / allTokens : 0;

  // ---- Cache hit rate ----------------------------------------------------
  let cacheHitRate: number;
  if (session.cacheHitRate != null) {
    cacheHitRate = session.cacheHitRate;
  } else if (conversations.length > 0) {
    const totalCacheActivity = totalCacheRead + totalCacheCreation;
    cacheHitRate =
      totalCacheActivity > 0 ? totalCacheRead / totalCacheActivity : 0;
  } else {
    cacheHitRate = 0;
  }

  // ---- Dead-end detection ------------------------------------------------
  const isDeadEnd = commits === 0 && effectiveCost > 0.10;

  return { costPerCommit, inputRatio, cacheHitRate, isDeadEnd };
}

// ---------------------------------------------------------------------------
// Session summary
// ---------------------------------------------------------------------------

/**
 * Aggregate a list of enriched sessions into high-level summary statistics.
 */
export function getSessionSummary(
  sessions: EnrichedSession[]
): SessionSummary {
  if (sessions.length === 0) {
    return {
      totalCost:         0,
      avgCostPerSession: 0,
      avgCostPerCommit:  null,
      deadEndSessions:   0,
      deadEndCost:       0,
      bestSessionType:   null,
      worstSessionType:  null,
      avgCacheHitRate:   0,
    };
  }

  let totalCost    = 0;
  let totalCommits = 0;
  let deadEndSessions = 0;
  let deadEndCost  = 0;
  let cacheHitSum  = 0;

  // Accumulate cost per session type
  const typeCostAccum: Partial<Record<SessionType, { cost: number; count: number }>> = {};

  for (const session of sessions) {
    // Use session-level cost if set, else sum conversations
    const cost =
      session.cost ??
      session.conversations.reduce((s, c) => s + c.totalCost, 0);

    totalCost    += cost;
    totalCommits += session.commits ?? 0;
    cacheHitSum  += session.efficiency.cacheHitRate;

    if (session.efficiency.isDeadEnd) {
      deadEndSessions++;
      deadEndCost += cost;
    }

    const t = session.type;
    if (!typeCostAccum[t]) typeCostAccum[t] = { cost: 0, count: 0 };
    typeCostAccum[t]!.cost  += cost;
    typeCostAccum[t]!.count += 1;
  }

  const avgCostPerSession = totalCost / sessions.length;
  const avgCostPerCommit  = totalCommits > 0 ? totalCost / totalCommits : null;
  const avgCacheHitRate   = cacheHitSum / sessions.length;

  // Best = lowest average cost-per-session type; worst = highest
  const typeEntries = Object.entries(typeCostAccum) as [
    SessionType,
    { cost: number; count: number }
  ][];

  let bestSessionType:  SessionType | null = null;
  let worstSessionType: SessionType | null = null;

  if (typeEntries.length > 0) {
    const sorted = typeEntries.sort(
      (a, b) => a[1].cost / a[1].count - b[1].cost / b[1].count
    );
    bestSessionType  = sorted[0][0];
    worstSessionType = sorted[sorted.length - 1][0];
  }

  return {
    totalCost,
    avgCostPerSession,
    avgCostPerCommit,
    deadEndSessions,
    deadEndCost,
    bestSessionType,
    worstSessionType,
    avgCacheHitRate,
  };
}
