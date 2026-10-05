-- Existing installations: deleting a deck also deletes every match involving it.
-- Match rosters and prize records already cascade from matches.
begin;
alter table public.matches drop constraint matches_deck_id_user_id_fkey;
alter table public.matches add constraint matches_deck_id_user_id_fkey
 foreign key(deck_id,user_id) references public.decks(id,user_id) on delete cascade;
alter table public.matches drop constraint matches_opponent_deck_id_user_id_fkey;
alter table public.matches add constraint matches_opponent_deck_id_user_id_fkey
 foreign key(opponent_deck_id,user_id) references public.decks(id,user_id) on delete cascade;
commit;
