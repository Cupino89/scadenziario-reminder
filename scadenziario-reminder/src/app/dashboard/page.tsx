"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CalendarDays, Search, WalletCards } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import type { Deadline } from "@/lib/types";
import { daysUntil, formatCurrency, formatDateIT } from "@/lib/date";

function getVisualStatus(deadline: Deadline) {
  if (deadline.status === "paid") return { label: "Pagata", className: "bg-emerald-100 text-emerald-700" };
  if (deadline.status === "cancelled") return { label: "Annullata", className: "bg-slate-200 text-slate-700" };
  if (deadline.status === "not_applicable") return { label: "Non applicabile", className: "bg-violet-100 text-violet-700" };
  const days = daysUntil(deadline.due_date);
  if (days < 0) return { label: `Scaduta da ${Math.abs(days)}g`, className: "bg-red-100 text-red-700" };
  if (days === 0) return { label: "Oggi", className: "bg-red-100 text-red-700" };
  if (days <= 7) return { label: `Tra ${days}g`, className: "bg-amber-100 text-amber-700" };
  return { label: `Tra ${days}g`, className: "bg-slate-100 text-slate-700" };
}

export default function DashboardPage() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tutte");
  const [range, setRange] = useState("90");
  const [status, setStatus] = useState("open");

  useEffect(() => {
    supabase.from("deadlines").select("*").order("due_date", { ascending: true }).then(({ data }) => {
      setDeadlines((data ?? []) as Deadline[]);
      setLoading(false);
    });
  }, []);

  const categories = useMemo(() => ["Tutte", ...Array.from(new Set(deadlines.map((d) => d.category))).sort()], [deadlines]);

  const filtered = useMemo(() => deadlines.filter((d) => {
    const diff = daysUntil(d.due_date);
    return `${d.title} ${d.category}`.toLowerCase().includes(query.toLowerCase())
      && (category === "Tutte" || d.category === category)
      && (range === "tutte" || d.status !== "open" || diff <= Number(range))
      && (status === "tutte" || d.status === status);
  }), [deadlines, query, category, range, status]);

  const stats = useMemo(() => {
    const open = deadlines.filter((d) => d.status === "open");
    return {
      overdue: open.filter((d) => daysUntil(d.due_date) < 0).length,
      seven: open.filter((d) => { const n = daysUntil(d.due_date); return n >= 0 && n <= 7; }).length,
      thirty: open.filter((d) => { const n = daysUntil(d.due_date); return n >= 0 && n <= 30; }).length,
      total: open.reduce((sum, d) => sum + (Number(d.amount_expected) || 0), 0),
    };
  }, [deadlines]);

  return (
    <AuthGuard><AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-3xl font-bold">Dashboard</h1><p className="text-slate-500">La situazione aggiornata delle tue scadenze.</p></div>
        <Link href="/deadlines/new" className="button-primary">+ Nuova scadenza</Link>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={AlertTriangle} label="Scadute" value={String(stats.overdue)} />
        <Stat icon={CalendarClock} label="Entro 7 giorni" value={String(stats.seven)} />
        <Stat icon={CalendarDays} label="Entro 30 giorni" value={String(stats.thirty)} />
        <Stat icon={WalletCards} label="Importo previsto" value={formatCurrency(stats.total)} />
      </div>
      <div className="card mt-6 p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_150px_170px]">
          <label className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={18} /><input className="input pl-10" placeholder="Cerca IMU, assicurazione, 730…" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((c) => <option key={c}>{c}</option>)}</select>
          <select className="input" value={range} onChange={(e) => setRange(e.target.value)}><option value="7">7 giorni</option><option value="30">30 giorni</option><option value="90">90 giorni</option><option value="tutte">Tutte le date</option></select>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="open">Da gestire</option><option value="paid">Pagate</option><option value="cancelled">Annullate</option><option value="not_applicable">Non applicabili</option><option value="tutte">Tutte</option></select>
        </div>
        <div className="mt-4 divide-y divide-slate-100">
          {loading && <p className="py-6 text-slate-500">Caricamento…</p>}
          {!loading && filtered.length === 0 && <p className="py-6 text-slate-500">Nessuna scadenza trovata.</p>}
          {filtered.map((deadline) => { const badge = getVisualStatus(deadline); return <Link key={deadline.id} href={`/deadlines/${deadline.id}`} className="flex flex-col gap-2 py-4 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:px-2"><div><p className="font-semibold">{deadline.title}</p><p className="text-sm text-slate-500">{deadline.category} · {formatDateIT(deadline.due_date)} · {formatCurrency(deadline.amount_expected)}</p></div><span className={`w-fit rounded-full px-3 py-1 text-sm font-medium ${badge.className}`}>{badge.label}</span></Link>; })}
        </div>
      </div>
    </AppShell></AuthGuard>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return <div className="card p-5"><Icon size={22} className="mb-4 text-slate-500" /><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>;
}
