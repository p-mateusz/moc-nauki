#!/usr/bin/env node

/**
 * Test end-to-end webhooka notatek
 * Uruchom: node test-webhook-e2e.js
 * 
 * Testuje komunikację:
 * 1. Frontend wysyła audio
 * 2. proxy-n8n-audio konwertuje na base64
 * 3. Webhook n8n przetwarza
 * 4. Notatka jest zwracana
 */

const https = require("https");

// Kolory konsolii
const c = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(color, ...msg) {
  console.log(`${c[color]}${msg.join(" ")}${c.reset}`);
}

// ============ KONFIGURACJA ============
const SUPABASE_URL = "https://cyvzfdxwkjiguhjmrgdv.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5dnpmZHh3a2ppZ3Voam1yZ2R2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMzA1NTYsImV4cCI6MjA5MTgwNjU1Nn0.TxrnKDLMvqmB164hTLksChsuV4am_BxqyynE4zafMNI";

// ============ UTILITY FUNCTIONS ============

function makeRequest(url, options) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on("error", reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// Generowanie testowego audio (prosty WAV)
function generateTestAudio() {
  const sampleRate = 8000;
  const duration = 1;
  const frequency = 440;
  const samples = sampleRate * duration;

  // WAV header
  const header = Buffer.alloc(44);
  let offset = 0;
  header.write("RIFF", offset);
  offset += 4;
  header.writeUInt32LE(36 + samples, offset);
  offset += 4;
  header.write("WAVE", offset);
  offset += 4;
  header.write("fmt ", offset);
  offset += 4;
  header.writeUInt32LE(16, offset);
  offset += 4;
  header.writeUInt16LE(1, offset);
  offset += 2;
  header.writeUInt16LE(1, offset);
  offset += 2;
  header.writeUInt32LE(sampleRate, offset);
  offset += 4;
  header.writeUInt32LE(sampleRate * 1 * 1, offset);
  offset += 4;
  header.writeUInt16LE(1, offset);
  offset += 2;
  header.writeUInt16LE(8, offset);
  offset += 2;
  header.write("data", offset);
  offset += 4;
  header.writeUInt32LE(samples, offset);

  const audio = Buffer.alloc(samples);
  const amplitude = 127;
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const value = Math.sin((2 * Math.PI * frequency * t) * amplitude + 128);
    audio[i] = Math.max(0, Math.min(255, Math.floor(value)));
  }

  return Buffer.concat([header, audio]);
}

// ============ TESTY ============

async function test1_checkConfig() {
  log("blue", "\n📋 TEST 1: Sprawdzenie konfiguracji");
  log("green", "✓ Supabase URL:", SUPABASE_URL);
  log("green", "✓ Klucz publiczny załadowany");
  return true;
}

async function test2_queryAppSettings() {
  log("blue", "\n📋 TEST 2: Pobranie webhook URL z app_settings");

  try {
    const urlObj = new URL(`${SUPABASE_URL}/rest/v1/app_settings?key=eq.webhook_notes`);

    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    };

    log("cyan", `Wysyłam: GET ${urlObj.path}`);
    const res = await makeRequest(`${SUPABASE_URL}/rest/v1/app_settings?key=eq.webhook_notes`, options);

    log("cyan", `Status: ${res.statusCode}`);

    if (res.statusCode !== 200) {
      log("red", `❌ HTTP ${res.statusCode}`);
      log("yellow", `Odpowiedź: ${res.body.substring(0, 200)}`);
      return null;
    }

    const data = JSON.parse(res.body);
    if (data.length === 0) {
      log("red", "❌ Webhook URL nie jest skonfigurowany!");
      log("yellow", "\n⚠️  Aby to naprawić:");
      log("yellow", "1. Zaloguj się do aplikacji");
      log("yellow", "2. Otwórz Admin Panel");
      log("yellow", "3. Znajdź ustawienie 'webhook_notes'");
      log("yellow", "4. Wstaw URL Twojego webhooka n8n");
      return null;
    }

    const webhookUrl = data[0].value;
    log("green", "✓ Webhook URL znaleziony:");
    log("cyan", `  ${webhookUrl}`);
    return webhookUrl;
  } catch (err) {
    log("red", "❌ Błąd:", err.message);
    return null;
  }
}

