import { SuiClient, SuiHTTPTransport } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { config } from "./config.js";

/**
 * A single SuiClient whose transport points at Tatum's Sui RPC gateway.
 * Tatum authenticates via the `x-api-key` header, so every JSON-RPC call the
 * app makes (reads, event queries, dry-runs, and transaction execution) is
 * served by Tatum's nodes.
 */
/** fetch wrapper that retries on 429 / 5xx with exponential backoff. */
async function retryingFetch(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): Promise<Response> {
  const maxRetries = 5;
  let delay = 600;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(input, init);
    if (res.status !== 429 && res.status < 500) return res;
    if (attempt >= maxRetries) return res;
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, 6000);
  }
}

let client: SuiClient | null = null;
export function getClient(): SuiClient {
  if (!client) {
    client = new SuiClient({
      transport: new SuiHTTPTransport({
        url: config.suiRpcUrl,
        fetch: retryingFetch,
        rpc: { headers: { "x-api-key": config.tatumApiKey } },
      }),
    });
  }
  return client;
}

let keypair: Ed25519Keypair | null = null;
export function getKeypair(): Ed25519Keypair {
  if (!config.suiMnemonic) {
    throw new Error("SUI_WALLET_MNEMONIC not set");
  }
  if (!keypair) {
    keypair = Ed25519Keypair.deriveKeypair(config.suiMnemonic.trim());
  }
  return keypair;
}

export function getServerAddress(): string {
  return getKeypair().getPublicKey().toSuiAddress();
}
