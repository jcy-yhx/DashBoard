# DeFi Dashboard

> A Zapper-like DeFi portfolio aggregator — **engineering portfolio piece** for blockchain/web3 developer roles.

Supports **Ethereum mainnet** with multi-protocol position aggregation, on-chain price feeds, custom event indexing, and historical net worth tracking.

---

## Architecture

```
+------------------------------------------------------------+
|           Presentation Layer (Next.js App Router)          |
|     Server Components + TanStack Query (staleTime: 12s)    |
+------------------------------------------------------------+
                          |
                          v
+------------------------------------------------------------+
|           Application Layer (Use Cases)                    |
|     GetPortfolio | GetHistory | Zod DTOs                   |
+------------------------------------------------------------+
                          |
                          v
+------------------------------------------------------------+
|           Domain Layer (Pure TypeScript, zero deps)        |
|     Entities: Token, Position, Portfolio, Snapshot         |
|     Services: PortfolioCalculator, PriceAggregator,        |
|               IlCalculator, YieldAggregator                |
|     Repository Interfaces (IPortfolioRepo)                 |
+------------------------------------------------------------+
                          |
        +-----------------+-----------------+
        |                                   |
        v                                   v
+---------------------------+   +---------------------------+
| Infrastructure: Database  |   | Infrastructure: Web3      |
| Drizzle ORM + PostgreSQL  |   | viem + MulticallBatcher   |
| Snapshot Repo             |   | 3 Protocol Adapters       |
+---------------------------+   | 3 Price Adapters          |
                                +---------------------------+

+------------------------------------------------------------+
|           Indexing Layer (Standalone, cron-triggered)      |
|     getLogs → protocol_events → PostgreSQL                  |
|     12-block confirmation depth | Idempotent | Backfill    |
+------------------------------------------------------------+
```

### Data Flow

```
[Ethereum] ──viem getLogs──> [Indexing Script] ──> [PostgreSQL]
                                                        │
[Browser] ──> [API Route] ──> [Application Service] ────┤
                                  │                      │
                                  v                      v
                            [Domain Logic]         [Price Feeds]
                                  │            Chainlink → Uni V3 → CoinGecko
                                  v
                            [JSON] ──> [Recharts + shadcn/ui]
```

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 16 (App Router) | Full-stack without separate backend maintenance |
| Language | TypeScript (strict) | End-to-end type safety |
| Database | PostgreSQL + Drizzle ORM | SQL control > ORM magic; showcases SQL skills |
| Chain | viem 2.x | Industry standard Ethereum client |
| State | TanStack Query 5 | Dedup + cache + staleTime |
| Validation | Zod | Runtime type safety for all I/O boundaries |
| Styling | Tailwind CSS 4 | Fast iteration, no CSS overhead |
| Charts | Recharts | Lightweight, declarative |
| Testing | Vitest | Fast, native ESM, TS-first |

---

## Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── api/
│   │   ├── portfolio/route.ts  # GET /api/portfolio?wallet=0x...
│   │   └── history/route.ts    # GET /api/history?wallet=0x...&days=30
│   ├── page.tsx                # Dashboard main page
│   ├── layout.tsx
│   └── providers.tsx           # TanStack Query Provider
│
├── application/                # Use Cases + DTOs
│   ├── portfolio/
│   │   ├── get-portfolio.ts    # Orchestrates: fetch → price → calculate
│   │   └── dto.ts              # Zod schemas for request/response
│   └── history/
│       ├── get-history.ts
│       └── dto.ts
│
├── domain/                     # Pure TS, zero framework deps
│   ├── entities/               # Token, Position, Portfolio, Snapshot
│   ├── services/               # PortfolioCalculator, PriceAggregator,
│   │                           #   IlCalculator, YieldAggregator,
│   │                           #   SnapshotService
│   ├── repositories/           # Interfaces (IPortfolioRepo)
│   └── __tests__/              # Domain logic unit tests
│
├── infrastructure/
│   ├── config/env.ts           # Zod-validated env (lazy getEnv)
│   ├── db/
│   │   ├── schema.ts           # Drizzle: 5 tables
│   │   ├── index.ts            # Lazy DB connection (Proxy)
│   │   └── repositories/       # Repository implementations
│   └── web3/
│       ├── client.ts           # viem client with RPC fallback
│       ├── multicall-batcher.ts # Queue-based RPC batching
│       ├── adapters/           # Protocol adapters (Strategy pattern)
│       │   ├── interface.ts    # IProtocolAdapter
│       │   ├── registry.ts     # AdapterRegistry
│       │   ├── lido.ts         # stETH/wstETH staking
│       │   ├── aave-v3.ts      # Lending/borrowing + health factor
│       │   ├── uniswap-v3.ts   # LP positions + tick math
│       │   └── erc20.ts        # Token balance adapter
│       └── prices/             # Price feed adapters
│           ├── interface.ts    # IPriceAdapter
│           ├── chainlink.ts    # Chainlink Price Feeds
│           ├── uniswap-pool.ts # Uniswap V3 slot0 pricing
│           └── coingecko.ts    # CoinGecko API fallback
│
├── indexing/                   # Standalone indexing pipeline
│   ├── index.ts                # Incremental indexer (cron entry)
│   └── backfill.ts             # Historical data backfill
│
├── components/                 # React UI components
│   ├── connect-wallet.tsx
│   ├── portfolio-overview.tsx
│   ├── token-list.tsx
│   ├── positions-list.tsx
│   ├── net-worth-chart.tsx
│   └── health-factor-badge.tsx
│
├── hooks/                      # Custom React hooks
└── lib/                        # Shared utilities
    ├── bigint.ts               # Safe precision conversion
    ├── errors.ts               # Error taxonomy
    ├── timeout.ts              # Promise withTimeout
    └── __tests__/              # Utility tests
