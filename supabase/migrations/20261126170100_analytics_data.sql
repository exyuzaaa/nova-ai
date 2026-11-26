-- =============================================================================
-- NOVA ANALYTICS – Analysedaten: Events, Sessions, Aggregate, Ziele, Funnels,
-- Kampagnen, Leads, Berichte, Dashboards, Integrationen, KI-Protokoll
-- -----------------------------------------------------------------------------
-- Rohdaten und Aggregate werden ausschließlich serverseitig (service_role)
-- geschrieben. Nutzer lesen über RLS nur die Websites ihrer Organisationen.
-- =============================================================================

-- =============================================================================
-- 3. Rohdaten: Events und Sessions (monatlich partitioniert)
-- =============================================================================
create table analytics.analytics_events (
  id               uuid not null default gen_random_uuid(),
  occurred_at      timestamptz not null,
  received_at      timestamptz not null default now(),
  website_id       uuid not null,
  organization_id  uuid not null,                    -- denormalisiert für schnelle Mandantenfilter
  session_id       uuid not null,
  visitor_hash     bytea not null,                   -- pseudonym, niemals IP
  visitor_id_type  analytics.visitor_id_type not null,
  event_type       text not null check (event_type in (
                     'pageview', 'engagement', 'custom', 'outbound_click', 'download',
                     'form_start', 'form_submit', 'scroll', 'phone_click', 'email_click')),
  event_name       text not null check (char_length(event_name) between 1 and 80),
  hostname         text not null,
  pathname         text not null check (char_length(pathname) <= 2048),
  referrer_host    text,
  referrer_path    text,
  channel          analytics.traffic_channel not null default 'unassigned',
  utm_source       text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  click_id_type    text,                             -- 'gclid' | 'msclkid' | 'fbclid' … (Wert wird NICHT gespeichert)
  country_code     char(2),
  region_code      text,
  city             text,                             -- nur bei geo_granularity = 'city'
  device_type      text check (device_type in ('desktop', 'mobile', 'tablet', 'other')),
  browser          text,
  os               text,
  engagement_ms    integer check (engagement_ms >= 0),
  scroll_depth     smallint check (scroll_depth between 0 and 100),
  props            jsonb not null default '{}',      -- bereinigt, PII-geprüft, max. 30 Keys
  primary key (id, occurred_at)
) partition by range (occurred_at);

create index analytics_events_site_time_idx on analytics.analytics_events (website_id, occurred_at desc);
create index analytics_events_site_name_time_idx on analytics.analytics_events (website_id, event_name, occurred_at desc);
create index analytics_events_session_idx on analytics.analytics_events (session_id);

create table analytics.analytics_sessions (
  id                uuid not null,
  started_at        timestamptz not null,
  last_activity_at  timestamptz not null,
  website_id        uuid not null,
  organization_id   uuid not null,
  visitor_hash      bytea not null,
  visitor_id_type   analytics.visitor_id_type not null,
  is_new_visitor    boolean,                         -- NULL im cookieless-Modus (nicht bestimmbar)
  entry_path        text not null,
  exit_path         text,
  pageviews         integer not null default 0,
  events            integer not null default 0,
  engagement_ms     bigint not null default 0,
  is_bounce         boolean,                         -- wird beim Session-Abschluss gesetzt
  channel           analytics.traffic_channel not null default 'unassigned',
  referrer_host     text,
  utm_source        text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  country_code      char(2), region_code text, city text,
  device_type       text, browser text, os text,
  conversion_count  integer not null default 0,
  closed_at         timestamptz,
  primary key (id, started_at)
) partition by range (started_at);

create index analytics_sessions_site_time_idx on analytics.analytics_sessions (website_id, started_at desc);
create index analytics_sessions_site_visitor_idx on analytics.analytics_sessions (website_id, visitor_hash, started_at desc);
create index analytics_sessions_open_idx on analytics.analytics_sessions (last_activity_at) where closed_at is null;

