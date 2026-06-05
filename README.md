# Veritas — Sealed Alpha

**Tamper-proof, verifiable crypto trading track records on Sui + Walrus.**

> Alpha callers fake their win rates — they delete losers and photoshop winners.
> **Veritas makes lying impossible.** Every call is sealed as an immutable
> [Walrus](https://www.walrus.xyz/) blob and committed on [Sui](https://sui.io/)
> through [Tatum](https://tatum.io/)'s RPC. Anyone can independently verify that a
> track record was never edited or deleted.

Built for the **Tatum × Walrus — Build on Sui** hackathon.

- **Network:** Sui mainnet
- **Deployed package:** [`0xca0ce070024a3051713c5986f9cb8680e85b7ab81d7d8f76361ddcf2a18a19be`](https://suiscan.xyz/mainnet/object/0xca0ce070024a3051713c5986f9cb8680e85b7ab81d7d8f76361ddcf2a18a19be)
- **Stack:** Move contract · Express + TypeScript API · React + Vite web

---

## Contents

- [The idea](#the-idea)
- [How it works (end to end)](#how-it-works-end-to-end)
- [Why this needs Walrus](#why-this-needs-walrus-the-core-not-an-add-on)
- [How it uses Tatum](#how-it-uses-tatum-the-only-gateway-to-sui)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [API](#api)
- [Run locally](#run-locally)
- [How prices & PnL work](#how-prices--pnl-work)
- [Hackathon criteria mapping](#hackathon-criteria-mapping)

## The idea

Crypto "alpha callers" build huge followings off claimed win rates, but there's
no way to trust them: they quietly delete losing calls, edit entries after the
move, and post fake screenshots. **Veritas removes the trust.** A call, once
posted, can never be edited or deleted — and *anyone* can cryptographically prove
it.

## How it works (end to end)

1. **Post a call.** Token, direction (LONG/SHORT), entry / target / stop, and a
   thesis — e.g. `@satoshi · LONG SUI · entry 0.61 · target 1.20 · stop 0.50`.
2. **Seal on Walrus.** The full call payload is stored as a **content-addressed
   Walrus blob**. We compute its `sha256` fingerprint.
3. **Anchor on Sui (via Tatum).** A `Signal` object is written on-chain holding
   `author + timestamp + blobId + sha256`. The call is now permanently
   timestamped and immutable.
4. **Resolve at live price.** Later, anyone resolves the call: the live price is
   fetched (Tatum), compared to target/stop, and the outcome (WIN/LOSS + % PnL)
   is recorded on-chain and sealed as a second Walrus blob.
5. **Verify (the magic).** Anyone clicks **Verify**: the app re-downloads the
   blob from Walrus, recomputes the `sha256`, and compares it to the hash stored
   on Sui. Match → **✓ VERIFIED** (never edited). Mismatch → **✗ TAMPERED**.

The **leaderboard** is not a database — it is computed live from on-chain calls:
per caller, `win rate = wins ÷ resolved` and average PnL. Because deletes are
impossible, nobody can pad their record by hiding losers.

## Why this needs Walrus (the core, not an add-on)

The entire product *is* Walrus's immutability:

- A signal's full payload is stored as a **content-addressed Walrus blob**. The
  `blobId` is a hash of the bytes — change one character and the `blobId` changes.
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

- Publishing the Move package (via the TS SDK + a custom Tatum transport).
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
                │  Walrus HTTP API    │   │  Tatum (Sui RPC + rate) │
                │ publisher/aggregator│   └─────────┬───────────────┘
                └─────────────────────┘             │ JSON-RPC
                                          ┌──────────▼──────────┐
                                          │  Sui  ·  Move pkg   │
                                          │  veritas::registry  │
                                          └─────────────────────┘
```

## Repository layout

```
veritas/
├── veritas_contracts/        # Move package (Sui)
│   └── sources/registry.move #   registry::seal + registry::resolve
├── server/                   # Express + TypeScript API
│   ├── src/
│   │   ├── index.ts          #   routes (seal/verify/resolve/leaderboard…)
│   │   ├── sui.ts            #   SuiClient over a Tatum RPC transport
│   │   ├── registry.ts       #   build/parse seal + resolve transactions
│   │   ├── walrus.ts         #   store/read content-addressed blobs
│   │   └── config.ts         #   env config
│   └── scripts/
│       ├── deploy.ts         #   publish the Move package via Tatum
│       └── seed.ts           #   seed demo calls into a running API
└── web/                      # React + Vite frontend (single App.tsx + styles.css)
```

- **`veritas_contracts/`** — Move package. `registry::seal` creates an immutable
  shared `Signal` object (hash + blobId + levels) and emits `SignalSealed`;
  `registry::resolve` records the **author-verified** outcome and emits
  `SignalResolved`.
- **`server/`** — Walrus store/read, Tatum RPC via `@mysten/sui` (custom
  `SuiHTTPTransport` with the `x-api-key` header), price resolution, and the
  trustless verify endpoint. In production it also serves the built web app
  (single origin).
- **`web/`** — post a call, browse the feed, leaderboard, and one-click **Verify**.

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

# 4) (optional) Seed demo calls into the running API
npx tsx scripts/seed.ts

# 5) Frontend (new terminal)
cd ../web
npm install
VITE_API_BASE_URL=http://localhost:3001/api npm run dev   # http://localhost:5173
```

### Single-origin / hosted build

```bash
cd web && VITE_API_BASE_URL=/api npm run build   # outputs web/dist
cd ../server && npm run build && npm start         # serves API + web/dist on one origin
```

### Environment (`server/.env`)

```
SUI_NETWORK=testnet
PORT=3001
TATUM_SUI_API_KEY=...
SUI_WALLET_MNEMONIC="word1 word2 ... word12"
VERITAS_PACKAGE_ID=0x...        # from deploy:contract
WALRUS_PUBLISHER=https://publisher.walrus-testnet.walrus.space
WALRUS_AGGREGATOR=https://aggregator.walrus-testnet.walrus.space
WALRUS_EPOCHS=5
```

> `server/.env` is gitignored — never commit your API key or mnemonic.

## How prices & PnL work

On resolve, the live price is fetched from Tatum's rate API. PnL is computed
mark-to-market at resolution time:
`LONG → (price − entry)/entry`, `SHORT → (entry − price)/entry`, stored on-chain
as basis points plus a `win` flag. The outcome itself is also sealed as a Walrus
blob, so the resolution is auditable too.

## Hackathon criteria mapping

| Criterion | Weight | How Veritas covers it |
| --- | --- | --- |
| Walrus + Tatum integration | 30% | Call payloads are sealed as immutable Walrus blobs; every Sui read/write + the price oracle go through Tatum. Walrus immutability *is* the product. |
| Technical quality | 30% | Move contract deployed; typed Express API; clean `tsc` build on both packages; end-to-end Verify. |
| Creativity | 20% | "Tamper-proof alpha track records" — a novel, on-target use of trustless storage. |
| Presentation | 20% | Premium editorial UI, this README, and a demo video. |
| Bonus | — | Targets *Best Walrus Integration* and *Best Use of Tatum Tools*. |

## License

MIT
