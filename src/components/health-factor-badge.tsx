"use client";

interface HealthFactorBadgeProps {
  healthFactor?: number | null;
  className?: string;
}

function getHealthStatus(hf: number): { label: string; color: string; bg: string } {
  if (hf >= 3) return { label: "Safe", color: "text-green-400", bg: "bg-green-500/10" };
  if (hf >= 1.5) return { label: "Moderate", color: "text-yellow-400", bg: "bg-yellow-500/10" };
  if (hf >= 1.0) return { label: "Risky", color: "text-orange-400", bg: "bg-orange-500/10" };
  return { label: "Liquidation", color: "text-red-400", bg: "bg-red-500/10" };
}

export function HealthFactorBadge({ healthFactor, className = "" }: HealthFactorBadgeProps) {
  if (healthFactor === null || healthFactor === undefined) return null;

  const status = getHealthStatus(healthFactor);

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status.color.replace("text-", "bg-")}`} />
      Health: {healthFactor.toFixed(2)} — {status.label}
    </div>
  );
}
