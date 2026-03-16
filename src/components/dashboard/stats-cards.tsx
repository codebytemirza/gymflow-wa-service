"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, CreditCard, AlertTriangle, Clock } from "lucide-react";
import type { ProfileRow, MemberRow, PaymentRow } from "@/types/database.types";

interface DashboardStats {
  totalMembers: number;
  activeMembers: number;
  revenueThisMonth: number;
  overduePayments: number;
  pendingPayments: number;
}

/**
 * Dashboard stats cards component — displays key metrics.
 */
export function StatsCards() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
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
        if (!profile?.gym_id) return;
        const gymId = profile.gym_id;

        const [membersRes, paymentsRes] = await Promise.all([
          supabase.from("members").select("id, status").eq("gym_id", gymId),
          supabase
            .from("payments")
            .select("id, status, amount, paid_date")
            .eq("gym_id", gymId),
        ]);

        const members = (membersRes.data ?? []) as Pick<MemberRow, "id" | "status">[];
        const payments = (paymentsRes.data ?? []) as Pick<
          PaymentRow,
          "id" | "status" | "amount" | "paid_date"
        >[];

        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString()
          .split("T")[0];

        const paidThisMonth = payments.filter(
          (p) =>
            p.status === "paid" &&
            p.paid_date != null &&
            p.paid_date >= firstOfMonth
        );

        setStats({
          totalMembers: members.length,
          activeMembers: members.filter((m) => m.status === "active").length,
          revenueThisMonth: paidThisMonth.reduce((sum, p) => sum + (p.amount ?? 0), 0),
          overduePayments: payments.filter((p) => p.status === "overdue").length,
          pendingPayments: payments.filter((p) => p.status === "pending").length,
        });
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Total Members",
      value: stats?.totalMembers ?? 0,
      subtitle: `${stats?.activeMembers ?? 0} active`,
      icon: Users,
      color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400",
    },
    {
      title: "Revenue This Month",
      value: formatCurrency(stats?.revenueThisMonth ?? 0),
      subtitle: "PKR collected",
      icon: CreditCard,
      color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400",
    },
    {
      title: "Overdue Payments",
      value: stats?.overduePayments ?? 0,
      subtitle: "need attention",
      icon: AlertTriangle,
      color: "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400",
    },
    {
      title: "Pending Payments",
      value: stats?.pendingPayments ?? 0,
      subtitle: "awaiting payment",
      icon: Clock,
      color: "text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card
          key={card.title}
          className="border-zinc-200/60 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {card.title}
            </CardTitle>
            <div className={`rounded-lg p-2 ${card.color}`}>
              <card.icon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">
              {card.value}
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {card.subtitle}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
