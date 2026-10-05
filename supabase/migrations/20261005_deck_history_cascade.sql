-- Existing installations: deleting a deck also deletes every match involving it.
-- Match rosters and prize records already cascade from matches.
begin;
alter table public.matches drop constraint matches_deck_id_user_id_fkey;
alter table public.matches add constraint matches_deck_id_user_id_fkey
 foreign key(deck_id,user_id) references public.decks(id,user_id) on delete cascade;
alter table public.matches drop constraint matches_opponent_deck_id_user_id_fkey;
alter table public.matches add constraint matches_opponent_deck_id_user_id_fkey
 foreign key(opponent_deck_id,user_id) references public.decks(id,user_id) on delete cascade;
-- Delete history first in the same transaction, including on installations
-- where the old RESTRICT relations are still present.
create or replace function public.delete_entity(entity text, entity_id uuid) returns void
language plpgsql security definer set search_path='' as $$
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
revoke all on function public.delete_entity(text,uuid) from public,anon;
grant execute on function public.delete_entity(text,uuid) to authenticated;
commit;
