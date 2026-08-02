import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchJson, fetchText, log, nowIso } from './io.js';
import type { ModelEntry, SourceInfo } from './types.js';

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const OPENROUTER_RANKINGS_URL = 'https://openrouter.ai/api/frontend/v1/rankings/models';
const MODELS_DEV_URL = 'https://models.dev/api.json';
const LITELLM_PRICES_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
const LIVEBENCH_LISTING_URL =
  'https://api.github.com/repos/livebench/livebench.github.io/contents/public';
const LIVEBENCH_RAW_BASE =
  'https://raw.githubusercontent.com/livebench/livebench.github.io/main/public/';
const OPENROUTER_BENCHMARKS_URL =
  'https://openrouter.ai/api/frontend/v1/rankings/benchmarks';

export interface RawModel {
  id: string;
  name: string;
  provider: string;
  contextLength: number | null;
  priceInPer1M: number | null;
  priceOutPer1M: number | null;
  usageTokens: number | null;
}

export interface CompareFetchResult {
  entries: ModelEntry[];
  livebench: Map<string, number>;
  benchmarks: Map<string, number>;
  sources: SourceInfo[];
  fresh: boolean;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function perTokenToPer1M(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }
  return round4(number * 1_000_000);
}

function cleanId(id: string): string {
  return id.replace(/^~/, '');
}

