"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const OPTIONS = [
  { value: "light", label: "Hell", Icon: Sun },
  { value: "dark", label: "Dunkel", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

const subscribe = () => () => {};

/** Darstellung wählen. Rendert erst nach der Hydration, um falsche Vorauswahl zu vermeiden. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);

  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      value={isClient ? theme : undefined}
      onValueChange={(value) => value && setTheme(value)}
      aria-label="Darstellung"
      className="w-full"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <ToggleGroupItem key={value} value={value} aria-label={label} title={label} className="flex-1">
          <Icon className="size-3.5" aria-hidden />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
