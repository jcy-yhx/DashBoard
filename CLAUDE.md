# DeFi Dashboard — 作品集项目

## 项目定位

一个类似 Zapper.xyz 的 DeFi 资产仪表盘，**唯一目的是求职面试展示**，不做商业化。

**目标面试官画像**: Tech Lead / Senior Engineer，他们最不想看到的就是调了几个 RPC `balanceOf` 拼出来的静态页面。他们想看到的是处理链上异步数据不确定性、多源数据对齐、以及单人开发约束下优雅抽象的能力。

**核心卖点**: Indexing Pipeline + Portfolio Aggregation Engine + Protocol Adapter 体系。这三个模块完美覆盖"系统设计、数据建模、Web3 工程、Clean Architecture"全部面试考察点。

---

## 技术栈

| 层面 | 选型 | 理由 |
|------|------|------|
| 框架 | Next.js App Router | Server Components + API Routes 一体，单人开发不维护分离后端 |
| 语言 | TypeScript (strict) | 端到端类型安全，面试官极看重 |
| 数据库 | PostgreSQL + Drizzle ORM | Drizzle 比 Prisma 更轻、SQL 控制力更强，展示 SQL 功底 |
| 链上交互 | viem (publicClient) + wagmi | viem 是行业标准，wagmi 处理钱包连接 |
| 客户端状态 | TanStack Query | 缓存 + 去重请求 + staleTime 控制 |
| 数据校验 | Zod | 所有 API 入参/出参、环境变量统一校验 |
| UI | Tailwind CSS + shadcn/ui | 快速出效果，不花时间写 CSS |
| 图表 | Recharts | 轻量、够用 |
| 日志 | pino | 结构化日志，面试官喜欢看到可观测性意识 |

---

## 系统架构 (Clean Architecture)

```
+------------------------------------------------------------+
|           Presentation Layer (Next.js App Router)          |
|     Server Components + Server Actions + TanStack Query    |
+------------------------------------------------------------+
                          |  JSON / Server Actions
                          v
+------------------------------------------------------------+
|           Application Layer (Use Cases / Services)         |
|     GetUserPortfolio | GetHistoricalNetWorth | DTO + Zod   |
+------------------------------------------------------------+
                          |
                          v
+------------------------------------------------------------+
|           Domain Layer (Pure TypeScript, 零依赖)           |
|     Entities: Token, Position, Portfolio, Snapshot         |
|     Services: PortfolioCalculator, PriceAggregator         |
|     Repository Interfaces (不依赖任何框架)                   |
+------------------------------------------------------------+
                          |
        +-----------------+-----------------+
        |                                   |
        v                                   v
+---------------------------+   +---------------------------+
| Infrastructure: Database  |   | Infrastructure: Web3      |
| Drizzle ORM + Postgres    |   | viem + MulticallBatcher  |
| Repository 实现            |   | Protocol Adapters         |
+---------------------------+   | Price Adapters            |
                                +---------------------------+

+------------------------------------------------------------+
|           Indexing Layer (独立 Node.js 脚本)                |
|     Cron 触发 → getLogs → 写入 Postgres                      |
|     不进 Next.js request path，避免阻塞 API 响应              |
+------------------------------------------------------------+
```

### 数据流

```
[Ethereum] ──viem getLogs──> [Indexing Script/Cron] ──> [Postgres]
                                                              │
[浏览器 Wallet] ──> [Server Action/API] ──> [Application Service] ─┤
                                                │                  │
                                                v                  v
                                          [Domain Layer]    [Price Feed]
                                                │
                                                v
                                          [JSON] ──> [前端渲染]
```

### 关键架构决策 (Tradeoffs)

