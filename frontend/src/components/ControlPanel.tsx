import {
  Layers,
  LucideIcon,
  Power,
  PowerOff,
  Plus,
  RotateCcw,
  Unlink2,
  Vote,
} from "lucide-react";

import type { SimulationState } from "../api/types";
import type { ActionKind } from "../hooks/useSimulation";

interface Props {
  state: SimulationState;
  selectedId: string | null;
  onAction: (kind: ActionKind, nodeId?: string) => void;
  scenarioRunning: boolean;
}

interface ButtonDef {
  kind: ActionKind;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
  reason?: string;
}

export default function ControlPanel({
  state,
  selectedId,
  onAction,
  scenarioRunning,
}: Props) {
  const selected = state.nodes.find((n) => n.id === selectedId) ?? null;
  const leader = state.nodes.find((n) => n.id === state.current_leader) ?? null;
  const reachable = state.nodes.filter(
    (n) => n.status === "online" && !n.partitioned
  );
  const leaderReachable =
    leader !== null && leader.status === "online" && !leader.partitioned;
  const reachableFollowers = leaderReachable
    ? reachable.filter((n) => n.id !== leader.id)
    : [];

  const buttons: ButtonDef[] = [
    { kind: "add", label: "Add Node", icon: Plus, reason:
        scenarioRunning ? "Scenario in progress" : undefined },
    { kind: "election", label: "Start Election", icon: Vote, reason:
        scenarioRunning ? "Scenario in progress"
        : reachable.length === 0 ? "No online node is eligible" : undefined },
    {
      kind: "replicate",
      label: "Replicate Entry",
      icon: Layers,
      reason: scenarioRunning
        ? "Scenario in progress"
        : !leader
          ? "No leader elected"
          : !leaderReachable
            ? "Leader is unreachable"
            : reachableFollowers.length === 0
              ? "No reachable followers"
              : undefined,
    },
    {
      kind: "crash",
      label: "Crash Node",
      icon: PowerOff,
      danger: true,
      reason: !selected
        ? "Select a node on the canvas"
        : selected.status === "offline"
          ? "Node is already offline"
          : undefined,
    },
    {
      kind: "recover",
      label: "Recover Node",
      icon: Power,
      reason: !selected
        ? "Select a node on the canvas"
        : selected.status === "online"
          ? "Node is already online"
          : undefined,
    },
    {
      kind: "partition",
      label: selected?.partitioned ? "Heal Partition" : "Isolate Node",
      icon: Unlink2,
      reason: !selected
        ? "Select a node on the canvas"
        : selected.status === "offline"
          ? "Offline nodes cannot be isolated"
          : undefined,
    },
    {
      kind: "reset",
      label: "Reset Simulation",
      icon: RotateCcw,
      danger: true,
      reason: scenarioRunning ? "Scenario in progress" : undefined,
    },
  ];

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
        Controls
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        {selected
          ? `Selected: ${selected.name} — ${selected.role}, ${selected.status}${selected.partitioned ? ", isolated" : ""}`
          : "Click a node on the canvas to enable node actions."}
      </p>
      <p className="mt-1 text-xs text-slate-600">
        Crash takes a node offline · Recover brings it back · Isolate simulates a
        network partition
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {buttons.map((button) => (
          <button
            key={button.kind}
            type="button"
            disabled={button.reason !== undefined}
            title={button.reason ?? button.label}
            onClick={() => onAction(button.kind)}
            className={`flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm transition-colors ${
              button.reason !== undefined
                ? "cursor-not-allowed text-slate-500 opacity-50"
                : button.danger
                  ? "text-slate-300 hover:border-red-400/60 hover:text-red-300"
                  : "text-slate-300 hover:border-emerald-400/50 hover:text-emerald-300"
            }`}
          >
            <button.icon className="size-4 shrink-0" />
            <span className="truncate">{button.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
