import type { HistoryFile, ModelsFile, NewsFile } from '../types';

async function loadJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}${path}`, {
      cache: 'default',
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function loadNews(): Promise<NewsFile | null> {
  return loadJson<NewsFile>('data/news.json');
}

export function loadModels(): Promise<ModelsFile | null> {
  return loadJson<ModelsFile>('data/models.json');
}

export function loadHistory(): Promise<HistoryFile | null> {
  return loadJson<HistoryFile>('data/history.json');
}
