import { Transaction } from "@mysten/sui/transactions";
import { getClient, getKeypair } from "./sui.js";
import { config } from "./config.js";

const SUI_CLOCK = "0x6";

/** Convert a decimal price string/number to an integer scaled by 1e12 (no float error). */
export function toE12(value: string | number): bigint {
  let s = typeof value === "number" ? value.toFixed(12) : String(value).trim();
  if (/e/i.test(s)) s = Number(s).toFixed(20);
  const neg = s.startsWith("-");
  if (neg) s = s.slice(1);
  const [intPart, fracRaw = ""] = s.split(".");
  const frac = (fracRaw + "000000000000").slice(0, 12);
  const scaled = BigInt(intPart || "0") * 1_000_000_000_000n + BigInt(frac || "0");
  return neg ? -scaled : scaled;
}

export function fromE12(e12: string | bigint | number): number {
  return Number(BigInt(e12)) / 1e12;
}

export interface SealInput {
  handle: string;
  token: string;
  direction: "LONG" | "SHORT";
  entry: string | number;
  target: string | number;
  stop: string | number;
  thesis: string;
  payloadHash: string;
  blobId: string;
}

export interface SealResult {
  signalId: string;
  txDigest: string;
}

/** Build, sign and execute a `seal` transaction through Tatum's Sui RPC. */
export async function sealSignal(input: SealInput): Promise<SealResult> {
  if (!config.packageId) throw new Error("VERITAS_PACKAGE_ID not set");
  const client = getClient();
  const keypair = getKeypair();

  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::registry::seal`,
    arguments: [
      tx.pure.string(input.handle),
      tx.pure.string(input.token),
      tx.pure.string(input.direction),
      tx.pure.u64(toE12(input.entry)),
      tx.pure.u64(toE12(input.target)),
      tx.pure.u64(toE12(input.stop)),
      tx.pure.string(input.thesis),
      tx.pure.string(input.payloadHash),
      tx.pure.string(input.blobId),
      tx.object(SUI_CLOCK),
    ],
  });

  const res = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEffects: true, showObjectChanges: true },
  });
  await client.waitForTransaction({ digest: res.digest });

  const created = (res.objectChanges ?? []).find(
    (c): c is Extract<typeof c, { type: "created" }> =>
      c.type === "created" && c.objectType.endsWith("::registry::Signal"),
  );
  if (!created) throw new Error("Signal object not found in tx effects");
  return { signalId: created.objectId, txDigest: res.digest };
}

export interface ResolveOnChainInput {
  signalId: string;
  win: boolean;
  pnlBps: number;
  resolvedPrice: string | number;
  outcomeBlobId: string;
}

export async function resolveSignalOnChain(
  input: ResolveOnChainInput,
): Promise<{ txDigest: string }> {
  const client = getClient();
  const keypair = getKeypair();

  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::registry::resolve`,
    arguments: [
      tx.object(input.signalId),
      tx.pure.bool(input.win),
      tx.pure.u64(BigInt(Math.round(input.pnlBps))),
      tx.pure.u64(toE12(input.resolvedPrice)),
      tx.pure.string(input.outcomeBlobId),
      tx.object(SUI_CLOCK),
    ],
  });

  const res = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEffects: true },
  });
  await client.waitForTransaction({ digest: res.digest });
  return { txDigest: res.digest };
}

export interface SignalState {
  signalId: string;
  author: string;
  handle: string;
  token: string;
  direction: string;
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

function parseSignalFields(objectId: string, fields: Record<string, any>): SignalState {
  return {
    signalId: objectId,
    sealTxDigest: "",
    resolveTxDigest: "",
    author: fields.author,
    handle: fields.handle,
    token: fields.token,
    direction: fields.direction,
    entry: fromE12(fields.entry_e12),
    target: fromE12(fields.target_e12),
    stop: fromE12(fields.stop_e12),
    thesis: fields.thesis,
    payloadHash: fields.payload_hash,
    blobId: fields.blob_id,
    createdAtMs: Number(fields.created_at_ms),
    resolved: fields.resolved,
    win: fields.win,
    pnlBps: Number(fields.pnl_bps),
    resolvedPrice: fromE12(fields.resolved_price_e12),
    outcomeBlobId: fields.outcome_blob_id,
    resolvedAtMs: Number(fields.resolved_at_ms),
  };
}

/**
 * Map each signal id to the transaction digest that sealed it (and resolved it),
 * read from the on-chain SignalSealed / SignalResolved events via Tatum RPC.
 * These digests are the verifiable on-chain proof links shown in the UI.
 */
async function fetchTxDigests(
  limit = 200,
): Promise<{ seal: Map<string, string>; resolve: Map<string, string> }> {
  const client = getClient();
  const seal = new Map<string, string>();
  const resolve = new Map<string, string>();
  const [sealed, resolved] = await Promise.all([
    client.queryEvents({
      query: { MoveEventType: `${config.packageId}::registry::SignalSealed` },
      limit,
      order: "descending",
    }),
    client.queryEvents({
      query: { MoveEventType: `${config.packageId}::registry::SignalResolved` },
      limit,
      order: "descending",
    }),
  ]);
  for (const e of sealed.data) {
    const id = (e.parsedJson as any)?.signal_id as string | undefined;
    if (id && !seal.has(id)) seal.set(id, e.id.txDigest);
  }
  for (const e of resolved.data) {
    const id = (e.parsedJson as any)?.signal_id as string | undefined;
    if (id && !resolve.has(id)) resolve.set(id, e.id.txDigest);
  }
  return { seal, resolve };
}

/** Read the authoritative on-chain state of a single Signal object via Tatum RPC. */
export async function getSignal(signalId: string): Promise<SignalState | null> {
  const client = getClient();
  const obj = await client.getObject({ id: signalId, options: { showContent: true } });
  const content = obj.data?.content;
  if (!content || content.dataType !== "moveObject") return null;
  const signal = parseSignalFields(signalId, content.fields as Record<string, any>);
  const { seal, resolve } = await fetchTxDigests();
  signal.sealTxDigest = seal.get(signalId) ?? "";
  signal.resolveTxDigest = resolve.get(signalId) ?? "";
  return signal;
}

/** List all sealed signals by querying SignalSealed events through Tatum RPC. */
export async function listSignals(limit = 200): Promise<SignalState[]> {
  const client = getClient();
  const events = await client.queryEvents({
    query: { MoveEventType: `${config.packageId}::registry::SignalSealed` },
    limit,
    order: "descending",
  });
  const ids = events.data
    .map((e) => (e.parsedJson as any)?.signal_id as string)
    .filter(Boolean);
  if (ids.length === 0) return [];

  const objs = await client.multiGetObjects({
    ids,
    options: { showContent: true },
  });
  const sealMap = new Map<string, string>();
  for (const e of events.data) {
    const id = (e.parsedJson as any)?.signal_id as string | undefined;
    if (id && !sealMap.has(id)) sealMap.set(id, e.id.txDigest);
  }
  const resolveMap = (await fetchTxDigests()).resolve;

  const signals: SignalState[] = [];
  for (const o of objs) {
    const content = o.data?.content;
    if (content && content.dataType === "moveObject" && o.data) {
      const s = parseSignalFields(o.data.objectId, content.fields as Record<string, any>);
      s.sealTxDigest = sealMap.get(o.data.objectId) ?? "";
      s.resolveTxDigest = resolveMap.get(o.data.objectId) ?? "";
      signals.push(s);
    }
  }
  return signals;
}
