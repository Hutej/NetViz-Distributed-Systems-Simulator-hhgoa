import { Braces, Menu, Network, Radio, RotateCcw } from "lucide-react";

import type { Connection } from "../hooks/useSimulation";

interface Props {
  restStatus: Connection;
  wsStatus: Connection;
  onReset: () => void;
  resetDisabled: boolean;
  onMenu: () => void;
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
      className="hidden items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-xs text-slate-300 sm:flex"
      title={`${label}: ${LABEL[status]}`}
    >
      <Icon className="size-3.5 text-slate-500" />
      <span className="font-medium text-slate-400">{label}</span>
      <span className={`size-2 rounded-full ${DOT[status]}`} aria-hidden />
      <span className="sr-only">{LABEL[status]}</span>
    </span>
  );
}

export default function Header({
  restStatus,
  wsStatus,
  onReset,
  resetDisabled,
  onMenu,
}: Props) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/95 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open navigation menu"
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 lg:hidden"
        >
          <Menu className="size-5" />
        </button>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/15">
          <Network className="size-5 text-teal-300" />
        </span>
        <div className="min-w-0">
          <h1 className="font-mono text-base font-bold tracking-[0.2em] text-slate-100">
            NETVIZ
          </h1>
          <p className="truncate text-xs text-slate-400">
            Distributed Systems Playground
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusPill label="REST" status={restStatus} icon={Braces} />
        <StatusPill label="WS" status={wsStatus} icon={Radio} />
        <button
          type="button"
          onClick={onReset}
          disabled={resetDisabled}
          title={resetDisabled ? "Scenario in progress" : "Reset the cluster to its initial state"}
          className={`flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm transition-colors ${
            resetDisabled
              ? "cursor-not-allowed text-slate-500 opacity-50"
              : "text-slate-300 hover:border-teal-400/50 hover:text-teal-300"
          }`}
        >
          <RotateCcw className="size-4" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      </div>
    </header>
  );
}
