import { useMemo } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { SimulationState } from "../api/types";
import ClusterNode, { type ClusterNodeData } from "./ClusterNode";

interface Props {
  state: SimulationState;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const nodeTypes = { cluster: ClusterNode };

// Circular layout derived from the live node count — new nodes never
// overlap and existing nodes keep their relative position.
function layout(count: number) {
  const radius = count <= 3 ? 160 : 160 + (count - 3) * 45;
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  });
}

export default function NetworkCanvas({ state, selectedId, onSelect }: Props) {
  const positions = useMemo(() => layout(state.nodes.length), [state.nodes.length]);

  const nodes = useMemo<Node<ClusterNodeData>[]>(
    () =>
      state.nodes.map((node, i) => ({
        id: node.id,
        type: "cluster",
        position: positions[i],
        data: { node },
        selected: node.id === selectedId,
      })),
    [state.nodes, positions, selectedId]
  );

  // Links only between reachable, online nodes. Edges touching the
  // leader are animated; no edge crosses a partition or an offline node.
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
        result.push({
          id: `${a.id}-${b.id}`,
          source: a.id,
          target: b.id,
          animated: leaderLink,
          style: {
            stroke: leaderLink ? "#34d399" : "#475569",
            strokeWidth: leaderLink ? 2 : 1.5,
          },
        });
      }
    }
    return result;
  }, [state.nodes, state.current_leader]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => onSelect(node.id)}
      fitView
      fitViewOptions={{ padding: 0.25, maxZoom: 1.1 }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      minZoom={0.3}
      colorMode="dark"
    >
      <Background gap={24} color="#1e293b" />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable nodeColor="#334155" maskColor="rgb(2 6 23 / 0.8)" />
    </ReactFlow>
  );
}
