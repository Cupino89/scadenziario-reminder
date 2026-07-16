"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Pencil, Trash2, Upload } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import type { Deadline, Payment } from "@/lib/types";
import { formatCurrency, formatDateIT } from "@/lib/date";

function getNextDueDate(currentDate: string, recurrence: string): string | null {
  const date = new Date(`${currentDate}T00:00:00`);

  if (recurrence === "monthly") date.setMonth(date.getMonth() + 1);
  else if (recurrence === "quarterly") date.setMonth(date.getMonth() + 3);
  else if (recurrence === "semiannual") date.setMonth(date.getMonth() + 6);
  else if (recurrence === "yearly") date.setFullYear(date.getFullYear() + 1);
  else return null;

  return date.toISOString().slice(0, 10);
}

export default function DeadlineDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [deadline, setDeadline] = useState<Deadline | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentForm, setPaymentForm] = useState({
    paid_at: new Date().toISOString().slice(0, 10),
    amount_paid: "",
    note: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [d, p] = await Promise.all([
      supabase.from("deadlines").select("*").eq("id", params.id).single(),
      supabase.from("payments").select("*").eq("deadline_id", params.id).order("paid_at", { ascending: false }),
    ]);
    if (!d.error) setDeadline(d.data as Deadline);
    if (!p.error) setPayments((p.data ?? []) as Payment[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [params.id]);

  async function registerPayment(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    if (!deadline) {
      setMessage("Scadenza non disponibile.");
      setSaving(false);
      return;
    }

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setMessage("Sessione scaduta.");
      setSaving(false);
      return;
    }

    let receiptPath: string | null = null;

    if (file) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      receiptPath = `${auth.user.id}/${params.id}/${Date.now()}-${safeName}`;
      const uploaded = await supabase.storage.from("receipts").upload(receiptPath, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (uploaded.error) {
        setMessage(`Errore caricamento ricevuta: ${uploaded.error.message}`);
        setSaving(false);
        return;
      }
    }

    const inserted = await supabase.from("payments").insert({
      deadline_id: params.id,
      paid_at: paymentForm.paid_at,
      amount_paid: paymentForm.amount_paid ? Number(paymentForm.amount_paid.replace(",", ".")) : null,
      note: paymentForm.note.trim() || null,
      receipt_path: receiptPath,
    });

    if (inserted.error) {
      if (receiptPath) await supabase.storage.from("receipts").remove([receiptPath]);
      setMessage(`Errore registrazione: ${inserted.error.message}`);
      setSaving(false);
      return;
    }

    const nextDueDate = getNextDueDate(deadline.due_date, deadline.recurrence);

    const deadlineUpdate = nextDueDate
      ? await supabase
          .from("deadlines")
          .update({ due_date: nextDueDate, is_active: true })
          .eq("id", params.id)
      : await supabase
          .from("deadlines")
          .update({ is_active: false })
          .eq("id", params.id);

    if (deadlineUpdate.error) {
      setMessage(`Pagamento salvato, ma stato scadenza non aggiornato: ${deadlineUpdate.error.message}`);
      setSaving(false);
      await load();
      return;
    }

    setPaymentForm({
      paid_at: new Date().toISOString().slice(0, 10),
      amount_paid: "",
      note: "",
    });
    setFile(null);
    setSaving(false);
    setMessage(
      nextDueDate
        ? `Pagamento registrato. Prossima scadenza: ${formatDateIT(nextDueDate)}.`
        : "Pagamento registrato. Scadenza contrassegnata come pagata."
    );
    await load();
  }

  async function openReceipt(path: string) {
    const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, 300);
    if (error) {
      setMessage(`Impossibile aprire la ricevuta: ${error.message}`);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function removeDeadline() {
    if (!window.confirm("Eliminare questa scadenza e lo storico collegato?")) return;
    const result = await supabase.from("deadlines").delete().eq("id", params.id);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <AuthGuard>
      <AppShell>
        {loading && <p>Caricamento…</p>}
        {!loading && !deadline && <p>Scadenza non trovata.</p>}
        {deadline && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500">{deadline.category}</p>
                <h1 className="text-3xl font-bold">{deadline.title}</h1>
                <p className="mt-1 text-slate-500">Scadenza: {formatDateIT(deadline.due_date)}</p>
              </div>
              <div className="flex gap-2">
                <Link href={`/deadlines/${params.id}/edit`} className="button-secondary"><Pencil size={18} /> Modifica</Link>
                <button onClick={removeDeadline} className="button-secondary text-red-600"><Trash2 size={18} /></button>
              </div>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <div className="card p-5">
                <h2 className="text-lg font-bold">Dati scadenza</h2>
                <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <Info label="Importo previsto" value={formatCurrency(deadline.amount_expected)} />
                  <Info label="Ricorrenza" value={deadline.recurrence} />
                  <Info label="Promemoria" value={`${deadline.reminder_days.join(", ")} giorni`} />
                  <Info label="Stato" value={deadline.is_active ? "Attiva" : "Pagata / inattiva"} />
                </dl>
                {deadline.notes && <p className="mt-5 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm">{deadline.notes}</p>}
              </div>

              <form onSubmit={registerPayment} className="card p-5">
                <h2 className="text-lg font-bold">Registra pagamento</h2>
                <div className="mt-4 space-y-3">
                  <input className="input" type="date" value={paymentForm.paid_at} onChange={(e) => setPaymentForm({ ...paymentForm, paid_at: e.target.value })} required />
                  <input className="input" inputMode="decimal" placeholder="Importo pagato" value={paymentForm.amount_paid} onChange={(e) => setPaymentForm({ ...paymentForm, amount_paid: e.target.value })} />
                  <textarea className="input min-h-20" placeholder="Note" value={paymentForm.note} onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })} />
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 p-3 text-sm">
                    <Upload size={18} />
                    <span>{file ? file.name : "Carica ricevuta PDF, JPG o PNG"}</span>
                    <input
                      className="hidden"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <button className="button-primary w-full" disabled={saving}>{saving ? "Salvataggio…" : "Registra pagamento"}</button>
                  {message && <p className="text-sm text-slate-600">{message}</p>}
                </div>
              </form>
            </div>

            <div className="card mt-6 p-5">
              <h2 className="text-lg font-bold">Storico pagamenti</h2>
              <div className="mt-3 divide-y divide-slate-100">
                {payments.length === 0 && <p className="py-5 text-slate-500">Nessun pagamento registrato.</p>}
                {payments.map((payment) => (
                  <div key={payment.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">{formatCurrency(payment.amount_paid)}</p>
                      <p className="text-sm text-slate-500">{formatDateIT(payment.paid_at)}{payment.note ? ` · ${payment.note}` : ""}</p>
                    </div>
                    {payment.receipt_path && (
                      <button className="button-secondary" onClick={() => openReceipt(payment.receipt_path!)}>
                        <FileText size={18} /> Apri ricevuta
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </AppShell>
    </AuthGuard>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
