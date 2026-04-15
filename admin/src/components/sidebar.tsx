"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  icon: string;
  label: string;
  roles: string[]; // roles that can see this item
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", icon: "dashboard", label: "Dashboard", roles: ["superadmin", "admin", "user"] },
  { href: "/tenants", icon: "group", label: "Cuentas", roles: ["superadmin", "admin"] },
  { href: "/conversations", icon: "chat", label: "Conversaciones", roles: ["superadmin", "admin"] },
  { href: "/analytics", icon: "monitoring", label: "Analytics", roles: ["superadmin", "admin", "user"] },
  { href: "/billing", icon: "credit_card", label: "Facturación", roles: ["superadmin"] },
  { href: "/settings", icon: "settings", label: "Ajustes", roles: ["superadmin", "admin", "user"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState("admin");
  const [tenantName, setTenantName] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const u = JSON.parse(stored);
        setUserRole(u.role || "admin");
        // For tenant users, show tenant name
        if (u.role !== "superadmin" && u.tenant_id) {
          setTenantName(u.tenant_name || "");
        }
      }
    } catch {}
  }, []);

  const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(userRole));

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
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {tenantName || "Admin Dashboard"}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1">
        {visibleItems.map((item) => {
          const isActive = pathname.startsWith(item.href);

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

      {/* Role badge + Logout */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
        {userRole !== "superadmin" && (
          <div className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${
              userRole === "admin" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" :
              "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            }`}>
              {userRole === "admin" ? "Admin" : "Usuario"}
            </span>
          </div>
        )}
        <button
          onClick={() => {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "/login";
          }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/10 dark:hover:text-red-400 w-full"
        >
          <span className="material-symbols-outlined">logout</span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