1. **Next.js 全栈 vs 分离后端**: 选 Next.js 全栈。4-6 周单人开发，维护分离的 NestJS 后端是时间陷阱。代价是长连接（WebSocket）不适配 Serverless。补偿方案：Indexing 剥离为独立脚本。
2. **不用 The Graph**: 省去学习 GraphQL 基础设施的时间。自己写 Indexing Pipeline 恰恰是展示数据建模和工程能力的地方。
3. **Drizzle 而非 Prisma**: Drizzle 的 SQL-like API 更能展示 SQL 功底。Prisma 的自动迁移在面试中反而是黑盒。
4. **不做实时推送**: 不用 WebSocket，用定时轮询 + cache。真实原因：Serverless 不擅长长连接。面试话术：先证明 polling 不够用，再升级到 WebSocket/SSE——这是工程成熟度的体现。
5. **先做 Ethereum 主网 + Arbitrum**: 两条链足以证明多链架构能力，不需要全覆盖。

---

## 数据库设计

```sql
-- 记录已索引的区块，支持增量同步 + 断点续传
CREATE TABLE indexed_blocks (
    block_number BIGINT PRIMARY KEY,
    chain_id INTEGER NOT NULL DEFAULT 1,
    indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 链上事件原始记录（幂等：blockNumber_logIndex_txHash 作为主键）
CREATE TABLE protocol_events (
    id TEXT PRIMARY KEY,  -- {blockNumber}_{logIndex}_{txHash}
    block_number BIGINT NOT NULL,
    chain_id INTEGER NOT NULL DEFAULT 1,
    tx_hash TEXT NOT NULL,
    protocol_id TEXT NOT NULL,
    user_address TEXT NOT NULL,
    event_name TEXT NOT NULL,
    args JSONB NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_events_user ON protocol_events(user_address, protocol_id);
CREATE INDEX idx_events_block ON protocol_events(block_number);

-- 代币余额快照（幂等：wallet + token + block_number 唯一）
CREATE TABLE token_balances (
    id SERIAL PRIMARY KEY,
    wallet TEXT NOT NULL,
    chain_id INTEGER NOT NULL DEFAULT 1,
    token_address TEXT NOT NULL,
    symbol TEXT NOT NULL,
    decimals INTEGER NOT NULL,
    balance NUMERIC(78, 0) NOT NULL,  -- 支持 uint256
    block_number BIGINT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    UNIQUE(wallet, chain_id, token_address, block_number)
);

-- DeFi 头寸（幂等：wallet + protocol + position_id + block_number 唯一）
CREATE TABLE positions (
    id SERIAL PRIMARY KEY,
    wallet TEXT NOT NULL,
    chain_id INTEGER NOT NULL DEFAULT 1,
    protocol_id TEXT NOT NULL,    -- 'aave-v3', 'uniswap-v3', 'lido'
    position_id TEXT NOT NULL,    -- NFT tokenId 或 deposit 地址
    type TEXT NOT NULL,           -- 'lending', 'borrowing', 'lp', 'staking'
    underlying_tokens JSONB NOT NULL,
    extra_data JSONB,            -- health factor, tick range, etc.
    block_number BIGINT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    UNIQUE(wallet, chain_id, protocol_id, position_id, block_number)
);

-- 每日净值快照（用于历史曲线）
CREATE TABLE portfolio_snapshots (
    id SERIAL PRIMARY KEY,
    wallet TEXT NOT NULL,
    date DATE NOT NULL,
    total_usd DOUBLE PRECISION NOT NULL,
    breakdown JSONB NOT NULL,  -- { tokens: {...}, protocols: {...} }
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(wallet, date)
);
```

---

## 核心模块设计

### 1. Multicall Batcher（最能体现链上工程能力的模块）

将整个应用散落在各处的链上读请求，在时间窗口内合并为单次 `multicall` RPC 调用。

```typescript
// 核心思路（来自 Gemini 建议）
class MulticallBatcher {
  private queue: Array<{
    call: ContractFunctionParameters;
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }> = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(private client: PublicClient, private delayMs: number = 50) {}

  async execute(call: ContractFunctionParameters): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({ call, resolve, reject });
      this.scheduleFlush();
    });
  }

  private scheduleFlush() {
    if (this.timer) return;
    this.timer = setTimeout(() => this.flush(), this.delayMs);
  }

  private async flush() {
    const batch = [...this.queue];
    this.queue = [];
    this.timer = null;
    if (batch.length === 0) return;

    try {
      const results = await this.client.multicall({
        contracts: batch.map(q => q.call),
        allowFailure: true,
      });
      results.forEach((res, i) => {
        if (res.status === 'success') batch[i].resolve(res.result);
        else batch[i].reject(res.error);
      });
    } catch (error) {
      batch.forEach(q => q.reject(error));
    }
  }
}
```

