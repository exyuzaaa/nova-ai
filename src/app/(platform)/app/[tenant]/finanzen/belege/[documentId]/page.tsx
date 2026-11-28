import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Section } from "@/components/app/page-section";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { uuidSchema } from "@/modules/core/domain/tenant-validation";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { KIND_LABELS, PAYMENT_METHODS, formatEuro, formatQuantity, totals } from "@/modules/finance/domain/finance";
import { getDocument, getMailAccount, getSettings, listArticles, listDocumentEmails } from "@/modules/finance/server/finance";
import { isGmailConfigured } from "@/modules/finance/server/gmail";
import { defaultMail } from "@/modules/finance/domain/mail";
import { SendMailForm } from "@/modules/finance/ui/mail-forms";
import { getCustomer } from "@/modules/crm/server/customers";
import { StatusBadge, formatDate } from "@/modules/finance/ui/document-list";
import {
  CancelInvoiceForm,
  DeleteDraftButton,
  DeletePaymentButton,
  DocumentHeaderForm,
  IssueButton,
  LineButtons,
  LineForm,
  PaymentForm,
  WorkflowButton,
} from "@/modules/finance/ui/finance-forms";
import { listCustomerOptions } from "@/modules/projects/server/projects";
import { listTimeProjectOptions } from "@/modules/projects/server/time";
import { todayIn } from "@/modules/projects/domain/projects";

export const metadata: Metadata = { title: "Beleg" };

