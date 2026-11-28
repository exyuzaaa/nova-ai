"use client";

import { useRef } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/app/native-select";
import { useFormAction } from "@/components/app/use-form-action";
import { FormField, FormMessage } from "@/modules/auth/ui/form-field";
import type { ActionState } from "@/modules/core/server/action-state";
import { ActionButton, Textarea } from "@/modules/projects/ui/project-forms";
import { PAYMENT_METHODS, TAX_RATES } from "../domain/finance";
import {
  createDocumentAction,
  deleteDocumentAction,
  documentWorkflowAction,
  lineAction,
  saveArticleAction,
  saveSettingsAction,
  updateDocumentAction,
} from "../server/actions/finance-actions";

const IDLE: ActionState = { status: "idle" };
type Option = { id: string; label: string };
const de = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined ? "" : new Intl.NumberFormat("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: digits, useGrouping: false }).format(value);

// -----------------------------------------------------------------------------
// Einstellungen
// -----------------------------------------------------------------------------
export function SettingsForm({ tenantId, values }: { tenantId: string; values: Record<string, string | number | boolean | null> | null }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(saveSettingsAction, IDLE);
  const errors = state.fieldErrors ?? {};
  const v = (key: string, fallback = "") => {
    const raw = values?.[key];
    return raw === null || raw === undefined ? fallback : typeof raw === "number" ? de(raw) : String(raw);
  };
  const field = (name: string, label: string, extra: Partial<React.ComponentProps<typeof FormField>> = {}) => (
    <FormField label={label} name={name} defaultValue={v(name)} error={errors[name]} {...extra} />
  );
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      <FormMessage status={state.status} message={state.message} />
      <div className="grid gap-4 sm:grid-cols-2">
        {field("legal_name", "Firmenname (wie im Handelsregister)", { required: true })}
        {field("managing_directors", "Geschäftsführung")}
        {field("street", "Straße und Hausnummer", { required: true })}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
          {field("postal_code", "PLZ")}
          {field("city", "Ort", { required: true })}
        </div>
        <FormField label="Land" name="country_code" defaultValue={v("country_code", "DE")} maxLength={2} error={errors.country_code} />
        {field("email", "E-Mail", { type: "email" })}
        {field("phone", "Telefon")}
        {field("website", "Website")}
        {field("tax_number", "Steuernummer", { hint: "Steuernummer oder USt-IdNr. ist Pflicht." })}
        {field("vat_id", "USt-IdNr.")}
        {field("register_info", "Registereintrag", { placeholder: "z. B. Amtsgericht Berlin, HRB 12345" })}
        {field("bank_name", "Bank")}
        {field("iban", "IBAN")}
        {field("bic", "BIC")}
        <FormField label="Zahlungsziel (Tage)" name="payment_terms_days" type="number" min={0} max={365} defaultValue={v("payment_terms_days", "14")} error={errors.payment_terms_days} />
        <FormField label="Angebote gültig (Tage)" name="quote_valid_days" type="number" min={1} max={365} defaultValue={v("quote_valid_days", "30")} error={errors.quote_valid_days} />
        <NativeSelect label="Standard-Steuersatz" name="default_tax_rate" defaultValue={v("default_tax_rate", "19")}>
          {TAX_RATES.map((rate) => (
            <option key={rate} value={rate}>
              {rate} %
            </option>
          ))}
        </NativeSelect>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="small_business" value="1" defaultChecked={Boolean(values?.small_business)} className="mt-1" />
        <span>
          Kleinunternehmer nach § 19 UStG
          <span className="block text-xs text-muted-foreground">Rechnungen ohne Umsatzsteuer mit dem gesetzlichen Hinweis. Gilt für neue Belege.</span>
        </span>
      </label>
      <Textarea label="Zusätzlicher Fußtext" name="invoice_footer" defaultValue={v("invoice_footer") || null} maxLength={1000} rows={2} error={errors.invoice_footer} />
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Wird gespeichert …" : "Rechnungsdaten speichern"}
        </Button>
      </div>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Artikel
// -----------------------------------------------------------------------------
export function ArticleForm({ tenantId, values }: { tenantId: string; values?: { id: string; name: string; description: string | null; unit: string; unitPrice: number; taxRate: number } }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(saveArticleAction, IDLE, { resetOnSuccess: !values });
  const errors = state.fieldErrors ?? {};
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-end gap-2" noValidate aria-label={values ? `Artikel ${values.name}` : "Neuer Artikel"}>
      <input type="hidden" name="tenantId" value={tenantId} />
      {values && <input type="hidden" name="articleId" value={values.id} />}
      <div className="min-w-48 flex-1">
        <FormField label={values ? "Bezeichnung" : "Neuer Artikel"} name="name" defaultValue={values?.name} maxLength={200} error={errors.name} />
      </div>
      <div className="w-24">
        <FormField label="Einheit" name="unit" defaultValue={values?.unit ?? "Stück"} maxLength={20} error={errors.unit} />
      </div>
      <div className="w-32">
        <FormField label="Preis netto (€)" name="unit_price" inputMode="decimal" defaultValue={de(values?.unitPrice ?? null)} error={errors.unit_price} />
      </div>
      <NativeSelect label="USt" name="tax_rate" defaultValue={String(values?.taxRate ?? 19)}>
        {TAX_RATES.map((rate) => (
          <option key={rate} value={rate}>
            {rate} %
          </option>
        ))}
      </NativeSelect>
      <input type="hidden" name="description" value={values?.description ?? ""} />
      <Button type="submit" size="sm" variant={values ? "outline" : "default"} disabled={isPending}>
        {values ? "Speichern" : "Hinzufügen"}
      </Button>
      <div className="basis-full empty:hidden">
        <FormMessage status={state.status} message={state.message} />
      </div>
    </form>
  );
}

export function ArchiveArticleButton({ tenantId, articleId, archived }: { tenantId: string; articleId: string; archived: boolean }) {
  return (
    <ActionButton action={saveArticleAction} fields={{ tenantId, articleId, intent: archived ? "restore" : "archive" }}>
      {archived ? "Wieder aktivieren" : "Ausblenden"}
    </ActionButton>
  );
}

// -----------------------------------------------------------------------------
// Belege
// -----------------------------------------------------------------------------
export function NewDocumentForm({ tenantId, kind, customers, projects, defaultCustomerId }: { tenantId: string; kind: "quote" | "invoice"; customers: Option[]; projects: Option[]; defaultCustomerId?: string }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(createDocumentAction, IDLE);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="kind" value={kind} />
      <FormMessage status={state.status} message={state.message} />
      <NativeSelect label="Kunde" name="customer_id" defaultValue={defaultCustomerId ?? ""} error={state.fieldErrors?.customer_id}>
        <option value="">– auswählen –</option>
        {customers.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.label}
          </option>
        ))}
      </NativeSelect>
      {projects.length > 0 && (
        <NativeSelect label="Projekt (optional)" name="project_id" defaultValue="">
          <option value="">– kein Projekt –</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.label}
            </option>
          ))}
        </NativeSelect>
      )}
      <FormField label="Betreff" name="title" maxLength={200} placeholder={kind === "quote" ? "z. B. Angebot Website-Relaunch" : "z. B. Wartung November"} />
      <div>
        <Button type="submit" disabled={isPending}>
          {kind === "quote" ? "Angebot anlegen" : "Rechnung anlegen"}
        </Button>
      </div>
    </form>
  );
}

