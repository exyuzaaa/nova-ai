"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Löst Beispiel-Events aus: eigenes Event, Seitenwechsel ohne Neuladen, externer Link. */
export function TrackingTestActions() {
  const [sent, setSent] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => {
            window.novaAnalytics?.track?.("test_button_clicked", { source: "tracking-test" });
            setSent("Eigenes Event gesendet.");
          }}
        >
          Eigenes Event senden
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            window.history.pushState({}, "", `${window.location.pathname}${window.location.search}&seite=2`);
            setSent("Seitenwechsel ohne Neuladen ausgelöst.");
          }}
        >
          Seitenwechsel simulieren
        </Button>
      </div>
      {sent && (
        <p role="status" className="text-sm text-positive">
          {sent}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Danach in NOVA unter Einstellungen → „Tracking einbauen“ die Seite neu laden.
      </p>
    </div>
  );
}
