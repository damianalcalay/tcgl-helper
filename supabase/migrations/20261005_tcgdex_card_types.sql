-- Match the stages, suffixes and Trainer/Energy subtypes returned by TCGdex.
begin;
alter type public.card_type add value if not exists 'basic';
alter type public.card_type add value if not exists 'basic_ex';
alter type public.card_type add value if not exists 'mega_basic_ex';
alter type public.card_type add value if not exists 'stage_1';
alter type public.card_type add value if not exists 'stage_1_ex';
alter type public.card_type add value if not exists 'mega_stage_1_ex';
alter type public.card_type add value if not exists 'stage_2';
alter type public.card_type add value if not exists 'stage_2_ex';
alter type public.card_type add value if not exists 'mega_stage_2_ex';
alter type public.card_type add value if not exists 'supporter';
alter type public.card_type add value if not exists 'stadium';
alter type public.card_type add value if not exists 'tool';
alter type public.card_type add value if not exists 'item';
alter type public.card_type add value if not exists 'ace_spec';
alter type public.card_type add value if not exists 'energy';
alter type public.card_type add value if not exists 'basic_upper_ex';
alter type public.card_type add value if not exists 'basic_gx';
alter type public.card_type add value if not exists 'basic_legend';
alter type public.card_type add value if not exists 'basic_prime';
alter type public.card_type add value if not exists 'basic_sp';
alter type public.card_type add value if not exists 'basic_tag_team_gx';
alter type public.card_type add value if not exists 'basic_v';
alter type public.card_type add value if not exists 'stage_1_upper_ex';
alter type public.card_type add value if not exists 'stage_1_gx';
alter type public.card_type add value if not exists 'stage_1_legend';
alter type public.card_type add value if not exists 'stage_1_prime';
alter type public.card_type add value if not exists 'stage_1_sp';
alter type public.card_type add value if not exists 'stage_1_tag_team_gx';
alter type public.card_type add value if not exists 'stage_1_v';
alter type public.card_type add value if not exists 'stage_2_upper_ex';
alter type public.card_type add value if not exists 'stage_2_gx';
alter type public.card_type add value if not exists 'stage_2_legend';
alter type public.card_type add value if not exists 'stage_2_prime';
alter type public.card_type add value if not exists 'stage_2_sp';
alter type public.card_type add value if not exists 'stage_2_tag_team_gx';
alter type public.card_type add value if not exists 'stage_2_v';
alter type public.card_type add value if not exists 'baby';
alter type public.card_type add value if not exists 'baby_ex';
alter type public.card_type add value if not exists 'baby_upper_ex';
alter type public.card_type add value if not exists 'baby_gx';
alter type public.card_type add value if not exists 'baby_legend';
alter type public.card_type add value if not exists 'baby_prime';
alter type public.card_type add value if not exists 'baby_sp';
alter type public.card_type add value if not exists 'baby_tag_team_gx';
alter type public.card_type add value if not exists 'baby_v';
alter type public.card_type add value if not exists 'break';
alter type public.card_type add value if not exists 'break_ex';
alter type public.card_type add value if not exists 'break_upper_ex';
alter type public.card_type add value if not exists 'break_gx';
alter type public.card_type add value if not exists 'break_legend';
alter type public.card_type add value if not exists 'break_prime';
alter type public.card_type add value if not exists 'break_sp';
alter type public.card_type add value if not exists 'break_tag_team_gx';
alter type public.card_type add value if not exists 'break_v';
alter type public.card_type add value if not exists 'level_up';
alter type public.card_type add value if not exists 'level_up_ex';
alter type public.card_type add value if not exists 'level_up_upper_ex';
alter type public.card_type add value if not exists 'level_up_gx';
alter type public.card_type add value if not exists 'level_up_legend';
alter type public.card_type add value if not exists 'level_up_prime';
alter type public.card_type add value if not exists 'level_up_sp';
alter type public.card_type add value if not exists 'level_up_tag_team_gx';
alter type public.card_type add value if not exists 'level_up_v';
alter type public.card_type add value if not exists 'mega';
alter type public.card_type add value if not exists 'mega_ex';
alter type public.card_type add value if not exists 'mega_upper_ex';
alter type public.card_type add value if not exists 'mega_gx';
alter type public.card_type add value if not exists 'mega_legend';
alter type public.card_type add value if not exists 'mega_prime';
alter type public.card_type add value if not exists 'mega_sp';
alter type public.card_type add value if not exists 'mega_tag_team_gx';
alter type public.card_type add value if not exists 'mega_v';
alter type public.card_type add value if not exists 'restored';
alter type public.card_type add value if not exists 'restored_ex';
alter type public.card_type add value if not exists 'restored_upper_ex';
alter type public.card_type add value if not exists 'restored_gx';
alter type public.card_type add value if not exists 'restored_legend';
alter type public.card_type add value if not exists 'restored_prime';
alter type public.card_type add value if not exists 'restored_sp';
alter type public.card_type add value if not exists 'restored_tag_team_gx';
alter type public.card_type add value if not exists 'restored_v';
alter type public.card_type add value if not exists 'v_union';
alter type public.card_type add value if not exists 'v_union_ex';
alter type public.card_type add value if not exists 'v_union_upper_ex';
alter type public.card_type add value if not exists 'v_union_gx';
alter type public.card_type add value if not exists 'v_union_legend';
alter type public.card_type add value if not exists 'v_union_prime';
alter type public.card_type add value if not exists 'v_union_sp';
alter type public.card_type add value if not exists 'v_union_tag_team_gx';
alter type public.card_type add value if not exists 'v_union_v';
alter type public.card_type add value if not exists 'vmax';
alter type public.card_type add value if not exists 'vmax_ex';
alter type public.card_type add value if not exists 'vmax_upper_ex';
alter type public.card_type add value if not exists 'vmax_gx';
alter type public.card_type add value if not exists 'vmax_legend';
alter type public.card_type add value if not exists 'vmax_prime';
alter type public.card_type add value if not exists 'vmax_sp';
alter type public.card_type add value if not exists 'vmax_tag_team_gx';
alter type public.card_type add value if not exists 'vmax_v';
alter type public.card_type add value if not exists 'vstar';
alter type public.card_type add value if not exists 'vstar_ex';
alter type public.card_type add value if not exists 'vstar_upper_ex';
alter type public.card_type add value if not exists 'vstar_gx';
alter type public.card_type add value if not exists 'vstar_legend';
alter type public.card_type add value if not exists 'vstar_prime';
alter type public.card_type add value if not exists 'vstar_sp';
alter type public.card_type add value if not exists 'vstar_tag_team_gx';
alter type public.card_type add value if not exists 'vstar_v';
alter type public.card_type add value if not exists 'rocket_secret_machine';
alter type public.card_type add value if not exists 'technical_machine';
alter type public.card_type add value if not exists 'energy_basic';
alter type public.card_type add value if not exists 'energy_special';
commit;
begin;
create or replace function public.check_card_copy_limit() returns trigger language plpgsql set search_path='' as $$
begin
 if new.type::text not in ('energy','energy_basic') and exists(select 1 from public.deck_cards where card_id=new.id and quantity>4) then
 raise check_violation using message='Reduce deck quantities before changing this Energy card type.';
 end if;
 return new;
