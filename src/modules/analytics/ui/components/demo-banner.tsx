import { FlaskConical } from "lucide-react";

/** Dauerhafte Kennzeichnung synthetischer Daten. Nicht ausblendbar. */
export function DemoBanner() {
  return (
    <div
      role="note"
      aria-label="Hinweis zu Demo-Daten"
      className="flex items-start gap-2.5 rounded-lg border border-notice-border bg-notice px-3 py-2.5 text-sm text-notice-foreground"
    >
      <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        <strong className="font-semibold">Demo-Daten.</strong> Diese Website zeigt synthetische
        Beispielwerte zur Vorschau. Echte Zahlen erscheinen erst, wenn das Tracking für eine eigene
        Website eingerichtet ist.
      </p>
    </div>
  );
}
