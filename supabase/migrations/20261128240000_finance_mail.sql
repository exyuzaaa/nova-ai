-- =============================================================================
-- NOVA Finanzen – Belegversand per Gmail (Plattform-Phase 3a-2)
-- -----------------------------------------------------------------------------
--   * Jedes Unternehmen verbindet sein eigenes Gmail-/Google-Workspace-Konto (OAuth,
--     nur Recht „E-Mails senden“). Gespeichert wird nur das verschlüsselte
--     Refresh-Token; der Schlüssel liegt ausschließlich auf dem Server (Vercel).
--   * Das Token ist für Nutzer nicht lesbar (Spaltenrechte); nur die Versand-
--     funktion des Servers erhält es nach Rechteprüfung, und auch dann nur
--     verschlüsselt.
--   * Jeder Versand wird je Beleg protokolliert (Empfänger, Betreff, Zeitpunkt).
-- =============================================================================

create table finance.mail_accounts (
  tenant_id         uuid primary key references core.tenants(id) on delete cascade,
  provider          text not null default 'gmail' check (provider in ('gmail')),
  email             text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 320),
  refresh_token_enc text not null check (char_length(refresh_token_enc) <= 4000),
  connected_by      uuid references auth.users(id) on delete set null default auth.uid(),
  connected_at      timestamptz not null default now(),
  last_used_at      timestamptz,
  last_error        text check (char_length(last_error) <= 500)
);
create index mail_accounts_connected_by_idx on finance.mail_accounts (connected_by);

create table finance.document_emails (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  document_id uuid not null,
  sent_from   text not null check (char_length(sent_from) <= 320),
  recipients  text[] not null check (cardinality(recipients) between 1 and 10),
  cc          text[] not null default '{}' check (cardinality(cc) <= 10),
  subject     text not null check (char_length(subject) between 1 and 300),
  message_id  text check (char_length(message_id) <= 200),
  sent_by     uuid references auth.users(id) on delete set null default auth.uid(),
  sent_at     timestamptz not null default now(),
  foreign key (tenant_id, document_id) references finance.documents(tenant_id, id) on delete cascade
);
create index document_emails_document_idx on finance.document_emails (tenant_id, document_id, sent_at desc);
create index document_emails_sent_by_idx on finance.document_emails (sent_by);