export type HeaderValues = {
  id: string;
  kind: "quote" | "invoice" | "credit_note";
  customerId: string | null;
  projectId: string | null;
  title: string | null;
  introText: string | null;
  closingText: string | null;
  recipientName: string | null;
  recipientExtra: string | null;
  recipientStreet: string | null;
  recipientPostal: string | null;
  recipientCity: string | null;
  recipientCountry: string;
  recipientVatId: string | null;
  issueDate: string | null;
  serviceDate: string | null;
  serviceEndDate: string | null;
  dueDate: string | null;
  validUntil: string | null;
};

export function DocumentHeaderForm({ tenantId, values, customers, projects }: { tenantId: string; values: HeaderValues; customers: Option[]; projects: Option[] }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(updateDocumentAction, IDLE);
  const errors = state.fieldErrors ?? {};
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="documentId" value={values.id} />
      <FormMessage status={state.status} message={state.message} />
      <div className="grid gap-4 sm:grid-cols-2">
        <NativeSelect label="Kunde" name="customer_id" defaultValue={values.customerId ?? ""}>
          <option value="">– kein Kunde –</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect label="Projekt" name="project_id" defaultValue={values.projectId ?? ""}>
          <option value="">– kein Projekt –</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.label}
            </option>
          ))}
        </NativeSelect>
        <div className="sm:col-span-2">
          <FormField label="Betreff" name="title" defaultValue={values.title ?? ""} maxLength={200} error={errors.title} />
        </div>
      </div>
      <fieldset className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
        <legend className="px-1 text-sm font-medium">Empfänger (leer = aus dem Kunden)</legend>
        <FormField label="Name" name="recipient_name" defaultValue={values.recipientName ?? ""} maxLength={200} error={errors.recipient_name} />
        <FormField label="Zusatz (z. B. z. Hd.)" name="recipient_extra" defaultValue={values.recipientExtra ?? ""} maxLength={200} />
        <FormField label="Straße" name="recipient_street" defaultValue={values.recipientStreet ?? ""} maxLength={200} />
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
          <FormField label="PLZ" name="recipient_postal" defaultValue={values.recipientPostal ?? ""} maxLength={20} />
          <FormField label="Ort" name="recipient_city" defaultValue={values.recipientCity ?? ""} maxLength={120} />
        </div>
        <FormField label="Land" name="recipient_country" defaultValue={values.recipientCountry} maxLength={2} error={errors.recipient_country} />
        <FormField label="USt-IdNr. des Kunden" name="recipient_vat_id" defaultValue={values.recipientVatId ?? ""} maxLength={30} />
      </fieldset>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FormField label="Datum" name="issue_date" type="date" defaultValue={values.issueDate ?? ""} hint="Leer = beim Ausstellen" error={errors.issue_date} />
        {values.kind === "quote" ? (
          <>
            <FormField label="Gültig bis" name="valid_until" type="date" defaultValue={values.validUntil ?? ""} error={errors.valid_until} />
            <input type="hidden" name="service_date" value="" />
            <input type="hidden" name="service_end_date" value="" />
            <input type="hidden" name="due_date" value="" />
          </>
        ) : (
          <>
            <FormField label="Leistung ab" name="service_date" type="date" defaultValue={values.serviceDate ?? ""} error={errors.service_date} />
            <FormField label="Leistung bis" name="service_end_date" type="date" defaultValue={values.serviceEndDate ?? ""} error={errors.service_end_date} />
            <FormField label="Fällig am" name="due_date" type="date" defaultValue={values.dueDate ?? ""} hint="Leer = Zahlungsziel" error={errors.due_date} />
            <input type="hidden" name="valid_until" value="" />
          </>
        )}
      </div>
      <Textarea label="Einleitungstext" name="intro_text" defaultValue={values.introText} maxLength={2000} rows={2} />
      <Textarea label="Schlusstext" name="closing_text" defaultValue={values.closingText} maxLength={2000} rows={2} />
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>
          Kopfdaten speichern
        </Button>
      </div>
    </form>
  );
}