end $$;
create or replace function public.check_deck_limit() returns trigger language plpgsql set search_path='' as $$
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
create or replace function public.save_match(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); mid uuid; did uuid; oid uuid; old_match public.matches; my_roster jsonb; their_roster jsonb; sid uuid; osid uuid; item jsonb; pid text; slot_no integer:=0; needed integer;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 mid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid()); did:=(payload->>'deck_id')::uuid; oid:=(payload->>'opponent_deck_id')::uuid;
 if nullif(payload->>'id','') is not null then
 select * into old_match from public.matches where id=mid and user_id=uid;
 if not found then raise exception 'Match not found.'; end if;
 end if;
 if not exists(select 1 from public.decks where id=did and user_id=uid) or not exists(select 1 from public.decks where id=oid and user_id=uid) then raise exception 'Select valid decks.'; end if;
 -- Reuse the original roster when editing a match with the same deck.
 if old_match.deck_id=did then
 select jsonb_agg(jsonb_build_object('card_id',card_id,'name',card_name,'type',card_type,'quantity',quantity)) into my_roster from public.match_rosters where match_id=mid and side='mine';
 else
 select jsonb_agg(jsonb_build_object('card_id',c.id,'name',c.name,'type',c.type,'quantity',dc.quantity)) into my_roster from public.deck_cards dc join public.cards c on c.id=dc.card_id where dc.deck_id=did;
 end if;
 if old_match.opponent_deck_id=oid then
 select jsonb_agg(jsonb_build_object('card_id',card_id,'name',card_name,'type',card_type,'quantity',quantity)) into their_roster from public.match_rosters where match_id=mid and side='opponent';
 else
 select jsonb_agg(jsonb_build_object('card_id',c.id,'name',c.name,'type',c.type,'quantity',dc.quantity)) into their_roster from public.deck_cards dc join public.cards c on c.id=dc.card_id where dc.deck_id=oid;
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
 return mid;
end $$;
commit;
