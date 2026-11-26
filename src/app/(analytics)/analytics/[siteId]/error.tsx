"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
      <h1 className="text-lg font-semibold">Daten konnten nicht geladen werden</h1>
      <p className="text-sm text-muted-foreground">
        Bitte versuche es erneut. Bleibt der Fehler bestehen, nenne dem Support die Kennung
        {error.digest ? ` ${error.digest}` : " aus dem Server-Log"}.
      </p>
      <Button variant="outline" onClick={reset}>
        Erneut versuchen
      </Button>
    </div>
  );
}
