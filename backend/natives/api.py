from ninja_extra import NinjaExtraAPI, api_controller, http_get

api = NinjaExtraAPI(title="Natives API")


@api_controller("/")
class HealthController:
    @http_get("/health")
    def health(self):
        return {"status": "ok"}


api.register_controllers(HealthController)
