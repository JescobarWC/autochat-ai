"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", icon: "dashboard", label: "Dashboard" },
  { href: "/tenants", icon: "group", label: "Cuentas" },
  { href: "/conversations", icon: "chat", label: "Conversaciones" },
  { href: "/analytics", icon: "monitoring", label: "Analytics" },
  { href: "/billing", icon: "credit_card", label: "Facturación" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 bg-white dark:bg-bg-dark">
      {/* Logo */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary rounded-lg text-white">
            <span className="material-symbols-outlined">directions_car</span>
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none">EAI-STUDIO Chat</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Admin Dashboard</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-card-dark"
              )}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Plan badge */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 p-3 bg-slate-100 dark:bg-card-dark rounded-lg">
          <span className="material-symbols-outlined text-primary">verified_user</span>
          <span className="text-sm font-medium">Plan Enterprise</span>
        </div>
      </div>
    </aside>
  );
}
