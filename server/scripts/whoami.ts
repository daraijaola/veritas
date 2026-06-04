import { getClient, getServerAddress } from "../src/sui.js";
import { config } from "../src/config.js";

async function main() {
  const address = getServerAddress();
  console.log("network:", config.network);
  console.log("rpc:", config.suiRpcUrl);
  console.log("address:", address);
  const balance = await getClient().getBalance({ owner: address });
  console.log("balance:", Number(balance.totalBalance) / 1e9, "SUI");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
