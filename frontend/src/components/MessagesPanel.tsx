import { ArrowRight, HeartPulse, Layers, LucideIcon, ThumbsUp, Vote } from "lucide-react";

import type { SimMessage } from "../api/types";

interface Props {
  messages: SimMessage[];
}

const ICON: Record<string, LucideIcon> = {
  heartbeat: HeartPulse,
  vote_request: Vote,
  vote: ThumbsUp,
  replication: Layers,
};

export default function MessagesPanel({ messages }: Props) {
  const ordered = [...messages].reverse();

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
        Recent Messages
      </h2>
      {ordered.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-slate-700/70 px-3 py-3 text-xs leading-relaxed text-slate-500">
          No simulated traffic yet. Run a scenario or the manual controls to
          generate heartbeats, vote requests, votes, and replication messages —
          they will appear here as the backend emits them.
        </div>
      ) : (
        <ul className="mt-3 max-h-44 space-y-1.5 overflow-y-auto pr-1">
          {ordered.map((message) => {
            const Icon = ICON[message.type] ?? ArrowRight;
            return (
              <li
                key={message.id}
                className="flex items-center gap-2 rounded-md bg-slate-950/40 px-2 py-1.5 font-mono text-xs text-slate-300 transition-colors hover:bg-slate-900"
                title={`${message.type} message, term ${message.term}, sent ${new Date(message.timestamp).toLocaleTimeString()}`}
              >
                <Icon className="size-3.5 shrink-0 text-emerald-400" />
                <span className="font-semibold text-slate-100">{message.from}</span>
                <ArrowRight className="size-3 text-slate-500" />
                <span className="font-semibold text-slate-100">{message.to}</span>
                <span className="ml-auto rounded bg-slate-800 px-1.5 py-0.5 text-slate-400">
                  {message.type} · T{message.term} ·{" "}
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
