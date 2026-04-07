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
