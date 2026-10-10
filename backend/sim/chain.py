"""Simplified hash-chain integrity demonstration (educational only).

Three linked blocks whose SHA-256 hashes commit to their content. Tampering
with a block's data invalidates its stored hash, and validation pinpoints the
first bad block. This is NOT a cryptocurrency — there is no proof-of-work,
no peers, no forks — it demonstrates cryptographic data integrity only.
Fully isolated from the cluster simulation engine.
"""

import hashlib
import threading

GENESIS_DATA = "genesis block"
SAMPLE_DATA = [
    "transfer: Alice sends 5 coins to Bob",
    "transfer: Bob sends 3 coins to Carol",
]


class ChainError(Exception):
    """Invalid operation. `status` is the HTTP status to return."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def compute_hash(index: int, data: str, previous_hash: str) -> str:
    payload = f"{index}|{data}|{previous_hash}"
    return hashlib.sha256(payload.encode()).hexdigest()


class IntegrityChain:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._reset()

    def _reset(self) -> None:
        self._blocks: list[dict] = []
        previous = "0" * 64
        for index, data in enumerate([GENESIS_DATA] + SAMPLE_DATA):
            block = {"index": index, "data": data, "previous_hash": previous}
            block["hash"] = compute_hash(index, data, previous)
            self._blocks.append(block)
            previous = block["hash"]

    def _verdict_locked(self) -> dict:
        previous = "0" * 64
        for block in self._blocks:
            if block["hash"] != compute_hash(block["index"], block["data"], block["previous_hash"]):
                return {
                    "valid": False,
                    "first_invalid": block["index"],
                    "reason": (
                        f"Block {block['index']}'s stored hash no longer matches its contents "
                        f"(its data was changed after the hash was calculated)."
                    ),
                }
            if block["previous_hash"] != previous:
                return {
                    "valid": False,
                    "first_invalid": block["index"],
                    "reason": f"Block {block['index']}'s link to the previous block is broken.",
                }
            previous = block["hash"]
        return {"valid": True, "first_invalid": None, "reason": None}

    def _state_locked(self) -> dict:
        state = {"blocks": [dict(b) for b in self._blocks]}
        state.update(self._verdict_locked())
        return state

    def get_state(self) -> dict:
        with self._lock:
            return self._state_locked()

    def tamper(self, index: int, data: str) -> dict:
        with self._lock:
            if index == 0:
                raise ChainError("The genesis block cannot be tampered with in this demo.")
            if not 0 < index < len(self._blocks):
                raise ChainError(f"There is no block with index {index}.")
            if not data or not data.strip():
                raise ChainError("The new data must not be empty.")
            self._blocks[index]["data"] = data.strip()
            return self._state_locked()

    def validate(self) -> dict:
        with self._lock:
            return self._state_locked()

    def reset(self) -> dict:
        with self._lock:
            self._reset()
            return self._state_locked()


# Singleton used by the API; single process only, same as the cluster engine.
integrity_chain = IntegrityChain()
