import { pgTable, serial, text, bigint, integer, timestamp, doublePrecision, date, jsonb, unique } from "drizzle-orm/pg-core";

export const indexedBlocks = pgTable("indexed_blocks", {
  blockNumber: bigint("block_number", { mode: "number" }).primaryKey(),
  chainId: integer("chain_id").notNull().default(1),
  indexedAt: timestamp("indexed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const protocolEvents = pgTable("protocol_events", {
  id: text("id").primaryKey(), // {blockNumber}_{logIndex}_{txHash}
  blockNumber: bigint("block_number", { mode: "number" }).notNull(),
  chainId: integer("chain_id").notNull().default(1),
  txHash: text("tx_hash").notNull(),
  protocolId: text("protocol_id").notNull(),
  userAddress: text("user_address").notNull(),
  eventName: text("event_name").notNull(),
  args: jsonb("args").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
});

export const tokenBalances = pgTable("token_balances", {
  id: serial("id").primaryKey(),
  wallet: text("wallet").notNull(),
  chainId: integer("chain_id").notNull().default(1),
  tokenAddress: text("token_address").notNull(),
  symbol: text("symbol").notNull(),
  decimals: integer("decimals").notNull(),
  balance: text("balance").notNull(), // decimal string for full precision
  blockNumber: bigint("block_number", { mode: "number" }).notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
}, (table) => ({
  uniq: unique().on(table.wallet, table.chainId, table.tokenAddress, table.blockNumber),
}));

export const positions = pgTable("positions", {
  id: serial("id").primaryKey(),
  wallet: text("wallet").notNull(),
  chainId: integer("chain_id").notNull().default(1),
  protocolId: text("protocol_id").notNull(),
  positionId: text("position_id").notNull(),
  type: text("type").notNull(),
  underlyingTokens: jsonb("underlying_tokens").notNull(),
  extraData: jsonb("extra_data"),
  blockNumber: bigint("block_number", { mode: "number" }).notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
}, (table) => ({
  uniq: unique().on(table.wallet, table.chainId, table.protocolId, table.positionId, table.blockNumber),
}));

export const portfolioSnapshots = pgTable("portfolio_snapshots", {
  id: serial("id").primaryKey(),
  wallet: text("wallet").notNull(),
  date: date("date").notNull(),
  totalUsd: doublePrecision("total_usd").notNull(),
  breakdown: jsonb("breakdown").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniq: unique().on(table.wallet, table.date),
}));
