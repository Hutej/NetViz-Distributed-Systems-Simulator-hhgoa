import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";

import type { ScenarioStatus } from "../hooks/useSimulation";

interface Props {
  scenario: ScenarioStatus | null;
}

const STYLES: Record<ScenarioStatus["phase"], string> = {
  running: "border-sky-400/30 bg-sky-500/10 text-sky-300",
  done: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  failed: "border-red-500/30 bg-red-500/10 text-red-300",
};

export default function ScenarioBanner({ scenario }: Props) {
  if (!scenario) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-3 border-b px-6 py-2 text-sm ${STYLES[scenario.phase]}`}
    >
      {scenario.phase === "done" ? (
        <CheckCircle2 className="size-4 shrink-0" />
      ) : scenario.phase === "failed" ? (
        <TriangleAlert className="size-4 shrink-0" />
      ) : (
        <Loader2 className="size-4 shrink-0 animate-spin" />
      )}
      <span className="min-w-0 flex-1">
        <span className="font-semibold">{scenario.name}:</span> {scenario.message}
        {scenario.phase === "running" && (
          <span className="sr-only"> (scenario in progress)</span>
        )}
      </span>
    </div>
  );
}
