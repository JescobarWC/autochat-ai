"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface AdminUserData {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  tenant_id: string | null;
  created_at: string | null;
}

interface TenantOption {
  id: string;
  name: string;
}

export default function SettingsPage() {
  const [user, setUser] = useState<{ full_name?: string; email?: string; role?: string; tenant_id?: string | null } | null>(null);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [saving, setSaving] = useState(false);

  // Users management
  const [users, setUsers] = useState<AdminUserData[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("admin");
  const [newTenantId, setNewTenantId] = useState("");
  const [createMsg, setCreateMsg] = useState("");
  const [creating, setCreating] = useState(false);
  const [resetPwUser, setResetPwUser] = useState<string | null>(null);
  const [resetPwValue, setResetPwValue] = useState("");
  const [resetPwMsg, setResetPwMsg] = useState("");

  const isSuperadmin = user?.role === "superadmin";

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) setUser(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    if (!isSuperadmin) return;
    loadUsers();
    api.getTenants().then(setTenants).catch(() => {});
  }, [isSuperadmin]);

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch {}
    setUsersLoading(false);
  }

  async function handleChangePassword() {
    setPwMsg("");
    if (!currentPw || !newPw) { setPwMsg("Rellena todos los campos"); return; }
    if (newPw.length < 8) { setPwMsg("La nueva contraseña debe tener al menos 8 caracteres"); return; }
    if (newPw !== confirmPw) { setPwMsg("Las contraseñas no coinciden"); return; }

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("https://chat.eaistudio.es/api/v1/admin/settings/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Error al cambiar contraseña");
      }
      setPwMsg("Contraseña actualizada correctamente");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: unknown) {
      setPwMsg(err instanceof Error ? err.message : "Error de conexión");
    }
    setSaving(false);
  }

  async function handleCreateUser() {
    setCreateMsg("");
    if (!newEmail || !newName || !newPassword) { setCreateMsg("Rellena todos los campos obligatorios"); return; }
    if (newPassword.length < 8) { setCreateMsg("La contraseña debe tener al menos 8 caracteres"); return; }
    if ((newRole === "admin" || newRole === "user") && !newTenantId) { setCreateMsg("Selecciona un cliente para este usuario"); return; }

    setCreating(true);
    try {
      await api.createUser({
        email: newEmail,
        full_name: newName,
        password: newPassword,
        role: newRole,
        tenant_id: newRole !== "superadmin" ? newTenantId : null,
      });
      setCreateMsg("Usuario creado correctamente");
      setNewEmail(""); setNewName(""); setNewPassword(""); setNewRole("admin"); setNewTenantId("");
      setShowCreateForm(false);
      loadUsers();
    } catch (err: unknown) {
      setCreateMsg(err instanceof Error ? err.message : "Error al crear usuario");
    }
    setCreating(false);
  }

  async function handleResetPassword(userId: string) {
    setResetPwMsg("");
    if (resetPwValue.length < 8) { setResetPwMsg("Mínimo 8 caracteres"); return; }
    try {
      await api.resetUserPassword(userId, resetPwValue);
      setResetPwMsg("Contraseña actualizada");
      setResetPwValue("");
      setTimeout(() => { setResetPwUser(null); setResetPwMsg(""); }, 2000);
    } catch (err: unknown) {
      setResetPwMsg(err instanceof Error ? err.message : "Error");
    }
  }

  async function toggleUserActive(u: AdminUserData) {
    try {
      await api.updateUser(u.id, { is_active: !u.is_active });
      loadUsers();
    } catch {}
  }

  async function handleDeleteUser(u: AdminUserData) {
    if (!confirm(`¿Eliminar a ${u.full_name}?`)) return;
    try {
      await api.deleteUser(u.id);
      loadUsers();
    } catch {}
  }

  const tenantMap = Object.fromEntries(tenants.map(t => [t.id, t.name]));

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Ajustes</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Configuración de la cuenta y gestión de usuarios</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Perfil */}
        <div className="bg-white dark:bg-card-dark rounded-lg p-6 border border-slate-100 dark:border-slate-800/50">
          <h3 className="text-lg font-bold mb-6">Perfil</h3>
          <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-primary border-2 border-primary/30">
              <span className="material-symbols-outlined text-2xl">person</span>
            </div>
            <div>
              <p className="font-bold">{user?.full_name || "Admin"}</p>
              <p className="text-sm text-slate-500">{user?.email || ""}</p>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium mt-1 inline-block">{user?.role || "admin"}</span>
            </div>
          </div>
        </div>

        {/* Cambiar contraseña */}
        <div className="bg-white dark:bg-card-dark rounded-lg p-6 border border-slate-100 dark:border-slate-800/50">
          <h3 className="text-lg font-bold mb-6">Cambiar contraseña</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Contraseña actual</label>
              <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nueva contraseña</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Confirmar nueva contraseña</label>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <button onClick={handleChangePassword} disabled={saving} className="w-full py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? "Guardando..." : "Cambiar contraseña"}
            </button>
            {pwMsg && <p className={`text-sm text-center ${pwMsg.includes("correctamente") ? "text-emerald-500" : "text-red-500"}`}>{pwMsg}</p>}
          </div>
        </div>

        {/* Gestión de usuarios - solo superadmin */}
        {isSuperadmin && (
          <div className="bg-white dark:bg-card-dark rounded-lg p-6 border border-slate-100 dark:border-slate-800/50 lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold">Usuarios</h3>
                <p className="text-xs text-slate-500 mt-0.5">{users.length} usuarios registrados</p>
              </div>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined text-sm">{showCreateForm ? "close" : "person_add"}</span>
                {showCreateForm ? "Cancelar" : "Nuevo usuario"}
              </button>
            </div>

            {/* Create form */}
            {showCreateForm && (
              <div className="mb-6 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre completo *</label>
                    <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Juan García" className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email *</label>
                    <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="juan@empresa.com" className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Contraseña *</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Rol *</label>
                    <select value={newRole} onChange={e => { setNewRole(e.target.value); if (e.target.value === "superadmin") setNewTenantId(""); }} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500">
                      <option value="user">Usuario (solo lectura)</option>
                      <option value="admin">Admin de cliente</option>
                      <option value="superadmin">Superadmin (acceso total)</option>
                    </select>
                  </div>
                </div>
                {(newRole === "admin" || newRole === "user") && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Asignar a cliente *</label>
                    <select value={newTenantId} onChange={e => setNewTenantId(e.target.value)} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500">
                      <option value="">Selecciona un cliente...</option>
                      {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <p className="text-xs text-slate-400 mt-1">Este usuario solo podrá ver datos de este cliente</p>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <button onClick={handleCreateUser} disabled={creating} className="px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50">
                    {creating ? "Creando..." : "Crear usuario"}
                  </button>
                  {createMsg && <p className={`text-sm ${createMsg.includes("correctamente") ? "text-emerald-500" : "text-red-500"}`}>{createMsg}</p>}
                </div>
              </div>
            )}

            {/* Users table */}
            {usersLoading ? (
              <div className="flex items-center justify-center h-20">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      {["Nombre", "Email", "Rol", "Cliente", "Estado", ""].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-medium">{u.full_name}</td>
                        <td className="px-4 py-3 text-slate-500">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            u.role === "superadmin" ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300" :
                            u.role === "admin" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" :
                            "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          }`}>
                            {u.role === "superadmin" ? "Superadmin" : u.role === "admin" ? "Admin cliente" : "Usuario"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {u.tenant_id ? (tenantMap[u.tenant_id] || u.tenant_id.slice(0, 8)) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => toggleUserActive(u)} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                            u.is_active ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                          }`}>
                            {u.is_active ? "Activo" : "Inactivo"}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {resetPwUser === u.id ? (
                              <div className="flex items-center gap-1">
                                <input type="password" value={resetPwValue} onChange={e => setResetPwValue(e.target.value)} placeholder="Nueva contraseña" className="w-32 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs focus:outline-none focus:border-blue-500" />
                                <button onClick={() => handleResetPassword(u.id)} className="text-emerald-500 hover:text-emerald-600" title="Confirmar"><span className="material-symbols-outlined text-sm">check</span></button>
                                <button onClick={() => { setResetPwUser(null); setResetPwValue(""); setResetPwMsg(""); }} className="text-slate-400 hover:text-slate-600" title="Cancelar"><span className="material-symbols-outlined text-sm">close</span></button>
                                {resetPwMsg && <span className={`text-[10px] ${resetPwMsg.includes("actualizada") ? "text-emerald-500" : "text-red-500"}`}>{resetPwMsg}</span>}
                              </div>
                            ) : (
                              <>
                                <button onClick={() => { setResetPwUser(u.id); setResetPwValue(""); setResetPwMsg(""); }} className="text-slate-400 hover:text-primary transition-colors" title="Cambiar contraseña">
                                  <span className="material-symbols-outlined text-sm">key</span>
                                </button>
                                <button onClick={() => handleDeleteUser(u)} className="text-slate-400 hover:text-red-500 transition-colors" title="Eliminar">
                                  <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                              </>
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
        )}

        {/* Info del sistema */}
        <div className="bg-white dark:bg-card-dark rounded-lg p-6 border border-slate-100 dark:border-slate-800/50 lg:col-span-2">
          <h3 className="text-lg font-bold mb-6">Sistema</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <p className="text-xs text-slate-500 mb-1">Plataforma</p>
              <p className="font-bold text-sm">AutoChat AI</p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <p className="text-xs text-slate-500 mb-1">Versión</p>
              <p className="font-bold text-sm">1.0.0</p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <p className="text-xs text-slate-500 mb-1">API</p>
              <p className="font-bold text-sm">chat.eaistudio.es</p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <p className="text-xs text-slate-500 mb-1">Modelo IA</p>
              <p className="font-bold text-sm">GPT-4.1 Mini (default)</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
