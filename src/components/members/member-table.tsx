"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Phone } from "lucide-react";
import { cn, formatCurrency, formatDate, formatPhone, MEMBER_STATUS_COLORS } from "@/lib/utils";
import type { MemberRow } from "@/types/database.types";

interface MemberTableProps {
  members: MemberRow[];
}

/**
 * Reusable member table component with status badges and action links.
 */
export function MemberTable({ members }: MemberTableProps) {
  if (members.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 p-12 text-center dark:border-zinc-800">
        <p className="text-zinc-500 dark:text-zinc-400">No members found.</p>
        <Link href="/members/new" className="mt-3 inline-block">
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
            Add First Member
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200/60 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-200/60 dark:border-zinc-800">
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Monthly Fee</TableHead>
            <TableHead>Billing Day</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow
              key={member.id}
              className="border-zinc-200/60 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <TableCell className="font-medium text-zinc-900 dark:text-white">
                {member.full_name}
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                  <Phone className="h-3.5 w-3.5" />
                  {formatPhone(member.phone)}
                </span>
              </TableCell>
              <TableCell className="font-medium text-zinc-700 dark:text-zinc-300">
                {formatCurrency(member.plan_fee)}
              </TableCell>
              <TableCell className="text-zinc-600 dark:text-zinc-400">
                {member.billing_day}
              </TableCell>
              <TableCell className="text-sm text-zinc-500 dark:text-zinc-400">
                {formatDate(member.join_date)}
              </TableCell>
              <TableCell>
                <Badge
                  className={cn(
                    "capitalize border-0",
                    MEMBER_STATUS_COLORS[member.status]
                  )}
                >
                  {member.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/members/${member.id}`}>
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
