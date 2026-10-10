import {
  ArrowRight,
  CheckCircle2,
  Layers,
  Loader2,
  LucideIcon,
  TriangleAlert,
  Unlink2,
  Zap,
} from "lucide-react";

import type { ScenarioStatus } from "../hooks/useSimulation";

export type ScenarioKind =
  | "leader-failure"
  | "partition-replication"
  | "log-replication";

interface Props {
  scenario: ScenarioStatus | null;
  scenarioRunning: boolean;
  onRun: (kind: ScenarioKind) => void;
  onOpenSimulator: () => void;
}

interface ScenarioDef {
  kind: ScenarioKind;
  /** Must match the name the hook reports in ScenarioStatus.name. */
  name: string;
  icon: LucideIcon;
  learn: string;
  startsFrom: string;
}

const SCENARIOS: ScenarioDef[] = [
  {
    kind: "leader-failure",
    name: "Leader Failure",
    icon: Zap,
    learn: "Crash the leader, observe the cluster lose its leader, and watch an election attempt to choose a replacement.",
    startsFrom: "Needs an online, reachable leader — if the cluster has none, reset it first.",
  },
  {
    kind: "partition-replication",
    name: "Partition & Replication",
    icon: Unlink2,
    learn: "Isolate a follower, replicate data, and observe why the isolated node does not receive the new entry.",
    startsFrom: "Starts from a healthy cluster — resets through the API automatically if the current state cannot run it.",
  },
  {
    kind: "log-replication",
    name: "Log Replication",
    icon: Layers,
    learn: "Send a new log entry from the leader to reachable followers and compare their log indexes.",
    startsFrom: "Starts from a healthy cluster — resets through the API automatically if the current state cannot run it.",
  },
];

export default function ScenarioLabScreen({
  scenario,
  scenarioRunning,
  onRun,
  onOpenSimulator,
}: Props) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-200">Scenario Lab</h2>
        <p className="mt-1 text-sm text-slate-400">
          Guided experiments against the live backend — every step is a real
          API call, and the outcome is always the actual cluster state.
        </p>
      </div>

      <div className="space-y-4">
        {SCENARIOS.map((definition) => {
          const isThis = scenario?.name === definition.name;
          const running = isThis && scenario?.phase === "running";
          const done = isThis && scenario?.phase === "done";
          const failed = isThis && scenario?.phase === "failed";

          return (
            <article
              key={definition.kind}
              className={`rounded-xl border p-5 ${
                failed
                  ? "border-red-500/40 bg-red-500/5"
                  : done
                    ? "border-emerald-400/40 bg-emerald-500/5"
                    : running
                      ? "border-teal-400/40 bg-teal-500/5"
                      : "border-slate-800 bg-slate-900/50"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/10">
                    <definition.icon className="size-4.5 text-teal-300" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-slate-100">
                      {definition.name}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-400">
                      {definition.learn}
                    </p>
                    <p className="mt-1.5 text-xs text-slate-500">
                      Starting condition: {definition.startsFrom}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={scenarioRunning}
                  title={
                    scenarioRunning
                      ? isThis
                        ? "Already running"
                        : "Another scenario is running"
                      : `Run ${definition.name}`
                  }
                  onClick={() => onRun(definition.kind)}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                    scenarioRunning
                      ? "cursor-not-allowed bg-slate-800 text-slate-500"
                      : "bg-teal-500/90 text-slate-950 hover:bg-teal-400"
                  }`}
                >
                  {running ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Running…
                    </>
                  ) : (
                    "Run"
                  )}
                </button>
              </div>

              {/* Live step / result for this scenario only */}
              {isThis && scenario && (
                <div className="mt-4 border-t border-slate-800/70 pt-3 text-sm">
                  {scenario.phase === "running" && (
                    <p className="flex items-center gap-2 text-teal-300">
                      <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                      {scenario.message}
                    </p>
                  )}
                  {done && (
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="flex min-w-0 flex-1 items-center gap-2 text-emerald-300">
                        <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                        {scenario.message}
                      </p>
                      <button
                        type="button"
                        onClick={onOpenSimulator}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-teal-400/50 hover:text-teal-300"
                      >
                        Return to Simulator
                        <ArrowRight className="size-3.5" aria-hidden />
                      </button>
                    </div>
                  )}
                  {failed && (
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="flex min-w-0 flex-1 items-center gap-2 text-red-300">
                        <TriangleAlert className="size-4 shrink-0" aria-hidden />
                        {scenario.message}
                      </p>
                      <button
                        type="button"
                        onClick={onOpenSimulator}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-teal-400/50 hover:text-teal-300"
                      >
                        Return to Simulator
                        <ArrowRight className="size-3.5" aria-hidden />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