function cleanName(name: unknown, fallback: string): string {
  return typeof name === 'string' && name.trim() ? name : fallback;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function buildUsageMap(rankingsPayload: unknown): Map<string, number> {
  const rows = (rankingsPayload as { data?: unknown[] }).data ?? [];
  const usage = new Map<string, number>();
  for (const raw of rows) {
    const row = raw as Record<string, unknown>;
    const slug = typeof row.model_permaslug === 'string' ? row.model_permaslug : '';
    if (!slug) {
      continue;
    }
    const completion = Number(row.total_completion_tokens) || 0;
    const prompt = Number(row.total_prompt_tokens) || 0;
    usage.set(slug, (usage.get(slug) ?? 0) + completion + prompt);
  }
  return usage;
}

export function parseOpenRouter(
  modelsPayload: unknown,
  rankingsPayload: unknown,
): RawModel[] {
  const models = (modelsPayload as { data?: unknown[] }).data ?? [];
  const usage = buildUsageMap(rankingsPayload);
  const output: RawModel[] = [];
  for (const raw of models) {
    const model = raw as Record<string, unknown>;
    const rawId = typeof model.id === 'string' ? model.id : '';
    if (!rawId) {
      continue;
    }
    const architecture = model.architecture as Record<string, unknown> | undefined;
    const outputModalities = architecture?.output_modalities;
    if (
      Array.isArray(outputModalities) &&
      outputModalities.length > 0 &&
      !outputModalities.includes('text')
    ) {
      continue;
    }
    const id = cleanId(rawId);
    const pricing = (model.pricing ?? {}) as Record<string, unknown>;
    const canonical = typeof model.canonical_slug === 'string' ? model.canonical_slug : null;
    const matched = [...usage.entries()]
      .filter(([slug]) => slug === id || slug === canonical || slug.startsWith(`${id}-`))
      .reduce((sum, [, tokens]) => sum + tokens, 0);
    output.push({
      id,
      name: cleanName(model.name, id),
      provider: id.split('/')[0] || 'unknown',
      contextLength: numberOrNull(model.context_length),
      priceInPer1M: perTokenToPer1M(pricing.prompt),
      priceOutPer1M: perTokenToPer1M(pricing.completion),
      usageTokens: matched > 0 ? matched : null,
    });
  }
  return output;
}

export function parseModelsDev(payload: unknown): RawModel[] {
  const providers = (payload ?? {}) as Record<string, Record<string, unknown>>;
  const output: RawModel[] = [];
  for (const [providerId, provider] of Object.entries(providers)) {
    const models = (provider?.models ?? {}) as Record<string, Record<string, unknown>>;
    for (const [modelId, model] of Object.entries(models)) {
      const modalities = model.modalities as
        | { input?: unknown[]; output?: unknown[] }
        | undefined;
      if (
        modalities?.input?.length &&
        modalities.output?.length &&
        !modalities.input.includes('text')
      ) {
        continue;
      }
      const cost = (model.cost ?? {}) as Record<string, unknown>;
      const limit = (model.limit ?? {}) as Record<string, unknown>;
      const id = `${providerId}/${modelId}`;
      output.push({
        id,
        name: cleanName(model.name, id),
        provider: providerId,
        contextLength: numberOrNull(limit.context),
        priceInPer1M: typeof cost.input === 'number' ? round4(cost.input) : null,
        priceOutPer1M: typeof cost.output === 'number' ? round4(cost.output) : null,
        usageTokens: null,
      });
    }
  }
  return output;
}

export function parseLiteLLM(payload: unknown): RawModel[] {
  const entries = (payload ?? {}) as Record<string, Record<string, unknown>>;
  const output: RawModel[] = [];
  const supportedModes = new Set(['chat', 'completion', 'responses']);
  for (const [modelName, meta] of Object.entries(entries)) {
    if (modelName.startsWith('$')) {
      continue;
    }
    const mode = typeof meta.mode === 'string' ? meta.mode : '';
    if (!supportedModes.has(mode)) {
      continue;
    }
    const provider = typeof meta.litellm_provider === 'string' ? meta.litellm_provider : 'unknown';
    const id = modelName.includes('/') ? modelName : `${provider}/${modelName}`;
    output.push({
      id: cleanId(id),
      name: modelName,
      provider,
      contextLength: numberOrNull(meta.context_window),
      priceInPer1M: perTokenToPer1M(meta.input_cost_per_token),
      priceOutPer1M: perTokenToPer1M(meta.output_cost_per_token),
      usageTokens: null,
    });
  }
  return output;
}

export function parseOpenRouterBenchmarks(payload: unknown): Map<string, number> {
  const data = (payload as { data?: unknown }).data;
  const aaData = (data as { aaData?: unknown } | undefined)?.aaData;
  const rows = (aaData as { intelligence?: unknown[] } | undefined)?.intelligence ?? [];
  const map = new Map<string, number>();
  for (const raw of rows) {
    const row = raw as Record<string, unknown>;
    const score = typeof row.score === 'number' ? row.score : null;
    if (score === null) {
      continue;
    }
    const candidates = [row.uid, row.permaslug, row.openrouter_slug, row.heuristic_openrouter_slug]
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
    for (const key of candidates) {
      map.set(normalizeKey(key), score);
      const stripped = key.replace(/-\d{6,8}$/, '');
      if (stripped !== key) {
        map.set(normalizeKey(stripped), score);
      }
    }
  }
  return map;
}

export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

export function parseLiveBenchCsv(text: string): Array<{ model: string; average: number | null }> {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    return [];
  }
  const header = splitCsvLine(lines[0]);
  const modelColumn = header.findIndex((cell) => cell.trim().toLowerCase() === 'model');
  if (modelColumn === -1) {
    return [];
  }
  return lines
    .slice(1)
    .map((line) => {
      const cells = splitCsvLine(line);
      const scores = cells
        .map(Number)
        .filter((value) => Number.isFinite(value));
      const average = scores.length
        ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 100) / 100
        : null;
      return { model: cells[modelColumn]?.trim() ?? '', average };
    })
    .filter((row) => row.model);
}

export async function fetchOpenRouter(): Promise<{ entries: RawModel[]; fetchedAt: string }> {
  const [modelsPayload, rankingsPayload] = await Promise.all([
    fetchJson(OPENROUTER_MODELS_URL, 30000),
    fetchJson(OPENROUTER_RANKINGS_URL, 30000),
  ]);
  return { entries: parseOpenRouter(modelsPayload, rankingsPayload), fetchedAt: nowIso() };
}

