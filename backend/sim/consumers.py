from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .broadcast import SIMULATION_GROUP
from .engine import engine


class SimulationConsumer(AsyncJsonWebsocketConsumer):
    """Streams simulation updates to dashboard clients.

    On connect the client receives the current state; after every REST
    mutation the same engine state is broadcast to the whole group, so REST
    and WebSocket always reflect the single shared engine.
    """

    async def connect(self):
        await self.accept()
        await self.channel_layer.group_add(SIMULATION_GROUP, self.channel_name)
        await self.send_json(engine.get_state())

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(SIMULATION_GROUP, self.channel_name)

    async def receive_json(self, content, **kwargs):
        # Read-only stream: clients act through the REST API.
        pass

    async def simulation_update(self, event):
        await self.send_json(event["state"])
