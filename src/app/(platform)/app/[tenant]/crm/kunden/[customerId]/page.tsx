import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, MapPin, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, Section } from "@/components/app/page-section";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { uuidSchema } from "@/modules/core/domain/tenant-validation";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { listMembers } from "@/modules/core/server/tenants";
import { CUSTOMER_KIND_LABELS, CUSTOMER_STATUS_LABELS, formatMoney } from "@/modules/crm/domain/crm";
import {
  contactName,
  getCustomer,
  listActivities,
  listContacts,
  listCustomerOpportunities,
} from "@/modules/crm/server/customers";
import { listPipelines } from "@/modules/crm/server/opportunities";
import { KIND_LABELS, formatEuro } from "@/modules/finance/domain/finance";
import { listDocuments } from "@/modules/finance/server/finance";
import { ActivityFeed } from "@/modules/crm/ui/activity-feed";
import { OpportunityForm } from "@/modules/crm/ui/opportunity-forms";
import { CustomerForm } from "@/modules/crm/ui/customer-form";
import {
  ActivityForm,
  ArchiveCustomerButton,
  ContactForm,
  DeleteContactButton,
  DeleteCustomerButton,
} from "@/modules/crm/ui/customer-parts";

export const metadata: Metadata = { title: "Kunde" };

