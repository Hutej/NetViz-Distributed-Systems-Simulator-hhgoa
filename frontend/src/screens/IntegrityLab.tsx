import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Link2,
  Loader2,
  RotateCcw,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";

import { integrityApi, type IntegrityState } from "../api/integrity";

const TAMPERED_DATA = "transfer: Alice sends 500 coins to Eve (edited)";

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export default function IntegrityLab() {
  const [state, setState] = useState<IntegrityState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    setError(null);
    try {
      setState(await action());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-200">Integrity Lab</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-400">
          A simplified hash-chain demo: three blocks whose SHA-256 hashes commit
          to their content. Change a block's data and watch validation catch
          it. This demonstrates cryptographic data integrity only — it is not a
          cryptocurrency and has no mining, peers, or forks.
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
          Loading the chain…
        </p>
      ) : (
        <>
          {/* Verdict */}
          <div
            role="status"
            className={`mb-4 flex items-start gap-3 rounded-xl border p-4 text-sm ${
              state.valid
                ? "border-emerald-400/40 bg-emerald-500/5 text-emerald-300"
                : "border-red-500/40 bg-red-500/5 text-red-300"
            }`}
          >
            {state.valid ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
            ) : (
              <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
            )}
            <p className="leading-relaxed">
              {state.valid
                ? "Chain valid — every block's hash matches its contents and every link verifies."
                : `Chain INVALID from block #${state.first_invalid} — ${state.reason} In a real blockchain, every block built after the tampered one would be rejected too.`}
            </p>
          </div>

          {/* The chain */}
          <ol className="space-y-3">
            {state.blocks.map((block) => {
              const tampered = state.valid === false && block.index === state.first_invalid;
              return (
                <li
                  key={block.index}
                  className={`rounded-xl border p-4 ${
                    tampered
                      ? "border-red-500/50 bg-red-500/5"
                      : "border-slate-800 bg-slate-900/50"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                        Block #{block.index}
                        {block.index === 0 && (
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                            genesis
                          </span>
                        )}
                        {tampered && (
                          <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-300">
                            invalid
                          </span>
                        )}
                      </p>
                      <p
                        className={`mt-1 font-mono text-xs ${
                          tampered ? "text-red-300" : "text-slate-300"
                        }`}
                      >
                        {block.data}
                      </p>
                      <p className="mt-2 space-y-0.5 font-mono text-[11px] text-slate-500">
                        <span className="block">prev ← {shortHash(block.previous_hash)}</span>
                        <span className="block">hash ← {shortHash(block.hash)}</span>
                      </p>
                    </div>
                    {block.index > 0 && (
                      <button
                        type="button"
                        disabled={busy}
                        title={`Change this block's data to an edited transfer — the stored hash is NOT recalculated`}
                        onClick={() => void run(() => integrityApi.tamper(block.index, TAMPERED_DATA))}
                        className={`rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors ${
                          busy
                            ? "cursor-not-allowed opacity-50"
                            : "hover:border-red-400 hover:bg-red-500/10"
                        }`}
                      >
                        Tamper with this block
                      </button>
                    )}
                  </div>
                  {block.index < state.blocks.length - 1 && (
                    <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-600">
                      <Link2 className="size-3.5" aria-hidden />
                      linked to block #{block.index + 1} via its hash
                    </p>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(integrityApi.validate)}
              className="flex items-center gap-2 rounded-lg bg-teal-500/90 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Run validation
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(integrityApi.reset)}
              className="flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-teal-400/50 hover:text-teal-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="size-4" aria-hidden />
              Reset chain
            </button>
          </div>

          <p className="mt-6 border-t border-slate-800 pt-4 text-xs leading-relaxed text-slate-500">
            Each block's hash is a SHA-256 fingerprint of its index, data and
            the previous block's hash — computed by the backend with Python's
            hashlib. Because the hash commits to the content, any edit made
            after hashing is detected: the stored hash no longer matches what
            the block actually says. Educational simplification: a real
            blockchain also rejects every block built on top of a tampered
            one, because the whole chain of links no longer lines up.
          </p>
        </>
      )}
    </div>
  );
}
