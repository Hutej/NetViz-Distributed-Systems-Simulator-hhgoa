# Architecture

NetViz is a single-process educational application: one Django process (served by Daphne over ASGI) hosts two independent in-memory simulation services, and a React single-page app drives them over HTTP (and one WebSocket for live cluster updates).

## Components

```
frontend/ (React 19, TypeScript, Vite)
  src/api/          typed fetch clients (simulation, integrity)
  src/hooks/        useSimulation — single app state store, WebSocket, scenarios
  src/components/   React Flow canvas, node/link inspectors, panels, shell
  src/screens/      Overview · Simulator · Scenario Lab · Event Timeline · Learn · Integrity Lab

backend/
  natives/          Django project: settings, root urls, ASGI entry, API registration
  sim/
    engine.py             distributed-systems engine (the only cluster state)
    schemas.py            typed request schemas + TypedDict response contracts
    controllers.py        /api/simulation/* (thin wrappers over the engine)
    chain.py              blockchain simulation service (separate state)
    chain_controller.py   /api/integrity/*
    tests.py              43 tests across both services
    consumers.py          /ws/simulation/ WebSocket consumer
  scripts/ws_check.py     stdlib end-to-end WebSocket verification
```

## Distributed-systems engine (`sim/engine.py`)

- Single source of truth for the cluster: nodes (role/status/term/log index/isolation), current leader, term, event log, message log, and the set of blocked links.
- All state transitions run under a re-entrant lock, because Django runs synchronous API handlers on a thread pool.
- **Connectivity is computed once and consumed everywhere**: a BFS over online, non-isolated nodes with unblocked links yields the connected components. From that one calculation derive per-node reachable peers, quorum availability, cluster health, election eligibility, and replication targets. Neither the API layer nor the frontend recomputes reachability.
- Elections: a candidate can only win from a connected group of at least `floor(n/2)+1` nodes; the winner is the smallest eligible node ID in such a group. Failed elections leave the cluster explicitly leaderless.
- Replication: the leader's log entry goes to followers reachable through the graph; the event log records who received it and who missed it, with a reason (offline / isolated / no active network path).

## Blockchain engine (`sim/chain.py`)

- Three peers (A, B, C), each with its own chain, pending transaction pool, isolation flag, and validation verdict. All start from one canonical deep-copied history.
- Blocks: index, timestamp, transactions, previous hash, nonce, miner, and a SHA-256 hash over canonical JSON (`json.dumps` with sorted keys). Mining is a bounded brute-force nonce search for two leading hex zeros; the attempt count is reported.
- Mining validates the block before accepting it; propagation to reachable peers may honestly reject (isolated, stale, or competing branch). Accepted blocks clear the transactions they confirm from each accepting peer's pool.
- Reconciliation picks the longest valid chain among reachable peers (ties: smallest tip hash, then peer name) and reports orphaned blocks per peer. Isolated peers are never modified.
- Validation checks structure, index sequence, previous-hash links, content hashes, and the proof-of-work rule, reporting the first invalid block with an exact reason.
- The blockchain engine shares **no state** with the distributed-systems engine. It has no WebSocket: clients re-fetch state after each REST mutation.

## API surface

- `natives/api.py` registers a NinjaExtraAPI at `/api/` with three controllers: health, simulation, integrity. Full route reference: [API.md](API.md).
- Errors: domain errors are raised as `SimulationError`/`ChainError` with an HTTP status (400 or 404) and returned as `{"detail": "..."}`; request-schema failures return Django Ninja's standard 422 responses.

## Real-time flow (cluster simulation only)

1. A browser connects to `ws://…/ws/simulation/`; the consumer joins the `simulation` channel group and immediately sends the current engine state.
2. Every successful REST mutation calls the engine, then broadcasts the new state to the group via `async_to_sync(channel_layer.group_send)`.
3. The frontend applies the broadcast (and the REST response — they are identical), so all connected dashboards stay in sync.

## Frontend state model

`useSimulation` holds the single application state store. REST responses and WebSocket broadcasts write to the same store; selection, dragged node positions, and viewport are local UI state kept separate from backend state, so live updates never overwrite user interaction. The Integrity Lab screen manages its own local state from REST responses.

## Educational limitations (by design)

- One process, no persistence: a server restart resets all state.
- No authentication, no production hardening (`DEBUG=True`, placeholder secret key).
- Elections are deterministic and instant — no timers, no split-brain resolution, at most one leader.
- Blockchain peers are not machines: fixed toy difficulty, no signatures/wallets/economics, no concurrent mining races; orphaned transactions are dropped rather than returned to pools.