async function CustomerDetail({ params }: Pick<PageProps<"/app/[tenant]/crm/kunden/[customerId]">, "params">) {
  const { tenant: slug, customerId } = await params;
  const { tenant, permissions, user } = await requireTenantContext(decodeURIComponent(slug), "crm.view");
  if (!uuidSchema.safeParse(customerId).success) notFound();
  const customer = await getCustomer(tenant.id, customerId);
  if (!customer) notFound();

  const canFinance = permissions.has("finance.view");
  const [contacts, activities, opportunities, members, pipelines, documents] = await Promise.all([
    listContacts(tenant.id, customer.id),
    listActivities(tenant.id, { customerId: customer.id }),
    listCustomerOpportunities(tenant.id, customer.id),
    listMembers(tenant.id),
    listPipelines(tenant.id),
    canFinance ? listDocuments(tenant.id, { customerId }) : Promise.resolve([]),
  ]);
  const defaultPipeline = pipelines.find((pipeline) => pipeline.isDefault) ?? pipelines[0];
  const firstOpenStage = defaultPipeline?.stages.find((stage) => stage.kind === "open");
  const canEdit = permissions.has("crm.edit");
  const canManage = permissions.has("crm.manage");
  const base = tenantBasePath(tenant.slug);
  const memberOptions = members.map((member) => ({ id: member.memberId, label: member.email }));
  const memberNames = new Map(memberOptions.map((member) => [member.id, member.label]));
  const address = [customer.street, [customer.postalCode, customer.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  return (
    <>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{customer.number}</p>
          <h1 className="text-xl font-semibold tracking-tight">{customer.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={customer.status === "active" ? "default" : "outline"} className="h-5 text-[11px]">
              {CUSTOMER_STATUS_LABELS[customer.status as keyof typeof CUSTOMER_STATUS_LABELS] ?? customer.status}
            </Badge>
            {customer.archivedAt && (
              <Badge variant="outline" className="h-5 text-[11px]">
                Archiviert
              </Badge>
            )}
            <span>{CUSTOMER_KIND_LABELS[customer.kind as keyof typeof CUSTOMER_KIND_LABELS] ?? customer.kind}</span>
            {customer.ownerMemberId && <span>· zuständig: {memberNames.get(customer.ownerMemberId) ?? "–"}</span>}
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {customer.email && (
              <li className="flex items-center gap-1.5">
                <Mail className="size-3.5 text-muted-foreground" aria-hidden />
                <a href={`mailto:${customer.email}`} className="hover:underline">
                  {customer.email}
                </a>
              </li>
            )}
            {customer.phone && (
              <li className="flex items-center gap-1.5">
                <Phone className="size-3.5 text-muted-foreground" aria-hidden />
                <a href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`} className="hover:underline">
                  {customer.phone}
                </a>
              </li>
            )}
            {address && (
              <li className="flex items-center gap-1.5">
                <MapPin className="size-3.5 text-muted-foreground" aria-hidden />
                {address}
              </li>
            )}
          </ul>
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-2">
            <ArchiveCustomerButton tenantId={tenant.id} customerId={customer.id} archived={Boolean(customer.archivedAt)} />
            {canManage && <DeleteCustomerButton tenantId={tenant.id} customerId={customer.id} name={customer.name} />}
          </div>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-4">
          <Section title="Verlauf und Aufgaben" description="Notizen, Anrufe, Termine, E-Mails und Aufgaben zu diesem Kunden.">
            {canEdit && (
              <details className="rounded-lg border p-3" open={activities.length === 0}>
                <summary className="cursor-pointer text-sm font-medium">Neuer Eintrag</summary>
                <div className="mt-3">
                  <ActivityForm tenantId={tenant.id} target={{ customerId: customer.id }} members={memberOptions} />
                </div>
              </details>
            )}
            <ActivityFeed
              tenantId={tenant.id}
              activities={activities}
              memberNames={memberNames}
              currentUserId={user.id}
              canEdit={canEdit}
              canManage={canManage}
              timeZone={tenant.timezone}
            />
          </Section>

          {canEdit && (
            <Section title="Stammdaten bearbeiten">
              <CustomerForm
                tenantId={tenant.id}
                base={base}
                members={memberOptions}
                values={{
                  id: customer.id,
                  kind: customer.kind,
                  name: customer.name,
                  email: customer.email,
                  phone: customer.phone,
                  website: customer.website,
                  vatId: customer.vatId,
                  street: customer.street,
                  postalCode: customer.postalCode,
                  city: customer.city,
                  countryCode: customer.countryCode,
                  status: customer.status,
                  category: customer.category,
                  tags: customer.tags,
                  description: customer.description,
                  ownerMemberId: customer.ownerMemberId,
                }}
              />
            </Section>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {customer.description && (
            <Section title="Beschreibung">
              <p className="text-sm whitespace-pre-line">{customer.description}</p>
            </Section>
          )}
          <Section title="Ansprechpartner">
            {contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Ansprechpartner.</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {contacts.map((contact) => {
                  const name = contactName(contact);
                  return (
                    <li key={contact.id} className="py-3">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {name}
                        {contact.isPrimary && (
                          <Badge variant="outline" className="h-5 text-[11px]">
                            Haupt
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{[contact.position, contact.email, contact.phone].filter(Boolean).join(" · ")}</p>
                      {canEdit && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-muted-foreground">Bearbeiten</summary>
                          <div className="mt-2 flex flex-col gap-2">
                            <ContactForm tenantId={tenant.id} customerId={customer.id} contact={contact} />
                            <DeleteContactButton tenantId={tenant.id} contactId={contact.id} name={name} />
                          </div>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {canEdit && (
              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-medium">Ansprechpartner hinzufügen</summary>
                <div className="mt-3">
                  <ContactForm tenantId={tenant.id} customerId={customer.id} />
                </div>
              </details>
            )}
          </Section>

          <Section title="Verkaufschancen">
            {opportunities.length === 0 ? (
              <EmptyState title="Keine Verkaufschancen" />
            ) : (
              <ul className="flex flex-col divide-y">
                {opportunities.map((opportunity) => (
                  <li key={opportunity.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <Link href={`${base}/crm/verkaufschancen/${opportunity.id}`} className="font-medium hover:underline">
                        {opportunity.title}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {opportunity.number} · {opportunity.stageName}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">{formatMoney(opportunity.amount, opportunity.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
            {canEdit && defaultPipeline && firstOpenStage && !customer.archivedAt && (
              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-medium">Neue Verkaufschance</summary>
                <div className="mt-3">
                  <OpportunityForm
                    tenantId={tenant.id}
                    members={memberOptions}
                    stages={defaultPipeline.stages.map(({ id, name, probability, kind }) => ({ id, name, probability, kind }))}
                    values={{
                      customerId: customer.id,
                      pipelineId: defaultPipeline.id,
                      title: "",
                      amount: "",
                      stageId: firstOpenStage.id,
                      probability: null,
                      expectedCloseDate: null,
                      ownerMemberId: customer.ownerMemberId,
                      lostReason: null,
                      notes: null,
                    }}
                  />
                </div>
              </details>
            )}
          </Section>

          {canFinance && (
            <Section title="Angebote und Rechnungen">
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Belege.</p>
              ) : (
                <ul className="flex flex-col divide-y">
                  {documents.slice(0, 10).map((document) => (
                    <li key={document.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                      <Link href={`${base}/finanzen/belege/${document.id}`} className="min-w-0 font-medium hover:underline">
                        {KIND_LABELS[document.kind]} {document.number ?? "(Entwurf)"}
                      </Link>
                      <span className="shrink-0 tabular-nums">{formatEuro(document.grossTotal)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {permissions.has("finance.edit") && !customer.archivedAt && (
                <p className="flex gap-3 text-sm">
                  <Link href={`${base}/finanzen/neu?art=angebot&kunde=${customer.id}`} className="font-medium hover:underline">
                    Neues Angebot
                  </Link>
                  <Link href={`${base}/finanzen/neu?art=rechnung&kunde=${customer.id}`} className="font-medium hover:underline">
                    Neue Rechnung
                  </Link>
                </p>
              )}
            </Section>
          )}

          <p className="text-xs text-muted-foreground">
            Angelegt am{" "}
            {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: tenant.timezone }).format(new Date(customer.createdAt))}
            {" · "}
            <Link href={`${base}/crm/kunden`} className="hover:underline">
              Zur Kundenliste
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

export default function CustomerPage({ params }: PageProps<"/app/[tenant]/crm/kunden/[customerId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Kunde wird geladen" />}>
      <CustomerDetail params={params} />
    </Suspense>
  );
}
