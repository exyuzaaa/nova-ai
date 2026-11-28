import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentIndex } from "@/modules/finance/ui/document-index";

export const metadata: Metadata = { title: "Gutschriften" };

export default function Page({ params, searchParams }: PageProps<"/app/[tenant]/finanzen/gutschriften">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Gutschriften werden geladen" />}>
      {Promise.all([params, searchParams]).then(([{ tenant }, query]) => (
        <DocumentIndex slug={decodeURIComponent(tenant)} kind="credit_note" query={query} />
      ))}
    </Suspense>
  );
}
