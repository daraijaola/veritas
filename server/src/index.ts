import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { storeBlob, readBlob, sha256Hex, walrusBlobUrl } from "./walrus.js";
import { getPrice } from "./price.js";
import {
  sealSignal,
  resolveSignalOnChain,
  getSignal,
  listSignals,
  type SignalState,
} from "./registry.js";
import { getServerAddress } from "./sui.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "8mb" }));

const explorerTx = (digest: string) =>
  `https://suiscan.xyz/${config.network}/tx/${digest}`;
const explorerObj = (id: string) =>
  `https://suiscan.xyz/${config.network}/object/${id}`;

/** The canonical payload that gets sealed on Walrus and committed on Sui. */
interface SealedPayload {
  v: 1;
  type: "veritas.signal";
  handle: string;
  token: string;
  direction: "LONG" | "SHORT";
  entry: string;
  target: string;
  stop: string;
  thesis: string;
  imageBase64?: string;
  createdAt: string;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, network: config.network });
});

app.get("/api/config", (_req, res) => {
  res.json({
    network: config.network,
    packageId: config.packageId,
    rpc: config.suiRpcUrl,
    walrusAggregator: config.walrusAggregator,
    serverAddress: safeAddress(),
  });
});

function safeAddress(): string {
  try {
    return getServerAddress();
  } catch {
    return "";
  }
}

