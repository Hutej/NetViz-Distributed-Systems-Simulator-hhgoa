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

// One guided scenario run. "running" covers all intermediate stages; the
// message is updated per stage so users can follow along.
export interface ScenarioStatus {
  name: string;
  phase: "running" | "done" | "failed";
  message: string;
}

interface ScenarioContext {
  /** Narrate the current stage (banner updates immediately). */
  stage: (message: string) => void;
  /** End the scenario successfully with a factual summary. */
  finish: (message: string) => void;
  /** Abort the sequence and show the actual failure. */
  fail: (message: string) => void;
  /** True when the component unmounted mid-run. */
  cancelled: () => boolean;
  /** Pause so an intermediate state becomes visible. */
  wait: (ms: number) => Promise<void>;
  /** Current state, always the backend's latest snapshot. */
  state: () => SimulationState;
  /** Apply a mutation response to the app state (REST + WS arrive anyway). */
  apply: (next: SimulationState) => void;
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useSimulation() {
  const [state, setState] = useState<SimulationState | null>(null);
  const [restStatus, setRestStatus] = useState<Connection>("connecting");
  const [wsStatus, setWsStatus] = useState<Connection>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scenario, setScenario] = useState<ScenarioStatus | null>(null);

  const stateRef = useRef<SimulationState | null>(null);
  stateRef.current = state;
  const scenarioRunningRef = useRef(false);
  const scenarioCancelledRef = useRef(false);

  useEffect(() => () => void (scenarioCancelledRef.current = true), []);

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

  // Reconcile selection when a node disappears (e.g. after reset).
  useEffect(() => {
    if (state && selectedId && !state.nodes.some((n) => n.id === selectedId)) {
      setSelectedId(null);
    }
  }, [state, selectedId]);

