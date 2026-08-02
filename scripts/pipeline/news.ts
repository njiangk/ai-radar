import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { fetchText, log, sha1 } from './io.js';
import type { NewsCategory, NewsItem, NewsSourceConfig } from './types.js';

const CATEGORY_RULES: Array<{ category: NewsCategory; keywords: string[] }> = [
  {
    category: '模型发布',
    keywords: [
      'gpt-',
      'claude',
      'gemini',
      'llama ',
      'deepseek',
      'qwen',
      'reasoning model',
      'frontier model',
      'model release',
      'release model',
      '模型发布',
      '新模型',
      '发布模型',
    ],
  },
  {
    category: '融资',
    keywords: [
      'funding',
      'raises',
      'raised',
      'series a',
      'series b',
      'series c',
      'valuation',
      'acquisition',
      'acquires',
      'investment',
      '融资',
      '收购',
    ],
  },
  {
    category: '政策',
    keywords: [
      'regulation',
      'regulatory',
      'policy',
      'government',
      'law',
      'lawsuit',
      'legal',
      'compliance',
      'ai act',
      'executive order',
      '监管',
      '立法',
      '政策',
    ],
  },
  {
    category: '研究',
    keywords: [
      'research',
      'paper',
      'arxiv',
      'benchmark',
      'study',
      'training',
      'fine-tun',
      'open source',
      'open-sourced',
      'weights',
      '论文',
      '研究',
    ],
  },
  {
    category: '工具',
    keywords: [
      'sdk',
      'api',
      'plugin',
      'developer',
      'platform',
      'tool',
      'integration',
      '开源工具',
      '工具箱',
    ],
  },
  {
    category: '产品',
    keywords: [
      'product',
      'app',
      'feature',
      'update',
      'launch',
      'chatgpt',
      'copilot',
      'assistant',
      '产品',
      '上线',
      '更新',
    ],
  },
];

function textOf(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(textOf).join(' ');
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return textOf(record['#text'] ?? record.__cdata ?? record.content ?? '');
  }
  return '';
}

function linkOf(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return linkOf(value[0]);
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record['@_href']) {
      return String(record['@_href']);
    }
    if (record.url) {
      return String(record.url);
    }
  }
  return '';
}

function parseDate(value: unknown): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(textOf(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?，。；：！？])/g, '$1')
    .trim()
    .slice(0, 400);
}

export function normalizeUrl(value: string): string {
  let url = value.trim();
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith('utm_')) {
        parsed.searchParams.delete(key);
      }
    }
    url = parsed.toString();
  } catch {
    // Keep the raw value when it is not a parseable URL.
  }
  return url.replace(/\/$/, '');
}

function makeItem(
  source: NewsSourceConfig,
  input: { title: string; url: string; publishedAt: string | null; summary: string },
): NewsItem {
  const url = normalizeUrl(input.url);
  const title = textOf(input.title) || input.url;
  const id = sha1(url || `${source.id}:${title.toLowerCase()}`);
  return {
    id,
    sourceId: source.id,
    sourceName: source.name,
    title,
    zhTitle: null,
    summary: stripHtml(input.summary),
    zhSummary: null,
    url,
    publishedAt: input.publishedAt ?? '',
    category: classifyNews(title, stripHtml(input.summary)),
  };
}

export function parseRssOrAtom(xml: string, source: NewsSourceConfig): NewsItem[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    cdataPropName: '__cdata',
  });
  const doc = parser.parse(xml) as Record<string, unknown>;
  const rss = (doc.rss as Record<string, unknown> | undefined)?.channel as
    | Record<string, unknown>
    | undefined;
  const feed = doc.feed as Record<string, unknown> | undefined;

  if (!rss && !feed) {
    return [];
  }

  const rawItems: unknown[] = [];
  if (rss) {
    const items = rss.item;
    rawItems.push(...(Array.isArray(items) ? items : items ? [items] : []));
  }
  if (feed) {
    const entries = feed.entry;
    rawItems.push(...(Array.isArray(entries) ? entries : entries ? [entries] : []));
  }

  return rawItems
    .map((raw) => {
      const item = raw as Record<string, unknown>;
      const summary =
        textOf(
          item.description ??
            item.contentSnippet ??
            item.summary ??
            item.content ??
            item['media:description'] ??
            '',
        );
      return makeItem(source, {
        title: textOf(item.title ?? ''),
        url: linkOf(item.link ?? ''),
        publishedAt:
          parseDate(item.pubDate ?? item.isoDate ?? item.published ?? item.updated) ??
          null,
        summary,
      });
    })
    .filter((item) => item.title && item.url);
}

export function parseAlgolia(payload: unknown, source: NewsSourceConfig): NewsItem[] {
  const hits = (payload as { hits?: unknown[] }).hits ?? [];
  return hits
    .map((raw) => {
      const hit = raw as Record<string, unknown>;
      return makeItem(source, {
        title: textOf(hit.title ?? ''),
        url: textOf(hit.url ?? ''),
        publishedAt:
          parseDate(hit.created_at ?? hit.createdAt) ??
          new Date().toISOString(),
        summary: textOf(hit.story_text ?? hit.comment_text ?? ''),
      });
    })
    .filter((item) => item.title && item.url);
}

export function classifyNews(title: string, summary: string): NewsCategory {
  const haystack = `${title} ${summary}`.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) {
      return rule.category;
    }
  }
  return '其他';
}

export function dedupeNews(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const output: NewsItem[] = [];
  for (const item of items) {
    const key = item.url || `${item.sourceId}:${item.title.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(item);
  }
  return output;
}

export async function loadNewsSources(): Promise<NewsSourceConfig[]> {
  const text = await readFile(join(process.cwd(), 'config', 'news-sources.json'), 'utf8');
  return JSON.parse(text) as NewsSourceConfig[];
}

async function fetchSource(source: NewsSourceConfig): Promise<NewsItem[]> {
  const text = await fetchText(source.url, 30000);
  if (source.type === 'algolia') {
    return parseAlgolia(JSON.parse(text), source);
  }
  return parseRssOrAtom(text, source);
}

export async function fetchNews(): Promise<{
  items: NewsItem[];
  failures: string[];
}> {
  const sources = await loadNewsSources();
  const results = await Promise.allSettled(sources.map((source) => fetchSource(source)));
  const failures: string[] = [];
  const items: NewsItem[] = [];
  results.forEach((result, index) => {
    const source = sources[index];
    if (result.status === 'rejected') {
      failures.push(source.id);
      log(`新闻源失败 ${source.id}: ${(result.reason as Error).message}`);
      return;
    }
    items.push(...result.value);
  });
  const unique = dedupeNews(items);
  unique.sort((a, b) => {
    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bTime - aTime;
  });
  log(`新闻抓取完成: ${unique.length} 条，失败 ${failures.length} 个源`);
  return { items: unique.slice(0, 300), failures };
}
