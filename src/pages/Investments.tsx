import { useState, useEffect, useRef, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useInvestments, INVESTMENT_TYPE_MAP, INVESTMENT_TYPE_VALUES } from "@/hooks/useInvestments";
import useTickerSearch, { TickerResult } from "@/hooks/useTickerSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Loader2, Search } from "lucide-react";
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
import { fetchHistoricalPrice } from "@/lib/marketApi";
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
  type: "acao", // Valor do banco, não label
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
  const [showDropdown, setShowDropdown] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [showRealTimeMsg, setShowRealTimeMsg] = useState(false);

  const {
    getQuote,
    loading: tickerLoading,
    results,
    searchQuery,
    setSearchQuery,
  } = useTickerSearch();

  // Efeito: reseta formulário quando dialog fecha
  useEffect(() => {
    if (!dialogOpen) {
      setForm({ ...DEFAULT_FORM });
      setPriceDirty(false);
      setShowDropdown(false);
      setQuoteError(null);
      setShowRealTimeMsg(false);
      setSearchQuery("");
    }
  }, [dialogOpen, setSearchQuery]);

  // Handle ticker selection from dropdown
  const handleTickerSelect = async (selected: TickerResult) => {
    // Preenche ticker e tipo automaticamente
    setForm(prev => ({
      ...prev,
      name: selected.ticker,
      type: selected.type,
    }));
    setShowDropdown(false);
    setQuoteError(null);
    setShowRealTimeMsg(false);

    // Se quantidade já foi preenchida, busca o preço
    if (form.quantity && parseFloat(form.quantity.replace(",", ".")) > 0) {
      fetchAndSetPrice(selected.ticker);
    }
  };

  // Busca e preenche o preço atual da cotação
  const fetchAndSetPrice = async (ticker: string) => {
    setQuoteLoading(true);
    setQuoteError(null);

    try {
      const price = await getQuote(ticker);
      if (price !== null) {
        setForm(prev => ({
          ...prev,
          current_price: price.toFixed(2),
          purchase_price: price.toFixed(2),
        }));
        setShowRealTimeMsg(true);
        // Esconde mensagem após 3 segundos
        setTimeout(() => setShowRealTimeMsg(false), 3000);
      } else {
        setQuoteError('Cotação indisponível, preencha manualmente');
      }
    } catch (err) {
      console.error('Erro ao buscar cotação:', err);
      setQuoteError('Cotação indisponível, preencha manualmente');
    } finally {
      setQuoteLoading(false);
    }
  };

  // Busca preço histórico para uma data de compra específica
  const fetchHistoricalPriceForForm = useCallback(async (ticker: string, purchaseDate: string) => {
    if (!ticker || !purchaseDate) return;
    
    setQuoteLoading(true);
    try {
      const historicalPrice = await fetchHistoricalPrice(ticker, purchaseDate);
      if (historicalPrice !== null) {
        setForm(prev => ({
          ...prev,
          purchase_price: historicalPrice.toFixed(2),
        }));
        setShowRealTimeMsg(true);
        setTimeout(() => setShowRealTimeMsg(false), 4000);
      } else {
        // Se não encontrar preço histórico, buscar preço atual como fallback
        const currentPrice = await getQuote(ticker);
        if (currentPrice !== null) {
          setForm(prev => ({
            ...prev,
            purchase_price: currentPrice.toFixed(2),
          }));
        }
      }
    } catch (err) {
      console.error('Erro ao buscar preço histórico:', err);
    } finally {
      setQuoteLoading(false);
    }
  }, [getQuote]);

  // Efeito: buscar preço histórico quando data de compra ou ticker mudam
  useEffect(() => {
    if (form.name && form.purchase_date && !priceDirty) {
      fetchHistoricalPriceForForm(form.name, form.purchase_date);
    }
  }, [form.name, form.purchase_date, priceDirty, fetchHistoricalPriceForForm]);

  // Quando usuário digita no ticker, atualiza searchQuery (com debounce automático do hook)
  const handleTickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setForm(prev => ({ ...prev, name: value }));
    setSearchQuery(value);
    setShowDropdown(true);
    setQuoteError(null);
    setShowRealTimeMsg(false);
  };

  // Quando quantidade é preenchida, busca preço se ticker está selecionado
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm(prev => ({ ...prev, quantity: value }));

    // Se tem ticker válido e quantidade válida, busca preço
    if (form.name && value && !isNaN(parseFloat(value.replace(",", ".")))) {
      fetchAndSetPrice(form.name);
    }
  };

  const canSubmit = (() => {
    if (!form.name.trim() || !form.quantity || !form.purchase_price) return false;
    const qty = parseFloat(form.quantity.replace(",", "."));
    const prc = parseFloat(form.purchase_price.replace(",", "."));
    if (isNaN(qty) || isNaN(prc) || prc <= 0 || qty <= 0) return false;
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
  const totalCurrent = investments.reduce((sum, i) => sum + (i.current_price ?? i.purchase_price) * i.quantity, 0);
  const totalProfit = totalCurrent - totalInvested;
  const totalProfitPercent = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  // Helper: converter tipo do banco para label legível
  const getTypeLabel = (typeValue: string): string => {
    return INVESTMENT_TYPE_MAP[typeValue] || typeValue;
  };

  // Chart data
  const categoryData = (() => {
    const map: Record<string, number> = {};
    investments.forEach((i) => {
      map[i.type] = (map[i.type] || 0) + (i.current_price ?? i.purchase_price) * i.quantity;
    });
    return Object.entries(map)
      .map(([typeValue, value]) => ({ name: getTypeLabel(typeValue), value }))
      .sort((a, b) => b.value - a.value);
  })();

  const profitData = investments
    .map((i) => ({
      name: i.name.length > 12 ? i.name.slice(0, 12) + "..." : i.name,
      investido: i.purchase_price * i.quantity,
      atual: (i.current_price ?? i.purchase_price) * i.quantity,
    }))
    .slice(0, 8);

  const getProfitability = (investment: (typeof investments)[0]) => {
    const invested = investment.purchase_price * investment.quantity;
    const current = (investment.current_price ?? investment.purchase_price) * investment.quantity;
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
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Adicionar Investimento</DialogTitle>
                <DialogDescription>
                  Preencha os dados do novo investimento.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Ticker com Auto-complete */}
                <div>
                  <Label htmlFor="ticker">Ativo (Ticker) *</Label>
                  <div className="relative">
                    <div className="relative">
                      <Input
                        id="ticker"
                        placeholder="Ex: PETR4, MXRF11, BTC"
                        value={form.name}
                        onChange={handleTickerChange}
                        onFocus={() => form.name.length >= 2 && setShowDropdown(true)}
                        className="pr-9"
                        autoCapitalize="characters"
                        autoComplete="off"
                      />
                      {/* Spinner de carregamento */}
                      {tickerLoading && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {/* Ícone de sucesso quando tem resultados */}
                      {!tickerLoading && form.name.length >= 2 && results.length > 0 && (
                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                      )}
                    </div>

                    {/* Dropdown de resultados */}
                    {showDropdown && form.name.length >= 2 && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg overflow-hidden">
                        {tickerLoading ? (
                          <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Buscando ativos...
                          </div>
                        ) : results.length > 0 ? (
                          <div className="max-h-[280px] overflow-y-auto py-1">
                            {results.map((result) => (
                              <div
                                key={result.ticker}
                                onClick={() => handleTickerSelect(result)}
                                className="px-3 py-2 cursor-pointer hover:bg-secondary transition-colors"
                              >
                                <div className="font-medium text-foreground">
                                  {result.ticker} — {result.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Preço: {result.price.toFixed(2)} | Tipo: {getTypeLabel(result.type)}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                            Nenhum ativo encontrado
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {quoteError && (
                    <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {quoteError}
                    </p>
                  )}
                </div>

                {/* Tipo - preenchido automaticamente */}
                <div>
                  <Label htmlFor="type">Tipo *</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {INVESTMENT_TYPE_VALUES.map((typeValue) => (
                        <SelectItem key={typeValue} value={typeValue}>
                          {INVESTMENT_TYPE_MAP[typeValue]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Quantidade e Data de Compra */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quantity">Quantidade *</Label>
                    <Input
                      id="quantity"
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={form.quantity}
                      onChange={handleQuantityChange}
                    />
                  </div>
                  <div>
                    <Label htmlFor="purchase_date">Data Compra</Label>
                    <Input
                      id="purchase_date"
                      type="date"
                      value={form.purchase_date}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, purchase_date: e.target.value }));
                        setPriceDirty(false); // Reset para buscar preço histórico
                      }}
                    />
                  </div>
                </div>

                {/* Preço de Compra e Preço Atual */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="purchase_price">Preço Compra *</Label>
                    <Input
                      id="purchase_price"
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={form.purchase_price}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, purchase_price: e.target.value }));
                        setPriceDirty(true);
                      }}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="current_price">Preço Atual</Label>
                      {showRealTimeMsg && (
                        <span className="text-xs text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Atualizado
                        </span>
                      )}
                    </div>
                    <Input
                      id="current_price"
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={form.current_price}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, current_price: e.target.value }));
                        setPriceDirty(true);
                      }}
                      disabled={quoteLoading && !form.current_price}
                    />
                    {quoteLoading && (
                      <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Buscando cotação em tempo real...
                      </p>
                    )}
                  </div>
                </div>

                {/* Total Investido */}
                {form.quantity && form.purchase_price ? (() => {
                  const qtd = parseFloat(form.quantity.replace(",", "."));
                  const price = parseFloat(form.purchase_price.replace(",", "."));
                  if (isNaN(qtd) || isNaN(price) || price <= 0) return null;
                  return (
                    <p className="text-sm font-medium text-foreground bg-secondary/50 p-2 rounded">
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
                            <Badge variant="secondary">{getTypeLabel(inv.type)}</Badge>
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
