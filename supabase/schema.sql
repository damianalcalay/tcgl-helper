-- TCGL Helper: run once in the SQL Editor of a clean Supabase project.
begin;
create type public.card_type as enum ('basic','basic_ex','mega_basic_ex','stage_1','stage_1_ex','mega_stage_1_ex','stage_2','stage_2_ex','mega_stage_2_ex','supporter','stadium','tool','item','ace_spec','energy','basic_upper_ex','basic_gx','basic_legend','basic_prime','basic_sp','basic_tag_team_gx','basic_v','stage_1_upper_ex','stage_1_gx','stage_1_legend','stage_1_prime','stage_1_sp','stage_1_tag_team_gx','stage_1_v','stage_2_upper_ex','stage_2_gx','stage_2_legend','stage_2_prime','stage_2_sp','stage_2_tag_team_gx','stage_2_v','baby','baby_ex','baby_upper_ex','baby_gx','baby_legend','baby_prime','baby_sp','baby_tag_team_gx','baby_v','break','break_ex','break_upper_ex','break_gx','break_legend','break_prime','break_sp','break_tag_team_gx','break_v','level_up','level_up_ex','level_up_upper_ex','level_up_gx','level_up_legend','level_up_prime','level_up_sp','level_up_tag_team_gx','level_up_v','mega','mega_ex','mega_upper_ex','mega_gx','mega_legend','mega_prime','mega_sp','mega_tag_team_gx','mega_v','restored','restored_ex','restored_upper_ex','restored_gx','restored_legend','restored_prime','restored_sp','restored_tag_team_gx','restored_v','v_union','v_union_ex','v_union_upper_ex','v_union_gx','v_union_legend','v_union_prime','v_union_sp','v_union_tag_team_gx','v_union_v','vmax','vmax_ex','vmax_upper_ex','vmax_gx','vmax_legend','vmax_prime','vmax_sp','vmax_tag_team_gx','vmax_v','vstar','vstar_ex','vstar_upper_ex','vstar_gx','vstar_legend','vstar_prime','vstar_sp','vstar_tag_team_gx','vstar_v','rocket_secret_machine','technical_machine','energy_basic','energy_special');
create type public.match_result as enum ('win','loss','draw');
create table public.cards (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check (length(trim(name)) between 1 and 150), type public.card_type not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id), unique(user_id,name)
);
create table public.decks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 150), playstyle text not null default '', notes text not null default '', image_path text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id)
);
create table public.deck_cards (
 printings jsonb not null default '[]'::jsonb check(jsonb_typeof(printings)='array' and jsonb_array_length(printings)<=60),
 deck_id uuid not null, card_id uuid not null, user_id uuid not null default auth.uid(), quantity smallint not null check(quantity between 1 and 60),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key(deck_id,card_id),
 foreign key(deck_id,user_id) references public.decks(id,user_id) on delete cascade,
 foreign key(card_id,user_id) references public.cards(id,user_id) on delete restrict
);
create table public.deck_variants (
 deck_id uuid not null, variant_id uuid not null, user_id uuid not null default auth.uid(), created_at timestamptz not null default now(),
 primary key(deck_id,variant_id), check(deck_id<>variant_id),
 foreign key(deck_id,user_id) references public.decks(id,user_id) on delete cascade,
 foreign key(variant_id,user_id) references public.decks(id,user_id) on delete cascade
);
-- Historical roster snapshots keep old matches accurate after deck/card edits.
create table public.matches (
 combat_log text not null default '' check(length(combat_log)<=200000), log_player text not null default '', coin_won boolean, card_back text not null default 'classic', opponent_card_back text not null default 'classic',
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 deck_id uuid not null, opponent_deck_id uuid not null, deck_name text not null, opponent_deck_name text not null,
 result public.match_result not null, my_prizes smallint not null check(my_prizes between 0 and 6), opponent_prizes smallint not null check(opponent_prizes between 0 and 6),
 starter_id uuid not null references public.cards(id) on delete restrict, opponent_starter_id uuid not null references public.cards(id) on delete restrict,
 played_at timestamptz not null default now(), notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id),
 foreign key(deck_id,user_id) references public.decks(id,user_id) on delete cascade,
 foreign key(opponent_deck_id,user_id) references public.decks(id,user_id) on delete cascade
);
create table public.match_rosters (
 printings jsonb not null default '[]'::jsonb,
 match_id uuid not null, user_id uuid not null, side text not null check(side in ('mine','opponent')), card_id uuid not null,
 card_name text not null, card_type public.card_type not null, quantity smallint not null check(quantity between 1 and 60),
 created_at timestamptz not null default now(), primary key(match_id,side,card_id),
 foreign key(match_id,user_id) references public.matches(id,user_id) on delete cascade,
 foreign key(card_id,user_id) references public.cards(id,user_id) on delete restrict
);
create function public.check_card_copy_limit() returns trigger language plpgsql set search_path='' as $$
begin
 if new.type::text not in ('energy','energy_basic') and exists(select 1 from public.deck_cards where card_id=new.id and quantity>4) then
 raise check_violation using message='Reduce deck quantities before changing this Energy card type.';
 end if;
 return new;
