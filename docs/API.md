# API reference

Base URL during development: `http://127.0.0.1:8000`. All request and response bodies are JSON. Every successful mutation returns the **complete updated state** for its service.

Error conventions:

- `400` — invalid or redundant operation; body `{"detail": "..."}`.
- `404` — unknown node/peer; body `{"detail": "..."}`.
- `422` — malformed request body (Django Ninja / pydantic validation).

## Health

| Method | Route | Body | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | — | Liveness probe → `{"status": "ok"}` |

## Distributed-systems simulation (`/api/simulation`)

All simulation operations return the full state:

```json
{
  "nodes": [ { "id", "name", "role", "status", "term", "log_index", "partitioned", "reachable_peers" } ],
  "current_leader": "A" | null,
  "current_term": 1,
  "total_messages": 0,
  "blocked_links": [["A", "B"]],
  "recent_messages": [ { "id", "type", "from", "to", "term", "timestamp" } ],
  "recent_events": [ { "id", "type", "timestamp", "description" } ],
  "cluster": { "total_nodes", "online_nodes", "offline_nodes", "quorum_size",
               "quorum_available", "health", "components" }
}
```

| Method | Route | Body | Purpose |
| --- | --- | --- | --- |
| GET | `/state` | — | Current complete state |
| POST | `/nodes` | `{node_id?}` | Add a node; a free ID is generated when omitted. Duplicate ID → 400 |
| POST | `/crash` | `{node_id}` | Take an online node offline. Unknown → 404, already offline → 400. Crashing the leader clears the leadership |
| POST | `/recover` | `{node_id}` | Bring an offline node back as a follower. Unknown → 404, already online → 400 |
| POST | `/election` | — | Run a quorum-aware election. Success bumps the term; failure leaves the cluster explicitly leaderless (still 200 — the outcome is in the state) |
| POST | `/partition` | `{node_id}` | Toggle whole-node isolation. Unknown → 404, offline node → 400 |
| POST | `/link/block` | `{node_a, node_b}` | Disable one undirected link. Unknown node → 404, self-link or already blocked → 400 |
| POST | `/link/restore` | `{node_a, node_b}` | Re-enable a blocked link. Unknown/not blocked → 400/404 |
| POST | `/replicate` | — | Replicate a log entry from the leader to reachable followers. No leader / leader offline or isolated / no reachable follower → 400 with reason |
| POST | `/reset` | — | Reset to the initial three-node cluster |
| POST | `/scenarios/leader-failure` | — | One-shot demo: crash the leader, then hold an election |

Event types: `system`, `election`, `replication`, `crash`, `recovery`, `partition` (covers node isolation and link faults). Message types: `heartbeat`, `vote_request`, `vote`, `replication`.

## Blockchain lab (`/api/integrity`)

All operations return the full state:

```json
{
  "peers": [ { "peer", "isolated", "height", "tip_hash", "pending_count", "pending",
               "chain", "valid", "first_invalid", "reason" } ],
  "difficulty": 2,
  "max_nonce": 20000,
  "blocks": [ ... peer A's chain (legacy single-chain view) ],
  "valid": true, "first_invalid": null, "reason": null,
  "result": { ... operation-specific summary, present on mutations }
}
```

Each block: `{ "index", "timestamp", "transactions", "previous_hash", "nonce", "miner", "hash" }`. A transaction: `{ "id", "sender", "recipient", "amount" }`.

| Method | Route | Body | Purpose |
| --- | --- | --- | --- |
| GET | `/state` | — | Full peer/chain state with per-peer validation verdicts |
| POST | `/transaction` | `{sender, recipient, amount, peer?="A"}` | Add a transaction to a peer's pool and propagate to reachable peers. Empty parties, identical parties, non-positive amount, unknown peer → 400/404 |
| POST | `/mine` | `{peer?="A"}` | Mine the peer's pending transactions with toy proof-of-work; `result` reports the block, `nonce_attempts`, and per-peer acceptance/rejection |
| POST | `/peer` | `{peer, isolated}` | Isolate (`true`) or reconnect (`false`) a peer. Unknown → 404 |
| POST | `/validate` | `{peer?="A"}` | Re-validate one peer's chain; `result` carries the verdict |
| POST | `/tamper` | `{index, data, peer?="A"}` | Overwrite a non-genesis block's transactions on ONE peer without recomputing its hash. Genesis/unknown index, empty data, unknown peer → 400/404 |
| POST | `/reconcile` | — | Deterministic longest-valid-chain reconciliation among reachable peers; `result` reports winner, height, orphaned branches, and rejected (invalid) candidates |
| POST | `/reset` | — | Reset all peers to identical valid histories |

## WebSocket

`ws://localhost:8000/ws/simulation/` (through the Vite dev proxy: `/ws/simulation/`)

- On connect: `101` upgrade, then one JSON message containing the current cluster state.
- After every successful cluster mutation: one JSON message with the updated state.
- Read-only: messages sent by clients are ignored. The blockchain lab does not use the socket.
