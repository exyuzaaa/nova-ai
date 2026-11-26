import { Skeleton } from "@/components/ui/skeleton";

/** Platzhalter beim ersten Laden; reserviert die Flächen der echten Inhalte. */
export function DashboardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4" aria-busy="true" aria-label="Dashboard wird geladen">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-8 w-96 max-w-full" />
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[360px] rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-80 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
