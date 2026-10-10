from channels.generic.websocket import AsyncJsonWebsocketConsumer


class SimulationConsumer(AsyncJsonWebsocketConsumer):
    """Placeholder connection; simulation events will be pushed here later."""

    async def connect(self):
        await self.accept()

    async def disconnect(self, close_code):
        pass

    async def receive_json(self, content, **kwargs):
        # ponytail: no message handling yet; echo so clients can verify the socket
        await self.send_json({"echo": content})
