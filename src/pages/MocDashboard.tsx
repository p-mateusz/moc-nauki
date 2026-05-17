import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useRoles } from "@/hooks/use-roles";
import { useUserRole } from "@/hooks/use-user-role";
import { useAccessGuard } from "@/hooks/use-access-guard";
import { clearAuthStorage, logoutUser } from "@/lib/authCleanup";
import LanguagesTab from "@/components/dashboard/LanguagesTab";
import NotesTab from "@/components/dashboard/NotesTab";
import CalendarTab, { type CalEvent } from "@/components/dashboard/CalendarTab";
import RecordingWidget from "@/components/dashboard/RecordingWidget";
import FriendsTab from "@/components/dashboard/FriendsTab";
import SettingsTab from "@/components/dashboard/SettingsTab";
import OverviewTab from "@/components/dashboard/OverviewTab";
import TeacherStudentsTab from "@/components/dashboard/TeacherStudentsTab";
import TestsTab from "@/components/dashboard/TestsTab";
import RankingTab from "@/components/dashboard/RankingTab";
import AdminUsersTab from "@/components/dashboard/AdminUsersTab";
import TipsTab from "@/components/dashboard/TipsTab";
import "./MocDashboard.css";
type Tab =
  | "overview"
  | "notes"
  | "tests"
  | "calendar"
  | "teacher"
  | "students"
  | "languages"
  | "friends"
  | "tips"
  | "ranking"
  | "admin_users"
  | "settings";