**面试官加分点**: 展示了你理解 RPC 节点的并发限制、浏览器 HTTP 连接上限、以及异步批处理队列机制。

### 2. Protocol Adapter 体系（策略模式）

```typescript
// domain/entities/position.ts
interface ProtocolPosition {
  protocolId: string;       // 'aave-v3', 'uniswap-v3', 'lido'
  positionId: string;       // 链上唯一标识
  type: 'lending' | 'borrowing' | 'lp' | 'staking';
  underlyingTokens: {
    address: string;
    symbol: string;
    amount: bigint;
    valueInUsd: number;
  }[];
  metadata?: Record<string, unknown>; // 协议特有字段
}

// infrastructure/web3/adapters/interface.ts
interface IProtocolAdapter {
  readonly protocolId: string;
  getPositions(address: string): Promise<ProtocolPosition[]>;
  getYieldOpportunities?(): Promise<YieldOpportunity[]>;
}

// infrastructure/web3/adapters/registry.ts
class AdapterRegistry {
  private adapters = new Map<string, IProtocolAdapter>();

  register(adapter: IProtocolAdapter): void {
    this.adapters.set(adapter.protocolId, adapter);
  }

  async aggregatePositions(address: string): Promise<ProtocolPosition[]> {
    const results = await Promise.allSettled(
      Array.from(this.adapters.values()).map(adapter =>
        withTimeout(adapter.getPositions(address), 3000)
      )
    );
    // 单个协议失败不影响整体——容错降级
    return results
      .filter((r): r is PromiseFulfilledResult<ProtocolPosition[]> =>
        r.status === 'fulfilled'
      )
      .flatMap(r => r.value);
  }
}
```

**实现计划（按复杂度递增）**:
- `LidoAdapter` — 最简单，读 stETH 余额即可，练手
- `AaveV3Adapter` — 中等，读借贷头寸 + Health Factor
- `UniswapV3Adapter` — 最复杂，解析 NFT 头寸 + tick 区间 + 未领取手续费

### 3. Indexing Pipeline

独立于 Next.js 的 Node.js 脚本，通过 GitHub Actions / cron 触发。

**核心流程**:
1. 查询 `indexed_blocks` 获取 `last_indexed_block`
2. 用 viem `getLogs` 拉取 `last_indexed_block → latestBlock - 12` 的指定事件
3. 批量写入 Postgres，使用 `INSERT ... ON CONFLICT DO NOTHING` 保证幂等
4. 更新 `indexed_blocks` 记录

**关键设计点**:
- **确认深度 = 12 个区块**：避免 reorg 导致脏数据（≈2.5 分钟 Ethereum）
- **幂等性**：以 `(blockNumber, logIndex, txHash)` 组合为主键，重复执行安全
- **断点续传**：中途崩溃后重启，从 `last_indexed_block` 安全继续
- **分批拉取**：每次处理 2000 个区块的日志，防止超出 RPC 节点限制
- **Backfill 模式**：初次部署时用更小的 batch size 回填历史

### 4. Portfolio Aggregation Engine

**核心难点**: 多链精度归一化 + 不同协议头寸的估值模型 + 价格源路由

**计算流程**:
```
1. 从 Postgres 读最新 balances + positions
2. 价格源路由：
   - WETH/WBTC/主流 Stablecoin → Chainlink Price Feed（链上直接读）
   - 长尾 Token（无 Chainlink） → Uniswap V3 pool slot0 获取 sqrtPriceX96 实时计算
   - 最后兜底 → CoinGecko API
3. 估值计算：
   - Token 持仓：balance * price
   - LP 头寸：解析 Uni V3 tick 区间，按当前 tick 计算 token 组成
   - 借贷头寸：supply_balance - borrow_balance
   - Lido 质押：stETH 余额 * stETH 价格
4. 聚合为 Portfolio 实体 → 缓存 → 返回
```

