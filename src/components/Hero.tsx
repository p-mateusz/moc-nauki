import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { NavigateFunction } from "react-router-dom";

interface HeroProps {
  heroRef: React.RefObject<HTMLDivElement>;
  featRef?: React.RefObject<HTMLElement | null>;
  priceRef?: React.RefObject<HTMLElement | null>;
  scrollTo: (ref: React.RefObject<HTMLElement | HTMLDivElement | null>) => void;
  navigate: NavigateFunction;
}

const Hero: React.FC<HeroProps> = ({ heroRef, featRef, priceRef, scrollTo, navigate }) => {
  const [typed, setTyped] = useState("");
  const [showNotify, setShowNotify] = useState(false);

  useEffect(() => {
    const full = "Test z Historii 20.10";
    let i = 0;
    const t = setInterval(() => {
      setTyped((s) => s + full[i]);
      i++;
      if (i >= full.length) {
        clearInterval(t);
        setTimeout(() => setShowNotify(true), 700);
      }
    }, 60);
    return () => clearInterval(t);
  }, []);

  return (
    <div ref={heroRef}>
      <motion.section
        id="home-hero"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <div className="blob blob1" />
        <div className="blob blob2" />

        <div className="hero-grid">
          {/* LEFT */}
          <div style={{ position: "relative", zIndex: 1 }}>
            <motion.div
              className="hero-badge"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              Od uczniów, dla uczniów
            </motion.div>

            <motion.h1
              className="hero-h"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9 }}
            >
              Ucz się<br />
              <span>szybciej.</span>
              <br />Wypadaj<br />
              <span>lepiej.</span>
            </motion.h1>

            <motion.p
              className="hero-p"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6 }}
            >
              Zapomnij o żmudnym przepisywaniu. Ucz się języków z pomocą AI. Nie przegap niczego z inteligentnym kalendarzem - wszystko w jednej aplikacji.
            </motion.p>

            <motion.div
              className="hero-actions"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.5 }}
            >
              <button className="btn btn-grad" onClick={() => navigate("/register")}>
                Zacznij teraz →
              </button>
              <button className="btn btn-ghost" onClick={() => featRef && scrollTo(featRef)}>
                Zobacz funkcje
              </button>
            </motion.div>

            <motion.div
              className="hero-stats"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              {[
                { n: "80%", l: "krótszy czas nauki" },
                { n: "20+", l: "unikalnych narzędzi" },
                { n: "4.9★", l: "ocena użytkowników" },
              ].map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.1, duration: 0.4 }}
                >
                  <div className="hstat-n">{s.n}</div>
                  <div className="hstat-l">{s.l}</div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* RIGHT — floating cards */}
          <motion.div
            className="hero-visual"
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            style={{ position: "relative", height: 540, marginTop: 0 }}
          >
            {/* Notatki AI */}
            <motion.div
              className="hv-card hv-f1"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              style={{ position: "absolute", top: 0, left: 0, width: 300, transform: "rotate(-1.5deg)", zIndex: 2 }}
            >
              <div className="hv-label">📝 ZAUTOMATYZOWANE NOTATKI</div>
              <div className="hv-title" style={{ marginBottom: 10 }}>Biologia — komórka i podziały</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 14 }}>
                {[98, 72, 82, 88, 58].map((w, i) => (
                  <div key={i} className="hv-line">
                    <motion.div
                      className="hv-fill"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${w}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: 0.2 + i * 0.1 }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["mitoza", "ATP", "DNA", "RNA", "mejoza", "chromosomy", "jądro", "cytoplazma"].map(tag => (
                  <span key={tag} style={{ fontSize: ".65rem", background: "rgba(59,130,246,0.2)", color: "#60a5fa", borderRadius: 20, padding: "3px 10px" }}>{tag}</span>
                ))}
              </div>
            </motion.div>

            {/* Języki AI */}
            <motion.div
              className="hv-card hv-f2"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              style={{ position: "absolute", top: 20, right: 0, width: 220, transform: "rotate(1.5deg)", zIndex: 3 }}
            >
              <div className="hv-aibadge">🧠 Języki AI</div>
              <div style={{ fontSize: ".75rem", color: "#ffffff", marginBottom: 8, lineHeight: 1.6 }}>
                She spoke with such{" "}
                <span style={{ borderBottom: "2px solid #6366f1", color: "#a5b4fc", fontStyle: "italic" }}>eloquence</span>
                {" "}that the room fell silent.
              </div>
              <div style={{ fontSize: ".68rem", color: "#a5b4fc", fontWeight: 600, marginBottom: 8 }}>
                💡 elokwencja — dar wymowy
              </div>
              <div className="hv-line">
                <motion.div
                  className="hv-fill"
                  initial={{ width: 0 }}
                  whileInView={{ width: "61%" }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                />
              </div>
              <div style={{ fontSize: ".7rem", color: "var(--lp-gray)", marginTop: 5 }}>61% opanowane · 87 fiszek</div>
            </motion.div>

            {/* Nauczyciel online */}
            <motion.div
              className="hv-card hv-f4"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
              style={{ position: "absolute", top: 310, left: -10, width: 210, transform: "rotate(-1deg)", zIndex: 1 }}
            >
              <div className="hv-label">💬 Nauczyciel online</div>
              <div style={{ fontSize: ".8rem", color: "#e2e8f0", fontWeight: 600, marginBottom: 6 }}>
                „Co to jest dualizm korpuskularno-falowy?"
              </div>
              <div className="hv-online">● odpowiedź za ~3 min</div>
              <div style={{ fontSize: ".7rem", color: "var(--lp-gray)", marginTop: 5 }}>12 nauczycieli dostępnych</div>
            </motion.div>

            {/* Kalendarz */}
            <motion.div
              className="hv-card hv-f3"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              style={{ position: "absolute", top: 290, right: 0, width: 260, transform: "rotate(0.5deg)", zIndex: 2 }}
            >
              <div className="hv-label">📅 INTELIGENTNY KALENDARZ</div>
              <div className="hv-title" style={{ marginBottom: 10 }}>Nadchodzące wydarzenia</div>
              <div style={{ fontSize: ".8rem", color: "#e2e8f0", display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { label: "📝 Polski - sprawdzian", date: "20.10", color: "#f87171" },
                  { label: "🧪 Chemia - kartkówka", date: "22.10", color: "#fb923c" },
                  { label: "🇬🇧 Angielski - kartkówka", date: "25.10", color: "#facc15" },
                ].map((ev, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.12 }}
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span>{ev.label}</span>
                    <span style={{ color: ev.color, marginLeft: 12 }}>{ev.date}</span>
                  </motion.div>
                ))}
              </div>
              <div className="hv-ok" style={{ marginTop: 10, whiteSpace: "nowrap" }}>✓ 3 przypomnienia ustawione</div>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>
    </div>
  );
};

export default Hero;
