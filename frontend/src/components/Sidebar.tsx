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

/** Labelled list — used in the mobile drawer. */
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
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
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
      {/* Desktop rail — icon-only, minimal width so the main area is free */}
      <aside className="hidden w-14 shrink-0 lg:block">
        <nav
          aria-label="Main navigation"
          className="sticky top-16 flex flex-col items-center gap-1 py-6"
        >
          {ITEMS.map((item) => {
            const active = item.id === current;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                title={`${item.label} — ${item.hint}`}
                className={`relative flex size-10 items-center justify-center rounded-lg transition-colors ${
                  active
                    ? "bg-teal-500/15 text-teal-300"
                    : "text-slate-500 hover:bg-slate-800/70 hover:text-slate-200"
                }`}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-teal-400"
                  />
                )}
                <item.icon className="size-5" aria-hidden />
              </button>
            );
          })}
        </nav>
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
