import { useEffect, useMemo, useState } from 'react';
import {
  BookCheck,
  BookOpen,
  Clock3,
  ExternalLink,
  Newspaper,
  Radio,
  Search,
  Star,
  Tags,
} from 'lucide-react';
import { formatTime, formatUpdated } from '../lib/format';
import { loadHot, loadNews } from '../lib/data';
import { useLocalSet } from '../lib/useLocalSet';
import { HotBoard } from './HotBoard';
import type { HotFile, HotTopic, NewsCategory, NewsFile, NewsItem } from '../types';

type LanguageMode = 'zh' | 'dual' | 'en';

const CATEGORIES: NewsCategory[] = [
  '模型发布',
  '产品',
  '研究',
  '融资',
  '政策',
  '工具',
  '其他',
];

function dayKey(iso: string): string {
  if (!iso) {
    return 'unknown';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'unknown';
  }
  return date.toLocaleDateString('en-CA');
}

function displayText(item: NewsItem, language: LanguageMode) {
  if (language === 'zh') {
    return {
      title: item.zhTitle || item.title,
      summary: item.zhSummary || item.summary,
    };
  }
  if (language === 'en') {
    return { title: item.title, summary: item.summary };
  }
  return {
    title: item.zhTitle ? `${item.zhTitle} · ${item.title}` : item.title,
    summary: item.zhSummary ? `${item.zhSummary} ${item.summary}` : item.summary,
  };
}

