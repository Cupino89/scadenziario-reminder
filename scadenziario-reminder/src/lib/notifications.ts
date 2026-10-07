import { supabase } from './supabase';
export type ReminderEvent = {id:string;deadline_id:string;title:string;category:string;due_date:string;remind_date:string;days_before:number;read_at:string|null};
// One refresh per page load/explicit refresh; all operations keep the authenticated user's RLS.
export async function refreshReminders() {
  const {error} = await supabase.rpc('refresh_my_reminders');
  if(error) throw error;
}
