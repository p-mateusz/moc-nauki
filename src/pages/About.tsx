import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { motion } from "framer-motion";
import { invokeCloudFunction } from "@/lib/supabase";
import TermsModal, { DocumentType } from "@/components/TermsModal";
import { Seo } from "@/components/Seo";
import konstantyAvatar from "@/assets/konstanty.jpg.asset.json";
import "./LandingPage.css";

const About = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const aboutRef = useRef<HTMLElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [termsDocument, setTermsDocument] = useState<DocumentType | null>(null);

  const openTermsDocument = (docType: DocumentType) => setTermsDocument(docType);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(
      () => setCooldown((v) => Math.max(0, v - 1)),
      1000
    );
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!location.hash) return;
    
    const sectionId = location.hash.slice(1);
    const target = document.getElementById(sectionId);
    const header = document.querySelector(".lp-nav");
    const headerHeight = header?.clientHeight ?? 88;
    
    if (target) {
      const top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 12;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
  }, [location.hash]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToJoin = () => {
    const target = document.getElementById("dolacz");
    if (target) {
      const header = document.querySelector(".lp-nav");
      const headerHeight = header?.clientHeight ?? 88;
      const top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 12;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
  };

  const submitForm = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (cooldown > 0) return;

    setShowSuccess(false);

    const form = e.currentTarget;
    const inputs =
      form.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >("input, textarea, select");

    let valid = true;

    inputs.forEach((i) => {
      if (!i.value.trim()) {
        i.style.borderColor = "#ef4444";
        valid = false;
      } else {
        i.style.borderColor = "";
      }
    });

    if (!valid) {
      alert("Wypełnij wszystkie pola formularza.");
      return;
    }

    const [name, email, learning, achievements, motivation] = Array.from(
      inputs
    ).map((i) => i.value.trim());

    try {
      const data = await invokeCloudFunction<{ success?: boolean; succeed?: string }>("submit-form", {
        body: { name, email, learning, achievements, motivation },
        accessToken: null,
      });

      if (data?.success || data?.succeed === "yes") {
        setShowSuccess(true);

        inputs.forEach((i) => (i.value = ""));
        setCooldown(60);

        setTimeout(() => setShowSuccess(false), 5000);
      } else {
        alert("Błąd przy wysyłaniu zgłoszenia. Spróbuj ponownie.");
      }
    } catch (err) {
      console.error("Webhook error:", err);
      alert("Błąd przy wysyłaniu zgłoszenia. Spróbuj ponownie.");
    }
  };

  const team = [
    {
      initials: "M",
      name: "Mateusz",
      role: "Nauczyciel matematyki",
      color: "linear-gradient(135deg,#3b82f6,#6366f1)",
      avatar: "/avatars/mateusz.jpg",
    },
    {
      initials: "F",
      name: "Filip",
      role: "Nauczyciel angielskiego",
      color: "linear-gradient(135deg,#a78bfa,#6366f1)",
    },
    {
      initials: "E",
      name: "Julia",
      role: "Finalistka Olimpiady Języka Hiszpańskiego",
      color: "linear-gradient(135deg,#34d399,#059669)",
    },
    {
      initials: "K",
      name: "Konstanty",
      role: "Laureat Olimpiady Przedsiębiorczości",
      color: "linear-gradient(135deg,#f59e0b,#ef4444)",
      avatar: konstantyAvatar.url,
    },
  ];

  return (
    <div className="landing-root" id="top">
      <Seo title="O platformie Moc Nauki — Nasza misja i zespół" description="Poznaj zespół Moc Nauki i naszą misję — platformę edukacyjną stworzoną przez uczniów dla uczniów." path="/about" />
      <h1 className="sr-only">O platformie Moc Nauki — Nasza misja i zespół</h1>
      {/* NAV */}
      <nav
        className="lp-nav"
        style={{
          background: scrolled
            ? "rgba(6,13,26,0.92)"
            : "rgba(6,13,26,0.55)",
          boxShadow: scrolled
            ? "0 1px 0 rgba(255,255,255,0.06)"
            : "none",
          transition: "background .3s, box-shadow .3s",
        }}
      >
        <div className="logo" onClick={() => navigate("/#top")}>
          Moc Nauki
        </div>

        <button
          className="lp-hamburger"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Menu"
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <div className="nav-links nav-links-desktop">
          <a onClick={() => navigate("/#funkcje")}>Funkcje</a>
          <a onClick={() => navigate("/#cennik")}>Cennik</a>
          <a onClick={() => navigate("/#kontakt")}>Kontakt</a>
          <a className="active" onClick={scrollToTop}>O nas</a>
        </div>

        <div className="nav-right nav-right-desktop">
          <button className="nav-login" onClick={() => navigate("/login")}>
            Zaloguj się
          </button>
          <button className="nav-cta" onClick={() => navigate("/register")}>
            Zacznij teraz
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <motion.div
          className="lp-mobile-overlay"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <a
            onClick={() => {
              setMobileMenuOpen(false);
              navigate("/#funkcje");
            }}
          >
            Funkcje
          </a>
          <a
            onClick={() => {
              setMobileMenuOpen(false);
              navigate("/#cennik");
            }}
          >
            Cennik
          </a>
          <a
            onClick={() => {
              setMobileMenuOpen(false);
              navigate("/#kontakt");
            }}
          >
            Kontakt
          </a>
          <a className="active" onClick={() => { setMobileMenuOpen(false); scrollToTop(); }}>
            O nas
          </a>

          <div className="nav-mobile-actions">
            <button
              className="nav-login"
              onClick={() => {
                setMobileMenuOpen(false);
                navigate("/login");
              }}
            >
              Zaloguj się
            </button>
            <button
              className="nav-cta"
              onClick={() => {
                setMobileMenuOpen(false);
                navigate("/register");
              }}
            >
              Zacznij teraz
            </button>
          </div>
        </motion.div>
      )}

      <div style={{ minHeight: "100vh" }}>
        <motion.section
          ref={aboutRef}
          id="onas"
          className="lp-section"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="lp-container">
            {/* HEADER */}
            <div style={{ marginBottom: 64, textAlign: "center" }}>
              <div className="sec-label">O nas</div>
              <h2
                className="sec-title"
                style={{ maxWidth: 660, margin: "0 auto" }}
              >
                Stworzone przez uczniów, <span>dla uczniów.</span>
              </h2>
              <p
                className="sec-sub"
                style={{ maxWidth: 640, margin: "8px auto 0" }}
              >
                Stworzyliśmy Moc Nauki żeby nam samym łatwiej było się uczyć.
                Niedługo później było tyle chętnych że nie pozostało nic, tylko
                stworzyć platformę dostępną dla wszystkich.
              </p>
            </div>

            {/* STORY + MISSION (RESPONSIVE) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: 24,
                marginBottom: 72,
                maxWidth: 900,
                marginInline: "auto",
              }}
            >
              {[
                {
                  icon: "📖",
                  title: "Nasza historia",
                  text:
                    "Wszystko zaczęło się we wrześniu 2025 roku, gdy podczas lekcji języka polskiego grupa licealistów z Czackiego zdała sobie sprawę, że spędzają więcej czasu na bezmyślnym przepisywaniu niż na faktycznym uczeniu się.\n\nPostanowiliśmy stworzyć coś lepszego – aplikację, która automatyzuje nudne rzeczy i pozwala skupić się na tym, co naprawdę ważne: zrozumieniu materiału.",
                  accent: "59,130,246",
                },
                {
                  icon: "🎯",
                  title: "Nasza misja",
                  text:
                    "Wierzymy, że każdy uczeń zasługuje na nowoczesne narzędzia do nauki. Świat biegnie naprzód, a w szkole wmawiają nam, że najlepszy sposób na naukę nie zmienił się od 100 lat.\n\nNaszym celem jest sprawić, żeby nauka była efektywna, przyjemna i dostępna dla każdego – niezależnie od tego, czy przygotowujesz się do matury, czy po prostu chcesz mieć lepsze oceny.",
                  accent: "167,139,250",
                },
              ].map((card, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: i * 0.1 }}
                  style={{
                    background: "#0f1117",
                    border: `1px solid rgba(${card.accent},0.2)`,
                    borderRadius: 20,
                    padding: 32,
                    position: "relative",
                    overflow: "hidden",
                    boxShadow: `0 0 40px rgba(${card.accent},0.06)`,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 2,
                      background: `linear-gradient(90deg, rgba(${card.accent},0.8), transparent)`,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: -40,
                      right: -40,
                      width: 120,
                      height: 120,
                      borderRadius: "50%",
                      background: `radial-gradient(circle, rgba(${card.accent},0.12) 0%, transparent 70%)`,
                      pointerEvents: "none",
                    }}
                  />
                  <div style={{ fontSize: "2rem", marginBottom: 14 }}>
                    {card.icon}
                  </div>
                  <h3
                    style={{
                      fontSize: "1.2rem",
                      fontWeight: 800,
                      marginBottom: 12,
                      color: "#fff",
                    }}
                  >
                    {card.title}
                  </h3>
                  {card.text.split("\n\n").map((p, j) => (
                    <p
                      key={j}
                      style={{
                        color: "var(--lp-gray)",
                        lineHeight: 1.8,
                        fontSize: ".9rem",
                        marginBottom: j === 0 ? 12 : 0,
                      }}
                    >
                      {p}
                    </p>
                  ))}
                </motion.div>
              ))}
            </div>

            {/* TEAM (RESPONSIVE 4x / 2x2) */}
            <motion.div
              style={{ marginBottom: 72 }}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="center" style={{ marginBottom: 40 }}>
                <div className="sec-label">Zespół</div>
                <h2 className="sec-title" style={{ fontSize: "2rem" }}>
                  Ludzie stojący za <span>Moc Nauki</span>
                </h2>
              </div>

              <div
                className="team-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile
                    ? "repeat(2, 1fr)"
                    : "repeat(4, 1fr)",
                  gap: 20,
                  maxWidth: 900,
                  margin: "0 auto",
                }}
              >
                {team.map((person, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08, duration: 0.4 }}
                    style={{
                      background: "#0f1117",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 20,
                      padding: "28px 20px",
                      textAlign: "center",
                      cursor: "default",
                    }}
                    whileHover={{
                      y: -4,
                      boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
                    }}
                  >
                    {person.avatar ? (
                      <img
                        src={person.avatar}
                        alt={`${person.name} — ${person.role}`}
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 16,
                          margin: "0 auto 14px",
                          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 16,
                          background: person.color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "1.3rem",
                          fontWeight: 900,
                          margin: "0 auto 14px",
                          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                        }}
                      >
                        {person.initials}
                      </div>
                    )}
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: ".95rem",
                        marginBottom: 4,
                        color: "#fff",
                      }}
                    >
                      {person.name}
                    </div>
                    <div
                      style={{
                        color: "var(--lp-gray)",
                        fontSize: ".82rem",
                        lineHeight: 1.4,
                      }}
                    >
                      {person.role}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* JOIN FORM */}
            <motion.div
              id="dolacz"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              style={{
                background: "#0f1117",
                border: "1px solid rgba(99,102,241,0.25)",
                borderRadius: 24,
                padding: isMobile ? "32px 18px" : "48px 40px",
                maxWidth: 700,
                margin: "0 auto",
                position: "relative",
                overflow: "hidden",
                boxShadow: "0 0 60px rgba(59,130,246,0.06)",
              }}
              className="about-join-card"
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background:
                    "linear-gradient(90deg, #3b82f6, #6366f1, #a78bfa)",
                }}
              />

              <div className="center" style={{ marginBottom: 36 }}>
                <div className="sec-label">Dołącz do nas</div>
                <h2 className="sec-title" style={{ fontSize: "2rem" }}>
                  Chcesz być częścią <span>Moc Nauki?</span>
                </h2>
                <p className="sec-sub" style={{ margin: "8px auto 0" }}>
                  Szukamy ambitnych osób – uczniów, olimpijczyków, nauczycieli
                  i pasjonatów edukacji. Wypełnij formularz, a odezwiemy się do
                  Ciebie!
                </p>
              </div>

              <form
                onSubmit={submitForm}
                style={{ display: "flex", flexDirection: "column", gap: 0 }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                    gap: 16,
                    marginBottom: 16,
                  }}
                  className="form-row-about"
                >
                  <div>
                    <label style={labelStyle}>Imię i nazwisko</label>
                    <input
                      type="text"
                      placeholder="Jan Kowalski"
                      autoComplete="off"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Email</label>
                    <input
                      type="email"
                      placeholder="twoj@email.pl"
                      autoComplete="off"
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Kim jesteś / co robisz?</label>
                  <input
                    type="text"
                    placeholder="uczeń 3 klasy Matexu..."
                    autoComplete="off"
                    style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>
                    Osiągnięcia i doświadczenie
                  </label>
                  <textarea
                    placeholder="Opowiedz o swoich sukcesach, projektach, doświadczeniu w nauczaniu..."
                    autoComplete="off"
                    style={{
                      ...inputStyle,
                      minHeight: 110,
                      resize: "vertical",
                    }}
                  />
                </div>

                <div style={{ marginBottom: 28 }}>
                  <label style={labelStyle}>
                    Dlaczego chcesz dołączyć do Moc Nauki?
                  </label>
                  <textarea
                    placeholder="Co Cię motywuje? Jak chciałbyś/chciałabyś pomóc?"
                    autoComplete="off"
                    style={{
                      ...inputStyle,
                      minHeight: 110,
                      resize: "vertical",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  {showSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        background: "rgba(52,211,153,0.1)",
                        border: "1px solid rgba(52,211,153,0.3)",
                        color: "#34d399",
                        padding: "10px 18px",
                        borderRadius: 10,
                        fontSize: ".88rem",
                        fontWeight: 600,
                      }}
                    >
                      ✓ Zgłoszenie wysłane! Odezwiemy się niebawem.
                    </motion.div>
                  )}

                  {cooldown > 0 ? (
                    <div
                      className="btn btn-grad"
                      style={{ cursor: "default", opacity: 0.75 }}
                    >
                      Wyślij ponownie za {cooldown}s
                    </div>
                  ) : (
                    <motion.button
                      className="btn btn-grad"
                      type="submit"
                      whileHover={{
                        scale: 1.02,
                        boxShadow: "0 8px 30px rgba(59,130,246,0.45)",
                      }}
                      whileTap={{ scale: 0.97 }}
                    >
                      Wyślij zgłoszenie →
                    </motion.button>
                  )}
                </div>
              </form>
            </motion.div>
          </div>
        </motion.section>
      </div>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="footer-grid">
          <div>
            <div className="f-logo">Moc Nauki</div>
            <p className="f-desc">
              Platforma edukacyjna. Ucz się mądrzej, nie ciężej.
            </p>
          </div>

          <div className="f-col">
            <h4>Produkt</h4>
            <a onClick={() => navigate("/#funkcje")}>Funkcje</a>
            <a onClick={() => navigate("/#cennik")}>Cennik</a>
          </div>

          <div className="f-col">
            <h4>Firma</h4>
            <a onClick={scrollToTop}>O nas</a>
            <a onClick={scrollToJoin}>Dołącz do nas</a>
          </div>

          <div className="f-col">
            <h4>Dokumenty</h4>
            <a onClick={() => openTermsDocument("terms")} style={{ cursor: "pointer" }}>
              Regulamin
            </a>
            <a onClick={() => openTermsDocument("privacy")} style={{ cursor: "pointer" }}>
              Polityka Prywatności
            </a>
            <a onClick={() => openTermsDocument("cookies")} style={{ cursor: "pointer" }}>
              Polityka Cookies
            </a>
          </div>
        </div>

        <div className="footer-bottom">
          © 2025 Moc Nauki. Wszelkie prawa zastrzeżone.
        </div>
      </footer>

      {termsDocument && (
        <TermsModal onClose={() => setTermsDocument(null)} initialDoc={termsDocument} />
      )}
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: ".75rem",
  fontWeight: 700,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: ".08em",
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#f1f5f9",
  borderRadius: 12,
  padding: "12px 16px",
  fontSize: ".9rem",
  fontFamily: "inherit",
  outline: "none",
  transition: "border-color .2s",
  boxSizing: "border-box",
};

export default About;