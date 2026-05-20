import { Skeleton } from "@/components/ui/skeleton";

/**
 * Pełnoekranowy splash – ciemny motyw dashboardu.
 * Animowany loader + delikatny tekst, bez surowego "Ładowanie..." w środku ekranu.
 */
export function LoadingScreen({ label = "Ładowanie…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "#060d1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 18,
        padding: 24,
      }}
    >
      <Spinner />
      <span style={{ color: "#8899b4", fontSize: 14, letterSpacing: 0.2 }}>{label}</span>
    </div>
  );
}

/**
 * Inline loader dla zakładek/sekcji wewnątrz dashboardu.
 */
export function LoadingInline({ label = "Ładowanie…", minHeight = 160 }: { label?: string; minHeight?: number }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight,
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 12,
        color: "#8899b4",
        fontSize: 14,
      }}
    >
      <Spinner size={22} />
      <span>{label}</span>
    </div>
  );
}

/**
 * Skeleton listy – używać tam, gdzie znamy strukturę (lista wiadomości,
 * notatek, przypomnień itd.). Daje lepsze "perceived performance" niż
 * spinner pośrodku.
 */
export function LoadingList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full bg-white/5" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3 bg-white/5" />
            <Skeleton className="h-3 w-2/3 bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Spinner({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: "2px solid rgba(136, 153, 180, 0.25)",
        borderTopColor: "#7aa8ff",
        display: "inline-block",
        animation: "mn-spin 0.9s linear infinite",
      }}
    />
  );
}

// Globalna keyframe — wstrzykujemy raz, żeby nie zaśmiecać index.css.
if (typeof document !== "undefined" && !document.getElementById("mn-spin-keyframes")) {
  const style = document.createElement("style");
  style.id = "mn-spin-keyframes";
  style.textContent = "@keyframes mn-spin { to { transform: rotate(360deg); } }";
  document.head.appendChild(style);
}
