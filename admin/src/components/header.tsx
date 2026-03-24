"use client";

export function Header() {
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
        <button className="p-2 hover:bg-slate-100 dark:hover:bg-card-dark rounded-lg transition-colors relative text-slate-600 dark:text-slate-400">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold">Admin Panel</p>
            <p className="text-xs text-slate-500">Super Admin</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold border border-primary/30">
            <span className="material-symbols-outlined">person</span>
          </div>
        </div>
      </div>
    </header>
  );
}
