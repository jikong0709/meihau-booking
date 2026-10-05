begin;

alter table booking.services
  add column if not exists service_type text,
  add column if not exists price_unit text,
  add column if not exists included_hours integer,
  add column if not exists min_hours integer,
  add column if not exists additional_hour_price integer,
  add column if not exists deposit integer,
  add column if not exists companion_modes text[] not null default '{}',
  add column if not exists requires_provider boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'services_service_type_check' and conrelid = 'booking.services'::regclass) then
    alter table booking.services add constraint services_service_type_check
      check (service_type is null or service_type in ('recording','ai_digital','staff','space','companion'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'services_price_unit_check' and conrelid = 'booking.services'::regclass) then
    alter table booking.services add constraint services_price_unit_check
      check (price_unit is null or price_unit in ('session','hour','half_day','day','project'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'services_hour_fields_check' and conrelid = 'booking.services'::regclass) then
    alter table booking.services add constraint services_hour_fields_check
      check (
        (included_hours is null or included_hours between 1 and 12)
        and (min_hours is null or min_hours between 1 and 12)
        and (additional_hour_price is null or additional_hour_price between 0 and 1000000)
        and (deposit is null or deposit between 0 and 1000000)
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'services_companion_modes_check' and conrelid = 'booking.services'::regclass) then
    alter table booking.services add constraint services_companion_modes_check
      check (companion_modes <@ array['quiet','low_interaction','together','body_doubling']::text[]);
  end if;
end $$;

create table if not exists booking.providers (
  provider_id text primary key,
  display_name text not null check (char_length(display_name) between 1 and 120),
  provider_type text not null check (provider_type in ('person','team')),
  bio text not null default '' check (char_length(bio) <= 2000),
  status text not null default 'active' check (status in ('active','paused','hidden','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists booking.service_providers (
  service_id text not null references booking.services(service_id) on update cascade,
  provider_id text not null references booking.providers(provider_id) on update cascade,
  status text not null default 'active' check (status in ('active','paused','hidden','archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (service_id, provider_id)
);

create table if not exists booking.service_packages (
  package_id text primary key,
  service_id text not null references booking.services(service_id) on update cascade,
  package_name text not null check (char_length(package_name) between 1 and 120),
  price integer not null check (price between 0 and 1000000),
  session_count integer check (session_count is null or session_count between 1 and 1000),
  included_hours integer check (included_hours is null or included_hours between 1 and 1000),
  billing_period text check (billing_period is null or billing_period in ('once','month')),
  status text not null default 'hidden' check (status in ('active','hidden','archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_service_providers_service_idx
  on booking.service_providers(service_id, status, sort_order);
create index if not exists booking_service_packages_service_idx
  on booking.service_packages(service_id, status, sort_order);

alter table booking.providers enable row level security;
alter table booking.providers force row level security;
alter table booking.service_providers enable row level security;
alter table booking.service_providers force row level security;
alter table booking.service_packages enable row level security;
alter table booking.service_packages force row level security;

revoke all on booking.providers, booking.service_providers, booking.service_packages from public, anon, authenticated;
grant select on booking.providers, booking.service_providers, booking.service_packages to authenticated;
grant select, insert, update, delete on booking.providers, booking.service_providers, booking.service_packages to service_role;

drop policy if exists "members read active providers" on booking.providers;
create policy "members read active providers"
  on booking.providers for select to authenticated
  using (status = 'active');

drop policy if exists "members read active service providers" on booking.service_providers;
create policy "members read active service providers"
  on booking.service_providers for select to authenticated
  using (
    status = 'active'
    and exists (select 1 from booking.providers p where p.provider_id = service_providers.provider_id and p.status = 'active')
    and exists (select 1 from booking.services s where s.service_id = service_providers.service_id and s.service_status in ('active','coming_soon'))
  );

drop policy if exists "members read active service packages" on booking.service_packages;
create policy "members read active service packages"
  on booking.service_packages for select to authenticated
  using (
    status = 'active'
    and exists (select 1 from booking.services s where s.service_id = service_packages.service_id and s.service_status = 'active')
  );

alter table booking.orders
  add column if not exists provider_id text references booking.providers(provider_id),
  add column if not exists booking_details jsonb not null default '{}'::jsonb;

-- Preserve the original rows under their new IDs before reusing the old IDs.
insert into booking.services (
  service_id, category_id, service_name, short_description, full_description, cover_image,
  price, price_type, booking_type, duration, location, service_status, is_featured, sort_order,
  service_type, price_unit, included_hours, min_hours, additional_hour_price, deposit,
  companion_modes, requires_provider
)
select 'MAN-007', category_id, service_name, short_description, full_description, cover_image,
       price, price_type, booking_type, duration, location, service_status, is_featured, 170,
       'staff', 'project', null, null, null, null, '{}', false
from booking.services where service_id = 'MAN-004'
on conflict (service_id) do nothing;

insert into booking.services (
  service_id, category_id, service_name, short_description, full_description, cover_image,
  price, price_type, booking_type, duration, location, service_status, is_featured, sort_order,
  service_type, price_unit, included_hours, min_hours, additional_hour_price, deposit,
  companion_modes, requires_provider
)
select 'SPACE-008', category_id, service_name, short_description, full_description, cover_image,
       price, price_type, booking_type, duration, location, service_status, is_featured, 280,
       'space', 'project', null, null, null, null, '{}', false
from booking.services where service_id = 'SPACE-006'
on conflict (service_id) do nothing;

insert into booking.services (
  service_id, category_id, service_name, short_description, full_description, cover_image,
  price, price_type, booking_type, duration, location, service_status, is_featured, sort_order,
  service_type, price_unit, included_hours, min_hours, additional_hour_price, deposit,
  companion_modes, requires_provider
)
select 'SPACE-009', category_id, service_name, short_description, full_description, cover_image,
       price, price_type, booking_type, duration, location, service_status, is_featured, 290,
       'space', 'project', null, null, null, null, '{}', false
from booking.services where service_id = 'SPACE-007'
on conflict (service_id) do nothing;

-- service_inquiries.service_name is a snapshot, so changing the reused service rows does not rewrite historical inquiry labels.
insert into booking.services (
  service_id, category_id, service_name, short_description, full_description,
  price, price_type, booking_type, service_status, is_featured, sort_order,
  service_type, price_unit, included_hours, min_hours, additional_hour_price, deposit,
  companion_modes, requires_provider
) values
  ('REC-001','recording_space','錄音體驗','第一次進錄音室也能安心完成作品','適合個人錄歌、情侶、親子、生日、告白、紀念、學生與社團。',800,'starting_from','direct_booking','active',true,10,'recording','session',null,1,null,null,'{}',false),
  ('REC-002','recording_space','一日歌手','完整的一日歌手錄音體驗','包含專業錄音室、錄音設備、錄音師協助與多次 Take。',2300,'starting_from','direct_booking','active',true,20,'recording','session',null,1,null,null,'{}',false),
  ('REC-003','recording_space','錄音室租借','依小時計價的錄音空間','適合已有明確錄音流程的個人與團隊。',800,'starting_from','direct_booking','active',false,30,'recording','hour',null,1,null,null,'{}',false),
  ('REC-004','recording_space','Podcast 錄製','Podcast 錄音與基礎設備使用','依集數、時數與製作需求確認內容。',1200,'starting_from','direct_booking','active',false,40,'recording','session',null,1,null,null,'{}',false),
  ('REC-005','recording_space','配音／旁白錄製','配音、旁白與口白錄製','依腳本長度、用途與後製需求人工評估。',800,'starting_from','custom_quote','active',false,50,'recording','session',null,1,null,null,'{}',false),
  ('REC-006','recording_space','錄音＋後製','錄音與後製整合服務','依素材、軌數與成品規格人工評估。',1500,'starting_from','custom_quote','active',false,60,'recording','session',null,1,null,null,'{}',false),

  ('AI-001','ai_digital','AI 簡報製作','從簡報架構到基礎視覺美化','實際費用依頁數與複雜度確認。',150,'starting_from','direct_booking','active',true,70,'ai_digital','project',null,null,null,null,'{}',false),
  ('AI-002','ai_digital','一頁式網站','品牌與服務的一頁式網站','依功能、內容與視覺需求人工評估。',6000,'starting_from','custom_quote','active',true,80,'ai_digital','project',null,null,null,null,'{}',false),
  ('AI-003','ai_digital','Excel／表單自動化','整理資料並減少重複工作','可處理表格、計算、報表與表單串接。',1000,'starting_from','custom_quote','active',true,90,'ai_digital','project',null,null,null,null,'{}',false),
  ('AI-004','ai_digital','AI／數位系統客製','依需求規劃 AI 與數位流程','適用工作流程、自動化、資料管理與工具串接。',3000,'starting_from','custom_quote','active',true,100,'ai_digital','project',null,null,null,null,'{}',false),
  ('AI-005','ai_digital','AI 工作流程規劃','盤點並設計可執行的 AI 工作流程','依流程範圍與整合需求人工評估。',1500,'starting_from','custom_quote','active',false,110,'ai_digital','project',null,null,null,null,'{}',false),
  ('AI-006','ai_digital','AI Agent／自動化規劃','規劃 Agent 與跨工具自動化','依系統範圍與整合需求人工評估。',3000,'starting_from','custom_quote','active',false,120,'ai_digital','project',null,null,null,null,'{}',false),
  ('AI-007','ai_digital','AI 生圖／視覺製作','AI 圖像與基礎視覺內容製作','依張數、尺寸與商用需求人工評估。',500,'starting_from','custom_quote','active',false,130,'ai_digital','project',null,null,null,null,'{}',false),
  ('AI-008','ai_digital','AI 內容製作','AI 輔助文字與內容製作','依內容長度、用途與交付規格人工評估。',1000,'starting_from','custom_quote','active',false,140,'ai_digital','project',null,null,null,null,'{}',false),

  ('MAN-001','temporary_staff','活動工作人員','活動現場執行支援','依時數、人數與工作內容人工評估。',250,'starting_from','custom_quote','active',true,150,'staff','hour',null,1,null,null,'{}',false),
  ('MAN-002','temporary_staff','現場活動支援','現場活動與場務協助','依時數、人數與工作內容人工評估。',300,'starting_from','custom_quote','active',true,160,'staff','hour',null,1,null,null,'{}',false),
  ('MAN-003','temporary_staff','臨時行政支援','短期行政與文書協助','依時數與工作內容人工評估。',300,'starting_from','custom_quote','active',true,170,'staff','hour',null,1,null,null,'{}',false),
  ('MAN-004','temporary_staff','報到／接待人員','報到、引導與接待支援','依時數、人數與工作內容人工評估。',300,'starting_from','custom_quote','active',false,180,'staff','hour',null,1,null,null,'{}',false),
  ('MAN-005','temporary_staff','展場／活動支援','展場與活動現場執行協助','依時數、人數與工作內容人工評估。',300,'starting_from','custom_quote','active',false,190,'staff','hour',null,1,null,null,'{}',false),
  ('MAN-006','temporary_staff','短期專案人力','短期或單次專案人力','由人工確認工作內容、期間與報價。',null,'custom_quote','custom_quote','active',false,200,'staff','project',null,null,null,null,'{}',false),
  ('MAN-007','temporary_staff','急件支援','急件需求先由人工確認','提出需求後由人工確認、報價，客戶確認後才轉訂單。',null,'custom_quote','custom_quote','coming_soon',false,210,'staff','project',null,null,null,null,'{}',false),

  ('SPACE-001','venue_equipment','彈性辦公座位','兩小時彈性辦公座位','場地服務預備中。',150,'starting_from','direct_booking','coming_soon',false,220,'space','session',2,2,null,null,'{}',false),
  ('SPACE-002','venue_equipment','半日辦公空間','半日辦公空間使用','場地服務預備中。',300,'starting_from','direct_booking','coming_soon',false,230,'space','half_day',null,null,null,null,'{}',false),
  ('SPACE-003','venue_equipment','一日辦公空間','一日辦公空間使用','場地服務預備中。',500,'starting_from','direct_booking','coming_soon',false,240,'space','day',null,null,null,null,'{}',false),
  ('SPACE-004','venue_equipment','小型會議空間','依小時計價的小型會議空間','場地服務預備中。',500,'starting_from','direct_booking','coming_soon',false,250,'space','hour',null,1,null,null,'{}',false),
  ('SPACE-005','venue_equipment','拍攝空間','依小時計價的拍攝空間','場地服務預備中。',800,'starting_from','direct_booking','coming_soon',false,260,'space','hour',null,1,null,null,'{}',false),
  ('SPACE-006','venue_equipment','直播空間','依小時計價的直播空間','場地服務預備中。',800,'starting_from','direct_booking','coming_soon',false,270,'space','hour',null,1,null,null,'{}',false),
  ('SPACE-007','venue_equipment','活動場地','活動場地需求先詢價','場地服務預備中。',1500,'starting_from','custom_quote','coming_soon',false,280,'space','session',null,null,null,null,'{}',false),
  ('SPACE-008','venue_equipment','商務地址','商務地址服務','目前不公開上架。',null,'custom_quote','custom_quote','hidden',false,290,'space','project',null,null,null,null,'{}',false),
  ('SPACE-009','venue_equipment','虛擬辦公','虛擬辦公服務','目前不公開上架。',null,'custom_quote','custom_quote','hidden',false,300,'space','project',null,null,null,null,'{}',false)
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
  service_type = excluded.service_type,
  price_unit = excluded.price_unit,
  included_hours = excluded.included_hours,
  min_hours = excluded.min_hours,
  additional_hour_price = excluded.additional_hour_price,
  deposit = excluded.deposit,
  companion_modes = excluded.companion_modes,
  requires_provider = excluded.requires_provider,
  updated_at = now();

-- Companion services: location is set only for COMP-* rows so other service locations stay untouched.
insert into booking.services (
  service_id, category_id, service_name, short_description, full_description,
  price, price_type, booking_type, service_status, is_featured, sort_order,
  service_type, price_unit, included_hours, min_hours, additional_hour_price, deposit,
  companion_modes, requires_provider, location
) values
  ('COMP-001','venue_equipment','陪工作｜完全安靜','安靜地一起開始並維持工作節奏','可一起工作、一起使用空間或安靜坐在附近；陪工作不是幫工作。',299,'fixed','direct_booking','active',true,310,'companion','session',2,2,150,null,array['quiet'],true,'莓好工作空間（預約確認後通知地點）'),
  ('COMP-002','venue_equipment','陪工作｜低互動','在需要時簡短交流的共同工作','可在開始與休息時簡單交流；陪工作不是幫工作。',399,'fixed','direct_booking','active',true,320,'companion','session',2,2,200,null,array['low_interaction'],true,'莓好工作空間（預約確認後通知地點）'),
  ('COMP-003','venue_equipment','陪上班','用共同存在感陪你完成一段工作時間','可選安靜、低互動或一起工作；陪工作不是幫工作。',499,'fixed','direct_booking','active',true,330,'companion','session',3,3,150,null,array['quiet','low_interaction','together'],true,'莓好工作空間（預約確認後通知地點）'),
  ('COMP-004','venue_equipment','陪讀／陪學習','一起維持閱讀或學習節奏','陪工作不是幫工作。',399,'fixed','direct_booking','coming_soon',false,340,'companion','session',2,2,200,null,array['quiet','low_interaction','together'],true,'莓好工作空間（預約確認後通知地點）'),
  ('COMP-005','venue_equipment','陪創作','一起維持創作節奏','陪工作不是幫工作。',399,'fixed','direct_booking','coming_soon',false,350,'companion','session',2,2,200,null,array['quiet','low_interaction','together'],true,'莓好工作空間（預約確認後通知地點）'),
  ('COMP-006','venue_equipment','Body Doubling','透過共同存在協助維持專注','以 Body Doubling 模式共同工作；陪工作不是幫工作。',499,'fixed','direct_booking','active',true,360,'companion','session',2,2,250,null,array['body_doubling'],true,'莓好工作空間（預約確認後通知地點）'),
  ('COMP-007','venue_equipment','陪你完成一件事','一起在指定時間推進一件事','可選全部陪伴模式；陪工作不是幫工作。',599,'fixed','direct_booking','coming_soon',false,370,'companion','session',2,2,300,null,array['quiet','low_interaction','together','body_doubling'],true,'莓好工作空間（預約確認後通知地點）'),
  ('COMP-008','venue_equipment','客製陪伴','依需求規劃客製陪伴','由人工確認需求與報價；陪工作不是幫工作。',300,'starting_from','custom_quote','coming_soon',false,380,'companion','hour',null,1,null,null,array['quiet','low_interaction','together','body_doubling'],true,'莓好工作空間（預約確認後通知地點）')
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
  service_type = excluded.service_type,
  price_unit = excluded.price_unit,
  included_hours = excluded.included_hours,
  min_hours = excluded.min_hours,
  additional_hour_price = excluded.additional_hour_price,
  deposit = excluded.deposit,
  companion_modes = excluded.companion_modes,
  requires_provider = excluded.requires_provider,
  location = excluded.location,
  updated_at = now();

insert into booking.providers (provider_id, display_name, provider_type, bio, status)
values ('PRV-MEIHAU','莓好','person','陪工作／共同存在型服務者。','active')
on conflict (provider_id) do update set
  display_name = excluded.display_name,
  provider_type = excluded.provider_type,
  bio = excluded.bio,
  status = excluded.status,
  updated_at = now();

insert into booking.service_providers (service_id, provider_id, status, sort_order)
select service_id, 'PRV-MEIHAU', 'active', sort_order
from booking.services
where service_type = 'companion'
on conflict (service_id, provider_id) do update set
  status = excluded.status,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into booking.service_packages (
  package_id, service_id, package_name, price, session_count, included_hours, billing_period, status, sort_order
) values
  ('PKG-COMP-01','COMP-001','單次體驗',299,1,2,'once','hidden',10),
  ('PKG-COMP-04','COMP-001','4 次專注包',1099,4,8,'once','hidden',20),
  ('PKG-COMP-08','COMP-001','8 次工作包',1999,8,16,'once','hidden',30),
  ('PKG-COMP-SUB','COMP-001','月訂閱',1999,8,16,'month','hidden',40)
on conflict (package_id) do update set
  service_id = excluded.service_id,
  package_name = excluded.package_name,
  price = excluded.price,
  session_count = excluded.session_count,
  included_hours = excluded.included_hours,
  billing_period = excluded.billing_period,
  status = excluded.status,
  sort_order = excluded.sort_order,
  updated_at = now();

commit;
