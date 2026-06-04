import { useEffect, useMemo, useState } from "react";
import {
  api,
  type AppConfig,
  type LeaderboardRow,
  type Signal,
  type VerifyResponse,
  type SealResponse,
} from "./api";

type Tab = "feed" | "leaderboard" | "post";

export default function App() {
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [tab, setTab] = useState<Tab>("feed");
  const [signals, setSignals] = useState<Signal[]>([]);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    try {
      setErr(null);
      const [s, b] = await Promise.all([api.signals(), api.leaderboard()]);
      setSignals(s);
      setBoard(b);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.config().then(setCfg).catch(() => {});
    refresh();
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">◆</span>
          <div>
            <div className="brand-name">VERITAS</div>
            <div className="brand-sub">Sealed Alpha</div>
          </div>
        </div>
        <nav className="tabs">
          <button className={tab === "feed" ? "active" : ""} onClick={() => setTab("feed")}>
            Feed
          </button>
          <button
            className={tab === "leaderboard" ? "active" : ""}
            onClick={() => setTab("leaderboard")}
          >
            Leaderboard
          </button>
          <button className={tab === "post" ? "active" : ""} onClick={() => setTab("post")}>
            + Post a Call
          </button>
        </nav>
        <div className="chips">
          <span className="chip walrus">Walrus</span>
          <span className="chip tatum">Tatum RPC</span>
          <span className="chip net">{cfg?.network ?? "…"}</span>
        </div>
      </header>

      <section className="pitch">
        <h1>Alpha callers fake their win rates. Veritas makes lying impossible.</h1>
        <p>
          Every call is sealed as an immutable <b>Walrus</b> blob and committed on <b>Sui</b> via{" "}
          <b>Tatum</b>. Anyone can verify a track record was never edited or deleted.
        </p>
      </section>

      {err && <div className="error">⚠ {err}</div>}

      {tab === "feed" && (
        <Feed loading={loading} signals={signals} cfg={cfg} onChanged={refresh} />
      )}
      {tab === "leaderboard" && <Leaderboard rows={board} />}
      {tab === "post" && (
        <PostCall
          onSealed={() => {
            setTab("feed");
            refresh();
          }}
        />
      )}

      <footer className="foot">
        <span>
          Package:{" "}
          {cfg?.packageId ? (
            <a href={objUrl(cfg.network, cfg.packageId)} target="_blank" rel="noreferrer">
              {short(cfg.packageId)}
            </a>
          ) : (
            "not deployed"
          )}
        </span>
        <span>Notary: {cfg?.serverAddress ? short(cfg.serverAddress) : "—"}</span>
        <span>Built on Sui · Stored on Walrus · Powered by Tatum</span>
      </footer>
    </div>
  );
}

function Feed({
  loading,
  signals,
  cfg,
  onChanged,
}: {
  loading: boolean;
  signals: Signal[];
  cfg: AppConfig | null;
  onChanged: () => void;
}) {
  if (loading) return <div className="empty">Loading sealed calls from Sui…</div>;
  if (signals.length === 0)
    return <div className="empty">No calls sealed yet. Be the first — “Post a Call”.</div>;
  return (
    <div className="grid">
      {signals.map((s) => (
        <SignalCard key={s.signalId} s={s} cfg={cfg} onChanged={onChanged} />
      ))}
    </div>
  );
}

