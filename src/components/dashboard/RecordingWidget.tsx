import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { invokeCloudFunction, supabase } from "@/lib/supabase";
import { getCachedPreferences, notePreferenceHint } from "@/hooks/use-preferences";

const MAX_RETRIES = 3;

type RecState = "idle" | "recording" | "paused";

type RecordingWidgetProps = {
 activeTab?: string;
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
   raw.replace(/^["']+|["']+$/g, "").replace(/\\n/g, " ").replace(/\s+/g, " ").trim() ||
   "Notatka z lekcji"
 );
}

const RecordingWidget = ({ activeTab: activeTabProp, onRecordingStateChange }: RecordingWidgetProps = {}) => {
 const location = useLocation();
 const [currentTab, setCurrentTab] = useState<string>(() => {
   try { return activeTabProp || localStorage.getItem("dashboardActiveTab") || ""; } catch { return activeTabProp || ""; }
 });
 useEffect(() => {
   const handler = (e: any) => setCurrentTab(e?.detail || localStorage.getItem("dashboardActiveTab") || "");
   window.addEventListener("dashboardActiveTabChanged", handler as any);
   return () => window.removeEventListener("dashboardActiveTabChanged", handler as any);
 }, []);
 const activeTab = activeTabProp ?? currentTab;
 const onDashboard = location.pathname === "/dashboard";
 const [state, setState] = useState<RecState>("idle");
 const [seconds, setSeconds] = useState(0);
 const [collapsed, setCollapsed] = useState(false);
 const [sending, setSending] = useState(false);
 const [targetInfo, setTargetInfo] = useState<string>("");
   const mediaRecorderRef = useRef<MediaRecorder | null>(null);
   const streamRef = useRef<MediaStream | null>(null);
   const chunksRef = useRef<Blob[]>([]);
   const intervalRef = useRef<any>(null);
   const targetSelectionRef = useRef<{ nbId: string; secId: string; nbName?: string; secName?: string } | null>(null);
    const wakeLockRef = useRef<any>(null);
    const keepAliveAudioRef = useRef<{ ctx: AudioContext; stop: () => void } | null>(null);
   const secondsRef = useRef(0);
   const lostHandledRef = useRef(false);
  const isActive = state !== "idle";

  useEffect(() => { secondsRef.current = seconds; }, [seconds]);

 const isGuest = (() => {
   try {
     const uid = localStorage.getItem("userId");
     return localStorage.getItem("guestMode") === "true" || uid === "guest" || !uid;
   } catch { return true; }
 })();

 const showWidget = !isGuest && ((onDashboard && activeTab === "notes") || isActive || sending);

 useEffect(() => { onRecordingStateChange?.(isActive || sending); }, [isActive, sending]);

 const startTimer = () => { intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000); };
 const stopTimer = () => clearInterval(intervalRef.current);

 // Wake Lock — utrzymuje aktywny tab/ekran, gdy użytkownik wraca lub gdy
 // przeglądarka nasłuchuje aktywności. Po przejściu do tła OS zwalnia lock,
 // dlatego wznawiamy go automatycznie po powrocie do widoczności.
 const requestWakeLock = async () => {
   try {
     // @ts-ignore
     if (navigator.wakeLock?.request) {
       // @ts-ignore
       wakeLockRef.current = await navigator.wakeLock.request("screen");
     }
   } catch {}
 };
 const releaseWakeLock = async () => {
   try { await wakeLockRef.current?.release?.(); } catch {}
   wakeLockRef.current = null;
 };

  const configureRecordingAudioSession = () => {
    try {
      const audioSession = (navigator as any).audioSession;
      if (audioSession && "type" in audioSession) audioSession.type = "play-and-record";
    } catch {}
    try { if ((navigator as any).mediaSession) (navigator as any).mediaSession.playbackState = "playing"; } catch {}
  };
  const clearRecordingAudioSession = () => {
    try { if ((navigator as any).mediaSession) (navigator as any).mediaSession.playbackState = "none"; } catch {}
  };

  // Aktywna, prawie niesłyszalna ścieżka Web Audio podpięta do mikrofonu.
  // To jest najmocniejszy webowy sposób, żeby mobilny system traktował kartę
  // jak sesję audio/nagrywania zamiast zwykłą, łatwą do uśpienia stronę.
  const startKeepAliveAudio = (stream?: MediaStream | null) => {
   try {
      configureRecordingAudioSession();
      if (keepAliveAudioRef.current) {
        keepAliveAudioRef.current.ctx.resume?.().catch?.(() => {});
        return;
      }
     const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
     if (!AC) return;
     const ctx: AudioContext = new AC();
     const gain = ctx.createGain();
      gain.gain.value = 0.00001;
      const osc = ctx.createOscillator();
      osc.frequency.value = 18;
      osc.connect(gain);
      const micSource = stream ? ctx.createMediaStreamSource(stream) : null;
      micSource?.connect(gain);
      gain.connect(ctx.destination);
      osc.start(0);
      ctx.resume?.().catch?.(() => {});
      keepAliveAudioRef.current = {
        ctx,
        stop: () => {
          try { osc.stop(); } catch {}
          try { micSource?.disconnect(); } catch {}
          try { gain.disconnect(); } catch {}
          try { ctx.close(); } catch {}
        },
      };
   } catch {}
 };
 const stopKeepAliveAudio = () => {
   try {
      keepAliveAudioRef.current?.stop();
   } catch {}
   keepAliveAudioRef.current = null;
 };

   // Gdy system mimo zabezpieczeń faktycznie zakończy strumień mikrofonu —
   // przełącz w PAUZĘ (zachowujemy nagrane chunks). Nie traktujemy samego
   // wyciszenia/mute przy zmianie aplikacji jako zerwania, bo na mobile to
   // często chwilowy stan i nie powinien zatrzymywać nagrywania.
  const handleMicLost = () => {
    if (lostHandledRef.current) return;
    lostHandledRef.current = true;
    const recorder = mediaRecorderRef.current;
    stopTimer();
    try { if (recorder && recorder.state !== "inactive") recorder.stop(); } catch {}
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    streamRef.current = null;
    // Zachowujemy chunksRef i secondsRef — wznowienie dopisze kolejne fragmenty.
    setState("paused");
    setCollapsed(false);
    toast.warning("System odebrał mikrofon. Naciśnij „Wznów”, by kontynuować nagrywanie.");
  };

  const attachStreamGuards = (stream: MediaStream) => {
    stream.getAudioTracks().forEach((track) => {
      track.onended = () => handleMicLost();
       track.onmute = null;
    });
  };

  // Ukryty <audio> z odtwarzanym strumieniem mikrofonu (muted) — utrzymuje
  // ścieżkę "in use" i zmniejsza szansę, że iOS/Android ją zwolnią w tle.
  const sinkAudioRef = useRef<HTMLAudioElement | null>(null);
  const attachStreamToSink = (stream: MediaStream) => {
    try {
      if (!sinkAudioRef.current) {
        const el = document.createElement("audio");
        el.muted = true;
        (el as any).playsInline = true;
        el.setAttribute("playsinline", "");
        el.style.position = "fixed";
        el.style.width = "1px";
        el.style.height = "1px";
        el.style.opacity = "0";
        el.style.pointerEvents = "none";
        document.body.appendChild(el);
        sinkAudioRef.current = el;
      }
      sinkAudioRef.current.srcObject = stream;
      sinkAudioRef.current.play().catch(() => {});
    } catch {}
  };
  const detachStreamFromSink = () => {
    try {
      if (sinkAudioRef.current) {
        sinkAudioRef.current.pause();
        sinkAudioRef.current.srcObject = null;
      }
    } catch {}
  };

  const startRecording = async () => {
    if (isGuest) { toast.warning("Zaloguj się, aby nagrywać lekcje."); return; }
    const hasSelection = (window as any).__notesTab_hasSelection;
    if (!hasSelection || !hasSelection()) {
      toast.warning("Najpierw otwórz zakładkę Notatki i wybierz notes oraz sekcję.");
      return;
    }
     const sel = (window as any).__notesTab_getSelection?.();
     targetSelectionRef.current = sel && sel.nbId && sel.secId ? { nbId: sel.nbId, secId: sel.secId, nbName: sel.nbName, secName: sel.secName } : null;
     setTargetInfo(sel ? `${sel.nbName} › ${sel.secName}` : "");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      streamRef.current = stream;
      chunksRef.current = [];
      lostHandledRef.current = false;
      attachStreamGuards(stream);
      attachStreamToSink(stream);
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(1000);
     mediaRecorderRef.current = recorder;
     setState("recording");
     setSeconds(0);
     setCollapsed(false);
     startTimer();
     // Flaga globalna — App.tsx pomija reviveSession (invalidate/refetch),
     // a inne moduły mogą sprawdzić, że trwa nagrywanie.
     (window as any).__recordingActive = true;
     await requestWakeLock();
      startKeepAliveAudio(stream);
     toast.success("🎤 Nagrywanie rozpoczęte!");
     setTimeout(() => setCollapsed(true), 10000);
   } catch (err: any) {
     toast.error("Brak dostępu do mikrofonu: " + (err?.message || "Nieznany błąd"));
   }
 };

  const pauseRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.pause(); setState("paused"); stopTimer(); toast.info("⏸ Nagrywanie wstrzymane");
    }
  };

  const resumeRecording = async () => {
    const recorder = mediaRecorderRef.current;
    // Normalna pauza — MediaRecorder żyje, tylko wznawiamy.
    if (recorder && recorder.state === "paused") {
      try {
        recorder.resume();
        setState("recording");
        startTimer();
        toast.info("▶ Nagrywanie wznowione");
        return;
      } catch {}
    }
    // Mic został zerwany — ponownie żądamy dostępu (musi być w geście użytkownika).
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      streamRef.current = stream;
      lostHandledRef.current = false;
      attachStreamGuards(stream);
      attachStreamToSink(stream);
      const newRec = new MediaRecorder(stream);
      newRec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      newRec.start(1000);
      mediaRecorderRef.current = newRec;
      setState("recording");
      startTimer();
      await requestWakeLock();
      startKeepAliveAudio(stream);
      toast.success("▶ Wznowiono nagrywanie");
    } catch (err: any) {
      toast.error("Nie udało się odzyskać mikrofonu: " + (err?.message || "Nieznany błąd"));
    }
  };


  const cancelRecording = () => {
    if (!confirm("Na pewno anulować nagranie?")) return;
    stopTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null;
    streamRef.current = null;
    chunksRef.current = [];
    setState("idle");
    setSeconds(0);
    (window as any).__recordingActive = false;
    releaseWakeLock();
    stopKeepAliveAudio();
    detachStreamFromSink();
    toast.info("Nagranie anulowane.");
  };

  const finalizeAndSend = async (finalSeconds: number) => {
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    streamRef.current?.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null;
    streamRef.current = null;
    chunksRef.current = [];
    setState("idle");
    setSeconds(0);
    (window as any).__recordingActive = false;
    releaseWakeLock();
    stopKeepAliveAudio();
    detachStreamFromSink();
    if (finalSeconds < 3) { toast.warning("Nagranie za krótkie."); return; }
    await sendToN8n(blob, finalSeconds);
  };

  const saveRecording = () => {
    stopTimer();
    const finalSeconds = seconds;
    const recorder = mediaRecorderRef.current;
    // Gdy mic został zerwany (paused bez żywego recordera) — zapisz z chunks.
    if (!recorder || recorder.state === "inactive") {
      void finalizeAndSend(finalSeconds);
      return;
    }
    recorder.onstop = () => { void finalizeAndSend(finalSeconds); };
    recorder.stop();
  };


  const persistNoteDirectly = async (title: string, content: string) => {
    try {
      let sel: any = targetSelectionRef.current;
      if (!sel) {
        try { const raw = localStorage.getItem("notesTab_selection"); if (raw) sel = JSON.parse(raw); } catch {}
      }
      const userId = localStorage.getItem("userId");
      if (!userId) { toast.warning("Notatka gotowa — zaloguj się."); return; }
      let sectionId: string | null = sel?.secId || null;
     if (!sectionId) {
       const { data: nbs } = await supabase.from("notebooks").select("id").eq("user_id", userId).order("sort_order", { ascending: true }).limit(1);
       const nbId = nbs?.[0]?.id;
       if (nbId) {
         const { data: secs } = await supabase.from("notebook_sections").select("id").eq("notebook_id", nbId).order("sort_order", { ascending: true }).limit(1);
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

  const insertEventsFromWebhook = async (json: any, fallbackTitle: string) => {
    const userId = localStorage.getItem("userId");
    if (!userId || userId === "guest") return;

    const normalize = (e: any) => {
      if (!e || typeof e !== "object") return null;
      const name = (e.name || e.title || e.eventName || "").toString().trim();
      const date = (e.eventDate || e.date || e.startDate || "").toString().trim();
      if (!name || !date) return null;
      // accept YYYY-MM-DD or DD.MM.YYYY
      let isoDate = date;
      const m = date.match(/^(\d{2})[.\-\/](\d{2})[.\-\/](\d{4})$/);
      if (m) isoDate = `${m[3]}-${m[2]}-${m[1]}`;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
      let time = (e.eventTime || e.time || e.startTime || "").toString().trim();
      // Treat all-day markers ("cd", "cały dzień", "all-day", "całodniowe", "-") as no time
      const lower = time.toLowerCase();
      const allDayMarkers = ["cd", "c.d.", "cały dzień", "caly dzien", "all-day", "all day", "allday", "całodniowe", "calodniowe", "całodzienne", "calodzienne", "-", "—", "brak"];
      if (allDayMarkers.includes(lower)) time = "";
      // Also blank out anything that's not HH:MM(:SS) format
      if (time && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(time)) time = "";
      const description = (e.description || e.descripiton || e.desc || "").toString().trim();
      return { name, date: isoDate, time, description };
    };

    const candidates: any[] = [];
    if (Array.isArray(json.events)) candidates.push(...json.events);
    if (json.event) candidates.push(json.event);
    if (Array.isArray(json)) candidates.push(...json);
    // single top-level event shape
    if (json.eventDate || json.eventTime || (json.name && json.date)) candidates.push(json);

    const events = candidates.map(normalize).filter(Boolean) as Array<{ name: string; date: string; time: string; description: string }>;
    if (events.length === 0) return;

    // Get default calendar
    const { data: cals } = await supabase.from("user_calendars").select("id").eq("user_id", userId).order("sort_order").limit(1);
    const calendarId = cals?.[0]?.id || null;

    const rows = events.map(e => ({
      user_id: userId,
      name: e.name,
      type: "",
      subject: "",
      date: e.date,
      time: e.time || "",
      end_date: e.date,
      end_time: "",
      all_day: !e.time,
      location: "",
      description: e.description,
      note: "",
      repeat_type: "none",
      repeat_end: "",
      source: "lesson-recording",
      source_title: fallbackTitle,
      auto_added: true,
      calendar_id: calendarId,
    }));

    const { error } = await supabase.from("calendar_events").insert(rows);
    if (error) {
      console.error("calendar_events insert error:", error);
      toast.warning("Notatka zapisana, ale nie udało się dodać wydarzenia do kalendarza");
      return;
    }
    window.dispatchEvent(new CustomEvent("calendarEventsExternallyAdded"));
    toast.success(events.length > 1 ? `📅 Dodano ${events.length} wydarzeń do kalendarza` : "📅 Dodano wydarzenie do kalendarza");
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
       const userPrefs = getCachedPreferences();
       formData.append("noteLanguageMode", userPrefs.noteLanguageMode);
       formData.append("noteLanguageHint", notePreferenceHint(userPrefs.noteLanguageMode));
       const resultText = await invokeCloudFunction<string>("proxy-n8n-audio", { body: formData, responseType: "text" });
        let title = "Notatka z lekcji";
        let content = resultText;
        let parsedJson: any = null;
        try {
          parsedJson = JSON.parse(resultText);
          if (parsedJson.title && parsedJson.title.trim()) title = cleanTitle(parsedJson.title);
          if (parsedJson.content) content = parsedJson.content;
        } catch {}
        const finalHtml = content;
         const addNote = (window as any).__notesTab_addNote;
         const snap = targetSelectionRef.current;
         if (addNote) await addNote(title, finalHtml, snap?.nbId, snap?.secId);
         else await persistNoteDirectly(title, finalHtml);
         targetSelectionRef.current = null;
        if (parsedJson) {
          try { await insertEventsFromWebhook(parsedJson, title); } catch (e) { console.error("insertEventsFromWebhook failed:", e); }
        }
        setSending(false);
        toast.success("✓ Notatka gotowa!");
        return;
     } catch (err: any) {
       lastError = err;
       console.error(err);
       if (attempt < MAX_RETRIES) { toast.warning(`Próba ${attempt} nieudana…`); await new Promise((r) => setTimeout(r, 2000 * attempt)); }
     }
   }
   setSending(false);
   toast.error("Wystąpił nieoczekiwany błąd.");
   console.error(lastError);
 };

 useEffect(() => { return () => stopTimer(); }, []);

   // Wznów Wake Lock po powrocie z tła. Nie pauzujemy na `muted`, bo przeglądarki
   // mobilne często oznaczają tak strumień podczas przełączania aplikacji mimo,
   // że po powrocie nagrywanie może być kontynuowane.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (!isActive && !sending) return;
      if (!wakeLockRef.current) requestWakeLock();
       configureRecordingAudioSession();
       startKeepAliveAudio(streamRef.current);
      // Czy strumień mikrofonu nadal żyje? Mobile OS często go ubija w tle.
      const stream = streamRef.current;
      if (state === "recording" && stream) {
        const tracks = stream.getAudioTracks();
         const dead = tracks.length === 0 || tracks.every((t) => t.readyState === "ended");
        if (dead) handleMicLost();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [isActive, sending, state]);

 // Ostrzeżenie przed zamknięciem karty w trakcie nagrywania/wysyłki.
 useEffect(() => {
   if (!isActive && !sending) return;
   const onBeforeUnload = (e: BeforeUnloadEvent) => {
     e.preventDefault();
     e.returnValue = "Trwa nagrywanie lekcji — opuszczenie strony przerwie nagranie.";
     return e.returnValue;
   };
   window.addEventListener("beforeunload", onBeforeUnload);
   return () => window.removeEventListener("beforeunload", onBeforeUnload);
 }, [isActive, sending]);

 if (!showWidget) return null;

 const recTime = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
 const isPaused = state === "paused";
 const accentColor = isPaused ? "#fbbf24" : "#f87171";
 const accentGlow = isPaused ? "rgba(251,191,36,0.25)" : "rgba(248,113,113,0.25)";

 // Sending state
 if (!isActive && sending) {
   return (
     <div style={{
       position: "fixed", bottom: 22, right: 22, zIndex: 400,
       display: "flex", alignItems: "center", gap: 12,
       background: "linear-gradient(135deg, rgba(15,25,50,0.97), rgba(10,18,38,0.97))",
       border: "1px solid rgba(96,165,250,0.3)",
       borderRadius: 16, padding: "12px 18px",
       backdropFilter: "blur(16px)",
       boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(96,165,250,0.1)",
     }}>
       <div style={{
         width: 28, height: 28, borderRadius: "50%",
         border: "2.5px solid rgba(96,165,250,0.15)",
         borderTopColor: "#60a5fa",
         animation: "spin 0.9s linear infinite",
         flexShrink: 0,
       }} />
       <div>
         <div style={{ fontSize: ".82rem", fontWeight: 700, color: "#bfdbfe", letterSpacing: ".01em" }}>Tworzę notatkę…</div>
         <div style={{ fontSize: ".68rem", color: "#8899b4", marginTop: 2 }}>To może chwilę potrwać.</div>
       </div>
     </div>
   );
 }

 // Idle state — original button style kept
 if (!isActive && !sending) {
   return (
     <button className="rec-btn idle" onClick={startRecording} style={{ position: "fixed", bottom: 22, right: 22, zIndex: 400 }}>
       <div className="rec-dot" />
       <span>Słuchaj lekcji</span>
     </button>
   );
 }

 // Collapsed ghost state — more visible than before
 if (collapsed) {
   return (
     <div
       onClick={() => setCollapsed(false)}
       style={{
         position: "fixed", bottom: 22, right: 22, zIndex: 400,
         display: "flex", alignItems: "center", gap: 10,
         background: "rgba(12,26,48,0.82)",
         border: `1px solid ${accentColor}55`,
         borderRadius: 999, padding: "9px 16px 9px 12px",
         backdropFilter: "blur(10px)",
         boxShadow: `0 4px 20px rgba(0,0,0,0.35), 0 0 0 1px ${accentColor}22`,
         cursor: "pointer",
         transition: "all .2s ease",
       }}
       onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
       onMouseLeave={e => (e.currentTarget.style.opacity = "0.85")}
     >
       <div style={{
         width: 8, height: 8, borderRadius: "50%",
         background: accentColor,
         boxShadow: `0 0 8px ${accentColor}`,
         animation: isPaused ? "none" : "blink 1s infinite",
         flexShrink: 0,
       }} />
       <span style={{ fontSize: ".82rem", fontWeight: 800, color: accentColor, letterSpacing: ".02em" }}>
         {recTime}
       </span>
       <span style={{ fontSize: ".68rem", color: "#8899b4", letterSpacing: ".5px" }}>
         {isPaused ? "PAUZA" : "REC"}
       </span>
     </div>
   );
 }

 // Active / expanded state
 return (
   <div style={{
     position: "fixed", bottom: 22, right: 22, zIndex: 400,
     background: "linear-gradient(160deg, rgba(14,24,46,0.98) 0%, rgba(10,18,38,0.98) 100%)",
     border: `1px solid ${accentColor}55`,
     borderRadius: 20, padding: "18px 18px 16px",
     width: 290,
     boxShadow: `0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px ${accentColor}18, 0 0 40px ${accentGlow}`,
     backdropFilter: "blur(16px)",
     transition: "all .25s ease",
   }}>

     {/* Header row */}
     <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
       <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
         <div style={{
           width: 8, height: 8, borderRadius: "50%",
           background: accentColor,
           boxShadow: `0 0 10px ${accentColor}`,
           animation: isPaused ? "none" : "blink 1s infinite",
         }} />
         <span style={{ fontSize: ".78rem", fontWeight: 700, color: accentColor, letterSpacing: ".04em", textTransform: "uppercase" }}>
           {isPaused ? "Wstrzymano" : "Słucham lekcji"}
         </span>
       </div>
       <button
         onClick={() => setCollapsed(true)}
         style={{
           background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
           borderRadius: 8, color: "#8899b4", cursor: "pointer",
           fontSize: ".7rem", padding: "3px 8px", lineHeight: 1.4,
           transition: "all .15s",
         }}
         onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)"; }}
         onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
       >
         zwiń
       </button>
     </div>

     {/* Target info */}
     {targetInfo && (
       <div style={{
         fontSize: ".7rem", color: "#60a5fa", marginBottom: 12,
         background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.15)",
         borderRadius: 8, padding: "5px 10px",
       }}>
         📁 {targetInfo}
       </div>
     )}

     {/* Timer */}
     <div style={{
       fontSize: "2.4rem", fontWeight: 900, fontVariantNumeric: "tabular-nums",
       color: accentColor, textAlign: "center",
       margin: "4px 0 14px",
       textShadow: `0 0 24px ${accentGlow}`,
       letterSpacing: ".04em",
     }}>
       {recTime}
     </div>

     {/* Waveform */}
     <div style={{
       height: 28, borderRadius: 8, marginBottom: 16,
       background: `${accentColor}0d`,
       border: `1px solid ${accentColor}18`,
       display: "flex", alignItems: "center", justifyContent: "center",
       gap: 2.5, overflow: "hidden", padding: "0 8px",
     }}>
       {Array.from({ length: 28 }).map((_, i) => (
         <div key={i} style={{
           width: 3, borderRadius: 2,
           background: isPaused ? `${accentColor}30` : `${accentColor}70`,
           height: isPaused ? "4px" : `${6 + Math.random() * 16}px`,
           transition: "height 0.25s ease",
         }} />
       ))}
     </div>

     {/* Main action buttons */}
     <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
       {/* Pause / Resume */}
       <button
         onClick={isPaused ? resumeRecording : pauseRecording}
         style={{
           flex: 1, padding: "10px 0",
           background: "rgba(255,255,255,0.05)",
           border: "1px solid rgba(255,255,255,0.1)",
           borderRadius: 12, color: "#cbd5e1",
           fontSize: ".8rem", fontWeight: 600,
           cursor: "pointer", transition: "all .15s",
           display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
         }}
         onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.2)"; }}
         onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)"; }}
       >
         {isPaused ? "▶ Wznów" : "⏸ Pauza"}
       </button>

       {/* Save */}
       <button
         onClick={saveRecording}
         style={{
           flex: 1, padding: "10px 0",
           background: "linear-gradient(135deg, rgba(248,113,113,0.22), rgba(239,68,68,0.15))",
           border: "1px solid rgba(248,113,113,0.4)",
           borderRadius: 12, color: "#fca5a5",
           fontSize: ".8rem", fontWeight: 700,
           cursor: "pointer", transition: "all .15s",
           display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
         }}
         onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "linear-gradient(135deg, rgba(248,113,113,0.35), rgba(239,68,68,0.25))"; }}
         onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "linear-gradient(135deg, rgba(248,113,113,0.22), rgba(239,68,68,0.15))"; }}
       >
         💾 Zapisz
       </button>
     </div>

     {/* Cancel button */}
     <button
       onClick={cancelRecording}
       style={{
         width: "100%", padding: "8px 0",
         background: "transparent",
         border: "1px solid rgba(248,113,113,0.15)",
         borderRadius: 12, color: "#f8717166",
         fontSize: ".75rem", fontWeight: 600,
         cursor: "pointer", transition: "all .15s",
         letterSpacing: ".02em",
       }}
       onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(248,113,113,0.35)"; (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(248,113,113,0.06)"; }}
       onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(248,113,113,0.15)"; (e.currentTarget as HTMLButtonElement).style.color = "#f8717166"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
     >
       Anuluj nagranie
     </button>
   </div>
 );
};

export default RecordingWidget;
