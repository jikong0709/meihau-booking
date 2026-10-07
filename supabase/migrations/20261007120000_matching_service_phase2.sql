begin;

create or replace function booking.urls_are_http(p_urls text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(pg_catalog.bool_and(url ~* '^https?://[^[:space:]]+$'), true)
  from pg_catalog.unnest(coalesce(p_urls, '{}'::text[])) as items(url);
$$;

create table if not exists booking.identity_tag_applications (
  application_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references booking.members(user_id),
  proposed_name text not null check (char_length(btrim(proposed_name)) between 1 and 120),
  purpose text not null default '' check (char_length(purpose) <= 1000),
  service_description text not null default '' check (char_length(service_description) <= 3000),
  qualification_summary text not null default '' check (char_length(qualification_summary) <= 3000),
  evidence_urls text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  matched_tag_id uuid references booking.tags(tag_id),
  review_note text not null default '' check (char_length(review_note) <= 3000),
  reviewed_by uuid references booking.members(user_id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_tag_applications_evidence_urls_check
    check (cardinality(evidence_urls) <= 10 and booking.urls_are_http(evidence_urls)),
  constraint identity_tag_applications_review_check
    check (
      (status in ('pending', 'withdrawn') and reviewed_by is null and reviewed_at is null)
      or (status in ('approved', 'rejected') and reviewed_by is not null and reviewed_at is not null)
    ),
  constraint identity_tag_applications_match_check
    check (status <> 'approved' or matched_tag_id is not null)
);

create table if not exists booking.identity_verification_rules (
  rule_id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references booking.tags(tag_id),
  version integer not null check (version > 0),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 5000),
  requires_manual_review boolean not null default true,
  valid_days integer check (valid_days is null or valid_days between 1 and 36500),
  special_legal_notice text not null default '' check (char_length(special_legal_notice) <= 5000),
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  created_by uuid not null references booking.members(user_id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_verification_rules_tag_version_key unique (tag_id, version),
  constraint identity_verification_rules_identity_key unique (rule_id, tag_id, version),
  constraint identity_verification_rules_publish_check
    check (status <> 'active' or published_at is not null)
);

create unique index if not exists booking_identity_verification_rules_one_active_tag
  on booking.identity_verification_rules(tag_id)
  where status = 'active';

create table if not exists booking.identity_verification_requirements (
  requirement_id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references booking.identity_verification_rules(rule_id),
  requirement_key text not null check (requirement_key ~ '^[a-z][a-z0-9_]{0,79}$'),
  label text not null check (char_length(btrim(label)) between 1 and 200),
  evidence_type text not null check (evidence_type in ('text', 'url', 'certificate')),
  is_required boolean not null default true,
  is_public_result boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  instructions text not null default '' check (char_length(instructions) <= 5000),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_verification_requirements_rule_key unique (rule_id, requirement_key),
  constraint identity_verification_requirements_identity_key unique (requirement_id, rule_id)
);

create table if not exists booking.member_identity_verifications (
  verification_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references booking.members(user_id),
  tag_id uuid not null references booking.tags(tag_id),
  rule_id uuid not null,
  rule_version integer not null check (rule_version > 0),
  status text not null default 'draft' check (status in ('draft', 'pending', 'verified', 'rejected', 'expired', 'revoked')),
  submitted_at timestamptz,
  verified_at timestamptz,
  expires_at timestamptz,
  reviewed_by uuid references booking.members(user_id),
  review_note_private text not null default '' check (char_length(review_note_private) <= 5000),
  review_note_public text not null default '' check (char_length(review_note_public) <= 2000),
  revoked_at timestamptz,
  revoked_reason text not null default '' check (char_length(revoked_reason) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_identity_verifications_rule_fkey
    foreign key (rule_id, tag_id, rule_version)
    references booking.identity_verification_rules(rule_id, tag_id, version),
  constraint member_identity_verifications_identity_key unique (verification_id, rule_id),
  constraint member_identity_verifications_submit_check
    check (status = 'draft' or submitted_at is not null),
  constraint member_identity_verifications_verify_check
    check (status <> 'verified' or (verified_at is not null and reviewed_by is not null)),
  constraint member_identity_verifications_revoke_check
    check (status <> 'revoked' or (revoked_at is not null and char_length(btrim(revoked_reason)) > 0)),
  constraint member_identity_verifications_expiry_check
    check (expires_at is null or (verified_at is not null and expires_at > verified_at))
);

create table if not exists booking.member_identity_evidence (
  evidence_id uuid primary key default gen_random_uuid(),
  verification_id uuid not null,
  rule_id uuid not null,
  requirement_id uuid not null,
  text_value text not null default '' check (char_length(text_value) <= 5000),
  url_value text not null default '' check (url_value = '' or url_value ~* '^https?://[^[:space:]]+$'),
  certificate_name text not null default '' check (char_length(certificate_name) <= 300),
  issuer_name text not null default '' check (char_length(issuer_name) <= 300),
  certificate_number_masked text not null default '' check (char_length(certificate_number_masked) <= 120),
  issued_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_identity_evidence_verification_fkey
    foreign key (verification_id, rule_id)
    references booking.member_identity_verifications(verification_id, rule_id),
  constraint member_identity_evidence_requirement_fkey
    foreign key (requirement_id, rule_id)
    references booking.identity_verification_requirements(requirement_id, rule_id),
  constraint member_identity_evidence_verification_requirement_key
    unique (verification_id, requirement_id),
  constraint member_identity_evidence_value_check
    check (
      char_length(btrim(text_value)) > 0
      or char_length(btrim(url_value)) > 0
      or char_length(btrim(certificate_name)) > 0
      or char_length(btrim(issuer_name)) > 0
      or char_length(btrim(certificate_number_masked)) > 0
      or issued_on is not null
    )
);

create table if not exists booking.matching_profiles (
  user_id uuid primary key references booking.members(user_id),
  public_slug text not null unique check (public_slug ~ '^[a-z0-9][a-z0-9-]{7,79}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  headline text not null default '' check (char_length(headline) <= 200),
  public_intro text not null default '' check (char_length(public_intro) <= 5000),
  service_region text not null default '' check (char_length(service_region) <= 300),
  availability_summary text not null default '' check (char_length(availability_summary) <= 1000),
  publish_status text not null default 'draft' check (publish_status in ('draft', 'pending_review', 'published', 'hidden', 'suspended')),
  contact_mode text not null default 'platform_only' check (contact_mode = 'platform_only'),
  submitted_at timestamptz,
  published_at timestamptz,
  reviewed_by uuid references booking.members(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matching_profiles_submit_check
    check (publish_status = 'draft' or submitted_at is not null),
  constraint matching_profiles_publish_check
    check (publish_status <> 'published' or (published_at is not null and reviewed_by is not null))
);

create table if not exists booking.matching_records (
  match_id uuid primary key default gen_random_uuid(),
  match_code text not null unique check (match_code ~ '^[A-Z0-9-]{8,40}$'),
  initiator_user_id uuid not null references booking.members(user_id),
  counterparty_user_id uuid not null references booking.members(user_id),
  provider_user_id uuid references booking.members(user_id),
  seeker_user_id uuid references booking.members(user_id),
  subject_type text not null check (subject_type in ('service', 'need', 'cooperation', 'resource')),
  subject_title text not null check (char_length(btrim(subject_title)) between 1 and 300),
  scope_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(scope_snapshot) = 'object'),
  terms_version integer not null default 1 check (terms_version > 0),
  scheduled_at timestamptz,
  location_text text not null default '' check (char_length(location_text) <= 500),
  agreed_amount integer check (agreed_amount is null or agreed_amount between 0 and 100000000),
  payment_method_text text not null default '' check (char_length(payment_method_text) <= 300),
  status text not null default 'proposed' check (status in ('proposed', 'partially_confirmed', 'confirmed', 'cancelled', 'disputed', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  constraint matching_records_participants_check
    check (initiator_user_id <> counterparty_user_id),
  constraint matching_records_provider_check
    check (provider_user_id is null or provider_user_id in (initiator_user_id, counterparty_user_id)),
  constraint matching_records_seeker_check
    check (seeker_user_id is null or seeker_user_id in (initiator_user_id, counterparty_user_id)),
  constraint matching_records_roles_check
    check (provider_user_id is null or seeker_user_id is null or provider_user_id <> seeker_user_id),
  constraint matching_records_confirmed_check
    check (status <> 'confirmed' or confirmed_at is not null),
  constraint matching_records_terms_key unique (match_id, terms_version)
);

create table if not exists booking.matching_confirmations (
  confirmation_id uuid primary key default gen_random_uuid(),
  match_id uuid not null,
  user_id uuid not null references booking.members(user_id),
  terms_version integer not null check (terms_version > 0),
  decision text not null check (decision in ('confirmed', 'declined')),
  terms_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(terms_snapshot) = 'object'),
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matching_confirmations_match_terms_fkey
    foreign key (match_id, terms_version)
    references booking.matching_records(match_id, terms_version),
  constraint matching_confirmations_match_user_terms_key
    unique (match_id, user_id, terms_version)
);

create table if not exists booking.matching_reports (
  report_id uuid primary key default gen_random_uuid(),
  match_id uuid not null references booking.matching_records(match_id),
  reporter_user_id uuid not null references booking.members(user_id),
  category text not null check (category in ('no_show', 'late_cancel', 'amount_dispute', 'scope_dispute', 'suspected_fraud', 'misconduct', 'safety', 'other')),
  description text not null check (char_length(btrim(description)) between 1 and 5000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  assigned_to uuid references booking.members(user_id),
  resolution_note text not null default '' check (char_length(resolution_note) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint matching_reports_resolution_check
    check (status not in ('resolved', 'dismissed') or resolved_at is not null)
);

create table if not exists booking.matching_feature_applications (
  application_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references booking.members(user_id),
  matching_profile_user_id uuid not null references booking.matching_profiles(user_id),
  category_tag_id uuid references booking.tags(tag_id),
  requested_start_at timestamptz,
  requested_end_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'inactive')),
  reviewed_by uuid references booking.members(user_id),
  review_note text not null default '' check (char_length(review_note) <= 3000),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matching_feature_applications_profile_owner_check
    check (user_id = matching_profile_user_id),
  constraint matching_feature_applications_requested_range_check
    check (requested_end_at is null or (requested_start_at is not null and requested_end_at > requested_start_at)),
  constraint matching_feature_applications_review_check
    check (
      (status = 'pending' and reviewed_by is null and reviewed_at is null)
      or (status in ('approved', 'rejected', 'inactive') and reviewed_by is not null and reviewed_at is not null)
    )
);

create table if not exists booking.matching_feature_schedules (
  schedule_id uuid primary key default gen_random_uuid(),
  application_id uuid not null references booking.matching_feature_applications(application_id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  status text not null default 'scheduled' check (status in ('scheduled', 'active', 'paused', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matching_feature_schedules_range_check check (ends_at > starts_at)
);

create index if not exists booking_identity_tag_applications_user_idx
  on booking.identity_tag_applications(user_id, created_at desc);
create index if not exists booking_identity_tag_applications_review_idx
  on booking.identity_tag_applications(status, created_at);
create index if not exists booking_identity_verification_requirements_rule_idx
  on booking.identity_verification_requirements(rule_id, sort_order, requirement_key);
create index if not exists booking_member_identity_verifications_user_idx
  on booking.member_identity_verifications(user_id, status, created_at desc);
create index if not exists booking_member_identity_verifications_review_idx
  on booking.member_identity_verifications(status, submitted_at);
create index if not exists booking_member_identity_verifications_public_idx
  on booking.member_identity_verifications(user_id, tag_id, expires_at)
  where status = 'verified';
create index if not exists booking_member_identity_evidence_verification_idx
  on booking.member_identity_evidence(verification_id);
create index if not exists booking_matching_profiles_publish_idx
  on booking.matching_profiles(publish_status, published_at desc);
create index if not exists booking_matching_records_initiator_idx
  on booking.matching_records(initiator_user_id, created_at desc);
create index if not exists booking_matching_records_counterparty_idx
  on booking.matching_records(counterparty_user_id, created_at desc);
create index if not exists booking_matching_records_status_idx
  on booking.matching_records(status, created_at desc);
create index if not exists booking_matching_confirmations_match_idx
  on booking.matching_confirmations(match_id, terms_version, decision);
create index if not exists booking_matching_reports_match_idx
  on booking.matching_reports(match_id, status, created_at desc);
create index if not exists booking_matching_reports_admin_idx
  on booking.matching_reports(status, assigned_to, created_at);
create index if not exists booking_matching_feature_applications_user_idx
  on booking.matching_feature_applications(user_id, status, created_at desc);
create index if not exists booking_matching_feature_applications_review_idx
  on booking.matching_feature_applications(status, created_at);
create index if not exists booking_matching_feature_schedules_feed_idx
  on booking.matching_feature_schedules(status, starts_at, ends_at, sort_order);

create or replace function booking.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $triggers$
declare
  table_name text;
begin
  foreach table_name in array array[
    'identity_tag_applications',
    'identity_verification_rules',
    'identity_verification_requirements',
    'member_identity_verifications',
    'member_identity_evidence',
    'matching_profiles',
    'matching_records',
    'matching_confirmations',
    'matching_reports',
    'matching_feature_applications',
    'matching_feature_schedules'
  ] loop
    execute format('drop trigger if exists set_updated_at on booking.%I', table_name);
    execute format(
      'create trigger set_updated_at before update on booking.%I for each row execute function booking.set_updated_at()',
      table_name
    );
  end loop;
end;
$triggers$;

alter table booking.identity_tag_applications enable row level security;
alter table booking.identity_tag_applications force row level security;
alter table booking.identity_verification_rules enable row level security;
alter table booking.identity_verification_rules force row level security;
alter table booking.identity_verification_requirements enable row level security;
alter table booking.identity_verification_requirements force row level security;
alter table booking.member_identity_verifications enable row level security;
alter table booking.member_identity_verifications force row level security;
alter table booking.member_identity_evidence enable row level security;
alter table booking.member_identity_evidence force row level security;
alter table booking.matching_profiles enable row level security;
alter table booking.matching_profiles force row level security;
alter table booking.matching_records enable row level security;
alter table booking.matching_records force row level security;
alter table booking.matching_confirmations enable row level security;
alter table booking.matching_confirmations force row level security;
alter table booking.matching_reports enable row level security;
alter table booking.matching_reports force row level security;
alter table booking.matching_feature_applications enable row level security;
alter table booking.matching_feature_applications force row level security;
alter table booking.matching_feature_schedules enable row level security;
alter table booking.matching_feature_schedules force row level security;

revoke all on function booking.urls_are_http(text[]) from public, anon, authenticated;
grant execute on function booking.urls_are_http(text[]) to service_role;

revoke all on
  booking.identity_tag_applications,
  booking.identity_verification_rules,
  booking.identity_verification_requirements,
  booking.member_identity_verifications,
  booking.member_identity_evidence,
  booking.matching_profiles,
  booking.matching_records,
  booking.matching_confirmations,
  booking.matching_reports,
  booking.matching_feature_applications,
  booking.matching_feature_schedules
from public, anon, authenticated;

grant select, insert, update on
  booking.identity_tag_applications,
  booking.identity_verification_rules,
  booking.identity_verification_requirements,
  booking.member_identity_verifications,
  booking.member_identity_evidence,
  booking.matching_profiles,
  booking.matching_records,
  booking.matching_confirmations,
  booking.matching_reports,
  booking.matching_feature_applications,
  booking.matching_feature_schedules
to service_role;

commit;
