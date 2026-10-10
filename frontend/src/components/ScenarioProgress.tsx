import { ArrowLeft, CheckCircle2, FlaskConical, Loader2, TriangleAlert } from "lucide-react";

import ScenarioInsight from "./ScenarioInsight";
import type { ScenarioStatus } from "../hooks/useSimulation";

interface Props {
  scenario: ScenarioStatus | null;
  onOpenScenarios: () => void;
}

const STYLES: Record<ScenarioStatus["phase"], string> = {
  running: "border-teal-400/40 bg-teal-500/5",
  done: "border-emerald-400/40 bg-emerald-500/5",
  failed: "border-red-500/40 bg-red-500/5",
};

const TEXT: Record<ScenarioStatus["phase"], string> = {
  running: "text-teal-300",
  done: "text-emerald-300",
  failed: "text-red-300",
};

// Persistent scenario progress panel shown inside the Simulator while a
// scenario runs (and after it finishes). The runner lives in useSimulation at
// App level, so progress continues across navigation.
export default function ScenarioProgress({ scenario, onOpenScenarios }: Props) {
  if (!scenario) return null;
  const running = scenario.phase === "running";

  return (
    <section
      aria-live="polite"
      className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 ${STYLES[scenario.phase]}`}
    >
      {running ? (
        <Loader2 className="size-5 shrink-0 animate-spin text-teal-300" aria-hidden />
      ) : scenario.phase === "done" ? (
        <CheckCircle2 className="size-5 shrink-0 text-emerald-300" aria-hidden />
      ) : (
        <TriangleAlert className="size-5 shrink-0 text-red-300" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          <FlaskConical className="size-3.5" aria-hidden />
          {scenario.name} · {running ? "running" : scenario.phase}
        </p>
        <p className={`mt-1 text-sm leading-snug ${TEXT[scenario.phase]}`}>
          {scenario.message}
        </p>
        {scenario.insight && <ScenarioInsight insight={scenario.insight} />}
      </div>
      {!running && (
        <button
          type="button"
          onClick={onOpenScenarios}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-teal-400/50 hover:text-teal-300"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Back to Scenario Lab
        </button>
      )}
    </section>
  );
}
