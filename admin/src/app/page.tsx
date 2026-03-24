"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  billing_plan: string;
  messages_used: number;
  monthly_message_limit: number;
}

interface Conversation {
  id: string;
  tenant_id: string;
  session_id: string;
  status: string;
  messages_count: number;
  lead_captured: boolean;
  started_at: string | null;
  last_message_at: string | null;
}

interface Lead {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  interest_type: string;
  status: string;
  created_at: string | null;
}

interface Analytics {
  totals: {
    total_conversations: number;
    total_messages: number;
    total_leads: number;
    tokens_input: number;
    tokens_output: number;
  };
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    lead: "bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20",
    active: "bg-accent-blue/10 text-accent-blue border-accent-blue/20",
    completed: "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700",
    new: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.new}`}>
      {status}
    </span>
  );
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "-";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function DashboardPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getTenants().catch(() => []),
      api.getConversations({ limit: "10" }).catch(() => []),
      api.getLeads({ limit: "10" }).catch(() => []),
      api.getAnalytics().catch(() => ({ totals: { total_conversations: 0, total_messages: 0, total_leads: 0, tokens_input: 0, tokens_output: 0 } })),
    ]).then(([t, c, l, a]) => {
      setTenants(t);
      setConversations(c);
      setLeads(l);
      setAnalytics(a);
      setLoading(false);
    });
  }, []);

  const totalConvos = analytics?.totals.total_conversations || conversations.length;
  const totalLeads = analytics?.totals.total_leads || leads.length;
  const tokenCost = analytics ? ((analytics.totals.tokens_input * 0.01 + analytics.totals.tokens_output * 0.03) / 1000).toFixed(2) : "0.00";
  const convRate = totalConvos > 0 ? ((totalLeads / totalConvos) * 100).toFixed(1) : "0";

  const tenantMap = Object.fromEntries(tenants.map(t => [t.id, t.name]));

  const KPI_CARDS = [
    { icon: "chat_bubble", label: "Conversaciones", value: totalConvos.toString(), color: "primary" },
    { icon: "person_add", label: "Leads generados", value: totalLeads.toString(), color: "accent-emerald" },
    { icon: "percent", label: "Tasa conversion", value: `${convRate}%`, color: "accent-blue" },
    { icon: "toll", label: "Coste tokens", value: `${tokenCost} €`, color: "slate" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Resumen de Actividad</h2>
        <p className="text-slate-500 dark:text-slate-400">Bienvenido de nuevo, administrador.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {KPI_CARDS.map((card) => (
          <div key={card.label} className="bg-white dark:bg-card-dark p-6 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800/50">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2 rounded-lg ${
                card.color === "primary" ? "bg-primary/10 text-primary" :
                card.color === "accent-emerald" ? "bg-accent-emerald/10 text-accent-emerald" :
                card.color === "accent-blue" ? "bg-accent-blue/10 text-accent-blue" :
                "bg-slate-100 dark:bg-slate-700 text-slate-500"
              }`}>
                <span className="material-symbols-outlined">{card.icon}</span>
              </div>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{card.label}</p>
            <h3 className="text-3xl font-bold mt-1">{card.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white dark:bg-card-dark rounded-lg p-6 border border-slate-100 dark:border-slate-800/50">
          <h3 className="text-lg font-bold mb-4">Tenants Activos</h3>
          <div className="space-y-3">
            {tenants.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.slug} &middot; {t.billing_plan}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{t.messages_used.toLocaleString("es-ES")}</p>
                  <p className="text-xs text-slate-500">/ {t.monthly_message_limit.toLocaleString("es-ES")} msgs</p>
                </div>
              </div>
            ))}
            {tenants.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">No hay tenants registrados</p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-card-dark rounded-lg p-6 border border-slate-100 dark:border-slate-800/50">
          <h3 className="text-lg font-bold mb-4">Leads Recientes</h3>
          <div className="space-y-3">
            {leads.slice(0, 5).map((l) => (
              <div key={l.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{l.name}</p>
                  <p className="text-xs text-slate-500">{l.interest_type} &middot; {timeAgo(l.created_at)}</p>
                </div>
                {statusBadge(l.status)}
              </div>
            ))}
            {leads.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">No hay leads todavia</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-card-dark rounded-lg overflow-hidden border border-slate-100 dark:border-slate-800/50">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
          <h3 className="text-lg font-bold">Ultimas conversaciones</h3>
          <a href="/conversations" className="text-primary text-sm font-semibold hover:underline">Ver todas</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 font-medium uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4">Tenant</th>
                <th className="px-6 py-4">Session</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Mensajes</th>
                <th className="px-6 py-4">Lead</th>
                <th className="px-6 py-4">Hace</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {conversations.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4 font-medium">{tenantMap[c.tenant_id] || c.tenant_id.slice(0, 8)}</td>
                  <td className="px-6 py-4 text-slate-400 font-mono text-xs">{c.session_id.slice(0, 12)}...</td>
                  <td className="px-6 py-4">{statusBadge(c.status)}</td>
                  <td className="px-6 py-4">{c.messages_count}</td>
                  <td className="px-6 py-4">
                    {c.lead_captured ? (
                      <span className="text-accent-emerald font-medium">Si</span>
                    ) : (
                      <span className="text-slate-400">No</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-400">{timeAgo(c.last_message_at || c.started_at)}</td>
                </tr>
              ))}
              {conversations.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No hay conversaciones todavia
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
