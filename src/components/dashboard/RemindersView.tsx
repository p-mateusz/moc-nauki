import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

const COLORS = ["#f87171", "#fb923c", "#fbbf24", "#34d399", "#22d3ee", "#3b82f6", "#6366f1", "#a78bfa", "#f472b6", "#8b8b8b", "#e2e8f0", "#64748b"];

const QUADRANT_ICONS = ["🔴", "🟡", "🔵", "⚪"];
const QUADRANT_SUBTITLES = [
  "Zrób to teraz",
  "Zaplanuj na później",
  "Deleguj komuś",
  "Wyeliminuj",
];

type Props = { userId: string };

const RemindersView = ({ userId }: Props) => {
  const [lists, setLists] = useState<ReminderList[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeList, setActiveList] = useState<ReminderList | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  const [showCompleted, setShowCompleted] = useState(false);
  const [showCompletedMain, setShowCompletedMain] = useState(false);

  const [colorPickerListId, setColorPickerListId] = useState<string | null>(null);

  const [draggedReminderId, setDraggedReminderId] = useState<string | null>(null);
  const [dragOverReminderId, setDragOverReminderId] = useState<string | null>(null);

  const notesRef = React.useRef<HTMLInputElement>(null);
  const titleRef = React.useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);

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

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const remindersForList = useCallback(
    (listId: string) =>
      reminders
        .filter((r) => r.listId === listId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [reminders]
  );

  const persistSortOrders = async (items: Reminder[]) => {
    const updates = items.map((r, i) =>
      supabase
        .from("reminders")
        .update({ sort_order: i })
        .eq("id", r.id)
    );

    await Promise.all(updates);
  };

  const reorderReminders = async (
    draggedId: string,
    targetId: string,
    listId: string
  ) => {
    const listItems = remindersForList(listId);

    const draggedIndex = listItems.findIndex((r) => r.id === draggedId);
    const targetIndex = listItems.findIndex((r) => r.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const updated = [...listItems];
    const [removed] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, removed);

    const reordered = updated.map((r, i) => ({
      ...r,
      sortOrder: i,
    }));

    setReminders((prev) =>
      prev.map((r) => reordered.find((x) => x.id === r.id) || r)
    );

    await persistSortOrders(reordered);
  };

  const addReminder = async () => {
    if (!newTitle.trim() || !activeList) return;

    const sortOrder = remindersForList(activeList.id).length;

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

      setTimeout(() => {
        titleRef.current?.focus();
      }, 40);
    }
  };

  const deleteReminder = async (id: string) => {
    await supabase.from("reminders").delete().eq("id", id);

    setReminders((prev) => prev.filter((r) => r.id !== id));

    toast.success("Usunięto przypomnienie");
  };

  const toggleCompleted = async (r: Reminder) => {
    const newVal = !r.completed;

    await supabase
      .from("reminders")
      .update({ completed: newVal })
      .eq("id", r.id);

    setReminders((prev) =>
      prev.map((x) =>
        x.id === r.id
          ? {
              ...x,
              completed: newVal,
            }
          : x
      )
    );
  };

  const updateReminder = async () => {
    if (!editingReminder) return;

    await supabase
      .from("reminders")
      .update({
        title: editingReminder.title,
        notes: editingReminder.notes,
        due_date: editingReminder.dueDate || null,
      })
      .eq("id", editingReminder.id);

    setReminders((prev) =>
      prev.map((r) =>
        r.id === editingReminder.id ? editingReminder : r
      )
    );

    setEditingReminder(null);

    toast.success("Zapisano");
  };

  const changeListColor = async (
    listId: string,
    color: string
  ) => {
    await supabase
      .from("reminder_lists")
      .update({ color })
      .eq("id", listId);

    setLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? {
              ...l,
              color,
            }
          : l
      )
    );

    setColorPickerListId(null);
  };

  const allCompleted = useMemo(
    () => reminders.filter((r) => r.completed),
    [reminders]
  );

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "#8899b4",
        }}
      >
        Ładowanie przypomnień…
      </div>
    );
  }

  // ─────────────────────────────
  // LIST VIEW
  // ─────────────────────────────

  if (activeList) {
    const items = remindersForList(activeList.id);

    const active = items.filter((r) => !r.completed);
    const completed = items.filter((r) => r.completed);

    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#060d1a",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <button
            onClick={() => {
              setActiveList(null);
              setEditingReminder(null);
            }}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "none",
              color: "#8899b4",
              padding: "6px 12px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: ".85rem",
              fontWeight: 600,
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
              flexShrink: 0,
            }}
          />

          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "1.1rem",
                fontWeight: 800,
                color: "#fff",
              }}
            >
              {activeList.name}
            </div>

            <div
              style={{
                fontSize: ".75rem",
                color: "#8899b4",
              }}
            >
              {QUADRANT_SUBTITLES[activeList.quadrant - 1]} ·{" "}
              {active.length} aktywnych
            </div>
          </div>
        </div>

        {/* Add */}
        <div
          style={{
            padding: "14px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                flexShrink: 0,
                border: `2px solid ${activeList.color}60`,
              }}
            />

            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <input
                ref={titleRef}
                placeholder="Nowe przypomnienie…"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
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
                  background: "transparent",
                  border: "none",
                  color: "#fff",
                  fontSize: ".88rem",
                  fontWeight: 600,
                  fontFamily: "inherit",
                  outline: "none",
                  padding: 0,
                }}
              />

              <input
                ref={notesRef}
                placeholder="Dodaj notatkę…"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addReminder();
                  }
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#8899b4",
                  fontSize: ".76rem",
                  fontFamily: "inherit",
                  outline: "none",
                  padding: 0,
                }}
              />
            </div>
          </div>
        </div>

        {/* Items */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "4px 16px 90px",
          }}
        >
          {active.length === 0 && completed.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: 60,
                color: "#8899b4",
                fontSize: ".9rem",
              }}
            >
              Brak przypomnień w tej liście
            </div>
          )}

          {active.map((r) => (
            <ReminderRow
              key={r.id}
              r={r}
              color={activeList.color}
              onToggle={() => toggleCompleted(r)}
              onEdit={() => setEditingReminder(r)}
              onDelete={() => deleteReminder(r.id)}
              isEditing={editingReminder?.id === r.id}
              editingReminder={editingReminder}
              setEditingReminder={setEditingReminder}
              onSaveEdit={updateReminder}
              draggable
              isDragged={draggedReminderId === r.id}
              isDragOver={dragOverReminderId === r.id}
              onDragStart={() => setDraggedReminderId(r.id)}
              onDragEnd={() => {
                setDraggedReminderId(null);
                setDragOverReminderId(null);
              }}
              onDragOver={() => setDragOverReminderId(r.id)}
              onDrop={async () => {
                if (
                  draggedReminderId &&
                  draggedReminderId !== r.id
                ) {
                  await reorderReminders(
                    draggedReminderId,
                    r.id,
                    activeList.id
                  );
                }

                setDraggedReminderId(null);
                setDragOverReminderId(null);
              }}
            />
          ))}

          {completed.length > 0 && (
            <>
              <button
                onClick={() =>
                  setShowCompleted(!showCompleted)
                }
                style={{
                  background: "none",
                  border: "none",
                  color: "#8899b4",
                  cursor: "pointer",
                  fontSize: ".78rem",
                  fontWeight: 700,
                  padding: "12px 8px 6px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    transform: showCompleted
                      ? "rotate(90deg)"
                      : "rotate(0deg)",
                    transition: ".2s",
                    display: "inline-block",
                  }}
                >
                  ▶
                </span>

                Ukończone ({completed.length})
              </button>

              {showCompleted &&
                completed.map((r) => (
                  <ReminderRow
                    key={r.id}
                    r={r}
                    color={activeList.color}
                    onToggle={() => toggleCompleted(r)}
                    onEdit={() => setEditingReminder(r)}
                    onDelete={() => deleteReminder(r.id)}
                    isEditing={editingReminder?.id === r.id}
                    editingReminder={editingReminder}
                    setEditingReminder={setEditingReminder}
                    onSaveEdit={updateReminder}
                  />
                ))}
            </>
          )}
        </div>

        {/* FAB */}
        <button
          onClick={() => titleRef.current?.focus()}
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: activeList.color,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 4px 20px ${activeList.color}60`,
            zIndex: 20,
            transition: "transform .15s",
          }}
        >
          <span
            style={{
              color: "#fff",
              fontSize: "1.7rem",
              lineHeight: 1,
              fontWeight: 300,
            }}
          >
            +
          </span>
        </button>
      </div>
    );
  }

  // ─────────────────────────────
  // MAIN GRID
  // ─────────────────────────────

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#060d1a",
        padding: 20,
      }}
    >
      <div
        style={{
          fontSize: ".78rem",
          color: "#8899b4",
          marginBottom: 18,
        }}
      >
        Macierz Eisenhowera — zarządzaj priorytetami
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          flex: 1,
          minHeight: 0,
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
                borderRadius: 18,
                padding: 20,
                cursor: "pointer",
                transition: ".2s",
                display: "flex",
                flexDirection: "column",
                position: "relative",
                overflow: "hidden",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform =
                  "translateY(-2px)";
                e.currentTarget.style.borderColor = `${list.color}70`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform =
                  "translateY(0px)";
                e.currentTarget.style.borderColor = `${list.color}35`;
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -30,
                  right: -30,
                  width: 100,
                  height: 100,
                  borderRadius: "50%",
                  background: `${list.color}18`,
                  filter: "blur(30px)",
                }}
              />

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    background: `${list.color}28`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.1rem",
                  }}
                >
                  {QUADRANT_ICONS[list.quadrant - 1]}
                </div>

                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: ".9rem",
                      fontWeight: 800,
                      color: list.color,
                    }}
                  >
                    {list.name}
                  </div>

                  <div
                    style={{
                      fontSize: ".68rem",
                      color: "#8899b4",
                    }}
                  >
                    {
                      QUADRANT_SUBTITLES[
                        list.quadrant - 1
                      ]
                    }
                  </div>
                </div>
              </div>

              {colorPickerListId === list.id && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    marginBottom: 10,
                  }}
                >
                  {COLORS.map((c) => (
                    <div
                      key={c}
                      onClick={() =>
                        changeListColor(list.id, c)
                      }
                      style={{
                        width: 22,
                        height: 22,
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
                  fontSize: "2rem",
                  fontWeight: 900,
                  color: list.color,
                  lineHeight: 1,
                  marginBottom: 5,
                }}
              >
                {activeCount}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontSize: ".72rem",
                    color: "#8899b4",
                  }}
                >
                  {activeCount === 1
                    ? "przypomnienie"
                    : activeCount >= 2 &&
                      activeCount <= 4
                    ? "przypomnienia"
                    : "przypomnień"}
                </span>

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
                    opacity: 0.55,
                  }}
                />
              </div>

              <div style={{ marginTop: 8 }}>
                {items
                  .filter((r) => !r.completed)
                  .slice(0, 3)
                  .map((r) => (
                    <div
                      key={r.id}
                      style={{
                        marginTop: 7,
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        fontSize: ".73rem",
                        color: "#c8d8f0",
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
                          textOverflow: "ellipsis",
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

      {allCompleted.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button
            onClick={() =>
              setShowCompletedMain(!showCompletedMain)
            }
            style={{
              background: "none",
              border: "none",
              color: "#8899b4",
              cursor: "pointer",
              fontSize: ".78rem",
              fontWeight: 700,
              padding: "8px 4px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              width: "100%",
            }}
          >
            <span
              style={{
                transform: showCompletedMain
                  ? "rotate(90deg)"
                  : "rotate(0deg)",
                transition: ".2s",
                display: "inline-block",
              }}
            >
              ▶
            </span>

            Ukończone ({allCompleted.length})
          </button>

          {showCompletedMain && (
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                borderRadius: 12,
                padding: "4px 8px",
                maxHeight: 180,
                overflowY: "auto",
              }}
            >
              {allCompleted.map((r) => {
                const list = lists.find(
                  (l) => l.id === r.listId
                );

                return (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      fontSize: ".76rem",
                    }}
                  >
                    <button
                      onClick={() => toggleCompleted(r)}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        border: `2px solid ${
                          list?.color || "#8899b4"
                        }`,
                        background:
                          list?.color || "#8899b4",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          color: "#fff",
                          fontSize: ".55rem",
                          fontWeight: 900,
                        }}
                      >
                        ✓
                      </span>
                    </button>

                    <span
                      style={{
                        color: "#8899b4",
                        textDecoration: "line-through",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.title}
                    </span>

                    <span
                      style={{
                        fontSize: ".65rem",
                        color: "#555e6e",
                      }}
                    >
                      {list?.name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────
// ROW
// ─────────────────────────────

const ReminderRow = ({
  r,
  color,
  onToggle,
  onEdit,
  onDelete,
  isEditing,
  editingReminder,
  setEditingReminder,
  onSaveEdit,
  draggable,
  isDragged,
  isDragOver,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  r: Reminder;
  color: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isEditing: boolean;
  editingReminder: Reminder | null;
  setEditingReminder: (r: Reminder | null) => void;
  onSaveEdit: () => void;

  draggable?: boolean;
  isDragged?: boolean;
  isDragOver?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: () => void;
  onDrop?: () => void;
}) => {
  if (isEditing && editingReminder) {
    return (
      <div
        style={{
          padding: "12px 14px",
          margin: "4px 0",
          borderRadius: 12,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
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
          onKeyDown={(e) => {
            if (e.key === "Enter") onSaveEdit();
          }}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            color: "#fff",
            fontSize: ".85rem",
            fontWeight: 600,
            fontFamily: "inherit",
            outline: "none",
            marginBottom: 4,
            padding: 0,
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
          rows={2}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            color: "#8899b4",
            fontSize: ".76rem",
            fontFamily: "inherit",
            outline: "none",
            resize: "none",
            marginBottom: 8,
            padding: 0,
          }}
        />

        <div
          style={{
            display: "flex",
            gap: 6,
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={() => setEditingReminder(null)}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "none",
              color: "#8899b4",
              padding: "5px 12px",
              borderRadius: 7,
              cursor: "pointer",
              fontSize: ".78rem",
            }}
          >
            Anuluj
          </button>

          <button
            onClick={onSaveEdit}
            style={{
              background: color,
              border: "none",
              color: "#fff",
              padding: "5px 12px",
              borderRadius: 7,
              cursor: "pointer",
              fontSize: ".78rem",
              fontWeight: 700,
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
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver?.();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.();
      }}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 12px",
        margin: "2px 0",
        borderRadius: 12,
        transition: ".15s",
        opacity: isDragged ? 0.3 : r.completed ? 0.5 : 1,
        background: isDragOver
          ? "rgba(255,255,255,0.05)"
          : "transparent",
        border: isDragOver
          ? `1px dashed ${color}`
          : "1px solid transparent",
      }}
      onMouseEnter={(e) => {
        if (!isDragOver) {
          e.currentTarget.style.background =
            "rgba(255,255,255,0.04)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragOver) {
          e.currentTarget.style.background = "transparent";
        }
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          flexShrink: 0,
          marginTop: 1,
          border: r.completed
            ? `2px solid ${color}`
            : `2px solid ${color}80`,
          background: r.completed ? color : "transparent",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: ".15s",
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
            fontSize: ".85rem",
            fontWeight: 600,
            color: r.completed ? "#8899b4" : "#fff",
            textDecoration: r.completed
              ? "line-through"
              : "none",
          }}
        >
          {r.title}
        </div>

        {r.notes && (
          <div
            style={{
              fontSize: ".73rem",
              color: "#8899b4",
              marginTop: 2,
              lineHeight: 1.4,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {r.notes}
          </div>
        )}

        {r.dueDate && (
          <div
            style={{
              fontSize: ".7rem",
              color: color,
              marginTop: 3,
              fontWeight: 600,
            }}
          >
            📅 {r.dueDate}
          </div>
        )}
      </div>

      <button
        onClick={onDelete}
        style={{
          background: "transparent",
          border: "none",
          color: "#ef4444",
          cursor: "pointer",
          fontSize: ".9rem",
          opacity: 0.6,
          padding: "2px 4px",
          transition: ".15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "0.6";
        }}
      >
        ✕
      </button>
    </div>
  );
};

export default RemindersView;