import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Resultado da busca de ticker
 */
export interface TickerResult {
  ticker: string;
  name: string;
  type: string;
  price: number;
}

/**
 * Hook para buscar tickers na API Brapi.dev
 * Implementa autocomplete com debounce, busca de cotações e mapeamento de tipos
 */
const useTickerSearch = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TickerResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Mapeia tipos da API Brapi para tipos de investimento do banco
   * Retorna EXATAMENTE os valores do enum: 'acao', 'fii', 'cripto', 'renda_fixa', 'etf', 'outros'
   * - "stock" → "acao"
   * - "fund" → "fii"
   * - "bdr" → "acao"
   * - se contiver "BTC", "ETH", "cripto" → "cripto"
   * - default → "outros"
   */
  const mapBrapiTypeToInvestmentType = useCallback(
    (brapiType: string, ticker: string, name: string): string => {
      // Verifica criptomoedas primeiro
      const cryptoKeywords = ['BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'DOT', 'USDT', 'XRP', 'DOGE'];
      if (cryptoKeywords.some(c => ticker.toUpperCase().includes(c)) || /cripto|crypto/i.test(name)) {
        return 'cripto';
      }

      switch (brapiType.toLowerCase()) {
        case 'fund':
          return 'fii';
        case 'bdr':
        case 'stock':
          return 'acao';
        default:
          return 'outros';
      }
    },
    []
  );

  /**
   * Busca tickers na API com debounce
   * Requer query.length >= 2 para fazer a busca
   */
  const performSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = (import.meta as any).env.VITE_BRAPI_TOKEN;
      if (!token) {
        setError('Token da API não configurado');
        setResults([]);
        setLoading(false);
        return;
      }

      const response = await fetch(
        `https://brapi.dev/api/quote/list?search=${encodeURIComponent(query)}&token=${token}`
      );

      if (!response.ok) {
        throw new Error('Erro na API');
      }

      const data = await response.json();

      if (!data.stocks || data.stocks.length === 0) {
        setResults([]);
        setError(null);
      } else {
        const mappedResults: TickerResult[] = data.stocks.map((stock: {
          stock: string;
          name: string;
          type: string;
          close: number;
        }) => ({
          ticker: stock.stock,
          name: stock.name,
          type: mapBrapiTypeToInvestmentType(stock.type, stock.stock, stock.name),
          price: stock.close || 0,
        }));
        setResults(mappedResults);
        setError(null);
      }
    } catch (err) {
      console.error('Erro na busca de tickers:', err);
      // Não mostra erro se foi problema de rede - apenas deixa vazio
      setResults([]);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [mapBrapiTypeToInvestmentType]);

  /**
   * Busca a cotação em tempo real de um ticker
   * Retorna o valor numérico ou null se falhar
   */
  const getQuote = useCallback(async (ticker: string): Promise<number | null> => {
    try {
      const token = (import.meta as any).env.VITE_BRAPI_TOKEN;
      if (!token) return null;

      const response = await fetch(
        `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?token=${token}`
      );

      if (!response.ok) {
        throw new Error('Erro na API');
      }

      const data = await response.json();
      const result = data.results?.[0];
      return result?.regularMarketPrice || null;
    } catch (err) {
      console.error('Erro na busca de cotação:', err);
      return null;
    }
  }, []);

  /**
   * Executa a busca com debounce de 400ms
   * Limpa timeout anterior e agenda nova busca
   */
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (searchQuery.length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      performSearch(searchQuery);
    }, 400);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery, performSearch]);

  return {
    search: performSearch,
    getQuote,
    loading,
    results,
    searchQuery,
    setSearchQuery,
    error,
  };
};

export default useTickerSearch;
