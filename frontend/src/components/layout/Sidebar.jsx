import {
  Activity,
  BarChart2,
  Bell,
  ChevronRight,
  History,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  SlidersHorizontal,
  FileText,
  Moon,
  Sun,
} from "lucide-react";

export const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, page: "dashboard" },
  { label: "Monitoring", icon: Activity, page: "monitoring" },
  { label: "Statistics", icon: BarChart2, page: "statistics" },
  { label: "History", icon: History, page: "history" },
  { label: "Notification", icon: Bell, page: "notification" },
  { label: "Validation", icon: ShieldCheck, page: "validation" },
  { label: "Reports", icon: FileText, page: "reports", roles: ["admin", "manager"] },
  { label: "Management", icon: SlidersHorizontal, page: "management", roles: ["admin", "manager"] },
];

function SidebarBrand() {
  return (
    <div className="px-6 py-6 border-b border-white/10">
      <h1 className="text-white font-bold text-lg leading-tight">
        Dashboard Monitoring
      </h1>
      <p className="text-white/45 text-xs mt-1">K3 APD Detection</p>
    </div>
  );
}

function SidebarNavItem({ item, activePage, onNavigate, unreadCount }) {
  const Icon = item.icon;
  const isActive = activePage === item.page;

  return (
    <button
      onClick={() => onNavigate(item.page)}
      className={`
        w-full flex items-center justify-between px-4 py-3 rounded-lg
        text-sm font-medium transition-colors duration-150
        ${isActive ? "bg-violet-600 text-white" : "text-gray-300 hover:bg-white/10"}
      `}
    >
      <span className="flex items-center gap-3 min-w-0">
        <Icon size={17} />
        <span className="truncate">{item.label}</span>
        {item.page === "notification" && unreadCount > 0 && (
          <span className="min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </span>
      <ChevronRight size={14} className="opacity-60 shrink-0" />
    </button>
  );
}

function SidebarNav({ activePage, onNavigate, unreadCount, user }) {
  const items = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(user?.role),
  );

  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {items.map((item) => (
        <SidebarNavItem
          key={item.page}
          item={item}
          activePage={activePage}
          onNavigate={onNavigate}
          unreadCount={unreadCount}
        />
      ))}
    </nav>
  );
}

function SidebarUser({ user }) {
  const initials = (user?.username || "OP").slice(0, 2).toUpperCase();

  return (
    <div className="px-5 py-4 border-t border-white/10 flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
        {initials}
      </div>
      <div className="min-w-0">
        <p className="text-white text-sm font-medium truncate">
          {user?.username || "Operator"}
        </p>
        <p className="text-white/50 text-[11px] truncate">
          {user?.roleLabel || user?.role || "Operator"}
        </p>
      </div>
    </div>
  );
}

function ThemeToggle({ darkMode, onDarkModeChange }) {
  const Icon = darkMode ? Moon : Sun;

  return (
    <div className="px-5 py-4 border-t border-white/10">
      <button
        onClick={() => onDarkModeChange(!darkMode)}
        className="w-full flex items-center justify-between gap-3 rounded-lg bg-white/10 hover:bg-white/15 px-3 py-2.5 text-sm font-semibold text-white transition-colors"
        aria-label="Toggle dark mode"
      >
        <span className="flex items-center gap-2">
          <Icon size={16} />
          {darkMode ? "Dark Mode" : "White Mode"}
        </span>
        <span
          className={`w-10 h-6 rounded-full p-1 transition-colors ${
            darkMode ? "bg-violet-500" : "bg-slate-500"
          }`}
        >
          <span
            className={`block w-4 h-4 rounded-full bg-white transition-transform ${
              darkMode ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </span>
      </button>
    </div>
  );
}

function SidebarLogout({ onLogout }) {
  return (
    <div className="px-5 pb-6">
      <button
        onClick={onLogout}
        className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors duration-150"
      >
        <LogOut size={15} />
        Log Out
      </button>
    </div>
  );
}

export default function Sidebar({
  activePage,
  darkMode,
  onDarkModeChange,
  onNavigate,
  user,
  onLogout,
  unreadCount = 0,
}) {
  return (
    <aside className="w-64 h-screen bg-[#0d1b2a] flex flex-col shrink-0">
      <SidebarBrand />
      <SidebarNav
        activePage={activePage}
        onNavigate={onNavigate}
        unreadCount={unreadCount}
        user={user}
      />
      <ThemeToggle darkMode={darkMode} onDarkModeChange={onDarkModeChange} />
      <SidebarUser user={user} />
      <SidebarLogout onLogout={onLogout} />
    </aside>
  );
}
