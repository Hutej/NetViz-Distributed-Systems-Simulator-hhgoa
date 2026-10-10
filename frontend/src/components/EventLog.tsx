import {
  Activity,
  Layers,
  LucideIcon,
  Power,
  PowerOff,
  Unlink2,
  Vote,
} from "lucide-react";

import type { EventType, SimEvent } from "../api/types";

interface Props {
  events: SimEvent[];
  className?: string;
}

const ICON: Record<EventType, LucideIcon> = {
  system: Activity,
  election: Vote,
  replication: Layers,
  crash: PowerOff,
  recovery: Power,
  partition: Unlink2,
};

const TONE: Record<EventType, string> = {
  system: "text-slate-400",
  election: "text-amber-300",
  replication: "text-sky-300",
  crash: "text-red-400",
  recovery: "text-emerald-400",
  partition: "text-orange-400",
};

function time(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString();
}

export default function EventLog({ events, className }: Props) {
  // Newest first; ids increase monotonically in the engine.
  const ordered = [...events].reverse();

  return (
    <section
      className={`flex min-h-0 flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-4 ${className ?? ""}`}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
        Event Log
      </h2>
      {ordered.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No events yet.</p>
      ) : (
        <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {ordered.map((event) => {
            const Icon = ICON[event.type];
            return (
              <li
                key={event.id}
                className="flex items-start gap-2.5 rounded-lg border border-slate-800/70 bg-slate-950/40 p-2.5 transition-colors hover:bg-slate-900/60"
              >
                <Icon className={`mt-0.5 size-4 shrink-0 ${TONE[event.type]}`} />
                <div className="min-w-0">
                  <p className="text-sm leading-snug text-slate-200">
                    {event.description}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                    {event.type} · {time(event.timestamp)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
