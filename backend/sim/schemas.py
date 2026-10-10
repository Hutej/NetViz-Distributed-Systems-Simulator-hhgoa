"""Typed request and response contracts for the simulation API.

Request bodies are validated with Django Ninja Schemas. Response bodies are
plain dicts produced by sim.engine — deliberately NOT wrapped in pydantic
models, so the REST responses and the WebSocket pushes are guaranteed to be
byte-for-byte the same shape. The TypedDicts below document that shape for
readers and type checkers.
"""

from typing import Literal, TypedDict

from ninja import Schema


# ---------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------


class NodeIdRequest(Schema):
    node_id: str


class AddNodeRequest(Schema):
    """node_id is optional — the engine generates a free ID when omitted."""

    node_id: str | None = None


# ---------------------------------------------------------------------
# Response shape (produced by sim.engine, never hand-built elsewhere)
# ---------------------------------------------------------------------

Role = Literal["leader", "follower", "candidate"]
NodeStatus = Literal["online", "offline"]
MessageType = Literal["heartbeat", "vote_request", "vote", "replication"]
EventType = Literal["system", "election", "replication", "crash", "recovery", "partition"]


class NodeDict(TypedDict):
    id: str
    name: str
    role: Role
    status: NodeStatus
    term: int
    log_index: int
    partitioned: bool


# Functional form because "from" is a Python keyword.
MessageDict = TypedDict(
    "MessageDict",
    {"id": int, "type": MessageType, "from": str, "to": str, "term": int, "timestamp": str},
)


class EventDict(TypedDict):
    id: int
    type: EventType
    timestamp: str
    description: str


class ClusterInfoDict(TypedDict):
    total_nodes: int
    online_nodes: int
    offline_nodes: int
    quorum_size: int
    quorum_available: bool
    health: str


class SimulationStateDict(TypedDict):
    nodes: list[NodeDict]
    current_leader: str | None
    current_term: int
    total_messages: int
    recent_messages: list[MessageDict]
    recent_events: list[EventDict]
    cluster: ClusterInfoDict
