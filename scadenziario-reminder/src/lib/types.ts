export type DeadlineStatus = "open" | "paid" | "cancelled" | "not_applicable";

export type Deadline = {
  id: string;
  user_id: string;
  title: string;
  category: string;
  due_date: string;
  recurrence: string;
  amount_expected: number | null;
  notes: string | null;
  reminder_days: number[];
  is_active: boolean;
  status: DeadlineStatus;
  created_at: string;
};

export type Payment = {
  id: string;
  deadline_id: string;
  paid_at: string;
  amount_paid: number | null;
  note: string | null;
  receipt_path: string | null;
  created_at: string;
};
