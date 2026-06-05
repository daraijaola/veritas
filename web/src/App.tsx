import { useEffect, useMemo, useState } from "react";
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { useSuiClient } from "@mysten/dapp-kit";
import {
  api,
  type AppConfig,
  type LeaderboardRow,
  type Signal,
  type VerifyResponse,
} from "./api";
import { buildSealTx } from "./tx";

const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";

type Tab = "feed" | "leaderboard" | "post";

function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M13 31 L27 46 L53 13"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

function Seal({ big }: { big?: boolean }) {
  return (
    <svg
      className={`seal ${big ? "seal--big" : ""}`}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M16 4l10 4.2v6.6C26 21.4 21.6 25.4 16 27 10.4 25.4 6 21.4 6 14.8V8.2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M11 16l3.4 3.4L21 12.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function App() {
  const account = useCurrentAccount();
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [tab, setTab] = useState<Tab>("feed");
  const [signals, setSignals] = useState<Signal[]>([]);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function goto(t: Tab) {
    setTab(t);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className={`app${scrolled ? " is-scrolled" : ""}`}>
      <header className="nav">
        <a
          className="brand"
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            goto("feed");
          }}
        >
          <Logo className="brand-mark" />
          <span className="brand-word">VERITAS</span>
        </a>
        <nav className="nav-tabs">
          <button className={tab === "feed" ? "active" : ""} onClick={() => goto("feed")}>
            Feed
          </button>
          <button
            className={tab === "leaderboard" ? "active" : ""}
            onClick={() => goto("leaderboard")}
          >
            Leaderboard
          </button>
          <button
            className={`only-mobile${tab === "post" ? " active" : ""}`}
            onClick={() => goto("post")}
          >
            Post
          </button>
        </nav>
        <div className="nav-actions">
          <span className="net-chip">
            <i />
            {cfg?.network ?? "…"}
          </span>
          {account ? (
            <div className="wallet-connected">
              <ConnectButton />
            </div>
          ) : (
            <ConnectButton />
          )}
          <button className="btn btn--dark nav-cta" onClick={() => goto("post")}>
            Post a call
          </button>
        </div>
      </header>

      <main id="top">
        {tab === "feed" && (
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Sealed Alpha — Sui × Walrus × Tatum</p>
            <h1 className="hero-title">
              Alpha callers fake their win rates.
              <span className="hl"> Veritas makes lying impossible.</span>
            </h1>
            <p className="hero-sub">
              Every call is sealed as an immutable <b>Walrus</b> blob and committed on{" "}
              <b>Sui</b> through <b>Tatum</b>. Anyone can independently verify a track record
              was never edited or deleted.
            </p>
            <div className="hero-cta">
              <button className="btn btn--dark btn--lg" onClick={() => goto("post")}>
                Seal a call ↗
              </button>
              <button className="btn btn--lg" onClick={() => goto("leaderboard")}>
                View leaderboard
              </button>
            </div>
          </div>
          <aside className="hero-side" aria-hidden="true">
            <div className="scene-wrap">
              <div className="rings">
                <span className="ring r1" />
                <span className="ring r2" />
                <span className="ring r3" />
              </div>
              <div className="scene">
                <div className="cube">
                  <div className="cf front">
                    <span className="cf-label">commitment</span>
                    <Seal big />
                    <span className="cf-foot">sha256 · sealed</span>
                  </div>
                  <div className="cf back">
                    <span className="cf-label">walrus blob</span>
                    <code className="cf-hash">0x9f…a7c4</code>
                    <span className="cf-foot">content-addressed</span>
                  </div>
                  <div className="cf right">
                    <span className="cf-label">sui object</span>
                    <span className="cf-big">SUI</span>
                    <span className="cf-foot">immutable</span>
                  </div>
                  <div className="cf left">
                    <span className="cf-label">via</span>
                    <span className="cf-big">Tatum</span>
                    <span className="cf-foot">rpc gateway</span>
                  </div>
                  <div className="cf top">
                    <span className="cf-label">verdict</span>
                    <span className="cf-check">✓</span>
                    <span className="cf-foot">verified</span>
                  </div>
                  <div className="cf bottom">
                    <span className="cf-label">pnl</span>
                    <span className="cf-big up">+27.8%</span>
                    <span className="cf-foot">resolved</span>
                  </div>
                </div>
                <div className="scene-shadow" />
              </div>
            </div>
            <div className="seal-card">
              <div className="seal-card__top">
                <Logo className="seal-card__mark" />
                <span className="mono">veritas::registry</span>
              </div>
              <div className="seal-card__rows">
                <Row k="payload" v="→ Walrus blob" />
                <Row k="sha256" v="anchored on Sui" hl />
                <Row k="rpc" v="Tatum gateway" />
                <Row k="verify" v="hash === chain" hl />
              </div>
              <div className="seal-card__foot mono">IMMUTABLE · CONTENT-ADDRESSED</div>
            </div>
          </aside>
        </section>
        )}

        {err && <div className="banner banner--error">Connection issue — {err}</div>}

        {tab === "feed" && (
          <Feed loading={loading} signals={signals} cfg={cfg} onChanged={refresh} onPost={() => goto("post")} />
        )}
        {tab === "leaderboard" && <Leaderboard rows={board} currentAddress={account?.address} />}
        {tab === "post" && (
          <PostCall
            onSealed={() => {
              goto("feed");
              refresh();
            }}
          />
        )}
      </main>

      <footer className="foot">
        <div className="foot-brand">
          <Logo className="foot-mark" />
          <span>VERITAS</span>
        </div>
        <div className="foot-meta mono">
          <span>
            PKG{" "}
            {cfg?.packageId ? (
              <a href={objUrl(cfg.network, cfg.packageId)} target="_blank" rel="noreferrer">
                {short(cfg.packageId)}
              </a>
            ) : (
              "—"
            )}
          </span>
          <span>NOTARY {cfg?.serverAddress ? short(cfg.serverAddress) : "—"}</span>
        </div>
        <div className="foot-tag mono">BUILT ON SUI · STORED ON WALRUS · POWERED BY TATUM</div>
      </footer>
    </div>
  );
}

