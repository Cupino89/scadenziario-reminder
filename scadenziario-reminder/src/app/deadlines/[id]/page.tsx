"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Ban,
  FileText,
  Pencil,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  SkipForward,
  X,
  XCircle,
} from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import type { Deadline, DeadlineOccurrence, DeadlineStatus, Payment } from "@/lib/types";
import { daysUntil, formatCurrency, formatDateIT } from "@/lib/date";

function getStatusLabel(deadline: Deadline): string {
  if (deadline.status === "paid") return "Pagata";
  if (deadline.status === "cancelled") return "Annullata";
  if (deadline.status === "not_applicable") return "Non applicabile";

  const days = daysUntil(deadline.due_date);
  if (days < 0) return "Scaduta";
  if (days <= 7) return "In scadenza";
  return "Da pagare";
}

type EditForm = {
  paid_at: string;
  amount_paid: string;
  note: string;
};

export default function DeadlineDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [deadline, setDeadline] = useState<Deadline | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [occurrences, setOccurrences] = useState<DeadlineOccurrence[]>([]);
  const [loading, setLoading] = useState(true);

  const [paymentForm, setPaymentForm] = useState({
    paid_at: new Date().toISOString().slice(0, 10),
    amount_paid: "",
    note: "",
  });
  const [file, setFile] = useState<File | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editFile, setEditFile] = useState<File | null>(null);

  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);

    const [d, p, o] = await Promise.all([
      supabase.from("deadlines").select("*").eq("id", params.id).single(),
      supabase
        .from("payments")
        .select("*")
        .eq("deadline_id", params.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("deadline_occurrences")
        .select("*")
        .eq("deadline_id", params.id)
        .order("due_date", { ascending: false }),
    ]);

    if (!d.error) setDeadline(d.data as Deadline);
    if (!p.error) setPayments((p.data ?? []) as Payment[]);
    if (!o.error) setOccurrences((o.data ?? []) as DeadlineOccurrence[]);

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [params.id]);

  async function changeStatus(status: DeadlineStatus) {
    const descriptions: Record<DeadlineStatus, string> = {
      open: "riaprire",
      paid: "segnare come pagata",
      cancelled: "annullare",
      not_applicable: "segnare come non applicabile",
    };

    if (!window.confirm(`Confermi di voler ${descriptions[status]} questa scadenza?`)) {
      return;
    }

    setMessage("");
    const { error } = await supabase
      .from("deadlines")
      .update({ status })
      .eq("id", params.id);

    setMessage(error ? `Errore aggiornamento stato: ${error.message}` : "Stato aggiornato.");
    if (!error) await load();
  }

  async function uploadReceipt(selectedFile: File) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Sessione scaduta.");

    const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${auth.user.id}/${params.id}/${Date.now()}-${safeName}`;

    const { error } = await supabase.storage
      .from("receipts")
      .upload(path, selectedFile, { cacheControl: "3600", upsert: false });

    if (error) throw error;
    return path;
  }

  async function registerPayment(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    if (!deadline || deadline.status !== "open") {
      setMessage("Riapri la scadenza prima di registrare un nuovo pagamento.");
      setSaving(false);
      return;
    }

    let receiptPath: string | null = null;

    try {
      if (file) receiptPath = await uploadReceipt(file);

      const { data, error } = await supabase.rpc("register_payment_atomic", {
        p_deadline_id: params.id,
        p_paid_at: paymentForm.paid_at,
        p_amount_paid: paymentForm.amount_paid
          ? Number(paymentForm.amount_paid.replace(",", "."))
          : null,
        p_note: paymentForm.note.trim() || null,
        p_receipt_path: receiptPath,
      });

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      setPaymentForm({
        paid_at: new Date().toISOString().slice(0, 10),
        amount_paid: "",
        note: "",
      });
      setFile(null);

      setMessage(
        result?.next_due_date
          ? `Pagamento registrato. Prossima scadenza: ${formatDateIT(result.next_due_date)}.`
          : "Pagamento registrato. Scadenza contrassegnata come pagata."
      );

      await load();
    } catch (error) {
      if (receiptPath) {
        await supabase.storage.from("receipts").remove([receiptPath]);
      }
      setMessage(
        `Errore registrazione: ${error instanceof Error ? error.message : "operazione non riuscita"}`
      );
    } finally {
      setSaving(false);
    }
  }

  function startEditing(payment: Payment) {
    setEditingId(payment.id);
    setEditFile(null);
    setEditForm({
      paid_at: payment.paid_at,
      amount_paid: payment.amount_paid == null ? "" : String(payment.amount_paid),
      note: payment.note ?? "",
    });
    setMessage("");
  }

  function stopEditing() {
    setEditingId(null);
    setEditForm(null);
    setEditFile(null);
  }

  async function savePayment(payment: Payment) {
    if (!editForm) return;

    setSaving(true);
    setMessage("");

    let newReceiptPath: string | null = payment.receipt_path;

    try {
      if (editFile) newReceiptPath = await uploadReceipt(editFile);

      const { error } = await supabase.rpc("update_payment_atomic", {
        p_payment_id: payment.id,
        p_paid_at: editForm.paid_at,
        p_amount_paid: editForm.amount_paid
          ? Number(editForm.amount_paid.replace(",", "."))
          : null,
        p_note: editForm.note.trim() || null,
        p_receipt_path: newReceiptPath,
      });

      if (error) throw error;

      if (editFile && payment.receipt_path && payment.receipt_path !== newReceiptPath) {
        await supabase.storage.from("receipts").remove([payment.receipt_path]);
      }

      stopEditing();
      setMessage("Pagamento aggiornato.");
      await load();
    } catch (error) {
      if (editFile && newReceiptPath && newReceiptPath !== payment.receipt_path) {
        await supabase.storage.from("receipts").remove([newReceiptPath]);
      }
      setMessage(
        `Errore modifica pagamento: ${error instanceof Error ? error.message : "operazione non riuscita"}`
      );
    } finally {
      setSaving(false);
    }
  }

  async function deletePayment(payment: Payment) {
    if (
      !window.confirm(
        "Annullare questo pagamento? La scadenza verrà riportata allo stato e alla data precedenti."
      )
    ) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { data, error } = await supabase.rpc("delete_latest_payment_and_restore", {
        p_payment_id: payment.id,
      });

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      const receiptToDelete = result?.deleted_receipt_path as string | null | undefined;

      if (receiptToDelete) {
        const { error: storageError } = await supabase.storage
          .from("receipts")
          .remove([receiptToDelete]);

        if (storageError) {
          setMessage(
            "Pagamento annullato e scadenza ripristinata. La vecchia ricevuta non è stata eliminata dallo storage."
          );
          await load();
          return;
        }
      }

      setMessage("Pagamento annullato. La scadenza è stata ripristinata.");
      await load();
    } catch (error) {
      setMessage(
        `Errore annullamento pagamento: ${error instanceof Error ? error.message : "operazione non riuscita"}`
      );
    } finally {
      setSaving(false);
    }
  }


  async function skipOccurrence() {
    if (!deadline || deadline.recurrence === "none") return;
    if (!window.confirm("Saltare questa occorrenza e passare automaticamente alla successiva?")) return;

    setSaving(true);
    setMessage("");

    const { data, error } = await supabase.rpc("skip_current_occurrence", {
      p_deadline_id: deadline.id,
    });

    if (error) {
      setMessage(`Errore: ${error.message}`);
      setSaving(false);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    setMessage(
      result?.next_due_date
        ? `Occorrenza saltata. Prossima scadenza: ${formatDateIT(result.next_due_date)}.`
        : "Occorrenza saltata."
    );
    setSaving(false);
    await load();
  }


  async function restoreSkippedOccurrence(occurrence: DeadlineOccurrence) {
    if (!window.confirm("Ripristinare questa occorrenza? La successiva creata dal salto verrà rimossa.")) return;

    setSaving(true);
    setMessage("");

    const { data, error } = await supabase.rpc("restore_skipped_occurrence", {
      p_occurrence_id: occurrence.id,
    });

    if (error) {
      setMessage(`Errore ripristino: ${error.message}`);
      setSaving(false);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    setMessage(
      result?.restored_due_date
        ? `Occorrenza ripristinata: ${formatDateIT(result.restored_due_date)}.`
        : "Occorrenza ripristinata."
    );
    setSaving(false);
    await load();
  }

  async function markSkippedPaid(occurrence: DeadlineOccurrence) {
    const paidAt = window.prompt(
      "Data pagamento (AAAA-MM-GG):",
      new Date().toISOString().slice(0, 10)
    );
    if (!paidAt) return;

    const amountInput = window.prompt("Importo pagato (facoltativo):", "");
    if (amountInput === null) return;

    const note = window.prompt("Nota (facoltativa):", "") ?? "";

    setSaving(true);
    setMessage("");

    const { error } = await supabase.rpc("mark_skipped_occurrence_paid", {
      p_occurrence_id: occurrence.id,
      p_paid_at: paidAt,
      p_amount_paid: amountInput.trim()
        ? Number(amountInput.replace(",", "."))
        : null,
      p_note: note.trim() || null,
    });

    if (error) {
      setMessage(`Errore correzione: ${error.message}`);
      setSaving(false);
      return;
    }

    setMessage("Occorrenza corretta come pagata.");
    setSaving(false);
    await load();
  }

  async function openReceipt(path: string) {
    const { data, error } = await supabase.storage
      .from("receipts")
      .createSignedUrl(path, 300);

    if (error) {
      setMessage(`Impossibile aprire la ricevuta: ${error.message}`);
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function removeDeadline() {
    if (!window.confirm("Eliminare questa scadenza e lo storico collegato?")) return;

    const result = await supabase.from("deadlines").delete().eq("id", params.id);

    if (result.error) setMessage(result.error.message);
    else router.push("/dashboard");
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
                <p className="mt-1 text-slate-500">
                  Scadenza: {formatDateIT(deadline.due_date)} · {getStatusLabel(deadline)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link href={`/deadlines/${params.id}/edit`} className="button-secondary">
                  <Pencil size={18} /> Modifica
                </Link>
                <button onClick={removeDeadline} className="button-secondary text-red-600">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {deadline.status === "open" ? (
                <>
                  <button
                    className="button-secondary"
                    onClick={() => changeStatus("cancelled")}
                  >
                    <XCircle size={18} /> Annulla
                  </button>
                  <button
                    className="button-secondary"
                    onClick={() => changeStatus("not_applicable")}
                  >
                    <Ban size={18} /> Non applicabile
                  </button>
                  {deadline.recurrence !== "none" && (
                    <button
                      className="button-secondary"
                      onClick={skipOccurrence}
                      disabled={saving}
                    >
                      <SkipForward size={18} /> Salta questa occorrenza
                    </button>
                  )}
                </>
              ) : (
                <button
                  className="button-secondary"
                  onClick={() => changeStatus("open")}
                >
                  <RotateCcw size={18} /> Riapri scadenza
                </button>
              )}
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <div className="card p-5">
                <h2 className="text-lg font-bold">Dati scadenza</h2>
                <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <Info
                    label="Importo previsto"
                    value={formatCurrency(deadline.amount_expected)}
                  />
                  <Info label="Ricorrenza" value={deadline.recurrence} />
                  <Info
                    label="Promemoria"
                    value={`${deadline.reminder_days.join(", ")} giorni`}
                  />
                  <Info label="Stato" value={getStatusLabel(deadline)} />
                </dl>

                {deadline.notes && (
                  <p className="mt-5 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm">
                    {deadline.notes}
                  </p>
                )}
              </div>

              {deadline.status === "open" ? (
                <form onSubmit={registerPayment} className="card p-5">
                  <h2 className="text-lg font-bold">Registra pagamento</h2>

                  <div className="mt-4 space-y-3">
                    <input
                      className="input"
                      type="date"
                      value={paymentForm.paid_at}
                      onChange={(e) =>
                        setPaymentForm({ ...paymentForm, paid_at: e.target.value })
                      }
                      required
                    />

                    <input
                      className="input"
                      inputMode="decimal"
                      placeholder="Importo pagato"
                      value={paymentForm.amount_paid}
                      onChange={(e) =>
                        setPaymentForm({
                          ...paymentForm,
                          amount_paid: e.target.value,
                        })
                      }
                    />

                    <textarea
                      className="input min-h-20"
                      placeholder="Note"
                      value={paymentForm.note}
                      onChange={(e) =>
                        setPaymentForm({ ...paymentForm, note: e.target.value })
                      }
                    />

                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 p-3 text-sm">
                      <Upload size={18} />
                      <span>
                        {file ? file.name : "Carica ricevuta PDF, JPG o PNG"}
                      </span>
                      <input
                        className="hidden"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      />
                    </label>

                    <button className="button-primary w-full" disabled={saving}>
                      {saving ? "Salvataggio…" : "Registra pagamento"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="card p-5">
                  <h2 className="text-lg font-bold">Pagamento non disponibile</h2>
                  <p className="mt-3 text-sm text-slate-500">
                    Questa scadenza non è aperta. Per registrare un altro pagamento
                    devi prima riaprirla.
                  </p>
                </div>
              )}
            </div>

            {message && <p className="mt-4 text-sm text-slate-600">{message}</p>}


            <div className="card mt-6 p-5">
              <h2 className="text-lg font-bold">Storico occorrenze</h2>
              <p className="mt-1 text-sm text-slate-500">
                Ogni riga rappresenta una singola scadenza della serie.
              </p>

              <div className="mt-3 divide-y divide-slate-100">
                {occurrences.length === 0 && (
                  <p className="py-5 text-slate-500">Nessuna occorrenza disponibile.</p>
                )}

                {occurrences.map((occurrence) => {
                  const labels: Record<string, string> = {
                    open: "Da gestire",
                    paid: "Pagata",
                    skipped: "Saltata",
                    cancelled: "Annullata",
                  };
                  const classes: Record<string, string> = {
                    open: "bg-slate-100 text-slate-700",
                    paid: "bg-emerald-100 text-emerald-700",
                    skipped: "bg-amber-100 text-amber-700",
                    cancelled: "bg-slate-200 text-slate-600",
                  };

                  return (
                    <div
                      key={occurrence.id}
                      className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="font-medium">{formatDateIT(occurrence.due_date)}</span>

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-sm font-medium ${classes[occurrence.status] ?? "bg-slate-100 text-slate-700"}`}
                        >
                          {labels[occurrence.status] ?? occurrence.status}
                        </span>

                        {occurrence.status === "skipped" && (
                          <>
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() => restoreSkippedOccurrence(occurrence)}
                              disabled={saving}
                            >
                              <RotateCcw size={16} /> Ripristina
                            </button>
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() => markSkippedPaid(occurrence)}
                              disabled={saving}
                            >
                              <Save size={16} /> Segna come pagata
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card mt-6 p-5">
              <h2 className="text-lg font-bold">Storico pagamenti</h2>

              <div className="mt-3 divide-y divide-slate-100">
                {payments.length === 0 && (
                  <p className="py-5 text-slate-500">Nessun pagamento registrato.</p>
                )}

                {payments.map((payment) => {
                  const editing = editingId === payment.id && editForm;

                  return (
                    <div key={payment.id} className="py-4">
                      {editing ? (
                        <div className="space-y-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <input
                              className="input"
                              type="date"
                              value={editForm.paid_at}
                              onChange={(e) =>
                                setEditForm({ ...editForm, paid_at: e.target.value })
                              }
                            />
                            <input
                              className="input"
                              inputMode="decimal"
                              placeholder="Importo pagato"
                              value={editForm.amount_paid}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  amount_paid: e.target.value,
                                })
                              }
                            />
                          </div>

                          <textarea
                            className="input min-h-20"
                            placeholder="Note"
                            value={editForm.note}
                            onChange={(e) =>
                              setEditForm({ ...editForm, note: e.target.value })
                            }
                          />

                          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 p-3 text-sm">
                            <Upload size={18} />
                            <span>
                              {editFile
                                ? editFile.name
                                : payment.receipt_path
                                  ? "Sostituisci ricevuta"
                                  : "Aggiungi ricevuta"}
                            </span>
                            <input
                              className="hidden"
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                              onChange={(e) =>
                                setEditFile(e.target.files?.[0] ?? null)
                              }
                            />
                          </label>

                          <div className="flex flex-wrap gap-2">
                            <button
                              className="button-primary"
                              onClick={() => savePayment(payment)}
                              disabled={saving}
                            >
                              <Save size={18} /> Salva modifiche
                            </button>
                            <button
                              className="button-secondary"
                              onClick={stopEditing}
                              disabled={saving}
                            >
                              <X size={18} /> Annulla modifica
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-semibold">
                              {formatCurrency(payment.amount_paid)}
                            </p>
                            <p className="text-sm text-slate-500">
                              {formatDateIT(payment.paid_at)}
                              {payment.note ? ` · ${payment.note}` : ""}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {payment.receipt_path && (
                              <button
                                className="button-secondary"
                                onClick={() => openReceipt(payment.receipt_path!)}
                              >
                                <FileText size={18} /> Apri ricevuta
                              </button>
                            )}

                            <button
                              className="button-secondary"
                              onClick={() => startEditing(payment)}
                            >
                              <Pencil size={18} /> Modifica
                            </button>

                            <button
                              className="button-secondary text-red-600"
                              onClick={() => deletePayment(payment)}
                              disabled={saving}
                              title="Puoi annullare solo il pagamento più recente"
                            >
                              <Trash2 size={18} /> Annulla pagamento
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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
