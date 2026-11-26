/**
 * NOVA Analytics – Tracking-Skript
 *
 * Einbindung:
 *   <script defer src="https://<nova-domain>/tracker.js" data-site-id="ns_…"></script>
 *
 * Optionale Attribute:
 *   data-auto="forms,scroll"   zusätzliche automatische Erfassung (Standard: Seitenaufrufe,
 *                              Outbound-Links, Downloads, Telefon-/E-Mail-Klicks)
 *   data-consent="wait"        nichts senden, bis novaAnalytics.consent("granted") aufgerufen wird
 *   data-api="https://…"       eigener Endpunkt (z. B. Proxy gegen Adblocker)
 *
 * Datenschutz: keine Cookies, kein localStorage (außer einem freiwilligen Opt-out),
 * keine Formularinhalte, keine vollständigen Query-Strings.
 */
export {};

type Props = Record<string, string | number | boolean>;
type Queued = [string, ...unknown[]];

interface NovaApi {
  q?: Queued[];
  track: (name: string, props?: Props) => void;
  consent: (decision: "granted" | "denied") => void;
  optOut: () => void;
  optIn: () => void;
}

declare global {
  interface Window {
    novaAnalytics?: Partial<NovaApi> & { q?: Queued[] };
  }
  interface Navigator {
    globalPrivacyControl?: boolean;
  }
}

