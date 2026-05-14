#!/usr/bin/env node
/**
 * 🔍 Comprehensive Webhook Diagnostics & Testing
 * 
 * Testuje:
 * 1. Konfiguracja webhook URL w app_settings
 * 2. Dostępność webhooka
 * 3. Timeout'y
 * 4. Struktura payload'ów
 * 5. Response format z n8n
 * 
 * Uruchom: node diagnostic-webhook.js
 */

const https = require("https");

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[91m",
  green: "\x1b[92m",
  yellow: "\x1b[93m",
  blue: "\x1b[94m",
  cyan: "\x1b[96m",
  dim: "\x1b[2m",
};

// ============ LOGGER ============
const log = {
  info: (...msg) => console.log(`${COLORS.cyan}ℹ ${msg.join(" ")}${COLORS.reset}`),
  ok: (...msg) => console.log(`${COLORS.green}✓ ${msg.join(" ")}${COLORS.reset}`),
  warn: (...msg) => console.log(`${COLORS.yellow}⚠ ${msg.join(" ")}${COLORS.reset}`),
  error: (...msg) => console.log(`${COLORS.red}✗ ${msg.join(" ")}${COLORS.reset}`),
  debug: (...msg) => console.log(`${COLORS.dim}→ ${msg.join(" ")}${COLORS.reset}`),
  section: (title) => console.log(`\n${COLORS.blue}━━━ ${title} ━━━${COLORS.reset}\n`),
};

// ============ CONSTANTS ============
const SUPABASE_URL = "https://cyvzfdxwkjiguhjmrgdv.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5dnpmZHh3a2ppZ3Voam1yZ2R2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMzA1NTYsImV4cCI6MjA5MTgwNjU1Nn0.TxrnKDLMvqmB164hTLksChsuV4am_BxqyynE4zafMNI";

// ============ UTILS ============

function makeRequest(url, options) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, text: data, headers: res.headers }));
    });
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ============ TESTS ============

async function test_webhook_config() {
  log.section("TEST 1: Webhook Configuration in app_settings");

  try {
    const options = {
      hostname: "cyvzfdxwkjiguhjmrgdv.supabase.co",
      path: "/rest/v1/app_settings?key=eq.webhook_notes",
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    };

    const res = await makeRequest(SUPABASE_URL + "/rest/v1/app_settings?key=eq.webhook_notes", options);

    if (res.status !== 200) {
      log.error(`HTTP ${res.status} when querying app_settings`);
      log.debug(res.text.substring(0, 200));
      return null;
    }

    const data = JSON.parse(res.text);
    if (data.length === 0) {
      log.error("webhook_notes is NOT configured in app_settings");
      log.warn("You need to set it in the Admin Panel");
      return null;
    }

    const webhookUrl = data[0].value;
    log.ok("Webhook URL found:");
    log.info(webhookUrl);
    return webhookUrl;
  } catch (err) {
    log.error("Failed to query app_settings:", err.message);
    return null;
  }
}

async function test_webhook_ping(webhookUrl) {
  log.section("TEST 2: Webhook Availability (Ping)");

  try {
    log.debug("Sending GET request to webhook...");
    const url = new URL(webhookUrl);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "GET",
      timeout: 5000,
    };

    const res = await makeRequest(webhookUrl, options);
    log.ok(`Webhook is reachable (HTTP ${res.status})`);
    return true;
  } catch (err) {
    log.error("Webhook is not reachable:", err.message);
    log.warn("Possible causes:");
    log.warn("  • Webhook URL is incorrect");
    log.warn("  • n8n instance is offline");
    log.warn("  • Webhook is disabled in n8n");
    return false;
  }
}

async function test_transcribe_payload(webhookUrl) {
  log.section("TEST 3: Transcribe Payload (Audio Processing)");

  try {
    const payload = {
      audioBase64: generateFakeBase64Audio(),
      duration: "0:01",
      type: "transcribe",
    };

    log.debug(`Payload size: ${JSON.stringify(payload).length} bytes (audio: ${payload.audioBase64.length} chars)`);
    log.debug("Sending payload to webhook...");

    const url = new URL(webhookUrl);
    const bodyStr = JSON.stringify(payload);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyStr),
      },
      timeout: 30000, // 30s timeout
    };

    const res = await makeRequest(webhookUrl, options);

    if (res.status !== 200) {
      log.error(`HTTP ${res.status} response`);
      log.debug(res.text.substring(0, 300));
      return null;
    }

    try {
      const json = JSON.parse(res.text);
      log.ok("Response is valid JSON");

      const requiredFields = ["title", "content"];
      const missing = requiredFields.filter((f) => !(f in json));

      if (missing.length > 0) {
        log.warn(`Missing fields: ${missing.join(", ")}`);
      } else {
        log.ok("All required fields present");
      }

      log.info("Response structure:");
      log.debug(JSON.stringify(json, null, 2).substring(0, 500));

      return json;
    } catch {
      log.warn("Response is not JSON (plain text)");
      log.debug(res.text.substring(0, 200));
      return null;
    }
  } catch (err) {
    if (err.code === "ETIMEDOUT") {
      log.error("REQUEST TIMEOUT (30s) - n8n is taking too long to process audio");
      log.warn("This usually means:");
      log.warn("  • n8n workflow is very complex");
      log.warn("  • Audio processing service is slow");
      log.warn("  • Network latency is high");
    } else {
      log.error("Request failed:", err.message);
    }
    return null;
  }
}

