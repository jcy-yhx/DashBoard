/**
 * Safely convert a bigint token amount to a decimal string using the token's decimals.
 * Never use Number(balance) — always route through this utility.
 */

export function fromTokenDecimals(
  amount: bigint,
  decimals: number,
): string {
  const amountStr = amount.toString();
  if (amountStr.length <= decimals) {
    const padded = amountStr.padStart(decimals, "0");
    return `0.${padded}`.replace(/\.?0+$/, "") || "0";
  }
  const integerPart = amountStr.slice(0, amountStr.length - decimals);
  const fractionalPart = amountStr.slice(amountStr.length - decimals);
  return `${integerPart}.${fractionalPart}`.replace(/\.?0+$/, "") || "0";
}

export function toTokenDecimals(
  amount: string,
  decimals: number,
): bigint {
  const [integer = "0", fractional = ""] = amount.split(".");
  if (!integer || !/^\d+$/.test(integer)) {
    throw new Error(`Invalid amount: ${amount}`);
  }
  const paddedFractional = fractional.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(integer + paddedFractional);
}

export function bigintToUsd(amount: bigint, decimals: number, priceUsd: number): number {
  const decimalStr = fromTokenDecimals(amount, decimals);
  return parseFloat(decimalStr) * priceUsd;
}
