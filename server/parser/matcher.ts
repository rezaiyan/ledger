import type {
  EnrichedSession,
  EfficiencyMetrics,
  ParsedConversation,
  SessionMeta,
} from '../../src/types.js';
import { computeEfficiency } from '../analyzer/efficiency.js';

/** Buffer (in ms) applied when matching conversation time windows to sessions. */
const TIME_BUFFER_MS = 10 * 60 * 1_000; // 10 minutes

/**
 * Determine whether a conversation overlaps with a session's time window.
 *
 * Rules:
 *  1. The session must have a defined startTime.
 *  2. The conversation time window [conv.startTime, conv.endTime] is expanded
 *     by ±TIME_BUFFER_MS to account for clock imprecision.
 *  3. If the session has an endTime, we check for range overlap.
 *     Otherwise we only check that the conversation started after the
 *     (buffered) session start.
 */
function timeOverlaps(
  session: SessionMeta,
  conv: ParsedConversation
): boolean {
  const sessionStart = session.startTime.getTime();
  const sessionEnd   = session.endTime?.getTime() ?? Infinity;

  // Widen the conversation window by the buffer
  const convStart = conv.startTime.getTime() - TIME_BUFFER_MS;
  const convEnd   = conv.endTime.getTime()   + TIME_BUFFER_MS;

  // Overlap: [sessionStart, sessionEnd] ∩ [convStart, convEnd] ≠ ∅
  return convStart <= sessionEnd && convEnd >= sessionStart;
}

/**
 * Determine whether a conversation's cwd is loosely associated with the
 * session's project.  We only apply this filter when the session has a
 * `project` field set, to avoid false-negatives for sessions without it.
 */
function cwdMatches(
  session: SessionMeta,
  conv: ParsedConversation
): boolean {
  if (!session.project) return true; // no project constraint → always pass
  if (!conv.cwd)        return true; // no cwd info → assume a match

  const project = session.project.toLowerCase();
  const cwd     = conv.cwd.toLowerCase();
  const slug    = conv.projectSlug.toLowerCase();

  return (
    cwd.includes(project)  ||
    slug.includes(project) ||
    project.includes(slug)
  );
}

/**
 * Find all conversations whose time window overlaps with the session,
 * optionally filtered by cwd/project.
 */
export function matchSessionToConversations(
  session: SessionMeta,
  conversations: ParsedConversation[]
): ParsedConversation[] {
  return conversations.filter(
    (conv) => timeOverlaps(session, conv) && cwdMatches(session, conv)
  );
}

/** Build a fully enriched session from its metadata and the full conversation list. */
export function enrichSession(
  session: SessionMeta,
  conversations: ParsedConversation[]
): EnrichedSession {
  const matched    = matchSessionToConversations(session, conversations);
  const efficiency = computeEfficiency(session, matched);

  return {
    ...session,
    conversations: matched,
    efficiency,
  };
}

/** Enrich every session. */
export function enrichAllSessions(
  sessions: SessionMeta[],
  conversations: ParsedConversation[]
): EnrichedSession[] {
  return sessions.map((s) => enrichSession(s, conversations));
}
