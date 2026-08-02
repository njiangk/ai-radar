import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Header } from './components/Header';
import { NewsPage } from './components/NewsPage';

const ModelsPage = lazy(() =>
  import('./components/ModelsPage').then((module) => ({ default: module.ModelsPage })),
);

export default function App() {
  return (
    <HashRouter>
      <Header />
      <main className="app-main">
        <Suspense
          fallback={<div className="route-loading">加载中</div>}
        >
          <Routes>
            <Route path="/" element={<NewsPage />} />
            <Route path="/models" element={<ModelsPage />} />
          </Routes>
        </Suspense>
      </main>
      <footer className="site-footer">
        <div className="footer-inner">
          <span>数据来源：OpenRouter Benchmarks/Rankings、models.dev、LiteLLM 与公开 RSS 源。</span>
          <span>新闻版权归原作者所有，本站仅展示标题与摘要。</span>
        </div>
      </footer>
    </HashRouter>
  );
}
