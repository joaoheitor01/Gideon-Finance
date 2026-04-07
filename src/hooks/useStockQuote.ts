import { useState, useEffect, useCallback } from "react";
import { fetchSingleQuote, normalizeSymbol, type QuoteResult } from "@/lib/marketApi";

type QuoteStatus = "idle" | "fetching" | "success" | "error";

export interface UseStockQuoteState {
  status: QuoteStatus;
  price: number | null;
  changePercent: number | null;
  shortName: string;
  errorMessage: string | null;
  normalizedTicker: string;
}

const IDLE: UseStockQuoteState = {
  status: "idle",
  price: null,
  changePercent: null,
  shortName: "",
  errorMessage: null,
  normalizedTicker: "",
};

export function useStockQuote(ticker: string, trigger: string | number | null) {
  const [state, setState] = useState<UseStockQuoteState>(IDLE);

  const clear = useCallback(() => {
    setState(IDLE);
  }, []);

  useEffect(() => {
    if (!ticker || !trigger) {
      clear();
      return;
    }

    const normalized = normalizeSymbol(ticker);

    setState((prev) => ({
      ...prev,
      status: "fetching",
      errorMessage: null,
      normalizedTicker: normalized,
    }));

    const controller = new AbortController();
    let current = true;

    const timeout = setTimeout(async () => {
      const result = await fetchSingleQuote(ticker, controller.signal);
      if (!current) return; // stale: component unmounted / ticker changed

      if (result.status === "success") {
        setState({
          status: "success",
          price: result.price,
          changePercent: result.changePercent,
          shortName: result.shortName,
          errorMessage: null,
          normalizedTicker: normalized,
        });
      } else if (result.status === "not_found") {
        setState({
          status: "error",
          price: null,
          changePercent: null,
          shortName: "",
          errorMessage: `Ticker "${result.ticker}" não encontrado. Verifique se o código está correto.`,
          normalizedTicker: normalized,
        });
      } else {
        setState({
          status: "error",
          price: null,
          changePercent: null,
          shortName: "",
          errorMessage: result.message,
          normalizedTicker: normalized,
        });
      }
    }, 600);

    return () => {
      current = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [ticker, trigger, clear]);

  return { ...state, clear };
}
