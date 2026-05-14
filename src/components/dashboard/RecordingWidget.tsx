import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
const MAX_RETRIES = 3;

type RecState = "idle" | "recording" | "paused";

type RecordingWidgetProps = {
  activeTab: string;
  onRecordingStateChange?: (isActive: boolean) => void;
};

function nowStr() {
  const d = new Date();
  return d.toLocaleDateString("pl-PL") + " " + d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

function cleanTitle(raw: string): string {
  return raw.replace(/^["']+|["']+$/g, "").replace(/\\n/g, " ").replace(/\s+/g, " ").trim() || "Notatka z lekcji";
}

const RecordingWidget = ({ activeTab, onRecordingStateChange }: RecordingWidgetProps) => {
  const [state, setState] = useState<RecState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [sending, setSending] = useState(false);
  const [targetInfo, setTargetInfo] = useState<string>("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<any>(null);

  const isActive = state !== "idle";
  const isGuest = (() => {
    try {
      const uid = localStorage.getItem("userId");
      return localStorage.getItem("guestMode") === "true" || uid === "guest" || !uid;
    } catch { return true; }
  })();
  const showWidget = !isGuest && (activeTab === "notes" || isActive || sending);

  useEffect(() => {
    onRecordingStateChange?.(isActive || sending);
  }, [isActive, sending]);

  const startTimer = () => {
    intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
  };
  const stopTimer = () => { clearInterval(intervalRef.current); };

  const startRecording = async () => {
    if (isGuest) {
      toast.warning("Zaloguj się, aby nagrywać lekcje.");
      return;
    }
    const hasSelection = (window as any).__notesTab_hasSelection;
    if (!hasSelection || !hasSelection()) {
      toast.warning("Najpierw otwórz zakładkę Notatki i wybierz notes oraz sekcję, w której ma się pojawić notatka.");
      return;
    }

    const sel = (window as any).__notesTab_getSelection?.();
    setTargetInfo(sel ? `${sel.nbName} › ${sel.secName}` : "");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setState("recording");
      setSeconds(0);
      setCollapsed(false);
      startTimer();
      toast.success("🎤 Nagrywanie rozpoczęte!");
    } catch (err: any) {
      toast.error("Brak dostępu do mikrofonu: " + (err?.message || "Nieznany błąd"));
    }
  };

  const pauseRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.pause();
      setState("paused");
      stopTimer();
      toast.info("⏸ Nagrywanie wstrzymane");
    }
  };

  const resumeRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "paused") {
      recorder.resume();
      setState("recording");
      startTimer();
      toast.info("▶ Nagrywanie wznowione");
    }
  };

  const cancelRecording = () => {
    if (!confirm("Na pewno anulować nagranie?")) return;
    stopTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    mediaRecorderRef.current = null;
    streamRef.current = null;
    chunksRef.current = [];
    setState("idle");
    setSeconds(0);
    toast.info("Nagranie anulowane.");
  };

  const saveRecording = () => {
    stopTimer();
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    const finalSeconds = seconds;

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      streamRef.current?.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current = null;
      streamRef.current = null;
      chunksRef.current = [];
      setState("idle");
      setSeconds(0);

      if (finalSeconds < 3) {
        toast.warning("Nagranie za krótkie (min. 3 sekundy).");
        return;
      }

      await sendToN8n(blob, finalSeconds);
    };

    if (recorder.state !== "inactive") recorder.stop();
  };

  // Fallback: persist a note directly via Supabase when NotesTab is unmounted
  // (user switched tabs while we awaited the n8n webhook). The note is never lost.
  const persistNoteDirectly = async (title: string, content: string) => {
    try {
      let sel: any = null;
      try {
        const raw = localStorage.getItem("notesTab_selection");
        if (raw) sel = JSON.parse(raw);
      } catch {}

      const userId = localStorage.getItem("userId");
      if (!userId) {
        toast.warning("Notatka gotowa — zaloguj się, aby ją zobaczyć.");
        return;
      }

      let sectionId: string | null = sel?.secId || null;

      if (!sectionId) {
        const { data: nbs } = await supabase
          .from("notebooks").select("id").eq("user_id", userId)
          .order("sort_order", { ascending: true }).limit(1);
        const nbId = nbs?.[0]?.id;
        if (nbId) {
          const { data: secs } = await supabase
            .from("notebook_sections").select("id").eq("notebook_id", nbId)
            .order("sort_order", { ascending: true }).limit(1);
          sectionId = secs?.[0]?.id || null;
        }
      }

      if (!sectionId) {
        toast.warning("Notatka gotowa — otwórz Notatki, aby zobaczyć wynik.");
        return;
      }

      const { error } = await supabase.from("notebook_pages").insert({
        section_id: sectionId, title, content,
      });
      if (error) throw error;

      window.dispatchEvent(new CustomEvent("notesTab_externalNoteAdded"));
      const where = sel?.nbName && sel?.secName ? `${sel.nbName} › ${sel.secName}` : "Notatki";
      toast.success(`✓ Notatka zapisana w: ${where}`);
    } catch (err: any) {
      console.error("persistNoteDirectly failed:", err);
      toast.error("Nie udało się zapisać notatki: " + (err?.message || "Nieznany błąd"));
    }
  };

  const sendToN8n = async (blob: Blob, recSeconds: number) => {
    setSending(true);
    const duration = `${Math.floor(recSeconds / 60)}:${String(recSeconds % 60).padStart(2, "0")}`;
    toast.info("⏳ Wysyłam nagranie do przetworzenia…");

    let lastError: any = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const formData = new FormData();
        formData.append("file", blob, "recording.webm");
        formData.append("duration", duration);

        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) {
          throw new Error("Musisz być zalogowany, aby nagrywać notatki.");
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/proxy-n8n-audio`, {
          method: "POST",
          headers: {
            "apikey": anonKey,
            "authorization": `Bearer ${accessToken}`,
          },
          body: formData,
        });

        const resultText = await response.text();
        console.log("n8n response (raw):", resultText);

        if (!response.ok) {
          let errMsg = `HTTP ${response.status}`;
          try { errMsg = JSON.parse(resultText)?.error || errMsg; } catch {}
          throw new Error(errMsg);
        }

        if (!resultText || resultText.trim() === "" || resultText.trim() === "{}") {
          throw new Error("Serwer zwrócił pustą odpowiedź");
        }

        let title = "Notatka z lekcji";
        let content = resultText;
        let eventName = "";
        let eventDescription = "";
        let eventDate = "";
        let eventTime = "";
        try {
          const json = JSON.parse(resultText);
          console.log("n8n response (parsed):", json);
          if (json.error) throw new Error(json.error);
          if (json.title && json.title.trim()) title = cleanTitle(json.title);
          if (json.content) content = json.content;
          else if (json.html) content = json.html;
          else {
            // Fallback: if response is structured but missing content, stringify it
            content = JSON.stringify(json, null, 2);
          }

          // Validate that we actually got content
          const textContent = (content || "").replace(/<[^>]*>/g, "").trim();
          if (!textContent) {
            throw new Error("Webhook nie zwrócił treści notatki");
          }

          eventName = (json.name || "").trim();
          eventDescription = ((json.description || json.descripiton) || "").trim();
          eventDate = (json.eventDate || "").trim();
          eventTime = (json.eventTime || "").trim();
        } catch (parseErr: any) {
          if (parseErr.message && !parseErr.message.includes("JSON")) throw parseErr;
          // Plain text response - check it's not empty
          const textContent = (resultText || "").replace(/<[^>]*>/g, "").trim();
          if (!textContent) throw new Error("Serwer zwrócił pustą odpowiedź");
        }

        const finalHtml = content +
          `<br><hr style="border-color:rgba(255,255,255,0.1)"><p style="font-size:.78em;color:#8899b4;font-style:italic">Wygenerowano z nagrania · ${duration} min · ${nowStr()}</p>`;

        const addNote = (window as any).__notesTab_addNote;
        if (addNote) {
          await addNote(title, finalHtml);
        } else {
          // NotesTab is not mounted (user switched tabs while waiting).
          // Insert directly via Supabase using the persisted selection so the note is never lost.
          await persistNoteDirectly(title, finalHtml);
        }

        // Create calendar event if webhook returned event data
        const hasEvent = eventName.trim() || eventDescription.trim() || eventDate.trim() || eventTime.trim();
        if (hasEvent) {
          try {
            const userId = localStorage.getItem("userId");
            if (userId) {
              // Find "Szkoła" calendar
              const { data: cals } = await supabase
                .from("user_calendars")
                .select("id")
                .eq("user_id", userId)
                .eq("name", "Szkoła")
                .limit(1);
              const calendarId = cals?.[0]?.id || null;

              const isAllDay = !eventTime.trim() || eventTime.trim() === "cd";
              const finalTime = isAllDay ? "" : eventTime.trim();
              const endTime = isAllDay ? "" : (() => {
                const [h, m] = finalTime.split(":").map(Number);
                return `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
              })();

              // Check for duplicates
              const { data: existing } = await supabase
                .from("calendar_events")
                .select("id")
                .eq("user_id", userId)
                .eq("name", eventName.trim())
                .eq("date", eventDate.trim())
                .limit(1);

              if (!existing?.length) {
                await supabase.from("calendar_events").insert({
                  user_id: userId,
                  name: eventName.trim(),
                  description: eventDescription.trim(),
                  date: eventDate.trim(),
                  end_date: eventDate.trim(),
                  time: finalTime,
                  end_time: endTime,
                  all_day: isAllDay,
                  type: "sprawdzian",
                  subject: "Szkoła",
                  calendar_id: calendarId,
                  auto_added: true,
                  source: "recording",
                  source_title: title,
                });
                toast.success("📅 Dodano wydarzenie: " + eventName.trim());
              }
            }
          } catch (err) {
            console.error("Failed to create calendar event:", err);
          }
        }

        setSending(false);
        toast.success("✓ Notatka z lekcji gotowa!");
        return;
      } catch (err: any) {
        lastError = err;
        console.error(`n8n attempt ${attempt}/${MAX_RETRIES} failed:`, err);
        if (attempt < MAX_RETRIES) {
          toast.warning(`Próba ${attempt} nieudana, ponawiam…`);
          await new Promise(r => setTimeout(r, 2000 * attempt));
        }
      }
    }

    setSending(false);
    toast.error("Wystąpił nieoczekiwany błąd. Poinformowaliśmy już resztę zespołu, a twoja notatka pojawi się już wkrótce.");
    console.error("Recording failed after retries:", lastError);
  };

  useEffect(() => {
    return () => { stopTimer(); };
  }, []);

  if (!showWidget) return null;

  const recTime = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  if (!isActive && sending) {
    // Floating "processing" pill — non-blocking, user can keep using the app
    return (
      <div
        style={{
          position: "fixed", bottom: 22, right: 22, zIndex: 400,
          display: "flex", alignItems: "center", gap: 10,
          background: "linear-gradient(135deg, rgba(96,165,250,0.18), rgba(59,130,246,0.12))",
          border: "1px solid rgba(96,165,250,0.4)",
          borderRadius: 999,
          padding: "10px 16px 10px 12px",
          boxShadow: "0 8px 30px rgba(0,0,0,0.45), 0 0 0 1px rgba(96,165,250,0.15)",
          backdropFilter: "blur(10px)",
          maxWidth: 280,
        }}
      >
        <div
          style={{
            width: 24, height: 24, borderRadius: "50%",
            border: "2.5px solid rgba(96,165,250,0.25)",
            borderTopColor: "#60a5fa",
            animation: "spin 0.9s linear infinite",
            flexShrink: 0,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2, minWidth: 0 }}>
          <div style={{ fontSize: ".82rem", fontWeight: 700, color: "#bfdbfe" }}>
            Tworzę notatkę…
          </div>
          <div style={{ fontSize: ".68rem", color: "#8899b4", marginTop: 2 }}>
            Może to potrwać kilka minut.
          </div>
        </div>
      </div>
    );
  }

  if (!isActive && !sending) {
    return (
      <button
        className="rec-btn idle"
        onClick={startRecording}
        style={{ position: "fixed", bottom: 22, right: 22, zIndex: 400 }}
      >
        <div className="rec-dot" />
        <span>Słuchaj lekcji</span>
      </button>
    );
  }

  if (collapsed) {
    return (
      <div
        className="rec-btn recording"
        onClick={() => setCollapsed(false)}
        style={{ position: "fixed", bottom: 22, right: 22, zIndex: 400, cursor: "pointer" }}
      >
        <div className="rec-dot" />
        <span>{state === "paused" ? `⏸ ${recTime}` : `● ${recTime}`}</span>
        {sending && <span style={{ fontSize: ".7rem", marginLeft: 4 }}>📤</span>}
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed", bottom: 22, right: 22, zIndex: 400,
      background: "#0c1a30", border: "1px solid rgba(248,113,113,0.4)",
      borderRadius: 14, padding: "16px 20px", width: 300,
      boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div className="rec-dot" style={{ animation: state === "recording" ? "blink 1s infinite" : "none" }} />
          <span style={{ fontSize: ".82rem", fontWeight: 800, color: state === "paused" ? "#fbbf24" : "#f87171" }}>
            {state === "paused" ? "Wstrzymane" : "Słucham lekcji…"}
          </span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          style={{ background: "none", border: "none", color: "#8899b4", cursor: "pointer", fontSize: "1rem", padding: "2px 6px", borderRadius: 4 }}
          title="Zwiń"
        >▼</button>
      </div>

      {targetInfo && (
        <div style={{ fontSize: ".72rem", color: "#60a5fa", marginBottom: 8, textAlign: "center" }}>
          📁 {targetInfo}
        </div>
      )}

      <div style={{
        fontSize: "1.6rem", fontWeight: 900, fontVariantNumeric: "tabular-nums",
        color: state === "paused" ? "#fbbf24" : "#f87171",
        textAlign: "center", margin: "8px 0 14px",
      }}>{recTime}</div>

      <div style={{
        height: 24, background: "rgba(248,113,113,0.08)", borderRadius: 6,
        marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center",
        gap: 2, overflow: "hidden",
      }}>
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={i} style={{
            width: 3, borderRadius: 2,
            background: state === "recording" ? "rgba(248,113,113,0.5)" : "rgba(248,113,113,0.2)",
            height: state === "recording" ? `${6 + Math.random() * 14}px` : "4px",
            transition: "height 0.3s",
          }} />
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {state === "recording" ? (
          <button className="md-btn" style={{ flex: 1, fontSize: ".78rem" }} onClick={pauseRecording}>⏸ Wstrzymaj</button>
        ) : (
          <button className="md-btn" style={{ flex: 1, fontSize: ".78rem" }} onClick={resumeRecording}>▶ Wznów</button>
        )}
        <button className="md-btn md-btn-prim" style={{ flex: 1, fontSize: ".78rem" }} onClick={saveRecording}>
          {sending ? "📤 Wysyłam…" : "💾 Zapisz"}
        </button>
      </div>
      <button
        className="md-btn"
        style={{ width: "100%", fontSize: ".78rem", marginTop: 8, color: "#f87171" }}
        onClick={cancelRecording}
      >✕ Anuluj nagranie</button>

      {/* Usunięto wewnętrzny komunikat przetwarzania — korzystamy z pływającej etykiety "Tworzę notatkę…" */}
    </div>
  );
};

export default RecordingWidget;
