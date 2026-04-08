const BRAPI_TOKEN = import.meta.env.VITE_BRAPI_TOKEN;
const BRAPI_BASE = "https://brapi.dev/api/v2";

const REQUEST_TIMEOUT = 8000;
const CACHE_DURATION = 60 * 1000;

const cache = new Map<string, { price: number; cachedAt: number }>();

interface BrapiError {
  message: string;
}

interface BrapiQuote {
  symbol: string;
  shortName: string;
  regularMarketPrice: number;
  regularMarketChangePercent: number;
  currency: string;
  marketState: string;
}

interface BrapiResponse {
  results: BrapiQuote[];
  hasError: boolean;
  message?: string;
}

export type QuoteResult =
  | { status: "success"; price: number; shortName: string; changePercent: number }
  | { status: "error"; message: string }
  | { status: "not_found"; ticker: string };

export async function fetchSingleQuote(name: string, signal?: AbortSignal): Promise<QuoteResult> {
  if (!BRAPI_TOKEN) return { status: "error", message: "API da Brapi não configurada" };

  const normalized = normalizeSymbol(name);
  if (!isValidTicker(normalized)) {
    return { status: "error", message: `"${normalized}" não parece ser um ticker válido` };
  }

  // Check cache
  const cached = cache.get(normalized);
  if (cached && Date.now() - cached.cachedAt < CACHE_DURATION) {
    return { status: "success", price: cached.price, shortName: "", changePercent: 0 };
  }

  const controller = new AbortController();

  // If parent signal is aborted, abort our controller
  signal?.addEventListener("abort", () => controller.abort(), { once: true });

  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const url = `${BRAPI_BASE}/quote/${normalized}?token=${BRAPI_TOKEN}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const body = await parseSafeJson(res);
      const msg = (body as BrapiError)?.message;
      if (res.status === 400 || res.status === 404) {
        return { status: "not_found", ticker: normalized };
      }
      return { status: "error", message: msg || `Serviço indisponível (${res.status})` };
    }

    const raw = await parseSafeJson(res);
    const data = raw as BrapiResponse;

    if (data.hasError || (!data.results || data.results.length === 0)) {
      return { status: "not_found", ticker: normalized };
    }

    const quote = data.results[0];
    if (quote.regularMarketPrice == null || isNaN(quote.regularMarketPrice)) {
      return { status: "error", message: "Resposta inválida da Brapi (preço ausente)" };
    }

    cache.set(normalized, { price: quote.regularMarketPrice, cachedAt: Date.now() });

    return {
      status: "success",
      price: quote.regularMarketPrice,
      shortName: quote.shortName || "",
      changePercent: quote.regularMarketChangePercent ?? 0,
    };
  } catch (err) {
    if (signal?.aborted) return { status: "error", message: "Requisição cancelada" };
    return { status: "error", message: "Erro de conexão. Verifique sua internet." };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchQuotes(symbols: string[]): Promise<Map<string, number>> {
  if (!BRAPI_TOKEN || symbols.length === 0) return new Map();

  const uniqueSymbols = [...new Set(symbols.map(normalizeSymbol))];
  const prices = new Map<string, number>();

  const batches: string[][] = [];
  for (let i = 0; i < uniqueSymbols.length; i += 10) {
    batches.push(uniqueSymbols.slice(i, i + 10));
  }

  for (const batch of batches) {
    try {
      const url = `${BRAPI_BASE}/quote/${batch.join(",")}?token=${BRAPI_TOKEN}`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const raw = await parseSafeJson(res);
      const data = raw as BrapiResponse;
      if (data.results) {
        data.results.forEach((quote) => {
          if (quote.regularMarketPrice != null) {
            const sym = quote.symbol.toUpperCase();
            prices.set(sym, quote.regularMarketPrice);
            cache.set(sym, { price: quote.regularMarketPrice, cachedAt: Date.now() });
          }
        });
      }
    } catch {
      // Silently skip failed batch
    }
  }

  return prices;
}

function parseSafeJson(res: Response): Promise<unknown> {
  return res.text().then((text) => {
    try {
      return JSON.parse(text);
    } catch {
      return { hasError: true, message: "Resposta inválida (não-JSON)" };
    }
  });
}

export function normalizeSymbol(name: string): string {
  const sym = name.trim().toUpperCase();

  // Crypto
  if (sym === "BTC" || sym === "BTCBRL" || sym === "BITCOIN") return "BTCBRL=X";
  if (sym === "ETH" || sym === "ETHBRL" || sym === "ETHEREUM") return "ETHBRL=X";
  if (sym === "BNB" || sym === "BNBBRL") return "BNBBRL=X";
  if (sym === "SOL" || sym === "SOLBRL") return "SOLBRL=X";

  return sym;
}

function isValidTicker(ticker: string): boolean {
  if (!ticker) return false;
  if (ticker.length < 2 || ticker.length > 14) return false;
  // BR stock pattern: 4 letters + digit (e.g. PETR4, VALE3, MXRF11)
  if (/^[A-Z]{4}[0-9]{1,2}$/.test(ticker)) return true;
  // Crypto mapped patterns
  if (ticker.includes("=")) return true;
  // Fallback: allow anything 3-14 alphanumeric chars
  return /^[A-Z0-9]{3,14}$/.test(ticker);
}

/**
 * Busca o preço histórico de um ativo para uma data específica
 * @param ticker - Símbolo do ativo (ex: PETR4, BTCBRL=X)
 * @param purchaseDate - Data da compra em formato YYYY-MM-DD
 * @returns Preço na data ou mais próximo, ou null se não encontrar
 */
export async function fetchHistoricalPrice(
  ticker: string,
  purchaseDate: string
): Promise<number | null> {
  if (!BRAPI_TOKEN || !ticker || !purchaseDate) return null;

  try {
    const normalized = normalizeSymbol(ticker);
    if (!isValidTicker(normalized)) return null;

    // Formatar data para ISO (YYYY-MM-DD)
    const requestDate = new Date(purchaseDate);
    if (isNaN(requestDate.getTime())) return null;

    // Converter para timestamp Unix em milissegundos
    const fromTimestamp = Math.floor(requestDate.getTime() / 1000);
    
    // Buscar histórico de 1 ano (ou até 5 anos se necessário)
    const toTimestamp = Math.floor(Date.now() / 1000);
    const url = `https://brapi.dev/api/quote/${normalized}/history?range=5y&from=${fromTimestamp}&to=${toTimestamp}&token=${BRAPI_TOKEN}`;

    const response = await Promise.race([
      fetch(url),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), REQUEST_TIMEOUT)
      ),
    ]);

    if (!response.ok) return null;

    const data = (await parseSafeJson(response)) as any;
    
    if (!data.results || !Array.isArray(data.results)) return null;

    // Procurar pelo preço mais próximo da data solicitada
    const targetDate = new Date(purchaseDate).getTime();
    let closestPrice: number | null = null;
    let closestDiff = Infinity;

    for (const candle of data.results) {
      if (!candle.close || typeof candle.close !== "number") continue;

      const candleDate = new Date(candle.date).getTime();
      const diff = Math.abs(candleDate - targetDate);

      // Se encontrar o mesmo dia, retornar imediatamente
      if (diff === 0) {
        return candle.close;
      }

      // Guardar o mais próximo
      if (diff < closestDiff && candleDate <= targetDate) {
        closestDiff = diff;
        closestPrice = candle.close;
      }
    }

    return closestPrice;
  } catch (error) {
    console.error(`Erro ao buscar preço histórico de ${ticker}:`, error);
    return null;
  }
}
