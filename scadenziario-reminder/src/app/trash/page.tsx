"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { formatDateIT } from "@/lib/date";
import type { Deadline } from "@/lib/types";

export default function TrashPage() {
  const [items, setItems] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const rows: Deadline[] = [];
      for (let from = 0; ; from += 500) {
        const { data, error } = await supabase.from("deadlines").select("*").not("deleted_at", "is", null).order("deleted_at", { ascending: false }).order("id").range(from, from + 499);
        if (error) throw error;
        rows.push(...(data ?? []) as Deadline[]);
        if (!data || data.length < 500) break;
      }
      setItems(rows);
    } catch { setError("Non è stato possibile caricare il cestino. Riprova."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function restore(item: Deadline) {
    if (busy || !window.confirm(`Ripristinare “${item.title}”? Tornerà allo stato e alla data precedenti. Se era da gestire, i promemoria riprenderanno secondo le regole impostate.`)) return;
    setBusy(item.id); setError(""); setNotice("");
    try {
      const { error } = await supabase.rpc("restore_deadline_from_trash", { p_deadline_id: item.id });
      if (error) throw error;
      setItems(rows => rows.filter(row => row.id !== item.id));
      setNotice(`“${item.title}” ripristinata.`);
    } catch { setError("Ripristino non riuscito. Riprova o aggiorna il cestino."); }
    finally { setBusy(null); }
  }
  return <AuthGuard><AppShell>
    <h1 className="text-3xl font-bold">Cestino</h1>
    <p className="mt-2 text-slate-500">Le scadenze eliminate restano qui con pagamenti e documenti. I promemoria sono sospesi. Non c’è una cancellazione automatica.</p>
    <p className="mt-2 text-sm text-slate-500">Il recupero è disponibile per le eliminazioni effettuate dopo l’introduzione del cestino.</p>
    {notice && <p role="status" className="mt-4 text-emerald-700">{notice} <Link className="underline" href="/dashboard">Vai alla dashboard</Link></p>}
    {error && <p role="alert" className="mt-4 text-red-700">{error} <button className="underline" disabled={loading || busy !== null} onClick={() => void load()}>Aggiorna</button></p>}
    <div className="card mt-5 divide-y p-5">
      {loading ? <p role="status">Caricamento…</p> : !error && items.length === 0 ? <p className="text-slate-500">Il cestino è vuoto.</p> : items.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div><p className="font-semibold">{item.title}</p><p className="text-sm text-slate-500">{item.category} · Scadenza {formatDateIT(item.due_date)}</p><p className="text-sm text-slate-500">Eliminata il {new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Rome' }).format(new Date(item.deleted_at!))} · Stato precedente: {item.status_before_trash && {open: 'Da gestire', paid: 'Pagata', cancelled: 'Annullata', not_applicable: 'Non applicabile'}[item.status_before_trash]}</p></div>
        <button className="button-secondary" disabled={busy !== null} onClick={() => void restore(item)} aria-label={`Ripristina ${item.title}`}><RotateCcw size={16} />{busy === item.id ? 'Ripristino…' : 'Ripristina'}</button>
      </div>)}
    </div>
  </AppShell></AuthGuard>;
}
