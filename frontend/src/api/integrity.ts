import { ApiError } from "./client";

// Multi-peer blockchain simulator (Integrity Lab backend).
export interface ChainBlock {
  index: number;
  timestamp: string;
  transactions: Array<string | { id: string; sender: string; recipient: string; amount: number }>;
  previous_hash: string;
  nonce: number;
  miner: string;
  hash: string;
}

export interface PendingTx {
  id: string;
  sender: string;
  recipient: string;
  amount: number;
}

export interface PeerState {
  peer: string;
  isolated: boolean;
  height: number;
  tip_hash: string;
  pending_count: number;
  pending: PendingTx[];
  chain: ChainBlock[];
  valid: boolean;
  first_invalid: number | null;
  reason: string | null;
}

export interface RejectedPeer {
  peer: string;
  reason: string;
}

export interface OrphanedBranch {
  peer: string;
  blocks: Array<{ index: number; hash: string }>;
}

export interface IntegrityResult {
  block?: ChainBlock;
  nonce_attempts?: number;
  accepted_by?: string[];
  rejected?: RejectedPeer[];
  propagated_to?: string[];
  skipped?: RejectedPeer[];
  transaction?: PendingTx;
  winner?: string;
  height?: number;
  tip_hash?: string;
  updated?: string[];
  orphaned?: OrphanedBranch[];
  rejected_candidates?: RejectedPeer[];
  peer?: string;
  valid?: boolean;
  first_invalid?: number | null;
  reason?: string | null;
  index?: number;
}

export interface IntegrityState {
  peers: PeerState[];
  difficulty: number;
  // Backward-compatible single-chain view of peer A.
  blocks: ChainBlock[];
  valid: boolean;
  first_invalid: number | null;
  reason: string | null;
  result?: IntegrityResult;
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
  submitTransaction: (sender: string, recipient: string, amount: number, peer: string) =>
    post("/transaction", { sender, recipient, amount, peer }),
  mine: (peer: string) => post("/mine", { peer }),
  setPeer: (peer: string, isolated: boolean) => post("/peer", { peer, isolated }),
  validate: (peer: string) => post("/validate", { peer }),
  tamper: (index: number, data: string, peer: string) => post("/tamper", { index, data, peer }),
  reconcile: () => post("/reconcile"),
  reset: () => post("/reset"),
};