export type LineValues = { id: string; title: string; description: string | null; quantity: number; unit: string; unitPrice: number; discountPercent: number; taxRate: number };

export function LineForm({
  tenantId,
  documentId,
  values,
  articles,
  defaultTaxRate,
}: {
  tenantId: string;
  documentId: string;
  values?: LineValues;
  articles?: { id: string; name: string; description: string | null; unit: string; unitPrice: number; taxRate: number }[];
  defaultTaxRate: number;
}) {
  const { state, isPending, formRef, onSubmit } = useFormAction(lineAction, IDLE, { resetOnSuccess: !values });
  const errors = state.fieldErrors ?? {};
  const articleRef = useRef<HTMLInputElement>(null);
  const fill = (articleId: string) => {
    const article = articles?.find((entry) => entry.id === articleId);
    const form = formRef.current;
    if (!article || !form) return;
    const set = (name: string, value: string) => {
      const input = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
      if (input) input.value = value;
    };
    set("title", article.name);
    set("description", article.description ?? "");
    set("unit", article.unit);
    set("unit_price", de(article.unitPrice));
    set("tax_rate", String(article.taxRate));
    if (articleRef.current) articleRef.current.value = article.id;
  };
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-2" noValidate aria-label={values ? `Position ${values.title}` : "Neue Position"}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="documentId" value={documentId} />
      {values && <input type="hidden" name="lineId" value={values.id} />}
      <input type="hidden" name="articleId" ref={articleRef} defaultValue="" />
      {!values && articles && articles.length > 0 && (
        <NativeSelect label="Aus Artikel übernehmen" name="article_pick" defaultValue="" onChange={(event) => fill(event.currentTarget.value)}>
          <option value="">– freie Position –</option>
          {articles.map((article) => (
            <option key={article.id} value={article.id}>
              {article.name}
            </option>
          ))}
        </NativeSelect>
      )}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,3fr)_repeat(5,minmax(0,1fr))]">
        <FormField label="Bezeichnung" name="title" defaultValue={values?.title} maxLength={300} error={errors.title} />
        <FormField label="Menge" name="quantity" inputMode="decimal" defaultValue={de(values?.quantity ?? 1, 3)} error={errors.quantity} />
        <FormField label="Einheit" name="unit" defaultValue={values?.unit ?? "Stück"} maxLength={20} error={errors.unit} />
        <FormField label="Einzelpreis (€)" name="unit_price" inputMode="decimal" defaultValue={de(values?.unitPrice ?? null)} error={errors.unit_price} />
        <FormField label="Rabatt %" name="discount_percent" inputMode="decimal" defaultValue={values?.discountPercent ? de(values.discountPercent) : ""} error={errors.discount_percent} />
        <NativeSelect label="USt" name="tax_rate" defaultValue={String(values?.taxRate ?? defaultTaxRate)} error={errors.tax_rate}>
          {TAX_RATES.map((rate) => (
            <option key={rate} value={rate}>
              {rate} %
            </option>
          ))}
        </NativeSelect>
      </div>
      <FormField label="Beschreibung" name="description" defaultValue={values?.description ?? ""} maxLength={2000} error={errors.description} />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant={values ? "outline" : "default"} disabled={isPending}>
          {values ? "Position speichern" : "Position hinzufügen"}
        </Button>
        {state.status === "error" && state.message && <span className="text-xs text-negative">{state.message}</span>}
      </div>
    </form>
  );
}

