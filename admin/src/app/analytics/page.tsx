"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface DailyMetric {
  date: string;
  conversations: number;
  messages: number;
  leads: number;
  tokens_input: number;
  tokens_output: number;
}

interface Analytics {
  totals: {
    total_conversations: number;
    total_messages: number;
    total_leads: number;
    tokens_input: number;
    tokens_output: number;
  };
  daily: DailyMetric[];
}

const HEATMAP_DAYS = ["L", "M", "X", "J", "V", "S", "D"];
const HEATMAP_HOURS = ["08h", "12h", "16h", "20h", "00h"];
const HEATMAP_ROWS: number[][] = [
  [10, 10, 20, 10, 20, 10, 10],
  [40, 40, 60, 40, 50, 20, 10],
  [70, 80, 100, 90, 100, 40, 20],
  [60, 50, 80, 70, 60, 40, 30],
  [90, 100, 100, 100, 100, 60, 50],
  [40, 40, 50, 40, 30, 20, 10],
  [20, 20, 30, 20, 20, 10, 10],
  [10, 10, 10, 10, 10, 10, 10],
];

function heatOpacity(val: number): string {
  if (val >= 90) return "bg-primary";
  if (val >= 60) return "bg-primary/70";
  if (val >= 40) return "bg-primary/40";
  if (val >= 20) return "bg-primary/20";
  return "bg-primary/10";
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [dailyPage, setDailyPage] = useState(1);
  const [dailyPerPage, setDailyPerPage] = useState(10);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    api.getAnalytics()
      .then(setAnalytics)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totals = analytics?.totals;
  const daily = analytics?.daily ?? [];
  const last7 = daily.slice(-7);
  const maxMessages = Math.max(...last7.map(d => d.messages), 1);

  const convRate = totals && totals.total_conversations > 0
    ? ((totals.total_leads / totals.total_conversations) * 100).toFixed(1)
    : "0";

  const tokenCost = totals
    ? ((totals.tokens_input * 0.0004 + totals.tokens_output * 0.0016) / 1000).toFixed(2)
    : "0.00";

  const KPI_CARDS = [
    { label: "Conversaciones", value: totals?.total_conversations ?? 0, icon: "chat", iconColor: "bg-primary/10 text-primary" },
    { label: "Leads Generados", value: totals?.total_leads ?? 0, icon: "person_add", iconColor: "bg-emerald-500/10 text-emerald-500" },
    { label: "% Conversión", value: `${convRate}%`, icon: "query_stats", iconColor: "bg-amber-500/10 text-amber-500", isStr: true },
    { label: "Mensajes totales", value: totals?.total_messages ?? 0, icon: "forum", iconColor: "bg-blue-500/10 text-blue-500" },
    { label: "Coste estimado", value: `${tokenCost} €`, icon: "payments", iconColor: "bg-purple-500/10 text-purple-500", isStr: true },
  ];

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold">Panel de Analítica</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Datos reales de conversaciones y leads</p>
        </div>
        <button className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-primary/90 transition-colors">
          <span className="material-symbols-outlined text-sm">download</span>
          Exportar
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {KPI_CARDS.map((card) => (
          <div key={card.label} className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-start mb-2">
              <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">{card.label}</span>
              <span className={`p-1.5 rounded-lg ${card.iconColor}`}>
                <span className="material-symbols-outlined text-sm">{card.icon}</span>
              </span>
            </div>
            {loading ? (
              <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mt-2" />
            ) : (
              <h3 className="text-2xl font-bold mt-2">
                {card.isStr ? card.value : (card.value as number).toLocaleString("es-ES")}
              </h3>
            )}
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Bar chart */}
        <div className="lg:col-span-2 bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-slate-700">
          <h4 className="font-bold mb-6">Mensajes por día (últimos 7 días)</h4>
          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : last7.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
              Sin datos aún — usa el widget para generar conversaciones.
            </div>
          ) : (
            <div className="flex items-end justify-between h-48 gap-2">
              {last7.map((d) => {
                const pct = Math.round((d.messages / maxMessages) * 100);
                const label = new Date(d.date).toLocaleDateString("es-ES", { weekday: "short" });
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-primary/10 rounded-t-lg relative" style={{ height: "100%" }}>
                      <div
                        className="bg-primary w-full rounded-t-lg absolute bottom-0 transition-all"
                        style={{ height: `${pct}%` }}
                        title={`${d.messages} mensajes`}
                      />
                    </div>
                    <span className="text-xs text-slate-500 capitalize">{label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Resumen */}
        <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-slate-700">
          <h4 className="font-bold mb-6">Resumen general</h4>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-5">
              {[
                { label: "Conversaciones", value: totals?.total_conversations ?? 0, color: "bg-primary", max: totals?.total_conversations ?? 1 },
                { label: "Mensajes", value: totals?.total_messages ?? 0, color: "bg-blue-500", max: totals?.total_messages ?? 1 },
                { label: "Leads", value: totals?.total_leads ?? 0, color: "bg-emerald-500", max: Math.max(totals?.total_conversations ?? 1, 1) },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-500 dark:text-slate-400">{item.label}</span>
                    <span className="font-bold">{item.value.toLocaleString("es-ES")}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full`}
                      style={{ width: item.max > 0 ? `${Math.min(100, Math.round((item.value / item.max) * 100))}%` : "0%" }}
                    />
                  </div>
                </div>
              ))}
              <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/10">
                <p className="text-xs text-primary font-bold uppercase tracking-wider mb-1">Tokens usados</p>
                <p className="text-lg font-bold">
                  {((totals?.tokens_input ?? 0) + (totals?.tokens_output ?? 0)).toLocaleString("es-ES")}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Coste estimado: {tokenCost} €</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Daily breakdown */}
      {(() => {
        const reversed = daily.slice().reverse();
        const filtered = reversed.filter(d => {
          if (dateFrom && d.date < dateFrom) return false;
          if (dateTo && d.date > dateTo) return false;
          return true;
        });
        const totalPages = Math.ceil(filtered.length / dailyPerPage);
        const paginated = filtered.slice((dailyPage - 1) * dailyPerPage, dailyPage * dailyPerPage);

        return (
        <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold">Desglose diario</h4>
              <select
                value={dailyPerPage}
                onChange={e => { setDailyPerPage(Number(e.target.value)); setDailyPage(1); }}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium focus:outline-none"
              >
                <option value={10}>10 / pág</option>
                <option value={20}>20 / pág</option>
                <option value={50}>50 / pág</option>
              </select>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Desde</label>
                <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setDailyPage(1); }} className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Hasta</label>
                <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setDailyPage(1); }} className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
              </div>
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); setDailyPage(1); }} className="text-xs text-primary font-medium hover:underline">Limpiar</button>
              )}
            </div>
          </div>
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Sin datos en este rango</p>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase tracking-wider border-y border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4">Fecha</th>
                    <th className="text-right py-3 px-4">Conversaciones</th>
                    <th className="text-right py-3 px-4">Mensajes</th>
                    <th className="text-right py-3 px-4">Leads</th>
                    <th className="text-right py-3 px-4">Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((d) => (
                    <tr key={d.date} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-medium">{new Date(d.date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</td>
                      <td className="py-3 px-4 text-right">{d.conversations}</td>
                      <td className="py-3 px-4 text-right">{d.messages}</td>
                      <td className="py-3 px-4 text-right">{d.leads > 0 ? <span className="text-emerald-600 font-bold">{d.leads}</span> : "0"}</td>
                      <td className="py-3 px-4 text-right text-slate-400">{(d.tokens_input + d.tokens_output).toLocaleString("es-ES")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500">{Math.min((dailyPage - 1) * dailyPerPage + 1, filtered.length)}–{Math.min(dailyPage * dailyPerPage, filtered.length)} de {filtered.length}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setDailyPage(p => Math.max(1, p - 1))} disabled={dailyPage === 1} className="px-2 py-1 text-xs font-medium rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"><span className="material-symbols-outlined text-sm">chevron_left</span></button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - dailyPage) <= 1).map((p, i, arr) => (
                    <span key={p}>
                      {i > 0 && arr[i - 1] !== p - 1 && <span className="text-xs text-slate-400 px-1">...</span>}
                      <button onClick={() => setDailyPage(p)} className={`w-7 h-7 text-xs font-medium rounded transition-colors ${p === dailyPage ? "bg-primary text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}>{p}</button>
                    </span>
                  ))}
                  <button onClick={() => setDailyPage(p => Math.min(totalPages, p + 1))} disabled={dailyPage === totalPages} className="px-2 py-1 text-xs font-medium rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"><span className="material-symbols-outlined text-sm">chevron_right</span></button>
                </div>
              </div>
            )}
            </>
          )}
        </div>
        );
      })()}
    </>
  );
}
