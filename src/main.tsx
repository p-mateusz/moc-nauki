import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const setupViewportHeight = () => {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
};

const setupStandaloneKeyboardFix = () => {
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  if (!isStandalone) return;

  let scrollY = 0;

  document.addEventListener("focusin", (event) => {
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
      scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
    }
  }, true);

  document.addEventListener("focusout", () => {
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
    window.scrollTo(0, scrollY);
  });
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
  setupViewportHeight();
  window.addEventListener("resize", setupViewportHeight);
  window.addEventListener("orientationchange", () => {
    window.setTimeout(setupViewportHeight, 100);
  });
  setupStandaloneKeyboardFix();

  createRoot(rootElement).render(<App />);

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
