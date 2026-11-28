import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { KIND_LABELS, STATUS_LABELS, formatEuro, isOverdue, type DocumentKind, type DocumentStatus } from "../domain/finance";
import type { DocumentRow } from "../server/finance";

const formatDate = (value: string | null) => (value ? new Intl.DateTimeFormat("de-DE", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : "–");
export { formatDate };

/** Status als Abzeichen; offene Rechnungen nach Fälligkeit als „Überfällig“. */
export function StatusBadge({ kind, status, dueDate, today }: { kind: DocumentKind; status: DocumentStatus; dueDate: string | null; today: string }) {
  const overdue = isOverdue({ kind, status, dueDate }, today);
  const label = overdue ? "Überfällig" : kind === "credit_note" && status === "issued" ? "Ausgestellt" : STATUS_LABELS[status];
  const variant = overdue || status === "rejected" ? "destructive" : status === "paid" || status === "accepted" ? "default" : status === "draft" || status === "cancelled" ? "outline" : "secondary";
  return (
    <Badge variant={variant} className={cn("h-5 text-[11px]", status === "cancelled" && "line-through")}>
      {label}
    </Badge>
  );
}

export function DocumentList({ rows, base, today, showKind = false }: { rows: DocumentRow[]; base: string; today: string; showKind?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="border-b text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Nummer</th>
            <th className="px-3 py-2 font-medium">Empfänger / Betreff</th>
            <th className="px-3 py-2 font-medium">Datum</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 text-right font-medium">Brutto</th>
            <th className="px-3 py-2 text-right font-medium">Offen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const open = row.kind === "invoice" && row.status !== "draft" && row.status !== "cancelled" ? row.grossTotal - row.paidTotal : null;
            return (
              <tr key={row.id} className="border-b last:border-0 hover:bg-muted/40">
                <td className="px-3 py-2 whitespace-nowrap">
                  <Link href={`${base}/belege/${row.id}`} className="font-medium hover:underline">
                    {showKind && `${KIND_LABELS[row.kind]} `}
                    {row.number ?? "Entwurf"}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <span className="block">{row.recipientName ?? "–"}</span>
                  {row.title && <span className="block text-xs text-muted-foreground">{row.title}</span>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {formatDate(row.issueDate)}
                  {row.kind === "invoice" && row.dueDate && row.status !== "draft" && <span className="block text-xs text-muted-foreground">fällig {formatDate(row.dueDate)}</span>}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge kind={row.kind} status={row.status} dueDate={row.dueDate} today={today} />
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{formatEuro(row.grossTotal)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{open === null ? "–" : formatEuro(open)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