app.get("/api/price/:token", async (req, res) => {
  try {
    res.json(await getPrice(req.params.token));
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

// --- Create (seal) a signal ------------------------------------------------
app.post("/api/signals", async (req, res) => {
  try {
    const { handle, token, direction, entry, target, stop, thesis, imageBase64 } =
      req.body ?? {};
    if (!handle || !token || !direction || entry == null || target == null || stop == null) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (direction !== "LONG" && direction !== "SHORT") {
      return res.status(400).json({ error: "direction must be LONG or SHORT" });
    }

    const payload: SealedPayload = {
      v: 1,
      type: "veritas.signal",
      handle: String(handle),
      token: String(token).toUpperCase(),
      direction,
      entry: String(entry),
      target: String(target),
      stop: String(stop),
      thesis: String(thesis ?? ""),
      imageBase64: imageBase64 ? String(imageBase64) : undefined,
      createdAt: new Date().toISOString(),
    };
    const bytes = Buffer.from(JSON.stringify(payload));
    const payloadHash = sha256Hex(bytes);

    // 1) seal the full payload as an immutable Walrus blob
    const stored = await storeBlob(bytes);

    // 2) anchor the commitment (hash + blobId) on Sui via Tatum
    const sealed = await sealSignal({
      handle: payload.handle,
      token: payload.token,
      direction,
      entry: payload.entry,
      target: payload.target,
      stop: payload.stop,
      thesis: payload.thesis,
      payloadHash,
      blobId: stored.blobId,
    });

    res.json({
      signalId: sealed.signalId,
      txDigest: sealed.txDigest,
      blobId: stored.blobId,
      payloadHash,
      walrusUrl: walrusBlobUrl(stored.blobId),
      explorer: { tx: explorerTx(sealed.txDigest), object: explorerObj(sealed.signalId) },
    });
  } catch (e: any) {
    console.error("seal error", e);
    res.status(500).json({ error: e.message });
  }
});

// --- List + leaderboard ----------------------------------------------------
app.get("/api/signals", async (_req, res) => {
  try {
    res.json(await listSignals());
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

app.get("/api/signals/:id", async (req, res) => {
  try {
    const s = await getSignal(req.params.id);
    if (!s) return res.status(404).json({ error: "not found" });
    res.json(s);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

app.get("/api/leaderboard", async (_req, res) => {
  try {
    res.json(buildLeaderboard(await listSignals()));
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

// --- The headline feature: trustless verification --------------------------
app.get("/api/signals/:id/verify", async (req, res) => {
  try {
    const s = await getSignal(req.params.id);
    if (!s) return res.status(404).json({ error: "not found" });
    const blob = await readBlob(s.blobId);
    const recomputed = sha256Hex(blob);
    const match = recomputed === s.payloadHash;
    res.json({
      signalId: s.signalId,
      blobId: s.blobId,
      onChainHash: s.payloadHash,
      recomputedHash: recomputed,
      match,
      verdict: match
        ? "VERIFIED — the on-chain commitment matches the Walrus blob. This call was never edited."
        : "TAMPERED — the blob does not match the on-chain commitment.",
      walrusUrl: walrusBlobUrl(s.blobId),
      createdAtMs: s.createdAtMs,
      sealTxDigest: s.sealTxDigest,
      explorer: {
        object: explorerObj(s.signalId),
        tx: s.sealTxDigest ? explorerTx(s.sealTxDigest) : "",
        walrus: walrusBlobUrl(s.blobId),
      },
    });
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

// --- Resolve a signal's outcome -------------------------------------------
app.post("/api/signals/:id/resolve", async (req, res) => {
  try {
    const s = await getSignal(req.params.id);
    if (!s) return res.status(404).json({ error: "not found" });
    if (s.resolved) return res.status(409).json({ error: "already resolved" });

    const price = await getPrice(s.token);
    const signedRatio =
      s.direction === "LONG"
        ? (price.usd - s.entry) / s.entry
        : (s.entry - price.usd) / s.entry;
    const win = signedRatio > 0;
    const pnlBps = Math.abs(Math.round(signedRatio * 10000));

    const outcome = {
      v: 1 as const,
      type: "veritas.outcome",
      signalId: s.signalId,
      resolvedPrice: price.usd,
      priceSource: price.source,
      win,
      pnlBps,
      resolvedAt: new Date().toISOString(),
    };
    const stored = await storeBlob(Buffer.from(JSON.stringify(outcome)));

    const resolved = await resolveSignalOnChain({
      signalId: s.signalId,
      win,
      pnlBps,
      resolvedPrice: price.usd,
      outcomeBlobId: stored.blobId,
    });

    res.json({
      signalId: s.signalId,
      win,
      pnlBps,
      resolvedPrice: price.usd,
      priceSource: price.source,
      outcomeBlobId: stored.blobId,
      txDigest: resolved.txDigest,
      explorer: { tx: explorerTx(resolved.txDigest) },
    });
  } catch (e: any) {
    console.error("resolve error", e);
    res.status(500).json({ error: e.message });
  }
});

interface LeaderboardRow {
  handle: string;
  author: string;
  total: number;
  resolved: number;
  wins: number;
  winRate: number;
  avgPnlBps: number;
}

function buildLeaderboard(signals: SignalState[]): LeaderboardRow[] {
  const byHandle = new Map<string, SignalState[]>();
  for (const s of signals) {
    const arr = byHandle.get(s.handle) ?? [];
    arr.push(s);
    byHandle.set(s.handle, arr);
  }
  const rows: LeaderboardRow[] = [];
  for (const [handle, arr] of byHandle) {
    const resolved = arr.filter((s) => s.resolved);
    const wins = resolved.filter((s) => s.win);
    const avgPnlBps =
      resolved.length === 0
        ? 0
        : Math.round(
            resolved.reduce((acc, s) => acc + (s.win ? s.pnlBps : -s.pnlBps), 0) /
              resolved.length,
          );
    rows.push({
      handle,
      author: arr[0].author,
      total: arr.length,
      resolved: resolved.length,
      wins: wins.length,
      winRate: resolved.length === 0 ? 0 : Math.round((wins.length / resolved.length) * 100),
      avgPnlBps,
    });
  }
  return rows.sort((a, b) => b.winRate - a.winRate || b.resolved - a.resolved);
}

// --- Serve the built web app (single-origin hosting) ----------------------
const webDist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../web/dist",
);
app.use(express.static(webDist));
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api")) {
    return res.sendFile(path.join(webDist, "index.html"));
  }
  next();
});

app.listen(config.port, () => {
  console.log(`Veritas API on :${config.port} (${config.network})`);
  console.log(`RPC via Tatum: ${config.suiRpcUrl}`);
});
