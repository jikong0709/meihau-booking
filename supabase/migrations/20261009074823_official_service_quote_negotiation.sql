begin;

alter table booking.services
  add column if not exists allow_quote boolean not null default false,
  add column if not exists allow_negotiation boolean not null default false;

alter table booking.service_price_options
  add column if not exists valid_from timestamptz,
  add column if not exists valid_until timestamptz;
alter table booking.service_price_options drop constraint if exists service_price_options_valid_period_check;
alter table booking.service_price_options add constraint service_price_options_valid_period_check
  check (valid_until is null or valid_from is null or valid_until > valid_from);

create table if not exists booking.official_team_members (
  team_id text not null references booking.official_teams(team_id) on update cascade on delete cascade,
  user_id uuid not null references booking.members(user_id) on delete cascade,
  status text not null default 'active' check (status in ('active','paused','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (team_id,user_id)
);

create table if not exists booking.service_quote_cases (
  quote_id uuid primary key default gen_random_uuid(),
  case_no text not null unique,
  case_type text not null check (case_type in ('quote','negotiation')),
  service_id text not null references booking.services(service_id),
  provider_team_id text not null references booking.official_teams(team_id),
  member_id uuid not null references booking.members(user_id),
  system_price_snapshot jsonb not null default '{}'::jsonb,
  requirements text not null check (char_length(requirements) between 3 and 4000),
  preferred_date date,
  member_budget integer check (member_budget is null or member_budget between 0 and 1000000),
  provider_quote_amount integer check (provider_quote_amount is null or provider_quote_amount between 0 and 1000000),
  quote_description text not null default '' check (char_length(quote_description) <= 4000),
  provider_terms text not null default '' check (char_length(provider_terms) <= 4000),
  valid_until timestamptz,
  status text not null default 'submitted' check (status in ('submitted','provider_replied','awaiting_member','accepted','rejected','expired','converted_to_booking','cancelled')),
  converted_order_id uuid unique references booking.orders(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists booking.service_quote_messages (
  message_id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references booking.service_quote_cases(quote_id) on delete cascade,
  sender_id uuid not null references booking.members(user_id),
  sender_role text not null check (sender_role in ('member','provider','admin','developer')),
  message_text text not null check (char_length(message_text) between 1 and 4000),
  attachment_url text check (attachment_url is null or char_length(attachment_url) <= 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists booking.service_quote_events (
  event_id bigint generated always as identity primary key,
  quote_id uuid not null references booking.service_quote_cases(quote_id) on delete cascade,
  actor_id uuid not null references booking.members(user_id),
  event_type text not null check (event_type in ('created','message','provider_quote','accepted','rejected','cancelled','converted')),
  from_status text,
  to_status text,
  price_snapshot integer,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists booking.service_quote_notifications (
  notification_id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references booking.service_quote_cases(quote_id) on delete cascade,
  recipient_id uuid not null references booking.members(user_id) on delete cascade,
  notification_type text not null check (notification_type in ('case_created','message','provider_quote','status_changed')),
  title text not null check (char_length(title) between 1 and 160),
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists service_quote_cases_member_idx on booking.service_quote_cases(member_id,created_at desc);
create index if not exists service_quote_cases_team_idx on booking.service_quote_cases(provider_team_id,status,created_at desc);
create index if not exists service_quote_messages_case_idx on booking.service_quote_messages(quote_id,created_at);
create index if not exists service_quote_events_case_idx on booking.service_quote_events(quote_id,created_at);
create index if not exists service_quote_notifications_recipient_idx on booking.service_quote_notifications(recipient_id,is_read,created_at desc);

alter table booking.orders add column if not exists quote_case_id uuid unique references booking.service_quote_cases(quote_id);
alter table booking.orders drop constraint if exists orders_category_check;
alter table booking.orders add constraint orders_category_check
  check (category in ('rental','errand','temporary_staff','recording_space','ai_digital','venue_equipment','learning'));

alter table booking.official_team_members enable row level security;
alter table booking.official_team_members force row level security;
alter table booking.service_quote_cases enable row level security;
alter table booking.service_quote_cases force row level security;
alter table booking.service_quote_messages enable row level security;
alter table booking.service_quote_messages force row level security;
alter table booking.service_quote_events enable row level security;
alter table booking.service_quote_events force row level security;
alter table booking.service_quote_notifications enable row level security;
alter table booking.service_quote_notifications force row level security;
revoke all on booking.official_team_members,booking.service_quote_cases,booking.service_quote_messages,booking.service_quote_events,booking.service_quote_notifications from public,anon,authenticated;
grant select,insert,update,delete on booking.official_team_members,booking.service_quote_cases,booking.service_quote_messages,booking.service_quote_events,booking.service_quote_notifications to service_role;
grant usage,select on all sequences in schema booking to service_role;

insert into booking.services(service_id,team_id,category_id,service_name,short_description,full_description,cover_image,price,price_type,pricing_type,price_note,booking_type,service_type,price_unit,service_status,is_featured,display_in_meihao_circle,application_method,estimated_response_time,sort_order,allow_quote,allow_negotiation)
values('OFF-LITESAY-017','TEAM-002','recording_space','錄音室租借','錄音、歌唱、配音與聲音製作使用的獨立空間。','錄音室租借｜錄音｜歌唱｜配音｜聲音製作。設備、時段與人員加購方案由管理員確認後維護。','assets/ui-v2/service-podcast.webp',null,'custom_quote','contact','價格待確認','custom_quote','recording','hour','active',true,true,'提交日期、時段、使用時數、人數、用途與設備需求。','官方確認後回覆',1135,false,false)
on conflict(service_id) do update set team_id=excluded.team_id,category_id=excluded.category_id,service_name=excluded.service_name,short_description=excluded.short_description,full_description=excluded.full_description,cover_image=excluded.cover_image,pricing_type=excluded.pricing_type,price_note=excluded.price_note,service_status='active',display_in_meihao_circle=true,application_method=excluded.application_method,sort_order=excluded.sort_order,updated_at=now();

with fields(field_key,field_label,field_type,required,placeholder,sort_order) as(values
('contact_name','姓名／暱稱','text',true,'請填寫聯絡人姓名或暱稱',10),
('contact_method','聯絡方式','text',true,'手機、LINE 或 Email',20),
('requirements','需求說明','textarea',true,'請描述錄音用途與需求',30),
('preferred_date','預計日期','date',false,'',40),
('preferred_time','預計時間','time',false,'',50),
('usage_hours','使用時數','number',true,'預計使用時數',110),
('attendee_count','使用人數','number',true,'預計人數',120),
('usage','使用用途','textarea',true,'錄音、歌唱、配音等',130),
('equipment_needs','設備需求','textarea',false,'請描述需求，不代表設備已提供',140),
('budget','預算（可選）','number',false,'可不填',150),
('reference_url','附件／參考資料網址','url',false,'https://',160),
('notes','備註','textarea',false,'其他補充事項',170))
insert into booking.service_application_fields(field_id,service_id,field_key,field_label,field_type,required,placeholder,sort_order)
select 'OFF-LITESAY-017-'||field_key,'OFF-LITESAY-017',field_key,field_label,field_type,required,placeholder,sort_order from fields
on conflict(service_id,field_key) do update set field_label=excluded.field_label,field_type=excluded.field_type,required=excluded.required,placeholder=excluded.placeholder,sort_order=excluded.sort_order,status='active',updated_at=now();

update booking.services set allow_quote=false,allow_negotiation=false where team_id in ('TEAM-001','TEAM-002');

do $triggers$ declare t text; begin
  foreach t in array array['official_team_members','service_quote_cases'] loop
    execute format('drop trigger if exists set_updated_at on booking.%I',t);
    execute format('create trigger set_updated_at before update on booking.%I for each row execute function booking.set_updated_at()',t);
  end loop;
end; $triggers$;

commit;
