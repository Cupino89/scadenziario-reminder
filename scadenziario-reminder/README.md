# Scadenziario Reminder

Web app personale per:

- gestire scadenze fiscali, assicurative e amministrative;
- ricevere reminder Telegram tramite il backend Supabase già configurato;
- registrare pagamenti;
- caricare e consultare ricevute PDF o immagini;
- usare l'app da PC e smartphone.

## Tecnologie

- Next.js
- TypeScript
- Tailwind CSS
- Supabase Auth, Database e Storage
- Vercel

## Configurazione variabili ambiente

Su Vercel aggiungere:

```env
NEXT_PUBLIC_SUPABASE_URL=https://mamrrklbqpjtsqbrfgei.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=LA_TUA_CHIAVE_ANON
```

Non inserire mai nel repository:

- password Supabase;
- service role key;
- token Telegram.

## Policy Storage

Il bucket `receipts` deve essere privato.

Nel SQL Editor Supabase eseguire il file:

`supabase/storage_policies.sql`

Questo permette all'utente autenticato di gestire solo file il cui percorso inizia dal proprio `user_id`.

## Deploy su Vercel

1. Caricare questi file nel repository GitHub.
2. Su Vercel scegliere **Add New → Project**.
3. Importare il repository.
4. Aggiungere le due variabili ambiente.
5. Avviare il deploy.
6. In Supabase Auth impostare il dominio Vercel come Site URL.

## Funzioni incluse

- login Supabase;
- dashboard con scadute, 7/30/90 giorni, ricerca e filtri;
- creazione, modifica ed eliminazione scadenze;
- importi previsti;
- reminder configurabili;
- registrazione pagamenti;
- upload ricevute;
- signed URL temporanei;
- storico pagamenti;
- manifest PWA installabile.

## Nota

La funzione che calcola automaticamente la prossima scadenza dopo il pagamento non è ancora inclusa. La ricorrenza viene registrata, ma l'avanzamento automatico sarà aggiunto in una fase successiva.