async function test3_testWebhookDirect(webhookUrl) {
  log("blue", "\n📋 TEST 3: Testowanie webhooka n8n bezpośrednio");

  const audioBuffer = generateTestAudio();
  const base64Audio = audioBuffer.toString("base64");

  const payload = {
    audioBase64: base64Audio,
    duration: "0:01",
    type: "transcribe",
  };

  log("cyan", `Wysyłam do: ${webhookUrl}`);
  log("yellow", `Payload size: ${JSON.stringify(payload).length} bytes (audio: ${base64Audio.length} chars)`);

  try {
    const url = new URL(webhookUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    const response = await new Promise((resolve, reject) => {
      const req = https.request(
        webhookUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(JSON.stringify(payload)),
          },
          timeout: 120000,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            resolve({ status: res.statusCode, text: data });
          });
        }
      );

      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Żądanie timeout (2 min)"));
      });

      req.write(JSON.stringify(payload));
      req.end();
    });

    clearTimeout(timeout);

    log("cyan", `Status: ${response.status}`);
    log("yellow", `Response length: ${response.text.length} chars`);

    if (response.text.length > 500) {
      log("yellow", `Response (first 500 chars):\n${response.text.substring(0, 500)}...`);
    } else {
      log("yellow", `Response:\n${response.text}`);
    }

    if (response.status !== 200) {
      log("red", `❌ n8n zwrócił HTTP ${response.status}`);
      return null;
    }

    try {
      const json = JSON.parse(response.text);
      log("green", "✓ Odpowiedź JSON:");
      log("cyan", JSON.stringify(json, null, 2));

      // Walidacja
      const required = ["title", "content"];
      const missing = required.filter((k) => !(k in json));
      if (missing.length > 0) {
        log("yellow", `⚠️  Brakuje pól: ${missing.join(", ")}`);
      } else {
        log("green", "✓ Wszystkie wymagane pola obecne");
      }

      return json;
    } catch {
      log("yellow", "⚠️  Nie można parsować JSON - surowa odpowiedź zwrócona");
      return { raw: response.text };
    }
  } catch (err) {
    if (err.message === "Żądanie timeout (2 min)") {
      log("red", "❌ Timeout (120s)");
      log("yellow", "\nMożliwe przyczyny:");
      log("yellow", "- n8n nie jest uruchomiony");
      log("yellow", "- Webhook jest disabled w n8n");
      log("yellow", "- Webhook URL jest zły");
      log("yellow", "- n8n przetwarza bardzo długo");
    } else {
      log("red", "❌ Błąd sieci:", err.message);
    }
    return null;
  }
}

// ============ MAIN ============

async function main() {
  log("cyan", "═════════════════════════════════════════════════════");
  log("cyan", "🧪 TEST END-TO-END: Webhook notatek z n8n");
  log("cyan", "═════════════════════════════════════════════════════");

  await test1_checkConfig();

  const webhookUrl = await test2_queryAppSettings();
  if (!webhookUrl) {
    log("red", "\n❌ Konfiguracja webhook'a nie znaleziona");
    log("yellow", "Nie mogę kontynuować bez webhook URL");
    process.exit(1);
  }

  const result = await test3_testWebhookDirect(webhookUrl);

  log("cyan", "\n═════════════════════════════════════════════════════");

  if (result) {
    log("green", "\n✅ WEBHOOK DZIAŁA!");
    if (result.title && result.content) {
      log("green", "✓ Struktura odpowiedzi jest prawidłowa");
      log("green", "\nNotatka została wygenerowana prawidłowo.");
    }
  } else {
    log("red", "\n❌ WEBHOOK NIE DZIAŁA");
    log("yellow", "\nCzęste problemy i rozwiązania:");
    log("yellow", "");
    log("yellow", "1. WebHook URL w n8n jest invalid:");
    log("yellow", "   □ Sprawdź czy URL jest publicznie dostępny");
    log("yellow", "   □ Czy toggle webhooka jest ON?");
    log("yellow", "   □ Czy w n8n workflow jest ten webhook?");
    log("yellow", "");
    log("yellow", "2. n8n workflow ma błędy:");
    log("yellow", "   □ Otwórz n8n i sprawdź workflow");
    log("yellow", "   □ Czy są red X na węzłach?");
    log("yellow", "   □ W logach są błędy?");
    log("yellow", "");
    log("yellow", "3. Audio nie jest przetwarzane:");
    log("yellow", "   □ Czy n8n ma access do model LLM/API?");
    log("yellow", "   □ Czy quota w n8n nie jest wyczerpana?");
    log("yellow", "");
    log("yellow", "4. Timeout:");
    log("yellow", "   □ Czy n8n instance odpowiada ping <URL>/webhook/test?");
  }

  log("cyan", "═════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  log("red", "❌ Nieoczekiwany błąd:", err);
  process.exit(1);
});
