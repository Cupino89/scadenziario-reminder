alter table public.deadlines add column owner_id uuid, add column asset_id uuid;
alter table public.deadlines add constraint deadlines_owner_id_user_id_fkey foreign key (owner_id,user_id) references public.entities(id,user_id) on delete set null;
alter table public.deadlines add constraint deadlines_asset_id_user_id_fkey foreign key (asset_id,user_id) references public.entities(id,user_id) on delete set null;
update public.deadlines d set asset_id=d.entity_id where exists (select 1 from public.entities e where e.id=d.entity_id and e.entity_type <> 'person');
update public.deadlines d set owner_id=d.entity_id where exists (select 1 from public.entities e where e.id=d.entity_id and e.entity_type = 'person');
notify pgrst, 'reload schema';
