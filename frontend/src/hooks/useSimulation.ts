import { useCallback, useEffect, useRef, useState } from "react";

import { api, ApiError } from "../api/client";
import type { SimulationState } from "../api/types";

export type Connection = "connecting" | "live" | "down";

export type ActionKind =
  | "add"
  | "crash"
  | "recover"
  | "election"
  | "partition"
  | "replicate"
  | "reset";

// Stages of the leader-failure demonstration. Each stage drives real REST
// calls and lets the live backend state become visible before continuing.
export type DemoPhase = "identifying" | "crashing" | "electing" | "done" | "failed";

export interface DemoStatus {
  phase: DemoPhase;
  message: string;
}

export function useSimulation() {
  const [state, setState] = useState<SimulationState | null>(null);
  const [restStatus, setRestStatus] = useState<Connection>("connecting");
  const [wsStatus, setWsStatus] = useState<Connection>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [demo, setDemo] = useState<DemoStatus | null>(null);

  const stateRef = useRef<SimulationState | null>(null);
  stateRef.current = state;
  const demoRunningRef = useRef(false);
  const demoCancelledRef = useRef(false);

  useEffect(() => () => void (demoCancelledRef.current = true), []);

  // Initial state fetch.
  useEffect(() => {
    let cancelled = false;
    api
      .getState()
      .then((initial) => {
        if (!cancelled) {
          setState(initial);
          setRestStatus("live");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRestStatus("down");
          setError(
            err instanceof Error ? err.message : "Failed to reach the backend"
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Live updates with reconnect backoff.
  useEffect(() => {
    let closed = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let socket: WebSocket | undefined;

    const connect = () => {
      const scheme = window.location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${scheme}://${window.location.host}/ws/simulation/`);
      socket.onopen = () => {
        attempt = 0;
        setWsStatus("live");
      };
      socket.onmessage = (event) => {
        try {
          setState(JSON.parse(event.data) as SimulationState);
        } catch {
          // Ignore malformed frames; the next update resynchronizes us.
        }
      };
      socket.onclose = () => {
        if (closed) return;
        setWsStatus("down");
        attempt += 1;
        timer = setTimeout(connect, Math.min(attempt * 1000, 5000));
      };
      socket.onerror = () => socket?.close();
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      socket?.close();
    };
  }, []);

  // Drop the selection when the node disappears (e.g. after reset).
  useEffect(() => {
    if (state && selectedId && !state.nodes.some((n) => n.id === selectedId)) {
      setSelectedId(null);
    }
  }, [state, selectedId]);

  const act = useCallback(
    async (kind: ActionKind, nodeId?: string) => {
      setError(null);
      setDemo(null); // any manual action ends the demo narration
      const id = nodeId ?? selectedId;
      try {
        const next = await runAction(kind, id);
        setState(next);
        setRestStatus("live");
      } catch (err) {
        if (err instanceof ApiError && err.status >= 500) setRestStatus("down");
        setError(err instanceof Error ? err.message : "Unexpected error");
      }
    },
    [selectedId]
  );

  // Staged leader-failure demonstration. Every step is a real API call and
  // the state shown is always the backend response — nothing is fabricated.
  // Pauses let each intermediate state become visible before continuing.
  const runDemo = useCallback(async () => {
    if (demoRunningRef.current) return; // no duplicate executions
    const current = stateRef.current;
    if (!current) return;
    const leader = current.nodes.find((n) => n.id === current.current_leader);
    if (!leader || leader.status !== "online" || leader.partitioned) {
      setDemo({
        phase: "failed",
        message: "Demo needs a reachable online leader — reset the cluster first.",
      });
      return;
    }

    // Strict Mode's dev remount runs the unmount cleanup once at startup,
    // pre-tripping the flag; a new run on the live component clears it.
    // It stays true only when a real unmount happens mid-run and aborts it.
    demoCancelledRef.current = false;
    demoRunningRef.current = true;
    const stopIfCancelled = () => demoCancelledRef.current;
    try {
      // Stage 1: identify the current leader.
      setSelectedId(leader.id);
      setDemo({
        phase: "identifying",
        message: `${leader.name} is the leader for term ${current.current_term} — crashing it next…`,
      });
      await wait(1600);
      if (stopIfCancelled()) return;

      // Stage 2: crash the leader via the real API.
      setDemo({ phase: "crashing", message: `Crashing leader ${leader.id}…` });
      const crashed = await api.crash(leader.id);
      setState(crashed);
      setRestStatus("live");

      // Stage 3: let the leaderless state become visible.
      await wait(2000);
      if (stopIfCancelled()) return;

      // Stage 4: election in progress.
      setDemo({
        phase: "electing",
        message: "Election in progress — reachable nodes are casting votes…",
      });
      await wait(1500);
      if (stopIfCancelled()) return;

      // Stage 5: run the real election.
      const elected = await api.startElection();
      setState(elected);
      setRestStatus("live");

      // Stage 6: report the actual outcome, success or quorum failure.
      if (elected.current_leader) {
        setDemo({
          phase: "done",
          message: `Demo complete: ${elected.current_leader} is the new leader for term ${elected.current_term}.`,
        });
      } else {
        const failure =
          elected.recent_events.at(-1)?.description ??
          "Election failed — quorum is not available.";
        setDemo({ phase: "failed", message: failure });
      }
    } catch (err) {
      // A failed operation stops the sequence and shows the actual error.
      const message = err instanceof Error ? err.message : "Demo failed";
      if (err instanceof ApiError && err.status >= 500) setRestStatus("down");
      setDemo({ phase: "failed", message });
    } finally {
      demoRunningRef.current = false;
    }
  }, []);

  const demoActive =
    demo !== null && (demo.phase === "identifying" || demo.phase === "crashing" || demo.phase === "electing");

  return {
    state,
    restStatus,
    wsStatus,
    error,
    clearError: () => setError(null),
    selectedId,
    select: setSelectedId,
    act,
    demo,
    demoActive,
    runDemo,
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runAction(
  kind: ActionKind,
  id: string | null
): Promise<SimulationState> {
  switch (kind) {
    case "add":
      return api.addNode();
    case "election":
      return api.startElection();
    case "replicate":
      return api.replicate();
    case "reset":
      return api.reset();
    case "crash":
    case "recover":
    case "partition":
      if (!id) throw new Error("Select a node on the canvas first");
      return kind === "crash"
        ? api.crash(id)
        : kind === "recover"
          ? api.recover(id)
          : api.togglePartition(id);
  }
}
