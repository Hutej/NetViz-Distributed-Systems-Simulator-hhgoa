"""REST endpoints for the simulation.

Controllers contain no simulation logic: every operation calls the shared
engine, broadcasts the resulting state to WebSocket clients, and returns it.
"""

from typing import Callable

from ninja.errors import HttpError
from ninja_extra import api_controller, http_get, http_post

from .broadcast import broadcast_state
from .engine import SimulationError, engine
from .schemas import AddNodeRequest, LinkRequest, NodeIdRequest, SimulationStateDict


def _run(operation: Callable[..., SimulationStateDict], *args, **kwargs) -> SimulationStateDict:
    """Run an engine mutation, broadcast the new state, return it."""
    try:
        state = operation(*args, **kwargs)
    except SimulationError as exc:
        raise HttpError(exc.status, str(exc))
    broadcast_state(state)
    return state


@api_controller("/simulation", tags=["Simulation"])
class SimulationController:

    @http_get("/state")
    def get_state(self) -> SimulationStateDict:
        """Return the complete current simulation state."""
        return engine.get_state()

    @http_post("/nodes")
    def add_node(self, payload: AddNodeRequest | None = None) -> SimulationStateDict:
        """Add a node; the engine generates a unique ID when none is given."""
        return _run(engine.add_node, payload.node_id if payload else None)

    @http_post("/crash")
    def crash(self, payload: NodeIdRequest) -> SimulationStateDict:
        """Crash an online node."""
        return _run(engine.crash, payload.node_id)

    @http_post("/recover")
    def recover(self, payload: NodeIdRequest) -> SimulationStateDict:
        """Recover an offline node."""
        return _run(engine.recover, payload.node_id)

    @http_post("/election")
    def start_election(self) -> SimulationStateDict:
        """Run a simplified leader election."""
        return _run(engine.start_election)

    @http_post("/partition")
    def toggle_partition(self, payload: NodeIdRequest) -> SimulationStateDict:
        """Toggle network isolation for a node."""
        return _run(engine.toggle_partition, payload.node_id)

    @http_post("/link/block")
    def block_link(self, payload: LinkRequest) -> SimulationStateDict:
        """Disable communication on the undirected link between two nodes."""
        return _run(engine.block_link, payload.node_a, payload.node_b)

    @http_post("/link/restore")
    def restore_link(self, payload: LinkRequest) -> SimulationStateDict:
        """Restore a previously blocked link."""
        return _run(engine.restore_link, payload.node_a, payload.node_b)

    @http_post("/replicate")
    def replicate(self) -> SimulationStateDict:
        """Replicate a log entry from the leader to reachable online followers."""
        return _run(engine.replicate)

    @http_post("/reset")
    def reset(self) -> SimulationStateDict:
        """Reset the simulation to the initial three-node cluster."""
        return _run(engine.reset)

    @http_post("/scenarios/leader-failure")
    def leader_failure(self) -> SimulationStateDict:
        """Demo scenario: crash the current leader and elect a new one."""
        return _run(engine.run_leader_failure)
