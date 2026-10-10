import { Braces, Network, Radio, RotateCcw } from "lucide-react";

import type { Connection } from "../hooks/useSimulation";

interface Props {
  restStatus: Connection;
  wsStatus: Connection;
  onReset: () => void;
  resetDisabled: boolean;
}

const DOT: Record<Connection, string> = {
  connecting: "bg-amber-400",
  live: "bg-emerald-400",
  down: "bg-red-500",
};

const LABEL: Record<Connection, string> = {
  connecting: "connecting…",
  live: "connected",
  down: "disconnected",
};

function StatusPill({
  label,
  status,
  icon: Icon,
}: {
  label: string;
  status: Connection;
  icon: typeof Radio;
}) {
  return (
    <span
      className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-xs text-slate-300"
      title={`${label}: ${LABEL[status]}`}
    >
      <Icon className="size-3.5 text-slate-500" />
      <span className="font-medium text-slate-400">{label}</span>
      <span className={`size-2 rounded-full ${DOT[status]}`} aria-hidden />
    </span>
  );
}

export default function Header({
  restStatus,
  wsStatus,
  onReset,
  resetDisabled,
}: Props) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-slate-800 bg-slate-900/80 px-6 py-3">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/15">
          <Network className="size-5 text-emerald-400" />
        </span>
        <div>
          <h1 className="font-mono text-lg font-bold tracking-[0.2em] text-slate-100">
            NETVIZ
          </h1>
          <p className="text-xs text-slate-400">Distributed Systems Playground</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusPill label="REST" status={restStatus} icon={Braces} />
        <StatusPill label="WS" status={wsStatus} icon={Radio} />
        <button
          type="button"
          onClick={onReset}
          disabled={resetDisabled}
          title={resetDisabled ? "Demo in progress" : "Reset the simulation"}
          className={`flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm transition-colors ${
            resetDisabled
              ? "cursor-not-allowed text-slate-500 opacity-50"
              : "text-slate-300 hover:border-emerald-400/50 hover:text-emerald-300"
          }`}
        >
          <RotateCcw className="size-4" />
          Reset
        </button>
      </div>
    </header>
  );
}