async function test_extract_events_payload(webhookUrl) {
  log.section("TEST 4: Extract Events Payload (Text Processing)");

  try {
    const payload = {
      type: "extract-events",
      pageTitle: "Testy z dzisiaj",
      content: "Jutro mamy test z matematyki o 9:00. Także egzamin z angielskiego w piątek.",
      noteDate: "2026-04-29",
      subject: "Szkoła",
    };

    log.debug(`Payload size: ${JSON.stringify(payload).length} bytes`);
    log.debug("Sending payload to webhook...");

    const url = new URL(webhookUrl);
    const bodyStr = JSON.stringify(payload);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyStr),
      },
      timeout: 15000, // 15s timeout
    };

    const res = await makeRequest(webhookUrl, options);

    if (res.status !== 200) {
      log.error(`HTTP ${res.status} response`);
      return null;
    }

    try {
      const json = JSON.parse(res.text);
      log.ok("Response is valid JSON");

      if (json.events && Array.isArray(json.events)) {
        log.ok(`Extracted ${json.events.length} event(s)`);
        log.info("Event structure:");
        log.debug(JSON.stringify(json.events[0], null, 2).substring(0, 500));
      } else {
        log.warn("Response doesn't have 'events' array");
      }

      return json;
    } catch {
      log.warn("Response is not JSON (plain text)");
      return null;
    }
  } catch (err) {
    if (err.code === "ETIMEDOUT") {
      log.error("REQUEST TIMEOUT (15s) - n8n is taking too long");
    } else {
      log.error("Request failed:", err.message);
    }
    return null;
  }
}

async function test_response_validation() {
  log.section("TEST 5: Response Validation Rules");

  log.info("Frontend validation requires:");
  log.info("  1. title field (non-empty string)");
  log.info("  2. content OR html field (non-empty, can contain HTML)");
  log.info("  3. Optional: name, description, eventDate, eventTime (for calendar)");

  log.info("\nCurrent parsing logic (from RecordingWidget.tsx):");
  log.debug("- Tries to parse JSON");
  log.debug("- Falls back to plain text if JSON parse fails");
  log.debug("- Validates content has text after stripping HTML tags");
  log.debug("- Retries 3 times with 2s, 4s, 6s delays on failure");

  return true;
}

function generateFakeBase64Audio() {
  // Simple WAV header + data
  const sampleRate = 8000;
  const duration = 1;
  const samples = sampleRate * duration;

  const header = Buffer.alloc(44);
  header.write("RIFF");
  header.writeUInt32LE(36 + samples, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write("data", 36);
  header.writeUInt32LE(samples, 40);

  const audio = Buffer.alloc(samples);
  for (let i = 0; i < samples; i++) {
    audio[i] = Math.floor(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 127 + 128);
  }

  return Buffer.concat([header, audio]).toString("base64");
}

// ============ MAIN ============

async function main() {
  console.log(`
${COLORS.blue}╔════════════════════════════════════════════════════════╗${COLORS.reset}
${COLORS.blue}║  🔍 COMPREHENSIVE WEBHOOK DIAGNOSTICS                   ║${COLORS.reset}
${COLORS.blue}║     Moc Nauki - Notatki z Webhooka (n8n)               ║${COLORS.reset}
${COLORS.blue}╚════════════════════════════════════════════════════════╝${COLORS.reset}
  `);

  const webhookUrl = await test_webhook_config();
  if (!webhookUrl) {
    log.error("Cannot proceed without webhook URL");
    process.exit(1);
  }

  const isReachable = await test_webhook_ping(webhookUrl);
  if (!isReachable) {
    log.warn("Webhook is not reachable - skipping payload tests");
  } else {
    log.info("Webhook is reachable - running payload tests...\n");
    await sleep(500);

    const transcribeResult = await test_transcribe_payload(webhookUrl);
    await sleep(500);

    const extractResult = await test_extract_events_payload(webhookUrl);
    await sleep(500);

    await test_response_validation();

    // Summary
    log.section("SUMMARY");
    if (transcribeResult && extractResult) {
      log.ok("All tests passed! Webhook is working correctly.");
    } else if (transcribeResult || extractResult) {
      log.warn("Some tests failed - check output above");
    } else {
      log.error("Webhook tests failed");
    }
  }

  console.log(`\n${COLORS.dim}Diagnostic report complete${COLORS.reset}\n`);
}

main().catch((err) => {
  log.error("Unexpected error:", err);
  process.exit(1);
});
