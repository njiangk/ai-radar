# AI Radar

AI Radar 是一个静态部署的 AI 双核资讯站：持续汇集最新 AI 新闻，并提供文本大模型的性能、价格与使用量对比。

## 功能

- 新闻页：顶部提供收录量、今日、24 小时与来源概览；聚合官方博客、arXiv、Hacker News 与主流科技媒体 RSS；支持分类/来源筛选、搜索、双语切换、本地收藏与已读标记。
- 模型页：模型总数/厂商/价格覆盖概览，OpenRouter 使用量排名 Top 10，OpenRouter Benchmarks Top 5 与厂商分布；可排序表格、价格-性能散点图、近 90 天趋势。
- 性能对比：性能分数来自 [OpenRouter Benchmarks](https://openrouter.ai/rankings)（Artificial Analysis Intelligence Index），排名来自 OpenRouter Rankings。
- 定时更新：GitHub Actions 每 2 小时抓取一次新闻，模型数据超过 12 小时才重新拉取，并自动发布到 GitHub Pages。

## 本地运行

```bash
pnpm install
pnpm build:data
pnpm dev
```

生产构建：

```bash
pnpm test
pnpm build
```

## 数据管道

- 新闻源配置在 `config/news-sources.json`，每个源独立容错。
- 模型别名映射在 `config/model-aliases.json`，用于把 OpenRouter 模型 id 与 Benchmarks/榜单分数对齐。
- 生成结果写入 `public/data/`，分别为 `news.json`、`models.json`、`history.json`。
- 可选翻译：配置 `LLM_API_KEY` 后，用 OpenAI 兼容接口为最近 60 条新闻生成中文标题和一句话摘要；未配置时页面回退到原文。

## 部署

1. 把仓库推送到 GitHub 并开启 Pages，构建来源选择 GitHub Actions。
2. 首次可手动运行 `Update data and deploy` 工作流。
3. 如需新闻中文翻译，在仓库 Secrets 中配置：
   - `LLM_API_KEY`
   - `LLM_BASE_URL`（默认 `https://api.openai.com/v1`）
   - `LLM_MODEL`（默认 `gpt-4o-mini`）

## 数据来源与版权

新闻仅展示标题与摘要并链接原文，版权归原作者所有。模型价格、Benchmarks 与排名数据来自 OpenRouter，价格补充来自 models.dev 与 LiteLLM，具体以各来源的最新数据为准。
