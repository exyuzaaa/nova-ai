import { Info } from "lucide-react";

/** Ehrlicher Hinweis, wenn eine Kennzahl nicht verfügbar ist – statt eines Schätzwerts. */
export function DataNotice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-6 py-8 text-center">
      <Info className="size-5 text-muted-foreground" aria-hidden />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
