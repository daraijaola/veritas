/**
 * Publish the Veritas Move package to Sui *through Tatum's RPC gateway*.
 *
 * Compiles the package offline with the Sui CLI (`--no-tree-shaking` avoids any
 * RPC calls), then builds a publish transaction with the TS SDK and submits it
 * via Tatum. Prints the resulting packageId.
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Transaction } from "@mysten/sui/transactions";
import { getClient, getKeypair, getServerAddress } from "../src/sui.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const contractsDir = resolve(__dirname, "../../veritas_contracts");

function compile(): { modules: string[]; dependencies: string[] } {
  const out = execSync(
    "sui move build --dump-bytecode-as-base64 --no-tree-shaking",
    { cwd: contractsDir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const json = JSON.parse(out);
  return { modules: json.modules, dependencies: json.dependencies };
}

async function main() {
  const sender = getServerAddress();
  console.log("Deployer address:", sender);

  const client = getClient();
  const balance = await client.getBalance({ owner: sender });
  console.log("SUI balance:", Number(balance.totalBalance) / 1e9, "SUI");

  const { modules, dependencies } = compile();
  console.log(`Compiled ${modules.length} module(s), ${dependencies.length} deps`);

  const tx = new Transaction();
  const upgradeCap = tx.publish({ modules, dependencies });
  tx.transferObjects([upgradeCap], sender);

  const res = await client.signAndExecuteTransaction({
    signer: getKeypair(),
    transaction: tx,
    options: { showEffects: true, showObjectChanges: true },
  });
  await client.waitForTransaction({ digest: res.digest });

  if (res.effects?.status.status !== "success") {
    throw new Error(`Publish failed: ${JSON.stringify(res.effects?.status)}`);
  }

  const published = (res.objectChanges ?? []).find(
    (c) => c.type === "published",
  ) as { type: "published"; packageId: string } | undefined;
  if (!published) throw new Error("No published package in tx effects");

  console.log("\n=== PUBLISH SUCCESS ===");
  console.log("txDigest: ", res.digest);
  console.log("packageId:", published.packageId);
  console.log("\nAdd this to your .env:");
  console.log(`VERITAS_PACKAGE_ID=${published.packageId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
