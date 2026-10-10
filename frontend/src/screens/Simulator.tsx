import ControlPanel from "../components/ControlPanel";
import EventLog from "../components/EventLog";
import MessagesPanel from "../components/MessagesPanel";
import NetworkCanvas from "../components/NetworkCanvas";
import NetworkPanel from "../components/NetworkPanel";
import NodeInspector from "../components/NodeInspector";
import ScenarioProgress from "../components/ScenarioProgress";
import StatsPanel from "../components/StatsPanel";
import type { ActionKind, ScenarioStatus } from "../hooks/useSimulation";
import type { SimulationState } from "../api/types";

interface Props {
  state: SimulationState;
  selectedId: string | null;
  selectedLink: [string, string] | null;
  onSelect: (id: string | null) => void;
  onSelectLink: (pair: [string, string] | null) => void;
  onAction: (kind: ActionKind, nodeId?: string) => void;
  onToggleLink: (pair: [string, string], block: boolean) => void;
  scenarioRunning: boolean;
  scenario: ScenarioStatus | null;
  onOpenScenarios: () => void;
}

const LEGEND = [
  { label: "Leader", className: "bg-emerald-400" },
  { label: "Follower", className: "bg-sky-400" },
  { label: "Candidate", className: "bg-amber-300" },
  { label: "Offline", className: "bg-red-500" },
  { label: "Isolated", className: "border border-orange-400 bg-transparent" },
  { label: "Blocked link", className: "border border-dashed border-red-400 bg-transparent" },
];

export default function Simulator({
  state,
  selectedId,
  selectedLink,
  onSelect,
  onSelectLink,
  onAction,
  onToggleLink,
  scenarioRunning,
  scenario,
  onOpenScenarios,
}: Props) {
  const active = state.nodes.filter(
    (n) => n.status === "online" && !n.partitioned
  );
  const linkCount = (active.length * (active.length - 1)) / 2;
  const healthy = state.cluster.health === "healthy";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-200">Simulator</h2>
        <p className="mt-1 text-sm text-slate-400">
          Click a node to inspect and act on it. Drag empty space to pan · drag
          a node to move it · use the canvas controls to zoom and fit.
        </p>
      </div>

      {/* Live scenario progress — visible while running and after it ends */}
      {scenario && (
        <div className="mb-5">
          <ScenarioProgress scenario={scenario} onOpenScenarios={onOpenScenarios} />
        </div>
      )}

      {/* Topology status + legend, above the canvas so nothing covers nodes */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-2.5">
        <p className="text-xs text-slate-300">
          {state.cluster.total_nodes} nodes · {linkCount} active links
          {state.blocked_links.length > 0 && (
            <span className="text-red-400">
              {" "}· {state.blocked_links.length} blocked
            </span>
          )}
          {state.cluster.components.length > 1 && (
            <span className="text-amber-300">
              {" "}· {state.cluster.components.length} components
            </span>
          )}
          {" "}·{" "}
          <span className={healthy ? "text-emerald-400" : "text-amber-300"}>
            {state.cluster.health}
          </span>
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
          {LEGEND.map((item) => (
            <span key={item.label} className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${item.className}`} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Primary workspace */}
        <div className="min-w-0 space-y-4">
          <div className="h-[420px] rounded-xl border border-slate-800 bg-gradient-to-b from-slate-900/60 to-slate-950 sm:h-[480px] lg:h-[540px]">
            <NetworkCanvas
              state={state}
              selectedId={selectedId}
              selectedLink={selectedLink}
              onSelect={onSelect}
              onSelectLink={onSelectLink}
            />
          </div>
          <StatsPanel state={state} />
        </div>

        {/* Contextual column */}
        <div className="min-w-0 space-y-4">
          {selectedId ? (
            <NodeInspector
              state={state}
              selectedId={selectedId}
              onClear={() => onSelect(null)}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-4">
              <h3 className="text-sm font-semibold text-slate-300">No node selected</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                Select a node to inspect its state and access node-specific
                controls.
              </p>
            </div>
          )}
          <NetworkPanel state={state} selectedLink={selectedLink} onToggleLink={onToggleLink} />
          <ControlPanel
            state={state}
            selectedId={selectedId}
            onAction={onAction}
            scenarioRunning={scenarioRunning}
          />
        </div>
      </div>

      {/* Secondary, below the workspace */}
      <section className="mt-8">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Cluster history
        </h3>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <EventLog events={state.recent_events} className="max-h-80" />
          <MessagesPanel messages={state.recent_messages} />
        </div>
      </section>
    </div>
  );
}
