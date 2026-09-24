create table if not exists booking.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  phone text not null default '',
  line_id text not null default '',
  contact_email text not null default '',
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists booking.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references booking.members(user_id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  recipient text not null default '',
  phone text not null default '',
  address text not null check (char_length(address) between 3 and 300),
  note text not null default '' check (char_length(note) <= 500),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_addresses_user_idx on booking.addresses(user_id, created_at);

create table if not exists booking.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  user_id uuid not null references booking.members(user_id),
  category text not null check (category in ('rental','errand')),
  booking_date date,
  booking_time time,
  note text not null default '' check (char_length(note) <= 2000),
  total_amount integer not null check (total_amount between 0 and 1000000),
  payment_status text not null default 'UNPAID' check (payment_status in ('UNPAID','PENDING','PARTIAL','PAID','REFUND_PENDING','REFUNDED','FAILED')),
  service_status text not null default 'WAITING_PAYMENT' check (service_status in ('DRAFT','WAITING_PAYMENT','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED')),
  quote_payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_orders_user_idx on booking.orders(user_id, created_at desc);
create index if not exists booking_orders_calendar_idx on booking.orders(booking_date, booking_time, category);

create table if not exists booking.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references booking.orders(id) on delete cascade,
  label text not null,
  amount integer not null check (amount between 0 and 1000000),
  created_at timestamptz not null default now()
);

alter table booking.members enable row level security;
alter table booking.members force row level security;
alter table booking.addresses enable row level security;
alter table booking.addresses force row level security;
alter table booking.orders enable row level security;
alter table booking.orders force row level security;
alter table booking.order_items enable row level security;
alter table booking.order_items force row level security;

revoke all on booking.members, booking.addresses, booking.orders, booking.order_items from public, anon, authenticated;
revoke all on all sequences in schema booking from public, anon, authenticated;
grant select, insert, update, delete on booking.members, booking.addresses, booking.orders, booking.order_items to service_role;
grant usage, select on all sequences in schema booking to service_role;
