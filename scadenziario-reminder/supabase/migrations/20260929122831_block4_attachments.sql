-- Block 4: multiple private documents, owned by an occurrence, optionally a payment.
-- Additive migration: existing receipts and payment APIs remain available.
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  deadline_id uuid not null references public.deadlines(id) on delete restrict,
  occurrence_id uuid not null references public.deadline_occurrences(id) on delete restrict,
  payment_id uuid references public.payments(id) on delete set null,
  storage_path text not null unique,
  display_name text not null check (length(trim(display_name)) between 1 and 255),
  document_type text not null default 'other' check (document_type in ('receipt','invoice','f24','discharge','notice','certificate','other')),
  description text check (length(description) <= 2000),
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes between 1 and 10485760),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attachments_owner_path check (split_part(storage_path, '/', 1) = user_id::text)
);
create index attachments_deadline_idx on public.attachments(deadline_id);
create index attachments_occurrence_idx on public.attachments(occurrence_id);
create index attachments_payment_idx on public.attachments(payment_id);
create index attachments_user_idx on public.attachments(user_id);
alter table public.attachments enable row level security;
revoke all on public.attachments from anon;
grant select,insert,update,delete on public.attachments to authenticated;
create policy attachments_select_own on public.attachments for select to authenticated using (user_id = (select auth.uid()));
create policy attachments_insert_own on public.attachments for insert to authenticated with check (user_id = (select auth.uid()));
create policy attachments_update_own on public.attachments for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy attachments_delete_own on public.attachments for delete to authenticated using (user_id = (select auth.uid()));

create function public.validate_attachment() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.user_id <> old.user_id or new.deadline_id <> old.deadline_id or new.occurrence_id <> old.occurrence_id then
      raise exception 'Il proprietario e l’occorrenza del documento non possono essere cambiati';
    end if;
    new.created_at := old.created_at;
  end if;
  if not exists (select 1 from public.deadlines d join public.deadline_occurrences o on o.deadline_id=d.id
    where d.id=new.deadline_id and d.user_id=new.user_id and o.id=new.occurrence_id) then
    raise exception 'Occorrenza non trovata o non autorizzata';
  end if;
  if new.payment_id is not null and not exists (select 1 from public.payments p
    where p.id=new.payment_id and p.deadline_id=new.deadline_id and p.occurrence_id=new.occurrence_id) then
    raise exception 'Il pagamento non appartiene a questa occorrenza';
  end if;
  if tg_op='INSERT' or new.storage_path is distinct from old.storage_path then
    if not exists (select 1 from storage.objects o where o.bucket_id='receipts' and o.name=new.storage_path) then
      raise exception 'File non trovato nello storage privato';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.validate_attachment() from public,anon;
create trigger validate_attachment before insert or update on public.attachments for each row execute function public.validate_attachment();

-- Preserve existing file bytes, original upload date and occurrence association.
insert into public.attachments(user_id,deadline_id,occurrence_id,payment_id,storage_path,display_name,document_type,mime_type,size_bytes,created_at)
select d.user_id,p.deadline_id,p.occurrence_id,p.id,p.receipt_path,
  right(regexp_replace(p.receipt_path,'^.*/',''),255),'receipt',
  o.metadata->>'mimetype',nullif(o.metadata->>'size','')::bigint,p.created_at
from public.payments p join public.deadlines d on d.id=p.deadline_id
join storage.objects o on o.bucket_id='receipts' and o.name=p.receipt_path
where p.receipt_path is not null and p.occurrence_id is not null;

-- Old clients may still create payments with the original one-receipt API.
create function public.capture_payment_receipt() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.receipt_path is not null and new.occurrence_id is not null then
    insert into public.attachments(user_id,deadline_id,occurrence_id,payment_id,storage_path,display_name,document_type,mime_type,size_bytes)
    select d.user_id,new.deadline_id,new.occurrence_id,new.id,new.receipt_path,
      right(regexp_replace(new.receipt_path,'^.*/',''),255),'receipt',o.metadata->>'mimetype',nullif(o.metadata->>'size','')::bigint
    from public.deadlines d join storage.objects o on o.bucket_id='receipts' and o.name=new.receipt_path
    where d.id=new.deadline_id
    on conflict(storage_path) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.capture_payment_receipt() from public,anon;
create trigger capture_payment_receipt after insert on public.payments for each row execute function public.capture_payment_receipt();

-- Clear stale legacy pointers when a document is replaced or removed.
create function public.clear_legacy_receipt_pointer() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op='DELETE' or new.storage_path is distinct from old.storage_path then
    update public.payments set receipt_path=null where receipt_path=old.storage_path and deadline_id=old.deadline_id;
  end if;
  return null;
end;
$$;
revoke all on function public.clear_legacy_receipt_pointer() from public,anon;
create trigger clear_legacy_receipt_pointer after update or delete on public.attachments for each row execute function public.clear_legacy_receipt_pointer();

-- Human-readable error instead of allowing implicit document loss on rollback/delete.
create function public.protect_occurrence_documents() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if exists(select 1 from public.attachments a where a.occurrence_id=old.id) then
    raise exception 'Questa occorrenza contiene documenti. Scaricali e rimuovili prima di eliminarla o ripristinare quella precedente.';
  end if;
  return old;
end;
$$;
revoke all on function public.protect_occurrence_documents() from public,anon;
create trigger protect_occurrence_documents before delete on public.deadline_occurrences for each row execute function public.protect_occurrence_documents();

-- Retained documents are reattached to the occurrence by ON DELETE SET NULL.
-- Return no storage path for old clients to delete when cancelling a payment.
CREATE OR REPLACE FUNCTION public.delete_latest_payment_and_restore(p_payment_id uuid)
 RETURNS TABLE(deleted_receipt_path text, restored_due_date date, restored_status text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_payment public.payments%rowtype;
  v_deadline public.deadlines%rowtype;
  v_latest_id uuid;
begin
  select p.*
  into v_payment
  from public.payments p
  join public.deadlines d on d.id = p.deadline_id
  where p.id = p_payment_id
    and d.user_id = (select auth.uid())
  for update of p;

  if not found then
    raise exception 'Pagamento non trovato o non autorizzato';
  end if;

  select *
  into v_deadline
  from public.deadlines
  where id = v_payment.deadline_id
    and user_id = (select auth.uid())
  for update;

  select p2.id
  into v_latest_id
  from public.payments p2
  where p2.deadline_id = v_payment.deadline_id
  order by p2.created_at desc, p2.id desc
  limit 1;

  if v_latest_id is distinct from v_payment.id then
    raise exception 'Puoi annullare solo il pagamento più recente di questa scadenza';
  end if;

  if v_payment.occurrence_id is not null then
    update public.deadline_occurrences
    set status = 'open', updated_at = now()
    where id = v_payment.occurrence_id;
  end if;

  if v_payment.generated_occurrence_id is not null then
    if exists (
      select 1 from public.payments
      where occurrence_id = v_payment.generated_occurrence_id
    ) then
      raise exception 'La prossima occorrenza ha già un pagamento e non può essere rimossa';
    end if;

    delete from public.deadline_occurrences
    where id = v_payment.generated_occurrence_id;
  end if;

  delete from public.payments where id = v_payment.id;

  update public.deadlines
  set
    due_date = v_payment.deadline_due_date_before,
    status = v_payment.deadline_status_before
  where id = v_payment.deadline_id;

  return query
  select
    null::text,
    v_payment.deadline_due_date_before,
    v_payment.deadline_status_before;
end;
$function$
;
