import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/AppShell";
import DeadlineForm from "@/components/DeadlineForm";

export default function NewDeadlinePage() {
  return (
    <AuthGuard>
      <AppShell>
        <h1 className="text-3xl font-bold">Nuova scadenza</h1>
        <p className="text-slate-500">Inserisci i dati essenziali. I reminder predefiniti sono 14, 3 e 1 giorno prima.</p>
        <DeadlineForm />
      </AppShell>
    </AuthGuard>
  );
}