export function LineButtons({ tenantId, documentId, lineId, title, first, last }: { tenantId: string; documentId: string; lineId: string; title: string; first: boolean; last: boolean }) {
  return (
    <span className="flex gap-1">
      <ActionButton action={lineAction} fields={{ tenantId, documentId, lineId, intent: "up" }} label={`${title} nach oben`} disabled={first}>
        <ArrowUp className="size-4" aria-hidden />
      </ActionButton>
      <ActionButton action={lineAction} fields={{ tenantId, documentId, lineId, intent: "down" }} label={`${title} nach unten`} disabled={last}>
        <ArrowDown className="size-4" aria-hidden />
      </ActionButton>
      <ActionButton action={lineAction} fields={{ tenantId, documentId, lineId, intent: "delete" }} label={`Position ${title} entfernen`} className="text-negative hover:text-negative">
        <Trash2 className="size-4" aria-hidden />
      </ActionButton>
    </span>
  );
}

export function WorkflowButton({
  tenantId,
  documentId,
  intent,
  children,
  confirm,
  variant = "outline",
}: {
  tenantId: string;
  documentId: string;
  intent: string;
  children: React.ReactNode;
  confirm?: string;
  variant?: "default" | "outline" | "ghost";
}) {
  return (
    <ActionButton action={documentWorkflowAction} fields={{ tenantId, documentId, intent }} confirm={confirm} variant={variant}>
      {children}
    </ActionButton>
  );
}

