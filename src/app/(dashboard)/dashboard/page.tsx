import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, CreditCard, MessageCircle, Settings } from "lucide-react";

export const metadata = {
  title: "Dashboard",
};

/**
 * Dashboard home page — stats overview + quick actions.
 */
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here's an overview of your gym."
      />

      {/* Stats */}
      <StatsCards />

      {/* Quick Actions */}
      <Card className="border-zinc-200/60 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/members/new">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 h-auto py-3"
              >
                <UserPlus className="h-4 w-4 text-emerald-600" />
                <div className="text-left">
                  <div className="font-medium">Add Member</div>
                  <div className="text-xs text-zinc-500">Register new member</div>
                </div>
              </Button>
            </Link>
            <Link href="/payments">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 h-auto py-3"
              >
                <CreditCard className="h-4 w-4 text-blue-600" />
                <div className="text-left">
                  <div className="font-medium">View Payments</div>
                  <div className="text-xs text-zinc-500">Manage all payments</div>
                </div>
              </Button>
            </Link>
            <Link href="/whatsapp">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 h-auto py-3"
              >
                <MessageCircle className="h-4 w-4 text-green-600" />
                <div className="text-left">
                  <div className="font-medium">WhatsApp</div>
                  <div className="text-xs text-zinc-500">Connect & manage</div>
                </div>
              </Button>
            </Link>
            <Link href="/settings">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 h-auto py-3"
              >
                <Settings className="h-4 w-4 text-zinc-600" />
                <div className="text-left">
                  <div className="font-medium">Settings</div>
                  <div className="text-xs text-zinc-500">Gym profile & config</div>
                </div>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
