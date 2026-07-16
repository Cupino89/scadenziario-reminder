-- Eseguire nel SQL Editor di Supabase.
-- Non modifica le tabelle applicative: crea solo le policy per il bucket privato receipts.

drop policy if exists "Users can upload own receipts" on storage.objects;
drop policy if exists "Users can read own receipts" on storage.objects;
drop policy if exists "Users can delete own receipts" on storage.objects;

create policy "Users can upload own receipts"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can read own receipts"
on storage.objects for select
to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete own receipts"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);
