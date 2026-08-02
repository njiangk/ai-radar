import { describe, expect, it } from 'vitest';
import {
  classifyNews,
  dedupeNews,
  normalizeUrl,
  parseAlgolia,
  parseRssOrAtom,
  stripHtml,
} from './news.js';
import type { NewsSourceConfig } from './types.js';

const source: NewsSourceConfig = {
  id: 'test-source',
  name: 'Test Source',
  type: 'rss',
  url: 'https://example.com/feed',
};

describe('news pipeline', () => {
  it('parses RSS and normalizes items', () => {
    const xml = `<?xml version="1.0"?>
    <rss version="2.0">
      <channel>
        <title>AI News</title>
        <item>
          <title>DeepSeek releases a new reasoning model</title>
          <link>https://example.com/post?utm_source=rss</link>
          <pubDate>Tue, 29 Jul 2026 08:00:00 GMT</pubDate>
          <description><![CDATA[<p>A short <b>summary</b>.</p>]]></description>
        </item>
      </channel>
    </rss>`;
    const items = parseRssOrAtom(xml, source);
    expect(items).toHaveLength(1);
    expect(items[0].title).toContain('DeepSeek');
    expect(items[0].summary).toBe('A short summary.');
    expect(items[0].url).toBe('https://example.com/post');
    expect(items[0].category).toBe('模型发布');
    expect(items[0].publishedAt).toBe('2026-07-29T08:00:00.000Z');
  });

  it('parses Atom feeds', () => {
    const xml = `<?xml version="1.0"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <title>New research paper</title>
        <link href="https://example.com/paper" />
        <updated>2026-07-30T10:00:00Z</updated>
        <summary>Study on model training.</summary>
      </entry>
    </feed>`;
    const items = parseRssOrAtom(xml, source);
    expect(items[0].url).toBe('https://example.com/paper');
    expect(items[0].category).toBe('研究');
  });

  it('parses Algolia hits', () => {
    const payload = {
      hits: [
        {
          title: 'Show HN: AI Tool',
          url: 'https://example.com/tool',
          created_at: '2026-07-31T02:00:00.000Z',
          story_text: 'A new developer tool.',
        },
      ],
    };
    const items = parseAlgolia(payload, { ...source, type: 'algolia' });
    expect(items).toHaveLength(1);
    expect(items[0].category).toBe('工具');
  });

  it('dedupes by normalized url and falls back to title', () => {
    const base = parseAlgolia(
      {
        hits: [
          {
            title: 'Same story',
            url: 'https://example.com/a?utm_source=x',
            created_at: '2026-07-31T02:00:00.000Z',
          },
        ],
      },
      { ...source, type: 'algolia' },
    );
    const duplicate = { ...base[0], url: 'https://example.com/a' };
    const withoutUrl = {
      ...base[0],
      id: 'other-id',
      url: '',
      title: 'same story',
    };
    const result = dedupeNews([...base, duplicate, withoutUrl]);
    expect(result).toHaveLength(2);
  });

  it('strips html and removes utm params', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
    expect(normalizeUrl('https://x.com/a?utm_source=rss&b=1')).toBe(
      'https://x.com/a?b=1',
    );
  });

  it('classifies news by keywords', () => {
    expect(classifyNews('OpenAI raises $1B', '')).toBe('融资');
    expect(classifyNews('EU passes AI Act', '')).toBe('政策');
    expect(classifyNews('New SDK released', '')).toBe('工具');
    expect(classifyNews('ChatGPT app update', '')).toBe('产品');
    expect(classifyNews('Unrelated news', '')).toBe('其他');
  });
});
