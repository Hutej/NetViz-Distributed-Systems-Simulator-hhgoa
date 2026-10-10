"""Push simulation state to every connected dashboard client.

Called from synchronous Django Ninja handlers. Under the Daphne dev server
those handlers run in a worker thread (no running event loop), so
async_to_sync is the correct way to reach the in-memory channel layer.
"""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .schemas import SimulationStateDict

SIMULATION_GROUP = "simulation"


def broadcast_state(state: SimulationStateDict) -> None:
    layer = get_channel_layer()
    async_to_sync(layer.group_send)(
        SIMULATION_GROUP, {"type": "simulation.update", "state": state}
    )
