"use server";

import { refresh } from "next/cache";
import { createSupabaseServerClient, financeSchema } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/server/session";
import { fieldErrors } from "@/modules/auth/domain/validation";
import { uuidSchema } from "@/modules/core/domain/tenant-validation";
import { databaseMessage, failure, FORBIDDEN, formValue, type ActionState } from "@/modules/core/server/action-state";
import { getTenantWithPermission } from "@/modules/core/server/permissions";
import { buildMime, sendMailSchema, toBase64Url } from "../../domain/mail";
import { getDocument, getSettings } from "../finance";
import { GmailError, revokeToken, sendRawMessage } from "../gmail";
import { buildDocumentPdf } from "../pdf";

/* Belegversand über das verbundene Gmail-Postfach des Unternehmens. */

const db = async () => financeSchema(await createSupabaseServerClient());

export async function disconnectGmailAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "finance.manage");
  if (!tenant) return failure(FORBIDDEN);
  const { data, error } = await (await db()).rpc("disconnect_mail_account", { p_tenant: tenant.id });
  if (error) return failure(databaseMessage(error));
  if (data) await revokeToken(data);
  refresh();
  return { status: "success", message: "Gmail getrennt." };
}

export async function sendDocumentEmailAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "finance.view");
  const documentId = formValue(formData, "documentId");
  if (!tenant || !uuidSchema.safeParse(documentId).success) return failure(FORBIDDEN);
  const parsed = sendMailSchema.safeParse({
    to: formValue(formData, "to"),
    cc: formValue(formData, "cc"),
    subject: formValue(formData, "subject"),
    message: formValue(formData, "message"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const client = await db();
  // Prüft Recht (Angebote: bearbeiten, sonst ausstellen) und Status; liefert das verschlüsselte Token
  const { data: credentials, error } = await client.rpc("mail_credentials", { p_document: documentId });
  if (error) {
    if (error.code === "22023" && error.message) return failure(`${error.message}.`);
    return failure(error.code === "42501" ? "Dir fehlt das Recht, diesen Beleg zu versenden." : databaseMessage(error));
  }
  const account = credentials?.[0];
  if (!account) return failure("Es ist noch kein Gmail-Konto verbunden (Finanzen → Einstellungen).");

  const doc = await getDocument(tenant.id, documentId);
  if (!doc || !doc.number) return failure(FORBIDDEN);
  const pdf = await buildDocumentPdf(doc, doc.seller ? null : await getSettings(tenant.id));
  const sellerName = typeof doc.seller?.legal_name === "string" ? doc.seller.legal_name : tenant.name;
  const raw = buildMime({
    from: { name: sellerName, address: account.email },
    to: parsed.data.to,
    cc: parsed.data.cc,
    subject: parsed.data.subject,
    text: parsed.data.message,
    attachment: { filename: `${doc.number}.pdf`, contentType: "application/pdf", content: pdf },
  });

  let messageId: string | null;
  try {
    messageId = await sendRawMessage(account.refresh_token_enc, toBase64Url(raw));
  } catch (cause) {
    const message = cause instanceof GmailError ? cause.message : "Der Versand über Gmail ist fehlgeschlagen. Bitte später erneut versuchen.";
    await client.rpc("record_mail_error", { p_document: documentId, p_error: message });
    if (cause instanceof GmailError && cause.reconnect) refresh();
    return failure(message);
  }

  const { error: logError } = await client.rpc("record_document_email", {
    p_document: documentId,
    p_from: account.email,
    p_to: parsed.data.to,
    p_cc: parsed.data.cc,
    p_subject: parsed.data.subject,
    p_message_id: messageId ?? "",
  });
  refresh();
  if (logError) return { status: "success", message: "E-Mail gesendet (das Versandprotokoll konnte nicht gespeichert werden)." };
  return { status: "success", message: `E-Mail an ${parsed.data.to.join(", ")} gesendet.` };
}
