import { z } from "zod";

/** Zod schema for member creation */
export const memberCreateSchema = z.object({
  full_name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name is too long"),
  phone: z
    .string()
    .regex(/^(03\d{9}|923\d{9})$/, "Enter a valid Pakistani phone number (e.g. 03001234567)"),
  cnic: z
    .string()
    .regex(/^\d{5}-\d{7}-\d{1}$/, "CNIC format: 12345-1234567-1")
    .optional()
    .or(z.literal("")),
  address: z.string().max(250).optional().or(z.literal("")),
  emergency_contact: z
    .string()
    .regex(/^(03\d{9}|923\d{9})?$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  plan_fee: z.coerce
    .number()
    .min(100, "Fee must be at least 100")
    .max(100000, "Fee seems too high"),
  billing_day: z.coerce
    .number()
    .min(1, "Day must be 1-28")
    .max(28, "Day must be 1-28"),
  notes: z.string().max(500).optional().or(z.literal("")),
});

/** Zod schema for member update */
export const memberUpdateSchema = memberCreateSchema.partial();

export type MemberCreateInput = z.infer<typeof memberCreateSchema>;
export type MemberUpdateInput = z.infer<typeof memberUpdateSchema>;
