import { Unlink2 } from "lucide-react";

import type { SimulationState } from "../api/types";

interface Props {
  state: SimulationState;
  selectedLink: [string, string] | null;
  onToggleLink: (pair: [string, string], block: boolean) => void;
}

function linkBlocked(state: SimulationState, pair: [string, string]): boolean {
  const key = [...pair].sort().join("~");
  return state.blocked_links.some((p) => [...p].sort().join("~") === key);
}

// Small network connectivity inspector: connected components, reachable
// peers and quorum reachability for the selected node — all values come
// from the backend's shared connectivity calculation. Also hosts the
// block/restore action for a selected link.
export default function NetworkPanel({ state, selectedLink, onToggleLink }: Props) {
  const { cluster } = state;
  const linkIsBlocked = selectedLink !== null && linkBlocked(state, selectedLink);

  return (
    <section
      aria-label="Network connectivity"
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
        Network
      </h2>

      <div className="mt-3 space-y-2.5 text-xs text-slate-400">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">
            Connected components
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 font-mono">
            {cluster.components.map((component) => (
              <span
                key={component.join()}
                title={component.length >= cluster.quorum_size ? "This group reaches quorum" : "Below quorum"}
                className={`rounded border px-1.5 py-0.5 ${
                  component.length >= cluster.quorum_size
                    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                    : "border-slate-700 bg-slate-800/60 text-slate-400"
                }`}
              >
                {component.join("·")}
              </span>
            ))}
          </p>
        </div>
        <p className="text-slate-500">
          Quorum: <span className="font-mono text-slate-300">{cluster.quorum_size}</span> of{" "}
          {cluster.total_nodes} nodes needed
          {selectedLink === null ? "" : " — selected link below"}
        </p>
      </div>

      {selectedLink !== null && (
        <div className="mt-3 border-t border-slate-800/70 pt-3">
          <p className="flex items-center gap-2 text-sm text-slate-200">
            <Unlink2
              className={`size-4 ${linkIsBlocked ? "text-red-400" : "text-emerald-400"}`}
              aria-hidden
            />
            Link <span className="font-mono font-semibold">{selectedLink[0]}–{selectedLink[1]}</span>
            <span className={linkIsBlocked ? "text-red-400" : "text-emerald-400"}>
              {linkIsBlocked ? "blocked" : "active"}
            </span>
          </p>
          <button
            type="button"
            onClick={() => onToggleLink(selectedLink, !linkIsBlocked)}
            className={`mt-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              linkIsBlocked
                ? "border-emerald-400/40 text-emerald-300 hover:border-emerald-300 hover:bg-emerald-500/10"
                : "border-red-500/40 text-red-300 hover:border-red-400 hover:bg-red-500/10"
            }`}
          >
            {linkIsBlocked ? "Restore this link" : "Block this link"}
          </button>
        </div>
      )}
    </section>
  );
}