end $$;
create trigger card_copy_limit before update of type on public.cards for each row execute function public.check_card_copy_limit();
-- Each row represents one actual prize copy, not a lossy text list.
create table public.match_prizes (
 match_id uuid not null, user_id uuid not null, slot smallint not null check(slot between 1 and 6), card_id uuid not null,
 created_at timestamptz not null default now(), primary key(match_id,slot),
 foreign key(match_id,user_id) references public.matches(id,user_id) on delete cascade,
 foreign key(card_id,user_id) references public.cards(id,user_id) on delete restrict
);
create index cards_owner_idx on public.cards(user_id);
create index decks_owner_idx on public.decks(user_id);
create index deck_cards_owner_idx on public.deck_cards(user_id);
create index variants_owner_idx on public.deck_variants(user_id);
create index rosters_owner_idx on public.match_rosters(user_id);
create index prizes_owner_idx on public.match_prizes(user_id);
create index deck_cards_card_idx on public.deck_cards(card_id);
create index variants_target_idx on public.deck_variants(variant_id);
create index matches_deck_date_idx on public.matches(user_id,deck_id,played_at desc,id);
create index matches_opponent_idx on public.matches(opponent_deck_id);
create index matches_starter_idx on public.matches(starter_id);
create index matches_opponent_starter_idx on public.matches(opponent_starter_id);
create index rosters_card_idx on public.match_rosters(card_id);
create index prizes_card_idx on public.match_prizes(card_id);
create function public.touch_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end $$;
create trigger cards_touch before update on public.cards for each row execute function public.touch_updated_at();
create trigger decks_touch before update on public.decks for each row execute function public.touch_updated_at();
create trigger matches_touch before update on public.matches for each row execute function public.touch_updated_at();
create trigger deck_cards_touch before update on public.deck_cards for each row execute function public.touch_updated_at();
-- Serialize changes to a deck; protect the 60-card cap even outside the app.
create function public.check_deck_limit() returns trigger language plpgsql set search_path='' as $$
declare total integer;
begin
 if new.quantity>4 and not exists(select 1 from public.cards where id=new.card_id and type::text in ('energy','energy_basic')) then
 raise check_violation using message='Use 1-4 copies per non-Energy card.';
 end if;
 perform 1 from public.decks where id=new.deck_id for update;
 select coalesce(sum(quantity),0) into total from public.deck_cards where deck_id=new.deck_id and card_id<>new.card_id;
 if total+new.quantity>60 then raise exception 'A deck cannot contain more than 60 cards.'; end if;
 return new;
