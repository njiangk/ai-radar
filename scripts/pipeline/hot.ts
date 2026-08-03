import { log } from './io.js';
import type { HotTopic, NewsItem } from './types.js';

const MAX_CANDIDATES = 40;
const TOP_N = 8;

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function extractJson(text: string): unknown {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** 选出最新 MAX_CANDIDATES 条新闻（按发布时间倒序），供 LLM 评选热点。 */
function pickCandidates(items: NewsItem[]): NewsItem[] {
  const withTime = items.filter((item) => item.publishedAt);
  withTime.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return withTime.slice(0, MAX_CANDIDATES);
}

/** 解析并过滤 LLM 返回的热点数组（供单测直接验证）。 */
export function parseHotTopics(raw: unknown, validIds: Set<string>): HotTopic[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return (raw as HotTopic[])
    .filter(
      (topic) =>
        topic &&
        typeof topic.title === 'string' &&
        typeof topic.reason === 'string' &&
        Array.isArray(topic.newsIds) &&
        topic.newsIds.some((id) => validIds.has(id)),
    )
    .slice(0, TOP_N)
    .map((topic, index) => ({
      rank: index + 1,
      title: topic.title,
      reason: topic.reason,
      heat: Math.max(0, Math.min(100, Number(topic.heat) || 50)),
      newsIds: topic.newsIds.filter((id) => validIds.has(id)),
    }));
}

async function requestHotTopics(candidates: NewsItem[]): Promise<HotTopic[]> {
  const baseUrl = env('LLM_BASE_URL') ?? 'https://api.openai.com/v1';
  const model = env('LLM_MODEL') ?? 'gpt-4o-mini';
  const apiKey = env('LLM_API_KEY');
  if (!apiKey) {
    return [];
  }

  const payload = candidates.map((item) => ({
    id: item.id,
    title: item.zhTitle || item.title,
    summary: item.zhSummary || item.summary,
    category: item.category,
    sourceName: item.sourceName,
  }));
  const prompt =
    '你是 AI 资讯编辑。从下面的新闻数组中，挑选当前最值得关注的 TOP 8 热点话题，' +
    '合并同类新闻（同一事件的多条报道归入一个热点，newsIds 填对应新闻 id）。' +
    '每条输出：rank(1-8 从热到冷)、title(简洁中文话题名)、reason(一句话说明为什么热，20 字内)、' +
    'heat(0-100 的热度值，越大越热)、newsIds(该热点关联的新闻 id 数组，至少 1 个)。' +
    '只返回 JSON 数组 [{"rank":1,"title":"...","reason":"...","heat":90,"newsIds":["..."]}]，不要输出其他文字。\n' +
    JSON.stringify(payload);

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    throw new Error(`热点接口 HTTP ${response.status}`);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? '';
  const parsed = extractJson(content);
  const validIds = new Set(candidates.map((item) => item.id));
  return parseHotTopics(parsed, validIds);
}

/** 用 LLM 生成热点榜；无 API key 或失败时返回 null（调用方保留旧数据）。 */
export async function generateHotTopics(items: NewsItem[]): Promise<HotTopic[] | null> {
  const apiKey = env('LLM_API_KEY');
  if (!apiKey) {
    return null;
  }
  const candidates = pickCandidates(items);
  if (candidates.length < 5) {
    log('新闻候选不足，跳过热点生成');
    return null;
  }
  try {
    const topics = await requestHotTopics(candidates);
    if (topics.length === 0) {
      return null;
    }
    log(`热点生成完成 ${topics.length} 条`);
    return topics;
  } catch (error) {
    log(`热点生成失败: ${(error as Error).message}`);
    return null;
  }
}
