import React from 'react';
import { Text, Box } from 'ink';
import { formatCost, formatDuration, shortModel } from './utils.js';
import type { PeriodSummary } from '../src/types.js';

interface ActiveSession {
  name?: string;
  type?: string;
  cost?: number;
  commits?: number;
  model?: string;
  startTime?: string;
}

interface StatusLineProps {
  currentSession: ActiveSession | null;
  today: PeriodSummary;
  short?: boolean;
}

function minutesSince(isoString: string): number {
  return (Date.now() - new Date(isoString).getTime()) / 60_000;
}

export const StatusLine: React.FC<StatusLineProps> = ({
  currentSession,
  today,
  short = false,
}) => {
  if (short) {
    // Ultra-compact for shell prompt
    if (currentSession && currentSession.cost != null) {
      return (
        <Text>
          {'⬡ '}
          <Text color="cyan">{formatCost(currentSession.cost)}</Text>
        </Text>
      );
    }
    return (
      <Text>
        {'⬡ '}
        <Text color="green">{formatCost(today.cost)}</Text>
        <Text color="gray">/day</Text>
      </Text>
    );
  }

  if (currentSession) {
    const name = currentSession.name ?? 'session';
    const cost = currentSession.cost ?? 0;
    const commits = currentSession.commits ?? 0;
    const model = shortModel(currentSession.model ?? 'sonnet');
    const durationStr = currentSession.startTime
      ? formatDuration(minutesSince(currentSession.startTime))
      : '';

    const parts: string[] = [
      `● ${name}`,
      `  ${formatCost(cost)}`,
    ];
    if (durationStr) parts.push(`· ${durationStr}`);
    parts.push(`· ${model}`);
    if (commits > 0) parts.push(`· ${commits} commit${commits !== 1 ? 's' : ''}`);

    return (
      <Box>
        <Text color="green">● </Text>
        <Text bold>{name}</Text>
        <Text color="gray">  </Text>
        <Text color="cyan">{formatCost(cost)}</Text>
        {durationStr ? <Text color="gray"> · {durationStr}</Text> : null}
        <Text color="gray"> · {model}</Text>
        {commits > 0 ? (
          <Text color="gray"> · {commits} commit{commits !== 1 ? 's' : ''}</Text>
        ) : null}
      </Box>
    );
  }

  // No active session
  return (
    <Box>
      <Text color="gray">No active session  </Text>
      <Text>Today: </Text>
      <Text color="cyan">{formatCost(today.cost)}</Text>
      <Text color="gray"> · {today.conversations} conversation{today.conversations !== 1 ? 's' : ''}</Text>
    </Box>
  );
};

export default StatusLine;
