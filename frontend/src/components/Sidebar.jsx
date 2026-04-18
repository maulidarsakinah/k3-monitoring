// ============================================================
// Sidebar.jsx
// The left navigation panel — dark navy background with
// menu items, operator profile, and a Log Out button.
// ============================================================

import { LayoutDashboard, BarChart2, History, Bell, ShieldCheck, ChevronRight, LogOut } from "lucide-react";

// Each nav item definition: label, icon component, and page key
const NAV_ITEMS = [
  { label: "Dashboard",    icon: LayoutDashboard, page: "dashboard"     },
  { label: "Statistics",   icon: BarChart2,        page: "statistics"    },
  { label: "History",      icon: History,          page: "history"       },
  { label: "Notification", icon: Bell,             page: "notification"  },
  { label: "Validation",   icon: ShieldCheck,      page: "validation"    },
];

export default function Sidebar({ activePage, onNavigate }) {
  return (
    // Outer sidebar container — fixed width, full height, dark navy
    <aside className="w-64 min-h-screen bg-[#0d1b2a] flex flex-col shrink-0">

      {/* ── Brand / Title ── */}
      <div className="px-6 py-6 border-b border-white/10">
        <h1 className="text-white font-bold text-lg leading-tight">
          Dashboard Monitoring
        </h1>
      </div>

      {/* ── Navigation Menu ── */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ label, icon: Icon, page }) => {
          const isActive = activePage === page;
          return (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              className={`
                w-full flex items-center justify-between px-4 py-3 rounded-lg
                text-sm font-medium transition-colors duration-150
                ${isActive
                  ? "bg-violet-600 text-white"          // active: purple highlight
                  : "text-gray-300 hover:bg-white/10"   // inactive: subtle hover
                }
              `}
            >
              {/* Icon + Label */}
              <span className="flex items-center gap-3">
                <Icon size={17} />
                {label}
              </span>
              {/* Chevron arrow on the right */}
              <ChevronRight size={14} className="opacity-60" />
            </button>
          );
        })}
      </nav>

      {/* ── Operator Profile ── */}
      <div className="px-5 py-4 border-t border-white/10 flex items-center gap-3">
        {/* Avatar circle with initials */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
          OP
        </div>
        <span className="text-white text-sm font-medium">Operator</span>
      </div>

      {/* ── Log Out Button ── */}
      <div className="px-5 pb-6">
        <button className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2.5 rounded-full transition-colors duration-150">
          <LogOut size={15} />
          Log Out
        </button>
      </div>
    </aside>
  );
}
