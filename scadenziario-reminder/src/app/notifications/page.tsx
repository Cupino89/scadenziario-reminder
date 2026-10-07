"use client";
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabase';
import { formatDateIT } from '@/lib/date';
import { refreshReminders, type ReminderEvent } from '@/lib/notifications';
const PAGE_SIZE=30;
export default function NotificationsPage(){
 const [items,setItems]=useState<ReminderEvent[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [showBanner,setShowBanner]=useState(true);
 const [userId,setUserId]=useState('');
 const [page,setPage]=useState(0);
 const [total,setTotal]=useState(0);
 const [unreadOnly,setUnreadOnly]=useState(false);
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const {data:auth,error:authError}=await supabase.auth.getUser();
   if(authError || !auth.user) throw new Error('Sessione scaduta: accedi di nuovo.');
   setUserId(auth.user.id);
   await refreshReminders();
   let query=supabase.from('active_reminders').select('*',{count:'exact'}).order('remind_date',{ascending:false}).order('id').range(page*PAGE_SIZE,(page+1)*PAGE_SIZE-1);
   if(unreadOnly) query=query.is('read_at',null);
   const [result,pref]=await Promise.all([query,supabase.from('notification_preferences').select('show_banner').eq('user_id',auth.user.id).maybeSingle()]);
   if(result.error) throw result.error;
   if(pref.error) throw pref.error;
   setItems((result.data??[]) as ReminderEvent[]);setTotal(result.count??0);setShowBanner(pref.data?.show_banner??true);
  }catch(e){setError(e instanceof Error?e.message:'Impossibile caricare le notifiche. Riprova.');}
  finally{setLoading(false);}
 },[page,unreadOnly]);
 useEffect(()=>{void load();},[load]);
 async function mark(item:ReminderEvent){
  setBusy(true);setError('');
  try{
   const {error}=await supabase.from('reminder_events').update({read_at:item.read_at?null:new Date().toISOString()}).eq('id',item.id);
   if(error) throw error;
   await load();
  }catch{setError('Non è stato possibile aggiornare il promemoria. Riprova.');}
  finally{setBusy(false);}
 }
 async function toggleBanner(){
  if(!userId)return;
  setBusy(true);setError('');
  const {error}=await supabase.from('notification_preferences').upsert({user_id:userId,show_banner:!showBanner});
  if(error)setError('Preferenza non salvata. Riprova.');else setShowBanner(!showBanner);
  setBusy(false);
 }
 return <AuthGuard><AppShell>
  <h1 className="text-3xl font-bold">Notifiche</h1>
  <p className="mt-2 text-slate-500">I tuoi promemoria per le scadenze ancora da gestire. Segnarli come letti non registra un pagamento.</p>
  <div className="card mt-5 p-4"><label className="flex items-center gap-3"><input type="checkbox" checked={showBanner} disabled={busy||loading} onChange={()=>void toggleBanner()}/>Mostra l’avviso dei promemoria da leggere quando uso l’app</label><p className="mt-2 text-sm text-slate-500">Gli avvisi si aggiornano quando apri l’app o premi Aggiorna, recuperando gli ultimi 30 giorni. Non sono notifiche push a telefono bloccato. Il servizio Telegram esistente continua separatamente.</p></div>
  <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2"><input type="checkbox" checked={unreadOnly} disabled={busy} onChange={e=>{setPage(0);setUnreadOnly(e.target.checked);}}/>Solo da leggere</label><button className="button-secondary" disabled={loading||busy} onClick={()=>void load()}>Aggiorna</button></div>
  {error&&<p role="alert" className="mt-4 text-red-700">{error}</p>}
  <div className="card mt-4 divide-y p-4">
   {loading?<p role="status">Caricamento…</p>:error?null:items.length===0?<p className="text-slate-500">Nessun promemoria con questi filtri.</p>:items.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><Link href={`/deadlines/${item.deadline_id}`} className={`${item.read_at?'':'font-bold'} hover:underline`}>{item.title}</Link><p className="text-sm text-slate-500">{item.category} · Scadenza {formatDateIT(item.due_date)}</p><p className="text-sm text-slate-500">Promemoria del {formatDateIT(item.remind_date)} · {item.days_before===0?'Giorno della scadenza':`${item.days_before} giorni prima`}</p></div><button disabled={busy} onClick={()=>void mark(item)} className="button-secondary">{item.read_at?'Segna da leggere':'Segna come letto'}</button></div>)}
  </div>
  <div className="mt-4 flex items-center gap-3"><button className="button-secondary" disabled={page===0||loading||busy} onClick={()=>setPage(p=>p-1)}>Precedente</button><span className="text-sm">Pagina {page+1} · {total} promemoria</span><button className="button-secondary" disabled={(page+1)*PAGE_SIZE>=total||loading||busy} onClick={()=>setPage(p=>p+1)}>Successiva</button></div>
 </AppShell></AuthGuard>;
}
