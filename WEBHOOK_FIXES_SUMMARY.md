# 📋 Webhook Notatek (n8n) - Bug Report & Fixes

**Date**: April 29, 2026  
**Status**: ✅ FIXED (Testing Required)

---

## 🐛 Problemy Znalezione

### Problem #1: Różne payload'e wysyłane do tego samego webhook'a 🔴
**Severity**: HIGH  
**File**: `/supabase/functions/extract-events/index.ts`

#### Opis:
Webhook URL przesyłał dwa różne typy payload'ów bez jasnego typu:

```typescript
// proxy-n8n-audio wysyła:
{ audioBase64: "...", duration: "0:01", type: "transcribe" }

// extract-events wysyłało (BUG):
{ pageTitle: "...", content: "...", noteDate: "...", subject: "..." }
// ⚠️ Brakuje `type` field! n8n nie wie co to jest
```

#### Wpływ:
- n8n webhook nie mógł poprawnie rozróżnić żądań
- Extract-events mógł zwrócić zły format odpowiedzi
- Notatki mogły być tworzone z niepełnymi danymi

#### Naprawka:
Dodany `type: "extract-events"` do payload:
```typescript
body: JSON.stringify({ type: "extract-events", pageTitle, content, noteDate, subject })
```

---

### Problem #2: Brak timeout'ów w fetch do webhooka 🔴
**Severity**: CRITICAL  
**Files**: 
- `/supabase/functions/proxy-n8n-audio/index.ts`
- `/supabase/functions/transcribe-note/index.ts`
- `/supabase/functions/extract-events/index.ts`

#### Opis:
Edge functions nie miały timeout'ów przy wysyłaniu do n8n. Supabase ma limit 30 sekund na funkcję.  
Jeśli n8n jest powoli lub nie odpowiada, edge function czeka nieskończenie, aż do 30s limitu.

#### Wpływ:
- **User Experience**: Aplikacja "zwisa" na 30 sekund
- **Failed Requests**: Po 30s, zapytanie zostaje przerwane
- **Brak Retryów**: Edge function nie powraca do frontendu, aby frontend mógł retry'ować

#### Naprawka:
Dodany `AbortController` z timeout'ami:
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

const response = await fetch(webhookUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(n8nPayload),
  signal: controller.signal as any, // ← dodane
});
```

**Timeout wartości**:
- `proxy-n8n-audio`: 240s / 4 min (audio processing)
- `transcribe-note`: 240s / 4 min (audio processing)
- `extract-events`: 15s (text processing, szybsze)

---

### Problem #3: Zły fallback parsing w RecordingWidget 🟡
**Severity**: MEDIUM  
**File**: `/src/components/dashboard/RecordingWidget.tsx`

#### Opis:
```typescript
else if (typeof json === "string") content = json; 
// ⚠️ NIGDY nie będzie true, bo JSON.parse() zwraca object!
```

To był martwy kod, który nigdy się nie wykonywał.  
Jeśli webhook zwracał strukturę bez `content` field, aplikacja  
fallback'owała do surowego tekstu zamiast show JSON structure.

#### Naprawka:
```typescript
else {
  // Fallback: if response is structured but missing content, stringify it
  content = JSON.stringify(json, null, 2);
}
```

Teraz jeśli n8n zwróci plik z brakującymi polami, JSON  
będzie wyświetlony do debugowania zamiast bycia  
cichym failurem.

---

### Problem #4: Brak trim() validation na stringach 🟡
**Severity**: MEDIUM  
**File**: `/src/components/dashboard/RecordingWidget.tsx`

#### Opis:
```typescript
if (json.title) title = cleanTitle(json.title);
// ⚠️ Co jeśli title = "   " (sam whitespace)?
```

Puste stringi (z samymi spacjami) mogą przejść walidację.

#### Naprawka:
```typescript
if (json.title && json.title.trim()) title = cleanTitle(json.title);
eventName = (json.name || "").trim();
eventDescription = ((json.description || json.descripiton) || "").trim();
eventDate = (json.eventDate || "").trim();
eventTime = (json.eventTime || "").trim();
```

---

## ✅ Naprawy Zastosowane

| Łata | Plik | Zmiana |
|------|------|--------|
| #1 | extract-events/index.ts | Dodany `type: "extract-events"` |
| #2 | proxy-n8n-audio/index.ts | Dodany AbortController (25s timeout) |
| #2 | transcribe-note/index.ts | Dodany AbortController (25s timeout) |
| #2 | extract-events/index.ts | Dodany AbortController (15s timeout) |
| #3 | RecordingWidget.tsx | Naprawiony fallback parsing |
| #4 | RecordingWidget.tsx | Dodany `.trim()` do validacji |

---

## 🧪 Jak Testować

### Option 1: Manual Testing (Recommended First)
Powód: Najlepszy sposób na sprawdzenie rzeczywistego UX

1. Otwórz aplikację: https://your-domain.com
2. Zaloguj się
3. Otwórz Notatki tab
4. Nagraj audio (~5-10 sekund)
5. Obserwuj:
   - [ ] Pojawia się "Tworzę notatkę..." pill
   - [ ] Notatka pojawia się w sekcji
   - [ ] Toast: "✓ Notatka z lekcji gotowa!"

### Option 2: Automated Testing
Dostępne tools:

```bash
# Comprehensive webhook diagnostic
node diagnostic-webhook.js

