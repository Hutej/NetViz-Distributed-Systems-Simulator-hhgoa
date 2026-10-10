"""REST endpoints for the hash-chain integrity demonstration."""

from ninja import Schema
from ninja.errors import HttpError
from ninja_extra import api_controller, http_get, http_post

from .chain import ChainError, integrity_chain


class TamperRequest(Schema):
    index: int
    data: str


@api_controller("/integrity", tags=["Integrity Lab"])
class IntegrityController:

    @http_get("/state")
    def get_state(self) -> dict:
        """Current chain and its computed validity."""
        return integrity_chain.get_state()

    @http_post("/tamper")
    def tamper(self, payload: TamperRequest) -> dict:
        """Change the data of a non-genesis block (stored hash is NOT updated)."""
        try:
            return integrity_chain.tamper(payload.index, payload.data)
        except ChainError as exc:
            raise HttpError(exc.status, str(exc))

    @http_post("/validate")
    def validate(self) -> dict:
        """Recompute and verify every hash and link."""
        return integrity_chain.validate()

    @http_post("/reset")
    def reset(self) -> dict:
        """Rebuild the original untampered chain."""
        return integrity_chain.reset()
