/** Zentrierte, ruhige Hülle für Anmeldung, Registrierung und Passwortseiten. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="mb-6 flex items-center gap-2">
        <span
          aria-hidden
          className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground"
        >
          N
        </span>
        <span className="text-sm font-semibold tracking-tight">NOVA Analytics</span>
      </div>
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-xs">{children}</div>
    </main>
  );
}
