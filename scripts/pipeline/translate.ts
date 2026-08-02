import { log } from './io.js';
import type { NewsItem } from './types.js';

const BATCH_SIZE = 15;
const MAX_ITEMS = 60;

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function extractJson(text: string): unknown {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return JSON.parse(text.slice(start, end + 1));
}

async function translateBatch(items: NewsItem[]): Promise<Array<{ id: string; zhTitle: string; zhSummary: string }>> {
  const baseUrl = env('LLM_BASE_URL') ?? 'https://api.openai.com/v1';
  const model = env('LLM_MODEL') ?? 'gpt-4o-mini';
  const apiKey = env('LLM_API_KEY');
  if (!apiKey) {
    return [];
  }

  const payload = items.map((item) => ({
    id: item.id,
    title: item.title,
    summary: item.summary,
  }));
  const prompt =
    '把下面的 JSON 数组中的每条新闻标题翻译成简洁中文标题，并把摘要翻译成一句中文摘要。' +
    '只返回 JSON 数组，格式为 [{"id":"...","zhTitle":"...","zhSummary":"..."}]，不要输出其他文字。\n' +
    JSON.stringify(payload);

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    throw new Error(`翻译接口 HTTP ${response.status}`);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? '';
  const parsed = extractJson(content);
  if (!Array.isArray(parsed)) {
    throw new Error('翻译结果不是 JSON 数组');
  }
  return parsed as Array<{ id: string; zhTitle: string; zhSummary: string }>;
}

export async function translateItems(items: NewsItem[]): Promise<NewsItem[]> {
  const apiKey = env('LLM_API_KEY');
  if (!apiKey) {
    return items;
  }
  const target = items.slice(0, MAX_ITEMS);
  const translated = new Map<string, { zhTitle: string; zhSummary: string }>();
  for (let index = 0; index < target.length; index += BATCH_SIZE) {
    const batch = target.slice(index, index + BATCH_SIZE);
    try {
      const result = await translateBatch(batch);
      for (const entry of result) {
        if (entry?.id && typeof entry.zhTitle === 'string') {
          translated.set(entry.id, {
            zhTitle: entry.zhTitle,
            zhSummary: typeof entry.zhSummary === 'string' ? entry.zhSummary : '',
          });
        }
      }
      log(`翻译批次完成 ${index + batch.length}/${target.length}`);
    } catch (error) {
      log(`翻译批次失败: ${(error as Error).message}`);
    }
  }
  return items.map((item) => {
    const value = translated.get(item.id);
    if (!value) {
      return item;
    }
    return {
      ...item,
      zhTitle: value.zhTitle,
      zhSummary: value.zhSummary,
    };
  });
}
