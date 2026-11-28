import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentIndex } from "@/modules/finance/ui/document-index";

export const metadata: Metadata = { title: "Angebote" };

export default function Page({ params, searchParams }: PageProps<"/app/[tenant]/finanzen/angebote">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Angebote werden geladen" />}>
      {Promise.all([params, searchParams]).then(([{ tenant }, query]) => (
        <DocumentIndex slug={decodeURIComponent(tenant)} kind="quote" query={query} />
      ))}
    </Suspense>
  );
}
