#!/usr/bin/env python3
"""
Test end-to-end webhooka notatek z n8n
Uruchom: python3 test-webhook-e2e.py
"""

import requests
import json
import base64
import struct
import math
from typing import Optional

# Kolory
class Colors:
    RESET = "\033[0m"
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"

def log(color, *msg):
    """Print kolorowana wiadomość"""
    color_code = getattr(Colors, color.upper(), Colors.RESET)
    print(f"{color_code}{' '.join(str(m) for m in msg)}{Colors.RESET}")

# ============ KONFIGURACJA ============
SUPABASE_URL = "https://cyvzfdxwkjiguhjmrgdv.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5dnpmZHh3a2ppZ3Voam1yZ2R2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMzA1NTYsImV4cCI6MjA5MTgwNjU1Nn0.TxrnKDLMvqmB164hTLksChsuV4am_BxqyynE4zafMNI"

# ============ UTILITY FUNCTIONS ============

def generate_test_audio() -> bytes:
    """Generowanie testowego pliku audio WAV (1s, 440Hz sine wave)"""
    sample_rate = 8000
    duration = 1  # sekunda
    frequency = 440  # Hz
    samples = sample_rate * duration
    amplitude = 127

    # WAV header (44 bytes)
    wav_header = bytearray(44)
    wav_header[0:4] = b"RIFF"
    wav_header[4:8] = struct.pack("<I", 36 + samples)
    wav_header[8:12] = b"WAVE"
    wav_header[12:16] = b"fmt "
    wav_header[16:20] = struct.pack("<I", 16)  # SubChunk1Size
    wav_header[20:22] = struct.pack("<H", 1)  # AudioFormat (PCM)
    wav_header[22:24] = struct.pack("<H", 1)  # NumChannels
    wav_header[24:28] = struct.pack("<I", sample_rate)  # SampleRate
    wav_header[28:32] = struct.pack("<I", sample_rate * 1 * 1)  # ByteRate
    wav_header[32:34] = struct.pack("<H", 1)  # BlockAlign
    wav_header[34:36] = struct.pack("<H", 8)  # BitsPerSample
    wav_header[36:40] = b"data"
    wav_header[40:44] = struct.pack("<I", samples)

    # Audio data
    audio_data = bytearray(samples)
    for i in range(samples):
        t = i / sample_rate
        value = math.sin(2 * math.pi * frequency * t) * amplitude + 128
        audio_data[i] = max(0, min(255, int(value)))

    return bytes(wav_header) + bytes(audio_data)

# ============ TESTY ============

def test1_check_config():
    log("blue", "\n📋 TEST 1: Sprawdzenie konfiguracji")
    log("green", "✓ Supabase URL:", SUPABASE_URL)
    log("green", "✓ Klucz publiczny załadowany")
    return True

def test2_query_app_settings() -> Optional[str]:
    log("blue", "\n📋 TEST 2: Pobranie webhook URL z app_settings")

    try:
        url = f"{SUPABASE_URL}/rest/v1/app_settings?key=eq.webhook_notes"
        headers = {
            "Content-Type": "application/json",
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
        }

        log("cyan", f"Wysyłam: GET {url}")
        response = requests.get(url, headers=headers, timeout=10)

        log("cyan", f"Status: {response.status_code}")

        if response.status_code != 200:
            log("red", f"❌ HTTP {response.status_code}")
            log("yellow", f"Odpowiedź: {response.text[:200]}")
            return None

        data = response.json()
        if len(data) == 0:
            log("red", "❌ Webhook URL nie jest skonfigurowany!")
            log("yellow", "\n⚠️  Aby to naprawić:")
            log("yellow", "1. Zaloguj się do aplikacji")
            log("yellow", "2. Otwórz Admin Panel")
            log("yellow", "3. Znajdź ustawienie 'webhook_notes'")
            log("yellow", "4. Wstaw URL Twojego webhooka n8n")
            return None

        webhook_url = data[0]["value"]
        log("green", "✓ Webhook URL znaleziony:")
        log("cyan", f"  {webhook_url}")
        return webhook_url

    except requests.exceptions.RequestException as err:
        log("red", f"❌ Błąd sieci: {err}")
        return None
    except json.JSONDecodeError as err:
        log("red", f"❌ Błąd JSON: {err}")
        return None

