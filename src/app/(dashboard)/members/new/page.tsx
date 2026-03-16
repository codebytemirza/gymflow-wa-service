"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { memberCreateSchema } from "@/lib/validations/member";
import { toE164 } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { ProfileRow } from "@/types/database.types";

/**
 * Add member form — validates via Zod, creates member + first payment.
 */
export default function NewMemberPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    cnic: "",
    address: "",
    emergency_contact: "",
    plan_fee: "",
    billing_day: "1",
    notes: "",
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    // Validate with Zod
    const result = memberCreateSchema.safeParse({
      ...form,
      plan_fee: form.plan_fee,
      billing_day: form.billing_day,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          fieldErrors[String(issue.path[0])] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("gym_id")
        .eq("id", user.id)
        .single();

      const profile = profileData as Pick<ProfileRow, "gym_id"> | null;
      if (!profile?.gym_id) {
        toast.error("Gym not found. Please complete your profile.");
        return;
      }

      const gymId = profile.gym_id;
      const phone = toE164(result.data.phone);

      const { data: member, error } = await supabase
        .from("members")
        .insert({
          gym_id: gymId,
          full_name: result.data.full_name,
          phone,
          cnic: result.data.cnic || null,
          address: result.data.address || null,
          emergency_contact: result.data.emergency_contact
            ? toE164(result.data.emergency_contact)
            : null,
          plan_fee: result.data.plan_fee,
          billing_day: result.data.billing_day,
          join_date: new Date().toISOString().split("T")[0],
          status: "active",
          notes: result.data.notes || null,
        } as never)
        .select("id")
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("A member with this phone number already exists.");
        } else {
          toast.error(error.message);
        }
        return;
      }

      const newMember = member as { id: string } | null;
      toast.success(`${result.data.full_name} added successfully!`);
      router.push(`/members/${newMember?.id}`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Add Member">
        <Link href="/members">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Members
          </Button>
        </Link>
      </PageHeader>

      <Card className="max-w-2xl border-zinc-200/60 dark:border-zinc-800">
        <CardHeader>
          <CardTitle>Member Information</CardTitle>
          <CardDescription>
            Fill in the details to register a new gym member.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => update("full_name", e.target.value)}
                placeholder="Muhammad Ali"
                autoFocus
              />
              {errors.full_name && (
                <p className="text-xs text-red-500">{errors.full_name}</p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="03001234567"
              />
              {errors.phone && (
                <p className="text-xs text-red-500">{errors.phone}</p>
              )}
            </div>

            {/* CNIC */}
            <div className="space-y-2">
              <Label htmlFor="cnic">CNIC</Label>
              <Input
                id="cnic"
                value={form.cnic}
                onChange={(e) => update("cnic", e.target.value)}
                placeholder="42101-1234567-1"
              />
              {errors.cnic && (
                <p className="text-xs text-red-500">{errors.cnic}</p>
              )}
            </div>

            {/* Fee + Billing Day side by side */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan_fee">Monthly Fee (PKR) *</Label>
                <Input
                  id="plan_fee"
                  type="number"
                  value={form.plan_fee}
                  onChange={(e) => update("plan_fee", e.target.value)}
                  placeholder="3000"
                  min={100}
                />
                {errors.plan_fee && (
                  <p className="text-xs text-red-500">{errors.plan_fee}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing_day">Billing Day (1–28) *</Label>
                <Input
                  id="billing_day"
                  type="number"
                  value={form.billing_day}
                  onChange={(e) => update("billing_day", e.target.value)}
                  placeholder="1"
                  min={1}
                  max={28}
                />
                {errors.billing_day && (
                  <p className="text-xs text-red-500">{errors.billing_day}</p>
                )}
              </div>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                placeholder="House 5, Street 10, Lahore"
              />
            </div>

            {/* Emergency Contact */}
            <div className="space-y-2">
              <Label htmlFor="emergency_contact">Emergency Contact</Label>
              <Input
                id="emergency_contact"
                value={form.emergency_contact}
                onChange={(e) => update("emergency_contact", e.target.value)}
                placeholder="03001234567"
              />
              {errors.emergency_contact && (
                <p className="text-xs text-red-500">{errors.emergency_contact}</p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="Any additional notes about the member..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Link href="/members">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Member
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
