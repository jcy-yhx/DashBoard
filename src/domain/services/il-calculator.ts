/**
 * Impermanent Loss estimation for Uniswap-style AMM LP positions.
 *
 * IL(t) = 2 * sqrt(r) / (1 + r) - 1
 * where r = price_ratio = current_price / entry_price
 *
 * This is an approximation that assumes constant-product AMM (Uni V2-style).
 * For Uniswap V3 concentrated positions, actual IL is amplified by leverage
 * factor = (sqrtPriceU - sqrtPriceL) / (sqrtPriceU - sqrtPriceL - (amount1/amount0)P * ...)
 * We provide a simplified estimate suitable for dashboard display.
 */

export interface IlEstimate {
  entryPriceRatio: number;
  currentPriceRatio: number;
  ilPercent: number;       // negative = loss
  ilValueUsd: number;      // dollar value of the IL
  isOutOfRange: boolean;   // if position is out of range, IL is "locked in"
}

// V2-style IL: IL = 2*sqrt(r)/(1+r) - 1
// where r = price_1/price_0 ratio change
export function calculateV2Il(priceRatioChange: number): number {
  const sqrtR = Math.sqrt(priceRatioChange);
  return (2 * sqrtR) / (1 + priceRatioChange) - 1;
}

// Estimate IL for a V3 position based on tick range concentration.
// When out of range, IL approaches the V2 IL for the full range.
export function calculateIlEstimate(
  entryToken0Amount: number,
  entryToken1Amount: number,
  token0PriceUsd: number,
  token1PriceUsd: number,
  currentToken0Amount: number,
  currentToken1Amount: number,
  isOutOfRange: boolean,
): IlEstimate {
  const entryRatio = (entryToken1Amount * token1PriceUsd) / (entryToken0Amount * token0PriceUsd || 1);
  const currentRatio = (currentToken1Amount * token1PriceUsd) / (currentToken0Amount * token0PriceUsd || 1);

  const entryValueUsd = entryToken0Amount * token0PriceUsd + entryToken1Amount * token1PriceUsd;
  const currentValueUsd = currentToken0Amount * token0PriceUsd + currentToken1Amount * token1PriceUsd;

  const holdValueUsd = entryToken0Amount * token0PriceUsd + entryToken1Amount * token1PriceUsd;
  const ilValueUsd = currentValueUsd - holdValueUsd;

  const ilPercent = entryValueUsd > 0 ? (ilValueUsd / entryValueUsd) * 100 : 0;

  return {
    entryPriceRatio: entryRatio,
    currentPriceRatio: currentRatio,
    ilPercent: Math.round(ilPercent * 100) / 100,
    ilValueUsd: Math.round(ilValueUsd * 100) / 100,
    isOutOfRange,
  };
}
