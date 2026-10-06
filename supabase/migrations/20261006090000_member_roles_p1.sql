begin;

alter table booking.members
  add column if not exists avatar_url text not null default '',
  add column if not exists region text not null default '',
  add column if not exists bio text not null default '',
  add column if not exists is_public boolean not null default false,
  add column if not exists account_status text not null default 'active',
  add column if not exists last_login_at timestamptz,
  add column if not exists admin_note text not null default '';
alter table booking.members drop constraint if exists members_bio_check;
alter table booking.members add constraint members_bio_check check (char_length(bio) <= 2000);
alter table booking.members drop constraint if exists members_account_status_check;
alter table booking.members add constraint members_account_status_check check (account_status in ('active','suspended'));

alter table booking.providers
  add column if not exists user_id uuid,
  add column if not exists entity_type text not null default 'individual',
  add column if not exists brand_name text not null default '',
  add column if not exists service_area text not null default '',
  add column if not exists service_mode text not null default 'both',
  add column if not exists website text not null default '',
  add column if not exists instagram text not null default '',
  add column if not exists facebook text not null default '',
  add column if not exists line text not null default '',
  add column if not exists portfolio_urls text[] not null default '{}',
  add column if not exists pricing_description text not null default '',
  add column if not exists quote_method text not null default '',
  add column if not exists member_discount text not null default '',
  add column if not exists accept_projects boolean not null default false,
  add column if not exists accept_long_term boolean not null default false,
  add column if not exists available_hours text not null default '',
  add column if not exists availability_status text not null default 'available',
  add column if not exists approval_status text,
  add column if not exists admin_note text not null default '';
alter table booking.providers drop constraint if exists providers_user_id_fkey;
alter table booking.providers add constraint providers_user_id_fkey foreign key (user_id) references booking.members(user_id);
alter table booking.providers drop constraint if exists providers_user_id_key;
alter table booking.providers add constraint providers_user_id_key unique (user_id);
alter table booking.providers drop constraint if exists providers_entity_type_check;
alter table booking.providers add constraint providers_entity_type_check check (entity_type in ('individual','brand','store'));
alter table booking.providers drop constraint if exists providers_service_mode_check;
alter table booking.providers add constraint providers_service_mode_check check (service_mode in ('online','offline','both'));
alter table booking.providers drop constraint if exists providers_availability_status_check;
alter table booking.providers add constraint providers_availability_status_check check (availability_status in ('available','partial','paused','internal_only','standby'));
alter table booking.providers drop constraint if exists providers_approval_status_check;
alter table booking.providers add constraint providers_approval_status_check check (approval_status in ('pending','approved','rejected','suspended'));
update booking.providers set approval_status = 'approved' where provider_id = 'PRV-MEIHAU' and approval_status is null;
update booking.providers set approval_status = 'pending' where approval_status is null;
alter table booking.providers alter column approval_status set default 'pending';
alter table booking.providers alter column approval_status set not null;
alter table booking.providers drop constraint if exists providers_portfolio_urls_check;
alter table booking.providers add constraint providers_portfolio_urls_check check (cardinality(portfolio_urls) <= 10);

