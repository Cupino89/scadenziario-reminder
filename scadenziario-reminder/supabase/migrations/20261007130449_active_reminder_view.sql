create view public.active_reminders with(security_invoker=true) as
select e.*,d.title,d.category from public.reminder_events e
join public.deadlines d on d.id=e.deadline_id
join public.deadline_occurrences o on o.id=e.occurrence_id
where d.deleted_at is null and d.status='open' and d.is_active
and o.status='open' and o.due_date=e.due_date
and e.days_before=any(d.reminder_days);
revoke all on public.active_reminders from anon;
grant select on public.active_reminders to authenticated;
notify pgrst,'reload schema';
