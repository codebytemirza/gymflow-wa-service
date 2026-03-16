"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, CheckCircle, Loader2, Edit, MessageSquare, Trash2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import type { PaymentRow, MemberRow, ProfileRow, PaymentStatus } from "@/types/database.types";

interface PaymentWithMember extends PaymentRow {
  member_name: string;
  member_phone: string;
}

/**
 * Payments list page — filterable by status with inline mark-as-paid dialog.
 */
export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentWithMember[]>([]);
  const [filtered, setFiltered] = useState<PaymentWithMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "all">("all");

  // Edit Payment Dialog State
  const [editingPayment, setEditingPayment] = useState<PaymentWithMember | null>(null);
  const [editStatus, setEditStatus] = useState<string>("pending");
  const [editDueDate, setEditDueDate] = useState<string>("");
  const [editAmount, setEditAmount] = useState<string>("");
  const [editPaidDate, setEditPaidDate] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [savingPayment, setSavingPayment] = useState(false);

  // Sending Reminder State
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  // Delete state
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from("profiles").select("gym_id").eq("id", user.id).single();
      const profile = profileData as Pick<ProfileRow, "gym_id"> | null;
      if (!profile?.gym_id) return;

      // Fetch payments + members in parallel
      const [paymentsRes, membersRes] = await Promise.all([
        supabase.from("payments").select("*").eq("gym_id", profile.gym_id)
          .order("due_date", { ascending: false }),
        supabase.from("members").select("id, full_name, phone").eq("gym_id", profile.gym_id),
      ]);

      const pRows = (paymentsRes.data ?? []) as PaymentRow[];
      const mRows = (membersRes.data ?? []) as Pick<MemberRow, "id" | "full_name" | "phone">[];
      const memberMap = new Map(mRows.map((m) => [m.id, m]));

      const merged: PaymentWithMember[] = pRows.map((p) => ({
        ...p,
        member_name: memberMap.get(p.member_id)?.full_name ?? "Unknown",
        member_phone: memberMap.get(p.member_id)?.phone ?? "",
      }));

      setPayments(merged);
      setFiltered(merged);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  useEffect(() => {
    let result = payments;
    if (statusFilter !== "all") result = result.filter((p) => p.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) =>
        p.member_name.toLowerCase().includes(q) || p.member_phone.includes(q)
      );
    }
    setFiltered(result);
  }, [search, statusFilter, payments]);

  function openEditPayment(payment: PaymentWithMember) {
    setEditingPayment(payment);
    setEditStatus(payment.status);
    setEditDueDate(payment.due_date);
    setEditAmount(payment.amount.toString());
    setEditPaidDate(payment.paid_date || new Date().toISOString().split("T")[0]);
    setEditNotes(payment.notes || "");
  }

  async function handleSavePayment() {
    if (!editingPayment) return;
    setSavingPayment(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("payments")
        .update({
          status: editStatus,
          due_date: editDueDate,
          amount: Number(editAmount),
          paid_date: editStatus === "paid" ? editPaidDate : null,
          notes: editNotes || null,
          collected_by: user?.id ?? null,
        } as never)
        .eq("id", editingPayment.id);

      if (error) throw error;
      toast.success("Payment updated successfully!");
      setEditingPayment(null);
      await fetchPayments();
    } catch {
      toast.error("Failed to update payment.");
    } finally {
      setSavingPayment(false);
    }
  }

  async function handleSendReminder(payment: PaymentWithMember) {
    if (!payment.member_phone) {
      toast.error("Member has no phone number attached.");
      return;
    }
    setSendingReminder(payment.id);
    try {
      // Ensure E164 format (+92...) but strip the '+' for Baileys
      let phone = payment.member_phone;
      if (phone.startsWith("0")) phone = "92" + phone.slice(1);
      if (phone.startsWith("+")) phone = phone.slice(1);

      const message = `Hello ${payment.member_name}, this is a reminder from GymFlow. Your payment of ${formatCurrency(payment.amount)} was due on ${formatDate(payment.due_date)}. Please clear your dues at your earliest convenience. Thank you!`;

      const res = await fetch("/api/wa/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, message }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send message");
      }
      toast.success("Reminder message sent via WhatsApp!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSendingReminder(null);
    }
  }

  async function handleDeletePayment(paymentId: string) {
    setDeletingPaymentId(paymentId);
    setConfirmDeleteId(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("payments").delete().eq("id", paymentId);
      if (error) throw error;
      toast.success("Payment deleted.");
      await fetchPayments();
    } catch {
      toast.error("Failed to delete payment.");
    } finally {
      setDeletingPaymentId(null);
    }
  }

  // Summary counts
  const counts = {
    all: payments.length,
    paid: payments.filter((p) => p.status === "paid").length,
    pending: payments.filter((p) => p.status === "pending").length,
    overdue: payments.filter((p) => p.status === "overdue").length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description={`${counts.overdue} overdue · ${counts.pending} pending · ${counts.paid} paid`}
      />

      {/* Quick filter pills */}
      <div className="flex flex-wrap gap-2">
        {(["all", "overdue", "pending", "paid"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            onClick={() => setStatusFilter(s)}
            className={
              statusFilter === s && s === "overdue"
                ? "bg-red-600 hover:bg-red-700"
                : statusFilter === s && s === "pending"
                ? "bg-amber-500 hover:bg-amber-600"
                : statusFilter === s && s === "paid"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : ""
            }
          >
            <span className="capitalize">{s}</span>
            <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">
              {counts[s]}
            </span>
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <Input
          placeholder="Search by member name or phone..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200/60 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-200/60 dark:border-zinc-800">
                <TableHead>Member</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Paid On</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-zinc-400">
                    No payments match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((payment) => (
                  <TableRow
                    key={payment.id}
                    className="border-zinc-200/60 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                  >
                    <TableCell>
                      <Link
                        href={`/members/${payment.member_id}`}
                        className="font-medium text-zinc-900 hover:text-emerald-600 dark:text-white dark:hover:text-emerald-400"
                      >
                        {payment.member_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                      {formatDate(payment.due_date)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                    <TableCell>
                      <PaymentStatusBadge status={payment.status} />
                    </TableCell>
                    <TableCell className="text-sm text-zinc-500">
                      {payment.paid_date ? formatDate(payment.paid_date) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {payment.status === "overdue" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSendReminder(payment)}
                            disabled={sendingReminder === payment.id}
                            className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950"
                          >
                            {sendingReminder === payment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MessageSquare className="h-4 w-4" />
                            )}
                            <span className="sr-only">Send Reminder</span>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditPayment(payment)}
                          className="text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
                        >
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmDeleteId(payment.id)}
                          disabled={deletingPaymentId === payment.id}
                          className="text-zinc-400 hover:text-red-500 dark:hover:text-red-400"
                        >
                          {deletingPaymentId === payment.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Payment Dialog */}
      <Dialog open={!!editingPayment} onOpenChange={(open) => !open && setEditingPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
            <DialogDescription>
              Update payment details for {editingPayment?.member_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={editStatus} onValueChange={(val) => setEditStatus(val || "pending")}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (PKR)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  min={1}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                />
              </div>
              {editStatus === "paid" && (
                <div className="space-y-2">
                  <Label htmlFor="paid_date">Paid Date</Label>
                  <Input
                    id="paid_date"
                    type="date"
                    value={editPaidDate}
                    onChange={(e) => setEditPaidDate(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Method of payment, receipt #, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPayment(null)} disabled={savingPayment}>
              Cancel
            </Button>
            <Button
              onClick={handleSavePayment}
              disabled={savingPayment}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {savingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Payment Confirmation Dialog */}
      <Dialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Payment</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this payment record? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => confirmDeleteId && handleDeletePayment(confirmDeleteId)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
