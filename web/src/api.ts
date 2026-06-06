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
  sealTxDigest: string;
  resolveTxDigest: string;
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

export interface PrepareResponse {
  blobId: string;
  payloadHash: string;
  walrusUrl: string;
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
  sealTxDigest: string;
  explorer: { object: string; tx: string; walrus: string };
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

/** fetch() with a hard timeout — prevents hanging forever on cold Render starts */
function fetchWithTimeout(input: string, init?: RequestInit, ms = 12_000): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), ms);
  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(tid),
  );
}

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  config: () => fetchWithTimeout(`${BASE}/config`).then(j<AppConfig>),
  signals: () => fetchWithTimeout(`${BASE}/signals`).then(j<Signal[]>),
  leaderboard: () => fetchWithTimeout(`${BASE}/leaderboard`).then(j<LeaderboardRow[]>),
  price: (token: string) =>
    fetchWithTimeout(`${BASE}/price/${token}`).then(
      j<{ symbol: string; usd: number; source: string }>,
    ),
  /** Step 1: Store blob on Walrus, get blobId + payloadHash. User signs Sui tx separately. */
  prepare: (body: unknown) =>
    fetchWithTimeout(
      `${BASE}/prepare`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      30_000, // longer timeout for write ops
    ).then(j<PrepareResponse>),
  verify: (id: string) =>
    fetchWithTimeout(`${BASE}/signals/${id}/verify`, {}, 20_000).then(j<VerifyResponse>),
  resolve: (id: string) =>
    fetchWithTimeout(`${BASE}/signals/${id}/resolve`, { method: "POST" }, 20_000).then(
      j<ResolveResponse>,
    ),
};
