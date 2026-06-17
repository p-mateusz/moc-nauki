import { useState, useEffect } from "react";
import { toast } from "sonner";
import { usePreferences, NoteLanguageMode } from "@/hooks/use-preferences";
import { LANGUAGE_META, DEFAULT_LANGUAGE_ORDER, type Language } from "@/lib/i18n";

type Props = {
  open: boolean;
  onClose: () => void;
};

const PreferencesDialog = ({ open, onClose }: Props) => {
  const { prefs, update } = usePreferences();
  const [noteMode, setNoteMode] = useState<NoteLanguageMode>(prefs.noteLanguageMode);
  const [hidden, setHidden] = useState<string[]>(prefs.hiddenLanguages);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(prefs.confirmDelete);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNoteMode(prefs.noteLanguageMode);
      setHidden(prefs.hiddenLanguages);
      setConfirmDelete(prefs.confirmDelete);
    }
  }, [open, prefs]);

  if (!open) return null;

  const toggleLang = (l: Language) => {
    setHidden((prev) => {
      const next = prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l];
      if (next.length >= DEFAULT_LANGUAGE_ORDER.length) {
        toast.warning("Musisz mieć włączony przynajmniej 1 język");
        return prev;
      }
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    const { error } = await update({
      noteLanguageMode: noteMode,
      hiddenLanguages: hidden,
      confirmDelete,
    });
    setSaving(false);
    if (error) {
      toast.error("Nie udało się zapisać preferencji");
      return;
    }
    toast.success("Preferencje zapisane");
    onClose();
  };

  const sectionStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  };
  const titleStyle: React.CSSProperties = {
    fontSize: ".82rem",
    fontWeight: 800,
    color: "#fff",
    marginBottom: 4,
  };
  const subStyle: React.CSSProperties = {
    fontSize: ".74rem",
    color: "#94a3b8",
    marginBottom: 10,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 16, backdropFilter: "blur(8px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0f172a", borderRadius: 20, padding: 22,
          maxWidth: 500, width: "100%", maxHeight: "85vh", overflowY: "auto",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <h3 style={{ fontSize: "1.1rem", fontWeight: 900, marginBottom: 18, color: "#fff" }}>
          ⚙️ Preferencje
        </h3>

        {/* Note language */}
        <div style={sectionStyle}>
          <div style={titleStyle}>Notatki z lekcji w innych językach</div>
          <div style={subStyle}>
            Wybierz w jakim języku ma być zapisana treść notatki. Słówka zawsze pozostają w języku oryginalnym.
          </div>
          {[
            { v: "original" as const, label: "W oryginalnym języku lekcji" },
            { v: "polish" as const, label: "Po polsku (słówka w oryginale)" },
          ].map((opt) => (
            <label
              key={opt.v}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                borderRadius: 10, cursor: "pointer",
                background: noteMode === opt.v ? "rgba(99,102,241,0.15)" : "transparent",
                border: noteMode === opt.v ? "1px solid rgba(99,102,241,0.5)" : "1px solid transparent",
                marginBottom: 6,
              }}
            >
              <input
                type="radio"
                name="noteMode"
                checked={noteMode === opt.v}
                onChange={() => setNoteMode(opt.v)}
              />
              <span style={{ color: "#e2e8f0", fontSize: ".85rem", fontWeight: 600 }}>{opt.label}</span>
            </label>
          ))}
        </div>

        {/* Visible languages */}
        <div style={sectionStyle}>
          <div style={titleStyle}>Widoczne języki w „Języki AI"</div>
          <div style={subStyle}>
            Odznacz języki których nie chcesz się uczyć — zostaną ukryte na zakładce Języki AI.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {DEFAULT_LANGUAGE_ORDER.map((l) => {
              const isHidden = hidden.includes(l);
              const meta = LANGUAGE_META[l];
              return (
                <label
                  key={l}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 12px", borderRadius: 12, cursor: "pointer",
                    background: isHidden ? "rgba(255,255,255,0.03)" : "rgba(99,102,241,0.18)",
                    border: isHidden
                      ? "1px solid rgba(255,255,255,0.08)"
                      : "1px solid rgba(99,102,241,0.5)",
                    opacity: isHidden ? 0.55 : 1,
                    fontSize: ".82rem", fontWeight: 700, color: "#fff",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!isHidden}
                    onChange={() => toggleLang(l)}
                  />
                  <span>{meta.flag} {meta.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Confirm delete */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div style={titleStyle}>Potwierdzenie przy usuwaniu</div>
              <div style={{ ...subStyle, marginBottom: 0 }}>
                Wymagaj dodatkowego kliknięcia / pytania przed usunięciem list i notatek.
              </div>
            </div>
            <label style={{ position: "relative", display: "inline-block", width: 46, height: 26 }}>
              <input
                type="checkbox"
                checked={confirmDelete}
                onChange={(e) => setConfirmDelete(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span
                style={{
                  position: "absolute", cursor: "pointer", inset: 0,
                  background: confirmDelete ? "linear-gradient(135deg,#3b82f6,#6366f1)" : "rgba(255,255,255,0.15)",
                  borderRadius: 26, transition: ".2s",
                }}
              />
              <span
                style={{
                  position: "absolute", top: 3, left: confirmDelete ? 23 : 3,
                  width: 20, height: 20, borderRadius: "50%", background: "#fff",
                  transition: ".2s",
                }}
              />
            </label>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "10px 18px", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent", color: "#fff", cursor: "pointer", fontWeight: 700,
            }}
          >Anuluj</button>
          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: "10px 18px", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff",
              cursor: "pointer", fontWeight: 800, opacity: saving ? 0.6 : 1,
            }}
          >{saving ? "Zapisywanie…" : "Zapisz"}</button>
        </div>
      </div>
    </div>
  );
};

export default PreferencesDialog;