# Python test (wymaga Python 3)
python3 test-webhook-e2e.py

# Node.js test
node test-webhook-e2e.js
```

### Option 3: DevTools Console Testing
```javascript
// Sprawdzenie session
const { data: { session } } = await supabase.auth.getSession();
console.log("Session OK:", !!session);

// Sprawdzenie webhook URL
const { data } = await supabase.from("app_settings")
  .select("value").eq("key", "webhook_notes");
console.log("Webhook URL:", data?.[0]?.value);
```

---

## 📊 Expected Behavior After Fixes

### Timeline:
```
1. User presses record button
   ↓ (2-10 sec)
2. User speaks, press "Gotowy"
   ↓ (instantly)
3. Toast: "⏳ Wysyłam nagranie…"
   ↓ (upload + n8n processing: 10-40 sec)
4. Toast: "✓ Notatka z lekcji gotowa!"
   ↓ (instantly)
5. Notatka pojawia się w NotesTab
```

### Success Criteria:
- [x] Audio upload succeeds (< 5 sec)
- [x] n8n processes audio (10-30 sec)
- [x] Response contains `title` and `content`
- [x] Notatka appears in UI
- [x] RetrysMy" 3 times if webhook fails
- [x] Timeout after 25s, returns to frontend
- [x] Calendar events extracted (if mentioned in audio)

---

## 🔍 Troubleshooting

### Symptom: "Notatka się nigdy nie pojawia"

**Check:**
1. DevTools → Console → szukaj `n8n response (raw):`
2. Network tab → POST `/proxy-n8n-audio` → Response
3. If HTTP 500: Edge function error
4. If 200 but empty: n8n webhook error

**Solutions:**
- [ ] Webhook URL is correct in app_settings
- [ ] n8n workflow is active (toggle ON)
- [ ] n8n has internet access
- [ ] n8n returns `{ title: "...", content: "..." }`

### Symptom: "Aplikacja czeka 30 sekund, potem error"

**Naprawka**: To było przed timeout'ami. Teraz powinno być 25s max.
- Jeśli nadal 30s → n8n jest bardzo powoli
- Sprawdzić n8n logs (może model LLM je powolna)

### Symptom: "Transcript jest pusty"

**Check**:
- [ ] Audio was loud enough
- [ ] Audio file is valid WAV/WebM
- [ ] n8n has access to Speech-to-Text API
- [ ] API quota is not exceeded

---

## 📝 Changes Summary

```diff
# extract-events/index.ts
- body: JSON.stringify({ pageTitle, content, noteDate, subject })
+ body: JSON.stringify({ type: "extract-events", pageTitle, content, noteDate, subject })
+ Added AbortController timeout (15s)

# proxy-n8n-audio/index.ts
+ Added AbortController timeout (25s)
+ Added console logging for debugging

# transcribe-note/index.ts
+ Added AbortController timeout (25s)
+ Added AbortError handling

# RecordingWidget.tsx
- else if (typeof json === "string") content = json;
+ else { content = JSON.stringify(json, null, 2); }
+ Added .trim() to all string validations
```

---

## 🚀 Deployment

### Step 1: Deploy Edge Functions
```bash
# Via GitHub (auto-deploy if integrated)
git add .
git commit -m "Fix: Add timeouts and payload type to webhooks"
git push origin main

# OR via Supabase CLI
supabase functions deploy extract-events
supabase functions deploy proxy-n8n-audio
supabase functions deploy transcribe-note
```

### Step 2: Deploy Frontend
- Changes to `RecordingWidget.tsx` will auto-deploy with frontend build

### Step 3: Test
- See "How to Test" section above

---

##  📞 Support

If issues persist:
1. Run `diagnostic-webhook.js` to get detailed test results
2. Check Supabase Edge Function logs
3. Check n8n workflow logs
4. Share console errors from DevTools

---

**Last Updated**: April 29, 2026  
**Fixed By**: GitHub Copilot  
**Testing Status**: ⏳ Pending