create table if not exists booking.member_roles (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, role_key text not null, status text not null default 'pending',
  applied_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid, review_note text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table booking.member_roles drop constraint if exists member_roles_user_id_fkey;
alter table booking.member_roles add constraint member_roles_user_id_fkey foreign key (user_id) references booking.members(user_id);
alter table booking.member_roles drop constraint if exists member_roles_reviewed_by_fkey;
alter table booking.member_roles add constraint member_roles_reviewed_by_fkey foreign key (reviewed_by) references booking.members(user_id);
alter table booking.member_roles drop constraint if exists member_roles_user_role_key;
alter table booking.member_roles add constraint member_roles_user_role_key unique (user_id, role_key);
alter table booking.member_roles drop constraint if exists member_roles_role_key_check;
alter table booking.member_roles add constraint member_roles_role_key_check check (role_key in ('member','provider','partner','resource_seeker'));
alter table booking.member_roles drop constraint if exists member_roles_status_check;
alter table booking.member_roles add constraint member_roles_status_check check (status in ('pending','approved','rejected','inactive'));

create table if not exists booking.tags (
  tag_id uuid primary key default gen_random_uuid(), tag_type text not null, name text not null, slug text not null,
  status text not null default 'active', sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table booking.tags drop constraint if exists tags_type_slug_key;
alter table booking.tags add constraint tags_type_slug_key unique (tag_type, slug);
alter table booking.tags drop constraint if exists tags_tag_type_check;
alter table booking.tags add constraint tags_tag_type_check check (tag_type in ('identity','skill','service','project_type','cooperation_type','resource_type','region'));
alter table booking.tags drop constraint if exists tags_status_check;
alter table booking.tags add constraint tags_status_check check (status in ('active','hidden','archived'));
alter table booking.tags drop constraint if exists tags_name_check;
alter table booking.tags add constraint tags_name_check check (char_length(name) between 1 and 120 and char_length(slug) between 1 and 120);

create table if not exists booking.member_tags (
  user_id uuid not null, tag_id uuid not null, source text not null default 'self', status text not null default 'active',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key (user_id, tag_id)
);
alter table booking.member_tags drop constraint if exists member_tags_user_id_fkey;
alter table booking.member_tags add constraint member_tags_user_id_fkey foreign key (user_id) references booking.members(user_id);
alter table booking.member_tags drop constraint if exists member_tags_tag_id_fkey;
alter table booking.member_tags add constraint member_tags_tag_id_fkey foreign key (tag_id) references booking.tags(tag_id);
alter table booking.member_tags drop constraint if exists member_tags_source_check;
alter table booking.member_tags add constraint member_tags_source_check check (source in ('self','admin'));
alter table booking.member_tags drop constraint if exists member_tags_status_check;
alter table booking.member_tags add constraint member_tags_status_check check (status in ('active','inactive'));

create table if not exists booking.partners (
  partner_id uuid primary key default gen_random_uuid(), user_id uuid not null, organization_name text not null default '', partner_types text[] not null default '{}',
  introduction text not null default '', website text not null default '', social_links jsonb not null default '{}'::jsonb, location text not null default '', service_area text not null default '',
  resources text[] not null default '{}', cooperation_methods text[] not null default '{}', cooperation_conditions text not null default '', price_description text not null default '',
  member_discount text not null default '', advertising_interest boolean not null default false, matching_interest boolean not null default false,
  approval_status text not null default 'pending', admin_note text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table booking.partners drop constraint if exists partners_user_id_fkey;
alter table booking.partners add constraint partners_user_id_fkey foreign key (user_id) references booking.members(user_id);
alter table booking.partners drop constraint if exists partners_user_id_key;
alter table booking.partners add constraint partners_user_id_key unique (user_id);
alter table booking.partners drop constraint if exists partners_types_check;
alter table booking.partners add constraint partners_types_check check (partner_types <@ array['store','brand','supplier','advertising','cross_industry','channel','venue','lecturer','consultant','other']::text[]);
alter table booking.partners drop constraint if exists partners_approval_status_check;
alter table booking.partners add constraint partners_approval_status_check check (approval_status in ('pending','approved','rejected','suspended'));

create table if not exists booking.seeker_profiles (
  user_id uuid primary key, looking_for text not null default '', need_categories text[] not null default '{}', budget_min integer, budget_max integer,
  region text not null default '', timeline text not null default '', cooperation_type text not null default '', is_public boolean not null default false,
  accept_matching boolean not null default true, approval_status text not null default 'pending', admin_note text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table booking.seeker_profiles drop constraint if exists seeker_profiles_user_id_fkey;
alter table booking.seeker_profiles add constraint seeker_profiles_user_id_fkey foreign key (user_id) references booking.members(user_id);
alter table booking.seeker_profiles drop constraint if exists seeker_profiles_budget_check;
alter table booking.seeker_profiles add constraint seeker_profiles_budget_check check (budget_min is null or budget_min >= 0) not valid;
alter table booking.seeker_profiles drop constraint if exists seeker_profiles_budget_range_check;
alter table booking.seeker_profiles add constraint seeker_profiles_budget_range_check check (budget_max is null or (budget_max >= 0 and (budget_min is null or budget_max >= budget_min))) not valid;
alter table booking.seeker_profiles drop constraint if exists seeker_profiles_approval_status_check;
alter table booking.seeker_profiles add constraint seeker_profiles_approval_status_check check (approval_status in ('pending','approved','rejected','suspended'));

create table if not exists booking.agreements (
  agreement_id uuid primary key default gen_random_uuid(), agreement_key text not null, version integer not null, title text not null, body_md text not null,
  applies_to_roles text[] not null default '{}', status text not null default 'draft', published_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table booking.agreements drop constraint if exists agreements_key_version_key;
alter table booking.agreements add constraint agreements_key_version_key unique (agreement_key, version);
alter table booking.agreements drop constraint if exists agreements_key_check;
alter table booking.agreements add constraint agreements_key_check check (agreement_key in ('member_terms','provider_rules','partner_rules','seeker_rules','matching_rules','payment_rules'));
alter table booking.agreements drop constraint if exists agreements_version_check;
alter table booking.agreements add constraint agreements_version_check check (version > 0);
alter table booking.agreements drop constraint if exists agreements_status_check;
alter table booking.agreements add constraint agreements_status_check check (status in ('draft','active','retired'));
alter table booking.agreements drop constraint if exists agreements_roles_check;
alter table booking.agreements add constraint agreements_roles_check check (applies_to_roles <@ array['member','provider','partner','resource_seeker']::text[]);
create unique index if not exists booking_agreements_one_active_key on booking.agreements(agreement_key) where status = 'active';

create table if not exists booking.member_agreements (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, agreement_id uuid not null, agreement_key text not null, agreement_version integer not null,
  agreed_at timestamptz not null default now(), status text not null default 'agreed', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table booking.member_agreements drop constraint if exists member_agreements_user_id_fkey;
alter table booking.member_agreements add constraint member_agreements_user_id_fkey foreign key (user_id) references booking.members(user_id);
alter table booking.member_agreements drop constraint if exists member_agreements_agreement_id_fkey;
alter table booking.member_agreements add constraint member_agreements_agreement_id_fkey foreign key (agreement_id) references booking.agreements(agreement_id);
alter table booking.member_agreements drop constraint if exists member_agreements_user_agreement_key;
alter table booking.member_agreements add constraint member_agreements_user_agreement_key unique (user_id, agreement_id);
alter table booking.member_agreements drop constraint if exists member_agreements_status_check;
alter table booking.member_agreements add constraint member_agreements_status_check check (status in ('agreed','superseded'));

create index if not exists booking_member_roles_user_status_idx on booking.member_roles(user_id, status);
create index if not exists booking_member_roles_review_idx on booking.member_roles(role_key, status, applied_at);
create index if not exists booking_member_tags_tag_idx on booking.member_tags(tag_id, status, user_id);
create index if not exists booking_member_agreements_user_idx on booking.member_agreements(user_id, status, agreement_key);

create or replace function booking.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
do $triggers$
declare table_name text;
begin
  foreach table_name in array array['member_roles','tags','member_tags','partners','seeker_profiles','agreements','member_agreements'] loop
    execute format('drop trigger if exists set_updated_at on booking.%I', table_name);
    execute format('create trigger set_updated_at before update on booking.%I for each row execute function booking.set_updated_at()', table_name);
  end loop;
end $triggers$;

alter table booking.members enable row level security; alter table booking.members force row level security;
alter table booking.providers enable row level security; alter table booking.providers force row level security;
alter table booking.member_roles enable row level security; alter table booking.member_roles force row level security;
alter table booking.tags enable row level security; alter table booking.tags force row level security;
alter table booking.member_tags enable row level security; alter table booking.member_tags force row level security;
alter table booking.partners enable row level security; alter table booking.partners force row level security;
alter table booking.seeker_profiles enable row level security; alter table booking.seeker_profiles force row level security;
alter table booking.agreements enable row level security; alter table booking.agreements force row level security;
alter table booking.member_agreements enable row level security; alter table booking.member_agreements force row level security;

drop policy if exists "members read active providers" on booking.providers;
revoke all on booking.members, booking.providers, booking.member_roles, booking.tags, booking.member_tags, booking.partners, booking.seeker_profiles, booking.agreements, booking.member_agreements from anon, authenticated;
grant select, insert, update, delete on booking.member_roles, booking.tags, booking.member_tags, booking.partners, booking.seeker_profiles, booking.agreements, booking.member_agreements to service_role;

update booking.providers set approval_status = 'approved' where provider_id = 'PRV-MEIHAU' and approval_status is null;

insert into booking.tags(tag_type, name, slug, sort_order) values
  ('identity','設計師','designer',10), ('identity','講師','lecturer',20), ('identity','店家','store',30), ('identity','品牌','brand',40), ('identity','供應商','supplier',50),
  ('skill','Canva','canva',10), ('skill','平面設計','graphic-design',20), ('skill','AI 工具','ai-tools',30), ('skill','活動企劃','event-planning',40),
  ('service','LINE 貼圖','line-sticker',10), ('service','錄音','recording',20), ('service','陪工作','co-working-companion',30), ('service','網站製作','website',40),
  ('project_type','單次專案','one-off',10), ('project_type','長期合作','long-term',20), ('project_type','活動支援','event-support',30),
  ('cooperation_type','接案','freelance',10), ('cooperation_type','異業合作','cross-industry',20), ('cooperation_type','資源交換','resource-exchange',30), ('cooperation_type','供應合作','supply',40),
  ('resource_type','生鮮','fresh-food',10), ('resource_type','場地','venue',20), ('resource_type','設備','equipment',30), ('resource_type','建國市場','jianguo-market',40),
  ('region','台中','taichung',10), ('region','北屯','beitun',20), ('region','線上','online',30)
on conflict (tag_type, slug) do nothing;

insert into booking.agreements(agreement_key, version, title, body_md, applies_to_roles, status, published_at) values
  ('member_terms',1,'莓好預約站會員條款',$body$
## 1. 會員條款

本規範為試營運版本，正式版本將另行公告，屆時將請您重新確認。

### 條文

**第 1 條　適用範圍**
1.1 本條款適用於所有以 Google 帳號登入、使用莓好預約站會員功能之人。
1.2 首次登入視為完成註冊；平台將於使用相關功能時提供本條款並取得會員同意。

**第 2 條　帳號與資料正確性**
2.1 會員應提供正確、最新的姓名、聯絡方式與預約資料。
2.2 會員應妥善保管自己的 Google 帳號，因帳號被他人使用所生之預約，由會員先行說明，平台得要求補充證明。

**第 3 條　預約規則**
3.1 正式預約須在登入後完成，預約資料與訂單集中於會員中心。
3.2 畫面上顯示之金額供即時確認，正式總計以平台後端重新計算為準。
3.3 標示「起」的價格為最低起價，不是所有案件的固定總價；正式金額由系統計價或人工報價確認。
3.4 客製服務須先完成詢價與人工確認；未定價之加購不會自行加入訂單金額。
3.5 服務邊界：平台得拒絕違法、危險、違禁品、不明包裹、可疑轉帳或依法不得代購配送之需求。
3.6 陪工作服務是「陪」不是「幫」：不替客戶工作、不代寫作業／報告、不代做設計；不提供心理諮商、醫療、職涯、法律／財務建議；不涉及性服務，不接受違法或危險工作。

**第 4 條　取消與改期**
4.1 目前系統允許會員自行取消或改期的條件為：訂單尚未付款，且服務狀態為「草稿」或「等待付款」。
4.2 取消時限、改期次數與限制，依平台於預約流程或另行公告之規定辦理。
4.3 已確認或已進行中的服務之取消、改期，依服務狀態與平台另行公告之處理方式辦理。

**第 5 條　付款與退款**
5.1 付款功能尚未啟用；建立預約不代表已付款，系統不會顯示已付款假象。
5.2 付款狀態與服務狀態分開管理，兩者含義不同。
5.3 付款方式、發票、退款條件與退款時程，將於金流正式啟用前另行公告並請會員重新同意。

**第 6 條　個資政策摘要**
6.1 蒐集項目：姓名／暱稱、Email、手機、LINE、地區、預約與訂單資料，以及會員自行填寫之合作資料。
6.2 使用目的：帳號管理、預約與訂單處理、客服聯絡、媒合與合作審核、法令遵循。
6.3 前台不公開會員之手機、Email、私人 LINE，除非會員明確選擇公開；一般聯絡由平台以「聯絡／申請合作」流程代為建立。
6.4 會員得查詢、更正其個資；保存期間、刪除與停用方式依相關法令及平台另行公告之規定辦理。
6.5 完整《隱私權政策》將由平台另行公告，本摘要不取代完整政策。

**第 7 條　會員行為**
7.1 會員不得冒用他人身分、提供不實資料、干擾系統運作、規避平台規定。
7.2 違反時，平台得依情節暫停功能、停用帳號，並保留依法處理之權利；相關程序依平台公告辦理。

**第 8 條　條款修訂**
8.1 條款更新時，平台得要求會員重新同意；會員同意之版本與時間會被記錄。

### 勾選確認句清單（前台 checkbox）

- ☐ 我已閱讀並同意《莓好預約站會員條款》（v1）。
- ☐ 我已閱讀並了解《個資政策》摘要，並同意平台依其蒐集與使用我的資料。
- ☐ 我了解預約金額以平台後端計價為準，標示「起」的價格不是固定總價。
- ☐ 我了解目前付款功能尚未啟用，建立預約不代表已付款。
- ☐ 我已閱讀預約之取消與改期規則，並同意依平台公告辦理。

$body$,array['member'],'active',now()),
  ('provider_rules',1,'服務提供者規範',$body$
## 2. 服務提供者規範

本規範為試營運版本，正式版本將另行公告，屆時將請您重新確認。

### 條文

**第 1 條　定義**
1.1 「平台」：莓好預約站。
1.2 「服務提供者」：經平台審核通過，透過平台提供專業、技能、商品或服務之會員。
1.3 「客戶」：透過平台提出需求、預約或詢價之會員或訪客，包含一般會員與資源需求者。
1.4 「平台媒合」：客戶、案件、需求或合作機會，是經由平台（含平台網站、後台管理員推薦、平台聯絡流程、平台活動或平台社群）而取得或被介紹者。
1.5 「媒合機會」：自平台媒合之日起，服務提供者與該客戶就該案件、同一需求、其延伸／追加／續約項目所形成之往來。
1.6 「平台費用」：平台因提供媒合、金流、管理等服務而依約定向服務提供者收取之媒合費、服務費或其他費用；計算方式將於正式收費前另行公告並取得同意。
1.7 「規避平台交易」：定義見第 10 條。

**第 2 條　適用期間**
2.1 本規範自服務提供者勾選同意且通過審核之日起適用，適用至帳號終止為止。
2.2 帳號終止、停權或停止接案後，對已透過平台媒合之客戶與案件仍應遵守必要之保密、個資及交易約定；相關期間與範圍依平台另行公告之規定。
2.3 規範修訂後之生效方式與重新同意期限，由平台另行公告。

**第 3 條　服務內容真實性**
3.1 服務提供者所填寫之名稱、經歷、作品集、證照、服務項目、地區與可接案狀態，須為真實且可供查證。
3.2 不得冒用他人作品、不得誇大或虛構成果、不得使用未經授權之商標或肖像。
3.3 資料有變動（停止接案、服務項目調整等）應盡速更新；平台得因資料不實暫停曝光。

**第 4 條　價格與報價規則**
4.1 服務提供者應提供清楚的價格或報價方式，並載明報價包含與不包含之項目、修改次數與加購規則。
4.2 經平台媒合之案件，報價須經客戶確認；未經確認之項目不得先行施作並要求付費。
4.3 會員優惠價（原價、平台會員價、折扣類型與期限）須真實，不得先抬高原價再打折。
4.4 報價與實際收費不一致時，平台得要求說明並更正。

**第 5 條　平台媒合方式**
5.1 第一階段採人工媒合：客戶需求經標籤與條件整理後，由平台管理員搜尋符合者並推薦，再進入報價與客戶確認。
5.2 平台不保證一定推薦、不保證成交，亦不保證案件數量或收入。
5.3 媒合紀錄（推薦、聯絡、報價、接受、拒絕、取消、完成）由平台留存，作為費用計算與爭議處理依據。
5.4 詳細流程依《媒合規範》辦理。

**第 6 條　服務／案件交付**
6.1 服務提供者應依雙方確認之內容、時程與品質交付。
6.2 如預期無法如期交付，應立即通知平台與客戶，並說明原因與補救方式。
6.3 交付後之確認方式、驗收期間與完成條件，依案件成立時雙方確認之內容或平台另行公告之規定辦理。
6.4 交付成果應為自行或合法取得授權之成果，不得交付抄襲、侵權或違法內容。

**第 7 條　取消與退款**
7.1 取消與退款之原則、時限及計算方式，將於金流正式啟用前另行公告並請服務提供者重新同意。
7.2 因服務提供者之因素導致取消或無法交付時，服務提供者不得向客戶要求不合理之款項，並應配合平台處理退款。
7.3 退款時平台費用之處理與計算方式，依案件成立時已同意之費用條件或平台另行公告之規定辦理。

**第 8 條　平台媒合費／服務費**
8.1 經平台媒合成交之案件，平台得依案件規則計算並收取媒合費或服務費。
8.2 平台服務費／媒合費之計算方式、負擔方式與結算時點，將於金流正式啟用前另行公告並請服務提供者重新同意。
8.3 正式收費前，平台應以書面或系統顯示向服務提供者明確告知，並取得其對該費用條件之同意。

**第 9 條　金流流程**
9.1 經平台成交之款項，原則上由客戶經平台金流付款，平台於扣除平台費用後，依正式金流與合作規範支付給服務提供者。
9.2 付款時點、請款週期、發票或扣繳憑證及稅務責任，依金流啟用前另行公告之規定辦理。
9.3 現階段付款功能尚未啟用，不會自動付款給服務提供者；以上流程於金流啟用並公告後才生效。

**第 10 條　禁止規避平台交易（明確定義）**
10.1 基本原則：對於透過平台媒合取得的客戶、案件或合作機會，服務提供者不得刻意繞過平台，以規避平台應收取的服務費、媒合費或其他約定費用。
10.2 「規避平台交易」指下列任一情形，且其目的或效果是使平台無法收取、或減少平台依約應收之費用：
  (a) 將平台媒合之案件改為在平台以外成交、收款或轉帳。
  (b) 引導客戶以平台以外之管道（私下加 LINE、私訊、Email、電話、其他平台）洽談、報價或交易同一案件。
  (c) 以「先在平台談、之後私下做」「先小案後大案私下接」「換個帳號或名義再接」等方式，承接已由平台媒合之客戶或其延伸、追加、續約項目。
  (d) 要求客戶不要告知平台、不要經平台付款，或提供「私下價更便宜」之誘因。
  (e) 將平台媒合取得之客戶資料轉給第三人、或由第三人（含自己之關係人、另一個帳號）代為承接。
  (f) 以任何方式隱匿、拆分、虛報案件金額或成交事實。
10.3 在適用期間內（第 2 條）及第 2.2 條所定之後續期間內，上述限制均有效。
10.4 不屬於規避之情形（避免誤傷）：
  (a) 客戶於案件結案後主動且獨立提出與原媒合案件及其延伸項目無關之全新需求。
  (b) 客戶本來就是服務提供者自己之既有客戶（非由平台媒合取得），且服務提供者能提出佐證，或事先已向平台登錄說明。
  (c) 服務提供者經平台書面同意之例外安排。
10.5 舉證與通報：懷疑有規避行為時，平台得要求雙方說明並提供往來紀錄；服務提供者有義務配合。
10.6 違反本條之處理見第 17 條。

**第 11 條　規避行為範例（說明用，非窮盡）**
違規範例：
  - 在平台聊完需求後，對客戶說「加我私人 LINE，我算你比較便宜」。
  - 平台成交一次後，下一次改請客戶直接轉帳，不再走平台。
  - 請客戶用朋友名義下單，或自己用另一個帳號承接。
  - 把平台給的客戶名單轉給同行，約定私下分帳。
  - 案件拆成兩個報價，一個走平台、一個走私下，隱匿真實成交金額。
非違規範例：
  - 在平台流程內，使用平台提供之聯絡機制與客戶溝通。
  - 客戶自行於案件結案後，主動、獨立提出與原媒合案件及其延伸項目無關之新需求。
  - 服務提供者自己原有之客戶（符合第 10.4 (b) 條件）。
  - 在平台公開之服務頁介紹自己的作品集與官方網站連結（依平台審核通過之內容）。

**第 12 條　客戶資料使用**
12.1 服務提供者因平台媒合而取得之客戶資料，僅限用於該案件之聯絡、報價、交付與售後。
12.2 不得用於行銷推廣、轉售、轉讓、建立名單、或其他與該案件無關之用途。
12.3 案件結束後，客戶資料之保存與銷毀依相關法令及平台另行公告之規定辦理。

**第 13 條　個資**
13.1 服務提供者處理客戶個資時，應遵守個人資料保護相關法令。
13.2 不得蒐集超出案件必要範圍之個資；不得將個資傳送至不安全之管道或公開張貼。
13.3 發生個資外洩或疑似外洩，應立即通知平台。

**第 14 條　保密**
14.1 對於案件內容、客戶商業資訊、未公開資料、平台後台資訊，負有保密義務。
14.2 保密義務於案件結束後仍持續，至相關資訊合法公開或已無保密必要為止。

**第 15 條　智慧財產權**
15.1 服務提供者保證其交付成果不侵害第三人智慧財產權。
15.2 成果之著作權／使用權歸屬、授權範圍、署名與作品集展示權，依雙方案件約定；未約定時，由雙方另行書面確認。
15.3 使用 AI 生成工具者，應告知客戶並遵守該工具之授權條款。

**第 16 條　爭議處理**
16.1 客戶與服務提供者之爭議，先由雙方溝通；無法解決時得通知平台協助。
16.2 平台得依媒合紀錄、往來紀錄與交付成果進行調處，並提出建議方案；相關程序依平台公告辦理。
16.3 平台之調處不排除雙方依法尋求其他救濟；管轄依相關法令或雙方合法約定辦理。

**第 17 條　違規處理**
17.1 違規情形包含：資料不實、交付嚴重瑕疵、洩漏客戶資料、規避平台交易（第 10 條）、騷擾客戶、違反法令。
17.2 處理方式依情節輕重：提醒、要求補正、暫停曝光、暫停媒合、扣留或追討應收之平台費用、停權。
17.3 規避平台交易所涉及之平台費用追償範圍與計算方式，將於正式收費前另行公告並請服務提供者重新同意，不預設任何金額。
17.4 平台處理前應給予說明機會，但情節重大或涉及違法者，得先行暫停。

**第 18 條　平台停權條件**
18.1 有下列情形之一，平台得停權：重大或多次違規、規避平台交易經查屬實、嚴重侵害客戶權益、涉及違法、提供不實資料經通知未改正。
18.2 停權後，已受理之案件之處理（完成、轉交、退款）由平台決定，並盡力保障客戶權益。
18.3 停權之申訴方式與期限，依平台通知或另行公告之規定辦理。

**第 19 條　服務品質要求**
19.1 服務提供者應在合理時間內回應客戶與平台聯絡；如案件另有約定，依該約定辦理。
19.2 按約定時程與品質交付，態度專業、不得騷擾或歧視。
19.3 平台得依客戶回饋、完成率、爭議紀錄檢視品質，並得調整曝光或媒合優先順序。

**第 20 條　規範修訂與重新同意**
20.1 平台得修訂本規範；修訂後得要求服務提供者重新勾選同意；未重新同意者，平台得暫停其接受新媒合。

### 勾選確認句清單（前台 checkbox）

- ☐ 我已閱讀並同意《服務提供者規範》（v1），並保證我所提供之服務資訊真實。
- ☐ 我了解平台採人工媒合，不保證推薦或成交。
- ☐ 我了解經平台成交之案件，平台得依約定收取媒合費／服務費，費用條件以平台屆時書面或系統告知並經我同意者為準。
- ☐ 我了解金流流程與付款時程，並同意依《金流規範》辦理。
- ☐ 我了解取消與退款之處理原則。
- ☐ 我同意不得刻意繞過平台，以規避平台應收取的服務費、媒合費或其他約定費用；我已閱讀第 10、11 條對「規避平台交易」之定義與範例。
- ☐ 我同意客戶資料僅用於該案件之聯絡與交付，並遵守個資與保密規定。
- ☐ 我保證交付成果不侵害他人智慧財產權，並了解成果權利歸屬依案件約定。
- ☐ 我了解爭議處理方式、違規處理方式與停權條件。
- ☐ 我同意遵守平台服務品質要求。

$body$,array['provider'],'active',now()),
  ('partner_rules',1,'合作夥伴規範',$body$
## 3. 合作夥伴規範

本規範為試營運版本，正式版本將另行公告，屆時將請您重新確認。

### 條文

**第 1 條　定義與適用**
1.1 「合作夥伴」：經平台審核通過，與莓好生活建立合作關係之店家、品牌、供應商或其他組織／個人。
1.2 合作模式不預設固定方案，由合作方提案、管理員審核，並建立合作紀錄。
1.3 適用期間：自勾選同意且通過審核起，至合作終止為止；合作終止後之必要義務依平台另行公告之規定辦理。

**第 2 條　合作資訊真實性**
2.1 合作夥伴所提供之名稱、營業資訊、商品／服務內容、價格、資質、地區與合作條件，須真實且可查證。
2.2 不得冒用他人名義、不得使用未經授權之商標或圖片、不得誇大或虛構。
2.3 資訊變動時應盡速更新；平台得因資訊不實下架或暫停合作。

**第 3 條　曝光規範**
3.1 平台是否公開、曝光之位置與方式（首頁推薦、服務推薦、活動曝光、社群曝光等），由管理員審核後決定；通過審核不代表保證曝光。
3.2 曝光內容不得含違法、虛偽、歧視、誤導或侵害第三人權利之內容。
3.3 平台得調整、暫停或下架曝光；通知方式與期限依合作紀錄或平台公告辦理。
3.4 廣告性質之曝光，其收費方式與費用將於合作成立前明確告知並取得同意。

**第 4 條　合作方案審核**
4.1 合作夥伴提出之方案（廣告、曝光、聯名、供應、會員優惠、資源交換、媒合、通路等）須經管理員審核，審核流程為：提案→審核→確認合作條件→建立合作紀錄→決定是否公開。
4.2 平台得要求補充資料、修改條件或拒絕方案，無須說明全部理由。
4.3 已確認之合作條件（含期限、區域、價格說明、抽成／分潤條件）以平台留存之合作紀錄為準；相關費用將於合作成立前明確告知並取得同意。

**第 5 條　會員優惠規則**
5.1 合作夥伴得提出莓好會員專屬優惠（原價、會員價、折扣類型、折扣值、起迄期間）。
5.2 優惠內容須真實，原價須為實際原價，不得先提高原價再打折。
5.3 優惠期間內不得拒絕提供，或附加未事先揭露之條件。
5.4 優惠之適用對象、是否得與其他優惠併用及成本負擔方式，以合作成立時確認之內容為準。
5.5 前台顯示格式為「莓好會員專屬優惠」；優惠的實際金額或折扣由合作夥伴提案，平台不代為決定。

**第 6 條　資料與個資**
6.1 合作過程取得之會員或客戶資料，僅限於該合作使用，不得轉售或另作行銷。
6.2 合作夥伴應遵守個資保護法令，並於合作終止後持續保護尚未合法公開之機密資訊。

**第 7 條　平台費用與金流**
7.1 若合作涉及成交、抽成、分潤或廣告費，其計算方式將於合作成立前明確告知並取得同意；金流處理依平台正式公告之規定辦理。
7.2 未於合作紀錄中確認之費用，不得主張。

**第 8 條　禁止規避平台**
8.1 對於透過平台媒合取得之客戶、案件或合作機會，合作夥伴不得改由平台以外之方式成交、收款、轉交第三人或隱匿交易，以規避應付之費用或約定。

**第 9 條　違規與終止**
9.1 違規情形（資訊不實、侵權、規避平台、未履行會員優惠、洩漏資料）之處理方式包括提醒、補正、下架、暫停合作或終止合作，相關程序依平台公告辦理。
9.2 合作終止後，已公開內容之下架方式與時程依合作紀錄或平台公告辦理。

**第 10 條　規範修訂與重新同意**
10.1 規範修訂後得要求重新同意。

### 勾選確認句清單（前台 checkbox）

- ☐ 我已閱讀並同意《合作夥伴規範》（v1）。
- ☐ 我保證所提供之合作資訊（名稱、內容、價格、資質）真實，並會在變動時更新。
- ☐ 我了解曝光內容與位置由平台審核決定，通過審核不等於保證曝光。
- ☐ 我了解合作方案須經平台審核，並以平台留存之合作紀錄為準。
- ☐ 我了解並同意會員優惠規則，所提之優惠內容真實有效。
- ☐ 我同意不得刻意繞過平台以規避約定費用，並遵守個資與保密規定。

$body$,array['partner'],'active',now()),
  ('seeker_rules',1,'資源需求者規範',$body$
## 4. 資源需求者規範

本規範為試營運版本，正式版本將另行公告，屆時將請您重新確認。

### 條文

**第 1 條　定義**
1.1 「資源需求者」：在平台上發布「資源需求」，尋找人才、服務、商品、供應商、場地、技術或合作資源之會員。
1.2 「需求」：資源需求者在平台建立之需求或案件。

**第 2 條　需求內容真實性**
2.1 需求名稱、說明、所需技能、預算範圍、期限、地區須真實，不得以虛構需求取得報價、點子或他人資料。
2.2 預算與期限之範圍應為誠實預估；有重大變動應盡速更新。
2.3 需求內容不得違法、侵權、涉及不實或危險事項；平台得拒絕或下架。

**第 3 條　媒合規則**
3.1 需求經審核後依狀態流轉（草稿、審核中、公開、媒合中、已媒合、已完成、已取消、已關閉）。
3.2 第一階段由管理員人工搜尋並推薦，平台不保證一定找到或成交，相關流程依《媒合規範》辦理。
3.3 是否公開、是否接受主動推薦，由需求者自行設定；需求者可撤回或關閉需求，已進入報價之案件依當時已確認內容或平台公告辦理。

**第 4 條　聯絡與交易規則**
4.1 與被推薦對象之聯絡，應經平台提供之流程進行；平台不會公開對方之個人手機、Email、私人 LINE，除非對方明確選擇公開。
4.2 經平台媒合而取得之對象、報價與案件，不得改由平台以外之方式成交、付款、轉交第三人或隱匿交易，以規避平台應收之費用或約定。
4.3 報價、成交、付款依平台流程與《金流規範》辦理；付款功能啟用前，平台不處理款項。
4.4 需求者不得要求對方進行違法、侵權、不合理之工作。

**第 5 條　個資與保密**
5.1 需求者取得之對方資料（姓名、聯絡方式、作品、報價）僅限於該需求之媒合與交易使用，不得公開張貼、轉售或另作他用。
5.2 對平台提供之推薦名單與對方未公開資訊負保密義務，至該資訊合法公開或已無保密必要為止。
5.3 需求者提供之需求內容與個資，平台僅用於媒合與服務目的，並依個資政策處理。

**第 6 條　違規處理**
6.1 需求不實、騷擾推薦對象、洩漏他人資料或規避平台時，平台得依情節提醒、關閉需求、暫停功能或停權；相關程序依平台公告辦理。

**第 7 條　規範修訂與重新同意**
7.1 規範修訂後得要求重新同意。

### 勾選確認句清單（前台 checkbox）

- ☐ 我已閱讀並同意《資源需求者規範》（v1）。
- ☐ 我保證所發布之需求內容（說明、預算、期限）真實，不是虛構需求。
- ☐ 我了解平台採人工媒合，不保證推薦成功或成交。
- ☐ 我同意透過平台提供之流程聯絡媒合對象，並遵守平台之交易規則，不刻意繞過平台。
- ☐ 我同意對取得之對方資料與未公開資訊予以保密，並僅用於該需求。

$body$,array['resource_seeker'],'active',now()),
  ('matching_rules',1,'媒合規範',$body$
## 5. 媒合規範

本規範為試營運版本，正式版本將另行公告，屆時將請您重新確認。

### 條文

**第 1 條　定義**
1.1 「媒合」：平台依需求、標籤與條件，推薦適合之對象並協助雙方建立聯絡、報價與合作之過程。

**第 2 條　人工媒合流程（第一階段）**
2.1 流程：需求或案件建立→標籤／技能／服務整理→管理員搜尋符合條件者→推薦→聯絡→報價→客戶確認→接受或拒絕→完成或取消。
2.2 平台將記錄已推薦、已聯絡、已報價、已接受、已拒絕、已取消與已完成等媒合進度。
2.3 推薦由管理員判斷，不以自動演算法決定；自動推薦屬後續階段，不在本版適用範圍。

**第 3 條　平台不保證成交**
3.1 平台不保證任何推薦一定成交、不保證案件數量、不保證收入或服務結果。
3.2 平台就媒合對象之專業能力，僅依其所填資料與審核結果提供參考，不為其專業品質擔保；但平台得依品質要求處理違規者。
3.3 雙方有權拒絕推薦；拒絕不需說明理由，但平台得保留紀錄。

**第 4 條　聯絡經由平台**
4.1 雙方之首次聯絡與案件洽談，應經由平台提供之聯絡／申請合作流程進行。
4.2 平台不公開會員之個人手機、Email、私人 LINE，除非該會員明確選擇公開。
4.3 媒合對象不得於平台未同意前，將他方聯絡資訊用於平台以外之用途，或引導雙方離開平台洽談。

**第 5 條　報價與成交確認**
5.1 報價須經客戶確認方成立；平台留存報價與確認紀錄。
5.2 成交後之費用計算，依案件成立前由平台明確告知並經相關人同意之費用條件辦理。

**第 6 條　不等同勞動派遣之聲明**
6.1 平台提供者為「人力、人才、服務、合作與資源之媒合與資訊平台」，一般接案媒合不等同法律上之勞動派遣。
6.2 服務提供者與客戶間為獨立之委託、承攬或其他合作關係；平台與服務提供者之間，除另有書面約定外，不因媒合而成立僱傭或勞動派遣關係。
6.3 若未來平台承接法律上之「勞動派遣」業務，須另行確認適用法規、資格與契約架構，並另訂規範，不得以本規範代之。
6.4 「臨時人力」服務之法律定位與契約架構，依相關法令及個別案件另行確認，不以本規範取代依法應訂立之契約。

**第 7 條　違規與終止媒合**
7.1 媒合過程中資料不實、騷擾、規避平台等行為，依各角色規範之違規處理辦理。
7.2 平台得因必要暫停或終止某筆媒合，並盡力保護雙方權益。

**第 8 條　規範修訂與重新同意**
8.1 規範修訂後得要求重新同意。

### 勾選確認句清單（前台 checkbox）

- ☐ 我已閱讀並同意《媒合規範》（v1）。
- ☐ 我了解平台第一階段採人工媒合，且不保證推薦一定成交。
- ☐ 我同意透過平台提供之流程聯絡媒合對象，不將對方聯絡資訊用於平台以外用途。
- ☐ 我了解平台為媒合與資訊平台，一般接案媒合不等同勞動派遣，平台與我之間不因媒合而成立僱傭關係（除另有書面約定）。

$body$,array['provider','resource_seeker'],'active',now()),
  ('payment_rules',1,'金流規範',$body$
## 6. 金流規範

本規範為試營運版本，正式版本將另行公告，屆時將請您重新確認。

### 條文

**第 1 條　目前狀態說明（綠界尚未啟用）**
1.1 目前網站付款功能尚未啟用；建立預約或訂單不代表已付款，系統不會產生付款成功之紀錄（依現有網站說明）。
1.2 綠界（ECPay）金流尚未串接；平台尚未收款、尚未自動付款給服務提供者。
1.3 平台後台目前不得更新訂單之付款狀態。
1.4 以下關於付款、退款與撥款之內容，將於金流正式啟用前另行公告並請相關會員重新同意後生效。

**第 2 條　平台代收流程**
2.1 若案件經平台成交，流程預計為：客戶付款至平台金流（綠界）→交易完成→平台依案件規則計算平台服務費／媒合費→依正式金流與合作規範支付服務提供者款項。
2.2 付款方式、手續費負擔、請款週期、發票與扣繳憑證及稅務處理，將於金流正式啟用前另行公告並請相關會員重新同意。
2.3 款項保管與代收代付依相關法令及正式公告之金流流程辦理。

**第 3 條　平台費用與款項狀態**
3.1 平台服務費／媒合費之計算方式、計算基礎、負擔方式與結算時點，將於金流正式啟用前另行公告並請相關會員重新同意。
3.2 付款進度、服務進度與撥款進度為不同概念，平台將分別記錄並清楚顯示，不得混用。

**第 4 條　費用告知與同意**
4.1 平台應於案件成立前，以書面或系統明確顯示適用之費用條件；服務提供者／合作夥伴同意後才適用。
4.2 費用條件之變更，須事先告知並取得同意，不得溯及既往。

**第 5 條　退款與取消**
5.1 退款之條件、時限、計算方式與退款方式，將於金流正式啟用前另行公告並請相關會員重新同意。
5.2 退款時平台費用之處理與已撥款之後續方式，依案件成立時已同意之費用條件或平台另行公告之規定辦理。

**第 6 條　撥款**
6.1 撥款時點、方式及其與案件驗收之關係，將於金流正式啟用前另行公告並請相關會員重新同意。
6.2 第一版不做自動付款給服務提供者；正式撥款機制於後續階段另行設計與確認。

**第 7 條　稅務與發票**
7.1 發票、稅務與依法應辦理之扣繳事項，依相關法令及平台正式公告之規定辦理。

**第 8 條　爭議與凍結**
8.1 發生款項爭議時，平台得依案件紀錄暫停相關款項處理；申訴與後續流程依平台公告辦理。

**第 9 條　交易紀錄**
9.1 平台留存必要之交易與撥款紀錄，作為對帳與爭議處理依據；保存期間依相關法令及平台公告辦理。

**第 10 條　規範修訂與重新同意**
10.1 規範修訂後得要求重新同意。

### 勾選確認句清單（前台 checkbox）

- ☐ 我已閱讀並同意《金流規範》（v1），並了解目前付款功能尚未啟用。
- ☐ 我了解未來經平台成交之款項，將依平台正式公布之金流流程辦理，平台得於付款中扣除依約定之平台費用。
- ☐ 我了解平台費用之類型與比例將於案件成立前明確告知，並於我同意後適用。
- ☐ 我了解退款、撥款與稅務之處理原則，並同意依正式公布之規定辦理。

$body$,array['provider'],'active',now())
on conflict (agreement_key, version) do nothing;

commit;
