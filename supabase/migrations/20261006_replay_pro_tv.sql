begin;
alter table public.matches add column if not exists opponent_combat_log text not null default '' check(length(opponent_combat_log)<=200000);
create or replace function public.invalidate_complementary_log() returns trigger language plpgsql set search_path='' as $$
begin
 if new.combat_log is distinct from old.combat_log then new.opponent_combat_log:=''; end if;
 return new;
end $$;
drop trigger if exists invalidate_complementary_log on public.matches;
create trigger invalidate_complementary_log before update on public.matches for each row execute function public.invalidate_complementary_log();
create or replace function public.save_complementary_log(match_id uuid, original_log text, complementary_log text) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or length(complementary_log)>200000 then raise exception 'Invalid complementary log.'; end if;
 update public.matches set opponent_combat_log=complementary_log where id=match_id and user_id=auth.uid() and combat_log=original_log;
 if not found then raise exception 'Match changed or is unavailable. Reopen the replay and try again.'; end if;
 return match_id;
end $$;
revoke all on function public.save_complementary_log(uuid,text,text) from public,anon;
grant execute on function public.save_complementary_log(uuid,text,text) to authenticated;

-- Manage membership only from the SQL editor/service role, never user metadata.
create table if not exists public.app_admins(user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon,authenticated;
create or replace function public.is_app_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.app_admins where user_id=auth.uid())$$;
revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to anon,authenticated;

create table if not exists public.pro_tv_settings(id boolean primary key default true check(id),enabled boolean not null default false);
insert into public.pro_tv_settings(id,enabled) values(true,false) on conflict(id) do nothing;
alter table public.pro_tv_settings enable row level security;
create policy pro_tv_settings_read on public.pro_tv_settings for select to anon,authenticated using(true);
create policy pro_tv_settings_admin on public.pro_tv_settings for all to authenticated using(public.is_app_admin()) with check(public.is_app_admin());
grant select on public.pro_tv_settings to anon,authenticated;
grant update on public.pro_tv_settings to authenticated;

create table if not exists public.pro_tv_matches(
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(trim(title)) between 1 and 150),
 player text not null check(length(trim(player)) between 1 and 150),
 opponent text not null check(length(trim(opponent)) between 1 and 150),
 deck_name text not null default '' check(length(deck_name)<=150),
 opponent_deck_name text not null default '' check(length(opponent_deck_name)<=150),
 event text not null default '' check(length(event)<=150),
 round text not null default '' check(length(round)<=150),
 game_number integer not null default 1 check(game_number between 1 and 99),
 thumbnail text not null default '' check(length(thumbnail)<=2000),
 combat_log text not null check(length(combat_log) between 1 and 200000),
 opponent_combat_log text not null default '' check(length(opponent_combat_log)<=200000),
 published boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.pro_tv_matches enable row level security;
create policy pro_tv_public_read on public.pro_tv_matches for select to anon,authenticated using(public.is_app_admin() or (published and exists(select 1 from public.pro_tv_settings where enabled)));
create policy pro_tv_admin_write on public.pro_tv_matches for all to authenticated using(public.is_app_admin()) with check(public.is_app_admin());
grant select on public.pro_tv_matches to anon,authenticated;
grant insert,update,delete on public.pro_tv_matches to authenticated;
commit;
