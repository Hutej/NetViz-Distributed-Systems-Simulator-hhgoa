import { Crown, Power, PowerOff, Unlink2 } from "lucide-react";
import { motion } from "motion/react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import type { ClusterNodeState, Role } from "../api/types";

export type ClusterNodeData = { node: ClusterNodeState };
export type ClusterNodeType = Node<ClusterNodeData, "cluster">;

const ROLE_CHIP: Record<Role, string> = {
  leader: "border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
  follower: "border-sky-400/30 bg-sky-500/10 text-sky-300",
  candidate: "border-amber-400/40 bg-amber-500/15 text-amber-300",
};

function cardBorder(node: ClusterNodeState): string {
  if (node.status === "offline") return "border-red-500/50";
  if (node.partitioned) return "border-amber-400/60";
  if (node.role === "leader") return "border-emerald-400/60";
  if (node.role === "candidate") return "border-amber-400/50";
  return "border-slate-700";
}

export default function ClusterNode({ data, selected }: NodeProps<ClusterNodeType>) {
  const node = data.node;
  const online = node.status === "online";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: online ? 1 : 0.5, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`w-52 cursor-pointer rounded-xl border-2 bg-slate-900/95 p-3 shadow-xl transition-shadow hover:shadow-2xl ${cardBorder(node)} ${
        selected
          ? "ring-2 ring-teal-300 ring-offset-2 ring-offset-slate-950 shadow-[0_0_24px_rgba(45,212,191,0.4)]"
          : ""
      }`}
    >
      <Handle type="target" position={Position.Left} className="size-2! border-none! bg-slate-600!" />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-slate-100">{node.name}</span>
          {node.role === "leader" && (
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            >
              <Crown className="size-4 text-amber-300" />
            </motion.span>
          )}
        </div>
        <span className="font-mono text-xs text-slate-500">{node.id}</span>
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className={`rounded border px-1.5 py-0.5 ${ROLE_CHIP[node.role]}`}>
          {node.role}
        </span>
        <span className="flex items-center gap-1 text-slate-400">
          {online ? (
            <Power className="size-3.5 text-emerald-400" />
          ) : (
            <PowerOff className="size-3.5 text-red-400" />
          )}
          {node.status}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-slate-800/50 p-2 text-xs text-slate-400">
        <span>
          term <span className="font-mono text-slate-200">{node.term}</span>
        </span>
        <span>
          log{" "}
          {/* key on the log index: the chip visibly pulses when a real
              replication event changes it */}
          <motion.span
            key={node.log_index}
            initial={{ scale: 1.5, color: "#5eead4" }}
            animate={{ scale: 1, color: "#e2e8f0" }}
            transition={{ duration: 0.8 }}
            className="inline-block font-mono"
          >
            {node.log_index}
          </motion.span>
        </span>
      </div>

      {node.partitioned && (
        <div className="mt-2 flex items-center gap-1.5 rounded border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-300">
          <Unlink2 className="size-3.5" />
          isolated from network
        </div>
      )}

      <Handle type="source" position={Position.Right} className="size-2! border-none! bg-slate-600!" />
    </motion.div>
  );
}
