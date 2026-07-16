"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setMessage("Accesso non riuscito. Controlla email e password.");
      return;
    }
    router.replace("/dashboard");
  }

  async function resetPassword() {
    if (!email) {
      setMessage("Inserisci prima il tuo indirizzo email.");
      return;
    }
    setRecoveryLoading(true);
    setMessage("");
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setRecoveryLoading(false);
    if (error) {
      setMessage(`Errore nell'invio: ${error.message}`);
      return;
    }
    setMessage("Email di recupero inviata. Apri il nuovo link ricevuto.");
  }

  return (
    <main className="min-h-screen grid place-items-center px-4">
      <div className="card w-full max-w-md p-7">
        <div className="mb-6 flex items-center gap-3">
          <img src="/icon.svg" alt="" className="h-12 w-12 rounded-2xl" />
          <div>
            <h1 className="text-2xl font-bold">Scadenziario</h1>
            <p className="text-sm text-slate-500">Pagamenti e ricevute sotto controllo.</p>
          </div>
        </div>
        <form onSubmit={login} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Email</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Password</span>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button className="button-primary w-full" disabled={loading}>
            <LockKeyhole size={18} /> {loading ? "Accesso…" : "Accedi"}
          </button>
          <button type="button" onClick={resetPassword} disabled={recoveryLoading}
            className="w-full text-sm font-medium text-slate-600 underline underline-offset-4 disabled:opacity-50">
            {recoveryLoading ? "Invio in corso…" : "Password dimenticata?"}
          </button>
          {message && <p className="text-sm text-slate-600">{message}</p>}
        </form>
      </div>
    </main>
  );
}
