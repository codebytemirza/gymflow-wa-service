"use client";

import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface NavbarProps {
  onMenuToggle: () => void;
}

/**
 * Top navbar — mobile menu toggle + search bar.
 */
export function Navbar({ onMenuToggle }: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-zinc-200/60 bg-white/80 px-4 backdrop-blur-lg dark:border-zinc-800 dark:bg-zinc-950/80 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuToggle}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </Button>

      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <Input
          id="global-search"
          placeholder="Search members, payments..."
          className="pl-9 bg-zinc-50 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800"
        />
      </div>
    </header>
  );
}