export async function fetchModelsDev(): Promise<{ entries: RawModel[]; fetchedAt: string }> {
  const payload = await fetchJson(MODELS_DEV_URL, 60000);
  return { entries: parseModelsDev(payload), fetchedAt: nowIso() };
}

export async function fetchLiteLLM(): Promise<{ entries: RawModel[]; fetchedAt: string }> {
  const payload = await fetchJson(LITELLM_PRICES_URL, 30000);
  return { entries: parseLiteLLM(payload), fetchedAt: nowIso() };
}

export async function fetchLiveBench(): Promise<{
  livebench: Map<string, number>;
  dataDate: string | null;
  fetchedAt: string;
}> {
  const token = process.env.GITHUB_TOKEN?.trim();
  const authHeaders: Record<string, string> = token
    ? { authorization: `Bearer ${token}` }
    : {};
  const listing = (await fetchJson(LIVEBENCH_LISTING_URL, 30000, authHeaders)) as Array<{
    name: string;
  }>;
  const tables = listing
    .map((entry) => entry.name)
    .filter((name) => name.startsWith('table_') && name.endsWith('.csv'))
    .sort();
  if (!tables.length) {
    return { livebench: new Map(), dataDate: null, fetchedAt: nowIso() };
  }
  const table = tables[tables.length - 1];
  const text = await fetchText(LIVEBENCH_RAW_BASE + table, 30000);
  const rows = parseLiveBenchCsv(text);
  const livebench = new Map<string, number>();
  for (const row of rows) {
    if (row.average !== null) {
      livebench.set(row.model.toLowerCase(), row.average);
    }
  }
  const dataDate = table
    .replace('table_', '')
    .replace(/\.csv$/, '')
    .replace(/_/g, '-');
  log(`LiveBench 数据日期 ${dataDate}, ${rows.length} 个模型`);
  return { livebench, dataDate, fetchedAt: nowIso() };
}

export async function fetchOpenRouterBenchmarks(): Promise<{
  benchmarks: Map<string, number>;
  fetchedAt: string;
}> {
  const payload = await fetchJson(OPENROUTER_BENCHMARKS_URL, 30000);
  const benchmarks = parseOpenRouterBenchmarks(payload);
  log(`OpenRouter Benchmarks 数据: ${benchmarks.size} 个匹配键`);
  return { benchmarks, fetchedAt: nowIso() };
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, '');
}

async function loadAliases(): Promise<Record<string, string[]>> {
  const text = await readFile(
    join(process.cwd(), 'config', 'model-aliases.json'),
    'utf8',
  );
  return JSON.parse(text) as Record<string, string[]>;
}

