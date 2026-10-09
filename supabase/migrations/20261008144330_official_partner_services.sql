begin;

create table if not exists booking.official_teams (
 team_id text primary key,
 team_name text not null,
 brand_name text not null default '',
 identity_type text not null default 'official_partner' check(identity_type='official_partner'),
 identity_label text not null default '官方合作' check(identity_label='官方合作'),
 team_description text not null default '',
 service_scope text[] not null default '{}',
 logo text not null default '',
 cover_image text not null default '',
 contact_method jsonb not null default '{}'::jsonb check(jsonb_typeof(contact_method)='object'),
 status text not null default 'active' check(status in('draft','active','paused','hidden','archived')),
 display_in_meihao_circle boolean not null default true,
 sort_order integer not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

alter table booking.services
 add column if not exists team_id text,
 add column if not exists pricing_type text,
 add column if not exists price_note text not null default '',
 add column if not exists application_method text not null default '',
 add column if not exists estimated_response_time text not null default '',
 add column if not exists display_in_meihao_circle boolean not null default false;
alter table booking.services drop constraint if exists services_category_id_check;
alter table booking.services add constraint services_category_id_check check(category_id in('temporary_staff','recording_space','ai_digital','venue_equipment','learning'));
alter table booking.services drop constraint if exists services_pricing_type_check;
alter table booking.services add constraint services_pricing_type_check check(pricing_type is null or pricing_type in('fixed','quote','current_campaign','contact'));
do $$ begin
 if not exists(select 1 from pg_constraint where conname='services_team_id_fkey' and conrelid='booking.services'::regclass) then
  alter table booking.services add constraint services_team_id_fkey foreign key(team_id) references booking.official_teams(team_id) on update cascade;
 end if;
end $$;
create index if not exists booking_services_team_idx on booking.services(team_id,service_status,sort_order);

create table if not exists booking.service_application_fields (
 field_id text primary key,
 service_id text not null references booking.services(service_id) on update cascade on delete cascade,
 field_key text not null check(field_key ~ '^[a-z][a-z0-9_]{1,63}$'),
 field_label text not null,
 field_type text not null check(field_type in('text','textarea','date','time','number','url')),
 required boolean not null default false,
 placeholder text not null default '',
 sort_order integer not null default 0,
 status text not null default 'active' check(status in('active','hidden','archived')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(service_id,field_key)
);

create table if not exists booking.service_price_options (
 price_option_id text primary key,
 service_id text not null references booking.services(service_id) on update cascade on delete cascade,
 option_name text not null,
 amount integer check(amount is null or amount between 0 and 1000000),
 pricing_type text not null check(pricing_type in('fixed','quote','current_campaign','contact')),
 price_note text not null default '',
 status text not null default 'active' check(status in('active','hidden','archived')),
 sort_order integer not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

alter table booking.service_inquiries add column if not exists team_id text, add column if not exists application_payload jsonb not null default '{}'::jsonb;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='service_inquiries_team_id_fkey' and conrelid='booking.service_inquiries'::regclass) then
  alter table booking.service_inquiries add constraint service_inquiries_team_id_fkey foreign key(team_id) references booking.official_teams(team_id) on update cascade;
 end if;
end $$;

alter table booking.official_teams enable row level security; alter table booking.official_teams force row level security;
alter table booking.service_application_fields enable row level security; alter table booking.service_application_fields force row level security;
alter table booking.service_price_options enable row level security; alter table booking.service_price_options force row level security;
revoke all on booking.official_teams,booking.service_application_fields,booking.service_price_options from public,anon,authenticated;
grant select on booking.official_teams,booking.service_application_fields,booking.service_price_options to authenticated;
grant select,insert,update,delete on booking.official_teams,booking.service_application_fields,booking.service_price_options to service_role;
drop policy if exists "members read active official teams" on booking.official_teams;
create policy "members read active official teams" on booking.official_teams for select to authenticated using(status='active');
drop policy if exists "members read active application fields" on booking.service_application_fields;
create policy "members read active application fields" on booking.service_application_fields for select to authenticated using(status='active' and exists(select 1 from booking.services s where s.service_id=service_application_fields.service_id and s.service_status='active'));
drop policy if exists "members read active price options" on booking.service_price_options;
create policy "members read active price options" on booking.service_price_options for select to authenticated using(status='active' and exists(select 1 from booking.services s where s.service_id=service_price_options.service_id and s.service_status='active'));

insert into booking.official_teams(team_id,team_name,brand_name,team_description,service_scope,logo,cover_image,contact_method,status,display_in_meihao_circle,sort_order) values
('TEAM-001','莓好生活｜未熟莓創研室','莓好生活／未熟莓創研室','提供 AI、數位內容、視覺設計、網站與自動化等數位服務，同時整合人力服務、手寫接案、代抄佛經、活動人力，以及預約載人／載貨等官方合作資源。',array['數位服務','人力資源','預約載人／載貨'],'assets/ui-v2/logo-icon.png','assets/ui-v2/hero-desktop.webp','{}'::jsonb,'active',true,10),
('TEAM-002','光言工作室｜光言團隊','Litesay Studio','提供空間、場地、課程、教學、活動與合作資源。',array['空間／場地','課程／教學','活動／合作資源'],'assets/meihau-booking-logo.png','assets/ui-v2/space-photo.webp',jsonb_build_object('business_id','47469531','address','台中市東區十甲路 359 號','line','@qfi6094f','phone','0918-811694','service_hours','週一至週五 09:00–18:00'),'active',true,20)
on conflict(team_id) do update set team_name=excluded.team_name,brand_name=excluded.brand_name,identity_type='official_partner',identity_label='官方合作',team_description=excluded.team_description,service_scope=excluded.service_scope,logo=excluded.logo,cover_image=excluded.cover_image,contact_method=excluded.contact_method,status=excluded.status,display_in_meihao_circle=excluded.display_in_meihao_circle,sort_order=excluded.sort_order,updated_at=now();

with seed as(select * from jsonb_to_recordset($data$[
{"id":"OFF-MEIHAU-001","team":"TEAM-001","cat":"ai_digital","name":"AI 應用與工作流","short":"AI 工具導入、Agent、自動化與生產流程規劃。","full":"AI 工具導入｜AI 工作流設計｜AI 生產流程規劃｜AI Agent 應用｜AI 自動化｜個人／小型商家流程優化｜AI 內容生產。","img":"assets/ui-v2/hero-desktop.webp","pricing":"quote","note":"依需求報價","type":"ai_digital","method":"提交需求後，由官方確認需求、報價與執行方式。","sort":1010},
{"id":"OFF-MEIHAU-002","team":"TEAM-001","cat":"ai_digital","name":"AI＋數位內容","short":"AI 圖像、文案、社群與短影音內容規劃。","full":"AI 圖像生成｜AI 文案｜社群內容｜短影音內容規劃｜圖文內容｜AI 輔助企劃｜品牌內容製作。","img":"assets/ui-v2/hero-desktop.webp","pricing":"quote","note":"依需求報價","type":"ai_digital","method":"需求 → 評估 → 報價 → 確認 → 預約／付款。","sort":1020},
{"id":"OFF-MEIHAU-003","team":"TEAM-001","cat":"ai_digital","name":"視覺設計","short":"LOGO、品牌識別、社群視覺、修圖與排版。","full":"LOGO｜CIS／VI｜社群視覺｜海報｜宣傳圖｜AI 輔助視覺設計｜圖片合成｜去背｜人像修圖｜排版。","img":"assets/ui-v2/service-photo.webp","pricing":"quote","note":"依需求報價","type":"ai_digital","method":"提交設計類型、尺寸、數量、用途、參考風格與截止日期。","sort":1030},
{"id":"OFF-MEIHAU-004","team":"TEAM-001","cat":"ai_digital","name":"網站／數位工具","short":"網站、Landing Page、小型工具與 AI 功能整合。","full":"網站製作｜Landing Page｜活動頁｜小型工具網站｜網站內容整理｜UI／UX 調整｜網站健檢｜AI 功能整合｜表單／預約流程。","img":"assets/ui-v2/hero-desktop.webp","pricing":"quote","note":"依需求報價","type":"ai_digital","method":"需求評估後報價。","sort":1040},
{"id":"OFF-MEIHAU-005","team":"TEAM-001","cat":"learning","name":"AI 教學／顧問","short":"AI 入門、工作應用、內容創作與個人品牌顧問。","full":"AI 入門｜AI 工作應用｜AI 個人品牌｜AI 內容創作｜AI 工具教學｜AI 個人 IP｜AI 工作流程顧問。","img":"assets/ui-v2/service-photo.webp","pricing":"current_campaign","note":"依當期課程／方案公告","method":"依當期課程或顧問方案提交需求。","sort":1050},
{"id":"OFF-MEIHAU-006","team":"TEAM-001","cat":"temporary_staff","name":"活動／臨時人力","short":"活動、行政、現場、報到、整理與包裝支援。","full":"活動協助｜行政支援｜現場協助｜報到｜整理｜包裝｜臨時人力。","img":"assets/ui-v2/service-errand.webp","pricing":"quote","note":"依工作內容、時間與人數報價","type":"staff","method":"填寫日期、時間、地點、人數、工作內容與預估時數。","sort":1060},
{"id":"OFF-MEIHAU-007","team":"TEAM-001","cat":"temporary_staff","name":"成人手寫接案","short":"手寫文字、卡片、指定格式與批量手寫。","full":"手寫文字｜手寫卡片｜手寫內容｜指定格式手寫｜批量手寫。","img":"assets/ui-v2/service-errand.webp","pricing":"quote","note":"依字數、張數、難度與交期報價","type":"staff","method":"提交內容、格式、數量與交期。","sort":1070},
{"id":"OFF-MEIHAU-008","team":"TEAM-001","cat":"temporary_staff","name":"成人代抄佛經","short":"成人代抄指定經文與格式，依約交付。","full":"成人代抄佛經｜指定經文｜指定格式｜手寫完成後依約交付；與兒童公益抄經／親子抄經體驗分開。","img":"assets/ui-v2/service-errand.webp","pricing":"quote","note":"依經文、份數、格式與交期報價","type":"staff","method":"提交經文、份數、格式與交期。","sort":1080},
{"id":"OFF-MEIHAU-009","team":"TEAM-001","cat":"learning","name":"兒童公益抄經","short":"兒童、親子參與的公益與書寫體驗。","full":"兒童公益抄經｜親子參與｜書寫體驗｜公益活動。","img":"assets/ui-v2/service-photo.webp","pricing":"current_campaign","note":"依活動方案公告","method":"依活動方案與場次提交參與需求。","sort":1090},
{"id":"OFF-MEIHAU-010","team":"TEAM-001","cat":"learning","name":"親子抄經體驗","short":"親子共同書寫、兒童體驗與家庭活動。","full":"親子共同書寫｜兒童體驗｜家庭活動｜公益／教育活動。","img":"assets/ui-v2/service-photo.webp","pricing":"current_campaign","note":"依活動場次公告","method":"依活動場次提交參與需求。","sort":1100},
{"id":"OFF-MEIHAU-011","team":"TEAM-001","cat":"temporary_staff","name":"預約載人","short":"指定時間、路線與長期合作的接送需求。","full":"預約接送｜指定時間載人｜特定路線｜長期合作需求。目前合作司機包含張鈺函，但系統不綁定唯一固定司機。","img":"assets/ui-v2/service-errand.webp","pricing":"quote","note":"依路線、距離、時間與服務需求報價","type":"staff","method":"提交出發地、目的地、日期、時間、人數與特殊需求。","sort":1110},
{"id":"OFF-MEIHAU-012","team":"TEAM-001","cat":"temporary_staff","name":"預約載貨","short":"指定時間取貨、地點配送與小型運送需求。","full":"預約載貨｜指定時間取貨｜指定地點配送｜小型運送需求｜長期合作需求。","img":"assets/ui-v2/service-errand.webp","pricing":"quote","note":"依距離、貨物、時間與服務需求報價","type":"staff","method":"提交取貨地、目的地、日期、時間、貨物與特殊需求。","sort":1120},
{"id":"OFF-LITESAY-013","team":"TEAM-002","cat":"venue_equipment","name":"空間／辦公空間","short":"工作、辦公、個人與小型團隊空間租借。","full":"工作空間｜辦公空間｜空間租借｜個人工作使用｜小型團隊使用。","img":"assets/ui-v2/space-photo.webp","pricing":"quote","note":"依空間、時數與方案報價","type":"space","method":"提交使用日期、時段、人數、用途與空間需求。","sort":1130},
{"id":"OFF-LITESAY-014","team":"TEAM-002","cat":"venue_equipment","name":"課程／教學場地","short":"課程、講座、教學、小型活動與工作坊場地。","full":"課程場地｜講座｜教學｜小型活動｜工作坊。","img":"assets/ui-v2/space-photo.webp","pricing":"quote","note":"依場地、時數與活動需求報價","type":"space","method":"提交使用日期、時段、人數、用途與空間需求。","sort":1140},
{"id":"OFF-LITESAY-015","team":"TEAM-002","cat":"venue_equipment","name":"活動場地","short":"親子、講座、工作坊、品牌與小型聚會場地。","full":"活動場地｜親子活動｜講座｜工作坊｜品牌活動｜小型聚會。","img":"assets/ui-v2/space-photo.webp","pricing":"quote","note":"依活動需求報價","type":"space","method":"提交活動日期、時段、人數、用途與場地需求。","sort":1150},
{"id":"OFF-LITESAY-016","team":"TEAM-002","cat":"learning","name":"課程／教學合作","short":"AI、個人 IP、創作、電商視覺與數位技能課程合作。","full":"AI 課程｜AI 個人 IP｜AI 創作｜AI 電商視覺｜數位技能｜課程營運合作。","img":"assets/ui-v2/service-photo.webp","pricing":"current_campaign","note":"依當期方案公告；補助資格依主管機關最新規定及實際審查結果為準","method":"依當期課程或合作方案提交需求。","sort":1160}
]$data$::jsonb) as x(id text,team text,cat text,name text,"short" text,"full" text,img text,pricing text,note text,"type" text,method text,"sort" integer))
insert into booking.services(service_id,team_id,category_id,service_name,short_description,full_description,cover_image,price,price_type,pricing_type,price_note,booking_type,service_type,price_unit,service_status,is_featured,display_in_meihao_circle,application_method,estimated_response_time,sort_order)
select id,team,cat,name,"short","full",img,null,'custom_quote',pricing,note,'custom_quote',"type",'project','active',"sort" in(1010,1020,1030,1040,1050,1060,1110,1120,1130,1140,1150,1160),true,method,case when pricing='current_campaign' then '依當期公告' else '官方確認後回覆' end,"sort" from seed
on conflict(service_id) do update set team_id=excluded.team_id,category_id=excluded.category_id,service_name=excluded.service_name,short_description=excluded.short_description,full_description=excluded.full_description,cover_image=excluded.cover_image,price=null,price_type='custom_quote',pricing_type=excluded.pricing_type,price_note=excluded.price_note,booking_type='custom_quote',service_type=excluded.service_type,price_unit='project',service_status='active',is_featured=excluded.is_featured,display_in_meihao_circle=true,application_method=excluded.application_method,estimated_response_time=excluded.estimated_response_time,sort_order=excluded.sort_order,updated_at=now();
update booking.services set pricing_type=case when price_type='fixed' then 'fixed' when price_type='custom_quote' then 'quote' else 'contact' end where pricing_type is null;

insert into booking.service_price_options(price_option_id,service_id,option_name,amount,pricing_type,price_note,status,sort_order) values
('OFF-LITESAY-016-ONLINE-REGULAR','OFF-LITESAY-016','LINE 貼圖實作班｜線上班原價',3280,'fixed','當期正式公告價格','active',10),
('OFF-LITESAY-016-ONLINE-EARLY','OFF-LITESAY-016','LINE 貼圖實作班｜線上班早鳥價',2624,'fixed','當期正式公告價格','active',20),
('OFF-LITESAY-016-ONLINE-EARLY-500','OFF-LITESAY-016','LINE 貼圖實作班｜線上班早鳥＋500 優惠',2124,'fixed','當期正式公告價格','active',30),
('OFF-LITESAY-016-ONSITE-REGULAR','OFF-LITESAY-016','LINE 貼圖實作班｜實體班原價',3980,'fixed','當期正式公告價格','active',40),
('OFF-LITESAY-016-ONSITE-EARLY','OFF-LITESAY-016','LINE 貼圖實作班｜實體班早鳥價',3184,'fixed','當期正式公告價格','active',50),
('OFF-LITESAY-016-ONSITE-EARLY-500','OFF-LITESAY-016','LINE 貼圖實作班｜實體班早鳥＋500 優惠',2684,'fixed','當期正式公告價格','active',60),
('OFF-LITESAY-016-GPT-ADDON','OFF-LITESAY-016','GPT 課程加購',1000,'fixed','僅作加購，不代表主課程價格','active',70)
on conflict(price_option_id) do update set option_name=excluded.option_name,amount=excluded.amount,pricing_type=excluded.pricing_type,price_note=excluded.price_note,status='active',sort_order=excluded.sort_order,updated_at=now();

with official_services as(select service_id from booking.services where team_id in('TEAM-001','TEAM-002')),
fields(field_key,field_label,field_type,required,placeholder,sort_order) as(values
('contact_name','姓名／暱稱','text',true,'請填寫聯絡人姓名或暱稱',10),('contact_method','聯絡方式','text',true,'手機、LINE 或 Email',20),('requirements','需求說明','textarea',true,'請描述需求、用途與期望成果',30),('preferred_date','預計日期','date',false,'',40),('preferred_time','預計時間','time',false,'',50),('location','地點','text',false,'服務或活動地點',60),('budget','預算（可選）','number',false,'可不填',70),('reference_url','附件／參考資料網址','url',false,'https://',80),('notes','備註','textarea',false,'其他補充事項',90))
insert into booking.service_application_fields(field_id,service_id,field_key,field_label,field_type,required,placeholder,sort_order)
select s.service_id||'-'||f.field_key,s.service_id,f.field_key,f.field_label,f.field_type,f.required,f.placeholder,f.sort_order from official_services s cross join fields f
on conflict(service_id,field_key) do update set field_label=excluded.field_label,field_type=excluded.field_type,required=excluded.required,placeholder=excluded.placeholder,sort_order=excluded.sort_order,status='active',updated_at=now();

with extras(service_id,field_key,field_label,field_type,required,placeholder,sort_order) as(values
('OFF-MEIHAU-003','design_type','設計類型','text',true,'LOGO、社群圖、海報等',110),('OFF-MEIHAU-003','size','尺寸','text',false,'例如 1080×1080',120),('OFF-MEIHAU-003','quantity','數量','number',false,'預計數量',130),('OFF-MEIHAU-003','usage','用途','text',true,'使用情境或平台',140),('OFF-MEIHAU-003','style_reference','參考風格','textarea',false,'風格方向或參考網址',150),('OFF-MEIHAU-003','deadline','截止日期','date',false,'',160),
('OFF-MEIHAU-006','people_count','人數','number',true,'需要幾位人力',110),('OFF-MEIHAU-006','work_hours','預估時數','number',true,'每人預估時數',120),('OFF-MEIHAU-006','work_content','工作內容','textarea',true,'請具體說明現場工作',130),
('OFF-MEIHAU-011','origin','出發地','text',true,'完整出發地',110),('OFF-MEIHAU-011','destination','目的地','text',true,'完整目的地',120),('OFF-MEIHAU-011','passenger_count','人數','number',true,'乘車人數',130),
('OFF-MEIHAU-012','origin','取貨地','text',true,'完整取貨地點',110),('OFF-MEIHAU-012','destination','目的地','text',true,'完整送達地點',120),('OFF-MEIHAU-012','cargo','貨物內容','textarea',true,'種類、尺寸、數量與重量',130),
('OFF-LITESAY-013','attendee_count','使用人數','number',true,'預計人數',110),('OFF-LITESAY-013','usage','使用用途','textarea',true,'工作或辦公用途',120),
('OFF-LITESAY-014','attendee_count','使用人數','number',true,'預計人數',110),('OFF-LITESAY-014','usage','使用用途','textarea',true,'課程、講座或工作坊內容',120),
('OFF-LITESAY-015','attendee_count','使用人數','number',true,'預計人數',110),('OFF-LITESAY-015','usage','活動用途','textarea',true,'活動類型與流程',120))
insert into booking.service_application_fields(field_id,service_id,field_key,field_label,field_type,required,placeholder,sort_order)
select service_id||'-'||field_key,service_id,field_key,field_label,field_type,required,placeholder,sort_order from extras
on conflict(service_id,field_key) do update set field_label=excluded.field_label,field_type=excluded.field_type,required=excluded.required,placeholder=excluded.placeholder,sort_order=excluded.sort_order,status='active',updated_at=now();

do $triggers$ declare t text; begin
 foreach t in array array['official_teams','service_application_fields','service_price_options'] loop
  execute format('drop trigger if exists set_updated_at on booking.%I',t);
  execute format('create trigger set_updated_at before update on booking.%I for each row execute function booking.set_updated_at()',t);
 end loop;
end; $triggers$;

commit;

