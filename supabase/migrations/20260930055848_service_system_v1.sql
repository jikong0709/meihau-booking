begin;

create table if not exists booking.services (
  service_id text primary key,
  category_id text not null check (category_id in ('temporary_staff','recording_space','ai_digital','venue_equipment')),
  service_name text not null check (char_length(service_name) between 1 and 120),
  short_description text not null default '' check (char_length(short_description) <= 500),
  full_description text not null default '' check (char_length(full_description) <= 4000),
  cover_image text,
  price integer check (price is null or price between 0 and 1000000),
  price_type text not null check (price_type in ('fixed','starting_from','custom_quote')),
  booking_type text not null check (booking_type in ('direct_booking','custom_quote')),
  duration text,
  location text,
  service_status text not null check (service_status in ('draft','coming_soon','active','paused','custom','hidden','archived')),
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (price_type = 'custom_quote' or price is not null),
  check (booking_type <> 'custom_quote' or price_type in ('starting_from','custom_quote'))
);

create index if not exists booking_services_public_idx
  on booking.services(service_status, category_id, sort_order, service_id);

create table if not exists booking.service_options (
  option_id text primary key,
  service_id text not null references booking.services(service_id) on update cascade,
  option_name text not null check (char_length(option_name) between 1 and 120),
  status text not null default 'active' check (status in ('active','hidden','archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_service_options_service_idx
  on booking.service_options(service_id, status, sort_order);

create table if not exists booking.service_addons (
  addon_id text primary key,
  addon_name text not null check (char_length(addon_name) between 1 and 120),
  addon_price integer check (addon_price is null or addon_price between 0 and 1000000),
  addon_description text not null default '' check (char_length(addon_description) <= 1000),
  available_for text[] not null default '{}',
  status text not null default 'active' check (status in ('draft','active','hidden','archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists booking.service_inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references booking.members(user_id),
  service_id text not null references booking.services(service_id),
  service_name text not null,
  preferred_date date,
  preferred_time time,
  requirements text not null check (char_length(requirements) between 3 and 4000),
  additional_notes text not null default '' check (char_length(additional_notes) <= 2000),
  status text not null default 'pending' check (status in ('pending','reviewing','quoted','accepted','closed')),
  quoted_amount integer check (quoted_amount is null or quoted_amount between 0 and 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_service_inquiries_user_idx
  on booking.service_inquiries(user_id, created_at desc);
create index if not exists booking_service_inquiries_admin_idx
  on booking.service_inquiries(status, created_at desc);

alter table booking.orders add column if not exists service_id text references booking.services(service_id);
alter table booking.orders drop constraint if exists orders_category_check;
alter table booking.orders add constraint orders_category_check
  check (category in ('rental','errand','temporary_staff','recording_space','ai_digital','venue_equipment'));

alter table booking.services enable row level security;
alter table booking.services force row level security;
alter table booking.service_options enable row level security;
alter table booking.service_options force row level security;
alter table booking.service_addons enable row level security;
alter table booking.service_addons force row level security;
alter table booking.service_inquiries enable row level security;
alter table booking.service_inquiries force row level security;

revoke all on booking.services, booking.service_options, booking.service_addons, booking.service_inquiries from public, anon, authenticated;
grant usage on schema booking to authenticated;
grant select on booking.services, booking.service_options, booking.service_addons to authenticated;
grant select, insert on booking.service_inquiries to authenticated;
grant select, insert, update, delete on booking.services, booking.service_options, booking.service_addons, booking.service_inquiries to service_role;

drop policy if exists "members read available services" on booking.services;
create policy "members read available services"
  on booking.services for select to authenticated
  using (service_status in ('active','coming_soon'));

drop policy if exists "members read active service options" on booking.service_options;
create policy "members read active service options"
  on booking.service_options for select to authenticated
  using (
    status = 'active'
    and exists (
      select 1 from booking.services s
      where s.service_id = service_options.service_id
        and s.service_status = 'active'
    )
  );

drop policy if exists "members read active addons" on booking.service_addons;
create policy "members read active addons"
  on booking.service_addons for select to authenticated
  using (status = 'active');

drop policy if exists "members read own inquiries" on booking.service_inquiries;
create policy "members read own inquiries"
  on booking.service_inquiries for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "members create own inquiries" on booking.service_inquiries;
create policy "members create own inquiries"
  on booking.service_inquiries for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'pending'
    and quoted_amount is null
  );

insert into booking.services (
  service_id, category_id, service_name, short_description, full_description,
  price, price_type, booking_type, duration, location, service_status, is_featured, sort_order
) values
  ('REC-001','recording_space','錄音體驗','讓一般人也可以體驗進錄音室錄製作品','適合第一次體驗錄音、個人錄歌、情侶、親子、生日、告白、紀念、學生與社團。',800,'starting_from','direct_booking',null,null,'active',true,10),
  ('REC-002','recording_space','一日歌手｜專業錄音室體驗','把錄歌包裝成一般消費者可以購買的體驗商品','包含專業錄音室、錄音設備、錄音師協助、多次 Take，完成歌曲錄音作品。',2300,'starting_from','direct_booking',null,null,'active',true,20),
  ('AI-001','ai_digital','AI 簡報製作','從簡報架構到基礎視覺美化','包含簡報架構、AI 生成內容、視覺排版、簡報製作與基礎美化；實際費用依頁數與複雜度確認。',150,'starting_from','direct_booking',null,null,'active',true,30),
  ('AI-002','ai_digital','一頁式網站製作','品牌與服務的一頁式網站','可包含首頁、品牌介紹、服務介紹、作品展示、CTA、聯絡方式、社群連結與基本 RWD。',6000,'starting_from','custom_quote',null,null,'active',true,40),
  ('AI-003','ai_digital','Excel 自動化','整理資料並減少重複工作','可處理表格整理、計算自動化、資料整理、重複工作自動化、基礎報表及表單串接。',1000,'starting_from','custom_quote',null,null,'active',true,50),
  ('AI-004','ai_digital','AI／數位系統客製','依需求規劃 AI 與數位流程','適用 AI 工作流程、自動化、Notion 系統、表單流程、資料管理、AI 工作助手、企業數位流程及 API／工具串接。',null,'custom_quote','custom_quote',null,null,'active',true,60),
  ('MAN-001','temporary_staff','活動工作人員','活動現場支援與行政協助','可支援活動現場、場務、場控、工作人員與行政協助。',null,'custom_quote','custom_quote',null,null,'active',true,70),
  ('MAN-002','temporary_staff','現場支援','臨時需要有人到現場協助處理事情','適合活動、拍攝、錄音、展覽及會議。',null,'custom_quote','custom_quote',null,null,'active',true,80),
  ('MAN-003','temporary_staff','臨時人力','短時間、單次、臨時或急件的人力需求','臨時缺人時可提出需求，由人工評估與報價。',null,'custom_quote','custom_quote',null,null,'active',true,90),
  ('MAN-004','temporary_staff','急件支援','急件需求先由人工確認','提出需求後由人工確認、報價，客戶確認後才轉訂單與付款。',null,'custom_quote','custom_quote',null,null,'coming_soon',false,100),
  ('SPACE-001','venue_equipment','彈性辦公','','',null,'custom_quote','custom_quote',null,null,'hidden',false,110),
  ('SPACE-002','venue_equipment','會議室','','',null,'custom_quote','custom_quote',null,null,'hidden',false,120),
  ('SPACE-003','venue_equipment','直播間','','',null,'custom_quote','custom_quote',null,null,'hidden',false,130),
  ('SPACE-004','venue_equipment','拍攝空間','','',null,'custom_quote','custom_quote',null,null,'hidden',false,140),
  ('SPACE-005','venue_equipment','活動場地','','',null,'custom_quote','custom_quote',null,null,'hidden',false,150),
  ('SPACE-006','venue_equipment','商務地址','','',null,'custom_quote','custom_quote',null,null,'hidden',false,160),
  ('SPACE-007','venue_equipment','虛擬辦公','','',null,'custom_quote','custom_quote',null,null,'hidden',false,170),
  ('cowork-2h','venue_equipment','共享辦公｜2 小時','舊服務，僅供歷史查詢','',99,'fixed','direct_booking',null,null,'archived',false,900),
  ('cowork-half','venue_equipment','共享辦公｜半日 4 小時','舊服務，僅供歷史查詢','',150,'fixed','direct_booking',null,null,'archived',false,901),
  ('cowork-day','venue_equipment','共享辦公｜單日','舊服務，僅供歷史查詢','',250,'fixed','direct_booking',null,null,'archived',false,902),
  ('cowork-5','venue_equipment','共享辦公｜5 日券','舊服務，僅供歷史查詢','',1100,'fixed','direct_booking',null,null,'archived',false,903),
  ('cowork-10','venue_equipment','共享辦公｜10 日券','舊服務，僅供歷史查詢','',2000,'fixed','direct_booking',null,null,'archived',false,904),
  ('cowork-month','venue_equipment','共享辦公｜月租自由座','舊服務，僅供歷史查詢','',2800,'fixed','direct_booking',null,null,'archived',false,905),
  ('cowork-fixed','venue_equipment','共享辦公｜月租固定座','舊服務，僅供歷史查詢','',4000,'fixed','direct_booking',null,null,'archived',false,906),
  ('record-room','recording_space','錄音｜純錄音空間','舊服務，僅供歷史查詢','',500,'fixed','direct_booking',null,null,'archived',false,910),
  ('record-equip','recording_space','錄音｜空間＋基本設備','舊服務，僅供歷史查詢','',700,'fixed','direct_booking',null,null,'archived',false,911),
  ('record-assist','recording_space','錄音｜設備＋操作協助','舊服務，僅供歷史查詢','',1000,'fixed','direct_booking',null,null,'archived',false,912),
  ('record-2h','recording_space','錄音｜2 小時設備方案','舊服務，僅供歷史查詢','',1300,'fixed','direct_booking',null,null,'archived',false,913),
  ('record-4h','recording_space','錄音｜4 小時設備方案','舊服務，僅供歷史查詢','',2400,'fixed','direct_booking',null,null,'archived',false,914),
  ('studio-room','venue_equipment','攝影／直播｜純場地','舊服務，僅供歷史查詢','',600,'fixed','direct_booking',null,null,'archived',false,920),
  ('studio-light','venue_equipment','攝影／直播｜場地＋燈具','舊服務，僅供歷史查詢','',800,'fixed','direct_booking',null,null,'archived',false,921),
  ('studio-gear','venue_equipment','攝影／直播｜場地＋設備','舊服務，僅供歷史查詢','',1000,'fixed','direct_booking',null,null,'archived',false,922),
  ('studio-2h','venue_equipment','攝影／直播｜2 小時方案','舊服務，僅供歷史查詢','',1500,'fixed','direct_booking',null,null,'archived',false,923),
  ('studio-4h','venue_equipment','攝影／直播｜4 小時方案','舊服務，僅供歷史查詢','',2800,'fixed','direct_booking',null,null,'archived',false,924),
  ('makeup-solo','venue_equipment','化妝／更衣｜1 小時','舊服務，僅供歷史查詢','',300,'fixed','direct_booking',null,null,'archived',false,930),
  ('makeup-addon','venue_equipment','化妝／更衣｜場地加購','舊服務，僅供歷史查詢','',200,'fixed','direct_booking',null,null,'archived',false,931),
  ('motor','temporary_staff','機車配送','舊服務，僅供歷史查詢','',null,'custom_quote','custom_quote',null,null,'archived',false,940),
  ('urgent','temporary_staff','機車急件','舊服務，僅供歷史查詢','',null,'custom_quote','custom_quote',null,null,'archived',false,941),
  ('car','temporary_staff','汽車配送','舊服務，僅供歷史查詢','',null,'custom_quote','custom_quote',null,null,'archived',false,942),
  ('shopping','temporary_staff','代買＋配送','舊服務，僅供歷史查詢','',null,'custom_quote','custom_quote',null,null,'archived',false,943),
  ('task','temporary_staff','跑腿／代辦','舊服務，僅供歷史查詢','',200,'fixed','direct_booking',null,null,'archived',false,944)
on conflict (service_id) do update set
  category_id = excluded.category_id,
  service_name = excluded.service_name,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  price = excluded.price,
  price_type = excluded.price_type,
  booking_type = excluded.booking_type,
  service_status = excluded.service_status,
  is_featured = excluded.is_featured,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into booking.service_options (option_id, service_id, option_name, status, sort_order) values
  ('REC-001-PODCAST','REC-001','Podcast 錄音','active',10),
  ('REC-001-CREATOR','REC-001','YouTuber／短影音錄音','active',20),
  ('REC-001-DEMO','REC-001','個人歌曲 Demo','active',30),
  ('REC-002-PODCAST','REC-002','Podcast 錄音','active',10),
  ('REC-002-CREATOR','REC-002','YouTuber／短影音錄音','active',20),
  ('REC-002-DEMO','REC-002','個人歌曲 Demo','active',30)
on conflict (option_id) do update set
  option_name = excluded.option_name,
  status = excluded.status,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into booking.service_addons (
  addon_id, addon_name, addon_price, addon_description, available_for, status, sort_order
) values
  ('ADD-001','設備協助',null,'設備設定與現場操作協助；價格尚未定案。',array['recording','podcast','photo','event'],'active',10),
  ('ADD-002','化妝間',null,'化妝、更衣空間使用；價格尚未定案。',array['recording','podcast','photo','event'],'active',20)
on conflict (addon_id) do update set
  addon_name = excluded.addon_name,
  addon_price = excluded.addon_price,
  addon_description = excluded.addon_description,
  available_for = excluded.available_for,
  status = excluded.status,
  sort_order = excluded.sort_order,
  updated_at = now();

commit;
