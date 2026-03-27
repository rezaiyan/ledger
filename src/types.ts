// Raw JSONL entry types
export interface RawEntry {
  type: string;
  uuid: string;
  timestamp: string;
  sessionId: string;
  parentUuid?: string | null;
  isSidechain?: boolean;
  cwd?: string;
  gitBranch?: string;
  version?: string;
  message?: unknown;
}

export interface AssistantEntry extends RawEntry {
  type: 'assistant';
  message: {
    model: string;
    role: 'assistant';
    content: unknown[];
    stop_reason: string;
    usage: UsageData;
  };
}

export interface UsageData {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation?: {
    ephemeral_1h_input_tokens: number;
    ephemeral_5m_input_tokens: number;
  };
  server_tool_use?: {
    web_search_requests: number;
    web_fetch_requests: number;
  };
}

// Parsed conversation
export interface ParsedConversation {
  sessionId: string;
  filePath: string;
  projectSlug: string;
  startTime: Date;
  endTime: Date;
  durationMin: number;
  model: string;
  messages: number;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cacheHitRate: number;
  webSearches: number;
  cwd: string;
  isSubagent: boolean;
}

// Session (from markdown journals)
export type SessionType =
  | 'feature'
  | 'bug'
  | 'refactor'
  | 'explore'
  | 'research'
  | 'other';

export interface SessionMeta {
  filePath: string;
  name: string;
  type: SessionType;
  goal: string;
  startTime: Date;
  endTime?: Date;
  durationMin?: number;
  project?: string;
  cost?: number;
  costPerCommit?: number;
  commits?: number;
  linesAdded?: number;
  linesRemoved?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheHitRate?: number;
  model?: string;
}

// Enriched session (session + matched conversations)
export interface EnrichedSession extends SessionMeta {
  conversations: ParsedConversation[];
  efficiency: EfficiencyMetrics;
}

export interface EfficiencyMetrics {
  costPerCommit: number | null;
  inputRatio: number;
  cacheHitRate: number;
  isDeadEnd: boolean;
}

// Pricing
export interface ModelPricing {
  inputPerMToken: number;
  outputPerMToken: number;
  cacheWrite1hPerMToken: number;
  cacheWrite5mPerMToken: number;
  cacheReadPerMToken: number;
}

// Summary types
export interface PeriodSummary {
  cost: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  conversations: number;
  sessions: number;
  cacheHitRate: number;
  webSearches: number;
}

export interface SessionSummary {
  totalCost: number;
  avgCostPerSession: number;
  avgCostPerCommit: number | null;
  deadEndSessions: number;
  deadEndCost: number;
  bestSessionType: SessionType | null;
  worstSessionType: SessionType | null;
  avgCacheHitRate: number;
}
