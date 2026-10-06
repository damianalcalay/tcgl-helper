begin;
create table if not exists public.card_image_overrides (
 tcgdex_id text primary key check(tcgdex_id ~ '^[a-zA-Z0-9.-]{1,80}$'),
 path text not null check(length(path) < 250),
 uploaded_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now()
);
alter table public.card_image_overrides enable row level security;
create policy card_art_read on public.card_image_overrides for select to anon, authenticated using(true);
create policy card_art_insert on public.card_image_overrides for insert to authenticated with check(uploaded_by = auth.uid() and path like auth.uid()::text || '/' || tcgdex_id || '/%');
create policy card_art_update on public.card_image_overrides for update to authenticated using(true) with check(uploaded_by = auth.uid() and path like auth.uid()::text || '/' || tcgdex_id || '/%');
grant select on public.card_image_overrides to anon,authenticated;
grant insert,update on public.card_image_overrides to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('card-art','card-art',true,8388608,array['image/png','image/jpeg','image/webp'])
on conflict(id) do nothing;
create policy card_art_upload on storage.objects for insert to authenticated with check(bucket_id='card-art' and (storage.foldername(name))[1]=auth.uid()::text);
create policy card_art_remove_own on storage.objects for delete to authenticated using(bucket_id='card-art' and (storage.foldername(name))[1]=auth.uid()::text);
create or replace function public.save_deck_variant(payload jsonb, base uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare did uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.decks where id=base and user_id=auth.uid()) then raise exception 'Choose one of your decks as the base.'; end if;
 if payload->>'id' is not null then raise exception 'A variant must be saved as a new deck.'; end if;
 did := public.save_deck(payload);
 insert into public.deck_variants(deck_id,variant_id,user_id) values(base,did,auth.uid()) on conflict do nothing;
 return did;
end $$;
revoke all on function public.save_deck_variant(jsonb,uuid) from public;
grant execute on function public.save_deck_variant(jsonb,uuid) to authenticated;
commit;
