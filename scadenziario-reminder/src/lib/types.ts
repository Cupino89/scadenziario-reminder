export type DeadlineStatus = "open" | "paid" | "cancelled" | "not_applicable";

export type OccurrenceStatus = "open" | "paid" | "skipped" | "cancelled";

export type Deadline = {
  deleted_at: string | null;
  status_before_trash: DeadlineStatus | null;
  id: string;
  user_id: string;
  title: string;
  category: string;
  due_date: string;
  recurrence: string;
  recurrence_interval: number | null;
  recurrence_unit: "days" | "weeks" | "months" | "years" | null;
  amount_expected: number | null;
  notes: string | null;
  reminder_days: number[];
  is_active: boolean;
  status: DeadlineStatus;
  created_at: string;
  entity_id: string | null;
  owner_id: string | null;
  asset_id: string | null;
};

export type Entity = { id:string; user_id:string; name:string; entity_type:"person"|"property"|"vehicle"|"organization"|"contract"|"other"; description:string|null; created_at:string; updated_at:string; };

export type DeadlineOccurrence = {
  id: string;
  deadline_id: string;
  due_date: string;
  status: OccurrenceStatus;
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  deadline_id: string;
  occurrence_id: string | null;
  generated_occurrence_id: string | null;
  paid_at: string;
  amount_paid: number | null;
  note: string | null;
  receipt_path: string | null;
  deadline_due_date_before: string | null;
  deadline_status_before: DeadlineStatus | null;
  created_at: string;
  updated_at: string;
};

export type Attachment = {
  id: string;
  user_id: string;
  deadline_id: string;
  occurrence_id: string;
  payment_id: string | null;
  storage_path: string;
  display_name: string;
  document_type: string;
  description: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  updated_at: string;
};

