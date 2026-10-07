# Blocco 7 — Prima fase: notifiche personali nell'app

Implementato:
- Centro Notifiche con paginazione, filtro da leggere, lettura/non lettura persistente per account.
- Avviso riepilogativo nelle pagine dell'app, disattivabile nelle Notifiche.
- Generazione all'accesso/apertura pagine e su Aggiorna, con recupero dei promemoria maturati negli ultimi 30 giorni per occorrenze ancora aperte.
- Fuso Europe/Rome, rispetto di reminder_days, deduplicazione per utente/occorrenza/data scadenza/anticipo.
- Esclusione dagli avvisi attivi di pagate, annullate, cestinate e scadenze con data/anticipi modificati.
- RLS per eventi e preferenze; vista security_invoker e funzione invoker, nessun privilegio anonimo.

Il processo Telegram esistente resta separato e invariato. Nessun messaggio esterno inviato durante questo sviluppo.

Prossime fasi: generazione pianificata centralizzata; consegne distinte per evento/canale/destinatario con deduplicazione e gestione errori; collegamento Telegram verificato per account; email con provider e dominio; push con consenso e registrazione dispositivo. SMS esclusi dalla versione base. Non mostrare interruttori per canali non ancora disponibili.

Verificato: build Next.js, tipi, tests/reminders.sql in transazione annullata (doppio refresh, stato letto, cestino/ripristino, cambio data, pagamento, isolamento e scritture tra utenti). Il test usa utenti sintetici e non lascia dati. Non eseguita verifica visiva browser.

Corrette inoltre la descrizione dei filtri proprietario/bene e l'opzione senza collegamento, rimaste incoerenti dal precedente aggiornamento.
