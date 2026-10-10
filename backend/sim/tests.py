from django.test import SimpleTestCase

from .engine import SimulationEngine, SimulationError, engine


def node(state, node_id):
    return next(n for n in state["nodes"] if n["id"] == node_id)


class EngineStateTests(SimpleTestCase):
    def setUp(self):
        self.sim = SimulationEngine()

    def test_initial_state(self):
        state = self.sim.get_state()
        self.assertEqual([n["id"] for n in state["nodes"]], ["A", "B", "C"])
        self.assertTrue(all(n["status"] == "online" for n in state["nodes"]))
        self.assertEqual(state["current_leader"], "A")
        self.assertEqual(node(state, "A")["role"], "leader")
        self.assertEqual(node(state, "B")["role"], "follower")
        self.assertEqual(node(state, "C")["role"], "follower")
        self.assertEqual(state["current_term"], 1)
        self.assertEqual(state["cluster"]["health"], "healthy")
        self.assertEqual(state["cluster"]["quorum_size"], 2)
        self.assertTrue(state["cluster"]["quorum_available"])

    def test_add_node_default_and_custom_id(self):
        state = self.sim.add_node()
        self.assertEqual(node(state, "D")["role"], "follower")
        self.assertEqual(state["cluster"]["total_nodes"], 4)
        state = self.sim.add_node("Zeta")
        self.assertEqual(node(state, "Zeta")["name"], "Node Zeta")
        with self.assertRaises(SimulationError):
            self.sim.add_node("Zeta")

    def test_crash_requires_online_node(self):
        self.sim.crash("B")
        with self.assertRaises(SimulationError):
            self.sim.crash("B")
        with self.assertRaises(SimulationError):
            self.sim.recover("A")  # already online
        with self.assertRaises(SimulationError):
            self.sim.crash("NOPE")

    def test_crash_and_recover(self):
        state = self.sim.crash("B")
        self.assertEqual(node(state, "B")["status"], "offline")
        self.assertEqual(state["cluster"]["online_nodes"], 2)
        self.assertEqual(state["current_leader"], "A")  # leader still alive
        state = self.sim.recover("B")
        self.assertEqual(node(state, "B")["status"], "online")
        self.assertEqual(node(state, "B")["role"], "follower")
        self.assertEqual(node(state, "B")["log_index"], 0)

    def test_crashing_leader_leaves_cluster_without_leader(self):
        state = self.sim.crash("A")
        self.assertIsNone(state["current_leader"])
        self.assertEqual(state["cluster"]["health"], "degraded")


class EngineElectionTests(SimpleTestCase):
    def setUp(self):
        self.sim = SimulationEngine()

    def test_election_after_leader_crash(self):
        self.sim.crash("A")
        state = self.sim.start_election()
        self.assertEqual(state["current_leader"], "B")  # smallest eligible ID
        self.assertEqual(state["current_term"], 2)
        self.assertEqual(node(state, "B")["role"], "leader")
        self.assertEqual(node(state, "C")["role"], "follower")
        self.assertEqual(node(state, "C")["term"], 2)
        self.assertNotIn("candidate", [n["role"] for n in state["nodes"]])
        self.assertEqual(state["cluster"]["health"], "healthy")

    def test_election_fails_without_quorum(self):
        self.sim.crash("A")
        self.sim.crash("B")
        state = self.sim.start_election()
        self.assertIsNone(state["current_leader"])
        self.assertEqual(state["current_term"], 1)  # term only rises on success
        self.assertFalse(state["cluster"]["quorum_available"])
        self.assertEqual(state["cluster"]["health"], "degraded")
        self.assertIn("Election failed", state["recent_events"][-1]["description"])

    def test_election_skips_partitioned_nodes(self):
        self.sim.toggle_partition("B")
        self.sim.crash("A")
        state = self.sim.start_election()
        # Eligible: C only (B isolated) — quorum for 3 nodes is 2, so this fails.
        self.assertIsNone(state["current_leader"])
        self.sim.toggle_partition("B")  # heal
        state = self.sim.start_election()
        self.assertEqual(state["current_leader"], "B")

    def test_leader_failure_demo(self):
        state = self.sim.run_leader_failure()
        self.assertEqual(node(state, "A")["status"], "offline")
        self.assertEqual(state["current_leader"], "B")
        self.assertEqual(state["current_term"], 2)