end $$;
create trigger deck_limit before insert or update on public.deck_cards for each row execute function public.check_deck_limit();
do $$ declare t text; begin
 foreach t in array array['cards','decks','deck_cards','deck_variants','matches','match_rosters','match_prizes'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy own_rows on public.%I for all to authenticated using (user_id=(select auth.uid())) with check(user_id=(select auth.uid()))',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
grant insert, update, delete on public.cards to authenticated;
-- Atomic writes are the only write interface for decks/matches. No partial saves.
create function public.save_deck(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); did uuid; entry jsonb; vid text; total integer:=0; cid uuid; resolved uuid; card_map jsonb:='{}';
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 did:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
 if exists(select 1 from public.decks where id=did and user_id<>uid) then raise exception 'Deck not found.'; end if;
 if nullif(payload->>'id','') is not null and not exists(select 1 from public.decks where id=did and user_id=uid) then raise exception 'Deck not found.'; end if;
 if length(trim(coalesce(payload->>'name',''))) not between 1 and 150 then raise exception 'Enter a deck name (1–150 characters).'; end if;
 if payload->>'image_path' is not null and payload->>'image_path' not like uid::text||'/%' then raise exception 'Invalid image path.'; end if;
 insert into public.decks(id,user_id,name,playstyle,notes,image_path) values(did,uid,trim(payload->>'name'),coalesce(payload->>'playstyle',''),coalesce(payload->>'notes',''),payload->>'image_path')
 on conflict(id) do update set name=excluded.name,playstyle=excluded.playstyle,notes=excluded.notes,image_path=excluded.image_path;
 for entry in select value from jsonb_array_elements(coalesce(payload->'new_cards','[]')) loop
 cid:=(entry->>'id')::uuid;
 if not exists(select 1 from jsonb_array_elements(coalesce(payload->'cards','[]')) x where x->>'card_id'=cid::text) then raise exception 'New cards must belong to the deck.'; end if;
 select id into resolved from public.cards where user_id=uid and lower(trim(name))=lower(trim(entry->>'name')) order by created_at,id limit 1;
 if resolved is null then
 insert into public.cards(id,user_id,name,type) values(cid,uid,trim(entry->>'name'),(entry->>'type')::public.card_type) returning id into resolved;
 end if;
 card_map:=card_map||jsonb_build_object(cid::text,resolved::text);
 end loop;
 delete from public.deck_cards where deck_id=did;
 for entry in select value from jsonb_array_elements(coalesce(payload->'cards','[]')) loop
 cid:=coalesce(card_map->>(entry->>'card_id'),entry->>'card_id')::uuid;
 if not exists(select 1 from public.cards where id=cid and user_id=uid) then raise exception 'Card not found.'; end if;
 total:=total+(entry->>'quantity')::integer;
 insert into public.deck_cards(deck_id,card_id,user_id,quantity,printings) values(did,cid,uid,(entry->>'quantity')::smallint,coalesce(entry->'printings','[]'::jsonb));
 end loop;
 if total>60 then raise exception 'A deck cannot contain more than 60 cards.'; end if;
 delete from public.deck_variants where deck_id=did;
 for vid in select jsonb_array_elements_text(coalesce(payload->'variants','[]')) loop
 insert into public.deck_variants(deck_id,variant_id,user_id) values(did,vid::uuid,uid);
 end loop;
 return did;
end $$;
create function public.save_match(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); mid uuid; did uuid; oid uuid; old_match public.matches; my_roster jsonb; their_roster jsonb; sid uuid; osid uuid; item jsonb; pid text; slot_no integer:=0; needed integer;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if length(coalesce(payload->>'notes',''))>200 then raise exception 'Match notes must be at most 200 characters.'; end if;
 if length(coalesce(payload->>'combat_log',''))>200000 then raise exception 'Combat log is too long.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 mid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid()); did:=(payload->>'deck_id')::uuid; oid:=(payload->>'opponent_deck_id')::uuid;
 if nullif(payload->>'id','') is not null then
 select * into old_match from public.matches where id=mid and user_id=uid;
 if not found then raise exception 'Match not found.'; end if;
 end if;
 if not exists(select 1 from public.decks where id=did and user_id=uid) or not exists(select 1 from public.decks where id=oid and user_id=uid) then raise exception 'Select valid decks.'; end if;
 -- Reuse the original roster when editing a match with the same deck.
 if old_match.deck_id=did then
 select jsonb_agg(jsonb_build_object('card_id',card_id,'name',card_name,'type',card_type,'quantity',quantity,'printings',printings)) into my_roster from public.match_rosters where match_id=mid and side='mine';
 else
 select jsonb_agg(jsonb_build_object('card_id',c.id,'name',c.name,'type',c.type,'quantity',dc.quantity,'printings',dc.printings)) into my_roster from public.deck_cards dc join public.cards c on c.id=dc.card_id where dc.deck_id=did;
 end if;
 if old_match.opponent_deck_id=oid then
 select jsonb_agg(jsonb_build_object('card_id',card_id,'name',card_name,'type',card_type,'quantity',quantity,'printings',printings)) into their_roster from public.match_rosters where match_id=mid and side='opponent';
 else
 select jsonb_agg(jsonb_build_object('card_id',c.id,'name',c.name,'type',c.type,'quantity',dc.quantity,'printings',dc.printings)) into their_roster from public.deck_cards dc join public.cards c on c.id=dc.card_id where dc.deck_id=oid;
 end if;
 sid:=(payload->>'starter_id')::uuid; osid:=(payload->>'opponent_starter_id')::uuid;
 if not exists(select 1 from jsonb_array_elements(my_roster) x where x->>'card_id'=sid::text and x->>'type' in ('basic','basic_ex','basic_upper_ex','basic_gx','basic_legend','basic_prime','basic_sp','basic_tag_team_gx','basic_v','mega_basic_ex')) then raise exception 'Choose a Basic starter from your deck.'; end if;
 if not exists(select 1 from jsonb_array_elements(their_roster) x where x->>'card_id'=osid::text and x->>'type' in ('basic','basic_ex','basic_upper_ex','basic_gx','basic_legend','basic_prime','basic_sp','basic_tag_team_gx','basic_v','mega_basic_ex')) then raise exception 'Choose a Basic starter from the opponent deck.'; end if;
 if jsonb_array_length(coalesce(payload->'prizes','[]'))>6 then raise exception 'Select at most six prize cards.'; end if;
 for pid,needed in select value,count(*)::integer from jsonb_array_elements_text(coalesce(payload->'prizes','[]')) group by value loop
 if not exists(select 1 from jsonb_array_elements(my_roster) x where x->>'card_id'=pid and (x->>'quantity')::integer>=needed) then raise exception 'Prize copies must belong to your deck and respect its quantities.'; end if;
 end loop;
 insert into public.matches(id,user_id,deck_id,opponent_deck_id,deck_name,opponent_deck_name,result,my_prizes,opponent_prizes,starter_id,opponent_starter_id,played_at,notes)
 values(mid,uid,did,oid,case when old_match.deck_id=did then old_match.deck_name else (select name from public.decks where id=did) end,case when old_match.opponent_deck_id=oid then old_match.opponent_deck_name else (select name from public.decks where id=oid) end,(payload->>'result')::public.match_result,(payload->>'my_prizes')::smallint,(payload->>'opponent_prizes')::smallint,sid,osid,(payload->>'played_at')::timestamptz,coalesce(payload->>'notes',''))
 on conflict(id) do update set deck_id=excluded.deck_id,opponent_deck_id=excluded.opponent_deck_id,deck_name=excluded.deck_name,opponent_deck_name=excluded.opponent_deck_name,result=excluded.result,my_prizes=excluded.my_prizes,opponent_prizes=excluded.opponent_prizes,starter_id=excluded.starter_id,opponent_starter_id=excluded.opponent_starter_id,played_at=excluded.played_at,notes=excluded.notes;
 delete from public.match_rosters where match_id=mid;
 for item in select value from jsonb_array_elements(my_roster) loop
 insert into public.match_rosters(match_id,user_id,side,card_id,card_name,card_type,quantity) values(mid,uid,'mine',(item->>'card_id')::uuid,item->>'name',(item->>'type')::public.card_type,(item->>'quantity')::smallint);
 end loop;
 for item in select value from jsonb_array_elements(their_roster) loop
 insert into public.match_rosters(match_id,user_id,side,card_id,card_name,card_type,quantity) values(mid,uid,'opponent',(item->>'card_id')::uuid,item->>'name',(item->>'type')::public.card_type,(item->>'quantity')::smallint);
 end loop;
 delete from public.match_prizes where match_id=mid;
 for pid in select jsonb_array_elements_text(coalesce(payload->'prizes','[]')) loop
 slot_no:=slot_no+1;
 insert into public.match_prizes(match_id,user_id,slot,card_id) values(mid,uid,slot_no,pid::uuid);
 end loop;
 update public.matches set combat_log=coalesce(payload->>'combat_log',''), log_player=coalesce(payload->>'log_player',''), coin_won=case when coalesce(payload->>'combat_log','')='' then null else (payload->>'coin_won')::boolean end, card_back=coalesce(payload->>'card_back','classic'), opponent_card_back=coalesce(payload->>'opponent_card_back','classic') where id=mid and user_id=uid;
 for item in select value from jsonb_array_elements(coalesce(my_roster,'[]')) loop
 update public.match_rosters set printings=coalesce(item->'printings','[]') where match_id=mid and side='mine' and card_id=(item->>'card_id')::uuid;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(their_roster,'[]')) loop
 update public.match_rosters set printings=coalesce(item->'printings','[]') where match_id=mid and side='opponent' and card_id=(item->>'card_id')::uuid;
 end loop;
 return mid;
