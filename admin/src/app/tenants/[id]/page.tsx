"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";

type Tab = "general" | "prompt" | "widget" | "inventory" | "leads";

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
  const [activeTab, setActiveTab] = useState<Tab>("general");
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
  const [customSystemPrompt, setCustomSystemPrompt] = useState("");
  const [personality, setPersonality] = useState("");
  const [warranty, setWarranty] = useState("");
  const [delivery, setDelivery] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1E40AF");
  const [accentColor, setAccentColor] = useState("#10B981");
  const [position, setPosition] = useState("bottom-right");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [showPoweredBy, setShowPoweredBy] = useState(true);

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

  // Leads
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadData | null>(null);
  const [sendingCrm, setSendingCrm] = useState<string | null>(null);
  const [crmSendMsg, setCrmSendMsg] = useState<Record<string, string>>({});

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
        setBotName((cfg.bot_name as string) || "Asistente");
        setCustomSystemPrompt((cfg.custom_system_prompt as string) || "");
        setPersonality((cfg.personality as string) || "");
        setWarranty((cfg.warranty_policy as string) || "");
        setDelivery((cfg.delivery_info as string) || "");
        setPrimaryColor((theme.primary_color as string) || "#1E40AF");
        setAccentColor((theme.accent_color as string) || "#10B981");
        setPosition((theme.position as string) || "bottom-right");
        setWelcomeMessage((theme.welcome_message as string) || "");
        setShowPoweredBy(theme.show_powered_by !== false);

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
      webhook_url: webhookUrl || undefined,
      webhook_headers: (() => { try { const h = JSON.parse(webhookHeaders); return Object.keys(h).length ? h : undefined; } catch { return undefined; } })(),
      webhook_field_mapping: (() => { try { const m = JSON.parse(webhookFieldMapping); return Object.keys(m).length ? m : undefined; } catch { return undefined; } })(),
      webhook_lead_string: webhookLeadString || undefined,
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

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "general", label: "General", icon: "settings" },
    { key: "prompt", label: "Prompt Editor", icon: "terminal" },
    { key: "widget", label: "Widget Settings", icon: "widgets" },
    { key: "inventory", label: "Inventario", icon: "directions_car" },
    { key: "leads", label: "Leads", icon: "person_add" },
  ];

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
            onClick={() => { setActiveTab(tab.key); if (tab.key === "leads") loadLeads(); }}
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
            </div>
          </div>

          <div className="bg-white dark:bg-card-dark rounded-lg p-6 border border-slate-100 dark:border-slate-800/50">
            <h3 className="text-lg font-bold mb-6">Codigo de instalacion</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Copia y pega este snippet en el HTML de la web del concesionario, antes del cierre de &lt;/body&gt;</p>
            <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm text-green-400 overflow-x-auto">
              <pre>{`<script\n  src="https://cdn.autochat.ai/widget.min.js"\n  data-tenant="${tenant.id}"\n  data-api="https://api.autochat.ai/v1"\n></script>`}</pre>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`<script src="https://cdn.autochat.ai/widget.min.js" data-tenant="${tenant.id}" data-api="https://api.autochat.ai/v1"></script>`);
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

                <Field
                  label="URL del Feed XML"
                  value={feedUrl}
                  onChange={setFeedUrl}
                  hint="Ej: https://feeds.inventario.pro/feed/get/MiConcesionario/TOKEN"
                />

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

          {/* Tabla de leads */}
          <div className="bg-white dark:bg-card-dark rounded-lg border border-slate-100 dark:border-slate-800/50">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
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
                    {leads.map((lead) => (
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
                    ))}
                  </tbody>
                </table>
              </div>
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
                        <p className="text-xs text-slate-400">Vehículo de interés (ID)</p>
                        <p className="font-medium font-mono">{selectedLead.vehicle_interest_id}</p>
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
    </>
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
