import "dotenv/config";

export type SuiNetwork = "mainnet" | "testnet" | "devnet";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  network: (process.env.SUI_NETWORK ?? "testnet") as SuiNetwork,

  // Tatum
  tatumApiKey: required("TATUM_SUI_API_KEY"),
  get suiRpcUrl(): string {
    return `https://sui-${this.network}.gateway.tatum.io`;
  },
  tatumRateUrl: "https://api.tatum.io/v3/tatum/rate",

  // Walrus HTTP endpoints (publisher = writes, aggregator = reads)
  walrusPublisher:
    process.env.WALRUS_PUBLISHER ??
    "https://publisher.walrus-testnet.walrus.space",
  walrusAggregator:
    process.env.WALRUS_AGGREGATOR ??
    "https://aggregator.walrus-testnet.walrus.space",
  walrusEpochs: Number(process.env.WALRUS_EPOCHS ?? 5),

  // Sui signer (server "notary" wallet) + deployed package
  suiMnemonic: process.env.SUI_WALLET_MNEMONIC ?? "",
  packageId: process.env.VERITAS_PACKAGE_ID ?? "",
};

export const PRICE_SCALE = 1_000_000_000_000n; // 1e12