((w: Window, d: Document) => {
  const script = d.currentScript as HTMLScriptElement | null;
  const siteId = script?.getAttribute("data-site-id");
  if (!script || !siteId) return;

  const endpoint = script.getAttribute("data-api") || new URL(script.src).origin + "/api/e";
  const auto = (script.getAttribute("data-auto") || "").split(",").map((part) => part.trim());
  const OPT_OUT_KEY = "nova_analytics_optout";
  let consentGiven = script.getAttribute("data-consent") !== "wait";
  // Nur eine ausdrücklich erteilte Einwilligung wird als solche übermittelt.
  let explicitConsent = false;
  const consentPending: object[] = [];

  const optedOut = (): boolean => {
    try {
      return w.localStorage.getItem(OPT_OUT_KEY) === "1";
    } catch {
      return false;
    }
  };
  const disabled =
    w.navigator.globalPrivacyControl === true ||
    w.navigator.doNotTrack === "1" ||
    /^(localhost|127\.|\[::1\])/.test(w.location.hostname) ||
    w.location.protocol === "file:";

  const send = (data: object) => {
    if (disabled || optedOut()) return;
    if (!consentGiven) {
      if (consentPending.length < 20) consentPending.push(data);
      return;
    }
    const body = JSON.stringify({ s: siteId, u: w.location.href, w: w.innerWidth, c: explicitConsent || undefined, ...data });
    try {
      if (w.navigator.sendBeacon && w.navigator.sendBeacon(endpoint, new Blob([body], { type: "text/plain" }))) return;
    } catch {
      /* auf fetch ausweichen */
    }
    fetch(endpoint, { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => {});
  };

  // Aktive Zeit: Tab sichtbar und Interaktion in den letzten 30 Sekunden
  let activeMs = 0;
  let lastTick = Date.now();
  let lastInteraction = Date.now();
  let maxScroll = 0;
  const tick = () => {
    const now = Date.now();
    if (d.visibilityState === "visible" && now - lastInteraction < 30_000) activeMs += now - lastTick;
    lastTick = now;
  };
  const interact = () => {
    tick();
    lastInteraction = Date.now();
  };
  ["mousemove", "keydown", "scroll", "touchstart", "click"].forEach((type) =>
    w.addEventListener(type, interact, { passive: true, capture: true }),
  );
  w.setInterval(tick, 5000);

  const flushEngagement = () => {
    tick();
    if (auto.includes("scroll") && maxScroll > 0) send({ t: "scroll", d: maxScroll });
    if (activeMs >= 1000) send({ t: "engagement", e: Math.round(activeMs) });
    activeMs = 0;
    maxScroll = 0;
  };

  // Seitenaufrufe inkl. Single-Page-Apps
  let lastPath = "";
  let referrer: string | undefined = d.referrer || undefined;
  const pageview = () => {
    const path = w.location.pathname + w.location.search;
    if (path === lastPath) return;
    if (lastPath) flushEngagement();
    lastPath = path;
    send({ t: "pageview", r: referrer });
    referrer = undefined; // Referrer nur beim Einstieg
  };
  const history = w.history;
  (["pushState", "replaceState"] as const).forEach((method) => {
    const original = history[method];
    history[method] = function (...args: Parameters<History["pushState"]>) {
      original.apply(this, args);
      w.setTimeout(pageview, 0);
    };
  });
  w.addEventListener("popstate", pageview);

  d.addEventListener("visibilitychange", () => {
    if (d.visibilityState === "hidden") flushEngagement();
    else lastTick = Date.now();
  });
  w.addEventListener("pagehide", flushEngagement);

  // Klicks: Outbound, Downloads, Telefon, E-Mail (nie die Nummer oder Adresse selbst)
  const DOWNLOAD = /\.(pdf|zip|docx?|xlsx?|pptx?|csv|txt|rtf|odt|ods|mp3|mp4|mov|dmg|exe|msi|apk)$/i;
  d.addEventListener(
    "click",
    (event) => {
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute("href") || "";
      if (/^tel:/i.test(href)) return send({ t: "phone_click" });
      if (/^mailto:/i.test(href)) return send({ t: "email_click" });
      let url: URL;
      try {
        url = new URL(link.href);
      } catch {
        return;
      }
      if (DOWNLOAD.test(url.pathname)) {
        return send({ t: "download", p: { file_type: url.pathname.split(".").pop()!.toLowerCase(), host: url.hostname } });
      }
      if (/^https?:$/.test(url.protocol) && url.hostname !== w.location.hostname) {
        send({ t: "outbound_click", p: { host: url.hostname } });
      }
    },
    { capture: true },
  );

  if (auto.includes("forms")) {
    d.addEventListener(
      "submit",
      (event) => {
        const form = event.target as HTMLFormElement;
        const name = form.getAttribute("data-nova-form") || form.id || form.getAttribute("name") || "formular";
        send({ t: "form_submit", p: { form: name.slice(0, 80) } });
      },
      { capture: true },
    );
  }
  if (auto.includes("scroll")) {
    w.addEventListener(
      "scroll",
      () => {
        const doc = d.documentElement;
        const total = doc.scrollHeight - w.innerHeight;
        const depth = total > 0 ? Math.min(100, Math.round(((w.scrollY || doc.scrollTop) / total) * 100)) : 100;
        maxScroll = Math.max(maxScroll, Math.floor(depth / 25) * 25);
      },
      { passive: true },
    );
  }

  // Öffentliche API
  const api: NovaApi = {
    track: (name, props) => {
      if (typeof name === "string" && name) send({ t: "custom", n: name.slice(0, 80), p: props });
    },
    consent: (decision) => {
      consentGiven = explicitConsent = decision === "granted";
      if (consentGiven) consentPending.splice(0).forEach(send);
      else consentPending.length = 0;
    },
    optOut: () => {
      try {
        w.localStorage.setItem(OPT_OUT_KEY, "1");
      } catch {
        /* Speicher nicht verfügbar */
      }
    },
    optIn: () => {
      try {
        w.localStorage.removeItem(OPT_OUT_KEY);
      } catch {
        /* Speicher nicht verfügbar */
      }
    },
  };
  const queued = w.novaAnalytics?.q ?? [];
  w.novaAnalytics = api;
  for (const [method, ...args] of queued) {
    const fn = api[method as keyof NovaApi] as ((...values: unknown[]) => void) | undefined;
    if (typeof fn === "function") fn(...args);
  }

  pageview();
})(window, document);
