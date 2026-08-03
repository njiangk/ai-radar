export type NewsCategory =
  | '模型发布'
  | '产品'
  | '研究'
  | '融资'
  | '政策'
  | '工具'
  | '其他';

export interface NewsSourceConfig {
  id: string;
  name: string;
  type: 'rss' | 'algolia';
  url: string;
}

export interface NewsItem {
  id: string;
  sourceId: string;
  sourceName: string;
  title: string;
  zhTitle: string | null;
  summary: string;
  zhSummary: string | null;
  url: string;
  publishedAt: string;
  category: NewsCategory;
}

export interface NewsFile {
  version: 1;
  generatedAt: string;
  items: NewsItem[];
}

export interface HotTopic {
  rank: number;
  title: string;
  reason: string;
  heat: number;
  newsIds: string[];
}

export interface HotFile {
  version: 1;
  generatedAt: string;
  items: HotTopic[];
}

export interface ModelEntry {
  id: string;
  name: string;
  provider: string;
  contextLength: number | null;
  priceInPer1M: number | null;
  priceOutPer1M: number | null;
  benchmarkScore: number | null;
  livebenchAvg: number | null;
  usageTokens: number | null;
  updatedAt: string;
}

export type SourceStatus = 'ok' | 'error' | 'stale';

export interface SourceInfo {
  id: string;
  status: SourceStatus;
  fetchedAt: string | null;
}

export interface ModelsFile {
  version: 1;
  generatedAt: string;
  stale: boolean;
  sources: SourceInfo[];
  items: ModelEntry[];
}

export interface HistoryPoint {
  id: string;
  benchmarkScore: number | null;
  livebenchAvg: number | null;
  priceInPer1M: number | null;
  priceOutPer1M: number | null;
}

export interface HistorySnapshot {
  date: string;
  items: HistoryPoint[];
}

export interface HistoryFile {
  version: 1;
  snapshots: HistorySnapshot[];
}
