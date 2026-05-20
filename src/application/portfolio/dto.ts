import { z } from "zod";

export const portfolioQuerySchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  chainId: z.coerce.number().optional().default(1),
});

export type PortfolioQuery = z.infer<typeof portfolioQuerySchema>;

// Response DTO: converts bigint → string for JSON serialization
const tokenDto = z.object({
  address: z.string(),
  chainId: z.number(),
  symbol: z.string(),
  name: z.string(),
  decimals: z.number(),
});

const tokenBalanceDto = z.object({
  token: tokenDto,
  balance: z.string(), // bigint serialized
  valueInUsd: z.number().nullable(),
});

const protocolPositionDto = z.object({
  protocolId: z.string(),
  chainId: z.number(),
  positionId: z.string(),
  type: z.enum(["lending", "borrowing", "lp", "staking"]),
  underlyingTokens: z.array(
    z.object({
      token: tokenDto,
      amount: z.string(),
      valueInUsd: z.number().nullable(),
    }),
  ),
});

const allocationItem = z.object({
  symbol: z.string().optional(),
  protocolId: z.string().optional(),
  valueUsd: z.number(),
  percentage: z.number(),
});

export const portfolioResponseDto = z.object({
  wallet: z.string(),
  totalUsd: z.number(),
  snapshotTimestamp: z.string(),
  tokenBalances: z.array(tokenBalanceDto),
  positions: z.array(protocolPositionDto),
  allocationByToken: z.array(
    z.object({ symbol: z.string(), valueUsd: z.number(), percentage: z.number() }),
  ),
  allocationByProtocol: z.array(
    z.object({ protocolId: z.string(), valueUsd: z.number(), percentage: z.number() }),
  ),
});

export type PortfolioResponse = z.infer<typeof portfolioResponseDto>;
