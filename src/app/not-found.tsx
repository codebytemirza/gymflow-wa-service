import Link from "next/link";
import { GymFlowLogo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="text-center space-y-6 max-w-md">
        <GymFlowLogo size={56} className="mx-auto" />

        <div>
          <h1 className="text-8xl font-black text-zinc-900 dark:text-white">404</h1>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-700 dark:text-zinc-300">
            Page not found
          </h2>
          <p className="mt-3 text-zinc-500 dark:text-zinc-400">
            The page you&apos;re looking for doesn&apos;t exist or was moved.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
