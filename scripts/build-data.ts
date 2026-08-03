import { appendSnapshot } from './pipeline/history.js';
import {
  dataPath,
  log,
  nowIso,
  readJson,
  writeJson,
} from './pipeline/io.js';
import { fetchCompareData } from './pipeline/compare.js';
import { generateHotTopics } from './pipeline/hot.js';
import { fetchNews, stripHtml } from './pipeline/news.js';
import { assertHistoryFile, assertModelsFile, assertNewsFile } from './pipeline/schema.js';
import { translateItems } from './pipeline/translate.js';
import type { HistoryFile, HotFile, ModelsFile, NewsFile } from './pipeline/types.js';

async function buildNews(): Promise<NewsFile> {
  const { items } = await fetchNews();
  const translated = await translateItems(items);
  const file: NewsFile = {
    version: 1,
    generatedAt: nowIso(),
    items: translated.map((item) => ({
      ...item,
      summary: stripHtml(item.summary),
      zhSummary: item.zhSummary ? stripHtml(item.zhSummary) : null,
    })),
  };
  await writeJson(dataPath('news.json'), file);
  return file;
}

async function buildModels(): Promise<{ file: ModelsFile; fresh: boolean }> {
  const previous = await readJson<ModelsFile>(dataPath('models.json'));
  const compare = await fetchCompareData();
  let stale = false;
  let items = compare.entries;
  if (!compare.fresh && previous?.items.length) {
    stale = true;
    items = previous.items;
    log('模型数据全部失败，保留上次成功数据并标记 stale');
  }
  const sources = compare.fresh
    ? compare.sources
    : (previous?.sources ?? compare.sources).map((source) => ({
        ...source,
        status: 'stale' as const,
      }));
  const file: ModelsFile = {
    version: 1,
    generatedAt: nowIso(),
    stale,
    sources,
    items,
  };
  await writeJson(dataPath('models.json'), file);
  return { file, fresh: compare.fresh };
}

async function buildHistory(models: ModelsFile, fresh: boolean): Promise<HistoryFile> {
  const previous = await readJson<HistoryFile>(dataPath('history.json'));
  const history = fresh
    ? appendSnapshot(previous, models.items)
    : previous ?? { version: 1, snapshots: [] };
  await writeJson(dataPath('history.json'), history);
  return history;
}

async function buildHot(news: NewsFile): Promise<HotFile | null> {
  const topics = await generateHotTopics(news.items);
  if (!topics) {
    return null;
  }
  const file: HotFile = {
    version: 1,
    generatedAt: nowIso(),
    items: topics,
  };
  await writeJson(dataPath('hot.json'), file);
  return file;
}

async function main(): Promise<void> {
  const news = await buildNews();
  const models = await buildModels();
  const history = await buildHistory(models.file, models.fresh);
  const hot = await buildHot(news);
  assertNewsFile(news);
  assertModelsFile(models.file);
  assertHistoryFile(history);
  log(
    `数据生成完成: 新闻 ${news.items.length} 条, 模型 ${models.file.items.length} 个, 历史快照 ${history.snapshots.length} 个` +
      (hot ? `, 热点 ${hot.items.length} 条` : ''),
  );
}

main().catch((error) => {
  console.error('[ai-radar] 数据生成失败', error);
  process.exitCode = 1;
});
