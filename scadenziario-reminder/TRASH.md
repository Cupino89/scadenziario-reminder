# Cestino scadenze

Elimina sposta l'intera scadenza/serie nel cestino. Nessuna cancellazione automatica o definitiva è esposta nell'app. Pagamenti, documenti e occorrenze restano intatti. Il ripristino mantiene la data originale e ripristina lo stato precedente.

La scadenza nel cestino è cancelled/is_active=false, quindi esclusa dal servizio Telegram esistente. Il trigger delle occorrenze non cambia lo storico durante spostamento/ripristino. Dashboard, pagamenti e modifica escludono le scadenze nel cestino; il dettaglio rimanda al ripristino.

Le RPC sono SECURITY INVOKER e controllano auth.uid(), oltre alle RLS esistenti. DELETE su deadlines revocato ad authenticated e anon: i client precedenti devono aggiornare la pagina e non possono più cancellare definitivamente.

Verifiche: build Next.js; transazione remota con ROLLBACK e utenti sintetici per eliminazione scadenza vuota, ripristino, immutabilità occorrenze, conservazione pagamento e stato pagata, isolamento tra utenti. Nessun dato reale cancellato dai test. Verifica visiva browser non eseguita.

Il cestino non può recuperare eliminazioni definitive precedenti alla sua introduzione.
