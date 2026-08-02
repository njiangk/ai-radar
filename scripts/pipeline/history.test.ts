import { describe, expect, it } from 'vitest';
import { appendSnapshot, HISTORY_LIMIT } from './history.js';
import type { HistoryFile, ModelEntry } from './types.js';

const model: ModelEntry = {
  id: 'openai/gpt-5',
  name: 'GPT-5',
  provider: 'openai',
  contextLength: 400000,
  priceInPer1M: 1,
  priceOutPer1M: 4,
  benchmarkScore: 90,
  livebenchAvg: 98,
  usageTokens: 100,
  updatedAt: '2026-07-31T00:00:00.000Z',
};

describe('history snapshots', () => {
  it('appends a snapshot for today', () => {
    const result = appendSnapshot(null, [model], '2026-08-01');
    expect(result.snapshots).toHaveLength(1);
    expect(result.snapshots[0].items[0].id).toBe('openai/gpt-5');
  });

  it('replaces the snapshot of the same date', () => {
    const existing: HistoryFile = {
      version: 1,
      snapshots: [
        {
          date: '2026-08-01',
          items: [
            {
              id: 'openai/gpt-5',
              benchmarkScore: 89,
              livebenchAvg: 97,
              priceInPer1M: 1,
              priceOutPer1M: 4,
            },
          ],
        },
      ],
    };
    const result = appendSnapshot(existing, [model], '2026-08-01');
    expect(result.snapshots).toHaveLength(1);
    expect(result.snapshots[0].items[0].benchmarkScore).toBe(90);
    expect(result.snapshots[0].items[0].livebenchAvg).toBe(98);
  });

  it('keeps at most the configured number of snapshots', () => {
    const existing: HistoryFile = {
      version: 1,
      snapshots: Array.from({ length: HISTORY_LIMIT }, (_, index) => ({
        date: `2026-01-${String(index + 1).padStart(2, '0')}`,
        items: [],
      })),
    };
    const result = appendSnapshot(existing, [model], '2026-08-01');
    expect(result.snapshots).toHaveLength(HISTORY_LIMIT);
  });
});
