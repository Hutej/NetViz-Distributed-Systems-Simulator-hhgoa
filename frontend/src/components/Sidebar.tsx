import {
  Activity,
  FlaskConical,
  GraduationCap,
  LayoutDashboard,
  LucideIcon,
  Network,
  X,
} from "lucide-react";

export type Screen = "overview" | "simulator" | "scenarios" | "timeline" | "learn";

interface NavItem {
  id: Screen;
  label: string;
  icon: LucideIcon;
  hint: string;
}

const ITEMS: NavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, hint: "Start here" },
  { id: "simulator", label: "Simulator", icon: Network, hint: "Interact with the cluster" },
  { id: "scenarios", label: "Scenario Lab", icon: FlaskConical, hint: "Guided experiments" },
  { id: "timeline", label: "Event Timeline", icon: Activity, hint: "What happened so far" },
  { id: "learn", label: "Learn", icon: GraduationCap, hint: "Key concepts explained" },
];

interface Props {
  current: Screen;
  onNavigate: (screen: Screen) => void;
  open: boolean;
  onClose: () => void;
}

function NavList({ current, onNavigate }: { current: Screen; onNavigate: (screen: Screen) => void }) {
  return (
    <nav aria-label="Main navigation" className="space-y-1">
      {ITEMS.map((item) => {
        const active = item.id === current;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            aria-current={active ? "page" : undefined}
            title={item.hint}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
              active
                ? "bg-teal-500/10 font-medium text-teal-300"
                : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-200"
            }`}
          >
            <item.icon className="size-4 shrink-0" aria-hidden />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

export default function Sidebar({ current, onNavigate, open, onClose }: Props) {
  return (
    <>
      {/* Desktop sidebar — compact so the main area keeps the space */}
      <aside className="hidden w-44 shrink-0 lg:block">
        <div className="sticky top-16 px-2 py-6">
          <NavList current={current} onNavigate={onNavigate} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/70"
          />
          <div className="absolute inset-y-0 left-0 w-64 border-r border-slate-800 bg-slate-950 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-sm font-bold tracking-widest text-slate-300">
                NETVIZ
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <X className="size-5" />
              </button>
            </div>
            <NavList current={current} onNavigate={onNavigate} />
          </div>
        </div>
      )}
    </>
  );
}
