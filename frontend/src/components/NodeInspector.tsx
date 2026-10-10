import { Radio, X } from "lucide-react";

import type { SimulationState } from "../api/types";

interface Props {
  state: SimulationState;
  selectedId: string;
  onClear: () => void;
}

const TONE = {
  online: "text-emerald-400",
  offline: "text-red-400",
} as const;

export default function NodeInspector({ state, selectedId, onClear }: Props) {
  const node = state.nodes.find((n) => n.id === selectedId);
  if (!node) return null;

  // Reachable peers come straight from the backend's shared connectivity
  // calculation — the frontend never recomputes reachability.
  const reachable = node.reachable_peers;
  const unreachableReason =
    node.status === "offline"
      ? "node is offline"
      : node.partitioned
        ? "behind a partition"
        : "no active network path";

  return (
    <section
      aria-label={`Selected node ${node.id}`}
      className="rounded-xl border border-slate-800 border-l-2 border-l-teal-400 bg-slate-900/60 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Node Inspector
        </h2>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-2 text-sm sm:grid-cols-6">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">ID</p>
          <p className="font-mono font-semibold text-slate-100">{node.id}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Role</p>
          <p className="font-mono text-slate-200">{node.role}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Status</p>
          <p className={`font-mono ${TONE[node.status]}`}>{node.status}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Term</p>
          <p className="font-mono text-slate-200">{node.term}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Log</p>
          <p className="font-mono text-slate-200">{node.log_index}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Isolated</p>
          <p className={`font-mono ${node.partitioned ? "text-amber-300" : "text-slate-200"}`}>
            {node.partitioned ? "yes" : "no"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
        <Radio className="size-3.5 shrink-0 text-slate-500" />
        <span className="text-slate-500">Reachable peers:</span>
        {reachable.length === 0 ? (
          <span className="font-mono text-slate-500">none — {unreachableReason}</span>
        ) : (
          reachable.map((peer) => (
            <span
              key={peer}
              className="rounded border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 font-mono text-slate-300"
            >
              {peer}
            </span>
          ))
        )}
      </div>
    </section>
  );
}
