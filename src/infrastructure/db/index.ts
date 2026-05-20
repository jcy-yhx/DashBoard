import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/infrastructure/config/env";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (_db) return _db;

  const env = getEnv();
  const queryClient = postgres(env.DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
  });

  _db = drizzle(queryClient, { schema });
  return _db;
}

// Lazy shorthand — only touches getEnv() when a property is actually accessed.
// Prevents build-time crash for API routes that import db but aren't executed.
function lazyDb(): ReturnType<typeof drizzle<typeof schema>> {
  return getDb();
}

export const db: ReturnType<typeof drizzle<typeof schema>> = new Proxy(
  {} as ReturnType<typeof drizzle<typeof schema>>,
  {
    get(_, prop: string | symbol) {
      const real = lazyDb();
      const target = real as unknown as Record<string | symbol, unknown>;
      const value = target[prop];
      if (typeof value === "function") {
        return value.bind(real);
      }
      return value;
    },
  },
);

export { schema };
