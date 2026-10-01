alter table booking.members
  drop constraint if exists members_role_check;

alter table booking.members
  add constraint members_role_check
  check (role in ('member', 'admin', 'developer'));

create table if not exists booking.role_assignments (
  email text primary key,
  role text not null check (role in ('admin', 'developer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint role_assignments_email_normalized_check
    check (email = lower(btrim(email)) and char_length(email) between 3 and 320)
);

alter table booking.role_assignments enable row level security;
alter table booking.role_assignments force row level security;

revoke all on booking.role_assignments from public, anon, authenticated;
grant select, insert, update, delete on booking.role_assignments to service_role;

create or replace function booking.apply_member_role_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  assigned_role text;
begin
  select assignment.role
    into assigned_role
    from booking.role_assignments as assignment
   where assignment.email = lower(btrim(new.email));

  if assigned_role is not null then
    new.role := assigned_role;
  end if;

  return new;
end;
$$;

revoke all on function booking.apply_member_role_assignment() from public, anon, authenticated;
grant execute on function booking.apply_member_role_assignment() to service_role;

drop trigger if exists members_apply_role_assignment on booking.members;
create trigger members_apply_role_assignment
before insert or update of email on booking.members
for each row execute function booking.apply_member_role_assignment();
