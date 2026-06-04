# Veritas — Sealed Alpha

**Tamper-proof, verifiable crypto trading track records on Sui + Walrus.**

> Alpha callers fake their win rates — they delete losers and photoshop winners.
> **Veritas makes lying impossible.** Every call is sealed as an immutable
> [Walrus](https://www.walrus.xyz/) blob and committed on [Sui](https://sui.io/)
> through [Tatum](https://tatum.io/)'s RPC. Anyone can independently verify that a
> track record was never edited or deleted.

Built for the **Tatum x Walrus — Build on Sui** hackathon.

---

## Why this needs Walrus (the core, not an add-on)

The entire product *is* Walrus's immutability:

- A signal's full payload (token, entry/target/stop, thesis, optional chart) is
  stored as a **content-addressed Walrus blob**. The `blobId` is a hash of the
  bytes — change one character and the `blobId` changes.
- We anchor `sha256(payload) + blobId + timestamp + author` **on Sui**.
- **Verification** = re-fetch the blob from Walrus, recompute the hash, and
  compare it to the on-chain commitment. If they match, the call provably existed
  at time *T* and was never altered. If a caller tries to rewrite history, the
  hash won't match and the tamper is exposed.

Remove Walrus and there is no product — there's nothing immutable to verify
against.

## How it uses Tatum (the only gateway to Sui)

Every single Sui interaction is served by **Tatum's Sui RPC gateway**
(`https://sui-<network>.gateway.tatum.io`, authenticated with `x-api-key`):

- Publishing the Move package (via the TS SDK + Tatum transport).
- Executing `seal` and `resolve` transactions.
- Reading objects, querying `SignalSealed` events to build the feed/leaderboard.

Outcome **prices** are resolved with **Tatum's Data rate API**
(`api.tatum.io/v3/tatum/rate/{symbol}`) — the *same* Tatum API key powers both
the RPC and the price oracle.

## Architecture

```
                        ┌──────────────────────────────┐
  Post a call           │  React + Vite frontend (web)  │
  ───────────────────►  │  feed · leaderboard · verify  │
                        └───────────────┬──────────────┘
                                        │ REST
                        ┌───────────────▼──────────────┐
                        │  Express API (server)         │
                        │  /seal /verify /resolve …     │
                        └───┬───────────────────────┬───┘
            store/read blob │                       │ RPC + price (x-api-key)
                ┌───────────▼─────────┐   ┌─────────▼───────────────┐
                │  Walrus HTTP API    │   │  Tatum  (Sui RPC + rate)│
                │  publisher/aggregator│  └─────────┬───────────────┘
                └─────────────────────┘             │ JSON-RPC
                                          ┌──────────▼──────────┐
                                          │  Sui  ·  Move pkg   │
                                          │  veritas::registry  │
                                          └─────────────────────┘
```

- **`veritas_contracts/`** — Move package. `registry::seal` creates an immutable
  shared `Signal` object (hash + blobId + levels) and emits `SignalSealed`;
  `registry::resolve` records the author-verified outcome and emits
  `SignalResolved`.
- **`server/`** — Express + TypeScript. Walrus store/read, Tatum RPC via
  `@mysten/sui` (custom `SuiHTTPTransport` with the `x-api-key` header), price
  resolution, and the trustless verify endpoint.
- **`web/`** — React + Vite frontend: post a call, browse the feed, leaderboard,
  and one-click **Verify**.

## API

| Method | Route | Description |
| ------ | ----- | ----------- |
| `POST` | `/api/signals` | Seal a call: store payload on Walrus → anchor on Sui via Tatum |
| `GET`  | `/api/signals` | List sealed calls (from `SignalSealed` events) |
| `GET`  | `/api/signals/:id` | Authoritative on-chain state of one call |
| `GET`  | `/api/signals/:id/verify` | Re-fetch blob, recompute hash, compare to chain |
| `POST` | `/api/signals/:id/resolve` | Resolve outcome at live price (Tatum), seal outcome blob |
| `GET`  | `/api/leaderboard` | Win-rate / avg-PnL per caller |
| `GET`  | `/api/price/:token` | Live USD price via Tatum |
| `GET`  | `/api/config` | Network, packageId, notary address |

## Run locally

Prerequisites: Node 20+, a [Tatum](https://dashboard.tatum.io) API key, and a Sui
wallet mnemonic with a little SUI for gas.

```bash
# 1) Backend
cd server
cp .env.example .env          # fill TATUM_SUI_API_KEY + SUI_WALLET_MNEMONIC
npm install

# 2) Deploy the Move package through Tatum (prints a packageId)
npm run deploy:contract
#   → paste the printed VERITAS_PACKAGE_ID into server/.env

# 3) Start the API
npm run dev                   # http://localhost:3001

# 4) Frontend (new terminal)
cd ../web
npm install
VITE_API_BASE_URL=http://localhost:3001/api npm run dev   # http://localhost:5173
```

### Environment (`server/.env`)

```
SUI_NETWORK=testnet
TATUM_SUI_API_KEY=...
SUI_WALLET_MNEMONIC="word1 word2 ... word12"
VERITAS_PACKAGE_ID=0x...        # from deploy:contract
WALRUS_PUBLISHER=https://publisher.walrus-testnet.walrus.space
WALRUS_AGGREGATOR=https://aggregator.walrus-testnet.walrus.space
WALRUS_EPOCHS=5
```

## How prices & PnL work

On resolve, the live price is fetched from Tatum's rate API. PnL is computed
mark-to-market at resolution time:
`LONG → (price − entry)/entry`, `SHORT → (entry − price)/entry`, stored on-chain
as basis points plus a `win` flag. The outcome itself is also sealed as a Walrus
blob, so the resolution is auditable too.

## License

MIT