**关键工程原则**:
- **全链路 bigint**：所有链上原始数据保持 `bigint`，只在最终乘以 USD 价格输出给前端时转为 `number`
- **Promise.allSettled + 超时**：并行请求所有 adapter 和价格源，单源超时/失败不影响其他
- **缓存聚合结果**：存 `portfolio_cache` 表或内存，TTL 5-10 分钟

---

## MVP 功能清单

### 必须做（Week 1-3, 70% 精力）
- [x] 钱包连接（wagmi + RainbowKit）
- [x] Portfolio 总览（总价值 + 饼图 + 24h 变化）
- [x] Token 余额（ETH + ERC20，Ethereum + Arbitrum）
- [x] DeFi 头寸聚合（Aave V3 + Uniswap V3 + Lido）
- [x] 历史净值曲线（基于 daily snapshot）

### 选做（Week 4-5, 选1-2个）
- [ ] Health Factor 展示（Aave 借贷风险）
- [ ] Impermanent Loss 估算（Uniswap LP）
- [ ] Yield Opportunities 列表
- [ ] Uni V3 Out-of-range 预警
- [ ] 模拟交易构造（Supply / Swap）

### 坚决不做
NFT 展示、跨链桥聚合、完整交易界面、用户注册/登录、暗黑模式切换、多语言、社交分享、WebSocket 实时推送、MEV/Gas 优化模块

---

## 工程成熟度清单

- [ ] 全项目 TypeScript strict mode
- [ ] Zod 校验所有 API 入参/出参、环境变量
- [ ] ABI 使用 `as const` 声明，编译期校验合约调用参数类型
- [ ] 核心计算全链路 `bigint`，绝不出现 `Number(balance)`
- [ ] 错误分层：`DomainError` → `ApplicationError` → UI 友好提示
- [ ] RPC 容错：主节点失败自动切换 Fallback URL
- [ ] Adapter 错误隔离：单个协议挂掉不影响整个页面
- [ ] 数据库连接池管理（pg-pool）
- [ ] pino 结构化日志覆盖关键路径
- [ ] Aggregation Engine + Adapter 单元测试
- [ ] CI：typecheck + lint
- [ ] README 包含架构图、ADR、tradeoff 说明

---

## 面试防御：必问问题准备

### Q1: 链上发生 reorg 时，你的 Indexer 数据怎么办？
**回答**: MVP 阶段使用 12 个区块确认深度（≈2.5 min），只同步已确认区块。更完善的方案是在 `protocol_events` 表增加 `status` 字段，保留最近 N 个区块的 block hash 映射，一旦检测到 `parentHash` 不匹配，触发本地回滚逻辑。

### Q2: 如何在 800ms 内加载用户复杂的 Uniswap V3 头寸？
**回答**: 三级缓存。L0 — Multicall Batching 把 N 次 RPC 合并为 1 次，降低网络往返；L1 — 应用层缓存标准化 Domain Entity，TTL 12 秒（≈1 个区块时间）；L2 — 前端 TanStack Query 的 `staleTime` 防止切屏时重复请求。

### Q3: 如何扩展新协议？
**回答**: 实现 `IProtocolAdapter` 接口 → 在 Registry 注册 → 完成。协议特有数据在 Adapter 内部做归一化，对外暴露统一的 `ProtocolPosition` 实体。开闭原则：新增协议不需要修改 Aggregation Engine。

### Q4: 用户量激增怎么 scale？
**回答**: 先垂直扩容（更大的 DB 实例），再加 Read Replica 分离读写。Indexing Pipeline 是独立脚本，天然可拆成微服务。前端部署在 Vercel 上自动水平扩展。瓶颈在 RPC 节点——引入付费 RPC 和请求队列控制。

---

## 5 周 MVP 路线图

