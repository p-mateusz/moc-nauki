import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Seo } from "@/components/Seo";
import "./LandingPage.css";

const Trust = () => {
  const navigate = useNavigate();

  const close = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="landing-root" style={{ minHeight: "100vh" }}>
      <Seo
        title="Bezpieczeństwo i prywatność — Moc Nauki"
        description="Informacje o tym, jak Moc Nauki chroni Twoje dane: uwierzytelnianie, hosting, podprzetwarzający, retencja danych i kontakt w sprawie zgłoszeń."
        path="/trust"
      />
      <nav className="lp-nav">
        <div className="logo">Moc Nauki</div>
        <div className="nav-right nav-right-desktop">
          <button
            onClick={close}
            style={{
              background: "none",
              border: "none",
              color: "#60a5fa",
              cursor: "pointer",
              fontSize: "1.2rem",
              fontWeight: 600,
            }}
            title="Zamknij (ESC)"
          >
            ✕
          </button>
        </div>
      </nav>

      <section style={{ maxWidth: 820, margin: "0 auto", padding: "120px 24px 80px", color: "#e5e7eb", lineHeight: 1.7 }}>
        <h1 style={{ fontSize: "2.2rem", marginBottom: 12 }}>Bezpieczeństwo i prywatność</h1>
        <p style={{ color: "#94a3b8", marginBottom: 32 }}>
          Ta strona jest utrzymywana przez zespół Moc Nauki i opisuje typowe pytania dotyczące bezpieczeństwa
          i prywatności naszej platformy edukacyjnej. Treść ma charakter informacyjny — nie stanowi niezależnej
          certyfikacji ani audytu.
        </p>

        <h2 style={{ marginTop: 32 }}>Uwierzytelnianie i dostęp</h2>
        <ul>
          <li>Logowanie e-mail/hasło oraz Google.</li>
          <li>Hasła użytkowników są przechowywane wyłącznie w formie skrótów po stronie dostawcy uwierzytelnienia — nigdy w postaci jawnej.</li>
          <li>Każdy użytkownik widzi tylko własne dane; reguły dostępu są wymuszane po stronie bazy (Row-Level Security).</li>
        </ul>

        <h2 style={{ marginTop: 32 }}>Hosting i infrastruktura</h2>
        <p>
          Aplikacja jest hostowana na platformie Lovable, a warstwa backendowa (baza danych, autoryzacja, storage,
          funkcje serwerowe) działa w usłudze zarządzanej. Komunikacja klient–serwer odbywa się przez HTTPS.
          Korzystanie z platformy podlega podziałowi odpowiedzialności: dostawca odpowiada za infrastrukturę,
          a my za konfigurację reguł dostępu i logikę aplikacji.
        </p>

        <h2 style={{ marginTop: 32 }}>Dane, które przetwarzamy</h2>
        <ul>
          <li>Dane konta (adres e-mail, nazwa użytkownika, rola).</li>
          <li>Treści tworzone przez użytkownika: notatki, fiszki, listy słówek, wydarzenia w kalendarzu, wiadomości.</li>
          <li>Pliki uploadowane do aplikacji (np. awatary, obrazy w notatkach i czacie) przechowywane w prywatnych
            bucketach z dostępem ograniczonym do właściciela folderu.</li>
        </ul>

        <h2 style={{ marginTop: 32 }}>Wiadomości i obrazy w czacie</h2>
        <p>
          Wiadomości są dostępne wyłącznie dla nadawcy i odbiorcy. Obrazy załączone do wiadomości znajdują się
          w prywatnym bucketcie; dostęp do nich udzielany jest poprzez krótkoterminowe lub podpisane adresy URL,
          a nie poprzez publiczny link.
        </p>

        <h2 style={{ marginTop: 32 }}>Integracje z usługami zewnętrznymi</h2>
        <ul>
          <li>Funkcje AI (np. generowanie notatek, fiszek, zdań przykładowych) realizowane są przez przepływy n8n
            wywoływane wyłącznie przez nasze funkcje serwerowe — adresy webhooków nie są ujawniane klientowi.</li>
          <li>Płatności obsługiwane są przez Stripe; nie przechowujemy danych kart płatniczych.</li>
        </ul>

        <h2 style={{ marginTop: 32 }}>Retencja i usuwanie danych</h2>
        <p>
          Możesz w każdej chwili usunąć swoje treści w aplikacji. Aby usunąć konto i powiązane dane, napisz do nas
          na adres podany poniżej. Szczegółowe zasady przetwarzania znajdują się w <a href="/terms" style={{ color: "#60a5fa" }}>regulaminie i polityce prywatności</a>.
        </p>

        <h2 style={{ marginTop: 32 }}>Zgłaszanie podatności i kontakt</h2>
        <p>
          Jeśli zauważysz podatność lub potencjalny incydent bezpieczeństwa, prosimy o kontakt mailowy. Wszystkie
          zgłoszenia traktujemy poważnie i odpowiadamy najszybciej, jak to możliwe.
        </p>
        <p style={{ color: "#94a3b8" }}>
          Kontakt: zobacz adres podany na stronie głównej / w regulaminie.
        </p>

        <div style={{ textAlign: "center", marginTop: 48 }}>
          <button
            onClick={close}
            style={{
              background: "#3b82f6",
              color: "#fff",
              border: "none",
              padding: "12px 28px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: "1rem",
              fontWeight: 600,
            }}
          >
            Wróć
          </button>
        </div>
      </section>
    </div>
  );
};

export default Trust;
