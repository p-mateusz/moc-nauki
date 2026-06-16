## 1. Ustawienia konta — kafelki

W `SettingsTab.tsx` (sekcja "⚙️ Ustawienia konta", linie ~789–806):

- Usunąć kafel "🔔 Powiadomienia".
- Zostawić "🔐 Zmień hasło".
- Dodać dwa nowe kafle z tym samym stylem:
  - "⚙️ Preferencje" — "Dostosuj naukę i widoczność języków" → otwiera `PreferencesDialog`.
  - "📅 Połącz kalendarz" — "Subskrybuj wydarzenia w Apple Calendar / iCloud" → otwiera `CalendarConnectDialog`.

Oba dialogi w tym samym wizualnym stylu co istniejący "Zmień hasło" (overlay + ciemna karta).

## 2. Magazyn preferencji

Migracja: dodać do `user_profiles` kolumnę `preferences jsonb DEFAULT '{}'::jsonb NOT NULL` oraz `calendar_feed_token text UNIQUE` (na razie NULL).

Struktura `preferences`:
```json
{
  "noteLanguageMode": "original" | "polish",   // domyślnie "original"
  "hiddenLanguages": ["fr","it"],              // języki ukryte w „Języki AI"
  "flashcardsAutoplayAudio": true,             // auto-wymowa w fiszkach
  "confirmDelete": true,                        // potwierdzenie przy usuwaniu listy/notatki
  "defaultDashboardTab": "overview"            // overview | notes | languages | calendar
}
```

Hook `usePreferences()` (`src/hooks/use-preferences.ts`):
- Ładuje z `user_profiles.preferences`, cache w localStorage (`userPreferences`).
- `update(partial)` → upsert do bazy + emit `preferencesChanged` window event.

## 3. PreferencesDialog

Sekcje (każda jako rząd z opisem + przełącznik/checkboxy w stylu istniejących kart):

1. **Notatki z lekcji w innych językach** — radio dwie opcje:
   - "W oryginalnym języku" (`original`)
   - "Po polsku (słówka zostają w oryginale)" (`polish`)

2. **Widoczne języki w „Języki AI"** — lista checkboxów: 🇬🇧 EN, 🇪🇸 ES, 🇩🇪 DE, 🇫🇷 FR, 🇮🇹 IT. Odznaczenie = trafia do `hiddenLanguages`. Walidacja: minimum 1 widoczny.

3. **Nauka** — switche:
   - Auto-odtwarzanie wymowy w fiszkach
   - Potwierdzenie przy usuwaniu list i notatek

4. **Domyślna zakładka po wejściu w Panel** — select: Przegląd / Notatki / Języki AI / Kalendarz.

Brak żadnych opcji powiadomień ani trybu nocny/dzienny.

## 4. Integracja preferencji w aplikacji

- `LanguagesTab.tsx` — `langOrder` filtrowane przez `preferences.hiddenLanguages`; jeśli aktywny `lang` jest ukryty, przełączyć na pierwszy widoczny.
- `RecordingWidget.tsx` (`sendToN8n`) — do `FormData` dorzucić `noteLanguageMode` z preferencji (`original`/`polish`) oraz `noteLanguageHint` (krótki polski opis, np. `"Zachowaj notatkę w oryginalnym języku, słówka zawsze w języku oryginalnym"` lub `"Przetłumacz notatkę na polski, ale słówka zostaw w języku oryginalnym"`).
- `supabase/functions/proxy-n8n-audio/index.ts` — przepuścić oba pola dalej do n8n (`outgoing.append(...)`).
- `MocDashboard.tsx` — przy montowaniu, jeśli brak `activeTab` w URL/localStorage, użyj `preferences.defaultDashboardTab`.
- `FlashCards.tsx` — uwzględnij `flashcardsAutoplayAudio` przy auto-odtwarzaniu TTS.
- Miejsca usuwania (LanguagesTab, NotesTab) — pomijają potwierdzenie, gdy `confirmDelete === false`.

## 5. Subskrypcja kalendarza Apple (iCloud)

Apple Calendar / iOS Kalendarz obsługuje subskrypcję URL-em `webcal://` zwracającym plik `.ics` (iCalendar). Klient automatycznie odpytuje feed (domyślnie kilka razy dziennie), więc każde nowe wydarzenie pojawia się tam bez ręcznej akcji.

