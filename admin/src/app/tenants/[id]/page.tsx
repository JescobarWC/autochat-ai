"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";

type Tab = "overview" | "general" | "prompt" | "widget" | "inventory" | "leads" | "knowledge";

interface LeadData {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  postal_code?: string;
  financing_needed?: boolean;
  vehicle_interest_id?: string;
  interest_type?: string;
  notes?: string;
  status: string;
  created_at: string;
  utm_data?: Record<string, string>;
}

interface TenantData {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  allowed_domains: string[];
  config: Record<string, unknown>;
  inventory_api_config: Record<string, unknown>;
  billing_plan: string;
  billing_status: string;
  messages_used: number;
  monthly_message_limit: number;
  created_at: string;
  updated_at: string;
}

export default function TenantConfigPage() {
  const { id } = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [domains, setDomains] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [billingPlan, setBillingPlan] = useState("trial");
  const [messageLimit, setMessageLimit] = useState(1000);

  // Config
  const [botName, setBotName] = useState("Asistente");
  const [openaiModel, setOpenaiModel] = useState("");
  const [customSystemPrompt, setCustomSystemPrompt] = useState("");
  const [personality, setPersonality] = useState("");
  const [warranty, setWarranty] = useState("");
  const [delivery, setDelivery] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1E40AF");
  const [accentColor, setAccentColor] = useState("#10B981");
  const [position, setPosition] = useState("bottom-right");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [showPoweredBy, setShowPoweredBy] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [enableCart, setEnableCart] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [checkoutAddPattern, setCheckoutAddPattern] = useState("");
  const [proactiveMessage, setProactiveMessage] = useState("");
  const [proactiveButtons, setProactiveButtons] = useState<Array<{label: string; msg: string}>>([]);
  const [quickReplies, setQuickReplies] = useState("");

  // Company info
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyHours, setCompanyHours] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");

  // Webhook
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookHeaders, setWebhookHeaders] = useState("{}");
  const [webhookFieldMapping, setWebhookFieldMapping] = useState("{}");
  const [webhookLeadString, setWebhookLeadString] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [testWebhookMsg, setTestWebhookMsg] = useState("");

  // Email notifications
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyEmails, setNotifyEmails] = useState("");

  // Leads
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadData | null>(null);
  const [sendingCrm, setSendingCrm] = useState<string | null>(null);
  const [leadsPage, setLeadsPage] = useState(1);
  const [leadsPerPage, setLeadsPerPage] = useState(10);
  const [leadsSearch, setLeadsSearch] = useState("");
  const [crmSendMsg, setCrmSendMsg] = useState<Record<string, string>>({});

  // External APIs
  const [externalApis, setExternalApis] = useState<Array<{name: string; description: string; query_description: string; url: string; method: string; headers: string; enabled: boolean}>>([]);

  // Overview analytics
  const [tenantAnalytics, setTenantAnalytics] = useState<{ totals: { total_conversations: number; total_messages: number; total_leads: number; tokens_input: number; tokens_output: number }; daily: Array<{ date: string; conversations: number; messages: number; leads: number; tokens_input: number; tokens_output: number }> } | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [vehicleInfo, setVehicleInfo] = useState<Record<string, string> | null>(null);

  // Inventory
  const [flushMsg, setFlushMsg] = useState("");
  const [flushing, setFlushing] = useState(false);
  const [debugData, setDebugData] = useState<null | { total: number; mode: string; sample: Record<string, unknown>[] }>(null);
  const [debugging, setDebugging] = useState(false);
  const [debugSearch, setDebugSearch] = useState("");
  const [debugSelected, setDebugSelected] = useState<Record<string, unknown> | null>(null);
  const [invType, setInvType] = useState("mock");
  const [feedUrl, setFeedUrl] = useState("");
  const [detailUrlPattern, setDetailUrlPattern] = useState("/comprar-coches-ocasion/{make}/{model}/{id}");
  const [restApiUrl, setRestApiUrl] = useState("");
  const [restApiKey, setRestApiKey] = useState("");
  const [fieldMapping, setFieldMapping] = useState("{}");

  useEffect(() => {
    if (!id) return;
    api.getTenant(id as string)
      .then((t: TenantData) => {
        setTenant(t);
        setName(t.name);
        setSlug(t.slug);
        setDomains((t.allowed_domains || []).join(", "));
        setIsActive(t.is_active);
        setBillingPlan(t.billing_plan || "trial");
        setMessageLimit(t.monthly_message_limit || 1000);

        const cfg = (t.config || {}) as Record<string, unknown>;
        const company = (cfg.company_info || {}) as Record<string, string>;
        const theme = (cfg.widget_theme || {}) as Record<string, unknown>;

        setWebhookUrl((cfg.webhook_url as string) || "");
        setWebhookHeaders(cfg.webhook_headers ? JSON.stringify(cfg.webhook_headers, null, 2) : "{}");
        setWebhookFieldMapping(cfg.webhook_field_mapping ? JSON.stringify(cfg.webhook_field_mapping, null, 2) : "{}");
        setWebhookLeadString(!!(cfg.webhook_lead_string));
        setExternalApis((cfg.external_apis as typeof externalApis) || []);
        const notif = (cfg.notification_email || {}) as Record<string, unknown>;
        setNotifyEnabled(!!(notif.enabled));
        setNotifyEmails(Array.isArray(notif.to) ? (notif.to as string[]).join(", ") : (notif.to as string || ""));
        setBotName((cfg.bot_name as string) || "Asistente");
        setOpenaiModel((cfg.openai_model as string) || "");
        setCustomSystemPrompt((cfg.custom_system_prompt as string) || "");
        setPersonality((cfg.personality as string) || "");
        setWarranty((cfg.warranty_policy as string) || "");
        setDelivery((cfg.delivery_info as string) || "");
        setPrimaryColor((theme.primary_color as string) || "#1E40AF");
        setAccentColor((theme.accent_color as string) || "#10B981");
        setPosition((theme.position as string) || "bottom-right");
        setWelcomeMessage((theme.welcome_message as string) || "");
        setShowPoweredBy(theme.show_powered_by !== false);
        setAvatarUrl((theme.avatar_url as string) || "");
        setEnableCart(!!(theme.enable_cart));
        setCheckoutUrl((theme.checkout_url as string) || "");
        setCheckoutAddPattern((theme.checkout_add_pattern as string) || "");
        setProactiveMessage((theme.proactive_message as string) || "");
        setProactiveButtons((theme.proactive_buttons as typeof proactiveButtons) || []);
        setQuickReplies(Array.isArray(theme.quick_replies) ? (theme.quick_replies as string[]).join(", ") : "");

        setCompanyName(company.name || "");
        setCompanyAddress(company.address || "");
        setCompanyPhone(company.phone || "");
        setCompanyHours(company.hours || "");
        setCompanyWebsite(company.website || "");

        const inv = (t.inventory_api_config || {}) as Record<string, string>;
        setInvType(inv.type || "mock");
        setFeedUrl(inv.feed_url || "");
        setDetailUrlPattern(inv.detail_url_pattern || "/comprar-coches-ocasion/{make}/{model}/{id}");
        setRestApiUrl(inv.api_url || "");
        setRestApiKey(inv.api_key || "");
        setFieldMapping(inv.field_mapping ? JSON.stringify(inv.field_mapping, null, 2) : "{}");

        setLoading(false);
        loadTenantAnalytics();
      })
      .catch(() => {
        setLoading(false);
      });
  }, [id]);

  async function handleSendToCrm(leadId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSendingCrm(leadId);
    try {
      const res = await api.sendLeadToCrm(leadId);
      if (res.status_code >= 200 && res.status_code < 300) {
        setCrmSendMsg(prev => ({ ...prev, [leadId]: `✓ HTTP ${res.status_code}` }));
      } else {
        const payloadStr = JSON.stringify(res.payload_sent, null, 2);
        setCrmSendMsg(prev => ({ ...prev, [leadId]: `✗ HTTP ${res.status_code} — Payload enviado:\n${payloadStr}` }));
      }
    } catch (err: unknown) {
      setCrmSendMsg(prev => ({ ...prev, [leadId]: `✗ ${err instanceof Error ? err.message : "Error"}` }));
    }
    setSendingCrm(null);
    setTimeout(() => setCrmSendMsg(prev => { const n = { ...prev }; delete n[leadId]; return n; }), 30000);
  }

  async function loadLeads() {
    if (!id) return;
    setLeadsLoading(true);
    try {
      const data = await api.getLeads({ tenant_id: id as string, limit: "200" });
      setLeads(data);
    } catch {
      setLeads([]);
    }
    setLeadsLoading(false);
  }

  async function loadTenantAnalytics() {
    if (!id) return;
    setAnalyticsLoading(true);
    try {
      const data = await api.getAnalytics({ tenant_id: id as string });
      setTenantAnalytics(data);
    } catch {
      setTenantAnalytics(null);
    }
    setAnalyticsLoading(false);
  }

  async function handleDebugInventory() {
    if (!id) return;
    setDebugging(true);
    setDebugData(null);
    try {
      const data = await api.debugInventory(id as string);
      setDebugData(data);
    } catch {
      setDebugData({ total: 0, mode: "error", sample: [] });
    }
    setDebugging(false);
  }

  async function handleTestWebhook() {
    if (!id) return;
    setTestingWebhook(true);
    setTestWebhookMsg("");
    try {
      const res = await api.testWebhook(id as string);
      setTestWebhookMsg(`Enviado correctamente (HTTP ${res.status_code}). El CRM/webhook debería haber recibido el payload.`);
    } catch (e: unknown) {
      setTestWebhookMsg("Error: " + (e instanceof Error ? e.message : "desconocido"));
    }
    setTestingWebhook(false);
    setTimeout(() => setTestWebhookMsg(""), 8000);
  }

  async function handleFlushInventory() {
    if (!id) return;
    setFlushing(true);
    setFlushMsg("");
    try {
      await api.flushInventoryCache(id as string);
      setFlushMsg("Caché limpiada. El próximo mensaje recargará el inventario.");
    } catch {
      setFlushMsg("Error al limpiar la caché.");
    }
    setFlushing(false);
    setTimeout(() => setFlushMsg(""), 5000);
  }

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    setSaveMsg("");

    const config = {
      bot_name: botName,
      openai_model: openaiModel || undefined,
      external_apis: externalApis.length > 0 ? externalApis : undefined,
      webhook_url: webhookUrl || undefined,
      webhook_headers: (() => { try { const h = JSON.parse(webhookHeaders); return Object.keys(h).length ? h : undefined; } catch { return undefined; } })(),
      webhook_field_mapping: (() => { try { const m = JSON.parse(webhookFieldMapping); return Object.keys(m).length ? m : undefined; } catch { return undefined; } })(),
      webhook_lead_string: webhookLeadString || undefined,
      notification_email: {
        enabled: notifyEnabled,
        to: notifyEmails.split(",").map((e: string) => e.trim()).filter(Boolean),
      },
      custom_system_prompt: customSystemPrompt || undefined,
      personality,
      warranty_policy: warranty,
      delivery_info: delivery,
      company_info: {
        name: companyName,
        address: companyAddress,
        phone: companyPhone,
        hours: companyHours,
        website: companyWebsite,
      },
      widget_theme: {
        primary_color: primaryColor,
        accent_color: accentColor,
        position,
        welcome_message: welcomeMessage,
        show_powered_by: showPoweredBy,
        avatar_url: avatarUrl || undefined,
        enable_cart: enableCart || undefined,
        checkout_url: checkoutUrl || undefined,
        checkout_add_pattern: checkoutAddPattern || undefined,
        proactive_message: proactiveMessage || undefined,
        proactive_buttons: proactiveButtons.length > 0 ? proactiveButtons : undefined,
        quick_replies: quickReplies ? quickReplies.split(",").map(s => s.trim()).filter(Boolean) : undefined,
      },
    };

    let inventoryConfig: Record<string, unknown> = { type: invType };
    if (invType === "xml_feed") {
      inventoryConfig.feed_url = feedUrl;
      inventoryConfig.detail_url_pattern = detailUrlPattern;
    } else if (invType === "rest") {
      inventoryConfig.api_url = restApiUrl;
      if (restApiKey) inventoryConfig.api_key = restApiKey;
      try { inventoryConfig.field_mapping = JSON.parse(fieldMapping); } catch { /* keep as-is */ }
    }

    try {
      await api.updateTenant(id as string, {
        name,
        is_active: isActive,
        allowed_domains: domains.split(",").map(d => d.trim()).filter(Boolean),
        config,
        inventory_api_config: inventoryConfig,
        billing_plan: billingPlan,
        monthly_message_limit: messageLimit,
      });
      setSaveMsg("Cambios guardados correctamente");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (e: unknown) {
      setSaveMsg("Error al guardar: " + (e instanceof Error ? e.message : "desconocido"));
    }
    setSaving(false);
  }

  const userRole = (() => { try { const u = JSON.parse(localStorage.getItem("user") || "{}"); return u.role || "admin"; } catch { return "admin"; } })();

  const allTabs: { key: Tab; label: string; icon: string; roles: string[] }[] = [
    { key: "overview", label: "Resumen", icon: "dashboard", roles: ["superadmin", "admin", "user"] },
    { key: "general", label: "General", icon: "settings", roles: ["superadmin", "admin"] },
    { key: "prompt", label: "Prompt Editor", icon: "terminal", roles: ["superadmin", "admin"] },
    { key: "widget", label: "Widget Settings", icon: "widgets", roles: ["superadmin", "admin"] },
    { key: "inventory", label: "Inventario", icon: "directions_car", roles: ["superadmin", "admin"] },
    { key: "leads", label: "Leads", icon: "person_add", roles: ["superadmin", "admin", "user"] },
    { key: "knowledge", label: "Base de Conocimiento", icon: "menu_book", roles: ["superadmin", "admin"] },
  ];

  const tabs = allTabs.filter(t => t.roles.includes(userRole));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Tenant no encontrado</p>
        <a href="/tenants" className="text-primary text-sm mt-2 inline-block">Volver a la lista</a>
      </div>
    );
  }

  const usagePercent = messageLimit > 0 ? Math.min(100, Math.round((tenant.messages_used / messageLimit) * 100)) : 0;

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <a href="/tenants" className="p-2 hover:bg-slate-100 dark:hover:bg-card-dark rounded-lg transition-colors text-slate-400">
            <span className="material-symbols-outlined">arrow_back</span>
          </a>
          <div>
            <h2 className="text-2xl font-bold">{name}</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{slug} &middot; {billingPlan}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saveMsg && (
            <span className={`text-sm font-medium ${saveMsg.startsWith("Error") ? "text-red-500" : "text-accent-emerald"}`}>
              {saveMsg}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">{saving ? "hourglass_empty" : "save"}</span>
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-8 border-b border-slate-200 dark:border-slate-800">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); if (tab.key === "leads") loadLeads(); if (tab.key === "overview") loadTenantAnalytics(); }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <span className="material-symbols-outlined text-sm">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          {analyticsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tenantAnalytics ? (() => {
            const t = tenantAnalytics.totals;
            const daily = tenantAnalytics.daily || [];
            const last7 = daily.slice(-7);
            const maxMsgs = Math.max(...last7.map(d => d.messages), 1);
            const convRate = t.total_conversations > 0 ? ((t.total_leads / t.total_conversations) * 100).toFixed(1) : "0";
            const tokenCost = ((t.tokens_input * 0.0004 + t.tokens_output * 0.0016) / 1000).toFixed(2);
            return (
              <>
                {/* KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  {[
                    { label: "Conversaciones", value: t.total_conversations, icon: "chat", color: "bg-primary/10 text-primary" },
                    { label: "Leads", value: t.total_leads, icon: "person_add", color: "bg-emerald-500/10 text-emerald-500" },
                    { label: "% Conversión", value: `${convRate}%`, icon: "query_stats", color: "bg-amber-500/10 text-amber-500", isStr: true },
                    { label: "Mensajes", value: t.total_messages, icon: "forum", color: "bg-blue-500/10 text-blue-500" },
                    { label: "Coste IA", value: `${tokenCost} €`, icon: "payments", color: "bg-purple-500/10 text-purple-500", isStr: true },
                  ].map(card => (
                    <div key={card.label} className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">{card.label}</span>
                        <span className={`p-1.5 rounded-lg ${card.color}`}>
                          <span className="material-symbols-outlined text-sm">{card.icon}</span>
                        </span>
                      </div>
                      <h3 className="text-2xl font-bold mt-2">
                        {card.isStr ? card.value : (card.value as number).toLocaleString("es-ES")}
                      </h3>
                    </div>
                  ))}
                </div>

                {/* Chart + Recent */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                    <h4 className="font-bold mb-6">Mensajes por día (últimos 7 días)</h4>
                    {last7.length === 0 ? (
                      <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Sin datos todavía</div>
                    ) : (
                      <div className="flex items-end justify-between h-48 gap-2">
                        {last7.map((d) => {
                          const pct = Math.round((d.messages / maxMsgs) * 100);
                          return (
                            <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
                              <div className="w-full bg-primary/10 rounded-t-lg relative" style={{ height: "100%" }}>
                                <div className="bg-primary w-full rounded-t-lg absolute bottom-0 transition-all" style={{ height: `${pct}%` }} title={`${d.messages} msgs`} />
                              </div>
                              <span className="text-xs text-slate-500 capitalize">{new Date(d.date).toLocaleDateString("es-ES", { weekday: "short" })}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                    <h4 className="font-bold mb-6">Resumen</h4>
                    <div className="space-y-5">
                      {[
                        { label: "Conversaciones", value: t.total_conversations, color: "bg-primary", max: t.total_conversations || 1 },
                        { label: "Mensajes", value: t.total_messages, color: "bg-blue-500", max: t.total_messages || 1 },
                        { label: "Leads", value: t.total_leads, color: "bg-emerald-500", max: Math.max(t.total_conversations, 1) },
                      ].map((item) => (
                        <div key={item.label}>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-slate-500 dark:text-slate-400">{item.label}</span>
                            <span className="font-bold">{item.value.toLocaleString("es-ES")}</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full ${item.color} rounded-full`} style={{ width: `${Math.min(100, Math.round((item.value / item.max) * 100))}%` }} />
                          </div>
                        </div>
                      ))}
                      <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/10">
                        <p className="text-xs text-primary font-bold uppercase tracking-wider mb-1">Tokens usados</p>
                        <p className="text-lg font-bold">{(t.tokens_input + t.tokens_output).toLocaleString("es-ES")}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Coste estimado: {tokenCost} €</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            );
          })() : (
            <div className="text-center py-16 text-slate-400">
              <span className="material-symbols-outlined text-4xl block mb-2">monitoring</span>
              <p className="text-sm">Sin datos de actividad todavía</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "general" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-card-dark rounded-lg p-6 border border-slate-100 dark:border-slate-800/50">
            <h3 className="text-lg font-bold mb-6">Informacion basica</h3>
            <div className="space-y-4">
              <Field label="Nombre" value={name} onChange={setName} />
              <Field label="Slug" value={slug} onChange={setSlug} />
              <Field label="Dominios permitidos" value={domains} onChange={setDomains} hint="Separados por coma" />
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">Estado</label>
                <select
                  value={isActive ? "active" : "inactive"}
                  onChange={(e) => setIsActive(e.target.value === "active")}
                  className="w-full bg-slate-100 dark:bg-slate-800/50 border-none rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-primary"
                >
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-card-dark rounded-lg p-6 border border-slate-100 dark:border-slate-800/50">
            <h3 className="text-lg font-bold mb-6">Informacion del concesionario</h3>
            <div className="space-y-4">
              <Field label="Nombre comercial" value={companyName} onChange={setCompanyName} />
              <Field label="Direccion" value={companyAddress} onChange={setCompanyAddress} />
              <Field label="Telefono" value={companyPhone} onChange={setCompanyPhone} />
              <Field label="Horario" value={companyHours} onChange={setCompanyHours} />
              <Field label="Website" value={companyWebsite} onChange={setCompanyWebsite} />
            </div>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-card-dark rounded-lg p-6 border border-slate-100 dark:border-slate-800/50">
            <h3 className="text-lg font-bold mb-6">Plan y facturacion</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">Plan</label>
                <select
                  value={billingPlan}
                  onChange={(e) => setBillingPlan(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800/50 border-none rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-primary"
                >
                  <option value="trial">Trial</option>
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">Limite mensual de mensajes</label>
                <input
                  className="w-full bg-slate-100 dark:bg-slate-800/50 border-none rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-primary"
                  value={messageLimit}
                  onChange={(e) => setMessageLimit(Number(e.target.value))}
                  type="number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">Mensajes usados</label>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${usagePercent}%` }} />
                  </div>
                  <span className="text-sm font-bold">{tenant.messages_used.toLocaleString("es-ES")} / {messageLimit.toLocaleString("es-ES")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "prompt" && (
        <div className="space-y-6">
          {/* System Prompt completo */}
          <div className="bg-white dark:bg-card-dark rounded-lg p-6 border border-slate-100 dark:border-slate-800/50">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-lg font-bold">System Prompt personalizado</h3>
              {customSystemPrompt && (
                <span className="text-xs font-semibold px-2 py-1 bg-primary/10 text-primary rounded-full">Activo</span>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Si se define, reemplaza completamente el prompt base. Las herramientas del inventario y el contexto de página se añaden automáticamente.
              {!customSystemPrompt && <span className="text-amber-500 font-medium"> (vacío — usando prompt por defecto)</span>}
            </p>
            <textarea
              className="w-full bg-slate-900 text-green-300 border-none rounded-lg py-3 px-4 text-sm font-mono focus:ring-2 focus:ring-primary resize-y"
              style={{ minHeight: "420px" }}
              value={customSystemPrompt}
              onChange={(e) => setCustomSystemPrompt(e.target.value)}
              placeholder="Eres el asistente virtual de..."
              spellCheck={false}
            />
          </div>

          {/* Campos básicos (solo aplican si no hay custom_system_prompt) */}
          <div className="bg-white dark:bg-card-dark rounded-lg p-6 border border-slate-100 dark:border-slate-800/50">
            <h3 className="text-lg font-bold mb-1">Configuración básica</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {customSystemPrompt ? "Ignorados mientras el prompt personalizado esté activo (excepto el nombre del bot)." : "Se usan cuando no hay prompt personalizado."}
            </p>
            <div className="space-y-4">
              <Field label="Nombre del bot" value={botName} onChange={setBotName} />
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">Modelo IA</label>
                <select
                  value={openaiModel}
                  onChange={e => setOpenaiModel(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800/50 border-none rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-primary"
                >
                  <option value="">Por defecto (gpt-4.1-mini)</option>
                  <option value="gpt-4.1-nano">GPT-4.1 Nano — Más económico</option>
                  <option value="gpt-4.1-mini">GPT-4.1 Mini — Recomendado</option>
                  <option value="gpt-4.1">GPT-4.1 — Premium</option>
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4o">GPT-4o</option>
                </select>
                <p className="text-xs text-slate-400 mt-1">Deja en blanco para usar el modelo por defecto del sistema</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">Personalidad</label>
                <textarea className="w-full bg-slate-100 dark:bg-slate-800/50 border-none rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-primary h-20 resize-none" value={personality} onChange={(e) => setPersonality(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">Politica de garantia</label>
                <textarea className="w-full bg-slate-100 dark:bg-slate-800/50 border-none rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-primary h-16 resize-none" value={warranty} onChange={(e) => setWarranty(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">Info de entrega</label>
                <textarea className="w-full bg-slate-100 dark:bg-slate-800/50 border-none rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-primary h-16 resize-none" value={delivery} onChange={(e) => setDelivery(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "widget" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-card-dark rounded-lg p-6 border border-slate-100 dark:border-slate-800/50">
            <h3 className="text-lg font-bold mb-6">Apariencia del Widget</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">Color primario</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-10 h-10 rounded-lg border-none cursor-pointer" />
                  <input className="flex-1 bg-slate-100 dark:bg-slate-800/50 border-none rounded-lg py-2.5 px-4 text-sm font-mono" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">Color de acento</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-10 h-10 rounded-lg border-none cursor-pointer" />
                  <input className="flex-1 bg-slate-100 dark:bg-slate-800/50 border-none rounded-lg py-2.5 px-4 text-sm font-mono" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">Posicion</label>
                <select value={position} onChange={(e) => setPosition(e.target.value)} className="w-full bg-slate-100 dark:bg-slate-800/50 border-none rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-primary">
                  <option value="bottom-right">bottom-right</option>
                  <option value="bottom-left">bottom-left</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">Mensaje de bienvenida</label>
                <textarea className="w-full bg-slate-100 dark:bg-slate-800/50 border-none rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-primary h-20 resize-none" value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-500 dark:text-slate-400">Mostrar &quot;Powered by EAI-STUDIO Chat&quot;</label>
                <button
                  type="button"
                  onClick={() => setShowPoweredBy(!showPoweredBy)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${showPoweredBy ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${showPoweredBy ? "left-5" : "left-0.5"}`} />
                </button>
              </div>

            {/* Avatar */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Imagen del avatar</label>
              <div className="flex gap-3 items-center">
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <span className="material-symbols-outlined text-slate-400">person</span>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={avatarUrl}
                      onChange={e => setAvatarUrl(e.target.value)}
                      placeholder="URL de la imagen o sube una"
                      className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <label className="px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg cursor-pointer hover:bg-blue-700 transition-colors flex items-center gap-1.5 shrink-0">
                      <span className="material-symbols-outlined text-base">upload</span>
                      Subir
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) { alert("Máximo 2MB"); return; }
                          const formData = new FormData();
                          formData.append("file", file);
                          try {
                            const token = localStorage.getItem("token");
                            const res = await fetch("https://chat.eaistudio.es/api/v1/admin/upload", {
                              method: "POST",
                              headers: { Authorization: `Bearer ${token}` },
                              body: formData,
                            });
                            if (!res.ok) throw new Error("Upload failed");
                            const data = await res.json();
                            setAvatarUrl(data.url);
                          } catch { alert("Error al subir la imagen"); }
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-slate-400">PNG, JPG, SVG o WebP. Máx 2MB. Recomendado: 80×80px.</p>
                </div>
              </div>
            </div>

            </div>
          </div>

          {/* Carrito */}
          <div className="bg-white dark:bg-card-dark rounded-lg p-6 border border-slate-100 dark:border-slate-800/50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Carrito de compra</h3>
                <p className="text-xs text-slate-400 mt-0.5">Permite a los clientes añadir productos al carrito desde las cards del chat</p>
              </div>
              <button
                type="button"
                onClick={() => setEnableCart(!enableCart)}
                className={`relative w-11 h-6 rounded-full transition-colors ${enableCart ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enableCart ? "translate-x-5" : ""}`} />
              </button>
            </div>
          </div>

          {enableCart && (
            <div className="bg-white dark:bg-card-dark rounded-lg p-6 border border-slate-100 dark:border-slate-800/50 space-y-4">
              <div>
                <h3 className="text-sm font-bold">Checkout externo</h3>
                <p className="text-xs text-slate-400 mt-0.5">Conecta el carrito del widget con la tienda online del cliente para finalizar la compra.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">URL para a\u00f1adir al carrito</label>
                <input type="text" value={checkoutAddPattern} onChange={e => setCheckoutAddPattern(e.target.value)}
                  placeholder="https://tienda.com/carrito?add=1&id_product={id}&qty={qty}"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500" />
                <p className="text-xs text-slate-400 mt-1">Usa {"{id}"} y {"{qty}"} como variables. Se llama por cada producto del carrito.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">URL de checkout / finalizar compra</label>
                <input type="text" value={checkoutUrl} onChange={e => setCheckoutUrl(e.target.value)}
                  placeholder="https://tienda.com/pedido"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500" />
                <p className="text-xs text-slate-400 mt-1">Despu\u00e9s de a\u00f1adir los productos, redirige aqu\u00ed. Si est\u00e1 vac\u00edo, el pedido se env\u00eda por el chat.</p>
              </div>
            </div>
          )}

          {/* Mensaje proactivo y quick replies */}
          <div className="bg-white dark:bg-card-dark rounded-lg p-6 border border-slate-100 dark:border-slate-800/50 space-y-5">
            <div>
              <h3 className="text-lg font-bold mb-1">Mensaje proactivo</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">El globo que aparece a los 6 segundos para invitar al usuario a interactuar.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mensaje del globo</label>
              <input
                type="text"
                value={proactiveMessage}
                onChange={e => setProactiveMessage(e.target.value)}
                placeholder="¡Hola! ¿En qué puedo ayudarte?"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Botones del globo</label>
              <p className="text-xs text-slate-400 mb-2">Botones que aparecen debajo del mensaje proactivo. Al hacer click, envían el mensaje automáticamente.</p>
              {proactiveButtons.map((btn, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={btn.label}
                    onChange={e => { const copy = [...proactiveButtons]; copy[idx].label = e.target.value; setProactiveButtons(copy); }}
                    placeholder="Texto del botón"
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    value={btn.msg}
                    onChange={e => { const copy = [...proactiveButtons]; copy[idx].msg = e.target.value; setProactiveButtons(copy); }}
                    placeholder="Mensaje que envía"
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  />
                  <button type="button" onClick={() => setProactiveButtons(proactiveButtons.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-500">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setProactiveButtons([...proactiveButtons, { label: "", msg: "" }])}
                className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Añadir botón
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Quick replies (botones iniciales del chat)</label>
              <input
                type="text"
                value={quickReplies}
                onChange={e => setQuickReplies(e.target.value)}
                placeholder="Buscar coche, Ver financiación, Contactar"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
              <p className="text-xs text-slate-400 mt-1">Separados por comas. Son los botones que aparecen debajo del mensaje de bienvenida.</p>
            </div>

            <button type="button" onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
              <span className="material-symbols-outlined text-sm">save</span>
              {saving ? "Guardando..." : "Guardar"}
            </button>
            {saveMsg && <p className={`text-xs ${saveMsg.startsWith("Error") ? "text-red-500" : "text-emerald-500"}`}>{saveMsg}</p>}
          </div>

          <div className="bg-white dark:bg-card-dark rounded-lg p-6 border border-slate-100 dark:border-slate-800/50">
            <h3 className="text-lg font-bold mb-6">Codigo de instalacion</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Copia y pega este snippet en el HTML de la web del concesionario, antes del cierre de &lt;/body&gt;</p>
            <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm text-green-400 overflow-x-auto">
              <pre>{`<script\n  src="https://chat.eaistudio.es/widget.js"\n  data-tenant="${tenant.id}"\n></script>`}</pre>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`<script src="https://chat.eaistudio.es/widget.js" data-tenant="${tenant.id}"></script>`);
              }}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">content_copy</span>
              Copiar codigo
            </button>
          </div>
        </div>
      )}

      {activeTab === "inventory" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-card-dark rounded-lg p-6 border border-slate-100 dark:border-slate-800/50">
            <h3 className="text-lg font-bold mb-6">Conexion de inventario</h3>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">Tipo de conexion</label>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { value: "mock", label: "Mock", desc: "Datos de prueba", icon: "science" },
                  { value: "xml_feed", label: "XML Feed", desc: "inventario.pro, coches.net...", icon: "rss_feed" },
                  { value: "rest", label: "REST API", desc: "API personalizada", icon: "api" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setInvType(opt.value)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      invType === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <span className={`material-symbols-outlined text-xl mb-2 block ${invType === opt.value ? "text-primary" : "text-slate-400"}`}>{opt.icon}</span>
                    <p className="font-semibold text-sm">{opt.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {invType === "mock" && (
              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-amber-500 mb-2">
                  <span className="material-symbols-outlined text-sm">info</span>
                  <span className="text-sm font-medium">Modo Mock activo</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Se usan 3 vehiculos de prueba (Audi Q5, BMW Serie 3, Mercedes GLC). Conecta un feed XML o API REST para usar el inventario real.</p>
              </div>
            )}

            {invType === "xml_feed" && (
              <div className="space-y-4">
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-center gap-2 text-primary mb-2">
                    <span className="material-symbols-outlined text-sm">rss_feed</span>
                    <span className="text-sm font-medium">Feed XML</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Compatible con inventario.pro, coches.net, autocasion y cualquier feed XML estandar. El feed se cachea en Redis durante 15 minutos.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">URL del Feed XML</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={feedUrl}
                      onChange={e => setFeedUrl(e.target.value)}
                      placeholder="https://feeds.inventario.pro/feed/get/MiConcesionario/TOKEN"
                      className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary"
                    />
                    <label className="px-4 py-2.5 bg-slate-600 text-white text-sm font-semibold rounded-lg cursor-pointer hover:bg-slate-700 transition-colors flex items-center gap-1.5 shrink-0">
                      <span className="material-symbols-outlined text-base">upload_file</span>
                      Subir XML/CSV
                      <input
                        type="file"
                        accept=".xml,.csv,text/xml,application/xml,text/csv"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 20 * 1024 * 1024) { alert("Máximo 20MB"); return; }
                          const formData = new FormData();
                          formData.append("file", file);
                          try {
                            const token = localStorage.getItem("token");
                            const res = await fetch("https://chat.eaistudio.es/api/v1/admin/upload-xml", {
                              method: "POST",
                              headers: { Authorization: `Bearer ${token}` },
                              body: formData,
                            });
                            if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || "Error"); }
                            const data = await res.json();
                            setFeedUrl(data.url);
                            alert("XML subido correctamente. URL actualizada.");
                          } catch (err) { alert(err instanceof Error ? err.message : "Error al subir el XML"); }
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">Pega la URL de tu feed o sube un fichero XML o CSV directamente</p>
                </div>

                <Field
                  label="Patron URL de detalle"
                  value={detailUrlPattern}
                  onChange={setDetailUrlPattern}
                  hint="Variables: {make}, {model}, {id}. Ej: /comprar-coches-ocasion/{make}/{model}/{id}"
                />

                {feedUrl && (
                  <div className="p-3 bg-accent-emerald/5 border border-accent-emerald/20 rounded-lg flex items-center gap-2">
                    <span className="material-symbols-outlined text-accent-emerald text-sm">check_circle</span>
                    <span className="text-xs text-slate-600 dark:text-slate-400">Feed configurado. Los vehiculos se sincronizaran automaticamente.</span>
                  </div>
                )}
              </div>
            )}

            {invType === "rest" && (
              <div className="space-y-4">
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-center gap-2 text-primary mb-2">
                    <span className="material-symbols-outlined text-sm">api</span>
                    <span className="text-sm font-medium">REST API</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Conecta con la API propia del concesionario. Requiere que la API devuelva un array de vehiculos en formato JSON.</p>
                </div>

                <Field
                  label="URL de la API"
                  value={restApiUrl}
                  onChange={setRestApiUrl}
                  hint="Ej: https://api.concesionario.es/v1/vehicles"
                />

                <Field
                  label="API Key (si requiere)"
                  value={restApiKey}
                  onChange={setRestApiKey}
                  type="password"
                  hint="Se enviara como header Authorization: Bearer ..."
                />

                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">Field Mapping (JSON)</label>
                  <p className="text-xs text-slate-400 mb-2">Mapea los campos de tu API a los campos internos de EAI-STUDIO Chat</p>
                  <textarea
                    className="w-full bg-slate-900 text-green-400 border-none rounded-lg py-3 px-4 text-sm font-mono focus:ring-2 focus:ring-primary h-32 resize-none"
                    value={fieldMapping}
                    onChange={(e) => setFieldMapping(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {invType !== "mock" && (
            <div className="bg-white dark:bg-card-dark rounded-lg p-6 border border-slate-100 dark:border-slate-800/50">
              <h3 className="text-base font-bold mb-1">Caché de inventario</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                El inventario se cachea 15 minutos en Redis. Si añadiste vehículos nuevos y el asistente no los ve, limpia la caché para forzar una recarga inmediata.
              </p>
              <div className="flex gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={handleFlushInventory}
                  disabled={flushing}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-sm">{flushing ? "hourglass_empty" : "refresh"}</span>
                  {flushing ? "Limpiando..." : "Limpiar caché ahora"}
                </button>
                <button
                  type="button"
                  onClick={handleDebugInventory}
                  disabled={debugging}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-sm">{debugging ? "hourglass_empty" : "bug_report"}</span>
                  {debugging ? "Cargando..." : "Ver inventario parseado"}
                </button>
              </div>
              {flushMsg && (
                <p className={`text-xs mt-3 ${flushMsg.startsWith("Error") ? "text-red-500" : "text-emerald-500"}`}>
                  {flushMsg}
                </p>
              )}
              {debugData && (
                <div className="mt-4 space-y-3">
                  <p className="text-xs text-slate-500">
                    Modo: <strong>{debugData.mode}</strong> — Total: <strong>{debugData.total}</strong> vehículos
                  </p>
                  <input
                    className="w-full bg-slate-100 dark:bg-slate-800/50 border-none rounded-lg py-2 px-4 text-sm focus:ring-2 focus:ring-primary"
                    placeholder="Buscar por marca, modelo, body_type, plazas... (ej: furgoneta, 9, industrial)"
                    value={debugSearch}
                    onChange={(e) => { setDebugSearch(e.target.value); setDebugSelected(null); }}
                  />
                  {(() => {
                    const q = debugSearch.toLowerCase().trim();
                    const filtered = q
                      ? debugData.sample.filter(v => JSON.stringify(v).toLowerCase().includes(q))
                      : debugData.sample;
                    return (
                      <>
                        <p className="text-xs text-slate-400">{filtered.length} resultados</p>
                        <div className="max-h-64 overflow-y-auto space-y-1 rounded-lg border border-slate-200 dark:border-slate-700">
                          {filtered.map((v, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setDebugSelected(debugSelected === v ? null : v)}
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0 ${debugSelected === v ? "bg-primary/5" : ""}`}
                            >
                              <span className="font-medium">{String(v.brand)} {String(v.model)}</span>
                              <span className="text-slate-400 ml-2 text-xs">body: <strong>{String(v.body_type || "—")}</strong> · seats: <strong>{String(v.seats ?? "—")}</strong> · tipo: <strong>{String((v as Record<string,unknown>).tipo ?? "—")}</strong></span>
                            </button>
                          ))}
                          {filtered.length === 0 && (
                            <p className="text-xs text-slate-400 p-4">Sin resultados</p>
                          )}
                        </div>
                        {debugSelected && (
                          <pre className="bg-slate-900 text-green-300 text-xs rounded-lg p-4 overflow-auto max-h-80 font-mono whitespace-pre-wrap">
                            {JSON.stringify(debugSelected, null, 2)}
                          </pre>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* APIs Externas */}
          <div className="bg-white dark:bg-card-dark rounded-lg p-6 border border-slate-100 dark:border-slate-800/50">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold">APIs Externas</h3>
                <p className="text-xs text-slate-500 mt-0.5">Conecta servicios externos que el chatbot pueda consultar (tracking de pedidos, disponibilidad, etc.)</p>
              </div>
              <button
                type="button"
                onClick={() => setExternalApis([...externalApis, { name: "", description: "", query_description: "", url: "", method: "GET", headers: "{}", enabled: true }])}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:opacity-90"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Añadir API
              </button>
            </div>

            {externalApis.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No hay APIs externas configuradas</p>
            ) : (
              <div className="space-y-4">
                {externalApis.map((apiDef, idx) => (
                  <div key={idx} className={`p-4 rounded-xl border ${apiDef.enabled ? "border-primary/20 bg-primary/5" : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => { const copy = [...externalApis]; copy[idx].enabled = !copy[idx].enabled; setExternalApis(copy); }}
                          className={`relative w-9 h-5 rounded-full transition-colors ${apiDef.enabled ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"}`}>
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${apiDef.enabled ? "translate-x-4" : ""}`} />
                        </button>
                        <span className="text-xs font-semibold text-slate-500">{apiDef.enabled ? "Activa" : "Inactiva"}</span>
                      </div>
                      <button type="button" onClick={() => setExternalApis(externalApis.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-500 transition-colors">
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Nombre interno (sin espacios)</label>
                        <input type="text" value={apiDef.name} onChange={e => { const copy = [...externalApis]; copy[idx].name = e.target.value.replace(/[^a-z0-9_]/gi, "_").toLowerCase(); setExternalApis(copy); }}
                          placeholder="track_order" className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Método</label>
                        <select value={apiDef.method} onChange={e => { const copy = [...externalApis]; copy[idx].method = e.target.value; setExternalApis(copy); }}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none">
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Descripción (lo que el bot entiende que hace)</label>
                        <input type="text" value={apiDef.description} onChange={e => { const copy = [...externalApis]; copy[idx].description = e.target.value; setExternalApis(copy); }}
                          placeholder="Consulta el estado de un pedido por su número de seguimiento" className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Qué dato pide al cliente</label>
                        <input type="text" value={apiDef.query_description} onChange={e => { const copy = [...externalApis]; copy[idx].query_description = e.target.value; setExternalApis(copy); }}
                          placeholder="Número de pedido o referencia de envío" className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-500 mb-1">URL del endpoint (usa {"{query}"} como placeholder)</label>
                        <input type="text" value={apiDef.url} onChange={e => { const copy = [...externalApis]; copy[idx].url = e.target.value; setExternalApis(copy); }}
                          placeholder="https://api.transporte.com/tracking/{'{query}'}" className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Headers (JSON)</label>
                        <input type="text" value={typeof apiDef.headers === "string" ? apiDef.headers : JSON.stringify(apiDef.headers)} onChange={e => { const copy = [...externalApis]; copy[idx].headers = e.target.value; setExternalApis(copy); }}
                          placeholder='{"Authorization": "Bearer xxx"}' className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono focus:outline-none focus:border-blue-500" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={handleSave} disabled={saving} className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
              <span className="material-symbols-outlined text-sm">save</span>
              {saving ? "Guardando..." : "Guardar APIs"}
            </button>
          </div>

        </div>
      )}

      {activeTab === "leads" && (
        <div className="space-y-6">
          {/* Webhook / CRM directo */}
          <div className="bg-white dark:bg-card-dark rounded-lg p-6 border border-slate-100 dark:border-slate-800/50 space-y-5">
            <div>
              <h3 className="text-lg font-bold mb-1">Integración CRM</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cuando se capture un lead, se enviará automáticamente un POST JSON a esta URL. Funciona con cualquier CRM, Zapier, Make, n8n o webhook propio.
              </p>
            </div>

            {/* URL */}
            <Field
              label="URL del endpoint"
              value={webhookUrl}
              onChange={setWebhookUrl}
              hint='Ej: https://crm.tuempresa.com/api/leads  ·  https://hooks.zapier.com/hooks/catch/...'
            />

            {/* Cabeceras HTTP */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Cabeceras HTTP personalizadas
              </label>
              <p className="text-xs text-slate-400 mb-1.5">Para autenticación: Authorization, X-API-Key, etc.</p>
              <textarea
                value={webhookHeaders}
                onChange={e => setWebhookHeaders(e.target.value)}
                rows={4}
                spellCheck={false}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary transition-colors resize-none"
                placeholder={'{\n  "Authorization": "Bearer TU_TOKEN",\n  "X-API-Key": "tu_api_key"\n}'}
              />
            </div>

            {/* Mapeo de campos */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Mapeo de campos
              </label>
              <p className="text-xs text-slate-400 mb-1.5">
                Renombra los campos al nombre que espera tu CRM. Si lo dejas vacío se envía el payload estándar.
              </p>
              <div className="mb-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg space-y-2">
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">Lead:</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs font-mono">
                    {[
                      ["name", "Nombre"],
                      ["phone", "Teléfono"],
                      ["email", "Email"],
                      ["postal_code", "Código postal"],
                      ["financing_needed", "Necesita financiación (bool)"],
                      ["notes", "Notas / mensaje"],
                      ["interest_type", "Tipo de interés"],
                      ["created_at", "Fecha y hora"],
                    ].map(([field, desc]) => (
                      <div key={field} className="flex gap-1.5 items-center py-0.5">
                        <span className="text-primary shrink-0">{field}</span>
                        <span className="text-slate-400">— {desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pt-1 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-semibold text-slate-500 mb-1">Vehículo (si se menciona en la conversación):</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs font-mono">
                    {[
                      ["vehicle_brand_model", "Marca + Modelo"],
                      ["vehicle_title", "Versión completa"],
                      ["vehicle_price", "Precio (número)"],
                      ["vehicle_plate", "Matrícula"],
                      ["vehicle_url", "URL del anuncio"],
                      ["vehicle_brand", "Marca"],
                      ["vehicle_model", "Modelo"],
                      ["vehicle_year", "Año"],
                      ["vehicle_km", "Kilómetros"],
                      ["vehicle_fuel", "Combustible"],
                    ].map(([field, desc]) => (
                      <div key={field} className="flex gap-1.5 items-center py-0.5">
                        <span className="text-amber-500 shrink-0">{field}</span>
                        <span className="text-slate-400">— {desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <textarea
                value={webhookFieldMapping}
                onChange={e => setWebhookFieldMapping(e.target.value)}
                rows={5}
                spellCheck={false}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary transition-colors resize-none"
                placeholder={'{\n  "phone": "telefono",\n  "name": "nombre",\n  "email": "email",\n  "notes": "mensaje",\n  "vehicle_brand_model": "entidad",\n  "vehicle_title": "anuncio",\n  "vehicle_price": "precio",\n  "vehicle_plate": "matricula",\n  "vehicle_url": "url"\n}'}
              />
              <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={webhookLeadString}
                  onChange={e => setWebhookLeadString(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary"
                />
                <span className="text-xs text-slate-500">
                  Envolver en <code className="text-primary">{`{"lead": "<json_string>"}`}</code> — requerido por la API de worldcars
                </span>
              </label>
            </div>

            {/* Payload de referencia */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-500 font-medium mb-1">Payload estándar (sin mapeo):</p>
              <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap">{`{ "event": "lead_captured", "tenant_id": "...",\n  "lead": { "name": "...", "phone": "...", "email": "...",\n    "vehicle_interest_id": "...", "interest_type": "...",\n    "notes": "...", "created_at": "..." } }`}</pre>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-sm">save</span>
                {saving ? "Guardando..." : "Guardar configuración"}
              </button>
              {webhookUrl && (
                <button
                  type="button"
                  onClick={handleTestWebhook}
                  disabled={testingWebhook}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-sm">{testingWebhook ? "hourglass_empty" : "send"}</span>
                  {testingWebhook ? "Enviando..." : "Enviar test"}
                </button>
              )}
            </div>
            {saveMsg && <p className={`text-xs ${saveMsg.startsWith("Error") ? "text-red-500" : "text-emerald-500"}`}>{saveMsg}</p>}
            {testWebhookMsg && <p className={`text-xs ${testWebhookMsg.startsWith("Error") ? "text-red-500" : "text-emerald-500"}`}>{testWebhookMsg}</p>}
          </div>

          {/* Notificación por email */}
          <div className="bg-white dark:bg-card-dark rounded-lg p-6 border border-slate-100 dark:border-slate-800/50 space-y-5">
            <div>
              <h3 className="text-lg font-bold mb-1">Notificación por email</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Recibe un email cada vez que el chatbot capture un lead. Puedes poner varios destinatarios separados por comas.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setNotifyEnabled(!notifyEnabled)}
                className={`relative w-11 h-6 rounded-full transition-colors ${notifyEnabled ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifyEnabled ? "translate-x-5" : ""}`} />
              </button>
              <span className="text-sm font-medium">{notifyEnabled ? "Activado" : "Desactivado"}</span>
            </div>
            {notifyEnabled && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Destinatarios</label>
                <input
                  type="text"
                  value={notifyEmails}
                  onChange={e => setNotifyEmails(e.target.value)}
                  placeholder="comercial@concesionario.com, jefe@concesionario.com"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
                <p className="text-xs text-slate-400 mt-1">Separa varios emails con comas</p>
              </div>
            )}
          </div>

          {/* Tabla de leads */}
          <div className="bg-white dark:bg-card-dark rounded-lg border border-slate-100 dark:border-slate-800/50">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Leads capturados</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{leads.length} leads en total</p>
                </div>
                <div className="flex gap-2">
                <button
                  type="button"
                  onClick={loadLeads}
                  disabled={leadsLoading}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-sm font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">{leadsLoading ? "hourglass_empty" : "refresh"}</span>
                  Actualizar
                </button>
                {leads.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const headers = ["Nombre", "Teléfono", "Email", "CP", "Financiación", "Interés", "Vehículo ID", "Notas", "Estado", "Fecha"];
                      const rows = leads.map(l => [
                        l.name, l.phone || "", l.email || "", l.postal_code || "",
                        l.financing_needed === true ? "Sí" : l.financing_needed === false ? "No" : "",
                        l.interest_type || "", l.vehicle_interest_id || "", l.notes || "", l.status,
                        new Date(l.created_at).toLocaleString("es-ES"),
                      ]);
                      const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
                      const blob = new Blob([csv], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a"); a.href = url; a.download = `leads-${id}.csv`; a.click();
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">download</span>
                    Exportar CSV
                  </button>
                )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: "16px" }}>search</span>
                  <input
                    type="text"
                    value={leadsSearch}
                    onChange={e => { setLeadsSearch(e.target.value); setLeadsPage(1); }}
                    placeholder="Buscar por nombre, teléfono, email..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <select
                  value={leadsPerPage}
                  onChange={e => { setLeadsPerPage(Number(e.target.value)); setLeadsPage(1); }}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none"
                >
                  <option value={10}>10 / pág</option>
                  <option value={20}>20 / pág</option>
                  <option value={50}>50 / pág</option>
                </select>
              </div>
            </div>

            {leadsLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : leads.length === 0 ? (
              <div className="text-center py-16">
                <span className="material-symbols-outlined text-4xl text-slate-300 block mb-2">person_add</span>
                <p className="text-slate-500 text-sm">Aún no hay leads capturados</p>
              </div>
            ) : (
              <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      {["Nombre", "Teléfono", "CP", "Financiación", "Estado", "Fecha"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(() => {
                      const filtered = leads.filter(l => {
                        if (!leadsSearch) return true;
                        const q = leadsSearch.toLowerCase();
                        return (l.name || "").toLowerCase().includes(q) ||
                          (l.phone || "").toLowerCase().includes(q) ||
                          (l.email || "").toLowerCase().includes(q) ||
                          (l.postal_code || "").toLowerCase().includes(q) ||
                          (l.notes || "").toLowerCase().includes(q);
                      });
                      const totalPages = Math.ceil(filtered.length / leadsPerPage);
                      const paginated = filtered.slice((leadsPage - 1) * leadsPerPage, leadsPage * leadsPerPage);
                      return paginated.map((lead) => (
                      <tr
                        key={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3 font-medium">{lead.name}</td>
                        <td className="px-4 py-3 text-slate-500">{lead.phone || "—"}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{lead.postal_code || "—"}</td>
                        <td className="px-4 py-3">
                          {lead.financing_needed === true ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600">
                              <span className="material-symbols-outlined text-xs">check</span>Sí
                            </span>
                          ) : lead.financing_needed === false ? (
                            <span className="text-slate-400 text-xs">No</span>
                          ) : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            lead.status === "new" ? "bg-primary/10 text-primary" :
                            lead.status === "contacted" ? "bg-amber-500/10 text-amber-500" :
                            "bg-emerald-500/10 text-emerald-500"
                          }`}>
                            {lead.status === "new" ? "Nuevo" : lead.status === "contacted" ? "Contactado" : lead.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span>{new Date(lead.created_at).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                            {crmSendMsg[lead.id] ? (
                              <span className={`text-xs font-medium ${crmSendMsg[lead.id].startsWith("✓") ? "text-emerald-500" : "text-red-500"}`}>
                                {crmSendMsg[lead.id]}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => handleSendToCrm(lead.id, e)}
                                disabled={sendingCrm === lead.id}
                                title="Enviar al CRM"
                                className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium rounded transition-colors disabled:opacity-50"
                              >
                                <span className="material-symbols-outlined text-xs">{sendingCrm === lead.id ? "hourglass_empty" : "send"}</span>
                                CRM
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ));
                    })()}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {(() => {
                const filtered = leads.filter(l => {
                  if (!leadsSearch) return true;
                  const q = leadsSearch.toLowerCase();
                  return (l.name || "").toLowerCase().includes(q) ||
                    (l.phone || "").toLowerCase().includes(q) ||
                    (l.email || "").toLowerCase().includes(q) ||
                    (l.postal_code || "").toLowerCase().includes(q) ||
                    (l.notes || "").toLowerCase().includes(q);
                });
                const totalPages = Math.ceil(filtered.length / leadsPerPage);
                if (totalPages <= 1) return null;
                return (
                  <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-500">
                      {Math.min((leadsPage - 1) * leadsPerPage + 1, filtered.length)}–{Math.min(leadsPage * leadsPerPage, filtered.length)} de {filtered.length}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setLeadsPage(p => Math.max(1, p - 1))}
                        disabled={leadsPage === 1}
                        className="px-2 py-1 text-xs font-medium rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">chevron_left</span>
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - leadsPage) <= 1)
                        .map((p, i, arr) => (
                          <span key={p}>
                            {i > 0 && arr[i - 1] !== p - 1 && <span className="text-xs text-slate-400 px-1">...</span>}
                            <button
                              onClick={() => setLeadsPage(p)}
                              className={`w-7 h-7 text-xs font-medium rounded transition-colors ${
                                p === leadsPage ? "bg-primary text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                              }`}
                            >{p}</button>
                          </span>
                        ))}
                      <button
                        onClick={() => setLeadsPage(p => Math.min(totalPages, p + 1))}
                        disabled={leadsPage === totalPages}
                        className="px-2 py-1 text-xs font-medium rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">chevron_right</span>
                      </button>
                    </div>
                  </div>
                );
              })()}
              </>
            )}
          </div>
        </div>
      )}

      {/* Panel lateral — Ficha de lead */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex">
          {/* Overlay */}
          <div className="flex-1 bg-black/40" onClick={() => setSelectedLead(null)} />
          {/* Panel */}
          <div className="w-full max-w-md bg-white dark:bg-bg-dark border-l border-slate-200 dark:border-slate-800 flex flex-col h-full overflow-y-auto animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-bg-dark z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">person</span>
                </div>
                <div>
                  <h2 className="font-bold text-lg leading-tight">{selectedLead.name}</h2>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    selectedLead.status === "new" ? "bg-primary/10 text-primary" :
                    selectedLead.status === "contacted" ? "bg-amber-500/10 text-amber-500" :
                    "bg-emerald-500/10 text-emerald-500"
                  }`}>
                    {selectedLead.status === "new" ? "Nuevo" : selectedLead.status === "contacted" ? "Contactado" : selectedLead.status}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6 space-y-6">
              {/* Contacto */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Datos de contacto</h3>
                <div className="space-y-3">
                  {selectedLead.phone && (
                    <a href={`tel:${selectedLead.phone}`} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group">
                      <span className="material-symbols-outlined text-primary">phone</span>
                      <div>
                        <p className="text-xs text-slate-400">Teléfono</p>
                        <p className="font-medium group-hover:text-primary transition-colors">{selectedLead.phone}</p>
                      </div>
                    </a>
                  )}
                  {selectedLead.email && (
                    <a href={`mailto:${selectedLead.email}`} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group">
                      <span className="material-symbols-outlined text-primary">mail</span>
                      <div>
                        <p className="text-xs text-slate-400">Email</p>
                        <p className="font-medium group-hover:text-primary transition-colors">{selectedLead.email}</p>
                      </div>
                    </a>
                  )}
                  {selectedLead.postal_code && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <span className="material-symbols-outlined text-primary">location_on</span>
                      <div>
                        <p className="text-xs text-slate-400">Código postal</p>
                        <p className="font-medium">{selectedLead.postal_code}</p>
                      </div>
                    </div>
                  )}
                  {!selectedLead.phone && !selectedLead.email && (
                    <p className="text-sm text-slate-400 italic">Sin datos de contacto</p>
                  )}
                </div>
              </div>

              {/* Financiación */}
              {selectedLead.financing_needed !== undefined && selectedLead.financing_needed !== null && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Financiación</h3>
                  <div className={`flex items-center gap-3 p-3 rounded-lg ${selectedLead.financing_needed ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-slate-50 dark:bg-slate-800/50"}`}>
                    <span className={`material-symbols-outlined ${selectedLead.financing_needed ? "text-emerald-500" : "text-slate-400"}`}>
                      {selectedLead.financing_needed ? "check_circle" : "cancel"}
                    </span>
                    <div>
                      <p className="text-xs text-slate-400">¿Necesita financiación?</p>
                      <p className={`font-semibold ${selectedLead.financing_needed ? "text-emerald-600" : "text-slate-500"}`}>
                        {selectedLead.financing_needed ? "Sí, interesado en financiar" : "No necesita financiación"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Interés */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Interés comercial</h3>
                <div className="space-y-2">
                  {selectedLead.interest_type && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <span className="material-symbols-outlined text-slate-400">label</span>
                      <div>
                        <p className="text-xs text-slate-400">Tipo de interés</p>
                        <p className="font-medium capitalize">{selectedLead.interest_type}</p>
                      </div>
                    </div>
                  )}
                  {selectedLead.vehicle_interest_id && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <span className="material-symbols-outlined text-slate-400">directions_car</span>
                      <div>
                        <p className="text-xs text-slate-400">Vehículo de interés</p>
                        <p className="font-medium">{vehicleInfo ? (vehicleInfo.plate ? `${vehicleInfo.title} — ${vehicleInfo.plate}` : vehicleInfo.title) : selectedLead.vehicle_interest_id}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Notas */}
              {selectedLead.notes && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Notas de la conversación</h3>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border-l-2 border-primary">
                    <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{selectedLead.notes}</p>
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Información del lead</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400">ID</span>
                    <span className="font-mono text-xs">{selectedLead.id}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">Capturado el</span>
                    <span>{new Date(selectedLead.created_at).toLocaleString("es-ES", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
              </div>

              {/* Acciones rápidas */}
              <div className="flex gap-2 pt-2">
                {selectedLead.phone && (
                  <a
                    href={`https://wa.me/${selectedLead.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">chat</span>
                    WhatsApp
                  </a>
                )}
                {selectedLead.email && (
                  <a
                    href={`mailto:${selectedLead.email}`}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary hover:opacity-90 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">mail</span>
                    Email
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "knowledge" && (
        <KnowledgeTab tenantId={id as string} />
      )}
    </>
  );
}

function KnowledgeTab({ tenantId }: { tenantId: string }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");

  const loadDocs = async () => {
    try {
      const data = await api.getKnowledgeDocs(tenantId);
      setDocs(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadDocs(); }, [tenantId]);

  useEffect(() => {
    if (!docs.some((d: any) => d.status === "processing")) return;
    const t = setInterval(loadDocs, 3000);
    return () => clearInterval(t);
  }, [docs]);

  const handleUpload = async (file: File) => {
    setUploading(true); setError("");
    try {
      await api.uploadKnowledgeDoc(tenantId, file);
      await loadDocs();
    } catch (e: any) { setError(e.message || "Error al subir"); }
    setUploading(false);
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Eliminar este documento y todos sus chunks?")) return;
    try {
      await api.deleteKnowledgeDoc(tenantId, docId);
      setDocs(prev => prev.filter((d: any) => d.id !== docId));
    } catch (e: any) { setError(e.message || "Error al eliminar"); }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = "";
  };

  const statusBadge = (status: string) => {
    if (status === "ready") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Listo</span>;
    if (status === "processing") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />Procesando</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Error</span>;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-card-dark rounded-lg border border-slate-100 dark:border-slate-800/50 p-6">
        <h3 className="text-lg font-bold mb-1">Base de Conocimiento</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Sube documentos (PDF, DOCX, TXT) para que el chatbot responda preguntas basandose en su contenido.
        </p>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600">{error}</div>
        )}

        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            dragOver ? "border-primary bg-primary/5" : "border-slate-200 dark:border-slate-700 hover:border-primary/50"
          }`}
          onClick={() => document.getElementById("kb-file-input")?.click()}
        >
          <input id="kb-file-input" type="file" accept=".pdf,.docx,.txt,.md,.csv" className="hidden" onChange={onFileSelect} />
          <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2 block">
            {uploading ? "hourglass_top" : "cloud_upload"}
          </span>
          {uploading ? (
            <p className="text-sm text-slate-500">Subiendo documento...</p>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Arrastra un archivo aqui o haz clic para seleccionar</p>
              <p className="text-xs text-slate-400 mt-1">PDF, DOCX, TXT — Maximo 10 MB</p>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : docs.length > 0 ? (
        <div className="bg-white dark:bg-card-dark rounded-lg border border-slate-100 dark:border-slate-800/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
            <h3 className="font-bold text-sm">{docs.length} documento{docs.length !== 1 ? "s" : ""}</h3>
            <span className="text-xs text-slate-400">{docs.filter((d: any) => d.status === "ready").reduce((a: number, d: any) => a + (d.chunk_count || 0), 0)} chunks totales</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {docs.map((d: any) => (
              <div key={d.id} className="px-6 py-4 flex items-center gap-4">
                <span className="material-symbols-outlined text-xl text-slate-400">
                  {d.mime_type?.includes("pdf") ? "picture_as_pdf" : d.mime_type?.includes("word") ? "description" : "article"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.original_filename}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-slate-400">{formatSize(d.file_size)}</span>
                    {d.status === "ready" && <span className="text-xs text-slate-400">{d.chunk_count} chunks</span>}
                    {d.error_message && <span className="text-xs text-red-500 truncate max-w-[200px]" title={d.error_message}>{d.error_message}</span>}
                  </div>
                </div>
                {statusBadge(d.status)}
                <button onClick={() => handleDelete(d.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-slate-400 hover:text-red-500">
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-slate-400">
          <span className="material-symbols-outlined text-4xl mb-2 block">menu_book</span>
          <p className="text-sm">No hay documentos subidos</p>
          <p className="text-xs mt-1">Sube un PDF, DOCX o TXT para empezar</p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", hint }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">{label}</label>
      <input
        className="w-full bg-slate-100 dark:bg-slate-800/50 border-none rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-primary"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
      />
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}
