/**
 * End-to-end test dla webhook'a notatek z n8n
 * Testuje cały przepływ: audio → proxy-n8n-audio → webhook n8n → zwrot notatki
 */

import * as fs from "fs";
import * as path from "path";

// ============ KONFIGURACJA ============
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// ============ KOLORY DO KONSOLII ============
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(color: keyof typeof colors, ...msg: any[]) {
  console.log(`${colors[color]}${msg.join(" ")}${colors.reset}`);
}

// ============ TEST 1: Sprawdzenie konfiguracji ============
async function testConfig() {
  log("blue", "\n📋 TEST 1: Sprawdzenie konfiguracji");
  
  if (!SUPABASE_URL) {
    log("red", "❌ Brak VITE_SUPABASE_URL");
    return false;
  }
  if (!SUPABASE_KEY) {
    log("yellow", "⚠️  Brak VITE_SUPABASE_PUBLISHABLE_KEY");
  }
  
  log("green", "✓ Supabase URL:", SUPABASE_URL);
  return true;
}

// ============ TEST 2: Sprawdzenie webhook'a w app_settings ============
async function testWebhookConfig() {
  log("blue", "\n📋 TEST 2: Sprawdzenie konfiguracji webhooka w app_settings");

  if (!SUPABASE_SERVICE_ROLE) {
    log("yellow", "⚠️  Brak SUPABASE_SERVICE_ROLE_KEY - pomijaję!");
    return null;
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?key=eq.webhook_notes`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE}`,
        "apikey": SUPABASE_SERVICE_ROLE,
      },
    });

    if (!response.ok) {
      log("red", `❌ HTTP ${response.status} - nie mogę pobrać app_settings`);
      log("yellow", "Odpowiedź:", await response.text());
      return null;
    }

    const data = (await response.json()) as Array<{ key: string; value: string }>;
    if (data.length === 0) {
      log("red", "❌ Webhook URL nie jest skonfigurowany w app_settings!");
      return null;
    }

    const webhookUrl = data[0].value;
    log("green", "✓ Webhook URL znaleziony:");
    log("cyan", `  ${webhookUrl}`);
    return webhookUrl;
  } catch (err: any) {
    log("red", "❌ Błąd:", err.message);
    return null;
  }
}

// ============ TEST 3: Generowanie testowego audio WAV ============
function generateTestAudio(): Buffer {
  log("blue", "\n📋 TEST 3: Generowanie testowego audio WAV");

  // Prosty WAV header + sine wave tone (1s, 440Hz, 8-bit mono)
  const sampleRate = 8000;
  const duration = 1; // sekunda
  const frequency = 440; // Hz
  const samples = sampleRate * duration;

  // WAV header
  const header = Buffer.alloc(44);
  header.write("RIFF");
  header.writeUInt32LE(36 + samples, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // SubChunk1Size
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(1, 22); // NumChannels
  header.writeUInt32LE(sampleRate, 24); // SampleRate
  header.writeUInt32LE(sampleRate * 1 * 1, 28); // ByteRate
  header.writeUInt16LE(1, 32); // BlockAlign
  header.writeUInt16LE(8, 34); // BitsPerSample
  header.write("data", 36);
  header.writeUInt32LE(samples, 40); // SubChunk2Size

  // Audio data: prosty sinus
  const audio = Buffer.alloc(samples);
  const amplitude = 127;
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const value = Math.sin(2 * Math.PI * frequency * t) * amplitude + 128;
    audio[i] = Math.max(0, Math.min(255, Math.floor(value)));
  }

  log("green", `✓ Wygenerowano test audio: ${(header.length + audio.length) / 1024}KB`);
  return Buffer.concat([header, audio]);
}

