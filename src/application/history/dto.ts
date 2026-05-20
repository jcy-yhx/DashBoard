import { z } from "zod";

export const historyQuerySchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  days: z.coerce.number().min(1).max(365).optional().default(30),
});

export const historyResponseDto = z.object({
  wallet: z.string(),
  snapshots: z.array(
    z.object({
      date: z.string(),
      totalUsd: z.number(),
    }),
  ),
});

export type HistoryQuery = z.infer<typeof historyQuerySchema>;
export type HistoryResponse = z.infer<typeof historyResponseDto>;
