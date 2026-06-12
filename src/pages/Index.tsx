import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu, X as XIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getSessionSafe } from "@/lib/authSession";
import "./LandingPage.css";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import TestimonialCarousel from "@/components/TestimonialCarousel";
import ValueProposition from "@/components/ValueProposition";
import TermsModal, { DocumentType } from "@/components/TermsModal";
import { Seo } from "@/components/Seo";

const Index = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [termsDocument, setTermsDocument] = useState<DocumentType | null>(null);
  const [showCookieBanner, setShowCookieBanner] = useState(false);

  const openTermsDocument = (docType: DocumentType) => setTermsDocument(docType);

  useEffect(() => {
    getSessionSafe(2500).then((session) => {
      if (session && localStorage.getItem("userId")) {
        navigate("/dashboard", { replace: true });
      }
    });
  }, []);

  useEffect(() => {
    const consent = localStorage.getItem("cookieConsent");
    if (!consent) {
      const t = setTimeout(() => setShowCookieBanner(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem("cookieConsent", "accepted");
    setShowCookieBanner(false);
  };

  const declineCookies = () => {
    localStorage.setItem("cookieConsent", "declined");
    setShowCookieBanner(false);
  };

  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const hash = location.hash;
    if (!hash) return;
    const sectionId = hash.slice(1);
    // Sections render via whileInView/motion — re-measure on retries so the
    // final scroll target is correct even after late mounts/animations.
    let attempts = 0;
    let lastTop = -1;
    const tick = () => {
      const target = document.getElementById(sectionId);
      if (!target) {
        if (attempts++ < 20) return window.setTimeout(tick, 80);
        return;
      }
      const header = document.querySelector(".lp-nav");
      const headerHeight = header?.clientHeight ?? 88;
      const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - headerHeight - 12);
      window.scrollTo({ top, behavior: "smooth" });
      // Keep nudging until the measurement stabilizes (handles late layout shifts)
      if (Math.abs(top - lastTop) > 2 && attempts++ < 15) {
        lastTop = top;
        window.setTimeout(tick, 180);
      }
    };
    tick();
  }, [location.hash, location.key]);


  useEffect(() => {
    document.body.style.overflowX = "hidden";
    document.body.style.overflowY = mobileMenuOpen ? "hidden" : "auto";
    return () => {
      document.body.style.overflowX = "hidden";
      document.body.style.overflowY = "auto";
    };
  }, [mobileMenuOpen]);

  const heroRef = useRef<HTMLDivElement>(null);
  const featRef = useRef<HTMLElement>(null);
  const priceRef = useRef<HTMLElement>(null);
  const contactRef = useRef<HTMLElement>(null);

  const scrollTo = (ref: React.RefObject<HTMLElement | HTMLDivElement | null>) => {
    setMobileMenuOpen(false);
    if (!ref.current) return;
    const header = document.querySelector(".lp-nav");
    const headerHeight = header?.clientHeight ?? 88;
    const top = ref.current.getBoundingClientRect().top + window.scrollY - headerHeight - 12;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  };

  const scrollToAbout = () => {
    setMobileMenuOpen(false);
    navigate("/about");
    setTimeout(() => {
      const t = document.getElementById("onas");
      const h = document.querySelector(".lp-nav")?.clientHeight ?? 88;
      if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - h - 12, behavior: "smooth" });
    }, 400);
  };


  const toggleFaq = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const isOpen = el.classList.contains("open");
    document.querySelectorAll(".faq-item").forEach((i) => i.classList.remove("open"));
    if (!isOpen) el.classList.add("open");
  };

  return (
    <div className="landing-root" id="top">
      <Seo title="Moc Nauki — Inteligentna platforma edukacyjna AI" description="Automatyczne notatki, inteligentny kalendarz, nauczyciel 24/7, nauka języków z pomocą AI i baza aktualnych testów. Od uczniów, dla uczniów." path="/" />
      {/* NAV */}
      <nav
        className="lp-nav"
        style={{
          background: scrolled ? "rgba(6,13,26,0.92)" : "rgba(6,13,26,0.55)",
          boxShadow: scrolled ? "0 1px 0 rgba(255,255,255,0.06)" : "none",
          transition: "background .3s, box-shadow .3s",
        }}
      >
        <div className="logo" onClick={() => scrollTo(heroRef)}>Moc Nauki</div>

        <button
          className="lp-hamburger"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Menu"
        >
          {mobileMenuOpen ? <XIcon size={22} /> : <Menu size={22} />}
        </button>

        <div className="nav-links nav-links-desktop">
          <a onClick={() => scrollTo(featRef)}>Funkcje</a>
          <a onClick={() => scrollTo(priceRef)}>Cennik</a>
          <a onClick={() => scrollTo(contactRef)}>Kontakt</a>
          <a onClick={() => { setMobileMenuOpen(false); navigate("/about"); setTimeout(() => { const t = document.getElementById("onas"); const h = document.querySelector(".lp-nav")?.clientHeight ?? 88; if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - h - 12, behavior: "smooth" }); }, 400); }}>O nas</a>

        </div>

        <div className="nav-right nav-right-desktop">
          <button className="nav-login" onClick={() => navigate("/login")}>Zaloguj się</button>
          <button className="nav-cta" onClick={() => navigate("/register")}>Zarejestruj się</button>
        </div>
      </nav>

      {/* MOBILE OVERLAY */}
      {mobileMenuOpen && (
        <motion.div
          className="lp-mobile-overlay"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <a onClick={() => scrollTo(featRef)}>Funkcje</a>
          <a onClick={() => scrollTo(priceRef)}>Cennik</a>
          <a onClick={() => scrollTo(contactRef)}>Kontakt</a>
          <a onClick={() => { setMobileMenuOpen(false); navigate("/about"); setTimeout(() => { const t = document.getElementById("onas"); const h = document.querySelector(".lp-nav")?.clientHeight ?? 88; if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - h - 12, behavior: "smooth" }); }, 400); }}>O nas</a>

          <div className="nav-mobile-actions">
            <button className="nav-login" onClick={() => { setMobileMenuOpen(false); navigate("/login"); }}>Zaloguj się</button>
            <button className="nav-cta" onClick={() => { setMobileMenuOpen(false); navigate("/register"); }}>Zarejestruj się</button>
          </div>
        </motion.div>
      )}

      <main>
      <Hero heroRef={heroRef} featRef={featRef} priceRef={priceRef} scrollTo={scrollTo} navigate={navigate} />
      <Features featRef={featRef} />
      <TestimonialCarousel />
      <ValueProposition priceRef={priceRef} scrollTo={scrollTo} />

      {/* CTA */}
      <motion.section
        className="lp-section"
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="lp-container">
          <div className="cta-band">
            <div className="sec-label" style={{ textAlign: "center" }}>Dołącz teraz</div>
            <h2 className="sec-title" style={{ maxWidth: 600, margin: "0 auto 14px", textAlign: "center" }}>
              Przestań się stresować. Zacznij naprawdę się <span>uczyć.</span>
            </h2>
            <p className="sec-sub" style={{ textAlign: "center", margin: "0 auto 36px", color: "var(--lp-gray)" }}>
              Dołącz do uczniów, którzy już poprawiają swoje oceny z Moc Nauki.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button className="btn btn-grad" onClick={() => navigate("/register")}>Zarejestruj się teraz →</button>
              <button className="btn btn-ghost" onClick={scrollToAbout}>Więcej o nas</button>
            </div>
            <p className="cta-note">✓ Bez podpinania karty · ✓ Anuluj kiedy chcesz · ✓ Pełny dostęp od razu</p>
          </div>
        </div>
      </motion.section>

      {/* CONTACT */}
      <motion.section
        ref={contactRef}
        className="lp-section"
        style={{ paddingTop: 70 }}
        id="kontakt"
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="lp-container">
          <div className="center" style={{ marginBottom: 48 }}>
            <div className="sec-label">Kontakt</div>
            <h2 className="sec-title">Masz pytania? <span>Napisz do nas.</span></h2>
            <p className="sec-sub">Chętnie odpowiemy na każde pytanie dotyczące aplikacji, subskrypcji lub współpracy.</p>
          </div>
          <div
            className="contact-items-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24, maxWidth: 900, margin: "0 auto" }}
          >
            {[
              { icon: "✉️", label: "E-mail", val: "kontakt@mocnauki.site", href: null },
              { icon: "📱", label: "Instagram", val: "@mocnauki_official", href: "https://www.instagram.com/mocnauki_official?igsh=cTBrMW50am5wdXR6&utm_source=qr" },
              { icon: "⏳", label: "Czat w aplikacji", val: "Dostępny 24/7", href: null },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                {item.href ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="contact-item instagram-link"
                    style={{ display: "flex", alignItems: "center", gap: 14, background: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)", border: "none", borderRadius: 16, padding: "24px 20px", textDecoration: "none", color: "inherit" }}
                  >
                    <div className="ci-icon">{item.icon}</div>
                    <div><div className="ci-label">{item.label}</div><div className="ci-val">{item.val}</div></div>
                  </a>
                ) : (
                  <div
                    className="contact-item"
                    style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "24px 20px" }}
                  >
                    <div className="ci-icon">{item.icon}</div>
                    <div><div className="ci-label">{item.label}</div><div className="ci-val">{item.val}</div></div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>
      </main>


      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="footer-grid">
          <div>
            <div className="f-logo">Moc Nauki</div>
            <p className="f-desc">Platforma edukacyjna. Ucz się mądrzej, nie ciężej.</p>
          </div>
          <div className="f-col">
            <h4>Produkt</h4>
            <a onClick={() => scrollTo(featRef)}>Funkcje</a>
            <a onClick={() => scrollTo(priceRef)}>Cennik</a>
          </div>
          <div className="f-col">
            <h4>Firma</h4>
            <a onClick={() => { navigate("/about"); setTimeout(() => { const t = document.getElementById("onas"); const h = document.querySelector(".lp-nav")?.clientHeight ?? 88; if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - h - 12, behavior: "smooth" }); }, 400); }}>O nas</a>
            <a onClick={() => { navigate("/about"); setTimeout(() => { const t = document.getElementById("dolacz"); const h = document.querySelector(".lp-nav")?.clientHeight ?? 88; if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - h - 12, behavior: "smooth" }); }, 400); }}>Dołącz do nas</a>
          </div>
          <div className="f-col">
            <h4>Dokumenty</h4>
            <a onClick={() => openTermsDocument("terms")} style={{ cursor: "pointer" }}>Regulamin</a>
            <a onClick={() => openTermsDocument("privacy")} style={{ cursor: "pointer" }}>Polityka Prywatności</a>
            <a onClick={() => openTermsDocument("cookies")} style={{ cursor: "pointer" }}>Polityka Cookies</a>
          </div>
        </div>
        <div className="footer-bottom">© 2025 Moc Nauki. Wszelkie prawa zastrzeżone.</div>
      </footer>

      {termsDocument && (
        <TermsModal onClose={() => setTermsDocument(null)} initialDoc={termsDocument} />
      )}

      {/* COOKIE BANNER */}
      <AnimatePresence>
        {showCookieBanner && (
          <motion.div
            className="cookie-banner"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="cookie-banner__icon">🍪</div>
            <div className="cookie-banner__body">
              <p className="cookie-banner__title">Pliki cookies</p>
              <p className="cookie-banner__text">
                Używamy cookies, aby zapewnić Ci najlepsze doświadczenie.{" "}
                <span
                  onClick={() => openTermsDocument("cookies")}
                  className="cookie-banner__link"
                >
                  Polityka cookies
                </span>
              </p>
            </div>
            <div className="cookie-banner__actions">
              <button className="cookie-banner__btn cookie-banner__btn--accept" onClick={acceptCookies}>
                Akceptuję
              </button>
              <button className="cookie-banner__btn cookie-banner__btn--decline" onClick={declineCookies}>
                Odrzuć
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
