import { Transaction } from "@mysten/sui/transactions";

const PACKAGE_ID = "0xca0ce070024a3051713c5986f9cb8680e85b7ab81d7d8f76361ddcf2a18a19be";
const SUI_CLOCK = "0x6";

/** Mirror of server toE12 — scale a decimal price to u64 with 12 decimal places. */
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

/** Compute SHA-256 of a UTF-8 string, return hex string — matches server sha256Hex. */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface SealTxParams {
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

/** Build the seal_signal Move transaction — to be signed by the user's wallet. */
export function buildSealTx(p: SealTxParams): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::registry::seal`,
    arguments: [
      tx.pure.string(p.handle),
      tx.pure.string(p.token),
      tx.pure.string(p.direction),
      tx.pure.u64(toE12(p.entry)),
      tx.pure.u64(toE12(p.target)),
      tx.pure.u64(toE12(p.stop)),
      tx.pure.string(p.thesis),
      tx.pure.string(p.payloadHash),
      tx.pure.string(p.blobId),
      tx.object(SUI_CLOCK),
    ],
  });
  return tx;
}

/** Extract the newly created Signal object ID from tx effects. */
export function extractSignalId(effects: any): string | null {
  const created = (effects?.created ?? []) as Array<{ reference?: { objectId?: string } }>;
  // The signal object will be a created object (not gas, which is mutated)
  for (const obj of created) {
    if (obj.reference?.objectId) return obj.reference.objectId;
  }
  return null;
}
