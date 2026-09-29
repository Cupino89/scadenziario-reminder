"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import type { Payment } from "@/lib/types";
import { formatCurrency, formatDateIT } from "@/lib/date";

type PaymentWithDeadline = Payment & {
  deadlines: { id: string; title: string; category: string } | null;
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentWithDeadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase
      .from("payments")
      .select("*, deadlines(id,title,category)")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setMessage(error.message);
        setPayments((data ?? []) as PaymentWithDeadline[]);
        setLoading(false);
      });
  }, []);

  async function openReceipt(path: string) {
    setMessage("");
    const { data, error } = await supabase.storage
      .from("receipts")
      .createSignedUrl(path, 300);

    if (error) {
      setMessage(`Impossibile aprire la ricevuta: ${error.message}`);
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <AuthGuard>
      <AppShell>
        <h1 className="text-3xl font-bold">Pagamenti</h1>
        <p className="text-slate-500">
          Storico generale delle operazioni registrate.
        </p>

        <div className="card mt-6 divide-y divide-slate-100 p-5">
          {loading && <p className="py-5">Caricamento…</p>}

          {!loading && payments.length === 0 && (
            <p className="py-5 text-slate-500">Nessun pagamento registrato.</p>
          )}

          {payments.map((payment) => (
            <div
              key={payment.id}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                {payment.deadlines?.id ? (
                  <Link
                    href={`/deadlines/${payment.deadlines.id}`}
                    className="font-semibold hover:underline"
                  >
                    {payment.deadlines.title}
                  </Link>
                ) : (
                  <p className="font-semibold">Scadenza</p>
                )}

                <p className="text-sm text-slate-500">
                  {payment.deadlines?.category ?? "—"} · {formatDateIT(payment.paid_at)}
                  {payment.note ? ` · ${payment.note}` : ""}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <p className="font-bold">{formatCurrency(payment.amount_paid)}</p>

                {payment.receipt_path && (
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => openReceipt(payment.receipt_path!)}
                  >
                    <FileText size={18} /> Apri ricevuta
                  </button>
                )}
              </div>
            </div>
          ))}

          {message && <p className="pt-4 text-sm text-red-600">{message}</p>}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