  const act = useCallback(
    async (kind: ActionKind, nodeId?: string) => {
      setError(null);
      setScenario(null); // any manual action ends the scenario narration
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

  // Shared scenario runner: guards against duplicate runs, resets the
  // cancellation flag (Strict Mode's dev remount pre-trips it), releases the
  // guard in `finally`, and turns every failure into an honest message.
  const runScenario = useCallback(
    async (name: string, body: (ctx: ScenarioContext) => Promise<void>) => {
      if (scenarioRunningRef.current) return;
      if (!stateRef.current) return;

      scenarioCancelledRef.current = false;
      scenarioRunningRef.current = true;
      const ctx: ScenarioContext = {
        stage: (message) => setScenario({ name, phase: "running", message }),
        finish: (message) => setScenario({ name, phase: "done", message }),
        fail: (message) => setScenario({ name, phase: "failed", message }),
        cancelled: () => scenarioCancelledRef.current,
        wait: (ms) => pause(ms),
        state: () => stateRef.current as SimulationState,
        apply: (next) => {
          setState(next);
          setRestStatus("live");
        },
      };

      try {
        await body(ctx);
      } catch (err) {
        // A failed operation stops the sequence and shows the actual error.
        const message = err instanceof Error ? err.message : "Scenario failed";
        if (err instanceof ApiError && err.status >= 500) setRestStatus("down");
        ctx.fail(message);
      } finally {
        scenarioRunningRef.current = false;
      }
    },
    []
  );

  // Some scenarios want a pristine cluster. Reset through the real API only
  // when the current state cannot support the scenario (no reachable leader,
  // or any node offline / isolated).
  const prepareCluster = async (ctx: ScenarioContext): Promise<SimulationState> => {
    const current = ctx.state();
    const leader = current.nodes.find((n) => n.id === current.current_leader);
    const needsReset =
      !leader ||
      leader.status !== "online" ||
      leader.partitioned ||
      current.nodes.some((n) => n.status === "offline" || n.partitioned);
    if (!needsReset) return current;
    ctx.stage("Resetting the cluster for a predictable starting state…");
    const reset = await api.reset();
    ctx.apply(reset);
    await ctx.wait(900);
    return reset;
  };

  // Scenario 1 — Leader Failure: identify leader, crash it, watch a real
  // election. Every step is a real API call; the banner quotes backend state.
  const runLeaderFailure = useCallback(() => {
    void runScenario("Leader Failure", async (ctx) => {
      const start = ctx.state();
      const leader = start.nodes.find((n) => n.id === start.current_leader);
      if (!leader || leader.status !== "online" || leader.partitioned) {
        ctx.fail("Needs a reachable online leader — reset the cluster first.");
        return;
      }

      ctx.stage(`${leader.name} is the leader for term ${start.current_term} — crashing it next…`);
      setSelectedId(leader.id);
      await ctx.wait(1600);
      if (ctx.cancelled()) return;

      ctx.stage(`Crashing leader ${leader.id}…`);
      const crashed = await api.crash(leader.id);
      ctx.apply(crashed);
      await ctx.wait(2000); // let the leaderless cluster become visible
      if (ctx.cancelled()) return;

      ctx.stage("Election in progress — reachable nodes are casting votes…");
      await ctx.wait(1500);
      if (ctx.cancelled()) return;

      const elected = await api.startElection();
      ctx.apply(elected);

      if (elected.current_leader) {
        ctx.finish(
          `${elected.current_leader} is the new leader for term ${elected.current_term}.`
        );
      } else {
        ctx.fail(
          elected.recent_events.at(-1)?.description ??
            "Election failed — quorum is not available."
        );
      }
    });
  }, [runScenario]);

  // Scenario 2 — Partition & Replication: isolate a follower, replicate, and
  // show (from real state) that the entry never crossed the partition. The
  // partition is left in place for inspection.
  const runPartitionReplication = useCallback(() => {
    void runScenario("Partition & Replication", async (ctx) => {
      const start = await prepareCluster(ctx);
      const leader = start.nodes.find((n) => n.id === start.current_leader);
      const follower = start.nodes.find(
        (n) => n.id !== start.current_leader && n.status === "online" && !n.partitioned
      );
      if (!leader || !follower) {
        ctx.fail("No online leader/follower pair available for this scenario.");
        return;
      }

      ctx.stage(`Isolating follower ${follower.id} behind a network partition…`);
      const isolated = await api.togglePartition(follower.id);
      ctx.apply(isolated);
      await ctx.wait(1400);
      if (ctx.cancelled()) return;

      ctx.stage(
        `Replicating from leader ${leader.id} — no messages may cross the partition…`
      );
      const replicated = await api.replicate();
      ctx.apply(replicated);
      await ctx.wait(1200);
      if (ctx.cancelled()) return;

      // Read the actual result from the mutation response.
      const leaderNow = replicated.nodes.find((n) => n.id === leader.id);
      const followerNow = replicated.nodes.find((n) => n.id === follower.id);
      if (!leaderNow || !followerNow) {
        ctx.fail("Node disappeared mid-scenario — cluster state changed.");
        return;
      }
      ctx.finish(
        `Leader ${leader.id} advanced to log entry ${leaderNow.log_index}, ` +
          `but isolated ${follower.id} is stuck at ${followerNow.log_index}. ` +
          `${follower.id} remains isolated — heal the partition to let it catch up.`
      );
    });
  }, [runScenario]);

  // Scenario 3 — Log Replication: one entry to every reachable follower.
  // The follower list is derived from the backend response only.
  const runLogReplication = useCallback(() => {
    void runScenario("Log Replication", async (ctx) => {
      const start = await prepareCluster(ctx);
      const leader = start.nodes.find((n) => n.id === start.current_leader);
      if (!leader) {
        ctx.fail("No leader to replicate from.");
        return;
      }

      ctx.stage(`Leader ${leader.id} will replicate a new entry to reachable followers…`);
      await ctx.wait(1000);
      if (ctx.cancelled()) return;

      const before = start.total_messages;
      const replicated = await api.replicate();
      ctx.apply(replicated);

      const leaderNow = replicated.nodes.find((n) => n.id === leader.id);
      if (!leaderNow) {
        ctx.fail("Leader disappeared mid-scenario — cluster state changed.");
        return;
      }
      const updated = replicated.nodes.filter(
        (n) =>
          n.id !== leader.id &&
          n.status === "online" &&
          !n.partitioned &&
          n.log_index === leaderNow.log_index
      );
      const newMessages = replicated.total_messages - before;
      ctx.finish(
        `Replicated log entry ${leaderNow.log_index} to ${updated.length} ` +
          `follower(s) (${updated.map((n) => n.id).join(", ") || "none"}), ` +
          `${newMessages} message${newMessages === 1 ? "" : "s"} sent.`
      );
    });
  }, [runScenario]);

  const scenarioActive = scenario !== null && scenario.phase === "running";

  return {
    state,
    restStatus,
    wsStatus,
    error,
    clearError: () => setError(null),
    selectedId,
    select: setSelectedId,
    act,
    scenario,
    scenarioActive,
    runLeaderFailure,
    runPartitionReplication,
    runLogReplication,
  };
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
