## Audyt bezpieczeństwa aplikacji

Przeprowadzę kompleksowy skan kodu i backendu pod kątem podatności, które mogłyby zostać wykorzystane przez atakujących.

### Zakres audytu

**1. Sekrety i klucze API w kodzie**
- Skan `src/`, `supabase/functions/`, plików konfiguracyjnych i publicznych pod kątem twardo zakodowanych sekretów (API keys, service role keys, hasła)
- Weryfikacja, czy `SUPABASE_SERVICE_ROLE_KEY` nigdy nie trafia do frontendu
- Sprawdzenie plików `.env`, `capacitor.config.ts`, `public/*` i `netlify.toml`

**2. Edge Functions**
- Weryfikacja JWT w każdej funkcji, która modyfikuje dane
- Sprawdzenie, czy funkcje publiczne (`verify_jwt = false`) mają własną autoryzację (np. Stripe webhook signature, callback secrets)
- Walidacja inputu (zod/ręczna) — szczególnie w `submit-form`, `upload-chat-image`, `proxy-n8n-audio`, `auth-register`, `auth-login`, `manage-app-settings`, `admin-manage-users`
- Sprawdzenie CORS i wycieków szczegółów błędów
- SSRF/URL-injection w proxy do n8n

**3. RLS i uprawnienia bazy danych**
- Uruchomienie skanera bezpieczeństwa i Supabase lintera
- Sprawdzenie polityk RLS wszystkich tabel (szczególnie: `user_accounts`, `messages`, `tests`, `user_profiles`, `custom_roles`, `app_settings`, `webhook_usage`, `registration_attempts`)
- Kontrola GRANTów dla `anon` i `authenticated`
- Weryfikacja, czy funkcje `SECURITY DEFINER` mają `search_path` i sprawdzają `auth.uid()`

**4. Storage buckets**
- Polityki dla `avatars` (publiczny), `note-images`, `chat-images`
- Weryfikacja ścieżek plików (folder = user id)
- Czas życia signed URLs

**5. Autoryzacja po stronie klienta**
- Sprawdzenie, czy role/uprawnienia nie są nigdy czytane wyłącznie z `localStorage`
- Weryfikacja ścieżek admin (`AdminUsersTab`, `AdminAppLinksDialog`) — server-side check
- Ochrona routingu (`use-access-guard`, `use-user-role`)

**6. Rate limiting i anti-abuse**
- Przegląd istniejących limitów (`registration_attempts`, `webhook_usage`)
- Identyfikacja endpointów bez limitu, które mogłyby zostać nadużyte (login brute-force, upload zdjęć, proxy n8n audio, generowanie definicji/zdań)
- Uwaga: platforma nie ma standardowego primitive'u rate limitingu — zaproponuję ad-hoc rozwiązania tam, gdzie ryzyko jest realne

**7. XSS, SQL injection, otwarte przekierowania**
- Wyszukanie `dangerouslySetInnerHTML`, `eval`, konstrukcji SQL z interpolacją stringów
- Walidacja URL-i używanych do `window.location` / redirectów (Stripe, share links)
- Sprawdzenie escapowania w chatach, notatkach, testach

**8. Zależności npm**
- `code--dependency_scan` — luki high/critical w bibliotekach

### Deliverable

Raport w formacie:
- **Krytyczne** (natychmiastowa poprawka wymagana) — z konkretnymi plikami i liniami
- **Wysokie** (poprawić w tej rundzie)
- **Średnie / do rozważenia**
- **Działania po Twojej stronie** — cokolwiek wymagającego ręcznej zmiany w View Backend (np. rotacja klucza, ustawienia Auth, polityki storage niedostępne przez migrację)

Po Twojej akceptacji przejdę do trybu build i wprowadzę poprawki plik po pliku — jedna migracja SQL na wszystkie zmiany RLS/GRANT, jeden zestaw edycji edge functions, jeden zestaw poprawek frontendu. Findings z panelu bezpieczeństwa oznaczę odpowiednio (`mark_as_fixed` / `ignore` z uzasadnieniem) i zaktualizuję `@security-memory`.

### Czego nie zrobię bez pytania

- Nie będę wprowadzał zmian łamiących UX (np. wymuszania 2FA, wylogowania wszystkich sesji) — jeśli coś takiego wyjdzie z audytu, zapytam
- Nie dodam rate limitingu bez potwierdzenia (zgodnie z polityką platformy trzeba świadomie zaakceptować tradeoff)
- Nie ruszę auto-generowanych plików (`src/integrations/supabase/client.ts`, `types.ts`, `.env`)
