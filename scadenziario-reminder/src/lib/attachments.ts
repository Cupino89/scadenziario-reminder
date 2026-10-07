import { supabase } from "@/lib/supabase";
import type { Attachment } from "@/lib/types";

export const DOCUMENT_TYPES = {
  receipt: "Ricevuta", invoice: "Fattura", f24: "F24", discharge: "Quietanza",
  notice: "Avviso di pagamento", certificate: "Attestazione", other: "Altro",
} as const;
// validateDocument enforces supported formats before every upload, independently of picker hints.
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;
export function validateDocument(file: File) {
  if (!file.size || file.size > MAX_DOCUMENT_SIZE) throw new Error("Ogni file deve essere non vuoto e di massimo 10 MB.");
  const mime = file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : /\.png$/i.test(file.name) ? "image/png" : /\.jpe?g$/i.test(file.name) ? "image/jpeg" : "");
  if (!["application/pdf", "image/jpeg", "image/png"].includes(mime)) throw new Error("Sono ammessi PDF, JPG e PNG.");
  return mime;
}
export async function uploadDocument(file: File, deadlineId: string) {
  const mime = validateDocument(file);
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError || !data.user) throw new Error("Sessione scaduta. Accedi nuovamente.");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-150);
  const path = `${data.user.id}/${deadlineId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from("receipts").upload(path, file, { contentType: mime, upsert: false });
  if (error) throw error;
  return { storage_path: path, mime_type: mime, size_bytes: file.size, user_id: data.user.id };
}
export async function addDocument(file: File, deadlineId: string, occurrenceId: string, paymentId: string | null, documentType: string, description = "") {
  const uploaded = await uploadDocument(file, deadlineId);
  const { error } = await supabase.from("attachments").insert({
    ...uploaded, deadline_id: deadlineId, occurrence_id: occurrenceId, payment_id: paymentId,
    display_name: file.name, document_type: documentType, description: description.trim() || null,
  });
  if (error) {
    // A lost response can conceal a successful insert. Remove only a confirmed unused upload.
    const check = await supabase.from("attachments").select("id").eq("storage_path", uploaded.storage_path);
    if (!check.error && check.data?.length === 0) await supabase.storage.from("receipts").remove([uploaded.storage_path]);
    if (!check.error && check.data?.length) return;
    throw error;
  }
}
export async function documentUrl(attachment: Attachment, download = false) {
  const { data, error } = await supabase.storage.from("receipts").createSignedUrl(
    attachment.storage_path, 300, download ? { download: attachment.display_name } : undefined
  );
  if (error) throw error;
  return data.signedUrl;
}
export function documentError(error: unknown) {
  return error && typeof error === "object" && "message" in error ? String(error.message) : "Operazione non riuscita. Riprova.";
}
