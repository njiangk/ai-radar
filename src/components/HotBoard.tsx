import { Flame } from 'lucide-react';
import type { HotFile, HotTopic } from '../types';
import { formatUpdated } from '../lib/format';

interface HotBoardProps {
  hot: HotFile | null;
  active: HotTopic | null;
  onSelect: (topic: HotTopic | null) => void;
}

function rankClass(rank: number): string {
  if (rank <= 3) {
    return 'hot-rank hot-rank-top';
  }
  if (rank <= 6) {
    return 'hot-rank hot-rank-mid';
  }
  return 'hot-rank';
}

function heatLabel(heat: number): string {
  if (heat >= 90) {
    return '爆';
  }
  if (heat >= 70) {
    return '热';
  }
  if (heat >= 50) {
    return '温';
  }
  return '新';
}

export function HotBoard({ hot, active, onSelect }: HotBoardProps) {
  if (!hot || hot.items.length === 0) {
    return null;
  }
  return (
    <section className="hot-board">
      <div className="hot-board-head">
        <h2>
          <Flame size={18} aria-hidden="true" />
          AI 热点
        </h2>
        <span className="page-meta">更新于 {formatUpdated(hot.generatedAt)}</span>
      </div>
      <ol className="hot-list">
        {hot.items.map((topic) => {
          const isActive = active?.rank === topic.rank;
          return (
            <li key={topic.rank}>
              <button
                type="button"
                className={`hot-item${isActive ? ' hot-item-active' : ''}`}
                onClick={() => onSelect(isActive ? null : topic)}
                aria-pressed={isActive}
              >
                <span className={rankClass(topic.rank)}>{topic.rank}</span>
                <span className="hot-body">
                  <span className="hot-title-row">
                    <span className="hot-title">{topic.title}</span>
                    <span className={`hot-tag hot-tag-${heatLabel(topic.heat).toLowerCase()}`}>
                      {heatLabel(topic.heat)}
                    </span>
                  </span>
                  <span className="hot-reason">{topic.reason}</span>
                </span>
                <span className="hot-heat">热度 {topic.heat}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {active && (
        <button
          type="button"
          className="hot-clear"
          onClick={() => onSelect(null)}
        >
          清除筛选
        </button>
      )}
    </section>
  );
}
