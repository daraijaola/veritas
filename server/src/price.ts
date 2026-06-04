import { config } from "./config.js";

export interface PriceResult {
  symbol: string;
  usd: number;
  source: string;
  timestamp: number;
}

/**
 * Live USD price for a token symbol, primarily via Tatum's Data rate API
 * (same Tatum API key as the RPC gateway), with a CoinGecko fallback.
 */
export async function getPrice(symbol: string): Promise<PriceResult> {
  const sym = symbol.trim().toUpperCase();
  try {
    const res = await fetch(`${config.tatumRateUrl}/${sym}?basePair=USD`, {
      headers: { "x-api-key": config.tatumApiKey },
    });
    if (res.ok) {
      const json: any = await res.json();
      const usd = Number(json.value);
      if (usd > 0) {
        return {
          symbol: sym,
          usd,
          source: `Tatum (${json.source ?? "rate"})`,
          timestamp: json.timestamp ?? Date.now(),
        };
      }
    }
  } catch {
    /* fall through to CoinGecko */
  }

  const cgId = COINGECKO_IDS[sym];
  if (cgId) {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`,
    );
    if (res.ok) {
      const json: any = await res.json();
      const usd = Number(json[cgId]?.usd);
      if (usd > 0) {
        return { symbol: sym, usd, source: "CoinGecko", timestamp: Date.now() };
      }
    }
  }
  throw new Error(`No price available for ${sym}`);
}

const COINGECKO_IDS: Record<string, string> = {
  SUI: "sui",
  SOL: "solana",
  BTC: "bitcoin",
  ETH: "ethereum",
  BNB: "binancecoin",
  WAL: "walrus-2",
  USDC: "usd-coin",
};
