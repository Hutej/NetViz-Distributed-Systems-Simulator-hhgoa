import { Loader2, TriangleAlert, X } from "lucide-react";

import ControlPanel from "./components/ControlPanel";
import DemoBanner from "./components/DemoBanner";
import EventLog from "./components/EventLog";
import Header from "./components/Header";
import MessagesPanel from "./components/MessagesPanel";
import NetworkCanvas from "./components/NetworkCanvas";
import StatsPanel from "./components/StatsPanel";
import { useSimulation } from "./hooks/useSimulation";

export default function App() {
  const sim = useSimulation();

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <Header
        restStatus={sim.restStatus}
        wsStatus={sim.wsStatus}
        onReset={() => void sim.act("reset")}
        resetDisabled={sim.demoActive}
      />

      <DemoBanner demo={sim.demo} />

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
          <Loader2 className="size-8 animate-spin text-emerald-400" />
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
          <section className="flex min-w-0 flex-col gap-4">
            <div className="min-h-[320px] flex-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
              <NetworkCanvas
                state={sim.state}
                selectedId={sim.selectedId}
                onSelect={sim.select}
              />
            </div>
            <StatsPanel state={sim.state} />
          </section>
          <aside className="flex min-h-0 flex-col gap-4">
            <ControlPanel
              state={sim.state}
              selectedId={sim.selectedId}
              onAction={sim.act}
              demoRunning={sim.demoActive}
              onDemo={() => void sim.runDemo()}
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
