import { Network } from "lucide-react";

export default function App() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-slate-100">
      <Network className="size-16 text-emerald-400" />
      <h1 className="text-3xl font-bold">Natives</h1>
      <p className="text-slate-400">Distributed system simulator</p>
    </div>
  );
}