-- -----------------------------------------------------------------------------
-- Funktionen
-- -----------------------------------------------------------------------------
-- Konto verbinden (ersetzt eine bestehende Verbindung)
create or replace function finance.connect_mail_account(p_tenant uuid, p_email text, p_token_enc text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not core.can(p_tenant, 'finance.manage') then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  insert into finance.mail_accounts (tenant_id, provider, email, refresh_token_enc, connected_by, connected_at, last_used_at, last_error)
  values (p_tenant, 'gmail', lower(btrim(p_email)), p_token_enc, (select auth.uid()), now(), null, null)
  on conflict (tenant_id) do update set email = excluded.email, refresh_token_enc = excluded.refresh_token_enc,
    connected_by = excluded.connected_by, connected_at = excluded.connected_at, last_used_at = null, last_error = null;
  perform core.log_audit(p_tenant, 'finance.mail.connect', 'mail_accounts', null, jsonb_build_object('email', lower(btrim(p_email))));
end $$;

-- Verbindung trennen; gibt das verschlüsselte Token zurück, damit der Server es bei Google widerrufen kann
create or replace function finance.disconnect_mail_account(p_tenant uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_token text;
  v_email text;
begin
  if not core.can(p_tenant, 'finance.manage') then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  delete from finance.mail_accounts where tenant_id = p_tenant returning refresh_token_enc, email into v_token, v_email;
  if v_email is not null then
    perform core.log_audit(p_tenant, 'finance.mail.disconnect', 'mail_accounts', null, jsonb_build_object('email', v_email));
  end if;
  return v_token;
end $$;

-- Zugang zum Versand eines bestimmten Belegs (Rechte wie beim Ausstellen)
create or replace function finance.mail_credentials(p_document uuid)
returns table (email text, refresh_token_enc text) language plpgsql security definer set search_path = '' as $$
declare
  v_doc finance.documents;
begin
  select * into v_doc from finance.documents where id = p_document;
  if not found or not core.can(v_doc.tenant_id, 'finance.view') then
    raise exception 'Beleg nicht gefunden' using errcode = 'P0002';
  end if;
  if not core.can(v_doc.tenant_id, case when v_doc.kind = 'quote' then 'finance.edit' else 'finance.issue' end) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if v_doc.status = 'draft' then
    raise exception 'Entwürfe können nicht versendet werden. Bitte zuerst ausstellen' using errcode = '22023';
  end if;
  return query select a.email, a.refresh_token_enc from finance.mail_accounts a where a.tenant_id = v_doc.tenant_id;
end $$;

-- Ergebnis eines Versands festhalten
create or replace function finance.record_document_email(p_document uuid, p_from text, p_to text[], p_cc text[], p_subject text, p_message_id text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_doc finance.documents;
  v_id  uuid;
begin
  select * into v_doc from finance.documents where id = p_document;
  if not found or not core.can(v_doc.tenant_id, case when v_doc.kind = 'quote' then 'finance.edit' else 'finance.issue' end)
     or v_doc.status = 'draft' then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  insert into finance.document_emails (tenant_id, document_id, sent_from, recipients, cc, subject, message_id)
  values (v_doc.tenant_id, p_document, p_from, p_to, coalesce(p_cc, '{}'), p_subject, nullif(btrim(p_message_id), ''))
  returning id into v_id;
  update finance.mail_accounts set last_used_at = now(), last_error = null where tenant_id = v_doc.tenant_id;
  perform core.log_audit(v_doc.tenant_id, 'finance.documents.email', 'documents', p_document::text,
    jsonb_build_object('number', v_doc.number, 'to', array_to_string(p_to, ', ')));
  return v_id;
end $$;

-- Fehler beim Versand (z. B. Zugriff bei Google widerrufen) für die Einstellungen sichtbar machen
create or replace function finance.record_mail_error(p_document uuid, p_error text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from finance.documents where id = p_document;
  if v_tenant is null or not (core.can(v_tenant, 'finance.edit') or core.can(v_tenant, 'finance.issue')) then
    return;
  end if;
  update finance.mail_accounts set last_error = left(p_error, 500) where tenant_id = v_tenant;
end $$;

-- -----------------------------------------------------------------------------
-- Row Level Security und Rechte
-- -----------------------------------------------------------------------------
alter table finance.mail_accounts enable row level security;
alter table finance.document_emails enable row level security;

create policy mail_accounts_select on finance.mail_accounts for select to authenticated using (core.can(tenant_id, 'finance.view'));
create policy document_emails_select on finance.document_emails for select to authenticated using (core.can(tenant_id, 'finance.view'));

-- Spaltenrechte: das (verschlüsselte) Token ist für Nutzer nie direkt lesbar
grant select (tenant_id, provider, email, connected_at, last_used_at, last_error) on finance.mail_accounts to authenticated;
grant select on finance.document_emails to authenticated;
grant all on finance.mail_accounts, finance.document_emails to service_role;

revoke all on function finance.connect_mail_account(uuid, text, text), finance.disconnect_mail_account(uuid),
  finance.mail_credentials(uuid), finance.record_document_email(uuid, text, text[], text[], text, text),
  finance.record_mail_error(uuid, text) from public, anon;
grant execute on function finance.connect_mail_account(uuid, text, text), finance.disconnect_mail_account(uuid),
  finance.mail_credentials(uuid), finance.record_document_email(uuid, text, text[], text[], text, text),
  finance.record_mail_error(uuid, text) to authenticated;
