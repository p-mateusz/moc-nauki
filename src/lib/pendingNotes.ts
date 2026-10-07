import { supabase } from "@/lib/supabase";

export type ParsedEvent = { name: string; date: string; time: string; description: string };
export type ParsedNote = { title: string; content: string; events: ParsedEvent[] };

const ALL_DAY = ["cd", "c.d.", "cały dzień", "caly dzien", "all-day", "all day", "allday", "całodniowe", "calodniowe", "-", "—", "brak"];

export function normalizeEvent(e: any): ParsedEvent | null {
  if (!e || typeof e !== "object") return null;
  const name = String(e.name || e.title || e.eventName || "").trim();
  const raw = String(e.eventDate || e.date || "").trim();
  if (!name || !raw) return null;
  let date = raw;
  const m = raw.match(/^(\d{2})[.\-\/](\d{2})[.\-\/](\d{4})$/);
  if (m) date = `${m[3]}-${m[2]}-${m[1]}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  let time = String(e.eventTime || e.time || "").trim();
  if (ALL_DAY.includes(time.toLowerCase())) time = "";
  if (time && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(time)) time = "";
  const description = String(e.description || e.descripiton || e.desc || "").trim();
  return { name, date, time, description };
}

const unescape = (s: string) => s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"');

/** Parses n8n note output: either JSON or "key:value" lines (title, text/content, name, description, eventDate, eventTime). */
export function parseN8nNote(input: string): ParsedNote {
  const txt = input.trim();
  try {
    const j = JSON.parse(txt);
    const o = Array.isArray(j) ? j[0] : j;
    const events: any[] = [];
    if (Array.isArray(o.events)) events.push(...o.events);
    if (o.event) events.push(o.event);
    if (o.eventDate) events.push(o);
    return {
      title: String(o.title || "").trim(),
      content: String(o.content || o.text || o.html || ""),
      events: events.map(normalizeEvent).filter(Boolean) as ParsedEvent[],
    };
  } catch {}

  const fields: { key: string; value: string }[] = [];
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_]+)\s*:(.*)$/);
    if (m && ["title", "text", "content", "html", "name", "description", "eventdate", "eventtime", "date", "time"].includes(m[1].toLowerCase())) {
      fields.push({ key: m[1].toLowerCase(), value: m[2].trim() });
    } else if (fields.length) {
      fields[fields.length - 1].value += "\n" + line;
    }
  }
  let title = "", content = "";
  const events: any[] = [];
  let cur: any = null;
  for (const { key, value } of fields) {
    if (key === "title") title = value;
    else if (key === "text" || key === "content" || key === "html") content = unescape(value);
    else {
      const k = key === "eventdate" ? "eventDate" : key === "eventtime" ? "eventTime" : key;
      if (k === "name" || !cur) { cur = {}; events.push(cur); }
      cur[k] = value;
    }
  }
  return { title, content, events: events.map(normalizeEvent).filter(Boolean) as ParsedEvent[] };
}

export function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function insertParsedEvents(userId: string, events: ParsedEvent[], title: string) {
  if (!events.length) return;
  const { data: cals } = await supabase.from("user_calendars").select("id").eq("user_id", userId).order("sort_order").limit(1);
  const calendarId = cals?.[0]?.id || null;
  const rows = events.map(e => ({
    user_id: userId, name: e.name, type: "", subject: "", date: e.date, time: e.time || "",
    end_date: e.date, end_time: "", all_day: !e.time, location: "", description: e.description,
    note: "", repeat_type: "none", repeat_end: "", source: "lesson-recording", source_title: title,
    auto_added: true, calendar_id: calendarId,
  }));
  const { error } = await supabase.from("calendar_events").insert(rows as any);
  if (error) throw error;
  window.dispatchEvent(new CustomEvent("calendarEventsExternallyAdded"));
}
