import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Beschriftetes Eingabefeld mit verknüpfter Fehlermeldung und Hinweistext. */
export function FormField({
  label,
  error,
  hint,
  ...inputProps
}: React.ComponentProps<typeof Input> & { label: string; error?: string; hint?: string }) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...inputProps} />
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-negative">
          {error}
        </p>
      )}
    </div>
  );
}

/** Formularweite Meldung (Fehler oder Erfolg), wird Screenreadern angesagt. */
export function FormMessage({ status, message }: { status: "idle" | "error" | "success"; message?: string }) {
  if (!message || status === "idle") return null;
  return (
    <p
      role={status === "error" ? "alert" : "status"}
      className={
        status === "error"
          ? "rounded-md border border-negative/30 bg-negative/5 px-3 py-2 text-sm text-negative"
          : "rounded-md border border-positive/30 bg-positive/5 px-3 py-2 text-sm text-positive"
      }
    >
      {message}
    </p>
  );
}
