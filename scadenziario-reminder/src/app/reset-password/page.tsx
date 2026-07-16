"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else setMessage("Link non valido o scaduto. Richiedi una nuova email di recupero.");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setMessage("La password deve contenere almeno 8 caratteri.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Le due password non coincidono.");
      return;
    }
    setSaving(true);
    setMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setMessage(`Errore: ${error.message}`);
      return;
    }
    setMessage("Password aggiornata. Reindirizzamento in corso…");
    setTimeout(() => router.replace("/dashboard"), 1200);
  }

  return (
    <main className="min-h-screen grid place-items-center px-4">
      <div className="card w-full max-w-md p-7">
        <div className="mb-6 flex items-center gap-3">
          <img src="/icon.svg" alt="" className="h-12 w-12 rounded-2xl" />
          <div>
            <h1 className="text-2xl font-bold">Nuova password</h1>
            <p className="text-sm text-slate-500">Scegli una nuova password per lo Scadenziario.</p>
          </div>
        </div>
        <form onSubmit={updatePassword} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Nuova password</span>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required disabled={!ready} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Ripeti password</span>
            <input className="input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required disabled={!ready} />
          </label>
          <button className="button-primary w-full" disabled={!ready || saving}>
            <KeyRound size={18} /> {saving ? "Salvataggio…" : "Imposta nuova password"}
          </button>
          {message && <p className="text-sm text-slate-600">{message}</p>}
        </form>
      </div>
    </main>
  );
}
