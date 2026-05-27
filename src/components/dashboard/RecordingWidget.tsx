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
   raw.replace(/^["']+|["']+$/g, "").replace(/\\n/g, " ").replace(/\s+/g, " ").trim() ||
   "Notatka z lekcji"
 );
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
  const targetSelectionRef = useRef<{ nbId: string; secId: string; nbName?: string; secName?: string } | null>(null);
 const isActive = state !== "idle";

 const isGuest = (() => {
   try {
     const uid = localStorage.getItem("userId");
     return localStorage.getItem("guestMode") === "true" || uid === "guest" || !uid;
   } catch { return true; }
 })();

 const showWidget = !isGuest && (activeTab === "notes" || isActive || sending);

 useEffect(() => { onRecordingStateChange?.(isActive || sending); }, [isActive, sending]);

 const startTimer = () => { intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000); };
 const stopTimer = () => clearInterval(intervalRef.current);

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

 const resumeRecording = () => {
   const recorder = mediaRecorderRef.current;
   if (recorder && recorder.state === "paused") {
     recorder.resume(); setState("recording"); startTimer(); toast.info("▶ Nagrywanie wznowione");
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
   toast.info("Nagranie anulowane.");
 };

 const saveRecording = () => {
   stopTimer();
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
     if (finalSeconds < 3) { toast.warning("Nagranie za krótkie."); return; }
     await sendToN8n(blob, finalSeconds);
   };
   if (recorder.state !== "inactive") recorder.stop();
 };

 const persistNoteDirectly = async (title: string, content: string) => {
   try {
     let sel: any = null;
     try { const raw = localStorage.getItem("notesTab_selection"); if (raw) sel = JSON.parse(raw); } catch {}
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
         if (json.title && json.title.trim()) title = cleanTitle(json.title);
         if (json.content) content = json.content;
       } catch {}
       const finalHtml = content;
       const addNote = (window as any).__notesTab_addNote;
       if (addNote) await addNote(title, finalHtml);
       else await persistNoteDirectly(title, finalHtml);
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
