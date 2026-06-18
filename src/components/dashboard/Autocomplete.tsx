import { useEffect, useRef, useState, CSSProperties } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  maxLength?: number;
  inputStyle?: CSSProperties;
};

export default function Autocomplete({ value, onChange, options, placeholder, maxLength, inputStyle }: Props) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = value.trim().toLowerCase();
  const filtered = q
    ? options.filter(o => o.toLowerCase().includes(q) && o.toLowerCase() !== q)
    : options;
  const showList = open && filtered.length > 0;

  const pick = (v: string) => { onChange(v); setOpen(false); setHi(-1); };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setHi(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (!showList) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
          else if (e.key === "Enter" && hi >= 0) { e.preventDefault(); pick(filtered[hi]); }
          else if (e.key === "Escape") { setOpen(false); }
        }}
        placeholder={placeholder}
        maxLength={maxLength}
        style={inputStyle}
        autoComplete="off"
      />
      {showList && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
          background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10,
          boxShadow: "0 10px 30px rgba(0,0,0,0.4)", maxHeight: 200, overflowY: "auto",
        }}>
          {filtered.slice(0, 30).map((opt, i) => (
            <div
              key={opt}
              onMouseDown={e => { e.preventDefault(); pick(opt); }}
              onMouseEnter={() => setHi(i)}
              style={{
                padding: "8px 12px", cursor: "pointer", fontSize: ".88rem",
                color: "#cbd5e1",
                background: i === hi ? "rgba(99,102,241,0.18)" : "transparent",
              }}
            >{opt}</div>
          ))}
        </div>
      )}
    </div>
  );
}
