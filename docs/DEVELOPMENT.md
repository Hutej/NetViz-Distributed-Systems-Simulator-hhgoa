# Development guide

Everything needed to run, test, and work on NetViz on Windows. No database, no Docker, no cloud services — the entire application runs from two terminals.

## Setup

```bat
git clone https://github.com/Hutej/NetViz-Distributed-Simulator-hhgoa.git
cd NetViz-Distributed-Simulator-hhgoa
```

**Backend** (Python 3.11+; developed on 3.13):

```bat
cd backend
python -m venv venv
venv\Scripts\pip install -r requirements.txt
venv\Scripts\python manage.py runserver
```

**Frontend** (Node 20.19+ or 22.12+; developed on Node 22):

```bat
cd frontend
npm install
npm run dev
```

Open the Vite URL (usually `http://localhost:5173`; if occupied, use the port Vite prints). The Vite dev server proxies `/api` and `/ws` to `http://localhost:8000`, so no CORS setup is needed.

## Tests and checks

```bat
:: Backend (from backend\)
venv\Scripts\python manage.py check        :: Django system checks
venv\Scripts\python manage.py test         :: full test suite (43 tests)

:: Frontend (from frontend\)
npm run build                              :: tsc --strict + production build

:: End-to-end WebSocket check (backend must be running)
cd backend
venv\Scripts\python scripts\ws_check.py
```

The test suite is intentionally fast (no database): it covers the distributed-systems engine (initial state, crashes/recovery, elections, quorum, partitions, link faults, replication, resets), the blockchain service (hashing, mining, transactions, forks, reconciliation, tampering), and HTTP-level API behavior including error codes.

## Code layout

- **Simulation logic lives only in the services** — `sim/engine.py` (cluster) and `sim/chain.py` (blockchain). Controllers in `sim/controllers.py` / `sim/chain_controller.py` are thin: call the service, broadcast (cluster only), return state. Don't add logic to controllers.
- **The frontend never computes simulation facts.** Connectivity, quorum, and validation come from the backend; frontend state like selection, node positions, and viewport is kept separate from backend snapshots.
- Response shapes are shared between REST and WebSocket on purpose — keep them that way (see `sim/schemas.py` for the typed contracts).

## Troubleshooting

| Problem | Cause / fix |
| --- | --- |
| `ModuleNotFoundError` on `manage.py` | Requirements not installed in the venv — run the pip command above. |
| Port 8000 busy (`WinError 10048`) | Another process holds it; stop it or run on another port and update `frontend/vite.config.ts`. |
| Vite on port 5174+ | 5173 was occupied; use the printed URL. |
| `ninja_extra app is not installed` | The venv is missing packages — reinstall requirements. |
| State disappeared | In-memory by design: restarting Django (or the auto-reloader after code changes) resets everything. |
| WebSocket disconnects in the browser | The Django process restarted; the UI reconnects automatically. |

## Contributing

- Keep changes small and run the three checks above before opening a PR.
- Don't add dependencies without a strong reason; the project deliberately avoids databases, auth, and external services.
- Preserve the honest-education framing: simulation behavior should stay deterministic, explainable, and clearly labeled as a simplified model.
