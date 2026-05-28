import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, X as XIcon } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    setMatches(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

interface VPProps {
  priceRef?: React.RefObject<HTMLElement | null>;
  scrollTo?: (ref: React.RefObject<HTMLElement | HTMLDivElement | null>) => void;
}

/* ─── Shared card contents ─── */

const GroupCoursesContent: React.FC = () => (
  <>
    <div
      style={{
        fontSize: ".72rem",
        fontWeight: 700,
        color: "#475569",
        letterSpacing: ".1em",
        textTransform: "uppercase",
        marginBottom: 6,
      }}
    >
      Alternatywa
    </div>
    <h3
      style={{
        fontSize: "1.35rem",
        fontWeight: 900,
        color: "var(--lp-gray)",
        marginBottom: 4,
      }}
    >
      Kursy grupowe
    </h3>
    <p
      style={{
        color: "var(--lp-gray)",
        fontSize: ".85rem",
        marginBottom: 28,
      }}
    >
      Metoda „przepełnionej klasy”.
    </p>
    <div style={{ marginBottom: 4 }}>
      <span
        style={{
          fontSize: "2.5rem",
          fontWeight: 900,
          color: "var(--lp-gray)",
        }}
      >
        ~400
      </span>
      <span
        style={{
          fontSize: "1rem",
          color: "#475569",
          fontWeight: 700,
        }}
      >
        {" "}
        PLN
      </span>
      <span
        style={{
          fontSize: ".8rem",
          color: "#475569",
        }}
      >
        /mies
      </span>
    </div>
    <div
      style={{
        fontSize: ".78rem",
        color: "#475569",
        marginBottom: 26,
      }}
    >
      na przedmiot
    </div>
    <div
      style={{
        height: 1,
        background: "rgba(255,255,255,0.06)",
        margin: "22px 0",
      }}
    />
    {[
      "Przepełnione klasy",
      "Ograniczona uwaga indywidualna",
      "Sztywny grafik",
    ].map((item, i) => (
      <div
        key={i}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <XIcon size={16} color="#ef4444" style={{ flexShrink: 0 }} />
        <span style={{ color: "#64748b", fontSize: ".92rem" }}>{item}</span>
      </div>
    ))}
  </>
);

const MocNaukiContent: React.FC = () => (
  <>
    <div
      style={{
        position: "absolute",
        top: -100,
        right: -100,
        width: 240,
        height: 240,
        borderRadius: "50%",
        background:
          "radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 70%)",
        pointerEvents: "none",
      }}
    />
    <div
      style={{
        position: "absolute",
        top: 20,
        right: 20,
        background: "linear-gradient(135deg, #3b82f6, #6366f1)",
        color: "#fff",
        fontSize: ".68rem",
        fontWeight: 900,
        padding: "6px 14px",
        borderRadius: 999,
        letterSpacing: ".06em",
        textTransform: "uppercase",
        boxShadow: "0 8px 20px rgba(59,130,246,0.4)",
      }}
    >
      Rewolucja nauki
    </div>
    <div
      style={{
        fontSize: ".72rem",
        fontWeight: 700,
        color: "#60a5fa",
        letterSpacing: ".1em",
        textTransform: "uppercase",
        marginBottom: 6,
      }}
    >
      Moc Nauki
    </div>
    <h3
      style={{
        fontSize: "1.55rem",
        fontWeight: 900,
        color: "#fff",
        marginBottom: 4,
      }}
    >
      Unikalna platforma
    </h3>
    <p
      style={{
        color: "var(--lp-gray)",
        fontSize: ".88rem",
        marginBottom: 28,
      }}
    >
      Ucz się mądrzej, nie ciężej.
    </p>
    <div style={{ marginBottom: 4 }}>
      <span
        style={{
          fontSize: "3.5rem",
          color: "#ffffff",
          fontWeight: 900,
        }}
      >
        29
      </span>
      <span
        style={{
          fontSize: "1.2rem",
          color: "#ffffff",
          fontWeight: 700,
        }}
      >
        {" "}
        PLN
      </span>
      <span
        style={{
          fontSize: ".9rem",
          color: "var(--lp-gray)",
        }}
      >
        /mies
      </span>
    </div>
    <div
      style={{
        fontSize: ".78rem",
        color: "#64748b",
        marginBottom: 28,
      }}
    >
      za wszystko w zestawie
    </div>
    <div
      style={{
        height: 1,
        background: "rgba(99,102,241,0.2)",
        margin: "4px 0 24px",
      }}
    />
    <div style={{ flex: 1 }}>
      {[
        "Dostęp 24/7",
        "Nauczyciel zawsze i wszędzie",
        "Funkcje aplikacji bez limitów",
        "Wszystkie przyszłe aktualizacje",
        "Bezpośredni kontakt z administratorem",
      ].map((item, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <Check size={17} color="#34d399" style={{ flexShrink: 0 }} />
          <span
            style={{
              color: "#e2e8f0",
              fontSize: ".94rem",
              fontWeight: 600,
            }}
          >
            {item}
          </span>
        </div>
      ))}
    </div>
  </>
);

const TutorContent: React.FC = () => (
  <>
    <div
      style={{
        fontSize: ".72rem",
        fontWeight: 700,
        color: "#475569",
        letterSpacing: ".1em",
        textTransform: "uppercase",
        marginBottom: 6,
      }}
    >
      Alternatywa
    </div>
    <h3
      style={{
        fontSize: "1.35rem",
        fontWeight: 900,
        color: "var(--lp-gray)",
        marginBottom: 4,
      }}
    >
      Prywatny korepetytor
    </h3>
    <p
      style={{
        color: "var(--lp-gray)",
        fontSize: ".85rem",
        marginBottom: 28,
      }}
    >
      Dobra jakość, wysoka cena.
    </p>
    <div style={{ marginBottom: 4 }}>
      <span
        style={{
          fontSize: "2.5rem",
          fontWeight: 900,
          color: "var(--lp-gray)",
        }}
      >
        ~1000
      </span>
      <span
        style={{
          fontSize: "1rem",
          color: "#475569",
          fontWeight: 700,
        }}
      >
        {" "}
        PLN
      </span>
      <span
        style={{
          fontSize: ".8rem",
          color: "#475569",
        }}
      >
        /mies
      </span>
    </div>
    <div
      style={{
        fontSize: ".78rem",
        color: "#475569",
        marginBottom: 26,
      }}
    >
      tylko za jeden przedmiot
    </div>
    <div
      style={{
        height: 1,
        background: "rgba(255,255,255,0.06)",
        margin: "22px 0",
      }}
    />
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 14,
      }}
    >
      <Check size={16} color="#34d399" style={{ flexShrink: 0 }} />
      <span style={{ color: "#94a3b8", fontSize: ".87rem" }}>
        Spersonalizowana uwaga
      </span>
    </div>
    {[
      "Bardzo wysokie stawki godzinowe",
      "Trudne do ustalenia terminy",
      "Skupienie na jednym przedmiocie",
    ].map((item, i) => (
      <div
        key={i}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <XIcon size={16} color="#ef4444" style={{ flexShrink: 0 }} />
        <span style={{ color: "#64748b", fontSize: ".92rem" }}>{item}</span>
      </div>
    ))}
  </>
);

