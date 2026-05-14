# 🧪 MANUAL END-TO-END TEST CHECKLIST

## Pre-requisites
- [ ] Zalogowany do aplikacji (nie guest)
- [ ] Noteś Tab otwarty z wybranym notebookiem i sekcją
- [ ] Chrome DevTools otwarty (F12)
- [ ] Console tab widoczny

## Test 1: Audio Recording & Transmission (Podstawowy)

### Steps:
1. W Notatki tab → upewnij się że jest wybrany notes + sekcja
2. Kliknij guzik mikrofonu (red recording button)
3. Czekaj aż pojawi się timer
4. Nagrywaj przez ~5-10 sekund (mówisz coś do mikrofonu)
5. Kliknij "Gotowy" (Submit button)

### Expected Behavior:
- [ ] Status zmienia się na "⏳ Wysyłam nagranie do przetworzenia…"
- [ ] Toast: "⏳ Wysyłam nagranie…"
- [ ] Pojawia się "floating pill" z "Tworzę notatkę…"
- [ ] Po ~10-30 sekund pojawia się nowa notatka w sekcji
- [ ] Toast: "✓ Notatka z lekcji gotowa!"

### Console Checks:
- Otwórz DevTools → Console
- Poszukaj:
  - `n8n response (raw):` - to jest raw response z webhooka
  - `n8n response (parsed):` - to jest sparsowany JSON
  - Czy są jakieś `ERROR` logi?

## Test 2: Debug First Request

### JavaScript w Console:
```javascript
// Sprawdzenie czy Supabase ma dostęp
const { data: user } = await supabase.auth.getUser();
console.log("User:", user);

// Sprawdzenie czy dostęp do session
const session = (await supabase.auth.getSession()).data.session;
console.log("Session access_token:", session?.access_token ? "OK" : "MISSING");

// Ręczny test proxy-n8n-audio (jeśli masz audio file)
// To wymaga więcej setup'u
```

## Test 3: Check Webhook URL

### W Admin Panel:
1. Zaloguj się jako admin
2. Admin Panel → Settings → Webhook (webhook_notes)
3. Sprawdź czy URL jest:
   - [ ] Prawidłowy format (https://...)
   - [ ] Nie pusta wartość
   - [ ] URL prowadzi do n8n instance

### Console Check:
```javascript
// Sprawdzenie  czy backend ma dostęp do webhook URL
// To wymaga dostępu do Supabase
```

## Test 4: Check Network Requests

1. DevTools → Network tab
2. Przefiltruj: `-n8n-audio`
3. Nagraj nową notatkę
4. Poszukaj POST request do `/functions/v1/proxy-n8n-audio`
5. Kliknij na request i sprawdzić:
   - **Status**: Powinno być 200
   - **Size**: Payload size (może być kilka MB z audio)
   - **Response**: Czy zawiera JSON z `title` i `content`?

### Response powinna zawierać:
```json
{
  "title": "Tytuł notatki",
  "content": "Treść HTML lub tekst",
  "html": "...",
  // Optional:
  "name": "Nazwa wydarzenia",
  "eventDate": "2026-04-29",
  "eventTime": "09:00"
}
```

## Test 5: Error Scenarios

### Scenario 1: Webhook Down
- [ ] Wyłącz webhook w n8n
- [ ] Nagraj notatkę
- [ ] Czekaj ~25 sekund
- [ ] Powinna pojawić się error "Webhook nie odpowiada"
- [ ] Powinna być retry (3 próby)

### Scenario 2: Invalid Response (z DevTools)
- [ ] Zmień response z webhook'a na `{}`
- [ ] Nagraj notatkę
- [ ] Powinna być error "Webhook nie zwrócił treści notatki"

## Test 6: Calendar Events Extraction

### Steps:
1. Nagraj notatkę z treścią zawierającą daty i godziny
2. Przykład: "Jutro mamy egzamin z matematyki o 14:30"
3. Czekaj na notatkę
4. Sprawdź czy pojawił się event w kalendarzu

### Console Check:
```javascript
// Sprawdzenie czy extract-events zwraca eventy
// Poszukaj logu: "📅 Wykryto X termin(y)"
```

## Test 7: Performance & Timeouts

### Measurement:
1. Network tab → zaznacz "Slow 3G" (jeśli chcesz symulować wolne połączenie)
2. Nagraj i zaobserwuj czasowanie
3. Timeout powinien być ~25s dla audio

### Expected Times:
- Audio upload: 2-5s (w zależności od rozmiaru)
- n8n processing: 10-30s (w zależności od model LLM/API)
- Total: 15-40s

## Test 8: Multiple Recordings

- [ ] Nagraj 3 notatki w rzędzie
- [ ] Sprawdź czy wszystkie pojawiają się
- [ ] Czy nie ma race conditions?

## Troubleshooting Flowchart

```
Nagrywanie się nie przesyła?
├─ Sprawdzić console → error messages
├─ Sprawdzić czy auth jest prawidłowy
└─ Spróbować hard refresh (Ctrl+Shift+R)

Notatka się nie pojawia?
├─ Sprawdzić Network tab → /proxy-n8n-audio response
├─ Jeśli status 500 → webhook error
├─ Jeśli status 200 ale pusty response → n8n problem
└─ Sprawdzić czy NotesTab ma wybrany notes/sekcję

Webhook timeout?
├─ Sprawdzić czy n8n instance jest online
├─ Sprawdzić czy webhook URL jest prawidłowy
├─ Sprawdzić czy toggle w n8n jest ON
└─ Sprawdzić network latency

Notatka jest pusta?
├─ Sprawdzić response z n8n (czy ma content?)
├─ Sprawdzić czy n8n workflow ma błędy
└─ Sprawdzić czy audio jest wystarczająco głośno
```

## Key Logs to Check

Wszystkie te logi powinny pojawić się w DevTools Console:

```
1. "🎤 Nagrywanie rozpoczęte!" → recording start OK
2. "⏳ Wysyłam nagranie do przetworzenia…" → upload start OK
3. "n8n response (raw):" → webhook response received
4. "n8n response (parsed):" → response parsed OK
5. "✓ Notatka z lekcji gotowa!" → success
```

## Admin Panel: Check webhook_notes

URL: https://app.supabase.com → Your Project → SQL Editor

```sql
SELECT * FROM app_settings WHERE key = 'webhook_notes';
```

Should return 1 row with:
- key: `webhook_notes`
- value: `https://czacki3.app.n8n.cloud/webhook/...` (or your n8n instance)

---

**Last Updated**: April 29, 2026
**Status**: Testing with fixes applied
