import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";

import type { DemoStatus } from "../hooks/useSimulation";

interface Props {
  demo: DemoStatus | null;
}

const STYLES: Record<DemoStatus["phase"], string> = {
  identifying: "border-sky-400/30 bg-sky-500/10 text-sky-300",
  crashing: "border-sky-400/30 bg-sky-500/10 text-sky-300",
  electing: "border-amber-400/30 bg-amber-500/10 text-amber-300",
  done: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  failed: "border-red-500/30 bg-red-500/10 text-red-300",
};

export default function DemoBanner({ demo }: Props) {
  if (!demo) return null;
  const active =
    demo.phase === "identifying" || demo.phase === "crashing" || demo.phase === "electing";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-3 border-b px-6 py-2 text-sm ${STYLES[demo.phase]}`}
    >
      {demo.phase === "done" ? (
        <CheckCircle2 className="size-4 shrink-0" />
      ) : demo.phase === "failed" ? (
        <TriangleAlert className="size-4 shrink-0" />
      ) : (
        <Loader2 className="size-4 shrink-0 animate-spin" />
      )}
      <span className="min-w-0 flex-1">
        {demo.message}
        {active && <span className="sr-only"> (demo in progress)</span>}
      </span>
    </div>
  );
}
