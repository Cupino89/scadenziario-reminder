"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, CreditCard, LogOut, PlusCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  const nav = [
    { href: "/dashboard", label: "Dashboard", icon: CalendarDays },
    { href: "/deadlines/new", label: "Nuova scadenza", icon: PlusCircle },
    { href: "/payments", label: "Pagamenti", icon: CreditCard },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-3 font-bold">
            <img src="/icon.svg" alt="" className="h-9 w-9 rounded-xl" />
            <span>Scadenziario</span>
          </Link>
          <button onClick={logout} className="button-secondary px-3 py-2">
            <LogOut size={18} /> <span className="hidden sm:inline">Esci</span>
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[220px_1fr]">
        <aside className="card h-fit p-3">
          <nav className="grid gap-1 sm:grid-cols-3 md:grid-cols-1">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                    active ? "bg-slate-900 text-white" : "hover:bg-slate-100"
                  }`}
                >
                  <Icon size={18} /> {label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <section>{children}</section>
      </div>
    </div>
  );
}
