"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import type { ProfileRow, GymRow } from "@/types/database.types";

/**
 * Dashboard layout — dark sidebar + light content area.
 * Responsive: sidebar collapses to sheet on mobile.
 * Includes error boundary for graceful error handling.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [gymName, setGymName] = useState<string | undefined>();

  useEffect(() => {
    async function fetchGym() {
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

      const { data: gymData } = await supabase
        .from("gyms")
        .select("name")
        .eq("id", profile.gym_id)
        .single();

      const gym = gymData as Pick<GymRow, "name"> | null;
      if (gym) setGymName(gym.name);
    }
    fetchGym();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          gymName={gymName}
        />
      </div>

      {/* Mobile sidebar (sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0 bg-zinc-950 border-zinc-800">
          <Sidebar
            collapsed={false}
            onToggle={() => setMobileOpen(false)}
            gymName={gymName}
          />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div
        className={cn(
          "transition-all duration-300",
          collapsed ? "lg:pl-[68px]" : "lg:pl-64"
        )}
      >
        <Navbar onMenuToggle={() => setMobileOpen(true)} />
        <main className="p-4 lg:p-6">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
