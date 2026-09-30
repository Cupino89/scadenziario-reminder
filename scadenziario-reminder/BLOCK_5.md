# Blocco 5 — Dashboard

- Filtri per ricerca, categoria, persona/bene e periodo (7/30/90 giorni o tutte le date).
- Viste da gestire, scadute, in scadenza, pagamenti recenti, senza ricevuta, annullate, non applicabili e tutte.
- Azioni Modifica/Elimina direttamente nella riga. Conferma esplicita per l'intera serie ricorrente.
- Pagamenti letti dallo storico, indipendentemente dalla scadenza corrente della serie.
- Ricevute: documenti del pagamento con tipo receipt, discharge o f24, oppure puntatore legacy receipt_path. Una fattura non basta.
- Importo da pagare: scadenze correnti registrate nel periodo futuro, comprese arretrate. Pagato: periodo passato inclusivo di oggi. Non sono una previsione delle ricorrenze future né un confronto contabile sullo stesso intervallo.
- Importi mancanti mostrati separatamente; caricamento paginato per evitare il limite API di 1000 righe.
- Date calcolate nel fuso Europe/Rome, indipendentemente dal dispositivo.

## Protezioni database

La migrazione dashboard_safety sostituisce la FK entities con un vincolo composto (entity_id, user_id), conservando un'unica relazione per PostgREST. La cancellazione dell'entità scollega solo entity_id.
La FK payments→deadlines passa da CASCADE a RESTRICT: nessun pagamento può essere cancellato indirettamente eliminando una scadenza. Gli allegati erano già protetti da FK RESTRICT.

## Verifica

Build Next.js e controllo TypeScript riusciti. Test delle date (mezzanotte italiana, cambio ora, cambio anno), filtri e classificazione documenti in tests/dashboard.cjs.
Test transazionale remoto con due utenti sintetici, interamente annullato tramite ROLLBACK: isolamento lettura, rifiuto collegamento tra utenti, scollegamento dopo eliminazione entità, conservazione pagamento, eliminazione scadenza vuota.
Verifica visiva browser non eseguita nell'ambiente disponibile.

Restano i blocchi 7 (promemoria), 8 (importazione) e 9 (esportazione/archivio).
