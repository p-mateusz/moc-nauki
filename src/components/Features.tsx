import React from "react";
import { motion } from "framer-motion";

interface FeaturesProps {
  featRef?: React.RefObject<HTMLElement | null>;
}

const features = [
  { icon: "🎙️", title: "Zautomatyzowane notatki", desc: "Jeden przycisk - aplikacja tworzy gotowe notatki z lekcji.", tag: "AI", color: "59,130,246" },
  { icon: "📅", title: "Inteligentny kalendarz", desc: "Sam wychwytuje i zapisuje testy, prace domowe, lektury.", tag: "Planowanie", color: "99,102,241" },
  { icon: "🃏", title: "Języki AI", desc: "Definicje, fiszki, zdania z lukami, kahoot - w pół minuty.", tag: "Quizlet+", color: "167,139,250" },
  { icon: "📚", title: "Baza testów", desc: "Baza testów i rozwiązań twojego nauczyciela z każdego tematu.", tag: "Społeczność", color: "52,211,153" },
  { icon: "💬", title: "Czat z nauczycielem", desc: "Profesjonalista do pomocy, zawsze i wszędzie.", tag: "Wsparcie 24/7", color: "251,191,36" },
  { icon: "📖", title: "E-podręczniki", desc: "Zapomnij o corocznym kupowaniu podręczników.", tag: "Produktywność", color: "248,113,113" },
  { icon: "💡", title: "Porady", desc: "Darmowe narzędzia używane przez najlepszych.", tag: "Nowe rozwiązania", color: "34,211,238" },
  { icon: "🏆", title: "Ranking i znajomi", desc: "Pnij się w rankingu i zdobywaj świetne nagrody.", tag: "Motywacja", color: "251,146,60" },
];

const Features: React.FC<FeaturesProps> = ({ featRef }) => {
  return (
    <motion.section
      ref={featRef as any}
      className="lp-section"
      id="funkcje"
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <div className="lp-container">
        <div className="feat-page-hero">
          <div className="sec-label">Funkcje</div>
          <h2 className="sec-title" style={{ maxWidth: 700, margin: "0 auto 16px" }}>
            Wszystko czego potrzebujesz, <span>tylko u nas</span>
          </h2>
          <p className="sec-sub" style={{ margin: "0 auto" }}>
            Każde unikalne narzędzie zaprojektowane tak, żebyś miał lepsze oceny, mniej stresu i więcej wolnego czasu.
          </p>
        </div>

        <div className="feat-grid" style={{ marginBottom: 60 }}>
          {features.map((f, i) => (
            <motion.div
              key={i}
              className="feat-card"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              style={{ position: "relative", overflow: "hidden" }}
            >
              {/* Glow blob */}
              <div style={{
                position: "absolute",
                top: -30,
                right: -30,
                width: 100,
                height: 100,
                borderRadius: "50%",
                background: `radial-gradient(circle, rgba(${f.color},0.15) 0%, transparent 70%)`,
                pointerEvents: "none",
              }} />

              <div
                className="feat-icon"
                style={{
                  background: `linear-gradient(135deg, rgba(${f.color},0.2), rgba(${f.color},0.08))`,
                  border: `1px solid rgba(${f.color},0.2)`,
                  boxShadow: `0 0 20px rgba(${f.color},0.1)`,
                }}
              >
                {f.icon}
              </div>

              <h3 style={{ color: "#fff" }}>{f.title}</h3>
              <p>{f.desc}</p>

              <span
                className="feat-tag"
                style={{
                  background: `rgba(${f.color},0.12)`,
                  color: `rgba(${f.color},1)`,
                  border: `1px solid rgba(${f.color},0.2)`,
                }}
              >
                {f.tag}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
};

export default Features;
