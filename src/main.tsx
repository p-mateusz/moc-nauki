import React from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

const setupSafeLocalStorage = () => {
  try {
    if (window.localStorage) {
      const testKey = "__mn_storage_test__";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return;
    }
  } catch {}

  const memory = new Map<string, string>();
  const fallbackStorage: Storage = {
    get length() { return memory.size; },
    clear: () => memory.clear(),
    getItem: (key: string) => memory.get(key) ?? null,
    key: (index: number) => Array.from(memory.keys())[index] ?? null,
    removeItem: (key: string) => { memory.delete(key); },
    setItem: (key: string, value: string) => { memory.set(key, String(value)); },
  };

  Object.defineProperty(window, "localStorage", {
    value: fallbackStorage,
    configurable: true,
  });
};

const setupViewportHeight = () => {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
};

const setupStandaloneKeyboardFix = () => {
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  if (!isStandalone) return;

  let scrollY = 0;
  let locked = false;

  const lockBody = () => {
    if (locked) return;
    scrollY = window.scrollY;
    locked = true;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  };

  const unlockBody = () => {
    if (!locked) return;
    locked = false;
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    window.scrollTo(0, scrollY);
    // Nudge layout so the residual "black bar" left by the keyboard collapses
    window.dispatchEvent(new Event("resize"));
    setupViewportHeight();
  };

  document.addEventListener("focusin", (event) => {
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
      lockBody();
    }
  }, true);

  document.addEventListener("focusout", () => {
    // Defer so a focus that moves between fields doesn't unlock prematurely
    setTimeout(() => {
      const a = document.activeElement as HTMLElement | null;
      if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable)) return;
      unlockBody();
    }, 60);
  });

  // When the visual viewport returns to (almost) full height the keyboard has
  // closed — force-unlock in case focusout never fired (iOS edge case).
  if ("visualViewport" in window && window.visualViewport) {
    const vv = window.visualViewport;
    const checkKeyboardClosed = () => {
      if (vv.height >= window.innerHeight - 80) unlockBody();
    };
    vv.addEventListener("resize", checkKeyboardClosed);
    vv.addEventListener("scroll", checkKeyboardClosed);
  }
};

const shouldRegisterServiceWorker = () => false;

const clearServiceWorkerState = async () => {
  if (!("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ("caches" in window) {
    const cacheKeys = await window.caches.keys();
    await Promise.all(
      cacheKeys
        .filter((key) => key.startsWith("moc-nauki-"))
        .map((key) => window.caches.delete(key)),
    );
  }
};

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

if (typeof window !== "undefined") {
  setupSafeLocalStorage();
  setupViewportHeight();
  window.addEventListener("resize", setupViewportHeight);
  window.addEventListener("orientationchange", () => {
    window.setTimeout(setupViewportHeight, 100);
  });
  setupStandaloneKeyboardFix();

  createRoot(rootElement).render(
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );

  window.addEventListener("load", () => {
    if (!("serviceWorker" in navigator)) return;

    if (shouldRegisterServiceWorker()) {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.log("Service Worker registration failed:", error);
      });
      return;
    }

    void clearServiceWorkerState();
  });
}