end $$;
create function public.delete_entity(entity text, entity_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to continue.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if entity='deck' then
 delete from public.matches where user_id=auth.uid() and (deck_id=entity_id or opponent_deck_id=entity_id);
 delete from public.decks where id=entity_id and user_id=auth.uid();
 elsif entity='match' then delete from public.matches where id=entity_id and user_id=auth.uid();
 elsif entity='card' then delete from public.cards where id=entity_id and user_id=auth.uid();
 else raise exception 'Invalid entity.'; end if;
 if not found then raise exception 'Record not found.'; end if;
end $$;
revoke all on function public.save_deck(jsonb), public.save_match(jsonb), public.delete_entity(text,uuid) from public,anon;
grant execute on function public.save_deck(jsonb), public.save_match(jsonb), public.delete_entity(text,uuid) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('deck-images','deck-images',false,20971520,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
create policy deck_image_read on storage.objects for select to authenticated using(bucket_id='deck-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy deck_image_insert on storage.objects for insert to authenticated with check(bucket_id='deck-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy deck_image_delete on storage.objects for delete to authenticated using(bucket_id='deck-images' and (storage.foldername(name))[1]=auth.uid()::text);
comment on table public.match_rosters is 'Immutable-in-time card names, types and quantities captured for each side of a match; reused on editing.';
comment on table public.match_prizes is 'Up to six individual copies, validated against the historical roster by save_match.';
commit;
