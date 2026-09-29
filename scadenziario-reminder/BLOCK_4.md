# Blocco 4 Allegati multipli

Gli allegati appartengono a una singola occorrenza e, facoltativamente, a un pagamento. Gli avvisi si possono caricare prima di pagare. Ricevute e quietanze si aggiungono al pagamento, anche in un secondo momento.

## Comportamenti

- PDF, JPG e PNG, massimo 10 MB per file, selezione multipla.
- Nome, tipo e descrizione modificabili; sostituzione, eliminazione, anteprima immagini, apertura PDF e download con URL temporanei.
- I file esistenti non vengono spostati: la migrazione crea soltanto i riferimenti nella tabella attachments.
- Annullando un pagamento, i documenti vengono conservati sull'occorrenza.
- Un'occorrenza con documenti non può essere eliminata implicitamente da un ripristino. L'utente deve prima conservare e rimuovere esplicitamente i documenti.
- Il pagamento rimane registrato se il caricamento successivo di una ricevuta fallisce. Il messaggio indica i file da aggiungere dallo storico, senza ripetere il pagamento.
- Sostituzione ed eliminazione prima aggiornano i riferimenti nel database e poi puliscono lo storage. Un errore di pulizia viene mostrato; può restare una copia non collegata nello storage.

## Verifica

Build produzione e TypeScript verificati. La migrazione e tests/attachments.sql sono stati eseguiti dentro una transazione con ROLLBACK, verificando conservazione dei documenti, annullamento pagamento, riferimenti corretti, oggetti storage esistenti e isolamento RLS fra utenti.

Il test browser locale non è stato eseguibile perché il runtime Chromium non è disponibile e il download non è riuscito. Verifica nell'app: carica due PDF nell'occorrenza, registra un pagamento, aggiungi due ricevute, rinomina/sostituisci un documento, apri e scarica; annulla il pagamento e verifica che i documenti rimangano nell'occorrenza.

## Rilascio e recupero

Applicare la migrazione prima del frontend. Per ripristinare il codice usare il commit precedente 96d7c0da272bee08554701b30cf16dc0d5423cb8. Non eliminare la tabella attachments dopo che sono stati aggiunti nuovi documenti: il frontend precedente non mostra gli allegati multipli. Preferire una correzione in avanti. Non eseguire tests/attachments.sql senza BEGIN/ROLLBACK: il test altera temporaneamente riferimenti esistenti ma non scrive o elimina file nello storage.
