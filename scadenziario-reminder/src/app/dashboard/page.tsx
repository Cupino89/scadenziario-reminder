"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import type { Attachment, Entity } from "@/lib/types";
import { formatCurrency, formatDateIT } from "@/lib/date";
import { dayDifference, isPaymentProof, matchesDeadline, recent, romeToday, upcoming, type DashboardDeadline, type DashboardPayment } from "@/lib/dashboard";

// Fetch every page, rather than silently calculating totals on the API's first 1000 rows.
async function readPages<T>(request: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await request(from, from + 499);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []) as T[]);
    if (!data || data.length < 500) return rows;
  }
}

export default function DashboardPage() {
  const [deadlines, setDeadlines] = useState<DashboardDeadline[]>([]);
  const [payments, setPayments] = useState<DashboardPayment[]>([]);
  const [attachments, setAttachments] = useState<Pick<Attachment, 'payment_id' | 'document_type'>[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [entity, setEntity] = useState("");
  const [range, setRange] = useState("90");
  const [view, setView] = useState("open");
  const today = romeToday();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    setMessage("");
    try {
      const [d, p, a, e] = await Promise.all([
        readPages<DashboardDeadline>((from, to) => supabase.from('deadlines').select('*, entities:entities!deadlines_entity_id_fkey(name)').is('deleted_at', null).order('due_date').order('id').range(from, to)),
        readPages<DashboardPayment>((from, to) => supabase.from('payments').select('*, deadlines!inner(*, entities:entities!deadlines_entity_id_fkey(name))').is('deadlines.deleted_at', null).order('paid_at', { ascending: false }).order('id').range(from, to)),
        readPages<Pick<Attachment, 'payment_id' | 'document_type'>>((from, to) => supabase.from('attachments').select('payment_id, document_type').order('id').range(from, to)),
        readPages<Entity>((from, to) => supabase.from('entities').select('*').order('name').order('id').range(from, to)),
      ]);
      setDeadlines(d); setPayments(p); setAttachments(a); setEntities(e);
    } catch (error) {
      setLoadFailed(true);
      setMessage(`Caricamento non riuscito: ${error instanceof Error ? error.message : 'riprova.'}`);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const proofIds = useMemo(() => new Set(attachments.filter(a => a.payment_id && isPaymentProof(a.document_type)).map(a => a.payment_id)), [attachments]);
  const people = entities.filter(e => e.entity_type === 'person');
  const assets = entities.filter(e => e.entity_type !== 'person');
  const personFilter = people.some(e => e.id === entity) ? entity : '';
  const assetFilter = assets.some(e => e.id === entity) ? entity : '';
  const categories = useMemo(() => Array.from(new Set(deadlines.map(d => d.category))).sort(), [deadlines]);
  const selected = deadlines.filter(d => matchesDeadline(d, query, category, entity));
  const open = selected.filter(d => d.status === 'open' && upcoming(d.due_date, today, range));
  const paid = payments.filter(p => p.deadlines && matchesDeadline(p.deadlines, query, category, entity) && recent(p.paid_at, today, range));
  const missing = paid.filter(p => !proofIds.has(p.id) && !p.receipt_path);
  const paymentView = view === 'paid' || view === 'missing';
  const shownPayments = view === 'missing' ? missing : paid;
  const shownDeadlines = selected.filter(d => {
    if (view === 'overdue') return d.status === 'open' && dayDifference(d.due_date, today) < 0;
    if (view === 'upcoming') return d.status === 'open' && dayDifference(d.due_date, today) >= 0 && upcoming(d.due_date, today, range);
    return (view === 'all' || d.status === view) && upcoming(d.due_date, today, range);
  });

  async function removeDeadline(deadline: DashboardDeadline) {
    if (deleting) return;
    if (!window.confirm(`Spostare “${deadline.title}” nel cestino? Per una scadenza ricorrente verrà spostata l’intera serie. Potrai ripristinarla insieme a pagamenti e documenti; i promemoria saranno sospesi.`)) return;
    setDeleting(deadline.id); setMessage('');
    try {
      const { data, error } = await supabase.rpc('move_deadline_to_trash', { p_deadline_id: deadline.id });
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Scadenza non eliminata: aggiorna la pagina e verifica la sessione.');
      await load();
      setMessage(`“${deadline.title}” spostata nel cestino.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Eliminazione non riuscita.'); }
    finally { setDeleting(null); }
  }

  return <AuthGuard><AppShell>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-3xl font-bold">Dashboard</h1><p className="text-slate-500">Scadenze da gestire e pagamenti, in un unico posto.</p></div>
      <Link href="/deadlines/new" className="button-primary">+ Nuova scadenza</Link>
    </div>
    <div className="card mt-6 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
      <label className="text-sm">Cerca<input className="input mt-1" placeholder="Titolo, categoria, persona o bene" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <label className="text-sm">Categoria<select className="input mt-1" value={category} onChange={e => setCategory(e.target.value)}><option value="">Tutte le categorie</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
      <label className="text-sm">Persona<select className="input mt-1" value={personFilter} onChange={e => setEntity(e.target.value || (personFilter ? '' : entity))}><option value="">Tutte le persone</option>{people.map(e => <option value={e.id} key={e.id}>{e.name}</option>)}</select></label>
      <label className="text-sm">Bene<select className="input mt-1" value={assetFilter} onChange={e => setEntity(e.target.value || (assetFilter ? '' : entity))}><option value="">Tutti i beni</option>{(['property', 'vehicle', 'organization', 'contract', 'other'] as const).map(type => { const items = assets.filter(e => e.entity_type === type); return items.length ? <optgroup key={type} label={{ property: 'Immobili', vehicle: 'Veicoli', organization: 'Organizzazioni', contract: 'Contratti', other: 'Altro' }[type]}>{items.map(e => <option value={e.id} key={e.id}>{e.name}</option>)}</optgroup> : null; })}</select></label>
      <label className="text-sm">Periodo<select className="input mt-1" value={range} onChange={e => setRange(e.target.value)}><option value="7">7 giorni</option><option value="30">30 giorni</option><option value="90">90 giorni</option><option value="all">Tutte le date</option></select></label>
    </div>
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500"><p>Filtra per una persona oppure per un bene: selezionando uno, l’altro filtro si azzera.</p><label className="flex items-center gap-2"><input type="checkbox" checked={entity === 'unassigned'} onChange={e => setEntity(e.target.checked ? 'unassigned' : '')} />Solo scadenze senza collegamento</label></div>
    <p className="mt-2 text-sm text-slate-500">Il periodo comprende le prossime scadenze (incluse le arretrate) e i pagamenti degli ultimi {range === 'all' ? 'periodi disponibili' : `${range} giorni, oggi compreso`}. I riepiloghi seguono i filtri qui sopra.</p>
    {message && <div role="status" className="card mt-4 p-4">{message} <button className="underline" onClick={() => void load()} disabled={loading}>Aggiorna</button></div>}
    {loading ? <p className="py-8" role="status">Caricamento…</p> : loadFailed ? null : <>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Scadute" value={String(open.filter(d => dayDifference(d.due_date, today) < 0).length)} onClick={() => setView('overdue')} />
        <Metric label="Da gestire nel periodo" value={String(open.length)} onClick={() => setView('open')} />
        <Metric label="Pagamenti nel periodo" value={String(paid.length)} onClick={() => setView('paid')} />
        <Metric label="Pagamenti senza ricevuta" value={String(missing.length)} onClick={() => setView('missing')} />
      </div>
      <div className="card mt-4 grid gap-3 p-5 sm:grid-cols-2">
        <div><p className="text-sm text-slate-500">Da pagare · prossime scadenze e arretrati</p><p className="text-2xl font-bold">{formatCurrency(open.reduce((sum, d) => sum + Number(d.amount_expected ?? 0), 0))}</p><p className="text-sm text-slate-500">{open.filter(d => d.amount_expected === null).length} scadenze senza importo. Solo scadenze già registrate, senza proiezioni delle ricorrenze.</p></div>
        <div><p className="text-sm text-slate-500">Pagato · periodo passato selezionato</p><p className="text-2xl font-bold">{formatCurrency(paid.reduce((sum, p) => sum + Number(p.amount_paid ?? 0), 0))}</p><p className="text-sm text-slate-500">{paid.filter(p => p.amount_paid === null).length} pagamenti senza importo.</p></div>
      </div>
      <section className="card mt-5 p-4">
        <label className="block max-w-sm text-sm">Mostra<select className="input mt-1" value={view} onChange={e => setView(e.target.value)}><option value="open">Da gestire</option><option value="overdue">Scadute</option><option value="upcoming">In scadenza</option><option value="paid">Pagamenti recenti</option><option value="missing">Pagamenti senza ricevuta</option><option value="cancelled">Annullate</option><option value="not_applicable">Non applicabili</option><option value="all">Tutte le scadenze</option></select></label>
        {view === 'missing' && <p className="mt-3 text-sm text-slate-500">Pagamenti senza un documento classificato come ricevuta, quietanza o F24. Una fattura o un avviso non sono conteggiati come ricevuta.</p>}
        <div className="mt-3 divide-y divide-slate-100">
          {paymentView ? shownPayments.map(p => <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><Link className="font-semibold hover:underline" href={`/deadlines/${p.deadline_id}#payment-${p.id}`}>{p.deadlines?.title}</Link><p className="text-sm text-slate-500">{p.deadlines?.category} · {p.deadlines?.entities?.name ?? 'Senza collegamento'} · Pagato il {formatDateIT(p.paid_at)}</p></div><div className="flex items-center gap-3"><strong>{formatCurrency(p.amount_paid)}</strong><Link className="button-secondary" href={`/deadlines/${p.deadline_id}#payment-${p.id}`}>{proofIds.has(p.id) || p.receipt_path ? 'Documenti' : 'Aggiungi ricevuta'}</Link></div></div>) : shownDeadlines.map(d => <div key={d.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><Link className="font-semibold hover:underline" href={`/deadlines/${d.id}`}>{d.title}</Link><p className="text-sm text-slate-500">{d.category} · {formatDateIT(d.due_date)} · {formatCurrency(d.amount_expected)}{d.entities?.name ? ` · ${d.entities.name}` : ''}</p><p className={`text-sm ${d.status === 'open' && dayDifference(d.due_date, today) < 0 ? 'text-red-700' : 'text-slate-500'}`}>{statusLabel(d, today)}</p></div><div className="flex shrink-0 gap-2"><Link className="button-secondary" href={`/deadlines/${d.id}/edit`} aria-label={`Modifica ${d.title}`}><Pencil size={16} /> Modifica</Link><button className="button-secondary text-red-700" aria-label={`Elimina ${d.title}`} disabled={deleting !== null} onClick={() => void removeDeadline(d)}><Trash2 size={16} />{deleting === d.id ? 'Eliminazione…' : 'Elimina'}</button></div></div>)}
          {(paymentView ? shownPayments : shownDeadlines).length === 0 && <p className="py-6 text-slate-500">Nessun risultato con questi filtri.</p>}
        </div>
      </section>
    </>}
  </AppShell></AuthGuard>;
}
function Metric({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return <button onClick={onClick} className="card p-5 text-left hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></button>;
}
function statusLabel(d: DashboardDeadline, today: string) {
  if (d.status !== 'open') return { paid: 'Pagata', cancelled: 'Annullata', not_applicable: 'Non applicabile' }[d.status];
  const days = dayDifference(d.due_date, today);
  return days < 0 ? `Scaduta da ${-days} giorni` : days === 0 ? 'Scade oggi' : `Tra ${days} giorni`;
}
