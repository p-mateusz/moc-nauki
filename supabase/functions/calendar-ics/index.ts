import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from "../_shared/appSettings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toIcsUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

function toIcsDate(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

function escapeText(s: string): string {
  return (s || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldLine(line: string): string {
  // RFC5545: fold lines >75 octets with CRLF + space
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let i = 0;
  while (i < line.length) {
    chunks.push((i === 0 ? "" : " ") + line.slice(i, i + 73));
    i += 73;
  }
  return chunks.join("\r\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response("Missing token", { status: 400, headers: corsHeaders });
    }

    const adminSb = createAdminClient();
    const { data: profile, error: profileError } = await adminSb
      .from("user_calendar_feeds")
      .select("user_id")
      .eq("token", token)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response("Invalid token", { status: 404, headers: corsHeaders });
    }

    const userId = profile.user_id;

    const { data: events } = await adminSb
      .from("calendar_events")
      .select("*")
      .eq("user_id", userId);

    const now = new Date();
    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Moc Nauki//Calendar Feed//PL",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Moc Nauki",
      "X-WR-TIMEZONE:Europe/Warsaw",
    ];

    for (const ev of events || []) {
      const e = ev as Record<string, any>;
      const dateStr: string | undefined = e.date;
      if (!dateStr) continue;
      const allDay = !!e.all_day || !e.time;
      const timeStr: string = e.time || "00:00";
      const endDateStr: string = e.end_date || dateStr;
      const endTimeStr: string = e.end_time || (allDay ? "00:00" : timeStr);

      // Parse as local Europe/Warsaw -> use as floating local time via TZID-less UTC.
      // We treat input as local wall-clock; emit UTC stamps using server interpretation.
      const start = new Date(`${dateStr}T${timeStr}:00`);
      let end = new Date(`${endDateStr}T${endTimeStr}:00`);
      if (isNaN(start.getTime())) continue;
      if (isNaN(end.getTime()) || end <= start) {
        end = new Date(start.getTime() + 60 * 60 * 1000);
      }

      const uid = `${e.id}@mocnauki`;
      const summary = escapeText(e.name || "Wydarzenie");
      const description = escapeText(e.description || e.note || "");
      const location = escapeText(e.location || "");

      lines.push("BEGIN:VEVENT");
      lines.push(foldLine(`UID:${uid}`));
      lines.push(`DTSTAMP:${toIcsUtc(now)}`);
      if (allDay) {
        const endAllDay = new Date(end.getTime() + 24 * 60 * 60 * 1000);
        lines.push(`DTSTART;VALUE=DATE:${toIcsDate(start)}`);
        lines.push(`DTEND;VALUE=DATE:${toIcsDate(endAllDay)}`);
      } else {
        lines.push(`DTSTART:${toIcsUtc(start)}`);
        lines.push(`DTEND:${toIcsUtc(end)}`);
      }
      lines.push(foldLine(`SUMMARY:${summary}`));
      if (description) lines.push(foldLine(`DESCRIPTION:${description}`));
      if (location) lines.push(foldLine(`LOCATION:${location}`));
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");
    const body = lines.join("\r\n") + "\r\n";

    return new Response(body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": "inline; filename=\"mocnauki.ics\"",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    console.error("calendar-ics error:", e);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
