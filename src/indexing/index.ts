/**
 * Indexing Pipeline — 独立 Node.js 脚本
 *
 * 运行方式: npx tsx src/indexing/index.ts
 * 部署: GitHub Actions cron / Vercel Cron
 *
 * 核心逻辑:
 * 1. 查 indexed_blocks 获取上次同步位置
 * 2. 从上次位置 +1 开始，增量拉到 latestBlock - CONFIRMATION_BLOCKS
 * 3. 批量写入 protocol_events（幂等: ON CONFLICT DO NOTHING）
 * 4. 更新 indexed_blocks
 */

import { getClient, mainnet } from "@/infrastructure/web3/client";
import { db } from "@/infrastructure/db";
import { indexedBlocks, protocolEvents } from "@/infrastructure/db/schema";
import { eq, desc } from "drizzle-orm";
import { type Address, type Log } from "viem";

const CONFIRMATION_BLOCKS = 12;
const BATCH_SIZE = 2000;

const TRACKED_ADDRESSES: Array<{
  protocolId: string;
  chainId: number;
  address: Address;
}> = [
  {
    protocolId: "aave-v3",
    chainId: mainnet.id,
    address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
  },
  {
    protocolId: "uniswap-v3",
    chainId: mainnet.id,
    address: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
  },
];

async function getLastIndexedBlock(chainId: number): Promise<bigint | null> {
  const [row] = await db
    .select()
    .from(indexedBlocks)
    .where(eq(indexedBlocks.chainId, chainId))
    .orderBy(desc(indexedBlocks.blockNumber))
    .limit(1);

  return row ? BigInt(row.blockNumber) : null;
}

async function setIndexedBlock(chainId: number, blockNumber: bigint): Promise<void> {
  await db
    .insert(indexedBlocks)
    .values({
      blockNumber: Number(blockNumber),
      chainId,
      indexedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: indexedBlocks.blockNumber,
      set: { indexedAt: new Date() },
    });
}

async function saveEvents(
  logs: Log[],
  protocolId: string,
  chainId: number,
): Promise<number> {
  let inserted = 0;

  for (const log of logs) {
    const id = `${log.blockNumber}_${log.logIndex}_${log.transactionHash}`;

    try {
      await db
        .insert(protocolEvents)
        .values({
          id,
          blockNumber: Number(log.blockNumber),
          chainId,
          txHash: log.transactionHash ?? "0x",
          protocolId,
          userAddress: log.address,
          eventName: "Event",
          args: { topics: log.topics, data: log.data },
          timestamp: new Date(),
        })
        .onConflictDoNothing();

      inserted++;
    } catch {
      // Skip duplicates
    }
  }

  return inserted;
}

async function indexAddress(
  protocolId: string,
  chainId: number,
  address: Address,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<number> {
  const client = getClient(chainId as 1 | 42161);
  let totalInserted = 0;

  for (let start = fromBlock; start < toBlock; start += BigInt(BATCH_SIZE)) {
    const end = start + BigInt(BATCH_SIZE) - 1n < toBlock
      ? start + BigInt(BATCH_SIZE) - 1n
      : toBlock;

    const logs = await client.getLogs({
      address,
      fromBlock: start,
      toBlock: end,
    });

    if (logs.length > 0) {
      totalInserted += await saveEvents(logs, protocolId, chainId);
    }

    console.log(`  [${protocolId}] blocks ${start}-${end}: ${logs.length} events`);
  }

  return totalInserted;
}

async function main() {
  console.log("Indexing Pipeline — starting...\n");

  const client = getClient(mainnet.id);
  const latestBlock = await client.getBlockNumber();
  const safeBlock = latestBlock - BigInt(CONFIRMATION_BLOCKS);

  for (const cfg of TRACKED_ADDRESSES) {
    const lastBlock = await getLastIndexedBlock(cfg.chainId);
    const fromBlock = lastBlock ? lastBlock + 1n : (safeBlock > 1000n ? safeBlock - 1000n : 0n);

    if (fromBlock >= safeBlock) {
      console.log(`  [${cfg.protocolId}] up to date`);
      continue;
    }

    console.log(`  [${cfg.protocolId}] indexing ${fromBlock} → ${safeBlock}`);
    const inserted = await indexAddress(
      cfg.protocolId,
      cfg.chainId,
      cfg.address,
      fromBlock,
      safeBlock,
    );
    await setIndexedBlock(cfg.chainId, safeBlock);
    console.log(`  [${cfg.protocolId}] done: ${inserted} new events\n`);
  }

  console.log("Indexing complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Indexing failed:", err);
  process.exit(1);
});
