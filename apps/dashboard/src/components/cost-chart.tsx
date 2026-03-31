'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface CostChartProps {
  data: { date: string; cost: number }[];
}

export function CostChart({ data }: CostChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        No data for the last 7 days
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          tickFormatter={(v: string) => v.slice(5)}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          tickFormatter={(v: number) => `$${v.toFixed(2)}`}
        />
        <Tooltip
          formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
          labelFormatter={(label: string) => label}
        />
        <Line
          type="monotone"
          dataKey="cost"
          stroke="#00D084"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
