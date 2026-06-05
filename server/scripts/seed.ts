/** Seed the running API with demo signals (some resolved) for the leaderboard. */
const BASE = process.env.SEED_BASE ?? "http://localhost:3001/api";

interface Call {
  handle: string;
  token: string;
  direction: "LONG" | "SHORT";
  entry: string;
  target: string;
  stop: string;
  thesis: string;
  resolve?: boolean;
}

const calls: Call[] = [
  { handle: "satoshi", token: "SUI", direction: "LONG", entry: "0.61", target: "1.20", stop: "0.50", thesis: "Walrus mainnet + Sui DeFi TVL inflows. Accumulating spot.", resolve: true },
  { handle: "alpha_wolf", token: "SOL", direction: "LONG", entry: "58", target: "85", stop: "48", thesis: "SOL ETF speculation + memecoin season rotation.", resolve: true },
  { handle: "degen_queen", token: "BTC", direction: "SHORT", entry: "72000", target: "60000", stop: "78000", thesis: "Overextended, funding too hot. Fade the top.", resolve: true },
  { handle: "satoshi", token: "ETH", direction: "LONG", entry: "2450", target: "3200", stop: "2100", thesis: "ETF flows turning positive, ETH/BTC bottoming." },
  { handle: "moon_boi", token: "SUI", direction: "SHORT", entry: "0.95", target: "0.60", stop: "1.10", thesis: "Unlock cliff incoming, short the pump.", resolve: true },
  { handle: "alpha_wolf", token: "BTC", direction: "LONG", entry: "61000", target: "90000", stop: "52000", thesis: "Halving supply shock plays out over the year." },
];

async function post<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  for (const c of calls) {
    try {
      const sealed = await post<{ signalId: string }>("/signals", c);
      console.log(`sealed @${c.handle} ${c.direction} ${c.token} -> ${sealed.signalId}`);
      await sleep(1500);
      if (c.resolve) {
        const r = await post<{ win: boolean; pnlBps: number }>(
          `/signals/${sealed.signalId}/resolve`,
        );
        console.log(`  resolved: ${r.win ? "WIN" : "LOSS"} ${(r.pnlBps / 100).toFixed(2)}%`);
        await sleep(1500);
      }
    } catch (e) {
      console.error(`failed @${c.handle} ${c.token}:`, e instanceof Error ? e.message : e);
    }
  }
  console.log("done");
}
main();