### Edge function `calendar-ics`

Nowa: `supabase/functions/calendar-ics/index.ts`.
- `verify_jwt = false` w `supabase/config.toml` (publiczny endpoint po tokenie).
- GET `/calendar-ics?token=...` →
  1. Walidacja: token niepusty, znajduje `user_profiles` z tym `calendar_feed_token`.
  2. Pobiera `calendar_events` dla tego usera (admin client).
  3. Buduje treść `text/calendar; charset=utf-8` z `VCALENDAR`/`VEVENT` (PRODID, UID = event.id, DTSTAMP, DTSTART/DTEND lub `VALUE=DATE` dla wydarzeń całodniowych, SUMMARY, DESCRIPTION, LOCATION jeśli dostępne).
  4. Cache headers: `Cache-Control: private, max-age=300`.

Tokeny: 32-bajtowy random base64url, generowany leniwie przy pierwszym otwarciu dialogu (edge function `manage-calendar-feed` z akcjami `get` / `regenerate` / `revoke`) – wymaga JWT użytkownika i ustawia `user_profiles.calendar_feed_token`.

### CalendarConnectDialog

- Pobiera/tworzy token przez `manage-calendar-feed` (`action: "get"`).
- Pokazuje:
  - URL `webcal://<projectref>.functions.supabase.co/calendar-ics?token=...` (read-only input + przycisk Kopiuj).
  - Przycisk **„Dodaj do Apple Calendar"** → `window.location.href = webcal://...` (na iOS/macOS otwiera natywny dialog subskrypcji).
  - Krótka instrukcja krok-po-kroku dla macOS (Kalendarz → Plik → Nowa subskrypcja kalendarza) oraz iOS (Ustawienia → Kalendarz → Konta → Dodaj konto → Inne → Dodaj subskrybowany kalendarz).
  - Przycisk „Wygeneruj nowy link" (revoke + regenerate, ostrzeżenie że stary przestanie działać).
- Brak zapisu na koncie Apple od strony aplikacji — synchronizacja jest jednokierunkowa (app → Apple), zgodnie z prośbą („pojawi się również w Apple").

## 6. Migracja DB (jedna)

```sql
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS calendar_feed_token text;

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_calendar_feed_token_key
  ON public.user_profiles(calendar_feed_token)
  WHERE calendar_feed_token IS NOT NULL;
```
RLS już istnieje (user czyta/aktualizuje swój wiersz). Edge function `calendar-ics` używa service role, omija RLS, ale filtruje po tokenie.

## 7. Pliki do utworzenia / zmiany

Nowe:
- `src/hooks/use-preferences.ts`
- `src/components/dashboard/PreferencesDialog.tsx`
- `src/components/dashboard/CalendarConnectDialog.tsx`
- `supabase/functions/calendar-ics/index.ts`
- `supabase/functions/manage-calendar-feed/index.ts`
- migracja SQL

Zmiany:
- `src/components/dashboard/SettingsTab.tsx` — kafle + dialogi
- `src/components/dashboard/LanguagesTab.tsx` — filtr hiddenLanguages
- `src/components/dashboard/RecordingWidget.tsx` — przekaż noteLanguageMode/hint
- `supabase/functions/proxy-n8n-audio/index.ts` — przepuść 2 pola
- `src/pages/MocDashboard.tsx` — defaultDashboardTab
- `src/pages/FlashCards.tsx` — autoplay flag
- `supabase/config.toml` — `verify_jwt = false` dla `calendar-ics`

## Otwarte pytania

1. Czy pasuje zestaw „innych preferencji" zaproponowany w sekcji 3 (auto-wymowa, potwierdzenie usuwania, domyślna zakładka)? Czy chcesz coś dorzucić/wyrzucić?
2. Subskrypcja kalendarza Apple jest **tylko-do-odczytu** po stronie Apple (edytujesz w Mocy Nauki, Apple wyświetla). To pasuje, czy chcesz też zapis dwukierunkowy (wymagałby OAuth do iCloud, nieobsługiwane natywnie — wymagałoby CalDAV z hasłem aplikacyjnym)?
