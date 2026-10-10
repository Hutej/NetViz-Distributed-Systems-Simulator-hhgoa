from ninja_extra import NinjaExtraAPI, api_controller, http_get

from sim.chain_controller import IntegrityController
from sim.controllers import SimulationController

api = NinjaExtraAPI(title="NetViz API")


@api_controller("/")
class HealthController:
    @http_get("/health")
    def health(self):
        return {"status": "ok"}


api.register_controllers(HealthController)
api.register_controllers(SimulationController)
api.register_controllers(IntegrityController)
