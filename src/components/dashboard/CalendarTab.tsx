import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Menu } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { LoadingInline } from "@/components/ui/loading-state";
import { useIsMobile } from "@/hooks/use-mobile";

// ── Interaction types ──
type GhostEvent = {
  date: string;
  startMin: number;
  endMin: number;
  allDay: boolean;
  title: string;
  editing: boolean;
};
type DragMode = "create" | "resize" | "move" | null;
type DragState = {
  mode: DragMode;
  eventId?: string;
  startY: number;
  startMin: number;
  origStartMin?: number;
  origEndMin?: number;
  date: string;
  origDate?: string;
  masterStart?: string;
  masterEnd?: string;
  dayColWidth?: number;
  dayColsLeft?: number;
  daysOffsets?: { date: string; left: number; right: number }[];
  grabOffsetMin?: number;
};

// ── Types ──
export type CalEvent = {
  id: string;
  name: string;
  type: string;
  subject: string;
  date: string;
  time: string;
  note: string;
  source?: string;
  sourceTitle?: string;
  autoAdded?: boolean;
};

type UserCalendar = {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  sortOrder: number;
};

type CalendarEvent = {
  id: string;
  title: string;
  calId: string;
  start: string; // date YYYY-MM-DD
  startTime: string;
  end: string;
  endTime: string;
  allDay: boolean;
  location: string;
  desc: string;
  repeat: string;
  repeatEnd: string;
  seriesId?: string;
  exceptionDates?: string[];
  autoAdded?: boolean;
  source?: string;
  sourceTitle?: string;
};

type ScopeChoice = "single" | "future" | "all";

type CalendarTabProps = {
  externalEvents?: CalEvent[];
  onExternalEventsConsumed?: () => void;
  userId: string;
  guestMode?: boolean;
};

// ── Constants ──
const DAY_NAMES_SHORT = ["Ndz", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"];
const DAY_NAMES_FULL = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];
const MONTH_NAMES = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
const MONTH_NAMES_GEN = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
const COLORS = ["#6366f1", "#3b82f6", "#22d3ee", "#34d399", "#fbbf24", "#fb923c", "#f87171", "#f472b6", "#a78bfa", "#e2e8f0"];
const RECURRENCE_META_PREFIX = "__mn_calendar_meta__:";

function isoDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function pad(n: number) { return String(n).padStart(2, "0"); }
function parseDate(s: string) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfWeek(d: Date) { const r = new Date(d); const day = r.getDay(); r.setDate(r.getDate() - (day === 0 ? 6 : day - 1)); return r; }
function timeToMin(t: string) { if (!t) return 0; const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); }
function readRecurrenceMeta(source?: string | null): { seriesId?: string; exceptionDates: string[] } {
  if (!source?.startsWith(RECURRENCE_META_PREFIX)) return { exceptionDates: [] };
  try {
    const parsed = JSON.parse(source.slice(RECURRENCE_META_PREFIX.length));
    return {
      seriesId: typeof parsed.seriesId === "string" ? parsed.seriesId : undefined,
      exceptionDates: Array.isArray(parsed.exceptionDates) ? parsed.exceptionDates.filter((d: unknown) => typeof d === "string") : [],
    };
  } catch {
    return { exceptionDates: [] };
  }
}
function writeRecurrenceMeta(ev: CalendarEvent) {
  const exceptionDates = ev.exceptionDates || [];
  if (!ev.seriesId && exceptionDates.length === 0) return ev.source || null;
  return `${RECURRENCE_META_PREFIX}${JSON.stringify({ seriesId: ev.seriesId || null, exceptionDates })}`;
}
function visibleSource(source?: string | null) { return source?.startsWith(RECURRENCE_META_PREFIX) ? undefined : source || undefined; }

function occursOn(e: CalendarEvent, dateStr: string): boolean {
  if (e.exceptionDates && e.exceptionDates.includes(dateStr)) return false;
  if (e.allDay) {
    const d = parseDate(dateStr), start = parseDate(e.start), end = parseDate(e.end || e.start);
    return d >= start && d <= end;
  }
  if (e.start === dateStr) return true;
  const sm = timeToMin(e.startTime || "00:00"), em = timeToMin(e.endTime || "00:00");
  if (e.endTime && em <= sm && sm > 0) {
    const startD = parseDate(e.start), checkD = parseDate(dateStr);
    if (Math.round((checkD.getTime() - startD.getTime()) / 86400000) === 1) return true;
  }
  if (e.repeat && e.repeat !== "none") {
    const d = parseDate(dateStr), start = parseDate(e.start);
    if (d <= start) return false;
    const repeatEnd = e.repeatEnd ? parseDate(e.repeatEnd) : new Date(2099, 0, 1);
    if (d > repeatEnd) return false;
    const diff = Math.round((d.getTime() - start.getTime()) / 86400000);
    if (e.repeat === "daily") return true;
    if (e.repeat === "weekly") return diff % 7 === 0;
    if (e.repeat === "biweekly") return diff % 14 === 0;
    if (e.repeat === "monthly") return d.getDate() === start.getDate();
    if (e.repeat === "yearly") return d.getDate() === start.getDate() && d.getMonth() === start.getMonth();
    if (e.repeat === "weekdays") { const wd = d.getDay(); return wd >= 1 && wd <= 5; }
  }
  return false;
}

function getEventSegment(e: CalendarEvent, dateStr: string) {
  const startMin = timeToMin(e.startTime || "00:00");
  const endMin = timeToMin(e.endTime || "00:00");
  const isStart = e.start === dateStr;
  if (endMin > startMin || !e.endTime) {
    const top = startMin / 1440 * 1152;
    const height = Math.max((endMin - startMin) / 1440 * 1152, 12);
    return { top, height, isContinuation: false, isOverflow: false };
  }
  if (isStart) {
    const top = startMin / 1440 * 1152;
    const height = Math.max((1440 - startMin) / 1440 * 1152, 12);
    return { top, height, isContinuation: false, isOverflow: true };
  }
  const height = Math.max(endMin / 1440 * 1152, 12);
  return { top: 0, height, isContinuation: true, isOverflow: false };
}

function addDaysToStr(s: string, n: number) { const d = parseDate(s); d.setDate(d.getDate() + n); return isoDate(d); }
function diffDays(a: string, b: string) { return Math.round((parseDate(a).getTime() - parseDate(b).getTime()) / 86400000); }