-- =============================================================================
-- 4. Aggregate (serverseitig berechnet, Grundlage aller Dashboards)
-- =============================================================================
-- Stündliche Gesamtwerte (UTC) – Echtzeit-/Heute-Ansichten
create table analytics.analytics_hourly (
  website_id       uuid not null references analytics.websites(id) on delete cascade,
  hour_start       timestamptz not null,
  visitors         integer not null default 0,
  sessions         integer not null default 0,
  pageviews        integer not null default 0,
  events           integer not null default 0,
  bounces          integer not null default 0,
  engagement_ms    bigint  not null default 0,
  conversions      integer not null default 0,
  computed_at      timestamptz not null default now(),
  primary key (website_id, hour_start)
);

-- Tägliche Werte je Dimension (Tag in der Zeitzone der Website).
-- dimension = 'total' / dimension_value = '' für Gesamtwerte.
-- Hinweis: "visitors" ist über mehrere Tage NICHT additiv; Zeitraum-Unique-
-- Visitors werden aus analytics_sessions berechnet (siehe Architektur §5.4).
create table analytics.analytics_daily (
  website_id         uuid not null references analytics.websites(id) on delete cascade,
  day                date not null,
  dimension          text not null check (dimension in (
                       'total', 'page', 'entry_page', 'exit_page', 'channel', 'source', 'referrer',
                       'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
                       'country', 'region', 'city', 'device', 'browser', 'os', 'event', 'goal')),
  dimension_value    text not null default '',
  visitors           integer not null default 0,
  new_visitors       integer,                        -- NULL, wenn nicht bestimmbar (cookieless)
  returning_visitors integer,
  sessions           integer not null default 0,
  pageviews          integer not null default 0,
  entries            integer not null default 0,
  exits              integer not null default 0,
  bounces            integer not null default 0,
  engagement_ms      bigint  not null default 0,
  events             integer not null default 0,
  conversions        integer not null default 0,
  conversion_value_cents bigint not null default 0,
  computed_at        timestamptz not null default now(),
  primary key (website_id, day, dimension, dimension_value)
);
create index analytics_daily_dim_idx on analytics.analytics_daily (website_id, dimension, day desc);