const MocDashboard = () => {
  const storedGuestMode = localStorage.getItem("guestMode") === "true";
  const storedUserId = localStorage.getItem("userId");
  const guestMode = storedGuestMode && storedUserId === "guest";
  const guestListId = guestMode ? localStorage.getItem("guestListId") : null;
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (guestMode) return "languages";
    const saved = localStorage.getItem("dashboardActiveTab") as Tab | null;
    return saved || "overview";
  });

  useEffect(() => {
    if (!guestMode) {
      localStorage.setItem("dashboardActiveTab", activeTab);
    }
  }, [activeTab, guestMode]);
  const [pendingEvents, setPendingEvents] = useState<CalEvent[]>([]);
  const [initialNotePageId, setInitialNotePageId] = useState<string | null>(null);
  const [showLogout, setShowLogout] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const logoutRef = useRef<HTMLDivElement>(null);
  const avatarCacheKey = storedUserId ? `userAvatarUrl:${storedUserId}` : null;
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    avatarCacheKey ? localStorage.getItem(avatarCacheKey) : null
  );
  useEffect(() => { localStorage.removeItem("userAvatarUrl"); }, []);
  const { role: serverRole } = useUserRole();
  // Server-verified role only — never trust localStorage for authorization
  const userRole = serverRole ?? "uczeń";
  const [unreadCounts, setUnreadCounts] = useState({ teacher: 0, student: 0 });
  const [authReady, setAuthReady] = useState(false);
  const navigate = useNavigate();
  const userId = storedUserId;
  const userName = localStorage.getItem("userName") || "Uczeń";
  const userUsername = localStorage.getItem("userUsername") || "";
  const isTeacher = userRole === "teacher" || userRole === "nauczyciel";
  const isAdmin = userRole === "admin";
  const initials = userName.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase();
  const { roles: availableRoles, getRoleLabel, getRoleColor } = useRoles();

  const roleInfo = availableRoles.find(r => r.name === userRole);
  const roleBadgeLabel = (roleInfo?.label || userRole)?.charAt(0).toLowerCase() + (roleInfo?.label || userRole)?.slice(1);
  const roleBadgeColor = roleInfo?.color || (isAdmin ? "#f87171" : isTeacher ? "#fbbf24" : "#60a5fa");
  const roleBadgeBackground = roleBadgeColor.startsWith("linear-gradient") ? roleBadgeColor : `${roleBadgeColor}20`;
  const roleBadgeTextColor = roleBadgeColor.startsWith("linear-gradient") ? "#fff" : roleBadgeColor;
  const isTabLocked = (tab: Tab) => guestMode && !["overview", "notes", "calendar", "languages", "tests", "friends", "tips", "ranking", "settings", "teacher"].includes(tab);
  const getTabBadge = (tab: Tab) => {
    if (tab === "teacher") return unreadCounts.teacher;
    if (tab === "students") return unreadCounts.student;
    return 0;
  };

  useEffect(() => {
    if (!showLogout) return;
    const handleClickOutside = (e: Event) => {
      if (logoutRef.current && !logoutRef.current.contains(e.target as Node)) {
        setShowLogout(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showLogout]);

  const loadUnreadCounts = async () => {
    if (!userId) return;

    const { data: unreadMessages, error } = await supabase
      .from("messages")
      .select("sender_id")
      .eq("receiver_id", userId)
      .eq("read", false);

    if (error) {
      console.error("Unable to load unread message counts:", error);
      return;
    }

    const senderCounts = (unreadMessages || []).reduce<Record<string, number>>((acc, item) => {
      if (!item?.sender_id) return acc;
      acc[item.sender_id] = (acc[item.sender_id] || 0) + 1;
      return acc;
    }, {});

    const senderIds = Object.keys(senderCounts);
    if (senderIds.length === 0) {
      setUnreadCounts({ teacher: 0, student: 0 });
      return;
    }

    const { data: senders, error: sendersError } = await supabase
      .from("user_accounts_public")
      .select("id, role")
      .in("id", senderIds);

    if (sendersError) {
      console.error("Unable to load sender roles for unread counts:", sendersError);
      return;
    }

    const counts = { teacher: 0, student: 0 };
    (senders || []).forEach((sender: any) => {
      const role = (sender.role || "").toString().toLowerCase();
      const count = senderCounts[sender.id] || 0;
      if (role === "nauczyciel" || role === "teacher" || role === "admin") {
        counts.teacher += count;
      } else if (role === "uczeń" || role === "student") {
        counts.student += count;
      }
    });

    setUnreadCounts(counts);
  };

  useEffect(() => {
    if (!userId) return;
    loadUnreadCounts();
  }, [userId]);

  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    setShowLogout(false);
  };

  const handleMessagesRead = () => {
    loadUnreadCounts();
  };

  useEffect(() => {
    if (storedGuestMode && storedUserId && storedUserId !== "guest") {
      localStorage.removeItem("guestMode");
      localStorage.removeItem("guestListId");
    }

    if (guestMode) {
      setAuthReady(true);
      return;
    }
    if (!userId) {
      navigate("/login");
      return;
    }

    // Optimistically render the dashboard — if we have a stored userId,
    // we don't need to block on a network round-trip to Supabase.
    setAuthReady(true);

    // Verify session in the background with a hard timeout so a slow/failing
    // backend never keeps the user stuck on a "Ładowanie..." splash.
    const sessionPromise = supabase.auth.getSession();
    const timeout = new Promise<{ data: { session: null }; timedOut: true }>((resolve) =>
      setTimeout(() => resolve({ data: { session: null }, timedOut: true }), 4000),
    );

    Promise.race([sessionPromise, timeout]).then((result: any) => {
      if (result?.timedOut) return; // network too slow, keep user in app
      const session = result?.data?.session;
      if (session) {
        supabase.from("user_profiles").select("avatar_url").eq("user_id", userId).maybeSingle().then(({ data }) => {
          const url = data?.avatar_url || null;
          setAvatarUrl(url);
          if (avatarCacheKey) {
            try {
              if (url) localStorage.setItem(avatarCacheKey, url);
              else localStorage.removeItem(avatarCacheKey);
            } catch {}
          }
        }).catch(() => {});
      } else {
        try {
          localStorage.removeItem("userId");
          localStorage.removeItem("userName");
          localStorage.removeItem("userUsername");
          localStorage.removeItem("userRole");
          localStorage.removeItem("guestMode");
          localStorage.removeItem("guestListId");
        } catch {}
        navigate("/login");
      }
    }).catch(() => {
      // ignore — user already sees the UI
    });
  }, []);

  // Paywall — admin/nauczyciel zawsze, uczeń tylko z aktywnym dostępem
  const access = useAccessGuard();
  useEffect(() => {
    if (guestMode) return;
    if (access.loading) return;
    if (access.reason === "error") {
      return;
    }
    if (!access.hasAccess) navigate("/pricing", { replace: true });
  }, [access.loading, access.hasAccess, access.reason, guestMode, navigate]);


  useEffect(() => {
    if (!userId) return;
    
    const channel = supabase
      .channel(`user_role_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_accounts",
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          try {
            const newRole = (payload.new as any)?.role;
            if (newRole && newRole !== userRole) {
              localStorage.setItem("userRole", newRole);
              const newIsTeacher = newRole === "teacher" || newRole === "nauczyciel";
              const newIsAdmin = newRole === "admin";
              const baseTabs = ["overview", "notes", "calendar", "languages", "tests", "friends", "tips", "ranking", "settings"];
              const roleTabs = newIsAdmin ? ["teacher", "students", "admin_users"] : newIsTeacher ? ["students"] : ["teacher"];
              const allowedTabs = [...baseTabs, ...roleTabs] as Tab[];
              
              if (!allowedTabs.includes(activeTab)) {
                setActiveTab("overview");
              }
            }
          } catch (error) {
            console.error("Error processing role change:", error);
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, userRole, activeTab]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`messages_unread_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => {
          if ((payload.new as any)?.read === false) {
            loadUnreadCounts();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => {
          const newRead = (payload.new as any)?.read;
          const oldRead = (payload.old as any)?.read;
          if (newRead !== oldRead) {
            loadUnreadCounts();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const onAvatarChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ userId: string; url: string | null }>).detail;
      if (detail && detail.userId === userId) setAvatarUrl(detail.url);
    };
    const onStorage = (e: StorageEvent) => {
      if (avatarCacheKey && e.key === avatarCacheKey) setAvatarUrl(e.newValue);
    };
    window.addEventListener("avatar-changed", onAvatarChanged as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("avatar-changed", onAvatarChanged as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, [userId, avatarCacheKey]);

  if (!authReady || (!userId && !guestMode)) {
    return (
      <div style={{ minHeight: "100vh", background: "#060d1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#8899b4", fontSize: "1rem" }}>Ładowanie...</div>
      </div>
    );
  }

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    setShowLogout(false);

    // Reset UI state before logout to avoid stale state while navigating away
    setActiveTab("overview");
    setUnreadCounts({ teacher: 0, student: 0 });
    setPendingEvents([]);
    setInitialNotePageId(null);
    setSidebarOpen(false);
    setAvatarUrl(null);

    try {
      console.log("handleLogout: starting");
      const { timedOut, error } = await logoutUser();
      if (timedOut) {
        toast.warning("Wylogowywanie trwało zbyt długo — zakończono lokalnie");
      } else if (error) {
        toast.warning("Błąd podczas wylogowywania po stronie serwera — zakończono lokalnie");
      } else {
        toast.success("Wylogowano pomyślnie");
      }
      navigate("/", { replace: true });
      console.log("handleLogout: completed", timedOut ? "(timed out)" : error ? "(server error)" : "");
    } catch (err) {
      console.error("handleLogout unexpected exception:", err);
      toast.error("Błąd podczas wylogowywania (sprawdź konsolę)");
      navigate("/", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleEventsExtracted = (events: CalEvent[]) => {
    setPendingEvents(prev => [...prev, ...events]);
  };

  const today = new Date();
  const days = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];
  const months = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
  const dateStr = `${days[today.getDay()]}, ${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;

  const tabMeta: Record<string, { label: string; icon: string }> = {
    overview: { label: "Początek", icon: "🏠" },
    notes: { label: "Notatki", icon: "📝" },
    calendar: { label: "Kalendarz", icon: "📅" },
    languages: { label: "Języki AI", icon: "🌍" },
    tests: { label: "Testy", icon: "📝" },
    teacher: { label: "Nauczyciele", icon: "👨‍🏫" },
    students: { label: "Uczniowie", icon: "👨‍🎓" },
    friends: { label: "Znajomi", icon: "👥" },
    tips: { label: "Porady", icon: "💡" },
    ranking: { label: "Ranking", icon: "🏆" },
    admin_users: { label: "Użytkownicy", icon: "👑" },
    settings: { label: "Ustawienia", icon: "⚙️" },
  };

  const communityTabs: Tab[] = [
    ...(isAdmin ? ["teacher" as Tab, "students" as Tab] : isTeacher ? ["students" as Tab] : ["teacher" as Tab]),
    "friends",
    "tips",
    "ranking",
    ...(isAdmin ? ["admin_users" as Tab] : []),
  ];

  const sidebarItems: { section?: string; tabs: Tab[] }[] = [
    { section: "Główne", tabs: ["overview", "notes", "calendar", "languages", "tests"] },
    { section: "Społeczność", tabs: communityTabs },
    { section: "Konto", tabs: ["settings"] },
  ];

  const isFullWidth = activeTab === "notes" || activeTab === "calendar" || activeTab === "tests" || activeTab === "ranking" || activeTab === "admin_users" || activeTab === "tips";

  return (
    <div className="moc-dashboard">
      {sidebarOpen && <div className="md-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`md-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="md-sb-logo">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ cursor: guestMode ? "pointer" : "default" }} onClick={() => { if (guestMode) { localStorage.removeItem("guestMode"); localStorage.removeItem("guestListId"); localStorage.removeItem("userName"); localStorage.removeItem("userRole"); localStorage.removeItem("userId"); navigate("/"); } }}>
              <div className="md-logo-text">Moc Nauki</div>
              <div className="md-logo-sub">{isAdmin ? "Panel administratora" : isTeacher ? "Panel nauczyciela" : "Panel ucznia"}</div>
            </div>
            <button className="md-sidebar-close" onClick={() => setSidebarOpen(false)}>
              <X size={20} />
            </button>
          </div>
        </div>
        <nav className="md-sb-nav">
          {sidebarItems.map((group, gi) => (
            <div key={gi}>
              {group.section && <div className="md-sb-sec">{group.section}</div>}
              {group.tabs.map((tab) => {
                const badge = getTabBadge(tab);
                const isLocked = isTabLocked(tab);
                const showStrike = guestMode && tab !== "languages";
                return (
                  <div key={tab} className={`md-sb-item ${activeTab === tab ? "active" : ""} ${isLocked ? "guest-disabled" : ""}`} onClick={() => handleTabClick(tab)}>
                    <span className="md-ic">{tabMeta[tab].icon}</span>
                    <span className={showStrike ? "guest-label" : ""}>{tabMeta[tab].label}</span>
                    {badge > 0 && <span className="md-sb-tab-badge">{badge}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>
        {guestMode ? (
          <button
            className="md-btn md-btn-prim"
            style={{ width: "calc(100% - 16px)", margin: "0 8px", fontSize: ".85rem", padding: "10px 12px" }}
            onClick={() => navigate("/register")}
          >
            ✨ Załóż konto
          </button>
        ) : (
          <div
            ref={logoutRef}
            className="md-sb-user"
            style={{ position: "relative", cursor: "pointer" }}
            onClick={() => setShowLogout(prev => !prev)}
          >
            <div className="md-sb-av" style={{ overflow: "hidden" }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt={userName} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              ) : initials}
            </div>
            <div>
              <div className="md-sb-uname">{userName}</div>
              <div className="md-sb-umeta" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  fontSize: ".6rem", fontWeight: 800, padding: "1px 7px", borderRadius: 50,
                  background: roleBadgeBackground,
                  color: roleBadgeTextColor,
                }}>
                  {roleBadgeLabel}
                </span>
              </div>
            </div>
            {showLogout && (
              <div
                style={{
                  position: "absolute", bottom: "100%", left: 8, right: 8, marginBottom: 4,
                  background: "rgba(14,24,48,0.97)", border: "1px solid rgba(248,113,113,0.3)",
                  borderRadius: 10, padding: "6px 0", zIndex: 20,
                }}
              >
                <button
                  className="md-btn md-btn-danger"
                  style={{ width: "calc(100% - 16px)", margin: "0 8px", fontSize: ".8rem", opacity: isLoggingOut ? 0.6 : 1, cursor: isLoggingOut ? "not-allowed" : "pointer" }}
                  disabled={isLoggingOut}
                  onClick={async (e: React.MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation();
                    await handleLogout();
                  }}
                >
                  {isLoggingOut ? "Wylogowywanie..." : "Wyloguj się"}
                </button>
              </div>
            )}
          </div>
        )}
      </aside>

      <div className="md-main">
        <div className="md-mobile-header">
          <button className="md-hamburger" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="md-mobile-title">{tabMeta[activeTab]?.label || activeTab}</div>
        </div>

        {!isFullWidth && activeTab !== "settings" && activeTab !== "friends" && activeTab !== "teacher" && activeTab !== "students" && activeTab !== "languages" && (
          <div className="md-topbar">
            <div className="md-topbar-title">{tabMeta[activeTab]?.label}</div>
          </div>
        )}

        {isFullWidth ? (
          <>
            {activeTab === "notes" && (
              guestMode ? (
                <div className="guest-locked-area">
                  <div className="guest-blur-inner">
                    <NotesTab onEventsExtracted={handleEventsExtracted} userId={userId} guestMode={guestMode} />
                  </div>
                  <div className="guest-lock-overlay">
                    <div className="guest-lock-icon">🔒</div>
                  </div>
                </div>
              ) : (
                <NotesTab
                  onEventsExtracted={handleEventsExtracted}
                  userId={userId}
                  guestMode={guestMode}
                  initialPageId={initialNotePageId}
                  onInitialPageConsumed={() => setInitialNotePageId(null)}
                />
              )
            )}
            {activeTab === "calendar" && (
              guestMode ? (
                <div className="guest-locked-area">
                  <div className="guest-blur-inner">
                    <CalendarTab
                      externalEvents={pendingEvents.length > 0 ? pendingEvents : undefined}
                      onExternalEventsConsumed={() => setPendingEvents([])}
                      userId={userId}
                      guestMode={guestMode}
                    />
                  </div>
                  <div className="guest-lock-overlay">
                    <div className="guest-lock-icon">🔒</div>
                  </div>
                </div>
              ) : (
                <CalendarTab
                  externalEvents={pendingEvents.length > 0 ? pendingEvents : undefined}
                  onExternalEventsConsumed={() => setPendingEvents([])}
                  userId={userId}
                  guestMode={guestMode}
                />
              )
            )}
            {activeTab === "tests" && (
              guestMode ? (
                <div className="guest-locked-area">
                  <div className="guest-blur-inner">
                    <TestsTab userName={userName} guestMode={guestMode} />
                  </div>
                  <div className="guest-lock-overlay">
                    <div className="guest-lock-icon">🔒</div>
                  </div>
                </div>
              ) : (
                <TestsTab userName={userName} />
              )
            )}
            {activeTab === "ranking" && (
              guestMode ? (
                <div className="guest-locked-area">
                  <div className="guest-blur-inner">
                    <RankingTab userName={userName} guestMode={guestMode} />
                  </div>
                  <div className="guest-lock-overlay">
                    <div className="guest-lock-icon">🔒</div>
                  </div>
                </div>
              ) : (
                <RankingTab userName={userName} guestMode={guestMode} />
              )
            )}
            {activeTab === "tips" && (
              guestMode ? (
                <div className="guest-locked-area">
                  <div className="guest-blur-inner">
                    <TipsTab userId={userId} isAdmin={isAdmin} guestMode={guestMode} />
                  </div>
                  <div className="guest-lock-overlay">
                    <div className="guest-lock-icon">🔒</div>
                  </div>
                </div>
              ) : (
                <TipsTab userId={userId} isAdmin={isAdmin} guestMode={guestMode} />
              )
            )}
            {activeTab === "admin_users" && isAdmin && <AdminUsersTab />}
            {activeTab === "admin_users" && !isAdmin && (
              <div style={{ color: "#ef4444", padding: 40, textAlign: "center" }}>
                ❌ Brak dostępu - wymagane uprawnienia administratora
              </div>
            )}
          </>
        ) : (
          <>
            {activeTab === "settings" && (
              guestMode ? (
                <div className="guest-locked-area">
                  <div className="guest-blur-inner">
                    <SettingsTab onNavigateToFriends={() => setActiveTab("friends")} />
                  </div>
                  <div className="guest-lock-overlay">
                    <div className="guest-lock-icon">🔒</div>
                  </div>
                </div>
              ) : (
                <SettingsTab onNavigateToFriends={() => setActiveTab("friends")} />
              )
            )}
            {activeTab === "friends" && (
              guestMode ? (
                <div className="guest-locked-area">
                  <div className="guest-blur-inner">
                    <FriendsTab guestMode={guestMode} />
                  </div>
                  <div className="guest-lock-overlay">
                    <div className="guest-lock-icon">🔒</div>
                  </div>
                </div>
              ) : (
                <FriendsTab guestMode={guestMode} />
              )
            )}
            {activeTab === "teacher" && (
              guestMode ? (
                <div className="guest-locked-area">
                  <div className="guest-blur-inner">
                    <TeacherStudentsTab mode="teacher" onMessagesRead={handleMessagesRead} guestMode={guestMode} />
                  </div>
                  <div className="guest-lock-overlay">
                    <div className="guest-lock-icon">🔒</div>
                  </div>
                </div>
              ) : (
                <TeacherStudentsTab mode="teacher" onMessagesRead={handleMessagesRead} />
              )
            )}
            {activeTab === "students" && (
              guestMode ? (
                <div className="guest-locked-area">
                  <div className="guest-blur-inner">
                    <TeacherStudentsTab mode="student" onMessagesRead={handleMessagesRead} guestMode={guestMode} />
                  </div>
                  <div className="guest-lock-overlay">
                    <div className="guest-lock-icon">🔒</div>
                  </div>
                </div>
              ) : (
                <TeacherStudentsTab mode="student" onMessagesRead={handleMessagesRead} />
              )
            )}
            {activeTab === "overview" && (
              guestMode ? (
                <div className="guest-locked-area">
                  <div className="guest-blur-inner">
                    <OverviewTab
                      onNavigateToNotes={() => setActiveTab("notes")}
                      onNavigateToCalendar={() => setActiveTab("calendar")}
                      onNavigateToLanguages={() => setActiveTab("languages")}
                      guestMode={guestMode}
                    />
                  </div>
                  <div className="guest-lock-overlay">
                    <div className="guest-lock-icon">🔒</div>
                  </div>
                </div>
              ) : (
                <OverviewTab
                  onNavigateToNotes={(pageId) => { if (pageId) setInitialNotePageId(pageId); setActiveTab("notes"); }}
                  onNavigateToCalendar={() => setActiveTab("calendar")}
                  onNavigateToLanguages={() => setActiveTab("languages")}
                />
              )
            )}

            {activeTab === "languages" && <LanguagesTab userId={userId} />}
          </>
        )}
      </div>

      <RecordingWidget activeTab={activeTab} />
    </div>
  );
};

export default MocDashboard;
