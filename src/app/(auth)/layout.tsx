import { APP_NAME } from "@/lib/utils";

/**
 * Auth layout — centered card layout for login/register pages.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-zinc-50 via-white to-emerald-50 px-4 dark:from-zinc-950 dark:via-zinc-900 dark:to-emerald-950">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-xl font-bold text-white shadow-lg shadow-emerald-500/20">
            G
          </div>
          <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {APP_NAME}
          </span>
        </div>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Gym Management Made Simple
        </p>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
