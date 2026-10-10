import { ArrowRight, FlaskConical, Play, Unlink2, Layers, Zap, LucideIcon } from "lucide-react";

import type { SimulationState } from "../api/types";

interface Props {
  state: SimulationState;
  onOpenSimulator: () => void;
  onOpenScenarios: () => void;
}

interface Shortcut {
  icon: LucideIcon;
  title: string;
  learn: string;
}

const SHORTCUTS: Shortcut[] = [
  {
    icon: Zap,
    title: "Leader Failure",
    learn: "What happens to the cluster when the coordinating node disappears, and how a replacement is chosen.",
  },
  {
    icon: Unlink2,
    title: "Network Partition",
    learn: "Why an isolated server stops receiving updates while the rest of the cluster moves on.",
  },
  {
    icon: Layers,
    title: "Log Replication",
    learn: "How the leader shares new data, and how you can verify which followers actually received it.",
  },
];

const STEPS = [
  { title: "Select a node", detail: "Click any node in the simulator to see its state." },
  { title: "Run an experiment", detail: "Crash it, isolate it, or launch a guided scenario." },
  { title: "Observe the changes", detail: "Watch roles, terms, logs, and messages update live." },
];

export default function Overview({ state, onOpenSimulator, onOpenScenarios }: Props) {
  const healthy = state.cluster.health === "healthy";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero */}
      <section>
        <h2 className="text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">
          Understand distributed systems by breaking them.
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-400">
          Explore how servers coordinate, share data, and recover when a server
          fails. Run guided experiments and watch the network respond.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onOpenSimulator}
            className="flex items-center gap-2 rounded-lg bg-teal-500/90 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-teal-400"
          >
            <Play className="size-4" aria-hidden />
            Open Simulator
          </button>
          <button
            type="button"
            onClick={onOpenScenarios}
            className="flex items-center gap-2 rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-teal-400/50 hover:text-teal-300"
          >
            <FlaskConical className="size-4" aria-hidden />
            Run a guided experiment
          </button>
        </div>
        <p className="mt-4 text-sm text-slate-400">
          Live cluster right now:{" "}
          <span className="font-semibold text-slate-200">
            {state.cluster.online_nodes} of {state.cluster.total_nodes} nodes online
          </span>
          {state.current_leader ? (
            <>
              {" "}· leader is{" "}
              <span className="font-semibold text-slate-200">{state.current_leader}</span>
            </>
          ) : (
            " · no leader elected"
          )}
          {" "}·{" "}
          <span className={healthy ? "text-emerald-400" : "text-amber-300"}>
            {state.cluster.health}
          </span>
        </p>
      </section>

      {/* Scenario shortcuts */}
      <section className="mt-12">
        <h3 className="text-lg font-semibold text-slate-200">Guided experiments</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {SHORTCUTS.map((shortcut) => (
            <button
              key={shortcut.title}
              type="button"
              onClick={onOpenScenarios}
              className="group rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-left transition-colors hover:border-teal-400/40"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-teal-500/10">
                <shortcut.icon className="size-4.5 text-teal-300" aria-hidden />
              </span>
              <span className="mt-3 block text-sm font-semibold text-slate-200">
                {shortcut.title}
              </span>
              <span className="mt-1.5 block text-sm leading-relaxed text-slate-500">
                {shortcut.learn}
              </span>
              <span className="mt-3 flex items-center gap-1 text-xs font-medium text-teal-400/90">
                Open in Scenario Lab
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Getting started */}
      <section className="mt-12">
        <h3 className="text-lg font-semibold text-slate-200">Getting started</h3>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <span className="flex size-7 items-center justify-center rounded-full bg-slate-800 font-mono text-sm text-teal-300">
                {index + 1}
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-200">{step.title}</p>
              <p className="mt-1 text-sm text-slate-500">{step.detail}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
