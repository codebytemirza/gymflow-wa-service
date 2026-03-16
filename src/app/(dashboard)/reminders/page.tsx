"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, MessageSquare, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PaymentRow, MemberRow, ProfileRow } from "@/types/database.types";

interface OverduePayment extends PaymentRow {
  member_name: string;
  member_phone: string;
}

export default function RemindersPage() {
  const [overdue, setOverdue] = useState<OverduePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingAll, setSendingAll] = useState(false);
  const [progress, setProgress] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from("profiles").select("gym_id").eq("id", user.id).single();
      const profile = profileData as Pick<ProfileRow, "gym_id"> | null;
      if (!profile?.gym_id) return;

      const [paymentsRes, membersRes] = await Promise.all([
        supabase.from("payments").select("*")
          .eq("gym_id", profile.gym_id)
          .eq("status", "overdue"),
        supabase.from("members").select("id, full_name, phone").eq("gym_id", profile.gym_id),
      ]);

      const pRows = (paymentsRes.data ?? []) as PaymentRow[];
      const mRows = (membersRes.data ?? []) as Pick<MemberRow, "id" | "full_name" | "phone">[];
      const memberMap = new Map(mRows.map((m) => [m.id, m]));

      const merged: OverduePayment[] = pRows
        .map((p) => ({
          ...p,
          member_name: memberMap.get(p.member_id)?.full_name ?? "Unknown",
          member_phone: memberMap.get(p.member_id)?.phone ?? "",
        }))
        .filter((p) => p.member_phone); // Only those with phones

      setOverdue(merged);
    } catch {
      toast.error("Failed to load overdue payments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSendAll() {
    if (overdue.length === 0) return;
    setSendingAll(true);
    setProgress(0);
    
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < overdue.length; i++) {
        const payment = overdue[i];
        try {
            let phone = payment.member_phone;
            if (phone.startsWith("0")) phone = "92" + phone.slice(1);
            if (phone.startsWith("+")) phone = phone.slice(1);

            const message = `Hello ${payment.member_name}, this is a reminder from GymFlow. Your payment of ${formatCurrency(payment.amount)} was due on ${formatDate(payment.due_date)}. Please clear your dues at your earliest convenience. Thank you!`;

            const res = await fetch("/api/wa/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone, message }),
            });

            if (!res.ok) throw new Error("Failed");
            successCount++;
        } catch {
            failCount++;
        }
        setProgress(i + 1);
        // Add a slight delay to avoid rate limits
        await new Promise(r => setTimeout(r, 500));
    }

    setSendingAll(false);
    if (failCount > 0) {
        toast.warning(`Sent ${successCount} reminders. Failed: ${failCount}`);
    } else {
        toast.success(`Successfully sent ${successCount} reminders!`);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reminders"
        description="Send manual or automated WhatsApp reminders."
      />
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-zinc-200/60 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Overdue Payments
            </CardTitle>
            <CardDescription>
              Members who have missed their due dates.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-lg bg-red-50 p-4 dark:bg-red-950/20">
                <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">Total Overdue</p>
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                        {loading ? "..." : overdue.length}
                    </p>
                </div>
                <Button 
                    onClick={handleSendAll}
                    disabled={sendingAll || overdue.length === 0 || loading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                >
                    {sendingAll ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <MessageSquare className="mr-2 h-4 w-4" />
                    )}
                    {sendingAll ? `Sending (${progress}/${overdue.length})` : "Send to All"}
                </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
