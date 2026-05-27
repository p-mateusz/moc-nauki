import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { LoadingInline } from "@/components/ui/loading-state";

// ── Reminder Types ──
type ReminderList = {
  id: string;
  quadrant: number;
  name: string;
  color: string;
};

type Reminder = {
  id: string;
  listId: string;
  title: string;
  notes: string;
  completed: boolean;
  dueDate: string | null;
  priority: number;
  sortOrder: number;
};

// ── Constants ──
const COLORS = [
  "#f87171",
  "#fb923c",
  "#fbbf24",
  "#34d399",
  "#22d3ee",
  "#3b82f6",
  "#6366f1",
  "#a78bfa",
  "#f472b6",
  "#8b8b8b",
  "#e2e8f0",
  "#64748b",
];

const QUADRANT_ICONS = ["🔴", "🟡", "🔵", "⚪"];

const QUADRANT_SUBTITLES = [
  "Zrób to teraz",
  "Zaplanuj na później",
  "Deleguj komuś",
  "Wyeliminuj",
];

function todayISO() {
  const d = new Date();

  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function isoAddDays(iso: string, n: number) {
  const d = new Date(iso);

  d.setDate(d.getDate() + n);

  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function calcStreak(days: string[]) {
  if (!days?.length) {
    return { current: 0, best: 0, total: 0 };
  }

  const sorted = [...new Set(days)].sort();

  let current = 0;
  let best = 0;
  let streak = 1;

  const today = todayISO();
  const yesterday = isoAddDays(today, -1);
  const lastDay = sorted[sorted.length - 1];

  if (lastDay === today || lastDay === yesterday) {
    current = 1;

    for (let i = sorted.length - 2; i >= 0; i--) {
      if (isoAddDays(sorted[i + 1], -1) === sorted[i]) {
        current++;
      } else {
        break;
      }
    }
  }

  streak = 1;

  for (let i = 1; i < sorted.length; i++) {
    if (isoAddDays(sorted[i], -1) === sorted[i - 1]) {
      streak++;
    } else {
      streak = 1;
    }

    if (streak > best) {
      best = streak;
    }
  }

  if (current > best) {
    best = current;
  }

  if (best === 0 && sorted.length) {
    best = 1;
  }

  return {
    current,
    best,
    total: sorted.length,
  };
}

function buildHeatmapCells(days: string[]) {
  const set = new Set(days || []);
  const today = new Date();

  const cells: {
    iso: string;
    active: boolean;
    isToday: boolean;
    future: boolean;
  }[] = [];

  const startDate = new Date(today);

  startDate.setDate(startDate.getDate() - 104);

  const dow = startDate.getDay();

  startDate.setDate(startDate.getDate() - ((dow + 6) % 7));

  for (let i = 0; i < 105; i++) {
    const d = new Date(startDate);

    d.setDate(d.getDate() + i);

    const iso =
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0");

    cells.push({
      iso,
      active: set.has(iso),
      isToday: iso === todayISO(),
      future: d > today,
    });
  }

  return cells;
}

interface OverviewTabProps {
  onNavigateToNotes?: (pageId?: string) => void;
  onNavigateToCalendar?: () => void;
  onNavigateToLanguages?: () => void;
  onNavigateToTests?: () => void;
  onNavigateToLanguagesTab?: () => void;
  guestMode?: boolean;
}

type RecentNote = {
  id: string;
  title: string;
  sectionName: string;
  notebookName: string;
  modified: string;
  notebookColor: string;
};

const OverviewTab = ({
  onNavigateToNotes,
  onNavigateToCalendar,
  onNavigateToLanguages,
  onNavigateToTests,
  onNavigateToLanguagesTab,
  guestMode,
}: OverviewTabProps) => {
  // ── Reminders state ──
  const [lists, setLists] = useState<ReminderList[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [activeList, setActiveList] = useState<ReminderList | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const [editingReminder, setEditingReminder] =
    useState<Reminder | null>(null);

  const [showCompleted, setShowCompleted] = useState(false);

  const [colorPickerListId, setColorPickerListId] = useState<string | null>(
    null
  );

  // ── Activity & notes state ──
  const [activityDays, setActivityDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentNotes, setRecentNotes] = useState<RecentNote[]>([]);

  const userId = localStorage.getItem("userId") || "";
  const userName = localStorage.getItem("userName") || "Uczeń";

  const notesRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const remindersForList = useCallback(
    (listId: string) => reminders.filter((r) => r.listId === listId),
    [reminders]
  );

  // ── Reminders functions ──
  const loadRemindersData = useCallback(async () => {
    await supabase.rpc("create_default_reminder_lists", {
      p_user_id: userId,
    });

    const [listsRes, remRes] = await Promise.all([
      supabase
        .from("reminder_lists")
        .select("*")
        .eq("user_id", userId)
        .order("quadrant"),

      supabase
        .from("reminders")
        .select("*")
        .eq("user_id", userId)
        .order("sort_order"),
    ]);

    if (listsRes.data) {
      setLists(
        listsRes.data.map((l: any) => ({
          id: l.id,
          quadrant: l.quadrant,
          name: l.name,
          color: l.color,
        }))
      );
    }

    if (remRes.data) {
      setReminders(
        remRes.data.map((r: any) => ({
          id: r.id,
          listId: r.list_id,
          title: r.title,
          notes: r.notes || "",
          completed: r.completed,
          dueDate: r.due_date,
          priority: r.priority,
          sortOrder: r.sort_order,
        }))
      );
    }
  }, [userId]);

  const addReminder = async () => {
    if (!newTitle.trim() || !activeList) {
      return;
    }

    const sortOrder = remindersForList(activeList.id).length;

    if (guestMode) {
      const localReminder: Reminder = {
        id: `guest-${Date.now()}`,
        listId: activeList.id,
        title: newTitle.trim(),
        notes: newNotes.trim(),
        completed: false,
        dueDate: null,
        priority: 0,
        sortOrder,
      };

      setReminders((prev) => [...prev, localReminder]);

      setNewTitle("");
      setNewNotes("");

      setTimeout(() => titleRef.current?.focus(), 50);

      return;
    }

    const { data, error } = await supabase
      .from("reminders")
      .insert({
        user_id: userId,
        list_id: activeList.id,
        title: newTitle.trim(),
        notes: newNotes.trim(),
        due_date: null,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (error) {
      toast.error("Błąd dodawania");
      return;
    }

    if (data) {
      setReminders((prev) => [
        ...prev,
        {
          id: data.id,
          listId: data.list_id,
          title: data.title,
          notes: data.notes || "",
          completed: data.completed,
          dueDate: data.due_date,
          priority: data.priority,
          sortOrder: data.sort_order,
        },
      ]);

      setNewTitle("");
      setNewNotes("");

      setTimeout(() => titleRef.current?.focus(), 50);
    }
  };

  const toggleCompleted = async (r: Reminder) => {
    const newVal = !r.completed;

    if (!guestMode) {
      await supabase
        .from("reminders")
        .update({ completed: newVal })
        .eq("id", r.id);
    }

    setReminders((prev) =>
      prev.map((x) =>
        x.id === r.id ? { ...x, completed: newVal } : x
      )
    );
  };

  const updateReminder = async () => {
    if (!editingReminder) {
      return;
    }

    if (!guestMode) {
      await supabase
        .from("reminders")
        .update({
          title: editingReminder.title,
          notes: editingReminder.notes,
          due_date: editingReminder.dueDate || null,
        })
        .eq("id", editingReminder.id);
    }

    setReminders((prev) =>
      prev.map((r) =>
        r.id === editingReminder.id ? editingReminder : r
      )
    );

    setEditingReminder(null);

    toast.success("Zapisano");
  };

  const deleteReminder = async (id: string) => {
    const old = reminders;

    setReminders((prev) => prev.filter((r) => r.id !== id));

    if (!guestMode) {
      const { error } = await supabase
        .from("reminders")
        .delete()
        .eq("id", id);

      if (error) {
        setReminders(old);
        toast.error("Nie udało się usunąć");
        return;
      }
    }

    toast.success("Usunięto");
  };

  const changeListColor = async (
    listId: string,
    color: string
  ) => {
    if (!guestMode) {
      await supabase
        .from("reminder_lists")
        .update({ color })
        .eq("id", listId);
    }

    setLists((prev) =>
      prev.map((l) =>
        l.id === listId ? { ...l, color } : l
      )
    );

    setColorPickerListId(null);
  };

  // ── Activity & notes functions ──
  const loadActivity = async () => {
    try {
      const { data } = await supabase
        .from("activity_days")
        .select("date")
        .eq("user_id", userId);

      if (data) {
        setActivityDays(data.map((d) => d.date));
      }
    } catch (err) {
      console.error("Błąd przy ładowaniu aktywności:", err);
    }
  };

  const loadRecentNotes = async () => {
    try {
      const { data: notebooks } = await supabase
        .from("notebooks")
        .select("id, name, color")
        .eq("user_id", userId);

      if (!notebooks?.length) {
        setRecentNotes([]);
        return;
      }

      const nbIds = notebooks.map((n) => n.id);

      const { data: sections } = await supabase
        .from("notebook_sections")
        .select("id, name, notebook_id")
        .in("notebook_id", nbIds);

      if (!sections?.length) {
        setRecentNotes([]);
        return;
      }

      const secIds = sections.map((s) => s.id);

      const { data: pages } = await supabase
        .from("notebook_pages")
        .select("id, title, modified_at, section_id")
        .in("section_id", secIds)
        .order("modified_at", { ascending: false })
        .limit(5);

      if (!pages?.length) {
        setRecentNotes([]);
        return;
      }

      const notes = pages.map((page: any) => {
        const section = sections.find(
          (s) => s.id === page.section_id
        );

        const notebook = section
          ? notebooks.find(
              (n) => n.id === section.notebook_id
            )
          : null;

        return {
          id: page.id,
          title: page.title || "Bez tytułu",
          sectionName: section?.name || "Sekcja",
          notebookName: notebook?.name || "Notes",
          notebookColor: notebook?.color || "#3b82f6",
          modified: new Date(page.modified_at).toLocaleDateString(
            "pl-PL",
            {
              month: "short",
              day: "numeric",
            }
          ),
        };
      });

      setRecentNotes(notes);
    } catch (err) {
      console.error("Błąd przy ładowaniu notatek:", err);
      setRecentNotes([]);
    }
  };

  const recordTodayActivity = async () => {
    try {
      const today = todayISO();

      await supabase.from("activity_days").upsert(
        {
          user_id: userId,
          date: today,
        },
        {
          onConflict: "user_id,date",
        }
      );
    } catch (err) {
      console.error("Błąd przy zapisie aktywności:", err);
    }
  };

  useEffect(() => {
    if (guestMode) {
      const demoLists: ReminderList[] = [
        {
          id: "g-l1",
          quadrant: 1,
          name: "Pilne, ważne",
          color: "#f87171",
        },
        {
          id: "g-l2",
          quadrant: 2,
          name: "Niepilne, ważne",
          color: "#fbbf24",
        },
        {
          id: "g-l3",
          quadrant: 3,
          name: "Pilne, nieważne",
          color: "#3b82f6",
        },
        {
          id: "g-l4",
          quadrant: 4,
          name: "Niepilne, nieważne",
          color: "#8b8b8b",
        },
      ];

      const demoReminders: Reminder[] = [
        {
          id: "g-r1",
          listId: "g-l1",
          title: "Powtórka do sprawdzianu z matematyki",
          notes: "Funkcje kwadratowe, delta, wzory Viete",
          completed: false,
          dueDate: null,
          priority: 0,
          sortOrder: 0,
        },
      ];

      const demoRecentNotes: RecentNote[] = [
        {
          id: "demo-note-1",
          title: "Fotosynteza",
          sectionName: "Biologia",
          notebookName: "Szkoła",
          notebookColor: "#34d399",
          modified: "15 maj",
        },
        {
          id: "demo-note-2",
          title: "Wzory skróconego mnożenia",
          sectionName: "Matematyka",
          notebookName: "Matura",
          notebookColor: "#3b82f6",
          modified: "14 maj",
        },
      ];

      const demoActivity: string[] = [
        todayISO(),
        isoAddDays(todayISO(), -1),
        isoAddDays(todayISO(), -2),
        isoAddDays(todayISO(), -4),
        isoAddDays(todayISO(), -6),
        isoAddDays(todayISO(), -7),
        isoAddDays(todayISO(), -8),
      ];

      setLists(demoLists);
      setReminders(demoReminders);
      setRecentNotes(demoRecentNotes);
      setActivityDays(demoActivity);

      setLoading(false);

      return;
    }

    if (!userId) {
      setLoading(false);
      return;
    }

    Promise.all([
      loadRemindersData(),
      loadActivity(),
      loadRecentNotes(),
      recordTodayActivity(),
    ]).then(() => setLoading(false));
  }, [
    userId,
    guestMode,
    loadRemindersData,
  ]);

  if (loading) {
    return (
      <div className="md-content">
        <LoadingInline minHeight={260} />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // ── ACTIVE LIST VIEW
  // ─────────────────────────────────────────────────────────────

  if (activeList) {
    const items = remindersForList(activeList.id);

    const active = items.filter((r) => !r.completed);

    const completed = items.filter((r) => r.completed);

    return (
      <div
        className="md-content"
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100%",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <button
            onClick={() => {
              setActiveList(null);
              setEditingReminder(null);
            }}
            style={{
              border: "none",
              background: "rgba(255,255,255,0.06)",
              color: "#cdd6e7",
              borderRadius: 10,
              padding: "8px 12px",
              cursor: "pointer",
              fontSize: ".8rem",
              fontWeight: 700,
            }}
          >
            ← Wróć
          </button>

          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 4,
              background: activeList.color,
            }}
          />

          <div style={{ flex: 1 }}>
            <div
              style={{
                color: "#fff",
                fontWeight: 800,
                fontSize: "1rem",
              }}
            >
              {activeList.name}
            </div>

            <div
              style={{
                color: "#8899b4",
                fontSize: ".72rem",
                marginTop: 2,
              }}
            >
              {
                QUADRANT_SUBTITLES[
                  activeList.quadrant - 1
                ]
              }{" "}
              · {active.length} aktywnych
            </div>
          </div>
        </div>

        {/* ADD */}
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            padding: 14,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                border: `2px solid ${activeList.color}80`,
                marginTop: 3,
                flexShrink: 0,
              }}
            />

            <div style={{ flex: 1 }}>
              <input
                ref={titleRef}
                placeholder="Nowe przypomnienie…"
                value={newTitle}
                onChange={(e) =>
                  setNewTitle(e.target.value)
                }
                onKeyDown={(e) => {
                  if (
                    e.key === "Tab" &&
                    !e.shiftKey &&
                    newTitle.trim()
                  ) {
                    e.preventDefault();
                    notesRef.current?.focus();
                  }

                  if (e.key === "Enter") {
                    e.preventDefault();
                    addReminder();
                  }
                }}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#fff",
                  fontSize: ".88rem",
                  fontWeight: 700,
                  fontFamily: "inherit",
                  marginBottom: 6,
                }}
              />

              <input
                ref={notesRef}
                placeholder="Dodaj notatkę…"
                value={newNotes}
                onChange={(e) =>
                  setNewNotes(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addReminder();
                  }
                }}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#8899b4",
                  fontSize: ".75rem",
                  fontFamily: "inherit",
                }}
              />
            </div>
          </div>
        </div>

        {/* ACTIVE */}
        <div>
          {active.map((r) => (
            <ReminderRow
              key={r.id}
              r={r}
              color={activeList.color}
              onToggle={() => toggleCompleted(r)}
              onDelete={() => deleteReminder(r.id)}
              onEdit={() => setEditingReminder(r)}
              isEditing={editingReminder?.id === r.id}
              editingReminder={editingReminder}
              setEditingReminder={setEditingReminder}
              onSaveEdit={updateReminder}
            />
          ))}
        </div>

        {/* COMPLETED */}
        {completed.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <button
              onClick={() =>
                setShowCompleted(!showCompleted)
              }
              style={{
                border: "none",
                background: "none",
                color: "#8899b4",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 700,
                fontSize: ".76rem",
                padding: 0,
              }}
            >
              <span
                style={{
                  transform: showCompleted
                    ? "rotate(90deg)"
                    : "rotate(0deg)",
                  transition: ".2s",
                }}
              >
                ▶
              </span>

              Ukończone ({completed.length})
            </button>

            {showCompleted && (
              <div style={{ marginTop: 10 }}>
                {completed.map((r) => (
                  <ReminderRow
                    key={r.id}
                    r={r}
                    color={activeList.color}
                    onToggle={() => toggleCompleted(r)}
                    onDelete={() =>
                      deleteReminder(r.id)
                    }
                    onEdit={() =>
                      setEditingReminder(r)
                    }
                    isEditing={
                      editingReminder?.id === r.id
                    }
                    editingReminder={
                      editingReminder
                    }
                    setEditingReminder={
                      setEditingReminder
                    }
                    onSaveEdit={updateReminder}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── MAIN VIEW ──
  const streak = calcStreak(activityDays);
  const heatmapCells = buildHeatmapCells(activityDays);

  return (
    <div className="md-content">
      {/* ─── HEADER ─── */}
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "1.4rem",
              fontWeight: 900,
              color: "#fff",
              marginBottom: 6,
            }}
          >
            👋 Witaj, {userName}
          </div>

          <div
            style={{
              fontSize: ".85rem",
              color: "#8899b4",
            }}
          >
            Miło Cię znowu widzieć ✨
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {onNavigateToCalendar && (
            <button
              onClick={onNavigateToCalendar}
              style={quickButtonStyle}
            >
              📅 Kalendarz
            </button>
          )}

          {onNavigateToTests && (
            <button
              onClick={onNavigateToTests}
              style={quickButtonStyle}
            >
              📝 Testy
            </button>
          )}

          {onNavigateToLanguagesTab && (
            <button
              onClick={onNavigateToLanguagesTab}
              style={quickButtonStyle}
            >
              🌍 Języki
            </button>
          )}
        </div>
      </div>

      {/* ─── REMINDERS ─── */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: ".78rem",
            color: "#8899b4",
            marginBottom: 14,
            fontWeight: 700,
          }}
        >
          🎯 Rzeczy do zrobienia
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          {lists.map((list) => {
            const items = remindersForList(list.id);

            const activeCount = items.filter(
              (r) => !r.completed
            ).length;

            return (
              <div
                key={list.id}
                onClick={() => setActiveList(list)}
                style={{
                  background: `linear-gradient(145deg, ${list.color}18 0%, ${list.color}08 100%)`,
                  border: `1px solid ${list.color}35`,
                  borderRadius: 12,
                  padding: 16,
                  cursor: "pointer",
                  transition: "all .2s",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: -20,
                    right: -20,
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: `${list.color}15`,
                    filter: "blur(20px)",
                    pointerEvents: "none",
                  }}
                />

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: `${list.color}30`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1rem",
                    }}
                  >
                    {QUADRANT_ICONS[list.quadrant - 1]}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: ".82rem",
                        fontWeight: 700,
                        color: list.color,
                        filter: "brightness(1.3)",
                      }}
                    >
                      {list.name}
                    </div>

                    <div
                      style={{
                        fontSize: ".65rem",
                        color: "#8899b4",
                        marginTop: 2,
                      }}
                    >
                      {
                        QUADRANT_SUBTITLES[
                          list.quadrant - 1
                        ]
                      }
                    </div>
                  </div>

                  <div
                    onClick={(e) => {
                      e.stopPropagation();

                      setColorPickerListId(
                        colorPickerListId === list.id
                          ? null
                          : list.id
                      );
                    }}
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: list.color,
                      cursor: "pointer",
                      opacity: 0.7,
                    }}
                  />
                </div>

                {colorPickerListId === list.id && (
                  <div
                    onClick={(e) =>
                      e.stopPropagation()
                    }
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      marginBottom: 12,
                    }}
                  >
                    {COLORS.map((c) => (
                      <div
                        key={c}
                        onClick={() =>
                          changeListColor(
                            list.id,
                            c
                          )
                        }
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          background: c,
                          cursor: "pointer",
                          border:
                            c === list.color
                              ? "2px solid #fff"
                              : "2px solid transparent",
                        }}
                      />
                    ))}
                  </div>
                )}

                <div
                  style={{
                    fontSize: "1.8rem",
                    fontWeight: 900,
                    color: list.color,
                    filter: "brightness(1.2)",
                    marginBottom: 6,
                    lineHeight: 1,
                  }}
                >
                  {activeCount}
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    marginTop: 2,
                  }}
                >
                  {items
                    .filter((r) => !r.completed)
                    .slice(0, 3)
                    .map((r) => (
                      <div
                        key={r.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: ".7rem",
                          color: "#cdd6e7",
                          opacity: 0.85,
                        }}
                      >
                        <div
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: list.color,
                            flexShrink: 0,
                          }}
                        />

                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow:
                              "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {r.title}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── RECENT NOTES ─── */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: ".82rem",
            fontWeight: 800,
            color: "#fff",
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          📚 Ostatnie notatki
        </div>

        {recentNotes.length === 0 ? (
          <div
            style={{
              background: "rgba(14,24,48,0.5)",
              border:
                "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: 18,
              textAlign: "center",
              color: "#8899b4",
              fontSize: ".85rem",
            }}
          >
            Brak notatek. Zacznij od{" "}
            <strong>Notatek</strong> 📝
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 12,
            }}
          >
            {recentNotes.slice(0, 3).map((note) => (
              <div
                key={note.id}
                onClick={() =>
                  onNavigateToNotes?.(note.id)
                }
                style={{
                  background:
                    "rgba(14,24,48,0.7)",
                  border:
                    "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  padding: 14,
                  cursor: "pointer",
                  transition: ".2s",
                  borderLeft: `3px solid ${note.notebookColor}`,
                }}
              >
                <div
                  style={{
                    fontSize: ".9rem",
                    fontWeight: 700,
                    color: "#e0e8f5",
                    marginBottom: 4,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {note.title}
                </div>

                <div
                  style={{
                    fontSize: ".72rem",
                    color: "#8899b4",
                    marginBottom: 6,
                  }}
                >
                  {note.notebookName} ›{" "}
                  {note.sectionName}
                </div>

                <div
                  style={{
                    fontSize: ".65rem",
                    color: "#6b7a96",
                  }}
                >
                  {note.modified}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── STREAK ─── */}
      <div
        style={{
          background: "rgba(14,24,48,0.85)",
          border:
            "1px solid rgba(255,255,255,0.08)",
          borderRadius: 14,
          padding: "20px 24px",
        }}
      >
        <div
          style={{
            fontSize: ".72rem",
            fontWeight: 800,
            color: "#8899b4",
            textTransform: "uppercase",
            letterSpacing: "1.2px",
            marginBottom: 16,
          }}
        >
          🔥 Systematyczność nauki
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 8,
            marginBottom: 18,
          }}
        >
          <StreakStatCard
            icon="🔥"
            num={streak.current}
            label="Obecna passa"
            gradient="linear-gradient(135deg,#f59e0b,#f87171)"
          />

          <StreakStatCard
            icon="🏆"
            num={streak.best}
            label="Rekord z rzędu"
            gradient="linear-gradient(135deg,#a78bfa,#6366f1)"
          />

          <StreakStatCard
            icon="📆"
            num={streak.total}
            label="Łącznie dni"
            gradient="linear-gradient(135deg,#34d399,#3b82f6)"
          />
        </div>

        {(() => {
          const activeSet = new Set(activityDays || []);
          const last14 = heatmapCells
            .filter((c) => !c.future)
            .slice(-14);
          const dowLabels = ["N", "P", "W", "Ś", "C", "P", "S"];
          const goal = Math.max(7, streak.best || 7);
          const pct = Math.min(
            100,
            Math.round((streak.current / goal) * 100),
          );
          return (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 8,
                  fontSize: ".68rem",
                  color: "#8899b4",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: ".8px",
                }}
              >
                <span>Ostatnie 14 dni</span>
                <span style={{ textTransform: "none", letterSpacing: 0 }}>
                  {streak.current}/{goal} dni do rekordu
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(14, minmax(0,1fr))",
                  gap: 4,
                  marginBottom: 12,
                }}
              >
                {last14.map((c, i) => {
                  const d = new Date(c.iso);
                  const label = dowLabels[d.getDay()];
                  const active = activeSet.has(c.iso);
                  return (
                    <div
                      key={i}
                      title={c.iso + (active ? " ✓" : "")}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          aspectRatio: "1 / 1",
                          maxHeight: 28,
                          borderRadius: 8,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: ".75rem",
                          background: active
                            ? "linear-gradient(135deg,#f59e0b,#ef4444)"
                            : "rgba(255,255,255,0.05)",
                          border: c.isToday
                            ? "1.5px solid rgba(99,102,241,0.85)"
                            : "1px solid rgba(255,255,255,0.06)",
                          boxShadow: active
                            ? "0 4px 12px -4px rgba(239,68,68,0.45)"
                            : "none",
                        }}
                      >
                        {active ? "🔥" : ""}
                      </div>
                      <div
                        style={{
                          fontSize: ".55rem",
                          color: c.isToday ? "#a5b4fc" : "#6b7a96",
                          fontWeight: 700,
                        }}
                      >
                        {label}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  height: 8,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.05)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background:
                      "linear-gradient(90deg,#f59e0b,#ef4444,#a78bfa)",
                    transition: "width .4s ease",
                  }}
                />
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

const ReminderRow = ({
  r,
  color,
  onToggle,
  onDelete,
  onEdit,
  isEditing,
  editingReminder,
  setEditingReminder,
  onSaveEdit,
}: {
  r: Reminder;
  color: string;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
  isEditing: boolean;
  editingReminder: Reminder | null;
  setEditingReminder: (r: Reminder | null) => void;
  onSaveEdit: () => void;
}) => {
  if (isEditing && editingReminder) {
    return (
      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          border:
            "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: 14,
          marginBottom: 10,
        }}
      >
        <input
          value={editingReminder.title}
          onChange={(e) =>
            setEditingReminder({
              ...editingReminder,
              title: e.target.value,
            })
          }
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#fff",
            fontWeight: 700,
            fontSize: ".86rem",
            marginBottom: 8,
            fontFamily: "inherit",
          }}
        />

        <textarea
          value={editingReminder.notes}
          onChange={(e) =>
            setEditingReminder({
              ...editingReminder,
              notes: e.target.value,
            })
          }
          placeholder="Notatka…"
          rows={3}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#8899b4",
            resize: "none",
            fontSize: ".76rem",
            marginBottom: 10,
            fontFamily: "inherit",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            onClick={() =>
              setEditingReminder(null)
            }
            style={{
              border: "none",
              background: "rgba(255,255,255,0.06)",
              color: "#8899b4",
              borderRadius: 8,
              padding: "7px 12px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: ".75rem",
            }}
          >
            Anuluj
          </button>

          <button
            onClick={onSaveEdit}
            style={{
              border: "none",
              background: color,
              color: "#fff",
              borderRadius: 8,
              padding: "7px 12px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: ".75rem",
            }}
          >
            Zapisz
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        padding: "10px 12px",
        borderRadius: 12,
        transition: ".15s",
        opacity: r.completed ? 0.55 : 1,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background =
          "rgba(255,255,255,0.04)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background =
          "transparent";
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          border: r.completed
            ? `2px solid ${color}`
            : `2px solid ${color}70`,
          background: r.completed
            ? color
            : "transparent",
          cursor: "pointer",
          flexShrink: 0,
          marginTop: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {r.completed && (
          <span
            style={{
              color: "#fff",
              fontSize: ".65rem",
              fontWeight: 900,
            }}
          >
            ✓
          </span>
        )}
      </button>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          cursor: "pointer",
        }}
        onClick={onEdit}
      >
        <div
          style={{
            fontSize: ".84rem",
            fontWeight: 700,
            color: r.completed
              ? "#8899b4"
              : "#fff",
            textDecoration: r.completed
              ? "line-through"
              : "none",
          }}
        >
          {r.title}
        </div>

        {!!r.notes && (
          <div
            style={{
              fontSize: ".73rem",
              color: "#8899b4",
              marginTop: 3,
              lineHeight: 1.4,
              whiteSpace: "pre-wrap",
            }}
          >
            {r.notes}
          </div>
        )}
      </div>

      <button
        onClick={onDelete}
        style={{
          border: "none",
          background: "transparent",
          color: "#ef4444",
          cursor: "pointer",
          fontSize: ".9rem",
          opacity: 0.65,
        }}
      >
        ✕
      </button>
    </div>
  );
};

const StreakStatCard = ({
  icon,
  num,
  label,
  gradient,
}: {
  icon: string;
  num: number;
  label: string;
  gradient: string;
}) => (
  <div
    style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 11,
      padding: "10px 6px",
      textAlign: "center",
      minWidth: 0,
    }}
  >
    <div
      style={{
        fontSize: ".85rem",
        marginBottom: 2,
      }}
    >
      {icon}
    </div>

    <div
      style={{
        fontSize: "1.15rem",
        fontWeight: 900,
        lineHeight: 1,
        marginBottom: 4,
        background: gradient,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
      }}
    >
      {num}
    </div>

    <div
      style={{
        fontSize: ".6rem",
        color: "#8899b4",
        fontWeight: 600,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {label}
    </div>
  </div>
);

const quickButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  color: "#e2e8f0",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontSize: ".8rem",
  fontWeight: 700,
  transition: ".2s",
};

export default OverviewTab;