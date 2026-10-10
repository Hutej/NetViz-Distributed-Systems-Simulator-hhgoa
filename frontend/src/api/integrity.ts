import { ApiError } from "./client";

// Hash-chain integrity demo (separate from the cluster simulation).
export interface ChainBlock {
  index: number;
  data: string;
  previous_hash: string;
  hash: string;
}

export interface IntegrityState {
  blocks: ChainBlock[];
  valid: boolean;
  first_invalid: number | null;
  reason: string | null;
}

const BASE = "/api/integrity";

async function request(path: string, init?: RequestInit): Promise<IntegrityState> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, body?.detail ?? `Request failed (${response.status})`);
  }
  return body as IntegrityState;
}

function post(path: string, body?: unknown): Promise<IntegrityState> {
  return request(path, { method: "POST", body: JSON.stringify(body ?? {}) });
}

export const integrityApi = {
  getState: () => request("/state"),
  // The backend stores the new data but never recalculates the stored hash —
  // that is exactly what makes tampering detectable.
  tamper: (index: number, data: string) => post("/tamper", { index, data }),
  validate: () => post("/validate"),
  reset: () => post("/reset"),
};
