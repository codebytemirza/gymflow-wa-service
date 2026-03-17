import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

/** Merge Tailwind CSS classes with clsx */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format amount as PKR currency */
export function formatCurrency(amount: number, currency = "PKR"): string {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format date string to readable format */
export function formatDate(date: string | Date, pattern = "MMM d, yyyy"): string {
  return format(new Date(date), pattern);
}

/** Format date as relative time (e.g. "2 days ago") */
export function formatRelativeDate(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

/** Format phone number for display (923001234567 → 0300-1234567) */
export function formatPhone(phone: string): string {
  if (phone.startsWith("92") && phone.length === 12) {
    const local = "0" + phone.slice(2);
    return local.slice(0, 4) + "-" + local.slice(4);
  }
  return phone;
}

/** Convert local phone to E.164 without + (e.g. 03001234567 → 923001234567) */
export function toE164(phone: string): string {
  let cleaned = phone.replace(/[\s\-+()]/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "92" + cleaned.slice(1);
  }
  if (cleaned.startsWith("+92")) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Validate phone number format
 * Returns normalized phone if valid, null otherwise
 */
export function validatePhone(phone: string): { valid: boolean; normalized?: string; error?: string } {
  const normalized = toE164(phone);
  
  // Check length (E.164 allows 10-15 digits)
  if (normalized.length < 10 || normalized.length > 15) {
    return {
      valid: false,
      error: "Invalid phone number format. Must be 10-15 digits.",
    };
  }
  
  // Check if numeric only
  if (!/^\d+$/.test(normalized)) {
    return {
      valid: false,
      error: "Phone number must contain only digits.",
    };
  }
  
  // Pakistan-specific validation
  if (normalized.startsWith("92")) {
    if (normalized.length !== 12) {
      return {
        valid: false,
        error: "Pakistan numbers must be 12 digits (e.g., 923001234567)",
      };
    }
  }
  
  return { valid: true, normalized };
}

/** App-wide constants */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "GymFlow";

export const MEMBER_STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  inactive: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400",
  suspended: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};
