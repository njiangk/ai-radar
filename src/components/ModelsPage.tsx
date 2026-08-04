import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Boxes,
  Building2,
  Flame,
  Search,
  Trophy,
} from 'lucide-react';
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { loadHistory, loadModels } from '../lib/data';
import {
  formatContext,
  formatHotness,
  formatPrice,
  formatScore,
  formatTokens,
} from '../lib/format';
import type { HistoryFile, ModelEntry, ModelsFile } from '../types';

type SortKey =
  | 'name'
  | 'provider'
  | 'contextLength'
  | 'priceInPer1M'
  | 'priceOutPer1M'
  | 'benchmarkScore'
  | 'livebenchAvg'
  | 'usageTokens';

type Metric = 'benchmark' | 'usage';

interface ScatterPoint {
  id: string;
  name: string;
  priceInPer1M: number;
  benchmarkScore: number | null;
  hotness: number | null;
}

const SORT_COLUMNS: Array<{ key: SortKey; label: string; align?: 'right' }> = [
  { key: 'name', label: '模型' },
  { key: 'provider', label: '厂商' },
  { key: 'contextLength', label: '上下文', align: 'right' },
  { key: 'priceInPer1M', label: '输入价格', align: 'right' },
  { key: 'priceOutPer1M', label: '输出价格', align: 'right' },
  { key: 'benchmarkScore', label: 'Benchmarks', align: 'right' },
  { key: 'usageTokens', label: 'OpenRouter 排名', align: 'right' },
];

function hotnessOf(usageTokens: number | null, maxUsage: number): number | null {
  if (usageTokens === null || maxUsage <= 0) {
    return null;
  }
  return Math.round((usageTokens / maxUsage) * 1000) / 10;
}

function ScatterTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ScatterPoint }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const point = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <strong>{point.name}</strong>
      <span>输入 {formatPrice(point.priceInPer1M)}</span>
      <span>Benchmarks {formatScore(point.benchmarkScore)}</span>
      <span>
        OpenRouter 排名 {point.hotness === null ? '-' : `${point.hotness}%`}
      </span>
    </div>
  );
}

function LineTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((entry, index) => (
        <span key={index}>
          {entry.name ?? '值'}: {formatScore(Number(entry.value))}
        </span>
      ))}
    </div>
  );
}

