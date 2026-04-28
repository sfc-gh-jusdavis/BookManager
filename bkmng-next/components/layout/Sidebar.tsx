"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  TrendingUp,
  ClipboardList,
  Users,
  Sparkles,
  DollarSign,
  ChevronDown,
  Bell,
  Settings,
  GanttChart,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { useAlertCount } from "@/hooks/useApi";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
  { href: "/accounts", label: "Accounts", icon: <Building2 size={16} /> },
  { href: "/forecasts", label: "Forecasts", icon: <TrendingUp size={16} /> },
  { href: "/timeline", label: "Timeline", icon: <GanttChart size={16} /> },
  { href: "/tmrs", label: "TMRs", icon: <ClipboardList size={16} /> },
  { href: "/team", label: "Team", icon: <Users size={16} /> },
  { href: "/ace", label: "Ask ACE", icon: <Sparkles size={16} /> },
  { href: "/admin/costs", label: "Cost Monitor", icon: <DollarSign size={16} />, adminOnly: true },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Sidebar() {
  const pathname = usePathname();
  const { currentUser, isSpcs, switchUser, mockUsers } = useAuth();
  const { data: alertCountData } = useAlertCount();
  const unreadCount = alertCountData?.count ?? 0;

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || currentUser?.is_admin
  );

  const initials = currentUser ? getInitials(currentUser.display_name) : "??";
  const roleLabel = currentUser?.role === "acem" ? "Manager" : "ACE";

  return (
    <aside className="flex flex-col w-56 shrink-0 h-screen sticky top-0 bg-slate-900 text-slate-100">
      <Link href="/" className="px-4 py-5 border-b border-slate-700 hover:bg-slate-800 transition-colors">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded flex items-center justify-center text-white text-xs font-bold"
            style={{ background: "var(--snow-500)" }}
          >
            BM
          </div>
          <span className="font-semibold text-sm tracking-wide">BookManager</span>
        </div>
      </Link>

      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname?.startsWith(item.href) ?? false;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "text-white font-medium"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
              )}
              style={isActive ? { background: "var(--snow-600)" } : undefined}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}

        <Link
          href="/alerts"
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
            pathname?.startsWith("/alerts")
              ? "text-white font-medium"
              : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          )}
          style={pathname?.startsWith("/alerts") ? { background: "var(--snow-600)" } : undefined}
        >
          <span className="relative">
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </span>
          Alerts
          {unreadCount > 0 && (
            <span className="ml-auto text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5 font-semibold">
              {unreadCount}
            </span>
          )}
        </Link>
      </nav>

      <div className="shrink-0 px-3 py-4 border-t border-slate-700 space-y-2">
        {mockUsers && mockUsers.length > 0 && (
          <div className="relative">
            <label className="text-xs text-slate-500 mb-1 block">Switch User</label>
            <select
              className="w-full text-xs bg-slate-800 text-slate-200 border border-slate-600 rounded px-2 py-1.5 appearance-none pr-6"
              value={currentUser?.user_id ?? ""}
              onChange={(e) => switchUser(e.target.value)}
            >
              {mockUsers.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.display_name} ({u.role.toUpperCase()})
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 bottom-2 text-slate-400 pointer-events-none" />
          </div>
        )}

        <div className="flex items-center gap-2.5 px-1">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
            style={{ background: "var(--snow-500)" }}
          >
            {initials}
          </div>
          <Link href="/settings" className="overflow-hidden group flex-1">
            <p className="text-xs font-medium text-slate-200 truncate group-hover:text-white transition-colors">
              {currentUser?.display_name || "Loading..."}
            </p>
            <p className="text-xs text-slate-500">{roleLabel}</p>
          </Link>
          <Link href="/settings" className="text-slate-500 hover:text-slate-300 transition-colors" title="Settings">
            <Settings size={14} />
          </Link>
        </div>
      </div>
    </aside>
  );
}