/* ─── Card wrapper styles ─── */

const groupCardStyle: React.CSSProperties = {
  background: "#0f1117",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 24,
  padding: "34px 28px",
  height: "100%",
};

const mocCardStyle: React.CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(59,130,246,0.14), rgba(15,23,42,0.96))",
  border: "1px solid rgba(99,102,241,0.35)",
  borderRadius: 28,
  padding: "42px 32px",
  position: "relative",
  overflow: "hidden",
  boxShadow: "0 25px 80px rgba(59,130,246,0.16)",
  zIndex: 2,
  display: "flex",
  flexDirection: "column",
};

const tutorCardStyle: React.CSSProperties = {
  background: "#0f1117",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 24,
  padding: "34px 28px",
  height: "100%",
};

/* ─── Main component ─── */

const ValueProposition: React.FC<VPProps> = ({ priceRef, scrollTo }) => {
  const isMobile = useMediaQuery("(max-width: 900px)");

  return (
    <motion.section
      ref={priceRef}
      className="lp-section"
      id="cennik"
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <div className="lp-container">
        {/* HEADER */}
        <div
          className="pricing-page-hero"
          style={{
            marginBottom: 70,
            textAlign: "center",
          }}
        >
          <div className="sec-label">Cennik</div>

          <h2
            className="sec-title"
            style={{
              maxWidth: 900,
              margin: "0 auto 18px",
            }}
          >
            Po co płacić więcej <span>za mniej?</span>
          </h2>

          <p
            className="sec-sub"
            style={{
              maxWidth: 720,
              margin: "0 auto",
              fontSize: "1rem",
              color: "var(--lp-gray)",
            }}
          >
            Wszystko czego potrzebujesz, w jednym miejscu - bez ukrytych opłat i
            ograniczeń.
          </p>
        </div>

        {/* MOBILE TABS */}
        {isMobile && (
          <div style={{ maxWidth: 560, margin: "0 auto 90px" }}>
            <Tabs.Root defaultValue="moc-nauki">
              <Tabs.List
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 24,
                  background: "rgba(255,255,255,0.04)",
                  padding: "6px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <Tabs.Trigger
                  value="kursy"
                  className="pricing-tab-trigger"
                >
                  Kursy grupowe
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="moc-nauki"
                  className="pricing-tab-trigger"
                >
                  Moc Nauki
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="korepetytor"
                  className="pricing-tab-trigger"
                >
                  Korepetytor
                </Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="kursy">
                <div style={groupCardStyle}>
                  <GroupCoursesContent />
                </div>
              </Tabs.Content>
              <Tabs.Content value="moc-nauki">
                <div style={mocCardStyle}>
                  <MocNaukiContent />
                </div>
              </Tabs.Content>
              <Tabs.Content value="korepetytor">
                <div style={tutorCardStyle}>
                  <TutorContent />
                </div>
              </Tabs.Content>
            </Tabs.Root>
          </div>
        )}

        {/* DESKTOP GRID */}
        {!isMobile && (
          <div
            className="pricing-compare-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.1fr 1fr",
              gap: 24,
              alignItems: "stretch",
              maxWidth: 1200,
              margin: "0 auto 90px",
            }}
          >
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45 }}
              style={groupCardStyle}
            >
              <GroupCoursesContent />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: -12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              style={mocCardStyle}
            >
              <MocNaukiContent />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45 }}
              style={tutorCardStyle}
            >
              <TutorContent />
            </motion.div>
          </div>
        )}

        {/* MOBILE RESPONSIVE (fallback for no-JS) */}
        <style>
          {`
            @media (max-width: 980px) {
              .pricing-compare-grid {
                grid-template-columns: 1fr !important;
                gap: 22px !important;
                max-width: 560px !important;
              }
            }

            @media (max-width: 640px) {
              .pricing-page-hero {
                margin-bottom: 44px !important;
              }

              .pricing-page-hero .sec-title {
                font-size: 2.2rem !important;
                line-height: 1.08 !important;
              }

              .pricing-page-hero .sec-sub {
                font-size: .95rem !important;
              }

              .pricing-compare-grid {
                gap: 18px !important;
              }
            }
          `}
        </style>

        {/* FAQ */}
        <motion.div
          style={{ marginTop: 40 }}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="center" style={{ marginBottom: 40 }}>
            <div className="sec-label">FAQ</div>

            <h3 className="sec-title" style={{ fontSize: "2rem" }}>
              Najczęstsze <span>pytania</span>
            </h3>
          </div>

          {(() => {
            const faqs = [
              {
                q: "Dlaczego aplikacja jest płatna?",
                a: "Korzystamy z zaawansowanych modeli sztucznej inteligencji do generowania notatek, wydarzeń w kalendarzu, zdań, fiszek i wielu innych funkcji. Te usługi mają znaczące koszty, dlatego aplikacja jest płatna.",
              },
              {
                q: "Na jakich urządzeniach działa Moc Nauki?",
                a: "Na każdym urządzeniu — telefon, tablet i komputer.",
              },
              {
                q: "Czy macie aplikację?",
                a: 'Tak! Kliknij "Udostępnij" → "Dodaj do ekranu głównego".',
              },
              {
                q: "Jak anulować subskrypcję?",
                a: "Wystarczy jedno kliknięcie w ustawieniach konta.",
              },
            ];
            const faqJsonLd = {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqs.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            };
            return (
              <>
                <script
                  type="application/ld+json"
                  dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
                />
                <div className="faq-grid">
                  {faqs.map((faq, i) => (
                    <motion.div
                      key={i}
                      className="faq-item"
                      onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                        const el = e.currentTarget;
                        const isOpen = el.classList.contains("open");
                        document
                          .querySelectorAll(".faq-item")
                          .forEach((i) => i.classList.remove("open"));
                        if (!isOpen) el.classList.add("open");
                      }}
                      initial={{ opacity: 0, y: 8 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.08 }}
                    >
                      <div className="faq-q">
                        {faq.q} <span className="faq-arrow">▾</span>
                      </div>
                      <div className="faq-a">
                        <div className="faq-a-inner">{faq.a}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </>
            );
          })()}
        </motion.div>
      </div>
    </motion.section>
  );
};

export default ValueProposition;
