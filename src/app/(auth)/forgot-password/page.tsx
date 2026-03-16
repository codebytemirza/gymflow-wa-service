"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dumbbell, ArrowRight, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      setSubmitted(true);
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950 sm:px-6 lg:px-8">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
              <Dumbbell className="h-6 w-6" />
            </div>
            GymFlow
          </Link>
          <h2 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
            Reset your password
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Enter your email address to receive a password reset link.
          </p>
        </div>

        {submitted ? (
          <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50 p-6 text-center dark:border-emerald-800 dark:bg-emerald-950/20">
            <h3 className="mb-2 font-medium text-emerald-800 dark:text-emerald-300">
              Check your inbox
            </h3>
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              We&apos;ve sent a password reset link to <strong>{email}</strong>. Please check your email and click the link to continue.
            </p>
            <Button
              className="mt-6 w-full"
              variant="outline"
              onClick={() => router.push("/login")}
            >
              Back to Login
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200/60 bg-white p-8 shadow-xl shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-zinc-700 dark:text-zinc-300">
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@gym.com"
                  required
                  autoComplete="email"
                  className="h-11"
                />
              </div>

              <div className="space-y-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      Send Reset Link
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </Button>

                <div className="text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center text-sm font-medium text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors"
                  >
                    <ArrowLeft className="mr-1 h-3 w-3" />
                    Back to login
                  </Link>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
