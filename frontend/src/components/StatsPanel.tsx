import { Activity, Crown } from "lucide-react";

import type { SimulationState } from "../api/types";

interface Props {
  state: SimulationState;
}

// Compact, readable summary row — deliberately not a grid of metric cards.
export default function StatsPanel({ state }: Props) {
  const { cluster } = state;
  const healthy = cluster.health === "healthy";

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      <span className="text-slate-300">
        <span className="font-semibold text-slate-100">{cluster.total_nodes}</span> nodes
      </span>
      <span className="text-emerald-400">{cluster.online_nodes} online</span>
      {cluster.offline_nodes > 0 && (
        <span className="text-red-400">{cluster.offline_nodes} offline</span>
      )}
      <span className="text-slate-300">
        Leader:{" "}
        {state.current_leader ? (
          <span className="inline-flex items-center gap-1 font-semibold text-slate-100">
            <Crown className="size-3.5 text-amber-300" aria-hidden />
            {state.current_leader}
          </span>
        ) : (
          <span className="font-semibold text-red-400">none</span>
        )}
      </span>
      <span className="text-slate-300">
        Term <span className="font-mono font-semibold text-slate-100">{state.current_term}</span>
      </span>
      <span
        title="Health: whether the cluster currently has a reachable leader and quorum"
        className="inline-flex items-center gap-1.5"
      >
        <Activity
          className={`size-4 ${healthy ? "text-emerald-400" : "text-amber-300"}`}
          aria-hidden
        />
        <span className={healthy ? "text-emerald-400" : "text-amber-300"}>{cluster.health}</span>
      </span>
      <span
        title={`Quorum: at least ${cluster.quorum_size} of ${cluster.total_nodes} nodes must be reachable for elections to succeed`}
        className={cluster.quorum_available ? "text-emerald-400" : "text-red-400"}
      >
        {cluster.quorum_available ? "Quorum available" : "Quorum unavailable"}
      </span>
    </div>
  );
}