```

---

## Database Schema

5 tables, all with compound unique constraints for idempotency:

| Table | Purpose | Idempotency Key |
|-------|---------|-----------------|
| `indexed_blocks` | Last indexed block per chain | `block_number` (PK) |
| `protocol_events` | Raw on-chain event logs | `blockNumber_logIndex_txHash` |
| `token_balances` | ERC20 balance snapshots | `(wallet, chain, token, block)` |
| `positions` | DeFi position snapshots | `(wallet, chain, protocol, positionId, block)` |
| `portfolio_snapshots` | Daily USD net worth | `(wallet, date)` |

---

## Architecture Decision Records (ADR)

### ADR-001: No The Graph — Custom Indexing Pipeline
**Decision**: Write our own TypeScript indexing script instead of using The Graph/Subgraph.

**Rationale**: The Graph requires learning a subgraph DSL, deploying to a hosted service, and adds infrastructure complexity. A custom pipeline with `viem.getLogs` + PostgreSQL demonstrates deeper engineering understanding (idempotency, backfill, reorg handling) and takes less time for the scope of tracked events.

**Tradeoff**: Won't scale to thousands of tracked contracts. For a 2-protocol MVP, this is the right call.

### ADR-002: Clean Architecture with Pure Domain Layer
**Decision**: Domain entities and services have zero framework dependencies. All external calls (RPC, DB, HTTP) live in the infrastructure layer behind interfaces.

**Rationale**: Makes the portfolio calculation engine trivially testable (no mocks needed for domain tests). Demonstrates understanding of hexagonal/clean architecture to interviewers.

**Tradeoff**: More files, more indirection. For a solo MVP, this adds modest overhead with high interview ROI.

### ADR-003: Bigint-All-The-Way for Token Amounts
**Decision**: All on-chain token amounts stay as `bigint` throughout the entire calculation pipeline. Conversion to `number` happens exactly once — at the final `bigintToUsd()` call when multiplying by USD price.

**Rationale**: JavaScript `Number` can only safely represent integers up to 2^53. ERC20 amounts routinely exceed this (e.g., 1000 USDC = 1,000,000,000 with 6 decimals, but 1000 PEPE = 10^21+). Precision errors in financial calculations are unacceptable.

### ADR-004: Three-Tier Price Feed Router
**Decision**: Chainlink → Uniswap V3 Pool → CoinGecko, in that order. First non-null result wins.

**Rationale**: Chainlink provides the most reliable on-chain prices for major assets. Uniswap V3 `slot0.sqrtPriceX96` covers long-tail tokens without Chainlink feeds. CoinGecko is the off-chain last resort for tokens that don't have liquid on-chain pools.

**Tradeoff**: Slightly higher latency (3 sequential lookups per unfound token). Mitigated by the batched approach — all Chainlink prices are fetched in a single multicall, then remaining tokens go to Uniswap, etc.

### ADR-005: 12-Block Confirmation Depth
**Decision**: Indexing pipeline only processes blocks up to `latestBlock - 12` (~2.5 minutes behind tip).

**Rationale**: Ethereum's probabilistic finality means recent blocks can be reorganized. 12 blocks provides practical safety without excessive latency. In production, additionally store recent block hashes for parentHash mismatch detection and automated rollback.

---

## Key Modules (Interview Deep-Dive)

### 1. MulticallBatcher
Queue-based RPC call batching with configurable 50ms window. All chain read requests across the application are merged into a single `multicall` RPC, avoiding HTTP connection exhaustion and rate limiting.

### 2. Protocol Adapter System
Strategy pattern with `IProtocolAdapter` interface. Three implementations covering different position types:
- **Lido**: staking (stETH + wstETH unwrap)
- **Aave V3**: lending + borrowing (with health factor)
- **Uniswap V3**: concentrated liquidity LP (tick math + out-of-range detection)

New protocols require only: implement interface → register in AdapterRegistry.

### 3. Indexing Pipeline
Standalone Node.js script (not in Next.js request path). Incremental block processing with 12-block confirmation depth, idempotent inserts, batch size of 2000 blocks, and backfill support.

### 4. Portfolio Aggregation Engine
Combines wallet token balances + DeFi positions → unified USD portfolio. Handles precision normalization across tokens with 6-18 decimals, routes prices through three-tier feed system, and gracefully degrades when individual adapters fail.

---

## Getting Started

```bash
# 1. Clone and install
git clone <repo-url>
cd dashboard
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in RPC URLs, DB URL, WalletConnect project ID

# 3. Run database migrations
npx drizzle-kit push

# 4. Start dev server
npm run dev

# 5. Run indexing pipeline (separate terminal)
npm run index

# 6. Run tests
npx vitest run
```

---

## Running the Indexing Pipeline

```bash
# Incremental indexing (cron this)
npm run index

# Historical backfill (~30 days)
npm run backfill
```

Deploy via GitHub Actions cron or Vercel Cron Jobs.

---

## License

MIT — This is a portfolio project, not production software.
