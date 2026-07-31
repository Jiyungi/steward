begin;

create extension if not exists pgcrypto with schema extensions;

create table public.identities (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.owners (
  id text primary key,
  identity_id uuid references public.identities(id) on delete cascade,
  display_name text not null,
  default_currency text not null default 'USD' check (default_currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.controlled_contacts (
  id text primary key,
  phone_e164 text not null unique check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  label text not null,
  verification_status text not null check (verification_status in ('pending', 'verified', 'revoked')),
  organizer_controlled boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((verification_status = 'verified' and verified_at is not null) or verification_status <> 'verified' or organizer_controlled)
);

create table public.vendors (
  id text primary key,
  identity_id uuid references public.identities(id) on delete set null,
  controlled_contact_id text not null references public.controlled_contacts(id) on delete restrict,
  name text not null,
  service_categories text[] not null default '{}',
  email text,
  active boolean not null default true,
  performance_aggregates jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.role_memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  identity_id uuid not null references public.identities(id) on delete cascade,
  role text not null check (role in ('owner', 'vendor')),
  owner_id text references public.owners(id) on delete cascade,
  vendor_id text references public.vendors(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique nulls not distinct (identity_id, role, owner_id, vendor_id),
  check (
    (role = 'owner' and owner_id is not null and vendor_id is null)
    or (role = 'vendor' and vendor_id is not null and owner_id is null)
  )
);

create table public.properties (
  id text primary key,
  owner_id text not null references public.owners(id) on delete cascade,
  name text not null,
  address jsonb not null default '{}'::jsonb,
  timezone text not null default 'America/Los_Angeles',
  operational_policy jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.demo_guest_sessions (
  id text primary key,
  property_id text not null references public.properties(id) on delete cascade,
  email_hash text not null check (length(email_hash) between 32 and 128),
  verified_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > verified_at)
);

create table public.approved_vendors (
  property_id text not null references public.properties(id) on delete cascade,
  vendor_id text not null references public.vendors(id) on delete cascade,
  priority integer not null default 100 check (priority >= 0),
  policy_notes text,
  created_at timestamptz not null default now(),
  primary key (property_id, vendor_id)
);

create table public.incidents (
  id text primary key,
  property_id text not null references public.properties(id) on delete restrict,
  booking_id text,
  guest_session_id text not null references public.demo_guest_sessions(id) on delete restrict,
  goal text not null,
  state text not null check (state in ('reported','triaging','diagnosing','sourcing','vendor-contacting','scheduled','verification-pending','resolved','failed','escalated')),
  risk text not null check (risk in ('unknown','low','medium','high','emergency')),
  budget_currency text not null check (budget_currency ~ '^[A-Z]{3}$'),
  authorized_minor integer not null check (authorized_minor >= 0),
  spent_minor integer not null default 0 check (spent_minor >= 0 and spent_minor <= authorized_minor),
  selected_vendor_id text references public.vendors(id) on delete set null,
  correlation_id text,
  snapshot jsonb not null,
  lock_version integer not null default 1 check (lock_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.incident_events (
  sequence bigint generated always as identity primary key,
  event_id text not null unique,
  incident_id text not null references public.incidents(id) on delete cascade,
  event_type text not null,
  actor jsonb not null,
  payload jsonb not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index incident_events_order_idx on public.incident_events (incident_id, sequence);

create table public.provider_operations (
  operation_id text primary key,
  incident_id text not null references public.incidents(id) on delete cascade,
  provider text not null check (provider in ('a1mobile','livekit','supabase','stripe','google-places')),
  operation text not null,
  status text not null check (status in ('success','partial','failure','timeout','canceled','unknown')),
  idempotency_key text unique,
  request_summary jsonb not null default '{}'::jsonb,
  normalized_result jsonb,
  started_at timestamptz not null,
  completed_at timestamptz,
  check (completed_at is null or completed_at >= started_at)
);

create table public.evidence_records (
  id text primary key,
  incident_id text not null references public.incidents(id) on delete cascade,
  kind text not null check (kind in ('photo','video-frame','audio','tool-result','message','call-record')),
  summary text not null,
  object_ref text,
  submitted_by text not null,
  verified_by text check (verified_by in ('guest','vendor','agent-vision','tool','owner')),
  created_at timestamptz not null
);

create table public.vendor_calls (
  id text primary key,
  incident_id text not null references public.incidents(id) on delete cascade,
  vendor_id text not null references public.vendors(id) on delete restrict,
  room_name text not null unique,
  sip_participant_id text,
  call_status text not null check (call_status in ('dialing','answered','no-answer','declined','failed','ended','unknown')),
  transcript_ref text,
  started_at timestamptz not null,
  ended_at timestamptz
);

create table public.vendor_quotes (
  incident_id text not null references public.incidents(id) on delete cascade,
  vendor_id text not null references public.vendors(id) on delete restrict,
  source_call_id text not null,
  quote jsonb not null,
  created_at timestamptz not null default now(),
  primary key (incident_id, vendor_id, source_call_id)
);

create table public.payments (
  id text primary key,
  incident_id text not null references public.incidents(id) on delete cascade,
  vendor_id text references public.vendors(id) on delete restrict,
  provider_payment_id text unique,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor integer not null check (amount_minor >= 0),
  status text not null check (status in ('pending','requires-action','processing','succeeded','failed','canceled')),
  idempotency_key text not null unique,
  test_mode boolean not null check (test_mode),
  payment jsonb not null,
  webhook_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.processed_stripe_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null
);

create or replace function public.resolve_incident_with_evidence(
  target_incident_id text,
  verified_outcome jsonb,
  resolution_event jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_snapshot jsonb;
  evidence_ref text;
  updated_snapshot jsonb;
begin
  if jsonb_typeof(verified_outcome->'evidenceRefs') <> 'array'
     or jsonb_array_length(verified_outcome->'evidenceRefs') = 0 then
    raise exception 'Incident closure requires evidence';
  end if;

  if resolution_event->>'type' <> 'incident.resolved'
     or resolution_event->>'incidentId' <> target_incident_id then
    raise exception 'Resolution event does not match incident';
  end if;

  select snapshot into current_snapshot
  from public.incidents
  where id = target_incident_id
  for update;

  if current_snapshot is null then raise exception 'Incident not found'; end if;

  for evidence_ref in select jsonb_array_elements_text(verified_outcome->'evidenceRefs') loop
    if not exists (
      select 1 from public.evidence_records
      where id = evidence_ref and incident_id = target_incident_id
    ) then
      raise exception 'Missing incident evidence %', evidence_ref;
    end if;
  end loop;

  updated_snapshot := jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(current_snapshot, '{state}', '"resolved"'::jsonb),
        '{outcome}', verified_outcome
      ),
      '{pendingOperations}', '[]'::jsonb
    ),
    '{updatedAt}', to_jsonb(verified_outcome->>'verifiedAt')
  );

  update public.incidents
  set state = 'resolved', snapshot = updated_snapshot, updated_at = (verified_outcome->>'verifiedAt')::timestamptz,
      lock_version = lock_version + 1
  where id = target_incident_id;

  insert into public.incident_events (event_id, incident_id, event_type, actor, payload, occurred_at)
  values (
    resolution_event->>'eventId',
    target_incident_id,
    resolution_event->>'type',
    resolution_event->'actor',
    resolution_event->'payload',
    (resolution_event->>'occurredAt')::timestamptz
  );

  return updated_snapshot;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'identities','owners','controlled_contacts','vendors','role_memberships','properties',
    'demo_guest_sessions','approved_vendors','incidents','incident_events','provider_operations',
    'evidence_records','vendor_calls','vendor_quotes','payments','processed_stripe_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;
end $$;

grant usage, select on all sequences in schema public to service_role;
revoke all on function public.resolve_incident_with_evidence(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.resolve_incident_with_evidence(text, jsonb, jsonb) to service_role;

commit;
