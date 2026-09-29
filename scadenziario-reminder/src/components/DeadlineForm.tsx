"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Deadline } from "@/lib/types";

const categories = ["Tasse", "Auto", "Casa", "Assicurazioni", "Documenti", "Utenze", "Altro"];

export default function DeadlineForm({ initial }: { initial?: Deadline }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    category: initial?.category ?? "Tasse",
    due_date: initial?.due_date ?? "",
    recurrence: initial?.recurrence ?? "none",
    recurrence_interval: initial?.recurrence_interval?.toString() ?? "1",
    recurrence_unit: initial?.recurrence_unit ?? "months",
    amount_expected: initial?.amount_expected?.toString() ?? "",
    notes: initial?.notes ?? "",
    reminder_days: initial?.reminder_days?.join(",") ?? "14,3,1",
    is_active: initial?.is_active ?? true,
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function update(name: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setMessage("Sessione scaduta.");
      setSaving(false);
      return;
    }

    if (form.recurrence === "custom" && (!Number(form.recurrence_interval) || Number(form.recurrence_interval) <= 0)) {
      setMessage("Inserisci un intervallo personalizzato valido.");
      setSaving(false);
      return;
    }

    const payload = {
      user_id: auth.user.id,
      title: form.title.trim(),
      category: form.category,
      due_date: form.due_date,
      recurrence: form.recurrence,
      recurrence_interval: form.recurrence === "custom" ? Number(form.recurrence_interval) : null,
      recurrence_unit: form.recurrence === "custom" ? form.recurrence_unit : null,
      amount_expected: form.amount_expected ? Number(form.amount_expected.replace(",", ".")) : null,
      notes: form.notes.trim() || null,
      reminder_days: form.reminder_days
        .split(",")
        .map((n) => Number(n.trim()))
        .filter((n) => Number.isFinite(n)),
      is_active: form.is_active,
    };

    const result = initial
      ? await supabase.from("deadlines").update(payload).eq("id", initial.id)
      : await supabase.from("deadlines").insert(payload).select("id").single();

    setSaving(false);
    if (result.error) {
      setMessage(`Errore: ${result.error.message}`);
      return;
    }

    const id = initial?.id ?? (result.data as { id: string }).id;
    router.push(`/deadlines/${id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card mt-6 space-y-5 p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Titolo">
          <input className="input" value={form.title} onChange={(e) => update("title", e.target.value)} required />
        </Field>

        <Field label="Categoria">
          <select className="input" value={form.category} onChange={(e) => update("category", e.target.value)}>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>

        <Field label="Data scadenza">
          <input className="input" type="date" value={form.due_date} onChange={(e) => update("due_date", e.target.value)} required />
        </Field>

        <Field label="Ricorrenza">
          <select className="input" value={form.recurrence} onChange={(e) => update("recurrence", e.target.value)}>
            <option value="none">Una tantum</option>
            <option value="monthly">Mensile</option>
            <option value="quarterly">Trimestrale</option>
            <option value="semiannual">Semestrale</option>
            <option value="yearly">Annuale</option>
            <option value="custom">Personalizzata</option>
          </select>
        </Field>

        {form.recurrence === "custom" && (
          <>
            <Field label="Ogni">
              <input
                className="input"
                type="number"
                min="1"
                value={form.recurrence_interval}
                onChange={(e) => update("recurrence_interval", e.target.value)}
                required
              />
            </Field>

            <Field label="Unità">
              <select className="input" value={form.recurrence_unit} onChange={(e) => update("recurrence_unit", e.target.value)}>
                <option value="days">Giorni</option>
                <option value="weeks">Settimane</option>
                <option value="months">Mesi</option>
                <option value="years">Anni</option>
              </select>
            </Field>
          </>
        )}

        <Field label="Importo previsto">
          <input className="input" inputMode="decimal" value={form.amount_expected} onChange={(e) => update("amount_expected", e.target.value)} placeholder="Es. 250,00" />
        </Field>

        <Field label="Promemoria, giorni prima">
          <input className="input" value={form.reminder_days} onChange={(e) => update("reminder_days", e.target.value)} placeholder="14,3,1" />
        </Field>
      </div>

      <Field label="Note">
        <textarea className="input min-h-28" value={form.notes} onChange={(e) => update("notes", e.target.value)} />
      </Field>

      <label className="flex items-center gap-3">
        <input type="checkbox" checked={form.is_active} onChange={(e) => update("is_active", e.target.checked)} />
        <span className="font-medium">Scadenza attiva</span>
      </label>

      {message && <p className="text-sm text-red-600">{message}</p>}

      <div className="flex gap-3">
        <button className="button-primary" disabled={saving}>{saving ? "Salvataggio…" : "Salva"}</button>
        <button type="button" className="button-secondary" onClick={() => router.back()}>Annulla</button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
