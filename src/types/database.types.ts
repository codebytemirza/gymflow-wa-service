/* ============================================================
 * GymFlow — Supabase Database Types
 * Structured to match @supabase/supabase-js generic Database format.
 * ============================================================ */

// ──────────────────────────── Enums ──────────────────────────

export type UserRole = "super_admin" | "gym_owner";
export type MemberStatus = "active" | "inactive" | "suspended";
export type PaymentStatus = "pending" | "paid" | "overdue";
export type ReminderType = "due_today" | "late_reminder" | "final_warning";
export type ReminderDeliveryStatus = "sent" | "failed" | "skipped";
export type WaStatus = "connected" | "disconnected" | "connecting" | "banned";
export type GymStatus = "active" | "suspended" | "trial";

// ──────────────────────────── Row Types ──────────────────────

export type GymRow = {
  id: string;
  owner_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  default_fee: number;
  currency: string;
  status: GymStatus;
  trial_ends_at: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
};

export type ProfileRow = {
  id: string;
  gym_id: string;
  role: UserRole;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type MemberRow = {
  id: string;
  gym_id: string;
  full_name: string;
  phone: string;
  cnic: string | null;
  address: string | null;
  emergency_contact: string | null;
  plan_fee: number;
  billing_day: number;
  join_date: string;
  status: MemberStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentRow = {
  id: string;
  gym_id: string;
  member_id: string;
  due_date: string;
  paid_date: string | null;
  amount: number;
  status: PaymentStatus;
  collected_by: string | null;
  receipt_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ReminderConfigRow = {
  id: string;
  gym_id: string;
  remind_on_due_date: boolean;
  late_reminder_days: number[];
  final_warning_days: number;
  due_date_template: string;
  late_template: string;
  final_template: string;
  reminders_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type ReminderLogRow = {
  id: string;
  gym_id: string;
  member_id: string;
  payment_id: string | null;
  type: ReminderType;
  message_text: string;
  status: ReminderDeliveryStatus;
  error_msg: string | null;
  sent_at: string;
};

export type ReminderQueueRow = {
  id: string;
  gym_id: string;
  member_id: string;
  payment_id: string | null;
  type: ReminderType;
  message_text: string;
  phone: string;
  processed: boolean;
  created_at: string;
};

export type WaSessionRow = {
  id: string;
  gym_id: string;
  phone_number: string | null;
  status: WaStatus;
  session_data: string | null;
  qr_code: string | null;
  connected_at: string | null;
  disconnected_at: string | null;
  created_at: string;
  updated_at: string;
};

// Convenience aliases matching original names
export type Gym = GymRow;
export type Profile = ProfileRow;
export type Member = MemberRow;
export type Payment = PaymentRow;
export type ReminderConfig = ReminderConfigRow;
export type ReminderLog = ReminderLogRow;
export type WaSession = WaSessionRow;

// ──────────────────────────── Database Type ──────────────────

export type Database = {
  public: {
    Tables: {
      gyms: {
        Row: GymRow;
        Insert: Omit<GymRow, "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Omit<GymRow, "id" | "created_at" | "updated_at">>;
      };
      profiles: {
        Row: ProfileRow;
        Insert: Omit<ProfileRow, "created_at" | "updated_at">;
        Update: Partial<Omit<ProfileRow, "id" | "created_at" | "updated_at">>;
      };
      members: {
        Row: MemberRow;
        Insert: Omit<MemberRow, "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Omit<MemberRow, "id" | "created_at" | "updated_at" | "gym_id">>;
      };
      payments: {
        Row: PaymentRow;
        Insert: Omit<PaymentRow, "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Omit<PaymentRow, "id" | "created_at" | "updated_at" | "gym_id">>;
      };
      reminder_configs: {
        Row: ReminderConfigRow;
        Insert: Omit<ReminderConfigRow, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<ReminderConfigRow, "id" | "created_at" | "updated_at" | "gym_id">>;
      };
      reminder_logs: {
        Row: ReminderLogRow;
        Insert: Omit<ReminderLogRow, "id">;
        Update: never;
      };
      reminder_queue: {
        Row: ReminderQueueRow;
        Insert: Omit<ReminderQueueRow, "id" | "created_at" | "processed">;
        Update: { processed: boolean };
      };
      wa_sessions: {
        Row: WaSessionRow;
        Insert: Omit<WaSessionRow, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<WaSessionRow, "id" | "created_at" | "updated_at">>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_my_gym_id: { Args: Record<string, never>; Returns: string };
      is_super_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      user_role: UserRole;
      member_status: MemberStatus;
      payment_status: PaymentStatus;
      reminder_type: ReminderType;
      reminder_status: ReminderDeliveryStatus;
      wa_status: WaStatus;
      gym_status: GymStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
