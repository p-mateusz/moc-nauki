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
  return (
    d.toLocaleDateString("pl-PL") +
    " " +
    d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })
  );
}

function cleanTitle(raw: string): string {
  return (
    raw
      .replace(/^["']+|["']+$/g, "")
      .replace(/\\n/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Notatka z lekcji"
  );
}

const RecordingWidget = ({ activeTab, onRecordingStateChange }: RecordingWidgetProps) => {
  const [state, setState] = useState<RecState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [sending, setSending] = useState(false);
  const [targetInfo, setTargetInfo] = useState<string>("");
  const [bars, setBars] = useState<number[]>(Array.from({ length: 20 }, () => 4));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<any>(null);
  const barsIntervalRef = useRef<any>(null);

  const isActive = state !== "idle";

  const isGuest = (() => {
    try {
      const uid = localStorage.getItem("userId");
      return localStorage.getItem("guestMode") === "true" || uid === "guest" || !uid;
    } catch {
      return true;
    }
  })();

  const showWidget = !isGuest && (activeTab === "notes" || isActive || sending);

  useEffect(() => {
    onRecordingStateChange?.(isActive || sending);
  }, [isActive, sending]);

  const startTimer = () => {
    intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stopTimer = () => clearInterval(intervalRef.current);

  const startBars = () => {
    barsIntervalRef.current = setInterval(() => {
      setBars(Array.from({ length: 20 }, () => 3 + Math.random() * 22));
    }, 120);
  };

  const stopBars = () => {
    clearInterval(barsIntervalRef.current);
    setBars(Array.from({ length: 20 }, () => 4));
  };

  const startRecording = async () => {
    if (isGuest) {
      toast.warning("Zaloguj się, aby nagrywać lekcje.");
      return;
    }

    const hasSelection = (window as any).__notesTab_hasSelection;
    if (!hasSelection || !hasSelection()) {
      toast.warning("Najpierw otwórz zakładkę Notatki i wybierz notes oraz sekcję.");
      return;
    }

    const sel = (window as any).__notesTab_getSelection?.();
    setTargetInfo(sel ? `${sel.nbName} › ${sel.secName}` : "");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;

      setState("recording");
      setSeconds(0);
      setCollapsed(false);
      startTimer();
      startBars();
      toast.success("🎤 Nagrywanie rozpoczęte!");

      setTimeout(() => setCollapsed(true), 10000);
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
      stopBars();
      toast.info("⏸ Nagrywanie wstrzymane");
    }
  };

  const resumeRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "paused") {
      recorder.resume();
      setState("recording");
      startTimer();
      startBars();
      toast.info("▶ Nagrywanie wznowione");
    }
  };

  const cancelRecording = () => {
    if (!confirm("Na pewno anulować nagranie?")) return;

    stopTimer();
    stopBars();

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();

    streamRef.current?.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null;
    streamRef.current = null;
    chunksRef.current = [];

    setState("idle");
    setSeconds(0);
    toast.info("Nagranie anulowane.");
  };

  const saveRecording = () => {
    stopTimer();
    stopBars();

    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    const finalSeconds = seconds;

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current = null;
      streamRef.current = null;
      chunksRef.current = [];
      setState("idle");
      setSeconds(0);

      if (finalSeconds < 3) {
        toast.warning("Nagranie za krótkie.");
        return;
      }

      await sendToN8n(blob, finalSeconds);
    };

    if (recorder.state !== "inactive") recorder.stop();
  };

  const persistNoteDirectly = async (title: string, content: string) => {
    try {
      let sel: any = null;
      try {
        const raw = localStorage.getItem("notesTab_selection");
        if (raw) sel = JSON.parse(raw);
      } catch {}

      const userId = localStorage.getItem("userId");
      if (!userId) { toast.warning("Notatka gotowa — zaloguj się."); return; }

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

      if (!sectionId) { toast.warning("Notatka gotowa — otwórz Notatki."); return; }

      const { error } = await supabase.from("notebook_pages").insert({ section_id: sectionId, title, content });
      if (error) throw error;

      window.dispatchEvent(new CustomEvent("notesTab_externalNoteAdded"));
      toast.success("✓ Notatka zapisana");
    } catch (err: any) {
      console.error(err);
      toast.error("Nie udało się zapisać notatki");
    }
  };

  const sendToN8n = async (blob: Blob, recSeconds: number) => {
    setSending(true);
    const duration = `${Math.floor(recSeconds / 60)}:${String(recSeconds % 60).padStart(2, "0")}`;
    toast.info("⏳ Wysyłam nagranie…");

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
        if (!accessToken) throw new Error("Musisz być zalogowany.");

        const response = await fetch(`${supabaseUrl}/functions/v1/proxy-n8n-audio`, {
          method: "POST",
          headers: { apikey: anonKey, authorization: `Bearer ${accessToken}` },
          body: formData,
        });

        const resultText = await response.text();
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        let title = "Notatka z lekcji";
        let content = resultText;

        try {
          const json = JSON.parse(resultText);
          if (json.title?.trim()) title = cleanTitle(json.title);
          if (json.content) content = json.content;
        } catch {}

        const finalHtml =
          content +
          `<br><hr style="border-color:rgba(255,255,255,0.1)">
          <p style="font-size:.78em;color:#8899b4;font-style:italic">
          Wygenerowano z nagrania · ${duration} · ${nowStr()}
          </p>`;

        const addNote = (window as any).__notesTab_addNote;
        if (addNote) await addNote(title, finalHtml);
        else await persistNoteDirectly(title, finalHtml);

        setSending(false);
        toast.success("✓ Notatka gotowa!");
        return;
      } catch (err: any) {
        lastError = err;
        console.error(err);
        if (attempt < MAX_RETRIES) {
          toast.warning(`Próba ${attempt} nieudana…`);
          await new Promise((r) => setTimeout(r, 2000 * attempt));
        }
      }
    }

    setSending(false);
    toast.error("Wystąpił nieoczekiwany błąd.");
    console.error(lastError);
  };

  useEffect(() => {
    return () => {
      stopTimer();
      stopBars();
    };
  }, []);

  if (!showWidget) return null;

  const recTime = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  // ── SENDING STATE ──
  if (!isActive && sending) {
    return (
      <div style={{
        position: "fixed", bottom: 22, right: 22, zIndex: 400,
        display: "flex", alignItems: "center", gap: 12,
        background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.10))",
        border: "1px solid rgba(139,92,246,0.35)",
        borderRadius: 16, padding: "12px 18px 12px 14px",
        backdropFilter: "blur(14px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: "50%",
          border: "2.5px solid rgba(139,92,246,0.2)",
          borderTopColor: "#a78bfa",
          animation: "spin 0.9s linear infinite",
        }} />
        <div>
          <div style={{ fontSize: ".83rem", fontWeight: 700, color: "#c4b5fd" }}>Tworzę notatkę…</div>
          <div style={{ fontSize: ".69rem", color: "#8899b4", marginTop: 2 }}>To może chwilę potrwać.</div>
        </div>
      </div>
    );
  }

  // ── IDLE STATE ──
  if (!isActive && !sending) {
    return (
      <button
        onClick={startRecording}
        style={{
          position: "fixed", bottom: 22, right: 22, zIndex: 400,
          display: "flex", alignItems: "center", gap: 9,
          background: "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(139,92,246,0.13))",
          border: "1px solid rgba(139,92,246,0.4)",
          borderRadius: 999, padding: "11px 18px 11px 14px",
          cursor: "pointer", backdropFilter: "blur(12px)",
          boxShadow: "0 4px 20px rgba(139,92,246,0.2)",
          transition: "all .2s ease",
          color: "#c4b5fd", fontSize: ".84rem", fontWeight: 700,
        }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 6px 28px rgba(139,92,246,0.38)")}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 4px 20px rgba(139,92,246,0.2)")}
      >
        <div style={{
          width: 9, height: 9, borderRadius: "50%",
          background: "#a78bfa",
          boxShadow: "0 0 8px rgba(167,139,250,0.8)",
          animation: "blink 2s ease-in-out infinite",
        }} />
        Słuchaj lekcji
      </button>
    );
  }

  // ── ACTIVE STATE ──
  return (
    <div
      onClick={() => { if (collapsed) setCollapsed(false); }}
      style={{
        position: "fixed", bottom: 22, right: 22, zIndex: 400,
        background: collapsed ? "rgba(10,15,30,0.12)" : "rgba(10,15,30,0.92)",
        border: collapsed
          ? "1px solid rgba(255,255,255,0.05)"
          : "1px solid rgba(139,92,246,0.4)",
        borderRadius: 18,
        padding: collapsed ? "9px 14px" : "18px 20px",
        width: collapsed ? 130 : 290,
        boxShadow: collapsed ? "none" : "0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.1)",
        backdropFilter: collapsed ? "blur(4px)" : "blur(16px)",
        opacity: collapsed ? 0.18 : 1,
        transition: "all .25s ease",
        cursor: collapsed ? "pointer" : "default",
      }}
      onMouseEnter={e => { if (collapsed) e.currentTarget.style.opacity = "0.55"; }}
      onMouseLeave={e => { if (collapsed) e.currentTarget.style.opacity = "0.18"; }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: collapsed ? 0 : 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: state === "paused" ? "#fbbf24" : "#a78bfa",
            boxShadow: state === "paused"
              ? "0 0 8px rgba(251,191,36,0.7)"
              : "0 0 8px rgba(167,139,250,0.8)",
            animation: state === "recording" ? "blink 1.2s ease-in-out infinite" : "none",
          }} />
          {!collapsed && (
            <span style={{
              fontSize: ".8rem", fontWeight: 700, letterSpacing: ".3px",
              color: state === "paused" ? "#fde68a" : "#c4b5fd",
            }}>
              {state === "paused" ? "Wstrzymane" : "Słucham lekcji…"}
            </span>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            style={{
              background: "rgba(255,255,255,0.05)", border: "none",
              color: "#64748b", cursor: "pointer", fontSize: ".75rem",
              padding: "3px 8px", borderRadius: 6, lineHeight: 1,
              transition: "background .15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
          >
            ▼
          </button>
        )}
      </div>

      {/* Target info */}
      {targetInfo && !collapsed && (
        <div style={{
          fontSize: ".71rem", color: "#818cf8", marginBottom: 10,
          textAlign: "center", background: "rgba(99,102,241,0.08)",
          borderRadius: 6, padding: "4px 8px",
        }}>
          📁 {targetInfo}
        </div>
      )}

      {/* Timer */}
      <div style={{
        fontSize: collapsed ? ".9rem" : "2rem",
        fontWeight: 900, fontVariantNumeric: "tabular-nums",
        color: state === "paused" ? "#fde68a" : "#e0d7ff",
        textAlign: "center",
        margin: collapsed ? "0" : "6px 0 12px",
        letterSpacing: collapsed ? "1px" : "2px",
      }}>
        {recTime}
      </div>

      {collapsed && (
        <div style={{
          textAlign: "center", fontSize: ".6rem",
          color: "rgba(255,255,255,0.4)", marginTop: -2, letterSpacing: "1px",
        }}>
          REC
        </div>
      )}

      {/* Waveform bars */}
      {!collapsed && (
        <div style={{
          height: 32, borderRadius: 8, marginBottom: 14,
          background: "rgba(99,102,241,0.06)",
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 2.5, overflow: "hidden", padding: "0 6px",
        }}>
          {bars.map((h, i) => (
            <div key={i} style={{
              width: 3, borderRadius: 3,
              background: state === "recording"
                ? `rgba(167,139,250,${0.35 + (h / 25) * 0.55})`
                : "rgba(167,139,250,0.15)",
              height: state === "recording" ? `${h}px` : "4px",
              transition: "height 0.1s ease",
            }} />
          ))}
        </div>
      )}

      {/* Buttons */}
      {!collapsed && (
        <>
          <div style={{ display: "flex", gap: 8 }}>
            {state === "recording" ? (
              <button
                onClick={pauseRecording}
                style={{
                  flex: 1, fontSize: ".78rem", fontWeight: 600,
                  padding: "8px 0", borderRadius: 9, cursor: "pointer",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#94a3b8", transition: "all .15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
              >
                ⏸ Wstrzymaj
              </button>
            ) : (
              <button
                onClick={resumeRecording}
                style={{
                  flex: 1, fontSize: ".78rem", fontWeight: 600,
                  padding: "8px 0", borderRadius: 9, cursor: "pointer",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#94a3b8", transition: "all .15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
              >
                ▶ Wznów
              </button>
            )}

            <button
              onClick={saveRecording}
              style={{
                flex: 1, fontSize: ".78rem", fontWeight: 700,
                padding: "8px 0", borderRadius: 9, cursor: "pointer",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none", color: "#fff", transition: "all .15s",
                boxShadow: "0 2px 12px rgba(99,102,241,0.4)",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              {sending ? "📤 Wysyłam…" : "💾 Zapisz"}
            </button>
          </div>

          <button
            onClick={cancelRecording}
            style={{
              width: "100%", fontSize: ".75rem", fontWeight: 600,
              padding: "7px 0", borderRadius: 9, cursor: "pointer",
              background: "transparent",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "rgba(239,68,68,0.6)", marginTop: 8,
              transition: "all .15s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(239,68,68,0.08)";
              e.currentTarget.style.color = "rgba(239,68,68,0.85)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "rgba(239,68,68,0.6)";
            }}
          >
            ✕ Anuluj nagranie
          </button>
        </>
      )}
    </div>
  );
};

export default RecordingWidget;
