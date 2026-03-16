"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { MemberTable } from "@/components/members/member-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, Search } from "lucide-react";
import type { MemberRow, ProfileRow, MemberStatus } from "@/types/database.types";

/**
 * Members list page — searchable, filterable table of all gym members.
 */
export default function MembersPage() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [filtered, setFiltered] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MemberStatus | "all">("all");

  const fetchMembers = useCallback(async () => {
    setLoading(true);
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

      const { data } = await supabase
        .from("members")
        .select("*")
        .eq("gym_id", profile.gym_id)
        .order("created_at", { ascending: false });

      const rows = (data ?? []) as MemberRow[];
      setMembers(rows);
      setFiltered(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    let result = members;
    if (statusFilter !== "all") {
      result = result.filter((m) => m.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.full_name.toLowerCase().includes(q) ||
          m.phone.includes(q)
      );
    }
    setFiltered(result);
  }, [search, statusFilter, members]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        description={`${members.length} total member${members.length !== 1 ? "s" : ""}`}
      >
        <Link href="/members/new">
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <UserPlus className="mr-2 h-4 w-4" />
            Add Member
          </Button>
        </Link>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search by name or phone..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as MemberStatus | "all")}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : (
        <MemberTable members={filtered} />
      )}
    </div>
  );
}
