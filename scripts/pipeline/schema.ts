import type { HistoryFile, ModelsFile, NewsFile } from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function assertNewsFile(value: unknown): asserts value is NewsFile {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.items)) {
    throw new Error('news.json 结构不合法');
  }
  for (const item of value.items) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.title !== 'string') {
      throw new Error('news.json 存在不合法的新闻条目');
    }
  }
}

export function assertModelsFile(value: unknown): asserts value is ModelsFile {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.items) ||
    !Array.isArray(value.sources)
  ) {
    throw new Error('models.json 结构不合法');
  }
  for (const item of value.items) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.name !== 'string') {
      throw new Error('models.json 存在不合法的模型条目');
    }
  }
}

export function assertHistoryFile(value: unknown): asserts value is HistoryFile {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.snapshots)) {
    throw new Error('history.json 结构不合法');
  }
}