-- =============================================================================
-- 5. Kampagnen, Custom Events, Ziele, Conversions, Funnels
-- =============================================================================
create table analytics.campaigns (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references analytics.organizations(id) on delete cascade,
  website_id      uuid references analytics.websites(id) on delete cascade,
  name            text not null,
  match_utm_campaign text not null,                  -- Zuordnung über utm_campaign (case-insensitiv)
  match_utm_source   text,
  match_utm_medium   text,
  starts_on       date,
  ends_on         date,
  budget_cents    bigint check (budget_cents >= 0),
  currency        char(3) not null default 'EUR',
  status          text not null default 'active' check (status in ('draft', 'active', 'paused', 'ended')),
  notes           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index campaigns_org_idx on analytics.campaigns (organization_id);
create trigger campaigns_updated_at before update on analytics.campaigns
  for each row execute function analytics.set_updated_at();

create table analytics.campaign_costs (
  campaign_id uuid not null references analytics.campaigns(id) on delete cascade,
  day         date not null,
  cost_cents  bigint not null check (cost_cents >= 0),
  source      text not null default 'manual' check (source in ('manual', 'import', 'integration')),
  primary key (campaign_id, day, source)
);

-- Register der Custom-Event-Namen je Website (automatisch entdeckt, begrenzt)
create table analytics.custom_events (
  website_id         uuid not null references analytics.websites(id) on delete cascade,
  event_name         text not null,
  display_name       text,
  description        text,
  allowed_properties text[],                         -- NULL = alle (bereinigten) Properties zulassen
  is_blocked         boolean not null default false,
  first_seen_at      timestamptz not null default now(),
  last_seen_at       timestamptz not null default now(),
  primary key (website_id, event_name)
);

create table analytics.conversion_goals (
  id                 uuid primary key default gen_random_uuid(),
  website_id         uuid not null references analytics.websites(id) on delete cascade,
  name               text not null,
  template_key       text,                           -- z. B. 'contact_form_submitted', 'phone_click', 'purchase'
  goal_type          text not null check (goal_type in (
                       'event', 'pageview', 'outbound_click', 'phone_click', 'email_click', 'form_submit', 'download')),
  match_event_name   text,
  match_path         text,
  match_operator     analytics.match_operator not null default 'equals',
  property_filters   jsonb not null default '[]',
  value_cents        bigint check (value_cents >= 0),
  once_per_session   boolean not null default true,
  is_active          boolean not null default true,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  archived_at        timestamptz,
  check (match_operator <> 'regex' or char_length(coalesce(match_path, '')) <= 200),
  check (goal_type <> 'event' or match_event_name is not null),
  check (goal_type <> 'pageview' or match_path is not null)
);
create index conversion_goals_site_idx on analytics.conversion_goals (website_id) where archived_at is null;
create trigger conversion_goals_updated_at before update on analytics.conversion_goals
  for each row execute function analytics.set_updated_at();

create table analytics.conversion_events (
  id              uuid primary key default gen_random_uuid(),
  goal_id         uuid not null references analytics.conversion_goals(id) on delete cascade,
  website_id      uuid not null references analytics.websites(id) on delete cascade,
  organization_id uuid not null,
  event_id        uuid not null,                     -- auslösendes analytics_events.id
  session_id      uuid not null,
  visitor_hash    bytea not null,
  occurred_at     timestamptz not null,
  value_cents     bigint,
  -- Attribution zum Zeitpunkt der Conversion (Kopie aus der Session)
  channel         analytics.traffic_channel not null,
  utm_source      text, utm_medium text, utm_campaign text,
  referrer_host   text,
  landing_path    text,
  page_path       text,
  unique (goal_id, event_id)                         -- Idempotenz bei Wiederholungen
);
create index conversion_events_site_time_idx on analytics.conversion_events (website_id, occurred_at desc);
create index conversion_events_goal_time_idx on analytics.conversion_events (goal_id, occurred_at desc);
create index conversion_events_session_idx on analytics.conversion_events (session_id);

create table analytics.funnel_definitions (
  id             uuid primary key default gen_random_uuid(),
  website_id     uuid not null references analytics.websites(id) on delete cascade,
  name           text not null,
  description    text,
  window_type    text not null default 'session' check (window_type in ('session', 'duration')),
  window_seconds integer check (window_seconds is null or window_seconds between 60 and 2592000),
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  archived_at    timestamptz,
  check (window_type <> 'duration' or window_seconds is not null)
);
create trigger funnel_definitions_updated_at before update on analytics.funnel_definitions
  for each row execute function analytics.set_updated_at();

create table analytics.funnel_steps (
  id               uuid primary key default gen_random_uuid(),
  funnel_id        uuid not null references analytics.funnel_definitions(id) on delete cascade,
  position         smallint not null check (position between 1 and 10),
  name             text not null,
  step_type        text not null check (step_type in ('pageview', 'event', 'goal')),
  match_path       text,
  match_operator   analytics.match_operator not null default 'equals',
  event_name       text,
  goal_id          uuid references analytics.conversion_goals(id) on delete restrict,
  property_filters jsonb not null default '[]',
  unique (funnel_id, position),
  check (step_type <> 'pageview' or match_path is not null),
  check (step_type <> 'event' or event_name is not null),
  check (step_type <> 'goal' or goal_id is not null)
);

-- =============================================================================
-- 6. CRM-Verknüpfung (Leads ↔ Traffic)
-- =============================================================================
-- Referenziert Leads im bestehenden NOVA CRM über deren ID (Typ nach Repo-Analyse
-- festlegen; ggf. echter Fremdschlüssel). Keine Kopie von Kontaktdaten.
create table analytics.lead_attributions (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references analytics.organizations(id) on delete cascade,
  website_id          uuid references analytics.websites(id) on delete set null,
  crm_lead_id         text not null,
  attribution_model   text not null default 'last_non_direct'
                        check (attribution_model in ('first_touch', 'last_touch', 'last_non_direct')),
  session_id          uuid,
  goal_id             uuid references analytics.conversion_goals(id) on delete set null,
  channel             analytics.traffic_channel,
  utm_source          text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  referrer_host       text,
  landing_path        text,
  conversion_path     text,
  lead_created_at     timestamptz not null,
  crm_status          text,
  crm_status_changed_at timestamptz,
  appointment_at      timestamptz,
  became_customer_at  timestamptz,
  deal_value_cents    bigint,
  synced_at           timestamptz not null default now(),
  unique (organization_id, crm_lead_id, attribution_model)
);
create index lead_attributions_site_time_idx on analytics.lead_attributions (website_id, lead_created_at desc);
create index lead_attributions_campaign_idx on analytics.lead_attributions (organization_id, utm_campaign);

-- =============================================================================
-- 7. Berichte, Dashboards, Integrationen, KI, Audit, Löschaufträge
-- =============================================================================
create table analytics.report_definitions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references analytics.organizations(id) on delete cascade,
  website_ids     uuid[] not null,
  name            text not null,
  template        jsonb not null,                    -- Abschnitte/Widgets (validiert per Zod)
  period          text not null check (period in ('daily', 'weekly', 'monthly', 'custom')),
  formats         text[] not null default '{pdf}' check (formats <@ array['pdf', 'csv', 'xlsx']),
  schedule_cron   text,                              -- NULL = nur manuell
  timezone        text not null default 'Europe/Berlin',
  recipients      text[] not null default '{}',
  white_label     boolean not null default false,
  is_active       boolean not null default true,
  next_run_at     timestamptz,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index report_definitions_due_idx on analytics.report_definitions (next_run_at) where is_active and schedule_cron is not null;
create trigger report_definitions_updated_at before update on analytics.report_definitions
  for each row execute function analytics.set_updated_at();

create table analytics.report_runs (
  id            uuid primary key default gen_random_uuid(),
  report_id     uuid not null references analytics.report_definitions(id) on delete cascade,
  period_start  date not null,
  period_end    date not null,
  status        text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  files         jsonb not null default '[]',         -- Storage-Pfade (privater Bucket, signierte URLs)
  error         text,
  sent_count    integer not null default 0,
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (report_id, period_start, period_end)       -- verhindert Doppelversand
);

create table analytics.dashboard_layouts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references analytics.organizations(id) on delete cascade,
  website_id      uuid references analytics.websites(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,  -- NULL = für die Organisation
  name            text not null,
  layout          jsonb not null,
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger dashboard_layouts_updated_at before update on analytics.dashboard_layouts
  for each row execute function analytics.set_updated_at();

create table analytics.analytics_integrations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references analytics.organizations(id) on delete cascade,
  website_id      uuid references analytics.websites(id) on delete cascade,
  provider        text not null check (provider in (
                    'nova_crm', 'posthog', 'google_search_console', 'slack', 'webhook', 'email')),
  status          text not null default 'pending' check (status in ('pending', 'active', 'error', 'disabled')),
  config          jsonb not null default '{}',       -- NUR nicht-geheime Konfiguration
  vault_secret_id uuid,                              -- Verweis auf Supabase Vault (vault.secrets)
  last_sync_at    timestamptz,
  last_error      text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger analytics_integrations_updated_at before update on analytics.analytics_integrations
  for each row execute function analytics.set_updated_at();

create table analytics.ai_query_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references analytics.organizations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,
  website_ids     uuid[] not null,
  question        text not null,
  tool_calls      jsonb not null default '[]',       -- welche Abfragen mit welchen Parametern
  answer          text,
  unverified_numbers jsonb not null default '[]',    -- Ergebnis der Zahlenprüfung
  model           text,
  created_at      timestamptz not null default now()
);
create index ai_query_logs_org_time_idx on analytics.ai_query_logs (organization_id, created_at desc);

create table analytics.data_deletion_requests (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references analytics.organizations(id) on delete cascade,
  website_id      uuid references analytics.websites(id) on delete cascade,
  scope           text not null check (scope in ('visitor', 'website', 'organization', 'date_range')),
  params          jsonb not null default '{}',
  status          text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  requested_by    uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table analytics.analytics_events enable row level security;
alter table analytics.analytics_sessions enable row level security;
alter table analytics.analytics_hourly enable row level security;
alter table analytics.analytics_daily enable row level security;
alter table analytics.campaigns enable row level security;
alter table analytics.campaign_costs enable row level security;
alter table analytics.custom_events enable row level security;
alter table analytics.conversion_goals enable row level security;
alter table analytics.conversion_events enable row level security;
alter table analytics.funnel_definitions enable row level security;
alter table analytics.funnel_steps enable row level security;
alter table analytics.lead_attributions enable row level security;
alter table analytics.report_definitions enable row level security;
alter table analytics.report_runs enable row level security;
alter table analytics.dashboard_layouts enable row level security;
alter table analytics.analytics_integrations enable row level security;
alter table analytics.ai_query_logs enable row level security;
alter table analytics.data_deletion_requests enable row level security;

-- Rohdaten & Aggregate: nur lesen
create policy events_select on analytics.analytics_events for select to authenticated
  using (website_id in (select analytics.accessible_website_ids('viewer')));
create policy sessions_select on analytics.analytics_sessions for select to authenticated
  using (website_id in (select analytics.accessible_website_ids('viewer')));
create policy hourly_select on analytics.analytics_hourly for select to authenticated
  using (website_id in (select analytics.accessible_website_ids('viewer')));
create policy daily_select on analytics.analytics_daily for select to authenticated
  using (website_id in (select analytics.accessible_website_ids('viewer')));
create policy conversion_events_select on analytics.conversion_events for select to authenticated
  using (website_id in (select analytics.accessible_website_ids('viewer')));

-- Konfiguration ab Analyst
create policy campaigns_select on analytics.campaigns for select to authenticated
  using (analytics.has_org_role(organization_id, 'viewer')
         and (website_id is null or website_id in (select analytics.accessible_website_ids('viewer'))));
create policy campaigns_write on analytics.campaigns for all to authenticated
  using (analytics.has_org_role(organization_id, 'analyst'))
  with check (analytics.has_org_role(organization_id, 'analyst')
              and (website_id is null or website_id in (select analytics.accessible_website_ids('analyst'))));

create policy campaign_costs_select on analytics.campaign_costs for select to authenticated
  using (exists (select 1 from analytics.campaigns c where c.id = campaign_id
                 and analytics.has_org_role(c.organization_id, 'viewer')));
create policy campaign_costs_write on analytics.campaign_costs for all to authenticated
  using (exists (select 1 from analytics.campaigns c where c.id = campaign_id
                 and analytics.has_org_role(c.organization_id, 'analyst')))
  with check (exists (select 1 from analytics.campaigns c where c.id = campaign_id
                      and analytics.has_org_role(c.organization_id, 'analyst')));

create policy custom_events_select on analytics.custom_events for select to authenticated
  using (website_id in (select analytics.accessible_website_ids('viewer')));
create policy custom_events_update on analytics.custom_events for update to authenticated
  using (website_id in (select analytics.accessible_website_ids('analyst')))
  with check (website_id in (select analytics.accessible_website_ids('analyst')));

create policy goals_select on analytics.conversion_goals for select to authenticated
  using (website_id in (select analytics.accessible_website_ids('viewer')));
create policy goals_write on analytics.conversion_goals for all to authenticated
  using (website_id in (select analytics.accessible_website_ids('analyst')))
  with check (website_id in (select analytics.accessible_website_ids('analyst')));

create policy funnels_select on analytics.funnel_definitions for select to authenticated
  using (website_id in (select analytics.accessible_website_ids('viewer')));
create policy funnels_write on analytics.funnel_definitions for all to authenticated
  using (website_id in (select analytics.accessible_website_ids('analyst')))
  with check (website_id in (select analytics.accessible_website_ids('analyst')));

create policy funnel_steps_select on analytics.funnel_steps for select to authenticated
  using (exists (select 1 from analytics.funnel_definitions f where f.id = funnel_id
                 and f.website_id in (select analytics.accessible_website_ids('viewer'))));
create policy funnel_steps_write on analytics.funnel_steps for all to authenticated
  using (exists (select 1 from analytics.funnel_definitions f where f.id = funnel_id
                 and f.website_id in (select analytics.accessible_website_ids('analyst'))))
  with check (exists (select 1 from analytics.funnel_definitions f where f.id = funnel_id
                      and f.website_id in (select analytics.accessible_website_ids('analyst'))));

-- Leads (CRM-Bezug) ab Analyst
create policy leads_select on analytics.lead_attributions for select to authenticated
  using (analytics.has_org_role(organization_id, 'analyst')
         and (website_id is null or website_id in (select analytics.accessible_website_ids('analyst'))));

-- Berichte
create policy reports_select on analytics.report_definitions for select to authenticated
  using (analytics.has_org_role(organization_id, 'viewer'));
create policy reports_write on analytics.report_definitions for all to authenticated
  using (analytics.has_org_role(organization_id, 'analyst'))
  with check (analytics.has_org_role(organization_id, 'analyst')
              and website_ids <@ array(select analytics.accessible_website_ids('analyst')));
create policy report_runs_select on analytics.report_runs for select to authenticated
  using (exists (select 1 from analytics.report_definitions r where r.id = report_id
                 and analytics.has_org_role(r.organization_id, 'viewer')));

-- Dashboards: persönliche nur für den Eigentümer, Organisations-Layouts ab Analyst
create policy dashboards_select on analytics.dashboard_layouts for select to authenticated
  using (analytics.has_org_role(organization_id, 'viewer')
         and (user_id is null or user_id = (select auth.uid())));
create policy dashboards_write on analytics.dashboard_layouts for all to authenticated
  using ((user_id = (select auth.uid()) and analytics.has_org_role(organization_id, 'viewer'))
         or (user_id is null and analytics.has_org_role(organization_id, 'analyst')))
  with check ((user_id = (select auth.uid()) and analytics.has_org_role(organization_id, 'viewer'))
              or (user_id is null and analytics.has_org_role(organization_id, 'analyst')));

-- Integrationen, KI-Protokoll, Löschaufträge
create policy integrations_admin on analytics.analytics_integrations for all to authenticated
  using (analytics.has_org_role(organization_id, 'admin'))
  with check (analytics.has_org_role(organization_id, 'admin'));
create policy ai_logs_select on analytics.ai_query_logs for select to authenticated
  using (user_id = (select auth.uid()) or analytics.has_org_role(organization_id, 'admin'));
create policy deletion_admin on analytics.data_deletion_requests for all to authenticated
  using (analytics.has_org_role(organization_id, 'admin'))
  with check (analytics.has_org_role(organization_id, 'admin'));

-- =============================================================================
-- Rechte
-- =============================================================================
revoke all on
  analytics.analytics_events, analytics.analytics_sessions, analytics.analytics_hourly,
  analytics.analytics_daily, analytics.campaigns, analytics.campaign_costs, analytics.custom_events,
  analytics.conversion_goals, analytics.conversion_events, analytics.funnel_definitions,
  analytics.funnel_steps, analytics.lead_attributions, analytics.report_definitions,
  analytics.report_runs, analytics.dashboard_layouts, analytics.analytics_integrations,
  analytics.ai_query_logs, analytics.data_deletion_requests
  from public, anon, authenticated;

grant select on
  analytics.analytics_events, analytics.analytics_sessions, analytics.analytics_hourly,
  analytics.analytics_daily, analytics.campaigns, analytics.campaign_costs, analytics.custom_events,
  analytics.conversion_goals, analytics.conversion_events, analytics.funnel_definitions,
  analytics.funnel_steps, analytics.lead_attributions, analytics.report_definitions,
  analytics.report_runs, analytics.dashboard_layouts, analytics.analytics_integrations,
  analytics.ai_query_logs, analytics.data_deletion_requests
  to authenticated;
grant insert, update, delete on
  analytics.campaigns, analytics.campaign_costs, analytics.conversion_goals,
  analytics.funnel_definitions, analytics.funnel_steps, analytics.report_definitions,
  analytics.dashboard_layouts, analytics.analytics_integrations, analytics.data_deletion_requests
  to authenticated;
grant update (display_name, description, allowed_properties, is_blocked) on analytics.custom_events to authenticated;

grant all on
  analytics.analytics_events, analytics.analytics_sessions, analytics.analytics_hourly,
  analytics.analytics_daily, analytics.campaigns, analytics.campaign_costs, analytics.custom_events,
  analytics.conversion_goals, analytics.conversion_events, analytics.funnel_definitions,
  analytics.funnel_steps, analytics.lead_attributions, analytics.report_definitions,
  analytics.report_runs, analytics.dashboard_layouts, analytics.analytics_integrations,
  analytics.ai_query_logs, analytics.data_deletion_requests
  to service_role;

-- =============================================================================
-- Wartung: Partitionen & Aufbewahrung (Planung per pg_cron ab Phase 5)
-- =============================================================================
create or replace function analytics.ensure_partitions(p_months_ahead int default 3)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_start date;
  v_end   date;
  i       int;
  t       text;
begin
  for i in 0..p_months_ahead loop
    v_start := (date_trunc('month', now()) + make_interval(months => i))::date;
    v_end   := (v_start + interval '1 month')::date;
    foreach t in array array['analytics_events', 'analytics_sessions'] loop
      execute format(
        'create table if not exists analytics.%I partition of analytics.%I for values from (%L) to (%L)',
        t || '_' || to_char(v_start, 'YYYY_MM'), t, v_start, v_end);
    end loop;
  end loop;
end $$;

create or replace function analytics.purge_expired_raw_data()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_max_days int;
  r record;
begin
  select coalesce(max(raw_retention_days), 395) into v_max_days from analytics.tracking_settings;
  for r in
    select c.relname
    from pg_inherits i
    join pg_class c on c.oid = i.inhrelid
    join pg_class p on p.oid = i.inhparent
    join pg_namespace n on n.oid = p.relnamespace
    where n.nspname = 'analytics' and p.relname in ('analytics_events', 'analytics_sessions')
      and to_date(right(c.relname, 7), 'YYYY_MM') + interval '1 month'
          < now() - make_interval(days => v_max_days)
  loop
    execute format('drop table analytics.%I', r.relname);
  end loop;

  delete from analytics.analytics_events e
  using analytics.tracking_settings s
  where s.website_id = e.website_id
    and e.occurred_at < now() - make_interval(days => s.raw_retention_days);

  delete from analytics.analytics_sessions x
  using analytics.tracking_settings s
  where s.website_id = x.website_id
    and x.started_at < now() - make_interval(days => s.raw_retention_days);

  delete from analytics.ai_query_logs where created_at < now() - interval '90 days';
end $$;

revoke execute on function analytics.ensure_partitions(int) from public, anon, authenticated;
revoke execute on function analytics.purge_expired_raw_data() from public, anon, authenticated;
grant execute on function analytics.ensure_partitions(int) to service_role;
grant execute on function analytics.purge_expired_raw_data() to service_role;

select analytics.ensure_partitions(3);
