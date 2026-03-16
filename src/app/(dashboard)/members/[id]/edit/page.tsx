"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
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
import type { MemberRow } from "@/types/database.types";

/**
 * Edit member form — fetches existing data, validates, updates.
 */
export default function EditMemberPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
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

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        toast.error("Member not found.");
        router.push("/members");
        return;
      }

      const member = data as MemberRow;
      setForm({
        full_name: member.full_name,
        // format phone back for display (remove +92)
        phone: member.phone.startsWith("+92") ? "0" + member.phone.slice(3) : member.phone,
        cnic: member.cnic ?? "",
        address: member.address ?? "",
        emergency_contact: member.emergency_contact 
          ? (member.emergency_contact.startsWith("+92") ? "0" + member.emergency_contact.slice(3) : member.emergency_contact)
          : "",
        plan_fee: member.plan_fee.toString(),
        billing_day: member.billing_day.toString(),
        notes: member.notes ?? "",
      });
    } catch {
      toast.error("Failed to load member.");
    } finally {
      setInitialLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      const phone = toE164(result.data.phone);

      const { error } = await supabase
        .from("members")
        .update({
          full_name: result.data.full_name,
          phone,
          cnic: result.data.cnic || null,
          address: result.data.address || null,
          emergency_contact: result.data.emergency_contact
            ? toE164(result.data.emergency_contact)
            : null,
          plan_fee: result.data.plan_fee,
          billing_day: result.data.billing_day,
          notes: result.data.notes || null,
        } as never)
        .eq("id", id);

      if (error) {
        if (error.code === "23505") {
          toast.error("A member with this phone number already exists.");
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success(`${result.data.full_name} updated successfully!`);
      router.push(`/members/${id}`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (initialLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Member">
        <Link href={`/members/${id}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Profile
          </Button>
        </Link>
      </PageHeader>

      <Card className="max-w-2xl border-zinc-200/60 dark:border-zinc-800">
        <CardHeader>
          <CardTitle>Member Information</CardTitle>
          <CardDescription>
            Update the member&apos;s personal and billing details.
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
              <Link href={`/members/${id}`}>
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
                Save Changes
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
