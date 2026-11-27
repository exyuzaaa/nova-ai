"use client";

import { useEffect, useId, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

/**
 * Globale Suche: normales GET-Formular auf die Suchseite (funktioniert auch ohne
 * JavaScript). Tastenkürzel „/“ oder Strg/⌘+K setzt den Fokus.
 */
export function SearchBox({ action }: { action: string }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const params = useSearchParams();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !typing)) {
        event.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form action={action} method="get" role="search" className="relative min-w-0 flex-1">
      <label htmlFor={id} className="sr-only">
        Suchen
      </label>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={input}
        id={id}
        name="q"
        type="search"
        defaultValue={params.get("q") ?? ""}
        maxLength={200}
        placeholder="Suchen …"
        autoComplete="off"
        className="h-9 w-full rounded-md border border-input bg-transparent pr-8 pl-8 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
      />
      <kbd aria-hidden className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border px-1 text-[10px] text-muted-foreground lg:block">
        /
      </kbd>
    </form>
  );
}
