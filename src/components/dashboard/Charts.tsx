import { useMemo } from "react";
import { Transaction } from "@/hooks/useTransactions";
import { MONTHS } from "@/lib/formatters";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface ChartsProps {
  transactions: Transaction[];
  selectedYear: number;
}

const COLORS = [
  "hsl(160, 84%, 39%)",
  "hsl(200, 70%, 50%)",
  "hsl(280, 70%, 50%)",
  "hsl(30, 80%, 55%)",
  "hsl(350, 70%, 50%)",
  "hsl(120, 60%, 45%)",
  "hsl(45, 90%, 55%)",
  "hsl(180, 60%, 45%)",
  "hsl(240, 60%, 55%)",
];

export function Charts({ transactions, selectedYear }: ChartsProps) {
  const barData = useMemo(() => {
    const data = MONTHS.map((month, index) => ({
      month: month.slice(0, 3),
      entradas: 0,
      saidas: 0,
    }));

    transactions
      .filter((t) => {
        const date = new Date(t.date + "T00:00:00");
        return date.getFullYear() === selectedYear;
      })
      .forEach((t) => {
        const date = new Date(t.date + "T00:00:00");
        const month = date.getMonth();
        if (t.type === "entrada") {
          data[month].entradas += Number(t.amount);
        } else {
          data[month].saidas += Number(t.amount);
        }
      });

    return data;
  }, [transactions, selectedYear]);

  const pieData = useMemo(() => {
    const categoryTotals: Record<string, number> = {};

    transactions
      .filter((t) => {
        const date = new Date(t.date + "T00:00:00");
        return date.getFullYear() === selectedYear && t.type === "saida";
      })
      .forEach((t) => {
        categoryTotals[t.category] =
          (categoryTotals[t.category] || 0) + Number(t.amount);
      });

    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, selectedYear]);

  // Componente personalizado para os labels brancos
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    name,
  }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 1.3;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
        style={{
          textShadow: "1px 1px 3px rgba(0, 0, 0, 0.8)",
          filter: "drop-shadow(1px 1px 2px rgba(0,0,0,0.8))",
        }}
      >
        {`${name} (${(percent * 100).toFixed(0)}%)`}
      </text>
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-lg border border-border bg-card p-6 animate-fade-in">
        <h3 className="mb-4 font-semibold text-foreground">
          Entradas vs Saídas por Mês
        </h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                tickFormatter={(value) =>
                  new Intl.NumberFormat("pt-BR", {
                    notation: "compact",
                    compactDisplay: "short",
                  }).format(value)
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number) =>
                  new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(value)
                }
              />
              <Bar dataKey="entradas" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saidas" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
        <h3 className="mb-4 font-semibold text-foreground">
          Gastos por Categoria
        </h3>
        <div className="h-[300px]">
          {pieData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Sem gastos registrados
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                  label={renderCustomizedLabel}
                  labelLine={false}
                  isAnimationActive={true}
                  animationDuration={800}
                >
                  {pieData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                      stroke="hsl(var(--border))"
                      strokeWidth={1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                    fontSize: "14px",
                  }}
                  itemStyle={{
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value: number) => [
                    new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(value),
                    "Valor",
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}