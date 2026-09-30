-- Preserve payment history and require linked entities to share the deadline owner.
alter table public.entities add constraint entities_id_user_id_key unique (id,user_id);
alter table public.deadlines drop constraint deadlines_entity_id_fkey;
alter table public.deadlines add constraint deadlines_entity_id_fkey foreign key (entity_id,user_id) references public.entities(id,user_id) on delete set null (entity_id);
alter table public.payments drop constraint payments_deadline_id_fkey;
alter table public.payments add constraint payments_deadline_id_fkey foreign key (deadline_id) references public.deadlines(id) on delete restrict;
notify pgrst, 'reload schema';
