import { z } from "zod";

const envSchema = z.object({
  RPC_URL_ETHEREUM: z.string().url(),
  RPC_URL_ETHEREUM_FALLBACK: z.string().url(),
  RPC_URL_ARBITRUM: z.string().url(),
  RPC_URL_ARBITRUM_FALLBACK: z.string().url(),
  DATABASE_URL: z.string().url(),
  COINGECKO_API_KEY: z.string().optional(),
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (_env) return _env;

  const parsed = envSchema.safeParse({
    RPC_URL_ETHEREUM: process.env.RPC_URL_ETHEREUM,
    RPC_URL_ETHEREUM_FALLBACK: process.env.RPC_URL_ETHEREUM_FALLBACK,
    RPC_URL_ARBITRUM: process.env.RPC_URL_ARBITRUM,
    RPC_URL_ARBITRUM_FALLBACK: process.env.RPC_URL_ARBITRUM_FALLBACK,
    DATABASE_URL: process.env.DATABASE_URL,
    COINGECKO_API_KEY: process.env.COINGECKO_API_KEY,
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  });

  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.issues);
    throw new Error("Invalid environment configuration");
  }

  _env = parsed.data;
  return _env;
}
