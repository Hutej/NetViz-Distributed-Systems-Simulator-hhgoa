"""REST endpoints for the multi-peer blockchain simulator (Integrity Lab)."""

from ninja import Schema
from ninja.errors import HttpError
from ninja_extra import api_controller, http_get, http_post

from .chain import BlockchainSim, ChainError, blockchain


class TamperRequest(Schema):
    index: int
    data: str
    peer: str = "A"  # additive: original single-chain lab tampered peer A


class TransactionRequest(Schema):
    sender: str
    recipient: str
    amount: float
    peer: str = "A"


class MineRequest(Schema):
    peer: str = "A"


class PeerRequest(Schema):
    peer: str


class IsolationRequest(Schema):
    peer: str
    isolated: bool


class ValidateRequest(Schema):
    peer: str = "A"


def _run(operation, *args) -> dict:
    """Run a blockchain operation; map service errors to HTTP errors."""
    try:
        return operation(*args)
    except ChainError as exc:
        raise HttpError(exc.status, str(exc))


@api_controller("/integrity", tags=["Integrity Lab"])
class IntegrityController:

    @http_get("/state")
    def get_state(self) -> dict:
        """Full peer and chain state, including per-peer validation results."""
        return blockchain.get_state()

    @http_post("/transaction")
    def submit_transaction(self, payload: TransactionRequest) -> dict:
        """Submit an illustrative transaction to a peer and propagate it."""
        return _run(
            blockchain.submit_transaction,
            payload.sender, payload.recipient, payload.amount, payload.peer,
        )

    @http_post("/mine")
    def mine(self, payload: MineRequest) -> dict:
        """Mine a peer's pending transactions with real toy proof-of-work."""
        return _run(blockchain.mine, payload.peer)

    @http_post("/peer")
    def set_isolation(self, payload: IsolationRequest) -> dict:
        """Isolate a peer from, or reconnect it to, the peer network."""
        return _run(blockchain.set_isolation, payload.peer, payload.isolated)

    @http_post("/validate")
    def validate(self, payload: ValidateRequest | None = None) -> dict:
        """Validate one peer's chain and report the first invalid block."""
        return _run(blockchain.validate, payload.peer if payload else "A")

    @http_post("/tamper")
    def tamper(self, payload: TamperRequest) -> dict:
        """Change a non-genesis block's stored data on one peer only."""
        return _run(blockchain.tamper, payload.index, payload.data, payload.peer)

    @http_post("/reconcile")
    def reconcile(self) -> dict:
        """Deterministic longest-valid-chain reconciliation among reachable peers."""
        return _run(blockchain.reconcile)

    @http_post("/reset")
    def reset(self) -> dict:
        """Reset the blockchain simulation to identical valid histories."""
        return _run(blockchain.reset)
