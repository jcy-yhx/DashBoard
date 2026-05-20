/**
 * Backfill 脚本 — 用于初次部署时回填历史数据
 *
 * 运行方式: npx tsx src/indexing/backfill.ts
 *
 * 与生产 indexing 的区别:
 * - 更小的 batch size (500 blocks)
 * - 可指定起始区块
 * - 适合离线运行
 */

import { getClient, mainnet } from "@/infrastructure/web3/client";
import { db } from "@/infrastructure/db";
import { protocolEvents } from "@/infrastructure/db/schema";
import { type Address, type Log, parseAbi } from "viem";
import { eq, and, gte, lte } from "drizzle-orm";

const BACKFILL_BATCH = 500;

async function backfillAaveEvents(fromBlock: bigint, toBlock: bigint) {
  const client = getClient(mainnet.id);
  const poolAddress = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2" as Address;

  const supplyEvent = parseAbi([
    "event Supply(address indexed reserve, address indexed user, uint256 amount)",
  ]);

  let inserted = 0;

  for (let start = fromBlock; start < toBlock; start += BigInt(BACKFILL_BATCH)) {
    const end = start + BigInt(BACKFILL_BATCH) - 1n > toBlock
      ? toBlock
      : start + BigInt(BACKFILL_BATCH) - 1n;

    const logs = await client.getLogs({
      address: poolAddress,
      fromBlock: start,
      toBlock: end,
      event: supplyEvent[0],
    });

    for (const log of logs) {
      const id = `${log.blockNumber}_${log.logIndex}_${log.transactionHash}`;
      await db
        .insert(protocolEvents)
        .values({
          id,
          blockNumber: Number(log.blockNumber),
          chainId: mainnet.id,
          txHash: log.transactionHash,
          protocolId: "aave-v3",
          userAddress: log.address,
          eventName: "Supply",
          args: log.args as Record<string, unknown>,
          timestamp: new Date(),
        })
        .onConflictDoNothing();
    }

    inserted += logs.length;
    console.log(`  blocks ${start}-${end}: ${logs.length} Supply events`);
  }

  return inserted;
}

async function main() {
  const client = getClient(mainnet.id);
  const latestBlock = await client.getBlockNumber();

  // Default: backfill last 30 days (~195k blocks on Ethereum)
  const THIRTY_DAYS_BLOCKS = 195_000n;
  const fromBlock = latestBlock - THIRTY_DAYS_BLOCKS;

  console.log(`Backfill: Aave V3 Supply events from block ${fromBlock} to ${latestBlock}\n`);

  const inserted = await backfillAaveEvents(fromBlock, latestBlock);
  console.log(`\nBackfill complete: ${inserted} total events`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
