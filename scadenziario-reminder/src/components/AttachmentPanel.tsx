"use client";

import DocumentPicker from "@/components/DocumentPicker";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Paperclip, Download, Eye, Pencil, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Attachment } from "@/lib/types";
import { DOCUMENT_TYPES, addDocument, documentError, documentUrl, uploadDocument, validateDocument } from "@/lib/attachments";

export default function AttachmentPanel({ deadlineId, occurrenceId, paymentId = null, title = "Documenti", disabled = false }: {
  deadlineId: string; occurrenceId: string; paymentId?: string | null; title?: string; disabled?: boolean;
}) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [kind, setKind] = useState(paymentId ? "receipt" : "notice");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState<Attachment | null>(null);
  const [replacement, setReplacement] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ url: string; item: Attachment } | null>(null);
  const [openLink, setOpenLink] = useState<{ url: string; name: string; download: boolean } | null>(null);
  const locked = busy || disabled;

  async function load() {
    let query = supabase.from("attachments").select("*").eq("occurrence_id", occurrenceId);
    query = paymentId ? query.eq("payment_id", paymentId) : query.is("payment_id", null);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) setMessage(`Impossibile caricare i documenti: ${error.message}`);
    else setItems((data ?? []) as Attachment[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [occurrenceId, paymentId]);
  useEffect(() => {
    if (!openLink && !preview) return;
    const timer = setTimeout(() => { setOpenLink(null); setPreview(null); }, 240000);
    return () => clearTimeout(timer);
  }, [openLink, preview]);

  async function upload() {
    if (locked || !files.length) return;
    setBusy(true); setMessage("");
    const pending = [...files];
    let count = 0;
    try {
      files.forEach(validateDocument);
      for (const file of files) {
        await addDocument(file, deadlineId, occurrenceId, paymentId, kind, description);
        pending.shift(); count++;
      }
      setDescription("");
      setMessage(`${count} documenti caricati.`);
    } catch (error) {
      setMessage(`${count ? `${count} documenti caricati. ` : ""}${documentError(error)} I file non salvati restano selezionati.`);
    } finally {
      setFiles(pending);
      await load(); setBusy(false);
    }
  }

  async function remove(item: Attachment) {
    if (locked || !window.confirm(`Eliminare il documento “${item.display_name}”?`)) return;
    setBusy(true); setMessage(""); setOpenLink(null); setPreview(null);
    try {
      // Remove metadata first: if it fails, the document remains usable.
      const { error } = await supabase.from("attachments").delete().eq("id", item.id).select("id").single();
      if (error) throw error;
      const { error: fileError } = await supabase.storage.from("receipts").remove([item.storage_path]);
      setMessage(fileError ? "Documento rimosso dall’elenco. La pulizia del file archiviato non è riuscita." : "Documento eliminato.");
      if (editing?.id === item.id) setEditing(null);
    } catch (error) { setMessage(documentError(error)); }
    finally { await load(); setBusy(false); }
  }

  async function saveEdit() {
    if (!editing || locked || !editing.display_name.trim()) return;
    setBusy(true); setMessage(""); setPreview(null); setOpenLink(null);
    let uploaded: Awaited<ReturnType<typeof uploadDocument>> | null = null;
    let committed = false;
    try {
      if (replacement) uploaded = await uploadDocument(replacement, deadlineId);
      const { error } = await supabase.from("attachments").update({
        display_name: editing.display_name.trim(), description: editing.description?.trim() || null,
        document_type: editing.document_type,
        ...(uploaded ? { storage_path: uploaded.storage_path, mime_type: uploaded.mime_type, size_bytes: uploaded.size_bytes } : {}),
      }).eq("id", editing.id).select("id").single();
      if (error) throw error;
      committed = true;
      const cleanup = uploaded ? await supabase.storage.from("receipts").remove([editing.storage_path]) : null;
      setEditing(null); setReplacement(null);
      setMessage(cleanup?.error ? "Documento aggiornato. La pulizia della vecchia copia non è riuscita." : "Documento aggiornato.");
    } catch (error) {
      if (uploaded && !committed) {
        const check = await supabase.from("attachments").select("storage_path").eq("id", editing.id).single();
        if (!check.error && check.data.storage_path !== uploaded.storage_path) await supabase.storage.from("receipts").remove([uploaded.storage_path]);
      }
      setMessage(documentError(error));
    } finally { await load(); setBusy(false); }
  }

  async function open(item: Attachment, download = false) {
    setBusy(true); setMessage(""); setOpenLink(null);
    try {
      const url = await documentUrl(item, download);
      if (!download && item.mime_type?.startsWith("image/")) setPreview({ url, item });
      else setOpenLink({ url, name: item.display_name, download });
    } catch (error) { setMessage(documentError(error)); }
    finally { setBusy(false); }
  }

  return <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4" aria-label={title}>
    <h3 className="flex items-center gap-2 font-semibold"><Paperclip size={17} />{title} <span className="text-sm font-normal text-slate-500">({items.length})</span></h3>
    {loading && <p className="mt-2 text-sm">Caricamento documenti…</p>}
    {!loading && !items.length && <p className="mt-2 text-sm text-slate-500">Nessun documento allegato.</p>}
    <ul className="mt-3 space-y-3">{items.map(item => <li key={item.id} className="rounded-lg bg-white p-3">
      <p className="break-words font-medium">{item.display_name}</p>
      <p className="text-xs text-slate-500">{DOCUMENT_TYPES[item.document_type as keyof typeof DOCUMENT_TYPES] ?? item.document_type} · {new Date(item.created_at).toLocaleDateString("it-IT")}{item.size_bytes != null ? ` · ${(item.size_bytes / 1024).toFixed(0)} KB` : ""}</p>
      {item.description && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.description}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="button-secondary" disabled={locked} onClick={() => open(item)}><Eye size={15} />Apri</button>
        <button type="button" className="button-secondary" disabled={locked} onClick={() => open(item, true)}><Download size={15} />Scarica</button>
        <button type="button" className="button-secondary" disabled={locked} onClick={() => { setEditing({ ...item }); setReplacement(null); }}><Pencil size={15} />Modifica</button>
        <button type="button" className="button-secondary text-red-600" disabled={locked} onClick={() => remove(item)} aria-label={`Elimina ${item.display_name}`}><Trash2 size={15} /></button>
      </div>
    </li>)}</ul>
    {editing && <div className="mt-3 space-y-3 rounded-lg border bg-white p-3">
      <label className="block text-sm">Nome documento<input className="input mt-1" maxLength={255} value={editing.display_name} onChange={e => setEditing({ ...editing, display_name: e.target.value })} disabled={locked} /></label>
      <label className="block text-sm">Tipo<select className="input mt-1" value={editing.document_type} onChange={e => setEditing({ ...editing, document_type: e.target.value })} disabled={locked}>{Object.entries(DOCUMENT_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="block text-sm">Descrizione<textarea className="input mt-1" maxLength={2000} value={editing.description ?? ""} onChange={e => setEditing({ ...editing, description: e.target.value })} disabled={locked} /></label>
      <p className="text-sm font-medium">Sostituisci file (facoltativo)</p>
      <DocumentPicker files={replacement ? [replacement] : []} onChange={selected => setReplacement(selected[0] ?? null)} disabled={locked} />
      <div className="flex gap-2"><button type="button" className="button-primary" disabled={locked || !editing.display_name.trim()} onClick={saveEdit}>Salva documento</button><button type="button" className="button-secondary" disabled={locked} onClick={() => setEditing(null)}>Annulla</button></div>
    </div>}
    <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-blue-700">Aggiungi documenti</summary>
      <fieldset className="mt-3 space-y-3" disabled={locked}>
        <DocumentPicker files={files} onChange={setFiles} multiple disabled={locked} />
        <label className="block text-sm">Tipo documento<select className="input mt-1" value={kind} onChange={e => setKind(e.target.value)}>{Object.entries(DOCUMENT_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="block text-sm">Descrizione (facoltativa)<textarea className="input mt-1" maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} /></label>
        <button type="button" className="button-primary" disabled={locked || !files.length} onClick={upload}>{busy ? "Operazione in corso…" : `Carica${files.length ? ` ${files.length} documenti` : " documenti"}`}</button>
      </fieldset>
    </details>
    {message && <p role="status" className="mt-3 text-sm text-slate-700">{message}</p>}
    {openLink && <p className="mt-3 text-sm"><a className="font-semibold text-blue-700 underline" href={openLink.url} target="_blank" rel="noopener noreferrer">{openLink.download ? "Scarica" : "Apri PDF"}: {openLink.name}</a><span className="block text-xs text-slate-500">Link temporaneo pronto.</span></p>}
    {preview && <div className="mt-4 rounded-lg bg-white p-3"><button type="button" className="button-secondary mb-2" onClick={() => setPreview(null)}><X size={15} />Chiudi anteprima</button><Image src={preview.url} alt={preview.item.display_name} width={1000} height={1000} unoptimized className="h-auto max-h-[70vh] w-full object-contain" /></div>}
  </section>;
}
