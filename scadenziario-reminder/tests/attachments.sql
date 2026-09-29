-- Execute inside BEGIN/ROLLBACK only. Uses existing file metadata, never changes storage bytes.
select set_config('request.jwt.claim.sub',(select user_id::text from public.attachments limit 1),true);
set local role authenticated;
do $$
declare
  source public.attachments%rowtype;
  d uuid; o uuid; p uuid; next_o uuid; a uuid; d2 uuid; o2 uuid;
  blocked boolean := false;
begin
  select * into strict source from public.attachments limit 1;
  -- Temporarily release the existing file reference; rollback restores it and the legacy pointer.
  delete from public.attachments where id=source.id;
  insert into public.deadlines(user_id,title,category,due_date,recurrence)
    values(auth.uid(),'TEST blocco 4','Test',date '2035-01-15','monthly') returning id into d;
  select id into o from public.deadline_occurrences where deadline_id=d;
  insert into public.attachments(user_id,deadline_id,occurrence_id,storage_path,display_name,document_type)
    values(auth.uid(),d,o,source.storage_path,'Avviso test.pdf','notice') returning id into a;
  select payment_id,next_occurrence_id into p,next_o from public.register_payment_atomic(d,date '2035-01-15',10,'Test',null);
  if not exists(select 1 from public.attachments where id=a and occurrence_id=o and payment_id is null) then
    raise exception 'Document did not stay with its original occurrence';
  end if;
  update public.attachments set payment_id=p,display_name='Ricevuta test.pdf',document_type='receipt' where id=a;
  perform public.delete_latest_payment_and_restore(p);
  if not exists(select 1 from public.attachments where id=a and occurrence_id=o and payment_id is null) then
    raise exception 'Document lost on payment cancellation';
  end if;
  if not exists(select 1 from public.deadline_occurrences where id=o and status='open') then raise exception 'Occurrence not restored'; end if;
  begin
    delete from public.deadline_occurrences where id=o;
  exception when raise_exception then blocked:=true;
  end;
  if not blocked then raise exception 'Document-bearing occurrence deletion was allowed'; end if;
  insert into public.deadlines(user_id,title,category,due_date,recurrence)
    values(auth.uid(),'TEST altra scadenza','Test',date '2035-02-15','none') returning id into d2;
  select id into o2 from public.deadline_occurrences where deadline_id=d2;
  select payment_id into p from public.register_payment_atomic(d2,date '2035-02-15',10,null,null);
  blocked:=false;
  begin
    update public.attachments set payment_id=p where id=a;
  exception when raise_exception then blocked:=true;
  end;
  if not blocked then raise exception 'Cross-occurrence payment attachment allowed'; end if;
  blocked:=false;
  begin
    update public.attachments set storage_path=auth.uid()::text||'/missing.pdf' where id=a;
  exception when raise_exception then blocked:=true;
  end;
  if not blocked then raise exception 'Missing storage object accepted'; end if;
end;
$$;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
do $$
declare n integer;
begin
  select count(*) into n from public.attachments;
  if n<>0 then raise exception 'RLS exposed documents to another user'; end if;
  update public.attachments set display_name='Unauthorized';
  get diagnostics n = row_count;
  if n<>0 then raise exception 'RLS allowed another user to edit'; end if;
end;
$$;
reset role;
