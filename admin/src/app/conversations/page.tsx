"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Conversation {
  id: string;
  tenant_id: string;
  session_id: string;
  status: string;
  messages_count: number;
  lead_captured: boolean;
  page_context: Record<string, string>;
  started_at: string | null;
  last_message_at: string | null;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string | null;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

type FilterTab = "all" | "leads" | "active";

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${Math.floor(hours / 24)}d`;
}

function StatusDot({ status, lead }: { status: string; lead: boolean }) {
  if (lead) return <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-amber-400 rounded-full border-2 border-white dark:border-slate-900" />;
  if (status === "active") return <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white dark:border-slate-900" />;
  return <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-slate-400 rounded-full border-2 border-white dark:border-slate-900" />;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [tenantFilter, setTenantFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [hideEmpty, setHideEmpty] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getConversations({ limit: "200" }),
      api.getTenants(),
    ]).then(([convs, ts]) => {
      setConversations(convs);
      setTenants(ts);
      if (convs.length > 0) setSelectedId(convs[0].id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setMessages([]);
    setMessagesLoading(true);
    api.getConversationMessages(selectedId)
      .then(setMessages)
      .catch(() => {})
      .finally(() => setMessagesLoading(false));
  }, [selectedId]);

  const selectedConv = conversations.find(c => c.id === selectedId);
  const tenantMap = Object.fromEntries(tenants.map(t => [t.id, t.name]));

  const filtered = conversations.filter(c => {
    const matchFilter =
      activeFilter === "all" ||
      (activeFilter === "leads" && c.lead_captured) ||
      (activeFilter === "active" && c.status === "active");
    const matchTenant = !tenantFilter || c.tenant_id === tenantFilter;
    const matchEmpty = !hideEmpty || c.messages_count > 0;
    const matchSearch =
      search === "" ||
      c.session_id.toLowerCase().includes(search.toLowerCase()) ||
      (c.page_context?.page_type || "").includes(search.toLowerCase()) ||
      (tenantMap[c.tenant_id] || "").toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchTenant && matchSearch && matchEmpty;
  });

  return (
    <div className="flex h-full -m-8 overflow-hidden">
      {/* Left Panel */}
      <aside className="w-[320px] lg:w-[30%] min-w-[260px] border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-bg-dark/50 shrink-0">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <h3 className="font-bold text-lg px-2">Conversaciones</h3>
          <div className="mt-3 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: "18px" }}>search</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-slate-400"
            />
          </div>
          <div className="mt-3 flex gap-2">
            {([
              { id: "all", label: "Todas" },
              { id: "leads", label: "Leads" },
              { id: "active", label: "Activas" },
            ] as { id: FilterTab; label: string }[]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  activeFilter === tab.id ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between px-1">
            <span className="text-xs text-slate-500">Ocultar sin mensajes</span>
            <button
              type="button"
              onClick={() => setHideEmpty(!hideEmpty)}
              className={`relative w-9 h-5 rounded-full transition-colors ${hideEmpty ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${hideEmpty ? "translate-x-4" : ""}`} />
            </button>
          </div>
          {tenants.length > 1 && (
            <select
              value={tenantFilter}
              onChange={e => setTenantFilter(e.target.value)}
              className="mt-3 w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Todos los tenants</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No hay conversaciones</div>
          ) : (
            filtered.map(conv => {
              const isLead = conv.lead_captured;
              const isActive = conv.status === "active";
              const isSelected = selectedId === conv.id;

              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={`p-4 flex gap-3 cursor-pointer transition-colors border-l-4 ${
                    isSelected ? (isLead ? "border-amber-400 bg-amber-400/10" : isActive ? "border-primary bg-primary/10" : "border-slate-300 bg-slate-50 dark:bg-slate-800/50") :
                    isLead ? "border-amber-400/50 hover:bg-amber-400/5" :
                    isActive ? "border-primary/50 hover:bg-primary/5" :
                    "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/30"
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      isLead ? "bg-amber-100 dark:bg-amber-400/10 border-2 border-amber-400" :
                      isActive ? "bg-primary/10 border-2 border-primary" :
                      "bg-slate-200 dark:bg-slate-700"
                    }`}>
                      <span className="material-symbols-outlined text-slate-500 dark:text-slate-400" style={{ fontSize: "18px" }}>person</span>
                    </div>
                    <StatusDot status={conv.status} lead={conv.lead_captured} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-0.5">
                      <span className="text-sm font-bold truncate">
                        {tenantMap[conv.tenant_id] || "—"}
                      </span>
                      <span className="text-[10px] text-slate-500 shrink-0 ml-2">{timeAgo(conv.last_message_at)}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mb-0.5">
                      {conv.page_context?.page_type ? `${conv.page_context.page_type}` : conv.session_id.slice(0, 12)}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {isLead && <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Lead ✓</span>}
                      {isActive && <span className="text-[10px] font-bold text-primary uppercase tracking-wide">Activa</span>}
                      {!isLead && !isActive && <span className="text-[10px] text-slate-400 uppercase tracking-wide">Finalizada</span>}
                      {conv.messages_count > 0 && <span className="text-[10px] text-slate-400">· {conv.messages_count} msgs</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Right Panel */}
      <section className="flex-1 flex flex-col bg-slate-50 dark:bg-bg-dark/30 min-w-0">
        {selectedConv ? (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-bg-dark/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-full flex items-center justify-center border-2 ${
                  selectedConv.lead_captured ? "border-amber-400 bg-amber-50 dark:bg-amber-400/10" :
                  selectedConv.status === "active" ? "border-primary bg-primary/10" :
                  "border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800"
                }`}>
                  <span className="material-symbols-outlined text-slate-500" style={{ fontSize: "18px" }}>person</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm">
                    {tenantMap[selectedConv.tenant_id] || "—"}
                    <span className="text-slate-400 font-normal ml-2 text-xs">{selectedConv.page_context?.page_type || ""}</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    {selectedConv.lead_captured && (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">Lead capturado ✓</span>
                    )}
                    {selectedConv.status === "active" && (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        <span className="text-[10px] text-green-500 font-semibold">Activa</span>
                      </>
                    )}
                    {selectedConv.page_context?.page_url && (
                      <span className="text-[10px] text-slate-400 truncate max-w-[200px]">{selectedConv.page_context.page_url}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                {selectedConv.messages_count > 0 && <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">{selectedConv.messages_count} mensajes</span>}
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">{timeAgo(selectedConv.started_at)}</span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-400">
                  <span className="material-symbols-outlined" style={{ fontSize: "32px" }}>chat_bubble_outline</span>
                  <p className="text-sm">Sin mensajes en esta conversación</p>
                  <p className="text-xs text-slate-300 dark:text-slate-600">El usuario abrió el chat pero no escribió</p>
                </div>
              ) : (
                messages.map((msg, i) => (
                  msg.role === "assistant" ? (
                    <div key={i} className="flex gap-3 max-w-[80%]">
                      <div className="h-8 w-8 rounded-lg bg-primary shrink-0 flex items-center justify-center">
                        <span className="material-symbols-outlined text-white" style={{ fontSize: "16px" }}>smart_toy</span>
                      </div>
                      <div className="bg-slate-200 dark:bg-slate-800 p-4 rounded-xl rounded-tl-none shadow-sm">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        {msg.timestamp && (
                          <span className="text-[10px] text-slate-500 mt-2 block">
                            {new Date(msg.timestamp).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="flex gap-3 max-w-[80%] ml-auto flex-row-reverse">
                      <div className="h-8 w-8 rounded-lg bg-slate-400 shrink-0 flex items-center justify-center">
                        <span className="material-symbols-outlined text-white" style={{ fontSize: "16px" }}>person</span>
                      </div>
                      <div className="bg-primary p-4 rounded-xl rounded-tr-none shadow-md">
                        <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        {msg.timestamp && (
                          <span className="text-[10px] text-white/70 mt-2 block text-right">
                            {new Date(msg.timestamp).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <span className="material-symbols-outlined" style={{ fontSize: "32px" }}>chat_bubble_outline</span>
            </div>
            <p className="text-sm font-medium">Selecciona una conversación</p>
          </div>
        )}
      </section>
    </div>
  );
}
