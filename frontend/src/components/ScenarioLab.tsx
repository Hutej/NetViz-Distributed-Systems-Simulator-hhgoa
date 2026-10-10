import { Layers, LucideIcon, Unlink2, Zap } from "lucide-react";

interface Props {
  scenarioRunning: boolean;
  onRun: (scenario: "leader-failure" | "partition-replication" | "log-replication") => void;
}

interface ScenarioDef {
  kind: Props["onRun"] extends (s: infer S) => void ? S : never;
  title: string;
  icon: LucideIcon;
  description: string;
}

const SCENARIOS: ScenarioDef[] = [
  {
    kind: "leader-failure",
    title: "Leader Failure",
    icon: Zap,
    description: "Crash the leader and watch the cluster elect a new one, step by step.",
  },
  {
    kind: "partition-replication",
    title: "Partition & Replication",
    icon: Unlink2,
    description: "Isolate a follower, replicate a log entry, and watch it fall behind.",
  },
  {
    kind: "log-replication",
    title: "Log Replication",
    icon: Layers,
    description: "Replicate a new entry to every reachable follower in one shot.",
  },
];

export default function ScenarioLab({ scenarioRunning, onRun }: Props) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
        Scenario Lab
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Guided walkthroughs against the live backend — every step is a real
        API call and every result is real state.
      </p>
      <div className="mt-3 grid gap-2">
        {SCENARIOS.map((scenario) => (
          <button
            key={scenario.kind}
            type="button"
            disabled={scenarioRunning}
            title={scenarioRunning ? "A scenario is already running" : `Run ${scenario.title}`}
            onClick={() => onRun(scenario.kind)}
            className={`flex items-start gap-3 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-left transition-colors ${
              scenarioRunning
                ? "cursor-not-allowed opacity-50"
                : "hover:border-teal-400/50 hover:bg-slate-800/70"
            }`}
          >
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-teal-500/10">
              <scenario.icon className="size-4 text-teal-300" />
            </span>
            <span>
              <span className="block text-sm font-medium text-slate-200">
                {scenario.title}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {scenario.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
