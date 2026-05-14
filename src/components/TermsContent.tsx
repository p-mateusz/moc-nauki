import React from "react";

export type DocumentType = "terms" | "privacy" | "cookies";

const TermsContent: React.FC<{ docType: DocumentType }> = ({ docType }) => {
  if (docType === "privacy") {
    return (
      <>
        <h1
          style={{
            fontSize: "1.8rem",
            fontWeight: 900,
            color: "#fff",
            textAlign: "center",
            marginBottom: 48,
            background: "linear-gradient(135deg, #60a5fa, #a78bfa)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Polityka Prywatności
        </h1>

        <div style={{ color: "#c5d0e0", fontSize: ".95rem", lineHeight: 1.8 }}>
          <Section title="§ 1. Postanowienia ogólne">
            <P>
              1.1. Niniejsza Polityka Prywatności określa zasady przetwarzania
              danych osobowych Użytkowników aplikacji „Moc Nauki".
            </P>
            <P>
              1.2. Korzystanie z aplikacji oznacza zgodę na zasady opisane w
              niniejszym dokumencie.
            </P>
          </Section>

          <Section title="§ 2. Zakres danych">
            <P>
              2.1. Przetwarzane dane obejmują informacje kontaktowe, dane
              konta, dane techniczne urządzenia oraz dane generowane podczas
              korzystania z modułu aplikacji.
            </P>
            <P>
              2.2. Dane są wykorzystywane wyłącznie w celu zapewnienia działania
              aplikacji oraz obsługi konta Użytkownika.
            </P>
          </Section>

          <Section title="§ 3. Prawa Użytkownika">
            <P>3.1. Użytkownik ma prawo do:</P>
            <Sub
              items={[
                "dostępu do swoich danych,",
                "sprostowania danych,",
                "usunięcia danych,",
                "ograniczenia przetwarzania danych.",
              ]}
            />
            <P>
              3.2. Wnioski i prośby dotyczące danych osobowych można złożyć na
              adres e-mail wskazany przez Właściciela aplikacji.
            </P>
          </Section>

          <Section title="§ 4. Bezpieczeństwo danych">
            <P>
              4.1. Właściciel stosuje środki techniczne i organizacyjne mające
              na celu ochronę danych osobowych przed dostępem osób nieuprawnionych.
            </P>
            <P>
              4.2. Dane nie są udostępniane osobom trzecim poza przypadkami
              wynikającymi z przepisów prawa lub realizacji usług.
            </P>
          </Section>

          <Section title="§ 5. Zmiany Polityki Prywatności">
            <P>
              5.1. Właściciel zastrzega sobie prawo do zmiany niniejszej Polityki
              Prywatności.
            </P>
            <P>
              5.2. Zmiany wchodzą w życie z chwilą ich publikacji w aplikacji.
            </P>
          </Section>
        </div>
      </>
    );
  }

  if (docType === "cookies") {
    return (
      <>
        <h1
          style={{
            fontSize: "1.8rem",
            fontWeight: 900,
            color: "#fff",
            textAlign: "center",
            marginBottom: 48,
            background: "linear-gradient(135deg, #60a5fa, #a78bfa)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Polityka Cookies
        </h1>

        <div style={{ color: "#c5d0e0", fontSize: ".95rem", lineHeight: 1.8 }}>
          <Section title="§ 1. Czym są pliki cookies">
            <P>
              1.1. Pliki cookies to małe pliki tekstowe zapisywane na urządzeniu
              Użytkownika w celu poprawy działania aplikacji.
            </P>
            <P>
              1.2. Cookies pomagają zapamiętywać ustawienia oraz analizować sposób
              korzystania z aplikacji.
            </P>
          </Section>

          <Section title="§ 2. Wykorzystanie cookies">
            <P>
              2.1. Aplikacja używa cookies do zapewnienia funkcji podstawowych i
              analitycznych.
            </P>
            <P>
              2.2. Cookies mogą być wykorzystywane do zapamiętywania zgody
              użytkownika oraz preferencji wyświetlania.
            </P>
          </Section>

          <Section title="§ 3. Zarządzanie cookies">
            <P>
              3.1. Użytkownik może zarządzać ciasteczkami w ustawieniach swojej
              przeglądarki lub za pomocą opcji dostępnych w aplikacji.
            </P>
            <P>
              3.2. Wyłączenie cookies może ograniczyć część funkcjonalności
              aplikacji.
            </P>
          </Section>

          <Section title="§ 4. Zmiany Polityki Cookies">
            <P>
              4.1. Właściciel zastrzega sobie prawo do zmiany Polityki Cookies.
            </P>
            <P>
              4.2. Zmiany wchodzą w życie z chwilą ich publikacji w aplikacji.
            </P>
          </Section>
        </div>
      </>
    );
  }

  return (
    <>
      <h1
        style={{
          fontSize: "1.8rem",
          fontWeight: 900,
          color: "#fff",
          textAlign: "center",
          marginBottom: 48,
          background: "linear-gradient(135deg, #60a5fa, #a78bfa)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        Regulamin
      </h1>

      <div style={{ color: "#c5d0e0", fontSize: ".95rem", lineHeight: 1.8 }}>
        <Section title="§ 1. Postanowienia ogólne">
          <P>
            1.1. Niniejszy Regulamin określa zasady korzystania z aplikacji „Moc Nauki",
            w tym modułu „Słuchania Lekcji", udostępnianego przez właściciela aplikacji
            (dalej: „Właściciel").
          </P>
          <P>
            1.2. Korzystanie z aplikacji oznacza akceptację niniejszego Regulaminu
            oraz wszystkich obowiązujących przepisów prawa, w tym ustawy o systemie
            oświaty oraz RODO.
          </P>
        </Section>

        <Section title="§ 2. Definicje">
          <P>2.1. „Użytkownik" – osoba korzystająca z aplikacji (uczniowie, studenci, ich opiekunowie prawni).</P>
          <P>2.2. „Moduł Słuchania Lekcji" – funkcja, w której urządzenie Użytkownika nagrywa lekcję, transkrybuje mowę, tworzy notatkę i automatycznie usuwa nagranie z danych aplikacji.</P>
          <P>2.3. „Notatka" – tekst powstały na podstawie transkrypcji lekcji, zapisywany w aplikacji lub eksportowany przez Użytkownika.</P>
        </Section>

        <Section title="§ 3. Zakres odpowiedzialności Właściciela">
          <P>3.1. Właściciel nie ponosi odpowiedzialności za:</P>
          <Sub
            items={[
              "treść nagrywaną w trakcie lekcji,",
              "zawartość transkrypcji mowy lub notatki,",
              "dokładność, kompletność ani błędy faktyczne w notatkach,",
              "sposób, w jaki Użytkownik wykorzystuje notatkę.",
            ]}
          />
          <P>3.2. Użytkownik bierze na siebie pełną odpowiedzialność za:</P>
          <Sub
            items={[
              "uzyskanie zgody nauczyciela na nagrywanie lekcji,",
              "zgodność z przepisami RODO i przepisami o ochronie prywatności,",
              "zgodność z regulaminem szkoły, statutem placówki oraz zasadami korzystania z urządzeń elektronicznych w szkole.",
            ]}
          />
          <P>
            3.3. Użytkownik potwierdza, że nie nagrywa lekcji bez zgody nauczyciela ani w sposób sprzecznym z przepisami prawa lub zasadami szkolnymi i nie udostępnia ani nie rozpowszechnia nagrania, transkrypcji ani notatki w sposób publiczny.
          </P>
        </Section>

        <Section title='§ 4. Zastosowanie modułu "Słuchania Lekcji"'>
          <P>
            4.1. Użytkownik korzysta z modułu wyłącznie na własny użytek edukacyjny i na własne ryzyko.
          </P>
          <P>4.2. Użytkownik zobowiązuje się, że:</P>
          <ul style={{ paddingLeft: 24, marginBottom: 8 }}>
            <li>nie będzie nagrywał lekcji bez zgody nauczyciela,</li>
            <li>nie będzie wykorzystywał aplikacji do nagrywania rozmów prywatnych, nielegalnych ani obraźliwych treści,</li>
            <li>nie będzie udostępniał ani rozpowszechniał nagrania, transkrypcji ani notatki w sposób publiczny.</li>
          </ul>
          <P>
            4.3. Użytkownik potwierdza, że nagranie jest automatycznie usuwane z danych aplikacji zaraz po zakończeniu procesu tworzenia notatki i nie jest dostępne do rozesłania z poziomu aplikacji.
          </P>
        </Section>

        <Section title="§ 5. Przetwarzanie danych osobowych (Polityka Prywatności / RODO)">
          <P>5.1. Administratorem danych osobowych jest Właściciel aplikacji „Moc Nauki".</P>
          <P>5.2. Dane są przetwarzane wyłącznie w celu działania modułu „Słuchania Lekcji":</P>
          <Sub
            items={[
              "nagranie dźwięku,",
              "przetworzenie nagrania na transkrypcję,",
              "utworzenie notatki,",
              "usunięcie nagrania z danych aplikacji.",
            ]}
          />
          <P>
            5.3. Aplikacja nie udostępnia nagrania osobom trzecim i nie przechowuje go dłużej niż to konieczne do przetworzenia (zaraz po zakończeniu procesu tworzenia notatki).
          </P>
          <P>5.4. Użytkownik ma prawo:</P>
          <Sub
            items={[
              "do dostępu do swoich danych,",
              "do sprostowania danych,",
              "do usunięcia notatki lub żądania usunięcia danych,",
              "do ograniczenia przetwarzania.",
            ]}
          />
          <P>
            5.5. Wszystkie zgłoszenia w zakresie RODO mogą być kierowane na adres e‑mail udostępniony przez Właściciela.
          </P>
        </Section>

        <Section title="§ 6. Zmiany Regulaminu oraz Polityki Prywatności">
          <P>6.1. Właściciel zastrzega sobie prawo do zmiany Regulaminu oraz Polityki Prywatności.</P>
          <P>
            6.2. Zmiany wchodzą w życie z chwilą ich opublikowania w aplikacji. Korzystanie z modułu „Słuchania Lekcji" oznacza akceptację aktualnej wersji niniejszego dokumentu.
          </P>
        </Section>
      </div>
    </>
  );
}

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
      <p key={i} style={{ marginBottom: 4 }}>
        {String.fromCharCode(97 + i)}) {item}
      </p>
    ))}
  </div>
);

export default TermsContent;