def test3_test_webhook_direct(webhook_url: str) -> Optional[dict]:
    log("blue", "\n📋 TEST 3: Testowanie webhooka n8n bezpośrednio")

    audio_buffer = generate_test_audio()
    base64_audio = base64.b64encode(audio_buffer).decode("utf-8")

    payload = {
        "audioBase64": base64_audio,
        "duration": "0:01",
        "type": "transcribe",
    }

    log("cyan", f"Wysyłam do: {webhook_url}")
    log("yellow", f"Payload size: {len(json.dumps(payload))} bytes (audio: {len(base64_audio)} chars)")

    try:
        response = requests.post(
            webhook_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=120,
        )

        log("cyan", f"Status: {response.status_code}")
        log("yellow", f"Response length: {len(response.text)} chars")

        if len(response.text) > 500:
            log("yellow", f"Response (first 500 chars):\n{response.text[:500]}...")
        else:
            log("yellow", f"Response:\n{response.text}")

        if response.status_code != 200:
            log("red", f"❌ n8n zwrócił HTTP {response.status_code}")
            return None

        try:
            json_data = response.json()
            log("green", "✓ Odpowiedź JSON:")
            log("cyan", json.dumps(json_data, indent=2, ensure_ascii=False))

            # Walidacja
            required = ["title", "content"]
            missing = [k for k in required if k not in json_data]
            if missing:
                log("yellow", f"⚠️  Brakuje pól: {', '.join(missing)}")
            else:
                log("green", "✓ Wszystkie wymagane pola obecne")

            return json_data

        except json.JSONDecodeError:
            log("yellow", "⚠️  Nie można parsować JSON - surowa odpowiedź zwrócona")
            return {"raw": response.text}

    except requests.exceptions.Timeout:
        log("red", "❌ Timeout (120s)")
        log("yellow", "\nMożliwe przyczyny:")
        log("yellow", "- n8n nie jest uruchomiony")
        log("yellow", "- Webhook jest disabled w n8n")
        log("yellow", "- Webhook URL jest zły")
        log("yellow", "- n8n przetwarza bardzo długo")
        return None

    except requests.exceptions.RequestException as err:
        log("red", f"❌ Błąd sieci: {err}")
        return None

def test4_detailed_diagnostics(webhook_url: str) -> Optional[dict]:
    """Szczegółowe diagnostyka"""
    log("blue", "\n📋 TEST 4: Diagnostyka szczegółowa")

    # Test 1: Czy webhook ping działa?
    log("cyan", "Testowanie ping...")
    try:
        response = requests.get(webhook_url, timeout=5)
        log("green", f"✓ Webhook jest dostępny (status: {response.status_code})")
    except requests.exceptions.Timeout:
        log("red", "❌ Webhook nie odpowiada na ping")
        return None
    except requests.exceptions.RequestException as err:
        log("red", f"❌ Błąd sieci: {err}")
        return None

    # Test 2: Pusty payload
    log("cyan", "Testowanie pustego payload...")
    try:
        response = requests.post(
            webhook_url,
            json={},
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        log("yellow", f"  Status: {response.status_code}")
        if response.status_code != 200:
            log("yellow", f"  Response: {response.text[:200]}")
    except Exception as err:
        log("yellow", f"  Błąd: {err}")

    # Test 3: Payload bez audio
    log("cyan", "Testowanie payload bez audio...")
    try:
        response = requests.post(
            webhook_url,
            json={"duration": "0:01", "type": "transcribe"},
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        log("yellow", f"  Status: {response.status_code}")
    except Exception as err:
        log("yellow", f"  Błąd: {err}")

    return None

# ============ MAIN ============

def main():
    log("cyan", "═════════════════════════════════════════════════════")
    log("cyan", "🧪 TEST END-TO-END: Webhook notatek z n8n")
    log("cyan", "═════════════════════════════════════════════════════")

    test1_check_config()

    webhook_url = test2_query_app_settings()
    if not webhook_url:
        log("red", "\n❌ Konfiguracja webhook'a nie znaleziona")
        log("yellow", "Nie mogę kontynuować bez webhook URL")
        return

    test4_detailed_diagnostics(webhook_url)
    result = test3_test_webhook_direct(webhook_url)

    log("cyan", "\n═════════════════════════════════════════════════════")

    if result:
        log("green", "\n✅ WEBHOOK DZIAŁA!")
        if result.get("title") and result.get("content"):
            log("green", "✓ Struktura odpowiedzi jest prawidłowa")
            log("green", "\nNotatka została wygenerowana prawidłowo.")
    else:
        log("red", "\n❌ WEBHOOK NIE DZIAŁA")
        log("yellow", "\nCzęste problemy i rozwiązania:")
        log("yellow", "")
        log("yellow", "1. WebHook URL w n8n jest invalid:")
        log("yellow", "   □ Sprawdź czy URL jest publicznie dostępny")
        log("yellow", "   □ Czy toggle webhooka jest ON?")
        log("yellow", "   □ Czy w n8n workflow jest ten webhook?")
        log("yellow", "")
        log("yellow", "2. n8n workflow ma błędy:")
        log("yellow", "   □ Otwórz n8n i sprawdź workflow")
        log("yellow", "   □ Czy są red X na węzłach?")
        log("yellow", "   □ W logach są błędy?")
        log("yellow", "")
        log("yellow", "3. Audio nie jest przetwarzane:")
        log("yellow", "   □ Czy n8n ma access do model LLM/API?")
        log("yellow", "   □ Czy quota w n8n nie jest wyczerpana?")
        log("yellow", "")
        log("yellow", "4. Timeout:")
        log("yellow", "   □ Czy n8n instance odpowiada ping?")

    log("cyan", "═════════════════════════════════════════════════════\n")

if __name__ == "__main__":
    main()
