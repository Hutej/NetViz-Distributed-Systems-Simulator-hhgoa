export type Role = "leader" | "follower" | "candidate";
export type NodeStatus = "online" | "offline";
export type EventType = "system" | "election" | "replication" | "crash" | "recovery" | "partition";

export interface ClusterNodeState {
  id: string;
  name: string;
  role: Role;
  status: NodeStatus;
  term: number;
  log_index: number;
  partitioned: boolean;
}

export interface SimMessage {
  id: number;
  type: "heartbeat" | "vote_request" | "vote" | "replication";
  from: string;
  to: string;
  term: number;
  timestamp: string;
}

export interface SimEvent {
  id: number;
  type: EventType;
  timestamp: string;
  description: string;
}

export interface ClusterInfo {
  total_nodes: number;
  online_nodes: number;
  offline_nodes: number;
  quorum_size: number;
  quorum_available: boolean;
  health: string;
}

export interface SimulationState {
  nodes: ClusterNodeState[];
  current_leader: string | null;
  current_term: number;
  total_messages: number;
  recent_messages: SimMessage[];
  recent_events: SimEvent[];
  cluster: ClusterInfo;
}