### Week 1 — 基础设施与领域建模
```
任务:
- [ ] Next.js + TS + Tailwind + Drizzle + viem + wagmi 项目脚手架
- [ ] Domain 层核心实体定义（Token, Position, Portfolio, Snapshot）
- [ ] MulticallBatcher 实现
- [ ] 钱包连接 + 基础 ERC20 余额查询（通过 multicall）
- [ ] 环境变量 Zod Schema（RPC URLs, DB URL）
```
**产出**: 可输入地址查看 ETH 和主流 ERC20 余额的 CLI/API

### Week 2 — Adapter 与聚合引擎
```
任务:
- [ ] IProtocolAdapter 接口 + AdapterRegistry
- [ ] LidoAdapter（练手，读 stETH 余额）
- [ ] AaveV3Adapter（进阶，借贷头寸 + Health Factor）
- [ ] 价格源路由（Chainlink + Uniswap Pool + CoinGecko fallback）
- [ ] PortfolioCalculator（余额 + 头寸 → USD 总额）
- [ ] 基础 Portfolio 概览页面
```
**产出**: 后端可聚合多协议实时持仓，前端展示总价值

### Week 3 — Indexing 与历史数据
```
任务:
- [ ] Postgres Schema 迁移（Drizzle）
- [ ] Indexing 脚本（增量区块处理 + 幂等写入）
- [ ] UniswapV3Adapter（最复杂：NFT 头寸 + tick 计算）
- [ ] Daily Snapshot 机制
- [ ] 历史净值图表（Recharts）
```
**产出**: 数据库可提供可靠的历史资产走势曲线

### Week 4 — 打磨与进阶功能
```
任务:
- [ ] Health Factor 或 IL 估算（二选一）
- [ ] Yield Opportunities 列表
- [ ] 错误处理 + Loading 状态 + 优雅降级
- [ ] RPC 节点 Fallback 配置
- [ ] Aggregation Engine + Adapter 单元测试
- [ ] CI：typecheck + lint
```
**产出**: 具备生产级容错能力的完整应用

### Week 5 — 文档与演示
```
任务:
- [ ] README 写架构图 + ADR + Tradeoff 说明
- [ ] 录制 Demo 视频或部署线上版本
- [ ] 历史数据 Backfill
- [ ] UI 最终抛光（不追求移动端完美适配）
```
**产出**: 可直接用于面试展示的完整作品集

---

## 项目文件结构

```
dashboard/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── page.tsx                # Portfolio 主页面
│   │   ├── layout.tsx
│   │   ├── api/
│   │   │   ├── portfolio/route.ts  # GET /api/portfolio?wallet=0x...
│   │   │   └── history/route.ts    # GET /api/history?wallet=0x...&days=30
│   │   └── providers.tsx           # Wagmi + TanStack Query Provider
│   │
│   ├── application/                # 用例层
│   │   ├── portfolio/
│   │   │   ├── get-portfolio.ts    # 编排：拉取 + 聚合 + 返回 DTO
│   │   │   └── dto.ts              # Zod schema for response
│   │   └── history/
│   │       ├── get-history.ts
│   │       └── dto.ts
│   │
│   ├── domain/                     # 纯 TS，零框架依赖
│   │   ├── entities/
│   │   │   ├── token.ts
│   │   │   ├── position.ts         # ProtocolPosition 接口
│   │   │   ├── portfolio.ts
│   │   │   └── snapshot.ts
│   │   ├── services/
│   │   │   ├── portfolio-calculator.ts
│   │   │   └── price-aggregator.ts
│   │   └── repositories/
│   │       └── interfaces.ts       # IPortfolioRepo, ISnapshotRepo
│   │
│   ├── infrastructure/             # 外部依赖实现
│   │   ├── config/
│   │   │   └── env.ts              # Zod 校验的环境变量
│   │   ├── db/
│   │   │   ├── schema.ts           # Drizzle 表定义
│   │   │   ├── index.ts            # DB 连接
│   │   │   └── repositories/       # Domain 层接口的实现
│   │   │       ├── portfolio-repo.ts
│   │   │       └── snapshot-repo.ts
│   │   └── web3/
│   │       ├── client.ts           # viem publicClient（含 fallback）
│   │       ├── multicall-batcher.ts
│   │       ├── adapters/
│   │       │   ├── interface.ts    # IProtocolAdapter
│   │       │   ├── registry.ts     # AdapterRegistry
│   │       │   ├── lido.ts
│   │       │   ├── aave-v3.ts
│   │       │   ├── uniswap-v3.ts
│   │       │   └── erc20.ts        # Token 余额（基础 Adapter）
│   │       └── prices/
│   │           ├── interface.ts    # IPriceAdapter
│   │           ├── chainlink.ts
│   │           ├── uniswap-pool.ts
│   │           └── coingecko.ts
│   │
│   ├── indexing/                   # 独立 Indexing Pipeline
│   │   ├── index.ts                # 入口（cron 触发）
│   │   ├── event-processor.ts      # 解析 event log → 写入 DB
│   │   └── backfill.ts            # 历史数据回填
│   │
│   └── lib/                        # 共享工具
│       ├── bigint.ts               # 安全 bigint ↔ decimal 转换
│       ├── errors.ts               # 错误类型定义
│       └── timeout.ts              # Promise withTimeout
│
├── drizzle.config.ts
├── tailwind.config.ts
├── tsconfig.json                   # strict: true
├── .env.example                    # 环境变量模板
└── README.md                       # 架构图 + ADR + Tradeoff
```

