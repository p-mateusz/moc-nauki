import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getSessionSafe } from "@/lib/authSession";

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
    d.toLocaleTimeString("pl-PL", {
      hour: "2-digit",
      minute: "2-digit",
    })
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

const RecordingWidget = ({
  activeTab,
  onRecordingStateChange,
}: RecordingWidgetProps) => {
  const [state, setState] = useState<RecState>("idle");

  const [seconds, setSeconds] = useState(0);

  const [collapsed, setCollapsed] =
    useState(false);

  const [sending, setSending] =
    useState(false);

  const [targetInfo, setTargetInfo] =
    useState<string>("");

  const mediaRecorderRef =
    useRef<MediaRecorder | null>(null);

  const streamRef =
    useRef<MediaStream | null>(null);

  const chunksRef = useRef<Blob[]>([]);

  const intervalRef = useRef<any>(null);

  const isActive = state !== "idle";

  const isGuest = (() => {
    try {
      const uid =
        localStorage.getItem("userId");

      return (
        localStorage.getItem("guestMode") ===
          "true" ||
        uid === "guest" ||
        !uid
      );
    } catch {
      return true;
    }
  })();

  const showWidget =
    !isGuest &&
    (activeTab === "notes" ||
      isActive ||
      sending);

  useEffect(() => {
    onRecordingStateChange?.(
      isActive || sending
    );
  }, [isActive, sending]);

  const startTimer = () => {
    intervalRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
  };

  const stopTimer = () => {
    clearInterval(intervalRef.current);
  };

  const startRecording = async () => {
    if (isGuest) {
      toast.warning(
        "Zaloguj się, aby nagrywać lekcje."
      );

      return;
    }

    const hasSelection = (
      window as any
    ).__notesTab_hasSelection;

    if (!hasSelection || !hasSelection()) {
      toast.warning(
        "Najpierw otwórz zakładkę Notatki i wybierz notes oraz sekcję."
      );

      return;
    }

    const sel = (
      window as any
    ).__notesTab_getSelection?.();

    setTargetInfo(
      sel
        ? `${sel.nbName} › ${sel.secName}`
        : ""
    );

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: true,
            video: false,
          }
        );

      streamRef.current = stream;

      chunksRef.current = [];

      const recorder = new MediaRecorder(
        stream
      );

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.start(1000);

      mediaRecorderRef.current = recorder;

      setState("recording");

      setSeconds(0);

      setCollapsed(false);

      startTimer();

      toast.success(
        "🎤 Nagrywanie rozpoczęte!"
      );

      setTimeout(() => {
        setCollapsed(true);
      }, 10000);
    } catch (err: any) {
      toast.error(
        "Brak dostępu do mikrofonu: " +
          (err?.message ||
            "Nieznany błąd")
      );
    }
  };

  const pauseRecording = () => {
    const recorder =
      mediaRecorderRef.current;

    if (
      recorder &&
      recorder.state === "recording"
    ) {
      recorder.pause();

      setState("paused");

      stopTimer();

      toast.info(
        "⏸ Nagrywanie wstrzymane"
      );
    }
  };

  const resumeRecording = () => {
    const recorder =
      mediaRecorderRef.current;

    if (
      recorder &&
      recorder.state === "paused"
    ) {
      recorder.resume();

      setState("recording");

      startTimer();

      toast.info(
        "▶ Nagrywanie wznowione"
      );
    }
  };

  const cancelRecording = () => {
    if (
      !confirm(
        "Na pewno anulować nagranie?"
      )
    ) {
      return;
    }

    stopTimer();

    const recorder =
      mediaRecorderRef.current;

    if (
      recorder &&
      recorder.state !== "inactive"
    ) {
      recorder.stop();
    }

    streamRef.current
      ?.getTracks()
      .forEach((t) => t.stop());

    mediaRecorderRef.current = null;

    streamRef.current = null;

    chunksRef.current = [];

    setState("idle");

    setSeconds(0);

    toast.info("Nagranie anulowane.");
  };

  const saveRecording = () => {
    stopTimer();

    const recorder =
      mediaRecorderRef.current;

    if (!recorder) {
      return;
    }

    const finalSeconds = seconds;

    recorder.onstop = async () => {
      const blob = new Blob(
        chunksRef.current,
        {
          type: "audio/webm",
        }
      );

      streamRef.current
        ?.getTracks()
        .forEach((t) => t.stop());

      mediaRecorderRef.current = null;

      streamRef.current = null;

      chunksRef.current = [];

      setState("idle");

      setSeconds(0);

      if (finalSeconds < 3) {
        toast.warning(
          "Nagranie za krótkie."
        );

        return;
      }

      await sendToN8n(
        blob,
        finalSeconds
      );
    };

    if (
      recorder.state !== "inactive"
    ) {
      recorder.stop();
    }
  };

  const persistNoteDirectly = async (
    title: string,
    content: string
  ) => {
    try {
      let sel: any = null;

      try {
        const raw =
          localStorage.getItem(
            "notesTab_selection"
          );

        if (raw) {
          sel = JSON.parse(raw);
        }
      } catch {}

      const userId =
        localStorage.getItem("userId");

      if (!userId) {
        toast.warning(
          "Notatka gotowa — zaloguj się."
        );

        return;
      }

      let sectionId: string | null =
        sel?.secId || null;

      if (!sectionId) {
        const { data: nbs } =
          await supabase
            .from("notebooks")
            .select("id")
            .eq("user_id", userId)
            .order("sort_order", {
              ascending: true,
            })
            .limit(1);

        const nbId = nbs?.[0]?.id;

        if (nbId) {
          const { data: secs } =
            await supabase
              .from(
                "notebook_sections"
              )
              .select("id")
              .eq(
                "notebook_id",
                nbId
              )
              .order("sort_order", {
                ascending: true,
              })
              .limit(1);

          sectionId =
            secs?.[0]?.id || null;
        }
      }

      if (!sectionId) {
        toast.warning(
          "Notatka gotowa — otwórz Notatki."
        );

        return;
      }

      const { error } =
        await supabase
          .from("notebook_pages")
          .insert({
            section_id: sectionId,
            title,
            content,
          });

      if (error) {
        throw error;
      }

      window.dispatchEvent(
        new CustomEvent(
          "notesTab_externalNoteAdded"
        )
      );

      toast.success(
        "✓ Notatka zapisana"
      );
    } catch (err: any) {
      console.error(err);

      toast.error(
        "Nie udało się zapisać notatki"
      );
    }
  };

  const sendToN8n = async (
    blob: Blob,
    recSeconds: number
  ) => {
    setSending(true);

    const duration = `${Math.floor(
      recSeconds / 60
    )}:${String(
      recSeconds % 60
    ).padStart(2, "0")}`;

    toast.info(
      "⏳ Wysyłam nagranie…"
    );

    let lastError: any = null;

    for (
      let attempt = 1;
      attempt <= MAX_RETRIES;
      attempt++
    ) {
      try {
        const formData =
          new FormData();

        formData.append(
          "file",
          blob,
          "recording.webm"
        );

        formData.append(
          "duration",
          duration
        );

        const anonKey =
          import.meta.env
            .VITE_SUPABASE_PUBLISHABLE_KEY;

        const supabaseUrl =
          import.meta.env
            .VITE_SUPABASE_URL;

        const session = await getSessionSafe(2500);
        const accessToken = session?.access_token;

        if (!accessToken) {
          throw new Error(
            "Sesja wygasła — odśwież stronę i zaloguj się ponownie."
          );
        }

        const response =
          await fetch(
            `${supabaseUrl}/functions/v1/proxy-n8n-audio`,
            {
              method: "POST",
              headers: {
                apikey: anonKey,
                authorization: `Bearer ${accessToken}`,
              },
              body: formData,
            }
          );

        const resultText =
          await response.text();

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }

        let title =
          "Notatka z lekcji";

        let content = resultText;

        try {
          const json =
            JSON.parse(resultText);

          if (
            json.title &&
            json.title.trim()
          ) {
            title = cleanTitle(
              json.title
            );
          }

          if (json.content) {
            content = json.content;
          }
        } catch {}

        const finalHtml =
          content +
          `<br><hr style="border-color:rgba(255,255,255,0.1)">
          <p style="font-size:.78em;color:#8899b4;font-style:italic">
          Wygenerowano z nagrania · ${duration} · ${nowStr()}
          </p>`;

        const addNote = (
          window as any
        ).__notesTab_addNote;

        if (addNote) {
          await addNote(
            title,
            finalHtml
          );
        } else {
          await persistNoteDirectly(
            title,
            finalHtml
          );
        }

        setSending(false);

        toast.success(
          "✓ Notatka gotowa!"
        );

        return;
      } catch (err: any) {
        lastError = err;

        console.error(err);

        if (attempt < MAX_RETRIES) {
          toast.warning(
            `Próba ${attempt} nieudana…`
          );

          await new Promise((r) =>
            setTimeout(
              r,
              2000 * attempt
            )
          );
        }
      }
    }

    setSending(false);

    toast.error(
      "Wystąpił nieoczekiwany błąd."
    );

    console.error(lastError);
  };

  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, []);

  if (!showWidget) {
    return null;
  }

  const recTime = `${String(
    Math.floor(seconds / 60)
  ).padStart(2, "0")}:${String(
    seconds % 60
  ).padStart(2, "0")}`;

  if (!isActive && sending) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: 22,
          right: 22,
          zIndex: 400,

          display: "flex",
          alignItems: "center",
          gap: 10,

          background:
            "linear-gradient(135deg, rgba(96,165,250,0.18), rgba(59,130,246,0.12))",

          border:
            "1px solid rgba(96,165,250,0.4)",

          borderRadius: 999,

          padding:
            "10px 16px 10px 12px",

          backdropFilter:
            "blur(10px)",
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",

            border:
              "2.5px solid rgba(96,165,250,0.25)",

            borderTopColor:
              "#60a5fa",

            animation:
              "spin 0.9s linear infinite",
          }}
        />

        <div>
          <div
            style={{
              fontSize: ".82rem",
              fontWeight: 700,
              color: "#bfdbfe",
            }}
          >
            Tworzę notatkę…
          </div>

          <div
            style={{
              fontSize: ".68rem",
              color: "#8899b4",
            }}
          >
            To może chwilę potrwać.
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
        style={{
          position: "fixed",
          bottom: 22,
          right: 22,
          zIndex: 400,
        }}
      >
        <div className="rec-dot" />

        <span>
          Słuchaj lekcji
        </span>
      </button>
    );
  }

  return (
    <div
      onMouseEnter={(e) => {
        if (collapsed) {
          e.currentTarget.style.opacity =
            "0.55";
        }
      }}
      onMouseLeave={(e) => {
        if (collapsed) {
          e.currentTarget.style.opacity =
            "0.16";
        }
      }}
      onClick={() => {
        if (collapsed) {
          setCollapsed(false);
        }
      }}
      style={{
        position: "fixed",
        bottom: 22,
        right: 22,
        zIndex: 400,

        background: collapsed
          ? "rgba(12,26,48,0.10)"
          : "#0c1a30",

        border: collapsed
          ? "1px solid rgba(255,255,255,0.04)"
          : "1px solid rgba(248,113,113,0.4)",

        borderRadius: 14,

        padding: collapsed
          ? "8px 12px"
          : "16px 20px",

        width: collapsed ? 145 : 300,

        boxShadow: collapsed
          ? "none"
          : "0 8px 30px rgba(0,0,0,0.4)",

        backdropFilter: collapsed
          ? "blur(2px)"
          : "blur(12px)",

        opacity: collapsed ? 0.16 : 1,

        transition: "all .25s ease",

        cursor: collapsed
          ? "pointer"
          : "default",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent:
            "space-between",

          marginBottom: collapsed
            ? 0
            : 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <div
            className="rec-dot"
            style={{
              animation:
                state ===
                "recording"
                  ? "blink 1s infinite"
                  : "none",
            }}
          />

          {!collapsed && (
            <span
              style={{
                fontSize: ".82rem",
                fontWeight: 800,

                color:
                  state === "paused"
                    ? "#fbbf24"
                    : "#f87171",
              }}
            >
              {state === "paused"
                ? "Wstrzymane"
                : "Słucham lekcji…"}
            </span>
          )}
        </div>

        {!collapsed && (
          <button
            onClick={() =>
              setCollapsed(true)
            }
            style={{
              background: "none",
              border: "none",

              color: "#8899b4",

              cursor: "pointer",

              fontSize: "1rem",

              padding: "2px 6px",
            }}
          >
            ▼
          </button>
        )}
      </div>

      {targetInfo &&
        !collapsed && (
          <div
            style={{
              fontSize: ".72rem",
              color: "#60a5fa",

              marginBottom: 8,

              textAlign: "center",
            }}
          >
            📁 {targetInfo}
          </div>
        )}

      <div
        style={{
          fontSize: collapsed
            ? ".92rem"
            : "1.6rem",

          fontWeight: 900,

          fontVariantNumeric:
            "tabular-nums",

          color:
            state === "paused"
              ? "#fbbf24"
              : "#f87171",

          textAlign: "center",

          margin: collapsed
            ? "0"
            : "8px 0 14px",
        }}
      >
        {recTime}
      </div>

      {collapsed && (
        <div
          style={{
            textAlign: "center",

            fontSize: ".62rem",

            color:
              "rgba(255,255,255,0.45)",

            marginTop: -2,

            letterSpacing: ".5px",
          }}
        >
          REC
        </div>
      )}

      {!collapsed && (
        <div
          style={{
            height: 24,

            background:
              "rgba(248,113,113,0.08)",

            borderRadius: 6,

            marginBottom: 14,

            display: "flex",

            alignItems: "center",

            justifyContent:
              "center",

            gap: 2,

            overflow: "hidden",
          }}
        >
          {Array.from({
            length: 30,
          }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 3,

                borderRadius: 2,

                background:
                  state ===
                  "recording"
                    ? "rgba(248,113,113,0.5)"
                    : "rgba(248,113,113,0.2)",

                height:
                  state ===
                  "recording"
                    ? `${
                        6 +
                        Math.random() *
                          14
                      }px`
                    : "4px",

                transition:
                  "height 0.3s",
              }}
            />
          ))}
        </div>
      )}

      {!collapsed && (
        <>
          <div
            style={{
              display: "flex",
              gap: 8,
            }}
          >
            {state ===
            "recording" ? (
              <button
                className="md-btn"
                style={{
                  flex: 1,
                  fontSize: ".78rem",
                }}
                onClick={
                  pauseRecording
                }
              >
                ⏸ Wstrzymaj
              </button>
            ) : (
              <button
                className="md-btn"
                style={{
                  flex: 1,
                  fontSize: ".78rem",
                }}
                onClick={
                  resumeRecording
                }
              >
                ▶ Wznów
              </button>
            )}

            <button
              className="md-btn md-btn-prim"
              style={{
                flex: 1,
                fontSize: ".78rem",
              }}
              onClick={saveRecording}
            >
              {sending
                ? "📤 Wysyłam…"
                : "💾 Zapisz"}
            </button>
          </div>

          <button
            className="md-btn"
            style={{
              width: "100%",
              fontSize: ".78rem",
              marginTop: 8,
              color: "#f87171",
            }}
            onClick={cancelRecording}
          >
            ✕ Anuluj nagranie
          </button>
        </>
      )}
    </div>
  );
};

export default RecordingWidget;