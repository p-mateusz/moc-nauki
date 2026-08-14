// Google Analytics 4 (gtag.js)
export const GA_MEASUREMENT_ID = "G-ST12NKXTP7";

declare global {
  interface Window {
    dataLayer: unknown[];
  }
}

let initialized = false;

export const gtag = (...args: unknown[]) => {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
};

export const initAnalytics = () => {
  if (initialized || typeof window === "undefined") return;
  // Szanujemy decyzję użytkownika z banera cookies
  if (localStorage.getItem("cookieConsent") === "declined") return;

  initialized = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  gtag("js", new Date());
  gtag("config", GA_MEASUREMENT_ID, { send_page_view: true });
};

export const trackPageView = (path: string) => {
  if (!initialized) return;
  gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
};

export const trackEvent = (name: string, params?: Record<string, unknown>) => {
  if (!initialized) return;
  gtag("event", name, params ?? {});
};
