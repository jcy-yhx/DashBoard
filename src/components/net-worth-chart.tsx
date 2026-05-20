"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface NetWorthChartProps {
  wallet: string;
}

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export function NetWorthChart({ wallet }: NetWorthChartProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["history", wallet],
    queryFn: async () => {
      const res = await fetch(`/api/history?wallet=${wallet}&days=30`);
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
    enabled: !!wallet,
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-card-border bg-card p-6">
        <div className="h-64 bg-gray-800/50 animate-pulse rounded-lg" />
      </div>
    );
  }

  if (error || !data?.snapshots?.length) {
    return (
      <div className="rounded-xl border border-card-border bg-card p-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Net Worth History
        </h3>
        <p className="text-gray-500 text-sm py-8 text-center">
          No historical data available yet. Snapshot data will appear here.
        </p>
      </div>
    );
  }

  const chartData = data.snapshots.map((s: { date: string; totalUsd: number }) => ({
    date: new Date(s.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    value: s.totalUsd,
  }));

  return (
    <div className="rounded-xl border border-card-border bg-card p-6">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
        Net Worth History
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#6b7280", fontSize: 12 }}
              axisLine={{ stroke: "#1e1e2e" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#6b7280", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatUsd}
              width={60}
            />
            <Tooltip
              contentStyle={{
                background: "#12121a",
                border: "1px solid #1e1e2e",
                borderRadius: "8px",
                fontSize: "14px",
              }}
              labelStyle={{ color: "#6b7280" }}
              formatter={(value: number) => [formatUsd(value), "Portfolio Value"]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#8b5cf6"
              strokeWidth={2}
              fill="url(#gradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
