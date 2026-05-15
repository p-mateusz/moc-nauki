import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useRoles, type Role } from "@/hooks/use-roles";

// Helper to call admin-manage-users edge function
const adminUpdateUser = async (id: string, updates: Record<string, any>) => {
  const res = await supabase.functions.invoke("admin-manage-users", {
    body: { action: "update", id, updates },
  });
  if (res.error) throw new Error(res.error.message);
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
};

interface UserAccount {
    id: string;
    name: string;
    username: string;
    email: string;
    role: string;
    password_hash: string;
    created_at: string;
    fee_exempt: boolean;
  subscription_status: string;
  subscription_end_date: string | null;
  // Stripe / subscription fields (may be null)
  stripe_subscription_id?: string | null;
  subscription_plan?: string | null;
  cancel_at_period_end?: boolean;
    payment_method: string | null;
    payment_date: string | null;
     webhook_count_today?: number;
     webhook_suspended_at?: string | null;
     webhook_suspended_reason?: string | null;
  }

  type AdminTab = "dashboard" | "users" | "stats" | "roles" | "settings";

  const RESERVED_ADMIN_USERNAME = "wieża";

  const AdminUsersTab = () => {
    const [users, setUsers] = useState<UserAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [adminTab, setAdminTab] = useState<AdminTab>("dashboard");
    const [search, setSearch] = useState("");
    const [editModal, setEditModal] = useState<UserAccount | null>(null);
    const [newModal, setNewModal] = useState(false);

    const userName = localStorage.getItem("userName") || "Admin";
    const { roles: customRoles, refetch: refetchRoles } = useRoles();
    const userId = localStorage.getItem("userId");

    const callAdminUsers = useCallback(async (body: any) => {
      const res = await supabase.functions.invoke("admin-manage-users", {
        body,
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    }, []);

    const fetchUsers = useCallback(async () => {
      setLoading(true);
      try {
        const result = await callAdminUsers({ action: "list" });
        if (Array.isArray(result)) {
          // Normalize 'teacher' role to 'nauczyciel'
          const normalized = (result as UserAccount[]).map(u => ({
            ...u,
            role: u.role === 'teacher' ? 'nauczyciel' : u.role
          }));
          setUsers(normalized);
        } else {
          console.warn("Unexpected response format:", result);
          toast.error("Zły format danych z serwera");
          setUsers([]);
        }
      } catch (e) {
        console.error("Failed to fetch users:", e);
        toast.error("Błąd ładowania użytkowników: " + ((e as any)?.message || "Nieznany błąd"));
        setUsers([]);
      }
      setLoading(false);
    }, [callAdminUsers]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCancelSubscription = useCallback(async (userId: string, immediate = false) => {
    setLoading(true);
    try {
      await callAdminUsers({ action: "cancel_subscription", id: userId, immediate });
      toast.success(immediate ? "Subskrypcja anulowana natychmiast" : "Subskrypcja oznaczona do anulowania na koniec okresu");
      await fetchUsers();
    } catch (e: any) {
      console.error("cancel subscription failed", e);
      toast.error(e?.message || "Błąd anulowania subskrypcji");
    } finally {
      setLoading(false);
    }
  }, [callAdminUsers, fetchUsers]);

  const allRoleNames = customRoles
    .filter(r => r.name !== 'admin' && r.name !== 'teacher') // Filter out 'teacher' (old role name)
    .map(r => r.name);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  const today = new Date();
  const dateStr = today.toLocaleDateString("pl", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const tabButtons: { id: AdminTab; icon: string; label: string }[] = [
    { id: "dashboard", icon: "🏠", label: "Przegląd" },
    { id: "users", icon: "👥", label: "Użytkownicy" },
    { id: "stats", icon: "📊", label: "Statystyki" },
    { id: "roles", icon: "🎭", label: "Role" },
    { id: "settings", icon: "⚙️", label: "Ustawienia" },
  ];

  const handleDelete = async (u: UserAccount) => {
    if (u.username.toLowerCase() === RESERVED_ADMIN_USERNAME) {
      toast.error("Nie ma możliwości usunięcia konta administratora");
      return;
    }
    if (!confirm(`Na pewno usunąć konto „${u.username}"? Ta operacja jest nieodwracalna.`)) return;
    try {
      await callAdminUsers({ action: "delete", id: u.id });
      toast.success(`Usunięto konto „${u.username}"`);
      fetchUsers();
    } catch (e: any) {
      toast.error(e?.message || "Błąd usuwania");
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-subtab-bar">
        {tabButtons.map(t => (
          <button
            key={t.id}
            className={`admin-subtab ${adminTab === t.id ? "active" : ""}`}
            onClick={() => setAdminTab(t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
          <button className="admin-btn admin-btn-grad admin-btn-sm" onClick={() => setNewModal(true)}>
            ➕ Nowe konto
          </button>
        </div>
      </div>

      <div className="admin-content-area">
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#8899b4" }}>Ładowanie...</div>
        ) : (
          <>
            {adminTab === "dashboard" && (
              <DashboardView users={users} userName={userName} dateStr={dateStr} onSwitchTab={setAdminTab} customRoles={customRoles} />
            )}
            {adminTab === "users" && (
              <UsersView
                users={filtered}
                allUsers={users}
                search={search}
                onSearch={setSearch}
                onEdit={setEditModal}
                onDelete={handleDelete}
                onRefresh={fetchUsers}
                onCancelSubscription={handleCancelSubscription}
                allRoleNames={allRoleNames}
                customRoles={customRoles}
              />
            )}
            {adminTab === "stats" && <StatsView users={users} customRoles={customRoles} />}
            {adminTab === "roles" && <RolesView users={users} onRefresh={() => { fetchUsers(); refetchRoles(); }} customRoles={customRoles} allRoleNames={allRoleNames} />}
            {adminTab === "settings" && <SettingsView />}
          </>
        )}
      </div>

      {editModal && (
        <EditUserModal
          user={editModal}
          onClose={() => setEditModal(null)}
          onSave={fetchUsers}
          allRoleNames={allRoleNames}
          customRoles={customRoles}
        />
      )}

      {newModal && (
        <NewUserModal
          onClose={() => setNewModal(false)}
          onSave={fetchUsers}
          allRoleNames={allRoleNames}
          customRoles={customRoles}
        />
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════
   DASHBOARD VIEW
   ═══════════════════════════════════════════════ */
const DashboardView = ({ users, userName, dateStr, onSwitchTab, customRoles }: {
  users: UserAccount[];
  userName: string;
  dateStr: string;
  onSwitchTab: (t: AdminTab) => void;
  customRoles: Role[];
}) => {
  const students = users.filter(u => u.role === "uczeń");
  const teachers = users.filter(u => u.role === "nauczyciel");
  const exempt = users.filter(u => u.fee_exempt);
  const trials = users.filter(u => !u.fee_exempt && u.subscription_status === "trial");
  const recentUsers = [...users].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

  const stats = [
    { v: users.length, l: "Kont ogółem", c: "#60a5fa" },
    { v: students.length, l: "Uczniowie", c: "#34d399" },
    { v: teachers.length, l: "Nauczyciele", c: "#fbbf24" },
    { v: exempt.length, l: "Zwolnieni z opłat", c: "#a78bfa" },
    { v: trials.length, l: "Okres próbny", c: "#f472b6" },
  ];

  return (
    <>
      <div className="ph">
        <div>
          <div className="ph-title">🏠 Dzień dobry, {userName}!</div>
          <div className="ph-sub">{dateStr}</div>
        </div>
      </div>

      <div className="admin-stat-grid">
        {stats.map(s => (
          <div className="admin-stat" key={s.l}>
            <div className="admin-stat-val" style={{ color: s.c }}>{s.v}</div>
            <div className="admin-stat-lbl">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="admin-dash-grid">
        <div>
          <div className="admin-section-title">⚡ Szybkie akcje</div>
          <div className="admin-card">
            <button className="admin-btn admin-btn-grad" style={{ width: "100%", marginBottom: 8 }} onClick={() => onSwitchTab("users")}>
              👥 Zarządzaj użytkownikami
            </button>
            <button className="admin-btn admin-btn-ghost" style={{ width: "100%", marginBottom: 8 }} onClick={() => onSwitchTab("roles")}>
              🎭 Zarządzaj rolami
            </button>
            <button className="admin-btn admin-btn-ghost" style={{ width: "100%", marginBottom: 8 }} onClick={() => onSwitchTab("stats")}>
              📊 Statystyki platformy
            </button>
          </div>
        </div>
        <div>
          <div className="admin-section-title">🆕 Ostatnie rejestracje</div>
          <div className="admin-card">
            {recentUsers.map(u => (
              <div key={u.id} className="admin-recent-row">
                <div className="admin-av av-c1">{initials(u.name)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: ".82rem", fontWeight: 700, color: "#c8d8f0" }}>{u.name}</div>
                  <div style={{ fontSize: ".68rem", color: "#8899b4" }}>
                    <RoleBadge role={u.role} customRoles={customRoles} /> · @{u.username} · {new Date(u.created_at).toLocaleDateString("pl")}
                  </div>
                </div>
              </div>
            ))}
            {recentUsers.length === 0 && <div style={{ color: "#8899b4", fontSize: ".82rem" }}>Brak użytkowników</div>}
          </div>
        </div>
      </div>
    </>
  );
};

/* ═══════════════════════════════════════════════
   USERS VIEW
   ═══════════════════════════════════════════════ */
const UsersView = ({ users, allUsers, search, onSearch, onEdit, onDelete, onRefresh, onCancelSubscription, allRoleNames, customRoles }: {
  users: UserAccount[];
  allUsers: UserAccount[];
  search: string;
  onSearch: (s: string) => void;
  onEdit: (u: UserAccount) => void;
  onDelete: (u: UserAccount) => void;
  onRefresh: () => void;
  onCancelSubscription: (id: string, immediate?: boolean) => Promise<void>;
  allRoleNames: string[];
  customRoles: Role[];
}) => {
  const myId = localStorage.getItem("userId");
  const usersByRole = allUsers.reduce((acc: Record<string, number>, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  const resetPassword = async (userId: string, newPassword: string) => {
    if (newPassword.length < 6) { toast.error("Hasło musi mieć min. 6 znaków"); return; }
    const encoder = new TextEncoder();
    const data = encoder.encode(newPassword);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    try {
      await adminUpdateUser(userId, { password_hash: hashHex });
      toast.success("Hasło zmienione");
      onRefresh();
    } catch (e: any) { toast.error(e?.message || "Błąd"); }
  };

  const toggleFeeExempt = async (user: UserAccount) => {
    const newVal = !user.fee_exempt;
    const updates: Record<string, any> = { fee_exempt: newVal };
    if (newVal) {
      updates.subscription_status = "exempt";
      updates.payment_method = null;
      updates.payment_date = null;
    } else {
      updates.subscription_status = "trial";
      updates.subscription_end_date = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    }
    try {
      await adminUpdateUser(user.id, updates);
      toast.success(newVal ? `Zwolniono „${user.username}" z opłat` : `Usunięto zwolnienie „${user.username}"`);
      onRefresh();
    } catch (e: any) { toast.error(e?.message || "Błąd"); }
  };

  const updatePaymentMethod = async (user: UserAccount, method: string) => {
    const updates: Record<string, any> = { payment_method: method };
    if (method === "odnawialna") {
      updates.payment_date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      updates.subscription_status = "active";
      updates.subscription_end_date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      updates.payment_date = null;
      updates.subscription_status = "active";
      updates.subscription_end_date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }
    try {
      await adminUpdateUser(user.id, updates);
      toast.success(`Ustawiono metodę płatności: ${method}`);
      onRefresh();
    } catch (e: any) { toast.error(e?.message || "Błąd"); }
  };

  const sendPaymentReminder = (user: UserAccount) => {
    toast.success(`📧 Przypomnienie o opłacie wysłane do ${user.name} (${user.email})`);
  };

  return (
    <>
      <div className="ph">
        <div>
          <div className="ph-title">👥 Użytkownicy</div>
          <div className="ph-sub">{allUsers.length} kont · {Object.entries(usersByRole).map(([role, count]) => `${getRoleLabel(role, customRoles)}: ${count}`).join(' · ')}</div>
        </div>
      </div>

      <div className="admin-search-bar">
        <span style={{ color: "#8899b4" }}>🔍</span>
        <input
          placeholder="Szukaj po nazwie, roli, e-mailu…"
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Użytkownik</th>
              <th>E-mail</th>
              <th>Rola</th>
              <th>Zwolnienie</th>
              <th>Status subskrypcji</th>
              <th>Metoda płatności</th>
               <th>Webhooki dziś</th>
              <th>Hasło</th>
              <th>Akcje</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <UserRow
                key={u.id}
                user={u}
                isMe={u.id === myId}
                isAdminAccount={u.username.toLowerCase() === RESERVED_ADMIN_USERNAME}
                onEdit={() => onEdit(u)}
                onDelete={() => onDelete(u)}
                onResetPassword={resetPassword}
                onToggleFeeExempt={() => toggleFeeExempt(u)}
                onUpdatePaymentMethod={(m) => updatePaymentMethod(u, m)}
                onSendReminder={() => sendPaymentReminder(u)}
                onCancelSubscription={(immediate?: boolean) => onCancelSubscription(u.id, immediate)}
                customRoles={customRoles}
              />
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", color: "#8899b4", padding: 30 }}>Brak wyników</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

/* ═══════════════════════════════════════════════
   USER ROW
   ═══════════════════════════════════════════════ */
const UserRow = ({ user, isMe, isAdminAccount, onEdit, onDelete, onResetPassword, onToggleFeeExempt, onUpdatePaymentMethod, onSendReminder, onCancelSubscription, customRoles }: {
  user: UserAccount;
  isMe: boolean;
  isAdminAccount: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onResetPassword: (id: string, pw: string) => void;
  onToggleFeeExempt: () => void;
  onUpdatePaymentMethod: (method: string) => void;
  onSendReminder: () => void;
  onCancelSubscription: (immediate?: boolean) => Promise<void>;
  customRoles: Role[];
}) => {
  const [resettingPw, setResettingPw] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const isTeacher = user.role === "nauczyciel";
  const isFeeExempt = user.fee_exempt || isTeacher;

  const getSubscriptionLabel = () => {
    if (isFeeExempt) return <span style={{ color: "#a78bfa", fontWeight: 700, fontSize: ".75rem" }}>Zwolniony</span>;
    if (user.subscription_status === "trial") {
      const endDate = user.subscription_end_date ? new Date(user.subscription_end_date) : null;
      const daysLeft = endDate ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
      return (
        <div>
          <span style={{ color: "#f472b6", fontWeight: 700, fontSize: ".75rem" }}>Okres próbny</span>
          {endDate && (
            <div style={{ fontSize: ".65rem", color: "#8899b4" }}>
              Koniec: {endDate.toLocaleDateString("pl")} ({daysLeft} dni)
            </div>
          )}
        </div>
      );
    }
    if (user.subscription_status === "active") {
      const renewDate = user.subscription_end_date ? new Date(user.subscription_end_date) : null;
      const planLabel = user.subscription_plan === "30d" ? "29 zł / miesiąc" : (user.subscription_plan === "90d" ? "90 dni" : (user.subscription_plan || "—"));
      return (
        <div>
          <span style={{ color: "#34d399", fontWeight: 700, fontSize: ".75rem" }}>Aktywna</span>
          {renewDate && (
            <div style={{ fontSize: ".65rem", color: "#8899b4" }}>
              Odnowienie: {renewDate.toLocaleDateString("pl")}
            </div>
          )}
          <div style={{ fontSize: ".65rem", color: "#8899b4", marginTop: 4 }}>Plan: {planLabel}</div>
          {user.stripe_subscription_id && user.subscription_plan === "30d" && (
            <div style={{ marginTop: 6 }}>
              <button
                className="admin-btn admin-btn-danger admin-btn-xs"
                disabled={cancelling}
                onClick={async () => {
                  if (!user.stripe_subscription_id) { toast.error("Brak subskrypcji w Stripe"); return; }
                  const immediate = confirm('Anulować natychmiast? OK = natychmiast, Anuluj = anuluj na koniec okresu.');
                  try {
                    setCancelling(true);
                    await onCancelSubscription(immediate);
                  } catch (e: any) {
                    toast.error(e?.message || "Błąd anulowania");
                  } finally {
                    setCancelling(false);
                  }
                }}
              >{cancelling ? 'Anulowanie…' : 'Anuluj subskrypcję'}</button>
            </div>
          )}
        </div>
      );
    }
    return <span style={{ color: "#8899b4", fontSize: ".75rem" }}>—</span>;
  };

  const getPaymentCell = () => {
    if (isFeeExempt) return <span style={{ color: "#8899b4", fontSize: ".75rem" }}>—</span>;

    const method = user.payment_method;
    if (!method) {
      return (
        <select
          style={{ fontSize: ".72rem", background: "rgba(255,255,255,0.05)", color: "#c8d8f0", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "3px 6px" }}
          value=""
          onChange={e => { if (e.target.value) onUpdatePaymentMethod(e.target.value); }}
        >
          <option value="">Wybierz...</option>
          <option value="odnawialna">Odnawialna</option>
          <option value="jednorazowa">Jednorazowa</option>
          <option value="gotówka">Gotówka</option>
        </select>
      );
    }

    const methodLabel = method === "odnawialna" ? "Odnawialna" : method === "jednorazowa" ? "Jednorazowa" : method === "gotówka" ? "Gotówka" : method;
    const methodColor = method === "odnawialna" ? "#34d399" : method === "jednorazowa" ? "#fbbf24" : "#fb923c";

    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 50,
            fontSize: ".65rem", fontWeight: 800, background: `${methodColor}18`, border: `1px solid ${methodColor}40`, color: methodColor,
          }}>
            {methodLabel}
          </span>
          <select
            style={{ fontSize: ".65rem", background: "transparent", color: "#8899b4", border: "none", cursor: "pointer", padding: 0 }}
            value={method}
            onChange={e => { if (e.target.value) onUpdatePaymentMethod(e.target.value); }}
          >
            <option value="odnawialna">Odnawialna</option>
            <option value="jednorazowa">Jednorazowa</option>
            <option value="gotówka">Gotówka</option>
          </select>
        </div>
        {method === "odnawialna" && user.payment_date && (
          <div style={{ fontSize: ".63rem", color: "#8899b4", marginTop: 2 }}>
            Następna opłata: {new Date(user.payment_date).toLocaleDateString("pl")}
          </div>
        )}
        {(method === "jednorazowa" || method === "gotówka") && (
          <button
            className="admin-btn admin-btn-xs"
            style={{ marginTop: 4, fontSize: ".63rem", background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}
            onClick={onSendReminder}
          >
            📧 Przypomnij o opłacie
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <tr className={isMe ? "admin-row-me" : ""}>
        <td data-label="Użytkownik">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="admin-av av-c1">{initials(user.name)}</div>
            <div>
              <div style={{ fontWeight: 700, color: "#c8d8f0" }}>
                {user.name}
                {isMe && <span className="admin-you-badge">Ty</span>}
              </div>
              <div style={{ fontSize: ".68rem", color: "#8899b4" }}>@{user.username} · dołączył {new Date(user.created_at).toLocaleDateString("pl")}</div>
            </div>
          </div>
        </td>
        <td data-label="E-mail">
          {user.email ? (
            <a href={`mailto:${user.email}`} style={{ color: "#60a5fa", textDecoration: "none", fontSize: ".78rem", wordBreak: "break-all", textAlign: "right" }}>{user.email}</a>
          ) : <span style={{ color: "#8899b4" }}>—</span>}
        </td>
        <td data-label="Rola"><RoleBadge role={user.role} customRoles={customRoles} /></td>
        <td data-label="Zwolnienie">
          <button
            onClick={isTeacher ? undefined : onToggleFeeExempt}
            disabled={isTeacher}
            title={isTeacher ? "Nauczyciele są automatycznie zwolnieni" : (isFeeExempt ? "Kliknij aby wyłączyć zwolnienie" : "Kliknij aby zwolnić z opłat")}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 50,
              fontSize: ".68rem", fontWeight: 700, cursor: isTeacher ? "default" : "pointer", border: "none",
              background: isFeeExempt ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.05)",
              color: isFeeExempt ? "#a78bfa" : "#8899b4",
            }}
          >
            {isFeeExempt ? "✅ Tak" : "❌ Nie"}
            {isTeacher && <span style={{ fontSize: ".6rem", opacity: 0.7 }}>(auto)</span>}
          </button>
        </td>
        <td data-label="Subskrypcja">{getSubscriptionLabel()}</td>
        <td data-label="Płatność">{getPaymentCell()}</td>
        <td data-label="Webhooki dziś">
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 50,
            fontSize: ".72rem", fontWeight: 800,
            background: user.webhook_suspended_at ? "rgba(248,113,113,0.16)" : "rgba(96,165,250,0.12)",
            color: user.webhook_suspended_at ? "#f87171" : "#60a5fa",
            border: user.webhook_suspended_at ? "1px solid rgba(248,113,113,0.35)" : "1px solid rgba(96,165,250,0.25)",
          }} title={user.webhook_suspended_reason || "Dzisiejsza liczba wywołań webhooków"}>
            {user.webhook_count_today || 0}/30{user.webhook_suspended_at ? " ⚠" : ""}
          </span>
        </td>
        <td data-label="Hasło">
          <span className="admin-pass">••••••</span>
        </td>
        <td data-label="Akcje">
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button className="admin-btn admin-btn-ghost admin-btn-xs" onClick={onEdit} title="Edytuj">✏️</button>
            <button className="admin-btn admin-btn-ghost admin-btn-xs" onClick={() => setResettingPw(!resettingPw)} title="Zmień hasło">🔑</button>
            <button
              className="admin-btn admin-btn-danger admin-btn-xs"
              onClick={onDelete}
              title={isAdminAccount ? "Nie można usunąć konta administratora" : "Usuń"}
              disabled={isMe || isAdminAccount}
            >
              🗑
            </button>
          </div>
        </td>
      </tr>
      {resettingPw && (
        <tr>
          <td colSpan={9} style={{ padding: "4px 12px 10px", background: "rgba(255,255,255,0.02)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                className="admin-input"
                placeholder="Nowe hasło (min. 6 znaków)"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                style={{ flex: "1 1 200px", minWidth: 0, fontSize: ".8rem" }}
              />
              <button className="admin-btn admin-btn-grad admin-btn-xs" onClick={() => {
                onResetPassword(user.id, newPw);
                setNewPw("");
                setResettingPw(false);
              }}>Zmień</button>
              <button className="admin-btn admin-btn-ghost admin-btn-xs" onClick={() => { setResettingPw(false); setNewPw(""); }}>Anuluj</button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

/* ═══════════════════════════════════════════════
   STATS VIEW
   ═══════════════════════════════════════════════ */
const StatsView = ({ users, customRoles }: { users: UserAccount[]; customRoles: Role[] }) => {
  const byRole: Record<string, number> = {};
  users.forEach(u => { byRole[u.role] = (byRole[u.role] || 0) + 1; });

  const newestUser = [...users].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  const exempt = users.filter(u => u.fee_exempt || u.role === "nauczyciel").length;
  const trials = users.filter(u => !u.fee_exempt && u.role !== "nauczyciel" && u.subscription_status === "trial").length;
  const active = users.filter(u => !u.fee_exempt && u.role !== "nauczyciel" && u.subscription_status === "active").length;

  const stats = [
    { v: users.length, l: "Użytkownicy" },
    { v: users.filter(u => u.role === "uczeń").length, l: "Uczniowie" },
    { v: users.filter(u => u.role === "nauczyciel").length, l: "Nauczyciele" },
    { v: exempt, l: "Zwolnieni z opłat" },
    { v: trials, l: "Okres próbny" },
    { v: active, l: "Aktywna subskrypcja" },
  ];

  return (
    <>
      <div className="ph">
        <div><div className="ph-title">📊 Statystyki platformy</div></div>
      </div>

      <div className="admin-stat-grid">
        {stats.map(s => (
          <div className="admin-stat" key={s.l}>
            <div className="admin-stat-val">{s.v}</div>
            <div className="admin-stat-lbl">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="admin-stats-row">
        <div className="admin-card">
          <div className="admin-section-title">Podział ról</div>
          {Object.entries(byRole).map(([r, n]) => (
            <div key={r} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <RoleBadge role={r} customRoles={customRoles} />
              <span style={{ fontWeight: 700, color: "#c8d8f0" }}>{n}</span>
            </div>
          ))}
        </div>
        <div className="admin-card">
          <div className="admin-section-title">Informacje ogólne</div>
          {newestUser && (
            <div style={{ fontSize: ".82rem" }}>
              <span style={{ color: "#8899b4" }}>🆕 Najnowszy:</span>{" "}
              <span style={{ fontWeight: 700, color: "#c8d8f0" }}>{newestUser.name}</span>
              <div style={{ fontSize: ".72rem", color: "#8899b4", marginTop: 2 }}>
                Dołączył {new Date(newestUser.created_at).toLocaleDateString("pl")}
              </div>
            </div>
          )}
        </div>
        <div className="admin-card">
          <div className="admin-section-title">Płatności</div>
          <div style={{ fontSize: ".82rem", color: "#8899b4", lineHeight: 1.7 }}>
            <div>Odnawialna: <b style={{ color: "#c8d8f0" }}>{users.filter(u => u.payment_method === "odnawialna").length}</b></div>
            <div>Jednorazowa: <b style={{ color: "#c8d8f0" }}>{users.filter(u => u.payment_method === "jednorazowa").length}</b></div>
            <div>Gotówka: <b style={{ color: "#c8d8f0" }}>{users.filter(u => u.payment_method === "gotówka").length}</b></div>
          </div>
        </div>
      </div>
    </>
  );
};

/* ═══════════════════════════════════════════════
   HELPER FUNCTIONS
   ═══════════════════════════════════════════════ */
const getRoleLabel = (roleName: string, customRoles: Role[]): string => {
  const role = customRoles.find(r => r.name === roleName);
  return role?.label || roleName;
};

const getRoleColor = (roleName: string, customRoles: Role[]): string => {
  const role = customRoles.find(r => r.name === roleName);
  return role?.color || "#8899b4";
};

const isRoleBuiltin = (roleName: string, customRoles: Role[]): boolean => {
  const role = customRoles.find(r => r.name === roleName);
  return role?.is_builtin || false;
};

const COLOR_PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#fb7185", "#fbbf24", "#a3e635",
  "#34d399", "#2dd4bf", "#22d3ee", "#38bdf8", "#818cf8",
  "#a78bfa", "#c084fc", "#e879f9", "#f472b6", "#fb923c",
  "#facc15", "#4ade80", "#2dd4bf", "#60a5fa", "#c4b5fd",
  "#fca5a1", "#fdba74", "#fcd34d", "#86efac", "#67e8f9",
  "#93c5fd", "#c7d2fe", "#e9d5ff", "#fbcfe8", "#e2e8f0",
];

/* ═══════════════════════════════════════════════
   ROLES VIEW
   ═══════════════════════════════════════════════ */
const RolesView = ({ users, onRefresh, customRoles, allRoleNames }: {
  users: UserAccount[];
  onRefresh: () => void;
  customRoles: Role[];
  allRoleNames: string[];
}) => {
  const [massUser, setMassUser] = useState("");
  const [massRole, setMassRole] = useState(allRoleNames[0] || "uczeń");
  const [massSrc, setMassSrc] = useState(allRoleNames[0] || "uczeń");
  const [massDst, setMassDst] = useState(allRoleNames[1] || "nauczyciel");
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#60a5fa");
  const [editingRoleName, setEditingRoleName] = useState<string | null>(null);
  const [editedRoleLabel, setEditedRoleLabel] = useState("");
  const [editedRoleColor, setEditedRoleColor] = useState("#60a5fa");
  // Local state for roles to enable instant updates
  const [localRoles, setLocalRoles] = useState<Role[]>(customRoles);

  // Update local roles when customRoles prop changes
  useEffect(() => {
    setLocalRoles(customRoles);
  }, [customRoles]);

  // Include all roles: built-in (admin, uczeń, nauczyciel) + custom ones
  const allRoles = localRoles.map(r => ({
    name: r.name,
    count: users.filter(u => u.role === r.name).length,
    color: r.color || "#8899b4",
    label: r.label || r.name,
    isBuiltin: r.is_builtin,
  }));

  // Add built-in roles that might be missing from custom_roles
  const builtInRoles = ["admin", "uczeń", "nauczyciel"];
  for (const builtIn of builtInRoles) {
    if (!allRoles.find(r => r.name === builtIn)) {
      const defaultColors: Record<string, string> = { admin: "#f87171", uczeń: "#60a5fa", nauczyciel: "#fbbf24" };
      const defaultLabels: Record<string, string> = { admin: "Admin", uczeń: "Uczeń", nauczyciel: "Nauczyciel" };
      allRoles.unshift({
        name: builtIn,
        count: users.filter(u => u.role === builtIn).length,
        color: defaultColors[builtIn] || "#8899b4",
        label: defaultLabels[builtIn] || builtIn,
        isBuiltin: true,
      });
    }
  }

  const roleCounts = allRoles;

  const assignRole = async () => {
    if (!massUser) { toast.error("Wybierz użytkownika"); return; }
    if (massRole === "admin") {
      toast.error("Nie można przypisać roli adminnik bezpośrednio");
      return;
    }
    const targetUser = users.find(u => u.id === massUser);
    if (targetUser?.username?.toLowerCase() === RESERVED_ADMIN_USERNAME) {
      toast.error("Konto Wieża musi pozostać adminem");
      return;
    }
    const updates: Record<string, any> = { role: massRole };
    if (massRole === "nauczyciel") {
      updates.fee_exempt = true;
      updates.subscription_status = "exempt";
    }
    try {
      await adminUpdateUser(massUser, updates);
    } catch (e: any) { toast.error(e?.message || "Błąd"); return; }
    const myId = localStorage.getItem("userId");
    if (massUser === myId) localStorage.setItem("userRole", massRole);
    toast.success(`Przypisano rolę „${getRoleLabel(massRole, customRoles)}"`);
    onRefresh();
  };

  const assignRoleGroup = async () => {
    if (massSrc === massDst) { toast.error("Źródło i cel są takie same"); return; }
    const toUpdate = users.filter(u => u.role === massSrc);
    for (const u of toUpdate) {
      const updates: Record<string, any> = { role: massDst };
      if (massDst === "nauczyciel") { updates.fee_exempt = true; updates.subscription_status = "exempt"; }
      await adminUpdateUser(u.id, updates);
    }
    toast.success(`Zmieniono rolę ${toUpdate.length} użytkownikom: ${getRoleLabel(massSrc, customRoles)} → ${getRoleLabel(massDst, customRoles)}`);
    onRefresh();
  };

  const addCustomRole = async () => {
    const name = newRoleName.trim().toLowerCase();
    if (!name) { toast.error("Podaj nazwę roli"); return; }
    if (["admin", ...allRoleNames].includes(name)) { toast.error("Taka rola już istnieje lub jest zarezerwowana"); return; }
    if (!/^[a-z0-9_-]+$/.test(name)) { toast.error("Nazwa roli może zawierać tylko małe litery, cyfry, '-' i '_' "); return; }
    const roleLabel = newRoleName.trim();

    try {
      // Try with full columns first (with is_builtin)
      let { error } = await supabase.from("custom_roles").insert({
        name,
        label: roleLabel,
        color: newRoleColor || "#60a5fa",
        is_builtin: false,
      });

      // If error about missing columns, try a schema-compatible insert
      if (error && (error.code === "42703" || error.message?.includes("is_builtin") || error.message?.includes("label"))) {
        const missingLabel = error.message?.includes("label");
        const missingIsBuiltin = error.message?.includes("is_builtin");
        const fallbackInsert: Record<string, any> = {
          name,
          color: newRoleColor || "#60a5fa",
        };
        if (!missingLabel) fallbackInsert.label = roleLabel;
        if (!missingIsBuiltin) fallbackInsert.is_builtin = false;

        const fallback = await supabase.from("custom_roles").insert([fallbackInsert as any]);
        if (fallback.error) { toast.error(fallback.error.message); return; }
      } else if (error) {
        toast.error(error.message);
        return;
      }

      // Immediately update local state
      const newRole: Role = {
        id: name,
        name,
        label: roleLabel,
        color: newRoleColor || "#60a5fa",
        is_builtin: false,
        created_at: new Date().toISOString(),
      };
      setLocalRoles([...localRoles, newRole]);

      toast.success(`Dodano rolę „${roleLabel}"`);
      setNewRoleName("");
      setNewRoleColor("#60a5fa");
      
      // Async refresh
      setTimeout(() => {
        onRefresh();
      }, 200);
    } catch (error: any) {
      console.error("Add role error:", error);
      toast.error(error?.message || "Błąd dodawania roli");
    }
  };

  const saveRole = async (roleName: string) => {
    if (!editedRoleLabel.trim()) { toast.error("Podaj nazwę roli"); return; }
    if (!editedRoleColor.trim()) { toast.error("Podaj kolor roli"); return; }

    const isBuiltIn = ["admin", "uczeń", "nauczyciel"].includes(roleName);
    
    try {
      // Try to insert/update with all columns first
      let { error: insertError } = await supabase.from("custom_roles").upsert({ 
        name: roleName,
        label: editedRoleLabel.trim(), 
        color: editedRoleColor,
        is_builtin: isBuiltIn
      }, { onConflict: "name" });

      // If error about missing columns, try a schema-compatible upsert
      if (insertError && (insertError.code === "42703" || insertError.message?.includes("is_builtin") || insertError.message?.includes("label"))) {
        const missingLabel = insertError.message?.includes("label");
        const missingIsBuiltin = insertError.message?.includes("is_builtin");
        const fallbackUpsert: Record<string, any> = {
          name: roleName,
          color: editedRoleColor,
        };
        if (!missingLabel) fallbackUpsert.label = editedRoleLabel.trim();
        if (!missingIsBuiltin) fallbackUpsert.is_builtin = isBuiltIn;

        const { error: fallbackError } = await supabase.from("custom_roles").upsert([fallbackUpsert as any], { onConflict: "name" });
        if (fallbackError) throw fallbackError;
      } else if (insertError) {
        throw insertError;
      }

      // Immediately update local state to reflect changes in UI
      const updatedRoles = localRoles.map(r => 
        r.name === roleName 
          ? { ...r, label: editedRoleLabel.trim(), color: editedRoleColor, is_builtin: isBuiltIn }
          : r
      );
      
      // If role doesn't exist locally, add it
      if (!updatedRoles.find(r => r.name === roleName)) {
        updatedRoles.push({
          id: roleName,
          name: roleName,
          label: editedRoleLabel.trim(),
          color: editedRoleColor,
          is_builtin: isBuiltIn,
          created_at: new Date().toISOString(),
        });
      }
      
      setLocalRoles(updatedRoles);
      
      toast.success(`Zaktualizowano rolę „${editedRoleLabel.trim()}"`);
      setEditingRoleName(null);
      
      // Schedule async refresh after UI update
      setTimeout(() => {
        onRefresh();
      }, 200);
    } catch (error: any) {
      console.error("Save role error:", error);
      toast.error(error?.message || "Błąd zapisywania roli");
    }
  };

  const deleteCustomRole = async (roleName: string) => {
    const role = localRoles.find(r => r.name === roleName);
    if (role?.is_builtin) {
      toast.error("Nie można usunąć roli wbudowanej");
      return;
    }
    if (!confirm(`Usunąć rolę „${roleName}"? Użytkownicy z tą rolą zostaną zmienieni na „uczeń".`)) return;

    try {
      // Change users with this role to uczeń
      const usersWithRole = users.filter(u => u.role === roleName);
      for (const u of usersWithRole) {
        await adminUpdateUser(u.id, { role: "uczeń" });
      }
      
      // Delete from database
      const { error } = await supabase.from("custom_roles").delete().eq("name", roleName);
      if (error) throw error;
      
      // Immediately update local state
      setLocalRoles(localRoles.filter(r => r.name !== roleName));
      
      toast.success(`Usunięto rolę „${roleName}"`);
      
      // Async refresh
      setTimeout(() => {
        onRefresh();
      }, 200);
    } catch (error: any) {
      console.error("Delete role error:", error);
      toast.error(error?.message || "Błąd usuwania roli");
    }
  };

  return (
    <>
      <div className="ph">
        <div>
          <div className="ph-title">🎭 Zarządzanie rolami</div>
          <div className="ph-sub">Przypisuj role i twórz nowe</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <div className="admin-card" style={{ marginBottom: 14 }}>
            <div className="admin-section-title">Wszystkie role</div>
            {roleCounts.map(r => (
              <div key={r.name} className="admin-role-row">
                <div className="admin-role-dot" style={{ background: r.color }} />

                {editingRoleName === r.name ? (
                  <>
                    <input
                      value={editedRoleLabel}
                      onChange={e => setEditedRoleLabel(e.target.value)}
                      className="admin-input"
                      style={{ width: 120, marginRight: 8, padding: "7px 11px", fontSize: ".85rem" }}
                    />
                    <input
                      type="color"
                      value={editedRoleColor}
                      onChange={e => setEditedRoleColor(e.target.value)}
                      className="admin-input"
                      style={{ marginRight: 8, width: 50, height: 32, padding: 3 }}
                    />
                  </>
                ) : (
                  <RoleBadge role={r.name} customRoles={customRoles} />
                )}

                <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: ".72rem", color: "#8899b4" }}>{r.count} użytk.</span>

                  {editingRoleName === r.name ? (
                    <>
                      <button className="admin-btn admin-btn-grad admin-btn-xs" onClick={() => saveRole(r.name)} style={{ fontSize: ".6rem", padding: "1px 6px" }}>💾</button>
                      <button className="admin-btn admin-btn-ghost admin-btn-xs" onClick={() => setEditingRoleName(null)} style={{ fontSize: ".6rem", padding: "1px 6px" }}>✖</button>
                    </>
                  ) : (
                    <>
                      <button
                        className="admin-btn admin-btn-outline admin-btn-xs"
                        onClick={() => {
                          setEditingRoleName(r.name);
                          setEditedRoleLabel(r.label);
                          setEditedRoleColor(r.color || "#60a5fa");
                        }}
                        style={{ fontSize: ".6rem", padding: "1px 6px" }}
                      >✏️</button>

                      {!r.isBuiltin && (
                        <button
                          className="admin-btn admin-btn-danger admin-btn-xs"
                          onClick={() => deleteCustomRole(r.name)}
                          style={{ fontSize: ".6rem", padding: "1px 6px" }}
                        >🗑</button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="admin-card">
            <div className="admin-section-title">➕ Dodaj nową rolę</div>
            <div className="admin-fg">
              <label>Nazwa roli</label>
              <input value={newRoleName} onChange={e => setNewRoleName(e.target.value)} maxLength={30} placeholder="np. moderator" />
            </div>
            <div className="admin-fg">
              <label>Kolor</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {COLOR_PALETTE.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewRoleColor(c)}
                    style={{
                      width: 28, height: 28, borderRadius: 8, border: newRoleColor === c ? "2px solid #fff" : "2px solid transparent",
                      background: c, cursor: "pointer", outline: newRoleColor === c ? `2px solid ${c}` : "none", outlineOffset: 2,
                      transition: "all .15s",
                    }}
                    title={c}
                  />
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                <input type="color" value={newRoleColor} onChange={e => setNewRoleColor(e.target.value)} style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer" }} />
                <span style={{ fontSize: ".72rem", color: "#8899b4" }}>Własny kolor:</span>
                <span style={{ fontSize: ".72rem", color: "#8899b4", fontFamily: "monospace" }}>{newRoleColor}</span>
                <div style={{ width: 16, height: 16, borderRadius: 4, background: newRoleColor }} />
              </div>
            </div>
            <button className="admin-btn admin-btn-grad admin-btn-sm" onClick={addCustomRole}>✅ Dodaj rolę</button>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-section-title">Przypisz rolę użytkownikowi</div>
          <div className="admin-fg">
            <label>Wybierz użytkownika</label>
            <select value={massUser} onChange={e => setMassUser(e.target.value)}>
              <option value="">— wybierz —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>)}
            </select>
          </div>
          <div className="admin-fg">
            <label>Nowa rola</label>
            <select value={massRole} onChange={e => setMassRole(e.target.value)}>
              {allRoleNames.map(r => <option key={r} value={r}>{getRoleLabel(r, customRoles)}</option>)}
            </select>
          </div>
          <button className="admin-btn admin-btn-grad admin-btn-sm" onClick={assignRole}>✅ Przypisz rolę</button>

          <div style={{ marginTop: 18, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
            <div className="admin-section-title">Zmień rolę całej grupie</div>
            <div className="admin-fg">
              <label>Aktualna rola (źródło)</label>
              <select value={massSrc} onChange={e => setMassSrc(e.target.value)}>
                {allRoleNames.map(r => <option key={r} value={r}>{getRoleLabel(r, customRoles)}</option>)}
              </select>
            </div>
            <div className="admin-fg">
              <label>Nowa rola (cel)</label>
              <select value={massDst} onChange={e => setMassDst(e.target.value)}>
                {allRoleNames.map(r => <option key={r} value={r}>{getRoleLabel(r, customRoles)}</option>)}
              </select>
            </div>
            <button className="admin-btn admin-btn-outline admin-btn-sm" onClick={assignRoleGroup}>🔄 Zmień wszystkim tej roli</button>
          </div>
        </div>
      </div>
    </>
  );
};

/* ═══════════════════════════════════════════════
   EDIT USER MODAL
   ═══════════════════════════════════════════════ */
const EditUserModal = ({ user, onClose, onSave, allRoleNames, customRoles }: { user: UserAccount; onClose: () => void; onSave: () => void; allRoleNames: string[]; customRoles: Role[] }) => {
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [password, setPassword] = useState("");

  const isAdminAccount = username.toLowerCase() === RESERVED_ADMIN_USERNAME;

  const handleSave = async () => {
    if (!name.trim() || !username.trim()) { toast.error("Nazwa i login nie mogą być puste"); return; }

    if (isAdminAccount && role !== "admin") {
      toast.error("Konto administratora musi mieć rolę Admin");
      return;
    }

    const updates: any = {
      name: name.trim(),
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      role: isAdminAccount ? "admin" : role,
    };

    if (isAdminAccount) {
      updates.fee_exempt = true;
      updates.subscription_status = "exempt";
    } else if (role === "nauczyciel") {
      updates.fee_exempt = true;
      updates.subscription_status = "exempt";
    } else if (user.role === "nauczyciel" && role !== "nauczyciel") {
      updates.fee_exempt = false;
      updates.subscription_status = "trial";
      updates.subscription_end_date = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    }

    if (password) {
      updates.new_password = password;
    }

    try {
      await adminUpdateUser(user.id, updates);
    } catch (e: any) {
      const msg = e?.message || "";
      toast.error(msg.includes("unique") ? "Ta nazwa użytkownika jest już zajęta" : msg);
      return;
    }

    const myId = localStorage.getItem("userId");
    if (user.id === myId) {
      localStorage.setItem("userName", name.trim());
      localStorage.setItem("userUsername", username.trim().toLowerCase());
      localStorage.setItem("userRole", updates.role);
    }

    toast.success("Zapisano zmiany");
    onSave();
    onClose();
  };

  return (
    <div className="admin-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="admin-modal">
        <button className="admin-modal-close" onClick={onClose}>✕</button>
        <div className="admin-modal-title">✏️ Edytuj użytkownika {isAdminAccount && <span style={{ fontSize: ".7rem", opacity: 0.6 }}>(konto admina)</span>}</div>

        <div className="admin-fg2">
          <div className="admin-fg">
            <label>Nazwa użytkownika {isAdminAccount && <span style={{ fontSize: ".65rem", opacity: 0.6 }}>(zarezerwowana)</span>}</label>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={40} disabled={isAdminAccount} />
          </div>
          <div className="admin-fg">
            <label>Hasło</label>
            <input value={password} onChange={e => setPassword(e.target.value)} maxLength={60} />
          </div>
        </div>
        <div className="admin-fg">
          <label>Adres e-mail</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" maxLength={80} placeholder="np. jan@szkola.pl" />
        </div>
        <div className="admin-fg2">
          <div className="admin-fg">
            <label>Login (@) {isAdminAccount && <span style={{ fontSize: ".65rem", opacity: 0.6 }}>(zarezerwowany)</span>}</label>
            <input value={username} onChange={e => setUsername(e.target.value)} maxLength={25} disabled={isAdminAccount} />
          </div>
          <div className="admin-fg">
            <label>Rola {isAdminAccount && <span style={{ fontSize: ".65rem", opacity: 0.6 }}>(zawsze Admin)</span>}</label>
            <select value={isAdminAccount ? "admin" : role} onChange={e => !isAdminAccount && setRole(e.target.value)} disabled={isAdminAccount}>
              {isAdminAccount ? (
                <option value="admin">Admin</option>
              ) : (
                allRoleNames.map(r => <option key={r} value={r}>{getRoleLabel(r, customRoles)}</option>)
              )}
            </select>
          </div>
        </div>

        <div className="admin-modal-foot">
          <button className="admin-btn admin-btn-ghost" onClick={onClose}>Anuluj</button>
          <button className="admin-btn admin-btn-grad" onClick={handleSave}>💾 Zapisz</button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════
   NEW USER MODAL
   ═══════════════════════════════════════════════ */
const NewUserModal = ({ onClose, onSave, allRoleNames, customRoles }: { onClose: () => void; onSave: () => void; allRoleNames: string[]; customRoles: Role[] }) => {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(allRoleNames[0] || "uczeń");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !username.trim() || !email.trim() || !password) {
      toast.error("Wypełnij wszystkie pola");
      return;
    }
    if (password.length < 6) { toast.error("Hasło musi mieć min. 6 znaków"); return; }

    if (username.trim().toLowerCase() === RESERVED_ADMIN_USERNAME) {
      toast.error("Nazwa użytkownika 'Wieża' jest zarezerwowana dla administratora");
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("auth-register", {
        body: { email: email.trim(), name: name.trim(), username: username.trim(), password },
      });

      if (error) {
        throw error;
      }
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const accountId = data?.account?.id || data?.userId || null;
      if (!accountId) {
        toast.error("Nie udało się utworzyć konta");
        return;
      }

      if (role !== "uczeń" && accountId) {
        const updates: Record<string, any> = { role };
        if (role === "nauczyciel") {
          updates.fee_exempt = true;
          updates.subscription_status = "exempt";
        }
        await adminUpdateUser(accountId, updates);
      }

      toast.success(`Konto „${username}" utworzone!`);
      onSave();
      onClose();
    } catch (e: any) {
      console.error("Create user error:", e);
      toast.error(e?.message || "Błąd tworzenia konta");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="admin-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="admin-modal">
        <button className="admin-modal-close" onClick={onClose}>✕</button>
        <div className="admin-modal-title">➕ Nowe konto</div>

        <div className="admin-fg2">
          <div className="admin-fg">
            <label>Imię / Nazwa *</label>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={40} />
          </div>
          <div className="admin-fg">
            <label>Hasło *</label>
            <input value={password} onChange={e => setPassword(e.target.value)} maxLength={60} placeholder="min. 6 znaków" />
          </div>
        </div>
        <div className="admin-fg">
          <label>Adres e-mail *</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" maxLength={80} placeholder="np. jan@szkola.pl" />
        </div>
        <div className="admin-fg2">
          <div className="admin-fg">
            <label>Login (@) * </label>
            <input value={username} onChange={e => setUsername(e.target.value)} maxLength={25} placeholder="np. jan_k" />
          </div>
          <div className="admin-fg">
            <label>Rola</label>
            <select value={role} onChange={e => setRole(e.target.value)}>
              {allRoleNames.map(r => <option key={r} value={r}>{getRoleLabel(r, customRoles)}</option>)}
            </select>
          </div>
        </div>

        <div className="admin-modal-foot">
          <button className="admin-btn admin-btn-ghost" onClick={onClose}>Anuluj</button>
          <button className="admin-btn admin-btn-grad" onClick={handleCreate} disabled={creating}>
            {creating ? "Tworzenie..." : "✅ Utwórz konto"}
          </button>
        </div>
      </div>
    </div>
  );
};


/* ═══════════════════════════════════════════════
   SETTINGS VIEW (Webhook URLs)
   ═══════════════════════════════════════════════ */
const WEBHOOK_FIELDS = [
  { key: "webhook_notes", icon: "📝", label: "Webhook – Notatki", desc: "Webhook do przetwarzania notatek, transkrypcji i ekstrakcji wydarzeń z notatek." },
  { key: "webhook_languages", icon: "🌐", label: "Webhook – Definicje", desc: "Webhook do generowania definicji słówek. Oczekiwany format odpowiedzi: {słowo | definicja}" },
  { key: "webhook_languages_sentences", icon: "📖", label: "Webhook – Zdania", desc: "Webhook do generowania zdań z lukami. Oczekiwane wejście: {słowo | definicja}. Oczekiwana odpowiedź callback'u: JSON z {listId, userId, sentences: '{słowo | definicja | zdanie}'}" },
  { key: "webhook_ocr", icon: "📸", label: "Webhook – Fiszki ze zdjęcia", desc: "Webhook do rozpoznawania słówek ze zdjęć podręczników (OCR)." },
  { key: "webhook_form", icon: "📋", label: "Webhook – Formularz zgłoszeniowy", desc: "Webhook do formularza zgłoszeniowego do zespołu Moc Nauki." },
] as const;

const SettingsView = () => {
  const [webhooks, setWebhooks] = useState<Record<string, string>>({});
  const [savedWebhooks, setSavedWebhooks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [savedRegistrationEnabled, setSavedRegistrationEnabled] = useState(true);

  const userId = localStorage.getItem("userId");
    const callSettings = useCallback(async (body: any) => {
      const res = await supabase.functions.invoke("manage-app-settings", {
        body,
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    }, []);

  useEffect(() => {
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const keys = [...WEBHOOK_FIELDS.map(f => f.key), "registration_enabled"];
        const result = await callSettings({ action: "get", keys });
        const map: Record<string, string> = {};
        
        // Edge function now returns array directly
        if (Array.isArray(result)) {
          result.forEach((r: any) => { map[r.key] = r.value; });
        } else {
          throw new Error("Invalid response format");
        }
        // Backward compatibility: if old webhook_languages exists but new ones don't
        if (map["webhook_languages"] && !map["webhook_languages_sentences"]) {
          map["webhook_languages_sentences"] = "";
        }
        setWebhooks({ ...map });
        setSavedWebhooks({ ...map });
        setRegistrationEnabled(map["registration_enabled"] !== "false");
        setSavedRegistrationEnabled(map["registration_enabled"] !== "false");
      } catch (e) {
        console.error("Failed to load settings:", e);
        setError((e as Error).message || "Błąd ładowania ustawień");
      } finally {
        setLoading(false);
      }
    })();
  }, [callSettings]);

  const saveWebhook = async (key: string) => {
    const val = (webhooks[key] || "").trim();
    if (!val) { toast.error("Podaj URL webhooka"); return; }
    setSaving(key);
    try {
      await callSettings({ action: "set", key, value: val });
      setSavedWebhooks(prev => ({ ...prev, [key]: val }));
      toast.success("Webhook zapisany!");
    } catch (error: any) {
      toast.error("Nie udało się zapisać: " + (error?.message || "Unknown error"));
    }
    setSaving(null);
  };

  const saveRegistrationSetting = async () => {
    setSaving("registration");
    try {
      await callSettings({ action: "set", key: "registration_enabled", value: registrationEnabled.toString() });
      setSavedRegistrationEnabled(registrationEnabled);
      toast.success("Ustawienie rejestracji zapisane!");
    } catch (error: any) {
      toast.error("Nie udało się zapisać: " + (error?.message || "Unknown error"));
    }
    setSaving(null);
  };

  return (
    <>
      <div className="ph">
        <div>
          <div className="ph-title">⚙️ Ustawienia platformy</div>
          <div className="ph-sub">Zarządzaj webhookami n8n</div>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: 12, marginBottom: 14, color: "#ef4444" }}>
          ❌ {error}
        </div>
      )}

      <div style={{ maxWidth: 600 }}>
        {WEBHOOK_FIELDS.map(field => (
          <div className="admin-card" key={field.key} style={{ marginBottom: 14 }}>
            <div className="admin-section-title">{field.icon} {field.label}</div>
            <p style={{ fontSize: ".8rem", color: "#8899b4", lineHeight: 1.6, marginBottom: 12 }}>
              {field.desc}
            </p>

            {loading ? (
              <div style={{ color: "#8899b4", fontSize: ".82rem" }}>Ładowanie...</div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <input
                    type="text"
                    value={webhooks[field.key] || ""}
                    onChange={e => setWebhooks(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder="https://..."
                    style={{
                      flex: 1,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#fff",
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontSize: ".85rem",
                      fontFamily: "monospace",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="admin-btn admin-btn-grad admin-btn-sm"
                    onClick={() => saveWebhook(field.key)}
                    disabled={saving === field.key || (webhooks[field.key] || "").trim() === (savedWebhooks[field.key] || "")}
                  >
                    {saving === field.key ? "Zapisywanie..." : "💾 Zapisz"}
                  </button>
                  {savedWebhooks[field.key] && (
                    <button
                      className="admin-btn admin-btn-danger admin-btn-sm"
                      onClick={async () => {
                        if (!confirm("Na pewno usunąć ten webhook?")) return;
                        try {
                          await callSettings({ action: "delete", key: field.key });
                          setWebhooks(prev => { const n = { ...prev }; delete n[field.key]; return n; });
                          setSavedWebhooks(prev => { const n = { ...prev }; delete n[field.key]; return n; });
                          toast.success("Webhook usunięty");
                        } catch (e: any) {
                          toast.error("Błąd: " + (e?.message || "Unknown"));
                        }
                      }}
                    >
                      🗑 Usuń
                    </button>
                  )}
                </div>

                {savedWebhooks[field.key] && (
                  <div style={{ fontSize: ".72rem", color: "#34d399", marginTop: 8 }}>
                    ✅ Webhook skonfigurowany
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Registration Settings */}
      <div className="admin-card" style={{ marginTop: 20 }}>
        <div className="admin-section-title">🔒 Ustawienia rejestracji</div>
        <p style={{ fontSize: ".8rem", color: "#8899b4", lineHeight: 1.6, marginBottom: 16 }}>
          Kontroluj czy nowe konta mogą być zakładane przez użytkowników.
        </p>

        {loading ? (
          <div style={{ color: "#8899b4", fontSize: ".82rem" }}>Ładowanie...</div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={registrationEnabled}
                  onChange={e => setRegistrationEnabled(e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                <span style={{ fontSize: ".9rem", color: "#fff" }}>
                  Zezwalaj na zakładanie nowych kont
                </span>
              </label>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="admin-btn admin-btn-grad admin-btn-sm"
                onClick={saveRegistrationSetting}
                disabled={saving === "registration" || registrationEnabled === savedRegistrationEnabled}
              >
                {saving === "registration" ? "Zapisywanie..." : "💾 Zapisz"}
              </button>
            </div>

            {savedRegistrationEnabled ? (
              <div style={{ fontSize: ".72rem", color: "#34d399", marginTop: 8 }}>
                ✅ Rejestracja włączona
              </div>
            ) : (
              <div style={{ fontSize: ".72rem", color: "#f87171", marginTop: 8 }}>
                ❌ Rejestracja wyłączona
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

/* ═══════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════ */
const RoleBadge = ({ role, customRoles = [] }: { role: string; customRoles?: Role[] }) => {
  const roleData = customRoles.find(cr => cr.name === role);
  const color = roleData?.color || "#8899b4";
  const label = roleData?.label || role;
  
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 50,
      fontSize: ".68rem", fontWeight: 800, border: `1px solid ${color}40`,
      background: `${color}18`, color,
    }}>
      {label}
    </span>
  );
};

function initials(name: string) {
  const parts = (name || "").trim().split(" ");
  return parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2).toUpperCase();
}

export default AdminUsersTab;
