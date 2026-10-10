import type { SimulationState } from "./types";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const BASE = "/api/simulation";

async function request(path: string, init?: RequestInit): Promise<SimulationState> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.detail ?? `Request failed (${response.status})`
    );
  }
  return body as SimulationState;
}

function post(path: string, body?: unknown): Promise<SimulationState> {
  return request(path, { method: "POST", body: JSON.stringify(body ?? {}) });
}

// All mutations return the complete state snapshot, same shape as the
// WebSocket updates. Relative paths only — the Vite proxy handles routing.
export const api = {
  getState: () => request("/state"),
  addNode: (nodeId?: string) => post("/nodes", nodeId ? { node_id: nodeId } : {}),
  crash: (nodeId: string) => post("/crash", { node_id: nodeId }),
  recover: (nodeId: string) => post("/recover", { node_id: nodeId }),
  startElection: () => post("/election"),
  togglePartition: (nodeId: string) => post("/partition", { node_id: nodeId }),
  replicate: () => post("/replicate"),
  reset: () => post("/reset"),
  leaderFailure: () => post("/scenarios/leader-failure"),
};