function SignalCard({
  s,
  cfg,
  onChanged,
}: {
  s: Signal;
  cfg: AppConfig | null;
  onChanged: () => void;
}) {
  const [verify, setVerify] = useState<VerifyResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const net = cfg?.network ?? "testnet";

  async function doVerify() {
    setBusy("verify");
    try {
      setVerify(await api.verify(s.signalId));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function doResolve() {
    setBusy("resolve");
    try {
      await api.resolve(s.signalId);
      onChanged();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  }

  const pnlPct = (s.pnlBps / 100) * (s.win ? 1 : -1);

  return (
    <div className="card">
      <div className="card-head">
        <div className="who">
          <span className="handle">@{s.handle}</span>
          <span className={`dir ${s.direction.toLowerCase()}`}>{s.direction}</span>
          <span className="token">{s.token}</span>
        </div>
        {s.resolved ? (
          <span className={`badge ${s.win ? "win" : "loss"}`}>
            {s.win ? "WIN" : "LOSS"} {pnlPct >= 0 ? "+" : ""}
            {pnlPct.toFixed(2)}%
          </span>
        ) : (
          <span className="badge open">OPEN</span>
        )}
      </div>

      <div className="levels">
        <div>
          <label>Entry</label>
          <b>{fmt(s.entry)}</b>
        </div>
        <div>
          <label>Target</label>
          <b className="up">{fmt(s.target)}</b>
        </div>
        <div>
          <label>Stop</label>
          <b className="down">{fmt(s.stop)}</b>
        </div>
        {s.resolved && (
          <div>
            <label>Resolved @</label>
            <b>{fmt(s.resolvedPrice)}</b>
          </div>
        )}
      </div>

      {s.thesis && <p className="thesis">{s.thesis}</p>}

      <div className="meta">
        <span title="time of sealing">{new Date(s.createdAtMs).toLocaleString()}</span>
        <a href={blobUrl(cfg, s.blobId)} target="_blank" rel="noreferrer">
          Walrus blob ↗
        </a>
        <a href={objUrl(net, s.signalId)} target="_blank" rel="noreferrer">
          Sui object ↗
        </a>
      </div>

      <div className="actions">
        <button className="btn verify" onClick={doVerify} disabled={busy !== null}>
          {busy === "verify" ? "Verifying…" : "🔎 Verify"}
        </button>
        {!s.resolved && (
          <button className="btn resolve" onClick={doResolve} disabled={busy !== null}>
            {busy === "resolve" ? "Resolving…" : "Resolve @ live price"}
          </button>
        )}
      </div>

      {verify && (
        <div className={`verify-box ${verify.match ? "ok" : "bad"}`}>
          <div className="verdict">{verify.match ? "✓ VERIFIED" : "✗ TAMPERED"}</div>
          <div className="verdict-text">{verify.verdict}</div>
          <code>on-chain: {short(verify.onChainHash, 10)}</code>
          <code>walrus&nbsp;&nbsp;: {short(verify.recomputedHash, 10)}</code>
        </div>
      )}
    </div>
  );
}

function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  if (rows.length === 0) return <div className="empty">No track records yet.</div>;
  return (
    <table className="board">
      <thead>
        <tr>
          <th>#</th>
          <th>Caller</th>
          <th>Calls</th>
          <th>Resolved</th>
          <th>Wins</th>
          <th>Win rate</th>
          <th>Avg PnL</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.handle}>
            <td>{i + 1}</td>
            <td className="handle">@{r.handle}</td>
            <td>{r.total}</td>
            <td>{r.resolved}</td>
            <td>{r.wins}</td>
            <td className={r.winRate >= 50 ? "up" : "down"}>{r.winRate}%</td>
            <td className={r.avgPnlBps >= 0 ? "up" : "down"}>
              {r.avgPnlBps >= 0 ? "+" : ""}
              {(r.avgPnlBps / 100).toFixed(2)}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PostCall({ onSealed }: { onSealed: () => void }) {
  const [form, setForm] = useState({
    handle: "",
    token: "SUI",
    direction: "LONG" as "LONG" | "SHORT",
    entry: "",
    target: "",
    stop: "",
    thesis: "",
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SealResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);

  const valid = useMemo(
    () => form.handle && form.token && form.entry && form.target && form.stop,
    [form],
  );

  async function fetchPrice() {
    try {
      const p = await api.price(form.token);
      setLivePrice(p.usd);
      setForm((f) => ({ ...f, entry: String(p.usd) }));
    } catch {
      setLivePrice(null);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.seal(form);
      setResult(res);
      setTimeout(onSealed, 2500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="post">
      <h2>Seal a new call</h2>
      <p className="hint">
        Once sealed, the entry/target/stop are committed on-chain forever. You can never edit or
        delete this call — that's the point.
      </p>
      <div className="form">
        <Field label="Caller handle">
          <input
            value={form.handle}
            placeholder="satoshi"
            onChange={(e) => setForm({ ...form, handle: e.target.value })}
          />
        </Field>
        <Field label="Token">
          <div className="row">
            <input
              value={form.token}
              onChange={(e) => setForm({ ...form, token: e.target.value.toUpperCase() })}
            />
            <button className="btn ghost" type="button" onClick={fetchPrice}>
              Use live price
            </button>
          </div>
          {livePrice != null && <small>live: ${livePrice}</small>}
        </Field>
        <Field label="Direction">
          <div className="seg">
            {(["LONG", "SHORT"] as const).map((d) => (
              <button
                key={d}
                type="button"
                className={form.direction === d ? "active" : ""}
                onClick={() => setForm({ ...form, direction: d })}
              >
                {d}
              </button>
            ))}
          </div>
        </Field>
        <div className="three">
          <Field label="Entry">
            <input
              value={form.entry}
              onChange={(e) => setForm({ ...form, entry: e.target.value })}
            />
          </Field>
          <Field label="Target">
            <input
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
            />
          </Field>
          <Field label="Stop">
            <input
              value={form.stop}
              onChange={(e) => setForm({ ...form, stop: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Thesis">
          <textarea
            value={form.thesis}
            rows={3}
            placeholder="Why this trade?"
            onChange={(e) => setForm({ ...form, thesis: e.target.value })}
          />
        </Field>
        <button className="btn primary big" disabled={!valid || busy} onClick={submit}>
          {busy ? "Sealing on Walrus + Sui…" : "🔏 Seal this call"}
        </button>
        {error && <div className="error">⚠ {error}</div>}
        {result && (
          <div className="seal-result">
            <div className="ok-row">✓ Sealed & anchored on-chain</div>
            <code>blobId: {short(result.blobId, 12)}</code>
            <code>hash: {short(result.payloadHash, 12)}</code>
            <div className="links">
              <a href={result.walrusUrl} target="_blank" rel="noreferrer">
                Walrus blob ↗
              </a>
              <a href={result.explorer.object} target="_blank" rel="noreferrer">
                Sui object ↗
              </a>
              <a href={result.explorer.tx} target="_blank" rel="noreferrer">
                Tx ↗
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function fmt(n: number): string {
  if (n === 0) return "0";
  if (n < 0.001) return n.toPrecision(3);
  if (n < 1) return n.toFixed(4);
  if (n < 1000) return n.toFixed(3);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function short(s: string, n = 6): string {
  if (!s) return "";
  return s.length <= n * 2 + 2 ? s : `${s.slice(0, n)}…${s.slice(-4)}`;
}

function objUrl(net: string, id: string): string {
  return `https://suiscan.xyz/${net}/object/${id}`;
}

function blobUrl(cfg: AppConfig | null, blobId: string): string {
  const agg = cfg?.walrusAggregator ?? "https://aggregator.walrus-testnet.walrus.space";
  return `${agg}/v1/blobs/${blobId}`;
}
