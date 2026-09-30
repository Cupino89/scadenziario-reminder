alter table public.deadlines add column deleted_at timestamptz, add column status_before_trash text;
alter table public.deadlines add constraint deadlines_trash_state_check check (
 (deleted_at is null and status_before_trash is null) or
 (deleted_at is not null and status_before_trash in ('open','paid','cancelled','not_applicable') and status='cancelled' and not is_active));
create index deadlines_trash_idx on public.deadlines(user_id,deleted_at) where deleted_at is not null;
CREATE OR REPLACE FUNCTION public.sync_deadline_occurrence_on_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_occurrence_id uuid;
begin
  if tg_op = 'UPDATE' then
    if new.deleted_at is distinct from old.deleted_at then return new; end if;
  end if;
  if tg_op = 'INSERT' then
    insert into public.deadline_occurrences(deadline_id, due_date, status)
    values (
      new.id,
      new.due_date,
      case
        when new.status = 'paid' then 'paid'
        when new.status in ('cancelled','not_applicable') then 'cancelled'
        else 'open'
      end
    )
    on conflict (deadline_id, due_date) do nothing;
    return new;
  end if;

  if new.due_date is distinct from old.due_date and new.status = 'open' then
    select id into v_occurrence_id
    from public.deadline_occurrences
    where deadline_id = new.id and status = 'open'
    order by due_date desc, created_at desc
    limit 1;

    if v_occurrence_id is not null then
      update public.deadline_occurrences
      set due_date = new.due_date, updated_at = now()
      where id = v_occurrence_id
        and not exists (
          select 1 from public.deadline_occurrences x
          where x.deadline_id = new.id
            and x.due_date = new.due_date
            and x.id <> v_occurrence_id
        );
    else
      insert into public.deadline_occurrences(deadline_id, due_date, status)
      values (new.id, new.due_date, 'open')
      on conflict (deadline_id, due_date) do nothing;
    end if;
  end if;

  if new.status in ('cancelled','not_applicable')
     and old.status = 'open' then
    update public.deadline_occurrences
    set status = 'cancelled', updated_at = now()
    where deadline_id = new.id and status = 'open';
  elsif new.status = 'open'
     and old.status in ('cancelled','not_applicable') then
    update public.deadline_occurrences
    set status = 'open', updated_at = now()
    where id = (
      select id from public.deadline_occurrences
      where deadline_id = new.id and status = 'cancelled'
      order by due_date desc, created_at desc
      limit 1
    );
  end if;

  return new;
end;
$function$;

create function public.move_deadline_to_trash(p_deadline_id uuid) returns uuid language plpgsql security invoker set search_path=public as $$
declare d public.deadlines;
begin
 select * into d from public.deadlines where id=p_deadline_id and user_id=auth.uid() for update;
 if not found then raise exception 'Scadenza non trovata o accesso non consentito'; end if;
 if d.deleted_at is not null then return d.id; end if;
 update public.deadlines set status_before_trash=d.status, status='cancelled', is_active=false, deleted_at=now() where id=d.id;
 return d.id;
end $$;
create function public.restore_deadline_from_trash(p_deadline_id uuid) returns uuid language plpgsql security invoker set search_path=public as $$
declare d public.deadlines;
begin
 select * into d from public.deadlines where id=p_deadline_id and user_id=auth.uid() for update;
 if not found then raise exception 'Scadenza non trovata o accesso non consentito'; end if;
 if d.deleted_at is null then return d.id; end if;
 update public.deadlines set status=d.status_before_trash, is_active=(d.status_before_trash='open'), status_before_trash=null, deleted_at=null where id=d.id;
 return d.id;
end $$;
revoke all on function public.move_deadline_to_trash(uuid), public.restore_deadline_from_trash(uuid) from public,anon;
grant execute on function public.move_deadline_to_trash(uuid), public.restore_deadline_from_trash(uuid) to authenticated;
-- Old clients must fail safely instead of physically deleting data.
revoke delete on public.deadlines from authenticated, anon;
notify pgrst, 'reload schema';