function Row({ k, v, hl }: { k: string; v: string; hl?: boolean }) {
  return (
    <div className={`seal-row${hl ? " seal-row--hl" : ""}`}>
      <span className="mono seal-row__k">{k}</span>
      <span className="seal-row__v">{v}</span>
    </div>
  );
}

function Feed({
  loading,
  signals,
  cfg,
  onChanged,
  onPost,
}: {
  loading: boolean;
  signals: Signal[];
  cfg: AppConfig | null;
  onChanged: () => void;
  onPost: () => void;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="section-label">The feed</p>
          <h2 className="section-title">Sealed calls</h2>
        </div>
        <button className="btn" onClick={onPost}>
          + Post a call
        </button>
      </div>
      {loading ? (
        <div className="empty">Loading sealed calls from Sui…</div>
      ) : signals.length === 0 ? (
        <div className="empty">
          No calls sealed yet.{" "}
          <button className="linkbtn" onClick={onPost}>
            Be the first →
          </button>
        </div>
      ) : (
        <div className="grid">
          {signals.map((s) => (
            <SignalCard key={s.signalId} s={s} cfg={cfg} onChanged={onChanged} />
          ))}
        </div>
      )}
    </section>
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
  const net = cfg?.network ?? "mainnet";

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
    <article className="card">
      <div className="card-head">
        <div className="who">
          <span className="handle">{s.handle ? `@${s.handle}` : short(s.author, 6)}</span>
          <span className={`tag tag--${s.direction.toLowerCase()}`}>{s.direction}</span>
          <span className="token mono">{s.token}</span>
        </div>
        {s.resolved ? (
          <span className={`badge ${s.win ? "badge--win" : "badge--loss"}`}>
            {s.win ? "WIN" : "LOSS"} {pnlPct >= 0 ? "+" : ""}
            {pnlPct.toFixed(2)}%
          </span>
        ) : (
          <span className="badge badge--open">OPEN</span>
        )}
      </div>

      <div className="levels">
        <div>
          <label className="mono">Entry</label>
          <b>{fmt(s.entry)}</b>
        </div>
        <div>
          <label className="mono">Target</label>
          <b className="up">{fmt(s.target)}</b>
        </div>
        <div>
          <label className="mono">Stop</label>
          <b className="down">{fmt(s.stop)}</b>
        </div>
        {s.resolved && (
          <div>
            <label className="mono">Resolved @</label>
            <b>{fmt(s.resolvedPrice)}</b>
          </div>
        )}
      </div>

      {s.thesis && <p className="thesis">{s.thesis}</p>}

      <div className="meta mono">
        <span title="time of sealing">{new Date(s.createdAtMs).toLocaleString()}</span>
        <a href={blobUrl(s.blobId)} target="_blank" rel="noreferrer">
          Walrus ↗
        </a>
        <a href={objUrl(net, s.signalId)} target="_blank" rel="noreferrer">
          Sui ↗
        </a>
        {s.sealTxDigest && (
          <a href={txUrl(net, s.sealTxDigest)} target="_blank" rel="noreferrer">
            Tx ↗
          </a>
        )}
      </div>

      <div className="actions">
        <button className="btn btn--sm" onClick={doVerify} disabled={busy !== null}>
          {busy === "verify" ? "Verifying…" : "Verify"}
        </button>
        {!s.resolved && (
          <button className="btn btn--sm btn--dark" onClick={doResolve} disabled={busy !== null}>
            {busy === "resolve" ? "Resolving…" : "Resolve @ live price"}
          </button>
        )}
      </div>

      {verify && (
        <div className={`verify-box ${verify.match ? "ok" : "bad"}`}>
          <div className="verdict mono">
            {verify.match ? "✓ VERIFIED — never edited" : "✗ TAMPERED"}
          </div>
          <p className="verdict-text">{verify.verdict}</p>
          <div className="proof">
            <div className="proof-row">
              <span className="proof-k mono">on-chain commitment (Sui)</span>
              <code className="proof-v mono">{verify.onChainHash}</code>
            </div>
            <div className="proof-row">
              <span className="proof-k mono">recomputed from Walrus blob</span>
              <code className="proof-v mono">{verify.recomputedHash}</code>
            </div>
            <div className="proof-row">
              <span className="proof-k mono">walrus blob id</span>
              <code className="proof-v mono">{verify.blobId}</code>
            </div>
          </div>
          <div className="links mono">
            <a href={verify.explorer.walrus} target="_blank" rel="noreferrer">
              Walrus blob ↗
            </a>
            <a href={verify.explorer.object} target="_blank" rel="noreferrer">
              Sui object ↗
            </a>
            {verify.explorer.tx && (
              <a href={verify.explorer.tx} target="_blank" rel="noreferrer">
                Sui tx ↗
              </a>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function Leaderboard({ rows, currentAddress }: { rows: LeaderboardRow[]; currentAddress?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.resolved));
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="section-label">Provable track records</p>
          <h2 className="section-title">Leaderboard</h2>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="empty">No track records yet.</div>
      ) : (
        <div className="board">
          <div className="board-row board-row--head mono">
            <span>#</span>
            <span>Caller</span>
            <span className="num">Calls</span>
            <span className="num">Resolved</span>
            <span>Win rate</span>
            <span className="num">Avg PnL</span>
          </div>
          {rows.map((r, i) => (
            <div
              className={`board-row${currentAddress && r.author === currentAddress ? " board-row--me" : ""}`}
              key={r.handle}
            >
              <span className="rank mono">{String(i + 1).padStart(2, "0")}</span>
              <span className="bhandle">
                {r.handle ? `@${r.handle}` : short(r.author, 6)}
                {currentAddress && r.author === currentAddress && (
                  <span className="you-badge"> YOU</span>
                )}
              </span>
              <span className="num">{r.total}</span>
              <span className="num">{r.resolved}</span>
              <span className="winrate">
                <span className="winrate-track">
                  <span
                    className="winrate-fill"
                    style={{ width: `${r.winRate}%`, opacity: 0.35 + (r.resolved / max) * 0.65 }}
                  />
                </span>
                <b>{r.winRate}%</b>
              </span>
              <span className={`num ${r.avgPnlBps >= 0 ? "up" : "down"}`}>
                {r.avgPnlBps >= 0 ? "+" : ""}
                {(r.avgPnlBps / 100).toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PostCall({ onSealed }: { onSealed: () => void }) {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

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
  const [result, setResult] = useState<{
    signalId: string;
    txDigest: string;
    blobId: string;
    payloadHash: string;
    walrusUrl: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);

  const valid = useMemo(
    () => account && form.handle && form.token && form.entry && form.target && form.stop,
    [account, form],
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
    if (!account) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      // Step 1: Store blob on Walrus via server, get blobId + payloadHash
      const prepared = await api.prepare({
        ...form,
        author: account.address,
      });

      // Step 2: Build the Sui transaction client-side
      const tx = buildSealTx({
        handle: form.handle,
        token: form.token,
        direction: form.direction,
        entry: form.entry,
        target: form.target,
        stop: form.stop,
        thesis: form.thesis,
        payloadHash: prepared.payloadHash,
        blobId: prepared.blobId,
      });

      // Step 3: User's wallet signs and executes on Sui mainnet
      const txResult = await signAndExecute(
        {
          transaction: tx as any,
        },
      );

      // Step 4: Wait for tx to finalize and get full effects
      const fullTx = await suiClient.waitForTransaction({
        digest: txResult.digest,
        options: { showEffects: true, showObjectChanges: true },
      });

      // Step 5: Extract created Signal object ID
      const created = (fullTx.objectChanges ?? []).find(
        (c: any) =>
          c.type === "created" && (c.objectType?.endsWith("::registry::Signal") ?? false),
      ) as any;
      const signalId = created?.objectId ?? "unknown";

      setResult({
        signalId,
        txDigest: txResult.digest,
        blobId: prepared.blobId,
        payloadHash: prepared.payloadHash,
        walrusUrl: `${WALRUS_AGGREGATOR}/v1/blobs/${prepared.blobId}`,
      });
      setTimeout(onSealed, 3000);
    } catch (e: any) {
      setError(e.message ?? "Transaction failed");
    } finally {
      setBusy(false);
    }
  }

  if (!account) {
    return (
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="section-label">Commit forever</p>
            <h2 className="section-title">Seal a call</h2>
          </div>
        </div>
        <div className="post">
          <div className="connect-prompt">
            <Seal big />
            <p>Connect your Sui wallet to seal a call on-chain.</p>
            <p className="hint">Your wallet address becomes your identity — no account needed.</p>
            <ConnectButton />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="section-label">Commit forever</p>
          <h2 className="section-title">Seal a call</h2>
        </div>
      </div>
      <div className="post">
        <p className="hint">
          Once sealed, the entry / target / stop are committed on-chain forever. You can never
          edit or delete this call — that's the point.
        </p>
        <div className="wallet-info-bar mono">
          <span>Posting as</span>
          <code>{short(account.address, 8)}</code>
        </div>
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
              <button className="btn btn--sm" type="button" onClick={fetchPrice}>
                Use live price
              </button>
            </div>
            {livePrice != null && <small className="mono">live ${livePrice}</small>}
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
          <button
            className="btn btn--dark btn--lg btn--block"
            disabled={!valid || busy}
            onClick={submit}
          >
            {busy ? "Sealing on Walrus + Sui…" : "Seal this call"}
          </button>
          {error && <div className="banner banner--error">{error}</div>}
          {result && (
            <div className="seal-result">
              <div className="ok-row mono">✓ SEALED &amp; ANCHORED ON-CHAIN</div>
              <code className="mono">blobId {short(result.blobId, 12)}</code>
              <code className="mono">hash&nbsp;&nbsp;&nbsp;{short(result.payloadHash, 12)}</code>
              <div className="links mono">
                <a href={result.walrusUrl} target="_blank" rel="noreferrer">
                  Walrus ↗
                </a>
                <a href={objUrl("mainnet", result.signalId)} target="_blank" rel="noreferrer">
                  Sui object ↗
                </a>
                <a href={txUrl("mainnet", result.txDigest)} target="_blank" rel="noreferrer">
                  Tx ↗
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="mono">{label}</span>
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

function txUrl(net: string, digest: string): string {
  return `https://suiscan.xyz/${net}/tx/${digest}`;
}

function blobUrl(blobId: string): string {
  return `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`;
}
