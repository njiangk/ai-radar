import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const DATA_DIR = join(process.cwd(), 'public', 'data');

export function dataPath(name: string): string {
  return join(DATA_DIR, name);
}

export async function readJson<T>(path: string): Promise<T | null> {
  try {
    const text = await readFile(path, 'utf8');
    return JSON.parse(text) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function sha1(value: string): string {
  return createHash('sha1').update(value).digest('hex');
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayInShanghai(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const map = new Map(parts.map((p) => [p.type, p.value]));
  return `${map.get('year')}-${map.get('month')}-${map.get('day')}`;
}

export async function fetchText(
  url: string,
  timeoutMs = 30000,
  headers: Record<string, string> = {},
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'user-agent': 'ai-radar/0.1 (+https://github.com/ai-radar)',
          accept: 'application/json, application/xml, text/xml, text/plain, */*',
          ...headers,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      const message = (error as Error).message;
      if (message.startsWith('HTTP ')) {
        throw error;
      }
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
      }
    }
  }
  throw lastError;
}

export async function fetchJson(
  url: string,
  timeoutMs = 30000,
  headers: Record<string, string> = {},
): Promise<unknown> {
  const text = await fetchText(url, timeoutMs, headers);
  return JSON.parse(text) as unknown;
}

export function log(...args: unknown[]): void {
  console.log(`[ai-radar] ${new Date().toISOString()}`, ...args);
}
