-- Run after 20261005_combat_logs.sql.
begin;
alter table public.matches alter column opponent_deck_id drop not null;
alter table public.matches alter column opponent_starter_id drop not null;
alter table public.matches add column if not exists opponent_starter_name text not null default '';
create or replace function public.save_match(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); mid uuid; did uuid; oid uuid; old_match public.matches; my_roster jsonb; their_roster jsonb; sid uuid; osid uuid; item jsonb; pid text; slot_no integer:=0; needed integer;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if length(coalesce(payload->>'notes',''))>200 then raise exception 'Match notes must be at most 200 characters.'; end if;
 if length(coalesce(payload->>'combat_log',''))>200000 then raise exception 'Combat log is too long.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 mid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid()); did:=(payload->>'deck_id')::uuid; oid:=nullif(payload->>'opponent_deck_id','')::uuid;
 if nullif(payload->>'id','') is not null then
 select * into old_match from public.matches where id=mid and user_id=uid;
 if not found then raise exception 'Match not found.'; end if;
 end if;
 if not exists(select 1 from public.decks where id=did and user_id=uid) or (oid is not null and not exists(select 1 from public.decks where id=oid and user_id=uid)) then raise exception 'Select valid decks.'; end if;
 if oid is null and (length(trim(coalesce(payload->>'opponent_deck_name',''))) not between 1 and 150 or coalesce(payload->>'combat_log','')='') then raise exception 'Enter the opponent deck name.'; end if;
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
 sid:=(payload->>'starter_id')::uuid; osid:=nullif(payload->>'opponent_starter_id','')::uuid;
 if not exists(select 1 from jsonb_array_elements(my_roster) x where x->>'card_id'=sid::text and x->>'type' in ('basic','basic_ex','basic_upper_ex','basic_gx','basic_legend','basic_prime','basic_sp','basic_tag_team_gx','basic_v','mega_basic_ex')) then raise exception 'Choose a Basic starter from your deck.'; end if;
 if oid is not null and not exists(select 1 from jsonb_array_elements(their_roster) x where x->>'card_id'=osid::text and x->>'type' in ('basic','basic_ex','basic_upper_ex','basic_gx','basic_legend','basic_prime','basic_sp','basic_tag_team_gx','basic_v','mega_basic_ex')) then raise exception 'Choose a Basic starter from the opponent deck.'; end if;
 if jsonb_array_length(coalesce(payload->'prizes','[]'))>6 then raise exception 'Select at most six prize cards.'; end if;
 for pid,needed in select value,count(*)::integer from jsonb_array_elements_text(coalesce(payload->'prizes','[]')) group by value loop
 if not exists(select 1 from jsonb_array_elements(my_roster) x where x->>'card_id'=pid and (x->>'quantity')::integer>=needed) then raise exception 'Prize copies must belong to your deck and respect its quantities.'; end if;
 end loop;
 insert into public.matches(id,user_id,deck_id,opponent_deck_id,deck_name,opponent_deck_name,result,my_prizes,opponent_prizes,starter_id,opponent_starter_id,played_at,notes)
 values(mid,uid,did,oid,case when old_match.deck_id=did then old_match.deck_name else (select name from public.decks where id=did) end,case when oid is null then trim(payload->>'opponent_deck_name') when old_match.opponent_deck_id=oid then old_match.opponent_deck_name else (select name from public.decks where id=oid) end,(payload->>'result')::public.match_result,(payload->>'my_prizes')::smallint,(payload->>'opponent_prizes')::smallint,sid,osid,(payload->>'played_at')::timestamptz,coalesce(payload->>'notes',''))
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
 update public.matches set opponent_starter_name=coalesce(payload->>'opponent_starter_name',''), combat_log=coalesce(payload->>'combat_log',''), log_player=coalesce(payload->>'log_player',''), coin_won=case when coalesce(payload->>'combat_log','')='' then null else (payload->>'coin_won')::boolean end, card_back=coalesce(payload->>'card_back','classic'), opponent_card_back=coalesce(payload->>'opponent_card_back','classic') where id=mid and user_id=uid;
 for item in select value from jsonb_array_elements(coalesce(my_roster,'[]')) loop
 update public.match_rosters set printings=coalesce(item->'printings','[]') where match_id=mid and side='mine' and card_id=(item->>'card_id')::uuid;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(their_roster,'[]')) loop
 update public.match_rosters set printings=coalesce(item->'printings','[]') where match_id=mid and side='opponent' and card_id=(item->>'card_id')::uuid;
 end loop;
 return mid;
end $$;

revoke all on function public.save_match(jsonb) from public,anon;
grant execute on function public.save_match(jsonb) to authenticated;
commit;
