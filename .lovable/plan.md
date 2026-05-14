

## Plan: Ulepszony tryb gościa (atrapy danych)

### Cele
1. **Słabsze rozmazanie** — czytelne że to UI, ale nieczytelne treści.
2. Dodać atrapy danych dla zakładek bez danych demo: **Nauczyciele**, **Testy**, **Kalendarz**, **Notatki** (rozszerzenie), **Początek (przypomnienia)**.
3. Atrapy są lokalne — nie zapisywane do bazy, niewidoczne dla innych użytkowników.

### 1. Rozmazanie (`MocDashboard.css`)
- Usunąć podwójny blur (obecnie `filter: blur(6px)` + `backdrop-filter: blur(8px)` razem dają silne rozmycie).
- Nowe wartości: `filter: blur(3.5px)` na treści, usunąć `backdrop-filter` z overlay (zostawić tylko delikatne przyciemnienie tła i ikonę 🔒).
- Efekt: pojedyncze słowa nieczytelne, ale układ widoczny.

### 2. TeacherStudentsTab (`src/components/dashboard/TeacherStudentsTab.tsx`)
Dodać prop `guestMode?: boolean` i logikę demo:
- 8 nauczycieli z polskimi nazwiskami, różnymi przedmiotami i avatarami kolorowymi.
- Auto-otwarta konwersacja z pierwszym nauczycielem („Anna Kowalska") z ~10 wiadomościami (mix wysłanych/odebranych) o sprawdzianach, zadaniach domowych, terminach.
- Brak zapytań do Supabase w trybie gościa.
- Przekazać `guestMode` z `MocDashboard` do obu instancji.

### 3. TestsTab (`src/components/dashboard/TestsTab.tsx`)
Dodać prop `guestMode` + tryb demo:
- ~12 realistycznie wyglądających testów (różne przedmioty: matematyka, biologia, historia, polski, angielski, fizyka, chemia, geografia).
- Każdy z autorem, szkołą, klasą, liczbą polubień (5–80), użyć (10–250), opisem.
- W trybie gościa skip `fetchTests`/`fetchSaves`.

### 4. CalendarTab — więcej wydarzeń
W istniejącym `if (guestMode)` rozszerzyć demo events o dodatkowe wydarzenia w stylu zdjęcia (kolorowe paski wypełniające tygodniowy widok):
- Codziennie 4–6 wydarzeń w godz. 7:00–22:00.
- Rozkład: poranne (śniadanie/dojazd), szkoła z różnymi lekcjami (historia, biologia, WF, matematyka), popołudniowe zajęcia (korepetycje, sport, sztuka), wieczorne (nauka, czytanie).
- Mix kolorów (5 kalendarzy: Szkoła #6366f1, Zajęcia #3b82f6, Lekcje #34d399, Sport #f472b6, Osobisty #fbbf24).
- **Bez zmian w działaniu/wyglądzie kalendarza** — tylko więcej elementów w tablicy `demoEvents`.

### 5. NotesTab — 8 notesów
Rozszerzyć `demoNotebooks` z 3 do **8 notesów** w różnych kolorach:
- Biologia (#34d399), Matematyka (#3b82f6), Angielski (#f59e0b), Polski (#f87171), Historia (#a78bfa), Chemia (#22d3ee), Fizyka (#fb923c), Geografia (#e879f9).
- 7 z nich: tylko nazwa + 1–2 sekcje + 2–4 strony z krótkimi tytułami.
- **Pierwszy notes (Biologia) — otwarty domyślnie**, z 4–5 sekcjami (Komórka, Genetyka, Ekologia, Anatomia, Botanika) i licznymi stronami (15+ łącznie), z wypełnioną treścią (kilka paragrafów tekstu) na otwartej stronie.
- Auto-otworzyć pierwszą stronę pierwszego notesu w trybie gościa.

### 6. OverviewTab — przypomnienia (atrapy)
Obecnie OverviewTab wymaga `userId` i nie ma trybu gościa — przypomnienia w ogóle się nie ładują. Dodać:
- Prop `guestMode?: boolean` przekazany z `MocDashboard`.
- W trybie gościa: 4 listy Eisenhowera z atrapami (5–8 przypomnień łącznie):
  - 🔴 Pilne, ważne: „Powtórka do sprawdzianu z matematyki", „Oddać projekt z biologii", „Zadanie domowe – polski"
  - 🟡 Niepilne, ważne: „Zacząć przygotowania do matury", „Przeczytać lekturę"
  - 🔵 Pilne, nieważne: „Odpowiedzieć na maile", „Zapisać się na zajęcia dodatkowe"
  - ⚪ Niepilne, nieważne: „Posprzątać biurko"
- Heatmapa aktywności: wygenerować ~60 losowych dni z ostatnich 105.
- Ostatnie notatki: 3–5 atrap (tytuły: „Mitochondria", „Równania kwadratowe", „Past Simple"…).
- Skip wszystkich `supabase.from(...)` i `.rpc(...)` gdy `guestMode === true`.

### 7. MocDashboard.tsx
- Przekazać `guestMode` jako prop do `TeacherStudentsTab` (obie instancje), `TestsTab`, `OverviewTab`.

### Podsumowanie zmian w plikach
- `src/pages/MocDashboard.css` — osłabienie blur.
- `src/pages/MocDashboard.tsx` — przekazanie `guestMode` do 4 komponentów.
- `src/components/dashboard/TeacherStudentsTab.tsx` — dodanie `guestMode` + atrapy + auto-otwarta konwersacja.
- `src/components/dashboard/TestsTab.tsx` — dodanie `guestMode` + atrapy testów.
- `src/components/dashboard/CalendarTab.tsx` — rozszerzenie demo events.
- `src/components/dashboard/NotesTab.tsx` — 8 notesów + bogata treść w pierwszym.
- `src/components/dashboard/OverviewTab.tsx` — dodanie `guestMode` + atrapy przypomnień/aktywności/notatek.

### Bezpieczeństwo
Wszystkie atrapy są tylko w pamięci komponentu (`useState`) — nigdy nie trafiają do bazy (warunki `if (guestMode) return;` przed każdym `supabase` write). Inni użytkownicy ich nie zobaczą.

