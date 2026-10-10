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


class IntegrityChainTests(SimpleTestCase):
    """Hash-chain integrity demo (isolated from the cluster engine)."""

    def setUp(self):
        from .chain import ChainError, IntegrityChain

        self.chain = IntegrityChain()
        self.ChainError = ChainError

    def test_initial_chain_is_valid(self):
        state = self.chain.get_state()
        self.assertEqual(len(state["blocks"]), 3)
        self.assertTrue(state["valid"])
        self.assertIsNone(state["first_invalid"])
        for previous, block in zip(state["blocks"], state["blocks"][1:]):
            self.assertEqual(block["previous_hash"], previous["hash"])

    def test_tampering_invalidates_at_first_bad_block(self):
        state = self.chain.tamper(1, "transfer: Alice sends 500 coins to Eve")
        self.assertFalse(state["valid"])
        self.assertEqual(state["first_invalid"], 1)
        self.assertIn("no longer matches", state["reason"])
        # The stored hashes still link — only content verification fails.
        self.assertEqual(
            state["blocks"][2]["previous_hash"], state["blocks"][1]["hash"]
        )

    def test_genesis_and_unknown_index_rejected(self):
        with self.assertRaises(self.ChainError):
            self.chain.tamper(0, "nope")
        with self.assertRaises(self.ChainError):
            self.chain.tamper(99, "nope")
        self.assertTrue(self.chain.get_state()["valid"])

    def test_reset_restores_validity(self):
        self.chain.tamper(1, "transfer: Alice sends 500 coins to Eve")
        state = self.chain.reset()
        self.assertTrue(state["valid"])
        self.assertEqual(state["blocks"][1]["data"], "transfer: Alice sends 5 coins to Bob")


class LinkFaultTests(SimpleTestCase):
    """Per-link network fault injection and component-based connectivity."""

    def setUp(self):
        self.sim = SimulationEngine()

    @staticmethod
    def node(state, node_id):
        return next(n for n in state["nodes"] if n["id"] == node_id)

    def test_block_and_restore_link(self):
        state = self.sim.block_link("A", "B")
        self.assertEqual(state["blocked_links"], [["A", "B"]])
        # Endpoints are normalized: (B, A) is the same undirected link.
        with self.assertRaises(SimulationError):
            self.sim.block_link("B", "A")
        state = self.sim.restore_link("B", "A")
        self.assertEqual(state["blocked_links"], [])
        with self.assertRaises(SimulationError):
            self.sim.restore_link("A", "B")

    def test_invalid_link_requests(self):
        with self.assertRaises(SimulationError):
            self.sim.block_link("A", "A")
        with self.assertRaises(SimulationError):
            self.sim.block_link("A", "NOPE")
        with self.assertRaises(SimulationError):
            self.sim.restore_link("A", "NOPE")
        self.assertEqual(self.sim.get_state()["blocked_links"], [])

    def test_reachability_across_graph(self):
        # Blocking only A-B leaves a path A-C-B, so connectivity is
        # transitive through C and nothing is split yet.
        state = self.sim.block_link("A", "B")
        self.assertEqual(state["cluster"]["components"], [["A", "B", "C"]])
        # Blocking A-C as well cuts every path to A: A is alone.
        state = self.sim.block_link("A", "C")
        self.assertEqual(state["cluster"]["components"], [["A"], ["B", "C"]])
        self.assertEqual(self.node(state, "A")["reachable_peers"], [])
        self.assertEqual(self.node(state, "B")["reachable_peers"], ["C"])
        self.assertEqual(self.node(state, "C")["reachable_peers"], ["B"])
        # Online is not the same as connected: A is online but cut off, and
        # the (still-online) leader can no longer reach quorum.
        self.assertFalse(self.node(state, "A")["partitioned"])
        self.assertEqual(state["cluster"]["health"], "degraded")

    def test_quorum_partition_via_links_still_elects(self):
        # 5 nodes split into [A, B] and [C, D, E]; the 3-group has quorum (3).
        self.sim.add_node()
        self.sim.add_node()
        for a in ("A", "B"):
            for b in ("C", "D", "E"):
                self.sim.block_link(a, b)
        state = self.sim.start_election()
        self.assertEqual(state["cluster"]["components"], [["A", "B"], ["C", "D", "E"]])
        self.assertEqual(state["current_leader"], "C")
        self.assertEqual(state["current_term"], 2)
        # The new leader sits in a quorum-sized group, so the cluster is healthy.
        self.assertEqual(state["cluster"]["health"], "healthy")

    def test_no_quorum_partition_via_links_fails_election(self):
        # 4 nodes split into two pairs; quorum is 3, so no group qualifies.
        self.sim.add_node()
        for a in ("A", "B"):
            for b in ("C", "D"):
                self.sim.block_link(a, b)
        state = self.sim.start_election()
        self.assertIsNone(state["current_leader"])
        self.assertEqual(state["current_term"], 1)
        self.assertFalse(state["cluster"]["quorum_available"])
        self.assertIn("Election failed", state["recent_events"][-1]["description"])

    def test_replication_through_active_path_only(self):
        # 4 nodes: cut A and D off from B and C; only D remains reachable.
        self.sim.add_node()  # D
        state = self.sim.block_link("A", "B")
        state = self.sim.block_link("A", "C")
        state = self.sim.block_link("D", "B")
        state = self.sim.block_link("D", "C")
        state = self.sim.replicate()
        # D received the entry via the still-active A-D link; B and C have no
        # active network path and must not advance.
        self.assertEqual(self.node(state, "A")["log_index"], 1)
        self.assertEqual(self.node(state, "D")["log_index"], 1)
        self.assertEqual(self.node(state, "B")["log_index"], 0)
        self.assertEqual(self.node(state, "C")["log_index"], 0)
        self.assertIn("B missed it (no active network path to the leader)",
                      state["recent_events"][-1]["description"])
        self.assertNotIn("B", {m["to"] for m in state["recent_messages"]})

    def test_leader_cut_off_by_links_cannot_replicate(self):
        self.sim.block_link("A", "B")
        self.sim.block_link("A", "C")
        with self.assertRaises(SimulationError):
            self.sim.replicate()

    def test_election_after_leader_crash_still_works_with_links(self):
        self.sim.block_link("B", "C")
        self.sim.crash("A")
        state = self.sim.start_election()
        # B and C can still reach each other via the leader... no direct link,
        # but both are online and unpartitioned with only B-C blocked.
        self.assertIsNone(state["current_leader"])
        self.sim.restore_link("B", "C")
        state = self.sim.start_election()
        self.assertEqual(state["current_leader"], "B")

    def test_reset_clears_link_faults(self):
        self.sim.block_link("A", "B")
        state = self.sim.reset()
        self.assertEqual(state["blocked_links"], [])
        self.assertEqual(state["cluster"]["components"], [["A", "B", "C"]])


class LinkApiTests(SimpleTestCase):
    def setUp(self):
        engine.reset()

    def post(self, path, body=None):
        import json

        return self.client.post(
            f"/api/simulation/{path}",
            data=json.dumps(body or {}),
            content_type="application/json",
        )

    def test_link_block_and_restore_endpoints(self):
        response = self.post("link/block", {"node_a": "A", "node_b": "B"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["blocked_links"], [["A", "B"]])
        response = self.post("link/block", {"node_a": "B", "node_b": "A"})
        self.assertEqual(response.status_code, 400)
        response = self.post("link/restore", {"node_a": "A", "node_b": "B"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["blocked_links"], [])
        response = self.post("link/block", {"node_a": "A", "node_b": "NOPE"})
        self.assertEqual(response.status_code, 404)
