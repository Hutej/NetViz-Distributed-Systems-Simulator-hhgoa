interface Concept {
  term: string;
  definition: string;
  example: string;
}

const CONCEPTS: Concept[] = [
  {
    term: "Node",
    definition: "One simulated server inside the cluster.",
    example: "NetViz starts with three nodes named A, B and C.",
  },
  {
    term: "Leader",
    definition: "The node that coordinates the cluster's simulated writes.",
    example: "Node A is the initial leader; it carries a crown icon.",
  },
  {
    term: "Follower",
    definition: "A node that receives replicated entries from the leader.",
    example: "Nodes B and C follow A and receive its log entries.",
  },
  {
    term: "Leader election",
    definition:
      "How eligible nodes attempt to choose a replacement leader. In NetViz the election is simplified and deterministic: the eligible node with the smallest ID wins, if enough nodes can vote.",
    example: "Crash leader A and B and C hold an election for term 2.",
  },
  {
    term: "Quorum",
    definition:
      "The minimum number of nodes required for a successful election under this simulator's simplified rule: more than half of all nodes (floor(n / 2) + 1), counting offline ones.",
    example: "With 3 nodes, 2 must be online and reachable to elect a leader.",
  },
  {
    term: "Network partition",
    definition:
      "A communication separation that prevents certain nodes from exchanging messages.",
    example: "Isolate node B and it stops receiving replication entries.",
  },
  {
    term: "Log replication",
    definition: "Copying a simulated log entry from the leader to reachable followers.",
    example: "A's log index advances to 1 and every reachable follower's index follows.",
  },
];

const WALKTHROUGH = [
  "Open the Scenario Lab and run “Leader Failure”.",
  "The banner identifies the current leader — the node coordinating the cluster.",
  "The leader is crashed. Notice the cluster now has no leader and is marked degraded.",
  "An election runs: eligible nodes vote, and the smallest eligible ID wins the new term.",
  "The banner reports the new leader. Open the Simulator to inspect the new roles and terms.",
];

export default function Learn() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-200">Learn</h2>
        <p className="mt-1 text-sm text-slate-400">
          The seven ideas behind the simulator, in plain language.
        </p>
      </div>

      {/* Glossary */}
      <dl className="space-y-5">
        {CONCEPTS.map((concept) => (
          <div key={concept.term}>
            <dt className="text-sm font-semibold text-slate-100">{concept.term}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-slate-400">
              {concept.definition}
              <span className="mt-1 block text-xs text-slate-500">
                Example: {concept.example}
              </span>
            </dd>
          </div>
        ))}
      </dl>

      {/* Leader Failure walkthrough */}
      <section className="mt-12">
        <h3 className="text-lg font-semibold text-slate-200">
          Walkthrough: the Leader Failure scenario
        </h3>
        <ol className="mt-4 space-y-3">
          {WALKTHROUGH.map((step, index) => (
            <li key={index} className="flex gap-3 text-sm text-slate-400">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-800 font-mono text-xs text-teal-300">
                {index + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Honest scope note */}
      <aside className="mt-12 rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm leading-relaxed text-slate-400">
        <p className="font-semibold text-slate-300">What NetViz is — and is not</p>
        <p className="mt-2">
          NetViz is an educational, single-process simulation. The nodes are
          data structures inside one Django program, not independent machines.
          Elections are simplified and deterministic — this is not a full Raft
          implementation, and real distributed systems add timers, retries and
          many more failure modes on top of the ideas shown here.
        </p>
      </aside>
    </div>
  );
}
