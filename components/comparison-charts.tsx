import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const tick = (value: unknown) => `${Math.round(Number(value) / 1000).toLocaleString('pt-BR')} mil`;

export function MarginChart({ rows }: { rows: { name: string; value: number }[] }) {
  return <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1} initialDimension={{ width: 800, height: 360 }}>
    <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 18, top: 4, bottom: 4 }}>
      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#dce5d9" />
      <XAxis type="number" tickFormatter={tick} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
      <YAxis type="category" dataKey="name" width={128} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
      <Tooltip cursor={{ fill: '#edf3e8' }} formatter={value => [money(Number(value)), 'Margem/ha']} />
      <ReferenceLine x={0} stroke="#9aa99c" />
      <Bar dataKey="value" fill="#2f6b45" radius={[0, 6, 6, 0]} isAnimationActive={false} />
    </BarChart>
  </ResponsiveContainer>;
}

export function StressChart({ rows }: { rows: { name: string; low: number; base: number; high: number }[] }) {
  return <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1} initialDimension={{ width: 800, height: 380 }}>
    <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 18, top: 4, bottom: 4 }}>
      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#dce5d9" />
      <XAxis type="number" tickFormatter={tick} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
      <YAxis type="category" dataKey="name" width={128} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
      <Tooltip cursor={{ fill: '#edf3e8' }} formatter={(value, name) => [money(Number(value)), name === 'low' ? 'Inferior' : name === 'base' ? 'Central' : 'Superior']} />
      <ReferenceLine x={0} stroke="#9aa99c" />
      <Bar dataKey="low" fill="#d6a14b" radius={[0, 4, 4, 0]} isAnimationActive={false} />
      <Bar dataKey="base" fill="#2f6b45" radius={[0, 4, 4, 0]} isAnimationActive={false} />
      <Bar dataKey="high" fill="#9fbd3e" radius={[0, 4, 4, 0]} isAnimationActive={false} />
    </BarChart>
  </ResponsiveContainer>;
}
