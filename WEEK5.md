# Week 5 完成报告

> 2026-05-20 · DeFi Dashboard 作品集项目

## 交付目标

README 文档（架构图 + ADR + Tradeoff）、UI 最终抛光、项目收尾。

---

## README 内容

[README.md](README.md) 包含以下章节：

| 章节 | 内容 |
|------|------|
| Architecture | ASCII 分层架构图 + 数据流图 |
| Tech Stack | 11 个技术选型 + 理由 |
| Project Structure | 完整目录树 + 每个文件的作用 |
| Database Schema | 5 张表 + 幂等键策略 |
| ADR (5 条) | 不用 The Graph、Clean Architecture、Bigint 铁律、三层价格路由、12 区块确认深度 — 每条含 Decision / Rationale / Tradeoff |
| Key Modules | MulticallBatcher、Protocol Adapter、Indexing Pipeline、Portfolio Aggregation 面试深度解读 |
| Getting Started | 6 步运行指南 |

## UI 抛光

| 组件 | 改进 |
|------|------|
| [PositionsList](src/components/positions-list.tsx) | 集成 HealthFactorBadge（Aave 借贷头寸自动显示健康因子） |
| [PortfolioOverview](src/components/portfolio-overview.tsx) | 右上角显示数据更新时间戳 |

## 最终验证

- TypeScript strict: **0 errors**
- Vitest: **3 files, 20 tests, all passed**
- Next.js build: **成功**

## 项目最终规模

| 指标 | 数量 |
|------|------|
| 源文件 | 47 个 |
| API 路由 | 3 个 (`/api/portfolio`, `/api/history`) |
| 数据库表 | 5 张 |
| 协议适配器 | 3 个 (Lido, Aave V3, Uniswap V3) |
| 价格适配器 | 3 个 (Chainlink, Uniswap Pool, CoinGecko) |
| 单元测试 | 20 个 |
| Indexing 脚本 | 2 个 (增量 + 回填) |
| CI | GitHub Actions (typecheck + lint + test) |
| ADR | 5 条 |

## 面试清单

- [x] 能画出架构分层图 + 数据流图
- [x] 能讲清楚每个 tradeoff 的理由
- [x] 能现场写 IProtocolAdapter 接口 + 一个具体实现
- [x] 能讲清楚 reorg 处理方案
- [x] 能解释为什么不用 The Graph
- [x] README 包含完整架构文档
- [x] 单元测试覆盖核心计算引擎
- [x] CI 就绪
