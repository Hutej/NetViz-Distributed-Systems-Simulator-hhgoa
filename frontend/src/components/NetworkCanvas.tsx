import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeChange,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { ClusterNodeState, Role, SimulationState } from "../api/types";
import ClusterNode, { type ClusterNodeData } from "./ClusterNode";

interface Props {
  state: SimulationState;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const nodeTypes = { cluster: ClusterNode };

// Default position for a node we have never seen (or dragged): a circle wide
// enough that 208px cards never overlap.
function layoutPosition(index: number, count: number) {
  const radius = count <= 3 ? 190 : 190 + (count - 3) * 55;
  const angle = (2 * Math.PI * index) / count - Math.PI / 2;
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

const MINI_COLORS: Record<Role | "offline" | "isolated", string> = {
  leader: "#34d399",
  follower: "#38bdf8",
  candidate: "#fbbf24",
  offline: "#ef4444",
  isolated: "#f59e0b",
};

const LEGEND: Array<{ label: string; className: string }> = [
  { label: "Leader", className: "bg-emerald-400" },
  { label: "Follower", className: "bg-sky-400" },
  { label: "Candidate", className: "bg-amber-300" },
  { label: "Offline", className: "bg-red-500" },
  { label: "Isolated", className: "border border-orange-400 bg-transparent" },
];

function Canvas({ state, selectedId, onSelect }: Props) {
  const { fitView } = useReactFlow();

  // Dragged positions, kept separately from backend snapshots so WebSocket
  // updates never reset the user's layout.
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const seenIdsRef = useRef<Set<string> | null>(null);

  const nodes = useMemo<Node<ClusterNodeData>[]>(
    () =>
      state.nodes.map((node, i) => ({
        id: node.id,
        type: "cluster",
        position: positions[node.id] ?? layoutPosition(i, state.nodes.length),
        data: { node },
        selected: node.id === selectedId,
      })),
    [state.nodes, positions, selectedId]
  );

  // Links only between reachable, online nodes. Edges touching the selected
  // node get a teal highlight; edges along the leader are animated.
  const edges = useMemo<Edge[]>(() => {
    const active = state.nodes.filter(
      (n) => n.status === "online" && !n.partitioned
    );
    const result: Edge[] = [];
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i];
        const b = active[j];
        const leaderLink =
          state.current_leader === a.id || state.current_leader === b.id;
        const selectedLink = selectedId === a.id || selectedId === b.id;
        result.push({
          id: `${a.id}-${b.id}`,
          source: a.id,
          target: b.id,
          animated: leaderLink,
          style: {
            stroke: selectedLink ? "#2dd4bf" : leaderLink ? "#34d399" : "#475569",
            strokeWidth: selectedLink ? 2.5 : leaderLink ? 2 : 1.5,
          },
        });
      }
    }
    return result;
  }, [state.nodes, state.current_leader, selectedId]);

  // Persist drags into the positions map; ignore React Flow's internal
  // selection changes (selection is ours via onNodeClick/onPaneClick).
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setPositions((prev) => {
      const next = { ...prev };
      let moved = false;
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          next[change.id] = change.position;
          moved = true;
        }
      }
      return moved ? next : prev;
    });
  }, []);

  // Fit on first load, and again only when the topology grows (a new node
  // appears) — never on routine state updates, which would fight the user's
  // chosen viewport.
  useEffect(() => {
    if (state.nodes.length === 0) return;
    if (seenIdsRef.current === null) {
      seenIdsRef.current = new Set(state.nodes.map((n) => n.id));
      fitView({ padding: 0.25, maxZoom: 1, duration: 400 });
      return;
    }
    const newIds = state.nodes.filter((n) => !seenIdsRef.current?.has(n.id));
    if (newIds.length > 0) {
      state.nodes.forEach((n) => seenIdsRef.current?.add(n.id));
      fitView({ padding: 0.3, maxZoom: 1.1, duration: 400 });
    }
  }, [state.nodes, fitView]);

  const healthTone =
    state.cluster.health === "healthy"
      ? "text-emerald-400"
      : "text-amber-300";

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => onSelect(node.id)}
      onPaneClick={() => onSelect(null)}
      onNodesChange={onNodesChange}
      nodesConnectable={false}
      minZoom={0.25}
      colorMode="dark"
    >
      <Background variant={BackgroundVariant.Dots} gap={26} color="#1e293b" />
      <Controls showInteractive={false} />
      <MiniMap
        pannable
        zoomable
        nodeColor={(n) => {
          const node = (n.data as ClusterNodeData | undefined)?.node as
            | ClusterNodeState
            | undefined;
          if (!node) return "#334155";
          if (node.status === "offline") return MINI_COLORS.offline;
          if (node.partitioned) return MINI_COLORS.isolated;
          return MINI_COLORS[node.role];
        }}
        nodeStrokeColor="#0f172a"
        maskColor="rgb(2 6 23 / 0.72)"
        className="!border !border-slate-800 !bg-slate-950/90 !rounded-lg"
      />

      <Panel position="top-left" className="!m-3">
        <div className="rounded-lg border border-slate-800 bg-slate-950/90 p-3 text-xs backdrop-blur">
          <p className="font-medium text-slate-300">
            {state.cluster.total_nodes} nodes · {edges.length} links ·{" "}
            <span className={healthTone}>{state.cluster.health}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-slate-400">
            {LEGEND.map((item) => (
              <span key={item.label} className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${item.className}`} />
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </Panel>
    </ReactFlow>
  );
}

export default function NetworkCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
