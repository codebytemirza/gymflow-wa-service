import Link from "next/link";
import { ArrowRight, Dumbbell, Users, CreditCard, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/utils";

/**
 * Landing page — redirects to dashboard or shows marketing hero.
 */
export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/60 bg-white/80 backdrop-blur-lg dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
              G
            </div>
            <span className="text-lg font-bold tracking-tight">{APP_NAME}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
            <Dumbbell className="h-4 w-4" />
            Open Source Gym Management
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl dark:text-white">
            Manage your gym
            <br />
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
              like a pro
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
            Track members, collect payments, send WhatsApp reminders — all from
            one dashboard. Built for Pakistani gyms. Free &amp; open source.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/register">
              <Button size="lg" className="bg-emerald-600 px-8 hover:bg-emerald-700">
                Start Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="px-8">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Features grid */}
        <div className="mx-auto mt-20 grid max-w-4xl gap-6 sm:grid-cols-3">
          {[
            {
              icon: Users,
              title: "Member Management",
              desc: "Add, track, and manage all your gym members in one place.",
            },
            {
              icon: CreditCard,
              title: "Payment Tracking",
              desc: "Never miss a payment. Auto-detect overdue fees instantly.",
            },
            {
              icon: MessageCircle,
              title: "WhatsApp Reminders",
              desc: "Automated payment reminders via WhatsApp. Set it & forget it.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-zinc-200/60 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="mb-3 inline-flex rounded-xl bg-emerald-100 p-2.5 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-zinc-900 dark:text-white">
                {feature.title}
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200/60 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <p>
          Built with ❤️ by{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            Muhammad Abdullah
          </span>{" "}
          for the Pakistani gym community
        </p>
        <p className="mt-1">JazzCash Donate: 03284119134</p>
      </footer>
    </div>
  );
}
