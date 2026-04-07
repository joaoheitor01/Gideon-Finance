import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useInvestments, INVESTMENT_TYPES } from "@/hooks/useInvestments";
import { useStockQuote } from "@/hooks/useStockQuote";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/formatters";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  Trash2,
  Edit,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

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

const DEFAULT_FORM = {
  name: "",
  type: "Ações" as string,
  quantity: "",
  purchase_price: "",
  current_price: "",
  purchase_date: new Date().toISOString().split("T")[0],
};

export default function Investments() {
  const { investments, loading, addInvestment, deleteInvestment, updateCurrentPrice, refreshPrices } = useInvestments();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [priceEditId, setPriceEditId] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [priceDirty, setPriceDirty] = useState(false);
  const [updatingPrices, setUpdatingPrices] = useState(false);
  const [form, setForm] = useState({ ...DEFAULT_FORM });

  const quantityAsTrigger = form.quantity && !isNaN(parseFloat(form.quantity.replace(",", ".")))
    ? parseFloat(form.quantity.replace(",", "."))
    : null;

  const quote = useStockQuote(
    priceDirty ? "" : form.name,
    priceDirty ? null : quantityAsTrigger,
  );

  // Reset form when dialog closes
  useEffect(() => {
    if (!dialogOpen) {
      setForm({ ...DEFAULT_FORM });
      setPriceDirty(false);
    }
  }, [dialogOpen]);

  // Sync fetched price to form
  useEffect(() => {
    if (quote.status === "success" && quote.price != null && !priceDirty) {
      const priceStr = quote.price.toFixed(2);
      setForm((prev) => ({
        ...prev,
        purchase_price: priceStr,
        current_price: priceStr,
      }));
    }
  }, [quote.price, quote.status, priceDirty]);

  const canSubmit = (() => {
    if (!form.name.trim() || !form.quantity || !form.purchase_price) return false;
    const qty = parseFloat(form.quantity.replace(",", "."));
    const prc = parseFloat(form.purchase_price.replace(",", "."));
    if (isNaN(qty) || isNaN(prc) || prc <= 0 || qty <= 0) return false;
    if (quote.status === "error") return false;
    if (quote.status === "fetching" && !form.purchase_price) return false;
    return true;
  })();

  const handleAddInvestment = async () => {
    if (!canSubmit) return;

    const quantityParsed = parseFloat(form.quantity.replace(",", "."));
    const purchaseParsed = parseFloat(form.purchase_price.replace(",", "."));
    const currentParsed = form.current_price ? parseFloat(form.current_price.replace(",", ".")) : purchaseParsed;

    const { error } = await addInvestment({
      name: form.name,
      type: form.type,
      quantity: quantityParsed,
      purchase_price: purchaseParsed,
      current_price: currentParsed || purchaseParsed,
      purchase_date: form.purchase_date,
    });

    if (!error) {
      setDialogOpen(false);
    }
  };

  const handleUpdatePrice = async (id: string) => {
    if (!newPrice) return;
    const price = parseFloat(newPrice.replace(",", "."));
    if (isNaN(price)) return;

    const { error } = await updateCurrentPrice(id, price);
    if (!error) {
      setPriceEditId(null);
      setNewPrice("");
    }
  };

  // Totals
  const totalInvested = investments.reduce((sum, i) => sum + i.purchase_price * i.quantity, 0);
  const totalCurrent = investments.reduce((sum, i) => sum + i.current_price * i.quantity, 0);
  const totalProfit = totalCurrent - totalInvested;
  const totalProfitPercent = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  // Chart data
  const categoryData = (() => {
    const map: Record<string, number> = {};
    investments.forEach((i) => {
      map[i.type] = (map[i.type] || 0) + i.current_price * i.quantity;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  })();

  const profitData = investments
    .map((i) => ({
      name: i.name.length > 12 ? i.name.slice(0, 12) + "..." : i.name,
      investido: i.purchase_price * i.quantity,
      atual: i.current_price * i.quantity,
    }))
    .slice(0, 8);

  const getProfitability = (investment: (typeof investments)[0]) => {
    const invested = investment.purchase_price * investment.quantity;
    const current = investment.current_price * investment.quantity;
    const diff = current - invested;
    const pct = invested > 0 ? diff / invested : 0;
    return { diff, pct };
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="animate-pulse text-muted-foreground">
            Carregando investimentos...
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Investimentos</h2>
            <p className="text-muted-foreground">Acompanhe sua carteira de investimentos</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={investments.length === 0 || loading}
              onClick={async () => {
                setUpdatingPrices(true);
                await refreshPrices();
                setUpdatingPrices(false);
              }}
            >
              <RefreshCw className={`h-4 w-4 ${updatingPrices ? "animate-spin" : ""}`} />
              Atualizar Cotações
            </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Investimento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Investimento</DialogTitle>
                <DialogDescription>
                  Preencha os dados do novo investimento.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Ativo (Ticker)</Label>
                  <div className="relative">
                    <Input
                      placeholder="Ex: PETR4, MXRF11, BTC"
                      value={form.name}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, name: e.target.value }));
                        if (priceDirty) setPriceDirty(false);
                      }}
                      className={quote.status === "error" ? "border-destructive pr-9" : ""}
                      autoCapitalize="characters"
                    />
                    {quote.status === "fetching" && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {quote.status === "success" && quote.price != null && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                    )}
                    {quote.status === "error" && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                    )}
                  </div>
                  {quote.status === "error" && quote.errorMessage && (
                    <p className="mt-1.5 text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {quote.errorMessage}
                    </p>
                  )}
                  {quote.status === "success" && (
                    <p className="mt-1.5 text-xs text-primary flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {quote.shortName || quote.normalizedTicker} — R$ {quote.price?.toFixed(2)}
                      {quote.changePercent != null && (
                        <span className={quote.changePercent >= 0 ? "text-primary" : "text-destructive"}>
                          ({quote.changePercent >= 0 ? "+" : ""}{quote.changePercent.toFixed(2)}%)
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INVESTMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Quantidade</Label>
                    <Input
                      type="text"
                      placeholder="0"
                      value={form.quantity}
                      onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Data Compra</Label>
                    <Input
                      type="date"
                      value={form.purchase_date}
                      onChange={(e) => setForm((p) => ({ ...p, purchase_date: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Preço Compra</Label>
                    <Input
                      type="text"
                      placeholder="0,00"
                      value={form.purchase_price}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, purchase_price: e.target.value }));
                        setPriceDirty(true);
                      }}
                    />
                  </div>
                  <div>
                    <Label>Preço Atual</Label>
                    <Input
                      type="text"
                      placeholder="0,00"
                      value={form.current_price}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, current_price: e.target.value }));
                        setPriceDirty(true);
                      }}
                    />
                  </div>
                </div>

                {form.quantity && form.purchase_price ? (() => {
                  const qtd = parseFloat(form.quantity.replace(",", "."));
                  const price = parseFloat(form.purchase_price.replace(",", "."));
                  if (isNaN(qtd) || isNaN(price) || price <= 0) return null;
                  return (
                    <p className="text-sm font-medium text-foreground">
                      Total investido: {formatCurrency(qtd * price)}
                    </p>
                  );
                })() : null}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleAddInvestment} disabled={!canSubmit}>
                  Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Investido</CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(totalInvested)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm text-muted-foreground">
                <DollarSign className="mr-1 h-4 w-4" />
                Valor total de compra
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Valor Atual</CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(totalCurrent)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm text-muted-foreground">
                <DollarSign className="mr-1 h-4 w-4" />
                Valor atualizado
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Resultado</CardDescription>
              <CardTitle className={`text-2xl flex items-center gap-2 ${totalProfit >= 0 ? "text-primary" : "text-destructive"}`}>
                {totalProfit >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                {formatCurrency(totalProfit)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm">
                <Badge variant={totalProfit >= 0 ? "default" : "destructive"}>
                  {totalProfitPercent >= 0 ? "+" : ""}{totalProfitPercent.toFixed(2)}%
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        {investments.length > 0 ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Distribuição por Tipo</CardTitle>
                <CardDescription>Alocação da sua carteira</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={60}
                        dataKey="value"
                        isAnimationActive={true}
                        animationDuration={800}
                      >
                        {categoryData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value: number) => formatCurrency(value)}
                        itemStyle={{ color: "hsl(var(--foreground))" }}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {categoryData.map((cat, i) => (
                    <div key={cat.name} className="flex items-center gap-2 text-sm">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-muted-foreground">{cat.name}</span>
                      <span className="ml-auto font-medium">{formatCurrency(cat.value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Investido vs Atual</CardTitle>
                <CardDescription>Comparativo por investimento</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={profitData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                        tickFormatter={(v) =>
                          new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(v)
                        }
                      />
                      <RechartsTooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="investido" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} name="Investido" />
                      <Bar dataKey="atual" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} name="Valor Atual" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Investment List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Minha Carteira
            </CardTitle>
            <CardDescription>
              {investments.length} investimento{investments.length !== 1 ? "s" : ""} registrado{investments.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {investments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 rounded-full bg-secondary p-4">
                  <TrendingUp className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  Nenhum investimento registrado
                </h3>
                <p className="mt-1 text-muted-foreground">
                  Adicione seu primeiro investimento para começar a acompanhar.
                </p>
                <Button className="mt-4 gap-2" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Adicionar Investimento
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-muted-foreground">
                      <th className="p-3 font-medium">Ativo</th>
                      <th className="p-3 font-medium">Tipo</th>
                      <th className="p-3 font-medium text-right">Qtd</th>
                      <th className="p-3 font-medium text-right">Preço Compra</th>
                      <th className="p-3 font-medium text-right">Preço Atual</th>
                      <th className="p-3 font-medium text-right">Valor Atual</th>
                      <th className="p-3 font-medium text-right">Rendimento</th>
                      <th className="p-3 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {investments.map((inv) => {
                      const { diff, pct } = getProfitability(inv);
                      const currentValue = inv.current_price * inv.quantity;
                      return (
                        <tr key={inv.id} className="border-b last:border-0">
                          <td className="p-3 font-medium text-foreground">{inv.name}</td>
                          <td className="p-3">
                            <Badge variant="secondary">{inv.type}</Badge>
                          </td>
                          <td className="p-3 text-right">{inv.quantity}</td>
                          <td className="p-3 text-right">{formatCurrency(inv.purchase_price)}</td>
                          <td className="p-3 text-right">
                            {priceEditId === inv.id ? (
                              <div className="flex items-center gap-1 justify-end">
                                <Input
                                  className="h-7 w-24 text-right"
                                  value={newPrice}
                                  onChange={(e) => setNewPrice(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleUpdatePrice(inv.id);
                                    if (e.key === "Escape") setPriceEditId(null);
                                  }}
                                  autoFocus
                                  placeholder="0,00"
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() => handleUpdatePrice(inv.id)}
                                >
                                  <ArrowUpRight className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                {formatCurrency(inv.current_price)}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-5 w-5 p-0"
                                  onClick={() => {
                                    setPriceEditId(inv.id);
                                    setNewPrice(inv.current_price.toString());
                                  }}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right font-medium">{formatCurrency(currentValue)}</td>
                          <td className="p-3 text-right">
                            <div className="flex items-center gap-1 justify-end">
                              {diff >= 0 ? (
                                <ArrowUpRight className="h-4 w-4 text-primary" />
                              ) : (
                                <ArrowDownRight className="h-4 w-4 text-destructive" />
                              )}
                              <span className={diff >= 0 ? "text-primary font-medium" : "text-destructive font-medium"}>
                                {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir investimento?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Essa ação não pode ser desfeita. Isso irá deletar permanentemente seu investimento "{inv.name}".
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteInvestment(inv.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-bold">
                      <td colSpan={5} className="p-3 text-right text-foreground">Total:</td>
                      <td className="p-3 text-right text-foreground">{formatCurrency(totalCurrent)}</td>
                      <td className={`p-3 text-right ${totalProfit >= 0 ? "text-primary" : "text-destructive"}`}>
                        {totalProfit >= 0 ? "+" : ""}{totalProfitPercent.toFixed(2)}%
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {investments.length > 0 && (
              <>
                <Separator className="my-4" />
                <div className="flex flex-wrap gap-2">
                  {categoryData.map((cat, i) => (
                    <div key={cat.name} className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-sm">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-muted-foreground">{cat.name}:</span>
                      <span className="font-medium">{formatCurrency(cat.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
