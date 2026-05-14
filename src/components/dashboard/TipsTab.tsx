import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  ExternalLink,
  Plus,
  X,
  Check,
  Clock,
  Trash2,
  Lightbulb,
  Sparkles,
  Search,
  ChevronDown,
  Link2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

interface Tip {
  id: string;
  user_id: string;
  title: string;
  description: string;
  url: string;
  approved: boolean;
  created_at: string;
}

interface TipsTabProps {
  userId: string;
  isAdmin: boolean;
  guestMode?: boolean;
}

const TipsTab = ({ userId, isAdmin, guestMode }: TipsTabProps) => {
  const [tips, setTips] = useState<Tip[]>([]);
  const [pendingTips, setPendingTips] = useState<Tip[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [expandedPending, setExpandedPending] = useState(true);

  const normalizeUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  const domainFromUrl = (value: string) => {
    try {
      return new URL(value).hostname.replace(/^www\./, "");
    } catch {
      return value;
    }
  };

  const isValidUrl = (value: string) => {
    try {
      new URL(normalizeUrl(value));
      return true;
    } catch {
      return false;
    }
  };

  const loadTips = async () => {
    setLoading(true);

    if (guestMode) {
      const demoTips: Tip[] = [
        {
          id: "demo1",
          user_id: "demo",
          title: "Anki — najlepsze fiszki",
          description: "Spaced repetition do skutecznej nauki słówek.",
          url: "https://apps.ankiweb.net/",
          approved: true,
          created_at: "2024-04-01",
        },
        {
          id: "demo2",
          user_id: "demo",
          title: "Forest — skupienie podczas nauki",
          description: "Pomaga utrzymać focus i ograniczyć rozpraszacze.",
          url: "https://www.forestapp.cc/",
          approved: true,
          created_at: "2024-04-02",
        },
        {
          id: "demo3",
          user_id: "demo",
          title: "Khan Academy",
          description: "Darmowe kursy matematyki, fizyki i programowania.",
          url: "https://www.khanacademy.org/",
          approved: true,
          created_at: "2024-04-03",
        },
        {
          id: "demo4",
          user_id: "demo",
          title: "Notion — organizacja wiedzy",
          description: "Świetne narzędzie do notatek i planowania nauki.",
          url: "https://www.notion.so/",
          approved: true,
          created_at: "2024-04-04",
        },
      ];

      setTips(demoTips);
      setPendingTips([]);
      setLoading(false);
      return;
    }

    const { data: approved } = await supabase
      .from("tips")
      .select("*")
      .eq("approved", true)
      .order("created_at", { ascending: false });

    setTips(approved || []);

    if (isAdmin) {
      const { data: pending } = await supabase
        .from("tips")
        .select("*")
        .eq("approved", false)
        .order("created_at", { ascending: false });

      setPendingTips(pending || []);
    } else {
      const { data: own } = await supabase
        .from("tips")
        .select("*")
        .eq("approved", false)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      setPendingTips(own || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadTips();
  }, []);

  const filteredTips = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (!q) return tips;

    return tips.filter(
      (tip) =>
        tip.title.toLowerCase().includes(q) ||
        tip.description.toLowerCase().includes(q) ||
        tip.url.toLowerCase().includes(q)
    );
  }, [tips, search]);

  const handleSubmit = async () => {
    if (!title.trim() || !url.trim()) return;

    const normalizedUrl = normalizeUrl(url);

    if (!isValidUrl(normalizedUrl)) {
      toast.error("Nieprawidłowy link");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from("tips").insert({
      user_id: userId,
      title: title.trim(),
      description: description.trim(),
      url: normalizedUrl,
      approved: isAdmin,
    });

    setSubmitting(false);

    if (error) {
      toast.error("Nie udało się dodać porady");
      return;
    }

    setTitle("");
    setDescription("");
    setUrl("");
    setShowForm(false);

    toast.success(
      isAdmin
        ? "Porada została dodana"
        : "Porada została wysłana do zatwierdzenia"
    );

    loadTips();
  };

  const handleApprove = async (tipId: string) => {
    await supabase.from("tips").update({ approved: true }).eq("id", tipId);

    toast.success("Porada zatwierdzona");
    loadTips();
  };

  const handleDelete = async (tipId: string) => {
    await supabase.from("tips").delete().eq("id", tipId);

    toast.success("Usunięto poradę");
    loadTips();
  };

  return (
    <div
      style={{
        padding: "24px 20px 80px",
        maxWidth: 860,
        margin: "0 auto",
      }}
    >
      {/* HERO */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 24,
          padding: "24px 24px 22px",
          background:
            "linear-gradient(135deg, rgba(99,102,241,0.22), rgba(59,130,246,0.12))",
          border: "1px solid rgba(99,102,241,0.22)",
          marginBottom: 18,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -60,
            right: -60,
            width: 180,
            height: 180,
            borderRadius: "50%",
            background: "rgba(99,102,241,0.16)",
            filter: "blur(40px)",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            position: "relative",
            zIndex: 1,
          }}
        >
          <div>
            <div
              className="md-page-title"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  background:
                    "linear-gradient(135deg, rgba(251,191,36,0.25), rgba(245,158,11,0.18))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid rgba(251,191,36,0.24)",
                  flexShrink: 0,
                }}
              >
                <Lightbulb size={24} style={{ color: "#fbbf24" }} />
              </div>

              <div>
                <div
                  style={{
                    fontSize: "1.45rem",
                    fontWeight: 900,
                    lineHeight: 1.1,
                  }}
                >
                  Porady edukacyjne
                </div>

                <div
                  style={{
                    fontSize: ".8rem",
                    color: "#8899b4",
                    marginTop: 4,
                  }}
                >
                  Najlepsze darmowe narzędzia i strony do nauki
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: "8px 12px",
                  borderRadius: 999,
                  fontSize: ".76rem",
                  color: "#c8d8f0",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Sparkles size={14} />
                {tips.length} sprawdzonych narzędzi
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: "8px 12px",
                  borderRadius: 999,
                  fontSize: ".76rem",
                  color: "#c8d8f0",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <ShieldCheck size={14} />
                Moderowane przez społeczność
              </div>
            </div>
          </div>

          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              style={{
                background:
                  "linear-gradient(135deg, rgba(99,102,241,1), rgba(79,70,229,1))",
                border: "none",
                color: "#fff",
                borderRadius: 14,
                padding: "12px 18px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 800,
                flexShrink: 0,
                boxShadow: "0 8px 30px rgba(99,102,241,0.35)",
              }}
            >
              <Plus size={18} />
              Dodaj poradę
            </button>
          )}
        </div>
      </div>

      {/* SEARCH */}
      <div
        style={{
          position: "relative",
          marginBottom: 18,
        }}
      >
        <Search
          size={16}
          style={{
            position: "absolute",
            top: "50%",
            left: 14,
            transform: "translateY(-50%)",
            color: "#64748b",
          }}
        />

        <input
          placeholder="Szukaj narzędzi, aplikacji, stron..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "12px 14px 12px 40px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            color: "#fff",
            outline: "none",
            fontSize: ".88rem",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* FORM */}
      {showForm && (
        <div
          style={{
            marginBottom: 22,
            padding: 20,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: "1rem",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Plus size={18} />
              Nowa porada
            </div>

            <button
              onClick={() => setShowForm(false)}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: "none",
                background: "rgba(255,255,255,0.06)",
                cursor: "pointer",
                color: "#8899b4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              placeholder="Tytuł porady"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
            />

            <textarea
              placeholder="Krótki opis (opcjonalnie)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{
                ...inputStyle,
                resize: "vertical",
                minHeight: 90,
                fontFamily: "inherit",
              }}
            />

            <div style={{ position: "relative" }}>
              <Link2
                size={15}
                style={{
                  position: "absolute",
                  top: 13,
                  left: 12,
                  color: "#64748b",
                }}
              />

              <input
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                style={{
                  ...inputStyle,
                  paddingLeft: 38,
                }}
              />
            </div>

            {!isAdmin && (
              <div
                style={{
                  fontSize: ".78rem",
                  color: "#8899b4",
                  background: "rgba(251,191,36,0.08)",
                  border: "1px solid rgba(251,191,36,0.16)",
                  padding: "10px 12px",
                  borderRadius: 12,
                }}
              >
                ℹ️ Twoja propozycja pojawi się po zatwierdzeniu przez
                administratora.
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={
                !title.trim() ||
                !url.trim() ||
                submitting ||
                !isValidUrl(url)
              }
              style={{
                height: 46,
                borderRadius: 12,
                border: "none",
                cursor: "pointer",
                fontWeight: 800,
                fontSize: ".88rem",
                color: "#fff",
                background:
                  !title.trim() || !url.trim() || !isValidUrl(url)
                    ? "rgba(255,255,255,0.08)"
                    : "linear-gradient(135deg, #6366f1, #4f46e5)",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting
                ? "Wysyłanie..."
                : isAdmin
                ? "Dodaj poradę"
                : "Wyślij do zatwierdzenia"}
            </button>
          </div>
        </div>
      )}

      {/* PENDING */}
      {pendingTips.length > 0 && (
        <div
          style={{
            marginBottom: 22,
            borderRadius: 18,
            overflow: "hidden",
            border: "1px solid rgba(251,191,36,0.14)",
            background: "rgba(251,191,36,0.04)",
          }}
        >
          <button
            onClick={() => setExpandedPending(!expandedPending)}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: ".86rem",
                fontWeight: 700,
                color: "#fbbf24",
              }}
            >
              <Clock size={15} />
              {isAdmin
                ? `Oczekujące (${pendingTips.length})`
                : `Twoje propozycje (${pendingTips.length})`}
            </div>

            <ChevronDown
              size={18}
              style={{
                transform: expandedPending
                  ? "rotate(180deg)"
                  : "rotate(0deg)",
                transition: ".2s",
                color: "#fbbf24",
              }}
            />
          </button>

          {expandedPending && (
            <div
              style={{
                padding: "0 14px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {pendingTips.map((tip) => (
                <div
                  key={tip.id}
                  style={{
                    display: "flex",
                    gap: 14,
                    alignItems: "center",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    padding: "14px",
                    borderRadius: 14,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: ".9rem",
                        marginBottom: 4,
                      }}
                    >
                      {tip.title}
                    </div>

                    {!!tip.description && (
                      <div
                        style={{
                          fontSize: ".78rem",
                          color: "#94a3b8",
                          lineHeight: 1.45,
                        }}
                      >
                        {tip.description}
                      </div>
                    )}

                    <div
                      style={{
                        marginTop: 6,
                        fontSize: ".72rem",
                        color: "#818cf8",
                      }}
                    >
                      {domainFromUrl(tip.url)}
                    </div>
                  </div>

                  {isAdmin && (
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexShrink: 0,
                      }}
                    >
                      <button
                        onClick={() => handleApprove(tip.id)}
                        style={approveBtn}
                      >
                        <Check size={16} />
                      </button>

                      <button
                        onClick={() => handleDelete(tip.id)}
                        style={deleteBtn}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LIST */}
      {loading ? (
        <div
          style={{
            padding: 50,
            textAlign: "center",
            color: "#8899b4",
          }}
        >
          Ładowanie porad...
        </div>
      ) : filteredTips.length === 0 ? (
        <div
          style={{
            padding: "60px 20px",
            textAlign: "center",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 24,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              margin: "0 auto 16px",
              background:
                "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(59,130,246,0.12))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2rem",
            }}
          >
            🔍
          </div>

          <div
            style={{
              fontWeight: 800,
              marginBottom: 6,
              fontSize: "1rem",
            }}
          >
            Nic nie znaleziono
          </div>

          <div
            style={{
              color: "#8899b4",
              fontSize: ".85rem",
            }}
          >
            Spróbuj zmienić wyszukiwaną frazę.
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 12,
          }}
        >
          {filteredTips.map((tip) => (
            <a
              key={tip.id}
              href={tip.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "18px",
                borderRadius: 20,
                textDecoration: "none",
                color: "inherit",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                transition: "all .18s ease",
                position: "relative",
                overflow: "hidden",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.borderColor =
                  "rgba(99,102,241,0.35)";
                e.currentTarget.style.background =
                  "rgba(255,255,255,0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor =
                  "rgba(255,255,255,0.08)";
                e.currentTarget.style.background =
                  "rgba(255,255,255,0.04)";
              }}
            >
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 16,
                  flexShrink: 0,
                  background:
                    "linear-gradient(135deg, rgba(99,102,241,0.22), rgba(59,130,246,0.14))",
                  border: "1px solid rgba(99,102,241,0.18)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.2rem",
                }}
              >
                🔗
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: ".96rem",
                    fontWeight: 800,
                    marginBottom: 4,
                    color: "#fff",
                  }}
                >
                  {tip.title}
                </div>

                {!!tip.description && (
                  <div
                    style={{
                      fontSize: ".82rem",
                      color: "#94a3b8",
                      lineHeight: 1.5,
                    }}
                  >
                    {tip.description}
                  </div>
                )}

                <div
                  style={{
                    marginTop: 8,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 10px",
                    borderRadius: 999,
                    background: "rgba(99,102,241,0.08)",
                    border: "1px solid rgba(99,102,241,0.14)",
                    fontSize: ".72rem",
                    color: "#818cf8",
                  }}
                >
                  <Link2 size={12} />
                  {domainFromUrl(tip.url)}
                </div>
              </div>

              <ExternalLink
                size={18}
                style={{
                  color: "#94a3b8",
                  flexShrink: 0,
                }}
              />

              {isAdmin && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete(tip.id);
                  }}
                  style={{
                    ...deleteBtn,
                    marginLeft: 4,
                  }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  color: "#fff",
  fontSize: ".88rem",
  outline: "none",
  boxSizing: "border-box",
};

const approveBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
  background: "rgba(34,197,94,0.15)",
  color: "#22c55e",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const deleteBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
  background: "rgba(239,68,68,0.15)",
  color: "#f87171",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export default TipsTab;