export function NewsPage() {
  const [news, setNews] = useState<NewsFile | null>(null);
  const [hot, setHot] = useState<HotFile | null>(null);
  const [activeHot, setActiveHot] = useState<HotTopic | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('全部');
  const [source, setSource] = useState<string>('全部');
  const [language, setLanguage] = useState<LanguageMode>('zh');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, toggleFavorite] = useLocalSet('ai-radar:favorites');
  const [read, toggleRead] = useLocalSet('ai-radar:read');

  useEffect(() => {
    loadNews().then(setNews);
    loadHot().then(setHot);
  }, []);

  const sources = useMemo(() => {
    const unique = new Map<string, string>();
    for (const item of news?.items ?? []) {
      unique.set(item.sourceId, item.sourceName);
    }
    return [...unique.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [news]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (news?.items ?? []).filter((item) => {
      if (activeHot && !activeHot.newsIds.includes(item.id)) {
        return false;
      }
      if (favoritesOnly && !favorites.has(item.id)) {
        return false;
      }
      if (category !== '全部' && item.category !== category) {
        return false;
      }
      if (source !== '全部' && item.sourceId !== source) {
        return false;
      }
      if (q) {
        const haystack = [
          item.title,
          item.zhTitle,
          item.summary,
          item.zhSummary,
          item.sourceName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [activeHot, category, favorites, favoritesOnly, news, query, source]);

  const grouped = useMemo(() => {
    const map = new Map<string, NewsItem[]>();
    for (const item of filtered) {
      const key = dayKey(item.publishedAt);
      const bucket = map.get(key) ?? [];
      bucket.push(item);
      map.set(key, bucket);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const overview = useMemo(() => {
    const items = news?.items ?? [];
    const now = Date.now();
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const todayCount = items.filter((item) => dayKey(item.publishedAt) === today).length;
    const last24h = items.filter(
      (item) =>
        item.publishedAt &&
        now - new Date(item.publishedAt).getTime() <= 24 * 60 * 60 * 1000,
    ).length;
    const categoryCounts = new Map<string, number>();
    for (const item of items) {
      categoryCounts.set(
        item.category,
        (categoryCounts.get(item.category) ?? 0) + 1,
      );
    }
    const topCategories = [...categoryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    return {
      total: items.length,
      todayCount,
      last24h,
      sourceCount: sources.length,
      topCategories,
    };
  }, [news, sources]);

  return (
    <section className="page">
      <div className="page-head">
        <h1>AI 新闻</h1>
        <span className="page-meta">
          {news?.items.length ?? 0} 条 · 更新于 {formatUpdated(news?.generatedAt ?? null)}
        </span>
      </div>

      <section className="overview-panel">
        <div className="overview-grid">
          <div className="stat-cell">
            <Newspaper size={18} aria-hidden="true" />
            <div>
              <span className="stat-value">{overview.total}</span>
              <span className="stat-label">已收录</span>
            </div>
          </div>
          <div className="stat-cell">
            <Clock3 size={18} aria-hidden="true" />
            <div>
              <span className="stat-value">{overview.todayCount}</span>
              <span className="stat-label">今日</span>
            </div>
          </div>
          <div className="stat-cell">
            <Radio size={18} aria-hidden="true" />
            <div>
              <span className="stat-value">{overview.last24h}</span>
              <span className="stat-label">24 小时</span>
            </div>
          </div>
          <div className="stat-cell">
            <Tags size={18} aria-hidden="true" />
            <div>
              <span className="stat-value">{overview.sourceCount}</span>
              <span className="stat-label">来源</span>
            </div>
          </div>
        </div>
        <div className="category-chips">
          {overview.topCategories.map(([name, count]) => (
            <span key={name} className="chip">
              {name}
              <b>{count}</b>
            </span>
          ))}
        </div>
      </section>

      <HotBoard hot={hot} active={activeHot} onSelect={setActiveHot} />

      <div className="toolbar">
        <label className="search-box">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索新闻"
            aria-label="搜索新闻"
          />
        </label>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="按分类筛选"
        >
          <option value="全部">全部分类</option>
          {CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          value={source}
          onChange={(event) => setSource(event.target.value)}
          aria-label="按来源筛选"
        >
          <option value="全部">全部来源</option>
          {sources.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <button
          className={favoritesOnly ? 'tool-button is-active' : 'tool-button'}
          onClick={() => setFavoritesOnly((value) => !value)}
          title="只看收藏"
          aria-pressed={favoritesOnly}
        >
          <Star size={16} fill={favoritesOnly ? 'currentColor' : 'none'} aria-hidden="true" />
          收藏
        </button>
        <div className="segmented" role="group" aria-label="语言模式">
          {(
            [
              ['zh', '中文'],
              ['dual', '双语'],
              ['en', '原文'],
            ] as Array<[LanguageMode, string]>
          ).map(([mode, label]) => (
            <button
              key={mode}
              className={language === mode ? 'segment is-active' : 'segment'}
              onClick={() => setLanguage(mode)}
              aria-pressed={language === mode}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="empty-state">
          <Search size={28} aria-hidden="true" />
          <span>没有符合条件的新闻</span>
        </div>
      ) : (
        grouped.map(([day, items]) => (
          <section key={day} className="news-day">
            <h2 className="day-title">
              {day === 'unknown' ? '日期未知' : day}
              <span className="day-count">{items.length}</span>
            </h2>
            <div className="news-list">
              {items.map((item) => {
                const text = displayText(item, language);
                const isFavorite = favorites.has(item.id);
                const isRead = read.has(item.id);
                return (
                  <article
                    key={item.id}
                    className={isRead ? 'news-card is-read' : 'news-card'}
                  >
                    <div className="news-card-top">
                      <span className={`badge badge-${item.category}`}>{item.category}</span>
                      <span className="news-source">{item.sourceName}</span>
                      <time className="news-time" dateTime={item.publishedAt}>
                        {formatTime(item.publishedAt)}
                      </time>
                    </div>
                    <a
                      className="news-title"
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {text.title}
                    </a>
                    {text.summary ? <p className="news-summary">{text.summary}</p> : null}
                    <div className="news-actions">
                      <button
                        className={isFavorite ? 'icon-btn is-active' : 'icon-btn'}
                        onClick={() => toggleFavorite(item.id)}
                        title={isFavorite ? '取消收藏' : '收藏'}
                        aria-label={isFavorite ? '取消收藏' : '收藏'}
                      >
                        <Star
                          size={16}
                          fill={isFavorite ? 'currentColor' : 'none'}
                          aria-hidden="true"
                        />
                      </button>
                      <button
                        className={isRead ? 'icon-btn is-active' : 'icon-btn'}
                        onClick={() => toggleRead(item.id)}
                        title={isRead ? '标记未读' : '标记已读'}
                        aria-label={isRead ? '标记未读' : '标记已读'}
                      >
                        {isRead ? (
                          <BookCheck size={16} aria-hidden="true" />
                        ) : (
                          <BookOpen size={16} aria-hidden="true" />
                        )}
                      </button>
                      <a
                        className="read-link"
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        阅读原文
                        <ExternalLink size={14} aria-hidden="true" />
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}
    </section>
  );
}
