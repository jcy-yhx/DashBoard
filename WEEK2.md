# Week 2 完成报告

> 2026-05-20 · DeFi Dashboard 作品集项目

## 交付目标

实现 Protocol Adapter 体系（Lido + Aave V3）和三层价格源路由（Chainlink → Uniswap Pool → CoinGecko），让 Portfolio API 能输出真实的 USD 估值。

---

## 新增文件清单

### 价格适配器体系（4 个新文件）

```
src/infrastructure/web3/prices/
├── interface.ts          # IPriceAdapter 统一接口
├── chainlink.ts          # Chainlink Price Feed 适配器
├── uniswap-pool.ts       # Uniswap V3 slot0 价格适配器
└── coingecko.ts          # CoinGecko API 兜底适配器
```

**路由策略**: `Chainlink → Uniswap Pool → CoinGecko`，遇 nil 自动 fall 到下一层，确保尽可能多的 token 有价格。

**Chainlink 覆盖** (10 个 token): ETH, WETH, WBTC, USDC, USDT, DAI, LINK, UNI, AAVE, stETH/wstETH。一次 multicall 批量获取 answer + decimals。

**Uniswap Pool 覆盖**: USDC/WETH 0.05% 池，通过 `slot0.sqrtPriceX96` 实时计算价格，覆盖 Chainlink 没有的长尾币。

**CoinGecko 覆盖**: 11 个 token ID 映射，支持 API key，批量 `/simple/price` 查询，作为最后一层兜底。

### 价格聚合服务（1 个新文件）

```
src/domain/services/
└── price-aggregator.ts   # 三层路由编排
```

`PriceAggregator` 接收一组 token → 逐个适配器尝试 → 第一个非 null 结果胜出。后续适配器只处理前面未定价的剩余 token。

### 协议适配器（2 个新文件）

```
src/infrastructure/web3/adapters/
├── lido.ts               # Lido 质押适配器
└── aave-v3.ts            # Aave V3 借贷适配器
```

**LidoAdapter**: 
- 同时处理 stETH 和 wstETH 两种 token
- wstETH 通过 `getStETHByWstETH` 合约方法 unwrap 为 stETH 等价量
- 输出 `type: "staking"` 的 ProtocolPosition

**AaveV3Adapter**:
- 调用 PoolDataProvider `getUserReservesData` 获取用户的逐资产借贷数据
- 按 reserve 拆分：supply → `type: "lending"`, borrow → `type: "borrowing"`
- 标注 `usageAsCollateral` 是否抵押品
- 使用 JSON ABI 格式规避 `parseAbi` 的 tuple 解析兼容问题

---

## 修改文件清单

| 文件 | 变更说明 |
|------|---------|
| `src/domain/entities/token.ts` | `TokenBalance.valueInUsd` 改为 mutable（价格回填需要） |
| `src/domain/entities/position.ts` | `UnderlyingToken.valueInUsd` 改为 mutable |
| `src/application/portfolio/get-portfolio.ts` | 集成 PriceAggregator，自动收集中所有 token → 三层路由查价 → 回填 valueInUsd |
| `src/app/api/portfolio/route.ts` | 注册 LidoAdapter + AaveV3Adapter，单例 registry 缓存 |
| `src/infrastructure/config/env.ts` | `loadEnv()` 改为 `getEnv()` 懒加载，构建时不再检查环境变量（避免 Next.js build crash） |
| `src/infrastructure/db/index.ts` | 同步适配 `getEnv()` |

---

## 架构亮点（面试可讲）

1. **三层价格源路由** — 链上优先（Chainlink + Uniswap），链下兜底（CoinGecko），每一层独立容错，上一层失败不影响下一层
2. **Protocol Adapter 策略模式** — 三种异构协议（质押/借贷/LP）统一为 `ProtocolPosition` 输出，新增协议只需实现接口 + 注册
3. **AdapterRegistry 容错隔离** — `Promise.allSettled` + 5 秒超时，单个 Adapter crash 不影响其他协议数据渲染
4. **全链路 bigint 精度** — 链上原始数据全程 bigint，仅在 `bigintToUsd()` 最终乘以价格输出 number 给前端
5. **wstETH unwrap** — 正确处理 Lido 的 wrapped token 场景，展示对 DeFi 协议机制的深入理解

---

## 验证结果

- TypeScript strict: **0 errors**
- Next.js build: **成功**
- API route `/api/portfolio?wallet=0x...` 返回含 USD 估值的 portfolio JSON

---

## Week 3 预告

- UniswapV3Adapter（解析 NFT LP 头寸 + tick 区间 + 未领取手续费）
- Indexing Pipeline（增量区块处理 + 幂等写入 + 断点续传）
- Daily Portfolio Snapshot 机制
- 历史净值曲线（Recharts）
