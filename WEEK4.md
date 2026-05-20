# Week 4 完成报告

> 2026-05-20 · DeFi Dashboard 作品集项目

## 交付目标

实现 Health Factor 展示、Impermanent Loss 估算、Yield Opportunities 列表、错误处理与优雅降级优化、单元测试和 CI。

---

## 新增文件清单

### Health Factor (2 个文件)

| 文件 | 说明 |
|------|------|
| `src/infrastructure/web3/adapters/aave-v3.ts` | 重构：并行查询 `getUserReservesData` + `getUserAccountData`（Pool 合约），获取 healthFactor / totalCollateral / totalDebt / ltv / liquidationThreshold |
| `src/components/health-factor-badge.tsx` | 按阈值着色标签：HF≥3 绿(Safe) / ≥1.5 黄(Moderate) / ≥1 橙(Risky) / <1 红(Liquidation) |

**面试可讲**: 展示了对 Aave V3 借贷风险模型的理解——`getUserAccountData` 返回 6 元组数据，healthFactor 是 18 位精度的 uint256。

### Impermanent Loss (1 个文件)

| 文件 | 说明 |
|------|------|
| `src/domain/services/il-calculator.ts` | `calculateV2Il(priceRatio)` — V2 风格恒定乘积 IL 公式 `2√r / (1+r) - 1`；`calculateIlEstimate()` — 基于 entry/current token 数量和价格的完整估算，支持 out-of-range 标记 |

**面试可讲**: IL 估值是 DeFi 面试高频考点。项目展示了从 tick 区间 → token 数量变化 → 对比 HODL 价值 → 计算 IL 百分比/美元的完整链路。

### Yield Opportunities (1 个文件)

| 文件 | 说明 |
|------|------|
| `src/domain/services/yield-aggregator.ts` | 遍历所有 Adapter 的 `getYieldOpportunities()`，`Promise.allSettled` + 5s 超时容错，按 APY 降序排列 |

### 单元测试 (3 个文件, 20 个用例)

```
src/lib/__tests__/
└── bigint.test.ts                     # 7 tests: 精度转换、零值、边界

src/domain/__tests__/
├── portfolio-calculator.test.ts       # 5 tests: 空输入、多协议、百分比、null
└── il-calculator.test.ts             # 8 tests: V2 IL 对称性、2x 变动、out-of-range
```

### CI (1 个文件)

```
.github/workflows/
└── ci.yml              # GitHub Actions: typecheck + lint + test (vitest)
```

### vitest 配置

| 文件 | 说明 |
|------|------|
| `vitest.config.ts` | `@/` → `./src/` 路径别名解析 |

---

## 修改文件清单

| 文件 | 变更说明 |
|------|---------|
| `src/infrastructure/web3/adapters/aave-v3.ts` | 重构：新增 `getAccountData()` 方法，Parallel `Promise.allSettled` 查询 reserves + health factor，Health Factor 数据写入每个 position 的 metadata |
| `src/infrastructure/web3/adapters/registry.ts` | 新增 `listAdapters()` 方法，支持 YieldAggregator 遍历 |
| `package.json` | 新增 `vitest` devDependency |

---

## 验证结果

- TypeScript strict: **0 errors**
- Vitest: **3 files, 20 tests, all passed**
- Next.js build: **成功** (路由: `/`, `/api/portfolio`, `/api/history`)
- CI ready (GitHub Actions workflow 就绪)

---

## 当前项目规模

- 源文件: **46 个**
- API 路由: **3 个** (`/api/portfolio`, `/api/history`)
- 数据库表: **5 张** (Drizzle schema)
- 协议适配器: **3 个** (Lido, Aave V3, Uniswap V3)
- 价格适配器: **3 个** (Chainlink, Uniswap Pool, CoinGecko)
- 单元测试: **20 个**
- Indexing Pipeline: **2 个脚本** (增量 + 回填)

---

## Week 5 预告

- README 写架构图 + ADR + Tradeoff 说明
- Demo 视频或线上部署
- 历史数据 Backfill
- UI 最终抛光
