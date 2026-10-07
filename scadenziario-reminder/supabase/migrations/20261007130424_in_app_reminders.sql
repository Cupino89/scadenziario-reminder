create table public.notification_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 show_banner boolean not null default true
);
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon;
grant select,insert,update on public.notification_preferences to authenticated;
create policy preferences_own on public.notification_preferences for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table public.reminder_events (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 deadline_id uuid not null references public.deadlines(id) on delete cascade,
 occurrence_id uuid not null references public.deadline_occurrences(id) on delete cascade,
 due_date date not null,
 remind_date date not null,
 days_before integer not null check(days_before>=0),
 created_at timestamptz not null default now(),
 read_at timestamptz,
 unique(user_id,occurrence_id,due_date,days_before)
);
create index reminder_events_user_date_idx on public.reminder_events(user_id,remind_date desc,id);
alter table public.reminder_events enable row level security;
revoke all on public.reminder_events from anon,authenticated;
grant select,insert on public.reminder_events to authenticated;
grant update(read_at) on public.reminder_events to authenticated;
create policy reminder_events_own_select on public.reminder_events for select to authenticated using(user_id=(select auth.uid()));
create policy reminder_events_own_update on public.reminder_events for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy reminder_events_own_insert on public.reminder_events for insert to authenticated with check(
 user_id=(select auth.uid()) and exists(
 select 1 from public.deadlines d join public.deadline_occurrences o on o.deadline_id=d.id
 where d.id=reminder_events.deadline_id and d.user_id=(select auth.uid())
 and o.id=reminder_events.occurrence_id and o.due_date=reminder_events.due_date
 and d.deleted_at is null and d.status='open' and o.status='open'
 and reminder_events.days_before=any(d.reminder_days)
 and reminder_events.remind_date=reminder_events.due_date-reminder_events.days_before
 and reminder_events.remind_date between (now() at time zone 'Europe/Rome')::date-30 and (now() at time zone 'Europe/Rome')::date
 ));

create function public.refresh_my_reminders() returns void language sql security invoker set search_path=public as $$
 insert into public.reminder_events(user_id,deadline_id,occurrence_id,due_date,remind_date,days_before)
 select d.user_id,d.id,o.id,o.due_date,o.due_date-days.n,days.n
 from public.deadlines d join public.deadline_occurrences o on o.deadline_id=d.id
 cross join lateral (select distinct unnest(d.reminder_days) as n) days
 where d.user_id=auth.uid() and d.deleted_at is null and d.status='open' and d.is_active
 and o.status='open' and days.n>=0
 and o.due_date-days.n between (now() at time zone 'Europe/Rome')::date-30 and (now() at time zone 'Europe/Rome')::date
 on conflict(user_id,occurrence_id,due_date,days_before) do nothing;
$$;
revoke all on function public.refresh_my_reminders() from public,anon;
grant execute on function public.refresh_my_reminders() to authenticated;
notify pgrst,'reload schema';
