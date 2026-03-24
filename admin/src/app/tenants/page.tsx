"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  billing_plan: string;
  messages_used: number;
  monthly_message_limit: number;
  created_at: string;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.getTenants()
      .then((t) => { setTenants(t); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = tenants.filter(
    (t) => t.name.toLowerCase().includes(search.toLowerCase()) || t.slug.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = tenants.filter((t) => t.is_active).length;

  const planStyle = (plan: string) => {
    if (plan === "professional" || plan === "enterprise") return "bg-primary/10 text-primary border border-primary/20";
    if (plan === "starter") return "bg-accent-blue/10 text-accent-blue border border-accent-blue/20";
    return "bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold">Gestion de Cuentas</h2>
          <p className="text-slate-500 dark:text-slate-400">Administra los concesionarios registrados en la plataforma</p>
        </div>
        <Link href="/tenants/new" className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
          <span className="material-symbols-outlined text-sm">add</span>
          Nuevo Tenant
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total Tenants", value: tenants.length.toString(), icon: "group" },
          { label: "Activos", value: activeCount.toString(), icon: "check_circle" },
          { label: "Inactivos", value: (tenants.length - activeCount).toString(), icon: "pause_circle" },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-card-dark p-5 rounded-lg border border-slate-100 dark:border-slate-800/50 flex items-center gap-4">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <span className="material-symbols-outlined">{s.icon}</span>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{s.label}</p>
              <p className="text-2xl font-bold">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-card-dark rounded-lg overflow-hidden border border-slate-100 dark:border-slate-800/50">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
          <h3 className="text-lg font-bold">Concesionarios</h3>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
            <input
              className="pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800/50 border-none rounded-lg text-sm w-56 placeholder:text-slate-500"
              placeholder="Buscar tenant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 font-medium uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4">Concesionario</th>
                <th className="px-6 py-4">Plan</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Uso mensajes</th>
                <th className="px-6 py-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((t) => {
                const usage = t.monthly_message_limit > 0
                  ? Math.min(100, Math.round((t.messages_used / t.monthly_message_limit) * 100))
                  : 0;

                return (
                  <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {t.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold">{t.name}</p>
                          <p className="text-xs text-slate-400">{t.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${planStyle(t.billing_plan)}`}>
                        {t.billing_plan}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${t.is_active ? "text-accent-emerald" : "text-slate-400"}`}>
                        <span className={`w-2 h-2 rounded-full ${t.is_active ? "bg-accent-emerald" : "bg-slate-400"}`} />
                        {t.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden w-24">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${usage}%` }} />
                        </div>
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          {t.messages_used.toLocaleString("es-ES")} / {t.monthly_message_limit.toLocaleString("es-ES")}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <Link href={`/tenants/${t.id}`} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-primary">
                          <span className="material-symbols-outlined text-sm">settings</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    {search ? "No se encontraron tenants" : "No hay tenants registrados"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