export function mergeModels(
  openrouter: RawModel[],
  modelsDev: RawModel[],
  litellm: RawModel[],
  livebench: Map<string, number>,
  benchmarks: Map<string, number>,
  aliases: Record<string, string[]>,
): ModelEntry[] {
  const map = new Map<string, ModelEntry>();
  const upsert = (raw: RawModel) => {
    const existing = map.get(raw.id);
    if (!existing) {
      map.set(raw.id, {
        id: raw.id,
        name: raw.name,
        provider: raw.provider,
        contextLength: raw.contextLength,
        priceInPer1M: raw.priceInPer1M,
        priceOutPer1M: raw.priceOutPer1M,
        benchmarkScore: null,
        livebenchAvg: null,
        usageTokens: raw.usageTokens,
        updatedAt: nowIso(),
      });
      return;
    }
    map.set(raw.id, {
      ...existing,
      name: existing.name || raw.name,
      provider: existing.provider || raw.provider,
      contextLength: existing.contextLength ?? raw.contextLength,
      priceInPer1M: existing.priceInPer1M ?? raw.priceInPer1M,
      priceOutPer1M: existing.priceOutPer1M ?? raw.priceOutPer1M,
      usageTokens: existing.usageTokens ?? raw.usageTokens,
      updatedAt: nowIso(),
    });
  };

  openrouter.forEach(upsert);
  modelsDev.forEach(upsert);
  litellm.forEach(upsert);

  const livebenchKeys = new Map(
    [...livebench.entries()].map(([key, value]) => [normalizeKey(key), value]),
  );
  const benchmarkKeys = new Map(
    [...benchmarks.entries()].map(([key, value]) => [normalizeKey(key), value]),
  );
  const entries = [...map.values()];
  for (const entry of entries) {
    const candidates = [
      entry.id,
      entry.name,
      entry.id.split('/').pop() ?? '',
      ...(aliases[entry.id] ?? []),
    ];
    for (const candidate of candidates) {
      const normalized = normalizeKey(candidate);
      const score = livebenchKeys.get(normalized);
      if (score !== undefined) {
        entry.livebenchAvg = score;
        break;
      }
    }
    for (const candidate of candidates) {
      const normalized = normalizeKey(candidate);
      const score = benchmarkKeys.get(normalized);
      if (score !== undefined) {
        entry.benchmarkScore = score;
        break;
      }
    }
  }
  entries.sort((a, b) => {
    const aScore = a.livebenchAvg ?? -Infinity;
    const bScore = b.livebenchAvg ?? -Infinity;
    if (bScore !== aScore) {
      return bScore - aScore;
    }
    const aUsage = a.usageTokens ?? -1;
    const bUsage = b.usageTokens ?? -1;
    return bUsage - aUsage;
  });
  return entries;
}

export async function fetchCompareData(): Promise<CompareFetchResult> {
  const [openrouter, modelsDev, litellm, livebenchResult, benchmarksResult] =
    await Promise.allSettled([
      fetchOpenRouter(),
      fetchModelsDev(),
      fetchLiteLLM(),
      fetchLiveBench(),
      fetchOpenRouterBenchmarks(),
    ]);
  const sources: SourceInfo[] = [];
  let openrouterEntries: RawModel[] = [];
  let modelsDevEntries: RawModel[] = [];
  let litellmEntries: RawModel[] = [];
  let livebench = new Map<string, number>();
  let benchmarks = new Map<string, number>();

  const record = (
    id: string,
    result: PromiseSettledResult<unknown>,
    assign: (value: unknown) => void,
  ) => {
    if (result.status === 'fulfilled') {
      sources.push({ id, status: 'ok', fetchedAt: nowIso() });
      assign(result.value);
      return;
    }
    sources.push({ id, status: 'error', fetchedAt: null });
    log(`模型数据源失败 ${id}: ${(result.reason as Error).message}`);
  };

  record('openrouter', openrouter, (value) => {
    openrouterEntries = (value as { entries: RawModel[] }).entries;
  });
  record('models.dev', modelsDev, (value) => {
    modelsDevEntries = (value as { entries: RawModel[] }).entries;
  });
  record('litellm', litellm, (value) => {
    litellmEntries = (value as { entries: RawModel[] }).entries;
  });
  record('livebench', livebenchResult, (value) => {
    livebench = (value as { livebench: Map<string, number> }).livebench;
  });
  record('openrouter-benchmarks', benchmarksResult, (value) => {
    benchmarks = (value as { benchmarks: Map<string, number> }).benchmarks;
  });

  const aliases = await loadAliases();
  const entries = mergeModels(
    openrouterEntries,
    modelsDevEntries,
    litellmEntries,
    livebench,
    benchmarks,
    aliases,
  );
  const fresh = sources.some((source) => source.status === 'ok') && entries.length > 0;
  log(`模型数据抓取完成: ${entries.length} 个模型，成功源 ${sources.filter((s) => s.status === 'ok').length}/${sources.length}`);
  return { entries, livebench, benchmarks, sources, fresh };
}
