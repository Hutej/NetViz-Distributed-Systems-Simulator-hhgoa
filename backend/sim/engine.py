"""NetViz in-memory simulation engine.

This module is the single source of truth for the simulated cluster.

This is a SINGLE-PROCESS educational model, not a real distributed cluster
and not a full Raft implementation: no persistence, no election timers, no
real message transport. Elections are deterministic (the eligible node with
the lexicographically smallest ID that sits in a connected group large
enough for quorum wins) and quorum is floor(total_nodes / 2) + 1, counting
all nodes. Connectivity is a graph calculation over online, unpartitioned
nodes with unblocked links; it is the ONLY reachability calculation in the
system — the API and the frontend both consume it from the state.

A re-entrant lock guards every state transition because Django runs
synchronous API handlers on a thread pool.
"""

import itertools
import threading
from dataclasses import dataclass
from datetime import datetime, timezone

from .schemas import SimulationStateDict

MAX_MESSAGES = 25
MAX_EVENTS = 50


class SimulationError(Exception):
    """Invalid operation. `status` is the HTTP status the API should return."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


@dataclass
class SimNode:
    id: str
    name: str
    role: str  # "leader" | "follower" | "candidate"
    status: str  # "online" | "offline"
    term: int
    log_index: int
    partitioned: bool

    def as_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "role": self.role,
            "status": self.status,
            "term": self.term,
            "log_index": self.log_index,
            "partitioned": self.partitioned,
        }


class SimulationEngine:
    """All cluster state and every state transition lives here."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._init_cluster(
            "Simulation initialized: nodes A, B and C online; Node A is leader for term 1."
        )

    # ------------------------------------------------------------------
    # Internals. Callers must already hold the lock.
    # ------------------------------------------------------------------

    def _init_cluster(self, announcement: str) -> None:
        self._nodes: dict[str, SimNode] = {
            "A": SimNode("A", "Node A", "leader", "online", 1, 0, False),
            "B": SimNode("B", "Node B", "follower", "online", 1, 0, False),
            "C": SimNode("C", "Node C", "follower", "online", 1, 0, False),
        }
        self._current_leader = "A"
        self._current_term = 1
        # Disabled undirected links, stored as frozensets so (A, B) and (B, A)
        # are the same link and cannot be stored twice.
        self._blocked_links: set[frozenset[str]] = set()
        self.total_messages = 0
        self.recent_messages: list[dict] = []
        self.recent_events: list[dict] = []
        self._event_seq = itertools.count(1)
        self._message_seq = itertools.count(1)
        self._event("system", announcement)

    def _event(self, type_: str, description: str) -> None:
        self.recent_events.append(
            {
                "id": next(self._event_seq),
                "type": type_,
                "timestamp": _utcnow(),
                "description": description,
            }
        )
        del self.recent_events[:-MAX_EVENTS]

    def _message(self, type_: str, source: str, target: str) -> None:
        self.total_messages += 1
        self.recent_messages.append(
            {
                "id": next(self._message_seq),
                "type": type_,
                "from": source,
                "to": target,
                "term": self._current_term,
                "timestamp": _utcnow(),
            }
        )
        del self.recent_messages[:-MAX_MESSAGES]

    def _require_node(self, node_id: str) -> SimNode:
        node = self._nodes.get(node_id)
        if node is None:
            raise SimulationError(f"Node '{node_id}' does not exist.", status=404)
        return node

    def _leader_node(self) -> SimNode | None:
        if self._current_leader is None:
            return None
        return self._nodes.get(self._current_leader)

    def _quorum_size(self) -> int:
        # Simplified majority for education, not full Raft.
        return len(self._nodes) // 2 + 1

    def _active_nodes(self) -> list[SimNode]:
        """Online and not isolated by a node-level partition."""
        return [n for n in self._nodes.values() if n.status == "online" and not n.partitioned]

    # ------------------------------------------------------------------
    # Shared connectivity calculation.
    #
    # The communication graph has the active (online, unpartitioned) nodes
    # as vertices; every pair is connected unless its link is blocked.
    # Reachability, quorum and elections all derive from these components —
    # there is no second, inconsistent calculation anywhere else.
    # ------------------------------------------------------------------

    def _components_locked(self) -> list[set[str]]:
        remaining = {n.id for n in self._active_nodes()}
        components: list[set[str]] = []
        while remaining:
            start = min(remaining)
            remaining.remove(start)
            component = {start}
            frontier = [start]
            while frontier:
                current = frontier.pop()
                for other in list(remaining):
                    if frozenset((current, other)) not in self._blocked_links:
                        remaining.remove(other)
                        component.add(other)
                        frontier.append(other)
            components.append(component)
        return components

    def _state_locked(self) -> SimulationStateDict:
        total = len(self._nodes)
        online = sum(1 for n in self._nodes.values() if n.status == "online")
        quorum = self._quorum_size()
        components = self._components_locked()
        quorum_available = max((len(c) for c in components), default=0) >= quorum
        leader = self._leader_node()
        # A leader must actually be able to REACH quorum through the network,
        # not merely be online.
        leader_component = (
            next((c for c in components if leader.id in c), set())
            if leader is not None and leader.status == "online" and not leader.partitioned
            else set()
        )
        healthy = bool(leader is not None and len(leader_component) >= quorum)

        nodes_out = []
        for node in self._nodes.values():
            node_dict = node.as_dict()
            node_dict["reachable_peers"] = (
                sorted(next((c for c in components if node.id in c), set()) - {node.id})
                if node.status == "online" and not node.partitioned
                else []
            )
            nodes_out.append(node_dict)

        return {
            "nodes": nodes_out,
            "current_leader": self._current_leader,
            "current_term": self._current_term,
            "total_messages": self.total_messages,
            "blocked_links": [sorted(link) for link in self._blocked_links],
            "recent_messages": list(self.recent_messages),
            "recent_events": list(self.recent_events),
            "cluster": {
                "total_nodes": total,
                "online_nodes": online,
                "offline_nodes": total - online,
                "quorum_size": quorum,
                "quorum_available": quorum_available,
                "health": "healthy" if healthy else "degraded",
                "components": [sorted(c) for c in components],
            },
        }

    # ------------------------------------------------------------------
    # Public operations. All return the complete state snapshot.
    # ------------------------------------------------------------------

    def get_state(self) -> SimulationStateDict:
        with self._lock:
            return self._state_locked()

    def add_node(self, node_id: str | None = None) -> SimulationStateDict:
        with self._lock:
            if node_id is None or node_id.strip() == "":
                node_id = self._next_free_id()
            node_id = node_id.strip()
            if node_id in self._nodes:
                raise SimulationError(f"Node ID '{node_id}' is already in use.")
            node = SimNode(node_id, f"Node {node_id}", "follower", "online", self._current_term, 0, False)
            self._nodes[node_id] = node
            self._event("system", f"Node {node_id} joined the cluster as a follower.")
            leader = self._leader_node()
            if leader is not None and leader.id in next(
                (c for c in self._components_locked() if leader.id in c), set()
            ):
                self._message("heartbeat", leader.id, node_id)
            return self._state_locked()

    def _next_free_id(self) -> str:
        for i in range(len(self._nodes) + 1):
            candidate = chr(ord("A") + i)
            if candidate not in self._nodes:
                return candidate
        return f"N{len(self._nodes) + 1}"

    def crash(self, node_id: str) -> SimulationStateDict:
        with self._lock:
            node = self._require_node(node_id)
            if node.status == "offline":
                raise SimulationError(f"Node '{node_id}' is already offline.")
            node.status = "offline"
            if self._current_leader == node.id:
                node.role = "follower"
                self._current_leader = None
                self._event("crash", f"Leader {node_id} crashed — the cluster is left without a leader.")
            else:
                self._event("crash", f"Node {node_id} crashed and stopped responding.")
            return self._state_locked()

    def recover(self, node_id: str) -> SimulationStateDict:
        with self._lock:
            node = self._require_node(node_id)
            if node.status == "online":
                raise SimulationError(f"Node '{node_id}' is already online.")
            node.status = "online"
            node.role = "follower"
            node.term = self._current_term
            self._event("recovery", f"Node {node_id} recovered and rejoined the cluster as a follower.")
            leader = self._leader_node()
            if leader is not None and leader.id in next(
                (c for c in self._components_locked() if leader.id in c), set()
            ):
                self._message("heartbeat", leader.id, node_id)
            return self._state_locked()

    def block_link(self, node_a: str, node_b: str) -> SimulationStateDict:
        """Disable communication on one undirected link; both nodes stay online."""
        with self._lock:
            node_a = self._require_node(node_a).id
            node_b = self._require_node(node_b).id
            if node_a == node_b:
                raise SimulationError("A node cannot block a link to itself.")
            link = frozenset((node_a, node_b))
            if link in self._blocked_links:
                raise SimulationError(f"The link between {node_a} and {node_b} is already blocked.")
            self._blocked_links.add(link)
            self._event(
                "partition",
                f"Link fault: the connection between {node_a} and {node_b} is disabled.",
            )
            return self._state_locked()

    def restore_link(self, node_a: str, node_b: str) -> SimulationStateDict:
        with self._lock:
            node_a = self._require_node(node_a).id
            node_b = self._require_node(node_b).id
            if node_a == node_b:
                raise SimulationError("A node cannot have a link to itself.")
            link = frozenset((node_a, node_b))
            if link not in self._blocked_links:
                raise SimulationError(f"The link between {node_a} and {node_b} is not blocked.")
            self._blocked_links.remove(link)
            self._event(
                "partition",
                f"Link restored: {node_a} and {node_b} can communicate again.",
            )
            return self._state_locked()

    def start_election(self) -> SimulationStateDict:
        with self._lock:
            total = len(self._nodes)
            quorum = self._quorum_size()
            active = self._active_nodes()
            components = self._components_locked()

            # A candidate can only win inside a connected group large enough
            # for quorum: it cannot collect votes it cannot reach. The
            # winner is deterministic — the smallest node ID in any
            # quorum-sized group.
            quorum_groups = [c for c in components if len(c) >= quorum]
            candidate_pool = sorted(node_id for c in quorum_groups for node_id in c)

            for node in active:
                node.role = "candidate"

            if candidate_pool:
                candidate_id = candidate_pool[0]
                voters = sorted(next(c for c in quorum_groups if candidate_id in c))
                for voter_id in voters:
                    if voter_id != candidate_id:
                        self._message("vote_request", candidate_id, voter_id)
                        self._message("vote", voter_id, candidate_id)
                self._current_term += 1
                for node in active:
                    node.role = "follower"
                    if node.id in voters:
                        node.term = self._current_term
                candidate = self._nodes[candidate_id]
                candidate.role = "leader"
                self._current_leader = candidate_id
                self._event(
                    "election",
                    f"Node {candidate_id} won the election for term {self._current_term} "
                    f"({len(voters)}/{total} nodes can reach it in its connected group, "
                    f"quorum {quorum}).",
                )
                for voter_id in voters:
                    if voter_id != candidate_id:
                        self._message("heartbeat", candidate_id, voter_id)
            else:
                for node in active:
                    node.role = "follower"
                self._current_leader = None
                largest = max((len(c) for c in components), default=0)
                self._event(
                    "election",
                    f"Election failed: the largest connected group reaches only {largest} of "
                    f"{total} nodes, but quorum requires {quorum}. No node can safely become "
                    f"leader, so the cluster stays leaderless.",
                )
            return self._state_locked()

    def toggle_partition(self, node_id: str) -> SimulationStateDict:
        with self._lock:
            node = self._require_node(node_id)
            if node.status == "offline":
                raise SimulationError(
                    f"Node '{node_id}' is offline — partitioning an offline node has no effect."
                )
            node.partitioned = not node.partitioned
            if node.partitioned:
                detail = f"Network partition: Node {node_id} is isolated; no messages reach it."
                if self._current_leader == node.id:
                    detail += " The isolated node is the current leader."
                self._event("partition", detail)
            else:
                self._event("partition", f"Network healed: Node {node_id} is reconnected to the cluster.")
            return self._state_locked()

    def _miss_reason(self, node: SimNode) -> str:
        if node.status == "offline":
            return "offline"
        if node.partitioned:
            return "isolated by a network partition"
        return "no active network path to the leader"

    def replicate(self) -> SimulationStateDict:
        with self._lock:
            leader = self._leader_node()
            if leader is None:
                raise SimulationError("The cluster has no leader — start an election first.")
            if leader.status == "offline":
                raise SimulationError(f"Leader {leader.id} is offline — no node can accept entries.")
            if leader.partitioned:
                raise SimulationError(f"Leader {leader.id} is isolated behind a network partition.")
            leader_component = next(
                (c for c in self._components_locked() if leader.id in c), set()
            )
            receivers = [
                n
                for n in self._nodes.values()
                if n.id != leader.id and n.status == "online" and not n.partitioned and n.id in leader_component
            ]
            if not receivers:
                raise SimulationError("The leader has no reachable online followers to replicate to.")
            leader.log_index += 1
            for follower in receivers:
                follower.log_index = leader.log_index
                self._message("replication", leader.id, follower.id)
            missed = [n for n in self._nodes.values() if n.id != leader.id and n not in receivers]
            description = (
                f"Leader {leader.id} replicated log entry {leader.log_index} "
                f"to {len(receivers)} follower(s): {', '.join(f.id for f in receivers)}."
            )
            if missed:
                details = ", ".join(f"{n.id} missed it ({self._miss_reason(n)})" for n in missed)
                description += f" {details}."
            self._event("replication", description)
            return self._state_locked()

    def reset(self) -> SimulationStateDict:
        with self._lock:
            self._init_cluster("Simulation reset: back to the initial 3-node cluster with Node A as leader.")
            return self._state_locked()

    def run_leader_failure(self) -> SimulationStateDict:
        """Convenience demo: crash the current leader, then hold an election."""
        with self._lock:
            leader = self._leader_node()
            if leader is None:
                raise SimulationError("There is no leader to fail — reset the simulation first.")
            if leader.status == "offline":
                raise SimulationError("The current leader is already offline.")
            self._event("system", f"Demo: crashing leader {leader.id} and triggering a new election.")
            self.crash(leader.id)
            self.start_election()
            return self._state_locked()


# Singleton used by the API and the WebSocket consumer. Single process only:
# each `manage.py runserver` process has its own copy.
engine = SimulationEngine()
