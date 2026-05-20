# Week 1 完成报告

> 2026-05-20 · DeFi Dashboard 作品集项目

## 交付目标

按照 CLAUDE.md 中 Week 1 路线图，完成项目基础设施搭建与领域建模。

---

## 已完成内容

### 1. 项目脚手架

- Next.js 16 (App Router) + TypeScript strict mode
- Tailwind CSS 4 + PostCSS
- 28 个源文件，Clean Architecture 分层
- TypeScript 编译 **零错误**，Next.js build **成功**

### 2. Clean Architecture 分层

```
src/
├── app/                    # Presentation (Next.js App Router)
│   ├── api/portfolio/      # GET /api/portfolio?wallet=0x...
│   ├── page.tsx            # 首页
│   ├── layout.tsx          # 根布局
│   └── providers.tsx       # TanStack Query Provider
├── application/portfolio/  # Use Cases + DTOs + Zod 校验
├── domain/                 # 纯 TypeScript，零依赖
│   ├── entities/           # Token, Position, Portfolio, Snapshot
│   ├── services/           # PortfolioCalculator
│   └── repositories/       # 仓储接口
├── infrastructure/
│   ├── web3/               # viem client + MulticallBatcher + Adapters
│   ├── db/                 # Drizzle ORM schema (5 张表)
│   └── config/             # Zod 校验的环境变量
├── components/             # React UI 组件
├── hooks/                  # 自定义 hooks
└── lib/                    # 共享工具 (bigint, errors, timeout)
```

### 3. 核心模块

| 模块 | 文件 | 说明 |
|------|------|------|
| MulticallBatcher | `infrastructure/web3/multicall-batcher.ts` | 队列批处理，50ms 窗口合并 N 次 RPC 为 1 次 |
| viem 客户端 | `infrastructure/web3/client.ts` | Fallback RPC 节点自动切换 (Alchemy → Infura) |
| ERC20 Adapter | `infrastructure/web3/adapters/erc20.ts` | ETH 原生余额 + 10 个主流 ERC20 批量查询 |
| AdapterRegistry | `infrastructure/web3/adapters/registry.ts` | 策略模式注册中心，Promise.allSettled 容错 |
| PortfolioCalculator | `domain/services/portfolio-calculator.ts` | 余额 + 头寸聚合，按 token 和 protocol 分配 |
| 环境配置 | `infrastructure/config/env.ts` | Zod schema，启动时校验，失败即 crash |

### 4. 数据库 Schema (Drizzle ORM, 5 张表)

- `indexed_blocks` — 已索引区块记录
- `protocol_events` — 链上事件（幂等主键）
- `token_balances` — 代币余额快照
- `positions` — DeFi 头寸快照
- `portfolio_snapshots` — 每日净值快照

### 5. 前端页面

- 钱包连接按钮（当前使用 vitalik.eth demo 地址）
- Portfolio 总览卡片（总价值 + 分配饼图）
- Token 余额列表（ETH + ERC20）
- Loading 骨架屏 + 错误降级提示
- TanStack Query 缓存层（staleTime = 12s）

### 6. 工程实践

- 全链路 `bigint` 存储，仅最终输出给前端时转 decimal string
- 错误分层：DomainError → ApplicationError → 用户友好信息
- `Promise.allSettled` + `withTimeout` 保护所有外部调用
- `src/lib/bigint.ts` 统一精度转换工具
- `.env.example` 模板文件

---

## 技术栈

| 层面 | 选型 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 语言 | TypeScript strict |
| 数据库 | PostgreSQL + Drizzle ORM |
| 链上交互 | viem 2.x |
| 状态管理 | TanStack Query 5 |
| 校验 | Zod |
| 样式 | Tailwind CSS 4 |
| 日志 | pino |
| 图表 | Recharts |

---

## Week 2 预告

- LidoAdapter（stETH 余额 → ProtocolPosition）
- AaveV3Adapter（借贷头寸 + Health Factor 解析）
- 价格源路由（Chainlink Feed → Uniswap V3 slot0 → CoinGecko fallback）
- 真正的 USD 估值

---

## 面试可展示点

1. **Clean Architecture 分层** — 领域层零依赖，基础设施依赖倒置
2. **MulticallBatcher** — 理解 RPC 并发限制 + 异步批处理
3. **Adapter Registry** — 策略模式 + 容错隔离
4. **Bigint 铁律** — 核心计算全链路 bigint，精度无损
5. **Zod 端到端校验** — 环境变量 + API 入参/出参全校验