async function DocumentPage({ params }: Pick<PageProps<"/app/[tenant]/finanzen/belege/[documentId]">, "params">) {
  const { tenant: slug, documentId } = await params;
  if (!uuidSchema.safeParse(documentId).success) notFound();
  const { tenant, permissions } = await requireTenantContext(decodeURIComponent(slug), "finance.view");
  const doc = await getDocument(tenant.id, documentId);
  if (!doc) notFound();
  const today = todayIn(tenant.timezone);
  const base = `${tenantBasePath(tenant.slug)}/finanzen`;
  const draft = doc.status === "draft";
  const canEdit = permissions.has("finance.edit");
  const canIssue = permissions.has("finance.issue");
  const editable = draft && canEdit;
  const canSend = !draft && (doc.kind === "quote" ? canEdit : canIssue);
  const [settings, articles, customers, projects, mailAccount, emails, customer] = await Promise.all([
    getSettings(tenant.id),
    editable ? listArticles(tenant.id) : Promise.resolve([]),
    editable && permissions.has("crm.view") ? listCustomerOptions(tenant.id) : Promise.resolve([]),
    editable && permissions.has("projects.view") ? listTimeProjectOptions(tenant.id).catch(() => []) : Promise.resolve([]),
    canSend ? getMailAccount(tenant.id) : Promise.resolve(null),
    draft ? Promise.resolve([]) : listDocumentEmails(tenant.id, doc.id),
    canSend && doc.customerId && permissions.has("crm.view") ? getCustomer(tenant.id, doc.customerId).catch(() => null) : Promise.resolve(null),
  ]);
  const formatDateTime = (value: string) => new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: tenant.timezone }).format(new Date(value));
  const smallBusiness = draft ? Boolean(settings?.small_business) : doc.smallBusiness;
  const sums = draft ? totals(doc.lines, smallBusiness) : { net: doc.netTotal, tax: doc.taxTotal, gross: doc.grossTotal, breakdown: doc.taxBreakdown };
  const open = Math.round((doc.grossTotal - doc.paidTotal) * 100) / 100;
  const label = KIND_LABELS[doc.kind];
  const title = doc.number ? `${label} ${doc.number}` : `${label} (Entwurf)`;
  const invoiceLive = doc.kind === "invoice" && ["issued", "partially_paid", "paid"].includes(doc.status);
  const defaultTaxRate = Number(settings?.default_tax_rate ?? 19);

  return (
    <>
      <PageHeader
        title={title}
        description={[doc.recipientName, doc.title].filter(Boolean).join(" · ") || undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge kind={doc.kind} status={doc.status} dueDate={doc.dueDate} today={today} />
            <Button asChild size="sm" variant="outline">
              <a href={`${base}/belege/${doc.id}/pdf`} target="_blank" rel="noopener">
                <FileDown className="size-4" aria-hidden />
                {draft ? "PDF-Vorschau" : "PDF"}
              </a>
            </Button>
          </div>
        }
      />

      {doc.cancelReason && (
        <p className="rounded-lg border px-3 py-2 text-sm" role="note">
          Storno-Grund: {doc.cancelReason}
        </p>
      )}

      {doc.related.length > 0 && (
        <nav aria-label="Zugehörige Belege" className="flex flex-wrap gap-2 text-sm">
          <span className="text-muted-foreground">Zugehörig:</span>
          {doc.related.map((entry) => (
            <Link key={entry.id} href={`${base}/belege/${entry.id}`} className="underline">
              {KIND_LABELS[entry.kind]} {entry.number ?? "(Entwurf)"}
            </Link>
          ))}
        </nav>
      )}

      {draft && (canEdit || canIssue) && (
        <Section title="Ausstellen" description={doc.kind === "quote" ? "Vergibt die Angebotsnummer und setzt den Status auf „Versendet“." : "Vergibt die fortlaufende Rechnungsnummer. Danach sind Änderungen nur noch per Storno möglich."}>
          <div className="flex flex-wrap items-start gap-3">
            {(doc.kind === "quote" ? canEdit : canIssue) && doc.lines.length > 0 ? (
              <IssueButton tenantId={tenant.id} documentId={doc.id} label={doc.kind === "quote" ? "Angebot ausstellen" : "Rechnung ausstellen"} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {doc.lines.length === 0 ? "Füge zuerst mindestens eine Position hinzu." : "Zum Ausstellen von Rechnungen fehlt dir das Recht „Rechnungen ausstellen“."}
              </p>
            )}
            {canEdit && <DeleteDraftButton tenantId={tenant.id} documentId={doc.id} />}
          </div>
        </Section>
      )}

      {doc.kind === "quote" && canEdit && (doc.status === "sent" || doc.status === "accepted" || doc.status === "rejected") && (
        <Section title="Angebot">
          <div className="flex flex-wrap gap-2">
            {doc.status !== "accepted" && (
              <WorkflowButton tenantId={tenant.id} documentId={doc.id} intent="accept">
                Als angenommen markieren
              </WorkflowButton>
            )}
            {doc.status !== "rejected" && (
              <WorkflowButton tenantId={tenant.id} documentId={doc.id} intent="reject">
                Als abgelehnt markieren
              </WorkflowButton>
            )}
            {doc.status !== "rejected" && (
              <WorkflowButton tenantId={tenant.id} documentId={doc.id} intent="convert" variant="default">
                In Rechnung übernehmen
              </WorkflowButton>
            )}
          </div>
        </Section>
      )}

      {editable ? (
        <Section title="Kopfdaten">
          <DocumentHeaderForm
            tenantId={tenant.id}
            customers={customers}
            projects={projects}
            values={{
              id: doc.id,
              kind: doc.kind,
              customerId: doc.customerId,
              projectId: doc.projectId,
              title: doc.title,
              introText: doc.introText,
              closingText: doc.closingText,
              recipientName: doc.recipientName,
              recipientExtra: doc.recipientExtra,
              recipientStreet: doc.recipientStreet,
              recipientPostal: doc.recipientPostal,
              recipientCity: doc.recipientCity,
              recipientCountry: doc.recipientCountry,
              recipientVatId: doc.recipientVatId,
              issueDate: doc.issueDate,
              serviceDate: doc.serviceDate,
              serviceEndDate: doc.serviceEndDate,
              dueDate: doc.dueDate,
              validUntil: doc.validUntil,
            }}
          />
        </Section>
      ) : (
        <Section title="Angaben">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
            <dt className="text-muted-foreground">Empfänger</dt>
            <dd className="whitespace-pre-line">
              {[doc.recipientName, doc.recipientExtra, doc.recipientStreet, [doc.recipientPostal, doc.recipientCity].filter(Boolean).join(" "), doc.recipientCountry !== "DE" ? doc.recipientCountry : null]
                .filter(Boolean)
                .join("\n") || "–"}
            </dd>
            <dt className="text-muted-foreground">Datum</dt>
            <dd>{formatDate(doc.issueDate)}</dd>
            {doc.kind === "quote" ? (
              <>
                <dt className="text-muted-foreground">Gültig bis</dt>
                <dd>{formatDate(doc.validUntil)}</dd>
              </>
            ) : (
              <>
                {doc.serviceDate && (
                  <>
                    <dt className="text-muted-foreground">Leistungszeitraum</dt>
                    <dd>
                      {formatDate(doc.serviceDate)}
                      {doc.serviceEndDate && doc.serviceEndDate !== doc.serviceDate && ` – ${formatDate(doc.serviceEndDate)}`}
                    </dd>
                  </>
                )}
                {doc.kind === "invoice" && (
                  <>
                    <dt className="text-muted-foreground">Fällig am</dt>
                    <dd>{formatDate(doc.dueDate)}</dd>
                  </>
                )}
              </>
            )}
            {doc.introText && (
              <>
                <dt className="text-muted-foreground">Einleitung</dt>
                <dd className="whitespace-pre-line">{doc.introText}</dd>
              </>
            )}
            {doc.closingText && (
              <>
                <dt className="text-muted-foreground">Schlusstext</dt>
                <dd className="whitespace-pre-line">{doc.closingText}</dd>
              </>
            )}
          </dl>
        </Section>
      )}

      <Section title={`Positionen (${doc.lines.length})`}>
        {editable ? (
          <>
            {doc.lines.length > 0 && (
              <ol className="flex flex-col divide-y">
                {doc.lines.map((line, index) => (
                  <li key={line.id} className="flex flex-col gap-2 py-3 first:pt-0">
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        Pos. {index + 1} · netto <span className="tabular-nums">{formatEuro(line.lineNet)}</span>
                      </span>
                      <LineButtons tenantId={tenant.id} documentId={doc.id} lineId={line.id} title={line.title} first={index === 0} last={index === doc.lines.length - 1} />
                    </div>
                    <LineForm tenantId={tenant.id} documentId={doc.id} values={line} defaultTaxRate={defaultTaxRate} />
                  </li>
                ))}
              </ol>
            )}
            <div className="rounded-lg border border-dashed p-3">
              <LineForm tenantId={tenant.id} documentId={doc.id} articles={articles} defaultTaxRate={defaultTaxRate} />
            </div>
          </>
        ) : doc.lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Positionen.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Pos.</th>
                  <th className="py-2 pr-3 font-medium">Bezeichnung</th>
                  <th className="py-2 pr-3 text-right font-medium">Menge</th>
                  <th className="py-2 pr-3 text-right font-medium">Einzelpreis</th>
                  <th className="py-2 pr-3 text-right font-medium">USt</th>
                  <th className="py-2 text-right font-medium">Netto</th>
                </tr>
              </thead>
              <tbody>
                {doc.lines.map((line, index) => (
                  <tr key={line.id} className="border-b align-top last:border-0">
                    <td className="py-2 pr-3">{index + 1}</td>
                    <td className="py-2 pr-3">
                      {line.title}
                      {line.description && <span className="block text-xs whitespace-pre-line text-muted-foreground">{line.description}</span>}
                      {line.discountPercent > 0 && <span className="block text-xs text-muted-foreground">abzgl. {formatQuantity(line.discountPercent)} % Rabatt</span>}
                    </td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">
                      {formatQuantity(line.quantity)} {line.unit}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatEuro(line.unitPrice)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{smallBusiness ? "–" : `${formatQuantity(line.taxRate)} %`}</td>
                    <td className="py-2 text-right tabular-nums">{formatEuro(line.lineNet)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <dl className="ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm" aria-label="Summen">
          <dt className="text-muted-foreground">Summe netto</dt>
          <dd className="text-right tabular-nums">{formatEuro(sums.net)}</dd>
          {!smallBusiness &&
            sums.breakdown.map((row) => (
              <div key={row.rate} className="contents">
                <dt className="text-muted-foreground">USt {formatQuantity(row.rate)} %</dt>
                <dd className="text-right tabular-nums">{formatEuro(row.tax)}</dd>
              </div>
            ))}
          <dt className="border-t pt-1 font-medium">Gesamt</dt>
          <dd className="border-t pt-1 text-right font-medium tabular-nums" data-testid="gross-total">
            {formatEuro(sums.gross)}
          </dd>
        </dl>
        {smallBusiness && <p className="text-xs text-muted-foreground">Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.</p>}
      </Section>


      {!draft && (canSend || emails.length > 0) && (
        <Section title="Per E-Mail senden" description={emails.length > 0 ? `Bereits ${emails.length}× versendet.` : undefined}>
          {canSend &&
            (!isGmailConfigured() ? (
              <p className="text-sm text-muted-foreground">Der E-Mail-Versand ist auf dieser NOVA-Installation noch nicht eingerichtet.</p>
            ) : !mailAccount ? (
              <p className="text-sm text-muted-foreground">
                Es ist noch kein Gmail-Konto verbunden.{" "}
                {permissions.has("finance.manage") ? (
                  <Link href={`${base}/einstellungen`} className="font-medium text-foreground underline">
                    Gmail verbinden
                  </Link>
                ) : (
                  "Bitte wende dich an eine Person mit Verwaltungsrechten."
                )}
              </p>
            ) : (
              <SendMailForm
                tenantId={tenant.id}
                documentId={doc.id}
                from={mailAccount.email}
                defaults={{
                  to: customer?.email ?? "",
                  attachment: `${doc.number}.pdf`,
                  ...defaultMail({
                    kind: doc.kind,
                    kindLabel: label,
                    number: doc.number ?? "",
                    companyName: typeof doc.seller?.legal_name === "string" ? doc.seller.legal_name : tenant.name,
                    recipientName: doc.recipientName,
                    gross: formatEuro(doc.grossTotal),
                    dueDate: doc.kind === "invoice" && doc.dueDate ? formatDate(doc.dueDate) : null,
                  }),
                }}
              />
            ))}
          {emails.length > 0 && (
            <ul className="flex flex-col divide-y text-sm" aria-label="Versandverlauf">
              {emails.map((email) => (
                <li key={email.id} className="flex flex-col gap-0.5 py-2">
                  <span>
                    {formatDateTime(email.sentAt)} an {email.recipients.join(", ")}
                    {email.cc.length > 0 && ` (CC: ${email.cc.join(", ")})`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {email.subject} · von {email.sentFrom}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {invoiceLive && (
        <Section title="Zahlungen" description={open > 0 ? `Noch offen: ${formatEuro(open)}` : open < 0 ? `Überzahlt: ${formatEuro(-open)}` : "Vollständig bezahlt."}>
          {doc.payments.length > 0 && (
            <ul className="flex flex-col divide-y text-sm">
              {doc.payments.map((payment) => (
                <li key={payment.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    {formatDate(payment.paidOn)} · {PAYMENT_METHODS[payment.method]}
                    {payment.note && <span className="text-muted-foreground"> · {payment.note}</span>}
                  </span>
                  <span className="flex items-center gap-2 tabular-nums">
                    {formatEuro(payment.amount)}
                    {canIssue && <DeletePaymentButton tenantId={tenant.id} documentId={doc.id} paymentId={payment.id} />}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {canIssue && open !== 0 && <PaymentForm tenantId={tenant.id} documentId={doc.id} open={open} today={today} />}
        </Section>
      )}

      {invoiceLive && canIssue && (
        <Section title="Stornieren" description="Ausgestellte Rechnungen werden nicht gelöscht. Ein Storno erzeugt eine Gutschrift mit negativen Beträgen.">
          <CancelInvoiceForm tenantId={tenant.id} documentId={doc.id} />
        </Section>
      )}
    </>
  );
}

export default function Page({ params }: PageProps<"/app/[tenant]/finanzen/belege/[documentId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Beleg wird geladen" />}>
      <DocumentPage params={params} />
    </Suspense>
  );
}
