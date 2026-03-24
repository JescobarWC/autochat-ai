const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/v1";

async function request(path: string, options: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    throw new Error("No autorizado");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Error ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request("/admin/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  // Tenants
  getTenants: () => request("/admin/tenants"),
  getTenant: (id: string) => request(`/admin/tenants/${id}`),
  createTenant: (data: Record<string, unknown>) =>
    request("/admin/tenants", { method: "POST", body: JSON.stringify(data) }),
  updateTenant: (id: string, data: Record<string, unknown>) =>
    request(`/admin/tenants/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTenant: (id: string) =>
    request(`/admin/tenants/${id}`, { method: "DELETE" }),

  // Conversations
  getConversations: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/admin/conversations${qs}`);
  },

  // Leads
  getLeads: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/admin/leads${qs}`);
  },

  // Analytics
  getAnalytics: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/admin/analytics/overview${qs}`);
  },

  // Conversation messages
  getConversationMessages: (convId: string) =>
    request(`/admin/conversations/${convId}/messages`),

  // Webhook test
  testWebhook: (tenantId: string) =>
    request(`/admin/tenants/${tenantId}/test-webhook`, { method: "POST", body: "{}" }),

  // Inventory cache
  flushInventoryCache: (tenantId: string) =>
    request(`/admin/tenants/${tenantId}/flush-inventory`, { method: "POST", body: "{}" }),

  // Inventory debug
  debugInventory: (tenantId: string, limit = 500) =>
    request(`/admin/tenants/${tenantId}/inventory-debug?limit=${limit}`),

  // Send lead to CRM manually
  sendLeadToCrm: (leadId: string) =>
    request(`/admin/leads/${leadId}/send-to-crm`, { method: "POST", body: "{}" }),
};
