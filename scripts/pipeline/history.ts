import { todayInShanghai } from './io.js';
import type { HistoryFile, HistorySnapshot, ModelEntry } from './types.js';

export const HISTORY_LIMIT = 90;

export function appendSnapshot(
  existing: HistoryFile | null,
  models: ModelEntry[],
  date = todayInShanghai(),
): HistoryFile {
  const snapshots = existing?.snapshots?.length ? [...existing.snapshots] : [];
  const items = models
    .filter(
      (model) =>
        model.benchmarkScore !== null ||
        model.livebenchAvg !== null ||
        model.priceInPer1M !== null ||
        model.priceOutPer1M !== null,
    )
    .map((model) => ({
      id: model.id,
      benchmarkScore: model.benchmarkScore,
      livebenchAvg: model.livebenchAvg,
      priceInPer1M: model.priceInPer1M,
      priceOutPer1M: model.priceOutPer1M,
    }));
  const snapshot: HistorySnapshot = { date, items };
  const next = snapshots.filter((entry) => entry.date !== date);
  next.push(snapshot);
  next.sort((a, b) => a.date.localeCompare(b.date));
  return {
    version: 1,
    snapshots: next.slice(-HISTORY_LIMIT),
  };
}
