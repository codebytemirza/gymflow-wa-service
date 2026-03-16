"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Bell,
  MessageCircle,
  Settings,
  LogOut,
  ChevronLeft,
  Dumbbell,
  Heart,
} from "lucide-react";
import { cn, APP_NAME } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GymFlowLogo } from "@/components/brand/logo";

/** Navigation links definition */
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/members", label: "Members", icon: Users },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/reminders", label: "Reminders", icon: Bell },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  gymName?: string;
}

/**
 * Sidebar component — dark themed with nav links, gym name, and sign out.
 */
export function Sidebar({ collapsed, onToggle, gymName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Signed out successfully.");
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-zinc-800 bg-zinc-950 text-zinc-300 transition-all duration-300",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-zinc-800 px-3">
        <GymFlowLogo size={36} className="shrink-0" />
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight text-white">
            {APP_NAME}
          </span>
        )}
      </div>

      {/* Gym name badge */}
      {!collapsed && gymName && (
        <div className="mx-3 mt-4 rounded-lg bg-zinc-900 px-3 py-2">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-emerald-500" />
            <span className="truncate text-sm font-medium text-zinc-200">
              {gymName}
            </span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="mt-4 flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-emerald-600/10 text-emerald-400"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section — donate + sign out + collapse toggle */}
      <div className="border-t border-zinc-800 p-3 space-y-1">
        {/* Donate button */}
        <a
          href="https://buymeacoffee.com/codebyte"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            "text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
          )}
          title={collapsed ? "Support GymFlow" : undefined}
        >
          <Heart className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Support GymFlow</span>}
        </a>

        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-red-400"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="mt-1 w-full text-zinc-500 hover:text-zinc-300"
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform",
              collapsed && "rotate-180"
            )}
          />
        </Button>
      </div>
    </aside>
  );
}
