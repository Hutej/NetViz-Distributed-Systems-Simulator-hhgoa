// Reusable educational result panel: what happened, why, before-vs-after
// evidence from real backend snapshots, and the underlying concept.
export interface EvidenceRow {
  id: string;
  before: string;
  after: string;
}

export interface ScenarioInsight {
  whatHappened: string;
  whyItHappened: string;
  concept: string;
  evidence: EvidenceRow[];
  notes?: string[];
}

export default function ScenarioInsight({ insight }: { insight: ScenarioInsight }) {
  return (
    <div className="mt-3 border-t border-slate-800/60 pt-3">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4 text-sm leading-relaxed">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              What happened
            </h4>
            <p className="mt-1 text-slate-300">{insight.whatHappened}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Why it happened
            </h4>
            <p className="mt-1 text-slate-300">{insight.whyItHappened}</p>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Before → after (actual backend state)
          </h4>
          <div className="mt-2 overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-500">
                  <th scope="col" className="px-2.5 py-1.5 font-medium">Node</th>
                  <th scope="col" className="px-2.5 py-1.5 font-medium">Before</th>
                  <th scope="col" className="px-2.5 py-1.5 font-medium">After</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {insight.evidence.map((row) => (
                  <tr key={row.id} className="border-b border-slate-800/60 last:border-0">
                    <td className="px-2.5 py-1.5 font-semibold text-slate-200">{row.id}</td>
                    <td className="px-2.5 py-1.5 text-slate-400">{row.before}</td>
                    <td
                      className={`px-2.5 py-1.5 ${
                        row.before !== row.after ? "text-teal-300" : "text-slate-400"
                      }`}
                    >
                      {row.after}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {insight.notes && insight.notes.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-slate-500">
              {insight.notes.map((note, i) => (
                <li key={i}>· {note}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        <span className="font-medium text-slate-400">Concept:</span>{" "}
        {insight.concept} NetViz is a simplified, deterministic, single-process
        educational simulation — not a complete Raft implementation or a real
        distributed cluster.
      </p>
    </div>
  );
}