export function ModelsPage() {
  const [modelsFile, setModelsFile] = useState<ModelsFile | null>(null);
  const [history, setHistory] = useState<HistoryFile | null>(null);
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState('全部');
  const [showComparableOnly, setShowComparableOnly] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('benchmarkScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [metric, setMetric] = useState<Metric>('benchmark');
  const [visibleCount, setVisibleCount] = useState(100);
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    loadModels().then(setModelsFile);
    loadHistory().then(setHistory);
  }, []);

  const allModels = useMemo(() => modelsFile?.items ?? [], [modelsFile]);

  const modelOverview = useMemo(() => {
    const providers = new Map<string, number>();
    let withPrice = 0;
    let withScore = 0;
    let withUsage = 0;
    for (const model of allModels) {
      providers.set(model.provider, (providers.get(model.provider) ?? 0) + 1);
      if (model.priceInPer1M !== null || model.priceOutPer1M !== null) {
        withPrice += 1;
      }
      if (model.benchmarkScore !== null) {
        withScore += 1;
      }
      if (model.usageTokens !== null) {
        withUsage += 1;
      }
    }
    const topProviders = [...providers.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    const maxUsage = allModels.reduce(
      (max, model) => Math.max(max, model.usageTokens ?? 0),
      0,
    );
    const topUsage = allModels
      .filter((model) => model.usageTokens !== null)
      .sort((a, b) => (b.usageTokens ?? 0) - (a.usageTokens ?? 0))
      .slice(0, 10);
    const topScore = allModels
      .filter((model) => model.benchmarkScore !== null)
      .sort((a, b) => (b.benchmarkScore ?? 0) - (a.benchmarkScore ?? 0))
      .slice(0, 5);
    return {
      total: allModels.length,
      providerCount: providers.size,
      withPrice,
      withScore,
      withUsage,
      maxUsage,
      topProviders,
      topUsage,
      topScore,
    };
  }, [allModels]);

  const providers = useMemo(() => {
    const unique = new Set(allModels.map((model) => model.provider));
    return [...unique].sort((a, b) => a.localeCompare(b));
  }, [allModels]);

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = allModels.filter((model) => {
      if (
        showComparableOnly &&
        model.benchmarkScore === null &&
        model.livebenchAvg === null &&
        model.priceInPer1M === null &&
        model.priceOutPer1M === null
      ) {
        return false;
      }
      if (provider !== '全部' && model.provider !== provider) {
        return false;
      }
      if (
        q &&
        ![model.id, model.name, model.provider].some((value) =>
          value.toLowerCase().includes(q),
        )
      ) {
        return false;
      }
      return true;
    });
    return [...list].sort((a, b) => {
      const av = a[sortKey] as string | number | null;
      const bv = b[sortKey] as string | number | null;
      if (av === null && bv === null) {
        return 0;
      }
      if (av === null) {
        return 1;
      }
      if (bv === null) {
        return -1;
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const diff = (av as number) - (bv as number);
      return sortDir === 'asc' ? diff : -diff;
    });
  }, [allModels, provider, query, showComparableOnly, sortDir, sortKey]);

  const scatterData = useMemo<ScatterPoint[]>(
    () =>
      sorted
        .filter(
          (model) =>
            model.priceInPer1M !== null &&
            model.priceInPer1M > 0 &&
            (metric === 'benchmark'
              ? model.benchmarkScore !== null
              : model.usageTokens !== null),
        )
        .map((model) => ({
          id: model.id,
          name: model.name,
          priceInPer1M: model.priceInPer1M as number,
          benchmarkScore: model.benchmarkScore,
          hotness: hotnessOf(model.usageTokens, modelOverview.maxUsage),
        })),
    [metric, modelOverview.maxUsage, sorted],
  );

  const selectedModel = useMemo(() => {
    if (selectedId) {
      return allModels.find((model) => model.id === selectedId) ?? null;
    }
    return scatterData[0] ? allModels.find((model) => model.id === scatterData[0].id) ?? null : null;
  }, [allModels, scatterData, selectedId]);

  useEffect(() => {
    if (!selectedId && scatterData.length > 0) {
      setSelectedId(scatterData[0].id);
    }
  }, [scatterData, selectedId]);

  const trendData = useMemo(() => {
    if (!selectedId || !history) {
      return [];
    }
    return history.snapshots.map((snapshot) => {
      const point = snapshot.items.find((item) => item.id === selectedId);
      return {
        date: snapshot.date,
        benchmarkScore: point?.benchmarkScore ?? null,
        priceInPer1M: point?.priceInPer1M ?? null,
        priceOutPer1M: point?.priceOutPer1M ?? null,
      };
    });
  }, [history, selectedId]);

  const trendChartData = useMemo(
    () => trendData.filter((point) => point.benchmarkScore !== null),
    [trendData],
  );

  const visible = sorted.slice(0, visibleCount);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'name' || key === 'provider' ? 'asc' : 'desc');
  };

  return (
    <section className="page page-wide">
      <div className="page-head">
        <h1>模型对比</h1>
        <span className="page-meta">
          {allModels.length} 个模型 · 更新于 {modelsFile?.generatedAt.slice(0, 16).replace('T', ' ')}
        </span>
      </div>
      <p className="page-sub">
        性能分数来自{' '}
        <a href="https://openrouter.ai/rankings" target="_blank" rel="noreferrer">
          OpenRouter Benchmarks
        </a>
        ，排名来自 OpenRouter Rankings。
      </p>

      <section className="overview-section">
        <div className="overview-grid">
          <div className="stat-cell">
            <Boxes size={18} aria-hidden="true" />
            <div>
              <span className="stat-value">{modelOverview.total}</span>
              <span className="stat-label">模型总数</span>
            </div>
          </div>
          <div className="stat-cell">
            <Building2 size={18} aria-hidden="true" />
            <div>
              <span className="stat-value">{modelOverview.providerCount}</span>
              <span className="stat-label">厂商数</span>
            </div>
          </div>
          <div className="stat-cell">
            <Flame size={18} aria-hidden="true" />
            <div>
              <span className="stat-value">{modelOverview.withPrice}</span>
              <span className="stat-label">有价格</span>
            </div>
          </div>
          <div className="stat-cell">
            <Trophy size={18} aria-hidden="true" />
            <div>
              <span className="stat-value">{modelOverview.withScore}</span>
              <span className="stat-label">有 Benchmarks</span>
            </div>
          </div>
        </div>

        <div className="overview-columns">
          <section className="tool-panel overview-card">
            <div className="panel-head">
              <h2>OpenRouter 排名</h2>
            </div>
            <ul className="leaderboard-list">
              {modelOverview.topUsage.map((model, index) => (
                <li key={model.id} className="leaderboard-item">
                  <span className="rank-badge">{index + 1}</span>
                  <div className="leaderboard-name">
                    <strong>{model.name}</strong>
                    <span>{model.provider}</span>
                  </div>
                  <b className="leaderboard-tokens">
                    {formatTokens(model.usageTokens)}
                  </b>
                </li>
              ))}
            </ul>
          </section>

          <section className="tool-panel overview-card">
            <div className="panel-head">
              <h2>OpenRouter Benchmarks Top 5</h2>
            </div>
            <ul className="mini-list">
              {modelOverview.topScore.map((model) => (
                <li key={model.id}>
                  <div className="mini-row">
                    <span>{model.name}</span>
                    <b>{formatScore(model.benchmarkScore)}</b>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="tool-panel overview-card">
            <div className="panel-head">
              <h2>厂商分布</h2>
            </div>
            <ul className="mini-list">
              {modelOverview.topProviders.map(([name, count]) => (
                <li key={name}>
                  <div className="mini-row">
                    <span>{name}</span>
                    <b>{count}</b>
                  </div>
                  <div className="bar">
                    <i
                      style={{
                        width: `${Math.round((count / modelOverview.total) * 100)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>

      <div className="toolbar">
        <label className="search-box">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索模型"
            aria-label="搜索模型"
          />
        </label>
        <select
          value={provider}
          onChange={(event) => setProvider(event.target.value)}
          aria-label="按厂商筛选"
        >
          <option value="全部">全部厂商</option>
          {providers.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <label className="check-control">
          <input
            type="checkbox"
            checked={showComparableOnly}
            onChange={(event) => setShowComparableOnly(event.target.checked)}
          />
          只看有价格或榜单
        </label>
        <div className="segmented" role="group" aria-label="性能指标">
          <button
            className={metric === 'benchmark' ? 'segment is-active' : 'segment'}
            onClick={() => setMetric('benchmark')}
            aria-pressed={metric === 'benchmark'}
          >
            Benchmarks
          </button>
          <button
            className={metric === 'usage' ? 'segment is-active' : 'segment'}
            onClick={() => setMetric('usage')}
            aria-pressed={metric === 'usage'}
          >
            OpenRouter 排名
          </button>
        </div>
      </div>

      {selectedModel ? (
        <div className="model-summary">
          <div className="summary-cell">
            <span className="label">模型</span>
            <strong>{selectedModel.name}</strong>
          </div>
          <div className="summary-cell">
            <span className="label">厂商</span>
            <span>{selectedModel.provider}</span>
          </div>
          <div className="summary-cell">
            <span className="label">上下文</span>
            <span>{formatContext(selectedModel.contextLength)}</span>
          </div>
          <div className="summary-cell">
            <span className="label">输入价格</span>
            <span>{formatPrice(selectedModel.priceInPer1M)}</span>
          </div>
          <div className="summary-cell">
            <span className="label">输出价格</span>
            <span>{formatPrice(selectedModel.priceOutPer1M)}</span>
          </div>
          <div className="summary-cell">
            <span className="label">Benchmarks</span>
            <span>{formatScore(selectedModel.benchmarkScore)}</span>
          </div>
          <div className="summary-cell">
            <span className="label">OpenRouter 排名</span>
            <span title={`使用量 ${formatTokens(selectedModel.usageTokens)}`}>
              {formatHotness(selectedModel.usageTokens, modelOverview.maxUsage)}
            </span>
          </div>
        </div>
      ) : null}

      <div className="chart-grid">
        <section className="tool-panel">
          <div className="panel-head">
            <h2>性能与价格</h2>
            <span className="panel-note">
              {scatterData.length} 个模型 ·{' '}
              {metric === 'usage' ? 'OpenRouter 排名' : 'Benchmarks'}
            </span>
          </div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={340}>
              <ScatterChart margin={{ top: 16, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="priceInPer1M"
                  type="number"
                  domain={[0, 'auto']}
                  name="输入价格"
                  tickFormatter={(value: number) => formatPrice(value)}
                  tickCount={6}
                  minTickGap={24}
                  tickMargin={8}
                  stroke="var(--muted)"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  dataKey={metric === 'benchmark' ? 'benchmarkScore' : 'hotness'}
                  domain={[0, 100]}
                  name={metric === 'benchmark' ? 'Benchmarks' : 'OpenRouter 排名'}
                  stroke="var(--muted)"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter
                  data={scatterData}
                  activeShape={
                    <circle r={6} fill="var(--accent-2)" stroke="var(--surface-3)" strokeWidth={2} />
                  }
                  onClick={(data) => {
                    const point = data as unknown as { id?: string };
                    if (point?.id) {
                      setSelectedId(point.id);
                    }
                  }}
                >
                  {scatterData.map((point) => (
                    <Cell
                      key={point.id}
                      fill={point.id === selectedId ? 'var(--accent-2)' : 'var(--accent)'}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="tool-panel">
          <div className="panel-head">
            <h2>历史趋势</h2>
            <span className="panel-note">
              {selectedModel?.name ?? '未选择'} · {trendData.length} 个快照
            </span>
          </div>
          {trendChartData.length > 1 ? (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={340}>
                <LineChart
                  data={trendChartData}
                  margin={{ top: 16, right: 16, bottom: 8, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="var(--muted)" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} stroke="var(--muted)" tick={{ fontSize: 12 }} />
                  <Tooltip content={<LineTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                  <Line
                    type="monotone"
                    dataKey="benchmarkScore"
                    name="Benchmarks"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, fill: 'var(--accent)', stroke: 'var(--surface-3)', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : null}
          {trendData.length > 0 ? (
            <div className="history-list">
              <div className="history-row history-head">
                <span>日期</span>
                <span>Benchmarks</span>
                <span>输入价格</span>
                <span>输出价格</span>
              </div>
              {[...trendData]
                .reverse()
                .slice(0, 8)
                .map((point) => (
                  <div key={point.date} className="history-row">
                    <span>{point.date}</span>
                    <span>{formatScore(point.benchmarkScore)}</span>
                    <span>{formatPrice(point.priceInPer1M)}</span>
                    <span>{formatPrice(point.priceOutPer1M)}</span>
                  </div>
                ))}
            </div>
          ) : (
            <div className="chart-empty">暂无历史数据</div>
          )}
        </section>
      </div>

      <section className="tool-panel">
        <div className="panel-head">
          <h2>模型列表</h2>
          <span className="panel-note">
            显示 {visible.length} / {sorted.length} · 排名基于 OpenRouter 使用量
          </span>
        </div>
        <div className="table-scroll">
          <table className="model-table">
            <thead>
              <tr>
                {SORT_COLUMNS.map((column) => {
                  const active = column.key === sortKey;
                  return (
                    <th
                      key={column.key}
                      className={column.align === 'right' ? 'align-right' : ''}
                    >
                      <button
                        className="sort-button"
                        onClick={() => handleSort(column.key)}
                        title={`按${column.label}排序`}
                      >
                        {column.label}
                        {active ? (
                          sortDir === 'asc' ? (
                            <ArrowUp size={13} aria-hidden="true" />
                          ) : (
                            <ArrowDown size={13} aria-hidden="true" />
                          )
                        ) : (
                          <ArrowUpDown size={13} aria-hidden="true" />
                        )}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((model) => (
                <tr
                  key={model.id}
                  className={model.id === selectedId ? 'is-selected' : ''}
                  onClick={() => setSelectedId(model.id)}
                >
                  <td>
                    <div className="model-name">{model.name}</div>
                    <div className="model-id">{model.id}</div>
                  </td>
                  <td>{model.provider}</td>
                  <td className="align-right">{formatContext(model.contextLength)}</td>
                  <td className="align-right">{formatPrice(model.priceInPer1M)}</td>
                  <td className="align-right">{formatPrice(model.priceOutPer1M)}</td>
                  <td className="align-right">{formatScore(model.benchmarkScore)}</td>
                  <td
                    className="align-right"
                    title={`使用量 ${formatTokens(model.usageTokens)}`}
                  >
                    {formatHotness(model.usageTokens, modelOverview.maxUsage)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sorted.length > visibleCount ? (
          <button
            className="more-button"
            onClick={() => setVisibleCount((current) => current + 100)}
          >
            显示更多
          </button>
        ) : null}
      </section>
    </section>
  );
}
