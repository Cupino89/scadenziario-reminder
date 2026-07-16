"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/AppShell";
import DeadlineForm from "@/components/DeadlineForm";
import { supabase } from "@/lib/supabase";
import type { Deadline } from "@/lib/types";

export default function EditDeadlinePage() {
  const params = useParams<{ id: string }>();
  const [deadline, setDeadline] = useState<Deadline | null>(null);

  useEffect(() => {
    supabase.from("deadlines").select("*").eq("id", params.id).single()
      .then(({ data }) => setDeadline(data as Deadline));
  }, [params.id]);

  return (
    <AuthGuard>
      <AppShell>
        <h1 className="text-3xl font-bold">Modifica scadenza</h1>
        {deadline ? <DeadlineForm initial={deadline} /> : <p className="mt-6">Caricamento…</p>}
      </AppShell>
    </AuthGuard>
  );
}