class EnginePartitionReplicationTests(SimpleTestCase):
    def setUp(self):
        self.sim = SimulationEngine()

    def test_replication_reaches_only_reachable_followers(self):
        self.sim.toggle_partition("B")
        state = self.sim.replicate()
        self.assertEqual(node(state, "A")["log_index"], 1)
        self.assertEqual(node(state, "C")["log_index"], 1)
        self.assertEqual(node(state, "B")["log_index"], 0)  # isolated, untouched
        sent_to = {m["to"] for m in state["recent_messages"]}
        self.assertNotIn("B", sent_to)
        # Healing restores connectivity and replication reaches B again.
        self.sim.toggle_partition("B")
        state = self.sim.replicate()
        self.assertEqual(node(state, "B")["log_index"], 2)

    def test_replication_requires_reachable_leader(self):
        self.sim.toggle_partition("A")  # isolate the leader itself
        with self.assertRaises(SimulationError):
            self.sim.replicate()
        self.sim.toggle_partition("A")
        self.sim.replicate()  # leader reachable again — works

    def test_replication_requires_leader(self):
        self.sim.crash("A")  # no leader
        with self.assertRaises(SimulationError):
            self.sim.replicate()

    def test_partition_requires_online_node(self):
        self.sim.crash("C")
        with self.assertRaises(SimulationError):
            self.sim.toggle_partition("C")
        with self.assertRaises(SimulationError):
            self.sim.toggle_partition("NOPE")

    def test_reset(self):
        self.sim.add_node()
        self.sim.crash("A")
        self.sim.toggle_partition("C")
        state = self.sim.reset()
        self.assertEqual([n["id"] for n in state["nodes"]], ["A", "B", "C"])
        self.assertEqual(state["current_leader"], "A")
        self.assertEqual(state["current_term"], 1)
        self.assertEqual(state["total_messages"], 0)
        self.assertTrue(all(n["status"] == "online" and not n["partitioned"] for n in state["nodes"]))
        self.assertEqual(state["cluster"]["health"], "healthy")


class SimulationApiTests(SimpleTestCase):
    """HTTP-level checks against the shared singleton engine."""

    def setUp(self):
        engine.reset()

    def post(self, path, body=None):
        import json

        return self.client.post(
            f"/api/simulation/{path}",
            data=json.dumps(body or {}),
            content_type="application/json",
        )

    def test_state_endpoint(self):
        response = self.client.get("/api/simulation/state")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["current_leader"], "A")

    def test_crash_endpoint_and_validation_errors(self):
        response = self.post("crash", {"node_id": "B"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["cluster"]["online_nodes"], 2)

        # Already offline -> 400, unknown node -> 404.
        response = self.post("crash", {"node_id": "B"})
        self.assertEqual(response.status_code, 400)
        response = self.post("crash", {"node_id": "NOPE"})
        self.assertEqual(response.status_code, 404)
        # B is down but leader A and C remain — replication still works.
        response = self.client.post("/api/simulation/replicate", content_type="application/json")
        self.assertEqual(response.status_code, 200)

    def test_replicate_without_leader_returns_error(self):
        self.post("crash", {"node_id": "A"})  # leader down, no election yet
        response = self.client.post("/api/simulation/replicate", content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("no leader", response.json()["detail"])

    def test_add_node_and_scenario_endpoints(self):
        response = self.post("nodes", {})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["cluster"]["total_nodes"], 4)
        response = self.client.post(
            "/api/simulation/scenarios/leader-failure", content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["current_leader"], "B")

    def test_health_still_works(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
