import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-24 text-center">
      <h1 className="text-lg font-semibold">Seite nicht gefunden</h1>
      <p className="text-sm text-muted-foreground">
        Diese Website oder Seite existiert nicht oder du hast keinen Zugriff darauf.
      </p>
      <Link href="/analytics" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
        Zur Übersicht
      </Link>
    </main>
  );
}
