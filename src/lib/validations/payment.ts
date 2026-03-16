import { z } from "zod";

/** Zod schema for marking a payment as paid */
export const markPaidSchema = z.object({
  paid_date: z.string().min(1, "Paid date is required"),
  amount: z.coerce.number().min(1, "Amount must be at least 1"),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type MarkPaidInput = z.infer<typeof markPaidSchema>;
