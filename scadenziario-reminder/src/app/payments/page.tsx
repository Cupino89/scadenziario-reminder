"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import type { Payment } from "@/lib/types";
import { formatCurrency, formatDateIT } from "@/lib/date";

type PaymentWithDeadline = Payment & { deadlines: { title: string; category: string } | null };

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentWithDeadline[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("payments")
      .select("*, deadlines(title,category)")
      .order("paid_at", { ascending: false })
      .then(({ data }) => {
        setPayments((data ?? []) as PaymentWithDeadline[]);
        setLoading(false);
      });
  }, []);

  return (
    <AuthGuard>
      <AppShell>
        <h1 className="text-3xl font-bold">Pagamenti</h1>
        <p className="text-slate-500">Storico generale delle operazioni registrate.</p>

        <div className="card mt-6 divide-y divide-slate-100 p-5">
          {loading && <p className="py-5">Caricamento…</p>}
          {!loading && payments.length === 0 && <p className="py-5 text-slate-500">Nessun pagamento registrato.</p>}
          {payments.map((p) => (
            <div key={p.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{p.deadlines?.title ?? "Scadenza"}</p>
                <p className="text-sm text-slate-500">{p.deadlines?.category} · {formatDateIT(p.paid_at)}</p>
              </div>
              <p className="font-bold">{formatCurrency(p.amount_paid)}</p>
            </div>
          ))}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
