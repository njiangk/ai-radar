import { describe, expect, it } from 'vitest';
import { generateHotTopics, parseHotTopics } from './hot.js';
import type { NewsItem } from './types.js';

function news(id: string, publishedAt: string): NewsItem {
  return {
    id,
    sourceId: 'hn-ai',
    sourceName: 'Hacker News AI',
    title: `title ${id}`,
    zhTitle: null,
    summary: '',
    zhSummary: null,
    url: `https://example.com/${id}`,
    publishedAt,
    category: '其他',
  };
}

describe('parseHotTopics', () => {
  it('过滤非法条目并按热度截断到 8 条', () => {
    const valid = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']);
    const raw = [
      { rank: 1, title: '热点A', reason: '原因', heat: 95, newsIds: ['a'] },
      { rank: 2, title: '热点B', reason: '原因', heat: 'x', newsIds: ['b'] },
      { title: '缺字段', newsIds: ['c'] },
      { rank: 4, title: '无效ID', reason: '原因', heat: 50, newsIds: ['nope'] },
      ...Array.from({ length: 10 }, (_, i) => ({
        rank: i + 5,
        title: `热点${i}`,
        reason: '原因',
        heat: 80 - i,
        newsIds: [String.fromCharCode(100 + i)],
      })),
    ];
    const result = parseHotTopics(raw, valid);
    expect(result.length).toBeLessThanOrEqual(8);
    expect(result[0].rank).toBe(1);
    expect(result[0].heat).toBe(95);
    // 无 heat 的条目标为默认 50
    expect(result.find((t) => t.title === '热点B')?.heat).toBe(50);
    // 缺字段的条目被过滤
    expect(result.some((t) => t.title === '缺字段')).toBe(false);
    // 无效 newsId 的条目被过滤
    expect(result.some((t) => t.title === '无效ID')).toBe(false);
  });

  it('非数组输入返回空', () => {
    expect(parseHotTopics(null, new Set(['a']))).toEqual([]);
    expect(parseHotTopics({}, new Set(['a']))).toEqual([]);
  });
});

describe('generateHotTopics', () => {
  it('无 LLM_API_KEY 时返回 null（不调用外部）', async () => {
    const items = Array.from({ length: 10 }, (_, i) => news(`n${i}`, `2026-08-0${(i % 9) + 1}T00:00:00Z`));
    const before = process.env.LLM_API_KEY;
    delete process.env.LLM_API_KEY;
    try {
      const result = await generateHotTopics(items);
      expect(result).toBeNull();
    } finally {
      if (before) {
        process.env.LLM_API_KEY = before;
      }
    }
  });

  it('新闻候选不足 5 条时返回 null', async () => {
    process.env.LLM_API_KEY = 'dummy';
    const items = [news('a', '2026-08-01T00:00:00Z'), news('b', '2026-08-02T00:00:00Z')];
    try {
      const result = await generateHotTopics(items);
      expect(result).toBeNull();
    } finally {
      delete process.env.LLM_API_KEY;
    }
  });
});
