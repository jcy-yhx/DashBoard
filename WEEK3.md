# Week 3 完成报告

> 2026-05-20 · DeFi Dashboard 作品集项目

## 交付目标

实现 UniswapV3Adapter（最复杂的协议适配器）、Indexing Pipeline（链上事件索引）、Daily Snapshot 机制和历史净值图表。

---

## 新增文件清单

### UniswapV3Adapter (1 个文件)

```
src/infrastructure/web3/adapters/
└── uniswap-v3.ts    # Uniswap V3 LP 头寸适配器
```

**这是整个项目中最复杂的 Adapter**，展示了以下能力：

1. **NFT 枚举**: `balanceOf` → `tokenOfOwnerByIndex` 遍历用户所有 LP NFT
2. **批量头寸查询**: multicall 一次性获取所有 `positions(tokenId)` 结果（token0, token1, fee, tickLower, tickUpper, liquidity, tokensOwed0, tokensOwed1）
3. **池地址计算**: 通过 UniswapV3Factory `getPool(tokenA, tokenB, fee)` 计算池地址
4. **Tick 数学**: 根据当前 tick 与头寸的 `[tickLower, tickUpper]` 区间关系计算 token 组成：
   - 低于区间 → 全 token0
   - 高于区间 → 全 token1
   - 区间内 → 按 sqrtPriceX96 比例拆分
5. **Out-of-range 检测**: 头寸不在活跃区间时标注预警
6. **未领取手续费**: `tokensOwed0` / `tokensOwed1` 写入 metadata

### Indexing Pipeline (2 个文件)

```
src/indexing/
├── index.ts      # 增量索引入口（cron 触发）
└── backfill.ts   # 历史数据回填脚本
```

**index.ts 核心逻辑**:
- 查 `indexed_blocks` 获取上次同步位置
- 用 viem `getLogs` 拉取 `lastBlock + 1 → latestBlock - 12` 的所有事件
- 每次 2000 个区块分批，防止 RPC 限流
- 幂等写入 `protocol_events`（`ON CONFLICT DO NOTHING`）
- 更新 `indexed_blocks` 记录
- 追踪地址: Aave V3 Pool + Uniswap V3 PositionManager

**backfill.ts**: 500 blocks/batch，默认回填 30 天历史（≈195k 区块）

**运行方式**: `npx tsx src/indexing/index.ts`

### Snapshot 机制 (2 个文件)

```
src/infrastructure/db/repositories/
└── snapshot-repo.ts              # Snapshot 持久层

src/domain/services/
└── snapshot-service.ts           # 每日快照生成
```

- `takeSnapshot(portfolio)` — 从 Portfolio 实体提取 breakdown，生成当日快照并 UPSERT 入库
- `getSnapshots(wallet, since)` — 查询指定时间范围内的历史快照

### History API (2 个文件)

```
src/application/history/
├── dto.ts            # Zod 出入参校验
└── get-history.ts    # 用例编排

src/app/api/history/
└── route.ts          # GET /api/history?wallet=0x...&days=30
```

### 前端组件 (2 个文件)

```
src/components/
├── net-worth-chart.tsx    # Recharts AreaChart 历史净值曲线
└── positions-list.tsx     # DeFi 头寸列表组件
```

**NetWorthChart**: 渐变色填充面积图，30 天净值走势，暗色主题适配，加载骨架屏 + 空数据提示

**PositionsList**: 按协议和类型（Supply/Borrow/Stake/LP）展示头寸，含 Out-of-range 黄色预警标签，USD 估值汇总

---

## 修改文件清单

| 文件 | 变更说明 |
|------|---------|
| `src/infrastructure/db/index.ts` | DB 连接改为 Proxy 懒加载，避免 Next.js 构建时触发 PostgreSQL 连接 |
| `src/app/api/portfolio/route.ts` | 注册 UniswapV3Adapter |
| `src/app/page.tsx` | 集成 NetWorthChart + PositionsList |

---

## 工程亮点

1. **Tick 数学** — 从 Uniswap V3 的 `sqrtPriceX96` → tick → 区间计算 → 双 token 数量，展示了 DeFi AMM 核心机制的理解
2. **幂等 Indexing** — 断点续传 + `ON CONFLICT DO NOTHING`，中途崩溃重启安全
3. **确认深度 12 区块** — reorg 安全，具体数字比"适量确认"更有说服力
4. **Recharts 面积图** — 不是简单的折线图，用了渐变色填充 + 格式化 tooltip，展示前端敏感度
5. **懒加载 DB** — Proxy 模式延迟 PostgreSQL 连接，解决 Serverless 构建问题

---

## 验证结果

- TypeScript strict: **0 errors**
- Next.js build: **成功**
- 路由: `/` (static) + `/api/portfolio` (dynamic) + `/api/history` (dynamic)

---

## Week 4 预告

- Health Factor 展示 / Impermanent Loss 估算
- Yield Opportunities 列表
- 错误处理 + Loading 状态 + 优雅降级优化
- Fallback RPC 配置完善
- 单元测试（Aggregation Engine + Adapters）
- CI: typecheck + lint