---

## 开发规范

### 通用原则
- **不必过度抽象**: MVP 阶段，"能跑 + 可扩展" > "完美抽象"。过早抽象是最大杀手
- **以面试展示为尺**: 每写一个模块，问自己"面试官看到这个会不会加分？"
- **代码即文档**: 命名清晰优先于注释多

### TypeScript
- 全项目 `strict: true`
- ABI 必须 `as const` 声明
- 禁止 `any`（除极少数 viem 类型推断不得已的情况，需要注释说明原因）

### BigInt 铁律
- 所有链上原始数值（余额、amount）全程保持 `bigint`
- 仅在一个地方转为 `number`：最终乘以 USD 价格输出给前端
- 精度转换统一走 `src/lib/bigint.ts` 工具函数

### 错误处理
- `DomainError`：领域层业务错误（如"价格源不可用"）
- `ApplicationError`：应用层编排错误
- API 层统一 catch → 转 HTTP 状态码 + 用户友好消息
- Adapter 错误在 Registry 层隔离，不影响其他 Adapter

### 外部调用
- 所有并行外部调用必须用 `Promise.allSettled`，不用 `Promise.all`
- 每个外部调用必须有超时保护（`withTimeout` 工具函数）
- RPC 客户端必须配置至少一个 Fallback URL

### 数据库
- 所有写入操作必须幂等（`ON CONFLICT DO NOTHING` 或唯一约束）
- JSONB 存协议原始数据，标准化字段单独列
- 不在 API 请求路径中做批量写入（那是指 Indexing Pipeline 的事）

### 测试
- 重点测试 Aggregation Engine（Mock viem 和 DB）
- 重点测试 Adapter 的归一化逻辑
- 不必追求覆盖率，但核心计算逻辑必须有测试

### Git
- 每个 Week 的产出做一个分支
- Commit message 英文，格式: `feat: ...` / `fix: ...` / `docs: ...`

---

## 面试展示策略

### 简历写法建议
> 设计并实现了一个 DeFi 资产聚合仪表盘，核心亮点：
> 1. 自研事件索引引擎（Indexing Pipeline），支持增量同步 + 幂等回放
> 2. 基于策略模式的可扩展协议适配器体系，覆盖 Aave V3 / Uniswap V3 / Lido 三种异构头寸
> 3. Multicall 请求批处理机制，将 N 次 RPC 调用合并为单次请求
> 4. Clean Architecture 分层设计，领域层零框架依赖，单元测试覆盖核心计算引擎

### 面试准备清单
- [ ] 能画出架构分层图 + 数据流图
- [ ] 能讲清楚每个 tradeoff 的理由
- [ ] 能现场写 IProtocolAdapter 接口 + 一个具体实现
- [ ] 能讲清楚 reorg 处理方案
- [ ] 能解释为什么不用 The Graph
- [ ] 准备了 Demo 视频（备选：在线 Demo 环境）
