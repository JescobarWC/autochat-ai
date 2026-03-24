"use client";

const BILLING_CARDS = [
  { icon: "payments", label: "Ingresos Totales (Anual)", value: "145.200 €", change: "+12.4%", color: "primary" },
  { icon: "domain", label: "Inquilinos Activos", value: "42", change: "+5", color: "indigo" },
  { icon: "trending_up", label: "MRR Actual", value: "12.100 €", change: "+8.2%", color: "amber" },
  { icon: "toll", label: "Coste Tokens (Medio)", value: "842 €", change: "+15%", color: "rose", negative: true },
];

const MRR_BARS = [
  { month: "Ene", pct: 30 }, { month: "Feb", pct: 40 }, { month: "Mar", pct: 45 },
  { month: "Abr", pct: 55 }, { month: "May", pct: 60 }, { month: "Jun", pct: 75 },
  { month: "Jul", pct: 85 }, { month: "Ago", pct: 80 }, { month: "Sep", pct: 88 },
  { month: "Oct", pct: 92 }, { month: "Nov", pct: 95 }, { month: "Dic", pct: 100 },
];

const PLAN_DIST = [
  { name: "Enterprise (Elite)", count: 12, pct: 28, color: "bg-primary" },
  { name: "Business (Pro)", count: 22, pct: 52, color: "bg-indigo-500" },
  { name: "Starter (Básico)", count: 8, pct: 20, color: "bg-amber-500" },
];

const TENANTS_BILLING = [
  { name: "Auto Madrid S.L.", loc: "Madrid, ES", initials: "AM", plan: "Enterprise", usage: "2.340 / 5.000", usagePct: 47, cost: "124 €", nextInvoice: "15 Feb 2025", amount: "450 €", status: "Al día" },
  { name: "Worldcars", loc: "Madrid, ES", initials: "WC", plan: "Professional", usage: "4.200 / 5.000", usagePct: 84, cost: "98 €", nextInvoice: "01 Feb 2025", amount: "299 €", status: "Al día" },
  { name: "Cochesur Málaga", loc: "Málaga, ES", initials: "CM", plan: "Starter", usage: "380 / 1.000", usagePct: 38, cost: "32 €", nextInvoice: "20 Feb 2025", amount: "99 €", status: "Pendiente" },
  { name: "Premium Cars BCN", loc: "Barcelona, ES", initials: "PC", plan: "Business", usage: "1.800 / 3.000", usagePct: 60, cost: "76 €", nextInvoice: "10 Feb 2025", amount: "199 €", status: "Al día" },
  { name: "Galicia Motor", loc: "Vigo, ES", initials: "GM", plan: "Starter", usage: "950 / 1.000", usagePct: 95, cost: "45 €", nextInvoice: "05 Feb 2025", amount: "99 €", status: "Vencido" },
];

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    "Al día": "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    "Pendiente": "bg-amber-500/10 text-amber-500 border-amber-500/20",
    "Vencido": "bg-rose-500/10 text-rose-500 border-rose-500/20",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || styles["Pendiente"]}`}>
      {status}
    </span>
  );
}

export default function BillingPage() {
  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Gestión Financiera SaaS</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Panel de control de facturación para concesionarios en España</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-card-dark text-slate-700 dark:text-slate-200 rounded-lg font-medium text-sm hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
            <span className="material-symbols-outlined text-lg">download</span> Exportar Reporte
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium text-sm hover:opacity-90 transition-opacity">
            <span className="material-symbols-outlined text-lg">add</span> Nuevo Inquilino
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {BILLING_CARDS.map((card) => (
          <div key={card.label} className="bg-white dark:bg-card-dark p-6 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <span className={`p-2 rounded-lg ${
                card.color === "primary" ? "bg-primary/10" :
                card.color === "indigo" ? "bg-indigo-500/10" :
                card.color === "amber" ? "bg-amber-500/10" : "bg-rose-500/10"
              }`}>
                <span className={`material-symbols-outlined ${
                  card.color === "primary" ? "text-primary" :
                  card.color === "indigo" ? "text-indigo-500" :
                  card.color === "amber" ? "text-amber-500" : "text-rose-500"
                }`}>{card.icon}</span>
              </span>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                card.negative ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"
              }`}>{card.change}</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{card.label}</p>
            <p className="text-2xl font-bold mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* MRR Growth */}
        <div className="lg:col-span-2 bg-white dark:bg-card-dark p-6 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-lg">Crecimiento del MRR (12 meses)</h3>
            <select className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-xs font-medium py-1 px-3 dark:text-slate-300">
              <option>Año 2024</option>
              <option>Año 2025</option>
            </select>
          </div>
          <div className="flex items-end justify-between gap-2 h-48 w-full mt-4">
            {MRR_BARS.map((bar) => (
              <div key={bar.month} className="flex flex-col items-center flex-1 gap-2">
                <div className="bg-primary w-full rounded-t-sm transition-all" style={{ height: `${bar.pct}%`, opacity: 0.4 + (bar.pct / 100) * 0.6 }} />
                <span className="text-[10px] text-slate-500 uppercase">{bar.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Plan Distribution */}
        <div className="bg-white dark:bg-card-dark p-6 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-lg mb-6">Distribución por Plan</h3>
          <div className="space-y-6">
            {PLAN_DIST.map((plan) => (
              <div key={plan.name}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-500 dark:text-slate-400">{plan.name}</span>
                  <span className="font-bold">{plan.count}</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full ${plan.color} rounded-full`} style={{ width: `${plan.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 p-4 bg-primary/5 rounded-lg border border-primary/10">
            <p className="text-xs text-primary font-bold uppercase tracking-wider mb-1">Previsión Enero</p>
            <p className="text-lg font-bold">~13.250 €</p>
          </div>
        </div>
      </div>

      {/* Tenants Billing Table */}
      <div className="bg-white dark:bg-card-dark rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="font-bold text-lg">Listado de Inquilinos</h3>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg">Todos</button>
            <button className="px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 dark:text-slate-400 rounded-lg">Pendientes</button>
            <button className="px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 dark:text-slate-400 rounded-lg">Vencidos</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Concesionario</th>
                <th className="px-6 py-4 font-semibold">Plan</th>
                <th className="px-6 py-4 font-semibold">Uso (Conversaciones)</th>
                <th className="px-6 py-4 font-semibold">Coste Tokens</th>
                <th className="px-6 py-4 font-semibold">Próxima Factura</th>
                <th className="px-6 py-4 font-semibold">Estado</th>
                <th className="px-6 py-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {TENANTS_BILLING.map((t) => (
                <tr key={t.initials} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">{t.initials}</div>
                      <div>
                        <span className="text-sm font-semibold">{t.name}</span>
                        <p className="text-xs text-slate-500">{t.loc}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">{t.plan}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 min-w-[160px]">
                      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${t.usagePct > 90 ? "bg-rose-500" : t.usagePct > 70 ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${t.usagePct}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 whitespace-nowrap">{t.usage}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">{t.cost}</td>
                  <td className="px-6 py-4">
                    <div>
                      <span className="text-sm">{t.nextInvoice}</span>
                      <p className="text-xs text-slate-500">{t.amount}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">{statusBadge(t.status)}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400">
                      <span className="material-symbols-outlined text-sm">more_vert</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
