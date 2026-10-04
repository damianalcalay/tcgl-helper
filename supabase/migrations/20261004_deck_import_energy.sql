-- Run in the Supabase SQL Editor for an existing installation.
-- Commit the enum change before functions use the new value.
begin;
alter type public.card_type add value if not exists 'energy';
commit;
begin;
alter table public.deck_cards drop constraint deck_cards_quantity_check;
alter table public.deck_cards add constraint deck_cards_quantity_check check(quantity between 1 and 60);
alter table public.match_rosters drop constraint match_rosters_quantity_check;
alter table public.match_rosters add constraint match_rosters_quantity_check check(quantity between 1 and 60);
create or replace function public.check_deck_limit() returns trigger language plpgsql set search_path='' as $$
declare total integer;
begin
 if new.quantity>4 and not exists(select 1 from public.cards where id=new.card_id and type='energy') then
 raise check_violation using message='Use 1-4 copies per non-Energy card.';
 end if;
 perform 1 from public.decks where id=new.deck_id for update;
 select coalesce(sum(quantity),0) into total from public.deck_cards where deck_id=new.deck_id and card_id<>new.card_id;
 if total+new.quantity>60 then raise exception 'A deck cannot contain more than 60 cards.'; end if;
 return new;
end $$;
create or replace function public.save_deck(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
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
 insert into public.deck_cards(deck_id,card_id,user_id,quantity) values(did,cid,uid,(entry->>'quantity')::smallint);
 end loop;
 if total>60 then raise exception 'A deck cannot contain more than 60 cards.'; end if;
 delete from public.deck_variants where deck_id=did;
 for vid in select jsonb_array_elements_text(coalesce(payload->'variants','[]')) loop
 insert into public.deck_variants(deck_id,variant_id,user_id) values(did,vid::uuid,uid);
 end loop;
 return did;
end $$;
create function public.check_card_copy_limit() returns trigger language plpgsql set search_path='' as $$
begin
 if new.type<>'energy' and exists(select 1 from public.deck_cards where card_id=new.id and quantity>4) then
 raise check_violation using message='Reduce deck quantities before changing this Energy card type.';
 end if;
 return new;
end $$;
create trigger card_copy_limit before update of type on public.cards for each row execute function public.check_card_copy_limit();
commit;
