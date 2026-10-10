import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeChange,
  type Viewport,
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

// NetworkCanvas unmounts whenever the user navigates away from Simulator,
// but dragged positions, the fitted-flag and the user's viewport must survive
// navigation. Module-level store for this single-instance dashboard.
const layoutStore = {
  positions: {} as Record<string, { x: number; y: number }>,
  seenIds: new Set<string>(),
  viewport: null as Viewport | null,
};

// Default position for a node we have never seen (or dragged): a circle wide
// enough that 224px cards never overlap.
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

function Canvas({ state, selectedId, onSelect }: Props) {
  const { fitView } = useReactFlow();

  const [positions, setPositions] = useState(layoutStore.positions);

  useEffect(() => {
    layoutStore.positions = positions;
  }, [positions]);

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

  // Persist drags; ignore React Flow's internal selection changes (selection
  // is ours via onNodeClick/onPaneClick).
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

  // First visit: frame the whole graph once the instance (and container
  // dimensions) exist. Returning visits: restore the user's viewport.
  const onInit = useCallback((instance: { fitView: (params: { padding: number; maxZoom: number }) => void; setViewport: (vp: Viewport) => void }) => {
    if (layoutStore.viewport) {
      instance.setViewport(layoutStore.viewport);
    } else {
      instance.fitView({ padding: 0.2, maxZoom: 1.25 });
    }
  }, []);

  const onMoveEnd = useCallback((_event: unknown, viewport: Viewport) => {
    layoutStore.viewport = viewport;
  }, []);

  // Refit only when the topology grows — never on routine state updates.
  useEffect(() => {
    if (state.nodes.length === 0) return;
    const isFirstSighting = layoutStore.seenIds.size === 0;
    const newIds = state.nodes.filter((n) => !layoutStore.seenIds.has(n.id));
    if (newIds.length === 0) return;
    state.nodes.forEach((n) => layoutStore.seenIds.add(n.id));
    if (!isFirstSighting) {
      // Small delay so the new node is measured before fitting.
      const timer = setTimeout(
        () => fitView({ padding: 0.25, maxZoom: 1.25, duration: 400 }),
        50
      );
      return () => clearTimeout(timer);
    }
  }, [state.nodes, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => onSelect(node.id)}
      onPaneClick={() => onSelect(null)}
      onNodesChange={onNodesChange}
      onInit={onInit}
      onMoveEnd={onMoveEnd}
      nodesConnectable={false}
      minZoom={0.25}
      colorMode="dark"
    >
      <Background variant={BackgroundVariant.Dots} gap={26} color="#1e293b" />
      {/* Built-in zoom + an explicit Fit View control to recover any pan/zoom */}
      <Controls showInteractive={false} showFitView fitViewOptions={{ padding: 0.2, maxZoom: 1.25 }} />
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
        maskColor="rgba(2, 6, 23, 0.45)"
        style={{
          width: 148,
          height: 96,
          backgroundColor: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 8,
        }}
      />
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
