import { Loader2, TriangleAlert, X } from "lucide-react";

import ControlPanel from "./components/ControlPanel";
import EventLog from "./components/EventLog";
import Header from "./components/Header";
import MessagesPanel from "./components/MessagesPanel";
import NetworkCanvas from "./components/NetworkCanvas";
import NodeInspector from "./components/NodeInspector";
import ScenarioBanner from "./components/ScenarioBanner";
import ScenarioLab from "./components/ScenarioLab";
import StatsPanel from "./components/StatsPanel";
import { useSimulation } from "./hooks/useSimulation";

export default function App() {
  const sim = useSimulation();

  const runScenario =
    (kind: "leader-failure" | "partition-replication" | "log-replication") => {
      if (kind === "leader-failure") void sim.runLeaderFailure();
      else if (kind === "partition-replication") void sim.runPartitionReplication();
      else void sim.runLogReplication();
    };

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <Header
        restStatus={sim.restStatus}
        wsStatus={sim.wsStatus}
        onReset={() => void sim.act("reset")}
        resetDisabled={sim.scenarioActive}
      />

      <ScenarioBanner scenario={sim.scenario} />

      {sim.error && (
        <div className="flex items-center gap-3 border-b border-red-500/30 bg-red-500/10 px-6 py-2 text-sm text-red-300">
          <TriangleAlert className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{sim.error}</span>
          <button type="button" onClick={sim.clearError} aria-label="Dismiss error">
            <X className="size-4" />
          </button>
        </div>
      )}

      {!sim.state ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="size-8 animate-spin text-teal-400" />
          <p className="text-sm">Connecting to the simulation…</p>
          {sim.restStatus === "down" && (
            <p className="text-sm text-red-400">
              Cannot reach the backend API. Is the Django server running on
              port 8000?
            </p>
          )}
        </div>
      ) : (
        <main className="grid flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:overflow-hidden">
          <section className="flex min-w-0 flex-col gap-3">
            <div className="min-h-[320px] flex-1 overflow-hidden rounded-xl border border-slate-800 bg-gradient-to-b from-slate-900/60 to-slate-950">
              <NetworkCanvas
                state={sim.state}
                selectedId={sim.selectedId}
                onSelect={sim.select}
              />
            </div>
            {sim.selectedId && (
              <NodeInspector
                state={sim.state}
                selectedId={sim.selectedId}
                onClear={() => sim.select(null)}
              />
            )}
            <StatsPanel state={sim.state} />
          </section>
          <aside className="flex min-h-0 flex-col gap-3">
            <ScenarioLab
              scenarioRunning={sim.scenarioActive}
              onRun={runScenario}
            />
            <ControlPanel
              state={sim.state}
              selectedId={sim.selectedId}
              onAction={sim.act}
              scenarioRunning={sim.scenarioActive}
            />
            <EventLog
              events={sim.state.recent_events}
              className="min-h-0 flex-1"
            />
            <MessagesPanel messages={sim.state.recent_messages} />
          </aside>
        </main>
      )}
    </div>
  );
}
