-- Run after 20261004_deck_import_energy.sql for existing installations.
begin;
alter table public.deck_cards add column if not exists printings jsonb not null default '[]'::jsonb check(jsonb_typeof(printings)='array' and jsonb_array_length(printings)<=60);
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
 insert into public.deck_cards(deck_id,card_id,user_id,quantity,printings) values(did,cid,uid,(entry->>'quantity')::smallint,coalesce(entry->'printings','[]'::jsonb));
 end loop;
 if total>60 then raise exception 'A deck cannot contain more than 60 cards.'; end if;
 delete from public.deck_variants where deck_id=did;
 for vid in select jsonb_array_elements_text(coalesce(payload->'variants','[]')) loop
 insert into public.deck_variants(deck_id,variant_id,user_id) values(did,vid::uuid,uid);
 end loop;
 return did;
end $$;
commit;
