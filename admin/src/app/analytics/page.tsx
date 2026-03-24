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
    ? ((totals.tokens_input * 0.01 + totals.tokens_output * 0.03) / 1000).toFixed(2)
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

      {/* Heatmap */}
      <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <h4 className="font-bold">Actividad por Horas (estimado)</h4>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400">Menos</span>
            {[10, 40, 70, 100].map(v => <div key={v} className={`size-2 rounded-sm ${heatOpacity(v)}`} />)}
            <span className="text-[10px] text-slate-400">Más</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="grid grid-cols-7 gap-1 text-[10px] text-center text-slate-500 mb-1 ml-8">
            {HEATMAP_DAYS.map(d => <span key={d}>{d}</span>)}
          </div>
          <div className="flex gap-2">
            <div className="flex flex-col justify-between text-[10px] text-slate-500 py-0.5 w-6 shrink-0">
              {HEATMAP_HOURS.map(h => <span key={h}>{h}</span>)}
            </div>
            <div className="flex-1 grid grid-cols-7 grid-rows-8 gap-1">
              {HEATMAP_ROWS.map((row, ri) =>
                row.map((val, ci) => (
                  <div key={`${ri}-${ci}`} className={`aspect-square rounded-sm ${heatOpacity(val)}`} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
