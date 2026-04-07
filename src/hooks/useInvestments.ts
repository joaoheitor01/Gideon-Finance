import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { fetchQuotes } from "@/lib/marketApi";

export interface Investment {
  id: string;
  user_id: string;
  name: string;
  type: string;
  amount: number;
  quantity: number;
  purchase_price: number;
  current_price: number;
  purchase_date: string;
  created_at: string;
  updated_at: string;
}

export interface InvestmentInput {
  name: string;
  type: string;
  quantity: number;
  purchase_price: number;
  current_price: number;
  purchase_date: string;
}

export const INVESTMENT_TYPES = [
  "Ações",
  "FIIs",
  "Crypto",
  "Tesouro Direto",
  "CDB",
  "LCI/LCA",
  "Poupança",
  "ETFs",
  "Outros",
];

export function useInvestments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvestments = useCallback(async () => {
    if (!user) {
      setInvestments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("investments")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Erro ao carregar investimentos",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setInvestments(data as Investment[]);
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments]);

  const addInvestment = async (input: InvestmentInput) => {
    if (!user) return { error: new Error("Usuário não autenticado") };

    const { data, error } = await supabase
      .from("investments")
      .insert({
        user_id: user.id,
        name: input.name,
        type: input.type,
        quantity: input.quantity,
        purchase_price: input.purchase_price,
        current_price: input.current_price,
        purchase_date: input.purchase_date,
        amount: input.purchase_price * input.quantity,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Erro ao adicionar investimento",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }

    setInvestments((prev) => [data as Investment, ...prev]);
    toast({
      title: "Investimento adicionado",
      description: "Seu investimento foi registrado com sucesso.",
    });
    return { error: null };
  };

  const updateInvestment = async (id: string, input: Partial<InvestmentInput>) => {
    if (!user) return { error: new Error("Usuário não autenticado") };

    const updates: Record<string, unknown> = { ...input };
    if (input.quantity && input.purchase_price) {
      updates.amount = input.quantity * input.purchase_price;
    }

    const { data, error } = await supabase
      .from("investments")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      toast({
        title: "Erro ao atualizar investimento",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }

    setInvestments((prev) =>
      prev.map((t) => (t.id === id ? (data as Investment) : t))
    );
    toast({
      title: "Investimento atualizado",
      description: "Seu investimento foi atualizado com sucesso.",
    });
    return { error: null };
  };

  const updateCurrentPrice = async (id: string, current_price: number) => {
    if (!user) return { error: new Error("Usuário não autenticado") };

    const investment = investments.find((i) => i.id === id);
    if (!investment) return { error: new Error("Investimento não encontrado") };

    const { data, error } = await supabase
      .from("investments")
      .update({ current_price, amount: current_price * investment.quantity })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      toast({
        title: "Erro ao atualizar preço",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }

    setInvestments((prev) =>
      prev.map((t) => (t.id === id ? (data as Investment) : t))
    );
    toast({
      title: "Preço atualizado",
      description: "O preço atual foi atualizado com sucesso.",
    });
    return { error: null };
  };

  const deleteInvestment = async (id: string) => {
    if (!user) return { error: new Error("Usuário não autenticado") };

    const { error } = await supabase
      .from("investments")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      toast({
        title: "Erro ao excluir investimento",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }

    setInvestments((prev) => prev.filter((t) => t.id !== id));
    toast({
      title: "Investimento excluído",
      description: "Seu investimento foi removido com sucesso.",
    });
    return { error: null };
  };

  const refreshPrices = async () => {
    if (!user || investments.length === 0) return;

    const symbols = investments.map((i) => i.name);
    const prices = await fetchQuotes(symbols);

    let updatedCount = 0;

    for (const inv of investments) {
      const normalized = inv.name.trim().toUpperCase();
      let newPrice = prices.get(normalized);

      // Try with normalization if exact symbol didn't match
      if (newPrice == null) {
        for (const [sym, price] of prices) {
          if (sym.includes(normalized.slice(0, 4))) {
            newPrice = price;
            break;
          }
        }
      }

      if (newPrice != null && newPrice !== inv.current_price) {
        const { error } = await supabase
          .from("investments")
          .update({ current_price: newPrice, amount: newPrice * inv.quantity })
          .eq("id", inv.id)
          .eq("user_id", user.id);

        if (!error) {
          updatedCount++;
          setInvestments((prev) =>
            prev.map((t) => (t.id === inv.id ? { ...t, current_price: newPrice, amount: newPrice * t.quantity } : t))
          );
        }
      }
    }

    if (updatedCount > 0) {
      toast({
        title: "Cotações atualizadas",
        description: `${updatedCount} preço${updatedCount !== 1 ? "s" : ""} atualizado${updatedCount !== 1 ? "s" : ""} com sucesso.`,
      });
    } else {
      toast({
        title: "Nenhuma cotação encontrada",
        description: "Não foi possível obter cotações para os ativos cadastrados. Verifique se os nomes estão corretos (ex: PETR4).",
        variant: "destructive",
      });
    }
  };

  return {
    investments,
    loading,
    addInvestment,
    updateInvestment,
    updateCurrentPrice,
    deleteInvestment,
    refreshPrices,
    refetch: fetchInvestments,
  };
}
