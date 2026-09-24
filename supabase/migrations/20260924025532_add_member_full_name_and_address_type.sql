alter table booking.members
  add column if not exists full_name text not null default '';

alter table booking.addresses
  add column if not exists address_type text not null default 'other';

alter table booking.addresses
  drop constraint if exists addresses_address_type_check;

alter table booking.addresses
  add constraint addresses_address_type_check
  check (address_type in ('home', 'company', 'other'));
