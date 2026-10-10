import {
  Crown,
  Hash,
  HeartPulse,
  LucideIcon,
  Power,
  PowerOff,
  Scale,
  Send,
  Server,
} from "lucide-react";

import type { SimulationState } from "../api/types";

interface Props {
  state: SimulationState;
}

interface Stat {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "good" | "bad" | "warn";
}

export default function StatsPanel({ state }: Props) {
  const { cluster } = state;
  const stats: Stat[] = [
    { label: "Nodes", value: String(cluster.total_nodes), icon: Server },
    { label: "Online", value: String(cluster.online_nodes), icon: Power, tone: "good" },
    { label: "Offline", value: String(cluster.offline_nodes), icon: PowerOff, tone: cluster.offline_nodes > 0 ? "bad" : undefined },
    { label: "Leader", value: state.current_leader ?? "None", icon: Crown, tone: state.current_leader ? "warn" : "bad" },
    { label: "Term", value: String(state.current_term), icon: Hash },
    { label: "Messages", value: String(state.total_messages), icon: Send },
    {
      label: "Health",
      value: cluster.health,
      icon: HeartPulse,
      tone: cluster.health === "healthy" ? "good" : "bad",
    },
    {
      label: "Quorum",
      value: cluster.quorum_available ? "Available" : "Unavailable",
      icon: Scale,
      tone: cluster.quorum_available ? "good" : "bad",
    },
  ];

  const TONE = {
    good: "text-emerald-400",
    bad: "text-red-400",
    warn: "text-amber-300",
  } as const;

  return (
    <section aria-label="Cluster statistics" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2"
        >
          <stat.icon className="size-4 shrink-0 text-slate-500" />
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              {stat.label}
            </p>
            <p className={`truncate font-mono text-sm font-semibold ${stat.tone ? TONE[stat.tone] : "text-slate-200"}`}>
              {stat.value}
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}
