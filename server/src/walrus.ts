import { createHash } from "node:crypto";
import { config } from "./config.js";

export interface WalrusStoreResult {
  blobId: string;
  /** Walrus object id when newly created (may be undefined if already certified). */
  suiObjectId?: string;
  endEpoch?: number;
  alreadyCertified: boolean;
}

/**
 * Store raw bytes as an immutable blob on Walrus via the publisher HTTP API.
 * Returns the content-addressed Walrus `blobId`.
 */
export async function storeBlob(data: Buffer | string): Promise<WalrusStoreResult> {
  const url = `${config.walrusPublisher}/v1/blobs?epochs=${config.walrusEpochs}`;
  const res = await fetch(url, { method: "PUT", body: data });
  if (!res.ok) {
    throw new Error(`Walrus store failed: ${res.status} ${await res.text()}`);
  }
  const json: any = await res.json();
  if (json.newlyCreated) {
    const obj = json.newlyCreated.blobObject;
    return {
      blobId: obj.blobId,
      suiObjectId: obj.id,
      endEpoch: obj.storage?.endEpoch,
      alreadyCertified: false,
    };
  }
  if (json.alreadyCertified) {
    return {
      blobId: json.alreadyCertified.blobId,
      endEpoch: json.alreadyCertified.endEpoch,
      alreadyCertified: true,
    };
  }
  throw new Error(`Unexpected Walrus response: ${JSON.stringify(json).slice(0, 300)}`);
}

/** Read a blob back from Walrus by its blobId (via the aggregator). */
export async function readBlob(blobId: string): Promise<Buffer> {
  const url = `${config.walrusAggregator}/v1/blobs/${blobId}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Walrus read failed: ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

export function walrusBlobUrl(blobId: string): string {
  return `${config.walrusAggregator}/v1/blobs/${blobId}`;
}
