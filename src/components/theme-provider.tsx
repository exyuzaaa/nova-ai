"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Light ist Standard; Nutzer können Dunkel oder Systemeinstellung wählen. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