// ============ TEST 4: Testowanie webhook'a bezpośrednio ============
async function testWebhookDirect(webhookUrl: string) {
  log("blue", "\n📋 TEST 4: Testowanie webhook'a n8n bezpośrednio");

  const audioBuffer = generateTestAudio();
  const base64Audio = audioBuffer.toString("base64");

  const payload = {
    audioBase64: base64Audio,
    duration: "0:01",
    type: "transcribe",
  };

  log("cyan", `Wysyłam do: ${webhookUrl}`);
  log("yellow", `Payload size: ${JSON.stringify(payload).length} bytes`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 2 min timeout

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal as any,
    });

    clearTimeout(timeout);

    log("cyan", `Status: ${response.status}`);

    const responseText = await response.text();
    log("yellow", `Response length: ${responseText.length} chars`);

    if (responseText.length > 500) {
      log("yellow", `Response (first 500 chars): ${responseText.substring(0, 500)}...`);
    } else {
      log("yellow", `Response:\n${responseText}`);
    }

    if (!response.ok) {
      log("red", `❌ n8n zwrócił błąd HTTP ${response.status}`);
      return null;
    }

    try {
      const json = JSON.parse(responseText);
      log("green", "✓ Odpowiedź JSON:");
      log("cyan", JSON.stringify(json, null, 2));

      // Walidacja struktury odpowiedzi
      const required = ["title", "content"];
      const missing = required.filter((k) => !(k in json));
      if (missing.length > 0) {
        log("yellow", `⚠️  Brakuje pól: ${missing.join(", ")}`);
      }

      return json;
    } catch {
      log("yellow", "⚠️  Nie można parsować JSON, ale odpowiedź jest zwrócona");
      return { raw: responseText };
    }
  } catch (err: any) {
    if (err.name === "AbortError") {
      log("red", "❌ Żądanie timeout (2 min) - n8n lub webhook nie odpowiada");
      log("yellow", "Możliwe przyczyny:");
      log("yellow", "- n8n nie jest uruchomiony");
      log("yellow", "- Webhook URL jest zły");
      log("yellow", "- Przełącznik (toggle) w n8n jest wyłączony");
      return null;
    }
    log("red", "❌ Błąd sieci:", err.message);
    return null;
  }
}

// ============ TEST 5: Symulacja proxy-n8n-audio ============
async function testProxyLogic(webhookUrl: string) {
  log("blue", "\n📋 TEST 5: Sprawdzenie logiki konwersji audio (symulacja proxy)");

  const testBlob = generateTestAudio();
  log("cyan", `Audio size: ${testBlob.length} bytes`);

  // Konwersja Base64 (jak w proxy-n8n-audio)
  const base64_1 = testBlob.toString("base64");
  log("green", `✓ Base64 conversion OK: ${base64_1.length} chars`);

  // Dekodowanie i sprawdzenie
  try {
    const decoded = Buffer.from(base64_1, "base64");
    if (decoded.toString() === testBlob.toString()) {
      log("green", "✓ Base64 kodowanie/dekodowanie OK");
    }
  } catch (err: any) {
    log("red", "❌ Base64 konwersja nie powiodła się:", err.message);
  }

  return true;
}

// ============ TEST 6: Pełny E2E test (jeśli ma klucz) ============
async function testFullE2E(webhookUrl: string) {
  log("blue", "\n📋 TEST 6: Pełny E2E test (jeśli auth dostępna)");

  if (!SUPABASE_KEY || !SUPABASE_URL) {
    log("yellow", "⚠️  Brak VITE_SUPABASE_PUBLISHABLE_KEY, pomijaję E2E");
    return;
  }

  log("yellow", "Uwaga: Do pełnego E2E potrzebny jest access token z sesji");
  log("yellow", "Można to przetestować bezpośrednio z application (DevTools)");
}

// ============ MAIN ============
async function main() {
  log("cyan", "═════════════════════════════════════════════════════");
  log("cyan", "🧪 TEST END-TO-END: Webhook notatek z n8n");
  log("cyan", "═════════════════════════════════════════════════════");

  const configOk = await testConfig();
  if (!configOk) {
    log("red", "\n❌ Konfiguracja nieprawidłowa!");
    return;
  }

  const webhookUrl = await testWebhookConfig();
  if (!webhookUrl) {
    log("red", "\n❌ Webhook nie skonfigurowany!");
    log("yellow", "\nAby skonfigurować:");
    log("yellow", "1. Zaloguj się do aplikacji");
    log("yellow", "2. Otwórz Admin Panel");
    log("yellow", "3. Ustaw 'webhook_notes' na URL Twojego webhooka n8n");
    log("yellow", "4. Spróbuj ponownie");
    return;
  }

  await testProxyLogic(webhookUrl);
  const n8nResult = await testWebhookDirect(webhookUrl);

  if (n8nResult) {
    log("green", "\n✓ Webhook działa!");
    if (n8nResult.title && n8nResult.content) {
      log("green", "✓ Struktura odpowiedzi jest prawidłowa");
    }
  } else {
    log("red", "\n❌ Webhook nie działa prawidłowo");
    log("yellow", "\nSprawdzenia:");
    log("yellow", "□ Czy webhook URL w app_settings jest prawidłowy?");
    log("yellow", "□ Czy n8n instance jest online?");
    log("yellow", "□ Czy toggle webhooka w n8n jest włączony?");
    log("yellow", "□ Czy n8n ma dostęp do internetu?");
    log("yellow", "□ W logach n8n są błędy?");
  }

  log("cyan", "\n═════════════════════════════════════════════════════\n");
}

main().catch(console.error);
