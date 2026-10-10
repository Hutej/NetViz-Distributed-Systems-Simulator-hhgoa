import { useState } from "react";
import { Loader2, TriangleAlert, X } from "lucide-react";

import Header from "./components/Header";
import Sidebar, { type Screen } from "./components/Sidebar";
import IntegrityLab from "./screens/IntegrityLab";
import Learn from "./screens/Learn";
import Overview from "./screens/Overview";
import ScenarioLabScreen, { type ScenarioKind } from "./screens/ScenarioLabScreen";
import Simulator from "./screens/Simulator";
import Timeline from "./screens/Timeline";
import { useSimulation } from "./hooks/useSimulation";

export default function App() {
  const sim = useSimulation();
  const [screen, setScreen] = useState<Screen>("overview");
  const [menuOpen, setMenuOpen] = useState(false);

  const navigate = (next: Screen) => {
    setScreen(next);
    setMenuOpen(false);
  };

  const runScenario = (kind: ScenarioKind) => {
    // Watch on the Simulator: navigate immediately, then start once. The
    // runner lives in useSimulation at App level, so it keeps running across
    // navigation and survives screen changes.
    setScreen("simulator");
    setMenuOpen(false);
    if (kind === "leader-failure") void sim.runLeaderFailure();
    else if (kind === "partition-replication") void sim.runPartitionReplication();
    else void sim.runLogReplication();
  };

  return (
    // min-h-screen, not h-screen: the whole page scrolls normally; the shell
    // never clips content below the fold.
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header
        restStatus={sim.restStatus}
        wsStatus={sim.wsStatus}
        onReset={() => void sim.act("reset")}
        resetDisabled={sim.scenarioActive}
        onMenu={() => setMenuOpen(true)}
      />

      {sim.error && (
        <div className="flex items-center gap-3 border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300 sm:px-6">
          <TriangleAlert className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">{sim.error}</span>
          <button type="button" onClick={sim.clearError} aria-label="Dismiss error">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="flex">
        <Sidebar
          current={screen}
          onNavigate={navigate}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
        />

        <main className="min-w-0 flex-1">
          {!sim.state ? (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="size-8 animate-spin text-teal-400" />
              <p className="text-sm">Connecting to the simulation…</p>
              {sim.restStatus === "down" && (
                <p className="max-w-sm text-center text-sm text-red-400">
                  Cannot reach the backend API. Start the Django server first:
                  <code className="mx-1 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-slate-300">
                    venv\Scripts\python manage.py runserver
                  </code>
                </p>
              )}
            </div>
          ) : (
            <>
              {screen === "overview" && (
                <Overview
                  state={sim.state}
                  onOpenSimulator={() => navigate("simulator")}
                  onOpenScenarios={() => navigate("scenarios")}
                />
              )}
              {screen === "simulator" && (
                <Simulator
                  state={sim.state}
                  selectedId={sim.selectedId}
                  selectedLink={sim.selectedLink}
                  onSelect={sim.select}
                  onSelectLink={sim.selectLink}
                  onAction={sim.act}
                  onToggleLink={sim.actLink}
                  scenarioRunning={sim.scenarioActive}
                  scenario={sim.scenario}
                  onOpenScenarios={() => navigate("scenarios")}
                />
              )}
              {screen === "scenarios" && (
                <ScenarioLabScreen
                  scenario={sim.scenario}
                  scenarioRunning={sim.scenarioActive}
                  onRun={runScenario}
                  onOpenSimulator={() => navigate("simulator")}
                />
              )}
              {screen === "timeline" && <Timeline state={sim.state} />}
              {screen === "learn" && <Learn />}
              {screen === "integrity" && <IntegrityLab />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
