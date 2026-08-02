import { describe, expect, it } from 'vitest';
import {
  mergeModels,
  parseLiveBenchCsv,
  parseLiteLLM,
  parseModelsDev,
  parseOpenRouter,
  parseOpenRouterBenchmarks,
} from './compare.js';

describe('compare pipeline', () => {
  it('parses OpenRouter models and rankings', () => {
    const models = {
      data: [
        {
          id: 'openai/gpt-5',
          name: 'GPT-5',
          context_length: 400000,
          pricing: { prompt: '0.000001', completion: '0.000004' },
          architecture: { modality: 'text->text' },
          canonical_slug: 'openai/gpt-5',
        },
        {
          id: 'google/gemini-image',
          name: 'Gemini Image',
          pricing: { prompt: '0.000001', completion: '0.000004' },
          architecture: { modality: 'text+image->image', output_modalities: ['image'] },
        },
      ],
    };
    const rankings = {
      data: [
        {
          model_permaslug: 'openai/gpt-5-2026-07-01',
          total_prompt_tokens: 1000,
          total_completion_tokens: 500,
        },
      ],
    };
    const entries = parseOpenRouter(models, rankings);
    expect(entries).toHaveLength(1);
    expect(entries[0].priceInPer1M).toBe(1);
    expect(entries[0].priceOutPer1M).toBe(4);
    expect(entries[0].usageTokens).toBe(1500);
  });

  it('parses models.dev API data', () => {
    const payload = {
      openai: {
        models: {
          'gpt-4o': {
            name: 'GPT-4o',
            cost: { input: 2.5, output: 10 },
            limit: { context: 128000 },
            modalities: { input: ['text'], output: ['text'] },
          },
        },
      },
    };
    const entries = parseModelsDev(payload);
    expect(entries[0].id).toBe('openai/gpt-4o');
    expect(entries[0].priceInPer1M).toBe(2.5);
    expect(entries[0].contextLength).toBe(128000);
  });

  it('parses LiteLLM price map', () => {
    const payload = {
      'openai/gpt-4o': {
        litellm_provider: 'openai',
        mode: 'chat',
        input_cost_per_token: 0.0000025,
        output_cost_per_token: 0.00001,
        context_window: 128000,
      },
      'some-image-model': {
        litellm_provider: 'openai',
        mode: 'image_generation',
        input_cost_per_token: 0,
        output_cost_per_token: 0,
      },
    };
    const entries = parseLiteLLM(payload);
    expect(entries).toHaveLength(1);
    expect(entries[0].priceInPer1M).toBe(2.5);
  });

  it('parses LiveBench CSV', () => {
    const csv = `model,Math,Code\nGPT-5,95,90\nClaude,80,"85"\n`;
    const rows = parseLiveBenchCsv(csv);
    expect(rows[0].model).toBe('GPT-5');
    expect(rows[0].average).toBe(92.5);
    expect(rows[1].average).toBe(82.5);
  });

  it('joins LiveBench scores through aliases and sorts', () => {
    const openrouter = [
      {
        id: 'openai/gpt-5',
        name: 'GPT-5',
        provider: 'openai',
        contextLength: 400000,
        priceInPer1M: 1,
        priceOutPer1M: 4,
        usageTokens: 100,
      },
      {
        id: 'anthropic/claude-sonnet-4.5',
        name: 'Claude Sonnet 4.5',
        provider: 'anthropic',
        contextLength: 200000,
        priceInPer1M: 3,
        priceOutPer1M: 15,
        usageTokens: 90,
      },
    ];
    const livebench = new Map([
      ['gpt-5', 98],
      ['claude-sonnet-4.5', 92],
    ]);
    const aliases = {
      'openai/gpt-5': ['gpt-5'],
      'anthropic/claude-sonnet-4.5': ['claude-sonnet-4.5'],
    };
    const entries = mergeModels(openrouter, [], [], livebench, new Map(), aliases);
    expect(entries[0].id).toBe('openai/gpt-5');
    expect(entries[0].livebenchAvg).toBe(98);
    expect(entries[1].livebenchAvg).toBe(92);
  });

  it('joins OpenRouter benchmark scores', () => {
    const payload = {
      data: {
        aaData: {
          intelligence: [
            {
              uid: 'openai/gpt-5.6-sol-20260709',
              permaslug: 'openai/gpt-5.6-sol-20260709',
              heuristic_openrouter_slug: 'openai/gpt-5.6-sol',
              score: 58.9,
            },
          ],
        },
      },
    };
    const benchmarks = parseOpenRouterBenchmarks(payload);
    expect([...benchmarks.values()]).toContain(58.9);

    const openrouter = [
      {
        id: 'openai/gpt-5.6-sol',
        name: 'GPT-5.6 Sol',
        provider: 'openai',
        contextLength: 1000000,
        priceInPer1M: 2,
        priceOutPer1M: 8,
        usageTokens: null,
      },
    ];
    const entries = mergeModels(openrouter, [], [], new Map(), benchmarks, {});
    expect(entries[0].benchmarkScore).toBe(58.9);
  });
});
