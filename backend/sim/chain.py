"""Multi-peer educational blockchain simulator (Integrity Lab backend).

Three simulated peers — A, B, C — each hold their own local chain, pending
transaction pool and isolation flag. This is an EDUCATIONAL PROOF-OF-WORK
SIMULATION with a toy difficulty: no economics, no wallets, no real network,
and it is not Bitcoin. It is in memory, single process, and shares no state
with the distributed-systems engine (sim.engine).
"""

import hashlib
import itertools
import json
import threading
from datetime import datetime, timezone

PEERS = ("A", "B", "C")
DIFFICULTY = 2  # toy proof-of-work: block hash must start with "00"
MAX_NONCE = 20_000  # strict upper bound on mining attempts
INITIAL_TXS = [
    ["transfer: Alice sends 5 coins to Bob"],
    ["transfer: Bob sends 3 coins to Carol"],
]
GENESIS_TIMESTAMP = "2026-01-01T00:00:00"  # fixed so every reset starts identical


class ChainError(Exception):
    """Invalid operation. `status` is the HTTP status to return."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def compute_hash(block: dict) -> str:
    """SHA-256 over the canonical JSON of the block's content fields."""
    payload = {
        key: block[key]
        for key in ("index", "timestamp", "transactions", "previous_hash", "nonce", "miner")
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


class BlockchainSim:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._tx_seq = itertools.count(1)
        self._reset()

    # ------------------------------------------------------------------
    # Internals. Lock must already be held.
    # ------------------------------------------------------------------

    def _mine_block(self, index: int, transactions: list, previous_hash: str, miner: str, timestamp: str | None = None) -> tuple[dict, int]:
        """Real toy proof-of-work: iterate nonces until the hash qualifies."""
        block = {
            "index": index,
            "timestamp": timestamp or _utcnow(),
            "transactions": transactions,
            "previous_hash": previous_hash,
            "nonce": 0,
            "miner": miner,
        }
        attempts = 0
        while attempts < MAX_NONCE:
            block["hash"] = compute_hash(block)
            if block["hash"].startswith("0" * DIFFICULTY):
                return block, attempts + 1
            block["nonce"] += 1
            attempts += 1
        raise ChainError("Mining failed: proof-of-work not reached within the attempt bound.")

    def _reset(self) -> None:
        # Mine ONE canonical initial history, then give every peer an
        # identical deep copy — all peers must start from the same chain.
        canonical = []
        genesis, _ = self._mine_block(0, ["genesis block"], "0" * 64, "genesis", timestamp=GENESIS_TIMESTAMP)
        canonical.append(genesis)
        for i, txs in enumerate(INITIAL_TXS, start=1):
            block, _ = self._mine_block(i, txs, canonical[-1]["hash"], "genesis")
            canonical.append(block)
        self._peers: dict[str, dict] = {
            peer: {
                "chain": json.loads(json.dumps(canonical)),
                "pending": [],
                "isolated": False,
            }
            for peer in PEERS
        }

    def _require_peer(self, peer: str) -> dict:
        if peer not in self._peers:
            raise ChainError(f"Peer '{peer}' does not exist.", status=404)
        return self._peers[peer]

    def _reachable(self, peer: str) -> list[str]:
        return [p for p, data in self._peers.items() if p != peer and not data["isolated"]]

    def _validate_chain(self, chain: list[dict]) -> dict:
        """Full validation: structure, indexes, links, hashes, proof-of-work."""
        previous = "0" * 64
        for position, block in enumerate(chain):
            if not isinstance(block, dict) or not all(
                key in block
                for key in ("index", "timestamp", "transactions", "previous_hash", "nonce", "miner", "hash")
            ):
                return {
                    "valid": False,
                    "first_invalid": position,
                    "reason": f"Block {position} has an invalid structure.",
                }
            if block["index"] != position:
                return {
                    "valid": False,
                    "first_invalid": position,
                    "reason": f"Block {block['index']} has an invalid index (expected {position}).",
                }
            if block["previous_hash"] != previous:
                return {
                    "valid": False,
                    "first_invalid": block["index"],
                    "reason": f"Block {block['index']}'s link to the previous block is broken.",
                }
            if block["hash"] != compute_hash(block):
                return {
                    "valid": False,
                    "first_invalid": block["index"],
                    "reason": (
                        f"Block {block['index']}'s stored hash no longer matches its contents "
                        f"(its data was changed after the hash was calculated)."
                    ),
                }
            if not block["hash"].startswith("0" * DIFFICULTY):
                return {
                    "valid": False,
                    "first_invalid": block["index"],
                    "reason": f"Block {block['index']} does not satisfy the proof-of-work rule.",
                }
            previous = block["hash"]
        return {"valid": True, "first_invalid": None, "reason": None}

    def _apply_block(self, peer: str, block: dict) -> str | None:
        """Append a mined block to a peer's chain if it extends the tip.
        Returns None on success or an honest rejection reason."""
        # The block itself must be internally valid (hash + proof-of-work).
        if block["hash"] != compute_hash(block) or not block["hash"].startswith("0" * DIFFICULTY):
            return "the block is not internally valid"
        chain = self._peers[peer]["chain"]
        if block["index"] != len(chain):
            return "the block does not continue this peer's chain (stale or competing branch)"
        if block["previous_hash"] != chain[-1]["hash"]:
            return "the block does not extend this peer's current tip (stale or competing branch)"
        chain.append(dict(block))
        # Transactions confirmed by this block leave the pending pool.
        included = {tx["id"] for tx in block["transactions"] if isinstance(tx, dict) and "id" in tx}
        self._peers[peer]["pending"] = [
            tx for tx in self._peers[peer]["pending"] if tx["id"] not in included
        ]
        return None

    def _state_locked(self, result: dict | None = None) -> dict:
        peers_out = []
        for peer, data in self._peers.items():
            verdict = self._validate_chain(data["chain"])
            peers_out.append(
                {
                    "peer": peer,
                    "isolated": data["isolated"],
                    "height": len(data["chain"]),
                    "tip_hash": data["chain"][-1]["hash"],
                    "pending_count": len(data["pending"]),
                    "pending": [dict(tx) for tx in data["pending"]],
                    "chain": [dict(block) for block in data["chain"]],
                    **verdict,
                }
            )
        state = {
            "peers": peers_out,
            "difficulty": DIFFICULTY,
            "max_nonce": MAX_NONCE,
            # Backward-compatible single-chain view of peer A (the original lab).
            "blocks": [dict(block) for block in self._peers["A"]["chain"]],
            "valid": peers_out[0]["valid"],
            "first_invalid": peers_out[0]["first_invalid"],
            "reason": peers_out[0]["reason"],
        }
        if result is not None:
            state["result"] = result
        return state

    # ------------------------------------------------------------------
    # Public operations. All return the full state (plus a result summary).
    # ------------------------------------------------------------------

    def get_state(self) -> dict:
        with self._lock:
            return self._state_locked()

    def submit_transaction(self, sender: str, recipient: str, amount: float, peer: str) -> dict:
        with self._lock:
            self._require_peer(peer)
            if not sender or not sender.strip():
                raise ChainError("The transaction sender must not be empty.")
            if not recipient or not recipient.strip():
                raise ChainError("The transaction recipient must not be empty.")
            if sender.strip() == recipient.strip():
                raise ChainError("The sender and recipient must differ.")
            if not isinstance(amount, (int, float)) or amount <= 0:
                raise ChainError("The amount must be a positive number.")
            transaction = {
                "id": f"tx-{next(self._tx_seq)}",
                "sender": sender.strip(),
                "recipient": recipient.strip(),
                "amount": amount,
            }
            self._peers[peer]["pending"].append(transaction)
            propagated_to: list[str] = []
            skipped: list[dict] = []
            if not self._peers[peer]["isolated"]:
                for other in self._reachable(peer):
                    self._peers[other]["pending"].append(dict(transaction))
                    propagated_to.append(other)
            else:
                skipped = [
                    {"peer": p, "reason": "the submitting peer is isolated"}
                    for p in PEERS if p != peer
                ]
            return self._state_locked(
                {"transaction": transaction, "propagated_to": propagated_to, "skipped": skipped}
            )

    def mine(self, peer: str) -> dict:
        with self._lock:
            self._require_peer(peer)
            data = self._peers[peer]
            transactions = [dict(tx) for tx in data["pending"]]
            block, attempts = self._mine_block(
                len(data["chain"]), transactions, data["chain"][-1]["hash"], peer
            )
            # Validate the mined block before accepting it (hash + PoW + link).
            if block["hash"] != compute_hash(block) or not block["hash"].startswith("0" * DIFFICULTY):
                raise ChainError("Mined block failed validation — not accepted.")
            data["pending"] = []
            data["chain"].append(block)

            accepted_by: list[str] = []
            rejected: list[dict] = []
            for other in self._peers:
                if other == peer:
                    continue
                if self._peers[other]["isolated"]:
                    rejected.append({"peer": other, "reason": "peer is isolated"})
                    continue
                rejection = self._apply_block(other, block)
                if rejection is None:
                    accepted_by.append(other)
                else:
                    rejected.append({"peer": other, "reason": rejection})
            return self._state_locked(
                {"block": block, "nonce_attempts": attempts, "accepted_by": accepted_by, "rejected": rejected}
            )

    def set_isolation(self, peer: str, isolated: bool) -> dict:
        with self._lock:
            self._require_peer(peer)
            self._peers[peer]["isolated"] = isolated
            return self._state_locked({"peer": peer, "isolated": isolated})

    def validate(self, peer: str = "A") -> dict:
        with self._lock:
            self._require_peer(peer)
            verdict = self._validate_chain(self._peers[peer]["chain"])
            return self._state_locked({"peer": peer, **verdict})

    def tamper(self, index: int, data: str, peer: str = "A") -> dict:
        """Change a non-genesis block's stored data on ONE peer's chain.
        The stored hash is NOT recalculated — that is the point."""
        with self._lock:
            chain = self._require_peer(peer)["chain"]
            if not 0 < index < len(chain):
                raise ChainError(f"Peer {peer} has no non-genesis block with index {index}.")
            if not data or not data.strip():
                raise ChainError("The new data must not be empty.")
            chain[index]["transactions"] = [data.strip()]
            return self._state_locked({"peer": peer, "index": index})

    def reconcile(self) -> dict:
        """Deterministic longest-valid-chain reconciliation among reachable
        peers. Isolated peers are never touched."""
        with self._lock:
            reachable = [p for p, d in self._peers.items() if not d["isolated"]]
            if not reachable:
                raise ChainError("No peers are reachable for reconciliation.")
            candidates: list[tuple[int, str, str]] = []
            rejected: list[dict] = []
            for peer in reachable:
                verdict = self._validate_chain(self._peers[peer]["chain"])
                if verdict["valid"]:
                    candidates.append((len(self._peers[peer]["chain"]), self._peers[peer]["chain"][-1]["hash"], peer))
                else:
                    rejected.append({"peer": peer, "reason": verdict["reason"]})
            if not candidates:
                raise ChainError("No reachable peer has a valid chain to reconcile from.")
            # Longest valid chain wins; ties break by smallest tip hash, then
            # by peer name (documented deterministic rule).
            _, winner_tip, winner = sorted(candidates, key=lambda c: (-c[0], c[1], c[2]))[0]
            winner_chain = self._peers[winner]["chain"]
            winner_hashes = {block["hash"] for block in winner_chain}
            orphaned: list[dict] = []
            updated: list[str] = []
            for peer in reachable:
                if peer == winner:
                    continue
                old = self._peers[peer]["chain"]
                lost = [
                    {"index": block["index"], "hash": block["hash"]}
                    for block in old
                    if block["hash"] not in winner_hashes
                ]
                if lost:
                    orphaned.append({"peer": peer, "blocks": lost})
                self._peers[peer]["chain"] = [dict(block) for block in winner_chain]
                updated.append(peer)
            return self._state_locked(
                {
                    "winner": winner,
                    "height": len(winner_chain),
                    "tip_hash": winner_tip,
                    "updated": updated,
                    "orphaned": orphaned,
                    "rejected_candidates": rejected,
                }
            )

    def reset(self) -> dict:
        with self._lock:
            self._reset()
            return self._state_locked({"reset": True})


# Singleton used by the API; single process only.
blockchain = BlockchainSim()
