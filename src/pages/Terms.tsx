import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TermsContent from "@/components/TermsContent";
import "./LandingPage.css";

const Terms = () => {
  const navigate = useNavigate();

  const closeTerms = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          navigate("/");
        }
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [navigate]);

  return (
    <div className="landing-root" style={{ minHeight: "100vh" }}>
      <nav className="lp-nav">
        <div className="logo">Moc Nauki</div>
        <div className="nav-right nav-right-desktop">
          <button 
            onClick={closeTerms} 
            style={{ 
              background: "none", 
              border: "none", 
              color: "#60a5fa", 
              cursor: "pointer", 
              fontSize: "1.2rem",
              fontWeight: "600"
            }}
            title="Zamknij (ESC)"
          >
            ✕
          </button>
        </div>
      </nav>

      <section style={{ maxWidth: 800, margin: "0 auto", padding: "120px 24px 80px" }}>
        <TermsContent docType="terms" />

        <div style={{ textAlign: "center", marginTop: 48 }}>
          <button
            onClick={closeTerms}
            style={{
              background: "none",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#60a5fa",
              padding: "10px 28px",
              borderRadius: 10,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: ".9rem",
            }}
          >
            ✕ Zamknij kartę
          </button>
        </div>
      </section>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 32 }}>
    <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", marginBottom: 12 }}>{title}</h2>
    {children}
  </div>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <p style={{ marginBottom: 8 }}>{children}</p>
);

const Sub = ({ items }: { items: string[] }) => (
  <div style={{ paddingLeft: 24, marginBottom: 8 }}>
    {items.map((item, i) => (
      <p key={i} style={{ marginBottom: 4 }}>{String.fromCharCode(97 + i)}) {item}</p>
    ))}
  </div>
);

export default Terms;
