"use client";

import { useEffect, useState } from "react";

export function Header() {
  const [user, setUser] = useState<{ full_name?: string; email?: string; role?: string } | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) setUser(JSON.parse(stored));
    } catch {}
  }, []);

  return (
    <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-8 py-4 bg-white dark:bg-bg-dark sticky top-0 z-50">
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
        <input
          className="pl-10 pr-4 py-2 bg-slate-100 dark:bg-card-dark border-none rounded-lg focus:ring-2 focus:ring-primary w-64 text-sm placeholder:text-slate-500"
          placeholder="Buscar..."
          type="text"
        />
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold">{user?.full_name || "Admin"}</p>
            <p className="text-xs text-slate-500">{user?.role || "admin"}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold border border-primary/30">
            <span className="material-symbols-outlined">person</span>
          </div>
        </div>
      </div>
    </header>
  );
}