// ══════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════
const CalendarTab = ({ externalEvents, onExternalEventsConsumed, userId, guestMode }: CalendarTabProps) => {
  const todayStr = isoDate(new Date());
  const [calendars, setCalendars] = useState<UserCalendar[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"week" | "month" | "reminders">("week");
  const [cursor, setCursor] = useState(new Date());
  const [miniCursor, setMiniCursor] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");

  // Quick popup state
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickDs, setQuickDs] = useState(todayStr);
  const [quickStartTime, setQuickStartTime] = useState("09:00");
  const [quickEndTime, setQuickEndTime] = useState("10:00");
  const [quickAllDay, setQuickAllDay] = useState(false);
  const [quickCalId, setQuickCalId] = useState("");
  const [quickRepeat, setQuickRepeat] = useState("none");
  const [quickRepeatEnd, setQuickRepeatEnd] = useState("");
  const [quickDesc, setQuickDesc] = useState("");
  const [quickPos, setQuickPos] = useState({ left: 0, top: 0 });

  // Detail popup
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  const [detailPos, setDetailPos] = useState({ left: 0, top: 0 });
  const [detailOccDate, setDetailOccDate] = useState<string | null>(null);
  const [editOccDate, setEditOccDate] = useState<string | null>(null);

  // Recurring scope dialog ("this / this+future / all")
  const [scopeDialog, setScopeDialog] = useState<null | {
    title: string;
    confirmLabel: string;
    onConfirm: (choice: ScopeChoice) => void | Promise<void>;
  }>(null);
  const [scopeChoice, setScopeChoice] = useState<ScopeChoice>("single");


  // Full modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState("");
  const [modalStartDate, setModalStartDate] = useState(todayStr);
  const [modalStartTime, setModalStartTime] = useState("");
  const [modalEndDate, setModalEndDate] = useState(todayStr);
  const [modalEndTime, setModalEndTime] = useState("");
  const [modalAllDay, setModalAllDay] = useState(false);
  const [modalCalId, setModalCalId] = useState("");
  const [modalLocation, setModalLocation] = useState("");
  const [modalDesc, setModalDesc] = useState("");
  const [modalRepeat, setModalRepeat] = useState("none");
  const [modalRepeatEnd, setModalRepeatEnd] = useState("");

  // Calendar modal
  const [calModalOpen, setCalModalOpen] = useState(false);
  const [calEditId, setCalEditId] = useState<string | null>(null);
  const [calName, setCalName] = useState("");
  const [calColor, setCalColor] = useState("#6366f1");
  const [calSidebarOpen, setCalSidebarOpen] = useState(false);
  const weekBodyRef = useRef<HTMLDivElement>(null);
  const weekHScrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const VISIBLE_DAYS_MOBILE = 4;
  const MOBILE_GUTTER_W = 32;
  const [hScrollerW, setHScrollerW] = useState(0);
  const [sliderVal, setSliderVal] = useState(0);
  const syncingScrollRef = useRef(false);
  

  // ── Drag / ghost interaction state ──
  const [ghost, setGhost] = useState<GhostEvent | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [, forceUpdate] = useState(0);

  const HOUR_H = 48; // px per hour
  const TOTAL_H = 24 * HOUR_H; // 1152

  const yToMin = (y: number) => Math.max(0, Math.min(1440, (y / TOTAL_H) * 1440));
  const snapMin = (m: number, step = 15) => Math.round(m / step) * step;
  const minToTime = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
  const snapTimeTo15 = (t: string) => { const m = timeToMin(t); return minToTime(snapMin(m)); };

  // Generate 15-min time options
  const timeOptions = useMemo(() => {
    const opts: string[] = [];
    for (let m = 0; m < 1440; m += 15) opts.push(minToTime(m));
    return opts;
  }, []);

  // ── Load data ──
  const loadData = useCallback(async () => {
    if (guestMode) {
      // Demo calendars (5 colors)
      const demoCalendars: UserCalendar[] = [
        { id: "demo1", name: "Praca", color: "#6266F1", visible: true, sortOrder: 1 },
        { id: "demo2", name: "Szkoła", color: "#3A82F5", visible: true, sortOrder: 2 },
        { id: "demo3", name: "Ważne", color: "#F67170", visible: true, sortOrder: 3 },
        { id: "demo4", name: "Inne", color: "#FBBE24", visible: true, sortOrder: 4 },
        { id: "demo5", name: "Sport", color: "#34D39A", visible: true, sortOrder: 5 },
      ];
      setCalendars(demoCalendars);
      setQuickCalId("demo1");

      // Build dense weekly schedule: 4–6 events per day
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday

      // Per-day templates (Mon=1 ... Sun=0)
      type Slot = { title: string; calId: string; s: string; e: string; loc?: string; desc?: string };
      const slotsByDow: Record<number, Slot[]> = {
        1: [ // Poniedziałek
          { title: "Dojazd", calId: "demo2", s: "08:00", e: "08:15" },
          { title: "Szkoła", calId: "demo2", s: "08:15", e: "13:45" },
          { title: "Próba", calId: "demo2", s: "14:15", e: "15:45" },
          { title: "Dojazd", calId: "demo2", s: "15:45", e: "16:00" },
          { title: "Dojazd", calId: "demo2", s: "17:15", e: "18:00" },
          { title: "Pianino", calId: "demo1", s: "18:00", e: "19:30" },
          { title: "Dojazd", calId: "demo2", s: "19:30", e: "20:15" },
        ],
        2: [ // Wtorek
          { title: "Dojazd", calId: "demo2", s: "07:15", e: "07:30" },
          { title: "Szkoła", calId: "demo2", s: "07:30", e: "14:45" },
          { title: "Próba", calId: "demo2", s: "14:45", e: "16:45" },
          { title: "Dojazd", calId: "demo2", s: "16:45", e: "17:00" },
          { title: "Angielski", calId: "demo5", s: "17:00", e: "18:00" },
        ],
        3: [ // Środa
         { title: "Dojazd", calId: "demo2", s: "08:00", e: "08:15" },
          { title: "Szkoła", calId: "demo2", s: "08:15", e: "15:30" },
          { title: "Siłownia", calId: "demo5", s: "15:45", e: "17:15" },
          { title: "Dojazd", calId: "demo2", s: "17:15", e: "17:30" },
          { title: "Dojazd", calId: "demo2", s: "18:00", e: "18:30" },
          { title: "Matematyka Olimpijska", calId: "demo1", s: "18:30", e: "20:30" },
          { title: "Dojazd", calId: "demo2", s: "20:30", e: "21:00" },
        ],
        4: [ // Czwartek
          { title: "Dojazd", calId: "demo2", s: "08:00", e: "08:15" },
          { title: "Szkoła", calId: "demo2", s: "08:15", e: "15:30" },
          { title: "Siłownia", calId: "demo5", s: "15:45", e: "17:15" },
          { title: "Dojazd", calId: "demo2", s: "17:15", e: "17:30" },
        ],
        5: [ // Piątek
          { title: "Dojazd", calId: "demo2", s: "08:00", e: "08:15" },
          { title: "Business", calId: "demo2", s: "08:15", e: "09:00" },
          { title: "Szkoła", calId: "demo2", s: "09:00", e: "13:45" },
          { title: "Chór", calId: "demo3", s: "14:00", e: "16:00" },
          { title: "Dojazd", calId: "demo2", s: "16:00", e: "16:15" },
          { title: "Angielski", calId: "demo1", s: "17:00", e: "18:00" },
          
        ],
        6: [ // Sobota
          { title: "Dojazd", calId: "demo2", s: "08:15", e: "09:00" },
          { title: "Teleskopy", calId: "demo1", s: "09:00", e: "13:15" },
          { title: "Dojazd", calId: "demo2", s: "13:15", e: "14:00" },
        ],
        0: [ // Niedziela
          { title: "Dojazd", calId: "demo2", s: "09:30", e: "10:00" },
          { title: "Wiosła", calId: "demo5", s: "10:00", e: "12:00" },
          { title: "Dojazd", calId: "demo2", s: "12:00", e: "13:30" },
          { title: "Dojazd", calId: "demo4", s: "17:30", e: "18:00" },
          { title: "Kościół", calId: "demo4", s: "18:00", e: "19:00" },
          { title: "Dojazd", calId: "demo4", s: "19:00", e: "19:30" },
        ],
      };

      const demoEvents: CalendarEvent[] = [];
      // Generate for current week + next week to fill view
      for (let weekOffset = -1; weekOffset <= 2; weekOffset++) {
        for (let i = 0; i < 7; i++) {
          const date = new Date(startOfWeek);
          date.setDate(startOfWeek.getDate() + i + weekOffset * 7);
          const dateStr = isoDate(date);
          const dow = date.getDay();
          const slots = slotsByDow[dow] || [];
          slots.forEach((sl, idx) => {
            demoEvents.push({
              id: `demo-${weekOffset}-${i}-${idx}`,
              title: sl.title,
              calId: sl.calId,
              start: dateStr,
              startTime: sl.s,
              end: dateStr,
              endTime: sl.e,
              allDay: false,
              location: sl.loc || "",
              desc: sl.desc || "",
              repeat: "none",
              repeatEnd: "",
            });
          });
        }
      }

      setEvents(demoEvents);
      setLoading(false);
      return;
    }

    // Ensure default calendars exist
    await supabase.rpc("create_default_calendars", { p_user_id: userId });

    const [calRes, evRes] = await Promise.all([
      supabase.from("user_calendars").select("*").eq("user_id", userId).order("sort_order"),
      supabase.from("calendar_events").select("*").eq("user_id", userId).order("date"),
    ]);

    if (calRes.data) {
      setCalendars(calRes.data.map((c: any) => ({
        id: c.id, name: c.name, color: c.color, visible: c.visible, sortOrder: c.sort_order,
      })));
      if (calRes.data.length > 0) setQuickCalId(calRes.data[0].id);
    }

    if (evRes.data) {
      setEvents(evRes.data.map((e: any) => {
        const meta = readRecurrenceMeta(e.source);
        return {
          id: e.id,
          title: e.name,
          calId: e.calendar_id || "",
          start: e.date,
          startTime: e.time || "",
          end: e.end_date || e.date,
          endTime: e.end_time || "",
          allDay: e.all_day || false,
          location: e.location || "",
          desc: e.description || e.note || "",
          repeat: e.repeat_type || "none",
          repeatEnd: e.repeat_end || "",
          seriesId: e.series_id || meta.seriesId,
          exceptionDates: e.exception_dates || meta.exceptionDates,
          autoAdded: e.auto_added,
          source: visibleSource(e.source),
          sourceTitle: e.source_title || undefined,
        };
      }));
    }
    setLoading(false);
  }, [userId, guestMode]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── External events (from notes) ──
  useEffect(() => {
    if (!externalEvents?.length || !calendars.length) return;
    const newOnes = externalEvents.filter(ne => !events.some(e => e.title === ne.name && e.start === ne.date));
    if (newOnes.length > 0) {
      const defaultCalId = calendars[0]?.id;
      const rows = newOnes.map(e => ({
        user_id: userId,
        name: e.name,
        type: e.type,
        subject: e.subject,
        date: e.date,
        time: e.time || "",
        note: e.note || "",
        source: e.source || null,
        source_title: e.sourceTitle || null,
        auto_added: e.autoAdded || false,
        all_day: false,
        end_date: e.date,
        end_time: "",
        location: "",
        description: "",
        repeat_type: "none",
        repeat_end: "",
        calendar_id: defaultCalId,
      }));
      supabase.from("calendar_events").insert(rows).select().then(({ data }) => {
        if (data) {
          const mapped = data.map((e: any) => ({
            id: e.id, title: e.name, calId: e.calendar_id || "", start: e.date,
            startTime: e.time || "", end: e.end_date || e.date, endTime: e.end_time || "",
            allDay: e.all_day, location: e.location || "", desc: e.description || e.note || "",
            repeat: e.repeat_type || "none", repeatEnd: e.repeat_end || "",
            autoAdded: e.auto_added, source: e.source || undefined, sourceTitle: e.source_title || undefined,
          }));
          setEvents(prev => [...prev, ...mapped]);
        }
      });
    }
    onExternalEventsConsumed?.();
  }, [externalEvents]);

  // ── Helpers ──
  const visibleCalIds = useMemo(() => new Set(calendars.filter(c => c.visible).map(c => c.id)), [calendars]);

  const visibleEvents = useMemo(() => events.filter(e => !e.calId || visibleCalIds.has(e.calId)), [events, visibleCalIds]);

  const eventsForDate = useCallback((ds: string) => {
    return visibleEvents.filter(e => occursOn(e, ds)).sort((a, b) => {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      return (a.startTime || "").localeCompare(b.startTime || "");
    });
  }, [visibleEvents]);

  const calColor_ = useCallback((e: CalendarEvent) => {
    const c = calendars.find(x => x.id === e.calId);
    return c?.color || "#6366f1";
  }, [calendars]);

  // ── Navigation ──
  const navPrev = () => {
    if (view === "month") setCursor(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    else if (view === "week") setCursor(prev => addDays(prev, -7));
    else if (view === "reminders") return;
  };
  const navNext = () => {
    if (view === "month") setCursor(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    else if (view === "week") setCursor(prev => addDays(prev, 7));
    else if (view === "reminders") return;
  };
  const goToday = () => { const now = new Date(); setCursor(now); setMiniCursor(now); };

  const topbarTitle = useMemo(() => {
    if (view === "month") return `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;
    if (view === "week") {
      const ws = startOfWeek(cursor), we = addDays(ws, 6);
      if (ws.getMonth() === we.getMonth()) return `${ws.getDate()}–${we.getDate()} ${MONTH_NAMES[ws.getMonth()]} ${ws.getFullYear()}`;
      return `${ws.getDate()} ${MONTH_NAMES[ws.getMonth()]} – ${we.getDate()} ${MONTH_NAMES[we.getMonth()]} ${ws.getFullYear()}`;
    }
    return "Przypomnienia";
  }, [view, cursor]);

  // ── Scroll to 8:00 ──
  useEffect(() => {
    if (view === "week") {
      setTimeout(() => {
        const target8am = (8 * 60) / 1440 * TOTAL_H;
        if (isMobile && weekHScrollRef.current) {
          weekHScrollRef.current.scrollTop = Math.max(0, target8am);
        } else if (weekBodyRef.current) {
          weekBodyRef.current.scrollTop = Math.max(0, target8am);
        }
      }, 100);
    }
  }, [view, cursor, loading, isMobile]);

  // ── Mobile horizontal scroller measurement & sync ──
  useEffect(() => {
    if (!isMobile || view !== "week") return;
    const el = weekHScrollRef.current;
    if (!el) return;
    const update = () => setHScrollerW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobile, view]);

  const handleHScroll = () => {
    if (syncingScrollRef.current) return;
    const el = weekHScrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setSliderVal(maxScroll > 0 ? Math.round((el.scrollLeft / maxScroll) * 1000) : 0);
  };

  const onSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setSliderVal(v);
    const el = weekHScrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    syncingScrollRef.current = true;
    el.scrollLeft = (v / 1000) * maxScroll;
    requestAnimationFrame(() => { syncingScrollRef.current = false; });
  };


  // ── CRUD ──
  const saveEventToDB = async (ev: CalendarEvent, isEdit: boolean) => {
    // All these columns are NOT NULL in DB (with '' defaults) — coerce
    // undefined/null to '' so inserts never fail with NOT NULL violations.
    const row: any = {
      user_id: userId,
      name: ev.title,
      date: ev.start || "",
      time: ev.startTime || "",
      end_date: ev.end || ev.start || "",
      end_time: ev.endTime || "",
      all_day: !!ev.allDay,
      location: ev.location || "",
      description: ev.desc || "",
      repeat_type: ev.repeat || "none",
      repeat_end: ev.repeatEnd || "",
      calendar_id: ev.calId || null,
      auto_added: false,
      type: "inne",
      subject: "",
      note: ev.desc || "",
      source: writeRecurrenceMeta(ev),
      source_title: ev.sourceTitle || null,
    };
    if (isEdit) {
      const { error } = await supabase.from("calendar_events").update(row).eq("id", ev.id);
      if (error) {
        console.error("calendar_events update error:", error);
        toast.error(`Błąd zapisu wydarzenia: ${error.message}`);
        return null;
      }
      return ev;
    } else {
      const { data, error } = await supabase.from("calendar_events").insert(row).select().single();
      if (error || !data) {
        console.error("calendar_events insert error:", error);
        toast.error(`Błąd zapisu wydarzenia: ${error?.message || "nieznany błąd"}`);
        return null;
      }
      const d: any = data;
      const meta = readRecurrenceMeta(d.source);
      return { ...ev, id: d.id, seriesId: d.series_id || meta.seriesId, exceptionDates: d.exception_dates || meta.exceptionDates };
    }
  };

  const deleteEventRaw = async (id: string) => {
    await supabase.from("calendar_events").delete().eq("id", id);
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  const deleteEventFromDB = async (id: string, occDate?: string | null) => {
    const ev = events.find(e => e.id === id);
    if (ev && ev.repeat && ev.repeat !== "none") {
      const od = occDate || ev.start;
      setDetailEvent(null);
      openScopeDialog("Usuń wydarzenie cykliczne", "Usuń", async (choice) => {
        if (choice === "all") {
          await deleteEventRaw(id);
        } else if (choice === "single") {
          const newExceptions = Array.from(new Set([...(ev.exceptionDates || []), od]));
          const updated: CalendarEvent = { ...ev, exceptionDates: newExceptions };
          await saveEventToDB(updated, true);
          setEvents(prev => prev.map(e => e.id === id ? updated : e));
        } else if (choice === "future") {
          const cutoff = addDaysToStr(od, -1);
          if (parseDate(cutoff) < parseDate(ev.start)) {
            await deleteEventRaw(id);
          } else {
            const updated: CalendarEvent = { ...ev, repeatEnd: cutoff };
            await saveEventToDB(updated, true);
            setEvents(prev => prev.map(e => e.id === id ? updated : e));
          }
        }
        toast.info("🗑 Usunięto wydarzenie");
      });
      return;
    }
    await deleteEventRaw(id);
    setDetailEvent(null);
    toast.info("🗑 Usunięto wydarzenie");
  };


  // ── Quick popup ──
  const openQuickPopup = (ds: string, startTime?: string, endTime?: string, allDay = false) => {
    setQuickDs(ds);
    setQuickStartTime(startTime || "09:00");
    setQuickEndTime(endTime || "10:00");
    setQuickAllDay(allDay);
    setQuickTitle("");
    setQuickRepeat("none");
    setQuickRepeatEnd("");
    setQuickDesc("");
    setQuickCalId(calendars[0]?.id || "");
    setQuickPos({ left: Math.max(4, (window.innerWidth - 340) / 2), top: Math.max(4, (window.innerHeight - 380) / 2) });
    setQuickOpen(true);
  };

  const quickSave = async () => {
    if (!quickTitle.trim()) return;
    const ev: CalendarEvent = {
      id: "", title: quickTitle.trim(), calId: quickCalId,
      start: quickDs, startTime: quickAllDay ? "" : quickStartTime,
      end: quickDs, endTime: quickAllDay ? "" : quickEndTime,
      allDay: quickAllDay, location: "", desc: quickDesc.trim(),
      repeat: quickRepeat, repeatEnd: quickRepeatEnd,
    };
    const saved = await saveEventToDB(ev, false);
    if (saved) {
      setEvents(prev => [...prev, saved]);
      setQuickOpen(false);
      toast.success("✅ Wydarzenie dodane");
    }
  };

  // ── Full modal ──
  const openEditModal = (ev: CalendarEvent, occDate?: string | null) => {
    setEditingId(ev.id);
    setEditOccDate(occDate || null);
    setModalTitle(ev.title);
    // For recurring events: pre-fill date fields with the occurrence date the
    // user actually clicked, not the series master start. This way "to wydarzenie"
    // edits the right day, and even "wszystkie" preserves intent.
    const baseDate = (ev.repeat && ev.repeat !== "none" && occDate) ? occDate : ev.start;
    const endDate = (ev.repeat && ev.repeat !== "none" && occDate) ? occDate : (ev.end || ev.start);
    setModalStartDate(baseDate);
    setModalStartTime(ev.startTime);
    setModalEndDate(endDate);
    setModalEndTime(ev.endTime);
    setModalAllDay(ev.allDay);
    setModalCalId(ev.calId);
    setModalLocation(ev.location);
    setModalDesc(ev.desc);
    setModalRepeat(ev.repeat);
    setModalRepeatEnd(ev.repeatEnd);
    setModalOpen(true);
    setDetailEvent(null);
  };

  const openScopeDialog = (title: string, confirmLabel: string, onConfirm: (c: ScopeChoice) => void | Promise<void>) => {
    setScopeChoice("single");
    setScopeDialog({ title, confirmLabel, onConfirm });
  };

  // Apply an edit to a recurring event according to user-chosen scope.
  // `master` is the current series event in state, `occDate` is the date of the
  // clicked occurrence, `newEv` is the edited payload (with new fields, but its
  // start/end are already aligned to occDate when scope is "single").
  const applyRecurringEdit = async (master: CalendarEvent, occDate: string, newEv: CalendarEvent, choice: ScopeChoice) => {
    if (choice === "all") {
      // Apply only non-date fields to the master. Keep master.start/end intact
      // so previous occurrences don't disappear or shift unexpectedly.
      const updated: CalendarEvent = {
        ...master,
        title: newEv.title, calId: newEv.calId, allDay: newEv.allDay,
        location: newEv.location, desc: newEv.desc,
        startTime: newEv.startTime, endTime: newEv.endTime,
        repeat: newEv.repeat, repeatEnd: newEv.repeatEnd,
      };
      const saved = await saveEventToDB(updated, true);
      if (saved) setEvents(prev => prev.map(e => e.id === master.id ? updated : e));
      return;
    }
    if (choice === "single") {
      // Add occDate to exceptions of master, create a standalone event for the edit.
      const newExceptions = Array.from(new Set([...(master.exceptionDates || []), occDate]));
      const masterUpdated: CalendarEvent = { ...master, exceptionDates: newExceptions };
      await saveEventToDB(masterUpdated, true);
      const standalone: CalendarEvent = {
        ...newEv,
        id: "",
        repeat: "none", repeatEnd: "",
        seriesId: master.seriesId || master.id,
        exceptionDates: [],
      };
      const saved = await saveEventToDB(standalone, false);
      setEvents(prev => {
        const next = prev.map(e => e.id === master.id ? masterUpdated : e);
        if (saved) next.push(saved);
        return next;
      });
      return;
    }
    if (choice === "future") {
      // If user picked "future" on (or before) the very first occurrence,
      // it's equivalent to "all" — just update master in place to avoid
      // creating a duplicate event on that day.
      if (parseDate(occDate) <= parseDate(master.start)) {
        const updated: CalendarEvent = {
          ...master,
          title: newEv.title, calId: newEv.calId, allDay: newEv.allDay,
          location: newEv.location, desc: newEv.desc,
          startTime: newEv.startTime, endTime: newEv.endTime,
          repeat: newEv.repeat, repeatEnd: newEv.repeatEnd,
          start: newEv.start, end: newEv.end || newEv.start,
        };
        const saved = await saveEventToDB(updated, true);
        if (saved) setEvents(prev => prev.map(e => e.id === master.id ? updated : e));
        return;
      }
      // Truncate master at the day before occDate, create a new series from newEv.start.
      const cutoff = addDaysToStr(occDate, -1);
      const masterUpdated: CalendarEvent = { ...master, repeatEnd: cutoff };
      await saveEventToDB(masterUpdated, true);
      const newSeries: CalendarEvent = {
        ...newEv,
        id: "",
        start: newEv.start,
        end: newEv.end || newEv.start,
        repeat: newEv.repeat || master.repeat,
        repeatEnd: master.repeatEnd && parseDate(master.repeatEnd) >= parseDate(newEv.start) ? master.repeatEnd : "",
        seriesId: undefined, // new series
        exceptionDates: (master.exceptionDates || []).filter(d => parseDate(d) >= parseDate(newEv.start)),
      };
      const saved = await saveEventToDB(newSeries, false);
      setEvents(prev => {
        const next = prev.map(e => e.id === master.id ? masterUpdated : e);
        if (saved) next.push(saved);
        return next;
      });
      return;
    }
  };

  const saveModal = async () => {
    if (!modalTitle.trim()) { toast.warning("Podaj tytuł!"); return; }
    const ev: CalendarEvent = {
      id: editingId || "", title: modalTitle.trim(), calId: modalCalId,
      start: modalStartDate, startTime: modalAllDay ? "" : modalStartTime,
      end: modalEndDate, endTime: modalAllDay ? "" : modalEndTime,
      allDay: modalAllDay, location: modalLocation.trim(), desc: modalDesc.trim(),
      repeat: modalRepeat, repeatEnd: modalRepeatEnd,
    };
    // Recurring edit → ask scope first (only if something actually changed)
    if (editingId) {
      const master = events.find(e => e.id === editingId);
      if (master && master.repeat && master.repeat !== "none") {
        const occDate = editOccDate || master.start;
        const noDateChange = ev.start === occDate && (ev.end || ev.start) === occDate;
        const unchanged =
          ev.title === master.title &&
          ev.calId === master.calId &&
          ev.allDay === master.allDay &&
          ev.location === master.location &&
          ev.desc === master.desc &&
          ev.startTime === master.startTime &&
          ev.endTime === master.endTime &&
          ev.repeat === master.repeat &&
          ev.repeatEnd === master.repeatEnd &&
          noDateChange;
        if (unchanged) {
          setModalOpen(false);
          return;
        }
        setModalOpen(false);
        openScopeDialog("Edytowanie wydarzenia cyklicznego", "Zapisz", async (choice) => {
          await applyRecurringEdit(master, occDate, ev, choice);
          toast.success("✅ Zapisano zmiany");
        });
        return;
      }
    }
    const saved = await saveEventToDB(ev, !!editingId);
    if (saved) {
      if (editingId) {
        setEvents(prev => prev.map(e => e.id === editingId ? saved : e));
      } else {
        setEvents(prev => [...prev, saved]);
      }
      setModalOpen(false);
      toast.success(editingId ? "✅ Zapisano zmiany" : "✅ Wydarzenie dodane");
    }
  };

  // ── Calendar CRUD ──
  const toggleCalVisibility = (id: string) => {
    setCalendars(prev => prev.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
    supabase.from("user_calendars").update({ visible: !calendars.find(c => c.id === id)?.visible }).eq("id", id);
  };

  const openCalModal = (cal?: UserCalendar) => {
    if (cal) { setCalEditId(cal.id); setCalName(cal.name); setCalColor(cal.color); }
    else { setCalEditId(null); setCalName(""); setCalColor(COLORS[Math.floor(Math.random() * COLORS.length)]); }
    setCalModalOpen(true);
  };

  const saveCal = async () => {
    if (!calName.trim()) { toast.warning("Podaj nazwę!"); return; }
    if (calEditId) {
      await supabase.from("user_calendars").update({ name: calName.trim(), color: calColor }).eq("id", calEditId);
      setCalendars(prev => prev.map(c => c.id === calEditId ? { ...c, name: calName.trim(), color: calColor } : c));
    } else {
      const { data } = await supabase.from("user_calendars").insert({ user_id: userId, name: calName.trim(), color: calColor, sort_order: calendars.length }).select().single();
      if (data) setCalendars(prev => [...prev, { id: data.id, name: data.name, color: data.color, visible: true, sortOrder: data.sort_order }]);
    }
    setCalModalOpen(false);
    toast.success("✅ Kalendarz zapisany");
  };

  const deleteCal = async () => {
    if (!calEditId || calendars.length <= 1) { toast.warning("Nie można usunąć ostatniego kalendarza!"); return; }
    await supabase.from("calendar_events").update({ calendar_id: null }).eq("calendar_id", calEditId);
    await supabase.from("user_calendars").delete().eq("id", calEditId);
    setCalendars(prev => prev.filter(c => c.id !== calEditId));
    setCalModalOpen(false);
    toast.info("🗑 Usunięto kalendarz");
  };

  // ── Show detail ──
  const showDetail = (e: React.MouseEvent, ev: CalendarEvent, occDate?: string) => {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    let left = rect.right + 8, top = rect.top;
    if (left + 340 > window.innerWidth) left = rect.left - 348;
    if (top + 300 > window.innerHeight) top = window.innerHeight - 310;
    setDetailPos({ left: Math.max(4, left), top: Math.max(4, top) });
    setDetailOccDate(occDate || ev.start);
    setDetailEvent(ev);
  };


  // ── Search ──
  const searchResults = useMemo(() => {
    if (!searchQuery) return null;
    const q = searchQuery.toLowerCase();
    return events.filter(e => e.title.toLowerCase().includes(q) || e.desc.toLowerCase().includes(q) || e.location.toLowerCase().includes(q))
      .sort((a, b) => a.start.localeCompare(b.start));
  }, [searchQuery, events]);

  // ── RENDER: Mini Calendar ──
  const renderMiniCal = () => {
    const y = miniCursor.getFullYear(), m = miniCursor.getMonth();
    const first = new Date(y, m, 1);
    const startDow = first.getDay();
    const offset = startDow === 0 ? 6 : startDow - 1;
    const dim = new Date(y, m + 1, 0).getDate();
    const cells: JSX.Element[] = [];

    DAY_NAMES_SHORT.slice(1).concat(DAY_NAMES_SHORT.slice(0, 1)).forEach(d =>
      cells.push(<div key={`l${d}`} className="mini-day-name">{d[0]}</div>)
    );

    for (let i = 0; i < offset; i++) {
      const d = new Date(first); d.setDate(d.getDate() - (offset - i));
      const ds = isoDate(d);
      const hasEv = eventsForDate(ds).length > 0;
      cells.push(<div key={`mp${i}`} className={`mini-day other-month${hasEv ? " has-event" : ""}`} onClick={() => jumpTo(ds)}>{d.getDate()}</div>);
    }
    for (let i = 1; i <= dim; i++) {
      const d = new Date(y, m, i);
      const ds = isoDate(d);
      const isToday = ds === todayStr;
      const isSel = isoDate(cursor) === ds && !isToday;
      const hasEv = eventsForDate(ds).length > 0;
      cells.push(<div key={i} className={`mini-day${isToday ? " today" : ""}${isSel ? " selected" : ""}${hasEv ? " has-event" : ""}`} onClick={() => jumpTo(ds)}>{i}</div>);
    }
    return <div className="mini-grid">{cells}</div>;
  };

  const jumpTo = (ds: string) => { setCursor(parseDate(ds)); };

  // ── RENDER: Month View ──
  const renderMonthView = () => {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    const first = new Date(y, m, 1);
    const startDow = first.getDay();
    const offset = startDow === 0 ? 6 : startDow - 1;
    const dim = new Date(y, m + 1, 0).getDate();
    const cells: { d: Date; ds: string; cur: boolean }[] = [];

    for (let i = 0; i < offset; i++) {
      const d = new Date(first); d.setDate(d.getDate() - (offset - i));
      cells.push({ d, ds: isoDate(d), cur: false });
    }
    for (let i = 1; i <= dim; i++) {
      const d = new Date(y, m, i);
      cells.push({ d, ds: isoDate(d), cur: true });
    }
    while (cells.length % 7 !== 0) {
      const d = new Date(cells[cells.length - 1].d); d.setDate(d.getDate() + 1);
      cells.push({ d, ds: isoDate(d), cur: false });
    }

    return (
      <>
        <div className="month-grid-header">
          {["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Ndz"].map(n => <div key={n} className="month-col-header">{n}</div>)}
        </div>
        <div className="month-grid">
          {cells.map(({ d, ds, cur }) => {
            const isToday = ds === todayStr;
            const evs = eventsForDate(ds);
            return (
              <div key={ds} className={`month-cell${isToday ? " today" : ""}${!cur ? " other-month" : ""}`}
                onClick={() => openQuickPopup(ds, undefined, undefined, true)}
                onDoubleClick={(ev) => { ev.stopPropagation(); setCursor(parseDate(ds)); setView("week"); }}>
                <div className="cell-day">{d.getDate()}</div>
                {evs.slice(0, 3).map(e => {
                  const col = calColor_(e);
                  return (
                    <div key={e.id} className="event-pill"
                      style={{ background: `linear-gradient(90deg,${col}50 0%,${col}28 100%)`, border: `1px solid ${col}50`, color: col }}
                      onClick={(ev) => { ev.stopPropagation(); showDetail(ev, e, ds); }}>
                      {e.title}
                    </div>
                  );
                })}
                {evs.length > 3 && <div className="more-events">+{evs.length - 3} więcej</div>}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  // ── RENDER: Week View ──
  const renderWeekView = () => {
    const ws = startOfWeek(cursor);
    const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    const measuredW = hScrollerW > 0 ? hScrollerW : (typeof window !== "undefined" ? window.innerWidth : 0);
    const dw = isMobile && measuredW > 0
      ? Math.floor((measuredW - MOBILE_GUTTER_W) / VISIBLE_DAYS_MOBILE)
      : 0;
    const innerW = isMobile ? MOBILE_GUTTER_W + 7 * dw : 0;

    if (isMobile) {
      const stickyLeft: React.CSSProperties = {
        position: "sticky", left: 0, zIndex: 6,
        background: "rgba(8,16,32,0.98)",
      };
      return (
        <div className="week-view" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, position: "relative" }}>
          <div
            ref={weekHScrollRef}
            className="week-hscroll"
            onScroll={handleHScroll}
            style={{ overflow: "auto", flex: 1, WebkitOverflowScrolling: "touch" as any, position: "relative" }}
          >
            {dw > 0 && (
              <div style={{ width: innerW, display: "flex", flexDirection: "column" }}>
                <div
                  className="week-header-row"
                  style={{ position: "sticky", top: 0, zIndex: 7, background: "rgba(8,16,32,0.98)" }}
                >
                  <div
                    className="week-time-gutter"
                    style={{ ...stickyLeft, width: MOBILE_GUTTER_W, flex: "0 0 auto" }}
                  />
                  {days.map(d => {
                    const ds = isoDate(d);
                    const isToday = ds === todayStr;
                    return (
                      <div
                        key={ds}
                        className={`week-day-header${isToday ? " today" : ""}`}
                        style={{ width: dw, flex: "0 0 auto" }}
                      >
                        <div className="week-day-name">{DAY_NAMES_SHORT[d.getDay()]}</div>
                        <div className="week-day-num">{d.getDate()}</div>
                      </div>
                    );
                  })}
                </div>
                {renderAllDayRow(days, dw, MOBILE_GUTTER_W)}
                <div
                  className="week-body"
                  ref={weekBodyRef}
                  style={{ display: "flex", overflow: "visible", flex: "0 0 auto" }}
                >
                  <div
                    className="week-time-col"
                    style={{ ...stickyLeft, width: MOBILE_GUTTER_W, flex: "0 0 auto" }}
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="time-label">{h > 0 ? <span>{pad(h)}:00</span> : null}</div>
                    ))}
                  </div>
                  <div
                    className="week-days-area"
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(7, ${dw}px)`,
                      width: 7 * dw,
                      position: "relative",
                    }}
                  >
                    {days.map(d => renderWeekDayCol(d))}
                  </div>
                </div>
              </div>
            )}
          </div>
          {dw > 0 && (
            <div className="week-mobile-slider-wrap">
              <div className="week-mobile-slider-pill">
                <input
                  type="range"
                  min={0}
                  max={1000}
                  value={sliderVal}
                  onChange={onSliderChange}
                  className="week-mobile-slider"
                  aria-label="Przewiń dni tygodnia"
                />
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="week-view">
        <div className="week-header-row">
          <div className="week-time-gutter" />
          {days.map(d => {
            const ds = isoDate(d);
            const isToday = ds === todayStr;
            return (
              <div key={ds} className={`week-day-header${isToday ? " today" : ""}`}>
                <div className="week-day-name">{DAY_NAMES_SHORT[d.getDay()]}</div>
                <div className="week-day-num">{d.getDate()}</div>
              </div>
            );
          })}
        </div>
        {renderAllDayRow(days, 0, 0)}
        <div className="week-body" ref={weekBodyRef}>
          <div className="week-time-col">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="time-label">{h > 0 ? <span>{pad(h)}:00</span> : null}</div>
            ))}
          </div>
          <div className="week-days-area" style={{ gridTemplateColumns: `repeat(7, 1fr)` }}>
            {days.map(d => renderWeekDayCol(d))}
          </div>
        </div>
      </div>
    );
  };

  const renderAllDayRow = (days: Date[], dayWidthPx = 0, gutterPxOverride = 0) => {
    const allDayEvents: { e: CalendarEvent; startIdx: number; endIdx: number; rowIdx?: number }[] = [];
    const seen = new Set<string>();
    days.forEach((d, i) => {
      eventsForDate(isoDate(d)).filter(e => e.allDay).forEach(e => {
        if (seen.has(e.id)) return;
        seen.add(e.id);
        let endIdx = i;
        for (let j = i + 1; j < days.length; j++) { if (occursOn(e, isoDate(days[j]))) endIdx = j; else break; }
        allDayEvents.push({ e, startIdx: i, endIdx });
      });
    });
    const rowSlots: { startIdx: number; endIdx: number }[][] = [];
    allDayEvents.forEach(item => {
      let rowIdx = 0;
      while (true) {
        if (!rowSlots[rowIdx]) { rowSlots[rowIdx] = []; break; }
        if (!rowSlots[rowIdx].some(s => item.startIdx <= s.endIdx && item.endIdx >= s.startIdx)) break;
        rowIdx++;
      }
      item.rowIdx = rowIdx;
      if (!rowSlots[rowIdx]) rowSlots[rowIdx] = [];
      rowSlots[rowIdx].push({ startIdx: item.startIdx, endIdx: item.endIdx });
    });
    const PILL_H = 20, PILL_GAP = 2, PAD = 4;
    const totalRows = Math.max(rowSlots.length, 1);
    const areaH = totalRows * (PILL_H + PILL_GAP) + PAD * 2;
    const usePx = dayWidthPx > 0;
    const colPct = 100 / 7;
    const pillLeft = (startIdx: number) => usePx ? `${startIdx * dayWidthPx + 2}px` : `calc(${startIdx * colPct}% + 2px)`;
    const pillWidth = (startIdx: number, endIdx: number) => usePx
      ? `${(endIdx - startIdx + 1) * dayWidthPx - 4}px`
      : `calc(${(endIdx - startIdx + 1) * colPct}% - 4px)`;

    return (
      <div className="allday-row" style={{ minHeight: areaH + 6 }}>
        <div
          className="allday-gutter"
          title="Cały dzień"
          style={usePx ? { position: "sticky", left: 0, zIndex: 6, background: "rgba(8,16,32,0.98)", width: gutterPxOverride, flex: "0 0 auto" } : undefined}
        >cd.</div>
        <div
          className="allday-events"
          style={{ height: areaH, position: "relative", ...(usePx ? { width: 7 * dayWidthPx, flex: "0 0 auto" } : {}) }}
          onClick={(e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const x = e.clientX - rect.left;
            const w = usePx ? dayWidthPx : rect.width / 7;
            const colIdx = Math.floor(x / w);
            const ds = isoDate(days[Math.max(0, Math.min(6, colIdx))]);
            handleAllDayClick(e, ds);
          }}>
          {allDayEvents.map(({ e, startIdx, endIdx, rowIdx }) => {
            const col = calColor_(e);
            return (
              <div key={e.id} className="allday-pill"
                style={{
                  left: pillLeft(startIdx),
                  width: pillWidth(startIdx, endIdx),
                  top: PAD + (rowIdx || 0) * (PILL_H + PILL_GAP),
                  height: PILL_H,
                  background: `linear-gradient(90deg,${col}50 0%,${col}28 100%)`,
                  border: `1px solid ${col}55`,
                  color: col,
                  filter: "brightness(1.4) saturate(0.9)",
                  display: "flex", alignItems: "center", gap: 5, padding: "0 7px",
                }}
                onClick={(ev) => showDetail(ev, e, isoDate(days[startIdx]))}>

                {e.title}
              </div>
            );
          })}
          {ghost?.allDay && (() => {
            const dayIdx = days.findIndex(dd => isoDate(dd) === ghost.date);
            if (dayIdx < 0) return null;
            const gcol = calendars[0]?.color || "#6366f1";
            return (
              <div className="allday-pill ghost-event" style={{
                left: pillLeft(dayIdx),
                width: pillWidth(dayIdx, dayIdx),
                top: PAD + totalRows * (PILL_H + PILL_GAP),
                height: PILL_H,
                background: `${gcol}40`, border: `2px dashed ${gcol}88`,
                display: "flex", alignItems: "center", padding: "0 5px",
              }} onMouseDown={e => e.stopPropagation()} />
            );
          })()}
        </div>
      </div>
    );
  };


  // ── Interaction handlers for week view ──
  const getRelativeY = (e: React.MouseEvent | MouseEvent, col: HTMLElement) => {
    const rect = col.getBoundingClientRect();
    return e.clientY - rect.top;
  };

  const commitGhostAsPopup = (g: GhostEvent) => {
    openQuickPopup(g.date, minToTime(g.startMin), minToTime(g.endMin), g.allDay);
    setGhost(null);
  };

  const handleColMouseDown = (e: React.MouseEvent, ds: string) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".week-event")) return;
    e.preventDefault();
    const col = e.currentTarget as HTMLElement;
    const y = getRelativeY(e, col);
    const startMin = snapMin(yToMin(y));
    const endMin = Math.min(1440, startMin + 30);
    setGhost({ date: ds, startMin, endMin, allDay: false, title: "", editing: true });
    dragRef.current = { mode: "create", startY: y, startMin, date: ds };
    forceUpdate(x => x + 1);
  };

  const handleEventMouseDown = (e: React.MouseEvent, ev: CalendarEvent, mode: "move" | "resize") => {
    e.stopPropagation(); e.preventDefault();
    const col = (e.currentTarget as HTMLElement).closest(".week-day-col") as HTMLElement;
    if (!col) return;
    const y = getRelativeY(e, col);
    const sm = timeToMin(ev.startTime || "0:0");
    const em = timeToMin(ev.endTime || "0:0") || sm + 60;
    const daysArea = col.closest(".week-days-area");
    const allCols = daysArea ? Array.from(daysArea.querySelectorAll(".week-day-col")) : [col];
    const ws = startOfWeek(cursor);
    const daysOffsets = allCols.map((c, i) => {
      const r = c.getBoundingClientRect();
      return { date: isoDate(addDays(ws, i)), left: r.left, right: r.right };
    });
    const grabOffsetMin = yToMin(y) - sm;
    // For recurring events the master.start is the series start (e.g. January),
    // but the user grabbed a specific occurrence (e.g. May). Use the column's
    // data-date so applyRecurringEdit knows which occurrence is being edited;
    // otherwise "future" scope would truncate the entire series back to January.
    const colDate = col.getAttribute("data-date") || ev.start;
    dragRef.current = { mode, eventId: ev.id, startY: y, startMin: sm, origStartMin: sm, origEndMin: em, date: colDate, origDate: colDate, masterStart: ev.start, masterEnd: ev.end || ev.start, daysOffsets, grabOffsetMin };
    forceUpdate(x => x + 1);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const weekBody = weekBodyRef.current;
      if (!weekBody) return;

      if (drag.mode === "create" && ghost) {
        const col = weekBody.querySelector(`[data-date="${drag.date}"]`) as HTMLElement;
        if (!col) return;
        const y = getRelativeY(e, col);
        const currentMin = snapMin(yToMin(y));
        const lo = Math.min(drag.startMin, currentMin);
        const hi = Math.max(drag.startMin, currentMin);
        setGhost(prev => prev ? { ...prev, startMin: lo, endMin: hi + 15 } : null);
      }
      if (drag.mode === "resize" && drag.eventId) {
        const col = weekBody.querySelector(`[data-date="${drag.date}"]`) as HTMLElement;
        if (!col) return;
        const y = getRelativeY(e, col);
        const newEndMin = snapMin(yToMin(y));
        const clampedEnd = Math.max((drag.origStartMin || 0) + 15, Math.min(1440, newEndMin));
        setEvents(prev => prev.map(ev => ev.id !== drag.eventId ? ev : { ...ev, endTime: minToTime(clampedEnd) }));
      }
      if (drag.mode === "move" && drag.eventId) {
        let targetDate = drag.date;
        if (drag.daysOffsets) {
          for (const d of drag.daysOffsets) { if (e.clientX >= d.left && e.clientX < d.right) { targetDate = d.date; break; } }
        }
        const col = weekBody.querySelector(`[data-date="${targetDate}"]`) as HTMLElement;
        if (!col) return;
        const y = getRelativeY(e, col);
        const duration = (drag.origEndMin || 0) - (drag.origStartMin || 0);
        const newStart = snapMin(yToMin(y) - (drag.grabOffsetMin ?? 0));
        const clampedStart = Math.max(0, Math.min(1440 - duration, newStart));
        setEvents(prev => prev.map(ev => ev.id !== drag.eventId ? ev : {
          ...ev, start: targetDate, end: targetDate,
          startTime: minToTime(clampedStart), endTime: minToTime(clampedStart + duration),
        }));
        drag.date = targetDate;
      }
    };
    const handleMouseUp = async () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      if (drag.mode === "create" && ghost) {
        commitGhostAsPopup(ghost);
        return;
      }
      if ((drag.mode === "resize" || drag.mode === "move") && drag.eventId) {
        const ev = events.find(e => e.id === drag.eventId);
        if (ev) {
          // Recurring → revert local change, ask which scope to apply.
          if (ev.repeat && ev.repeat !== "none") {
            const origStartTime = drag.origStartMin != null ? minToTime(drag.origStartMin) : ev.startTime;
            const origEndTime = drag.origEndMin != null ? minToTime(drag.origEndMin) : ev.endTime;
            const origDate = drag.origDate || ev.start;
            // No actual change (pure click, no drag/resize) → don't show scope dialog.
            const unchanged =
              ev.startTime === origStartTime &&
              ev.endTime === origEndTime &&
              ev.start === origDate &&
              (ev.end || ev.start) === origDate;
            const masterStart = drag.masterStart || ev.start;
            const masterEnd = drag.masterEnd || ev.end || masterStart;
            const reverted: CalendarEvent = { ...ev, start: masterStart, end: masterEnd, startTime: origStartTime, endTime: origEndTime };
            setEvents(prev => prev.map(e => e.id === ev.id ? reverted : e));
            if (unchanged) {
              forceUpdate(x => x + 1);
              return;
            }
            const newEv: CalendarEvent = {
              ...ev,
              start: ev.start,
              end: ev.end,
              startTime: ev.startTime,
              endTime: ev.endTime,
            };
            openScopeDialog("Edytowanie wydarzenia cyklicznego", "Zapisz", async (choice) => {
              await applyRecurringEdit(reverted, origDate, newEv, choice);
              toast.success("✅ Zapisano zmiany");
            });
          } else {
            await supabase.from("calendar_events").update({
              time: ev.startTime, end_time: ev.endTime, date: ev.start, end_date: ev.end || ev.start,
            }).eq("id", ev.id);
          }
        }
      }
      forceUpdate(x => x + 1);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
  }, [ghost, events, calendars, cursor]);

  // Ghost auto-dismiss (click outside)
  useEffect(() => {
    if (!ghost) return;
    const handler = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(".ghost-event")) return;
      setGhost(null);
    };
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 100);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
  }, [ghost]);

  const handleAllDayClick = (e: React.MouseEvent, ds: string) => {
    if ((e.target as HTMLElement).closest(".allday-pill")) return;
    openQuickPopup(ds, undefined, undefined, true);
  };

  const renderWeekDayCol = (d: Date) => {
    const ds = isoDate(d);
    const evs = eventsForDate(ds).filter(e => !e.allDay)
      .sort((a, b) => timeToMin(a.startTime || "0:0") - timeToMin(b.startTime || "0:0"));
    const groups: { e: CalendarEvent; seg: ReturnType<typeof getEventSegment> }[][] = [];
    evs.forEach(e => {
      const seg = getEventSegment(e, ds);
      const eS = seg.top, eE = seg.top + seg.height;
      let placed = false;
      for (const grp of groups) {
        if (grp.some(g => eS < g.seg.top + g.seg.height && eE > g.seg.top)) { grp.push({ e, seg }); placed = true; break; }
      }
      if (!placed) groups.push([{ e, seg }]);
    });
    const layout = new Map<string, { col: number; total: number; seg: ReturnType<typeof getEventSegment> }>();
    groups.forEach(grp => {
      const slots: number[] = [];
      grp.forEach(item => {
        let c = 0;
        while (slots[c] !== undefined && slots[c] > item.seg.top) c++;
        slots[c] = item.seg.top + item.seg.height;
        layout.set(item.e.id, { col: c, total: slots.length, seg: item.seg });
      });
      const t = slots.length;
      grp.forEach(item => { const l = layout.get(item.e.id); if (l) l.total = t; });
    });
    const showGhost = ghost && ghost.date === ds && !ghost.allDay;

    return (
      <div key={ds} className="week-day-col" data-date={ds} onMouseDown={(e) => handleColMouseDown(e, ds)}>
        {Array.from({ length: 24 }, (_, h) => (
          <React.Fragment key={h}>
            <div className={`hour-line${h === 0 || h === 6 || h === 12 || h === 18 ? " major" : ""}`} style={{ top: h * HOUR_H }} />
            <div className="hour-line" style={{ top: h * HOUR_H + HOUR_H / 2, borderTopStyle: "dashed", opacity: 0.4 }} />
          </React.Fragment>
        ))}
        {ds === todayStr && (() => {
          const now = new Date();
          return <div className="now-line" style={{ top: (now.getHours() * 60 + now.getMinutes()) / 1440 * TOTAL_H }} />;
        })()}
        {showGhost && (
          <div className="week-event ghost-event"
            style={{
              top: ghost.startMin / 1440 * TOTAL_H,
              height: Math.max((ghost.endMin - ghost.startMin) / 1440 * TOTAL_H, 16),
              left: 3, right: 3, zIndex: 20,
              background: `${calendars[0]?.color || "#6366f1"}40`,
              border: `2px dashed ${calendars[0]?.color || "#6366f1"}88`,
              borderRadius: 8,
            }}
            onMouseDown={e => e.stopPropagation()} />
        )}
        {evs.map(e => {
          const info = layout.get(e.id);
          if (!info) return null;
          const { col, total, seg } = info;
          const color = calColor_(e);
          const OFFSET = 8;
          const angles = [145, 45, 225, 315];
          const angle = angles[col % angles.length];
          const opBoost = total > 1 ? "55" : "45";
          const opMid = total > 1 ? "35" : "28";
          const opEnd = total > 1 ? "28" : "18";
          const borderOpacity = total > 1 ? "88" : "55";
          const isDragging = dragRef.current?.eventId === e.id;
          return (
            <div key={e.id} className={`week-event${isDragging ? " dragging" : ""}`}
              style={{
                top: seg.top, height: seg.height,
                left: total > 1 ? col * OFFSET : 3, right: 3,
                zIndex: isDragging ? 30 : 2 + col,
                background: `linear-gradient(${angle}deg,${color}${opBoost} 0%,${color}${opMid} 60%,${color}${opEnd} 100%)`,
                border: `1px solid ${color}${borderOpacity}`,
                borderRadius: `${seg.isContinuation ? "0" : "10px"} ${seg.isContinuation ? "0" : "10px"} ${seg.isOverflow ? "0" : "10px"} ${seg.isOverflow ? "0" : "10px"}`,
                boxShadow: isDragging ? `0 4px 20px ${color}50` : `0 2px 10px ${color}30, 0 1px 3px rgba(0,0,0,0.3)`,
                opacity: isDragging ? 0.85 : 1, cursor: "grab",
              }}
              onMouseDown={(ev) => handleEventMouseDown(ev, e, "move")}
              onClick={(ev) => { ev.stopPropagation(); if (!dragRef.current) showDetail(ev, e, ds); }}>
              <div style={{ padding: "3px 6px 3px 7px", fontWeight: 700, fontSize: ".65rem", lineHeight: "1.25", color, filter: "brightness(1.4) saturate(0.9)", wordBreak: "break-word", flex: 1 }}>
                {e.title}
              </div>
              <div className="event-resize-handle"
                onMouseDown={(ev) => { ev.stopPropagation(); handleEventMouseDown(ev, e, "resize"); }}
                style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 8, cursor: "s-resize", borderRadius: "0 0 6px 6px" }} />
            </div>
          );
        })}
      </div>
    );
  };

  // ── RENDER: Agenda View ──
  const renderAgendaView = () => {
    const days = Array.from({ length: 60 }, (_, i) => addDays(cursor, i));
    const groups = days.map(d => {
      const ds = isoDate(d);
      const evs = eventsForDate(ds);
      if (!evs.length) return null;
      const isToday = ds === todayStr;
      return (
        <div key={ds} className="agenda-day-group">
          <div className={`agenda-day-label${isToday ? " today-label" : ""}`}>
            <span className="aday-num">{d.getDate()}</span>
            <span>{DAY_NAMES_FULL[d.getDay()]}, {MONTH_NAMES_GEN[d.getMonth()]} {d.getFullYear()}</span>
          </div>
          {evs.map(e => {
            const col = calColor_(e);
            return (
              <div key={e.id} className="agenda-event-row" onClick={(ev) => showDetail(ev, e, ds)}>
                <div className="agenda-event-time">{e.allDay ? "Cały dzień" : `${e.startTime || ""}${e.endTime ? " – " + e.endTime : ""}`}</div>
                <div className="agenda-event-dot" style={{ background: col }} />
                <div className="agenda-event-body">
                  <div className="agenda-event-title">{e.title}</div>
                  {e.location && <div className="agenda-event-meta">📍 {e.location}</div>}
                  {e.repeat && e.repeat !== "none" && <div className="agenda-event-meta">🔄 Powtarza się</div>}
                </div>
              </div>
            );
          })}
        </div>
      );
    }).filter(Boolean);

    if (!groups.length) return <div className="agenda-view"><div style={{ textAlign: "center", padding: 60, color: "#8899b4" }}>Brak wydarzeń w nadchodzących 60 dniach</div></div>;
    return <div className="agenda-view">{groups}</div>;
  };

  // ── RENDER: Search results ──
  const renderSearchResults = () => {
    if (!searchResults) return null;
    if (!searchResults.length) return <div style={{ textAlign: "center", padding: 60, color: "#8899b4" }}>Brak wyników dla „{searchQuery}"</div>;
    return (
      <div className="agenda-view">
        <div style={{ padding: "16px 0 10px", fontSize: ".82rem", fontWeight: 800, color: "#8899b4" }}>Wyniki wyszukiwania ({searchResults.length})</div>
        {searchResults.map(e => {
          const col = calColor_(e);
          return (
            <div key={e.id} className="agenda-event-row" onClick={(ev) => { showDetail(ev, e); setSearchQuery(""); }}>
              <div className="agenda-event-time">{e.start}</div>
              <div className="agenda-event-dot" style={{ background: col }} />
              <div className="agenda-event-body">
                <div className="agenda-event-title">{e.title}</div>
                <div className="agenda-event-meta">{e.startTime || ""}{e.location ? " · " + e.location : ""}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) return <LoadingInline label="Ładowanie kalendarza…" minHeight={300} />;

  return (
    <div className="cal-app">
      {calSidebarOpen && <div className="cal-sidebar-overlay" onClick={() => setCalSidebarOpen(false)} />}
      {/* ── SIDEBAR ── */}
      <div className={`cal-sidebar-panel ${calSidebarOpen ? "cal-sb-open" : ""}`}>
        <div className="cal-sb-logo">Moc Nauki <span>Kalendarz</span></div>

        <button className="cal-btn-new" onClick={() => openQuickPopup(todayStr)}>
          <span style={{ fontSize: "1.1rem" }}>＋</span> Nowe wydarzenie
        </button>

        <div className="cal-sb-search">
          <span style={{ color: "#8899b4", fontSize: ".85rem" }}>🔍</span>
          <input placeholder="Szukaj wydarzeń…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>

        <div className="mini-cal">
          <div className="mini-cal-header">
            <button className="mini-nav" onClick={() => setMiniCursor(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>‹</button>
            <div className="mini-cal-title">{MONTH_NAMES[miniCursor.getMonth()]} {miniCursor.getFullYear()}</div>
            <button className="mini-nav" onClick={() => setMiniCursor(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>›</button>
          </div>
          {renderMiniCal()}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px 4px", marginTop: 6 }}>
          <div className="cal-section-title" style={{ padding: 0, margin: 0 }}>Moje kalendarze</div>
          <button onClick={() => openCalModal()} style={{ background: "none", border: "none", color: "#8899b4", cursor: "pointer", fontSize: "1rem", padding: "0 2px", lineHeight: 1 }} title="Dodaj kalendarz">＋</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {calendars.map(c => (
            <div key={c.id} className="cal-item">
              <button className="cal-toggle" onClick={() => toggleCalVisibility(c.id)}>
                <div className={`cal-dot${!c.visible ? " off" : ""}`} style={{ background: c.color }} />
                <span className="cal-label">{c.name}</span>
              </button>
              <div className="cal-item-actions">
                <button className="cal-action-btn" onClick={() => openCalModal(c)} title="Edytuj">✏️</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN ── */}
      <div className="cal-main-area">
        <div className="cal-topbar">
          <button className="cal-sb-toggle" onClick={() => setCalSidebarOpen(p => !p)}>
            <Menu size={20} />
          </button>
          <div className="cal-topbar-nav">
            <button className="top-nav-btn top-btn-today" onClick={goToday}>Dziś</button>
            <button className="top-nav-btn" onClick={navPrev}>‹</button>
            <button className="top-nav-btn" onClick={navNext}>›</button>
          </div>
          <div className="cal-topbar-title">{topbarTitle}</div>
          <div className="view-switcher">
            {(["week", "month"] as const).map(v => (
              <button key={v} className={`view-btn${view === v ? " active" : ""}`} onClick={() => setView(v)}>
                {v === "week" ? "Tydzień" : "Miesiąc"}
              </button>
            ))}
          </div>
        </div>

        <div className="cal-body">
          {searchQuery ? renderSearchResults() : (
            <>
              {view === "month" && renderMonthView()}
              {view === "week" && renderWeekView()}
            </>
          )}
        </div>
      </div>

      {/* ── QUICK POPUP ── */}
      {quickOpen && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 840 }} onClick={() => setQuickOpen(false)} />
          <div className="quick-popup" style={{ left: quickPos.left, top: quickPos.top }}>
            <button onClick={() => setQuickOpen(false)} style={{ position: "absolute", top: 10, right: 12, background: "none", border: "none", color: "#8899b4", cursor: "pointer", fontSize: "1rem", padding: 4 }}>✕</button>
            <input className="quick-title-input" placeholder="Dodaj tytuł" value={quickTitle} onChange={e => setQuickTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") quickSave(); if (e.key === "Escape") setQuickOpen(false); }} />
            {!quickAllDay && (
              <div className="quick-row">
                <span className="quick-row-icon">🕐</span>
                <span style={{ color: "#c8d8f0", fontWeight: 600, fontSize: ".8rem", flexShrink: 0 }}>
                  {(() => { const d = parseDate(quickDs); return `${DAY_NAMES_FULL[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES_GEN[d.getMonth()]}`; })()}
                </span>
                <select className="q-time" value={quickStartTime} onChange={e => setQuickStartTime(e.target.value)}>
                  {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <span style={{ color: "#8899b4", fontSize: ".78rem", flexShrink: 0 }}>–</span>
                <select className="q-time" value={quickEndTime} onChange={e => setQuickEndTime(e.target.value)}>
                  {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}
            {quickAllDay && (
              <div className="quick-row">
                <span className="quick-row-icon">📅</span>
                <span style={{ color: "#c8d8f0", fontSize: ".83rem" }}>Cały dzień</span>
              </div>
            )}
            <div className="quick-row">
              <span className="quick-row-icon">📋</span>
              <select className="q-select" value={quickCalId} onChange={e => setQuickCalId(e.target.value)}>
                {calendars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="quick-row">
              <span className="quick-row-icon">🔄</span>
              <select className="q-select" value={quickRepeat} onChange={e => setQuickRepeat(e.target.value)}>
                <option value="none">Nie powtarza się</option>
                <option value="daily">Codziennie</option>
                <option value="weekly">Co tydzień</option>
                <option value="biweekly">Co 2 tygodnie</option>
                <option value="monthly">Co miesiąc</option>
                <option value="yearly">Co rok</option>
                <option value="weekdays">Dni robocze (Pn–Pt)</option>
              </select>
            </div>
            {quickRepeat !== "none" && (
              <div className="quick-row">
                <span className="quick-row-icon" style={{ fontSize: ".7rem", color: "#8899b4" }}>do</span>
                <input type="date" className="q-date" value={quickRepeatEnd} onChange={e => setQuickRepeatEnd(e.target.value)} />
              </div>
            )}
            <div className="quick-row" style={{ alignItems: "flex-start" }}>
              <span className="quick-row-icon" style={{ marginTop: 6 }}>📝</span>
              <textarea placeholder="Dodaj opis…" maxLength={500} rows={2} value={quickDesc} onChange={e => setQuickDesc(e.target.value)}
                style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", borderRadius: 9, padding: "6px 10px", fontSize: ".8rem", fontFamily: "inherit", outline: "none", resize: "none", lineHeight: 1.4, transition: ".15s" }} />
            </div>
            <div className="quick-footer">
              <button className="quick-more-btn" onClick={() => {
                setQuickOpen(false);
                setEditingId(null);
                setModalTitle(quickTitle);
                setModalStartDate(quickDs);
                setModalStartTime(quickStartTime);
                setModalEndDate(quickDs);
                setModalEndTime(quickEndTime);
                setModalAllDay(quickAllDay);
                setModalCalId(quickCalId);
                setModalLocation("");
                setModalDesc(quickDesc);
                setModalRepeat(quickRepeat);
                setModalRepeatEnd(quickRepeatEnd);
                setModalOpen(true);
              }}>Więcej opcji</button>
              <button className="quick-save-btn" onClick={quickSave}>Zapisz</button>
            </div>
          </div>
        </>
      )}

      {/* ── DETAIL POPUP ── */}
      {detailEvent && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 890 }} onClick={() => setDetailEvent(null)} />
          <div className="detail-popup" style={{ left: detailPos.left, top: detailPos.top }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ fontSize: ".95rem", fontWeight: 800, color: "#fff", flex: 1, paddingRight: 10 }}>
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: calColor_(detailEvent), marginRight: 7, verticalAlign: "middle" }} />
                {detailEvent.title}
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button onClick={() => openEditModal(detailEvent, detailOccDate)} style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "#8899b4", padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: ".75rem" }}>✏️</button>
                <button onClick={() => deleteEventFromDB(detailEvent.id, detailOccDate)} style={{ background: "rgba(248,113,113,0.1)", border: "none", color: "#f87171", padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: ".75rem" }}>🗑</button>
                <button onClick={() => setDetailEvent(null)} style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "#8899b4", padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: ".75rem" }}>✕</button>
              </div>
            </div>
            <div style={{ fontSize: ".82rem", color: "#c8d8f0", marginBottom: 4 }}>
              📅 {detailEvent.allDay ? "Cały dzień" : `${detailEvent.start}${detailEvent.startTime ? " " + detailEvent.startTime : ""}${detailEvent.endTime ? " – " + detailEvent.endTime : ""}`}
            </div>
            {detailEvent.location && <div style={{ fontSize: ".8rem", color: "#8899b4", marginBottom: 4 }}>📍 {detailEvent.location}</div>}
            {(() => { const cal = calendars.find(c => c.id === detailEvent.calId); return cal ? <div style={{ fontSize: ".78rem", marginBottom: 4 }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: cal.color, marginRight: 5, verticalAlign: "middle" }} /><span style={{ color: "#8899b4" }}>{cal.name}</span></div> : null; })()}
            {detailEvent.desc && <div style={{ fontSize: ".8rem", color: "#c8d8f0", margin: "8px 0", padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 7, lineHeight: 1.5 }}>{detailEvent.desc}</div>}
            {detailEvent.autoAdded && detailEvent.sourceTitle && <div style={{ fontSize: ".7rem", color: "#60a5fa", marginTop: 6 }}>📝 Dodano automatycznie z: „{detailEvent.sourceTitle}"</div>}
          </div>
        </>
      )}

      {/* ── EVENT MODAL ── */}
      {modalOpen && (
        <div className="cal-overlay" onClick={() => setModalOpen(false)}>
          <div className="cal-modal wide" onClick={e => e.stopPropagation()}>
            <button className="cal-mclos" onClick={() => setModalOpen(false)}>✕</button>
            <div className="cal-mtitle">{editingId ? "✏️ Edytuj wydarzenie" : "➕ Nowe wydarzenie"}</div>
            <div className="cal-fg">
              <label>Tytuł *</label>
              <input value={modalTitle} onChange={e => setModalTitle(e.target.value)} placeholder="Dodaj tytuł" autoFocus style={{ fontSize: "1.1rem", padding: "11px 14px" }} />
            </div>
            <div className="cal-fg">
              <label><input type="checkbox" checked={modalAllDay} onChange={e => setModalAllDay(e.target.checked)} style={{ width: "auto", marginRight: 6, accentColor: "#6366f1" }} /> Całodniowe</label>
            </div>
            {!modalAllDay && (
              <div className="cal-fg">
                <label>Czas</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "7px 12px", flex: 1, minWidth: 180 }}>
                    <span style={{ fontSize: ".65rem", fontWeight: 800, color: "#8899b4", textTransform: "uppercase", letterSpacing: ".5px", flexShrink: 0 }}>Od</span>
                    <input type="date" value={modalStartDate} onChange={e => setModalStartDate(e.target.value)} style={{ background: "none", border: "none", color: "#fff", fontSize: ".85rem", fontFamily: "inherit", outline: "none", padding: 0, flex: 1 }} />
                    <select value={modalStartTime} onChange={e => setModalStartTime(e.target.value)} style={{ background: "none", border: "none", color: "#c8d8f0", fontSize: ".85rem", fontFamily: "inherit", outline: "none", padding: 0 }}>
                      {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <span style={{ color: "#8899b4", fontSize: "1rem", flexShrink: 0 }}>→</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "7px 12px", flex: 1, minWidth: 180 }}>
                    <span style={{ fontSize: ".65rem", fontWeight: 800, color: "#8899b4", textTransform: "uppercase", letterSpacing: ".5px", flexShrink: 0 }}>Do</span>
                    <input type="date" value={modalEndDate} onChange={e => setModalEndDate(e.target.value)} style={{ background: "none", border: "none", color: "#fff", fontSize: ".85rem", fontFamily: "inherit", outline: "none", padding: 0, flex: 1 }} />
                    <select value={modalEndTime} onChange={e => setModalEndTime(e.target.value)} style={{ background: "none", border: "none", color: "#c8d8f0", fontSize: ".85rem", fontFamily: "inherit", outline: "none", padding: 0 }}>
                      {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}
            <div className="cal-fg2">
              <div className="cal-fg">
                <label>Kalendarz</label>
                <select value={modalCalId} onChange={e => setModalCalId(e.target.value)}>
                  {calendars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="cal-fg">
              <label>Lokalizacja</label>
              <input value={modalLocation} onChange={e => setModalLocation(e.target.value)} placeholder="Dodaj lokalizację" />
            </div>
            <div className="cal-fg">
              <label>Opis / notatki</label>
              <textarea value={modalDesc} onChange={e => setModalDesc(e.target.value)} rows={3} placeholder="Dodaj opis…" />
            </div>
            <div className="cal-fg2">
              <div className="cal-fg">
                <label>Powtarzanie</label>
                <select value={modalRepeat} onChange={e => setModalRepeat(e.target.value)}>
                  <option value="none">Nie powtarzaj</option>
                  <option value="daily">Codziennie</option>
                  <option value="weekly">Co tydzień</option>
                  <option value="biweekly">Co 2 tygodnie</option>
                  <option value="monthly">Co miesiąc</option>
                  <option value="yearly">Co rok</option>
                  <option value="weekdays">Dni robocze (Pn–Pt)</option>
                </select>
              </div>
              {modalRepeat !== "none" && (
                <div className="cal-fg">
                  <label>Koniec powtarzania</label>
                  <input type="date" value={modalRepeatEnd} onChange={e => setModalRepeatEnd(e.target.value)} />
                </div>
              )}
            </div>
            <div className="cal-mfoot">
              {editingId && <button className="btn btn-danger btn-sm" style={{ marginRight: "auto" }} onClick={() => { deleteEventFromDB(editingId, editOccDate); setModalOpen(false); }}>🗑 Usuń</button>}
              <button className="btn btn-ghost btn-sm" onClick={() => setModalOpen(false)}>Anuluj</button>
              <button className="btn btn-grad btn-sm" onClick={saveModal}>💾 Zapisz</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CALENDAR MODAL ── */}
      {calModalOpen && (
        <div className="cal-overlay" onClick={() => setCalModalOpen(false)}>
          <div className="cal-modal" style={{ width: 360 }} onClick={e => e.stopPropagation()}>
            <button className="cal-mclos" onClick={() => setCalModalOpen(false)}>✕</button>
            <div className="cal-mtitle">{calEditId ? "✏️ Edytuj kalendarz" : "➕ Nowy kalendarz"}</div>
            <div className="cal-fg">
              <label>Nazwa kalendarza *</label>
              <input value={calName} onChange={e => setCalName(e.target.value)} maxLength={40} placeholder="np. Szkoła" autoFocus />
            </div>
            <div className="cal-fg">
              <label>Kolor</label>
              <div className="color-picker">
                {COLORS.map(c => (
                  <div key={c} className={`color-opt${calColor === c ? " sel" : ""}`} style={{ background: c }} onClick={() => setCalColor(c)} />
                ))}
              </div>
            </div>
            <div className="cal-mfoot">
              {calEditId && <button className="btn btn-danger btn-sm" style={{ marginRight: "auto" }} onClick={deleteCal}>🗑 Usuń</button>}
              <button className="btn btn-ghost btn-sm" onClick={() => setCalModalOpen(false)}>Anuluj</button>
              <button className="btn btn-grad btn-sm" onClick={saveCal}>💾 Zapisz</button>
            </div>
          </div>
        </div>
      )}

      {/* ── RECURRING SCOPE DIALOG ── */}
      {scopeDialog && (
        <div
          className="cal-overlay"
          style={{
            zIndex: 950,
            backdropFilter: "blur(8px)",
            background: "rgba(0,0,0,0.45)",
          }}
          onClick={() => setScopeDialog(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(14,24,48,0.96)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 18,
              padding: "24px 24px 18px",
              width: "min(420px, 92vw)",
              color: "#fff",
              boxShadow:
                "0 20px 50px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            <div
              style={{
                fontSize: "1.1rem",
                fontWeight: 800,
                marginBottom: 18,
                color: "#fff",
              }}
            >
              {scopeDialog.title}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {([
                {
                  v: "single" as ScopeChoice,
                  label: "To wydarzenie",
                },
                {
                  v: "future" as ScopeChoice,
                  label: "To wydarzenie i kolejne wydarzenia",
                },
                {
                  v: "all" as ScopeChoice,
                  label: "Wszystkie wydarzenia",
                },
              ]).map((opt) => (
                <label
                  key={opt.v}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    cursor: "pointer",
                    padding: "10px 12px",
                    borderRadius: 10,
                    background:
                      scopeChoice === opt.v
                        ? "rgba(59,130,246,0.08)"
                        : "transparent",
                    border:
                      scopeChoice === opt.v
                        ? "1px solid rgba(59,130,246,0.25)"
                        : "1px solid transparent",
                    transition: ".15s",
                  }}
                >
                  <input
                    type="radio"
                    name="scope"
                    checked={scopeChoice === opt.v}
                    onChange={() => setScopeChoice(opt.v)}
                    style={{
                      accentColor: "#60a5fa",
                      width: 18,
                      height: 18,
                      margin: 0,
                      cursor: "pointer",
                    }}
                  />

                  <span
                    style={{
                      color:
                        scopeChoice === opt.v
                          ? "#dbeafe"
                          : "#c8d8f0",
                      fontSize: ".9rem",
                      fontWeight: 600,
                    }}
                  >
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 24,
              }}
            >
              <button
                onClick={() => setScopeDialog(null)}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#8899b4",
                  padding: "9px 16px",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontSize: ".85rem",
                  fontWeight: 700,
                }}
              >
                Anuluj
              </button>

              <button
                onClick={async () => {
                  const d = scopeDialog;
                  const c = scopeChoice;

                  setScopeDialog(null);

                  if (d) await d.onConfirm(c);
                }}
                style={{
                  background:
                    "linear-gradient(135deg,#3b82f6,#6366f1)",
                  border: "none",
                  color: "#fff",
                  padding: "9px 18px",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontSize: ".85rem",
                  fontWeight: 700,
                  boxShadow:
                    "0 6px 18px rgba(59,130,246,0.35)",
                }}
              >
                {scopeDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarTab;
