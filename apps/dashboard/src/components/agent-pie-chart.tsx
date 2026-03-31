'use client';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const COLORS = [
  '#00D084',
  '#5B8DEF',
  '#F5A623',
  '#BD6BD9',
  '#EF5B5B',
  '#36D1DC',
];

interface AgentPieChartProps {
  data: { name: string; value: number }[];
}

export function AgentPieChart({ data }: AgentPieChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        No agent data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          outerRadius={80}
          dataKey="value"
          label={({ name, percent }: { name: string; percent: number }) =>
            `${name} (${(percent * 100).toFixed(0)}%)`
          }
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
