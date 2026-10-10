import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Hammer,
  Link2,
  Loader2,
  Plug,
  PlugZap,
  RotateCcw,
  Send,
  ShieldAlert,
  TriangleAlert,
  Unlink,
  Zap,
} from "lucide-react";

import {
  integrityApi,
  type ChainBlock,
  type IntegrityResult,
  type IntegrityState,
  type PeerState,
} from "../api/integrity";

const PEER_NAMES = ["A", "B", "C"];
const TAMPERED_DATA = "transfer: Alice sends 500 coins to Eve (edited)";

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

function blockTitle(block: Pick<ChainBlock, "hash" | "previous_hash" | "nonce" | "miner" | "timestamp" | "transactions">): string {
  return [
    `hash: ${block.hash}`,
    `previous: ${block.previous_hash}`,
    `miner: ${block.miner}`,
    `nonce: ${block.nonce}`,
    `time: ${block.timestamp}`,
    `transactions (${block.transactions.length}): ${block.transactions
      .map((tx) => (typeof tx === "string" ? tx : `${tx.sender}→${tx.recipient}: ${tx.amount}`))
      .join(" | ")}`,
  ].join("\n");
}

/** One peer's chain rendered as a row of linked block chips. */
function PeerChain({
  peer,
  sharedHashes,
}: {
  peer: PeerState;
  sharedHashes: Set<string>;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm">
        <span className="font-semibold text-slate-100">Peer {peer.peer}</span>
        {peer.isolated && (
          <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase text-orange-300">
            isolated
          </span>
        )}
        <span className="text-xs text-slate-500">
          height {peer.height} · tip {shortHash(peer.tip_hash)}
        </span>
        {!peer.valid ? (
          <span className="flex items-center gap-1 text-xs text-red-400">
            <ShieldAlert className="size-3.5" aria-hidden />
            invalid at #{peer.first_invalid}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle2 className="size-3.5" aria-hidden />
            valid
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {peer.chain.map((block) => {
          const shared = sharedHashes.has(block.hash);
          const invalid = peer.first_invalid !== null && block.index >= peer.first_invalid;
          const competing = !shared && block.index > 0;
          return (
            <div
              key={block.index}
              title={blockTitle(block)}
              className={`shrink-0 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] ${
                invalid
                  ? "border-red-500/60 bg-red-500/10 text-red-300"
                  : competing
                    ? "border-amber-400/60 bg-amber-500/10 text-amber-300"
                    : "border-slate-700 bg-slate-950/60 text-slate-300"
              }`}
            >
              <span className="font-semibold">#{block.index}</span>{" "}
              {shortHash(block.hash)}
              <span className="text-slate-500"> · {block.transactions.length} tx</span>
              {block.index === 0 && (
                <span className="ml-1 text-[9px] uppercase text-slate-500">genesis</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Zap;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
        <Icon className="size-4 text-teal-300" aria-hidden />
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const INPUT =
  "w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-teal-400/60 focus:outline-none";

export default function IntegrityLab() {
  const [state, setState] = useState<IntegrityState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Guided fork experiment runner state.
  const [experiment, setExperiment] = useState<string | null>(null);
  const runningRef = useRef(false);
  const cancelledRef = useRef(false);
  useEffect(() => () => void (cancelledRef.current = true), []);

  const [txForm, setTxForm] = useState({ sender: "Alice", recipient: "Bob", amount: "5", peer: "A" });
  const [minePeer, setMinePeer] = useState("A");
  const [tamperPeer, setTamperPeer] = useState("A");
  const [tamperIndex, setTamperIndex] = useState(1);
  const [txError, setTxError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    integrityApi
      .getState()
      .then((initial) => !cancelled && setState(initial))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Request failed"));
    return () => {
      cancelled = true;
    };
  }, []);

  const run = useCallback(async (action: () => Promise<IntegrityState>) => {
    setError(null);
    setBusy(true);
    try {
      setState(await action());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }, []);

  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  // Guided fork-and-reorganization experiment: every step is a real API
  // call, with pauses so intermediate states become visible.
  const runForkExperiment = useCallback(async () => {
    if (runningRef.current) return; // no duplicate runs
    runningRef.current = true;
    cancelledRef.current = false;
    try {
      setExperiment("Resetting to a shared valid history…");
      setState(await integrityApi.reset());
      await wait(900);
      if (cancelledRef.current) return;
      setExperiment("Submitting a transaction to peer A (all peers receive it)…");
      setState(await integrityApi.submitTransaction("Alice", "Bob", 5, "A"));
      await wait(900);
      if (cancelledRef.current) return;
      setExperiment("Isolating peer C — it will see nothing new…");
      setState(await integrityApi.setPeer("C", true));
      await wait(900);
      if (cancelledRef.current) return;
      setExperiment("Mining on A — peers A and B extend their shared chain…");
      const minedA = await integrityApi.mine("A");
      setState(minedA);
      await wait(1300);
      if (cancelledRef.current) return;
      setExperiment("Mining on C — a competing block on the fork…");
      const minedC = await integrityApi.mine("C");
      setState(minedC);
      await wait(1300);
      if (cancelledRef.current) return;
      setExperiment("Reconnecting C — both branches stay visible…");
      setState(await integrityApi.setPeer("C", false));
      await wait(1100);
      if (cancelledRef.current) return;
      setExperiment("Reconciling: the longest valid chain wins deterministically…");
      const reconciled = await integrityApi.reconcile();
      setState(reconciled);
      const winner = reconciled.result?.winner ?? "unknown";
      const orphaned = reconciled.result?.orphaned ?? [];
      const lost = orphaned.flatMap((o) => o.blocks.map((b) => `#${b.index} on ${o.peer}`));
      setExperiment(
        `Done: peer ${winner} won with a height-${reconciled.peers[0].height} chain.` +
          (lost.length ? ` Orphaned: ${lost.join(", ")}.` : " No blocks were orphaned.")
      );
    } catch (err) {
      setExperiment(
        `Experiment stopped: ${err instanceof Error ? err.message : "request failed"}`
      );
    } finally {
      runningRef.current = false;
    }
  }, []);

  const submitTransaction = async () => {
    setTxError(null);
    const amount = Number(txForm.amount);
    if (!txForm.sender.trim() || !txForm.recipient.trim()) {
      setTxError("Sender and recipient are required.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setTxError("The amount must be a positive number.");
      return;
    }
    await run(() =>
      integrityApi.submitTransaction(txForm.sender, txForm.recipient, amount, txForm.peer)
    );
  };

  // Blocks shared by at least two peers vs competing (single-peer) blocks.
  const sharedHashes = new Set<string>();
  const hashCounts = new Map<string, number>();
  state?.peers.forEach((peer) =>
    peer.chain.forEach((block) => hashCounts.set(block.hash, (hashCounts.get(block.hash) ?? 0) + 1))
  );
  hashCounts.forEach((count, hash) => {
    if (count >= 2) sharedHashes.add(hash);
  });

  const result: IntegrityResult | undefined = state?.result;
  const tamperTarget = state?.peers.find((p) => p.peer === tamperPeer);
  const nonGenesisIndexes = tamperTarget
    ? Array.from({ length: Math.max(tamperTarget.height - 1, 0) }, (_, i) => i + 1)
    : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-200">Integrity Lab</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-400">
          Three simulated peers (A, B, C), each holding its own SHA-256-linked
          blockchain. Submit transactions, mine with real toy proof-of-work
          ({state?.difficulty ?? 2} leading zeroes), isolate peers to create
          forks, then reconcile deterministically. Educational simulation only —
          not Bitcoin: no economics, no wallets, and the peers are data
          structures in one Django process. Hashes prove integrity; they do not
          authenticate senders or make a system secure by themselves.
        </p>
      </div>

      {error && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {!state ? (
        <p className="flex items-center gap-2 py-10 text-sm text-slate-500">
          <Loader2 className="size-5 animate-spin text-teal-400" aria-hidden />
          Loading the blockchain simulation…
        </p>
      ) : (
        <div className="space-y-5">
          {/* A. Peer overview — compact, no metric card rows */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {state.peers.map((peer) => (
              <div
                key={peer.peer}
                className={`rounded-xl border p-3 ${
                  !peer.valid
                    ? "border-red-500/50 bg-red-500/5"
                    : peer.isolated
                      ? "border-orange-400/40 bg-orange-500/5"
                      : "border-slate-800 bg-slate-900/50"
                }`}
              >
                <p className="flex items-center justify-between text-sm font-semibold text-slate-100">
                  Peer {peer.peer}
                  <span className={`text-xs ${peer.valid ? "text-emerald-400" : "text-red-400"}`}>
                    {peer.valid ? "valid" : `invalid at #${peer.first_invalid}`}
                  </span>
                </p>
                <p className="mt-1 font-mono text-xs text-slate-500">
                  height {peer.height} · tip {shortHash(peer.tip_hash)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {peer.pending_count} pending {peer.isolated && "· isolated"}
                </p>
              </div>
            ))}
          </div>

          {/* B. Per-peer chains */}
          <div className="space-y-3">
            {state.peers.map((peer) => (
              <PeerChain key={peer.peer} peer={peer} sharedHashes={sharedHashes} />
            ))}
            <p className="text-xs text-slate-500">
              Blocks shared by two or more peers are slate; a block held by a
              single peer (a competing fork branch) is amber; tampered/invalid
              blocks are red. Hover any block for its full hashes, nonce, and
              transactions.
            </p>
          </div>

          {/* Guided experiment */}
          <Card title="Guided experiment: fork and reorganization" icon={Zap}>
            <p className="text-sm leading-relaxed text-slate-400">
              Resets, submits a transaction, isolates C, mines on A, mines a
              competing block on C, reconnects, then reconciles — one real API
              call per stage so you can watch the fork appear.
            </p>
            <button
              type="button"
              disabled={busy || runningRef.current}
              title={runningRef.current ? "Experiment already running" : "Run the guided fork experiment"}
              onClick={() => void runForkExperiment()}
              className={`mt-3 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                busy || runningRef.current
                  ? "cursor-not-allowed bg-slate-800 text-slate-500"
                  : "bg-teal-500/90 text-slate-950 hover:bg-teal-400"
              }`}
            >
              {runningRef.current ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Zap className="size-4" aria-hidden />
              )}
              {runningRef.current ? "Running…" : "Run fork experiment"}
            </button>
            {experiment && (
              <p
                role="status"
                className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm leading-relaxed text-slate-300"
              >
                {experiment}
              </p>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* C. Transactions */}
            <Card title="Submit a transaction" icon={Send}>
              <div className="grid grid-cols-2 gap-2">
                <input
                  aria-label="Sender"
                  className={INPUT}
                  value={txForm.sender}
                  onChange={(e) => setTxForm({ ...txForm, sender: e.target.value })}
                  placeholder="Sender"
                />
                <input
                  aria-label="Recipient"
                  className={INPUT}
                  value={txForm.recipient}
                  onChange={(e) => setTxForm({ ...txForm, recipient: e.target.value })}
                  placeholder="Recipient"
                />
                <input
                  aria-label="Amount"
                  className={INPUT}
                  type="number"
                  min="1"
                  value={txForm.amount}
                  onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                  placeholder="Amount"
                />
                <select
                  aria-label="Target peer"
                  className={INPUT}
                  value={txForm.peer}
                  onChange={(e) => setTxForm({ ...txForm, peer: e.target.value })}
                >
                  {PEER_NAMES.map((name) => (
                    <option key={name} value={name}>To peer {name}</option>
                  ))}
                </select>
              </div>
              {txError && <p className="mt-2 text-xs text-red-400">{txError}</p>}
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitTransaction()}
                className="mt-3 rounded-lg border border-teal-400/40 px-3 py-1.5 text-sm font-medium text-teal-300 transition-colors hover:bg-teal-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Submit
              </button>
              {result?.propagated_to && (
                <p className="mt-2 text-xs text-slate-500">
                  {result.propagated_to.length > 0
                    ? `Propagated to peers ${result.propagated_to.join(", ")}.`
                    : "No peer received it — the submitting peer is isolated."}
                </p>
              )}
              {result?.skipped && result.skipped.length > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  Skipped: {result.skipped.map((s) => `${s.peer} (${s.reason})`).join(", ")}.
                </p>
              )}
            </Card>

            {/* D. Mining */}
            <Card title="Mine pending transactions" icon={Hammer}>
              <div className="flex items-center gap-2">
                <select
                  aria-label="Mine on peer"
                  className={INPUT}
                  value={minePeer}
                  onChange={(e) => setMinePeer(e.target.value)}
                >
                  {PEER_NAMES.map((name) => (
                    <option key={name} value={name}>Mine on peer {name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => integrityApi.mine(minePeer))}
                  className="shrink-0 rounded-lg border border-teal-400/40 px-3 py-1.5 text-sm font-medium text-teal-300 transition-colors hover:bg-teal-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Mine
                </button>
              </div>
              {result?.block && (
                <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-400">
                  <p>
                    Mined block <span className="font-mono text-slate-200">#{result.block.index}</span>{" "}
                    on peer <span className="text-slate-200">{result.block.miner}</span> after{" "}
                    <span className="font-mono text-slate-200">{result.nonce_attempts}</span> nonce attempts.
                  </p>
                  <p className="mt-1 font-mono break-all">hash: {result.block.hash}</p>
                  <p className="mt-1">
                    {result.accepted_by && result.accepted_by.length > 0
                      ? `Accepted by peers ${result.accepted_by.join(", ")}.`
                      : "No peer accepted the block."}
                    {result.rejected && result.rejected.length > 0 && (
                      <>
                        {" "}Rejected:{" "}
                        {result.rejected.map((r) => `${r.peer} (${r.reason})`).join("; ")}.
                      </>
                    )}
                  </p>
                </div>
              )}
            </Card>

            {/* E. Network */}
            <Card title="Peer network" icon={Plug}>
              <p className="text-xs leading-relaxed text-slate-500">
                Non-isolated peers exchange transactions and blocks. Isolated
                peers keep their history and pending pool untouched until
                reconnected — reconnection never overwrites a chain; only
                explicit reconciliation does.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {state.peers.map((peer) => (
                  <button
                    key={peer.peer}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(() => integrityApi.setPeer(peer.peer, !peer.isolated))
                    }
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      peer.isolated
                        ? "border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/10"
                        : "border-orange-400/40 text-orange-300 hover:bg-orange-500/10"
                    }`}
                  >
                    {peer.isolated ? (
                      <>
                        <PlugZap className="size-3.5" aria-hidden /> Reconnect {peer.peer}
                      </>
                    ) : (
                      <>
                        <Unlink className="size-3.5" aria-hidden /> Isolate {peer.peer}
                      </>
                    )}
                  </button>
                ))}
              </div>
            </Card>

            {/* F. Integrity */}
            <Card title="Integrity: tamper and validate" icon={ShieldAlert}>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Tamper peer"
                  className={`${INPUT} max-w-32`}
                  value={tamperPeer}
                  onChange={(e) => {
                    setTamperPeer(e.target.value);
                    setTamperIndex(1);
                  }}
                >
                  {PEER_NAMES.map((name) => (
                    <option key={name} value={name}>Peer {name}</option>
                  ))}
                </select>
                <select
                  aria-label="Block to tamper"
                  className={`${INPUT} max-w-32`}
                  value={tamperIndex}
                  onChange={(e) => setTamperIndex(Number(e.target.value))}
                >
                  {nonGenesisIndexes.map((index) => (
                    <option key={index} value={index}>Block #{index}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy || nonGenesisIndexes.length === 0}
                  title="Change this peer's block data; the stored hash is NOT recalculated"
                  onClick={() =>
                    void run(() => integrityApi.tamper(tamperIndex, TAMPERED_DATA, tamperPeer))
                  }
                  className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Tamper
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => integrityApi.validate(tamperPeer))}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-teal-400/50 hover:text-teal-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Validate peer
                </button>
              </div>
              {result?.reason !== undefined && result?.peer && result.reason === null && (
                <p className="mt-3 text-xs text-emerald-400">
                  Peer {result.peer}: chain valid — every hash, link, index and
                  proof-of-work check passes.
                </p>
              )}
              {result?.reason && result.peer && (
                <p className="mt-3 text-xs leading-relaxed text-red-400">
                  Peer {result.peer}: invalid at block #{result.first_invalid} — {result.reason}
                </p>
              )}
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Tampering affects only the selected peer. Note the other peers'
                validation dots above — their copies stay valid.
              </p>
            </Card>
          </div>

          {/* G. Reconciliation */}
          <Card title="Reconcile chains (longest valid chain wins)" icon={Link2}>
            <p className="text-xs leading-relaxed text-slate-500">
              Deterministic rule: among reachable peers with valid chains, the
              longest wins; ties break by smallest tip hash, then by peer name.
              Invalid chains are rejected as candidates. Isolated peers are
              never touched.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(integrityApi.reconcile)}
                className="flex items-center gap-2 rounded-lg border border-teal-400/40 px-3 py-1.5 text-sm font-medium text-teal-300 transition-colors hover:bg-teal-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Link2 className="size-4" aria-hidden />
                Reconcile
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(integrityApi.reset)}
                className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:border-teal-400/50 hover:text-teal-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className="size-4" aria-hidden />
                Reset simulation
              </button>
            </div>
            {result?.winner && (
              <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-400">
                <p>
                  Winner: peer{" "}
                  <span className="font-semibold text-emerald-300">{result.winner}</span>{" "}
                  with a valid height-{result.height} chain
                  {result.tip_hash ? ` (tip ${shortHash(result.tip_hash)})` : ""}.
                </p>
                {result.orphaned && result.orphaned.length > 0 ? (
                  <p className="mt-1">
                    Orphaned blocks:{" "}
                    {result.orphaned
                      .map((o) => `#${o.blocks.map((b) => b.index).join(", #")} on ${o.peer}`)
                      .join("; ")}
                    .
                  </p>
                ) : (
                  <p className="mt-1">No blocks were orphaned — peers already agreed.</p>
                )}
                {result.rejected_candidates && result.rejected_candidates.length > 0 && (
                  <p className="mt-1 text-red-400">
                    Rejected candidates:{" "}
                    {result.rejected_candidates.map((r) => `${r.peer} (${r.reason})`).join("; ")}.
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
