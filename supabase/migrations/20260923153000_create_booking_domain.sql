create schema if not exists booking;

revoke all on schema booking from public, anon, authenticated;
grant usage on schema booking to service_role;

create table if not exists booking.requests (
  id uuid primary key default gen_random_uuid(),
  service_type text not null check (service_type in ('cowork','recording','studio','makeup','errand')),
  service_plan text not null check (char_length(service_plan) between 1 and 80),
  requested_date date not null,
  requested_time time not null,
  customer_name text not null check (char_length(customer_name) between 1 and 80),
  contact text not null check (char_length(contact) between 3 and 160),
  note text not null default '' check (char_length(note) <= 2000),
  estimate_amount integer check (estimate_amount between 0 and 1000000),
  estimate_label text not null default '' check (char_length(estimate_label) <= 160),
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled','completed')),
  source text not null default 'github-pages',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_requests_schedule_idx on booking.requests (requested_date, requested_time);
create index if not exists booking_requests_status_created_idx on booking.requests (status, created_at desc);

create table if not exists booking.submission_limits (
  id bigint generated always as identity primary key,
  fingerprint text not null,
  created_at timestamptz not null default now()
);
create index if not exists booking_submission_limits_lookup_idx
  on booking.submission_limits (fingerprint, created_at desc);

alter table booking.requests enable row level security;
alter table booking.requests force row level security;
alter table booking.submission_limits enable row level security;
alter table booking.submission_limits force row level security;

revoke all on all tables in schema booking from public, anon, authenticated;
revoke all on all sequences in schema booking from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema booking to service_role;
grant usage, select on all sequences in schema booking to service_role;

create or replace function booking.submit_request(p_payload jsonb, p_fingerprint text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, booking
as $$
declare
  v_id uuid;
  v_service_type text := trim(coalesce(p_payload->>'service_type',''));
  v_service_plan text := trim(coalesce(p_payload->>'service_plan',''));
  v_customer_name text := trim(coalesce(p_payload->>'customer_name',''));
  v_contact text := trim(coalesce(p_payload->>'contact',''));
  v_note text := trim(coalesce(p_payload->>'note',''));
  v_date date;
  v_time time;
  v_amount integer;
begin
  if p_fingerprint is null or char_length(p_fingerprint) < 16 then raise exception 'invalid request fingerprint'; end if;
  if v_service_type not in ('cowork','recording','studio','makeup','errand') then raise exception 'invalid service type'; end if;
  if char_length(v_service_plan) not between 1 and 80 then raise exception 'invalid service plan'; end if;
  if char_length(v_customer_name) not between 1 and 80 then raise exception 'invalid customer name'; end if;
  if char_length(v_contact) not between 3 and 160 then raise exception 'invalid contact'; end if;
  if char_length(v_note) > 2000 then raise exception 'note is too long'; end if;
  begin
    v_date := (p_payload->>'requested_date')::date;
    v_time := (p_payload->>'requested_time')::time;
    v_amount := nullif(p_payload->>'estimate_amount','')::integer;
  exception when others then raise exception 'invalid date, time, or amount'; end;
  if v_date < current_date then raise exception 'requested date is in the past'; end if;
  if v_amount is not null and (v_amount < 0 or v_amount > 1000000) then raise exception 'invalid estimate amount'; end if;
  if (select count(*) from booking.submission_limits where fingerprint = p_fingerprint and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'rate limit exceeded';
  end if;
  insert into booking.submission_limits (fingerprint) values (p_fingerprint);
  delete from booking.submission_limits where created_at < now() - interval '24 hours';
  insert into booking.requests (
    service_type, service_plan, requested_date, requested_time, customer_name, contact,
    note, estimate_amount, estimate_label, metadata
  ) values (
    v_service_type, v_service_plan, v_date, v_time, v_customer_name, v_contact,
    v_note, v_amount, left(coalesce(p_payload->>'estimate_label',''),160),
    jsonb_build_object('user_agent', left(coalesce(p_payload->>'user_agent',''),500))
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function booking.submit_request(jsonb,text) from public, anon, authenticated;
grant execute on function booking.submit_request(jsonb,text) to service_role;

create or replace function public.submit_meihau_booking_request(p_payload jsonb, p_fingerprint text)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, booking
as $$ select booking.submit_request(p_payload, p_fingerprint); $$;

revoke all on function public.submit_meihau_booking_request(jsonb,text) from public, anon, authenticated;
grant execute on function public.submit_meihau_booking_request(jsonb,text) to service_role;

