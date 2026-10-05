-- 警告：僅供演練環境回滾。執行會移除 Phase 1 新表與擴充欄位，正式環境執行前必須備份並再次確認。
begin;

drop table if exists booking.member_agreements;
drop table if exists booking.agreements;
drop table if exists booking.seeker_profiles;
drop table if exists booking.partners;
drop table if exists booking.member_tags;
drop table if exists booking.tags;
drop table if exists booking.member_roles;

alter table booking.providers
  drop column if exists user_id, drop column if exists entity_type, drop column if exists brand_name,
  drop column if exists service_area, drop column if exists service_mode, drop column if exists website,
  drop column if exists instagram, drop column if exists facebook, drop column if exists line,
  drop column if exists portfolio_urls, drop column if exists pricing_description, drop column if exists quote_method,
  drop column if exists member_discount, drop column if exists accept_projects, drop column if exists accept_long_term,
  drop column if exists available_hours, drop column if exists availability_status, drop column if exists approval_status,
  drop column if exists admin_note;
alter table booking.members
  drop column if exists avatar_url, drop column if exists region, drop column if exists bio,
  drop column if exists is_public, drop column if exists account_status, drop column if exists last_login_at,
  drop column if exists admin_note;

commit;
