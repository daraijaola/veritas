const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";

export interface AppConfig {
  network: string;
  packageId: string;
  rpc: string;
  walrusAggregator: string;
  serverAddress: string;
}

export interface Signal {
  signalId: string;
  author: string;
  handle: string;
  token: string;
  direction: "LONG" | "SHORT";
  entry: number;
  target: number;
  stop: number;
  thesis: string;
  payloadHash: string;
  blobId: string;
  createdAtMs: number;
  resolved: boolean;
  win: boolean;
  pnlBps: number;
  resolvedPrice: number;
  outcomeBlobId: string;
  resolvedAtMs: number;
}

export interface LeaderboardRow {
  handle: string;
  author: string;
  total: number;
  resolved: number;
  wins: number;
  winRate: number;
  avgPnlBps: number;
}

export interface SealResponse {
  signalId: string;
  txDigest: string;
  blobId: string;
  payloadHash: string;
  walrusUrl: string;
  explorer: { tx: string; object: string };
}

export interface VerifyResponse {
  signalId: string;
  blobId: string;
  onChainHash: string;
  recomputedHash: string;
  match: boolean;
  verdict: string;
  walrusUrl: string;
  createdAtMs: number;
}

export interface ResolveResponse {
  signalId: string;
  win: boolean;
  pnlBps: number;
  resolvedPrice: number;
  priceSource: string;
  outcomeBlobId: string;
  txDigest: string;
  explorer: { tx: string };
}

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  config: () => fetch(`${BASE}/config`).then(j<AppConfig>),
  signals: () => fetch(`${BASE}/signals`).then(j<Signal[]>),
  leaderboard: () => fetch(`${BASE}/leaderboard`).then(j<LeaderboardRow[]>),
  price: (token: string) =>
    fetch(`${BASE}/price/${token}`).then(j<{ symbol: string; usd: number; source: string }>),
  seal: (body: unknown) =>
    fetch(`${BASE}/signals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(j<SealResponse>),
  verify: (id: string) => fetch(`${BASE}/signals/${id}/verify`).then(j<VerifyResponse>),
  resolve: (id: string) =>
    fetch(`${BASE}/signals/${id}/resolve`, { method: "POST" }).then(j<ResolveResponse>),
};
