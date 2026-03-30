'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ModelBarChartProps {
  data: { name: string; cost: number }[];
}

export function ModelBarChart({ data }: ModelBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        No model data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ left: 100 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          type="number"
          tickFormatter={(v: number) => `$${v.toFixed(2)}`}
          tick={{ fontSize: 12 }}
        />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
        <Tooltip formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']} />
        <Bar dataKey="cost" fill="hsl(220, 70%, 50%)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
