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
  quantity: number;
  purchase_price: number;
  current_price: number | null;
  purchase_date: string;
  broker?: string | null;
  notes?: string | null;
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
  broker?: string | null;
  notes?: string | null;
}

// Mapeamento de tipo de investimento: valor no banco -> label para usuário
export const INVESTMENT_TYPE_MAP: Record<string, string> = {
  'acao': 'Ações',
  'fii': 'Fundos Imobiliários (FII)',
  'cripto': 'Criptomoedas',
  'renda_fixa': 'Renda Fixa',
  'etf': 'ETFs',
  'outros': 'Outros',
};

// Valores válidos para o banco de dados (enum do constraint)
export const INVESTMENT_TYPE_VALUES = Object.keys(INVESTMENT_TYPE_MAP);

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
        ...(input.broker && { broker: input.broker }),
        ...(input.notes && { notes: input.notes }),
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

    const updates: Record<string, unknown> = {};
    
    // Apenas adiciona os campos que foram fornecidos
    if (input.name !== undefined) updates.name = input.name;
    if (input.type !== undefined) updates.type = input.type;
    if (input.quantity !== undefined) updates.quantity = input.quantity;
    if (input.purchase_price !== undefined) updates.purchase_price = input.purchase_price;
    if (input.current_price !== undefined) updates.current_price = input.current_price;
    if (input.purchase_date !== undefined) updates.purchase_date = input.purchase_date;
    if (input.broker !== undefined) updates.broker = input.broker;
    if (input.notes !== undefined) updates.notes = input.notes;

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

    const { data, error } = await supabase
      .from("investments")
      .update({ current_price })
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
          .update({ current_price: newPrice })
          .eq("id", inv.id)
          .eq("user_id", user.id);

        if (!error) {
          updatedCount++;
          setInvestments((prev) =>
            prev.map((t) => (t.id === inv.id ? { ...t, current_price: newPrice } : t))
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
