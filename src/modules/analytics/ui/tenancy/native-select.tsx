import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Natives Auswahlfeld im Stil der Eingabefelder – voll tastatur- und screenreadertauglich. */
export function NativeSelect({
  label,
  error,
  hideLabel = false,
  className,
  children,
  ...props
}: React.ComponentProps<"select"> & { label: string; error?: string; hideLabel?: boolean }) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} className={hideLabel ? "sr-only" : undefined}>
        {label}
      </Label>
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-9 w-full appearance-none rounded-md border border-input bg-transparent py-1 pr-8 pl-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-negative dark:bg-input/30"
          {...props}
        >
          {children}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      {error && (
        <p id={`${id}-error`} className="text-xs text-negative">
          {error}
        </p>
      )}
    </div>
  );
}