export function IssueButton({ tenantId, documentId, label }: { tenantId: string; documentId: string; label: string }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(documentWorkflowAction, IDLE);
  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        if (window.confirm(`${label}? Danach ist der Beleg unveränderlich und erhält seine endgültige Nummer.`)) onSubmit(event);
        else event.preventDefault();
      }}
      className="flex flex-col gap-1"
    >
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="intent" value="issue" />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Wird ausgestellt …" : label}
      </Button>
      <FormMessage status={state.status} message={state.message} />
    </form>
  );
}

export function DeleteDraftButton({ tenantId, documentId }: { tenantId: string; documentId: string }) {
  return (
    <ActionButton action={deleteDocumentAction} fields={{ tenantId, documentId }} confirm="Entwurf löschen?" className="text-negative hover:text-negative">
      Entwurf löschen
    </ActionButton>
  );
}

export function PaymentForm({ tenantId, documentId, open, today }: { tenantId: string; documentId: string; open: number; today: string }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(documentWorkflowAction, IDLE, { resetOnSuccess: true });
  const errors = state.fieldErrors ?? {};
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-end gap-2" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="intent" value="payment" />
      <div className="w-32">
        <FormField label="Betrag (€)" name="amount" inputMode="decimal" defaultValue={de(open)} error={errors.amount} />
      </div>
      <FormField label="Eingang am" name="paid_on" type="date" defaultValue={today} error={errors.paid_on} />
      <NativeSelect label="Art" name="method" defaultValue="transfer">
        {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </NativeSelect>
      <div className="min-w-32 flex-1">
        <FormField label="Notiz" name="note" maxLength={500} />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        Zahlung erfassen
      </Button>
      <div className="basis-full empty:hidden">
        <FormMessage status={state.status} message={state.message} />
      </div>
    </form>
  );
}

export function DeletePaymentButton({ tenantId, documentId, paymentId }: { tenantId: string; documentId: string; paymentId: string }) {
  return (
    <ActionButton action={documentWorkflowAction} fields={{ tenantId, documentId, paymentId, intent: "delete_payment" }} label="Zahlung löschen" confirm="Zahlung löschen?" className="text-muted-foreground">
      <Trash2 className="size-3.5" aria-hidden />
    </ActionButton>
  );
}

export function CancelInvoiceForm({ tenantId, documentId }: { tenantId: string; documentId: string }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(documentWorkflowAction, IDLE);
  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        if (window.confirm("Rechnung stornieren? Es wird eine Stornorechnung mit negativen Beträgen ausgestellt.")) onSubmit(event);
        else event.preventDefault();
      }}
      className="flex flex-wrap items-end gap-2"
      noValidate
    >
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="intent" value="cancel" />
      <div className="min-w-48 flex-1">
        <FormField label="Grund für das Storno" name="reason" maxLength={500} placeholder="z. B. falscher Rechnungsbetrag" />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={isPending} className="text-negative">
        Stornieren
      </Button>
      <div className="basis-full empty:hidden">
        <FormMessage status={state.status} message={state.message} />
      </div>
    </form>
  );
}
