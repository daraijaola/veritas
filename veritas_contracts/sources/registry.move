/// Veritas — Sealed Alpha
/// On-chain, tamper-proof commitments for crypto trading calls ("signals").
///
/// Each signal's full payload (token, entry/target/stop, thesis, chart image)
/// is stored as an immutable blob on Walrus. This module anchors a commitment
/// to that blob on Sui: the Walrus blob id plus a sha256 hash of the payload,
/// timestamped at creation. Because the commitment is immutable and the blob is
/// content-addressed on Walrus, a caller can never silently edit or delete a
/// past call — their track record becomes trustlessly verifiable.
///
/// Prices are stored scaled by 1e12 (`*_e12`) so sub-cent memecoin prices keep
/// precision in a u64. PnL is reported as a magnitude in basis points plus a
/// `win` flag; the sign is implied by `win` and the trade `direction`.
module veritas::registry {
    use std::string::{Self, String};
    use sui::event;
    use sui::clock::Clock;

    /// Caller tried to resolve a signal they did not author.
    const E_NOT_AUTHOR: u64 = 0;
    /// Caller tried to resolve an already-resolved signal.
    const E_ALREADY_RESOLVED: u64 = 1;

    /// A sealed trading call. Shared so anyone can read and verify it.
    public struct Signal has key, store {
        id: UID,
        /// Sui address that sealed the call (the caller's on-chain identity).
        author: address,
        /// Human-readable caller handle (also recorded inside the Walrus blob).
        handle: String,
        /// Token symbol or address the call is about.
        token: String,
        /// "LONG" or "SHORT".
        direction: String,
        entry_e12: u64,
        target_e12: u64,
        stop_e12: u64,
        thesis: String,
        /// Hex sha256 of the exact bytes sealed on Walrus.
        payload_hash: String,
        /// Walrus blob id of the sealed payload.
        blob_id: String,
        created_at_ms: u64,
        resolved: bool,
        win: bool,
        /// PnL magnitude in basis points (sign implied by `win`).
        pnl_bps: u64,
        resolved_price_e12: u64,
        /// Walrus blob id of the sealed outcome record.
        outcome_blob_id: String,
        resolved_at_ms: u64,
    }

    public struct SignalSealed has copy, drop {
        signal_id: ID,
        author: address,
        handle: String,
        token: String,
        direction: String,
        blob_id: String,
        payload_hash: String,
        created_at_ms: u64,
    }

    public struct SignalResolved has copy, drop {
        signal_id: ID,
        author: address,
        win: bool,
        pnl_bps: u64,
        resolved_price_e12: u64,
        outcome_blob_id: String,
        resolved_at_ms: u64,
    }

    /// Seal a new trading call. Creates a shared, immutable-commitment object
    /// owned by the network and emits `SignalSealed` for indexers.
    public fun seal(
        handle: String,
        token: String,
        direction: String,
        entry_e12: u64,
        target_e12: u64,
        stop_e12: u64,
        thesis: String,
        payload_hash: String,
        blob_id: String,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let now = clock.timestamp_ms();
        let author = ctx.sender();
        let signal = Signal {
            id: object::new(ctx),
            author,
            handle,
            token,
            direction,
            entry_e12,
            target_e12,
            stop_e12,
            thesis,
            payload_hash,
            blob_id,
            created_at_ms: now,
            resolved: false,
            win: false,
            pnl_bps: 0,
            resolved_price_e12: 0,
            outcome_blob_id: string::utf8(b""),
            resolved_at_ms: 0,
        };
        event::emit(SignalSealed {
            signal_id: object::id(&signal),
            author,
            handle: signal.handle,
            token: signal.token,
            direction: signal.direction,
            blob_id: signal.blob_id,
            payload_hash: signal.payload_hash,
            created_at_ms: now,
        });
        transfer::share_object(signal);
    }

    /// Resolve a sealed call with its outcome. Only the original author may
    /// resolve, and only once. The entry/target/stop committed at `seal` time
    /// are immutable, so the outcome can be independently re-verified against
    /// public price history.
    public fun resolve(
        signal: &mut Signal,
        win: bool,
        pnl_bps: u64,
        resolved_price_e12: u64,
        outcome_blob_id: String,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(signal.author == ctx.sender(), E_NOT_AUTHOR);
        assert!(!signal.resolved, E_ALREADY_RESOLVED);
        let now = clock.timestamp_ms();
        signal.resolved = true;
        signal.win = win;
        signal.pnl_bps = pnl_bps;
        signal.resolved_price_e12 = resolved_price_e12;
        signal.outcome_blob_id = outcome_blob_id;
        signal.resolved_at_ms = now;
        event::emit(SignalResolved {
            signal_id: object::id(signal),
            author: signal.author,
            win,
            pnl_bps,
            resolved_price_e12,
            outcome_blob_id: signal.outcome_blob_id,
            resolved_at_ms: now,
        });
    }
}
