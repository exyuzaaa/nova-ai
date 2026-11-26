import { Suspense } from "react";
import type { Metadata } from "next";
import Script from "next/script";
import { TrackingTestActions } from "./test-actions";

export const metadata: Metadata = { title: "Tracking-Test", robots: { index: false, follow: false } };

/**
 * Öffentliche Testseite: bindet tracker.js mit der übergebenen Tracking-ID ein.
 * Events werden nur angenommen, wenn die Domain der Website zu dieser Seite passt –
 * die Seite ist daher nur für Websites nutzbar, deren Domain die NOVA-Adresse ist.
 */
async function TrackerScript({ searchParams }: Pick<PageProps<"/tracking-test">, "searchParams">) {
  const { site } = await searchParams;
  const siteId = typeof site === "string" && /^ns_[a-f0-9]{16}$/.test(site) ? site : null;
  if (!siteId) {
    return <p className="text-sm text-negative">Keine gültige Tracking-ID angegeben.</p>;
  }
  return (
    <>
      <Script src="/tracker.js" data-site-id={siteId} strategy="afterInteractive" />
      <p className="text-sm text-muted-foreground">
        Tracking aktiv für <code className="font-mono">{siteId}</code>. Jeder Aufruf dieser Seite zählt als Seitenaufruf.
      </p>
      <TrackingTestActions />
    </>
  );
}

export default function TrackingTestPage({ searchParams }: PageProps<"/tracking-test">) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-4 py-12">
      <h1 className="text-lg font-semibold tracking-tight">Tracking-Test</h1>
      <Suspense>
        <TrackerScript searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
