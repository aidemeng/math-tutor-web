// Generated from math-tutor-service/shared/chat-timeline.ts
export function chatTimeline<
  T extends {
    index: number;
    startedAt?: number;
    mistakeAnalysisId?: string;
    mistakeAnalysis?: { id: string };
  },
  A extends { id: string; createdAt: number },
>(turns: T[], analyses: A[]) {
  const attached = new Set(
    turns.flatMap((turn) => (turn.mistakeAnalysis ? [turn.mistakeAnalysis.id] : [])),
  );
  const rows = analyses || [];
  const times = new Map(rows.map((row) => [row.id, Number(row.createdAt) || 0]));
  // Server report times and client live-turn times can disagree. Never let
  // that disagreement reverse turns which the conversation already ordered.
  let previousTime = -1;
  const orderedTurns = turns.map((turn) => {
    const sourceTime = turn.mistakeAnalysisId ? times.get(turn.mistakeAnalysisId) : undefined;
    const time = Math.max(
      Number(turn.startedAt) || 0,
      sourceTime === undefined ? 0 : sourceTime + 1,
      previousTime + 1,
    );
    previousTime = time;
    return { ...turn, kind: 'turn' as const, key: 'turn-' + turn.index, time };
  });
  return [
    ...orderedTurns,
    ...rows
      .filter((row) => !attached.has(row.id))
      .map((analysis) => ({
        kind: 'mistake' as const,
        key: 'mistake-' + analysis.id,
        time: Number(analysis.createdAt) || 0,
        analysis,
      })),
  ].sort((a, b) => a.time - b.time || (a.kind === b.kind ? 0 : a.kind === 'mistake' ? -1 : 1));
}
