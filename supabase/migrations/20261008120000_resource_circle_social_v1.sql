begin;

create table if not exists booking.resources (
  resource_id uuid primary key default gen_random_uuid(),
  resource_slug text not null unique check (resource_slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  resource_name text not null check (char_length(btrim(resource_name)) between 1 and 160),
  resource_description text not null default '' check (char_length(resource_description) <= 1000),
  category text not null check (category in ('benefits','ai_digital','learning','work_tools','market_work','lifestyle','events_cooperation')),
  sub_category text not null default '' check (char_length(sub_category) <= 120),
  resource_url text not null check (resource_url ~* '^https://[^[:space:]]+$'),
  thumbnail text not null default '' check (thumbnail = '' or thumbnail ~* '^https://[^[:space:]]+$'),
  status text not null default 'draft' check (status in ('draft','published','paused','archived')),
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  tags text[] not null default '{}',
  related_service_ids text[] not null default '{}',
  related_role_ids text[] not null default '{}',
  related_opportunity_ids text[] not null default '{}',
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists booking.resource_click_events (
  click_id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references booking.resources(resource_id),
  source text not null default 'resource_center' check (source in ('home','resource_center','service','circle','member')),
  destination_type text not null default 'resource' check (destination_type in ('resource','service','circle')),
  created_at timestamptz not null default now()
);

create table if not exists booking.member_resource_needs (
  need_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references booking.members(user_id),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 3000),
  category text not null default 'other' check (char_length(category) between 1 and 80),
  status text not null default 'seeking' check (status in ('draft','seeking','matched','completed','cancelled')),
  matched_resource_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists booking.circle_likes (
  like_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references booking.members(user_id),
  target_member_id uuid not null references booking.members(user_id),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint circle_likes_not_self check (user_id <> target_member_id),
  constraint circle_likes_user_target_key unique (user_id,target_member_id)
);

create table if not exists booking.circle_follows (
  follow_id uuid primary key default gen_random_uuid(),
  follower_user_id uuid not null references booking.members(user_id),
  target_member_id uuid not null references booking.members(user_id),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint circle_follows_not_self check (follower_user_id <> target_member_id),
  constraint circle_follows_user_target_key unique (follower_user_id,target_member_id)
);

create table if not exists booking.follow_categories (
  category_id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references booking.members(user_id),
  category_name text not null check (char_length(btrim(category_name)) between 1 and 80),
  is_public boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint follow_categories_owner_name_key unique (owner_user_id,category_name)
);

create table if not exists booking.follow_category_items (
  follow_id uuid not null references booking.circle_follows(follow_id),
  category_id uuid not null references booking.follow_categories(category_id),
  created_at timestamptz not null default now(),
  primary key (follow_id,category_id)
);

create table if not exists booking.matching_profile_stats (
  user_id uuid primary key references booking.matching_profiles(user_id),
  impression_count bigint not null default 0 check (impression_count >= 0),
  profile_view_count bigint not null default 0 check (profile_view_count >= 0),
  booking_count bigint not null default 0 check (booking_count >= 0),
  inquiry_count bigint not null default 0 check (inquiry_count >= 0),
  match_count bigint not null default 0 check (match_count >= 0),
  like_count bigint not null default 0 check (like_count >= 0),
  follower_count bigint not null default 0 check (follower_count >= 0),
  popularity_score numeric(18,4) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists booking.circle_scoring_settings (
  setting_key text primary key,
  weights jsonb not null check (jsonb_typeof(weights) = 'object'),
  updated_by uuid references booking.members(user_id),
  updated_at timestamptz not null default now()
);

alter table booking.matching_profiles add column if not exists avatar_url text not null default '' check (avatar_url = '' or avatar_url ~* '^https://[^[:space:]]+$');
alter table booking.matching_profiles add column if not exists welcome_name text not null default '' check (char_length(welcome_name) <= 120);
alter table booking.matching_profiles add column if not exists welcome_message text not null default '' check (char_length(welcome_message) <= 300);
alter table booking.matching_profiles add column if not exists profile_field_visibility jsonb not null default '{"display_name":true,"headline":true,"public_intro":true,"avatar_url":true,"service_region":true,"contact":false,"social":false,"address":false}'::jsonb check (jsonb_typeof(profile_field_visibility) = 'object');
alter table booking.matching_profiles add column if not exists booking_enabled boolean not null default true;
alter table booking.matching_profiles add column if not exists inquiry_enabled boolean not null default true;
alter table booking.matching_profiles add column if not exists inquiry_items text[] not null default '{}';
alter table booking.matching_profiles add column if not exists matching_enabled boolean not null default true;
alter table booking.matching_profiles add column if not exists matching_items text[] not null default '{}';
alter table booking.matching_profiles add column if not exists verification_info_visible boolean not null default true;
alter table booking.matching_profiles add column if not exists is_public boolean;
alter table booking.matching_profiles add column if not exists is_recommendable boolean;
alter table booking.matching_profiles add column if not exists is_carousel_enabled boolean not null default false;
alter table booking.matching_profiles add column if not exists carousel_status text not null default 'inactive' check (carousel_status in ('inactive','pending','active','paused','ended'));
alter table booking.matching_profiles add column if not exists carousel_start_at timestamptz;
alter table booking.matching_profiles add column if not exists carousel_end_at timestamptz;
alter table booking.matching_profiles add column if not exists carousel_priority integer not null default 0 check (carousel_priority between 0 and 100000);
alter table booking.matching_profiles add column if not exists circle_joined_at timestamptz not null default now();
alter table booking.matching_profiles add column if not exists profile_updated_at timestamptz not null default now();

create index if not exists booking_resources_public_idx on booking.resources(status,featured desc,sort_order,created_at desc);
create index if not exists booking_resources_category_idx on booking.resources(category,status,sort_order);
create index if not exists booking_resource_click_events_resource_idx on booking.resource_click_events(resource_id,created_at desc);
create index if not exists booking_member_resource_needs_owner_idx on booking.member_resource_needs(user_id,status,created_at desc);
create index if not exists booking_circle_likes_target_idx on booking.circle_likes(target_member_id,status);
create index if not exists booking_circle_follows_target_idx on booking.circle_follows(target_member_id,status);
create index if not exists booking_follow_categories_owner_idx on booking.follow_categories(owner_user_id,status,sort_order);
create index if not exists booking_matching_profile_stats_popular_idx on booking.matching_profile_stats(popularity_score desc,user_id);
create index if not exists booking_matching_profiles_discovery_idx on booking.matching_profiles(publish_status,is_public,is_recommendable,circle_joined_at desc);

insert into booking.resources (resource_slug,resource_name,resource_description,category,sub_category,resource_url,status,sort_order,tags,related_service_ids,related_role_ids,related_opportunity_ids,featured)
values
('subsidy-daily','補助日報','每日補助資訊、可申請與即將截止的福利整理。','benefits','福利／補助','https://subsidydb-ockxzv95.manus.space','published',10,array['補助','福利'],array['temporary_staff'],array['resource_seeker'],array['funding'],true),
('subsidy-information','補助資訊站','補助資訊集中整理，與補助日報互補。','benefits','福利／補助','https://subsidy-info-station.pages.dev','published',20,array['補助','申請'],array[]::text[],array['resource_seeker'],array['funding'],true),
('market-monitor','市場監測','掌握市場、趨勢與工作、創業、接案機會。','market_work','市場／工作／創業','https://marketshow-mzpirxfd.manus.space/','published',30,array['市場','趨勢','工作'],array['ai_digital'],array['partner','resource_seeker'],array['work','business'],true),
('learning-library','學習資源庫','AI、數位與自學資源入口。','learning','學習／課程','https://ailernhub-cixztebt.manus.space/','published',40,array['學習','AI'],array['learning','ai_digital'],array['member'],array['learning'],true),
('berry-sticker-studio','莓好貼圖工坊','AI 與 LINE 貼圖創作工具，協助發展個人 IP。','ai_digital','AI／創作','https://berry-sticker-studio-app.flylong44.workers.dev/','published',50,array['AI','LINE貼圖','創作'],array['ai_digital'],array['provider'],array['creation'],true),
('ai-commerce-visual','AI電商視覺製作','商品圖片與 AI 電商視覺製作工具。','ai_digital','電商視覺','https://develop.ai-commerce-visual-course.pages.dev/','published',60,array['AI','電商','視覺'],array['ai_digital'],array['provider','partner'],array['commerce'],true),
('socialnest','社群管家','社群管理、內容與工作流程工具。','ai_digital','社群工具','https://socialnest-validation-go-live-1b.flylong44.workers.dev/','published',70,array['社群','內容'],array['ai_digital'],array['provider','partner'],array['marketing'],false),
('live-transcription','即時轉錄','會議錄音、即時轉錄與內容整理。','work_tools','工作工具','https://kuangyan-meeting-recorder.flylong44.workers.dev/','published',80,array['轉錄','會議','效率'],array['recording_space','ai_digital'],array['member','provider'],array['productivity'],false),
('website-audit','網站健檢','診斷網站問題，並可導向網站與 AI 數位服務。','work_tools','網站工具','https://website-audit-tool.pages.dev/','published',90,array['網站','健檢'],array['ai_digital'],array['provider','partner'],array['website'],true),
('fresh-market','鮮選日常','生活選品與日常需求入口。','lifestyle','生活','https://freshmarket-g2o3efku.manus.space','published',100,array['生活','選品'],array[]::text[],array['member'],array['lifestyle'],false),
('berry-meet','莓好相遇','活動、聚會、交流、揪團與合作機會。','events_cooperation','活動／合作／機會','https://zhigan-events.pages.dev/','published',110,array['活動','交流','合作'],array['venue_equipment'],array['partner','resource_seeker'],array['events','cooperation'],true)
on conflict (resource_slug) do update set
  resource_name=excluded.resource_name,resource_description=excluded.resource_description,category=excluded.category,
  sub_category=excluded.sub_category,resource_url=excluded.resource_url,status=excluded.status,sort_order=excluded.sort_order,
  tags=excluded.tags,related_service_ids=excluded.related_service_ids,related_role_ids=excluded.related_role_ids,
  related_opportunity_ids=excluded.related_opportunity_ids,featured=excluded.featured,updated_at=now();

insert into booking.matching_profile_stats(user_id)
select user_id from booking.matching_profiles on conflict (user_id) do nothing;

insert into booking.circle_scoring_settings(setting_key,weights)
values ('default','{"like":1,"follow":3,"profile_view":0.1,"booking":8,"inquiry":5,"match":10}'::jsonb)
on conflict (setting_key) do nothing;

do $triggers$
declare table_name text;
begin
  foreach table_name in array array['resources','member_resource_needs','circle_likes','circle_follows','follow_categories'] loop
    execute format('drop trigger if exists set_updated_at on booking.%I',table_name);
    execute format('create trigger set_updated_at before update on booking.%I for each row execute function booking.set_updated_at()',table_name);
  end loop;
end;
$triggers$;

alter table booking.resources enable row level security; alter table booking.resources force row level security;
alter table booking.resource_click_events enable row level security; alter table booking.resource_click_events force row level security;
alter table booking.member_resource_needs enable row level security; alter table booking.member_resource_needs force row level security;
alter table booking.circle_likes enable row level security; alter table booking.circle_likes force row level security;
alter table booking.circle_follows enable row level security; alter table booking.circle_follows force row level security;
alter table booking.follow_categories enable row level security; alter table booking.follow_categories force row level security;
alter table booking.follow_category_items enable row level security; alter table booking.follow_category_items force row level security;
alter table booking.matching_profile_stats enable row level security; alter table booking.matching_profile_stats force row level security;
alter table booking.circle_scoring_settings enable row level security; alter table booking.circle_scoring_settings force row level security;

revoke all on booking.resources,booking.resource_click_events,booking.member_resource_needs,booking.circle_likes,booking.circle_follows,booking.follow_categories,booking.follow_category_items,booking.matching_profile_stats,booking.circle_scoring_settings from public,anon,authenticated;
grant select,insert,update on booking.resources,booking.resource_click_events,booking.member_resource_needs,booking.circle_likes,booking.circle_follows,booking.follow_categories,booking.follow_category_items,booking.matching_profile_stats,booking.circle_scoring_settings to service_role;

commit;
