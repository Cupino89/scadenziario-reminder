"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { refreshReminders } from '@/lib/notifications';
export default function ReminderBanner() {
 const path=usePathname();
 const [count,setCount]=useState(0);
 const [dismissed,setDismissed]=useState(false);
 useEffect(()=>{
  let active=true;
  async function load(){
   try {
    const {data:auth}=await supabase.auth.getUser();
    if(!auth.user) return;
    const pref=await supabase.from('notification_preferences').select('show_banner').eq('user_id',auth.user.id).maybeSingle();
    if(pref.error || pref.data?.show_banner===false) return;
    await refreshReminders();
    const result=await supabase.from('active_reminders').select('id',{count:'exact',head:true}).is('read_at',null);
    if(active && !result.error) setCount(result.count??0);
   } catch { /* The notification page exposes errors and a retry action. */ }
  }
  if(path!='/notifications') void load();
  return ()=>{active=false;};
 },[path]);
 if(!count || dismissed || path==='/notifications') return null;
 return <div role="status" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><p>Hai <strong>{count}</strong> promemoria da leggere. <Link className="font-semibold underline" href="/notifications">Apri notifiche</Link></p><button className="text-sm underline" onClick={()=>setDismissed(true)}>Nascondi avviso</button></div>;
}
